import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runCliqueExperiment } from '../src/watch-experiment.mjs';

test('reconnecting can reproduce every frame and a viewer cannot alter a running search', () => {
  const frames = Array.from(runCliqueExperiment());
  assert.deepEqual(frames.map(frame => frame.seq), frames.map((_, i) => i + 1));
  assert.equal(frames[0].edges.length, 0);
  assert.equal(frames[0].checks.length, 0);
  const run = runCliqueExperiment();
  const first = run.next().value;
  first.formula[0][0] = 0;
  first.vertices.pop();
  assert.deepEqual(Array.from(run), frames.slice(1));
});

test('the completed graph and both witness conversions agree with independent checks', () => {
  const frames = Array.from(runCliqueExperiment());
  const final = frames.at(-1);
  const { vertices, edges, formula, highlighted, assignment, checks } = final;
  assert.equal(final.phase, 'complete');
  assert.deepEqual(checks.map(check => check.passed), [true, true, true]);
  const edgeKeys = new Set(edges.map(([a, b]) => a + ',' + b));
  assert.equal(edges.length, edgeKeys.size);
  for (const a of vertices) {
    for (const b of vertices.filter(vertex => vertex.id > a.id)) {
      assert.equal(edgeKeys.has(a.id + ',' + b.id), a.clause !== b.clause && a.literal !== -b.literal);
    }
  }
  const values = [false, true];
  const solutions = [];
  for (const x of values) for (const y of values) for (const z of values) {
    const candidate = [x, y, z];
    if (formula.every(clause => clause.some(literal => candidate[Math.abs(literal) - 1] === (literal > 0)))) {
      solutions.push(candidate);
    }
  }
  assert.deepEqual(solutions, [assignment]);
  assert.equal(new Set(highlighted.map(id => vertices[id].clause)).size, formula.length);
  for (const a of highlighted) for (const b of highlighted.filter(id => id > a)) {
    assert.ok(edgeKeys.has(a + ',' + b));
  }
  assert.ok(frames.some(frame => frame.title.startsWith('Backtrack')));
});
