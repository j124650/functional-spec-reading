# Aggregate Design and Consistency Guidance

## Start from invariants

Discover the business rules first, then ask which rules must be enforced atomically. Do not start by grouping related nouns.

## Candidate aggregate questions

1. What business fact must never become inconsistent?
2. What operation changes that fact?
3. What information must be available to enforce it?
4. Must the change be atomic?
5. Can another aggregate be coordinated asynchronously?
6. What are the consequences of temporary inconsistency?
7. Does the specification state a transactional requirement, or is this an inference?

## Aggregate documentation

For each candidate:
- Root and members.
- Commands and behavior.
- Invariants protected.
- Events emitted.
- References to other aggregates.
- Consistency expectations.
- Evidence and confidence.

## Cross-aggregate rules

A rule involving multiple aggregates is not automatically one aggregate's invariant. It may be:
- A process-level business rule.
- A policy triggered by an event.
- A reservation/coordination requirement.
- An eventual consistency requirement.
- An unresolved business decision.

Document the business requirement without prescribing a saga, transaction coordinator, database transaction, or messaging technology unless requested.

## Avoid common mistakes

- One aggregate per database table.
- One aggregate per entity hierarchy.
- Large aggregates based on object navigation.
- Treating every cross-aggregate condition as synchronously enforceable.
- Assuming eventual consistency is acceptable without business evidence.
