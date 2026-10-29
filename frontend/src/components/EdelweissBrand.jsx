/** Decorative mark for the fictional Edelweiss Hut brand. */
export default function EdelweissBrand({ compact = false, light = false }) {
  return (
    <span className={`eh-brand ${light ? 'eh-brand--light' : ''}`}>
      <svg className="eh-brand-mark" viewBox="0 0 84 54" fill="none" aria-hidden="true">
        <path d="M3 44c12-4 21-17 32-32l12 19L58 17l20 27" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m24 30 12-18 6 11m10 4 6-10 7 11M10 44l17-4 9-7 6 7 9-3 11 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M18 38 8 44m46-3 5-5 11 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <g transform="translate(62 8)" fill="currentColor">
          <ellipse cx="0" cy="-5" rx="2.1" ry="4.6" />
          <ellipse cx="0" cy="-5" rx="2.1" ry="4.6" transform="rotate(60)" />
          <ellipse cx="0" cy="-5" rx="2.1" ry="4.6" transform="rotate(120)" />
          <ellipse cx="0" cy="-5" rx="2.1" ry="4.6" transform="rotate(180)" />
          <ellipse cx="0" cy="-5" rx="2.1" ry="4.6" transform="rotate(240)" />
          <ellipse cx="0" cy="-5" rx="2.1" ry="4.6" transform="rotate(300)" />
          <circle r="2.1" fill="#c69d5c" />
        </g>
      </svg>
      <span className="eh-brand-copy">
        <span className="eh-brand-title">Edelweiss Hut</span>
        {!compact && <span className="eh-brand-tagline">SECEDA · DOLOMITES</span>}
      </span>
    </span>
  );
}
