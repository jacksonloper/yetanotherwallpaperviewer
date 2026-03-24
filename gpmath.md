# From Lattice + Generators to a Group-Invariant Function

This document describes the full mathematical pipeline used to construct a
smooth, random function on ℝ² that is exactly invariant under a given
wallpaper group.  The implementation lives in `src/math/gaussianProcess.js`
and relies on the rational group enumeration in `src/math/rationalGroup.js`
and the exact rational arithmetic in `src/math/rational.js`.

---

## 1. Setup: lattice and wallpaper group

A **wallpaper group** G is a discrete group of isometries of ℝ² whose
translation subgroup T is a rank-2 lattice.  We fix a lattice basis

> **v₁** = (0, 1),  **v₂** = (x, y)

so T = { m **v₁** + n **v₂** : m, n ∈ ℤ }.  The non-translation part of G
is specified by a finite list of **generators** — rotations, reflections,
and glide reflections — given as rational 3×3 affine matrices in lattice
coordinates (see `rationalGroup.js`).

### 1a. Rational number representation

To enumerate G/T exactly (no floating-point rounding), all arithmetic is
done with **exact rational numbers**.  A rational number is stored as a
pair [n, d] where n is the integer numerator and d is the integer
denominator (always > 0, always in lowest terms with gcd(|n|, d) = 1;
zero is [0, 1]).  Standard operations — add, subtract, multiply, divide,
negate, equality test — are implemented exactly.

(`rat()`, `radd()`, `rsub()`, `rmul()`, `rdiv()`, `rneg()`, `req()` in
rational.js.)

### 1b. Rational affine matrices

An isometry of the lattice-coordinate plane is represented as a 3×3
rational affine matrix:

```
[ a   b   tx ]
[ c   d   ty ]
[ 0   0    1 ]
```

where a, b, c, d, tx, ty are each rational numbers [n, d].  The top-left
2×2 block [[a, b], [c, d]] is the **linear part** (rotation or
reflection in lattice coordinates) and (tx, ty) is the **translation
part**.

The key operations are:

- **Composition** `rcompose(A, B)`: returns A ∘ B (apply B first, then A).
  The linear part is the matrix product of the two 2×2 blocks; the
  translation combines as A_linear · B_trans + A_trans.
- **Inverse** `rinverse(A)`: inverts the 2×2 block via det and applies
  the corresponding translation correction.
- **Equality** `rmatEqual(A, B)`: exact componentwise rational comparison.
- **Reduce mod T** `rmodT(A)`: keeps the linear part unchanged, reduces
  tx and ty modulo 1 to [0, 1).  This is the projection to G/T.

### 1c. How generators are specified

For each of the 17 wallpaper types, the non-translation generators are
listed in `STANDARD_GENERATORS` (in rationalGroup.js) as rational affine
matrices constructed by `rimat(a, b, c, d, txn, txd, tyn, tyd)`.  The
linear parts (a, b, c, d) are always integers in GL(2, ℤ) — they
preserve the lattice.  The translation parts are rational with
denominators at most 2 (i.e. 0 or ½).

The key linear parts in lattice coordinates:

| Symbol | Matrix | Geometric meaning |
|--------|--------|-------------------|
| R₂ | [[-1,0],[0,-1]] | 180° rotation |
| R₄ | [[0,1],[-1,0]] | 90° rotation (square lattice) |
| R₃ | [[0,1],[-1,-1]] | 120° rotation (hex lattice) |
| R₆ | [[1,1],[-1,0]] | 60° rotation (hex lattice) |
| σ_a | [[1,0],[0,-1]] | reflection fixing the e₁ axis |
| σ_b | [[-1,0],[0,1]] | reflection fixing the e₂ axis |
| σ+ | [[0,1],[1,0]] | reflection swapping e₁ ↔ e₂ |
| σ− | [[0,-1],[-1,0]] | reflection along b−a |
| σ_h | [[-1,-1],[0,1]] | hex reflection (horizontal) |
| σ_v | [[1,1],[0,-1]] | hex reflection (vertical) |

For example, the wallpaper type **pg** ("glide ∥ a" variant) has a
single generator `rimat(1, 0, 0, -1, 1, 2)`, which represents the
matrix:

```
[  1   0   1/2 ]
[  0  -1    0  ]
[  0   0    1  ]
```

This is a reflection σ_a (across e₁) composed with a half-lattice
translation (½, 0) along e₁ — a glide reflection.

### 1d. The G/T enumeration algorithm (BFS with exact arithmetic)

The quotient group G/T has the following structure: two elements g, h ∈ G
belong to the **same coset** of T if and only if:

1. They have the **same linear part**: the 2×2 blocks are identical.
2. Their translations **differ by integers**: tx(g) − tx(h) ∈ ℤ and
   ty(g) − ty(h) ∈ ℤ.

Equivalently, g and h represent the same coset iff `rmodT(g)` equals
`rmodT(h)` — same linear part, same translation reduced to [0, 1).

The algorithm to enumerate all cosets is a **breadth-first search** (BFS)
on the Cayley graph of G/T:

**Input:** A list of generators [g₁, …, gₘ] (rational affine matrices).

**Output:** A list of **coset representatives** — one reduced rational
matrix per coset of T.

```
function processGroup(generators):
    // Step 1: Close generators under inverse
    allGens ← []
    for each g in generators:
        allGens.append(g)
        g⁻¹ ← rinverse(g)
        if rmodT(g⁻¹) is not already in allGens:
            allGens.append(g⁻¹)

    // Step 2: BFS from the identity
    id ← ridentity()          // [[1,0,0],[0,1,0],[0,0,1]]
    cosets ← [id]              // reduced coset representatives found so far
    frontier ← [id]            // elements to expand next

    while frontier is not empty:
        nextFrontier ← []
        for each rep in frontier:
            for each gen in allGens:
                product ← rcompose(gen, rep)       // gen ∘ rep
                reduced ← rmodT(product)            // reduce tx, ty mod 1

                if reduced is not in cosets:         // exact rational comparison
                    cosets.append(reduced)
                    nextFrontier.append(reduced)

                    if |cosets| > maxOrder:           // default maxOrder = 24
                        return DEGENERATE

        frontier ← nextFrontier

    return cosets
```

**Key properties of this algorithm:**

- **Exact:** All comparisons use exact rational arithmetic, so there are
  no floating-point tolerance issues.  Two cosets are equal iff their
  reduced representatives are identical as rational matrices.

- **Complete:** Because we multiply on the left by every generator and
  its inverse, and because G/T is a finite group, the BFS is guaranteed
  to reach every coset.

- **Termination:** For any valid wallpaper group, |G/T| ≤ 12 (the
  maximum is attained by p6m).  The maxOrder bound (default 24, set to
  2× the maximum valid order) catches degenerate inputs — e.g.
  generators that don't actually preserve any lattice.

- **Canonical representatives:** Each coset is stored as a rational
  matrix with tx, ty ∈ [0, 1).  The identity coset is always the first
  element.

### 1e. Worked example: pg (glide ∥ a)

**Generator:** g = σ_a with glide = rimat(1, 0, 0, -1, 1, 2), i.e.:

```
[  1   0   1/2 ]
[  0  -1    0  ]
[  0   0    1  ]
```

**Step 1 — close under inverses.**  Compute g⁻¹:

The linear part inverse of [[1,0],[0,-1]] is [[1,0],[0,-1]] (it's an
involution).  The translation of g⁻¹ is −R⁻¹ t = −[[1,0],[0,-1]]·(1/2, 0)
= (−1/2, 0).  After rmodT: tx = −1/2 mod 1 = 1/2, ty = 0.  So
rmodT(g⁻¹) = g itself — the generator is its own inverse (mod T).
allGens = [g].

**Step 2 — BFS.**

- Start: cosets = [id], frontier = [id].

- **Iteration 1:** Multiply frontier {id} by allGens {g}:
  - g ∘ id = g.  Reduced: [[1,0],[0,-1]] with tx=1/2, ty=0.
  - Not in cosets → add it.  cosets = [id, g], nextFrontier = [g].

- **Iteration 2:** Multiply frontier {g} by allGens {g}:
  - g ∘ g = rcompose(g, g).  Linear part: [[1,0],[0,-1]]·[[1,0],[0,-1]]
    = [[1,0],[0,1]] = identity.  Translation: [[1,0],[0,-1]]·(1/2,0) +
    (1/2,0) = (1/2,0) + (1/2,0) = (1, 0).  After rmodT: tx = 1 mod 1 = 0,
    ty = 0.  So reduced = id.
  - Already in cosets → skip.  nextFrontier = [].

- Frontier empty → done.  **|G/T| = 2.**

The two coset representatives are:

| Coset | Linear part | Translation |
|-------|------------|-------------|
| T (identity coset) | [[1,0],[0,1]] | (0, 0) |
| gT (glide coset) | [[1,0],[0,-1]] | (1/2, 0) |

### 1f. Conversion to physical coordinates

The generators and coset representatives are in **lattice coordinates**
(where the lattice basis vectors are the standard basis e₁, e₂).  To
evaluate the GP in physical ℝ² coordinates, we need the corresponding
**physical isometries**.

The change-of-basis matrix is:

> C = [**v₁** | **v₂**] = [[0, x], [1, y]]

where **v₁** = (0, 1) and **v₂** = (x, y) are the lattice basis vectors
written as columns.  C maps lattice coordinates to physical coordinates:
**r**_phys = C · **r**_lattice.

Given a rational affine matrix A (in lattice coords) with linear part L
and translation **t**, the corresponding physical isometry is:

> M_linear = C · L · C⁻¹
>
> M_translation = C · **t**

Since det C = 0·y − x·1 = −x, the inverse is:

> C⁻¹ = [[-y/x, 1], [1/x, 0]]

Concretely, writing A's entries as floats a, b, c, d, tx, ty, we first
compute P = C · L (where L = [[a,b],[c,d]] is the linear part of A):

```
P = C · L = [[xc,  xd],
             [a+yc,  b+yd]]
```

Then M_linear = P · C⁻¹:

```
M_linear = [[ (−xc·y + xd)/x,        xc       ],
            [ (−(a+yc)y + b+yd)/x,    a+yc     ]]

         = [[ d − cy,                  xc       ],
            [ (b + yd − ay − y²c)/x,   a + yc   ]]
```

And the physical translation is:

```
M_trans = C · (tx, ty)ᵀ = (x·ty,  tx + y·ty)
```

The result is a floating-point isometry {a, b, c, d, tx, ty} in physical
coordinates, where the isometry maps **r** → M_linear · **r** + M_trans.

(`toPhysical()` and `quotientToPhysical()` in rationalGroup.js.)

### 1g. Generating visible elements

For rendering, we need every group element whose image of the origin falls
within the viewport.  Rather than running BFS to an arbitrary depth, we
use the exact G/T decomposition:

> G = ⊔ᵢ (T + gᵢ)

Every element of G can be written uniquely as τ · gᵢ for some lattice
translation τ ∈ T and some coset representative gᵢ.  So we iterate:

1. For each coset representative gᵢ (converted to physical coordinates):
2. For each integer pair (m, n) with −20 ≤ m, n ≤ 20:
3. Form the element τ_{m,n} ∘ gᵢ where τ_{m,n} is translation by
   m **v₁** + n **v₂**.
4. Keep the element if its image of the origin falls within the viewport
   bounds (plus a 1-unit margin).

This generates exactly the visible elements with no depth ambiguity.

(`generateElements()` in rationalGroup.js.)

---

## 2. A Gaussian process on the torus

### 2a. Dual lattice

The **dual (reciprocal) lattice** consists of wave-vectors **k** such that
**k** · **v** ∈ 2πℤ for every lattice translation **v** ∈ T.  Given the
translation basis, the dual basis vectors **k₁**, **k₂** satisfy

> **vᵢ** · **kⱼ** = 2π δᵢⱼ.

Writing V = [**v₁** | **v₂**] as a 2×2 column-stacked matrix, we have
K = 2π (Vᵀ)⁻¹.  Concretely, with det V = v₁ₓ v₂ᵧ − v₁ᵧ v₂ₓ:

> **k₁** = (2π / det V) (v₂ᵧ, −v₂ₓ),  
> **k₂** = (2π / det V) (−v₁ᵧ, v₁ₓ).

(`computeDualLattice()` in gaussianProcess.js.)

### 2b. Fourier modes

Any smooth function f : ℝ² → ℝ that is periodic under the translation
lattice T can be expanded as a Fourier series over the dual lattice:

> f(**r**) = Σ_{**n** ∈ ℤ²} cₙ e^{i **kₙ** · **r**}

where **kₙ** = n₁ **k₁** + n₂ **k₂**.  For f to be real-valued, we need
c₋ₙ = c̄ₙ.  Rather than storing complex coefficients, we write the real
expansion:

> f(**r**) = dc + Σ_{**k** in half-plane} [ aₖ cos(**k** · **r**) + bₖ sin(**k** · **r**) ]

where the sum runs over half the nonzero dual lattice (e.g. n₁ > 0, or
n₁ = 0 and n₂ > 0).  Each pair (aₖ, bₖ) is independent, and the cosine
and sine terms together account for both **k** and −**k**.

### 2c. Spectral envelope (squared-exponential kernel)

A stationary Gaussian process on ℝ² with a squared-exponential (RBF)
covariance kernel

> C(**r**, **r′**) = exp(−‖**r** − **r′**‖² / (2ℓ²))

has a spectral density proportional to exp(−‖**k**‖² ℓ² / 2).  In
practice we weight each half-plane mode by

> envelope(**k**) = exp(−‖**k**‖² ℓ² / 4)

(The exponent uses ℓ²/4 rather than the kernel's ℓ²/2 because the
cosine/sine expansion splits each complex mode into two real coefficients,
each contributing variance ½.)  We then draw

> aₖ = envelope(**k**) · ξₐ,  bₖ = envelope(**k**) · ξ_b

where ξₐ, ξ_b ~ N(0, 1) are independent standard normals (produced via
Box-Muller from a seedable PRNG).

The DC component dc is drawn from N(0, 0.1²) to allow a small random
offset without dominating the pattern.

(`drawGPCoefficients()` in gaussianProcess.js.)

### 2d. Truncation

The sum is truncated to −N ≤ n₁, n₂ ≤ N for a user-controlled integer N
(the "truncation" slider in the UI, default N = 5).  The spectral envelope
ensures modes well beyond 1/ℓ have negligible amplitude, so the truncation
introduces no visible artifacts when N is large enough relative to 1/ℓ.

---

## 3. Symmetrization under G/T

### 3a. Why averaging works

Given the lattice-periodic function f from §2, we construct a
**G-invariant** function by averaging over the point-group coset
representatives:

> f_sym(**r**) = (1/|P|) Σ_{g ∈ P} f(g(**r**))

where P = {g₁, …, g_N} are the G/T coset representatives from §1.

**Claim.** f_sym is invariant under every element of G.

*Proof.*  Let h ∈ G.  We need f_sym(h(**r**)) = f_sym(**r**).

Write h = τ · gⱼ for some lattice translation τ ∈ T and some coset
representative gⱼ.  Then

> f_sym(h(**r**)) = (1/|P|) Σ_{gᵢ ∈ P} f(gᵢ(τ gⱼ(**r**)))

Now gᵢ τ gⱼ = τ′ gₖ for some τ′ ∈ T and some gₖ ∈ P (because G/T is a
group under coset multiplication, and translations form a normal subgroup).
Since f is T-periodic, f(τ′ gₖ(**r**)) = f(gₖ(**r**)).  As i ranges
over P, the map gᵢ ↦ gₖ is a bijection of P, so the sum is unchanged. ∎

### 3b. Evaluation

At each pixel location **r**, the symmetrized value is computed by:

1. For each coset representative g with matrix R and translation t,
   compute g(**r**) = R**r** + t.
2. Evaluate the unsymmetrized GP: f(g(**r**)) = dc + Σ [aₖ cos(**k**·g(**r**)) + bₖ sin(**k**·g(**r**))].
3. Average: f_sym(**r**) = (1/|P|) Σ_g f(g(**r**)).

(`evaluateSymmetrizedGP()` and `generateGPHeatmap()` in gaussianProcess.js.)

### 3c. Why coset representative translations matter

The coset representatives gᵢ carry both a linear part Rᵢ (rotation or
reflection) and a translation part tᵢ (possibly fractional).  Both are
needed for the averaging: a glide reflection with translation (½, 0), for
instance, maps r to R r + (½, 0), and omitting the (½, 0) would break the
glide symmetry.

The key observation is that f is T-periodic (invariant under integer
translations), so replacing a coset representative by any other element
in the same coset changes the argument of f by a lattice translation,
which does not affect the value.  Thus the choice of representative
within each coset is immaterial.

---

## 4. Rendering

The symmetrized GP values on a regular grid over the viewport are passed
to a diverging blue → white → red color map and rendered to a canvas
(as a data URL for embedding in SVG).

| GP value | Color |
|---|---|
| minimum | blue (0, 0, 255) |
| midpoint | white (255, 255, 255) |
| maximum | red (255, 0, 0) |

The color map is linearly interpolated: for a normalized value t ∈ [0, 1],

> t < ½:  (r, g, b) = (2t·255, 2t·255, 255)   — blue → white  
> t ≥ ½:  (r, g, b) = (255, (1−2(t−½))·255, (1−2(t−½))·255) — white → red

(`heatmapToDataURL()` in gaussianProcess.js.)

---

## 5. Summary of the pipeline

```
Lattice (v₁, v₂)  +  Generators (rational matrices)
        │
        ▼
  Enumerate G/T exactly (rational BFS)         [processGroup()]
        │
        ▼
  Convert coset reps to physical isometries    [quotientToPhysical()]
        │
        ▼
  Compute dual lattice k₁, k₂                 [computeDualLattice()]
        │
        ▼
  Draw random Fourier coefficients (aₖ, bₖ)   [drawGPCoefficients()]
  weighted by squared-exponential envelope
        │
        ▼
  For each pixel r:
    f_sym(r) = (1/|P|) Σ_g f(g(r))            [evaluateSymmetrizedGP()]
        │
        ▼
  Color map + render to canvas                  [heatmapToDataURL()]
```

The result is a smooth random function on ℝ² that is:

- **T-periodic**: by construction (Fourier series on the torus).
- **G-invariant**: by the averaging argument (§3a).
- **Visually distinct each draw**: the PRNG seed determines the random
  Fourier coefficients, so clicking "New Draw" produces a fresh sample
  from the same GP prior with the same symmetry.
