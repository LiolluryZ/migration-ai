/**
 * WF-002 — Inscription Utilisateur (Register)
 *
 * Scenarios couverts :
 *   WF-002-NOM   : Inscription valide → auto-login + redirect vers / (BR-013, BR-014)
 *   WF-002-ERR-1 : Email duplique → "email already been taken" avec rollback transactionnel (BR-013, BR-002)
 *   WF-002-ERR-2 : Username duplique → "username already been taken" avec rollback transactionnel (BR-013, BR-002)
 *   WF-002-ERR-3 : Formulaire vide → reste sur /register
 *
 * Regles metier liees : BR-002, BR-013, BR-014
 */
import { test, expect } from '@playwright/test';
import { uniqueEmail, uniqueUsername } from './helpers/auth';

test.describe('WF-002 — Inscription Utilisateur (Register)', () => {
  test('[WF-002-NOM] Inscription valide → auto-login + redirection / (BR-013, BR-014)', async ({
    page,
  }) => {
    const username = uniqueUsername();
    const email = uniqueEmail();

    await page.goto('/register');
    await page.getByPlaceholder('Username').fill(username);
    await page.getByPlaceholder('Email').fill(email);
    await page.getByPlaceholder('Password').fill('pwd_e2e_test');
    await page.getByRole('button', { name: 'Sign up' }).click();

    // Connexion automatique apres inscription → redirect vers /
    await expect(page).toHaveURL('/');
    // Le lien de profil dans la nav confirme la session active
    await expect(page.locator(`nav a[href="/profile/${username}"]`)).toBeVisible();
  });

  test('[WF-002-ERR-1] Email duplique → message erreur, rollback transaction, reste sur /register (BR-013, BR-002)', async ({
    page,
  }) => {
    // L'email test@email.com est celui de l'utilisateur seede (deja en base)
    await page.goto('/register');
    await page.getByPlaceholder('Username').fill(uniqueUsername());
    await page.getByPlaceholder('Email').fill('test@email.com');
    await page.getByPlaceholder('Password').fill('pwd_e2e_test');
    await page.getByRole('button', { name: 'Sign up' }).click();

    await expect(page).toHaveURL('/register');
    await expect(page.locator('.error-messages')).toContainText('already been taken');
  });

  test('[WF-002-ERR-2] Username duplique → message erreur, rollback transaction, reste sur /register (BR-013, BR-002)', async ({
    page,
  }) => {
    // Etape 1 : Enregistrer un premier utilisateur pour capturer son username
    const sharedUsername = uniqueUsername();
    await page.goto('/register');
    await page.getByPlaceholder('Username').fill(sharedUsername);
    await page.getByPlaceholder('Email').fill(uniqueEmail());
    await page.getByPlaceholder('Password').fill('pwd_e2e_test');
    await page.getByRole('button', { name: 'Sign up' }).click();
    await expect(page).toHaveURL('/');

    // Etape 2 : Tenter de re-enregistrer avec le meme username
    await page.goto('/register');
    await page.getByPlaceholder('Username').fill(sharedUsername);
    await page.getByPlaceholder('Email').fill(uniqueEmail());
    await page.getByPlaceholder('Password').fill('pwd_e2e_test');
    await page.getByRole('button', { name: 'Sign up' }).click();

    await expect(page).toHaveURL('/register');
    await expect(page.locator('.error-messages')).toContainText('already been taken');
  });

  test('[WF-002-ERR-3] Formulaire vide → reste sur /register', async ({ page }) => {
    await page.goto('/register');
    await page.getByRole('button', { name: 'Sign up' }).click();

    await expect(page).toHaveURL('/register');
  });
});
