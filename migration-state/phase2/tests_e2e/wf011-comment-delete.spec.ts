/**
 * WF-011 — Suppression de Commentaire
 *
 * Scenarios couverts :
 *   WF-011-PERM-ANON  : Anonyme → @login_required redirect /login (BR-044)
 *   WF-011-NOM-1      : Auteur du commentaire supprime son propre commentaire → commentaire efface (BR-041)
 *   WF-011-NOM-2      : Auteur de l'article (moderation) supprime un commentaire tiers → efface (BR-041)
 *   WF-011-ERR-403    : Ni auteur du commentaire ni auteur de l'article → HTTP 403 Forbidden (BR-041)
 *
 * Regles metier liees : BR-001 (HTMX), BR-041, BR-042, BR-044
 * CRITIQUE BR-041 : double condition d'autorisation — auteur du commentaire OU auteur de l'article.
 * Note BR-044 : si comment_id n'appartient pas a l'article du slug → 404 (pas 403).
 * Note HTMX : l'icone trash (i.ion-trash-a) porte hx-post, hx-target="#comment-list", hx-swap="innerHTML".
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

/**
 * Retourne l'ID du premier commentaire visible dont le texte correspond a `commentText`.
 * Extrait l'ID depuis l'attribut hx-post de l'icone trash.
 */
async function getCommentId(page: import('@playwright/test').Page, commentText: string): Promise<string> {
  // Trouver la card contenant le texte du commentaire
  const card = page.locator('.card').filter({ hasText: commentText }).first();
  await card.waitFor({ state: 'visible' });
  const trashIcon = card.locator('.mod-options .ion-trash-a');
  const hxPost = await trashIcon.getAttribute('hx-post');
  const match = (hxPost ?? '').match(/comment\/(\d+)\/delete/);
  if (!match?.[1]) throw new Error(`Impossible d'extraire l'ID depuis hx-post="${hxPost}"`);
  return match[1];
}

test.describe('WF-011 — Suppression de Commentaire', () => {
  test('[WF-011-PERM-ANON] Anonyme → @login_required redirect /login (BR-044)', async ({
    page,
  }) => {
    await loginAsSeedUser(page);
    const slug = await createArticle(page, uniqueTitle());
    const commentText = `Comment pour test anon ${Date.now()}`;
    await addComment(page, slug, commentText);
    await page.goto(`/article/${slug}`);

    const commentId = await getCommentId(page, commentText);
    await logout(page);

    const csrfCookies = await page.context().cookies();
    const csrfToken = csrfCookies.find(c => c.name === 'csrftoken')?.value ?? '';
    const response = await page.request.post(`/article/${slug}/comment/${commentId}/delete`, {
      headers: { 'X-CSRFToken': csrfToken },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(302);
    expect(response.headers()['location']).toContain('/login');
  });

  test('[WF-011-NOM-1] Auteur du commentaire supprime son propre commentaire (BR-041)', async ({
    page,
  }) => {
    await loginAsSeedUser(page);
    const slug = await createArticle(page, uniqueTitle());
    const commentText = `Mon commentaire ${Date.now()}`;
    await addComment(page, slug, commentText);

    await page.goto(`/article/${slug}`);
    // Le commentaire est visible et l'icone trash est presente pour l'auteur
    await expect(page.locator('#comment-list')).toContainText(commentText);
    const trashIcon = page
      .locator('.card')
      .filter({ hasText: commentText })
      .first()
      .locator('.mod-options .ion-trash-a');
    await expect(trashIcon).toBeVisible();

    // HTMX : cliquer sur l'icone trash (hx-post + hx-swap="innerHTML")
    const htmxResp = page.waitForResponse(
      res => res.url().includes('/comment/') && res.url().includes('/delete') && res.status() === 200,
    );
    await trashIcon.click();
    await htmxResp;

    // Le commentaire ne doit plus apparaitre dans #comment-list
    await expect(page.locator('#comment-list')).not.toContainText(commentText);
  });

  test('[WF-011-NOM-2] Auteur de l\'article supprime le commentaire d\'un autre (moderation, BR-041)', async ({
    page,
  }) => {
    // Auteur A cree l'article
    await loginAsSeedUser(page);
    const slug = await createArticle(page, uniqueTitle());
    await logout(page);

    // Utilisateur B laisse un commentaire sur l'article de A
    const userBName = uniqueUsername();
    const userBEmail = uniqueEmail();
    await registerUser(page, userBName, userBEmail, 'pwd_e2e');
    const commentText = `Commentaire de UserB ${Date.now()}`;
    await addComment(page, slug, commentText);
    await logout(page);

    // Auteur A se reconnecte et supprime le commentaire de B (droit de moderation)
    await loginAsSeedUser(page);
    await page.goto(`/article/${slug}`);

    await expect(page.locator('#comment-list')).toContainText(commentText);
    const trashIcon = page
      .locator('.card')
      .filter({ hasText: commentText })
      .first()
      .locator('.mod-options .ion-trash-a');
    await expect(trashIcon).toBeVisible();

    const htmxResp = page.waitForResponse(
      res => res.url().includes('/comment/') && res.url().includes('/delete') && res.status() === 200,
    );
    await trashIcon.click();
    await htmxResp;

    await expect(page.locator('#comment-list')).not.toContainText(commentText);
  });

  test('[WF-011-ERR-403] Ni auteur commentaire ni auteur article → HTTP 403 Forbidden (BR-041)', async ({
    page,
  }) => {
    // Auteur A cree l'article
    await loginAsSeedUser(page);
    const slug = await createArticle(page, uniqueTitle());
    const commentText = `Comment pour 403 test ${Date.now()}`;
    await addComment(page, slug, commentText);
    await page.goto(`/article/${slug}`);
    const commentId = await getCommentId(page, commentText);
    await logout(page);

    // Utilisateur C (tiers, ni auteur article ni auteur commentaire) tente la suppression
    await registerUser(page, uniqueUsername(), uniqueEmail(), 'pwd_e2e');

    const csrfCookies = await page.context().cookies();
    const csrfToken = csrfCookies.find(c => c.name === 'csrftoken')?.value ?? '';
    const response = await page.request.post(`/article/${slug}/comment/${commentId}/delete`, {
      headers: { 'X-CSRFToken': csrfToken },
    });
    // BR-041 : ni auteur commentaire, ni auteur article → HttpResponseForbidden (403)
    expect(response.status()).toBe(403);
  });

  test('[WF-011-ERR-404] comment_id hors article → 404 (BR-044)', async ({ page }) => {
    // Auteur A : creer deux articles avec des commentaires
    await loginAsSeedUser(page);
    const slug1 = await createArticle(page, uniqueTitle());
    const slug2 = await createArticle(page, uniqueTitle());
    const commentText = `Comment dans article 1 — ${Date.now()}`;
    await addComment(page, slug1, commentText);
    await page.goto(`/article/${slug1}`);
    const commentIdInArticle1 = await getCommentId(page, commentText);

    // Tenter de supprimer le commentaire de l'article 1 via l'URL de l'article 2
    // get_object_or_404(Comment, id=commentId, article=article2) echoue → 404
    const csrfCookies = await page.context().cookies();
    const csrfToken = csrfCookies.find(c => c.name === 'csrftoken')?.value ?? '';
    const response = await page.request.post(
      `/article/${slug2}/comment/${commentIdInArticle1}/delete`,
      { headers: { 'X-CSRFToken': csrfToken } },
    );
    expect(response.status()).toBe(404);
  });
});
