#!/usr/bin/env node
/* Check that every record cites the spec, and that every citation resolves.
 *
 *   node scripts/check-citation-fidelity.js <source.md> <document.json>
 *
 * Two things, both about the spec being the world:
 *   - a record with no citation says something the document cannot account for;
 *   - a citation that resolves to nothing is a claim about a section that does
 *     not exist.
 *
 * A locator is one section ("§6.3") or one paragraph of the source's own
 * numbering ("PAR-002"), registered in the document's source locator
 * register. A range ("§§4-6") is not one citation and is refused.
 */
"use strict";
const fs = require("fs");

const [, , sourcePath, docPath] = process.argv;
if (!sourcePath || !docPath) {
  console.error("usage: node check-citation-fidelity.js <source.md> <document.json>");
  process.exit(2);
}
const src = fs.readFileSync(sourcePath, "utf8");
const doc = JSON.parse(fs.readFileSync(docPath, "utf8"));

/* the sections the source has */
const sections = new Set();
for (const l of src.split("\n")) {
  const m = l.match(/^#{2,3}\s+(\d+(?:\.\d+)*)\b/);
  if (m) sections.add(m[1]);
}
for (const s of (doc.sources || [])) {
  for (const x of (s.sections || [])) {
    const t = String(x).replace(/^§/, "").trim();
    if (/^\d+(\.\d+)*$/.test(t)) sections.add(t);
  }
}
/* the paragraph locators the document registers */
const parSections = new Map();
for (const r of (doc.sourceLocatorRegister || [])) {
  if (!r || !r.locator) continue;
  parSections.set(String(r.locator), String(r.section || "").replace(/^§/, "").trim());
}
const sourceIds = new Set((doc.sources || []).map(s => s && s.id));

const holes = [];
let records = 0, citations = 0;
for (const [key, rows] of Object.entries(doc)) {
  if (!Array.isArray(rows) || !rows.length) continue;
  const carries = rows.some(r => r && typeof r === "object" && Array.isArray(r.evidence));
  if (!carries) continue;
  for (const r of rows) {
    records++;
    const label = (r && (r.id || r.name || r.term || r.check)) || "?";
    const ev = (r && r.evidence) || [];
    if (!ev.length) { holes.push(`${key} ${label} carries no citation`); continue; }
    for (const e of ev) {
      citations++;
      const loc = String((e && e.locator) || "");
      if (!loc) { holes.push(`${key} ${label} has a citation with no locator`); continue; }
      if (e && e.source && !sourceIds.has(e.source)) {
        holes.push(`${key} ${label} cites ${e.source}, which is not a registered source`);
      }
      if (/§§|\d\s*[-–—]\s*\d/.test(loc)) {
        holes.push(`${key} ${label} cites "${loc}" - a citation names ONE section`);
        continue;
      }
      const sec = loc.replace(/^§/, "").trim();
      if (/^\d+(\.\d+)*$/.test(sec)) {
        if (!sections.has(sec)) holes.push(`${key} ${label} cites §${sec}, which the source does not have`);
        continue;
      }
      if (/^PAR-\d+$/.test(sec)) {
        if (!parSections.has(sec)) holes.push(`${key} ${label} cites ${sec}, which the document's locator register does not carry`);
        continue;
      }
      holes.push(`${key} ${label} cites "${loc}", which is neither a section nor a registered paragraph locator`);
    }
  }
}

console.log(`document: ${docPath}`);
console.log(`  records checked : ${records}`);
console.log(`  citations      : ${citations}`);
console.log(`  sections       : ${sections.size}`);
if (!holes.length) {
  console.log("");
  console.log("OK: every record cites the spec, and every citation resolves.");
  process.exit(0);
}
console.log("");
console.error(`HOLE: ${holes.length} citation(s) do not hold:`);
holes.slice(0, 40).forEach(h => console.error("  " + h));
if (holes.length > 40) console.error(`  ... and ${holes.length - 40} more`);
process.exit(1);
