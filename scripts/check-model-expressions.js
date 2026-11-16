/* Check that every expression in the deliverable resolves against the
 * deliverable's own vocabulary.
 *
 *   node scripts/check-model-expressions.js <document.json>
 *
 * Exits 0 when the document is sound, 1 when it is not, 2 on a usage error.
 *
 * The document is JSON, so this script no longer parses tables: it reads the
 * `expressionVocabulary`, `states`, `transitions` and `invariants` arrays
 * directly. That removes the whole class of failure a Markdown parser had —
 * a table found by the wrong column, a section number that pointed at the
 * wrong table, a cell that carried two shapes — because there is nothing to
 * misread.
 */
"use strict";

const fs = require('fs');

const file = process.argv[2];
if (!file) {
  console.error('usage: node check-model-expressions.js <document.json>');
  process.exit(2);
}

let doc;
try {
  doc = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (e) {
  console.error('cannot read ' + file + ': ' + e.message);
  process.exit(2);
}

const problems = [];

// ------------------------------------------------------------- the vocabulary

// The vocabulary is the `expressionVocabulary` array. A name that is not in
// it is an unresolvable expression, and it must be reported, not guessed.
const vocab = new Map();
for (const v of (doc.expressionVocabulary || [])) {
  if (!v || !v.term) continue;
  const type = String(v.type || '').toLowerCase();
  if (['flag', 'text', 'set', 'number'].indexOf(type) < 0) {
    problems.push('expressionVocabulary: "' + v.term + '" has type "' + v.type +
                  '" — it must be one of flag, text, set, number');
    continue;
  }
  vocab.set(v.term.toLowerCase(), { term: v.term, type });
}

const vocabTerms = Array.from(vocab.values()).map(v => v.term)
  .sort((a, b) => b.length - a.length);

// ---------------------------------------------------------------- the states

const stateIds = new Set();
const stateNames = [];
for (const s of (doc.states || [])) {
  if (!s || !s.id) continue;
  stateIds.add(s.id);
  if (s.name) stateNames.push(String(s.name).replace(/\s*\(.*$/, '').trim());
}

const transitionIds = new Set();
for (const t of (doc.transitions || [])) {
  if (t && t.id) transitionIds.add(t.id);
}

// ------------------------------------------------------- expression analysis

const KEYWORDS = [
  'state', 'input', 'true', 'false',
  'set', 'clear', 'add', 'remove', 'apply',
  'contains', 'empty', 'count',
  'if', 'then', 'not',
];

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripLiterals(s) {
  let out = '';
  let inString = false;
  for (const ch of s) {
    if (ch === "'") { inString = !inString; out += ' '; continue; }
    if (!inString) out += ch;
  }
  return out;
}

// A term may be several words, so identifiers are only what remains after
// the vocabulary's own terms have been removed as whole phrases.
function identifiers(s) {
  const cleaned = stripLiterals(s);
  const words = [];
  let w = '';
  for (const ch of cleaned) {
    if (/[A-Za-z_]/.test(ch)) { w += ch; continue; }
    if (/[0-9]/.test(ch)) { if (w) { words.push(w); w = ''; } continue; }
    if (w) { words.push(w); w = ''; }
  }
  if (w) words.push(w);
  return words;
}

function unresolvedTerms(expr) {
  let rest = stripLiterals(expr);
  for (const term of vocabTerms) {
    rest = rest.replace(new RegExp('(?<![\\w])' + escapeRe(term) + '(?![\\w])', 'gi'), ' ');
  }
  for (const kw of KEYWORDS) {
    rest = rest.replace(new RegExp('(?<![\\w])' + kw + '(?![\\w])', 'gi'), ' ');
  }

  const bad = [];
  for (const word of identifiers(rest)) {
    if (!word) continue;
    const lower = word.toLowerCase();
    if (KEYWORDS.indexOf(lower) >= 0) continue;
    if (vocab.has(lower)) continue;
    if (bad.indexOf(word) < 0) bad.push(word);
  }
  return bad;
}

// An accessor is defined for a TYPE: `count` and `contains` are set
// operations. An expression that calls one on a text term is not evaluable as
// written, and no engine can invent the reading that would fix it — so it is
// a defect in the document, reported here rather than coerced to a value that
// makes every state report a violation.
function typeProblems(expr) {
  const bad = [];
  for (const entry of vocab.values()) {
    if (entry.type === 'set') continue;
    const re = new RegExp('(?<![\\w])' + escapeRe(entry.term) +
                           '\\s*\\.\\s*(count|contains)\\b', 'gi');
    const m = re.exec(expr);
    if (m) {
      bad.push("'" + entry.term + "' is a " + entry.type + " term; '." +
               m[1] + "' is defined only for a set term");
    }
  }
  return bad;
}

/* An expression is a TYPED VALUE now, so the sentinel is not a string a
 * reader must recognise inside an expression — it is `kind`. And a marking
 * with no reason is indistinguishable from a marking nobody got to, so the
 * reason is checked where it lives. */
function checkExpression(where, expr, problems) {
  if (expr === null || expr === undefined) {
    problems.push(where + ': no expression');
    return false;
  }
  if (typeof expr !== 'object') {
    problems.push(where + ': the expression must be an object with a "kind"');
    return false;
  }
  if (expr.kind === 'notExpressible') {
    const reason = typeof expr.reason === 'string' ? expr.reason.trim() : '';
    if (!reason) {
      problems.push(where + ': the expression is "not expressible" with no reason — say what would be needed');
    }
    return false;
  }
  if (expr.kind === 'alternatives') {
    const values = Array.isArray(expr.values) ? expr.values : [];
    if (!values.length) {
      problems.push(where + ': the expression names alternative readings but carries none');
      return false;
    }
    let ok = false;
    for (const v of values) {
      if (checkExpression(where + ' (one reading)', v, problems)) ok = true;
    }
    return ok;
  }
  if (expr.kind !== 'expression') {
    problems.push(where + ': the expression has kind "' + expr.kind +
                  '" — it must be expression, notExpressible or alternatives');
    return false;
  }
  const value = typeof expr.value === 'string' ? expr.value : '';
  if (!value.trim()) {
    problems.push(where + ': the expression has no value');
    return false;
  }
  if (/not\s+expressible/i.test(value)) {
    problems.push(where + ': the expression value says "not expressible" — that is the ' +
                  'expression kind, not text inside a value');
    return false;
  }
  const bad = unresolvedTerms(value);
  const types = typeProblems(value);
  if (bad.length > 0) {
    problems.push(where + ': names a term the vocabulary does not define: ' + bad.join(', '));
    return false;
  }
  if (types.length > 0) {
    problems.push(where + ' — ' + types.join('; '));
    return false;
  }
  return true;
}

// ------------------------------------------------------------------ checking

let transitions = 0, invariants = 0, guardsOk = 0, effectsOk = 0, exprOk = 0;

if (vocab.size === 0) {
  problems.push('the expressionVocabulary array is empty: the expressions may use no terms');
}

// --- the transitions
for (const t of (doc.transitions || [])) {
  if (!t || !t.id) continue;
  transitions++;
  const id = t.id;

  if (!t.guard || typeof t.guard !== 'object') {
    problems.push(id + ': no guard');
  } else if (!t.guard.expression) {
    problems.push(id + ': the guard has no expression');
  } else if (checkExpression(id + ': guard', t.guard.expression, problems)) {
    guardsOk++;
  }

  // An effect may be absent - a transition that only moves state. It may not
  // be unresolvable.
  if (t.effect !== null && t.effect !== undefined) {
    if (checkExpression(id + ': effect', t.effect, problems)) effectsOk++;
  }

  // Every state a transition names must exist.
  for (const where of ['from', 'to']) {
    const v = t[where];
    if (typeof v !== 'string' || !v) continue;
    if (!stateIds.has(v)) {
      problems.push(id + ': names state ' + v + ', which the states array does not define');
    }
  }
}

// --- the invariants
for (const inv of (doc.invariants || [])) {
  if (!inv || !inv.id) continue;
  invariants++;

  if (inv.formalExpression === null || inv.formalExpression === undefined) {
    // A null formal expression is the honest report for an invariant the
    // aggregate cannot answer — but the REASON must be there.
    const reason = typeof inv.rationale === 'string' ? inv.rationale.trim() : '';
    if (!reason) {
      problems.push(inv.id + ': no formal expression and no reason — say what would be needed to express it');
    }
    continue;
  }
  if (typeof inv.formalExpression !== 'string') {
    problems.push(inv.id + ': the formal expression must be a string or null');
    continue;
  }
  if (/not\s+expressible/i.test(inv.formalExpression)) {
    problems.push(inv.id + ': the formal expression says "not expressible" — that is a null ' +
                  'expression with a reason, not text inside a value');
    continue;
  }
  const bad = unresolvedTerms(inv.formalExpression);
  const types = typeProblems(inv.formalExpression);
  if (bad.length > 0) {
    problems.push(inv.id + ': expression names a term the vocabulary does not define: ' + bad.join(', '));
  } else if (types.length > 0) {
    problems.push(inv.id + ': expression — ' + types.join('; '));
  } else {
    exprOk++;
  }

  // The invariant must say where it is in force.
  const states = Array.isArray(inv.states) ? inv.states : [];
  const scoped = Array.isArray(inv.transitions) ? inv.transitions : [];
  if (!states.length && !scoped.length) {
    problems.push(inv.id + ': its states and transitions arrays are both empty — say where it is in force');
  }
  for (const sid of states) {
    if (!stateIds.has(sid)) problems.push(inv.id + ': names state ' + sid + ', which the states array does not define');
  }
  for (const tid of scoped) {
    if (!transitionIds.has(tid)) problems.push(inv.id + ': names transition ' + tid + ', which the transitions array does not define');
  }
}

// ------------------------------------------------------------------- report

console.log('document: ' + file);
console.log('  vocabulary terms : ' + vocab.size);
console.log('  transitions       : ' + transitions +
            '  (guards resolved ' + guardsOk + ', effects resolved ' + effectsOk + ')');
console.log('  invariants        : ' + invariants + '  (expressions resolved ' + exprOk + ')');
console.log('');

if (problems.length === 0) {
  console.log('OK: every expression resolves against the document\'s own vocabulary.');
  process.exit(0);
}

console.log('FAILED: ' + problems.length + ' problem(s).');
for (const p of problems) console.log('  - ' + p);
process.exit(1);
