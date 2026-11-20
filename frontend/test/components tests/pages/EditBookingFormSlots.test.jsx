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
vi.mock('../../../src/components/AvailabilitySlotCard.jsx', () => ({
  default: ({ slot, onClick, selected, availabilityText }) => <button type="button" aria-pressed={selected} onClick={onClick}>{slot.startTime} · {availabilityText}</button>,
}));

const booking = { id: 8, status: 'confirmed', partySize: 2, requirements: [],
  slot: { id: 3, date: '2027-11-20', meal: 'lunch', startTime: '12:00', endTime: '13:00' } };
const original = booking.slot;
const alternative = { id: 4, meal: 'lunch', startTime: '13:00', endTime: '14:00' };

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
    expect(await screen.findByText(/13:00 · Available for your group/i)).toBeInTheDocument();
    expect(screen.getByText(/12:00 · Current time/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Time')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
  });

  it('rechecks times when date, meal or guests change, then saves only the chosen slot', async () => {
    const user = userEvent.setup();
    const saved = vi.fn();
    render(<EditBookingForm booking={booking} onCancel={vi.fn()} onSaved={saved} />);
    await screen.findByText(/13:00 · Available for your group/i);
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2027-11-21' } });
    fireEvent.change(screen.getByLabelText('Meal'), { target: { value: 'dinner' } });
    fireEvent.change(screen.getByLabelText('Guests'), { target: { value: '3' } });
    await waitFor(() => expect(getModificationSlots).toHaveBeenLastCalledWith(8, { date: '2027-11-21', meal: 'dinner', partySize: 3 }));
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
    await user.click(await screen.findByRole('button', { name: /13:00 · Available for your group/i }));
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(updateBooking).toHaveBeenCalledWith(8, { slotId: 4, partySize: 3 }));
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('removes the original time if the increased group does not fit', async () => {
    render(<EditBookingForm booking={booking} onCancel={vi.fn()} onSaved={vi.fn()} />);
    const current = await screen.findByRole('button', { name: /12:00 · Current time/i });
    expect(current).toHaveAttribute('aria-pressed', 'true');
    fireEvent.change(screen.getByLabelText('Guests'), { target: { value: '3' } });
    expect(await screen.findByText(/your current time is no longer available/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /12:00 · Current time/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
    expect(updateBooking).not.toHaveBeenCalled();
  });

  it('blocks saving on a failed availability request and retries', async () => {
    getModificationSlots.mockRejectedValueOnce(new Error('Could not check available times.'));
    const user = userEvent.setup();
    render(<EditBookingForm booking={booking} onCancel={vi.fn()} onSaved={vi.fn()} />);
    expect(await screen.findByText('Could not check available times.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /12:00 · Current time/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByRole('button', { name: /12:00 · Current time/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('refreshes availability after a conflicting save while preserving the draft', async () => {
    const user = userEvent.setup();
    const saved = vi.fn();
    updateBooking.mockRejectedValueOnce(Object.assign(new Error('Not enough seats.'), { status: 409 }));
    render(<EditBookingForm booking={booking} onCancel={vi.fn()} onSaved={saved} />);
    await user.click(await screen.findByRole('button', { name: /13:00 · Available/i }));
    await user.click(screen.getByRole('button', { name: /add dietary requirement/i }));
    await user.type(screen.getByLabelText('Requirement 1'), 'Vegetarian');
    getModificationSlots.mockResolvedValueOnce({ slots: [original] });
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Not enough seats.');
    await waitFor(() => expect(getModificationSlots).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('button', { name: /12:00 · Current time/i })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByLabelText('Requirement 1')).toHaveValue('Vegetarian');
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
    expect(saved).not.toHaveBeenCalled();
  });
});
