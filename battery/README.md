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
