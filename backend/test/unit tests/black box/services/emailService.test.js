import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createEmailService,
  createEmailServiceFromConfig,
} from '../../../../src/services/emailService.js';

const mockCreateFn = vi.fn();

vi.mock('mailgun.js', () => {
  return {
    default: class MockMailgun {
      client() {
        return {
          messages: {
            create: (...args) => mockCreateFn(...args),
          },
        };
      }
    },
  };
});

describe('emailService - Black-Box Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateFn.mockResolvedValue({ id: 'msg-default', message: 'Queued. Thank you.' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('isEnabled', () => {
    it('should return false if apiKey or domain are missing', () => {
      const serviceNoKey = createEmailService({ apiKey: null, domain: 'example.com' });
      const serviceNoDomain = createEmailService({ apiKey: 'key-123', domain: null });
      const serviceEmpty = createEmailService({});

      expect(serviceNoKey.isEnabled()).toBe(false);
      expect(serviceNoDomain.isEnabled()).toBe(false);
      expect(serviceEmpty.isEnabled()).toBe(false);
    });

    it('should return true if both apiKey and domain are provided', () => {
      const service = createEmailService({ apiKey: 'key-123', domain: 'example.com' });
      expect(service.isEnabled()).toBe(true);
    });
  });

  describe('sendBookingConfirmation', () => {
    it('should skip sending and return { skipped: true } if service is disabled (missing client or domain)', async () => {
      const service = createEmailService({ apiKey: null, domain: null });
      const result = await service.sendBookingConfirmation('test@example.com', { name: 'Mario' });

      expect(result).toEqual({ skipped: true });
      expect(mockCreateFn).not.toHaveBeenCalled();
    });

    it('should skip sending if recipient email (to) cannot be resolved', async () => {
      const service = createEmailService({ apiKey: 'key-123', domain: 'example.com' });

      const result = await service.sendBookingConfirmation({ name: 'Mario' });

      expect(result).toEqual({ skipped: true });
      expect(mockCreateFn).not.toHaveBeenCalled();
    });

    it('should successfully send confirmation when recipient is passed as a string', async () => {
      const service = createEmailService({
        apiKey: 'key-123',
        domain: 'example.com',
        from: 'Custom <from@hut.com>',
      });

      const result = await service.sendBookingConfirmation('mario@example.com', {
        name: 'Mario Rossi',
        date: '2026-08-14',
        start_time: '14:00',
        end_time: '16:00',
        meal: 'lunch',
        guests: 2,
        split: false,
        booking_id: 100,
      });

      expect(result).toEqual({ id: 'msg-default', message: 'Queued. Thank you.' });
      expect(mockCreateFn).toHaveBeenCalledTimes(1);
    });

    it('should successfully parse recipient and fields when passed as a single object', async () => {
      const service = createEmailService({ apiKey: 'key-123', domain: 'example.com' });

      const payload = {
        email: 'guest@example.com',
        name: 'Luigi Verdi',
        date: '2026-08-15',
        start_time: '12:00',
        end_time: '13:00',
        meal: 'lunch',
        guests: 4,
        split: true,
        booking_id: 102,
      };

      const result = await service.sendBookingConfirmation(payload);
      expect(result).toEqual({ id: 'msg-default', message: 'Queued. Thank you.' });
    });

    it('should propagate permanent Mailgun errors (4xx) without hanging', async () => {
      const permError = Object.assign(new Error('Bad Request'), { status: 400 });
      mockCreateFn.mockRejectedValueOnce(permError);

      const service = createEmailService({
        apiKey: 'key-123',
        domain: 'example.com',
        retryDelaysMs: [0],
      });

      await expect(
        service.sendBookingConfirmation('test@example.com', { name: 'Test' })
      ).rejects.toThrow('Bad Request');
    });
  });

  describe('sendBookingEmail (All Kinds, Requirements & Errors)', () => {
    it('should successfully send updated (modification) and cancelled booking emails', async () => {
      const service = createEmailService({ apiKey: 'key-123', domain: 'example.com' });

      const updatedRes = await service.sendBookingEmail('updated', 'mario@example.com', {
        name: 'Mario',
        booking_id: 100,
      });
      expect(updatedRes).toBeDefined();

      const cancelledRes = await service.sendBookingEmail('cancelled', 'mario@example.com', {
        name: 'Mario',
        booking_id: 100,
      });
      expect(cancelledRes).toBeDefined();
    });

    it('should handle large party_requirements payloads without failing delivery', async () => {
      const service = createEmailService({
        apiKey: 'key-123',
        domain: 'example.com',
        maxVariablesBytes: 250,
      });

      const largeRequirements = Array.from({ length: 15 }, (_, idx) => ({
        description: `Requirement note ${idx} - ${'x'.repeat(40)}`,
        allergies: idx % 2 === 0,
      }));

      const res = await service.sendBookingEmail('created', 'mario@example.com', {
        name: 'Mario',
        booking_id: 105,
        party_requirements: largeRequirements,
      });

      expect(res).toBeDefined();
      expect(mockCreateFn).toHaveBeenCalledTimes(1);
    });

    it('should throw an Error when an unknown booking email kind is requested', async () => {
      const service = createEmailService({ apiKey: 'key-123', domain: 'example.com' });

      await expect(
        service.sendBookingEmail('unknown_kind', 'test@example.com', {})
      ).rejects.toThrow('Unknown booking email: unknown_kind');
    });
  });

  describe('sendPasswordReset', () => {
    it('should skip sending and return { skipped: true } if recipient (to) is missing', async () => {
      const service = createEmailService({ apiKey: 'key-123', domain: 'example.com' });
      const result = await service.sendPasswordReset({
        to: null,
        name: 'Mario',
        resetUrl: 'http://link',
      });

      expect(result).toEqual({ skipped: true });
    });

    it('should successfully send password reset email when valid parameters are provided', async () => {
      const service = createEmailService({ apiKey: 'key-123', domain: 'example.com' });
      const result = await service.sendPasswordReset({
        to: 'mario@example.com',
        name: 'Mario Rossi',
        resetUrl: 'https://hut.test/reset?token=abc',
        expiresInHours: 24,
      });

      expect(result).toBeDefined();
    });
  });

  describe('verifyTemplates & Config Factory', () => {
    it('should return disabled status when service is not configured', async () => {
      const service = createEmailService({});
      await expect(service.verifyTemplates()).resolves.toEqual({
        enabled: false,
        templates: [],
      });
    });

    it('should report template verification results when enabled', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            template: { versions: [{ tag: 'v1', active: true }] },
          }),
        })
      );

      const service = createEmailServiceFromConfig({
        mailgunApiKey: 'key-123',
        mailgunDomain: 'hut.test',
        mailgunFrom: 'Hut <noreply@hut.test>',
        mailgunTemplate: 'booking-confirmation',
        mailgunUpdatedTemplate: 'booking-modification',
        mailgunCancelledTemplate: 'booking-cancelled',
        mailgunResetTemplate: 'password reset',
        mailgunUrl: 'https://api.mailgun.net',
      });

      const status = await service.verifyTemplates();
      expect(status.enabled).toBe(true);
      expect(status.templates).toHaveLength(4);
      expect(status.templates.every((t) => t.ok && t.active === 'v1')).toBe(true);
    });
  });

  describe('Client Custom URL Configuration', () => {
    it('should initialize successfully when a custom url option is provided', () => {
      const service = createEmailService({
        apiKey: 'key-123',
        domain: 'example.com',
        url: 'https://api.eu.mailgun.net',
      });

      expect(service.isEnabled()).toBe(true);
    });
  });
});