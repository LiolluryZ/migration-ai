import { defineConfig, devices } from '@playwright/test';

const MEMDB = 'file:memdb1?mode=memory&cache=shared';

/**
 * Playwright config for running the unified RealWorld e2e specs
 * against this Django + HTMX implementation.
 *
 * Automatically starts a Django dev server with in-memory SQLite.
 *
 * Usage:
 *   USE_API=false bun playwright test
 */
export default defineConfig({
  testDir: '../realworld/specs/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: [['html', { outputFolder: './playwright-report' }]],
  outputDir: './test-results',
  timeout: 30_000,

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:8000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  expect: {
    timeout: 5_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: [
      'uv run python -c',
      '"import django; django.setup();',
      'from django.core.management import call_command;',
      "call_command('migrate', verbosity=0);",
      "call_command('seed_data');",
      "call_command('runserver', '0.0.0.0:8000', '--noreload')\"",
    ].join(' '),
    cwd: '..',
    url: 'http://localhost:8000',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: {
      DEBUG: 'True',
      DATABASE_URL: MEMDB,
      USE_FAST_HASHER: 'True',
      DJANGO_SETTINGS_MODULE: 'config.settings',
    },
  },
});
