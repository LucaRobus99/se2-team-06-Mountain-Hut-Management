import express from 'express';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { createHealthRouter } from './routes/healthRoutes.js';
import { createUserDao } from './dao/userDao.js';
import { createSlotDao } from './dao/slotDao.js';
import { createBookingDao } from './dao/bookingDao.js';
import { createAuthService } from './services/authService.js';
import { createSlotService } from './services/slotService.js';
import { createBookingService } from './services/bookingService.js';
import { createAuthRouter } from './routes/authRoutes.js';
import { createSlotRouter } from './routes/slotRoutes.js';
import { createBookingRouter } from './routes/bookingRoutes.js';

export function createApp({ db }) {
  const app = express();

  app.use(express.json());

  const userDao = createUserDao(db);
  const slotDao = createSlotDao(db);
  const bookingDao = createBookingDao(db);

  const sessions = new Map();
  const authService = createAuthService({ userDao, sessions });
  const slotService = createSlotService({ slotDao });
  const bookingService = createBookingService({ db, bookingDao, slotDao });

  // Health check
  app.use('/api/health', createHealthRouter(db));

  // MH-01 endpoints
  app.use('/api/sessions', createAuthRouter(authService));
  app.use('/api/slots', createSlotRouter(slotService));
  app.use('/api/bookings', createBookingRouter(bookingService));

  // Error handling (must stay last)
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
