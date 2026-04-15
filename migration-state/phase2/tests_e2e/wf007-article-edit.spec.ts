/**
 * WF-007 — Edition d'Article
 *
 * Scenarios couverts :
 *   WF-007-PERM   : Anonyme → @login_required redirect /login (BR-034)
 *   WF-007-NOM    : Auteur edite son article → sauvegarde, slug INCHANGE, redirect vers detail (BR-023, BR-034)
 *   WF-007-ERR-1  : Non-auteur tente l'edition → 404 (get_object_or_404 author=request.user) (BR-034)
 *   WF-007-ERR-2  : Formulaire invalide (titre vide) → reste sur /article/<slug>/edit
 *
 * Regles metier liees : BR-023, BR-027, BR-031, BR-032, BR-034
 * CRITIQUE BR-023 : le slug NE doit PAS changer a l'edition, meme si le titre change.
 */
import { test, expect } from '@playwright/test';
import {
  loginAsSeedUser,
  registerUser,
  logout,
  createArticle,
  uniqueEmail,
  uniqueUsername,
  uniqueTitle,
} from './helpers/auth';

test.describe('WF-007 — Edition d\'Article', () => {
  test('[WF-007-PERM] Anonyme → redirection /login (BR-034)', async ({ page }) => {
    // Creer un article pour avoir un slug valide
    await loginAsSeedUser(page);
    const slug = await createArticle(page, uniqueTitle());
    await logout(page);

    await page.goto(`/editor/${slug}`);
    await expect(page).toHaveURL(/\/login/);
  });

  test('[WF-007-NOM] Auteur edite son article → titre mis a jour, slug inchange (BR-023, BR-034)', async ({
    page,
  }) => {
    await loginAsSeedUser(page);
    const originalTitle = uniqueTitle();
    const slug = await createArticle(page, originalTitle);

    await page.goto(`/editor/${slug}`);
    await expect(page).toHaveURL(`/editor/${slug}`);

    // Modifier le titre
    const newTitle = `${originalTitle} EDITE`;
    await page.getByPlaceholder('Article Title').fill(newTitle);
    await page.getByRole('button', { name: 'Publish Article' }).click();

    // Redirection vers le detail AVEC LE MEME SLUG (BR-023 : slug inchange a l'edition)
    await expect(page).toHaveURL(`/article/${slug}`);
    // Le nouveau titre est visible
    await expect(page.getByRole('heading', { name: newTitle })).toBeVisible();
  });

  test('[WF-007-ERR-1] Non-auteur → 404 (BR-034 : get_object_or_404 avec filtre author=user)', async ({
    page,
  }) => {
    // Auteur A cree l'article
    await loginAsSeedUser(page);
    const slug = await createArticle(page, uniqueTitle());
    await logout(page);

    // Utilisateur B tente d'editer l'article de A
    const userBName = uniqueUsername();
    await registerUser(page, userBName, uniqueEmail(), 'pwd_e2e');
    await page.goto(`/editor/${slug}`);

    // get_object_or_404(Article, slug=slug, author=request.user) echoue → 404 (pas 403)
    await expect(page).toHaveURL(`/editor/${slug}`);
    expect(await page.title()).toMatch(/404|Not Found/i);
  });

  test('[WF-007-ERR-2] Titre vide → formulaire invalide, reste sur /edit', async ({ page }) => {
    await loginAsSeedUser(page);
    const slug = await createArticle(page, uniqueTitle());

    await page.goto(`/editor/${slug}`);
    await page.getByPlaceholder('Article Title').fill('');
    await page.getByRole('button', { name: 'Publish Article' }).click();

    await expect(page).toHaveURL(`/editor/${slug}`);
    await expect(page.locator('.error-messages')).toBeVisible();
  });
});
