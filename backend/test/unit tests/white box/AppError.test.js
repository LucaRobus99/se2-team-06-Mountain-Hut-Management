import { describe, it, expect } from 'vitest';
import {
  AppError, ValidationError, UnauthorizedError, ForbiddenError, NotFoundError, ConflictError,
} from '../../../src/errors/AppError.js';

describe('White Box Test - Custom Error Classes', () => {
  it('creates the AppError base class', () => {
    const err = new AppError(418, "I'm a teapot", 'Teapot description');

    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(418);
    expect(err.title).toBe("I'm a teapot");
    expect(err.message).toBe('Teapot description');
  });

  it.each([
    [ValidationError, 400, 'Bad Request'],
    [UnauthorizedError, 401, 'Unauthorized'],
    [ForbiddenError, 403, 'Forbidden'],
    [NotFoundError, 404, 'Not Found'],
    [ConflictError, 409, 'Conflict'],
  ])('%o has status %i and title "%s"', (ErrorClass, status, title) => {
    const err = new ErrorClass('some detail');

    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(status);
    expect(err.title).toBe(title);
    expect(err.message).toBe('some detail');
  });
});
