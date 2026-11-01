import { describe, it, expect, vi, beforeEach } from 'vitest';
import { errorHandler, notFoundHandler } from '../../../src/middleware/errorHandler.js';
import { ConflictError } from '../../../src/errors/AppError.js';

describe('White Box Test - errorHandler & notFoundHandler', () => {
  let req, res, next;

  beforeEach(() => {
    req = { method: 'GET', path: '/api/slots' };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    next = vi.fn();
  });

  it('turns an AppError into the API error format', () => {
    errorHandler(new ConflictError('Not enough seats'), req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'CONFLICT', message: 'Not enough seats' },
    });
  });

  it('returns 400 when the request body is not valid JSON', () => {
    errorHandler({ type: 'entity.parse.failed' }, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'VALIDATION_ERROR', message: 'Request body is not valid JSON.', details: [] },
    });
  });

  it('returns 500 for unexpected errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    errorHandler(new Error('boom'), req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
    });
    spy.mockRestore();
  });

  it('notFoundHandler returns 404 with the method and path', () => {
    notFoundHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'NOT_FOUND', message: 'No route for GET /api/slots' },
    });
  });
});
