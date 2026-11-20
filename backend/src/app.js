import express from 'express';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { createHealthRouter } from './routes/healthRoutes.js';
import { createUserDao } from './dao/userDao.js';
import { createSlotDao } from './dao/slotDao.js';
import { createBookingDao } from './dao/bookingDao.js';
import { createPasswordResetDao } from './dao/passwordResetDao.js';
import { createSlotService } from './services/slotService.js';
import { createBookingService } from './services/bookingService.js';
import { createEmailServiceFromConfig } from './services/emailService.js';
import { createAuthRouter } from './routes/authRoutes.js';
import { createRegistrationService } from './services/registrationService.js';
import { createAccountService } from './services/accountService.js';
import { createPasswordResetService } from './services/passwordResetService.js';
import { createAvailabilityRouter } from './routes/availabilityRoutes.js';
import { createBookingRouter } from './routes/bookingRoutes.js';
import { createSlotRouter } from './routes/slotRoutes.js';
import { createStaffRouter } from './routes/staffRoutes.js';
import { configurePassport } from './auth/passport.js';
import { sessionMiddleware } from './auth/session.js';
import { createRequireAuth } from './middleware/requireAuth.js';
import { createRequirePasswordChange } from './middleware/requirePasswordChange.js';
import { config } from './config/config.js';

export function createApp({ db, timeZone = config.hutTimeZone, now = () => new Date(), emailService: injectedEmailService = null }) {
  const app = express();

  // In Docker the frontend's nginx forwards /api from the private network.
  // Trust only private/loopback proxies, so req.secure and the client IP come
  // from X-Forwarded-* headers set by nginx, never from arbitrary clients.
  app.set('trust proxy', 'loopback, linklocal, uniquelocal');

  // Avatar uploads need a larger body, but other endpoints retain the default 100 KB limit.
  app.use('/api/auth/avatar', express.json({ limit: '768kb' }));
  app.use(express.json());

  const userDao = createUserDao(db);
  const slotDao = createSlotDao(db);
  const bookingDao = createBookingDao(db);
  const passwordResetDao = createPasswordResetDao(db);

  // Passport local strategy + Express session (cookie `sid`).
  const auth = configurePassport({ userDao });
  app.use(sessionMiddleware());
  app.use(auth.initialize());
  app.use(auth.session());

  // MH-07: an account created by staff must change its first password before
  // any other authenticated endpoint becomes usable.
  app.use(createRequirePasswordChange());

  const requireAuth = createRequireAuth({ now: () => now().getTime() });

  const emailService = injectedEmailService ?? createEmailServiceFromConfig(config);

  const slotService = createSlotService({ slotDao, db, timeZone, now });
  const bookingService = createBookingService({
    db,
    bookingDao,
    slotDao,
    userDao,
    timeZone,
    now,
    emailService,
  });
  const registrationService = createRegistrationService({ userDao });
  const accountService = createAccountService({ userDao });
  const passwordResetService = createPasswordResetService({
    db,
    userDao,
    passwordResetDao,
    emailService,
    appBaseUrl: config.appBaseUrl,
    now,
  });

  // Health check
  app.use('/api/health', createHealthRouter(db));

  // Authentication
  app.use('/api/auth', createAuthRouter({
    passport: auth,
    requireAuth,
    registrationService,
    accountService,
    passwordResetService,
    now,
  }));

  // Public availability, then authenticated bookings
  app.use('/api/availability', createAvailabilityRouter(slotService));
  app.use('/api/slots', createSlotRouter(slotService, requireAuth));
  app.use('/api/bookings', createBookingRouter(bookingService, requireAuth));
  // MH-07: staff-only search, availability and bookings on someone's behalf.
  app.use('/api/staff', createStaffRouter({ bookingService, slotService, requireAuth }));

  //used for e2e test for cleaning bookings
  if (process.env.NODE_ENV !== 'production') {
    app.post('/api/test/reset', async (req, res, next) => {
      try {
        
        await db.query(
          `DELETE FROM booking_requirements
           WHERE booking_id IN (
             SELECT b.id FROM bookings b
             JOIN slots s ON s.id = b.slot_id
             WHERE s.date = '2027-03-14'
               AND s.start_time = '13:00'
               AND s.end_time = '14:00'
           )`
        );
        await db.query(
          `DELETE FROM booking_seats
           WHERE booking_id IN (
             SELECT b.id FROM bookings b
             JOIN slots s ON s.id = b.slot_id
             WHERE s.date = '2027-03-14'
               AND s.start_time = '13:00'
               AND s.end_time = '14:00'
           )`
        );
        await db.query(
          `DELETE FROM bookings
           WHERE slot_id IN (
             SELECT id FROM slots
             WHERE date = '2027-03-14'
               AND start_time = '13:00'
               AND end_time = '14:00'
           )`
        );

        
        await db.query('DELETE FROM booking_requirements');
        await db.query('DELETE FROM booking_seats');
        await db.query('DELETE FROM bookings');

        
        await db.query(
          `DELETE FROM slots
           WHERE date = '2027-03-14'
             AND start_time = '13:00'
             AND end_time = '14:00'`
        );

        res.status(204).end();
      } catch (err) {
        next(err);
      }
    });
  }
  

  // Error handling (must stay last)
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
