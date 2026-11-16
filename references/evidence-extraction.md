# Evidence extraction

Getting the spec's text into a form you can cite, quote, and grep — without losing the
ability to point a reader at the exact place a rule lives.

## 1. Convert the input to Markdown

**Use the conversion skill. Do not hand-roll an extractor.**

**Default instruction set: [`github/awesome-copilot`](https://github.com/github/awesome-copilot)
(41k stars), Microsoft's own.** Install the skill for the input format:

| Input | Skill |
|---|---|
| `.docx` | `convert-word-to-md` |
| `.pdf` | `convert-pdf-to-md` |
| `.xlsx` | `convert-excel-to-md` |

```
manage_catalog install convert-word-to-md convert-pdf-to-md convert-excel-to-md
```

Then run **the skill's own script** — it wraps MarkItDown and writes a
self-contained folder next to the source: `<name>.md`, plus `img/` when the
document has embedded images.

**Setup (once per environment).** The skill needs Python 3.10+ and `markitdown`.
The Hermes venv has no `pip`; use `uv` and an isolated environment:

```bash
uv venv "$TMPDIR/mdvenv" --python 3.12
uv pip install --python "$TMPDIR/mdvenv/Scripts/python.exe" "markitdown[docx]>=0.1.0"
"$TMPDIR/mdvenv/Scripts/python.exe" <skill>/scripts/convert_word_to_md.py "input.docx"
```

**Build the venv in the scratch directory, not in the working directory.** A bare
`uv venv mdvenv` creates the environment in the shell's current directory — beside the
source document and, later, the deliverable — where a large toolchain directory reads as
part of the output. Name an explicit scratch path and remove it when the conversion is
done.

**Output location:** the script's default is next to the source file, and that is
the required default. Only pass `-o` when the user explicitly names a destination.

**Mixed input types:** when the input is a folder containing `.docx`, `.pdf` and
`.xlsx`, invoke ALL THREE sibling skills — never let a file type be silently
skipped.

## 2. Why the skill, and not your own unzip-and-strip

The converted Markdown carries the document's structure, which is what the
analysis needs:

- **headings** — `## 4. Pass 1 - Sales entry (Draft)`, `### 4.2 Rules`. The
  section number is in the heading, so `§4.2` is a heading match, not a guess.
- **lists** — enumerations stay enumerations instead of becoming loose lines.
- **tables** — a spec's stage table becomes a real Markdown table:

```markdown
| Stage (shown) | ID | Held by | Who can edit | How it gets there |
| --- | --- | --- | --- | --- |
| Draft | 10 | Sales (and customer if a link was sent) | Sales, customer | Created; or Sales unsubmits |
```

A hand-rolled extractor flattens that table into one loose word per line. **A
spec's tables are evidence** — flattened, they are unreadable and uncitable.

**Check the conversion is faithful before building on it:**

```bash
grep -c '^##' converted.md         # does every section have a heading?
grep -n '^|' converted.md | head   # are the tables real tables?
head -20 converted.md              # does it start at the title?
```

**When you need the raw XML anyway** — to recover something the converter drops,
or to confirm the conversion is faithful:

```bash
unzip -p "file.docx" word/document.xml \
  | sed -e 's/<w:p [^>]*>/\n/g' -e 's/<w:p>/\n/g' -e 's/<w:tab\/>/\t/g' -e 's/<w:br\/>/\n/g' \
        -e 's/<[^>]*>//g' \
  | sed -e 's/&amp;/\&/g' -e 's/&lt;/</g' -e 's/&gt;/>/g' -e 's/&quot;/"/g' \
  > raw-extract.txt
```

This is safe for **reading**. It is not safe for **editing** — raw text substitution in
`document.xml` corrupts files. Never write to the `.docx` this way; edit through the
`docx` skill's scripts.

**The raw extract is a fallback, not the source.** It is flat: a table arrives one
cell per line, so a line number is not a paragraph number and a citation built on it
lands on the wrong text. When the converted Markdown already carries the document,
quote the Markdown.

## 3. Find the place a phrase comes from

You will quote the spec repeatedly. **Cite the document's own section numbers**
(`§3`, `§4.2`) — the headings give them directly, and they are what the author
wrote and the team will use. Line numbers drift when the document is reconverted,
so keep them as a private lookup only.

To get from "the phrase I want to quote" to "where it is", search the **converted
Markdown** for distinctive phrases. Choose phrases that are **long and unusual** — a
full clause beats a common word, which matches everywhere:

```bash
# one distinctive phrase at a time; the converted Markdown is the haystack
grep -n -F "The aging clock starts at the first submit" converted.md
```

**Anchor on the claim, not the sentence.** For "the clock starts at the first submit and
never resets", search `The aging clock starts at the first submit` — that phrase is
unique and carries the rule.

**Do not keep a separate anchors file.** A list of phrases to look up is a second
copy of the document's vocabulary, and it drifts from the Markdown the moment the
spec is re-converted. Search the Markdown directly; the section number you already
have is the better key.

**Cite the document too, not only its section — always, in every cell.** A section
number on its own names a section of no particular document: the analysis you are
writing has its own sections, and they overlap the source's. Write the source id
from your source inventory with the section, inside brackets:

```
[SRC-001, §6.3]
```

A citation that names its document can be resolved by that id; a bare `§6.3`
can only be guessed at.

**A paragraph of the source is located by `PAR-###`.** Give the paragraphs you
cite ids in reading order within that source document — `PAR-001`, `PAR-002`, … —
keep the mapping stable, and write the citation as `[SRC-001, PAR-014]`. The
paragraph glyph is not a locator: a reader cannot follow it and a tool cannot
resolve it. If a paragraph cannot be reliably identified, cite the source id and
another locator — `[SRC-001, §6.3]` — rather than guessing.

**The document named is the specification.** The evidence for a claim is what
the specification says — never what the analysis concluded from it. If a cell
would point at the analysis itself, it is not evidence: name the thing the
analysis issued an id for instead.

**The format is not a preference.** The prompt states it once, in §1.1, and every
field that asks where a thing came from — an `evidence` array, a source's `sections`,
the `section` of a role-rewritten rule — uses it. A file that cites by id in one place
and by number in another has two kinds of citation, and the half that names no
document is the half nobody can resolve.

## 4. Quote exactly, and never wider than the text

Copy the sentence. Do not paraphrase a rule into a stronger claim than it makes:

| The spec says | You may write | You may NOT write |
|---|---|---|
| "the owner is emailed" | the owner is emailed | the owner is notified of every event |
| "Licensing corrects the legal name" | Licensing may rename the legal name | Licensing may rename anything |
| "the default owner (Blanca)" | the default owner, currently Blanca | the owner is Blanca |

Where the document is **silent**, write "unstated" and treat it as a finding in its own
right. A named hole is more useful to the team than a plausible guess, and it is the
honest description of the evidence you have.

## 5. Separate the two kinds of silence

They need different remedies and must not be merged:

- **Contradicted** — two sections prescribe different outcomes for the same event. The
  spec has a bug. Remedy: pick a reading, amend the spec.
- **Unstated** — the spec never addresses it. The spec has a hole. Remedy: decide it,
  add the rule.

Label every finding header with which one it is. Conflating them produces fixes that
patch the wrong sentence.

## 6. Diff "required" markers against the validation list

A mechanical check that finds real holes every time:

1. Collect every field, value, and rule the document marks **required** (or "must", or
   "exactly one", or "at least one").
2. Collect the list the document says is **validated** at the gate.
3. Subtract. The difference is a field that can be absent at the moment the spec says it
   cannot be.

Do this for every gate the spec defines, not just the first one. A spec commonly has a
submission check, an approval check, and a notification precondition, and validates
different things at each.

## 7. Cross-read one concept across every section

The prose sections were written independently, so nobody checked them against each other.
For each important concept (the clock, the owner, the link, the approval) — grep it and
read **every** hit, not the first. That is where contradictions live.

```bash
grep -n -i -E "clock|aging" converted.md
```

## 8. Diff the spec's own worked examples against its rules

An example in the document that breaks the document's own rule is a real finding, not a
cosmetic one — the example is what an implementer copies. Take each example and hold it
against the rule it illustrates.

## 9. Keep the extract and the deliverable together

Store the converted Markdown next to the analysis so a reviewer can check any quote
without re-deriving it, and state in the deliverable which conversion it was built
from (filename + version of the document, and the skill that produced the Markdown).
The deliverable is not verifiable if the reader cannot find the thing being quoted.
