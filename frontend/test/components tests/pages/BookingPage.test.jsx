import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import BookingPage from '../../../src/pages/BookingPage.jsx';
import { useAuth } from '../../../src/auth/AuthContext.jsx';
import { createBooking, getBooking, getSlotSeating, checkSlotBooking } from '../../../src/api/booking.js';
import { getPendingBooking, savePendingBooking } from '../../../src/utils/pendingBooking.js';

// Mock AuthContext and Booking API functions
vi.mock('../../../src/auth/AuthContext.jsx', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../../src/api/booking.js', () => ({
  getSlotSeating: vi.fn(),
  checkSlotBooking: vi.fn(),
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
    checkSlotBooking.mockResolvedValue(false);
    window.sessionStorage.clear();
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
  });

  it('should render review details correctly when bookingDraft is provided', async () => {
    useAuth.mockReturnValue({ user: { id: 1, role: 'hiker' }, loadingAuth: false, refreshUser: vi.fn() });

    render(
      <MemoryRouter initialEntries={[{ pathname: '/book', state: { bookingDraft: mockDraft } }]}>
        <BookingPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { level: 1, name: 'Review your booking' })).toBeInTheDocument();
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

    const confirmButton = await screen.findByRole('button', { name: /confirm booking/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Your table is booked!' })).toBeInTheDocument();
    });

    expect(screen.getByText(/Edelweiss Hut · Reservation #281/i)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /confirmed dietary requirements/i })).not.toBeInTheDocument();
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
    expect(await screen.findByRole('heading', { name: 'Your table is booked!' })).toBeInTheDocument();
    expect(createBooking).toHaveBeenCalledTimes(1); // A refresh never creates another booking.
    expect(getBooking).toHaveBeenCalledTimes(2);
  });

  it.each(['sent', 'failed'])('shows the correct email notice when the provider status is %s', async status => {
    useAuth.mockReturnValue({ user: { id: 1, role: 'hiker' }, loadingAuth: false });
    getBooking.mockResolvedValueOnce({
      id: 281, status: 'confirmed', partySize: 2, split: false, confirmationEmail: { status },
      slot: { date: '2026-11-15', meal: 'lunch', startTime: '12:30', endTime: '14:00' },
    });
    render(<MemoryRouter initialEntries={['/book/confirmation/281']}>
      <Routes><Route path="/book/confirmation/:bookingId" element={<BookingPage />} /></Routes>
    </MemoryRouter>);
    const title = await screen.findByText(status === 'sent' ? 'Confirmation email sent' : 'Email could not be sent');
    expect(title.parentElement).toHaveClass(`eh-booking-email-notice--${status}`);
    if (status === 'failed') expect(title.parentElement).toHaveTextContent('Please keep your booking reference: #281.');
  });

  it('shows a cancelled receipt without a successful booking or email confirmation', async () => {
    useAuth.mockReturnValue({ user: { id: 1, role: 'hiker' }, loadingAuth: false });
    getBooking.mockResolvedValueOnce({
      id: 281, status: 'cancelled', partySize: 2, split: false,
      slot: { date: '2026-11-15', meal: 'lunch', startTime: '12:30', endTime: '14:00' },
    });
    render(<MemoryRouter initialEntries={['/book/confirmation/281']}>
      <Routes><Route path="/book/confirmation/:bookingId" element={<BookingPage />} /></Routes>
    </MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Your booking was cancelled' })).toBeInTheDocument();
    expect(screen.queryByText('Your table is booked!')).not.toBeInTheDocument();
    expect(screen.queryByText('Confirmation email sent')).not.toBeInTheDocument();
    expect(screen.queryByText('Seating', { exact: true })).not.toBeInTheDocument();
    expect(screen.getByText('2 people')).toBeInTheDocument();
    const actions = screen.getByRole('link', { name: /Back to My Bookings/i }).parentElement;
    expect(Array.from(actions.children, link => link.textContent.trim())).toEqual(['← Back to My Bookings', 'Book another table', 'Back to home']);
    expect(screen.getByRole('link', { name: /Back to My Bookings/i })).toHaveAttribute('href', '/my-bookings?tab=cancelled');
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

    await user.click(await screen.findByRole('link', { name: 'Back' }));
    expect(screen.getByText('Availability search')).toBeInTheDocument();
    expect(getPendingBooking()).toBeNull();
  });

  it('blocks an already booked slot before loading the dietary review', async () => {
    const mockHiker = { id: 1, role: 'hiker' };
    useAuth.mockReturnValue({ user: mockHiker, loadingAuth: false, refreshUser: vi.fn().mockResolvedValue(mockHiker) });
    checkSlotBooking.mockResolvedValue(true);
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

    expect(await screen.findByRole('heading', { name: /you're already booked/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add dietary requirement/i })).not.toBeInTheDocument();
    expect(createBooking).not.toHaveBeenCalled();
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
    await user.click(await screen.findByRole('button', { name: 'Confirm booking' }));
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
    await user.click(await screen.findByRole('button', { name: /add dietary requirement/i }));
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
    expect(await screen.findByRole('heading', { name: 'Your table is booked!' })).toBeInTheDocument();
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
    await user.click(await screen.findByRole('button', { name: /add dietary requirement/i }));
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }));
    expect(screen.getByText(/Please describe dietary requirement 1/i)).toBeInTheDocument();
    expect(getSlotSeating).not.toHaveBeenCalled();
    expect(createBooking).not.toHaveBeenCalled();
  });

  it('hides sensitive requirement fields until the hiker has signed in', async () => {
    useAuth.mockReturnValue({ user: null, loadingAuth: false });
    render(
      <MemoryRouter initialEntries={[{ pathname: '/book', state: { bookingDraft: mockDraft } }]}>
        <BookingPage />
      </MemoryRouter>
    );
    expect(await screen.findByText(/Sign in to add dietary requirements/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add dietary requirement/i })).not.toBeInTheDocument();
  });

  it('prevents non-hiker accounts from confirming a booking', async () => {
    const mockStaff = { id: 2, role: 'staff' };
    useAuth.mockReturnValue({ user: mockStaff, loadingAuth: false, refreshUser: vi.fn().mockResolvedValue(mockStaff) });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={[{ pathname: '/book', state: { bookingDraft: mockDraft } }]}>
        <Routes>
          <Route path="/book" element={<BookingPage />} />
        </Routes>
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: /confirm booking/i }));
    expect(screen.getByText('Only Hiker accounts can book online.')).toBeInTheDocument();
    expect(createBooking).not.toHaveBeenCalled();
  });

  it('redirects an inaccessible receipt to My Bookings without revealing booking details', async () => {
    useAuth.mockReturnValue({ user: { id: 1, role: 'hiker' }, loadingAuth: false });
    getBooking.mockRejectedValueOnce(Object.assign(new Error('Booking not found.'), { status: 404, code: 'BOOKING_NOT_FOUND' }));

    render(
      <MemoryRouter initialEntries={['/book/confirmation/999']}>
        <Routes>
          <Route path="/book/confirmation/:bookingId" element={<BookingPage />} />
          <Route path="/my-bookings" element={<div>My own bookings</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('My own bookings')).toBeInTheDocument();
    expect(screen.queryByText('Booking not found.')).not.toBeInTheDocument();
  });

  it('redirects malformed references without attempting a receipt request', async () => {
    useAuth.mockReturnValue({ user: { id: 1, role: 'hiker' }, loadingAuth: false });
    render(<MemoryRouter initialEntries={['/book/confirmation/invalid']}>
      <Routes><Route path="/book/confirmation/:bookingId" element={<BookingPage />} />
        <Route path="/my-bookings" element={<div>My own bookings</div>} /></Routes>
    </MemoryRouter>);
    expect(await screen.findByText('My own bookings')).toBeInTheDocument();
    expect(getBooking).not.toHaveBeenCalled();
  });

  it('offers retry for a network failure instead of redirecting as if the booking were missing', async () => {
    useAuth.mockReturnValue({ user: { id: 1, role: 'hiker' }, loadingAuth: false });
    getBooking.mockRejectedValueOnce(new Error('Connection interrupted.'));
    getBooking.mockResolvedValueOnce({ id: 999, status: 'confirmed', partySize: 2, split: false,
      slot: { date: '2027-06-15', meal: 'lunch', startTime: '12:00', endTime: '13:00' } });
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/book/confirmation/999']}>
      <Routes><Route path="/book/confirmation/:bookingId" element={<BookingPage />} /></Routes>
    </MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't load your reservation");
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Your table is booked!' })).toBeInTheDocument();
  });

  it('revalidates the receipt if the signed-in hiker changes on the same URL', async () => {
    useAuth.mockReturnValue({ user: { id: 1, role: 'hiker' }, loadingAuth: false });
    getBooking.mockResolvedValueOnce({ id: 999, status: 'confirmed', partySize: 2, split: false,
      slot: { date: '2027-06-15', meal: 'lunch', startTime: '12:00', endTime: '13:00' } });
    const page = () => <MemoryRouter initialEntries={['/book/confirmation/999']}>
      <Routes><Route path="/book/confirmation/:bookingId" element={<BookingPage />} />
        <Route path="/my-bookings" element={<div>My own bookings</div>} /></Routes>
    </MemoryRouter>;
    const view = render(page());
    expect(await screen.findByRole('heading', { name: 'Your table is booked!' })).toBeInTheDocument();
    useAuth.mockReturnValue({ user: { id: 2, role: 'hiker' }, loadingAuth: false });
    getBooking.mockRejectedValueOnce(Object.assign(new Error('Not found.'), { status: 404 }));
    view.rerender(page());
    expect(screen.queryByText('Your table is booked!')).not.toBeInTheDocument();
    expect(await screen.findByText('My own bookings')).toBeInTheDocument();
  });

  it('handles stale slot selection errors and prompts to check availability again', async () => {
    const mockHiker = { id: 1, role: 'hiker' };
    useAuth.mockReturnValue({ user: mockHiker, loadingAuth: false, refreshUser: vi.fn().mockResolvedValue(mockHiker) });
    getSlotSeating.mockResolvedValue(mockDraft.seating);
    createBooking.mockRejectedValueOnce(Object.assign(new Error('Slot expired'), { code: 'SLOT_NOT_AVAILABLE', status: 400 }));
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={[{ pathname: '/book', state: { bookingDraft: mockDraft } }]}>
        <Routes>
          <Route path="/book" element={<BookingPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for initial prechecking to finish and confirm button to appear
    const confirmButton = await screen.findByRole('button', { name: /confirm booking/i });
    await user.click(confirmButton);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /check availability again/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /confirm booking/i })).not.toBeInTheDocument();
  });

  it('redirects to login if user session expires during confirmation refresh', async () => {
    const mockHiker = { id: 1, role: 'hiker' };
    const mockRefreshUser = vi.fn().mockResolvedValue(null); // Session lost
    useAuth.mockReturnValue({ user: mockHiker, loadingAuth: false, refreshUser: mockRefreshUser });
    getSlotSeating.mockResolvedValue(mockDraft.seating);
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={[{ pathname: '/book', state: { bookingDraft: mockDraft } }]}>
        <Routes>
          <Route path="/book" element={<BookingPage />} />
          <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for initial prechecking to finish and confirm button to appear
    const confirmButton = await screen.findByRole('button', { name: /confirm booking/i });
    await user.click(confirmButton);
    
    expect(await screen.findByTestId('login-page')).toBeInTheDocument();
  });

  it('redirects to login if createBooking returns UNAUTHENTICATED error', async () => {
    const mockHiker = { id: 1, role: 'hiker' };
    useAuth.mockReturnValue({ user: mockHiker, loadingAuth: false, refreshUser: vi.fn().mockResolvedValue(mockHiker) });
    getSlotSeating.mockResolvedValue(mockDraft.seating);
    createBooking.mockRejectedValueOnce(Object.assign(new Error('Session expired'), { code: 'UNAUTHENTICATED', status: 401 }));
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={[{ pathname: '/book', state: { bookingDraft: mockDraft } }]}>
        <Routes>
          <Route path="/book" element={<BookingPage />} />
          <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for initial prechecking to finish and confirm button to appear
    const confirmButton = await screen.findByRole('button', { name: /confirm booking/i });
    await user.click(confirmButton);

    // Wait for the async re-authentication / unauthenticated handler to redirect to login
    expect(await screen.findByTestId('login-page')).toBeInTheDocument();
  });
});
