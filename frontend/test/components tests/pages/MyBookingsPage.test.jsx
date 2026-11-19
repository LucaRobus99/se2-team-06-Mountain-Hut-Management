import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import MyBookingsPage from '../../../src/pages/MyBookingsPage.jsx';
import { getMyBookings } from '../../../src/api/booking.js';

// Mock the API module
vi.mock('../../../src/api/booking.js', () => ({
  getMyBookings: vi.fn(),
}));

describe('MyBookingsPage Component Integration Tests', () => {

  const mockBookingsList = [
    {
      id: 101,
      status: 'confirmed',
      partySize: 2,
      split: false,
      slot: { date: '2026-12-01', startTime: '12:00', endTime: '13:30', meal: 'lunch' }
    },
    {
      id: 102,
      status: 'confirmed',
      partySize: 4,
      split: true,
      slot: { date: '2025-01-01', startTime: '19:00', endTime: '20:30', meal: 'dinner' }
    },
    {
      id: 103,
      status: 'cancelled',
      partySize: 1,
      split: false,
      slot: { date: '2026-12-05', startTime: '12:00', meal: 'lunch' }
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially and then displays bookings grouped by filters', async () => {
    getMyBookings.mockResolvedValueOnce(mockBookingsList);

    render(
      <MemoryRouter>
        <MyBookingsPage />
      </MemoryRouter>
    );

    // Verify loading indicator is shown
    expect(screen.getByRole('status')).toHaveTextContent('Loading your bookings…');

    // Wait for bookings to load
    await waitFor(() => {
      expect(getMyBookings).toHaveBeenCalledTimes(1);
    });

    // Check header and category filters with counts
    expect(screen.getByRole('heading', { name: 'My Bookings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upcoming/i })).toHaveTextContent('Upcoming');
    expect(screen.getByRole('button', { name: /cancelled/i })).toHaveTextContent('Cancelled');

    // Default filter is 'upcoming', verify card details
    expect(screen.getByText('Booking #101')).toBeInTheDocument();
    expect(screen.getByText('Lunch')).toBeInTheDocument();
    
    // Verify split text match across multiple element nodes safely
    expect(screen.getByText((content, node) => {
      return node.tagName.toLowerCase() === 'span' && node.textContent.includes('2') && node.textContent.includes('guests');
    })).toBeInTheDocument();

    expect(screen.getByRole('link', { name: /view details/i })).toHaveAttribute('href', '/book/confirmation/101');
  });

  it('allows switching between filters and displays empty state when no bookings exist in a category', async () => {
    // Only return an upcoming booking, so past and cancelled will be empty
    getMyBookings.mockResolvedValueOnce([mockBookingsList[0]]);
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <MyBookingsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Booking #101')).toBeInTheDocument();
    });

    // Switch to 'Cancelled' filter which is empty
    const cancelledFilterBtn = screen.getByRole('button', { name: /cancelled/i });
    await user.click(cancelledFilterBtn);

    expect(screen.getByText('Nothing here yet')).toBeInTheDocument();
    expect(screen.getByText('You have no cancelled bookings.')).toBeInTheDocument();
  });

  it('handles API error correctly and allows retrying via Try again button', async () => {
    // First call rejects, second call succeeds (on retry)
    getMyBookings
      .mockRejectedValueOnce(new Error('Network failure'))
      .mockResolvedValueOnce(mockBookingsList);

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <MyBookingsPage />
      </MemoryRouter>
    );

    // Verify error state appears
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText("We couldn't load your bookings")).toBeInTheDocument();
    expect(screen.getByText('Network failure')).toBeInTheDocument();

    // Click 'Try again' button
    const retryButton = screen.getByRole('button', { name: /try again/i });
    await user.click(retryButton);

    // Verify it recovers and displays bookings successfully
    await waitFor(() => {
      expect(screen.getByText('Booking #101')).toBeInTheDocument();
    });
    expect(getMyBookings).toHaveBeenCalledTimes(2);
  });

  it('displays a specific fallback message when booking history service is disabled (404/405)', async () => {
    const error404 = new Error('Not found');
    error404.status = 404;
    getMyBookings.mockRejectedValueOnce(error404);

    render(
      <MemoryRouter>
        <MyBookingsPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Your bookings are not available yet. The booking history service has not been enabled.')).toBeInTheDocument();
  });

  it('displays empty state for upcoming bookings with a prompt to book a table', async () => {
    getMyBookings.mockResolvedValueOnce([]);

    render(
      <MemoryRouter>
        <MyBookingsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('You have no upcoming table bookings.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /book a table/i })).toHaveAttribute('href', '/availability');
  });

});