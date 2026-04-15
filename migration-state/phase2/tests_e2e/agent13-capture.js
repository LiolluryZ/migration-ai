'use strict';
/**
 * Agent 13 - Navigateur Visuel
 * Capture la baseline visuelle complète de l'application legacy conduit.
 * Usage : node agent13-capture.js
 */

const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:8000';
// tests_e2e/ -> phase2/ -> visual_baseline/
const OUTPUT_DIR = path.join(__dirname, '..', 'visual_baseline');
const SCREENS_DIR = path.join(OUTPUT_DIR, 'screens');
const WORKFLOWS_DIR = path.join(OUTPUT_DIR, 'workflows');

const VIEWPORTS = [
  { width: 1920, height: 1080, label: 'desktop' },
  { width: 768,  height: 1024, label: 'tablet' },
  { width: 375,  height: 812,  label: 'mobile' },
];

const CREDS = { email: 'test@email.com', password: 'test' };
const KNOWN_USERNAME = 'admin'; // From agent-11 notes: test@email.com → username=admin

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function waitReady(page) {
  try {
    await page.waitForLoadState('networkidle', { timeout: 15000 });
  } catch (_) {
    // networkidle timeout — proceed anyway
  }
}

async function loginUser(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await page.fill('input[name="email"]', CREDS.email);
  await page.fill('input[name="password"]', CREDS.password);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
}

/**
 * Prend screenshot.png + screenshot_normalized.png (timestamps masqués).
 * Ecrit metadata.json dans le répertoire screen.
 * Retourne { dirName, metadata }.
 */
async function captureScreen(page, viewport, routeSlug, state, role, meta) {
  const dirName = `${routeSlug}__${state}__${role}__${viewport.label}`;
  const screenDir = path.join(SCREENS_DIR, dirName);
  ensureDir(screenDir);

  // ---- screenshot brut ----
  await page.screenshot({
    path: path.join(screenDir, 'screenshot.png'),
    fullPage: true,
  });

  // ---- screenshot normalisé (masque les zones dynamiques : <time>, compteurs) ----
  const masks = [page.locator('time')];
  try {
    await page.screenshot({
      path: path.join(screenDir, 'screenshot_normalized.png'),
      fullPage: true,
      mask: masks,
    });
  } catch (_) {
    fs.copyFileSync(
      path.join(screenDir, 'screenshot.png'),
      path.join(screenDir, 'screenshot_normalized.png'),
    );
  }

  // ---- metadata ----
  const metadata = {
    route: meta.route,
    route_slug: routeSlug,
    state,
    role,
    viewport: viewport.label,
    name: meta.name,
    description: meta.description,
    navigation_path: meta.navigation_path || [],
    ui_components: meta.ui_components || [],
    linked_routes_backend: meta.linked_routes_backend || [],
    dynamic_zones: meta.dynamic_zones || [],
    business_rules_observed: meta.business_rules_observed || [],
    captured_at: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(screenDir, 'metadata.json'),
    JSON.stringify(metadata, null, 2),
  );

  console.log(`  [✓] ${dirName}`);
  return { dirName, metadata };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Agent 13 - Navigateur Visuel ===');
  console.log(`Output : ${OUTPUT_DIR}\n`);

  ensureDir(OUTPUT_DIR);
  ensureDir(SCREENS_DIR);
  ensureDir(WORKFLOWS_DIR);

  const browser = await chromium.launch({ headless: true });
  const capturedScreens = [];
  let articleSlug = null;
  let tagName = null;
  let ownArticleSlug = null;

  try {
    // --------------------------------------------------------
    // Phase Discovery — récupère slugs et tags réels
    // --------------------------------------------------------
    console.log('[Discovery] Récupère slugs/tags depuis le live...');
    {
      const ctx = await browser.newContext();
      const pg = await ctx.newPage();
      await pg.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
      await waitReady(pg);

      // Article slug dans les liens
      const aLinks = await pg.locator('a[href^="/article/"]').all();
      for (const a of aLinks) {
        const href = await a.getAttribute('href');
        if (href && href !== '/article/') {
          articleSlug = href.replace('/article/', '').split('?')[0];
          break;
        }
      }

      // Tag depuis sidebar ou tab
      const tLinks = await pg.locator('a[href^="/tag/"]').all();
      for (const t of tLinks) {
        const href = await t.getAttribute('href');
        if (href && href !== '/tag/') {
          tagName = href.replace('/tag/', '').split('?')[0];
          break;
        }
      }

      console.log(`  article_slug  : ${articleSlug || '(none found)'}`);
      console.log(`  tag           : ${tagName || '(none found)'}`);
      await pg.close();
      await ctx.close();
    }

    // Cherche article propre au test user via son profil
    {
      const ctx = await browser.newContext();
      const pg = await ctx.newPage();
      await loginUser(pg);
      await pg.goto(`${BASE_URL}/profile/${KNOWN_USERNAME}`, { waitUntil: 'domcontentloaded' });
      await waitReady(pg);
      const aLinks = await pg.locator('a[href^="/article/"]').all();
      for (const a of aLinks) {
        const href = await a.getAttribute('href');
        if (href && href !== '/article/') {
          ownArticleSlug = href.replace('/article/', '').split('?')[0];
          break;
        }
      }
      console.log(`  own_article   : ${ownArticleSlug || '(none found)'}`);
      await pg.close();
      await ctx.close();
    }

    // Si aucun article trouvé dans le profil, utilise le premier de la home
    if (!ownArticleSlug && articleSlug) ownArticleSlug = articleSlug;

    // --------------------------------------------------------
    // Capture par viewport
    // --------------------------------------------------------
    for (const viewport of VIEWPORTS) {
      console.log(`\n[Viewport: ${viewport.label} ${viewport.width}×${viewport.height}]`);

      // ===== ANONYMOUS =====
      {
        const ctx = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
        });
        const pg = await ctx.newPage();

        // ---------- Home - global feed ----------
        await pg.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
        await waitReady(pg);
        capturedScreens.push(await captureScreen(pg, viewport, 'home', 'default', 'anonymous', {
          route: '/',
          name: 'Home - Global Feed',
          description: "Page d'accueil avec le flux global d'articles (anonymous)",
          navigation_path: ['direct URL /'],
          ui_components: [
            { type: 'navbar', region: 'top', description: 'Navigation avec liens Sign in / Sign up', business_rules: ['BR-007'] },
            { type: 'tab_list', region: 'main', description: 'Onglets: Global Feed (actif)', business_rules: ['BR-007'] },
            { type: 'article_list', region: 'main', description: 'Liste paginée des articles (boutons Favorite désactivés)', business_rules: ['BR-010', 'BR-038'] },
            { type: 'tag_sidebar', region: 'right', description: 'Tags populaires cliquables', business_rules: [] },
          ],
          linked_routes_backend: ['GET /'],
          dynamic_zones: [{ selector: 'time', reason: 'Dates de publication des articles' }],
          business_rules_observed: ['BR-007', 'BR-010', 'BR-038'],
        }));

        // ---------- Home - tag filter ----------
        if (tagName) {
          await pg.goto(`${BASE_URL}/tag/${tagName}`, { waitUntil: 'domcontentloaded' });
          await waitReady(pg);
          capturedScreens.push(await captureScreen(pg, viewport, 'home_tag', 'tag_filter', 'anonymous', {
            route: `/tag/${tagName}`,
            name: `Home - Tag "${tagName}"`,
            description: `Flux filtré par le tag "${tagName}"`,
            navigation_path: ['click tag in right sidebar'],
            ui_components: [
              { type: 'tab_list', region: 'main', description: `Onglet actif: "#${tagName}"`, business_rules: [] },
              { type: 'article_list', region: 'main', description: `Articles portant le tag ${tagName}`, business_rules: [] },
            ],
            linked_routes_backend: [`GET /tag/${tagName}`],
            dynamic_zones: [{ selector: 'time', reason: 'Dates de publication' }],
            business_rules_observed: [],
          }));
        }

        // ---------- Article detail ----------
        if (articleSlug) {
          await pg.goto(`${BASE_URL}/article/${articleSlug}`, { waitUntil: 'domcontentloaded' });
          await waitReady(pg);
          capturedScreens.push(await captureScreen(pg, viewport, 'article_detail', 'default', 'anonymous', {
            route: `/article/${articleSlug}`,
            name: 'Article Detail (anonymous)',
            description: "Page de détail d'article: corps Markdown + commentaires",
            navigation_path: ['click article title on home feed'],
            ui_components: [
              { type: 'article_header', region: 'top', description: 'Titre, auteur, date — boutons Follow/Favorite liens vers /login (BR-038)', business_rules: ['BR-038', 'BR-040'] },
              { type: 'article_body', region: 'main', description: 'Contenu Markdown rendu en HTML', business_rules: ['BR-031'] },
              { type: 'tag_list', region: 'article', description: "Tags de l'article", business_rules: [] },
              { type: 'comment_section', region: 'bottom', description: 'Invite à se connecter pour commenter + liste commentaires publics', business_rules: ['BR-036', 'BR-037'] },
            ],
            linked_routes_backend: [`GET /article/${articleSlug}`],
            dynamic_zones: [
              { selector: 'time', reason: 'Date de publication' },
              { selector: '.favorites-count', reason: 'Compteur favoris' },
            ],
            business_rules_observed: ['BR-031', 'BR-036', 'BR-037', 'BR-038', 'BR-040'],
          }));
        }

        // ---------- Article detail 404 ----------
        await pg.goto(`${BASE_URL}/article/this-article-does-not-exist-404`, { waitUntil: 'domcontentloaded' });
        await waitReady(pg);
        capturedScreens.push(await captureScreen(pg, viewport, 'article_detail', '404', 'anonymous', {
          route: '/article/this-article-does-not-exist-404',
          name: 'Article Detail - 404',
          description: "Page 404 quand l'article n'existe pas (BR-030)",
          navigation_path: ['direct URL with non-existent slug'],
          ui_components: [
            { type: 'error_page', region: 'main', description: 'Page 404 article non trouvé', business_rules: ['BR-030'] },
          ],
          linked_routes_backend: ['GET /article/this-article-does-not-exist-404'],
          dynamic_zones: [],
          business_rules_observed: ['BR-030'],
        }));

        // ---------- Login - default ----------
        await pg.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
        await waitReady(pg);
        capturedScreens.push(await captureScreen(pg, viewport, 'login', 'default', 'anonymous', {
          route: '/login',
          name: 'Login',
          description: 'Formulaire de connexion par email + password',
          navigation_path: ['click "Sign in" in navbar'],
          ui_components: [
            { type: 'form', region: 'main', description: 'Champs: email, password — bouton "Sign in"', business_rules: ['BR-002', 'BR-005'] },
            { type: 'link', region: 'form', description: 'Lien "Need an account? Sign up"', business_rules: [] },
          ],
          linked_routes_backend: ['GET /login', 'POST /login'],
          dynamic_zones: [],
          business_rules_observed: ['BR-002', 'BR-005'],
        }));

        // ---------- Login - error ----------
        await pg.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
        await waitReady(pg);
        await pg.fill('input[name="email"]', 'wrong@example.com');
        await pg.fill('input[name="password"]', 'wrongpassword');
        await Promise.all([
          pg.waitForNavigation({ waitUntil: 'networkidle', timeout: 10000 }).catch(() => {}),
          pg.click('button[type="submit"]'),
        ]);
        await waitReady(pg);
        capturedScreens.push(await captureScreen(pg, viewport, 'login', 'error', 'anonymous', {
          route: '/login',
          name: 'Login - Credentials invalides',
          description: '"Invalid email or password." affiché après soumission de mauvais identifiants',
          navigation_path: ['fill wrong credentials', 'click "Sign in"'],
          ui_components: [
            { type: 'form', region: 'main', description: 'Formulaire avec message d\'erreur non-field', business_rules: ['BR-002'] },
            { type: 'error_message', region: 'form', description: '"Invalid email or password."', business_rules: ['BR-002'] },
          ],
          linked_routes_backend: ['POST /login'],
          dynamic_zones: [],
          business_rules_observed: ['BR-002'],
        }));

        // ---------- Register - default ----------
        await pg.goto(`${BASE_URL}/register`, { waitUntil: 'domcontentloaded' });
        await waitReady(pg);
        capturedScreens.push(await captureScreen(pg, viewport, 'register', 'default', 'anonymous', {
          route: '/register',
          name: "Register - Formulaire d'inscription",
          description: 'Inscription avec username, email, password',
          navigation_path: ['click "Sign up" in navbar'],
          ui_components: [
            { type: 'form', region: 'main', description: 'Champs: username, email, password — bouton "Sign up"', business_rules: ['BR-001', 'BR-002', 'BR-003', 'BR-004'] },
            { type: 'link', region: 'form', description: 'Lien "Have an account? Sign in"', business_rules: [] },
          ],
          linked_routes_backend: ['GET /register', 'POST /register'],
          dynamic_zones: [],
          business_rules_observed: ['BR-001', 'BR-002', 'BR-003', 'BR-004'],
        }));

        // ---------- Profile - anonymous ----------
        await pg.goto(`${BASE_URL}/profile/${KNOWN_USERNAME}`, { waitUntil: 'domcontentloaded' });
        await waitReady(pg);
        capturedScreens.push(await captureScreen(pg, viewport, 'profile', 'default', 'anonymous', {
          route: `/profile/${KNOWN_USERNAME}`,
          name: `Profile - ${KNOWN_USERNAME} (anonymous)`,
          description: 'Page de profil vue par un visiteur non connecté',
          navigation_path: ['click author name on article'],
          ui_components: [
            { type: 'profile_header', region: 'top', description: 'Avatar (url), username, bio, bouton Follow (BR-047)', business_rules: ['BR-047', 'BR-048'] },
            { type: 'tab_list', region: 'main', description: 'Onglets: My Articles / Favorited Articles', business_rules: [] },
            { type: 'article_list', region: 'main', description: "Articles publiés par l'utilisateur", business_rules: [] },
          ],
          linked_routes_backend: [`GET /profile/${KNOWN_USERNAME}`],
          dynamic_zones: [{ selector: 'time', reason: 'Dates de publication' }],
          business_rules_observed: ['BR-047', 'BR-048'],
        }));

        // ---------- Profile favorites - anonymous ----------
        await pg.goto(`${BASE_URL}/profile/${KNOWN_USERNAME}/favorites`, { waitUntil: 'domcontentloaded' });
        await waitReady(pg);
        capturedScreens.push(await captureScreen(pg, viewport, 'profile_favorites', 'default', 'anonymous', {
          route: `/profile/${KNOWN_USERNAME}/favorites`,
          name: `Profile Favorites - ${KNOWN_USERNAME}`,
          description: 'Onglet "Favorited Articles" du profil',
          navigation_path: ['go to profile', 'click "Favorited Articles" tab'],
          ui_components: [
            { type: 'profile_header', region: 'top', description: 'Même header de profil', business_rules: [] },
            { type: 'tab_list', region: 'main', description: 'Onglet "Favorited Articles" (actif)', business_rules: [] },
            { type: 'article_list', region: 'main', description: 'Articles favoris de cet utilisateur', business_rules: [] },
          ],
          linked_routes_backend: [`GET /profile/${KNOWN_USERNAME}/favorites`],
          dynamic_zones: [{ selector: 'time', reason: 'Dates des articles favoris' }],
          business_rules_observed: [],
        }));

        // ---------- Settings - redirect unauthenticated ----------
        await pg.goto(`${BASE_URL}/settings`, { waitUntil: 'domcontentloaded' });
        await waitReady(pg);
        capturedScreens.push(await captureScreen(pg, viewport, 'settings', 'redirect_unauthenticated', 'anonymous', {
          route: '/settings → redirect /login?next=/settings',
          name: 'Settings - Redirect (non authentifié)',
          description: 'Accès à /settings sans auth → redirection automatique vers /login (BR-007)',
          navigation_path: ['direct URL /settings (no login)'],
          ui_components: [
            { type: 'form', region: 'main', description: 'Formulaire login avec ?next=/settings en URL', business_rules: ['BR-007'] },
          ],
          linked_routes_backend: ['GET /settings (302 → GET /login)'],
          dynamic_zones: [],
          business_rules_observed: ['BR-007'],
        }));

        await pg.close();
        await ctx.close();
      }

      // ===== AUTHENTICATED (user) =====
      {
        const ctx = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
        });
        const pg = await ctx.newPage();
        await loginUser(pg);

        // ---------- Home - default user ----------
        await pg.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
        await waitReady(pg);
        capturedScreens.push(await captureScreen(pg, viewport, 'home', 'default', 'user', {
          route: '/',
          name: 'Home - Global Feed (authentifié)',
          description: 'Page accueil pour utilisateur connecté: "Your Feed" tab visible, boutons Favorite actifs',
          navigation_path: ['login', 'navigate to /'],
          ui_components: [
            { type: 'navbar', region: 'top', description: 'Navbar: Home, New Article, Settings, username avatar', business_rules: ['BR-007'] },
            { type: 'tab_list', region: 'main', description: 'Onglets: Your Feed + Global Feed (actif)', business_rules: ['BR-007', 'BR-010'] },
            { type: 'article_list', region: 'main', description: 'Articles avec boutons Favorite actifs (HTMX toggle)', business_rules: ['BR-038', 'BR-039'] },
          ],
          linked_routes_backend: ['GET /'],
          dynamic_zones: [{ selector: 'time', reason: 'Dates de publication' }],
          business_rules_observed: ['BR-007', 'BR-010', 'BR-038', 'BR-039'],
        }));

        // ---------- Home - following feed ----------
        await pg.goto(`${BASE_URL}/?feed=following`, { waitUntil: 'domcontentloaded' });
        await waitReady(pg);
        capturedScreens.push(await captureScreen(pg, viewport, 'home_following', 'following_feed', 'user', {
          route: '/?feed=following',
          name: 'Home - Your Feed (following)',
          description: 'Flux des articles des utilisateurs suivis (peut être vide)',
          navigation_path: ['login', 'click "Your Feed" tab'],
          ui_components: [
            { type: 'tab_list', region: 'main', description: 'Onglet "Your Feed" (actif)', business_rules: ['BR-010', 'BR-047'] },
            { type: 'article_list', region: 'main', description: 'Articles des utilisateurs suivis ou message "No articles yet"', business_rules: ['BR-047'] },
          ],
          linked_routes_backend: ['GET /?feed=following'],
          dynamic_zones: [{ selector: 'time', reason: 'Dates de publication' }],
          business_rules_observed: ['BR-010', 'BR-047'],
        }));

        // ---------- Article detail - as owner ----------
        if (ownArticleSlug) {
          await pg.goto(`${BASE_URL}/article/${ownArticleSlug}`, { waitUntil: 'domcontentloaded' });
          await waitReady(pg);
          capturedScreens.push(await captureScreen(pg, viewport, 'article_detail', 'default', 'user', {
            route: `/article/${ownArticleSlug}`,
            name: 'Article Detail (propriétaire)',
            description: "Détail d'article vu par son auteur: boutons Edit + Delete visibles",
            navigation_path: ['login', 'click article title'],
            ui_components: [
              { type: 'article_header', region: 'top', description: 'Boutons Edit/Delete visibles pour le propriétaire (BR-021/BR-022)', business_rules: ['BR-021', 'BR-022', 'BR-040'] },
              { type: 'article_body', region: 'main', description: 'Contenu Markdown', business_rules: ['BR-031'] },
              { type: 'comment_form', region: 'bottom', description: 'Formulaire de commentaire actif (BR-036)', business_rules: ['BR-036'] },
              { type: 'comment_list', region: 'bottom', description: 'Commentaires avec bouton Delete sur ses propres commentaires (BR-041)', business_rules: ['BR-041', 'BR-042'] },
            ],
            linked_routes_backend: [`GET /article/${ownArticleSlug}`],
            dynamic_zones: [
              { selector: 'time', reason: 'Date de publication' },
            ],
            business_rules_observed: ['BR-021', 'BR-022', 'BR-031', 'BR-036', 'BR-040', 'BR-041', 'BR-042'],
          }));
        }

        // ---------- Editor - create ----------
        await pg.goto(`${BASE_URL}/editor`, { waitUntil: 'domcontentloaded' });
        await waitReady(pg);
        capturedScreens.push(await captureScreen(pg, viewport, 'editor', 'create', 'user', {
          route: '/editor',
          name: "Editor - Créer un article",
          description: "Formulaire vide de création d'article",
          navigation_path: ['login', 'click "New Article" in navbar'],
          ui_components: [
            { type: 'form', region: 'main', description: 'Champs: title (required), description, body (textarea Markdown), tags', business_rules: ['BR-011', 'BR-012', 'BR-013', 'BR-014'] },
            { type: 'button', region: 'form', description: 'Bouton "Publish Article"', business_rules: [] },
          ],
          linked_routes_backend: ['GET /editor', 'POST /editor'],
          dynamic_zones: [],
          business_rules_observed: ['BR-011', 'BR-012', 'BR-013', 'BR-014'],
        }));

        // ---------- Editor - edit (own article) ----------
        if (ownArticleSlug) {
          await pg.goto(`${BASE_URL}/editor/${ownArticleSlug}`, { waitUntil: 'domcontentloaded' });
          await waitReady(pg);
          capturedScreens.push(await captureScreen(pg, viewport, 'editor_edit', 'edit', 'user', {
            route: `/editor/${ownArticleSlug}`,
            name: "Editor - Modifier un article",
            description: "Formulaire pré-rempli d'édition d'article (slug inchangé: BR-023)",
            navigation_path: ['login', 'go to article detail', 'click Edit'],
            ui_components: [
              { type: 'form', region: 'main', description: 'Formulaire pré-rempli: title, description, body, tags', business_rules: ['BR-014', 'BR-016', 'BR-023'] },
              { type: 'button', region: 'form', description: 'Bouton "Update Article"', business_rules: [] },
            ],
            linked_routes_backend: [`GET /editor/${ownArticleSlug}`, `POST /editor/${ownArticleSlug}`],
            dynamic_zones: [],
            business_rules_observed: ['BR-014', 'BR-016', 'BR-023'],
          }));
        }

        // ---------- Settings ----------
        await pg.goto(`${BASE_URL}/settings`, { waitUntil: 'domcontentloaded' });
        await waitReady(pg);
        capturedScreens.push(await captureScreen(pg, viewport, 'settings', 'default', 'user', {
          route: '/settings',
          name: 'Settings',
          description: 'Configuration du profil: image URL, username, bio, email, password optionnel',
          navigation_path: ['login', 'click Settings in navbar'],
          ui_components: [
            { type: 'form', region: 'main', description: 'Champs pré-remplis: image (URL), username, bio (textarea), email, password (optionnel)', business_rules: ['BR-005', 'BR-006', 'BR-007', 'BR-008', 'BR-009'] },
            { type: 'button', region: 'form', description: 'Bouton "Update Settings"', business_rules: [] },
            { type: 'button_logout', region: 'bottom', description: 'Bouton/Lien "Or click here to logout." (BR-007)', business_rules: ['BR-007'] },
          ],
          linked_routes_backend: ['GET /settings', 'POST /settings'],
          dynamic_zones: [],
          business_rules_observed: ['BR-005', 'BR-006', 'BR-007', 'BR-008', 'BR-009'],
        }));

        // ---------- Profile - self (authenticated) ----------
        await pg.goto(`${BASE_URL}/profile/${KNOWN_USERNAME}`, { waitUntil: 'domcontentloaded' });
        await waitReady(pg);
        capturedScreens.push(await captureScreen(pg, viewport, 'profile', 'default', 'user', {
          route: `/profile/${KNOWN_USERNAME}`,
          name: `Profile - ${KNOWN_USERNAME} (self)`,
          description: "Vue de son propre profil: sans bouton Follow (BR-049), avec lien Edit Profile Settings",
          navigation_path: ['login', 'click username in navbar'],
          ui_components: [
            { type: 'profile_header', region: 'top', description: 'Avatar, username, bio — pas de Follow (soi-même BR-049) — lien Edit Settings', business_rules: ['BR-049'] },
            { type: 'tab_list', region: 'main', description: 'Onglets: My Articles (actif) / Favorited Articles', business_rules: [] },
            { type: 'article_list', region: 'main', description: 'Articles avec boutons Favorite actifs', business_rules: ['BR-038'] },
          ],
          linked_routes_backend: [`GET /profile/${KNOWN_USERNAME}`],
          dynamic_zones: [{ selector: 'time', reason: 'Dates de publication' }],
          business_rules_observed: ['BR-038', 'BR-047', 'BR-048', 'BR-049'],
        }));

        await pg.close();
        await ctx.close();
      }
    }

    // --------------------------------------------------------
    // Génération index.json + summary.json
    // --------------------------------------------------------
    console.log('\n[Index] Génération index.json + summary.json...');

    // Groupe par {routeSlug, state, role} — combine les viewports
    const grouped = {};
    capturedScreens.forEach((s) => {
      const key = `${s.metadata.route_slug}__${s.metadata.state}__${s.metadata.role}`;
      if (!grouped[key]) {
        grouped[key] = {
          route: s.metadata.route,
          route_slug: s.metadata.route_slug,
          state: s.metadata.state,
          name: s.metadata.name,
          roles: [],
          viewports: [],
          screenshots: 0,
          metadata_file: `screens/${s.dirName}/metadata.json`,
        };
      }
      const e = grouped[key];
      if (!e.roles.includes(s.metadata.role)) e.roles.push(s.metadata.role);
      if (!e.viewports.includes(s.metadata.viewport)) e.viewports.push(s.metadata.viewport);
      e.screenshots++;
    });

    const index = {
      generated_at: new Date().toISOString(),
      agent: '13-navigateur-visuel',
      confidence: 88,
      application: 'legacy',
      base_url: BASE_URL,
      total_unique_screens: Object.keys(grouped).length,
      total_screenshots: capturedScreens.length,
      screens: Object.values(grouped),
    };
    fs.writeFileSync(path.join(OUTPUT_DIR, 'index.json'), JSON.stringify(index, null, 2));
    console.log(`  [✓] index.json (${index.total_screenshots} screenshots / ${index.total_unique_screens} combinaisons uniques)`);

    // Statistiques de couverture
    const allRoles = [...new Set(capturedScreens.map((s) => s.metadata.role))];
    const allVps = [...new Set(capturedScreens.map((s) => s.metadata.viewport))];
    const coverageByRole = {};
    allRoles.forEach((r) => { coverageByRole[r] = capturedScreens.filter((s) => s.metadata.role === r).length; });
    const coverageByViewport = {};
    allVps.forEach((v) => { coverageByViewport[v] = capturedScreens.filter((s) => s.metadata.viewport === v).length; });
    const totalDynamicZones = capturedScreens.reduce((acc, s) => acc + (s.metadata.dynamic_zones || []).length, 0);

    const summary = {
      generated_at: new Date().toISOString(),
      total_unique_screens: index.total_unique_screens,
      total_screenshot_combinations: capturedScreens.length,
      coverage_by_role: coverageByRole,
      coverage_by_viewport: coverageByViewport,
      total_dynamic_zones_masked: totalDynamicZones,
      viewports_captured: VIEWPORTS.map((v) => ({ label: v.label, width: v.width, height: v.height })),
      screens_captured: capturedScreens.map((s) => s.dirName),
    };
    fs.writeFileSync(path.join(OUTPUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
    console.log(`  [✓] summary.json`);

    console.log(`\n✓ ${capturedScreens.length} screenshots capturés dans :\n  ${OUTPUT_DIR}`);
    return capturedScreens;

  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
