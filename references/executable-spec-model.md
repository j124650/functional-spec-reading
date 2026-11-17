# The executable spec model

**This is an optional instrument, not a stage of the pipeline.** The deliverable is the
consolidated JSON file. Reach for this file only when the reader asks for a computed
reachability result, or when the state space is too large to argue by hand — and even
then, build the model *after* the document, against the rules the document already
states.

**The model reads the file, and the file is already data.** The document's
`stateMachines`, `states`, `transitions`, `invariants` and `expressionVocabulary` arrays
are JSON, so the model parses them with a JSON parser and takes the guard and effect
expressions from `guard.expression.value` and `effect.value`. A guard whose
`expression.kind` is `notExpressible` is not an expression to evaluate — it is a
condition the aggregate cannot answer, and the model reports it as unevaluable rather
than skipping it. A guard whose `expression.kind` is `alternatives` is two or more
readings, and the model evaluates each.

When a spec has no implementation behind it in the workspace, "which invalid states can
the code actually reach" cannot be answered against code. It **can** be answered against a
model of the spec — and that turns argued claims into reproduced ones.

The model is a program that encodes the spec's rules and reports what they permit. It is
a proof instrument, not a product.

**Build it in the language the environment allows, not a fixed one.** The shapes below
use C# because that is one environment where a dependency-free console harness is easy;
the rules — the transition table as data, the two test kinds, the visited-set key, the
probe — are language-independent. If the environment forbids a language, port the rules,
not the syntax.

## Shape

A console project, no external packages (packages may not restore offline):

```
model/
  Onboarding.Model/
    Model/States.cs       enums + IDs, transcribed from the spec's tables
    Model/Application.cs  the aggregate: state + the fields the rules read
    Model/Rules.cs        the reconstructed transition table + guards, as methods
    Model/Invariants.cs   invariant checks, each returning violation + evidence
    Model/Graph.cs        the transition table AS DATA, plus the initial state
    Model/Explorer.cs     the breadth-first traversal over that table
    Model/Cloning.cs      deep-copy, so the traversal can branch on a state
    Model/Tests.cs        the two test kinds
    Program.cs            `tests` | `explore` | `export [file] [slim]` | `all`
```

**This layout is the TRANCRIBED model — one spec's rules, hand-written as code.** It is
the right choice when the instrument exists to answer a question about ONE document and
the reader will read the source. Choose deliberately; see the two modes below.

**The traversal needs deep-copy.** To branch, each successor is applied to a *clone* of
the current state, so exploring one branch never mutates the state another branch came
from. A model that mutates in place can only walk one path.

**Transcribe, don't paraphrase** — in the transcribed model. Every enum member carries
the spec's ID and its source section in a comment:

```csharp
public enum Stage
{
    Draft = 10,
    ReturnedToSales = 20,
    AwaitingLicensing = 25,   // Sec. 3: "new (e.g. 25)" - ID not committed
    InReview = 30,            // Sec. 3 lists In Review as "30/40" - two IDs, one stage
    Cancelled = 0,
}
```

This enum is **this spec's** stages. It is the clearest single marker of which mode you
are in: a document-driven model has no enum, because the state ids come from the parsed
document at run time. If you later find yourself wanting the model to work on another
spec, this enum is the first thing that has to go — and it is far cheaper to never write
it than to unpick it later.

## Keep the transition table as data

Model the rules as **data** (a table the explorer walks) and have the methods apply
them. Then the explorer and the tests read the same table, and a rule you add in one place
shows up in both. The `ActionDef` shape below is the one to use — it carries the stage
each action is legal at, which the explorer needs and a flat transition record lacks.

## Two modes — decide which one you are building, first

| | **Transcribed model** | **Document-driven model** |
|---|---|---|
| The rules live | in C#, hand-written | in the document, parsed at run time |
| One document, one engine | ✅ | ✅ |
| A second document, same engine | ❌ the engine does not fit it | ✅ |
| Cost | lower | higher — the document must carry machine-readable logic |
| Use it when | the instrument answers one question about one spec | the verifier is to be re-runnable against any spec in this format |

**Choose before writing code.** Building a transcribed model and then asking for it to be
universal is how a per-spec engine ends up wearing a universal label: it parses the
document's *structure* faithfully while its *rules* stay hand-written for one spec, so it
works on the document in front of you and fails on the next one. The tell is a rule layer
whose predicate names things the document's schema does not contain — an aggregate with a
property per entity, a key struct per machine, a context table listing which fields each
machine reads.

**A rule layer is unavoidable; a per-spec rule layer is not.** A guard written in prose —
"the customer's e-mail is on file" — cannot be evaluated mechanically, so *somebody* must
encode it. The choice is whether that encoding lives in C# or in the document. If the
verifier is to be reusable, it lives in the document: the fix is to the **generation
rules**, not to the engine.

**So fix the input format instead of working around it in code.** When the generated
document lacks a field the verifier needs, add that field to the *document's* rules and
regenerate. Do not add a hand-written predicate to the engine to compensate. A
workaround in the engine is invisible in the document, so the next reader cannot tell
which rules came from the spec and which came from the author of the model — and the
author of the model is the wrong place for the spec's rules to live.

The document-driven shape:

```
model/
  Onboarding.Model/
    Model/Document.cs     the parser: machines, states, transitions, invariants, vocabulary
    Model/Expressions.cs  the expression language: tokenise, parse, evaluate
    Model/Aggregate.cs    machine id -> state id, plus the attribute bag
    Model/Graph.cs        the transition table AS DATA, built from the parsed rows
    Model/Scope.cs        what an invariant's scope column means, resolved from the document
    Model/Invariants.cs   checks driven by the document's invariant expressions
    Model/Explorer.cs     the breadth-first traversal over that table
    Model/Tests.cs        the two test kinds
    Program.cs            `parse` | `check` | `explore` | `export [file] [slim]` | `all`
```

**The engine holds no entity of any particular document.** No property named after a
spec's stage, link, credit check or person; no literal value; no hand-written key struct
per machine. The aggregate is a map from machine id to state id, the key is computed from
the document's own state tables and expression columns, and the rules are the document's
expression columns.

**The guard column is prose; prose cannot be evaluated.** This is the single fact that
decides the mode. If the verifier's rules are prose in the document, they must be
hand-written in C#, and then they are that document's rules. The document therefore needs
an expression beside the prose — a guard condition and an effect for each transition, a
formal expression for each invariant, and a vocabulary the expressions draw on. The
processing prompt's §3.5 and §3.6 specify those columns and §3.5.2 declares the
vocabulary; the vocabulary is what lets a reader check that every expression names a
term the document defines.

**Give the engine a `check` mode and run it before anything else.** It resolves every
expression in the document against the document's own vocabulary and reports any that
names an undefined term. That check is what makes the universality claim mechanical
rather than promised — an engine that cannot even resolve its own document's expressions
is not ready to verify anything. Run it, and treat a failure as a defect in the
document's expressions, not as something to work around in the engine.

**Two things an expression parser must get right.** A vocabulary term may be several
words ("legal business name"), so the tokenizer matches terms against the vocabulary
rather than splitting on whitespace — otherwise the term becomes three undefined
identifiers and every expression naming it fails to resolve. And a literal pipe is
ordinary text: `||` is the language's "or", and in a Markdown table cell an unescaped
`|` ends the cell, so the table parser must rejoin a pipe pair before the expression is
read.

**A parser must find a table by its COLUMNS, not by its section number.** One section
of the document carries several tables — the glossary's terms, its overloaded terms, its
undefined terms, the expression vocabulary — and two of them must not be told apart by
a subsection number they share. A parser that keys on the number alone reads whichever
table it reached first, so the vocabulary it finds may be the wrong table entirely, and
the expressions then resolve against terms that are not there. Give the vocabulary its
own subsection number, keep that number unique within its section, and have the parser
recognise the table by the column names it actually needs — `Term`, `Type`,
`Domain / Values` — so renumbering a subsection cannot silently change what the engine
reads.

**The same section's tables may spell the same column differently.** One section
holds a table per machine, and the machines are not uniform: the custody machine lists
its states in a `Value` column where the others use `Name`. A parser that asks for one
header name reads a missing column, and every cell in that table comes back empty —
the machine renders as blank boxes while the others are fine. Accept the alternatives
and take whichever the table has:

```csharp
var name = r.Cell(t.Col("Name", "Value"));
```

**A heading that carries an id is not a numbered subsection heading.** A parser that
dispatches on `### N.N` reads `### 7.1 AGG-001 — …` and skips `### SCN-001 — …`,
because the second has no section number — and the skip is silent: the heading is
neither matched nor reported, so the series it defines simply comes back empty, and
an empty series reads as "the document has no scenarios" rather than "the parser
never looked". Match each heading shape on its own, and give the id-bearing shape
its own branch:

```csharp
var agg = Regex.Match(line, @"^###\s+(?:\d+(?:\.\d+)*\s+)?(AGG-\d+)\s*(?:—|-)\s*(.*)$");
var scn = Regex.Match(line, @"^###\s+(SCN-\d+)\s*(?:—|-)\s*(.*)$");
```

**When a series comes back empty, look at the LINE that carries it, not at the
count.** Grep the document for the id prefix and read the shape of the line that
holds it. The defect is nearly always that the document's shape is not the shape the
parser expects — a heading that is not a numbered subsection, a table whose columns
are spelled differently, a body that is a list rather than a table.

**One section can hold two tables of DIFFERENT shapes, and the section number cannot
tell them apart.** One section holds the roles table and the rules written around a
person's name; another holds the bounded-context table and the context map.
Dispatch on the row's own id prefix — `N-`, `BC-` — and let the section number choose
the neighbourhood, not the record.

**A section's body can be a table or a list, and both carry structure.** An aggregate
is a heading plus an Aspect/Content/Evidence table; a scenario is a heading plus
labelled bullets (Initial conditions, Actor, Commands, Guards, Result). Parse the
structure into the record — `IReadOnlyList<(string Aspect, string Content, string
Evidence)>` — rather than joining the lines into one string: a joined string cannot be
rendered as the breakdown the document actually gives, and the page then shows a
paragraph where the reader expects a table.

**A separator row is not data.** A table's header is followed by a `|---|---|` row. If
the document is edited and a second separator is left behind — a header replaced
without the old separator removed — a parser that skips only the row it expects reads
the stray separator as a record, and the record's ID is a row of dashes. Skip every row
whose cells are all separators, wherever it appears:

```csharp
if (cells.All(c => c.Trim().Length == 0 || c.Trim().All(ch => ch == '-' || ch == ':')))
    continue;
```

**Unwrap the code fence BEFORE comparing against a sentinel.** An expression written
`not expressible` in the document keeps its backticks in the cell, so a check that
compares the raw cell against the bare word never matches — every such invariant is
then reported as checkable, and the coverage claim is wrong in the direction that
inflates it. Unwrap first, then compare:

```csharp
var expression = Expressions.Unwrap(invariant.Expression);
if (expression.Equals("not expressible", StringComparison.OrdinalIgnoreCase)) return false;
```

**Resolve a row's endpoints against the states of the machine the row belongs to.**
A transition's `From` and `To` name states, and a name can be ambiguous across the
document: a custody transition says "Owner", and two machines have a state whose name
begins that way. Resolve by id where the cell gives an id, otherwise by matching a
state of THIS machine, and require exactly one match — zero matches and several
matches are both "unstated", and both belong in the unstated list rather than in a
guessed edge.

**`not expressible` must be justified, or the coverage claim is hollow.** A condition
the document does not model as data — a person's role, an external system's answer, a
stored history — cannot be written over the vocabulary, and it is marked
`not expressible`. But a marking with no reason is indistinguishable from a marking
nobody got to. So every `not expressible` states **what would be needed to express it**:
the system, the field, or the role that would have to be modelled. The report then
distinguishes "the specification does not model this" from "the analysis did not reach
this" — and a document that marks half its invariants unexpressive without saying why
is not ready to be verified.

**A document that says "All states" binds the invariant to every machine — and the
invariant is checked ONCE per aggregate state, not once per machine.** When an
invariant binds to no particular machine, its "States / Transitions" column says "All
states": the rule holds wherever the aggregate is, so it is judged against the
aggregate. Checking it once per machine multiplies every violation by the machine
count, and reports several hundred checks over a few hundred states as several hundred
violations of several different rules — a number the reader cannot weigh and cannot
tell from a defect. The BINDING decides which states the rule covers; the CHECK
FREQUENCY is decided by the scope's shape. A cell that names neither a state nor a
transition is a defect in the document, not a licence to guess which machine owns the
invariant.

## The two test kinds

This is the core idea, and it is what makes the claims load-bearing.

**Conformance tests** assert what the spec states *unambiguously*. They must PASS.

```csharp
TestRunner.Conformance("BASE  a clean submit reaches In Review with the right auto-requirements", () =>
{
    var app = Make();
    var r = app.Submit(Role.Sales);
    TestRunner.True(r.Passed, "the submit passes");
    TestRunner.Equal(Stage.InReview, app.Stage, "Sec. 6.3 : In Review");
    TestRunner.Equal("Blanca", app.Owner, "Sec. 6.3 : default owner");
});
```

**Defect-reproduction tests** assert the *correct* behaviour for a confirmed defect.
They must **FAIL** against the spec as written — that failure IS the proof the defect is
real and reachable.

```csharp
TestRunner.Defect("F-15", "the clock must start at the first submit attempt", () =>
{
    // Sec. 3: "The aging clock starts at the first submit and never resets."
    // Sec. 6.3 puts "First submit only: the clock starts" under "On pass".
    var app = Make();
    app.Decisions["D1"] = DivisionDecision.Unmatched;
    app.Submit(Role.Sales);
    TestRunner.True(app.ClockStarted,
        "Sec. 3 : the clock starts at the FIRST submit, whether or not the checks pass");
});
```

**A defect test that PASSES means the defect is not reproducible as documented.** Treat
that as a finding about your own analysis, not as a win: either the model does not
implement the rule you think it does, or the rule does not support the claim you made.
Re-derive the model against the spec before touching the test. When the team later
decides the other reading, the defect test flips green and the conformance test flips
red — that is the intended signal.

The runner reports the two counts separately, and exits non-zero if any conformance test
fails or any defect test unexpectedly passes.

## Dependency-free harness

When packages cannot be restored, write the runner:

```csharp
public static void Conformance(string name, Action body) { /* try/catch, count */ }
public static void Defect(string id, string name, Action body) { /* must throw */ }
public static void True(bool c, string msg); public static void Equal<T>(T e, T a, string msg);
```

`Defect` inverts the sense: it counts a pass as an error, because the assertion is
supposed to fail against the spec as written.

## Reachability explorer — traverse, do not visit

**Enumerate the reachable set by breadth-first traversal over an explicit transition
table.** Start from ONE initial state, apply every action whose stage and guard permit
it at the current state, and enqueue each successor. A state is reported only if some
sequence of spec-permitted actions produces it.

A model that visits hand-built snapshots has *asserted* reachability; one that traverses
has *computed* it. The difference is not stylistic: a snapshot built by writing a field
directly bypasses every guard the spec states, so it proves your construction was
possible, not that the spec permits the path. This is the single most common way a
reachability claim turns out to be false.

### One aggregate, one traversal — not one traversal per machine

**The document's machines are dimensions of ONE aggregate, so the traversal runs once
over that aggregate.** Every transition is a step on it, whichever machine owns it.
The per-machine traversal — one frontier per machine, each machine's own transitions
only — is the shape the "one initial state" rule above warns against, and it fails in
a specific way: a target machine's guard often reads a term that only a *different*
machine's transition sets ("the customer's e-mail is on file"), so the target's guard
can never hold inside its own state space. The target then reports one reachable
state and an exhausted frontier, which reads as a healthy result and is not.

**Do not repair it by walking the source machine's transitions inside the target's
traversal.** That is the obvious fix and it does not work: the coupling relation is
transitive, and a document in which one machine is the source for most of the others
(§16 is usually exactly that) makes the closure the whole document. The repair then
multiplies each machine's frontier by every other machine's, and the traversal stops
closing rather than starting to. The coupling is real, but it is a property of the
AGGREGATE, not a licence to cross frontiers.

So: one aggregate (machine id → state id, plus the data bag), one frontier, one
visited set. The hierarchy is preserved in the aggregate's STRUCTURE and in the
REPORT's grouping — the report asks, per machine, how many reachable states have the
application in that machine's state — not in the traversal's shape.

### The transition table as the explorer's input

Give every action a **group** (the action family), a **reading** (which sentence of the
spec authorises it), the **stages it is available at**, a **guard**, and an **effect**. In
the transcribed model the guard and the effect are code:

```csharp
public sealed record ActionDef(
    string Id, string Group, string Reading, string Section, string Label,
    Stage[] From, Func<Application, bool> Guard, Action<Application> Apply,
    string? Note = null, bool Enabled = true);
```

In the document-driven model they are **expressions parsed from the document's rows**:

```csharp
public sealed record ActionDef(
    string Id, string Machine, string Group, string Reading, string Section,
    string[] From, string[] To,
    string GuardExpression,   // the document's own "Guard (expression)" cell
    string EffectExpression,  // the document's own "Effect (expression)" cell
    string Label);
```

The second shape is the one that keeps the engine spec-neutral: the guard is evaluated by
the expression engine against the aggregate, so the same code verifies a document it has
never seen. The first shape cannot be, because the predicate *is* the spec.

`From` is what makes an action legal: the spec's state table says who may act in each
state, so an action offered outside its states is not permitted. Without it the graph
invents transitions the spec never allows, and the state count inflates.

**Two readings of one group that land on different states is a contradiction, found by
traversal rather than argued.** Encode both and let the explorer find them:

```csharp
new("rts.resubmit-7.5", "resubmit", "7.5", "Sec. 7.5", "Resubmit - returns to the stage it came from", ...),
new("rts.resubmit-6.3", "resubmit", "6.3", "Sec. 6.3", "Resubmit - Stage goes to In Review", ...),
```

The explorer compares the outcomes of each group **from the same source state** and
reports the divergence. Compare per source state — comparing globally reports every
pair of states that merely resemble each other.

**A divergence is only a contradiction if both readings describe the SAME action.**
Two different actions that happen to share a group — "approve the item" and "refuse the
item" — are not two readings of one rule, and reporting them as a contradiction
contradicts nothing. Split them into distinct groups so each group holds one action's
readings:

```csharp
new("ir.item-credit-approve", "item-credit-approve", "9", "Sec. 9", "Approve the credit item", ...),
new("ir.item-credit-refuse",  "item-credit-refuse",  "9", "Sec. 9", "Refuse the credit item", ...),
```

The divergence check then compares only the two readings of one action, and the false
positives disappear.

### A guard may test what the command carried, not only what the aggregate holds

A create command carries the value it sets. A guard of the form `business unit != ''`
then never holds, because the aggregate does not hold the value until the transition
that the guard is blocking has fired — a deadlock that reads as "the machine has one
reachable state" rather than as an error.

So a guard on a value the command brings tests `input`, and the traversal evaluates
the guard **once per candidate input**, not once per state:

```
| TR-001 | — (initial) | CMD-001 Create application | Business unit chosen | `input != ''` | Sales | ST-001 Draft | `set('business unit', input)` | … |
```

**When a machine explores fewer states than it has, suspect this first.** A guard that
cannot hold, a `From` cell that names no state the machine can be in, and an effect
that writes a term nothing reads all produce the same symptom: a tiny reachable set
with an exhausted frontier, which looks healthy. Check that each machine's reachable
count is consistent with its own state table before believing the frontier closed.

**The fourth cause is coupling, and it is the one a per-machine traversal cannot see.**
If the machine's guard reads a term that only a *different* machine's transition sets,
the guard can never hold inside the machine's own state space — the target reports one
reachable state, exactly as a guard that cannot hold would. A machine whose count
stays at one while its own state table lists five states is not a machine with one
reachable state — it is a machine whose inputs nobody supplies. The fix is the
traversal's shape, not a rule added to the target: see *One aggregate, one
traversal*.

### The visited-set key must include every field an invariant or action can read

This is the subtlest bug in the whole instrument. The key identifies a state for the
visited-set; **a field left out of it makes two genuinely different states collide, and
the second one is then silently never explored** — the violation it would have revealed
disappears without any error.

A discount line left out of the key hid `INV-06` entirely, because the state where a
dropped division's discount line survives collided with the state where it does not.

```csharp
// Every field an invariant or an action can read MUST appear here.
public static StateKey KeyOf(Application a) => new(
    a.Stage, a.CreditCheck, a.Allowance, a.HrItem, a.Link, a.ClockStarted, a.ClockStopped,
    a.OwnerKey,
    string.Join(",", a.Divisions.OrderBy(x => x)),
    string.Join(",", a.DiscountLines.OrderBy(x => x)),      // omitting this hid INV-06
    string.Join(",", a.Decisions.OrderBy(x => x.Key).Select(x => $"{x.Key}={x.Value}")),
    a.CreditApplicationSigned, a.LegalBusinessName, a.CreditApplicationName ?? "",
    a.ErpCustomerCreated, a.BusinessUnit, a.TermsRequested, a.TermsDeclined,
    a.PricingDisplay?.ToString() ?? "-");
```

**In the document-driven model the key is COMPUTED, not written.** The same rule applies —
every field an invariant or action can read MUST appear — but the list of those fields is
read out of the document rather than typed by hand: take every vocabulary term named by
ANY transition's guard and effect expression, plus every term named by ANY invariant's
formal expression, and hold those values in the key alongside the state of EVERY
machine. Because the traversal runs over one aggregate, the key must too: a key holding
one machine's state lets the aggregate's other dimensions collapse, and the states that
collapse are exactly the ones a coupled guard was waiting for.

Two ways this goes wrong, and both are silent:

- **The key holds only the machine's state.** Then every state that differs only in data
  collapses into one, the second is never explored, and the reachable set collapses to a
  handful of states — the traversal looks healthy and reports almost nothing.
- **The key holds a hand-written list of this document's fields.** Then the engine no
  longer fits another document, and the universality claim is false even though every
  test passes.
- **The key renders a flag's unset and its false as different values.** The document's
  own type says a flag is true or unset — "false" is not a third state of it. So the
  key must render an unset flag and a flag set to false identically, or the two never
  collide, the traversal explores both, and a dozen flags become two to the power of a
  dozen states that differ in nothing. Render what the value IS, not whether it was
  written. A flag's candidate values are `true` alone for the same reason — offering
  `false` doubles every flag's branch count for a value the aggregate already
  represents as absence.

**Derive the key's contents from the document, and let the derivation be the check.** If
the computed read-set is empty for a machine whose guards clearly read something, the
parser is wrong — not the machine.

**Keep the state space bounded, or the frontier never closes.** An action that appends
without limit (say, an "edit" that adds a discount line instead of replacing it) makes
the reachable set infinite, the traversal hits its cap, and the result is a truncated
frontier — which is an *asserted* result wearing a computed result's clothes. Enforce
the spec's own cardinality rule ("one line per division") in the effect, not just in a
comment.

**A command that carries a value makes the state space branch.** An edit, a note, a
chosen item — each brings a value the document does not name, so the traversal must
supply candidates or it cannot explore the state at all. Two rules keep that bounded:

- **Take the candidates from the document.** The values a term may take come from the
  vocabulary's declared domain; where the document leaves a domain open, the term has
  no declared values and the traversal uses one placeholder — the term's own name. Do
  not invent domain data to make the traversal interesting.
- **Impose a canonical order on the edits.** If every field may be edited in every
  combination, the frontier is exponential and never closes. Edit the fields in the
  order the document lists them — one field per step, in a fixed order — so the
  reachable set is finite and every *rule* still gets to fire. This is a bound on the
  exploration, not a claim that the order does not matter; say so in the report.

  Two ways this goes wrong, and both are silent:

  - **The order is alphabetical, not the document's.** A vocabulary read into a
    `Dictionary` and enumerated with `OrderBy(x => x)`, or a read-set collected into a
    `SortedSet<string>`, reorders the document's list without changing anything else.
    The document groups its terms by what they are FOR, and that grouping is what
    makes the edit order meaningful; an alphabetical order is a different order, and
    the traversal silently explores a different space than the one you meant to. Keep
    the document's order in a list that preserves insertion, and never sort a set
    whose order the document owns.
  - **The edit offered is a field the key does not read.** Then the edit changes
    nothing in the visited-set key, the successor collides with the state it came
    from, and the traversal dead-ends — with an exhausted frontier, which looks
    healthy. Offer only a field the machine's own key reads.

### Four ways a document-driven model invents a defect that is not there

Each of these produces a report that is confidently wrong, and each is a silent
failure in the engine rather than a defect in the document.

**1. An accessor applied to the wrong type is coerced instead of rejected.** The
expression language defines `term.count` and `term.contains('x')` as **set**
operations. Applied to a `text` term they have no meaning — so the evaluator must
return *unknown*, not zero. A `text` term's `count` coerced to `0` turns
`business unit.count == 1` into a permanent falsehood, and every state of the
machine then reports the violation. `check` must treat the type mismatch as a defect
**in the document** — the expression names a set operation on a term the document
typed as text — because the engine cannot invent the reading that would fix it.

**2. An expression that does not evaluate is reported as a violation.** This is the
opposite error and just as damaging: a condition the document marks `not expressible`,
or one whose conjuncts are only partly expressible, is **unchecked**, not broken.
Reporting it as violated asserts that the specification breaks a rule it never states.
Keep the two counts apart in the report, and say how many invariants were checked in
full, in part, and not at all — a reader who sees "12 of 48 invariants checked" can
weigh the silence, and a reader who sees "40 violations" cannot.

Split an expression on its top-level `&&` before judging it: the conjuncts are
independently checkable, so one unevaluable conjunct does not condemn the rest. An
invariant written `divisions.count > 0 && not expressible` has a checkable half and
an unevaluable half, and the report says exactly that.

**3. An invariant is checked in states its scope does not cover.** The "States /
Transitions" column is not decoration — it says where the invariant is in force. An
invariant scoped `Draft → submit` is a precondition of that submit, and checking it
in every state of the machine manufactures a violation in every state the scope
excludes. A scope of **All states** means every machine's states; a scope naming
states, state names, or transitions means those. A cell that names neither a state
nor a transition is a defect in the document, not a licence to guess.

The scope also decides HOW MANY TIMES an invariant is checked. An invariant scoped
**All states** holds wherever the aggregate is, so it is checked ONCE against the
aggregate — not once per machine, which multiplies every violation by the machine
count and reports several hundred checks over a few hundred states as several
hundred violations of several different rules. A state-scoped invariant is checked in
the states it names, on the machine those states belong to.

**4. A coupled machine is traversed in isolation, so its guards never come to hold.**
§16 says which machine's trigger moves which machine's state. A target machine whose
guard reads a term only a source machine's transition sets — "the customer's e-mail
is on file" — has a guard that can never be satisfied inside the target's own state
space, so the target reports one reachable state and an exhausted frontier. The
machines are dimensions of one aggregate, so the traversal runs once over the
aggregate and the coupling is expressed by the aggregate's own structure — not by
adding the source machine's transitions to the target's frontier, which makes the
coupling closure the whole document and the frontier stops closing. See *One
aggregate, one traversal*.

**The symptom is the same in all four, and it looks like health.** A tiny reachable
set with an exhausted frontier is what a guard that cannot hold, a `From` cell that
names no reachable state, an effect that writes a term nothing reads, and a
mis-ordered edit list all produce. So check the machine's reachable count against its
own state table before believing the frontier closed — and when the count is far
short of it, work down this list before adding anything new.

### A violation count is not a finding count

The canonical edit order bounds the exploration by editing one field per step, in the
document's order. That bound has a consequence the report must state: **the states it
reaches include the ones where the form is half filled.** An invariant whose subject
is a field the order has not reached yet — `customer type != ''` — therefore fails in
every one of those states, and its count is a property of the BOUND, not of the
specification.

So the report owes the reader a distinction it cannot skip: which violations survive
in a state where the exploration could have filled the field, and which exist only
because the bound stopped half way through the form. The diagnostic is the SCOPE — an
invariant scoped to the entry or the submit transition is about a completed form and
cannot be judged in a partial one — together with how far the bound reached.

Report it rather than leaving the reader to infer it. "Every reachable state violates
an invariant", with no note that the bound never finished filling the form, is a
confidently wrong result, and it buries the violations that are real: a reader cannot
tell a bound artifact from a genuine defect, and every number in the report inherits
the doubt.

### The inner loop must not re-derive what does not change between states

The traversal evaluates the same expression against the same vocabulary once per state
per invariant, and resolving an expression against a vocabulary of any size is a scan
of every term in it. Done per state, that dominates the run: a traversal that reached
5,000 states in 23 seconds reached them in 3 once the per-invariant work was done once
instead of once per state.

Cache the four things that do not change between states:

- the **tokens** of an expression, keyed by the expression text and the vocabulary it
  was tokenised against — give the vocabulary an identity, so one document's terms can
  never be served to another's expressions;
- whether an invariant is **checkable**, and why it is not — both resolve the
  expression against the whole vocabulary;
- an invariant's **scope**, resolved from the document once per invariant;
- an invariant's **conjuncts**, split once instead of per evaluation.

Each is a lookup keyed by the invariant's id, and each replaces a whole-document scan
per state. The rule generalises: in a traversal, anything a rule reads that the
DOCUMENT owns is constant across states, so compute it once and look it up.

**Give a failed run a stack trace.** When a traversal dies with a bare message —
"Object reference not set" — the cost of finding the cause is a rebuild with the
exception printed. Print the stack trace under an environment flag so the ordinary
run stays clean and the diagnostic run costs one variable set. A bare message sends
the reader looking at the wrong file: the clone that lost the vocabulary looks
identical to every clone that kept it, right up to the line that dereferences it.

**Report the frontier as exhausted or not.** A capped traversal must say so in its own
output; a reader who sees only a state count cannot tell a closed frontier from a
truncated one.

**A flag must be a boolean on the object that knows, never a word-match on a message.**
The traversal knows whether it exhausted the frontier; the trace only describes it in
prose. Deriving the flag from the prose — `frontierExhausted = trace.Any(t =>
t.Contains("exhausted"))` — is wrong twice over, because the message that says the
frontier is NOT exhausted still contains the word "exhausted". The flag is then always
true, the export claims the analysis was complete, and the page repeats that claim in
its header to the reader who is judging coverage. Expose the boolean, and write the
trace from it, never the other way round.

**Report what the model could NOT execute.** A transition whose guard or effect is
`not expressible`, or that names a term the document does not define, cannot be
evaluated — so it is reported as an executable gap, with the reason, and never silently
skipped. A transition that is skipped in silence is a rule that never fired, and the
report then reads "the model found no violation here" when it means "the model could not
look here". The gap list belongs in the export beside the counts.

```
STATES VISITED: 29242
  AwaitingApprovals (50)  -  552 reachable state(s), 384 with a violation
      !! INV-10  Every live application has a 'Waiting on' value
         detail:   stage AwaitingApprovals matches no Waiting-on value
         evidence: Sec. 11
         reached by: INITIAL | draft.submit [Sec. 6.1/6.2/6.3] | ir.send-for-approval [Sec. 8.1] | aa.approve-credit [Sec. 9]
```

**Invariant checks return the violation AND its evidence**, so the report reads without
cross-referencing back to the model.

### Four more engine bugs that surface as a crash or an invented state

These are engine bugs, not document defects, and each one is silent until it is not.

**A transition's `From` and `To` belong to machines that are not always the
transition's own.** The `From` cell names the states a transition may be taken at, and
the `To` cell the states it lands in — and both are states of whatever machine OWNS
them, which is not always the machine whose section the row sits in. Resolve the
owning machine per state id, and use it for two things: whether the action is legal
(the owner of the From state must be in that state) and where the state change lands
(the owner of the To state receives it). Assuming the row's own machine owns both
puts the aggregate into a state no document describes — "Send link" belongs to the
application machine and moves the customer-link machine's state to *Sent* — and every
later guard that reads it compares against the wrong thing. Carry the owning machine
alongside each From and To state id.

**A deep copy carries the document-derived context it was built with.** The clone the
traversal branches on must carry everything the original had — the vocabulary, the
state space — not just the data fields. A clone that drops the vocabulary looks
identical in every assertion about fields and then fails at the first expression it
is asked to evaluate, which points at the evaluator rather than at the copy. Give the
copy a stack trace on failure: the copy is not where the bug is, and the message says
so.

**Unwrap an expression's code fence before you take it apart.** The document writes an
expression in backticks and the cell keeps them. The evaluator unwraps a whole
expression, so it never sees them — but anything that SPLITS an expression (on `&&`,
to check conjuncts independently) leaves the fence inside a fragment, and the fragment
does not parse. Unwrap first, then split.

### Probe the claims, do not narrate them

Every finding that claims a reachable path is a **question the model can answer**. Encode
the claim as a predicate over the computed set and let the model reply:

```csharp
Probe(ex, "F-03",
    "Is an application reachable in Awaiting Licensing while an owner other than the default holds it?",
    r => r.Key.Stage == Stage.AwaitingLicensing && r.Key.Owner != null && r.Key.Owner != "Blanca"),
```

A probe that returns NOT REACHABLE invalidates the finding's reachability claim, and
that is the mechanism by which an overclaimed path gets caught. Probes also catch bugs in
your own model: a probe that contradicts a finding you were confident about is usually
pointing at a missing field in the key or a missing guard in the action.

**A narrated path that the model refuses is a wrong path.** When the spec's own guard
blocks the step — say an option is available only for divisions *still unmatched*, so a
division that already matched cannot take it — the finding must be rewritten or
downgraded to a spec gap. Do not defend a path the traversal has already refused.

### Export the computed result so the deliverable cannot drift

Have the harness **export its computed output as JSON** and have the interactive
explorer load that file, rather than hand-copying numbers into the HTML. Hand-copied
numbers silently go stale the moment the model changes, and the artifact then asserts
figures the model no longer produces.

**The export's output path must never be able to be the document it read.** Take the
input and the output as SEPARATE arguments, and refuse when they resolve to the same
file. A harness whose first argument serves both roles replaces the deliverable with
its own output on the first run — and a hand-built document with no copy and no
version control is gone, recoverable only by reconstruction from a session log.

**Read the output path by SCANNING the arguments, not by a fixed position.** A flag
between two positional arguments — `export <document> slim <output>` — moves the
output to the third argument, so a harness that reads it as the second silently writes
to its default path instead, and the run appears to succeed. Take the argument that is
neither the document nor a flag, and refuse when it resolves to the document. A
sibling argument order that quietly redirects the write is worse than no check at all,
because the file that should have been written is simply absent afterwards.

**So version-control the deliverable before the instrument runs against it.** The
document is hours of work and exists nowhere else; `git init` and one commit cost a
minute and turn an unrecoverable loss into a checkout. Do it before the first export,
not after the first mistake.

```csharp
case "export":
    return Export(args[1], args.Length > 2 && args[2] == "slim");
```

Give the export a `slim` mode that drops the per-state detail and keeps the aggregate
plus one worked example per invariant — the full dump can be hundreds of megabytes,
which is too large to embed in a page.

**The exported file is an intermediate, not the runtime dependency.** A viewer that
opens the HTML from disk cannot `fetch()` a sibling file, so the exporter's output has
to be embedded into the page as a JSON script block (see
`references/interactive-diagrams.md`). Make that a second, explicit step and say how
to redo both in one command — otherwise the file on disk and the copy inside the HTML
drift, and the page serves stale figures with no error to notice.

**The export carries a CATALOGUE of every id the document issues, with the name each
one carries.** A document that numbers its sources, entities, value objects,
aggregates, bounded contexts, commands, events, policies and scenarios gives the
reader a handle for each — and a handle is worth nothing until the reader can see
what it points at. So the export carries, for every series, the id, the name, and
enough of the record to render it. **A series the export omits is a series the page
can only show as a bare token** — `VO-004` sitting in a scope cell with nothing to
decode it into, which the reader cannot distinguish from an identifier the analysis
skipped. Cover every series the document issues, not the ones the page happens to
count.

## What the model can and cannot prove

State this plainly in the deliverable — it is the honest framing and it protects the
credibility of everything else:

- **Can prove** — a finding is reachable by a sequence of actions the spec permits, and it
  breaks a stated invariant or contradicts another stated rule.
- **Cannot prove** — anything about an implementation, because there is none here. The
  model is of the spec, not of the product.
- **Where the spec is silent**, the model shows the gap; it cannot show that the built
  system will fall into it.
- **Where two readings exist**, the model implements the one the spec's dominant
  construction supports, and the defect test asserts the other. Say so explicitly.

## Run the commands

**This skill ships the engine it describes.** The traversal, the expression language and
the export it all live in `model/Onboarding.Model` in this repository, and the page they
feed lives in `explorer/`. The paths below are one project's layout - this one - and the
commands are discoverable from the repository's README.

```bash
cd <model project>
dotnet run -- parse                                 # what the document contains
dotnet run -- check                                 # the gate: every expression resolves
dotnet run -- explore                               # reachable-state report
dotnet run -- export <path>/explorer-data.json slim   # the data the diagram reads
```

**Run `check` first, and treat its failure as a defect in the document.** It resolves every
expression against the document's own vocabulary. A failure means an expression names a
term the document does not define — the fix is to the document, not to the engine.

**The export command must be reproducible, and it must run against a FRESH build.** Two
ways it goes wrong, both silently:

- **`dotnet run --no-build` exports the previous binary.** The engine source changed, the
  build did not, and the export comes from the old code — so the artifact is rebuilt
  from stale data with no error anywhere. Build first, or drop the flag.
- **A parameter the numbers depend on is left to an environment variable the caller
  does not set.** A traversal cap read from `MODEL_MAX_STATES` with a default of
  200,000, and a page exported at 4,000, means the same command produces different
  numbers for the reader than the one in the repository. Set every parameter the
  artifact's numbers depend on in the command that builds it, and record the cap in
  the export so the page can show the bound it was produced under.

Then the build is one command, and running it twice changes nothing.

**Run `explore` and report the frontier.** Report the actual counts in the deliverable.
"14 defects reproduce mechanically" is a different claim from "14 defects were found", and
only the first is load-bearing. A traversal that stopped at its cap must say so; a reader
who sees only a state count cannot tell a closed frontier from a truncated one.

**Say what the model is.** The deliverable must state that the model is of the *spec*,
not of the product, and that it can prove a finding reachable but says nothing about an
implementation. A reader who cannot tell which is being modelled will read a
model-only claim as a product claim.

## Build order

**Transcribed model:**

1. States and IDs, transcribed.
2. The aggregate's fields.
3. The transition table as data (`Graph.cs`), including the stage each action is legal at.
4. Invariant checks.
5. Conformance tests — they will fail until the rules are right; that is the point.
6. Defect-reproduction tests.
7. The breadth-first traversal, plus the probes for each finding's reachability claim.
8. The export that emits the computed result for the diagram to consume.
9. Iterate until conformance is green, every defect test fails for its stated reason,
   every probe agrees with its finding, and the traversal exhausts its frontier.

**Document-driven model:**

1. The parser: machines, states, transitions, invariants, and the §3.5.2 vocabulary.
2. The expression evaluator, and the `check` gate that proves every expression resolves.
3. The aggregate: machine id → state id, plus the attribute bag — ONE aggregate, not
   one per machine.
4. The transition table as data, built from the parsed rows, each row carrying the
   machine that owns its From and To states.
5. Invariant checks driven by the document's own expressions, honouring each
   invariant's scope.
6. The key: every machine's state plus every term any rule names, all computed.
7. The breadth-first traversal over that one aggregate, plus the probes for each
   finding's reachability claim.
8. The export that emits the computed result for the diagram to consume.
9. Iterate until `check` passes, every probe agrees with its finding, and the traversal
   exhausts its frontier.
