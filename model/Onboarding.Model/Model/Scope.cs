namespace Onboarding.Model;

using System.Text.RegularExpressions;

/// <summary>
/// What an invariant's scope column says it applies to.
/// </summary>
public enum ScopeKind
{
    /// <summary>Every state of every machine the invariant binds to.</summary>
    AllStates,

    /// <summary>The named states.</summary>
    States,

    /// <summary>A precondition of the named transition.</summary>
    Transition,
}

/// <summary>
/// The scope of one invariant, resolved against the document.
///
/// The scope decides WHERE an invariant is checked. An invariant is not a
/// law of the whole aggregate by default - §15 says where it holds, and
/// checking it everywhere the machine bound it happens to be would assert
/// rules the document never made.
/// </summary>
public sealed record InvariantScope(
    ScopeKind Kind,
    string[] StateIds,
    string[] TransitionIds,
    string Raw)
{
    /// <summary>Does this invariant hold in the given state?</summary>
    public bool AppliesToState(string stateId) =>
        Kind == ScopeKind.AllStates ||
        (Kind == ScopeKind.States &&
         StateIds.Any(id => string.Equals(id, stateId, StringComparison.OrdinalIgnoreCase)));

    /// <summary>Is this invariant a precondition of the given transition?</summary>
    public bool AppliesToTransition(string transitionId) =>
        Kind == ScopeKind.Transition &&
        TransitionIds.Any(id => string.Equals(id, transitionId, StringComparison.OrdinalIgnoreCase));
}

/// <summary>
/// Reads an invariant's "States / Transitions" column.
///
/// The column mixes four kinds of reference, and the model has to tell them
/// apart because they mean different things:
///
///   "All states"              every state of every machine it binds to;
///   "ST-005"                  a state, named by its id;
///   "Draft, Returned to Sales" states, named by their §13 name;
///   "Draft → submit"          a TRANSITION - the invariant is a
///                              precondition of that transition, and is
///                              checked when the transition fires.
///
/// Nothing here is written by hand: the names are matched against §13 and
/// the triggers against §14, both as the document states them.
/// </summary>
public static class ScopeResolver
{

    /// <summary>
    /// The state ids a scope holds in, as a consumer reads them.
    ///
    /// A scope of "All states" means every state. The resolution says so
    /// by its KIND - but a consumer that LISTS the states needs the ids,
    /// so the list is written out here, once, and nobody downstream has
    /// to know what "all" means.
    ///
    /// The list is the states of the machine the scope was RESOLVED
    /// against - the one the engine resolved the cell in, and the one the
    /// rule is judged against. A rule that binds to several machines
    /// binds to them through one aggregate, and the aggregate's states
    /// are the ones of its own machine.
    /// </summary>
    public static string[] StateIdsHeldIn(SpecDocument doc, InvariantScope scope, string machine)
    {
        if (scope.Kind != ScopeKind.AllStates) return scope.StateIds;
        var ids = machine.Length > 0
            ? doc.StatesOf(machine)
            : doc.States.Select(s => s.Id);
        return ids.Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
    }

    private static readonly HashSet<string> StopWords = new(StringComparer.OrdinalIgnoreCase)
    {
        "all", "and", "or", "the", "a", "an", "of", "state", "states",
        "transition", "transitions", "stage", "stages", "to", "from", "in",
    };
}

/// <summary>
/// One piece of a scope: the words, or the name the scope names.
/// <para>
/// The scope is a kind and a list of ids, so the pieces are the ids — and
/// the words, when the scope names something that is not an id.
/// </para>
/// </summary>
public sealed record ScopePart(string Text, string Id, string Prefix);
