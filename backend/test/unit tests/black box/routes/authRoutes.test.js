import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createAuthRouter } from '../../../../src/routes/authRoutes.js';
import { errorHandler } from '../../../../src/middleware/errorHandler.js';
import { ValidationError } from '../../../../src/errors/AppError.js';

describe('authRoutes - Black-Box Tests', () => {
  const fixedNow = new Date('2026-08-14T07:00:00.000Z');
  const dbUser = { id: 1, role: 'hiker', name: 'Mario Rossi', email: 'mario@example.com', phone: '+39333' };

  let authResult;      // what passport hands back: { err, user }
  let session;         // stub of req.session
  let logInError;
  let logoutError;
  let registrationService;
  let app;

  beforeEach(() => {
    authResult = { err: null, user: dbUser };
    logInError = null;
    logoutError = null;
    session = {
      regenerate: vi.fn((cb) => cb(null)),
      destroy: vi.fn((cb) => cb(null)),
    };
    registrationService = { registerHiker: vi.fn() };

    const passport = {
      authenticate: vi.fn((_strategy, _options, callback) => () => callback(authResult.err, authResult.user)),
    };
    const requireAuth = () => (req, _res, next) => {
      req.user = dbUser;
      next();
    };

    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.session = session;
      req.logIn = vi.fn((_user, cb) => cb(logInError));
      req.logout = vi.fn((cb) => cb(logoutError));
      next();
    });
    app.use('/api/auth', createAuthRouter({ passport, requireAuth, registrationService, now: () => fixedNow }));
    app.use(errorHandler);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('POST /login', () => {
    const credentials = { email: 'mario@example.com', password: 'secret' };

    it('should answer 400 and skip passport when the body is invalid', async () => {
      const res = await request(app).post('/api/auth/login').send({ email: 'mario@example.com' });

      expect(res.status).toBe(400);
      expect(res.body.error.details).toContainEqual(expect.objectContaining({ field: 'password', rule: 'required' }));
      expect(session.regenerate).not.toHaveBeenCalled();
    });

    it('should answer 401 when the credentials are wrong', async () => {
      authResult = { err: null, user: false };

      const res = await request(app).post('/api/auth/login').send(credentials);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should answer 500 when passport fails', async () => {
      authResult = { err: new Error('db down'), user: null };

      const res = await request(app).post('/api/auth/login').send(credentials);

      expect(res.status).toBe(500);
    });

    it('should regenerate the session, stamp it and return the user', async () => {
      const res = await request(app).post('/api/auth/login').send(credentials);

      expect(res.status).toBe(200);
      expect(res.body.user).toEqual(dbUser);
      expect(session.regenerate).toHaveBeenCalledTimes(1);
      expect(session.createdAt).toBe(fixedNow.getTime());
      expect(session.lastAccessAt).toBe(fixedNow.getTime());
    });

    it('should answer 500 when regenerating the session fails', async () => {
      session.regenerate.mockImplementation((cb) => cb(new Error('store down')));

      const res = await request(app).post('/api/auth/login').send(credentials);

      expect(res.status).toBe(500);
    });

    it('should answer 500 and leave the session unstamped when logIn fails', async () => {
      logInError = new Error('serialize failed');

      const res = await request(app).post('/api/auth/login').send(credentials);

      expect(res.status).toBe(500);
      expect(session.createdAt).toBeUndefined();
    });
  });

  describe('POST /register', () => {
    it('should answer 201 and never return the password hash', async () => {
      registrationService.registerHiker.mockResolvedValue({ ...dbUser, password_hash: 'hash' });

      const res = await request(app).post('/api/auth/register').send({ email: 'mario@example.com' });

      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe('mario@example.com');
      expect(res.body.user).not.toHaveProperty('password_hash');
      expect(session.regenerate).toHaveBeenCalledTimes(1);
    });

    it('should answer with the service error when registration is rejected', async () => {
      registrationService.registerHiker.mockRejectedValue(new ValidationError('bad', 'VALIDATION_ERROR', []));

      const res = await request(app).post('/api/auth/register').send({});

      expect(res.status).toBe(400);
      expect(session.regenerate).not.toHaveBeenCalled();
    });
  });

  describe('GET /me', () => {
    it('should return the signed-in user', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ user: dbUser });
    });
  });

  describe('POST /logout', () => {
    it('should destroy the session and expire the cookie', async () => {
      const res = await request(app).post('/api/auth/logout');

      expect(res.status).toBe(204);
      expect(session.destroy).toHaveBeenCalledTimes(1);
      expect(res.headers['set-cookie'][0]).toMatch(/^sid=;/);
    });

    it('should answer 500 and keep the session when logout fails', async () => {
      logoutError = new Error('logout failed');

      const res = await request(app).post('/api/auth/logout');

      expect(res.status).toBe(500);
      expect(session.destroy).not.toHaveBeenCalled();
    });

    it('should answer 500 when destroying the session fails', async () => {
      session.destroy.mockImplementation((cb) => cb(new Error('store down')));

      const res = await request(app).post('/api/auth/logout');

      expect(res.status).toBe(500);
    });
  });
});
