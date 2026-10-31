import { useEffect, useId, useRef, useState } from 'react';
import '../styles/alpine-booking-fields.css';

// Keep the original API values; only the user-facing label changes.
export const MEAL_OPTIONS = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'aperitivo', label: 'Happy hour' },
  { value: 'dinner', label: 'Dinner' }
];

function Icon({ name }) {
  if (name === 'calendar') return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>
    </svg>
  );
  if (name === 'meal') return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 3v8M8 3v8M6 3v18M4 11h4M16 3c-3.5 3.3-4 8-1 10h3V3M18 13v8"/>
    </svg>
  );
  if (name === 'chevron') return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>;
  if (name === 'left') return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>;
  if (name === 'right') return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>;
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6"/></svg>;
}

// Parse YYYY-MM-DD without converting local time zones.
function parseISO(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return null;
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}
function toISO(year, monthZeroBased, day) {
  return `${year}-${String(monthZeroBased + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
function dateText(value) {
  const date = parseISO(value);
  return date ? new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date) : 'Choose a date';
}
function dateCompactText(value) {
  const date = parseISO(value);
  return date ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date) : 'Choose a date';
}
function dateVeryCompactText(value) {
  const date = parseISO(value);
  return date ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date) : 'Choose a date';
}
function ariaDate(value) {
  const date = parseISO(value);
  return date ? new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date) : value;
}
function monthTitle(year, month) {
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month, 1)));
}

function useDismiss(open, setOpen, rootRef, triggerRef) {
  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, setOpen, rootRef, triggerRef]);
}

export function AlpineDatePicker({ id, value, onChange, minDate, disabled = false, required = false }) {
  const uniqueId = useId();
  const popupId = `${uniqueId}-calendar`;
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const activeDayRef = useRef(null);
  const [open, setOpen] = useState(false);
  const initial = parseISO(value) || parseISO(minDate) || new Date();
  const [visibleMonth, setVisibleMonth] = useState([initial.getUTCFullYear(), initial.getUTCMonth()]);
  useDismiss(open, setOpen, rootRef, triggerRef);

  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  useEffect(() => {
    if (open) activeDayRef.current?.focus();
  }, [open, visibleMonth]);

  function toggle() {
    if (disabled) return;
    if (!open) {
      const selected = parseISO(value) || parseISO(minDate) || new Date();
      setVisibleMonth([selected.getUTCFullYear(), selected.getUTCMonth()]);
    }
    setOpen(previous => !previous);
  }
  function changeMonth(delta) {
    setVisibleMonth(([year, month]) => {
      const next = new Date(Date.UTC(year, month + delta, 1));
      return [next.getUTCFullYear(), next.getUTCMonth()];
    });
  }
  const [year, month] = visibleMonth;
  const offset = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const leadingBlank = Array.from({ length: offset }, (_, index) => `blank-${index}`);
  const days = Array.from({ length: daysInMonth }, (_, index) => index + 1);
  const monthBefore = toISO(year, month, 1);
  const minMonth = minDate?.slice(0, 7) || '';
  const canGoBack = !minMonth || monthBefore.slice(0, 7) > minMonth;

  return (
    <div className="ea-field-wrap" ref={rootRef}>
      <button
        id={id} ref={triggerRef} type="button"
        className={`ea-control ${open ? 'ea-control--open' : ''}`}
        aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? popupId : undefined}
        aria-label={`Date: ${dateText(value)}`} aria-required={required} disabled={disabled}
        onClick={toggle}
      >
        <span className="ea-leading"><Icon name="calendar" /></span>
        <span className={`ea-value ${!value ? 'ea-value--empty' : ''}`}>
          <span className="ea-date-long">{dateText(value)}</span>
          <span className="ea-date-compact">{dateCompactText(value)}</span>
          <span className="ea-date-tiny">{dateVeryCompactText(value)}</span>
        </span>
        <span className={`ea-chevron ${open ? 'ea-chevron--up' : ''}`}><Icon name="chevron" /></span>
      </button>
      {open && (
        <div id={popupId} className="ea-popover ea-calendar-popover" role="dialog" aria-label="Choose a date">
          <div className="ea-calendar-top">
            <button type="button" className="ea-month-arrow" aria-label="Previous month" disabled={!canGoBack} onClick={() => changeMonth(-1)}><Icon name="left" /></button>
            <strong className="ea-calendar-month">{monthTitle(year, month)}</strong>
            <button type="button" className="ea-month-arrow" aria-label="Next month" onClick={() => changeMonth(1)}><Icon name="right" /></button>
          </div>
          <div className="ea-calendar-grid" aria-label={monthTitle(year, month)}>
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(day => <span className="ea-calendar-weekday" key={day}>{day}</span>)}
            {leadingBlank.map(key => <span key={key} aria-hidden="true" />)}
            {days.map(day => {
              const iso = toISO(year, month, day);
              const isSelected = iso === value;
              const isDisabled = !!minDate && iso < minDate;
              const shouldFocus = !isDisabled && (isSelected || (!value || value.slice(0, 7) !== iso.slice(0, 7)) && day === Math.max(1, Number(minDate?.slice(0,7) === iso.slice(0,7) ? minDate.slice(8) : 1)));
              return <button
                key={iso} type="button" ref={shouldFocus ? activeDayRef : null}
                className={`ea-calendar-day ${isSelected ? 'ea-calendar-day--selected' : ''}`}
                aria-label={ariaDate(iso)} aria-pressed={isSelected} disabled={isDisabled}
                onClick={() => { onChange(iso); setOpen(false); triggerRef.current?.focus(); }}
              >{day}</button>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function AlpineMealSelect({ id, value, onChange, disabled = false, required = false }) {
  const uniqueId = useId();
  const listId = `${uniqueId}-meals`;
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const optionsRef = useRef([]);
  const [open, setOpen] = useState(false);
  useDismiss(open, setOpen, rootRef, triggerRef);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  const selected = MEAL_OPTIONS.find(option => option.value === value);
  function selectMeal(nextValue) {
    onChange(nextValue);
    setOpen(false);
    triggerRef.current?.focus();
  }
  function focusOption(index) { optionsRef.current[index]?.focus(); }
  function handleTriggerKeyDown(event) {
    if (disabled || !['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    setOpen(true);
    const current = MEAL_OPTIONS.findIndex(option => option.value === value);
    requestAnimationFrame(() => focusOption(current < 0 ? 0 : current));
  }
  function handleOptionKeyDown(event, index) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      focusOption((index + (event.key === 'ArrowDown' ? 1 : -1) + MEAL_OPTIONS.length) % MEAL_OPTIONS.length);
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      focusOption(event.key === 'Home' ? 0 : MEAL_OPTIONS.length - 1);
    }
  }
  return (
    <div className="ea-field-wrap" ref={rootRef}>
      <button
        id={id} ref={triggerRef} type="button" className={`ea-control ${open ? 'ea-control--open' : ''}`}
        aria-haspopup="listbox" aria-controls={open ? listId : undefined} aria-expanded={open}
        aria-label={`Meal: ${selected?.label || 'Select a meal'}`} aria-required={required}
        disabled={disabled} onClick={() => setOpen(previous => !previous)} onKeyDown={handleTriggerKeyDown}
      >
        <span className="ea-leading"><Icon name="meal" /></span>
        <span className={`ea-value ${!selected ? 'ea-value--empty' : ''}`}>{selected?.label || 'Select a meal'}</span>
        <span className={`ea-chevron ${open ? 'ea-chevron--up' : ''}`}><Icon name="chevron" /></span>
      </button>
      {open && (
        <div className="ea-popover ea-meal-popover" id={listId} role="listbox" aria-label="Meal">
          {MEAL_OPTIONS.map((option, index) => (
            <button
              key={option.value} type="button" role="option" aria-selected={value === option.value}
              ref={element => { optionsRef.current[index] = element; }}
              className={`ea-meal-option ${value === option.value ? 'ea-meal-option--selected' : ''}`}
              onClick={() => selectMeal(option.value)} onKeyDown={event => handleOptionKeyDown(event, index)}
            >
              <span>{option.label}</span>
              {value === option.value && <Icon name="check" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
