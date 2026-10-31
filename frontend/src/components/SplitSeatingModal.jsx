import { Modal } from 'react-bootstrap';

export default function SplitSeatingModal({ show, seating, onCancel, onContinue, busy = false }) {
  return (
    <Modal show={show} onHide={onCancel} centered backdrop="static" keyboard={!busy} aria-labelledby="split-seating-title" dialogClassName="eh-split-modal">
      <Modal.Header closeButton={!busy}>
        <Modal.Title id="split-seating-title">Seating Details</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>There isn't one table large enough for everyone. You'll be seated across multiple tables.</p>
        {seating?.seatAssignments?.length > 1 && (
          <p className="eh-split-arrangement">Table split: {seating.seatAssignments.map(item => `${item.seats} ${item.seats === 1 ? 'guest' : 'guests'}`).join(' + ')}</p>
        )}
        <p className="eh-split-note">The arrangement is checked again when you confirm your booking, as availability may change.</p>
      </Modal.Body>
      <Modal.Footer>
        <button type="button" className="eh-button eh-button--outline" onClick={onCancel} disabled={busy}>Choose another time</button>
        <button type="button" className="eh-button eh-button--green" onClick={onContinue} disabled={busy}>Continue with split seating</button>
      </Modal.Footer>
    </Modal>
  );
}
