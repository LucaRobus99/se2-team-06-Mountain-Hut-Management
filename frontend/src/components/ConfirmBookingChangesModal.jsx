import { Modal } from 'react-bootstrap';
import { readableBookingDate, readableMeal } from '../utils/bookingList.js';

const timeLabel = slot => `${String(slot.startTime).slice(0, 5)}–${String(slot.endTime).slice(0, 5)}`;
const guestLabel = count => `${count} ${count === 1 ? 'guest' : 'guests'}`;

function requirementsLabel(requirements) {
  if (!requirements.length) return 'No dietary requirements';
  const allergies = requirements.filter(item => item.allergies).length;
  const entries = `${requirements.length} ${requirements.length === 1 ? 'requirement' : 'requirements'}`;
  return allergies ? `${entries}, ${allergies} with an allergy` : entries;
}

/**
 * MH-06: last check before a booking change is sent. Shows the current booking
 * next to what it will become; nothing changes until the hiker confirms.
 */
export default function ConfirmBookingChangesModal({ show, booking, next, onCancel, onConfirm, busy = false }) {
  if (!booking || !next) return null;
  const requirementsChanged = Boolean(next.requirementsChanged);
  return (
    <Modal show={show} onHide={() => { if (!busy) onCancel(); }} centered scrollable backdrop="static" keyboard={!busy}
      aria-labelledby="confirm-changes-title" aria-describedby="confirm-changes-description"
      dialogClassName="eh-split-modal eh-dialog eh-confirm-changes-modal" backdropClassName="eh-cancel-backdrop">
      <Modal.Header closeButton={!busy}>
        <div><p className="eh-dialog-eyebrow">Booking #{booking.id}</p><Modal.Title as="h2" id="confirm-changes-title">Save these changes?</Modal.Title></div>
      </Modal.Header>
      <Modal.Body>
        <p id="confirm-changes-description">Please check your updated booking before saving.</p>
        <dl className="eh-confirm-changes-summary">
          <div>
            <dt>Current</dt>
            <dd>{readableBookingDate(booking.slot.date)} · {readableMeal(booking.slot.meal)} · {timeLabel(booking.slot)} · {guestLabel(booking.partySize)}</dd>
          </div>
          <div className="is-new">
            <dt>New</dt>
            <dd>{readableBookingDate(next.slot.date)} · {readableMeal(next.slot.meal)} · {timeLabel(next.slot)} · {guestLabel(next.partySize)}</dd>
          </div>
          {requirementsChanged && <div className="is-new">
            <dt>Dietary requirements</dt>
            <dd>{requirementsLabel(next.requirements)}</dd>
          </div>}
        </dl>
        {next.split && <p className="eh-split-note">You will be seated across multiple tables.</p>}
        <p className="eh-split-note">Seats are checked again when you save, as availability may change. You will receive an email with the updated booking.</p>
      </Modal.Body>
      <Modal.Footer>
        <button type="button" className="eh-button eh-button--outline" onClick={onCancel} disabled={busy}>Keep editing</button>
        <button type="button" className="eh-button eh-button--green" onClick={onConfirm} disabled={busy}>{busy ? 'Saving…' : 'Confirm changes'}</button>
      </Modal.Footer>
    </Modal>
  );
}
