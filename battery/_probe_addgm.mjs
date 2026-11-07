// _probe_addgm.mjs — v9.20.5 (§289) targeted probe: Adam's Option C gavel on
// the Willbender/Dominate Being report. When EVERY route to a browse entry is
// above the character's castable level, the add button must declare itself
// "+ Add (GM)" (amber, tooltip'd) — the Gate-1 exception door wearing its own
// sign. Rows with a legitimately castable route keep the plain "+ Add", and
// the "manifestable by this character" filter behavior is unchanged.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __dir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(process.env.CG_FILE || resolve(__dir, '../index.html'), 'utf8');
const server = createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); });
await new Promise(r => server.listen(8816, '127.0.0.1', r));

const results = [];
const mark = (id, pass, note = '') => { results.push({ id, pass }); console.log(`${pass ? '  ✓' : '  ✗ FAIL'} ${id}${note ? ' — ' + note : ''}`); };

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) consoleErrors.push(m.text().slice(0, 200)); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + String(e).slice(0, 200)));
await page.evaluateOnNewDocument(() => { window.print = () => {}; });
await page.goto('http://127.0.0.1:8816/', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('typeof renderPowersBrowse === "function" && typeof SPELLS_DB !== "undefined"', { timeout: 60000 });

const t = async (id, fn) => { try { const r = await page.evaluate(fn); mark(id, r === true || (r && r.pass === true), (r && r.note) || (r === true ? '' : JSON.stringify(r).slice(0, 200))); } catch (e) { mark(id, false, String(e).slice(0, 200)); } };

await page.evaluate(() => {
  window.__mkT = (extra) => Object.assign({
    id: 'probe-addgm', name: 'Probe', attrs: [10, 10, 10, 14, 10, 10],
    classes: [{ name: 'Psion', tier: 'hero', level: 1 }],
    psionDiscipline: 'Telepath',
    feats: [], mutations: [], talents: [], powers: [], skills: {}, totalLvl: 1,
    sixLevels: { arcane: 0, divine: 0, heroic: 5, mutation: 5, psionic: 5, tech: 6 },
  }, extra || {});
  window.__render = (c, { theme = '', castable = false } = {}) => {
    chars.length = 0; chars.push(c); curId = c.id;
    _pwMode = 'powers'; _pwBrowseOpen = true;
    try { showPage('powers'); } catch (e) {}
    const q = document.getElementById('pw-search'); if (q) q.value = '';
    const lv = document.getElementById('pw-lvl-filter'); if (lv) lv.value = '';
    const pf = document.getElementById('pw-pool-filter'); if (pf) pf.value = '';
    renderPowersBrowse(); // seed theme options
    const th = document.getElementById('pw-theme-filter'); if (th) th.value = theme;
    const cb = document.getElementById('pw-castable-only'); if (cb) cb.checked = castable;
    renderPowersBrowse();
  };
  window.__rowOf = (name) => {
    const el = document.getElementById('pw-browse-list');
    if (!el) return null;
    const idx = _pwBrowseList.findIndex(s => s.name === name);
    if (idx < 0) return null;
    // the row opens with its toggle handler carrying the browse index — slice
    // from there to the NEXT row's toggle (or the end)
    const h = el.innerHTML;
    const a = h.indexOf(`togglePwBrowseDetail(${idx})`);
    if (a < 0) return null;
    const b = h.indexOf(`togglePwBrowseDetail(${idx + 1})`);
    return h.slice(a, b > a ? b : a + 2000);
  };
  window.__superT = () => __mkT({ id: 'probe-addgm-s', feats: [{ name: 'Supernatural Mutation' }], superMutantTier: 'mega', mpGrants: [{ amount: 40, reason: 'probe' }] });
});

await t('SUPER-ROW-WEARS-THE-GM-SIGN', () => {
  __render(__superT(), { theme: 'Willbender', castable: true });
  const row = __rowOf('Dominate Being');
  return (!!row && row.includes('+ Add (GM)') && /GM-approved exception/.test(row)) || { row: row && row.slice(0, 250) };
});
await t('FILTER-INDEPENDENT-HONESTY', () => {
  // unchecked filter, plain low-level Telepath: the row appears in the open
  // catalogue and must STILL wear the GM sign (all routes overMax).
  __render(__mkT(), { theme: 'Willbender', castable: false });
  const row = __rowOf('Dominate Being');
  return (!!row && row.includes('+ Add (GM)')) || { row: row && row.slice(0, 250) };
});
await t('CASTABLE-ROUTE-KEEPS-PLAIN-ADD', () => {
  __render(__mkT(), { theme: '', castable: true });
  const el = document.getElementById('pw-browse-list').innerHTML;
  // every row under the manifestable filter for a plain Telepath has a legal
  // route — no GM sign anywhere, and at least one plain Add rendered
  const plain = (el.match(/>\+ Add<\/button>/g) || []).length;
  return (plain > 0 && !el.includes('+ Add (GM)')) || { plain, gm: el.includes('+ Add (GM)') };
});
await t('MANIFESTABLE-FILTER-UNCHANGED', () => {
  __render(__mkT(), { theme: 'Willbender', castable: true });
  return !_pwBrowseList.some(s => s.name === 'Dominate Being')
    || { listed: _pwBrowseList.map(s => s.name) };
});
await t('VERSION-STAMPED', () => {
  return (CG_VERSION === 'v9.20.5' && document.querySelector('.site-subtitle').textContent.includes('v9.20.5'))
    || { v: CG_VERSION };
});
mark('CONSOLE-CLEAN', consoleErrors.length === 0, consoleErrors[0] || '');

const passed = results.filter(r => r.pass).length;
console.log(`\n== ADD-GM PROBE: ${passed}/${results.length} ==`);
await browser.close();
server.close();
process.exit(passed === results.length ? 0 : 1);
