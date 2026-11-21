import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  savePendingBooking,
  getPendingBooking,
  clearPendingBooking,
} from '../../../../src/utils/pendingBooking.js';

const STORAGE_KEY = 'edelweiss.pendingBooking.v1';

const makeValidDraft = (overrides = {}) => ({
  date: '2026-11-25',
  meal: 'lunch',
  partySize: '2',
  selectedSlotId: 101,
  seating: { fit: 'single_table' },
  result: {
    slots: [{ id: 101, startTime: '12:30' }],
  },
  ...overrides,
});

describe('pendingBooking white-box tests', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('saves and retrieves a valid pending booking draft within MAX_AGE_MS', () => {
    vi.useFakeTimers();
    const baseTime = new Date('2026-11-21T18:00:00Z').getTime();
    vi.setSystemTime(baseTime);

    const draft = makeValidDraft();
    savePendingBooking(draft);

    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();

    // Advance 30 minutes (well within 1 hour MAX_AGE_MS)
    vi.setSystemTime(baseTime + 30 * 60 * 1000);
    expect(getPendingBooking()).toEqual(draft);
  });

  it('rejects invalid drafts in savePendingBooking without writing to sessionStorage', () => {
    const invalidDrafts = [
      null,
      'not-an-object',
      makeValidDraft({ date: '21-11-2026' }),
      makeValidDraft({ meal: '' }),
      makeValidDraft({ meal: 123 }),
      makeValidDraft({ partySize: '0' }),
      makeValidDraft({ partySize: 'abc' }),
      makeValidDraft({ selectedSlotId: 0 }),
      makeValidDraft({ selectedSlotId: 'x' }),
      makeValidDraft({ seating: null }),
      makeValidDraft({ result: { slots: 'not-an-array' } }),
      makeValidDraft({ selectedSlotId: 999 }), // not present in result.slots
    ];

    for (const candidate of invalidDrafts) {
      savePendingBooking(candidate);
      expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    }
  });

  it('clears and returns null when stored entry is expired, in the future, invalid draft, or malformed JSON', () => {
    vi.useFakeTimers();
    const baseTime = new Date('2026-11-21T18:00:00Z').getTime();
    vi.setSystemTime(baseTime);

    // 1. Missing entry
    expect(getPendingBooking()).toBeNull();

    // 2. Expired entry (> 60 minutes)
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ savedAt: baseTime, draft: makeValidDraft() })
    );
    vi.setSystemTime(baseTime + 60 * 60 * 1000 + 1);
    expect(getPendingBooking()).toBeNull();
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();

    // 3. Future savedAt timestamp
    vi.setSystemTime(baseTime);
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ savedAt: baseTime + 5000, draft: makeValidDraft() })
    );
    expect(getPendingBooking()).toBeNull();

    // 4. Non-finite savedAt
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ savedAt: 'invalid', draft: makeValidDraft() })
    );
    expect(getPendingBooking()).toBeNull();

    // 5. Valid timestamp but invalid draft inside storage
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ savedAt: baseTime, draft: makeValidDraft({ meal: '' }) })
    );
    expect(getPendingBooking()).toBeNull();

    // 6. Malformed JSON triggers catch block and clears storage
    window.sessionStorage.setItem(STORAGE_KEY, '{bad-json');
    expect(getPendingBooking()).toBeNull();
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('handles restricted/throwing sessionStorage gracefully across all operations', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(() => savePendingBooking(makeValidDraft())).not.toThrow();
    expect(getPendingBooking()).toBeNull();
    expect(() => clearPendingBooking()).not.toThrow();
  });
});