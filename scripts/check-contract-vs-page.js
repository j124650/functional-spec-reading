#!/usr/bin/env node
/*
 * Check an explorer's contract against the page that implements it.
 *
 * The contract has two seams. check-export-contract.js closes the first:
 * the export against the contract. This closes the second: the contract
 * against the page. The contract describes the page — its tabs, each
 * view's columns with their labels and widths, its filter groups — and
 * the page implements that description in code. Nothing compared them, so
 * they drift exactly as the data did.
 *
 *   node scripts/check-contract-vs-page.js [contract.json] [page.html]
 *
 * The page it reads is the TEMPLATE, not the built file: the template is
 * the source the contract is written against, and the built file carries
 * the data as well.
 */
"use strict";
const fs = require("fs");
const path = require("path");

/* The CONTRACT is format-level: it ships with the skill, and every project
   in this format obeys it. The PAGE is the project's — it is the thing
   being checked. So the contract is looked for beside this script, and
   the page in the working directory. */
const SKILL = path.resolve(__dirname, "..");
const PROJECT = process.cwd();
const contractPath = path.resolve(
  process.argv[2] || path.join(SKILL, "explorer", "export.contract.json"));
const pagePath = path.resolve(
  process.argv[3] || path.join(PROJECT, "explorer", "explorer.template.html"));

if (!fs.existsSync(contractPath) || !fs.existsSync(pagePath)) {
  console.error("usage: node check-contract-vs-page.js [contract.json] [page.html]");
  process.exit(2);
}

const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
const page = fs.readFileSync(pagePath, "utf8");
const bad = [];
const notes = [];

/* --- the tabs ------------------------------------------------------------- */
const pageTabs = [];
const tabsMatch = page.match(/const TABS\s*=\s*\[([\s\S]*?)\];/);
if (!tabsMatch) {
  bad.push("the page has no TABS array");
} else {
  for (const m of tabsMatch[1].matchAll(/\["([^"]+)"\s*,\s*"([^"]+)"\]/g)) {
    pageTabs.push({ id: m[1], label: m[2] });
  }
}
const views = contract["x-views"] || [];

for (const t of pageTabs) {
  const v = views.find(x => x.id === t.id);
  if (!v) { bad.push("the page has a tab '" + t.id + "' the contract does not describe"); continue; }
  if (v.label !== t.label) {
    bad.push("view '" + t.id + "': the contract calls it '" + v.label +
      "', the page calls it '" + t.label + "'");
  }
}
for (const v of views) {
  if (!pageTabs.some(t => t.id === v.id)) {
    bad.push("the contract describes a view '" + v.id + "' the page does not have");
  }
}

/* --- the tables ----------------------------------------------------------- */
function tableCalls(src) {
  const out = [];
  const re = /DataTable\(\$\("#(\w+)"\)\s*,\s*\{/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const start = src.indexOf("{", m.index + m[0].length - 1);
    let depth = 0, i = start;
    for (; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") { depth--; if (depth === 0) break; }
    }
    const body = src.slice(start, i + 1);
    const id = (body.match(/id:\s*"(\w+)"/) || [])[1];
    const colBlock = (body.match(/columns:\s*\[([\s\S]*?)\]\s*,\s*\n\s*rows/) || [])[1] || "";
    const columns = [];
    for (const c of colBlock.matchAll(/\{\s*k:\s*"([^"]+)"\s*,\s*label:\s*"([^"]+)"([^}]*)\}/g)) {
      const w = (c[3].match(/w:\s*"([^"]+)"/) || [])[1];
      columns.push({ key: c[1], label: c[2], width: w || "" });
    }
    out.push({ host: m[1], id, columns });
  }
  return out;
}

for (const t of tableCalls(page)) {
  if (!t.id) { bad.push("a DataTable call into #" + t.host + " has no id"); continue; }
  const owner = views.find(v => (v.tables || []).includes(t.id));
  if (!owner) { bad.push("the page has a table '" + t.id + "' no view claims"); continue; }

  let want = owner.columns;
  /* A view may declare a table's columns by name, for the views whose
     tables are alternatives rather than side by side - a detail panel's
     tabs, say, where left and right would be a lie. */
  if (owner.tableColumns && owner.tableColumns[t.id]) {
    want = owner.tableColumns[t.id];
  } else if (owner.left && owner.right) {
    want = (owner.tables || []).indexOf(t.id) === 0 ? owner.left.columns : owner.right.columns;
  }
  if (!want || !want.length) { notes.push(t.id + ": the contract declares no columns for it"); continue; }
  if (want.length !== t.columns.length) {
    bad.push(t.id + ": the contract lists " + want.length +
      " columns, the page renders " + t.columns.length);
  }
  const n = Math.min(want.length, t.columns.length);
  for (let i = 0; i < n; i++) {
    const w = want[i], p = t.columns[i];
    if (w.key !== p.key) {
      bad.push(t.id + " column " + (i + 1) + ": the contract says '" + w.key +
        "', the page says '" + p.key + "' — a column's handle must be the DATA KEY");
    }
    if (w.label !== p.label) {
      bad.push(t.id + " column " + (i + 1) + " (" + w.key + "): the contract labels it '" +
        w.label + "', the page '" + p.label + "'");
    }
    if ((w.width || "") !== (p.width || "")) {
      bad.push(t.id + " column " + (i + 1) + " (" + w.key + "): the contract gives it " +
        (w.width || "no width") + ", the page " + (p.width || "no width"));
    }
  }
}

/* --- the filter controls -------------------------------------------------- */
for (const v of views) {
  for (const c of v.controls || []) {
    /* The page names a radio group either literally, or by passing the name
       to a helper that builds the inputs. Both count. */
    const literal = new RegExp('name\\s*=\\s*"' + c + '"').test(page);
    const passed = page.indexOf('"' + c + '"') >= 0;
    if (!literal && !passed) {
      bad.push("view '" + v.id + "' names the control '" + c + "', which the page does not have");
    }
  }
}

/* --- the data each view reads --------------------------------------------- */
for (const v of views) {
  const sources = [];
  if (Array.isArray(v.data)) sources.push(...v.data);
  else if (v.data) sources.push(v.data);
  if (v.left && v.left.data) sources.push(v.left.data);
  if (v.right && v.right.data) sources.push(v.right.data);
  for (const p of sources) {
    if (!new RegExp("\\b" + p + "\\b").test(page)) {
      bad.push("view '" + v.id + "' reads '" + p + "', which the page never mentions");
    }
  }
}

if (notes.length) {
  console.log("notes:");
  for (const n of notes) console.log("  " + n);
  console.log("");
}
if (bad.length) {
  console.error("the contract and the page do not agree:");
  for (const b of bad) console.error("  " + b);
  console.error("\n" + bad.length + " difference(s).");
  process.exit(1);
}
console.log("the contract and the page agree: " + pageTabs.length + " views, " +
  tableCalls(page).length + " tables, " +
  views.reduce((n, v) => n + (v.controls || []).length, 0) + " controls.");
