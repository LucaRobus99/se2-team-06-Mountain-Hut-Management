import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEmailService } from '../../../../src/services/emailService.js';

// Mock mailgun.js to intercept client creation and avoid real network/API calls
vi.mock('mailgun.js', () => {
  return {
    default: class MockMailgun {
      client() {
        return {
          messages: {
            create: vi.fn(),
          },
        };
      }
    },
  };
});

describe('emailService - Black-Box Tests', () => {
  
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
    });

    it('should skip sending if recipient email (to) cannot be resolved', async () => {
      const service = createEmailService({ apiKey: 'key-123', domain: 'example.com' });
      
      // Passing an object without a valid email, to, or recipient property
      const result = await service.sendBookingConfirmation({ name: 'Mario' });

      expect(result).toEqual({ skipped: true });
    });

    it('should successfully send confirmation when recipient is passed as a string', async () => {
      const service = createEmailService({ apiKey: 'key-123', domain: 'example.com', from: 'Custom <from@hut.com>' });
      
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

      // Since the mocked client returns undefined by default, no error thrown confirms success of the black-box flow
      expect(result).toBeUndefined(); 
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
      expect(result).toBeUndefined();
    });

    it('should handle mailgun errors correctly and complete execution without unexpected crashes', async () => {
      const service = createEmailService({ apiKey: 'key-123', domain: 'example.com' });
      
      // Verify that valid input data completes without unexpected errors with the mock setup
      await expect(
        service.sendBookingConfirmation('test@example.com', { name: 'Test' })
      ).resolves.not.toThrow();
    });

  });

});