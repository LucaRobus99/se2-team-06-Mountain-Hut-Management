import { describe, it, expect, vi, afterEach } from 'vitest';
import { updateMyProfile, changeMyPassword, uploadMyAvatar, removeMyAvatar } from '../../../../src/api/auth.js';

afterEach(() => vi.unstubAllGlobals());

describe('Account endpoint contract', () => {
  it('sends profile changes with session credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ user: {} }) });
    vi.stubGlobal('fetch', fetchMock);
    await updateMyProfile({ name: 'Maria', phone: '+39 333 555' });
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({
      method: 'PATCH', credentials: 'include', body: JSON.stringify({ name: 'Maria', phone: '+39 333 555' }),
    }));
  });
  it('sends optional profile fields when supplied', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ user: {} }) });
    vi.stubGlobal('fetch', fetchMock);
    await updateMyProfile({ name: 'Maria', phone: '+39 333 555123', notes: 'Hiker', emergencyContact: 'Luca 333123456' });
    const options = fetchMock.mock.calls[0][1];
    expect(JSON.parse(options.body)).toEqual({
      name: 'Maria', phone: '+39 333 555123', notes: 'Hiker', emergencyContact: 'Luca 333123456',
    });
  });
  it('uploads the image for the current session and allows removing it', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ user: { avatarUrl: '/api/auth/avatar?v=1' } }) });
    vi.stubGlobal('fetch', fetchMock);
    const imageData = 'data:image/jpeg;base64,abcd';
    await uploadMyAvatar(imageData);
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/avatar', expect.objectContaining({
      method: 'PATCH', credentials: 'include', body: JSON.stringify({ imageData }),
    }));
    await removeMyAvatar();
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/avatar', expect.objectContaining({
      method: 'DELETE', credentials: 'include',
    }));
  });
  it('sends only current and new passwords, never the confirmation field', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal('fetch', fetchMock);
    await changeMyPassword({ currentPassword: 'oldpassword', newPassword: 'newpassword' });
    const options = fetchMock.mock.calls[0][1];
    expect(options.method).toBe('POST');
    expect(options.body).toBe(JSON.stringify({ currentPassword: 'oldpassword', newPassword: 'newpassword' }));
    expect(options.credentials).toBe('include');
  });
});
