import { useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { Alert, Modal } from 'react-bootstrap';
import { useAuth } from '../auth/AuthContext.jsx';
import SplitSeatingModal from '../components/SplitSeatingModal.jsx';
import bookingBackground from '../assets/edelweiss-booking-background.jpg';
import EdelweissBrand from '../components/EdelweissBrand.jsx';
import { createBooking, getSlotSeating, bookingErrorMessage } from '../api/booking.js';

function friendlyDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return iso || '';
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' })
    .format(new Date(`${iso}T00:00:00Z`));
}

function availabilityUrl(draft) {
  if (!draft?.date || !draft?.meal || !draft?.partySize) return '/availability';
  const params = new URLSearchParams({
    date: draft.date, meal: draft.meal, guests: String(draft.partySize),
  });
  return `/availability?${params.toString()}`;
}

// Booking is the review/confirmation step. The search experience is shared
// between public /availability and authenticated /book.
export default function BookingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loadingAuth, refreshUser } = useAuth();
  const draft = location.state?.bookingDraft;
  const [seating, setSeating] = useState(draft?.seating || null);
  const [splitAcknowledged, setSplitAcknowledged] = useState(Boolean(draft?.seating?.requiresConfirmation));
  const [pendingSplit, setPendingSplit] = useState(null);
  const [duplicateBooking, setDuplicateBooking] = useState(false);
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState('');
  const [staleSelection, setStaleSelection] = useState(false);
  const [checkingSeating, setCheckingSeating] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const submitting = useRef(false);
  const busy = checkingSeating || bookingLoading;
  const backToAvailability = availabilityUrl(draft);
  const selectedSlot = draft?.result?.slots?.find(slot => slot.id === draft.selectedSlotId);
  const shownDate = booking?.slot.date || draft?.date;
  const shownTime = booking?.slot.startTime || selectedSlot?.startTime;
  const shownEnd = booking?.slot.endTime || selectedSlot?.endTime;
  const shownMeal = booking?.slot.meal || draft?.meal;
  const shownGuests = booking?.partySize || Number(draft?.partySize);
  const groupIsSplit = booking ? booking.split : seating?.fit === 'split';
  const mealLabel = shownMeal === 'aperitivo'
    ? 'Happy hour'
    : shownMeal ? `${shownMeal[0].toUpperCase()}${shownMeal.slice(1)}` : '';

  function goToLogin() {
    navigate('/login', {
      state: {
        from: '/book', bookingDraft: draft,
        notice: 'Please log in to complete your booking. Your selection will be kept.',
      },
    });
  }

  function handleBookingError(err) {
    if (err.code === 'UNAUTHENTICATED' || err.status === 401) {
      goToLogin();
      return;
    }
    if (err.code === 'BOOKING_ALREADY_EXISTS') {
      setDuplicateBooking(true);
      return;
    }
    setError(bookingErrorMessage(err));
    if (['INSUFFICIENT_CAPACITY', 'SLOT_NOT_AVAILABLE', 'SLOT_NOT_FOUND', 'SLOT_TOO_LATE'].includes(err.code)) {
      // A booking attempt can fail after a previous public availability check.
      // Return to the single search page instead of duplicating the form here.
      setStaleSelection(true);
    }
  }

  async function saveBooking() {
    if (submitting.current || !draft) return;
    submitting.current = true;
    setBookingLoading(true);
    setError('');
    try {
      const confirmed = await createBooking({
        slotId: draft.selectedSlotId, partySize: Number(draft.partySize),
      });
      setBooking(confirmed);
      setPendingSplit(null);
    } catch (err) {
      handleBookingError(err);
    } finally {
      submitting.current = false;
      setBookingLoading(false);
    }
  }

  async function confirmBooking() {
    if (!draft || !seating || !selectedSlot || busy || booking || staleSelection || loadingAuth) return;
    if (!user) { goToLogin(); return; }
    if (user.role !== 'hiker') { setError('Only Hiker accounts can book online.'); return; }
    setCheckingSeating(true);
    setError('');
    try {
      const activeUser = await refreshUser();
      if (!activeUser) { goToLogin(); return; }
      if (activeUser.role !== 'hiker') { setError('Only Hiker accounts can book online.'); return; }
      const latest = await getSlotSeating({ slotId: draft.selectedSlotId, partySize: Number(draft.partySize) });
      setSeating(latest);
      if (latest.requiresConfirmation && !splitAcknowledged) {
        setPendingSplit(latest);
        return;
      }
      await saveBooking();
    } catch (err) {
      handleBookingError(err);
    } finally {
      setCheckingSeating(false);
    }
  }

  async function acceptSplit() {
    if (!pendingSplit) return;
    setSeating(pendingSplit);
    setSplitAcknowledged(true);
    setPendingSplit(null);
    await saveBooking();
  }

  if (!draft || !selectedSlot || !seating) {
    return <Navigate to={backToAvailability} replace />;
  }

  return (
    <main className="eh-booking-page">
      <section className="eh-login-scene eh-booking-scene" style={{ backgroundImage: `url(${bookingBackground})` }}>
        <div className={`eh-login-card eh-booking-card ${booking ? 'eh-booking-card--confirmed' : ''}`}>
          <div className="eh-login-brand"><EdelweissBrand /></div>
          {booking && (
            <div className="eh-booking-success-mark" role="status" aria-label="Booking successfully confirmed">
              <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 24 9 9 16-18" />
              </svg>
            </div>
          )}
          <p className={`eh-booking-kicker ${booking ? 'eh-booking-kicker--confirmed' : ''}`}>
            {booking ? 'Reservation successful' : 'Review your selection'}
          </p>
          <h1>{booking ? 'Booking confirmed!' : 'Review your booking'}</h1>
          <p className="eh-booking-intro">{booking
            ? 'You’re all set! Your table is reserved. We look forward to welcoming you.'
            : 'Please check the details below before confirming your reservation.'}</p>

          <p className="eh-booking-details-heading">{booking ? 'Your confirmed details' : 'Your selected details'}</p>
          <dl className="eh-booking-recap">
            <div><dt>Date</dt><dd>{friendlyDate(shownDate)}</dd></div>
            <div><dt>Time</dt><dd>{shownTime}{shownEnd ? ` – ${shownEnd}` : ''}</dd></div>
            <div><dt>Meal</dt><dd>{mealLabel}</dd></div>
            <div><dt>Guests</dt><dd>{shownGuests} {shownGuests === 1 ? 'person' : 'people'}</dd></div>
            <div className="eh-booking-seating-detail"><dt>Seating</dt><dd>{groupIsSplit ? 'Across multiple tables' : 'Together at one table'}</dd></div>
          </dl>

          {error && <Alert variant="danger" role="alert" className="eh-booking-error">{error}</Alert>}

          <div className="eh-booking-actions">
            {booking ? (
              <>
                <Link to="/book" className="eh-button eh-button--green">Book another table</Link>
                <Link to="/" className="eh-button eh-button--outline">Back to home</Link>
              </>
            ) : (
              <>
                <Link to={backToAvailability} className="eh-button eh-button--outline">
                  {staleSelection ? 'Check availability again' : 'Back'}
                </Link>
                {!staleSelection && (
                  <button type="button" className="eh-button eh-button--green"
                    onClick={confirmBooking} disabled={busy || loadingAuth}>
                    {busy ? 'Confirming...' : 'Confirm booking'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </section>
      <SplitSeatingModal
        show={Boolean(pendingSplit)} seating={pendingSplit}
        busy={bookingLoading} onCancel={() => setPendingSplit(null)} onContinue={acceptSplit}
      />
      <Modal show={duplicateBooking} onHide={() => setDuplicateBooking(false)} centered aria-labelledby="duplicate-booking-title" dialogClassName="eh-split-modal">
        <Modal.Header closeButton><Modal.Title id="duplicate-booking-title">You already have a reservation</Modal.Title></Modal.Header>
        <Modal.Body><p>You already have a confirmed booking for this time slot. Please select a different time to make another reservation.</p></Modal.Body>
        <Modal.Footer><button type="button" className="eh-button eh-button--green" onClick={() => navigate(backToAvailability)}>Choose another time</button></Modal.Footer>
      </Modal>
    </main>
  );
}
