import breakfastCappuccino from '../assets/slot-photos/breakfast_cappuccino.jpg';
import breakfastSunrise from '../assets/slot-photos/breakfast_alpine_sunrise.jpg';
import cakeCoffeeTerrace from '../assets/slot-photos/cake_coffee_terrace.jpg';
import lunchMountainView from '../assets/slot-photos/lunch_mountain_view.jpg';
import charcuterieBoard from '../assets/slot-photos/charcuterie_board.jpg';
import aperitifSpritz from '../assets/slot-photos/aperitif_spritz.jpg';
import soupView from '../assets/slot-photos/soup_view.jpg';
import dinnerSunset from '../assets/slot-photos/dinner_sunset.jpg';

// Keep the original alpine photos alongside new meal-specific pictures.
// Use a deterministic order without repeating photos until the gallery cycles.
const photoAssets = import.meta.glob('../assets/slot-photos/*.webp', {
  eager: true, query: '?url', import: 'default',
});
function gallery(meal, preferred) {
  const remaining = Object.keys(photoAssets)
    .filter(path => path.split('/').pop().startsWith(meal + '-'))
    .sort()
    .map(path => photoAssets[path]);
  return [...new Set([...preferred, ...remaining])];
}
const photo = filename => photoAssets[`../assets/slot-photos/${filename}.webp`];
const SLOT_PHOTOS_BY_MEAL = {
  breakfast: gallery('breakfast', [cakeCoffeeTerrace, breakfastSunrise, breakfastCappuccino]),
  lunch: gallery('lunch', [photo('lunch-01-polenta'), photo('lunch-04-salad'), soupView, lunchMountainView]),
  aperitivo: gallery('aperitivo', [charcuterieBoard, photo('aperitivo-01-hugo'), photo('aperitivo-03-beer'), aperitifSpritz]),
  dinner: gallery('dinner', [photo('dinner-01-risotto'), photo('dinner-03-ravioli'), photo('dinner-06-salmon'), dinnerSunset]),
};
const fallbackPhotos = [lunchMountainView];

export function photoForSlot(slot, index = 0) {
  const mealPhotos = SLOT_PHOTOS_BY_MEAL[slot?.meal] || fallbackPhotos;
  return mealPhotos[index % mealPhotos.length];
}

/** Display table OPTIONS for this party size, never the hut's total seating capacity.
 * An eligible multi-table arrangement is still bookable even when no single table fits.
 */
export function getTableAvailability(slot, partySize, staff = false) {
  if (!Array.isArray(slot.tables)) {
    return { label: staff ? 'Available for this group' : 'Available for your group', tone: null };
  }
  const wanted = Number(partySize);
  if (slot.tables.reduce((total, table) => total + Number(table.freeSeats || 0), 0) < wanted) {
    return { label: 'No tables available', tone: 'red' };
  }
  const singles = slot.tables.filter(table => Number(table.freeSeats) >= wanted).length;
  if (singles === 1) return { label: '1 table available', tone: 'yellow' };
  if (singles === 2) return { label: '2 tables available', tone: 'yellow' };
  if (singles >= 3) return { label: `${singles} tables available`, tone: 'green' };
  return { label: 'Multiple-table seating available', tone: 'orange' };
}

export default function AvailabilitySlotCard({ slot, index, partySize, selected, disabled, onClick, availabilityText, staff = false }) {
  const { label, tone } = getTableAvailability(slot, partySize, staff);
  return (
    <button
      type="button"
      className={`eh-slot-tile ${selected ? 'eh-slot-tile--selected' : ''}`}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
    >
      <img src={photoForSlot(slot, index)} alt="" loading="lazy" />
      <span className="eh-slot-tile-body">
        <span className="eh-slot-tile-info">
          <span className="eh-slot-tile-kicker">Time slot</span>
          <strong>{slot.startTime}</strong>
          <span className="eh-slot-availability">
            {!availabilityText && tone && <span className={`eh-status-dot eh-status-dot--${tone}`} aria-hidden="true" />}
            {availabilityText ?? label}
          </span>
        </span>
        {selected ? <svg className="eh-slot-selected-mark" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="currentColor"/><path d="m6.5 12 3.5 3.5 7.5-7.5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          : <svg className="eh-slot-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>}
      </span>
    </button>
  );
}
