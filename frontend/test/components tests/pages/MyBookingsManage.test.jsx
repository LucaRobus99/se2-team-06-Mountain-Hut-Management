import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import MyBookingsPage from '../../../src/pages/MyBookingsPage.jsx';
import { getMyBookings, getBooking } from '../../../src/api/booking.js';

vi.mock('../../../src/api/booking.js', () => ({
  getMyBookings: vi.fn(), getBooking: vi.fn(), bookingErrorMessage: err => err.message,
}));
vi.mock('../../../src/components/EditBookingForm.jsx', () => ({
  default: () => <div data-testid="editing-form">Change booking form</div>,
}));

const coming = { id: 1, status: 'confirmed', partySize: 2,
  requirements: [{ description: 'Peanut allergy', allergies: true }],
  seatAssignments: [{ tableId: 99, tableLabel: 'SECRET TABLE 99', seats: 2 }],
  slot: { id: 10, date: '2027-11-20', meal: 'lunch', startTime: '12:00', endTime: '13:00' } };
const old = { ...coming, id: 2, slot: { ...coming.slot, id: 11, date: '2025-10-10' } };
const cancelled = { ...coming, id: 3, status: 'cancelled', slot: { ...coming.slot, id: 12, date: '2027-12-10' } };

beforeEach(() => {
  vi.clearAllMocks();
  getMyBookings.mockResolvedValue([coming, old, cancelled]);
  getBooking.mockResolvedValue(coming);
});

function showPage(initialEntries = ['/my-bookings']) {
  return render(<MemoryRouter initialEntries={initialEntries}><MyBookingsPage /></MemoryRouter>);
}

describe('My Bookings — expandable details and edit flow', () => {
  it('loads upcoming/past/cancelled history without automatically opening details', async () => {
    showPage();
    expect(await screen.findByRole('button', { name: /upcoming 1/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /past 1/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancelled 1/i })).toBeInTheDocument();
    expect(screen.queryByText('Your reservation')).not.toBeInTheDocument();
    expect(screen.queryByTestId('editing-form')).not.toBeInTheDocument();
  });

  it('opens details with the card arrow, closes them on second click and never displays table identifiers', async () => {
    const user = userEvent.setup();
    showPage();
    const arrow = await screen.findByRole('button', { name: /open booking #1/i });
    expect(arrow).toHaveAttribute('aria-expanded', 'false');
    await user.click(arrow);
    expect(screen.getByText('Your reservation')).toBeInTheDocument();
    expect(screen.queryByText(/SECRET TABLE 99/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view full details/i })).toHaveAttribute('href', '/book/confirmation/1');
    const close = screen.getByRole('button', { name: /close booking #1/i });
    expect(close).toHaveAttribute('aria-expanded', 'true');
    await user.click(close);
    expect(screen.queryByText('Your reservation')).not.toBeInTheDocument();
  });

  it('opens the edit form only after details > Change booking', async () => {
    const user = userEvent.setup();
    showPage();
    await user.click(await screen.findByRole('button', { name: /open booking #1/i }));
    await user.click(screen.getByRole('button', { name: /change booking/i }));
    expect(await screen.findByTestId('editing-form')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /past 1/i })).not.toBeInTheDocument();
    expect(getBooking).toHaveBeenCalledWith(1);
    await user.click(screen.getByRole('button', { name: /back to your bookings/i }));
    expect(screen.queryByTestId('editing-form')).not.toBeInTheDocument();
    expect(screen.queryByText('Your reservation')).not.toBeInTheDocument();
  });

  it('keeps past reservations accessible as history, without edit actions', async () => {
    const user = userEvent.setup();
    showPage();
    await screen.findByRole('button', { name: /past 1/i });
    await user.click(screen.getByRole('button', { name: /past 1/i }));
    await user.click(screen.getByRole('button', { name: /open booking #2/i }));
    await waitFor(() => expect(screen.getByText('10 October 2025')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /change booking/i })).not.toBeInTheDocument();
  });

  it('restores the past tab when returning from View full details', async () => {
    showPage(['/my-bookings?tab=past']);
    const past = await screen.findByRole('button', { name: /past 1/i });
    expect(past).toHaveAttribute('aria-pressed', 'true');
  });
});
