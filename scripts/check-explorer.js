/* Check that a generated explorer page agrees with the document it summarises.
 *
 * The page embeds one JSON document; the analysis document owns the findings.
 * When the page is derived from the document by a generator, the two agree by
 * construction - but a hand-edited page, a stale document, or a generator that
 * silently skips a record breaks that, and the page then contradicts the
 * document the reader is holding.
 *
 * This compares them mechanically: the ID sets must match, and every severity
 * must match.
 *
 *   node check-explorer.js <explorer.html> <document.md> [more.md ...]
 *
 * Exits non-zero when they disagree, and prints what disagrees.
 */
const fs = require("fs");

/* An ID is a short uppercase token and a number: F-01, ISS-12, TR-007,
   ST-003. The pattern is deliberately loose about the prefix so the script
   works on any document's namespace. */
const ID_RX = /\b([A-Z][A-Z0-9]{0,5}-\d{1,4}[a-z]?)\b/g;

/* A severity is a word from the usual ramp, in any capitalisation. */
const SEV_RX = /\b(critical|high|medium|low|blocker|major|minor|info)\b/i;

const [pagePath, ...docPaths] = process.argv.slice(2);
if (!pagePath || docPaths.length === 0) {
  console.error("usage: node check-explorer.js <explorer.html> <document.md> [...]");
  process.exit(2);
}

/* ---- the page's embedded JSON ---- */

const html = fs.readFileSync(pagePath, "utf8");
const m = html.match(/<script[^>]*id=["']explorerData["'][^>]*>([\s\S]*?)<\/script>/);
if (!m) {
  console.error("no <script id=\"explorerData\"> block in " + pagePath);
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
      pageRecords.set(id, sev ? sev.toLowerCase() : undefined);
    }
  }
  Object.values(node).forEach(walk);
})(data);

/* ---- the documents' records ---- */

/* A record is a heading that starts with an ID: "### F-01 - Title - Critical".
   The severity is the word after the last middot, if it is one. */
const docRecords = new Map();
const ownedPrefixes = new Set();

for (const p of docPaths) {
  const text = fs.readFileSync(p, "utf8");
  text.split("\n").forEach(line => {
    const h = line.match(/^#{1,6}\s+(.*\S)\s*$/);
    if (!h) return;
    const head = h[1];
    const hit = head.match(ID_RX);
    if (!hit) return;
    const id = hit[0];
    ownedPrefixes.add(id.replace(/-\d.*$/, ""));
    const parts = head.split("·");
    const tail = parts.length > 1 ? parts[parts.length - 1] : head.replace(ID_RX, "");
    const sev = (tail.match(SEV_RX) || [])[0];
    docRecords.set(id, sev ? sev.toLowerCase() : undefined);
  });
}

/* Compare within the namespaces the documents own. The page carries records
   from other documents too - invariants, questions, stages - and those are
   not this comparison's business.

   A document may name an ID that is explicitly NOT one of its records:
   "F-03b is a probe label, not a finding". The page then legitimately shows
   that ID in a different role. So an ID counts as a record only when the
   document gives it a heading - a mention in prose or a table is not one. */
const prefixOf = id => id.replace(/-\d.*$/, "");
const pageInScope = new Map([...pageRecords].filter(([id]) => ownedPrefixes.has(prefixOf(id))));
const docInScope = new Map([...docRecords].filter(([id]) => ownedPrefixes.has(prefixOf(id))));

/* An ID the document mentions but does not head is a mention, not a record. */
const mentioned = new Set();
for (const p of docPaths) {
  for (const m of fs.readFileSync(p, "utf8").matchAll(ID_RX)) {
    if (ownedPrefixes.has(prefixOf(m[0]))) mentioned.add(m[0]);
  }
}

/* ---- compare ---- */

const problems = [];

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
for (const [id, docSev] of docInScope) {
  const pageSev = pageInScope.get(id);
  if (pageSev === undefined || docSev === undefined) continue;
  if (docSev !== pageSev) {
    problems.push("severity differs for " + id + ": document says "
      + docSev + ", page says " + pageSev);
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
