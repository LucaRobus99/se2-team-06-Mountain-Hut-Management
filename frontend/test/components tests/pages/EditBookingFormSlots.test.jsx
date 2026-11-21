import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EditBookingForm from '../../../src/components/EditBookingForm.jsx';
import { getModificationSlots, updateBooking } from '../../../src/api/booking.js';

vi.mock('../../../src/api/booking.js', () => ({
  getModificationSlots: vi.fn(), updateBooking: vi.fn(), bookingErrorMessage: error => error.message,
}));
vi.mock('../../../src/components/AlpineBookingFields.jsx', () => ({
  AlpineDatePicker: ({ id, value, onChange }) => <input id={id} type="date" value={value} onChange={event => onChange(event.target.value)} />,
  AlpineMealSelect: ({ id, value, onChange }) => <select id={id} value={value} onChange={event => onChange(event.target.value)}><option value="lunch">Lunch</option><option value="dinner">Dinner</option></select>,
}));

const booking = { id: 8, status: 'confirmed', partySize: 2, requirements: [],
  slot: { id: 3, date: '2027-11-20', meal: 'lunch', startTime: '12:00', endTime: '13:00' } };
const original = { ...booking.slot, fit: 'single_table', tables: [{ freeSeats: 2 }] };
const alternative = { id: 4, meal: 'lunch', startTime: '13:00', endTime: '14:00', fit: 'single_table', tables: [{ freeSeats: 4 }, { freeSeats: 4 }, { freeSeats: 4 }] };

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-19T10:00:00Z'));
  getModificationSlots.mockImplementation(async (_, { date, meal, partySize }) => ({
    slots: date === original.date && meal === original.meal && partySize <= 2
      ? [original, alternative] : [{ ...alternative, meal }],
  }));
  updateBooking.mockResolvedValue({ ...booking, slot: { ...booking.slot, id: 4, startTime: '13:00' } });
});
afterEach(() => vi.useRealTimers());

describe('Edit booking — photographic availability slots', () => {
  it('shows the original time and new available slots, without a time dropdown', async () => {
    render(<EditBookingForm booking={booking} onCancel={vi.fn()} onSaved={vi.fn()} />);
    expect(await screen.findByRole('button', { name: /13:00.*3 tables available/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /13:00.*3 tables available/i }).querySelector('.eh-status-dot--green')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /12:00.*1 table available/i }).querySelector('.eh-status-dot--yellow')).toBeInTheDocument();
    expect(screen.queryByText('Current time')).not.toBeInTheDocument();
    expect(screen.queryByText('Available times')).not.toBeInTheDocument();
    expect(screen.queryByText(/Choose one of the available slots/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Selected:/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Time')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
  });

  it('rechecks times when date, meal or guests change, then saves only the chosen slot', async () => {
    const user = userEvent.setup();
    const saved = vi.fn();
    render(<EditBookingForm booking={booking} onCancel={vi.fn()} onSaved={saved} />);
    await screen.findByRole('button', { name: /13:00.*3 tables available/i });
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2027-11-21' } });
    fireEvent.change(screen.getByLabelText('Meal'), { target: { value: 'dinner' } });
    fireEvent.change(screen.getByLabelText('Guests'), { target: { value: '3' } });
    await waitFor(() => expect(getModificationSlots).toHaveBeenLastCalledWith(8, { date: '2027-11-21', meal: 'dinner', partySize: 3 }));
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
    await user.click(await screen.findByRole('button', { name: /13:00.*3 tables available/i }));
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(updateBooking).toHaveBeenCalledWith(8, { slotId: 4, partySize: 3, expectedSeating: 'single_table' }));
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('shows the split and requires explicit confirmation before changing the reservation', async () => {
    const user = userEvent.setup();
    const saved = vi.fn();
    getModificationSlots.mockResolvedValue({
      slots: [original,
        { ...alternative, fit: 'split', tables: [{ freeSeats: 1 }, { freeSeats: 1 }], seatAssignments: [{ seats: 1 }, { seats: 1 }] }],
    });
    render(<EditBookingForm booking={booking} onCancel={vi.fn()} onSaved={saved} />);
    const split = await screen.findByRole('button', { name: /13:00.*Multiple-table seating available/i });
    expect(split.querySelector('.eh-status-dot--orange')).toBeInTheDocument();
    expect(screen.queryByText(/Table split:/i)).not.toBeInTheDocument();
    await user.click(split);
    expect(await screen.findByRole('dialog', { name: 'Seating Details' })).toBeInTheDocument();
    expect(screen.getByText('Table split: 1 guest + 1 guest')).toBeInTheDocument();
    expect(updateBooking).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Choose another time' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(updateBooking).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /12:00/i })).toHaveAttribute('aria-pressed', 'false');
    await user.click(split);
    await user.click(await screen.findByRole('button', { name: 'Continue with split seating' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(split).toHaveAttribute('aria-pressed', 'true');
    expect(split.querySelector('.eh-slot-selected-mark')).toBeInTheDocument();
    expect(split.querySelector('.eh-slot-arrow')).not.toBeInTheDocument();
    await user.click(split);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText(/Table split:/i)).not.toBeInTheDocument();
    expect(updateBooking).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(updateBooking).toHaveBeenCalledExactlyOnceWith(8, { slotId: 4, expectedSeating: 'split' }));
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('asks for split confirmation when the selected original slot becomes split after increasing guests', async () => {
    const user = userEvent.setup();
    getModificationSlots.mockImplementation(async (_, { partySize }) => ({
      slots: partySize === 2 ? [original] : [{
        ...original, fit: 'split', tables: [{ freeSeats: 2 }, { freeSeats: 1 }],
        seatAssignments: [{ seats: 2 }, { seats: 1 }],
      }],
    }));
    render(<EditBookingForm booking={booking} onCancel={vi.fn()} onSaved={vi.fn()} />);
    await screen.findByRole('button', { name: /12:00/i });
    fireEvent.change(screen.getByLabelText('Guests'), { target: { value: '3' } });
    await screen.findByRole('button', { name: /12:00.*Multiple-table seating available/i });
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /12:00.*Multiple-table seating available/i }));
    expect(await screen.findByText('Table split: 2 guests + 1 guest')).toBeInTheDocument();
    expect(updateBooking).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Continue with split seating' }));
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(updateBooking).toHaveBeenCalledExactlyOnceWith(8, { partySize: 3, expectedSeating: 'split' }));
  });

  it('removes the original time if the increased group does not fit', async () => {
    render(<EditBookingForm booking={booking} onCancel={vi.fn()} onSaved={vi.fn()} />);
    const current = await screen.findByRole('button', { name: /12:00/i });
    expect(current).toHaveAttribute('aria-pressed', 'false');
    fireEvent.change(screen.getByLabelText('Guests'), { target: { value: '3' } });
    expect(await screen.findByText(/your original time is unavailable/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /12:00/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
    expect(updateBooking).not.toHaveBeenCalled();
  });

  it('shows one red availability notice when no times fit', async () => {
    getModificationSlots.mockResolvedValue({ slots: [] });
    render(<EditBookingForm booking={booking} onCancel={vi.fn()} onSaved={vi.fn()} />);
    const notice = await screen.findByText('No tables available for this search.');
    expect(notice.parentElement).toHaveClass('eh-empty-results');
    expect(screen.queryByText(/your original time is unavailable/i)).not.toBeInTheDocument();
  });

  it('blocks saving on a failed availability request and retries', async () => {
    getModificationSlots.mockRejectedValueOnce(new Error('Could not check available times.'));
    const user = userEvent.setup();
    render(<EditBookingForm booking={booking} onCancel={vi.fn()} onSaved={vi.fn()} />);
    expect(await screen.findByText('Could not check available times.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /12:00/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByRole('button', { name: /12:00/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('refreshes availability after a conflicting save while preserving the draft', async () => {
    const user = userEvent.setup();
    const saved = vi.fn();
    updateBooking.mockRejectedValueOnce(Object.assign(new Error('Not enough seats.'), { status: 409 }));
    render(<EditBookingForm booking={booking} onCancel={vi.fn()} onSaved={saved} />);
    await user.click(await screen.findByRole('button', { name: /13:00.*3 tables available/i }));
    await user.click(screen.getByRole('button', { name: /add dietary requirement/i }));
    await user.type(screen.getByLabelText('Requirement 1'), 'Vegetarian');
    getModificationSlots.mockResolvedValueOnce({ slots: [original] });
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Not enough seats.');
    await waitFor(() => expect(getModificationSlots).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('button', { name: /12:00/i })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByLabelText('Requirement 1')).toHaveValue('Vegetarian');
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
    expect(saved).not.toHaveBeenCalled();
  });

  it('edits and removes dietary entries and saves the allergy flag without changing the time', async () => {
    const user = userEvent.setup();
    const saved = vi.fn();
    render(<EditBookingForm booking={booking} onCancel={vi.fn()} onSaved={saved} />);
    await user.click(await screen.findByRole('button', { name: /12:00/i }));
    await user.click(screen.getByRole('button', { name: /add dietary requirement/i }));
    await user.click(screen.getByRole('button', { name: /add dietary requirement/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/please describe dietary requirement 1/i);
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
    await user.type(screen.getByLabelText('Requirement 1'), '1 guest allergic to peanuts');
    await user.click(screen.getAllByRole('checkbox', { name: 'Allergy' })[0]);
    expect(screen.getAllByRole('checkbox', { name: 'Allergy' })[0]).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Remove requirement 2' }));
    expect(screen.queryByLabelText('Requirement 2')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(updateBooking).toHaveBeenCalledWith(8, {
      requirements: [{ description: '1 guest allergic to peanuts', allergies: true }], expectedSeating: 'single_table',
    }));
    expect(saved).toHaveBeenCalledTimes(1);
  });
});
