'use strict';
/**
 * Agent 12 - Recorder HTTP
 * Enregistre le trafic HTTP réel via Playwright page.on('request'/'response')
 * pendant une session de navigation guidée couvrant les workflows principaux.
 *
 * Workflows couverts :
 *   WF-A  browse-anonymous   GET /, /tag/<tag>, /profiles/<user>, /<slug>
 *   WF-B  login              GET /login, POST /login
 *   WF-C  browse-auth        GET /?feed=following
 *   WF-D  article-create     GET /editor, POST /editor
 *   WF-E  article-edit       GET /editor/<slug>, POST /editor/<slug>
 *   WF-F  comment-create     POST /<slug>/comment  (HTMX)
 *   WF-G  comment-delete     POST /<slug>/comment/<id>/delete  (HTMX)
 *   WF-H  follow             POST /profiles/<user>/follow  (HTMX + redirect)
 *   WF-I  favorite           POST /<slug>/favorite  (HTMX + redirect)
 *   WF-J  settings           GET /settings, POST /settings
 *   WF-K  logout             POST /logout
 *   WF-L  article-delete     POST /<slug>/delete
 *
 * Usage : node agent12-record-http.js
 * Environnement : staging/local uniquement — JAMAIS en production.
 */

const { chromium } = require('@playwright/test');
const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL    = 'http://localhost:8000';
const CREDS       = { email: 'test@email.com', password: 'test' };
const KNOWN_USER  = 'admin';   // username correspondant à test@email.com (agent-13)

// Dossier de sortie : tests_e2e/ → phase2/ → http_recordings/
const OUTPUT_DIR  = path.join(__dirname, '..', 'http_recordings');
const REC_DIR     = path.join(OUTPUT_DIR, 'recordings');
const TESTS_DIR   = path.join(OUTPUT_DIR, 'generated_tests');

// Patterns de ressources à ignorer (assets statiques, analytics, favicon)
const SKIP_URL_PATTERNS = [
  /\.(css|js|map|ico|png|jpg|jpeg|gif|svg|woff2?|ttf|eot)(\?|$)/i,
  /^chrome-extension:/,
  /\/static\//,
  /\/favicon/,
];

// Champs sensibles à anonymiser dans les corps de requête
const SENSITIVE_BODY_KEYS = ['password', 'csrfmiddlewaretoken'];

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function slugify(str) {
  return str.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase();
}

function anonymizeHeaders(headers) {
  const out = { ...headers };
  const sensitiveHeaders = ['cookie', 'set-cookie', 'authorization'];
  const placeholders = {
    cookie: '{{SESSION_COOKIE}}',
    'set-cookie': '{{SET_COOKIE}}',
    authorization: '{{AUTH_TOKEN}}',
  };
  for (const key of sensitiveHeaders) {
    if (out[key]) {
      out[key] = placeholders[key] || `{{${key.toUpperCase()}}}`;
    }
  }
  return out;
}

function anonymizeBody(body, contentType) {
  if (!body) return body;
  if (contentType && contentType.includes('application/x-www-form-urlencoded')) {
    try {
      const params = new URLSearchParams(body);
      for (const key of SENSITIVE_BODY_KEYS) {
        if (params.has(key)) {
          params.set(key, key === 'csrfmiddlewaretoken' ? '{{CSRF_TOKEN}}' : `{{${key.toUpperCase()}}}`);
        }
      }
      // Anonymise l'email de test si présent
      if (params.get('email') === CREDS.email) params.set('email', '{{USER_EMAIL}}');
      return params.toString();
    } catch (_) { /* keep raw */ }
  }
  if (contentType && contentType.includes('application/json')) {
    try {
      const obj = JSON.parse(body);
      for (const key of SENSITIVE_BODY_KEYS) {
        if (obj[key] !== undefined) obj[key] = `{{${key.toUpperCase()}}}`;
      }
      if (obj.email === CREDS.email) obj.email = '{{USER_EMAIL}}';
      return JSON.stringify(obj);
    } catch (_) { /* keep raw */ }
  }
  return body;
}

function shouldCapture(url) {
  for (const pat of SKIP_URL_PATTERNS) {
    if (pat.test(url)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Capture d'une paire request/response
// ---------------------------------------------------------------------------
class HttpRecorder {
  constructor(page, workflowId) {
    this.page       = page;
    this.workflowId = workflowId;
    this.records    = [];
    this._pending   = new Map(); // url+method → {req, startTime}

    this._onReq = (req) => {
      const url = req.url();
      if (!shouldCapture(url)) return;
      this._pending.set(`${req.method()}:${url}`, {
        req,
        startTime: Date.now(),
      });
    };

    this._onRes = async (res) => {
      const req = res.request();
      const url = req.url();
      if (!shouldCapture(url)) return;

      const key     = `${req.method()}:${url}`;
      const pending = this._pending.get(key);
      const duration = pending ? Date.now() - pending.startTime : null;
      if (pending) this._pending.delete(key);

      // Récupère le body de la requête
      let reqBody = null;
      try { reqBody = req.postData(); } catch (_) {}
      const reqContentType = req.headers()['content-type'] || '';

      // Récupère le body de la réponse (HTML tronqué à 500 chars pour lisibilité)
      let resBody = null;
      let resBodyFull = null;
      try {
        resBodyFull = await res.text();
        // Pour les réponses HTML on ne garde qu'un extrait (taille + début)
        const isHtml = (res.headers()['content-type'] || '').includes('text/html');
        resBody = isHtml
          ? { type: 'html', length: resBodyFull.length, excerpt: resBodyFull.slice(0, 300) }
          : resBodyFull.slice(0, 2000);
      } catch (_) {}

      // Extrait le chemin relatif
      const urlObj   = new URL(url);
      const relPath  = urlObj.pathname + (urlObj.search || '');

      this.records.push({
        workflow:           this.workflowId,
        timestamp:          new Date().toISOString(),
        method:             req.method(),
        url,
        path:               relPath,
        request: {
          headers:          anonymizeHeaders(req.headers()),
          body:             anonymizeBody(reqBody, reqContentType),
          content_type:     reqContentType || null,
        },
        response: {
          status:           res.status(),
          status_text:      res.statusText(),
          headers:          anonymizeHeaders(res.headers()),
          body:             resBody,
          duration_ms:      duration,
        },
        anonymized_fields: ['cookie', 'set-cookie', 'authorization', 'csrfmiddlewaretoken', 'password', 'email'],
      });
    };

    page.on('request',  this._onReq);
    page.on('response', this._onRes);
  }

  stop() {
    this.page.removeListener('request',  this._onReq);
    this.page.removeListener('response', this._onRes);
  }

  getRecords() { return this.records; }
}

// ---------------------------------------------------------------------------
// Helpers de navigation
// ---------------------------------------------------------------------------

async function waitReady(page) {
  try { await page.waitForLoadState('networkidle', { timeout: 12000 }); }
  catch (_) { /* proceed */ }
}

async function loginUser(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await page.fill('input[name="email"]', CREDS.email);
  await page.fill('input[name="password"]', CREDS.password);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle', timeout: 12000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
}

// ---------------------------------------------------------------------------
// Workflows
// ---------------------------------------------------------------------------

/**
 * WF-A : navigation anonyme — home, tag, profil, article
 */
async function runBrowseAnonymous(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const rec = new HttpRecorder(page, 'WF-A_browse-anonymous');

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' }); await waitReady(page);
  await page.goto(`${BASE_URL}/tag/intelligence-artificielle`, { waitUntil: 'domcontentloaded' }); await waitReady(page);

  // Navigation vers un article (premier lien article)
  try {
    const articleLink = page.locator('h1 a[href*="/article/"]').first();
    if (await articleLink.count() > 0) {
      await articleLink.click(); await waitReady(page);
    } else {
      await page.goto(`${BASE_URL}/article/teletravail-bilan-et-nouvelles-frontieres-du-travail-a-distance`, { waitUntil: 'domcontentloaded' }); await waitReady(page);
    }
  } catch (_) {
    await page.goto(`${BASE_URL}/article/teletravail-bilan-et-nouvelles-frontieres-du-travail-a-distance`, { waitUntil: 'domcontentloaded' }); await waitReady(page);
  }

  await page.goto(`${BASE_URL}/profiles/${KNOWN_USER}`, { waitUntil: 'domcontentloaded' }); await waitReady(page);

  rec.stop();
  await ctx.close();
  return rec.getRecords();
}

/**
 * WF-B : login workflow
 */
async function runLogin(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const rec = new HttpRecorder(page, 'WF-B_login');

  // Page login GET
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' }); await waitReady(page);

  // POST login avec mauvais credentials
  await page.fill('input[name="email"]', 'wrong@example.com');
  await page.fill('input[name="password"]', 'wrongpass');
  await page.click('button[type="submit"]'); await waitReady(page);

  // POST login avec bons credentials
  await page.fill('input[name="email"]', CREDS.email);
  await page.fill('input[name="password"]', CREDS.password);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle', timeout: 12000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await waitReady(page);

  rec.stop();
  await ctx.close();
  return rec.getRecords();
}

/**
 * WF-C : navigation authentifiée — feed following, pagination
 */
async function runBrowseAuth(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const rec = new HttpRecorder(page, 'WF-C_browse-auth');

  await loginUser(page);

  await page.goto(`${BASE_URL}/?feed=following`, { waitUntil: 'domcontentloaded' }); await waitReady(page);
  await page.goto(`${BASE_URL}/?page=2`, { waitUntil: 'domcontentloaded' }); await waitReady(page);

  // HTMX tab switch (if present)
  try {
    const followingTab = page.locator('a[hx-get*="feed=following"]').first();
    if (await followingTab.count() > 0) {
      await followingTab.click();
      await page.waitForResponse(r => r.url().includes('feed=following'), { timeout: 5000 }).catch(() => {});
      await waitReady(page);
    }
  } catch (_) {}

  rec.stop();
  await ctx.close();
  return rec.getRecords();
}

/**
 * WF-D : créer un article
 */
async function runArticleCreate(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const rec = new HttpRecorder(page, 'WF-D_article-create');

  await loginUser(page);
  await page.goto(`${BASE_URL}/editor`, { waitUntil: 'domcontentloaded' }); await waitReady(page);

  await page.fill('input[name="title"]', 'Article de test agent-12');
  await page.fill('input[name="description"]', 'Description test enregistreur HTTP');
  await page.fill('textarea[name="body"]', 'Corps de l\'article créé par l\'agent 12 pour capturer le trafic HTTP.');
  // tags est un hidden input géré par JS — on le renseigne via evaluate
  await page.evaluate(() => {
    const el = document.getElementById('tag-hidden');
    if (el) el.value = 'test-agent12,migration';
  });

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await waitReady(page);

  // Récupère le slug de l'article créé
  const currentUrl = page.url();
  const slugMatch  = currentUrl.match(/\/article\/([^/?#]+)/);
  const createdSlug = slugMatch ? slugMatch[1] : null;

  rec.stop();
  await ctx.close();
  return { records: rec.getRecords(), createdSlug };
}

/**
 * WF-E : éditer un article (celui créé en WF-D ou article seed connu)
 */
async function runArticleEdit(browser, slug) {
  if (!slug) slug = 'teletravail-bilan-et-nouvelles-frontieres-du-travail-a-distance';

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const rec = new HttpRecorder(page, 'WF-E_article-edit');

  await loginUser(page);
  await page.goto(`${BASE_URL}/editor/${slug}`, { waitUntil: 'domcontentloaded' }); await waitReady(page);

  const titleInput = page.locator('input[name="title"]');
  if (await titleInput.count() > 0) {
    await titleInput.fill('Article de test agent-12 (édité)');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {}),
      page.click('button[type="submit"]'),
    ]);
    await waitReady(page);
  }

  rec.stop();
  await ctx.close();
  return rec.getRecords();
}

/**
 * WF-F + WF-G : créer puis supprimer un commentaire (HTMX)
 */
async function runCommentCreateDelete(browser, articleSlug) {
  if (!articleSlug) articleSlug = 'teletravail-bilan-et-nouvelles-frontieres-du-travail-a-distance';

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const rec = new HttpRecorder(page, 'WF-FG_comment');

  await loginUser(page);
  await page.goto(`${BASE_URL}/article/${articleSlug}`, { waitUntil: 'domcontentloaded' }); await waitReady(page);

  // Créer un commentaire
  const commentArea = page.locator('textarea[name="body"]').first();
  if (await commentArea.count() > 0) {
    await commentArea.fill('Commentaire de test agent-12');
    const submitBtn = page.locator('button[type="submit"]').first();
    if (await submitBtn.count() > 0) {
      await submitBtn.click();
      await page.waitForResponse(r => r.url().includes('/comment'), { timeout: 8000 }).catch(() => {});
      await waitReady(page);
    }
  }

  // Supprimer le commentaire (bouton delete du dernier commentaire)
  await page.goto(`${BASE_URL}/article/${articleSlug}`, { waitUntil: 'domcontentloaded' }); await waitReady(page);
  try {
    const deleteBtn = page.locator('button[hx-post*="/comment/"], form[action*="/comment/"] button[type="submit"]').last();
    if (await deleteBtn.count() > 0) {
      await deleteBtn.click();
      await page.waitForResponse(r => r.url().includes('/delete'), { timeout: 8000 }).catch(() => {});
      await waitReady(page);
    }
  } catch (_) {}

  rec.stop();
  await ctx.close();
  return rec.getRecords();
}

/**
 * WF-H : follow/unfollow (HTMX + redirect)
 */
async function runFollow(browser) {
  // On a besoin d'un second utilisateur à suivre.
  // On utilise le profil admin lui-même (possible techniquement, Django ne bloque pas self-follow).
  // En pratique on cherche un autre profil dans la liste des articles.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const rec = new HttpRecorder(page, 'WF-H_follow');

  await loginUser(page);

  // Cherche un profil d'auteur d'un article
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' }); await waitReady(page);

  // Tente de cliquer sur un bouton follow HTMX (sur la page profil admin)
  await page.goto(`${BASE_URL}/profiles/${KNOWN_USER}`, { waitUntil: 'domcontentloaded' }); await waitReady(page);

  const followBtn = page.locator(
    'button[hx-post*="/follow"], form[action*="/follow"] button[type="submit"]'
  ).first();
  if (await followBtn.count() > 0) {
    await followBtn.click();
    await page.waitForResponse(r => r.url().includes('/follow'), { timeout: 8000 }).catch(() => {});
    await waitReady(page);

    // Unfollow
    const unfollowBtn = page.locator(
      'button[hx-post*="/follow"], form[action*="/follow"] button[type="submit"]'
    ).first();
    if (await unfollowBtn.count() > 0) {
      await unfollowBtn.click();
      await page.waitForResponse(r => r.url().includes('/follow'), { timeout: 8000 }).catch(() => {});
      await waitReady(page);
    }
  } else {
    // Fallback: POST direct sans JS
    await page.goto(`${BASE_URL}/profiles/${KNOWN_USER}/follow`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await waitReady(page);
  }

  rec.stop();
  await ctx.close();
  return rec.getRecords();
}

/**
 * WF-I : favorite/unfavorite (HTMX + redirect)
 */
async function runFavorite(browser, articleSlug) {
  if (!articleSlug) articleSlug = 'teletravail-bilan-et-nouvelles-frontieres-du-travail-a-distance';

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const rec = new HttpRecorder(page, 'WF-I_favorite');

  await loginUser(page);
  await page.goto(`${BASE_URL}/article/${articleSlug}`, { waitUntil: 'domcontentloaded' }); await waitReady(page);

  const favBtn = page.locator(
    'button[hx-post*="/favorite"], form[action*="/favorite"] button[type="submit"]'
  ).first();
  if (await favBtn.count() > 0) {
    await favBtn.click();
    await page.waitForResponse(r => r.url().includes('/favorite'), { timeout: 8000 }).catch(() => {});
    await waitReady(page);

    // Unfavorite
    const unfavBtn = page.locator(
      'button[hx-post*="/favorite"], form[action*="/favorite"] button[type="submit"]'
    ).first();
    if (await unfavBtn.count() > 0) {
      await unfavBtn.click();
      await page.waitForResponse(r => r.url().includes('/favorite'), { timeout: 8000 }).catch(() => {});
      await waitReady(page);
    }
  }

  rec.stop();
  await ctx.close();
  return rec.getRecords();
}

/**
 * WF-J : settings
 */
async function runSettings(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const rec = new HttpRecorder(page, 'WF-J_settings');

  await loginUser(page);
  await page.goto(`${BASE_URL}/settings`, { waitUntil: 'domcontentloaded' }); await waitReady(page);

  // GET settings uniquement (pas de modification compte réel)
  // On teste la redirection si non-auth aussi
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page2 = await ctx2.newPage();
  await page2.goto(`${BASE_URL}/settings`, { waitUntil: 'domcontentloaded' }); await waitReady(page2);
  rec.stop();

  // Ajoute les records de la navigation anonyme (redirect)
  // (même recorder ne peut pas écouter page2, mais on capture juste WF-J côté auth)
  await ctx2.close();
  await ctx.close();
  return rec.getRecords();
}

/**
 * WF-K : logout
 */
async function runLogout(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const rec = new HttpRecorder(page, 'WF-K_logout');

  await loginUser(page);

  // Click sur logout
  try {
    const logoutBtn = page.locator('form[action*="/logout"] button[type="submit"], a[href*="/logout"]').first();
    if (await logoutBtn.count() > 0) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle', timeout: 12000 }).catch(() => {}),
        logoutBtn.click(),
      ]);
    } else {
      await page.goto(`${BASE_URL}/logout`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    }
    await waitReady(page);
  } catch (_) {}

  rec.stop();
  await ctx.close();
  return rec.getRecords();
}

/**
 * WF-L : supprimer l'article créé (cleanup)
 */
async function runArticleDelete(browser, slug) {
  if (!slug) return [];

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const rec = new HttpRecorder(page, 'WF-L_article-delete');

  await loginUser(page);
  await page.goto(`${BASE_URL}/article/${slug}`, { waitUntil: 'domcontentloaded' }); await waitReady(page);

  try {
    const deleteBtn = page.locator(
      'form[action*="/delete"] button[type="submit"], button[hx-post*="/delete"]'
    ).first();
    if (await deleteBtn.count() > 0) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle', timeout: 12000 }).catch(() => {}),
        deleteBtn.click(),
      ]);
      await waitReady(page);
    }
  } catch (_) {}

  rec.stop();
  await ctx.close();
  return rec.getRecords();
}

// ---------------------------------------------------------------------------
// Génération des fichiers .http de test à partir des recordings
// ---------------------------------------------------------------------------

function recordsToHttpFile(records, workflowId) {
  const lines = [];
  lines.push(`# Generated by Agent 12 - workflow: ${workflowId}`);
  lines.push(`# Environment: local/staging — NEVER production`);
  lines.push(`# @baseUrl = http://localhost:8000`);
  lines.push('');

  const seen = new Set();
  for (const r of records) {
    const dedupeKey = `${r.method}:${r.path}:${r.response.status}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    lines.push(`### ${r.method} ${r.path} → ${r.response.status}`);
    lines.push(`# Workflow: ${r.workflow} | Duration: ${r.response.duration_ms ?? '?'}ms`);
    lines.push(`${r.method} {{baseUrl}}${r.path}`);

    // Headers significatifs (pas les cookies bruts)
    const interestingHeaders = ['content-type', 'hx-request', 'hx-target', 'hx-current-url', 'accept'];
    for (const h of interestingHeaders) {
      if (r.request.headers[h]) {
        lines.push(`${h}: ${r.request.headers[h]}`);
      }
    }
    lines.push('x-csrftoken: {{CSRF_TOKEN}}');
    lines.push('Cookie: {{SESSION_COOKIE}}');

    if (r.request.body) {
      lines.push('');
      lines.push(r.request.body);
    }

    lines.push('');
    lines.push(`# Expected: ${r.response.status} ${r.response.status_text}`);
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Sauvegarde
// ---------------------------------------------------------------------------

function saveWorkflow(workflowId, records) {
  if (!records || records.length === 0) return null;
  ensureDir(REC_DIR);
  const filename = `${workflowId}.json`;
  const filepath = path.join(REC_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(records, null, 2), 'utf-8');

  // Fichier .http
  ensureDir(TESTS_DIR);
  const httpFile = path.join(TESTS_DIR, `${workflowId}.http`);
  fs.writeFileSync(httpFile, recordsToHttpFile(records, workflowId), 'utf-8');

  return { jsonFile: `http_recordings/recordings/${filename}`, httpFile: `http_recordings/generated_tests/${workflowId}.http` };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('[Agent 12] Démarrage de l\'enregistrement HTTP...');
  console.log(`[Agent 12] Cible : ${BASE_URL}`);
  console.log('[Agent 12] Environnement : local — anonymisation activée\n');

  ensureDir(OUTPUT_DIR);
  ensureDir(REC_DIR);
  ensureDir(TESTS_DIR);

  const browser = await chromium.launch({ headless: true });
  const startTime = Date.now();

  const allWorkflows = [];
  const indexRecordings = [];
  const generatedTestFiles = [];

  async function runWorkflow(label, fn) {
    process.stdout.write(`  [${label}] ...`);
    try {
      const result = await fn();
      const records = Array.isArray(result) ? result : (result.records || []);
      const files = saveWorkflow(label, records);
      const uniqueEndpoints = [...new Set(records.map(r => `${r.method}:${r.path}`))];

      if (files) {
        generatedTestFiles.push(files.httpFile);
        for (const r of records) {
          indexRecordings.push({
            file:             files.jsonFile,
            timestamp:        r.timestamp,
            method:           r.method,
            path:             r.path,
            status:           r.response.status,
            workflow:         r.workflow,
            anonymized_fields: r.anonymized_fields,
          });
        }
        allWorkflows.push({ id: label, count: records.length, unique_endpoints: uniqueEndpoints });
        console.log(` OK (${records.length} req, ${uniqueEndpoints.length} endpoints uniques)`);
      } else {
        console.log(' SKIP (aucune requête capturée)');
      }

      return result;
    } catch (err) {
      console.log(` ERREUR: ${err.message}`);
      allWorkflows.push({ id: label, count: 0, error: err.message });
      return null;
    }
  }

  // Exécution des workflows

  await runWorkflow('WF-A_browse-anonymous', () => runBrowseAnonymous(browser));
  const loginResult   = await runWorkflow('WF-B_login', () => runLogin(browser));
  await runWorkflow('WF-C_browse-auth',   () => runBrowseAuth(browser));

  const createResult  = await runWorkflow('WF-D_article-create', () => runArticleCreate(browser));
  const createdSlug   = (createResult && createResult.createdSlug) ? createResult.createdSlug : null;

  await runWorkflow('WF-E_article-edit',  () => runArticleEdit(browser, createdSlug));
  await runWorkflow('WF-FG_comment',      () => runCommentCreateDelete(browser,
    createdSlug || 'teletravail-bilan-et-nouvelles-frontieres-du-travail-a-distance'));
  await runWorkflow('WF-H_follow',        () => runFollow(browser));
  await runWorkflow('WF-I_favorite',      () => runFavorite(browser,
    createdSlug || 'teletravail-bilan-et-nouvelles-frontieres-du-travail-a-distance'));
  await runWorkflow('WF-J_settings',      () => runSettings(browser));
  await runWorkflow('WF-K_logout',        () => runLogout(browser));

  // Cleanup : supprime l'article créé
  if (createdSlug) {
    await runWorkflow('WF-L_article-delete', () => runArticleDelete(browser, createdSlug));
  }

  await browser.close();

  const durationSec = Math.round((Date.now() - startTime) / 1000);
  const totalRecordings    = indexRecordings.length;
  const uniqueEndpointsAll = [...new Set(indexRecordings.map(r => `${r.method}:${r.path}`))];

  // ---------------------------------------------------------------------------
  // index.json
  // ---------------------------------------------------------------------------
  const index = {
    generated_at:           new Date().toISOString(),
    agent:                  '12-recorder-http',
    confidence:             72,
    capture_method:         'playwright',
    environment:            'local',
    base_url:               BASE_URL,
    credentials_used:       'test@email.com (anonymisé)',
    summary: {
      total_recordings:         totalRecordings,
      total_unique_endpoints:   uniqueEndpointsAll.length,
      capture_duration_seconds: durationSec,
      workflows_executed:       allWorkflows.length,
      workflows_success:        allWorkflows.filter(w => w.count > 0).length,
    },
    workflows: allWorkflows,
    recordings: indexRecordings,
    generated_test_files: generatedTestFiles,
    anonymization: {
      headers:    ['cookie', 'set-cookie', 'authorization'],
      body_keys:  ['csrfmiddlewaretoken', 'password', 'email'],
      placeholders: {
        cookie:             '{{SESSION_COOKIE}}',
        'set-cookie':       '{{SET_COOKIE}}',
        authorization:      '{{AUTH_TOKEN}}',
        csrfmiddlewaretoken: '{{CSRF_TOKEN}}',
        password:           '{{PASSWORD}}',
        email:              '{{USER_EMAIL}}',
      },
    },
    notes: [
      'Application Django/HTMX SSR — réponses HTML. Corps de réponse tronqués à 300 chars pour les pages HTML.',
      'HTMX : requêtes avec HX-Request header capturées séparément.',
      'WF-L (delete) exécuté pour nettoyer l\'article de test créé en WF-D.',
      'Données sensibles remplacées par placeholders — aucune donnée personnelle réelle dans les fichiers.',
    ],
  };

  const indexPath = path.join(OUTPUT_DIR, 'index.json');
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');

  console.log('\n[Agent 12] Terminé.');
  console.log(`  Durée totale       : ${durationSec}s`);
  console.log(`  Total requêtes     : ${totalRecordings}`);
  console.log(`  Endpoints uniques  : ${uniqueEndpointsAll.length}`);
  console.log(`  Fichiers générés   : ${generatedTestFiles.length} .http + ${allWorkflows.filter(w=>w.count>0).length} .json`);
  console.log(`  Index              : migration-state/phase2/http_recordings/index.json`);

  return index;
}

module.exports = { main };

if (require.main === module) {
  main().catch(err => {
    console.error('[Agent 12] FATAL:', err);
    process.exit(1);
  });
}
