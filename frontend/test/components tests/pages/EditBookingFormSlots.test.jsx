import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EditBookingForm from '../../../src/components/EditBookingForm.jsx';
import { getAvailableSlots, updateBooking } from '../../../src/api/booking.js';

vi.mock('../../../src/api/booking.js', () => ({
  getAvailableSlots: vi.fn(), updateBooking: vi.fn(), bookingErrorMessage: error => error.message,
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

beforeEach(() => {
  vi.clearAllMocks();
  getAvailableSlots.mockResolvedValue({ slots: [{ id: 4, meal: 'lunch', startTime: '13:00', endTime: '14:00' }] });
  updateBooking.mockResolvedValue({ ...booking, slot: { ...booking.slot, id: 4, startTime: '13:00' } });
});

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
    await waitFor(() => expect(getAvailableSlots).toHaveBeenLastCalledWith({ date: '2027-11-21', meal: 'dinner', partySize: 3 }));
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
    await user.click(await screen.findByRole('button', { name: /13:00 · Available for your group/i }));
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(updateBooking).toHaveBeenCalledWith(8, { slotId: 4, partySize: 3 }));
    expect(saved).toHaveBeenCalledTimes(1);
  });
});
