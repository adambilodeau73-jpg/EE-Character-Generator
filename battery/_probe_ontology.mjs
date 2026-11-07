// _probe_ontology.mjs — v9.20.2 (§286) targeted probe: THE ONTOLOGY LINE.
// Adam's re-ruling (2026-11-07, knowingly superseding his 2026-10-03
// "feat OR 10+"): the Mutant subtype attaches at MORE THAN 2 total MP from
// any route — the Slightly Different calibration (that feat grants exactly
// 2 and stays human; one more point makes a Mutant, "just a non-
// supernatural one"). TWO DIALS: subtype = ontology (no stat weight below
// ML 1); the 10/20/30 ML ladder = power, unchanged.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __dir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(process.env.CG_FILE || resolve(__dir, '../index.html'), 'utf8');
const server = createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); });
await new Promise(r => server.listen(8811, '127.0.0.1', r));

const results = [];
const mark = (id, pass, note = '') => { results.push({ id, pass }); console.log(`${pass ? '  ✓' : '  ✗ FAIL'} ${id}${note ? ' — ' + note : ''}`); };

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) consoleErrors.push(m.text().slice(0, 200)); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + String(e).slice(0, 200)));
await page.evaluateOnNewDocument(() => { window.print = () => {}; });
await page.goto('http://127.0.0.1:8811/', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('typeof getMPState === "function" && typeof reconcileMutantSubtype === "function"', { timeout: 60000 });

const t = async (id, fn) => { try { const r = await page.evaluate(fn); mark(id, r === true || (r && r.pass === true), (r && r.note) || (r === true ? '' : JSON.stringify(r).slice(0, 200))); } catch (e) { mark(id, false, String(e).slice(0, 200)); } };

await page.evaluate(() => {
  window.__mk = (grants, feats) => ({
    id: 'probe-ont', name: 'Probe', attrs: [10, 10, 10, 10, 10, 10],
    classes: [{ name: 'Strong Hero', tier: 'hero', level: 1 }],
    feats: (feats || []).map(n => ({ name: n })), mutations: [], talents: [], powers: [], totalLvl: 1,
    mpGrants: grants ? [{ amount: grants, reason: 'probe' }] : [],
    bab: 1, def: 1, maxHP: 10, currentHP: 10,
  });
});

await t('TWO-MP-STAYS-HUMAN', () => {
  const st = getMPState(__mk(2));
  return (!st.isMutantTemplated && st.mutantLevel === 0) || { templ: st.isMutantTemplated };
});
await t('SLIGHTLY-DIFFERENT-EXACTLY-CALIBRATED', () => {
  // the feat grants exactly 2 — its holder stays, by name and math, human
  const st = getMPState(__mk(0, ['Slightly Different']));
  return (st.totalEarned === 2 && !st.isMutantTemplated) || { earned: st.totalEarned, templ: st.isMutantTemplated };
});
await t('THREE-MP-IS-A-MUTANT', () => {
  const st = getMPState(__mk(3));
  return (st.isMutantTemplated && !st.isSuperMutant && st.mutantLevel === 0)
    || { templ: st.isMutantTemplated, super: st.isSuperMutant, ml: st.mutantLevel };
});
await t('SLIGHTLY-DIFFERENT-PLUS-ONE-CROSSES', () => {
  const st = getMPState(__mk(1, ['Slightly Different']));
  return (st.totalEarned === 3 && st.isMutantTemplated && !st.isSuperMutant)
    || { earned: st.totalEarned, templ: st.isMutantTemplated };
});
await t('ONTOLOGY-CARRIES-NO-STATS-BELOW-ML1', () => {
  const c = __mk(5);
  const before = { bab: c.bab, def: c.def, hp: c.maxHP };
  reconcileMutantSubtype(c);
  return (c.bab === before.bab && c.def === before.def && c.maxHP === before.hp)
    || { before, after: { bab: c.bab, def: c.def, hp: c.maxHP } };
});
await t('POWER-DIAL-UNCHANGED-AT-10', () => {
  const c = __mk(10);
  const st = getMPState(c);
  reconcileMutantSubtype(c);
  return (st.mutantLevel === 1 && st.isMutantTemplated && c.maxHP === 10 + 1 * 5 && c.def === 1)
    || { ml: st.mutantLevel, hp: c.maxHP };
});
await t('FEAT-ROUTE-UNCHANGED', () => {
  const c = __mk(0, ['Supernatural Mutation']); c.superMutantTier = 'minor';
  const st = getMPState(c);
  return (st.isSuperMutant && st.isMutantTemplated) || { super: st.isSuperMutant, templ: st.isMutantTemplated };
});
await t('VERSION-STAMPED', () => {
  return (CG_VERSION === 'v9.20.2' && document.querySelector('.site-subtitle').textContent.includes('v9.20.2'))
    || { v: CG_VERSION };
});
mark('CONSOLE-CLEAN', consoleErrors.length === 0, consoleErrors[0] || '');

const passed = results.filter(r => r.pass).length;
console.log(`\n== ONTOLOGY PROBE: ${passed}/${results.length} ==`);
await browser.close();
server.close();
process.exit(passed === results.length ? 0 : 1);
