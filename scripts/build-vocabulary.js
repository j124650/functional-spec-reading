/* Build the skill's DDD vocabulary reference from the DDD Reference source.
 *
 * The reference is generated, not hand-written: the definitions and the
 * pattern catalogue come straight from the book, and the mapping from the
 * reader's output concepts onto the patterns that ground them is authored
 * here.
 *
 *   node build-vocabulary.js <book.json> <out.md>
 */
const fs = require("fs");

const book = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const out = process.argv[3];

/* The reader's required output concepts, and the patterns that ground them.
 * Authored, not extracted — this is the part the book does not say. */
const CONCEPT_MAP = [
  ["Ubiquitous Language glossary", "ubiquitous language, context, bounded context",
   "A term is only meaningful against a context. Before listing a definition, "
   + "name the context it holds in — the same word in two contexts is two "
   + "terms, and that is a finding, not a defect of the glossary."],
  ["Domain entities", "Entities",
   "An entity is a thread of continuity and identity running through a "
   + "lifecycle, whose attributes may change. Identity, not attributes, is "
   + "what distinguishes it."],
  ["Value objects", "Value Objects",
   "A value object is defined by its attributes, has no separate identity, and "
   + "is immutable. Equality is by value."],
  ["Aggregates and consistency boundaries", "Aggregates, Repositories",
   "An aggregate is a cluster of entities and value objects with one root; "
   + "external objects hold references to the root only. **Use the same "
   + "aggregate boundaries to govern transactions and distribution** — within "
   + "a boundary, apply consistency rules synchronously; across boundaries, "
   + "handle updates asynchronously. This is the rule that justifies an "
   + "aggregate boundary, and it is the one to check an inferred boundary "
   + "against."],
  ["Domain events", "Domain Events",
   "An event names a business fact in the past tense. Distinguish it from a "
   + "command (an intent) and a notification (a message about something "
   + "else)."],
  ["Commands and business actions", "Entities, Services, Intention-Revealing Interfaces",
   "A command expresses business intent and belongs to the entity or service "
   + "that decides it. Name the method after what it achieves, not what it "
   + "does."],
  ["Domain policies and processes", "Services, Domain Events",
   "A policy that spans more than one aggregate is not aggregate-local. "
   + "Express it as a service or as an event handler, and say explicitly which "
   + "boundary it crosses and whether it is synchronous."],
  ["State machines", "Entities, Refactoring Toward Deeper Insight, Domain Events",
   "Evans gives no state-machine pattern; a lifecycle is modelled as an entity "
   + "whose behaviour changes with its state. Build the machine from the "
   + "behaviour the spec permits at each state, and let the transitions "
   + "emerge — do not assume a field called `status` is a machine."],
  ["Invariants", "Aggregates, Assertions",
   "An invariant is a property of the aggregate as a whole. Distinguish a rule "
   + "that must always hold from a precondition that applies to one operation "
   + "only — the former is an invariant, the latter a guard."],
  ["Context map", "Context Map, Partnership, Shared Kernel, Customer/Supplier Development, Conformist, Anticorruption Layer, Open-host Service, Published Language, Separate Ways, Big Ball of Mud",
   "The context map's relationship vocabulary is fixed: these ten names cover "
   + "the documented outcomes. Pick the one the spec's facts support; do not "
   + "invent a new relationship name."],
  ["Defects and contradictions", "Anticorruption Layer, Big Ball of Mud",
   "A confirmed contradiction is two sections prescribing different outcomes "
   + "for the same event. A Big Ball of Mud is a context with no defined "
   + "boundary — name it as a context-map finding, and give the boundary that "
   + "would fix it."],
  ["Domain expert questions", "Domain Vision Statement, Core Domain, Generic Subdomains",
   "A vision statement names the core domain and the subdomains, generic or "
   + "not. The questions the reader should ask are the ones that block a "
   + "reliable model — a missing core-domain statement is itself one."],
];

/* The book groups its patterns into six chapters. Keep that grouping: it is
 * the book's own argument about what depends on what. */
const CHAPTER_INTRO = {
  "Putting the Model to Work":
    "How the model is put to work inside a team, and what makes it survive contact with the code.",
  "Building Blocks of a Model-Driven Design":
    "The tactical building blocks: what to model with, and what each one is for.",
  "Supple Design":
    "The patterns that make a model easier to use — less about structure, more about how it reads.",
  "Context Mapping for Strategic Design":
    "How bounded contexts relate to each other, and what each relationship costs.",
  "Distillation for Strategic Design":
    "How to find the part of the model that carries the business value.",
  "Large-Scale Structure for Strategic Design":
    "How the model is arranged when the system is large.",
};

const L = [];
const p = s => L.push(s);

p("# DDD vocabulary");
p("");
p("Use this file to decide **what a term means and what a claim is called**. Use");
p("`references/spec-processing-prompt.md` for **what to produce**.");
p("");
p("---");
p("");
p("## The definitions");
p("");
p("Five terms the book defines outright. Everything else in the book's vocabulary");
p("is a pattern name, defined by its prescription.");
p("");
for (const d of book.definitions) {
  p(`### ${d.term}`);
  p("");
  p(d.text);
  p("");
}
p("---");
p("");
p("## The pattern catalogue");
p("");
p("Each pattern is given as the book gives it: the situation it addresses, then");
p("the rule that follows from it — the *Therefore* paragraph. The rule is the");
p("operative text; the rationale explains what it is for.");
p("");
for (const [chapter, names] of Object.entries(
  book.patterns.reduce((acc, p) => {
    (acc[p.chapter] = acc[p.chapter] || []).push(p);
    return acc;
  }, {})
)) {
  p(`## ${chapter}`);
  p("");
  if (CHAPTER_INTRO[chapter]) { p(`*${CHAPTER_INTRO[chapter]}*`); p(""); }
  for (const pat of names) {
    p(`### ${pat.name}`);
    p("");
    p("*Situation.*");
    p("");
    p(pat.body);
    p("");
    p("*Rule.*");
    p("");
    p(pat.therefore);
    p("");
  }
}
p("---");
p("");
p("## From the reader's outputs to the book's vocabulary");
p("");
p("The processing prompt requires a fixed set of products. This table says which");
p("patterns ground each one, and what the book says about it — so a reviewer can");
p("check the output against an authority rather than against taste.");
p("");
for (const [concept, grounding, note] of CONCEPT_MAP) {
  p(`### ${concept}`);
  p("");
  p(`*Grounded in:* ${grounding}`);
  p("");
  p(note);
  p("");
}
p("---");
p("");
p("## Two vocabularies that must not be confused");
p("");
p("The processing prompt classifies **evidence**; this skill classifies **glossary");
p("status**. They answer different questions, and a term can carry both.");
p("");
p("| Prompt class | Means | Prompt's question |");
p("|---|---|---|");
p("| `EXPLICIT` | the spec says it | is this in the document? |");
p("| `INFERRED` | it follows from several statements | did you derive it, and can you show the derivation? |");
p("| `CANDIDATE` | a plausible reading needing validation | is this a proposal rather than a finding? |");
p("| `CONFLICTING` | the spec contradicts itself | which two statements disagree? |");
p("| `UNSPECIFIED` | the spec is silent | what must be decided? |");
p("");
p("| Glossary status | Means |");
p("|---|---|");
p("| `Defined` | one definition, consistent everywhere it appears |");
p("| `Defined (partial)` | a definition exists, but not the whole of it |");
p("| `Conflicting` | two sections give incompatible meanings |");
p("| `Overloaded` | one word, several meanings — *not* a contradiction |");
p("| `Undefined` | used as if understood, never defined |");
p("| `Pending` | depends on an open question or an outside decision |");
p("");
p("**`Conflicting` and `CONFLICTING` are the same finding seen from two sides:**");
p("the glossary says the *term* means two things, the evidence class says the");
p("*claim* contradicts another claim. A term can be `Overloaded` (two contexts,");
p("two meanings, both fine) while every individual claim is `EXPLICIT`. An");
p("overloaded term is not a defect; a conflicting one is.");
p("");
p("**`UNSPECIFIED` is not `CANDIDATE`.** `UNSPECIFIED` says the document is");
p("silent and names the gap. `CANDIDATE` says *you* are proposing a reading and");
p("it needs a domain expert to confirm. Never present a `CANDIDATE` as an");
p("`UNSPECIFIED`, and never present either as `EXPLICIT`.");
p("");

fs.writeFileSync(out, L.join("\n"), "utf8");
console.log("wrote", out, "-", L.join("\n").length, "bytes");
console.log("definitions:", book.definitions.length, "patterns:", book.patterns.length);
