// _probe_pointbuy.mjs — v9.19.1 targeted probe: THE DRAKKIN LEDGER.
// Adam's field report (2026-10-27, building the Psionic-Heritage test hero):
// a Drakkin's Point Buy opened at "Points remaining: 6/20" before a single
// point was spent — updatePB computed spent from the DISPLAYED fields, which
// carry racial adjustments, billing the race's bonuses to the player (and a
// penalty race would have pocketed free points via the same max(0,·)).
// Also: race swaps mid-buy never refreshed the counter; the budget panel
// spoke pure base ("60/80") while the fields showed raced values; and the
// "max 18" cap promised by the toast since v8.1.1 had no checker.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __dir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(process.env.CG_FILE || resolve(__dir, '../index.html'), 'utf8');
const server = createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); });
await new Promise(r => server.listen(8798, '127.0.0.1', r));

const results = [];
const mark = (id, pass, note = '') => { results.push({ id, pass }); console.log(`${pass ? '  ✓' : '  ✗ FAIL'} ${id}${note ? ' — ' + note : ''}`); };

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) consoleErrors.push(m.text().slice(0, 200)); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + String(e).slice(0, 200)));
await page.goto('http://127.0.0.1:8798/', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('typeof chars !== "undefined" && typeof pointBuyStart === "function"', { timeout: 60000 });

const t = async (id, fn) => { try { const r = await page.evaluate(fn); mark(id, r === true || (r && r.pass === true), (r && r.note) || (r === true ? '' : JSON.stringify(r).slice(0, 220))); } catch (e) { mark(id, false, String(e).slice(0, 220)); } };

await page.evaluate(() => { window.print = () => {}; });

// Helpers shared by the tests, installed once.
await page.evaluate(() => {
  window.__pb = {
    remain: () => document.getElementById('pb-remain').textContent,
    budget: () => document.getElementById('attr-budget').innerText.replace(/\s+/g, ' '),
    setRace: (r) => { const sel = document.getElementById('c-race'); sel.value = r; applyRaceAdjustments(r); },
    bump: (i, by) => { const inp = document.getElementById('a' + i); inp.value = (parseInt(inp.value) || 10) + by; onAC(i); },
    adjSum: (r) => getRacialAdj(r).reduce((s, v) => s + v, 0),
  };
  showPage('create'); clearForm();
});

// 1) A race with nonzero adjustments opens at 20/20 (Adam's exact repro).
await t('RACED-PB-OPENS-FULL', () => {
  const race = 'Drakkin', has = !!RACES[race];
  const pick = has ? race : Object.keys(RACES).find(r => __pb.adjSum(r) > 0);
  if (!pick) return { note: 'no positively-adjusted race found' };
  window.__pbRace = pick;
  __pb.setRace(pick); pointBuyStart();
  return __pb.remain() === 'Points remaining: 20/20' || { race: pick, adjSum: __pb.adjSum(pick), remain: __pb.remain() };
});

// 2) Spending 4 base points reads 16/20 regardless of race.
await t('RACED-PB-SPEND', () => {
  __pb.bump(0, 2); __pb.bump(1, 2);
  return __pb.remain() === 'Points remaining: 16/20' || { remain: __pb.remain() };
});

// 3) The budget panel speaks both currencies when racial mods exist.
await t('BUDGET-DUAL-CURRENCY', () => {
  const b = __pb.budget();
  const adjSum = __pb.adjSum(window.__pbRace);
  const dispTarget = 80 + adjSum;
  return (b.includes('total as shown') && b.includes(`/ ${dispTarget}`) && b.includes('base 64/80') && b.includes('Δ -16'))
    || { budget: b.slice(0, 160), expectTarget: dispTarget };
});

// 4) A mid-buy race swap refreshes the counter (gap #2) — swap to Human: same
//    base purchases, still 16/20; panel back to single-currency base form.
await t('RACE-SWAP-REFRESHES', () => {
  __pb.setRace('Human');
  const ok1 = __pb.remain() === 'Points remaining: 16/20';
  const b = __pb.budget();
  return (ok1 && b.includes('base total') && !b.includes('total as shown')) || { remain: __pb.remain(), budget: b.slice(0, 120) };
});

// 5) Human baseline unchanged by the fix: fresh point buy = 20/20, 60/80 Δ −20.
await t('HUMAN-BASELINE-UNCHANGED', () => {
  pointBuyStart();
  const b = __pb.budget();
  return (__pb.remain() === 'Points remaining: 20/20' && b.includes('60') && b.includes('/ 80') && b.includes('Δ -20'))
    || { remain: __pb.remain(), budget: b.slice(0, 120) };
});

// 6) The 18 cap advisory fires on a base-19 purchase and names GM-exception
//    territory; it is advisory copy, not a block.
await t('PB-CAP-ADVISORY', () => {
  __pb.bump(0, 9);   // base 10 → 19
  const v = document.getElementById('attr-violations');
  const txt = (v.innerText || '').toLowerCase();
  return (v.style.display !== 'none' && txt.includes('point-buy cap') && txt.includes('gm-exception'))
    || { shown: v.style.display, txt: txt.slice(0, 140) };
});

// 7) Penalty races refund nothing and charge nothing at open (the max(0,·)
//    asymmetry is now applied to BASE, so a penalty race still opens 20/20).
await t('PENALTY-RACE-OPENS-FULL', () => {
  const pick = Object.keys(RACES).find(r => getRacialAdj(r).some(v => v < 0));
  if (!pick) return { note: 'no penalty race found — vacuous pass', pass: true };
  __pb.setRace(pick); pointBuyStart();
  return __pb.remain() === 'Points remaining: 20/20' || { race: pick, remain: __pb.remain() };
});

await t('VERSION-STAMPED', () => (/^v9\.\d+\.\d+$/.test(CG_VERSION) && document.querySelector('.site-subtitle').textContent.includes(CG_VERSION)) || { CG_VERSION });
mark('CONSOLE-CLEAN', consoleErrors.length === 0, consoleErrors[0] || '');

const passed = results.filter(r => r.pass).length;
console.log(`\n== POINT BUY PROBE: ${passed}/${results.length} ==`);
await browser.close();
server.close();
process.exit(passed === results.length ? 0 : 1);
