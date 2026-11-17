using System.Text.RegularExpressions;

namespace Onboarding.Model;

/// <summary>
/// One piece of an evidence cell: either the document's own words, or a
/// reference to a paragraph of one of the documents the analysis was read
/// from.
/// <para>
/// The same shape <see cref="ScopePart"/> uses, plus the words the
/// reference was written with: an evidence cell says "§6.3", and the
/// reader must be able to see that it says §6.3 and where §6.3 is.
/// </para>
/// </summary>
/// <param name="Text">The words of this piece. Empty when it is a reference.</param>
/// <param name="Id">The paragraph this piece names. Empty when it is words.</param>
/// <param name="Prefix">The series the paragraph belongs to - S for the
/// source specification, P for the analysed document.</param>
/// <param name="Label">The words the reference was written with - "§6.3".</param>
public sealed record CitePart(string Text, string Id, string Prefix, string Label);

/// <summary>
/// The sections a document has, and the node each one is.
/// <para>
/// A reference names a section, so this is the map from a section number
/// to the node that IS that section. The first heading with a number
/// claims it: a document that numbers two sections alike has a document
/// problem, and the reader should see the first one.
/// </para>
/// </summary>
public sealed class SectionIndex
{
    private readonly Dictionary<string, string> _byNumber =
        new(StringComparer.OrdinalIgnoreCase);

    /// <summary>The node each section number opens.</summary>
    public IReadOnlyDictionary<string, string> ByNumber => _byNumber;

    /// <summary>Claim a section number for a node, if it is unclaimed.</summary>
    public void Claim(string number, string nodeId)
    {
        if (number.Length == 0) return;
        if (!_byNumber.ContainsKey(number)) _byNumber[number] = nodeId;
    }

    /// <summary>The node a section number opens, or nothing.</summary>
    public string? NodeOf(string number) =>
        _byNumber.TryGetValue(number, out var id) ? id : null;
}

/// <summary>
/// Resolves the section references an evidence cell makes.
/// <para>
/// The evidence column cites the SOURCE specification - the document the
/// analysis was read from - and its section numbers are the source's own.
/// Where the source has no such section, the citation names a section of
/// the analysed document itself, and resolves there.
/// </para>
/// <para>
/// A reference that names no section of either document is NOT resolvable,
/// and stays the document's own words: a link to nothing is worse than a
/// section number the reader can look up.
/// </para>
/// </summary>
public sealed class CitationResolver
{
    /// <summary>
    /// A reference a piece of text makes.
    /// <para>
    /// The form the prompt sets out: a document id and a section -
    /// "SRC-001 §6.3" names a section of the source specification,
    /// "DM §14.3" a section of the analysis itself. A bare "§6.3" names a
    /// section of no document, and is resolved the way it always was:
    /// the source first, then the analysis.
    /// </para>
    /// </summary>
    private static readonly Regex Reference = new(
        @"(?<id>SRC-\d{3})?\s*(?<mark>§)(?<number>\d+(?:\.\d+)*)",
        RegexOptions.Compiled);

    private readonly SectionIndex? _source;
    private readonly string _sourceId;

    /// <summary>
    /// A resolver over the source specification.
    /// <para>
    /// The source may be absent - the document may have been analysed
    /// without the specification beside it - and then no citation
    /// resolves.
    /// </para>
    /// </summary>
    public CitationResolver(SectionIndex? source, string sourceId)
    {
        _source = source;
        _sourceId = sourceId;
    }

    /// <summary>
    /// Cut an evidence cell into pieces: the document's own words, and the
    /// sections it cites.
    /// </summary>
    public List<CitePart> Cut(string? text)
    {
        var parts = new List<CitePart>();
        if (string.IsNullOrEmpty(text)) return parts;

        var value = text;
        var cursor = 0;
        foreach (Match m in Reference.Matches(value))
        {
            var number = m.Groups["number"].Value;
            var target = Resolve(number, m.Groups["id"].Value);
            if (target is null) continue;   // unresolvable: it stays words

            if (m.Index > cursor)
                parts.Add(new CitePart(value.Substring(cursor, m.Index - cursor), "", "", ""));
            /* The label is the reference as it was WRITTEN: a citation
               that says "SRC-001 §6.3" is shown as it says it, so the
               reader sees the same thing the document says. */
            parts.Add(new CitePart("", target.Id, target.Prefix, m.Value.Trim()));
            cursor = m.Index + m.Length;
        }
        if (cursor < value.Length)
            parts.Add(new CitePart(value.Substring(cursor), "", "", ""));
        return parts;
    }

    /// <summary>
    /// The node a section number names, if any.
    /// <para>
    /// The evidence is GROUNDED IN THE SOURCE: a citation is a place in
    /// the specification, and that is the only document it may name. A
    /// reference that names a document this export does not carry, or a
    /// section of the source that does not exist, names nothing here -
    /// and stays the document's own words, because a link to nothing is
    /// worse than a section number a reader can look up.
    /// </para>
    /// </summary>
    private CitationTarget? Resolve(string number, string id)
    {
        /* A reference that names a document names a source. */
        if (id.Length > 0 && !id.Equals(_sourceId, StringComparison.OrdinalIgnoreCase))
            return null;

        var node = _source?.NodeOf(number);
        return node is null ? null : new CitationTarget(node, "SEC");
    }
}

/// <summary>A section a citation names, and the series it is drawn as.</summary>
/// <param name="Id">What the citation leads to.</param>
/// <param name="Prefix">The series it is drawn as - SEC for a section of
/// the source specification, or the series of the id the analysis's own
/// section is about.</param>
public sealed record CitationTarget(string Id, string Prefix);

/// <summary>
/// The source specification, and the sections its citations name.
/// <para>
/// The evidence cites the SOURCE - the document the analysis was read
/// from - and a citation names a SECTION of it. The section is a node
/// of the source's own structure, addressed by the source id and the
/// section's number path: SRC-001/6.3.
/// </para>
/// </summary>
public static class SourceDocument
{
    /// <summary>
    /// Find the source specification the analysed document names, or
    /// nothing when there is no such file beside it.
    /// <para>
    /// The file is found by the name the analysis gives it - the
    /// document names its own sources, and the file beside it with
    /// that name IS the source. The id the analysis gave it is the
    /// id its sections are addressed by.
    /// </para>
    /// </summary>
    public static string? Locate(string analysedPath, IEnumerable<string> names)
    {
        var full = Path.GetFullPath(analysedPath);
        var directory = Path.GetDirectoryName(full);
        if (directory is null || !Directory.Exists(directory)) return null;

        var candidates = Directory
            .EnumerateFiles(directory, "*.md", SearchOption.AllDirectories)
            .Where(p => !string.Equals(Path.GetFullPath(p), full, StringComparison.OrdinalIgnoreCase))
            .Where(p => !IsBuildOutput(p))
            .OrderBy(p => p, StringComparer.OrdinalIgnoreCase)
            .ToList();

        foreach (var name in names)
        {
            var wanted = Clean(name);
            if (wanted.Length == 0) continue;
            foreach (var candidate in candidates)
            {
                if (TitleOf(candidate) == wanted) return candidate;
            }
        }
        return null;
    }


    /// <summary>The document's title: its first heading's text.</summary>
    private static string TitleOf(string path)
    {
        foreach (var line in File.ReadLines(path))
        {
            var trimmed = line.TrimStart();
            if (!trimmed.StartsWith("# ", StringComparison.Ordinal)) continue;
            return Clean(trimmed[2..]);
        }
        return "";
    }

    /// <summary>
    /// A name as the document writes it: the emphasis marks are not part
    /// of the name.
    /// </summary>
    private static string Clean(string name)
    {
        var text = name.Trim().Trim('*', '_', '`', '"', '\'', ' ');
        while (text.Contains("**")) text = text.Replace("**", "");
        return string.Join(" ", text.Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }

    /// <summary>Files that are not documents: the tools, the build output.</summary>
    private static bool IsBuildOutput(string path) =>
        path.Contains($"{Path.DirectorySeparatorChar}explorer{Path.DirectorySeparatorChar}", StringComparison.OrdinalIgnoreCase)
        || path.Contains($"{Path.DirectorySeparatorChar}model{Path.DirectorySeparatorChar}", StringComparison.OrdinalIgnoreCase)
        || path.Contains($"{Path.DirectorySeparatorChar}tools{Path.DirectorySeparatorChar}", StringComparison.OrdinalIgnoreCase)
        || path.Contains($"{Path.DirectorySeparatorChar}node_modules{Path.DirectorySeparatorChar}", StringComparison.OrdinalIgnoreCase)
        || path.Contains($"{Path.DirectorySeparatorChar}.git{Path.DirectorySeparatorChar}", StringComparison.OrdinalIgnoreCase);
}
