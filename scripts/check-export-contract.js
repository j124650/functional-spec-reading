#!/usr/bin/env node
/*
 * Check an explorer's export against its contract.
 *
 * The gate. Run it in the build so an export that does not conform never
 * becomes a page, and run it by hand when the export's shape changes.
 *
 *   node scripts/check-export-contract.js <export.json> [contract.json]
 *
 * The contract is the file the explorer and the engine agree on. It is a
 * JSON Schema with `x-` annotations for the things a schema cannot say:
 * which view consumes a field, the id namespace, the view set.
 *
 * What it checks:
 *   - every required property is present, with the declared kind
 *   - every record of an array carries the fields its shape requires
 *   - the counts the contract states match the data
 *   - every view names a property the export actually carries
 *
 * It reports by SHAPE, not by instance: one record missing a field is a
 * fact about the record, a thousand records missing the same field is a
 * fact about the shape.
 */
"use strict";
const fs = require("fs");
const path = require("path");

/* The CONTRACT is format-level and ships with the skill; the EXPORT is the
   project's, so it is named on the command line. */
const SKILL = path.resolve(__dirname, "..");
const exportPath = path.resolve(process.argv[2] || "");
const contractPath = path.resolve(
  process.argv[3] || path.join(SKILL, "explorer", "export.contract.json"));

if (!exportPath || !fs.existsSync(exportPath)) {
  console.error("usage: node check-export-contract.js <export.json> [contract.json]");
  process.exit(2);
}
if (!fs.existsSync(contractPath)) {
  console.error("no contract at " + contractPath);
  process.exit(2);
}

const data = JSON.parse(fs.readFileSync(exportPath, "utf8"));
const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
const bad = [];

const props = contract.properties || {};

/* --- required properties, and their kinds -------------------------------- */
for (const name of contract.required || []) {
  if (!(name in data)) { bad.push("missing property: " + name); continue; }
  const want = props[name] && props[name].type;
  if (!want) continue;
  const got = Array.isArray(data[name]) ? "array"
             : data[name] === null ? "null" : typeof data[name];
  if (want !== got) {
    bad.push(name + ": the contract says " + want + ", the export carries " + got);
  }
}

/* --- the records --------------------------------------------------------- */
for (const [name, spec] of Object.entries(props)) {
  if (!spec || spec.type !== "array" || !Array.isArray(data[name])) continue;
  const item = spec.items;
  if (!item || !item.required) continue;
  const missing = {};
  data[name].forEach((rec, i) => {
    if (rec === null || typeof rec !== "object") {
      bad.push(name + "[" + i + "]: the record is not an object");
      return;
    }
    for (const field of item.required) {
      if (!(field in rec)) {
        missing[field] = missing[field] || { count: 0, first: i };
        missing[field].count++;
      }
    }
  });
  for (const [field, m] of Object.entries(missing)) {
    bad.push(name + ": " + m.count + " of " + data[name].length +
      " records have no field '" + field + "' (first at index " + m.first + ")");
  }
}

/* --- the counts the contract states -------------------------------------- */
for (const s of contract["x-idSeries"] || []) {
  const records = data[s.property];
  if (!Array.isArray(records)) continue;
  /* A property may hold several series — the flat catalogue does — so the
     count is of the records that BELONG to this series. */
  const owned = records.filter(r =>
    r && typeof r === "object" && "series" in r ? r.series === s.prefix : true);
  if (owned.length !== s.count) {
    bad.push("idSeries " + s.prefix + ": the contract says " + s.count +
      ", the export carries " + owned.length + " (" + s.property + ")");
  }
}

/* --- the views ------------------------------------------------------------ */
for (const v of contract["x-views"] || []) {
  const sources = [];
  if (Array.isArray(v.data)) sources.push(...v.data);
  else if (v.data) sources.push(v.data);
  if (v.left && v.left.data) sources.push(v.left.data);
  if (v.right && v.right.data) sources.push(v.right.data);
  if (Array.isArray(v.companion)) sources.push(...v.companion);
  for (const s of sources) {
    if (!(s in data)) {
      bad.push("view '" + v.id + "' reads '" + s + "', which the export does not carry");
    }
  }
}

if (bad.length) {
  console.error("the export does not conform to the contract:");
  for (const b of bad) console.error("  " + b);
  console.error("\n" + bad.length + " problem(s).");
  process.exit(1);
}
console.log("the export conforms: " + (contract.required || []).length +
  " required properties, " + Object.keys(props).length + " described, " +
  (contract["x-views"] || []).length + " views.");
