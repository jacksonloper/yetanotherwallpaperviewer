# Completeness of the UI Parameterization

This document argues that the UI of the wallpaper group viewer can reach
**every wallpaper group up to similarity** (isometry + uniform scaling,
including orientation-reversing similarities such as reflections).
By "wallpaper group" we mean every discrete subgroup of Isom(ℝ²) whose
translation subgroup is a rank-2 lattice.  There are infinitely many such
groups — not just 17 — because sliding continuous parameters (lattice shape,
rotation centers, axis offsets) produces genuinely different groups that are
*not* related by any similarity.  The 17 IUC types classify them up
to *isomorphism as abstract groups*; this UI covers the much finer
classification up to *conjugacy inside the full similarity group*
(orientation-preserving *and* orientation-reversing).

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

The result is unique: distinct (x, y) in this domain give non-similar
lattices.  Note that this uniqueness holds precisely because we allow
orientation-reversing similarities in the normalization — if we did not
(i.e. if we insisted on only orientation-preserving similarities), we
would need to extend the domain to include x < 0 to distinguish a lattice
from its mirror image.

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
exactly 17 abstract wallpaper group types.

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
distances).  What remains free is the placement of generators within a
fundamental domain — these are the **continuous moduli** of the wallpaper
group up to similarity.

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

**Theorem.** *Let G be any wallpaper group (discrete subgroup of Isom(ℝ²)
with rank-2 translation lattice).  Then there exist UI parameter values
— a lattice (x, y), a wallpaper type, and continuous generator parameters —
such that the group produced by the viewer is conjugate to G by a
similarity (possibly orientation-reversing).*

*Proof sketch.*

1. **Normalize the lattice.**  By §1, apply a similarity (which may include
   a reflection to make x ≥ 0) to bring G's
   translation lattice into normal form **a** = (0,1), **b** = (x, y).
   The UI can set this (x, y).

2. **Identify the wallpaper type.**  The normalized G has one of the 17
   types.  By §2, this type is listed in the dropdown for the lattice type
   determined by (x, y).

3. **Determine generator placements.**  Each non-translation generator in G
   is a rotation, reflection, or glide reflection.  After normalizing, its
   placement modulo lattice translations is captured by:
   - For rotations: lattice coordinates (s, t) ∈ [0,1)² of the center.
   - For reflections/glides: direction (fixed by type) and perpendicular
     offset ∈ [0,1) expressed as a fraction of the fundamental period.

   The UI sliders for centerS, centerT, and axisOffset range over exactly
   [0, 1) and thus reach every possible placement.

4. **Completeness of generators.**  The wallpaper type dropdown selects
   the correct set of generator types and discrete parameters (rotation
   orders, reflection/glide directions, glide distances).  The continuous
   sliders then determine the specific generators.  By the classification
   theorem, the type plus generators (with translations) generate the full
   group G.

Therefore, every wallpaper group is reachable. ∎

---

## 5. What "up to similarity" means concretely

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
a reflection (if needed) to ensure x ≥ 0.  This absorbs all four operations.
Generator positions are expressed modulo lattice translations, absorbing
overall translation.

Therefore distinct UI parameter values yield **non-equivalent** groups under
the full similarity group (including orientation reversal).  The
parameterization is (essentially) injective as well as surjective — it is a
genuine coordinate system on the moduli space of wallpaper groups up to
similarity.

**Why orientation-reversing similarities are included.**  The constraint
x ≥ 0 is the key: a lattice with second vector (x, y) and its mirror image
with second vector (−x, y) are identified by the reflection (x, y) → (−x, y).
If we classified only up to orientation-preserving similarity, we would
need to allow x to range over all of ℝ (positive and negative) to
distinguish a group from its mirror image.  Since the UI restricts x ≥ 0,
the classification is necessarily up to full similarity.
