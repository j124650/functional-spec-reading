---
name: functional-spec-reading
description: Use when extracting DDD semantics from a functional spec.
version: 1.1.0
author: Hermes Agent
license: MIT
platforms: [windows, linux, macos]
metadata:
  hermes:
    tags: [ddd, ubiquitous-language, glossary, bounded-context, aggregate, state-machine, invariants, domain-events, commands, spec-review, traceability, requirements]
    category: software-development
    related_skills: [spec-writing, state-machine-audit, grounded-citations, docx]
---

# Reading a functional specification into domain semantics

Turn a written specification into a domain model you can build from: a verified ubiquitous
language, a context map, reconstructed state machines with invariants, and a set of defects
that are **proven reachable** rather than argued.

The spec is the artifact under audit. It is prose addressed to reviewers, not a build
contract — so the work is extraction, reconstruction and proof.

**What you produce is fixed.** `references/spec-processing-prompt.md` is the contract:
one consolidated `domain-model-and-state-machines.json`, the DDD-shaped key list
that holds the model, the identifier scheme, and the evidence classes. **What the words mean is fixed too.**
`references/ddd-vocabulary.md` is the authority — the definitions and patterns of the
DDD Reference (Eric Evans, 2015, CC BY 4.0). Load both before extracting; a methodology
without an authority cannot be checked, and a deliverable without a contract is a pile of
notes.

## When to Use

- "Turn this spec into something DDD-friendly" / "extract the glossary and verify it".
- "Find the explicit and implicit state machines, their states, invariants and transition tables."
- "Identify invalid states or transitions the system can reach, with evidence."
- "Prioritise the bugs, group the fixes into issues, keep the document updated."
- Any non-technical functional spec that describes a workflow, decisions, and open questions.

**Skip when** the target is *code* (use `state-machine-audit` — that skill reads branches, not
prose), when the ask is to *write* a spec (use `spec-writing`), or when the claims are about
retrieved external sources (use `grounded-citations`).

---

## What to build, and what not to

**The deliverable is the document.** One consolidated
`domain-model-and-state-machines.json`, written from reading the spec. Everything else —
an executable model, an interactive page, a compiler that produces an intermediate
representation, a checker script — is an *instrument*, and it gets built only when the
reader asks for it or when the document genuinely cannot be produced without it.

**Write the document first.** Scaffolding before the deliverable inverts the work: the
reader waits on tooling that may never produce the thing they asked for, and the
deliverable ends up shaped by whatever the tooling happened to emit. Produce the
document, then build an instrument against it if it adds anything.

**The deliverable is JSON, so the analysis is written as records, not as prose that
gets shaped afterwards.** Every finding, term, state and transition is a record with
named fields from the moment it is written. A fact stated once, in one field, in one
place, is a fact a parser can read; the same fact stated in prose AND in a table is two
copies that drift, and the drift is invisible because the prose still reads true.

**Do not inherit an artifact from a previous workflow.** Before you reach for an
existing model, an existing extractor, or an existing findings document, check whether
it answers *this* request or belongs to an earlier one. A tool that produced its numbers
by hand-transcribing rules from an older version of the spec is not a fresh result; if
you cite it, say so, and never let its numbers stand in for your own analysis.

**Scope is the ask.** The reader asked for a document, so the document is the job. A
second format, a companion tool, a rewrite of an earlier analysis — each is scope you
added, and it has to be asked for.

## The scope gate — read this first

**The named file and the directory it lives in are the entire scope.** When the ask names a
document, do not enumerate sibling directories, other repositories, or the home directory to
look for "the real implementation" — not even read-only exploration.

Why: to the user, an unexplained sweep of unrelated paths reads as you ignoring the boundary
they set, and it surfaces context from systems that have nothing to do with the document under
audit. A read-only sweep is still a violation of the stated scope.

What to do instead: work from the document. If it clearly depends on a codebase you cannot
see, say so in one line and continue with the document as the sole source of truth.

**The repository the document sits in is inside that scope, and its history is not a
source.** A working directory that happens to hold an earlier run's artifacts — a
model project, an explorer page, a previous copy of the deliverable — makes them
visible, not relevant: they are the OUTPUT of a past run, not an input to this one.
Do not read them, restore them from git, or `git log` / `git show` them to see what
they said. A reader who asks for a document and gets a tour of the working tree's
history reads it as stalling, and it changes nothing about the document you were
asked to read.

Why: the reader named a file and a process. The deliverable has to come from reading
that file, and the only thing the history can add is the temptation to hand back
somebody else's answer.

What to do instead: run the procedure from step 1 — convert the named file, read it,
produce the deliverable. When the ask is to UPDATE an existing deliverable rather than
produce one, the existing one is in scope, and you say which reading you took.

---

## Procedure

### 1. Convert the input to Markdown

**This is the front door of the whole pipeline. Do it first, and do it with the
bundled conversion skill — never by hand.**

**Default instruction set: [`github/awesome-copilot`](https://github.com/github/awesome-copilot)
(41k stars), Microsoft's own.** Install the skill for the input format and
follow it:

| Input | Skill |
|---|---|
| `.docx` | `convert-word-to-md` |
| `.pdf` | `convert-pdf-to-md` |
| `.xlsx` | `convert-excel-to-md` |

```
manage_catalog install convert-word-to-md convert-pdf-to-md convert-excel-to-md
```

The skill ships a script that runs **MarkItDown** and writes a self-contained
folder next to the source: `<name>.md` plus `img/` when the document has
embedded images.

**Install the skill, then run ITS script** — do not reimplement the conversion.
It produces what a downstream analysis needs and a hand-rolled extractor does
not: real `##` headings, real bullet lists, and **tables as Markdown tables**
rather than one loose word per line. A spec's stage table is evidence; flattened
into loose cells it is unreadable and uncitable.

**Setup (once per environment).** The skill needs Python 3.10+ and `markitdown`.
The Hermes venv has no `pip`; use `uv` and an isolated environment:

```bash
uv venv "$TMPDIR/mdvenv" --python 3.12
uv pip install --python "$TMPDIR/mdvenv/Scripts/python.exe" "markitdown[docx]>=0.1.0"
```

**PUT THE VENV IN THE SCRATCH DIRECTORY, NOT THE WORKING DIRECTORY.** `uv venv mdvenv`
with a bare relative path creates the environment in whatever directory the shell is
sitting in — which is the folder holding the source document and, later, the deliverable.
An unset `$TMPDIR` fails the same way: the variable expands to nothing, so
`"$TMPDIR/mdvenv"` collapses to a relative path and lands in the working directory.
A multi-hundred-megabyte environment then sits beside the artifact the reader receives,
and it is easy to mistake for part of the output. Name an explicit scratch path, read
the path `uv venv` prints back to confirm it, and delete the venv when the conversion
is done.

Then run the skill's script with that interpreter:

```bash
"$TMPDIR/mdvenv/Scripts/python.exe" <skill>/scripts/convert_word_to_md.py "input.docx"
```

**Mixed input types:** when the input is a folder containing `.docx`, `.pdf` and
`.xlsx`, invoke ALL THREE sibling skills — never let a file type be silently
skipped.

**Output location:** the script's default is next to the source file, and that
is the required default. Only pass `-o` when the user explicitly names a
destination.

**After conversion, the Markdown is the source of truth.** Cite it by the
document's own section numbers (`§3`, `§4.2`) — the headings give them
directly — and quote it verbatim. Keep a line or character anchor only as a
private lookup, and check that it resolves before shipping it.

See `references/evidence-extraction.md` for how to find and cite a phrase in the
converted document.

### 1b. Load the processing prompt and the vocabulary

Before extracting anything, load the two files that say what you are producing
and what the words mean.

- **`references/spec-processing-prompt.md`** — the output contract. It fixes the
  deliverable (one consolidated `domain-model-and-state-machines.json`), the top-level
  key list and the field of every record in it, the identifier scheme (`ENT-001`,
  `VO-001`, `AGG-001`, `CMD-001`, `EVT-001`, `SM-001`, `ST-001`, `TR-001`, `INV-001`,
  `POL-001`, `SCN-001`, `Q-001`, `SRC-001`, `TERM-001`, `N-01`, `PAR-001`), the
  evidence classes (`EXPLICIT` · `INFERRED` · `CANDIDATE` · `CONFLICTING` ·
  `UNSPECIFIED`), and the rules that make the file parseable. It also requires a
  second analytical pass — the adversarial review in step 9 is that pass.

  **The key list is the domain model, not a document outline.** Every key is a DDD
  concept — `glossary`, `entities`, `aggregates`, `boundedContexts`, `stateMachines`,
  `transitions`, `invariants` — and each holds an array of records with the fields
  §8.1 fixes. A consumer reads the file and finds the domain in it; there is no
  second rendering of the same fact to disagree with it.
- **`references/ddd-vocabulary.md`** — the authority for what the output
  *means*. The definitions and the 45 patterns of the DDD Reference (Eric Evans,
  2015, CC BY 4.0), plus a mapping from each required output onto the patterns
  that ground it.
- **`references/ddd-modeling-guidelines.md`** — the distinctions that prevent
  modelling errors: domain model vs data model, entity vs value object, when
  something is a bounded context, and the humility rules for thin evidence.
- **`references/aggregate-design-guidelines.md`** — how to derive an aggregate
  boundary from invariants rather than from proximity, and the mistakes to avoid.
- **`references/state-machine-modeling.md`** — what qualifies as a state
  machine, how to separate state dimensions, trigger vs guard vs postcondition,
  and the completeness checks.
- **`references/evidence-and-traceability.md`** — the evidence classes with
  their required treatment, the `SRC-###` source-reference scheme, the shape of a
  citation object, and the `traceability` array.
- **`references/reference-material-extraction.md`** — how to get quotable,
  structurally parseable text out of a published book or paper: look for the
  upstream typesetting source before parsing a PDF, repair the artefacts a PDF
  text layer leaves behind, parse into structured data and generate the
  reference from it, and carry the licence with the quote.
- **`references/explorer-rendering.md`** — how the explorer page draws a reference
  to an identifier: the chip (mark, name, id), the four colour families, the one
  look a component must have, and the rule that nothing in a rendered label is
  ever read back as data.
- **`references/export-contract.md`** — the contract between the verifier's
  exporter and the explorer page: what the export must carry, what each field
  *means*, and how the page renders it. Both sides are bound by one file, and a
  machine checks the binding — so a renamed field breaks the build instead of
  rendering an empty table. Read it before changing either side. It also covers
  the case this arrangement exists for: **a document cell that carries two
  shapes** becomes an object with a list per shape, and the
  flat field is replaced rather than kept beside it.
- **`references/expression-reading.md`** — how the page renders the document's
  formal rules in English: unwrapping the inline-code decoration before the tokenizer
  sees it, the vocabulary matcher, the parser's precedence, the effect reader, and
  the audit that finds every expression-bearing field the reader never reached.

**The template and the contract are two copies of one shape, and they must agree.**
`templates/domain-model-template.json` is the skeleton of the deliverable — every key,
every field, in order. The prompt's §8.1 states the same fields as an ordered list. A
field the contract names and the template lacks is a defect; a field the template has and
the contract does not name is a defect. Copy the template and fill it from the source: a
template's empty value is a question, not a fact, and a field you cannot fill is `null`,
not a guess.

**Why the vocabulary is not optional.** A methodology without an authority cannot
be checked: nothing says what "Conflicting" means versus "Overloaded", or what
makes a bounded context a bounded context, or why a rule is an invariant rather
than a precondition. The vocabulary is that authority — the aggregate-boundary
rule in particular ("use the same aggregate boundaries to govern transactions
and distribution") is what an inferred boundary must be justified against.

**The two vocabularies answer different questions.** The prompt classifies
*evidence* — is this in the document, or did you derive it? The skill classifies
*glossary status* — does this term mean one thing or several? A term can carry
both, and `Overloaded` is not a defect while `Conflicting` is. See the last
section of the vocabulary file.

**Cite the book, not your memory.** When a definition or a pattern name is
carried into the deliverable, it comes from the vocabulary file, and the
deliverable says so. The vocabulary is quoted from a published, licensed
source — keep the attribution with it.

### 2. Index the sections before reading for meaning

List every section heading and every table. The document's own structure tells you which
sections are normative, which are rationale, and which are decisions.

**Take a source inventory first.** Every document, section, and relevant identifier
gets a `SRC-###` ID, with its version, date, and authority. Then decide what the
supplied documents are: **one specification, or several with different authority?**

That decision changes the model, so record it. When documents disagree, do **not**
silently pick one — preserve both claims, identify which is newer or more
authoritative only where the evidence supports it, say which model elements are
affected, and raise a question. A contradiction resolved silently is a defect that
ships.

**Read the whole specification before concluding a concept or lifecycle is absent.**
Absence is a finding only after a complete reading.

### 2b. Establish the source inventory and scope

- List every supplied document, file, section, and relevant source identifier.
- **Register every supplied source document under a `SRC-###` ID** — one document,
  one ID — in the source inventory, with its version, date, and authority. The ID
  names the document, so it is what every citation carries.
- Where a paragraph of a source document is used as evidence, give it a `PAR-###` ID in
  reading order, scoped by its source, and record the mapping in the source/locator
  register. Keep it stable across iterations.
- Determine whether the user expects all documents to be treated as one specification
  or as sources with different authority.
- If source precedence is unclear and materially affects interpretation, record the
  ambiguity; ask one concise question only if work cannot responsibly proceed.
- Read the entire available specification before concluding that a concept or
  lifecycle is absent.
- Maintain stable IDs across all documents and analysis iterations.

See `references/evidence-and-traceability.md`.

### 3. Pass 1 — the glossary, term by term, verified across occurrences

For each domain term: what the spec defines it as, where that definition lives, and what
happens to the term **everywhere else it appears**. A term is only verified when you have
checked its other occurrences, not when you have read its definition.

Give each entry a status: `Defined` · `Defined (partial)` · `Conflicting` (two sections give
incompatible meanings) · `Overloaded` (one word, several meanings) · `Undefined` (used as if
understood, never defined) · `Pending` (depends on an open question or outside decision).

Produce three products: the glossary table; the **overloaded-term table** (word → meaning A →
meaning B → sections); and the **undefined-terms list** (term → where used → what must be
decided).

### 4. Pass 2 — roles, not people

The roles are the unit of permission and ownership. Person names are *instances* and belong in
a separate mapping table.

Flag every rule written around a person's name that should be written around a role — the
tell is that the role is reassignable, so a person-named rule silently changes behaviour when
the role moves.

Also enumerate the external systems the spec depends on, each with the direction of the
dependency and the failure consequence.

### 5. Pass 3 — reconstruct the state machines from prose

A spec typically tabulates **states** and describes **transitions in narrative**, in sections
scattered away from the state table. Reconstruct the transition table yourself.

For each transition record: from → trigger → actor → guard → to → effects, each with the
section and a short verbatim quote. Note which transitions the spec never specifies at all, and what the transitions that DO
exist assume.

**A guard over an unfilled collection is a permanent false.** Every guard reads a
gathering or a flag and, if no transition's effect ever writes that collection, the guard
can never hold and every state behind it is unreachable however well the transition
table reads. What a transition ADDS and what it REMOVES are effects, and an effect that is
not modelled is a rule the model cannot see — model the specification's own rule for what a
submit adds, what an approval removes, what the licensing match computes, and what the
ship-to realisation adds before you claim a guard holds.

The prose sections are where contradictions live, because no section was written against the
others. Cross-read the same concept across *every* section it appears in.

### 6. Pass 4 — invariants, in three registers

- **Stated** — the spec says it.
- **Derived** — it follows but is never written down.
- **Broken by construction** — the spec states it *and* prescribes an operation that violates
  it. These are the highest-value findings: they are not oversights, they are contradictions
  the spec will ship with.

### 7. Pass 5 — reachability: argue it, or compute it

The stage machine must be checked for unreachable states, dead ends, and missing
transitions. Two ways to do that, and the difference matters:

**Arguing** — read the transition table you built in §14 and trace each state's
incoming and outgoing edges. State which states are reachable and how, which are not,
and where the trace dead-ends. **This is the default.** For a spec of this size it is
what the prompt asks for, and it needs no instrument beyond the document.

**Computing** — encode the reconstructed rules as an **executable model** and let it
*traverse* what is reachable. See `references/executable-spec-model.md`.

**Computing needs the document to carry the rules in a form the model can read.** A guard
written in prose — "the customer e-mail is on file" — cannot be evaluated, so a model
that has to evaluate it must have somebody hand-encode it, and a hand-encoded rule layer
is that document's rules, written in code. To compute against *any* document, §14's
transitions carry a **guard expression and an effect expression**, §15's invariants carry a
**formal expression**, and §3.1 declares the **vocabulary** those expressions draw on.
Build the model after the document, against the rules the document already states.

**The instrument must hold no entity of the document it verifies.** The test is whether it
runs against a *second* document with no code change. An aggregate with a property per
entity, a key struct per machine, a context table listing which fields each machine
reads, a rule layer whose predicates name this document's fields — each of those fails
that test, and each of them works perfectly on the one document in front of you. When the
document lacks a field the model needs, **fix the format** — the generation rules, then
the document — not the engine: a workaround in the engine is invisible in the document,
so the next reader cannot tell which rules came from the specification and which from
the author of the model. And when you notice such a leak in your own work, say so at
the moment you find it; a silent defect presented as a finished result is worse than the
defect.

**A per-spec constant is a leak, and so is a per-spec *file*.** Hardcoding one
document's state ids, term names, or entity names into the engine fails the same test,
and it usually arrives disguised: a `const` class of one document's state ids, a
helper that builds one document's initial aggregate, a table of one document's
machines. A file whose name says which document it serves is the loudest signal of
all — if the engine cannot be pointed at a second document, the file named after the
first one is the proof. **Delete the per-spec file rather than generalising it in
place**, because generalising it in place is how a file named after one document comes
to contain the rules of another.

**Decide abstract-vs-concrete BEFORE writing the engine, and never drift.** The
question "is this verifier abstract or concrete?" has one answer, and it is decided by
whether the engine names any entity of the document. If it does, the fix is to remove
the names — not to rename the offending variables and call the result universal. An
engine that has been through a refactor and still mentions one document's terms is
concrete with better manners, and every renaming round reintroduces the leak in a form
that is harder to see. When a rewrite is requested, the acceptance test is the second
document, not the first one's results.

**State the decision you made and why, in one line, at the moment you make it.** The
reader asked "is the verifier abstract or concrete?" and the answer had to be
reconstructed from the diff. When a load-bearing choice has two defensible answers —
transcribed model or document-driven, an expression column or a hand-written rule
layer — say which one you took and what it costs, before building. Then do not reopen
it mid-task: re-deriving an agreed decision is the loop the reader is paying for, and
switching modes after the engine is half-written is what produces a file that is
concrete in the parts you forgot to generalise.

**The shape of the model is a decision too, and it is made once.** How many state
spaces the traversal runs over, what a state key holds, where an invariant is checked
— each has one right answer for a given document, and each is a change that ripples
through the parser, the key, the checker and the export. Settle them from the
document before writing the traversal, and when the reader has already ruled on one,
take that ruling as settled: re-deriving it mid-build is the churn that leaves the
engine half-migrated across two incompatible shapes, with neither of them building.
When a shape turns out to be wrong, change it in one pass across every file that
depends on it — a key, a checker and an explorer that disagree about the state space
produce numbers that are individually plausible and jointly meaningless.

**Run the model's own check before trusting anything it says.** It resolves every
expression in the document against the document's own vocabulary. A failure means an
expression names a term the document does not define — a defect in the document, fixed
in the document.

**Build the model over ONE aggregate, not one traversal per machine.** The document's
machines are dimensions of a single aggregate, so the traversal runs once over it and
the report groups the result per machine afterwards. A per-machine traversal starves
every machine whose guard reads a term another machine's transition sets — it reports
one reachable state and an exhausted frontier, which looks like a healthy result. And
the obvious repair, walking the source machine's transitions inside the target's
traversal, makes the coupling closure the whole document and the frontier stops
closing. `references/executable-spec-model.md` has the shape and the reasons.

The distinction is load-bearing. A model that visits hand-built states and prints a count
has **asserted** reachability; a model that starts from one initial state and applies
only the actions the spec permits at the current stage has **computed** it. Reachability
is computed when every reported state carries the action sequence that reaches it, and
the frontier is exhausted rather than truncated.

**When you compute it, encode each finding's reachability claim as a probe against the
computed set**, not as a narrated path. A probe is a question the model answers — "is an
application reachable in Awaiting Licensing while a non-default owner holds it?" — and a
probe that comes back NOT REACHABLE invalidates the claim mechanically. Write the
narrative path for each finding *after* the traversal, from the traversal's own path.

If a finding's narrated path does not survive — because a guard the spec states blocks
that step — then the finding is wrong about reachability. Rewrite it or downgrade it to
a spec gap. Do not defend a path the model has already refused.

**The executable model is an optional instrument, not a stage of the pipeline.** It
lives in its own project, in its own language, with its own build. The deliverable is
the JSON file. Never make the model a prerequisite for producing one, and never let the
model's numbers stand in for the analysis — they answer a different question.

### 8. Pass 6 — defect triage and grouped fixes

Rank by impact, not by how interesting the defect is. A defect that lets the workflow deadlock
outranks a wrong label. A defect that bypasses a financial or licensing control outranks both.

Separate the two kinds explicitly — they get different remedies:

| Kind | Meaning | Remedy |
|---|---|---|
| **Confirmed defect** | Two sections prescribe different outcomes for the same event | Pick a reading; amend the spec |
| **Spec gap** | The spec never says | Decide it; add the rule |

Then group the fixes by **root cause**, not by symptom. Several symptoms usually share one
cause and one fix; one issue per bug loses that.

### 9. Pass 7 — red-team your own output

Dispatch an adversarial reviewer against your deliverable with the source file and a
be-nastily-specific brief: find factual errors, overclaims, missed defects, internal
inconsistency, and anything a non-technical reviewer could not act on. A second independent
pass over the same source finds materially more than one pass does.

**Dispatch it early, then keep working.** The reviewer runs in the background and its
result arrives later; do not block on it. Fire it as soon as the analysis documents are
written, then build the model and the diagram while it runs, and fold its findings in at
the end. Point it at the documents it audits — a reviewer handed a diagram cannot say
anything about a claim in a findings file.

**Hand the reviewer the harness and the source line numbers**, and tell it to RUN the
model rather than reason about it. A reviewer given only the prose cannot tell that a
claim of mechanical reproduction was hand-asserted, and it cannot check whether a cited
line number resolves. Give it the commands to run and ask it to report the output it
got.

**When the reviewer has already found something, hand the corrector the findings, not
the raw critic.** The second agent's job is to APPLY the corrections, so it should
receive: the specific finding IDs with their subjects, the authoritative list of IDs
that exist (so it repoints a reference instead of inventing one), the verified numbers
already computed, and the instruction not to re-derive them. A corrector told to
"check the numbers first" will spend its whole budget re-running the harness, and will
poll a long command waiting for a state change that already happened — then die with
nothing written. Give it the numbers, name the output file it should read, and say
plainly that the data is already computed.

**Give each corrector a disjoint set of files.** Two agents editing the same document
overwrite each other's work. Split the documents across agents, and tell each agent
which files are off-limits.

**State the environment's hard constraints in the brief.** A child agent inherits
neither your memory nor your profile, so a constraint you hold as standing knowledge
— this language is unavailable here, that directory is out of bounds — is invisible
to it unless the brief says so. A child that quietly writes its helper scripts in a
prohibited language has produced work the reviewer cannot run, and the porting lands
on you. Put those constraints in the brief as rules, not as hints, and check the
child's output against them before folding it in.

**Dispatch the corrector on the default model unless there is a reason not to.** A
pinned model that the provider has withdrawn fails the child with a provider error
rather than anything to do with the task, and the child's output is lost. If a
delegated agent dies on a provider error, the fallback chain is the first thing to
check — a chain entry pointing at a model the provider no longer serves turns any
transient error into a fatal one.

### 10. Pass 8 — deliver the consolidated file

**A reachability claim is a claim.** The previous deliverable asserted "all
eight states are reachable" while the executable model found Awaiting Approvals
unreachable — because §6.3's "Requirements added automatically" was never modelled
as an effect, so `open requirements` was never populated and the guard that
reaches that state could never hold. Model the specification's own rule for what
a transition ADDS and what it REMOVES as effects, and check the guards that read
those sets. Then make the claim agree with the model.

**The deliverable is the skill's output, not a hand-conversion.** Run the skill's
procedure against the source specification; the previous-format analysis
(`domain-model-and-state-machines.md`) is not input to this run. Copying a record,
field or finding from it into the JSON is a provenance failure — the reader
cannot tell which rules the specification stated and which the analysis invented.
If the old format held facts the new one dropped, record them as a `SpecGap` in
`completenessFindings`, with the reason, and add the new records with their own
citations. See `references/evidence-and-traceability.md`.

**The source's tables are the floor.** Every row of the source's own tables — the
stages, the roles, the notification matrix, the questions, the outside items — is
a fact the source states. Account for each one: as a record, or with a stated
reason in `completenessFindings` that it is not modelled. Then run the gate:

```
node scripts/check-source-coverage.js <the source .md> <the deliverable .json>
```

It names every row the deliverable does not account for. A model that mentions
a row in passing has not accounted for it. Fix the model, not the checker.

**The deliverable is the prompt's file.** `references/spec-processing-prompt.md`
requires **one** consolidated `domain-model-and-state-machines.json`, with the
top-level keys, the record fields, the identifier scheme and evidence classes it
fixes. Produce that file — and produce it from the per-pass analysis, not beside
it. Write it in the directory the reader is working in, beside the source document,
unless they name another destination: the prompt fixes the file name, not the path.
The separate glossary/context/state-machine/issues files are working notes; the
consolidated file is the artifact, and its `traceability` array is what lets a
reviewer follow a claim back to the spec.

**The file is the whole job.** Everything below is optional and comes after it:
an interactive page is a *view* of the deliverable, for a reviewer who would rather
explore than scroll. Build one only if the reader asks. See
`references/interactive-diagrams.md`.

**The HTML carries every value it shows in ONE embedded JSON document.** A figure
typed into the page goes stale the moment the model changes, and the artifact then
asserts numbers the model no longer produces. Export the computed result as JSON
from the harness and have the page read it — and put the page's *other* data in the
same document, because two sources means the copy you forget is the one that drifts.

**The page is a RENDERER, not a reader: every value it shows comes from the embedded
JSON.** Not from the document, not from a file beside it, not from a rule the page
knows. The page's own code decides how a value is DRAWN — how a row is laid out, how
a link is made, how an expression is read in words — and it decides nothing about what
the value MEANS. A page that works out a document cell's meaning has the document's
structure in two places, and the reader cannot tell which of the two the artifact
believes.

**Embed the JSON in the page, and embed the document's STRUCTURE in it too.** A
`fetch()` of a sibling file is blocked when the HTML is opened from disk (`file://`) —
exactly how a reviewer opens it — and the failure is quiet: the page renders with the
data-driven views empty. So the JSON goes in a script block inside the HTML. And the
export carries the document's structure **resolved**, not as raw cells: the page must
not parse the document's cells, because that puts the structure in two places — the
engine's parse and the page's re-parse — and the two drift apart. Ship the resolved
state ids and the hierarchy (machine → states → outgoing/incoming), and the page
reads both from the export.

**The same rule applies to document-derived data.** When the page also summarises the
findings document — severities, titles, which findings each issue groups, how many
tests back each finding — those arrays are a second copy of the document, and a copy
drifts the moment the document is corrected. Hand-maintained copies drift in the
directions that matter most: a severity that was downgraded, a finding added after
the copy was made, an ID that exists in the page and in no heading. **Generate those
arrays from the document** with a script that parses it and rewrites the page, and
rerun that script after every correction. Deriving the page from its source makes
"the page reflects reality" structural instead of a promise you have to remember to
keep.

**Build the page as a pipeline, not as a hand-edited file.** The reader's artifact is
the page, so every value it shows needs exactly one upstream source and one command
that rebuilds it:

```
source.docx ──convert (skill)──> spec.md           headings, lists, tables
spec.md     ──resolve─────────> cited section text spec-owned prose
analysis    ──parse──────────> findings + issues    document-owned claims
                          └─> explorer-content.json ──embed──> explorer.html
```

**The page is optional.** It is a *view* of the deliverable, for a reviewer who wants
to explore rather than scroll. It never replaces the consolidated document, and it is
never a prerequisite for producing one. If the reader wants only the document, the
document is the whole job.

**A citation is a pointer; resolve it to the spec's own words.** When a column cites
a section, the reader does not have the document open, so the artifact should carry the
text that section holds. Resolve it in the generator, from the converted Markdown, by
the section number the analysis already cites — the same way the findings come from
the document that owns them. Then a corrected spec reaches the artifact when the
generator is re-run, instead of the page and the document drifting apart.

When the page is the deliverable a human reviewer reads, this is the difference
between an artifact that is current and one that is merely recent. See
`references/interactive-diagrams.md`.

---

## Evidence discipline

**Every claim carries a section reference and a short verbatim quote.** "Unstated" is a
valid, load-bearing finding — it is often more useful than a plausible guess, because it
names the hole for the team to fill.

Quote the document; never paraphrase a rule into a stronger claim than the text supports. If
the doc says the owner "is emailed", that is not the same as "the owner is notified of every
event" — do not widen it.

A finding is **confirmed** only if you can point at the two sections that disagree, or at the
sequence of permitted actions that reaches the bad state.

**Label the evidence class on every claim.** `EXPLICIT` · `INFERRED` · `CANDIDATE` ·
`CONFLICTING` · `UNSPECIFIED`, per the processing prompt. An `INFERRED` claim carries its
reasoning chain; a `CANDIDATE` says it needs a domain expert to confirm. **Never present
an inferred rule as an explicit requirement** — that is the one failure the whole scheme
exists to prevent.

**An inference shows its work.** The facts used, the reasoning connecting them, the
conclusion, the alternative interpretations if material, and what a stakeholder must
confirm. Never cite a source as saying more than it actually says, and never invent a
section number, requirement ID, or quotation.

**Give source references their own IDs — and make the ID name the DOCUMENT.**
`SRC-001`, `SRC-002`, … — one per source document, registered in the source inventory,
reused consistently, so the traceability matrix can point at them instead of repeating a
location string in every cell. The ID names the document, and the locator that follows
names the place inside it.

**A citation is mandatory, and it is an object.** Every record that asserts something
carries an `evidence` array, and every element of it names the source document and the
place inside it:

```json
{ "source": "SRC-001", "locator": "§6.3" }
{ "source": "SRC-001", "locator": "PAR-014" }
{ "source": "SRC-001", "locator": "§3.2" }
{ "source": "SRC-002", "locator": "§5" }
```

Never cite a filename, a document title, a section, a page, a requirement ID, a
paragraph, a table or a row by itself — always carry the registered source id beside
the locator. `§6.3` alone is not a citation, because it names no document. If no
reliable locator is available, the locator is `null`: `{ "source": "SRC-001",
"locator": null }`. Never invent a locator.

**One citation object per place, and never a range.** `§§4–6` compresses several
sections behind one id, so the reader cannot tell which document each cited section
belongs to — and the locator carries exactly one place by construction. Cite each
section separately, each in its own object.

**A paragraph is located by `PAR-###`.** Paragraph locators use the identifier format
`PAR-001`, `PAR-002`, …, assigned sequentially in reading order within each source
document to the paragraphs used as evidence, and kept stable and scoped by the source ID.
`{ "source": "SRC-001", "locator": "PAR-014" }` is paragraph 14 of source `SRC-001`.
**Never use the paragraph glyph as a locator**, alone or beside an id — use `PAR-###`,
and if a paragraph cannot be reliably identified, cite the source ID and another
locator you can verify.

See `references/evidence-and-traceability.md` for the full convention and its validation
gate.

**Never renumber an existing ID.** An ID that changes under you breaks every
cross-reference and every matrix row that names it. When a finding is added, take the
next free number. When one is withdrawn, mark it withdrawn — do not reuse its number.
Keep the registry of every ID ever issued in the document's traceability section, so a
reader can tell a withdrawn ID from a typo.

**Give each ID series a disjoint block, and check the references outside the section
that defines them.** A document whose sections each number their own records — one
section's transitions, another's states, another's findings — must not let a later
series restart inside an earlier one's range. Two series that both begin at TR-030 make
every reference to TR-030 ambiguous, and the reader cannot tell which one a citation
points at. Number the first series, then continue the count for the next, and verify
that the numbers defined and the numbers referenced are the same set.

The check that catches it is mechanical: collect every ID that appears anywhere, collect
every ID that is defined, and compare the two sets. A reference that resolves to
nothing, or resolves to two things, is a defect in the numbering — not a typo to
paper over. Fix the numbering, then re-point the references.

**Distinguish an invariant from a precondition.** An invariant must hold always, across
every operation, for the object as a whole. A precondition holds for one operation only.
The Aggregates pattern settles it: invariants are defined for the aggregate as a whole and
enforced by the root; a precondition guards a single transition.

**Label a transition that does not exist, do not leave it blank.** Four distinct
meanings, and conflating them is how a gap becomes a false defect:
`EXPLICITLY FORBIDDEN` (the source prohibits it) · `UNSPECIFIED` (the source is silent) ·
`AMBIGUOUS` (the source supports more than one reading) · `CANDIDATE` (inferred, needs
confirmation). **A missing transition is not a forbidden transition** — the silence of a
spec is not a prohibition. For the same reason, write `Not specified` or
`Needs clarification` in a table cell rather than leaving it empty: an empty cell reads
as "nothing to say", and a blank is how ambiguity hides.

## Pitfalls

**THE EXPLORER'S OWN UI RULES LIVE IN `references/interactive-diagrams.md`** — filters,
sorting, the generator, layout, escaping, and the browser harness. They are stated
there once and in full; the rules below are the ones that reach past the explorer.

- **Unwrap Markdown decoration BEFORE comparing a cell to a sentinel value AND before
  reading it as an expression.** A cell
  reading `` `not expressible` `` is the sentinel `not expressible` — the backticks
  are decoration, and a comparison made against the raw cell misses them, so every
  unexpressible condition is reported as evaluable and the whole unchecked set
  silently becomes a checked one. Strip the decoration first, then compare, then
  read. This is a rule about the SOURCE's cells: the deliverable states the kind
  outright — `expression.kind` is `notExpressible` — so nothing in it carries
  decoration to unwrap.
  parse; the order is the difference between an honest coverage report and a wrong
  one.
  **The reader on the page side has the same defect, and it is quieter.** The
  decoration is stripped before a comparison but not before a TOKENIZER, whose
  default branch discards the characters outside the grammar — so the backticks
  vanish and `` `true` `` reaches the keyword reader as the literal `true`, which
  is read as the answer "Yes". A constant-true guard then says yes/no instead of
  saying there is no condition, and every such guard in the document is wrong the
  same way. Unwrap once at the top of the reader, and give every reader of the same
  language the same unwrap — a fix applied to one and not the other is a defect
  waiting for the other call site.
- **A Markdown table parser must skip separator rows.** A header edit that adds a
  column without removing the old separator leaves two separator rows, and the
  parser that skips only the second row reads the first one as data — a phantom
  record whose fields are dashes. It reaches the output as a finding, a term, or a
  transition, and it counts toward a total the reader trusts. Reject any row whose
  cells are only dashes and colons, whatever its position.
- **A record's heading is not always numbered like its section.** A document that
  puts its scenarios under `### SCN-001 — …` while its other headings carry a
  section number (`### 7.1 AGG-001 — …`) defeats a parser whose heading regex
  requires a digit-led number: the scenario heading never enters the branch that
  collects it, and the series comes back EMPTY with no error anywhere — a missing
  series that a catalogue check then reports as a series the export omitted.
  Match each heading on the shape it actually has — the id pattern, the section
  number, or both — rather than on the one the first example used. Check a
  collected series for being empty before believing it was absent from the
  document.
- **One section can hold two different tables.** A section whose first table is a
  role inventory and whose second is a set of numbered rules parses as one table,
  and every rule row lands in the role records or is dropped. Route a row by what
  it CONTAINS — a cell holding an id of the series being collected — not by which
  section it is in.
- **A record whose body is structured content must keep that structure.** An
  aggregate's aspect table and a scenario's labelled bullet list are not one
  paragraph each: flattening them to a string loses the breakdown the reader
  consults, and the page then shows "Content" instead of the root, the members
  and the consistency expectation. Parse the aspects and the parts as records and
  carry them through the export — the detail panel shows what the document says,
  not a summary of it.
- **The export must carry what the page needs to READ the document, not only what
  it needs to COUNT it.** A page that reads an expression in words needs the
  vocabulary — the terms, their types, and the values they may hold — in the export,
  because the page cannot parse the document and the vocabulary is what turns
  `state != 'ST-006'` into "the current state is not Approved". A count-only export
  forces the page to hardcode the document's terms, which is the per-spec leak the
  engine rules forbid, one level up.
  **The same holds for the document's identifiers: the export must carry every series
  the document issues, with the name each id carries.** That catalogue is what lets the
  page turn `VO-004` into "setup information" instead of showing a bare handle. A
  series the export omits has nothing to decode into, so the page shows the id as an
  unexplained token — and the reader cannot tell whether the analysis skipped it or
  the id is meaningless.
  **It must also carry the document's STRUCTURE, resolved.** When the page re-parses
  a From/To cell to work out which state a transition belongs to, the document's
  structure lives in two places — the engine's parse and the page's re-parse — and
  they drift: a cell naming five states was resolved to five by the engine and to one
  by the page. Ship the resolved ids (`fromStates`, `toStates`) and the hierarchy
  (machine → states → outgoing/incoming),  so there is one resolution of the
  document's structure and the page never parses a cell.
  **The rule is not about structure alone: the page may not DERIVE anything from a
  document cell's text.** A cell may be shown; it may not be interpreted. Whatever
  the cell holds — a name beside a code, ids written as a range, a marker where a
  value would be, two shapes in one column — the exporter resolves it once and the
  page reads the result. **A cell that mixes two shapes is shipped as one list per
  shape**, the flat field is REPLACED rather than kept beside it, a scope that
  covers EVERYTHING is written out as the list it covers, and the resolution is the
  ENGINE'S — the same result the rule was judged by, so the export and the analysis
  cannot disagree. `references/export-contract.md` states each of these in full,
  with the mechanism behind each.
- **Gather what a step needs once, then act.** Re-reading files already read in the
  same session is not diligence; it is a loop, and the reader waits through every
  turn of it. Read what the step needs, keep the facts, and make the change.
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
- **Read what you need in one batched pass, then act on it.** Re-reading a file to
  re-derive a fact already in hand is the loop, not the thoroughness: the context is
  what the next edit needs, and a second pass over the same file only delays it.
- **Identity is an id, and it travels as data.** A component that names a thing
  carries that id in a data attribute, and the checks compare ids with ids. Never
  infer an id from a rendered label: that guesses at identity by string.
- **Do not re-read a file whose contents are already in context.** Batch the
  reconnaissance into one call, then act on what you know.
- **`references/explorer-rendering.md`** — how a reference is drawn.
- **The contract between an instrument and what it consumes must be written down.**
  The export JSON is the only thing the engine and the page share: the engine emits
  a field, the page reads a name. **Put a schema version and a required-field list
  in the export, and have the consumer assert them.** The same rule
  governs anything an instrument reads: the shape it depends on is stated, and the
  thing that consumes it checks.
  **A contract that describes the consumer needs a checker against the consumer too.**
  A contract that names the page's tabs, columns and filters drifts from the page's
  code exactly as it drifts from the data, and nothing notices until a reader meets a
  column the contract does not have.
  **And the consumer must DERIVE what it knows from the contract, not from a list
  written by hand.** The identifier scheme is a property of the OUTPUT FORMAT: the
  explorer defines it, so every document that goes through it comes out with the same
  prefixes and different content, and a literal list of prefixes in the page is a
  legitimate statement of the format, not a leak. What is not legitimate is writing
  that list again in the engine, again in the page and again in the checks — three
  copies drift and nothing reports it. The export already carries the catalogue, so
  derive the pattern from it. A status vocabulary or a tab list IS document-specific:
  build the filter's options from the values the data carries, because a filter whose
  buckets are written from memory collapses into one useless bucket on the next
  document.
  **The CHECKS are a second consumer, and they leak the same way.** An assertion
  that says "the header mentions the specification" hardcodes one document's word in
  the one file whose job is to work for any document — and the export already
  carries what the export is a model OF, so the assertion compares the page against
  that instead. The page must read the document's words from the export for the
  same reason: a literal in the page is a per-spec leak one level up from the
  engine's, and a check that names the document's words passes on this document
  and fails on the next one — or is quietly edited each time the document changes,
  until nobody is left holding the rule.
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
- **When the contract's vocabulary cannot express what the page does, WIDEN the
  vocabulary — do not reshape the page to fit the vocabulary it already has.** A
  detail panel whose tables are ALTERNATIVES (tabs the reader switches between) is
  not two tables side by side, so the contract's left/right pair would be a lie; the
  contract gained a per-table column map for exactly that case. The same applies to a
  field the page reads and the contract does not name, and to a column the page
  renders and the contract does not list. The contract is format-level and is meant
  to be widened; the page is the artifact the reader asked for.
- **An assertion that compares what the page SHOWS with the document's RAW string
  must render the expectation through the page's own helper.** The page renders
  Markdown emphasis — `**or**` becomes bold — so the raw source keeps the asterisks
  and the comparison fails on any emphasised text, and the failure reads as "the
  field is missing" when the field is on screen. Build the expectation by passing
  the source through the page's own cell renderer and reading its text, so the
  assertion compares like with like.
- **A document that lists ids as a RANGE with a reference to another record means
  that record's ids within the span.** "INV-001…INV-011 as in Draft" says the
  invariants DRAFT holds whose numbers fall in that span — not every id between the
  endpoints. Read literally, the range hands a record rules the document never gave
  it, because the ids in between are scoped to the referenced record alone. Resolve
  the shorthand against the document's own records, and tell the reader the list was
  written as a range.
- **Do not infer the domain model from the data model.** The five classic
  shortcuts, each of which is wrong most of the time: entity from every noun;
  value object from every structured field; aggregate from every parent-child
  relationship; domain event from every system notification; domain service from
  every operation. Look instead for identity, business behaviour, lifecycle,
  consistency requirements, and language boundaries. A report, a screen, a DTO,
  or a database-shaped record is not a domain entity without behavioural
  evidence.
- **A value object is not "a thing with no ID".** It is a concept whose *meaning*
  is its values — money, an address, a quantity, a date range, a percentage, an
  identifier-as-value, a set of policy parameters. The absence of an ID in the
  specification is not the test; the question is whether identity carries any
  business meaning.
- **A bounded context is not an organisational department.** The evidence is
  linguistic and behavioural: the same term meaning two things, different rules
  or lifecycle semantics, a separate business capability, different ownership of
  the truth, or translation between models. When the spec does not establish the
  boundary, mark the context a **candidate** — and say what evidence would settle
  it.
- **Do not group objects into an aggregate because the spec mentions them together.**
  The Aggregates pattern gives the evidence: an aggregate is a cluster with a root,
  where external objects hold references to the root only, and — the operative
  rule — **the same aggregate boundaries govern both transactions and
  distribution**. Within a boundary, consistency rules apply synchronously;
  across boundaries, updates are handled asynchronously. So the question for a
  candidate boundary is not "are these related?" but "must these be consistent
  with each other, in one transaction?" If the spec never says, the boundary is
  `CANDIDATE`, and the deliverable says so.
- **Search for implicit state machines; do not wait to be shown them.** A spec
  describes states in a table and transitions in narrative, scattered across
  sections that were never written against each other. Look for conditional
  behaviour, allowed and forbidden operations, permission changes, preconditions
  that depend on prior actions, time-dependent rules, and flags whose
  *combination* determines a condition. The prompt classifies each machine as
  `Explicit` · `Implicit` · `Partially specified` · `Candidate` — with the
  evidence that decided it.
  **A reader's first question about a reconstructed diagram is whether the document
  states it or the analysis assembled it — so the diagram answers it unasked.** The
  classification is not a footnote on the machine; it is the difference between the
  document's model and the analyst's reconstruction, and a reader who cannot tell
  them apart reads the reconstruction in the document's voice. Carry the KIND and the
  REASON apart as two fields — the cell that holds them is one sentence, and a
  consumer that re-parses that sentence to recover the kind has put the document's
  structure in two places, which is the drift the export exists to prevent.
- **A field named `status` is not a state machine.** The prompt says it
  explicitly, and it is right: a machine is a set of states with transitions
  between them, and a field holds one value. Prove a machine by exhibiting the
  behaviour that differs per state.
- **Do not collapse independent state dimensions into one large machine.** Two
  dimensions that advance independently are two machines, and merging them
  produces a combinatorial state space with states that never occur.
- **Do not invent the missing transitions to complete a machine.** Name the gap
  and say what must be clarified. A machine that looks complete because you
  filled its holes is worse than one that visibly has them: the first hides a
  spec defect, the second surfaces it. This is why `UNSPECIFIED` exists.
- **Do not report a reachability claim the traversal did not produce.** The
  completeness analysis asks whether every state is reachable, whether there
  are dead ends, and whether the frontier closed. Answer it from the computed
  set, not from inspection.
- **Do not inherit an artifact from a previous workflow — and do not go looking for
  one.** A model, an extractor, or a findings document that was produced against an
  earlier version of the spec answers an earlier question. Citing it is fine; citing
  it *as this run's result* is not, and the reader cannot tell the difference.
  Searching the tree and its history for such an artifact is the same error one step
  earlier: reconnaissance nobody asked for, spent before the first real step.
- **Convert the input with the skill; never hand-roll an extractor.** The
  conversion stage is the front door of the whole pipeline, and it is where the
  document's structure is decided. Microsoft's `github/awesome-copilot`
  instruction set (`convert-word-to-md` / `convert-pdf-to-md` /
  `convert-excel-to-md`) runs MarkItDown and produces what the analysis needs:
  real headings, real lists, and **tables as Markdown tables**. A hand-rolled
  unzip-and-strip flattens the spec's tables into one loose word per line — and
  a spec's tables are evidence. Flattened, they are unreadable and uncitable.
  See `references/evidence-extraction.md`.
- **The Hermes venv has no `pip`.** The conversion skill needs Python 3.10+ and
  `markitdown`; use `uv` with an isolated environment rather than assuming
  `python -m pip` works:
  `uv venv "$TMPDIR/mdvenv" --python 3.12` then
  `uv pip install --python "$TMPDIR/mdvenv/Scripts/python.exe" "markitdown[docx]>=0.1.0"`.
  Put the venv in the scratch directory — a bare `mdvenv` path creates it in the
  working directory, beside the source document and the deliverable, where it reads as
  part of the output.
- **A folder of mixed input needs ALL the sibling skills.** `.docx`, `.pdf` and
  `.xlsx` each have their own conversion skill; invoking only one silently
  skips the others.
- **Do not widen the scope to find the system.** Sweeping sibling paths for "the real app" is
  the single most reliable way to lose the user's trust on a document-reading task. The
  document is the scope.
- **Re-read what you already have before you build a reader.** When a request names a
  column or a field ("show the evidence texts from the Evidence column"), the text is
  usually already in the artifact you built, and the citation in that cell points at
  section text sitting in the extract you already parsed. Writing a second extractor
  for the source format duplicates a source of truth and is work the task never asked
  for. Reach for the file you have, then for the extract you already made, and only
  then consider parsing the original.
- **Read the region you are about to change; do not survey the file to re-derive what
  you already know.** When the artifact's format is fixed by rules you have read, a
  grep that re-establishes what the file contains returns nothing and costs a turn.
  Read the lines the next edit touches — `read_file` with an offset — or the whole file
  once when it is small, then act on what you read.
- **A definition is not a verification.** Reading a term's definition once proves nothing;
  the term's other occurrences are where it changes meaning. Check them.
- **Cite the doc's own sections as the anchor.** `§` numbers are what the author wrote and
  what the team will use; line numbers drift the moment the document is reconverted. When
  you do carry a line number — because the reader needs to look it up — it must
  actually resolve: check the quoted fragment appears at the line you cite, and state
  the extract's line convention in the deliverable.
- **Diff the "required" markers against the validation list.** Collect every field the spec
  marks required, and every rule it says holds, then subtract the list the spec actually
  validates on submit. The difference is a real hole, found mechanically.
- **A spec that states an invariant and also sanctions an operation that breaks it is not
  an oversight — it is a contradiction.** Name the two sections and say which one you would
  implement and why.
- **One constraint has knock-on effects nobody wrote down.** "One role per user" implies
  single-holder semantics for every reassignable role, and every rule that assumed two
  holders is now wrong. Follow the constraint to its consequences.
- **Do not assert reachability against code you have not read.** If the spec has no
  implementation behind it in the workspace, prove reachability against a model *of the
  spec*, and say plainly that the model is the subject. See the scope gate.
- **A hand-built state list is not a reachability proof.** Visiting snapshots you
  constructed by hand proves only that your construction was possible, not that the
  spec's rules permit it — a state reached by writing a field directly bypasses every
  guard. Compute the reachable set by traversal and report the paths.
- **Every field an invariant or action can read must be in the traversal's state key.**
  A field left out makes two different states collide in the visited-set, and the second
  is then never explored — so the violation it would have revealed disappears with no
  error. A missing field in the key hid an entire invariant class.
- **Probe the findings; do not narrate them.** Encode each reachability claim as a
  question against the computed set. A probe that answers NOT REACHABLE is the mechanism
  that catches an overclaimed path — and a probe that contradicts a finding you were
  confident about is usually pointing at a missing field or a missing guard.
- **The state space must stay bounded or the frontier never closes.** An action that
  appends without limit makes the traversal hit its cap, and a truncated frontier is an
  asserted result wearing a computed result's clothes. Enforce the spec's own
  cardinality rules in the effect, and report whether the frontier was exhausted.
  **An engine's own boolean must be a property of the engine, not a reading of its own
  output.** A field reporting on the engine's behaviour — did the frontier close, was the
  bound reached — is computed by asking the engine. A substring test over the log it
  printed is true on every branch when the branches mention the word, so the field was
  permanently true while the log beside it said the opposite, and the page repeated the
  false claim to the reader. Expose the boolean; let the export read it.
  **And the bound travels with the count.** A figure reached under a cap is a property of
  the cap, so the export carries the bound and the page shows it beside the number —
  a reader who cannot tell a bound artifact from a genuine defect inherits the doubt on
  every number on the page.
- **A violation count is not a finding count.** The bound that keeps the frontier
  closing also shapes WHICH states the traversal reaches: it edits one field at a
  time, so the reachable set includes half-filled forms. An invariant about a
  completed form — "the customer type is one of the ERP list values" — then fails in
  every one of those states, and the count is a property of the BOUND, not of the
  specification. Say in the report which violations the bound accounts for and which
  survive in a state where the bound could have reached further: a reader who cannot
  tell a bound artifact from a genuine defect inherits the doubt on every number in
  the report. `references/executable-spec-model.md` has the diagnostic.
- **Do not leave the deliverable half-migrated.** A layout rewrite that changes the
  markup but not the scripts that read it leaves a broken page. When the structure
  changes, change the markup and the code that drives it in the same pass and re-verify
  in the browser before moving on.
- **When the reader redirects a placement, offer concrete options in ONE question.**
  "I want to place them differently" names a decision, not an answer — guessing the
  intended arrangement costs a rebuild and then a correction. Give three or four
  concrete placements in a single question, each a sentence saying where the thing
  lands and what the reader sees, so one reply settles it. Rebuilding to the first
  plausible reading is the expensive way to ask the same question.
- **Answer the question that was asked.** A question about the workflow, the method, or
  what a deliverable looks like is answered by the method — not by building the thing.
  When the reader asks "what are we developing?", answer that; do not start writing
  scaffolding. When they ask how to invoke this in a fresh session, give the invocation
  and stop.
  **The frame the reader states narrows the question.** "We are talking about the
  contract" is not one topic among several — it IS the question. An answer that works
  on a different layer (a different file, a different phase, a different design) reads
  as not having heard them, and costs a turn to be told. Take the frame as the
  question, answer inside it, and put anything outside it in one line or not at all.
  **Deliver the shape that was asked for.** A request for a list gets a list — items, one
  line each, grouped under the headings that organise them, with no paragraphs arguing
  the case around them. A request for a plan gets steps; a request for a feasibility
  answer gets a measured fact and its named consequence. The shape is part of the ask,
  and prose wrapped around a list reads as padding an answer the reader did not want.
- **Execute the agreed plan instead of re-deriving it.** Once the reader has approved a
  plan, the remaining turns are that plan's steps — not a fresh analysis of whether it
  is still the right plan. Restating it, asking which step comes first, or announcing
  what the next step will be reads as looping and spends the budget the execution
  needs. When the budget is tight, spend what is left on the fix and its verification:
  a summary describing an unexecuted plan is worth less than one line of state.
  **The reconnaissance is spent, not renewed.** The reads that informed the
  questions are the reads; answering the questions does not invalidate them. A
  turn that re-opens files already read — to re-confirm a signature, re-check a
  shape, re-establish what a file holds — spends a step of the implementation and
  reads as hesitation to a reader who asked for the work and is watching it not
  start. When the answers name the shape, the next action is the edit.
- **One task at a time, and finish the one you were given.** When the reader narrows
  the ask — "one task at a time", "fix the verifier", "verifier first, then the UI" —
  that narrowing is the plan. Do not start the next task while the current one is
  unfinished, and do not widen the current one to include it. A half-finished
  verifier plus a half-built page is two broken things instead of one finished one,
  and the reader has to re-establish which of them is actually in progress.
  **And when the named task IS finished, stop and wait for the next instruction.**
  Rolling into the improvement you spotted instead of delivering the ask makes the
  reader interrupt you to get the thing they asked for; state what landed, what is
  verified, and what is deliberately not committed, then wait.
  **An operational instruction is executed literally, on the next call.** "Regenerate
  the UI", "commit", "run the tests", "rebuild" — the command is known, so run it and
  report what it returned. Do not spend turns reading adjacent files to decide what
  else the instruction might license, and do not fold a self-assigned improvement
  it: a rebuild that becomes a feature plan is a rebuild the reader did not ask for,
  and the drift surfaces as the reader asking why you are stuck.
  **And a terse reply to YOUR question is an answer only when it names the question.**
  "Regenerate the UI" after you asked "implement these six promises, or weaken the
  contract?" is an instruction to regenerate — not a decision to implement. The reader
  answers in the register they use for instructions, and an instruction that names an
  action is that action. Read it as what it says, and put the still-open question back
  in one line rather than inferring an approval that was never given.
- **A blocked task is a blocker to name, not a reason to re-plan.** When the current
  task cannot proceed, say what blocks it and what would unblock it, and stop. Do not
  start a neighbouring task, re-derive the architecture, or widen the scope to fill
  the gap — each reads as derailing, and the reader asked for one task because the
  budget only covers one.
- **Stop the background work when the reader says stop.** A dispatched reviewer,
  corrector, or helper keeps running and keeps spending budget after the reader
  has said to stop or to narrow the task. Stop what is running, and say what you stopped.
  A subagent that completes after the task was narrowed returns a result nobody
  asked for, and folding it in re-opens settled ground. **And stop the reconnaissance,
  not only the background jobs.** A restatement of the task after a stop is a narrowed
  plan, not permission to resume the wider sweep that was interrupted: the narrower ask
  is the whole remaining work, and everything outside it waits its turn.
- **Ground a design proposal in a measurement, and answer the feasibility question with
  facts.** When the reader asks whether something is possible — "explain me is it
  possible", "what needs to be done" — the answer is a measured fact and a named
  consequence: the size of the export, the count of records a view would have to
  render, the field that is missing, the number of places a list is written down. Not
  a menu of architectures with invented names for the options, and not a preference
  dressed as a finding. A proposal whose premises are assumed reads as invention, and
  the reader spends a turn telling you which invented parts to drop. Measure first —
  read the shape of the data, count what is in it, and let the constraint choose the
  design; then state the design as a decision with its cost.
- **Do not report a fact you have not verified, and do not dress a guess as a
  finding.** A claim that a document's cell is truncated, that an expression is
  malformed, that a state count is too low — each needs the mechanism shown. When a
  diagnostic tool reports a discrepancy, check the tool before you believe it: a
  splitter that treats every `|` as a cell boundary will "prove" a healthy row is
  corrupt, and reporting that costs the reader a rewrite of a correct document. Say
  what you checked and what it showed. **Verify the tool's own output before
  concluding the tool is wrong too**: a naive cell splitter reports a row as
  truncated when the row simply contains the language's `||`, and believing it sends
  you to repair a correct document. Dump the raw bytes of the suspect cell and read
  them before naming a defect.
- **Price written-but-unrun code as written, not as working.** When asked how far
  along a build is, an honest percentage discounts code that has never been compiled
  or executed, and says so — the reader is budgeting the remaining work, and a number
  that counts unrun code as done is a number that misleads them. Give the percentage,
  the per-component breakdown, and the discount with its reason in one line each; a
  reader who needs the detail can ask for it. Do not round up to reassure, and do not
  hide the unrun work behind a summary that reads as finished.
- **Do not report a defect you already know how to fix.** Finish the fix and re-verify
  it, then report. A report that names a known defect and hands it back to the reader
  is a delivery in name only, and it reads as "the work stopped here" — the reader
  then has to ask for the rest. If a defect genuinely needs a decision the user has
  not made, say so and ask; but a defect whose fix you are already holding is yours
  to finish before you summarise. And say it the moment you find it: a defect you
  noticed and stayed silent about is a defect you chose to ship.
- **A summary that says "X is still wrong" is an unfinished task, not a report.** When
  you know the next command and the next file, the work is not done — the reader is
  paying for the fix, not for a map of it. End the turn with the change landed and
  verified. When the budget genuinely runs out mid-fix, name the one command that
  continues it, so the next turn starts from the fix rather than from the diagnosis.
  **A feature that spans layers is delivered in all of them or not delivered.** When
  the ask spans the engine, the export and the page, building the engine half and
  listing the page half under "what remains" is a partial delivery wearing a
  summary's clothes: the reader has to ask for the rest, and the next turn opens by
  rebuilding the context for work that was already agreed.
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
- **Re-dispatch a failed child on the default model; do not repair the user's global
  config inside the task.** A delegated child that dies on a provider error is fixed
  by re-dispatching it unpinned. Editing the agent's own provider chain is a change
  to the user's environment, outside the task's scope — flag it and let them decide.
- **A defect test that asserts your own recommended fix is circular.** If the test
  demands behaviour the spec never states, its failure proves your recommendation is
  absent, not that the spec contradicts itself. Label every defect test by kind —
  *contradiction* (the spec states two incompatible things) or *gap* (the spec is
  silent) — and keep the counts separate in the deliverable.
- **The evidence column must be cross-checked against the tests that exist.** A tick
  claiming "reproduced" for a finding with no matching test is a false claim, and a test
  filed under a different ID hides it. Verify every ID referenced in the deliverable
  resolves to a real test, and reconcile the summary count with the count of tests.
- **One document owns the finding-ID namespace.** Cross-references between documents
  drift into IDs that were never defined. Keep the definitions in one file, and
  mechanically verify that every ID referenced anywhere resolves to a heading there.
- **Verify that a line citation resolves before shipping it.** A flattened extract puts
  each table cell on its own line, so "line N" is not "paragraph N" and a quoted row
  cited by line lands on the wrong text. The extract's own header may claim a
  convention it does not follow — check the claim against the file rather than
  repeating it.
- **Distinguish "the spec contradicts itself" from "the spec is silent"** in every finding
  header. Conflating them produces fixes that patch the wrong sentence.
- **Never quote a rule with a person's name where the team reasons in roles.** Rewrite it.
- **Group fixes by root cause.** An issue that carries several findings is the unit that
  closes; one issue per finding is bookkeeping, not engineering.
- **Never end a turn silently when the tool budget runs out.** Name the file, the error,
  and what is left. A silent stop reads as "done" and hides a broken artifact the user
  cannot see — they will find it themselves and stop trusting the rest of the report.
  When a rework lands halfway, say plainly which parts are wired up and which are not,
  and say if the artifact is currently broken. **End with the next command, not with a
  summary of the plan** — "here is what is broken" without "here is the command that
  fixes it" still leaves the reader choosing, and a restated plan reads as a stop.
- **Verify each artifact the moment you write it.** A defect introduced in the last
  twenty minutes of a long session is invisible to a summary written from memory, and
  a summary that claims more than was checked is worse than one that admits the gap.
- **Apply the known fixes together, then rebuild and test once.** When several defects
  are already diagnosed, patching them one at a time and re-running the whole build
  between each spends the budget on repetition and leaves the artifact unverified when
  it runs out. Batch the independent edits into as few passes as the tooling allows,
  then rebuild, re-export and re-test once. The corollary: a status-only turn — one
  that reports what is broken without changing anything — costs a turn and delivers
  nothing, so when the next command is known, run it.
- **Check whether the deliverable is still current against its source.** An artifact
  rebuilt from hand-entered numbers drifts from the model the moment the model changes.
  Compare timestamps and the figures themselves before reporting that the deliverable
  reflects the latest analysis — the question "is this based on the most recent data?"
  deserves a real check, not an assurance.
  **The deliverable must not misdescribe the analysis that produced it.** The document
  states its own coverage — what was checked, what was found, what the model could not
  reach — and those statements are claims like any other. A document that says no
  executable model was built, or quotes a figure from an earlier run, tells the reader
  something false about the very artifact they are holding, and no checker compares the
  document's self-description against the instrument.
- **A tool that writes must never be able to write over the file it reads.** An export
  command whose first argument is BOTH the input document and the output path replaces
  the deliverable with its own output on the first run — and nothing recovers it, because
  the deliverable was hand-built, unique, and not under version control. Take the input
  and the output as separate arguments and refuse when they resolve to the same file.
  Before any instrument runs against the deliverable, put the deliverable under version
  control: a hand-built document with no copy and no history is one typo from gone, and
  the recovery is reconstruction rather than restoration.
- **The skill's own rules live in a repository; commit them there.** When a skill's
  references, templates or scripts are changed, the change belongs in the skill's
  repository, committed and pushed — not only in the local profile directory, where a
  reinstall or a curator pass discards it and no diff survives. Check the repository
  before concluding that a skill is unversioned: a local `git` probe that finds no
  repository says nothing about a remote that holds it. The installed copy and the
  clone drift apart, so diff them before pushing and carry the changes across — and
  diff on CONTENT, not on bytes: a checkout and an installed copy can disagree on
  line endings alone, which reports every file as changed and hides a real edit in
  the noise.
## Verification

Before delivering:

1. Every glossary entry has a definition source and a status.
2. Every transition row cites a section; every "unstated" transition says so explicitly.
3. Every finding is labelled confirmed-defect or spec-gap, with the evidence quoted.
4. Every finding ID referenced in the document resolves to a row that defines it.
5. **Every transition ID resolves to a row that defines it, and the transition namespace
   is globally unique.** A document whose sections each define IDs in their own series
   must not let one series restart inside another's range: two machines that both begin
   at TR-030 make every reference to TR-030 ambiguous, and a reader cannot tell which
   machine a citation points at. Give each series a disjoint block, and check the
   references *outside* the defining section as well — the same number can mean
   different things in different rows.
6. The document's ID registry lists every ID issued, with the count matching what the
   document actually uses.
7. Every reachability claim in the completeness section is stated as an argument from
   the transition table, or — if you computed it — as a path the traversal produced.
   Never as an inspection.
8. Each generated artifact was checked **as soon as it was written**, not in a batch at
   the end. An artifact that survives unverified to the summary gets reported as
   delivered.
9. A reviewer who has not seen the source can follow a finding from evidence to remedy.
10. **Every source reference carries a registered `SRC-###` id.** Scan the whole file for
    source mentions: every one must be a citation object with a registered `source` and a
    `locator` — `{ "source": "SRC-001", "locator": "§6.3" }` or `{ "source": "SRC-001",
    "locator": "PAR-014" }`. A bare filename, a bare section number, a bare page number
    and a bare requirement id are not citations. Every id used must exist in the `sources`
    array and map to the right document; every `PAR-###` used as a locator must be in the
    `sourceLocatorRegister`; and the paragraph glyph must not appear as a locator. Fix a
    failure before calling the deliverable complete.
11. **The file matches the contract.** Every top-level key the prompt fixes is present
    (even where its array is empty); every record carries the fields §8.1 lists for it, in
    that order; every enumerated value is in its closed set; every id series is issued by
    exactly one array; and every record with a `classification` has a `rationale` beside
    it. The file parses as JSON with a standard parser and no repair.

**The checks below apply only to an artifact you actually built.** The executable model
and the explorer page are *optional instruments*; the deliverable is the document. Do not
carry an instrument's checks as unconditional gates — a check on an artifact that was
never built can never pass, and the run then reads as a broken deliverable when the
deliverable is fine.

*If you built an executable model:*

11. The model's conformance suite passes, and each defect-reproduction test fails for
    the stated reason — a defect test that *passes* means the defect is not reproducible
    as documented, and must be rewritten. The reachability set was produced by
    traversal, not by visiting hand-built states, and the traversal exhausted its
    frontier. Every finding that claims a reachable path cites a path the traversal
    produced, and the probe for that finding agrees with it. Every defect test is
    labelled *contradiction* or *gap*, and the deliverable's summary counts match the
    tests that exist. `references/executable-spec-model.md` has the harness's rules.
12. **The document's expressions resolve against the document's own vocabulary.**
    `node scripts/check-model-expressions.js <document.json>` checks every transition's
    guard and effect, every invariant's formal expression, every `notExpressible`
    that carries no reason, and every invariant that names no state — and exits
    non-zero naming each disagreement. It reads the JSON directly, so there is no
    table to find by the wrong column. Run it before the model, so a format defect is
    found in the document rather than worked around in the engine.

*If you built an explorer page:*

The check list is in `references/explorer-verification.md` — run every check in it before
calling the page verified. The checks are conditional: they apply only to a page that was
actually built.
