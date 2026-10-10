// _probe_cybertaker.mjs — v9.11.1 targeted probe (§266): Cybertaker raises
// the cybernetics cap (HH p.209, +1 each, stacks), including when granted
// by another feat (Adam's Forge World Heritage), and the negative-level
// machinery recomputes off the new cap.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __dir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(__dir, '../index.html'));
const server = createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); });
await new Promise(r => server.listen(8787, '127.0.0.1', r));

const results = [];
const mark = (id, pass, note = '') => { results.push({ id, pass }); console.log(`${pass ? '  ✓' : '  ✗ FAIL'} ${id}${note ? ' — ' + note : ''}`); };

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) consoleErrors.push(m.text().slice(0, 200)); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + String(e).slice(0, 200)));
await page.goto('http://127.0.0.1:8787/', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('typeof chars !== "undefined" && typeof cyberMax === "function" && typeof saveCharacter === "function"', { timeout: 60000 });

const t = async (id, fn) => { try { const r = await page.evaluate(fn); mark(id, r === true || (r && r.pass === true), (r && r.note) || (r === true ? '' : JSON.stringify(r).slice(0, 300))); } catch (e) { mark(id, false, String(e).slice(0, 300)); } };

await t('CREATE-FORGE-WORLDER', async () => {
  gateState = 'sandbox';
  _firstSaveConfirmed = true;
  window.confirmModal = async () => true;
  document.getElementById('c-name').value = 'Forge Probe';
  formClasses.length = 0;
  formClasses.push({ name: 'Tough Hero', tier: 'hero', level: 1 });
  await saveCharacter();
  const c = chars.find(x => x.name === 'Forge Probe');
  if (!c) return { note: 'no char' };
  c.attrs = [10, 10, 16, 10, 10, 10];   // Con 16 — Adam's reported baseline
  return cyberMax(c) === 4 || { max: cyberMax(c) };
});

await t('GRANTED-CYBERTAKER-RAISES-CAP', () => {
  const c = chars.find(x => x.id === curId);
  c.feats = c.feats || [];
  c.feats.push({ name: 'Cybertaker', grantedBy: 'Forge World Heritage' });
  return cyberMax(c) === 5 || { max: cyberMax(c) };
});

await t('CYBERTAKER-STACKS', () => {
  const c = chars.find(x => x.id === curId);
  c.feats.push({ name: 'Cybertaker' });  // taken directly, second copy
  return cyberMax(c) === 6 || { max: cyberMax(c) };
});

await t('REMOVAL-DROPS-THE-CAP', () => {
  const c = chars.find(x => x.id === curId);
  c.feats = c.feats.filter(f => (f.name || f.n) !== 'Cybertaker');
  return cyberMax(c) === 4 || { max: cyberMax(c) };
});

await t('EXCESS-RECOMPUTES-OFF-THE-CAP', () => {
  const c = chars.find(x => x.id === curId);
  // Five 1-count attachments vs cap 4 → 1 negative level; the grant clears it.
  c.cybernetics = [{ n: 'Anti-Shock Implant' }, { n: 'External Weapon Mount' }, { n: 'Fortified Skeleton' }, { n: 'Nightvision Optics' }, { n: 'Subcutaneous Cell Phone' }];
  const before = cyberExcess(c);
  c.feats.push({ name: 'Cybertaker', grantedBy: 'Forge World Heritage' });
  const after = cyberExcess(c);
  c.cybernetics = [];
  return (before >= 1 && after === Math.max(0, before - 1)) || { before, after };
});

await t('HEAVY-LEVELS-GRANT-THE-FEAT', () => {
  // §267: Heavy 3 = Cybertaker ×2 (levels 2 and 3), stacking with the
  // Forge World Heritage grant still on the sheet from the excess test.
  const c = chars.find(x => x.id === curId);
  const base = cyberMax(c);  // Con 16 + the one granted copy = 5
  c.classes.push({ name: 'Heavy', tier: 'prestige', level: 3 });
  syncCyberFeats(c);
  const after = cyberMax(c);
  const heavies = (c.feats || []).filter(f => (f.name || f.n) === 'Cybertaker' && /Heavy \(Cybertaker/.test(f.grantedBy || '')).length;
  return (heavies === 2 && after === base + 2) || { base, after, heavies };
});

await t('HEAVY-LEVEL-DOWN-CASCADES', () => {
  const c = chars.find(x => x.id === curId);
  const hv = c.classes.find(e => e.name === 'Heavy');
  hv.level = 2;
  syncCyberFeats(c);
  const atTwo = (c.feats || []).filter(f => (f.name || f.n) === 'Cybertaker' && /Heavy \(Cybertaker/.test(f.grantedBy || '')).length;
  c.classes = c.classes.filter(e => e.name !== 'Heavy');
  syncCyberFeats(c);
  const atZero = (c.feats || []).filter(f => (f.name || f.n) === 'Cybertaker' && /Heavy \(Cybertaker/.test(f.grantedBy || '')).length;
  const heritageSurvives = (c.feats || []).some(f => (f.name || f.n) === 'Cybertaker' && /Forge World/.test(f.grantedBy || ''));
  return (atTwo === 1 && atZero === 0 && heritageSurvives) || { atTwo, atZero, heritageSurvives };
});

await browser.close();
server.close();
const fails = results.filter(r => !r.pass);
console.log(`\n== CYBERTAKER PROBE ${fails.length ? 'RED' : 'GREEN'} == ${results.length - fails.length}/${results.length} checks passed · ${consoleErrors.length} console errors`);
if (consoleErrors.length) console.log(consoleErrors.slice(0, 5).join('\n'));
process.exit(fails.length || consoleErrors.length ? 1 : 0);
