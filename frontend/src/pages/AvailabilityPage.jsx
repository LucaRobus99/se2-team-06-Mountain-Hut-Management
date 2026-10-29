import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Form, Row } from 'react-bootstrap';
import { useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import { getAvailableSlots, getSlotSeating } from '../api/booking.js';

const MEALS = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'aperitivo', label: 'Aperitivo' },
  { value: 'dinner', label: 'Dinner' }
];

function nextDay() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
}

export default function AvailabilityPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [date, setDate] = useState(searchParams.get('date') || nextDay());
  const [meal, setMeal] = useState(searchParams.get('meal') || 'lunch');
  const [partySize, setPartySize] = useState(searchParams.get('guests') || '2');
  const [result, setResult] = useState(null);
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [seating, setSeating] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSeating, setCheckingSeating] = useState(false);

  const searchReady = useMemo(() => Boolean(date && meal && Number(partySize) > 0), [date, meal, partySize]);

  function resetSelection() {
    setSelectedSlotId(null);
    setSeating(null);
  }

  async function performSearch(nextValues) {
    setLoading(true);
    setError('');
    resetSelection();
    try {
      const data = await getAvailableSlots({
        date: nextValues.date,
        meal: nextValues.meal,
        partySize: Number(nextValues.partySize)
      });
      setResult(data);
    } catch (err) {
      setError(err.message || 'Unable to check availability.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (searchReady && searchParams.get('date')) {
      performSearch({ date, meal, partySize });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    const payload = { date, meal, partySize };
    setSearchParams({ date, meal, guests: partySize });
    await performSearch(payload);
  }

  async function handleSelectSlot(slot) {
    setCheckingSeating(true);
    setError('');
    try {
      const data = await getSlotSeating({ slotId: slot.id, partySize: Number(partySize) });
      if (data.requiresConfirmation) {
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

  function handleContinue() {
    if (!result || selectedSlotId === null || !seating) return;
    const bookingDraft = { date, meal, partySize, result, selectedSlotId, seating };

    if (user?.role === 'hiker') {
      navigate('/book', { state: { bookingDraft } });
      return;
    }

    navigate('/login', {
      state: {
        from: '/book',
        bookingDraft
      }
    });
  }

  const selectedSlot = result?.slots.find((slot) => slot.id === selectedSlotId);

  return (
    <div className="inner-page-grid gap-4">
      <section>
        <p className="section-kicker mb-2">Public page</p>
        <h1 className="page-heading">Check availability</h1>
        <p className="page-lead text-secondary">
          Search for a date, meal and number of guests. You can continue to booking after selecting a slot.
        </p>
      </section>

      <Card className="border-0 shadow-sm page-card">
        <Card.Body className="p-4">
          <Form onSubmit={handleSubmit}>
            <Row className="g-3 align-items-end">
              <Col md={4}>
                <Form.Group controlId="availability-date">
                  <Form.Label>Date</Form.Label>
                  <Form.Control
                    type="date"
                    value={date}
                    min={nextDay()}
                    onChange={(event) => { setDate(event.target.value); resetSelection(); }}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group controlId="availability-meal">
                  <Form.Label>Meal</Form.Label>
                  <Form.Select value={meal} onChange={(event) => { setMeal(event.target.value); resetSelection(); }}>
                    {MEALS.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={2}>
                <Form.Group controlId="availability-guests">
                  <Form.Label>Guests</Form.Label>
                  <Form.Select value={partySize} onChange={(event) => { setPartySize(event.target.value); resetSelection(); }}>
                    {Array.from({ length: 8 }, (_, index) => String(index + 1)).map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={2}>
                <Button type="submit" className="w-100 search-submit-btn">
                  {loading ? 'Searching...' : 'Search'}
                </Button>
              </Col>
            </Row>
          </Form>
        </Card.Body>
      </Card>

      {error && <Alert variant="danger">{error}</Alert>}

      {result && (
        <Card className="border-0 shadow-sm page-card">
          <Card.Body className="p-4">
            <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mb-4">
              <div>
                <h2 className="h4 mb-1">Available slots</h2>
                <p className="text-secondary mb-0">
                  {result.date} · {MEALS.find((item) => item.value === result.meal)?.label} · {result.partySize} guests
                </p>
              </div>
              {!user && (
                <p className="small text-secondary mb-0">
                  You can search without logging in. Sign in only when you want to confirm a booking.
                </p>
              )}
            </div>

            {result.slots.length === 0 ? (
              <Alert variant="info" className="mb-0">
                No available slots for the selected date, meal and party size.
              </Alert>
            ) : (
              <>
                <div className="slot-grid">
                  {result.slots.map((slot) => {
                    const selected = slot.id === selectedSlotId;
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        className={`slot-card ${selected ? 'slot-card--selected' : ''}`}
                        onClick={() => handleSelectSlot(slot)}
                        disabled={checkingSeating}
                      >
                        <span className="slot-card__time">{slot.startTime}</span>
                        <span className="slot-card__meta">{slot.availableSeats} seats available</span>
                      </button>
                    );
                  })}
                </div>

                {checkingSeating && <p className="text-secondary mt-3 mb-0">Checking seating...</p>}

                {selectedSlot && seating && (
                  <Card className="mt-4 seating-panel border-0">
                    <Card.Body className="p-4">
                      <h3 className="h5 mb-3">Selected slot: {selectedSlot.startTime}</h3>
                      <p className="mb-2">
                        Seating: <strong>{seating.fit === 'single_table' ? 'Single table' : 'Multiple tables'}</strong>
                      </p>
                      <p className="text-secondary mb-4">
                        Assigned seats: {seating.seatAssignments
                          .map((table) => `${table.tableLabel}: ${table.seats}`)
                          .join(', ')}
                      </p>

                      {user?.role && user.role !== 'hiker' ? (
                        <Alert variant="warning" className="mb-0">
                          Only Hikers can make online bookings.
                        </Alert>
                      ) : (
                        <Button onClick={handleContinue} className="search-submit-btn">
                          Continue to booking
                        </Button>
                      )}
                    </Card.Body>
                  </Card>
                )}
              </>
            )}
          </Card.Body>
        </Card>
      )}
    </div>
  );
}
