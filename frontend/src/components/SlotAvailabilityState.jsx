/** The same unavailable state in public, hiker-edit and staff searches. */
export default function SlotAvailabilityState({ checking = false, error = '', empty = false, onRetry }) {
  if (checking) return <p className="eh-slot-search-pending" role="status">Checking availability…</p>;
  if (!error && !empty) return null;
  return <div className="eh-empty-results" role={error ? 'alert' : 'status'}>
    <h3>{error ? 'Unable to check availability' : 'No tables available for this search.'}</h3>
    <p>{error || 'Try a different meal, date or number of guests.'}</p>
    {error && onRetry && <button type="button" className="eh-edit-cancel eh-slot-retry" onClick={onRetry}>Try again</button>}
  </div>;
}
