import assert from 'node:assert/strict';

function reduceToClique(formula) {
  const vertices = formula.flatMap((literals, clause) =>
    literals.map(literal => ({ clause, literal }))
  );
  const neighbors = vertices.map(() => new Set());
  for (let left = 0; left < vertices.length; left++) {
    for (let right = left + 1; right < vertices.length; right++) {
      const a = vertices[left];
      const b = vertices[right];
      if (a.clause !== b.clause && a.literal !== -b.literal) {
        neighbors[left].add(right);
        neighbors[right].add(left);
      }
    }
  }
  return { vertices, neighbors, size: formula.length };
}

function literalIsTrue(literal, assignment) {
  return assignment.get(Math.abs(literal)) === (literal > 0);
}

function satisfies(formula, assignment) {
  return formula.every(clause => clause.some(literal => literalIsTrue(literal, assignment)));
}

function findAssignment(formula, variables) {
  for (let mask = 0; mask < 2 ** variables.length; mask++) {
    const assignment = new Map(variables.map((variable, index) => [
      variable,
      Math.floor(mask / 2 ** index) % 2 === 1
    ]));
    if (satisfies(formula, assignment)) return assignment;
  }
}

function findClique({ neighbors, size }) {
  function search(chosen, remaining) {
    if (chosen.length === size) return chosen;
    const needed = size - chosen.length;
    for (let i = 0; i <= remaining.length - needed; i++) {
      const vertex = remaining[i];
      const candidates = remaining.slice(i + 1).filter(other => neighbors[vertex].has(other));
      const witness = search([...chosen, vertex], candidates);
      if (witness) return witness;
    }
  }
  return search([], neighbors.map((_, index) => index));
}

function checkFormula(formula, expected) {
  const variables = [...new Set(formula.flat().map(Math.abs))];
  const graph = reduceToClique(formula);
  const assignment = findAssignment(formula, variables);
  const clique = findClique(graph);
  const label = JSON.stringify(formula);
  assert.equal(Boolean(assignment), Boolean(clique), label);
  if (expected !== undefined) assert.equal(Boolean(assignment), expected, label);
  if (!assignment) return false;

  const fromAssignment = formula.map((_, clause) => graph.vertices.findIndex(vertex =>
    vertex.clause === clause && literalIsTrue(vertex.literal, assignment)
  ));
  assert.ok(fromAssignment.every(vertex => vertex >= 0), label);
  assert.ok(fromAssignment.every((left, index) =>
    fromAssignment.slice(index + 1).every(right => graph.neighbors[left].has(right))
  ), label);

  const fromClique = new Map();
  for (const vertex of clique) {
    const { literal } = graph.vertices[vertex];
    const variable = Math.abs(literal);
    if (fromClique.has(variable)) assert.equal(fromClique.get(variable), literal > 0, label);
    fromClique.set(variable, literal > 0);
  }
  for (const variable of variables) {
    if (!fromClique.has(variable)) fromClique.set(variable, false);
  }
  assert.ok(satisfies(formula, fromClique), label);
  return true;
}

function* multisets(items, size, start = 0) {
  if (size === 0) {
    yield [];
    return;
  }
  for (let i = start; i < items.length; i++) {
    for (const tail of multisets(items, size - 1, i)) {
      yield [items[i], ...tail];
    }
  }
}

const clauses = [...multisets([-2, -1, 1, 2], 3)];
let sat = 0;
let unsat = 0;
for (let size = 0; size <= 3; size++) {
  for (const formula of multisets(clauses, size)) {
    if (checkFormula(formula)) sat++;
    else unsat++;
  }
}
assert.equal(sat + unsat, 1771);
assert.ok(sat > 0 && unsat > 0);

const everySignPattern = [];
for (const x of [-1, 1]) {
  for (const y of [-2, 2]) {
    for (const z of [-3, 3]) everySignPattern.push([x, y, z]);
  }
}
// Each clause rules out a different assignment. Dropping the first frees one.
checkFormula(everySignPattern, false);
checkFormula(everySignPattern.slice(1), true);

console.log(`Two-variable formula classes: ${sat + unsat} (${sat} SAT, ${unsat} UNSAT).`);
console.log('Three-variable fixtures: 2 (1 SAT, 1 UNSAT).');
console.log('Decisions agreed on all cases and both witness conversions passed for every SAT case.');
