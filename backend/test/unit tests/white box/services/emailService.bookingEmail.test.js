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

// sendBookingEmail: one entry point for MH-03, MH-06 and MH-08 booking emails.
describe('emailService.sendBookingEmail - White-Box Tests', () => {
  const fields = {
    name: 'Mario',
    date: '2026-08-20',
    start_time: '12:00',
    end_time: '13:00',
    meal: 'lunch',
    guests: 3,
    split: false,
    booking_id: 100,
    party_requirements: [{ description: 'peanut allergy', allergies: true }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateMessage.mockResolvedValue({ id: '<msg>' });
  });

  const sentMessage = () => mockCreateMessage.mock.calls[0][1];

  it.each([
    ['created', 'Booking confirmation', 'booking-confirmation'],
    ['updated', 'Booking modification confirmed', 'booking-modification'],
    ['cancelled', 'Booking cancelled', 'booking-cancelled'],
  ])('uses the subject and template of the "%s" email', async (kind, subject, template) => {
    const service = createEmailService({ apiKey: 'key', domain: 'hut.org' });
    await service.sendBookingEmail(kind, 'm@example.com', fields);
    expect(sentMessage()).toMatchObject({ subject, template, to: ['m@example.com'] });
  });

  it('the legacy sendBookingConfirmation wrapper uses the confirmation template', async () => {
    const service = createEmailService({ apiKey: 'key', domain: 'hut.org' });
    await service.sendBookingConfirmation('m@example.com', fields);
    expect(sentMessage()).toMatchObject({ subject: 'Booking confirmation', template: 'booking-confirmation' });
  });

  it('uses the configured updated and cancelled templates', async () => {
    const service = createEmailService({
      apiKey: 'key', domain: 'hut.org', updatedTemplate: 'booking updated', cancelledTemplate: 'bye',
    });
    await service.sendBookingEmail('updated', 'm@example.com', fields);
    await service.sendBookingEmail('cancelled', 'm@example.com', fields);
    expect(mockCreateMessage.mock.calls.map(([, m]) => m.template)).toEqual(['booking updated', 'bye']);
  });

  it('sends the party requirements as a template variable', async () => {
    const service = createEmailService({ apiKey: 'key', domain: 'hut.org' });
    await service.sendBookingEmail('created', 'm@example.com', fields);
    expect(JSON.parse(sentMessage()['h:X-Mailgun-Variables']).party_requirements)
      .toEqual([{ description: 'peanut allergy', allergies: true }]);
  });

  it('skips without a recipient or without Mailgun', async () => {
    await expect(createEmailService({ apiKey: 'key', domain: 'hut.org' }).sendBookingEmail('created', null, fields))
      .resolves.toEqual({ skipped: true });
    await expect(createEmailService({}).sendBookingEmail('created', 'm@example.com', fields))
      .resolves.toEqual({ skipped: true });
    expect(mockCreateMessage).not.toHaveBeenCalled();
  });

  it('rejects an unknown kind instead of sending the wrong email', async () => {
    const service = createEmailService({ apiKey: 'key', domain: 'hut.org' });
    await expect(service.sendBookingEmail('deleted', 'm@example.com', fields)).rejects.toThrow('Unknown booking email');
  });
});
