import express from 'express';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { createHealthRouter } from './routes/healthRoutes.js';
import { createUserDao } from './dao/userDao.js';
import { createHutDao } from './dao/hutDao.js';
import { createSlotDao } from './dao/slotDao.js';
import { createBookingDao } from './dao/bookingDao.js';
import { createSlotService } from './services/slotService.js';
import { createBookingService } from './services/bookingService.js';
import { createAuthRouter } from './routes/authRoutes.js';
import { createHutRouter } from './routes/hutRoutes.js';
import { createBookingRouter } from './routes/bookingRoutes.js';
import { configurePassport } from './auth/passport.js';
import { sessionMiddleware } from './auth/session.js';
import { createRequireAuth } from './middleware/requireAuth.js';
import { config } from './config/config.js';

export function createApp({ db, timeZone = config.hutTimeZone, now = () => new Date() }) {
  const app = express();

  app.use(express.json());

  const userDao = createUserDao(db);
  const hutDao = createHutDao(db);
  const slotDao = createSlotDao(db);
  const bookingDao = createBookingDao(db);

  // Passport local strategy + Express session (cookie `sid`).
  const auth = configurePassport({ userDao });
  app.use(sessionMiddleware());
  app.use(auth.initialize());
  app.use(auth.session());

  const requireAuth = createRequireAuth({ now: () => now().getTime() });

  const slotService = createSlotService({ slotDao, hutDao, timeZone, now });
  const bookingService = createBookingService({ db, bookingDao, slotDao, timeZone, now });

  // Health check
  app.use('/api/health', createHealthRouter(db));

  // Authentication
  app.use('/api/auth', createAuthRouter({ passport: auth, requireAuth, now }));

  // Public availability, then authenticated bookings
  app.use('/api/huts', createHutRouter(slotService));
  app.use('/api/bookings', createBookingRouter(bookingService, requireAuth));

  // Error handling (must stay last)
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
