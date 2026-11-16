# Evidence, Inference, and Traceability

## Classification vocabulary

| Label | Meaning | Required treatment |
|---|---|---|
| EXPLICIT | Directly stated | Cite the registered source ID and precise locator |
| INFERRED | Derived from source statements | Cite every supporting source ID and explain reasoning |
| CANDIDATE | Plausible but unconfirmed | State alternatives and ask a question |
| CONFLICTING | Evidence disagrees | Cite each conflicting source separately and show impact |
| UNSPECIFIED | Needed information is absent | State which sources/areas were reviewed; do not fill the gap by assumption |

## Mandatory source IDs — no exceptions

Every supplied source specification/document MUST be assigned a unique ID in the exact format `SRC-001`, `SRC-002`, `SRC-003`, and so on. This is compulsory for every source reference in the entire deliverable.

- The Source Inventory is the authoritative registry mapping each `SRC-###` to exactly one document.
- Every citation in prose, tables, diagrams, state definitions, transitions, invariants, scenarios, contradictions, and traceability records must include the registered ID.
- Never cite a filename, document title, section, page, requirement ID, paragraph, table, or row by itself. Always prefix the locator with the registered source ID.
- Required syntax: `[SRC-001]`, `[SRC-001, §2.4, p. 17]`, or `[SRC-001, PAR-014]`.
- Paragraph locators MUST use the identifier format `PAR-001`, `PAR-002`, etc. Assign IDs sequentially in reading order within each source document to paragraphs used as evidence; keep the mapping stable and scoped by the source ID. Thus `[SRC-001, PAR-014]` identifies a paragraph in source `SRC-001`.
- Never use the paragraph glyph as a citation locator. Replace it with the appropriate `PAR-###` identifier. If paragraph identity is uncertain, cite a reliable section/page/requirement locator or the `SRC-###` ID alone; do not guess.
- Multiple sources: `[SRC-001, §2.4; SRC-002, Requirement REQ-17]`.
- If the locator is unknown or unavailable, cite the ID alone. Never invent a locator.
- A filename may appear as descriptive metadata in the Source Inventory, but every reference to its evidence must use its `SRC-###` ID.
- Allocate IDs once, keep them stable across iterations, and never reuse an ID for another source.
- Blank templates may show `SRC-###` as a placeholder. Completed deliverables must use real registered IDs.

## Source inventory

| Source ID (`SRC-###`) | Document / File | Version / Date | Scope / Relevant Sections | Authority / Notes |
|---|---|---|---|---|
| SRC-001 | [document name] | [version/date] | [scope] | [notes] |

## Citation examples

- Explicit statement: “A request may be cancelled before approval. [SRC-001, PAR-014]”
- Inference: “The case returns to Draft after withdrawal, inferred from the withdrawal rule and resubmission flow. [SRC-001, §4.2; SRC-002, §3.1]”
- Conflict: “The sources disagree on whether approval is reversible. [SRC-001, §5.3; SRC-002, §7.1]”
- Unspecified: “No retry policy is specified in the reviewed lifecycle requirements. [SRC-001, §§4–6]”

## Traceability matrix

| Finding ID | Finding Type | Finding Summary | Classification | Source IDs (mandatory `SRC-###`) | Inference Rationale | Open Question |
|---|---|---|---|---|---|---|

## Inference discipline

An inference should show:
1. The source facts used, each cited with its registered `SRC-###` ID.
2. The reasoning connecting those facts.
3. The conclusion.
4. Alternative interpretations, if material.
5. What stakeholder confirmation is needed.

Never cite a source as saying more than it actually says. Do not invent source IDs, section numbers, requirement IDs, page numbers, or quotations.

## Multiple sources

Record version, authority, and date in the Source Inventory. If documents disagree:
- Preserve both claims and cite each with its own `SRC-###` ID.
- Identify whether one source is newer or more authoritative only when evidence supports it.
- Explain which model elements are affected.
- Raise a stakeholder question rather than silently choosing.

## Final validation gate

Before delivery, scan all content for source references. Confirm that every source is registered as `SRC-###`; every source-based claim and evidence cell cites one or more registered IDs; every locator is attached to an ID; paragraph locators use `PAR-###` (never the paragraph glyph); every cited ID exists in the Source Inventory and maps to the correct document; and no fabricated IDs or locators appear. Correct any failures before calling the deliverable complete.
