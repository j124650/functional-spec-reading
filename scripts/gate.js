#!/usr/bin/env node
/* Run every gate, once, and report them together.
 *
 *   node scripts/gate.js <document.json> [source.md] [export.json] [page.html]
 *
 * A gate that needs an input it was not given is skipped, and says so. The
 * point is that a run verifies itself in ONE call: the gates are the exact
 * part of the process, and calling each one separately costs a turn and
 * re-feeds the context every time.
 */
"use strict";
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const SKILL = path.resolve(__dirname, "..");
const [, , doc, source, exportJson, page] = process.argv;
if (!doc) {
  console.error("usage: node gate.js <document.json> [source.md] [export.json] [page.html]");
  process.exit(2);
}
const CONTRACT = path.join(SKILL, "explorer", "export.contract.json");

const GATES = [
  { name: "check-model-expressions", args: [doc], files: [doc] },
  { name: "check-source-coverage", args: source ? [source, doc] : null, files: source ? [source, doc] : [] },
  { name: "check-section-accountability", args: source ? [source, doc] : null, files: source ? [source, doc] : [] },
  { name: "check-citation-fidelity", args: source ? [source, doc] : null, files: source ? [source, doc] : [] },
  { name: "check-scope-resolution", args: exportJson ? [exportJson] : null, files: exportJson ? [exportJson] : [] },
  { name: "check-export-contract", args: exportJson ? [exportJson] : null, files: exportJson ? [exportJson] : [] },
  { name: "check-contract-vs-page", args: page ? [CONTRACT, page] : null, files: page ? [page] : [] },
  { name: "check-explorer", args: page ? [page, doc] : null, files: page ? [page, doc] : [] },
  { name: "check-id-catalogue", args: page ? [page, doc] : null, files: page ? [page, doc] : [] },
];

let passed = 0, failed = 0, skipped = 0;
for (const g of GATES) {
  const script = path.join(SKILL, "scripts", g.name + ".js");
  if (!fs.existsSync(script)) { console.log(`SKIP  ${g.name} (not in this skill)`); skipped++; continue; }
  if (!g.args) { console.log(`SKIP  ${g.name} (no input given)`); skipped++; continue; }
  const absent = (g.files || []).filter(f => !fs.existsSync(f));
  if (absent.length) {
    console.log(`SKIP  ${g.name} (input not found: ${absent.map(f => path.basename(f)).join(", ")})`);
    skipped++; continue;
  }
  const r = spawnSync(process.execPath, [script, ...g.args], { encoding: "utf8" });
  const out = ((r.stdout || "") + (r.stderr || "")).trim();
  if (r.status === 0) { console.log(`PASS  ${g.name}`); passed++; continue; }
  failed++;
  console.log(`FAIL  ${g.name}  (exit ${r.status})`);
  out.split("\n").slice(0, 40).forEach(l => console.log("      " + l));
}
console.log("");
console.log(`${passed} passed, ${failed} failed, ${skipped} skipped`);
process.exit(failed ? 1 : 0);
