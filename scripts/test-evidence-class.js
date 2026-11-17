#!/usr/bin/env node
/* A negative test for check-evidence-class.js.
 *
 *   node scripts/test-evidence-class.js
 *
 * A check that cannot fail is worse than no check: it reports the defect as
 * absent. So each rule the gate enforces is broken on purpose, and the gate
 * must catch every one of them - and must pass the document untouched.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const SKILL = path.resolve(__dirname, "..");
const EX = path.join(SKILL, "examples", "example-domain-model.json");
const SCRATCH = path.join(SKILL, "scratch", "negative-test");
const base = JSON.parse(fs.readFileSync(EX, "utf8"));

const run = (doc) => {
  fs.mkdirSync(SCRATCH, { recursive: true });
  const p = path.join(SCRATCH, "negative.json");
  fs.writeFileSync(p, JSON.stringify(doc, null, 2));
  try {
    const out = execFileSync("node", [path.join(SKILL, "scripts", "check-evidence-class.js"), p], { encoding: "utf8" });
    return { ok: true, out };
  } catch (e) { return { ok: false, out: (e.stdout || "") + (e.stderr || "") }; }
};
const clone = () => JSON.parse(JSON.stringify(base));

const cases = [
  ["EXPLICIT with no citation", (d) => { d.states[0].evidence = []; }],
  ["INFERRED with no rationale", (d) => { d.aggregates[0].classification = "INFERRED"; d.aggregates[0].rationale = ""; }],
  ["CANDIDATE with no rationale", (d) => { d.invariants[1].rationale = ""; }],
  ["a claim with no class", (d) => { d.entities[0].classification = null; }],
  ["UNSPECIFIED with no rationale", (d) => { d.invariants[2].rationale = ""; }]
];

let good = true;
for (const [name, mutate] of cases) {
  const d = clone();
  mutate(d);
  const r = run(d);
  const first = (r.out.split("\n").find((l) => l.includes("  - ")) || "").trim();
  console.log(`${r.ok ? "NOT CAUGHT  " : "caught      "} ${name.padEnd(28)} ${first.slice(0, 92)}`);
  if (r.ok) good = false;
}
const clean = run(clone());
console.log(`\nthe unmodified document: ${clean.ok ? "PASSES (as it should)" : "FAILS (as it should not)"}`);
if (!clean.ok) good = false;
console.log(good ? "\nnegative test: every rule is caught" : "\nnegative test: SOMETHING IS NOT CAUGHT");
process.exit(good ? 0 : 1);
