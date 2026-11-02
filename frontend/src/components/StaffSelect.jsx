import { useEffect, useRef, useState } from 'react';

/** Compact, keyboard-accessible staff select; no external dependency. */
export default function StaffSelect({ id, value, onChange, options, placeholder = 'Choose an option', disabled = false, preferredPlacement = 'auto' }) {
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [placement, setPlacement] = useState('below');
  const [listMaxHeight, setListMaxHeight] = useState(232);
  const selectedIndex = options.findIndex((option) => String(option.value) === String(value));
  const selectedOption = options[selectedIndex];

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const openList = () => {
    if (disabled) return;
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const desiredHeight = Math.min(232, options.length * 46 + 12);
      const roomBelow = Math.max(0, window.innerHeight - rect.bottom - 16);
      const roomAbove = Math.max(0, rect.top - 16);
      const showAbove = preferredPlacement === 'above' || (preferredPlacement !== 'below' && roomBelow < desiredHeight && roomAbove > roomBelow);
      const availableRoom = showAbove ? roomAbove : roomBelow;
      setPlacement(showAbove ? 'above' : 'below');
      setListMaxHeight(Math.max(60, Math.min(desiredHeight, availableRoom - 8)));
    }
    setActiveIndex(selectedIndex < 0 ? 0 : selectedIndex);
    setOpen((previous) => !previous);
  };
  const choose = (option) => {
    onChange(String(option.value));
    setOpen(false);
    buttonRef.current?.focus();
  };
  const onKeyDown = (event) => {
    if (disabled) return;
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        openList();
      } else {
        setActiveIndex((current) => (current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
      }
    } else if (event.key === 'Enter' && open && options[activeIndex]) {
      event.preventDefault();
      choose(options[activeIndex]);
    }
  };

  return (
    <div className={`staff-select ${open ? 'is-open' : ''}`} ref={rootRef} onKeyDown={onKeyDown}>
      <button id={id} ref={buttonRef} type="button" className={`staff-select-trigger ${selectedOption ? '' : 'is-placeholder'}`}
        disabled={disabled} aria-haspopup="listbox" aria-expanded={open} aria-controls={`${id}-options`} onClick={openList}>
        <span>{selectedOption?.label || placeholder}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      {open && options.length > 0 && (
        <div id={`${id}-options`} className={`staff-select-options ${placement === 'above' ? 'staff-select-options--above' : ''}`}
          style={{ maxHeight: `${listMaxHeight}px` }} role="listbox" aria-label={placeholder}>
          {options.map((option, index) => (
            <button type="button" role="option" aria-selected={index === selectedIndex} tabIndex={-1}
              className={`staff-select-option ${index === activeIndex ? 'is-active' : ''} ${index === selectedIndex ? 'is-selected' : ''}`}
              key={option.value} onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(option)}>
              <span>{option.label}</span>{index === selectedIndex && <span className="staff-select-check" aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
