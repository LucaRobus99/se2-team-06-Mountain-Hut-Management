import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StaffReservationsPage from '../../../src/pages/StaffReservationsPage.jsx';
import { searchStaffHikers, getStaffAvailability, getStaffSeating, createStaffBooking } from '../../../src/api/booking.js';

vi.mock('../../../src/api/booking.js', () => ({
  searchStaffHikers: vi.fn(), getStaffAvailability: vi.fn(), getStaffSeating: vi.fn(), createStaffBooking: vi.fn(),
}));
vi.mock('../../../src/components/AlpineBookingFields.jsx', () => ({
  AlpineDatePicker: ({ id, value, onChange }) => <input id={id} type="date" value={value} onChange={e => onChange(e.target.value)} />,
  AlpineMealSelect: ({ id, value, onChange }) => <select id={id} value={value} onChange={e => onChange(e.target.value)}><option value="lunch">Lunch</option><option value="dinner">Dinner</option></select>,
}));
const slot = { id: 9, date: '2027-11-27', meal: 'lunch', startTime: '12:00', endTime: '13:00', tables: [{ freeSeats: 1 }, { freeSeats: 1 }] };

beforeEach(() => {
  vi.resetAllMocks();
  getStaffAvailability.mockResolvedValue({ slots: [slot] });
  getStaffSeating.mockResolvedValue({ fit: 'split', requiresConfirmation: true, seatAssignments: [{ seats: 1 }, { seats: 1 }] });
  createStaffBooking.mockResolvedValue({ id: 3, contactName: 'Guest', slot, partySize: 2, requirements: [], split: true, confirmationEmail: { status: 'skipped' } });
});

// These flows type many fields with userEvent; under a full parallel run they
// exceed Vitest's 5 s default, and a timed-out test then breaks the next one.
describe('MH-07 staff reservations', { timeout: 20_000 }, () => {
  it('searches only on first click, then refreshes live with no selected slot; confirms a split only once', async () => {
    const user = userEvent.setup();
    render(<StaffReservationsPage />);
    expect(getStaffAvailability).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /temporary guest/i }));
    await user.type(screen.getByLabelText(/full name/i), 'Guest');
    await user.click(screen.getByRole('button', { name: /find availability/i }));
    const card = await screen.findByRole('button', { name: /12:00.*multiple-table/i });
    expect(screen.queryByText('Available times')).not.toBeInTheDocument();
    expect(screen.queryByText(/Choose one of the available slots/i)).not.toBeInTheDocument();
    expect(card).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /confirm reservation/i })).toBeDisabled();
    await user.click(card);
    expect(await screen.findByText('Table split: 1 guest + 1 guest')).toBeInTheDocument();
    expect(screen.getByText(/Inform the guest about the table split/)).toBeInTheDocument();
    expect(screen.queryByText('Your reservation')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue with split seating' }));
    await waitFor(() => expect(card).toHaveAttribute('aria-pressed', 'true'));
    await user.click(card);
    expect(getStaffSeating).toHaveBeenCalledTimes(1);
    getStaffAvailability.mockResolvedValue({ slots: [{ ...slot, tables: [{ freeSeats: 2 }, { freeSeats: 1 }] }] });
    fireEvent.change(screen.getByLabelText('Guests'), { target: { value: '3' } });
    await waitFor(() => expect(getStaffAvailability).toHaveBeenLastCalledWith(expect.objectContaining({ partySize: 3 })));
    expect(await screen.findByRole('button', { name: /12:00.*multiple-table/i })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /confirm reservation/i })).toBeDisabled();
  });

  it('shows the same unavailable state as public availability and does not allow submission', async () => {
    getStaffAvailability.mockResolvedValue({ slots: [] });
    const user = userEvent.setup();
    render(<StaffReservationsPage />);
    await user.click(screen.getByRole('button', { name: /find availability/i }));
    expect((await screen.findByText('No tables available for this search.')).parentElement).toHaveClass('eh-empty-results');
    expect(screen.getByRole('button', { name: /confirm reservation/i })).toBeDisabled();
  });

  it('creates a reservation for an explicitly selected existing hiker', async () => {
    const user = userEvent.setup();
    searchStaffHikers.mockResolvedValue({ hikers: [{ id: 7, name: 'Alex Hiker', email: 'alex@example.test', phone: '+39012345678' }] });
    getStaffSeating.mockResolvedValue({ fit: 'single_table', requiresConfirmation: false, seatAssignments: [{ seats: 2 }] });
    render(<StaffReservationsPage />);
    await user.type(screen.getByLabelText('Find a hiker'), 'Alex');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await user.click(await screen.findByRole('button', { name: /Alex Hiker/ }));
    await user.click(screen.getByRole('button', { name: /find availability/i }));
    await user.click(await screen.findByRole('button', { name: /12:00/ }));
    await user.click(screen.getByRole('button', { name: /add dietary requirement/i }));
    await user.type(screen.getByLabelText('Requirement 1'), 'Peanut allergy');
    await user.click(screen.getByRole('checkbox', { name: 'Allergy' }));
    await user.click(screen.getByRole('button', { name: /confirm reservation/i }));
    await waitFor(() => expect(createStaffBooking).toHaveBeenCalledWith(expect.objectContaining({ mode: 'existingHiker', hikerId: 7, slotId: 9, expectedSeating: 'single_table', requirements: [expect.objectContaining({ description: 'Peanut allergy', allergies: true })] })));
    expect(await screen.findByRole('region', { name: 'Reservation confirmed' })).toBeInTheDocument();
  });

  it('creates an account with a one-time password, without mixing temporary guest fields', async () => {
    const user = userEvent.setup();
    getStaffSeating.mockResolvedValue({ fit: 'single_table', requiresConfirmation: false });
    createStaffBooking.mockResolvedValue({ id: 3, slot, partySize: 2, contactName: 'New Guest', account: { email: 'new@example.test' }, initialPassword: 'temporary-example', confirmationEmail: { status: 'sent' } });
    render(<StaffReservationsPage />);
    await user.click(screen.getByRole('button', { name: /temporary guest/i }));
    await user.type(screen.getByLabelText(/full name/i), 'Old guest');
    await user.click(screen.getByRole('button', { name: /new hiker/i }));
    expect(screen.getByLabelText(/full name/i)).toHaveValue('');
    expect(screen.getByPlaceholderText('+39 345 123 4567')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Name and mobile number')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e.g. mountain guide/)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/mobile number/i), '123');
    await user.tab();
    expect(screen.getByText('Enter a valid number with at least 6 digits.')).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/mobile number/i));
    await user.type(screen.getByLabelText(/full name/i), 'New Guest');
    await user.type(screen.getByLabelText(/mobile number/i), '+39012345678');
    await user.type(screen.getByLabelText(/email/i), 'new@example.test');
    await user.type(screen.getByLabelText(/emergency contact/i), 'Alex +39012345678');
    await user.type(screen.getByLabelText(/notes/i), 'Mountain guide');
    await user.click(screen.getByRole('button', { name: /find availability/i }));
    await user.click(await screen.findByRole('button', { name: /12:00/ }));
    await user.click(screen.getByRole('button', { name: /confirm reservation/i }));
    expect(await screen.findByText('New hiker account')).toBeInTheDocument();
    expect(screen.queryByText('temporary-example')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByText('temporary-example')).toBeInTheDocument();
    expect(createStaffBooking.mock.calls[0][0]).toMatchObject({ mode: 'newHiker', name: 'New Guest', email: 'new@example.test', phone: '+39012345678', emergencyContact: 'Alex +39012345678', notes: 'Mountain guide' });
    expect(createStaffBooking.mock.calls[0][0]).not.toHaveProperty('contactName');
    await user.click(screen.getByRole('button', { name: /create another reservation/i }));
    expect(screen.queryByText('temporary-example')).not.toBeInTheDocument();
  });

  it('confirms a temporary guest reservation after accepting split seating', async () => {
    const user = userEvent.setup();
    render(<StaffReservationsPage />);
    await user.click(screen.getByRole('button', { name: /temporary guest/i }));
    await user.type(screen.getByLabelText(/full name/i), 'Guest');
    await user.click(screen.getByRole('button', { name: /find availability/i }));
    await user.click(await screen.findByRole('button', { name: /12:00/ }));
    await user.click(await screen.findByRole('button', { name: 'Continue with split seating' }));
    await user.click(screen.getByRole('button', { name: /confirm reservation/i }));
    expect(await screen.findByText('Reservation created successfully.')).toBeInTheDocument();
    expect(createStaffBooking).toHaveBeenCalledWith(expect.objectContaining({ mode: 'guest', contactName: 'Guest', expectedSeating: 'split', slotId: 9 }));
    expect(screen.getByText(/Give the guest booking reference #3/)).toBeInTheDocument();
  });
});
