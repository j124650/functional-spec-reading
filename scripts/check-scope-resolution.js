#!/usr/bin/env node
/* Report the scopes that resolved to NOTHING.
 *
 * An invariant's scope says where its rule holds - in a state, or as a
 * precondition of a move. The exporter resolves that scope into ids, and a
 * resolution that matches nothing is INVISIBLE inside a prose string: the cell
 * reads like it resolved, and the rule quietly holds nowhere.
 *
 * The scope ships as two lists - the states it holds in, and the transitions
 * it guards - and a scope that covers EVERYTHING ships the states it holds in,
 * so an empty pair of lists means exactly one thing: the scope named nothing.
 *
 * The usual cause is a word the resolver matches too narrowly. "submit" does
 * not match "Resubmit" under a whole-word test, so a cell naming "Returned to
 * Sales -> submit" resolves to nothing while the transition it means is right
 * there in the document.
 *
 * Usage:  node scripts/check-scope-resolution.js <export.json>
 * Exits non-zero when a scope resolves to nothing.
 */
"use strict";
const fs = require("fs");

const path = process.argv[2];
if (!path) {
  console.error("usage: node check-scope-resolution.js <export.json>");
  process.exit(2);
}
const doc = JSON.parse(fs.readFileSync(path, "utf8"));
const invariants = doc.invariants || [];
const bad = [];

for (const inv of invariants) {
  const scope = inv.appliesTo;
  if (!scope) continue;
  const states = scope.states || [];
  const transitions = scope.transitions || [];
  /* Both lists empty is the whole test: a scope that covers everything
     ships the states it covers, so it is never empty by accident. */
  if (states.length === 0 && transitions.length === 0)
    bad.push(
      inv.id + "  the scope names no state and no transition   " +
      String(inv.text || "").slice(0, 80)
    );
}

if (bad.length === 0) {
  console.log("every scope resolved to at least one id (" +
    invariants.length + " invariant(s))");
  process.exit(0);
}
console.error(bad.length + " scope(s) resolved to nothing:");
for (const line of bad) console.error("  " + line);
process.exit(1);
