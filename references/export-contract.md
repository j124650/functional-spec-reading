# The export contract

**The seam between the verifier's exporter and the explorer page.**

The exporter analyses a specification document and writes an export. The explorer page reads
that export and shows it. Between them sits one file — the **contract** — that says what the
export carries, what each field *means*, and how the page renders it.

Three sides, each with an obligation:

| Side | Obligation |
|---|---|
| **The contract** | States every field's name, kind, meaning and use. States the identifier namespace once, for both. States the page set. |
| **The exporter** | Writes an export that conforms. A non-conforming export never becomes a page. |
| **The explorer** | Renders what the contract describes. A field it does not have renders as a reported absence, never as an empty table. |

`references/interactive-diagrams.md` states *what* the export must carry. This file states *how
that is bound*, so the requirement becomes something a machine can check rather than something
two sides must remember.

---

## Why a contract, and not discipline

Three failures happen when the two sides are held together by convention:

1. **A field is renamed.** The page reads `D.uncheckedInvariants`, the exporter writes
   `unchecked`. The page renders an empty table. Nothing fails. The reader sees "no unchecked
   invariants" and concludes the analysis was thorough.
2. **A field's meaning drifts.** The exporter writes `frontierExhausted: true` because it
   computed it by asking whether the trace contains the word "exhausted" — and the trace says
   *"the frontier is not exhausted"*. The field exists, the type is right, and the page asserts
   something false to the reader.
3. **The page quietly ignores data.** The exporter proves twenty things; the page shows six.
   The reader cannot tell the other fourteen were dropped.

A contract with **meanings**, not just names, catches the second. A contract **checked** at
build time catches the first. A contract that names every field's view catches the third.

---

## The contract file

One file, JSON Schema (draft 2020-12), extended with `x-` keywords. It is the single source of
truth for the seam, and it is read by both sides.

```
explorer/export.contract.json
```

### Where the two kinds of file live

The contract is **format-level** and the page is **project-level**, and they must not be
confused:

| | Lives with | Why |
|---|---|---|
| **The contract**, the namespace, the checkers | the skill | it says what the export carries and how the page renders it — the same for every project in this format |
| **The page**, the export, the data | the project | the page is the thing being checked; the export is that project's analysis |

So a project holds **no copy** of the contract: it resolves the skill's, the way it resolves
the checkers, and the build runs both against it. A copy in the project is a second copy to
drift — which is the fault this whole arrangement exists to remove — and it drifts silently,
because a stale contract and a conforming export still agree with each other.

The page's side of the seam is still checked the same way: the contract names the page's
tabs, columns and filters, and `check-contract-vs-page.js` compares them.

### The shape

```
$schema, $id, title, description
schemaVersion                     the version of THIS contract
type, required[]                  the properties the page cannot do without
properties{}                      every field: type, description, x-*
x-idSeries[]                      the identifier namespace
x-views[]                         the page set
```

### The conventions

**`description` states the MEANING, and only where the meaning is not self-evident.** A field
called `states` needs no gloss. A field called `violating` does:

> How many of the enumerated states fail this invariant.

A contract that only listed field names would not have caught the `frontierExhausted` bug.
Descriptions are the part that earns the file its keep.

**`x-view`** names the page that consumes the field, or `machine-only` when the page does not
render it. **Every field carries one.** A field the page ignores is then a declared decision
rather than an accident.

**`x-role`** marks the field of a record that is its `name`, its `detail`, its `evidence` or its
`code`. The page must not have to know that a glossary term's name is called `term`.

**`x-format`** says how a column is drawn (below). **`x-lookup`** says where a value comes from
when it is not a field of the record.

**`x-idSeries`** is the identifier namespace: the prefixes the format issues and what each
stands for. It is stated **here**, once, so neither the exporter nor the page writes a list of
prefixes. The page's link pattern is derived from it; the exporter's series list is derived
from the collections it parsed.

**`x-views`** is the page set: each view's renderer, the data it reads, its columns and its
filters. The explorer has a fixed set of pages and knows how to draw them; a view naming a
renderer the explorer does not have must be **reported, not skipped**.

### The catalogue is flat

One record per identifier, every record the same shape: `series`, `kind`, `id`, `name`,
`detail`, `extra`, `evidence`. The series the record belongs to travels with it.

Flat because **every view's table is over one shape**. A nested catalogue — a series, each
with its entries — makes the page flatten it before it can render, and a page that flattens
and an exporter that nests are two shapes to reconcile on every change: the flattening can
disagree with the source, and the disagreement is invisible because both produce rows.

### Counts belong to the export, not the contract

The contract declares the *namespace* — prefix, kind, and the property that carries it. The
*number* of ids in each series is a fact about the document being analysed, so it belongs in
the export, and the checker compares the export's own counts against the contract's namespace.

---

## The exporter's obligations

1. **Write an export that conforms.** Every property in the contract's `required` list is
   present, with the declared kind. Every record in every array carries the fields its
   `items.required` list names.
2. **Emit the identifier namespace** as `idSeries`, derived from the collections it parsed —
   never hand-typed.
3. **Derive, do not assert.** `frontierExhausted` is true *if and only if* the exploration
   enumerated every reachable state. A field that reports on the engine's own behaviour is the
   engine's to compute, and the engine has the truth; the contract says what the truth means.
   **Never read the boolean out of the engine's own log text.** A substring test over the
   trace is true on both branches when both branches mention the word — "the frontier *was
   exhausted*" and "the frontier is *not exhausted*" both contain "exhausted" — so the field
   was permanently true while the log beside it said the opposite, and the page repeated the
   false claim to the reader. The engine exposes a property; the export reads it.
4. **Do not put the reading in the data.** How a guard reads in English is the explorer's own
   live code. The contract carries the *expression*; the explorer carries the decypherer.
5. **The build is the gate.** The checker runs before the export is embedded. An export that
   does not conform stops the build. Give the build one documented way past the gate — a flag,
   not an edit to the build — for the case where the CONTRACT is what you are changing. A gate
   you have to disable by editing the gate gets disabled by editing the gate, and the next
   reader cannot tell it was ever on.

## The explorer's obligations

1. **Read the contract at load** and check what it needs: required properties present, kinds
   right, the counts consistent. On a mismatch, show **a banner naming the field** — never an
   empty table. Silence is the failure this exists to prevent.
2. **Render the views the contract declares**, from the contract's columns and filters — not
   from a hand-written list beside it.
3. **Report what it cannot render.** A view whose renderer is unknown, a column whose format is
   unknown: say so in the page. A field it does not know is a reason to extend the explorer,
   not a reason to hide the data.
4. **Keep its own live code.** The diagram's layout, the label collision work, the selection and
   dimming, the decypherer, the detail panels: these are the explorer's, and the contract does
   not describe them. The contract describes what the page *shows*.

---

## Columns: the format vocabulary

Every column in the contract declares how it is drawn and where its value comes from.

**Renderers** — five, and no more:

| `format` | Draws |
|---|---|
| `text` | plain, optionally bold |
| `pill` | a chip; tone and text both possibly mapped from the value |
| `status` | the chip plus the note that follows it, split at a declared character |
| `code` | the monospaced span |
| `machine` | the machine's bold title with its id in the regular face |

**Value sources** — three:

| Source | Means |
|---|---|
| `key` | a field of the record |
| `values` | a map from the field's value to `{text, tone}` — `checked`→ok, `Critical`→def |
| `lookup` | a value from another collection, matched by the record's id or by a field; with `count` for a count |

A column whose value is neither a field nor a lookup is **derived**, and says so.

**A column's key is the data key.** The contract's `key` is the property the cell reads,
and the page's column handle is the same string — not a convenient label for it. When the
two differ (`k:"expression"` rendering `guardExpression`) the contract cannot name the
column unambiguously and the checker cannot compare the two sides. The checker says so
plainly: *a column's handle must be the DATA KEY*.

**The tone and text maps live in the contract, as data.** If the pill renderer has to know that
"Critical" is red, that is per-column code and the whole arrangement collapses back into
bespoke rendering. With the maps in the contract, every pill on the page is driven by one
component.

**The linkifier is not a column format.** It is a transform applied inside every renderer that
emits text, so any cell's text has its identifier references linked automatically.

---

## Adding to the model

The contract is written to be **widened** without breaking what exists.

### Adding a field

1. Add it to the export's payload.
2. Add it to the contract's `properties`, with its meaning and its `x-view`.
3. If the page is to show it, add it to the view's `columns` with a `format`.
4. If the page is not to show it, give it `x-view: "machine-only"` — **and say so**.

Adding a field does not require changing `required`, and does not require changing the page.

### Adding an identifier series

1. Add the prefix to the contract's `x-idSeries`, with its kind and the property that carries it.
2. Emit it in the export's `idSeries`, and put its records in that property.
3. Nothing else. The page's link pattern, the link index and the catalogue are all derived.

### Adding a column

1. Add it to the contract's view, with `key`, `label`, `width`, `format` and its value source.
2. Nothing else — **if** the `format` is one of the five. A sixth format is a new component, and
   it belongs in the explorer with a test.

### Adding a view

1. Add it to the contract's `x-views`: id, label, renderer, data, columns, filters.
2. Add a renderer of that name to the explorer.
3. If the explorer does not have the renderer yet, the page **reports the view as unimplemented**
   rather than omitting it. This is the extension point: the contract can describe a view before
   the explorer can draw it, and the page says so honestly.

---

## What stays hand-written

The contract describes what the page shows. It does not describe how the page draws.

- **The state machine diagram** — layout, gutter routing, label collision, leader lines, fitting
  the panel. The contract carries the graph and the wiring; the code does the drawing.
- **Selection and dimming** — which node is selected, what dims, what an accent means.
- **The three detail panels** — the state detail, the transition detail, the catalogue detail.
- **The table component** — sorting, fixed layout, the column widths' effect.
- **The decypherer** — how a formal expression reads in English.

This is not a shortfall. The contract is the data and its description; the explorer is the
renderer. "Generated from the contract" means no hand-written code *per table* — not no code.

---

## The checks

| Check | Where it runs | What it fails on |
|---|---|---|
| `check-export-contract.js` | the build, and by hand | the export not conforming: a missing property, a wrong kind, a record missing a field, a count that disagrees |
| `check-contract-vs-page.js` | the build, and by hand | the contract and the page disagreeing: a tab, a column, a width, a control, a data property |
| `check-id-catalogue.js` | by hand | the catalogue and the document disagreeing about the identifiers |
| the CDP suite | the build | the page's behaviour regressing |

The first two read the contract and the artefact and compare them. The third reads the document
and the catalogue and compares those. The fourth asserts behaviour, and is what makes a
refactor of the page into a contract-driven page safe: **the contract-driven page must pass the
same assertions as the page it replaces.**

**The checks live in the skill, not in the project that uses them.** One implementation rather
than a copy per project — and a copy of a checker is a checker that drifts, exactly as a copy
of the contract is a contract that drifts. The project's build invokes them by path and
resolves the path from the environment, so the skill's location is a fact of the machine
rather than a path baked into the project.

**A shipped checker must work with no arguments in BOTH trees.** The contract is format-level
and ships with the skill; the page is project-level. So the contract is looked for beside the
script and the page in the working directory, and both defaults resolve: running the checker
from a project finds the skill's contract and that project's page, and running it from the
skill's own tree finds the contract and reports honestly that there is no page there. A
checker whose default path only works from one of the two is a checker the other caller has
to be taught to call with arguments — and nobody reads the help.

Run all of them. A check that is not in the loop is a check that reports a problem nobody reads.

---

## A worked example

**A new kind of term in the document: "aggregate invariant".**

1. The document format gives it a namespace: `AI-`. The contract's `x-idSeries` gains
   `{"prefix":"AI","kind":"Aggregate invariant","property":"catalogue"}`.
2. The exporter parses the new section and puts the records in `catalogue`, each with its
   `series: "AI"`.
3. The contract's `catalogue` item already carries `series` and `kind`, so nothing changes
   there. The catalogue view already filters by series, so the new terms appear.
4. The page's link pattern is derived from `x-idSeries`, so `AI-001` links without the page
   being touched.

Now the aggregate invariants must be *visible* as their own list:

1. The exporter emits them under a property, say `aggregateInvariants`.
2. The contract's `properties` gains it, with its meaning and `x-view: "open"`.
3. The contract's `x-views` gains a view for them, with columns and a format from the five.
4. The explorer gains that renderer — or, until it does, the page **reports the view as
   unimplemented**.

The exporter never learns what a tab is. The explorer never learns what a section is. Each side
knows its own, and the contract is where they meet.
