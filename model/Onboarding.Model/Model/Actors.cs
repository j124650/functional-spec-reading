namespace Onboarding.Model;

/// <summary>
/// One actor of a transition: a role, as the document names it, and the
/// qualifier that rode along with it.
/// </summary>
/// <param name="Name">The role's short name — "Sales", not "Sales (Submitter)".</param>
/// <param name="AsNamed">The name the document gives the role where it defines it.</param>
/// <param name="Condition">The qualifier from the cell — "if a link was sent".</param>
/// <param name="Resolved">False when the cell named something the document does not
/// define as a role. Such an actor is still carried: a cell that quietly loses
/// an actor is worse than one that says it did not understand it.</param>
public sealed record ActorRef(string Name, string AsNamed, string? Condition, bool Resolved);

/// <summary>
/// The actor cell of a transition, read as a list of actors.
/// </summary>
public sealed record ActorList(List<ActorRef> Actors)
{
    public static readonly ActorList None = new(new List<ActorRef>());
}

/// <summary>
/// The actor cell of a transition, RESOLVED against the document's own list
/// of roles.
/// <para>
/// The document names its roles once — in the section that defines them — and
/// names them again, in prose, in every transition's actor cell. The two do
/// not match literally: the role is defined as "Sales (Submitter)" and used
/// as "Sales"; two roles are written together as "Credit / Allowance
/// Approver"; and a qualifier rides along in brackets — "Customer (if a link
/// was sent)".
/// </para>
/// <para>
/// So the cell is resolved against the roles the document defines, and
/// whatever does not resolve is reported rather than dropped. Nothing here
/// knows any role: the list comes from the document.
/// </para>
/// </summary>
public static class Actors
{
    /// <summary>
    /// The role's name without its parenthetical, and with it.
    /// </summary>
    public sealed record RoleName(string Full, string Short);

    public static RoleName Role(string name)
    {
        var trimmed = (name ?? "").Trim();
        var open = trimmed.IndexOf('(');
        return open < 0
            ? new RoleName(trimmed, trimmed)
            : new RoleName(trimmed, trimmed[..open].Trim());
    }

    public static ActorList Resolve(string? cell, IEnumerable<string> roleNames)
    {
        var roles = roleNames.Select(Role).Where(r => r.Full.Length > 0).ToList();
        var text = (cell ?? "").Trim();
        if (text.Length == 0 || text == "—") return ActorList.None;

        var found = new List<ActorRef>();
        foreach (var part in Parts(text))
        {
            var (head, condition) = Qualifier(part);
            if (head.Length == 0) continue;
            foreach (var candidate in Names(head))
            {
                var match = Match(candidate, roles);
                if (match == null)
                {
                    if (!found.Any(a => a.Name.Equals(candidate, StringComparison.OrdinalIgnoreCase)))
                        found.Add(new ActorRef(candidate, candidate, condition, false));
                    continue;
                }
                if (found.Any(a => a.Name.Equals(match.Short, StringComparison.OrdinalIgnoreCase)))
                    continue;
                found.Add(new ActorRef(match.Short, match.Full, condition, true));
            }
        }
        return new ActorList(found);
    }

    /// <summary>
    /// The cell's parts, in the order the document wrote them.
    /// </summary>
    private static IEnumerable<string> Parts(string text)
    {
        foreach (var chunk in text.Split(',', ';'))
        {
            var words = chunk.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            var current = new List<string>();
            foreach (var word in words)
            {
                var lower = word.Trim(',', ';').ToLowerInvariant();
                if (lower is "or" or "and" or "then" or "plus")
                {
                    if (current.Count > 0) { yield return string.Join(" ", current); current.Clear(); }
                    continue;
                }
                current.Add(word);
            }
            if (current.Count > 0) yield return string.Join(" ", current);
        }
    }

    /// <summary>
    /// A qualifier in brackets is a CONDITION when it says "if", "when",
    /// "unless" and the like. Anything else in brackets is part of the name
    /// — "Sales (Submitter)" — and is dropped, because the document's own
    /// definition of the role carries it.
    /// </summary>
    private static (string Head, string? Condition) Qualifier(string part)
    {
        var open = part.IndexOf('(');
        if (open < 0) return (part.Trim(), null);
        var close = part.IndexOf(')', open);
        if (close < 0) return (part.Trim(), null);
        var inner = part[(open + 1)..close].Trim();
        var head = (part[..open] + " " + part[(close + 1)..]).Trim();
        var lower = inner.ToLowerInvariant();
        var isCondition =
            lower.StartsWith("if") || lower.StartsWith("when") ||
            lower.StartsWith("unless") || lower.StartsWith("until") ||
            lower.StartsWith("after") || lower.StartsWith("before") ||
            lower.StartsWith("only") || lower.StartsWith("if not");
        return (head, isCondition ? inner : null);
    }

    /// <summary>
    /// "Credit / Allowance Approver" names two roles.
    /// </summary>
    private static IEnumerable<string> Names(string head)
    {
        foreach (var piece in head.Split('/'))
        {
            var trimmed = piece.Trim();
            if (trimmed.Length > 0) yield return trimmed;
        }
    }

    /// <summary>
    /// The role a name refers to: exactly, or by its first words — "Credit"
    /// is the "Credit Approver" — but only at a word boundary, so a shorter
    /// name never swallows a longer one.
    /// </summary>
    private static RoleName? Match(string candidate, IReadOnlyList<RoleName> roles)
    {
        foreach (var r in roles)
        {
            if (candidate.Equals(r.Full, StringComparison.OrdinalIgnoreCase)) return r;
            if (candidate.Equals(r.Short, StringComparison.OrdinalIgnoreCase)) return r;
        }
        foreach (var r in roles)
        {
            if (r.Short.Length <= candidate.Length) continue;
            if (!r.Short.StartsWith(candidate, StringComparison.OrdinalIgnoreCase)) continue;
            var next = r.Short[candidate.Length];
            if (char.IsLetterOrDigit(next)) continue;
            return r;
        }
        return null;
    }
}
