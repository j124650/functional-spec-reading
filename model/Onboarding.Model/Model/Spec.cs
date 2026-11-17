namespace Onboarding.Model;

using System.Text;

/// <summary>
/// A reference one paragraph makes to another: the words it was written
/// with, and the paragraph it means.
/// </summary>
public sealed record SpecRef(string Text, string Id);

/// <summary>
/// One piece of a paragraph: either text, or a reference to another
/// paragraph. The paragraph arrives already cut, so the page never has
/// to look for a reference in a sentence.
/// </summary>
public sealed record SpecPart(string Text, string Ref, string Label);

/// <summary>
/// One node of a document's structure: a section, with its own content
/// and its subsections.
/// </summary>
/// <param name="Id">The section's address: the source id and the
/// section's number path - SRC-001/6.3. A reference to the document
/// from anywhere is this address.</param>
/// <param name="Number">The section's own number - "6.3". Empty when
/// the document does not number it.</param>
/// <param name="Title">The section's own title.</param>
/// <param name="Level">How deep the section sits: 1 for a top-level
/// section, 2 for one under it.</param>
/// <param name="Paragraphs">The content of the section, before its
/// subsections.</param>
/// <param name="Sections">The subsections, in the document's order.</param>
public sealed record SpecNode(
    string Id,
    string Number,
    string Title,
    int Level,
    SpecParagraph[] Paragraphs,
    SpecNode[] Sections);

/// <summary>
/// One paragraph of the specification.
/// </summary>
/// <param name="Id">Its handle - P001, P002 - and nothing else.</param>
/// <param name="Kind">heading, text, list, table or code.</param>
/// <param name="Section">The section it sits under, e.g. "6.2".</param>
/// <param name="Heading">The heading's own text, when the paragraph is a heading.</param>
/// <param name="Parts">The paragraph, cut where it refers to another.</param>
/// <param name="Refs">The paragraphs it refers to, already resolved.</param>
/// <param name="Rows">A table's rows, cell by cell, when the paragraph is
/// a table. Empty otherwise. The table is cut HERE, so the page draws
/// cells and never splits a row itself.</param>
public sealed record SpecParagraph(
    string Id,
    string Kind,
    string Section,
    string Heading,
    SpecPart[] Parts,
    SpecRef[] Refs,
    string[][] Rows);

/// <summary>
/// The specification, cut into paragraphs.
///
/// The explorer shows the document the analysis was read from, and the
/// reader navigates it by paragraph. The cutting happens HERE, not in
/// the page: the page reads a list of blocks and links them by id, and
/// every reference the text makes to another paragraph is resolved to
/// that paragraph's id - so the page never has to recognise a section
/// number in a sentence, and a link it draws is a link to something
/// that exists.
/// </summary>
public static class SpecReader
{
    /// <summary>
    /// The document's blocks: the runs of lines between blank lines, each
    /// with the kind of thing it is.
    /// </summary>
    public static List<(string Kind, string Text)> Blocks(string path)
    {
        var lines = File.ReadAllLines(path);
        var blocks = new List<(string Kind, string Text)>();
        var current = new List<string>();

        void Flush()
        {
            if (current.Count == 0) return;
            blocks.Add((KindOf(current), string.Join("\n", current)));
            current.Clear();
        }

        foreach (var line in lines)
        {
            if (line.Trim().Length == 0) { Flush(); continue; }
            current.Add(line);
        }
        Flush();
        return blocks;
    }

    /// <summary>
    /// A markdown table, cut into its rows and cells.
    /// <para>
    /// The row of dashes under the header is the table's way of saying
    /// which row is the header; it is not a row of the table, and a reader
    /// must not see it.
    /// </para>
    /// </summary>
    public static string[][] TableRows(string text)
    {
        var rows = new List<string[]>();
        foreach (var line in text.Split('\n'))
        {
            var trimmed = line.Trim();
            if (trimmed.Length == 0) continue;
            if (!trimmed.StartsWith("|", StringComparison.Ordinal)) continue;

            var cells = trimmed.Trim('|').Split('|');
            for (var i = 0; i < cells.Length; i++) cells[i] = cells[i].Trim();
            /* The separator row: dashes and colons only. */
            if (cells.All(c => c.Length == 0 || c.All(ch => ch == '-' || ch == ':'))) continue;
            rows.Add(cells);
        }
        return rows.ToArray();
    }

    /// <summary>
    /// A document, read into its STRUCTURE: the sections, each with its
    /// own content and its subsections.
    /// <para>
    /// The structure is the document's, not a list's: a section knows
    /// what is under it. Anything that holds a reference to the document
    /// addresses a section by its own address - the source id and the
    /// section's number path: SRC-001/6.3.
    /// </para>
    /// <para>
    /// A section the document does not number still has an address: its
    /// place among its siblings, marked so it cannot be mistaken for a
    /// number. SRC-001/u15 is the fifteenth section, unnumbered.
    /// </para>
    /// </summary>
    public static SpecNode Tree(string path, string sourceId)
    {
        var blocks = Blocks(path);

        /* The structure first: a heading under another heading is a
           subsection of it, and the address of a section is known only
           once its parent is. */
        var root = new Node { Id = sourceId, Level = 1 };
        var stack = new List<Node> { root };
        var section = "";
        var baseDepth = 0;
        var seen = false;

        foreach (var block in blocks)
        {
            if (block.Kind != "heading")
            {
                stack[stack.Count - 1].Raw.Add((block.Kind, block.Text, section));
                continue;
            }

            var number = NumberOf(block.Text);
            var heading = HeadingOf(block.Text);
            if (number.Length > 0) section = number;

            var depth = DepthOf(block.Text);
            if (!seen)
            {
                /* The document's own title IS the document: the sections
                   are under it. */
                seen = true;
                baseDepth = depth;
                root.Title = heading;
                root.Number = number;
                root.Section = section;
                continue;
            }

            var level = depth - baseDepth + 1;
            while (stack.Count > 1 && stack[stack.Count - 1].Level >= level)
                stack.RemoveAt(stack.Count - 1);
            var node = new Node { Title = heading, Number = number, Level = level, Section = section };
            stack[stack.Count - 1].Children.Add(node);
            stack.Add(node);
        }

        /* The addresses, and the map from a section number to the node
           that IS that section. */
        var index = new SectionIndex();
        root.Address(sourceId, index);

        /* Then the content, cut where it refers to another section. */
        root.Cut(index);
        return root.AsNode();
    }

    /// <summary>
    /// The map from a section number to the node that IS that section.
    /// </summary>
    public static SectionIndex IndexOf(SpecNode tree)
    {
        var index = new SectionIndex();
        Walk(tree, index);
        return index;
    }

    private static void Walk(SpecNode node, SectionIndex index)
    {
        if (node.Number.Length > 0) index.Claim(node.Number, node.Id);
        foreach (var child in node.Sections) Walk(child, index);
    }

    /// <summary>
    /// How deep a heading sits: "## 4" is 1, "### 4.1" is 2.
    /// </summary>
    private static int DepthOf(string heading)
    {
        var i = 0;
        while (i < heading.Length && heading[i] == '#') i++;
        return Math.Max(1, i - 1);
    }

    /// <summary>A node while the tree is being built.</summary>
    private sealed class Node
    {
        public string Title = "";
        public string Number = "";
        public string Section = "";
        public int Level;
        public string Id = "";
        public readonly List<(string kind, string text, string section)> Raw = new();
        public readonly List<Node> Children = new();
        public readonly List<SpecParagraph> Paragraphs = new();

        /// <summary>
        /// Give this node and its children their addresses, and claim
        /// each section number for the node that is that section.
        /// <para>
        /// A numbered section is addressed by its number - SRC-001/6.3.
        /// A section the document does not number is addressed by its
        /// place among its siblings, marked so it cannot be read as a
        /// number: SRC-001/u15 is the fifteenth, unnumbered.
        /// </para>
        /// </summary>
        public void Address(string sourceId, SectionIndex index)
        {
            var unnumbered = 0;
            foreach (var child in Children)
            {
                if (child.Number.Length > 0)
                {
                    child.Id = sourceId + "/" + child.Number;
                }
                else
                {
                    unnumbered++;
                    child.Id = (Id.Length > 0 ? Id : sourceId) + "/u" + unnumbered;
                }
                index.Claim(child.Number, child.Id);
                child.Address(sourceId, index);
            }
        }

        /// <summary>
        /// Cut this node's content into paragraphs, resolving the
        /// references it makes to other sections.
        /// </summary>
        public void Cut(SectionIndex index)
        {
            for (var i = 0; i < Raw.Count; i++)
            {
                var (kind, text, section) = Raw[i];
                var refs = new List<SpecRef>();
                var parts = new List<SpecPart>();
                var cursor = 0;
                foreach (var (refText, refNumber, start, end) in FindReferences(text))
                {
                    var target = index.NodeOf(refNumber);
                    if (target is null) continue;
                    if (start > cursor)
                        parts.Add(new SpecPart(text.Substring(cursor, start - cursor), "", ""));
                    parts.Add(new SpecPart("", target, refText));
                    refs.Add(new SpecRef(refText, target));
                    cursor = end;
                }
                if (cursor < text.Length)
                    parts.Add(new SpecPart(text.Substring(cursor), "", ""));

                var id = (Id.Length > 0 ? Id : "section") + "/p" + (i + 1);
                Paragraphs.Add(new SpecParagraph(id, kind, section, "",
                    parts.ToArray(), refs.ToArray(),
                    kind == "table" ? TableRows(text) : Array.Empty<string[]>()));
            }
            foreach (var child in Children) child.Cut(index);
        }

        /// <summary>The node, as it travels.</summary>
        public SpecNode AsNode()
        {
            var sections = new List<SpecNode>();
            foreach (var child in Children) sections.Add(child.AsNode());
            return new SpecNode(Id, Number, Title, Level,
                Paragraphs.ToArray(), sections.ToArray());
        }
    }

    /// <summary>
    /// Read the document and cut it into paragraphs.
    /// </summary>
    public static List<SpecParagraph> Read(string path)
    {
        var lines = File.ReadAllLines(path);
        var blocks = new List<(string Kind, string Text)>();
        var current = new List<string>();

        void Flush()
        {
            if (current.Count == 0) return;
            blocks.Add((KindOf(current), string.Join("\n", current)));
            current.Clear();
        }

        foreach (var line in lines)
        {
            if (line.Trim().Length == 0) { Flush(); continue; }
            current.Add(line);
        }
        Flush();

        /* The section each heading opens, and the paragraph that opens
           it. A reference names a section, so this is the map from a
           section number to the paragraph that IS that section. */
        var sectionOf = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var paragraphs = new List<SpecParagraph>();
        var section = "";

        for (var i = 0; i < blocks.Count; i++)
        {
            var kind = blocks[i].Kind;
            var text = blocks[i].Text;
            var heading = "";
            var number = "";

            if (kind == "heading")
            {
                number = NumberOf(text);
                heading = HeadingOf(text);
                if (number.Length > 0) section = number;
            }

            var id = "P" + (i + 1).ToString("000");
            if (number.Length > 0 && !sectionOf.ContainsKey(number))
                sectionOf[number] = id;

            var refs = new List<SpecRef>();
            var parts = new List<SpecPart>();
            var cursor = 0;
            foreach (var (refText, refNumber, start, end) in FindReferences(text))
            {
                /* A reference to a section the document does not have
                   stays as the words it was written with. */
                if (!sectionOf.TryGetValue(refNumber, out var target)) continue;
                if (start > cursor) parts.Add(new SpecPart(text.Substring(cursor, start - cursor), "", ""));
                parts.Add(new SpecPart("", target, refText));
                refs.Add(new SpecRef(refText, target));
                cursor = end;
            }
            if (cursor < text.Length) parts.Add(new SpecPart(text.Substring(cursor), "", ""));

            paragraphs.Add(new SpecParagraph(id, kind, section, heading,
                parts.ToArray(), refs.ToArray(), kind == "table" ? TableRows(text) : Array.Empty<string[]>()));
        }

        return paragraphs;
    }

    /// <summary>
    /// What kind of block this is.
    /// </summary>
    private static string KindOf(List<string> lines)
    {
        var first = lines[0].TrimStart();
        if (first.StartsWith("#", StringComparison.Ordinal)) return "heading";
        if (first.StartsWith("|", StringComparison.Ordinal)) return "table";
        if (first.StartsWith("```", StringComparison.Ordinal)) return "code";
        if (first.StartsWith("- ", StringComparison.Ordinal) ||
            first.StartsWith("* ", StringComparison.Ordinal) ||
            first.StartsWith("1. ", StringComparison.Ordinal)) return "list";
        return "text";
    }

    /// <summary>
    /// The section number a heading carries: "## 15. State and Aggregate
    /// Invariants" is section 15; "### 6.2 Roles" is section 6.2.
    /// </summary>
    private static string NumberOf(string heading)
    {
        var i = 0;
        while (i < heading.Length && heading[i] == '#') i++;
        while (i < heading.Length && heading[i] == ' ') i++;
        var start = i;
        while (i < heading.Length && char.IsDigit(heading[i])) i++;
        if (i == start) return "";
        var number = heading.Substring(start, i - start);
        if (i < heading.Length && heading[i] == '.')
        {
            var after = i + 1;
            var k = after;
            while (k < heading.Length && char.IsDigit(heading[k])) k++;
            if (k > after) number += "." + heading.Substring(after, k - after);
        }
        return number;
    }

    /// <summary>
    /// The heading's text, without its number: "### 6.2 Roles" is "Roles".
    /// </summary>
    private static string HeadingOf(string heading)
    {
        var i = 0;
        while (i < heading.Length && heading[i] == '#') i++;
        while (i < heading.Length && heading[i] == ' ') i++;
        while (i < heading.Length && char.IsDigit(heading[i])) i++;
        if (i < heading.Length && heading[i] == '.')
        {
            i++;
            while (i < heading.Length && char.IsDigit(heading[i])) i++;
        }
        return heading.Substring(i).Trim();
    }

    /// <summary>
    /// The references a text makes: every "§6.2" it writes, with the
    /// section number it names.
    ///
    /// Scanned, not matched: the document writes its references in a
    /// handful of shapes, and a page that recognised them by pattern
    /// would be guessing at what a piece of text means.
    /// </summary>
    private static List<(string Text, string Number, int Start, int End)> FindReferences(string text)
    {
        var found = new List<(string, string, int, int)>();
        for (var i = 0; i < text.Length; i++)
        {
            if (text[i] != '§') continue;
            var j = i + 1;
            while (j < text.Length && text[j] == '§') j++;
            var start = j;
            while (j < text.Length && char.IsDigit(text[j])) j++;
            if (j == start) continue;
            var number = text.Substring(start, j - start);
            if (j < text.Length && text[j] == '.')
            {
                var after = j + 1;
                var k = after;
                while (k < text.Length && char.IsDigit(text[k])) k++;
                if (k > after) { number += "." + text.Substring(after, k - after); j = k; }
            }
            found.Add((text.Substring(i, j - i), number, i, j));
            i = j - 1;
        }
        return found;
    }
}
