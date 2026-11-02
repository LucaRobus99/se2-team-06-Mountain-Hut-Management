import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Spinner } from 'react-bootstrap';
import { createStaffSlot, listStaffSlots, mealLabel, todayInHut } from '../api/slots.js';
import StaffDatePicker from '../components/StaffDatePicker.jsx';
import StaffSelect from '../components/StaffSelect.jsx';
import StaffTimePicker from '../components/StaffTimePicker.jsx';

const MEALS = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'aperitivo', label: 'Aperitivo' },
  { value: 'dinner', label: 'Dinner' },
];
const emptyTable = (id) => ({ rowId: id, tableIdentifier: `T${id}`, seats: '4' });
const isValidTime = (time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
const dayBefore = (date) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
};
const capacity = (tables) => tables.reduce((sum, table) => sum + (Number(table.seats) || 0), 0);
const formatDate = (date) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));

function Field({ id, label, hint, error, children }) {
  return (
    <div className="staff-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <small>{hint}</small>}
      {error && <span className="staff-field-error" role="alert">{error}</span>}
    </div>
  );
}

export default function SlotManagementPage() {
  const [viewDate, setViewDate] = useState(todayInHut);
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [listError, setListError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [date, setDate] = useState(todayInHut);
  const [startTime, setStartTime] = useState('12:00');
  const [endTime, setEndTime] = useState('13:00');
  const [meal, setMeal] = useState('lunch');
  const [mode, setMode] = useState('manual');
  const [tables, setTables] = useState([emptyTable(1), emptyTable(2)]);
  const [nextRowId, setNextRowId] = useState(3);
  const [sourceDate, setSourceDate] = useState(() => dayBefore(todayInHut()));
  const [sourceSlots, setSourceSlots] = useState([]);
  const [sourceId, setSourceId] = useState('');
  const [loadingSource, setLoadingSource] = useState(false);
  const [sourceError, setSourceError] = useState('');
  const [saving, setSaving] = useState(false);
  const [createdSlot, setCreatedSlot] = useState(null);
  const successRef = useRef(null);
  const scheduleRef = useRef(null);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (!viewDate) { setSlots([]); return; }
    let active = true;
    setLoadingSlots(true);
    setListError('');
    listStaffSlots(viewDate).then((data) => {
      if (active) setSlots(data.slots || []);
    }).catch((error) => { if (active) setListError(error.message); })
      .finally(() => { if (active) setLoadingSlots(false); });
    return () => { active = false; };
  }, [viewDate, refresh]);

  useEffect(() => {
    if (mode !== 'copy' || !sourceDate) return;
    let active = true;
    setLoadingSource(true);
    setSourceError('');
    setSourceId('');
    listStaffSlots(sourceDate).then((data) => {
      if (active) setSourceSlots(data.slots || []);
    }).catch((error) => {
      if (active) { setSourceSlots([]); setSourceError(error.message); }
    }).finally(() => { if (active) setLoadingSource(false); });
    return () => { active = false; };
  }, [mode, sourceDate]);

  const selectedSource = useMemo(() => sourceSlots.find((slot) => String(slot.id) === sourceId), [sourceSlots, sourceId]);
  const totalSeats = mode === 'manual' ? capacity(tables) : capacity(selectedSource?.tables || []);
  const tableCount = mode === 'manual' ? tables.length : selectedSource?.tables?.length || 0;

  function updateTable(rowId, field, value) {
    setTables((previous) => previous.map((table) => table.rowId === rowId ? { ...table, [field]: value } : table));
    setFieldErrors({});
  }
  function addTable() {
    setTables((previous) => [...previous, emptyTable(nextRowId)]);
    setNextRowId((n) => n + 1);
  }

  function validate() {
    const errors = {};
    if (!date) errors.date = 'Choose a date.';
    else if (date < todayInHut()) errors.date = 'Choose today or a future date.';
    if (!meal) errors.meal = 'Choose a meal type.';
    if (!isValidTime(startTime)) errors.startTime = 'Enter a valid time (HH:MM).';
    if (!isValidTime(endTime) || (isValidTime(startTime) && endTime <= startTime)) errors.endTime = 'The end must be after the start, on the same day.';
    if (mode === 'copy' && !selectedSource) errors.sourceId = 'Choose the slot whose tables you want to copy.';
    if (mode === 'manual') {
      const seen = new Set();
      tables.forEach((table, index) => {
        const name = table.tableIdentifier.trim();
        if (!name) errors[`table-${table.rowId}`] = 'Enter a table identifier.';
        else if (name.length > 50) errors[`table-${table.rowId}`] = 'Maximum 50 characters.';
        else if (seen.has(name)) errors[`table-${table.rowId}`] = 'Table identifiers must be unique in a slot.';
        seen.add(name);
        if (!Number.isSafeInteger(Number(table.seats)) || Number(table.seats) < 1 || !/^\d+$/.test(table.seats)) {
          errors[`seats-${table.rowId}`] = `Table ${index + 1}: enter a positive whole number.`;
        }
      });
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');
    if (!validate() || saving) return;
    setCreatedSlot(null);
    setSaving(true);
    try {
      const payload = { date, startTime, endTime, meal };
      if (mode === 'copy') payload.copyTablesFromSlotId = Number(sourceId);
      else payload.tables = tables.map((table) => ({
        tableIdentifier: table.tableIdentifier.trim(), seats: Number(table.seats),
      }));
      const result = await createStaffSlot(payload);
      setCreatedSlot(result);
      setViewDate(date);
      setRefresh((n) => n + 1);
      setStartTime('12:00');
      setEndTime('13:00');
      setMeal('lunch');
      setMode('manual');
      setTables([emptyTable(1), emptyTable(2)]);
      setNextRowId(3);
      setSourceId('');
      setFieldErrors({});
      // Keep the selected date for consecutive services; reset all other fields.
      requestAnimationFrame(() => successRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    } catch (error) {
      setFormError(error.message || 'Could not create the slot.');
      const fieldMessages = {};
      for (const detail of error.details || []) {
        if (detail.field) fieldMessages[detail.field] = detail.message;
      }
      setFieldErrors(fieldMessages);
    } finally { setSaving(false); }
  }

  return (
    <div className="staff-page staff-slots-page">
      <div className="staff-page-heading">
        <div><p className="staff-eyebrow">SERVICE PLANNING</p><h1>Slot management</h1>
          <p>Set service times, choose the meal type and configure tables for each slot.</p></div>
      </div>

      <section className="staff-panel" ref={scheduleRef}>
        <div className="staff-panel-heading"><div><h2>Daily schedule</h2><p>Check the existing slots before creating a new one.</p></div>
          <div className="staff-inline-date"><label htmlFor="staff-view-date">Date</label><StaffDatePicker id="staff-view-date" value={viewDate} onChange={setViewDate} ariaLabel="Choose schedule date" /></div>
        </div>
        {listError && <Alert variant="danger" role="alert">{listError}</Alert>}
        {loadingSlots ? <p className="staff-muted" role="status"><Spinner animation="border" size="sm" /> Loading schedule…</p>
          : slots.length ? <div className="staff-slot-grid">{slots.map((slot) => (
            <article className={`staff-slot-card ${createdSlot?.id === slot.id ? 'staff-slot-card--created' : ''}`} key={slot.id}>
              <div className="staff-slot-card-top"><span className="staff-slot-category">{mealLabel(slot.meal)}</span>
                <span className={`staff-status ${slot.status !== 'available' ? 'staff-status--off' : ''}`}>{slot.status === 'available' ? 'Available' : 'Off'}</span></div>
              <h3>{slot.startTime} <span>–</span> {slot.endTime}</h3>
              <p>{slot.tables.length} {slot.tables.length === 1 ? 'table' : 'tables'} · {capacity(slot.tables)} seats</p>
              <div className="staff-slot-tables">{slot.tables.length ? slot.tables.map((t) => (
                <span key={t.tableId}>{t.tableIdentifier}: {t.seats}</span>
              )) : <em>No tables assigned · 0 seats available</em>}</div>
            </article>
          ))}</div> : <div className="staff-empty"><h3>No slots for this date</h3><p>Create one below to set up a new service.</p></div>}
      </section>

      <section className="staff-panel staff-create-panel" aria-labelledby="staff-create-title">
        <div className="staff-panel-heading"><h2 id="staff-create-title">Create a slot</h2></div>
        {createdSlot && (
          <div className="staff-created" role="status" ref={successRef}>
            <span className="staff-created-check" aria-hidden="true">✓</span>
            <div className="staff-created-content">
              <strong>Slot created successfully</strong>
              <p>{formatDate(createdSlot.date)} · {mealLabel(createdSlot.meal)} · {createdSlot.startTime}–{createdSlot.endTime} · {createdSlot.tables?.length || 0} tables · {capacity(createdSlot.tables || [])} seats</p>
              <div className="staff-created-actions">
                <button type="button" onClick={() => scheduleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>View in schedule</button>
                <button type="button" onClick={() => { setCreatedSlot(null); document.getElementById('slot-meal')?.focus(); }}>Create another</button>
              </div>
            </div>
            <button type="button" className="staff-created-dismiss" aria-label="Dismiss confirmation" onClick={() => setCreatedSlot(null)}>×</button>
          </div>
        )}
        {formError && <Alert variant="danger" role="alert">{formError}</Alert>}
        <form onSubmit={handleSubmit} noValidate>
          <div className="staff-form-grid">
            <Field id="slot-date" label="Service date" error={fieldErrors.date}>
              <StaffDatePicker id="slot-date" value={date} onChange={setDate} min={todayInHut()} disabled={saving} ariaLabel="Choose service date"/>
            </Field>
            <Field id="slot-meal" label="Meal type" error={fieldErrors.meal}>
              <StaffSelect id="slot-meal" value={meal} onChange={setMeal} options={MEALS} disabled={saving} placeholder="Choose meal"/>
            </Field>
            <Field id="slot-start" label="Start time" error={fieldErrors.startTime}>
              <StaffTimePicker id="slot-start" label="Start time" value={startTime} onChange={setStartTime} disabled={saving}/>
            </Field>
            <Field id="slot-end" label="End time" error={fieldErrors.endTime}>
              <StaffTimePicker id="slot-end" label="End time" value={endTime} onChange={setEndTime} disabled={saving}/>
            </Field>
          </div>
          <div className="staff-section-divider" />
          <div className="staff-panel-heading staff-table-heading"><h3>Table configuration</h3></div>
          <fieldset className="staff-mode-picker" disabled={saving}>
            <legend className="visually-hidden">Choose a table configuration method</legend>
            <label className={mode === 'manual' ? 'selected' : ''}><input type="radio" name="table-mode" value="manual" checked={mode === 'manual'} onChange={() => setMode('manual')} /> Enter tables manually</label>
            <label className={mode === 'copy' ? 'selected' : ''}><input type="radio" name="table-mode" value="copy" checked={mode === 'copy'} onChange={() => setMode('copy')} /> Copy tables from another slot</label>
          </fieldset>
          {mode === 'manual' ? (
            <div className="staff-table-editor">
              {tables.map((table) => (
                <div className="staff-table-row" key={table.rowId}>
                  <Field id={`table-name-${table.rowId}`} label="Table identifier" error={fieldErrors[`table-${table.rowId}`]}>
                    <input id={`table-name-${table.rowId}`} type="text" maxLength={51} value={table.tableIdentifier} onChange={(e) => updateTable(table.rowId, 'tableIdentifier', e.target.value)} disabled={saving} placeholder="e.g. T1"/>
                  </Field>
                  <Field id={`table-seats-${table.rowId}`} label="Seats" error={fieldErrors[`seats-${table.rowId}`]}>
                    <input id={`table-seats-${table.rowId}`} type="number" min="1" step="1" value={table.seats} onChange={(e) => updateTable(table.rowId, 'seats', e.target.value)} disabled={saving}/>
                  </Field>
                  <button className="staff-icon-button" type="button" aria-label={`Remove ${table.tableIdentifier || 'table'}`} disabled={saving} onClick={() => setTables((previous) => previous.filter((item) => item.rowId !== table.rowId))}>×</button>
                </div>
              ))}
              <button className="staff-outline-button" type="button" disabled={saving} onClick={addTable}>+ Add another table</button>
              {tables.length === 0 && <p className="staff-hint">A slot without tables is allowed, but has zero capacity and cannot receive bookings.</p>}
            </div>
          ) : (
            <div className="staff-copy-options">
              <div className="staff-copy-grid">
                <Field id="copy-source-date" label="Date of existing slot">
                  <StaffDatePicker id="copy-source-date" value={sourceDate} onChange={setSourceDate} disabled={saving} ariaLabel="Choose source slot date" preferredPlacement="above"/>
                </Field>
                <Field id="copy-source-slot" label="Existing slot" error={fieldErrors.sourceId || fieldErrors.copyTablesFromSlotId}>
                  <StaffSelect id="copy-source-slot" value={sourceId} onChange={setSourceId}
                    placeholder={loadingSource ? 'Loading…' : 'Choose a slot'}
                    options={sourceSlots.map((s) => ({ value: s.id, label: `${s.startTime}–${s.endTime} · ${mealLabel(s.meal)} · ${s.tables.length} tables` }))}
                    disabled={saving || loadingSource || sourceSlots.length === 0} preferredPlacement="above"/>
                </Field>
              </div>
              {sourceError && <Alert variant="danger" role="alert">{sourceError}</Alert>}
              {!loadingSource && !sourceError && sourceSlots.length === 0 && <p className="staff-hint">No existing slots on this date. Try another date.</p>}
              {selectedSource && <div className="staff-copy-preview"><strong>Tables to copy</strong><div className="staff-slot-tables">{selectedSource.tables.map((t) => <span key={t.tableId}>{t.tableIdentifier}: {t.seats}</span>)}{!selectedSource.tables.length && <em>Empty table set (zero seats)</em>}</div></div>}
            </div>
          )}
          <div className="staff-form-footer">
            <div className="staff-capacity-summary">
              <span className="staff-capacity-label">Total slot capacity</span>
              <div className="staff-capacity-metrics">
                <span><strong>{totalSeats}</strong> {totalSeats === 1 ? 'seat' : 'seats'}</span>
                <span className="staff-capacity-separator" aria-hidden="true">·</span>
                <span><strong>{tableCount}</strong> {tableCount === 1 ? 'table' : 'tables'}</span>
              </div>
            </div>
            <button className="staff-primary-button" type="submit" disabled={saving || (mode === 'copy' && !selectedSource)}>{saving ? 'Creating slot…' : 'Create slot'} <span aria-hidden="true">↗</span></button>
          </div>

        </form>
      </section>
    </div>
  );
}
