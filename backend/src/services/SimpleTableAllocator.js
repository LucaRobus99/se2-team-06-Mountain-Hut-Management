/**
 * Seat allocation for MH-01 (booking) and MH-04 (availability). Pure logic: no
 * database access, inputs are never mutated.
 *
 * The PO rules, applied directly:
 * - #18: the whole party at one table, possibly shared; split only when no table
 *   fits, then use as few tables as possible, occupying the smallest set of seats.
 * - #11: keep the party together and use the smallest set of available seats.
 * - #19: no minimum per table, #20: no table position, #21: tables are always shared.
 * - #12: availability uses the table layout, #17: no tables = no seats, #27: no size limit.
 *
 * Because a party may be split in any way (#19), any set of tables whose free seats
 * add up to the party size can hold it. So the rule is one choice:
 *   1. the fewest tables whose free seats cover the party,
 *   2. among those, the fewest free seats in total (the least left unused),
 *   3. among those, the fewest seats in total, so a smaller table is preferred over a
 *      larger one with the same free seats (kept from the first computeSeating),
 *   4. among those, the lowest table ids.
 * One table is the fewest possible, so a single-table fit always wins (Step 1).
 *
 * The search is a 0/1 knapsack over (number of tables, free seats): O(T^2 * S) time,
 * where T = tables with free seats and S = party size + largest free block.
 */
export class SimpleTableAllocator {
  /** Same answer as allocate(...).ok: any split is allowed, so only the total counts. */
  canSeat(partySize, tables) {
    if (!Number.isInteger(partySize) || partySize <= 0) return false;
    return totalFree(normalise(tables ?? [])) >= partySize;
  }

  allocate(party, tables) {
    const size = party?.size;
    if (!Number.isInteger(size) || size <= 0) {
      return failure('INVALID_PARTY_SIZE', `Party size must be a positive integer (got ${size}).`);
    }
    if (!Array.isArray(tables) || tables.length === 0) {
      return failure('NO_TABLES', 'There are no tables for this slot.');
    }
    const all = normalise(tables);
    const free = totalFree(all);
    if (free < size) {
      return failure('INSUFFICIENT_SEATS', `Total free seats (${free}) are fewer than the party size (${size}).`);
    }

    const chosen = fewestTablesFewestSeats(all.filter((t) => t.free > 0).sort((a, b) => a.id - b.id), size);
    const assignments = seat(size, chosen);
    const used = chosen.reduce((sum, t) => sum + t.free, 0);
    const split = assignments.length > 1;

    const explanation = split
      ? [
          `No table has ${size} free seats, so the party is split.`,
          `${chosen.length} tables are the fewest that can hold ${size}; this set leaves ${used - size} seat(s) unused.`,
        ]
      : [`Table ${chosen[0].label} is the smallest that fits the party of ${size} (${chosen[0].free} free).`];

    const byId = new Map(assignments.map((a) => [a.tableId, a.guests]));
    return {
      ok: true,
      step: split ? 2 : 1,
      split,
      groupSet: assignments.map((a) => a.guests).sort((a, b) => b - a),
      assignments,
      score: { tablesUsed: chosen.length, wastedSeats: used - size },
      tables: all.map((t) => {
        const occupied = t.occupied + (byId.get(t.id) ?? 0);
        return { id: t.id, label: t.label, capacity: t.capacity, occupied, free: Math.max(0, t.capacity - occupied) };
      }),
      explanation,
    };
  }
}

/**
 * best[c][s] = preferred set of c tables (see preferred()) with exactly s free seats.
 * Sums are capped at size + largest free block: a smallest set covering the party
 * never needs more, since dropping its smallest table would still cover it.
 * Tables come in id order, so adding the same table to two sets keeps their order
 * under preferred(), and keeping one set per (c, s) loses nothing.
 */
function fewestTablesFewestSeats(tables, size) {
  const limit = size + Math.max(...tables.map((t) => t.free));
  const best = [[{ set: [], seats: 0 }]]; // best[0][0] = no tables

  for (const table of tables) {
    for (let c = best.length - 1; c >= 0; c--) {
      best[c].forEach((entry, s) => {
        const sum = s + table.free;
        if (sum > limit) return;
        best[c + 1] ??= [];
        const current = best[c + 1][sum];
        const seats = entry.seats + table.capacity;
        if (!current || preferred(seats, entry.set, table, current)) {
          best[c + 1][sum] = { set: [...entry.set, table], seats };
        }
      });
    }
  }

  for (let c = 1; c < best.length; c++) {
    for (let s = size; s < (best[c]?.length ?? 0); s++) {
      if (best[c][s]) return best[c][s].set;
    }
  }
  return null; // not reached: allocate() checked that the total free seats cover the party
}

/**
 * Whether set + table (with `seats` seats in total) beats `current`, a set with the
 * same tables count and free seats: fewer seats, then lower ids.
 */
function preferred(seats, set, table, current) {
  if (seats !== current.seats) return seats < current.seats;
  const candidate = [...set, table];
  const i = candidate.findIndex((t, k) => t.id !== current.set[k].id);
  return i >= 0 && candidate[i].id < current.set[i].id;
}

/** Fills the largest free blocks first; the last table takes the rest. */
function seat(size, tables) {
  let remaining = size;
  return [...tables]
    .sort((a, b) => b.free - a.free || a.id - b.id)
    .map((t) => {
      const guests = Math.min(t.free, remaining);
      remaining -= guests;
      return { tableId: t.id, tableLabel: t.label, guests };
    })
    .filter((a) => a.guests > 0)
    .sort((a, b) => a.tableId - b.tableId);
}

function normalise(tables) {
  return tables.map((t) => {
    const capacity = Number(t.capacity);
    const occupied = Number(t.occupied ?? 0);
    if (!Number.isInteger(capacity) || capacity < 0 || !Number.isInteger(occupied) || occupied < 0) {
      throw new TypeError(`Table ${t.id}: capacity and occupied must be non-negative integers.`);
    }
    return { id: t.id, label: t.label ?? String(t.id), capacity, occupied, free: Math.max(0, capacity - occupied) };
  });
}

function totalFree(tables) {
  return tables.reduce((sum, t) => sum + t.free, 0);
}

function failure(code, reason) {
  return { ok: false, code, reason, explanation: [reason] };
}
