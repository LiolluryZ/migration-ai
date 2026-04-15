/**
 * Unit tests for parseSequelizeError.
 *
 * Translated from helpers/tests.py::CleanIntegrityErrorTest.
 * Test strategy is identical: exercise the field-extraction logic in isolation,
 * using constructed error objects instead of real DB calls.
 *
 * Django fixtures used sqlite3.IntegrityError with a raw message and set
 * error.__cause__. Here we construct Sequelize UniqueConstraintError objects
 * directly — Sequelize's internal parsing is trusted; we only validate the
 * public contract of parseSequelizeError().
 */

import { UniqueConstraintError, ValidationErrorItem } from 'sequelize';
import { parseSequelizeError } from './errors';

/** Builds a minimal UniqueConstraintError with a single field path. */
function makeUniqueError(path: string): UniqueConstraintError {
  // Cast a minimal object to satisfy the type — only `path` is read by parseSequelizeError.
  // The full 8-arg ValidationErrorItem constructor requires unused fields (instance, fnArgs…).
  return new UniqueConstraintError({ errors: [{ path } as ValidationErrorItem] });
}

describe('parseSequelizeError', () => {
  it('returns field name for UniqueConstraintError on email', () => {
    // Mirrors: test_sqlite_unique_violation
    expect(parseSequelizeError(makeUniqueError('email'))).toBe('email');
  });

  it('returns field name for UniqueConstraintError on username', () => {
    // Mirrors: test_sqlite_unique_violation_username
    expect(parseSequelizeError(makeUniqueError('username'))).toBe('username');
  });

  it('returns null for non-UniqueConstraintError', () => {
    // Mirrors: test_returns_none_for_unknown_format
    // (Python: error.__cause__ = None → no recognised cause type)
    expect(parseSequelizeError(new Error('some unrelated error'))).toBeNull();
  });

  it('returns null when errors array is empty (malformed constraint error)', () => {
    // Mirrors: test_returns_none_for_malformed_message
    // Python source: SQLiteIntegrityError("something unexpected") → split() fails → None.
    // Sequelize equivalent: UniqueConstraintError with no entries in errors[].
    const error = new UniqueConstraintError({ errors: [] });
    expect(parseSequelizeError(error)).toBeNull();
  });
});
