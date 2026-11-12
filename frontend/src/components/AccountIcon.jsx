/** Small, consistent outline icons for the account UI; no external icon dependency. */
export default function AccountIcon({ name, size = 19, className = '' }) {
  const paths = {
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    edit: <><path d="m16 4 4 4-12 12-5 1 1-5L16 4Z" /><path d="m14 6 4 4" /></>,
    arrow: <path d="m9 18 6-6-6-6" />,
    camera: <><path d="M4 7h3l2-3h6l2 3h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" /><circle cx="12" cy="13" r="4" /></>,
    upload: <><path d="M12 16V3m-5 5 5-5 5 5" /><path d="M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" /></>,
    trash: <><path d="M3 6h18M8 6V4h8v2m3 0-1 15H6L5 6" /><path d="M10 10v7m4-7v7" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
    phone: <path d="M22 17.7v2.6a2 2 0 0 1-2.2 2A19 19 0 0 1 2 4.3 2 2 0 0 1 4 2h2.6a2 2 0 0 1 2 1.7l.5 3a2 2 0 0 1-.6 1.7L7 9.9a16 16 0 0 0 7.1 7.1l1.5-1.5a2 2 0 0 1 1.7-.6l3 .5a2 2 0 0 1 1.7 2Z" />,
    note: <><path d="M5 3h14v18H5z" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
    contact: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M5.5 16a3.5 3.5 0 0 1 7 0M15 9h3m-3 4h3" /></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>,
  };
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true" focusable="false">
      {paths[name] || paths.user}
    </svg>
  );
}
