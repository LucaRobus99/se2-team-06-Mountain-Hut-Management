import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import PasswordRecoveryPage from '../../../src/pages/PasswordRecoveryPage.jsx';
import { useAuth } from '../../../src/auth/AuthContext.jsx';
import { changeMyPassword, requestPasswordReset, resetPassword } from '../../../src/api/auth.js';

vi.mock('../../../src/auth/AuthContext.jsx', () => ({ useAuth: vi.fn() }));
vi.mock('../../../src/api/auth.js', () => ({ changeMyPassword: vi.fn(), requestPasswordReset: vi.fn(), resetPassword: vi.fn() }));
const refreshUser = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  useAuth.mockReturnValue({ user: null, loadingAuth: false, refreshUser, signOut: vi.fn() });
});
function show(mode, path) {
  render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/forgot-password" element={<PasswordRecoveryPage mode={mode} />} />
    <Route path="/reset-password" element={<PasswordRecoveryPage mode={mode} />} />
    <Route path="/change-password" element={<PasswordRecoveryPage mode={mode} />} />
    <Route path="/login" element={<h1>Login destination</h1>} />
    <Route path="/my-bookings" element={<h1>My bookings destination</h1>} />
  </Routes></MemoryRouter>);
}
describe('MH-07 password pages', () => {
  it('requests a recovery email and presents a generic response', async () => {
    const user = userEvent.setup();
    show('forgot', '/forgot-password');
    await user.type(screen.getByLabelText('Email'), 'guest@example.test');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByRole('status')).toHaveTextContent('If an account exists');
    expect(requestPasswordReset).toHaveBeenCalledWith('guest@example.test');
  });
  it('validates matching passwords and submits the reset token', async () => {
    const user = userEvent.setup();
    show('reset', '/reset-password?token=example-token');
    await user.type(screen.getByLabelText('New password', { exact: true }), 'NewPassword123');
    await user.type(screen.getByLabelText('Confirm new password'), 'DifferentPassword');
    await user.click(screen.getByRole('button', { name: 'Set new password' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/passwords match/i);
    expect(resetPassword).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText('Confirm new password'));
    await user.type(screen.getByLabelText('Confirm new password'), 'NewPassword123');
    await user.click(screen.getByRole('button', { name: 'Set new password' }));
    expect(await screen.findByText('Login destination')).toBeInTheDocument();
    expect(resetPassword).toHaveBeenCalledWith('example-token', 'NewPassword123');
  });
  it('replaces an initial password and refreshes the authenticated user', async () => {
    const user = userEvent.setup();
    useAuth.mockReturnValue({ user: { role: 'hiker', passwordChangeRequired: true }, loadingAuth: false, refreshUser, signOut: vi.fn() });
    show('first', '/change-password');
    await user.type(screen.getByLabelText('Temporary password'), 'temporary-test');
    await user.type(screen.getByLabelText('New password', { exact: true }), 'NewPassword123');
    await user.type(screen.getByLabelText('Confirm new password'), 'NewPassword123');
    await user.click(screen.getByRole('button', { name: 'Set new password' }));
    expect(await screen.findByText('My bookings destination')).toBeInTheDocument();
    expect(changeMyPassword).toHaveBeenCalledWith({ currentPassword: 'temporary-test', newPassword: 'NewPassword123' });
    await waitFor(() => expect(refreshUser).toHaveBeenCalledOnce());
  });
});
