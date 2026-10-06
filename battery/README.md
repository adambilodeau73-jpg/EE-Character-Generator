# E&E Headless Battery

Boots the real Character Generator in headless Chromium and proves it against
`oracle.json` — book-truth assertions harvested from the rulings ledger — then
fuzzes seeded random character builds through the generator's own validated
creation path (`qdBespokeBuild`) asserting cross-cutting invariants (no NaN on
any rendered Sheet, finite saves, non-negative MP ledgers, serialization
round-trip stability, console silence).

```
cd battery && npm install
npm test                        # battery vs ../index.html (the deployed build)
node battery.mjs --n 300 --seed 42 --json report.json
node battery.mjs --file ../path/to/candidate.html   # battery a staged version
```

Exit 0 = green. Oracle entries marked `declared` are recorded truths awaiting
implemented checks — honest debt, counted in every report. Runs identically on
a cloud clone: `gh repo clone adambilodeau73-jpg/EE-Character-Generator && cd
EE-Character-Generator/battery && npm install && npm test`.

First conviction (2026-10-04, the battery's maiden run): `qdBespokeBuild`
accepted ladder steps with undefined `levels` (`undefined < 1` is false) and
built NaN-grade characters — guarded in generator v8.89.1;
`BESPOKE-REJECTS-MALFORMED` holds the line forever after.

## Suite 1b — the debt paid (2026-10-06)
All nine oracle entries once `declared` (MAX-RANKS, IMPROVED-GRAPPLE,
RECKLESS-ATTACK-ONLY, EVASION-UNIFIED, UNNATURAL-FORMULAS, DR-CLASS-POOL,
SUITE-DISCOUNT, SELLERS-MARKET, TIER-CEILING-ONLY) are now executable checks.
All nine held on v9.0.1 — wired correctly, now locked in.

## Suite 3 — the grant audit (2026-10-06)
Hunts the Rhad pattern (§243: a grant stored where no consumer reads it)
wholesale. `grant_audit.page.js` grants every feat, talent, cybernetic and
mutation (474) alone to a fresh Fighter 4/Expert 2 and fingerprints every
engine output. An entry whose text claims a number but moves nothing must be
listed in `grant_audit_allow.json` as `table` (resolved at the table by
design), `fixture` (wired, but the fixture can't exercise it — verified by
hand), or `open` (a known gap, also carried as `declared` in the oracle).
Anything unlisted fails the battery. When an `open` entry gets wired the
report says `★ now engine-visible — retire from the allowlist`.

Proof: run against v8.98.0, it flags Feat Implant, Psi Implant, Mindscreen
Implant and Targeting Optics — exactly the four v8.99.0 wired after Rhad's
playtest. It would have caught the bug before the table did.
