// _probe_maxlevels.mjs — v9.20.0 targeted probe: THE MAX-LEVEL GAUNTLET.
// Adam's commission (2026-10-27): build every class to its ceiling and prove
// the plumbing — Hero → 10, Basic → 20, Advanced → 10 (feeder-searched),
// Prestige → printed maxLvl (qualification-path search; the multi-path
// classes report every discovered variant). Under THE DEEP END gavel, epic
// careers (20+ total) are legal: the builder's hard-20 rail lifted to 40,
// and this probe asserts the epic spine holds — finite XP thresholds, bump
// and feat cadence, caster pools that don't read off their tables' end.
//
// The probe is also the DISCOVERY instrument: a class with no found path
// reports its refusal reasons as findings, not silent failure.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __dir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(process.env.CG_FILE || resolve(__dir, '../index.html'), 'utf8');
const server = createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); });
await new Promise(r => server.listen(8800, '127.0.0.1', r));

const results = [];
const mark = (id, pass, note = '') => { results.push({ id, pass }); console.log(`${pass ? '  ✓' : '  ✗ FAIL'} ${id}${note ? ' — ' + note : ''}`); };

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'], protocolTimeout: 900000 });
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) consoleErrors.push(m.text().slice(0, 200)); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + String(e).slice(0, 200)));
await page.goto('http://127.0.0.1:8800/', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('typeof chars !== "undefined" && typeof qdBespokeBuild === "function"', { timeout: 60000 });

// ---- the in-page gauntlet engine ----
await page.evaluate(() => {
  window.print = () => {};
  localStorage.clear(); chars = []; curId = null;
  const SCEN = { arcane: 5, divine: 5, heroic: 5, mutation: 5, psionic: 5, tech: 6 };
  window.__g = {
    SCEN,
    buildN: 0,
    build(steps, extra) {
      // scenario fallbacks: some classes are tech-gated either way.
      let last = null;
      for (const scen of [SCEN, { ...SCEN, tech: 3 }, { ...SCEN, tech: 0 }, { ...SCEN, tech: 9 }]) {
        this.buildN++;
        last = qdBespokeBuild({ steps, sixLevels: scen, presetName: 'Custom', race: 'Human', hybrid: null,
          name: 'G ' + steps.map(s => s.name.slice(0, 6) + s.levels).join('/'), occupation: '', ...(extra || {}) });
        if (last.ok) return last;
        if (!/unavailable under this scenario/i.test(last.reason || '')) break;
      }
      // v9.20.0 pass-throughs: a gated refusal names what it wants — retry
      // with it supplied, ACCUMULATING across up to three rounds (the Super
      // pair stacks MP + Hero-class + allegiance gates, revealed one refusal
      // at a time).
      const depth = (extra && extra.__depth) || 0;
      if (last && !last.ok && depth < 3) {
        const addl = { ...(extra || {}), __depth: depth + 1 };
        let changed = false, outSteps = steps;
        const m = (last.reason || '').match(/allegiance to (\w+)/i);
        if (m && !addl.allegiance) { addl.allegiance = m[1]; addl.align = m[1] === 'Evil' ? 'Neutral Evil' : (m[1] === 'Good' ? 'Neutral Good' : 'Neutral'); changed = true; }
        if (/Mutation Points/i.test(last.reason || '') && !addl.mpGrants) { addl.mpGrants = [{ amount: 30, reason: 'gene therapy (gauntlet)', atDate: 'probe' }]; changed = true; }
        if (/Hero class/i.test(last.reason || '') && !steps.some(s => HERO_CLASSES[s.name])) { outSteps = [{ name: 'Strong Hero', levels: 1 }, ...steps]; changed = true; }
        if (changed) return this.build(outSteps, addl);
      }
      return last;
    },
    sbClean(c) {
      try {
        const sb = computeStatBlock(c);
        const vals = { bab: sb.bab.total, fort: sb.fort.total, ref: sb.ref.total, will: sb.will.total, hp: sb.hp.total, ac: sb.ac.total };
        for (const k in vals) if (!Number.isFinite(vals[k])) return `${k} non-finite (${vals[k]})`;
        if (!Number.isFinite(xpThreshold((c.totalLvl || 1) + 1))) return 'xpNext non-finite';
        if (!Number.isFinite(c.ecl)) return 'ecl non-finite';
        if (!(getActiveClassFeatures(c) || []).length) return 'no class features surfaced';
        const cs = computeCasterStats(c);
        for (const p in cs) {
          const pool = cs[p]; if (!pool || !pool.contributors) continue;
          for (const ctr of pool.contributors) {
            for (const f of ['classPP', 'classBonusPP']) if (ctr[f] != null && !Number.isFinite(ctr[f])) return `pool ${p} ${f} non-finite (${ctr.class}) — epic table overrun?`;
          }
        }
        return null;
      } catch (e) { return 'THROW ' + String(e && e.message).slice(0, 120); }
    },
    tryCareer(steps) {
      const r = this.build(steps);
      if (!r.ok) return { built: false, reason: r.reason };
      const err = this.sbClean(r.char);
      return { built: true, clean: !err, reason: err || null, char: err ? null : r.char, totalLvl: r.char ? r.char.totalLvl : null };
    },
    // minimal feeder level for [feeder L, target max]: coarse ladder then refine down.
    minEntry(feeder, target, max, rail) {
      const COARSE = [1, 2, 3, 5, 7, 9, 11, 13, 15, 17, 19, 23, 27, 31, 35].filter(L => L + max <= rail);
      for (const L of COARSE) {
        const r = this.tryCareer([{ name: feeder, levels: L }, { name: target, levels: max }]);
        if (r.built) {
          let best = { L, r };
          for (let d = L - 1; d >= 1; d--) {
            const r2 = this.tryCareer([{ name: feeder, levels: d }, { name: target, levels: max }]);
            if (r2.built) best = { L: d, r: r2 }; else break;
          }
          return best;
        }
      }
      return null;
    },
  };
});

// ---- tier 1+2: Hero → 10, Basic → 20 ----
const simple = await page.evaluate(() => {
  const out = [];
  for (const [tier, db, max] of [['hero', HERO_CLASSES, 10], ['basic', BASIC_CLASSES, 20]]) {
    for (const name of Object.keys(db)) {
      const r = __g.tryCareer([{ name, levels: max }]);
      out.push({ tier, name, max, built: r.built, clean: !!r.clean, reason: r.reason || null, totalLvl: r.totalLvl });
    }
  }
  return out;
});
for (const r of simple) mark(`${r.tier.toUpperCase()}-${r.name}→${r.max}`, r.built && r.clean, r.reason || '');

// ---- tier 3+4: Advanced → 10, Prestige → maxLvl, feeder-searched ----
console.log('\n  … feeder search (advanced + prestige) — this is the long march …');
const searched = await page.evaluate(() => {
  const FEEDERS = [...Object.keys(HERO_CLASSES), ...Object.keys(BASIC_CLASSES)];
  const PAIR_POOL = ['Fighter', 'Rogue', 'Expert', 'Wizard', 'Sorcerer', 'Cleric', 'Saint', 'Bard', 'Psion', 'Wilder', 'Warmind', 'Monk', 'Ranger'];
  const MULTI = new Set(['Metamind', 'Ecclesiarch', 'Archmage']);  // report every variant
  const RAIL = 40;
  const out = [];
  const targets = [
    ...Object.keys(ADVANCED_CLASSES).map(n => ({ tier: 'advanced', name: n, max: 10 })),
    ...Object.keys(PRESTIGE_CLASSES).map(n => ({ tier: 'prestige', name: n, max: (PRESTIGE_CLASSES[n].maxLvl || 10) })),
  ];
  for (const t of targets) {
    const variants = [], reasons = new Map();
    const wantAll = MULTI.has(t.name);
    for (const feeder of FEEDERS) {
      const hit = __g.minEntry(feeder, t.name, t.max, RAIL);
      if (hit) {
        variants.push({ via: feeder, feederLvl: hit.L, total: hit.L + t.max, clean: !!hit.r.clean, issue: hit.r.reason || null });
        if (!wantAll && variants.length >= 2) break;
      } else {
        const probe = __g.tryCareer([{ name: feeder, levels: 7 }, { name: t.name, levels: t.max }]);
        if (!probe.built && probe.reason) reasons.set(probe.reason.slice(0, 110), (reasons.get(probe.reason.slice(0, 110)) || 0) + 1);
      }
    }
    // dual-feeder hunt when singles found nothing
    if (!variants.length) {
      outer:
      for (const a of PAIR_POOL) for (const b of PAIR_POOL) {
        if (a === b) continue;
        for (const [La, Lb] of [[3, 3], [5, 3], [3, 5], [5, 5], [7, 5], [5, 7], [7, 7], [10, 7], [7, 10], [10, 10], [13, 10], [10, 13]]) {
          if (La + Lb + t.max > RAIL) continue;
          const r = __g.tryCareer([{ name: a, levels: La }, { name: b, levels: Lb }, { name: t.name, levels: t.max }]);
          if (r.built) { variants.push({ via: `${a} ${La} + ${b} ${Lb}`, total: La + Lb + t.max, clean: !!r.clean, issue: r.reason || null }); break outer; }
          if (r.reason) reasons.set(r.reason.slice(0, 110), (reasons.get(r.reason.slice(0, 110)) || 0) + 1);
        }
      }
    }
    out.push({ tier: t.tier, name: t.name, max: t.max, variants, topReasons: [...reasons.entries()].sort((x, y) => y[1] - x[1]).slice(0, 2).map(e => e[0]) });
  }
  return { out, builds: __g.buildN };
});
console.log(`  … feeder search complete: ${searched.builds} career builds simulated …\n`);
for (const r of searched.out) {
  const ok = r.variants.length > 0 && r.variants.every(v => v.clean);
  const label = `${r.tier.toUpperCase()}-${r.name}→${r.max}`;
  if (r.variants.length) {
    const vs = r.variants.map(v => `via ${v.via} (entry→total ${v.total}${v.total > 20 ? ' ◆EPIC' : ''})${v.clean ? '' : ' ⚠' + v.issue}`).join(' · ');
    mark(label, ok, vs.slice(0, 220));
  } else {
    mark(label, false, 'NO PATH — ' + (r.topReasons.join(' | ') || 'no reasons captured'));
  }
}

// ---- epic spine assertions on a deliberately-epic career ----
await (async () => {
  const r = await page.evaluate(() => {
    // Wizard 20 then a caster-advancing prestige past it — the table-overrun
    // question (CASTER_PROGRESSION arrays are 20-long, class-level indexed;
    // an advancer pushing EFFECTIVE caster level past 20 must not read off
    // the end). Loremaster advances casting and is 10 deep.
    const t = __g.tryCareer([{ name: 'Wizard', levels: 20 }, { name: 'Loremaster', levels: 10 }]);
    if (!t.built) return { note: 'epic career refused: ' + t.reason };
    if (!t.clean) return { note: 'epic career dirty: ' + t.reason };
    const c = t.char;
    chars.push(c); curId = c.id;
    const bumps = bumpCountForLevel(c.totalLvl);
    const fb = getFeatBudget(c);
    const xpn = xpThreshold(c.totalLvl + 1);
    return { pass: c.totalLvl === 30 && bumps === 7 && Number.isFinite(xpn) && xpn === 1000 * 31 * 30 / 2 && fb.total > 10,
      totalLvl: c.totalLvl, bumps, xpn, featTotal: fb.total };
  });
  mark('EPIC-SPINE-WIZ20-LORE10', r === true || (r && r.pass === true), (r && r.note) || JSON.stringify(r).slice(0, 160));
})();

// ---- render battery on a sample: one per tier + the multi-path three ----
const renders = await page.evaluate(() => {
  const picks = [
    [{ name: 'Strong Hero', levels: 10 }],
    [{ name: 'Fighter', levels: 20 }],
    [{ name: 'Wizard', levels: 20 }, { name: 'Loremaster', levels: 10 }],
  ];
  const out = [];
  for (const steps of picks) {
    const t = __g.tryCareer(steps);
    if (!t.built || !t.clean) { out.push({ steps: steps.map(s => s.name + s.levels).join('/'), err: t.reason }); continue; }
    const c = t.char; chars.push(c); curId = c.id;
    try {
      renderNavTabs(c);
      const pages = ['sheet', 'skills', 'feats', 'gear', 'tracker'];
      for (const p of pages) showPage(p);
      showPage('sheet');
      const txt = document.getElementById('page-sheet').innerText;
      const bad = txt.match(/\bNaN\b|\bundefined\b|\[object Object\]/);
      out.push({ steps: steps.map(s => s.name + s.levels).join('/'), err: bad ? 'sheet text: ' + bad[0] : null });
    } catch (e) { out.push({ steps: steps.map(s => s.name + s.levels).join('/'), err: 'render THROW ' + String(e.message).slice(0, 120) }); }
  }
  localStorage.clear(); chars = []; curId = null;
  return out;
});
for (const r of renders) mark('RENDER-' + r.steps, !r.err, r.err || '');

mark('CONSOLE-CLEAN', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '));

const passed = results.filter(r => r.pass).length;
console.log(`\n== MAX-LEVEL GAUNTLET: ${passed}/${results.length} ==`);
await browser.close();
server.close();
process.exit(passed === results.length ? 0 : 1);
