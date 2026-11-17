#!/usr/bin/env node
/* Build the two derived keys of the deliverable FROM the deliverable.
 *
 *   node scripts/build-derived.js <document.json> [--fragments <dir>]
 *
 * The deliverable carries two books that are counted, not written:
 *
 *   idRegistry   every identifier series the document issues - its count, its
 *                first and last id, the key that defines it, and the keys that
 *                reference it.
 *   traceability one row per CLAIM: the record's own id, the series it belongs
 *                to, a summary, its evidence class, the sources it rests on and
 *                its rationale. The id is a REFERENCE - the id of the record
 *                the row traces - never a new one.
 *
 * Both are counted from the document, so they cannot drift from it. A hand-typed
 * id registry is wrong the moment one id is added, and nothing notices - the
 * catalogue gate reads the registry and the document, and a registry that lies
 * about the document is a registry the gate cannot trust.
 *
 * With --fragments <dir> the two books are written as FRAGMENTS - the same files
 * the rest of the deliverable is written as - so the deliverable stays derived
 * from its fragments and a rebuild cannot drop them. Without it the script only
 * prints what it would write.
 */
"use strict";
const fs = require("fs");
const path = require("path");

const SKILL = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const docArg = args[0];
if (!docArg) {
  console.error("usage: node build-derived.js <document.json> [--fragments <dir>]");
  process.exit(2);
}
const fragIndex = args.indexOf("--fragments");
const fragDir = fragIndex >= 0 ? args[fragIndex + 1] : null;
const doc = JSON.parse(fs.readFileSync(docArg, "utf8"));
const tpl = JSON.parse(fs.readFileSync(path.join(SKILL, "templates", "domain-model-template.json"), "utf8"));

/* ---- which key issues which series ---- */
const SERIES = [
  ["SRC", "sources"], ["PAR", "sourceLocatorRegister"], ["TERM", "glossary"],
  ["N", "nonAggregateCandidates"], ["CON", "domainConcepts"], ["ENT", "entities"],
  ["VO", "valueObjects"], ["BC", "boundedContexts"], ["AGG", "aggregates"],
  ["CMD", "commands"], ["EVT", "domainEvents"], ["POL", "policies"],
  ["SM", "stateMachines"], ["ST", "states"], ["TR", "transitions"],
  ["INV", "invariants"], ["SCN", "scenarios"], ["F", "issues"], ["Q", "questions"]
];
const idOf = (r) => (r && typeof r === "object" && typeof r.id === "string" ? r.id : null);
const numOf = (id) => {
  const m = /-(\d+)$/.exec(id || "");
  return m ? parseInt(m[1], 10) : null;
};

/* ---- the id registry ---- */
const registry = [];
for (const [series, key] of SERIES) {
  const rows = Array.isArray(doc[key]) ? doc[key] : [];
  const ids = rows.map(idOf).filter(Boolean);
  if (!ids.length) continue;
  const nums = ids.map(numOf).filter((n) => n !== null);
  const sorted = nums.length ? ids.slice().sort((a, b) => numOf(a) - numOf(b)) : ids.slice().sort();
  const referencedFrom = [];
  for (const [otherKey, otherRows] of Object.entries(doc)) {
    if (otherKey === key || !Array.isArray(otherRows)) continue;
    const text = JSON.stringify(otherRows);
    if (ids.some((id) => text.includes(`"${id}"`))) referencedFrom.push(otherKey);
  }
  registry.push({
    series,
    count: ids.length,
    first: sorted[0],
    last: sorted[sorted.length - 1],
    definedIn: key,
    crossReferencedFrom: referencedFrom
  });
}

/* ---- the traceability rows: one per CLAIM, referencing the claim's own id ---- */
const DERIVED = new Set(["traceability", "idRegistry"]);
const summaryOf = (r) => r.statement || r.summary || r.meaning || r.name || r.term || r.word || r.finding || r.check || "";
const traceability = [];
for (const [key, template] of Object.entries(tpl)) {
  if (!Array.isArray(template) || !template.length || typeof template[0] !== "object") continue;
  if (DERIVED.has(key)) continue;
  if (!("classification" in template[0])) continue;
  const rows = Array.isArray(doc[key]) ? doc[key] : [];
  rows.forEach((r) => {
    const id = idOf(r);
    if (!id) return;                       // a record with no id traces nothing
    const ev = Array.isArray(r.evidence) ? r.evidence : [];
    const sourceIds = [...new Set(ev.map((e) => e && e.source).filter(Boolean))];
    traceability.push({
      id,
      type: key,
      summary: summaryOf(r),
      // a record that declares no class is not an explicit claim: a question
      // traces a silence, not a fact
      classification: r.classification || "UNSPECIFIED",
      sourceIds,
      rationale: typeof r.rationale === "string" ? r.rationale : "",
      openQuestion: r.proposedClarification || r.clarification || r.decisionNeeded || ""
    });
  });
}

console.log(`idRegistry: ${registry.length} series`);
registry.forEach((r) => console.log(`  ${r.series.padEnd(5)} ${String(r.count).padStart(3)}  ${r.first}..${r.last}  in ${r.definedIn}`));
console.log(`traceability: ${traceability.length} rows (one per claim)`);
traceability.forEach((t) => console.log(`  ${t.id.padEnd(8)} ${t.type.padEnd(16)} ${String(t.classification).padEnd(11)} ${t.summary.slice(0, 54)}`));

if (fragDir) {
  fs.mkdirSync(fragDir, { recursive: true });
  const write = (name, value) => {
    fs.writeFileSync(path.join(fragDir, name), JSON.stringify(value, null, 2) + "\n", "utf8");
    console.log(`wrote ${path.join(fragDir, name)}`);
  };
  write("10-traceability.json", traceability);
  write("10-idRegistry.json", registry);
} else {
  console.log("\n(no --fragments given: nothing written)");
}
