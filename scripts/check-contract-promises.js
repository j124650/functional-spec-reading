#!/usr/bin/env node
/* Does the page deliver what the contract promises?
 *
 * The contract's own convention: "every field carries an x-view, so a
 * field the page ignores is a declared decision rather than an accident."
 * This asks the question that convention implies and the build gate does
 * not: for every field the contract points at a view, does the page
 * actually read it?
 *
 * A field the page ignores is not automatically wrong - the contract may
 * be describing behaviour the page has not grown yet. So this REPORTS,
 * it does not fail the build. What it prints is the list of promises
 * that are currently unfulfilled, in the contract's own words, so the
 * decision to implement or to reword is made by a reader rather than by
 * a script that cannot read prose.
 *
 *   node check-contract-promises.js <contract.json> <page template>
 */
const fs = require("fs");

const contractPath = process.argv[2];
const pagePath = process.argv[3];
if (!contractPath || !pagePath) {
  console.error("usage: check-contract-promises.js <contract.json> <page template>");
  process.exit(2);
}

const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
const page = fs.readFileSync(pagePath, "utf8");

/* The page reads a field by name. A field is also read when a renderer
   walks a record's keys generically - the catalogue's detail panel does -
   so a name that appears anywhere in the page counts. */
const pageReads = name => {
  const re = new RegExp("\\b" + name + "\\b");
  return re.test(page);
};

const promises = [];
function scan(node, path) {
  if (Array.isArray(node)) return node.forEach(v => scan(v, path));
  if (!node || typeof node !== "object") return;
  if (node["x-view"] && node["x-view"] !== "machine-only" && node.description) {
    const field = path.split(".").pop();
    promises.push({
      path: path,
      view: node["x-view"],
      field: field,
      description: String(node.description).replace(/\s+/g, " "),
      read: pageReads(field),
    });
  }
  for (const k of Object.keys(node)) {
    if (k.startsWith("x-") || k === "description" || k === "required") continue;
    scan(node[k], path ? path + "." + k : k);
  }
}
scan(contract.properties, "");

const unfulfilled = promises.filter(p => !p.read);

console.log("the contract points " + promises.length + " fields at a view.");
console.log("the page reads " + (promises.length - unfulfilled.length) + " of them.");
if (!unfulfilled.length) {
  console.log("every promise is kept.");
  process.exit(0);
}

console.log("\n" + unfulfilled.length + " promise(s) the page does not keep yet:\n");
for (const p of unfulfilled) {
  console.log("  " + p.path + "   (x-view: " + p.view + ")");
  console.log("     " + p.description);
  console.log("");
}
console.log("Each is either behaviour the page has not grown yet, or a promise");
console.log("the contract makes that it should not make. Say which.");
