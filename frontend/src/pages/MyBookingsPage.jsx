import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { getMyBookings, getBooking, bookingErrorMessage } from '../api/booking.js';
import { bookingSummary, readableBookingDate, readableMeal } from '../utils/bookingList.js';
import { canModifyBooking } from '../utils/editBooking.js';
import EditBookingForm from '../components/EditBookingForm.jsx';
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

function RequirementSummary({ requirements }) {
  if (!requirements?.length) return <p className="eh-manage-none">No dietary requirements added.</p>;
  return <ul className="eh-manage-diet-list">{requirements.map((item, index) => (
    <li key={index} className={item.allergies ? 'has-allergy' : ''}>
      <span className="eh-manage-diet-icon" aria-hidden="true">{item.allergies ? '!' : '✦'}</span>
      <span><strong>{item.description}</strong>{item.allergies && <small>Allergy · special care required</small>}</span>
    </li>
  ))}</ul>;
}

export default function MyBookingsPage() {
  const location = useLocation();
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
  const [reload, setReload] = useState(0);
  const gridRef = useRef(null);
  const editRequestRef = useRef(0);
  const loadBookings = useCallback(() => setReload(value => value + 1), []);

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
    editRequestRef.current += 1;
    setFilter(next);
    setSelectedId(null);
    setEditing(false);
    setEditingBooking(null);
    setNotice('');
  }
  function closePanel() {
    editRequestRef.current += 1;
    setEditLoading(false);
    setSelectedId(null);
    setEditing(false);
    setEditingBooking(null);
    setNotice('');
    focusPanelOnSmallScreens();
  }
  function toggleBooking(bookingId) {
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
    if (!selected || !canModifyBooking(selected)) return;
    const requestId = ++editRequestRef.current;
    setEditLoading(true);
    setNotice('');
    try {
      const latest = await getBooking(selected.id);
      if (requestId !== editRequestRef.current) return;
      if (!canModifyBooking(latest)) {
        setNotice('This reservation can no longer be changed (48-hour cutoff).');
        return;
      }
      setFilter('upcoming');
      setSelectedId(latest.id);
      setEditingBooking(latest);
      setEditing(true);
      focusPanelOnSmallScreens();
    } catch (err) { if (requestId === editRequestRef.current) setNotice(bookingErrorMessage(err)); }
    finally { if (requestId === editRequestRef.current) setEditLoading(false); }
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
    setNotice(updated.confirmationEmail?.status === 'sent'
      ? 'Booking updated successfully. A confirmation email was sent.'
      : updated.confirmationEmail?.status === 'failed'
        ? 'Booking updated successfully, but the confirmation email could not be sent.'
        : 'Booking updated successfully. Email delivery was not confirmed.');
    focusPanelOnSmallScreens();
  }

  return (
    <div className={`eh-my-bookings${editing ? ' eh-my-bookings--editing' : ''}`}>
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
            aria-pressed={filter === option.id} onClick={() => selectFilter(option.id)}>
            {option.label} {!loading && !error && <span>{groups[option.id].length}</span>}
          </button>)}
        </div>}
        {notice && <div className="eh-manage-notice" role="status">{notice}</div>}
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
                  aria-controls={selected?.id === booking.id ? 'eh-manage-active-panel' : undefined}
                  aria-label={`${selected?.id === booking.id ? 'Close' : 'Open'} booking #${booking.id}: ${readableMeal(booking.slot.meal)}`}
                  onClick={() => toggleBooking(booking.id)}>
                  <span className={`eh-manage-card-arrow${selected?.id === booking.id ? ' is-open' : ''}`} aria-hidden="true">›</span>
                </button>
              </article>)}
              {editing && <p className="eh-manage-cutoff">Changes close 48 hours before the meal.</p>}
            </div>
            {selected && <div className="eh-manage-right" id="eh-manage-active-panel">
              <button type="button" className="eh-manage-mobile-back" onClick={closePanel}>← Back to your bookings</button>
              {editing && editingBooking?.id === selected.id
                ? <EditBookingForm key={editingBooking.id} booking={editingBooking}
                  onCancel={() => { setEditing(false); setEditingBooking(null); }} onSaved={saveUpdate} />
                : <section className="eh-edit-panel eh-manage-details" aria-label="Reservation details">
                  <p className="eh-edit-eyebrow">BOOKING #{selected.id}</p>
                  <div className="eh-edit-title-row"><h3>Your reservation</h3>
                    <span className="eh-edit-status">{shownFilter === 'cancelled' ? 'Cancelled' : shownFilter === 'past' ? 'Past' : 'Confirmed'}</span>
                  </div>
                  <div className="eh-manage-highlight">
                    <span className="eh-manage-summary-label">Your visit</span>
                    <strong>{readableBookingDate(selected.slot.date)}</strong>
                    <span>{timeLabel(selected)} · {readableMeal(selected.slot.meal)}</span>
                  </div>
                  <div className="eh-manage-facts">
                    <div><span>Guests</span><strong>{selected.partySize} {selected.partySize === 1 ? 'person' : 'people'}</strong></div>
                    <div><span>Seating</span><strong>{selected.split ? 'Seated across multiple tables' : 'Seated together'}</strong></div>
                  </div>
                  <div className="eh-manage-dietary"><h4>Dietary requirements</h4><RequirementSummary requirements={selected.requirements} /></div>
                  <div className="eh-edit-actions">
                    <Link className="eh-edit-cancel" to={`/book/confirmation/${selected.id}`}
                      state={{ bookingListFilter: shownFilter }}>View full details</Link>
                    {shownFilter === 'upcoming' && canModifyBooking(selected) &&
                      <button className="eh-button eh-button--green" type="button" disabled={editLoading} onClick={beginEdit}>
                        {editLoading ? 'Loading…' : 'Change booking'} <span aria-hidden="true">→</span>
                      </button>}
                  </div>
                  {shownFilter === 'upcoming' && !canModifyBooking(selected) && <p className="eh-edit-policy">Changes are not allowed within 48 hours of the meal.</p>}
                  {shownFilter !== 'upcoming' && <p className="eh-edit-policy">Past and cancelled bookings are available for reference only.</p>}
                </section>}
            </div>}
          </div>}
      </section>
    </div>
  );
}
