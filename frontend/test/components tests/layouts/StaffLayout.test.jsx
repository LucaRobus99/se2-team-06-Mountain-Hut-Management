import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router';
import StaffLayout from '../../../src/layouts/StaffLayout.jsx';
import { useAuth } from '../../../src/auth/AuthContext.jsx';

// Mock AuthContext
vi.mock('../../../src/auth/AuthContext.jsx', () => ({
  useAuth: vi.fn(),
}));

describe('StaffLayout Component Integration Tests', () => {
  const mockSignOut = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render staff sidebar navigation, user details, and outlet content', () => {
    useAuth.mockReturnValue({
      user: { displayName: 'Mario Rossi', role: 'warden' },
      signOut: mockSignOut,
    });

    render(
      <MemoryRouter initialEntries={['/staff']}>
        <Routes>
          <Route element={<StaffLayout />}>
            <Route path="/staff" element={<div data-testid="staff-outlet">Dashboard View</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    // Verify sidebar navigation links
    expect(screen.getByRole('link', { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /manage slots/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /reservations/i })).toBeInTheDocument();

    // Verify user display name, role, and initials avatar (targeting specific class to avoid multiple matches)
    expect(screen.getByText('Mario Rossi')).toBeInTheDocument();
    expect(screen.getByText('Warden')).toBeInTheDocument();
    expect(screen.getByText('MR', { selector: '.staff-avatar' })).toBeInTheDocument();

    // Verify topbar greeting and child outlet rendering
    expect(screen.getByText(/welcome,/i)).toHaveTextContent('Mario');
    expect(screen.getByTestId('staff-outlet')).toBeInTheDocument();
  });

  it('should successfully call signOut and navigate home when clicking sign out', async () => {
    mockSignOut.mockResolvedValueOnce();
    useAuth.mockReturnValue({
      user: { displayName: 'Giulia Bianchi', role: 'employee' },
      signOut: mockSignOut,
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/staff']}>
        <Routes>
          <Route path="/" element={<div data-testid="home-page">Home Page</div>} />
          <Route element={<StaffLayout />}>
            <Route path="/staff" element={<div data-testid="staff-outlet">Dashboard View</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    // Click sign out button
    const signOutButton = screen.getByRole('button', { name: /sign out/i });
    await user.click(signOutButton);

    // Verify signOut was triggered and navigation redirected to root
    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('home-page')).toBeInTheDocument();
    });
  });

  it('should display error message if sign out fails', async () => {
    mockSignOut.mockRejectedValueOnce(new Error('Logout failed on server'));
    useAuth.mockReturnValue({
      user: { displayName: 'Luca Verdi', role: 'employee' },
      signOut: mockSignOut,
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/staff']}>
        <Routes>
          <Route element={<StaffLayout />}>
            <Route path="/staff" element={<div data-testid="staff-outlet">Dashboard View</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    // Click sign out button
    const signOutButton = screen.getByRole('button', { name: /sign out/i });
    await user.click(signOutButton);

    // Verify error alert is displayed
    const errorAlert = await screen.findByRole('alert');
    expect(errorAlert).toHaveTextContent(/logout failed on server/i);
  });

  it('should toggle mobile menu navigation when hamburger button is clicked', async () => {
    useAuth.mockReturnValue({
      user: { displayName: 'Staff User', role: 'employee' },
      signOut: mockSignOut,
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/staff']}>
        <Routes>
          <Route element={<StaffLayout />}>
            <Route path="/staff" element={<div data-testid="staff-outlet">Dashboard View</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    // Find mobile toggle button and check initial aria-expanded state
    const toggleButton = screen.getByRole('button', { name: /toggle staff navigation/i });
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');

    // Click to open sidebar
    await user.click(toggleButton);
    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('should close mobile menu when clicking backdrop or a navigation link', async () => {
    useAuth.mockReturnValue({
      user: { displayName: 'Staff User', role: 'employee' },
      signOut: mockSignOut,
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/staff']}>
        <Routes>
          <Route element={<StaffLayout />}>
            <Route path="/staff" element={<div data-testid="staff-outlet">Dashboard View</div>} />
            <Route path="/staff/slots" element={<div data-testid="slots-outlet">Slots View</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    const toggleButton = screen.getByRole('button', { name: /toggle staff navigation/i });
    await user.click(toggleButton);
    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');

    // Close via backdrop
    await user.click(screen.getByRole('button', { name: /close navigation/i }));
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');

    // Reopen and close via a NavLink click
    await user.click(toggleButton);
    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');

    await user.click(screen.getByRole('link', { name: /manage slots/i }));
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('slots-outlet')).toBeInTheDocument();
  });

  it('should render fallback labels when user or displayName is missing and use default logout error message', async () => {
    mockSignOut.mockRejectedValueOnce({});
    useAuth.mockReturnValue({
      user: null,
      signOut: mockSignOut,
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/staff']}>
        <Routes>
          <Route element={<StaffLayout />}>
            <Route path="/staff" element={<div data-testid="staff-outlet">Dashboard View</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Staff')).toBeInTheDocument();
    expect(screen.getByText('Employee')).toBeInTheDocument();
    expect(screen.getByText('ST', { selector: '.staff-avatar' })).toBeInTheDocument();
    expect(screen.getByText(/welcome,/i)).toHaveTextContent('Team member');

    await user.click(screen.getByRole('button', { name: /sign out/i }));
    const errorAlert = await screen.findByRole('alert');
    expect(errorAlert).toHaveTextContent('Could not log out.');
  });
});