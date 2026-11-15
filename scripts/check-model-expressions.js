#!/usr/bin/env node
// check-model-expressions.js
//
// Verify that a domain model carries MACHINE-READABLE logic, as the skill's
// generation rules require:
//
//   - every transition row has a "Guard (expression)" cell, and an "Effect
//     (expression)" cell when the transition changes data;
//   - every invariant row has a "Formal expression" cell;
//   - every expression names only terms the document's own §3.1 expression
//     vocabulary declares;
//   - every expression uses accessors the declared term types support —
//     `count` and `contains` are set operations, so a text term cannot carry
//     them;
//   - every "not expressible" states what would be needed to express it;
//   - every invariant's "States / Transitions" cell names a state, a
//     transition, or "All states".
//
// Usage: node scripts/check-model-expressions.js <document.md>
//
// Exits 0 when the document is sound, 1 when it is not, 2 on a usage error.
// It names each disagreement.
//
// This is the DOCUMENT's gate, and it needs no harness: it checks the format
// itself, so it is available before any verifier exists. A per-project
// harness's own `check` mode does the same for the document it was built
// for; run this one on any document in the format.

'use strict';

const fs = require('fs');

const file = process.argv[2];
if (!file) {
  console.error('usage: node check-model-expressions.js <document.md>');
  process.exit(2);
}

let raw;
try {
  raw = fs.readFileSync(file, 'utf8');
} catch (e) {
  console.error('cannot read ' + file + ': ' + e.message);
  process.exit(2);
}

const text = raw.replace(/\r\n/g, '\n');
const lines = text.split('\n');

// --------------------------------------------------------------- cell split

// A pipe PAIR is never a cell boundary: the expression language uses || for
// "or", and an unescaped | ends a Markdown cell. An escaped \| is a literal
// pipe and is not a boundary either.
function splitCells(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);

  const cells = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '\\' && s[i + 1] === '|') { cur += '|'; i++; continue; }
    if (ch === '|') {
      if (s[i + 1] === '|') { cur += '||'; i++; continue; }
      cells.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

function isSeparator(line) {
  const t = line.replace(/[|\s:-]/g, '');
  return t.length === 0 && line.includes('-');
}

// ------------------------------------------------------------- table finder

const tables = [];
{
  let section = '';
  let subsection = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const sec = line.match(/^##\s+(\d+)\./);
    if (sec) { section = sec[1]; subsection = ''; continue; }

    const sub = line.match(/^###\s+(\d+(?:\.\d+)*)\s/);
    if (sub) { subsection = sub[1]; continue; }

    if (!line.trimStart().startsWith('|')) continue;

    const block = [];
    let j = i;
    while (j < lines.length && lines[j].trimStart().startsWith('|')) {
      block.push(lines[j]);
      j++;
    }
    i = j - 1;

    if (block.length < 2) continue;
    if (!isSeparator(block[1])) continue;

    tables.push({
      section: section,
      subsection: subsection,
      headers: splitCells(block[0]),
      rows: block.slice(2).map(splitCells),
    });
  }
}

// EXACT header match only. Fuzzy matching is what makes "States /
// Transitions" collide with "States", and a mis-read column is a silently
// wrong check.
function col(headers, name) {
  const want = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase().replace(/[^a-z0-9]/g, '');
    if (h === want) return i;
  }
  return -1;
}

function cell(row, index) {
  if (index < 0 || index >= row.length) return '';
  return row[index].trim();
}

// ------------------------------------------------------------- the vocabulary

// The vocabulary is found by its COLUMNS, not by its subsection number.
//
// A document's glossary section carries several subsections - the overloaded
// terms, the undefined terms, the vocabulary - and two of them can end up with
// the same number. Keying on the number then reads whichever table came
// first, which is how a parser checks a document against the wrong
// vocabulary and reports every expression as unresolvable. The type column
// (flag/text/set/number) is a second guard: only the vocabulary table has
// one.
const vocab = new Map();          // lowercased term -> {term, type}
for (const t of tables) {
  if (t.section !== '3') continue;
  const cTerm = col(t.headers, 'Term');
  const cType = col(t.headers, 'Type');
  if (cTerm < 0 || cType < 0) continue;
  for (const r of t.rows) {
    const term = cell(r, cTerm);
    const type = cell(r, cType).toLowerCase();
    if (!term) continue;
    if (['flag', 'text', 'set', 'number'].indexOf(type) < 0) continue;
    vocab.set(term.toLowerCase(), { term: term, type: type });
  }
}

const vocabTerms = Array.from(vocab.values()).map(v => v.term)
  .sort((a, b) => b.length - a.length);

// ---------------------------------------------------------- state inventory

const stateIds = new Set();
const stateNames = [];
for (const t of tables) {
  if (t.section !== '13') continue;
  const cId = col(t.headers, 'State ID');
  const cName = col(t.headers, 'Name');
  if (cId < 0) continue;
  for (const r of t.rows) {
    const id = cell(r, cId);
    if (!/^ST-\d+/.test(id)) continue;
    stateIds.add(id);
    if (cName >= 0) {
      const name = cell(r, cName).replace(/\s*\(.*$/, '').trim();
      if (name) stateNames.push(name);
    }
  }
}

const transitionIds = new Set();
for (const t of tables) {
  if (t.section !== '14') continue;
  const cId = col(t.headers, 'Transition ID');
  if (cId < 0) continue;
  for (const r of t.rows) {
    const id = cell(r, cId);
    if (/^TR-\d+/.test(id)) transitionIds.add(id);
  }
}

// ------------------------------------------------------- expression analysis

const KEYWORDS = [
  'state', 'input', 'true', 'false',
  'set', 'clear', 'add', 'remove', 'apply',
  'contains', 'empty', 'count',
  'if', 'then', 'not', 'expressible',
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

// A term may be several words, so identifiers are only what remains after the
// vocabulary's own terms have been removed as whole phrases.
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

function unquote(s) {
  let t = s.trim();
  if (t.length >= 2 && t.startsWith('`') && t.endsWith('`')) t = t.slice(1, -1);
  return t.trim();
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

// "not expressible" with nothing after it is a marking nobody justified.
//
// The reason must also be PROSE. Another expression conjunct is not a reason:
// it says nothing about what would have to be modelled to express the
// condition, and it leaves the verifiable half of the expression unverified —
// so `divisions.count > 0 && not expressible` is a conjunct that is checkable
// beside a conjunct that is not, and the report must say that rather than
// treating the whole cell as unevaluable.
//
// The test: if every word of the leftover text is a vocabulary term or an
// expression keyword, the leftover is another expression, not a reason.
function reasonFor(cellText) {
  const without = cellText.replace(/not\s+expressible/gi, ' ');
  const cleaned = without.replace(/[`|]/g, ' ')
    .replace(/[—–-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length === 0) return false;

  for (const word of identifiers(cleaned)) {
    const lower = word.toLowerCase();
    if (KEYWORDS.indexOf(lower) >= 0) continue;
    if (vocab.has(lower)) continue;
    return true;   // a word that is neither — that is prose
  }
  return false;
}

// ------------------------------------------------------------------ checking

const problems = [];
let transitions = 0, invariants = 0, guardsOk = 0, effectsOk = 0, exprOk = 0;

if (vocab.size === 0) {
  problems.push('no expression vocabulary found: §3.1 must declare the terms the expressions may use');
}

// --- §14 transitions
for (const t of tables) {
  if (t.section !== '14') continue;
  const cId = col(t.headers, 'Transition ID');
  if (cId < 0) continue;

  const cGuard = col(t.headers, 'Guard (expression)');
  const cEffect = col(t.headers, 'Effect (expression)');
  const cFrom = col(t.headers, 'From');
  const cTo = col(t.headers, 'To');

  if (cGuard < 0) {
    problems.push('a §14 table has no "Guard (expression)" column: the guards cannot be evaluated');
    continue;
  }

  for (const r of t.rows) {
    const id = cell(r, cId);
    if (!/^TR-\d+/.test(id)) continue;
    transitions++;

    const guard = unquote(cell(r, cGuard));
    if (!guard) {
      problems.push(id + ': no guard expression');
    } else if (/not\s+expressible/i.test(guard)) {
      if (!reasonFor(guard)) {
        problems.push(id + ': the guard is "not expressible" with no reason — say what would be needed');
      }
    } else {
      const bad = unresolvedTerms(guard);
      const types = typeProblems(guard);
      if (bad.length > 0) {
        problems.push(id + ': guard names a term the vocabulary does not define: ' + bad.join(', '));
      } else if (types.length > 0) {
        problems.push(id + ': guard — ' + types.join('; '));
      } else {
        guardsOk++;
      }
    }

    // An effect may be empty - a transition that only moves state. It may not
    // be unresolvable.
    if (cEffect >= 0) {
      const effect = unquote(cell(r, cEffect));
      if (effect && !/not\s+expressible/i.test(effect)) {
        const bad = unresolvedTerms(effect);
        const types = typeProblems(effect);
        if (bad.length > 0) {
          problems.push(id + ': effect names a term the vocabulary does not define: ' + bad.join(', '));
        } else if (types.length > 0) {
          problems.push(id + ': effect — ' + types.join('; '));
        } else {
          effectsOk++;
        }
      }
    }

    // Every state a transition names must exist.
    for (const index of [cFrom, cTo]) {
      if (index < 0) continue;
      const ids = cell(r, index).match(/\bST-\d+\b/g) || [];
      for (const sid of ids) {
        if (!stateIds.has(sid)) {
          problems.push(id + ': names state ' + sid + ', which §13 does not define');
        }
      }
    }
  }
}

// --- §15 invariants
for (const t of tables) {
  if (t.section !== '15') continue;
  const cId = col(t.headers, 'ID');
  if (cId < 0) continue;

  const cExpr = col(t.headers, 'Formal expression');
  const cScope = col(t.headers, 'States / Transitions');

  if (cExpr < 0) {
    problems.push('§15 has no "Formal expression" column: the invariants cannot be checked');
    continue;
  }

  for (const r of t.rows) {
    const id = cell(r, cId);
    if (!/^INV-\d+/.test(id)) continue;
    invariants++;

    const expr = unquote(cell(r, cExpr));
    if (!expr) {
      problems.push(id + ': no formal expression');
    } else if (/not\s+expressible/i.test(expr)) {
      if (!reasonFor(expr)) {
        problems.push(id + ': is "not expressible" with no reason — say what would be needed');
      }
    } else {
      const bad = unresolvedTerms(expr);
      const types = typeProblems(expr);
      if (bad.length > 0) {
        problems.push(id + ': expression names a term the vocabulary does not define: ' + bad.join(', '));
      } else if (types.length > 0) {
        problems.push(id + ': expression — ' + types.join('; '));
      } else {
        exprOk++;
      }
    }

    // The invariant must say where it is in force.
    if (cScope >= 0) {
      const scope = cell(r, cScope);
      const hasId = /\b(?:ST|TR)-\d+\b/.test(scope);
      const hasAll = /all\s+states/i.test(scope);
      const hasName = stateNames.some(n => n.length > 3 && scope.indexOf(n) >= 0);
      if (!hasId && !hasAll && !hasName) {
        problems.push(id + ': its States / Transitions cell names neither a state, a transition, nor "All states"');
      }
    }
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
