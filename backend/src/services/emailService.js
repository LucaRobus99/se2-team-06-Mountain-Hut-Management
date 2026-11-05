import Mailgun from 'mailgun.js';
import FormData from 'form-data';

export function createEmailService({
  apiKey = null,
  domain = null,
  from = null,
  template = 'booking confirmation',
  url = null,
} = {}) {
  let client = null;
  if (apiKey && domain) {
    try {
      const mailgun = new Mailgun(FormData);
      client = mailgun.client({ username: 'api', key: apiKey, ...(url ? { url } : {}) });
    } catch (err) {
      console.error('Failed to initialise Mailgun client:', err);
      client = null;
    }
  }

  return {
    isEnabled() {
      return Boolean(client);
    },

    async sendBookingConfirmation(recipientOrData, fields = {}) {
      let to = null;
      let data = fields && typeof fields === 'object' ? { ...fields } : {};

      if (typeof recipientOrData === 'string') {
        to = recipientOrData;
      } else if (recipientOrData && typeof recipientOrData === 'object') {
        data = { ...recipientOrData, ...data };
        to = recipientOrData.to || recipientOrData.email || recipientOrData.recipient || null;
        delete data.to;
        delete data.email;
        delete data.recipient;
      }

      if (!client || !domain || !to) {
        return { skipped: true };
      }

      const variables = {
        name: data.name ?? null,
        date: data.date ?? null,
        start_time: data.start_time ?? null,
        end_time: data.end_time ?? null,
        meal: data.meal ?? null,
        guests: data.guests ?? null,
        split: data.split ?? null,
        booking_id: data.booking_id ?? null,
        // MH-05 is not implemented yet. The template hides this field when absent.
        party_requirements: data.party_requirements ?? null,
      };

      const senderName = (typeof data.name === 'string' && data.name.trim()) || 'Guest';
      const messageData = {
        from: from || `Mailgun Sandbox <postmaster@${domain}>`,
        to: [`${senderName} <${to}>`],
        subject: 'Booking confirmation',
        template,
        'h:X-Mailgun-Variables': JSON.stringify(variables),
      };

      try {
        const result = await client.messages.create(domain, messageData);
        return result;
      } catch (err) {
        console.error('Failed to send booking confirmation email:', err);
        throw err;
      }
    },
  };
}
