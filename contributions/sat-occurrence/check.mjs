import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function occurrences(formula) {
  if (!Array.isArray(formula)) throw new Error('A formula must be an array of clauses.');
  const counts = new Map();
  for (const clause of formula) {
    if (!Array.isArray(clause) || clause.length !== 3 ||
        !clause.every(value => Number.isSafeInteger(value) && value !== 0) ||
        new Set(clause.map(Math.abs)).size !== 3) {
      throw new Error('Each clause needs three nonzero signed integers with distinct absolute values.');
    }
    for (const literal of clause) {
      const variable = Math.abs(literal);
      counts.set(variable, (counts.get(variable) ?? 0) + 1);
    }
  }
  return counts;
}

function matchClauses(formula) {
  const owner = new Map();
  function augment(clause, visited) {
    for (const literal of formula[clause]) {
      const variable = Math.abs(literal);
      if (visited.has(variable)) continue;
      visited.add(variable);
      if (!owner.has(variable) || augment(owner.get(variable), visited)) {
        owner.set(variable, clause);
        return true;
      }
    }
    return false;
  }
  for (let clause = 0; clause < formula.length; clause++) {
    if (!augment(clause, new Set())) return null;
  }
  const witnesses = Array(formula.length);
  for (const [variable, clause] of owner) {
    witnesses[clause] = formula[clause].find(literal => Math.abs(literal) === variable);
  }
  return witnesses;
}

function verifyWitness(formula, witnesses, variables) {
  assert.equal(witnesses.length, formula.length);
  const assignment = new Map([...variables].map(variable => [variable, false]));
  const used = new Set();
  for (const [index, literal] of witnesses.entries()) {
    const variable = Math.abs(literal);
    assert.ok(formula[index].includes(literal));
    assert.ok(!used.has(variable));
    used.add(variable);
    assignment.set(variable, literal > 0);
  }
  assert.ok(formula.every(clause => clause.some(literal =>
    assignment.get(Math.abs(literal)) === (literal > 0)
  )));
  return assignment;
}

// Independent oracle for the bounded four-variable experiment. Examine each truth row
// and read signed literals directly, without using the incidence graph or its matching.
function truthTableCount(formula) {
  let solutions = 0;
  for (let row = 0; row < 16; row++) {
    const satisfied = formula.every(clause => clause.some(literal => {
      const bit = (row >> (Math.abs(literal) - 1)) & 1;
      return literal > 0 ? bit === 1 : bit === 0;
    }));
    if (satisfied) solutions++;
  }
  return solutions;
}

function allClauses() {
  const clauses = [];
  for (let missing = 1; missing <= 4; missing++) {
    const variables = [1, 2, 3, 4].filter(variable => variable !== missing);
    for (let signs = 0; signs < 8; signs++) {
      clauses.push(variables.map((variable, position) =>
        ((signs >> position) & 1) === 1 ? variable : -variable
      ));
    }
  }
  return clauses;
}

function runExperiment() {
  const clauses = allClauses();
  const bySize = Array(5).fill(0);
  function enumerate(formula, next) {
    const counts = occurrences(formula);
    if (Array.from(counts.values()).some(count => count > 3)) return;
    const witnesses = matchClauses(formula);
    assert.ok(witnesses);
    verifyWitness(formula, witnesses, counts.keys());
    assert.ok(truthTableCount(formula) > 0);
    bySize[formula.length]++;
    if (formula.length === 4) return;
    for (let index = next; index < clauses.length; index++) {
      enumerate([...formula, clauses[index]], index + 1);
    }
  }
  enumerate([], 0);
  // With four clauses, every variable must be absent from exactly one.
  assert.deepEqual(bySize, [1, 32, 496, 4960, 8 ** 4]);
  console.log(`Counts at 0–4 clauses: ${bySize.join(', ')}.`);
  console.log(`Matching witnesses and truth tables agree on all ${bySize.reduce((sum, count) => sum + count)} formulas.`);

  const extension = [[1, 2, 3], [1, -2, 3], [1, 2, -3], [1, -2, -3]];
  assert.ok([...occurrences(extension).values()].every(count => count === 4));
  assert.equal(matchClauses(extension), null);
  // The fourth variable is absent. The truth table counts each 3-bit solution twice.
  assert.equal(truthTableCount(extension), 8);
  console.log('Four-occurrence fixture: no clause-saturating matching, 4 satisfying assignments on its 3 variables.');
  assert.throws(() => occurrences([[1, -1, 2]]));
}

// With a JSON file, check a contributor's formula and print its witness when available.
if (process.argv.length === 2) {
  runExperiment();
} else if (process.argv.length === 3) {
  const formula = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const counts = occurrences(formula);
  const witnesses = matchClauses(formula);
  if (witnesses) {
    const assignment = verifyWitness(formula, witnesses, counts.keys());
    console.log(JSON.stringify({ witnesses, assignment: Object.fromEntries(assignment) }));
  } else {
    assert.ok([...counts.values()].some(count => count > 3));
    console.log('No clause-saturating matching. Satisfiability is undetermined by this method.');
  }
} else {
  throw new Error('Usage: node check.mjs [formula.json]');
}
