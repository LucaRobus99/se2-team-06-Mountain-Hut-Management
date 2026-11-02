import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import BookingPage from '../../src/pages/BookingPage.jsx';
import { useAuth } from '../../src/auth/AuthContext.jsx';
import {
  getAvailableSlots,
  getSlotSeating,
  createBooking,
  simulateOtherBooking
} from '../../src/api/booking.js';

// Mock AuthContext and Booking API functions
vi.mock('../../src/auth/AuthContext.jsx', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../src/api/booking.js', () => ({
  getAvailableSlots: vi.fn(),
  getSlotSeating: vi.fn(),
  createBooking: vi.fn(),
  simulateOtherBooking: vi.fn(),
}));

describe('BookingPage Component Integration Tests', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
  });

  it('should render initial form fields and headings', () => {
    useAuth.mockReturnValue({ user: null, loadingAuth: false, refreshUser: vi.fn() });

    render(
      <MemoryRouter>
        <BookingPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Book a table' })).toBeInTheDocument();
    expect(screen.getByLabelText(/date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/guests/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/meal/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /find available times/i })).toBeInTheDocument();
  });

  it('should fetch and display available slots when searching', async () => {
    useAuth.mockReturnValue({ user: null, loadingAuth: false, refreshUser: vi.fn() });
    
    getAvailableSlots.mockResolvedValueOnce({
      date: '2026-11-15',
      meal: 'lunch',
      partySize: 2,
      slots: [
        { id: 1, startTime: '12:30', availableSeats: 4 }
      ]
    });

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <BookingPage />
      </MemoryRouter>
    );

    // Use a future date (>= 2026-11-01) to pass validation
    const dateInput = screen.getByLabelText(/date/i);
    fireEvent.change(dateInput, { target: { value: '2026-11-15' } });

    await user.selectOptions(screen.getByLabelText(/meal/i), 'lunch');
    await user.click(screen.getByRole('button', { name: /find available times/i }));

    const slotButton = await screen.findByRole('button', { name: /12:30 — 4 seats left/i });
    expect(slotButton).toBeInTheDocument();
  });

  it('should handle slot selection and show seating details', async () => {
    useAuth.mockReturnValue({ user: null, loadingAuth: false, refreshUser: vi.fn() });
    
    getAvailableSlots.mockResolvedValueOnce({
      date: '2026-11-15',
      meal: 'lunch',
      partySize: 2,
      slots: [
        { id: 1, startTime: '12:30', availableSeats: 4 }
      ]
    });
    getSlotSeating.mockResolvedValueOnce({
      fit: 'single_table',
      seatAssignments: [{ tableLabel: 'Table 1', seats: 2 }]
    });

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <BookingPage />
      </MemoryRouter>
    );

    const dateInput = screen.getByLabelText(/date/i);
    fireEvent.change(dateInput, { target: { value: '2026-11-15' } });

    await user.selectOptions(screen.getByLabelText(/meal/i), 'lunch');
    await user.click(screen.getByRole('button', { name: /find available times/i }));

    const slotButton = await screen.findByRole('button', { name: /12:30 — 4 seats left/i });
    await user.click(slotButton);

    expect(await screen.findByText(/Selected time: 12:30/i)).toBeInTheDocument();
    expect(screen.getByText(/Single table/i)).toBeInTheDocument();
    expect(screen.getByText(/Table 1: 2/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in to confirm/i })).toBeInTheDocument();
  });

  it('should successfully confirm booking when user is an authenticated hiker', async () => {
    const mockHiker = { id: 1, name: 'Mario', role: 'hiker' };
    const mockRefreshUser = vi.fn().mockResolvedValue(mockHiker);
    useAuth.mockReturnValue({ user: mockHiker, loadingAuth: false, refreshUser: mockRefreshUser });

    getAvailableSlots.mockResolvedValueOnce({
      date: '2026-11-15',
      meal: 'lunch',
      partySize: 2,
      slots: [
        { id: 1, startTime: '12:30', availableSeats: 4 }
      ]
    });
    getSlotSeating.mockResolvedValueOnce({
      fit: 'single_table',
      seatAssignments: [{ tableLabel: 'Table 1', seats: 2 }]
    });
    createBooking.mockResolvedValueOnce({
      id: 'REF-12345',
      slot: { date: '2026-11-15', meal: 'lunch', startTime: '12:30' },
      partySize: 2,
      contactName: 'Mario',
      split: false,
      seatAssignments: [{ tableLabel: 'Table 1', seats: 2 }]
    });

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <BookingPage />
      </MemoryRouter>
    );

    const dateInput = screen.getByLabelText(/date/i);
    fireEvent.change(dateInput, { target: { value: '2026-11-15' } });

    await user.selectOptions(screen.getByLabelText(/meal/i), 'lunch');
    await user.click(screen.getByRole('button', { name: /find available times/i }));

    const slotButton = await screen.findByRole('button', { name: /12:30 — 4 seats left/i });
    await user.click(slotButton);

    const confirmButton = await screen.findByRole('button', { name: /confirm booking/i });
    await user.click(confirmButton);

    expect(await screen.findByText(/Booking confirmed \(mock\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Reference: REF-12345/i)).toBeInTheDocument();
    expect(screen.getByText(/Contact: Mario/i)).toBeInTheDocument();
  });

});