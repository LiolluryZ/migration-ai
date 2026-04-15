import { defineConfig, devices } from '@playwright/test';

/**
 * URL de base configurable via la variable d'environnement BASE_URL.
 * Par defaut : http://localhost:8000 (serveur legacy Django).
 *
 * Idempotence : le global setup sauvegarde db.sqlite3 avant les tests,
 * le global teardown la restaure apres — quelle que soit l'issue des tests.
 * Le chemin DB est surchargeable via la variable d'environnement DB_PATH.
 */
export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  retries: 0,
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:8000',
    trace: 'on-first-retry',
    locale: 'en-US',
    actionTimeout: 10_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
