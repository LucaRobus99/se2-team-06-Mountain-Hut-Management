import { describe, it, expect } from 'vitest';
import {
  AppError, ValidationError, UnauthorizedError, ForbiddenError, NotFoundError, ConflictError, UnprocessableEntityError,
} from '../../../../src/errors/AppError.js';

describe('White Box Test - Custom Error Classes', () => {
  it('creates the AppError base class with correct custom properties', () => {
    const err = new AppError(418, "I'm a teapot", 'Teapot description', 'CUSTOM_CODE', [{ field: 'test' }]);

    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(418);
    expect(err.title).toBe("I'm a teapot");
    expect(err.message).toBe('Teapot description');
    expect(err.code).toBe('CUSTOM_CODE');
    expect(err.details).toEqual([{ field: 'test' }]);
  });

  it.each([
    [ValidationError, 400, 'Bad Request', 'VALIDATION_ERROR'],
    [UnauthorizedError, 401, 'Unauthorized', 'UNAUTHENTICATED'],
    [ForbiddenError, 403, 'Forbidden', 'FORBIDDEN'],
    [NotFoundError, 404, 'Not Found', 'NOT_FOUND'],
    [ConflictError, 409, 'Conflict', null],
    [UnprocessableEntityError, 422, 'Unprocessable Entity', 'SLOT_TOO_LATE'],
  ])('%o has correct status %i, title "%s", and default code "%s"', (ErrorClass, status, title, expectedCode) => {
    const err = new ErrorClass('some detail');

    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(status);
    expect(err.title).toBe(title);
    expect(err.message).toBe('some detail');
    expect(err.code).toBe(expectedCode);
  });

  it('correctly passes custom details array through error constructors', () => {
    const details = [{ field: 'email', rule: 'invalid' }];
    const err = new ValidationError('Invalid input', 'CUSTOM_VALIDATION_CODE', details);

    expect(err.status).toBe(400);
    expect(err.code).toBe('CUSTOM_VALIDATION_CODE');
    expect(err.details).toEqual(details);
  });
});