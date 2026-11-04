import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import BookingPage from '../../../src/pages/BookingPage.jsx';
import { useAuth } from '../../../src/auth/AuthContext.jsx';
import { createBooking, getSlotSeating } from '../../../src/api/booking.js';

// Mock AuthContext and Booking API functions
vi.mock('../../../src/auth/AuthContext.jsx', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../../src/api/booking.js', () => ({
  getSlotSeating: vi.fn(),
  createBooking: vi.fn(),
  bookingErrorMessage: vi.fn((err) => err.message || 'Error'),
}));

describe('BookingPage Component Integration Tests', () => {

  const mockDraft = {
    date: '2026-11-15',
    meal: 'lunch',
    partySize: '2',
    selectedSlotId: 101,
    result: {
      date: '2026-11-15',
      meal: 'lunch',
      partySize: 2,
      slots: [
        { id: 101, startTime: '12:30', endTime: '14:00', availableSeats: 6 }
      ]
    },
    seating: {
      fit: 'single_table',
      seatAssignments: [{ tableLabel: 'Table 4', seats: 2 }]
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
  });

  it('should render review details correctly when bookingDraft is provided', () => {
    useAuth.mockReturnValue({ user: { id: 1, role: 'hiker' }, loadingAuth: false, refreshUser: vi.fn() });

    render(
      <MemoryRouter initialEntries={[{ pathname: '/book', state: { bookingDraft: mockDraft } }]}>
        <BookingPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Review your booking' })).toBeInTheDocument();
    expect(screen.getByText('15 November 2026')).toBeInTheDocument();
    expect(screen.getByText('12:30 – 14:00')).toBeInTheDocument();
    expect(screen.getByText('Lunch')).toBeInTheDocument();
    expect(screen.getByText('2 people')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm booking/i })).toBeInTheDocument();
  });

  it('should successfully confirm booking when user is an authenticated hiker', async () => {
    const mockHiker = { id: 1, name: 'Mario', role: 'hiker' };
    const mockRefreshUser = vi.fn().mockResolvedValue(mockHiker);
    useAuth.mockReturnValue({ user: mockHiker, loadingAuth: false, refreshUser: mockRefreshUser });

    getSlotSeating.mockResolvedValueOnce(mockDraft.seating);
    createBooking.mockResolvedValueOnce({
      id: 'REF-12345',
      slot: { date: '2026-11-15', meal: 'lunch', startTime: '12:30' },
      partySize: 2,
      contactName: 'Mario',
      split: false,
      seatAssignments: [{ tableLabel: 'Table 4', seats: 2 }]
    });

    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={[{ pathname: '/book', state: { bookingDraft: mockDraft } }]}>
        <BookingPage />
      </MemoryRouter>
    );

    const confirmButton = screen.getByRole('button', { name: /confirm booking/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Booking confirmed!' })).toBeInTheDocument();
    });

    expect(screen.getByText(/You’re all set! Your table is reserved/i)).toBeInTheDocument();
    expect(screen.getByText(/Book another table/i)).toBeInTheDocument();
    expect(screen.getByText(/Back to home/i)).toBeInTheDocument();
  });

});