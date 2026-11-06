// Only non-sensitive booking choices are stored for the current browser tab.
// This allows the hiker to complete sign in / sign up (or refresh the page)
// without having to repeat the availability search. The booking itself is
// created only when the hiker presses "Confirm booking".
const STORAGE_KEY = 'edelweiss.pendingBooking.v1';
const MAX_AGE_MS = 60 * 60 * 1000;

function validDraft(draft) {
  if (!draft || typeof draft !== 'object') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date || '')) return false;
  if (typeof draft.meal !== 'string' || !draft.meal) return false;
  if (!Number.isInteger(Number(draft.partySize)) || Number(draft.partySize) < 1) return false;
  if (!Number.isInteger(Number(draft.selectedSlotId)) || Number(draft.selectedSlotId) < 1) return false;
  if (!draft.seating || !Array.isArray(draft.result?.slots)) return false;
  return draft.result.slots.some(slot => Number(slot.id) === Number(draft.selectedSlotId));
}

export function savePendingBooking(draft) {
  if (!validDraft(draft)) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), draft }));
  } catch {
    // Private browsing or restricted storage: React Router state still works.
  }
}

export function getPendingBooking() {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!Number.isFinite(saved?.savedAt) || Date.now() - saved.savedAt > MAX_AGE_MS ||
        saved.savedAt > Date.now() || !validDraft(saved.draft)) {
      clearPendingBooking();
      return null;
    }
    return saved.draft;
  } catch {
    clearPendingBooking();
    return null;
  }
}

export function clearPendingBooking() {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage access is optional.
  }
}
