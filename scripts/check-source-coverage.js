/* Check that the deliverable covers the SOURCE it was read from.
 *
 * node scripts/check-source-coverage.js <source.md> <document.json>
 *
 * Every other checker asks whether the deliverable is CONSISTENT with
 * itself. This one asks whether it is COMPLETE with respect to the source:
 * a document that models half of what the source states is internally
 * perfect, and every other check passes it.
 *
 * The source states its own inventories in tables — the stages, the roles,
 * the notification matrix, the open questions, the outside items. A row in
 * one of those tables is a FACT the source states, and the deliverable has
 * to account for it: as a record, or with a stated reason it is not
 * modelled.
 *
 * "Accounted for" means the row's subject appears in a record's NAME, or in
 * a completeness finding that says why it is not modelled. A passing
 * mention in some record's prose is not enough — the source's facts are
 * named things, and a model that merely mentions them has not accounted
 * for them.
 *
 * Exits 0 when every row is accounted for, 1 when one is not, 2 on a usage
 * error.
 */
"use strict";
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("usage: node check-source-coverage.js <source.md> <document.json>");
  process.exit(2);
}
const sourcePath = args[0];
const documentPath = args[1];

/* ---------------------------------------------------------------- the source */

const sourceLines = fs.readFileSync(sourcePath, "utf8").split(/\r?\n/);

/* The section a line sits in, so a row knows where it came from. */
function sectionOf(index) {
  for (let i = index; i >= 0; i--) {
    const m = sourceLines[i].match(/^#{2,3}\s+(\d+(?:\.\d+)*)\b/);
    if (m) return m[1];
  }
  return "";
}

/* The tables, with the rows they hold. */
function sourceTables() {
  const tables = [];
  for (let i = 0; i < sourceLines.length; i++) {
    const line = sourceLines[i];
    if (!line.startsWith("|")) continue;
    const next = sourceLines[i + 1];
    if (!next || !/^\|[\s:|-]+\|$/.test(next)) continue;

    const header = splitRow(line);
    const rows = [];
    let j = i + 2;
    while (j < sourceLines.length && sourceLines[j].startsWith("|")) {
      rows.push({ line: j, cells: splitRow(sourceLines[j]), section: sectionOf(j) });
      j++;
    }
    tables.push({ line: i, header, rows });
    i = j - 1;
  }
  return tables;
}

/* A table row, split on the pipes that are not escaped. */
function splitRow(line) {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  const cells = [];
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\" && s[i + 1] === "|") { cur += "|"; i++; continue; }
    if (s[i] === "|") { cells.push(cur.trim()); cur = ""; continue; }
    cur += s[i];
  }
  cells.push(cur.trim());
  return cells;
}

/* ------------------------------------------------------------- the document */

let doc;
try {
  doc = JSON.parse(fs.readFileSync(documentPath, "utf8"));
} catch (e) {
  console.error("cannot read " + documentPath + ": " + e.message);
  process.exit(2);
}

/* The fields that NAME a thing. A row of the source is accounted for when
   one of these names it — AND the record cites the row's own section, so
   that two rows with the same subject in two sections cannot answer for
   each other. "Approved" is a stage in §3 and a notification in §12.1, and
   the stage does not answer for the notification. */
const NAMING = {
  states: ["name"],
  roles: ["name"],
  policies: ["name", "trigger"],
  domainEvents: ["name", "meaning"],
  commands: ["name"],
  glossary: ["term"],
  entities: ["name"],
  valueObjects: ["name"],
  boundedContexts: ["name"],
  aggregates: ["name"],
  issues: ["statement"],
  questions: ["question"],
  referencedButNotSupplied: ["artefact"],
  completenessFindings: ["check", "finding"],
};

/* The sections a record cites. */
function sectionsOf(record) {
  const out = new Set();
  for (const e of (record && record.evidence) || []) {
    if (!e || typeof e.locator !== "string") continue;
    const m = e.locator.match(/^§(\d+(?:\.\d+)*)/);
    if (m) out.add(m[1]);
  }
  return out;
}

/* Every naming field, with the sections the record that holds it cites. */
const names = [];
for (const [key, fields] of Object.entries(NAMING)) {
  for (const r of doc[key] || []) {
    if (!r) continue;
    const sections = sectionsOf(r);
    for (const f of fields) {
      if (typeof r[f] === "string" && r[f].trim()) {
        names.push({ text: normalise(r[f]), sections, key });
      }
    }
  }
}

/* The reasons a completeness finding gives, with the sections they cite. */
const findings = (doc.completenessFindings || [])
  .map((r) => ({ text: normalise((r && r.check || "") + " " + (r && r.finding || "")), sections: sectionsOf(r) }));

function normalise(text) {
  return String(text)
    .toLowerCase()
    .replace(/[`*_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* A key is short enough that a match means something. */
function usable(key) {
  const k = normalise(key);
  return k.length >= 3 && !/^\d+$/.test(k);
}

/* ------------------------------------------------------------------- compare */

const problems = [];
const rows = sourceTables().reduce((n, t) => n + t.rows.length, 0);
let accounted = 0;

for (const table of sourceTables()) {
  for (const row of table.rows) {
    const key = row.cells[0];
    if (!usable(key)) continue;

    /* The row's subject, with a leading number or marker removed: a table
       that names rows "Q10", "R1", "OQ-17" is naming them by their
       source's number, and that number is part of the name. */
    const bare = normalise(key);
    const subject = bare.replace(/^(oq-\d+|\d+|[a-z]?\d+)\s+/, "").trim();

    /* A record answers for the row when it names it AND it cites the
       row's section — or the row is in a section the source does not
       number, where the citation cannot be required. */
    const cites = (sections) => !row.section || sections.has(row.section) ||
      (row.section && [...sections].some((s) => s.startsWith(row.section + ".")));

    const named = names.some((n) =>
      (n.text === subject || n.text === bare ||
       n.text.includes(subject) || subject.includes(n.text) ||
       (subject.length >= 6 && n.text.includes(subject))) && cites(n.sections));

    const explained = findings.some((f) =>
      (f.text.includes(subject) || (subject.length >= 6 && f.text.includes(subject))) && cites(f.sections));

    if (named || explained) { accounted++; continue; }

    problems.push(
      "the source's §" + (row.section || "?") + " row " + JSON.stringify(key) +
      " is in no record — it is a fact the source states, and the model does not account for it" +
      (row.section ? "" : ""));
  }
}

/* ------------------------------------------------------------------- report */

console.log("source:  " + sourcePath);
console.log("document: " + documentPath);
console.log("  rows in the source's tables : " + rows);
console.log("  accounted for                : " + accounted);

if (!problems.length) {
  console.log("");
  console.log("OK: every row of the source's own tables is accounted for.");
  process.exit(0);
}

console.log("");
console.error("HOLE: the deliverable does not account for " + problems.length + " of the source's own facts:");
problems.forEach((p) => console.error("  " + p));
console.error("");
console.error("A row of the source's tables is a fact the source states. Account for it as a");
console.error("record, or say in a completeness finding why it is not modelled. A model that");
console.error("merely mentions it in passing has not accounted for it.");
process.exit(1);
