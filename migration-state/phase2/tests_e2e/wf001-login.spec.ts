/**
 * WF-001 — Authentification (Login)
 *
 * Scenarios couverts :
 *   WF-001-NOM   : Connexion valide → redirect vers /
 *   WF-001-ERR-1 : Mot de passe incorrect → message generique (BR-011)
 *   WF-001-ERR-2 : Email inconnu → message generique (BR-011)
 *   WF-001-ERR-3 : Formulaire vide → reste sur /login (validation HTML5 Django novalidate, refus serveur)
 *
 * Regles metier liees : BR-011, BR-012
 */
import { test, expect } from '@playwright/test';

const SEED_EMAIL = 'test@email.com';
const SEED_PASSWORD = 'test';

test.describe('WF-001 — Authentification (Login)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('[WF-001-NOM] Credentials valides → redirection vers / (BR-011, BR-012)', async ({ page }) => {
    await page.getByPlaceholder('Email').fill(SEED_EMAIL);
    await page.getByPlaceholder('Password').fill(SEED_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL('/');
    // L'utilisateur est maintenant connecte : le lien de profil est visible dans la nav
    await expect(page.locator('nav a[href^="/profile/"]')).toBeVisible();
  });

  test('[WF-001-ERR-1] Mot de passe incorrect → message erreur generique, reste sur /login (BR-011)', async ({
    page,
  }) => {
    await page.getByPlaceholder('Email').fill(SEED_EMAIL);
    await page.getByPlaceholder('Password').fill('mot_de_passe_invalide_e2e');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL('/login');
    await expect(page.locator('.error-messages')).toContainText('Invalid email or password');
  });

  test('[WF-001-ERR-2] Email inconnu → message erreur generique, reste sur /login (BR-011)', async ({
    page,
  }) => {
    await page.getByPlaceholder('Email').fill('nobody_e2e@nonexistent.test.local');
    await page.getByPlaceholder('Password').fill('anypassword');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL('/login');
    await expect(page.locator('.error-messages')).toContainText('Invalid email or password');
  });

  test('[WF-001-ERR-3] Formulaire vide → reste sur /login (refus Django)', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Le formulaire Django (novalidate) retourne la page avec erreurs
    await expect(page).toHaveURL('/login');
  });
});
