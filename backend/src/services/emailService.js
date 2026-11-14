import Mailgun from 'mailgun.js';
import FormData from 'form-data';

export function createEmailService({
  apiKey = null,
  domain = null,
  from = null,
  template = 'booking confirmation',
  resetTemplate = 'password reset',
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

  /**
   * Shared delivery helper. Returns `{ skipped: true }` when Mailgun is not
   * configured, so callers can treat email as best-effort (MH-03 pattern).
   * Secrets (initial password, reset link) are never logged here.
   */
  async function deliver({ to, subject, templateName, variables, senderName = 'Guest' }) {
    if (!client || !domain || !to) {
      return { skipped: true };
    }

    const messageData = {
      from: from || `Mailgun Sandbox <postmaster@${domain}>`,
      to: [`${senderName} <${to}>`],
      subject,
      template: templateName,
      'h:X-Mailgun-Variables': JSON.stringify(variables),
    };

    const result = await client.messages.create(domain, messageData);
    return result;
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

    /**
     * MH-07 / #44: send a single-use password reset link (valid for 24 hours).
     */
    async sendPasswordReset({ to, name, resetUrl, expiresInHours = 24 } = {}) {
      if (!to) return { skipped: true };
      try {
        return await deliver({
          to,
          subject: 'Reset your Edelweiss Hut password',
          templateName: resetTemplate,
          senderName: name || 'Guest',
          variables: {
            name: name ?? null,
            reset_url: resetUrl ?? null,
            expires_in_hours: expiresInHours,
          },
        });
      } catch (err) {
        console.error('Failed to send password reset email:', err);
        throw err;
      }
    },
  };
}
