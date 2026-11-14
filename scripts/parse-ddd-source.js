/* Parse the DDD Reference source (Silverbullet JSMDoc ".dj") into structured
 * data: the definitions glossary and the pattern catalogue.
 *
 * The markup is light: a "## Name" heading starts a section, "{.unnumbered}"
 * attributes precede some headings, and ":therefore:" marks the rule that
 * follows it. Text between sections is the pattern's rationale; the rule
 * after :therefore: is its prescription.
 */
const fs = require("fs");
const path = require("path");

const dir = process.argv[2];
const out = process.argv[3];

const files = fs.readdirSync(dir)
  .filter(f => f.endsWith(".dj"))
  .sort();

/* Chapters, in the book's order, with their titles. */
const CHAPTERS = {
  "03-putting-the-model-to-work.dj": "Putting the Model to Work",
  "04-building-blocks-of-a-model-driven-design.dj": "Building Blocks of a Model-Driven Design",
  "05-supple-design.dj": "Supple Design",
  "06-context-mapping-for-strategic-design.dj": "Context Mapping for Strategic Design",
  "07-distillation-for-strategic-design.dj": "Distillation for Strategic Design",
  "08-large-scale-structure-for-strategic-design.dj": "Large-Scale Structure for Strategic Design",
};

/* Sections are "## Name" headings. */
function parseSections(text) {
  const lines = text.split("\n");
  const sections = [];
  let cur = null;
  let mode = "body";          // body | therefore
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    const h2 = line.match(/^##\s+(.*\S)\s*$/);
    if (h2) {
      cur = { name: h2[1].replace(/\{[^}]*\}$/, "").trim(), body: [], therefore: [] };
      sections.push(cur);
      mode = "body";
      continue;
    }
    if (/^#\s/.test(line)) { cur = null; continue; }
    if (!cur) continue;
    if (/^:therefore:\s*$/.test(line)) { mode = "therefore"; continue; }
    if (/^\[\^/.test(line) || /^\{[^}]*\}\s*$/.test(line)) continue;
    (mode === "therefore" ? cur.therefore : cur.body).push(line);
  }
  return sections.map(s => ({
    name: s.name,
    body: s.body.join("\n").trim(),
    therefore: s.therefore.join("\n").trim(),
  }));
}

/* The definitions file: a "## term" heading then its text. */
const defText = fs.readFileSync(path.join(dir, "01-definitions.dj"), "utf8");
const definitions = parseSections(defText).map(s => ({
  term: s.name,
  text: (s.body || s.therefore).replace(/\n+/g, " ").replace(/\s+/g, " ").trim(),
}));

/* The pattern catalogue, chapter by chapter. */
const patterns = [];
for (const file of Object.keys(CHAPTERS)) {
  const p = path.join(dir, file);
  if (!fs.existsSync(p)) continue;
  for (const s of parseSections(fs.readFileSync(p, "utf8"))) {
    patterns.push({
      chapter: CHAPTERS[file],
      name: s.name,
      body: s.body,
      therefore: s.therefore,
    });
  }
}

fs.writeFileSync(out, JSON.stringify({ definitions, patterns }, null, 1), "utf8");

console.log("definitions:", definitions.length);
definitions.forEach(d => console.log("  " + d.term));
console.log("\npatterns:", patterns.length);
const byChapter = {};
patterns.forEach(p => { (byChapter[p.chapter] = byChapter[p.chapter] || []).push(p.name); });
for (const [ch, names] of Object.entries(byChapter)) {
  console.log("\n  " + ch + "  (" + names.length + ")");
  names.forEach(n => console.log("    " + n));
}
