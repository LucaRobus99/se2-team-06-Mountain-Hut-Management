import { Passport } from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { verifyPassword } from '../services/password.js';

/**
 * Shape returned to the client and stored in `req.user`.
 * Passwords and other internal columns never leave this module.
 */
export function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.name,
    role: user.role,
    phone: user.phone ?? null,
    hutId: user.hut_id ?? null,
  };
}

/**
 * Wires the local strategy and session (de)serialization into Passport.
 * Called once per Express app; the strategy looks users up through the DAO,
 * so the service layer never touches HTTP or SQL.
 */
export function configurePassport({ userDao }) {
  // A dedicated instance keeps tests isolated: the default passport export is
  // a singleton whose deserializeUser stack would accumulate across apps.
  const passport = new Passport();

  passport.use(
    new LocalStrategy(
      { usernameField: 'email', passwordField: 'password' },
      async (email, password, done) => {
        try {
          const user = await userDao.findByEmail(String(email).trim());
          if (!user || !verifyPassword(user.password_hash, password)) {
            return done(null, false, { message: 'Invalid email or password.' });
          }
          return done(null, sanitizeUser(user));
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  // Only the user id goes into the session; the rest is reloaded on each request.
  passport.serializeUser((user, done) => done(null, user.id));

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await userDao.findById(id);
      done(null, user ? sanitizeUser(user) : false);
    } catch (err) {
      done(err);
    }
  });

  return passport;
}
