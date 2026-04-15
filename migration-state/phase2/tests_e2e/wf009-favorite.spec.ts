/**
 * WF-009 — Toggle Favori Article (Favorite/Unfavorite)
 *
 * Scenarios couverts :
 *   WF-009-PERM  : Anonyme → onclick redirige vers /login (BR-036, BR-051)
 *   WF-009-NOM-1 : Favoriser un article → compteur incremente, bouton "Unfavorite" (BR-036, BR-025)
 *   WF-009-NOM-2 : Defavoriser → compteur decremente, bouton revient en "Favorite" (BR-036, BR-025)
 *
 * Regles metier liees : BR-025, BR-036, BR-051
 * Note HTMX : le bouton favorite utilise hx-post + hx-swap="outerHTML".
 * Note BR-025 : le compteur est recalcule via re-annotation with_favorites() apres chaque toggle.
 * Note : l'auteur peut favoriser son propre article (pas de restriction — aucune regle BR ne l'interdit).
 */
import { test, expect } from '@playwright/test';
import { loginAsSeedUser, logout, createArticle, uniqueTitle } from './helpers/auth';

test.describe('WF-009 — Toggle Favori Article (Favorite/Unfavorite)', () => {
  test('[WF-009-PERM] Anonyme — bouton Favorite redirige vers /login (BR-051)', async ({
    page,
  }) => {
    // Creer un article et se deconnecter
    await loginAsSeedUser(page);
    const slug = await createArticle(page, uniqueTitle());
    await logout(page);

    // Sur la page d'accueil (article_list.html), le bouton Favorite est visible pour tous
    // y compris les anonymes (BR-051 : onclick redirige vers /login)
    await page.goto('/');
    const articlePreview = page.locator('.article-preview').filter({
      has: page.locator(`a[href="/article/${slug}"]`),
    });
    const favBtn = articlePreview.locator('button').filter({ hasText: /Favorite/ });
    await expect(favBtn).toBeVisible();

    await favBtn.click();
    // Redirection vers /login via onclick
    await expect(page).toHaveURL(/\/login/);
  });

  test('[WF-009-NOM-1] Favoriser un article → compteur +1, bouton "Unfavorite" (BR-036, BR-025)', async ({
    page,
  }) => {
    await loginAsSeedUser(page);
    const slug = await createArticle(page, uniqueTitle());

    // Sur la home feed (article_list.html), le bouton Favorite est visible meme pour l'auteur
    await page.goto('/');
    const articlePreviewNom1 = page.locator('.article-preview').filter({
      has: page.locator(`a[href="/article/${slug}"]`),
    });
    // Lire le compteur initial (0 favorites sur un nouvel article)
    const favBtn = articlePreviewNom1.locator('button').filter({ hasText: /Favorite/ }).first();
    await expect(favBtn).toBeVisible();
    const initialCountText = await favBtn.locator('.counter').textContent();
    const initialCount = parseInt((initialCountText ?? '(0)').replace(/\D/g, ''), 10);

    // Cliquer Favorite → HTMX POST + swap outerHTML
    const htmxResp = page.waitForResponse(
      res => res.url().includes(`/article/${slug}/favorite`) && res.status() === 200,
    );
    await favBtn.click();
    await htmxResp;

    // Le bouton a ete remplace par HTMX : chercher le nouveau bouton Unfavorite
    const unfavBtn = page.locator('button').filter({ hasText: /Unfavorite/ }).first();
    await expect(unfavBtn).toBeVisible();

    const newCountText = await unfavBtn.locator('.counter').textContent();
    const newCount = parseInt((newCountText ?? '(0)').replace(/\D/g, ''), 10);
    // Compteur incremente de 1 (BR-025 : re-annotation with_favorites)
    expect(newCount).toBe(initialCount + 1);
  });

  test('[WF-009-NOM-2] Defavoriser → compteur -1, bouton revient en "Favorite" (BR-036, BR-025)', async ({
    page,
  }) => {
    await loginAsSeedUser(page);
    const slug = await createArticle(page, uniqueTitle());

    // Sur la home feed (article_list.html), le bouton Favorite est visible meme pour l'auteur
    await page.goto('/');
    const articlePreviewNom2 = page.locator('.article-preview').filter({
      has: page.locator(`a[href="/article/${slug}"]`),
    });
    // Etape 1 : Ajouter le favori
    const favBtn = articlePreviewNom2.locator('button').filter({ hasText: /Favorite/ }).first();
    const addResp = page.waitForResponse(
      res => res.url().includes(`/article/${slug}/favorite`) && res.status() === 200,
    );
    await favBtn.click();
    await addResp;

    const unfavBtn = articlePreviewNom2.locator('button').filter({ hasText: /Unfavorite/ }).first();
    await expect(unfavBtn).toBeVisible();
    const countAfterFav = parseInt(
      ((await unfavBtn.locator('.counter').textContent()) ?? '(0)').replace(/\D/g, ''),
      10,
    );

    // Etape 2 : Retirer le favori
    const removeResp = page.waitForResponse(
      res => res.url().includes(`/article/${slug}/favorite`) && res.status() === 200,
    );
    await unfavBtn.click();
    await removeResp;

    const favBtnAgain = articlePreviewNom2.locator('button').filter({ hasText: /Favorite/ }).first();
    await expect(favBtnAgain).toBeVisible();
    const countAfterUnfav = parseInt(
      ((await favBtnAgain.locator('.counter').textContent()) ?? '(0)').replace(/\D/g, ''),
      10,
    );
    // Compteur decremente de 1 (BR-025)
    expect(countAfterUnfav).toBe(countAfterFav - 1);
  });
});
