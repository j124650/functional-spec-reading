# Interactive diagram for a spec analysis

**This is an optional view of the deliverable, not the deliverable.** The consolidated
`domain-model-and-state-machines.json` is the artifact. Build a page only when the reader
asks for one, and build it against the document that already exists — never the other
way round.

One self-contained HTML file that carries the whole model — machine, transition table,
invariants, reachability, context map, glossary, findings, pending items — so the reader
explores rather than scrolls.

## Build it self-contained

No CDN, no build step, no external assets: one `.html` file with inline CSS and JS, and the
data embedded in the file. It must open from disk on a machine with no network.
External fonts or a chart library break that.

### A check finds its subject by ID, never by its visible text

A check that locates what it is about by reading a label — the cell's text, a column
heading, a row's position — is a check that breaks the moment the label changes, and it
fails in the WORST way: not loudly, but by asserting against the wrong element and
passing. A matrix check that finds its cell by counting headers picks the cell one
column to the left of the one it means, compares a transition's endpoints against the
neighbour's, and reports no problem.

So mark the subject with an ID and select on that:

- the page renders `data-from`, `data-to`, `data-tr` on a transition cell, `data-col`
  and `data-tr` on a matrix head, `data-role` on an actor, `data-id` on every linked id;
- the check queries those attributes and compares **ids with ids** — the cell's
  `data-tr` against the export's transition id, the header's `data-col` against the
  state id in the export;
- and the expected value is read from the EXPORT, never re-derived by the check. A
  check that re-implements the page's parsing asserts that the page parses the way
  the check parses, and both can be wrong together — the page's trigger reading and
  the check's own trigger stripping were the same code twice.

**The same rule covers the page's own reading of a document cell.** The page may show
a cell; it may not work out what the cell meant. A trigger cell that names its
command by code and by name is read as the NAME, and the exporter ships the name, so
the page strips nothing. A cell that marks a rule as not expressible is recognised by
a BOOLEAN the exporter ships, not by the marker's wording — because a marker read as
words is not an absence, it is nonsense. A cell that lists ids as a range is resolved
by the exporter, so the page reads ids. Every one of these is the same rule: the
document's structure is interpreted once, by the code that owns it, and the page
draws what it is given.

**Embed the data in the file, and read it from there — never fetch it.** A `fetch()`
of a sibling file is blocked when the HTML is opened from disk (`file://`), which is
exactly how a reviewer will open it, and the failure is quiet: the page still renders,
with the data-driven view empty. Put the JSON in a script block inside the HTML — see
*Load the computed data, do not hand-copy it* for the block and the parse. A reader
who asked "why isn't the data in the page?" is asking because they did not find it;
it has to be visibly there, in the file, not fetched from beside it.

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

**Hide every section by default, and make the CSS and the JS name the same class.**
This is the one defect that leaves a page looking finished while its primary content
is gone. If the stylesheet hides `section.on` and the script toggles a different
class, no section ever gains the class the stylesheet watches: every section keeps
its default `display`, all of them stack, and the panel holding the graph is pushed
below the fold by the panels after it. The nav still highlights a tab, the header
still shows the counts, the page looks alive — the diagram is simply not on screen.
Write the rule so the DEFAULT is hidden and the one class reveals:

```css
main>section{display:none}
main>section.on{display:flex;flex-direction:column;gap:11px;flex:1 1 auto;
                min-height:0;overflow:hidden;padding:12px}
```

and toggle that same class from the script.

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

**A state cell that names SEVERAL states resolves to none of them.** A destination
written as "Credit / Allowance Approver and/or HR" names more than one state, so the
transition's landing point is not determined by the document. Resolve a cell to a state
only when EXACTLY ONE state of THAT machine matches — scope the match to the machine
the row belongs to, or a role name that appears in two machines' state tables picks the
wrong one. Zero matches and two matches are both "unstated": route the edge to the
dashed marker, and let the marker carry the cell's own text so the reader sees what
the document actually said.

**A pseudo-state is not a state.** A cell marked "(initial)" is a position in the
flow, not a state of the machine. Draw it as its own start marker above the grid
rather than as a box in the grid, and route into it the way you route into any
node.

## Route edges through gutters no box occupies

Per-edge tuning does not scale: a `bow` hint or a `via` waypoint list fixes the edge
you looked at, and the next layout change re-breaks the ones you did not. Make the
crossing structurally impossible instead — put the boxes in columns and give the
diagram **gutters that no box can occupy**, so every edge has a corridor that is empty
by construction:

- a same-column edge runs down that column's OUTER gutter;
- a cross-column edge runs in the gutter BETWEEN the two columns, entering and leaving
  on the gutter-facing sides of the boxes;
- a self-loop pokes into its column's outer gutter, within the row's own band;
- an edge whose far end is not a box runs down the outer gutter and then along a band
  BELOW the grid — the horizontal run is below every box, so it cannot cross one.

Give each corridor a lane number so parallel edges fan out instead of lying on top of
one another.

**Fit the canvas to what was drawn.** Compute the diagram's bounding box after the last
element is in the DOM and set the `viewBox` from it — but measure the **geometry**,
not the rendered text:

```javascript
const boxBB=gNodes.getBBox(), edgeBB=gEdges.getBBox();
const x=Math.min(boxBB.x,edgeBB.x), y=Math.min(boxBB.y,edgeBB.y);
const w=Math.max(boxBB.x+boxBB.width,edgeBB.x+edgeBB.width)-x;
const h=Math.max(boxBB.y+boxBB.height,edgeBB.y+edgeBB.height)-y;
if(w>0){
  const pad=18;
  svg.setAttribute("viewBox",(x-pad)+" "+(y-pad)+" "+(w+2*pad)+" "+(h+2*pad));
}
```

This makes "something is drawn outside the canvas" impossible rather than something
the label solver has to avoid: the canvas is defined as whatever was drawn. The
`width>0` guard matters — `getBBox()` on an element that is not being rendered returns
zeros, and a zero-width box silently replaces the real viewBox with a wrong one. The
panel holding the diagram lives in a tab that is hidden until it is selected, so
measure while the panel is on screen.

**Measure the extent from the geometry, NEVER from the rendered text.** A text
element's box grows as its font grows, so measuring the extent with the labels in it
— and then growing the labels to a fixed screen size — inflates the drawing without
bound. The viewBox reached 22,562 units and the diagram collapsed to 7% scale, from
a loop that was converging perfectly. The labels sit ON the edges, so the edges'
extent already covers them; take the extent from the box and edge groups alone.

## Label collision is the hard part

Straight-line midpoints collide badly — four labels landed on the same pixel in a
first pass. Compute the anchor from the **actual curve**, then place each label at a
candidate point on its own curve that clears the boxes and the labels already
placed (see *Prefer another point ON the curve* below). A separation sweep is the
fallback for the labels that find no clear point, not the first thing to try:

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
the font is not a CSS-only change — it reaches into the layout maths. **Measure the
width instead of estimating it** (see *Do the collision maths in SCREEN pixels*), and
do the comparison in screen pixels, because that is the space the reader reads in.

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

### Prefer another point ON the curve over pushing the label away

A label moved off its edge into open space inflates the drawing's extent, and a
diagram scaled to fit its panel then shrinks — the layout fights itself, and the
tighter the fit the more the labels wander. Try candidate points **along the curve**
and take the first that clears the boxes and the labels already placed:

```javascript
const FRACTIONS=[0.5,0.42,0.58,0.34,0.66,0.26,0.74,0.18,0.82,0.1,0.9];
for(const f of FRACTIONS){
  const pt=path.getPointAtLength(L*f);
  const l={e,x:pt.x,y:pt.y,w:w,h:h};
  if(hitsBox(l) || hitsLabel(l)) continue;
  spot=l; break;                       // first clear point wins
}
```

Only fall back to the midpoint when nowhere on the curve is clear, and then let the
sweep resolve it.

### Do the collision maths in SCREEN pixels

The text is sized in screen pixels, so a label's size **on the screen** is what the
reader sees. Multiply the diagram coordinates by the scale and compare there — a
comparison made in diagram units compares a label's true size against a scale it
does not share, and lets labels overlap that the reader can plainly see.

**Measure the width, do not estimate it.** A hidden span carrying the same font
gives the real width:

```javascript
const measure=document.createElement("span");
measure.style.cssText="position:absolute;left:-9999px;top:0;visibility:hidden;white-space:pre";
document.body.appendChild(measure);
function labelWidthPx(txt){ measure.textContent=txt; measure.style.fontSize="11px";
  return measure.getBoundingClientRect().width+4; }
```

A per-character estimate is wrong for every string it was not calibrated on, and it
is wrong in the direction that lets the solver believe a label is narrower than it
is.

## The diagram fits its panel — it must not scroll

**A graph the reader has to scroll is a graph they cannot read.** The whole machine
must be visible at once. Scale the drawing to fit its panel rather than drawing it at
natural size and letting the panel scroll:

```javascript
svg.setAttribute("preserveAspectRatio","xMidYMid meet");
svg.style.width="100%"; svg.style.height="100%";
```

**Size the text in SCREEN pixels, not in diagram units.** A scaled diagram shrinks
its type along with everything else, so a wide machine's labels become unreadable
marks. Work out the scale the browser will apply and divide the font sizes by it, so
a label is the same size on screen whatever the diagram's width:

```javascript
const r=svg.getBoundingClientRect();
const scale = (r.width&&r.height) ? Math.min(r.width/vw, r.height/vh) : 1;
svg.querySelectorAll("text.sname").forEach(t=>{ t.style.fontSize=(12/scale)+"px"; });
```

**The scale depends on the extent, and the extent depends on the text, and the text
depends on the scale.** Measure the extent from the **geometry** — the box and edge
groups — not from the rendered text, or the loop inflates the drawing without bound.
The labels sit on the edges, so the edges' extent already covers them. See *Fit the
canvas to what was drawn*.

**Assert it in the harness, and assert it in the browser.** The diagram's rectangle
must fit inside its panel's rectangle, and the panel must not scroll in either
direction. A check that only asserts the SVG exists passes against a graph that
overflows its box by a factor of three.

**Give the graph the room.** The diagram is the one view whose content cannot be
summarised, so it earns the wider grid column — a dedicated class, not the shared
two-column ratio:

```css
.c-graph{grid-template-columns:minmax(0,2.1fr) minmax(0,1fr)}
```

### Make the column the reader needs actually wide

A reader who says "this column should be bigger" is not asking for a percentage —
they are asking for that column to stop being the one that squeezes. Three things
have to change together, because any one of them alone leaves the column narrow:

1. **The declared width must be honoured.** Under the default table layout a
   percentage on `<th>` is only a HINT: the browser hands the space to whichever
   column holds the longest unbroken text, and a cell whose text is a decoded
   sentence wins every time. `table-layout:fixed` makes the declared widths the
   widths — and **scope it to the table that needs it** (see *Scope a layout fix to
   the table that needs it*), because applied everywhere it breaks the tables that
   declare no widths at all.
2. **The id column must not break.** A handle is one token; `white-space:nowrap`
   on the id cell stops `Q-001` shattering into three lines in a narrow column.
   The opposite risk needs `overflow-wrap:anywhere` on the cells, so a long token
   in a narrow column wraps instead of overflowing the table.
3. **The panel must be wide enough for the table.** Two panels side by side give
   each half the width; if the question needs room, the question's panel takes the
   larger share of the grid, and below a viewport threshold the panels stack
   instead of competing:

```css
.c-wide{grid-template-columns:minmax(0,1.9fr) minmax(0,1fr)}
@media (max-width:1150px){ .c-2,.c-wide,.c-3,.c-graph{grid-template-columns:minmax(0,1fr)} }
```

**Measure the columns, do not judge them by eye.** A screenshot shows a table that
looks cramped and one that looks fine; only the rendered widths say which:

```javascript
[...tbl.tHead.rows[0].cells].map(t=>({t:t.textContent.trim(),
                                        w:Math.round(t.getBoundingClientRect().width)}));
```

A column only marginally wider than the next one is not "bigger". Assert that the
widest column is the one the reader asked for, and that the id column still holds
its token on one line.

### One table component, and columns that hold still

A table that reshapes itself when the reader filters it is a table the reader loses
their place in. Two different things move the columns, and both have to be fixed:

1. **The layout.** Under `table-layout:auto` the browser hands the space to whichever
   column holds the longest unbroken text, and that set changes as rows come and go.
   Percentages on `<th>` are only hints. `table-layout:fixed` makes the declared
   widths the widths.
2. **The scrollbar.** The panel's vertical scrollbar appears and disappears with the
   height of the content, so the content box — and every column in it — grows by a
   pixel or two on every filter. `scrollbar-gutter:stable` on the scroll container
   reserves the gutter, so the content width does not depend on the content height.

Make it one component rather than a call per table, so the contract cannot drift:

```javascript
function DataTable(host, spec){
  host.innerHTML="";
  const tbl=el("table"); tbl.id=spec.id;
  const cols=spec.columns;
  if(cols.some(c=>c.w)) tbl.style.tableLayout="fixed";
  // …thead from cols, tbody from spec.rows, then captureOrder + makeSortable
}
```

**Every table declares every column's width.** That is what makes fixed layout safe
everywhere: the earlier reason to scope `table-layout:fixed` to one table was that
fixed layout honours declared widths literally and a table declaring none broke.
A component whose contract is "every column has a width" removes the exception — the
scoping is no longer needed because there is no table without widths.

**The value must fit the width it was given.** A column declared at 7% that holds
"not checkable" is a column whose content overflows into its neighbour or wraps into
three lines. When a column is too wide for its content, shorten the CONTENT, not
the column: "not checkable" becomes "unchecked" — one word, and it matches the
column's own heading — and the full reason moves into the pill's `title`.

**The filter labels and the column values must speak one vocabulary.** A column
headed "Checked" whose cells read "checkable", beside a filter reading "Checkable /
Not checkable", describes one thing in two words, and the reader has to work out
that they are the same thing. Pick one pair and use it in both places.

**Assert that filtering does not move a column.** Measure the header cells' widths,
apply a filter that removes rows, measure again, and require them to be identical —
pixel for pixel, not "roughly". And measure on a table that is on screen: see the
measurement trap below.

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
main>section{display:none}                    /* hidden by default — see Structure */
main>section.on{display:flex;flex-direction:column;gap:11px;flex:1 1 auto;
                min-height:0;overflow:hidden}
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

**The nav strip must keep the ACTIVE tab on screen.** A strip that scrolls
horizontally is fine — but if the tab the reader is on has scrolled out of view,
the reader cannot tell which view they are looking at, and the strip's own
scrollbar becomes the only clue. Scroll the active tab into view when it is
selected, and shorten the labels before the strip outgrows the viewport:

```javascript
function showTab(id){
  const b=nav.querySelector("button[data-t='"+id+"']");
  if(!b) return;
  nav.querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b));
  document.querySelectorAll("main>section").forEach(s=>s.classList.toggle("on",s.id==="t-"+id));
  b.scrollIntoView({block:"nearest", inline:"nearest"});   // keep the active tab visible
}
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
<label class="chip cb"><input type="checkbox" id="tDef"><span>Defects</span></label>
```

```css
.chip.cb input{appearance:none;width:15px;height:15px;border:1.5px solid #98a2b3;
  border-radius:3px;background:#fff;display:grid;place-content:center}
.chip.cb input:checked{background:var(--accent);border-color:var(--accent)}
.chip.cb input:checked::after{content:"";width:9px;height:9px;background:#fff;
  clip-path:polygon(14% 44%,0 65%,50% 100%,100% 16%,80% 0,43% 62%)}
```

The `cb` class is what keeps the checkbox square while the radio — the default —
stays round. One rule for every chip gives the two input types the same shape, and
the control no longer says what it does.

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

**The chip shape must match the input type — in BOTH directions.** A radio rendered
with the square-and-tick shape reads as a checkbox before anything is clicked, and
the reader's first click then does not behave the way the shape promised. Style the
two input types separately rather than one rule for every chip:

```css
.chip input{appearance:none;width:15px;height:15px;border:1.5px solid #98a2b3;
  border-radius:50%;background:#fff;display:grid;place-content:center;flex:0 0 auto}
.chip input:checked{background:var(--accent);border-color:var(--accent)}
.chip input:checked::after{content:"";width:7px;height:7px;background:#fff;border-radius:50%}
/* a checkbox is a checkbox: square, with a tick */
.chip.cb input{border-radius:3px}
.chip.cb input:checked::after{content:"";width:9px;height:9px;background:#fff;border-radius:0;
  clip-path:polygon(14% 44%,0 65%,50% 100%,100% 16%,80% 0,43% 62%)}
```

**Two independent radio groups in one toolbar read as ONE list of checkboxes.** The
findings view filters by kind AND by probe verdict; two radio groups side by side,
undifferentiated, look like a row of boxes the reader may tick several of — and the
reader cannot see that the two choices are ANDed. Put each group in its own labelled
container so the grouping is visible before anything is clicked:

```html
<div class="grp"><span class="glabel">Kind</span>
  <label class="chip"><input type="radio" name="fk" value="def"><span>Confirmed defect</span></label>
</div>
<div class="grp"><span class="glabel">Reachability probe</span>
  <label class="chip"><input type="radio" name="fp" value="REPRODUCED"><span>Reproduced</span></label>
</div>
```

Assert both the input type and the group count in the harness — a control whose type
changed from radio to checkbox, or a group that lost its label, is invisible in a
screenshot.

**Derive the filter set from the data, not from memory.** The glossary carried six
statuses but only three had a button, so a term whose status read "Partial" had no
way to be filtered to — the status was visible in the table and unreachable as a
filter. Enumerate the distinct values the field actually takes and give each one a
control; then assert the counts match the data.

**The status column's wording varies; classify it rather than listing it.** A
document that writes "Defined (partial)", "**Undefined**", "**Undefined / Overloaded**
— see F-09" and "Defined (partial) — **Pending** (W4)" has no small set of literal
values to enumerate, and a filter built from the distinct strings is unusable. Derive
the categories from the leading state each value carries, and use the category for
the chip's COLOUR and for the filter's labels:

```javascript
function glStatusKind(s){
  const t=String(s||"").replace(/\*/g,"").trim();
  if(/^Undefined/i.test(t)) return "Undefined";
  if(/^Pending/i.test(t)) return "Pending";
  if(/Defined \(partial\)/i.test(t)) return "Partly defined";
  if(/Overloaded/i.test(t)) return "Overloaded";
  if(/^Defined/i.test(t)) return "Defined";
  return "Other";
}
```

**Say the status ONCE — the chip carries the document's own word, and the note beside
it is preserved.** The obvious rendering shows the category in the chip and the
document's raw cell beside it: a `Partly defined` chip next to `Defined (partial)`.
Two labels for one status is noise, and the reader cannot tell which one the document
actually wrote. Split the cell at its first em dash — the status word, then a note —
and give the chip the document's own word:

```javascript
function splitStatus(s){
  const raw=String(s==null?"":s);
  const i=raw.indexOf("—");
  if(i<0) return {word:raw.trim(), note:""};
  return {word:raw.slice(0,i).trim(), note:raw.slice(i+1).trim()};
}
// chip: the document's word, coloured by the category
// note: the rest, linkified like every other cell
```

The note is where the document's qualifications live, and **the ids in it are links**:
`Defined (partial) — start point Conflicting, see F-03` renders as a `Defined
(partial)` chip followed by "start point Conflicting, see [the finding's name]", with
`F-03` in the link's hover hint. Route the note through the same `cell()` pipeline as
every other cell, or the ids in it reach the reader as bare handles.

**Split at the FIRST em dash, and let the note keep the rest of the meaning.** A
status like `Defined — **Overloaded** with TERM-046` puts a second status word in
the note. Splitting at the first dash leaves the chip reading `Defined` and the note
reading `Overloaded with [Credit application]`, so the overload survives — a naive
split that took the whole cell for the chip would have dropped it.

The category still has a home: the chip's colour, and the filter's labels. Assert
that each status cell carries exactly one chip, that the chip's text is the
document's own word, and that the status is not written twice in the cell.

### Name the thing the reader recognises, and keep the id as a handle

A machine has a human title ("Application stage lifecycle") and an identifier
("SM-001"). The reader recognises the title; the id is a handle for cross-references.
Show the title **in bold** and the id in the regular face, and never the reverse:

```html
<span class="mtitle">Application stage lifecycle</span> <span class="mcode">SM-001</span>
```

Style those classes globally, not scoped to one container — `.chip .lab` styles the
label inside a filter chip and nothing else, so the same label inside a table cell
silently renders in the inherited weight. A rule scoped to the container you happened
to be looking at applies nowhere else.

Apply the same rule inside the diagram: the node's **name** is bold and its **id** is
regular, not the other way round.

### Chips, labels and folded lists

**A filter chip's label carries the NAME and the COUNT — never the identifier code.**
A catalogue filter that reads "SRC · Source (8)" shows the reader a namespace prefix
they did not ask for; the prefix belongs to the records, not to the filter. Put the
series' name on the chip and the record count UNDER it, so the chip reads "Source"
with "8" beneath:

```html
<label class="chip"><input type="radio" name="catk" value="SRC">
  <span class="catlab"><span>Source</span><span class="catn">8</span></span></label>
```
```css
.catlab{display:flex;flex-direction:column;line-height:1.25}
.catlab .catn{font-size:10px;color:var(--dim)}
```

**One control, one look — build the same chip from one function.** When two tabs filter
by the same thing, the chips must be the SAME control, not two that resemble each
other: the reader learns the shape once. Build them in one function that takes the
host and the state, so a change to the chip lands in both places, and a reader who
switches tabs finds the same control rather than a subtly different one.

**A long list in a detail panel folds into a disclosure.** A state can name seven
invariants, and a row that always takes that space pushes the rest of the panel down.
Fold it: a `<details>` whose summary names the list, collapsed by default, with the
items inside. Assert the disclosure exists, that it starts closed, and that opening it
reveals the items.

**The folded text is the document's own sentence, and a RANGE is not expanded.**
"INV-001…INV-011 as in Draft" is a range the document wrote; expanding it into eleven
ids invents invariants the document never gave that state. Show the sentence as it
stands, with the ids it names as links.

### Decode an id into words, and make the words a way in

The document's cells are full of handles — `VO-004`, `ENT-007`, `ST-001`, `AGG-001` —
and a handle in a cell tells the reader nothing. Every id the export carries an id
for gets the name it stands for, and every mention of that id in the page becomes a
link that says what it means.

**Index every id once, with its name and the tab that holds it.**

```javascript
const IDX = {};
function indexId(id, name, series, tab, title){ IDX[id] = {id, name, series, tab, title}; }
(D.catalogue||[]).forEach(e => indexId(e.id, e.name, e.kind, "catalogue"));
STATES.forEach(s => indexId(s.id, s.name, "State", "machines"));
```

**The catalogue is FLAT: one record per identifier, each carrying the series it belongs
to.** A nested catalogue — a record per series, each holding its own entries — makes the
page flatten it before it can render, and two flattenings can disagree about what a
series holds. The export's shape here and the page's reader of it are one decision, not
two, and a checker left reading the old shape reads an empty catalogue.

**Rewrite only the TEXT between tags.** An id inside an attribute — an `href`, a
`title` — must not be rewritten, or the attribute is corrupted and the link points
nowhere. Split the HTML on its tags and touch the text segments only:

```javascript
function linkify(html){
  return String(html).split(/(<[^>]*>)/).map(part =>
    part.charAt(0)==="<" ? part : part.replace(ID_RE, m => {
      const d = IDX[m]; if(!d) return m;
      const label = d.name ? d.name : d.id;
      const hint  = d.title && d.title !== d.id ? d.id+" — "+d.title : d.id;
      return '<a class="idlink" href="#'+esc(d.id)+'" data-id="'+esc(d.id)+'" title="'+esc(hint)+'">'+
             '<span class="idname">'+esc(label)+'</span></a>';
    })).join("");
}
```

**Route every cell through ONE pipeline** — escape, markdown emphasis, then link.
When some cells call `esc()` and others `q()`, the same id renders as a bare token in
one place and as a named link in the next, and the reader cannot tell whether the
difference means anything. One function, used everywhere:

```javascript
function cell(t){ return linkify(q(t)); }
```

**The link shows the NAME; the handle lives in the hover hint.** The reader is
reading a table of rules, and a column of `VO-004` is a column of noise: the handle
is something they match against the document, not something they read. So the
link's text is the decoded name alone, and the id goes in the `title`, which is
what appears when the reader hovers:

```javascript
const label = d.name ? d.name : d.id;
const hint  = d.title && d.title !== d.id ? d.id+" — "+d.title : d.id;
return '<a class="idlink" href="#'+esc(d.id)+'" data-id="'+esc(d.id)+'" title="'+esc(hint)+'">'+
       '<span class="idname">'+esc(label)+'</span></a>';
```

Carry the full text in the `title` for a name too long to show, and truncate the
visible part. **Assert the shape**: the link's text must not START with the id, and
the `title` must start with it.

**A named chip is a different thing from a named link.** In a filter chip the title
is bold and the id sits in the regular face — the chip is a legend for a control,
and both parts are read. In a link the id is a citation, and it belongs in the
hint. Do not apply one of these rules to the other.

**Put the underline under the NAME, not under the whole anchor.** A `border-bottom`
on the anchor draws the rule under a small mono id as well, and at that size it
reads as a strikethrough — the id looks deleted rather than cited.

```css
a.idlink{text-decoration:none}
a.idlink .idname{color:var(--accent);border-bottom:1px solid rgba(37,99,235,.4)}
```

**Match only the document's own id scheme.** A document may quote its own handles
(`D17`, `R1`, `OQ-07`, `Q10`) beside the scheme it defines; those are not in the
scheme, and rewriting them into links sends the reader to a target that does not
exist. Anchor the pattern on the scheme's prefixes.

**The replacement text is NOT rescanned, and that is what keeps the markup valid.**
A decoded name can itself contain an id — "Application (candidate root: ENT-001)" —
and that id must stay plain text: an anchor nested inside an anchor is invalid HTML
and the browser flattens it, silently losing one of the two links. Because the
replacement is inserted after the scan, the inner id is never rewritten, which is
exactly right. Do not "fix" this by re-running the linkifier over its own output.

**A link to an id must be a way IN.** Clicking `ST-001` opens the tab that holds it
and selects the target — the node for a state, the edge for a transition, the row for
an invariant — and clears any filter that would have hidden it. A link that only
changes the colour teaches the reader that the ids are decoration, and the second
time they meet one they will not click it.

```javascript
function gotoId(id){
  const d = IDX[id]; if(!d) return;
  showTab(d.tab);
  if(d.tab==="machines"){ setMachine(ownerOf(id)); selState=id; drawMachine(); }
  else { renderTab(d.tab); highlightRow(d.table, id); }
}
```

**Give the catalogue a tab of its own.** The definitions the document issues — its
sources, entities, value objects, aggregates, bounded contexts, commands, events,
policies, scenarios — are a set the reader browses and links into from everywhere
else. Give them a series filter (derived from the data, with the counts) and a detail
panel that carries the document's own breakdown (an aggregate's aspects, a scenario's
labelled parts), not a flattened paragraph. Assert the catalogue table's row count
against the export, the way the glossary's is asserted.

**Check the catalogue against the document mechanically.** `scripts/check-id-catalogue.js`
does it in one command — `node scripts/check-id-catalogue.js <page.html> <document.json>`.
It reads the document's own ID registry for the series it issues, then reports a
series the catalogue lacks, an empty series, an entry with no name to decode into,
and an id the document never issued. A series the export omits is silent: nothing
errors, the page renders, and every id of that series reaches the reader as a bare
handle they cannot decode.

**The check asks whether the page can DECODE an id of the series, not whether one
particular array lists it.** The page's id index covers the catalogue AND the records
the export carries beside it — states, transitions, invariants, findings, questions,
machines — so `ST-001` decodes to the state's name even though no catalogue series
lists the `ST-` prefix. Checking the catalogue array alone reports a series as bare
when the page renders it perfectly well, and pushes the reader toward the wrong
repair: duplicating the machine's states into the definitions catalogue. Decide
deliberately which list owns the series that live in their own tabs, and make the
page's index and the catalogue agree about it.

### Selection must be visible

Clicking a node that changes only the side panel leaves the reader unable to tell
which node they picked — the diagram looks exactly as it did, so the detail panel
appears to describe an arbitrary node. Give the selected node a distinct fill AND a
distinct stroke weight, and re-render the diagram on selection so the mark survives:

```javascript
const g=box(gNodes,p.x,p.y,p.w,p.h, s.id===selState ? "sel" : "");
```
```css
.nbox.sel rect{fill:#dbeafe;stroke:#2563eb;stroke-width:2.4}
```

Assert the difference numerically — compare the selected node's computed fill and
stroke width against an unselected node's. "One element carries the `sel` class" is
not enough: the class can be applied and the style can be missing.

### The selected EDGE must be accented too, and the accent must survive scaling

A selected node whose neighbouring edges all look the same leaves the reader unable
to trace the transition they picked. Give the edge a halo of the accent colour drawn
**beneath** it, and keep the edge's own kind colour and dash pattern — a selected
defect is still dashed red. Dim the other edges and their labels so one thing is lit
against the rest:

```css
path.edge.sel{stroke-width:3.4;vector-effect:non-scaling-stroke}
path.edgehalo{fill:none;stroke:#2563eb;stroke-width:9;opacity:.30;
  stroke-linecap:round;vector-effect:non-scaling-stroke}
text.elabel.sel{fill:#1d4ed8;font-weight:700}
```

`vector-effect:non-scaling-stroke` is what makes the accent usable. A diagram with
twenty transitions is drawn small to fit its panel, and a halo that scales with the
drawing vanishes — the accent has to be a fixed number of **screen** pixels at any
zoom. Assert `vectorEffect` in the harness, not just that a class is present.

### Selecting a state dims the other states AND the transitions that do not belong to it

The reader is asking "what does this state reach?", and the answer is legible only
when everything else recedes. Dim the unselected boxes and the edges that do not
touch the selected state.

**Judge belonging by the edge's DRAWN ends — the state it leaves and the state it
enters.** A transition's From cell may name several states ("ST-001 Draft, ST-002,
ST-003, ST-004, ST-005"): the transition may fire from any of them, and the engine
resolves all five. But the diagram draws ONE edge from one of them, and that edge is
what the reader is looking at. An edge that does not touch the selected box must dim,
even when the transition's cell names the selected state somewhere in a list.

**The list and the picture answer different questions, and both are right.** With
ST-001 selected, the outgoing list shows six transitions — including the one whose
From cell names ST-001 among five — while the drawn edge for that transition leaves
ST-005 and is dimmed. The list is the document's truth about what may fire; the dim
is the picture's truth about the edge in front of the reader. Do not force them to
agree by dimming from the cell's id list: that dims an edge which visibly leaves the
selected state, which is worse than either reading alone.

**Assert the dimming against the GEOMETRY, not against a second copy of the rule.**
A check that re-derives "which transitions touch this state" from the export's cell
texts agrees with the implementation whenever the implementation reads the cells too
— so it passes against the bug. Read where each edge is actually drawn:

```javascript
const sel = document.querySelector("#sm .nbox.sel");
const r = sel.querySelector("rect").getBBox();
const touches = (p) => {
  const L = p.getTotalLength();
  return [p.getPointAtLength(0), p.getPointAtLength(L)].some(pt =>
    pt.x >= r.x-2 && pt.x <= r.x+r.width+2 && pt.y >= r.y-2 && pt.y <= r.y+r.height+2);
};
for (const p of document.querySelectorAll("#sm path.edge")) {
  if (touches(p) && p.classList.contains("dim")) bad.push(p.dataset.id + ": dimmed but touching");
  if (!touches(p) && !p.classList.contains("dim")) bad.push(p.dataset.id + ": not dimmed but not touching");
}
```

### Clicking the empty canvas unselects

A selection the reader cannot clear is a selection they are stuck with. Catch the
click on the SVG itself and check the target, so a click that landed on a node or an
edge still selects:

```javascript
svg.onclick=(ev)=>{
  if(ev.target!==svg && ev.target!==gAll) return;   // a node or edge handled it
  if(!selState && !selTransition) return;
  selState=null; selTransition=null;
  drawMachine(); showMachine();
};
```

Selecting a node clears the selected edge and vice versa: they are two views of one
selection, and leaving both lit says the reader picked two things.

**Clear the selection when the SUBJECT it belongs to changes.** A state id names a
state of ONE machine, so a state selected in machine A means nothing in machine B —
and the dimming rule, which asks "does this edge touch the selected state?", then
finds no edge that does, so EVERY edge in the new machine dims. The reader
switched machines and got a grey picture with no way to tell why. Clear the
selection in the one function that changes the machine:

```javascript
function setMachine(id){
  curMachine=id;
  selState=null; selTransition=null;      // a selection belongs to one machine
  syncMachineChips(id);
  drawMachine();
}
```

Assert it: select a state in machine A, switch to machine B, and assert that no
node carries the selected class AND that nothing carries the dim class. The dim
assertion is the one that catches the bug — a surviving selection dims the whole
new diagram, and every element is still on screen.

### A selected state needs its relationships

The detail panel for a state is not a description of the state; it is the state seen
from both sides. Give it two sub-tabs — **Incoming (n)** and **Outgoing (n)** — over a
mini table of transition, trigger, actor and guard, and let each row open that
transition's own detail:

```html
<div class="dtabs">
  <button data-st="incoming">Incoming (5)</button>
  <button data-st="outgoing">Outgoing (4)</button>
</div>
```

Give the panel a way back — a link to the machine overview and to the state you came
from — because a detail panel with no exit leaves the reader with no way back to the
thing they were reading.

### Every section the export carries needs a view

The ubiquitous language is not an appendix. If the export carries the glossary, the
page needs a **Glossary** tab for it, with the terms, their definitions, their status
and their evidence — and a filter over the status column. A reader who cannot find
the glossary assumes the analysis skipped it, and the terms are the vocabulary the
whole rest of the page is written in.

Assert the glossary table holds every term the export carries, the same way the
transitions and invariants tables are asserted: a view that shows fewer rows than the
data has is the defect the reader sees as an incomplete analysis.

**A section that is EMPTY today still needs a view.** The export carries the
**divergences** (two readings of the same rule, and the path that produced each) and
the **executable gaps** (transitions the model could not execute, and why). A page
that renders neither shows nothing wrong while both are empty — and the day one of
them is not empty, the page drops it silently, because there was never a view to
hold it. The export's own requirement is that the reader can weigh the silence, so
the page needs somewhere to show the gaps and the divergences.

**Assert the coverage MECHANICALLY, and do not let an empty array make the assertion
vacuous.** A check of the form "the divergences table's row count equals
`export.divergences.length`" passes against a page with no divergences table at all,
because zero equals zero. Assert the VIEW exists, and assert it says so when the
data is empty:

```javascript
const tab = document.querySelector("#nav button[data-t='divergences']");
if (!tab) return ["the export carries divergences and the page has no view for them"];
tab.click();
const panel = document.querySelector("#t-divergences");
if (!panel || !panel.textContent.trim()) return ["the divergences view is empty"];
```

The same rule covers every section the export carries: assert that the page has a
view for each one, then that the view holds all of it.

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

**Scope a layout fix to the table that needs it — or give every table widths.**
`table-layout:fixed` was needed so an expansion cell could not claim its max-content
width and drag the table past the page — but applied to every table it broke the
others, because fixed layout honours declared column widths literally and some tables
declare more than their narrow container holds. The fix that removes the exception is
to make every table declare every column's width, through one table component; then
fixed layout is safe everywhere. Fix the table with the defect first, then re-measure
every other table. See *One table component, and columns that hold still*.

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

**The export carries the model's coverage, not just its counts.** A reader who sees
"12 of 48 invariants checked" can tell what the model did and did not reach. So the
export carries, beside the numbers: which invariants were **checkable** and which were
not, and **why** they were not (the document marks a condition "not expressible" — the
reason says whether the specification does not model it or the analysis did not reach
it); the **executable gaps** — transitions the model could not execute, and why; the
**divergences**, each with the two readings and the path that produced them; and for
every transition, the guard and effect expressions it was built from.

**The export groups what the page groups.** Three groupings, and the page renders them
as three views rather than recomputing them:

- **per machine** — how many reachable states, and how many violate;
- **per machine state** — the same, broken down by the state each machine is in. This
  is the grouping a reviewer actually reads: "of the states where the application is
  in Draft, how many break a rule" is a question; one total for the machine is not;
- **per invariant** — for each invariant that was violated: the number of states it
  fails in, the reason it fails, the evidence, and ONE worked example path. Not the
  per-state dump: a per-invariant entry with a count and an example is what fits in a
  page, and a page listing thousands of states lists the same defect thousands of
  times.

**Carry the unchecked invariants as their own list, never folded into the violations.**
They are a different claim — the model could not look there — and a page that merges
them says the specification breaks rules it never states. The page must be able to
render the coverage beside the findings: "12 of 48 invariants checked" next to "4
violations", with the 12 readable rather than inferred from the 4.

**Say in the export which violations the exploration bound accounts for.** A traversal
that edits one field at a time reaches states where the form is half filled, and an
invariant about a completed form fails in every one of them — a count that is a
property of the bound, not of the specification. The export carries the note, so the
page states it rather than letting the reader infer a defect from every number it
shows.

**A page that shows only the findings hides the coverage.** If half the invariants were
never checked, a table of violations reads as "the model found nothing wrong" when it
means "the model could not look". Render the checkable count beside the violation count,
and render the gaps, so the reader can weigh the silence.

**Two copies of the data means two copies to drift.** Once the export lives inside the
HTML, the standalone `.json` on disk is a build artifact, not a runtime dependency —
re-running the exporter without re-inlining leaves the page serving stale figures with
no error at all. Say in the file's own comment how to regenerate both, and make the
regeneration a single command.

### The export and the page have a WRITTEN contract

The export JSON is the only thing the engine and the page share. Every other rule the
page obeys is written down — in this file, and in the assertions in the harness — but
that one interface is where a rename goes unnoticed: the page reads `D.x`, the export
carries `x`, and nothing connects the two names. **The contract is the gap.**

**Put a schema version and a required-field list in the export.** The export states
which shape it is, and the page states which shape it expects:

```json
{"schemaVersion": 2, "requiredFields": ["machines","states","transitions","invariants",
 "findings","glossary","violations","uncheckedInvariants","catalogue"],
 "machines": [...], ...}
```

**The page must assert the contract ON LOAD, and fail loudly.** A page that reads a
field the export no longer carries renders an empty table — no error, no warning, and
the reader sees a complete-looking analysis with a hole in it. That is the same quiet
failure as a `fetch()` blocked on `file://`, and it deserves the same defence:

```javascript
const REQUIRED = D.requiredFields || [];
const missing = REQUIRED.filter(k => !(k in D));
if (missing.length) {
  document.body.innerHTML = '<div class="errbar">This page was built against a '
    + 'different export shape. Missing: ' + missing.join(", ") + '</div>';
  throw new Error("export contract broken: " + missing.join(", "));
}
```

**Derive what the page knows about the document FROM the export, not from a list
written by hand.** The clearest case is the id scheme — but note WHY. The prefixes
are a property of the FORMAT: the explorer defines the input document's scheme, so
every document that goes through it comes out with the same prefixes and different
content. "A second document with different prefixes" is therefore not a case the
workflow can produce, and a literal list of prefixes in the page is legitimate —
it is a statement of the format. What is NOT legitimate is writing that list again
in the engine, again in the page, and again in the checks: three copies drift, and
nothing reports it. The engine knows each collection's series — machines, states,
transitions, invariants, findings, questions — so have the export carry the
namespace as data and let the page derive its pattern from it:

```javascript
const PREFIXES = (D.idSeries||[]).map(s => s.prefix);
const ID_RE = new RegExp("\\b(?:" + PREFIXES.join("|") + ")-\\d{1,3}\\b", "g");
```

**The export carries the namespace, so the page writes no list at all** — not even the
six series that have their own tabs, which is the copy that drifts first.

The same applies to a status vocabulary, a set of tab names, and a priority list: build
the filter's options from the values the data carries, and keep a hand-written
vocabulary only for the things the export states explicitly. A filter whose buckets
are written from memory collapses into one useless bucket on the next document.

**The catalogue and the page's id index must agree about which series exist.** There
are two of them — the export's catalogue, and the page's index of every id it can
decode — and a series in one and not the other means the id is decodable but has
nowhere to be looked up. `scripts/check-id-catalogue.js` compares the page's catalogue
against the document's own ID registry; run it, and decide deliberately which of the
two lists owns the series that live in their own tabs.

**A field list is not a contract — the contract states MEANING, and the constraints
that go with the value.** A contract that says "the export carries a boolean called
`frontierExhausted`" ships the bug in which that boolean is always true: the field
exists, the type is right, the page renders it, the assertion passes. What catches it
is a stated constraint:

> `frontierExhausted` — TRUE if and only if the exploration enumerated EVERY
> reachable state. FALSE when the traversal stopped at the state cap.

So each field's description says what it ASSERTS, not what it is called, and where the
value has a condition on it, the condition is in the description rather than in the
reader's head. Describe what is not self-evident: a field called `states` needs no
gloss, a field called `violating` does. A contract whose descriptions only restate the
field names has bought presence-checking and nothing else.

**Put the contract in a FILE, and let a checker gate the build.** The contract can
live inside the export, but then the exporter writes the contract as well as the data
and the two are one edit apart from disagreeing. A separate, hand-written contract file
keeps the exporter ignorant of the page — it emits what it knows — and puts the
binding in the gate:

```
explorer/export.contract.json   the contract: fields, meanings, constraints, views
model/…/export.json              the data
        ↓  checker: required present · kinds right · record shapes · counts · views
explorer/explorer.html           the data embedded, the contract embedded
```

**The checker is the gate: an export that does not conform never becomes a page.** Run
it in the build and the build fails, naming the field. Then the page runs the same
checks on load, because a page opened from disk may predate a change, and a page that
renders a hole is worse than one that says it is broken. The two checks are the same
contract read from two ends. The checker reports by SHAPE, not by instance: one record
missing a field is a fact about the record, a thousand records missing the same field
is a fact about the shape, and the report should say which and how many.

**The contract describes the PAGE as well as the data.** Every field says which view
consumes it, or that it is for the machine only. That single annotation closes a silent
omission: a field the export carries and the page ignores is a decision nobody made,
and the day it is not empty the page drops it with no view to hold it. With the
annotation it is declared, and the checker can require that every field is either
bound to a view or marked machine-only.

**And the contract can bind the VIEWS.** A view entry names the renderer, the data it
reads, its columns with their widths, and its filters with their values:

```json
{"id":"invariants","label":"Invariants","renderer":"table","data":"invariants",
 "columns":[{"key":"id","label":"ID","role":"code","width":"5%"},
            {"key":"text","label":"Invariant","role":"name","width":"22%"}],
 "filters":[{"key":"checkable","label":"Checked","kind":"radio",
             "values":[{"value":"all","label":"All"},{"value":"true","label":"Checked"}]}]}
```

The page then has a predefined set of pages it knows how to draw, and a new field is
added by extending the contract and the renderer — not by editing a table that
hand-wrote its own columns. **The renderer stays code**: the layout algorithm, the
collision solver, the selection behaviour. The contract carries the DATA and its
description; the page carries the drawing. That split is the whole design, and a
contract that tried to describe the drawing would be describing the drawing badly.

**Widening is the point.** Adding a field to the data does not require changing the
contract's required list, and does not require changing the page: the page renders the
views it knows, and reports the ones it does not. A view whose renderer the page has
never heard of is named in the contract and missing from the page — the page must say
so, not skip it silently. That is the same rule as the empty-section rule, applied to
the page's own vocabulary.

### The contract has TWO seams, and the second one drifts too

The contract sits between the **data** and the **page**. The checker above closes the
first seam: the export is checked against the contract. But the contract also
**describes the page** — its tabs, each view's columns with their labels and widths,
its filter groups — and the page implements that description in code. Nothing compared
those two, so they drift exactly as the data did: a column added to the page and not to
the contract, a label reworded in one place, a width changed in the other, a tab renamed.
The contract then claims a page that is not the page.

**Check the contract against the page the same way you check it against the data.**
Read the page's own definitions — the tab list, each table's column declarations, each
filter's control name — and compare them with the contract's view entries:

```javascript
// the page's tabs
[...page.matchAll(/const TABS\s*=\s*\[([\s\S]*?)\];/)]
  .flatMap(m => [...m[1].matchAll(/\["([^"]+)"\s*,\s*"([^"]+)"\]/g)]
                .map(x => ({id:x[1], label:x[2]})));
// the page's table columns — read each DataTable call's columns array
{key, label, width} per column, against the contract's columns for that view
```

The comparison must be able to say *which* view and *which* column disagree, so bind
each view to the table it draws into — otherwise the check has to guess which of the
page's ten tables belongs to which view, and the guess is the checker's, not the
contract's. `scripts/check-contract-vs-page.js` does the whole comparison in one
command: `node scripts/check-contract-vs-page.js <contract.json> <page.html>`.

**A column's handle must be the DATA KEY.** The contract names a column by the
property it reads; the page's table component names it by a sort handle. When the
handle is an arbitrary label — `k:"expression"` rendering `t.guardExpression`,
`k:"kind"` rendering `g.status` — the contract has no unambiguous name for the column,
the comparison fails on a difference that is not a difference, and the reader of the
contract cannot tell which property a column shows. Make the handle the property:

```javascript
{k:"guardExpression", label:"Guard expression", w:"15%"}
```

**The contract must be checkable by a plain-JS subset, because the page has no schema
validator.** The page is self-contained and offline: it cannot carry a JSON Schema
library, so it checks the contract itself — required properties present, kinds right,
each record's required fields present, the counts the contract states. Write the
contract so THAT subset is meaningful: give every property a `type`, every record an
`items.required` list, and every stated count a place to live. A contract only a
schema library can check is a contract only the build can enforce, and the page opened
from disk has no protection at all.

**A contract describes DATA. A transform that renders the data stays in the consumer.**
The page's own decypherer — the code that reads a formal expression and renders it in
English — is the page's business, and it is live, working code. Moving it into the
exporter so the export can carry a `guardInWords` field is not contract work: it
rewrites a working consumer to satisfy a contract the consumer did not need, and it
puts a presentation concern in the data. The contract states what the data IS; the
consumer decides how to show it. When a field's only purpose would be to feed a
renderer that already works, leave it out of the contract — and say in the field's
description that the consumer does the reading.

### The export carries the RESOLVED hierarchy, not the raw cells

**The page must not parse the document's cells.** When it does, the document's
structure lives in two places — the engine's parse and the page's re-parse — and the
two drift apart. A From cell naming five states ("ST-001 Draft, ST-002, ST-003,
ST-004, ST-005") was resolved to all five by the engine and to one by the page, and
the disagreement surfaced as a transition that stayed lit when it should have dimmed.

**Resolve the structure once, in the engine, and ship the resolution.** The engine
already knows which states a cell names — by id ("ST-001 Draft"), and by the role the
machine waits on ("Sales", "Owner"), which is a different naming convention and the
engine's job too, because the model's traversal depends on it. The export throws that
away and ships the raw text; the page then re-derives it, worse. Ship both the
resolved ids and the hierarchy itself:

```json
{"id":"TR-006","machine":"SM-001","from":"ST-001 Draft, ST-002, ST-003, ST-004, ST-005",
 "to":"ST-008 Cancelled",
 "fromStates":["ST-001","ST-002","ST-003","ST-004","ST-005"],"toStates":["ST-008"]}
```

```json
"hierarchy":[{"machine":"SM-001","name":"Application stage lifecycle",
  "states":[{"id":"ST-001","name":"Draft",
             "outgoing":["TR-002","TR-003","TR-004","TR-005","TR-006","TR-010"],
             "incoming":["TR-001","TR-002","TR-003","TR-010","TR-011"]}]}]
```

The page then reads the state list, the incoming and outgoing lists, and each edge's
ends from the export. No cell is parsed in the page, and there is no second
resolution of the document's structure left to disagree with the first.

**Assert the seam.** That the export's resolved lists are present, that the
hierarchy covers every machine, and that the page's incoming/outgoing lists match the
export's hierarchy catches the drift where it happens.

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

**The checks file is the second argument, and omitting it changes what the run
MEANS.** Without it the harness runs only its four built-in checks, all of which
pass — so a run that never exercised one view of the page reports success and the
count says "4/4". Always pass the checks file, and compare the reported count with
the number of assertions in the file: a count lower than the file's length means
the file was not loaded.

```bash
node scripts/test-explorer-cdp.js docs/diagrams/onboarding-explorer.html checks.js
```

The checks file exports an array of `{name, expr}`; each `expr` runs in the page and
passes when it evaluates to `true`, or to an array of problem descriptions that is
empty. **`templates/explorer-checks.js` is a starter file** — copy it, adapt the
selectors marked ADAPT, and extend it. Writing the assertions from scratch each time
loses the ones that already caught a defect:

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
  otherwise looks fine. **Scope the scan to the cells, not the prose**: the page
  exists to display the document's own text, and a document that says "an undefined
  role blocks the authorization model" trips a whole-page text scan on its own
  wording. A leak is the JS value standing in for a field — assert on the cell's
  exact text, or on the data tables, and leave the prose alone.
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
- **exactly one section is on screen at a time** — click each tab and assert that one
  section carries the visible class and no other does. "Every tab shows content"
  passes against a page whose sections all stack, because a stacked panel has text
  too.
- **the primary panel is INSIDE the viewport** — assert its `getBoundingClientRect()`
  is on screen and larger than a minimum size. A panel can be present, populated, and
  pushed off-screen by a sibling; DOM presence is not visibility.
- **look at the whole-page screenshot, not only the diagram's crop** — a page whose
  graph is missing entirely because the sections stacked shows a perfectly good table
  where the graph should be. Every DOM assertion can pass while the primary artifact
  is absent from the visible page.
- **assert on `textContent`, not `innerText`, for text inside a closed `<details>`** —
  a collapsed element renders nothing, so its `innerText` is the empty string even
  though the text is in the DOM. `textContent` means "the text is there";
  `innerText` means "the text is visible". Use `textContent` to assert a fact about
  content and `innerText` to assert a fact about rendering, and never swap one for
  the other: the first fails against correct code, the second passes against an
  element that was never rendered.
- **compare against what the page RENDERS, not against the raw source string.** The
  cell pipeline turns the document's `**emphasis**` into real markup, so the text on
  screen is not the text in the export: a check asserting the panel shows
  `"…legal name **or** the DBA…"` fails against a page showing it correctly. Render the
  expectation with the page's own cell function and compare the result — `cell(s)` into
  a scratch element, then its `textContent`. An expression shown as a READING is the
  same case: the source sits in the element's `title`, not in its text.
- **the checks file is itself JavaScript, and a raw backtick inside it breaks it.**
  The expressions are template literals, so a backtick in a character class ends the
  literal and the file stops parsing — the symptom is a harness that fails to load,
  not a failed assertion. Write `String.fromCharCode(96)` where a backtick is needed.
- **an attribute selector with an empty value needs BOTH quotes.** `[value="]` does
  not select the control whose value is empty; the check then fails with a null
  dereference a long way from the selector that caused it. Write `[value=""]`.
- **An assertion that measures an element must put it on screen first.** A tab that
  is not on screen has a rectangle of zeros, so "the checked column is narrower than
  the widest" is true of every column in the page when nothing was measured — the
  assertion cannot fail, and a check that cannot fail is worse than no check. Click
  the nav button for the tab, assert the measured width is non-zero, and only then
  make the comparison.
- **Judge the layout at the reference viewport, not at whatever window the
  interactive browser happens to have.** The harness emulates a desktop viewport
  (`EXPLORER_VIEWPORT_W`, default 1600); an interactive browser session may run at a
  third of that, and a column that fits at 1600 genuinely clips at 750. Measure at
  the reference size before calling it a defect, and resize with
  `Emulation.setDeviceMetricsOverride` — `window.resizeTo` is unreliable in headless
  Chrome.

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

## Read an expression back in words

The page renders the document's formal rules in English, above the symbols.
`references/expression-reading.md` has the whole of it: unwrapping the document's
inline-code decoration before the tokenizer sees it, the vocabulary matcher, the
parser's precedence, the effect reader, the audit that finds every expression-bearing
field the reader never reached, and the assertions.

## Make the pending work visible

The pending tab carries the open questions, the outside dependencies, the undefined
terms, and the deferred work items. Put it in the nav like any other view — the pending
items are part of the analysis, not an appendix, and a reader who cannot find them will
assume nothing is outstanding.
