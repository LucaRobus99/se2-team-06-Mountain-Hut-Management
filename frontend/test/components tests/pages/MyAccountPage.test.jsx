import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

// Mock specific image assets using the exact relative paths required by MyAccountPage.jsx
vi.mock('../../../src/assets/edelweiss-my-account.jpg', () => ({ default: 'mocked-hero' }));
vi.mock('../../../src/assets/edelweiss-terrace.jpg', () => ({ default: 'mocked-avatar' }));

import MyAccountPage from '../../../src/pages/MyAccountPage.jsx';
import { useAuth } from '../../../src/auth/AuthContext.jsx';
import { updateMyProfile, changeMyPassword } from '../../../src/api/auth.js';

// Mock AuthContext and API module
vi.mock('../../../src/auth/AuthContext.jsx', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../../src/api/auth.js', () => ({
  updateMyProfile: vi.fn(),
  changeMyPassword: vi.fn(),
}));

describe('MyAccountPage Component Integration Tests', () => {
  const mockRefreshUser = vi.fn();
  const mockUser = {
    displayName: 'Mario Rossi',
    email: 'mario.rossi@example.com',
    phone: '+393331234567',
    role: 'hiker',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      user: mockUser,
      refreshUser: mockRefreshUser,
    });
  });

  it('renders personal information by default with user details', () => {
    render(
      <MemoryRouter>
        <MyAccountPage />
      </MemoryRouter>
    );

    // Specify heading level 1 to uniquely target the main page title
    expect(screen.getByRole('heading', { level: 1, name: /my account/i })).toBeInTheDocument();
    expect(screen.getByText('Mario Rossi')).toBeInTheDocument();
    expect(screen.getByText('mario.rossi@example.com')).toBeInTheDocument();
    expect(screen.getByText('+393331234567')).toBeInTheDocument();
  });

  it('allows switching between personal and security tabs', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <MyAccountPage />
      </MemoryRouter>
    );

    const securityTab = screen.getByRole('button', { name: /security/i });
    await user.click(securityTab);

    expect(screen.getByRole('heading', { name: /change your password/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();

    const personalTab = screen.getByRole('button', { name: /personal information/i });
    await user.click(personalTab);

    expect(screen.getByText('mario.rossi@example.com')).toBeInTheDocument();
  });

  it('allows editing personal information and successfully saving changes', async () => {
    updateMyProfile.mockResolvedValueOnce({ user: { ...mockUser, displayName: 'Mario Updated' } });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <MyAccountPage />
      </MemoryRouter>
    );

    const editBtn = screen.getByRole('button', { name: /edit personal information/i });
    await user.click(editBtn);

    const nameInput = screen.getByLabelText(/^name/i);
    expect(nameInput).toHaveValue('Mario Rossi');

    await user.clear(nameInput);
    await user.type(nameInput, 'Mario Updated');

    const saveBtn = screen.getByRole('button', { name: /save changes/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(updateMyProfile).toHaveBeenCalledWith({
        name: 'Mario Updated',
        phone: '+393331234567',
      });
      expect(mockRefreshUser).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('Your personal information was updated.')).toBeInTheDocument();
  });

  it('validates profile inputs and shows error when name is empty or blank', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <MyAccountPage />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: /edit personal information/i }));

    const nameInput = screen.getByLabelText(/^name/i);
    await user.clear(nameInput);
    // Type spaces so HTML5 required check passes, but trimmed name becomes empty (triggering React validation)
    await user.type(nameInput, '   ');

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('Please enter a name of up to 100 characters.');
    expect(updateMyProfile).not.toHaveBeenCalled();
  });

  it('handles API failure gracefully when updating profile (e.g. status 404/405)', async () => {
    const error404 = new Error('Not found');
    error404.status = 404;
    updateMyProfile.mockRejectedValueOnce(error404);

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <MyAccountPage />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: /edit personal information/i }));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Editing personal information is not available yet. The profile service still needs to be enabled.'
    );
  });

  it('successfully changes password when inputs are valid', async () => {
    changeMyPassword.mockResolvedValueOnce({});
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <MyAccountPage />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: /security/i }));

    await user.type(screen.getByLabelText(/current password/i), 'OldPassword123');
    await user.type(screen.getByLabelText(/^new password/i), 'NewPassword123!');
    await user.type(screen.getByLabelText(/confirm new password/i), 'NewPassword123!');

    await user.click(screen.getByRole('button', { name: /^change password$/i }));

    await waitFor(() => {
      expect(changeMyPassword).toHaveBeenCalledWith({
        currentPassword: 'OldPassword123',
        newPassword: 'NewPassword123!',
      });
    });

    expect(screen.getByRole('status')).toHaveTextContent('Your password was changed.');
  });

  it('shows validation errors for password length and mismatch', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <MyAccountPage />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: /security/i }));

    await user.type(screen.getByLabelText(/current password/i), 'OldPassword123');
    await user.type(screen.getByLabelText(/^new password/i), 'short');
    await user.type(screen.getByLabelText(/confirm new password/i), 'short');

    await user.click(screen.getByRole('button', { name: /^change password$/i }));
    expect(screen.getByRole('alert')).toHaveTextContent('Your new password must be between 8 and 128 characters.');

    await user.clear(screen.getByLabelText(/^new password/i));
    await user.clear(screen.getByLabelText(/confirm new password/i));

    await user.type(screen.getByLabelText(/^new password/i), 'ValidPassword123!');
    await user.type(screen.getByLabelText(/confirm new password/i), 'DifferentPassword123!');

    await user.click(screen.getByRole('button', { name: /^change password$/i }));
    expect(screen.getByRole('alert')).toHaveTextContent('The new passwords do not match.');
  });
});