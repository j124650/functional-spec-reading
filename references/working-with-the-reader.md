# Working with the reader

These rules govern **the conversation**, not the model. A run that produces a deliverable
never consults them; an assistant working with a person does, and they are why this
skill has a `references/` folder at all.

They were moved out of the skill's own body for a measured reason: a run paid for them.
A run that read the whole skill spent ten minutes and twenty-six tool calls reading
before its first record, and the largest share of what it read was advice about how to
talk to a person.

---

## Pitfalls: the conversation

Each one was paid for.

- **A record's heading is not always numbered like its section.** A document that
  puts its scenarios under `### SCN-001 — …` while its other headings carry a
  section number (`### 7.1 AGG-001 — …`) defeats a parser whose heading regex
  requires a digit-led number: the scenario heading never enters the branch that
  collects it, and the series comes back EMPTY with no error anywhere — a missing
  series that a catalogue check then reports as a series the export omitted.
  Match each heading on the shape it actually has — the id pattern, the section
  number, or both — rather than on the one the first example used. Check a
  collected series for being empty before believing it was absent from the
  document.

- **Re-read what you already have before you build a reader.** When a request names a
  column or a field ("show the evidence texts from the Evidence column"), the text is
  usually already in the artifact you built, and the citation in that cell points at
  section text sitting in the extract you already parsed. Writing a second extractor
  for the source format duplicates a source of truth and is work the task never asked
  for. Reach for the file you have, then for the extract you already made, and only
  then consider parsing the original.

- **Read the region you are about to change; do not survey the file to re-derive what
  you already know.** When the artifact's format is fixed by rules you have read, a
  grep that re-establishes what the file contains returns nothing and costs a turn.
  Read the lines the next edit touches — `read_file` with an offset — or the whole file
  once when it is small, then act on what you read.

- **When the reader redirects a placement, offer concrete options in ONE question.**
  "I want to place them differently" names a decision, not an answer — guessing the
  intended arrangement costs a rebuild and then a correction. Give three or four
  concrete placements in a single question, each a sentence saying where the thing
  lands and what the reader sees, so one reply settles it. Rebuilding to the first
  plausible reading is the expensive way to ask the same question.

- **Answer the question that was asked.** A question about the workflow, the method, or
  what a deliverable looks like is answered by the method — not by building the thing.
  When the reader asks "what are we developing?", answer that; do not start writing
  scaffolding. When they ask how to invoke this in a fresh session, give the invocation
  and stop.
  **The frame the reader states narrows the question.** "We are talking about the
  contract" is not one topic among several — it IS the question. An answer that works
  on a different layer (a different file, a different phase, a different design) reads
  as not having heard them, and costs a turn to be told. Take the frame as the
  question, answer inside it, and put anything outside it in one line or not at all.
  **Deliver the shape that was asked for.** A request for a list gets a list — items, one
  line each, grouped under the headings that organise them, with no paragraphs arguing
  the case around them. A request for a plan gets steps; a request for a feasibility
  answer gets a measured fact and its named consequence. The shape is part of the ask,
  and prose wrapped around a list reads as padding an answer the reader did not want.

- **Execute the agreed plan instead of re-deriving it.** Once the reader has approved a
  plan, the remaining turns are that plan's steps — not a fresh analysis of whether it
  is still the right plan. Restating it, asking which step comes first, or announcing
  what the next step will be reads as looping and spends the budget the execution
  needs. When the budget is tight, spend what is left on the fix and its verification:
  a summary describing an unexecuted plan is worth less than one line of state.
  **The reconnaissance is spent, not renewed.** The reads that informed the
  questions are the reads; answering the questions does not invalidate them. A
  turn that re-opens files already read — to re-confirm a signature, re-check a
  shape, re-establish what a file holds — spends a step of the implementation and
  reads as hesitation to a reader who asked for the work and is watching it not
  start. When the answers name the shape, the next action is the edit.

- **One task at a time, and finish the one you were given.** When the reader narrows
  the ask — "one task at a time", "fix the verifier", "verifier first, then the UI" —
  that narrowing is the plan. Do not start the next task while the current one is
  unfinished, and do not widen the current one to include it. A half-finished
  verifier plus a half-built page is two broken things instead of one finished one,
  and the reader has to re-establish which of them is actually in progress.
  **And when the named task IS finished, stop and wait for the next instruction.**
  Rolling into the improvement you spotted instead of delivering the ask makes the
  reader interrupt you to get the thing they asked for; state what landed, what is
  verified, and what is deliberately not committed, then wait.
  **An operational instruction is executed literally, on the next call.** "Regenerate
  the UI", "commit", "run the tests", "rebuild" — the command is known, so run it and
  report what it returned. Do not spend turns reading adjacent files to decide what
  else the instruction might license, and do not fold a self-assigned improvement
  it: a rebuild that becomes a feature plan is a rebuild the reader did not ask for,
  and the drift surfaces as the reader asking why you are stuck.
  **And a terse reply to YOUR question is an answer only when it names the question.**
  "Regenerate the UI" after you asked "implement these six promises, or weaken the
  contract?" is an instruction to regenerate — not a decision to implement. The reader
  answers in the register they use for instructions, and an instruction that names an
  action is that action. Read it as what it says, and put the still-open question back
  in one line rather than inferring an approval that was never given.

- **A blocked task is a blocker to name, not a reason to re-plan.** When the current
  task cannot proceed, say what blocks it and what would unblock it, and stop. Do not
  start a neighbouring task, re-derive the architecture, or widen the scope to fill
  the gap — each reads as derailing, and the reader asked for one task because the
  budget only covers one.

- **Stop the background work when the reader says stop.** A dispatched reviewer,
  corrector, or helper keeps running and keeps spending budget after the reader
  has said to stop or to narrow the task. Stop what is running, and say what you stopped.
  A subagent that completes after the task was narrowed returns a result nobody
  asked for, and folding it in re-opens settled ground. **And stop the reconnaissance,
  not only the background jobs.** A restatement of the task after a stop is a narrowed
  plan, not permission to resume the wider sweep that was interrupted: the narrower ask
  is the whole remaining work, and everything outside it waits its turn.

- **Ground a design proposal in a measurement, and answer the feasibility question with
  facts.** When the reader asks whether something is possible — "explain me is it
  possible", "what needs to be done" — the answer is a measured fact and a named
  consequence: the size of the export, the count of records a view would have to
  render, the field that is missing, the number of places a list is written down. Not
  a menu of architectures with invented names for the options, and not a preference
  dressed as a finding. A proposal whose premises are assumed reads as invention, and
  the reader spends a turn telling you which invented parts to drop. Measure first —
  read the shape of the data, count what is in it, and let the constraint choose the
  design; then state the design as a decision with its cost.

- **Do not report a fact you have not verified, and do not dress a guess as a
  finding.** A claim that a document's cell is truncated, that an expression is
  malformed, that a state count is too low — each needs the mechanism shown. When a
  diagnostic tool reports a discrepancy, check the tool before you believe it: a
  splitter that treats every `|` as a cell boundary will "prove" a healthy row is
  corrupt, and reporting that costs the reader a rewrite of a correct document. Say
  what you checked and what it showed. **Verify the tool's own output before
  concluding the tool is wrong too**: a naive cell splitter reports a row as
  truncated when the row simply contains the language's `||`, and believing it sends
  you to repair a correct document. Dump the raw bytes of the suspect cell and read
  them before naming a defect.

- **Price written-but-unrun code as written, not as working.** When asked how far
  along a build is, an honest percentage discounts code that has never been compiled
  or executed, and says so — the reader is budgeting the remaining work, and a number
  that counts unrun code as done is a number that misleads them. Give the percentage,
  the per-component breakdown, and the discount with its reason in one line each; a
  reader who needs the detail can ask for it. Do not round up to reassure, and do not
  hide the unrun work behind a summary that reads as finished.

- **Do not report a defect you already know how to fix.** Finish the fix and re-verify
  it, then report. A report that names a known defect and hands it back to the reader
  is a delivery in name only, and it reads as "the work stopped here" — the reader
  then has to ask for the rest. If a defect genuinely needs a decision the user has
  not made, say so and ask; but a defect whose fix you are already holding is yours
  to finish before you summarise. And say it the moment you find it: a defect you
  noticed and stayed silent about is a defect you chose to ship.

- **A summary that says "X is still wrong" is an unfinished task, not a report.** When
  you know the next command and the next file, the work is not done — the reader is
  paying for the fix, not for a map of it. End the turn with the change landed and
  verified. When the budget genuinely runs out mid-fix, name the one command that
  continues it, so the next turn starts from the fix rather than from the diagnosis.
  **A feature that spans layers is delivered in all of them or not delivered.** When
  the ask spans the engine, the export and the page, building the engine half and
  listing the page half under "what remains" is a partial delivery wearing a
  summary's clothes: the reader has to ask for the rest, and the next turn opens by
  rebuilding the context for work that was already agreed.

- **Re-dispatch a failed child on the default model; do not repair the user's global
  config inside the task.** A delegated child that dies on a provider error is fixed
  by re-dispatching it unpinned. Editing the agent's own provider chain is a change
  to the user's environment, outside the task's scope — flag it and let them decide.

- **Never end a turn silently when the tool budget runs out.** Name the file, the error,
  and what is left. A silent stop reads as "done" and hides a broken artifact the user
  cannot see — they will find it themselves and stop trusting the rest of the report.
  When a rework lands halfway, say plainly which parts are wired up and which are not,
  and say if the artifact is currently broken. **End with the next command, not with a
  summary of the plan** — "here is what is broken" without "here is the command that
  fixes it" still leaves the reader choosing, and a restated plan reads as a stop.

- **Apply the known fixes together, then rebuild and test once.** When several defects
  are already diagnosed, patching them one at a time and re-running the whole build
  between each spends the budget on repetition and leaves the artifact unverified when
  it runs out. Batch the independent edits into as few passes as the tooling allows,
  then rebuild, re-export and re-test once. The corollary: a status-only turn — one
  that reports what is broken without changing anything — costs a turn and delivers
  nothing, so when the next command is known, run it.

- **Check whether the deliverable is still current against its source.** An artifact
  rebuilt from hand-entered numbers drifts from the model the moment the model changes.
  Compare timestamps and the figures themselves before reporting that the deliverable
  reflects the latest analysis — the question "is this based on the most recent data?"
  deserves a real check, not an assurance.
  **The deliverable must not misdescribe the analysis that produced it.** The document
  states its own coverage — what was checked, what was found, what the model could not
  reach — and those statements are claims like any other. A document that says no
  executable model was built, or quotes a figure from an earlier run, tells the reader
  something false about the very artifact they are holding, and no checker compares the
  document's self-description against the instrument.

- **The skill's own rules live in a repository; commit them there.** When a skill's
  references, templates or scripts are changed, the change belongs in the skill's
  repository, committed and pushed — not only in the local profile directory, where a
  reinstall or a curator pass discards it and no diff survives. Check the repository
  before concluding that a skill is unversioned: a local `git` probe that finds no
  repository says nothing about a remote that holds it. The installed copy and the
  clone drift apart, so diff them before pushing and carry the changes across — and
  diff on CONTENT, not on bytes: a checkout and an installed copy can disagree on
  line endings alone, which reports every file as changed and hides a real edit in
  the noise.

---

## Running a reviewer and a corrector

When the reader asks for a review, two child agents are useful: one that finds the
problems, and one that applies the corrections. The rules below are how that goes
wrong, and they were paid for.

**When the reviewer has already found something, hand the corrector the findings, not
the raw critic.** The second agent's job is to APPLY the corrections, so it should
receive: the specific finding IDs with their subjects, the authoritative list of IDs
that exist (so it repoints a reference instead of inventing one), the verified numbers
already computed, and the instruction not to re-derive them. A corrector told to
"check the numbers first" will spend its whole budget re-running the harness, and will
poll a long command waiting for a state change that already happened — then die with
nothing written. Give it the numbers, name the output file it should read, and say
plainly that the data is already computed.

**Give each corrector a disjoint set of files.** Two agents editing the same document
overwrite each other's work. Split the documents across agents, and tell each agent
which files are off-limits.

**State the environment's hard constraints in the brief.** A child agent inherits
neither your memory nor your profile, so a constraint you hold as standing knowledge
— this language is unavailable here, that directory is out of bounds — is invisible
to it unless the brief says so. A child that quietly writes its helper scripts in a
prohibited language has produced work the reviewer cannot run, and the porting lands
on you. Put those constraints in the brief as rules, not as hints, and check the
child's output against them before folding it in.

**Dispatch the corrector on the default model unless there is a reason not to.** A
pinned model that the provider has withdrawn fails the child with a provider error
rather than anything to do with the task, and the child's output is lost. If a
delegated agent dies on a provider error, the fallback chain is the first thing to
check — a chain entry pointing at a model the provider no longer serves turns any
transient error into a fatal one.
