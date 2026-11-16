# Rendering the id references

*How a reference to an identifier is drawn inside a table cell. This is a
rule of the explorer, not of any one document: the same rules hold for
every specification the page reads.*

## The rule

Every reference to an identifier inside a table cell renders as a **chip**:
a small rectangle holding three things, in this order —

1. the **type icon** — what kind of thing this is;
2. the **name** — what the document calls it;
3. the **code** — its id, *optional*.

The chip **is** the link. It is the one element that knows what it points
at; nothing else in the cell has to be parsed to find out.

## What the chip says, and in what order of importance

1. **The type comes first.** The icon says what kind of thing this is.
   It is the primary signal, because it is the one that survives when the
   colour cannot be seen — a printed page, a reader who cannot tell the
   hues apart, a screenshot in greyscale.
2. **The colour says the family.** Four families, four colours. The colour
   is secondary: it groups, the icon specifies.
3. **The id is always available.** Where the cell already says which
   thing is meant, the id rides in the chip's hint rather than in the
   chip itself — but it is never lost, and never said twice.

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
| ENT | Entity | definitions | ● | U+25CF | always |
| VO | Value object | definitions | ○ | U+25CB | always |
| AGG | Aggregate candidate | definitions | ◆ | U+25C6 | always |
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
fourteen marks in a minute, and no mark competes with the name beside it.

## The families and their colours

Each family paints the **rectangle**: a tinted background and a darker
border of the same hue. The icon takes the family's dark colour, so the
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

- The **icon** comes from the series table — the one table that says what
  each series is — and the series is known by the loop that indexed the
  ids, never parsed out of an id string.
- The **name** comes from the index.
- The **code** is its own field. It is rendered in its own element and is
  never part of the name.

The reason is the same reason the rest of the page is built this way: a
string that *looks* like an id is not an id, and a page that recognises ids
by their shape will one day recognise the wrong thing. Identity comes from
the data, always.

*Prose is the one exception, and it is a different mechanism:* the page
recognises an id inside a sentence so it can link it. That links nothing
but the id it recognised, and it never decides what anything *means*.

## One chip

There is only ONE chip. Whether a cell holds one reference or eight,
the reference is drawn the same way: the same rectangle, the same mark,
the same id.

Two looks for one thing is a lie about the thing. A reader seeing a
bare name in one tab and a boxed chip in another cannot tell whether
those are the same kind of object — and the quiet chip that caused it
was there for a table's sake, not the reader's.

```
┌───────────────────────────────┐
│ □  Draft   ST-001             │
└───────────────────────────────┘
   ↑    ↑        ↑
  mark  name      id
```

- **mark** — 11px, in the family's colour, inside the chip's own rectangle
- **name** — 10px, the family's colour
- **id** — 9px, dim grey, in its own element; or, where the cell already
  names the thing, in the chip's hint instead
- **chip** — one rectangle: a tinted background, a hairline border of the
  same hue (0.1px — the tint carries the shape, the border only closes
  it), radius 5px, line-height 1.2, `inline-block` so it never breaks
  mid-name

## The legend

A reader who cannot tell the accents apart needs a key — and the key must
not be a second, separate list of the same facts. **The legend is read
from the same table the chips are drawn from.**

The table holds, per series: the prefix, the kind's name, the mark, the
family, and whether the code is shown. The families are in the stylesheet,
one class each, so a legend's swatch is the very class a chip wears.

`legendRows()` returns exactly that table, ready to render as a key.

## Where the chip applies

| place | treatment |
|---|---|
| table cells | chip, or quiet inside a list |
| prose — the detail panels, guard sentences | inline link, as today: a chip in a sentence is noise |
| the graph and the matrix | unchanged: a diagram has its own language, and a chip in it would fight the nodes |

## Where the code is shown

The code rides along wherever the table does not show the id in a column
of its own. There is no point saying it twice — and a reader must never
have to go looking for which thing is meant.

Two families' names say which thing they mean only once the id is there:
**model** ("Approved" is SM-001's terminal state *and* SM-004's
per-division state) and **behaviour** (CMD-006 and CMD-007 are both
"Submit"). The others could carry it or not; the id is carried anyway,
because a chip that does not say which thing it is is a chip the reader
has to work at.

*This rule may be made data-driven later: the exporter already holds every
series' names, so it could say which of them repeat, and the page would
show the code exactly where it is needed — no guesswork.*

## The shape of the implementation

- **One component**, driven by the spec table — not one function per series.
  Seventeen near-identical functions would drift apart.
- The link index grows the kind spec: `{id, name, series, tab, title, code,
  glyph, family}`.
- The chip is one anchor with three children:
  `<a class="chip chip--model"><span class="chip__icon">▢</span><span class="chip__name">Draft</span><span class="chip__code">ST-001</span></a>`
- Table columns switch from `cell()` to `chipCell()`; prose keeps `cell()`.
- The chip is `inline-block` with `white-space:nowrap`, so a name never
  breaks across lines.
