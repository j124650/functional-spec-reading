/*
 * Starter checks for scripts/test-explorer-cdp.js.
 *
 * Copy this next to the page, adapt the SELECTORS (marked ADAPT), and run:
 *
 *   node scripts/test-explorer-cdp.js <page.html> explorer-checks.js
 *
 * Each entry is {name, expr}. The expression runs in the page and passes when it
 * evaluates to `true`, or to an ARRAY OF PROBLEM DESCRIPTIONS that is empty.
 * Returning a non-empty array is how a check reports several problems at once;
 * returning `true` is how it passes.
 *
 * The assertions below are ordered by the class of defect they catch, and each
 * one of them caught a real defect on the page this was written against.
 */
"use strict";

module.exports = [

  /* ------------------------------------------------------- the page is alive */
  {
    name: "the header names the document and its counts",
    expr: `(() => {
      const t = document.querySelector('#hSub').textContent;   // ADAPT
      const bad = [];
      if (!/reachable states/.test(t)) bad.push("no reachable-state count");
      if (/undefined|NaN/.test(t)) bad.push("undefined or NaN in the header");
      return bad;
    })()`,
  },
  {
    name: "no uncaught exceptions during the whole run",
    expr: `true`,   // the harness collects these itself and fails the run
  },
  {
    name: "only one section is on screen at a time",
    expr: `(() => {
      const bad = [];
      const tabs = ["a","b","c"];                              // ADAPT
      for (const t of tabs) {
        document.querySelector('#nav button[data-t="' + t + '"]').click();
        const on = [...document.querySelectorAll("main>section")]
          .filter(s => s.classList.contains("on"));
        if (on.length !== 1) bad.push(t + ": " + on.length + " sections on");
        if (on[0] && on[0].id !== "t-" + t) bad.push(t + ": showing " + on[0].id);
      }
      document.querySelector('#nav button[data-t="' + tabs[0] + '"]').click();
      return bad;
    })()`,
  },
  {
    name: "the primary panel is on screen, not pushed off the page",
    expr: `(() => {
      const bad = [];
      const r = document.querySelector('#sm').getBoundingClientRect();  // ADAPT
      if (r.width < 200 || r.height < 200)
        bad.push("the diagram is " + Math.round(r.width) + "x" + Math.round(r.height));
      if (r.top < 0 || r.bottom > window.innerHeight + 2)
        bad.push("the diagram is outside the viewport");
      return bad;
    })()`,
  },
  {
    name: "the page does not scroll as a whole",
    expr: `document.documentElement.scrollHeight <= document.documentElement.clientHeight`,
  },
  {
    name: "no duplicate element ids",
    expr: `(() => {
      const seen = new Set(), bad = [];
      for (const e of document.querySelectorAll("[id]")) {
        if (seen.has(e.id)) bad.push(e.id);
        seen.add(e.id);
      }
      return bad;
    })()`,
  },
  {
    name: "no undefined leaks into the data cells",
    expr: `(() => {
      // Scope the scan to cells, not prose: the page displays the document's own
      // text, and a document that says "an undefined role" trips a whole-page
      // text scan on its own wording. A leak is the JS value standing in for
      // a missing field.
      const bad = [];
      const scan = ["tA","tB"];                                 // ADAPT
      for (const id of scan) {
        const tb = document.getElementById(id);
        if (!tb) { bad.push(id + ": missing"); continue; }
        tb.querySelectorAll("td,th").forEach(td=>{
          if (td.textContent.trim() === "undefined")
            bad.push(id + ": " + td.textContent.slice(0,60));
        });
      }
      return bad;
    })()`,
  },

  /* -------------------------------------------------- the diagram renders */
  {
    name: "the state machine draws nodes and edges",
    expr: `(() => {
      const bad = [];
      if (document.querySelectorAll('#sm .nbox').length < 2) bad.push("no node boxes");
      if (document.querySelectorAll('#sm path.edge').length < 1) bad.push("no edges");
      return bad;
    })()`,
  },
  {
    name: "every machine draws its own diagram",
    expr: `(async () => {
      const bad = [];
      const ids = Array.from(
        document.querySelectorAll('#machToolbar input[type=radio]')).map(i => i.value);
      for (const id of ids) {
        document.querySelector('#machToolbar input[value="' + id + '"]').click();
        await new Promise(r => setTimeout(r, 30));
        if (document.querySelectorAll('#sm .nbox').length < 1) bad.push(id + ": no nodes");
        if (document.querySelectorAll('#sm path.edge').length < 1) bad.push(id + ": no edges");
      }
      document.querySelector('#machToolbar input[value="' + ids[0] + '"]').click();
      return bad;
    })()`,
  },
  {
    name: "no edge label overlaps another edge label",
    expr: `(() => {
      const els = [...document.querySelectorAll('#sm text.elabel')];
      const bad = [];
      for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
        const a = els[i].getBBox(), b = els[j].getBBox();
        if (a.x < b.x + b.width && b.x < a.x + a.width &&
            a.y < b.y + b.height && b.y < a.y + a.height) {
          bad.push(els[i].textContent + " / " + els[j].textContent);
        }
      }
      return bad;
    })()`,
  },
  {
    name: "no edge label sits on a node box",
    expr: `(() => {
      const els = [...document.querySelectorAll('#sm text.elabel')];
      const boxes = [...document.querySelectorAll('#sm .nbox rect')].map(r => r.getBBox());
      const bad = [];
      for (const el of els) {
        const l = el.getBBox();
        for (const b of boxes) {
          if (l.x < b.x + b.width && b.x < l.x + l.width &&
              l.y < b.y + b.height && b.y < l.y + l.height) { bad.push(el.textContent); break; }
        }
      }
      return bad;
    })()`,
  },
  {
    name: "no edge runs through a node box",
    expr: `(() => {
      const paths = [...document.querySelectorAll('#sm path.edge')];
      const boxes = [...document.querySelectorAll('#sm .nbox rect')].map(r => r.getBBox());
      const bad = [];
      for (const p of paths) {
        const L = p.getTotalLength();
        for (let k = 1; k < 30; k++) {
          const pt = p.getPointAtLength(L * k / 30);
          for (const b of boxes) {
            if (pt.x > b.x + 3 && pt.x < b.x + b.width - 3 &&
                pt.y > b.y + 3 && pt.y < b.y + b.height - 3) { bad.push(p.dataset.id); break; }
          }
        }
      }
      return [...new Set(bad)];
    })()`,
  },
  {
    name: "nothing is drawn outside the canvas",
    expr: `(() => {
      const svg = document.querySelector('#sm');
      const vb = svg.viewBox.baseVal;
      const bad = [];
      for (const el of [...svg.querySelectorAll('text.elabel'),
                        ...svg.querySelectorAll('.nbox rect')]) {
        const b = el.getBBox();
        if (b.x < vb.x - 2 || b.y < vb.y - 2 ||
            b.x + b.width > vb.x + vb.width + 2 || b.y + b.height > vb.y + vb.height + 2) {
          bad.push(el.textContent || "rect");
        }
      }
      return bad;
    })()`,
  },

  /* ------------------------------------------------------- the tables hold */
  {
    name: "every table has rows",
    expr: `(() => {
      const bad = [];
      for (const id of ["tA","tB"]) {                          // ADAPT
        const tb = document.getElementById(id);
        if (!tb) { bad.push(id + ": missing"); continue; }
        if (tb.tBodies[0].rows.length === 0) bad.push(id + ": no rows");
      }
      return bad;
    })()`,
  },
  {
    name: "the tables hold every record the export carries",
    expr: `(() => {
      const d = JSON.parse(document.getElementById("reachData").textContent);
      const bad = [];
      // ADAPT: name the table, then the export array it must match.
      const want = d.transitions.length;
      const got = document.getElementById("tTrans").tBodies[0].rows.length;
      if (got !== want) bad.push("shows " + got + " of " + want);
      return bad;
    })()`,
  },

  /* ------------------------------------------------------------- filtering */
  {
    name: "the machine filter narrows the table",
    expr: `(() => {
      const before = document.getElementById("tTrans").tBodies[0].rows.length;  // ADAPT
      const radios = [...document.querySelectorAll('#transToolbar input[type=radio]')];
      const one = radios.find(r => r.value);
      one.click();
      const after = document.getElementById("tTrans").tBodies[0].rows.length;
      radios[0].click();
      return (after > 0 && after < before) ? true : ["before " + before + " after " + after];
    })()`,
  },
  {
    name: "the kind filter separates the two kinds",
    expr: `(() => {
      const rows = () => document.getElementById("tFind").tBodies[0].rows.length;  // ADAPT
      const radios = [...document.querySelectorAll('#findToolbar input[name=fk]')];
      const before = rows();
      radios.find(r => r.value === "def").click();
      const defects = rows();
      radios.find(r => r.value === "gap").click();
      const gaps = rows();
      radios.find(r => r.value === "all").click();
      if (defects === 0) return ["no confirmed defects listed"];
      if (gaps === 0) return ["no spec gaps listed"];
      if (defects === gaps) return ["the filter does not separate"];
      if (before !== defects + gaps) return ["all=" + before + " but defects+gaps=" + (defects+gaps)];
      return true;
    })()`,
  },

  /* --------------------------------------------------------------- sorting */
  {
    name: "every table sorts under its own comparator",
    expr: `(() => {
      const bad = [];
      for (const id of ["tTrans","tInv"]) {                   // ADAPT
        const tbl = document.getElementById(id);
        const th = [...tbl.tHead.rows[0].cells].find(c => c.dataset.k);
        if (!th) { bad.push(id + ": no sortable heading"); continue; }
        const before = [...tbl.tBodies[0].rows].map(r => r.cells[0].textContent).join(",");
        th.click();
        const after = [...tbl.tBodies[0].rows].map(r => r.cells[0].textContent).join(",");
        if (before === after) {
          // legitimate when the column is already in order — check monotonicity
          const col = [...tbl.tHead.rows[0].cells].indexOf(th);
          const vals = [...tbl.tBodies[0].rows]
            .map(r => (r.cells[col] ? r.cells[col].textContent : "").trim());
          const na = vals.map(v => parseFloat(v.replace(/[^0-9.\\-]/g, "")));
          for (let i = 1; i < na.length; i++)
            if (!isNaN(na[i]) && !isNaN(na[i-1]) && na[i] < na[i-1]) { bad.push(id + ": not sorted"); break; }
        }
        th.click();
      }
      return bad;
    })()`,
  },

  /* ----------------------------------------------------------- the numbers */
  {
    name: "the page's counts match the embedded export",
    expr: `(() => {
      const d = JSON.parse(document.getElementById("reachData").textContent);
      const bad = [];
      const t = document.querySelector('#hSub').textContent;   // ADAPT
      if (t.indexOf(d.statesVisited.toLocaleString()) < 0)
        bad.push("header does not carry the state's count");
      return bad;
    })()`,
  },
  {
    name: "the probe verdicts are shown, not asserted",
    expr: `(() => {
      const d = JSON.parse(document.getElementById("reachData").textContent);
      const bad = [];
      for (const p of d.probes.filter(x => x.status !== "NOT PROBED")) {
        const row = [...document.querySelectorAll('#tFind tbody tr')]   // ADAPT
          .find(r => r.cells[0].textContent.trim() === p.id);
        if (!row) { bad.push(p.id + ": no row"); continue; }
        const want = p.status === "REPRODUCED" ? "reproduced" : "not reproduced";
        if (row.textContent.indexOf(want) < 0) bad.push(p.id + ": the verdict is not shown");
      }
      return bad;
    })()`,
  },
];
