# Incorporating a published reference work

How to get quotable, structurally parseable text out of a published book, paper,
or standard — and to keep the licence attached to it.

## When this applies

The task needs text from a published work that must be **quoted** (an authority
for a definition) or **parsed structurally** (a pattern catalogue, a glossary).
The document arrives as a PDF attachment.

This is a distinct step from converting a *specification*. A specification's
structure is the analysis substrate; a reference work is quoted, so the
obligation is fidelity plus attribution.

---

## Order of operations

### 1. Look for the upstream source before you parse the PDF

Published books frequently have a public **typesetting source** repository — the
files the book was built from, in a markup format (`*.dj` JSMDoc, `*.asciidoc`,
`*.tex`, `*.md`). The source is strictly better than any PDF text layer: real
headings, real section boundaries, no mangled spacing, and a stable file
structure to parse.

Check before converting:

```bash
# list the repo's files
curl -s "https://api.github.com/repos/<owner>/<repo>/git/trees/main?recursive=1"

# fetch the raw content of each source file
curl -s "https://raw.githubusercontent.com/<owner>/<repo>/main/<path>" -o <file>
```

The PDF is the *rendering*; the repo is the *document*. When both exist, use the
repo for structure and quote the PDF's pagination only if the deliverable needs
page numbers.

A repo README usually states the licence and the original source — read it
before quoting.

### 2. Convert the PDF only if there is no source

Use the bundled conversion skill (`convert-pdf-to-md`). It needs
`markitdown` plus `pymupdf`:

```bash
uv pip install --python mdvenv/Scripts/python.exe "markitdown[pdf]" pymupdf
mdvenv/Scripts/python.exe <skill>/scripts/convert_pdf_to_md.py "book.pdf"
```

### 3. Repair the text layer

A PDF text layer is typeset, not logical. MarkItDown's output can carry all of:

| Artefact | What to do |
|---|---|
| Inter-word `U+00A0` (non-breaking space) | replace with a plain space **before** matching headings or words |
| Justified multiple spaces | collapse runs of two or more |
| Carriage return *inside* a line (`word\t\r word`) | split lines on `\n` only, then strip interior `\r` — splitting on `\r\n` splits one heading into three |
| Soft hyphen `U+00AD` at a line break | remove |
| TOC dot leader `.....` plus a page number | strip before matching a heading |
| Every heading appearing twice | the first occurrence is the table of contents, the second is the body — disambiguate by position relative to a known anchor, not by "first match" |

**A heading that matches nowhere is usually a TOC entry with a dot leader**, not
a section that is missing. Check that before concluding the document lacks
content.

### 4. Parse into structured data, never transcribe by hand

Write a small parser that emits JSON: one record per definition, one per
pattern. Then **generate** the reference file from that JSON with a script that
ships beside the skill. Hand-transcription cannot be regenerated, and a
reference file that cannot be regenerated drifts from its source silently.

Ship both scripts so the reference is reproducible:

```
scripts/parse-<source>.js     source files -> structured JSON
scripts/build-<reference>.js  structured JSON -> the reference file
```

### 5. Carry the licence

Check the licence before quoting, and keep it attached to the quote — author,
year, licence, source URL. A reference file that quotes a published work
without its licence and attribution is a distribution problem, not a style
problem. Where the work was reformatted by a third party, credit both.

---

## Pitfalls

- **Do not treat a converted PDF's Markdown as the document's structure.**
  MarkItDown's PDF path often yields a flat run of paragraphs with no heading
  hierarchy. If the deliverable needs sections, get them from a source repo or
  from the PDF's own outline, not from the converted text.
- **`String.match(/re/g)` returns whole matches, not capture groups.** With a
  global flag the array holds the matched substrings; index `[1]` is the
  *second match*, not the first capture. Drop the `g` flag when you want
  groups, or use `matchAll` and read the group from each entry.
- **Prefer the body copy of a heading over its table-of-contents entry.** Both
  exist, and they are not identical — the TOC carries a dot leader and a page
  number. Anchoring on position relative to a known landmark is more reliable
  than "first occurrence wins".
- **Verify the parse covered everything before generating from it.** Count the
  records the source should yield and compare against the count you got. A
  parser that silently skips a section produces a reference that looks
  complete and is missing a pattern.
- **Do not paraphrase a quoted definition.** If the reference is quoting to
  settle a meaning, paraphrase changes the meaning. Quote, and cite.
