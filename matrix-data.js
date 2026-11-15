const d = require("C:/_Recover/SpecReader/explorer/explorer-data.json");
const m = d.machines[0];
const tr = d.transitions.filter(t => t.machine === "SM-001");
console.log("SM-001 states:", m.states.length, JSON.stringify(m.states));
console.log("SM-001 transitions:", tr.length);
console.log();
console.log("initial (no from-state):", tr.filter(t => t.fromIsInitial).map(t => t.id + " -> " + t.to).join(", ") || "none");
console.log("unstated destination:", tr.filter(t => t.toUnstated).map(t => t.id + " " + t.from + " -> " + t.to).join(" | ") || "none");
console.log();
const pairs = {};
tr.forEach(t => {
  t.fromStates.forEach(f => t.toStates.forEach(to => {
    const k = f + "->" + to; (pairs[k] = pairs[k] || []).push(t.id);
  }));
});
const multi = Object.entries(pairs).filter(([k, v]) => v.length > 1);
console.log("cells with MORE THAN ONE transition:", multi.length);
multi.forEach(([k, v]) => console.log("   " + k + "  ->  " + v.join(", ")));
console.log("cells with one transition:", Object.keys(pairs).length - multi.length);
console.log("empty cells in an 8x8 grid:", 64 - Object.keys(pairs).length);
console.log();
console.log("distinct actor strings:");
[...new Set(tr.map(t => t.actor))].forEach(a => console.log("   " + JSON.stringify(a)));
console.log();
console.log("roles[] in the export:", d.roles.length);
console.log(JSON.stringify(d.roles.slice(0, 10), null, 1));
console.log();
console.log("other machines' state counts:");
d.machines.forEach(x => console.log("   " + x.id + "  " + x.states.length + " states  " +
  d.transitions.filter(t => t.machine === x.id).length + " transitions"));
