/**
 * Pure seating logic for MH-01.
 * Given a party size and the list of tables with their free seats for a slot,
 * returns { fit: 'single_table'|'split', assignments: [{tableId, tableLabel, seats}] }
 * or null when no valid arrangement exists.
 */
export function computeSeating(partySize, tables) {
  if (!Number.isInteger(partySize) || partySize <= 0) return null;

  const list = (tables || [])
    .map((t) => ({ id: t.id, label: t.label, seats: Number(t.seats), free: Number(t.free) }))
    .sort((a, b) => a.id - b.id);

  if (partySize === 1) {
    const candidates = list.filter((t) => t.free >= 1);
    if (candidates.length === 0) return null;
    const chosen = candidates.sort((a, b) => a.free - b.free || a.seats - b.seats || a.id - b.id)[0];
    return {
      fit: 'single_table',
      assignments: [{ tableId: chosen.id, tableLabel: chosen.label, seats: 1 }],
    };
  }

  if (partySize === 2 || partySize === 3) {
    const candidates = list.filter((t) => t.free >= partySize);
    if (candidates.length === 0) return null;
    const chosen = candidates.sort((a, b) => a.seats - b.seats || a.free - b.free || a.id - b.id)[0];
    return {
      fit: 'single_table',
      assignments: [{ tableId: chosen.id, tableLabel: chosen.label, seats: partySize }],
    };
  }

  // partySize >= 4
  const singleCandidates = list.filter((t) => t.free >= partySize);
  if (singleCandidates.length > 0) {
    const chosen = singleCandidates.sort((a, b) => a.seats - b.seats || a.free - b.free || a.id - b.id)[0];
    return {
      fit: 'single_table',
      assignments: [{ tableId: chosen.id, tableLabel: chosen.label, seats: partySize }],
    };
  }

  // Try to split.
  let best = null;
  const current = [];

  function better(candidate) {
    if (!best) return true;
    if (candidate.usedCount !== best.usedCount) return candidate.usedCount < best.usedCount;
    if (candidate.usedSumFree !== best.usedSumFree) return candidate.usedSumFree < best.usedSumFree;
    return compareAssignments(candidate.assignments, best.assignments) < 0;
  }

  function rec(i, remaining, usedCount, usedSumFree) {
    if (i === list.length) {
      if (remaining === 0 && usedCount >= 2) {
        const cand = {
          usedCount,
          usedSumFree,
          assignments: current.map((a) => ({ ...a })),
        };
        if (better(cand)) best = cand;
      }
      return;
    }
    const t = list[i];

    // Table not used.
    rec(i + 1, remaining, usedCount, usedSumFree);

    // Table used with a portion >= 2.
    const maxPortion = Math.min(t.free, remaining);
    for (let p = 2; p <= maxPortion; p++) {
      current.push({ tableId: t.id, tableLabel: t.label, seats: p });
      rec(i + 1, remaining - p, usedCount + 1, usedSumFree + t.free);
      current.pop();
    }
  }

  rec(0, partySize, 0, 0);

  if (!best) return null;
  return { fit: 'split', assignments: best.assignments };
}

function compareAssignments(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i].tableId !== b[i].tableId) return a[i].tableId - b[i].tableId;
    if (a[i].seats !== b[i].seats) return a[i].seats - b[i].seats;
  }
  return a.length - b.length;
}