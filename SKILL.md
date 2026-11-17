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
that holds the model, the identifier scheme, and the evidence classes. **Load it, and
the template, before extracting.** The DDD Reference itself —
`references/ddd-vocabulary.md`, the authority for what the words *mean* — is
**consulted, not preloaded**: read it when a term's status or a pattern's grounding is
in doubt, not before the first record. A methodology without an authority cannot be
checked, and a deliverable without a contract is a pile of notes; but an authority
read in full is a hundred kilobytes nobody needed.

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

**If the input is already Markdown, skip this stage.** The source is read as it is.
The stage exists for `.docx`, `.pdf` and `.xlsx`, where the document's structure —
headings, lists, tables — has to be recovered before anything can cite it.

**Otherwise, this is the front door of the whole pipeline. Do it first, and do it
with the bundled conversion skill — never by hand.**

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
**And three more, before the behaviour keys.** The deliverable is checked by an
engine that parses it, resolves every scope and evaluates every guard and effect;
the document has to satisfy that engine, so its rules are part of what you produce.

- **`references/executable-spec-model.md`** — how the engine reads the file: the
  shape of a guard and of an effect, what `notExpressible` and `alternatives` mean
  to it, how a scope resolves, and what an effect must look like to be evaluable.
- **`references/expression-reading.md`** — the expression language: what
  evaluates, what does not, and what the engine reports for each.
- **`references/gates.md`** — what each of the nine gates asks of the deliverable:
  how each one matches, what its failure means, and what to fix.

**Read those three, and not the engine's source and not the gate scripts.** The
source is the implementation rather than the specification; the gate scripts are
the same content as `references/gates.md` in a worse form. Reading either costs
turns and says less. This is measured, not assumed: a run that went to the source
instead spent forty of its ninety minutes reading `Program.cs`, `Scope.cs` and
`Aggregate.cs`, and another spent seven minutes reading the nine gate scripts
before writing its first record.

### Everything else in `references/` is loaded on demand

The list above is the library, and a run that reads the library reads **twenty
files** — for a 119-line specification that is the whole cost of the run, before
a single record is written. Measured: a run spent **10 minutes and 26 tool calls
reading twenty files** and reached the first model content.

So the mandatory set is **six files** — this one, the prompt, the template, the
specification, and the three engine references before the behaviour keys — and
everything else is conditional:

| read it | when |
|---|---|
| `references/ddd-vocabulary.md` | a term's status, or a pattern's grounding, is in doubt. The prompt fixes the closed sets; the vocabulary is the authority behind them, and it is consulted, not preloaded |
| `references/ddd-modeling-guidelines.md` | the modelling decision itself is ambiguous — model or data, entity or value object, is this a context |
| `references/aggregate-design-guidelines.md` | an aggregate boundary has to be derived and the derivation is not obvious |
| `references/state-machine-modeling.md` | a lifecycle does not resolve to a state machine, or a machine has more than one dimension |
| `references/evidence-and-traceability.md` | the shape of a citation or of a `traceability` row is unclear |
| `references/reference-material-extraction.md` | the source is a published book or PDF, not a document to convert |
| `references/explorer-rendering.md`, `references/export-contract.md`, `references/interactive-diagrams.md` | the reader asked for the interactive page. **That page is optional and is not part of producing the model** |

Consulting a reference costs one read. Preloading the library costs the run.

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
gets a `SRC-###` ID, with its version, date, and authority. Where a paragraph of a
source document is used as evidence, it gets a `PAR-###` ID in reading order, scoped by
its source, recorded in the source/locator register and kept stable across iterations.
Then decide what the supplied documents are: **one specification, or several with
different authority?**

That decision changes the model, so record it. When documents disagree, do **not**
silently pick one — preserve both claims, identify which is newer or more
authoritative only where the evidence supports it, say which model elements are
affected, and raise a question. A contradiction resolved silently is a defect that
ships.

**Read the whole specification before concluding a concept or lifecycle is absent.**
Absence is a finding only after a complete reading.

**Where source precedence is unclear and materially affects interpretation, record
the ambiguity** — and ask one concise question only if the work cannot responsibly
proceed. Maintain stable IDs across all documents and all iterations.

See `references/evidence-and-traceability.md`.

### 2c. The write phase — one file per key, in dependency order

The procedure above is ordered as **passes over the source**. The deliverable is
ordered as **keys**. Two orders, and the run has to map one onto the other — and
it maps it by reading, which is where the time goes.

So the write phase is stated here, and it is the phase that produces the artifact.

**One file per key, in a `fragments/` directory, named `NN-<key>.json`** — the
number is the order below, the name is the key exactly as the template spells it.
Then:

```
node scripts/assemble.js <fragments-dir> <the deliverable .json>
```

builds the deliverable, in the contract's key order, and refuses to write one
that does not fit the contract. **One name for the deliverable, and one place for
it**: the prompt's `domain-model-and-state-machines.json`, written where the reader
works — beside the source, unless they name another destination. The assembler is what puts the keys in the
contract's order, so **the order you write in is the order the dependencies
run in**, and it need not be the template's.

| | keys, in the order to write them | why here |
|---|---|---|
| 1 | `document`, `sources` | the header and the file's own id; every citation carries it |
| 2 | `referencedButNotSupplied`, `sourceLocatorRegister` | what the source points at but does not supply, and where each paragraph lives |
| 3 | `glossary`, `overloadedTerms`, `undefinedTerms` | **the language first** — every later record names things, so the names come first |
| 4 | `roles`, `roleRewrittenRules`, `domainConcepts` | the roles the spec's rules belong to, the rules rewritten in terms of them, and the concepts they are about |
| 5 | `entities`, `valueObjects`, `boundedContexts`, `contextMap`, `aggregates`, `nonAggregateCandidates` | the structure the rules apply to |
| 6 | `expressionVocabulary` | **after the things it names** — a vocabulary term that no entity or aggregate field introduces is a term with nothing behind it |
| 7 | `commands`, `domainEvents`, `policies` | what the structure does |
| 8 | `stateMachines`, `states`, `transitions`, `invariants` | the behavioural core, written against the vocabulary that is now fixed |
| 9 | `crossMachineDependencies`, `scenarios`, `completenessFindings`, `issues`, `questions` | what spans machines, what the source's own examples do, what is missing |
| 10 | `traceability`, `idRegistry` | the closing books, both derived from what is already written |

**The engine's verdict belongs to the write phase, not to the end of it.** Once
`expressionVocabulary`, `states`, `transitions` and `invariants` are written:

```
node scripts/feedback.js <fragments-dir>
```

It assembles what is written so far — the keys with no fragment yet are empty — asks
the engine to check and export it, and prints the verdict: the unreachable states, the
violations, the findings. It answers in seconds about **your** model. **Do not write a
probe script to find out what the engine does** — the rules are in
`references/executable-spec-model.md`, `references/expression-reading.md` and
`references/gates.md`.

**Each key is written once.** A gate that names a record is repaired by editing
**that one record inside its own file**, and the assembler rebuilds. Re-emitting a
whole key to fix one record is the single largest avoidable cost in a run: the
prepatch control spent **2.7× the deliverable** in output tokens, and most of the
excess was keys written twice.

**Two things end the repair loop.** The gate passes — or the same gate has failed
three times for the same reason. Then the defect is in the model's shape rather than
in the record, and it belongs in `completenessFindings` as a stated reason, not in
another turn of the loop.

**When the assembler refuses the document, it is naming a shape, not a content.**
It names the key and the field. Fix that shape in the fragment it names. A key the
contract fixes that the source does not support is written as an **empty array** — an
empty array is a fact, a missing key is a defect.

**The run has a stop condition, and it is written down.** `references/scenarios.md`
carries it: when no bytes have been written for two turns and the run is past fifteen
minutes, stop reading and write the next fragment. A run that is reading instead of
writing is not being thorough — it is losing the budget, and the source it is
re-reading is already in its context.

**And the file is the job.** The deliverable is the artifact; the fragments are
how it is written, and the page is a view of it. Everything else is optional and
comes after it.

### 3. Pass 1 — the glossary, term by term, verified across occurrences

For each domain term: what the spec defines it as, where that definition lives, and what
happens to the term **everywhere else it appears** in the sections you have read.
A term is only verified when you have checked its other occurrences, not when you
have read its definition.

**The specification stays in context for the whole run. Do not re-read it.** Every
re-read is a turn that changes nothing: the source is 119 lines and it is already
in front of you.

Give each entry a status: `Defined` · `Defined (partial)` · `Conflicting` (two sections give
incompatible meanings) · `Overloaded` (one word, several meanings) · `Undefined` (used as if
understood, never defined) · `Pending` (depends on an open question or outside decision).

Produce three products, and they are keys, not tables: the **`glossary`** records, the
**`overloadedTerms`** records (word → meaning A → meaning B → sections), and the
**`undefinedTerms`** records (term → where used → what must be decided).

### 4. Pass 2 — roles, not people

The roles are the unit of permission and ownership. Person names are *instances*, and
they belong in the `instances` field of the **`roles`** records — not in a table of
their own, because the deliverable has one shape and every fact in it is a record.

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

The prose sections are where contradictions live, because no section was written against
the others. Cross-check the same concept across **every section it appears in** —
in the source you have already read, which is still in context.

### 6. Pass 4 — invariants, in three registers

- **Stated** — the spec says it.
- **Derived** — it follows but is never written down.
- **Broken by construction** — the spec states it *and* prescribes an operation that violates
  it. These are the highest-value findings: they are not oversights, they are contradictions
  the spec will ship with.

### 7. Pass 5 — reachability: argue it, or compute it

The stage machine must be checked for unreachable states, dead ends, and missing
transitions. Two ways to do that, and the difference matters:

**Arguing** — read the transition table you built in §3.4 and trace each state's
incoming and outgoing edges. State which states are reachable and how, which are not,
and where the trace dead-ends. **This is the default.** For a spec of this size it is
what the prompt asks for, and it needs no instrument beyond the document.

**Computing** — encode the reconstructed rules as an **executable model** and let it
*traverse* what is reachable. See `references/executable-spec-model.md`.

**Computing needs the document to carry the rules in a form the model can read.** A guard
written in prose — "the customer e-mail is on file" — cannot be evaluated, so a model
that has to evaluate it must have somebody hand-encode it, and a hand-encoded rule layer
is that document's rules, written in code. To compute against *any* document, §3.4's
transitions carry a **guard expression and an effect expression**, §3.6's invariants
carry a **formal expression**, and §3.5.2 declares the **vocabulary** those
expressions draw on.
Build the model after the document, against the rules the document already states.

**How to build the instrument is in `references/executable-spec-model.md`** — the leak
test (an instrument that holds no entity of the document it verifies), the decisions
that are made once (abstract or concrete, the shape of the model, one aggregate rather
than one traversal per machine). It is an optional instrument, so it is read only when
the reader asked for it.

**Run the model's own check before trusting anything it says.** It resolves every
expression in the document against the document's own vocabulary. A failure means an
expression names a term the document does not define — a defect in the document, fixed
in the document.

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

**First, the machine's own verdict.** Two reports say what a re-read would only
guess at: `check-source-coverage.js` names every row of the source's tables the model
does not account for, and `check-section-accountability.js` names every section of the
source nobody cites. Read both, and fix what they name, before anything else.

**Then, an independent reviewer — when the reader asked for one.** A second pass over
the same source finds materially more than one pass does, and it is worth a second
agent when the source is large enough to hide something. It is not free: the reviewer
reads the source and the deliverable again, so dispatch it only when the reader wants
a review, or when the source is long enough that the risk justifies the cost.

**Point it at the deliverable, not at a diagram.** The reviewer gets the JSON
deliverable, the source, and a be-nastily-specific brief: find factual errors,
overclaims, missed defects, internal inconsistency, and anything a non-technical
reviewer could not act on. A reviewer handed a picture cannot say anything about a
claim in the record that carries it.

**Hand it the commands, and ask for the output it got.** A reviewer given only the
prose cannot tell that a claim of mechanical reproduction was hand-asserted, and it
cannot check whether a cited section resolves. Give it the gates, the engine's check,
and the source, and ask it to report what came back.

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

**The source's SECTIONS are the floor too, and ONE command runs every gate.** A
table row is only part of what a specification states; most of it is prose in
numbered sections, and a section nobody cites is a part of the source the model
did not read. Every section must be accounted for — modelled, or declared with a
reason in `completenessFindings` — and the nine gates together check all of it:

```
node scripts/gate.js <the deliverable .json> [the source .md] [the export .json] [the page .html]
```

It runs every gate, prints one line per gate, and names what failed. Use it
rather than the individual scripts: a run that opens the nine `check-*.js` files
to learn what they ask has spent seven minutes reading the equivalent of
`references/gates.md`, which says the same thing in prose. Read that file
instead — it is what the gates ask.

**The whole model is bounded by the source.** A fact the source does not state
enters the deliverable only as an explicitly labelled inference, or as a
declared gap — never silently, and never as a fact. The gap belongs IN the
deliverable (a question, an undefined term, a completeness finding), because a
gap the reader cannot see is a gap the reader has to rediscover.

**The deliverable is the prompt's file.** `references/spec-processing-prompt.md`
requires **one** consolidated `domain-model-and-state-machines.json`, with the
top-level keys, the record fields, the identifier scheme and evidence classes it
fixes. Produce that file — and produce it from the per-pass analysis, not beside
it. Write it in the directory the reader is working in, beside the source document,
unless they name another destination: the prompt fixes the file name, not the path.
The separate glossary/context/state-machine/issues files are working notes; the
consolidated file is the artifact, and its `traceability` array is what lets a
reviewer follow a claim back to the spec.

**The file is the whole job.** The deliverable is the artifact; an interactive page
is a *view* of it, for a reviewer who would rather explore than scroll. Build one
only if the reader asks — see *Optional: the interactive page*, at the end of this
procedure.

## Optional: the interactive page

**The page is a view of the deliverable, never a prerequisite for it.** Build one
only if the reader asks, and build it after the deliverable exists. Everything in
this section is optional, and a run that produces only the model never needs it.

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

The rules that keep the model honest. Each one was paid for.

**Gather what a step needs once, then act.** Re-reading files already read in the
same session is not diligence; it is a loop, and the reader waits through every
turn of it. Read what the step needs, keep the facts, and make the change. The
source stays in context for the whole run: do not re-read it.

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
- **Do not widen the scope to find the system.** Sweeping sibling paths for "the real app" is
  the single most reliable way to lose the user's trust on a document-reading task. The
  document is the scope.
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
- **Probe the findings; do not narrate them.** Encode each reachability claim as a
  question against the computed set. A probe that answers NOT REACHABLE is the mechanism
  that catches an overclaimed path — and a probe that contradicts a finding you were
  confident about is usually pointing at a missing field or a missing guard.
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
- **Verify each artifact the moment you write it.** A defect introduced in the last
  twenty minutes of a long session is invisible to a summary written from memory, and
  a summary that claims more than was checked is worse than one that admits the gap.

**The other rules live with the thing they are about.** The page and the export
have their own pitfalls, and the instrument has its own; they are not repeated
here, because a rule that governs one artifact does not govern another:

- the **page** and its checks — `references/explorer-rendering.md`
- the **export** contract — `references/export-contract.md`
- the **engine** — `references/executable-spec-model.md`
- the **conversion** stage — section 1, and `references/evidence-extraction.md`
- **working with the reader** — `references/working-with-the-reader.md`

## Verification

### The feedback loop, while the model is still being written

The gates run on a **complete** deliverable. Until the last fragment exists, a run
has no mechanical feedback at all — and the only instrument left is the engine,
which a run reaches by building probe documents and reading reachability counts
out of them. Sixteen probes in one run; forty minutes in another. Both were a
run discovering what the engine does the hard way, because the only way it
could.

**So get the engine's verdict early.** Once the vocabulary, the states, the
transitions and the invariants are written:

```
node scripts/feedback.js <fragments-dir>
```

It assembles what is written so far — the keys with no fragment yet are empty —
asks the engine to check it, asks it to export it, and prints the verdict: the
unreachable states, the violations, the findings. It answers in seconds what a
probe script answers in minutes, and it answers about **your** model rather than
about a toy one.

**Do not write a probe script to find out what the engine does.** The rules are
in `references/executable-spec-model.md`, `references/expression-reading.md` and
`references/gates.md`. The engine's verdict on your own fragments is what tells
you whether you applied them.

### Before delivering

**The gates are the check.** One command runs all nine and names what failed:

```
node scripts/gate.js <the deliverable .json> [the source .md] [the export .json] [the page .html]
```

The assembler has already checked the shape — every key present, every record's fields
in the contract's order, every enum in its closed set, every id series issued once, a
rationale beside every classification — and the engine's `check` has resolved every
expression against the document's own vocabulary. `references/gates.md` says what each
gate asks and what its failure means.

**Two things no gate can judge, and they are the reader's question.**

1. **Breadth.** The gates check that every row of the source's tables is accounted for
   and every section is cited — but they do not count the lifecycles the source
   describes against the lifecycles the model holds, and a model of two state machines
   passes every gate on a specification that describes five. Count them yourself: the
   source's own headings and stage tables enumerate what it describes, and each one
   must be a machine, a state, or a stated reason it is not. Report that count beside
   the gate results, because *"every gate passes"* and *"the analysis is as complete as
   the source allows"* are different claims, and only the second is what was asked.
2. **Honesty.** Every claim that reads as a fact is a fact the source states. An
   `INFERRED` record shows its reasoning and what a stakeholder must confirm; a
   `CANDIDATE` says it needs a domain expert; a gap the source leaves open is
   declared in the deliverable rather than silently absent. **A green run is evidence
   of CONSISTENCY, not of BREADTH** — and a run that reports both has answered the
   reader.

**Each artifact was checked as soon as it was written**, not in a batch at the end: an
artifact that survives unverified to the summary gets reported as delivered.

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
