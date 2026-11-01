import { ConflictError } from '../errors/AppError.js';
import { validatedRegistration } from '../auth/registerValidation.js';
import { hashPassword } from './password.js';

export function createRegistrationService({ userDao }) {
  return {
    async registerHiker(body) {
      const data = validatedRegistration(body);
      if (await userDao.findByEmail(data.email)) {
        throw new ConflictError('An account with this email already exists.', 'EMAIL_ALREADY_REGISTERED');
      }
      const passwordHash = hashPassword(data.password);
      try {
        return await userDao.createHiker({
          name: data.name, email: data.email, phone: data.phone,
          passwordHash, notes: data.notes, emergencyContact: data.emergencyContact,
        });
      } catch (err) {
        // Another request may have registered this email after the lookup.
        if (/UNIQUE constraint failed.*(users\.email|idx_users_email_ci|index.*email)/i.test(err.message)) {
          throw new ConflictError('An account with this email already exists.', 'EMAIL_ALREADY_REGISTERED');
        }
        throw err;
      }
    },
  };
}
