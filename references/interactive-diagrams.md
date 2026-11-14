# Interactive diagram for a spec analysis

**This is an optional view of the deliverable, not the deliverable.** The consolidated
`domain-model-and-state-machines.md` is the artifact. Build a page only when the reader
asks for one, and build it against the document that already exists — never the other
way round.

One self-contained HTML file that carries the whole model — machine, transition table,
invariants, reachability, context map, glossary, findings, pending items — so the reader
explores rather than scrolls.

## Build it self-contained

No CDN, no build step, no external assets: one `.html` file with inline CSS and JS, and
the data as a JS array at the top of the script. It must open from disk on a machine with
no network. External fonts or a chart library break that.

## Theme

**Default: light.** A spec analysis is read beside the document it analyses; a dark
canvas invites the reader to treat it as a demo rather than as evidence. Put the chrome
on CSS variables so one `:root` block re-themes it:

```css
:root{
  --bg:#f4f6f9; --panel:#ffffff; --panel2:#eef1f6; --line:#d7dee8;
  --fg:#151920; --muted:#57616f; --dim:#8892a2;
  --accent:#2563eb; --ok:#15803d; --warn:#b45309; --bad:#b91c1c;
}
```

**The variables only reach the CSS.** SVG fills, strokes, marker fills and label colours
are set in JS and do not follow `:root`, so after swapping the variables the diagram
still renders dark. Sweep for the literals that remain:

```bash
grep -n -E '#[0-9a-fA-F]{6}' explorer.html | grep -v -E '^\s*[0-9]+:\s*\.(t-|sp-)'
```

Every hit outside the variable block is a JS-side colour still carrying the old palette.

Conversion rules:

- **Node fills become pastel, node text becomes dark.** A stage is a filled box with a
  label inside it; inverting the palette keeps the label legible but makes the box
  shout. Use a light tint fill with the 700-900 shade of the same hue for the text —
  `#e0f2fe` fill with `#0c4a6e` text for In Review.
- **Unambiguous edges need a DARKER grey on a light ground**, not a lighter one:
  `#5c6675`, not `#7b8798`. A pale stroke that reads on `#0f1115` vanishes on `#f4f6f9`.
- **The active control needs white text.** `.btn.on{background:var(--accent)}` with the
  inherited dark text is dark-on-blue and fails contrast — set `color:#ffffff` on the
  active state explicitly.
- **Status pills need a dark foreground on a pale fill**, e.g. `#991b1b` on `#fee2e2`.

## Structure

- A `<header>` with the document's identity and provenance.
- A `<nav>` of tab buttons that toggle `section.on` — one tab per view.
- `main > section` per view, all in the same document, no routing.
- A `<script>` holding the data arrays, then the render functions, then an init that
  calls each render.

**The first section carries `class="on"` in the markup.** A tab switcher that only
ever *swaps* the class leaves every view hidden until something is clicked — so a
page whose nav highlights the first tab but shows nothing under it looks like a
rendering failure, and the reader sees an empty frame. Put `on` on the initial section
in the HTML, and confirm the first paint is non-empty with no interaction at all.

## Rendering the state machine

**Data-driven SVG.** Nodes and transitions as arrays; a render function builds the SVG.
Never hand-place elements in markup.

```javascript
const STAGES = {
  Draft: {id:10, label:"Draft", x:50, y:90, w:200, h:64, color:"#334155", tc:"#cbd5e1",
          held:"Sales", edit:"Sales, customer", how:"Created; or Sales unsubmits"},
};
const TRANSITIONS = [
  {id:"T3", from:"Draft", to:"InReview", trig:"Submit", actor:"Sales", guard:"R ∧ L",
   kind:"def", eff:"§6.3 “Stage → In Review”", note:""},
];
```

**Encode the finding kind in the edge, not in prose.** `kind:"def"` (two sections
disagree) draws red with a dashed halo; `kind:"gap"` (never specified) draws amber;
unambiguous draws grey. The colour IS the finding.

**Route long edges around the intermediate boxes.** A per-edge `bow` hint offsets the
control points perpendicular to the direct line. Give the hint a sign per edge so
parallel edges fan out instead of overlapping.

**Self-loops** get a loop above the node:

```javascript
function selfLoop(key){
  const A=STAGES[key], ax=A.x+A.w/2, ay=A.y;
  return {d:`M ${ax-46} ${ay} C ${ax-96} ${ay-104}, ${ax+96} ${ay-104}, ${ax+46} ${ay}`, ...};
}
```

**When a bow is not enough, give the edge explicit waypoints.** A `bow` curves the edge;
it cannot make it clear a box sitting directly between the two nodes. Use an orthogonal
waypoint list with rounded corners for those, and branch on `via` ahead of `bow` in the
route builder:

```javascript
const ROUTE = {
  T9:  {via:[[250,122],[392,200],[392,672],[560,672]]},   // around Returned to Sales
  T30: {via:[[1380,122],[1470,122],[1470,760],[770,760],[770,704]]},
};
function viaRoute(pts){
  const R = 14;                       // corner radius
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i=1;i<pts.length-1;i++){ /* line to the corner, quadratic through it */ }
  return {d, anchor: midOfLongestSegment};
}
```

**A transition with no destination is data, not an error.** Rows like `to:null` (Reopen
has no target stage in the spec) crash any renderer that indexes `STAGES[t.to]`. Decide
explicitly what such a row means and branch on it. For a spec analysis the right choice
is to **show the hole**: route it into a dashed "destination unstated" marker node,
because the missing destination is itself a finding and omitting it understates the
problem. Reserve `to:null` for rows that are prohibitions rather than moves ("Approved →
Cancel is not permitted") and keep those table-only.

## Label collision is the hard part

Straight-line midpoints collide badly — four labels landed on the same pixel in a first
pass. Compute the anchor from the **actual curve**, then run an iterative separation
pass:

```javascript
function placeLabels(items){
  items.forEach(it => {
    const p = bezPoint(it.b, 0.5);      // point ON the cubic, not the chord
    it.x = p[0]; it.y = p[1];
    it.w = it.txt.length * 5.3 + 8; it.h = 13;
  });
  for (let it = 0; it < 260; it++){
    let moved = false;
    for (let i=0;i<labels.length;i++) for (let j=i+1;j<labels.length;j++){
      const a=labels[i], b=labels[j];
      const ox=(a.w+b.w)/2+7, oy=(a.h+b.h)/2+4;
      if (Math.abs(b.x-a.x)<ox && Math.abs(b.y-a.y)<oy){
        const push=(oy-Math.abs(b.y-a.y))/2 + 0.6;
        const s = b.y>=a.y ? 1 : -1;
        a.y -= push*s; b.y += push*s; moved = true;
      }
    }
    if (!moved) break;
  }
  return items;
}
```

Two details that matter: the width estimate must be **per-label** (text length varies
wildly between "T4 Submit" and "T28 Owner final approve"), and the separation must be
**vertical only** — horizontal separation fights the curve and pulls labels off their
edges.

**The width estimate is calibrated to the label font size.** `txt.length * 5.3 + 8`
assumes a 12px label; scale the type and the constant must scale with it, or the
solver believes every label is narrower than it is and lets them overlap. Rescaling
the font is not a CSS-only change — it reaches into the layout maths.

**Node boxes are obstacles too.** Separating labels from each other is not enough: a
label pushed clear of its neighbours can land on a stage box, which reads as a broken
layout. Treat every node rect as an obstacle in the same loop and push the label off the
box vertically:

```javascript
const obstacles = Object.values(STAGES).map(s=>({x:s.x-4,y:s.y-4,w:s.w+8,h:s.h+8}));
labels.forEach(l => obstacles.forEach(o => {
  if (l.x-l.w/2 < o.x+o.w && o.x < l.x+l.w/2 && l.y-l.h/2 < o.y+o.h && o.y < l.y+l.h/2){
    l.y += (Math.abs(l.y-(o.y+o.h+9)) < Math.abs((o.y-9)-l.y))
         ? l.y-(o.y+o.h+9) : (o.y-9)-l.y;
  }
}));
```

**Leader lines tie a displaced label back to its edge.** Once separation and obstacle
avoidance have moved a label, the reader can no longer tell which curve it names. After
rendering, find the closest point on the label's own path (sample with
`getPointAtLength`) and draw a thin line from the label to it:

```javascript
const pathEl = gE.querySelector(`path[data-id="${t.id}"]`);
const L = pathEl.getTotalLength();
let best=null, bd=1e9;
for (let k=0;k<=40;k++){
  const pt = pathEl.getPointAtLength(L*k/40);
  const d = Math.hypot(pt.x-x, pt.y-y);
  if (d<bd){bd=d; best=pt;}
}
// draw a 1px line from the label's edge to best; skip when bd < 14 (already adjacent)
```

Give the label text a dark `stroke` with `paint-order="stroke"` so it stays legible
where it crosses an edge.

## Layout — the page never scrolls, the sections do

**The document itself must not scroll vertically.** `html,body{height:100%;overflow:hidden}`
with `body` as a flex column, and each `section` a flex child that scrolls its own
content. A reader who must scroll the page to find the bottom of a table cannot tell
where the page ends and the table continues, and every long view becomes a hunt.

```css
html,body{height:100%;overflow:hidden}
body{display:flex;flex-direction:column}
header,nav{flex:0 0 auto}
main{flex:1 1 auto;min-height:0;display:flex;overflow:hidden}
section.on{display:flex;flex-direction:column;gap:11px;flex:1 1 auto;min-height:0;overflow:hidden}
.panel{flex:1 1 auto;min-height:0;overflow:auto;background:var(--panel);
  border:1px solid var(--line);border-radius:9px}
```

**Put the secondary content beside the primary, not below it.** A spec analysis is a
comparison artifact: the graph next to the stage detail, the transition table next to the
evidence, the reachable states next to the invariant checks, the context map next to the
external worlds and the roles. Stacking them vertically makes the reader scroll between
two halves of one idea.

```css
.cols{display:grid;gap:14px;flex:1 1 auto;min-height:0}
.c-2{grid-template-columns:minmax(0,1.35fr) minmax(0,1fr)}
.c-3{grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)}
```

**Give every table a scrolling container that fills the remaining height**, so the
table occupies the space the layout gave it rather than a fixed pixel height:

```css
.scroll.fill{flex:1 1 auto;min-height:0}
```

**Split a long tab into sub-tabs rather than one long scroll.** The pending tab carries
four distinct kinds of open work — questions and risks, outside dependencies, undefined
terms, deferred scope — and stacking them into one column buries the last two. Give
each its own sub-tab with a count badge, so the reader knows what is behind each:

```html
<div class="tabs" id="pTabs">
  <button class="tab on" data-ptab="q">Open questions &amp; risks <span class="tabn" id="pnQ"></span></button>
  <button class="tab" data-ptab="out">Outside dependencies <span class="tabn" id="pnO"></span></button>
</div>
```

## Interaction

- **Click a node** → isolate its edges, dim the rest, and fill the detail panel with
  that stage's inbound/outbound transitions, the spec's own "Held by" / "Who can edit" /
  "How it gets there", and the evidence quote for each.
- **Hover or click an edge** → the detail panel shows from → trigger → actor → guard →
  to, the status tag, and the verbatim evidence.
- **Filters** above the diagram narrow the edges to confirmed defects or to spec gaps.
  These are the two views a reviewer actually wants.
- **Tables** get a search box and a segmented filter (all / defects / gaps), both
  client-side over the same data array.

### Filters must be real inputs, not styled buttons

A row of buttons whose pressed state you have to infer is neither a radio group nor a
checkbox, and a reviewer cannot predict what clicking one will do. Use a real
`<input type="checkbox">` inside a `<label>`, so the browser draws the tick, the
keyboard toggles it, and the selected state is unmistakable:

```html
<label class="chip"><input type="checkbox" id="tDef"><span>Defects</span></label>
```

```css
.chip input{appearance:none;width:15px;height:15px;border:1.5px solid #98a2b3;
  border-radius:4px;background:#fff;display:grid;place-content:center}
.chip input:checked{background:var(--accent);border-color:var(--accent)}
.chip input:checked::after{content:"";width:9px;height:9px;background:#fff;
  clip-path:polygon(14% 44%,0 65%,50% 100%,100% 16%,80% 0,43% 62%)}
```

**Encode the constraint in the control, and state it in the label.** When one selection
must always travel with another, enforce it in the change handler and say so next to
the control — "All adds the unambiguous edges · it always needs Defects or Gaps with it".
A constraint the reader has to discover by trial is a bug report waiting to happen.

**Multi-select filters are checkboxes; single-select filters are radios.** A category
filter where exactly one option applies ("All / Stated / Derived / Broken") must be
`<input type="radio" name="...">` — a radio group the browser enforces, so two options
can never be active at once and the reader cannot put the page into an ambiguous
state. Give the radio its own chip shape (a circle with a filled dot rather than a
square with a tick) so the control type is visible before anything is clicked.

**Derive the filter set from the data, not from memory.** The glossary carried six
statuses but only three had a button, so a term whose status read "Partial" had no
way to be filtered to — the status was visible in the table and unreachable as a
filter. Enumerate the distinct values the field actually takes and give each one a
control; then assert the counts match the data.

### Clicking a table row must not navigate

A row that expands its evidence **in place**, under the row, never switches tabs. A
click that silently changes which view you are looking at leaves the reader with no way
back and no idea what happened. If the detail belongs in a side panel, show it in the
side panel; if the row needs a diagram, put that diagram in a tab beside the table
rather than in another tab of the page.

Make the affordance visible: a chevron that rotates when open, a pointer cursor, a
hover tint, and a line in the toolbar saying "click a row to expand its evidence".

### Show the source text behind a citation

A column that cites a section (`§4.2`, `§7.3 vs §4.2`) is a pointer the reader cannot
follow without the document in their other hand. Carry the spec's own words behind the
citation, and resolve them **at build time** so a corrected spec reaches the page when
the generator re-runs.

**Resolve the citation in the generator, not in the page.** Index the extract by
section number and hand the page plain data — the page should never parse the spec:

```javascript
// source-sections.js - the extract, indexed by section number
function parseSections(lines) {
  const heads = [], seen = new Set();
  lines.forEach((line, i) => {
    const m = /^(\d+(?:\.\d+)*)\.?\s+(\S.*)$/.exec(line);
    if (!m || seen.has(m[1])) return;      // a body line that looks like a heading
    seen.add(m[1]);
    heads.push({ sec: m[1], title: m[2].trim(), line: i });
  });
  const bySec = {};
  heads.forEach((h, i) => {
    const to = i + 1 < heads.length ? heads[i + 1].line : lines.length;
    bySec[h.sec] = { sec: h.sec, title: h.title,
                     paras: lines.slice(h.line + 1, to).map(s => s.trim()).filter(Boolean) };
  });
  return { bySec };
}
```

A citation cell is a comma-separated list whose items are not all the same shape: a
section (`§4.2`), two sections in conflict (`§7.3 vs §4.2`), a section with the spec's
words quoted inline (`§3 (“so time in each stage can be reported”)`), an open question
(`Q10`), an outside dependency (`OQ-37`), another invariant (`I-01`), or a pointer to a
document (`v0.3 changelog`). Parse each shape into its own record — a section carries
the resolved paragraphs, the rest carry the pointer:

```javascript
// in the generator, once per citation cell
content.INVARIANTS.forEach(v => { v.ev = resolveEvidence(v.e, source, evCtx); });
```

```json
{"id":"I-02","cat":"stated","t":"Either legal name or DBA can satisfy the licensing match",
 "e":"§4.2, §6.2","st":"ok",
 "ev":[{"type":"sec","sec":"4.2","title":"Rules","paras":["The legal business name is ..."]},
       {"type":"sec","sec":"6.2","title":"Licensing check (each division that needs licensing)",
        "paras":["Which divisions need licensing comes from the Licensing app. ..."]}]}
```

The page then renders `v.ev` in order, and a `vs` between two sections becomes a note
that the two disagree. Render the sections **in the order the cell lists them**, and
close the section above before emitting a non-section note — otherwise the notes for
`§12.1, Q11, OQ-37` print above the section they follow.

**The expansion row is not a data row.** Give it a class and remember its owner, so the
sort engine can leave it alone and re-attach it under its owner after a sort:

```javascript
const xrow = document.createElement("tr");
xrow.className = "xrow";
xrow.dataset.owner = v.id;          // the row it belongs to
tr.after(xrow);
```

In the sort function, exclude it from the sorted set and put it back:

```javascript
const expanded = [...tb.querySelectorAll("tr.xrow")];
const rows = sortableRows(tableId, tb).filter(r => !r.classList.contains("xrow"));
rows.sort(/* ... */);
rows.forEach(r => tb.appendChild(r));
expanded.forEach(x => {
  const owner = x.dataset.owner && tb.querySelector(`tr[data-rowid="${x.dataset.owner}"]`);
  if (owner) owner.after(x);
});
```

**Scroll the expansion into view inside its own scroll box.** The table scrolls in a
`.scroll` container, so an expansion that opens below the fold looks like nothing
happened. `scrollIntoView({block:"nearest"})` depends on how much of the row is
already visible; set the box's `scrollTop` yourself.

**Watch the selectors you write for the collapsed table.** An expansion cell is
`colspan`-ed, which makes it the *first* cell of its own row — so
`#iTable tbody td:first-child{white-space:nowrap}`, written to keep an ID on one line,
also matches the expansion body and stops its text from wrapping. Scope it out:

```css
#iTable tbody tr:not(.xrow) td:first-child{white-space:nowrap}
```

**Scope a layout fix to the table that needs it.** `table-layout:fixed` was needed so
an expansion cell could not claim its max-content width and drag the table past the
page — but applied to every table it broke the others, because fixed layout honours
declared column widths literally and some tables declare more than their narrow
container holds. Fix the table with the defect, then re-measure every other table.

**A caveat to state to the reader:** the plain-text extract flattens tables, one cell
per line, so the expansion of a section whose body is a table reads as a list of loose
values rather than a table. That is a property of the extract, not of the page — say so
rather than pretending the layout is the spec's.

### A side panel must carry the item's own text, not its identifier

When a list groups items under a heading — the findings folded into an issue — the
side panel must show each grouped item's **title and body**, not a row of ID chips. An
identifier tells the reader nothing; the title tells them what the group actually
covers, and the body tells them whether they agree with it. The chips in the list stay
as IDs; the panel expands them into the real thing.

Select on **click**, not on `toggle`. The `toggle` event is queued, so a panel driven
from it shows the previous item for a moment after the click. Bind the click as well:

```javascript
d.addEventListener("toggle", ()=>{ if(d.open){ fPick={kind:"issue", id:is.id}; renderFDetail(); } });
d.querySelector("summary").addEventListener("click", ()=>{ fPick={kind:"issue", id:is.id}; renderFDetail(); });
```

Give the panel its own state variable, named for the panel rather than for the
concept — `fPick`, not `fSel` — and check the file before declaring it, because a
collision with another feature's state is a fatal parse error (see the pitfalls).

Give the panel a two-column layout beside the list, and size it from the data: a
group with seven members needs more room than one with two, so let the grid columns
carry the ratio rather than a fixed pixel width.

### Every table column must be sortable — and the marker must mean it

A spec analysis table is a reference the reader will scan, not read top to bottom.
Sorting by ID, stage, actor, severity or status is how a reviewer finds the row they
are looking for.

**Bind the affordance to the behaviour, not to the table.** A CSS rule like

```css
table.sortable th[data-k]::after{content:"↕";opacity:.35}
```

draws the sort marker on *every* heading that carries `data-k` — so if one table's
headings carry the key but its handler does not, the page promises sorting it does not
do. The reader's report ("the table is not sortable, but the columns look like they
allow sorting") is then accurate. The rule to hold: **a heading that shows the arrow
must sort.**

The cheapest way to keep that true is one generic engine that reads `data-k` off the
DOM and reorders the rendered rows, wired to every table — not a bespoke sort per
table, which is how the gap opens in the first place:

```javascript
const SORTS = {};
function cellText(tr,col){ return (tr.cells[col]?tr.cells[col].textContent:"").trim(); }
function compareCells(a,b){                       // numbers as numbers, text as text
  const na=parseFloat(a.replace(/[^0-9.\-]/g,"")), nb=parseFloat(b.replace(/[^0-9.\-]/g,""));
  if(a!==""&&b!==""&&!isNaN(na)&&!isNaN(nb)) return na-nb;
  return a.toLowerCase().localeCompare(b.toLowerCase());
}
function sortTable(id,key){                       // sorts the rendered <tr>s by one column
  const tbl=document.getElementById(id), tb=tbl.tBodies[0];
  const col=[...tbl.tHead.rows[0].cells].findIndex(th=>th.dataset.k===key);
  if(col<0) return;
  const st=SORTS[id]||(SORTS[id]={key:null,dir:1});
  if(st.key!==key){ st.key=key; st.dir=1; }
  const rows=[...tb.rows];
  rows.sort((a,b)=>compareCells(cellText(a,col),cellText(b,col))*st.dir);
  rows.forEach(r=>tb.appendChild(r));
  [...tbl.tHead.rows[0].cells].forEach((th,i)=>{
    th.classList.toggle("asc", i===col&&st.dir===1);
    th.classList.toggle("desc",i===col&&st.dir===-1);
  });
}
function makeSortable(id){ /* bind each th[data-k] click to sortTable(id, th.dataset.k) */ }
```

Sorting the rendered rows rather than the source array means the same engine serves a
table fed from a JS array and a table fed from the harness export — and it works for
tables built at runtime, as long as you call `makeSortable(id)` after building them.

**Sort from a captured source order, not from the order the last sort left.** Sorting
the rows that are currently in the tbody makes ties inherit the previous column's
order: two invariants citing §3, sorted by ID and then by Evidence, keep the ID
ordering inside the §3 pair — so clicking Evidence again gives a different answer than
the first click did. Capture the row order when the tbody is filled and always sort
from that copy:

```javascript
const SOURCE = {};                          // tableId -> rows in render order
function captureOrder(id){                   // call right after a render fills the tbody
  const tb = document.getElementById(id).tBodies[0];
  if (tb) SOURCE[id] = [...tb.rows];
}
function sortTable(id,key){
  const tbl=document.getElementById(id), tb=tbl.tBodies[0];
  const col=[...tbl.tHead.rows[0].cells].findIndex(th=>th.dataset.k===key);
  if(col<0) return;
  const st=SORTS[id]||(SORTS[id]={key:null,dir:1});
  if(st.key!==key){ st.key=key; st.dir=1; }
  const base=SOURCE[id];
  const live=[...tb.rows];
  /* fall back to the live order if the tbody was rebuilt since the capture */
  const src=(base && base.length===live.length && base.every(r=>tb.contains(r))) ? base : live;
  const rows=src.slice().sort((a,b)=>compareCells(cellText(a,col),cellText(b,col))*st.dir);
  rows.forEach(r=>tb.appendChild(r));
  [...tbl.tHead.rows[0].cells].forEach((th,i)=>{
    th.classList.toggle("asc", i===col&&st.dir===1);
    th.classList.toggle("desc",i===col&&st.dir===-1);
  });
}
```

**Re-apply the sort after every re-render.** A filter change rebuilds the tbody and
wipes the order. Keep the sort state per table and call `resortTable(id)` at the end of
every render that can change the row set. Capture the source order in the same place —
before the resort, so the capture is the render order and not the sorted order.

**Compare numbers as numbers.** A stage-count column sorted as text puts `980` after
`29,242`. Strip separators and compare numerically when both sides parse.

Give every heading a `data-k`, including the ones in tables you did not think of as
sortable — the context-map and roles tables are reference tables too.

## Load the computed data, do not hand-copy it

**The diagram must consume the model's exported output**, not numbers typed into a JS
array. Hand-copied figures go stale the moment the model changes, and the artifact then
asserts numbers the model no longer produces — the reader has no way to tell.

Render the reachable-state table, the invariant checks and the finding flags from that
export — but **embed the export in the page rather than fetching it**. A `fetch()` of a
sibling file is blocked when the HTML is opened from disk (`file://`), which is exactly
how a reviewer will open it, and the failure is quiet: the page still renders, with the
data-driven view empty. Have the exporter write the JSON into a script block inside the
HTML:

```html
<script id="reachData" type="application/json">{ ... }</script>
```

```javascript
let REACH_DATA = null;
try{ REACH_DATA = JSON.parse(document.getElementById("reachData").textContent); }
catch(e){ console.warn("reach data not embedded", e); }
```

Keep the aggregate and one worked example per invariant in the export; a per-state dump
of every reachable state can be hundreds of megabytes, which is far too large to embed
in a page.

**Two copies of the data means two copies to drift.** Once the export lives inside the
HTML, the standalone `.json` on disk is a build artifact, not a runtime dependency —
re-running the exporter without re-inlining leaves the page serving stale figures with
no error at all. Say in the file's own comment how to regenerate both, and make the
regeneration a single command.

## Generate the findings view from the document that owns it

The harness export covers the *computed* numbers. The findings list — severities,
titles, which findings each issue groups, how many tests back each finding — comes from
the findings document, and hand-copying it into the page creates a second source of
truth that drifts the moment the document is corrected.

**A hand-maintained copy drifts in the directions that matter most**: a severity that
was downgraded, a finding added after the copy was made, an ID that exists in the page
and in no heading. A reviewer holding both artifacts sees two versions of the same
finding with different severities.

**Write a generator that parses the document and rewrites the page's arrays**, and run
it after every correction. The page then reflects reality by construction rather than by
your remembering to re-copy. Parse the document's own structure — it is already
structured for this:

```javascript
// headings: "### F-03 — title · High" and "### ISS-05 · title · High"
const sections = doc.split(/^### /m).slice(1).map(s => {
  const [head, ...rest] = s.split('\n');
  const ids = head.match(/F-\d+b?/g) || [];
  const sev = (head.match(/·\s*(Critical|High|Medium|Low)\b/) || [])[1] || 'Medium';
  const title = head.replace(/^F-\d+b?\s+—\s*/, '').replace(/\s*·\s*(Critical|High|Medium|Low)\b/, '').trim();
  return { ids, sev, title, body: rest.join('\n') };
});
```

Pull the body into labelled blocks — `**Evidence.**`, `**Recommendation.**`,
`**Harness evidence.**`, `**Severity note.**` — and read the three-way harness
classification out of the evidence text (`[contradiction]`, `[gap]`, or neither). A
single "reproduced" boolean cannot express those three states, and the page's tag has
to mean the same thing the document's tag means.

**Splice the generated array into the page by matching the array's own boundaries**, not
by searching for the next `];` — the file contains many arrays and a naive splice lands
in the wrong one:

```javascript
function replaceArray(src, name, replacement){
  const start = src.indexOf('const ' + name + ' = [');
  const end   = src.indexOf('\n];', start);
  return src.slice(0, start) + replacement + src.slice(end + 3);
}
```

Give the generator a `--check` mode that reports drift without writing, so the check is
cheap to run before every commit. The generator is a build step: keep it next to the
page it regenerates, and point it at the document by path.

**The generator's replacement region owns every line inside it — including helpers.**
When the script rewrites a span of the page between two markers, it takes the whole
span. A helper that happened to sit inside that span is deleted along with the data,
and the failure is invisible at load time: the page still opens, still draws its
chrome, still switches tabs. Only the render functions that used the helper throw,
so only those views go blank — and the artifact looks like it is mostly working.

Two consequences. First, **put the helpers inside the generated block**, so the
generator owns them and emits them every run. Second, **land the end of the region on
a marker that comes after the helpers**, so a change to the marker cannot sweep them
up. If a helper must live outside the block, assert it is still there after the run:

```bash
for h in 'const q = s' 'const sevTag' 'const stTag' 'const \$ = s'; do
  printf "%-16s %s\n" "$h" "$(grep -c "$h" explorer.html)"; done
```

**Make the generator idempotent in the presence of its own first run.** Each removal
has to be conditional — "if this literal is still here, remove it" — because the
second run sees a page the first run already migrated. A generator that deletes a
helper on the first run and leaves a duplicate on the second fails only on the second
run, which is exactly when you are about to ship.

**Remove IDs that the document does not define.** When the page carried two findings
the document never defined, the fix was to drop them and rewrite the prose that cited
them so the observation survives without a pointer to a nonexistent finding — not to
invent a matching heading.

## Compile the page's script before you trust the page

A syntax error inside the page's inline script stops every view from rendering. The
header and nav still draw, so the artifact looks finished while every panel is empty,
and a parse-time error can leave the console quiet.

**Compile the script out of the file** to locate it — the error then names the line:

```javascript
const fs=require('fs'), vm=require('vm');
const html=fs.readFileSync('explorer.html','utf8');
const blocks=[...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
const main=blocks.find(b=>!/json/.test(b[1]));       // skip the embedded JSON block
try{ new vm.Script(main[2], {filename:'explorer.js'}); console.log('parses OK'); }
catch(e){ console.log('SYNTAX ERROR:', e.message); }
```

Run this after every edit that touches a template literal. A patch can report success
while dropping a `return` or an opening backtick, and the result is a page where
nothing renders.

**Remember what the browser console will and will not tell you.** A script that throws
at load time leaves `window.onerror` unset and every global binding undefined, so a
probe like `js("FINDINGS.length")` reports `ReferenceError: FINDINGS is not defined` —
which reads like "the data is missing" when the truth is "the script never ran".
Distinguish the two: check whether *other* views render before believing a probe.

**Probe the page through the DOM, not through its script bindings.** `const` declared
at the top level of a classic `<script>` is not a property of `window`, so a probe
cannot read it by name. Read the rendered elements instead — row counts, tag text,
heading text — which is what the reader actually sees anyway.

**List the functions the page actually defines before you call one.** A probe naming
a function that does not exist reports the view as empty or MISSING, which is
indistinguishable from a broken page. Plausible names are not names: the renderers
may be called `renderT`, `renderI`, `renderG`, `renderF` while the probe reaches for
`drawTrans`, `drawInv`. A probe that reports *every* view as MISSING is measuring
the probe, not the page — grep the declarations first:

```bash
grep -nE '^(function|const) [A-Za-z0-9_]+' explorer.html | cut -c1-100
```

When a probe and the page disagree, believe the page only after you have confirmed
the probe names something real. The fastest confirmation is to call the renderer
directly inside a try/catch and read the exception:

```javascript
js("(()=>{try{renderT();return 'ok'}catch(e){return 'THROW: '+e.message}})()")
```

The exception names the broken function and the reason. A blank view with no
exception means the function did not run at all — check whether its inputs exist.

## Escape user content

The spec's text goes into `innerHTML`. Escape it:

```javascript
const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
```

And the spec's own markdown emphasis inside quotes must become real markup, not literal
asterisks — the spec uses `**` for bold and `*` for italic:

```javascript
const q = s => esc(s)
  .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")      // bold first, or ** reads as two italics
  .replace(/\*([^*\n]+)\*/g, "<i>$1</i>");
```

**Count the emphasis spans before you change the renderer.** A regex that handles only
`**` leaves every `*italic*` as literal asterisks; a regex that handles `*` without
care can swallow a stray one. Scan the data first — count the `**` spans, the `*`
spans, and the leftovers — then pick the pattern. Zero leftovers means the pairs are
unambiguous and the simple pattern is safe.

**Use one renderer for every quoted string.** If some fields go through `esc()` and
others through `q()`, the same `**bold**` renders as bold in one place and as literal
asterisks in the next, and the reader sees the emphasis rules change mid-document.
Route anything carrying the spec's prose through `q()`; keep `esc()` for identifiers
and titles that never contain markup.

## Verify it in a browser — do not skip this

A file that was written but never rendered is not verified. Open it and exercise it:

```javascript
new_tab("file:///C:/path/to/explorer.html")
wait_for_load()
js("document.querySelectorAll('#sm .nbox').length")      // nodes rendered
js("document.querySelectorAll('#sm path.edge').length")  // edges rendered
js("document.querySelector('#fCount').textContent")      // filters work
```

Then **click through**: select a node, click an edge, apply each filter, switch tabs.
Assert the counts change.

**But do not stop at ad-hoc probes — write the probes into a runnable harness.** A
probe answers the one question you thought to ask, and it keeps answering that one
question while the views it does not cover stay broken. A reviewer who finds a blank
tab in the deliverable will not ask which probe you ran.

`scripts/test-explorer-cdp.js` in this skill is the harness: it launches headless
Chrome over the DevTools Protocol, captures every uncaught exception and console
error, and runs a list of assertions against the live DOM, exiting non-zero on
failure.

```bash
node scripts/test-explorer-cdp.js docs/diagrams/onboarding-explorer.html checks.js
```

The checks file exports an array of `{name, expr}`; each `expr` runs in the page and
passes when it evaluates to `true`, or to an array of problem descriptions that is
empty:

```javascript
module.exports = [
  {name:"every tab shows content",
   expr:`(async()=>{const bad=[];for(const t of ["sm","trans","inv"]){
      document.querySelector('#nav button[data-t="'+t+'"]').click();
      const s=document.querySelector('#t-'+t);
      if(!s.classList.contains("on")||s.innerText.trim().length<40) bad.push(t);}
      return bad;})()`},
  {name:"invariants table has rows",
   expr:"document.querySelectorAll('#iTable tbody tr').length > 0"},
];
```

Assertions that are worth their weight, because each one caught a real class of
defect here:

- **no uncaught exceptions and no console errors** — the harness collects these for
  the whole session, so a render function that throws on load is reported even
  though the page still looks fine.
- **every renderer runs without throwing** — call each render function inside a
  try/catch and collect the failures. This names the broken function instead of
  leaving you to infer it from a blank view.
- **every tab shows content** — click the nav button and assert the panel got the
  `on` class *and* has text.
- **every table has rows**, counted from the tbody, not from the container.
- **no `undefined` leaks into the rendered output** — scan the rendered text of each
  view for the literal word. A generator that emits `"undefined"` into a title
  otherwise looks fine.
- **the page does not scroll as a whole** — `document.documentElement.scrollHeight
  <= document.documentElement.clientHeight`.
- **no duplicate element ids** — two views sharing an id make every `querySelector`
  hit the wrong one.
- **each filter's row count matches the data** — click the filter and count the
  rows. A filter wired to nothing, or to the wrong field, still looks like a filter
  because it is drawn from the same data the table is.
- **each table sorts under its own comparator** — click a heading and compare the
  rendered order against the order the table's own sort function produces. Do not
  assert "the order changed": a table whose rows are already in that order
  legitimately does not change, and the assertion fails on correct code. Do not
  assert "clicking twice reverses it" either — that fails on any column with
  duplicate values. Compare against the comparator, and assert monotonicity under it.
- **the first view renders with no interaction** — load the page and read the first
  section's content before clicking anything.
- **assert on `textContent`, not `innerText`, for text inside a closed `<details>`** —
  a collapsed element renders nothing, so its `innerText` is the empty string even
  though the text is in the DOM. `textContent` means "the text is there";
  `innerText` means "the text is visible". Use `textContent` to assert a fact about
  content and `innerText` to assert a fact about rendering, and never swap one for
  the other: the first fails against correct code, the second passes against an
  element that was never rendered.

**Screenshots are viewport-sized.** A viewport capture of a wide canvas shows the top
slice and looks like a broken layout even when it is fine. To assess a wide diagram,
resize the *emulated* viewport to the canvas width — `window.resizeTo` is unreliable in
headless Chrome:

```javascript
cdp("Emulation.setDeviceMetricsOverride", width=1700, height=1100,
    deviceScaleFactor=1, mobile=False)
capture_screenshot()
```

**Check layout numerically, not by eye.** Three collisions matter, and one numeric pass
finds all three: labels overlapping each other, labels sitting on a node box, and edges
passing through a node box. Compare rendered `getBBox()` rectangles for the first two,
and sample the path with `getPointAtLength` against the node rects for the third:

```javascript
// labels over node boxes
const els=[...document.querySelectorAll('#sm text.elabel')];
const boxes=[...document.querySelectorAll('#sm .nbox rect')].map(r=>r.getBBox());
// edges crossing node boxes
const paths=[...document.querySelectorAll('#sm path.edge')];
paths.forEach(p=>{ const L=p.getTotalLength();
  for(let k=1;k<30;k++){ const pt=p.getPointAtLength(L*k/30);
    boxes.forEach(b=>{ if(pt.x>b.x+3&&pt.x<b.x+b.width-3&&
                         pt.y>b.y+3&&pt.y<b.y+b.height-3) bad.push(p.dataset.id); }); }});
```

Also check nothing sits outside the canvas. Run a vision pass over the screenshot
afterwards as well — it catches "readable?" judgements the numeric checks cannot make:
contrast, arrowhead overlap, whether the flow is legible at a glance.

## Make the pending work visible

The pending tab carries the open questions, the outside dependencies, the undefined
terms, and the deferred work items. Put it in the nav like any other view — the pending
items are part of the analysis, not an appendix, and a reader who cannot find them will
assume nothing is outstanding.
