// _probe_loom.mjs — GMF v0.9.0: THE LOOM (Adam's gavel 2026-11-03). Asserts:
// the tab exists and opens; the payload carries the full taxonomy (17
// skeletons × axes, 16 twists, 10 subplots, 18 genre skins); Weave! rolls
// unlocked dials and a locked thread survives it; the premise assembles from
// the picked fragments; genre skin + flip + register render; the copy text is
// well-formed; the version stamp propagated (subtitle AND foot — the foot had
// been hardcoded v0.8.0 since Table Ops); console clean. Serves over local
// HTTP; window.print + mailto stubbed per the §276/§280 protocol-handoff law.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import puppeteer from 'puppeteer';

const html = readFileSync('C:/Users/adam_/EE/EE-GM-Familiar/gmf.html');
const server = createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); });
await new Promise(r => server.listen(8795, '127.0.0.1', r));

const results = [];
const mark = (id, pass, note = '') => { results.push({ id, pass }); console.log(`${pass ? '  ✓' : '  ✗ FAIL'} ${id}${note ? ' — ' + note : ''}`); };

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) consoleErrors.push(m.text().slice(0, 200)); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + String(e).slice(0, 200)));
await page.evaluateOnNewDocument(() => {
  window.print = () => {};
  const orig = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { if ((this.href || '').startsWith('mailto:')) return; return orig.apply(this, arguments); };
});
await page.goto('http://127.0.0.1:8795/', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('typeof LOOM !== "undefined" && typeof loWeave === "function"', { timeout: 60000 });

const t = async (id, fn) => { try { const r = await page.evaluate(fn); mark(id, r === true || (r && r.pass === true), (r && r.note) || (r === true ? '' : JSON.stringify(r).slice(0, 200))); } catch (e) { mark(id, false, String(e).slice(0, 200)); } };

await t('TAB-OPENS', () => {
  show('loom');
  return (document.getElementById('pg-loom').style.display !== 'none'
    && document.getElementById('tab-loom').classList.contains('on')) || { shown: document.getElementById('pg-loom').style.display };
});
await t('TAXONOMY-COUNTS', () => {
  const axCounts = LOOM.skeletons.map(s => s.axes.length);
  return (LOOM.skeletons.length === 17 && LOOM.twists.length === 16 && LOOM.subplots.length === 10
    && LOOM.genres.length === 18 && LOOM.acts.length === 5 && axCounts.every(n => n >= 2))
    || { sk: LOOM.skeletons.length, tw: LOOM.twists.length, sub: LOOM.subplots.length, g: LOOM.genres.length };
});
await t('GAP-SLATE-PRESENT', () => {
  const ids = LOOM.skeletons.map(s => s.id);
  const gaps = ['serpent', 'table', 'sting', 'seven', 'deluge', 'longnight', 'reckoning', 'throne'];
  return gaps.every(g => ids.includes(g)) || { missing: gaps.filter(g => !ids.includes(g)) };
});
await t('PREMISE-ASSEMBLES', () => {
  loPickSk(0);
  const s = loSkel();
  const p = loPremise();
  return (p.includes(s.axes[0].opt[0].f) && !/\{\w+\}/.test(p)) || { p: p.slice(0, 120) };
});
await t('LOCK-SURVIVES-WEAVE', () => {
  loPickSk(2);
  loWeave();
  const ax0 = loSkel().axes[0].id;
  const held = LO.picks[ax0];
  loLock(ax0);
  let moved = false;
  for (let i = 0; i < 12; i++) { loWeave(); if (LO.picks[ax0] !== held) moved = true; }
  return (!moved && LO.twist >= 0) || { moved, twist: LO.twist };
});
await t('GENRE-FLIP-REGISTER-RENDER', () => {
  document.getElementById('lo-genre').value = '17'; // Universe City, the house setting
  document.getElementById('lo-reg').value = 'comedy';
  document.getElementById('lo-flip').checked = true;
  loSet();
  const h = document.getElementById('lo-out').innerHTML;
  return (h.includes('Universe City') && h.includes('AS 9') && h.includes('laughs') && h.includes('THE FLIP'))
    || { genre: h.includes('Universe City'), flip: h.includes('THE FLIP') };
});
await t('SUBPLOT-DECK-DEALS-UNIQUE', () => {
  loClearSubs();
  for (let i = 0; i < 12; i++) loDealSub(); // deck holds 10 — over-dealing must not duplicate
  return (LO.subs.length === 10 && new Set(LO.subs).size === 10) || { dealt: LO.subs.length };
});
await t('COPY-TEXT-SHAPE', () => {
  const txt = loText();
  return (txt.startsWith('THE LOOM — ') && txt.includes('Genre: Universe City') && /Subplot: /.test(txt)
    && txt.includes('gm.epicsandepochs.com')) || { head: txt.split('\n')[0] };
});
await t('VERSION-STAMPED-TWICE', () => {
  const sub = document.querySelector('.subtitle').textContent, foot = document.querySelector('.foot').textContent;
  return (/v0\.\d+\.\d+/.test(sub) && /v0\.\d+\.\d+/.test(foot) && !/v0\.8\.0/.test(foot) && sub.includes('Loom'))
    || { sub: sub.slice(0, 60), foot: foot.slice(0, 60) };
});
// v0.9.1: glosses, the tutorial, and the acknowledgement in professional form
await t('GLOSS-ON-EVERY-SKELETON', () => {
  const bare = LOOM.skeletons.filter(s => !s.gloss || s.gloss.length < 80).map(s => s.id);
  loPickSk(0);
  const shown = document.getElementById('lo-out').innerHTML.includes('At the table:');
  return (bare.length === 0 && shown) || { bare, shown };
});
await t('TUTORIAL-PRESENT-AND-PERSISTS', () => {
  const tut = document.getElementById('tut-loom');
  const hasCore = ['skeleton', 'Weave!', 'lock', 'twist', 'Subplots', 'genre skin', 'Three-Act'].every(k => tut.textContent.includes(k));
  tut.open = false; tutToggle(tut);
  const stored = localStorage.getItem('gmf_ui_tut_tut-loom') === '0';
  tut.open = true; tutToggle(tut);
  return (hasCore && stored) || { hasCore, stored };
});
// v0.9.2 THE DOCENT PASS: every tab carries its ⓘ tutorial, none says "gentle"
await t('TUTORIALS-EVERYWHERE', () => {
  const tabs = ['bestiary', 'forge', 'ops', 'stage', 'library', 'academy', 'loom', 'adjudicator'];
  const missing = tabs.filter(t2 => !document.getElementById('tut-' + t2));
  const allCards = [...document.querySelectorAll('details.tut')];
  const patronizing = allCards.filter(d => /gentle/i.test(d.querySelector('summary').textContent)).length;
  const substantive = allCards.every(d => d.querySelector('.body').textContent.length > 300);
  return (missing.length === 0 && allCards.length === 8 && patronizing === 0 && substantive)
    || { missing, n: allCards.length, patronizing, substantive };
});
await t('TUT-PERSISTENCE-PER-TAB', () => {
  const d = document.getElementById('tut-forge');
  d.open = false; tutToggle(d);
  const closed = localStorage.getItem('gmf_ui_tut_tut-forge') === '0';
  initTuts();
  const stayedClosed = d.open === false && document.getElementById('tut-stage').open === true;
  d.open = true; tutToggle(d);
  return (closed && stayedClosed) || { closed, stayedClosed };
});
// v0.9.4 FATE'S D20 (Adam's gavel 2026-11-05): dead d20 space reclaimed —
// 18-19 Red Herring (façade + GM-only truth), nat 20 Close to Home (roster
// hero; re-roll disregards only 20s, so a herring can nest ONCE). Seeded rng.
await t('FATE-DATA-PRESENT', () => {
  const f = LOOM.fate;
  return (!!f && f.herring.n === 'Red Herring' && f.home.n === 'Close to Home'
    && f.herring.d.length > 80 && f.home.d.length > 60 && f.homeHerring.length > 40)
    || { keys: f ? Object.keys(f) : null };
});
await t('FATE-STRAIGHT', () => {
  const q = [13.5 / 20]; // d20 = 14 → skeleton index 13
  loFate(() => q.length ? q.shift() : 0.1);
  const h = document.getElementById('lo-out').innerHTML;
  return (LO.fate && LO.fate.kind === 'straight' && LO.fate.d20 === 14 && LO.sk === 13
    && h.includes("Fate's d20: 14") && !h.includes('Beneath the weave'))
    || { fate: LO.fate, sk: LO.sk };
});
await t('FATE-HERRING', () => {
  // d20=18; façade sk d(17) from 0.2→3; axes/twist 0.1s; truth sk 0.5→8 ≠ 3
  const q = [17.2 / 20, 0.2];
  let phase = 0;
  loFate(() => q.length ? q.shift() : (phase++ < 20 ? 0.1 : 0.5));
  const F = LO.fate, h = document.getElementById('lo-out').innerHTML;
  const tp = F && F.truth ? loPremiseOf(LOOM.skeletons[F.truth.sk], F.truth.picks) : '';
  return (F && F.kind === 'herring' && F.d20 === 18 && F.truth && F.truth.sk !== LO.sk
    && h.includes('Red Herring') && h.includes('Beneath the weave') && h.includes("GM's eyes only")
    && tp.length > 20 && !/\{\w+\}/.test(tp))
    || { kind: F && F.kind, truthSk: F && F.truth && F.truth.sk, sk: LO.sk };
});
await t('FATE-TRUTH-SURVIVES-WEAVE', () => {
  const F = LO.fate, held = { sk: F.truth.sk, twist: F.truth.twist, p: JSON.stringify(F.truth.picks) };
  for (let i = 0; i < 5; i++) loWeave();
  return (LO.fate === F && F.truth.sk === held.sk && F.truth.twist === held.twist
    && JSON.stringify(F.truth.picks) === held.p)
    || { held, now: F.truth };
});
await t('FATE-FLIP-MOVES-BENEATH', () => {
  document.getElementById('lo-flip').checked = true; loSet();
  const h = document.getElementById('lo-out').innerHTML, txt = loText();
  const inTruth = h.includes('the façade stays upright');
  const gmBlock = txt.indexOf('[GM ONLY — BENEATH THE WEAVE]');
  const flipAfterGm = gmBlock >= 0 && txt.indexOf('THE FLIP', gmBlock) > gmBlock;
  const flipBeforeGm = txt.slice(0, gmBlock).includes('THE FLIP');
  document.getElementById('lo-flip').checked = false; loSet();
  return (inTruth && flipAfterGm && !flipBeforeGm) || { inTruth, flipAfterGm, flipBeforeGm };
});
await t('FATE-HOME-NO-ROSTER', () => {
  const save = ROSTER.splice(0, ROSTER.length); // empty the roster
  const q = [19.5 / 20, 2.5 / 19]; // d20=20; sub d(19)=3 → skeleton index 2
  loFate(() => q.length ? q.shift() : 0.1);
  const F = LO.fate, h = document.getElementById('lo-out').innerHTML;
  ROSTER.push(...save);
  return (F && F.kind === 'home' && !F.nested && F.pc === null && LO.sk === 2
    && h.includes('Close to Home') && h.includes('roll among the players') && !h.includes('Beneath the weave'))
    || { kind: F && F.kind, pc: F && F.pc, sk: LO.sk };
});
await t('FATE-HOME-NAMES-THE-HERO', () => {
  const save = ROSTER.splice(0, ROSTER.length);
  ROSTER.push({ name: 'Xander', ecl: 5 });
  const q = [19.5 / 20, 0, 4.5 / 19]; // d20=20; pc d(1)=0 → Xander; sub=5
  loFate(() => q.length ? q.shift() : 0.1);
  const F = LO.fate, h = document.getElementById('lo-out').innerHTML, txt = loText();
  ROSTER.splice(0, ROSTER.length); ROSTER.push(...save);
  return (F && F.pc === 'Xander' && h.includes('<b>Xander</b>') && txt.includes('This one belongs to Xander'))
    || { pc: F && F.pc };
});
await t('FATE-HOME-HERRING-NESTS-ONCE', () => {
  const save = ROSTER.splice(0, ROSTER.length);
  // d20=20; pc skipped (empty roster); sub d(19)=18 → herring; façade 0.2→3; truth 0.5→8
  const q = [19.5 / 20, 17.5 / 19, 0.2];
  let n = 0;
  loFate(() => q.length ? q.shift() : (n++ < 20 ? 0.1 : 0.5));
  const F = LO.fate, h = document.getElementById('lo-out').innerHTML, txt = loText();
  ROSTER.push(...save);
  return (F && F.kind === 'home' && F.nested === true && F.truth && F.truth.sk !== LO.sk
    && h.includes('Close to Home') && h.includes('Red Herring') && h.includes('Rarest weave of all')
    && txt.includes('CLOSE TO HOME') && txt.includes('[GM ONLY — BENEATH THE WEAVE]'))
    || { kind: F && F.kind, nested: F && F.nested };
});
await t('FATE-CLEARS-ON-MANUAL-PICK', () => {
  loPickSk(0);
  const h = document.getElementById('lo-out').innerHTML;
  return (LO.fate === null && !h.includes("Fate's d20") && !h.includes('Beneath the weave'))
    || { fate: LO.fate };
});
await t('ACKNOWLEDGEMENT-PROFESSIONAL-FORM', () => {
  const c = LOOM.credit;
  return (c.includes('S. John Ross') && c.includes('Cumberland Games') && c.includes('1999')
    && c.includes('ghalev.itch.io') && /not affiliated/i.test(c) && /no endorsement/i.test(c))
    || { c: c.slice(0, 120) };
});
mark('CONSOLE-CLEAN', consoleErrors.length === 0, consoleErrors[0] || '');

const passed = results.filter(r => r.pass).length;
console.log(`\n== LOOM PROBE: ${passed}/${results.length} ==`);
await browser.close();
server.close();
process.exit(passed === results.length ? 0 : 1);
