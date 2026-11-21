import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
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

  it('validates format, length, password mismatch, and optional fields on submit', async () => {
    useAuth.mockReturnValue({ user: null, loadingAuth: false, signUp: vi.fn() });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    const nameInput = screen.getByLabelText(/full name/i);
    const phoneInput = screen.getByLabelText(/mobile number/i);
    const emailInput = screen.getByLabelText(/^email/i);
    const passwordInput = screen.getByLabelText(/^password/i, { selector: 'input' });
    const confirmInput = screen.getByLabelText(/confirm password/i, { selector: 'input' });
    const notesInput = screen.getByLabelText(/^notes/i);
    const emergencyInput = screen.getByLabelText(/emergency contact/i);
    const submitBtn = screen.getByRole('button', { name: /^create account/i });

    fireEvent.change(nameInput, { target: { value: 'a'.repeat(101) } });
    await user.type(phoneInput, '123');
    await user.type(emailInput, 'invalid-email');
    await user.type(passwordInput, 'short');
    await user.type(confirmInput, 'different');
    fireEvent.change(notesInput, { target: { value: 'n'.repeat(1001) } });
    fireEvent.change(emergencyInput, { target: { value: 'e'.repeat(201) } });

    await user.click(submitBtn);

    expect(await screen.findByText(/use 100 characters or fewer/i)).toBeInTheDocument();
    expect(screen.getByText(/enter a valid number with at least 6 digits/i)).toBeInTheDocument();
    expect(screen.getByText(/enter a valid email address/i)).toBeInTheDocument();
    expect(screen.getByText(/use at least 8 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    expect(screen.getByText(/use 1000 characters or fewer/i)).toBeInTheDocument();
    expect(screen.getByText(/use 200 characters or fewer/i)).toBeInTheDocument();
  });

  it('toggles visibility on both password and confirm password fields', async () => {
    useAuth.mockReturnValue({ user: null, loadingAuth: false, signUp: vi.fn() });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    const passwordInput = screen.getByLabelText(/^password/i, { selector: 'input' });
    const confirmInput = screen.getByLabelText(/confirm password/i, { selector: 'input' });
    const toggleButtons = screen.getAllByRole('button', { name: /show password/i });

    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(confirmInput).toHaveAttribute('type', 'password');

    await user.click(toggleButtons[0]);
    expect(passwordInput).toHaveAttribute('type', 'text');

    await user.click(toggleButtons[1]);
    expect(confirmInput).toHaveAttribute('type', 'text');
  });

  it('handles VALIDATION_ERROR field details, general error fallback, and redirects to destination', async () => {
    const fieldValidationErr = new Error('Validation error');
    fieldValidationErr.code = 'VALIDATION_ERROR';
    fieldValidationErr.details = [{ field: 'phone', message: 'Phone already in use' }];

    const generalValidationErr = new Error('Invalid registration payload');
    generalValidationErr.code = 'VALIDATION_ERROR';
    generalValidationErr.details = [{ field: 'unknown', message: 'Ignored' }];

    const mockSignUp = vi
      .fn()
      .mockRejectedValueOnce(fieldValidationErr)
      .mockRejectedValueOnce(generalValidationErr)
      .mockRejectedValueOnce({})
      .mockResolvedValueOnce({});

    useAuth.mockReturnValue({ user: null, loadingAuth: false, signUp: mockSignUp });
    const user = userEvent.setup();

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/register',
            state: { notice: 'Complete registration to continue', from: '/book' },
          },
        ]}
      >
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/availability" element={<div>Availability Redirect</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Complete registration to continue')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/full name/i), 'Mario Rossi');
    await user.type(screen.getByLabelText(/mobile number/i), '+393334445566');
    await user.type(screen.getByLabelText(/^email/i), 'mario@example.com');
    await user.type(screen.getByLabelText(/^password/i, { selector: 'input' }), 'securePassword123');
    await user.type(screen.getByLabelText(/confirm password/i, { selector: 'input' }), 'securePassword123');

    const submitBtn = screen.getByRole('button', { name: /^create account/i });

    // 1. Field-specific server error
    await user.click(submitBtn);
    expect(await screen.findByText('Phone already in use')).toBeInTheDocument();

    // 2. General VALIDATION_ERROR fallback
    await user.click(submitBtn);
    expect(await screen.findByText('Invalid registration payload')).toBeInTheDocument();

    // 3. Generic empty error fallback
    await user.click(submitBtn);
    expect(
      await screen.findByText('Unable to create your account. Please try again.')
    ).toBeInTheDocument();

    // 4. Successful signUp navigates to /availability when from is '/book' without bookingDraft
    await user.click(submitBtn);
    expect(await screen.findByText('Availability Redirect')).toBeInTheDocument();
  });
});