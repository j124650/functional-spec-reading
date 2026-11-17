namespace Onboarding.Model;

using System.Text.RegularExpressions;

/// <summary>
/// Reachability explorer over ONE aggregate.
///
/// The document models seven machines today and could model nine tomorrow,
/// so the explorer has no knowledge of any of them. What it does have is
/// the aggregate: a map from machine id to the state that machine is in,
/// plus the data the document's vocabulary names. Every transition is a
/// step on that one aggregate, whichever machine owns it, and the states
/// the machines are coupled in (§16) are simply other dimensions of the
/// same aggregate.
///
/// ONE TRAVERSAL, NOT SEVEN. The machines are not independent: §16 says a
/// submit raises the approval items, a licensing result moves the stage,
/// and a send-link moves the customer's link. Traversing each machine on
/// its own therefore starves them — the link machine's guard needs an
/// e-mail address that only the application machine's edit sets, so the
/// link machine looks like it has one state when the document plainly says
/// otherwise. One aggregate, one frontier, one set of reachable states.
///
/// THE KEY. A state is identified by everything a rule can read: every
/// machine's state, and the data terms the document's own guards and
/// invariants name. A field left out of the key makes two genuinely
/// different states collide, and the second is then never explored — so
/// the violation it would have revealed disappears without any error.
/// Which terms those are is not a judgement: they are read out of the
/// document's own expressions.
///
/// BRANCHING ON INPUT. A transition's effect may consume the value its
/// command carried ("the customer types this"), so the explorer does not
/// know what the input is. It therefore branches: for each action, it
/// tries the values the document's vocabulary says are possible. That
/// keeps the branching bounded and derived from the document, rather than
/// a list of example values typed into C#.
/// </summary>
public sealed class Explorer
{
    /// <summary>One reached state of the aggregate.</summary>
    public sealed record ReachedState(
        object Key, Aggregate State, List<Violation> Violations, List<string> Path);

    /// <summary>
    /// One action group reaching two different states from the SAME source
    /// state under two readings of the spec. That is a contradiction.
    /// </summary>
    public sealed record Divergence(string Group, string ReadingA, string ReadingB,
                                    string SourcePath, object KeyA, object KeyB);

    /// <summary>
    /// A transition the model cannot execute: its guard or effect names a
    /// term the document does not define, or the document marks it not
    /// expressible. Reported, never silently allowed.
    /// </summary>
    public sealed record Gap(string TransitionId, string Machine, string Reason, string Detail);

    private readonly Dictionary<object, Aggregate> _states = new();
    private readonly Dictionary<object, List<string>> _paths = new();
    private readonly Queue<object> _frontier = new();
    private readonly List<ReachedState> _reached = new();
    private readonly List<Divergence> _divergences = new();
    private readonly List<Gap> _gaps = new();
    private readonly List<string> _trace = new();
    private readonly int _maxStates;
    private readonly List<ActionDef> _actions;
    private readonly InvariantSet _invariants;
    private readonly SpecDocument _doc;
    private readonly string[] _readTerms;

    public Explorer(List<ActionDef> actions, InvariantSet invariants, StateSpace states,
                    SpecDocument doc, int maxStates = 200000)
    {
        _actions = actions;
        _invariants = invariants;
        _space = states;
        _doc = doc;
        _maxStates = maxStates;
        _readTerms = MachineKeys.ReadTerms(doc);
    }

    private readonly StateSpace _space;

    public IEnumerable<ReachedState> Reached => _reached;
    public IEnumerable<Divergence> Divergences => _divergences;
    public IEnumerable<Gap> Gaps => _gaps;
    public IReadOnlyList<string> Trace => _trace;
    public int Visited => _states.Count;

    /// <summary>
    /// The bound the exploration ran under: the largest number of states it
    /// would enumerate. A count reached under a bound is a property of the
    /// BOUND, not of the specification, so the page shows the bound beside
    /// the count.
    /// </summary>
    public int MaxStates => _maxStates;

    /// <summary>
    /// Whether the exploration enumerated EVERY reachable state.
    ///
    /// False when the traversal stopped at the cap. That is not a defect and
    /// not a claim about the specification: it says the model looked in N
    /// places and not more. A page that reports "the frontier was exhausted"
    /// when it was not tells the reader the analysis was complete when it
    /// was truncated, which is the worst thing an instrument can do.
    /// </summary>
    public bool FrontierExhausted { get; private set; } = true;

    /// <summary>
    /// The invariants that could not be evaluated, and why.
    ///
    /// These are NOT violations. The document marks a condition "not
    /// expressible" when it constrains something the model does not hold as
    /// data, and the report says so — a reader who sees "12 of 48 invariants
    /// checked" can weigh the silence.
    /// </summary>
    public List<Unchecked> Unchecked { get; } = new();

    /// <summary>
    /// The states reached, grouped by the machine that owns the state the
    /// application is in.
    ///
    /// The aggregate is one object, but a reader asks about a machine: how
    /// many of the reachable states has the application in, and in how many
    /// of them does one of that machine's own rules break. So the report
    /// groups by the machine whose state the aggregate is in.
    /// </summary>
    public IEnumerable<ReachedState> ReachedIn(string machine) =>
        _reached.Where(r => r.State.MachineState(machine).Length > 0);

    /// <summary>
    /// The reached states, grouped by the state each machine is in.
    ///
    /// This is the shape a reader wants: not "how many states are there"
    /// but "how many reachable states have the application in Draft, and in
    /// how many of those does a rule break".
    /// </summary>
    public IEnumerable<(string Machine, string State, List<ReachedState> States)> ByMachineState()
    {
        foreach (var machine in _doc.Machines)
        {
            foreach (var state in _doc.StatesOf(machine.Id))
            {
                var inState = _reached.Where(r => r.State.MachineState(machine.Id) == state).ToList();
                if (inState.Count == 0) continue;
                yield return (machine.Id, state, inState);
            }
        }
    }

    /// <summary>Traverse the aggregate.</summary>
    public void Explore()
    {
        ReportGaps();

        var initial = Actions.InitialState(_doc);
        var key = MachineKeys.Of(initial, _doc, _readTerms);
        _states[key] = initial.Clone();
        _paths[key] = new List<string> { "INITIAL: the aggregate as the document defines it" };
        _frontier.Enqueue(key);
        _reached.Add(new ReachedState(key, initial.Clone(),
            ViolationsOf(initial, null), _paths[key]));

        var exhausted = true;

        while (_frontier.Count > 0 && _states.Count < _maxStates)
        {
            var current = _frontier.Dequeue();
            var app = _states[current];
            var path = _paths[current];

            // Outcomes of each action GROUP from this source state, per
            // reading. Two readings of one group landing on different
            // states = contradiction. Outcomes are a list, not a map: a
            // group may hold several actions of the SAME reading, and a
            // map would silently overwrite them.
            var outcomes = new Dictionary<string, List<(string Reading, object Key)>>();

            foreach (var action in _actions)
            {
                if (!action.AvailableIn(app)) continue;
                foreach (var input in InputsFor(action, app))
                {
                    // The guard reads the command's input as well as the
                    // aggregate: a create carries the value it sets, so
                    // the guard tests what the command brought.
                    if (!action.Guard(app, _doc.Vocabulary, input)) continue;

                    var next = app.Clone();
                    action.Apply(next, input);
                    var nextKey = MachineKeys.Of(next, _doc, _readTerms);

                    if (!outcomes.TryGetValue(action.Group, out var byReading))
                        outcomes[action.Group] = byReading = new List<(string, object)>();
                    byReading.Add((action.Reading, nextKey));

                    if (_states.ContainsKey(nextKey)) continue;
                    if (_states.Count >= _maxStates) { exhausted = false; break; }

                    _states[nextKey] = next;
                    _paths[nextKey] = new List<string>(path)
                    {
                        $"{action.Id} [{action.Section}]" + (input.Length > 0 ? $" (input: {input})" : "")
                    };
                    _frontier.Enqueue(nextKey);
                    _reached.Add(new ReachedState(nextKey, next,
                        ViolationsOf(next, action), _paths[nextKey]));
                }
            }

            // Contradiction check, per source state: two DIFFERENT readings
            // of one action group, landing on different states.
            foreach (var (group, outcomesForGroup) in outcomes)
            {
                var distinct = outcomesForGroup.DistinctBy(o => o.Reading + "|" + o.Key).ToList();
                if (distinct.Count < 2) continue;
                for (var i = 0; i < distinct.Count; i++)
                for (var j = i + 1; j < distinct.Count; j++)
                {
                    if (distinct[i].Reading == distinct[j].Reading) continue;
                    if (distinct[i].Key.Equals(distinct[j].Key)) continue;
                    _divergences.Add(new Divergence(
                        group, distinct[i].Reading, distinct[j].Reading,
                        string.Join(" -> ", path), distinct[i].Key, distinct[j].Key));
                }
            }
        }

        FrontierExhausted = exhausted;

        _trace.Add(exhausted
            ? "the frontier was exhausted: every state reachable in the aggregate was enumerated"
            : $"explorer stopped at the {_maxStates}-state cap: the frontier is not exhausted");
    }

    /// <summary>
    /// The violations a state carries.
    ///
    /// Two kinds of invariant bear on a state: those whose scope names the
    /// state, and those whose scope names the transition that was just
    /// taken — "Draft → submit" is a precondition of submit, so it is
    /// judged at the moment submit fires. Both are the document's own rules.
    /// </summary>
    private List<Violation> ViolationsOf(Aggregate next, ActionDef? action)
    {
        var violations = _invariants.Check(next);
        if (action is not null)
            violations.AddRange(_invariants.CheckTransition(action, next));

        // An invariant the model could not evaluate is reported as
        // UNCHECKED, once per invariant - not once per state, which would
        // bury the list in thousands of identical lines.
        foreach (var invariant in _doc.Invariants)
        {
            if (_invariants.IsCheckable(invariant)) continue;

            var id = invariant.Id;
            if (!_reportedUnchecked.Add(id)) continue;

            Unchecked.Add(new Unchecked(
                id, invariant.Text,
                invariant.Machines.Length > 0 ? invariant.Machines[0] : "",
                _invariants.ReasonUncheckable(invariant) ?? "the expression did not evaluate"));
        }

        return violations;
    }

    private readonly HashSet<string> _reportedUnchecked = new();

    /// <summary>
    /// Report the transitions the model cannot execute.
    ///
    /// A guard or effect that names a term the document does not define, or
    /// that the document marks "not expressible", cannot be evaluated. The
    /// transition is reported as a gap rather than quietly skipped, so the
    /// coverage claim stays honest.
    /// </summary>
    private void ReportGaps()
    {
        foreach (var action in _actions)
        {
            foreach (var (expression, what) in new[]
            {
                (action.GuardExpression, "guard"),
                (action.EffectExpression, "effect"),
            })
            {
                if (string.IsNullOrWhiteSpace(expression)) continue;
                if (expression.Trim().Equals("not expressible", StringComparison.OrdinalIgnoreCase))
                {
                    _gaps.Add(new Gap(action.Id, action.Machine,
                        $"the document marks the {what} not expressible",
                        $"{action.GuardText} — {action.Section}"));
                    continue;
                }
                var unresolved = Expressions.Resolve(expression, _doc.Vocabulary);
                if (unresolved is not null)
                    _gaps.Add(new Gap(action.Id, action.Machine,
                        $"the {what} names a term the document does not define", unresolved.Reason));
            }
        }
    }

    /// <summary>
    /// The inputs a transition's effect may consume.
    ///
    /// An effect that reads `input` needs a value. The candidates come from
    /// the document: the values its vocabulary declares for the term, or the
    /// terms themselves where a command names which thing it acts on.
    ///
    /// WHERE THE DOCUMENT LEAVES A DOMAIN OPEN, the term has no declared
    /// values — the model does not invent domain data to make its own
    /// traversal interesting. It uses the term's own name as the placeholder
    /// value, which is a VALUE, not a new fact.
    ///
    /// THE CANONICAL ORDER. If every field may be edited in every combination,
    /// the frontier is exponential and never closes. So the fields are
    /// edited in the order the document's vocabulary lists them, one at a
    /// time: a field already set is not edited again, and the edit offered
    /// next is always the first unset one. The reachable set is then finite,
    /// and every RULE still gets to fire. This is a bound on the
    /// exploration, not a claim that the order does not matter.
    /// </summary>
    private IEnumerable<string> InputsFor(ActionDef action, Aggregate current)
    {
        var effect = action.EffectExpression;
        if (effect.Length == 0) return new[] { "" };
        if (!effect.Contains("input", StringComparison.OrdinalIgnoreCase)) return new[] { "" };

        var inputs = new List<string>();

        // set('term', input): the value for that term.
        foreach (Match m in Regex.Matches(effect, @"set\('([^']+)',\s*input\)"))
        {
            var term = m.Groups[1].Value;
            foreach (var value in ValuesOf(term)) inputs.Add($"{term}={value}");
        }

        // set(input, 'value'): the command names the term it acts on. The
        // candidates are the terms the vocabulary declares as set-valued —
        // the things a command may name.
        if (effect.Contains("set(input", StringComparison.OrdinalIgnoreCase))
        {
            foreach (var term in _doc.Vocabulary.Terms.Where(_doc.Vocabulary.IsSet))
                inputs.Add(term);
        }

        // apply(input): the command carries the edited field. Only the FIRST
        // unset field is offered, so the edit order is canonical — and only
        // a field the KEY READS is offered, because an edit to a field the
        // key does not read leaves the key unchanged, and the successor
        // would collide with the state it came from.
        if (effect.Contains("apply(input", StringComparison.OrdinalIgnoreCase))
        {
            var readable = new HashSet<string>(_readTerms, StringComparer.OrdinalIgnoreCase);
            foreach (var term in _doc.Vocabulary.Terms)
            {
                if (!readable.Contains(term)) continue;
                if (IsSet(current, term)) continue;
                foreach (var value in ValuesOf(term)) inputs.Add($"{term}={value}");
                break;      // the canonical order: one field per step
            }
        }

        if (inputs.Count == 0) return new[] { "" };
        return inputs.Distinct();
    }

    /// <summary>Does the aggregate already hold a value for this term?</summary>
    private static bool IsSet(Aggregate a, string term)
    {
        if (a.Sets.TryGetValue(term, out var set) && set.Count > 0) return true;
        var value = a.Get(term);
        return value switch
        {
            null => false,
            bool b => b,
            string s => s.Length > 0,
            _ => true,
        };
    }

    /// <summary>
    /// The values a term may take, per the document's vocabulary.
    ///
    /// A term whose domain the document declares has exactly those values. A
    /// term whose domain the document leaves open has one placeholder — the
    /// term's own name — so the model can set it without inventing a fact
    /// about the domain.
    ///
    /// A FLAG takes one value. The document's type says a flag is true or
    /// unset, so "false" is not a second value of the flag — it is the
    /// flag's absence, which the aggregate already represents. Offering it
    /// would double the branch count of every flag for nothing.
    /// </summary>
    private IEnumerable<string> ValuesOf(string term)
    {
        var domain = _doc.Vocabulary.DomainOf(term);
        if (domain.Length > 0) return domain;

        var type = _doc.Vocabulary.TypeOf(term);
        if (type == "flag") return new[] { "true" };
        return new[] { term };
    }
}
