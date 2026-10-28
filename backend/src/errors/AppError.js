/**
 * Errors the service layer throws on purpose;
 * the error handler turns them into HTTP responses.
 *
 * Contract errors carry a `code` (e.g. VALIDATION_ERROR) and, when relevant,
 * a `details` array, as required by the MH-01 REST contract.
 */
export class AppError extends Error {
  constructor(status, title, detail, code = null, details = null) {
    super(detail);
    this.status = status;
    this.title = title;
    this.code = code;
    this.details = details;
  }
}

/** 400 – invalid input (e.g. party size missing). */
export class ValidationError extends AppError {
  constructor(detail = 'The request contains invalid fields.', code = 'VALIDATION_ERROR', details = null) {
    super(400, 'Bad Request', detail, code, details);
  }
}

/** 401 – not logged in (e.g. booking without login, AC-01.2). */
export class UnauthorizedError extends AppError {
  constructor(detail = 'Authentication required.', code = 'UNAUTHENTICATED', details = null) {
    super(401, 'Unauthorized', detail, code, details);
  }
}

/** 403 – logged in but not allowed (e.g. a hiker managing slots, AC-02.1). */
export class ForbiddenError extends AppError {
  constructor(detail = 'Forbidden.', code = 'FORBIDDEN', details = null) {
    super(403, 'Forbidden', detail, code, details);
  }
}

/** 404 – resource does not exist. */
export class NotFoundError extends AppError {
  constructor(detail = 'Resource not found.', code = 'NOT_FOUND', details = null) {
    super(404, 'Not Found', detail, code, details);
  }
}

/** 409 – request conflicts with current state (e.g. not enough seats, AC-01.6). */
export class ConflictError extends AppError {
  constructor(detail = 'Conflict.', code = null, details = null) {
    super(409, 'Conflict', detail, code, details);
  }
}

/** 422 – request is well-formed but semantically invalid (e.g. slot in the past). */
export class UnprocessableEntityError extends AppError {
  constructor(detail = 'Unprocessable entity.', code = 'SLOT_IN_THE_PAST', details = null) {
    super(422, 'Unprocessable Entity', detail, code, details);
  }
}
