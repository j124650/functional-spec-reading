/*
 * The checks the explorer must satisfy.
 *
 * Each `expr` runs in the page and passes when it evaluates to true, or to
 * an array of problem descriptions that is empty.
 *
 * The list covers the classes of defect that a page can carry while still
 * LOOKING finished: a view that never rendered, a filter wired to nothing,
 * a table that promises sorting it does not do, a label sitting on a node
 * box, a number that drifted from the export.
 */
"use strict";

module.exports = [
  /* ---------------------------------------------------- the page is alive */
  {
    name: "the header names the document and its counts",
    expr: `(() => {
      const t = document.querySelector('#hSub').textContent;
      const bad = [];
      const d = JSON.parse(document.getElementById("reachData").textContent);
      /* What the export is a model OF, in the export's words - not this
         check's idea of what it should say. */
      if (d.modelOf && t.indexOf(d.modelOf) < 0)
        bad.push("the header does not say what the export is a model of: " + d.modelOf);
      if (!/reachable states/.test(t)) bad.push("no reachable-state count");
      if (/undefined|NaN/.test(t)) bad.push("undefined or NaN in the header");
      return bad;
    })()`,
  },
  {
    name: "every tab shows content, with no interaction",
    expr: `(async () => {
      const bad = [];
      for (const t of ["machines","transitions","invariants","reach","couplings","findings","open","glossary","catalogue"]) {
        document.querySelector('#nav button[data-t="' + t + '"]').click();
        const s = document.querySelector('#t-' + t);
        if (!s.classList.contains("on")) { bad.push(t + ": not active"); continue; }
        if (s.textContent.trim().length < 40) bad.push(t + ": empty");
      }
      document.querySelector('#nav button[data-t="machines"]').click();
      return bad;
    })()`,
  },
  {
    name: "no undefined leaks into any view",
    expr: `(() => {
      /* A leak is the JS value "undefined" standing in for a field that
         was not there. The Open-work table renders the document's prose
         verbatim, where "an undefined role" is an English phrase and not
         a leak, so the scan covers the data tables and the machine
         detail — the places where a missing field would show up. */
      const bad = [];
      const scan = ["tTrans","tInv","tReach","tCoup","tCtx","tFind","tCov"];
      for (const id of scan) {
        const tb = document.getElementById(id);
        if (!tb) { bad.push(id + ": missing"); continue; }
        tb.querySelectorAll("td,th").forEach(td=>{
          if (td.textContent.trim() === "undefined" || /\\bundefined\\b\\s*$/.test(td.textContent))
            bad.push(id + ": " + td.textContent.slice(0,60));
        });
      }
      const d = document.querySelector("#machDetail");
      if (d && /\\bundefined\\b/.test(d.textContent)) bad.push("machine detail: " + d.textContent.slice(0,60));
      return bad;
    })()`,
  },
  {
    name: "only one section is on screen at a time",
    expr: `(() => {
      const bad = [];
      for (const t of ["machines","transitions","invariants","reach","couplings","findings","open","glossary","catalogue"]) {
        document.querySelector('#nav button[data-t="' + t + '"]').click();
        const on = [...document.querySelectorAll("main>section")].filter(s => s.classList.contains("on"));
        if (on.length !== 1) bad.push(t + ": " + on.length + " sections on");
        if (on[0] && on[0].id !== "t-" + t) bad.push(t + ": showing " + on[0].id);
      }
      document.querySelector('#nav button[data-t="machines"]').click();
      return bad;
    })()`,
  },
  {
    name: "the diagram panel is on screen, not pushed off the page",
    expr: `(() => {
      const bad = [];
      document.querySelector('#nav button[data-t="machines"]').click();
      const svg = document.querySelector('#sm');
      const r = svg.getBoundingClientRect();
      if (r.width < 200 || r.height < 200) bad.push("the diagram is " + Math.round(r.width) + "x" + Math.round(r.height));
      if (r.top < 0 || r.top > window.innerHeight) bad.push("the diagram starts outside the viewport");
      /* The diagram may be taller than the panel — it scrolls — but the
         panel that holds it must be on the page. */
      const panel = svg.closest(".panel");
      if (!panel) return ["the diagram has no panel"];
      const pr = panel.getBoundingClientRect();
      if (pr.top < 0 || pr.bottom > window.innerHeight + 2)
        bad.push("the diagram's panel is outside the viewport");
      return bad;
    })()`,
  },
  {
    name: "the diagram's labels stay readable on screen",
    expr: `(() => {
      const bad = [];
      document.querySelector('#nav button[data-t="machines"]').click();
      const svg = document.querySelector('#sm');
      const r = svg.getBoundingClientRect();
      const vb = svg.viewBox.baseVal;
      if (!r.width || !vb.width) return ["the diagram has no size"];
      const scale = r.width/vb.width;
      for (const sel of ["text.sname","text.sid","text.elabel"]) {
        const t = svg.querySelector(sel);
        if (!t) { bad.push(sel + ": no label"); continue; }
        const onScreen = parseFloat(getComputedStyle(t).fontSize)*scale;
        if (onScreen < 8) bad.push(sel + ": renders at " + onScreen.toFixed(1) + "px, too small to read");
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
      const ids = Array.from(document.querySelectorAll('#machToolbar input[type=radio]')).map(i => i.value);
      for (const id of ids) {
        document.querySelector('#machToolbar input[value="' + id + '"]').click();
        await new Promise(r => setTimeout(r, 30));
        const n = document.querySelectorAll('#sm .nbox').length;
        const e = document.querySelectorAll('#sm path.edge').length;
        if (n < 1) bad.push(id + ": no nodes");
        if (e < 1) bad.push(id + ": no edges");
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
      for (const el of [...svg.querySelectorAll('text.elabel'), ...svg.querySelectorAll('.nbox rect')]) {
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
      for (const id of ["tTrans","tInv","tReach","tCoup","tCtx","tFind","tOpen","tCov","tGlos"]) {
        const tb = document.getElementById(id);
        if (!tb) { bad.push(id + ": missing"); continue; }
        if (tb.tBodies[0].rows.length === 0) bad.push(id + ": no rows");
      }
      return bad;
    })()`,
  },
  {
    name: "the transition table holds every transition",
    expr: `(() => {
      const tb = document.getElementById("tTrans");
      const want = JSON.parse(document.getElementById("reachData").textContent).transitions.length;
      return tb.tBodies[0].rows.length === want ? true : ["shows " + tb.tBodies[0].rows.length + " of " + want];
    })()`,
  },
  {
    name: "the invariants table holds every invariant",
    expr: `(() => {
      const tb = document.getElementById("tInv");
      const want = JSON.parse(document.getElementById("reachData").textContent).invariants.length;
      return tb.tBodies[0].rows.length === want ? true : ["shows " + tb.tBodies[0].rows.length + " of " + want];
    })()`,
  },
  {
    name: "the findings table holds every finding",
    expr: `(() => {
      const tb = document.getElementById("tFind");
      const want = JSON.parse(document.getElementById("reachData").textContent).findings.length;
      return tb.tBodies[0].rows.length === want ? true : ["shows " + tb.tBodies[0].rows.length + " of " + want];
    })()`,
  },

  /* ------------------------------------------------------------- filtering */
  {
    name: "the machine filter narrows the transition table",
    expr: `(() => {
      const before = document.getElementById("tTrans").tBodies[0].rows.length;
      const radios = [...document.querySelectorAll('#transToolbar input[type=radio]')];
      const one = radios.find(r => r.value);
      one.click();
      const after = document.getElementById("tTrans").tBodies[0].rows.length;
      radios[0].click();
      return (after > 0 && after < before) ? true :
        ["before " + before + " after " + after];
    })()`,
  },
  {
    name: "the invariant filter narrows to the unchecked ones",
    expr: `(() => {
      const before = document.getElementById("tInv").tBodies[0].rows.length;
      const radios = [...document.querySelectorAll('#invToolbar input[type=radio]')];
      radios.find(r => r.value === "unchecked").click();
      const after = document.getElementById("tInv").tBodies[0].rows.length;
      radios.find(r => r.value === "all").click();
      return (after > 0 && after < before) ? true :
        ["before " + before + " after " + after];
    })()`,
  },
  {
    name: "the finding-kind filter separates defects from gaps",
    expr: `(() => {
      const rows = () => document.getElementById("tFind").tBodies[0].rows.length;
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
      if (before !== defects + gaps) return ["all=" + before + " but defects+gaps=" + (defects + gaps)];
      return true;
    })()`,
  },
  {
    name: "the probe filter selects the reproduced findings",
    expr: `(() => {
      const rows = () => document.getElementById("tFind").tBodies[0].rows.length;
      const radios = [...document.querySelectorAll('#findToolbar input[name=fp]')];
      radios.find(r => r.value === "REPRODUCED").click();
      const n = rows();
      radios.find(r => r.value === "all").click();
      return n > 0 ? true : ["no finding is marked reproduced"];
    })()`,
  },
  {
    name: "the glossary table holds every ubiquitous-language term",
    expr: `(() => {
      const tb = document.getElementById("tGlos");
      const want = JSON.parse(document.getElementById("reachData").textContent).glossary.length;
      return tb.tBodies[0].rows.length === want ? true : ["shows " + tb.tBodies[0].rows.length + " of " + want];
    })()`,
  },
  {
    name: "the glossary status filter narrows the terms",
    expr: `(() => {
      const before = document.getElementById("tGlos").tBodies[0].rows.length;
      const radios = [...document.querySelectorAll('#glossaryToolbar input[type=radio]')];
      const one = radios.find(r => r.value && r.value !== "all");
      if (!one) return ["no status filter other than All"];
      one.click();
      const after = document.getElementById("tGlos").tBodies[0].rows.length;
      radios[0].click();
      return (after > 0 && after < before) ? true : ["before " + before + " after " + after];
    })()`,
  },

  /* --------------------------------------------------- the controls say
     what they do: a radio is round, a checkbox is square, and a machine
     is named by its title with its id as a handle. */
  {
    name: "every filter control is a radio, and looks like one",
    expr: `(() => {
      const bad = [];
      for (const host of ["#machToolbar","#transToolbar","#invToolbar","#reachToolbar","#findToolbar","#glossaryToolbar"]) {
        const h = document.querySelector(host);
        if (!h) { bad.push(host + ": missing"); continue; }
        for (const i of h.querySelectorAll("input")) {
          if (i.type === "search" || i.type === "text") continue;   // a search box, not a choice
          if (i.type !== "radio") bad.push(host + ": a " + i.type + " is not a radio");
          const cs = getComputedStyle(i);
          if (cs.borderRadius.indexOf("%") < 0 && parseFloat(cs.borderRadius) < 6)
            bad.push(host + ": a radio is drawn as a square");
        }
      }
      return bad;
    })()`,
  },
  {
    name: "the findings filters are two separate, labelled groups",
    expr: `(() => {
      const bad = [];
      const groups = document.querySelectorAll("#findToolbar .grp");
      if (groups.length !== 2) return ["expected 2 groups, found " + groups.length];
      const names = [...document.querySelectorAll("#findToolbar .glabel")].map(e => e.textContent.trim());
      if (!names[0] || !names[1]) bad.push("a group is unlabelled");
      const kinds = [...document.querySelectorAll('#findToolbar input[name=fk]')];
      const probes = [...document.querySelectorAll('#findToolbar input[name=fp]')];
      if (!kinds.length || !probes.length) bad.push("a group has no options");
      return bad;
    })()`,
  },
  {
    name: "a machine is named by its title in bold, with its id in the regular face",
    expr: `(() => {
      const bad = [];
      const chips = [...document.querySelectorAll("#machToolbar .chip")].filter(c => c.querySelector(".mcode"));
      if (!chips.length) return ["no machine chip carries a title"];
      for (const c of chips) {
        const lab = c.querySelector(".mtitle"), id = c.querySelector(".mcode");
        if (!lab || !id) { bad.push("a chip lacks a title or an id"); continue; }
        if (getComputedStyle(lab).fontWeight < 600) bad.push(lab.textContent + ": the title is not bold");
        if (getComputedStyle(id).fontWeight >= 600) bad.push(id.textContent + ": the id is bold");
        if (lab.textContent.trim() === id.textContent.trim()) bad.push("the title repeats the id");
      }
      return bad;
    })()`,
  },
  {
    name: "the transitions table names the machine by its title",
    expr: `(() => {
      const rows = [...document.querySelectorAll("#tTrans tbody tr")];
      if (!rows.length) return ["no rows"];
      const cell = rows[0].cells[1];
      const lab = cell.querySelector(".mtitle"), id = cell.querySelector(".mcode");
      if (!lab || !id) return ["the machine cell has no title and id"];
      if (getComputedStyle(lab).fontWeight < 600) return ["the title is not bold"];
      if (getComputedStyle(id).fontWeight >= 600) return ["the id is bold"];
      return true;
    })()`,
  },

  /* ------------------------------------------- the selected state stands
     out, and its detail lists what comes in and what goes out. */
  {
    name: "the selected state is visibly different from an unselected one",
    expr: `(() => {
      const bad = [];
      document.querySelector('#nav button[data-t="machines"]').click();
      const boxes = [...document.querySelectorAll("#sm .nbox")];
      if (boxes.length < 2) return ["not enough boxes to compare"];
      const node = boxes[0];
      node.dispatchEvent(new MouseEvent("click", {bubbles:true}));
      const sel = [...document.querySelectorAll("#sm .nbox.sel")];
      if (sel.length !== 1) return ["expected 1 selected box, found " + sel.length];
      const a = sel[0].querySelector("rect"), b = boxes.find(x => x !== sel[0]).querySelector("rect");
      const sa = getComputedStyle(a), sb = getComputedStyle(b);
      if (sa.fill === sb.fill) bad.push("the selected box has the same fill");
      if (sa.strokeWidth === sb.strokeWidth) bad.push("the selected box has the same stroke width");
      return bad;
    })()`,
  },
  {
    name: "the state name is bold and the state id is not",
    expr: `(() => {
      const bad = [];
      const box = document.querySelector("#sm .nbox");
      if (!box) return ["no box"];
      const name = box.querySelector("text.sname"), id = box.querySelector("text.sid");
      if (!name || !id) return ["a box has no name/id pair"];
      if (getComputedStyle(name).fontWeight < 600) bad.push("the name is not bold");
      if (getComputedStyle(id).fontWeight >= 600) bad.push("the id is bold");
      if (!/^ST-\\d{3}$/.test(id.textContent.trim())) bad.push("the id does not look like a state id: " + id.textContent);
      return bad;
    })()`,
  },
  {
    name: "the state detail lists incoming and outgoing transitions",
    expr: `(() => {
      const bad = [];
      document.querySelector('#nav button[data-t="machines"]').click();
      const box = document.querySelector("#sm .nbox");
      box.dispatchEvent(new MouseEvent("click", {bubbles:true}));
      const tabs = [...document.querySelectorAll("#machDetail [data-st]")];
      if (tabs.length !== 3) return ["expected 3 tabs, found " + tabs.length];
      const names = tabs.map(t => t.textContent.trim());
      if (!/Incoming/.test(names[0])) bad.push("no incoming tab: " + names.join(","));
      if (!/Outgoing/.test(names[1])) bad.push("no outgoing tab: " + names.join(","));
      if (!/Invariants/.test(names[2])) bad.push("no invariants tab: " + names.join(","));
      tabs[0].click();
      const inRows = document.querySelectorAll("#stateList tbody tr").length;
      tabs[1].click();
      const outRows = document.querySelectorAll("#stateList tbody tr").length;
      if (!inRows && !outRows) bad.push("both lists are empty");
      return bad;
    })()`,
  },

  /* ------------------------------------------- a rule reads in words too */
  {
    name: "a guard is shown in words, with the state names decoded",
    expr: `(() => {
      const bad = [];
      document.querySelector('#nav button[data-t="machines"]').click();
      const d = JSON.parse(document.getElementById("reachData").textContent);
      const t = d.transitions.find(x => /ST-\\d{3}/.test(x.guardExpression||""));
      if (!t) return ["no transition guards on a state id"];
      showTransition(t.id);
      const w = document.querySelector("#machDetail .written");
      if (!w) return ["no reading in words for " + t.id];
      const text = w.textContent;
      if (/!=|&&|\\|\\|/.test(text)) bad.push(t.id + ": the reading still contains operators");
      const st = d.states.find(s => s.id === "ST-006");
      if (st && text.indexOf(st.name) < 0) bad.push(t.id + ": the decoded name is missing");
      return bad;
    })()`,
  },
  {
    name: "the selected transition is visually accented in the diagram",
    expr: `(() => {
      const bad = [];
      document.querySelector('#nav button[data-t="machines"]').click();
      const edges = [...document.querySelectorAll("#sm path.edge")];
      if (!edges.length) return ["no edges to select"];
      const e0 = edges[0];
      e0.dispatchEvent(new MouseEvent("click", {bubbles:true}));
      const sel = [...document.querySelectorAll("#sm path.edge.sel")];
      if (sel.length !== 1) return ["expected 1 accented edge, found " + sel.length];
      const halo = document.querySelectorAll("#sm path.edgehalo");
      if (halo.length !== 1) bad.push("the accented edge has no halo");
      const sa = getComputedStyle(sel[0]), sb = getComputedStyle(e0);
      if (sa.strokeWidth === sb.strokeWidth) bad.push("the accented edge is not thicker");
      const label = document.querySelector("#sm text.elabel.sel");
      if (!label) bad.push("the accented edge's label is not accented");
      /* The accent must not shrink with the diagram: a machine drawn small
         to fit its panel would otherwise lose the accent entirely. */
      if (sa.vectorEffect !== "non-scaling-stroke") bad.push("the accent scales with the diagram");
      const hs = halo.length ? getComputedStyle(halo[0]) : null;
      if (hs && hs.vectorEffect !== "non-scaling-stroke") bad.push("the halo scales with the diagram");
      if (hs && parseFloat(hs.opacity) < 0.2) bad.push("the halo is too faint to see");
      return bad;
    })()`,
  },
  {
    name: "selecting a state clears the selected transition, and the reverse",
    expr: `(() => {
      const bad = [];
      document.querySelector('#nav button[data-t="machines"]').click();
      const e0 = document.querySelector("#sm path.edge");
      e0.dispatchEvent(new MouseEvent("click", {bubbles:true}));
      if (!document.querySelector("#sm path.edge.sel")) return ["the edge did not stay selected"];
      const box = document.querySelector("#sm .nbox");
      box.dispatchEvent(new MouseEvent("click", {bubbles:true}));
      if (document.querySelector("#sm path.edge.sel")) bad.push("selecting a state left the edge accented");
      if (!document.querySelector("#sm .nbox.sel")) bad.push("selecting a state did not accent the box");
      return bad;
    })()`,
  },
  {
    name: "the whole diagram fits the panel without scrolling",
    expr: `(() => {
      const bad = [];
      document.querySelector('#nav button[data-t="machines"]').click();
      const svg = document.querySelector('#sm');
      const panel = svg.closest(".panel");
      if (!panel) return ["no panel"];
      const pr = panel.getBoundingClientRect();
      const r = svg.getBoundingClientRect();
      /* The diagram must not overflow its panel in either direction: a
         reader who has to scroll to find a state is reading it badly. */
      if (r.width > pr.width + 2) bad.push("the diagram is wider than its panel: " + Math.round(r.width) + " vs " + Math.round(pr.width));
      if (r.height > pr.height + 2) bad.push("the diagram is taller than its panel: " + Math.round(r.height) + " vs " + Math.round(pr.height));
      /* And the panel itself must not scroll. */
      if (panel.scrollHeight > panel.clientHeight + 2) bad.push("the diagram panel scrolls vertically");
      if (panel.scrollWidth > panel.clientWidth + 2) bad.push("the diagram panel scrolls horizontally");
      return bad;
    })()`,
  },
  {
    name: "clicking the empty canvas clears the selection",
    expr: `(() => {
      const bad = [];
      document.querySelector('#nav button[data-t="machines"]').click();
      const box = document.querySelector("#sm .nbox");
      box.dispatchEvent(new MouseEvent("click", {bubbles:true}));
      if (!document.querySelector("#sm .nbox.sel")) return ["the state was not selected"];
      const svg = document.querySelector("#sm");
      svg.dispatchEvent(new MouseEvent("click", {bubbles:true}));
      if (document.querySelector("#sm .nbox.sel")) bad.push("the state is still selected");
      if (document.querySelector("#sm path.edge.sel")) bad.push("a transition is still selected");
      return bad;
    })()`,
  },
  {
    name: "selecting a state dims the other states and the unrelated transitions",
    expr: `(() => {
      const bad = [];
      document.querySelector('#nav button[data-t="machines"]').click();
      const boxes = [...document.querySelectorAll("#sm .nbox")];
      if (boxes.length < 2) return ["not enough states"];
      boxes[0].dispatchEvent(new MouseEvent("click", {bubbles:true}));
      const dimmedStates = document.querySelectorAll("#sm .nbox.dim").length;
      const selStates = document.querySelectorAll("#sm .nbox.sel").length;
      if (selStates !== 1) bad.push("expected 1 selected state, found " + selStates);
      if (!dimmedStates) bad.push("the other states are not dimmed");

      /* Which edges touch the selected state is read from the GEOMETRY —
         from where each edge is actually drawn — not from the document.
         An edge that does not touch the selected state must be dimmed;
         one that does must not be. */
      const sel = document.querySelector("#sm .nbox.sel");
      const r = sel.querySelector("rect").getBBox();
      const touches = (p) => {
        const L = p.getTotalLength();
        const ends = [p.getPointAtLength(0), p.getPointAtLength(L)];
        return ends.some(pt =>
          pt.x >= r.x-2 && pt.x <= r.x+r.width+2 &&
          pt.y >= r.y-2 && pt.y <= r.y+r.height+2);
      };
      for (const p of document.querySelectorAll("#sm path.edge")) {
        const on = touches(p);
        const dim = p.classList.contains("dim");
        if (on && dim) bad.push(p.dataset.id + ": an edge of the selected state is dimmed");
        if (!on && !dim) bad.push(p.dataset.id + ": an edge that does not touch the selected state is not dimmed");
      }
      return bad;
    })()`,
  },
  {
    name: "the export carries the hierarchy, resolved",
    expr: `(() => {
      const bad = [];
      const d = JSON.parse(document.getElementById("reachData").textContent);
      if (!d.hierarchy) return ["the export has no hierarchy"];
      if (d.hierarchy.length !== d.machines.length) bad.push("the hierarchy does not cover every machine");
      for (const h of d.hierarchy) {
        if (!h.states || !h.states.length) bad.push(h.machine + ": no states");
        for (const s of (h.states||[])) {
          if (!Array.isArray(s.outgoing)) bad.push(s.id + ": no outgoing list");
          if (!Array.isArray(s.incoming)) bad.push(s.id + ": no incoming list");
        }
      }
      /* A transition that names several states must say so in the export,
         rather than leaving a consumer to parse the cell. */
      for (const t of d.transitions) {
        if (!Array.isArray(t.fromStates)) bad.push(t.id + ": fromStates is not a list");
        if (!Array.isArray(t.toStates)) bad.push(t.id + ": toStates is not a list");
      }
      /* The custody machine names its states in words, so its cells must
         resolve to ids in the export too. */
      const tr = d.transitions.find(x => x.machine === "SM-007");
      if (tr && (!tr.fromStates.length && !tr.toStates.length))
        bad.push("a custody transition resolved to no state at all");
      return bad;
    })()`,
  },
  {
    name: "the page reads the hierarchy rather than parsing the cells",
    expr: `(() => {
      const bad = [];
      /* The page must not reach into a raw cell to work out a state. If
         it did, the export's resolved lists would be pointless. */
      const d = JSON.parse(document.getElementById("reachData").textContent);
      const tr = d.transitions.find(x => x.id === "TR-006");
      if (!tr.fromStates || tr.fromStates.length < 2)
        return ["TR-006 does not carry its several source states"];
      /* And the page must agree with the export about which states the
         transition touches. */
      document.querySelector('#nav button[data-t="machines"]').click();
      curMachine = "SM-001"; drawMachine();
      const box = [...document.querySelectorAll("#sm .nbox")]
        .find(b => b.querySelector("text.sid").textContent.trim() === "ST-001");
      box.dispatchEvent(new MouseEvent("click", {bubbles:true}));
      const p = document.querySelector('#sm path.edge[data-id="TR-006"]');
      /* The edge is drawn from one of the five sources, so it is dimmed
         while the state is selected — but the hierarchy says the
         transition leaves ST-001, so the outgoing list must include it. */
      if (p && p.classList.contains("dim") && !document.querySelector('#sm path.edge.sel')) {
        /* fine: a drawn edge that does not touch the selection is dimmed */
      }
      document.querySelector('#machDetail [data-st="outgoing"]').click();
      const rows = [...document.querySelectorAll("#stateList tbody tr")]
        .map(r => r.cells[0].textContent.trim());
      if (!rows.includes("TR-006"))
        bad.push("the hierarchy's outgoing list for ST-001 does not include TR-006");
      return bad;
    })()`,
  },
  {
    name: "the reading in words sits above the formal expression",
    expr: `(() => {
      const bad = [];
      showTransition("TR-006");
      const dd = [...document.querySelectorAll("#machDetail dt")].map(d => d.textContent.trim());
      const iw = dd.indexOf("In words"), ge = dd.indexOf("Guard expr");
      if (iw < 0) return ["no 'In words' row"];
      if (ge < 0) return ["no 'Guard expr' row"];
      if (iw > ge) return ["'In words' is below 'Guard expr'"];
      return bad;
    })()`,
  },

  /* --------------------------------------------------------------- sorting */
  {
    name: "every table sorts under its own comparator",
    expr: `(() => {
      const bad = [];
      for (const id of ["tTrans","tInv","tReach","tFind","tOpen"]) {
        const tbl = document.getElementById(id);
        const th = [...tbl.tHead.rows[0].cells].find(c => c.dataset.k);
        if (!th) { bad.push(id + ": no sortable heading"); continue; }
        const before = [...tbl.tBodies[0].rows].map(r => r.cells[0].textContent).join(",");
        th.click();
        const after = [...tbl.tBodies[0].rows].map(r => r.cells[0].textContent).join(",");
        if (before === after) {
          // legitimate when the column is already in order; verify monotonicity
          const col = [...tbl.tHead.rows[0].cells].indexOf(th);
          const vals = [...tbl.tBodies[0].rows].map(r => (r.cells[col] ? r.cells[col].textContent : "").trim());
          const na = vals.map(v => parseFloat(v.replace(/[^0-9.\-]/g, "")));
          const numeric = vals.every(v => v === "" || !isNaN(na[vals.indexOf(v)]));
          if (numeric) {
            for (let i = 1; i < na.length; i++) if (na[i] < na[i-1]) { bad.push(id + ": not sorted"); break; }
          }
        }
        th.click();
      }
      return bad;
    })()`,
  },

  /* ----------------------------------------------------------- the layout */
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
    name: "the first view renders with no interaction",
    expr: `(() => {
      const s = document.querySelector('#t-machines');
      if (!s.classList.contains("active")) return ["the first view is not active"];
      if (s.textContent.trim().length < 40) return ["the first view is empty"];
      return true;
    })()`,
  },

  /* ------------------------------------------------- the numbers are real */
  {
    name: "the page's counts match the embedded export",
    expr: `(() => {
      const d = JSON.parse(document.getElementById("reachData").textContent);
      const bad = [];
      const t = document.querySelector('#hSub').textContent;
      const n = d.statesVisited.toLocaleString();
      if (t.indexOf(n) < 0) bad.push("header does not carry the state's count");
      if (document.getElementById("tTrans").tBodies[0].rows.length !== d.transitions.length)
        bad.push("transition count differs");
      return bad;
    })()`,
  },
  {
    name: "the probe verdicts are shown, not asserted",
    expr: `(() => {
      const d = JSON.parse(document.getElementById("reachData").textContent);
      const probed = d.probes.filter(p => p.status !== "NOT PROBED");
      const bad = [];
      for (const p of probed) {
        const row = [...document.querySelectorAll('#tFind tbody tr')]
          .find(r => r.cells[0].textContent.trim() === p.id);
        if (!row) { bad.push(p.id + ": no row"); continue; }
        if (row.textContent.indexOf(p.status === "REPRODUCED" ? "reproduced" : "not reproduced") < 0)
          bad.push(p.id + ": the verdict is not shown");
      }
      return bad;
    })()`,
  },

  /* ------------------------------------------------- ids become readable */
  {
    name: "the invariants tab links the ids it mentions and names them",
    expr: `(() => {
      const bad = [];
      const links = [...document.querySelectorAll('#tInv a.idlink')];
      if (!links.length) { bad.push("no id in the invariants tab is linked"); return bad; }
      for (const a of links) {
        const name = a.querySelector('.idname');
        const id = a.getAttribute('data-id');
        if (!name) { bad.push(id + ": the link has no name"); continue; }
        const shown = name.textContent.trim();
        if (!shown) bad.push(id + ": the link carries no name");
        /* The link reads as the thing; the code is in the hint. */
        if (shown.indexOf(id) === 0) bad.push(id + ": the link still leads with the code");
        const hint = a.getAttribute('title') || "";
        if (hint.indexOf(id) !== 0) bad.push(id + ": the hint does not carry the code");
      }
      return bad;
    })()`,
  },
  {
    name: "a named id in the invariants tab is shown in words",
    expr: `(() => {
      const d = JSON.parse(document.getElementById("reachData").textContent);
      const bad = [];
      /* Every catalogue entry must be reachable as a link, and the link
         must carry the entry's own name. */
      const names = {};
      (d.catalogue || []).forEach(e => { names[e.id] = e.name; });
      let checked = 0;
      for (const id of Object.keys(names)) {
        const a = document.querySelector('a.idlink[data-id="' + id + '"]');
        if (!a) continue;
        checked++;
        const shown = a.querySelector('.idname').textContent.trim();
        const want = String(names[id]).replace(/[*_]/g, "").replace(String.fromCharCode(96), "").trim();
        /* The link names the thing. It may be TRUNCATED — a long name is
           cut — so a prefix with an ellipsis is as good as the whole. */
        const truncated = shown.endsWith("…") &&
          want.indexOf(shown.slice(0, -1)) === 0;
        if (want && shown !== want && !truncated)
          bad.push(id + ": link says '" + shown + "', the document says '" + want + "'");
        /* A link may carry the id after the name, in its own element.
           The id in it must be THIS link's id - read from the link's own
           data, not parsed out of the text. */
        const code = a.querySelector('.idcode');
        if (code && code.textContent.trim() !== "(" + id + ")")
          bad.push(id + ": the link carries '" + code.textContent.trim() + "'");
      }
      if (checked < 10) bad.push("only " + checked + " catalogue ids are linked");
      return bad;
    })()`,
  },
  {
    name: "the catalogue tab holds every definition the document issues",
    expr: `(() => {
      const d = JSON.parse(document.getElementById("reachData").textContent);
      const bad = [];
      const rows = document.querySelectorAll('#tCat tbody tr').length;
      const want = (d.catalogue || []).length;
      if (rows !== want) bad.push("catalogue holds " + rows + " entries, the export has " + want);
      /* Every series the namespace names must have entries, and the count
         it states must be the count the catalogue holds. */
      const bySeries = {};
      (d.catalogue || []).forEach(e => { bySeries[e.series] = (bySeries[e.series] || 0) + 1; });
      for (const s of d.idSeries || []) {
        if (!bySeries[s.prefix]) bad.push(s.prefix + ": no entries");
        else if (bySeries[s.prefix] !== s.count)
          bad.push(s.prefix + ": the namespace says " + s.count +
            ", the catalogue holds " + bySeries[s.prefix]);
      }
      return bad;
    })()`,
  },
  {
    name: "the catalogue series filter narrows the table",
    expr: `(() => {
      const d = JSON.parse(document.getElementById("reachData").textContent);
      const bad = [];
      const radio = document.querySelector('#catToolbar input[name=catk][value=VO]');
      if (!radio) { bad.push("no series filter for VO"); return bad; }
      radio.checked = true; radio.dispatchEvent(new Event('change'));
      const rows = document.querySelectorAll('#tCat tbody tr').length;
      const want = (d.catalogue || []).filter(e => e.series === 'VO').length;
      if (rows !== want) bad.push("VO filter shows " + rows + " rows, the export has " + want);
      const all = document.querySelector('#catToolbar input[name=catk][value=""]');
      all.checked = true; all.dispatchEvent(new Event('change'));
      return bad;
    })()`,
  },
  {
    name: "an id link opens the tab that holds it",
    expr: `(() => {
      const bad = [];
      const a = document.querySelector('#tInv a.idlink[data-id]');
      if (!a) { bad.push("no id link in the invariants tab"); return bad; }
      const id = a.getAttribute('data-id');
      a.click();
      const visible = [...document.querySelectorAll('main>section')].filter(s => s.classList.contains('on'));
      if (visible.length !== 1) bad.push(visible.length + " sections are visible after a link click");
      const tab = visible[0].id.replace('t-', '');
      const nav = document.querySelector("#nav button.on");
      if (!nav || nav.dataset.t !== tab) bad.push("the nav button does not match the visible section");
      return bad;
    })()`,
  },
  {
    name: "a state id link selects that state in its machine",
    expr: `(() => {
      const bad = [];
      const a = document.querySelector('#tTrans a.idlink[data-id^="ST-"]')
             || document.querySelector('a.idlink[data-id^="ST-"]');
      if (!a) { bad.push("no state id is linked anywhere"); return bad; }
      const id = a.getAttribute('data-id');
      a.click();
      const vis = [...document.querySelectorAll('main>section')].filter(s => s.classList.contains('on'))[0];
      if (!vis || vis.id !== 't-machines') { bad.push("a state link did not open the machines tab"); return bad; }
      const sel = document.querySelector('#sm .nbox.sel');
      if (!sel) { bad.push("no node is selected"); return bad; }
      if (sel.textContent.indexOf(id) < 0) bad.push("the selected node is not " + id);
      return bad;
    })()`,
  },
  {
    name: "the catalogue detail shows the entry the reader picked",
    expr: `(() => {
      const bad = [];
      const row = document.querySelector('#tCat tbody tr');
      if (!row) { bad.push("the catalogue table is empty"); return bad; }
      row.click();
      const d = document.getElementById('catDetail').textContent;
      const id = row.cells[0].textContent.trim();
      if (d.indexOf(id) < 0) bad.push("the detail does not name " + id);
      if (d.trim().length < 40) bad.push("the detail is empty");
      return bad;
    })()`,
  },

  /* ------------------------------------------- switching machine clears it */
  {
    name: "switching machine clears the selection, so nothing is dimmed",
    expr: `(() => {
      const bad = [];
      const radios = [...document.querySelectorAll('#machToolbar input[data-mach]')];
      if (radios.length < 2) { bad.push("fewer than two machines"); return bad; }
      radios[0].checked = true; radios[0].dispatchEvent(new Event('change'));
      const node = [...document.querySelectorAll('#sm g.nbox')]
        .find(g => /ST-\\d+/.test(g.textContent));
      if (!node) { bad.push("no state node in the first machine"); return bad; }
      node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      if (!document.querySelector('#sm .nbox.sel')) {
        bad.push("clicking a node did not select it"); return bad;
      }
      radios[1].checked = true; radios[1].dispatchEvent(new Event('change'));
      if (document.querySelector('#sm .nbox.sel')) bad.push("the selection survived the machine change");
      const dim = document.querySelectorAll('#sm g.nbox.dim, #sm path.edge.dim').length;
      if (dim) bad.push(dim + " elements are dimmed in the new machine");
      return bad;
    })()`,
  },

  /* --------------------------------------------------- the open work tab */
  {
    name: "the open-work priority filter narrows the questions",
    expr: `(() => {
      const d = JSON.parse(document.getElementById("reachData").textContent);
      const bad = [];
      const radio = document.querySelector('#openToolbar input[name=opk][value="Critical"]');
      if (!radio) { bad.push("there is no Critical priority filter"); return bad; }
      radio.checked = true; radio.dispatchEvent(new Event('change'));
      const rows = document.querySelectorAll('#tOpen tbody tr').length;
      const want = d.questions.filter(q => q.priority === 'Critical').length;
      if (rows !== want) bad.push("Critical shows " + rows + " rows, the export has " + want);
      const all = document.querySelector('#openToolbar input[name=opk][value=""]');
      all.checked = true; all.dispatchEvent(new Event('change'));
      const back = document.querySelectorAll('#tOpen tbody tr').length;
      if (back !== d.questions.length)
        bad.push("All shows " + back + " rows, the export has " + d.questions.length);
      return bad;
    })()`,
  },
  {
    name: "the open question column is the widest in its table",
    expr: `(() => {
      const bad = [];
      const ths = [...document.querySelectorAll('#tOpen thead th')];
      if (ths.length < 2) { bad.push("the open-work table has no columns"); return bad; }
      const q = parseFloat(ths[1].style.width);
      if (isNaN(q)) { bad.push("the question column has no width"); return bad; }
      const others = ths.map(t => parseFloat(t.style.width)).filter(x => !isNaN(x));
      const max = Math.max(...others);
      if (q < max) bad.push("the question column is " + q + "%, the widest is " + max + "%");
      return bad;
    })()`,
  },

  /* ---------------------------------------------- the columns do not move */
  {
    name: "filtering a table does not change the width of its columns",
    expr: `(() => {
      const bad = [];
      /* A hidden table has no width, so the tab has to be open before
         anything can be measured. */
      document.querySelector("#nav button[data-t='invariants']").click();
      const widthsOf = id => [...document.getElementById(id).tHead.rows[0].cells]
        .map(c => Math.round(c.getBoundingClientRect().width));
      const before = widthsOf('tInv');
      if (!before.some(w => w > 0)) { bad.push("the table has no width to measure"); return bad; }
      const radio = document.querySelector('#invToolbar input[name=invk][value="violated"]');
      if (!radio) { bad.push("there is no violated filter"); return bad; }
      radio.checked = true; radio.dispatchEvent(new Event('change'));
      const after = widthsOf('tInv');
      for (let i = 0; i < before.length; i++) {
        if (before[i] !== after[i])
          bad.push("column " + (i + 1) + " went from " + before[i] + "px to " + after[i] + "px");
      }
      const all = document.querySelector('#invToolbar input[name=invk][value="all"]');
      all.checked = true; all.dispatchEvent(new Event('change'));
      return bad;
    })()`,
  },
  {
    name: "every table declares its column widths",
    expr: `(() => {
      const bad = [];
      const tables = [...document.querySelectorAll('table[id^="t"]')];
      if (!tables.length) { bad.push("no tables on the page"); return bad; }
      for (const t of tables) {
        const ths = [...t.tHead.rows[0].cells];
        const missing = ths.filter(th => !th.style.width).length;
        if (missing) bad.push(t.id + ": " + missing + " columns declare no width");
        if (t.style.tableLayout !== 'fixed')
          bad.push(t.id + ": the layout is not fixed, so the columns can move");
      }
      return bad;
    })()`,
  },
  {
    name: "the transitions table gives the evidence the least room",
    expr: `(() => {
      const bad = [];
      document.querySelector("#nav button[data-t='transitions']").click();
      const ths = [...document.querySelectorAll('#tTrans thead th')];
      const byLabel = l => ths.find(t => t.textContent.trim().toLowerCase() === l);
      const ev = byLabel('evidence'), ge = byLabel('guard expression');
      if (!ev || !ge) { bad.push("the columns are missing"); return bad; }
      const a = ev.getBoundingClientRect().width, b = ge.getBoundingClientRect().width;
      if (!a || !b) { bad.push("the table has no width to measure"); return bad; }
      if (a >= b)
        bad.push("evidence is " + Math.round(a) + "px, the guard expression is " + Math.round(b) + "px");
      /* And the evidence is not merely the smaller of the two - it is a
         narrow column, because the evidence is a section reference. */
      const table = document.getElementById("tTrans").getBoundingClientRect().width;
      if (table && a / table > 0.12)
        bad.push("evidence takes " + Math.round(a / table * 100) + "% of the table, which is not narrow");
      return bad;
    })()`,
  },
  {
    name: "the checked column's value fits inside its column",
    expr: `(() => {
      const bad = [];
      document.querySelector("#nav button[data-t='invariants']").click();
      const tbl = document.getElementById('tInv');
      const idx = [...tbl.tHead.rows[0].cells]
        .findIndex(t => t.textContent.trim().toLowerCase() === 'checked');
      if (idx < 0) { bad.push("there is no checked column"); return bad; }
      let seen = 0;
      for (const tr of tbl.tBodies[0].rows) {
        const td = tr.cells[idx];
        if (!td) continue;
        const pill = td.querySelector('.pill');
        if (!pill) continue;
        seen++;
        const pr = pill.getBoundingClientRect(), cr = td.getBoundingClientRect();
        if (pr.right > cr.right + 1)
          bad.push("'" + pill.textContent.trim() + "' runs " +
            Math.round(pr.right - cr.right) + "px past its column");
      }
      if (!seen) bad.push("there are no checked values to measure");
      return bad;
    })()`,
  },

  /* ------------------------------------------------- the glossary status */
  {
    name: "the glossary status says the status once, and keeps the note",
    expr: `(() => {
      const bad = [];
      document.querySelector("#nav button[data-t='glossary']").click();
      const d = JSON.parse(document.getElementById("reachData").textContent);
      const tbl = document.getElementById('tGlos');
      const idx = [...tbl.tHead.rows[0].cells]
        .findIndex(t => t.textContent.trim().toLowerCase() === 'status');
      if (idx < 0) { bad.push("there is no status column"); return bad; }
      const rows = [...tbl.tBodies[0].rows];
      for (const g of d.glossary) {
        const tr = rows.find(r => r.cells[4].textContent.trim() === g.id);
        if (!tr) { bad.push(g.id + ": no row"); continue; }
        const td = tr.cells[idx];
        const pills = td.querySelectorAll('.pill');
        if (pills.length !== 1) { bad.push(g.id + ": " + pills.length + " chips"); continue; }
        /* The chip carries the document's own word for the status. */
        const word = String(g.status).split("\\u2014")[0].replace(/[*_]/g, "").trim();
        if (pills[0].textContent.trim() !== word)
          bad.push(g.id + ": the chip says '" + pills[0].textContent.trim() +
            "', the document says '" + word + "'");
        /* And the status is not written twice. */
        const shown = td.textContent;
        if (word && shown.indexOf(word) !== shown.lastIndexOf(word))
          bad.push(g.id + ": the status is written twice");
      }
      return bad;
    })()`,
  },
  {
    name: "an id in a glossary status note is a link",
    expr: `(() => {
      const bad = [];
      document.querySelector("#nav button[data-t='glossary']").click();
      const d = JSON.parse(document.getElementById("reachData").textContent);
      const withNote = d.glossary.filter(g => (g.status || "").indexOf("\\u2014") >= 0);
      if (!withNote.length) { bad.push("no glossary status carries a note"); return bad; }
      let linked = 0, total = 0;
      for (const g of withNote) {
        const note = String(g.status).split("\\u2014").slice(1).join("\\u2014");
        const ids = note.match(/(?:SRC|TERM|ENT|VO|AGG|BC|CMD|EVT|POL|SM|ST|TR|INV|SCN|F|Q|N)-\\d{1,3}/g);
        if (!ids) continue;
        total += ids.length;
        for (const id of ids) {
          const a = document.querySelector('#tGlos a.idlink[data-id="' + id + '"]');
          if (a) linked++;
          else bad.push(g.id + ": " + id + " in the note is not a link");
        }
      }
      if (total && !linked) bad.push("no id in a status note is linked");
      return bad;
    })()`,
  },

  /* ------------------------------------------------- the coverage claims */
  {
    name: "the page does not claim more coverage than the engine had",
    expr: `(() => {
      const d = JSON.parse(document.getElementById("reachData").textContent);
      const bad = [];
      const header = document.querySelector('#hSub').textContent;

      /* If the exploration stopped at the cap, the page must not say it
         enumerated everything, and it must show the bound. */
      if (!d.frontierExhausted) {
        if (/exhausted/i.test(header) && !/not exhausted/i.test(header))
          bad.push("the header claims the frontier was exhausted");
        if (d.maxStates && header.indexOf(d.maxStates.toLocaleString()) < 0)
          bad.push("the header does not show the bound (" + d.maxStates + ")");
      }
      /* And the export must not contradict its own trace. */
      for (const t of d.trace || []) {
        if (t.indexOf("not exhausted") >= 0 && d.frontierExhausted)
          bad.push("the trace says the frontier was not exhausted, but the export says it was");
      }
      return bad;
    })()`,
  },
  {
    name: "the page shows the bound the counts were reached under",
    expr: `(() => {
      const d = JSON.parse(document.getElementById("reachData").textContent);
      const bad = [];
      document.querySelector("#nav button[data-t='reach']").click();
      const stats = document.querySelector('#reachStats');
      if (!stats) { bad.push("the reachability view has no stats"); return bad; }
      const t = stats.textContent;
      if (d.maxStates && t.indexOf(d.maxStates.toLocaleString()) < 0)
        bad.push("the stats do not show the bound (" + d.maxStates + ")");
      if (t.indexOf("exhausted") < 0) bad.push("the stats do not report the frontier");
      return bad;
    })()`,
  },
  {
    name: "no two edge labels overlap in the diagram",
    expr: `(() => {
      const bad = [];
      document.querySelector("#nav button[data-t='machines']").click();
      const labels = [...document.querySelectorAll('#sm text.elabel')].map(t => {
        const r = t.getBoundingClientRect();
        return { txt: t.textContent, x: r.x, y: r.y, w: r.width, h: r.height };
      });
      if (!labels.length) { bad.push("the diagram has no edge labels"); return bad; }
      for (let i = 0; i < labels.length; i++) {
        for (let j = i + 1; j < labels.length; j++) {
          const a = labels[i], b = labels[j];
          const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
          const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
          if (ox > 0.5 && oy > 0.5)
            bad.push(a.txt + " and " + b.txt + " overlap");
        }
      }
      return bad;
    })()`,
  },
  {
    name: "the diagram shows no raw markdown",
    expr: `(() => {
      const bad = [];
      document.querySelector("#nav button[data-t='machines']").click();
      for (const t of document.querySelectorAll('#sm text')) {
        const s = t.textContent || "";
        if (s.indexOf("**") >= 0 || s.indexOf("__") >= 0)
          bad.push("a label shows raw markdown: " + s.slice(0, 40));
      }
      return bad;
    })()`,
  },

  /* ------------------------------------------- the state detail panel */
  {
    name: "the incoming and outgoing lists have the same column widths",
    expr: `(() => {
      const bad = [];
      document.querySelector("#nav button[data-t='machines']").click();
      const node = [...document.querySelectorAll('#sm g.nbox')]
        .find(g => /ST-\\d+/.test(g.textContent));
      if (!node) { bad.push("no state node to open"); return bad; }
      node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const widths = () => [...document.querySelectorAll('#tStateList thead th')]
        .map(t => Math.round(t.getBoundingClientRect().width));
      const incoming = widths();
      if (!incoming.length) { bad.push("the incoming list has no table"); return bad; }
      const out = document.querySelector('#machDetail [data-st="outgoing"]');
      if (!out) { bad.push("no outgoing tab"); return bad; }
      out.click();
      const outgoing = widths();
      for (let i = 0; i < incoming.length; i++) {
        if (incoming[i] !== outgoing[i])
          bad.push("column " + (i + 1) + ": " + incoming[i] + "px incoming, " + outgoing[i] + "px outgoing");
      }
      return bad;
    })()`,
  },
  {
    name: "the state's transitions are named by their trigger, and the guard is read",
    expr: `(() => {
      const bad = [];
      document.querySelector("#nav button[data-t='machines']").click();
      const node = [...document.querySelectorAll('#sm g.nbox')]
        .find(g => /ST-\\d+/.test(g.textContent));
      if (!node) { bad.push("no state node to open"); return bad; }
      node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const rows = [...document.querySelectorAll('#tStateList tbody tr')];
      if (!rows.length) { bad.push("the state has no transitions"); return bad; }
      for (const tr of rows) {
        const cells = tr.cells;
        /* The trigger is the NAME and it is the link; the id is the
           handle, and it travels in the hint. */
        const a = cells[1].querySelector('a[data-tr]');
        if (!a) { bad.push(cells[0].textContent.trim() + ": the trigger is not a link"); continue; }
        const hint = a.getAttribute('title') || "";
        if (hint.indexOf(cells[0].textContent.trim()) !== 0)
          bad.push(cells[0].textContent.trim() + ": the hint does not carry the id");
        if (a.textContent.trim().indexOf(cells[0].textContent.trim()) === 0)
          bad.push(cells[0].textContent.trim() + ": the link still leads with the code");
        /* The guard is read, not shown as an expression. */
        const guard = cells[3];
        if (guard.textContent.indexOf("<b>") >= 0 || guard.textContent.indexOf("&&") >= 0)
          bad.push(cells[0].textContent.trim() + ": the guard is not read");
        if (!guard.querySelector(".written") && !guard.querySelector(".mono"))
          bad.push(cells[0].textContent.trim() + ": the guard cell is empty");
      }
      return bad;
    })()`,
  },
  {
    name: "the invariants a state lists are links",
    expr: `(() => {
      const bad = [];
      document.querySelector("#nav button[data-t='machines']").click();
      /* The machine on screen may not be one whose states name
         invariants, so the check selects the one that does. */
      const d = JSON.parse(document.getElementById("reachData").textContent);
      const withInv = d.states.find(s => String(s.invariants||"").trim());
      if (!withInv) { bad.push("no state in the document names an invariant"); return bad; }
      const chip = document.querySelector('#machToolbar input[data-mach="' + withInv.machine + '"]');
      if (!chip) { bad.push("no chip for " + withInv.machine); return bad; }
      chip.checked = true; chip.dispatchEvent(new Event('change', {bubbles:true}));
      const node = [...document.querySelectorAll('#sm g.nbox')]
        .find(g => g.textContent.indexOf(withInv.id) >= 0);
      if (!node) { bad.push("no node for " + withInv.id); return bad; }
      node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const tab = [...document.querySelectorAll('#machDetail [data-st]')]
        .find(b => b.dataset.st === 'invariants');
      if (!tab) { bad.push("there is no invariants tab"); return bad; }
      tab.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const tbl = document.getElementById('tStateInv');
      if (!tbl) { bad.push("the invariants tab has no table"); return bad; }
      const ids = [...tbl.querySelectorAll('tbody tr')]
        .map(tr => (tr.cells[0] ? tr.cells[0].textContent.trim() : ""));
      if (!ids.length) { bad.push("the table has no rows"); return bad; }
      for (const id of ids) {
        if (!/^INV-/.test(id)) { bad.push("a row does not name an invariant: " + id); continue; }
        const row = [...tbl.querySelectorAll('tbody tr')]
          .find(tr => tr.cells[0].textContent.trim() === id);
        if (!row.querySelector('a.idlink[data-id="' + id + '"]'))
          bad.push(id + " is named but is not a link");
      }
      return bad;
    })()`,
  },

  /* ------------------------------------- how a machine came to be */
  {
    name: "every machine's radio chip says how it was arrived at",
    expr: `(() => {
      const d = JSON.parse(document.getElementById("reachData").textContent);
      const bad = [];
      const chips = [...document.querySelectorAll('#machToolbar .chip')];
      if (!chips.length) { bad.push("no machine chips"); return bad; }
      for (const m of d.machines) {
        const chip = chips.find(c => c.querySelector('.mcode')
          && c.querySelector('.mcode').textContent.trim() === m.id);
        if (!chip) { bad.push(m.id + ": no chip"); continue; }
        const badge = chip.querySelector('.cls .pill');
        if (!badge) { bad.push(m.id + ": the chip carries no classification"); continue; }
        if (badge.textContent.trim().toLowerCase() !== String(m.classification).trim().toLowerCase())
          bad.push(m.id + ": the chip says '" + badge.textContent.trim() +
            "', the document says '" + m.classification + "'");
      }
      return bad;
    })()`,
  },
  {
    name: "the machine detail says its classification and the reason apart",
    expr: `(() => {
      const bad = [];
      document.querySelector("#nav button[data-t='machines']").click();
      /* A state may still be selected from an earlier check, and then the
         detail shows the state rather than the machine. */
      const back = document.querySelector('#backToMachine');
      if (back) back.click();
      const d = JSON.parse(document.getElementById("reachData").textContent);
      const line = document.querySelector('#machDetail .clsline');
      if (!line) { bad.push("the detail has no classification line"); return bad; }
      const pill = line.querySelector('.pill');
      const checked = document.querySelector('#machToolbar input[name=mach]:checked');
      const m = d.machines.find(x => x.id === (checked ? checked.value : ""));
      if (!pill) { bad.push("the classification line has no chip"); return bad; }
      if (!m) { bad.push("no machine is selected"); return bad; }
      if (pill.textContent.trim().toLowerCase() !== String(m.classification).trim().toLowerCase())
        bad.push("the chip says '" + pill.textContent.trim() +
          "', the document says '" + m.classification + "'");
      /* The reason is its own row, not folded into the status. */
      const dts = [...document.querySelectorAll('#machDetail dt')];
      const why = dts.find(x => x.textContent.trim().toLowerCase() === 'why');
      if (!why) { bad.push("the detail has no 'why' row"); return bad; }
      const reason = why.nextElementSibling.textContent.trim();
      if (m.classificationReason && reason.length < 10)
        bad.push("the reason is empty: " + m.classificationReason);
      return bad;
    })()`,
  },
  {
    name: "an explicit machine and an implicit machine look different",
    expr: `(() => {
      const bad = [];
      const d = JSON.parse(document.getElementById("reachData").textContent);
      const chips = [...document.querySelectorAll('#machToolbar .chip')];
      const badgeOf = id => {
        const chip = chips.find(c => c.querySelector('.mcode')
          && c.querySelector('.mcode').textContent.trim() === id);
        return chip ? chip.querySelector('.cls .pill') : null;
      };
      const tone = id => { const b = badgeOf(id); return b ? b.className.replace('pill', '').trim() : ''; };
      const explicit = d.machines.find(m => /explicit/i.test(m.classification)
        && !/partially|not explicit/i.test(m.classification));
      const implicit = d.machines.find(m => /implicit/i.test(m.classification));
      if (!explicit) { bad.push("no explicit machine to compare"); return bad; }
      if (!implicit) { bad.push("no implicit machine to compare"); return bad; }
      const a = tone(explicit.id), b = tone(implicit.id);
      if (!a || !b) { bad.push("a machine carries no classification tone"); return bad; }
      if (a === b) bad.push("explicit and implicit look the same (" + a + ")");
      return bad;
    })()`,
  },
  {
    name: "a guard with no condition reads as no condition, not as 'Yes'",
    expr: `(() => {
      const bad = [];
      const BT = String.fromCharCode(96);        /* the document writes expressions in inline code */
      const d = JSON.parse(document.getElementById("reachData").textContent);
      const bare = d.transitions.filter(t => (t.guardExpression||"").trim() === BT + "true" + BT);
      if (!bare.length) { bad.push("no constant-true guard to read"); return bad; }
      for (const t of bare) {
        const words = decypher(t.guardExpression);
        if (words !== "always true")
          bad.push(t.id + ": reads '" + words + "', expected 'always true'");
      }
      /* And the page must not have learned to answer in booleans. */
      const yes = String(decypher(BT + "true" + BT)).toLowerCase();
      if (yes === "yes" || yes === "no")
        bad.push("a constant guard reads as the answer '" + yes + "'");
      return bad;
    })()`,
  },
  {
    name: "a state's invariants are a tab beside Incoming and Outgoing",
    expr: `(() => {
      const bad = [];
      document.querySelector("#nav button[data-t='machines']").click();
      /* The machine on screen may not be one whose states name
         invariants, so the check selects the one that does. */
      const d = JSON.parse(document.getElementById("reachData").textContent);
      const withInv = d.states.find(s => String(s.invariants||"").trim());
      if (!withInv) { bad.push("no state in the document names an invariant"); return bad; }
      const chip = document.querySelector('#machToolbar input[data-mach="' + withInv.machine + '"]');
      if (!chip) { bad.push("no chip for " + withInv.machine); return bad; }
      chip.checked = true; chip.dispatchEvent(new Event('change', {bubbles:true}));
      const node = [...document.querySelectorAll('#sm g.nbox')]
        .find(g => g.textContent.indexOf(withInv.id) >= 0);
      if (!node) { bad.push("no node for " + withInv.id); return bad; }
      node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const tabs = [...document.querySelectorAll('#machDetail [data-st]')];
      const names = tabs.map(b => b.dataset.st);
      if (names.indexOf('invariants') < 0) { bad.push("no invariants tab"); return bad; }
      if (names.indexOf('incoming') < 0) bad.push("no incoming tab");
      if (names.indexOf('outgoing') < 0) bad.push("no outgoing tab");
      const tab = tabs.find(b => b.dataset.st === 'invariants');
      if (!/\\d/.test(tab.textContent)) bad.push("the tab carries no count");
      tab.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const rows = document.querySelectorAll('#tStateInv tbody tr').length;
      const said = Number((tab.textContent.match(/\\((\\d+)\\)/) || [])[1]);
      if (said !== rows)
        bad.push("the tab says " + said + " and the table shows " + rows);
      return bad;
    })()`,
  },
  {
    name: "the transitions tab's machine chips look like the state machines tab's",
    expr: `(() => {
      const bad = [];
      document.querySelector("#nav button[data-t='machines']").click();
      const machChips = [...document.querySelectorAll('#machToolbar .chip')];
      document.querySelector("#nav button[data-t='transitions']").click();
      const transChips = [...document.querySelectorAll('#transToolbar .chip')];
      if (!machChips.length) { bad.push("no chips on the machines tab"); return bad; }
      if (!transChips.length) { bad.push("no chips on the transitions tab"); return bad; }
      const withBadge = machChips.filter(c => c.querySelector('.cls .pill')).length;
      if (withBadge < machChips.length)
        bad.push("the machines tab has " + (machChips.length - withBadge) + " chip(s) without a badge");
      const mine = transChips.filter(c => c.querySelector('input') && c.querySelector('input').value);
      for (const c of mine) {
        if (!c.querySelector('.cls .pill')) {
          bad.push("a transitions chip carries no classification: " + c.textContent.trim());
          continue;
        }
        if (!c.querySelector('.mtitle')) bad.push("a transitions chip carries no title");
        if (!c.querySelector('.mcode')) bad.push("a transitions chip carries no id");
      }
      return bad;
    })()`,
  },
  {
    name: "an invariant's expression reads in words, with the source on hover",
    expr: `(() => {
      const bad = [];
      document.querySelector("#nav button[data-t='invariants']").click();
      const d = JSON.parse(document.getElementById("reachData").textContent);
      const tbl = document.getElementById("tInv");
      if (!tbl) { bad.push("no invariants table"); return bad; }
      const headers = [...tbl.querySelectorAll('thead th')].map(h => h.textContent.trim());
      if (headers.indexOf("In words") < 0)
        bad.push("the column is not named 'In words': " + headers.join(", "));
      if (headers.indexOf("Formal expression") >= 0)
        bad.push("the old column name is still there");
      const read = d.invariants.filter(i => i.checkable && decypher(i.expression));
      if (!read.length) { bad.push("no invariant has a readable expression"); return bad; }
      for (const inv of read.slice(0, 8)) {
        const row = [...tbl.querySelectorAll('tbody tr')]
          .find(tr => tr.textContent.trim().indexOf(inv.id) === 0);
        if (!row) { bad.push(inv.id + " is not in the table"); continue; }
        const cell = row.querySelector('.written');
        if (!cell) { bad.push(inv.id + " does not read in words"); continue; }
        if (cell.textContent.trim() === inv.expression.trim())
          bad.push(inv.id + " shows the expression itself, not the reading");
        if ((cell.getAttribute('title') || '').trim() !== inv.expression.trim())
          bad.push(inv.id + ": the hint does not carry the source expression");
      }
      return bad;
    })()`,
  },
  {
    name: "an invariant's scope names the states it holds in and the transitions it guards",
    expr: `(() => {
      const bad = [];
      const d = JSON.parse(document.getElementById("reachData").textContent);
      /* The scope is the ids it names - nothing else. A consumer lists
         them; it never has to read the cell to know which kind of scope
         this is, because the cell is not shipped at all. */
      for (const inv of d.invariants) {
        const a = inv.appliesTo;
        if (!a) { bad.push(inv.id + " has no scope"); continue; }
        if (!Array.isArray(a.states)) bad.push(inv.id + ": states is not a list");
        if (!Array.isArray(a.transitions)) bad.push(inv.id + ": transitions is not a list");
        if ("kind" in a) bad.push(inv.id + ": the scope still carries a kind");
        if ("raw" in a) bad.push(inv.id + ": the scope still carries the document's cell");
        for (const id of a.states)
          if (!d.states.some(s => s.id === id)) bad.push(inv.id + ": " + id + " is not a state");
        for (const id of a.transitions)
          if (!d.transitions.some(t => t.id === id)) bad.push(inv.id + ": " + id + " is not a transition");
      }
      /* The page renders the cell from those lists: the states first, then
         the transitions. The names it shows are the export's own. */
      document.querySelector("#nav button[data-t='invariants']").click();
      const tbl = document.getElementById("tInv");
      if (!tbl) { bad.push("no invariants table"); return bad; }
      const headers = [...tbl.querySelectorAll('thead th')].map(h => h.textContent.trim());
      if (headers.indexOf("Holds in") < 0)
        bad.push("the scope column is not 'Holds in': " + headers.join(", "));
      const rowOf = id => [...tbl.querySelectorAll('tbody tr')]
        .find(r => r.textContent.trim().indexOf(id) === 0);
      const cellOf = id => {
        const row = rowOf(id);
        return row ? row.querySelectorAll("td")[3] : null;
      };
      const st = d.invariants.find(i => i.appliesTo.states.length && !i.appliesTo.transitions.length);
      if (st) {
        const c = cellOf(st.id);
        if (!c) bad.push(st.id + " is not in the table");
        else for (const id of st.appliesTo.states) {
          const label = IDX[id] ? IDX[id].name : id;
          if (c.textContent.indexOf(label) < 0) bad.push(st.id + ": the cell does not name " + label);
        }
      }
      const tr = d.invariants.find(i => i.appliesTo.transitions.length);
      if (tr) {
        const c = cellOf(tr.id);
        if (!c) bad.push(tr.id + " is not in the table");
        else for (const id of tr.appliesTo.transitions) {
          const label = IDX[id] ? IDX[id].name : id;
          if (c.textContent.indexOf(label) < 0) bad.push(tr.id + ": the cell does not name " + label);
        }
      }
      return bad;
    })()`,
  },
  {
    name: "a reference is drawn as a chip: type, name, id",
    expr: `(() => {
      const bad = [];
      const d = JSON.parse(document.getElementById("reachData").textContent);
      const stateId = d.states[0].id;
      /* The chip is built from the DATA: the mark comes from the series,
         the name from the index, the id from the data. Nothing is read
         back out of the rendered text. */
      const one = document.createElement("div");
      one.innerHTML = chip(stateId, "ST");
      const a = one.querySelector("a.chip");
      if (!a) { bad.push("the chip is not a chip"); return bad; }
      if (a.getAttribute("data-id") !== stateId) bad.push("the chip does not carry the id");
      const icon = a.querySelector(".chip__icon");
      if (!icon || icon.textContent !== KINDS.ST.glyph) bad.push("the icon is not the type's mark");
      const name = a.querySelector(".chip__name");
      if (!name || name.textContent !== IDX[stateId].name) bad.push("the name is not the thing's name");
      const code = a.querySelector(".chip__code");
      if (!code || code.textContent !== stateId) bad.push("the code is not the id");
      /* A chip carries the id whatever it is - the reader must never
         have to go looking for which thing is meant. */
      const q = document.createElement("div");
      q.innerHTML = chip(d.questions[0].id, "Q");
      const qc = q.querySelector(".chip__code");
      if (!qc || qc.textContent !== d.questions[0].id)
        bad.push("the question's chip does not carry its id");
      /* There is only ONE chip: the quiet variant is gone, because the
         same transition must not look like two different things in two
         tabs. Every chip is the same rectangle, and carries its id. */
      const quiet = document.createElement("div");
      quiet.innerHTML = chip(stateId, "ST");
      if (!quiet.querySelector(".chip__code")) bad.push("the chip lost the code");
      if (quiet.querySelector(".chip--quiet")) bad.push("there is a second kind of chip");
      /* And the table cell is made of them. */
      document.querySelector("#nav button[data-t='invariants']").click();
      const tbl = document.getElementById("tInv");
      const inv = d.invariants.find(i => i.appliesTo.states.length);
      const row = [...tbl.querySelectorAll("tbody tr")]
        .find(r => r.textContent.trim().indexOf(inv.id) === 0);
      const cell = row.querySelectorAll("td")[3];
      const chips = cell.querySelectorAll("a.chip");
      if (!chips.length) { bad.push("the scope cell holds no chips"); return bad; }
      for (const id of inv.appliesTo.states) {
        const ch = [...chips].find(c => c.getAttribute("data-id") === id);
        if (!ch) { bad.push(inv.id + ": " + id + " is not a chip"); continue; }
        if (ch.querySelector(".chip__icon").textContent !== KINDS.ST.glyph)
          bad.push(inv.id + ": " + id + " is not drawn as a state");
      }
      /* The legend reads the SAME table the chips are drawn from - a
         legend with its own list of the facts is a second truth. */
      const rows = legendRows();
      if (rows.length !== Object.keys(KINDS).length)
        bad.push("the legend does not cover every series");
      for (const r of rows)
        if (r.glyph !== KINDS[r.prefix].glyph || r.family !== KINDS[r.prefix].family)
          bad.push("the legend disagrees with the table about " + r.prefix);
      return bad;
    })()`,
  },
  {
    name: "the scope column is drawn as chips, where the cell names a concept",
    expr: `(() => {
      const bad = [];
      const d = JSON.parse(document.getElementById("reachData").textContent);
      document.querySelector("#nav button[data-t='invariants']").click();
      const tbl = document.getElementById("tInv");
      const rowOf = id => [...tbl.querySelectorAll('tbody tr')]
        .find(r => r.textContent.trim().indexOf(id) === 0);
      for (const inv of d.invariants.slice(0, 10)) {
        const row = rowOf(inv.id);
        if (!row) { bad.push(inv.id + " is not in the table"); continue; }
        const cell = row.querySelectorAll("td")[2];
        const named = inv.scope.filter(p => p.id);
        const chips = [...cell.querySelectorAll('a.chip')];
        if (chips.length !== named.length) {
          bad.push(inv.id + ": the scope cell holds " + chips.length +
                  " chips, the cell names " + named.length);
          continue;
        }
        /* Each name is a chip, drawn as the kind it is. */
        for (const p of named) {
          const ch = chips.find(c => c.getAttribute('data-id') === p.id);
          if (!ch) { bad.push(inv.id + ": " + p.id + " is not a chip"); continue; }
          const icon = ch.querySelector('.chip__icon');
          if (!icon || icon.textContent !== KINDS[p.prefix].glyph)
            bad.push(inv.id + ": " + p.id + " is not drawn as a " + p.prefix);
          if (!d.catalogue.some(e => e.id === p.id))
            bad.push(inv.id + ": " + p.id + " is not a name the document issues");
          /* The id is not said twice: here it rides in the hint. */
          if (ch.querySelector('.chip__code'))
            bad.push(inv.id + ": " + p.id + " says its id twice");
          if ((ch.getAttribute('title') || '').indexOf(p.id) !== 0)
            bad.push(inv.id + ": " + p.id + " has no id in its hint");
        }
      }
      return bad;
    })()`,
  },
  {
    name: "a chip that runs out of room shortens its name, and says the whole thing in its hint",
    expr: `(() => {
      const bad = [];
      document.querySelector("#nav button[data-t='invariants']").click();
      for (const c of document.querySelectorAll('a.chip')) {
        const name = c.querySelector('.chip__name');
        if (!name) { bad.push("a chip has no name"); continue; }
        const w = c.getBoundingClientRect().width;
        if (w > 150.5) bad.push("a chip is " + Math.round(w) + "px wide");
        if (name.scrollWidth > name.clientWidth + 1) {
          /* It gave way - so the whole text must be in the hint. */
          const hint = c.getAttribute('title') || "";
          if (hint.indexOf(name.textContent) < 0)
            bad.push("a shortened chip does not say its whole text in the hint");
          const code = c.querySelector('.chip__code');
          if (code && code.getBoundingClientRect().width < 1)
            bad.push("a shortened chip lost its id");
          const icon = c.querySelector('.chip__icon');
          if (icon && icon.getBoundingClientRect().width < 1)
            bad.push("a shortened chip lost its mark");
        }
      }
      return bad;
    })()`,
  },
  {
    name: "a transition's trigger is drawn as the commands it names",
    expr: `(() => {
      const bad = [];
      const d = JSON.parse(document.getElementById("reachData").textContent);
      /* The trigger cell is prose; the COMMANDS it names are commands,
         and the page draws them as commands. */
      const withCmd = d.transitions.filter(t => (t.commands||[]).length);
      const without = d.transitions.filter(t => !(t.commands||[]).length);
      if (!withCmd.length) { bad.push("no transition names a command"); return bad; }
      if (!without.length) bad.push("every transition names a command - some are fired by an event");
      document.querySelector("#nav button[data-t='transitions']").click();
      const tbl = [...document.querySelectorAll('table')].find(t => t.id === 'tTrans')
               || [...document.querySelectorAll('table')].find(t => /trans/i.test(t.id));
      if (!tbl) { bad.push("no transitions table"); return bad; }
      const rowOf = id => [...tbl.querySelectorAll('tbody tr')]
        .find(r => r.textContent.trim().indexOf(id) === 0);
      for (const t of withCmd.slice(0, 6)) {
        const row = rowOf(t.id);
        if (!row) { bad.push(t.id + " is not in the table"); continue; }
        const cell = row.querySelectorAll("td")[2];
        const chips = [...cell.querySelectorAll('a.chip')];
        if (!chips.length) { bad.push(t.id + ": the trigger holds no chip"); continue; }
        /* Each chip names the command, and the command's own mark. */
        for (const id of t.commands) {
          const ch = chips.find(c => c.getAttribute('data-id') === id);
          if (!ch) { bad.push(t.id + ": " + id + " is not drawn as a chip"); continue; }
          const icon = ch.querySelector('.chip__icon');
          if (!icon || icon.textContent !== KINDS.CMD.glyph)
            bad.push(t.id + ": " + id + " is not drawn as a command");
          if (!d.catalogue.some(e => e.id === id))
            bad.push(t.id + ": " + id + " is not a command the document issues");
        }
      }
      /* A trigger that names no command keeps the document's words. */
      const w = without[0];
      if (w) {
        const row = rowOf(w.id);
        if (!row) bad.push(w.id + " is not in the table");
        else {
          const cell = row.querySelectorAll("td")[2];
          if (cell.querySelector('a.chip')) bad.push(w.id + ": a trigger with no command was drawn as a chip");
          else if (!cell.textContent.trim()) bad.push(w.id + ": the trigger cell is empty");
        }
      }
      return bad;
    })()`,
  },
  {
    name: "the specification is navigable by section, and its references are chips",
    expr: `(() => {
      const bad = [];
      const d = JSON.parse(document.getElementById("reachData").textContent);
      if (!d.spec || !d.spec.length) { bad.push("the export carries no paragraphs"); return bad; }
      const src = d.sourceSpec;
      if (!src) { bad.push("the export carries no source specification"); return bad; }
      /* Every section of the source, and every paragraph under it. */
      const sections = [], paragraphIds = [];
      (function walk(node){
        sections.push(node.id);
        (node.paragraphs||[]).forEach(p => paragraphIds.push(p.id));
        (node.sections||[]).forEach(walk);
      })(src);
      /* Every reference the document makes is resolved to something
         that EXISTS - the page must never link to nothing. A reference
         inside the analysis names one of the analysis's own paragraphs;
         a citation names a section of the source. */
      const analysis = (d.spec||[]).map(p => p.id);
      for (const p of d.spec)
        for (const r of (p.refs||[]))
          if (!sections.includes(r.id) && !analysis.includes(r.id))
            bad.push(p.id + " refers to " + r.id + ", which is neither a section nor a paragraph");
      /* The tab draws them. */
      const tab = [...document.querySelectorAll('#nav button')].find(b => b.dataset.t === 'spec');
      if (!tab) { bad.push("there is no specification tab"); return bad; }
      tab.click();
      const outline = document.getElementById('specOutline');
      const body = document.getElementById('specBody');
      if (!outline || !body) { bad.push("the specification tab has no outline or body"); return bad; }
      const items = outline.querySelectorAll('.specitem');
      if (items.length < 5) bad.push("the outline holds " + items.length + " sections");
      /* Every section the outline names is on the page, by its id. */
      const drawn = [...body.querySelectorAll('.specp')].map(p => p.id);
      for (const item of outline.querySelectorAll('.specitem')) {
        const id = item.getAttribute('data-spec');
        if (!id) { bad.push("an outline entry names no section"); break; }
        if (!drawn.includes(id)) { bad.push("the outline names " + id + ", which is not on the page"); break; }
      }
      /* The outline is the document's STRUCTURE: a subsection is under
         its parent, not beside it. */
      const levels = {};
      (function walk(node, depth){
        (node.sections||[]).forEach(s => { levels[s.id] = depth + 1; walk(s, depth + 1); });
      })(src, 0);
      for (const item of outline.querySelectorAll('.specitem')) {
        const id = item.getAttribute('data-spec');
        const want = levels[id];
        if (want === undefined) continue;
        const pad = parseInt(item.style.paddingLeft || "0", 10);
        if (pad !== 6 + (want - 1) * 12) { bad.push("the outline does not nest " + id); break; }
      }
      return bad;
    })()`,
  },
  {
    name: "the source specification is a tree, under its own addresses",
    expr: `(() => {
      const bad = [];
      const d = JSON.parse(document.getElementById("reachData").textContent);
      const src = d.sourceSpec;
      if (!src) { bad.push("the export carries no source specification"); return bad; }
      /* The document's own address: the source id the analysis gave it. */
      if (!src.id || src.id.indexOf("/") >= 0) bad.push("the source has no address of its own: " + src.id);
      if (!src.title) bad.push("the source has no title");
      /* A section's address is the source id and its number path. */
      const sections = [];
      (function walk(node, parent){
        (node.sections||[]).forEach(s => {
          sections.push(s);
          if (s.number && s.id !== src.id + "/" + s.number)
            bad.push("the section " + s.number + " is addressed " + s.id);
          if (!s.number && s.id.indexOf("/u") < 0)
            bad.push("the unnumbered section " + s.id + " has no address of its own");
          walk(s, s.id);
        });
      })(src, src.id);
      if (!sections.length) bad.push("the source has no sections");
      /* The analysis's own paragraphs keep their own ids. */
      const analysis = (d.spec||[]).map(p => p.id);
      for (const s of sections)
        if (analysis.indexOf(s.id) >= 0) { bad.push("the source and the analysis share the address " + s.id); break; }
      return bad;
    })()`,
  },
  {
    name: "every evidence citation is cut, and every cut part names a section that exists",
    expr: `(() => {
      const bad = [];
      const d = JSON.parse(document.getElementById("reachData").textContent);
      const src = d.sourceSpec;
      if (!src) { bad.push("the export carries no source specification"); return bad; }
      const sections = [];
      (function walk(node){ sections.push(node.id); (node.sections||[]).forEach(walk); })(src);
      /* Every evidence field, wherever the export carries one. */
      const fields = [];
      const push = (where, value) => { if (value !== undefined) fields.push([where, value]); };
      const each = (where, list, keys) => (list||[]).forEach((row, i) => {
        for (const k of keys) push(where + "[" + i + "]." + k, row[k]);
      });
      each("transitions", d.transitions, ["evidence"]);
      each("invariants", d.invariants, ["evidence"]);
      each("findings", d.findings, ["evidence"]);
      each("violations", d.violations, ["evidence"]);
      each("couplings", d.couplings, ["evidence"]);
      each("glossary", d.glossary, ["evidence"]);
      each("commands", d.commands, ["evidence"]);
      each("events", d.events, ["evidence"]);
      each("policies", d.policies, ["evidence"]);
      each("entities", d.entities, ["evidence"]);
      each("valueObjects", d.valueObjects, ["evidence"]);
      each("states", d.states, ["source"]);
      each("roles", d.roles, ["source"]);
      each("contexts", d.contexts, ["evidenceFor", "evidenceAgainst"]);
      each("catalogue", d.catalogue, ["evidence"]);
      each("catalogueStates", d.catalogueStates, ["evidence"]);
      each("catalogueTransitions", d.catalogueTransitions, ["evidence"]);
      each("catalogueInvariants", d.catalogueInvariants, ["evidence"]);
      each("catalogueFindings", d.catalogueFindings, ["evidence"]);
      each("catalogueAggregates", d.catalogueAggregates, ["evidence"]);
      each("catalogueScenarios", d.catalogueScenarios, ["evidence"]);
      each("catalogueNamedRules", d.catalogueNamedRules, ["evidence"]);
      each("catalogueAspects", (d.catalogueAggregates||[]).map(a => (a.aspects||[])[0]), ["evidence"]);
      if (!fields.length) { bad.push("the export carries no evidence fields"); return bad; }
      let cut = 0;
      for (const [where, value] of fields) {
        if (!Array.isArray(value)) { bad.push(where + " is not cut"); continue; }
        cut++;
        for (const part of value) {
          if (part.id) {
            /* The evidence is grounded in the source: a citation names
               a SECTION of the source specification, and nothing else. */
            if (sections.indexOf(part.id) < 0) {
              bad.push(where + " names " + part.id + ", which is not a section of the source");
              break;
            }
            if (!part.label) { bad.push(where + " names " + part.id + " without saying what it says"); break; }
          } else if (part.text && part.text.indexOf("§") >= 0) {
            /* A section number left in the words is one the exporter
               could not resolve - which it may only be if the SOURCE
               has no such section. */
            const m = part.text.match(/§(\\d+(?:\\.\\d+)*)/);
            if (m) {
              const n = m[1];
              const known = sections.some(id => id.slice(id.lastIndexOf("/") + 1) === n);
              if (known) { bad.push(where + " leaves the resolvable " + m[0] + " as words"); break; }
            }
          }
        }
      }
      if (!cut) bad.push("no evidence field is cut");
      return bad;
    })()`,
  },
  {
    name: "the source specification's tables are drawn as tables",
    expr: `(() => {
      const bad = [];
      const d = JSON.parse(document.getElementById("reachData").textContent);
      const src = d.sourceSpec;
      if (!src) { bad.push("the export carries no source specification"); return bad; }
      const tables = [];
      (function walk(node){ (node.paragraphs||[]).forEach(p => { if (p.kind === "table") tables.push(p); }); (node.sections||[]).forEach(walk); })(src);
      if (!tables.length) { bad.push("the source specification carries no table"); return bad; }
      /* The exporter cuts the rows; the page draws cells and never
         splits a row itself. */
      for (const t of tables)
        if (!t.rows || !t.rows.length) { bad.push(t.id + " is a table with no rows"); break; }
      document.querySelector("#nav button[data-t='spec']").click();
      const body = document.getElementById('specBody');
      const drawn = body.querySelectorAll('table');
      if (drawn.length !== tables.length)
        bad.push("the tab draws " + drawn.length + " tables, the export carries " + tables.length);
      /* A drawn table has a header row and cells - not the raw pipes
         the document was written with. */
      for (const t of drawn) {
        const th = t.querySelectorAll('thead th');
        const td = t.querySelectorAll('tbody td');
        if (!th.length) { bad.push("a table has no header row"); break; }
        if (!td.length) { bad.push("a table has no cells"); break; }
        if (t.textContent.indexOf('|') >= 0) { bad.push("a table is drawn as raw markdown"); break; }
      }
      return bad;
    })()`,
  },
  {
    name: "an evidence citation is drawn as a chip, and it leads to its paragraph",
    expr: `(() => {
      const bad = [];
      document.querySelector("#nav button[data-t='findings']").click();
      const cells = [...document.querySelectorAll('#findTable td')];
      const chips = cells.map(c => c.querySelector('a.chip[data-spec]')).filter(Boolean);
      if (!chips.length) { bad.push("no evidence citation is drawn as a chip"); return bad; }
      const chip = chips[0];
      const target = chip.getAttribute('data-spec');
      /* The chip carries the words the citation was written with. */
      if (!chip.textContent.trim()) bad.push("the citation chip says nothing");
      chip.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const para = document.getElementById(target);
      if (!para) { bad.push("the citation points at " + target + ", which is not on the page"); return bad; }
      const tab = document.querySelector('#t-spec');
      if (!tab.classList.contains('on')) bad.push("the citation did not take the reader to the specification");
      return bad;
    })()`,
  },
  {
    name: "the catalogue filters name the series, without the id code or the count",
    expr: `(() => {
      const bad = [];
      document.querySelector("#nav button[data-t='catalogue']").click();
      const d = JSON.parse(document.getElementById("reachData").textContent);
      const chips = [...document.querySelectorAll('#catToolbar .chip')];
      if (!chips.length) { bad.push("no catalogue filters"); return bad; }
      const series = d.idSeries || [];
      for (const s of series) {
        const chip = chips.find(c => c.querySelector('input') && c.querySelector('input').value === s.prefix);
        if (!chip) { bad.push(s.prefix + ": no filter chip"); continue; }
        const lab = chip.querySelector('span');
        if (!lab) { bad.push(s.prefix + ": the chip has no label"); continue; }
        const text = lab.textContent.trim();
        if (text !== s.kind)
          bad.push(s.prefix + ": the label says '" + text + "', the series is '" + s.kind + "'");
        /* The id code must not appear as a word of its own. A series whose
           code is one letter is a substring of its own name - "F" is inside
           "Finding" - so the code is compared as a word, not a fragment. */
        const tokens = text.split(" ").map(x => x.trim());
        if (tokens.indexOf(s.prefix) >= 0)
          bad.push(s.prefix + ": the label still shows the id code");
      }
      /* No filter carries a number: the reader is choosing, not counting. */
      for (const c of chips) {
        const t = c.textContent.trim();
        const hasDigit = t.split("").some(ch => ch >= "0" && ch <= "9");
        if (hasDigit) bad.push("a filter label carries a number: " + t);
      }
      return bad;
    })()`,
  },
  {
    name: "the document's 'not expressible' marker is not read as a word",
    expr: `(() => {
      const bad = [];
      document.querySelector("#nav button[data-t='invariants']").click();
      const d = JSON.parse(document.getElementById("reachData").textContent);
      const marked = d.invariants.filter(i => i.notExpressible);
      if (!marked.length) { bad.push("the export flags no marker"); return bad; }
      /* The EXPORT says which are markers. The page must not read one of
         them as words, and must not have to recognise it by its wording. */
      for (const inv of marked) {
        const row = [...document.querySelectorAll('#tInv tbody tr')]
          .find(tr => tr.textContent.trim().indexOf(inv.id) === 0);
        if (!row) continue;
        const cell = row.querySelector('.written');
        if (cell) bad.push(inv.id + " is read as words: " + cell.textContent.trim());
        if (!row.querySelector('.mono')) bad.push(inv.id + " shows nothing at all");
      }
      /* And an expression that IS an expression is still read. */
      const real = d.invariants.filter(i => !i.notExpressible && decypher(i.expression));
      if (!real.length) { bad.push("no expression is read at all"); return bad; }
      const rrow = [...document.querySelectorAll('#tInv tbody tr')]
        .find(tr => tr.textContent.trim().indexOf(real[0].id) === 0);
      if (rrow && !rrow.querySelector('.written'))
        bad.push(real[0].id + " is not read in words");
      return bad;
    })()`,
  },
  {
    name: "the catalogue shows the guard the flat record dropped",
    expr: `(() => {
      const bad = [];
      document.querySelector("#nav button[data-t='catalogue']").click();
      const d = JSON.parse(document.getElementById("reachData").textContent);
      const pick = id => {
        const rows = [...document.querySelectorAll('#tCat tbody tr')];
        const row = rows.find(r => r.textContent.trim().indexOf(id) === 0);
        if (!row) return null;
        row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return document.querySelector('#catDetail');
      };
      /* What the page shows is the document's text as the page renders it -
         the source's **emphasis** becomes bold. So the expectation is
         rendered by the page's own cell(), not compared raw. */
      const rendered = s => {
        const box = document.createElement('div');
        box.innerHTML = cell(s);
        return box.textContent;
      };
      const cmd = (d.commands || []).find(c => String(c.guards || '').trim() && c.guards.trim() !== '—');
      if (!cmd) { bad.push("no command carries a precondition"); return bad; }
      let host = pick(cmd.id);
      if (!host) { bad.push(cmd.id + " is not in the catalogue table"); return bad; }
      if (host.textContent.indexOf('Preconditions') < 0)
        bad.push(cmd.id + ": the precondition is not named");
      if (host.textContent.indexOf(rendered(cmd.guards)) < 0)
        bad.push(cmd.id + ": the precondition is not shown");
      const pol = (d.policies || []).find(p => String(p.condition || '').trim() && p.condition.trim() !== '—');
      if (!pol) { bad.push("no policy carries a condition"); return bad; }
      host = pick(pol.id);
      if (!host) { bad.push(pol.id + " is not in the catalogue table"); return bad; }
      if (host.textContent.indexOf('Condition') < 0)
        bad.push(pol.id + ": the condition is not named");
      if (host.textContent.indexOf(rendered(pol.condition)) < 0)
        bad.push(pol.id + ": the condition is not shown");
      const pr = (d.probes || []).find(p => String(p.predicate || '').trim());
      if (!pr) { bad.push("no probe carries a predicate"); return bad; }
      host = pick(pr.id);
      if (!host) { bad.push(pr.id + " is not in catalogue table"); return bad; }
      if (host.textContent.indexOf('Reachability probe') < 0)
        bad.push(pr.id + ": the reachability probe is not named");
      const shown = host.querySelector('.written');
      if (!shown) { bad.push(pr.id + ": the predicate does not read in words"); return bad; }
      if ((shown.getAttribute('title') || '').trim() !== pr.predicate.trim())
        bad.push(pr.id + ": the hint does not carry the source predicate");
      return bad;
    })()`,
  },
  {
    name: "an invariant's expression reads in words in the catalogue too",
    expr: `(() => {
      const bad = [];
      document.querySelector("#nav button[data-t='catalogue']").click();
      const d = JSON.parse(document.getElementById("reachData").textContent);
      const inv = (d.invariants || []).find(i => i.checkable && decypher(i.expression));
      if (!inv) { bad.push("no invariant has a readable expression"); return bad; }
      const rows = [...document.querySelectorAll('#tCat tbody tr')];
      const row = rows.find(r => r.textContent.trim().indexOf(inv.id) === 0);
      if (!row) { bad.push(inv.id + " is not in the catalogue table"); return bad; }
      row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const host = document.querySelector('#catDetail');
      const cell = host.querySelector('.written');
      if (!cell) { bad.push(inv.id + " does not read in words in the catalogue"); return bad; }
      if ((cell.getAttribute('title') || '').trim() !== inv.expression.trim())
        bad.push(inv.id + ": the hint does not carry the source expression");
      return bad;
    })()`,
  },
  {
    name: "the detail panel does not scroll; only the table under it does",
    expr: `(() => {
      const bad = [];
      document.querySelector("#nav button[data-t='machines']").click();
      const node = [...document.querySelectorAll('#sm g.nbox')]
        .find(g => g.textContent.indexOf('ST-') >= 0);
      if (!node) { bad.push("no state node to open"); return bad; }
      node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const panel = document.querySelector('#machDetail');
      if (!panel) { bad.push("no detail panel"); return bad; }
      if (panel.scrollHeight > panel.clientHeight + 2)
        bad.push("the panel scrolls: " + panel.scrollHeight + " > " + panel.clientHeight);
      const table = document.getElementById('stateList');
      if (!table) { bad.push("no table area"); return bad; }
      if (getComputedStyle(table).overflowY === "visible")
        bad.push("the table area does not scroll");
      const tabs = document.querySelector('#machDetail .dtabs');
      if (!tabs) { bad.push("no tab strip"); return bad; }
      const before = tabs.getBoundingClientRect().top;
      table.scrollTop = 400;
      const after = tabs.getBoundingClientRect().top;
      if (Math.abs(after - before) > 1)
        bad.push("the tab strip moved when the table scrolled");
      table.scrollTop = 0;
      return bad;
    })()`,
  },
  {
    name: "the trigger shows its name, and its code only on hover",
    expr: `(() => {
      const bad = [];
      document.querySelector("#nav button[data-t='machines']").click();
      const d = JSON.parse(document.getElementById("reachData").textContent);
      const node = [...document.querySelectorAll('#sm g.nbox')]
        .find(g => g.textContent.indexOf('ST-') >= 0);
      node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const tab = [...document.querySelectorAll('#machDetail [data-st]')]
        .find(b => b.dataset.st === 'incoming');
      if (!tab) { bad.push("no incoming tab"); return bad; }
      tab.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const rows = [...document.querySelectorAll('#stateList tbody tr')];
      if (!rows.length) { bad.push("no rows"); return bad; }
      const seen = new Set();
      let checked = 0;
      for (const tr of rows) {
        const cells = [...tr.cells];
        if (cells.length < 2) continue;
        const link = cells[1].querySelector('a.idlink');
        if (!link) continue;
        const t = d.transitions.find(x => x.id === link.dataset.tr);
        if (!t) continue;
        /* The link shows the type mark and the NAME; the name itself is
           the trigger's name. */
        const shown = ((link.querySelector('.idname')||link).textContent||"").trim();
        const hint = (link.getAttribute('title') || '').trim();
        seen.add(shown);
        checked++;
        /* The name, not the code. */
        if (/[A-Z]{2,}-\\d/.test(shown))
          bad.push("the trigger shows a code: " + shown);
        /* The reading is the PAGE's own, so the check does not re-implement
           it; and the source is in the hint. */
        if (shown !== (t.triggerName || t.id))
          bad.push(t.id + " is shown as '" + shown + "', not as its name");
        if (hint.indexOf(t.trigger) < 0)
          bad.push(t.id + ": the hint does not carry the trigger");
      }
      if (!checked) bad.push("no trigger to check");
      return bad;
    })()`,
  },
  {
    name: "the state's fields are read, not scrolled, and the table's header sits at the top",
    expr: `(() => {
      const bad = [];
      document.querySelector("#nav button[data-t='machines']").click();
      const node = [...document.querySelectorAll('#sm g.nbox')]
        .find(g => g.textContent.indexOf('ST-') >= 0);
      if (!node) { bad.push("no state node to open"); return bad; }
      node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const dl = document.querySelector('#machDetail dl');
      if (!dl) { bad.push("no field list"); return bad; }
      if (dl.scrollHeight > dl.clientHeight + 2)
        bad.push("the fields scroll: " + dl.scrollHeight + " > " + dl.clientHeight);
      const area = document.getElementById('stateList');
      if (!area) { bad.push("no table area"); return bad; }
      const th = area.querySelector('thead th');
      if (!th) { bad.push("no table header"); return bad; }
      const areaTop = area.getBoundingClientRect().top;
      const thTop = th.getBoundingClientRect().top;
      if (Math.abs(thTop - areaTop) > 2)
        bad.push("the header sits " + Math.round(thTop - areaTop) + "px below the top of its area");
      const bg = getComputedStyle(th).backgroundColor;
      if (!bg || bg === "rgba(0, 0, 0, 0)" || bg === "transparent")
        bad.push("the header is see-through: " + bg);
      return bad;
    })()`,
  },
  {
    name: "the matrix shows the machine's states both ways",
    expr: `(() => {
      const bad = [];
      document.querySelector("#nav button[data-t='machines']").click();
      const btn = [...document.querySelectorAll('#machViews button')]
        .find(b => b.dataset.v === 'matrix');
      if (!btn) { bad.push("there is no matrix view"); return bad; }
      btn.click();
      const tbl = document.querySelector('#matrixBox table');
      if (!tbl) { bad.push("the matrix has no table"); return bad; }
      const d = JSON.parse(document.getElementById("reachData").textContent);
      const m = d.machines.find(x => x.id === "SM-001");
      /* By ID: a header carries the id of the state it names, so nothing
         here depends on what the state is called. */
      const cols = [...tbl.querySelectorAll('thead th')].slice(1).map(t => t.dataset.col);
      const rows = [...tbl.querySelectorAll('tbody tr')].map(tr => tr.cells[0].dataset.col);
      for (const id of m.states) {
        if (rows.indexOf(id) < 0) bad.push(id + " is not a row");
        if (cols.indexOf(id) < 0) bad.push(id + " is not a column");
      }
      if (rows.indexOf("__start__") < 0) bad.push("there is no start row");
      if (cols.indexOf("__unstated__") < 0) bad.push("there is no unstated column");
      return bad;
    })()`,
  },
  {
    name: "a matrix cell names the transition and who can cause it",
    expr: `(() => {
      const bad = [];
      document.querySelector("#nav button[data-t='machines']").click();
      const btn = [...document.querySelectorAll('#machViews button')]
        .find(b => b.dataset.v === 'matrix');
      btn.click();
      const tbl = document.querySelector('#matrixBox table');
      if (!tbl) { bad.push("no matrix"); return bad; }
      const d = JSON.parse(document.getElementById("reachData").textContent);
      const cell = [...tbl.querySelectorAll('tbody td[data-tr]')].find(td => {
        const t = d.transitions.find(x => x.id === td.dataset.tr);
        return t && t.actors.length;
      });
      if (!cell) { bad.push("no cell carries a transition with actors"); return bad; }
      const t = d.transitions.find(x => x.id === cell.dataset.tr);
      /* The head NAMES the transition and is not a link - the CELL is
         the object the reader clicks. */
      const head = cell.querySelector('.mcellhead');
      if (!head) bad.push("the cell has no header naming the transition");
      if (cell.querySelector('a')) bad.push("the cell holds a link - the cell itself is the object");
      /* The trigger's NAME, not its code - and the transition's id in
         the hint, so the cell can be identified by it. */
      if (head && /[A-Z]{2,}-\\d/.test(head.textContent))
        bad.push("the header shows a code: " + head.textContent);
      if ((cell.getAttribute('title') || '').indexOf(t.id) < 0)
        bad.push("the cell does not carry the transition's id");
      /* The roles, identified by the name the document defines them by. */
      const roles = [...cell.querySelectorAll('.mrole')].map(r => r.dataset.role);
      for (const a of t.actors) {
        const id = a.asNamed || a.name;
        if (roles.indexOf(id) < 0) bad.push("the role '" + id + "' is not in the cell");
      }
      return bad;
    })()`,
  },
  {
    name: "the matrix puts each transition in the cell its own states say",
    expr: `(() => {
      const bad = [];
      document.querySelector("#nav button[data-t='machines']").click();
      const btn = [...document.querySelectorAll('#machViews button')]
        .find(b => b.dataset.v === 'matrix');
      btn.click();
      const tbl = document.querySelector('#matrixBox table');
      if (!tbl) { bad.push("no matrix"); return bad; }
      const d = JSON.parse(document.getElementById("reachData").textContent);
      /* By ID: the cell says which states it joins, so the check compares
         ids with ids and never reads a name. */
      for (const td of tbl.querySelectorAll('tbody td')) {
        const link = td.querySelector('a[data-tr]');
        if (!link) continue;
        const t = d.transitions.find(x => x.id === link.dataset.tr);
        if (!t) { bad.push(link.dataset.tr + " is not in the export"); continue; }
        const from = td.dataset.from, to = td.dataset.to;
        const fromOk = t.fromStates.length
          ? t.fromStates.indexOf(from) >= 0 : from === "__start__";
        const toOk = t.toStates.length
          ? t.toStates.indexOf(to) >= 0 : to === "__unstated__";
        if (!fromOk)
          bad.push(t.id + " sits in the '" + from + "' row but leaves " + t.fromStates.join("/"));
        if (!toOk)
          bad.push(t.id + " sits under '" + to + "' but goes to " + t.toStates.join("/"));
      }
      return bad;
    })()`,
  },
  {
    name: "clicking a matrix cell opens the transition's detail, as in the graph",
    expr: `(() => {
      const bad = [];
      document.querySelector("#nav button[data-t='machines']").click();
      const btn = [...document.querySelectorAll('#machViews button')]
        .find(b => b.dataset.v === 'matrix');
      btn.click();
      const cell = document.querySelector('#matrixBox td[data-tr]');
      if (!cell) { bad.push("no transition in the matrix"); return bad; }
      const id = cell.dataset.tr;
      cell.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const panel = document.querySelector('#machDetail');
      if (!panel) { bad.push("no detail panel"); return bad; }
      if (panel.textContent.indexOf(id) < 0) bad.push("the detail does not name " + id);
      return bad;
    })()`,
  },
];
