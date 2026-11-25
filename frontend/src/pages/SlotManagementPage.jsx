import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Spinner } from 'react-bootstrap';
import { createStaffSlot, listStaffSlots, listSlotCatalog, createCatalogTable, deleteCatalogTable, mealLabel, todayInHut } from '../api/slots.js';
import SlotConfirmModal from '../components/SlotConfirmModal.jsx';
import StaffDatePicker from '../components/StaffDatePicker.jsx';
import StaffSelect from '../components/StaffSelect.jsx';
import StaffTimePicker from '../components/StaffTimePicker.jsx';
import WeeklySchedulePanel from '../components/WeeklySchedulePanel.jsx';

const MEALS = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'aperitivo', label: 'Aperitif' },
  { value: 'dinner', label: 'Dinner' },
];
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

function DailySlotManagement() {
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
  const [tables, setTables] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [timePatterns, setTimePatterns] = useState([]);
  const [pattern, setPattern] = useState('');
  const [catalogError, setCatalogError] = useState('');
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [newTableOpen, setNewTableOpen] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [newTableSeats, setNewTableSeats] = useState('');
  const [addingTable, setAddingTable] = useState(false);
  const [newTableError, setNewTableError] = useState('');
  const [removeMode, setRemoveMode] = useState(false);
  const [tableToRemove, setTableToRemove] = useState(null);
  const [removingTable, setRemovingTable] = useState(false);
  const [removeError, setRemoveError] = useState('');
  const [removeNotice, setRemoveNotice] = useState('');
  const [sourceDate, setSourceDate] = useState(() => dayBefore(todayInHut()));
  const [sourceSlots, setSourceSlots] = useState([]);
  const [sourceId, setSourceId] = useState('');
  const [loadingSource, setLoadingSource] = useState(false);
  const [sourceError, setSourceError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingSlot, setPendingSlot] = useState(null);
  const [createdSlot, setCreatedSlot] = useState(null);
  const successRef = useRef(null);
  const scheduleRef = useRef(null);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    let active = true;
    setLoadingCatalog(true);
    setCatalogError('');
    listSlotCatalog().then(data => {
      if (active) { setCatalog(data.tables); setTimePatterns(data.timePatterns); }
    }).catch(error => { if (active) setCatalogError(error.message); })
      .finally(() => { if (active) setLoadingCatalog(false); });
    return () => { active = false; };
  }, [refresh]);

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

  function toggleTable(table) {
    setTables(previous => previous.some(t => t.tableId === table.tableId)
      ? previous.filter(t => t.tableId !== table.tableId) : [...previous, table]);
  }
  function choosePattern(value) {
    setPattern(value);
    if (value === '') return;
    const item = timePatterns[Number(value)];
    if (item) { setMeal(item.meal); setStartTime(item.startTime); setEndTime(item.endTime); }
  }
  async function addTable() {
    setNewTableError('');
    const name = newTableName.trim();
    const seats = Number(newTableSeats);
    if (!name || name.length > 50 || !/^\d+$/.test(newTableSeats) || !Number.isSafeInteger(seats) || seats < 1) {
      setNewTableError('Enter a table identifier and a positive whole number of seats.');
      return;
    }
    setAddingTable(true);
    try {
      const table = await createCatalogTable(name, seats);
      setCatalog(previous => [...previous, table].sort((a, b) => a.tableIdentifier.localeCompare(b.tableIdentifier)));
      setTables(previous => [...previous, table]);
      setNewTableOpen(false); setNewTableName(''); setNewTableSeats('');
    } catch (error) { setNewTableError(error.message); }
    finally { setAddingTable(false); }
  }

  async function confirmRemoveTable() {
    if (!tableToRemove || removingTable) return;
    const table = tableToRemove;
    setRemovingTable(true);
    setRemoveError('');
    try {
      await deleteCatalogTable(table.tableId);
      setCatalog(previous => previous.filter(t => t.tableId !== table.tableId));
      setTables(previous => previous.filter(t => t.tableId !== table.tableId));
      setRemoveNotice(`${table.tableIdentifier} removed from the table catalog.`);
      setTableToRemove(null);
    } catch (error) {
      setRemoveError(error.message || 'Could not remove the table.');
    } finally {
      setRemovingTable(false);
    }
  }

  function validate() {
    const errors = {};
    if (!date) errors.date = 'Choose a date.';
    else if (date < todayInHut()) errors.date = 'Choose today or a future date.';
    if (!meal) errors.meal = 'Choose a meal type.';
    if (!isValidTime(startTime)) errors.startTime = 'Enter a valid time (HH:MM).';
    if (!isValidTime(endTime) || (isValidTime(startTime) && endTime <= startTime)) errors.endTime = 'The end must be after the start, on the same day.';
    if (mode === 'copy' && !selectedSource) errors.sourceId = 'Choose the slot whose tables you want to copy.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleSubmit(event) {
    event.preventDefault();
    setFormError('');
    if (saving || removingTable || (mode === 'manual' && (newTableOpen || removeMode)) || !validate()) return;
    const payload = { date, startTime, endTime, meal };
    if (mode === 'copy') payload.copyTablesFromSlotId = Number(sourceId);
    else payload.tables = tables.map((table) => ({
      tableIdentifier: table.tableIdentifier.trim(), seats: Number(table.seats),
    }));
    const slotTables = mode === 'copy' ? selectedSource.tables : payload.tables;
    // Snapshot the summary so the modal keeps its content while the form resets and it fades out.
    setPendingSlot({
      payload,
      summary: {
        date: formatDate(date), meal: mealLabel(meal), startTime, endTime, tables: slotTables, seats: capacity(slotTables),
        copiedFrom: mode === 'copy' ? `${formatDate(sourceDate)} · ${selectedSource.startTime}–${selectedSource.endTime} · ${mealLabel(selectedSource.meal)}` : null,
      },
    });
    setConfirmOpen(true);
  }

  async function handleConfirm() {
    if (saving) return;
    setCreatedSlot(null);
    setSaving(true);
    try {
      const result = await createStaffSlot(pendingSlot.payload);
      setConfirmOpen(false);
      setCreatedSlot(result);
      setViewDate(date);
      setRefresh((n) => n + 1);
      setStartTime('12:00');
      setEndTime('13:00');
      setMeal('lunch');
      setMode('manual');
      setTables([]);
      setPattern('');
      setSourceId('');
      setFieldErrors({});
      // Keep the selected date for consecutive services; reset all other fields.
      requestAnimationFrame(() => successRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    } catch (error) {
      setConfirmOpen(false);
      setFormError(error.message || 'Could not create the slot.');
      const fieldMessages = {};
      for (const detail of error.details || []) {
        if (detail.field) fieldMessages[detail.field] = detail.message;
      }
      setFieldErrors(fieldMessages);
    } finally { setSaving(false); }
  }

  return (
    <div className="staff-page staff-daily-slot-content">
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
          <div className="staff-pattern-choice">
            <Field id="slot-pattern" label="Service time" hint="Reuse an existing time or define a new one.">
              <StaffSelect id="slot-pattern" value={pattern} onChange={choosePattern}
                options={[{ value: '', label: 'Define a new time' }, ...timePatterns.map((t, index) => ({ value: String(index), label: `${mealLabel(t.meal)} · ${t.startTime}–${t.endTime}` }))]}
                placeholder="Define a new time" disabled={saving || loadingCatalog}/>
            </Field>
          </div>
          <div className="staff-form-grid">
            <Field id="slot-date" label="Service date" error={fieldErrors.date}>
              <StaffDatePicker id="slot-date" value={date} onChange={setDate} min={todayInHut()} disabled={saving} ariaLabel="Choose service date"/>
            </Field>
            <Field id="slot-meal" label="Meal type" error={fieldErrors.meal}>
              <StaffSelect id="slot-meal" value={meal} onChange={value => { setMeal(value); setPattern(''); }} options={MEALS} disabled={saving} placeholder="Choose meal"/>
            </Field>
            <Field id="slot-start" label="Start time" error={fieldErrors.startTime}>
              <StaffTimePicker id="slot-start" label="Start time" value={startTime} onChange={value => { setStartTime(value); setPattern(''); }} disabled={saving}/>
            </Field>
            <Field id="slot-end" label="End time" error={fieldErrors.endTime}>
              <StaffTimePicker id="slot-end" label="End time" value={endTime} onChange={value => { setEndTime(value); setPattern(''); }} disabled={saving}/>
            </Field>
          </div>
          <div className="staff-section-divider" />
          <div className="staff-panel-heading staff-table-heading"><h3>Table configuration</h3></div>
          <fieldset className="staff-mode-picker" disabled={saving || removeMode || removingTable}>
            <legend className="visually-hidden">Choose a table configuration method</legend>
            <label className={mode === 'manual' ? 'selected' : ''}><input type="radio" name="table-mode" value="manual" checked={mode === 'manual'} onChange={() => setMode('manual')} /> Choose existing tables</label>
            <label className={mode === 'copy' ? 'selected' : ''}><input type="radio" name="table-mode" value="copy" checked={mode === 'copy'} onChange={() => setMode('copy')} /> Copy tables from another slot</label>
          </fieldset>
          {mode === 'manual' ? (
            <div className="staff-table-editor">
              <p className="staff-hint">Select which physical tables are available for this service. Each table has a fixed number of seats.</p>
              {catalogError && <Alert variant="danger">{catalogError}</Alert>}
              {loadingCatalog ? <p role="status">Loading tables…</p> : <div className="staff-catalog-grid">{catalog.map(table => (
                <div className="staff-catalog-entry" key={table.tableId}>
                  <label className={`staff-catalog-table ${tables.some(t => t.tableId === table.tableId) ? 'selected' : ''}`}>
                    <input type="checkbox" aria-label={`${table.tableIdentifier} ${table.seats} ${table.seats === 1 ? 'seat' : 'seats'}`} checked={tables.some(t => t.tableId === table.tableId)} onChange={() => toggleTable(table)} disabled={saving || removeMode}/>
                    <span><strong>{table.tableIdentifier}</strong><small>{table.seats} {table.seats === 1 ? 'seat' : 'seats'}</small></span>
                  </label>
                  {removeMode && <button type="button" className="staff-catalog-remove" aria-label={`Remove ${table.tableIdentifier}`} disabled={removingTable} onClick={() => { setRemoveNotice(''); setRemoveError(''); setTableToRemove(table); }}>Remove</button>}
                </div>
              ))}</div>}
              <div className="staff-catalog-actions">
                <button className="staff-outline-button" type="button" disabled={saving || addingTable || loadingCatalog || removeMode || Boolean(catalogError)} onClick={() => setNewTableOpen(v => !v)}>{newTableOpen ? 'Close new table form' : '+ Define a new table'}</button>
                <button className="staff-outline-button" type="button" aria-pressed={removeMode} disabled={saving || addingTable || loadingCatalog || newTableOpen || removingTable || Boolean(catalogError)} onClick={() => { setRemoveMode(v => !v); setRemoveNotice(''); }}>{removeMode ? 'Finish removing tables' : '− Remove a table'}</button>
              </div>
              {removeMode && <p className="staff-hint">Only tables not assigned to any existing slot or reservation can be removed from the catalog.</p>}
              {removeNotice && <Alert variant="success" role="status">{removeNotice}</Alert>}
              {newTableOpen && <div className="staff-new-table">
                <Field id="new-table-name" label="Table identifier"><input id="new-table-name" value={newTableName} maxLength={50} onChange={e => setNewTableName(e.target.value)} disabled={addingTable} placeholder="e.g. Terrace 1"/></Field>
                <Field id="new-table-seats" label="Fixed seats"><input id="new-table-seats" type="number" min="1" step="1" value={newTableSeats} onChange={e => setNewTableSeats(e.target.value)} disabled={addingTable}/></Field>
                <button type="button" className="staff-primary-button" onClick={addTable} disabled={addingTable}>{addingTable ? 'Creating…' : 'Create table'}</button>
                {newTableError && <p role="alert" className="staff-field-error">{newTableError}</p>}
              </div>}
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
            <button className="staff-primary-button" type="submit" disabled={saving || addingTable || removingTable || (mode === 'copy' && !selectedSource) || (mode === 'manual' && (newTableOpen || removeMode || loadingCatalog || Boolean(catalogError)))}>{saving ? 'Creating slot…' : 'Create slot'} <span aria-hidden="true">↗</span></button>
          </div>

        </form>
      </section>

      <Modal show={Boolean(tableToRemove)} onHide={() => { if (!removingTable) setTableToRemove(null); }} centered backdrop="static" keyboard={!removingTable} aria-labelledby="remove-table-title" dialogClassName="staff-confirm-modal eh-dialog" backdropClassName="eh-cancel-backdrop">
        <Modal.Header closeButton={!removingTable}>
          <div><p className="eh-dialog-eyebrow">Table configuration</p><Modal.Title as="h2" id="remove-table-title">Remove table?</Modal.Title></div>
        </Modal.Header>
        <Modal.Body>
          <p className="staff-confirm-intro">Remove <strong>{tableToRemove?.tableIdentifier}</strong> from the table catalog? This action cannot be undone.</p>
          <p className="staff-hint">Tables used by existing slots or reservations cannot be removed.</p>
          {removeError && <Alert variant="danger" role="alert">{removeError}</Alert>}
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="staff-outline-button" disabled={removingTable} onClick={() => setTableToRemove(null)}>Cancel</button>
          <button type="button" className="staff-catalog-confirm-remove" disabled={removingTable} onClick={confirmRemoveTable}>{removingTable ? 'Removing…' : 'Remove table'}</button>
        </Modal.Footer>
      </Modal>

      <SlotConfirmModal show={confirmOpen} summary={pendingSlot?.summary} onCancel={() => setConfirmOpen(false)} onConfirm={handleConfirm} busy={saving} />
    </div>
  );
}

const OPERATIONS = [
  { id: 'daily', title: 'Create a new slot', description: 'View the daily schedule and configure a new service slot.' },
  { id: 'weekly', title: 'Repeat weekly schedule', description: 'Reuse an entire week of service slots in another week.' },
];

export default function SlotManagementPage() {
  const [operation, setOperation] = useState(null);
  const [dailyOpened, setDailyOpened] = useState(false);
  const [weeklyOpened, setWeeklyOpened] = useState(false);

  function toggleOperation(id) {
    if (id === 'daily') setDailyOpened(true);
    else setWeeklyOpened(true);
    setOperation(current => current === id ? null : id);
  }

  return (
    <div className="staff-page staff-slots-page">
      <div className="staff-page-heading">
        <div><p className="staff-eyebrow">SERVICE PLANNING</p><h1>Slot management</h1>
          <p>Choose an operation to manage your hut’s service schedule.</p></div>
      </div>
      <div className={`staff-slot-workspace ${operation ? 'has-operation' : ''}`}>
        <div className="staff-slot-operations" aria-label="Slot management operations">
          {OPERATIONS.map(item => (
            <button key={item.id} type="button" className={`staff-operation-card ${operation === item.id ? 'is-selected' : ''}`}
              aria-expanded={operation === item.id} aria-controls={`staff-operation-${item.id}`} onClick={() => toggleOperation(item.id)}>
              <span className="staff-operation-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  {item.id === 'daily' ? <><rect x="3" y="4" width="17" height="17" rx="3"/><path d="M7 2v4M16 2v4M3 9h17M12 12v6m-3-3h6"/></> : <><path d="M20 7H7a4 4 0 0 0-4 4M16 3l4 4-4 4M4 17h13a4 4 0 0 0 4-4M8 13l-4 4 4 4"/></>}
                </svg>
              </span>
              <span className="staff-operation-copy"><strong>{item.title}</strong><small>{item.description}</small>
                {operation === item.id && <span className="staff-operation-open">Details open</span>}
              </span>
              <span className="staff-operation-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m9 5 7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
            </button>
          ))}
        </div>
        <div className="staff-slot-operation-detail" hidden={!operation}>
          <div id="staff-operation-daily" hidden={operation !== 'daily'}>{dailyOpened && <DailySlotManagement />}</div>
          <div id="staff-operation-weekly" hidden={operation !== 'weekly'}>{weeklyOpened && <WeeklySchedulePanel active={operation === 'weekly'} />}</div>
        </div>
      </div>
    </div>
  );
}
