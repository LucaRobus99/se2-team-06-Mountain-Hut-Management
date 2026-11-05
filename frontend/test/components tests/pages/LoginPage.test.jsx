import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import LoginPage from '../../../src/pages/LoginPage.jsx';
import { useAuth } from '../../../src/auth/AuthContext.jsx';

// Mock AuthContext
vi.mock('../../../src/auth/AuthContext.jsx', () => ({
  useAuth: vi.fn(),
}));

describe('LoginPage Component Integration Tests', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render login form inputs and initial headings', () => {
    useAuth.mockReturnValue({ user: null, loadingAuth: false, signIn: vi.fn() });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i, { selector: 'input' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^log in$/i })).toBeInTheDocument();
  });

  it('should show error messages if fields are left empty on submit', async () => {
    useAuth.mockReturnValue({ user: null, loadingAuth: false, signIn: vi.fn() });

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const submitButton = screen.getByRole('button', { name: /^log in$/i });
    await user.click(submitButton);

    expect(await screen.findByText(/enter your email address/i)).toBeInTheDocument();
    expect(screen.getByText(/enter your password/i)).toBeInTheDocument();
  });

  it('should call signIn and handle successful authentication', async () => {
    const mockSignIn = vi.fn().mockResolvedValueOnce();
    useAuth.mockReturnValue({ user: null, loadingAuth: false, signIn: mockSignIn });

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/email/i), 'mario@hiker.com');
    await user.type(screen.getByLabelText(/password/i, { selector: 'input' }), 'password123');
    await user.click(screen.getByRole('button', { name: /^log in$/i }));

    expect(mockSignIn).toHaveBeenCalledWith({
      email: 'mario@hiker.com',
      password: 'password123'
    });
  });

  it('should display error message when signIn throws a general error', async () => {
    const mockSignIn = vi.fn().mockRejectedValueOnce(new Error('Unable to sign in. Please try again.'));
    useAuth.mockReturnValue({ user: null, loadingAuth: false, signIn: mockSignIn });

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/email/i), 'wrong@hiker.com');
    await user.type(screen.getByLabelText(/password/i, { selector: 'input' }), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /^log in$/i }));

    const errorAlert = await screen.findByRole('alert');
    expect(errorAlert).toHaveTextContent(/unable to sign in/i);
  });

});