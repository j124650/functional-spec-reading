#!/usr/bin/env node
/*
 * Build the explorer page from the verifier's export.
 *
 * The page is SELF-CONTAINED: the export is embedded in a script block, not
 * fetched. A fetch() of a sibling file is blocked when the HTML is opened
 * from disk (file://) — which is exactly how a reviewer opens it — and the
 * failure is quiet: the page renders, with the data-driven views empty.
 *
 * The standalone .json is a BUILD ARTIFACT, not a runtime dependency. Two
 * copies of the data means two copies to drift, so the regeneration is one
 * command:
 *
 *     dotnet run --project:model/Onboarding.Model -- export \
 *         ../../domain-model-and-state-machines.md slim explorer/explorer-data.json
 *     node explorer/build.js
 *
 * or, from the repository root, `node explorer/build.js --all` which runs
 * the exporter first and then embeds its output.
 *
 * The build also CLOSES THE SEAM. The contract is one file the exporter and
 * the page both obey; the checks that hold them to it live in the skill, so
 * there is one implementation of them rather than a copy per project:
 *
 *     check-export-contract.js  the export against the contract
 *     check-contract-vs-page.js  the contract against the page
 *
 * Usage:
 *   node explorer/build.js [--data <export.json>] [--out <explorer.html>]
 *                          [--all] [--check] [--no-verify]
 *
 *   --all      run the verifier's export first, then embed it
 *   --check    report drift without writing (exit 1 if the page is stale)
 *   --no-verify  skip the contract checks (they are the gate; skip them
 *                only when the contract itself is what you are changing)
 */
"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const TEMPLATE = path.join(ROOT, "explorer", "explorer.template.html");
const DEFAULT_DATA = path.join(ROOT, "explorer", "explorer-data.json");
const DEFAULT_OUT = path.join(ROOT, "explorer", "explorer.html");
const DOC = path.join(ROOT, "domain-model-and-state-machines.md");
const PROJECT = path.join(ROOT, "model", "Onboarding.Model");

/* The contract and the checks live in the skill, so there is one
   implementation of them rather than a copy per project. The contract is
   format-level — every project in this format obeys the same one — while
   the page is this project's. Where the skill is installed is a fact of
   this machine, not of the project, so it is looked up and overridable. */
function skillDir() {
  if (process.env.SPEC_SKILL_DIR) return path.resolve(process.env.SPEC_SKILL_DIR);
  const home = process.env.HERMES_HOME || path.join(os.homedir(), ".hermes");
  return path.join(home, "skills", "software-development", "functional-spec-reading");
}
const SKILL = skillDir();
const CHECKS = path.join(SKILL, "scripts");
const CONTRACT = path.join(SKILL, "explorer", "export.contract.json");

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i < 0 || i + 1 >= process.argv.length) return fallback;
  return path.resolve(process.argv[i + 1]);
}
const has = f => process.argv.includes(f);

const dataPath = arg("--data", DEFAULT_DATA);
const outPath = arg("--out", DEFAULT_OUT);

if (has("--all")) {
  const args = ["run", "--no-build", "--", "export", DOC, "slim", dataPath];
  console.log("running the verifier's export…");
  execFileSync("dotnet", args, { cwd: PROJECT, stdio: "inherit" });
}

if (!fs.existsSync(dataPath)) {
  console.error("no export at " + dataPath +
    "\nrun the exporter first, or use --all.");
  process.exit(2);
}

/* The gate. Both checks exit non-zero and name the disagreement, so a
   failure here is a failure to explain, not a mystery. */
if (!has("--no-verify")) {
  const steps = [
    ["check-export-contract.js", [dataPath, CONTRACT], "the export against the contract"],
    ["check-contract-vs-page.js", [CONTRACT, TEMPLATE], "the contract against the page"],
  ];
  for (const [script, args, what] of steps) {
    const full = path.join(CHECKS, script);
    if (!fs.existsSync(full)) {
      console.error("the contract checks are not at " + full +
        "\nset SPEC_SKILL_DIR to the skill directory, or pass --no-verify.");
      process.exit(2);
    }
    console.log("checking " + what + "…");
    try {
      execFileSync(process.execPath, [full, ...args], { stdio: "inherit" });
    } catch (e) {
      /* The check has already said what is wrong, on its own output. */
      console.error("\nthe build stops here: " + what + " does not hold.");
      process.exit(1);
    }
  }
}

const data = fs.readFileSync(dataPath, "utf8");
const parsed = JSON.parse(data);   // a broken export must fail here, loudly

const template = fs.readFileSync(TEMPLATE, "utf8");
const MARK = "__DATA__";
if (!template.includes(MARK)) {
  console.error("the template has no " + MARK + " placeholder");
  process.exit(2);
}

/*
 * The JSON goes into a <script type="application/json"> block. A "</script>"
 * inside the data would end the block early, so every "<" is escaped — the
 * JSON parser reads it back identically.
 */
const safe = data.replace(/</g, "\\u003c");
const page = template.replace(MARK, safe);

if (has("--check")) {
  const current = fs.existsSync(outPath) ? fs.readFileSync(outPath, "utf8") : "";
  if (current === page) {
    console.log("the page is up to date");
    process.exit(0);
  }
  console.error("the page is STALE — the export has changed since it was built");
  process.exit(1);
}

fs.writeFileSync(outPath, page, "utf8");

const counts = parsed.counts || {};
console.log("built " + path.relative(ROOT, outPath) +
  "  (" + Math.round(page.length / 1024) + " KB, self-contained)");
console.log("  " + (counts.machines || 0) + " machines · " + (counts.transitions || 0) +
  " transitions · " + (counts.invariants || 0) + " invariants · " +
  (counts.findings || 0) + " findings · " + (parsed.statesVisited || 0) + " reachable states");
