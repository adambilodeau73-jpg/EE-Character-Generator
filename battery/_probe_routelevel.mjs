// _probe_routelevel.mjs — v9.19.2 targeted probe: KARGUS GOES SHOPPING.
// Adam's field report (2026-10-27, Kargus the Drakkin Charismatic Hero 1
// with Psionic Heritage → Wilder): the powers-browse LEVEL filter matched
// ANY class's level line — Body Adjustment / Body Purification are Psi/Wld 3
// but War 2, so a Wilder filtering for 2nd-level powers was shown them via
// the Warmind entry. Fixed: with routes to an entry the filter tests the
// ROUTE levels (the character's own price); unrouted entries keep the raw
// any-class match. Display half: route tags now carry the route level
// ("psionic 3" for the Wilder, "psionic 2" for a Warmind).
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __dir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(process.env.CG_FILE || resolve(__dir, '../index.html'), 'utf8');
const server = createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); });
await new Promise(r => server.listen(8799, '127.0.0.1', r));

const results = [];
const mark = (id, pass, note = '') => { results.push({ id, pass }); console.log(`${pass ? '  ✓' : '  ✗ FAIL'} ${id}${note ? ' — ' + note : ''}`); };

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) consoleErrors.push(m.text().slice(0, 200)); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + String(e).slice(0, 200)));
await page.goto('http://127.0.0.1:8799/', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('typeof chars !== "undefined" && typeof renderPowersBrowse === "function"', { timeout: 60000 });

const t = async (id, fn) => { try { const r = await page.evaluate(fn); mark(id, r === true || (r && r.pass === true), (r && r.note) || (r === true ? '' : JSON.stringify(r).slice(0, 220))); } catch (e) { mark(id, false, String(e).slice(0, 220)); } };

await page.evaluate(() => { window.print = () => {}; });

// Seed Kargus's shape: Charismatic Hero 1, Psionic Heritage → Wilder.
await t('SEED-KARGUS', () => {
  localStorage.clear(); chars = []; curId = null;
  const r = qdBespokeBuild({ steps: [{ name: 'Charismatic Hero', levels: 1 }], sixLevels: { arcane: 0, divine: 0, heroic: 5, mutation: 0, psionic: 5, tech: 5 }, presetName: 'Custom', race: 'Human', hybrid: null, name: 'Kargus Probe', occupation: '' });
  if (!r.ok) return { note: 'build failed: ' + r.reason };
  const c = r.char; chars.push(c); curId = c.id;
  c.feats = c.feats || []; c.feats.push({ name: 'Psionic Heritage', param: 'Wilder' });
  save(); renderNavTabs(c);
  const pi = getCasterPoolsInfo(c);
  return !!pi.psionic || { pools: Object.keys(pi) };
});

// The browse state is driven through the real page controls.
await page.evaluate(() => {
  window.__rl = {
    setup(lvl) {
      showPage('powers');
      if (typeof _pwBrowseOpen !== 'undefined' && !_pwBrowseOpen && typeof togglePwBrowse === 'function') togglePwBrowse();
      window._pwBrowseOpen = true;
      document.getElementById('pw-search').value = 'body ';
      document.getElementById('pw-castable-only').checked = false;
      document.getElementById('pw-lvl-filter').value = String(lvl);
      renderPowersBrowse();
      return _pwBrowseList.map(s => s.name);
    },
  };
});

// 1) Wilder + lvl filter 2: the Warmind-2/Wilder-3 pair is EXCLUDED.
await t('WILDER-LVL2-EXCLUDES', () => {
  const names = __rl.setup(2);
  return (!names.includes('Body Adjustment') && !names.includes('Body Purification'))
    || { names: names.slice(0, 8) };
});

// 2) Wilder + lvl filter 3: the pair appears, tag reads "psionic 3".
await t('WILDER-LVL3-INCLUDES', () => {
  const names = __rl.setup(3);
  if (!names.includes('Body Adjustment')) return { names: names.slice(0, 8) };
  const row = [...document.querySelectorAll('#pw-browse-list > div')].find(d => /Body Adjustment/.test(d.textContent));
  return (row && /psionic 3/.test(row.textContent) && !/psionic 2/.test(row.textContent))
    || { rowText: row && row.textContent.replace(/\s+/g, ' ').slice(0, 120) };
});

// 3) Same character re-heritaged as a Warmind: filter 2 INCLUDES the pair,
//    tag reads "psionic 2".
await t('WARMIND-LVL2-INCLUDES', () => {
  const c = chars.find(x => x.name === 'Kargus Probe');
  c.feats.find(f => f.name === 'Psionic Heritage').param = 'Warmind';
  save();
  const names = __rl.setup(2);
  if (!names.includes('Body Adjustment')) return { names: names.slice(0, 8) };
  const row = [...document.querySelectorAll('#pw-browse-list > div')].find(d => /Body Adjustment/.test(d.textContent));
  return (row && /psionic 2/.test(row.textContent)) || { rowText: row && row.textContent.replace(/\s+/g, ' ').slice(0, 120) };
});

// 4) Unrouted entries keep catalogue-level matching: a divine-only spell
//    still answers the level filter for this psionic-only character.
await t('UNROUTED-FALLBACK', () => {
  const c = chars.find(x => x.name === 'Kargus Probe');
  c.feats.find(f => f.name === 'Psionic Heritage').param = 'Wilder'; save();
  showPage('powers');
  document.getElementById('pw-search').value = '';
  document.getElementById('pw-castable-only').checked = false;
  document.getElementById('pw-lvl-filter').value = '9';
  renderPowersBrowse();
  // some level-9 entries exist that this character has NO route to
  const unrouted = _pwBrowseList.filter(s => !spellPoolOptions(s, getCasterPoolsInfo(c)).length);
  return unrouted.length > 0 || { listLen: _pwBrowseList.length };
});

await t('VERSION-STAMPED', () => (/^v9\.\d+\.\d+$/.test(CG_VERSION) && document.querySelector('.site-subtitle').textContent.includes(CG_VERSION)) || { CG_VERSION });
mark('CONSOLE-CLEAN', consoleErrors.length === 0, consoleErrors[0] || '');

const passed = results.filter(r => r.pass).length;
console.log(`\n== ROUTE LEVEL PROBE: ${passed}/${results.length} ==`);
await browser.close();
server.close();
process.exit(passed === results.length ? 0 : 1);
