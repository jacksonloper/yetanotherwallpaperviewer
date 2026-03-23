# Completeness of the UI Parameterization

This document argues that the UI of the wallpaper group viewer can reach
**every wallpaper group up to similarity** (isometry + uniform scaling,
including orientation-reversing similarities such as reflections).

The key result: once the lattice shape is fixed, the wallpaper type
determines the group **up to similarity** — there are no continuous
degrees of freedom for generator placement.  The only genuine continuous
freedom is lattice shape (x, y).  The UI map is therefore **surjective**:
every similarity class of wallpaper groups is realized.

---

## 0. The UI: a complete inventory

### 0a. Lattice selection

The lattice is always **a** = (0, 1) and **b** = (x, y) with
x ≥ 0, 0 ≤ y ≤ ½, x² + y² ≥ 1.  The UI offers two top-level modes.

**Well-rounded** (both basis vectors have equal length, x² + y² = 1):

| Control | Range | Effect |
|---|---|---|
| Shape slider | 0 → 1 | Sweeps along the unit-circle arc from (1, 0) to (√3/2, ½). Left end = **square** lattice, right end = **hexagonal**, interior = **centered rectangular**. |

Mapping: sliderValue *s* ∈ [0, 1] gives y = s/2, x = √(1 − y²).

**Not well-rounded** (x² + y² > 1): a radio button selects one of three
sub-shapes, each with its own sliders:

| Sub-shape | y | x range | Sliders | Bravais type |
|---|---|---|---|---|
| Rectangular | 0 | (1, 3] | x | Rectangular |
| Centered rectangular | 0.5 | (√3/2, 3] | x | Centered rectangular |
| Oblique | (0.01, 0.49) | (√(1 − y²), 3] | x, y | Oblique |

The five **Bravais lattice types** recognized by the viewer:

| Type | Characterization in (x, y) space |
|---|---|
| Square | (x, y) = (1, 0) |
| Hexagonal | (x, y) = (√3/2, ½) |
| Centered rectangular | x² + y² = 1, 0 < y < ½  (well-rounded, not square/hex) *or*  y = ½, x > √3/2 |
| Rectangular | y = 0, x > 1 |
| Oblique | everything else (0 < y < ½, x² + y² > 1) |

### 0b. Wallpaper type selection

Once the lattice type is determined, a **dropdown** lists the compatible
wallpaper group types (see §2 for the full compatibility table).  Selecting
a type sets the generators to their fixed placements — all generator
parameters (rotation centers, axis offsets) are determined by the type
template with no adjustable sliders (see §3 for why).

Some types have multiple **direction variants** when the lattice admits
several inequivalent reflection/glide directions.  In these cases, a set
of **radio buttons** appears below the dropdown, letting the user choose
which direction class to use (see §3e for the full inventory).

### 0c. Directions available per lattice type

The direction indices (dirIndex) used by reflections and glides reference the
following arrays.  These are produced by `getAllowedIsometries()` in
latticeUtils.js; numbering here matches the 0-based array index.

**Rectangular** (2 reflections, 2 glides):

| Index | Direction | Reflection angle | Glide distance |
|---|---|---|---|
| 0 | along **a** (vertical) | π/2 | ½ |
| 1 | along **b** (horizontal) | 0 | x/2 |

**Centered rectangular — well-rounded** (2 reflections, 2 glides):

| Index | Direction | Reflection angle | Glide distance |
|---|---|---|---|
| 0 | along **a** + **b** | atan2(1 + y, x) | ‖**a** + **b**‖/2 |
| 1 | along **b** − **a** | atan2(y − 1, x) | ‖**b** − **a**‖/2 |

**Centered rectangular — not-well-rounded** (y = ½, 2 reflections, 2 glides):

| Index | Direction | Reflection angle | Glide distance |
|---|---|---|---|
| 0 | vertical (along **a**) | π/2 | ½ |
| 1 | horizontal | 0 | x |

**Square** (4 reflections, 4 glides):

| Index | Direction | Reflection angle | Glide distance |
|---|---|---|---|
| 0 | along **a** + **b** (diagonal ↗) | π/4 | √2/2 |
| 1 | along **b** − **a** (diagonal ↘) | −π/4 | √2/2 |
| 2 | along **a** (vertical) | π/2 | ½ |
| 3 | along **b** (horizontal) | 0 | ½ |

**Hexagonal** (6 reflections, 6 glides):

| Index | Direction | Reflection angle | Glide distance |
|---|---|---|---|
| 0 | along **a** + **b** | π/3 | √3/2 |
| 1 | along **b** − **a** | −π/6 | ½ |
| 2 | along **a** (vertical) | π/2 | ½ |
| 3 | along **b** | π/6 | ½ |
| 4 | along 2**b** − **a** (horizontal) | 0 | √3/2 |
| 5 | along **b** − 2**a** | −π/3 | √3/2 |

(The oblique lattice has no reflection or glide directions.)

### 0d. Wallpaper types and their generators — complete list

For every lattice type, the table below lists each wallpaper type and its
generators.  Direction indices refer to §0c.  All generator placement
parameters are fixed by the type template (see §3).  Types marked with
**(V)** have direction variants selectable via radio buttons.

**Oblique lattice:**

| Type | Generators |
|---|---|
| p1 | *(none)* |
| p2 | rotation order 2, center (0, 0) |

**Rectangular lattice:**

| Type | Generators | Variants |
|---|---|---|
| p1 | *(none)* | — |
| p2 | rotation order 2, center (0, 0) | — |
| pm **(V)** | reflection dir 0 *or* dir 1 | ∥ a (vertical) / ∥ b (horizontal) |
| pg **(V)** | glide dir 0 *or* dir 1 | ∥ a (vertical) / ∥ b (horizontal) |
| pmm | reflection dir 0 + reflection dir 1 | — |
| pmg **(V)** | reflection dir 1 + glide dir 0, *or* dir 0 + dir 1 | Mirror ∥ b + glide ∥ a / Mirror ∥ a + glide ∥ b |
| pgg | glide dir 1 (axisOffset 0.25) + glide dir 0 (axisOffset 0.25) | — |

**Centered rectangular lattice:**

| Type | Generators | Variants |
|---|---|---|
| p1 | *(none)* | — |
| p2 | rotation order 2, center (0, 0) | — |
| cm **(V)** | reflection dir 0 *or* dir 1 | Mirror ∥ a+b / Mirror ∥ b−a |
| cmm | reflection dir 0 + reflection dir 1 | — |

**Square lattice:**

| Type | Generators (default variant) | Variants |
|---|---|---|
| p1 | *(none)* | — |
| p2 | rotation order 2, center (0, 0) | — |
| pm **(V)** | reflection dir 2 *or* dir 3 | ∥ a (vertical) / ∥ b (horizontal) |
| pg **(V)** | glide dir 2 *or* dir 3 | ∥ a (vertical) / ∥ b (horizontal) |
| cm **(V)** | reflection dir 0 *or* dir 1 | ∥ a+b (↗) / ∥ b−a (↘) |
| pmm | refl dir 2 + dir 3 | — |
| pmg **(V)** | refl dir 3 + glide dir 2, *or* dir 2 + dir 3 | Mirror ∥ b + glide ∥ a / Mirror ∥ a + glide ∥ b |
| pgg | glide dir 3 + dir 2 (offset 0.25) | — |
| cmm | refl dir 0 + dir 1 | — |
| p4 | rotation order 4, center (0, 0) | — |
| p4m | rotation order 4, center (0, 0) + reflection dir 3 | — |
| p4g | rotation order 4, center (0, 0) + reflection dir 1 (axisOffset 0.5) | — |

**Hexagonal lattice:**

| Type | Generators |
|---|---|
| p1 | *(none)* |
| p2 | rotation order 2, center (0, 0) |
| cm | reflection dir 0 |
| cmm | reflection dir 0 + reflection dir 1 |
| p3 | rotation order 3, center (0, 0) |
| p3m1 | rotation order 3, center (0, 0) + reflection dir 2 |
| p31m | rotation order 3, center (0, 0) + reflection dir 4 |
| p6 | rotation order 6, center (0, 0) |
| p6m | rotation order 6, center (0, 0) + reflection dir 4 |

### 0e. Auxiliary controls

| Control | Range | Purpose |
|---|---|---|
| Direction variant (radio) | depends on type | Selects among inequivalent direction classes for the chosen wallpaper type (appears only when multiple variants exist) |
| Max word length | 1 – 20 | Limits the length of generator words explored during group generation |
| Max elements | 100 – 5000 | Caps the number of group elements stored |
| Show F | checkbox | Toggles display of a reference "F" glyph |
| F offset x | [0, 1] | Horizontal display offset of the F glyph (purely cosmetic) |
| F offset y | [0, 1] | Vertical display offset of the F glyph (purely cosmetic) |
| Copy JSON | button | Copies the current group specification to the clipboard |

---

## 1. Normalizing the lattice

**Claim.** Any rank-2 lattice in ℝ² can be brought by a similarity
(possibly orientation-reversing) into the normal form

> **a** = (0, 1),  **b** = (x, y)  with  x ≥ 0,  0 ≤ y ≤ ½,  x² + y² ≥ 1.

*Proof.*
Let Λ = ℤ**v** + ℤ**w** be an arbitrary rank-2 lattice.

1. **Scale.**  Multiply ℝ² by 1/‖**v**‖ so that the shortest basis vector has
   length 1.
2. **Rotate.**  Rotate so that shortest vector is (0, 1) = **a**.
3. **Choose second vector.**  Among all lattice vectors not parallel to **a**,
   pick **b** with minimal length ‖**b**‖ ≥ 1 (Minkowski-reduced).
   Reduce modulo **a** so 0 ≤ y ≤ ½.  If x < 0, apply the reflection
   (x, y) → (−x, y) to the entire plane; this is an orientation-reversing
   similarity that makes x ≥ 0.  The condition ‖**b**‖ ≥ ‖**a**‖ = 1
   gives x² + y² ≥ 1.

The result is unique up to boundary identifications and lattice symmetries:
in the strict interior of the domain, distinct (x, y) correspond to
non-similar lattices.  On the boundary (e.g. x² + y² = 1 at y = 0 or
y = ½), the square and
hexagonal lattices have extra automorphisms that identify some parameter
values; and lattices with y = 0 or y = ½ sit on the boundary of the
fundamental domain for the modular group.  These boundary identifications
mean uniqueness holds generically (almost everywhere) but not at every
boundary point.

The UI offers exactly this parameterization:

| UI control | (x, y) range | Lattice type |
|---|---|---|
| Well-rounded slider (0 → 1) | x² + y² = 1, y ∈ [0, 0.5] | Square → centered-rectangular → hexagonal |
| Not-well-rounded: rectangular slider | y = 0, x > 1 | Rectangular |
| Not-well-rounded: centered-rectangular slider | y = 0.5, x > √3/2 | Centered rectangular |
| Not-well-rounded: oblique sliders | 0 < y < 0.5, x² + y² > 1 | Oblique |

Together these cover the full closed domain {(x, y) : x ≥ 0, 0 ≤ y ≤ ½,
x² + y² ≥ 1}. ∎

---

## 2. The 17 wallpaper types and their compatibility with lattices

By the crystallographic restriction theorem, every wallpaper group's point
group (its image in O(2) after quotienting out translations) is one of 10
finite subgroups of O(2): {1, 2, 3, 4, 6, m, 2mm, 3m, 4mm, 6mm}.  Combined
with the possible translation subgroups and extension choices, this gives
exactly 17 crystallographic wallpaper types.  These 17 types are a
*geometric* classification (by affine conjugacy), not merely an algebraic
one: groups of the same type share the same pattern of symmetry operations
relative to their lattice, but different lattice shapes within the same type
yield infinitely many distinct similarity classes.

Each type constrains the lattice:

| Lattice type | Compatible wallpaper types |
|---|---|
| Oblique | p1, p2 |
| Rectangular | p1, p2, pm, pg, pmm, pmg, pgg |
| Centered rectangular | p1, p2, cm, cmm |
| Square | p1, p2, pm, pg, cm, pmm, pmg, pgg, cmm, p4, p4m, p4g |
| Hexagonal | p1, p2, cm, cmm, p3, p3m1, p31m, p6, p6m |

(When a type appears under a more-symmetric lattice, it means the group uses
only a sub-symmetry of that lattice.  For instance, pm on a square lattice
uses only one of the two reflection directions, yielding a group isomorphic
to pm on a rectangular lattice but with the particular constraint that
the rectangle is a square.)

The UI's wallpaper-type dropdown, populated per lattice type, lists exactly
these compatible types.  Every one of the 17 types appears in at least one
lattice category.

---

## 3. Why there are no continuous degrees of freedom

### 3a. The main observation

Once the lattice Λ is fixed and the wallpaper type is chosen, the group
is determined **up to similarity**.  There are no continuous degrees of
freedom for generator placement.

For each wallpaper type, the generators involve:
- **Rotation centers** — specified as a point mod Λ.
- **Reflection/glide axis offsets** — the perpendicular distance of the axis
  from the origin, modulo the axis periodicity.
- **Glide distances** — forced by the lattice (half the shortest lattice
  translation along the glide direction).

In the old code, the UI exposed continuous sliders (centerS, centerT,
axisOffset) for these quantities.  However, all of these are **gauge
choices** — different origin conventions for the same group.

### 3b. Why placement parameters are gauge

**Rotation center.**  A rotation of order *n* about center *p* generates
the same wallpaper group as a rotation about *p* + **v** for any lattice
vector **v** (since the group already contains translation by **v**).
Furthermore, translating the *origin* by any vector *w* conjugates
rotation(*p*) to rotation(*p* − *w*), producing the same group.  So the
center mod Λ is a gauge choice (an origin convention), not a distinct group.

**Axis offset.**  Similarly, a reflection or glide axis at perpendicular
offset *d* generates the same group as one at offset *d* + *kP* (for integer
*k* and period *P*).  And a global translation perpendicular to the axis
shifts *d* without changing the group.  So the offset is also gauge.

**Multiple generators.**  When a type has two generators (e.g. pmm with two
perpendicular reflections), the relative placement between them *could*
matter.  But the crystallographic constraints of each type force the
generators into a discrete set of valid configurations modulo Λ.  For
example, in pmm the two mirror families intersect at half-lattice points,
and all valid intersection patterns are related by lattice translations.

### 3c. Consequence for the UI

The app uses fixed default placements in its generator templates: rotation
center at (0, 0) and axisOffset = 0 (except pgg at 0.25 and p4g at 0.5,
which are the unique correct relative offsets for those types).  No sliders
are exposed for these parameters.

### 3d. Degrees of freedom summary

The only genuine continuous freedom is **lattice shape** (x, y):

| Category | Continuous freedom |
|---|---|
| Types on oblique/rectangular/centered-rectangular lattices | Lattice shape (x, y) — 1 or 2 real parameters depending on lattice sub-mode |
| Types on fixed lattices (p4, p4m, p4g on square; p3, p3m1, p31m, p6, p6m on hexagonal) | **Zero** — the lattice is uniquely determined |

### 3e. Discrete direction variants

Although there are no *continuous* degrees of freedom, some wallpaper types
have multiple **discrete direction choices** when the lattice admits
several inequivalent reflection/glide directions.  These arise mainly on
the rectangular and square lattices.

The UI presents these as radio buttons.  The following table summarizes:

| Type | Lattice | Variant count | Description |
|---|---|---|---|
| pm | Rectangular | 2 | Mirror ∥ a (vertical) or ∥ b (horizontal) |
| pm | Square | 2 | Mirror ∥ a (vertical) or ∥ b (horizontal) |
| pg | Rectangular | 2 | Glide ∥ a (vertical) or ∥ b (horizontal) |
| pg | Square | 2 | Glide ∥ a (vertical) or ∥ b (horizontal) |
| cm | Centered rect | 2 | Mirror ∥ a+b or ∥ b−a |
| cm | Square | 2 | Mirror ∥ a+b (↗) or ∥ b−a (↘) |
| pmg | Rectangular | 2 | Mirror ∥ b + glide ∥ a, or mirror ∥ a + glide ∥ b |
| pmg | Square | 2 | Mirror ∥ b + glide ∥ a, or mirror ∥ a + glide ∥ b |

All other types × lattice combinations have exactly 1 option (no radio).

**Why pmm, pgg, and cmm have no direction variants on the square lattice:**
On the square lattice, pmm with axial reflections (dirs 2, 3) and cmm with
axial reflections (dirs 2, 3) produce the *same* group, and similarly pmm
with diagonal reflections (dirs 0, 1) = cmm with diagonal reflections.
Likewise, pgg with diagonal glides (dirs 0, 1) produces a group containing
reflections, so it is actually cmm, not pgg.  Therefore, each of pmm, pgg,
and cmm on the square lattice has exactly one correct generator configuration:
- **pmm**: axial reflections (dirs 2, 3)
- **pgg**: axial glides (dirs 3, 2 with offset 0.25)
- **cmm**: diagonal reflections (dirs 0, 1)

### 3f. The F offset is purely cosmetic

The F offset controls (fOffsetX, fOffsetY) shift the display position of
the reference "F" glyph.  They do not affect the mathematical group in any
way — the same set of isometries is generated regardless of the F position.

---

## 4. Main theorem (surjectivity)

**Theorem.** *Let G be any wallpaper group.  Then there exist UI parameter
values — a lattice (x, y) and a wallpaper type — such that the group
produced by the viewer is conjugate to G by a similarity (possibly
orientation-reversing).*

*Proof.*

1. **Normalize the lattice.**  By §1, apply a similarity to bring G's
   translation lattice into normal form **a** = (0, 1), **b** = (x, y).
   The UI can set this (x, y).

2. **Identify the wallpaper type.**  The normalized G has one of the 17
   crystallographic types.  By §2, this type is listed in the dropdown for
   the lattice type determined by (x, y).

3. **Generator placement is determined.**  By §3, the wallpaper type
   together with the lattice determines the group up to similarity.
   The fixed generator placements in the type template produce a group
   conjugate to G by a translation (which is itself a similarity).

Therefore every wallpaper group is reachable. ∎

---

## 5. Non-injectivity

Two wallpaper groups G₁ and G₂ are equivalent if there exists a similarity
T such that G₂ = T G₁ T⁻¹.

The normalization in §1 uses scaling + rotation to fix **a** = (0, 1), and
a reflection (if needed) to ensure x ≥ 0.  This absorbs most similarity
freedom, but two sources of non-injectivity remain:

1. **Lattice automorphisms.**  Special lattices have automorphism groups
   larger than {±1}.  The square lattice has a 90° rotation symmetry; the
   hexagonal lattice has a 60° rotation symmetry.  These automorphisms can
   relate different (x, y) values on the boundary of the fundamental domain,
   so the same group may correspond to multiple lattice parameter values.

2. **Boundary identifications.**  On the boundary of the (x, y) domain
   (e.g. x² + y² = 1 at y = 0 or y = ½), distinct parameter values may
   become equivalent due to extra lattice symmetry.

The UI thus provides a **surjective, mildly non-injective** parameterization
of wallpaper groups up to similarity.  The non-injectivity is confined to
boundary cases in the lattice parameter space.

**Why orientation-reversing similarities are included.**  The constraint
x ≥ 0 is the key: a lattice with second vector (x, y) and its mirror image
with second vector (−x, y) are identified by the reflection (x, y) → (−x, y).
If we classified only up to orientation-preserving similarity, we would
need to allow x to range over all of ℝ to distinguish a group from its
mirror image.

---

## 6. Generator formulas: the UI → isometry pipeline

### 6a. Isometry representation

Every isometry is stored as a 3×3 affine matrix:

```
[a  b  tx]
[c  d  ty]
[0  0   1]
```

where the top-left 2×2 block is orthogonal (det = ±1) and (tx, ty) is the
translation component.

### 6b. Translation generators

Always two, determined entirely by the lattice:

- **t₁** = translation(0, 1)  — the normalized first basis vector **a**.
- **t₂** = translation(x, y)  — the second basis vector **b** from the UI.

### 6c. `parseGenerator`: template → isometry

The function `parseGenerator(gen, allowedIso, latticeVec)` in `App.jsx`
converts each generator template into an isometry.  All placement parameters
are fixed in the template (center = (0, 0) for rotations; axisOffset = 0
for most reflections/glides, with specific values for pgg and p4g).

**Rotation** (gen.type = `'rotation'`):

> θ = 2π / gen.order;  center = (0, 0)
>
> Return rotation(θ, 0, 0)

**Reflection** (gen.type = `'reflection'`):

> dir = allowedIso.reflections[gen.dirIndex]
>
> (px, py) = axisOffsetToPoint(gen.axisOffset, dir.angle, latticeVec)
>
> Return reflection(dir.angle, px, py)

**Glide reflection** (gen.type = `'glide-reflection'`):

> dir = allowedIso.glides[gen.dirIndex]
>
> (px, py) = axisOffsetToPoint(gen.axisOffset, dir.angle, latticeVec)
>
> Return glideReflection(dir.angle, dir.dist, px, py)

### 6d. Coordinate conversion formulas

**axisOffsetToPoint(offset, angle, latticeVec)**:

> P = computeAxisPeriod(angle, latticeVec)
>
> d = offset · P
>
> (px, py) = d · (−sin(angle), cos(angle))

The point (px, py) lies on the axis line at perpendicular distance d from
the origin, measured in the direction normal to the axis.

**computeAxisPeriod(angle, {x, y})**:

> n = (−sin(angle), cos(angle))    *(unit normal to axis)*
>
> p₁ = |n · (0, 1)| = |cos(angle)|    *(perpendicular period from* ***a****)*
>
> p₂ = |n · (x, y)| = |−x·sin(angle) + y·cos(angle)|    *(perpendicular period from* ***b****)*
>
> period = gcd(p₁, p₂)    *(real-valued Euclidean GCD with tolerance)*

### 6e. Isometry construction formulas

**rotation(θ, cx, cy)** — rotation by θ about (cx, cy):

> a = cos θ,  b = −sin θ,  c = sin θ,  d = cos θ
>
> tx = cx(1 − cos θ) + cy·sin θ
>
> ty = cy(1 − cos θ) − cx·sin θ

**reflection(α, px, py)** — reflection across the line through (px, py)
with direction angle α:

> a = cos 2α,  b = sin 2α,  c = sin 2α,  d = −cos 2α
>
> tx = px − px·cos 2α − py·sin 2α
>
> ty = py − px·sin 2α + py·cos 2α

**glideReflection(α, dist, px, py)** — reflect across the line through
(px, py) with direction α, then translate by dist along the axis:

> result = compose( translation(dist·cos α, dist·sin α),  reflection(α, px, py) )

### 6f. Parameter summary

| Parameter | Type | Source |
|---|---|---|
| Lattice (x, y) | Continuous | Lattice sliders — the only genuine continuous freedom |
| Wallpaper type | Discrete (17 choices) | Dropdown, constrained by lattice type |
| Direction variant | Discrete (1 or 2) | Radio buttons when type has variants (see §3e) |
| Rotation order | Discrete (2, 3, 4, 6) | Fixed per wallpaper type |
| Rotation center | Fixed at (0, 0) | Template default (gauge choice — see §3) |
| dirIndex | Discrete (index into direction list) | Selected by variant radio or fixed per type |
| axisOffset | Fixed (0, 0.25, or 0.5) | Template default (gauge choice — see §3) |
| Glide distance | Fixed per direction | Computed from lattice by `getAllowedIsometries` |

---

## 7. Case-by-case surjectivity analysis

For each of the 17 types, this section gives the lattice restriction,
generator formula (with fixed parameters), and a brief surjectivity
argument.  Throughout, **a** = (0, 1), **b** = (x, y), and
Λ = ℤ**a** + ℤ**b**.

---

### p1 — Translations only

**Lattice:** Any.  **Generators:** None beyond translations.

**Surjectivity.**  Every p1 group is determined entirely by its lattice.
After normalization (§1), the UI covers the full domain. ✔

---

### p2 — 180° rotation

**Lattice:** Any.  **Generator:** rotation(π, 0, 0).

**Surjectivity.**  A p2 group is determined by its lattice and a 2-fold
center mod Λ.  Any center can be translated to the origin without changing
the group (§3b), so the fixed center (0, 0) suffices. ✔

---

### pm — One reflection

**Lattice:** Rectangular or Square.
**Generator:** reflection at angle from dirIndex, through origin.
**Direction variants:** 2 direction choices (∥ a or ∥ b) on both rectangular and
square lattices (see §3e).

**Surjectivity.**  A pm group has parallel mirrors.  The direction is
selected by the variant radio.  Any mirror position can be translated to
pass through the origin. ✔

---

### pg — One glide reflection

**Lattice:** Rectangular or Square.
**Generator:** glideReflection at angle from dirIndex, distance from lattice.
**Direction variants:** 2 direction choices (∥ a or ∥ b) on both rectangular and
square lattices (see §3e).

**Surjectivity.**  The glide distance is forced by the lattice.  The
direction is selected by the variant radio.  Any glide axis can be
translated to pass through the origin. ✔

---

### cm — Reflection on centered lattice

**Lattice:** Centered rectangular, Square, or Hexagonal.
**Generator:** reflection(α, 0, 0), where α is the direction angle for
the chosen dirIndex (see §0c).
**Direction variants:** 2 choices on centered-rectangular (∥ a+b or ∥ b−a)
and on square (∥ a+b (↗) or ∥ b−a (↘)); 1 option on hexagonal.

**Surjectivity.**  The mirror direction is selected by the lattice type
and variant radio; any axis position can be translated to the origin. ✔

---

### pmm — Two perpendicular reflections

**Lattice:** Rectangular or Square.
**Generators:** Two perpendicular reflections through origin.
**Direction variants:** None.  On rectangular: dirs 0, 1 (axial).  On square:
dirs 2, 3 (axial).  Diagonal reflections on a square lattice produce cmm,
not pmm (see §3e).

**Surjectivity.**  The two mirror families are perpendicular.  Their
intersection point can be translated to the origin. ✔

---

### pmg — Reflection + glide in perpendicular directions

**Lattice:** Rectangular or Square.
**Generators:** One reflection + one perpendicular glide, both through origin.
**Direction variants:** 2 on each lattice — which direction gets the mirror
and which gets the glide.

**Surjectivity.**  The mirror and glide can be translated so both pass
through the origin. ✔

---

### pgg — Two perpendicular glide reflections

**Lattice:** Rectangular or Square.
**Generators:** Two perpendicular glide reflections with axisOffset = 0.25.
**Direction variants:** None.  On rectangular: glide dirs 1, 0.  On square:
glide dirs 3, 2 (axial).  Diagonal glides on a square lattice produce cmm,
not pgg (see §3e).

The fixed axisOffset = 0.25 places the two glide axes at a quarter-period
offset from the origin, which is the unique correct relative displacement.

**Surjectivity.**  The pgg group requires two perpendicular glide axes
offset by a quarter-period.  The fixed template value 0.25 produces this
configuration; any other valid placement is related by translation. ✔

---

### cmm — Two reflections on centered lattice

**Lattice:** Centered rectangular, Square, or Hexagonal.
**Generators:** Two perpendicular reflections through origin (dirs 0, 1).
**Direction variants:** None.  On all lattices the generator pair is dirs 0, 1.
Axial reflections on a square lattice produce pmm, not cmm (see §3e).

**Surjectivity.**  The two mirror families' intersection point can be
translated to the origin. ✔

---

### p4 — 90° rotation

**Lattice:** Square only (x = 1, y = 0).
**Generator:** rotation(π/2, 0, 0).

**Surjectivity.**  On the square lattice, a p4 group is determined up to
similarity — there is exactly one square lattice up to similarity, and any
4-fold center can be translated to the origin.  Zero continuous degrees of
freedom. ✔

---

### p4m — 90° rotation + axial reflection

**Lattice:** Square only.
**Generators:** rotation(π/2, 0, 0) + reflection(0, 0, 0).
**Dir:** rotation order 4 + reflection dir 3 (angle 0, horizontal).

With R₀ = rotation(π/2, 0, 0) and σ = reflection(0, 0, 0):
- σ is a horizontal mirror through the origin.
- R₀∘σ: diagonal mirror at π/4 through origin.
- R₀²∘σ: vertical mirror through origin.
- R₀³∘σ: diagonal mirror at −π/4 through origin.

All four are **pure reflections** through the 4-fold center.  This is the
defining characteristic of **p4m**. ✔

---

### p4g — 90° rotation + diagonal reflection

**Lattice:** Square only.
**Generators:** rotation(π/2, 0, 0) + reflection(−π/4, ¼, ¼).
**Dir:** rotation order 4 + reflection dir 1 (angle −π/4), axisOffset = 0.5.

The axisOffset = 0.5 places the diagonal mirror through (¼, ¼), offset from
the 4-fold center at the origin.

With R₀ = rotation(π/2, 0, 0) and σ' = reflection(−π/4, ¼, ¼):
- σ': pure **reflection** at −π/4. ✔
- R₀∘σ': horizontal **glide** (distance ½). ✔
- R₀²∘σ': diagonal **glide** at π/4 (distance 1/√2). ✔
- R₀³∘σ': vertical **glide** (distance ½). ✔

The group has **diagonal mirrors only** and **axial glides only** — textbook
**p4g**, confirming it is genuinely different from p4m.

**Key distinction: p4m vs p4g.**
- **p4m** uses an **axial** mirror (dir 3, angle 0°) through the 4-fold
  center.  Conjugation produces mirrors in all 4 directions.
- **p4g** uses a **diagonal** mirror (dir 1, angle −45°) **offset from the
  4-fold center** (axisOffset = 0.5).  Conjugation produces diagonal mirrors
  but only axial *glides*.

**Surjectivity.**  Every p4g group on a square lattice has this structure.
Up to translation, the 4-fold center goes to the origin and the diagonal
mirror to axisOffset = 0.5. ✔

---

### p3 — 120° rotation

**Lattice:** Hexagonal only (x = √3/2, y = ½).
**Generator:** rotation(2π/3, 0, 0).

**Surjectivity.**  On the hexagonal lattice, any 3-fold center can be
translated to the origin.  Zero continuous degrees of freedom. ✔

---

### p3m1 — 120° rotation + reflection (mirrors through rotation centers)

**Lattice:** Hexagonal only.
**Generators:** rotation(2π/3, 0, 0) + reflection(π/2, 0, 0).
**Dir:** rotation order 3 + reflection dir 2 (angle π/2, along **a**).

**p3m1 vs p31m.**  These are the two distinct ways to combine 3-fold
rotations with mirrors on a hexagonal lattice:
- **p3m1**: mirrors along **a** (dirIndex 2, angle π/2) pass *through* the
  3-fold centers.
- **p31m**: mirrors along 2**b**−**a** (dirIndex 4, angle 0) pass *between*
  the 3-fold centers.

The UI distinguishes them by using different dirIndex values. ✔

---

### p31m — 120° rotation + reflection (mirrors between rotation centers)

**Lattice:** Hexagonal only.
**Generators:** rotation(2π/3, 0, 0) + reflection(0, 0, 0).
**Dir:** rotation order 3 + reflection dir 4 (angle 0, along 2**b**−**a**).

**Surjectivity.**  The p31m group has 3-fold centers at positions *not* on
the mirror lines.  The fixed placement (both at origin) produces the correct
relative configuration; any other valid placement is related by
translation. ✔

---

### p6 — 60° rotation

**Lattice:** Hexagonal only.
**Generator:** rotation(π/3, 0, 0).

**Surjectivity.**  Same argument as p3: the center can be translated to the
origin.  Zero continuous degrees of freedom. ✔

---

### p6m — 60° rotation + reflection

**Lattice:** Hexagonal only.
**Generators:** rotation(π/3, 0, 0) + reflection(0, 0, 0).
**Dir:** rotation order 6 + reflection dir 4 (angle 0, along 2**b**−**a**).

**Surjectivity.**  A p6m group has full hexagonal symmetry.  The 6-fold
center and one mirror determine the full group; both can be placed at the
origin. ✔

---

### Summary table

| Type | Lattice | Generators | Direction variants |
|---|---|---|---|
| p1 | Any | *(none)* | — |
| p2 | Any | rot(π) at origin | — |
| pm | Rect/Sq | refl at origin | 2 dirs on Rect; 2 dirs on Sq |
| pg | Rect/Sq | glide at origin | 2 dirs on Rect; 2 dirs on Sq |
| cm | CRect/Sq/Hex | refl at origin | 2 on CRect; 2 dirs on Sq; 1 on Hex |
| pmm | Rect/Sq | refl + refl at origin | 1 on Rect; 1 on Sq |
| pmg | Rect/Sq | refl + glide at origin | 2 on Rect; 2 on Sq |
| pgg | Rect/Sq | glide + glide, offset ¼ | 1 on Rect; 1 on Sq |
| cmm | CRect/Sq/Hex | refl + refl at origin | 1 on CRect/Hex; 1 on Sq |
| p4 | Square | rot(π/2) at origin | — |
| p4m | Square | rot(π/2) + refl at origin | — |
| p4g | Square | rot(π/2) + refl offset ½ | — |
| p3 | Hexagonal | rot(2π/3) at origin | — |
| p3m1 | Hexagonal | rot(2π/3) + refl at origin | — |
| p31m | Hexagonal | rot(2π/3) + refl at origin | — |
| p6 | Hexagonal | rot(π/3) at origin | — |
| p6m | Hexagonal | rot(π/3) + refl at origin | — |

**Notation:** "Rect" = rectangular, "Sq" = square, "CRect" = centered rectangular, "Hex" = hexagonal.

All generator placements are fixed (center at origin, axisOffset = 0 except
pgg at 0.25 and p4g at 0.5).  The only continuous freedom is lattice shape
(x, y), which is zero for types requiring square or hexagonal lattices.
Direction variants are discrete (radio buttons) — see §3e for the complete
inventory.
