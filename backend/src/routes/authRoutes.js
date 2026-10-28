import { Router } from 'express';

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    try {
      out[key] = decodeURIComponent(val);
    } catch {
      out[key] = val;
    }
  }
  return out;
}

function getSid(req) {
  return parseCookies(req.headers?.cookie).sid;
}

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function setSessionCookie(res, sid) {
  const parts = [`sid=${sid}`, 'HttpOnly', 'SameSite=Lax', 'Path=/'];
  if (isProduction()) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res) {
  const parts = ['sid=', 'Max-Age=0', 'HttpOnly', 'SameSite=Lax', 'Path=/'];
  if (isProduction()) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function createAuthRouter(authService) {
  const router = Router();

  router.post('/', async (req, res, next) => {
    try {
      const { sid, user } = await authService.login(req.body);
      setSessionCookie(res, sid);
      res.status(201).json({ user });
    } catch (err) {
      next(err);
    }
  });

  router.get('/current', async (req, res, next) => {
    try {
      const user = await authService.getCurrentUser(getSid(req));
      res.json({ user });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/current', async (req, res, next) => {
    try {
      await authService.logout(getSid(req));
      clearSessionCookie(res);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}