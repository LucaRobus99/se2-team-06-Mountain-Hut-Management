import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import AvailabilityPage from '../../../src/pages/AvailabilityPage.jsx';
import { useAuth } from '../../../src/auth/AuthContext.jsx';
import { getAvailableSlots, getSlotSeating } from '../../../src/api/booking.js';

// Mock AuthContext and API functions
vi.mock('../../../src/auth/AuthContext.jsx', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../../src/api/booking.js', () => ({
  getAvailableSlots: vi.fn(),
  getSlotSeating: vi.fn(),
}));

describe('AvailabilityPage Component Integration Tests', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
  });

  it('should render the availability form inputs and initial headings', () => {
    useAuth.mockReturnValue({ user: null });

    render(
      <MemoryRouter>
        <AvailabilityPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Check availability' })).toBeInTheDocument();

    expect(screen.getByLabelText(/date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/meal/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/guests/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
  });

  it('should fetch and display available slots on form submission', async () => {
    useAuth.mockReturnValue({ user: null });
    const mockSlotsResponse = {
      date: '2026-11-15',
      meal: 'lunch',
      partySize: 2,
      slots: [
        { id: 101, startTime: '12:30', availableSeats: 6 },
        { id: 102, startTime: '13:15', availableSeats: 4 }
      ]
    };
    getAvailableSlots.mockResolvedValueOnce(mockSlotsResponse);

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AvailabilityPage />
      </MemoryRouter>
    );

    const dateInput = screen.getByLabelText(/date/i);
    fireEvent.change(dateInput, { target: { value: '2026-11-15' } });

    await user.click(screen.getByRole('button', { name: /search/i }));

    const timeElement = await screen.findByText('12:30');
    expect(timeElement).toBeInTheDocument();
    expect(screen.getAllByText(/available for your group/i)[0]).toBeInTheDocument();
  });

  it('should handle slot selection and display seating details panel', async () => {
    useAuth.mockReturnValue({ user: { id: 1, role: 'hiker' } });
    const mockSlotsResponse = {
      date: '2026-11-15',
      meal: 'lunch',
      partySize: 2,
      slots: [{ id: 101, startTime: '12:30', availableSeats: 6 }]
    };
    const mockSeatingResponse = {
      fit: 'single_table',
      seatAssignments: [{ tableLabel: 'Table 4', seats: 2 }]
    };

    getAvailableSlots.mockResolvedValueOnce(mockSlotsResponse);
    getSlotSeating.mockResolvedValueOnce(mockSeatingResponse);

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AvailabilityPage />
      </MemoryRouter>
    );

    const dateInput = screen.getByLabelText(/date/i);
    fireEvent.change(dateInput, { target: { value: '2026-11-15' } });

    await user.click(screen.getByRole('button', { name: /search/i }));

    await screen.findByText('12:30');

    // Click on the slot card matching the 12:30 time slot button
    const slotButton = screen.getByRole('button', { name: /12:30/i });
    await user.click(slotButton);

    await waitFor(() => {
      expect(screen.getByText(/single table/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /continue to booking/i })).toBeInTheDocument();
  });

  it('should display error message if search fails', async () => {
    useAuth.mockReturnValue({ user: null });
    getAvailableSlots.mockRejectedValueOnce(new Error('Database connection error'));

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AvailabilityPage />
      </MemoryRouter>
    );

    const dateInput = screen.getByLabelText(/date/i);
    fireEvent.change(dateInput, { target: { value: '2026-11-15' } });

    await user.click(screen.getByRole('button', { name: /search/i }));

    const errorAlert = await screen.findByText(/database connection error/i);
    expect(errorAlert).toBeInTheDocument();
  });

});