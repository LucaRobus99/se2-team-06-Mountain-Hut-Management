import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Alert, Modal } from 'react-bootstrap';
import { useAuth } from '../auth/AuthContext.jsx';
import AvailabilitySlotCard from '../components/AvailabilitySlotCard.jsx';
import SplitSeatingModal from '../components/SplitSeatingModal.jsx';
import backdrop from '../assets/edelweiss-booking-banner.png';
import { AlpineDatePicker, AlpineMealSelect } from '../components/AlpineBookingFields.jsx';
import { getAvailableSlots, getSlotSeating, createBooking, validateSearch, bookingErrorMessage } from '../api/booking.js';

const todayInHut = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
function friendlyDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return iso;
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
}

export default function BookingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loadingAuth, refreshUser } = useAuth();
  const draft = location.state?.bookingDraft;
  const [date, setDate] = useState(draft?.date || todayInHut());
  const [partySize, setPartySize] = useState(draft?.partySize || '2');
  const [meal, setMeal] = useState(draft?.meal || 'lunch');
  const [result, setResult] = useState(draft?.result || null);
  const [selectedSlotId, setSelectedSlotId] = useState(draft?.selectedSlotId ?? null);
  const [seating, setSeating] = useState(draft?.seating || null);
  const [pendingSplit, setPendingSplit] = useState(null);
  const [duplicateBooking, setDuplicateBooking] = useState(false);
  const [splitAcknowledged, setSplitAcknowledged] = useState(Boolean(draft?.seating?.requiresConfirmation));
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSeating, setCheckingSeating] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const submitting = useRef(false);
  const requestSeq = useRef(0);
  const busy = loading || checkingSeating || bookingLoading;

  function resetResults() {
    requestSeq.current += 1;
    setResult(null);
    setSelectedSlotId(null);
    setSeating(null);
    setPendingSplit(null);
    setSplitAcknowledged(false);
    setError('');
  }

  async function loadSlots() {
    const issue = validateSearch({ date, meal, partySize: Number(partySize) });
    if (issue) { setError(issue); return; }
    const id = ++requestSeq.current;
    setLoading(true);
    setResult(null);
    setSelectedSlotId(null);
    setSeating(null);
    setPendingSplit(null);
    setError('');
    try {
      const data = await getAvailableSlots({ date, meal, partySize: Number(partySize) });
      if (id === requestSeq.current) setResult(data);
    } catch (err) {
      if (id === requestSeq.current) setError(bookingErrorMessage(err));
    } finally { if (id === requestSeq.current) setLoading(false); }
  }

  async function handleSearch(event) {
    event.preventDefault();
    if (!busy) await loadSlots();
  }

  async function handleSelectSlot(slot) {
    if (busy) return;
    const id = ++requestSeq.current;
    setSelectedSlotId(null);
    setSeating(null);
    setPendingSplit(null);
    setSplitAcknowledged(false);
    setError('');
    setCheckingSeating(true);
    try {
      const data = await getSlotSeating({ slotId: slot.id, partySize: Number(partySize) });
      if (id !== requestSeq.current) return;
      if (data.requiresConfirmation) setPendingSplit({ mode: 'select', slotId: slot.id, seating: data });
      else { setSelectedSlotId(slot.id); setSeating(data); }
    } catch (err) { if (id === requestSeq.current) setError(bookingErrorMessage(err)); }
    finally { if (id === requestSeq.current) setCheckingSeating(false); }
  }

  function goToLogin() {
    navigate('/login', {
      state: {
        from: '/book',
        notice: 'Please log in to complete your booking. Your selection will be kept.',
        bookingDraft: { date, partySize, meal, result, selectedSlotId, seating },
      },
    });
  }

  async function reloadAfterConflict() {
    setSelectedSlotId(null);
    setSeating(null);
    setSplitAcknowledged(false);
    try {
      setResult(await getAvailableSlots({ date, meal, partySize: Number(partySize) }));
    } catch { setResult(null); }
  }

  async function saveBooking() {
    if (submitting.current) return;
    submitting.current = true; // prevents a double POST even before React re-renders
    setBookingLoading(true);
    setError('');
    try {
      const confirmed = await createBooking({ slotId: selectedSlotId, partySize: Number(partySize) });
      setBooking(confirmed);
      setPendingSplit(null);
    } catch (err) {
      if (err.code === 'UNAUTHENTICATED' || err.status === 401) { goToLogin(); return; }
      if (err.code === 'BOOKING_ALREADY_EXISTS') { setDuplicateBooking(true); return; }
      setError(bookingErrorMessage(err));
      if (['INSUFFICIENT_CAPACITY', 'SLOT_NOT_AVAILABLE', 'SLOT_NOT_FOUND', 'SLOT_TOO_LATE'].includes(err.code)) {
        await reloadAfterConflict();
      }
    } finally {
      submitting.current = false;
      setBookingLoading(false);
    }
  }

  async function handleConfirmBooking() {
    if (busy || loadingAuth || !selectedSlotId || !seating || booking || submitting.current) return;
    if (!user) { goToLogin(); return; }
    if (user.role !== 'hiker') { setError('Only Hiker accounts can book online.'); return; }
    setCheckingSeating(true);
    setError('');
    try {
      // Verify the server-side session, not just the cached React user.
      const activeUser = await refreshUser();
      if (!activeUser) { goToLogin(); return; }
      if (activeUser.role !== 'hiker') { setError('Only Hiker accounts can book online.'); return; }
      const latest = await getSlotSeating({ slotId: selectedSlotId, partySize: Number(partySize) });
      setSeating(latest);
      if (latest.requiresConfirmation && !splitAcknowledged) {
        setPendingSplit({ mode: 'confirm', slotId: selectedSlotId, seating: latest });
        return;
      }
      await saveBooking();
    } catch (err) {
      if (err.code === 'UNAUTHENTICATED' || err.status === 401) { goToLogin(); return; }
      if (err.code === 'BOOKING_ALREADY_EXISTS') { setDuplicateBooking(true); return; }
      setError(bookingErrorMessage(err));
      if (['INSUFFICIENT_CAPACITY', 'SLOT_NOT_AVAILABLE', 'SLOT_NOT_FOUND', 'SLOT_TOO_LATE'].includes(err.code)) await reloadAfterConflict();
    } finally { setCheckingSeating(false); }
  }

  async function acceptSplit() {
    if (!pendingSplit) return;
    const pending = pendingSplit;
    setPendingSplit(null);
    setSeating(pending.seating);
    setSelectedSlotId(pending.slotId);
    setSplitAcknowledged(true);
    if (pending.mode === 'confirm') await saveBooking();
  }

  const selectedSlot = result?.slots?.find(slot => slot.id === selectedSlotId);
  return (
    <div className="eh-editorial-page eh-booking-page">
      <section className="eh-page-banner eh-booking-banner" style={{ backgroundImage: `url(${backdrop})` }}>
        <div className="eh-wide-wrap eh-banner-content">
          <p className="eh-page-eyebrow">Your mountain table</p>
          <h1>Book a table.</h1>
          <p>Choose your moment and make it yours.</p>
        </div>
      </section>
      <div className="eh-wide-wrap eh-booking-content">
        {booking ? (
          <section className="eh-booking-success eh-booking-complete" aria-label="Booking confirmation" role="status">
            <span className="eh-success-check" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none"><path d="m12 25 8 8 17-19" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
            <p className="eh-page-eyebrow">Reservation successful</p>
            <h2>Booking confirmed!</h2>
            <p className="eh-success-subtitle">Your table reservation is confirmed. We look forward to seeing you at Edelweiss Hut.</p>
            <dl>
              <div><dt>Reference</dt><dd>#{booking.id}</dd></div>
              <div><dt>Date</dt><dd>{friendlyDate(booking.slot.date)}</dd></div>
              <div><dt>Time</dt><dd>{booking.slot.startTime}</dd></div>
              <div><dt>Guests</dt><dd>{booking.partySize}</dd></div>
            </dl>
            {booking.split && <p className="eh-success-seating">Your group will be seated across multiple tables.</p>}
            <p className="eh-success-footnote">Keep this booking reference for your visit.</p>
            <div className="eh-success-actions">
              <button type="button" className="eh-button eh-button--green" onClick={() => { setBooking(null); resetResults(); }}>Book another time</button>
              <Link to="/" className="eh-button eh-button--outline">Back to home</Link>
            </div>
          </section>
        ) : (
          <>
            <form className="eh-availability-search eh-booking-search" onSubmit={handleSearch}>
              <div className="eh-availability-field"><label htmlFor="booking-date">Date</label><AlpineDatePicker id="booking-date" value={date} minDate={todayInHut()} required disabled={busy} onChange={value => { setDate(value); resetResults(); }} /></div>
              <div className="eh-availability-field"><label htmlFor="booking-meal">Meal</label><AlpineMealSelect id="booking-meal" value={meal} required disabled={busy} onChange={value => { setMeal(value); resetResults(); }} /></div>
              <div className="eh-availability-field eh-availability-guests"><label htmlFor="booking-guests">Guests</label><input id="booking-guests" type="number" min="1" step="1" required disabled={busy} value={partySize} onChange={event => { setPartySize(event.target.value); resetResults(); }} /></div>
              <button className="eh-button eh-button--green eh-availability-submit" disabled={busy} type="submit">{loading ? 'Searching...' : 'Find available times'} <span aria-hidden="true">↗</span></button>
            </form>
            {error && <Alert variant="danger" role="alert" className="eh-availability-error">{error}</Alert>}
            {result && <section className="eh-availability-results">
              <div className="eh-results-heading"><div><p className="eh-page-eyebrow">Choose your time</p><h2>Available meal slots</h2></div><p>{friendlyDate(result.date)} · {partySize} {Number(partySize) === 1 ? 'guest' : 'guests'}</p></div>
              {result.slots.length === 0 ? <div className="eh-empty-results"><h3>No tables available for this search.</h3><p>Try a different meal, date or number of guests.</p></div> : <div className="eh-slot-cards">{result.slots.map((slot, index) => <AvailabilitySlotCard key={slot.id} slot={slot} index={index} partySize={Number(partySize)} selected={selectedSlotId === slot.id} disabled={busy} onClick={() => handleSelectSlot(slot)} />)}</div>}
              {checkingSeating && <p className="eh-search-message" role="status">Checking availability...</p>}
              {selectedSlot && seating && <div className="eh-selection-summary">
                <div><p className="eh-page-eyebrow">Your selection</p><h3>{selectedSlot.startTime} · {seating.fit === 'single_table' ? 'Single table' : 'Multiple tables'}</h3><p>{partySize} {Number(partySize) === 1 ? 'guest' : 'guests'} · {friendlyDate(date)}</p><small>Seats are confirmed only after you complete the booking.</small></div>
                <div className="eh-selection-actions">
                  {user?.role && user.role !== 'hiker' ? <p className="eh-selection-warning">Only Hiker accounts can book online.</p> : <button type="button" className="eh-button eh-button--green" onClick={handleConfirmBooking} disabled={busy || loadingAuth}>{bookingLoading ? 'Confirming...' : !user ? 'Log in to book' : 'Confirm booking'}</button>}
                </div>
              </div>}
            </section>}
            {!result && !error && <div className="eh-availability-prompt"><h2>Your next stop starts here.</h2><p>Pick a date, meal and number of guests to find a time.</p></div>}
          </>
        )}
      </div>
      <SplitSeatingModal show={Boolean(pendingSplit)} seating={pendingSplit?.seating} busy={bookingLoading} onCancel={() => setPendingSplit(null)} onContinue={acceptSplit} />
      <Modal show={duplicateBooking} onHide={() => setDuplicateBooking(false)} centered aria-labelledby="duplicate-booking-title" dialogClassName="eh-split-modal">
        <Modal.Header closeButton>
          <Modal.Title id="duplicate-booking-title">You already have a reservation</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>You already have a confirmed booking for this time slot. Please select a different time to make another reservation.</p>
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="eh-button eh-button--green" onClick={() => {
            setDuplicateBooking(false);
            setSelectedSlotId(null);
            setSeating(null);
            setSplitAcknowledged(false);
          }}>Choose another time</button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
