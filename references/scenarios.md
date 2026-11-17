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

---

## scenario: a brief that leads with the gap list

**Trigger.** The run finishes and every gate is green, but the model holds
far fewer lifecycles than the source describes — a machine or two where the
source's own headings enumerate five.

**Decision.** The brief caused it, not the skill. A brief that opens
"close these gaps" tells the child the list IS the scope; it satisfies the
list and never surveys the source.

**Action.**
1. Re-brief with the SURVEY first and the gap list second: find every
   lifecycle the source describes, give each one a machine, a state, or a
   stated reason it is not one — then close the gaps the survey turned up.
2. Say what a complete run looks like, in the source's own words: the
   section headings and stage tables enumerate what the source describes,
   and each enumerated thing must be accounted for.
3. Report the count beside the gate results. "Every gate passes" and "the
   analysis is as complete as the source allows" are different claims, and
   only the second is what was asked for.

**Why it exists.** The gates check CONSISTENCY — well-formedness, resolved
expressions, resolved identifiers, accounted table rows. None of them
counts lifecycles against lifecycles, so a thin model passes them. The
count is the reader's to make.

---

## scenario: the assembled file is disposable

**Trigger.** The deliverable is missing, empty, or was written by a run
that stopped mid-assembly.

**Decision.** Rebuild from the fragments before running the analysis again.

**Action.**
1. Look for the fragments: the run's per-key files under the scratch
   directory, one file per top-level key, and the small script that
   assembles them in the contract's key order.
2. Re-run the assembly over the fragments that are there, and check the
   result against the contract before doing anything else.
3. Re-run the analysis only for the keys the fragments do not cover.

**Why it exists.** The assembled file is a build output; the fragments are
the work. A run that stopped mid-assembly has not lost the analysis, and
re-running it to get the file back is the slowest way to recover it.
