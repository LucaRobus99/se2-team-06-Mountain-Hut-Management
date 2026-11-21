import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

// Mock specific image assets using exact relative paths required by MyAccountPage.jsx
vi.mock('../../../src/assets/edelweiss-my-account.jpg', () => ({ default: 'mocked-hero' }));
vi.mock('../../../src/assets/edelweiss-terrace.jpg', () => ({ default: 'mocked-avatar' }));

import MyAccountPage from '../../../src/pages/MyAccountPage.jsx';
import { useAuth } from '../../../src/auth/AuthContext.jsx';
import { updateMyProfile, changeMyPassword, uploadMyAvatar, removeMyAvatar } from '../../../src/api/auth.js';
import { prepareAvatar } from '../../../src/utils/avatar.js';

// Mock AuthContext and API modules
vi.mock('../../../src/auth/AuthContext.jsx', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../../src/api/auth.js', () => ({
  updateMyProfile: vi.fn(),
  changeMyPassword: vi.fn(),
  uploadMyAvatar: vi.fn(),
  removeMyAvatar: vi.fn(),
}));

vi.mock('../../../src/utils/avatar.js', () => ({
  prepareAvatar: vi.fn(),
}));

describe('MyAccountPage Component Integration & Coverage Tests', () => {
  const mockRefreshUser = vi.fn();
  const mockUser = {
    displayName: 'Mario Rossi',
    email: 'mario.rossi@example.com',
    phone: '+393331234567',
    notes: 'Some notes',
    emergencyContact: 'Emergency Contact Person',
    role: 'hiker',
    avatarUrl: null,
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

    expect(screen.getByRole('heading', { level: 1, name: /my account/i })).toBeInTheDocument();
    expect(screen.getByText('Mario Rossi')).toBeInTheDocument();
    // Use getAllByText since email appears in both sidebar and profile card
    expect(screen.getAllByText('mario.rossi@example.com')[0]).toBeInTheDocument();
    expect(screen.getByText('+393331234567')).toBeInTheDocument();
    expect(screen.getByText('Some notes')).toBeInTheDocument();
    expect(screen.getByText('Emergency Contact Person')).toBeInTheDocument();
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

    expect(screen.getAllByText('mario.rossi@example.com')[0]).toBeInTheDocument();
  });

  it('allows editing personal information, canceling edit mode, and successfully saving changes', async () => {
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

    // Test cancellation of edit mode
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelBtn);
    expect(screen.queryByLabelText(/^name/i)).not.toBeInTheDocument();

    // Re-enter edit mode and save
    await user.click(screen.getByRole('button', { name: /edit personal information/i }));
    const reopenedNameInput = screen.getByLabelText(/^name/i);
    await user.clear(reopenedNameInput);
    await user.type(reopenedNameInput, 'Mario Updated');

    const saveBtn = screen.getByRole('button', { name: /save changes/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(updateMyProfile).toHaveBeenCalledWith({
        name: 'Mario Updated',
        phone: '+393331234567',
        notes: 'Some notes',
        emergencyContact: 'Emergency Contact Person',
      });
      expect(mockRefreshUser).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText('Your personal information was updated.')).toBeInTheDocument();
  });

  it('validates profile inputs and shows error when name or phone is invalid', async () => {
    render(
      <MemoryRouter>
        <MyAccountPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /edit personal information/i }));

    const nameInput = screen.getByLabelText(/^name/i);
    const phoneInput = screen.getByLabelText(/phone number/i);
    const form = nameInput.closest('form');

    // 1. Test empty name
    fireEvent.change(nameInput, { target: { value: '   ' } });
    fireEvent.submit(form);
    expect(await screen.findByText('Please enter a name of up to 100 characters.')).toBeInTheDocument();

    // 2. Restore valid name, then test invalid phone number
    fireEvent.change(nameInput, { target: { value: 'Mario Rossi' } });
    fireEvent.change(phoneInput, { target: { value: '123' } });
    fireEvent.submit(form);
    expect(await screen.findByText('Enter a valid mobile number (at least 6 digits).')).toBeInTheDocument();
  });

  it('handles API failure gracefully when updating profile (status 401 / session expired)', async () => {
    const error401 = Object.assign(new Error('Unauthorized'), { status: 401 });
    updateMyProfile.mockRejectedValueOnce(error401);

    render(
      <MemoryRouter>
        <MyAccountPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /edit personal information/i }));
    const form = screen.getByLabelText(/^name/i).closest('form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(updateMyProfile).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText('Your session has expired. Please log in again.')).toBeInTheDocument();
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

    expect(await screen.findByText('Your password was changed.')).toBeInTheDocument();
  });

  it('shows validation errors for password length and mismatch or missing current password', async () => {
    render(
      <MemoryRouter>
        <MyAccountPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /security/i }));
    const currentInput = screen.getByLabelText(/current password/i);
    const newInput = screen.getByLabelText(/^new password/i);
    const confirmInput = screen.getByLabelText(/confirm new password/i);
    const form = currentInput.closest('form');

    // 1. Missing current password
    fireEvent.submit(form);
    expect(await screen.findByText('Enter your current password.')).toBeInTheDocument();

    // 2. Short password
    fireEvent.change(currentInput, { target: { value: 'OldPassword123' } });
    fireEvent.change(newInput, { target: { value: 'short' } });
    fireEvent.change(confirmInput, { target: { value: 'short' } });
    fireEvent.submit(form);
    expect(await screen.findByText('Your new password must be between 8 and 128 characters.')).toBeInTheDocument();

    // 3. Password mismatch
    fireEvent.change(newInput, { target: { value: 'ValidPassword123!' } });
    fireEvent.change(confirmInput, { target: { value: 'DifferentPassword123!' } });
    fireEvent.submit(form);
    expect(await screen.findByText('The new passwords do not match.')).toBeInTheDocument();
  });

  it('handles password change API failure', async () => {
    changeMyPassword.mockRejectedValueOnce(new Error('Incorrect current password'));
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <MyAccountPage />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: /security/i }));
    await user.type(screen.getByLabelText(/current password/i), 'WrongPass');
    await user.type(screen.getByLabelText(/^new password/i), 'NewPassword123!');
    await user.type(screen.getByLabelText(/confirm new password/i), 'NewPassword123!');

    await user.click(screen.getByRole('button', { name: /^change password$/i }));

    expect(await screen.findByText('Incorrect current password')).toBeInTheDocument();
  });

  it('allows uploading a new profile photo via the photo menu', async () => {
    prepareAvatar.mockResolvedValueOnce('base64-image-data');
    uploadMyAvatar.mockResolvedValueOnce({});

    render(
      <MemoryRouter>
        <MyAccountPage />
      </MemoryRouter>
    );

    const portraitBtn = screen.getByRole('button', { name: /open profile photo options/i });
    fireEvent.click(portraitBtn);

    const file = new File(['dummy content'], 'avatar.png', { type: 'image/png' });
    const fileInput = screen.getByLabelText(/choose profile photo/i);

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(prepareAvatar).toHaveBeenCalledWith(file);
      expect(uploadMyAvatar).toHaveBeenCalledWith('base64-image-data');
      expect(mockRefreshUser).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText('Your profile photo was updated.')).toBeInTheDocument();
  });

  it('allows removing profile photo when avatarUrl is present', async () => {
    useAuth.mockReturnValue({
      user: { ...mockUser, avatarUrl: 'https://example.com/avatar.png' },
      refreshUser: mockRefreshUser,
    });
    removeMyAvatar.mockResolvedValueOnce({});

    render(
      <MemoryRouter>
        <MyAccountPage />
      </MemoryRouter>
    );

    const portraitBtn = screen.getByRole('button', { name: /open profile photo options/i });
    fireEvent.click(portraitBtn);

    const removeBtn = screen.getByRole('menuitem', { name: /remove photo/i });
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(removeMyAvatar).toHaveBeenCalledTimes(1);
      expect(mockRefreshUser).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText('Your profile photo was removed.')).toBeInTheDocument();
  });

  it('should handle 404 or 405 error status when updating profile features', async () => {
    const error404 = Object.assign(new Error('Not Found'), { status: 404 });
    updateMyProfile.mockRejectedValueOnce(error404);

    render(
      <MemoryRouter>
        <MyAccountPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /edit personal information/i }));
    const form = screen.getByLabelText(/^name/i).closest('form');
    fireEvent.submit(form);

    expect(
      await screen.findByText('Editing personal information is not available yet. The profile service still needs to be enabled.')
    ).toBeInTheDocument();
  });

  it('should close the profile photo menu when pressing Escape or clicking outside', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <MyAccountPage />
      </MemoryRouter>
    );

    // Open the photo options menu
    const portraitBtn = screen.getByRole('button', { name: /open profile photo options/i });
    await user.click(portraitBtn);
    expect(screen.getByRole('menu', { name: /profile photo options/i })).toBeInTheDocument();

    // Press Escape key to close the menu
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu', { name: /profile photo options/i })).not.toBeInTheDocument();
  });
  
  it('closes photo menu on outside mousedown and handles empty file input or avatar upload failure', async () => {
    uploadMyAvatar.mockRejectedValueOnce(Object.assign(new Error('Service off'), { status: 405 }));

    render(
      <MemoryRouter>
        <MyAccountPage />
      </MemoryRouter>
    );

    const portraitBtn = screen.getByRole('button', { name: /open profile photo options/i });
    fireEvent.click(portraitBtn);
    expect(screen.getByRole('menu', { name: /profile photo options/i })).toBeInTheDocument();

    // Outside mousedown closes menu
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu', { name: /profile photo options/i })).not.toBeInTheDocument();

    // Empty file selection returns early without calling prepareAvatar
    const fileInput = screen.getByLabelText(/choose profile photo/i);
    fireEvent.change(fileInput, { target: { files: [] } });
    expect(prepareAvatar).not.toHaveBeenCalled();

    // Failed avatar upload shows unavailable message (405)
    prepareAvatar.mockResolvedValueOnce('img-data');
    const file = new File(['x'], 'avatar.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(
      await screen.findByText('Uploading your photo is not available yet. The profile service still needs to be enabled.')
    ).toBeInTheDocument();
  });

  it('validates notes/emergencyContact length and sends null for blank optional fields', async () => {
    updateMyProfile.mockResolvedValueOnce({});

    render(
      <MemoryRouter>
        <MyAccountPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /edit personal information/i }));
    const notesInput = screen.getByLabelText(/^notes/i);
    const emergencyInput = screen.getByLabelText(/emergency contact/i);
    const form = notesInput.closest('form');

    // Notes > 1000 chars triggers validation error
    fireEvent.change(notesInput, { target: { value: 'a'.repeat(1001) } });
    fireEvent.submit(form);
    expect(
      await screen.findByText('Notes must be under 1000 characters and emergency contact under 200.')
    ).toBeInTheDocument();

    // Clearing optional fields sends null and switches to security via card action button
    fireEvent.change(notesInput, { target: { value: '   ' } });
    fireEvent.change(emergencyInput, { target: { value: '' } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(updateMyProfile).toHaveBeenCalledWith({
        name: 'Mario Rossi',
        phone: '+393331234567',
        notes: null,
        emergencyContact: null,
      });
    });

    fireEvent.click(screen.getByRole('button', { name: /change password/i }));
    expect(screen.getByRole('heading', { name: /change your password/i })).toBeInTheDocument();
  });

  it('renders fallback values when user fields are missing and handles removePhoto failure', async () => {
    useAuth.mockReturnValue({
      user: { displayName: '', email: '', phone: '', notes: '', emergencyContact: '', avatarUrl: 'img.png' },
      refreshUser: mockRefreshUser,
    });
    removeMyAvatar.mockRejectedValueOnce(new Error('Remove failed'));

    render(
      <MemoryRouter>
        <MyAccountPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Your account')).toBeInTheDocument();
    expect(screen.getAllByText('No email available').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Not provided')).toHaveLength(4);

    fireEvent.click(screen.getByRole('button', { name: /open profile photo options/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /remove photo/i }));

    expect(await screen.findByText('Remove failed')).toBeInTheDocument();
  });

});