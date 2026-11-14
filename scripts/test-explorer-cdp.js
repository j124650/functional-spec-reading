/**
 * test-explorer-cdp.js - runnable regression test for a self-contained HTML page.
 *
 * Drives the page in headless Chrome over the DevTools Protocol and asserts:
 *   - the page raised no uncaught exception and logged no console error
 *   - the page's inline script parses
 *   - the element ids are unique
 *   - every check in the checks file holds
 *
 * Usage:
 *   node test-explorer-cdp.js <page.html> [checks.js]
 *
 * The checks file exports an array of {name, expr}. Each `expr` is a string of
 * JavaScript evaluated in the page. It passes when it evaluates to true, or to
 * an array of problem descriptions that is empty. Anything else fails and the
 * value is printed.
 *
 *   module.exports = [
 *     {name:"invariants table has rows",
 *      expr:"document.querySelectorAll('#iTable tbody tr').length > 0"},
 *     {name:"no undefined leaks",
 *      expr:"(()=>{const bad=[];for(const id of ['iTable','gTable']){const e=document.getElementById(id);if(e&&/\\bundefined\\b/.test(e.innerText))bad.push(id);}return bad;})()"}
 *   ];
 *
 * Zero dependencies: Node 22 ships global fetch and WebSocket.
 */
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

function findChrome() {
  for (const c of CHROME_CANDIDATES) if (fs.existsSync(c)) return c;
  return null;
}

function toFileUrl(p) {
  return "file:///" + path.resolve(p).replace(/\\/g, "/");
}

/* --------------------------------------------------------------- CDP glue */

let ws = null, nextId = 1;
const pending = new Map();
const pageErrors = [];
const consoleErrors = [];

function send(method, params = {}) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const r = await send("Runtime.evaluate", {
    expression, returnByValue: true, awaitPromise: true,
  });
  if (r.exceptionDetails) {
    throw new Error("evaluate threw: " +
      (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  }
  return r.result.value;
}

/* ------------------------------------------------------------- assertions */

const results = [];
function record(name, pass, detail = "") {
  results.push({ name, pass: !!pass, detail: String(detail) });
}

async function runCheck(name, expr) {
  let value, threw = null;
  try {
    value = await evaluate(expr);
  } catch (e) {
    threw = e.message;
  }
  if (threw) { record(name, false, "threw: " + threw); return; }
  if (Array.isArray(value)) {
    record(name, value.length === 0, value.join(" | "));
  } else {
    record(name, value === true, "got " + JSON.stringify(value));
  }
}

/* ------------------------------------------------------------------ main */

(async () => {
  const pagePath = process.argv[2];
  if (!pagePath) {
    console.error("usage: node test-explorer-cdp.js <page.html> [checks.js]");
    process.exit(2);
  }
  if (!fs.existsSync(pagePath)) {
    console.error("page not found: " + pagePath);
    process.exit(2);
  }

  let checks = [];
  if (process.argv[3]) {
    const mod = require(path.resolve(process.argv[3]));
    checks = typeof mod === "function" ? mod() : mod;
    if (!Array.isArray(checks)) {
      console.error("checks file must export an array of {name, expr}");
      process.exit(2);
    }
  }

  const chrome = findChrome();
  if (!chrome) {
    console.error("Chrome/Edge not found. Set CHROME_PATH to the executable.");
    process.exit(2);
  }

  /* ---- parse the inline script before opening anything ---------------- */
  const html = fs.readFileSync(pagePath, "utf8");
  const blocks = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
  const mainBlock = blocks.find(b => !/json/i.test(b[1]));
  if (mainBlock) {
    try {
      new (require("vm").Script)(mainBlock[2], { filename: "page.js" });
    } catch (e) {
      console.error("FAIL  the page's inline script does not parse\n        " + e.message);
      process.exit(1);
    }
  }

  /* ---- launch headless Chrome ---------------------------------------- */
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), "explorer-test-"));
  const proc = spawn(chrome, [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--no-first-run",
    "--disable-extensions", "--remote-debugging-port=0",
    "--user-data-dir=" + userDir, toFileUrl(pagePath),
  ], { stdio: ["ignore", "ignore", "pipe"] });

  let stderr = "";
  proc.stderr.on("data", d => { stderr += d.toString(); });

  /* Chrome writes the port it chose to DevToolsActivePort in the profile. */
  const portFile = path.join(userDir, "DevToolsActivePort");
  let port = null;
  for (let i = 0; i < 150 && port === null; i++) {
    await new Promise(r => setTimeout(r, 100));
    if (fs.existsSync(portFile)) {
      const line = fs.readFileSync(portFile, "utf8").split("\n")[0];
      if (line) port = line.trim();
    }
  }
  if (!port) {
    console.error("Chrome did not report a debugging port.\n" + stderr.slice(0, 800));
    proc.kill();
    process.exit(2);
  }

  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target = list.find(t => t.type === "page" && t.url.startsWith("file:"))
    || list.find(t => t.type === "page");
  if (!target) {
    console.error("no page target. targets:\n" + JSON.stringify(list, null, 1));
    proc.kill();
    process.exit(2);
  }

  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener("open", res);
    ws.addEventListener("error", () => rej(new Error("cdp websocket failed")));
  });

  ws.addEventListener("message", ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      if (m.error) p.reject(new Error(m.error.message));
      else p.resolve(m.result);
      return;
    }
    if (m.method === "Runtime.exceptionThrown") {
      const d = m.params.exceptionDetails;
      pageErrors.push(d.exception?.description || d.text);
    }
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
      consoleErrors.push(m.params.args.map(a => a.value ?? a.description).join(" "));
    }
    if (m.method === "Log.entryAdded" && m.params.entry.level === "error") {
      consoleErrors.push(m.params.entry.text);
    }
  });

  await send("Runtime.enable");
  await send("Log.enable");
  await send("Page.enable");

  /* Emulate a desktop viewport. The headless default is small enough that a
     wide layout does not overflow, so a layout assertion run at that size
     passes against a page that is broken at the size a reviewer reads it.
     Override with EXPLORER_VIEWPORT_W / EXPLORER_VIEWPORT_H. */
  const vpW = Number(process.env.EXPLORER_VIEWPORT_W || 1600);
  const vpH = Number(process.env.EXPLORER_VIEWPORT_H || 1000);
  await send("Emulation.setDeviceMetricsOverride", {
    width: vpW, height: vpH, deviceScaleFactor: 1, mobile: false,
  });

  /* Wait for the document, then let the page's own init settle. */
  for (let i = 0; i < 80; i++) {
    const ready = await evaluate(`document.readyState === "complete"`);
    if (ready) break;
    await new Promise(r => setTimeout(r, 150));
  }
  await new Promise(r => setTimeout(r, 500));

  /* ---- built-in checks ------------------------------------------------ */
  record("no uncaught page exceptions", pageErrors.length === 0,
         pageErrors.join(" || ").slice(0, 600));
  record("no console errors", consoleErrors.length === 0,
         consoleErrors.join(" || ").slice(0, 600));
  await runCheck("no duplicate element ids", `
    (() => { const seen=new Set(), dup=[];
      document.querySelectorAll('[id]').forEach(e=>{
        if(seen.has(e.id)) dup.push(e.id); else seen.add(e.id); });
      return dup; })()`);
  /* A table wider than the box it scrolls in runs its content off the edge.
     Check every table, at the viewport a reviewer reads. */
  await runCheck("no table overflows its scroll box", `
    (() => { const bad=[];
      for (const t of document.querySelectorAll(".scroll>table")) {
        if (!t.offsetParent) continue;            // a hidden tab
        const sc = t.closest(".scroll");
        if (sc.scrollWidth > sc.clientWidth + 1)
          bad.push(t.id + ":" + sc.scrollWidth + ">" + sc.clientWidth);
      }
      return bad; })()`);

  /* ---- the caller's checks -------------------------------------------- */
  for (const c of checks) {
    if (!c || !c.name || !c.expr) {
      record("(malformed check)", false, JSON.stringify(c));
      continue;
    }
    await runCheck(c.name, c.expr);
  }

  /* ---- report ---------------------------------------------------------- */
  try { ws.close(); } catch { }
  proc.kill();
  try { fs.rmSync(userDir, { recursive: true, force: true }); } catch { }

  const failed = results.filter(r => !r.pass);
  for (const r of results) {
    console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}` +
      (r.pass ? "" : `\n        ${r.detail}`));
  }
  console.log(`\n${results.length - failed.length}/${results.length} assertions passed`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => {
  console.error("harness error:", e.message);
  process.exit(2);
});
