# Task: Extract a Comprehensive Domain Model and State Machine Specification from a Functional Specification

## Role

Act as a senior Domain-Driven Design (DDD) practitioner, domain analyst, business process modeler, and state machine analyst.

Your task is to extract the richest possible domain knowledge from the supplied functional specification, which was written primarily for human readers rather than as a formal domain model.

Do not merely summarize the specification or translate its requirements into technical terminology.

Discover and reconstruct the underlying business domain, including its explicit and implicit behavioral models.

## 1. General analysis principles

1. Treat the functional specification as the primary source of truth.
2. Preserve its original business terminology wherever possible.
3. Do not introduce technical implementation concepts unless explicitly required by the specification.
4. Distinguish business rules from technical requirements, UI behavior, and infrastructure constraints.
5. Identify both explicit and implicit domain knowledge.
6. Never silently convert assumptions into facts.
7. Every extracted rule, state, transition, and invariant must have a traceable source reference — written as §1.1 sets out — or an explicit inference justification.
8. Identify contradictions, ambiguities, missing requirements, and underspecified behavior.
9. Do not assume that a field called `status`, `type`, or `flag` necessarily represents a state machine.
10. Do not assume that every state machine belongs to an aggregate. Discover candidate consistency boundaries from the business rules.

### 1.1 How a reference names where it comes from

**Every reference to a source names the source document it comes from, and it
is bracketed.**

```
[SRC-001]
[SRC-001, §6.3]
[SRC-001, §3, SRC-001, §12.1]
[SRC-001, PAR-014]
```

`SRC-001` is the id you gave the document in the §2 source inventory — the
specification itself is `SRC-001`. The id names the DOCUMENT; what follows the
comma is the LOCATOR inside it.

**A bare `§6.3` is not a citation.** This analysis has its own sections
(§1–§21) and the specification has its own (§1–§14), and the two overlap:
a reader — or any tool that reads the file — cannot tell which document a
bare section number names. The brackets carry the id, so the question never
arises.

And the document named is the specification. The evidence for a claim is
what the specification says, not what this analysis concluded from it — an
Evidence cell that points at the analysis points at the analysis.

**Every citation is grounded in the specification.** An Evidence cell says
where the specification says the thing — never where this analysis says
it. A reference to a section of the analysis itself is not evidence, and
it does not belong in an Evidence cell: name the thing the analysis
issued an id for (SM-003, INV-004) instead, and the reader can find it.

**The rules.**

1. Every citation carries a registered source id — `SRC-00N` — inside brackets,
   and then a locator. No exceptions, no bare `§N`, in any cell of the document.
2. The source id is one you issued in the §2 source inventory, one document per
   id. Do not invent an id, and do not cite a document you did not list there.
3. A locator is a section (`§6.3`), a page (`p. 17`), a requirement id
   (`Requirement REQ-17`), a table and row (`Table 4, row 2`), or a paragraph
   (`PAR-014`). Where several sources support one statement, list every one:
   `[SRC-001, §3.2; SRC-002, §5]`.
4. **A paragraph is located by `PAR-###`.** Assign those ids sequentially in
   reading order within each source document, to the paragraphs you use as
   evidence; keep the mapping stable and scoped by the source id, and record it in
   the source/locator register in §2. **Never use the paragraph glyph as a
   locator**, alone or beside an id. If a paragraph cannot be reliably identified,
   cite the source id and another locator you can verify.
5. If no reliable locator is available, cite the id alone: `[SRC-001]`. Never
   invent a locator.
6. Cite the section of the document you actually read. A claim you inferred
   belongs to the section it was inferred *from*, with the classification
   saying it was inferred.
7. List the citations in the order the evidence appears, separated by `; `.
8. Quote after the citations, in double quotes:
   `[SRC-001, §6.3] "Owner = default owner in Settings (Blanca)"`.

**Use it in every column that asks where a thing came from** — an Evidence
cell, a Source references field, a classification's evidence, the Section
column of a role-rewritten rule, the Relevant Sections of a source
inventory row. A document that cites by id in one column and by number in
another has two kinds of citation, and only the one that names its document
can be resolved.

## 2. Extract the DDD domain model

Identify and document the following concepts.

### 2.1 Domain terminology

Extract:
- Business terms and their definitions.
- Synonyms and alternative names.
- Terms with potentially different meanings in different contexts.
- Business-specific vocabulary.
- Undefined or ambiguous terminology.

Create a Ubiquitous Language glossary.

### 2.2 Domain entities

For each candidate entity, identify:
- Business name.
- Business purpose.
- Identity and identity lifecycle.
- Important attributes.
- Behavioral responsibilities.
- Lifecycle and state.
- Relationships with other entities.
- Business rules governing its behavior.

Distinguish genuine entities from records, DTOs, reports, and other data representations.

### 2.3 Value objects

Identify concepts whose identity is determined by their values rather than by a persistent identity.

Document:
- Meaning.
- Attributes.
- Validation rules.
- Equality semantics, where inferable.
- Immutability expectations.
- Business constraints.

### 2.4 Aggregates and consistency boundaries

Identify candidate aggregates.

For each aggregate, document:
- Aggregate name.
- Candidate aggregate root.
- Internal entities and value objects.
- Responsibilities.
- Commands it handles.
- Domain events it produces.
- Invariants it must enforce.
- Consistency boundary.
- References to other aggregates.
- Rules requiring synchronous consistency.
- Rules potentially requiring eventual consistency.

Do not group objects into aggregates merely because they are closely related in the specification.

Use business invariants and transactional consistency requirements as the primary evidence for aggregate boundaries.

### 2.5 Domain events

Extract all meaningful business events.

Use past-tense business language.

For each event, document:
- Event name.
- Business meaning.
- Triggering action or occurrence.
- Preconditions, if any.
- Resulting business facts.
- Affected entities and aggregates.
- Downstream consequences.
- Whether it is explicit or inferred.

Distinguish domain events from commands, notifications, UI events, and technical events.

### 2.6 Commands and business actions

Identify all actions that express business intent.

For each command, document:
- Name.
- Initiating actor.
- Target entity or aggregate.
- Required input.
- Preconditions.
- Applicable invariants.
- Expected state changes.
- Resulting domain events.
- Possible rejection conditions.

### 2.7 Domain policies and processes

Identify:
- Business policies.
- Conditional business rules.
- Automatic reactions to events.
- Cross-aggregate workflows.
- Long-running processes.
- Time-dependent behavior.
- Compensation and recovery behavior.
- External system interactions.

Distinguish aggregate-local behavior from orchestration across multiple aggregates.

## 3. Discover ALL state machines

This is a particularly important part of the task.

Identify every explicit and implicit state machine in the specification.

Do not restrict the analysis to concepts explicitly described using words such as "state", "status", "lifecycle", or "phase".

Look for implicit state machines through:
- Conditional behavior.
- Allowed and forbidden operations.
- Business process steps.
- Changes in permissions.
- Preconditions that depend on previous actions.
- Time-dependent rules.
- Approval and rejection workflows.
- Creation, activation, suspension, cancellation, expiration, and completion.
- Dependencies between business events.
- Rules describing what can happen next.
- Different behavior depending on historical events.
- Flags or combinations of attributes that collectively determine a business condition.

### 3.1 State machine classification

Classify every discovered state machine as one of:

- Explicit: directly described by the specification.
- Implicit: inferred from multiple business rules or scenarios.
- Partially specified: some states or transitions are explicit, but the complete lifecycle is not.
- Candidate: plausible interpretation requiring domain expert confirmation.

Provide the evidence supporting the classification, cited as §1.1 sets out.

### 3.2 State machine identification

For each state machine, document:

- Unique identifier.
- Business name.
- Business purpose.
- Modeled entity, aggregate, or process.
- Owning bounded context, if identifiable.
- Candidate aggregate root, if applicable.
- State dimensions.
- Initial state.
- Terminal states.
- Intermediate states.
- Exceptional states.
- Whether the machine is finite or potentially unbounded.
- Whether it is a single state machine or a combination of orthogonal state dimensions.

Do not collapse independent state dimensions into one artificially large state machine.

### 3.3 State definitions

For EVERY state, document:

- State identifier.
- Business name.
- Precise business meaning.
- Entry conditions.
- Exit conditions.
- Permitted operations.
- Forbidden operations.
- Applicable invariants.
- Observable business consequences.
- Events that can lead into this state.
- Events that can lead out of this state.
- Whether it is initial, intermediate, terminal, or exceptional.
- Source references, cited as §1.1 sets out.
- Explicitness classification.

A state must represent a meaningful business condition, not merely an arbitrary value of a technical field.

### 3.4 Transition definitions

Identify EVERY transition, including:
- Normal transitions.
- Exceptional transitions.
- Rejection transitions.
- Cancellation transitions.
- Timeout transitions.
- Automatic transitions.
- Administrative transitions.
- Reversal or compensation transitions.
- Transitions triggered by external events.
- Transitions that are explicitly forbidden.

For each transition, document:

- Transition ID.
- Source state.
- Triggering command, event, or condition.
- Guard conditions.
- Business actor or initiating process.
- Required inputs.
- Business validations.
- Invariants checked.
- Resulting state.
- Domain events emitted.
- Side effects.
- Failure and rejection behavior.
- Whether the transition is synchronous or asynchronous.
- Explicitness classification.
- Source references.
- Inference justification, if applicable.

### 3.5 Transition tables

Create a complete transition table for each state machine.

Use these columns:

| From State | Trigger / Command | Guard Conditions | Guard (expression) | Business Actor | Resulting State | Effect (expression) | Domain Events | Rejection Conditions | Evidence |
|---|---|---|---|---|---|---|---|---|---|

`Guard Conditions` is the business reading, in prose. `Guard (expression)` is the SAME
condition written in the expression language below — it is what a verifier evaluates, and
it is **mandatory**, not a summary of the prose. `Effect (expression)` states what the
transition does to the aggregate's data; a transition that only changes state leaves it
empty.

Include forbidden or unspecified transitions in a separate section rather than silently assuming they are impossible.

#### 3.5.1 The expression language

Expressions are written over the **expression vocabulary** declared in the glossary
section (§3, in its own subsection): every term the document uses as a data name, with
its type. No other identifier may appear in an expression — a name that is not in the
vocabulary is an unresolvable expression, and it must be reported, not guessed.

**Terms** — a term name, optionally with an accessor:

| Form | Meaning |
|---|---|
| `term` | a `flag` term is true when set; a `text` term is its string value (empty when absent) |
| `term.count` | number of elements in a `set` term |
| `term.contains('x')` | true when the set contains `x` |
| `term.empty()` | true when the term is absent, empty, or an empty set |
| `state` | the id of the state the transition's own machine is in |
| `input` | the value the command carried with it — the text the actor typed, or the map of field/value pairs an edit command carried |

**Operators** — `&&`, `||`, `!`, `==`, `!=`, `<`, `<=`, `>`, `>=`, `=>` (implication), parentheses.

**An accessor must match its term's type.** `count` and `contains` are set operations;
`empty` works on any type. Writing `business unit.count == 1` when `business unit` is
a `text` term is not evaluable as written, and no verifier can invent the reading that
would fix it — so the document must not do it. Either type the term as a set, or write
the condition the type supports (`business unit != ''` for a text term). The
document's own §3.1 vocabulary is the authority on which is correct.

**Effects** — a `;`-separated list of assignments:

| Form | Meaning |
|---|---|
| `set('term', 'value')` | set a text term |
| `set('term', true)` | set a flag term |
| `set('term', input)` | set a text term to the value the command carried |
| `set(input, 'value')` | set the term **whose name the command carried** — used where the command says which instance it acts on |
| `apply(input)` | write the field/value pairs an edit command carried onto the aggregate |
| `clear('term')` | unset a term |
| `add('term', 'value')` | add an element to a set term |
| `remove('term', 'value')` | remove an element from a set term |
| `if <expression> then <effect>` | apply an effect only when the condition holds |

A transition's state change is carried by the `Resulting State` column, not by an effect.

**Alternative readings.** Where the spec admits two readings of one rule, the cell carries
both, separated by `||`, and the verifier evaluates each and reports a divergence when
they land on different states:

```
set('clock started', true) || clear('clock started')
```

A `Resulting State` cell that names two states — `ST-004 In Review or ST-002 Returned to
Sales` — is read the same way: two readings of one transition.

**Every expression must be evaluable from the aggregate alone.** If a condition depends on
something the document does not model as data — a person outside the system, an external
system's answer — it is not expressible, and the transition's guard expression says so
explicitly rather than being approximated.

#### 3.5.2 The expression vocabulary

Declare the vocabulary in the glossary section, as a table under §3:

| Term | Type | Domain / Values | Notes |
|---|---|---|---|
Types are `flag`, `text`, `set`, `number`. A term whose domain the source spec leaves open
takes the literal `—` for its values. Terms come from the source document's own field
names — never invented for the model.

**Give the vocabulary its own subsection number, and make it unique within §3.** The
glossary section already carries subsections of its own — the overloaded terms, the
undefined terms — and the vocabulary is a third one. Two subsections under §3 that
both read `### 3.1` put two different tables in the same slot: a reader looking for
the vocabulary finds one of them by luck, and a parser that keys on the subsection
number reads whichever it reached first. Number the subsections in the order they
appear, and check before writing that no two headings under the same section carry
the same number.

**A parser must be able to find the vocabulary by its COLUMNS** — `Term`, `Type`,
`Domain / Values` — and not by the subsection number alone. The number is for the
reader; the columns are for the tooling. A checker that keys on the number reads the
wrong table the moment the document renumbers its subsections, and then reports every
expression in a sound document as unresolvable.

#### 3.5.3 What "not expressible" has to say

A condition the document does not model as data cannot be written over the vocabulary:
a person's role, an external system's answer, a stored history, a comparison against a
list the source does not contain. Write `not expressible` in the expression cell — and
**say what would be needed to express it**, in the same cell or beside it.

```
| TR-306 | … | `not expressible` — the match compares the legal name against the approved
  account's name in the Licensing app; modelling the approved accounts as data would
  express it | … |
```

A marking with no reason is indistinguishable from a marking nobody got to, and the
verifier's coverage figure becomes hollow: a document may mark half its invariants
unexpressive and still pass every check. The reason is what lets a reader tell
"the specification does not model this" from "the analysis did not reach this".

**The reason must be prose, not another expression.** A conjunct beside the marking is
not a justification — it says nothing about what would have to be modelled. So
`divisions.count > 0 && not expressible` is not one unevaluable condition: it is a
checkable conjunct beside an unevaluable one, and it needs a reason for the second
part in words.

**Prefer splitting the cell over mixing the marking in.** An invariant with a
checkable part and an unevaluable part is best written as two conjuncts, each
labelled, so the verifier can check what it can and report the rest as unchecked.
An evaluator that cannot evaluate a conjunct does not thereby declare the whole
invariant broken — it reports it as unchecked, and the difference between "checked and
violated" and "not checked" is the difference between a finding and a gap.

### 3.6 State invariants

Identify all business invariants associated with each state machine.

Classify invariants into:

1. State invariants: conditions that must hold whenever an object is in a particular state.
2. Transition invariants: conditions that must hold before or after a transition.
3. Aggregate invariants: conditions that must always hold across an aggregate boundary.
4. Cross-aggregate invariants: conditions involving multiple aggregates.
5. Temporal invariants: conditions involving deadlines, durations, expiration, ordering, or time windows.
6. Authorization invariants: conditions governing who may perform which operations.
7. Uniqueness and cardinality invariants.
8. Quantitative invariants: balances, totals, limits, quantities, and calculations.

For each invariant, document:

- Invariant ID.
- Business statement in natural language.
- **Formal expression, written in the expression language of §3.5.1.** This is
  mandatory wherever the invariant is a condition on the aggregate's data — which is
  nearly always. Where it genuinely is not expressible (it constrains something outside
  the model), write `not expressible` **and say what would be needed to express it**
  (§3.5.3); do not paraphrase it into prose and call the invariant formal.
- Scope.
- Applicable states. Name them as state identifiers or state names, or write
  **All states** — which means the invariant holds in every machine's states, so it
  binds to every machine. A cell that names neither a state nor a transition does not
  say which machine owns the invariant, and is a defect in the document.
- Applicable transitions.

**"All states" says which machines the rule binds to; it does not say how many times
to check it.** A verifier that checks such an invariant once per machine multiplies
every violation by the machine count and reports several hundred checks over a few
hundred states as several hundred violations of several different rules — a number a
reader can neither weigh nor distinguish from a defect. The rule holds wherever the
aggregate is, so it is checked ONCE against the aggregate. A state-scoped invariant is
checked in the states it names, on the machine those states belong to, and a
transition-scoped one is checked when that transition fires.

**The applicable-states cell is load-bearing, not a label.** It says where the
invariant is IN FORCE, and a verifier checks the invariant exactly there and nowhere
else. `Draft → submit` scopes the invariant to the submit from Draft — a precondition
of that one transition — and checking it in every state of the machine manufactures a
violation in every state the scope excludes. Write the scope so it names what the
invariant constrains: a state or state name when it holds throughout that state, a
transition when it is a precondition of that transition, and **All states** when it
holds always.
- Enforcement responsibility.
- Consequences of violation.
- Evidence, cited as §1.1 sets out, and the explicitness classification.

Distinguish invariants that must always hold from preconditions that only apply to particular operations.

### 3.7 State machine completeness analysis

Evaluate every state machine for:

- Reachability of every state.
- Existence of valid initial states.
- Existence of terminal states, if applicable.
- Missing outgoing transitions.
- Missing incoming transitions.
- Unreachable states.
- Dead ends.
- Ambiguous transitions.
- Overlapping guards.
- Contradictory rules.
- Missing rejection behavior.
- Missing timeout behavior.
- Missing recovery behavior.
- Unspecified transition behavior.

Do not invent missing transitions to make a state machine appear complete.

Instead, identify the gap and explain what must be clarified.

## 4. Cross-state-machine analysis

Identify relationships and dependencies between different state machines.

Look for:
- One state machine triggering another.
- Domain events consumed by other state machines.
- Shared business invariants.
- Dependencies between aggregate lifecycles.
- Process managers and sagas.
- Cascading state changes.
- Conditions requiring eventual consistency.
- Potential race conditions.
- Conflicting transitions.
- Ordering constraints.
- Compensation and rollback requirements.

Document these relationships in a dedicated cross-state-machine table.

## 5. Scenario reconstruction

Reconstruct the important business scenarios described or implied by the specification.

For each scenario, provide:

1. Initial business conditions.
2. Initiating actor.
3. Commands.
4. Preconditions.
5. State transitions in chronological order.
6. Domain events.
7. Resulting business conditions.
8. Rejection and exception paths.
9. Relevant invariants.

Use scenarios to validate the consistency of the extracted state machines.

Identify scenarios that cannot be completed because the specification is incomplete.

## 6. Traceability and evidence

Every extracted domain concept, state, transition, invariant, and business rule must have a source reference, written as §1.1 sets out.

Use the following classifications:

- EXPLICIT: directly stated in the specification.
- INFERRED: derived from multiple statements or business scenarios.
- CANDIDATE: plausible interpretation that needs validation.
- CONFLICTING: contradicts another statement.
- UNSPECIFIED: necessary information is absent.

Where possible, reference — a section is cited as §1.1 sets out:
- Section number, with the document's id: `[SRC-001, §6.3]`.
- Heading.
- Requirement identifier.
- Paragraph or table.
- Original wording or a short supporting quotation.

For inferred knowledge, explain the reasoning chain.

Never present an inferred business rule as an explicit requirement.

### The evidence cell names its document

An Evidence cell carries the citations and the words they support, and the
citations are written as §1.1 sets out — a document id and a section:

```
| Evidence |
|---|
| [SRC-001, §6.3] "Owner = default owner in Settings (Blanca)" |
| [SRC-001, §7.5], [SRC-001, §8.2] |
```

A cell that says `§6.3` and nothing else has said less than half of what
it must: the analysis and the specification both number their sections, and
the numbers overlap. §1.1 is the one place the format is stated, and it is
stated there because the rules below are about how to fill a cell, not about
what a citation looks like.

**This is the convention the §21 traceability matrix already uses**
(`[SRC-001, §6.3]`). Carry it into every Evidence cell, and a citation can be
resolved by an id rather than guessed at from the number.

## 7. Domain discovery questions

Create a final list of questions that a DDD practitioner should ask business stakeholders.

Prioritize questions about:
- Ambiguous states.
- Missing transitions.
- Conflicting invariants.
- Unclear aggregate ownership.
- Unclear business responsibilities.
- Authorization.
- Temporal behavior.
- Cancellation and reversal.
- Failure and recovery.
- Cross-aggregate consistency.
- Exceptional scenarios.
- Missing business definitions.

Rank each question by:
- Criticality.
- Business impact.
- Architectural impact.
- Whether it blocks reliable domain modeling.

## 8. Required output: ONE consolidated file

Produce exactly one consolidated Markdown file:

`domain-model-and-state-machines.md`

The file must be self-contained and organized as follows:

1. Executive Summary
2. Scope and Modeling Assumptions
3. Ubiquitous Language Glossary
4. Domain Concepts and Relationships
5. Entities and Value Objects
6. Aggregate Candidates and Consistency Boundaries
7. Commands and Business Actions
8. Domain Events
9. Domain Policies and Business Processes
10. State Machine Inventory
11. Detailed State Machine Definitions
12. State Definitions
13. State Transition Tables
14. State and Aggregate Invariants
15. Cross-State-Machine Dependencies
16. Business Scenario Reconstructions
17. State Machine Completeness and Consistency Analysis
18. Ambiguities, Contradictions, and Missing Requirements
19. Questions for Domain Experts
20. Traceability Matrix

Include Mermaid state diagrams where useful, but never use diagrams as a replacement for detailed transition tables.

Use consistent identifiers throughout the document, for example:

- `ENT-001`: Entity
- `VO-001`: Value Object
- `AGG-001`: Aggregate
- `CMD-001`: Command
- `EVT-001`: Domain Event
- `SM-001`: State Machine
- `ST-001`: State
- `TR-001`: Transition
- `INV-001`: Invariant
- `POL-001`: Policy
- `SCN-001`: Scenario
- `Q-001`: Domain Expert Question
- `SRC-001`: Source document (registered in §2; every citation carries it)
- `PAR-001`: Paragraph of a source document, used as a locator
- `TERM-001`: Ubiquitous-language term
- `N-01`: Rule written around a person, rewritten around a role

Padding within a series is the document's own choice but must be consistent — `N-01`
and `N-02`, not `N-01` and `N-002`. The series are what a parser matches on; the
numbers within one are what a reader cites.

Cross-reference these identifiers throughout the document.

### 8.1 The shape of each record

Several record kinds do not fit a table of the section's own rows: an aggregate is a
named thing with a breakdown under it, a scenario is a named path with stages, and a
rule written around a person is a pair of sentences. Give each of them a shape a
parser can find without ambiguity.

**A heading that carries a record's id IS the record.** Put the id in the heading,
in its own series' format, and let the heading's text carry the title:

```
### 7.1 AGG-001 — Application (candidate root: ENT-001)
### SCN-001 — New customer, terms and a discount, the full path
```

A parser matches the id pattern, not the section number — and the two are not the
same. One heading form is numbered (`### 7.1 AGG-001 — …`) and another is not
(`### SCN-001 — …`), because the scenarios belong to no subsection of their own. A
parser whose heading rule requires a digit-led number collects the aggregates and
silently loses the scenarios, and the series comes back empty with no error anywhere.
Give every heading-based record its id in the heading, whatever the heading's shape.

**An aggregate is a heading and an aspect table.** Under the heading, one table with
the columns `Aspect | Content | Evidence`, carrying these aspects: Root · Members ·
Commands it handles · Events it produces · Invariants it enforces · Consistency
rationale · References (held by id only) · Consistency expectations · Confidence.

**A scenario is a heading and labelled bullets.** Under the heading, one bullet per
stage, each with its label in bold: Initial conditions · Actor · Commands · Guards ·
State transitions · Events · Result · Exceptions · Invariants in force · Evidence.

**Keep the breakdown as structure, not as prose.** An aggregate's aspects and a
scenario's stages are separate fields. Flattened into one paragraph each, the page
that reads the document shows "Content" instead of the root, the members, the
consistency expectation and the invariant list — and the reader loses exactly the
breakdown they came for.

**A section may hold two different tables.** Bounded contexts and the context map
share a section; roles and the role-rewritten rules share a section. Distinguish
them by what a ROW contains — a cell holding an id of the series being collected —
and not by which section the row is in.

**Tables whose columns carry ids.** Sources: `ID | Document | Version | Sections |
Authority`. Bounded contexts: `ID | Context | Responsibility | Language boundary |
Evidence`. Role-rewritten rules: `# | As written | Rewritten as the role | Section`.

**The Sources table lists the sections of the source it is about.** Its `Sections`
column names the sections of THAT source, and it writes them as §1.1 sets out —
`[SRC-001, §§1–§14]`. A column that lists a source’s sections as bare numbers cannot
be told apart from a column listing some other source’s, and the table is the one
place where several documents’ section numbers sit side by side.

## 9. Quality assurance

Before finalizing the document, perform a second analytical pass.

Act as a skeptical senior DDD reviewer who did not perform the initial extraction.

Check:

- Have all business entities and concepts been identified?
- Have implicit state machines been actively searched for?
- Have all meaningful states been identified?
- Are all known transitions documented?
- Are guards and rejection conditions explicit?
- Are invariants distinguished from preconditions?
- Are aggregate boundaries justified by consistency requirements?
- Have cross-aggregate processes been identified?
- Are inferred rules clearly labeled?
- Is every important conclusion traceable to the specification?
- Does every source reference name the document it comes from, as §1.1 sets out?
- Have ambiguities and contradictions been exposed rather than hidden?
- Are the state machines internally consistent?
- Do reconstructed business scenarios agree with the documented state machines?

Correct any inconsistencies discovered during this review.

## 10. Final instruction

Prioritize completeness, domain fidelity, and traceability over brevity.

Do not optimize for producing a short document.

Do not generate application code or database schemas.

Do not prematurely prescribe a software architecture.

The objective is to produce a rigorous, business-oriented domain knowledge artifact that can subsequently serve as the foundation for:

- Collaborative domain discovery.
- DDD tactical modeling.
- Aggregate design.
- Domain event design.
- State machine implementation.
- Business rule validation.
- Acceptance criteria.
- Automated testing.
- Architectural decision-making.

If information is missing, document the gap instead of guessing.

The resulting file must represent the richest defensible domain model that can be extracted from the supplied functional specification.