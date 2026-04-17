"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const errors_1 = require("./errors");
/** Builds a minimal UniqueConstraintError with a single field path. */
function makeUniqueError(path) {
    // Cast a minimal object to satisfy the type — only `path` is read by parseSequelizeError.
    // The full 8-arg ValidationErrorItem constructor requires unused fields (instance, fnArgs…).
    return new sequelize_1.UniqueConstraintError({ errors: [{ path }] });
}
describe('parseSequelizeError', () => {
    it('returns field name for UniqueConstraintError on email', () => {
        // Mirrors: test_sqlite_unique_violation
        expect((0, errors_1.parseSequelizeError)(makeUniqueError('email'))).toBe('email');
    });
    it('returns field name for UniqueConstraintError on username', () => {
        // Mirrors: test_sqlite_unique_violation_username
        expect((0, errors_1.parseSequelizeError)(makeUniqueError('username'))).toBe('username');
    });
    it('returns null for non-UniqueConstraintError', () => {
        // Mirrors: test_returns_none_for_unknown_format
        // (Python: error.__cause__ = None → no recognised cause type)
        expect((0, errors_1.parseSequelizeError)(new Error('some unrelated error'))).toBeNull();
    });
    it('returns null when errors array is empty (malformed constraint error)', () => {
        // Mirrors: test_returns_none_for_malformed_message
        // Python source: SQLiteIntegrityError("something unexpected") → split() fails → None.
        // Sequelize equivalent: UniqueConstraintError with no entries in errors[].
        const error = new sequelize_1.UniqueConstraintError({ errors: [] });
        expect((0, errors_1.parseSequelizeError)(error)).toBeNull();
    });
});
