namespace Onboarding.Model;

/// <summary>
/// The aggregate: what the transitions mutate.
///
/// GENERIC BY CONSTRUCTION. The engine carries no specification's data and no
/// specification's entities. There is no field for a legal business name, a
/// DBA, a division code, a person's name — and, just as important, no field
/// for a STAGE, a LINK or a CREDIT CHECK. The document models seven machines
/// today and could model nine tomorrow; the aggregate does not know how many.
///
/// So the aggregate holds:
///   * MachineStates — machine id → state id, one entry per machine;
///   * Attributes   — name/value pairs, whose names come from the document's
///                     §3.1 expression vocabulary;
///   * Sets         — the set-valued terms, likewise.
///
/// The rules read both by name, so a rule bound to a transition of a different
/// specification reads that specification's terms. The vocabulary that says
/// which names are legal lives in the parsed document, not here.
/// </summary>
public sealed class Aggregate
{
    /// <summary>The document's state spaces, so an ST-### id means what it means here.</summary>
    public StateSpace States { get; }

    /// <summary>Machine id → the state id that machine is in.</summary>
    public Dictionary<string, string> MachineStates { get; } = new();

    /// <summary>Attributes of the aggregate, by name.</summary>
    public Dictionary<string, object?> Attributes { get; } = new();

    /// <summary>Set-valued terms: name → its elements.</summary>
    public Dictionary<string, HashSet<string>> Sets { get; } = new();

    /// <summary>The document's expression vocabulary, carried with the aggregate.</summary>
    public Expressions.Vocabulary? Vocabulary { get; init; }

    public Aggregate(StateSpace states) => States = states;

    // --------------------------------------------------------- machine states

    /// <summary>The state id a machine is in.</summary>
    public string MachineState(string machineId) =>
        MachineStates.TryGetValue(machineId, out var s) ? s : "";

    /// <summary>Put a machine into a state.</summary>
    public void SetMachineState(string machineId, string stateId) =>
        MachineStates[machineId] = stateId;

    // ------------------------------------------------------------- attributes

    public object? Get(string name) =>
        Attributes.TryGetValue(name, out var v) ? v : null;

    public string? GetString(string name) => Get(name) as string;

    public void Set(string name, object? value) => Attributes[name] = value;

    public bool Has(string name) => Attributes.ContainsKey(name);

    /// <summary>The elements of a set-valued term.</summary>
    public HashSet<string> GetSet(string name) =>
        Sets.TryGetValue(name, out var s) ? s : new HashSet<string>();

    /// <summary>Every attribute name the aggregate carries, sorted.</summary>
    public string[] AttributeNames() => Attributes.Keys.OrderBy(x => x).ToArray();

    // ------------------------------------------------------------------ clone

    /// <summary>
    /// Deep copy, so the traversal can branch on a state without mutating the
    /// state it branched from.
    /// </summary>
    public Aggregate Clone()
    {
        // The vocabulary travels with the copy. It is the document's own
        // vocabulary, and a clone that lost it would have no terms to
        // resolve an effect's condition against - the clone is what the
        // traversal branches on, so every branch would fail.
        var c = new Aggregate(States) { Vocabulary = Vocabulary };
        foreach (var kv in MachineStates) c.MachineStates[kv.Key] = kv.Value;
        foreach (var kv in Attributes) c.Attributes[kv.Key] = kv.Value;
        foreach (var kv in Sets)
        {
            var copy = new HashSet<string>();
            foreach (var element in kv.Value) copy.Add(element);
            c.Sets[kv.Key] = copy;
        }
        return c;
    }
}
