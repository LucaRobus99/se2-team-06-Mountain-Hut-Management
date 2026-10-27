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

  it('turns an AppError into a problem response', () => {
    errorHandler(new ConflictError('Not enough seats'), req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      type: 'about:blank', title: 'Conflict', status: 409, detail: 'Not enough seats',
    });
  });

  it('returns 400 when the request body is not valid JSON', () => {
    errorHandler({ type: 'entity.parse.failed' }, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      type: 'about:blank', title: 'Bad Request', status: 400, detail: 'Request body is not valid JSON',
    });
  });

  it('returns 500 for unexpected errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    errorHandler(new Error('boom'), req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      type: 'about:blank', title: 'Internal Server Error', status: 500, detail: 'An error occurred, please try later',
    });
    spy.mockRestore();
  });

  it('notFoundHandler returns 404 with the method and path', () => {
    notFoundHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      type: 'about:blank', title: 'Not Found', status: 404, detail: 'No route for GET /api/slots',
    });
  });
});
