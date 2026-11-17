namespace Onboarding.Model;

/// <summary>
/// The verdict on one finding's reachability claim.
/// </summary>
/// <param name="Status">
/// REPRODUCED — a reachable state satisfies the finding's predicate, so the
/// defect the finding describes is reachable by a sequence of actions the
/// specification permits.
/// <para/>
/// NOT REPRODUCED — no reachable state satisfies it. The finding's claim is
/// not borne out by the model, and the report says so: a finding that
/// asserts a reachable path the model refuses is a finding about the model,
/// and it must be reported rather than quietly kept.
/// <para/>
/// NOT PROBED — the document gives no predicate for this finding, so the
/// model cannot judge it. A spec gap has nothing to reach.
/// </param>
public sealed record ProbeVerdict(
    string FindingId,
    string Title,
    string Kind,
    string Status,
    string Predicate,
    string Detail,
    int StatesMatching,
    List<string> ExamplePath);

/// <summary>
/// The probes: every finding's reachability claim, put to the model.
///
/// A finding that claims a defect is reachable is making a claim the model
/// can answer. The document carries the predicate — what must be true of the
/// aggregate in the state where the defect shows — and this asks the
/// computed reachable set whether such a state exists.
///
/// The predicate is the DOCUMENT's, not the engine's. A finding the
/// specification cannot express as a predicate over the vocabulary gets no
/// probe cell, and the report says "not probed" rather than guessing.
/// </summary>
public sealed class Probes
{
    private readonly SpecDocument _doc;
    private readonly Explorer _explorer;

    public Probes(SpecDocument doc, Explorer explorer)
    {
        _doc = doc;
        _explorer = explorer;
    }

    /// <summary>
    /// The verdict on every finding.
    /// </summary>
    public List<ProbeVerdict> Verdicts()
    {
        var verdicts = new List<ProbeVerdict>();

        foreach (var finding in _doc.Findings)
        {
            var predicate = finding.Probe?.Trim() ?? "";

            if (predicate.Length == 0 || predicate == "—")
            {
                verdicts.Add(new ProbeVerdict(
                    finding.Id, finding.Title, finding.Kind,
                    "NOT PROBED", "",
                    "the document states no predicate for this finding, so the model cannot judge it",
                    0, new List<string>()));
                continue;
            }

            // The predicate must resolve against the document's own
            // vocabulary. A predicate that names an undefined term is a
            // defect in the document, and it is reported as such rather
            // than evaluated as best it can be.
            var unresolved = Expressions.Resolve(predicate, _doc.Vocabulary);
            if (unresolved is not null)
            {
                verdicts.Add(new ProbeVerdict(
                    finding.Id, finding.Title, finding.Kind,
                    "NOT PROBED", predicate,
                    $"the predicate does not resolve: {unresolved.Reason}",
                    0, new List<string>()));
                continue;
            }

            var matching = 0;
            List<string>? example = null;

            foreach (var reached in _explorer.Reached)
            {
                var scope = new Expressions.Scope
                {
                    Aggregate = reached.State,
                    Machine = "",
                    Input = "",
                    Vocabulary = _doc.Vocabulary,
                };

                var value = Expressions.Evaluate(predicate, scope);
                if (value.Kind != Expressions.Kind.Boolean || !value.Bool) continue;

                matching++;
                if (example is null) example = reached.Path;
            }

            verdicts.Add(new ProbeVerdict(
                finding.Id, finding.Title, finding.Kind,
                matching > 0 ? "REPRODUCED" : "NOT REPRODUCED",
                predicate,
                matching > 0
                    ? $"{matching} reachable state(s) satisfy the predicate"
                    : "no reachable state satisfies the predicate",
                matching,
                example ?? new List<string>()));
        }

        return verdicts;
    }
}
