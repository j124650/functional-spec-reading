// Every field in the export that carries an expression, with where it lives.
const d = require("C:/_Recover/SpecReader/explorer/explorer-data.json");

function walk(node, path, out) {
  if (Array.isArray(node)) {
    node.slice(0, 400).forEach(v => walk(v, path + "[]", out));
    return;
  }
  if (node && typeof node === "object") {
    for (const k of Object.keys(node)) {
      const p = path ? path + "." + k : k;
      if (/expr|guard|condition|rule|predicate/i.test(k)) {
        const vals = Array.isArray(node) ? node : [node];
        out.push({ path: p, sample: String(node[k]).slice(0, 70) });
      }
      walk(node[k], p, out);
    }
  }
}
const found = [];
walk(d, "", found);

// collapse duplicates by path
const byPath = new Map();
for (const f of found) {
  if (!byPath.has(f.path)) byPath.set(f.path, []);
  byPath.get(f.path).push(f.sample);
}
console.log("=== expression-bearing fields in the export ===");
for (const [p, samples] of byPath) {
  console.log("\n" + p);
  console.log("   distinct values: " + new Set(samples).size + "   e.g. " + JSON.stringify(samples[0]));
}

// which of them are BOOLEAN (guard-shaped) vs script-shaped (effect-shaped)?
console.log("\n=== classification by content ===");
for (const [p, samples] of byPath) {
  const all = samples.join(" ");
  const isEffect = /\bset\b|;|:=/.test(all) && !/^(?!.*[;:=])/s.test("");
  console.log(p.padEnd(46) + (isEffect ? "script-shaped (effect)" : "boolean-shaped (guard)"));
}
