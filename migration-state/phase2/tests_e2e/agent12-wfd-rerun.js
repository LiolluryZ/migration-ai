'use strict';
/**
 * Re-run ciblé : WF-D (article create) + WF-L (article delete)
 * Corrige le problème hidden input tags (evaluate au lieu de fill)
 */
const { chromium } = require('@playwright/test');
const fs   = require('fs');
const path = require('path');

const BASE_URL  = 'http://localhost:8000';
const REC_DIR   = path.join(__dirname, '..', 'http_recordings', 'recordings');
const TESTS_DIR = path.join(__dirname, '..', 'http_recordings', 'generated_tests');

const SKIP = [
  /\.(css|js|map|ico|png|jpg|jpeg|gif|svg|woff2?|ttf|eot)(\?|$)/i,
  /^chrome-extension:/,
  /\/static\//,
  /\/favicon/,
];
function sc(u) { for (const p of SKIP) if (p.test(u)) return false; return true; }
function aH(h) {
  const o = { ...h };
  if (o.cookie)     o.cookie      = '{{SESSION_COOKIE}}';
  if (o['set-cookie']) o['set-cookie'] = '{{SET_COOKIE}}';
  return o;
}
function aB(b, ct) {
  if (!b) return b;
  if (ct && ct.includes('urlencoded')) {
    const p = new URLSearchParams(b);
    if (p.has('csrfmiddlewaretoken')) p.set('csrfmiddlewaretoken', '{{CSRF_TOKEN}}');
    if (p.has('password'))            p.set('password', '{{PASSWORD}}');
    if (p.get('email') === 'test@email.com') p.set('email', '{{USER_EMAIL}}');
    return p.toString();
  }
  return b;
}
async function wr(page) {
  try { await page.waitForLoadState('networkidle', { timeout: 10000 }); } catch (_) {}
}

class Rec {
  constructor(page, wf) {
    this.page = page; this.wf = wf; this.records = []; this._m = new Map();
    this._a = (req) => {
      const u = req.url();
      if (!sc(u)) return;
      this._m.set(req.method() + u, { req, t: Date.now() });
    };
    this._b = async (res) => {
      const req = res.request(), u = req.url();
      if (!sc(u)) return;
      const k = req.method() + u, pe = this._m.get(k), d = pe ? Date.now() - pe.t : null;
      if (pe) this._m.delete(k);
      let rb = null; try { rb = req.postData(); } catch (_) {}
      let resb = null;
      try {
        const t = await res.text();
        const isH = (res.headers()['content-type'] || '').includes('html');
        resb = isH ? { type: 'html', length: t.length, excerpt: t.slice(0, 300) } : t.slice(0, 1000);
      } catch (_) {}
      const uo = new URL(u);
      this.records.push({
        workflow: this.wf,
        timestamp: new Date().toISOString(),
        method: req.method(),
        path: uo.pathname + (uo.search || ''),
        request: {
          headers: aH(req.headers()),
          body: aB(rb, req.headers()['content-type'] || ''),
          content_type: req.headers()['content-type'] || null,
        },
        response: { status: res.status(), status_text: res.statusText(), headers: aH(res.headers()), body: resb, duration_ms: d },
        anonymized_fields: ['cookie', 'set-cookie', 'csrfmiddlewaretoken', 'password', 'email'],
      });
    };
    page.on('request', this._a); page.on('response', this._b);
  }
  stop() { this.page.removeListener('request', this._a); this.page.removeListener('response', this._b); }
  get() { return this.records; }
}

function toHttp(recs, id) {
  const L = [`# Agent 12 — ${id}`, '# @baseUrl = http://localhost:8000', ''];
  const seen = new Set();
  for (const r of recs) {
    const k = `${r.method}:${r.path}:${r.response.status}`;
    if (seen.has(k)) continue; seen.add(k);
    L.push(`### ${r.method} ${r.path} → ${r.response.status}`);
    L.push(`${r.method} {{baseUrl}}${r.path}`);
    L.push('x-csrftoken: {{CSRF_TOKEN}}');
    L.push('Cookie: {{SESSION_COOKIE}}');
    if (r.request.body) { L.push(''); L.push(r.request.body); }
    L.push(''); L.push(`# Expected: ${r.response.status}`); L.push('');
  }
  return L.join('\n');
}

async function login(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' }); await wr(page);
  await page.fill('input[name="email"]', 'test@email.com');
  await page.fill('input[name="password"]', 'test');
  await Promise.all([
    page.waitForNavigation({ timeout: 10000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
}

async function main() {
  console.log('=== WF-D + WF-L re-run ===');
  const browser = await chromium.launch({ headless: true });

  // WF-D : article create
  process.stdout.write('[WF-D] article-create ... ');
  let createdSlug = null;
  try {
    const ctx  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const rec  = new Rec(page, 'WF-D_article-create');

    await login(page);
    await page.goto(`${BASE_URL}/editor`, { waitUntil: 'domcontentloaded' }); await wr(page);
    console.log('editor url=' + page.url());

    await page.fill('input[name="title"]', 'Agent12 HTTP Test Article');
    await page.fill('input[name="description"]', 'Description for HTTP recording test');
    await page.fill('textarea[name="body"]', 'Body content created by agent-12 to capture HTTP POST /editor traffic.');

    // tags = hidden input — on ne peut pas utiliser fill() sur un élément non visible
    const tagResult = await page.evaluate(() => {
      const el = document.getElementById('tag-hidden');
      if (el) { el.value = 'migration'; return 'ok'; }
      return 'not-found';
    });
    console.log('tags eval: ' + tagResult);

    await Promise.all([
      page.waitForNavigation({ timeout: 15000 }).catch((e) => console.log('nav-catch: ' + e.message.slice(0, 60))),
      page.click('button[type="submit"]'),
    ]);
    await wr(page);

    const finalUrl = page.url();
    console.log('after-submit url=' + finalUrl);
    const m = finalUrl.match(/\/article\/([^/?#]+)/);
    createdSlug = m ? m[1] : null;

    rec.stop();
    const records = rec.get();
    fs.writeFileSync(path.join(REC_DIR, 'WF-D_article-create.json'), JSON.stringify(records, null, 2), 'utf-8');
    fs.writeFileSync(path.join(TESTS_DIR, 'WF-D_article-create.http'), toHttp(records, 'WF-D_article-create'), 'utf-8');
    const uniq = [...new Set(records.map((r) => `${r.method}:${r.path}`))];
    console.log(`OK (${records.length} req, ${uniq.length} uniq) slug=${createdSlug}`);
    await ctx.close();
  } catch (e) {
    console.log('ERR: ' + e.message.split('\n')[0]);
  }

  // WF-L : article delete (cleanup)
  if (createdSlug) {
    process.stdout.write('[WF-L] article-delete ... ');
    try {
      const ctx  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await ctx.newPage();
      const rec  = new Rec(page, 'WF-L_article-delete');

      await login(page);
      await page.goto(`${BASE_URL}/article/${createdSlug}`, { waitUntil: 'domcontentloaded' }); await wr(page);

      const btn = page.locator('form[action*="/delete"] button[type="submit"]').first();
      const cnt = await btn.count();
      console.log('btn-count=' + cnt);

      if (cnt > 0) {
        await Promise.all([
          page.waitForNavigation({ timeout: 12000 }).catch(() => {}),
          btn.click(),
        ]);
        await wr(page);
        console.log('after-delete url=' + page.url());
      }

      rec.stop();
      const records = rec.get();
      fs.writeFileSync(path.join(REC_DIR, 'WF-L_article-delete.json'), JSON.stringify(records, null, 2), 'utf-8');
      fs.writeFileSync(path.join(TESTS_DIR, 'WF-L_article-delete.http'), toHttp(records, 'WF-L_article-delete'), 'utf-8');
      const uniq = [...new Set(records.map((r) => `${r.method}:${r.path}`))];
      console.log(`OK (${records.length} req, ${uniq.length} uniq)`);
      await ctx.close();
    } catch (e) {
      console.log('ERR: ' + e.message.split('\n')[0]);
    }
  } else {
    console.log('[WF-L] SKIP — no slug from WF-D');
  }

  await browser.close();
  console.log('=== DONE ===');
}

main().catch((e) => console.error('FATAL:', e.message));
