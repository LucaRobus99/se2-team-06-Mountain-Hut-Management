import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';

describe('Black Box Test - GET /api/health', () => {
  it('returns 200 and "UP" when the database is reachable', async () => {
    const mockDb = { query: vi.fn().mockResolvedValue({ rows: [{ 1: 1 }], rowCount: 1 }) };

    const response = await request(createApp({ db: mockDb })).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'UP', database: 'UP' });
    expect(mockDb.query).toHaveBeenCalledWith('SELECT 1');
  });

  it('returns 503 and "DOWN" when the database query fails', async () => {
    const mockDb = { query: vi.fn().mockRejectedValue(new Error('Database connection failed')) };

    const response = await request(createApp({ db: mockDb })).get('/api/health');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'DOWN', database: 'DOWN' });
  });
});
