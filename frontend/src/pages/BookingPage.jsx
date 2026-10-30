import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import { Form, Button, Alert } from 'react-bootstrap';
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
    <div>
      <h1>Book a table</h1>
      <p>Bookings are simulated for now. Sign in with a real Hiker account to confirm.</p>

      {booking ? (
        <section aria-label="Booking result">
          <Alert variant="success">Booking confirmed (mock).</Alert>
          <h2>Booking details</h2>
          <p>Reference: {booking.id}</p>
          <p>Date: {booking.slot.date}</p>
          <p>Meal: {booking.slot.meal}</p>
          <p>Time: {booking.slot.startTime}</p>
          <p>Guests: {booking.partySize}</p>
          <p>Contact: {booking.contactName}</p>
          <p>Seating: {booking.split ? 'Multiple tables' : 'Single table'}</p>
          <p>Assigned seats: {booking.seatAssignments
            .map((table) => `${table.tableLabel}: ${table.seats}`)
            .join(', ')}
          </p>
          <Button onClick={handleNewBooking}>Make another booking</Button>
        </section>
      ) : (
        <>
          <Form onSubmit={handleSearch}>
            <Form.Group className="mb-3" controlId="booking-date">
              <Form.Label>Date</Form.Label>
              <Form.Control
                type="date" value={date} min={today} required disabled={busy}
                onChange={(event) => { setDate(event.target.value); resetResults(); }}
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="booking-guests">
              <Form.Label>Guests</Form.Label>
              <Form.Control
                type="number" min="1" step="1" required value={partySize}
                disabled={busy}
                onChange={(event) => { setPartySize(event.target.value); resetResults(); }}
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="booking-meal">
              <Form.Label>Meal</Form.Label>
              <Form.Select
                value={meal} required disabled={busy}
                onChange={(event) => { setMeal(event.target.value); resetResults(); }}
              >
                <option value="">Select a meal</option>
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="aperitivo">Aperitivo</option>
                <option value="dinner">Dinner</option>
              </Form.Select>
            </Form.Group>

            <Button type="submit" disabled={busy}>
              {loading ? 'Searching...' : 'Find available times'}
            </Button>
          </Form>

          {error && <Alert variant="danger" role="alert" className="mt-3">{error}</Alert>}
          {info && <Alert variant="info" className="mt-3">{info}</Alert>}

          {result && (
            <section className="mt-4">
              <h2>Available times</h2>
              {result.slots.length === 0 ? (
                <Alert variant="info">No available slots for the selected date, meal and party size.</Alert>
              ) : (
                <div className="d-flex flex-wrap gap-2">
                  {result.slots.map((slot) => (
                    <Button
                      key={slot.id}
                      variant={selectedSlotId === slot.id ? 'primary' : 'outline-primary'}
                      disabled={busy}
                      onClick={() => handleSelectSlot(slot)}
                    >
                      {slot.startTime} — {slot.availableSeats} seats left
                    </Button>
                  ))}
                </div>
              )}

              {checkingSeating && <p className="mt-3">Checking seating...</p>}

              {selectedSlot && seating && (
                <div className="mt-3">
                  <p>Selected time: {selectedSlot.startTime}</p>
                  <p>Seating: {seating.fit === 'single_table' ? 'Single table' : 'Multiple tables'}</p>
                  <p>Assigned seats: {seating.seatAssignments
                    .map((table) => `${table.tableLabel}: ${table.seats}`)
                    .join(', ')}
                  </p>
                  <Button onClick={handleConfirmBooking} disabled={busy || loadingAuth || user?.role && user.role !== 'hiker'}>
                    {bookingLoading ? 'Confirming...' : !user ? 'Log in to confirm' : 'Confirm booking'}
                  </Button>

                  {user?.role && user.role !== 'hiker' && (
                    <Alert variant="warning" className="mt-3">Only Hikers can make online bookings.</Alert>
                  )}

                  {import.meta.env.DEV && (
                    <div className="mt-3">
                      <Button variant="outline-secondary" onClick={handleSimulateOtherBooking} disabled={busy || !!info}>
                        Simulate another booking (test only)
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
