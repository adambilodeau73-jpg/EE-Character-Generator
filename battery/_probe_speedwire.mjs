// _probe_speedwire.mjs — v9.10.0 targeted probe (§263): the Speed cell
// learns to fly, and the re-cased enchantment catalogue never orphans an
// owned item. Six checks: super-power Fly in computeSpeeds' modes, the
// nullified suppression, Longstrider's walk bonus, Haste's per-mode +30′
// capped at ×2, a buff-granted mode while active, and the case-insensitive
// magic lookup fallback.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __dir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(__dir, '../index.html'));
const server = createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); });
await new Promise(r => server.listen(8784, '127.0.0.1', r));

const results = [];
const mark = (id, pass, note = '') => { results.push({ id, pass }); console.log(`${pass ? '  ✓' : '  ✗ FAIL'} ${id}${note ? ' — ' + note : ''}`); };

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) consoleErrors.push(m.text().slice(0, 200)); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + String(e).slice(0, 200)));
await page.goto('http://127.0.0.1:8784/', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('typeof chars !== "undefined" && typeof computeSpeeds === "function" && typeof saveCharacter === "function"', { timeout: 60000 });

const t = async (id, fn) => { try { const r = await page.evaluate(fn); mark(id, r === true || (r && r.pass === true), (r && r.note) || (r === true ? '' : JSON.stringify(r).slice(0, 300))); } catch (e) { mark(id, false, String(e).slice(0, 300)); } };

await t('CREATE-TYTYVYLLUS-STAND-IN', async () => {
  gateState = 'sandbox';
  _firstSaveConfirmed = true;
  window.confirmModal = async () => true;
  document.getElementById('c-name').value = 'Speed Probe';
  formClasses.length = 0;
  formClasses.push({ name: 'Charismatic Hero', tier: 'hero', level: 1 });
  await saveCharacter();
  const c = chars.find(x => x.name === 'Speed Probe');
  return (!!c && c.id === curId) || { found: !!c };
});

await t('SUPER-FLY-IN-MODES', () => {
  const c = chars.find(x => x.id === curId);
  c.powers = [{ name: 'Fly', pool: 'super', mp: 8 }];
  const s = computeSpeeds(c);
  const m = s.modes.find(x => x.type === 'Fly');
  return (!!m && m.speed === 60 && /super-power, at will/.test(m.note)) || { modes: s.modes };
});

await t('NULLIFIED-SUPPRESSES-SUPER-FLY', () => {
  const c = chars.find(x => x.id === curId);
  c.nullified = true;
  const s = computeSpeeds(c);
  const gone = !s.modes.some(x => x.type === 'Fly');
  const noted = s.parts.some(p => /Fly suppressed \(nullified\)/.test(p));
  c.nullified = false;
  return (gone && noted) || { modes: s.modes, parts: s.parts.slice(-3) };
});

await t('LONGSTRIDER-WALK-BONUS', () => {
  const c = chars.find(x => x.id === curId);
  const base = computeSpeeds(c).walk;
  c.activeEffects = [{ id: 'ae-p1', name: 'Longstrider', pool: 'arcane', effects: [] }];
  const s = computeSpeeds(c);
  c.activeEffects = [];
  return (s.walk === base + 10) || { base, got: s.walk };
});

await t('HASTE-PER-MODE-CAPPED', () => {
  const c = chars.find(x => x.id === curId);
  // Walk 30 → 60 (+30 ≤ ×2). Super Fly 60 → 90. Ectoplasmic buff 20 → 40 (cap: +20, ×2).
  c.activeEffects = [
    { id: 'ae-p2', name: 'Haste', pool: 'arcane', effects: [] },
    { id: 'ae-p3', name: 'Ectoplasmic Form', pool: 'psionic', effects: [] },
  ];
  const s = computeSpeeds(c);
  c.activeEffects = [];
  const fly = s.modes.find(x => x.type === 'Fly' && /super-power/.test(x.note));
  const ecto = s.modes.find(x => /Ectoplasmic/.test(x.note));
  return (s.walk === 60 && !!fly && fly.speed === 90 && !!ecto && ecto.speed === 40)
    || { walk: s.walk, fly: fly && fly.speed, ecto: ecto && ecto.speed, modes: s.modes };
});

await t('BUFF-MODE-ONLY-WHILE-ACTIVE', () => {
  const c = chars.find(x => x.id === curId);
  c.powers = [];  // no super Fly now
  c.activeEffects = [{ id: 'ae-p4', name: 'Overland Flight', pool: 'arcane', effects: [] }];
  const during = computeSpeeds(c).modes.some(x => x.type === 'Fly' && x.speed === 40 && /active/.test(x.note));
  c.activeEffects = [];
  const after = computeSpeeds(c).modes.some(x => x.type === 'Fly');
  return (during && !after) || { during, after };
});

await t('LEGACY-CASING-LOOKUP-FALLBACK', () => {
  const exact = getCatalogueEntry('magic', 'Chainsaw of the Psycho +1');
  const legacy = getCatalogueEntry('magic', 'Chainsaw of the psycho +1');
  return (!!exact && !!legacy && exact === legacy) || { exact: !!exact, legacy: !!legacy };
});

await browser.close();
server.close();
const fails = results.filter(r => !r.pass);
console.log(`\n== SPEED-WIRE PROBE ${fails.length ? 'RED' : 'GREEN'} == ${results.length - fails.length}/${results.length} checks passed · ${consoleErrors.length} console errors`);
if (consoleErrors.length) console.log(consoleErrors.slice(0, 5).join('\n'));
process.exit(fails.length || consoleErrors.length ? 1 : 0);
