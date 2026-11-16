# Evidence, Inference, and Traceability

The deliverable is one JSON file. Every record in it carries an `evidence` array, and
every record that is not directly stated carries a `classification` and a `rationale`.
This file states what those fields mean and what they must contain.

## Classification vocabulary

The `classification` field of a record is one of these five values, and no other:

| Value | Meaning | Required treatment |
|---|---|---|
| `EXPLICIT` | Directly stated | Cite the registered source ID and precise locator |
| `INFERRED` | Derived from source statements | Cite every supporting source ID and explain the reasoning in `rationale` |
| `CANDIDATE` | Plausible but unconfirmed | State alternatives and ask a question |
| `CONFLICTING` | Evidence disagrees | Cite each conflicting source separately and show the impact |
| `UNSPECIFIED` | Needed information is absent | State which sources/areas were reviewed; do not fill the gap by assumption |

A machine's `classification` is an object with `states` and `transitions`, each one of
the five values — a machine's state set and its transitions are often established to
different degrees.

## Mandatory source IDs — no exceptions

Every supplied source specification/document MUST be assigned a unique ID in the exact
format `SRC-001`, `SRC-002`, `SRC-003`, and so on. This is compulsory for every source
reference in the entire deliverable.

- The `sources` array is the authoritative registry mapping each `SRC-###` to exactly one
  document.
- Every record in every array must carry an `evidence` array naming the registered IDs.
- Never cite a filename, document title, section, page, requirement ID, paragraph,
  table, or row by itself. Always carry the registered source ID beside the locator.
- A citation is an object: `{ "source": "SRC-001", "locator": "§2.4" }`, or
  `{ "source": "SRC-001", "locator": "PAR-014" }`.
- Paragraph locators MUST use the identifier format `PAR-001`, `PAR-002`, etc. Assign
  IDs sequentially in reading order within each source document to paragraphs used as
  evidence; keep the mapping stable and scoped by the source ID, and record each one in
  `sourceLocatorRegister`.
- Never use the paragraph glyph as a citation locator. Replace it with the appropriate
  `PAR-###` identifier. If paragraph identity is uncertain, cite a reliable
  section/page/requirement locator, or `locator: null`; do not guess.
- Multiple sources: one citation object per source, in the `evidence` array.
- **Section ranges are prohibited.** Never compress several sections of one source into
  a single locator — `§§4–6`, `§4–§6`, or `§4, §5, §6` behind one ID. Cite each
  section separately, each in its own citation object: `{ "source": "SRC-001",
  "locator": "§4" }`, `{ "source": "SRC-001", "locator": "§5" }`, `{ "source": "SRC-001",
  "locator": "§6" }`. A range hides which document each cited section belongs to, and a
  comma already separates locator kinds (`§2.4, p. 17`), so a comma-separated list of
  sections cannot be read unambiguously.
- If the locator is unknown or unavailable, the locator is `null`. Never invent one.
- A filename may appear as descriptive metadata in a `sources` record, but every
  reference to its evidence must use its `SRC-###` ID.
- Allocate IDs once, keep them stable across iterations, and never reuse an ID for
  another source.

## The `sources` array

```json
{
  "id": "SRC-001",
  "document": "Customer Onboarding — Functional Spec",
  "version": "2026-03",
  "sections": ["§1", "§2", "§3"],
  "authority": "the customer's own specification",
  "notes": "the only supplied source"
}
```

`sections` is an array of the sections of THAT source, one per element. A range is
never one element: `["§1", "§2", "§3"]`, never `["§§1–§3"]`. A reader cannot tell a
range apart from a single section, and the array is the one place where several
documents' section numbers sit side by side.

## The `sourceLocatorRegister` array

Every `PAR-###` used as a locator, and where it sits:

```json
{ "source": "SRC-001", "locator": "PAR-001", "where": { "section": "§2.1", "openingWords": "The onboarding process begins" } }
```

## Citation examples

An explicit statement:

```json
"evidence": [ { "source": "SRC-001", "locator": "PAR-014" } ]
```

An inference, across two sources:

```json
"evidence": [
  { "source": "SRC-001", "locator": "§4.2" },
  { "source": "SRC-002", "locator": "§3.1" }
]
```

A conflict:

```json
"evidence": [
  { "source": "SRC-001", "locator": "§5.3" },
  { "source": "SRC-002", "locator": "§7.1" }
]
```

## The `traceability` array

```json
{
  "id": "TR-001",
  "type": "invariant",
  "summary": "the owner is set on first submission",
  "classification": "INFERRED",
  "sourceIds": ["SRC-001"],
  "rationale": "the owner is named in §8.1 and §8.2 but never stated as a precondition",
  "openQuestion": "Q-004"
}
```

`sourceIds` holds registered IDs and nothing else — never a locator, never a name.

## Inference discipline

An inference shows its work, in the record's `rationale`:
1. The source facts used, each cited with its registered `SRC-###` ID.
2. The reasoning connecting those facts.
3. The conclusion.
4. Alternative interpretations, if material.
5. What stakeholder confirmation is needed — the id of a `questions` record.

Never cite a source as saying more than it actually says. Do not invent source IDs,
section numbers, requirement IDs, page numbers, or quotations.

## Multiple sources

Record version, authority, and date in the `sources` array. If documents disagree:
- Preserve both claims and cite each with its own `SRC-###` ID.
- Identify whether one source is newer or more authoritative only when evidence supports it.
- Explain which model elements are affected, in the record's `rationale`.
- Raise a stakeholder question rather than silently choosing.

## Final validation gate

Before delivery, scan the file for source references. Confirm that every source is
registered as `SRC-###`; every record carries an `evidence` array; every citation is an
object with a registered `source` and a `locator` that is either null or a real
locator; paragraph locators use `PAR-###` (never the paragraph glyph); no citation
compresses several sections of one source into a range; every cited ID exists in
`sources`; every `classification` is one of the five values; and no fabricated IDs or
locators appear. Correct any failures before calling the deliverable complete.
