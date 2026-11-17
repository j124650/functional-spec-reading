# Reading an expression back in words

The page shows the document's formal rules to a reader who cannot parse symbols.
**Show the rule in words above the rule in symbols.** The words are derived from the
document's own vocabulary and state names — a reading of what the document already
says, not a second opinion about it.

This is the whole of how a formal expression becomes English: unwrapping, the
tokenizer, the parser, the effect reader, the audit that finds the fields the reader
never reached, and the assertions.

## The value arrives plain

The document is JSON, so an expression is the string in `expression.value` — the text
of the rule, with no decoration around it. There is nothing to unwrap.

That is worth saying because the decoration was a defect, not a style. When the
document wrote every expression in inline code, the string that arrived was
`` `true` `` rather than `true`, and two things went wrong while the decoration was
still on:

- A shortcut that tested the raw text (`text === "true"`) never fired, because the
  text was backticked.
- The tokenizer's default branch discarded the characters that were not in the
  grammar, so the backticks vanished silently and `` `true` `` reached the keyword
  reader as the literal `true` — which is read as the ANSWER "Yes". A constant-true
  guard then read as a yes/no answer rather than as the absence of a condition, and
  every such guard in the document was wrong the same way.

**A reader that unwraps anyway must unwrap identically everywhere.** A guard reader
and an effect reader that parse the same vocabulary are two entry points into one
language, and a fix applied to one and not the other is a defect waiting for the
other call site. The unwrap is gone, but the rule it taught stands: one language, one
reader, no variation between call sites.

**And the value is the whole of it.** §8.2 of the prompt forbids markdown inside a
value, so there is no bold, no list marker and no pipe in an expression — and the
expression language's own `||` needs no escaping, because a JSON string is not a
Markdown cell. The reader takes `expression.value` as it stands.

## The three steps

Read it in three steps: tokenize against the vocabulary, parse with the engine's
grammar, and word the tree.

**Match vocabulary terms longest-first, and take them whole.** A term may be several
words ("legal business name"), so it is matched as a unit rather than split into
identifiers the document never defined:

```javascript
const VOCAB_TERMS = VOCAB.map(v=>v.term).filter(t=>t.length)
  .sort((a,b)=>b.length-a.length);
// at an identifier, try each term in turn; the term must not be cut short
// by a following letter or digit
```

**The engine's own keywords are not vocabulary terms.** `state`, `input`, `true` and
`false` belong to the expression language, not to the document's vocabulary. If the
tokenizer only knows the vocabulary, they tokenize as unknown identifiers and the
reading comes out italicised. Carry them as a separate list and read them in the
reader's terms: "the current state", "the input", "yes", "no".

**A domain written as a range must be expanded.** The vocabulary says a term may
hold "ST-001 … ST-008"; reading only the endpoints names two of eight states. Expand
the range across every state it spans, then name each one.

**An identifier the vocabulary does not define is a finding, not a word.** Render it
in italics so the reader sees that the expression names something unknown, and say so
rather than reading it out as if it were defined.

**Decode a state id to the state's name, in bold.** `state != 'ST-006'` reads as
"the current state is not **Approved** (ST-006)" — the id stays in parentheses so the
reader can match it against the table.

**Word the operators.** `!=` → "is not", `==` → "is", `>` → "is greater than",
`&&` → "and", `||` → "or", `!` → "… is not true". An empty string is "empty", not
`''`.

**Parse with the engine's precedence** — `||`, then `&&`, then `!`, then a
comparison, then an operand — so the words follow the same reading the engine does:

```javascript
function parseAnd(ts,i){
  let left=parseNot(ts,i);
  while(left.ok && ts[left.i] && ts[left.i].k==="op" && ts[left.i].v==="&&"){
    const right=parseNot(ts,left.i+1);
    left={ok:left.ok&&right.ok,node:{t:"and",l:left.node,r:right.node},i:right.i};
  }
  return left;
}
```

**The loop must advance from the position the left operand ENDED at.** Testing
`ts[i]` — the index the loop started with — stops the chain after the first
conjunct, and a fourteen-conjunct guard silently reads as one conjunct. The
returned `i` is the only position that knows where the parse got to.

## One reader for the language, and an audit of every field that carries one

**The boolean reader is general — it is not written for transitions.** It reads any
rule over the document's vocabulary, so the same function serves a transition's guard,
the condition of an `if … then …` inside an effect, an invariant's formal expression,
and a probe's predicate. A reader written for one caller will not be reused, and the
other fields then stay in symbols while the page looks complete.

**Audit the fields mechanically — enumerate, then find each one's render site.** The
gaps are not found by remembering which tables exist; they are found by listing every
field in the export whose value is an expression, and then finding where the page
renders it. For each field the question is: is it rendered in words, in symbols, or
not at all? A field rendered in symbols where the reader would have read it is a
visible gap; a field rendered NOWHERE is worse, because the reader is told a rule
applies and is never shown it.

**A sentinel is not an expression.** The document's marker that the rule cannot be
written down is the expression's `kind` — `notExpressible`, with the reason in
`expression.reason` — not a rule to translate, and not text inside a value. Show the
marker and the reason the document gives for it; the reason is the part that tells the
reader what to decide.

**And the reader must REFUSE the sentinel, not parse it.** The sentinel is a `kind`,
so the reader never reaches it as text: check `kind` before reading `value`, and a
`notExpressible` expression yields no reading at all, so the caller shows the reason
instead. A reader that read the marker's text would parse two words the vocabulary
does not define, and a parser that tolerates an unknown identifier reads the first
as the term "not" — so the marker comes out as the word "not", in italics, where a
reading belongs. A conjunct that mixes a real rule with the marker reads as a
sentence with no ending: "the number of divisions is greater than zero and not".
Return nothing for the marker, so the caller shows the source expression alone:

```javascript
for(let i=0;i<ts.length;i++){
  if(ts[i].k==="unknown" && ts[i].v.toLowerCase()==="not" &&
     ts[i+1] && ts[i+1].k==="unknown" && ts[i+1].v.toLowerCase()==="expressible")
    return null;      /* the marker - show the source, do not read it */
}
```

**A partial reading is not a reading.** A reader that returns a half-translated
sentence — because it stopped at a word it did not know — puts a fragment where the
reader expects a complete rule, and the fragment looks plausible. When the reader
cannot read the whole expression it returns nothing and the caller shows the formal
form: the symbols are then the authority, and the page never states a rule in half.

## Ordering compares text, not arithmetic

`<`, `<=`, `>` and `>=` are **ordinal string comparisons** whenever a term is one
of the operands — never arithmetic.

The engine reads a term by its declared kind: a **flag** reads as its boolean, a
**set** reads as its members joined by commas, and everything else reads as
**text**. `input` is text too. Numeric ordering happens only between two literal
numbers written in the expression itself; every other comparison falls through
to a string comparison, and strings compare by character.

So this is what the engine does with money:

| the expression says | the engine compares | the engine's answer |
|---|---|---|
| `total >= discount` with total `9.00`, discount `12.00` | `"9.00"` vs `"12.00"` | **true** — and 9.00 is *less* than 12.00 |
| `total >= discount` with total `12.00`, discount `9.00` | `"12.00"` vs `"9.00"` | **false** — and 12.00 is *more* than 9.00 |
| `input >= total` | the input's text against the total's text | true only when the input's text sorts after it |

**Therefore a numeric rule must not be written as a comparison over terms.** The
guard will hold or fail for reasons that have nothing to do with the arithmetic,
and the state behind it will be reachable or not by accident. This is the same
class of defect as the guard that reads a collection nothing fills: the model
looks right and evaluates wrong.

**Write the numeric rule as a flag the transition sets.**

```
| TR-004 | ST-002 | ST-003 | CMD-004 Apply discount | ... | `set('discount within limit', true)` |
```

and let the guard read the flag:

```
| TR-005 | ST-003 | ST-004 | ... | `discount within limit` |
```

Where the specification does not state the arithmetic, the flag is a **declared
gap** — a question, or a completeness finding that says the source never says
when a discount is within the limit — not an invented comparison. A run that
needs the arithmetic says so in the deliverable instead of encoding it.

Equality is the same: `==` compares two numbers numerically, two booleans by
their truth, and everything else as text.

## The first transition of a machine cannot carry a guard

The engine's initial state is a machine's **position**, not a set of field values.
Every flag starts unset, and nothing can fill one before the first transition — so a
guard on that transition reads a flag that is false, always, and the state behind it
is unreachable.

The honest form is the `notExpressible` marker, with the reason:

```
"guard": { "text": "The item must be eligible for loan",
            "expression": { "kind": "notExpressible",
                            "reason": "Nothing precedes the first transition of a machine, so no flag can be filled before it. The rule is a precondition of the command, and this transition records that the assessment happened." } }
```

The checker requires a guard on every transition, so a transition that genuinely has
no condition carries the marker rather than an empty guard.

**The same reasoning catches a circular guard.** A transition whose guard reads a flag
that the transition's own effect fills can never fire: the flag is false until the
transition runs. The rule belongs to the transition, and its effect records it.

## Effects are a statement language

**An effect is a statement language, not a rule.** `set('clock started', true); if
owner == '' then set('owner', default owner)` is a script, and feeding it to the
boolean parser yields nonsense. Split it on top-level `;`, read each statement, and
read the condition of an `if … then …` with the boolean reader above:

| Statement | Reads as |
|---|---|
| `set('term', value)` | set the term to the value |
| `clear('term')` | clear the term |
| `add('set', 'value')` | add the value to the set |
| `remove('set', 'value')` | remove the value from the set |
| `apply(input)` | write the edited field onto the application |
| `if <cond> then <effect>` | if the condition holds, the effect |

**The quotes in an effect's arguments are the term's NAME, not a literal.** `set('clock
started', true)` sets the term *clock started*; stripping the quotes as if they
delimited a value loses the term. Strip them, then read the term through the
vocabulary.

**An effect of "—" means no effect.** Say so rather than rendering nothing: a
transition with no effect is a fact about the transition.

## Assert the reading

Every guard in the document should render in words, and the rendering must not
contain the operators it replaced:

```javascript
const t = d.transitions.find(x => /ST-\d{3}/.test(x.guardExpression||""));
showTransition(t.id);
const w = document.querySelector("#machDetail .written");
if (!w) return ["no reading in words for " + t.id];
if (/!=|&&|\|\|/.test(w.textContent)) return ["the reading still contains operators"];
```

Count how many expressions translated and how many did not; a guard that fails to
translate is a gap in the reader, and a reader that silently renders nothing for the
one hard expression hides exactly the rule the reviewer came for.

**Assert the CONSTANT case too, because it is the one that reads plausibly.** A
guard that is always true must read as the absence of a condition, never as "yes" or
"no" — a boolean literal is a value, and reading it as the answer to a yes/no
question is wrong in a way that survives a glance:

```javascript
const bare = d.transitions.filter(t => {
  const g = t.guard && t.guard.expression;
  return g && g.kind === "expression" && String(g.value).trim() === "true";
});
for (const t of bare) {
  const w = decypher(t.guard.expression);
  if (w !== "always true") bad.push(t.id + ": reads '" + w + "'");
}
```

**Keep the reading above the formal form, and put the formal form in monospace.**
The reader reads the words; the reader who wants the precision has the symbols one
line below.

**In a table, the column holds the READING and the source sits in the hover.** A
detail panel can afford the formal form on its own line; a table row cannot, and a
column of symbols down twenty rows is the page the reader cannot read. So the cell
carries the words and the `title` carries the expression, and the column is named for
what it holds — "In words", not "Formal expression", because the heading tells the
reader which of the two they are looking at.
