// _probe_suffix_stragglers.mjs — v9.20.3 (§287) targeted probe.
// Field bug (Adam's 40K table, 2026-11-07): Dedicated Hero charged
// cross-class for Treat Injury. Two CLASS_SKILLS strings carried stray
// key-ability suffixes from the v8.1.5 auto-extraction — "Treat Injury
// (Wis)" and Smart Hero's "Search (Int)" — which the exact-name matcher
// can never hit. This probe guards the repaired strings and the pricing.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __dir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(process.env.CG_FILE || resolve(__dir, '../index.html'), 'utf8');
const server = createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); });
await new Promise(r => server.listen(8813, '127.0.0.1', r));

const results = [];
const mark = (id, pass, note = '') => { results.push({ id, pass }); console.log(`${pass ? '  ✓' : '  ✗ FAIL'} ${id}${note ? ' — ' + note : ''}`); };

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) consoleErrors.push(m.text().slice(0, 200)); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + String(e).slice(0, 200)));
await page.evaluateOnNewDocument(() => { window.print = () => {}; });
await page.goto('http://127.0.0.1:8813/', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('typeof isClassSkill === "function" && typeof CLASS_SKILLS !== "undefined"', { timeout: 60000 });

const t = async (id, fn) => { try { const r = await page.evaluate(fn); mark(id, r === true || (r && r.pass === true), (r && r.note) || (r === true ? '' : JSON.stringify(r).slice(0, 200))); } catch (e) { mark(id, false, String(e).slice(0, 200)); } };

await page.evaluate(() => {
  window.__mkHero = (cls) => ({
    id: 'probe-suffix', name: 'Probe', attrs: [10, 10, 10, 10, 14, 10],
    classes: [{ name: cls, tier: 'hero', level: 1 }],
    feats: [], mutations: [], talents: [], powers: [], skills: {}, totalLvl: 1,
  });
});

await t('STRINGS-REPAIRED', () => {
  const dh = CLASS_SKILLS['Dedicated Hero'], sh = CLASS_SKILLS['Smart Hero'];
  const clean = dh.includes('Treat Injury') && !dh.some(s => s.startsWith('Treat Injury (')) &&
                sh.includes('Search') && !sh.some(s => s.startsWith('Search ('));
  return clean || { dh: dh.filter(s => /Treat/.test(s)), sh: sh.filter(s => /Search/.test(s)) };
});
await t('NO-ATTR-SUFFIX-ANYWHERE', () => {
  const bad = [];
  for (const [k, v] of Object.entries(CLASS_SKILLS)) {
    if (!Array.isArray(v)) continue;
    for (const s of v) if (/\((Str|Dex|Con|Int|Wis|Cha)\)$/.test(s)) bad.push(k + ': ' + s);
  }
  return bad.length === 0 || { bad };
});
await t('DEDICATED-TREAT-INJURY-IS-CLASS', () => {
  return !!isClassSkill('Treat Injury', __mkHero('Dedicated Hero')) || { src: isClassSkill('Treat Injury', __mkHero('Dedicated Hero')) };
});
await t('SMART-SEARCH-IS-CLASS', () => {
  return !!isClassSkill('Search', __mkHero('Smart Hero')) || { src: isClassSkill('Search', __mkHero('Smart Hero')) };
});
await t('CROSS-CLASS-STILL-CROSS', () => {
  // control: Strong Hero has neither — the fix must not over-grant
  const c = __mkHero('Strong Hero');
  return (!isClassSkill('Treat Injury', c) && !isClassSkill('Search', c))
    || { ti: isClassSkill('Treat Injury', c), se: isClassSkill('Search', c) };
});
await t('VERSION-STAMPED', () => {
  return (CG_VERSION === 'v9.20.3' && document.querySelector('.site-subtitle').textContent.includes('v9.20.3'))
    || { v: CG_VERSION };
});
mark('CONSOLE-CLEAN', consoleErrors.length === 0, consoleErrors[0] || '');

const passed = results.filter(r => r.pass).length;
console.log(`\n== SUFFIX-STRAGGLERS PROBE: ${passed}/${results.length} ==`);
await browser.close();
server.close();
process.exit(passed === results.length ? 0 : 1);
