import { AppError } from '../errors/AppError.js';

const DEFAULT_CODES = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'SLOT_TOO_LATE',
  500: 'INTERNAL_ERROR',
};

function defaultCode(status) {
  return DEFAULT_CODES[status] ?? 'INTERNAL_ERROR';
}

/**
 * Turns errors into JSON responses following the MH-01 contract:
 * { "error": { "code": ..., "message": ..., "details"?: [...] } }
 */
export function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    const code = err.code ?? defaultCode(err.status);
    const body = { error: { code, message: err.message } };
    if (err.details !== null && err.details !== undefined) {
      body.error.details = err.details;
    } else if (code === 'VALIDATION_ERROR' || code === 'INSUFFICIENT_CAPACITY') {
      body.error.details = [];
    }
    return res.status(err.status).json(body);
  }

  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Request body is not valid JSON.', details: [] },
    });
  }

  // Unexpected errors
  console.error(err);
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
  });
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` },
  });
}
