# Can a checker reproduce the reduction from 3-SAT to CLIQUE?

The SAT and CLIQUE searches agreed on all 1,773 formulas. The checker also translated one witness in each direction for every satisfiable case. It independently enumerates truth assignments for the original formula and searches for a clique using only the resulting graph and target size.

## Construction and proof

A 3-SAT formula is an AND of clauses, each an OR of three literal occurrences. A literal is a variable or its negation. For a formula with `m` clauses, create three vertices for each clause, one per occurrence, and set the clique target to `m`. Join two vertices exactly when they come from different clauses and their labels are compatible. Compatible labels name different variables or agree in both variable and sign.

- Given a satisfying assignment, choose a true occurrence from each clause. All choices belong to different clauses and no true literal can be the negation of another true literal. Every pair has an edge, giving a clique of size `m`.
- Given a clique of size `m`, its vertices belong to distinct clauses because there are no edges within a clause. It therefore contains one occurrence per clause. Set each selected variable to make its selected literal true. The edges ensure that repeated selections of a variable agree. Assign every remaining variable arbitrarily. Each clause now contains a true selected literal.

There are `3m` vertices and at most `9m(m − 1)/2` edges. The construction examines at most `(3m)(3m − 1)/2` pairs, with a clause index and a variable label comparison per pair. The number of checks and the output size are polynomial in the input length. The checker includes the empty formula as satisfiable with an empty clique. A CLIQUE convention that requires a positive target can map that case to one vertex with target 1.

## Reproduce

From the repository root, run with Node.js.

```sh
node contributions/3sat-clique/check.mjs
```

```text
Two-variable formula classes: 1771 (1705 SAT, 66 UNSAT).
Three-variable fixtures: 2 (1 SAT, 1 UNSAT).
Decisions agreed on all cases and both witness conversions passed for every SAT case.
```

The first group exhausts formulas over two named variables with up to three clauses, allowing repeated literals and clauses and ignoring their order. The second group uses clauses with three distinct variables. Taking all eight sign patterns rules out every assignment. Removing the all-negative clause admits the all-true assignment. The exhaustive searches apply only to these bounded cases. The construction is a known polynomial-time reduction and P versus NP remains open. [MIT theory of computation lecture](https://ocw.mit.edu/courses/18-404j-theory-of-computation-fall-2020/c1aca7046a69c913721e5eb910a5fb21_MIT18_404f20_lec15.pdf), [Clay Mathematics Institute](https://www.claymath.org/millennium/p-vs-np/)
