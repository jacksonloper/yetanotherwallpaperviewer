# Completeness of the UI Parameterization

This document argues that the UI of the wallpaper group viewer can reach
**every wallpaper group up to similarity** (isometry + uniform scaling,
including orientation-reversing similarities such as reflections).
By "wallpaper group" we mean every discrete subgroup of Isom(ℝ²) whose
translation subgroup is a rank-2 lattice.

The 17 IUC wallpaper types are a *crystallographic* (geometric) classification:
two wallpaper groups have the same type when they are related by an affine
conjugacy that respects the lattice structure.  Within each of the 17 types
there are infinitely many *similarity classes* — groups that share the same
type but are not conjugate by any similarity.  The continuous freedom comes
primarily from lattice shape (the (x, y) parameters); most other UI
parameters (rotation centers, axis offsets) are **gauge choices** — they
select a representative within a similarity class rather than distinguishing
between classes.

The UI map is therefore **surjective but highly non-injective**: every
wallpaper group up to similarity is realized by at least one UI state, but
many distinct UI states correspond to the same group up to similarity.

---

## 0. The UI: a complete inventory

This section is a reference for every control the viewer exposes.  The
proof that these controls reach every wallpaper group begins in §1.

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
wallpaper group types.  Selecting a type resets the generators to their
default placements.

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

For every lattice type, the table below lists each wallpaper type, its
generators, and the **continuous sliders** the UI exposes for that type.
Direction indices refer to §0c.  Default slider values are shown in
parentheses.

**Oblique lattice:**

| Type | Generators | Continuous sliders |
|---|---|---|
| p1 | *(none)* | *(none)* |
| p2 | rotation order 2 | centerS (0), centerT (0) |

**Rectangular lattice:**

| Type | Generators | Continuous sliders |
|---|---|---|
| p1 | *(none)* | *(none)* |
| p2 | rotation order 2 | centerS (0), centerT (0) |
| pm | reflection dir 0 | axisOffset (0) |
| pg | glide dir 0 | axisOffset (0) |
| pmm | reflection dir 0 + reflection dir 1 | axisOffset₀ (0), axisOffset₁ (0) |
| pmg | reflection dir 1 + glide dir 0 | axisOffset₀ (0), axisOffset₁ (0) |
| pgg | glide dir 1 + glide dir 0 | axisOffset₀ (0.25), axisOffset₁ (0.25) |

**Centered rectangular lattice:**

| Type | Generators | Continuous sliders |
|---|---|---|
| p1 | *(none)* | *(none)* |
| p2 | rotation order 2 | centerS (0), centerT (0) |
| cm | reflection dir 0 | axisOffset (0) |
| cmm | reflection dir 0 + reflection dir 1 | axisOffset₀ (0), axisOffset₁ (0) |

**Square lattice:**

| Type | Generators | Continuous sliders |
|---|---|---|
| p1 | *(none)* | *(none)* |
| p2 | rotation order 2 | centerS (0), centerT (0) |
| pm | reflection dir 2 | axisOffset (0) |
| pg | glide dir 2 | axisOffset (0) |
| cm | reflection dir 0 | axisOffset (0) |
| pmm | reflection dir 2 + reflection dir 3 | axisOffset₀ (0), axisOffset₁ (0) |
| pmg | reflection dir 3 + glide dir 2 | axisOffset₀ (0), axisOffset₁ (0) |
| pgg | glide dir 3 + glide dir 2 | axisOffset₀ (0.25), axisOffset₁ (0.25) |
| cmm | reflection dir 0 + reflection dir 1 | axisOffset₀ (0), axisOffset₁ (0) |
| p4 | rotation order 4 | centerS (0), centerT (0) |
| p4m | rotation order 4 + reflection dir 3 | centerS (0), centerT (0), axisOffset (0) |
| p4g | rotation order 4 + reflection dir 1 | centerS (0), centerT (0), axisOffset (0.5) |

**Hexagonal lattice:**

| Type | Generators | Continuous sliders |
|---|---|---|
| p1 | *(none)* | *(none)* |
| p2 | rotation order 2 | centerS (0), centerT (0) |
| cm | reflection dir 0 | axisOffset (0) |
| cmm | reflection dir 0 + reflection dir 1 | axisOffset₀ (0), axisOffset₁ (0) |
| p3 | rotation order 3 | centerS (0), centerT (0) |
| p3m1 | rotation order 3 + reflection dir 2 | centerS (0), centerT (0), axisOffset (0) |
| p31m | rotation order 3 + reflection dir 4 | centerS (0), centerT (0), axisOffset (0) |
| p6 | rotation order 6 | centerS (0), centerT (0) |
| p6m | rotation order 6 + reflection dir 4 | centerS (0), centerT (0), axisOffset (0) |

### 0e. Slider semantics

| Slider | Range | Meaning |
|---|---|---|
| centerS | [0, 1) | Displacement of rotation center along **a** = (0, 1), in lattice coordinates |
| centerT | [0, 1) | Displacement of rotation center along **b** = (x, y), in lattice coordinates |
| axisOffset | [0, 1) | Perpendicular offset of the reflection/glide axis, as a fraction of the fundamental period (computed by `computeAxisPeriod`) |

Together, (centerS, centerT) parameterize the rotation center modulo the
lattice — i.e. a point in ℝ²/Λ.  The axisOffset parameterizes the axis
position modulo its periodicity.  See §3 for the proof that these ranges
are sufficient.

### 0f. Auxiliary controls

| Control | Range | Purpose |
|---|---|---|
| Max word length | 1 – 20 | Limits the length of generator words explored during group generation |
| Max elements | 100 – 5000 | Caps the number of group elements stored |
| Show F | checkbox | Toggles display of a reference "F" glyph |
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

## 3. Continuous parameters within each type

Fixing the lattice and the wallpaper type determines the *discrete* structure
(which rotation orders, which reflection/glide directions, which glide
distances).  What remains are the placement parameters for generators.

**Important caveat.**  The true continuous *moduli* of a wallpaper group up
to similarity come from the lattice shape — the (x, y) parameters.  For a
fixed crystallographic type and fixed lattice, the symmetry constraints
typically force the placement of mirrors, glide axes, and rotation centers
into a discrete set of valid configurations (up to the equivalence imposed
by lattice translations and the group's own symmetries).  The UI's
continuous sliders (centerS, centerT, axisOffset) therefore mostly represent
**gauge choices** — different origin conventions for the same group — rather
than genuinely distinct wallpaper groups.  Nevertheless, these sliders are
needed for *surjectivity*: they ensure the UI can realize every valid
generator placement, not just the default one.

### 3a. Rotation center

A rotation of order *n* about center *p* is conjugate (by a lattice
translation) to a rotation about *p* + **a** or *p* + **b** for any lattice
vectors **a**, **b**.  So the center is determined only mod the lattice, i.e.
as a point in the torus ℝ²/Λ ≅ [0,1) × [0,1) in lattice coordinates.

The UI exposes:
- **centerS** ∈ [0, 1): displacement along **a**
- **centerT** ∈ [0, 1): displacement along **b**

This parameterizes every possible center mod Λ.

### 3b. Reflection / glide axis offset

A reflection (or glide reflection) along a direction θ is specified by:
1. The direction θ — constrained by the lattice to one of finitely many
   values (fixed by the wallpaper type / dirIndex).
2. The perpendicular offset of the axis from the origin — a continuous
   parameter.

The axis is invariant under translation along its own direction, so
translating the axis by any lattice vector parallel to it does not change the
group.  The perpendicular component is periodic with some fundamental period
*P* determined by the lattice geometry.  So the offset is a parameter in
ℝ/(*P*ℤ) ≅ [0, 1).

The UI's **axisOffset** ∈ [0, 1) represents exactly this: the perpendicular
displacement as a fraction of the fundamental period (computed by
`computeAxisPeriod` in latticeUtils.js).

### 3c. Glide distance

The glide distance of a glide reflection is *not* a free parameter: it is
determined by the requirement that the glide reflection squared be a lattice
translation.  For each allowed glide direction, the minimal glide distance is
½ of the shortest lattice translation along that direction.  The UI fixes
these values automatically (see `getAllowedIsometries` in latticeUtils.js).

### 3d. Summary of continuous degrees of freedom

| Generator type | Free continuous parameters |
|---|---|
| Rotation of order *n* | centerS, centerT (2 parameters) |
| Reflection | axisOffset (1 parameter) |
| Glide reflection | axisOffset (1 parameter) |
| (Translations) | none — determined by lattice choice |

These are exactly the slider controls the UI exposes for each generator.

---

## 4. Main theorem

**Theorem (surjectivity).** *Let G be any wallpaper group (discrete subgroup
of Isom(ℝ²) with rank-2 translation lattice).  Then there exist UI parameter
values — a lattice (x, y), a wallpaper type, and continuous generator
parameters — such that the group produced by the viewer is conjugate to G by
a similarity (possibly orientation-reversing).*

In other words, the UI map is surjective: every similarity class of
wallpaper groups is realized.  The map is *not* injective — many UI states
produce the same group up to similarity (see §5).

*Proof sketch.*

1. **Normalize the lattice.**  By §1, apply a similarity (which may include
   a reflection to make x ≥ 0) to bring G's
   translation lattice into normal form **a** = (0,1), **b** = (x, y).
   The UI can set this (x, y).

2. **Identify the wallpaper type.**  The normalized G has one of the 17
   crystallographic types.  By §2, this type is listed in the dropdown for
   the lattice type determined by (x, y).

3. **Determine generator placements.**  Each non-translation generator in G
   is a rotation, reflection, or glide reflection.  After normalizing, its
   placement modulo lattice translations is captured by:
   - For rotations: lattice coordinates (s, t) ∈ [0,1)² of the center.
   - For reflections/glides: direction (fixed by type) and perpendicular
     offset ∈ [0,1) expressed as a fraction of the fundamental period.

   The UI sliders for centerS, centerT, and axisOffset range over [0, 1)
   and thus offer enough placements (often redundantly) to realize all
   valid configurations.

4. **Completeness of generators.**  The wallpaper type dropdown selects
   the correct set of generator types and discrete parameters (rotation
   orders, reflection/glide directions, glide distances).  The continuous
   sliders then determine the specific generators.  By the classification
   theorem, the type plus generators (with translations) generate the full
   group G.

Therefore, every wallpaper group is reachable. ∎

---

## 5. Non-injectivity and what "up to similarity" means

Two wallpaper groups G₁ and G₂ are considered equivalent if there exists a
similarity T (composition of rotation, reflection, translation,
and uniform scaling) such that G₂ = T G₁ T⁻¹.  Concretely:

- **Scaling** the plane uniformly changes the lattice spacing but not the
  symmetry structure.
- **Rotating** the plane changes which direction is "up" but not the group.
- **Reflecting** the plane (orientation reversal) maps a group to its
  mirror image.
- **Translating** shifts the origin, conjugating all generators.

The normalization in §1 uses scaling + rotation to fix **a** = (0, 1), and
a reflection (if needed) to ensure x ≥ 0.  This absorbs scaling, rotation,
and reflection.  However, translation is only *partially* absorbed:
expressing generator positions modulo the lattice removes lattice
translations, but a global translation of the origin can still map
different (centerS, centerT) or axisOffset values to the same group.
This is the primary source of **non-injectivity** in the UI parameterization.

### Sources of non-injectivity

1. **Global translation (gauge freedom).**  Translating the plane by a
   non-lattice vector conjugates every generator — shifting rotation centers
   and axis offsets — but produces the same wallpaper group.  Consequently,
   many combinations of (centerS, centerT, axisOffset) yield the same group
   up to similarity.  For most wallpaper types, the continuous placement
   sliders are entirely gauge: symmetry constrains the valid placements to
   a discrete set of equivalence classes.

2. **Lattice automorphisms.**  Even after lattice normalization, special
   lattices (square, hexagonal) have automorphism groups larger than {±1}.
   The square lattice has a 90° rotation symmetry; the hexagonal lattice
   has a 60° rotation symmetry.  These automorphisms can map one set of
   generator parameters to another while preserving the group.  This
   creates additional identifications among UI states not captured by the
   lattice normalization alone.

3. **Boundary identifications.**  On the boundary of the (x, y) domain
   (e.g. x² + y² = 1 at y = 0 or y = ½), the lattice acquires extra
   symmetry and distinct parameter values may become equivalent.

### Summary

The UI provides a **surjective, highly non-injective** parameterization of
wallpaper groups up to similarity.  The surjectivity argument (§4) is the
main content of this document: every wallpaper group can be reached.  The
non-injectivity means that the UI parameter space is much larger than the
true moduli space — the continuous freedom comes from lattice shape, while
most generator-placement sliders are gauge choices that do not change the
similarity class of the group.

**Why orientation-reversing similarities are included.**  The constraint
x ≥ 0 is the key: a lattice with second vector (x, y) and its mirror image
with second vector (−x, y) are identified by the reflection (x, y) → (−x, y).
If we classified only up to orientation-preserving similarity, we would
need to allow x to range over all of ℝ (positive and negative) to
distinguish a group from its mirror image.  Since the UI restricts x ≥ 0,
the classification is necessarily up to full similarity.

---

## 6. Exact generator formulas: the UI → isometry pipeline

This section gives the precise formulas the app uses to convert UI state
into isometry generators.  All references are to the source files
`App.jsx`, `isometry.js`, and `latticeUtils.js`.

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

### 6c. `parseGenerator`: UI state → isometry

The function `parseGenerator(gen, allowedIso, latticeVec)` in `App.jsx`
converts each generator template into an isometry object.  The three cases:

**Rotation** (gen.type = `'rotation'`):

1. Compute angle: θ = 2π / gen.order
2. Compute center: (cx, cy) = latticeCoordsToCenter(gen.centerS, gen.centerT, latticeVec)
3. Return rotation(θ, cx, cy)

**Reflection** (gen.type = `'reflection'`):

1. Look up direction: dir = allowedIso.reflections[gen.dirIndex]
2. Compute axis point: (px, py) = axisOffsetToPoint(gen.axisOffset, dir.angle, latticeVec)
3. Return reflection(dir.angle, px, py)

**Glide reflection** (gen.type = `'glide-reflection'`):

1. Look up direction and distance: dir = allowedIso.glides[gen.dirIndex]
2. Compute axis point: (px, py) = axisOffsetToPoint(gen.axisOffset, dir.angle, latticeVec)
3. Return glideReflection(dir.angle, dir.dist, px, py)

### 6d. Coordinate conversion formulas

**latticeCoordsToCenter(s, t, {x, y})**:

> (cx, cy) = t·(x, y) + s·(0, 1) = (t·x,  s + t·y)

Maps lattice coordinates (s, t) ∈ [0, 1)² to Cartesian coordinates.

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

### 6f. Discrete vs continuous parameter summary

| Parameter | Type | Determined by |
|---|---|---|
| Lattice (x, y) | Continuous | Lattice sliders |
| Wallpaper type | Discrete (17 choices) | Dropdown, constrained by lattice type |
| Rotation order | Discrete (2, 3, 4, 6) | Fixed per wallpaper type |
| dirIndex | Discrete (index into direction list) | Fixed per wallpaper type |
| Glide distance | Discrete (fixed per direction) | Computed from lattice by `getAllowedIsometries` |
| centerS, centerT | Continuous, [0, 1) | Sliders (gauge choice — see §5) |
| axisOffset | Continuous, [0, 1) | Slider (gauge choice — see §5) |

---

## 7. Case-by-case surjectivity analysis

For each of the 17 crystallographic types, this section lists:
1. The lattice restriction.
2. The generators constructed by the UI.
3. The exact isometry formulas with all free parameters.
4. Hidden constraints.
5. A surjectivity argument: given an arbitrary wallpaper group G of this
   type in standard form, can UI parameters be found that produce a similar
   group?

Throughout, **a** = (0, 1), **b** = (x, y), and the lattice is
Λ = ℤ**a** + ℤ**b** in the normalized domain of §1.

---

### p1 — Translations only

| | |
|---|---|
| **Lattice** | Any (oblique, rectangular, centered-rectangular, square, hexagonal) |
| **Generators** | None (translations only) |
| **Free params** | Lattice (x, y) only |
| **Constraints** | None |

**Surjectivity.**  Every p1 group is determined entirely by its lattice.
After normalization (§1), the lattice is parameterized by (x, y).  The UI
covers the full normalized domain. ✔

---

### p2 — 180° rotation

| | |
|---|---|
| **Lattice** | Any |
| **Generators** | rotation(π, cx, cy) |
| **Free params** | (x, y), centerS ∈ [0,1), centerT ∈ [0,1) |
| **Constraints** | None beyond lattice |

**Formula.**

> (cx, cy) = (centerT · x,  centerS + centerT · y)
>
> Generator = rotation(π, cx, cy)

**Surjectivity.**  A p2 group is determined by its lattice and the location
of a 2-fold center mod Λ.  The center can be placed anywhere in ℝ²/Λ; the
sliders (centerS, centerT) parameterize this full torus.  For a given G,
normalize the lattice, read off the center mod Λ, and set the sliders
accordingly. ✔

**Non-injectivity.**  Any translate of the origin shifts (centerS, centerT)
but produces the same group up to similarity — the center position is a
gauge choice.

---

### pm — One reflection

| | |
|---|---|
| **Lattice** | Rectangular (y = 0, x > 1) or Square (x = 1, y = 0) |
| **Generators** | reflection(π/2, px, py) — mirror along **a** (vertical) |
| **Dir** | Rectangular: dirIndex 0 (angle π/2).  Square: dirIndex 2 (angle π/2). |
| **Free params** | (x, y), axisOffset ∈ [0, 1) |
| **Constraints** | Mirror direction is vertical (along **a**); only the perpendicular offset is free. |

**Formula.**

> period = computeAxisPeriod(π/2, (x, y)) = gcd(|cos(π/2)|, |−x·sin(π/2) + y·cos(π/2)|) = gcd(0, x) = x
>
> — wait, for rectangular: cos(π/2) = 0, so p₁ = 0. And p₂ = |−x·0 + 0·0| = 0 when y = 0... let's recompute:
>
> Actually: n = (−sin(π/2), cos(π/2)) = (−1, 0).
>
> p₁ = |n · a| = |n · (0,1)| = |0| = 0.
>
> p₂ = |n · b| = |n · (x, 0)| = |−x| = x.
>
> period = gcd(0, x) = x.
>
> d = axisOffset · x.
>
> (px, py) = d · (−sin(π/2), cos(π/2)) = d · (−1, 0) = (−d, 0)
>
> Generator = reflection(π/2, −axisOffset·x, 0)

For the square lattice (x = 1): period = 1, so (px, py) = (−axisOffset, 0).

**Surjectivity.**  A pm group has parallel mirror lines perpendicular to
**b**, spaced by x/2.  Up to a lattice translation along **b**, any
such mirror can be shifted to an offset in [0, x).  The slider
axisOffset ∈ [0, 1) maps to [0, x) via multiplication by x, covering
all valid placements. ✔

---

### pg — One glide reflection

| | |
|---|---|
| **Lattice** | Rectangular or Square |
| **Generators** | glideReflection(π/2, ½, px, py) — glide along **a**, distance ½ |
| **Dir** | Rectangular: dirIndex 0 (angle π/2, dist ½).  Square: dirIndex 2 (angle π/2, dist ½). |
| **Free params** | (x, y), axisOffset ∈ [0, 1) |
| **Constraints** | Glide distance = ½ (half of ‖**a**‖ = 1), direction vertical. |

**Formula.**

> Same axis-period computation as pm: period = x (rectangular) or 1 (square).
>
> (px, py) = axisOffset · period · (−1, 0)
>
> Generator = glideReflection(π/2, 0.5, px, py)

**Surjectivity.**  The only freedom is the perpendicular offset of the
glide axis.  The glide distance is forced to ½.  The slider covers
all offsets mod the period. ✔

---

### cm — Reflection on centered-rectangular/square/hexagonal lattice

| | |
|---|---|
| **Lattice** | Centered rectangular, Square, or Hexagonal |
| **Generators** | reflection(α, px, py) |
| **Dir** | Centered-rect: dirIndex 0 (angle = atan2(1+y, x), along **a**+**b**).  Square: dirIndex 0 (angle π/4, diagonal).  Hex: dirIndex 0 (angle π/3, along **a**+**b**). |
| **Free params** | (x, y), axisOffset ∈ [0, 1) |
| **Constraints** | Lattice must have a centering that makes this a cm (not pm) group. |

**Formula.**

> α = direction angle (depends on lattice type, see §0c)
>
> period = computeAxisPeriod(α, (x, y))
>
> (px, py) = axisOffset · period · (−sin α, cos α)
>
> Generator = reflection(α, px, py)

**Surjectivity.**  In a cm group the mirror direction is fixed by the
lattice; the only freedom is the perpendicular offset, which the slider
parameterizes modulo the period. ✔

---

### pmm — Two perpendicular reflections

| | |
|---|---|
| **Lattice** | Rectangular or Square |
| **Generators** | reflection(π/2, px₀, py₀) + reflection(0, px₁, py₁) |
| **Dir** | Rectangular: dir 0 (π/2, vertical) + dir 1 (0, horizontal).  Square: dir 2 (π/2) + dir 3 (0). |
| **Free params** | axisOffset₀ ∈ [0, 1), axisOffset₁ ∈ [0, 1) |
| **Constraints** | The two mirror directions are perpendicular; offsets are independent. |

**Formulas.**

> Generator 0 (vertical mirror): same as pm computation.
>
> Generator 1 (horizontal mirror):
>
> n = (−sin 0, cos 0) = (0, 1).  p₁ = |cos 0| = 1.  p₂ = |y·1| = y (= 0 for rectangular).
>
> For rectangular (y = 0): period = gcd(1, 0) = 1.
>
> (px₁, py₁) = axisOffset₁ · 1 · (0, 1) = (0, axisOffset₁)
>
> Generator 1 = reflection(0, 0, axisOffset₁)

**Surjectivity.**  The pmm group has two families of perpendicular mirror
lines.  Each family's offset is parameterized independently by the
corresponding axisOffset slider.  Every valid configuration is reached. ✔

---

### pmg — Reflection + glide in perpendicular directions

| | |
|---|---|
| **Lattice** | Rectangular or Square |
| **Generators** | reflection(0, px₀, py₀) + glideReflection(π/2, ½, px₁, py₁) |
| **Dir** | Rectangular: reflection dir 1 (0, horizontal) + glide dir 0 (π/2, vertical).  Square: reflection dir 3 (0) + glide dir 2 (π/2). |
| **Free params** | axisOffset₀ ∈ [0, 1), axisOffset₁ ∈ [0, 1) |
| **Constraints** | The mirror is horizontal; the glide is vertical with distance ½. |

**Formulas.**

> Generator 0 = reflection(0, 0, axisOffset₀ · period₀)  — horizontal mirror
>
> Generator 1 = glideReflection(π/2, 0.5, −axisOffset₁ · period₁, 0)  — vertical glide

**Surjectivity.**  For a pmg group, valid configurations are: horizontal
mirrors at spacing 1/2, vertical glides interleaved at spacing x/2.  The
two axisOffset sliders independently position one representative from
each family.  Every admissible offset pair is realized. ✔

**Key check.**  The pmg type requires the *reflection* and *glide* to be in
perpendicular directions.  The UI enforces this by fixing the dirIndex
values in the template.  The distinction between pmg and pmm/pgg comes
from the choice of reflection vs. glide for each direction.

---

### pgg — Two perpendicular glide reflections

| | |
|---|---|
| **Lattice** | Rectangular or Square |
| **Generators** | glideReflection(0, dist₀, px₀, py₀) + glideReflection(π/2, ½, px₁, py₁) |
| **Dir** | Rectangular: glide dir 1 (0, horizontal, dist = x/2) + glide dir 0 (π/2, vertical, dist = ½).  Square: glide dir 3 (0, dist ½) + glide dir 2 (π/2, dist ½). |
| **Free params** | axisOffset₀ ∈ [0, 1), axisOffset₁ ∈ [0, 1) |
| **Default** | axisOffset₀ = 0.25, axisOffset₁ = 0.25 |
| **Constraints** | The two glide axes must be in perpendicular directions; glide distances are determined by lattice. |

**Formulas.**

> Generator 0 = glideReflection(0, x/2, 0, axisOffset₀ · period₀)  — horizontal glide
>
> Generator 1 = glideReflection(π/2, 0.5, −axisOffset₁ · period₁, 0)  — vertical glide

**Surjectivity.**  Valid configurations require the two glide axes to be
offset from each other by a quarter-period (the default offset 0.25 is one
such choice).  The sliders can reach every admissible pairing. ✔

---

### cmm — Two reflections on centered lattice

| | |
|---|---|
| **Lattice** | Centered rectangular, Square, or Hexagonal |
| **Generators** | reflection(α₀, px₀, py₀) + reflection(α₁, px₁, py₁) |
| **Dir** | Centered-rect: dir 0 + dir 1 (along **a**+**b** and **b**−**a**).  Square: dir 0 (π/4) + dir 1 (−π/4).  Hex: dir 0 (π/3) + dir 1 (−π/6). |
| **Free params** | axisOffset₀ ∈ [0, 1), axisOffset₁ ∈ [0, 1) |
| **Constraints** | Lattice must support centering; the two mirror directions are determined by the lattice. |

**Surjectivity.**  A cmm group has two families of mirrors at angles
determined by the lattice.  Each family's offset is independent and the
slider covers the full period. ✔

---

### p4 — 90° rotation

| | |
|---|---|
| **Lattice** | Square only (x = 1, y = 0) |
| **Generators** | rotation(π/2, cx, cy) |
| **Free params** | centerS ∈ [0, 1), centerT ∈ [0, 1) |
| **Constraints** | Lattice must be square. |

**Formula.**

> (cx, cy) = (centerT, centerS)   *(since x = 1, y = 0)*
>
> Generator = rotation(π/2, centerT, centerS)

**Surjectivity.**  A p4 group is determined by the location of its 4-fold
center mod Λ.  The sliders parameterize the full torus ℝ²/Λ. ✔

**Non-injectivity.**  The 4-fold symmetry of the square lattice means
the four points (s, t), (t, 1−s), (1−s, 1−t), (1−t, s) all yield the
same group up to conjugacy.

---

### p4m — 90° rotation + axial reflection (square lattice)

| | |
|---|---|
| **Lattice** | Square only |
| **Generators** | rotation(π/2, cx, cy) + reflection(0, px, py) |
| **Dir** | Rotation order 4 + reflection dir 3 (angle 0, horizontal) |
| **Free params** | centerS ∈ [0, 1), centerT ∈ [0, 1), axisOffset ∈ [0, 1) |
| **Default** | centerS = 0, centerT = 0, axisOffset = 0 |
| **Constraints** | Mirror is along an axis direction (horizontal). |

**Formulas.**

> Rotation generator = rotation(π/2, centerT, centerS)
>
> Mirror: period = gcd(1, 0) = 1.  (px, py) = (0, axisOffset).
>
> Reflection generator = reflection(0, 0, axisOffset)

**Surjectivity.**  A p4m group has a 4-fold center with mirrors in all
four directions (two axial + two diagonal) passing through it.  When the
4-fold center is at the origin and the horizontal mirror passes through
the origin, conjugation by the 90° rotation produces vertical, and both
diagonal mirrors — all through the origin.  The center and mirror offset
sliders cover all placements mod Λ. ✔

**Mirror structure.**  With R₀ = rotation(π/2, 0, 0) and σ = reflection(0, 0, 0):
- σ is a horizontal mirror through the origin.
- R₀∘σ maps (x,y) → (y, x): diagonal mirror at π/4 through origin.
- R₀²∘σ maps (x,y) → (−x, y): vertical mirror through origin.
- R₀³∘σ maps (x,y) → (−y, −x): diagonal mirror at −π/4 through origin.
All four are pure reflections (zero glide component), all passing through
the 4-fold center.  This is the defining characteristic of **p4m**.

---

### p4g — 90° rotation + diagonal reflection (square lattice)

| | |
|---|---|
| **Lattice** | Square only |
| **Generators** | rotation(π/2, cx, cy) + reflection(−π/4, px, py) |
| **Dir** | Rotation order 4 + reflection dir 1 (angle −π/4, along **b**−**a**) |
| **Free params** | centerS ∈ [0, 1), centerT ∈ [0, 1), axisOffset ∈ [0, 1) |
| **Default** | centerS = 0, centerT = 0, axisOffset = 0.5 |
| **Constraints** | Mirror is along a diagonal direction, offset from the 4-fold center. |

**Formulas.**

> Rotation generator = rotation(π/2, centerT, centerS) = rotation(π/2, 0, 0) at default
>
> Mirror direction: angle = −π/4 (along **b**−**a** diagonal).
>
> Period = computeAxisPeriod(−π/4, (1, 0)) = gcd(1/√2, 1/√2) = 1/√2 ≈ 0.707.
>
> At axisOffset = 0.5: d = 0.5 · 1/√2 = 1/(2√2).
>
> (px, py) = (1/4, 1/4).
>
> Reflection generator = reflection(−π/4, 1/4, 1/4)
>
> This is the isometry (x, y) → (−y + 1/2, −x + 1/2), which matches IUCr
> p4g operation (8).

**Mirror structure proof.**  With R₀ = rotation(π/2, 0, 0) and
σ' = reflection(−π/4, 1/4, 1/4):

- σ' maps (x, y) → (−y + 1/2, −x + 1/2): pure **reflection** at −π/4. ✔
- R₀ ∘ σ' maps (x, y) → (x − 1/2, −y + 1/2): horizontal **glide** (distance 1/2). ✔
- R₀² ∘ σ' maps (x, y) → (y − 1/2, x − 1/2): diagonal **glide** at π/4 (distance 1/√2). ✔
- R₀³ ∘ σ' maps (x, y) → (−x + 1/2, y − 1/2): vertical **glide** (distance 1/2). ✔

No lattice translation converts the horizontal or vertical glides into pure
reflections, because the axial glide distance is 1/2, and the axial lattice
period is 1; an integer shift cannot cancel 1/2 mod 1.  However, the
diagonal glide R₀² ∘ σ' *can* be converted into a pure reflection by adding
translation (0, 1): the result (y − 1/2, x + 1/2) has zero glide component.

Summary: the group has **diagonal mirrors only** (at ±45°) and **axial
glides only** (at 0° and 90°).  This is the defining characteristic of
**p4g**, confirming it is genuinely different from p4m.

**Key distinction: p4m vs p4g.**  These are distinguished by the mirror
*direction*, not just the rotation center placement:
- **p4m** uses an **axial** mirror (dir 3, angle 0°).  Conjugation by the
  4-fold rotation produces mirrors in all 4 directions.
- **p4g** uses a **diagonal** mirror (dir 1, angle −45°) **offset from the
  4-fold center** (axisOffset = 0.5).  Conjugation produces diagonal mirrors
  but only axial *glides*.

**Why the old implementation was wrong.**  The previous p4g used the same
axial mirror as p4m (dir 3, angle 0°) but shifted the rotation center to
(1/2, 1/2).  Since rotation(π/2, 1/2, 1/2) = translation(1, 0) ∘ rotation(π/2, 0, 0),
this is just the p4m rotation composed with a lattice translation — it
generates exactly the same group as p4m.

**Surjectivity.**  Every p4g group on a square lattice has diagonal mirrors
not passing through the 4-fold centers.  Up to translation, we can place
the 4-fold center at the origin and the diagonal mirror at axisOffset = 0.5.
The continuous sliders allow translating the center and mirror
independently, covering all valid placements. ✔

---

### p3 — 120° rotation

| | |
|---|---|
| **Lattice** | Hexagonal only (x = √3/2, y = ½) |
| **Generators** | rotation(2π/3, cx, cy) |
| **Free params** | centerS ∈ [0, 1), centerT ∈ [0, 1) |
| **Constraints** | Lattice must be hexagonal. |

**Formula.**

> (cx, cy) = (centerT · √3/2,  centerS + centerT · ½)
>
> Generator = rotation(2π/3, cx, cy)

**Surjectivity.**  The 3-fold center can be anywhere mod Λ; the sliders
cover the full torus. ✔

---

### p3m1 — 120° rotation + reflection (mirrors through rotation center)

| | |
|---|---|
| **Lattice** | Hexagonal only |
| **Generators** | rotation(2π/3, cx, cy) + reflection(π/2, px, py) |
| **Dir** | Rotation order 3 + reflection dir 2 (angle π/2, along **a**) |
| **Free params** | centerS ∈ [0, 1), centerT ∈ [0, 1), axisOffset ∈ [0, 1) |
| **Constraints** | Mirror along **a** passes through the 3-fold center. |

**Formulas.**

> Rotation = rotation(2π/3, cx, cy)
>
> Mirror: n = (−1, 0), period = gcd(0, √3/2) = √3/2.
>
> (px, py) = axisOffset · (√3/2) · (−1, 0) = (−axisOffset · √3/2, 0)
>
> Reflection = reflection(π/2, px, py)

**Surjectivity.**  A p3m1 group has mirrors along **a** passing through the
3-fold centers.  The key distinction from p31m is which set of mirror lines
is present. ✔

**Key check: p3m1 vs p31m.**  These are the two distinct ways to combine
3-fold rotations with mirrors on a hexagonal lattice:
- **p3m1**: mirrors along **a** (dirIndex 2, angle π/2) pass through the
  3-fold centers.
- **p31m**: mirrors along 2**b**−**a** (dirIndex 4, angle 0) pass between
  the 3-fold centers.
The UI distinguishes them by using different dirIndex values.

---

### p31m — 120° rotation + reflection (mirrors between rotation centers)

| | |
|---|---|
| **Lattice** | Hexagonal only |
| **Generators** | rotation(2π/3, cx, cy) + reflection(0, px, py) |
| **Dir** | Rotation order 3 + reflection dir 4 (angle 0, along 2**b**−**a**) |
| **Free params** | centerS ∈ [0, 1), centerT ∈ [0, 1), axisOffset ∈ [0, 1) |
| **Constraints** | Mirror along 2**b**−**a** does *not* pass through the 3-fold center. |

**Formulas.**

> Rotation = rotation(2π/3, cx, cy)
>
> Mirror direction angle = 0 (horizontal).  n = (0, 1).  period = gcd(1, ½) = ½.
>
> (px, py) = axisOffset · ½ · (0, 1) = (0, axisOffset/2)
>
> Reflection = reflection(0, px, py)

**Surjectivity.**  The p31m group has 3-fold centers at positions *not* on
the mirror lines.  The UI's independent control of center position and
mirror offset allows all valid configurations. ✔

---

### p6 — 60° rotation

| | |
|---|---|
| **Lattice** | Hexagonal only |
| **Generators** | rotation(π/3, cx, cy) |
| **Free params** | centerS ∈ [0, 1), centerT ∈ [0, 1) |
| **Constraints** | Lattice must be hexagonal. |

**Formula.**

> (cx, cy) = (centerT · √3/2,  centerS + centerT/2)
>
> Generator = rotation(π/3, cx, cy)

**Surjectivity.**  Same argument as p3: the center can be anywhere mod Λ,
and the sliders cover the full torus. ✔

---

### p6m — 60° rotation + reflection

| | |
|---|---|
| **Lattice** | Hexagonal only |
| **Generators** | rotation(π/3, cx, cy) + reflection(0, px, py) |
| **Dir** | Rotation order 6 + reflection dir 4 (angle 0, horizontal, along 2**b**−**a**) |
| **Free params** | centerS ∈ [0, 1), centerT ∈ [0, 1), axisOffset ∈ [0, 1) |
| **Constraints** | Highest symmetry hexagonal group. |

**Formulas.**

> Rotation = rotation(π/3, cx, cy)
>
> Mirror: same as p31m mirror computation (direction 0, period ½).
>
> Reflection = reflection(0, 0, axisOffset/2)

**Surjectivity.**  A p6m group has full hexagonal symmetry (6-fold rotation
+ all 6 mirror families).  The 6-fold center and one mirror offset
determine the full group. ✔

---

### Summary table

| Type | Lattice | Generators | Discrete params (fixed by type) | Continuous params (sliders) | Hidden constraints |
|---|---|---|---|---|---|
| p1 | Any | *(none)* | — | (x, y) | — |
| p2 | Any | rot(π) | order = 2 | (x, y), centerS, centerT | Center is gauge |
| pm | Rect/Sq | refl(π/2) | dirIndex = 0 or 2 | (x, y), axisOffset | Offset is gauge |
| pg | Rect/Sq | glide(π/2, ½) | dirIndex = 0 or 2, dist = ½ | (x, y), axisOffset | Offset is gauge |
| cm | CRect/Sq/Hex | refl(α) | dirIndex = 0 | (x, y), axisOffset | α depends on lattice shape |
| pmm | Rect/Sq | refl(π/2) + refl(0) | dirs = (0,1) or (2,3) | (x, y), axisOffset₀, axisOffset₁ | Offsets are gauge |
| pmg | Rect/Sq | refl(0) + glide(π/2, ½) | dirs = (1,0) or (3,2) | (x, y), axisOffset₀, axisOffset₁ | Offsets are gauge |
| pgg | Rect/Sq | glide(0, d₀) + glide(π/2, ½) | dirs = (1,0) or (3,2), dists fixed | (x, y), axisOffset₀, axisOffset₁ | Default offset ¼ |
| cmm | CRect/Sq/Hex | refl(α₀) + refl(α₁) | dirs = (0,1) | (x, y), axisOffset₀, axisOffset₁ | α₀, α₁ depend on lattice |
| p4 | Square | rot(π/2) | order = 4 | centerS, centerT | Center is gauge |
| p4m | Square | rot(π/2) + refl(0) | order = 4, dir = 3 (axial) | centerS, centerT, axisOffset | Axial mirror; mirrors in all 4 dirs |
| p4g | Square | rot(π/2) + refl(−π/4) | order = 4, dir = 1 (diagonal), offset = 0.5 | centerS, centerT, axisOffset | Diagonal mirror offset from center; mirrors in 2 dirs, glides in 2 |
| p3 | Hexagonal | rot(2π/3) | order = 3 | centerS, centerT | Center is gauge |
| p3m1 | Hexagonal | rot(2π/3) + refl(π/2) | order = 3, dir = 2 | centerS, centerT, axisOffset | Mirror through center |
| p31m | Hexagonal | rot(2π/3) + refl(0) | order = 3, dir = 4 | centerS, centerT, axisOffset | Mirror between centers |
| p6 | Hexagonal | rot(π/3) | order = 6 | centerS, centerT | Center is gauge |
| p6m | Hexagonal | rot(π/3) + refl(0) | order = 6, dir = 4 | centerS, centerT, axisOffset | Full hex symmetry |

**Notation:** "Rect" = rectangular, "Sq" = square, "CRect" = centered rectangular, "Hex" = hexagonal.

### Addressing the critical cases

**pmg, pgg, cm, cmm** — These types require specific relationships between
generator placements.  The UI handles this by fixing the dirIndex values
in the templates (see wallpaperGroups.js) and allowing only axisOffset
as the continuous parameter.  Since the direction and glide distance are
determined by the lattice (not free), the only remaining question is
whether all admissible perpendicular offsets are reachable — and they are,
since axisOffset ∈ [0, 1) covers the full period.

**p3m1 vs p31m** — The crucial distinction is which mirror direction is
used:
- p3m1 uses dirIndex 2 (angle π/2, along **a**), whose mirrors pass through
  the 3-fold centers.
- p31m uses dirIndex 4 (angle 0, along 2**b**−**a**), whose mirrors pass
  between the 3-fold centers.
These are genuinely different crystallographic types (not related by any
lattice automorphism of the hexagonal lattice), and the UI correctly
distinguishes them via dirIndex.

**p4g** — The previous implementation was **incorrect**: it used the same
axial mirror direction (dir 3) as p4m and only shifted the rotation center
to (½, ½).  Since rotation(π/2, ½, ½) = translation(1, 0) ∘ rotation(π/2, 0, 0),
this produces *exactly the same group* as p4m — the center shift is
absorbed by a lattice translation.

The fix: p4g now uses a **diagonal** mirror direction (dir 1, angle −π/4)
with axisOffset = 0.5, placing the mirror axis through (¼, ¼) — which
does NOT pass through the 4-fold center at the origin.  Computation of
all coset representatives confirms:
- σ' at −45°: pure reflection ✔
- R₀∘σ' at 0°: glide (distance ½) ✔
- R₀²∘σ' at 45°: glide (distance 1/√2) ✔
- R₀³∘σ' at 90°: glide (distance ½) ✔

No lattice translation converts the axial glides into pure reflections
(since 1/2 mod 1 ≠ 0).  But T₁ ∘ R₀² ∘ σ' gives a diagonal mirror at +45°.
Result: **diagonal mirrors only, axial glides only** = textbook p4g.
