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

### 1.1 The engine's rules are in this skill, not in its source

A deliverable is checked by an engine: it parses the file, resolves every scope,
evaluates every guard and effect, and reports what it can reach and what breaks.
**The document must satisfy that engine, so the rules it applies are part of what
you produce.**

They are written down here, in this skill:

- **`references/executable-spec-model.md`** — how the engine reads the file: the
  shape of a guard (`guard.expression.value`) and of an effect (`effect.value`),
  what `notExpressible` and `alternatives` mean to it, how a scope resolves to the
  states it holds in, what an effect must look like for the engine to be able to
  evaluate it, and what a reachability claim must be based on.
- **`references/expression-reading.md`** — the expression language: what evaluates,
  what does not, and what the engine reports for each.
- **`references/gates.md`** — what each of the nine gates asks of the deliverable:
  how each one matches, what its failure means, and what to fix. The gates are the
  pass criteria, and this file is what they ask.

**Read these three before you write the behaviour keys** — `transitions`,
`invariants`, `stateMachines`, `scenarios`, `issues`. They are shorter than the
engine's source and the gate scripts, and they say the same thing.

**Do not read the engine's source code, and do not read the gate scripts.** The
first is the implementation rather than the specification; the second is the same
content as `references/gates.md` in a worse form. Reading either costs turns and
tells you less. When a gate rejects something, its own output names the record and
the rule that rejected it — that is the whole repair loop.

### 1.2 How a reference names where it comes from

**Every reference to a source names the source document it comes from, and it is
an object.**

```json
{ "source": "SRC-001", "locator": "§6.3" }
{ "source": "SRC-001", "locator": "PAR-014" }
{ "source": "SRC-001", "locator": null }
```

`source` is the id you gave the document in the `sources` array — the
specification itself is `SRC-001`. The id names the DOCUMENT; `locator` names the
PLACE inside it.

**A bare `§6.3` is not a citation.** The analysis numbers its own things and the
specification numbers its own, and the numbers overlap: a reader — or any tool that
reads the file — cannot tell which document a bare section number names. The
citation carries the id, so the question never arises.

And the document named is the specification. The evidence for a claim is
what the specification says, not what this analysis concluded from it — a
citation that points at the analysis points at the analysis.

**Every citation is grounded in the specification.** An `evidence` array says
where the specification says the thing — never where this analysis says
it. A reference to something the analysis issued an id for (SM-003, INV-004) is
not evidence; name that id in the field that takes ids, and the reader can find it.

**The rules.**

1. Every citation carries a registered source id in `source`, and a `locator` for
   the place inside it. No exceptions, no bare `§N`, in any field of the file.
2. The source id is one you issued in the `sources` array, one document per
   id. Do not invent an id, and do not cite a document you did not list there.
3. A locator is a section (`§6.3`), a page (`p. 17`), a requirement id
   (`Requirement REQ-17`), a table and row (`Table 4, row 2`), or a paragraph
   (`PAR-014`). Where several sources support one statement, the `evidence` array
   holds one object per source.
4. **A paragraph is located by `PAR-###`.** Assign those ids sequentially in
   reading order within each source document, to the paragraphs you use as
   evidence; keep the mapping stable and scoped by the source id, and record it in
   the `sourceLocatorRegister` array. **Never use the paragraph glyph as a
   locator**, alone or beside an id. If a paragraph cannot be reliably identified,
   cite the source id and another locator you can verify.
5. If no reliable locator is available, the locator is `null`:
   `{ "source": "SRC-001", "locator": null }`. Never invent a locator.
6. Cite the section of the document you actually read. A claim you inferred
   belongs to the section it was inferred *from*, with the classification
   saying it was inferred.
7. The citations stand in the order the evidence appears.
8. A quotation is its own field, not part of the citation:
   `"quote": "Owner = default owner in Settings (Blanca)"`.

**Use it in every field that asks where a thing came from** — an `evidence`
array, a source's `sections`, a classification's evidence, the `section` of a
role-rewritten rule. A file that cites by id in one place and by number in
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

These are the `entities` record's fields: `name`, `purpose`, `identity`, `attributes`,
`behaviours`, `lifecycle`, `relationships`, `rules`.

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

These are the `valueObjects` record's fields: `meaning`, `attributes`, `validation`,
`equalitySemantics`, `immutability`, `constraints`. A semantic the source does not
state is `null`, not a guess.

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

A candidate that was considered and ruled out is not an aggregate and does not go in
`aggregates`. It goes in `nonAggregateCandidates`, with the reason it was ruled out —
a thing the reader would otherwise ask about, because the specification's own nouns
invite the question.

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

These are the `domainEvents` record's fields: `name`, `meaning`, `trigger`,
`preconditions`, `resultingFacts`, `affectedConcepts`, `consequences`, `classification`.

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

These are the `commands` record's fields: `name`, `actor`, `target`, `requiredInput`,
`preconditions`, `invariants`, `effects`, `events`, `rejectionConditions`.

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

This vocabulary is the MACHINE's, and it is not the evidence vocabulary of §6 — the two
answer different questions. The machine's answer is the `classification` field of the
`stateMachines` record, written `EXPLICIT`, `IMPLICIT`, `PARTIALLY_SPECIFIED` or
`CANDIDATE`. How well each individual state and transition is evidenced is a separate
question, and it is answered by the `classification` field on those records, written
`EXPLICIT`, `INFERRED`, `CANDIDATE`, `CONFLICTING` or `UNSPECIFIED`.

Provide the evidence supporting the classification, cited as §1.1 sets out — it is
the `rationale` field of the machine record.

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

These are the `stateMachines` record's fields: `id`, `name`, `purpose`,
`modeledConcept`, `boundedContext`, `aggregate`, `dimensions`, `initialState`,
`terminalStates`, `finite`, `orthogonalDimensions`. The intermediate and exceptional
states are the states of those categories, and they are named by the `states` array —
not repeated here.

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

The state is one record of the `states` array, and §8.1 fixes its field names and
their types. A state must represent a meaningful business condition, not merely an
arbitrary value of a technical field.

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

These are the `transitions` record's fields: `id`, `machine`, `from`, `to`, `trigger`,
`commands`, `requiredInputs`, `guard`, `validations`, `invariantsChecked`, `actor`,
`effect`, `events`, `rejection`, `synchronous`, `disposition`, `classification`,
`rationale`, `notes`, `evidence`.

The transition is one record of the `transitions` array, and §8.1 fixes its field names
and their types.

#### 3.5 Transition records

Every transition of every machine is one record in the `transitions` array — the
fields are the list above, and §8.1 gives their names, types and allowed values.

`guard.text` is the business reading, in prose. `guard.expression` is the SAME
condition written in the expression language below — it is what a verifier evaluates,
and it is **mandatory**, not a summary of the prose. `effect` states what the
transition does to the aggregate's data; a transition that only changes state leaves
`effect` null.

A transition the source forbids, does not describe, or admits two readings is in the
same array, with its `disposition` naming which of those it is. It is never silently
assumed impossible, and never left out of the document.

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

A transition's state change is carried by `to`, not by the effect.

**Alternative readings.** Where the spec admits two readings of one rule, the
`expression` object's `kind` is `alternatives` and `values` holds one entry per
reading, each with its own `kind`:

```json
"expression": {
  "kind": "alternatives",
  "values": [
    { "kind": "expression", "value": "set('clock started', true)" },
    { "kind": "expression", "value": "clear('clock started')" }
  ]
}
```

The verifier evaluates each reading and reports a divergence when they land on
different states. A `to` that names two states is read the same way: two readings of
one transition, in `values`.

**Every expression must be evaluable from the aggregate alone.** If a condition depends on
something the document does not model as data — a person outside the system, an external
system's answer — it is not expressible, and the transition's guard expression says so
explicitly rather than being approximated.

#### 3.5.2 The expression vocabulary

Declare the vocabulary in the `expressionVocabulary` array — every data name the
document uses as a data name, with its type:

```json
{ "term": "licensing match", "type": "flag", "domain": null, "notes": "the outcome of the licensing check, run against the Licensing app" }
```

Types are `flag`, `text`, `set`, `number`. A term whose domain the source spec leaves
open takes `null` for its values. Terms come from the source document's own field
names — never invented for the model.

**The vocabulary is an array, so there is nothing to find by number.** The old form
put the vocabulary in a table under a numbered subsection and told a parser to
recognise it by its columns — `Term`, `Type`, `Domain / Values` — because the
subsection number was for the reader and the columns were for the tooling. A JSON
array has one shape and one place: the consumer reads `expressionVocabulary`, and
there is no second table to confuse it with.

**Every expression resolves against this array, and nothing else.** A name that is
not in the vocabulary is an unresolvable expression, and it must be reported, not
guessed.

#### 3.5.3 What "not expressible" has to say

A condition the document does not model as data cannot be written over the vocabulary:
a person's role, an external system's answer, a stored history, a comparison against a
list the source does not contain. The `expression` object's `kind` is then
`notExpressible` — and **the reason says what would be needed to express it**:

```json
"expression": {
  "kind": "notExpressible",
  "reason": "the match compares the legal name against the approved account's name in the Licensing app; modelling the approved accounts as data would express it"
}
```

A marking with no reason is indistinguishable from a marking nobody got to, and the
verifier's coverage figure becomes hollow: a document may mark half its invariants
unexpressive and still pass every check. The reason is what lets a reader tell
"the specification does not model this" from "the analysis did not reach this".

**The reason must be prose, not another expression.** A conjunct beside the marking is
not a justification — it says nothing about what would have to be modelled. So
`divisions.count > 0` beside a `notExpressible` marking is a checkable conjunct beside
an unevaluable one, and it needs a reason for the second part in words.

**Prefer splitting the record over mixing the marking in.** A guard with a checkable
part and an unevaluable part is best written as two entries in `values`, each with
its own `kind`, so the verifier can check what it can and report the rest as
unchecked. An evaluator that cannot evaluate an entry does not thereby declare the
whole guard broken — it reports it as unchecked, and the difference between "checked
and violated" and "not checked" is the difference between a finding and a gap.

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
- Applicable states. The `scope` field says which kind of scope it is —
  `AllStates`, `States` or `Transition` — and the `states` or `transitions` array
  names the ones it names. A rule that holds everywhere says `AllStates` and names
  none: an empty array cannot say "everywhere", because it is ambiguous between
  "none" and "all". A record that names neither a state nor a transition does not
  say which machine owns the invariant, and is a defect in the file.
- Applicable transitions.

**`AllStates` says which machines the rule binds to; it does not say how many times
to check it.** A verifier that checks such an invariant once per machine multiplies
every violation by the machine count and reports several hundred checks over a few
hundred states as several hundred violations of several different rules — a number a
reader can neither weigh nor distinguish from a defect. The rule holds wherever the
aggregate is, so it is checked ONCE against the aggregate. A state-scoped invariant is
checked in the states it names, on the machine those states belong to, and a
transition-scoped one is checked when that transition fires.

**The scope is load-bearing, not a label.** It says where the invariant is IN
FORCE, and a verifier checks the invariant exactly there and nowhere else. `scope`
`Transition` with `TR-019` scopes the invariant to that one transition — a
precondition of it — and checking it in every state of the machine manufactures a
violation in every state the scope excludes. Write it so it names what the
invariant constrains: `States` with the state ids when it holds throughout those
states, `Transition` with the transition ids when it is a precondition of one of
them, and `AllStates` when it holds always.
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

Document these relationships in the `crossMachineDependencies` array — one record per
dependency, naming the source machine, the trigger, the target machine, the effect
expected, the ordering constraint, and the evidence.

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

A document the source NAMES BUT DID NOT SUPPLY is not a source. It is never registered
in `sources` and never cited as evidence; it goes in `referencedButNotSupplied`, and
the rules that depend on it are `UNSPECIFIED` because of it.

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

### The evidence array names its document

An `evidence` array carries the citations and the words they support, and the
citations are written as §1.1 sets out — a document id and the place inside it:

```json
"evidence": [
  { "source": "SRC-001", "locator": "§6.3", "quote": "Owner = default owner in Settings (Blanca)" },
  { "source": "SRC-001", "locator": "§7.5" }
]
```

An evidence entry that says `§6.3` and nothing else has said less than half of
what it must: the analysis numbers its own things and the specification numbers
its own, and the numbers overlap. §1.1 is the one place the format is stated, and
it is stated there because the rules below are about how to fill an array, not
about what a citation looks like.

**This is the convention the `traceability` array already uses.** Carry it into
every `evidence` array, and a citation can be resolved by an id rather than
guessed at from the number.

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

## 8. Required output: ONE JSON file

Produce exactly one file:

`domain-model-and-state-machines.json`

It is a single JSON document — UTF-8, no comments, no trailing commas — and it is
the whole deliverable. It is written in the DDD's own vocabulary: the top-level keys
are the concepts a domain model is made of, and every key but `document` is an array
of records. Nothing sits outside the records — the explanation of a thing is a field
of that thing — so a consumer reads one place.

The file must be self-contained and organised as follows:

| Key | What it holds |
|---|---|
| `document` | the summary, the scope, and the assumptions |
| `sources` | the source inventory — one record per source document |
| `referencedButNotSupplied` | artefacts the source names but did not supply, and what each would settle |
| `sourceLocatorRegister` | every `PAR-###` locator, and where it sits |
| `glossary` | the ubiquitous language |
| `overloadedTerms` | one word carrying several meanings |
| `undefinedTerms` | terms used but never defined |
| `expressionVocabulary` | every data name an expression may use, with its type |
| `roles` | The roles the source names, what each may do, and who holds it. |
| `roleRewrittenRules` | rules written around a person, rewritten around a role |
| `domainConcepts` | the concepts, and how they relate |
| `entities` | entities |
| `valueObjects` | value objects |
| `boundedContexts` | the contexts and their responsibilities |
| `contextMap` | how the contexts depend on each other |
| `aggregates` | aggregate candidates and their consistency boundaries |
| `nonAggregateCandidates` | candidates considered for aggregation and ruled out, with the reason |
| `commands` | commands and business actions |
| `domainEvents` | domain events |
| `policies` | domain policies and business processes |
| `stateMachines` | one record per machine: its identity, its purpose, its shape |
| `states` | one record per state |
| `transitions` | one record per transition |
| `invariants` | state and aggregate invariants |
| `crossMachineDependencies` | how one machine's event moves another |
| `scenarios` | business scenario reconstructions |
| `completenessFindings` | the completeness and consistency analysis |
| `issues` | ambiguities, contradictions, and missing requirements |
| `questions` | questions for domain experts |
| `traceability` | every claim, mapped back to the source it came from |
| `idRegistry` | the identifier series: counts, ranges, where each is defined |

Every key is present, always, even when its array is empty.

The Mermaid diagram of a machine, when one clarifies it, is the machine record's
`mermaid` field — and it never replaces the transitions, which are records like every
other thing here.

Use consistent identifiers throughout the file, for example:

- `ENT-001`: Entity
- `VO-001`: Value Object
- `BC-001`: Bounded Context
- `CON-001`: Domain Concept
- `AGG-001`: Aggregate
- `CMD-001`: Command
- `EVT-001`: Domain Event
- `POL-001`: Policy
- `SM-001`: State Machine
- `ST-001`: State
- `TR-001`: Transition
- `INV-001`: Invariant
- `SCN-001`: Scenario
- `Q-001`: Domain Expert Question
- `F-001`: Issue (ambiguity, contradiction, or missing requirement)
- `SRC-001`: Source document (registered in `sources`; every citation carries it)
- `PAR-001`: Paragraph of a source document, used as a locator
- `TERM-001`: Ubiquitous-language term
- `N-01`: Rule written around a person, rewritten around a role

Padding within a series is the document's own choice but must be consistent — `N-01`
and `N-02`, not `N-01` and `N-002`. The series are what a parser matches on; the
numbers within one are what a reader cites.

Cross-reference these identifiers throughout the file, and never restate an id in
prose where the array already carries it.

### 8.1 The shape of each record

Every record is a JSON object with named fields. A field's type is fixed by this
section, and a consumer reads it without guessing. `id` is the record's own
identifier, where the model gives it one.

**Each record's fields are listed in a fixed order, and the list is the contract.**
Where the fields are given as `fields \`a\`, \`b\`, \`c\``, that list is the record's
shape — in that order, with those names, and no field added or omitted. The prose
after the list says what each one holds.

**`document`** — fields `title`, `purpose`, `capabilities`, `keyConcepts`,
`uncertainties`, `scope`, `assumptions`.
An object, not an array. `capabilities`, `keyConcepts` and `uncertainties` are arrays
of strings. `assumptions` is an array of objects: `statement`, `rationale`,
`evidence`.

**`sources`** — fields `id`, `document`, `version`, `sections`, `authority`, `notes`.
`sections` is an array of the sections of THAT source, one per element — never a
range. A range is never one element: `["§1", "§2", "§3"]`, never `["§§1–§3"]`.

**`referencedButNotSupplied`** — fields `artefact`, `referencedAt`, `wouldSettle`,
`evidence`.
`artefact` names the thing the source names but did not supply. `referencedAt` says
where the source names it. `wouldSettle` says what it would settle. A document the
source names but did not supply is not a source: it is never registered in `sources`
and never cited as evidence, and the rules that depend on it are `UNSPECIFIED` because
of it.

**`sourceLocatorRegister`** — fields `source`, `locator`, `where`.
Every `PAR-###` used as a locator, and where it sits. `where` is an object:
`section`, `openingWords`.

**`glossary`** — fields `id`, `term`, `definition`, `synonyms`, `context`, `status`,
`classification`, `rationale`, `evidence`.
`id` is `TERM-###`. `synonyms` is an array of strings. `status` is one of `Defined`,
`DefinedPartial`, `Overloaded`, `Pending`, `Undefined`.

**`overloadedTerms`** — fields `word`, `meanings`, `evidence`.
`meanings` is an array of objects: `meaning`, `sections` — and `sections` is an array
of section numbers, one per element.

**`undefinedTerms`** — fields `term`, `whereUsed`, `decisionNeeded`, `evidence`.
`whereUsed` is an array of strings.

**`expressionVocabulary`** — fields `term`, `type`, `domain`, `notes`.
`type` is one of `flag`, `text`, `set`, `number`. `domain` is an array of values, or
null when the source leaves the domain open.

**`roleRewrittenRules`** — fields `id`, `asWritten`, `rewrittenAsRole`, `section`,
`evidence`.
`id` is `N-01`.

**`domainConcepts`** — fields `id`, `name`, `description`, `relationships`,
`evidence`.
`id` is `CON-###`. `relationships` is an array of objects: `type`, `target`.

**`entities`** — fields `id`, `name`, `identity`, `purpose`, `attributes`,
`behaviours`, `lifecycle`, `relationships`, `rules`, `classification`, `rationale`,
`evidence`.
`id` is `ENT-###`. `attributes`, `behaviours` and `rules` are arrays of strings.
`relationships` is an array of strings.

**`valueObjects`** — fields `id`, `name`, `meaning`, `attributes`, `values`,
`validation`, `equalitySemantics`, `immutability`, `constraints`, `classification`,
`rationale`, `evidence`.
`id` is `VO-###`. `attributes`, `validation` and `constraints` are arrays of strings.
`equalitySemantics` and `immutability` are strings, or null when the source does not
say.

**`boundedContexts`** — fields `id`, `name`, `responsibility`, `languageBoundary`,
`confidence`, `confidenceNote`, `classification`, `rationale`, `evidence`.
`id` is `BC-###`. `confidence` is one of `High`, `Medium`, `Low`. `confidenceNote` is
the reason behind the confidence — a string, or null.

**`contextMap`** — fields `upstream`, `downstream`, `relationship`, `evidenceFor`, `evidenceAgainst`, `whatWouldSettle`, `evidence`.
No `id`: the pair (upstream, downstream) is the key.
`evidenceFor` and `evidenceAgainst` are arrays of citations: what the source says FOR the
relationship, and what it says AGAINST it. A relationship the source supports in one
direction only has an empty `evidenceAgainst` — and an empty array says so, which is
different from a relationship with no evidence either way.
`whatWouldSettle` is a string: what would decide the relationship, and it is empty only
when the source settles the relationship itself.


**`aggregates`** — fields `id`, `name`, `candidateRoot`, `responsibilities`, `members`, `commands`, `events`, `invariants`, `consistencyRationale`, `consistencyExpectations`, `references`, `confidence`, `confidenceNote`, `aspects`, `classification`, `rationale`, `evidence`.
`id` is `AGG-###`. `responsibilities` and `consistencyExpectations` are arrays of
strings. `members`, `commands`, `events`, `invariants` and `references` are arrays of
ids — and a reference holds an id, not a copy of the thing. `confidence` is one of
`High`, `Medium`, `Low`; `confidenceNote` is the reason behind it, or null.
`aspects` is an array of `{label, content, evidence}` — the aggregate's breakdown, as
STRUCTURE rather than as prose. The labels are the aggregate's own: Root · Members ·
Commands it handles · Events it produces · Invariants it enforces · Consistency
rationale · References (held by id only) · Consistency expectations · Confidence.
A consumer reads the breakdown as separate fields; flattened into one paragraph, the
page shows "Content" instead of the root, the members and the invariant list — and
the reader loses exactly the breakdown they came for. The flat fields above are the
SAME facts, kept for a reader who wants the aggregate as a whole; `aspects` is the
breakdown, and a consumer that wants one aspect reads one label.


**`nonAggregateCandidates`** — fields `name`, `reason`, `evidence`.
A candidate that was considered and ruled out. No `id`: the name is the key.

**`commands`** — fields `id`, `name`, `actor`, `target`, `requiredInput`,
`preconditions`, `invariants`, `effects`, `events`, `rejectionConditions`,
`classification`, `rationale`, `evidence`.
`id` is `CMD-###`. `requiredInput`, `preconditions` and `rejectionConditions` are
arrays of strings. `invariants` and `events` are arrays of ids.

**`domainEvents`** — fields `id`, `name`, `meaning`, `trigger`, `preconditions`,
`resultingFacts`, `affectedConcepts`, `consequences`, `classification`, `rationale`,
`evidence`.
`id` is `EVT-###`. `preconditions`, `resultingFacts` and `affectedConcepts` are
arrays of strings.

**`policies`** — fields `id`, `name`, `trigger`, `condition`, `action`, `scope`,
`participants`, `classification`, `rationale`, `evidence`.
`id` is `POL-###`. `participants` is an array of strings.

**`stateMachines`** — fields `id`, `name`, `modeledConcept`, `aggregate`, `boundedContext`, `purpose`, `classification`, `rationale`, `confidence`, `dimensions`, `finite`, `orthogonalDimensions`, `initialState`, `terminalStates`, `stateIds`, `transitionIds`, `completeness`, `mermaid`, `evidence`.
`id` is `SM-001`. `classification` is one of `EXPLICIT`, `IMPLICIT`,
`PARTIALLY_SPECIFIED`, `CANDIDATE` — how much the source establishes about the
MACHINE, which is a different question from how well each of its records is
evidenced. `rationale` is the evidence that decided it. `dimensions` is an array of
strings. `finite` is a boolean — false when the state set may grow without bound.
`orthogonalDimensions` is a boolean — true when the machine is a combination of
independently advancing dimensions rather than one. `terminalStates`, `stateIds` and
`transitionIds` are arrays of ids. `mermaid` is the diagram source, or null.
`completeness` is an object: `initialStateIdentified` (boolean), `reachability`,
`unreachableStates` (array), `deadEnds` (array), `terminalSemantics`,
`missingTransitions` (array), `guardOverlap`, `contradictions` (array),
`recoveryGaps` (array), `questions` (array of ids).

**`states`** — fields `id`, `machine`, `name`, `category`, `reopenable`, `meaning`,
`entryConditions`, `exitConditions`, `permittedOperations`, `forbiddenOperations`,
`invariants`, `incomingTransitions`, `outgoingTransitions`, `businessConsequences`,
`classification`, `rationale`, `evidence`.
`id` is `ST-###`. `machine` is a machine id. `category` is one of `Initial`,
`Intermediate`, `Terminal`, `Exceptional`. `reopenable` is a boolean. The rest are
strings, except `permittedOperations` and `forbiddenOperations` (arrays of strings)
and `invariants`, `incomingTransitions` and `outgoingTransitions` (arrays of ids).

**`transitions`** — fields `id`, `machine`, `from`, `to`, `trigger`, `commands`,
`requiredInputs`, `guard`, `validations`, `invariantsChecked`, `actor`, `effect`,
`events`, `rejection`, `synchronous`, `disposition`, `classification`, `rationale`,
`notes`, `evidence`.
`id` is `TR-###`. `machine` is a machine id. `from` is a state id, or null for a
transition that starts a machine. `to` is a state id, or null when the source does not
say. `commands`, `invariantsChecked` and `events` are arrays of ids.
`requiredInputs` and `validations` are arrays of strings. `actor` is an array of
strings. `guard` is an object: `text`, and `expression` — an object with `kind` and
the value that kind carries. `effect` is an object with `kind` and the value that
kind carries, or null when the transition only moves the state. `rejection` is a
string, or null. `synchronous` is a boolean. `disposition` is one of `ALLOWED`,
`EXPLICITLY_FORBIDDEN`, `UNSPECIFIED`, `AMBIGUOUS`, `CANDIDATE`. `notes` is an array
of strings.

**`roles`** — fields `name`, `mayDo`, `instances`, `evidence`.
`name` is the role's name as the source writes it. `mayDo` is what the source says
the role may do. `instances` is who the source names in that role, or empty when
it names nobody. `evidence` is the citation that says so.

**`invariants`** — fields `id`, `statement`, `category`, `scope`, `binding`, `states`, `transitions`, `formalExpression`, `enforcement`, `violationConsequence`, `register`, `classification`, `rationale`, `evidence`.
`id` is `INV-###`. `category` is one of `State`, `Transition`, `Aggregate`,
`CrossAggregate`, `Temporal`, `Authorization`, `Uniqueness`, `Quantitative`. `scope`
is one of `AllStates`, `States`, `Transition` — and it is NOT derivable from the
arrays, which is why it is its own field. A rule that holds everywhere is checked
ONCE against the aggregate; a rule scoped to named states is checked in each of
them. Writing "everywhere" out as the list of every state would turn one check into
one per state, and report one rule broken as several hundred breaks of several
different rules. So `scope` says which kind it is, and the arrays say which:
`states` holds the state ids when `scope` is `States`, `transitions` holds the
transition ids when `scope` is `Transition`, and both are empty when `scope` is
`AllStates`. `formalExpression` is a string, or null when the invariant is not
expressible.
`binding` is an array of ids: the aggregate, bounded context or machine the rule binds
to — `AGG-001`, or `BC-001` and `BC-005` for a rule that crosses two contexts. It is
SEPARATE from `scope`: the binding says WHAT the rule is about, the scope says WHERE it
holds, and a rule about an aggregate can hold in one state of it.
`register` is one of `stated`, `derived`, `broken by construction` — how the document
itself registers the rule.


**`crossMachineDependencies`** — fields `sourceMachine`, `trigger`, `targetMachine`,
`expectedEffect`, `ordering`, `evidence`.

**`scenarios`** — fields `id`, `name`, `initialConditions`, `actor`, `commands`, `guards`, `transitions`, `events`, `result`, `exceptions`, `invariants`, `parts`, `evidence`.
`id` is `SCN-###`. `commands`, `transitions`, `events` and `invariants` are arrays of
ids. `guards` and `exceptions` are arrays of strings.
`parts` is an array of `{label, text, evidence}` — the path's stages, as STRUCTURE rather
than as prose. The labels are the scenario's own: Initial conditions · Actor · Commands ·
Guards · State transitions · Events · Result · Exceptions · Invariants in force ·
Evidence. The flat fields above are the SAME facts, kept for a reader who wants the path
as a whole; `parts` is the staged breakdown, and a consumer that wants one stage reads
one label.


**`completenessFindings`** — fields `machine`, `check`, `finding`, `severity`,
`rationale`, `evidence`.
No `id`: the pair (machine, check) is the key. `severity` is one of `Critical`,
`High`, `Medium`, `Low`.

**`issues`** — fields `id`, `kind`, `severity`, `statement`, `conflictingEvidence`, `impact`, `proposedClarification`, `probe`, `classification`, `rationale`, `evidence`.
`id` is `F-###`. `kind` is one of `ConfirmedDefect`, `SpecGap` — the two have
different remedies, so they are never merged: a `ConfirmedDefect` is two sections
prescribing different outcomes for the same event, and the remedy is to pick a
reading and amend the specification; a `SpecGap` is something the specification never
says, and the remedy is to decide it and add the rule. `severity` is one of
`Critical`, `High`, `Medium`, `Low`. `conflictingEvidence` is an array of strings.
`probe` is a string, or null: the predicate that says the defect is REACHABLE — what
must be true of the aggregate in the state where the defect shows. A finding the
document states no predicate for is a spec gap, and `probe` is null.


**`questions`** — fields `id`, `question`, `priority`, `businessImpact`, `architecturalImpact`, `blocksModeling`, `related`, `classification`, `rationale`, `evidence`.
`id` is `Q-###`. `priority` is one of `Critical`, `High`, `Medium`, `Low`.
`blocksModeling` is a boolean.
`related` is a string: the findings this question bears on, by id — `F-01, F-09`.


**`traceability`** — fields `id`, `type`, `summary`, `classification`, `sourceIds`,
`rationale`, `openQuestion`.
`id` is the id of the RECORD this row traces — an `F-###`, an `INV-###`, a `TR-###`,
whatever that record's own id is — and `type` names the series it belongs to. It is
a reference, not a new id: a traceability row that carried an id nothing else
carried would issue a second series that resolves to nothing. `sourceIds` is an array
of source ids. `openQuestion` is a `Q-###`, or null.

**`idRegistry`** — fields `series`, `count`, `first`, `last`, `definedIn`,
`crossReferencedFrom`.
One row per series the document issues, and every series — a registry that lists
some of them is a registry a consumer cannot rely on. `count` is a number: how many
ids the series holds. `first` and `last` are the series' lowest and highest ids.
`definedIn` is the key the series is defined in. `crossReferencedFrom` is an array of
the keys that reference it.

### 8.2 The rules that make the file parseable

**One fact, one place.** A fact lives in exactly one record. Everywhere else it is
referenced by id, and the id is the whole reference — a name that repeats is a
second copy waiting to drift.

**Every key is always present.** An unknown scalar is `null`; an empty collection is
`[]`. A key that is missing is a key the consumer must guess about, and a consumer
that guesses is wrong somewhere.

**Two classifications, two vocabularies, two fields.** A record's `classification`
says how well THAT RECORD is evidenced, and is one of `EXPLICIT`, `INFERRED`,
`CANDIDATE`, `CONFLICTING`, `UNSPECIFIED`. A machine's `classification` says how much
the source establishes about the MACHINE, and is one of `EXPLICIT`, `IMPLICIT`,
`PARTIALLY_SPECIFIED`, `CANDIDATE`. The two never share a field, so a consumer
reading either one knows which question the answer answers.

**A `rationale` wherever a `classification` is.** Every record that carries a
`classification` also carries a `rationale` — the reasoning, in prose, for a record
that is not directly stated. It is `null` only when the classification is `EXPLICIT`
and there is nothing to explain. A record classified `INFERRED` with an empty
rationale asserts an inference it never shows.

**Enums are closed.** `category` is one of `Initial`, `Intermediate`, `Terminal`,
`Exceptional` — `Terminal (reopenable)` is `Terminal` with `reopenable: true`.
`disposition` is one of `ALLOWED`, `EXPLICITLY_FORBIDDEN`, `UNSPECIFIED`,
`AMBIGUOUS`, `CANDIDATE`. `severity` and `priority` are one of `Critical`, `High`,
`Medium`, `Low`. `confidence` is one of `High`, `Medium`, `Low`. `status` is one of
`Defined`, `DefinedPartial`, `Overloaded`, `Pending`, `Undefined`. A fifth spelling
is a defect in the file, not a new category.

**An expression is a value, not decoration.** The guard and effect expressions are
the plain text of the expression language (§3.5.1) — no backticks, no bold, no
leading or trailing space. `not expressible` is not a string a consumer must
recognise inside an expression: it is `expression.kind` = `notExpressible`, with the
reason in `expression.reason`. Two readings of one rule are `expression.kind` =
`alternatives`, with each reading in `expression.values`.

**A citation is an object.** An `evidence` array holds objects: `source` (a
registered source id) and `locator` (the place inside it, or null when there is
none to give). One citation per element — a range of sections is two citations, not
one — and never a section number without its document.

**Types are types.** An id is a string. A count is a number. A flag is `true` or
`false`, never `"true"` and never `"yes"`. An em dash is not a value: a field with
nothing to say is `null` or `[]`.

**No markdown inside a value.** No `**bold**`, no backticks, no list markers, no
pipe characters, and no line break — except in `mermaid`, where the diagram is
multi-line by nature.

**Order is fixed.** Every array is sorted by id, numerically within its series, so
two runs over the same source produce the same file and a diff shows what changed.

**Every id resolves.** An id that appears in `references`, `stateIds`, `members`,
`invariants` or any other reference field exists in the array it points at. No id is
issued twice in the array that issues it — and a `traceability` row's `id` is a
reference to a record that exists, not a second issue of that id.

**An id-shaped token inside a prose string is not an issued id.** The source has its
own numbering — its open-question numbers, its rule numbers, its requirement ids —
and those appear inside `notes`, `rules`, `description` and the other prose fields.
`OQ-17` is such a token: it is a thing the SOURCE calls something, and no array in
this file issues it. Only the `id` field of a record issues an id, and only that id
resolves to a record. A parser that collects every id-shaped token from the file
collects the source's numbering as well, and then reports a series that resolves to
nothing — so the id namespace is the `id` fields, not the text.

**The file is JSON and nothing else.** No comments, no trailing commas, no
unquoted keys, no `NaN`, no single-quoted strings, no `//` or `/* */`. A consumer
parses it with a standard JSON parser and nothing else.

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

**A reachability claim is a CLAIM, and the model has the answer.** A state with
no incoming transition from a reachable state is unreachable — and a completeness
finding that says "every state is reachable" is a statement about the transition
table, not about the specification. Argue it from the table, or compute it; do
not assert what you have not checked. The same holds for the guards: a guard that
reads a set no transition ever fills is a permanent false, and every state behind
it is unreachable however well the table reads. The specification's own rule for
adding things — what a submit adds, what an approval removes — is an EFFECT, and
an effect that is not modelled is a rule the model cannot see.

**The source's own tables are the FLOOR, not a starting point.** A row in one of
the source's tables is a fact the source states — a stage in its stage table, a
role in its roles table, a rule in its notification matrix, a question in its
questions table, an outside item in its outside-items table. Every one of them
must be accounted for: as a record, or with a stated reason in
`completenessFindings` why it is not modelled. A model that mentions such a row
in passing has not accounted for it, and the model that leaves it out entirely
has lost a fact the source stated outright.

Run the gate that proves it:

```
node scripts/check-source-coverage.js <the source .md> <the deliverable .json>
```

It reads the source's tables row by row and names what the deliverable does not
account for. A hole it reports is a hole in the analysis, not in the checker:
account for the row and re-run until it is clean.

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

The resulting file must represent the richest defensible domain model that can be extracted from the supplied functional specification, and it must be readable by a parser that was never told what the analysis meant.