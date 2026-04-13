# realworld-django-htmx
**Django + HTMX fullstack implementation of the RealWorld spec — no API, no SPA**

## Rules

- **NEVER raise timeouts** without asking first. We build fast software. If a test times out, the code is broken — fix the code, don't raise the timeout. Raising timeouts destroys the feedback loop.

## Before finishing

Run `make verify` (lint + type-check + unit tests) and `make e2e` (Playwright e2e tests), and fix any issues.

## Testing

When asked to "run the tests", run both `make verify` and `make e2e`. The unit test suite has minimal coverage — e2e is the real test suite.

## Commands

- `make sync` - install dependencies
- `make verify` - lint, type-check, unit tests
- `make e2e` - run Playwright e2e tests
