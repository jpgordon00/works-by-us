# How many DNF terms does odd parity need?

On `n ≥ 1` inputs, odd parity returns 1 exactly when an odd number of input bits are 1. The minimum disjunctive normal form (DNF) for this function has exactly `2^(n − 1)` terms.

## Proof

A DNF is an OR of terms. Each term is an AND of literals, where a literal is a variable or its negation. Here, size counts terms, and the AND and OR can each accept any number of inputs. Delete repeated literals within a term and discard any term containing a variable and its negation, since it always evaluates to 0. A normalized surviving term now either fixes a variable's bit or leaves it free.

If a term leaves one bit free, take any assignment satisfying that term and flip the free bit. The term still evaluates to 1. Exactly one of the two assignments has even parity, so including the term gives an incorrect DNF output there. This uses two properties of the model. A conjunction of literals that omits a variable is unaffected by flipping that variable, and a single true term forces the top-level OR to 1. Therefore, every surviving term fixes all `n` bits and covers at most one assignment. Pairing all assignments by flipping the first bit shows that exactly `2^(n − 1)` have odd parity, so at least that many terms are required.

For the matching construction, take one term for each odd assignment. In that term, include the positive literal for each 1 bit and the negated literal for each 0 bit. The OR of those terms accepts exactly the odd assignments. [Ryan Williams's circuit lower bounds course, Claim 2.1](https://people.csail.mit.edu/rrw/cs294-2018/ac0-switching-lemma.pdf)

## Scope

Unrestricted circuits can feed one gate's output into further gates and use those intermediate outputs more than once. The fixed-bit argument applies to conjunctions of original input literals whose truth forces the final output. General circuits have no such requirement. In fact, chaining `n − 1` two-input XORs computes parity. Each XOR can use at most five Boolean gates via `(a AND NOT b) OR (NOT a AND b)`, yielding at most `5(n − 1)` two-input AND/OR and unary NOT gates overall. The separate question of an `Ω(n log n)` unrestricted Boolean circuit lower bound for a language in `E^NP`, deterministic `2^{O(n)}` time with an NP oracle, remains open in the cited preprint. [Chukhin et al., Open Problem 1](https://eccc.weizmann.ac.il/report/2026/313/)

## Reproduce

From the repository root, run with Node.js.

```sh
node contributions/parity-dnf/check.mjs
```

```text
n=1 | assignments 2 | terms scanned 3 | minimum DNF terms 1
n=2 | assignments 4 | terms scanned 9 | minimum DNF terms 2
n=3 | assignments 8 | terms scanned 27 | minimum DNF terms 4
n=4 | assignments 16 | terms scanned 81 | minimum DNF terms 8
n=5 | assignments 32 | terms scanned 243 | minimum DNF terms 16
n=6 | assignments 64 | terms scanned 729 | minimum DNF terms 32
```

The checker exhausts the `3^n` choices of positive literal, negative literal or omission for each input, including the empty term. It evaluates every term against the independently generated parity truth table and keeps just the terms that never accept an even assignment. It verifies that each of those terms covers precisely one row and that their OR covers every odd row. It also checks the XOR chain against every row. The finite check covers input lengths 1 through 6. The proof above handles every positive input length.
