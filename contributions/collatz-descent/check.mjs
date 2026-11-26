import assert from 'node:assert/strict';

const options = process.argv.slice(2);
const printCertificates = options.includes('--certificates');
const positional = options.filter(option => option !== '--certificates');
const depthLimit = Number(positional[0] ?? 12);
if (positional.length > 1 || !Number.isInteger(depthLimit) || depthLimit < 1 || depthLimit > 18) {
  throw new Error('Usage: node check.mjs [depth from 1 to 18] [--certificates]');
}

// Each parity letter includes one division by two. O first applies 3n+1.
function step(value) {
  return value % 2n === 0n ? value / 2n : (3n * value + 1n) / 2n;
}

// A state describes the exact iterate a*k+b on starts modulus*k+residue.
// Adding the next low bit e replaces k by 2*k+e. Its parity is then fixed.
function extend(state, bit) {
  const offset = state.b + bit * state.a;
  const odd = offset % 2n !== 0n;
  return {
    modulus: state.modulus * 2n,
    residue: state.residue + bit * state.modulus,
    a: odd ? 3n * state.a : state.a,
    b: step(offset),
    path: state.path + (odd ? 'O' : 'E')
  };
}

function descends({ a, b, modulus, residue }) {
  const firstK = residue < 2n ? 1n : 0n;
  return a <= modulus && a * firstK + b < modulus * firstK + residue;
}

// Independent check. Replay the parity word directly on n = modulus*k+residue,
// carrying both affine coefficients forward, with a divisibility test at each step.
function verifyState(state) {
  let coefficient = state.modulus;
  let constant = state.residue;
  for (const letter of state.path) {
    assert.equal(coefficient % 2n, 0n);
    assert.equal(constant % 2n, letter === 'O' ? 1n : 0n);
    if (letter === 'O') {
      coefficient *= 3n;
      constant = 3n * constant + 1n;
    }
    coefficient /= 2n;
    constant /= 2n;
  }
  assert.equal(coefficient, state.a);
  assert.equal(constant, state.b);
  const firstK = state.residue < 2n ? 1n : 0n;
  for (const k of [firstK, firstK + 1n]) {
    let value = state.modulus * k + state.residue;
    for (let i = 0; i < state.path.length; i++) value = step(value);
    assert.equal(value, coefficient * k + constant);
  }
}

let unresolved = [{ modulus: 1n, residue: 0n, a: 1n, b: 0n, path: '' }];
const certificates = [];
const byDepth = [];
for (let depth = 1; depth <= depthLimit; depth++) {
  const next = [];
  const before = certificates.length;
  for (const parent of unresolved) {
    for (const bit of [0n, 1n]) {
      const child = extend(parent, bit);
      verifyState(child);
      if (descends(child)) certificates.push(child);
      else next.push(child);
    }
  }
  byDepth.push(certificates.length - before);
  unresolved = next;
}

// Mark every residue individually to verify disjointness and complete accounting.
const modulus = 2 ** depthLimit;
const coverage = new Uint8Array(modulus);
for (const state of certificates) {
  for (let i = Number(state.residue); i < modulus; i += Number(state.modulus)) {
    assert.equal(coverage[i], 0);
    coverage[i] = 1;
  }
}
for (const state of unresolved) {
  assert.equal(coverage[Number(state.residue)], 0);
  coverage[Number(state.residue)] = 2;
}
assert.ok(coverage.every(value => value !== 0));
const covered = coverage.filter(value => value === 1).length;
assert.equal(covered + unresolved.length, modulus);
assert.equal(byDepth[0], 1);
if (depthLimit >= 2) {
  const example = certificates.find(state => state.modulus === 4n && state.residue === 1n);
  assert.deepEqual([example.path, example.a, example.b], ['OE', 3n, 1n]);
}
if (printCertificates) {
  console.log('modulus,residue,parity_path,final_coefficient,final_constant');
  for (const { modulus, residue, path, a, b } of certificates) {
    console.log([modulus, residue, path, a, b].join(','));
  }
} else {
  console.log(`Depth ${depthLimit}, modulus ${modulus}.`);
  console.log(`New certificates by depth: ${byDepth.join(', ')}.`);
  console.log(`${certificates.length} disjoint certificates cover ${covered} of ${modulus} residue classes.`);
  console.log(`${unresolved.length} residue classes remain uncertified at this depth.`);
}
