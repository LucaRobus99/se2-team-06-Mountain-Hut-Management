import { useEffect, useMemo, useRef, useState } from 'react';

const HOURS = Array.from({ length: 24 }, (_, value) => String(value).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, value) => String(value).padStart(2, '0'));

function parseTime(value) {
  if (!/^\d{2}:\d{2}$/.test(value || '')) return { hour: '12', minute: '00' };
  const [hour, minute] = value.split(':');
  return { hour, minute };
}

/** Branded hour/minute picker with native-like columns and hut colors. */
export default function StaffTimePicker({ id, value, onChange, disabled = false, label }) {
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const hourButtonRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState('below');
  const { hour, minute } = useMemo(() => parseTime(value), [value]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) hourButtonRef.current?.scrollIntoView({ block: 'center' });
  }, [open, hour]);

  function openPicker() {
    if (disabled) return;
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const desiredHeight = 300;
      const roomBelow = Math.max(0, window.innerHeight - rect.bottom - 16);
      const roomAbove = Math.max(0, rect.top - 16);
      setPlacement(roomBelow < desiredHeight && roomAbove > roomBelow ? 'above' : 'below');
    }
    setOpen((current) => !current);
  }

  function setHour(nextHour) {
    onChange(`${nextHour}:${minute}`);
  }
  function setMinute(nextMinute) {
    onChange(`${hour}:${nextMinute}`);
  }

  return (
    <div className={`staff-time-picker ${open ? 'is-open' : ''}`} ref={rootRef}>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        className="staff-time-trigger"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={openPicker}
      >
        <span>{`${hour}:${minute}`}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
        </svg>
      </button>
      {open && (
        <div className={`staff-time-panel ${placement === 'above' ? 'staff-time-panel--above' : ''}`} role="dialog" aria-label={`${label} picker`}>
          <div className="staff-time-columns">
            <div className="staff-time-column">
              <span className="staff-time-column-label">Hour</span>
              <div className="staff-time-list" role="listbox" aria-label="Hours">
                {HOURS.map((item) => (
                  <button
                    key={item}
                    ref={item === hour ? hourButtonRef : null}
                    type="button"
                    role="option"
                    aria-selected={item === hour}
                    className={`staff-time-option ${item === hour ? 'is-selected' : ''}`}
                    onClick={() => setHour(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <div className="staff-time-column">
              <span className="staff-time-column-label">Minutes</span>
              <div className="staff-time-list" role="listbox" aria-label="Minutes">
                {MINUTES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    role="option"
                    aria-selected={item === minute}
                    className={`staff-time-option ${item === minute ? 'is-selected' : ''}`}
                    onClick={() => setMinute(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="staff-time-footer">
            <button type="button" onClick={() => setOpen(false)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
