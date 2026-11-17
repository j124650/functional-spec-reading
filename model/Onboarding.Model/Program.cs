namespace Onboarding.Model;

/// <summary>
/// The verifier's commands.
///
///   parse    what the document contains, and whether it is self-consistent
///   check    the build gate: every expression resolves to a term the
///            document defines, every referenced id exists
///   explore  the reachable-state report
///   export   the computed result as JSON, for the HTML explorer
///
/// The document is the only input. The engine holds no specification's data,
/// no attribute name and no machine id.
/// </summary>
public static class Program
{
    public static int Main(string[] args)
    {
        var mode = args.Length > 0 ? args[0] : "explore";

        try
        {
            return mode switch
            {
                "parse" => Parse(CommandPath(args)),
                "check" => Check(CommandPath(args)),
                "explore" => Explore(CommandPath(args)),
                "export" => Export(CommandPath(args), OutputPath(args), args.Contains("slim")),
                "all" => All(CommandPath(args)),
                _ => Unknown(mode),
            };
        }
        catch (Exception e)
        {
            Console.Error.WriteLine($"ERROR: {e.Message}");
            if (Environment.GetEnvironmentVariable("MODEL_TRACE") == "1")
                Console.Error.WriteLine(e.StackTrace);
            return 2;
        }
    }

    private static int Unknown(string mode)
    {
        Console.Error.WriteLine($"unknown mode '{mode}'. use: parse | check | explore | export [file] [slim] | all");
        return 2;
    }

    /// <summary>
    /// The state cap for a traversal.
    ///
    /// The state space is finite but large, and a run that cannot finish
    /// tells the reader nothing. The cap bounds the work; the report says
    /// whether the frontier closed, so a capped run is never mistaken for a
    /// complete one.
    /// </summary>
    private static int MaxStates()
    {
        var raw = Environment.GetEnvironmentVariable("MODEL_MAX_STATES");
        if (string.IsNullOrWhiteSpace(raw)) return 200_000;
        return int.TryParse(raw, out var n) && n > 0 ? n : 200_000;
    }

    /// <summary>
    /// Find the document: the file given on the command line, else the nearest
    /// one found by walking up from the working directory.
    /// </summary>
    private static string CommandPath(string[] args)
    {
        if (args.Length > 1 && File.Exists(args[1])) return args[1];

        var dir = new DirectoryInfo(Directory.GetCurrentDirectory());
        while (dir is not null)
        {
            foreach (var name in new[] { "domain-model-and-state-machines.json", "domain-model.json", "model.json" })
            {
                var candidate = Path.Combine(dir.FullName, name);
                if (File.Exists(candidate)) return candidate;
            }
            dir = dir.Parent;
        }

        throw new FileNotFoundException(
            "no document found: pass its path, or run from a directory under one");
    }

    /// <summary>
    /// Where the export is written.
    ///
    /// The OUTPUT path must never be the document: writing the export over
    /// the document destroys the deliverable, and nothing else holds it. So
    /// the output is the third argument, and it is refused when it resolves
    /// to the document.
    /// </summary>
    private static string OutputPath(string[] args)
    {
        var path = args.Length > 3 && args[3].Length > 0
            ? args[3]
            : Path.Combine(Directory.GetCurrentDirectory(), "explorer-data.json");

        var document = Path.GetFullPath(CommandPath(args));
        var output = Path.GetFullPath(path);
        if (string.Equals(document, output, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException(
                $"refusing to write the export over the document ({output}). "
                + "Give the output a different path.");

        return path;
    }

    /// <summary>
    /// The terms a transition's effect WRITES.
    /// <para>
    /// An effect says what a transition leaves behind: `set('clock started',
    /// true)`, `add('open requirements', input)`, `remove('divisions', x)`,
    /// `clear('approved requirements')`. The term is a string literal in the
    /// expression, so it is read from there — the engine parses the effect
    /// when it fires, and this is the same shape.
    /// </para>
    /// </summary>
    private static IEnumerable<string> TermsWritten(string effect)
    {
        if (string.IsNullOrEmpty(effect)) yield break;
        foreach (System.Text.RegularExpressions.Match m in
                 System.Text.RegularExpressions.Regex.Matches(
                     effect, @"\b(?:set|add|remove|clear)\s*\(\s*'([^']+)'"))
            yield return m.Groups[1].Value;
    }

    // ------------------------------------------------------------------ parse

    private static int Parse(string path)
    {
        var doc = SpecDocument.Load(path);
        Console.WriteLine($"document: {path}");
        Console.WriteLine();
        Console.WriteLine($"  machines    {doc.Machines.Count}");
        Console.WriteLine($"  states      {doc.States.Count}");
        Console.WriteLine($"  transitions {doc.Transitions.Count}");
        Console.WriteLine($"  invariants  {doc.Invariants.Count}");
        Console.WriteLine($"  findings    {doc.Findings.Count}");
        Console.WriteLine($"  questions   {doc.Questions.Count}");
        Console.WriteLine($"  couplings   {doc.Couplings.Count}");
        Console.WriteLine($"  glossary    {doc.Terms.Count} terms");
        Console.WriteLine($"  vocabulary  {doc.Vocabulary.Terms.Count()} expression terms");

        var withGuard = doc.Transitions.Count(t => t.GuardExpression.Length > 0);
        var withEffect = doc.Transitions.Count(t => t.EffectExpression.Length > 0);
        var withExpr = doc.Invariants.Count(i => i.Expression.Length > 0);
        Console.WriteLine();
        Console.WriteLine($"  transitions with a guard expression   {withGuard} / {doc.Transitions.Count}");
        Console.WriteLine($"  transitions with an effect expression  {withEffect} / {doc.Transitions.Count}");
        Console.WriteLine($"  invariants with a formal expression    {withExpr} / {doc.Invariants.Count}");

        if (doc.Warnings.Count > 0)
        {
            Console.WriteLine();
            Console.WriteLine($"  {doc.Warnings.Count} warning(s):");
            foreach (var w in doc.Warnings.Take(20)) Console.WriteLine($"    - {w}");
        }
        return 0;
    }

    // ------------------------------------------------------------------ check

    /// <summary>
    /// The build gate.
    ///
    /// Every expression the document states must resolve against the
    /// document's own vocabulary, and every identifier it references must
    /// exist. A document that fails this gate is not ready to be verified,
    /// and the engine must not quietly proceed on it.
    /// </summary>
    private static int Check(string path)
    {
        var doc = SpecDocument.Load(path);
        var problems = new List<string>();

        // 1. Every expression resolves.
        foreach (var t in doc.Transitions)
        {
            var typeProblem = Expressions.TypeProblem(t.GuardExpression, doc.Vocabulary);
            if (typeProblem is not null)
                problems.Add($"{t.Id}: guard — {typeProblem}");
            var unresolved = Expressions.Resolve(t.GuardExpression, doc.Vocabulary);
            if (unresolved is not null)
                problems.Add($"{t.Id}: guard — {unresolved.Reason}");
        }
        foreach (var t in doc.Transitions)
        {
            if (t.EffectExpression.Length == 0) continue;
            var unresolved = Expressions.Resolve(t.EffectExpression, doc.Vocabulary);
            if (unresolved is not null)
                problems.Add($"{t.Id}: effect — {unresolved.Reason}");
        }
        foreach (var i in doc.Invariants)
        {
            if (i.Expression.Length == 0) continue;
            var unresolved = Expressions.Resolve(i.Expression, doc.Vocabulary);
            if (unresolved is not null)
                problems.Add($"{i.Id}: invariant — {unresolved.Reason}");

            // A type problem is a defect in the document: `count` and
            // `contains` are set operations, and no verifier can invent the
            // reading that would make them work on a text term.
            var typeProblem = Expressions.TypeProblem(i.Expression, doc.Vocabulary);
            if (typeProblem is not null)
                problems.Add($"{i.Id}: invariant — {typeProblem}");
        }

        // 1b. Every finding's reachability predicate resolves.
        foreach (var f in doc.Findings)
        {
            var predicate = f.Probe?.Trim() ?? "";
            if (predicate.Length == 0 || predicate == "—") continue;
            var unresolved = Expressions.Resolve(predicate, doc.Vocabulary);
            if (unresolved is not null)
                problems.Add($"{f.Id}: reachability probe — {unresolved.Reason}");
            var typeProblem = Expressions.TypeProblem(predicate, doc.Vocabulary);
            if (typeProblem is not null)
                problems.Add($"{f.Id}: reachability probe — {typeProblem}");
        }

        // 1c. A guard that reads a collection no transition ever fills is a
        // PERMANENT FALSE. The guard can never hold, and every state behind
        // it is unreachable however well the transition table reads. What a
        // transition adds and what it removes are effects; an effect that is
        // not modelled is a rule the model cannot see.
        var filled = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var t in doc.Transitions)
            foreach (var term in TermsWritten(t.EffectExpression))
                filled.Add(term);

        foreach (var t in doc.Transitions)
        {
            if (t.GuardExpression.Length == 0) continue;
            foreach (var term in doc.Vocabulary.Terms)
            {
                var type = doc.Vocabulary.TypeOf(term);
                if (type != "set" && type != "flag") continue;
                if (filled.Contains(term)) continue;
                if (!Expressions.NamesTerm(t.GuardExpression, term)) continue;
                problems.Add($"{t.Id}: its guard reads the {type} '{term}', which no transition ever fills " +
                              "— the guard can never hold, and every state behind it is unreachable");
            }
        }

        // 2. Every state id a transition names exists.
        foreach (var t in doc.Transitions)
        {
            foreach (var id in t.FromIds.Concat(t.ToIds))
                if (doc.State(id) is null)
                    problems.Add($"{t.Id}: references state {id}, which the document does not define");
        }

        // 3. Every invariant bound to a machine is bound to one that exists.
        foreach (var i in doc.Invariants)
        {
            if (i.Machine.Length == 0)
                problems.Add($"{i.Id}: no machine could be read from its States / Transitions column");
            else if (doc.Machine(i.Machine) is null)
                problems.Add($"{i.Id}: bound to machine {i.Machine}, which the document does not define");
        }

        // 4. Every transition belongs to a machine that exists.
        foreach (var t in doc.Transitions)
        {
            if (t.Machine.Length == 0)
                problems.Add($"{t.Id}: no machine could be read from its section heading");
            else if (doc.Machine(t.Machine) is null)
                problems.Add($"{t.Id}: belongs to machine {t.Machine}, which the document does not define");
        }

        // 5. Every state belongs to a machine that exists.
        foreach (var s in doc.States)
        {
            if (s.Machine.Length == 0)
                problems.Add($"{s.Id}: no machine could be read from its row");
            else if (doc.Machine(s.Machine) is null)
                problems.Add($"{s.Id}: belongs to machine {s.Machine}, which the document does not define");
        }

        Console.WriteLine($"document: {path}");
        Console.WriteLine();
        if (problems.Count == 0)
        {
            Console.WriteLine("CHECK PASSED: every expression resolves and every identifier exists.");
            return 0;
        }

        Console.WriteLine($"CHECK FAILED: {problems.Count} problem(s).");
        foreach (var p in problems.Take(60)) Console.WriteLine($"  - {p}");
        if (problems.Count > 60) Console.WriteLine($"  ... and {problems.Count - 60} more");
        return 1;
    }

    // ---------------------------------------------------------------- explore

    private static int Explore(string path)
    {
        var doc = SpecDocument.Load(path);
        var vocabulary = doc.Vocabulary;
        var actions = Actions.Build(doc);
        var invariants = new InvariantSet(doc);
        var states = new StateSpace(doc);

        var explorer = new Explorer(actions, invariants, states, doc, MaxStates());
        explorer.Explore();

        Console.WriteLine($"document: {path}");
        Console.WriteLine();
        Console.WriteLine($"MACHINES: {doc.Machines.Count}   TRANSITIONS: {doc.Transitions.Count}   "
                        + $"INVARIANTS: {doc.Invariants.Count}   FINDINGS: {doc.Findings.Count}");
        Console.WriteLine($"STATES VISITED: {explorer.Visited}");
        Console.WriteLine();

        foreach (var machine in doc.Machines)
        {
            var reached = explorer.ReachedIn(machine.Id).ToList();
            var bad = reached.Count(r => r.Violations.Count > 0);
            var checkable = invariants.Checkable(machine.Id).Count;
            var total = invariants.Of(machine.Id).Count;
            Console.WriteLine($"  {machine.Id} {machine.Name,-34} {reached.Count,6} reachable, {bad,5} violating "
                            + $"(invariants checked: {checkable}/{total})");
        }

        Console.WriteLine();
        Console.WriteLine("  by state:");
        foreach (var (machine, state, inState) in explorer.ByMachineState())
        {
            var bad = inState.Count(r => r.Violations.Count > 0);
            var name = doc.State(state)?.Name ?? state;
            Console.WriteLine($"    {machine} {state} {name,-32} {inState.Count,6} reachable, {bad,5} violating");
        }

        var violating = explorer.Reached.Count(r => r.Violations.Count > 0);
        Console.WriteLine();
        Console.WriteLine($"{violating} of {explorer.Visited} reachable states violate at least one invariant.");

        if (explorer.Unchecked.Any())
        {
            Console.WriteLine();
            Console.WriteLine($"UNCHECKED INVARIANTS: {explorer.Unchecked.Count}");
            Console.WriteLine("  (the document marks these not expressible - they are NOT violations)");
            foreach (var u in explorer.Unchecked.Take(20))
                Console.WriteLine($"  {u.InvariantId} ({u.Machine}): {u.Reason}");
            if (explorer.Unchecked.Count > 20) Console.WriteLine($"  ... and {explorer.Unchecked.Count - 20} more");
        }

        if (explorer.Divergences.Any())
        {
            Console.WriteLine();
            Console.WriteLine($"DIVERGENCES: {explorer.Divergences.Count()}");
            foreach (var d in explorer.Divergences.Take(20))
                Console.WriteLine($"  {d.Group}: {d.ReadingA} -> {d.KeyA}   vs   {d.ReadingB} -> {d.KeyB}");
        }

        var probes = new Probes(doc, explorer).Verdicts();
        var reproduced = probes.Count(p => p.Status == "REPRODUCED");
        var notReproduced = probes.Count(p => p.Status == "NOT REPRODUCED");
        var notProbed = probes.Count(p => p.Status == "NOT PROBED");

        Console.WriteLine();
        Console.WriteLine("FINDINGS' REACHABILITY CLAIMS:");
        Console.WriteLine($"  {reproduced} reproduced   {notReproduced} not reproduced   {notProbed} not probed");
        foreach (var p in probes.Where(p => p.Status != "NOT PROBED"))
            Console.WriteLine($"  {p.Status,-14} {p.FindingId}  {p.Detail}");

        if (explorer.Gaps.Any())
        {
            Console.WriteLine();
            Console.WriteLine($"EXECUTABLE GAPS: {explorer.Gaps.Count()}");
            foreach (var g in explorer.Gaps.Take(20))
                Console.WriteLine($"  {g.TransitionId} ({g.Machine}): {g.Reason}");
            if (explorer.Gaps.Count() > 20) Console.WriteLine($"  ... and {explorer.Gaps.Count() - 20} more");
        }

        Console.WriteLine();
        foreach (var t in explorer.Trace) Console.WriteLine(t);

        return 0;
    }

    // ----------------------------------------------------------------- export

    private static int Export(string path, string output, bool slim)
    {
        var doc = SpecDocument.Load(path);
        var actions = Actions.Build(doc);
        var invariants = new InvariantSet(doc);
        var states = new StateSpace(doc);

        /* The SOURCE specification: the document the analysis was read
           from. The evidence columns cite IT, so its sections are what a
           citation resolves to - and they are resolved against the
           source's own STRUCTURE, so a citation names a section, not a
           paragraph.

           The source is found by the name the analysis gives it in its
           source inventory, and it keeps the id the analysis gave it:
           its sections are addressed SRC-001/6.3. */
        var sourcePath = SourceDocument.Locate(path, doc.Sources.Select(s => s.Document));
        /* The source's id is the one the DOCUMENT gave it, in its own source
           registry — not one read out of a table cell. */
        var sourceId = doc.Sources.FirstOrDefault()?.Id ?? "SRC-001";
        var sourceTree = sourcePath is null ? null : SpecReader.Tree(sourcePath, sourceId);
        var sourceIndex = sourceTree is null ? null : SpecReader.IndexOf(sourceTree);

        /* The evidence is GROUNDED IN THE SOURCE. A citation names a
           place in the specification, and the specification's sections
           are nodes of its own structure, addressed by the source id
           and the number path - SRC-001/6.3. */
        var citations = new CitationResolver(sourceIndex, sourceId);

        /* An evidence cell, cut: the document's own words, and the
           sections it cites. The page never has to recognise a section
           number in a sentence - the reference arrives already resolved,
           or as the words it was written with. */
        object[] Cut(string? evidence) => citations.Cut(evidence)
            .Select(p => new { text = p.Text, id = p.Id, prefix = p.Prefix, label = p.Label })
            .ToArray();

        var explorer = new Explorer(actions, invariants, states, doc, MaxStates());
        explorer.Explore();

        /* The catalogue, FLAT: one record per identifier the document
           issues, with the name it stands for. Every view's table is over
           one uniform shape, and the page builds its link index from this
           one array.

           The namespace beside it says which prefixes the format issues
           and what each stands for — the COUNT is a fact about the
           document being analysed, so it travels with the data rather
           than with the format. */
        var catalogue = new List<object>();
        var idSeries = new List<object>();

        void AddSeries(string prefix, string kind, string property,
            IEnumerable<(string id, string name, string detail, string extra, string evidence)> rows)
        {
            var list = rows.ToList();
            foreach (var r in list)
            {
                catalogue.Add(new
                {
                    series = prefix,
                    kind = kind,
                    id = r.id,
                    name = r.name,
                    detail = r.detail,
                    extra = r.extra,
                    /* The evidence, CUT: the document's words, and the
                       paragraphs it cites. It is cut here, where the
                       series are gathered, so every record of the
                       catalogue carries the same shape. */
                    evidence = Cut(r.evidence),
                });
            }
            idSeries.Add(new
            {
                prefix = prefix,
                kind = kind,
                property = property,
                count = list.Count,
            });
        }

        AddSeries("SRC", "Source", "catalogue", doc.Sources.Select(s => (
            s.Id, s.Document, s.Authority, s.Version, s.Sections)));
        AddSeries("TERM", "Glossary term", "glossary", doc.Terms.Select(t => (
            t.Id, t.Term, t.Definition, t.Context, t.Evidence)));
        AddSeries("ENT", "Entity", "entities", doc.Entities.Select(e => (
            e.Id, e.Name, e.Purpose, e.Identity, e.Evidence)));
        AddSeries("VO", "Value object", "valueObjects", doc.ValueObjects.Select(v => (
            v.Id, v.Name, v.Meaning, v.Constraints, v.Evidence)));
        AddSeries("AGG", "Aggregate candidate", "catalogueAggregates", doc.Aggregates.Select(a => (
            a.Id, a.Name, a.Root, a.Confidence, a.Evidence)));
        AddSeries("BC", "Bounded context", "catalogue", doc.BoundedContexts.Select(b => (
            b.Id, b.Name, b.Owns, b.Description, b.Evidence)));
        AddSeries("CMD", "Command", "commands", doc.Commands.Select(c => (
            c.Id, c.Command, c.Actor, c.Effects, c.Evidence)));
        AddSeries("EVT", "Domain event", "events", doc.Events.Select(e => (
            e.Id, e.Name, e.Meaning, e.Trigger, e.Evidence)));
        AddSeries("POL", "Policy", "policies", doc.Policies.Select(p => (
            p.Id, p.Name, p.Trigger, p.Action, p.Evidence)));
        AddSeries("SCN", "Scenario", "catalogueScenarios", doc.Scenarios.Select(s => (
            s.Id, s.Title, s.Evidence, "", "")));
        AddSeries("N", "Role-rewritten rule", "catalogueNamedRules", doc.NamedRules.Select(n => (
            n.Id, n.Rule, n.Rewritten, n.Role, n.Evidence)));
        /* The six series the document's own structure carries. They are in
           the export already, in their own arrays; the namespace says so,
           so the page can find them without listing them. */
        AddSeries("CON", "Domain concept", "catalogue", doc.DomainConcepts.Select(c => (
            c.Id, c.Name, c.Description, c.Relationships, c.Evidence)));
        AddSeries("PAR", "Paragraph locator", "catalogue", doc.SourceLocators.Select(l => (
            l.Locator, l.OpeningWords.Length > 0 ? l.OpeningWords : l.Section, l.Section, "", "")));
        AddSeries("SM", "State machine", "machines", doc.Machines.Select(m => (
            m.Id, m.Name, m.Concept, m.Classification, m.Confidence)));
        AddSeries("ST", "State", "states", doc.States.Select(s => (
            s.Id, s.Name, s.Meaning, s.Kind, s.Source)));
        AddSeries("TR", "Transition", "transitions", doc.Transitions.Select(t => (
            t.Id, t.Trigger, t.Guard, t.Actor, t.Evidence)));
        AddSeries("INV", "Invariant", "invariants", doc.Invariants.Select(i => (
            i.Id, i.Text, i.Expression, i.Register, i.Evidence)));
        AddSeries("F", "Finding", "findings", doc.Findings.Select(f => (
            f.Id, f.Title, f.Evidence, f.Impact, f.Evidence)));
        AddSeries("Q", "Question", "questions", doc.Questions.Select(x => (
            x.Id, x.Question, x.Blocks, x.Priority, x.RelatedFindings)));

        var actorLists = doc.Transitions.ToDictionary(
            t => t.Id,
            t => Actors.Resolve(t.Actor, doc.Roles.Select(r => r.Name)));

        var payload = new
        {
            document = Path.GetFileName(path),
            generated = DateTimeOffset.Now.ToString("o"),
            modelOf = "the specification, not any implementation",
            counts = new
            {
                machines = doc.Machines.Count,
                states = doc.States.Count,
                transitions = doc.Transitions.Count,
                invariants = doc.Invariants.Count,
                findings = doc.Findings.Count,
                questions = doc.Questions.Count,
                couplings = doc.Couplings.Count,
                vocabulary = doc.Vocabulary.Terms.Count(),
            },
            statesVisited = explorer.Visited,
            statesViolating = explorer.Reached.Count(r => r.Violations.Count > 0),
            /* The engine's own boolean, not a reading of its trace. The
               trace says the same thing in prose, but a prose check is a
               guess: both branches of the trace contain the word
               "exhausted", so a substring test was true whichever way the
               exploration ended, and the page said the analysis was
               complete when it had been truncated. */
            frontierExhausted = explorer.FrontierExhausted,
            /* The bound the count was reached under, so a reader can weigh
               a number that is a property of the bound rather than of the
               specification. */
            maxStates = explorer.MaxStates,
            divergenceCount = explorer.Divergences.Count(),
            trace = explorer.Trace,
            byMachine = doc.Machines.Select(m =>
            {
                var reached = explorer.ReachedIn(m.Id).ToList();
                return new
                {
                    machine = m.Id,
                    name = m.Name,
                    concept = m.Concept,
                    classification = m.Classification,
                    classificationReason = m.ClassificationReason,
                    initialState = m.InitialState,
                    terminalStates = m.TerminalStates,
                    total = reached.Count,
                    violating = reached.Count(r => r.Violations.Count > 0),
                    invariantsChecked = invariants.Checkable(m.Id).Count,
                    invariantsTotal = invariants.Of(m.Id).Count,
                };
            }).ToList(),
            byState = explorer.ByMachineState().Select(g => new
            {
                machine = g.Machine,
                state = g.State,
                name = doc.State(g.State)?.Name ?? g.State,
                total = g.States.Count,
                violating = g.States.Count(r => r.Violations.Count > 0),
            }).ToList(),
            uncheckedInvariants = explorer.Unchecked.Select(u => new
            {
                id = u.InvariantId,
                text = u.Text,
                machine = u.Machine,
                reason = u.Reason,
            }).ToList(),
            violations = explorer.Reached
                .SelectMany(r => r.Violations.Select(v => new { r, v }))
                .GroupBy(x => x.v.InvariantId)
                .Select(g => new
                {
                    id = g.Key,
                    text = g.First().v.Text,
                    machine = g.First().v.Machine,
                    states = g.Count(),
                    detail = g.First().v.Detail,
                    evidence = Cut(g.First().v.Evidence),
                    examplePath = g.First().r.Path,
                })
                .OrderByDescending(x => x.states)
                .ToList(),
            divergences = explorer.Divergences.Select(d => new
            {
                group = d.Group,
                readingA = d.ReadingA,
                readingB = d.ReadingB,
                keyA = d.KeyA.ToString(),
                keyB = d.KeyB.ToString(),
                sourcePath = d.SourcePath,
            }).ToList(),
            gaps = explorer.Gaps.Select(g => new
            {
                transition = g.TransitionId,
                machine = g.Machine,
                reason = g.Reason,
                detail = g.Detail,
            }).ToList(),
            findings = doc.Findings.Select(f => new
            {
                id = f.Id,
                title = f.Title,
                kind = SpecDocument.KindOf(f.Kind),
                evidence = Cut(f.Evidence),
                impact = f.Impact,
                clarification = f.Clarification,
                probe = f.Probe,
            }).ToList(),
            probes = new Probes(doc, explorer).Verdicts().Select(p => new
            {
                id = p.FindingId,
                title = p.Title,
                kind = p.Kind,
                status = p.Status,
                predicate = p.Predicate,
                detail = p.Detail,
                statesMatching = p.StatesMatching,
                examplePath = p.ExamplePath,
            }).ToList(),
            invariants = doc.Invariants.Select(i =>
            {
                /* The scope, RESOLVED. §15's column mixes states and
                   transitions, and the two mean different things: a rule
                   that holds in a state, and a rule that guards a move.
                   The exporter ships the kind and the ids it names, so a
                   consumer never has to read the cell to know which it
                   is. The resolution is the CHECKER's own - the same one
                   the invariant was judged by. */
                var sc = invariants.ScopeOf(i);
                return new
                {
                    id = i.Id,
                    text = i.Text,
                    category = i.Category,
                    scope = ScopeParts(sc),
                    appliesTo = new
                    {
                        /* The scope, as the ids it names. The kind and the
                           document's own cell are not shipped: a consumer
                           reads the lists, and a list of ids says what it
                           says. A scope of "All states" is written out as
                           the states it holds in, so the list is never
                           empty by accident. */
                        states = ScopeResolver.StateIdsHeldIn(doc, sc, i.Machine),
                        transitions = sc.TransitionIds,
                    },
                    expression = i.Expression,
                    /* The document puts a MARKER where an expression would be
                       when it could not write the rule as one. The page must
                       not have to recognise that by its wording. */
                    notExpressible = i.NotExpressible,
                    checkable = invariants.IsCheckable(i),
                    reason = invariants.ReasonUncheckable(i),
                    register = i.Register,
                    evidence = Cut(i.Evidence),
                    machine = i.Machine,
                };
            }).ToList(),
            transitions = doc.Transitions.Select(t => new
            {
                id = t.Id,
                machine = t.Machine,
                from = t.FromRaw,
                to = t.ToRaw,
                // The states the cells name, RESOLVED. A consumer of the
                // export never has to parse a cell: "ST-001 Draft, ST-002,
                // ST-003" is shipped as the three ids it names.
                fromStates = t.NamedFrom,
                toStates = t.NamedTo,
                fromIsInitial = t.FromIsInitial,
                toUnstated = t.ToUnstated,
                trigger = t.Trigger,
                /* The trigger's NAME, read once here: the trigger names its
                   command by code and by name - "CMD-001 Create application"
                   - and the code is a handle, not a reading. */
                triggerName = t.Trigger,
                /* The COMMANDS the trigger names, resolved. The trigger
                   cell is prose - "CMD-006/CMD-007 Submit" - and the page
                   draws the commands as commands, not as a sentence. */
                commands = t.CommandIds,
                guard = t.Guard,
                guardExpression = t.GuardExpression,
                /* The marker, if the document wrote one here. */
                guardNotExpressible = t.GuardNotExpressible,
                effectExpression = t.EffectExpression,
                actor = t.Actor,
                /* The actor cell, RESOLVED against the document's own list of
                   roles. The cell is prose — "Sales, or Customer (if a link
                   was sent)" — and a consumer should not have to parse it.
                   What named no role the document defines is carried too,
                   marked unresolved, rather than dropped. */
                actors = actorLists[t.Id].Actors.Select(a => new
                {
                    name = a.Name,
                    asNamed = a.AsNamed,
                    condition = a.Condition,
                    resolved = a.Resolved,
                }).ToList(),
                evidence = Cut(t.Evidence),
            }).ToList(),
            /* The hierarchy, as the document nests it: a machine, the
               states it owns, and the transitions that leave and enter
               each state. The page reads this rather than re-deriving the
               structure from flat lists. */
            hierarchy = doc.Machines.Select(m => new
            {
                machine = m.Id,
                name = m.Name,
                states = doc.StatesOf(m.Id).Select(sid => new
                {
                    id = sid,
                    name = doc.State(sid)?.Name ?? "",
                    outgoing = doc.Transitions
                        .Where(t => t.Machine == m.Id && t.NamedFrom.Contains(sid))
                        .Select(t => t.Id).ToArray(),
                    incoming = doc.Transitions
                        .Where(t => t.Machine == m.Id && t.NamedTo.Contains(sid))
                        .Select(t => t.Id).ToArray(),
                }).ToArray(),
            }).ToList(),
            couplings = doc.Couplings.Select(c => new
            {
                source = c.SourceMachine,
                target = c.TargetMachine,
                trigger = c.Trigger,
                effect = c.Effect,
                ordering = c.Ordering,
                synchronous = SpecDocument.IsSynchronous(c),
                evidence = Cut(c.Evidence),
            }).ToList(),
            questions = doc.Questions.Select(q => new
            {
                id = q.Id,
                question = q.Question,
                priority = q.Priority,
                blocks = q.Blocks,
                related = q.RelatedFindings,
            }).ToList(),
            states = doc.States.Select(s => new
            {
                id = s.Id,
                machine = s.Machine,
                name = s.Name,
                meaning = s.Meaning,
                kind = s.Kind,
                invariants = s.Invariants,
                /* The SAME list, resolved. The document writes it as a
                   sentence, and for one state as a range - "INV-001…INV-011
                   as in Draft" - which means the invariants the named state
                   holds, within that span. The page reads ids, not a
                   sentence it would have to interpret. */
                invariantIds = s.InvariantIds,
                source = Cut(s.Source),
                reachable = doc.StatesOf(s.Machine).Length,
            }).ToList(),
            commands = doc.Commands.Select(c => new
            {
                id = c.Id,
                name = c.Command,
                actor = c.Actor,
                guards = c.Preconditions,
                effects = c.Effects,
                rejection = c.Rejection,
                evidence = Cut(c.Evidence),
            }).ToList(),
            events = doc.Events.Select(e => new
            {
                id = e.Id,
                name = e.Name,
                meaning = e.Meaning,
                trigger = e.Trigger,
                affects = e.Affects,
                consequences = e.Consequences,
                evidence = Cut(e.Evidence),
            }).ToList(),
            policies = doc.Policies.Select(p => new
            {
                id = p.Id,
                name = p.Name,
                trigger = p.Trigger,
                condition = p.Condition,
                action = p.Action,
                scope = p.Scope,
                evidence = Cut(p.Evidence),
            }).ToList(),
            entities = doc.Entities.Select(e => new
            {
                id = e.Id,
                name = e.Name,
                identity = e.Identity,
                purpose = e.Purpose,
                lifecycle = e.Lifecycle,
                relationships = e.Relationships,
                evidence = Cut(e.Evidence),
            }).ToList(),
            valueObjects = doc.ValueObjects.Select(v => new
            {
                id = v.Id,
                name = v.Name,
                meaning = v.Meaning,
                attributes = v.Attributes,
                constraints = v.Constraints,
                equality = v.Equality,
                evidence = Cut(v.Evidence),
            }).ToList(),
            roles = doc.Roles.Select(r => new
            {
                name = r.Name,
                mayDo = r.MayDo,
                instances = r.Instances,
                source = Cut(r.Source),
            }).ToList(),
            contexts = doc.Contexts.Select(c => new
            {
                pair = c.Pair,
                relationship = c.Relationship,
                evidenceFor = Cut(c.EvidenceFor),
                evidenceAgainst = Cut(c.EvidenceAgainst),
                whatWouldSettle = c.WhatWouldSettle,
            }).ToList(),
            glossary = doc.Terms.Select(t => new
            {
                id = t.Id,
                term = t.Term,
                definition = t.Definition,
                context = t.Context,
                evidence = Cut(t.Evidence),
                status = t.Status,
            }).ToList(),
            // The expression vocabulary: the terms an expression may name,
            // their type, and the values they may hold. The explorer needs
            // it to read an expression back in words.
            vocabulary = doc.Vocabulary.Terms.Select(t => new
            {
                term = t,
                type = doc.Vocabulary.TypeOf(t),
                domain = doc.Vocabulary.DomainOf(t),
            }).ToList(),
            /* The catalogue: every identifier the document issues, with the
               name it carries. This is what the page turns an id into
               words, and what its links point at.

               FLAT, and the reason is that every view's table is over one
               uniform shape: a nested catalogue made the page flatten it
               before it could render, and the two flattenings could
               disagree. One record per id, each carrying the series it
               belongs to. */
            catalogue = catalogue,
            /* The specification itself, cut into paragraphs: the page
               shows the document the analysis was read from, and every
               reference that document makes to another paragraph is
               resolved to that paragraph's id - so a link the page
               draws is a link to something that exists.

               It is the SOURCE that is cut, and not the analysis: the
               analysis is the deliverable, and the deliverable is JSON -
               it has no paragraphs to cut. The source is what a reader
               checks an evidence citation against, and it is still a
               document on disk. */
            spec = (sourcePath is null ? new List<SpecParagraph>() : SpecReader.Read(sourcePath)).Select(p => new
            {
                id = p.Id,
                kind = p.Kind,
                section = p.Section,
                heading = p.Heading,
                parts = p.Parts.Select(x => new { text = x.Text, reference = x.Ref, label = x.Label }).ToList(),
                refs = p.Refs.Select(r => new { text = r.Text, id = r.Id }).ToList(),
                rows = p.Rows,
            }).ToList(),
            /* The SOURCE specification, as a TREE: its sections, each
               with its own content and its subsections. A citation names
               a SECTION of it, and a section is addressed by the source
               id and its number path - SRC-001/6.3.

               The structure is the document's, not a list's: a consumer
               that holds a reference to this spec can walk to the
               section it names without re-deriving the shape. */
            sourceSpec = sourceTree is null ? null : TreeNode(sourceTree),
            /* The identifier namespace: the prefixes the document issues
               and what each stands for. The page derives its link pattern
               from this rather than writing the prefixes out, so the
               namespace is stated ONCE - here - and the page can only be
               universal if the prefixes come from the format rather than
               from the document it happens to be reading. */
            idSeries = idSeries,
            /* The states, the transitions, the invariants and the findings
               are already in the export; the catalogue points at them. */
            catalogueStates = doc.States.Select(s => new
            {
                id = s.Id, name = s.Name, machine = s.Machine,
                detail = s.Meaning, kind = s.Kind, evidence = Cut(s.Source),
            }).ToList(),
            catalogueTransitions = doc.Transitions.Select(t => new
            {
                id = t.Id, name = t.Trigger, machine = t.Machine,
                detail = t.Guard, from = t.FromRaw, to = t.ToRaw, evidence = Cut(t.Evidence),
            }).ToList(),
            catalogueInvariants = doc.Invariants.Select(i => new
            {
                id = i.Id, name = i.Text, machine = i.Machine,
                detail = i.Expression, scope = i.Scope, evidence = Cut(i.Evidence),
            }).ToList(),
            catalogueFindings = doc.Findings.Select(f => new
            {
                id = f.Id, name = f.Title, kind = f.Kind,
                detail = Cut(f.Evidence), impact = f.Impact, evidence = Cut(f.Evidence),
            }).ToList(),
            catalogueQuestions = doc.Questions.Select(x => new
            {
                id = x.Id, name = x.Question, priority = x.Priority,
                detail = x.Blocks, related = x.RelatedFindings,
            }).ToList(),
            /* The aggregates and the scenarios carry sub-structure: an
               aggregate is a set of aspects, a scenario is a set of
               labelled parts. They are kept, so the page shows the
               document's own breakdown rather than a summary of it. */
            catalogueAggregates = doc.Aggregates.Select(a => new
            {
                id = a.Id, name = a.Name, root = a.Root,
                confidence = a.Confidence, evidence = Cut(a.Evidence),
                aspects = a.Aspects.Select(x => new
                {
                    aspect = x.Aspect, content = x.Content, evidence = Cut(x.Evidence),
                }).ToList(),
            }).ToList(),
            catalogueScenarios = doc.Scenarios.Select(s => new
            {
                id = s.Id, name = s.Title, evidence = Cut(s.Evidence),
                parts = s.Parts.Select(x => new
                {
                    label = x.Label, text = x.Text,
                }).ToList(),
            }).ToList(),
            catalogueNamedRules = doc.NamedRules.Select(n => new
            {
                id = n.Id, name = n.Rule, role = n.Role,
                rewritten = n.Rewritten, evidence = Cut(n.Evidence),
            }).ToList(),
            machines = doc.Machines.Select(m => new
            {
                id = m.Id,
                name = m.Name,
                concept = m.Concept,
                dimensions = m.Dimensions,
                classification = m.Classification,
                classificationReason = m.ClassificationReason,
                initialState = m.InitialState,
                terminalStates = m.TerminalStates,
                confidence = m.Confidence,
                states = doc.StatesOf(m.Id),
            }).ToList(),
            samples = slim
                ? new List<object>()
                : explorer.Reached.Take(400).Select(r => (object)new
                {
                    key = r.Key.ToString(),
                    machineStates = r.State.MachineStates,
                    violations = r.Violations.Select(v => new
                    {
                        id = v.InvariantId,
                        detail = v.Detail,
                        evidence = Cut(v.Evidence),
                        unset = v.Unset,
                    }).ToList(),
                    path = r.Path,
                }).ToList(),
        };

        var json = System.Text.Json.JsonSerializer.Serialize(payload,
            new System.Text.Json.JsonSerializerOptions { WriteIndented = true });
        File.WriteAllText(output, json);

        Console.WriteLine($"exported {explorer.Visited} reachable states across {doc.Machines.Count} machine(s), "
                        + $"{payload.statesViolating} violating, {payload.divergenceCount} divergence(s), "
                        + $"{doc.Findings.Count} findings -> {output}");
        return 0;
    }


    /// <summary>
    /// A scope, as the pieces the page draws: the words, and the names it
    /// names. The scope is a kind and a list of ids, so the pieces are the
    /// ids — and the words, when the scope names something that is not an
    /// id.
    /// </summary>
    private static List<ScopePart> ScopeParts(InvariantScope scope)
    {
        var parts = new List<ScopePart>();
        if (scope.Kind == ScopeKind.AllStates)
        {
            parts.Add(new ScopePart("All states", "", ""));
            return parts;
        }
        var ids = scope.Kind == ScopeKind.Transition ? scope.TransitionIds : scope.StateIds;
        foreach (var id in ids)
        {
            var dash = id.IndexOf('-');
            parts.Add(new ScopePart("", id, dash > 0 ? id[..dash] : ""));
        }
        return parts;
    }

    // ------------------------------------------------------------------- all

    /// <summary>
    /// A node of the source specification, as it travels: the section,
    /// its content, and its subsections.
    /// </summary>
    private static object TreeNode(SpecNode node) => new
    {
        id = node.Id,
        number = node.Number,
        title = node.Title,
        level = node.Level,
        paragraphs = node.Paragraphs.Select(p => new
        {
            id = p.Id,
            kind = p.Kind,
            parts = p.Parts.Select(x => new { text = x.Text, reference = x.Ref, label = x.Label }).ToList(),
            refs = p.Refs.Select(r => new { text = r.Text, id = r.Id }).ToList(),
            rows = p.Rows,
        }).ToList(),
        sections = node.Sections.Select(TreeNode).ToList(),
    };

    private static int All(string path)
    {
        var parse = Parse(path);
        Console.WriteLine();
        Console.WriteLine(new string('-', 72));
        var check = Check(path);
        Console.WriteLine();
        Console.WriteLine(new string('-', 72));
        var explore = Explore(path);
        return parse + check + explore;
    }
}
