namespace Onboarding.Model;

/// <summary>
/// The transition table, as DATA, built from the document's §14 rows.
///
/// There is no per-transition C# method anywhere in this project. A row in
/// §14 becomes an <see cref="ActionDef"/>: its From states, its guard
/// EXPRESSION (evaluated by <see cref="Expressions"/>), its effect EXPRESSION,
/// and its destination state ids. The engine's only rule layer is the
/// evaluator.
///
/// A row may carry two readings of one rule - two destinations in the "To"
/// cell, or two effects separated by ||. Each reading becomes its own action
/// in the same GROUP, so the explorer compares them and reports a divergence.
/// </summary>
public sealed record ActionDef(
    string Id,          // the document's TR-### id
    string Machine,     // the machine that owns the transition
    string Group,       // the action family, for the divergence check
    string Reading,     // which reading of the row this is
    string Section,     // the evidence reference
    string Trigger,     // the document's trigger text
    string GuardText,   // the document's guard text, in prose
    string[] From,      // the state ids the action is legal at
    string[] To,        // the destination state ids, per reading
    string GuardExpression,
    string EffectExpression,
    string Label,
    string[] FromMachines = null!,   // the machine each From state belongs to
    string[] ToMachines = null!)     // the machine each To state belongs to
{
    /// <summary>
    /// Is this action legal at the aggregate's current state?
    ///
    /// A transition names the states it may be taken at, and each of those
    /// states belongs to a machine - not necessarily the machine that owns
    /// the transition. "Send link" is SM-001's transition and it moves
    /// SM-002's state, so the machine that owns the From state is the one
    /// whose current state is tested.
    /// </summary>
    public bool AvailableIn(Aggregate a)
    {
        if (From.Length == 0) return true;
        for (int i = 0; i < From.Length; i++)
        {
            var owner = i < FromMachines.Length ? FromMachines[i] : Machine;
            if (a.MachineState(owner) == From[i]) return true;
        }
        return false;
    }

    /// <summary>Does the document's guard expression hold?</summary>
    public bool Guard(Aggregate a, Expressions.Vocabulary vocabulary, string input)
    {
        var scope = new Expressions.Scope
        {
            Aggregate = a,
            Machine = Machine,
            Input = input,
            Vocabulary = vocabulary,
        };
        var value = Expressions.Evaluate(GuardExpression, scope);
        // An unknown guard - "not expressible", or an unresolvable term - does
        // not permit the action. The transition is reported as an executable
        // gap, not silently allowed.
        return value.Kind == Expressions.Kind.Boolean && value.Bool;
    }

    /// <summary>
    /// Apply the document's effect expression.
    ///
    /// The state change goes to the machine that OWNS the destination state.
    /// A transition may move another machine's state - "Send link" is
    /// SM-001's transition and it moves SM-002's link to "Sent" - and
    /// writing that state onto the wrong machine would put the aggregate
    /// into a state no document describes.
    /// </summary>
    public void Apply(Aggregate a, string input)
    {
        Effects.Apply(EffectExpression, a, input);

        if (To.Length == 0) return;
        var owner = ToMachines.Length > 0 ? ToMachines[0] : Machine;
        a.SetMachineState(owner, To[0]);
    }
}

/// <summary>
/// The effect language: what a transition does to the aggregate's data.
///
/// The forms are the skill's §3.5.1: set / clear / add / remove, apply(input),
/// and a conditional "if … then …". A transition's state change is carried by
/// the destination column, not here.
///
/// THE INPUT. A command that carries a value delivers it as one
/// "field=value" pair. Every effect form reads that pair the same way:
/// `set('term', input)` takes the VALUE, `set(input, 'value')` takes the
/// FIELD NAME, `apply(input)` takes both. One pair, one meaning — so the
/// caller does not have to know which form the effect uses.
/// </summary>
public static class Effects
{
    /// <summary>The value a command carried: a field name and a value.</summary>
    public readonly record struct Input(string Field, string Value)
    {
        public static readonly Input None = new("", "");

        /// <summary>Parse a "field=value" pair.</summary>
        public static Input Parse(string text)
        {
            if (string.IsNullOrWhiteSpace(text)) return None;
            var at = text.IndexOf('=');
            if (at <= 0) return new Input("", text.Trim());
            return new Input(text[..at].Trim(), text[(at + 1)..].Trim());
        }
    }

    public static void Apply(string expression, Aggregate a, string input)
    {
        if (string.IsNullOrWhiteSpace(expression)) return;
        var text = expression.Trim();
        if (text.StartsWith('`') && text.EndsWith('`') && text.Length >= 2)
            text = text[1..^1].Trim();

        var carried = Input.Parse(input);

        foreach (var statement in SplitTop(text))
        {
            var statementText = statement.Trim();
            if (statementText.Length == 0) continue;

            // "if <expr> then <effect>"
            if (statementText.StartsWith("if ", StringComparison.OrdinalIgnoreCase))
            {
                var thenAt = IndexOfTop(statementText, " then ");
                if (thenAt < 0) continue;
                var condition = statementText[3..thenAt].Trim();
                var effect = statementText[(thenAt + 6)..].Trim();
                var scope = new Expressions.Scope
                {
                    Aggregate = a,
                    Machine = "",
                    Input = carried.Value,
                    Vocabulary = a.Vocabulary,
                };
                var value = Expressions.Evaluate(condition, scope);
                if (value.Kind == Expressions.Kind.Boolean && value.Bool)
                    Apply(effect, a, input);
                continue;
            }

            ApplyOne(statementText, a, carried);
        }
    }

    private static void ApplyOne(string statement, Aggregate a, Input carried)
    {
        // set('term', 'value') | set('term', true) | set('term', input)
        // set(input, 'value') - set the term the command named
        if (statement.StartsWith("set(", StringComparison.OrdinalIgnoreCase))
        {
            var args = Args(statement);
            if (args.Count < 2) return;

            if (string.Equals(args[0], "input", StringComparison.OrdinalIgnoreCase))
            {
                // The command names the term it acts on.
                if (carried.Field.Length == 0) return;
                if (a.Vocabulary is not null && !a.Vocabulary.Has(carried.Field)) return;
                SetValue(a, carried.Field, args[1], carried);
                return;
            }

            SetValue(a, args[0], args[1], carried);
            return;
        }

        // clear('term')
        if (statement.StartsWith("clear(", StringComparison.OrdinalIgnoreCase))
        {
            var args = Args(statement);
            if (args.Count >= 1)
            {
                a.Attributes.Remove(args[0]);
                a.Sets.Remove(args[0]);
            }
            return;
        }

        // add('term', 'value')
        if (statement.StartsWith("add(", StringComparison.OrdinalIgnoreCase))
        {
            var args = Args(statement);
            if (args.Count < 2) return;
            var value = string.Equals(args[1], "input", StringComparison.OrdinalIgnoreCase)
                ? carried.Value : args[1];
            if (!a.Sets.TryGetValue(args[0], out var set))
            {
                set = new HashSet<string>();
                a.Sets[args[0]] = set;
            }
            set.Add(value);
            return;
        }

        // remove('term', 'value')
        if (statement.StartsWith("remove(", StringComparison.OrdinalIgnoreCase))
        {
            var args = Args(statement);
            if (args.Count < 2) return;
            var value = string.Equals(args[1], "input", StringComparison.OrdinalIgnoreCase)
                ? carried.Value : args[1];
            if (a.Sets.TryGetValue(args[0], out var set)) set.Remove(value);
            return;
        }

        // apply(input) - write the edited field onto the aggregate
        if (statement.StartsWith("apply(", StringComparison.OrdinalIgnoreCase))
        {
            ApplyEdit(a, carried);
            return;
        }
    }

    /// <summary>Set a term, honouring the vocabulary's type.</summary>
    private static void SetValue(Aggregate a, string term, string value, Input carried)
    {
        if (string.Equals(value, "input", StringComparison.OrdinalIgnoreCase))
        {
            a.Set(term, carried.Value);
            return;
        }
        if (value is "true" or "false")
        {
            a.Set(term, value == "true");
            return;
        }
        var type = a.Vocabulary?.TypeOf(term) ?? "";
        if (type == "set")
        {
            if (!a.Sets.TryGetValue(term, out var set))
            {
                set = new HashSet<string>();
                a.Sets[term] = set;
            }
            set.Add(value);
            return;
        }
        a.Set(term, value);
    }

    /// <summary>
    /// Write the field the command carried onto the aggregate.
    ///
    /// The field name comes from the document's vocabulary, so an edit cannot
    /// write a field the document does not declare.
    /// </summary>
    private static void ApplyEdit(Aggregate a, Input carried)
    {
        if (carried.Field.Length == 0) return;
        if (a.Vocabulary is not null && !a.Vocabulary.Has(carried.Field)) return;
        SetValue(a, carried.Field, carried.Value, carried);
    }

    /// <summary>Split a statement list on ';' at the top level.</summary>
    private static IEnumerable<string> SplitTop(string text)
    {
        var parts = new List<string>();
        var current = new System.Text.StringBuilder();
        var depth = 0;
        var inString = false;
        foreach (var ch in text)
        {
            if (ch == '\'') { inString = !inString; current.Append(ch); continue; }
            if (!inString)
            {
                if (ch == '(') depth++;
                else if (ch == ')') depth--;
                else if (ch == ';' && depth == 0)
                {
                    parts.Add(current.ToString());
                    current.Clear();
                    continue;
                }
            }
            current.Append(ch);
        }
        parts.Add(current.ToString());
        return parts;
    }

    /// <summary>The index of a top-level needle.</summary>
    private static int IndexOfTop(string text, string needle)
    {
        var depth = 0;
        var inString = false;
        for (int i = 0; i < text.Length; i++)
        {
            var ch = text[i];
            if (ch == '\'') { inString = !inString; continue; }
            if (inString) continue;
            if (ch == '(') depth++;
            else if (ch == ')') depth--;
            else if (depth == 0 && i + needle.Length <= text.Length &&
                     string.CompareOrdinal(text, i, needle, 0, needle.Length) == 0)
                return i;
        }
        return -1;
    }

    /// <summary>The arguments of a call: set('a', 'b') -> ["a", "b"].</summary>
    private static List<string> Args(string call)
    {
        var open = call.IndexOf('(');
        var close = call.LastIndexOf(')');
        if (open < 0 || close <= open) return new List<string>();
        var inner = call[(open + 1)..close];
        var args = new List<string>();
        var current = new System.Text.StringBuilder();
        var inString = false;
        foreach (var ch in inner)
        {
            if (ch == '\'') { inString = !inString; continue; }
            if (ch == ',' && !inString) { args.Add(current.ToString().Trim()); current.Clear(); continue; }
            current.Append(ch);
        }
        args.Add(current.ToString().Trim());
        return args;
    }
}

/// <summary>
/// Builds the actions from the document's transition rows.
/// </summary>
public static class Actions
{
    /// <summary>
    /// Every action, from every parsed transition row.
    ///
    /// A row with two destination readings or two effect readings produces two
    /// actions in one group, so the explorer can compare them.
    /// </summary>
    public static List<ActionDef> Build(SpecDocument doc)
    {
        var actions = new List<ActionDef>();

        foreach (var t in doc.Transitions)
        {
            var hasTwoDestinations = t.ToAlternatives.Length >= 2;
            var hasTwoEffects = t.EffectAlternatives.Length >= 2;

            var readings = hasTwoDestinations ? t.ToAlternatives : new[] { t.ToIds };
            var effectReadings = hasTwoEffects ? t.EffectAlternatives : new[] { t.EffectExpression };

            int count = Math.Max(readings.Length, effectReadings.Length);
            for (int i = 0; i < count; i++)
            {
                var to = i < readings.Length ? readings[i] : readings[^1];
                var effect = i < effectReadings.Length ? effectReadings[i] : effectReadings[^1];
                var reading = count > 1 ? $"{t.Id}#{i + 1}" : t.Id;

                var fromMachines = t.FromStates
                    .Select(id => doc.State(id)?.Machine ?? t.Machine).ToArray();
                var toMachines = to
                    .Select(id => doc.State(id)?.Machine ?? t.Machine).ToArray();

                actions.Add(new ActionDef(
                    t.Id, t.Machine,
                    Group: t.Id,          // one group per transition: its readings
                    Reading: reading,
                    Section: t.Evidence,
                    Trigger: t.Trigger,
                    GuardText: t.Guard,
                    From: t.FromStates,
                    To: to,
                    GuardExpression: t.GuardExpression,
                    EffectExpression: effect,
                    Label: $"{t.Id} {t.Trigger}",
                    FromMachines: fromMachines,
                    ToMachines: toMachines));
            }
        }

        return actions;
    }

    /// <summary>
    /// The initial state: every machine at its initial state, per §11.
    ///
    /// The aggregate's DATA starts empty - an application that has just been
    /// created has no terms, no divisions and no credit application. §11's
    /// initial state is the machine's position, not a set of field values.
    /// </summary>
    public static Aggregate InitialState(SpecDocument doc)
    {
        var aggregate = new Aggregate(new StateSpace(doc)) { Vocabulary = doc.Vocabulary };
        foreach (var machine in doc.Machines)
        {
            var initial = SpecDocument.StateIdsOf(machine.InitialState);
            if (initial.Length > 0)
            {
                aggregate.SetMachineState(machine.Id, initial[0]);
                continue;
            }
            var first = doc.StatesOf(machine.Id).FirstOrDefault();
            if (first is not null) aggregate.SetMachineState(machine.Id, first);
        }
        return aggregate;
    }
}
