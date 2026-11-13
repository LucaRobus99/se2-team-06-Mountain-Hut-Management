import { useEffect, useMemo, useRef, useState } from 'react';
import { AlpineDatePicker, AlpineMealSelect } from './AlpineBookingFields.jsx';
import AvailabilitySlotCard from './AvailabilitySlotCard.jsx';
import { getAvailableSlots, updateBooking, bookingErrorMessage } from '../api/booking.js';
import { validatePartyRequirements } from '../utils/partyRequirements.js';
import { readableBookingDate, readableMeal } from '../utils/bookingList.js';
import { buildBookingChanges, canModifyBooking, isValidModificationSlot, originalSlotOption } from '../utils/editBooking.js';

function todayInHut() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

const timeLabel = slot => `${String(slot.startTime).slice(0, 5)}–${String(slot.endTime).slice(0, 5)}`;

export default function EditBookingForm({ booking, onCancel, onSaved }) {
  const [date, setDate] = useState(booking.slot.date);
  const [meal, setMeal] = useState(booking.slot.meal);
  const [guests, setGuests] = useState(String(booking.partySize));
  const [selectedSlotId, setSelectedSlotId] = useState(booking.slot.id);
  const [requirements, setRequirements] = useState(() => (booking.requirements || []).map((r, id) => ({ ...r, id: id + 1 })));
  const nextRequirementId = useRef(requirements.length);
  const [available, setAvailable] = useState({ key: '', slots: [], loading: true, error: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const numberGuests = Number(guests);
  const validGuests = guests !== '' && Number.isSafeInteger(numberGuests) && numberGuests > 0;
  const queryKey = `${date}|${meal}|${guests}`;
  const canEdit = canModifyBooking(booking);

  // Reuse the same public search as Availability. Ignore out-of-date responses.
  useEffect(() => {
    let active = true;
    setAvailable({ key: '', slots: [], loading: true, error: '' });
    if (!date || !meal || !validGuests) {
      setAvailable({ key: queryKey, slots: [], loading: false, error: 'Enter a valid date, meal and guest count.' });
      return () => { active = false; };
    }
    const timer = setTimeout(() => {
      getAvailableSlots({ date, meal, partySize: numberGuests }).then(result => {
        if (!active) return;
        const slots = result.slots.filter(slot => isValidModificationSlot(date, slot.startTime));
        setAvailable({ key: queryKey, slots, loading: false, error: '' });
      }).catch(err => {
        if (active) setAvailable({ key: queryKey, slots: [], loading: false,
          error: err.message || 'Could not check available times.' });
      });
    }, 220);
    return () => { active = false; clearTimeout(timer); };
  }, [date, meal, numberGuests, validGuests, queryKey]);

  // The public search counts our own booking's seats as occupied. We must keep
  // its original slot selectable; the PATCH releases/reallocates them atomically.
  const currentOption = originalSlotOption(booking, { date, meal });
  const freshResults = available.key === queryKey;
  const choices = useMemo(() => {
    const fromSearch = freshResults ? available.slots : [];
    const combined = currentOption
      ? [{ ...currentOption, current: true }, ...fromSearch.filter(slot => slot.id !== currentOption.id)]
      : fromSearch;
    return combined.filter(slot => isValidModificationSlot(date, slot.startTime));
  }, [freshResults, available.slots, currentOption?.id, date, currentOption?.startTime]);

  const choiceIds = choices.map(slot => slot.id).join(',');
  useEffect(() => {
    if (!freshResults || available.loading) return;
    setSelectedSlotId(previous => {
      if (choices.some(slot => slot.id === previous)) return previous;
      // Never choose a different time automatically when changing date/meal.
      return currentOption && choices.some(slot => slot.id === currentOption.id) ? currentOption.id : null;
    });
  }, [freshResults, available.loading, choiceIds, currentOption?.id]);

  function changeSearch(setter, value) {
    setter(value);
    setSaveError('');
    if (setter === setDate && value !== date) setSelectedSlotId(null);
    if (setter === setMeal && value !== meal) setSelectedSlotId(null);
    // Changing guests can keep the same slot; server rechecks the seats on PATCH.
  }

  function addRequirement() {
    setRequirements(list => [...list, { id: ++nextRequirementId.current, description: '', allergies: false }]);
  }
  function changeRequirement(id, patch) {
    setRequirements(list => list.map(r => r.id === id ? { ...r, ...patch } : r));
  }
  function removeRequirement(id) { setRequirements(list => list.filter(r => r.id !== id)); }

  const selectedOption = choices.find(slot => slot.id === selectedSlotId);
  const requirementsError = validatePartyRequirements(requirements);
  const changes = selectedOption && validGuests && !requirementsError
    ? buildBookingChanges(booking, { slotId: selectedOption.id, partySize: numberGuests, requirements }) : {};
  const hasChanges = Object.keys(changes).length > 0;
  const needsCurrentSeatRecheck = selectedOption?.current && numberGuests !== booking.partySize;
  const checking = available.loading || !freshResults;
  const canSave = canEdit && !saving && !checking && Boolean(selectedOption) &&
    validGuests && !requirementsError && hasChanges;

  async function save(event) {
    event.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setSaveError('');
    try {
      const updated = await updateBooking(booking.id, changes);
      await onSaved(updated);
    } catch (err) {
      setSaveError(bookingErrorMessage(err));
    } finally { setSaving(false); }
  }

  return (
    <form className="eh-edit-panel" onSubmit={save} aria-label="Change booking">
      <p className="eh-edit-eyebrow">BOOKING #{booking.id}</p>
      <div className="eh-edit-title-row"><h3>Change booking</h3><span className="eh-edit-status">Confirmed</span></div>
      <p className="eh-edit-subtitle">Choose a new date, meal or guest count. Available times appear below.</p>
      <div className="eh-edit-current">
        <strong>Current booking</strong>
        <span>{readableBookingDate(booking.slot.date)} · {readableMeal(booking.slot.meal)} · {timeLabel(booking.slot)} · {booking.partySize} {booking.partySize === 1 ? 'guest' : 'guests'}</span>
      </div>

      <div className="eh-edit-fields eh-edit-search-fields">
        <div className="eh-edit-field"><label htmlFor="edit-date">Date</label>
          <AlpineDatePicker id="edit-date" value={date} minDate={todayInHut()} onChange={value => changeSearch(setDate, value)} required disabled={saving} />
        </div>
        <div className="eh-edit-field"><label htmlFor="edit-meal">Meal</label>
          <AlpineMealSelect id="edit-meal" value={meal} onChange={value => changeSearch(setMeal, value)} required disabled={saving} />
        </div>
        <div className="eh-edit-field"><label htmlFor="edit-guests">Guests</label>
          <input id="edit-guests" value={guests} type="number" min="1" step="1" onChange={event => changeSearch(setGuests, event.target.value)} disabled={saving} required />
        </div>
      </div>

      <section className="eh-edit-times" aria-label="Available meal slots">
        <div className="eh-edit-times-head">
          <h4>Available times</h4>
          <span>{checking ? 'Searching…' : !available.error ? `${choices.length} ${choices.length === 1 ? 'option' : 'options'}` : 'Check availability'}</span>
        </div>
        <div className={`eh-edit-availability${available.error ? ' is-warning' : ''}`} role="status" aria-live="polite">
          {checking ? 'Checking availability for your selection…'
            : available.error && !currentOption ? available.error
            : !choices.length ? 'No times available. Try another date, meal or guest count.'
            : needsCurrentSeatRecheck ? 'Your current time is kept. The new guest count will be checked when you save.'
            : `Choose one of the available slots for ${numberGuests} ${numberGuests === 1 ? 'guest' : 'guests'}. Final availability is checked when saving.`}
        </div>
        {available.error && currentOption && !checking &&
          <p className="eh-edit-small-warning">Other times could not be loaded. You can still request an update to your current time.</p>}
        {!checking && choices.length > 0 &&
          <div className="eh-slot-cards eh-edit-slot-cards">
            {choices.map((slot, index) => (
              <AvailabilitySlotCard key={slot.id} slot={slot} index={index} partySize={numberGuests}
                selected={slot.id === selectedSlotId} disabled={saving}
                availabilityText={slot.current ? 'Current time · seats verified on save' : 'Available for your group'}
                onClick={() => { setSelectedSlotId(slot.id); setSaveError(''); }} />
            ))}
          </div>}
        {selectedOption && !checking && <p className="eh-edit-time-selection">Selected: <strong>{timeLabel(selectedOption)}</strong>{selectedOption.current ? ' · your original time' : ''}</p>}
      </section>

      <div className="eh-edit-requirements-title"><h4>Dietary requirements</h4><span>Optional</span></div>
      {requirements.length === 0 && <p className="eh-edit-no-requirements">No dietary requirements saved.</p>}
      {requirements.map((requirement, index) => (
        <div className="eh-edit-requirement" key={requirement.id}>
          <label htmlFor={`edit-requirement-${requirement.id}`}>Requirement {index + 1}
            <input id={`edit-requirement-${requirement.id}`} value={requirement.description} maxLength={500}
              placeholder="e.g. 2 vegetarian guests" disabled={saving}
              onChange={event => changeRequirement(requirement.id, { description: event.target.value })} />
          </label>
          <label className="eh-edit-allergy"><input type="checkbox" checked={Boolean(requirement.allergies)} disabled={saving}
            onChange={event => changeRequirement(requirement.id, { allergies: event.target.checked })} /> Allergy</label>
          <button className="eh-edit-remove" type="button" disabled={saving} onClick={() => removeRequirement(requirement.id)} aria-label={`Remove requirement ${index + 1}`}>×</button>
        </div>
      ))}
      <button type="button" className="eh-edit-add" disabled={saving} onClick={addRequirement}>+ Add dietary requirement</button>
      {requirementsError && <p className="eh-edit-error" role="alert">{requirementsError}</p>}
      <p className="eh-edit-policy">Changes close 48 hours before the original or new meal. Your booking stays unchanged until you save.</p>
      {!canEdit && <p role="alert" className="eh-edit-error">This booking can no longer be modified.</p>}
      {saveError && <p role="alert" className="eh-edit-error">{saveError}</p>}
      <div className="eh-edit-actions">
        <button className="eh-edit-cancel" type="button" onClick={onCancel} disabled={saving}>Discard changes</button>
        <button className="eh-button eh-button--green" type="submit" disabled={!canSave}>{saving ? 'Saving…' : 'Save changes'} <span aria-hidden="true">→</span></button>
      </div>
    </form>
  );
}
