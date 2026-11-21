import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import MyBookingsPage from '../../../src/pages/MyBookingsPage.jsx';
import { getMyBookings, getBooking, cancelBooking } from '../../../src/api/booking.js';

vi.mock('../../../src/api/booking.js', () => ({
  getMyBookings: vi.fn(), getBooking: vi.fn(), cancelBooking: vi.fn(), bookingErrorMessage: err => err.message,
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
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-19T10:00:00Z'));
  getMyBookings.mockResolvedValue([coming, old, cancelled]);
  getBooking.mockResolvedValue(coming);
});
afterEach(() => vi.useRealTimers());

function showPage(initialEntries = ['/my-bookings']) {
  return render(<MemoryRouter initialEntries={initialEntries}><MyBookingsPage /></MemoryRouter>);
}

describe('My Bookings — expandable details and edit flow', () => {
  it('shows a dismissible generic message after a receipt redirect', async () => {
    const user = userEvent.setup();
    showPage([{ pathname: '/my-bookings', state: { receiptUnavailable: true } }]);
    expect(await screen.findByText('Reservation link unavailable')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /upcoming 1/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Dismiss reservation notice' }));
    expect(screen.queryByText('Reservation link unavailable')).not.toBeInTheDocument();
  });
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

  it('requires confirmation, allows keeping the booking and moves a successful cancellation into history', async () => {
    const user = userEvent.setup();
    cancelBooking.mockResolvedValue({ ...coming, status: 'cancelled', cancellationEmail: { status: 'sent' } });
    showPage();
    await user.click(await screen.findByRole('button', { name: /open booking #1/i }));
    const actions = screen.getByRole('link', { name: 'View full details' }).parentElement;
    expect(Array.from(actions.children, element => element.textContent.trim())).toEqual([
      'View full details', 'Cancel booking', 'Change booking →',
    ]);
    await user.click(screen.getByRole('button', { name: 'Cancel booking' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cancel this booking?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByText('20 November 2027')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'View full details' })).not.toBeInTheDocument();
    expect(cancelBooking).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Keep booking' }));
    expect(cancelBooking).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancel booking' }));
    await user.click(screen.getByRole('button', { name: 'Confirm cancellation' }));
    expect(await screen.findByText(/Booking cancelled successfully. Cancellation email sent/)).toBeInTheDocument();
    expect(cancelBooking).toHaveBeenCalledExactlyOnceWith(1);
    expect(screen.getByRole('button', { name: /cancelled 2/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /upcoming 0/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel booking' })).not.toBeInTheDocument();
    expect(screen.getByText('Peanut allergy')).toBeInTheDocument();
    expect(screen.queryByText('Seating', { exact: true })).not.toBeInTheDocument();
    expect(screen.getByText('2 people')).toBeInTheDocument();
  });

  it('dismisses the modal with Escape or its close button without cancelling', async () => {
    const user = userEvent.setup();
    showPage();
    await user.click(await screen.findByRole('button', { name: /open booking #1/i }));
    const trigger = screen.getByRole('button', { name: 'Cancel booking' });
    await user.click(trigger);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Close cancellation dialog' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(cancelBooking).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /upcoming 1/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('allows cancelling past bookings but leaves them unchanged on a failed request', async () => {
    const user = userEvent.setup();
    cancelBooking.mockRejectedValue(new Error('Connection lost'));
    showPage(['/my-bookings?tab=past']);
    await user.click(await screen.findByRole('button', { name: /open booking #2/i }));
    await user.click(screen.getByRole('button', { name: 'Cancel booking' }));
    await user.click(screen.getByRole('button', { name: 'Confirm cancellation' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Connection lost');
    expect(cancelBooking).toHaveBeenCalledExactlyOnceWith(2);
    expect(screen.getByRole('button', { name: 'Confirm cancellation' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Keep booking' }));
    expect(screen.getByRole('button', { name: /past 1/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('blocks duplicate confirmation while cancellation is pending', async () => {
    const user = userEvent.setup();
    let finish;
    cancelBooking.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    showPage();
    await user.click(await screen.findByRole('button', { name: /open booking #1/i }));
    await user.click(screen.getByRole('button', { name: 'Cancel booking' }));
    await user.click(screen.getByRole('button', { name: 'Confirm cancellation' }));
    const pending = screen.getByRole('button', { name: 'Cancelling…' });
    expect(pending).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Keep booking' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Close cancellation dialog' })).toBeDisabled();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(pending);
    expect(cancelBooking).toHaveBeenCalledTimes(1);
    finish({ ...coming, status: 'cancelled', cancellationEmail: { status: 'failed' } });
    expect(await screen.findByText(/cancellation email could not be sent/)).toBeInTheDocument();
  });
});
