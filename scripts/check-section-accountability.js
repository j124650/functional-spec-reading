#!/usr/bin/env node
/* Check that every section of the source is accounted for.
 *
 *   node scripts/check-section-accountability.js <source.md> <document.json>
 *
 * The coverage gate asks about the source's TABLES. This asks about its
 * SECTIONS, because a specification states most of what it states in prose:
 * a section nobody cites, and no finding declares, is a part of the source the
 * model did not read.
 *
 * A section is:
 *   - modelled, when a record cites it (or a subsection of it);
 *   - declared, when only a completeness finding cites it - the model says
 *     what it did with it;
 *   - a HOLE, when nothing cites it at all.
 */
"use strict";
const fs = require("fs");

const [, , sourcePath, docPath] = process.argv;
if (!sourcePath || !docPath) {
  console.error("usage: node check-section-accountability.js <source.md> <document.json>");
  process.exit(2);
}
const src = fs.readFileSync(sourcePath, "utf8");
const doc = JSON.parse(fs.readFileSync(docPath, "utf8"));

/* the sections, from the source's own headings */
const headings = new Map();
for (const l of src.split("\n")) {
  const m = l.match(/^#{2,3}\s+(\d+(?:\.\d+)*)\b\s*(.*)$/);
  if (m) headings.set(m[1], m[2].trim());
}
/* the sections the document's source record claims the source has */
const declared = [];
for (const s of (doc.sources || [])) {
  for (const x of (s.sections || [])) {
    const t = String(x).replace(/^§/, "").trim();
    if (/^\d+(\.\d+)*$/.test(t)) declared.push(t);
  }
}
/* paragraph locators resolve to a section */
const parSection = new Map();
for (const r of (doc.sourceLocatorRegister || [])) {
  if (r && r.locator) parSection.set(String(r.locator), String(r.section || "").replace(/^§/, "").trim());
}

const modelled = new Set(), declaredOnly = new Set();
const cites = (loc) => {
  const s = String(loc || "").replace(/^§/, "").trim();
  if (/^PAR-\d+$/.test(s)) return parSection.get(s) || "";
  return s;
};
for (const [key, rows] of Object.entries(doc)) {
  if (!Array.isArray(rows)) continue;
  const isFinding = key === "completenessFindings";
  for (const r of rows) {
    for (const e of ((r && r.evidence) || [])) {
      const sec = cites(e && e.locator);
      if (!sec || !/^\d/.test(sec)) continue;
      const top = sec.split(".")[0];
      (isFinding ? declaredOnly : modelled).add(top);
      modelled.add(top);            /* a finding that cites it still shows the section was read */
    }
  }
}

const sections = new Set([...headings.keys(), ...declared]);
const holes = [], accounted = [], onlyDeclared = [];
for (const sec of [...sections].sort()) {
  const top = sec.split(".")[0];
  const title = headings.get(sec) || "";
  if (modelled.has(top)) accounted.push(sec);
  else if (declaredOnly.has(top)) onlyDeclared.push(sec);
  else holes.push(`§${sec}${title ? " - " + title : ""}`);
}

console.log(`source:  ${sourcePath}`);
console.log(`document: ${docPath}`);
console.log(`  sections in the source : ${sections.size}`);
console.log(`  accounted for           : ${accounted.length}`);
console.log(`  declared, not modelled : ${onlyDeclared.length}`);
if (!holes.length) {
  console.log("");
  console.log("OK: every section of the source is accounted for.");
  process.exit(0);
}
console.log("");
console.error(`HOLE: ${holes.length} section(s) of the source are in no record and in no finding:`);
holes.forEach(h => console.error("  " + h));
console.error("");
console.error("A section nobody cites is a part of the source the model did not read.");
process.exit(1);
