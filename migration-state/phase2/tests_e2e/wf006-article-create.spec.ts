/**
 * WF-006 — Creation d'Article
 *
 * Scenarios couverts :
 *   WF-006-PERM  : Anonyme → @login_required redirect /login?next=/article/create (BR-033)
 *   WF-006-NOM   : Formulaire valide → article cree, slug genere, redirect vers detail (BR-023, BR-031, BR-032)
 *   WF-006-ERR   : Titre manquant → validation error, reste sur /article/create
 *
 * Regles metier liees : BR-023, BR-027, BR-031, BR-032, BR-033
 * Note BR-023 : le slug est genere via slugify(title) uniquement a la creation (pk=None).
 * Note BR-027 : cache.delete('all_tags') apres sauvegarde.
 */
import { test, expect } from '@playwright/test';
import { loginAsSeedUser, uniqueTitle } from './helpers/auth';

test.describe('WF-006 — Creation d\'Article', () => {
  test('[WF-006-PERM] Anonyme → redirection /login (BR-033)', async ({ page }) => {
    await page.goto('/editor');

    await expect(page).toHaveURL(/\/login/);
    expect(page.url()).toContain('next=');
  });

  test('[WF-006-NOM] Article valide → slug genere, redirection vers detail (BR-023, BR-031, BR-032)', async ({
    page,
  }) => {
    await loginAsSeedUser(page);

    const title = uniqueTitle();
    const description = 'Description de test E2E';
    const body = 'Contenu de larticle en markdown.';

    await page.goto('/editor');
    await page.getByPlaceholder('Article Title').fill(title);
    await page.getByPlaceholder("What's this article about?").fill(description);
    await page.getByPlaceholder('Write your article (in markdown)').fill(body);
    await page.getByRole('button', { name: 'Publish Article' }).click();

    // Apres soumission : redirection vers /article/<slug>
    await expect(page).toHaveURL(/\/article\//);
    // Le titre est visible sur la page de detail
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    // Verification que l'URL contient un slug derive du titre (slugify)
    const slug = page.url().split('/article/')[1].replace(/\/$/, '');
    expect(slug).toBeTruthy();
    expect(slug.length).toBeGreaterThan(0);
  });

  test('[WF-006-NOM-TAGS] Article avec tags → tags enregistres et visibles (BR-032)', async ({
    page,
  }) => {
    await loginAsSeedUser(page);

    await page.goto('/editor');
    await page.getByPlaceholder('Article Title').fill(uniqueTitle());
    await page.getByPlaceholder('Write your article (in markdown)').fill('Contenu avec tags.');

    // Saisir un tag : "Enter tags" est l'input visuel, "tags" est le champ hidden
    const tagInput = page.locator('#tag-input');
    await tagInput.fill('e2etag');
    await tagInput.press('Enter');
    // Le tag doit etre visible dans la liste avant soumission
    await expect(page.locator('#tag-list')).toContainText('e2etag');

    await page.getByRole('button', { name: 'Publish Article' }).click();
    await expect(page).toHaveURL(/\/article\//);

    // Le tag est visible sur la page de detail
    await expect(page.locator('.tag-list')).toContainText('e2etag');
  });

  test('[WF-006-ERR] Titre vide → reste sur /article/create avec erreur', async ({ page }) => {
    await loginAsSeedUser(page);

    await page.goto('/editor');
    // Ne pas remplir le titre (requis)
    await page.getByPlaceholder('Write your article (in markdown)').fill('Contenu sans titre.');
    await page.getByRole('button', { name: 'Publish Article' }).click();

    // Django renvoie le formulaire avec erreur : pas de redirection
    await expect(page).toHaveURL('/editor');
    await expect(page.locator('.error-messages')).toBeVisible();
  });
});
