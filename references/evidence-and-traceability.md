# Evidence, Inference, and Traceability

## Classification vocabulary

| Label | Meaning | Required treatment |
|---|---|---|
| EXPLICIT | Directly stated | Cite the source location |
| INFERRED | Derived from source statements | Cite all relevant evidence and explain reasoning |
| CANDIDATE | Plausible but unconfirmed | State alternatives and ask a question |
| CONFLICTING | Evidence disagrees | Show both statements and impact |
| UNSPECIFIED | Needed information is absent | Do not fill the gap by assumption |

## Source references

Use the most precise available location:
- File/document name.
- Version/date.
- Section and heading.
- Requirement or use-case ID.
- Page number.
- Table and row.
- Paragraph or scenario identifier.

Assign `SRC-###` IDs and reuse them consistently.

## Traceability matrix

Recommended columns:

| Finding ID | Finding Type | Finding Summary | Classification | Source IDs | Inference Rationale | Open Question |
|---|---|---|---|---|---|---|

## Inference discipline

An inference should show:
1. The source facts used.
2. The reasoning connecting those facts.
3. The conclusion.
4. Alternative interpretations, if material.
5. What stakeholder confirmation is needed.

Never cite a source as saying more than it actually says. Do not invent section numbers, requirement IDs, or quotations.

## Multiple sources

Record version, authority, and date where available. If documents disagree:
- Preserve both claims.
- Identify whether one source is newer or more authoritative only when evidence supports it.
- Explain which model elements are affected.
- Raise a stakeholder question rather than silently choosing.
