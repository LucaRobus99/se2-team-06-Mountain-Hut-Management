import { SimpleTableAllocator } from './SimpleTableAllocator.js';

/** Shared by MH-01 (booking, seating preview) and MH-04 (availability). */
const allocator = new SimpleTableAllocator();

/**
 * Maps rows from slotDao.getTablesWithFreeForSlot ({ id, label, seats, free })
 * to allocator tables ({ id, label, capacity, occupied }).
 */
function fromSlotTables(rows) {
  return (rows || []).map((r) => ({
    id: r.id,
    label: r.label,
    capacity: Number(r.seats),
    occupied: Number(r.seats) - Number(r.free),
  }));
}

/**
 * Seating for MH-01, following the PO rules of issues #18 and #11.
 * Given a party size and the tables of a slot as returned by
 * slotDao.getTablesWithFreeForSlot, returns
 * { fit: 'single_table'|'split', assignments: [{tableId, tableLabel, seats}], explanation }
 * or null when no valid arrangement exists.
 */
export function computeSeating(partySize, tables) {
  const result = allocator.allocate({ size: partySize }, fromSlotTables(tables));
  if (!result.ok) return null;
  return {
    fit: result.split ? 'split' : 'single_table',
    assignments: result.assignments.map((a) => ({ tableId: a.tableId, tableLabel: a.tableLabel, seats: a.guests })),
    explanation: result.explanation,
  };
}

/** Yes/no for MH-04: same answer as computeSeating(...) !== null. */
export function canSeat(partySize, tables) {
  return allocator.canSeat(partySize, fromSlotTables(tables));
}
