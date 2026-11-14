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

### Expression vocabulary

Every data name the model's expressions may use, with its type. The `Guard (expression)`
and `Formal expression` columns below name these terms and nothing else — a name that is
not in this table is an unresolvable expression and must be reported, not guessed.

| Term | Type | Domain / Values | Notes |
|---|---|---|---|
| item eligible | flag | — | the item may be loaned |
| item returned | flag | — | the item has come back |
| due date | text | — | VO-001; the date by which the item should be returned |
| borrower may renew | flag | — | whether the borrower may renew; the source does not say |

### States

| ID | State | Meaning |
|---|---|---|
| ST-001 | Open | The loan has been created and the item has not yet been returned. |
| ST-002 | Returned | The item has been returned and the loan is complete. |
| ST-003 | Overdue | The due date has passed while the item remains unreturned. |

### Transitions

| ID | From | Trigger | Guard | Guard (expression) | To | Effect (expression) | Event |
|---|---|---|---|---|---|---|---|
| TR-001 | — | Create loan | Item is eligible for loan | `item eligible` | ST-001 Open | — | LoanCreated |
| TR-002 | ST-001 Open | Due date passes | Item remains unreturned | `!item returned` | ST-003 Overdue | — | LoanBecameOverdue |
| TR-003 | ST-001 Open | Record return | Item is returned | `item returned` | ST-002 Returned | `set('item returned', true)` | ItemReturned |
| TR-004 | ST-003 Overdue | Record return | Item is returned | `item returned` | ST-002 Returned | `set('item returned', true)` | ItemReturned |

### Invariants

| ID | Rule | Category | States / Transitions | Formal expression | Not expressible because |
|---|---|---|---|---|---|
| INV-001 | A returned loan is not an outstanding loan. | State invariant | All states | `state == 'ST-002' => item returned` | — |
| INV-002 | A loan has one due date. | Candidate aggregate invariant; exact semantics require source support | All states | `due date != ''` | — |
| INV-003 | Only a borrower may renew a loan. | Authorization | All states | `not expressible` | the borrower's role is a permission over who the user is, not a condition on the loan's data; the document would have to model the role and the borrower to express it |

### Modeling cautions

- Do not infer that overdue loans cannot be renewed unless the source says so.
- Do not infer fines, grace periods, reservations, or suspension rules.
- Do not infer that return is irreversible; ask whether a correction process exists.
- The example demonstrates format, not a complete library domain.

### What the example demonstrates

- The vocabulary declares every data name the expressions may use — and
  `borrower may renew` is present but unused, because no rule names it.
- A guard is prose **and** an expression. The prose is what a reader understands; the
  expression is what the verifier evaluates. They must say the same thing.
- An effect may be empty: TR-001 and TR-002 only move the state.
- `not expressible` carries a reason. INV-003 cannot be written because the borrower's
  role is not data — and saying so is what keeps the coverage claim honest, because a
  reader can tell the difference between "the specification does not model this" and
  "the analysis did not reach this".
- A guard expression reads the machine's own state through `state`, so the same
  expression works whatever the state ids are — this example's `ST-002` and another
  document's are different, and the expression follows the document.
