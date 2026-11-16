# Scenarios

Runbooks for the runs that go sideways. The skill produces a 31-key JSON
deliverable; these scenarios are what you do when the run stops making
progress and starts reading instead of writing.

---

## scenario: blocking-word-count

**Trigger** (all three must be true):
- the deliverable has no new bytes written in the last two turns, AND
- the run has been going longer than 15 minutes.

**Decision.** STOP reading. Do not open another source file for this run.

**Action.**
1. Write a skeleton of the deliverable: every top-level key, the template's
   field order, `[]` for every array. Any bytes count as progress.
2. Write a one-file probe to the scratch directory that answers the one
   question blocking the first empty slot — grammar, evidence shape, the
   identifier namespace. One regex over a source, a parser scan, a JSON
   dump. Never a full-file read.
3. Read the probe back. Fill the first empty slot. Repeat.

**Exit.**
- the deliverable is at ≥ 500 bytes written, or at least one array has a
  record in it, or the run has exceeded 45 minutes. Then verify-only mode:
  run `check`, `explore`, `export`, `check-explorer.js`, `check-id-catalogue.js`
  and `check-model-expressions.js` against the deliverable, fix what fails,
  and stop adding new reads without an open slot.

**Why it exists.** Reading dilates: a 400-line parser costs ten minutes and
one byte. A skeleton never does, and the first empty slot is always filling
as the deliverable grows.
