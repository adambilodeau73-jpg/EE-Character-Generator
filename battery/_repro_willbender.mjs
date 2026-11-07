// _repro_willbender.mjs — reproduction harness for Adam's field report:
// Willbender theme + "manifestable by this character" showed Dominate Being
// with a live "+ Add" that then trips the GM-exception intercept. Who let
// the row through — the psionic route, or the super-buy path?
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __dir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(process.env.CG_FILE || resolve(__dir, '../index.html'), 'utf8');
const server = createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); });
await new Promise(r => server.listen(8814, '127.0.0.1', r));

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.evaluateOnNewDocument(() => { window.print = () => {}; });
await page.goto('http://127.0.0.1:8814/', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('typeof renderPowersBrowse === "function" && typeof SPELLS_DB !== "undefined"', { timeout: 60000 });

const run = await page.evaluate(() => {
  const out = {};
  const mk = (extra) => Object.assign({
    id: 'repro-wb', name: 'Repro', attrs: [10, 10, 10, 14, 10, 10],
    classes: [{ name: 'Psion', tier: 'hero', level: 1 }],
    psionDiscipline: 'Telepath',
    feats: [], mutations: [], talents: [], powers: [], skills: {}, totalLvl: 1,
    sixLevels: { arcane: 0, divine: 0, heroic: 5, mutation: 5, psionic: 5, tech: 6 },
  }, extra || {});

  const probe = (c) => {
    chars.length = 0; chars.push(c); curId = c.id;
    _pwMode = 'powers'; _pwBrowseOpen = true;
    // the browse DOM may not be live on a headless boot — render the page first
    try { showPage('powers'); } catch (e) {}
    const q = document.getElementById('pw-search'); if (q) q.value = '';
    const th = document.getElementById('pw-theme-filter');
    const cb = document.getElementById('pw-castable-only');
    const lv = document.getElementById('pw-lvl-filter'); if (lv) lv.value = '';
    const pf = document.getElementById('pw-pool-filter'); if (pf) pf.value = '';
    renderPowersBrowse();              // populates the theme options
    if (th) th.value = 'Willbender';
    if (cb) cb.checked = true;
    renderPowersBrowse();
    const hit = _pwBrowseList.find(s => s.name === 'Dominate Being');
    const pi = getCasterPoolsInfo(c);
    const opts = hit ? spellPoolOptions(hit, pi).filter(o => _pwModePools().includes(o.pool)) : [];
    const st = getMPState(c);
    const db = SPELLS_DB.find(s => s.name === 'Dominate Being');
    return {
      listed: !!hit,
      listNames: _pwBrowseList.map(s => s.name),
      routes: opts.map(o => ({ pool: o.pool, token: o.token, lvl: o.lvl, overMax: o.overMax })),
      psiMax: pi.psionic ? pi.psionic.maxPowerLvl : null,
      superCapable: st.isSuperMutant,
      buy: (typeof superBuyEligibility === 'function' && st.isSuperMutant) ? superBuyEligibility(c, db) : null,
      rowHtml: (() => {
        const el = document.getElementById('pw-browse-list');
        if (!el || !hit) return null;
        const m = el.innerHTML.match(/<div[^>]*>(?:(?!<div).)*Dominate Being[\s\S]{0,400}/);
        return m ? m[0].replace(/\s+/g, ' ').slice(0, 400) : null;
      })(),
    };
  };

  out.plainTelepath = probe(mk());
  out.superTelepath = probe(mk({
    id: 'repro-wb-super',
    feats: [{ name: 'Supernatural Mutation' }],
    superMutantTier: 'mega',
    mpGrants: [{ amount: 40, reason: 'repro' }],
  }));
  return out;
});
console.log(JSON.stringify(run, null, 1));
await browser.close();
server.close();
