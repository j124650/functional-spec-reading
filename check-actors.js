const d = require("C:/_Recover/SpecReader/explorer/explorer-data.json");
const seen = new Map();
d.transitions.forEach(t => {
  const key = t.actor;
  if (!seen.has(key)) seen.set(key, t.actors);
});
console.log("=== every distinct actor cell, and what it resolved to ===\n");
for (const [cell, actors] of seen) {
  console.log(JSON.stringify(cell));
  actors.forEach(a => console.log("     " + (a.resolved ? "role    " : "UNRESOLVED")
    + "  name=" + JSON.stringify(a.name)
    + (a.resolved ? "  asNamed=" + JSON.stringify(a.asNamed) : "")
    + (a.condition ? "  condition=" + JSON.stringify(a.condition) : "")));
  console.log("");
}
const total = d.transitions.length;
const withRoles = d.transitions.filter(t => t.actors.some(a => a.resolved)).length;
const unresolved = d.transitions.filter(t => t.actors.some(a => !a.resolved)).length;
console.log("transitions: " + total + "   with at least one resolved role: " + withRoles
  + "   carrying something unresolved: " + unresolved);
console.log("actors missing from every transition:", d.transitions.filter(t => !t.actors.length).map(t => t.id).join(", ") || "none");
