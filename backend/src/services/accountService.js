import { ValidationError } from '../errors/AppError.js';
import { invalid, invalidFields, required, tooLong, unknown, EXPECTED } from '../utils/validation.js';
import { hashPassword, verifyPassword } from './password.js';

const IMAGE_MAX_BYTES = 400 * 1024;
const MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function validateProfile(body, previous) {
  const details = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw invalidFields([invalid('body', EXPECTED.object)]);
  }
  const allowed = ['name', 'phone', 'notes', 'emergencyContact'];
  for (const key of Object.keys(body)) if (!allowed.includes(key)) details.push(unknown(key));
  if (!Object.keys(body).length) details.push(required('body'));
  const next = {
    name: previous.name,
    phone: previous.phone,
    notes: previous.notes ?? null,
    emergencyContact: previous.emergency_contact ?? null,
  };
  for (const [field, limit, optional] of [
    ['name', 100, false], ['phone', 30, false],
    ['notes', 1000, true], ['emergencyContact', 200, true],
  ]) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) continue;
    const val = body[field];
    if (optional && (val === null || val === '')) { next[field] = null; continue; }
    if (typeof val !== 'string') { details.push(invalid(field, EXPECTED.text)); continue; }
    const trimmed = val.trim();
    if (!trimmed && !optional) { details.push(required(field)); continue; }
    if (trimmed.length > limit) { details.push(tooLong(field, limit)); continue; }
    next[field] = trimmed || null;
  }
  if (typeof next.phone === 'string' &&
      (!/^[+\d\s().-]+$/.test(next.phone) || next.phone.replace(/\D/g, '').length < 6)) {
    details.push(invalid('phone', 'a valid mobile number (at least 6 digits)'));
  }
  if (details.length) throw invalidFields(details);
  return next;
}

function validateAvatar(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
      Object.keys(payload).length !== 1 || typeof payload.imageData !== 'string') {
    throw invalidFields([invalid('imageData', 'a base64 JPEG, PNG or WebP image')]);
  }
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(payload.imageData);
  if (!match || !MIME_TYPES.has(match[1]) || match[2].length > Math.ceil(IMAGE_MAX_BYTES * 4 / 3) + 4) {
    throw invalidFields([invalid('imageData', 'a JPEG, PNG or WebP image of at most 400 KB')]);
  }
  const data = Buffer.from(match[2], 'base64');
  if (!data.length || data.length > IMAGE_MAX_BYTES || data.toString('base64') !== match[2]) {
    throw invalidFields([invalid('imageData', 'a valid image of at most 400 KB')]);
  }
  const jpeg = data.length >= 4 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  const png = data.length >= 8 && data.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
  const webp = data.length >= 12 && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP';
  if (!((jpeg && match[1] === 'image/jpeg') || (png && match[1] === 'image/png') ||
        (webp && match[1] === 'image/webp'))) {
    throw invalidFields([invalid('imageData', 'an image whose content matches its file type')]);
  }
  return { data, mime: match[1] };
}

export function createAccountService({ userDao }) {
  return {
    async updateProfile(userId, body) {
      const current = await userDao.findById(userId);
      const next = validateProfile(body, current);
      return userDao.updateProfile(userId, next);
    },

    async changePassword(userId, body) {
      if (!body || typeof body !== 'object' || Array.isArray(body) ||
          Object.keys(body).some((key) => !['currentPassword', 'newPassword'].includes(key))) {
        throw invalidFields([invalid('body', 'currentPassword and newPassword')]);
      }
      if (typeof body.currentPassword !== 'string' || !body.currentPassword ||
          typeof body.newPassword !== 'string' || body.newPassword.length < 8 || body.newPassword.length > 128) {
        throw invalidFields([invalid('password', 'a current password and a new password of 8–128 characters')]);
      }
      const current = await userDao.findById(userId);
      if (!verifyPassword(current.password_hash, body.currentPassword)) {
        throw new ValidationError('Current password is incorrect.', 'INVALID_CURRENT_PASSWORD');
      }
      if (body.currentPassword === body.newPassword) {
        throw new ValidationError('Choose a new password different from your current one.', 'PASSWORD_UNCHANGED');
      }
      await userDao.changePassword(userId, hashPassword(body.newPassword));
    },

    async uploadAvatar(userId, payload) {
      const image = validateAvatar(payload);
      return userDao.setAvatar(userId, image.data, image.mime);
    },

    async removeAvatar(userId) {
      return userDao.setAvatar(userId, null, null);
    },

    async getAvatar(userId) {
      return userDao.getAvatar(userId);
    },
  };
}
