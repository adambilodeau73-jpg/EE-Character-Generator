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
mark('CONSOLE-CLEAN', consoleErrors.length === 0, consoleErrors[0] || '');

const passed = results.filter(r => r.pass).length;
console.log(`\n== LOOM PROBE: ${passed}/${results.length} ==`);
await browser.close();
server.close();
process.exit(passed === results.length ? 0 : 1);
