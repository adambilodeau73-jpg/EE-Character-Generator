// forge_cabal.mjs — THE CALTROP CABAL (Adam's commission, 2026-11-07):
// four 1st-level mega-mutant villains, 40 MP each (Mega package 30 + GM
// grant 10 per Adam's ruling — no Drawbacks), built headless through the
// CG's own machinery (v9.20.1) with real validators: checkTalentPrereqs,
// escalatedNextCost (the §285 fix under live fire), superBuyEligibility.
// Output: a real exportRoster-shape JSON + a build report for the dossier.
// These four are the Assayer's edge-case fixtures: one spike per axis.
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import puppeteer from 'puppeteer';

const html = readFileSync('C:/Users/adam_/EE/EE-Character-Generator/index.html', 'utf8');
const server = createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); });
await new Promise(r => server.listen(8809, '127.0.0.1', r));

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) consoleErrors.push(m.text().slice(0, 300)); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + String(e).slice(0, 300)));
await page.evaluateOnNewDocument(() => { window.print = () => {}; });
await page.goto('http://127.0.0.1:8809/', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('typeof chars !== "undefined" && typeof getMPState === "function" && typeof checkTalentPrereqs === "function" && typeof superBuyEligibility === "function"', { timeout: 60000 });

const out = await page.evaluate(() => {
  const report = [];
  const say = (s) => report.push(s);
  const fail = (s) => { throw new Error(s); };

  localStorage.clear(); chars.length = 0; curId = null;

  // ---- shared forge -------------------------------------------------------
  const SIX = { arcane: 5, divine: 5, heroic: 5, mutation: 5, psionic: 5, tech: 6 };
  function forgeBase(name, clsName, attrs, flavorFeat) {
    const c = {
      id: 'cabal-' + name.toLowerCase().replace(/\W+/g, ''),
      name, race: 'Human', sex: '', align: 'Evil', hybrid: null,
      allegiance: 'The Caltrop Cabal',
      occupations: [], xp: 0, hpMode: 'hero',
      schemaVer: (typeof CURRENT_SCHEMA_VER !== 'undefined') ? CURRENT_SCHEMA_VER : 1,
      attrs: attrs.slice(), attrBumps: [], racialApplied: 'Human',
      sixLevels: { ...SIX }, scenarioPreset: 'Custom',
      classes: [{ name: clsName, tier: 'hero', level: 1 }],
      skills: {}, feats: [{ name: 'Supernatural Mutation' }], powers: [], talents: [], items: [], gear: [],
      mutations: [], mpGrants: [{ amount: 10, reason: 'GM allotment — the Caltrop Cabal commission (Adam, 2026-11-07)' }],
      superMutantTier: 'mega', totalLvl: 1,
      log: ['Forged by the Caltrop Cabal commission (2026-11-07): 1st-level mega-mutant, Mega package 30 MP + GM grant 10 MP = 40 MP.'],
    };
    if (flavorFeat && FEATS_DB.some(f => (f.n || f.name) === flavorFeat)) c.feats.push({ name: flavorFeat });
    chars.push(c);
    return c;
  }
  function spendState(c) { const st = getMPState(c); return st; }
  function buyAdvantage(c, name, attr) {
    const mut = MUTATIONS_DB.find(x => x.name === name) || fail('no advantage: ' + name);
    const cost = escalatedNextCost(c, mut);
    const st = spendState(c);
    if (cost > st.balance) fail(`${c.name}: ${name} costs ${cost}, banked ${st.balance}`);
    const rec = { name: mut.name, kind: mut.kind, mp: cost, grantedAt: { level: 1, atDate: new Date().toLocaleDateString() } };
    if (attr) rec.attr = attr;
    c.mutations.push(rec);
    say(`  ${c.name}: +${name}${attr ? ' (' + attr + ')' : ''} — ${cost} MP (banked ${st.balance - cost})`);
    return cost;
  }
  function takeTalent(c, name, viaMT) {
    if (viaMT) buyAdvantage(c, 'Multi-Talented');
    const r = checkTalentPrereqs(name, c);
    if (r.missing.length) fail(`${c.name}: ${name} prereqs missing: ${r.missing.join('; ')}`);
    const t = TALENTS_DB.find(x => x.n === name);
    c.talents.push({ name, grantedAt: { source: viaMT ? 'Multi-Talented' : c.classes[0].name, level: 1, atDate: new Date().toLocaleDateString() } });
    say(`  ${c.name}: talent ${name}${t.mp_cost ? ` — ${t.mp_cost} MP (super)` : viaMT ? ' (Multi-Talented slot)' : ' (class slot)'}`);
  }
  function buyPower(c, spellName) {
    const sp = SPELLS_DB.find(x => x.name === spellName) || fail('no spell: ' + spellName);
    const el = superBuyEligibility(c, sp);
    if (!el.ok) fail(`${c.name}: ${spellName} refused — ${el.why}`);
    c.powers.push({ name: sp.name, pool: 'super', mp: el.mp, grantedAt: { level: 1, atDate: new Date().toLocaleDateString() } });
    grantComplimentarySuperPowers(c, sp, sp.name, new Set([sp.name]));
    say(`  ${c.name}: super-power ${spellName} — ${el.mp} MP`);
    return el.mp;
  }
  function finish(c) {
    restampEscalatingCosts(c);
    refreshEclXp(c);
    reconcileGrantedFeats(c);
    reconcileAttributeMutations(c);
    c.hpRolls = generateHpRolls(c.classes, 'hero');
    const conM = am(c.attrs[2]);
    const nat = (typeof computeNaturalAC === 'function') ? (computeNaturalAC(c).total || 0) : 0;
    c.maxHP = Math.max(1, computeMaxHPFromRolls(c.classes, c.hpRolls, conM) + nat * 5);
    c.hp = c.maxHP; c.currentHP = c.maxHP;
    const st = spendState(c);
    say(`  == ${c.name}: earned ${st.totalEarned} MP, spent ${st.totalSpent}, banked ${st.balance} · ML +${st.mutantLevel} · ECL ${c.ecl ?? '?'} · HP ${c.maxHP} · attrs [${c.attrs.join(',')}]`);
    if (st.totalEarned !== 40) fail(`${c.name}: earned ${st.totalEarned} ≠ 40`);
    if (st.balance !== 0) fail(`${c.name}: banked ${st.balance} ≠ 0 — adjust the shopping list`);
    if (st.mutantLevel !== 4) fail(`${c.name}: ML ${st.mutantLevel} ≠ 4`);
    return st;
  }

  // ---- TONNAGE — the Super-Strong (Strong Hero 1) -------------------------
  say('TONNAGE (Strong Hero 1) — the mountain that walks:');
  {
    const c = forgeBase('Tonnage', 'Strong Hero', [15, 13, 14, 8, 12, 10],
      ['Power Attack', 'Brawl', 'Combat Martial Arts'].find(f => FEATS_DB.some(x => (x.n || x.name) === f)));
    takeTalent(c, 'Extreme Effort', false);          // class slot
    takeTalent(c, 'Melee Smash', true);              // MT#1 (2 MP)
    takeTalent(c, 'Improved Melee Smash', true);     // MT#2 (3 MP)
    takeTalent(c, 'Supreme Effort', false);          // super, 3 MP
    takeTalent(c, 'Super-Smash', false);             // super, 5 MP
    takeTalent(c, 'Titanic Strength', false);        // APEX, 9 MP
    buyAdvantage(c, 'Extraordinary [Attribute]', 'STR');    // 2
    buyAdvantage(c, 'Supernatural [Attribute] I', 'STR');   // 3
    buyAdvantage(c, 'Supernatural [Attribute] II', 'STR');  // 4
    buyAdvantage(c, 'Supernatural [Attribute] III', 'STR'); // 5
    buyAdvantage(c, 'Extraordinary [Attribute]', 'CON');    // 2
    buyAdvantage(c, 'Extraordinary [Attribute]', 'DEX');    // 2
    finish(c);
  }

  // ---- PALISADE — the Super-Tough (Tough Hero 1) --------------------------
  say('PALISADE (Tough Hero 1) — the wall that holds:');
  {
    const c = forgeBase('Palisade', 'Tough Hero', [14, 12, 15, 8, 13, 10],
      ['Toughness', 'Great Fortitude'].find(f => FEATS_DB.some(x => (x.n || x.name) === f)));
    takeTalent(c, 'Fire Resistance', false);         // class slot (ER tree)
    takeTalent(c, 'Robust', true);                   // MT#1 (2 MP) (Unbreakable)
    takeTalent(c, 'Damage Reduction 1/-', true);     // MT#2 (3 MP)
    takeTalent(c, 'Bulletproof', false);             // super, 7 MP
    takeTalent(c, 'Energy Immunity', false);         // super, 5 MP
    takeTalent(c, 'Super-Resilient', false);         // super, 3 MP
    takeTalent(c, 'Nigh-Invulnerable', false);       // APEX, 5 MP
    buyAdvantage(c, 'Extraordinary [Attribute]', 'CON');   // 2
    buyAdvantage(c, 'Supernatural [Attribute] I', 'CON');  // 3
    buyAdvantage(c, 'Supernatural [Attribute] II', 'CON'); // 4
    buyAdvantage(c, 'Extraordinary [Attribute]', 'STR');   // 2
    // remainder: 4 MP — Second Wind via MT#3
    takeTalent(c, 'Second Wind', true);              // MT#3 (4 MP)
    finish(c);
  }

  // ---- FLASHOVER — the nova (Dedicated Hero 1) ----------------------------
  say('FLASHOVER (Dedicated Hero 1) — the match that dreams it is the sun:');
  const novaPick = (() => {
    // discover a 9th-level spell/power the Mega tier will sell, fire-flavored first
    const nines = SPELLS_DB.filter(sp => {
      const spec = superBuySpec(sp);
      if (spec.mp == null) return false;
      const lv = (spec.levels || []).map(l => l.lvl);
      return lv.length && Math.min(...lv) === 9;
    }).map(sp => ({ name: sp.name, mp: superBuySpec(sp).mp }));
    nines.sort((a, b) => a.mp - b.mp);
    const fire = nines.find(x => /meteor|fire|burn|flame|incend|conflagr/i.test(x.name));
    return { pick: fire || nines[0], menu: nines.slice(0, 12) };
  })();
  say(`  [9th-level menu] ${novaPick.menu.map(x => `${x.name} ${x.mp}MP`).join(' · ')}`);
  {
    const c = forgeBase('Flashover', 'Dedicated Hero', [8, 13, 12, 10, 15, 14],
      ['Iron Will', 'Frightful Presence'].find(f => FEATS_DB.some(x => (x.n || x.name) === f)));
    const firstFree = TALENTS_DB.find(x => x.hero_class === 'Dedicated Hero' && (!x.prereqs || x.prereqs.length === 0) && x.tier === 'Talent');
    takeTalent(c, firstFree.n, false);               // class slot
    let spent = buyPower(c, novaPick.pick.name);     // THE NINE
    // ladder the Wisdom (the DC attribute) with what remains, then fill
    const fillers = [
      () => buyAdvantage(c, 'Extraordinary [Attribute]', 'WIS'),
      () => buyAdvantage(c, 'Supernatural [Attribute] I', 'WIS'),
      () => buyAdvantage(c, 'Supernatural [Attribute] II', 'WIS'),
      () => buyAdvantage(c, 'Supernatural [Attribute] III', 'WIS'),
      () => buyAdvantage(c, 'Extraordinary [Attribute]', 'CHA'),
    ];
    for (const f of fillers) { const st = spendState(c); if (st.balance <= 0) break; try { f(); } catch (e) { break; } }
    // burn any remainder on the cheapest legal lower-level fire powers
    let guard = 0;
    while (spendState(c).balance > 0 && guard++ < 12) {
      const bal = spendState(c).balance;
      const cands = SPELLS_DB.filter(sp => !c.powers.some(p => p.name === sp.name)).map(sp => ({ sp, el: superBuyEligibility(c, sp) }))
        .filter(x => x.el.ok && x.el.mp <= bal)
        .sort((a, b) => (b.el.mp - a.el.mp) || (/fire|flame|burn|scorch/i.test(b.sp.name) - /fire|flame|burn|scorch/i.test(a.sp.name)));
      const pick = cands.find(x => /fire|flame|burn|scorch|heat|smoke/i.test(x.sp.name)) || cands[0];
      if (!pick) break;
      buyPower(c, pick.sp.name);
    }
    const st = spendState(c);
    if (st.balance > 0) say(`  !! Flashover left ${st.balance} MP unspent — acceptable only if no legal purchase remains`);
    finish(c);
  }

  // ---- PAPER TIGER — the dud (Charismatic Hero 1) -------------------------
  say('PAPER TIGER (Charismatic Hero 1) — forty points of pure theatre:');
  {
    const c = forgeBase('Paper Tiger', 'Charismatic Hero', [8, 13, 10, 12, 14, 15],
      ['Deceptive', 'Trustworthy', 'Renown'].find(f => FEATS_DB.some(x => (x.n || x.name) === f)));
    const firstFree = TALENTS_DB.find(x => x.hero_class === 'Charismatic Hero' && (!x.prereqs || x.prereqs.length === 0) && x.tier === 'Talent');
    takeTalent(c, firstFree.n, false);               // class slot
    // the shopping spree: flavor-forward, combat-irrelevant, OBVIOUS preferred
    const flavorRx = /pheromone|tail|chameleon|glow|scent|gill|webbed|horn|fur|photosynth|echolocat|night|vocal|mimic|camouflage|luminous|second|prehensile|scaly|quill|membrane|whisker|elastic|hopper|climber|leaper|swimmer|tongue|spines?$/i;
    const avoidRx = /attribute|natural armor|damage|claw|fang|strength|resist|immun|regenerat|armor|weapon|wings|flight|carapace/i;
    const menu = MUTATIONS_DB.filter(m => m.kind === 'advantage' && m.mp && m.mp <= 6 && !avoidRx.test(m.name))
      .sort((a, b) => (flavorRx.test(b.name) - flavorRx.test(a.name)) || ((b.obvious === true) - (a.obvious === true)) || (a.mp - b.mp));
    say(`  [flavor menu, first 18] ${menu.slice(0, 18).map(m => `${m.name} ${m.mp}${m.obvious ? '◉' : ''}`).join(' · ')}`);
    let guard = 0;
    while (spendState(c).balance > 0 && guard++ < 30) {
      const bal = spendState(c).balance;
      const next = menu.find(m => {
        if (m.mp > bal) return false;
        const owned = c.mutations.filter(x => x.name === m.name).length;
        if (owned && !m.multi) return false;
        if (m.prerequisite) return false; // keep the spree prereq-free
        return true;
      });
      if (!next) break;
      buyAdvantage(c, next.name);
    }
    const st = spendState(c);
    if (st.balance > 0) say(`  !! Paper Tiger left ${st.balance} MP unspent — widen the menu`);
    finish(c);
  }

  const roster = JSON.stringify(chars, null, 1);
  return { report, roster, count: chars.length };
});

console.log(out.report.join('\n'));
writeFileSync('C:/Users/adam_/OneDrive/Desktop/E&E/The_Caltrop_Cabal_Roster_2026-11-07.json', out.roster);
console.log(`\nroster written: ${out.count} villains, ${(out.roster.length / 1024).toFixed(1)} KB`);
if (consoleErrors.length) { console.log('CONSOLE ERRORS:', consoleErrors.slice(0, 5)); process.exitCode = 1; }
await browser.close();
server.close();
