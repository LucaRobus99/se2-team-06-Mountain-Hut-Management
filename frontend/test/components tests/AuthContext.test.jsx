import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../../src/auth/AuthContext.jsx';
import { getCurrentUser, login as apiLogin, logout as apiLogout } from '../../src/api/auth.js';

// Mock the underlying API module functions
vi.mock('../../src/api/auth.js', () => ({
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));

// Helper component to consume AuthContext values and expose actions to tests
function TestConsumer() {
  const { user, loadingAuth, authError, signIn, signOut, refreshUser } = useAuth();

  return (
    <div>
      <div data-testid="loading">{loadingAuth ? 'loading' : 'loaded'}</div>
      <div data-testid="user">{user ? JSON.stringify(user) : 'no-user'}</div>
      <div data-testid="error">{authError || 'no-error'}</div>
      
      <button onClick={() => signIn({ email: 'test@hiker.com', password: 'password' }).catch(() => {})}>
        Sign In
      </button>
      <button onClick={() => signOut().catch(() => {})}>Sign Out</button>
      <button onClick={() => refreshUser().catch(() => {})}>Refresh User</button>
    </div>
  );
}

describe('AuthContext Component Integration Tests', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully initialize and load user when getCurrentUser resolves', async () => {
    const mockUser = { id: 1, displayName: 'Mario Rossi', role: 'hiker' };
    getCurrentUser.mockResolvedValueOnce(mockUser);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    // Initially loading should be true
    expect(screen.getByTestId('loading')).toHaveTextContent('loading');

    // Wait for the asynchronous session check to finish
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
    });

    expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(mockUser));
    expect(screen.getByTestId('error')).toHaveTextContent('no-error');
  });

  it('should handle session check failure and set user to null on mount', async () => {
    getCurrentUser.mockRejectedValueOnce(new Error('Unauthorized session'));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
    });

    expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    expect(screen.getByTestId('error')).toHaveTextContent('Unauthorized session');
  });

  it('should successfully sign in a user', async () => {
    getCurrentUser.mockRejectedValueOnce(new Error('Not logged in'));
    const mockAuthenticatedUser = { id: 2, displayName: 'Staff Member', role: 'employee' };
    apiLogin.mockResolvedValueOnce(mockAuthenticatedUser);

    const user = userEvent.setup();

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
    });

    // Click sign in button
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(mockAuthenticatedUser));
    });
    expect(apiLogin).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('error')).toHaveTextContent('no-error');
  });

  it('should successfully sign out a user', async () => {
    const mockUser = { id: 1, displayName: 'Mario Rossi', role: 'hiker' };
    getCurrentUser.mockResolvedValueOnce(mockUser);
    apiLogout.mockResolvedValueOnce(true);

    const user = userEvent.setup();

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(mockUser));
    });

    // Click sign out button
    await user.click(screen.getByRole('button', { name: /sign out/i }));

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    });
    expect(apiLogout).toHaveBeenCalledTimes(1);
  });

  it('should throw an error if useAuth is used outside of AuthProvider', () => {
    // Suppress console.error for this specific expected error test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<TestConsumer />)).toThrow(
      'useAuth must be used inside AuthProvider.'
    );

    consoleSpy.mockRestore();
  });

});