# The executable spec model

**This is an optional instrument, not a stage of the pipeline.** The deliverable is the
consolidated Markdown document. Reach for this file only when the reader asks for a
computed reachability result, or when the state space is too large to argue by hand —
and even then, build the model *after* the document, against the rules the document
already states.

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
    Model/Invariants.cs   checks driven by the document's invariant expressions
    Model/Explorer.cs     the breadth-first traversal over that table
    Model/Tests.cs        the two test kinds
    Program.cs            `parse` | `check` | `explore` | `export [file] [slim]` | `all`
```

**The engine holds no entity of any particular document.** No property named after a
spec's stage, link, credit check or person; no literal value; no hand-written key struct
per machine. The aggregate is a map from machine id to state id, the key is derived from
the document's own state and coupling tables, and the rules are the document's expression
columns.

**The guard column is prose; prose cannot be evaluated.** This is the single fact that
decides the mode. If the verifier's rules are prose in the document, they must be
hand-written in C#, and then they are that document's rules. The document therefore needs
an expression beside the prose — a guard condition and an effect for each transition, a
formal expression for each invariant, and a vocabulary the expressions draw on. The
processing prompt's §3.5 and §3.6 specify those columns and §3.1 declares the vocabulary;
the vocabulary is what lets a reader check that every expression names a term the
document defines.

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

**`not expressible` must be justified, or the coverage claim is hollow.** A condition
the document does not model as data — a person's role, an external system's answer, a
stored history — cannot be written over the vocabulary, and it is marked
`not expressible`. But a marking with no reason is indistinguishable from a marking
nobody got to. So every `not expressible` states **what would be needed to express it**:
the system, the field, or the role that would have to be modelled. The report then
distinguishes "the specification does not model this" from "the analysis did not reach
this" — and a document that marks half its invariants unexpressive without saying why
is not ready to be verified.

**A document that says "All states" means every machine.** When an invariant binds to no
particular machine, its "States / Transitions" column says "All states", and it is
checked against every machine's states. A cell that names neither a state nor a
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

**Report the frontier as exhausted or not.** A capped traversal must say so in its own
output; a reader who sees only a state count cannot tell a closed frontier from a
truncated one.

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

The paths below are one project's layout. Use whatever your project uses, and make the
commands discoverable from the model's own README.

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

1. The parser: machines, states, transitions, invariants, and the §3.1 vocabulary.
2. The expression evaluator, and the `check` gate that proves every expression resolves.
3. The aggregate: machine id → state id, plus the attribute bag.
4. The transition table as data, built from the parsed rows.
5. Invariant checks driven by the document's own expressions.
6. The key, derived from the document's state and coupling tables.
7. The breadth-first traversal, plus the probes for each finding's reachability claim.
8. The export that emits the computed result for the diagram to consume.
9. Iterate until `check` passes, every probe agrees with its finding, and the traversal
   exhausts its frontier.
