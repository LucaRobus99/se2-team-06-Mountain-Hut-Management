import { Modal } from 'react-bootstrap';

export default function SplitSeatingModal({ show, seating, onCancel, onContinue, busy = false, staff = false }) {
  return (
    <Modal show={show} onHide={() => { if (!busy) onCancel(); }} centered scrollable backdrop="static" keyboard={!busy} aria-labelledby="split-seating-title" dialogClassName={`eh-split-modal eh-dialog${staff ? ' eh-split-modal--staff' : ''}`} backdropClassName="eh-cancel-backdrop">
      <Modal.Header closeButton={!busy}>
        <div><p className="eh-dialog-eyebrow">{staff ? 'Staff-assisted booking' : 'Your reservation'}</p><Modal.Title as="h2" id="split-seating-title">Seating Details</Modal.Title></div>
      </Modal.Header>
      <Modal.Body>
        {staff ? <p>No single table can accommodate the entire group. The guests will be seated across multiple tables.</p> : <p>There isn't one table large enough for everyone. <br></br> You'll be seated across multiple tables.</p>}
        {seating?.seatAssignments?.length > 1 && (
          <p className="eh-split-arrangement">Table split: {seating.seatAssignments.map(item => `${item.seats} ${item.seats === 1 ? 'guest' : 'guests'}`).join(' + ')}</p>
        )}
        {staff && <p className="eh-split-note sr-split-reminder"><strong>Inform the guest about the table split and confirm that they agree before continuing.</strong></p>}
        <p className="eh-split-note">{staff ? 'The seating arrangement will be checked again when the reservation is confirmed, as availability may change.' : 'The arrangement is checked again when you confirm your booking, as availability may change.'}</p>
      </Modal.Body>
      <Modal.Footer>
        <button type="button" className="eh-button eh-button--outline" onClick={onCancel} disabled={busy}>Choose another time</button>
        <button type="button" className="eh-button eh-button--green" onClick={onContinue} disabled={busy}>Continue with split seating</button>
      </Modal.Footer>
    </Modal>
  );
}
