// A small, reproducible run of the construction in contributions/3sat-clique.
// Each call to next() does the work for that frame. No timers or I/O live here.
export function* runCliqueExperiment() {
  const formula = [[-1, 2, 3], [1, 1, 1], [-2, -2, -2], [-3, 1, 2]];
  const vertices = formula.flatMap((literals, clause) =>
    literals.map((literal, offset) => ({ id: clause * 3 + offset, clause, literal }))
  );
  const edges = [];
  const neighbors = vertices.map(() => new Set());
  const checks = [];
  let seq = 0;

  function frame(phase, title, detail, highlighted = [], assignment = null) {
    return structuredClone({
      seq: ++seq, phase, title, detail, formula, vertices, edges, highlighted, assignment, checks
    });
  }
  function label(vertex) {
    const { literal } = vertices[vertex];
    return (literal < 0 ? '¬' : '') + 'x' + Math.abs(literal);
  }
  function trueOccurrences(assignment) {
    return formula.map((_, clause) => vertices.findIndex(vertex =>
      vertex.clause === clause && assignment[Math.abs(vertex.literal) - 1] === (vertex.literal > 0)
    ));
  }
  function isClique(ids) {
    return ids.length === formula.length && ids.every((id, i) =>
      neighbors[id] && ids.slice(i + 1).every(other => neighbors[id].has(other))
    );
  }

  yield frame('setup', 'Build a four-clause test',
    'Each dot is one occurrence of a variable or its negation. Can four mutually connected dots give a solution to all four clauses?');

  for (let clause = 1; clause < formula.length; clause++) {
    const newVertices = vertices.filter(vertex => vertex.clause === clause);
    const before = edges.length;
    for (const right of newVertices) {
      for (const left of vertices) {
        if (left.clause >= clause || left.literal === -right.literal) continue;
        edges.push([left.id, right.id]);
        neighbors[left.id].add(right.id);
        neighbors[right.id].add(left.id);
      }
    }
    yield frame('graph', 'Connect clause ' + (clause + 1),
      'Added ' + (edges.length - before) + ' edges to compatible occurrences in earlier clauses.',
      newVertices.map(vertex => vertex.id));
  }

  const variables = Math.max(...formula.flat().map(Math.abs));
  let satisfyingAssignment;
  let selected;
  for (let mask = 0; mask < 2 ** variables; mask++) {
    const assignment = Array.from({ length: variables }, (_, i) => Boolean(mask & (1 << i)));
    const hits = trueOccurrences(assignment).filter(id => id >= 0);
    yield frame('search', 'Try assignment ' + (mask + 1),
      assignment.map((value, i) => 'x' + (i + 1) + ' = ' + value).join(', ') +
      '. This satisfies ' + hits.length + ' of ' + formula.length + ' clauses.', hits, assignment);
    if (hits.length === formula.length) {
      satisfyingAssignment = assignment;
      selected = hits;
      break;
    }
  }

  // This search sees only adjacency and the target size. It never consults
  // the SAT assignment, vertex labels, or clause memberships.
  function extend(chosen, candidates) {
    if (chosen.length === formula.length) return chosen;
    const needed = formula.length - chosen.length;
    for (let i = 0; i <= candidates.length - needed; i++) {
      const id = candidates[i];
      const next = candidates.slice(i + 1).filter(other => neighbors[id].has(other));
      const clique = extend([...chosen, id], next);
      if (clique) return clique;
    }
  }
  let clique;
  for (const { id } of vertices) {
    const candidates = [...neighbors[id]].filter(other => other > id).sort((a, b) => a - b);
    yield frame('search', 'Search from vertex ' + (id + 1),
      'Start at ' + label(id) + ' and test its ' + candidates.length + ' later neighbors for a four-vertex clique.', [id]);
    clique = extend([id], candidates);
    if (clique) {
      yield frame('search', 'Found four connected vertices',
        'The graph search found ' + clique.map(label).join(', ') + ' without reading the truth assignment.', clique);
      break;
    }
    yield frame('search', 'Backtrack from vertex ' + (id + 1),
      'The graph search exhausted this branch without finding four mutually connected vertices.', [id]);
  }

  checks.push({ label: 'Both searches found a solution', passed: Boolean(satisfyingAssignment && clique) });
  checks.push({ label: 'Assignment produces a four-vertex clique', passed: Boolean(selected && isClique(selected)) });
  yield frame('verify', 'Map the assignment to the graph',
    'Choose one true occurrence in each clause and check every pair for an edge.', selected, satisfyingAssignment);

  const recovered = Array(variables).fill(false);
  for (const id of clique ?? []) {
    const { literal } = vertices[id];
    recovered[Math.abs(literal) - 1] = literal > 0;
  }
  const recoveredSatisfies = trueOccurrences(recovered).every(id => id >= 0);
  checks.push({ label: 'Clique gives a satisfying assignment', passed: Boolean(clique && isClique(clique) && recoveredSatisfies) });
  yield frame('verify', 'Map the clique back to the formula',
    'Set the selected literals to true and evaluate all four clauses again.', clique, recovered);

  const passed = checks.every(check => check.passed);
  yield frame('complete', passed ? 'Both witnesses verified' : 'Witness check failed',
    passed ? 'The two independent searches agree on this four-clause example.' : 'Inspect the witness checks for this four-clause example.',
    clique, recovered);
}
