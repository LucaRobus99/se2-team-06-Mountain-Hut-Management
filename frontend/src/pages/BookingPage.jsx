import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router';
import { Alert } from 'react-bootstrap';
import { useAuth } from '../auth/AuthContext.jsx';
import { getPendingBooking, clearPendingBooking } from '../utils/pendingBooking.js';
import SplitSeatingModal from '../components/SplitSeatingModal.jsx';
import PartyRequirementsFields from '../components/PartyRequirementsFields.jsx';
import { validatePartyRequirements } from '../utils/partyRequirements.js';
import bookingBackground from '../assets/edelweiss-booking-background.jpg';
import { createBooking, getBooking, getSlotSeating, checkSlotBooking, bookingErrorMessage } from '../api/booking.js';

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
  const { bookingId } = useParams();
  const { user, loadingAuth, refreshUser } = useAuth();
  const [storedDraft] = useState(() => getPendingBooking());
  // Once confirmed, the server record (not a possibly stale review draft)
  // is the source of truth for both refresh and direct links.
  const draft = bookingId ? null : (location.state?.bookingDraft || storedDraft);
  const [seating, setSeating] = useState(draft?.seating || null);
  // Allergy information remains in React memory until submitted; do not store it
  // in pendingBooking/sessionStorage, which is reserved for non-sensitive choices.
  const [partyRequirements, setPartyRequirements] = useState([]);
  const [showRequirementErrors, setShowRequirementErrors] = useState(false);
  const [splitAcknowledged, setSplitAcknowledged] = useState(Boolean(draft?.seating?.requiresConfirmation));
  const [pendingSplit, setPendingSplit] = useState(null);
  const [duplicateBooking, setDuplicateBooking] = useState(false);
  const [prechecking, setPrechecking] = useState(Boolean(!bookingId && draft));
  const [booking, setBooking] = useState(null);
  const [receiptLoading, setReceiptLoading] = useState(Boolean(bookingId));
  const [receiptError, setReceiptError] = useState('');
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
  const confirmationEmailStatus = booking?.confirmationEmail?.status;
  const confirmationAddress = booking?.email || user?.email;
  useEffect(() => {
    if (bookingId || !draft?.selectedSlotId || loadingAuth) return;
    if (user?.role !== 'hiker') { setPrechecking(false); return; }
    let active = true;
    setPrechecking(true);
    checkSlotBooking(draft.selectedSlotId)
      .then((alreadyBooked) => { if (active && alreadyBooked) setDuplicateBooking(true); })
      .catch((err) => {
        if (!active) return;
        setError(bookingErrorMessage(err));
        setStaleSelection(true); // Do not allow a booking until the server can check it.
      })
      .finally(() => { if (active) setPrechecking(false); });
    return () => { active = false; };
  }, [bookingId, draft?.selectedSlotId, loadingAuth, user?.id, user?.role]);

  useEffect(() => {
    if (!bookingId) return;
    let active = true;
    setReceiptLoading(true);
    setReceiptError('');
    setBooking(null);
    // GET checks that the current hiker owns this booking. Never rely solely
    // on browser history state to display a confirmed reservation.
    getBooking(Number(bookingId))
      .then((confirmed) => {
        if (!active) return;
        const emailStatus = location.state?.bookingId === confirmed.id
          ? location.state?.emailStatus : null;
        setBooking(emailStatus
          ? { ...confirmed, confirmationEmail: { status: emailStatus } }
          : confirmed);
      })
      .catch((err) => { if (active) setReceiptError(bookingErrorMessage(err)); })
      .finally(() => { if (active) setReceiptLoading(false); });
    return () => { active = false; };
  }, [bookingId, location.state?.bookingId, location.state?.emailStatus]);
  const mealLabel = shownMeal === 'aperitivo'
    ? 'Aperitif'
    : shownMeal ? `${shownMeal[0].toUpperCase()}${shownMeal.slice(1)}` : '';

  function goToLogin() {
    navigate('/login', {
      state: {
        from: '/book', bookingDraft: draft,
        notice: 'Please log in to complete your booking. Your selection will be kept.',
      },
    });
  }

  function returnToAvailability(message, noticeType = 'info') {
    // An abandoned review must never become the next booking draft.
    clearPendingBooking();
    setPendingSplit(null);
    setDuplicateBooking(false);
    navigate(backToAvailability, {
      replace: true,
      state: message ? { bookingNotice: message, bookingNoticeType: noticeType } : null,
    });
  }

  function chooseAnotherTime() {
    returnToAvailability('You already have a reservation for this time. Please choose another time slot.', 'danger');
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
        requirements: partyRequirements,
      });
      clearPendingBooking();
      setPendingSplit(null);
      // The URL identifies a confirmed booking and survives a browser refresh.
      // The GET on that route verifies ownership and reloads the details.
      navigate(`/book/confirmation/${confirmed.id}`, {
        replace: true,
        state: { bookingId: confirmed.id, emailStatus: confirmed.confirmationEmail?.status },
      });
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
    setShowRequirementErrors(true);
    const requirementsError = validatePartyRequirements(partyRequirements);
    if (requirementsError) { setError(requirementsError); return; }
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

  if (bookingId && (receiptLoading || (!receiptError && String(booking?.id) !== bookingId))) {
    return <main className="eh-booking-page eh-route-loading" role="status">Loading your booking confirmation…</main>;
  }
  if (bookingId && (receiptError || !booking)) {
    return (
      <main className="eh-booking-page">
        <Alert variant="danger" role="alert">{receiptError || 'Unable to load the booking confirmation.'}</Alert>
        <Link to="/my-bookings" className="eh-button eh-button--green">← Back to My Bookings</Link>
        <Link to="/availability" className="eh-button eh-button--outline">Check availability</Link>
      </main>
    );
  }
  if (!bookingId && (!draft || !selectedSlot || !seating)) {
    return <Navigate to={backToAvailability} replace />;
  }
  if (!bookingId && prechecking) {
    return <main className="eh-booking-page eh-route-loading" role="status">Checking your existing reservations…</main>;
  }
  if (!bookingId && duplicateBooking) {
    return (
      <main className="eh-booking-page">
        <section className="eh-login-scene eh-booking-scene" style={{ backgroundImage: `url(${bookingBackground})` }}>
          <div className="eh-login-card eh-booking-card eh-booking-card--blocked">
            <div className="eh-booking-blocked-message" role="alert">
              <svg className="eh-booking-blocked-icon" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
                <circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" strokeWidth="2.5" />
                <path d="M20 11v13" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="20" cy="29" r="1.8" fill="currentColor" />
              </svg>
              <h1>You're already booked</h1>
              <p>You already have a reservation for this time slot.</p>
              <p className="eh-booking-blocked-time">{friendlyDate(shownDate)} · {shownTime}</p>
            </div>
            <button type="button" className="eh-button eh-button--green" onClick={chooseAnotherTime}>Choose another time</button>
          </div>
        </section>
      </main>
    );
  }

  if (booking) {
    const savedRequirements = Array.isArray(booking.requirements) ? booking.requirements : [];
    return (
      <main className="eh-booking-page">
        <section className="eh-login-scene eh-booking-scene" style={{ backgroundImage: `url(${bookingBackground})` }}>
          <div className="eh-login-card eh-booking-card eh-booking-card--confirmed">
            <header className="eh-confirmation-heading">
              <div className="eh-booking-success-mark" role="status" aria-label="Booking successfully confirmed">
                <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m12 24 9 9 16-18" />
                </svg>
              </div>
              <p className="eh-confirmation-eyebrow">Reservation confirmed</p>
              <h1>Your table is booked!</h1>
              <p className="eh-confirmation-subtitle">Edelweiss Hut · Reservation #{booking.id}</p>
            </header>

            <section className="eh-confirmation-reservation" aria-label="Booking confirmation details">
              <h2>Your reservation</h2>
              <dl className="eh-confirmation-visit">
                <div>
                  <dt>Date</dt>
                  <dd>{friendlyDate(shownDate)}</dd>
                </div>
                <div>
                  <dt>Time</dt>
                  <dd>{shownTime}{shownEnd ? ` – ${shownEnd}` : ''}</dd>
                </div>
              </dl>
              <dl className="eh-confirmation-facts">
                <div><dt>Meal</dt><dd>{mealLabel}</dd></div>
                <div><dt>Guests</dt><dd>{shownGuests} {shownGuests === 1 ? 'person' : 'people'}</dd></div>
                <div><dt>Seating</dt><dd>{groupIsSplit ? 'Across multiple tables' : 'Together at one table'}</dd></div>
              </dl>
            </section>

            {savedRequirements.length > 0 && (
              <section className="eh-confirmation-dietary" aria-label="Confirmed dietary requirements">
                <header className="eh-confirmation-dietary-heading">
                  <h2>Dietary requirements</h2>
                  <span>{savedRequirements.length} {savedRequirements.length === 1 ? 'request' : 'requests'}</span>
                </header>
                <ul>
                  {savedRequirements.map((item, index) => (
                    <li key={index}>
                      <span className="eh-confirmation-dietary-description">{item.description}</span>
                      {item.allergies && <strong className="eh-confirmation-allergy-label">Allergy — special care required</strong>}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className={`eh-booking-email-notice eh-booking-email-notice--${confirmationEmailStatus || 'unknown'} eh-confirmation-email`} role="status">
              {confirmationEmailStatus === 'sent' ? (
                <><strong>Confirmation email sent</strong><span>{confirmationAddress ? `Sent to ${confirmationAddress}.` : 'Check your inbox.'}</span></>
              ) : confirmationEmailStatus === 'failed' ? (
                <><strong>Email could not be sent</strong><span>Your reservation is confirmed. Keep your booking reference.</span></>
              ) : (
                <><strong>Reservation saved</strong><span>Keep your booking reference in case the email is unavailable.</span></>
              )}
            </div>

            <div className="eh-booking-actions">
              <Link to="/book" className="eh-button eh-button--green">Book another table</Link>
              <Link to={`/my-bookings${location.state?.bookingListFilter ? `?tab=${location.state.bookingListFilter}` : ""}`} className="eh-button eh-button--outline">← Back to My Bookings</Link>
              <Link to="/" className="eh-button eh-button--outline">Back to home</Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="eh-booking-page">
      <section className="eh-login-scene eh-booking-scene" style={{ backgroundImage: `url(${bookingBackground})` }}>
        <div className="eh-login-card eh-booking-card eh-booking-card--review">
          <header className="eh-booking-review-heading">
            <h1>Review your booking</h1>
            <p>Check the details before confirming your reservation.</p>
          </header>

          <div className="eh-booking-content-grid">
            <section className="eh-booking-panel eh-booking-panel--summary" aria-labelledby="eh-booking-summary-title">
              <h2 className="eh-booking-details-heading" id="eh-booking-summary-title">Your reservation</h2>
              <p className="eh-booking-review-date">{friendlyDate(shownDate)}</p>
              <p className="eh-booking-review-time">{shownTime}{shownEnd ? ` – ${shownEnd}` : ''}</p>
              <div className="eh-booking-review-facts">
                <span>{mealLabel}</span>
                <span aria-hidden="true">·</span>
                <span>{shownGuests} {shownGuests === 1 ? 'person' : 'people'}</span>
              </div>
              <p className="eh-booking-review-seating">{groupIsSplit ? 'Across multiple tables' : 'Together at one table'}</p>
            </section>

            <div className="eh-booking-panel eh-booking-panel--dietary">
              {user?.role === 'hiker' && !loadingAuth ? (
                <PartyRequirementsFields
                  requirements={partyRequirements}
                  onChange={(next) => { setPartyRequirements(next); setError(''); }}
                  showErrors={showRequirementErrors}
                  disabled={busy}
                />
              ) : (
                <p className="eh-party-login-note">Sign in to add dietary requirements before placing your booking.</p>
              )}
            </div>
          </div>

          {error && <Alert variant="danger" role="alert" className="eh-booking-error">{error}</Alert>}

          <div className="eh-booking-actions">
            <Link to={backToAvailability} replace onClick={clearPendingBooking} className="eh-button eh-button--outline">
              {staleSelection ? 'Check availability again' : 'Back'}
            </Link>
            {!staleSelection && (
              <button type="button" className="eh-button eh-button--green"
                onClick={confirmBooking} disabled={busy || loadingAuth}>
                {busy ? 'Confirming...' : 'Confirm booking'}
              </button>
            )}
          </div>
        </div>
      </section>
      <SplitSeatingModal
        show={Boolean(pendingSplit)} seating={pendingSplit}
        busy={bookingLoading}
        onCancel={() => returnToAvailability('Choose a different time slot if you prefer not to split your party.')}
        onContinue={acceptSplit}
      />
    </main>
  );
}
