# From Lattice + Generators to a Group-Invariant Function

This document describes the full mathematical pipeline used to construct a
smooth, random function on ℝ² that is exactly invariant under a given
wallpaper group.  The implementation lives in `src/math/gaussianProcess.js`
and relies on the rational group enumeration in `src/math/rationalGroup.js`.

---

## 1. Setup: lattice and wallpaper group

A **wallpaper group** G is a discrete group of isometries of ℝ² whose
translation subgroup T is a rank-2 lattice.  We fix a lattice basis

> **v₁** = (0, 1),  **v₂** = (x, y)

so T = { m **v₁** + n **v₂** : m, n ∈ ℤ }.  The non-translation part of G
is specified by a finite list of **generators** — rotations, reflections,
and glide reflections — given as rational 3×3 affine matrices in lattice
coordinates (see `rationalGroup.js`).

The quotient P = G / T is a finite group (order ≤ 12).  Its elements are
the **coset representatives** {g₁, …, g_N}, one per coset of T.  We
enumerate them exactly using BFS with rational arithmetic
(`processGroup()`), then convert each to a physical-coordinate isometry
gₖ(r) = Rₖ r + tₖ via the change of basis M = C · A · C⁻¹
(`quotientToPhysical()`).

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
