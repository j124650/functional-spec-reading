using System.Text.Json;

namespace Onboarding.Model;

/// <summary>
/// Reads the deliverable — the consolidated JSON file — into the model's
/// own records.
/// <para>
/// The document is JSON, so there is no table to find, no column to look up
/// by name, and no cell to interpret. Every record is an object with named
/// fields, and this reader takes them as they are.
/// </para>
/// <para>
/// The parser is System.Text.Json: <see cref="JsonDocument"/> reads the
/// file, and the records below are filled from named properties. Nothing
/// here recognises a value by its wording — the scope is a kind, the
/// "not expressible" marker is a kind, the invariants a state holds are
/// ids — because the document states each of them outright.
/// </para>
/// </summary>
public sealed class JsonDocumentReader
{
    private readonly SpecDocument _doc;

    public JsonDocumentReader(SpecDocument doc) => _doc = doc;

    /// <summary>Read the file's contents into the document.</summary>
    public static SpecDocument Load(string path)
    {
        var doc = new SpecDocument(path);
        using var json = JsonDocument.Parse(
            File.ReadAllText(path),
            new JsonDocumentOptions { AllowTrailingCommas = false, CommentHandling = JsonCommentHandling.Disallow });
        new JsonDocumentReader(doc).Read(json.RootElement);
        return doc;
    }

    private void Read(JsonElement root)
    {
        // The vocabulary first: an expression is checked against it, so it
        // must be in place before anything else is read.
        foreach (var v in Arr(root, "expressionVocabulary"))
        {
            var term = Str(v, "term");
            if (term.Length == 0) continue;
            var type = Str(v, "type").ToLowerInvariant();
            if (type is not ("flag" or "text" or "set" or "number")) continue;
            _doc.Vocabulary.Add(term, type, Str(v, "domain"));
        }

        foreach (var s in Arr(root, "sources"))
            _doc.Sources.Add(new SourceDef(
                Str(s, "id"), Str(s, "document"), Str(s, "version"),
                Join(StrArr(s, "sections")), Str(s, "authority")));

        foreach (var t in Arr(root, "glossary"))
            _doc.Terms.Add(new TermDef(
                Str(t, "id"), Str(t, "term"), Str(t, "definition"), Str(t, "context"),
                Evidence(t), Str(t, "status")));

        foreach (var c in Arr(root, "commands"))
            _doc.Commands.Add(new CommandDef(
                Str(c, "id"), Str(c, "name"), Str(c, "actor"),
                Join(StrArr(c, "preconditions")), Str(c, "effects"),
                Join(StrArr(c, "rejectionConditions")), Evidence(c)));

        foreach (var e in Arr(root, "domainEvents"))
            _doc.Events.Add(new EventDef(
                Str(e, "id"), Str(e, "name"), Str(e, "meaning"), Str(e, "trigger"),
                Join(StrArr(e, "affectedConcepts")), Str(e, "consequences"), Evidence(e)));

        foreach (var p in Arr(root, "policies"))
            _doc.Policies.Add(new PolicyDef(
                Str(p, "id"), Str(p, "name"), Str(p, "trigger"), Str(p, "condition"),
                Str(p, "action"), Str(p, "scope"), Evidence(p)));

        foreach (var e in Arr(root, "entities"))
            _doc.Entities.Add(new EntityDef(
                Str(e, "id"), Str(e, "name"), Str(e, "identity"), Str(e, "purpose"),
                Str(e, "lifecycle"), Join(StrArr(e, "relationships")), Evidence(e)));

        foreach (var v in Arr(root, "valueObjects"))
            _doc.ValueObjects.Add(new ValueObjectDef(
                Str(v, "id"), Str(v, "name"), Str(v, "meaning"),
                Join(StrArr(v, "attributes")), Join(StrArr(v, "constraints")),
                Join(StrArr(v, "validation")), Evidence(v)));

        foreach (var b in Arr(root, "boundedContexts"))
            _doc.BoundedContexts.Add(new BoundedContextDef(
                Str(b, "id"), Str(b, "name"), Str(b, "responsibility"),
                Str(b, "languageBoundary"), Evidence(b)));

        foreach (var r in Arr(root, "roles"))
            _doc.Roles.Add(new RoleDef(
                Str(r, "name"), Str(r, "mayDo"), Str(r, "instances"), Evidence(r)));

        foreach (var c in Arr(root, "contextMap"))
            _doc.Contexts.Add(new ContextDef(
                $"{Str(c, "upstream")} → {Str(c, "downstream")}", Str(c, "relationship"),
                EvidenceOf(c, "evidenceFor"), EvidenceOf(c, "evidenceAgainst"),
                Str(c, "whatWouldSettle")));

        foreach (var a in Arr(root, "aggregates"))
        {
            var aspects = new List<(string, string, string)>();
            foreach (var asp in Arr(a, "aspects"))
                aspects.Add((Str(asp, "label"), Str(asp, "content"), Evidence(asp)));
            _doc.Aggregates.Add(new AggregateDef(
                Str(a, "id"), Str(a, "name"), Str(a, "candidateRoot"),
                Str(a, "confidence"), Evidence(a), aspects));
        }

        foreach (var s in Arr(root, "scenarios"))
        {
            var parts = new List<(string, string)>();
            foreach (var part in Arr(s, "parts"))
                parts.Add((Str(part, "label"), Str(part, "text")));
            _doc.Scenarios.Add(new ScenarioDef(
                Str(s, "id"), Str(s, "name"), Evidence(s), parts));
        }

        foreach (var r in Arr(root, "roleRewrittenRules"))
            _doc.NamedRules.Add(new NamedRuleDef(
                Str(r, "id"), "", Str(r, "asWritten"), Str(r, "rewrittenAsRole"), Evidence(r)));

        foreach (var c in Arr(root, "domainConcepts"))
            _doc.DomainConcepts.Add(new DomainConceptDef(
                Str(c, "id"), Str(c, "name"), Str(c, "description"),
                Join(StrArr(c, "relationships")), Evidence(c)));

        foreach (var l in Arr(root, "sourceLocatorRegister"))
            _doc.SourceLocators.Add(new SourceLocatorDef(
                Str(l, "source"), Str(l, "locator"),
                Str(l, "where", "section"), Str(l, "where", "openingWords")));

        foreach (var m in Arr(root, "stateMachines"))
            _doc.Machines.Add(new MachineDef(
                Str(m, "id"), Str(m, "name"), Str(m, "modeledConcept"),
                Join(StrArr(m, "dimensions")), Str(m, "classification"),
                Str(m, "rationale"), Str(m, "initialState"),
                Join(StrArr(m, "terminalStates")), Str(m, "confidence"))
            {
                StateIds = StrArr(m, "stateIds"),
            });

        foreach (var s in Arr(root, "states"))
        {
            var ids = StrArr(s, "invariants");
            _doc.States.Add(new StateDef(
                Str(s, "id"), Str(s, "machine"), Str(s, "name"), "", Str(s, "category"),
                Join(ids), Str(s, "meaning"), Evidence(s))
            {
                InvariantIds = ids,
            });
        }

        foreach (var t in Arr(root, "transitions"))
        {
            var from = Str(t, "from");
            var to = Str(t, "to");
            var fromIds = from.Length > 0 ? new[] { from } : Array.Empty<string>();
            var toIds = to.Length > 0 ? new[] { to } : Array.Empty<string>();

            _doc.Transitions.Add(new TransitionDef(
                Str(t, "id"), Str(t, "machine"), from, to,
                fromIds, toIds, to.Length == 0,
                Str(t, "trigger"), Str(t, "guard", "text"), Join(StrArr(t, "actor")),
                Join(StrArr(t, "events")), Str(t, "rejection"), Evidence(t))
            {
                GuardExpression = ExpressionValue(t, "guard"),
                EffectExpression = EffectValue(t),
                FromStates = fromIds,
                ToAlternatives = ToAlternatives(t),
                EffectAlternatives = EffectAlternatives(t),
                NamedFrom = fromIds,
                NamedTo = toIds,
                FromIsInitial = from.Length == 0,
                CommandIds = StrArr(t, "commands"),
                GuardNotExpressible = KindOf(t, "guard") == "notExpressible",
                EffectNotExpressible = KindOf(t, "effect") == "notExpressible",
                GuardNotExpressibleReason = ReasonOf(t, "guard"),
                EffectNotExpressibleReason = ReasonOf(t, "effect"),
                Disposition = Str(t, "disposition"),
            });
        }

        foreach (var i in Arr(root, "invariants"))
        {
            var scopeKind = Str(i, "scope");
            var stateIds = StrArr(i, "states");
            var transitionIds = StrArr(i, "transitions");

            _doc.Invariants.Add(new InvariantDef(
                Str(i, "id"), Str(i, "statement"), Str(i, "category"), scopeKind,
                ScopeText(scopeKind, stateIds, transitionIds),
                Str(i, "enforcement"), Str(i, "violationConsequence"), Str(i, "register"), Evidence(i))
            {
                Expression = Str(i, "formalExpression"),
                ScopeKind = scopeKind switch
                {
                    "AllStates" => ScopeKind.AllStates,
                    "Transition" => ScopeKind.Transition,
                    _ => ScopeKind.States,
                },
                ScopeStateIds = stateIds,
                ScopeTransitionIds = transitionIds,
                Binding = StrArr(i, "binding"),
                NotExpressible = Str(i, "formalExpression").Length == 0,
                NotExpressibleReason = Str(i, "rationale"),
            });
        }

        foreach (var c in Arr(root, "crossMachineDependencies"))
            _doc.Couplings.Add(new CouplingDef(
                Str(c, "sourceMachine"), Str(c, "targetMachine"), Str(c, "trigger"),
                Str(c, "expectedEffect"), Str(c, "ordering"), Evidence(c)));

        foreach (var f in Arr(root, "issues"))
            _doc.Findings.Add(new FindingDef(
                Str(f, "id"), Str(f, "statement"), FindingKind(Str(f, "kind")),
                Join(StrArr(f, "conflictingEvidence")), Str(f, "impact"),
                Str(f, "proposedClarification"))
            {
                Probe = Str(f, "probe"),
                Severity = Str(f, "severity"),
            });

        foreach (var q in Arr(root, "questions"))
            _doc.Questions.Add(new QuestionDef(
                Str(q, "id"), Str(q, "question"), Str(q, "priority"),
                Bool(q, "blocksModeling") ? "Yes" : "No", Str(q, "related"))
            {
                BusinessImpact = Str(q, "businessImpact"),
                ArchitecturalImpact = Str(q, "architecturalImpact"),
            });

        BindInvariantsToMachines();
    }

    /// <summary>
    /// Bind each invariant to the machine whose states it constrains.
    ///
    /// The invariant names its scope as ids — state ids, or transition ids —
    /// and those identifiers belong to exactly one machine. So the scope
    /// answers "which machine owns this invariant" without any inference.
    /// </summary>
    private void BindInvariantsToMachines()
    {
        foreach (var inv in _doc.Invariants)
        {
            var bound = new SortedSet<string>(StringComparer.Ordinal);

            foreach (var id in inv.ScopeStateIds)
            {
                var st = _doc.States.FirstOrDefault(s => s.Id == id);
                if (st is not null) { bound.Add(st.Machine); break; }
            }
            foreach (var id in inv.ScopeTransitionIds)
            {
                var tr = _doc.Transitions.FirstOrDefault(t => t.Id == id);
                if (tr is not null) { bound.Add(tr.Machine); break; }
            }

            if (bound.Count == 0 && inv.ScopeKind == ScopeKind.AllStates)
                foreach (var m in _doc.Machines) bound.Add(m.Id);

            inv.Machine = bound.Count > 0 ? bound.First() : "";
            inv.Machines = bound.ToArray();
        }
    }

    // ------------------------------------------------------------- the fields

    /// <summary>
    /// The expression's value, when it is an expression.
    ///
    /// The expression is a TYPED value: `kind` says what it is, and only an
    /// `expression` carries text to evaluate. A `notExpressible` carries no
    /// text at all — it carries a reason — and an `alternatives` carries
    /// readings, not one value.
    /// </summary>
    private static string ExpressionValue(JsonElement transition, string field)
    {
        if (!transition.TryGetProperty(field, out var holder)) return "";
        if (holder.ValueKind != JsonValueKind.Object) return "";
        if (!holder.TryGetProperty("expression", out var expr)) return "";
        if (expr.ValueKind != JsonValueKind.Object) return "";
        if (Str(expr, "kind") != "expression") return "";
        return Str(expr, "value");
    }

    /// <summary>
    /// The EFFECT's value, when the effect is an expression.
    /// <para>
    /// The guard and the effect are shaped differently, and the difference is
    /// not cosmetic: the guard carries the document's WORDS beside the formal
    /// reading, so the reading is one level down, under `expression`. The
    /// effect has no words beside it — it IS the reading, so its `kind` and
    /// its `value` are the field itself.
    /// </para>
    /// </summary>
    private static string EffectValue(JsonElement transition)
    {
        if (!transition.TryGetProperty("effect", out var effect)) return "";
        if (effect.ValueKind != JsonValueKind.Object) return "";
        if (Str(effect, "kind") != "expression") return "";
        return Str(effect, "value");
    }

    /// <summary>The expression's kind, when the field carries one.</summary>
    private static string KindOf(JsonElement transition, string field)
    {
        if (field == "effect")
        {
            if (!transition.TryGetProperty("effect", out var e)) return "";
            if (e.ValueKind != JsonValueKind.Object) return "";
            return Str(e, "kind");
        }
        if (!transition.TryGetProperty(field, out var holder)) return "";
        if (holder.ValueKind != JsonValueKind.Object) return "";
        if (!holder.TryGetProperty("expression", out var expr)) return "";
        if (expr.ValueKind != JsonValueKind.Object) return "";
        return Str(expr, "kind");
    }

    /// <summary>The reason an expression gives for not being expressible.</summary>
    private static string ReasonOf(JsonElement transition, string field)
    {
        if (field == "effect")
        {
            if (!transition.TryGetProperty("effect", out var e)) return "";
            if (e.ValueKind != JsonValueKind.Object) return "";
            return Str(e, "reason");
        }
        if (!transition.TryGetProperty(field, out var holder)) return "";
        if (holder.ValueKind != JsonValueKind.Object) return "";
        if (!holder.TryGetProperty("expression", out var expr)) return "";
        if (expr.ValueKind != JsonValueKind.Object) return "";
        return Str(expr, "reason");
    }

    /// <summary>
    /// The alternative readings of the DESTINATION, when the source admits two.
    /// </summary>
    private static string[][] ToAlternatives(JsonElement transition)
    {
        if (!transition.TryGetProperty("toAlternatives", out var list)) return Array.Empty<string[]>();
        if (list.ValueKind != JsonValueKind.Array) return Array.Empty<string[]>();

        var readings = new List<string[]>();
        foreach (var r in list.EnumerateArray())
        {
            var ids = r.ValueKind == JsonValueKind.Array
                ? r.EnumerateArray().Select(x => x.GetString() ?? "").Where(x => x.Length > 0).ToArray()
                : Array.Empty<string>();
            if (ids.Length > 0) readings.Add(ids);
        }
        return readings.Count >= 2 ? readings.ToArray() : Array.Empty<string[]>();
    }

    /// <summary>The alternative readings of the EFFECT, when the source admits two.</summary>
    private static string[] EffectAlternatives(JsonElement transition)
    {
        if (!transition.TryGetProperty("effect", out var effect)) return Array.Empty<string>();
        if (effect.ValueKind != JsonValueKind.Object) return Array.Empty<string>();
        if (Str(effect, "kind") != "alternatives") return Array.Empty<string>();
        if (!effect.TryGetProperty("values", out var values)) return Array.Empty<string>();
        if (values.ValueKind != JsonValueKind.Array) return Array.Empty<string>();

        return values.EnumerateArray()
            .Select(v => Str(v, "value"))
            .Where(v => v.Length > 0)
            .ToArray();
    }


    /// <summary>
    /// The scope, in the words the model reads.
    ///
    /// The scope is a KIND plus the ids it names. The kind is what a
    /// consumer must know — a rule that holds everywhere is checked once,
    /// not once per state — and the ids say which.
    /// </summary>
    private static string ScopeText(string kind, string[] states, string[] transitions)
    {
        if (kind == "AllStates") return "All states";
        if (kind == "Transition") return Join(transitions);
        return Join(states);
    }

    /// <summary>A finding's kind, in the words the page has always shown.</summary>
    private static string FindingKind(string kind) => kind switch
    {
        "ConfirmedDefect" => "confirmed defect",
        "SpecGap" => "spec gap",
        _ => kind,
    };

    // ---------------------------------------------------------------- reading

    private static IEnumerable<JsonElement> Arr(JsonElement root, string name)
    {
        if (root.ValueKind != JsonValueKind.Object) return Array.Empty<JsonElement>();
        if (!root.TryGetProperty(name, out var v)) return Array.Empty<JsonElement>();
        if (v.ValueKind != JsonValueKind.Array) return Array.Empty<JsonElement>();
        return v.EnumerateArray();
    }

    private static string Str(JsonElement e, string name)
    {
        if (e.ValueKind != JsonValueKind.Object) return "";
        if (!e.TryGetProperty(name, out var v)) return "";
        return v.ValueKind == JsonValueKind.String ? (v.GetString() ?? "").Trim() : "";
    }

    /// <summary>
    /// A named field of an OBJECT field.
    ///
    /// The guard is an OBJECT — it carries the document's words in `text`
    /// and the formal reading in `expression` — so the words are read from
    /// inside it.
    /// </summary>
    private static string Str(JsonElement e, string name, string inner)
    {
        if (e.ValueKind != JsonValueKind.Object) return "";
        if (!e.TryGetProperty(name, out var v)) return "";
        if (v.ValueKind != JsonValueKind.Object) return "";
        return Str(v, inner);
    }

    private static bool Bool(JsonElement e, string name)
    {
        if (e.ValueKind != JsonValueKind.Object) return false;
        if (!e.TryGetProperty(name, out var v)) return false;
        return v.ValueKind == JsonValueKind.True;
    }

    private static string[] StrArr(JsonElement e, string name)
    {
        if (e.ValueKind != JsonValueKind.Object) return Array.Empty<string>();
        if (!e.TryGetProperty(name, out var v)) return Array.Empty<string>();
        if (v.ValueKind != JsonValueKind.Array) return Array.Empty<string>();
        return v.EnumerateArray()
            .Select(x => x.ValueKind == JsonValueKind.String ? (x.GetString() ?? "").Trim() : "")
            .Where(x => x.Length > 0)
            .ToArray();
    }

    /// <summary>
    /// The evidence of a record, as the words the reader sees.
    ///
    /// The document's evidence is an array of citation objects; the page
    /// reads them as the bracketed form it has always shown, so the reader
    /// sees the same thing the document says.
    /// </summary>
    private static string Evidence(JsonElement record)
    {
        if (record.ValueKind != JsonValueKind.Object) return "";
        if (!record.TryGetProperty("evidence", out var v)) return "";
        if (v.ValueKind != JsonValueKind.Array) return "";

        var parts = new List<string>();
        foreach (var c in v.EnumerateArray())
        {
            var source = Str(c, "source");
            var locator = Str(c, "locator");
            var quote = Str(c, "quote");
            if (source.Length == 0) continue;
            /* The citation is written the way the convention writes it: the
               document's id, then the section it names. The id is what tells
               a section of the source from a section of some other document
               — a bare section number could be resolved against either. */
            var text = locator.Length > 0 ? $"{source} {locator}" : source;
            if (quote.Length > 0) text += $" \"{quote}\"";
            parts.Add(text);
        }
        return string.Join(" ", parts);
    }

    /// <summary>The evidence of a NAMED evidence field, as the same words.</summary>
    private static string EvidenceOf(JsonElement record, string name)
    {
        if (record.ValueKind != JsonValueKind.Object) return "";
        if (!record.TryGetProperty(name, out var v)) return "";
        return Evidence(v);
    }

    private static string Join(string[] values) => string.Join(", ", values);
}
