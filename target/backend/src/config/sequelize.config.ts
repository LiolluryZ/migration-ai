import { Sequelize } from 'sequelize';
import type { Options } from 'sequelize';
import { env } from './env';

// Translates Django DATABASE_URL multi-provider logic to Sequelize.
// Source: config/settings.py :: DATABASE_URL conditional block (lines 83-100)
//
// BR-006: TIME_ZONE = 'UTC' / USE_TZ = True → timezone: '+00:00' in all dialects.
// Source: config/settings.py :: TIME_ZONE = "UTC", USE_TZ = True

function buildSequelizeConfig(): { uri?: string; options: Options } {
  const url = env.databaseUrl;

  // No DATABASE_URL: fallback to file-based SQLite (dev only).
  // Source: config/settings.py :: elif DEBUG: sqlite3 db.sqlite3
  if (!url) {
    return {
      options: {
        dialect: 'sqlite',
        storage: './db.sqlite3',
        timezone: '+00:00', // BR-006: UTC
        logging: false,
      },
    };
  }

  // In-memory or file: SQLite shorthand.
  // Source: config/settings.py :: if DATABASE_URL.startswith((":memory:", "file:"))
  if (url === ':memory:' || url.startsWith('file:')) {
    const storage = url === ':memory:' ? ':memory:' : url.replace(/^file:/, '');
    return {
      options: {
        dialect: 'sqlite',
        storage,
        timezone: '+00:00', // BR-006: UTC
        logging: false,
      },
    };
  }

  // PostgreSQL (or other URL-based dialect).
  // Source: config/settings.py :: elif DATABASE_URL: urlparse → postgresql
  return {
    uri: url,
    options: {
      dialect: 'postgres',
      dialectOptions: {
        // Enforce UTC on the pg client — BR-006
        useUTC: true,
        ssl:
          env.nodeEnv === 'production'
            ? { rejectUnauthorized: false }
            : false,
      },
      timezone: '+00:00', // BR-006: UTC
      logging: false,
    },
  };
}

const { uri, options } = buildSequelizeConfig();

// Export a single shared Sequelize instance for the entire application.
export const sequelize: Sequelize = uri
  ? new Sequelize(uri, options)
  : new Sequelize(options as Options & { dialect: 'sqlite' | 'postgres' });
