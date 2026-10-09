// _probe_magicdesc.mjs — v9.10.1 targeted probe (§264): every hand cursor
// earns its drop-down. Modern items carry their harvested GMG text, the
// Tempus mis-description is gone, potions/wands derive from SPELLS_DB,
// and the renamed Air Duct Infiltration Suit resolves under its old name.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __dir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(__dir, '../index.html'));
const server = createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); });
await new Promise(r => server.listen(8785, '127.0.0.1', r));

const results = [];
const mark = (id, pass, note = '') => { results.push({ id, pass }); console.log(`${pass ? '  ✓' : '  ✗ FAIL'} ${id}${note ? ' — ' + note : ''}`); };

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) consoleErrors.push(m.text().slice(0, 200)); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + String(e).slice(0, 200)));
await page.goto('http://127.0.0.1:8785/', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('typeof MAGIC_ITEMS_DB !== "undefined" && typeof magicItemDesc === "function"', { timeout: 60000 });

const t = async (id, fn) => { try { const r = await page.evaluate(fn); mark(id, r === true || (r && r.pass === true), (r && r.note) || (r === true ? '' : JSON.stringify(r).slice(0, 300))); } catch (e) { mark(id, false, String(e).slice(0, 300)); } };

await t('NO-MODERN-ITEM-LACKS-TEXT', () => {
  const bare = MAGIC_ITEMS_DB.filter(m => m.type === 'modern' && !magicItemDesc(m));
  return bare.length === 0 || { bare: bare.map(m => m.name) };
});

await t('DECODER-RING-HAS-GMG-TEXT', () => {
  const m = MAGIC_ITEMS_DB.find(x => x.name === 'Decoder Ring');
  return (!!m && /cheap-looking tin ring/.test(m.d || '') && /Decipher/.test(m.d)) || { d: m && (m.d || '').slice(0, 80) };
});

await t('CHAINSAW-TIERS-SHARE-THE-PARAGRAPH', () => {
  const tiers = ['+1', '+2', '+3'].map(s => MAGIC_ITEMS_DB.find(x => x.name === 'Chainsaw of the Psycho ' + s));
  return tiers.every(m => m && /chain saw/i.test(m.d || '')) || { got: tiers.map(m => m && (m.d || '').slice(0, 40)) };
});

await t('TEMPUS-MISDESCRIPTION-REPLACED', () => {
  const m = MAGIC_ITEMS_DB.find(x => x.name === 'Tempus Fugit Watch');
  return (!!m && /antique gold pocket watch/.test(m.d || '') && !/brooch/.test(m.d)) || { d: m && (m.d || '').slice(0, 80) };
});

await t('POTION-DERIVES-FROM-SPELL', () => {
  const m = MAGIC_ITEMS_DB.find(x => x.name === 'Cure Light Wounds (Potion)');
  const d = m && magicItemDesc(m);
  return (!!d && /carrying the spell Cure Light Wounds/.test(d) && !/see its entry/.test(d) && d.length > 120) || { d: d && d.slice(0, 100) };
});

await t('WAND-DERIVES-FROM-SPELL', () => {
  const m = MAGIC_ITEMS_DB.find(x => x.name === 'Burning Hands' && x.type === 'wand');
  const d = m && magicItemDesc(m);
  return (!!d && /charged wand carrying the spell Burning Hands/.test(d)) || { d: d && d.slice(0, 100) };
});

await t('MERGED-DETECT-SPELL-DERIVES', () => {
  const m = MAGIC_ITEMS_DB.find(x => x.name === 'Detect Magic & Psionics');
  const d = m && magicItemDesc(m);
  return (!!d && /charged wand carrying the spell Detect Magic & Psionics: You detect/.test(d)) || { d: d && d.slice(0, 100) };
});

await t('AIR-DUCT-RENAME-PLUS-ALIAS', () => {
  const byNew = getCatalogueEntry('magic', 'Air Duct Infiltration Suit');
  const byOld = getCatalogueEntry('magic', 'Air duct filtration suit');
  return (!!byNew && byNew === byOld && /gaseous form/.test(byNew.d || '')) || { byNew: !!byNew, aliased: byNew === byOld };
});

await browser.close();
server.close();
const fails = results.filter(r => !r.pass);
console.log(`\n== MAGIC-DESC PROBE ${fails.length ? 'RED' : 'GREEN'} == ${results.length - fails.length}/${results.length} checks passed · ${consoleErrors.length} console errors`);
if (consoleErrors.length) console.log(consoleErrors.slice(0, 5).join('\n'));
process.exit(fails.length || consoleErrors.length ? 1 : 0);
