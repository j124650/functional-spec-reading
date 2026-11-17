#!/usr/bin/env node
/* The feedback loop, available while the model is still being written.
 *
 *   node scripts/feedback.js <fragments-dir> [work-dir]
 *
 * Assembles what is written so far (the keys with no fragment yet are empty),
 * asks the engine to CHECK it, and asks it to EXPORT it. The engine's verdict
 * is the answer to the questions a run would otherwise answer by writing a
 * probe script: does the vocabulary resolve, does every guard read something
 * an effect fills, is the state behind the guard reachable.
 *
 * This exists because of what it replaced. The gates only run on a COMPLETE
 * deliverable, so a run with half its fragments had no mechanical feedback at
 * all - and the only instrument left was the engine, which a run reached by
 * building probe documents and reading the answers out of the reachability
 * counts. Sixteen probes in one run; forty minutes in another.
 *
 * So: write the vocabulary, the states, the transitions and the invariants,
 * then RUN THIS. It answers in seconds what a probe script answers in minutes,
 * and it answers about YOUR model.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const SKILL = path.resolve(__dirname, "..");
const PROJECT = path.join(SKILL, "model", "Onboarding.Model");
const [, , dirArg, workArg] = process.argv;
if (!dirArg) {
  console.error("usage: node feedback.js <fragments-dir> [work-dir]");
  process.exit(2);
}
const dir = path.resolve(dirArg);
const work = path.resolve(workArg || path.join(SKILL, "scratch", "feedback"));
fs.mkdirSync(work, { recursive: true });

function run(args, label) {
  const cmd = ["run", "--no-build", "--project", PROJECT, "--", ...args];
  try {
    const out = execFileSync("dotnet", cmd, { encoding: "utf8", cwd: SKILL, shell: true, stdio: ["pipe", "pipe", "pipe"] });
    console.log(`--- ${label}\n${out.trim()}`);
    return { ok: true, out };
  } catch (e) {
    const out = (e.stdout || "") + (e.stderr || "");
    console.log(`--- ${label}\n${out.trim()}`);
    return { ok: false, out };
  }
}

// 1. what is written so far
const partial = path.join(work, "partial.json");
console.log("=== assembling what is written so far ===");
try {
  const asm = execFileSync("node", [path.join(SKILL, "scripts", "assemble.js"), dir, partial, "--partial"],
    { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  console.log(asm.trim());
} catch (e) {
  console.log((e.stdout || "") + (e.stderr || "").trim());
  process.exit(1);
}

// 2. the engine's verdict on it
const checked = run(["check", partial], "CHECK");
const exported = run(["export", partial, "x", path.join(work, "partial-export.json")], "EXPORT");

// 3. the reachability, which is what a probe script was built to find out
try {
  const ex = JSON.parse(fs.readFileSync(path.join(work, "partial-export.json"), "utf8"));
  const unreachable = (ex.states || []).filter(s => !s.reachable);
  console.log("=== what the engine says ===");
  console.log(`states visited: ${ex.statesVisited}   frontier exhausted: ${ex.frontierExhausted}`);
  console.log(`unreachable states: ${unreachable.length ? unreachable.map(s => `${s.id} ${s.name}`).join(", ") : "none"}`);
  if (ex.violations && ex.violations.length) {
    console.log("violations:");
    ex.violations.slice(0, 20).forEach(v => console.log(`  - ${typeof v === "string" ? v : JSON.stringify(v)}`));
  }
  if (ex.findings && ex.findings.length) {
    console.log(`findings: ${ex.findings.length}`);
    ex.findings.slice(0, 10).forEach(f => console.log(`  - ${f.id} ${f.title}`));
  }
} catch (e) {
  console.log("(no export to read)");
}
process.exit(checked.ok && exported.ok ? 0 : 1);
