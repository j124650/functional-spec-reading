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
