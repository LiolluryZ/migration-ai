/**
 * WF-005 — Toggle Suivi Utilisateur (Follow/Unfollow)
 *
 * Scenarios couverts :
 *   WF-005-PERM   : Anonyme → @login_required redirect /login (BR-019, BR-020)
 *   WF-005-NOM-1  : Follow d'un autre utilisateur → bouton change en "Unfollow" (BR-019, BR-010)
 *   WF-005-NOM-2  : Unfollow apres Follow → bouton revient en "Follow" (BR-019, BR-010)
 *   WF-005-AUTO   : Auto-follow interdit → bouton Follow absent sur son propre profil (BR-019)
 *                   Appel direct POST → no-op serveur (is_following=False)
 *
 * Regles metier liees : BR-010, BR-019
 * Note HTMX : le bouton Follow utilise hx-post avec hx-swap="outerHTML" — la reponse remplace le bouton.
 */
import { test, expect } from '@playwright/test';
import {
  loginAsSeedUser,
  registerUser,
  logout,
  getLoggedInUsername,
  uniqueEmail,
  uniqueUsername,
} from './helpers/auth';

test.describe('WF-005 — Toggle Suivi Utilisateur (Follow/Unfollow)', () => {
  test('[WF-005-PERM] Anonyme — POST /profile/<username>/follow → redirection /login (BR-019, BR-020)', async ({
    page,
  }) => {
    // Cree un utilisateur cible
    const targetUsername = uniqueUsername();
    await registerUser(page, targetUsername, uniqueEmail(), 'pwd_e2e');
    await logout(page);

    // Tentative de follow sans session : Django @login_required retourne 302 vers /login
    const csrfCookies = await page.context().cookies();
    const csrfToken = csrfCookies.find(c => c.name === 'csrftoken')?.value ?? '';
    const response = await page.request.post(`/profile/${targetUsername}/follow`, {
      headers: { 'X-CSRFToken': csrfToken },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(302);
    expect(response.headers()['location']).toContain('/login');
  });

  test('[WF-005-NOM-1] Follow d\'un utilisateur → bouton devient "Unfollow" (BR-019, BR-010)', async ({
    page,
  }) => {
    // Setup : enregistrer l'utilisateur cible
    const targetUsername = uniqueUsername();
    await registerUser(page, targetUsername, uniqueEmail(), 'pwd_e2e');
    await logout(page);

    // Se connecter en tant que seed user
    await loginAsSeedUser(page);
    await page.goto(`/profile/${targetUsername}`);

    // Bouton "Follow <username>" visible
    const followBtn = page.getByRole('button', { name: new RegExp(`Follow ${targetUsername}`) });
    await expect(followBtn).toBeVisible();

    // Cliquer → HTMX POST + swap outerHTML
    const htmxResp = page.waitForResponse(
      res => res.url().includes(`/profile/${targetUsername}/follow`) && res.status() === 200,
    );
    await followBtn.click();
    await htmxResp;

    // Apres HTMX swap, le bouton affiche "Unfollow <username>"
    await expect(
      page.getByRole('button', { name: new RegExp(`Unfollow ${targetUsername}`) }),
    ).toBeVisible();
  });

  test('[WF-005-NOM-2] Unfollow apres Follow → bouton revient en "Follow" (BR-019, BR-010)', async ({
    page,
  }) => {
    const targetUsername = uniqueUsername();
    await registerUser(page, targetUsername, uniqueEmail(), 'pwd_e2e');
    await logout(page);

    await loginAsSeedUser(page);
    await page.goto(`/profile/${targetUsername}`);

    // Follow
    const followResp1 = page.waitForResponse(
      res => res.url().includes(`/profile/${targetUsername}/follow`) && res.status() === 200,
    );
    await page.getByRole('button', { name: new RegExp(`Follow ${targetUsername}`) }).click();
    await followResp1;
    await expect(
      page.getByRole('button', { name: new RegExp(`Unfollow ${targetUsername}`) }),
    ).toBeVisible();

    // Unfollow
    const followResp2 = page.waitForResponse(
      res => res.url().includes(`/profile/${targetUsername}/follow`) && res.status() === 200,
    );
    await page.getByRole('button', { name: new RegExp(`Unfollow ${targetUsername}`) }).click();
    await followResp2;
    await expect(
      page.getByRole('button', { name: new RegExp(`Follow ${targetUsername}`) }),
    ).toBeVisible();
  });

  test('[WF-005-AUTO] Auto-follow interdit — bouton absent sur son propre profil (BR-019)', async ({
    page,
  }) => {
    await loginAsSeedUser(page);
    const ownUsername = await getLoggedInUsername(page);

    await page.goto(`/profile/${ownUsername}`);

    // Sur son propre profil : template affiche "Edit Profile Settings", pas de bouton Follow
    await expect(page.getByRole('link', { name: /Edit Profile Settings/i })).toBeVisible();
    await expect(page.locator('button').filter({ hasText: /Follow/ })).toHaveCount(0);

    // Appel direct POST auto-follow → serveur no-op, is_following=False dans la reponse HTML
    const csrfCookies = await page.context().cookies();
    const csrfToken = csrfCookies.find(c => c.name === 'csrftoken')?.value ?? '';
    const response = await page.request.post(`/profile/${ownUsername}/follow`, {
      headers: { 'X-CSRFToken': csrfToken, 'HX-Request': 'true' },
    });
    expect(response.status()).toBe(200);
    // Le template follow_button.html a une garde user != profile_user → retourne vide pour soi-meme
    // Verifier que l'auto-follow n'a pas cree de suivi (pas de "Unfollow" dans la reponse)
    const html = await response.text();
    expect(html).not.toMatch(/Unfollow/);
  });
});
