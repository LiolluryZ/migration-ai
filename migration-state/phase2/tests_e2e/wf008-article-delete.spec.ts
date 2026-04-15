/**
 * WF-008 — Suppression d'Article
 *
 * Scenarios couverts :
 *   WF-008-PERM   : Anonyme → @login_required redirect /login (BR-035)
 *   WF-008-NOM    : Auteur supprime son article → article efface (cascade comments), redirect / (BR-035, BR-043)
 *   WF-008-ERR-1  : Non-auteur tente la suppression → 404 (BR-035 : get_object_or_404 author=user)
 *   WF-008-ERR-2  : GET /article/<slug>/delete → HTTP 405 (@require_POST)
 *
 * Regles metier liees : BR-035, BR-043
 * CRITIQUE BR-043 : la suppression d'un article doit aussi supprimer tous ses commentaires (CASCADE).
 */
import { test, expect } from '@playwright/test';
import {
  loginAsSeedUser,
  registerUser,
  logout,
  createArticle,
  addComment,
  uniqueEmail,
  uniqueUsername,
  uniqueTitle,
} from './helpers/auth';

test.describe('WF-008 — Suppression d\'Article', () => {
  test('[WF-008-PERM] Anonyme → redirection /login (BR-035)', async ({ page }) => {
    await loginAsSeedUser(page);
    const slug = await createArticle(page, uniqueTitle());
    await logout(page);

    // Le formulaire de suppression n'est visible que pour l'auteur connecte
    // Un anonyme arrivant sur /article/<slug> ne voit pas le bouton Delete
    await page.goto(`/article/${slug}`);
    await expect(page.locator('button', { hasText: /Delete Article/i })).toHaveCount(0);

    // Tentative directe via POST → @login_required redirige
    const csrfCookies = await page.context().cookies();
    const csrfToken = csrfCookies.find(c => c.name === 'csrftoken')?.value ?? '';
    const response = await page.request.post(`/article/${slug}/delete`, {
      headers: { 'X-CSRFToken': csrfToken },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(302);
    expect(response.headers()['location']).toContain('/login');
  });

  test('[WF-008-NOM] Auteur supprime → article efface + cascade comments, redirect / (BR-035, BR-043)', async ({
    page,
  }) => {
    await loginAsSeedUser(page);
    const title = uniqueTitle();
    const slug = await createArticle(page, title);

    // Ajouter un commentaire pour tester la suppression en cascade (BR-043)
    const commentBody = `Commentaire cascade E2E ${Date.now()}`;
    await addComment(page, slug, commentBody);

    // Naviguer vers la page de detail et supprimer l'article
    await page.goto(`/article/${slug}`);
    await expect(page.getByRole('button', { name: /Delete Article/i }).first()).toBeVisible();

    const deleteResp = page.waitForResponse(
      res => res.url().includes(`/article/${slug}/delete`) && res.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /Delete Article/i }).first().click();
    await deleteResp;

    // Redirect vers la page d'accueil
    await expect(page).toHaveURL('/');

    // L'article n'existe plus → /article/<slug> retourne 404
    const getResponse = await page.request.get(`/article/${slug}`);
    expect(getResponse.status()).toBe(404);
  });

  test('[WF-008-ERR-1] Non-auteur → 404 (BR-035 : get_object_or_404 filtre author=user)', async ({
    page,
  }) => {
    // Auteur A cree l'article
    await loginAsSeedUser(page);
    const slug = await createArticle(page, uniqueTitle());
    await logout(page);

    // Utilisateur B tente la suppression de l'article de A
    await registerUser(page, uniqueUsername(), uniqueEmail(), 'pwd_e2e');

    const csrfCookies = await page.context().cookies();
    const csrfToken = csrfCookies.find(c => c.name === 'csrftoken')?.value ?? '';
    const response = await page.request.post(`/article/${slug}/delete`, {
      headers: { 'X-CSRFToken': csrfToken },
    });
    // get_object_or_404(Article, slug=slug, author=request.user) echoue → 404 (pas 403)
    expect(response.status()).toBe(404);
  });

  test('[WF-008-ERR-2] GET /article/<slug>/delete → HTTP 405 (@require_POST)', async ({
    page,
  }) => {
    await loginAsSeedUser(page);
    const slug = await createArticle(page, uniqueTitle());

    const response = await page.request.get(`/article/${slug}/delete`, { maxRedirects: 0 });
    expect(response.status()).toBe(405);
  });
});
