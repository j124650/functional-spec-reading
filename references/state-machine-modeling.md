# State Machine Modeling Guidance

## What qualifies as a state machine?

A state machine is justified when a business concept has a set of meaningful conditions and its permitted behavior or next conditions depend on the current condition and a trigger.

A status field alone is insufficient evidence.

Look for:
- Different allowed actions depending on lifecycle position.
- Rules that permit or prohibit transitions.
- Events that change a business condition.
- Timers, deadlines, expiry, or scheduled progression.
- Approval/rejection paths.
- Lifecycle-specific invariants.
- History-dependent behavior.

## State dimensions

If payment, fulfillment, review, and entitlement can progress independently, model them as separate dimensions unless the specification explicitly couples them. Explain synchronization rules between them.

Avoid state explosion caused by taking the Cartesian product of independent dimensions.

## State categories

- Initial: starting business condition.
- Intermediate: condition from which further transitions are possible.
- Terminal: lifecycle is complete for the modeled purpose.
- Exceptional: business condition representing failure, suspension, dispute, or another exceptional circumstance.

A terminal state is terminal only relative to the modeled lifecycle. Do not assume it is irreversible unless the source says so.

## Transition semantics

A transition should identify:
- Current state.
- Trigger.
- Guard.
- Actor or process.
- Action/effect.
- Resulting state.
- Events emitted.
- Rejection behavior.

Distinguish:
- Trigger: what requests or causes evaluation.
- Guard: condition that must be true.
- Action/effect: what happens during the transition.
- Postcondition: what must be true afterward.

A missing transition is not the same as a forbidden transition. Use separate labels:
- Explicitly forbidden.
- Not described.
- Ambiguous.
- Candidate inferred transition.

In the deliverable these four are written as the `disposition` of a transition record:
`EXPLICITLY_FORBIDDEN`, `UNSPECIFIED`, `AMBIGUOUS`, and `CANDIDATE` — a transition the
source forbids is a record in the `transitions` array like any other, with its own
`TR-###` id, not a separate table.

## Machine classification

Each discovered machine is classified by how much the source establishes:
- `EXPLICIT` — the machine is directly described.
- `IMPLICIT` — derived from several statements, scenarios, or rules.
- `PARTIALLY_SPECIFIED` — some lifecycle elements are stated, but the model is
  incomplete.
- `CANDIDATE` — a plausible interpretation that needs confirmation.

State the evidence that decided the classification.

## Invariants

Use separate categories:
- State invariant.
- Transition precondition/guard.
- Transition postcondition.
- Aggregate invariant.
- Cross-aggregate process rule.
- Temporal invariant.
- Authorization rule.

Do not duplicate the same invariant under many categories without cross-referencing its canonical ID.

## Completeness checks

Check:
- Every state has evidence.
- Initial state(s) are identified or marked unknown.
- Each transition has a source and destination.
- Every trigger and guard is understandable.
- Reachability is assessed.
- Terminal semantics are clear.
- Exceptional paths are considered.
- Unspecified behavior remains visible.

Completeness is always relative to the supplied evidence, not a claim that the real-world domain has been exhaustively discovered.
