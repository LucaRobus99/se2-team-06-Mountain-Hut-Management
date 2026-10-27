import { AppError } from '../errors/AppError.js';

/**
 * Turns errors into JSON responses with `type`, `title`, `status` and `detail`.
 */
export function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json(problem(err.status, err.title, err.message));
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json(problem(400, 'Bad Request', 'Request body is not valid JSON'));
  }

  // Unexpected errors
  console.error(err);
  return res.status(500).json(problem(500, 'Internal Server Error', 'An error occurred, please try later'));
}

export function notFoundHandler(req, res) {
  res.status(404).json(problem(404, 'Not Found', `No route for ${req.method} ${req.path}`));
}

function problem(status, title, detail) {
  return { type: 'about:blank', title, status, detail };
}
