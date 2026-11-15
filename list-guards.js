// Which contract items carry a guard expression? For each: what it is,
// whether it is an expression or the document's prose, whether the contract
// declares it, and whether the page reads it.
const fs = require("fs");
const SKILL = "C:/Users/Dmitry/AppData/Local/hermes/skills/software-development/functional-spec-reading";
const contract = JSON.parse(fs.readFileSync(SKILL + "/explorer/export.contract.json", "utf8"));
const data = JSON.parse(fs.readFileSync("C:/_Recover/SpecReader/explorer/explorer-data.json", "utf8"));
const page = fs.readFileSync("C:/_Recover/SpecReader/explorer/explorer.template.html", "utf8");

const BT = String.fromCharCode(96);
const isExpr = v => typeof v === "string" && v.trim().startsWith(BT) && v.trim().endsWith(BT);
const isDash = v => { const s = String(v == null ? "" : v).trim(); return s === "" || s === "—"; };

// Field names that carry a guard, a condition, or an expression.
const GUARDISH = /guard|predicate|condition|expression/i;

const rows = [];
for (const [prop, val] of Object.entries(data)) {
  const list = Array.isArray(val) ? val : (val && typeof val === "object" ? null : null);
  if (!list) continue;
  for (const rec of list) {
    if (!rec || typeof rec !== "object") continue;
    for (const [field, v] of Object.entries(rec)) {
      if (typeof v !== "string") continue;
      if (!GUARDISH.test(field)) continue;
      const dash = isDash(v);
      const expr = isExpr(v);
      rows.push({
        prop, field,
        kind: dash ? "empty" : (expr ? "expression" : "prose"),
        value: dash ? v : v.slice(0, 70),
      });
    }
  }
}

// Also: the catalogue carries a guard inside a flat record.
const catGuard = (data.catalogue || []).filter(r => GUARDISH.test(r.detail || "") || GUARDISH.test(r.extra || ""));
for (const r of catGuard) {
  rows.push({ prop: "catalogue", field: "detail/extra", kind: isExpr(r.detail) ? "expression" : "prose", value: String(r.detail).slice(0, 70) });
}

const seen = new Set();
const grouped = [];
for (const r of rows) {
  const k = r.prop + "|" + r.field + "|" + r.kind;
  if (seen.has(k)) continue;
  seen.add(k);
  const all = rows.filter(x => x.prop === r.prop && x.field === r.field && x.kind === r.kind);
  const distinct = new Set(all.map(x => x.value));
  const declared = (() => {
    const p = contract.properties[r.prop];
    if (!p || !p.items || !p.items.properties) return null;
    const d = p.items.properties[r.field];
    if (!d) return null;
    return (p.items.required || []).includes(r.field) ? "required" : "optional";
  })();
  const read = new RegExp("\\b" + r.field + "\\b").test(page);
  grouped.push({ ...r, count: all.length, distinct: distinct.size, declared, read });
}

console.log("=== items that carry a guard expression ===\n");
for (const g of grouped.sort((a, b) => a.prop.localeCompare(b.prop) || a.field.localeCompare(b.field))) {
  console.log(g.prop + "." + g.field + "   [" + g.kind + "]");
  console.log("   records: " + g.count + "   distinct values: " + g.distinct);
  console.log("   contract: " + (g.declared === null ? "NOT DECLARED" : g.declared + " in the contract") +
              "   page reads it: " + (g.read ? "yes" : "NO"));
  console.log("   e.g. " + JSON.stringify(g.value));
  console.log("");
}
