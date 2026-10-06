// battery.mjs — the E&E Character Generator HEADLESS BATTERY (opened 2026-10-04).
// Boots the real generator in headless Chromium, runs every 'checked' oracle
// assertion (oracle.json — book-truth harvested from the rulings ledger), then
// fuzzes seeded random character builds through the generator's own validated
// creation path (qdBespokeBuild) and asserts cross-cutting invariants.
//
// Usage:  node battery.mjs [--n 25] [--seed 1] [--json report.json] [--file ../index.html]
// Exit 0 = all green. Designed to run identically on this desk or a cloud clone.
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __dir = dirname(fileURLToPath(import.meta.url));
const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1] ?? '');
const N_FUZZ = Number(args.get('n') ?? 25);
const SEED = Number(args.get('seed') ?? 1);
const TARGET = resolve(__dir, args.get('file') ?? '../index.html');
const PORT = 8777;

// ---- tiny static server (the app is a single file; file:// storage is flaky) ----
const html = readFileSync(TARGET);
const server = createServer((req, res) => {
  if (req.url === '/' || req.url.startsWith('/index.html')) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); }
  else if (req.url.startsWith('/favicon')) { res.writeHead(204); res.end(); }
  else { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

const oracle = JSON.parse(readFileSync(resolve(__dir, 'oracle.json'), 'utf8'));
const results = [];
const mark = (id, pass, note = '') => { results.push({ id, pass, note }); console.log(`${pass ? '  ✓' : '  ✗ FAIL'} ${id}${note ? ' — ' + note : ''}`); };

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) consoleErrors.push(m.text().slice(0, 200)); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + String(e).slice(0, 200)));

console.log(`== E&E HEADLESS BATTERY == target: ${TARGET}`);
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('typeof chars !== "undefined" && typeof qdBespokeBuild === "function"', { timeout: 60000 });
const version = await page.evaluate(() => (document.querySelector('.site-subtitle')?.textContent.match(/v[\d.]+/) || ['?'])[0]);
console.log(`   generator ${version} booted.`);

// ============ SUITE 0 — BOOT ============
console.log('-- Suite 0: boot');
mark('BOOT-CLEAN', consoleErrors.length === 0, consoleErrors[0] || '');

// ============ SUITE 1 — ORACLE CHECKS ============
console.log('-- Suite 1: oracle assertions');
// One synthetic workbench character via the validated creation path.
const mkChar = async (spec) => page.evaluate((s) => {
  const r = qdBespokeBuild(s);
  if (!r.ok) return { ok: false, reason: r.reason };
  chars.push(r.char); curId = r.char.id;
  return { ok: true, id: r.char.id };
}, spec);
const dropChar = async (id) => page.evaluate((cid) => { chars = chars.filter(x => x.id !== cid); curId = chars[0]?.id ?? null; }, id);
// Fighter/Expert: attribute-gate-free entry classes — Bespoke validates attr
// prereqs (Fast Hero demands DEX 13), which the first run proved the hard way.
const baseSpec = { steps: [{ name: "Fighter", levels: 4 }, { name: "Expert", levels: 2 }], sixLevels: { arcane: 0, divine: 0, heroic: 5, mutation: 5, psionic: 5, tech: 5 }, presetName: 'Custom', race: 'Human', hybrid: null, name: 'Battery Workbench', occupation: '' };
const wb = await mkChar(baseSpec);
mark('BESPOKE-VALIDATES', wb.ok === true, wb.ok ? '' : wb.reason);
// Illegal ladder must refuse, not build.
const bad = await page.evaluate(() => { const r = qdBespokeBuild({ steps: [{ name: "Loremaster", levels: 3 }], sixLevels: { arcane: 0, divine: 0, heroic: 0, mutation: 0, psionic: 0, tech: 0 }, presetName: 'Custom', race: 'Human', hybrid: null, name: 'X', occupation: '' }); return r.ok; });
if (bad !== false) mark('BESPOKE-VALIDATES', false, 'illegal Loremaster-at-1st ladder was accepted');
// The battery's first conviction (2026-10-04): a step with UNDEFINED levels
// slipped `st.levels < 1` and built NaN-grade characters. Guard = v8.89.1.
const mal = await page.evaluate(() => { try { return qdBespokeBuild({ steps: [{ name: 'Fighter' }], sixLevels: { arcane: 0, divine: 0, heroic: 5, mutation: 0, psionic: 0, tech: 5 }, presetName: 'Custom', race: 'Human', hybrid: null, name: 'Mal', occupation: '' }).ok; } catch (e) { return false; } });
mark('BESPOKE-REJECTS-MALFORMED', mal === false, mal === false ? '' : 'step with undefined levels was accepted (needs the v8.89.1 guard)');

const t = async (id, fn) => { try { const r = await page.evaluate(fn); mark(id, r === true || (r && r.pass === true), r && r.note || (r === true ? '' : JSON.stringify(r).slice(0, 160))); } catch (e) { mark(id, false, String(e).slice(0, 160)); } };

await t('MUT-TEMPLATE-FEAT', () => {
  const c = chars.find(x => x.name === 'Battery Workbench');
  c.feats = c.feats || []; c.feats.push({ name: 'Supernatural Mutation' });
  const templ = getMPState(c).isMutantTemplated;
  c.feats = c.feats.filter(f => f.name !== 'Supernatural Mutation');
  return { pass: templ === true && getMPState(c).isMutantTemplated === false };
});
await t('MUT-TEMPLATE-10MP', () => {
  const c = chars.find(x => x.name === 'Battery Workbench');
  c.mpGrants = [{ amount: 9 }]; const at9 = getMPState(c).isMutantTemplated;
  c.mpGrants = [{ amount: 10 }]; const at10 = getMPState(c).isMutantTemplated;
  c.mpGrants = []; return { pass: at9 === false && at10 === true };
});
await t('MUT-CLASS-TRACKS-RLM', () => {
  const c = chars.find(x => x.name === 'Battery Workbench');
  const tiers = [];
  for (const n of [5, 10, 20, 30, 40]) { c.mpGrants = [{ amount: n }]; const s = getMPState(c); tiers.push(`${n}:${s.mutantLevel}/${s.tier.tier}`); }
  c.mpGrants = [];
  return { pass: tiers.join(' ') === '5:0/Minor 10:1/Moderate 20:2/Major 30:3/Mega 40:4/Mega', note: tiers.join(' ') };
});
await t('BUFF-STAMP-SEMICOLON', () => {
  const c = chars.find(x => x.name === 'Battery Workbench');
  c.powers = c.powers || [];
  c.powers.push({ name: 'Sustenance', pool: 'super', mp: 4 }, { name: 'Cloak of Chaos', pool: 'super', mp: 16 });
  const pbs = perpetualBuffs(c);
  const sust = c.powers.find(p => p.name === 'Sustenance'), cloak = c.powers.find(p => p.name === 'Cloak of Chaos');
  const pass = sust.buff === true && cloak.buff === undefined && pbs.some(b => b.name === 'Cloak of Chaos' && b.partial);
  c.powers = c.powers.filter(p => !['Sustenance', 'Cloak of Chaos'].includes(p.name));
  return { pass };
});
await t('PERP-BUFF-STANDS', () => {
  const c = chars.find(x => x.name === 'Battery Workbench');
  c.powers.push({ name: 'Thicken Skin', pool: 'super', mp: 4 });
  const nac = (activeBuffBonuses(c).naturalAC || []).reduce((s, e) => s + e.value, 0);
  return { pass: nac === 1, note: 'standing NAC +' + nac };
});
await t('PERP-TOGGLE-FREE', () => {
  const c = chars.find(x => x.name === 'Battery Workbench');
  toggleBuffSuper('Thicken Skin');
  const off = (activeBuffBonuses(c).naturalAC || []).length === 0 && c.powers.find(p => p.name === 'Thicken Skin').buffOff === true;
  toggleBuffSuper('Thicken Skin');
  const back = (activeBuffBonuses(c).naturalAC || []).length === 1;
  return { pass: off && back };
});
await t('PERP-SUPERSEDE', () => {
  const c = chars.find(x => x.name === 'Battery Workbench');
  c.activeEffects = [{ id: 'ae-t', name: 'Thicken Skin', pool: 'super', effects: [{ k: 'nac', type: 'enhancement', v: 3 }], expires: 'rest' }];
  const vals = (activeBuffBonuses(c).naturalAC || []).map(e => e.value);
  clearActiveBuffs(c, 'battery');
  const resumed = (activeBuffBonuses(c).naturalAC || []).map(e => e.value);
  return { pass: vals.length === 1 && vals[0] === 3 && resumed.length === 1 && resumed[0] === 1 };
});
await t('PERP-BUFF-NPF', () => {
  const c = chars.find(x => x.name === 'Battery Workbench');
  c.nullified = true;
  const under = Object.keys(activeBuffBonuses(c)).length;
  c.nullified = false;
  return { pass: under === 0 };
});
await t('DR-DASHBOARD', () => {
  const c = chars.find(x => x.name === 'Battery Workbench');
  c.powers.push({ name: 'Stoneskin', pool: 'super', mp: 10 });
  const d1 = computeDR(c).some(d => d.value === 10 && d.bypass === 'adamantine');
  c.powers.push({ name: 'Iron Body', pool: 'super', mp: 16 });
  const d2 = computeDR(c).some(d => d.value === 15 && d.bypass === 'adamantine');
  c.powers = c.powers.filter(p => p.name !== 'Iron Body');
  return { pass: d1 && d2 };
});
await t('DR-TIE-BREAK', () => {
  const c = chars.find(x => x.name === 'Battery Workbench');
  const saveRace = c.race; c.race = 'Gargoyle'; // racial 10/magic, pushed before the lane
  c.activeEffects = [{ id: 'ae-x', name: 'Form of Doom', pool: 'super', effects: [{ k: 'dr', v: 10, bypass: '—' }], expires: 'rest' }];
  showPage('sheet'); renderSheet();
  const cell = [...document.querySelectorAll('.stat-cell')].find(el => el.querySelector('.sc-lbl')?.textContent.trim() === 'DR');
  const headline = cell ? cell.querySelector('.sc-val').textContent.trim() : null;
  c.activeEffects = []; c.race = saveRace; renderSheet();
  return { pass: headline === '10/—', note: 'headline ' + headline };
});
await t('EI-TWO-STEP', () => {
  const c = chars.find(x => x.name === 'Battery Workbench');
  addTalentToChar(c, 'Fire Resistance');
  addTalentToChar(c, 'Energy Immunity');
  grantEnergyImmunityPick(c);
  const sel = document.getElementById('choice-modal-select');
  const opts = [...sel.options].map(o => o.value);
  sel.value = 'Cold Resistance'; confirmChoiceModal();
  const ri = computeResistances(c);
  const both = ['cold', 'fire'].every(k => (ri.immune || {})[k]);
  return { pass: both && !opts.includes('Fire Resistance') && opts.length === 4, note: 'immune: ' + Object.keys(ri.immune || {}).join(',') };
});
await t('EI-GRANT-EXEMPT', () => {
  const c = chars.find(x => x.name === 'Battery Workbench');
  const granted = (c.talents || []).find(tt => tt.name === 'Cold Resistance');
  const counted = getTalentBudget(c).totalPicked; // Fire Resistance consumes 1; Cold (granted) + EI (super) must not
  return { pass: granted?.grantedBy === 'Energy Immunity' && counted === 1, note: `picked=${counted}` };
});
await t('EI-CASCADE', () => {
  const c = chars.find(x => x.name === 'Battery Workbench');
  removeTalentFromChar(c, 'Energy Immunity');
  const coldGone = !(c.talents || []).some(tt => tt.name === 'Cold Resistance');
  const fireStays = (c.talents || []).some(tt => tt.name === 'Fire Resistance');
  removeTalentFromChar(c, 'Fire Resistance');
  return { pass: coldGone && fireStays };
});
await t('MANGLER-REPLACES', () => {
  const c = chars.find(x => x.name === 'Battery Workbench');
  for (const n of ['Ignore Hardness', 'Improved Ignore Hardness', 'Mangler']) addTalentToChar(c, n);
  const m = computeHardnessIgnore(c);
  c.nullified = true; const npf = computeHardnessIgnore(c); c.nullified = false;
  return { pass: m.ignore === 10 && m.breakDC === 5 && npf.mode === 'base' && npf.ignore === 4 && npf.breakDC === 2, note: `${m.ignore}/${m.breakDC}; NPF ${npf.ignore}/${npf.breakDC}` };
});
await t('TITANIC-ECHO', () => {
  const c = chars.find(x => x.name === 'Battery Workbench');
  addTalentToChar(c, 'Advanced Ignore Hardness');
  addTalentToChar(c, 'Titanic Strength');
  const m = computeHardnessIgnore(c);
  return { pass: m.ignore === 40 && m.breakDC === 16 && m.instances === 2, note: `${m.ignore}/${m.breakDC}` };
});
await t('TITANIC-NO-RIDER-DOUBLE', () => {
  const c = chars.find(x => x.name === 'Battery Workbench');
  // Mangler + Titanic owned: exactly 2 passive rider instances → ×16 carry, +2 sizes; never ×64/+3 from the echo.
  const cc = computeCarryCapacity(c);
  const steps = effectiveSizeIndex(c) - raceSizeIndex(c);
  return { pass: cc.superTalents.length === 2 && steps === 2, note: `riders=${cc.superTalents.length}, sizeSteps=${steps}` };
});
await t('STRONG-RIDERS-MULT', () => {
  const c = chars.find(x => x.name === 'Battery Workbench');
  const before = computeCarryCapacity(c).heavy;
  addTalentToChar(c, 'Extreme Effort'); addTalentToChar(c, 'Supreme Effort');
  const after = computeCarryCapacity(c);
  const sizeSteps = effectiveSizeIndex(c) - raceSizeIndex(c);
  for (const n of ['Supreme Effort', 'Extreme Effort', 'Titanic Strength', 'Mangler', 'Improved Ignore Hardness', 'Advanced Ignore Hardness', 'Ignore Hardness']) removeTalentFromChar(c, n);
  return { pass: after.heavy === before && sizeSteps === 2 && after.supremeEffortOwned === true, note: 'Supreme Effort passive-inert, flagged for the Effort window' };
});
await t('CARRY-TONS', () => {
  const vals = [fmtCarry(9000), fmtCarry(10000), fmtCarry(11999), fmtCarry(256000)];
  return { pass: vals.join('|') === '9,000 lb|5 tons|5 tons|128 tons', note: vals.join(' | ') };
});

// ============ SUITE 1b — THE DEBT PAID (2026-10-06) ============
// The nine 'declared' oracle entries, each now an executable check. Every
// test builds its own throwaway character through the validated path
// (qdBespokeBuild) and never touches the workbench.
await page.evaluate(() => {
  window.__bt = (steps, extra = {}) => {
    const r = qdBespokeBuild(Object.assign({ steps, sixLevels: { arcane: 5, divine: 5, heroic: 5, mutation: 5, psionic: 5, tech: 5 }, presetName: 'Custom', race: 'Human', hybrid: null, name: 'Battery Debt', occupation: '' }, extra));
    if (!r.ok) throw new Error('debt-suite build refused: ' + r.reason);
    return r.char;
  };
  window.__btSuper = (mp) => { const c = __bt([{ name: 'Fighter', levels: 4 }]); c.feats.push({ name: 'Supernatural Mutation' }); c.mpGrants = [{ amount: mp }]; c.powers = []; return c; };
});
await t('MAX-RANKS', () => {
  // E&E house cap: class skill = level+4; cross-class = half, rounded down.
  const c = __bt([{ name: 'Rogue', levels: 3 }]);
  chars.push(c); curId = c.id;
  c.skills = { Hide: 9, Spellcraft: 9, Climb: 7 };
  showPage('skills'); renderSkills();
  const inp = n => document.getElementById('skr-' + n.replace(/[^a-z0-9]/gi, '_'));
  const hide = inp('Hide'), spell = inp('Spellcraft'), climb = inp('Climb');
  const txt = document.getElementById('page-skills')?.innerText || '';
  const overMarks = (txt.match(/⚠/g) || []).length;
  const pass = isClassSkill('Hide', c) && !isClassSkill('Spellcraft', c)
    && hide?.max === '7' && climb?.max === '7' && spell?.max === '3' && overMarks >= 2;
  chars = chars.filter(x => x.id !== c.id); curId = chars[0]?.id ?? null;
  return { pass, note: `L3: class max ${hide?.max}, cross max ${spell?.max}, over-cap flags ${overMarks}` };
});
await t('IMPROVED-GRAPPLE', () => {
  const c = __bt([{ name: 'Fighter', levels: 4 }]);
  const g0 = computeGrapple(c).total;
  c.feats.push({ name: 'Improved Grapple' });
  const g1 = computeGrapple(c);
  return { pass: g1.total - g0 === 4 && g1.parts.includes('Improved Grapple +4'), note: `${g0} → ${g1.total}` };
});
await t('RECKLESS-ATTACK-ONLY', () => {
  const c = __bt([{ name: 'Fighter', levels: 6 }]);
  c.items = [{ id: 'bt-sw', catalogue: 'weapon', ref: 'Longsword', slot: 'main_hand', equipped: true, gadgets: [] }];
  const melee = () => computeEquippedWeaponSummaries(c).find(w => w.name === 'Longsword');
  const snap = () => ({ bab: c.bab, ac: computeACDisplay(c).total, g: computeGrapple(c).total, atk: melee().attackBonus, n: melee().fullAttack.length });
  const off = snap();
  c.combatDecl = { ro: true }; const on = snap();
  c.items = [{ id: 'bt-bow', catalogue: 'weapon', ref: 'Longbow', slot: 'main_hand', equipped: true, gadgets: [] }];
  const bow = () => computeEquippedWeaponSummaries(c).find(w => w.name === 'Longbow').attackBonus;
  const bowOn = bow(); c.combatDecl = {}; const bowOff = bow();
  const pass = on.bab === off.bab && on.ac === off.ac - 4 && on.atk === off.atk + 2 && on.g === off.g + 2 && on.n === off.n && bowOn === bowOff;
  return { pass, note: `melee +${on.atk - off.atk}, grapple +${on.g - off.g}, AC ${on.ac - off.ac}, BAB Δ${on.bab - off.bab}, iteratives ${off.n}→${on.n}, bow Δ${bowOn - bowOff}` };
});
await t('EVASION-UNIFIED', () => {
  const tier = (c, f) => (f(c) || { tier: 0 }).tier;
  const r = {
    monk2: tier(__bt([{ name: 'Monk', levels: 2 }]), evasionTier),
    monk9: tier(__bt([{ name: 'Monk', levels: 9 }]), evasionTier),
    rogueExplorer: tier(__bt([{ name: 'Rogue', levels: 5 }, { name: 'Explorer', levels: 4 }]), evasionTier),
    monkRogue: tier(__bt([{ name: 'Monk', levels: 2 }, { name: 'Rogue', levels: 2 }]), evasionTier),
    explorerAlone: tier(__bt([{ name: 'Fast Hero', levels: 5 }, { name: 'Explorer', levels: 4 }]), evasionTier),
    ud1: tier(__bt([{ name: 'Berserker', levels: 2 }]), uncannyDodgeTier),
    ud2src: tier(__bt([{ name: 'Berserker', levels: 2 }, { name: 'Rogue', levels: 4 }]), uncannyDodgeTier),
  };
  const tal = __bt([{ name: 'Fighter', levels: 2 }]); addTalentToChar(tal, 'Evasion'); r.talent = tier(tal, evasionTier);
  // v9.0.2 (Adam's ruling): instances of Evasion stack — any second source → Improved.
  tal.classes.push({ name: 'Rogue', level: 2 }); r.talentRogue = tier(tal, evasionTier);
  const pass = r.monk2 === 1 && r.monk9 === 2 && r.rogueExplorer === 2 && r.monkRogue === 2 && r.talentRogue === 2 && r.explorerAlone === 1 && r.ud1 === 1 && r.ud2src === 2 && r.talent === 1;
  return { pass, note: Object.entries(r).map(([k, v]) => `${k}:${v}`).join(' ') };
});
await t('UNNATURAL-FORMULAS', () => {
  const c = __bt([{ name: 'Fighter', levels: 4 }]);
  const b = { bab: c.bab, def: c.def, hp: c.maxHP, sp: computeSkillPointBudget(c), sv: computeStatBlock(c) };
  const bad = [];
  for (const mp of [10, 20, 30, 60]) {
    c.mpGrants = [{ amount: mp }]; reconcileMutantSubtype(c);
    const ml = getMPState(c).mutantLevel, conM = am(c.attrs[2]), sb = computeStatBlock(c);
    const got = [c.bab - b.bab, c.def - b.def, c.maxHP - b.hp, computeSkillPointBudget(c) - b.sp, sb.fort.total - b.sv.fort.total, sb.ref.total - b.sv.ref.total, sb.will.total - b.sv.will.total];
    const exp = [Math.floor(ml / 2), Math.floor(ml / 3), ml * (5 + conM), 2 * ml, Math.floor(ml / 2), Math.floor(ml / 2), Math.floor(ml / 2)];
    if (got.join() !== exp.join()) bad.push(`ML${ml}: got ${got} want ${exp}`);
  }
  c.mpGrants = []; reconcileMutantSubtype(c);
  if (c.bab !== b.bab || c.def !== b.def || c.maxHP !== b.hp) bad.push('ledger did not unwind at ML0');
  return { pass: bad.length === 0, note: bad[0] || 'ML 1/2/3/6 exact; unwinds to zero' };
});
await t('DR-CLASS-POOL', () => {
  const c = __bt([{ name: 'Tough Hero', levels: 6 }, { name: 'Berserker', levels: 7 }]);
  c.talents = (c.talents || []).filter(x => !/Damage Reduction/.test(x.name));
  c.talents.push({ name: 'Damage Reduction 1/-' }, { name: 'Damage Reduction 2/-' });
  c.items = [{ id: 'bt-dp', catalogue: 'armor', ref: 'Dwarven Plate', customName: 'Dwarven Plate', equipped: true }];
  const dr = computeDR(c);
  const pool = dr.filter(e => /class-level pool/.test(e.note || ''));
  const plate = dr.filter(e => e.source === 'Dwarven Plate');
  return { pass: pool.length === 1 && pool[0].value === 3 && plate.length === 1 && plate[0].value === 3, note: dr.map(e => `${e.value}/${e.bypass} ${e.source.slice(0, 32)}`).join(' | ') };
});
await t('SUITE-DISCOUNT', () => {
  const c = __btSuper(200);
  const sets = _powerThemeSets(); let suite = null, m = null;
  for (const th in sets) { const x = [...sets[th]].map(n => SPELLS_DB.find(s => s.name === n)).filter(s => s && s.mp != null && s.mp >= 2 && !SUPER_RUNGS[s.name]); if (x.length >= 4) { suite = th; m = x; break; } }
  const tg = m[3], pay = () => superBuyEligibility(c, tg).mp;
  const own0 = pay();
  c.powers = [{ name: m[0].name, pool: 'super', mp: m[0].mp }]; const own1 = pay();
  c.powers.push({ name: m[1].name, pool: 'super', mp: m[1].mp }); const own2 = pay();
  c.powers.push({ name: m[2].name, pool: 'super', mp: m[2].mp }); const own3 = pay();
  c.powers = [{ name: m[0].name, pool: 'arcane' }, { name: m[1].name, pool: 'arcane' }]; const cast = pay();
  // floor 1 MP: a 1-MP suite member stays 1 MP under the discount.
  let floorOk = true;
  const one = Object.entries(sets).map(([th, s]) => [th, [...s].map(n => SPELLS_DB.find(x => x.name === n)).filter(x => x && x.mp != null && !SUPER_RUNGS[x.name])]).find(([, x]) => x.some(y => y.mp === 1) && x.length >= 3);
  if (one) { const t1 = one[1].find(y => y.mp === 1); c.powers = one[1].filter(y => y !== t1).slice(0, 2).map(o => ({ name: o.name, pool: 'super', mp: o.mp })); floorOk = superBuyEligibility(c, t1).mp === 1; }
  const b = tg.mp;
  return { pass: own0 === b && own1 === b && own2 === b - 1 && own3 === b - 1 && cast === b && floorOk, note: `${suite}/${tg.name} base ${b}: owned 0/1/2/3 → ${own0}/${own1}/${own2}/${own3}; casting-pool ${cast}; floor ${floorOk}` };
});
await t('SELLERS-MARKET', () => {
  // Printed prices only: an unpriced entry is unbuyable, a variant buys at its
  // parent's printed price, a rung family's headline price is its cheapest rung.
  const bad = [];
  for (const s of SPELLS_DB) {
    const spec = superBuySpec(s), v = (typeof VARIANT_NAMES !== 'undefined') && VARIANT_NAMES[s.name];
    const parent = v ? SPELLS_DB.find(x => x.name === v.parent) : null;
    const want = s.mp != null ? s.mp : (parent && parent.mp != null ? parent.mp : null);
    if ((spec.mp ?? null) !== want) bad.push(`${s.name}: quoted ${spec.mp} vs printed ${want}`);
  }
  for (const [n, rungs] of Object.entries(SUPER_RUNGS)) {
    const s = SPELLS_DB.find(x => x.name === n);
    if (!s) { bad.push(`rung family ${n} has no catalogue entry`); continue; }
    if (s.mp !== Math.min(...rungs.map(r => r[1]))) bad.push(`${n}: headline ${s.mp} ≠ cheapest rung`);
  }
  const c = __btSuper(200);
  const unpriced = SPELLS_DB.find(s => superBuySpec(s).mp == null);
  if (unpriced && superBuyEligibility(c, unpriced).ok) bad.push(`${unpriced.name} is unpriced but buyable`);
  return { pass: bad.length === 0, note: bad[0] || `${SPELLS_DB.length} entries priced verbatim; ${Object.keys(SUPER_RUNGS).length} rung families consistent` };
});
await t('TIER-CEILING-ONLY', () => {
  const c = __btSuper(5);
  const lowest = s => (s.levels && s.levels.length) ? Math.min(...s.levels.map(l => l.lvl)) : null;
  const zero = SPELLS_DB.filter(s => s.mp != null && lowest(s) === 0);
  const bad = [];
  for (const mp of [5, 10, 20, 40]) {
    c.mpGrants = [{ amount: mp }];
    const st = getMPState(c), hi = st.tier.spell_levels[1];
    for (const z of zero) { const e = superBuyEligibility(c, z); if (!e.ok && /tier reaches/.test(e.why || '')) bad.push(`${st.tier.tier}: 0-level ${z.name} band-blocked`); }
    const over = SPELLS_DB.find(s => s.mp != null && lowest(s) > hi);
    if (over) { const e = superBuyEligibility(c, over); if (e.ok || !/tier reaches/.test(e.why || '')) bad.push(`${st.tier.tier}: level-${lowest(over)} ${over.name} not ceiling-blocked`); }
  }
  return { pass: bad.length === 0, note: bad[0] || `${zero.length} zero-level powers open at Minor/Moderate/Major/Mega; ceiling holds` };
});

await t('EQUIP-SKILL-KEYS', () => {
  // v9.1.0: every gear grant/satisfier names a REAL lane — a skill row,
  // a save, or the item's own chosen $param; basic tool kits grant nothing.
  const rows = new Set(SKILLS.map(s => s.n)), bad = [];
  for (const e of EQUIPMENT_ITEMS) {
    const eff = e.effect || {};
    for (const g of (eff.grants || [])) {
      const t = String(g.t);
      if (t.startsWith('skill:')) { const k = t.slice(6); if (k !== '$param' && !rows.has(k)) bad.push(`${e.name} → ${k}`); }
      else if (!['fort', 'ref', 'will'].includes(t)) bad.push(`${e.name} → ${t}`);
    }
    for (const x of (eff.satisfies || [])) if (x !== '$param' && !rows.has(x)) bad.push(`${e.name} satisfies ${x}`);
    if (eff.param) for (const o of eff.param.options) if (!rows.has(o)) bad.push(`${e.name} param option ${o}`);
  }
  for (const n of ['Electrical tool kit, basic', 'Mechanical tool kit, basic']) { const e = EQUIPMENT_ITEMS.find(x => x.name === n); if ((e.effect.grants || []).some(g => g.v)) bad.push(n + ' grants a bonus (HH p.308: basic kits only remove the penalty)'); }
  // Live: the deluxe electrical kit's +2 reaches the Repair row (conditional).
  const c = __bt([{ name: 'Fighter', levels: 2 }]); c.items = [{ id: 'k', catalogue: 'equipment', ref: 'Electrical tool kit, deluxe', equipped: true }];
  const rep = computeSkillMiscBonuses(c)['Repair'];
  if (!rep || !rep.cond.some(e => e.value === 2)) bad.push('deluxe electrical +2 did not reach the Repair row');
  return { pass: bad.length === 0, note: bad[0] || `${EQUIPMENT_ITEMS.length} items: every grant lands on a real row` };
});

// workbench cleanup + render sanity
await t('SHEET-NO-NAN', () => {
  const c = chars.find(x => x.name === 'Battery Workbench');
  c.powers = c.powers.filter(p => !['Thicken Skin', 'Stoneskin'].includes(p.name));
  curId = c.id; showPage('sheet'); renderSheet();
  const txt = document.getElementById('page-sheet').innerText;
  const bad = txt.match(/\bNaN\b|\bundefined\b/);
  return { pass: !bad, note: bad ? 'found: ' + bad[0] : '' };
});
if (wb.ok) await dropChar(wb.id);

// ============ SUITE 2 — SEEDED FUZZ ============
console.log(`-- Suite 2: fuzz (${N_FUZZ} builds, seed ${SEED})`);
const fuzz = await page.evaluate(async (N, SEED0) => {
  const mul = (a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; })(SEED0);
  const pick = arr => arr[Math.floor(mul() * arr.length)];
  const races = Object.keys(RACES).filter(r => r !== 'Hybrid');
  const classes = [...Object.keys(BASIC_CLASSES), ...Object.keys(HERO_CLASSES)];
  const stats = { built: 0, refused: 0, failures: [] };
  for (let i = 0; i < N; i++) {
    const nSteps = 1 + Math.floor(mul() * 3);
    const steps = Array.from({ length: nSteps }, () => ({ name: pick(classes), levels: 1 + Math.floor(mul() * 5) }));
    const six = {}; for (const a of ['arcane', 'divine', 'heroic', 'mutation', 'psionic', 'tech']) six[a] = Math.floor(mul() * 6);
    const spec = { steps, sixLevels: six, presetName: 'Custom', race: pick(races), hybrid: null, name: `Fuzz_${i}`, occupation: '' };
    let r;
    try { r = qdBespokeBuild(spec); } catch (e) { stats.failures.push({ i, spec: steps.map(s => s.name + s.levels).join('/'), err: 'build THREW: ' + String(e).slice(0, 140) }); continue; }
    if (!r.ok) { stats.refused++; continue; }
    stats.built++;
    const c = r.char; chars.push(c); curId = c.id;
    try {
      showPage('sheet'); renderSheet();
      const txt = document.getElementById('page-sheet').innerText;
      const bad = txt.match(/\bNaN\b|\bundefined\b/);
      if (bad) stats.failures.push({ i, spec: `${spec.race} ` + steps.map(s => s.name + s.levels).join('/'), err: 'sheet shows ' + bad[0], ctx: txt.slice(Math.max(0, bad.index - 90), bad.index + 60).replace(/\s+/g, ' ') });
      const sb = computeStatBlock(c);
      for (const k of ['fort', 'ref', 'will', 'init']) if (!Number.isFinite(sb[k]?.total)) stats.failures.push({ i, err: `non-finite ${k}` });
      if (!(c.maxHP > 0)) stats.failures.push({ i, err: 'maxHP ' + c.maxHP });
      if (getMPState(c).balance < 0) stats.failures.push({ i, err: 'negative MP balance' });
      const clone = JSON.parse(JSON.stringify(c));
      const sb2 = computeStatBlock(clone);
      for (const k of ['fort', 'ref', 'will']) if (sb[k].total !== sb2[k].total) stats.failures.push({ i, err: `roundtrip drift: ${k} ${sb[k].total} → ${sb2[k].total}` });
    } catch (e) { stats.failures.push({ i, spec: `${spec.race} ` + steps.map(s => s.name + s.levels).join('/'), err: 'render THREW: ' + String(e).slice(0, 140) }); }
    chars = chars.filter(x => x.id !== c.id); curId = chars[0]?.id ?? null;
  }
  return stats;
}, N_FUZZ, SEED);
console.log(`   built ${fuzz.built} · refused ${fuzz.refused} (legal validation) · failures ${fuzz.failures.length}`);
for (const f of fuzz.failures.slice(0, 10)) console.log('   ✗', JSON.stringify(f));
mark('FUZZ-INVARIANTS', fuzz.failures.length === 0 && fuzz.built > 0, `${fuzz.built} built, ${fuzz.failures.length} failures`);
mark('FUZZ-CONSOLE-CLEAN', consoleErrors.length === 0, consoleErrors[0] || '');

// ============ SUITE 3 — THE GRANT AUDIT (opened 2026-10-06) ============
// The Rhad class of bug (§243: implants stored their feat where no consumer
// looked) — hunted wholesale. Every feat, talent, cybernetic and mutation is
// granted alone to a fresh fixture; any entry whose text claims a number but
// moves NO engine output must be listed in grant_audit_allow.json with a
// reason (table / fixture / open). An unlisted silent entry fails the battery.
console.log('-- Suite 3: grant audit');
const auditBody = readFileSync(resolve(__dir, 'grant_audit.page.js'), 'utf8');
const allow = JSON.parse(readFileSync(resolve(__dir, 'grant_audit_allow.json'), 'utf8')).entries;
try {
  const rows = await page.evaluate(`(async()=>{${auditBody}})()`);
  const silent = rows.filter(r => r.claim && !r.visible);
  const unlisted = silent.filter(r => !allow[r.key]);
  const nowWired = Object.keys(allow).filter(k => rows.some(r => r.key === k && r.visible));
  const open = Object.entries(allow).filter(([, v]) => v.why === 'open').map(([k]) => k);
  console.log(`   ${rows.length} grants audited · ${rows.filter(r => r.visible).length} engine-visible · ${silent.length} silent claimers (${silent.length - unlisted.length} on the allowlist)`);
  for (const r of unlisted) console.log(`   ✗ NEW SILENT GRANT: ${r.key} — "${r.d}"`);
  for (const k of open) if (!nowWired.includes(k)) console.log(`   ◌ open: ${k}`);
  for (const k of nowWired) console.log(`   ★ now engine-visible — retire from the allowlist: ${k}`);
  mark('GRANT-AUDIT', unlisted.length === 0 && rows.length > 400, unlisted.length ? `${unlisted.length} unlisted silent grant(s)` : `${rows.length} audited; ${open.length} known-open`);
} catch (e) { mark('GRANT-AUDIT', false, String(e).slice(0, 160)); }

// ============ REPORT ============
const checked = oracle.entries.filter(e => e.status === 'checked').map(e => e.id);
const covered = new Set(results.map(r => r.id));
const uncovered = checked.filter(id => !covered.has(id));
for (const id of uncovered) mark(id, false, 'oracle says checked but no test ran');
const declared = oracle.entries.filter(e => e.status === 'declared').length;
const fails = results.filter(r => !r.pass);
console.log(`\n== BATTERY ${fails.length ? 'FAILED' : 'GREEN'} == ${results.length - fails.length}/${results.length} checks passed · ${declared} oracle entries declared-unimplemented (honest debt) · generator ${version}`);
if (args.get('json')) writeFileSync(args.get('json'), JSON.stringify({ version, results, fuzz, declared, when: new Date().toISOString() }, null, 2));
await browser.close(); server.close();
process.exit(fails.length ? 1 : 0);
