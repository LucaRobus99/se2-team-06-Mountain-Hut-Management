import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../../../src/auth/AuthContext.jsx';
import { getCurrentUser, login as apiLogin, logout as apiLogout, registerHiker as apiRegister } from '../../../src/api/auth.js';

// Mock the underlying API module functions
vi.mock('../../../src/api/auth.js', () => ({
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  registerHiker: vi.fn(),
}));

// Helper component to consume AuthContext values and expose actions to tests
function TestConsumer() {
  const { user, loadingAuth, authError, signIn, signUp, signOut, refreshUser } = useAuth();

  return (
    <div>
      <div data-testid="loading">{loadingAuth ? 'loading' : 'loaded'}</div>
      <div data-testid="user">{user ? JSON.stringify(user) : 'no-user'}</div>
      <div data-testid="error">{authError || 'no-error'}</div>

      <button onClick={() => signIn({ email: 'test@hiker.com', password: 'password' }).catch(() => {})}>
        Sign In
      </button>
      <button onClick={() => signUp({ name: 'New User', email: 'new@hiker.com', password: 'password' }).catch(() => {})}>
        Sign Up
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

  it('should successfully sign up a new user', async () => {
    getCurrentUser.mockRejectedValueOnce(new Error('Not logged in'));
    const mockRegisteredUser = { id: 3, displayName: 'New Hiker', role: 'hiker' };
    apiRegister.mockResolvedValueOnce(mockRegisteredUser);

    const user = userEvent.setup();

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
    });

    await user.click(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(mockRegisteredUser));
    });
    expect(apiRegister).toHaveBeenCalledTimes(1);
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

  it('should handle refreshUser and set user to null on 401 unauthorized', async () => {
    const mockUser = { id: 1, displayName: 'Mario Rossi', role: 'hiker' };
    getCurrentUser.mockResolvedValueOnce(mockUser);

    const user = userEvent.setup();

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(mockUser));
    });

    // Simulate refresh failing with a 401 error
    const authError401 = new Error('Session expired');
    authError401.status = 401;
    getCurrentUser.mockRejectedValueOnce(authError401);

    await user.click(screen.getByRole('button', { name: /refresh user/i }));

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    });
  });

  it('should throw an error if useAuth is used outside of AuthProvider', () => {
    // Suppress console.error for this specific expected error test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<TestConsumer />)).toThrow(
      'useAuth must be used inside AuthProvider.'
    );

    consoleSpy.mockRestore();
  });

  it('should update and return currentUser when refreshUser succeeds', async () => {
    const initialUser = { id: 1, displayName: 'Mario Rossi', role: 'hiker' };
    const refreshedUser = { id: 1, displayName: 'Mario Rossi', role: 'warden' };
    getCurrentUser.mockResolvedValueOnce(initialUser).mockResolvedValueOnce(refreshedUser);

    let latestAuth;
    function CaptureAuth() {
      latestAuth = useAuth();
      return <div data-testid="user">{latestAuth.user ? latestAuth.user.role : 'no-user'}</div>;
    }

    render(
      <AuthProvider>
        <CaptureAuth />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('hiker');
    });

    const returned = await latestAuth.refreshUser();
    expect(returned).toEqual(refreshedUser);

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('warden');
    });
  });

  it('should set user to null on UNAUTHENTICATED code and keep user on non-401 errors in refreshUser', async () => {
    const mockUser = { id: 1, displayName: 'Mario Rossi', role: 'hiker' };
    getCurrentUser.mockResolvedValueOnce(mockUser);

    let latestAuth;
    function CaptureAuth() {
      latestAuth = useAuth();
      return <div data-testid="user">{latestAuth.user ? JSON.stringify(latestAuth.user) : 'no-user'}</div>;
    }

    render(
      <AuthProvider>
        <CaptureAuth />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(mockUser));
    });

    // Non-401 error: user stays set and error is rethrown
    const networkError = new Error('Network down');
    networkError.status = 503;
    getCurrentUser.mockRejectedValueOnce(networkError);

    await expect(latestAuth.refreshUser()).rejects.toThrow('Network down');
    expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(mockUser));

    // UNAUTHENTICATED code: user is reset to null and error is rethrown
    const unauthCodeError = new Error('Session missing');
    unauthCodeError.code = 'UNAUTHENTICATED';
    getCurrentUser.mockRejectedValueOnce(unauthCodeError);

    await expect(latestAuth.refreshUser()).rejects.toThrow('Session missing');
    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    });
  });

  it('should ignore late getCurrentUser resolution after unmount', async () => {
    let resolveCurrentUser;
    getCurrentUser.mockImplementationOnce(
      () => new Promise((resolve) => { resolveCurrentUser = resolve; })
    );

    const { unmount } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('loading')).toHaveTextContent('loading');
    unmount();

    resolveCurrentUser({ id: 1, displayName: 'Late User', role: 'hiker' });
    await Promise.resolve();
    expect(getCurrentUser).toHaveBeenCalledTimes(1);
  });
  
});