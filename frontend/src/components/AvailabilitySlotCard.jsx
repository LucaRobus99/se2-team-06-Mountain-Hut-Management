import breakfastCappuccino from '../assets/slot-photos/breakfast_cappuccino.jpg';
import breakfastSunrise from '../assets/slot-photos/breakfast_alpine_sunrise.jpg';
import cakeCoffeeTerrace from '../assets/slot-photos/cake_coffee_terrace.jpg';
import lunchMountainView from '../assets/slot-photos/lunch_mountain_view.jpg';
import charcuterieBoard from '../assets/slot-photos/charcuterie_board.jpg';
import heroStoneHut from '../assets/slot-photos/hero_stone_hut.jpg';
import soupView from '../assets/slot-photos/soup_view.jpg';
import aperitifSpritz from '../assets/slot-photos/aperitif_spritz.jpg';
import heroTerraceDusk from '../assets/slot-photos/hero_terrace_dusk.jpg';
import fireplaceLounge from '../assets/slot-photos/fireplace_lounge.jpg';
import dinnerSunset from '../assets/slot-photos/dinner_sunset.jpg';
import candlelightDining from '../assets/slot-photos/candlelight_dining.jpg';

const SLOT_PHOTOS_BY_MEAL = {
  breakfast: [
    breakfastCappuccino,
    cakeCoffeeTerrace,
    breakfastSunrise,
    breakfastCappuccino,
    cakeCoffeeTerrace,
    heroStoneHut,
    breakfastSunrise,
    fireplaceLounge,
    cakeCoffeeTerrace,
    breakfastCappuccino,
  ],
  lunch: [
    lunchMountainView,
    charcuterieBoard,
    heroStoneHut,
    soupView,
    lunchMountainView,
    fireplaceLounge,
    charcuterieBoard,
    heroTerraceDusk,
    lunchMountainView,
    soupView,
  ],
  aperitivo: [
    aperitifSpritz,
    heroTerraceDusk,
    charcuterieBoard,
    heroStoneHut,
    aperitifSpritz,
    heroTerraceDusk,
    charcuterieBoard,
    fireplaceLounge,
    aperitifSpritz,
    heroStoneHut,
  ],
  dinner: [
    dinnerSunset,
    candlelightDining,
    fireplaceLounge,
    heroTerraceDusk,
    dinnerSunset,
    candlelightDining,
    heroStoneHut,
    fireplaceLounge,
    dinnerSunset,
    candlelightDining,
  ],
};

const fallbackPhotos = [heroTerraceDusk, heroStoneHut, fireplaceLounge, candlelightDining];

function photoForSlot(slot, index) {
  const mealPhotos = SLOT_PHOTOS_BY_MEAL[slot?.meal] || fallbackPhotos;
  return mealPhotos[index % mealPhotos.length];
}

/** Display table OPTIONS for this party size, never the hut's total seating capacity.
 * An eligible multi-table arrangement is still bookable even when no single table fits.
 */
export function getTableAvailability(slot, partySize) {
  if (!Array.isArray(slot.tables)) {
    return { label: 'Available for your group', tone: null };
  }
  const wanted = Number(partySize);
  const singles = slot.tables.filter(table => Number(table.freeSeats) >= wanted).length;
  if (singles === 1) return { label: '1 table available', tone: 'yellow' };
  if (singles === 2) return { label: '2 tables available', tone: 'yellow' };
  if (singles >= 3) return { label: `${singles} tables available`, tone: 'green' };
  return { label: 'Multiple-table seating available', tone: 'orange' };
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
      <img src={photoForSlot(slot, index)} alt="" loading="lazy" />
      <span className="eh-slot-tile-body">
        <span className="eh-slot-tile-info">
          <span className="eh-slot-tile-kicker">Time slot</span>
          <strong>{slot.startTime}</strong>
          <span className="eh-slot-availability">
            {tone && <span className={`eh-status-dot eh-status-dot--${tone}`} aria-hidden="true" />}
            {label}
          </span>
        </span>
        <svg className="eh-slot-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
      </span>
    </button>
  );
}
