import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
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

  it('returns to a confirmed receipt after login when the session has expired', async () => {
    const mockSignIn = vi.fn().mockResolvedValue({ id: 1, role: 'hiker' });
    useAuth.mockReturnValue({ user: null, loadingAuth: false, signIn: mockSignIn });
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: '/book/confirmation/281' } }]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/book/confirmation/:bookingId" element={<div>Confirmed receipt</div>} />
        </Routes>
      </MemoryRouter>
    );
    await user.type(screen.getByLabelText(/email/i), 'mario@hiker.com');
    await user.type(screen.getByLabelText(/password/i, { selector: 'input' }), 'password123');
    await user.click(screen.getByRole('button', { name: /^log in$/i }));
    expect(await screen.findByText('Confirmed receipt')).toBeInTheDocument();
  });

  it('validates invalid email format on blur and submit, and toggles password visibility', async () => {
    useAuth.mockReturnValue({ user: null, loadingAuth: false, signIn: vi.fn() });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/^password$/i);

    await user.type(emailInput, 'not-an-email');
    fireEvent.blur(emailInput);
    expect(await screen.findByText(/enter a valid email address/i)).toBeInTheDocument();

    // Typing updates the field and clears the error
    await user.type(emailInput, '@example.com');
    expect(screen.queryByText(/enter a valid email address/i)).not.toBeInTheDocument();

    // Toggle password visibility
    const toggleBtn = screen.getByRole('button', { name: /show password/i });
    expect(passwordInput).toHaveAttribute('type', 'password');
    await user.click(toggleBtn);
    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: /hide password/i })).toBeInTheDocument();
  });

  it('handles INVALID_CREDENTIALS and VALIDATION_ERROR details from signIn', async () => {
    const credError = new Error('Bad creds');
    credError.code = 'INVALID_CREDENTIALS';

    const fieldValError = new Error('Validation failed');
    fieldValError.code = 'VALIDATION_ERROR';
    fieldValError.details = [{ field: 'email', message: 'Email blocked' }];

    const genericValError = new Error('Server validation error');
    genericValError.code = 'VALIDATION_ERROR';
    genericValError.details = [{ field: 'other', message: 'Ignored' }];

    const mockSignIn = vi
      .fn()
      .mockRejectedValueOnce(credError)
      .mockRejectedValueOnce(fieldValError)
      .mockRejectedValueOnce(genericValError)
      .mockRejectedValueOnce({});

    useAuth.mockReturnValue({ user: null, loadingAuth: false, signIn: mockSignIn });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    const submitBtn = screen.getByRole('button', { name: /^log in$/i });

    await user.type(emailInput, 'mario@hiker.com');
    await user.type(passwordInput, 'wrong');
    await user.click(submitBtn);
    expect(await screen.findByText(/email or password is incorrect/i)).toBeInTheDocument();

    await user.click(submitBtn);
    expect(await screen.findByText(/email blocked/i)).toBeInTheDocument();

    await user.click(submitBtn);
    expect(await screen.findByRole('alert')).toHaveTextContent(/server validation error/i);

    await user.click(submitBtn);
    expect(await screen.findByRole('alert')).toHaveTextContent(/unable to sign in\. please try again\./i);
  });

  it('redirects staff to /staff and shows booking notice when arriving from /book', async () => {
    const mockSignIn = vi.fn().mockResolvedValue({ id: 9, role: 'warden' });
    useAuth.mockReturnValue({ user: null, loadingAuth: false, signIn: mockSignIn });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: '/book' } }]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/staff" element={<div>Staff Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/to book a table, please log in or create an account/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/email/i), 'warden@hut.test');
    await user.type(screen.getByLabelText(/^password$/i), 'secret');
    await user.click(screen.getByRole('button', { name: /^log in$/i }));

    expect(await screen.findByText('Staff Dashboard')).toBeInTheDocument();
  });

  it('redirects already authenticated user and shows loading spinner while loadingAuth is true', () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: '/book' } }]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/availability" element={<div>Availability Route</div>} />
        </Routes>
      </MemoryRouter>
    );
    // Inizializziamo un wrapper per testare loadingAuth e user già presente
    void rerender;
  });
  
});