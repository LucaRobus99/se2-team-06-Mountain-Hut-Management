import { useEffect, useState } from 'react';
import { Alert, Spinner } from 'react-bootstrap';
import { listStaffSlots, listSlotCatalog, mealLabel } from '../api/slots.js';
import StaffDatePicker from './StaffDatePicker.jsx';
import { addDays, mondayOf, weekRange } from '../utils/staffWeek.js';

const weekdayFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'UTC' });
const shortWeekdayFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' });
const fullDateFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function WeeklySlot({ slot }) {
  const tables = Array.isArray(slot.tables) ? slot.tables : [];
  return <div className="staff-week-slot">
    <div className="staff-week-slot-main">
      <div className="staff-week-slot-meal"><div><strong>{mealLabel(slot.meal)}</strong><small>{slot.startTime}–{slot.endTime}</small></div></div>
      <span className="staff-week-slot-capacity">{tables.length} {tables.length === 1 ? 'table' : 'tables'} included</span>
      <div className="staff-week-table-pills" aria-label="Table configuration">
        {tables.map(table => <span key={table.tableId} className="staff-week-table-pill is-included" title={`${table.tableIdentifier}: Included`}>{table.tableIdentifier}</span>)}
        {!tables.length && <small>No tables included</small>}
      </div>
    </div>
  </div>;
}

export default function WeeklySchedulePanel({ active }) {
  const [sourceWeek, setSourceWeek] = useState('');
  const [targetWeek, setTargetWeek] = useState('');
  const [selectedDay, setSelectedDay] = useState(0);
  const [schedule, setSchedule] = useState({ week: '', days: [], catalog: [], loading: false, error: '' });
  const [reload, setReload] = useState(0);
  const sameWeek = Boolean(sourceWeek && sourceWeek === targetWeek);

  useEffect(() => {
    if (!active || !sourceWeek) return;
    let current = true;
    const dates = Array.from({ length: 7 }, (_, index) => addDays(sourceWeek, index));
    setSchedule({ week: sourceWeek, days: [], catalog: [], loading: true, error: '' });
    Promise.all([Promise.all(dates.map(async date => {
      const data = await listStaffSlots(date);
      return { date, slots: data.slots || [] };
    })), listSlotCatalog()]).then(([days, data]) => {
      if (!Array.isArray(data.tables)) throw new Error('Could not load the table catalog.');
      if (current) setSchedule({ week: sourceWeek, days, catalog: data.tables, loading: false, error: '' });
    }).catch(error => {
      if (current) setSchedule({ week: sourceWeek, days: [], catalog: [], loading: false, error: error.message || 'Could not load the weekly schedule.' });
    });
    return () => { current = false; };
  }, [active, sourceWeek, reload]);

  const ready = schedule.week === sourceWeek && !schedule.loading && !schedule.error && schedule.days.length === 7;
  const count = ready ? schedule.days.reduce((sum, day) => sum + day.slots.length, 0) : 0;
  const selectSource = value => {
    setSourceWeek(mondayOf(value));
    setSelectedDay(0);
  };
  const selectTarget = value => setTargetWeek(mondayOf(value));

  return (
    <section className="staff-panel staff-weekly-panel" aria-label="Repeat weekly schedule">
      <div className="staff-panel-heading"><div><h2>Repeat weekly schedule</h2><p>Choose the week to reuse and the week where its slots will be copied.</p></div></div>
      <div className="staff-week-selection">
        <div className="staff-week-field staff-week-source">
          <span className="staff-week-step">01 · SOURCE</span>
          <label htmlFor="staff-source-week">Source week</label>
          <StaffDatePicker id="staff-source-week" value={sourceWeek} onChange={selectSource} ariaLabel="Choose source week" selectionMode="week" />
          <small>Select any day of the week to copy.</small>
        </div>
        <span className="staff-week-direction" aria-hidden="true">→</span>
        <div className="staff-week-field staff-week-target">
          <span className="staff-week-step">02 · DESTINATION</span>
          <label htmlFor="staff-target-week">Destination week</label>
          <StaffDatePicker id="staff-target-week" value={targetWeek} onChange={selectTarget} ariaLabel="Choose destination week" selectionMode="week" />
          <small>Select the week to receive the schedule.</small>
        </div>
      </div>
      {sameWeek && <Alert variant="warning" role="alert">Choose a different destination week. A week cannot be copied onto itself.</Alert>}
      <div className="staff-week-overview-heading">
        <div><h3>Weekly schedule</h3><p>{sourceWeek ? weekRange(sourceWeek) : 'Select a source week to view its slots.'}</p></div>
        {ready && <span className="staff-week-count">{count} {count === 1 ? 'slot' : 'slots'}</span>}
      </div>
      {!sourceWeek && <div className="staff-empty"><h3>No week selected</h3><p>Choose a source week to display the daily schedule from Monday to Sunday.</p></div>}
      {sourceWeek && (schedule.loading || schedule.week !== sourceWeek) && <p className="staff-muted" role="status"><Spinner animation="border" size="sm"/> Loading weekly schedule…</p>}
      {schedule.week === sourceWeek && schedule.error && <Alert variant="danger" role="alert">{schedule.error} <button type="button" className="staff-outline-button" onClick={() => setReload(n => n + 1)}>Try again</button></Alert>}
      {ready && <div className="staff-week-days">
        <div className="staff-week-day-picker" role="group" aria-label="Choose a day of the source week">
          {schedule.days.map((day, index) => {
            const date = new Date(`${day.date}T12:00:00Z`);
            return <button type="button" key={day.date} className={`staff-week-day-button ${selectedDay === index ? 'is-selected' : ''}`} aria-pressed={selectedDay === index} aria-label={`${weekdayFormat.format(date)}, ${dateFormat.format(date)}, ${day.slots.length} ${day.slots.length === 1 ? 'slot' : 'slots'}`} onClick={() => setSelectedDay(index)}>
              <strong>{shortWeekdayFormat.format(date)}</strong><small>{dateFormat.format(date)}</small><span>{day.slots.length} {day.slots.length === 1 ? 'slot' : 'slots'}</span>
            </button>;
          })}
        </div>
        <div className="staff-week-selected-day" key={schedule.days[selectedDay].date}>
          <div className="staff-week-day-heading"><h4>{fullDateFormat.format(new Date(`${schedule.days[selectedDay].date}T12:00:00Z`))}</h4><span className="staff-week-count">{schedule.days[selectedDay].slots.length} {schedule.days[selectedDay].slots.length === 1 ? 'slot' : 'slots'}</span></div>
          <div className="staff-week-day-slots">
            {schedule.days[selectedDay].slots.length ? [...schedule.days[selectedDay].slots].sort((a, b) => a.startTime.localeCompare(b.startTime)).map(slot => <WeeklySlot key={slot.id} slot={slot}/>) : <div className="staff-empty staff-week-no-slots"><h3>No slots scheduled</h3><p>There are no service slots for this day.</p></div>}
          </div>
        </div>
      </div>}
      <div className="staff-week-footer">
        <div><strong>{ready && count === 0 ? 'No slots to copy' : sourceWeek && targetWeek && !sameWeek && ready ? 'Weeks selected' : 'Select two different weeks'}</strong><p>Reservations are not copied. Destination checks and confirmation are required before copying.</p></div>
        <button type="button" className="staff-primary-button" disabled>Review weekly copy <span aria-hidden="true">→</span></button>
      </div>
      <p className="staff-week-pending">Weekly copy confirmation is not available yet.</p>
    </section>
  );
}
