// _probe_vehicles.mjs — v9.11.0 targeted probe (§265): the five ported
// sections exist at the book's prices, their drop-downs speak, and the
// imbue-on-the-spot flow stamps what the vessel carries.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __dir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(__dir, '../index.html'));
const server = createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); });
await new Promise(r => server.listen(8786, '127.0.0.1', r));

const results = [];
const mark = (id, pass, note = '') => { results.push({ id, pass }); console.log(`${pass ? '  ✓' : '  ✗ FAIL'} ${id}${note ? ' — ' + note : ''}`); };

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) consoleErrors.push(m.text().slice(0, 200)); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + String(e).slice(0, 200)));
await page.goto('http://127.0.0.1:8786/', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('typeof MAGIC_ITEMS_DB !== "undefined" && typeof addMagicFromBrowse === "function" && typeof saveCharacter === "function"', { timeout: 60000 });

const t = async (id, fn) => { try { const r = await page.evaluate(fn); mark(id, r === true || (r && r.pass === true), (r && r.note) || (r === true ? '' : JSON.stringify(r).slice(0, 300))); } catch (e) { mark(id, false, String(e).slice(0, 300)); } };

await t('SECTION-COUNTS', () => {
  const n = (ty) => MAGIC_ITEMS_DB.filter(m => m.type === ty).length;
  const got = { dorje: n('dorje'), power_stone: n('power_stone'), scroll: n('scroll'), tattoo: n('tattoo'), cognizance_crystal: n('cognizance_crystal') };
  return (got.dorje === 9 && got.power_stone === 9 && got.scroll === 9 && got.tattoo === 3 && got.cognizance_crystal === 9) || got;
});

await t('BOOK-PRICES-SPOT-CHECK', () => {
  const p = (nm) => (MAGIC_ITEMS_DB.find(m => m.name === nm) || {}).price_gp;
  const got = {
    dorje9: p('Dorje (9th-Level Power)'), scroll1: p('Scroll (1st-Level Spell)'),
    tattoo3: p('Imbued Tattoo (3rd-Level Power)'), crystal17: p('Cognizance Crystal (17 PP)'),
    stone5: p('Power Stone (5th-Level Power)'),
  };
  return (got.dorje9 === 688500 && got.scroll1 === 25 && got.tattoo3 === 750 && got.crystal17 === 405000 && got.stone5 === 1125) || got;
});

await t('VEHICLE-DROPDOWNS-SPEAK', () => {
  const kinds = ['dorje', 'power_stone', 'scroll', 'tattoo', 'cognizance_crystal'];
  const bare = kinds.filter(ty => {
    const m = MAGIC_ITEMS_DB.find(x => x.type === ty);
    return !magicItemDesc(m);
  });
  return bare.length === 0 || { bare };
});

await t('CREATE-HOLDER', async () => {
  gateState = 'sandbox';
  _firstSaveConfirmed = true;
  window.confirmModal = async () => true;
  document.getElementById('c-name').value = 'Vessel Probe';
  formClasses.length = 0;
  formClasses.push({ name: 'Smart Hero', tier: 'hero', level: 1 });
  await saveCharacter();
  const c = chars.find(x => x.name === 'Vessel Probe');
  return (!!c && c.id === curId) || { found: !!c };
});

await t('DORJE-IMBUES-ON-THE-SPOT', async () => {
  const c = chars.find(x => x.id === curId);
  let offered = null;
  window.openChoiceModal = (title, opts, res) => { offered = opts; res(opts[0]); };
  window.promptProvenance = async () => 'GM grant (probe)';
  _magicBrowseList = [MAGIC_ITEMS_DB.find(m => m.name === 'Dorje (3rd-Level Power)')];
  await addMagicFromBrowse(0);
  const it = (c.items || []).filter(x => x.catalogue === 'magic' && x.ref === 'Dorje (3rd-Level Power)').pop();
  return (!!it && /^Dorje of /.test(it.customName || '') && it.imbued && it.imbued.kind === 'power' && it.imbued.lvl === 3 && Array.isArray(offered) && offered.length > 0)
    || { it: it && { cn: it.customName, imbued: it.imbued }, offered: offered && offered.length };
});

await t('DORJE-OFFERS-ONLY-PSIONIC-LEVEL-3', () => {
  const c = chars.find(x => x.id === curId);
  const it = (c.items || []).filter(x => x.catalogue === 'magic' && x.ref === 'Dorje (3rd-Level Power)').pop();
  const sp = SPELLS_DB.find(s => s.name === it.imbued.name);
  const PSI = new Set(['Psi/Wld', 'War', 'Telepath', 'Nomad', 'Seer', 'Kineticist', 'Egoist', 'Shaper']);
  const psiLvls = (sp.levels || []).filter(l => PSI.has(l.cls)).map(l => l.lvl);
  return (psiLvls.length > 0 && Math.min(...psiLvls) === 3) || { carried: it.imbued.name, psiLvls };
});

await t('SCROLL-IMBUES-A-SPELL', async () => {
  const c = chars.find(x => x.id === curId);
  window.openChoiceModal = (title, opts, res) => res(opts[0]);
  window.promptProvenance = async () => '';
  _magicBrowseList = [MAGIC_ITEMS_DB.find(m => m.name === 'Scroll (2nd-Level Spell)')];
  await addMagicFromBrowse(0);
  const it = (c.items || []).filter(x => x.catalogue === 'magic' && x.ref === 'Scroll (2nd-Level Spell)').pop();
  const sp = it && SPELLS_DB.find(s => s.name === it.imbued.name);
  const PSI = new Set(['Psi/Wld', 'War', 'Telepath', 'Nomad', 'Seer', 'Kineticist', 'Egoist', 'Shaper']);
  const castLvls = sp ? (sp.levels || []).filter(l => !PSI.has(l.cls)).map(l => l.lvl) : [];
  return (!!it && /^Scroll of /.test(it.customName || '') && castLvls.length > 0 && Math.min(...castLvls) === 2)
    || { it: it && it.customName, carried: it && it.imbued && it.imbued.name, castLvls };
});

await t('CRYSTAL-ADDS-WITHOUT-A-PICK', async () => {
  const c = chars.find(x => x.id === curId);
  let modalCalled = false;
  window.openChoiceModal = (title, opts, res) => { modalCalled = true; res(opts[0]); };
  window.promptProvenance = async () => '';
  _magicBrowseList = [MAGIC_ITEMS_DB.find(m => m.name === 'Cognizance Crystal (5 PP)')];
  await addMagicFromBrowse(0);
  const it = (c.items || []).filter(x => x.catalogue === 'magic' && x.ref === 'Cognizance Crystal (5 PP)').pop();
  return (!!it && !it.imbued && !modalCalled) || { added: !!it, modalCalled };
});

await browser.close();
server.close();
const fails = results.filter(r => !r.pass);
console.log(`\n== VEHICLES PROBE ${fails.length ? 'RED' : 'GREEN'} == ${results.length - fails.length}/${results.length} checks passed · ${consoleErrors.length} console errors`);
if (consoleErrors.length) console.log(consoleErrors.slice(0, 5).join('\n'));
process.exit(fails.length || consoleErrors.length ? 1 : 0);
