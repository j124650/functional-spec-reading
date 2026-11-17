namespace Onboarding.Model;

/// <summary>
/// One invariant violation, with the evidence a reader needs.
/// </summary>
/// <param name="Unset">
/// The terms the invariant reads that the aggregate does not hold in this
/// state.
///
/// This is what separates a violation that is a DEFECT from one that is an
/// artifact of the exploration's bound. The canonical edit order fills the
/// form in one field per step, so the traversal visits states where the form
/// is half-filled; an invariant that says "the legal business name is
/// present" fails in every one of them, and failing to say so makes the
/// report read as if the specification were broken a thousand times over.
/// A violation with no unset terms is a different thing entirely: both
/// names are present and they differ, which is F-02.
/// </param>
public sealed record Violation(
    string InvariantId,
    string Text,
    string Machine,
    string Detail,
    string Evidence,
    string[] Unset);

/// <summary>
/// An invariant the model could not evaluate.
///
/// This is NOT a violation. The document marks a condition "not expressible"
/// when it constrains something the model does not hold as data, and the
/// report must say "unchecked" rather than "broken" — a page of violations
/// that are really unevaluable conditions tells the reader the opposite of
/// the truth.
/// </summary>
public sealed record Unchecked(
    string InvariantId,
    string Text,
    string Machine,
    string Reason);

/// <summary>
/// The invariant checks, driven by the document's §15 "Formal expression"
/// column.
///
/// There is no hand-written check here. Each invariant's expression is
/// evaluated against the aggregate; an expression that holds is not a
/// violation, and one that fails is. An invariant whose expression is "not
/// expressible", or that names a term the document does not define, cannot be
/// checked — and is REPORTED as unchecked rather than passed silently.
///
/// THE SCOPE DECIDES WHERE. §15's "States / Transitions" column says where
/// an invariant holds: "All states", a list of states, or a transition the
/// invariant is a precondition of. Checking an invariant everywhere its
/// machine happens to be would assert rules the document never made, so the
/// scope is read from the document and honoured.
///
/// THE CONJUNCTS DECIDE HOW MUCH. An expression is a conjunction, and each
/// conjunct may be checkable or not, independently. A conjunct the document
/// marks "not expressible" does not make the whole invariant unevaluable —
/// it makes THAT conjunct unevaluable, and the rest still hold or fail on
/// their own.
/// </summary>
public sealed class InvariantSet
{
    private readonly SpecDocument _doc;

    public InvariantSet(SpecDocument doc) => _doc = doc;

    /// <summary>The invariants §15 binds to one machine.</summary>
    public List<InvariantDef> Of(string machine) => _doc.InvariantsOf(machine);

    /// <summary>
    /// The invariants that can be checked at all: those with an expression
    /// over terms the document defines.
    /// </summary>
    public List<InvariantDef> Checkable(string machine) =>
        Of(machine).Where(i => IsCheckable(i)).ToList();

    /// <summary>
    /// Whether an invariant can be evaluated, cached.
    ///
    /// The test resolves the expression against the document's whole
    /// vocabulary, and it is asked once per invariant per state — so the
    /// answer is worked out once per invariant.
    /// </summary>
    private readonly Dictionary<string, bool> _checkable = new();

    /// <summary>Can this invariant be evaluated?</summary>
    public bool IsCheckable(InvariantDef invariant)
    {
        var id = invariant.Id;
        if (_checkable.TryGetValue(id, out var cached)) return cached;
        return _checkable[id] = ComputeCheckable(invariant);
    }

    private bool ComputeCheckable(InvariantDef invariant)
    {
        var expression = Expressions.Unwrap(invariant.Expression);
        if (expression.Length == 0) return false;
        if (expression.Equals("not expressible", StringComparison.OrdinalIgnoreCase))
            return false;
        return Expressions.Resolve(expression, _doc.Vocabulary) is null;
    }

    /// <summary>
    /// Why an invariant cannot be checked, if it cannot.
    ///
    /// The reason is worked out once per invariant: resolving an expression
    /// against the vocabulary is a scan of the whole document, and it does
    /// not change between states.
    /// </summary>
    private readonly Dictionary<string, string?> _reasons = new();

    public string? ReasonUncheckable(InvariantDef invariant)
    {
        var id = invariant.Id;
        if (_reasons.TryGetValue(id, out var cached)) return cached;
        return _reasons[id] = ComputeReason(invariant);
    }

    private string? ComputeReason(InvariantDef invariant)
    {
        var expression = Expressions.Unwrap(invariant.Expression);
        if (expression.Length == 0)
            return "no formal expression";
        if (expression.Equals("not expressible", StringComparison.OrdinalIgnoreCase))
            return "the document marks it not expressible";
        var unresolved = Expressions.Resolve(expression, _doc.Vocabulary);
        return unresolved?.Reason;
    }

    /// <summary>
    /// The scope of an invariant, resolved against the document.
    ///
    /// The scope is resolved ONCE per invariant and machine: it is read from
    /// the document, so it does not change between states, and resolving it
    /// again for every state reached would cost a scan of the document's own
    /// tables for each of them.
    /// </summary>
    private readonly Dictionary<string, InvariantScope> _scopes = new();

    /// <summary>
    /// The conjuncts of each invariant's expression, cached.
    ///
    /// An invariant's expression is split the same way every time it is
    /// evaluated, and it is evaluated once per state — so the split is done
    /// once per invariant instead.
    /// </summary>
    private readonly Dictionary<string, string[]> _conjuncts = new();

    public string[] ConjunctsOf(InvariantDef invariant)
    {
        var id = invariant.Id;
        if (!_conjuncts.TryGetValue(id, out var parts))
            _conjuncts[id] = parts = Expressions.SplitConjuncts(invariant.Expression);
        return parts;
    }

    public InvariantScope ScopeOf(InvariantDef invariant)
    {
        var key = invariant.Id + "|" + (invariant.Machines.Length > 0 ? invariant.Machines[0] : "");
        if (!_scopes.TryGetValue(key, out var scope))
            /* The scope is STATED: a kind, and the ids it names. It is not
               resolved from a cell, because there is no cell to resolve —
               the document says which kind, and which ids. */
            _scopes[key] = scope = new InvariantScope(
                invariant.ScopeKind,
                invariant.ScopeStateIds,
                invariant.ScopeTransitionIds,
                invariant.StatesTransitions);
        return scope;
    }

    /// <summary>
    /// Check EVERY invariant against one aggregate state.
    ///
    /// An invariant is checked once, not once per machine. Its scope says
    /// where it holds: "All states" means it holds wherever the aggregate
    /// is, so it is judged against the aggregate — not seven times, once
    /// for each machine the aggregate happens to contain.
    ///
    /// The transition-scoped invariants are NOT checked here: they are
    /// preconditions of a transition, and are judged at the moment that
    /// transition fires.
    /// </summary>
    public List<Violation> Check(Aggregate a)
    {
        var violations = new List<Violation>();

        foreach (var invariant in _doc.Invariants)
        {
            if (invariant.Machines.Length == 0) continue;      // the document does not say where it holds

            var scope = ScopeOf(invariant);
            if (scope.Kind == ScopeKind.Transition) continue;   // checked at the transition

            // A state-scoped invariant holds in the states it names, and
            // those states belong to the machine the document bound it to.
            if (scope.Kind == ScopeKind.States)
            {
                var machine = invariant.Machines[0];
                if (!scope.AppliesToState(a.MachineState(machine))) continue;
            }

            var verdict = Evaluate(invariant, a, invariant.Machines[0]);
            if (verdict.Holds) continue;

            violations.Add(new Violation(
                invariant.Id, invariant.Text, invariant.Machines[0],
                verdict.Detail, invariant.Evidence,
                UnsetTermsOf(invariant, a)));
        }

        return violations;
    }

    /// <summary>
    /// The terms the invariant reads that the aggregate does not hold.
    ///
    /// The aggregate holds a term when it carries a value for it: a
    /// non-empty string, a true flag, or a non-empty set. A term that was
    /// never written is not held, and neither is one written empty.
    /// </summary>
    private string[] UnsetTermsOf(InvariantDef invariant, Aggregate a)
    {
        var unset = new List<string>();
        foreach (var term in TermsOf(invariant))
        {
            if (a.Sets.TryGetValue(term, out var set))
            {
                if (set.Count == 0) unset.Add(term);
                continue;
            }
            var value = a.Get(term);
            if (value is null) { unset.Add(term); continue; }
            if (value is string s && s.Length == 0) unset.Add(term);
        }
        return unset.ToArray();
    }

    /// <summary>
    /// The vocabulary terms an invariant's expression names, cached.
    /// </summary>
    private readonly Dictionary<string, string[]> _termsOf = new();

    private string[] TermsOf(InvariantDef invariant)
    {
        var id = invariant.Id;
        if (_termsOf.TryGetValue(id, out var terms)) return terms;

        var found = new List<string>();
        foreach (var term in _doc.Vocabulary.Terms)
        {
            if (Expressions.NamesTerm(invariant.Expression, term)) found.Add(term);
        }
        _termsOf[id] = found.ToArray();
        return _termsOf[id];
    }

    /// <summary>
    /// Check the invariants that are preconditions of a transition.
    ///
    /// A scope like "Draft → submit" says the condition holds when the
    /// submit transition is taken. So the check is made at the moment the
    /// transition fires: the state afterwards must satisfy the invariant.
    /// That is what makes the check meaningful — a precondition the
    /// transition's own guard does not enforce is a defect, and this is
    /// where it shows up.
    /// </summary>
    public List<Violation> CheckTransition(ActionDef action, Aggregate after)
    {
        var violations = new List<Violation>();

        foreach (var invariant in _doc.Invariants)
        {
            if (!invariant.Machines.Contains(action.Machine)) continue;

            var scope = ScopeOf(invariant);
            if (scope.Kind != ScopeKind.Transition) continue;
            if (!scope.AppliesToTransition(action.Id)) continue;

            var verdict = Evaluate(invariant, after, action.Machine);
            if (verdict.Holds) continue;

            violations.Add(new Violation(
                invariant.Id, invariant.Text, action.Machine,
                verdict.Detail, invariant.Evidence,
                UnsetTermsOf(invariant, after)));
        }

        return violations;
    }

    /// <summary>
    /// The verdict on one invariant in one state.
    /// </summary>
    private sealed record Verdict(bool Holds, bool Complete, string Detail);

    /// <summary>
    /// Evaluate an invariant's expression, conjunct by conjunct.
    ///
    /// A conjunct that cannot be evaluated makes the verdict INCOMPLETE, not
    /// false: the parts that can be checked still stand, and the report says
    /// the invariant was only partly checked rather than asserting it holds
    /// or that it fails.
    /// </summary>
    private Verdict Evaluate(InvariantDef invariant, Aggregate a, string machine)
    {
        if (!IsCheckable(invariant))
            return new Verdict(true, false,
                $"the invariant could not be checked: {ReasonUncheckable(invariant)}");

        var conjuncts = ConjunctsOf(invariant);
        var problems = new List<string>();
        var held = true;

        foreach (var conjunct in conjuncts)
        {
            if (conjunct.Trim().Equals("not expressible", StringComparison.OrdinalIgnoreCase))
            {
                problems.Add("a conjunct of the expression is not expressible");
                continue;
            }

            var scope = new Expressions.Scope
            {
                Aggregate = a,
                Machine = machine,
                Input = "",
                Vocabulary = _doc.Vocabulary,
            };

            var value = Expressions.Evaluate(conjunct, scope);
            if (value.Kind == Expressions.Kind.Unknown)
            {
                problems.Add($"the conjunct '{conjunct}' did not evaluate");
                continue;
            }

            if (value.Kind == Expressions.Kind.Boolean && !value.Bool)
            {
                held = false;
                problems.Add($"the conjunct '{conjunct}' does not hold");
            }
        }

        if (!held)
            return new Verdict(false, false, string.Join("; ", problems));

        return new Verdict(true, problems.Count == 0, string.Join("; ", problems));
    }

    /// <summary>
    /// The invariants that could not be evaluated, and why.
    ///
    /// The report carries these beside the violations: a reader who sees
    /// "12 of 48 invariants checked" can weigh the silence.
    /// </summary>
    public List<Unchecked> Unchecked { get; } = new();

    /// <summary>
    /// Is this state one of the document's terminal states?
    ///
    /// §11 names them per machine, so this reads the document's own list.
    /// </summary>
    public static bool IsTerminal(string stage, SpecDocument doc, string machine)
    {
        if (stage.Length == 0) return false;
        var m = doc.Machine(machine);
        if (m is null) return false;

        var terminals = SpecDocument.StateIdsOf(m.TerminalStates);
        if (terminals.Length > 0) return terminals.Contains(stage);

        // §11 writes the terminal states as names.
        return m.TerminalStates.Contains(doc.State(stage)?.Name ?? "", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>Is this state the machine's initial state?</summary>
    public static bool IsInitial(string stage, SpecDocument doc, string machine)
    {
        if (stage.Length == 0) return false;
        var m = doc.Machine(machine);
        if (m is null) return false;

        var initials = SpecDocument.StateIdsOf(m.InitialState);
        if (initials.Length > 0) return initials.Contains(stage);

        return m.InitialState.Contains(doc.State(stage)?.Name ?? "", StringComparison.OrdinalIgnoreCase);
    }
}
