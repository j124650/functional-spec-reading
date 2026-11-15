const d = require("C:/_Recover/SpecReader/explorer/explorer-data.json");
const tr = d.transitions.filter(t => t.machine === "SM-001" && t.fromStates.includes("ST-004"));
console.log("=== transitions leaving ST-004 (In Review) ===");
tr.forEach(t => console.log("  " + t.id + "  " + t.trigger + "   ->  " + JSON.stringify(t.toStates)));
console.log();
console.log("=== the document's own row for them ===");
const names = {};
d.states.forEach(s => names[s.id] = s.name);
tr.forEach(t => console.log("  " + t.id + ": from " + t.fromStates.map(i => names[i]).join(",")
  + "  to " + t.toStates.map(i => names[i]).join(",")));
