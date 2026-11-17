# Rendering the id references

*How a reference to an identifier is drawn inside a table cell of the
explorer page. These are rules of the page, not of any one document: the
same rules hold for every specification the page reads.*

## The rule

Every reference to an identifier inside a table cell renders as a **chip**:
one rectangle holding three things, in this order —

1. the **type mark** — what kind of thing this is;
2. the **name** — what the document calls it;
3. the **id** — its code, *optional*.

The chip **is** the link. It is the one element that knows what it points
at; nothing else in the cell has to be parsed to find out.

**A chip that is a link must carry the class the page's click handling
binds.** The delegation binds one class, and a chip that omits it renders
like a link and is not one — dead to the reader, and silent to the build.
Check the page's own binding, not its CSS.

**A class carries meaning.** A cell that QUOTES the document and a cell
that INTERPRETS it must not share a class: a check looking for the
interpretation finds the quotation instead and blames the wrong cell. Give
each meaning its own class and let the checks name it.

## What the chip says, and in what order of importance

1. **The type comes first.** The mark says what kind of thing this is.
   It is the primary signal, because it is the one that survives when the
   colour cannot be seen — a printed page, a reader who cannot tell the
   hues apart, a screenshot in greyscale.
2. **The colour says the family.** Four families, four colours. The colour
   is secondary: it groups, the mark specifies.
3. **The id is always available.** It rides in the chip wherever the table
   does not show it in a column of its own, and it rides in the chip's
   HINT where the cell already says which thing is meant. It is never
   lost, and never said twice.

## The spec table

One row per series. This table is the whole specification of "what kind
of thing is this": there is no per-series code, and no way for a series
to be missing from it.

| series | kind | family | glyph | codepoint | code shown |
|---|---|---|---|---|---|
| SM | State machine | model | ▣ | U+25A3 | always |
| ST | State | model | □ | U+25A1 | always |
| TR | Transition | model | → | U+2192 | always |
| INV | Invariant | model | ✓ | U+2713 | always |
| SRC | Source | definitions | § | U+00A7 | always |
| TERM | Glossary term | definitions | ▤ | U+25A4 | always |
| ENT | Entity | definitions | ○ | U+25CB | always |
| VO | Value object | definitions | ◇ | U+25C7 | always |
| AGG | Aggregate candidate | definitions | ◈ | U+25C8 | always |
| BC | Bounded context | definitions | ⊞ | U+229E | always |
| SCN | Scenario | definitions | ≡ | U+2261 | always |
| N | Role-rewritten rule | definitions | ✎ | U+270E | always |
| P | Paragraph of the specification | definitions | ¶ | U+00B6 | always |
| CMD | Command | behaviour | ▶ | U+25B6 | always |
| EVT | Domain event | behaviour | ★ | U+2605 | always |
| POL | Policy | behaviour | ⊘ | U+2298 | always |
| F | Finding | work | ✕ | U+2715 | always |
| Q | Question | work | ? | U+003F | always |

**No fancy marks.** Every glyph is plain text from the common blocks —
Geometric Shapes, Mathematical Operators, General Punctuation — and each
one is text-presentation by default. Anything with *emoji presentation*
(⚡ ✅ ❗ ❓ ⚠ ⛨) is excluded: it renders in colour on Windows and breaks
the palette and the size. The set is deliberately dull: a reader learns
the marks in a minute, and no mark competes with the name beside it.

**A mark must be legible at the size it is drawn.** A bare glyph at
eleven pixels is punctuation: a hollow square reads as an equals sign and
an arrow reads as a dash, and the reader sees a column of stray marks
rather than a column of types. Either give the mark a shape of its own,
or make the cell around it an object.

**Look at what you drew.** A DOM dump proves the element is present; it
does not prove the element reads. Only a picture shows that a mark is a
mark — and only a picture catches the mark that has become punctuation.

## The families and their colours

Each family paints the **rectangle**: a tinted background and a darker
border of the same hue. The mark takes the family's dark colour, so the
type still reads as a type.

| family | series | border | background | hover | icon |
|---|---|---|---|---|---|
| **model** | SM ST TR INV | `#5B21B6` | `#F5F3FF` | `#EDE9FE` | `#5B21B6` |
| **definitions** | SRC TERM ENT VO AGG BC SCN N P | `#115E59` | `#F0FDFA` | `#CCFBF1` | `#115E59` |
| **behaviour** | CMD EVT POL | `#166534` | `#F0FDF4` | `#DCFCE7` | `#166534` |
| **work** | F Q | `#991B1B` | `#FEF2F2` | `#FEE2E2` | `#991B1B` |

**The chip is ONE rectangle** — the mark sits inside it, not in a badge
of its own, and the mark is the same size every time.

**The visual state is the rectangle's shade.** On hover the background
darkens one step and nothing else moves: no border, no underline, no
change of colour.

The border is a darker shade of the background's hue, so the chip reads as
a solid object rather than a tinted label. All four are clear of the page's
link blue (`#2563EB`), so a chip never looks like "a link in another
colour".

## The rule that is not negotiable: no regexes

**Nothing in the chip is read back out of text.** No pattern matching on
names, codes or ids — not to find an id, not to split a name, not to strip
a code off a label.

- The **mark** comes from the series, and the series is known by the loop
  that indexed the ids — never parsed out of an id string. The index holds
  the spec for each id: `{glyph, family}`.
- The **name** comes from the index.
- The **id** is its own field. It is rendered in its own element and is
  never part of the name.
- The **id travels as data**: the chip carries it in a data attribute, and
  a check compares that attribute with the export's ids. A check that
  strips an id out of a rendered label with a pattern is guessing at
  identity by string — and it fails silently, because a pattern that
  stops matching never complains.
- **A pattern written inside a template literal loses its backslashes.** A
  check written as JavaScript inside a template literal sends `\s` to the
  browser as `s`: the pattern silently stops matching, and a check that
  can never fail is worse than no check. Double every backslash, and
  confirm that a check which must FAIL does fail.

The reason is the same reason the rest of the page is built this way: a
string that *looks* like an id is not an id, and a page that recognises ids
by their shape will one day recognise the wrong thing. Identity comes from
the data, always.

*Prose is the one exception, and it is a different mechanism:* the page
recognises an id inside a sentence so it can link it. That links nothing
but the id it recognised, and it never decides what anything *means*.

## One look

**There is ONE chip.** A reference is drawn the same way wherever it
appears: the same rectangle, the same mark, the same name, the same id.
A second visual variant of a component — a "quiet" one for lists — makes
one object look like two different things, and the reader cannot tell
which is which.

When a cell lists eight states, the answer is a denser cell, a wider
column, a smaller type size. Never a second kind of chip: a tidy table is
not worth a lie about the object.

## The legend

A reader who cannot tell the accents apart needs a key — and the key must
not be a second, separate list of the same facts. **The legend is read
from the same table the chips are drawn from.**

The table holds, per series: the prefix, the kind's name, the mark, the
family, and whether the family's names can repeat. The families are in the
stylesheet, one class each, so a legend's swatch is the very class a chip
wears.

`legendRows()` returns exactly that table, ready to render as a key.

## Where the chip applies

| place | treatment |
|---|---|
| table cells | the chip — always the same one |
| prose — the detail panels, guard sentences | inline link: a chip in a sentence is noise |
| the graph | unchanged: a diagram has its own language, and a chip in it would fight the nodes |
| the matrix | the cell's head is a HEADER, not a chip: it names what is in the cell, and the cell itself is the thing the reader clicks |

## The matrix cell

A matrix cell is an OBJECT, not a container of links: clicking it opens the
thing it holds, the way clicking an edge opens it in the graph. The head
inside the cell — the transition's name — is therefore a header, bold and
accented, and not a second thing to click. Hovering the cell says so: the
cell takes the accent tint, so the reader can see what a click would open.

The row and column headers keep their own behaviour — they open the
state, which is a different thing from what the cell holds.

## Where the id is shown

The id rides along wherever the table does not show it in a column of its
own. There is no point saying it twice — and a reader must never have to
go looking for which thing is meant.

Two families' names say which thing they mean only once the id is there:
**model** ("Approved" is one machine's terminal state *and* another
machine's per-division state) and **behaviour** (two commands are both
"Submit"). The others could carry it or not; the id is carried anyway,
because a chip that does not say which thing it is is a chip the reader
has to work at.

*This rule may be made data-driven later: the exporter already holds every
series' names, so it could say which of them repeat, and the page would
show the id exactly where it is needed — no guesswork.*

## The shape of the implementation

- **One component**, driven by the spec table — not one function per series.
  Seventeen near-identical functions would drift apart.
- The link index grows the kind spec: `{id, name, series, tab, title, code,
  glyph, family}`.
- The chip is one anchor with three children:
  `<a class="idlink chip chip--model" data-id="ST-001"><span class="chip__icon">□</span><span class="idname chip__name">Draft</span><span class="chip__code">ST-001</span></a>`
- Table columns switch from `cell()` to `chipCell()`; prose keeps `cell()`.
- The chip is `inline-flex` with `white-space:nowrap`, so a name never
  breaks across lines, and it sets its own type size so it never inherits
  the table's.
- **The chip's sizes are in rem, and they are in rem together.** The page
  sets no root font-size, so rem is the reader's browser setting: the
  width, the mark, the name and the id move as one piece, or the chip
  drifts out of its own shape.
- **The chip is capped, and the NAME is what gives way.** At most
  9.375rem (150px) wide, the name shortens to an ellipsis while the mark
  and the id stay — so the chip still says what kind of thing this is and
  which one — and the HINT carries the whole text.
- **The border is a hairline**: 0.1px, because the tint carries the shape
  and the border only closes it.
- After changing how anything is drawn, look at it. The suite proves the
  structure; the picture proves the drawing.

## A field whose value is a LIST of pieces

Some fields hold a list rather than a string: the words a record was cut from,
with the sections those words cite. Draw such a field with the page's own
citation renderer — a chip per referenced section, the quoted words as prose
beside them — and never with the escaping helper.

The escaping helper takes a string. Handed a list of objects it calls
`String()` on them, and the panel renders `Source [object Object],[object
Object],[object Object]`: the field is there, it is full, and it says
nothing. The failure is silent because the value is not empty and the
container is not missing, so no count and no presence check sees it — only
the reader does, on the field they clicked.

So: a field that holds pieces is rendered by the piece renderer, and a field
that holds one string is rendered by the string renderer. Which is which is
the export contract's business, and the contract already says it: a value
that is a list is a list.

## The graph's own language: an end the document does not name

The graph is not a table of chips, and it has its own way of saying "the
document does not say". An edge whose end resolves to no state is drawn to a
MARKER — a dashed node saying so — because the missing end is itself a fact
the reader needs.

There are two such facts, and they are not the same one. An end that names
SEVERAL states leaves the landing point undetermined; an end that names NO
state leaves it unstated. Both are drawn to a marker, but the marker says
which, because the document's own words are the evidence for the first and
the absence of them is the evidence for the second.

A renderer that creates its marker only when the end carries text handles the
first and drops the second: the edge is left with no destination, the path
builder returns null, and the transition disappears from the diagram while
every gate stays green. Create the marker whenever the edge has no resolved
end, and take that fact from the export's flag rather than from a pattern
matched against the cell's text — the same end is missed the moment the
wording changes. Two transitions with unnamed ends are two facts, so key the
markers on the transition, not on the shared empty text.

The same rule governs the edge's FROM end, where the right drawing is the
start marker the pseudo-state rule already describes: a position in the flow
rather than a state of the machine.

And count only the markers that stand for a MISSING destination. The start
marker is a position in the flow, not a destination the document failed to
name, so a count taken over every synthetic marker reports a destination that
is not missing — and the machine overview's figure then contradicts the
diagram beside it.

---

## Pitfalls: the page, the export and the checks that read them

These govern the interactive page and the checks that read it. They are stated here, once, and in full.

- **A record whose body is structured content must keep that structure.** An
  aggregate's aspect table and a scenario's labelled bullet list are not one
  paragraph each: flattening them to a string loses the breakdown the reader
  consults, and the page then shows "Content" instead of the root, the members
  and the consistency expectation. Parse the aspects and the parts as records and
  carry them through the export — the detail panel shows what the document says,
  not a summary of it.

- **The explorer's rendering rules live in `references/explorer-rendering.md`** — how
  a reference is drawn, the marks and the families, the legend read from the same
  table the chips are drawn from, and the traps the no-regex rule walks into.

- **A cell that QUOTES the document and a cell that INTERPRETS it must not share a
  class.** The page marks a cell that carries a reading with its own class, and the
  checks select cells by that class to assert the reading — so a cell showing the
  document's own words with the reading in its HINT, given the same class, is found
  first by every check that looks for a reading, and the suite fails on a change
  that broke nothing. Give each kind of cell its own class and let the check name it.

- **A consumer identifies a thing by its ID, and never by recovering the ID from the
  text it rendered.** A check that strips the id back out of a rendered label with a
  pattern is guessing identity by string: it mis-reads the label the moment the
  rendering changes, and it cannot fail on the thing it exists to protect. Where a
  name is not unique on its own — two transitions can share a trigger, because one
  command has two branches — the rendering carries the id beside the name ("Submit
  (TR-004)") and carries it as DATA: the id travels in its own element, so the
  consumer reads the id from the markup and compares it with the id it already knows.
  This holds wherever an id is written down — in the export, in the markup, in the
  checks, in the matrix. Identity is a fact the data states, never a shape the text
  suggests.

- **An assertion must not forbid what the document actually says.** When the export
  resolves a cell and the result is EMPTY, that is usually a fact about the document
  — it named something the document does not have — not a defect in the export.
  Assert that the page REVEALS the emptiness; asserting that the resolution succeeded
  forbids the export from reporting a real gap, and the gap it hid was the finding.

- **Identity is an id, and it travels as data.** A component that names a thing
  carries that id in a data attribute, and the checks compare ids with ids. Never
  infer an id from a rendered label: that guesses at identity by string.

- **`references/explorer-rendering.md`** — how a reference is drawn.

- **An instrument's consumer must cover every section the instrument carries, and an
  empty section is still a section.** The export carried the divergences and the
  executable gaps; the page rendered neither. Both were empty, so nothing was lost
  that day — and the page would have dropped them silently the day one was not
  empty, because there was never a view to hold them. **A check of the form "the
  table's row count equals the array's length" passes against a page with no table
  at all**, because zero equals zero: assert the VIEW exists and says so when the
  data is empty, then assert it holds everything when it is not.
  **Audit the FIELDS the export carries, not the tabs the page has.** The gaps
  appear where a field exists in the export and the page renders it in symbols, or
  renders it nowhere. Enumerate the export's fields whose value is an expression,
  then find each one's render site and ask whether it is read in words, shown in
  symbols, or missing: a field shown in symbols where the reader would have read it
  is a visible gap, and a field rendered NOWHERE is worse, because the reader is
  told a rule applies and is never shown it.

- **The gate's coverage depends on a convention in the page, so a page that breaks
  the convention loses the gate silently.** The contract-vs-page checker finds tables
  by their call site — `DataTable($("#someId"), { id: "tName", … })` — so a table
  rendered through a VARIABLE (`DataTable(host, {…})`) is never seen: its columns are
  never compared with the contract's, and its absence is never reported. The gate
  stays green over a table nobody checks. Write every table's host as a literal, and
  when the gate names a table no view claims, DECLARE it in the contract rather than
  reshaping the page until the checker stops noticing — a gate satisfied by hiding
  from it is not a gate.

- **An assertion that compares what the page SHOWS with the document's RAW string
  must render the expectation through the page's own helper.** The page renders
  Markdown emphasis — `**or**` becomes bold — so the raw source keeps the asterisks
  and the comparison fails on any emphasised text, and the failure reads as "the
  field is missing" when the field is on screen. Build the expectation by passing
  the source through the page's own cell renderer and reading its text, so the
  assertion compares like with like.

- **Do not leave the deliverable half-migrated.** A layout rewrite that changes the
  markup but not the scripts that read it leaves a broken page. When the structure
  changes, change the markup and the code that drives it in the same pass and re-verify
  in the browser before moving on.

- **A layout assertion must be shown to fail.** A check that passes against the
  broken build is measuring the wrong thing — the headless default window is small
  enough that the overflow cannot happen. Set a desktop viewport in the harness, then
  revert the fix and confirm the assertion catches it.

- **An assertion that measures an element must put it on screen first.** A hidden
  element's rectangle is all zeros, so a comparison against it passes trivially —
  "the checked column is narrower than the widest" holds for every column in the page
  when nothing was measured. Open the tab, assert the measurement is non-zero, and
  only then compare. A check that cannot fail is worse than no check, because it
  reports the defect as absent. Judge the layout at the reference viewport too: a
  column that fits at the harness's desktop width genuinely clips in a narrow
  interactive window, and the small window is not the reader's.

- **A view that is present in the DOM is not a view the reader can see.** Assert
  visibility, not presence: exactly one section on screen at a time, and the primary
  panel's rectangle inside the viewport. A stacked layout, a panel pushed below the
  fold, and a canvas whose content sits outside its `viewBox` all leave every
  element-count check passing while the artifact the reader came for is not on
  screen — and the screenshot shows a complete-looking page with the graph missing.
  **Look at the screenshot of the whole page**, not only of the diagram's crop: a
  missing primary artifact is invisible to an assertion that counts elements and
  obvious in a picture.

- **The CSS selector and the script that toggles classes must name the same class.**
  When the stylesheet hides `section.on` and the script toggles a different class,
  no section ever gains the class the stylesheet watches, every section keeps its
  default display, and they stack — pushing the primary panel off-screen while the
  page still looks alive. Hide by default, reveal with one class, and use that class
  in both places.

- **A NEGATIVE TEST WHOSE MUTATION DID NOT APPLY IS NOT A PASSING TEST.** To prove a
  comparison script can fail, break a copy of the artifact and confirm the script
  rejects it — and confirm the mutation actually landed before believing the
  result. A `replace()` that finds no match changes nothing and reports success,
  so the "failing" case passes for the wrong reason and the script looks correct
  while never having failed. Print or assert that the file changed. The same
  applies to any negative case: a renamed ID, a downgraded severity, a removed
  row — each must be caught, and the catch must name the disagreement.

- **`String.replace()` with one argument inserts the string `"undefined"`.**
  `s.replace(/^### /)` coerces the missing replacement to that string, so every parsed
  title renders as `undefinedISS-01`. The file parses and looks fine until a title is
  actually read; grep for one-argument `.replace(` before shipping a generator.

- **A duplicate declaration is fatal and blanks every view.** When data moves out of
  the program into a document, the old declarations must go in the same pass — a
  duplicate `const` is a parse error that empties the page without a visible cause.
  The same collision happens between two *features* that each own a piece of view
  state: a new panel's selection variable must not reuse a name an existing feature
  already holds, or the whole script dies at parse time and every view goes blank.
  Grep before declaring: `grep -n '\bfSel\b' explorer.html`.
