import { useEffect, useRef, useState } from 'react';
import { AlpineDatePicker, AlpineMealSelect } from '../components/AlpineBookingFields.jsx';
import AvailabilitySlotCard from '../components/AvailabilitySlotCard.jsx';
import SlotAvailabilityState from '../components/SlotAvailabilityState.jsx';
import SplitSeatingModal from '../components/SplitSeatingModal.jsx';
import DietaryRequirementsSummary from '../components/DietaryRequirementsSummary.jsx';
import { searchStaffHikers, getStaffAvailability, getStaffSeating, createStaffBooking } from '../api/booking.js';
import { validatePartyRequirements } from '../utils/partyRequirements.js';
import { readableBookingDate, readableMeal } from '../utils/bookingList.js';
import '../styles/staff-reservations.css';

const MODES = [
  ['existingHiker', 'Existing hiker', 'Find a registered guest'],
  ['guest', 'Temporary guest', 'Quick reservation, no account'],
  ['newHiker', 'New hiker', 'Create a complete account'],
];
const emptyContact = () => ({ name: '', email: '', phone: '', notes: '', emergencyContact: '' });
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
const validPhone = value => /^[+\d\s().-]+$/.test(value) && value.replace(/\D/g, '').length >= 6;

function validateContact(contact, mode) {
  const errors = {};
  const account = mode === 'newHiker';
  const name = contact.name.trim(), email = contact.email.trim(), phone = contact.phone.trim();
  if (!name) errors.name = 'Enter the guest’s full name.';
  else if (name.length > 100) errors.name = 'Use 100 characters or fewer.';
  if (account && !email) errors.email = 'Enter the guest’s email address.';
  else if (email && (email.length > 255 || !validEmail(email))) errors.email = 'Enter a valid email address.';
  if (account && !phone) errors.phone = 'Enter the guest’s mobile number.';
  else if (phone && (phone.length > 30 || !validPhone(phone))) errors.phone = 'Enter a valid number with at least 6 digits.';
  if (account && contact.emergencyContact.trim().length > 200) errors.emergencyContact = 'Use 200 characters or fewer.';
  if (account && contact.notes.trim().length > 1000) errors.notes = 'Use 1000 characters or fewer.';
  return errors;
}

function Section({ number, title, description, children, className = '' }) {
  return <section className={`staff-panel sr-section ${className}`}>
    <div className="sr-section-heading"><span className="sr-number">{number}</span><div><h2>{title}</h2><p>{description}</p></div></div>
    {children}
  </section>;
}

function ContactField({ field, label, value, onChange, onBlur, error, required, type = 'text', maxLength, placeholder }) {
  return <div className="eh-edit-field"><label htmlFor={`sr-${field}`}>{label}{required ? ' *' : ' · Optional'}</label>
    <input id={`sr-${field}`} type={type} value={value} required={required} maxLength={maxLength} placeholder={placeholder} autoComplete="off" onChange={e => onChange(field, e.target.value)} onBlur={() => onBlur(field)} aria-invalid={Boolean(error)} aria-describedby={error ? `sr-${field}-error` : undefined} />
    {error && <span id={`sr-${field}-error`} className="staff-field-error" role="alert">{error}</span>}
  </div>;
}

function ReservationReceipt({ receipt, onNew }) {
  const [reveal, setReveal] = useState(false);
  const [copied, setCopied] = useState(false);
  const { slot, initialPassword, confirmationEmail } = receipt;
  return <section className="staff-panel sr-receipt" aria-label="Reservation confirmed">
    <span className="sr-success-mark" aria-hidden="true">✓</span>
    <p className="sr-kicker">RESERVATION CONFIRMED</p>
    <h2>Reservation created successfully.</h2>
    <p>Booking #{receipt.id} · {receipt.contactName || receipt.account?.name}</p>
    <div className="sr-receipt-facts">
      <div><span>Date</span><strong>{readableBookingDate(slot.date)}</strong></div>
      <div><span>Meal &amp; time</span><strong>{readableMeal(slot.meal)} · {slot.startTime}–{slot.endTime}</strong></div>
      <div><span>Guests</span><strong>{receipt.partySize}</strong></div>
    </div>
    {receipt.split && <p className="sr-receipt-note">Table split: {receipt.seatAssignments?.map(item => item.seats).join(' + ') || 'Multiple tables'}. Confirm the seating arrangement with the guest.</p>}
    {receipt.requirements?.length > 0 && <div className="sr-receipt-requirements"><h3>Dietary requirements</h3>
      <DietaryRequirementsSummary requirements={receipt.requirements} />
    </div>}
    <p className={`sr-receipt-note eh-booking-email-notice eh-booking-email-notice--${confirmationEmail?.status || 'unknown'}`} role="status">{confirmationEmail?.status === 'sent' ? 'Confirmation email sent to the guest.' : confirmationEmail?.status === 'failed' ? `Reservation saved. The email could not be sent. Give the guest booking reference #${receipt.id}.` : `Reservation saved. No confirmation email was sent. Give the guest booking reference #${receipt.id}.`}</p>
    {initialPassword && <div className="sr-credentials">
      <h3>New hiker account</h3><p>Communicate this temporary password privately to the guest. It is displayed only here and must be changed at first login.</p>
      <span className="sr-account-email">{receipt.account?.email}</span>
      <div className="sr-password-row"><code>{reveal ? initialPassword : '••••••••••••'}</code>
        <button type="button" className="eh-edit-cancel" onClick={() => setReveal(v => !v)}>{reveal ? 'Hide' : 'Show password'}</button>
        <button type="button" className="eh-edit-cancel" onClick={async () => { try { await navigator.clipboard.writeText(initialPassword); setCopied(true); } catch { setReveal(true); } }}>{copied ? 'Copied' : 'Copy'}</button>
      </div>
    </div>}
    <button type="button" className="eh-button eh-button--green" onClick={onNew}>Create another reservation →</button>
  </section>;
}

export default function StaffReservationsPage() {
  const [mode, setMode] = useState('existingHiker');
  const [contact, setContact] = useState(emptyContact);
  const [touched, setTouched] = useState({});
  const [query, setQuery] = useState('');
  const [hiker, setHiker] = useState(null);
  const [lookup, setLookup] = useState({ loading: false, searched: false, results: [], error: '' });
  const [date, setDate] = useState(today);
  const [meal, setMeal] = useState('lunch');
  const [guests, setGuests] = useState('2');
  const [searched, setSearched] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [availability, setAvailability] = useState({ key: '', slots: [], error: '' });
  const [selection, setSelection] = useState(null);
  const [pendingSplit, setPendingSplit] = useState(null);
  const [checkingSeating, setCheckingSeating] = useState(false);
  const [requirements, setRequirements] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState(null);
  const nextId = useRef(0);
  const seatRequest = useRef(0);
  const lookupRequest = useRef(0);
  const submitting = useRef(false);
  const partySize = Number(guests);
  const validSearch = Boolean(date && meal && guests && Number.isSafeInteger(partySize) && partySize > 0);
  const key = `${date}|${meal}|${guests}|${refresh}`;
  const checking = searched && validSearch && availability.key !== key;
  const slots = searched && !checking && availability.key === key ? availability.slots : [];
  const requirementsError = validatePartyRequirements(requirements);
  const contactErrors = validateContact(contact, mode);
  const guestReady = mode === 'existingHiker' ? Boolean(hiker) : !Object.keys(contactErrors).length;
  const touchField = field => setTouched(previous => ({ ...previous, [field]: true }));
  const contactProps = field => ({ field, value: contact[field], onChange: updateContact, onBlur: touchField, error: touched[field] ? contactErrors[field] : '' });
  const canSubmit = guestReady && selection && !checking && !checkingSeating && !pendingSplit && !saving && !requirementsError;

  useEffect(() => {
    if (!searched || !validSearch) return;
    let active = true;
    const timer = setTimeout(() => {
      getStaffAvailability({ date, meal, partySize }).then(data => {
        if (active) setAvailability({ key, slots: data.slots, error: '' });
      }).catch(err => {
        if (active) setAvailability({ key, slots: [], error: err.message });
      });
    }, 220);
    return () => { active = false; clearTimeout(timer); };
  }, [searched, validSearch, key, date, meal, partySize]);

  function clearSelection() {
    seatRequest.current += 1;
    setSelection(null); setPendingSplit(null); setCheckingSeating(false);
  }
  function changeSearch(setter, value, previous) {
    if (value === previous) return;
    setter(value); clearSelection(); setError(''); setRefresh(v => v + 1);
  }
  function findAvailability() {
    if (!validSearch || saving) return;
    clearSelection(); setError(''); setSearched(true); setRefresh(v => v + 1);
  }
  function changeMode(value) {
    if (value === mode) return;
    lookupRequest.current += 1;
    setMode(value); setQuery(''); setHiker(null); setContact(emptyContact()); setTouched({});
    setLookup({ loading: false, searched: false, results: [], error: '' }); setError('');
  }
  function updateQuery(value) {
    lookupRequest.current += 1; setQuery(value); setHiker(null);
    setLookup({ loading: false, searched: false, results: [], error: '' });
  }
  async function findHiker() {
    if (query.trim().length < 2) return;
    const request = ++lookupRequest.current;
    setHiker(null); setLookup({ loading: true, searched: true, results: [], error: '' });
    try {
      const data = await searchStaffHikers(query);
      if (request === lookupRequest.current) setLookup({ loading: false, searched: true, results: data.hikers, error: '' });
    } catch (err) {
      if (request === lookupRequest.current) setLookup({ loading: false, searched: true, results: [], error: err.message });
    }
  }
  async function selectSlot(slot) {
    if (saving || checking || checkingSeating || selection?.slot.id === slot.id) return;
    clearSelection(); setError('');
    const request = seatRequest.current;
    setCheckingSeating(true);
    try {
      const seating = await getStaffSeating({ slotId: slot.id, partySize });
      if (request !== seatRequest.current) return;
      const option = { slot, seating };
      if (seating.requiresConfirmation || seating.fit === 'split') setPendingSplit(option);
      else setSelection(option);
    } catch (err) {
      if (request === seatRequest.current) setError(err.message);
    } finally {
      if (request === seatRequest.current) setCheckingSeating(false);
    }
  }
  function updateContact(field, value) { setContact(previous => ({ ...previous, [field]: value })); setError(''); }
  async function submit(event) {
    event.preventDefault();
    if (!canSubmit || submitting.current) return;
    submitting.current = true;
    setSaving(true); setError('');
    try {
      const owner = mode === 'existingHiker' ? { hikerId: hiker.id } : mode === 'guest'
        ? { contactName: contact.name.trim(), ...(contact.phone.trim() ? { contactNumber: contact.phone.trim() } : {}), ...(contact.email.trim() ? { email: contact.email.trim() } : {}) }
        : { name: contact.name.trim(), email: contact.email.trim(), phone: contact.phone.trim(), notes: contact.notes.trim(), emergencyContact: contact.emergencyContact.trim() };
      const result = await createStaffBooking({ mode, slotId: selection.slot.id, partySize, ...owner, requirements, expectedSeating: selection.seating.fit });
      setReceipt(result);
      window.scrollTo(0, 0);
    } catch (err) {
      setError(err.details?.[0]?.message || err.message || 'Unable to create this reservation.');
      if (['SEATING_CHANGED', 'INSUFFICIENT_CAPACITY', 'SLOT_ALREADY_STARTED', 'SLOT_NOT_AVAILABLE', 'SLOT_NOT_FOUND'].includes(err.code)) {
        clearSelection(); setRefresh(v => v + 1);
      }
    } finally { submitting.current = false; setSaving(false); }
  }
  function newReservation() {
    setReceipt(null); setMode('existingHiker'); setContact(emptyContact()); setTouched({}); updateQuery('');
    clearSelection(); setRequirements([]); setError(''); setSearched(false); setAvailability({ key: '', slots: [], error: '' });
    setDate(today()); setMeal('lunch'); setGuests('2');
  }

  return <div className="staff-page sr-page">
    <div className="staff-page-heading"><div><p className="staff-eyebrow">GUEST SERVICES</p><h1>Reservations</h1><p>Create a reservation on behalf of a guest, by phone, message or in person.</p></div><span className="staff-heading-pill">Staff-assisted booking</span></div>
    {receipt ? <ReservationReceipt receipt={receipt} onNew={newReservation} /> : <form className="sr-form" onSubmit={submit} noValidate>
      <fieldset className="sr-fieldset" disabled={saving}>
        <Section number="01" title="Guest information" description="Select the guest type and collect the guest’s contact details.">
          <div className="sr-modes" role="group" aria-label="Guest type">
            {MODES.map(([value, title, note]) => <button key={value} type="button" className={`sr-mode${mode === value ? ' is-active' : ''}`} aria-pressed={mode === value} onClick={() => changeMode(value)}>
              <span className="sr-radio-dot" aria-hidden="true" /><strong>{title}</strong><small>{note}</small>
            </button>)}
          </div>
          {mode === 'existingHiker' ? <>
            <label className="sr-label" htmlFor="sr-hiker-search">Find a hiker</label>
            <div className="sr-search"><input id="sr-hiker-search" value={query} maxLength={100} placeholder="Name, email or phone number" onChange={e => updateQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void findHiker(); } }} />
              <button type="button" className="eh-edit-cancel" disabled={query.trim().length < 2 || lookup.loading} onClick={findHiker}>{lookup.loading ? 'Searching…' : 'Search'}</button></div>
            {lookup.error && <p className="eh-edit-error" role="alert">{lookup.error}</p>}
            {lookup.searched && !lookup.loading && !lookup.error && !lookup.results.length && <p className="sr-help" role="status">No matching hikers. Try another search or choose a new or temporary guest.</p>}
            <div className="sr-hikers">{lookup.results.map(person => <button type="button" key={person.id} className={`sr-hiker${hiker?.id === person.id ? ' is-selected' : ''}`} aria-pressed={hiker?.id === person.id} onClick={() => { setHiker(person); setError(''); }}>
              <strong>{person.name}</strong><span>{person.email}{person.phone ? ` · ${person.phone}` : ''}</span><small>{hiker?.id === person.id ? 'Selected' : 'Select guest'}</small>
            </button>)}</div>
          </> : <>
            <div className="sr-contact-grid">
              <ContactField {...contactProps('name')} label="Full name" required maxLength={100} placeholder="Guest's full name" />
              <ContactField {...contactProps('phone')} label="Mobile number" type="tel" required={mode === 'newHiker'} maxLength={30} placeholder="+39 345 123 4567" />
              <ContactField {...contactProps('email')} label="Email" type="email" required={mode === 'newHiker'} maxLength={255} placeholder="guest@email.com" />
              {mode === 'newHiker' && <><ContactField {...contactProps('emergencyContact')} label="Emergency contact" maxLength={200} placeholder="Name and mobile number" /><div className="eh-edit-field sr-wide"><label htmlFor="sr-notes">Notes · Optional</label><textarea id="sr-notes" rows={2} maxLength={1000} placeholder="e.g. mountain guide, preferred contact time, helpful details for bookings" value={contact.notes} onChange={e => updateContact('notes', e.target.value)} onBlur={() => touchField('notes')} aria-invalid={Boolean(touched.notes && contactErrors.notes)} aria-describedby={touched.notes && contactErrors.notes ? 'sr-notes-error' : undefined} />{touched.notes && contactErrors.notes && <span id="sr-notes-error" className="staff-field-error" role="alert">{contactErrors.notes}</span>}</div></>}
            </div>
            <p className="sr-help">{mode === 'guest' ? 'A temporary guest cannot log in to the website. Collect an email address if the guest wants a booking confirmation by email.' : 'A temporary password is generated automatically. Share it privately with the guest, who must change it at first login.'}</p>
          </>}
        </Section>
        <Section number="02" title="Reservation details" description="Ask the guest for their preferred date, meal and party size, then check availability.">
          <div className="sr-search-fields eh-edit-search-fields">
            <div className="eh-edit-field"><label htmlFor="sr-date">Date</label><AlpineDatePicker id="sr-date" value={date} minDate={today()} onChange={v => changeSearch(setDate, v, date)} required /></div>
            <div className="eh-edit-field"><label htmlFor="sr-meal">Meal</label><AlpineMealSelect id="sr-meal" value={meal} onChange={v => changeSearch(setMeal, v, meal)} required /></div>
            <div className="eh-edit-field"><label htmlFor="sr-guests">Guests</label><input id="sr-guests" type="number" min="1" step="1" value={guests} onChange={e => changeSearch(setGuests, e.target.value, guests)} required /></div>
            <button className="eh-button eh-button--green sr-find" type="button" disabled={!validSearch || checking} onClick={findAvailability}>{checking ? 'Searching…' : 'Find availability'} <span aria-hidden="true">↗</span></button>
          </div>
          {searched && <section className="eh-edit-times sr-times" aria-label="Available meal slots">
            <SlotAvailabilityState checking={checking} error={!validSearch ? 'Enter a valid date, meal and guest count.' : availability.error}
              empty={!slots.length} onRetry={validSearch && !saving ? findAvailability : undefined} />
            {!!slots.length && <div className="eh-slot-cards eh-edit-slot-cards sr-slots">{slots.map((slot, index) => <AvailabilitySlotCard key={slot.id} slot={slot} index={index} partySize={partySize} staff selected={selection?.slot.id === slot.id} disabled={checkingSeating || saving} onClick={() => selectSlot(slot)} />)}</div>}
            {checkingSeating && <p className="sr-help" role="status">Checking seating…</p>}
          </section>}
          <p className="sr-help sr-time-policy">Staff may reserve up to the start of the selected time slot.</p>
        </Section>
        <Section number="03" title="Dietary requirements" description="Optional · Ask the guest about dietary needs and allergies for the group." className="sr-dietary-section">
          {!requirements.length && <p className="eh-edit-no-requirements">No dietary requirements added.</p>}
          {requirements.map((item, index) => <div className="eh-edit-requirement" key={item.id}>
            <div className="eh-edit-requirement-head"><label htmlFor={`sr-requirement-${item.id}`}>Requirement {index + 1}</label><button type="button" className="eh-edit-remove" aria-label={`Remove requirement ${index + 1}`} onClick={() => setRequirements(list => list.filter(r => r.id !== item.id))}>Remove</button></div>
            <textarea id={`sr-requirement-${item.id}`} rows={2} maxLength={500} placeholder="e.g. 2 vegetarian guests" value={item.description} onChange={e => setRequirements(list => list.map(r => r.id === item.id ? { ...r, description: e.target.value } : r))} />
            <label className={`eh-edit-allergy${item.allergies ? ' is-checked' : ''}`}><input type="checkbox" checked={item.allergies} onChange={e => setRequirements(list => list.map(r => r.id === item.id ? { ...r, allergies: e.target.checked } : r))} /> <span>Allergy</span></label>
          </div>)}
          <button className="eh-edit-add" type="button" onClick={() => setRequirements(list => [...list, { id: ++nextId.current, description: '', allergies: false }])}>+ Add dietary requirement</button>
          {requirementsError && <p className="eh-edit-error eh-edit-requirements-error" role="alert">{requirementsError}</p>}
        </Section>
        <div className="staff-panel sr-submit-panel">
          {error && <p className="eh-edit-error" role="alert">{error}</p>}
          <div className="sr-submit-row"><div><strong>{mode === 'existingHiker' ? hiker?.name || 'Select a guest' : contact.name || 'Enter guest details'}</strong><p>{selection ? `${readableBookingDate(date)} · ${readableMeal(meal)} · ${selection.slot.startTime}–${selection.slot.endTime} · ${partySize} guests` : 'Choose an available time to continue.'}</p></div><button type="submit" className="eh-button eh-button--green" disabled={!canSubmit}>{saving ? 'Confirming…' : 'Confirm reservation'} →</button></div>
        </div>
      </fieldset>
      <SplitSeatingModal staff show={Boolean(pendingSplit)} seating={pendingSplit?.seating} onCancel={() => setPendingSplit(null)} onContinue={() => { setSelection(pendingSplit); setPendingSplit(null); }} />
    </form>}
  </div>;
}
