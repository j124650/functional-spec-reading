#!/usr/bin/env node
/* Assemble the deliverable from its per-key fragments.
 *
 *   node scripts/assemble.js <fragments-dir> <out.json> [template.json]
 *
 * The model writes FRAGMENTS - one file per top-level key - and this script
 * builds the deliverable from them. The model never types the deliverable
 * again: a defect is fixed in the fragment it lives in, and this rebuilds.
 *
 * Before writing, it checks the document against the contract: every key
 * present, no key that is not in the contract, and every record carrying
 * exactly the contract's fields, in the contract's order. A fragment that
 * does not fit stops the build - an assembler that quietly drops or reorders
 * a field would produce a deliverable that looks right and is not.
 */
"use strict";
const fs = require("fs");
const path = require("path");

const SKILL = path.resolve(__dirname, "..");
const [, , dir, out, templateArg] = process.argv;
if (!dir || !out) {
  console.error("usage: node assemble.js <fragments-dir> <out.json> [template.json]");
  process.exit(2);
}
const templatePath = templateArg || path.join(SKILL, "templates", "domain-model-template.json");
const template = JSON.parse(fs.readFileSync(templatePath, "utf8"));

/* ---- the fragments ---- */
const fragments = {};
for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".json")).sort()) {
  const key = f.replace(/\.json$/, "").replace(/^\d+-/, "");
  fragments[key] = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
}

const problems = [];
for (const key of Object.keys(template)) {
  if (!(key in fragments)) problems.push(`no fragment for the key "${key}"`);
}
for (const key of Object.keys(fragments)) {
  if (!(key in template)) problems.push(`the fragment "${key}" is not a key of the contract`);
}
if (problems.length) {
  problems.forEach(p => console.error("  " + p));
  console.error(`\n${problems.length} problem(s): the deliverable was NOT written.`);
  process.exit(1);
}

/* ---- the document, in the contract's key order ---- */
const doc = {};
for (const key of Object.keys(template)) doc[key] = fragments[key];

/* ---- the records, against the contract's fields ---- */
const contractFields = (key) => {
  const t = template[key];
  if (!Array.isArray(t) || !t.length || typeof t[0] !== "object") return null;
  return Object.keys(t[0]);
};
for (const key of Object.keys(template)) {
  const want = contractFields(key);
  if (!want) continue;
  const rows = Array.isArray(doc[key]) ? doc[key] : [];
  rows.forEach((r, i) => {
    if (!r || typeof r !== "object") { problems.push(`${key}[${i}] is not a record`); return; }
    const got = Object.keys(r);
    const missing = want.filter(f => !got.includes(f));
    const extra = got.filter(f => !want.includes(f));
    const label = r.id || r.name || r.term || r.check || String(i);
    if (missing.length) problems.push(`${key}[${i}] (${label}) is missing ${missing.join(", ")}`);
    if (extra.length) problems.push(`${key}[${i}] (${label}) has fields the contract does not define: ${extra.join(", ")}`);
    if (!missing.length && !extra.length) {
      const positions = want.map(f => got.indexOf(f));
      const sorted = positions.slice().sort((a, b) => a - b);
      if (positions.join(",") !== sorted.join(",")) {
        problems.push(`${key}[${i}] (${label}) has its fields out of the contract's order`);
      }
    }
  });
}
if (problems.length) {
  problems.slice(0, 40).forEach(p => console.error("  " + p));
  console.error(`\n${problems.length} problem(s): the deliverable was NOT written.`);
  process.exit(1);
}

fs.writeFileSync(out, JSON.stringify(doc, null, 2) + "\n", "utf8");
const counts = Object.keys(doc)
  .map(k => `${k} ${Array.isArray(doc[k]) ? doc[k].length : 1}`).join("  ");
console.log(`assembled ${Object.keys(doc).length} keys -> ${out}`);
console.log(counts);
