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

**And every field means EVERY field — a record's fields, not only the collection's.** A
collection-level `machine-only` says the page does not render the collection, and says
nothing about the fields inside it: they carry no `x-view` of their own, so the promises
checker never sees them and the decision is never made for them. A collection two pages
consume names both. Put the decision on the FIELD, where the reader of the contract looks
for it, and let the collection's own `x-view` name every page that touches any of it.

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

**A fixed shape has fixed slots, and what does not fit is DROPPED — silently.** Two
free-text slots cannot hold a command's actor, its effect AND its precondition; the
exporter picks two, and the third never reaches the page with nothing reporting the loss.
So check what each series' shape drops, and render the dropped material from the
collection the export already carries: the commands, the policies and the probes are
collections of their own, and the catalogue's detail panel looks the missing piece up by
id. A field present in the export and absent from the page is the same defect as a field
absent from the export — the reader is told a rule applies and is never shown it.

Flat because **every view's table is over one shape**. A nested catalogue — a series, each
with its entries — makes the page flatten it before it can render, and a page that flattens
and an exporter that nests are two shapes to reconcile on every change: the flattening can
disagree with the source, and the disagreement is invisible because both produce rows.

**The page's link index takes its label from the catalogue's `name`, and from nothing
derived.** A link must say the thing the document calls it, and the check that a link names
the thing compares the rendered NAME with the catalogue's name for that id — so the
catalogue's name and the label are one string, and when one changes the other changes with
it. **What a thing is called is decided once, in the catalogue.** A transition is named by
its trigger NAME ("Approve directly"); the command code in the cell ("CMD-027 Approve
directly") is not part of it, because the command is an identifier of its own with its own
catalogue entry — the code in a transition's cell is a cross-reference, not part of the
transition's name. Strip the code where a TRIGGER is shown; leave the id's own name alone.
A link may carry the id after the name, in its own element, and the check compares the name
element and the id element separately.

### Counts belong to the export, not the contract

The contract declares the *namespace* — prefix, kind, and the property that carries it. The
*number* of ids in each series is a fact about the document being analysed, so it belongs in
the export, and the checker compares the export's own counts against the contract's namespace.

### A field that carries two shapes gets one list per shape

A document column often means more than one thing. §15's "States / Transitions" column
holds both the states a rule holds in and the transitions it guards — and the two mean
different things, so a consumer that reads the cell's text has to work out which it is,
which is the interpretation the export exists to remove.

So a cell with more than one shape becomes an OBJECT with one list per shape:

```json
"appliesTo": {
  "states": ["ST-001", "ST-002"],
  "transitions": ["TR-017", "TR-019"]
}
```

**Two lists need no discriminator.** A consumer that wants the states reads `states`; one
that wants the transitions reads `transitions`; the page composes the cell's content from
the lists — the states first, then the transitions. A `kind` beside them is a third copy
of what the lists already say, and it is the copy that can go stale.

**Ship the document's own cell only when the page must SHOW the document's words.** When
the cell's content is composed from the resolved ids, the raw cell is dead weight — and a
raw the page can fall back to quoting is a cell the reader has to re-interpret by eye,
which puts the interpretation back into the page one level up.

**A scope that covers EVERYTHING is written out as the list it covers.** With the lists
alone, an empty list is ambiguous between "none" and "all" — so "All states" ships the
states it holds in, never an empty list that means "everywhere". The list is the states
of the machine the scope was RESOLVED against, not of every machine the rule binds to: a
rule that binds to several machines binds through one aggregate, and it is judged against
that aggregate's own machine, so enumerating the others' states overstates it.

**The flat field is REPLACED, not kept beside the object.** Two fields carrying one
cell's meaning is one more thing to keep in step, and the flat one is the one that
lies — it is called `states` while holding transitions half the time. Replace it in
the export, drop it from `properties` AND from `required`, and point the view's column
at the new data key.

**The resolution is the ENGINE's.** Where the engine already read that cell — the scope
a rule holds in, the states a transition leaves — the export carries the engine's own
result rather than resolving the cell a second time. Two resolutions of one cell agree
until one of them is changed, and the export is what the page trusts. A scope resolved
by the checker is the scope the rule was *judged by*; a scope resolved again for the
export can disagree with the judgement and nobody would see it.

**An empty list is a finding, not a null.** A scope that names something the resolver
cannot match ships an empty list, and the empty list is the honest report — a cell that
resolved to nothing used to hide inside a prose string that read like it had resolved.
A resolution that cannot match is often a word-boundary artefact ("submit" does not
match "Resubmit"), and the reader needs to see the miss.

### Removing or reshaping a field

Adding is documented above; removing and reshaping are the same edit, done in every
place the name appears:

1. Drop the property from the export's payload, and from `properties` and from
   `required`.
2. Point the view's column at the new data key, and give it the new label — a
   column's handle is the data key, so a reshaped field changes both.
3. Update the page's read site in the same pass. A page still reading the old name
   renders an empty cell, and the contract-vs-page checker is what catches it.
4. Re-run the export check, the contract-vs-page check and the CDP suite before
   reporting the change.

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
6. **Ship the engine's resolution, and never a second one.** Where the engine already read a
   cell, the export carries the engine's own result. A scope, a range, a set of names — each
   is resolved once, by the code that owns it, and the export reads it. Re-resolving a cell
   for the export's benefit puts the document's structure in two places, and they drift.

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

**A column that lists ids needs room for the longest list it will hold.** A scope column
that can carry eight state names at 13% wraps four lines deep, breaks the names inside
themselves ("Awaiting Licensing" split across lines, "CMD-006/CMD-007 Submit" split after
"CMD-"), and the row heights then come from that column rather than from the content that
needed the room. Size a list column by what it must hold, and keep a link label from
breaking inside itself.

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
| `check-contract-promises.js` | by hand | the contract pointing a field at a view the page never reads — reported, not failed |
| the CDP suite | the build | the page's behaviour regressing |

The first two read the contract and the artefact and compare them. The third reads the document
and the catalogue and compares those. The fourth reports the promises nothing keeps. The fifth
asserts behaviour, and is what makes a refactor of the page into a contract-driven page safe:
**the contract-driven page must pass the same assertions as the page it replaces.**

**An assertion may not forbid what the document actually says.** The export resolves cells, and
a resolution that comes back EMPTY is usually a fact about the document — it named something the
document does not have — not a defect in the export. So the assertion is about what the page
DOES with the emptiness: that the cell says it names no transition, rather than passing in
silence. An assertion that the resolution succeeded forbids the export from reporting a real
gap, and the gap it was hiding is the finding the reader came for. The same applies to a
resolution that names MORE than the document wrote — the check may compare the resolution with
the document's cell, but it may not declare the document's own wording wrong.

**A cell that quotes and a cell that interprets must not share a class.** The page marks a cell
that carries a reading with its own class, and the checks select cells by that class to assert
the reading. A cell that shows the document's own words and carries the reading in its HINT must
use a different class: given the reading's class, every check that looks for a reading finds the
quotation first, and the suite fails on a change that broke nothing. The class is part of the
page's vocabulary with its own checks, so a new kind of cell gets a new class and the check
names it — and a check that selects a cell selects it BY KIND, never by position, because a
column added or reordered moves every position after it.

**A check identifies a thing by its id, and reads the id from the markup's own data.**
Never recover an id by parsing the rendered label: a pattern that strips the id back out
of the text is guessing identity by string, and it fails twice — it mis-reads the label
the moment the rendering changes, and it cannot fail on the thing it exists to protect.
Where the rendering must show an id beside a name (a trigger is not unique: one command
can have two branches, "Submit (TR-004)" and "Submit (TR-005)"), the id travels in its
own element, and the check compares that element's text with the id the link declares in
its `data-id`.

**A check that cannot fail is worse than no check.** The CDP checks are TEMPLATE
LITERALS, and a regular expression written inside one loses its backslashes — `\s`
becomes `s` — so the pattern matches nothing, the assertion passes on every document, and
the suite reports green over the very case it was written to catch. Double the backslashes
inside a template literal (`\\s`), and state in each assertion what it would report if the
thing it watches were missing, so a check that cannot fail is visible rather than silent.

### The gate's coverage is a convention in the page

**The checker finds tables by their call site, so a table rendered through a variable is
unseen.** `check-contract-vs-page.js` matches `DataTable($("#someId"), { id: "tName", … })`.
A call that passes the host as a variable — `DataTable(host, {…})` — does not match, so the
table is never compared with the contract and its absence is never reported: the gate is
green over a table nobody checks. **Write the host as a literal in every table call.** The
contract's columns, labels and widths are a promise only while something compares them.

**When the gate reports a disagreement, DECLARE the thing — do not reshape the page until the
checker stops noticing.** A table no view claims means the contract does not describe the
page. The honest repair is to declare the table, under the view that owns it.

**A view whose tables are ALTERNATIVES needs a per-table column map.** The contract's
`left`/`right` pair describes two tables SIDE BY SIDE. A detail panel whose tables are tabs
the reader switches between is not that, and declaring them as left/right would be a lie. A
view may declare `tableColumns` — a map from table id to that table's columns — and the
checker prefers it over the positional pair:

```json
"tables": ["tStateList", "tStateInv"],
"tableColumns": {
  "tStateList": [ { "key": "id", "label": "Transition", "width": "14%" } ],
  "tStateInv":  [ { "key": "id", "label": "ID", "width": "16%" } ]
}
```

**When the contract's vocabulary cannot express what the page does, widen the vocabulary.**
The contract is format-level and is meant to be widened; a page reshaped to fit a contract it
has outgrown is the wrong fix, because the page is the artifact the reader asked for.

### The third seam: a promise nothing checks

The two build-time checkers compare the contract's SHAPE against the export's and the page's.
Neither asks whether the page actually **uses** a field whose `x-view` names a view — so a
contract can promise "the page renders the engine's trace verbatim" while the page renders no
trace, and every gate stays green.

`x-view` exists so that a field the page ignores is a declared decision rather than an
accident. The declaration is the `x-view` value, so the question it implies is mechanical:

```
node scripts/check-contract-promises.js <contract.json> <page.html>
```

It lists the fields the contract points at a view that the page never reads, with the
contract's own description beside each one — because the decision is whether the page should
grow the behaviour or the contract should stop promising it, and only a reader can make that
call. So it **reports and exits zero**. Run it by hand until the list is empty; wire it into
the build only once every promise is either kept or deliberately reworded.

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
