import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import { AlpineDatePicker, AlpineMealSelect } from '../components/AlpineBookingFields.jsx';
import heroImage from '../assets/edelweiss-hero.png';
import hutImage from '../assets/edelweiss-terrace.jpg';
import findUsImage from '../assets/edelweiss-dolomites.png';

const meals = [
  ['breakfast', 'Breakfast'],
  ['lunch', 'Lunch'],
  ['aperitivo', 'Happy hour'],
  ['dinner', 'Dinner']
];

function todayInItaly() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
}

function tomorrowInItaly() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map(p => [p.type, p.value]));
  const utc = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + 1));
  return utc.toISOString().slice(0, 10);
}

function CalendarIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></svg>;
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.5"/><path d="m16 16 5 5"/></svg>;
}

function CutleryIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 3v8M8 3v8M6 3v18M4 11h4M16 3c-3.5 3.3-4 8-1 10h3V3M18 13v8"/></svg>;
}

function FlowerDecoration() {
  return (
    <svg className="eh-search-flower" viewBox="0 0 130 140" aria-hidden="true">
      <g transform="translate(73 51)" stroke="currentColor" strokeWidth="1.25" fill="none">
        {[0,45,90,135,180,225,270,315].map(angle => (
          <ellipse key={angle} cx="0" cy="-20" rx="9" ry="24" transform={`rotate(${angle})`} />
        ))}
        <circle r="8" />
        <circle r="3" />
      </g>
      <path d="M72 63c1 21 5 45 10 74m-7-39c-21-12-29-23-34-28 2 18 12 29 35 35m5 9c21-9 30-20 37-33-17 4-27 15-37 39" fill="none" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [date, setDate] = useState(tomorrowInItaly());
  const [meal, setMeal] = useState('lunch');
  const [partySize, setPartySize] = useState('2');
  const [formError, setFormError] = useState('');

  const bookDestination = user?.role === 'hiker' ? '/book' : '/availability';

  function handleSearch(event) {
    event.preventDefault();
    const guests = Number(partySize);
    if (!date || date < todayInItaly() || !meals.some(([value]) => value === meal) || !Number.isInteger(guests) || guests < 1) {
      setFormError('Please choose a valid date, meal and number of guests.');
      return;
    }
    setFormError('');
    const params = new URLSearchParams({ date, meal, guests: String(guests) });
    navigate(`/availability?${params.toString()}`);
  }

  return (
    <div className="eh-home">
      <section className="eh-hero" style={{ backgroundImage: `url(${heroImage})` }} aria-label="Welcome to Edelweiss Hut">
        <div className="eh-wide-wrap eh-hero-inner">
          <div className="eh-hero-copy">
            <p className="eh-eyebrow eh-hero-eyebrow"><span className="eh-kicker-line" /> Seceda · Dolomites, Italy</p>
            <h1>Take a break<br/>at Edelweiss Hut.</h1>
            <p className="eh-hero-subtitle">Find a table and make your hike even better.</p>
            <div className="eh-hero-actions">
              <Link to={bookDestination} className="eh-button eh-button--green eh-hero-button"><CalendarIcon/> Book a table</Link>
              <Link to="/menu" className="eh-button eh-button--cream eh-hero-button"><CutleryIcon/> Our menu</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="eh-search-section" aria-labelledby="eh-availability-title">
        <div className="eh-wide-wrap">
          <div className="eh-search-card">
            <div className="eh-search-heading">
              <div className="eh-big-calendar"><CalendarIcon /></div>
              <div>
                <h2 id="eh-availability-title">Check availability</h2>
                <p>See available meal slots and plan your visit.</p>
              </div>
            </div>
            <form className="eh-search-form" onSubmit={handleSearch}>
              <div className="eh-field">
                <label htmlFor="eh-date">Date</label>
                <AlpineDatePicker id="eh-date" required value={date} minDate={todayInItaly()} onChange={setDate} />
              </div>
              <div className="eh-field">
                <label htmlFor="eh-meal">Meal</label>
                <AlpineMealSelect id="eh-meal" required value={meal} onChange={setMeal} />
              </div>
              <div className="eh-field eh-field--guests">
                <label htmlFor="eh-guests">Guests</label>
                <input id="eh-guests" type="number" min="1" step="1" required value={partySize} onChange={event => setPartySize(event.target.value)} />
              </div>
              <button type="submit" className="eh-button eh-button--green eh-search-button"><SearchIcon /> Search</button>
              {formError && <p className="eh-form-error" role="alert">{formError}</p>}
            </form>
            <FlowerDecoration />
          </div>
        </div>
      </section>

      <div className="eh-wide-wrap eh-home-information">
        <section className="eh-feature" aria-labelledby="eh-our-hut-title">
          <img src={hutImage} alt="Wooden Edelweiss Hut sign with a mountain backdrop" loading="lazy" />
          <div className="eh-feature-copy">
            <p className="eh-eyebrow">Our hut <span className="eh-label-line" /></p>
            <h2 id="eh-our-hut-title">A little pause, a lasting memory.</h2>
            <p>Some of the best mountain moments happen around a table. Come in from the trail, share something delicious and enjoy the view a little longer.</p>
            <Link to="/about" className="eh-text-button">
              Discover our Hut <span className="eh-button-arrow" aria-hidden="true">↗</span>
            </Link>
          </div>
        </section>

        <section className="eh-feature eh-feature--reverse" aria-labelledby="eh-find-us-title">
          <div className="eh-feature-copy">
            <p className="eh-eyebrow">Find us <span className="eh-label-line" /></p>
            <h2 id="eh-find-us-title">The view is part of the experience.</h2>
            <p>Find us in the Seceda area, above Val Gardena, where mountain paths and ski slopes meet. Plan your way up before visiting: access varies by season and weather.</p>
            <Link to="/about" className="eh-text-button">
              How to reach us <span className="eh-button-arrow" aria-hidden="true">↗</span>
            </Link>
          </div>
          <img src={findUsImage} alt="Open alpine meadows and mountain peaks in the Dolomites" loading="lazy" />
        </section>
      </div>
    </div>
  );
}
