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
3. **The code is optional**, and appears only where the name alone does
   not say which thing is meant.

## The spec table

One row per series. This table is the whole specification of "what kind
of thing is this": there is no per-series code, and no way for a series
to be missing from it.

| series | kind | family | glyph | codepoint | code shown |
|---|---|---|---|---|---|
| SM | State machine | model | ▣ | U+25A3 | yes |
| ST | State | model | □ | U+25A1 | yes |
| TR | Transition | model | → | U+2192 | yes |
| INV | Invariant | model | ✓ | U+2713 | yes |
| SRC | Source | definitions | § | U+00A7 | no |
| TERM | Glossary term | definitions | ▤ | U+25A4 | no |
| ENT | Entity | definitions | ● | U+25CF | no |
| VO | Value object | definitions | ○ | U+25CB | no |
| AGG | Aggregate candidate | definitions | ◆ | U+25C6 | no |
| BC | Bounded context | definitions | ⊞ | U+229E | no |
| SCN | Scenario | definitions | ≡ | U+2261 | no |
| N | Role-rewritten rule | definitions | ¶ | U+00B6 | no |
| CMD | Command | behaviour | ▶ | U+25B6 | yes |
| EVT | Domain event | behaviour | ★ | U+2605 | yes |
| POL | Policy | behaviour | ⊘ | U+2298 | yes |
| F | Finding | work | ✕ | U+2715 | no |
| Q | Question | work | ? | U+003F | no |

**No fancy marks.** Every glyph is plain text from the common blocks —
Geometric Shapes, Mathematical Operators, General Punctuation — and each
one is text-presentation by default. Anything with *emoji presentation*
(⚡ ✅ ❗ ❓ ⚠ ⛨) is excluded: it renders in colour on Windows and breaks
the palette and the size. The set is deliberately dull: a reader learns
fourteen marks in a minute, and no mark competes with the name beside it.

## The families and their colours

Each family paints the **rectangle**: a tinted background and a darker
border of the same hue. The name and the code keep the text colours; the
icon takes the family's dark colour, so the type still reads as a type.

| family | series | border | background | icon |
|---|---|---|---|---|
| **model** | SM ST TR INV | `#5B21B6` | `#F5F3FF` | `#5B21B6` |
| **definitions** | SRC TERM ENT VO AGG BC SCN N | `#115E59` | `#F0FDFA` | `#115E59` |
| **behaviour** | CMD EVT POL | `#166534` | `#F0FDF4` | `#166534` |
| **work** | F Q | `#991B1B` | `#FEF2F2` | `#991B1B` |

The border is a darker shade of the background's hue, so the chip reads as
a solid object rather than a tinted label. All four are clear of the page's
link blue (`#2563EB`), so a chip never looks like "a link in another
colour".

## The rule that is not negotiable: no regexes

**Nothing in the chip is read back out of text.** No pattern matching on
names, codes or ids — not to find an id, not to split a name, not to strip
a code off a label.

- The **icon** comes from the series, and the series is known by the loop
  that indexed the ids — never parsed out of an id string. The index holds
  the spec for each id: `{glyph, family, code}`.
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

## Densities

| variant | when | what it shows |
|---|---|---|
| **chip** | the reference *is* the cell's content | icon, name, code |
| **quiet** | the reference is one of several in a cell | icon, name — no rectangle, no code |

A cell that lists eight states must not show eight rectangles: it is a
list, so it is quiet. A cell whose whole content is one state is a chip.

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

## Why the code, where it is shown

The code appears exactly where the name can stand for more than one thing:

- **model** — "Approved" is SM-001's terminal state *and* SM-004's
  per-division state.
- **behaviour** — CMD-006 and CMD-007 are both "Submit".

It does not appear for definitions or work: there the name is the
document's own and says what it is.

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
