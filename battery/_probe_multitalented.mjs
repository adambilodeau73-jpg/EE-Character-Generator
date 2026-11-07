// _probe_multitalented.mjs — v9.20.1 (§285) targeted probe: THE HIDDEN
// TALENTS FIX. Adam's edge-case build report (2026-11-07, Assayer prep):
// the Multi-Talented [Advantage] (1) never escalated its MP cost (HH p.412:
// 2, then 3, then 4…), (2) never opened cross-class talents (the prereq
// gate checked only the Heritage feat), and (3) carried the HH's defective
// same-class-only Benefit text. Asserts: escalation at purchase, restamp on
// remove, legacy-record healing, the cross-class gate with the attr-13
// qualify (both the mutation AND the feat path), per-instance budget
// counting, catalog tree visibility, and the corrected description.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __dir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(process.env.CG_FILE || resolve(__dir, '../index.html'), 'utf8');
const server = createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); });
await new Promise(r => server.listen(8807, '127.0.0.1', r));

const results = [];
const mark = (id, pass, note = '') => { results.push({ id, pass }); console.log(`${pass ? '  ✓' : '  ✗ FAIL'} ${id}${note ? ' — ' + note : ''}`); };

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) consoleErrors.push(m.text().slice(0, 200)); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + String(e).slice(0, 200)));
await page.evaluateOnNewDocument(() => {
  window.print = () => {};
  const orig = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { if ((this.href || '').startsWith('mailto:')) return; return orig.apply(this, arguments); };
});
await page.goto('http://127.0.0.1:8807/', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('typeof MUTATIONS_DB !== "undefined" && typeof getMPState === "function" && typeof checkTalentPrereqs === "function"', { timeout: 60000 });

const t = async (id, fn) => { try { const r = await page.evaluate(fn); mark(id, r === true || (r && r.pass === true), (r && r.note) || (r === true ? '' : JSON.stringify(r).slice(0, 220))); } catch (e) { mark(id, false, String(e).slice(0, 220)); } };

// A bench character: Strong Hero 1, Con 13 (Tough's key attribute), 20 GM MP.
await page.evaluate(() => {
  window.__mk = (con) => ({
    id: 'probe-mt', name: 'Probe', attrs: [16, 10, con, 10, 10, 10],
    classes: [{ name: 'Strong Hero', tier: 'hero', level: 1 }],
    feats: [], mutations: [], talents: [], totalLvl: 1,
    mpGrants: [{ amount: 20, reason: 'probe bench' }],
  });
  window.__mt = MUTATIONS_DB.find(x => x.name === 'Multi-Talented');
  // A Tough Hero talent with no tree prereqs — the gate under test is the
  // class gate, so pick one whose other prereqs are empty.
  window.__toughStart = TALENTS_DB.find(x => x.hero_class === 'Tough Hero'
    && (!x.prereqs || x.prereqs.length === 0));
});

await t('DB-RECORD-CORRECTED', () => {
  const m = __mt;
  return (!!m && m.mp === 2 && m.mp_step === 1 && m.multi === true
    && /whether or not you have levels/.test(m.benefit)
    && /considered 1st level/.test(m.benefit)
    && /13 or higher/.test(m.benefit)
    && /increases by 1/.test(m.special))
    || { mp: m && m.mp, step: m && m.mp_step, benefit: m && m.benefit.slice(0, 80) };
});
await t('ESCALATING-COST-2-3-4', () => {
  const c = __mk(13);
  const costs = [];
  for (let i = 0; i < 3; i++) {
    const cost = escalatedNextCost(c, __mt);
    costs.push(cost);
    c.mutations.push({ name: 'Multi-Talented', kind: 'advantage', mp: cost });
  }
  const st = getMPState(c);
  return (costs.join(',') === '2,3,4' && st.mutSpent === 9 && st.balance === 11)
    || { costs, spent: st.mutSpent };
});
await t('RESTAMP-ON-REMOVE', () => {
  const c = __mk(13);
  for (let i = 0; i < 3; i++) c.mutations.push({ name: 'Multi-Talented', kind: 'advantage', mp: escalatedNextCost(c, __mt) });
  c.mutations.splice(0, 1); // drop the 2-MP copy of three
  restampEscalatingCosts(c);
  const mps = c.mutations.map(m => m.mp);
  return (mps.join(',') === '2,3' && getMPState(c).mutSpent === 5) || { mps };
});
await t('RESTAMP-HEALS-LEGACY-FLAT-STAMPS', () => {
  const c = __mk(13); // in-the-wild: three instances all stamped at the flat 2
  for (let i = 0; i < 3; i++) c.mutations.push({ name: 'Multi-Talented', kind: 'advantage', mp: 2 });
  const st = getMPState(c); // the ledger restamps before summing
  return (st.mutSpent === 9 && c.mutations.map(m => m.mp).join(',') === '2,3,4')
    || { spent: st.mutSpent, mps: c.mutations.map(m => m.mp) };
});
await t('ADVANTAGE-OPENS-CROSS-CLASS', () => {
  if (!__toughStart) return { note: 'no prereq-free Tough Hero talent found' };
  const c = __mk(13);
  c.mutations.push({ name: 'Multi-Talented', kind: 'advantage', mp: 2 });
  const r = checkTalentPrereqs(__toughStart.n, c);
  const classGated = r.missing.some(m => /Requires a level in Tough Hero/.test(m));
  return (!classGated) || { talent: __toughStart.n, missing: r.missing };
});
await t('CROSS-CLASS-NEEDS-ATTR-13', () => {
  if (!__toughStart) return { note: 'no prereq-free Tough Hero talent found' };
  const c = __mk(10); // Con 10 — does NOT qualify for Tough Hero
  c.mutations.push({ name: 'Multi-Talented', kind: 'advantage', mp: 2 });
  const r = checkTalentPrereqs(__toughStart.n, c);
  const gate = r.missing.find(m => /Multi-Talented/.test(m) && /CON 13\+/.test(m));
  return (!!gate) || { missing: r.missing };
});
await t('FEAT-PATH-STILL-WORKS', () => {
  if (!__toughStart) return { note: 'no prereq-free Tough Hero talent found' };
  const c = __mk(13);
  c.feats.push({ name: 'Multi-Talented' });
  const r = checkTalentPrereqs(__toughStart.n, c);
  return (!r.missing.some(m => /Requires a level in Tough Hero/.test(m))) || { missing: r.missing };
});
await t('BUDGET-COUNTS-INSTANCES', () => {
  const c = __mk(13);
  c.mutations.push({ name: 'Multi-Talented', kind: 'advantage', mp: 2 });
  c.mutations.push({ name: 'Multi-Talented', kind: 'advantage', mp: 3 });
  const b = getTalentBudget(c);
  return (b.bonusGrants >= 2 && b.totalOwed >= 3) || { bonusGrants: b.bonusGrants, owed: b.totalOwed };
});
await t('CATALOG-SHOWS-ALL-TREES', () => {
  // The tree-visibility resolver keys off feat OR mutation; assert the source
  // text wired the mutation in (functional path exercises the DOM render).
  const src = document.documentElement.outerHTML;
  return /ownedFeats\.has\('Multi-Talented'\) \|\| \(c\.mutations \|\| \[\]\)\.some\(m => m\.name === 'Multi-Talented'\)/.test(src) || { note: 'tree-visibility gate missing the mutation path' };
});
await t('VERSION-STAMPED', () => {
  return (CG_VERSION === 'v9.20.1' && document.querySelector('.site-subtitle').textContent.includes('v9.20.1'))
    || { v: CG_VERSION };
});
mark('CONSOLE-CLEAN', consoleErrors.length === 0, consoleErrors[0] || '');

const passed = results.filter(r => r.pass).length;
console.log(`\n== MULTI-TALENTED PROBE: ${passed}/${results.length} ==`);
await browser.close();
server.close();
process.exit(passed === results.length ? 0 : 1);
