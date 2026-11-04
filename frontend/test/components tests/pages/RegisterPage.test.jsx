import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import RegisterPage from '../../../src/pages/RegisterPage.jsx';
import { useAuth } from '../../../src/auth/AuthContext.jsx';

// Mock AuthContext
vi.mock('../../../src/auth/AuthContext.jsx', () => ({
  useAuth: vi.fn(),
}));

describe('RegisterPage Component Integration Tests', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render registration form inputs and heading', () => {
    useAuth.mockReturnValue({ user: null, loadingAuth: false, signUp: vi.fn() });

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    // Verify heading and main input fields
    expect(screen.getByRole('heading', { level: 1, name: /create your account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/mobile number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i, { selector: 'input' })).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i, { selector: 'input' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^create account/i })).toBeInTheDocument();
  });

  it('should show validation error messages if required fields are submitted empty', async () => {
    useAuth.mockReturnValue({ user: null, loadingAuth: false, signUp: vi.fn() });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    // Submit form without filling fields
    const submitButton = screen.getByRole('button', { name: /^create account/i });
    await user.click(submitButton);

    // Verify validation messages appear
    expect(await screen.findByText(/enter your full name/i)).toBeInTheDocument();
    expect(screen.getByText(/enter your mobile number/i)).toBeInTheDocument();
    expect(screen.getByText(/enter your email address/i)).toBeInTheDocument();
    expect(screen.getByText(/choose a password/i)).toBeInTheDocument();
    expect(screen.getByText(/confirm your password/i)).toBeInTheDocument();
  });

  it('should successfully call signUp when valid information is provided', async () => {
    const mockSignUp = vi.fn().mockResolvedValueOnce();
    useAuth.mockReturnValue({ user: null, loadingAuth: false, signUp: mockSignUp });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    // Fill out the registration form
    await user.type(screen.getByLabelText(/full name/i), 'Mario Rossi');
    await user.type(screen.getByLabelText(/mobile number/i), '+393334445566');
    await user.type(screen.getByLabelText(/^email/i), 'mario.rossi@example.com');
    await user.type(screen.getByLabelText(/^password/i, { selector: 'input' }), 'securePassword123');
    await user.type(screen.getByLabelText(/confirm password/i, { selector: 'input' }), 'securePassword123');

    // Click submit
    await user.click(screen.getByRole('button', { name: /^create account/i }));

    // Verify signUp was called with correct sanitized data
    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        name: 'Mario Rossi',
        email: 'mario.rossi@example.com',
        phone: '+393334445566',
        password: 'securePassword123',
        notes: '',
        emergencyContact: '',
      });
    });
  });

  it('should handle registration error like email already registered', async () => {
    const error = new Error('Email already exists');
    error.code = 'EMAIL_ALREADY_REGISTERED';
    const mockSignUp = vi.fn().mockRejectedValueOnce(error);
    
    useAuth.mockReturnValue({ user: null, loadingAuth: false, signUp: mockSignUp });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    // Fill form and submit
    await user.type(screen.getByLabelText(/full name/i), 'Mario Rossi');
    await user.type(screen.getByLabelText(/mobile number/i), '+393334445566');
    await user.type(screen.getByLabelText(/^email/i), 'existing@example.com');
    await user.type(screen.getByLabelText(/^password/i, { selector: 'input' }), 'securePassword123');
    await user.type(screen.getByLabelText(/confirm password/i, { selector: 'input' }), 'securePassword123');

    await user.click(screen.getByRole('button', { name: /^create account/i }));

    // Verify specific error message is shown for the email field
    expect(await screen.findByText(/this email is already registered/i)).toBeInTheDocument();
  });

});