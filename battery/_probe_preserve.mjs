// _probe_preserve.mjs — v9.9.2 targeted probe: THE EDIT-SAVE PRESERVATION
// AUDIT (§261). The wipe trap bit twice (v8.5.4, §260 'cybernetics'/
// 'activeEffects'); this probe closes the audit by round-tripping a real
// character through editCurrentChar() → saveCharacter() with every §261
// runtime field stamped, asserting each one survives — and asserting the
// ledger convention held: conDmgHpApplied is NOT preserved but re-derived,
// the rebuilt maxHP re-debited, the preserved currentHP NOT double-charged.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __dir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(__dir, '../index.html'));
const server = createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); });
await new Promise(r => server.listen(8782, '127.0.0.1', r));

const results = [];
const mark = (id, pass, note = '') => { results.push({ id, pass }); console.log(`${pass ? '  ✓' : '  ✗ FAIL'} ${id}${note ? ' — ' + note : ''}`); };

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) consoleErrors.push(m.text().slice(0, 200)); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + String(e).slice(0, 200)));
await page.goto('http://127.0.0.1:8782/', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('typeof chars !== "undefined" && typeof saveCharacter === "function" && typeof editCurrentChar === "function"', { timeout: 60000 });

const t = async (id, fn) => { try { const r = await page.evaluate(fn); mark(id, r === true || (r && r.pass === true), (r && r.note) || (r === true ? '' : JSON.stringify(r).slice(0, 300))); } catch (e) { mark(id, false, String(e).slice(0, 300)); } };

// ---- Step 1: create a real character through the live Create-form save ----
await t('CREATE-VIA-SAVECHARACTER', async () => {
  gateState = 'sandbox';
  _firstSaveConfirmed = true;
  window.confirmModal = async () => true;  // auto-accept prereq warnings
  document.getElementById('c-name').value = 'Preserve Probe';
  formClasses.length = 0;
  formClasses.push({ name: 'Strong Hero', tier: 'hero', level: 1 });
  await saveCharacter();
  const c = chars.find(x => x.name === 'Preserve Probe');
  return (!!c && c.id === curId && c.totalLvl === 1) || { found: !!c, curId, lvl: c && c.totalLvl };
});

// ---- Step 2: stamp every §261 runtime field + ledger sentinels ----
await t('STAMP-RUNTIME-FIELDS', () => {
  const c = chars.find(x => x.id === curId); if (!c) return { note: 'no char' };
  // §261 additions — the thirteen fields the audit added to the merge list.
  c.attrDmg = [0, 0, 2, 0, 0, 0];           // 2 Con damage…
  reconcileConDamageHP(c);                   // …debited live, like the Tracker does
  c.nlDmg = 7;
  c.battleFocused = true;
  c.psiFocused = true;
  c.combatDecl = { bd: 2, ro: true };
  c.mdtAdj = -3;
  c.mcReserve = { balance: 120, grantedFor: 3 };
  c.careerGoal = 'Techsmith';
  c.mentalPinnacle = { picks: ['Probe Pick'], chosenAt: 'probe' };
  c.mind = { per: { arcane: 5, divine: 0, mutation: 0, psionic: 0, tech: 0 }, probeTag: 'inured-probe' };
  c.secondSkin = { level: 2 };
  c.hpAutoAssigned = { atDate: 'probe', how: 'probe' };
  c._natACDismissed = 'Human:0';
  // §260 regression sentinels (already preserved — must stay that way).
  // Shaped like the real records so the post-save Sheet render walks them.
  c.cybernetics = [{ n: 'Probe Implant' }];
  c.activeEffects = [{ name: 'Probe Boon', effects: [] }];
  save();
  window._preEditRef = c;  // the merge replaces the record — identity must change
  window._probeSnap = { maxHP: c.maxHP, currentHP: c.currentHP, conLedger: c.conDmgHpApplied };
  return (c.conDmgHpApplied > 0 && c.maxHP > 0) || { ledger: c.conDmgHpApplied, maxHP: c.maxHP };
});

// ---- Step 3: the edit-save round trip (the trap's own path) ----
await t('EDIT-SAVE-ROUNDTRIP', async () => {
  editCurrentChar();
  await saveCharacter();
  const c = chars.find(x => x.name === 'Preserve Probe');
  // editId cleared AND the record is a freshly assembled object (identity
  // changed) — proof the merge path actually ran, not a vacuous no-op.
  return (!!c && editId === null && c !== window._preEditRef) || { found: !!c, editId, rebuilt: c !== window._preEditRef };
});

// ---- Step 4: every §261 field survived ----
await t('SURVIVAL-ALL-13-FIELDS', () => {
  const c = chars.find(x => x.name === 'Preserve Probe'); if (!c) return { note: 'no char' };
  const bad = [];
  if (!Array.isArray(c.attrDmg) || c.attrDmg[2] !== 2) bad.push('attrDmg');
  if (c.nlDmg !== 7) bad.push('nlDmg');
  if (c.battleFocused !== true) bad.push('battleFocused');
  if (c.psiFocused !== true) bad.push('psiFocused');
  if (!c.combatDecl || c.combatDecl.bd !== 2 || c.combatDecl.ro !== true) bad.push('combatDecl');
  if (c.mdtAdj !== -3) bad.push('mdtAdj');
  if (!c.mcReserve || c.mcReserve.balance !== 120) bad.push('mcReserve');
  if (c.careerGoal !== 'Techsmith') bad.push('careerGoal');
  if (!c.mentalPinnacle || c.mentalPinnacle.picks[0] !== 'Probe Pick') bad.push('mentalPinnacle');
  if (!c.mind || c.mind.probeTag !== 'inured-probe' || !c.mind.per || c.mind.per.arcane !== 5) bad.push('mind');
  if (!c.secondSkin || c.secondSkin.level !== 2) bad.push('secondSkin');
  if (!c.hpAutoAssigned || c.hpAutoAssigned.atDate !== 'probe') bad.push('hpAutoAssigned');
  if (c._natACDismissed !== 'Human:0') bad.push('_natACDismissed');
  return bad.length === 0 || { wiped: bad };
});

// ---- Step 5: §260 sentinels still preserved (regression) ----
await t('SURVIVAL-260-SENTINELS', () => {
  const c = chars.find(x => x.name === 'Preserve Probe'); if (!c) return { note: 'no char' };
  return (Array.isArray(c.cybernetics) && c.cybernetics[0] && c.cybernetics[0].n === 'Probe Implant'
       && Array.isArray(c.activeEffects) && c.activeEffects[0] && c.activeEffects[0].name === 'Probe Boon')
    || { cyb: c.cybernetics, ae: c.activeEffects };
});

// ---- Step 6: the ledger convention — re-derived, not preserved; no double-debit ----
await t('CON-LEDGER-REBAKED-NOT-PRESERVED', () => {
  const c = chars.find(x => x.name === 'Preserve Probe'); if (!c) return { note: 'no char' };
  const snap = window._probeSnap;
  // The ledger must equal the live-derived value again (re-baked onto the
  // fresh maxHP), the rebuilt maxHP must carry the same debit as before the
  // edit, and the preserved currentHP must NOT have been debited a second time.
  return (c.conDmgHpApplied === snap.conLedger
       && c.maxHP === snap.maxHP
       && c.currentHP === snap.currentHP)
    || { ledger: [snap.conLedger, c.conDmgHpApplied], maxHP: [snap.maxHP, c.maxHP], currentHP: [snap.currentHP, c.currentHP] };
});

await browser.close();
server.close();

const fails = results.filter(r => !r.pass).length;
console.log(`\n_probe_preserve: ${results.length - fails}/${results.length} green${fails ? ` — ${fails} FAILED` : ''}`);
if (consoleErrors.length) { console.log('console errors:'); consoleErrors.forEach(e => console.log('  ' + e)); }
process.exit(fails || consoleErrors.length ? 1 : 0);
