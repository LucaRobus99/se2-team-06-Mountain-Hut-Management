import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import { Alert } from 'react-bootstrap';
import AvailabilitySlotCard from '../components/AvailabilitySlotCard.jsx';
import backdrop from '../assets/edelweiss-dolomites.png';
import { AlpineDatePicker, AlpineMealSelect } from '../components/AlpineBookingFields.jsx';
import {
  getAvailableSlots,
  getSlotSeating,
  createBooking,
  simulateOtherBooking
} from '../api/booking.js';

export default function BookingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loadingAuth, refreshUser } = useAuth();
  const draft = location.state?.bookingDraft;
  const today = new Date().toLocaleDateString('sv-SE', {
    timeZone: 'Europe/Rome'
  });

  const [date, setDate] = useState(draft?.date ?? '');
  const [partySize, setPartySize] = useState(draft?.partySize ?? '2');
  const [meal, setMeal] = useState(draft?.meal ?? '');

  const [result, setResult] = useState(draft?.result ?? null);
  const [selectedSlotId, setSelectedSlotId] = useState(draft?.selectedSlotId ?? null);
  const [seating, setSeating] = useState(draft?.seating ?? null);
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const [loading, setLoading] = useState(false);
  const [checkingSeating, setCheckingSeating] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const busy = loading || checkingSeating || bookingLoading;

  function resetResults() {
    setResult(null);
    setSelectedSlotId(null);
    setSeating(null);
    setError('');
    setInfo('');
  }

  async function handleSearch(event) {
    event.preventDefault();
    if (busy) return;

    const guests = Number(partySize);
    if (!date || date < today || !meal || !Number.isInteger(guests) || guests < 1) {
      setError('Please enter a valid date, meal and number of guests.');
      return;
    }
    setLoading(true);
    resetResults();
    try {
      setResult(await getAvailableSlots({ date, meal, partySize: guests }));
    } catch (err) {
      setError(err.message || 'Unable to check availability.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectSlot(slot) {
    if (busy) return;
    setError('');
    setInfo('');
    setSelectedSlotId(null);
    setSeating(null);
    setCheckingSeating(true);
    try {
      const data = await getSlotSeating({
        slotId: slot.id,
        partySize: Number(partySize)
      });
      if (data.requiresConfirmation) {
        // Popup provvisorio: in futuro lo sostituiremo con una Modal.
        const accepted = window.confirm(
          `${data.confirmation.message}\n\nDo you want to continue?`
        );
        if (!accepted) return;
      }
      setSelectedSlotId(slot.id);
      setSeating(data);
    } catch (err) {
      setError(err.message || 'Unable to check seating.');
    } finally {
      setCheckingSeating(false);
    }
  }

  function goToLogin() {
    navigate('/login', {
      state: {
        from: '/book',
        bookingDraft: { date, partySize, meal, result, selectedSlotId, seating }
      }
    });
  }

  async function handleConfirmBooking() {
    if (busy || loadingAuth || selectedSlotId === null || !seating || booking) return;
    if (!user) {
      goToLogin();
      return;
    }
    if (user.role !== 'hiker') {
      setError('Only Hikers can make online bookings.');
      return;
    }

    setBookingLoading(true);
    setError('');
    setInfo('');
    try {
      // La sessione e' reale: verifichiamo che non sia scaduta nel frattempo.
      const activeUser = await refreshUser();
      if (!activeUser) {
        goToLogin();
        return;
      }
      if (activeUser.role !== 'hiker') {
        setError('Only Hikers can make online bookings.');
        return;
      }
      const confirmedBooking = await createBooking({
        slotId: selectedSlotId,
        partySize: Number(partySize)
      }, activeUser);
      setBooking(confirmedBooking);
    } catch (err) {
      if (err.code === 'INSUFFICIENT_CAPACITY') {
        setError('These seats are no longer available. Please choose another time.');
      } else if (err.code === 'BOOKING_ALREADY_EXISTS') {
        setError('You already have a confirmed booking for this time slot.');
      } else if (err.code === 'SLOT_TOO_LATE') {
        setError('Bookings close two hours before the selected time.');
      } else if (err.code === 'SLOT_NOT_AVAILABLE') {
        setError('This time slot is no longer available.');
      } else if (err.code === 'UNAUTHENTICATED') {
        goToLogin();
        return;
      } else if (err.code === 'FORBIDDEN') {
        setError('Only Hikers can make online bookings.');
      } else {
        setError(err.message || 'The booking could not be completed.');
      }

      // Rilettura della disponibilita' dopo un errore di prenotazione.
      try {
        const updated = await getAvailableSlots({
          date,
          meal,
          partySize: Number(partySize)
        });
        setResult(updated);
      } catch {
        setResult(null);
      }
      setSelectedSlotId(null);
      setSeating(null);
    } finally {
      setBookingLoading(false);
    }
  }

  async function handleSimulateOtherBooking() {
    if (busy || selectedSlotId === null || !seating || booking) return;
    try {
      // Un'altra persona occupa abbastanza posti da rendere impossibile
      // la nostra prenotazione, lasciando invariata la schermata corrente.
      const seatsToTake = seating.availableSeats - Number(partySize) + 1;
      await simulateOtherBooking({ slotId: selectedSlotId, partySize: seatsToTake });
      setInfo('Another mock Hiker has booked seats. Now click Confirm booking to test the 409 error.');
    } catch (err) {
      setError(err.message || 'Could not simulate another booking.');
    }
  }

  function handleNewBooking() {
    setBooking(null);
    resetResults();
  }

  const selectedSlot = result?.slots.find((slot) => slot.id === selectedSlotId);
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
          <section className="eh-booking-success" aria-label="Booking result">
            <span className="eh-ornament" aria-hidden="true">✳</span>
            <h2>Your table is booked.</h2>
            <p className="eh-booking-confirmed">Booking confirmed (demo).</p>
            <dl>
              <div><dt>Reference</dt><dd>{booking.id}</dd></div>
              <div><dt>Date</dt><dd>{booking.slot.date}</dd></div>
              <div><dt>Time</dt><dd>{booking.slot.startTime}</dd></div>
              <div><dt>Meal</dt><dd>{booking.slot.meal === 'aperitivo' ? 'Happy hour' : booking.slot.meal}</dd></div>
              <div><dt>Guests</dt><dd>{booking.partySize}</dd></div>
              <div><dt>Name</dt><dd>{booking.contactName}</dd></div>
              <div><dt>Seating</dt><dd>{booking.split ? 'Multiple tables' : 'Single table'}</dd></div>
            </dl>
            <button type="button" className="eh-button eh-button--green" onClick={handleNewBooking}>Make another booking</button>
          </section>
        ) : (
          <>
            <form className="eh-availability-search eh-booking-search" onSubmit={handleSearch}>
              <div className="eh-availability-field">
                <label htmlFor="booking-date">Date</label>
                <AlpineDatePicker id="booking-date" value={date} minDate={today} required disabled={busy} onChange={value => { setDate(value); resetResults(); }} />
              </div>
              <div className="eh-availability-field">
                <label htmlFor="booking-meal">Meal</label>
                <AlpineMealSelect id="booking-meal" value={meal} required disabled={busy} onChange={value => { setMeal(value); resetResults(); }} />
              </div>
              <div className="eh-availability-field eh-availability-guests">
                <label htmlFor="booking-guests">Guests</label>
                <input id="booking-guests" type="number" min="1" step="1" required disabled={busy} value={partySize} onChange={event => { setPartySize(event.target.value); resetResults(); }} />
              </div>
              <button className="eh-button eh-button--green eh-availability-submit" disabled={busy} type="submit">{loading ? 'Searching...' : 'Find available times'} <span aria-hidden="true">↗</span></button>
            </form>
            {error && <Alert variant="danger" role="alert" className="eh-availability-error">{error}</Alert>}
            {info && <Alert variant="info" className="eh-availability-error">{info}</Alert>}
            {result && (
              <section className="eh-availability-results">
                <div className="eh-results-heading">
                  <div><p className="eh-page-eyebrow">Choose your time</p><h2>Available meal slots</h2></div>
                  <p>{result.date} · {partySize} {Number(partySize) === 1 ? 'guest' : 'guests'}</p>
                </div>
                {result.slots.length === 0 ? (
                  <div className="eh-empty-results"><h3>No tables available for this search.</h3><p>Try a different meal, date or number of guests.</p></div>
                ) : (
                  <div className="eh-slot-cards">
                    {result.slots.map((slot, index) => (
                      <AvailabilitySlotCard key={slot.id} slot={slot} index={index} partySize={Number(partySize)}
                        selected={selectedSlotId === slot.id} disabled={busy} onClick={() => handleSelectSlot(slot)} />
                    ))}
                  </div>
                )}
                {checkingSeating && <p className="eh-search-message" role="status">Checking your table...</p>}
                {selectedSlot && seating && (
                  <div className="eh-selection-summary">
                    <div>
                      <p className="eh-page-eyebrow">Your selection</p>
                      <h3>{selectedSlot.startTime} · {seating.fit === 'single_table' ? 'Single table' : 'Multiple tables'}</h3>
                      <p>{partySize} {Number(partySize) === 1 ? 'guest' : 'guests'} · {date}</p>
                    </div>
                    <div className="eh-selection-actions">
                      {user?.role && user.role !== 'hiker' && <p className="eh-selection-warning">Only Hikers can book online.</p>}
                      <button type="button" className="eh-button eh-button--green" onClick={handleConfirmBooking}
                        disabled={busy || loadingAuth || Boolean(user?.role && user.role !== 'hiker')}>
                        {bookingLoading ? 'Confirming...' : !user ? 'Log in to confirm' : 'Confirm booking'}
                      </button>
                      {import.meta.env.DEV && (
                        <button type="button" className="eh-button eh-button--outline" onClick={handleSimulateOtherBooking} disabled={busy || !!info}>
                          Simulate another booking (test)
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </section>
            )}
            {!result && !error && <div className="eh-availability-prompt"><h2>Your next stop starts here.</h2><p>Pick a date, meal and number of guests to find a time.</p></div>}
          </>
        )}
      </div>
    </div>
  );
}
