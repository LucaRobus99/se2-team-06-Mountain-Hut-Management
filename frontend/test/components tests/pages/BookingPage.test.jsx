import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import BookingPage from '../../../src/pages/BookingPage.jsx';
import { useAuth } from '../../../src/auth/AuthContext.jsx';
import { createBooking, getBooking, getSlotSeating } from '../../../src/api/booking.js';
import { getPendingBooking, savePendingBooking } from '../../../src/utils/pendingBooking.js';

// Mock AuthContext and Booking API functions
vi.mock('../../../src/auth/AuthContext.jsx', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../../src/api/booking.js', () => ({
  getSlotSeating: vi.fn(),
  createBooking: vi.fn(),
  getBooking: vi.fn(),
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
    window.sessionStorage.clear();
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
      id: 281,
      slot: { date: '2026-11-15', meal: 'lunch', startTime: '12:30' },
      partySize: 2,
      contactName: 'Mario',
      split: false,
      seatAssignments: [{ tableLabel: 'Table 4', seats: 2 }]
    });

    getBooking.mockResolvedValue({
      id: 281,
      slot: { date: '2026-11-15', meal: 'lunch', startTime: '12:30', endTime: '14:00' },
      partySize: 2, split: false, email: 'mario@example.org',
    });
    const user = userEvent.setup();

    const view = render(
      <MemoryRouter initialEntries={[{ pathname: '/book', state: { bookingDraft: mockDraft } }]}>
        <Routes>
          <Route path="/book" element={<BookingPage />} />
          <Route path="/book/confirmation/:bookingId" element={<BookingPage />} />
        </Routes>
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
    expect(createBooking).toHaveBeenCalledTimes(1);
    expect(getBooking).toHaveBeenCalledWith(281);

    // F5 remounts the app on the receipt URL without the review draft.
    view.unmount();
    render(
      <MemoryRouter initialEntries={['/book/confirmation/281']}>
        <Routes><Route path="/book/confirmation/:bookingId" element={<BookingPage />} /></Routes>
      </MemoryRouter>
    );
    expect(await screen.findByRole('heading', { name: 'Booking confirmed!' })).toBeInTheDocument();
    expect(createBooking).toHaveBeenCalledTimes(1); // A refresh never creates another booking.
    expect(getBooking).toHaveBeenCalledTimes(2);
  });

  it('Back returns to availability and discards the previous booking draft', async () => {
    useAuth.mockReturnValue({ user: { id: 1, role: 'hiker' }, loadingAuth: false });
    savePendingBooking(mockDraft);
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={[{ pathname: '/book', state: { bookingDraft: mockDraft } }]}>
        <Routes>
          <Route path="/book" element={<BookingPage />} />
          <Route path="/availability" element={<div>Availability search</div>} />
        </Routes>
      </MemoryRouter>
    );

    await user.click(screen.getByRole('link', { name: 'Back' }));
    expect(screen.getByText('Availability search')).toBeInTheDocument();
    expect(getPendingBooking()).toBeNull();
  });

  it('an already booked slot can return to availability to select another time', async () => {
    const mockHiker = { id: 1, role: 'hiker' };
    useAuth.mockReturnValue({ user: mockHiker, loadingAuth: false, refreshUser: vi.fn().mockResolvedValue(mockHiker) });
    getSlotSeating.mockResolvedValue(mockDraft.seating);
    createBooking.mockRejectedValue(Object.assign(new Error('Duplicate booking'), { code: 'BOOKING_ALREADY_EXISTS', status: 409 }));
    savePendingBooking(mockDraft);
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={[{ pathname: '/book', state: { bookingDraft: mockDraft } }]}>
        <Routes>
          <Route path="/book" element={<BookingPage />} />
          <Route path="/availability" element={<div>Availability search</div>} />
        </Routes>
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Confirm booking' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('You already have a reservation');
    await user.click(screen.getByRole('button', { name: 'Choose another time' }));
    expect(screen.getByText('Availability search')).toBeInTheDocument();
    expect(getPendingBooking()).toBeNull();
  });

  it('Choose another time in the split-seating dialog returns to Availability', async () => {
    const mockHiker = { id: 1, role: 'hiker' };
    useAuth.mockReturnValue({ user: mockHiker, loadingAuth: false, refreshUser: vi.fn().mockResolvedValue(mockHiker) });
    getSlotSeating.mockResolvedValue({ fit: 'split', requiresConfirmation: true, seatAssignments: [{ seats: 1 }, { seats: 1 }] });
    savePendingBooking(mockDraft);
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={[{ pathname: '/book', state: { bookingDraft: mockDraft } }]}>
        <Routes>
          <Route path="/book" element={<BookingPage />} />
          <Route path="/availability" element={<div>Availability search</div>} />
        </Routes>
      </MemoryRouter>
    );
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }));
    await user.click(await screen.findByRole('button', { name: 'Choose another time' }));
    expect(screen.getByText('Availability search')).toBeInTheDocument();
    expect(createBooking).not.toHaveBeenCalled();
    expect(getPendingBooking()).toBeNull();
  });

  it('collects multiple independent requirements and sends their allergy flags on booking', async () => {
    const hiker = { id: 1, role: 'hiker' };
    useAuth.mockReturnValue({ user: hiker, loadingAuth: false, refreshUser: vi.fn().mockResolvedValue(hiker) });
    getSlotSeating.mockResolvedValue(mockDraft.seating);
    createBooking.mockResolvedValue({ id: 282, confirmationEmail: { status: 'skipped' } });
    getBooking.mockResolvedValue({
      id: 282,
      slot: { date: '2026-11-15', meal: 'lunch', startTime: '12:30', endTime: '14:00' },
      partySize: 2, split: false,
      requirements: [
        { description: '1 guest with peanut allergy', allergies: true },
        { description: '1 vegetarian guest', allergies: false },
      ],
    });
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[{ pathname: '/book', state: { bookingDraft: mockDraft } }]}>
        <Routes>
          <Route path="/book" element={<BookingPage />} />
          <Route path="/book/confirmation/:bookingId" element={<BookingPage />} />
        </Routes>
      </MemoryRouter>
    );
    await user.click(screen.getByRole('button', { name: /add dietary requirement/i }));
    await user.click(screen.getByRole('button', { name: /add dietary requirement/i }));
    await user.type(screen.getAllByRole('textbox')[0], '1 guest with peanut allergy');
    await user.type(screen.getAllByRole('textbox')[1], '1 vegetarian guest');
    await user.click(screen.getAllByRole('checkbox')[0]);
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }));
    await waitFor(() => expect(createBooking).toHaveBeenCalledWith({
      slotId: 101,
      partySize: 2,
      requirements: [
        { id: 1, description: '1 guest with peanut allergy', allergies: true },
        { id: 2, description: '1 vegetarian guest', allergies: false },
      ],
    }));
    expect(await screen.findByRole('heading', { name: 'Booking confirmed!' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /confirmed dietary requirements/i })).toHaveTextContent('peanut allergy');
    expect(screen.getByRole('region', { name: /confirmed dietary requirements/i })).toHaveTextContent('Allergy — special care required');
  });

  it('does not submit booking while a dietary entry has no description', async () => {
    const hiker = { id: 1, role: 'hiker' };
    useAuth.mockReturnValue({ user: hiker, loadingAuth: false, refreshUser: vi.fn().mockResolvedValue(hiker) });
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[{ pathname: '/book', state: { bookingDraft: mockDraft } }]}>
        <BookingPage />
      </MemoryRouter>
    );
    await user.click(screen.getByRole('button', { name: /add dietary requirement/i }));
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }));
    expect(screen.getByText(/Please describe dietary requirement 1/i)).toBeInTheDocument();
    expect(getSlotSeating).not.toHaveBeenCalled();
    expect(createBooking).not.toHaveBeenCalled();
  });

  it('hides sensitive requirement fields until the hiker has signed in', () => {
    useAuth.mockReturnValue({ user: null, loadingAuth: false });
    render(
      <MemoryRouter initialEntries={[{ pathname: '/book', state: { bookingDraft: mockDraft } }]}>
        <BookingPage />
      </MemoryRouter>
    );
    expect(screen.getByText(/Sign in to add dietary requirements/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add dietary requirement/i })).not.toBeInTheDocument();
  });

});