/**
 * WF-010 — Creation de Commentaire
 *
 * Scenarios couverts :
 *   WF-010-PERM  : Anonyme → formulaire absent, message "Sign in or sign up to add comments" (BR-053)
 *                  POST direct → @login_required redirect /login (BR-040)
 *   WF-010-NOM   : Corps non-vide → commentaire cree et visible dans la liste (BR-039, BR-040)
 *   WF-010-EDGE  : Corps vide (ou espaces) → skip silencieux, aucun commentaire cree (BR-039)
 *
 * Regles metier liees : BR-001 (HTMX), BR-039, BR-040, BR-042, BR-053
 * Note BR-039 : le corps est trimme (strip()) avant test du vide.
 * Note HTMX : la reponse remplace le contenu de #comment-list (hx-target="#comment-list" hx-swap="innerHTML").
 */
import { test, expect } from '@playwright/test';
import { loginAsSeedUser, logout, createArticle, uniqueTitle } from './helpers/auth';

test.describe('WF-010 — Creation de Commentaire', () => {
  test('[WF-010-PERM] Anonyme — formulaire remplace par invite de connexion (BR-053)', async ({
    page,
  }) => {
    await loginAsSeedUser(page);
    const slug = await createArticle(page, uniqueTitle());
    await logout(page);

    await page.goto(`/article/${slug}`);

    // Pour un anonyme : le formulaire de commentaire n'existe pas
    await expect(page.getByPlaceholder('Write a comment...')).toHaveCount(0);
    // A la place, un message d'invitation a se connecter
    await expect(page.locator('.comment-auth-prompt')).toContainText('Sign in or sign up');
  });

  test('[WF-010-PERM-API] Anonyme — POST direct → @login_required redirect (BR-040)', async ({
    page,
  }) => {
    await loginAsSeedUser(page);
    const slug = await createArticle(page, uniqueTitle());
    await logout(page);

    const csrfCookies = await page.context().cookies();
    const csrfToken = csrfCookies.find(c => c.name === 'csrftoken')?.value ?? '';
    const response = await page.request.post(`/article/${slug}/comment`, {
      headers: { 'X-CSRFToken': csrfToken },
      form: { body: 'commentaire non autorise' },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(302);
    expect(response.headers()['location']).toContain('/login');
  });

  test('[WF-010-NOM] Corps non-vide → commentaire cree, visible dans #comment-list (BR-039, BR-040)', async ({
    page,
  }) => {
    await loginAsSeedUser(page);
    const slug = await createArticle(page, uniqueTitle());

    await page.goto(`/article/${slug}`);
    const commentText = `Commentaire E2E test ${Date.now()}`;
    await page.getByPlaceholder('Write a comment...').fill(commentText);

    // HTMX POST : attendre la reponse qui met a jour #comment-list
    const htmxResp = page.waitForResponse(
      res => res.url().includes(`/article/${slug}/comment`) && !res.url().includes('/delete') && res.status() === 200,
    );
    await page.getByRole('button', { name: 'Post Comment' }).click();
    await htmxResp;

    // Le commentaire est maintenant visible dans la liste
    await expect(page.locator('#comment-list')).toContainText(commentText);
    // Le formulaire a ete reinitialise (hx-on::after-request="this.reset()")
    await expect(page.getByPlaceholder('Write a comment...')).toHaveValue('');
  });

  test('[WF-010-EDGE] Corps vide → skip silencieux, aucun commentaire cree (BR-039)', async ({
    page,
  }) => {
    await loginAsSeedUser(page);
    const slug = await createArticle(page, uniqueTitle());

    await page.goto(`/article/${slug}`);

    // Compter les commentaires initiaux (0 sur un article frais)
    const initialCount = await page.locator('#comment-list .card').count();

    // Soumettre un commentaire vide
    await page.getByPlaceholder('Write a comment...').fill('   '); // Espaces seulement
    const htmxResp = page.waitForResponse(
      res => res.url().includes(`/article/${slug}/comment`) && !res.url().includes('/delete') && res.status() === 200,
    );
    await page.getByRole('button', { name: 'Post Comment' }).click();
    await htmxResp;

    // Aucun nouveau commentaire ne doit etre cree (skip silencieux BR-039 : strip() == '')
    const finalCount = await page.locator('#comment-list .card').count();
    expect(finalCount).toBe(initialCount);
  });

  test('[WF-010-EDGE-2] Corps avec uniquement espaces → skip silencieux (BR-039 strip)', async ({
    page,
  }) => {
    await loginAsSeedUser(page);
    const slug = await createArticle(page, uniqueTitle());

    await page.goto(`/article/${slug}`);
    const initialCount = await page.locator('#comment-list .card').count();

    // Corps vide
    await page.getByPlaceholder('Write a comment...').fill('');
    const htmxResp = page.waitForResponse(
      res => res.url().includes(`/article/${slug}/comment`) && !res.url().includes('/delete') && res.status() === 200,
    );
    await page.getByRole('button', { name: 'Post Comment' }).click();
    await htmxResp;

    const finalCount = await page.locator('#comment-list .card').count();
    expect(finalCount).toBe(initialCount);
  });
});
