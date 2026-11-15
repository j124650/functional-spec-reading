#!/usr/bin/env node
/*
 * Bind a contract's views to the page that implements them.
 *
 * The contract says what each view shows. Which TABLE in the page draws
 * it, and which radio group filters it, is not derivable: it is a
 * decision about how the model is presented. So it is written here, once,
 * and written INTO the contract - after which check-contract-vs-page.js
 * can compare the two without guessing which of the page's tables belongs
 * to which view.
 *
 *   node scripts/bind-contract-views.js <contract.json>
 *
 * The mapping below is the presentation decision. Change it when the
 * presentation changes, then re-run the checker.
 */
"use strict";
const fs = require("fs");
const path = require("path");

const contractPath = path.resolve(
  process.argv[2] || path.join(path.resolve(__dirname, ".."), "explorer", "export.contract.json"));

if (!fs.existsSync(contractPath)) {
  console.error("no contract at " + contractPath);
  process.exit(2);
}

/* view id -> the tables it draws into, and the radio groups that filter it. */
const BINDINGS = {
  machines:    { tables: [],                 controls: ["mach"] },
  transitions: { tables: ["tTrans"],         controls: ["transm"] },
  invariants:  { tables: ["tInv"],           controls: ["invk"] },
  reach:       { tables: ["tReach"],         controls: ["reach"] },
  couplings:   { tables: ["tCoup", "tCtx"],  controls: [] },
  findings:    { tables: ["tFind"],          controls: ["fk", "fp"] },
  open:        { tables: ["tOpen", "tCov"],  controls: ["opk"] },
  glossary:    { tables: ["tGlos"],          controls: ["glk"] },
  catalogue:   { tables: ["tCat"],           controls: ["catk"] },
};

const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
let bound = 0;
for (const v of contract["x-views"] || []) {
  const b = BINDINGS[v.id];
  if (!b) { console.error("no binding for view '" + v.id + "'"); process.exit(2); }
  v.tables = b.tables;
  v.controls = b.controls;
  bound++;
}
fs.writeFileSync(contractPath, JSON.stringify(contract, null, 2) + "\n", "utf8");
console.log("bound " + bound + " views to their tables and controls in " +
  path.basename(contractPath));
