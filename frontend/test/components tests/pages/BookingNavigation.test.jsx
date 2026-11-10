import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet } from 'react-router';
import App from '../../../src/App.jsx';
import { useAuth } from '../../../src/auth/AuthContext.jsx';

vi.mock('../../../src/auth/AuthContext.jsx', () => ({ useAuth: vi.fn() }));
vi.mock('../../../src/layouts/MainLayout.jsx', () => ({ default: () => <Outlet /> }));
vi.mock('../../../src/pages/AvailabilityPage.jsx', () => ({ default: () => <h1>Availability search</h1> }));
vi.mock('../../../src/pages/BookingPage.jsx', () => ({ default: () => <h1>Booking review</h1> }));
vi.mock('../../../src/utils/pendingBooking.js', () => ({
  getPendingBooking: () => ({ selectedSlotId: 101, partySize: 2, date: '2026-11-15' }),
}));

describe('Booking navigation route', () => {
  it('shows Availability to a logged-in hiker even with a saved booking draft', () => {
    useAuth.mockReturnValue({ user: { id: 1, role: 'hiker' }, loadingAuth: false });
    render(<MemoryRouter initialEntries={['/availability?date=2026-11-15&meal=lunch&guests=2']}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Availability search' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Booking review' })).not.toBeInTheDocument();
  });
});
