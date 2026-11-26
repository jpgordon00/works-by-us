# Where does matching stop solving 3-SAT?

A Boolean formula can have a proposed solution that takes just a few checks to verify, while finding one is much harder. P versus NP asks whether every decision problem with polynomial-time verifiable yes-certificates has a polynomial-time decision algorithm. This starter reproduces a sharp boundary for 3-SAT. If each clause contains three distinct variables and each variable occurs at most three times, a matching constructs a solution. With up to four occurrences per variable, the decision problem is NP-complete. [Clay Mathematics Institute](https://www.claymath.org/millennium/p-vs-np/) · [Tovey’s theorem](https://doi.org/10.1016/0166-218X(84)90081-7)

## Why three works

Put clauses on the left of a bipartite graph and variables on the right. Connect each clause to its three variables. Any set of `s` clauses has `3s` incident edges. Each neighboring variable receives at most three, so those clauses have at least `s` different neighbors. By Hall’s marriage theorem there is a matching that assigns a different variable to every clause. Set each chosen variable to make its literal true in its matched clause. Every clause now has a true literal.

## Reproduce

```sh
node contributions/sat-occurrence/check.mjs
```

The checker exhausts **9,585 formulas** on four named variables with distinct clauses and at most three occurrences per variable. There are 1, 32, 496, 4,960 and 4,096 formulas with zero through four clauses respectively. More clauses would exceed the occurrence limit. An augmenting-path algorithm finds a matching in each case. The checker verifies each chosen edge, the distinctness of the chosen variables and the final truth assignment. A separate truth-table calculation checks all 16 assignments for every formula.

To check your own formula, put its clauses in a JSON file and pass the path as the final argument. For example, `[[1,-2,3],[-1,2,4]]` means `(x OR ¬y OR z) AND (¬x OR y OR w)`. The checker prints a signed witness literal per clause and a truth assignment when it finds a matching.

## What changes at four?

Take all four clauses of the form `(x OR ±y OR ±z)`, using each choice of signs exactly once. There are four clauses but only three variables, so a matching cannot cover all clauses. Set `x` to true and all four clauses hold for every choice of `y,z`. This gives four satisfying assignments. The fixture isolates a precise failure of the matching method. Tovey’s complexity theorem concerns the full four-occurrence family.

A next contribution could handle assignments that serve multiple clauses with the same literal. Specify an extension rule, use these four clauses as a first case, then compare its output with exhaustive truth tables on small formulas. Publish a certificate for the inputs it handles and the smallest counterexample you find to any wider claim.
