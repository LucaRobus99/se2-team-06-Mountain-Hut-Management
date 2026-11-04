import { Modal } from 'react-bootstrap';

export default function SlotConfirmModal({ show, summary, onCancel, onConfirm, busy = false }) {
  const tables = summary?.tables || [];
  return (
    <Modal show={show} onHide={() => { if (!busy) onCancel(); }} centered scrollable backdrop="static" keyboard={!busy} aria-labelledby="slot-confirm-title" dialogClassName="staff-confirm-modal">
      <Modal.Header closeButton={!busy}>
        <Modal.Title id="slot-confirm-title">Confirm new slot</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="staff-confirm-intro">Check the details before creating this slot.</p>
        <dl className="staff-confirm-details">
          <div><dt>Service date</dt><dd>{summary?.date}</dd></div>
          <div><dt>Meal type</dt><dd>{summary?.meal}</dd></div>
          <div><dt>Time</dt><dd>{summary?.startTime}–{summary?.endTime}</dd></div>
          <div><dt>Capacity</dt><dd>{tables.length} {tables.length === 1 ? 'table' : 'tables'} · {summary?.seats} {summary?.seats === 1 ? 'seat' : 'seats'}</dd></div>
          {summary?.copiedFrom && <div><dt>Tables copied from</dt><dd>{summary.copiedFrom}</dd></div>}
        </dl>
        <div className="staff-slot-tables">
          {tables.length ? tables.map((table) => (
            <span key={table.tableIdentifier}>{table.tableIdentifier}: {table.seats}</span>
          )) : <em>No tables assigned · 0 seats available</em>}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button type="button" className="staff-outline-button" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="button" className="staff-primary-button" onClick={onConfirm} disabled={busy}>{busy ? 'Creating slot…' : 'Confirm'}</button>
      </Modal.Footer>
    </Modal>
  );
}
