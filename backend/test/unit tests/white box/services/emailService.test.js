import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEmailService } from '../../../../src/services/emailService.js';

// Mock mailgun.js to allow testing both successful client creation and error catching
const mockCreateMessage = vi.fn();
let shouldThrowOnClientInit = false;

vi.mock('mailgun.js', () => {
  return {
    default: class MockMailgun {
      constructor() {
        if (shouldThrowOnClientInit) {
          throw new Error('Mailgun initialization failed');
        }
      }
      client() {
        return {
          messages: {
            create: mockCreateMessage,
          },
        };
      }
    },
  };
});

describe('emailService - White-Box Tests', () => {
  
  beforeEach(() => {
    vi.clearAllMocks();
    shouldThrowOnClientInit = false;
  });

  describe('Client Initialization Branches', () => {
    
    it('should not initialize client if apiKey or domain are missing', () => {
      const service = createEmailService({ apiKey: null, domain: null });
      expect(service.isEnabled()).toBe(false);
    });

    it('should successfully initialize client when apiKey and domain are provided', () => {
      const service = createEmailService({ apiKey: 'test-key', domain: 'test.org' });
      expect(service.isEnabled()).toBe(true);
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

    it('should include custom url if provided during client initialization', () => {
      // White-box check: passing url option doesn't crash initialization
      const service = createEmailService({ 
        apiKey: 'test-key', 
        domain: 'test.org', 
        url: 'https://api.eu.mailgun.net' 
      });
      expect(service.isEnabled()).toBe(true);
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
          to: ['John <user@example.com>'],
          template: 'booking confirmation',
        })
      );
    });

    it('should resolve recipient from object properties (to, email, or recipient)', async () => {
      mockCreateMessage.mockResolvedValue({ id: '<msg-id>' });
      const service = createEmailService({ apiKey: 'key', domain: 'hut.org' });

      // Case 1: object with 'email'
      await service.sendBookingConfirmation({ email: 'email@example.com', name: 'Alice' });
      expect(mockCreateMessage).toHaveBeenCalledWith(
        'hut.org',
        expect.objectContaining({ to: ['Alice <email@example.com>'] })
      );

      // Case 2: object with 'to'
      await service.sendBookingConfirmation({ to: 'to@example.com', name: 'Bob' });
      expect(mockCreateMessage).toHaveBeenCalledWith(
        'hut.org',
        expect.objectContaining({ to: ['Bob <to@example.com>'] })
      );

      // Case 3: object with 'recipient'
      await service.sendBookingConfirmation({ recipient: 'recip@example.com' });
      expect(mockCreateMessage).toHaveBeenCalledWith(
        'hut.org',
        expect.objectContaining({ to: ['Guest <recip@example.com>'] }) // Default name fallback to 'Guest'
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
          to: ['Guest <test@example.com>'],
        })
      );
    });

    it('should use custom from address if specified in service configuration', async () => {
      mockCreateMessage.mockResolvedValueOnce({ id: '<msg-id>' });
      const service = createEmailService({ 
        apiKey: 'key', 
        domain: 'hut.org', 
        from: 'Custom Sender <custom@hut.org>' 
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