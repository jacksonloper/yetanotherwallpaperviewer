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
| p4g | rotation order 4 + reflection dir 3 | centerS (0.5), centerT (0.5), axisOffset (0) |

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
on the interior of the domain, distinct (x, y) give non-similar lattices.
On the boundary (e.g. x² + y² = 1 at y = 0 or y = ½), the square and
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
