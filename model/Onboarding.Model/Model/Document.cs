using System.Text.RegularExpressions;

namespace Onboarding.Model;

/// <summary>
/// The deliverable document, parsed as the TREE it is - and as the only source
/// of the domain's concrete values AND of the domain's LOGIC.
///
/// The engine in this project is GENERIC: it contains no customer, no stage
/// name, no person's name, no division code, no attribute name, and no
/// machine id. Everything domain-specific comes out of the Markdown:
///
///   §3   the glossary        TERM-### rows carry the terms, their definitions
///                             and their STATUS - including "Undefined" and
///                             "Conflicting", which the model must not treat
///                             as settled.
///   §3.1 expression vocab   the terms an expression may name, with types.
///   §8   commands            CMD-### rows carry the ACTORS (the roles), the
///                             preconditions and the effects.
///   §11  machines            SM-### rows carry each machine's dimension,
///                             classification, initial and terminal states.
///   §12  machine blocks      one per SM-###: its dimensions, its states.
///   §13  states              one table per machine; each row's name carries
///                             the stage ID and its "Invariants in force"
///                             column binds the state to its invariants.
///   §14  transitions         one table per machine; each row's trigger,
///                             guard, actor and destination, and its evidence.
///                             THE LOGIC IS HERE: the "Guard (expression)" and
///                             "Effect (expression)" columns are evaluated
///                             by <see cref="Expressions"/>, not by C#.
///   §15  invariants          INV-### rows, bound to a machine by their
///                             "States / Transitions" column, each with a
///                             "Formal expression" the model evaluates.
///   §16  couplings           machine to machine, with the ordering column
///                             that says whether the coupling is synchronous.
///   §19  findings            F-### rows, each a confirmed defect or a spec gap.
///   §20  questions           Q-### rows.
///
/// The rule layer that remains in code is the EVALUATOR, not a rule book:
/// there is no per-transition C# method anywhere in this project.
/// </summary>
public sealed class SpecDocument
{
    public string Path { get; }
    public List<MachineDef> Machines { get; } = new();
    public List<StateDef> States { get; } = new();
    public List<TransitionDef> Transitions { get; } = new();
    public List<InvariantDef> Invariants { get; } = new();
    public List<FindingDef> Findings { get; } = new();
    public List<QuestionDef> Questions { get; } = new();
    public List<CouplingDef> Couplings { get; } = new();
    public List<TermDef> Terms { get; } = new();
    public List<CommandDef> Commands { get; } = new();
    public List<EventDef> Events { get; } = new();
    public List<PolicyDef> Policies { get; } = new();
    public List<EntityDef> Entities { get; } = new();
    public List<ValueObjectDef> ValueObjects { get; } = new();
    public List<RoleDef> Roles { get; } = new();
    public List<ContextDef> Contexts { get; } = new();

    /// <summary>The domain concepts the document names.</summary>
    public List<DomainConceptDef> DomainConcepts { get; } = new();

    /// <summary>The paragraph locators of the source documents.</summary>
    public List<SourceLocatorDef> SourceLocators { get; } = new();

    /// <summary>The source inventory: §2's SRC- ids.</summary>
    public List<SourceDef> Sources { get; } = new();

    /// <summary>The bounded contexts: the BC- ids the document issues.</summary>
    public List<BoundedContextDef> BoundedContexts { get; } = new();

    /// <summary>The aggregate candidates: the AGG- ids §7 issues.</summary>
    public List<AggregateDef> Aggregates { get; } = new();

    /// <summary>The scenario reconstructions: the SCN- ids §17 issues.</summary>
    public List<ScenarioDef> Scenarios { get; } = new();

    /// <summary>The person-named rules rewritten around roles: the N- ids.</summary>
    public List<NamedRuleDef> NamedRules { get; } = new();

    /// <summary>The expression vocabulary §3.1 declares.</summary>
    public Expressions.Vocabulary Vocabulary { get; } = new();

    /// <summary>Non-fatal problems found while parsing.</summary>
    public List<string> Warnings { get; } = new();

    public SpecDocument(string path) => Path = path;

    public static SpecDocument Load(string path)
    {
        /* The deliverable is ONE JSON file, and it is read with
           System.Text.Json. The Markdown parser is gone with it: a cell
           that says what it means is not a cell to be interpreted, and
           every inference it made — a scope resolved from prose, a range
           of invariants read as a list, a marker recognised by its
           wording — is a fact the JSON states outright. */
        if (!path.EndsWith(".json", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException(
                $"the deliverable is JSON: '{System.IO.Path.GetFileName(path)}' is not a .json file");

        return JsonDocumentReader.Load(path);
    }

    // ------------------------------------------------------------------ parse

    // --------------------------------------------------------------- helpers

    public static string[] StateIds(string cell)
    {
        var m = Regex.Matches(cell, @"\bST-\d{3}\b");
        return m.Select(x => x.Value).Distinct().ToArray();
    }

    // --------------------------------------------------------------- lookups

    public StateDef? State(string id) => States.FirstOrDefault(s => s.Id == id);
    public FindingDef? Finding(string id) => Findings.FirstOrDefault(f => f.Id == id);
    public InvariantDef? Invariant(string id) => Invariants.FirstOrDefault(i => i.Id == id);
    public TransitionDef? Transition(string id) => Transitions.FirstOrDefault(t => t.Id == id);
    public MachineDef? Machine(string id) => Machines.FirstOrDefault(m => m.Id == id);
    public TermDef? Term(string id) => Terms.FirstOrDefault(t => t.Id == id);

    /// <summary>The states of one machine, in the order the document lists them.</summary>
    public string[] StatesOf(string machine) =>
        States.Where(s => s.Machine == machine).Select(s => s.Id).ToArray();

    public string[] TransitionsOf(string machine) =>
        Transitions.Where(t => t.Machine == machine).Select(t => t.Id).ToArray();

    /// <summary>The invariants §15 binds to one machine.</summary>
    /// <summary>
    /// The invariants bound to one machine.
    ///
    /// The binding is the document's own: §15's "States / Transitions"
    /// column names the states the invariant holds in, and a cell that says
    /// "All states" binds the invariant to EVERY machine - that is what the
    /// document means by it, and a rule that holds "always" has to be
    /// checked everywhere it can be broken.
    /// </summary>
    public List<InvariantDef> InvariantsOf(string machine) =>
        Invariants.Where(i => i.Machines.Contains(machine)).ToList();

    /// <summary>The couplings §16 gives for one machine, as source or as target.</summary>
    public List<CouplingDef> CouplingsOf(string machine) =>
        Couplings.Where(c => MachineIds(c.SourceMachine).Contains(machine)
                           || MachineIds(c.TargetMachine).Contains(machine)).ToList();

    public static string[] MachineIds(string cell) =>
        Regex.Matches(cell, @"SM-\d{3}").Select(x => x.Value).Distinct().ToArray();

    /// <summary>The commands §8 assigns to an actor.</summary>
    public List<CommandDef> CommandsOf(string actor) =>
        Commands.Where(c => c.Actor.Contains(actor, StringComparison.OrdinalIgnoreCase)).ToList();

    /// <summary>
    /// A coupling is walkable as an edge only when §16 says it is SYNCHRONOUS.
    /// An asynchronous or order-sensitive coupling is not a step that may be
    /// collapsed into the same transition - it is recorded, and the two machines
    /// are traversed separately.
    /// </summary>
    public static bool IsSynchronous(CouplingDef c) =>
        c.Ordering.TrimStart('*', ' ').StartsWith("Synchronous", StringComparison.OrdinalIgnoreCase);

    /// <summary>The machine ids a cell names.</summary>
    public static string[] MachineIdsOf(string cell) => MachineIds(cell);

    /// <summary>The state ids a cell names.</summary>
    public static string[] StateIdsOf(string cell) =>
        Regex.Matches(cell, @"\bST-\d{3}\b").Select(x => x.Value).Distinct().ToArray();

    /// <summary>
    /// The division codes the document itself names.
    ///
    /// A division may only be added from this pool. The document names none,
    /// so the pool is empty and the add-division action is reported as
    /// unbound - the model does not invent an unbounded set of divisions to
    /// make its own traversal interesting.
    /// </summary>
    public string[] DivisionPool()
    {
        var codes = new SortedSet<string>(StringComparer.Ordinal);
        foreach (var t in Transitions)
        {
            foreach (Match m in Regex.Matches(t.FromRaw + " " + t.ToRaw + " " + t.Guard, @"\bDiv(?:ision)?[- ]?(\d+)\b"))
                codes.Add("Div-" + m.Groups[1].Value);
        }
        return codes.ToArray();
    }

    /// <summary>A finding's kind, normalised to "confirmed defect" or "spec gap".</summary>
    public static string KindOf(string kind)
    {
        var k = kind.Replace("*", "").Trim().ToLowerInvariant();
        if (k.StartsWith("confirmed defect")) return "confirmed defect";
        if (k.StartsWith("spec gap")) return "spec gap";
        return k;
    }

    /// <summary>
    /// A value the document states, found by asking the glossary for it.
    ///
    /// The engine must not carry domain literals, so every concrete value the
    /// rules need - the default owner, the terms reasons, the discount types -
    /// is READ from the document, by term id. A term the document marks
    /// "Undefined" or "Conflicting" is not a value the model may rely on, and
    /// the caller is told so.
    /// </summary>
    public string? ValueOf(string termId, out bool settled)
    {
        var t = Term(termId);
        if (t is null) { settled = false; return null; }
        settled = t.Status.StartsWith("Defined", StringComparison.OrdinalIgnoreCase)
               && !t.Status.Contains("partial", StringComparison.OrdinalIgnoreCase);
        return t.Definition;
    }
}

// ---------------------------------------------------------------- records

public sealed record TermDef(
    string Id, string Term, string Definition, string Context, string Evidence, string Status);

/// <summary>A source the specification is built from (§2).</summary>
public sealed record SourceDef(
    string Id, string Document, string Version, string Sections, string Authority);

/// <summary>A bounded context (§6).</summary>
public sealed record BoundedContextDef(
    string Id, string Name, string Owns, string Description, string Evidence);

/// <summary>An aggregate candidate (§7).</summary>
public sealed record AggregateDef(
    string Id, string Name, string Root, string Confidence, string Evidence,
    IReadOnlyList<(string Aspect, string Content, string Evidence)> Aspects);

/// <summary>A business scenario reconstruction (§17).</summary>
public sealed record ScenarioDef(
    string Id, string Title, string Evidence,
    IReadOnlyList<(string Label, string Text)> Parts);

/// <summary>A rule the document states about a person, rewritten around a role (§4.2).</summary>
public sealed record NamedRuleDef(
    string Id, string Role, string Rule, string Rewritten, string Evidence);

public sealed record CommandDef(
    string Id, string Command, string Actor, string Preconditions, string Effects,
    string Rejection, string Evidence);

public sealed record MachineDef(
    string Id, string Name, string Concept, string Dimensions, string Classification,
    string ClassificationReason, string InitialState, string TerminalStates,
    string Confidence)
{
    /// <summary>The states the machine owns, by id.</summary>
    public string[] StateIds { get; init; } = Array.Empty<string>();
}

public sealed record StateDef(
    string Id, string Machine, string Name, string StageIds, string Kind,
    string Invariants, string Meaning, string Source)
{
    /// <summary>The invariants in force in this state, by id.</summary>
    public string[] InvariantIds { get; init; } = Array.Empty<string>();
}

public sealed record TransitionDef(
    string Id, string Machine, string FromRaw, string ToRaw,
    string[] FromIds, string[] ToIds, bool ToUnstated,
    string Trigger, string Guard, string Actor, string Events,
    string Rejection, string Evidence)
{
    /// <summary>§14's "Guard (expression)": the guard as the document states it.</summary>
    public string GuardExpression { get; init; } = "";

    /// <summary>§14's "Effect (expression)": what the transition does to the data.</summary>
    public string EffectExpression { get; init; } = "";

    /// <summary>The machine's state ids this transition may fire from.</summary>
    public string[] FromStates { get; init; } = Array.Empty<string>();

    /// <summary>The alternative readings of the destination, when the cell names two.</summary>
    public string[][] ToAlternatives { get; init; } = Array.Empty<string[]>();

    /// <summary>The alternative readings of the effect, when the cell carries two.</summary>
    public string[] EffectAlternatives { get; init; } = Array.Empty<string>();

    /// <summary>
    /// The states the From cell names, resolved. A cell may name several
    /// ("ST-001 Draft, ST-002, ST-003, ST-004, ST-005"), and the transition
    /// may fire from any of them.
    /// </summary>
    public string[] NamedFrom { get; init; } = Array.Empty<string>();

    /// <summary>The states the To cell names, resolved.</summary>
    public string[] NamedTo { get; init; } = Array.Empty<string>();

    /// <summary>Whether the From cell marks the start of the flow.</summary>
    public bool FromIsInitial { get; init; }

    /// <summary>The commands the trigger names, by id.</summary>
    public string[] CommandIds { get; init; } = Array.Empty<string>();

    /// <summary>Whether the guard is a condition the aggregate cannot answer.</summary>
    public bool GuardNotExpressible { get; init; }

    /// <summary>Why the guard is not expressible.</summary>
    public string GuardNotExpressibleReason { get; init; } = "";

    /// <summary>Whether the effect is one the aggregate cannot carry out.</summary>
    public bool EffectNotExpressible { get; init; }

    /// <summary>Why the effect is not expressible.</summary>
    public string EffectNotExpressibleReason { get; init; } = "";

    /// <summary>What the transition is: allowed, forbidden, unspecified, ambiguous, candidate.</summary>
    public string Disposition { get; init; } = "ALLOWED";
}

public sealed record InvariantDef(
    string Id, string Text, string Category, string Scope, string StatesTransitions,
    string Responsibility, string Consequence, string Register, string Evidence)
{
    /// <summary>The machine §15's "States / Transitions" column binds this to.</summary>
    public string Machine { get; set; } = "";

    /// <summary>Every machine the invariant is in force for, per §15.</summary>
    public string[] Machines { get; set; } = Array.Empty<string>();

    /// <summary>§15's "Formal expression": the invariant as a predicate.</summary>
    public string Expression { get; init; } = "";

    /// <summary>Where the rule holds: everywhere, in named states, or on a transition.</summary>
    public ScopeKind ScopeKind { get; init; } = ScopeKind.AllStates;

    /// <summary>The states the rule holds in, when its scope names states.</summary>
    public string[] ScopeStateIds { get; init; } = Array.Empty<string>();

    /// <summary>The transitions the rule guards, when its scope names one.</summary>
    public string[] ScopeTransitionIds { get; init; } = Array.Empty<string>();

    /// <summary>The aggregate, context or machine the rule binds to.</summary>
    public string[] Binding { get; init; } = Array.Empty<string>();

    /// <summary>Whether the rule cannot be written as an expression over the vocabulary.</summary>
    public bool NotExpressible { get; init; }

    /// <summary>Why the rule cannot be written as an expression.</summary>
    public string NotExpressibleReason { get; init; } = "";
}

public sealed record CouplingDef(
    string SourceMachine, string TargetMachine, string Trigger,
    string Effect, string Ordering, string Evidence);

public sealed record FindingDef(
    string Id, string Title, string Kind, string Evidence, string Impact, string Clarification)
{
    /// <summary>
    /// The finding's reachability claim, as a predicate over the aggregate.
    ///
    /// A finding that says a defect is reachable is making a claim the model
    /// can answer. The predicate says what must be true of the aggregate in
    /// the state where the defect shows, and the probe asks the model whether
    /// such a state is reachable at all.
    ///
    /// A finding with no probe is one the model cannot judge — a spec gap,
    /// where the specification is silent and there is nothing to reach. The
    /// probe cell says so with an em dash.
    /// </summary>
    public string Probe { get; init; } = "";

    /// <summary>How serious the finding is.</summary>
    public string Severity { get; init; } = "";
}

public sealed record QuestionDef(
    string Id, string Question, string Priority, string Blocks, string RelatedFindings)
{
    /// <summary>What the question costs the business.</summary>
    public string BusinessImpact { get; init; } = "";

    /// <summary>What the question costs the architecture.</summary>
    public string ArchitecturalImpact { get; init; } = "";
}

/// <summary>A domain event — §9.</summary>
public sealed record EventDef(
    string Id, string Name, string Meaning, string Trigger, string Affects,
    string Consequences, string Evidence);

/// <summary>A domain policy or process — §10.</summary>
public sealed record PolicyDef(
    string Id, string Name, string Trigger, string Condition, string Action,
    string Scope, string Evidence);

/// <summary>An entity — §5.1.</summary>
public sealed record EntityDef(
    string Id, string Name, string Identity, string Purpose, string Lifecycle,
    string Relationships, string Evidence);

/// <summary>A value object — §5.2.</summary>
public sealed record ValueObjectDef(
    string Id, string Name, string Meaning, string Attributes, string Constraints,
    string Equality, string Evidence);

/// <summary>A domain concept — the nouns the business reasons about.</summary>
public sealed record DomainConceptDef(
    string Id, string Name, string Description, string Relationships, string Evidence);

/// <summary>A paragraph locator of a source document.</summary>
public sealed record SourceLocatorDef(
    string Source, string Locator, string Section, string OpeningWords);

/// <summary>A role — §4.2.</summary>
public sealed record RoleDef(
    string Name, string MayDo, string Instances, string Source);

/// <summary>A bounded-context relationship — §6.1.</summary>
public sealed record ContextDef(
    string Pair, string Relationship, string EvidenceFor, string EvidenceAgainst,
    string WhatWouldSettle);
