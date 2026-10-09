// _probe_svtalent.mjs — v9.9.3 targeted probe: THE SUPER-VILLAIN'S
// UNREACHABLE TALENT (§262). GMG p.183: at Super-Hero/Villain 2 and 4 the
// "Bonus Feat or Talent" may be a Talent from ANY Hero class with 13+ in
// its associated attribute (treated as 1st level). The budget side has
// been wired since v8.11.1 (heroTalentFlex); checkTalentPrereqs' class
// gate only knew Multi-Talented, so cross-class talents rendered Locked.
// This probe asserts the gate now opens for the flex classes — and ONLY
// under the book's conditions.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __dir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(__dir, '../index.html'));
const server = createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); });
await new Promise(r => server.listen(8783, '127.0.0.1', r));

const results = [];
const mark = (id, pass, note = '') => { results.push({ id, pass }); console.log(`${pass ? '  ✓' : '  ✗ FAIL'} ${id}${note ? ' — ' + note : ''}`); };

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) consoleErrors.push(m.text().slice(0, 200)); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + String(e).slice(0, 200)));
await page.goto('http://127.0.0.1:8783/', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('typeof chars !== "undefined" && typeof saveCharacter === "function" && typeof checkTalentPrereqs === "function"', { timeout: 60000 });

await page.evaluate(() => { window._pickBare = (hc) => { const t = TALENTS_DB.find(x => x.hero_class === hc && (!x.prereqs || !x.prereqs.length) && !/Super-Talent/.test(x.tier || '')); return t && t.n; }; });

const t = async (id, fn) => { try { const r = await page.evaluate(fn); mark(id, r === true || (r && r.pass === true), (r && r.note) || (r === true ? '' : JSON.stringify(r).slice(0, 300))); } catch (e) { mark(id, false, String(e).slice(0, 300)); } };

// ---- Step 1: the nemesis chassis — Charismatic Hero 1, CHA-forward ----
await t('CREATE-NEMESIS', async () => {
  gateState = 'sandbox';
  _firstSaveConfirmed = true;
  window.confirmModal = async () => true;
  document.getElementById('c-name').value = 'SV Talent Probe';
  formClasses.length = 0;
  formClasses.push({ name: 'Charismatic Hero', tier: 'hero', level: 1 });
  await saveCharacter();
  const c = chars.find(x => x.name === 'SV Talent Probe');
  if (!c) return { note: 'no char' };
  // Attribute spread for the gate tests: CON 14 (Tough-eligible),
  // STR 10 (Strong-ineligible), CHA 15.
  c.attrs = [10, 10, 14, 10, 10, 15];
  return c.id === curId || { curId, id: c.id };
});

// Helper exposed per-test: pick a cross-class talent with NO prereq groups
// from the given tree, so only the class gate is in play.
const PICK = `(hc) => {
  const t = TALENTS_DB.find(x => x.hero_class === hc && (!x.prereqs || !x.prereqs.length) && !/Super-Talent/.test(x.tier || ''));
  return t && t.n;
}`;

// ---- Step 2: CONTROL — no flex class: cross-class stays Locked ----
await t('CONTROL-NO-FLEX-LOCKED', async () => {
  const c = chars.find(x => x.id === curId);
  const pick = window._pickBare('Tough Hero');
  if (!pick) return { note: 'no bare Tough talent found' };
  const r = checkTalentPrereqs(pick, c);
  const lockedRight = !r.met && r.missing.some(m => /Requires a level in Tough Hero/.test(m)) && !r.missing.some(m => /cross-class/.test(m));
  return lockedRight || { pick, r };
});

// ---- Step 3: Super-Villain 2 + CON 14 → the Tough talent QUALIFIES ----
await t('SV2-CROSS-CLASS-QUALIFIES', async () => {
  const c = chars.find(x => x.id === curId);
  c.classes.push({ name: 'Super-Villain', tier: 'prestige', level: 2 });
  const pick = window._pickBare('Tough Hero');
  const r = checkTalentPrereqs(pick, c);
  return r.met === true || { pick, r };
});

// ---- Step 4: attribute floor — STR 10 keeps Strong talents Locked,
//      and the Locked reason now NAMES the flex path in ----
await t('SV2-ATTR-BELOW-13-LOCKED-WITH-HINT', async () => {
  const c = chars.find(x => x.id === curId);
  const pick = window._pickBare('Strong Hero');
  if (!pick) return { note: 'no bare Strong talent found' };
  const r = checkTalentPrereqs(pick, c);
  const hinted = !r.met && r.missing.some(m => /STR 13\+ to take it cross-class/.test(m));
  return hinted || { pick, r };
});

// ---- Step 5: Super-Villain 1 is NOT enough (flex starts at 2nd) ----
await t('SV1-NOT-ENOUGH', async () => {
  const c = chars.find(x => x.id === curId);
  const sv = c.classes.find(e => e.name === 'Super-Villain');
  sv.level = 1;
  const pick = window._pickBare('Tough Hero');
  const r = checkTalentPrereqs(pick, c);
  sv.level = 2;  // restore for step 6
  return (!r.met && r.missing.some(m => /Requires a level in Tough Hero/.test(m))) || { pick, r };
});

// ---- Step 6: the budget converts the flex slot when the talent is taken ----
await t('BUDGET-FLEX-CONVERSION', async () => {
  const c = chars.find(x => x.id === curId);
  const chaPick = window._pickBare('Charismatic Hero');
  const toughPick = window._pickBare('Tough Hero');
  c.talents = [{ name: chaPick }, { name: toughPick }];
  const b = getTalentBudget(c);
  // Charismatic 1 owes 1 slot; the second talent rides the SV2 flex:
  // totalOwed should rise to 2 (flexUsed 1), leaving the pick in balance.
  return (b.totalOwed === 2 && b.totalPicked === 2 && b.remaining === 0) || b;
});

await browser.close();
server.close();
const fails = results.filter(r => !r.pass);
console.log(`\n== SV-TALENT PROBE ${fails.length ? 'RED' : 'GREEN'} == ${results.length - fails.length}/${results.length} checks passed · ${consoleErrors.length} console errors`);
if (consoleErrors.length) console.log(consoleErrors.slice(0, 5).join('\n'));
process.exit(fails.length || consoleErrors.length ? 1 : 0);
