# functional-spec-reading

Turn a written functional specification into a domain model you can build from: a verified
ubiquitous language, a context map, reconstructed state machines with invariants, and a set of
defects that are **proven reachable** rather than argued.

A spec is prose addressed to reviewers, not a build contract. Read it as one and you get a
summary. Read it as evidence and you get a model with the contradictions still in it, marked.

## What you get

One file: `domain-model-and-state-machines.json`, organised by DDD concept — `glossary`,
`entities`, `aggregates`, `boundedContexts`, `stateMachines`, `states`, `transitions`,
`invariants` — with a stable identifier scheme (`ENT-001`, `AGG-001`, `TR-001`, `INV-001`, …)
cross-referenced throughout and a `traceability` array that maps every claim back to the
section it came from. Every record's fields are fixed by the contract, so the file is
read by a parser without a template of its own.

Every claim carries an **evidence class**, so a reviewer can tell what the spec said from what
you worked out:

| Class | Meaning |
|---|---|
| `EXPLICIT` | Directly stated in the specification — cite the location. |
| `INFERRED` | Derived from stated rules — show the reasoning chain. |
| `CANDIDATE` | Plausible but unconfirmed — needs a domain expert. |
| `CONFLICTING` | Two sections disagree — show both and the impact. |
| `UNSPECIFIED` | The information is absent — name the hole, don't fill it. |

## The citation rule

Every reference to a source names the source **document** by its registered `SRC-###` id,
inside brackets, and then the locator inside that document:

```
[SRC-001, §6.3]
[SRC-001, PAR-014]
[SRC-001, §3.2; SRC-002, §5]
```

One document, one id, allocated in `sources` and stable across iterations. A paragraph of
a source is located by `PAR-###`, assigned in reading order within that source; the
paragraph glyph is not a locator. A bare `§6.3` names no document — this analysis and the
specification both number their sections — so it is not a citation. A citation is an
object, one per source:

```json
{ "source": "SRC-001", "locator": "§6.3" }
```

If no reliable locator is available, the locator is `null`. The evidence is grounded in
the specification: an `evidence` array points at what the specification says, never at
what this analysis concluded from it.

This is a hard requirement, not a style preference, and the skill ends with a validation
gate that fails a document whose citations do not carry it.

## How it works

The pipeline has eight passes, and the order matters — later passes depend on earlier ones:

1. **Convert** the input (`.docx` / `.pdf` / `.xlsx`) to Markdown with the sibling conversion
   skills, so headings, lists and tables survive. Tables are evidence; a flattened extract is
   not citable.
2. **Index** every section and table, and build a source inventory (`SRC-###`, one document per
   id) before reading for meaning.
3. **Glossary** — every domain term, checked across *every* occurrence, with a status:
   `Defined`, `Defined (partial)`, `Conflicting`, `Overloaded`, `Undefined`, `Pending`.
4. **Roles** — the roles are the unit of permission, not people's names.
5. **State machines** — reconstructed from prose, because specs tabulate states and describe
   transitions in sections that were never written against each other.
6. **Invariants** — in three registers: stated, derived, and *broken by construction* (the spec
   states a rule and prescribes an operation that violates it — the highest-value findings).
7. **Executable model** — the rules become a program that *traverses* what is reachable, so a
   reachability claim is computed rather than asserted, and each finding's claim is checked by
   a probe against the computed set.
8. **Red-team** — a second, independent adversarial pass over the same source, which finds
   materially more than one pass does.

## Where the detail lives

| File | What it holds |
|---|---|
| `SKILL.md` | The procedure, the evidence discipline, and the pitfalls. Start here. |
| `references/spec-processing-prompt.md` | **The output contract** — the 31 top-level keys, every record's fields, the identifier scheme, the evidence classes. |
| `references/ddd-vocabulary.md` | The DDD Reference definitions and 45 patterns — the authority for what the output *means*. |
| `references/ddd-modeling-guidelines.md` | Domain model vs data model, entity vs value object, when something is a bounded context. |
| `references/aggregate-design-guidelines.md` | Deriving an aggregate boundary from invariants, not proximity. |
| `references/state-machine-modeling.md` | State dimensions, trigger vs guard vs postcondition, completeness checks. |
| `references/evidence-and-traceability.md` | Evidence classes, the `SRC-###` scheme, `PAR-###` paragraph locators, traceability matrix columns. |
| `references/evidence-extraction.md` | Getting quotable text out of a source document and citing it. |
| `references/executable-spec-model.md` | Building the traversal, the state key, and the probes. |
| `references/interactive-diagrams.md` | The self-contained HTML explorer's rules and generator. |
| `references/export-contract.md` | The contract between the exporter and the explorer, and the three obligations it binds. |
| `templates/domain-model-template.json` | The skeleton of the deliverable — every key, every field, in order. |
| `examples/example-domain-model.json` | A worked example showing the format — and what must *not* be inferred. |
| `examples/bread-purchase-spec.md` | A small fictional specification to run the skill against — a shop sale of bread, with two roles, six stages and a table of rules the model has to account for. |
| `scripts/` | Node helpers: vocabulary build, explorer generation, and the explorer test harness. |

## Install

Requires [Hermes Agent](https://github.com/NousResearch/hermes-agent) with Node 22+ (the
scripts use the global `fetch` and `WebSocket`).

```bash
hermes skills install j124650/functional-spec-reading/ --yes
```

Or copy the folder into your profile's `skills/` directory and restart the session. The skill
then loads automatically whenever a request matches its description.

## Run the helpers

The eight scripts under `scripts/` are dependency-free Node programs.

```bash
node scripts/test-explorer-cdp.js <page.html> [checks.js]   # headless-Chrome regression test for the HTML explorer
node scripts/check-explorer.js <explorer.html> <document.json> # verifies the page still matches the document it summarises
node scripts/check-export-contract.js <export.json> [contract.json] # checks the export against the contract it must satisfy
node scripts/check-contract-vs-page.js [contract.json] [page.html]  # checks the contract against the page that implements it
node scripts/check-id-catalogue.js <page.html> <document.json>  # checks the page's id catalogue against the document
node scripts/check-model-expressions.js <document.json>        # checks the document's expressions against the vocabulary
node scripts/build-vocabulary.js <book.json> <out.md>        # regenerates the vocabulary reference from the DDD Reference source
node scripts/parse-ddd-source.js <src-dir> <out.json>        # parses the DDD Reference source into structured data
```

The two contract scripts close the seam between the exporter and the explorer. The contract is
one JSON Schema file that says what the export carries, what each field *means*, and how the
page renders it; `check-export-contract.js` fails when the export does not conform, and
`check-contract-vs-page.js` fails when the page has drifted from what the contract describes.
Both exit non-zero and name the disagreement.

`test-explorer-cdp.js` exits non-zero when the page raises an uncaught exception, logs a
console error, fails to parse, or breaks any check in the checks file. `check-explorer.js`
exits non-zero and names the disagreement when the page's finding IDs or severities drift from
the document that owns them.

`references/ddd-vocabulary.md` quotes *Domain-Driven Design Reference* (Eric Evans, 2015),
© Eric Evans, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — attribution is carried
with the quoted material.
