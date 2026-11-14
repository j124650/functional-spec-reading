# Illustrative Example — Library Loan

> This is a fictional teaching example, not a reusable assumption about every library.

## Domain concepts

- `ENT-001` Library Item: a copy that can be loaned.
- `ENT-002` Loan: a record of a borrowing agreement.
- `VO-001` Due Date: the date by which an item should be returned.
- `AGG-001` Loan: candidate aggregate rooted at Loan.

## State machine inventory

| ID | Name | Concept | Classification |
|---|---|---|---|
| SM-001 | Loan lifecycle | Loan | EXPLICIT in this illustrative example |

## SM-001 — Loan lifecycle

### States

| ID | State | Meaning |
|---|---|---|
| ST-001 | Open | The loan has been created and the item has not yet been returned. |
| ST-002 | Returned | The item has been returned and the loan is complete. |
| ST-003 | Overdue | The due date has passed while the item remains unreturned. |

### Transitions

| ID | From | Trigger | Guard | To | Event |
|---|---|---|---|---|---|
| TR-001 | — | Create loan | Item is eligible for loan | Open | LoanCreated |
| TR-002 | Open | Due date passes | Item remains unreturned | Overdue | LoanBecameOverdue |
| TR-003 | Open | Record return | Item is returned | Returned | ItemReturned |
| TR-004 | Overdue | Record return | Item is returned | Returned | ItemReturned |

### Invariants

| ID | Rule | Category |
|---|---|---|
| INV-001 | A returned loan is not an outstanding loan. | State invariant |
| INV-002 | A loan has one due date. | Candidate aggregate invariant; exact semantics require source support |

### Modeling cautions

- Do not infer that overdue loans cannot be renewed unless the source says so.
- Do not infer fines, grace periods, reservations, or suspension rules.
- Do not infer that return is irreversible; ask whether a correction process exists.
- The example demonstrates format, not a complete library domain.
