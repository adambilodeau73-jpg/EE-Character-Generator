// grant_audit.page.js — evaluated INSIDE the booted generator by battery.mjs (Suite 3).
// Grants every feat, talent, cybernetic and mutation, one at a time, to a fresh
// Fighter 4/Expert 2 and fingerprints every engine output (saves, AC, attacks for
// three loadouts, grapple, speeds, carry, DR, resistances, SR, hardness, MP, PP
// pools, skill totals, effective attributes, HP, maneuvers). Returns one row per
// entry: does its text CLAIM a number, and did ANY engine output move?
// A claim that moves nothing is the Rhad pattern: stored, never read.
const ATTR = { Str: 0, Dex: 1, Con: 2, Int: 3, Wis: 4, Cha: 5 };
const mkBase = () => {
  const r = qdBespokeBuild({ steps: [{ name: 'Fighter', levels: 4 }, { name: 'Expert', levels: 2 }], sixLevels: { arcane: 5, divine: 5, heroic: 5, mutation: 5, psionic: 5, tech: 5 }, presetName: 'Custom', race: 'Human', hybrid: null, name: 'Grant Audit', occupation: '' });
  const c = r.char; c.skills = {}; for (const s of SKILLS) c.skills[s.n] = 2; return c;
};
const LOADOUTS = [[{ id: 'ga-sw', catalogue: 'weapon', ref: 'Longsword', slot: 'main_hand', equipped: true, gadgets: [] }], [{ id: 'ga-bow', catalogue: 'weapon', ref: 'Longbow', slot: 'main_hand', equipped: true, gadgets: [] }], []];
const fp = (c) => {
  const o = {}, safe = (k, f) => { try { o[k] = f(); } catch (e) { o[k] = 'ERR ' + String(e).slice(0, 60); } };
  safe('sb', () => JSON.stringify(computeStatBlock(c)));
  safe('ac', () => JSON.stringify(computeACDisplay(c)));
  safe('gr', () => JSON.stringify(computeGrapple(c)));
  const keep = c.items;
  LOADOUTS.forEach((lo, i) => { c.items = lo; safe('wp' + i, () => JSON.stringify(computeEquippedWeaponSummaries(c).map(w => [w.attackBonus, w.damage, w.fullAttack, w.mods, w.riders, w.maneuvers]))); });
  c.items = keep;
  safe('sp', () => JSON.stringify(computeSpeeds(c)));
  safe('cc', () => JSON.stringify(computeCarryCapacity(c)));
  safe('dr', () => JSON.stringify(computeDR(c)));
  safe('rs', () => JSON.stringify(computeResistances(c)));
  safe('sr', () => JSON.stringify(computeSR(c)));
  safe('hi', () => JSON.stringify(computeHardnessIgnore(c)));
  safe('mp', () => JSON.stringify(getMPState(c).totalEarned));
  safe('pp', () => JSON.stringify(getCasterPoolsInfo(c)));
  safe('sk', () => SKILLS.map(s => quickSkillTotal(c, s.n, ATTR[s.a] ?? ATTR[s.attr] ?? 0)).join(','));
  safe('skm', () => JSON.stringify(computeSkillMiscBonuses(c)));
  safe('skb', () => computeSkillPointBudget(c));
  safe('eff', () => JSON.stringify(effAttrs(c)));
  safe('hp', () => c.maxHP);
  safe('cs', () => SKILLS.filter(s => isClassSkill(s.n, c)).length);
  safe('mnv', () => JSON.stringify(computeManeuvers(c, {})));
  return o;
};
const claims = (t) => /[+−-]\s?\d+\b|\bdouble|\bimmun|\bbonus\b/i.test(t || '');
const f0 = fp(mkBase());
const moved = (c) => { const f1 = fp(c); return Object.keys(f0).some(k => f0[k] !== f1[k]); };
const rows = [];
// forceClaim: a grant that carries a chosen feat/skill IS a claim even when its
// text names no number (the Feat Implant that hid Rhad's Dodge said none).
const probe = (key, text, apply, forceClaim) => { const c = mkBase(); apply(c); rows.push({ key, claim: !!forceClaim || claims(text), visible: moved(c), d: (text || '').slice(0, 140) }); };
for (const ft of FEATS_DB) probe('feat:' + ft.n, ft.d, c => {
  const rec = { name: ft.n };
  if (ft.param) { const pk = ft.param.param_kind || ''; rec.param = /weapon/i.test(pk) ? 'Longsword' : /skill/i.test(pk) ? 'Hide' : (ft.param.classes || ft.param.options || [])[0]; }
  c.feats.push(rec);
});
for (const tl of TALENTS_DB) probe('talent:' + tl.n, tl.d, c => { c.talents = c.talents || []; c.talents.push({ name: tl.n, param: tl.takeable === 'multiple' ? 'Hide' : undefined }); if (typeof reconcileTalentHp === 'function') reconcileTalentHp(c); });
for (const cy of CYBERNETICS_DB) probe('cyber:' + cy.n, cy.d, c => { c.cybernetics = [{ n: cy.n, param: cy.n === 'Feat Implant' ? 'Alertness' : (cy.n === 'Skill Implant' ? 'Hide' : undefined) }]; if (typeof syncCyberFeats === 'function') syncCyberFeats(c); }, ['Feat Implant', 'Skill Implant', 'Psi Implant'].includes(cy.n));
for (const m of MUTATIONS_DB) probe('mutation:' + m.name, (m.benefit || '') + ' ' + (m.drawback || ''), c => {
  c.mutations = [/\[Attribute\]/.test(m.name) ? { name: m.name, kind: 'attribute', attr: 'STR' } : { name: m.name }];
  if (/\[Attribute\] I\b|II|III|IV/.test(m.name)) c.mutations.unshift({ name: 'Extraordinary [Attribute]', kind: 'attribute', attr: 'STR' });
  if (typeof reconcileAttributeMutations === 'function') reconcileAttributeMutations(c);
});
return rows;
