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

**Split the model across files with `partial`.** `Application` spans the state fields and
the transition methods; `public sealed partial class Application` in both files.

**The traversal needs deep-copy.** To branch, each successor is applied to a *clone* of
the current state, so exploring one branch never mutates the state another branch came
from. A model that mutates in place can only walk one path.

**Transcribe, don't paraphrase.** Every enum member carries the spec's ID and its source
section in a comment:

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

## Keep the transition table as data

Model the rules as **data** (a table the explorer walks) and have the methods apply
them. Then the explorer and the tests read the same table, and a rule you add in one place
shows up in both. The `ActionDef` shape below is the one to use — it carries the stage
each action is legal at, which the explorer needs and a flat transition record lacks.

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
spec authorises it), the **stages it is available at**, a **guard**, and an **effect**:

```csharp
public sealed record ActionDef(
    string Id, string Group, string Reading, string Section, string Label,
    Stage[] From, Func<Application, bool> Guard, Action<Application> Apply,
    string? Note = null, bool Enabled = true);
```

`From` is what makes an action legal: the spec's stage table says who may act in each
stage, so an action offered outside its stages is not permitted. Without it the graph
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

## Run all three

The paths below are one project's layout. Use whatever your project uses, and make the
three commands discoverable from the model's own README.

```bash
cd <model project>
dotnet run -- tests                              # conformance green, defect reproductions confirmed
dotnet run -- explore                            # reachable-state report
dotnet run -- export <path>/explorer-data.json slim   # the data the diagram reads
```

Report the actual counts in the deliverable. "14 defects reproduce mechanically" is a
different claim from "14 defects were found", and only the first is load-bearing.

**Say what the model is.** The deliverable must state that the model is of the *spec*,
not of the product, and that it can prove a finding reachable but says nothing about an
implementation. A reader who cannot tell which is being modelled will read a
model-only claim as a product claim.

## Build order

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
