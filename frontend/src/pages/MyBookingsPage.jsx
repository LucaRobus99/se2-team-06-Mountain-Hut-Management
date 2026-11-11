import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { getMyBookings } from '../api/booking.js';
import { bookingSummary, readableBookingDate, readableMeal } from '../utils/bookingList.js';
import heroImage from '../assets/edelweiss-my-bookings.jpg';
import '../styles/account-bookings.css';

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

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('upcoming');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  const loadBookings = useCallback(() => setReload((value) => value + 1), []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getMyBookings()
      .then((list) => { if (active) setBookings(list); })
      .catch((err) => {
        if (active) setError(err.status === 404 || err.status === 405
          ? 'Your bookings are not available yet. The booking history service has not been enabled.'
          : err.message || 'Unable to load your bookings.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);

  const groups = useMemo(() => bookingSummary(bookings), [bookings]);
  const visible = groups[filter];

  return (
    <div className="eh-my-bookings">
      <header className="eh-profile-hero eh-my-bookings-hero" style={{ backgroundImage: `url(${heroImage})` }}>
        <div className="eh-profile-hero-shade">
          <div className="eh-wide-wrap eh-profile-hero-inner">
            <p className="eh-profile-eyebrow">YOUR RESERVATIONS</p>
            <h1>My Bookings</h1>
            <p>View your upcoming visits, find past reservations and check any cancellations.</p>
          </div>
        </div>
      </header>

      <section className="eh-my-bookings-body eh-wide-wrap" aria-labelledby="my-bookings-heading">
        <div className="eh-my-bookings-head">
          <div>
            <h2 id="my-bookings-heading">Your bookings</h2>
            <p>Choose a category to see your reservations at Edelweiss Hut.</p>
          </div>
          <Link to="/availability" className="eh-button eh-button--green eh-bookings-new">+ New booking</Link>
        </div>

        <div className="eh-bookings-filters" role="group" aria-label="Filter bookings">
          {FILTERS.map((option) => (
            <button key={option.id} type="button"
              className={`eh-bookings-filter ${filter === option.id ? 'is-active' : ''}`}
              aria-pressed={filter === option.id} onClick={() => setFilter(option.id)}>
              {option.label} {!loading && !error && <span>{groups[option.id].length}</span>}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="eh-bookings-state" role="status">Loading your bookings…</div>
        ) : error ? (
          <div className="eh-bookings-state eh-bookings-state--error" role="alert">
            <h3>We couldn't load your bookings</h3><p>{error}</p>
            <button type="button" className="eh-button eh-button--green" onClick={loadBookings}>Try again</button>
          </div>
        ) : visible.length === 0 ? (
          <div className="eh-bookings-state">
            <div className="eh-bookings-state-icon" aria-hidden="true">✦</div>
            <h3>Nothing here yet</h3><p>{EMPTY_TEXT[filter]}</p>
            {filter === 'upcoming' && <Link to="/availability" className="eh-button eh-button--green">Book a table</Link>}
          </div>
        ) : (
          <div className="eh-bookings-list">
            {visible.map((booking) => (
              <article className="eh-booking-list-card" key={booking.id}>
                <div className="eh-booking-list-date" aria-label={`Booking date ${readableBookingDate(booking.slot.date)}`}>
                  <span className="eh-booking-list-day">{booking.slot.date.slice(8, 10)}</span>
                  <span>{new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(new Date(`${booking.slot.date}T12:00:00Z`))}</span>
                  <small>{booking.slot.date.slice(0,4)}</small>
                </div>
                <div className="eh-booking-list-details">
                  <div className="eh-booking-list-topline">
                    <h3>{readableMeal(booking.slot.meal) || 'Table booking'}</h3>
                    <span className={`eh-booking-list-status eh-booking-list-status--${filter}`}>
                      {filter === 'cancelled' ? 'Cancelled' : filter === 'past' ? 'Completed' : 'Confirmed'}
                    </span>
                  </div>
                  <p className="eh-booking-list-datetime">{readableBookingDate(booking.slot.date)} · {String(booking.slot.startTime).slice(0,5)}{booking.slot.endTime ? `–${String(booking.slot.endTime).slice(0,5)}` : ''}</p>
                  <div className="eh-booking-list-meta">
                    <span><strong>{booking.partySize}</strong> {booking.partySize === 1 ? 'guest' : 'guests'}</span>
                    <span>Booking #{booking.id}</span>
                    {booking.split && <span>Seating across multiple tables</span>}
                  </div>
                </div>
                {filter !== 'cancelled' && <Link className="eh-booking-list-action" to={`/book/confirmation/${booking.id}`}>View details <span aria-hidden="true">→</span></Link>}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
