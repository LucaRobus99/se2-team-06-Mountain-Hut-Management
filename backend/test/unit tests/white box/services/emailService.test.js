import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createEmailService,
  createEmailServiceFromConfig,
} from '../../../../src/services/emailService.js';

const mockCreateMessage = vi.fn();
let shouldThrowOnClientInit = false;
const createdClients = [];

vi.mock('mailgun.js', () => {
  return {
    default: class MockMailgun {
      constructor() {
        if (shouldThrowOnClientInit) {
          throw new Error('Mailgun initialization failed');
        }
      }
      client(opts) {
        const clientObj = {
          url: opts.url,
          messages: {
            create: mockCreateMessage,
          },
        };
        createdClients.push(clientObj);
        return clientObj;
      }
    },
  };
});

describe('emailService - White-Box Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shouldThrowOnClientInit = false;
    createdClients.length = 0;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('Client Initialization Branches', () => {
    it('should not initialize client if apiKey or domain are missing', () => {
      const service = createEmailService({ apiKey: null, domain: null });
      expect(service.isEnabled()).toBe(false);
    });

    it('should successfully initialize client when apiKey and domain are provided', () => {
      const service = createEmailService({ apiKey: 'test-key', domain: 'test.org' });
      expect(service.isEnabled()).toBe(true);
      expect(createdClients.map((c) => c.url)).toEqual([
        'https://api.mailgun.net',
        'https://api.eu.mailgun.net',
      ]);
    });

    it('should catch initialization errors gracefully and set client to null', () => {
      shouldThrowOnClientInit = true;
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const service = createEmailService({ apiKey: 'test-key', domain: 'test.org' });

      expect(service.isEnabled()).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to initialise Mailgun client:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should include custom url and alternate region during client initialization', () => {
      const service = createEmailService({
        apiKey: 'test-key',
        domain: 'test.org',
        url: 'https://api.eu.mailgun.net/',
      });
      expect(service.isEnabled()).toBe(true);
      expect(createdClients.map((c) => c.url)).toEqual([
        'https://api.eu.mailgun.net',
        'https://api.mailgun.net',
      ]);
    });
  });

  describe('Recipient and Payload Resolution Branches (sendBookingConfirmation)', () => {
    it('should resolve recipient when passed as string and fields as object', async () => {
      mockCreateMessage.mockResolvedValueOnce({ id: '<msg-id>' });
      const service = createEmailService({ apiKey: 'key', domain: 'hut.org' });

      const result = await service.sendBookingConfirmation('user@example.com', {
        name: 'John',
        date: '2026-08-14',
      });

      expect(result).toEqual({ id: '<msg-id>' });
      expect(mockCreateMessage).toHaveBeenCalledWith(
        'hut.org',
        expect.objectContaining({
          to: ['user@example.com'],
          template: 'booking-confirmation',
        })
      );
    });

    it('should resolve recipient from object properties (to, email, or recipient)', async () => {
      mockCreateMessage.mockResolvedValue({ id: '<msg-id>' });
      const service = createEmailService({ apiKey: 'key', domain: 'hut.org' });

      await service.sendBookingConfirmation({ email: 'email@example.com', name: 'Alice' });
      expect(mockCreateMessage).toHaveBeenCalledWith(
        'hut.org',
        expect.objectContaining({ to: ['email@example.com'] })
      );

      await service.sendBookingConfirmation({ to: 'to@example.com', name: 'Bob' });
      expect(mockCreateMessage).toHaveBeenCalledWith(
        'hut.org',
        expect.objectContaining({ to: ['to@example.com'] })
      );

      await service.sendBookingConfirmation({ recipient: 'recip@example.com' });
      expect(mockCreateMessage).toHaveBeenCalledWith(
        'hut.org',
        expect.objectContaining({ to: ['recip@example.com'] })
      );
    });

    it('should fallback sender (from) and name correctly when not provided', async () => {
      mockCreateMessage.mockResolvedValueOnce({ id: '<msg-id>' });
      const service = createEmailService({ apiKey: 'key', domain: 'hut.org' });

      await service.sendBookingConfirmation({ email: 'test@example.com' });

      expect(mockCreateMessage).toHaveBeenCalledWith(
        'hut.org',
        expect.objectContaining({
          from: 'Mailgun Sandbox <postmaster@hut.org>',
          to: ['test@example.com'],
        })
      );
    });

    it('should use custom from address if specified in service configuration', async () => {
      mockCreateMessage.mockResolvedValueOnce({ id: '<msg-id>' });
      const service = createEmailService({
        apiKey: 'key',
        domain: 'hut.org',
        from: 'Custom Sender <custom@hut.org>',
      });

      await service.sendBookingConfirmation('test@example.com', { name: 'Mario' });

      expect(mockCreateMessage).toHaveBeenCalledWith(
        'hut.org',
        expect.objectContaining({
          from: 'Custom Sender <custom@hut.org>',
        })
      );
    });
  });

  describe('MH-06 modification email & variables truncation', () => {
    it.each([
      [undefined, 'booking-modification'],
      ['custom-modification', 'custom-modification'],
    ])(
      'uses the dedicated modification template (%s) and updated fields',
      async (updatedTemplate, expectedTemplate) => {
        mockCreateMessage.mockResolvedValueOnce({ id: '<updated-message>' });
        const service = createEmailService({
          apiKey: 'key',
          domain: 'hut.org',
          updatedTemplate,
        });
        const fields = {
          name: 'Gaia',
          date: '2027-06-17',
          start_time: '13:00',
          end_time: '14:00',
          meal: 'lunch',
          guests: 4,
          split: false,
          booking_id: 42,
          party_requirements: [{ description: 'Peanut allergy', allergies: true }],
        };

        await expect(
          service.sendBookingEmail('updated', 'guest@example.com', fields)
        ).resolves.toEqual({ id: '<updated-message>' });
        expect(mockCreateMessage).toHaveBeenCalledTimes(1);
        expect(mockCreateMessage).toHaveBeenCalledWith(
          'hut.org',
          expect.objectContaining({
            to: ['guest@example.com'],
            subject: 'Booking modification confirmed',
            template: expectedTemplate,
            'h:X-Mailgun-Variables': JSON.stringify(fields),
          })
        );
      }
    );

    it('trims excess party_requirements when payload exceeds maxVariablesBytes', async () => {
      mockCreateMessage.mockResolvedValueOnce({ id: '<trimmed-msg>' });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const service = createEmailService({
        apiKey: 'key',
        domain: 'hut.org',
        maxVariablesBytes: 220,
      });

      await service.sendBookingEmail('created', 'guest@example.com', {
        booking_id: 77,
        party_requirements: [
          { description: 'First requirement item', allergies: false },
          { description: 'Second very long requirement item text', allergies: true },
          { description: 'Third very long requirement item text', allergies: true },
        ],
      });

      const sentPayload = mockCreateMessage.mock.calls[0][1];
      const parsedVars = JSON.parse(sentPayload['h:X-Mailgun-Variables']);
      expect(parsedVars.party_requirements_truncated).toBe(true);
      expect(parsedVars.party_requirements.length).toBeLessThan(3);
      expect(warnSpy).toHaveBeenCalledWith(
        'Mailgun variables trimmed for delivery',
        expect.objectContaining({ bookingId: 77 })
      );

      warnSpy.mockRestore();
    });
  });

  describe('Retry & Region Failover Branches', () => {
    it('retries transient errors (503 / network code) and stops immediately on non-transient 400', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const service = createEmailService({
        apiKey: 'key',
        domain: 'hut.org',
        retryDelaysMs: [0, 0],
      });

      const transientErr = Object.assign(new Error('Service Unavailable'), { status: 503 });
      mockCreateMessage
        .mockRejectedValueOnce(transientErr)
        .mockResolvedValueOnce({ id: '<recovered>' });

      const okRes = await service.sendBookingEmail('cancelled', 'user@example.com', {
        booking_id: 10,
      });
      expect(okRes).toEqual({ id: '<recovered>' });
      expect(mockCreateMessage).toHaveBeenCalledTimes(2);

      mockCreateMessage.mockReset();
      const nonTransientErr = Object.assign(new Error('Invalid recipient'), { status: 400 });
      mockCreateMessage.mockRejectedValueOnce(nonTransientErr);

      await expect(
        service.sendBookingConfirmation('bad@example.com', { name: 'Test' })
      ).rejects.toThrow('Invalid recipient');
      expect(mockCreateMessage).toHaveBeenCalledTimes(1);

      warnSpy.mockRestore();
      errSpy.mockRestore();
    });

    it('switches active region on 401/404 and logs when both regions fail', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const service = createEmailService({
        apiKey: 'key',
        domain: 'hut.org',
        retryDelaysMs: [0],
      });

      const notFoundInRegion0 = Object.assign(new Error('Domain not found'), { status: 404 });
      mockCreateMessage
        .mockRejectedValueOnce(notFoundInRegion0)
        .mockResolvedValueOnce({ id: '<eu-ok>' })
        .mockResolvedValueOnce({ id: '<eu-second>' });

      const first = await service.sendBookingEmail('created', 'a@example.com', { booking_id: 1 });
      expect(first).toEqual({ id: '<eu-ok>' });

      // Second call uses switched region directly on first attempt
      const second = await service.sendBookingEmail('created', 'b@example.com', { booking_id: 2 });
      expect(second).toEqual({ id: '<eu-second>' });
      expect(mockCreateMessage).toHaveBeenCalledTimes(3);

      // Both regions failing with 401
      const serviceFailBoth = createEmailService({
        apiKey: 'key',
        domain: 'hut.org',
        retryDelaysMs: [0],
      });
      const authErr = Object.assign(new Error('Unauthorized'), { status: 401 });
      mockCreateMessage.mockRejectedValue(authErr);

      await expect(
        serviceFailBoth.sendBookingEmail('created', 'c@example.com', { booking_id: 3 })
      ).rejects.toThrow('Unauthorized');
      expect(errSpy).toHaveBeenCalledWith(
        expect.stringContaining('Mailgun failed in both regions'),
        expect.objectContaining({ domain: 'hut.org', status: 401 })
      );

      warnSpy.mockRestore();
      errSpy.mockRestore();
    });
  });

  describe('verifyTemplates, sendPasswordReset & Config Factory', () => {
    it('verifies templates across responses and handles fetch errors', async () => {
      const disabled = createEmailService({});
      await expect(disabled.verifyTemplates()).resolves.toEqual({
        enabled: false,
        templates: [],
      });

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ template: { versions: [{ tag: 'active-v1', active: true }] } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ template: { versions: [{ tag: 'draft-v1', active: false }] } }),
        })
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ template: { versions: [{ tag: 'v2', active: true }] } }),
        });

      vi.stubGlobal('fetch', fetchMock);

      const service = createEmailService({ apiKey: 'key', domain: 'hut.org' });
      const res = await service.verifyTemplates();

      expect(res.enabled).toBe(true);
      expect(res.templates).toEqual([
        { name: 'booking-confirmation', ok: true, active: 'active-v1', status: 200 },
        { name: 'booking-modification', ok: false, active: null, status: 200 },
        {
          name: 'booking-cancelled',
          ok: false,
          active: null,
          status: null,
          error: 'Network error',
        },
        { name: 'password-reset', ok: true, active: 'v2', status: 200 },
      ]);
    });

    it('handles sendPasswordReset success, skip, error logging, and createEmailServiceFromConfig', async () => {
      const service = createEmailServiceFromConfig({
        mailgunApiKey: 'key',
        mailgunDomain: 'hut.org',
        mailgunFrom: 'Hut <noreply@hut.org>',
        mailgunTemplate: 't-conf',
        mailgunUpdatedTemplate: 't-upd',
        mailgunCancelledTemplate: 't-canc',
        mailgunResetTemplate: 't-reset',
        mailgunUrl: 'https://api.mailgun.net',
      });

      await expect(service.sendPasswordReset({ to: '' })).resolves.toEqual({ skipped: true });

      mockCreateMessage.mockResolvedValueOnce({ id: '<reset-msg>' });
      await expect(
        service.sendPasswordReset({
          to: 'hiker@example.com',
          name: 'Hiker',
          resetUrl: 'https://hut.test/reset',
          expiresInHours: 12,
        })
      ).resolves.toEqual({ id: '<reset-msg>' });

      expect(mockCreateMessage).toHaveBeenCalledWith(
        'hut.org',
        expect.objectContaining({
          template: 't-reset',
          'h:X-Mailgun-Variables': JSON.stringify({
            name: 'Hiker',
            reset_url: 'https://hut.test/reset',
            expires_in_hours: 12,
          }),
        })
      );

      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockCreateMessage.mockRejectedValueOnce(new Error('Reset failed'));
      await expect(
        service.sendPasswordReset({ to: 'hiker@example.com', resetUrl: 'https://hut.test/reset' })
      ).rejects.toThrow('Reset failed');
      expect(errSpy).toHaveBeenCalledWith(
        'Failed to send password reset email:',
        // Only provider metadata is logged, never the error body or recipient.
        { status: null, code: null }
      );
      errSpy.mockRestore();
    });
  });

  describe('Error Handling Branches (sendBookingConfirmation catch block)', () => {
    it('should catch error from Mailgun client, log it, and rethrow', async () => {
      const mailgunError = new Error('API Rate Limit Exceeded');
      mockCreateMessage.mockRejectedValueOnce(mailgunError);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const service = createEmailService({ apiKey: 'key', domain: 'hut.org' });

      await expect(
        service.sendBookingConfirmation('test@example.com', { name: 'Test' })
      ).rejects.toThrow('API Rate Limit Exceeded');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to send booking confirmation email:',
        mailgunError
      );

      consoleSpy.mockRestore();
    });
  });
});