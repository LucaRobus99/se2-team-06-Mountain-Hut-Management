import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import AppNavbar from '../../../src/components/AppNavbar.jsx';
import { useAuth } from '../../../src/auth/AuthContext.jsx';

// Mock the useAuth hook to control user authentication state and actions
vi.mock('../../../src/auth/AuthContext.jsx', () => ({
  useAuth: vi.fn(),
}));

describe('AppNavbar Component Integration Tests', () => {

  it('should render public navigation links and login option when user is not authenticated', () => {
    useAuth.mockReturnValue({
      user: null,
      loadingAuth: false,
      signOut: vi.fn(),
    });

    render(
      <MemoryRouter>
        <AppNavbar />
      </MemoryRouter>
    );

    // Verify public navigation items are present
    expect(screen.getByRole('link', { name: /^home$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^menu$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^availability$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^find us$/i })).toBeInTheDocument();

    // Verify Log in and Register links are visible, and account dropdown is not
    expect(screen.getByRole('link', { name: /^log in$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^register$/i })).toBeInTheDocument();
  });

  it('should render hiker user account info and correct booking link when logged in as a hiker', () => {
    useAuth.mockReturnValue({
      user: { id: 1, displayName: 'Mario Rossi', role: 'hiker' },
      loadingAuth: false,
      signOut: vi.fn(),
    });

    render(
      <MemoryRouter>
        <AppNavbar />
      </MemoryRouter>
    );

    // Verify user display name appears in the dropdown toggle title
    expect(screen.getByRole('button', { name: /mario rossi/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^my bookings$/i })).toHaveAttribute('href', '/my-bookings');
  });

  it('should render employee user account info correctly when logged in as an employee or warden', () => {
    useAuth.mockReturnValue({
      user: { id: 2, displayName: 'Staff Member', role: 'employee' },
      loadingAuth: false,
      signOut: vi.fn(),
    });

    render(
      <MemoryRouter>
        <AppNavbar />
      </MemoryRouter>
    );

    // Verify staff user display name appears in the dropdown toggle title
    expect(screen.getByRole('button', { name: /staff member/i })).toBeInTheDocument();
  });

  it('should call signOut and handle successful logout flow', async () => {
    const mockSignOut = vi.fn().mockResolvedValue(true);
    useAuth.mockReturnValue({
      user: { id: 1, displayName: 'Mario Rossi', role: 'hiker' },
      loadingAuth: false,
      signOut: mockSignOut,
    });

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AppNavbar />
      </MemoryRouter>
    );

    // Open the user account dropdown menu
    const dropdownToggle = screen.getByRole('button', { name: /mario rossi/i });
    await user.click(dropdownToggle);

    // Click on the Log out option
    const logoutItem = screen.getByText(/log out/i);
    await user.click(logoutItem);

    // Verify signOut was triggered
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('should display an alert message if logout fails', async () => {
    const mockSignOut = vi.fn().mockRejectedValue(new Error('Network failure during logout'));
    useAuth.mockReturnValue({
      user: { id: 1, displayName: 'Mario Rossi', role: 'hiker' },
      loadingAuth: false,
      signOut: mockSignOut,
    });

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AppNavbar />
      </MemoryRouter>
    );

    // Open dropdown and click log out
    await user.click(screen.getByRole('button', { name: /mario rossi/i }));
    await user.click(screen.getByText(/log out/i));

    // Wait for the error alert to appear in the document
    const errorAlert = await screen.findByRole('alert');
    expect(errorAlert).toHaveTextContent('Network failure during logout');
  });

});