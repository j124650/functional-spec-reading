# The gates: what each one asks of the deliverable

Nine gates check the deliverable. They are exact, and they are the pass criteria:
a deliverable that satisfies all nine is sound in the ways they can test. Read this
file once, before you write the behaviour keys — it is what the nine scripts ask,
in prose, so that you do not have to read the scripts, and do not have to probe the
engine to find out.

**Run them all at once:**

```
node scripts/gate.js <deliverable.json> [source.md] [export.json] [page.html]
```

One line per gate, the failing detail indented under a failure, and a count at the
end. A gate whose input you did not produce is **skipped, and says so** — that is
not a failure. `scripts/assemble.js <fragments-dir> <out.json>` builds the
deliverable from its fragments and refuses to write one that does not fit the
contract.

---

## The gates, one by one

### 1. `check-model-expressions.js` — every expression resolves

Every expression in the document — in guards, effects, invariant
`formalExpression`s, and issue probes — must resolve against the document's **own**
`expressionVocabulary`. A failure names a term the document does not declare.

**What it means.** The vocabulary is the contract between the document and the
engine: a term that is not declared cannot be read, and a rule written over it
cannot be checked.

**The repair is the document's.** Either the term belongs in the vocabulary — with
its type — or the expression names the wrong thing. Never widen the vocabulary to
make a wrong expression parse.

### 2. `check-source-coverage.js` — every ROW of the source's tables is accounted for

The source's tables state facts outright: a stage in its stage table, a role in its
roles table, a rule in its notification matrix, a question in its questions table, an
outside item in its outside-items table. Each row must be accounted for by a record
that **names it** *and* **cites the row's section**.

**How it matches.** On the field that names a thing:

| key | the field that names it |
|---|---|
| `glossary` | `term` |
| `entities`, `valueObjects`, `boundedContexts`, `aggregates`, `states`, `commands`, `domainEvents`, `policies` | `name` |
| `roles` | `name` |
| `issues` | `statement` |
| `questions` | `question` |
| `referencedButNotSupplied` | `artefact` |
| `completenessFindings` | `check` or `finding` |

…**and** the record's evidence must cite the row's section. Naming it is not
enough: a record that mentions a stage but cites §3 when the stage table is §3 is
accepted only if the citation is the one the row lives in.

**Two traps.** A row whose key is **shorter than three characters** is skipped —
`Q1`, `R1`, `HR` never have to be accounted for. And the match is on the *name*:
use the source's own words, not a synonym, or the row is not matched.

**The repair is the document's.** Account for the row — as a record, or as a
completeness finding that says why it is not modelled.

### 3. `check-section-accountability.js` — every SECTION of the source is accounted for

The coverage gate asks about the source's **tables**; this one asks about its
**sections**, because a specification states most of what it states in prose.

A section is **modelled** when a record cites it (or a subsection of it),
**declared** when only a completeness finding cites it, and a **hole** when nothing
cites it. A hole is a part of the source the model did not read. Sections that are
not numbered — `Changelog` — are exempt.

### 4. `check-citation-fidelity.js` — every record cites the spec, and every citation resolves

Three rules:
- a record carries **at least one** citation;
- the citation names **one** section the source has (`§6.3`) or **one** registered
  paragraph locator (`PAR-002`, in the document's `sourceLocatorRegister`) — a
  range (`§§4-6`) is refused;
- the citation's `source` is a registered source id.

**The repair is the document's.** A record with no citation says something the
document cannot account for: either it needs a citation, or it should not exist.

### 5. `check-scope-resolution.js` — every scope resolves

Every invariant's `scope` must resolve to at least one id — the states it holds in,
or the transitions it guards. A scope of `AllStates` is written out as the states
it holds in; `binding` is separate from the scope and names the aggregate or
context the rule binds to.

### 6. `check-export-contract.js` — the export conforms to the contract

The export must satisfy `explorer/export.contract.json`: every required property
present, every kind right, every record carrying its required fields, the counts
the contract states matching the data, and every view naming a property the export
actually carries.

### 7. `check-contract-vs-page.js` — the contract and the page agree

The page must implement what the contract describes: the same views, the same
tables, the same controls. It is checked by shape, not by instance.

### 8. `check-explorer.js` — the page and the document agree

The page is a view of the document; its findings must match the document's. If the
page shows a finding the document does not have, or misses one it has, this gate
names the disagreement.

### 9. `check-id-catalogue.js` — every identifier reaches the page

The page's catalogue must carry every identifier series the document issues: every
`SRC`, `PAR`, `TERM`, `N`, `CON`, `ENT`, `VO`, `BC`, `AGG`, `CMD`, `EVT`, `POL`,
`SM`, `ST`, `TR`, `INV`, `SCN`, `F` and `Q` id the document uses, decoded into the
name it stands for.

---

## The engine's own rule, which the `check` command enforces

**A guard that reads a collection nothing fills can never hold.** The engine
resolves every guard against the aggregate the transitions build, so a set or flag
that no transition's effect ever writes is permanently false — and every state
behind it is unreachable, however well the transition table reads.

So: **what a transition ADDS and what it REMOVES are effects**, and they are the
model's, not the reader's. The specification says what a submit adds (§6.3 adds a
requirement when terms are requested and not declined; an allowance when a discount
line exists), what an approval removes, what a refusal puts back, what the order
form fills, what the licensing match leaves unmatched, what the customer completes
and signs. Every one of those is an effect on a transition, and every guard that
reads a collection depends on it.

A **set element must be named**: `add('sale lines', input)` adds the *value* of
`input`, which the engine cannot synthesise, so the element comes out empty and the
collection looks empty. Name the element — `add('sale lines', 'line')` — and say in
the vocabulary that the specification never says what a line contains.

## What "a reachability claim" has to be based on

The engine explores the state space and reports what it reaches and what breaks. A
completeness finding that says *every state is reachable* is a claim about the
transition table; the engine has the answer. Argue it from the table, or compute
it — and if the engine says a state is unreachable, the finding must say so, with
the reason.

---

## The repair loop, in one line

A gate names the record and the rule. Read **the fragment** that holds that record,
edit **that one record** inside it, rebuild with `assemble.js`, re-run `gate.js`.
Never re-emit a whole key, and never re-read the engine's source to find out what
a gate wants — this file is what a gate wants.
