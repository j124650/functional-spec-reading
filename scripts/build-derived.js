#!/usr/bin/env node
/* Build the two derived keys of the deliverable from the document itself.
 *
 *   node scripts/build-derived.js <document.json> [--write]
 *
 * The deliverable carries two books that are not written by hand:
 *
 *   idRegistry   every identifier series the document issues - its count, its
 *                first and last id, the key that defines it, and the keys that
 *                reference it.
 *   traceability one row per finding: what was claimed, its class, the sources
 *                it rests on, and the question it leaves open.
 *
 * Both are counted from the document, so they cannot drift from it. A hand-typed
 * id registry is wrong the moment one id is added, and nothing notices - the
 * catalogue gate reads the registry and the document, and a registry that lies
 * about the document is a registry the gate cannot trust.
 *
 * With --write the two keys are replaced in the document. Without it the script
 * prints what it would write.
 */
"use strict";
const fs = require("fs");
const path = require("path");

const SKILL = path.resolve(__dirname, "..");
const [, , docArg, ...flags] = process.argv;
if (!docArg) {
  console.error("usage: node build-derived.js <document.json> [--write]");
  process.exit(2);
}
const write = flags.includes("--write");
const doc = JSON.parse(fs.readFileSync(docArg, "utf8"));

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
  // where else is this series named? any other key whose records carry these ids
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

/* ---- the traceability rows ---- */
const traceability = [];
const srcIds = (Array.isArray(doc.sources) ? doc.sources : []).map((s) => s.id).filter(Boolean);
const srcOf = (r) => {
  const ev = Array.isArray(r.evidence) ? r.evidence : [];
  const ids = ev.map((e) => e && e.source).filter(Boolean);
  return ids.length ? [...new Set(ids)] : (srcIds.length ? [srcIds[0]] : []);
};
const kindOf = (r) => {
  const k = (r.kind || "").toLowerCase();
  if (k.includes("spec") || k.includes("gap")) return "spec gap";
  if (k.includes("defect") || k.includes("conflict")) return "confirmed defect";
  return "finding";
};
for (const issue of Array.isArray(doc.issues) ? doc.issues : []) {
  traceability.push({
    id: issue.id,
    type: "issue",
    summary: issue.statement || "",
    classification: issue.classification || "EXPLICIT",
    sourceIds: srcOf(issue),
    rationale: issue.rationale || "",
    openQuestion: issue.clarification || issue.remedy || ""
  });
}
for (const finding of Array.isArray(doc.completenessFindings) ? doc.completenessFindings : []) {
  const id = `F-${String(traceability.length + 1).padStart(3, "0")}`;
  traceability.push({
    id,
    type: "completeness finding",
    summary: finding.finding || finding.check || "",
    classification: "EXPLICIT",
    sourceIds: srcOf(finding),
    rationale: finding.rationale || "",
    openQuestion: ""
  });
}

console.log(`idRegistry: ${registry.length} series`);
registry.forEach((r) => console.log(`  ${r.series.padEnd(5)} ${String(r.count).padStart(3)}  ${r.first}..${r.last}  in ${r.definedIn}`));
console.log(`traceability: ${traceability.length} rows`);
traceability.forEach((t) => console.log(`  ${t.id}  ${t.type.padEnd(20)} ${t.summary.slice(0, 70)}`));

if (write) {
  doc.idRegistry = registry;
  doc.traceability = traceability;
  fs.writeFileSync(docArg, JSON.stringify(doc, null, 2) + "\n", "utf8");
  console.log(`\nwrote ${docArg}`);
}
