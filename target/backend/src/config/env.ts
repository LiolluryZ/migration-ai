import 'dotenv/config';

// Centralises all environment variable reads and validation.
// Source: config/settings.py :: SECRET_KEY, DEBUG, ALLOWED_HOSTS, DATABASE_URL

// SECRET_KEY → JWT_SECRET: must never be hardcoded.
// Source: config/settings.py :: SECRET_KEY
const jwtSecret = process.env.JWT_SECRET;
const isTest = Boolean(process.env.JEST_WORKER_ID);
if (!jwtSecret && !isTest) {
  throw new Error(
    'JWT_SECRET must be set. ' +
    'Generate with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"',
  );
}

// DATABASE_URL: multi-provider, matches Django logic exactly.
// Source: config/settings.py :: DATABASE_URL conditional block
const databaseUrl = process.env.DATABASE_URL || undefined;
if (!databaseUrl && process.env.NODE_ENV === 'production') {
  throw new Error(
    'DATABASE_URL must be set in production. ' +
    'Use: postgresql://user:password@host:5432/dbname',
  );
}

// ALLOWED_HOSTS → ALLOWED_ORIGINS: semicolon-separated, mirrors Django split.
// Source: config/settings.py :: ALLOWED_HOSTS = getenv(...).split(";")
const allowedOrigins: string[] =
  process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(';').filter(Boolean)
    : [];

// PBKDF2_ITERATIONS: HV-002 decision — PBKDF2 compatible Django, not bcrypt.
// Source: config/settings.py :: USE_FAST_HASHER → iterations=1 for tests.
const pbkdf2Iterations = parseInt(process.env.PBKDF2_ITERATIONS ?? '260000', 10);
if (pbkdf2Iterations < 1000 && !isTest && process.env.NODE_ENV === 'production') {
  throw new Error('PBKDF2_ITERATIONS is dangerously low for production.');
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3001', 10),
  jwtSecret: jwtSecret ?? '',   // empty string only reached in test (JEST_WORKER_ID set)
  databaseUrl,
  allowedOrigins,
  pbkdf2Iterations,
} as const;
