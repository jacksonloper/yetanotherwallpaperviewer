# Mathematical Reference

Complete mathematical specification of the wallpaper group viewer.
Every algorithm, generator matrix, and group-theoretic choice is recorded
here so that the entire page can be checked for correctness from this
document alone.

---

## 1. Lattice conventions

### 1a. Normal form

A **rank-2 lattice** in ℝ² is Λ = ℤ**a** + ℤ**b** for two linearly
independent vectors **a**, **b**.  We always normalize to:

> **a** = (0, 1),  **b** = (x, y)

with the constraints x ≥ 0, 0 ≤ y ≤ ½, x² + y² ≥ 1.

**Why this is always possible.**  Given an arbitrary lattice:

1. Scale by 1/‖**a**‖ so that the shortest vector has length 1.
2. Rotate so that this shortest vector is (0, 1) = **a**.
3. Choose the second vector to be the shortest lattice vector not parallel
   to **a** (Minkowski-reduced).  Reduce modulo **a** so 0 ≤ y ≤ ½.
   If x < 0, reflect via (x, y) → (−x, y).  The condition
   ‖**b**‖ ≥ ‖**a**‖ = 1 gives x² + y² ≥ 1.

The result is unique up to boundary identifications at special lattices
(square, hexagonal).

### 1b. Bravais lattice types

| Type | Characterization |
|------|-----------------|
| Square | (x, y) = (1, 0) |
| Hexagonal | (x, y) = (√3/2, 1/2) |
| Centered rectangular | x² + y² = 1 with 0 < y < 1/2, **or** y = 1/2 with x > √3/2 |
| Rectangular | y = 0 with x > 1 |
| Oblique | everything else |

Detection uses tolerance ε = 10⁻⁴.

### 1c. Lattice metric

The change-of-basis matrix mapping lattice coordinates to physical
coordinates is:

> C = [[0, x], [1, y]]

where the columns are **a** = (0,1) and **b** = (x,y).  The metric
tensor in lattice coordinates is:

> Q = Cᵀ C = [[1, y], [y, x² + y²]]

This matrix is used for generator validation (§8a).

### 1d. UI lattice controls

The app uses four lattice-control modes depending on the wallpaper type:

| Mode | Types | Parameter | Mapping |
|------|-------|-----------|---------|
| `full` | p1, p2 | Full 2D freedom | Well-rounded slider or shape sub-modes |
| `rect-to-square` | pm, pg, pmm, pmg, pgg | Slider t ∈ [0,1] | x = 3 − 2t, y = 0 (t=0 → wide rectangle, t=1 → square) |
| `cm-slider` | cm, cmm | Slider t ∈ [0,1] | θ = π/18 + 4πt/9, then x = sin θ, y = cos θ (always |**b**| = 1; t=0 → 10° acute, t=0.625 → hex, t=1 → square) |
| `none` | p4, p4m, p4g | Fixed square: (1, 0) | — |
| `none` | p3, p3m1, p31m, p6, p6m | Fixed hexagonal: (√3/2, 1/2) | — |

---

## 2. Rational arithmetic

### 2a. Rational numbers

A rational number is an exact pair [n, d] with integer n, integer d > 0,
gcd(|n|, d) = 1.  Zero is [0, 1].  All arithmetic (add, subtract,
multiply, divide, negate) preserves this canonical form.

Operations (`rational.js`):

| Operation | Definition |
|-----------|-----------|
| rat(n, d) | Normalize to lowest terms |
| radd(a, b) | a + b |
| rsub(a, b) | a − b |
| rmul(a, b) | a × b |
| rdiv(a, b) | a / b |
| rneg(a) | −a |
| req(a, b) | Exact equality |
| rmod1(a) | Reduce to [0, 1) |

### 2b. Rational affine matrices

An affine isometry of ℤ² is represented as a 3×3 matrix with rational
entries:

```
[ a   b   tx ]
[ c   d   ty ]
[ 0   0    1 ]
```

The top-left 2×2 block [[a, b], [c, d]] is the **linear part** L.
The vector (tx, ty) is the **translation part**.  The matrix acts on
a point p by: p ↦ L·p + (tx, ty).

Stored as `{ a, b, c, d, tx, ty }` where each entry is a rational [n, d].
Created by `rimat(a, b, c, d, txn, txd, tyn, tyd)` — linear entries as
plain integers, translation as numerator/denominator pairs.

Operations (`rational.js`):

| Operation | Definition |
|-----------|-----------|
| rcompose(A, B) | A ∘ B (apply B first). Linear: A_L · B_L. Translation: A_L · B_t + A_t |
| rinverse(A) | Inverse via 2×2 determinant |
| rmatEqual(A, B) | Exact componentwise comparison |
| rmodT(A) | Keep linear part, reduce tx, ty mod 1 to [0, 1) |

### 2c. Key linear parts (lattice coordinates)

The following integer matrices appear as the linear parts of generators.
Each is in GL(2, ℤ) (integer entries, determinant ±1) and preserves the
appropriate lattice metric Q.

| Symbol | Matrix [[a,b],[c,d]] | det | Meaning | Used by |
|--------|---------------------|-----|---------|---------|
| R₂ | [[-1,0],[0,-1]] | +1 | 180° rotation | p2, etc. |
| σ_a | [[1,0],[0,-1]] | −1 | Reflection fixing e₁ | pm(a), pg(a) |
| σ_b | [[-1,0],[0,1]] | −1 | Reflection fixing e₂ | pm(b), pg(b) |
| σ+ | [[0,1],[1,0]] | −1 | Swap e₁ ↔ e₂ (mirror ∥ a+b) | cm(a+b) |
| σ− | [[0,-1],[-1,0]] | −1 | Swap & negate (mirror ∥ b−a) | cm(b−a) |
| R₄ | [[0,1],[-1,0]] | +1 | 90° rotation (square) | p4 |
| R₃ | [[0,1],[-1,-1]] | +1 | 120° rotation (hex) | p3 |
| R₆ | [[1,1],[-1,0]] | +1 | 60° rotation (hex) | p6 |
| σ_h | [[-1,-1],[0,1]] | −1 | Hex reflection (horizontal) | p3m1, p6m |
| σ_v | [[1,1],[0,-1]] | −1 | Hex reflection (vertical) | p31m |

**Verification of R₆ and R₃:**  R₆² = [[1,1],[-1,0]]² = [[0,1],[-1,-1]] = R₃.
R₃² = [[0,1],[-1,-1]]² = [[-1,-1],[1,0]].  R₆³ = [[-1,0],[0,-1]] = R₂.
R₆⁶ = I. ✓

**Verification of σ_h:**  σ_h = [[-1,-1],[0,1]].  det = −1·1 − (−1)·0 = −1. ✓
σ_h² = [[-1,-1],[0,1]]² = [[1,0],[0,1]] = I. ✓

---

## 3. Standard generators for all 17 wallpaper types

Each type is defined by its **lattice type** and a list of **generators**
(rational affine matrices in lattice coordinates).  The translation
subgroup T = ℤ² (generated by [I|(1,0)] and [I|(0,1)]) is always implicit.

All generator placements are canonical: rotation centers at the origin,
reflection axes through the origin (except where a nonzero translation
is structurally necessary, as in pg, pmg, pgg, and p4g).

### 3a. Types on any lattice

**p1** — Translations only

> Generators: *(none)*
> |G/T| = 1

**p2** — 180° rotation

> Generator: [[-1,0],[0,-1] | (0,0)]
> |G/T| = 2

### 3b. Types on rectangular lattice (including square specialization)

These types use σ_a = [[1,0],[0,-1]] (reflection fixing e₁-axis, mirror ∥ a)
and σ_b = [[-1,0],[0,1]] (reflection fixing e₂-axis, mirror ∥ b).

**pm** — One reflection

> Variant 0 (Mirrors ∥ a): [[1,0],[0,-1] | (0,0)]
> Variant 1 (Mirrors ∥ b): [[-1,0],[0,1] | (0,0)]
> |G/T| = 2

**pg** — One glide reflection

> Variant 0 (Glide ∥ a): [[1,0],[0,-1] | (1/2,0)]
> Variant 1 (Glide ∥ b): [[-1,0],[0,1] | (0,1/2)]
> |G/T| = 2

The translation (1/2, 0) (resp. (0, 1/2)) is the half-lattice glide along
the mirror direction.  The square of this generator is translation by (1, 0)
(resp. (0, 1)), which is a lattice translation, confirming |G/T| = 2.

**pmm** — Two perpendicular reflections

> Generators: [[1,0],[0,-1] | (0,0)] and [[-1,0],[0,1] | (0,0)]
> |G/T| = 4.  Cosets: {I, σ_a, σ_b, R₂} where R₂ = σ_a · σ_b.

**pmg** — Reflection + perpendicular glide

> Variant 0 (Mirror ∥ b, glide ∥ a):
>   [[-1,0],[0,1] | (0,0)]  and  [[1,0],[0,-1] | (1/2,0)]
> Variant 1 (Mirror ∥ a, glide ∥ b):
>   [[1,0],[0,-1] | (0,0)]  and  [[-1,0],[0,1] | (0,1/2)]
> |G/T| = 4

**pgg** — Two perpendicular glide reflections

> Generators:
>   [[-1,0],[0,1] | (1/2,1/2)]  and  [[1,0],[0,-1] | (1/2,1/2)]
> |G/T| = 4

Both glides have translation (1/2, 1/2).  Their product is
[[−1,0],[0,−1] | (0,0)] + (1,0) mod T = R₂, confirming the product of two
perpendicular glides is a rotation.

### 3c. Types on centered-rectangular lattice (including hex/square specialization)

These use σ+ = [[0,1],[1,0]] (mirror ∥ a+b) and σ− = [[0,−1],[−1,0]]
(mirror ∥ b−a) in the primitive centered-rectangular basis.

**cm** — One reflection (centered)

> Variant 0 (Mirror ∥ a+b): [[0,1],[1,0] | (0,0)]
> Variant 1 (Mirror ∥ b−a): [[0,-1],[-1,0] | (0,0)]
> |G/T| = 2

σ+ swaps the basis vectors e₁ ↔ e₂.  This is a lattice automorphism when
|**a**| = |**b**|, which holds on well-rounded centered-rectangular lattices,
as well as on the hexagonal and square specializations.

**cmm** — Two reflections (centered)

> Generators: [[0,1],[1,0] | (0,0)] and [[0,-1],[-1,0] | (0,0)]
> |G/T| = 4.  Cosets: {I, σ+, σ−, R₂} where R₂ = σ+ · σ−.

Verification: σ+ · σ− = [[0,1],[1,0]] · [[0,−1],[−1,0]]
= [[−1,0],[0,−1]] = R₂.  ✓

### 3d. Types on square lattice

These use R₄ = [[0,1],[−1,0]] (90° rotation).

On the square lattice, (x,y) = (1,0), so C = [[0,1],[1,0]], and
CᵀC = I.  The metric Q = I means every orthogonal matrix with integer
entries preserves the lattice.

**p4** — 90° rotation

> Generator: [[0,1],[-1,0] | (0,0)]
> |G/T| = 4.  Cosets: {I, R₄, R₂, R₄³}

Verification: R₄² = [[0,1],[−1,0]]² = [[−1,0],[0,−1]] = R₂.
R₄⁴ = I. ✓

**p4m** — 90° rotation + axial reflection

> Generators: [[0,1],[-1,0] | (0,0)] and [[-1,0],[0,1] | (0,0)]
> |G/T| = 8

The second generator σ_b reflects across the e₂-axis.  Combined with
R₄, this generates all eight cosets of the dihedral group D₄ acting on ℤ².
The four rotations {I, R₄, R₂, R₄³} and four reflections {σ_b, R₄σ_b,
R₂σ_b, R₄³σ_b} produce mirrors in all four lattice directions (axial and
diagonal).

**p4g** — 90° rotation + off-center diagonal glide-reflection

> Generators: [[0,1],[-1,0] | (0,0)] and [[0,-1],[-1,0] | (1/2,1/2)]
> |G/T| = 8

The second generator is σ− (the b−a mirror) shifted by (1/2, 1/2).
This is a **glide reflection** — the mirror part is diagonal, and the
translation (1/2, 1/2) projects to a nonzero component along the mirror
axis, making it a true glide.  Combining with R₄:
- R₄ · [σ− | (½,½)] has linear part R₄σ− = [[0,1],[−1,0]]·[[0,−1],[−1,0]]
  = [[−1,0],[0,1]] = σ_b, with translation R₄·(½,½) = (½,−½) ≡ (½,½) mod T.
  This is σ_b with glide (½,½), i.e. an **axial glide**.

p4g has diagonal mirrors but only axial glides — the classic distinction
from p4m.

### 3e. Types on hexagonal lattice

These use R₃ = [[0,1],[−1,−1]] (120° rotation) and R₆ = [[1,1],[−1,0]]
(60° rotation), and two reflection matrices:

- σ_h = [[-1,-1],[0,1]] — mirror through the 2**b**−**a** direction
  (horizontal in standard hex orientation)
- σ_v = [[1,1],[0,-1]] — mirror through the **a** direction (vertical)

On the hex lattice, (x,y) = (√3/2, 1/2), so C = [[0, √3/2], [1, 1/2]].
The metric Q = [[1, 1/2], [1/2, 1]].

**Verification of metric preservation for R₃:**
R₃ᵀ = [[0,−1],[1,−1]].
R₃ᵀ · Q = [[0,−1],[1,−1]] · [[1,½],[½,1]] = [[−½,−1],[½,−½]].
(R₃ᵀQ) · R₃ = [[−½,−1],[½,−½]] · [[0,1],[−1,−1]] = [[1,½],[½,1]] = Q. ✓

**p3** — 120° rotation

> Generator: [[0,1],[-1,-1] | (0,0)]
> |G/T| = 3.  Cosets: {I, R₃, R₃²}

R₃² = [[-1,-1],[1,0]].  R₃³ = I. ✓

**p3m1** — 120° rotation + reflection (mirrors through all 3-fold centers)

> Generators: [[0,1],[-1,-1] | (0,0)] and [[-1,-1],[0,1] | (0,0)]
> |G/T| = 6

The reflection σ_h has mirror along 2**b**−**a** (the horizontal direction
in physical coordinates).  At the three 3-fold centers (0,0), (1/3,1/3),
(2/3,2/3), this mirror and its R₃-conjugates pass through all of them.
This is the defining property of p3m1.

**p31m** — 120° rotation + reflection (mirrors avoid some 3-fold centers)

> Generators: [[0,1],[-1,-1] | (0,0)] and [[1,1],[0,-1] | (0,0)]
> |G/T| = 6

The reflection σ_v has mirror along **a** (the vertical direction in
physical coordinates).  The vertical mirror passes through the origin
(0,0) but not through (1/3,1/3) or (2/3,2/3).  This is the defining
property of p31m — some 3-fold centers have site symmetry 3 (not 3m).

**p6** — 60° rotation

> Generator: [[1,1],[-1,0] | (0,0)]
> |G/T| = 6.  Cosets: {I, R₆, R₃, R₂, R₃², R₆⁵}

where R₆² = R₃, R₆³ = R₂, R₆⁶ = I.

**p6m** — 60° rotation + reflection

> Generators: [[1,1],[-1,0] | (0,0)] and [[-1,-1],[0,1] | (0,0)]
> |G/T| = 12

This is the largest wallpaper group.  The 12 cosets consist of 6 rotations
{I, R₆, R₃, R₂, R₃², R₆⁵} and 6 reflections {σ_h, R₆σ_h, R₃σ_h,
R₂σ_h, R₃²σ_h, R₆⁵σ_h}, giving mirrors in 6 directions spaced 30° apart.

### 3f. Summary table of all generators

| Type | Lattice | |G/T| | Generator 1 | Generator 2 |
|------|---------|-------|-------------|-------------|
| p1 | any | 1 | *(none)* | |
| p2 | any | 2 | [[-1,0],[0,-1] \| (0,0)] | |
| pm(a) | rect | 2 | [[1,0],[0,-1] \| (0,0)] | |
| pm(b) | rect | 2 | [[-1,0],[0,1] \| (0,0)] | |
| pg(a) | rect | 2 | [[1,0],[0,-1] \| (1/2,0)] | |
| pg(b) | rect | 2 | [[-1,0],[0,1] \| (0,1/2)] | |
| pmm | rect | 4 | [[1,0],[0,-1] \| (0,0)] | [[-1,0],[0,1] \| (0,0)] |
| pmg(0) | rect | 4 | [[-1,0],[0,1] \| (0,0)] | [[1,0],[0,-1] \| (1/2,0)] |
| pmg(1) | rect | 4 | [[1,0],[0,-1] \| (0,0)] | [[-1,0],[0,1] \| (0,1/2)] |
| pgg | rect | 4 | [[-1,0],[0,1] \| (1/2,1/2)] | [[1,0],[0,-1] \| (1/2,1/2)] |
| cm(a+b) | c-rect | 2 | [[0,1],[1,0] \| (0,0)] | |
| cm(b−a) | c-rect | 2 | [[0,-1],[-1,0] \| (0,0)] | |
| cmm | c-rect | 4 | [[0,1],[1,0] \| (0,0)] | [[0,-1],[-1,0] \| (0,0)] |
| p4 | square | 4 | [[0,1],[-1,0] \| (0,0)] | |
| p4m | square | 8 | [[0,1],[-1,0] \| (0,0)] | [[-1,0],[0,1] \| (0,0)] |
| p4g | square | 8 | [[0,1],[-1,0] \| (0,0)] | [[0,-1],[-1,0] \| (1/2,1/2)] |
| p3 | hex | 3 | [[0,1],[-1,-1] \| (0,0)] | |
| p3m1 | hex | 6 | [[0,1],[-1,-1] \| (0,0)] | [[-1,-1],[0,1] \| (0,0)] |
| p31m | hex | 6 | [[0,1],[-1,-1] \| (0,0)] | [[1,1],[0,-1] \| (0,0)] |
| p6 | hex | 6 | [[1,1],[-1,0] \| (0,0)] | |
| p6m | hex | 12 | [[1,1],[-1,0] \| (0,0)] | [[-1,-1],[0,1] \| (0,0)] |

Notation: [L | t] means linear part L, translation t.  Variant labels
in parentheses (e.g. pm(a)) correspond to direction variant 0 and 1.

### 3g. Direction variants

Some types have two variants, selectable via radio buttons:

| Type | Variant 0 | Variant 1 |
|------|-----------|-----------|
| pm | Mirrors ∥ **a** | Mirrors ∥ **b** |
| pg | Glide ∥ **a** | Glide ∥ **b** |
| pmg | Mirror ∥ **b** + glide ∥ **a** | Mirror ∥ **a** + glide ∥ **b** |
| cm | Mirror ∥ **a**+**b** | Mirror ∥ **b**−**a** |

On a **square** lattice, both pm variants are conjugate by the 90° lattice
rotation and give the same group up to isometry.  Similarly for pg, pmg, cm.
On a **hexagonal** lattice, both cm variants are conjugate by the 60°
rotation.  Both are offered so the user can slide through centered-rectangular
(resp. rectangular) lattices where they are genuinely inequivalent.

---

## 4. G/T enumeration algorithm

### 4a. The quotient G/T

The translation subgroup T = ℤ² acts freely and properly on ℝ².  Two group
elements g, h are in the **same coset** of T iff:

1. They have the **same linear part** (identical 2×2 blocks).
2. Their translations **differ by integers**: tx(g) − tx(h) ∈ ℤ and
   ty(g) − ty(h) ∈ ℤ.

Equivalently, g ∼ h iff rmodT(g) = rmodT(h).

### 4b. BFS algorithm

**Input:** generators g₁, …, gₘ (rational affine matrices, not including
lattice translations).

**Output:** coset representatives — one reduced rational matrix per coset.

```
function processGroup(generators, maxOrder = 24):
    // Step 1: Close generators under inverse
    allGens ← []
    for each g in generators:
        allGens.append(g)
        g⁻¹ ← rinverse(g)
        if rmodT(g⁻¹) is not already in allGens:
            allGens.append(g⁻¹)

    // Step 2: BFS from the identity
    cosets ← [identity]
    frontier ← [identity]

    while frontier is not empty:
        nextFrontier ← []
        for each rep in frontier:
            for each gen in allGens:
                product ← rcompose(gen, rep)   // left-multiply
                reduced ← rmodT(product)        // reduce tx, ty to [0,1)

                if reduced ∉ cosets:            // exact rational comparison
                    cosets.append(reduced)
                    nextFrontier.append(reduced)

                    if |cosets| > maxOrder:
                        return (cosets truncated, DEGENERATE)

        frontier ← nextFrontier

    return cosets
```

**Key properties:**

- **Exact:** All comparisons use exact rational arithmetic.  No floating-point
  tolerance needed.
- **Complete:** Left-multiplication by every generator and its inverse
  generates the full Cayley graph of G/T.
- **Terminates:** For a valid wallpaper group, |G/T| ≤ 12.  The maxOrder
  bound (24 = 2 × 12) catches degenerate inputs.
- **Canonical:** Each coset is stored with tx, ty ∈ [0, 1).  The identity
  coset is always first.

### 4c. Worked example: pg (glide ∥ a)

Generator: g = [[1,0],[0,-1] | (1/2, 0)]

**Close under inverses.**
g⁻¹ has linear part [[1,0],[0,−1]]⁻¹ = [[1,0],[0,−1]] and translation
−[[1,0],[0,−1]]·(1/2, 0) = (−1/2, 0).  After rmodT: tx = 1/2, ty = 0.
So rmodT(g⁻¹) = g — the generator is its own inverse mod T.

**BFS.**
- Start: cosets = {I}, frontier = {I}.
- Iteration 1: g ∘ I = g = [[1,0],[0,−1] | (1/2,0)].  Not in cosets → add.
  cosets = {I, g}.
- Iteration 2: g ∘ g: linear part [[1,0],[0,1]] = I, translation
  [[1,0],[0,−1]]·(1/2,0) + (1/2,0) = (1, 0).  rmodT → (0, 0) = I.
  Already in cosets → skip.

Result: |G/T| = 2.  Coset reps: identity and [[1,0],[0,−1] | (1/2, 0)].

### 4d. Worked example: p4m

Generators: R₄ = [[0,1],[−1,0] | (0,0)] and σ_b = [[-1,0],[0,1] | (0,0)].

Closing under inverses adds R₄⁻¹ = R₄³ = [[0,−1],[1,0] | (0,0)] (since
σ_b is an involution, σ_b⁻¹ = σ_b).

BFS produces 8 cosets:

| Coset | Linear part | Translation | Classification |
|-------|-------------|-------------|----------------|
| I | [[1,0],[0,1]] | (0,0) | identity |
| R₄ | [[0,1],[−1,0]] | (0,0) | 90° rotation |
| R₂ | [[−1,0],[0,−1]] | (0,0) | 180° rotation |
| R₄³ | [[0,−1],[1,0]] | (0,0) | 270° rotation |
| σ_b | [[−1,0],[0,1]] | (0,0) | reflection |
| R₄σ_b | [[0,1],[1,0]] | (0,0) | reflection |
| R₂σ_b | [[1,0],[0,−1]] | (0,0) | reflection |
| R₄³σ_b | [[0,−1],[−1,0]] | (0,0) | reflection |

All translations are (0,0) because p4m has all generators with zero translation.
|G/T| = 8. ✓

---

## 5. Conversion to physical coordinates

### 5a. The change-of-basis

Generators and coset representatives are in **lattice coordinates**.  For
rendering and GP evaluation, we convert to **physical coordinates**.

The change-of-basis matrix is:

> C = [[0, x], [1, y]]     (columns = a, b)

A rational affine matrix A with linear part L and translation t maps to:

> M_linear = C · L · C⁻¹
> M_translation = C · t

Since det C = −x:

> C⁻¹ = [[-y/x, 1], [1/x, 0]]

### 5b. Explicit formulas

Let A have (float) entries a, b, c, d, tx, ty.

Intermediate product P = C · L:

```
P = [[xc, xd], [a+yc, b+yd]]
```

Physical linear part M_linear = P · C⁻¹:

```
M_linear = [[ d − cy,              xc          ],
            [ (b + yd − ay − y²c)/x,  a + yc   ]]
```

Physical translation:

```
M_trans = (x · ty,  tx + y · ty)
```

(`toPhysical()` in rationalGroup.js.)

### 5c. Generating visible elements

For rendering, we need every group element whose image of the origin falls
within the viewport.  Using the G/T decomposition:

> G = ⊔ᵢ (T · gᵢ)

Every element is uniquely τ · gᵢ for some τ ∈ T, gᵢ a coset rep.

Algorithm:

1. Convert each coset rep gᵢ to a physical isometry.
2. For each integer pair (m, n) with −20 ≤ m, n ≤ 20:
3. Form τ_{m,n} ∘ gᵢ where τ_{m,n} = translation(m·v₁ + n·v₂).
4. Keep the element if its origin-image falls within viewport bounds
   (plus 1-unit margin).

This generates all visible elements with no depth ambiguity.

(`generateElements()` in rationalGroup.js.)

---

## 6. Supergroup inclusions

### 6a. One-step supergroup map

For each wallpaper type, the following table lists all types reachable by
adding one new generator.  These are **type-level** inclusions — some
require a lattice specialization.

| Type | |G/T| | One-step supergroups |
|------|-------|---------------------|
| p1 | 1 | p2, pm, pg, cm, p4, p3, p6 |
| p2 | 2 | pmm, pmg, pgg, cmm, p4, p6 |
| pm | 2 | pmm, pmg, cmm, p4m |
| pg | 2 | pgg, pmg, p4g |
| cm | 2 | cmm, p3m1, p31m |
| pmm | 4 | p4m |
| pmg | 4 | p4g, cmm |
| pgg | 4 | cmm, p4g |
| cmm | 4 | p4m |
| p4 | 4 | p4m, p4g |
| p4m | 8 | *(maximal)* |
| p4g | 8 | *(maximal)* |
| p3 | 3 | p3m1, p31m, p6 |
| p3m1 | 6 | p6m |
| p31m | 6 | p6m |
| p6 | 6 | p6m |
| p6m | 12 | *(maximal)* |

There are three maximal types: p4m, p4g, and p6m.

### 6b. Lattice requirements per group type

| Lattice requirement | Group types |
|---------------------|-------------|
| any | p1, p2 |
| rectangular | pm, pg, pmm, pmg, pgg |
| centered-rectangular | cm, cmm |
| square | p4, p4m, p4g |
| hexagonal | p3, p3m1, p31m, p6, p6m |

### 6c. Lattice specialization hierarchy

A supergroup is **viable** on a given lattice if the lattice supports the
supergroup's lattice requirement:

| Current lattice | Can support requirements |
|-----------------|------------------------|
| square | square, rectangular, centered-rectangular, any |
| hexagonal | hexagonal, centered-rectangular, any |
| rectangular | rectangular, any |
| centered-rectangular | centered-rectangular, any |
| oblique | any (only) |

This hierarchy reflects the geometric fact that a square lattice is
simultaneously rectangular (a = b in length, y = 0) and centered-rectangular
(equal-length basis vectors with the diagonal providing centering), while
a hexagonal lattice is a special centered-rectangular lattice (60° angle).

### 6d. Viable supergroups: examples

| Group | Lattice | Viable supergroups |
|-------|---------|-------------------|
| p1 | oblique | p2 |
| p1 | rectangular | p2, pm, pg |
| p1 | square | p2, pm, pg, cm, p4 |
| p1 | hexagonal | p2, cm, p3, p6 |
| cm | centered-rect | cmm |
| cm | hexagonal | cmm, p3m1, p31m |
| p4 | square | p4m, p4g |
| p6m | hexagonal | *(none — maximal)* |

### 6e. Supergroup preview algorithm

When the user clicks a supergroup button:

1. Load the **standard generators** of the supergroup type (from §3).
2. Enumerate G/T for the supergroup using the BFS algorithm (§4).
3. Convert cosets to physical isometries using the **current** lattice vector.
4. Generate visible elements and display them.

The main group selection does **not** change — this is a preview only.
Clicking again dismisses the preview.  If the user changes the lattice in
a way that makes the supergroup unviable (e.g., sliding from hexagonal to
centered-rectangular while previewing p3m1), the preview is automatically
dismissed.

### 6f. What generators are added for each supergroup transition

The following describes the generator(s) that, when added to the base
group's generators, produce the supergroup.  These use the problem
statement's conventions:  **r2** = R₂,  **mx** = σ_a,  **my** = σ_b,
**gx** = pg(a) glide,  **gy** = pg(b) glide,  **r4** = R₄,  **r3** = R₃,
**r6** = R₆,  **s** = σ+ (swap, centered-rect basis),
**s0** = σ_h (hex mirror through 3-fold centers),
**s1/3** = σ_v (hex mirror between 3-fold centers).

**From p1:**

| Add | → Supergroup | Lattice needed |
|-----|-------------|----------------|
| r2 | p2 | any |
| mx | pm | rectangular |
| gx | pg | rectangular |
| s | cm | centered-rectangular |
| r4 | p4 | square |
| r3 | p3 | hexagonal |
| r6 | p6 | hexagonal |

**From p2:** (already has r2)

| Add | → Supergroup | Lattice needed |
|-----|-------------|----------------|
| mx, my | pmm | rectangular |
| mx, gy | pmg | rectangular |
| gx, gy | pgg | rectangular |
| s | cmm | centered-rectangular |
| r4 | p4 | square |
| r6 | p6 | hexagonal |

**From pm:** (has mx or my)

| Add | → Supergroup | Lattice needed |
|-----|-------------|----------------|
| my (resp. mx) | pmm | rectangular |
| gy (resp. gx) | pmg | rectangular |
| s | cmm | centered-rectangular |
| r4 | p4m | square |

**From pg:** (has gx or gy)

| Add | → Supergroup | Lattice needed |
|-----|-------------|----------------|
| gy (resp. gx) | pgg | rectangular |
| mx, gy (resp. my, gx) | pmg | rectangular |
| r4 | p4g | square |

**From cm:** (has s)

| Add | → Supergroup | Lattice needed |
|-----|-------------|----------------|
| mx | cmm | centered-rectangular |
| r3, s0 | p3m1 | hexagonal |
| r3, s1/3 | p31m | hexagonal |

**From pmm:** (has mx, my)

| Add | → Supergroup | Lattice needed |
|-----|-------------|----------------|
| r4 | p4m | square |

**From pmg:** (has mx, gy or my, gx)

| Add | → Supergroup | Lattice needed |
|-----|-------------|----------------|
| r4 | p4g | square |
| s | cmm | centered-rectangular |

**From pgg:** (has gx, gy)

| Add | → Supergroup | Lattice needed |
|-----|-------------|----------------|
| s | cmm | centered-rectangular |
| r4 | p4g | square |

**From cmm:** (has s, mx)

| Add | → Supergroup | Lattice needed |
|-----|-------------|----------------|
| r4 | p4m | square |

**From p4:** (has r4)

| Add | → Supergroup | Lattice needed |
|-----|-------------|----------------|
| mx | p4m | square |
| gx | p4g | square |

**From p3:** (has r3)

| Add | → Supergroup | Lattice needed |
|-----|-------------|----------------|
| s0 | p3m1 | hexagonal |
| s1/3 | p31m | hexagonal |
| r6 | p6 | hexagonal |

**From p3m1:** (has r3, s0)

| Add | → Supergroup | Lattice needed |
|-----|-------------|----------------|
| r6 | p6m | hexagonal |

**From p31m:** (has r3, s1/3)

| Add | → Supergroup | Lattice needed |
|-----|-------------|----------------|
| r6 | p6m | hexagonal |

**From p6:** (has r6)

| Add | → Supergroup | Lattice needed |
|-----|-------------|----------------|
| s0 | p6m | hexagonal |

p4m, p4g, p6m are **maximal** — no supergroups exist.

---

## 7. Gaussian process symmetrization

### 7a. Dual lattice

The dual lattice consists of wave-vectors **k** such that **k** · **v** ∈ 2πℤ
for all lattice translations **v**.  Given V = [**v₁** | **v₂**]:

> K = 2π (Vᵀ)⁻¹

Concretely, with det V = v₁ₓ v₂ᵧ − v₁ᵧ v₂ₓ:

> **k₁** = (2π / det V)(v₂ᵧ, −v₂ₓ)
> **k₂** = (2π / det V)(−v₁ᵧ, v₁ₓ)

### 7b. Fourier expansion

A smooth T-periodic function is expanded over the dual lattice:

> f(**r**) = dc + Σ_{**k** in half-plane} [ aₖ cos(**k** · **r**) + bₖ sin(**k** · **r**) ]

where the half-plane is {(n₁, n₂) : n₁ > 0} ∪ {(0, n₂) : n₂ > 0}, and
**k** = n₁**k₁** + n₂**k₂** with |n₁|, |n₂| ≤ N (truncation parameter,
default N = 5).

### 7c. Spectral envelope

For a squared-exponential (RBF) kernel with length scale ℓ:

> C(**r**, **r′**) = exp(−‖**r** − **r′**‖² / (2ℓ²))

the spectral density is proportional to exp(−‖**k**‖²ℓ²/2).  Each
half-plane coefficient is drawn as:

> envelope(**k**) = exp(−‖**k**‖²ℓ² / 4)
> aₖ = envelope(**k**) · ξ_a,  bₖ = envelope(**k**) · ξ_b

where ξ_a, ξ_b ~ N(0,1) (Box-Muller from a seedable PRNG, mulberry32).
The DC offset is drawn from N(0, 0.01).

The ℓ²/4 exponent (rather than ℓ²/2) accounts for splitting each complex
mode into two real coefficients, each contributing variance ½.

### 7d. Symmetrization

Given coset representatives P = {g₁, …, g_N} from the G/T enumeration:

> f_sym(**r**) = (1/|P|) Σ_{gᵢ ∈ P} f(gᵢ(**r**))

**Proof of G-invariance.**  For h ∈ G, write h = τ · gⱼ (τ ∈ T).  Then:

> f_sym(h(**r**)) = (1/|P|) Σᵢ f(gᵢ τ gⱼ(**r**))

gᵢ τ gⱼ = τ′ gₖ for some τ′ ∈ T and gₖ ∈ P (since G/T is a group and T
is normal).  Since f is T-periodic, f(τ′ gₖ(**r**)) = f(gₖ(**r**)).  As
i ranges over P, gᵢ ↦ gₖ is a bijection, so the sum is unchanged. ∎

### 7e. Animation: stochastic harmonic oscillator

Each Fourier coefficient (aₖ, bₖ) evolves as an independent damped
oscillator driven by noise (Langevin dynamics):

> dX = V dt
> dV = −ω² X dt − 2ζω V dt + σ dW

where ω is the natural frequency (animation speed), ζ is the damping ratio,
and σ is chosen so the stationary marginal for X is N(0, envelope²).

The exact discrete-time solution uses the matrix exponential:

> [X(t+Δt), V(t+Δt)] = M · [X(t), V(t)] + noise

where M = exp(A·Δt) for A = [[0, 1], [−ω², −2ζω]], computed analytically
for the underdamped (ζ < 1), critically damped (ζ ≈ 1), and overdamped
(ζ > 1) cases.

The noise covariance is Q = Σ_∞ − M Σ_∞ Mᵀ where Σ_∞ = diag(envelope², ω²·envelope²), applied via Cholesky decomposition.

### 7f. Equivariant mode

When |G/T| = 2 (groups p2, pm, pg, cm), an alternative **equivariant**
function can be constructed:

> f_eq(**r**) = ½ [f(**r**) − f(g(**r**))]

where g is the non-identity coset representative.  This function changes
sign under the group action rather than being invariant.

### 7g. Wind map mode

The wind map uses two independent GPs (f₁, f₂) to construct an equivariant
vector field:

> **V**_sym(**r**) = (1/|P|) Σ_{g ∈ P} Rᵍᵀ · **V**_raw(g(**r**))

where **V**_raw = (f₁, f₂) and Rᵍ is the linear (rotation/reflection) part
of g.  This field transforms correctly under the point group.

---

## 8. Validation

### 8a. Generator validation

For each generator g = (A, t), three checks are performed:

1. **Integer linear part:** all entries of A must be integers (so A maps
   ℤ² to ℤ²).
2. **det(A) = ±1:** A must be in GL(2,ℤ), ensuring A maps ℤ² bijectively
   to itself.
3. **Metric preservation:** AᵀQA = Q (up to tolerance ε = 10⁻⁶), where
   Q = CᵀC is the lattice metric.  This ensures the map is an isometry.

(`validateGenerators()` in rationalGroup.js.)

### 8b. Coset translation validation

After G/T enumeration, any coset with identity linear part should have
translation (0,0) mod ℤ².  A non-zero translation with identity linear part
means the group contains translations not in ℤ² — the chosen lattice doesn't
capture the full translation subgroup.

(`validateCosetTranslations()` in rationalGroup.js.)

### 8c. Degenerate group detection

If |G/T| exceeds 24 during BFS, the group is declared degenerate (likely
caused by generators that don't preserve any lattice).  For valid wallpaper
groups, |G/T| ∈ {1, 2, 3, 4, 6, 8, 12}.

---

## 9. Isometry classification

Each physical isometry is classified by examining its 2×2 linear part
and translation:

| det(L) | Condition | Type | Extra info |
|--------|-----------|------|-----------|
| +1 | L = I, t = 0 | identity | |
| +1 | L = I, t ≠ 0 | translation | |
| +1 | L ≠ I | rotation | angle = atan2(c, a); center from fixed-point equation |
| −1 | along-axis component of t ≈ 0 | reflection | axis angle = atan2(c, a)/2 |
| −1 | along-axis component of t ≠ 0 | glide-reflection | axis angle + glide distance |

The rotation order is determined by comparing the angle to 2π/n for
n ∈ {2, 3, 4, 6} (tolerance 10⁻⁴).

(`classify()`, `rotationOrder()`, `rotationInfo()`, `reflectionInfo()` in
isometry.js.)

---

## 10. Completeness of the parameterization

### 10a. Lattice normalization

**Theorem.**  Any rank-2 lattice in ℝ² can be brought by a similarity
(possibly orientation-reversing) into the normal form **a** = (0,1),
**b** = (x,y) with x ≥ 0, 0 ≤ y ≤ ½, x² + y² ≥ 1.

*Proof.* See §1a.

### 10b. Compatibility table

| Lattice type | Compatible wallpaper types |
|---|---|
| Oblique | p1, p2 |
| Rectangular | p1, p2, pm, pg, pmm, pmg, pgg |
| Centered rectangular | p1, p2, cm, cmm |
| Square | all of rectangular + centered-rect + p4, p4m, p4g |
| Hexagonal | p1, p2, cm, cmm, p3, p3m1, p31m, p6, p6m |

### 10c. Uniqueness up to gauge

Once the lattice and wallpaper type are fixed, the group is determined
**up to conjugation by a translation** (which is a similarity).

- **Rotation centers** can be translated to the origin without changing
  the group (conjugation by lattice translation).
- **Axis offsets** can be shifted to 0 (conjugation by perpendicular
  translation), except where the type requires a specific relative offset
  (pgg: 1/4-period; p4g: 1/2-period).
- **Glide distances** are forced by the lattice (half the shortest lattice
  translation along the glide direction).

Therefore the fixed placements in §3 are the unique canonical form.

### 10d. Surjectivity theorem

**Theorem.**  Every wallpaper group G has a set of UI parameter values
(lattice + type + variant) producing a group conjugate to G by a similarity.

*Proof.*

1. Normalize G's lattice to (0,1), (x,y) by §10a.
2. Identify G's crystallographic type — it appears in the compatibility
   table (§10b) for the lattice type determined by (x,y).
3. By §10c, the canonical generator placement produces a group conjugate
   to G.  ∎

### 10e. Non-injectivity

The parameterization is mildly non-injective at boundary cases:

- **Lattice automorphisms** on square (90° rotation) and hexagonal (60°
  rotation) lattices relate different direction variants that produce
  isometric groups.
- **Boundary identifications** in the (x,y) domain at x² + y² = 1 with
  y = 0 or y = ½.

The UI is surjective but not injective on these boundaries.
