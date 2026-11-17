namespace Onboarding.Model;

/// <summary>
/// The state identity of the AGGREGATE — derived from the document, not
/// written by hand.
///
/// The document models seven machines today and could model nine tomorrow,
/// so there is no struct per machine here. The key holds every value that
/// any rule can read:
///
///   * the state EVERY machine is in;
///   * the DATA terms the document's own guards and invariants name.
///
/// The first part is the subtle one. A field left out of the key makes two
/// genuinely different states collide, and the second is then never
/// explored — so the violation it would have revealed disappears without
/// any error. Which terms those are is not a judgement: it is computed
/// from the document's own expressions, by asking every guard, effect and
/// invariant which vocabulary terms it names.
///
/// Taking the Cartesian product of every machine's state would inflate the
/// space with combinations the document never says co-occur — the
/// explosion the skill warns against. This key does the opposite: it holds
/// exactly what the rules can read, and the rules decide that by naming
/// their terms.
/// </summary>
public static class MachineKeys
{
    /// <summary>
    /// The state identity of the aggregate.
    /// </summary>
    public readonly record struct Key(
        string MachineStates,
        string DataStates);

    /// <summary>
    /// The vocabulary terms any rule in the document reads.
    ///
    /// Computed from the document: the guard and effect expressions of
    /// every transition, and the formal expressions of every invariant.
    /// Nothing here is written by hand.
    ///
    /// The order is the DOCUMENT's order, not an alphabetical one: this list
    /// is also the canonical order in which the model's edits are explored,
    /// and the document groups the terms by what they are for.
    /// </summary>
    public static string[] ReadTerms(SpecDocument doc)
    {
        var terms = new List<string>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        void Collect(string expression)
        {
            if (string.IsNullOrWhiteSpace(expression)) return;
            var text = expression.Trim();
            if (text.Equals("not expressible", StringComparison.OrdinalIgnoreCase)) return;

            // A term may be several words ("legal business name"), so the
            // vocabulary's terms are matched as whole phrases.
            foreach (var term in doc.Vocabulary.Terms)
            {
                if (!Expressions.NamesTerm(text, term)) continue;
                if (seen.Add(term)) terms.Add(term);
            }
        }

        foreach (var t in doc.Transitions)
        {
            Collect(t.GuardExpression);
            Collect(t.EffectExpression);
        }
        foreach (var i in doc.Invariants)
            Collect(i.Expression);

        return terms.ToArray();
    }

    /// <summary>
    /// The key of the aggregate.
    ///
    /// The read-set is passed in rather than recomputed: it is the same for
    /// every state, and recomputing it per state would cost a scan of every
    /// expression in the document for every state reached.
    ///
    /// The terms are read in a FIXED order — the read-set's own order — so
    /// the key is built by appending, not by sorting, and every state pays
    /// for the same linear pass.
    /// </summary>
    public static Key Of(Aggregate a, SpecDocument doc, string[] readTerms)
    {
        var states = new System.Text.StringBuilder();
        foreach (var m in doc.Machines)
        {
            if (states.Length > 0) states.Append(',');
            states.Append(m.Id).Append('=').Append(a.MachineState(m.Id));
        }

        var data = new System.Text.StringBuilder();
        foreach (var term in readTerms)
        {
            if (data.Length > 0) data.Append(',');
            data.Append(term).Append('=').Append(ValueOf(a, term));
        }

        return new Key(states.ToString(), data.ToString());
    }

    /// <summary>
    /// A term's value as the key holds it.
    ///
    /// A FLAG that was never set and a flag that was set to false are the
    /// SAME value — the document's own type says a flag is either true or
    /// unset. If the key renders them differently, the two states never
    /// collide, so the traversal explores both, and a dozen flags turn into
    /// two to the power of a dozen states that differ in nothing. The key
    /// renders what the value IS, not whether it was written.
    /// </summary>
    private static string ValueOf(Aggregate a, string term)
    {
        if (a.Sets.TryGetValue(term, out var set))
            return string.Join("+", set.OrderBy(x => x, StringComparer.Ordinal));
        var value = a.Get(term);
        return value switch
        {
            null => a.Vocabulary?.TypeOf(term) == "flag" ? "no" : "",
            bool b => b ? "yes" : "no",
            _ => value.ToString() ?? "",
        };
    }

    /// <summary>A readable rendering of the aggregate's key.</summary>
    public static string Describe(Key key)
    {
        var parts = new List<string>();
        if (key.MachineStates.Length > 0) parts.Add(key.MachineStates);
        if (key.DataStates.Length > 0) parts.Add(key.DataStates);
        return string.Join(" | ", parts);
    }
}
