import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import LoginPage from '../../src/pages/LoginPage.jsx';
import { useAuth } from '../../src/auth/AuthContext.jsx';

// Mock AuthContext
vi.mock('../../src/auth/AuthContext.jsx', () => ({
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

    expect(screen.getByRole('heading', { level: 1, name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
  });

  it('should show error message if fields are left empty on submit', async () => {
    useAuth.mockReturnValue({ user: null, loadingAuth: false, signIn: vi.fn() });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    // Eseguiamo il submit bypassando la validazione HTML nativa per testare la validazione React
    const form = screen.getByRole('button', { name: /^sign in$/i }).closest('form');
    fireEvent.submit(form);

    const errorAlert = await screen.findByText(/please enter your email and password/i);
    expect(errorAlert).toBeInTheDocument();
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
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(mockSignIn).toHaveBeenCalledWith({
      email: 'mario@hiker.com',
      password: 'password123'
    });
  });

  it('should display error message when signIn throws an error', async () => {
    const mockSignIn = vi.fn().mockRejectedValueOnce(new Error('Invalid credentials'));
    useAuth.mockReturnValue({ user: null, loadingAuth: false, signIn: mockSignIn });

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/email/i), 'wrong@hiker.com');
    await user.type(screen.getByLabelText(/password/i), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    const errorAlert = await screen.findByText(/invalid credentials/i);
    expect(errorAlert).toBeInTheDocument();
  });

});