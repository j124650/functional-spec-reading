/* Check that the explorer's catalogue carries every identifier series the
 * document issues.
 *
 * A document that numbers its sources, entities, value objects, aggregates,
 * bounded contexts, commands, events, policies and scenarios gives the reader
 * a handle for each. The page decodes a handle into the name it stands for,
 * which it can only do if the export carried the catalogue.
 *
 * A series the export omits is a series the page shows as a bare token -
 * "VO-004" sitting in a scope cell with nothing to decode it into. The
 * omission is SILENT: nothing errors, the page still renders, and the reader
 * cannot tell whether the analysis skipped the series or the id is
 * meaningless. This script is the mechanical check that catches it.
 *
 * The question the script asks is "CAN THE PAGE DECODE AN ID OF THIS
 * SERIES INTO A NAME" - not "is this series in the catalogue array". The
 * page's id index covers the catalogue AND the records the export carries
 * beside it (states, transitions, invariants, findings, questions,
 * machines), so a state id is decoded to the state's name even though the
 * catalogue does not list the ST- series. Checking the catalogue alone
 * reports a series as bare when the page renders it perfectly, and pushes
 * the reader toward the wrong repair - duplicating the machine's states
 * into the definitions catalogue.
 *
 *   node check-id-catalogue.js <explorer.html> <document.md>
 *
 * Exits non-zero and names every disagreement.
 */
"use strict";

const fs = require("fs");

const [pagePath, docPath] = process.argv.slice(2);
if (!pagePath || !docPath) {
  console.error("usage: node check-id-catalogue.js <explorer.html> <document.md>");
  process.exit(2);
}

/* A cell that names a series by its prefix: "SRC-", "TERM-", "N-". */
const PREFIX_RX = /^[A-Z][A-Z0-9]{0,4}-$/;

/* ---------------------------------------------------------------- the page */

const html = fs.readFileSync(pagePath, "utf8");
const blocks = [...html.matchAll(
  /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/g)];

if (!blocks.length) {
  console.error("no <script type=\"application/json\"> block in " + pagePath);
  console.error("the page must embed its data as JSON, not as literals in the script");
  process.exit(2);
}

let catalogue = null;
let data = null;
for (const b of blocks) {
  let parsed;
  try { parsed = JSON.parse(b[1]); } catch (e) { continue; }
  if (parsed && Array.isArray(parsed.catalogue)) {
    catalogue = parsed.catalogue; data = parsed; break;
  }
}
if (!catalogue) {
  console.error("the page's embedded JSON carries no \"catalogue\" array");
  console.error("the catalogue is what lets the page decode an id into words");
  process.exit(2);
}

/* series -> Map(id -> name) */
const cat = new Map();
for (const s of catalogue) {
  const series = String(s.series || "").replace(/-$/, "");
  const m = new Map();
  for (const e of (s.entries || [])) {
    if (e && e.id) m.set(String(e.id).trim(), String(e.name == null ? "" : e.name).trim());
  }
  cat.set(series, m);
}

/* The page's id index covers more than the catalogue: a state, a
   transition, an invariant, a finding, a question and a machine each carry
   an id and a name, and the page decodes every mention of them. Fold those
   series into the same map, so the check asks whether the page can DECODE
   an id of the series - not whether one particular array lists it. */
const ALSO_INDEXED = [
  ["states",      "name"],
  ["transitions", "trigger"],
  ["invariants",  "text"],
  ["findings",    "title"],
  ["questions",   "question"],
  ["machines",    "name"],
];
if (data) {
  for (const [key, nameField] of ALSO_INDEXED) {
    const rows = Array.isArray(data[key]) ? data[key] : [];
    for (const r of rows) {
      if (!r || !r.id) continue;
      const id = String(r.id).trim();
      const series = id.replace(/-\d.*$/, "");
      if (!series) continue;
      if (!cat.has(series)) cat.set(series, new Map());
      const m = cat.get(series);
      if (!m.has(id)) m.set(id, String(r[nameField] == null ? "" : r[nameField]).trim());
    }
  }
}

/* -------------------------------------------------------------- the document */

const text = fs.readFileSync(docPath, "utf8");
const lines = text.split(/\r?\n/);

/* The ID registry: a table with a cell that names a series by its prefix.
   That table is the document's own statement of what schemes it issues, so it
   is the authority on which series must be covered. */
const registry = new Set();
for (const line of lines) {
  const row = line.match(/^\|(.+)\|\s*$/);
  if (!row) continue;
  for (const cell of row[1].split("|")) {
    const c = cell.replace(/\*/g, "").trim();
    if (PREFIX_RX.test(c)) { registry.add(c.replace(/-$/, "")); break; }
  }
}

/* Fallback when the document has no registry table: collect the ids the
   document DEFINES - a heading that starts with one, or a table row whose
   FIRST CELL is one - and take their prefixes. */
const defined = new Map();
if (!registry.size) {
  const ID_RX = /\b([A-Z][A-Z0-9]{0,5}-\d{1,4}[a-z]?)\b/;
  for (const line of lines) {
    const head = line.match(/^#{1,6}\s+(\S+)/);
    const row = line.match(/^\|\s*([^|]+?)\s*\|/);
    const candidate = head ? head[1] : (row ? row[1].replace(/\*/g, "").trim() : null);
    if (!candidate) continue;
    const m = candidate.match(ID_RX);
    if (!m || m[0] !== candidate) continue;   // the id must be the whole token
    const prefix = candidate.replace(/-\d.*$/, "");
    if (!defined.has(prefix)) defined.set(prefix, new Set());
    defined.get(prefix).add(candidate);
  }
  for (const p of defined.keys()) registry.add(p);
}

/* ------------------------------------------------------------------ compare */

const problems = [];
const notes = [];

/* 1. every series the document issues must be decodable somewhere */
for (const prefix of [...registry].sort()) {
  if (!cat.has(prefix)) {
    problems.push("the document issues " + prefix + "- ids, but neither the catalogue "
      + "nor the export's own records carry them - the page has nowhere to decode "
      + "those ids into a name, so they reach the reader as bare handles");
    continue;
  }
  const m = cat.get(prefix);
  if (!m.size) {
    problems.push("the catalogue's " + prefix + " series is empty");
  }
  for (const [id, name] of m) {
    /* 2. a name is what the id decodes INTO */
    if (!name) {
      problems.push(prefix + ": " + id + " has no name - the page can decode it into nothing");
    }
    /* 3. the catalogue must not carry an id the document never issued */
    if (text.indexOf(id) < 0) {
      problems.push("the catalogue carries " + id + ", which the document never mentions");
    }
  }
  /* 4. in the fallback mode, every id the document defines must be carried */
  if (defined.has(prefix)) {
    for (const id of defined.get(prefix)) {
      if (!m.has(id)) {
        problems.push("the document defines " + id + " but the catalogue does not carry it");
      }
    }
  }
}

/* A catalogue series the document's registry does not list is worth saying
   out loud, but it is not a failure - the registry may simply be terse. */
for (const prefix of cat.keys()) {
  if (!registry.has(prefix)) {
    notes.push("the catalogue carries a " + prefix + " series the document's registry does not list");
  }
}

if (problems.length) {
  console.error("MISMATCH between " + pagePath + " and " + docPath);
  problems.forEach(p => console.error("  " + p));
  console.error("");
  console.error("Every identifier series the document issues must be decodable into the");
  console.error("name it stands for, whether the catalogue carries it or the export's");
  console.error("own records do.");
  process.exit(1);
}

const total = [...cat.values()].reduce((n, m) => n + m.size, 0);
notes.forEach(n => console.log("note: " + n));
console.log("OK  " + pagePath + " carries " + cat.size + " series / " + total
  + " identifiers, covering every series " + docPath + " issues");
