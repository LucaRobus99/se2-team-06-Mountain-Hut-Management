import { Router } from 'express';

/** GET /api/health → { status: "UP", database: "UP" } (503 if the database is unreachable). */
export function createHealthRouter(db) {
  const router = Router();
  router.get('/', async (_req, res) => {
    try {
      await db.query('SELECT 1');
      res.json({ status: 'UP', database: 'UP' });
    } catch {
      res.status(503).json({ status: 'DOWN', database: 'DOWN' });
    }
  });
  return router;
}
