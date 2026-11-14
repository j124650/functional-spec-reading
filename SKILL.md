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
one consolidated `domain-model-and-state-machines.md`, the twenty-one numbered
sections of the domain-discovery layout, the identifier scheme, and the evidence
classes. **What the words mean is fixed too.**
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
`domain-model-and-state-machines.md`, written from reading the spec. Everything else —
an executable model, an interactive page, a compiler that produces an intermediate
representation, a checker script — is an *instrument*, and it gets built only when the
reader asks for it or when the document genuinely cannot be produced without it.

**Write the document first.** Scaffolding before the deliverable inverts the work: the
reader waits on tooling that may never produce the thing they asked for, and the
deliverable ends up shaped by whatever the tooling happened to emit. Produce the
document, then build an instrument against it if it adds anything.

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
A multi-hundred-megabyte environment then sits beside the artifact the reader receives,
and it is easy to mistake for part of the output. Name an explicit scratch path, and
delete the venv when the conversion is done.

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
  deliverables (one consolidated `domain-model-and-state-machines.md` with twenty
  numbered sections), the identifier scheme (`ENT-001`, `VO-001`, `AGG-001`,
  `CMD-001`, `EVT-001`, `SM-001`, `ST-001`, `TR-001`, `INV-001`, `POL-001`,
  `SCN-001`, `Q-001`), and the evidence classes (`EXPLICIT` · `INFERRED` ·
  `CANDIDATE` · `CONFLICTING` · `UNSPECIFIED`). It also requires a second
  analytical pass — the adversarial review in step 9 is that pass.

  **Two section lists exist, and the longer one wins.** The prompt's §8 lists twenty
  sections; the domain-discovery layout adds `Source Inventory`, `Bounded Contexts`,
  and an `ID Registry` inside the traceability matrix, giving twenty-one. Use the
  twenty-one layout — it is a superset, and a bounded context needs a section of its
  own because a context map without one is just a list of systems. Everything else in
  the prompt still holds: the identifier scheme, the evidence classes, and the
  one-file rule.
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
  their required treatment, the `SRC-###` source-reference scheme, and the
  traceability matrix columns.
- **`references/reference-material-extraction.md`** — how to get quotable,
  structurally parseable text out of a published book or paper: look for the
  upstream typesetting source before parsing a PDF, repair the artefacts a PDF
  text layer leaves behind, parse into structured data and generate the
  reference from it, and carry the licence with the quote.

**Templates and a worked example.** `templates/domain-model-template.md`,
`templates/state-machine-template.md` and `templates/transition-table-template.md`
give the table shapes; `examples/example-domain-model.md` is a small worked
example showing both the format and the cautions — note how it records what
must *not* be inferred. Use the templates as skeletons, but fill them from the
source: a template's empty row is a question, not a fact.

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
section and a short verbatim quote. Note which transitions the spec never specifies at all.

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

**Run the model's own check before trusting anything it says.** It resolves every
expression in the document against the document's vocabulary. A failure means an
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
the Markdown. Never make the model a prerequisite for producing one, and never let the
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

### 10. Pass 8 — deliver the consolidated document

**The deliverable is the prompt's file.** `references/spec-processing-prompt.md`
requires **one** consolidated `domain-model-and-state-machines.md`, organised
into its twenty-one numbered sections, with the identifier scheme and evidence
classes it fixes. Produce that file — and produce it from the per-pass analysis,
not beside it. The separate glossary/context/state-machine/issues files are
working notes; the consolidated file is the artifact, and its traceability
matrix is what lets a reviewer follow a claim back to the spec.

**That file is the whole job.** Everything below is optional and comes after it:
an interactive page is a *view* of the deliverable, for a reviewer who would rather
explore than scroll. Build one only if the reader asks. See
`references/interactive-diagrams.md`.

**The HTML carries every value it shows in ONE embedded JSON document.** A figure
typed into the page goes stale the moment the model changes, and the artifact then
asserts numbers the model no longer produces. Export the computed result as JSON
from the harness and have the page read it — and put the page's *other* data in the
same document, because two sources means the copy you forget is the one that drifts.

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

**Give source references their own IDs.** `SRC-001`, `SRC-002`, … — one per source
location, reused consistently, so the traceability matrix can point at them instead of
repeating a location string in every cell. See `references/evidence-and-traceability.md`.

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
- **Do not inherit an artifact from a previous workflow.** A model, an extractor, or
  a findings document that was produced against an earlier version of the spec
  answers an earlier question. Citing it is fine; citing it *as this run's
  result* is not, and the reader cannot tell the difference.
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
- **Do not leave the deliverable half-migrated.** A layout rewrite that changes the
  markup but not the scripts that read it leaves a broken page. When the structure
  changes, change the markup and the code that drives it in the same pass and re-verify
  in the browser before moving on.
- **Answer the question that was asked.** A question about the workflow, the method, or
  what a deliverable looks like is answered by the method — not by building the thing.
  When the reader asks "what are we developing?", answer that; do not start writing
  scaffolding. When they ask how to invoke this in a fresh session, give the invocation
  and stop.
- **Do not report a defect you already know how to fix.** Finish the fix and re-verify
  it, then report. A report that names a known defect and hands it back to the reader
  is a delivery in name only, and it reads as "the work stopped here" — the reader
  then has to ask for the rest. If a defect genuinely needs a decision the user has
  not made, say so and ask; but a defect whose fix you are already holding is yours
  to finish before you summarise.
- **A layout assertion must be shown to fail.** A check that passes against the
  broken build is measuring the wrong thing — the headless default window is small
  enough that the overflow cannot happen. Set a desktop viewport in the harness, then
  revert the fix and confirm the assertion catches it.
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
  and say if the artifact is currently broken.
- **Verify each artifact the moment you write it.** A defect introduced in the last
  twenty minutes of a long session is invisible to a summary written from memory, and
  a summary that claims more than was checked is worse than one that admits the gap.
- **Check whether the deliverable is still current against its source.** An artifact
  rebuilt from hand-entered numbers drifts from the model the moment the model changes.
  Compare timestamps and the figures themselves before reporting that the deliverable
  reflects the latest analysis — the question "is this based on the most recent data?"
  deserves a real check, not an assurance.

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

**The checks below apply only to an artifact you actually built.** The executable model
and the explorer page are *optional instruments*; the deliverable is the document. Do not
carry an instrument's checks as unconditional gates — a check on an artifact that was
never built can never pass, and the run then reads as a broken deliverable when the
deliverable is fine.

*If you built an executable model:*

10. The model's conformance suite passes, and each defect-reproduction test fails for
    the stated reason — a defect test that *passes* means the defect is not reproducible
    as documented, and must be rewritten. The reachability set was produced by
    traversal, not by visiting hand-built states, and the traversal exhausted its
    frontier. Every finding that claims a reachable path cites a path the traversal
    produced, and the probe for that finding agrees with it. Every defect test is
    labelled *contradiction* or *gap*, and the deliverable's summary counts match the
    tests that exist. `references/executable-spec-model.md` has the harness's rules.

*If you built an explorer page:*

11. **The interactive HTML has been opened in a browser and exercised: filters, selection,
    sorting, and every panel. A file that was written but never rendered is not verified.
    **Assert a non-zero element count for every rendered view** — a JS error blanks only
    the view it breaks, so the page still looks complete while one panel is empty.
    **Assert each view's count, not just its presence**: an empty findings list and a
    populated one both contain zero `<details>` elements only if the render never ran —
    count the rows you expect, not the container.
    **Run these assertions from a script that exits non-zero, not from ad-hoc probes.**
    A probe answers one question; a harness catches every view, filter and column at
    once and keeps catching them after the next change. `scripts/test-explorer-cdp.js`
    drives the page in headless Chrome over the DevTools Protocol, captures uncaught
    exceptions and console errors, and runs a checks file:
    `node scripts/test-explorer-cdp.js <page.html> checks.js`.
    It needs no dependencies — Node 22 ships global `fetch` and `WebSocket`.
12. **The page itself does not scroll vertically**; each section scrolls its own content.
    Check `document.documentElement.scrollHeight <= window.innerHeight`.
13. **Every table column sorts**, and clicking a row expands in place without switching
    tabs. A heading that displays the sort arrow must actually sort, and the sort must
    survive a filter re-render.
14. **The first view renders with no interaction** — open the file and assert content
    before clicking anything.
15. **The page's inline script compiles.** Extract it and run it through a parser
    (`new vm.Script(code)`) before trusting anything the page shows. A parse error
    blanks every view while the page still looks alive, and it is invisible in the
    browser unless you happen to look at the console.
16. **Every derived view agrees with the document it summarises.** Compare the page's
    finding count, severities and ID set against the document that owns them —
    mechanically, not by eye. A page that lists a severity the document downgraded,
    or omits a finding the document added, contradicts the document in front of the
    reader. `scripts/check-explorer.js` does this comparison in one command:
    `node scripts/check-explorer.js <page.html> <document.md>`.
    It exits non-zero and names the disagreement. It scopes itself to the ID
    namespaces the documents own, and it distinguishes an ID the document *heads*
    from one it merely *mentions* — a document that says "F-03b is a probe label,
    not a finding" must not read as a missing finding.
17. **The page's build pipeline runs clean and is idempotent.** Run the generator
    twice and diff: the second run must change nothing, and the page's inline script
    must compile after each run. A generator that only works once leaves the artifact
    in a state nobody can reproduce.
18. **The generator did not take any of the page's own code with it.** Diff the
    regenerated page against the previous one and confirm the only changes are the
    data. A generator that replaces a region between markers removes every helper in
    that region, and a removed helper fails inside one render function rather than at
    load — so the artifact still opens, still draws its chrome, and is quietly wrong.
    Assert the helpers are still present after the run:
    `grep -c 'const q = s' explorer.html` and the same for each other helper.
