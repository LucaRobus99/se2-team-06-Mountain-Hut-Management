import Mailgun from 'mailgun.js';
import FormData from 'form-data';

export function createEmailService({
  apiKey = null,
  domain = null,
  from = null,
  template = 'booking-confirmation',
  // MH-06 (#41): dedicated template for a hiker's booking change.
  updatedTemplate = 'booking-modification',
  // MH-08 (#41): cancellation notice.
  cancelledTemplate = 'booking-cancelled',
  resetTemplate = 'password reset',
  url = null,
  // Retry only transient failures (network, 429, 5xx). Permanent 4xx errors
  // (invalid recipient, missing template, ...) fail immediately.
  retryDelaysMs = [0, 1000, 3000],
  // Mailgun counts o:/h:/v:/t: options together and rejects more than 16KB.
  // Keep a safety margin and trim only the email copy of requirements.
  maxVariablesBytes = 12000,
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

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /** Only errors that can succeed on a later attempt should be retried. */
  function isTransient(err) {
    const status = Number(err?.status ?? err?.statusCode);
    if (status === 429 || (status >= 500 && status <= 599)) return true;
    const networkCodes = [
      'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND',
      'UND_ERR_SOCKET', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT',
      'UND_ERR_BODY_TIMEOUT',
    ];
    if (networkCodes.includes(err?.code)) return true;
    return err?.name === 'AbortError' || err?.name === 'TimeoutError';
  }

  /**
   * Keep the Mailgun options payload below the documented 16KB limit. The
   * booking keeps every requirement; only the email copy drops the tail (and
   * says so through `party_requirements_truncated`).
   */
  function variablesHeader(variables) {
    const payload = { ...variables };
    let json = JSON.stringify(payload);
    let size = Buffer.byteLength(json, 'utf8');
    const originalSize = size;

    if (Array.isArray(payload.party_requirements)) {
      const list = [...payload.party_requirements];
      while (size > maxVariablesBytes && list.length > 0) {
        list.pop();
        payload.party_requirements = list;
        payload.party_requirements_truncated = true;
        json = JSON.stringify(payload);
        size = Buffer.byteLength(json, 'utf8');
      }
      if (size > maxVariablesBytes) {
        payload.party_requirements = null;
        json = JSON.stringify(payload);
        size = Buffer.byteLength(json, 'utf8');
      }
    }

    if (payload.party_requirements_truncated) {
      console.warn('Mailgun variables trimmed for delivery', {
        bookingId: payload.booking_id ?? null,
        originalSize,
        size,
        limit: maxVariablesBytes,
      });
    }
    return json;
  }

  async function createMessage(messageData, label) {
    let lastError;
    for (let attempt = 0; attempt < retryDelaysMs.length; attempt += 1) {
      if (attempt > 0) await sleep(retryDelaysMs[attempt]);
      try {
        return await client.messages.create(domain, messageData);
      } catch (err) {
        lastError = err;
        const hasAnotherAttempt = attempt < retryDelaysMs.length - 1;
        if (!isTransient(err) || !hasAnotherAttempt) break;
        console.warn(`Mailgun ${label} attempt ${attempt + 1} failed; retrying`, {
          status: err?.status ?? null,
          code: err?.code ?? null,
          message: err?.message,
          delayMs: retryDelaysMs[attempt + 1],
        });
      }
    }
    throw lastError;
  }

  async function deliver({ to, subject, templateName, variables }) {
    if (!client || !domain || !to) {
      return { skipped: true };
    }

    const messageData = {
      from: from || `Mailgun Sandbox <postmaster@${domain}>`,
      // Send the bare address: a user-controlled display name with commas or
      // angle brackets can make the header invalid and drop the message.
      to: [to],
      subject,
      template: templateName,
      // Ask Mailgun to generate a text/plain alternative from the template:
      // better accessibility and a lower spam score.
      't:text': 'yes',
      'h:X-Mailgun-Variables': variablesHeader(variables),
    };

    return createMessage(messageData, templateName);
  }

  /**
   * Subject and Mailgun template of each booking email (see bookingNotifier.js).
   * Each kind has its own template: email-templates/booking-confirmation.html,
   * booking-modification.html and booking-cancelled.html.
   */
  const bookingEmails = {
    created: { subject: 'Booking confirmation', template },
    updated: { subject: 'Booking modification confirmed', template: updatedTemplate },
    cancelled: { subject: 'Booking cancelled', template: cancelledTemplate },
  };

  /**
   * MH-03 / MH-06 / MH-08: one entry point for every booking email.
   * `fields` are the variables built by bookingEmailFields().
   */
  async function sendBookingEmail(kind, to, fields = {}) {
    const email = bookingEmails[kind];
    if (!email) throw new Error(`Unknown booking email: ${kind}`);

    const data = fields && typeof fields === 'object' ? fields : {};
    return deliver({
      to,
      subject: email.subject,
      templateName: email.template,
      variables: {
        name: data.name ?? null,
        date: data.date ?? null,
        start_time: data.start_time ?? null,
        end_time: data.end_time ?? null,
        meal: data.meal ?? null,
        guests: data.guests ?? null,
        split: data.split ?? null,
        booking_id: data.booking_id ?? null,
        // MH-05: [{ description, allergies }]. The template hides this field when absent.
        party_requirements: data.party_requirements ?? null,
      },
    });
  }

  return {
    isEnabled() {
      return Boolean(client);
    },

    /**
     * Startup check: every configured template must exist on the Mailgun domain
     * with an active version. Runs through the read-only templates API, so it
     * works without dashboard access. Never throws: returns per-template state.
     */
    async verifyTemplates() {
      if (!client || !domain) return { enabled: false, templates: [] };

      const base = (url && String(url).trim()) || 'https://api.mailgun.net';
      const authorization = 'Basic ' + Buffer.from(`api:${apiKey}`).toString('base64');
      const names = [...new Set([template, updatedTemplate, cancelledTemplate, resetTemplate])];
      const templates = [];

      for (const name of names) {
        try {
          const response = await fetch(
            `${base}/v3/${encodeURIComponent(domain)}/templates/${encodeURIComponent(name)}/versions`,
            { headers: { Authorization: authorization } }
          );
          const body = await response.json().catch(() => null);
          const active = body?.template?.versions?.find((version) => version.active);
          templates.push({
            name,
            ok: response.ok && Boolean(active),
            active: active?.tag ?? null,
            status: response.status,
          });
        } catch (err) {
          templates.push({ name, ok: false, active: null, status: null, error: err.message });
        }
      }

      return { enabled: true, templates };
    },

    /** MH-03: kept for existing callers; same as sendBookingEmail('created', …). */
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

      try {
        return await sendBookingEmail('created', to, data);
      } catch (err) {
        console.error('Failed to send booking confirmation email:', err);
        throw err;
      }
    },

    sendBookingEmail,

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
          variables: {
            name: name ?? null,
            reset_url: resetUrl ?? null,
            expires_in_hours: expiresInHours,
          },
        });
      } catch (err) {
        // Provider errors can contain the request, including the reset token.
        console.error('Failed to send password reset email:', {
          status: err?.status ?? err?.statusCode ?? null,
          code: err?.code ?? null,
        });
        throw err;
      }
    },
  };
}

/** Build the email service from the app config (shared by app.js and server.js). */
export function createEmailServiceFromConfig(config) {
  return createEmailService({
    apiKey: config.mailgunApiKey,
    domain: config.mailgunDomain,
    from: config.mailgunFrom,
    template: config.mailgunTemplate,
    updatedTemplate: config.mailgunUpdatedTemplate,
    cancelledTemplate: config.mailgunCancelledTemplate,
    resetTemplate: config.mailgunResetTemplate,
    url: config.mailgunUrl,
  });
}

