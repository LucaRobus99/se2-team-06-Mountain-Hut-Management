import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEmailService } from '../../../../src/services/emailService.js';

const mockCreateMessage = vi.fn();

vi.mock('mailgun.js', () => ({
  default: class MockMailgun {
    client() {
      return { messages: { create: mockCreateMessage } };
    }
  },
}));

describe('emailService - delivery resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retries transient 5xx failures and succeeds', async () => {
    const transient = Object.assign(new Error('upstream error'), { status: 500 });
    mockCreateMessage.mockRejectedValueOnce(transient).mockResolvedValueOnce({ id: '<ok>' });
    const service = createEmailService({ apiKey: 'key', domain: 'hut.org', retryDelaysMs: [0, 0] });

    const result = await service.sendBookingEmail('created', 'user@example.com', { name: 'User' });

    expect(result).toEqual({ id: '<ok>' });
    expect(mockCreateMessage).toHaveBeenCalledTimes(2);
  });

  it('does not retry permanent 4xx failures', async () => {
    const permanent = Object.assign(new Error('invalid recipient'), { status: 400 });
    mockCreateMessage.mockRejectedValue(permanent);
    const service = createEmailService({ apiKey: 'key', domain: 'hut.org', retryDelaysMs: [0, 0, 0] });

    await expect(
      service.sendBookingEmail('created', 'user@example.com', { name: 'User' })
    ).rejects.toThrow('invalid recipient');
    expect(mockCreateMessage).toHaveBeenCalledTimes(1);
  });

  it('keeps Mailgun variables under the 16KB option limit', async () => {
    mockCreateMessage.mockResolvedValue({ id: '<ok>' });
    const service = createEmailService({ apiKey: 'key', domain: 'hut.org' });
    const requirements = Array.from({ length: 40 }, (_, i) => ({
      description: `requirement ${i} ` + 'x'.repeat(450),
      allergies: false,
    }));

    await service.sendBookingEmail('created', 'user@example.com', {
      name: 'User', booking_id: 42, party_requirements: requirements,
    });

    const payload = mockCreateMessage.mock.calls[0][1]['h:X-Mailgun-Variables'];
    expect(Buffer.byteLength(payload, 'utf8')).toBeLessThanOrEqual(12000);
    const parsed = JSON.parse(payload);
    expect(parsed.party_requirements_truncated).toBe(true);
    expect(parsed.party_requirements.length).toBeLessThan(requirements.length);
  });

  it('sends the recipient as a bare address', async () => {
    mockCreateMessage.mockResolvedValue({ id: '<ok>' });
    const service = createEmailService({ apiKey: 'key', domain: 'hut.org' });

    await service.sendBookingEmail('created', 'user@example.com', { name: 'Doe, Jane' });

    expect(mockCreateMessage).toHaveBeenCalledWith(
      'hut.org',
      expect.objectContaining({ to: ['user@example.com'] })
    );
  });
  it('tries the other Mailgun region after a 401', async () => {
    const unauthorized = Object.assign(new Error('Unauthorized'), { status: 401 });
    mockCreateMessage.mockRejectedValueOnce(unauthorized).mockResolvedValueOnce({ id: '<ok>' });
    const service = createEmailService({
      apiKey: 'key', domain: 'hut.org', url: 'https://api.mailgun.net', retryDelaysMs: [0],
    });

    const result = await service.sendBookingEmail('created', 'user@example.com', { name: 'User' });

    expect(result).toEqual({ id: '<ok>' });
    expect(mockCreateMessage).toHaveBeenCalledTimes(2);
  });

  it('verifyTemplates falls back to the other region after a 401', async () => {
    const ok = () => new Response(
      JSON.stringify({ template: { versions: [{ tag: 'v1', active: true }] } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockImplementation(async () => ok());
    vi.stubGlobal('fetch', fetchMock);

    try {
      const service = createEmailService({
        apiKey: 'key', domain: 'hut.org', url: 'https://api.mailgun.net',
      });
      const result = await service.verifyTemplates();
      expect(result.templates.every((template) => template.ok)).toBe(true);
      expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });

});
