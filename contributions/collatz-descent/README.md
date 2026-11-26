# Which Collatz starting values can we prove will drop?

The Collatz conjecture asks whether every positive integer eventually reaches 1. If every starting value above 1 eventually falls below where it began, strong induction gives the conjecture. This starter proves that first drop for whole families of numbers at a time. At a depth of 12, it covers **3,870 of the 4,096 residue classes modulo 4,096** with 57 disjoint certificates. The other 226 classes remain to analyze. [Terras, *A stopping time problem on the positive integers*](https://doi.org/10.4064/aa-30-3-241-252)

## A certificate you can check by hand

Start with any number of the form `4k + 1`, with `k ≥ 1`. The odd rule and two divisions by two take it through the following values.

```text
4k + 1 → 12k + 4 → 6k + 2 → 3k + 1
```

Since `3k + 1 < 4k + 1`, this proves descent for infinitely many starts. The checker writes this path as `OE`. Here `O` means an odd step followed by its guaranteed division by two, and `E` means one even division by two.

## Reproduce

From the repository root, run these commands with Node.js. The second prints all certificates as CSV. Depths 1 through 18 are supported.

```sh
node contributions/collatz-descent/check.mjs
node contributions/collatz-descent/check.mjs 12 --certificates
```

Each CSV row gives a modulus `m`, a residue `r`, a parity path and the coefficients `a,b` of the final value. On every allowed start `mk+r > 1` with `k ≥ 0`, that path leads to `ak+b`. The checker builds the two residue classes modulo `2m` inside each remaining class modulo `m`. It keeps a class at the first depth where the entire class is certified. This makes the certificates disjoint.

For each row, a second calculation replays the parity word on the whole affine expression. It checks at each step that all members have the required parity. To prove strict descent, compare the two expressions at the smallest allowed `k` and check that `a ≤ m`. The difference `(a−m)k+b−r` can only stay the same or decrease for larger `k`. The checker expands each accepted row into residues at the target depth to check the counts and disjointness.

## Take the next case

Start with `n ≡ 27 (mod 4096)`, one of the 226 survivors. Its two children are `n ≡ 27` and `n ≡ 4123 (mod 8192)`. Audit the second child first. One of its descendants is `n = 32768k + 20507`. At depth 15 the checker predicts the endpoint `19683k + 12319`. Derive its parity path independently, then check which siblings still survive. For each subclass you resolve, publish its modulus, residue, parity word, final affine expression and strict inequality. Try to explain several remaining branches with one parameterized argument. A finite coverage result leaves open what happens to starts outside the covered classes. [Bařina’s published numerical verification](https://doi.org/10.1007/s11227-025-07337-0)
