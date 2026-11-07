// _probe_grenades.mjs — v9.20.4 (§288) targeted probe: THE SIMPLE TRUTH.
// HH: every explosives table at every Tech Scale (4/5, 6, 7, 8) is headed
// "Explosives (Simple)", and the Hand Grenade entry says "No proficiency is
// necessary to throw a grenade." Six TL6/TL7 grenades were miscategorized
// Martial by the v8.1.5 extraction. Launchers are unchanged: Grenade
// Launcher = Exotic firearm (EFP group), Mini-Grenade Launcher = Personal
// Firearms (PFP).
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __dir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(process.env.CG_FILE || resolve(__dir, '../index.html'), 'utf8');
const server = createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); });
await new Promise(r => server.listen(8815, '127.0.0.1', r));

const results = [];
const mark = (id, pass, note = '') => { results.push({ id, pass }); console.log(`${pass ? '  ✓' : '  ✗ FAIL'} ${id}${note ? ' — ' + note : ''}`); };

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) consoleErrors.push(m.text().slice(0, 200)); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + String(e).slice(0, 200)));
await page.evaluateOnNewDocument(() => { window.print = () => {}; });
await page.goto('http://127.0.0.1:8815/', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('typeof isProficientWithWeapon === "function" && typeof WEAPONS !== "undefined"', { timeout: 60000 });

const t = async (id, fn) => { try { const r = await page.evaluate(fn); mark(id, r === true || (r && r.pass === true), (r && r.note) || (r === true ? '' : JSON.stringify(r).slice(0, 200))); } catch (e) { mark(id, false, String(e).slice(0, 200)); } };

await t('ALL-THROWN-GRENADES-SIMPLE', () => {
  const thrown = WEAPONS.filter(w => /grenade/i.test(w.n) && !/launcher/i.test(w.n));
  const bad = thrown.filter(w => w.cat !== 'Simple').map(w => w.n + ':' + w.cat);
  return (thrown.length === 10 && bad.length === 0) || { count: thrown.length, bad };
});
await t('FEATLESS-HERO-THROWS-EVERY-GRENADE', () => {
  const c = { id: 'p', name: 'P', attrs: [10,10,10,10,10,10], classes: [{ name: 'Charismatic Hero', tier: 'hero', level: 1 }], feats: [], mutations: [], talents: [], powers: [], totalLvl: 1 };
  const thrown = WEAPONS.filter(w => /grenade/i.test(w.n) && !/launcher/i.test(w.n));
  const blocked = thrown.filter(w => !isProficientWithWeapon(c, w.n)).map(w => w.n);
  return blocked.length === 0 || { blocked };
});
await t('LAUNCHERS-STILL-GATED', () => {
  const c = { id: 'p', name: 'P', attrs: [10,10,10,10,10,10], classes: [{ name: 'Charismatic Hero', tier: 'hero', level: 1 }], feats: [], mutations: [], talents: [], powers: [], totalLvl: 1 };
  const gl = !isProficientWithWeapon(c, 'Grenade Launcher');
  const mgl = !isProficientWithWeapon(c, 'Mini-Grenade Launcher');
  const pfp = isProficientWithWeapon({ ...c, feats: [{ name: 'Personal Firearms Proficiency' }] }, 'Mini-Grenade Launcher');
  return (gl && mgl && pfp) || { gl, mgl, pfp };
});
await t('VERSION-STAMPED', () => {
  return (CG_VERSION === 'v9.20.4' && document.querySelector('.site-subtitle').textContent.includes('v9.20.4'))
    || { v: CG_VERSION };
});
mark('CONSOLE-CLEAN', consoleErrors.length === 0, consoleErrors[0] || '');

const passed = results.filter(r => r.pass).length;
console.log(`\n== GRENADES PROBE: ${passed}/${results.length} ==`);
await browser.close();
server.close();
process.exit(passed === results.length ? 0 : 1);
