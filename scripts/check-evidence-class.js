#!/usr/bin/env node
/* Check that a record's EVIDENCE CLASS matches the evidence it carries.
 *
 *   node scripts/check-evidence-class.js <document.json>
 *
 * The skill's whole subject is honesty about evidence: never present an
 * inferred rule as an explicit requirement, and declare the gaps the source
 * leaves open rather than inventing an answer. That rule was written in three
 * places and checked in none - the assembler checks that the `rationale`
 * FIELD exists, not that it says anything.
 *
 * So the obligation is stated here, per class:
 *
 *   EXPLICIT    the source says it      -> at least one citation
 *   INFERRED    you derived it          -> a citation AND a reasoning chain
 *   CANDIDATE   it needs confirmation   -> a citation AND what would confirm it
 *   CONFLICTING the source disagrees     -> a citation
 *   UNSPECIFIED the source is silent    -> the record DECLARES the silence:
 *                                          a rationale, or it is a question,
 *                                          a gap, an undefined term, a
 *                                          referenced-but-not-supplied artefact
 *                                          or a completeness finding
 *
 * A record that asserts something with no class at all is a defect too: a
 * claim with no class is a claim with no declared warrant.
 *
 * The two derived keys - `traceability` and `idRegistry` - are not claims; they
 * are counted from the claims, so they are not checked here.
 */
"use strict";
const fs = require("fs");
const path = require("path");

const SKILL = path.resolve(__dirname, "..");
const [, , docArg] = process.argv;
if (!docArg) {
  console.error("usage: node check-evidence-class.js <document.json>");
  process.exit(2);
}
const doc = JSON.parse(fs.readFileSync(docArg, "utf8"));
const tpl = JSON.parse(fs.readFileSync(path.join(SKILL, "templates", "domain-model-template.json"), "utf8"));

const CLASSES = ["EXPLICIT", "INFERRED", "CANDIDATE", "CONFLICTING", "UNSPECIFIED"];
/* keys whose records DECLARE something rather than assert it */
const DECLARATIONS = new Set(["questions", "undefinedTerms", "referencedButNotSupplied", "completenessFindings"]);
/* an issue of kind SpecGap declares a silence; a ConfirmedDefect asserts a conflict */
const isDeclaration = (key, r) => DECLARATIONS.has(key) ||
  (key === "issues" && String(r.kind || "").toLowerCase().includes("specgap"));
const DERIVED = new Set(["traceability", "idRegistry"]);

const problems = [];
const cited = (r) => (Array.isArray(r.evidence) ? r.evidence : []).filter(e => e && e.source && e.locator);
const rationale = (r) => (typeof r.rationale === "string" ? r.rationale.trim() : "");
const label = (r, i) => r.id || r.name || r.term || r.word || r.check || `#${i}`;

let checked = 0;
for (const [key, template] of Object.entries(tpl)) {
  if (!Array.isArray(template) || !template.length || typeof template[0] !== "object") continue;
  if (!("classification" in template[0])) continue;
  if (DERIVED.has(key)) continue;
  const rows = Array.isArray(doc[key]) ? doc[key] : [];
  rows.forEach((r, i) => {
    if (!r || typeof r !== "object") return;
    checked++;
    const cls = r.classification;
    const where = `${key}[${i}] (${label(r, i)})`;
    if (cls === null || cls === undefined || cls === "") {
      if (!isDeclaration(key, r)) {
        problems.push(`${where}: it makes a claim with no evidence class - a claim with no declared warrant`);
      }
      return;
    }
    if (!CLASSES.includes(cls)) {
      problems.push(`${where}: the evidence class "${cls}" is not one of ${CLASSES.join(", ")}`);
      return;
    }
    if (cls === "EXPLICIT" || cls === "CONFLICTING") {
      if (!cited(r).length) {
        problems.push(`${where}: it is ${cls}, so the source must say it - it carries no citation`);
      }
      return;
    }
    if (cls === "INFERRED" || cls === "CANDIDATE") {
      if (!cited(r).length) {
        problems.push(`${where}: it is ${cls}, so it must rest on something the source says - it carries no citation`);
      }
      if (!rationale(r)) {
        problems.push(`${where}: it is ${cls}, so it must carry a rationale - ${cls === "CANDIDATE" ? "say what would confirm it" : "show the reasoning chain"}`);
      }
      return;
    }
    // UNSPECIFIED: the record declares the silence rather than asserting a fact
    if (isDeclaration(key, r)) return;
    if (!rationale(r)) {
      problems.push(`${where}: it is UNSPECIFIED, so it must say what is missing - it carries no rationale`);
    }
  });
}

if (problems.length) {
  console.log(`document: ${docArg}`);
  console.log(`records with a class: ${checked}`);
  console.log("");
  console.log(`FAILED: ${problems.length} problem(s).`);
  problems.slice(0, 60).forEach(p => console.log(`  - ${p}`));
  if (problems.length > 60) console.log(`  ... and ${problems.length - 60} more`);
  process.exit(1);
}
console.log(`document: ${docArg}`);
console.log(`records with a class: ${checked}`);
console.log("");
console.log("PASSED: every claim's evidence matches its class, and every gap is declared.");
