import { useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-bootstrap';
import { useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import { getAvailableSlots, getSlotSeating } from '../api/booking.js';
import { AlpineDatePicker, AlpineMealSelect, MEAL_OPTIONS } from '../components/AlpineBookingFields.jsx';
import AvailabilitySlotCard from '../components/AvailabilitySlotCard.jsx';
import SplitSeatingModal from '../components/SplitSeatingModal.jsx';
import landscape from '../assets/edelweiss-booking-banner.png';

function nextDay() {
  const date = new Date();
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date).map(part => [part.type, part.value]));
  return new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day + 1)).toISOString().slice(0, 10);
}
function formatDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return iso || '';
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
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
  const [pendingSplit, setPendingSplit] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSeating, setCheckingSeating] = useState(false);
  const searchReady = useMemo(() => Boolean(date && meal && /^\d+$/.test(partySize) && Number(partySize) > 0), [date, meal, partySize]);

  function resetSelection() { setSelectedSlotId(null); setSeating(null); setPendingSplit(null); }
  function onFieldChange(setter, value) {
    setter(value);
    resetSelection();
    setResult(null); // Never show stale availability for a new party/date/meal.
    setError('');
  }

  async function performSearch(values) {
    setLoading(true);
    setError('');
    resetSelection();
    try {
      const data = await getAvailableSlots({ date: values.date, meal: values.meal, partySize: Number(values.partySize) });
      setResult(data);
    } catch (err) {
      setError(err.message || 'Unable to check availability.');
      setResult(null);
    } finally { setLoading(false); }
  }

  useEffect(() => {
    if (searchReady && searchParams.get('date')) performSearch({ date, meal, partySize });
    // Run only on initial navigation; clicking Search handles later searches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!searchReady || loading || checkingSeating) return;
    setSearchParams({ date, meal, guests: partySize });
    await performSearch({ date, meal, partySize });
  }

  async function handleSelectSlot(slot) {
    if (checkingSeating || loading) return;
    setCheckingSeating(true);
    setError('');
    resetSelection();
    try {
      const data = await getSlotSeating({ slotId: slot.id, partySize: Number(partySize) });
      if (data.requiresConfirmation) {
        // Reuse the same on-page dialog shown in Book a table, never a browser alert.
        setPendingSplit({ slotId: slot.id, seating: data });
      } else {
        setSelectedSlotId(slot.id);
        setSeating(data);
      }
    } catch (err) { setError(err.message || 'Unable to check seating.'); }
    finally { setCheckingSeating(false); }
  }

  function acceptSplit() {
    if (!pendingSplit) return;
    setSelectedSlotId(pendingSplit.slotId);
    setSeating(pendingSplit.seating);
    setPendingSplit(null);
  }

  function handleContinue() {
    if (!result || selectedSlotId === null || !seating) return;
    const bookingDraft = { date, meal, partySize, result, selectedSlotId, seating };
    if (user?.role === 'hiker') navigate('/book', { state: { bookingDraft } });
    else navigate('/login', { state: { from: '/book', bookingDraft } });
  }

  const selectedSlot = result?.slots?.find(slot => slot.id === selectedSlotId);
  return (
    <div className="eh-editorial-page eh-availability-page">
      <section className="eh-page-banner eh-availability-banner" style={{ backgroundImage: `url(${landscape})` }}>
        <div className="eh-wide-wrap eh-banner-content">
          <p className="eh-page-eyebrow">Plan your visit</p>
          <h1>Check availability</h1>
          <p>Find a table for your next mountain escape.</p>
        </div>
      </section>

      <div className="eh-wide-wrap eh-availability-body">
        <form className="eh-availability-search" onSubmit={handleSubmit}>
          <div className="eh-availability-field">
            <label htmlFor="availability-date">Date</label>
            <AlpineDatePicker id="availability-date" value={date} minDate={nextDay()} onChange={value => onFieldChange(setDate, value)} required disabled={loading || checkingSeating} />
          </div>
          <div className="eh-availability-field">
            <label htmlFor="availability-meal">Meal</label>
            <AlpineMealSelect id="availability-meal" value={meal} onChange={value => onFieldChange(setMeal, value)} required disabled={loading || checkingSeating} />
          </div>
          <div className="eh-availability-field eh-availability-guests">
            <label htmlFor="availability-guests">Guests</label>
            <input id="availability-guests" type="number" min="1" step="1" value={partySize} onChange={event => onFieldChange(setPartySize, event.target.value)} required disabled={loading || checkingSeating} />
          </div>
          <button type="submit" className="eh-button eh-button--green eh-availability-submit" disabled={!searchReady || loading || checkingSeating}>
            {loading ? 'Searching...' : 'Search'} <span aria-hidden="true">↗</span>
          </button>
        </form>

        {error && <Alert variant="danger" role="alert" className="eh-availability-error">{error}</Alert>}
        {loading && <p className="eh-search-message" role="status">Looking for available times...</p>}

        {result ? (
          <section className="eh-availability-results" aria-label="Available meal slots">
            <div className="eh-results-heading">
              <div><p className="eh-page-eyebrow">Your visit</p><h2>Available meal slots</h2></div>
              <p>{formatDate(result.date)} · {MEAL_OPTIONS.find(item => item.value === result.meal)?.label || result.meal} · {result.partySize} {result.partySize === 1 ? 'guest' : 'guests'}</p>
            </div>
            {result.slots.length === 0 ? (
              <div className="eh-empty-results"><h3>No tables available for this search.</h3><p>Try a different meal, date or number of guests.</p></div>
            ) : (
              <div className="eh-slot-cards">
                {result.slots.map((slot, index) => (
                  <AvailabilitySlotCard key={slot.id} slot={slot} index={index} partySize={result.partySize}
                    selected={selectedSlotId === slot.id} disabled={checkingSeating} onClick={() => handleSelectSlot(slot)} />
                ))}
              </div>
            )}
            {checkingSeating && <p className="eh-search-message" role="status">Checking your table...</p>}
            {selectedSlot && seating && (
              <div className="eh-selection-summary">
                <div>
                  <p className="eh-page-eyebrow">Your selection</p>
                  <h3>{selectedSlot.startTime} · {seating.fit === 'single_table' ? 'Single table' : 'Multiple tables'}</h3>
                  <p>For {partySize} {Number(partySize) === 1 ? 'guest' : 'guests'} · {formatDate(date)}</p>
                </div>
                {user?.role && user.role !== 'hiker' ? (
                  <p className="eh-selection-warning">Only Hikers can make online bookings.</p>
                ) : (
                  <button className="eh-button eh-button--green" type="button" onClick={handleContinue}>Continue to booking <span aria-hidden="true">↗</span></button>
                )}
              </div>
            )}
          </section>
        ) : !loading && !error ? (
          <div className="eh-availability-prompt"><h2>Your table is one search away.</h2><p>Choose a date, a meal and your group size to see available times.</p></div>
        ) : null}
      </div>
      <SplitSeatingModal
        show={Boolean(pendingSplit)}
        seating={pendingSplit?.seating}
        onCancel={() => setPendingSplit(null)}
        onContinue={acceptSplit}
      />
    </div>
  );
}
