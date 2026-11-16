# Verifying an explorer page

The check list for a page built on top of a consolidated spec analysis. It is
**conditional**: it applies only when an explorer page was actually built. The page is
an optional view of the deliverable — `references/interactive-diagrams.md` covers how to
build one; this file covers how to prove the one you built works.

Each check names a defect class it catches. A check that passes against a broken page
is measuring the wrong thing, so several of them state how to make them fail.

## Run them from a script that exits non-zero

A probe answers one question; a harness catches every view, filter and column at once
and keeps catching them after the next change.

`scripts/test-explorer-cdp.js` drives the page in headless Chrome over the DevTools
Protocol, captures uncaught exceptions and console errors, and runs a checks file:

```
node scripts/test-explorer-cdp.js <page.html> checks.js
```

It needs no dependencies — Node 22 ships global `fetch` and `WebSocket`.
**`templates/explorer-checks.js` is a starter checks file** — copy it next to the page,
adapt the selectors marked ADAPT, and run it. Writing the assertions from scratch each
time loses the ones that already caught a defect.

## The checks

1. **The page has been opened in a browser and exercised: filters, selection, sorting,
   and every panel.** A file that was written but never rendered is not verified.
   Assert a non-zero element count for every rendered view — a JS error blanks only the
   view it breaks, so the page still looks complete while one panel is empty. **Assert
   each view's count, not just its presence**: an empty findings list and a populated
   one both contain zero `<details>` elements only if the render never ran — count the
   rows you expect, not the container.

2. **The page itself does not scroll vertically**; each section scrolls its own content.
   Check `document.documentElement.scrollHeight <= window.innerHeight`.
   **And a DETAIL PANEL does not scroll either.** Its heading, its fields and its tab
   strip stay put, and only the table under them scrolls — a panel that scrolls takes
   the tab strip out of reach, and the tab strip is the only way to reach the other
   lists. Assert the panel's scrollHeight does not exceed its clientHeight, and that the
   tab strip's rectangle does not move when the table scrolls.
   **Also assert the page shows ONE section at a time and that the primary panel is
   inside the viewport**: `getBoundingClientRect()` on the panel must sit on screen and
   be larger than a minimum size, and exactly one section may carry the visible class.
   Sections that stack rather than swap pass every element-count check while pushing the
   diagram off-screen — and the reader sees a finished page with no graph on it.

3. **Every table column sorts**, and clicking a row expands in place without switching
   tabs. A heading that displays the sort arrow must actually sort, and the sort must
   survive a filter re-render.

4. **The first view renders with no interaction** — open the file and assert content
   before clicking anything.

5. **The page's inline script compiles.** Extract it and run it through a parser
   (`new vm.Script(code)`) before trusting anything the page shows. A parse error blanks
   every view while the page still looks alive, and it is invisible in the browser unless
   you happen to look at the console.

6. **Every derived view agrees with the document it summarises.** Compare the page's
   finding count, severities and ID set against the document that owns them —
   mechanically, not by eye. A page that lists a severity the document downgraded, or
   omits a finding the document added, contradicts the document in front of the reader.
   `scripts/check-explorer.js` does this comparison in one command:
   `node scripts/check-explorer.js <page.html> <document.md>`. It exits non-zero and
   names the disagreement. It scopes itself to the ID namespaces the documents own, and
   it distinguishes an ID the document *heads* from one it merely *mentions* — a
   document that says "F-03b is a probe label, not a finding" must not read as a missing
   finding.
   **And every identifier series the document issues must be in the page's catalogue.**
   `scripts/check-id-catalogue.js` checks that in one command:
   `node scripts/check-id-catalogue.js <page.html> <document.md>`. It reads the
   document's own ID registry for the series it issues, and reports a series the
   catalogue lacks, an empty series, an entry with no name to decode into, and an id the
   document never issued. A series the export omits is the silent failure this catches:
   nothing errors, the page renders, and every id of that series reaches the reader as a
   bare handle.

7. **The page's build pipeline runs clean and is idempotent.** Run the generator twice
   and diff: the second run must change nothing, and the page's inline script must
   compile after each run. A generator that only works once leaves the artifact in a
   state nobody can reproduce.

8. **The generator did not take any of the page's own code with it.** Diff the
   regenerated page against the previous one and confirm the only changes are the data.
   A generator that replaces a region between markers removes every helper in that
   region, and a removed helper fails inside one render function rather than at load — so
   the artifact still opens, still draws its chrome, and is quietly wrong. Assert the
   helpers are still present after the run: `grep -c 'const q = s' explorer.html` and
   the same for each other helper.

9. **Every control's appearance matches its behaviour.** Assert that each filter input
   is of the type its behaviour requires, that a radio is drawn round and a checkbox
   square, and that two independent radio groups sit in separate labelled containers. A
   control that looks like a checkbox and behaves like a radio puts the reader's
   expectation and the page's behaviour in conflict, and the reader cannot see the
   conflict in a screenshot.

10. **Every section the export carries has a view, and the view holds all of it.**
    Assert the glossary table's row count equals the export's glossary length, and the
    same for the transitions, invariants and findings tables. A view that shows fewer
    rows than the data has is the defect a reader sees as an incomplete analysis.
    **Assert the coverage MECHANICALLY, and do not let an empty array make the
    assertion vacuous.** A row-count check passes against a page with no table at all,
    because zero equals zero — so assert the view EXISTS for every section the export
    carries, that it says so when the section is empty, and that it holds everything when
    it is not. The export carries the divergences and the executable gaps; a page with
    no view for either loses them the day one is not empty.
    **Assert the export contract too**: the export carries a schema version and a
    required-field list, and the page checks it on load and fails loudly. A page that
    reads a field the export no longer carries renders an empty table with no error
    anywhere.
    **The contract states MEANING, not only presence** — a field list cannot catch a
    value that is present, correctly typed, and always wrong, and the constraint that
    would catch it ("TRUE iff every reachable state was enumerated") has to be written
    down somewhere the exporter can be held to.
    **And the contract is checked at BUILD time, not only at load.** A separate contract
    file plus a checker that gates the build means a non-conforming export never becomes
    a page; the page's load-time check then catches the page that predates a change.
    Report the checker by SHAPE — how many records lack the field — not one line per
    record.
    **The contract has TWO seams, and the second one drifts too.** It describes the DATA
    and it describes the PAGE — its tabs, each view's columns with their labels and
    widths, its filter groups. The export-side checker closes the first seam; the
    contract drifts from the page exactly as it drifts from the data, and a contract
    that claims a page that is not the page is worse than no contract. Check both:
    `node scripts/check-export-contract.js <export.json> <contract.json>` and
    `node scripts/check-contract-vs-page.js <contract.json> <page.html>`.
    **And there is a THIRD seam, under both: the fields the contract points at a view
    that the page never reads.** The two checkers above compare the contract's SHAPE
    against the export's and the page's — neither asks whether the page actually USES a
    field whose `x-view` names a view. A contract that says "the page renders the
    engine's trace verbatim" while the page renders no trace is a contract making a
    promise nobody keeps, and it survives every gate.
    `node scripts/check-contract-promises.js <contract.json> <page.html>` asks the
    question the `x-view` convention implies. It REPORTS rather than fails: a field the
    page has not grown yet is not the same as a promise the contract should not make,
    and only a reader can say which is which — so it prints the unkept promises in the
    contract's own words and leaves the decision to a person.
    **The contract instance is format-level, so it ships with the skill** — at
    `explorer/export.contract.json` beside the scripts — while the page and the export
    are the project's. A project holds no copy of the contract: it resolves the skill's,
    the way it resolves the checkers. A copy in the project is a second copy to drift,
    and it drifts silently, because a stale contract and a conforming export still agree
    with each other.
    **And a scope that resolved to NOTHING is a report, not a null.**
    `node scripts/check-scope-resolution.js <export.json>` names the invariants whose
    scope matched no id — a rule that quietly holds nowhere, which hides inside a prose
    cell that reads like it resolved. The usual cause is a word matched too narrowly
    ("submit" does not match "Resubmit" under a whole-word test), so the reader needs
    the miss named.
    **A column's handle must be the DATA KEY** — `k:"expression"` rendering
    `t.guardExpression` leaves the contract no unambiguous name for the column, and the
    comparison then fails on a difference that is not one.
    **The contract must be checkable by a plain-JS subset**, because the page is
    self-contained and offline and cannot carry a schema library: give every property a
    `type`, every record an `items.required` list, and every stated count a place to
    live.
    **A contract describes DATA. A transform that renders the data stays in the
    consumer** — a working decypherer in the page is the page's business, and moving it
    into the exporter to satisfy the contract rewrites a working consumer and puts a
    presentation concern in the data.

11. **The selected item is visibly selected.** Compare the selected node's computed fill
    and stroke width against an unselected node's — the class alone proves nothing,
    because the class can be applied and the style can be missing.
    **The selected EDGE is accented too, and the accent survives scaling**: assert the
    accent's `vector-effect` is `non-scaling-stroke`, because a halo that scales with the
    drawing vanishes on a machine drawn small to fit its panel.
    **Selecting a state dims the other states AND the transitions that do not touch
    it** — and judge "touches" by the edge's DRAWN ends, not by every state the
    transition names in a cell: a From cell may list five states while the edge is drawn
    from one of them, and an edge that does not touch the selected box must dim.
    **Assert the dimming against the geometry** (where each edge is actually drawn), not
    against a second copy of the rule derived from the export's cell texts — a check that
    reads the cells the same way the implementation does passes against the bug.
    **Clicking the empty canvas clears the selection.**

12. **The diagram fits its panel and does not scroll.** Assert the SVG's rectangle is
    inside its panel's rectangle and that the panel does not scroll in either direction.
    A graph that overflows is a graph the reader cannot read, and every element-count
    check passes against it.

13. **A named thing is shown by its name, and its id is a handle.** Assert the human
    title is bold and the identifier is not, in a filter chip and in a table cell.
    **That holds when the DOCUMENT puts the code beside the name.** A trigger cell that
    reads "CMD-001 Create application" is the document's own sentence, and the cell shows
    the name with the code in the hint — the code is a handle for the reader who needs
    it, not the thing the reader reads. A trigger may name two commands ("CMD-002 Save,
    CMD-003 Edit"): both codes go, both names stay.

14. **Every expression in the document reads in words.** Pick a transition whose guard
    names a state id, render it, and assert the reading exists, contains the state's
    NAME, and contains none of the operators it replaced. Count how many expressions
    translated and how many did not — a reader that silently renders nothing for the one
    hard expression hides exactly the rule the reviewer came for.
    **Assert the constant case too, because it is the one that reads plausibly:** a guard
    that is always true must read as the absence of a condition, never as "yes" or "no".
    A boolean literal is a value, and reading it as the answer to a yes/no question is
    wrong in a way that survives a glance.
    **And assert it for EVERY field that carries an expression, not only the one the
    reader noticed** — the transition guard, the condition inside an effect, the
    invariant's formal expression, the probe's predicate. A reader wired to one field
    leaves the rest in symbols while the page looks complete.

15. **The export carries the document's structure RESOLVED, and the page reads it.**
    Assert that each transition's `fromStates` and `toStates` are lists, that the
    hierarchy covers every machine with an outgoing and an incoming list per state, and
    that the page's incoming/outgoing lists match the export's hierarchy. A page that
    re-parses the document's cells has the document's structure in two places, and the
    two drift apart.

16. **Filtering a table does not change its column widths.** Measure the header cells'
    widths, apply a filter that removes rows, measure again, and require them to be
    identical. Under the default table layout the browser hands the space to whichever
    column holds the longest unbroken text, and the panel's scrollbar coming and going
    shifts the content box — so both have to be fixed: declared widths with a fixed
    layout, and a stable scrollbar gutter. A table that reshapes itself under the
    reader's feet is a table they lose their place in.

17. **Every assertion resets the state it depends on.** A check that reads a selection, a
    filter, or a radio reads whatever the previous check left behind, so the suite's
    verdict depends on the order it happens to run in — and the order changes the moment
    a check is added. Set the state the assertion needs (select the machine, clear the
    selection, open the tab) rather than assuming it, and leave it as you found it, so
    the next check starts from the same place.
    **And an assertion whose subject is conditional must FIND that subject, or fail.** A
    check that looks for "the state that lists invariants" and reports no problems when
    it finds no such state has proved nothing — it passed against a page with no
    invariants at all. Find the subject in the data (the export says which machine's
    states carry invariants; select its chip), and treat "no subject" as a failure
    rather than as an empty result.
    **When the reader inverts a requirement, rewrite the assertion that encoded the old
    one — do not delete it.** A rule that changes ("the evidence column is narrow"
    becomes "the evidence column is wide") is still a rule, and the assertion is where it
    is written down. Deleting it loses the requirement entirely; inverting it keeps the
    requirement and stops its opposite from coming back.
