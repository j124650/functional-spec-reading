# DDD Modeling Guidelines

## Purpose

This reference supplements `SKILL.md` with practical distinctions that prevent common domain-modeling errors.

## Domain model versus data model

A domain model represents business concepts, behavior, rules, and language. A data model represents stored structures. They may overlap, but they are not interchangeable.

Do not infer:
- Entity from every noun.
- Value object from every structured field.
- Aggregate from every parent-child relationship.
- Domain event from every system notification.
- Domain service from every operation.
- Bounded context from every organizational department.

Look for identity, business behavior, lifecycle, consistency requirements, and language boundaries.

## Entities

An entity has continuity and identity across changes. Ask:
- Does the business need to distinguish this instance from another with the same attributes?
- Does it have a lifecycle?
- Can it change while remaining the same business thing?
- Do business rules refer to this specific instance?

If not, it may be a value object, record, or projection.

## Value objects

A value object is defined by its values and meaning, not its own persistent identity. Look for concepts such as money, address, quantity, date range, percentage, identifier-as-value, or policy parameters. Do not call a concept a value object solely because it has no obvious ID in the specification.

## Aggregates

An aggregate is a consistency boundary with an aggregate root through which external modifications are controlled. Model only the invariants that must be protected consistently within that boundary.

Useful questions:
- Which facts must never contradict each other?
- What must be atomically consistent?
- Which changes can be eventually consistent?
- What is the smallest boundary that can enforce the invariant?
- Is the rule truly immediate, or can a process coordinate it?

Avoid oversized aggregates built from navigational relationships or UI composition.

## Bounded contexts

A bounded context is a boundary within which a model and its language have consistent meaning. Evidence may include:
- Same term used with different meanings.
- Different rules or lifecycle semantics.
- Separate business capabilities.
- Different ownership or source-of-truth responsibilities.
- Translation between models.

Treat proposed contexts as candidates when the specification does not establish the boundary.

## Commands, events, and policies

- Command: request or intent to do something; it can be rejected.
- Domain event: a business fact that has occurred; name it in past tense.
- Policy: a business reaction or rule connecting facts and actions.
- Process: a coordinated sequence of business activities, potentially long-running.

One command may produce zero, one, or multiple events. An event may trigger one or multiple policies. Do not assume one-to-one mappings.

## Invariants

An invariant is a condition that must remain true within a defined scope. State explicitly:
- Scope.
- When it must hold.
- Whether it is always true or only operation-specific.
- Who or what is responsible for preserving it.

A validation rule is not necessarily an invariant. A workflow dependency is not automatically an aggregate invariant.

## Modeling humility

When evidence is insufficient:
- Preserve alternative interpretations.
- Mark confidence and provenance.
- Ask a domain expert.
- Avoid premature tactical design.
