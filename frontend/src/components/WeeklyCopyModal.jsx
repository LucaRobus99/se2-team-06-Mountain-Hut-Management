import { Alert, Modal, Spinner } from 'react-bootstrap';
import { weekRange } from '../utils/staffWeek.js';

export default function WeeklyCopyModal({ review, loading, busy, error, onCancel, onConfirm }) {
  const preview = review?.preview;
  return (
    <Modal show={Boolean(review)} onHide={() => { if (!busy) onCancel(); }} centered scrollable backdrop="static" keyboard={!busy} aria-labelledby="weekly-copy-title" dialogClassName="staff-confirm-modal eh-dialog" backdropClassName="eh-cancel-backdrop">
      <Modal.Header closeButton={!busy}>
        <div><p className="eh-dialog-eyebrow">Service planning</p><Modal.Title as="h2" id="weekly-copy-title">Confirm weekly schedule copy</Modal.Title></div>
      </Modal.Header>
      <Modal.Body>
        <p className="staff-confirm-intro">Review the schedule before confirming the copy.</p>
        {review && <div className="staff-week-selection staff-copy-weeks">
          <div className="staff-week-field staff-week-source"><span className="staff-week-step">SOURCE WEEK</span><strong>{weekRange(review.sourceWeekStart)}</strong></div>
          <span className="staff-week-direction" aria-hidden="true">→</span>
          <div className="staff-week-field staff-week-target"><span className="staff-week-step">DESTINATION WEEK</span><strong>{weekRange(review.targetWeekStart)}</strong></div>
        </div>}
        {loading && <p role="status"><Spinner animation="border" size="sm"/> Checking the destination week…</p>}
        {preview && <>
          <dl className="staff-confirm-details">
            <div><dt>Slots to copy</dt><dd>{preview.sourceCount}</dd></div>
            <div><dt>Days with services</dt><dd>{preview.sourceDays} / 7</dd></div>
            <div><dt>Existing destination slots</dt><dd>{preview.targetCount}</dd></div>
          </dl>
          {!error && (preview.targetCount > 0 ? <Alert variant="warning"><strong>Existing schedule will be replaced</strong><p className="mb-0">All {preview.targetCount} existing destination slots will be removed and replaced with the source schedule.</p></Alert> : <Alert variant="success"><strong>Destination week is empty</strong><p className="mb-0">The source schedule will be copied to the selected week.</p></Alert>)}
          <p className="staff-confirm-intro mb-0"> Only service times, meals and table configurations are copied. <br></br>Reservations and menus are not.</p>
        </>}
        {error && <Alert variant="danger" role="alert" className="mt-3 mb-0">{error}</Alert>}
      </Modal.Body>
      <Modal.Footer>
        <button type="button" className="staff-outline-button" onClick={onCancel} disabled={busy}>{error ? 'Close' : 'Cancel'}</button>
        <button type="button" className="staff-primary-button" onClick={onConfirm} disabled={loading || busy || !preview || Boolean(error)}>{busy ? 'Copying schedule…' : preview?.targetCount > 0 ? 'Replace and copy' : 'Copy weekly schedule'}</button>
      </Modal.Footer>
    </Modal>
  );
}
