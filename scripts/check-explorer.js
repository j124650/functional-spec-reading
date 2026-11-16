/* Check that the explorer page and the document it renders agree.
 *
 *   node check-explorer.js <explorer.html> <document.json>
 *
 * The page is a VIEW of the document. Every finding the document issues must
 * appear on the page, with the same severity and the same kind; and the page
 * must not show a finding the document never issued. A page that lists a
 * severity the document downgraded, or omits a finding the document added,
 * contradicts the document in front of the reader.
 *
 * The document is JSON now, so the records are read from its `issues` array
 * rather than scraped from headings and table rows. That removes the two
 * ways the old reader could compare nothing and still exit zero: a document
 * whose findings were headings, and one whose findings were table rows.
 */
"use strict";

const fs = require("fs");

const [pagePath, ...docPaths] = process.argv.slice(2);
if (!pagePath || docPaths.length === 0) {
  console.error("usage: node check-explorer.js <explorer.html> <document.json>");
  process.exit(2);
}

/* An id of the document's own scheme. */
const ID_RX = /\b([A-Z][A-Z0-9]{0,5}-\d{1,4}[a-z]?)\b/g;
const SEV_RX = /\b(critical|high|medium|low|blocker|major|minor|info)\b/i;

/* ---------------------------------------------------------------- the page */

const html = fs.readFileSync(pagePath, "utf8");
/* The data block's id is not fixed - the skill's own example calls it
   reachData, other pages call it explorerData - so either will do. What
   matters is that the data is EMBEDDED as JSON, not typed into the
   script: a page that fetches it renders empty when opened from disk,
   and the failure is quiet. */
let m = html.match(/<script[^>]*id=["']reachData["'][^>]*>([\s\S]*?)<\/script>/)
     || html.match(/<script[^>]*id=["']explorerData["'][^>]*>([\s\S]*?)<\/script>/);
if (!m) {
  console.error("no embedded data block in " + pagePath);
  console.error("the page must embed its data as JSON, not as literals in the script");
  process.exit(2);
}
let data;
try {
  data = JSON.parse(m[1]);
} catch (e) {
  console.error("the embedded JSON does not parse: " + e.message);
  process.exit(2);
}

/* ---- the page's records ---- */

/* Walk the whole document and collect every object that carries an id. The
   page's shape is not fixed, so this is structural rather than positional. */
const pageRecords = new Map();
(function walk(node) {
  if (Array.isArray(node)) { node.forEach(walk); return; }
  if (!node || typeof node !== "object") return;
  const id = node.id ?? node.ID;
  if (typeof id === "string") {
    const hit = id.match(ID_RX);
    if (hit) {
      const sevField = node.sev ?? node.severity ?? node.priority;
      const sev = typeof sevField === "string" ? (sevField.match(SEV_RX) || [])[0] : undefined;
      const kindField = node.kind ?? node.kindLabel;
      const kind = typeof kindField === "string"
        ? (kindField.replace(/\*/g, "").trim().toLowerCase().match(/^(confirmed\s*defect|spec\s*gap)\b/) || [])[0]
        : undefined;
      pageRecords.set(id, { sev: sev ? sev.toLowerCase() : undefined, kind: normaliseKind(kind) });
    }
  }
  Object.values(node).forEach(walk);
})(data);

/* The document's `kind` is a token - ConfirmedDefect, SpecGap - and the
   page's may be the words. Both are reduced to one spelling, so a difference
   in wording is not reported as a difference in meaning. */
function normaliseKind(k) {
  if (!k) return undefined;
  return k.toLowerCase().replace(/\s+/g, "");
}

/* ---- the document's records ---- */

/* The findings ARE the `issues` array. The document issues them by id, and
   each carries the severity and the kind the page must show. */
const docRecords = new Map();
const ownedPrefixes = new Set();

for (const p of docPaths) {
  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    console.error("cannot read " + p + ": " + e.message);
    process.exit(2);
  }
  for (const issue of (doc.issues || [])) {
    if (!issue || typeof issue.id !== "string") continue;
    const id = issue.id.trim();
    if (!id) continue;
    ownedPrefixes.add(id.replace(/-\d.*$/, ""));
    const sev = typeof issue.severity === "string"
      ? (issue.severity.match(SEV_RX) || [])[0] : undefined;
    docRecords.set(id, {
      sev: sev ? sev.toLowerCase() : undefined,
      kind: normaliseKind(issue.kind),
    });
  }
}

/* An id the document NAMES but does not issue is a mention, not a record.
   The document may reference an id that is explicitly not one of its own
   records - a probe label, a source's own numbering - and the page then
   legitimately shows that id in a different role. */
const mentioned = new Set();
for (const p of docPaths) {
  const text = fs.readFileSync(p, "utf8");
  for (const hit of text.matchAll(ID_RX)) {
    if (ownedPrefixes.has(hit[1].replace(/-\d.*$/, ""))) mentioned.add(hit[1]);
  }
}

/* ---- compare ---- */

const problems = [];

const prefixOf = id => id.replace(/-\d.*$/, "");
const pageInScope = new Map([...pageRecords].filter(([id]) => ownedPrefixes.has(prefixOf(id))));
const docInScope = new Map([...docRecords].filter(([id]) => ownedPrefixes.has(prefixOf(id))));

const inDocOnly = [...docInScope.keys()].filter(id => !pageInScope.has(id));
const inPageOnly = [...pageInScope.keys()].filter(
  id => !docInScope.has(id) && !mentioned.has(id));

if (inDocOnly.length) {
  problems.push("in the document but not on the page ("
    + inDocOnly.length + "): " + inDocOnly.join(", "));
}
if (inPageOnly.length) {
  problems.push("on the page but not in the document ("
    + inPageOnly.length + "): " + inPageOnly.join(", "));
}

/* A severity that differs is worse than a missing one: the page states a
   level the document no longer says. */
for (const [id, docRec] of docInScope) {
  const pageRec = pageInScope.get(id);
  if (!pageRec) continue;
  if (pageRec.sev === undefined || docRec.sev === undefined) continue;
  if (docRec.sev !== pageRec.sev) {
    problems.push("severity differs for " + id + ": document says "
      + docRec.sev + ", page says " + pageRec.sev);
  }
}

/* So is a KIND that differs: a confirmed defect presented as a spec gap
   sends the reader to the wrong remedy - amend the spec, or decide and add
   the rule. */
for (const [id, docRec] of docInScope) {
  const pageRec = pageInScope.get(id);
  if (!pageRec) continue;
  if (pageRec.kind === undefined || docRec.kind === undefined) continue;
  if (docRec.kind !== pageRec.kind) {
    problems.push("kind differs for " + id + ": document says "
      + docRec.kind + ", page says " + pageRec.kind);
  }
}

if (problems.length) {
  console.error("MISMATCH between " + pagePath + " and " + docPaths.join(", "));
  problems.forEach(p => console.error("  " + p));
  console.error("");
  console.error("The page must be derived from the document, not edited beside it.");
  process.exit(1);
}

console.log("OK  " + pagePath + " agrees with " + docPaths.join(", ")
  + "  (" + docInScope.size + " records in " + [...ownedPrefixes].sort().join("/") + ")");
