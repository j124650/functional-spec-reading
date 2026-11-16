# Domain Model and State Machines

<!-- HOW THIS DOCUMENT CITES. Every cell that says where a thing came from —
     an Evidence column, a Source references field, a classification's
     evidence, the Section column of a role-rewritten rule, the Relevant
     Sections of a source inventory row — cites a REGISTERED DOCUMENT ID and a
     locator, in brackets:

         [SRC-001, §6.3]
         [SRC-001, §3], [SRC-001, §12.1]
         [SRC-001, PAR-014]

     SRC-001 is the specification itself, from the source inventory below. One
     document, one id, and the id names the DOCUMENT. A paragraph of a source is
     located by PAR-###, assigned in reading order within that source; the
     paragraph glyph is not a locator. Never a bare §N and never a bare
     filename: this analysis and the specification both number their sections,
     and the numbers overlap, so a bare number names no document and cannot be
     resolved. If no reliable locator is available, cite the id alone —
     [SRC-001]. The evidence is grounded in the specification: an Evidence cell
     points at what the specification says, never at what this analysis
     concluded from it. -->

## 1. Executive Summary

- Domain purpose:
- Main business capabilities:
- Key domain concepts:
- State machines discovered:
- Critical uncertainties:

## 2. Source Inventory, Scope, and Assumptions

| Source ID (`SRC-###`) | Document | Version / Date | Relevant Sections | Authority / Notes |
|---|---|---|---|---|

### 2.1 Source and locator register

Every `PAR-###` used as a locator, and where it is.

| Source ID | Locator | Where | 
|---|---|---|
| SRC-001 | PAR-001 | §2.1, first paragraph | 

## 3. Ubiquitous Language Glossary

| Term ID | Business Term | Definition | Synonyms | Context | Evidence | Classification |
|---|---|---|---|---|---|---|

### 3.1 Expression vocabulary

Every data name the document uses, with its type. Expressions in §14 and §15 may name
these terms and nothing else.

| Term | Type | Domain / Values | Notes |
|---|---|---|---|

## 4. Domain Concepts and Relationships

Describe concepts and their business relationships. Include a Mermaid class or flow diagram only when it clarifies the model.

## 5. Entities and Value Objects

### Entities

| ID | Name | Identity | Purpose / Behavior | Lifecycle | Relationships | Evidence |
|---|---|---|---|---|---|---|

### Value Objects

| ID | Name | Meaning | Values | Validation / Constraints | Evidence |
|---|---|---|---|---|---|

## 6. Bounded Contexts

| ID | Context | Responsibility | Language Boundary | Evidence | Confidence |
|---|---|---|---|---|---|

## 7. Aggregate Candidates and Consistency Boundaries

| ID | Aggregate / Root | Members | Invariants | Commands | Events | Consistency Rationale | Confidence |
|---|---|---|---|---|---|---|---|

## 8. Commands and Business Actions

| ID | Command | Actor | Target | Preconditions / Guards | Effects | Events | Rejection Conditions | Evidence |
|---|---|---|---|---|---|---|---|---|

## 9. Domain Events

| ID | Event | Meaning | Trigger / Source | Affected Concepts | Consequences | Evidence |
|---|---|---|---|---|---|---|

## 10. Domain Policies and Business Processes

| ID | Policy / Process | Trigger | Condition | Action | Scope / Participants | Evidence |
|---|---|---|---|---|---|---|

## 11. State Machine Inventory

| ID | Name | Modeled Concept | Dimensions | Classification | Initial State | Terminal States | Confidence |
|---|---|---|---|---|---|---|---|

## 12. Detailed State Machine Definitions

Repeat the state-machine template for each machine.

## 13. State Definitions

| State ID | State Machine ID | Name | Meaning | Entry / Exit Conditions | Permitted / Forbidden Operations | Invariants | Evidence |
|---|---|---|---|---|---|---|---|

## 14. State Transition Tables

| Transition ID | From | Trigger / Command | Guard | Guard (expression) | Actor / Process | To | Effect (expression) | Events | Rejection | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|

## 15. State and Aggregate Invariants

| ID | Invariant | Category | Scope | States / Transitions | Formal expression | Enforcement Responsibility | Violation Consequence | Evidence |
|---|---|---|---|---|---|---|---|---|

## 16. Cross-State-Machine Dependencies

| Source Machine | Trigger / Event | Target Machine | Expected Effect | Ordering / Consistency | Evidence |
|---|---|---|---|---|---|

## 17. Business Scenario Reconstructions

### SCN-001 — Scenario name

- Initial conditions:
- Actor:
- Commands:
- Guards:
- State transitions:
- Events:
- Result:
- Exceptions:
- Invariants:
- Evidence:

## 18. Completeness and Consistency Analysis

| Machine ID | Check | Finding | Severity | Evidence / Rationale |
|---|---|---|---|---|

## 19. Ambiguities, Contradictions, and Missing Requirements

| ID | Issue | Conflicting / Missing Evidence | Impact | Proposed Clarification |
|---|---|---|---|---|

## 20. Questions for Domain Experts

| Question ID | Question | Priority | Business Impact | Architectural Impact | Blocks Modeling? |
|---|---|---|---|---|---|

## 21. Traceability Matrix and ID Registry

| Finding ID | Type | Summary | Classification | Source IDs (`SRC-###` only) | Rationale / Open Question |
|---|---|---|---|---|---|
