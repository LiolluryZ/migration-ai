/**
 * WF-003 — Modification des Parametres Utilisateur (Settings)
 *
 * Scenarios couverts :
 *   WF-003-PERM  : Utilisateur anonyme → redirection /login?next=/settings (BR-020)
 *   WF-003-NOM-1 : Mise a jour bio sans changement de mot de passe → redirect /profile/<username> (BR-015)
 *   WF-003-NOM-2 : Changement de mot de passe → re-login automatique, session active, redirect profil (BR-015)
 *   WF-003-ERR   : Formulaire invalide (email vide) → reste sur /settings
 *
 * Regles metier liees : BR-015, BR-020
 */
import { test, expect } from '@playwright/test';
import {
  loginAsSeedUser,
  registerUser,
  getLoggedInUsername,
  uniqueEmail,
  uniqueUsername,
} from './helpers/auth';

test.describe('WF-003 — Modification des Parametres Utilisateur (Settings)', () => {
  test('[WF-003-PERM] Anonyme → redirection /login?next=/settings (BR-020)', async ({ page }) => {
    await page.goto('/settings');

    await expect(page).toHaveURL(/\/login/);
    // Django @login_required ajoute le parametre next
    expect(page.url()).toContain('next=');
  });

  test('[WF-003-NOM-1] Mise a jour bio (sans MDP) → redirect /profile/<username> (BR-015)', async ({
    page,
  }) => {
    await loginAsSeedUser(page);
    const username = await getLoggedInUsername(page);

    await page.goto('/settings');
    const newBio = `Bio E2E mise a jour ${Date.now()}`;
    await page.getByPlaceholder('Short bio about you').fill(newBio);

    const settingsResp = page.waitForResponse(
      res => res.url().includes('/settings') && res.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Update Settings' }).click();
    await settingsResp;

    // Redirection vers la page de profil apres sauvegarde
    await expect(page).toHaveURL(new RegExp(`/profile/${username}`));
    // La bio mise a jour est visible sur la page de profil
    await expect(page.getByText(newBio)).toBeVisible();
  });

  test('[WF-003-NOM-2] Changement de mot de passe → re-login interne, session maintenue, redirect profil (BR-015)', async ({
    page,
  }) => {
    // Utilise un utilisateur frais pour eviter de modifier les credentials du SEED_USER
    const username = uniqueUsername();
    const email = uniqueEmail();
    const originalPwd = 'original_pwd_e2e';
    const newPwd = 'new_pwd_e2e';

    await registerUser(page, username, email, originalPwd);
    await expect(page).toHaveURL('/');

    await page.goto('/settings');
    await page.getByPlaceholder('New Password').fill(newPwd);
    await page.getByRole('button', { name: 'Update Settings' }).click();

    // Apres changement de mot de passe : re-login automatique conserve la session
    await expect(page).toHaveURL(new RegExp(`/profile/${username}`));
    // Session encore active : lien de profil present dans la nav
    await expect(page.locator(`nav a[href="/profile/${username}"]`)).toBeVisible();
  });

  test('[WF-003-ERR] Email vide → formulaire invalide, reste sur /settings', async ({ page }) => {
    await loginAsSeedUser(page);

    await page.goto('/settings');
    await page.getByPlaceholder('Email').fill('');
    await page.getByRole('button', { name: 'Update Settings' }).click();

    // Django renvoie le formulaire avec erreurs : pas de redirection
    await expect(page).toHaveURL('/settings');
  });
});
