namespace Onboarding.Model;

/// <summary>
/// The domain's states, as the document defines them.
///
/// There is no hard-coded enum here: the state values of the document's
/// machines are read from §13 and §14, and a state is identified by the
/// document's own ST-### identifier. An engine that cannot be pointed at
/// another specification cannot carry another specification's stage names or
/// stage IDs - so it carries none.
/// </summary>
public sealed class StateSpace
{
    /// <summary>Every state the document defines, by its ST-### id.</summary>
    public Dictionary<string, StateDef> ById { get; } = new();

    /// <summary>The states of one machine, in document order.</summary>
    public Dictionary<string, List<string>> ByMachine { get; } = new();

    /// <summary>The stage IDs §13 records for the SM-001 states, where stated.</summary>
    public Dictionary<string, string> StageIds { get; } = new();

    public StateSpace(SpecDocument doc)
    {
        foreach (var s in doc.States)
        {
            ById[s.Id] = s;
            if (!ByMachine.TryGetValue(s.Machine, out var list))
                ByMachine[s.Machine] = list = new();
            list.Add(s.Id);
            if (s.StageIds.Length > 0) StageIds[s.Id] = s.StageIds;
        }
    }

    public bool Has(string id) => ById.ContainsKey(id);

    /// <summary>The state a transition's "To" cell names, by ST-### id.</summary>
    public string? DestinationOf(TransitionDef tr) =>
        tr.ToIds.Length > 0 && ById.ContainsKey(tr.ToIds[0]) ? tr.ToIds[0] : null;

    /// <summary>The document's name for a state.</summary>
    public string NameOf(string id) => ById.TryGetValue(id, out var s) ? s.Name : id;

    /// <summary>The machine a state belongs to.</summary>
    public string MachineOf(string id) => ById.TryGetValue(id, out var s) ? s.Machine : "";

    /// <summary>The document's stage ID for a state, where §13 states one.</summary>
    public string StageIdOf(string id) => StageIds.TryGetValue(id, out var v) ? v : "";
}

