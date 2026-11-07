// _probe_reforge.mjs — v9.21.0 (§290) targeted probe: THE REFORGE. Adam's
// gavel: the scenario-TS standard substance (HH p.384) auto-populates on the
// armor shelf at the printed price; other alloys shift the Purchase DC
// vehicle-style (HH pp.329-331, as the difference against the standard) and
// set hardness from their native-TS row. AC bonus never changes. The alloy
// rides the ITEM (it.alloy); integrity, effective PDC, and the row chip read it.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __dir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(process.env.CG_FILE || resolve(__dir, '../index.html'), 'utf8');
const server = createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); });
await new Promise(r => server.listen(8817, '127.0.0.1', r));

const results = [];
const mark = (id, pass, note = '') => { results.push({ id, pass }); console.log(`${pass ? '  ✓' : '  ✗ FAIL'} ${id}${note ? ' — ' + note : ''}`); };

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) consoleErrors.push(m.text().slice(0, 200)); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + String(e).slice(0, 200)));
await page.evaluateOnNewDocument(() => { window.print = () => {}; });
await page.goto('http://127.0.0.1:8817/', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('typeof renderGear === "function" && typeof ARMOR_ALLOY_DB !== "undefined"', { timeout: 60000 });

const t = async (id, fn) => { try { const r = await page.evaluate(fn); mark(id, r === true || (r && r.pass === true), (r && r.note) || (r === true ? '' : JSON.stringify(r).slice(0, 250))); } catch (e) { mark(id, false, String(e).slice(0, 250)); } };

await page.evaluate(() => {
  window.__mkT = (tech) => ({
    id: 'probe-reforge', name: 'Probe', attrs: [10, 10, 10, 10, 10, 10],
    classes: [{ name: 'Strong Hero', tier: 'hero', level: 1 }],
    feats: [], mutations: [], talents: [], powers: [], skills: {}, items: [], totalLvl: 1,
    sixLevels: { arcane: 0, divine: 0, heroic: 5, mutation: 0, psionic: 0, tech: tech },
  });
  window.__boot = (tech) => {
    chars.length = 0; chars.push(__mkT(tech)); curId = 'probe-reforge';
    try { showPage('gear'); } catch (e) {}
    renderGear();
  };
});

await t('DELTA-MATH-VEHICLE-STYLE', () => {
  // TS8 scenario, a LIGHT pattern (ac_bonus 4): standard Megatanium term =
  // 15 + 10 = 25. Adamantium (25 + 10) → +10; Duralloy (15 + 5) → −5;
  // Steel (⛏ 10 + ac 4) → −11; the standard itself → 0.
  const def = { name: 'Probe Light', type: 'light', ac_bonus: 4 };
  const got = {
    adam: armorAlloyDelta('Adamantium', def, 8),
    dural: armorAlloyDelta('Duralloy', def, 8),
    steel: armorAlloyDelta('Steel', def, 8),
    std: armorAlloyDelta('Megatanium', def, 8),
  };
  return (got.adam === 10 && got.dural === -5 && got.steel === -11 && got.std === 0) || got;
});
await t('STANDARD-BY-SCENARIO-TS', () => {
  const got = [standardArmorAlloy(3), standardArmorAlloy(5), standardArmorAlloy(6), standardArmorAlloy(7), standardArmorAlloy(8), standardArmorAlloy(9)];
  return (got.join('|') === 'Steel|Alumisteel|Duralloy|Neovulcanium|Megatanium|Megatanium') || { got };
});
await t('ALLOY-SHELF-DEFAULTS-TO-STANDARD', () => {
  __boot(8);
  const el = document.getElementById('gear-add-armor-alloy');
  if (!el) return { note: 'no alloy select' };
  const sel = el.options[el.selectedIndex];
  return (sel && sel.value === 'Megatanium' && /standard/.test(sel.textContent)) || { v: sel && sel.value, t: sel && sel.textContent };
});
await t('SHELF-PRICES-AGAINST-THE-PICKED-ARMOR', () => {
  // pick a medium catalog armor: TS8 std medium hardness 15 (term 30);
  // Adamantium medium 10 (term 35) → DC +5 shown on its option.
  const def = ARMOR_CATALOG.find(a => a.type === 'medium' && !a.hb_substance && !a.hb_gadget);
  const sel = document.getElementById('gear-add-armor-sel');
  sel.value = def.name; renderArmorAlloySel();
  const el = document.getElementById('gear-add-armor-alloy');
  const opt = [...el.options].find(o => o.value === 'Adamantium');
  return (!!opt && opt.textContent.includes('hardness 10') && opt.textContent.includes('DC +5')) || { t: opt && opt.textContent, armor: def.name };
});
await t('INTEGRITY-HONORS-ITEM-ALLOY', () => {
  const c = chars[0];
  const def = ARMOR_CATALOG.find(a => a.type === 'medium' && !a.hb_substance && !a.hb_gadget);
  const it = { id: 'it_probe1', catalogue: 'armor', ref: def.name, slot: 'armor', equipped: true, alloy: 'Adamantium', gadgets: [] };
  c.items.push(it);
  const g = armorItemIntegrity(it);
  const legacy = armorItemIntegrity({ id: 'it_probe2', catalogue: 'armor', ref: def.name, slot: 'armor', gadgets: [] });
  // Adamantium = TS7 medium row 10; the legacy (unstamped) read keeps the
  // def-TS default — different unless the pattern is itself TS7.
  return (g.hardness === 10 && g.substance === 'Adamantium' && /re-forged/.test(g.hardParts[0]) && (def.tl === 7 || legacy.hardness !== 10)) || { h: g.hardness, s: g.substance, src: g.hardParts[0], legacyH: legacy.hardness, tl: def.tl };
});
await t('EFFECTIVE-PDC-CARRIES-THE-DELTA', () => {
  const c = chars[0];
  const it = c.items.find(x => x.id === 'it_probe1');
  const def = getCatalogueEntry('armor', it.ref);
  const eff = itemEffectivePDC(it, def);
  const base = parseInt(def.dc, 10) || 0;
  // TS8 scenario, medium: Adamantium Δ = (25+10) − (15+15) = +5
  return (eff.dc === Math.max(1, base + 5) && eff.parts.some(p => /re-forge \+5/.test(p))) || { dc: eff.dc, base, parts: eff.parts };
});
await t('ADD-FLOW-STAMPS-AND-CHIP', async () => {
  const def = ARMOR_CATALOG.find(a => a.type === 'light' && !a.hb_substance && !a.hb_gadget);
  // the minimal synthetic char lacks sheet fields — a downstream renderSheet
  // throw is not this feature's concern; the stamp + gear render are.
  try { await addItemToChar('armor', def.name, 'armor', { alloy: 'Mythandium', skipPurchase: true }); } catch (e) {}
  try { renderGear(); } catch (e) {}
  const c = chars[0];
  const it = c.items.find(x => x.ref === def.name && x.alloy === 'Mythandium');
  const inv = document.getElementById('gear-inv-armor').innerHTML;
  return (!!it && inv.includes('⚗ Mythandium') && inv.includes('⚗ Adamantium')) || { stamped: !!it, chipMyth: inv.includes('⚗ Mythandium'), chipAdam: inv.includes('⚗ Adamantium') };
});
await t('FIXED-SUBSTANCE-SHELF-LOCKS', () => {
  // a power-armor pick (mecha superstructure) must lock the alloy shelf
  const pa = ARMOR_CATALOG.find(a => a.type === 'power' && typeof POWER_ARMOR_DB !== 'undefined' && POWER_ARMOR_DB[a.name]);
  if (!pa) return { note: 'no power armor in catalog' };
  const sel = document.getElementById('gear-add-armor-sel');
  sel.value = pa.name; renderArmorAlloySel();
  const el = document.getElementById('gear-add-armor-alloy');
  const locked = el.disabled && /superstructure/.test(el.innerHTML);
  sel.value = ''; renderArmorAlloySel();
  return (locked && !el.disabled) || { locked, relocked: el.disabled };
});
await t('LOW-TS-SCENARIO-DEFAULTS-STEEL', () => {
  __boot(3);
  const el = document.getElementById('gear-add-armor-alloy');
  const sel = el.options[el.selectedIndex];
  const mega = [...el.options].find(o => o.value === 'Megatanium');
  return (sel && sel.value === 'Steel' && !!mega && /⚑ GM/.test(mega.textContent)) || { v: sel && sel.value, mega: mega && mega.textContent };
});
await t('VERSION-STAMPED', () => {
  return (CG_VERSION === 'v9.21.0' && document.querySelector('.site-subtitle').textContent.includes('v9.21.0')) || { v: CG_VERSION };
});
mark('CONSOLE-CLEAN', consoleErrors.length === 0, consoleErrors[0] || '');

const passed = results.filter(r => r.pass).length;
console.log(`\n== REFORGE PROBE: ${passed}/${results.length} ==`);
await browser.close();
server.close();
process.exit(passed === results.length ? 0 : 1);
