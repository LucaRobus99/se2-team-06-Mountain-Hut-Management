/**
 * Errors the service layer throws on purpose;
 * the error handler turns them into HTTP responses.
 */
export class AppError extends Error {
  constructor(status, title, detail) {
    super(detail);
    this.status = status;
    this.title = title;
  }
}

/** 400 – invalid input (e.g. party size missing). */
export class ValidationError extends AppError {
  constructor(detail) {
    super(400, 'Bad Request', detail);
  }
}

/** 401 – not logged in (e.g. booking without login, AC-01.2). */
export class UnauthorizedError extends AppError {
  constructor(detail) {
    super(401, 'Unauthorized', detail);
  }
}

/** 403 – logged in but not allowed (e.g. a hiker managing slots, AC-02.1). */
export class ForbiddenError extends AppError {
  constructor(detail) {
    super(403, 'Forbidden', detail);
  }
}

/** 404 – resource does not exist. */
export class NotFoundError extends AppError {
  constructor(detail) {
    super(404, 'Not Found', detail);
  }
}

/** 409 – request conflicts with current state (e.g. not enough seats, AC-01.6). */
export class ConflictError extends AppError {
  constructor(detail) {
    super(409, 'Conflict', detail);
  }
}
