import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Modal } from 'react-bootstrap';
import { getMyBookings, getBooking, cancelBooking, bookingErrorMessage } from '../api/booking.js';
import { bookingSummary, readableBookingDate, readableMeal } from '../utils/bookingList.js';
import { canModifyBooking } from '../utils/editBooking.js';
import EditBookingForm from '../components/EditBookingForm.jsx';
import DietaryRequirementsSummary from '../components/DietaryRequirementsSummary.jsx';
import heroImage from '../assets/edelweiss-my-bookings.jpg';
import '../styles/account-bookings.css';
import '../styles/edit-booking.css';

const FILTERS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
  { id: 'cancelled', label: 'Cancelled' },
];
const EMPTY_TEXT = {
  upcoming: 'You have no upcoming table bookings.',
  past: 'Your previous reservations will appear here.',
  cancelled: 'You have no cancelled bookings.',
};
const timeLabel = booking => `${String(booking.slot.startTime).slice(0, 5)}${booking.slot.endTime ? `–${String(booking.slot.endTime).slice(0, 5)}` : ''}`;

export default function MyBookingsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [receiptUnavailable, setReceiptUnavailable] = useState(Boolean(location.state?.receiptUnavailable));
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState(() => {
    const initial = new URLSearchParams(location.search).get('tab');
    return FILTERS.some(option => option.id === initial) ? initial : 'upcoming';
  });
  const [selectedId, setSelectedId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [noticeTone, setNoticeTone] = useState('success');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const cancellingRef = useRef(false);
  const [reload, setReload] = useState(0);
  const gridRef = useRef(null);
  const editRequestRef = useRef(0);
  const loadBookings = useCallback(() => setReload(value => value + 1), []);

  useEffect(() => {
    if (!location.state?.receiptUnavailable) return;
    setReceiptUnavailable(true);
    navigate(location.pathname + location.search, { replace: true, state: null });
  }, [location.state, location.pathname, location.search, navigate]);

  useEffect(() => {
    const tab = new URLSearchParams(location.search).get('tab');
    if (FILTERS.some(option => option.id === tab)) setFilter(tab);
  }, [location.search]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getMyBookings().then(list => { if (active) setBookings(list); }).catch(err => {
      if (active) setError(err.status === 404 || err.status === 405
        ? 'Your bookings are not available yet. The booking history service has not been enabled.'
        : err.message || 'Unable to load your bookings.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);

  const groups = useMemo(() => bookingSummary(bookings), [bookings]);
  const shownFilter = editing ? 'upcoming' : filter;
  const visible = groups[shownFilter];
  // Never auto-open the first booking: the user controls the disclosure arrow.
  const selected = visible.find(booking => booking.id === selectedId) || null;

  function focusPanelOnSmallScreens() {
    if (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 920px)').matches) {
      window.requestAnimationFrame(() => gridRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));
    }
  }

  function selectFilter(next) {
    if (cancellingRef.current) return;
    setConfirmCancel(false);
    setCancelError('');
    setEditLoading(false);
    editRequestRef.current += 1;
    setFilter(next);
    setSelectedId(null);
    setEditing(false);
    setEditingBooking(null);
    setNotice('');
  }
  function closePanel() {
    if (cancellingRef.current) return;
    setConfirmCancel(false);
    setCancelError('');
    editRequestRef.current += 1;
    setEditLoading(false);
    setSelectedId(null);
    setEditing(false);
    setEditingBooking(null);
    setNotice('');
    focusPanelOnSmallScreens();
  }
  function toggleBooking(bookingId) {
    if (cancellingRef.current) return;
    setConfirmCancel(false);
    setCancelError('');
    if (bookingId === selectedId) { closePanel(); return; }
    editRequestRef.current += 1;
    setEditLoading(false);
    setSelectedId(bookingId);
    setEditing(false);
    setEditingBooking(null);
    setNotice('');
    focusPanelOnSmallScreens();
  }

  async function beginEdit() {
    if (!selected || !canModifyBooking(selected) || confirmCancel || cancellingRef.current) return;
    const requestId = ++editRequestRef.current;
    setEditLoading(true);
    setNotice('');
    try {
      const latest = await getBooking(selected.id);
      if (requestId !== editRequestRef.current) return;
      if (!canModifyBooking(latest)) {
        setNoticeTone('failed');
        setNotice('This reservation can no longer be changed (48-hour cutoff).');
        return;
      }
      setFilter('upcoming');
      setSelectedId(latest.id);
      setEditingBooking(latest);
      setEditing(true);
      focusPanelOnSmallScreens();
    } catch (err) { if (requestId === editRequestRef.current) { setNoticeTone('failed'); setNotice(bookingErrorMessage(err)); } }
    finally { if (requestId === editRequestRef.current) setEditLoading(false); }
  }

  async function confirmCancellation() {
    if (!selected || selected.status !== 'confirmed' || !confirmCancel || cancellingRef.current) return;
    cancellingRef.current = true;
    setCancelBusy(true);
    setCancelError('');
    setNotice('');
    try {
      const cancelled = await cancelBooking(selected.id);
      // Keep the reservation and its details in history, using the persisted server response.
      setBookings(previous => previous.map(item => item.id === cancelled.id ? cancelled : item));
      setFilter('cancelled');
      setSelectedId(cancelled.id);
      setConfirmCancel(false);
      setNoticeTone(cancelled.alreadyCancelled ? 'unknown' : cancelled.cancellationEmail?.status || 'unknown');
      setNotice(cancelled.alreadyCancelled ? 'This booking was already cancelled.'
        : cancelled.cancellationEmail?.status === 'sent'
          ? 'Booking cancelled successfully. Cancellation email sent.'
          : cancelled.cancellationEmail?.status === 'failed'
            ? `Booking cancelled successfully, but the cancellation email could not be sent. Reference #${cancelled.id}.`
            : 'Booking cancelled successfully. Email delivery was not confirmed.');
      focusPanelOnSmallScreens();
    } catch (err) {
      setCancelError(bookingErrorMessage(err));
    } finally {
      cancellingRef.current = false;
      setCancelBusy(false);
    }
  }

  function closeCancellation() {
    if (cancellingRef.current) return;
    setConfirmCancel(false);
    setCancelError('');
  }

  async function saveUpdate(updated) {
    try {
      const refreshed = await getMyBookings();
      setBookings(refreshed);
    } catch {
      // PATCH succeeded: display the server response if history reload fails.
      setBookings(previous => previous.map(item => item.id === updated.id ? updated : item));
    }
    setFilter('upcoming');
    setSelectedId(updated.id);
    setEditing(false);
    setEditingBooking(null);
    setNoticeTone(updated.confirmationEmail?.status || 'unknown');
    setNotice(updated.confirmationEmail?.status === 'sent'
      ? 'Booking updated successfully. Confirmation email sent.'
      : updated.confirmationEmail?.status === 'failed'
        ? `Booking updated successfully, but the confirmation email could not be sent. Please keep booking reference #${updated.id}.`
        : 'Booking updated successfully. Email delivery was not confirmed.');
    focusPanelOnSmallScreens();
  }

  return (
    <div className={`eh-my-bookings${editing ? ' eh-my-bookings--editing' : ''}`}
      inert={confirmCancel} aria-hidden={confirmCancel || undefined}>
      <header className="eh-profile-hero eh-my-bookings-hero" style={{ backgroundImage: `url(${heroImage})` }}>
        <div className="eh-profile-hero-shade"><div className="eh-wide-wrap eh-profile-hero-inner">
          <p className="eh-profile-eyebrow">YOUR RESERVATIONS</p>
          <h1>{editing ? 'Edit your booking' : 'My Bookings'}</h1>
          <p>{editing ? 'Update the details of your visit to Edelweiss Hut.' : 'View your upcoming visits, past reservations and cancellations.'}</p>
        </div></div>
      </header>
      <section className="eh-my-bookings-body eh-wide-wrap" aria-labelledby="my-bookings-heading">
        <div className="eh-my-bookings-head">
          <div><h2 id="my-bookings-heading">Your bookings</h2>
            <p>{editing ? 'Edit the selected upcoming reservation.' : 'Choose a category, then open a reservation using its arrow.'}</p>
          </div>
          {editing ? <span className="eh-edit-upcoming-pill">Upcoming ({groups.upcoming.length})</span>
            : <Link to="/availability" className="eh-button eh-button--green eh-bookings-new">+ New booking</Link>}
        </div>
        {!editing && <div className="eh-bookings-filters" role="group" aria-label="Filter bookings">
          {FILTERS.map(option => <button key={option.id} type="button"
            className={`eh-bookings-filter ${filter === option.id ? 'is-active' : ''}`}
            aria-pressed={filter === option.id} disabled={cancelBusy} onClick={() => selectFilter(option.id)}>
            {option.label} {!loading && !error && <span>{groups[option.id].length}</span>}
          </button>)}
        </div>}
        {receiptUnavailable && <div className="eh-manage-notice eh-receipt-redirect-notice" role="status">
          <div><strong>Reservation link unavailable</strong><p>That reservation cannot be opened. You can find all bookings associated with your account below.</p></div>
          <button type="button" aria-label="Dismiss reservation notice" onClick={() => setReceiptUnavailable(false)}>×</button>
        </div>}
        {notice && <div className={`eh-manage-notice eh-booking-email-notice--${noticeTone}`} role="status">{notice}</div>}
        {loading ? <div className="eh-bookings-state" role="status">Loading your bookings…</div>
          : error ? <div className="eh-bookings-state eh-bookings-state--error" role="alert">
            <h3>We couldn't load your bookings</h3><p>{error}</p>
            <button type="button" className="eh-button eh-button--green" onClick={loadBookings}>Try again</button>
          </div>
          : visible.length === 0 ? <div className="eh-bookings-state">
            <div className="eh-bookings-state-icon" aria-hidden="true">✦</div>
            <h3>Nothing here yet</h3><p>{EMPTY_TEXT[shownFilter]}</p>
            {shownFilter === 'upcoming' && <Link to="/availability" className="eh-button eh-button--green">Book a table</Link>}
          </div>
          : <div ref={gridRef} className={`eh-manage-grid ${selected ? 'has-selection' : 'is-list-only'}`}>
            <div className="eh-manage-list" aria-label={`${shownFilter} bookings`}>
              {visible.map(booking => <article key={booking.id}
                className={`eh-manage-booking${selected?.id === booking.id ? ' is-selected' : ''}`}>
                <span className="eh-manage-day"><strong>{booking.slot.date.slice(8, 10)}</strong>
                  <small>{new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(new Date(`${booking.slot.date}T12:00:00Z`))}</small></span>
                <span className="eh-manage-card-text"><strong>{readableMeal(booking.slot.meal) || 'Table booking'} · {String(booking.slot.startTime).slice(0, 5)}</strong>
                  <small>{booking.partySize} {booking.partySize === 1 ? 'guest' : 'guests'} · Booking #{booking.id}</small>
                  {selected?.id === booking.id && <em>{editing ? 'Editing this booking' : 'Details open'}</em>}
                </span>
                <button type="button" className="eh-manage-arrow-button"
                  aria-expanded={selected?.id === booking.id}
                  disabled={cancelBusy}
                  aria-controls={selected?.id === booking.id ? 'eh-manage-active-panel' : undefined}
                  aria-label={`${selected?.id === booking.id ? 'Close' : 'Open'} booking #${booking.id}: ${readableMeal(booking.slot.meal)}`}
                  onClick={() => toggleBooking(booking.id)}>
                  <svg className={`eh-manage-card-arrow${selected?.id === booking.id ? ' is-open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="m9 5 7 7-7 7" /></svg>
                </button>
              </article>)}
              {editing && <p className="eh-manage-cutoff">Changes close 48 hours before the meal.</p>}
            </div>
            {selected && <div className="eh-manage-right" id="eh-manage-active-panel">
              <button type="button" className="eh-manage-mobile-back" disabled={cancelBusy} onClick={closePanel}>← Back to your bookings</button>
              {editing && editingBooking?.id === selected.id
                ? <EditBookingForm key={editingBooking.id} booking={editingBooking}
                  onCancel={() => { setEditing(false); setEditingBooking(null); }} onSaved={saveUpdate} />
                : <section className="eh-edit-panel eh-manage-details" aria-label="Reservation details">
                  <p className="eh-edit-eyebrow">BOOKING #{selected.id}</p>
                  <div className="eh-edit-title-row"><h3>Your reservation</h3>
                    <span className={`eh-edit-status${shownFilter === 'cancelled' ? ' eh-edit-status--cancelled' : ''}`}>{shownFilter === 'cancelled' ? 'Cancelled' : shownFilter === 'past' ? 'Past' : 'Confirmed'}</span>
                  </div>
                  <div className="eh-manage-highlight">
                    <span className="eh-manage-summary-label">Your visit</span>
                    <strong>{readableBookingDate(selected.slot.date)}</strong>
                    <span>{timeLabel(selected)} · {readableMeal(selected.slot.meal)}</span>
                  </div>
                  <div className="eh-manage-facts">
                    <div><span>Guests</span><strong>{selected.partySize} {selected.partySize === 1 ? 'person' : 'people'}</strong></div>
                    {selected.status !== 'cancelled' && <div><span>Seating</span><strong>{selected.split ? 'Seated across multiple tables' : 'Seated together'}</strong></div>}
                  </div>
                  <div className="eh-manage-dietary"><h4>Dietary requirements</h4><DietaryRequirementsSummary requirements={selected.requirements} /></div>
                  <div className="eh-edit-actions">
                    <Link className="eh-edit-cancel" to={`/book/confirmation/${selected.id}`}
                      state={{ bookingListFilter: shownFilter }}>View full details</Link>
                    {selected.status === 'confirmed' && <button type="button" className="eh-cancel-booking-button"
                      disabled={editLoading || cancelBusy} onClick={() => { setConfirmCancel(true); setCancelError(''); setNotice(''); }}>
                      Cancel booking
                    </button>}
                    {shownFilter === 'upcoming' && canModifyBooking(selected) &&
                      <button className="eh-button eh-button--green" type="button" disabled={editLoading} onClick={beginEdit}>
                        {editLoading ? 'Loading…' : 'Change booking'} <span aria-hidden="true">→</span>
                      </button>}
                  </div>
                  {shownFilter === 'upcoming' && !canModifyBooking(selected) && <p className="eh-edit-policy">Changes are not allowed within 48 hours of the meal.</p>}
                  {shownFilter === 'past' && <p className="eh-edit-policy">Past reservations cannot be changed, but they can be cancelled.</p>}
                  {shownFilter === 'cancelled' && <p className="eh-edit-policy">This reservation is cancelled and remains in your history.</p>}
                </section>}
            </div>}
          </div>}
      </section>
      {selected && <Modal show={confirmCancel} onHide={closeCancellation} centered scrollable
        animation={false} backdrop="static" keyboard={!cancelBusy}
        dialogClassName="eh-cancel-modal eh-dialog" backdropClassName="eh-cancel-backdrop"
        aria-labelledby="eh-cancel-title" aria-describedby="eh-cancel-description">
        <Modal.Header className="eh-cancel-modal-header">
          <div>
            <p className="eh-cancel-modal-eyebrow">Your reservation</p>
            <Modal.Title as="h2" id="eh-cancel-title">Cancel this booking?</Modal.Title>
          </div>
          <button type="button" className="eh-cancel-modal-close" aria-label="Close cancellation dialog"
            onClick={closeCancellation} disabled={cancelBusy}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </Modal.Header>
        <Modal.Body className="eh-cancel-modal-body">
          <p id="eh-cancel-description">Are you sure you want to cancel this reservation?</p>
          <div className="eh-cancel-modal-summary">
            <span>Booking #{selected.id}</span>
            <strong>{readableBookingDate(selected.slot.date)}</strong>
            <p>{readableMeal(selected.slot.meal)} · {timeLabel(selected)} · {selected.partySize} {selected.partySize === 1 ? 'guest' : 'guests'}</p>
          </div>
          <p className="eh-cancel-modal-message">
            Your seats will be released for other guests.
            <strong>This action cannot be undone.</strong>
          </p>
          {cancelError && <p className="eh-cancel-error" role="alert">{cancelError}</p>}
          <div className="eh-cancel-confirm-actions">
            <button type="button" className="eh-cancel-keep" autoFocus disabled={cancelBusy} onClick={closeCancellation}>Keep booking</button>
            <button type="button" className="eh-cancel-confirm" disabled={cancelBusy} onClick={confirmCancellation}>
              {cancelBusy ? 'Cancelling…' : 'Confirm cancellation'}
            </button>
          </div>
        </Modal.Body>
      </Modal>}
    </div>
  );
}
