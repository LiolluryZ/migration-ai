# ![RealWorld Example App](logo.png)

> ### Django + HTMX codebase containing real world examples (CRUD, auth, advanced patterns, etc) that adheres to the [RealWorld](https://github.com/realworld-apps/realworld) spec.

### [RealWorld](https://github.com/realworld-apps/realworld)

A fullstack [RealWorld](https://github.com/realworld-apps/realworld) implementation (Medium clone) using **Django** for server-rendered HTML and **HTMX** for interactive elements — no API, no SPA.

#### Architecture

- **Views** use Django session auth, standard forms, and `@login_required`
- **HTMX** handles interactive elements: favorites, follows, comments, feed pagination/tab switching
- **E2E tests** validate the fullstack behavior via Playwright

#### Origin

Ported from [c4ffein/realworld-django-ninja](https://github.com/c4ffein/realworld-django-ninja), itself based on [Sean-Miningah/realWorld-DjangoRestFramework](https://github.com/Sean-Miningah/realWorld-DjangoRestFramework).

For more RealWorld implementations, see [codebase.show](https://codebase.show/projects/realworld).

## Usage

1. Clone with submodules and install dependencies

This project uses a Git submodule for static assets (CSS, icons, etc.) and the E2E test suite. You **must** initialize submodules when cloning:

```shell
git clone --recurse-submodules <repo-url>
cd realworld-django-htmx
make sync
```

If you already cloned without `--recurse-submodules`, initialize them manually:

```shell
git submodule update --init --recursive
```

2. Apply migrations and run

```shell
# SQLite (development)
DEBUG=True make migrate
make run-debug

# PostgreSQL (production)
DATABASE_URL=postgresql://user:password@host:port/dbname make migrate
DATABASE_URL=postgresql://user:password@host:port/dbname ALLOWED_HOSTS=* make run
```

### Using Docker

```shell
docker compose up          # run
docker compose up --build  # rebuild and run
```

## Testing

| Command | Description |
|---------|-------------|
| `make test-django-fast` | Unit tests (in-memory SQLite, fast hasher) |
| `make test-django` | Unit tests (file-based SQLite) |
| `make e2e` | Playwright e2e tests (auto-starts server, needs bun) |
| `make verify` | Lint + type-check + unit tests |

### Current test status

- **Unit tests:** 4/4 passing — minimal, only covering internals hard to reach via browser (DB error parsing)
- **E2E tests:** 74/74 passing (65 API-only tests skipped) — the [RealWorld e2e suite](https://github.com/realworld-apps/realworld) is the primary test coverage for this project, validating views, forms, and models through real browser interactions

## Development

- `make lint` — auto-fix lint issues (ruff)
- `make lint-check` — check without fixing
- `make type-check` — run ty type checker
- `make clean` — remove `__pycache__` directories

## License

- Original code by [Sean-Miningah](https://github.com/Sean-Miningah/) under [MIT License](https://github.com/Sean-Miningah/realWorld-DjangoRestFramework/blob/master/LICENSE)
- Django Ninja port by [c4ffein](https://github.com/c4ffein/) under [MIT License](https://github.com/c4ffein/realworld-django-ninja/blob/master/LICENSE)
- HTMX port also under [MIT License](LICENSE)
