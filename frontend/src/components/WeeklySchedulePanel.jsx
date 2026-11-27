import { useEffect, useRef, useState } from 'react';
import { Alert, Spinner } from 'react-bootstrap';
import { listStaffSlots, mealLabel, previewWeeklyCopy, copyWeeklySchedule } from '../api/slots.js';
import WeeklyCopyModal from './WeeklyCopyModal.jsx';
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
  const [schedule, setSchedule] = useState({ week: '', days: [], loading: false, error: '' });
  const [reload, setReload] = useState(0);
  const [review, setReview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState('');
  const [notice, setNotice] = useState('');
  const requestId = useRef(0);
  const copyLock = useRef(false);
  const sameWeek = Boolean(sourceWeek && sourceWeek === targetWeek);

  const earlierWeek = Boolean(sourceWeek && targetWeek && targetWeek < sourceWeek);

  useEffect(() => {
    if (!active || !sourceWeek) return;
    let current = true;
    const dates = Array.from({ length: 7 }, (_, index) => addDays(sourceWeek, index));
    setSchedule({ week: sourceWeek, days: [], loading: true, error: '' });
    Promise.all(dates.map(async date => {
      const data = await listStaffSlots(date);
      return { date, slots: data.slots || [] };
    })).then(days => {
      if (current) setSchedule({ week: sourceWeek, days, loading: false, error: '' });
    }).catch(error => {
      if (current) setSchedule({ week: sourceWeek, days: [], loading: false, error: error.message || 'Could not load the weekly schedule.' });
    });
    return () => { current = false; };
  }, [active, sourceWeek, reload]);

  const ready = schedule.week === sourceWeek && !schedule.loading && !schedule.error && schedule.days.length === 7;
  const count = ready ? schedule.days.reduce((sum, day) => sum + day.slots.length, 0) : 0;
  const selectSource = value => {
    setNotice('');
    setSourceWeek(mondayOf(value));
    setSelectedDay(0);
  };
  const selectTarget = value => { setNotice(''); setTargetWeek(mondayOf(value)); };
  const canReview = ready && count > 0 && sourceWeek && targetWeek && !sameWeek && !earlierWeek && !review;

  function closeReview() {
    if (copyLock.current) return;
    requestId.current += 1;
    setReview(null);
    setPreviewLoading(false);
    setCopyError('');
  }

  async function openReview() {
    if (!canReview) return;
    const id = ++requestId.current;
    const input = { sourceWeekStart: sourceWeek, targetWeekStart: targetWeek };
    setReview(input);
    setNotice('');
    setCopyError('');
    setPreviewLoading(true);
    try {
      const preview = await previewWeeklyCopy(input);
      if (requestId.current === id) setReview({ ...input, preview });
    } catch (error) {
      if (requestId.current === id) setCopyError(error.message || 'Could not check the destination week.');
    } finally {
      if (requestId.current === id) setPreviewLoading(false);
    }
  }

  async function confirmCopy() {
    if (!review?.preview || copyError || previewLoading || copyLock.current) return;
    copyLock.current = true;
    setCopying(true);
    try {
      const result = await copyWeeklySchedule({
        sourceWeekStart: review.sourceWeekStart,
        targetWeekStart: review.targetWeekStart,
        expectedSourceSlotIds: review.preview.sourceSlotIds,
        expectedTargetSlotIds: review.preview.targetSlotIds,
      });
      setReview(null);
      setSourceWeek(result.targetWeekStart);
      setTargetWeek('');
      setSelectedDay(0);
      setReload(n => n + 1);
      setNotice(`${result.copiedCount} ${result.copiedCount === 1 ? 'slot' : 'slots'} copied successfully to ${weekRange(result.targetWeekStart)}.`);
    } catch (error) {
      setCopyError(error.message || 'Could not copy the weekly schedule. Review the destination again.');
    } finally {
      copyLock.current = false;
      setCopying(false);
    }
  }

  return (
    <section className="staff-panel staff-weekly-panel" aria-label="Repeat weekly schedule">
      <div className="staff-panel-heading"><div><h2>Repeat weekly schedule</h2><p>Choose the week to reuse and the week where its slots will be copied.</p></div></div>
      <div className="staff-week-selection">
        <div className="staff-week-field staff-week-source">
          <span className="staff-week-step">01 · SOURCE</span>
          <label htmlFor="staff-source-week">Source week</label>
          <StaffDatePicker id="staff-source-week" value={sourceWeek} onChange={selectSource} ariaLabel="Choose source week" selectionMode="week" disabled={Boolean(review)} />
          <small>Select any day of the week to copy.</small>
        </div>
        <span className="staff-week-direction" aria-hidden="true">→</span>
        <div className="staff-week-field staff-week-target">
          <span className="staff-week-step">02 · DESTINATION</span>
          <label htmlFor="staff-target-week">Destination week</label>
          <StaffDatePicker id="staff-target-week" value={targetWeek} onChange={selectTarget} ariaLabel="Choose destination week" selectionMode="week" disabled={Boolean(review)} />
          <small>Select the week to receive the schedule.</small>
        </div>
      </div>
      {notice && <Alert variant="success" role="status">{notice}</Alert>}
      {earlierWeek && <Alert variant="danger" role="alert">Choose a destination week after the source week.</Alert>}
      {sameWeek && <Alert variant="danger" role="alert">Choose a different destination week. A week cannot be copied onto itself.</Alert>}
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
        <div><strong>{ready && count === 0 ? 'No slots to copy' : sourceWeek && targetWeek && !sameWeek && !earlierWeek && ready ? 'Weeks selected' : 'Select two different weeks'}</strong><p>Reservations and menus are not copied. Destination checks and confirmation are required before copying.</p></div>
        <button type="button" className="staff-primary-button" disabled={!canReview} onClick={openReview}>Review weekly copy <span aria-hidden="true">→</span></button>
      </div>
      <WeeklyCopyModal review={review} loading={previewLoading} busy={copying} error={copyError} onCancel={closeReview} onConfirm={confirmCopy} />
    </section>
  );
}
