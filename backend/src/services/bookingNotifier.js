/**
 * Booking emails (MH-03 confirmation, MH-06 change, MH-08 cancellation, #41).
 *
 * Email is best effort: a delivery failure is logged and reported in the
 * response (`{ status: 'failed' }`), but never undoes the booking change that
 * was already committed.
 */

export const BOOKING_EMAIL_KINDS = ['created', 'updated', 'cancelled'];

/** Template variables shared by every booking email. */
export function bookingEmailFields(view, fallbackName = null) {
  return {
    name: view.contactName ?? fallbackName ?? null,
    date: view.slot.date,
    start_time: view.slot.startTime,
    end_time: view.slot.endTime,
    meal: view.slot.meal,
    guests: view.partySize,
    split: view.split,
    booking_id: view.id,
    party_requirements: view.requirements,
  };
}

export function createBookingNotifier(emailService) {
  return {
    /**
     * @param {'created'|'updated'|'cancelled'} kind
     * @param {object} view       booking in API shape (toBookingResponse)
     * @param {string|null} recipient  no recipient → skipped
     * @returns {Promise<{status: 'sent'|'skipped'|'failed'}>}
     */
    async notify(kind, view, recipient, { fallbackName = null } = {}) {
      if (typeof emailService?.sendBookingEmail !== 'function') {
        return { status: 'skipped' };
      }

      try {
        const delivery = await emailService.sendBookingEmail(
          kind,
          recipient,
          bookingEmailFields(view, fallbackName)
        );
        return { status: delivery?.skipped ? 'skipped' : 'sent' };
      } catch (err) {
        // Structured diagnostics without logging the full address (privacy).
        const recipientDomain = typeof recipient === 'string' && recipient.includes('@')
          ? recipient.split('@')[1]
          : null;
        console.error(`Failed to send booking ${kind} email:`, {
          bookingId: view?.id ?? null,
          recipientDomain,
          status: err?.status ?? err?.statusCode ?? null,
          code: err?.code ?? null,
          message: err?.message,
        });
        return { status: 'failed' };
      }
    },
  };
}
