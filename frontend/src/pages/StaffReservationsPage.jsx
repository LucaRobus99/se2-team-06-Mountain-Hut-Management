import { useEffect, useRef, useState } from 'react';
import { AlpineDatePicker, AlpineMealSelect } from '../components/AlpineBookingFields.jsx';
import AvailabilitySlotCard from '../components/AvailabilitySlotCard.jsx';
import SplitSeatingModal from '../components/SplitSeatingModal.jsx';
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

function Section({ number, title, description, children }) {
  return <section className="staff-panel sr-section">
    <div className="sr-section-heading"><span className="sr-number">{number}</span><div><h2>{title}</h2><p>{description}</p></div></div>
    {children}
  </section>;
}

function ContactField({ field, label, value, onChange, required, type = 'text', maxLength, placeholder }) {
  return <div className="eh-edit-field"><label htmlFor={`sr-${field}`}>{label}{required ? ' *' : ' · Optional'}</label>
    <input id={`sr-${field}`} type={type} value={value} required={required} maxLength={maxLength} placeholder={placeholder} onChange={e => onChange(field, e.target.value)} />
  </div>;
}

function ReservationReceipt({ receipt, onNew }) {
  const [reveal, setReveal] = useState(false);
  const [copied, setCopied] = useState(false);
  const { slot, initialPassword, confirmationEmail } = receipt;
  return <section className="staff-panel sr-receipt" aria-label="Reservation confirmed">
    <span className="sr-success-mark" aria-hidden="true">✓</span>
    <p className="sr-kicker">RESERVATION CONFIRMED</p>
    <h2>You're all set.</h2>
    <p>Booking #{receipt.id} · {receipt.contactName || receipt.account?.name}</p>
    <div className="sr-receipt-facts">
      <div><span>Date</span><strong>{readableBookingDate(slot.date)}</strong></div>
      <div><span>Meal &amp; time</span><strong>{readableMeal(slot.meal)} · {slot.startTime}–{slot.endTime}</strong></div>
      <div><span>Guests</span><strong>{receipt.partySize}</strong></div>
    </div>
    {receipt.split && <p className="sr-receipt-note">Table split: {receipt.seatAssignments?.map(item => item.seats).join(' + ') || 'Multiple tables'}</p>}
    {receipt.requirements?.length > 0 && <div className="sr-receipt-requirements"><h3>Dietary requirements</h3>
      {receipt.requirements.map((r, i) => <div key={i} className={r.allergies ? 'sr-allergy-note' : ''}>{r.description}{r.allergies && <small>Allergy · special care required</small>}</div>)}
    </div>}
    <p className="sr-receipt-note" role="status">{confirmationEmail?.status === 'sent' ? 'Confirmation email accepted for delivery.' : confirmationEmail?.status === 'failed' ? 'Reservation saved. The email could not be sent.' : 'Reservation saved. No confirmation email was sent.'}</p>
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
  const guestReady = mode === 'existingHiker' ? Boolean(hiker) : Boolean(contact.name.trim()) &&
    (mode === 'guest' ? (!contact.email || validEmail(contact.email)) && (!contact.phone || validPhone(contact.phone)) : validEmail(contact.email) && validPhone(contact.phone));
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
    setMode(value); setQuery(''); setHiker(null); setContact(emptyContact());
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
  const updateContact = (field, value) => { setContact(previous => ({ ...previous, [field]: value })); setError(''); };
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
    setReceipt(null); setMode('existingHiker'); setContact(emptyContact()); updateQuery('');
    clearSelection(); setRequirements([]); setError(''); setSearched(false); setAvailability({ key: '', slots: [], error: '' });
    setDate(today()); setMeal('lunch'); setGuests('2');
  }

  return <div className="staff-page sr-page">
    <div className="staff-page-heading"><div><p className="staff-eyebrow">GUEST SERVICES</p><h1>Reservations</h1><p>Welcome guests arriving by phone, message or in person.</p></div><span className="staff-heading-pill">Staff-assisted booking</span></div>
    {receipt ? <ReservationReceipt receipt={receipt} onNew={newReservation} /> : <form className="sr-form" onSubmit={submit} noValidate>
      <fieldset className="sr-fieldset" disabled={saving}>
        <Section number="01" title="Guest information" description="Choose who this reservation is for.">
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
              <ContactField field="name" label="Full name" value={contact.name} onChange={updateContact} required maxLength={100} placeholder="Guest's full name" />
              <ContactField field="phone" label="Mobile number" type="tel" value={contact.phone} onChange={updateContact} required={mode === 'newHiker'} maxLength={30} placeholder="+39 …" />
              <ContactField field="email" label="Email" type="email" value={contact.email} onChange={updateContact} required={mode === 'newHiker'} maxLength={255} placeholder="guest@email.com" />
              {mode === 'newHiker' && <><ContactField field="emergencyContact" label="Emergency contact" value={contact.emergencyContact} onChange={updateContact} maxLength={200} /><div className="eh-edit-field sr-wide"><label htmlFor="sr-notes">Notes · Optional</label><textarea id="sr-notes" rows={2} maxLength={1000} value={contact.notes} onChange={e => updateContact('notes', e.target.value)} /></div></>}
            </div>
            <p className="sr-help">{mode === 'guest' ? 'A temporary guest cannot log in to the website. Email is optional for the booking confirmation.' : 'An initial password is generated automatically and must be changed at first login.'}</p>
          </>}
        </Section>
        <Section number="02" title="Reservation details" description="Select a date, meal and party size to find available times.">
          <div className="sr-search-fields eh-edit-search-fields">
            <div className="eh-edit-field"><label htmlFor="sr-date">Date</label><AlpineDatePicker id="sr-date" value={date} minDate={today()} onChange={v => changeSearch(setDate, v, date)} required /></div>
            <div className="eh-edit-field"><label htmlFor="sr-meal">Meal</label><AlpineMealSelect id="sr-meal" value={meal} onChange={v => changeSearch(setMeal, v, meal)} required /></div>
            <div className="eh-edit-field"><label htmlFor="sr-guests">Guests</label><input id="sr-guests" type="number" min="1" step="1" value={guests} onChange={e => changeSearch(setGuests, e.target.value, guests)} required /></div>
            <button className="eh-button eh-button--green sr-find" type="button" disabled={!validSearch || checking} onClick={findAvailability}>{checking ? 'Searching…' : 'Find availability'} <span aria-hidden="true">↗</span></button>
          </div>
          {searched && <div className="eh-edit-times sr-times">
            <div className="eh-edit-times-head"><h4>Available times</h4><span>{checking ? 'Searching…' : `${slots.length} ${slots.length === 1 ? 'option' : 'options'}`}</span></div>
            <div className={`eh-edit-availability${availability.error && !checking ? ' is-warning' : ''}`} role="status">
              {!validSearch ? 'Enter a valid date, meal and guest count.' : checking ? 'Checking availability…' : availability.error || (!slots.length ? 'No times available. Try another date, meal or guest count.' : 'Choose one of the available slots.')}
              {slots.length > 0 && <span className="eh-edit-availability-note">Availability is updated as you edit. Final seats are checked when confirming.</span>}
            </div>
            {!!slots.length && <div className="eh-slot-cards eh-edit-slot-cards sr-slots">{slots.map((slot, index) => <AvailabilitySlotCard key={slot.id} slot={slot} index={index} partySize={partySize} selected={selection?.slot.id === slot.id} disabled={checkingSeating || saving} onClick={() => selectSlot(slot)} />)}</div>}
            {checkingSeating && <p className="sr-help" role="status">Checking seating…</p>}
          </div>}
          <p className="sr-help sr-time-policy">Staff may reserve up to the start of the selected time slot.</p>
        </Section>
        <Section number="03" title="Dietary requirements" description="Optional · Help the kitchen prepare for the group.">
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
      <SplitSeatingModal show={Boolean(pendingSplit)} seating={pendingSplit?.seating} onCancel={() => setPendingSplit(null)} onContinue={() => { setSelection(pendingSplit); setPendingSplit(null); }} />
    </form>}
  </div>;
}
