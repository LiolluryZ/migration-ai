"""
Targeted unit tests for helpers with non-trivial logic.

Everything else — views, forms, models, templates — is validated by the
public RealWorld e2e test suite (make e2e). Unit tests here exist only for
logic that is hard to exercise through the browser: DB-engine-specific
error parsing, edge cases in pure functions, etc.
"""

from sqlite3 import IntegrityError as SQLiteIntegrityError
from unittest import TestCase

from django.db import IntegrityError

from helpers.exceptions import clean_integrity_error


class CleanIntegrityErrorTest(TestCase):
    def test_sqlite_unique_violation(self):
        """SQLite format: 'UNIQUE constraint failed: accounts_user.email'"""
        cause = SQLiteIntegrityError("UNIQUE constraint failed: accounts_user.email")
        error = IntegrityError()
        error.__cause__ = cause
        self.assertEqual(clean_integrity_error(error), "email")

    def test_sqlite_unique_violation_username(self):
        cause = SQLiteIntegrityError("UNIQUE constraint failed: accounts_user.username")
        error = IntegrityError()
        error.__cause__ = cause
        self.assertEqual(clean_integrity_error(error), "username")

    def test_returns_none_for_unknown_format(self):
        error = IntegrityError()
        error.__cause__ = None
        self.assertIsNone(clean_integrity_error(error))

    def test_returns_none_for_malformed_message(self):
        cause = SQLiteIntegrityError("something unexpected")
        error = IntegrityError()
        error.__cause__ = cause
        self.assertIsNone(clean_integrity_error(error))
