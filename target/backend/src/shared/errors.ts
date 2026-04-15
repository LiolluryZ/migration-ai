import { UniqueConstraintError } from 'sequelize';

/**
 * Converts a Sequelize UniqueConstraintError into the name of the field that
 * caused the violation (e.g. 'email', 'username'), or null for unknown errors.
 *
 * Source: helpers/exceptions.py::clean_integrity_error()
 * Covers: BR-002
 *
 * DESIGN NOTE — why this is simpler than the Python source:
 *   The Python version manually parses raw DB error messages from two drivers
 *   (psycopg2.errors.UniqueViolation and sqlite3.IntegrityError) using string
 *   splits because Django surfaces the raw cause.  Sequelize already parses
 *   both PostgreSQL and SQLite constraint messages and exposes the field name
 *   as error.errors[0].path — so no manual string parsing is needed.
 *
 * NOT MIGRATED from helpers/exceptions.py:
 *   - ResourceNotFound (extends Http404): confirmed dead code (Phase 0 audit).
 *   - get_or_404(): confirmed dead code (Phase 0 audit). Django ORM helper
 *     with no callers; Fastify routes use Sequelize findOne() directly.
 */
export function parseSequelizeError(error: unknown): string | null {
  try {
    if (error instanceof UniqueConstraintError) {
      // Sequelize sets errors[0].path to the offending column name for both
      // PostgreSQL (UniqueViolation) and SQLite (IntegrityError) backends.
      return error.errors[0]?.path ?? null;
    }
    return null;
  } catch {
    // Swallow any unexpected exception, matching the catch-all in the source.
    return null;
  }
}
