import { useEffect, useRef, useState } from 'react';
import { todayInHut } from '../api/slots.js';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTH_FORMAT = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const DAY_FORMAT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const DISPLAY_FORMAT = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });

function utcDate(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}
function isoDate(date) { return date.toISOString().slice(0, 10); }

/** Small, dependency-free calendar shared by staff screens. Values stay as YYYY-MM-DD. */
export default function StaffDatePicker({ id, value, onChange, min, disabled = false, ariaLabel, preferredPlacement = 'auto' }) {
  const root = useRef(null);
  const trigger = useRef(null);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState('below');
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const base = utcDate(value || isoDate(new Date()));
    return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1));
  });

  useEffect(() => {
    if (!open) return undefined;
    function handlePointer(event) {
      if (root.current && !root.current.contains(event.target)) setOpen(false);
    }
    function handleKey(event) {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); }
    }
    document.addEventListener('pointerdown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  function toggleCalendar() {
    if (disabled) return;
    if (!open) {
      const base = utcDate(value || isoDate(new Date()));
      setVisibleMonth(new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1)));
      if (trigger.current) {
        const rect = trigger.current.getBoundingClientRect();
        const desiredHeight = 330;
        const roomBelow = Math.max(0, window.innerHeight - rect.bottom - 16);
        const roomAbove = Math.max(0, rect.top - 16);
        const showAbove = preferredPlacement === 'above' || (preferredPlacement !== 'below' && roomBelow < desiredHeight && roomAbove > roomBelow);
        setPlacement(showAbove ? 'above' : 'below');
      }
    }
    setOpen((wasOpen) => !wasOpen);
  }

  function moveMonth(offset) {
    setVisibleMonth((current) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + offset, 1)));
  }

  const firstDayOffset = (visibleMonth.getUTCDay() + 6) % 7;
  const start = new Date(Date.UTC(visibleMonth.getUTCFullYear(), visibleMonth.getUTCMonth(), 1 - firstDayOffset));
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const current = new Date(start.getTime());
    current.setUTCDate(start.getUTCDate() + index);
    return current;
  });
  const today = todayInHut();
  const title = value ? DISPLAY_FORMAT.format(utcDate(value)) : 'Choose a date';

  return (
    <div className={`staff-date-picker ${open ? 'is-open' : ''}`} ref={root}>
      <button id={id} ref={trigger} type="button" className="staff-date-trigger" aria-label={`${ariaLabel || 'Choose a date'}: ${title}`}
        aria-haspopup="dialog" aria-expanded={open} disabled={disabled} onClick={toggleCalendar}>
        <span>{title}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>
        </svg>
      </button>
      {open && (
        <div className={`staff-calendar ${placement === 'above' ? 'staff-calendar--above' : ''}`} role="dialog" aria-label="Select a date">
          <div className="staff-calendar-header">
            <strong>{MONTH_FORMAT.format(visibleMonth)}</strong>
            <div className="staff-calendar-arrows">
              <button type="button" aria-label="Previous month" onClick={() => moveMonth(-1)}>‹</button>
              <button type="button" aria-label="Next month" onClick={() => moveMonth(1)}>›</button>
            </div>
          </div>
          <div className="staff-calendar-grid">
            {WEEKDAYS.map((day, i) => <span className="staff-calendar-weekday" key={i}>{day}</span>)}
            {calendarDays.map((day) => {
              const iso = isoDate(day);
              const outside = day.getUTCMonth() !== visibleMonth.getUTCMonth();
              return (
                <button key={iso} type="button" disabled={Boolean(min && iso < min)}
                  className={`staff-calendar-day ${outside ? 'outside' : ''} ${iso === value ? 'selected' : ''} ${iso === today ? 'today' : ''}`}
                  aria-label={DAY_FORMAT.format(day)} aria-pressed={iso === value}
                  onClick={() => { onChange(iso); setOpen(false); }}>
                  {day.getUTCDate()}
                </button>
              );
            })}
          </div>
          <div className="staff-calendar-footer">
            <button type="button" disabled={Boolean(min && today < min)} onClick={() => { onChange(today); setOpen(false); }}>Today</button>
          </div>
        </div>
      )}
    </div>
  );
}
