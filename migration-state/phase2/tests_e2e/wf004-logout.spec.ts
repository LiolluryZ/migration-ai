/**
 * WF-004 — Deconnexion (Logout)
 *
 * Scenarios couverts :
 *   WF-004-NOM : POST /logout depuis la page settings → session detruite, redirect / (BR-016)
 *   WF-004-ERR : GET /logout → HTTP 405 Method Not Allowed (@require_POST)
 *
 * Regles metier liees : BR-016
 * Note : ANOMALIE WARNING — logout_view n'a pas de @login_required.
 *        Un utilisateur non connecte peut POST /logout sans erreur (no-op Django logout()).
 */
import { test, expect } from '@playwright/test';
import { loginAsSeedUser } from './helpers/auth';

test.describe('WF-004 — Deconnexion (Logout)', () => {
  test('[WF-004-NOM] POST /logout → session detruite + redirection / (BR-016)', async ({
    page,
  }) => {
    await loginAsSeedUser(page);

    // Le bouton logout se trouve sur la page /settings (forme inline POST /logout)
    await page.goto('/settings');
    await page.getByRole('button', { name: /logout/i }).click();

    await expect(page).toHaveURL('/');
    // Apres deconnexion : les liens "Sign in" et "Sign up" reapparaissent dans la nav
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible();
    // Le lien de profil ne doit plus etre present
    await expect(page.locator('nav a[href^="/profile/"]')).toHaveCount(0);
  });

  test('[WF-004-ERR] GET /logout → HTTP 405 Method Not Allowed (@require_POST)', async ({
    page,
  }) => {
    const response = await page.request.get('/logout', { maxRedirects: 0 });

    expect(response.status()).toBe(405);
  });
});
