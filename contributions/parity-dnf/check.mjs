import assert from 'node:assert/strict';

function* normalizedTerms(length) {
  if (length === 0) {
    yield [];
    return;
  }
  for (const tail of normalizedTerms(length - 1)) {
    for (const literal of [undefined, false, true]) {
      yield [literal, ...tail];
    }
  }
}

function assignments(length) {
  return Array.from({ length: 2 ** length }, (_, mask) =>
    Array.from({ length }, (_, bit) => (mask & (1 << bit)) !== 0)
  );
}

function matches(term, input) {
  return term.every((literal, variable) => literal === undefined || literal === input[variable]);
}

function oddParity(input) {
  return input.filter(Boolean).length % 2 === 1;
}

function xorChain(input) {
  return input.reduce((a, b) => (a && !b) || (!a && b));
}

for (let n = 1; n <= 6; n++) {
  const table = assignments(n).map(input => ({ input, odd: oddParity(input) }));
  const terms = [...normalizedTerms(n)];
  const admissible = [];
  for (const term of terms) {
    const matched = table.filter(row => matches(term, row.input));
    if (matched.some(row => !row.odd)) continue;
    assert.equal(matched.length, 1, `Every admissible term must cover one row at n=${n}`);
    admissible.push(term);
  }

  assert.equal(terms.length, 3 ** n);
  assert.equal(admissible.length, 2 ** (n - 1));
  for (const { input, odd } of table) {
    assert.equal(admissible.some(term => matches(term, input)), odd, `DNF at input ${input}`);
    assert.equal(xorChain(input), odd, `XOR chain at input ${input}`);
  }
  console.log(`n=${n} | assignments ${table.length} | terms scanned ${terms.length} | minimum DNF terms ${admissible.length}`);
}
