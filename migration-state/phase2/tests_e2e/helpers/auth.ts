import { Page } from '@playwright/test';

/** URL de base du serveur legacy. Surchargeable via BASE_URL. */
export const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8000';

/** Utilisateur pre-seede dans la base de test. */
export const SEED_USER = {
  email: 'test@email.com',
  password: 'test',
};

// ---------------------------------------------------------------------------
// Authentification
// ---------------------------------------------------------------------------

/**
 * Connexion via le formulaire /login.
 * Attend la redirection vers / avant de rendre la main.
 */
export async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('/');
}

/** Connexion avec l'utilisateur seede (test@email.com / test). */
export async function loginAsSeedUser(page: Page): Promise<void> {
  await loginAs(page, SEED_USER.email, SEED_USER.password);
}

/**
 * Inscription d'un nouvel utilisateur via /register.
 * Attend la redirection vers / (connexion automatique apres inscription).
 */
export async function registerUser(
  page: Page,
  username: string,
  email: string,
  password: string,
): Promise<void> {
  await page.goto('/register');
  await page.getByPlaceholder('Username').fill(username);
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Password').fill(password);
  await page.getByRole('button', { name: 'Sign up' }).click();
  await page.waitForURL('/');
}

/**
 * Deconnexion via le bouton logout de la page /settings.
 * Attend la redirection vers / avant de rendre la main.
 */
export async function logout(page: Page): Promise<void> {
  await page.goto('/settings');
  await page.getByRole('button', { name: /logout/i }).click();
  await page.waitForURL('/');
}

// ---------------------------------------------------------------------------
// Extraction d'informations depuis la page
// ---------------------------------------------------------------------------

/**
 * Retourne le username de l'utilisateur actuellement connecte
 * en lisant le lien de profil dans la barre de navigation.
 */
export async function getLoggedInUsername(page: Page): Promise<string> {
  const href = await page.locator('nav a[href^="/profile/"]').first().getAttribute('href');
  const username = (href ?? '').replace('/profile/', '').replace(/\/$/, '');
  if (!username) throw new Error('Impossible de determiner le username depuis la nav — utilisateur non connecte ?');
  return username;
}

// ---------------------------------------------------------------------------
// Creation de donnees de test
// ---------------------------------------------------------------------------

/**
 * Cree un article (utilisateur doit etre connecte).
 * Retourne le slug extrait de l'URL apres redirection.
 */
export async function createArticle(
  page: Page,
  title: string,
  body = 'Contenu de test E2E.',
): Promise<string> {
  await page.goto('/editor');
  await page.getByPlaceholder('Article Title').fill(title);
  await page.getByPlaceholder('Write your article (in markdown)').fill(body);
  await page.getByRole('button', { name: 'Publish Article' }).click();
  await page.waitForURL(/\/article\//);
  return page.url().split('/article/')[1].replace(/\/$/, '');
}

/**
 * Ajoute un commentaire sur un article (utilisateur doit etre connecte).
 * Attend la reponse HTMX avant de rendre la main.
 */
export async function addComment(page: Page, slug: string, body: string): Promise<void> {
  await page.goto(`/article/${slug}`);
  await page.getByPlaceholder('Write a comment...').fill(body);
  const respPromise = page.waitForResponse(
    res => res.url().includes('/comment') && res.status() === 200,
  );
  await page.getByRole('button', { name: 'Post Comment' }).click();
  await respPromise;
}

// ---------------------------------------------------------------------------
// Generateurs de donnees uniques
// ---------------------------------------------------------------------------

/** Genere un email unique pour les tests d'inscription. */
export function uniqueEmail(): string {
  return `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@test.local`;
}

/** Genere un username unique (max 28 caracteres). */
export function uniqueUsername(): string {
  return `e2e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`.slice(0, 28);
}

/** Genere un titre d'article unique. */
export function uniqueTitle(): string {
  return `E2E Article ${Date.now()} ${Math.random().toString(36).slice(2, 5)}`;
}
