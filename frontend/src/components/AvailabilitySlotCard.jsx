import terracePhoto from '../assets/edelweiss-terrace.jpg';
import interiorPhoto from '../assets/edelweiss-login-interior.png';
import mountainPhoto from '../assets/edelweiss-dolomites.png';
import heroPhoto from '../assets/edelweiss-hero.png';

const slotPhotos = [interiorPhoto, heroPhoto, mountainPhoto, terracePhoto];

/** Display table OPTIONS for this party size, never the hut's total seating capacity.
 * An eligible multi-table arrangement is still bookable even when no single table fits.
 */
export function getTableAvailability(slot, partySize) {
  if (!Array.isArray(slot.tables)) {
    return { label: 'Available for your group', tone: 'green' };
  }
  const wanted = Number(partySize);
  const singles = slot.tables.filter(table => Number(table.freeSeats) >= wanted).length;
  if (singles === 1) return { label: '1 table available', tone: 'red' };
  if (singles > 1) return { label: `${singles} tables available`, tone: 'green' };
  // The API returns only slots for which a valid seating assignment exists.
  return { label: 'Multiple-table seating available', tone: 'amber' };
}

export default function AvailabilitySlotCard({ slot, index, partySize, selected, disabled, onClick }) {
  const { label, tone } = getTableAvailability(slot, partySize);
  return (
    <button
      type="button"
      className={`eh-slot-tile ${selected ? 'eh-slot-tile--selected' : ''}`}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
    >
      <img src={slotPhotos[index % slotPhotos.length]} alt="" loading="lazy" />
      <span className="eh-slot-tile-body">
        <span className="eh-slot-tile-info">
          <strong>{slot.startTime}</strong>
          <span className="eh-slot-availability">
            <span className={`eh-status-dot eh-status-dot--${tone}`} />
            {label}
          </span>
        </span>
        <svg className="eh-slot-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
      </span>
    </button>
  );
}
