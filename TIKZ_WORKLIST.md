# TikZ figure worklist (gradual)

Generated from the full-corpus figure audit (see `_figure_gallery.html`).
Work through these gradually. A problem may appear in several sections — it
needs each kind of work. Follow CLAUDE.md rules (3-place sync, cache bumps,
montage **rendered → present_files → then sync**, never fabricate, one problem
per turn unless told otherwise).

## WHERE WE LEFT OFF (status)
- **Cache state:** global `v=602050`, `sw.js mat-tikz-631`. Bump both on any change.
- **Group-1 NEXT: #78** (done so far: 5,11,15,20,38,53,58,64,68,71,77). Resume there.
- **Recrop (section 3): DONE & committed** for 118 problems → `matura_figs/`
  crops + `tikz_originals` updated + busters. **Skipped 316, 325** (2024
  multi-fig in `matura_figures/`; auto-cropper can't split them — left as-is,
  may need per-figure manual recrop later). See [[matura-crop-conventions]].
- **Empty coordinate systems: ALL 23 DONE & committed** (see
  `_empty_coord_updates.html`): 67,89,160,164,186,220,240,257,364,369,378,
  387(×3),388(×2),399,408(×3),415,422,431,435,442,451,622,773. Lessons in
  [[matura-coordinate-systems]].
- **NEXT: section-2 NON-empty figures** (curves/shapes/vectors) — not started.
  List at bottom of section 2. Do one at a time, montage each.
- Sections **1 (fixing, incl. 122/532)** and **4 (need-tikz)**: not started.
- Working/preview HTML files in `webpage/` (`_figure_gallery.html`,
  `_recrop_gallery.html`, `_empty_coord_updates.html`, `_recrop_preview/`,
  `_readjust*`) are scratch for review — fine to delete before final commit.

Conventions reminder for this batch:
- **Rescale/resize:** match each figure's size to its original; at the current
  `width:100%` display this means **labels should be relatively smaller** than
  the small-scale authoring. Measure cap/unit on the original and set
  `scale ≈ 0.243 / (cap-height ÷ unit)`.
- **Axis dashes:** add tick dashes to the coordinate axes where the original
  has them and the current render lacks them.
- **Empty coordinate systems:** converge on a single reusable preset with a few
  parameterised variants (e.g. complex plane with i/1; different x-/y-labels;
  symmetric vs first-quadrant). Don't hand-roll each one.

Status legend: [ ] todo · [x] done · [~] in progress

---

## 1. TikZ needs fixing (56)
Content/accuracy problems with the existing render.

5, 11, 15, 20, 38, 53, 58, 64, 68, 71, 77, 78, 87, 99, 104
107, 115, 122, 139, 143, 148, 161, 163, 165, 170, 176, 188, 221, 224, 231
245, 247, 256, 276, 289, 314, 315, 325, 334, 346, 374, 384, 385, 396, 403
404, 413, 421, 460, 461, 462, 472, 525, 528, 532, 763

(122 = vector diagram, 532 = vectors — moved here from group 2; they are
not empty coords and need proper redrawing, not rescaling.)

**Group-1 progress (committed):**
- [x] 5 — quadrilateral ABCD. Real issue was the ANGLE LABELS: `angle eccentricity`
  flung γ/101°/70° far along the bisector (γ floated mid-shape). Fix = draw arcs
  with `\pic` (no quote label, per-angle radii 9/6/10/6 mm) + place the four
  labels with explicit `\node at (...)` at the original's measured positions.
  Vertices also set to cv2-detected corners A(0,0) B(5.4,0) C(4.31,2.06) D(1.96,2.82).
  Verified by RED-on-BLACK overlay (mine vs original) — outline+arcs+labels align.
  hash 36a90b4353f6. (2025 problem; no per-problem html.)
  **LESSON: overlay the render on the original to catch label-position errors;
  avoid `angle eccentricity` for labels — place them explicitly.**
- [x] 11 — unit circle w/ A, A', C, B, α=60°. circle+triangle `thick`, added
  `0` origin label, fixed A' (`[above right]`), lowered `C(0,0)`. α arc made a
  double-headed arrow `\pic[draw,<->]{angle=B--C--Xax}`; axis 1/-1 labels nudged
  (yshift/xshift). hash 3e44a8f78380. (2025; no html.)
- [x] 15 — regular hexagon ABCDEF + vectors a,b + T. Added filled dots at ALL
  vertices A–F, moved $\vec a$ label above AB edge, vectors `line width=1.3pt`
  for bigger arrowheads. hash 7f5a06c1ed72. (2025; no html.)
- [x] 20 — cubic graph (MC). REWORKED twice. Final: uniform axes, x ticks −4..4,
  y ticks −7..7 (all `\foreach` dashes, only "1" labeled), scale 0.6, tall
  asymmetric frame (y −9.6..7.9). Cubic **f=0.53(x+2)(x−0.9)(x−2)** — roots
  −2/0.9/2 (extracted by tracing the curve as connected components, NOT eyeballing
  — first guesses −0.6/0.7/1.35 were badly wrong). local max ~3 at x≈−0.9, min
  ~−0.5 at x≈1.5, y-int ~1.9; curve fills the frame. hash ceea71077ff4. (2025; no
  html.) LESSON: to get a plotted curve's params, REMOVE the axis lines+ticks and
  trace the remaining components for x-range/roots/extrema; measure ALL ticks for
  the true range (was missing ±2..±7).
- [x] 38 — ellipse centred at origin. Existing render had WRONG semi-axes
  (a=3,b=2); measured the original (component-trace after axis removal) →
  a_px/b_px ratio 1.66 = **a=5, b=3** (eqn x²/25+y²/9=1). Uniform units (~63px,
  measured both axes), scale 0.75 (cap/unit≈0.30 matched). Then added the small
  axis dashes per original's one-sided style: x-ticks point UP at x∈{±1..±4},
  y-ticks point RIGHT at y∈{±1,±2} (length ~0.08), none at origin/vertices.
  Verified by unit-aligned RED-on-BLACK overlay + montage. hash 5e96e92654e9.
  (2025 problem but HAS per-problem html problems/038.html — synced all 3 places.)
  LESSON: don't assume "2025 ⇒ no html"; check per-problem. Tick direction can be
  one-sided — zoom the original to confirm before authoring `\foreach` ticks.
- [x] 53 — triangle ABC with ED∥BC (E on AB, D on AC). Existing render was
  MIRRORED: C was at (1,7) (right of A) but original has C up-and-LEFT of A.
  Rebuilt from measured vertices (label-blob + line-trace): A=(0,0), B=(6.45,0),
  C=(-2.8,7.55); E,D at t≈0.39 along AB/AC so ED∥BC (matches the drawn config;
  "ni v merilu"). Labels A[below] B[below right] C[above left] E[below] D[left].
  Scale 0.5 (label/triangle-height ratio 0.063 = original). hash 7fdaef8469ee.
  (per-problem html problems/053.html — synced all 3.) LESSON: for non-coordinate
  shapes, check ORIENTATION first (which side the apex leans); measure vertices
  from label centroids + edge endpoints, then match edge-parameter t for internal
  parallels.
- [x] 58 — trapezoid ABCD, BC∥ED, EC⊥AB, EC:EB=2:1. GEOMETRY WAS ALREADY CORRECT
  (verified by measuring page: A=(-5,0) B=(2,0) C=(0,4) D=(-2,4) E=(0,0) match
  within ~5px). Real issues: (a) label scale — original cap/unit=0.376 but render
  was 0.328, so scale 0.75→0.65 (now 0.368); β label nudged out to (147:0.62).
  (b) ORIGINAL CROP CLIPPED the C/D labels at top → RECROPPED from page-15 (match
  score 1.0 at (507,369); expanded top to page-y 335, in the whitespace gap above
  labels). New crop 605×309, buster ?v=f7ff3f added to tikz_originals in bodies+html.
  hash 12ba4a2a74c4. LESSON: a "fixing"-list item may be geometrically fine — the
  defect can be scale and/or a clipped ORIGINAL crop; recrop via matchTemplate on
  the page scan + expand the clipped side to the next whitespace gap.
  FOLLOW-UP (β arc): Daniel flagged the β angle arc. MEASURED the original arc
  properly: erase all straight segments + label + right-angle mark, isolate the
  arc pixels, then overlay candidate B-centred circles — radius 61px = **1.2 units**
  (B-centred), foot ~0.8u toward E, β INSIDE the arc at (1.33,0.5). Final block:
  `\draw ([shift={(B)}]180:1.2) arc (180:117:1.2); \node at (1.33,0.5) {$\beta$};`
  FINAL arc (after much pain): Daniel wants the arc drawn EDGE-TO-EDGE computed from
  the vertices, NOT eyeballed. Method he approved → `\pic [draw, "$\beta$",
  angle eccentricity=0.62, angle radius=6mm] {angle = C--B--E};` (centred at B, spans
  ray B→E to ray B→C = computed 63.43°; eccentricity<1 pulls β tight to the vertex).
  hash a1da290fc117. LESSON: for ANY arc, identify which two edges it spans + compute
  the angle from vertex coords, draw with the `angle` pic so the span locks to the
  edges; keep the marker tight at the vertex with the label pulled IN (ecc≈0.6).
  Full protocol now in CLAUDE.md "Angle arcs". (My earlier "match the large original
  arc" was WRONG — Daniel wants a tight marker, label close to vertex.)
- [x] 64 — apartment FLOOR PLAN (tloris). Old render was wrong (solid bottom, coarse
  1m-only grid). REBUILT from a measured wall trace: erode dark<90 to isolate the
  thick walls, detect H/V wall segments, snap to meters (1m=59px, grid origin px
  (16,22)). Outer L-shape + left notch + two bottom legs (hodnik x4-5, soba2 x6-9)
  with the entrance gap between; all internal walls drawn as detected (door openings
  = the gaps). Grid: fine 0.2m gray!35 `step=0.2` to **x12.4** (half-box past last
  meter line, like orig) + dark `black!70` 1m grid — VERTICALS to x12 via
  `\foreach \x in {0,...,12}`, HORIZONTALS extended to 12.4 via `\foreach \y`
  (Daniel: meter "big-box" outlines must continue into the extended strip). scale 0.5,
  font \scriptsize (orig cap ~0.34m). Scale bar (11,6)-(12,6) w/ end dots, merilo/1m.
  hash 909054f82ca2. LESSONS: (1) floor plans — erode to separate thick walls from the
  thin grid, trace segments→meters, keep door gaps. (2) the grid extends ~half a box
  past the last meter line on the RIGHT, and the dark meter lines continue into that
  strip. (3) Daniel iterates label x-positions one nudge at a time — expect it.
- [x] 68 — two vectors a,b on a coord system (read the components). BOTH vectors were
  wrong: old a=(-3,1.5), b=(3.5,-0.5). Measured the original (unit=39px, origin
  px(657,327)): **a=(-5,2)** (origin→(-5,2)), **b=(5,-1)** drawn (-4,-2)→(1,-3). Old
  render also MISSING the integer ticks (orig has ticks every integer -5..5 on both
  axes; one-sided: x-ticks UP, y-ticks RIGHT, same style as #38). Dashed boxes project
  BOTH endpoints to BOTH axes; for b Daniel corrected twice: tail y-proj stops at
  (0,-2), tip y-proj is (0,-3)-(1,-3). scale 0.5, arrows positive ends only.
  hash ebd9e1ff03c8. NOTE: tikz_originals is the matura_refined PAGE (prob_04.png,
  text+figure), NOT a _figN crop — could recrop to just the figure later (not in
  recrop list). LESSON: to read a drawn vector, isolate the SOLID line (largest
  component; the y-axis splits it — combine parts), endpoints=tail/tip; dashes are
  separate small components.
- [x] 71 — square (side 7) with lower-left isosceles-right triangle (legs 4) cut →
  pentagon; perimeter problem. Geometry was already right (fill (0,7)-(7,7)-(7,0)-
  (4,0)-(0,4); diagonal (0,4)-(4,0)). Only fixes: (a) "x" label was on the LEFT EDGE
  but the original has it ON THE DIAGONAL (hypotenuse) at (1.7,1.7); (b) fill gray!40
  → gray!50 (measured orig fill value 191). a (top, above) & y (bottom-right, below 5.4)
  already correct. hash 27acec2140ba. LESSON: read where side LABELS actually sit
  (measure label centroids in square-normalised coords) — they can mark the diagonal,
  not the edge.
- [x] 77 — cubic p with shaded S1,S2 + line x=3. Old poly WRONG: (x+3)(x-2)² (double
  root at 2). Original TOUCHES at -3 (double) & CROSSES at 2 (simple) →
  **p(x) = -(1/9)(x+3)²(x-2)** (a from p(0)=2). VERIFIED via given areas: S1=625/108,
  S2=193/108 both exact, ∫_{-3}^{3}=4. Big ±6 figure, integer ticks -5..5 (x up,
  y right), scale 0.48, arrows +ends. Dots (-3,0),(0,2),(2,0) at 2.2pt. Line x=3
  extends nearly full height (3,-5.95)-(3,5.9) "just as the graph does". hash
  f855c68cfca7. LESSON: read root MULTIPLICITIES from touch-vs-cross, pin leading
  coeff from a marked point, and cross-check against any given areas/integrals.

## 2. Rescale / resize + axis dashes + empty-coord preset (86)
Adjust overall size (labels relatively smaller), add axis dashes where needed;
roll empty coordinate systems into the shared preset.

**LESSON (do NOT just bulk-rescale):** a blind scale-only pass was rejected.
Each figure needs proper per-figure readjustment — verify axis ranges, which
ticks are labelled and their positions, axis dashes/arrows, AND scale — against
the recropped original, with a montage each time. Work them ONE at a time.

**Empty-coord set careful readjustment — DONE & committed (all 23):**
67, 89, 160, 164, 186, 220, 240, 257, 364, 369, 378, 387, 388, 399, 408,
415, 422, 431, 435, 442, 451, 622, 773
(each rebuilt to match original tick range + labels [π, π/3, i, 5/10, eqn
labels] + scale; 186 kept at 0.4 = already correct; 387 = 3 coord systems;
622 = complex plane w/ grid. Committed to bodies.json + svgs, caches bumped.)

Remaining group-2 = the NON-empty figures (curves/shapes/vectors): 16, 26,
112, 120, 129, 134, 140, 145, 168, 193, 239, 259, 266, 272, 307, 308, 314,
321, 323, 328, 330, 343, 344, 351, 360, 363, 367, 383, 393, 398, 400, 412,
430, 446, 452, 458, 459, 481, 487, 498, 530, 537, 538, 624, 779 — do these
one at a time like the empty coords.

16, 26, 67, 89, 106, 112, 120, 121, 122, 128, 129, 134, 140, 145, 160
164, 168, 186, 193, 208, 210, 220, 236, 239, 240, 257, 259, 266, 272, 307
308, 314, 316, 321, 323, 328, 330, 343, 344, 349, 351, 360, 361, 363, 364
367, 369, 378, 383, 387, 388, 393, 398, 399, 400, 408, 412, 415, 422, 430
431, 435, 442, 446, 451, 452, 458, 459, 481, 487, 488, 498, 505, 506, 515
530, 532, 537, 538, 556, 599, 622, 624, 625, 773, 779

## 3. Readjust the original crop (120)
The `tikz_originals` / page crop needs re-cropping (cut off, too much margin,
wrong region, etc.).

66, 67, 71, 74, 77, 78, 87, 89, 94, 99, 100, 104, 106, 107, 112
115, 120, 121, 122, 123, 128, 129, 134, 139, 140, 143, 145, 148, 154, 157
160, 161, 163, 164, 165, 168, 170, 176, 186, 188, 193, 240, 266, 276, 289
307, 308, 316, 323, 325, 328, 330, 334, 343, 344, 346, 349, 351, 354, 360
361, 363, 364, 367, 369, 374, 378, 383, 384, 385, 387, 388, 393, 396, 398
399, 400, 403, 404, 408, 412, 413, 415, 421, 422, 430, 431, 435, 442, 446
451, 452, 458, 459, 460, 461, 462, 472, 483, 488, 498, 525, 528, 530, 538
556, 599, 623, 626, 660, 683, 688, 692, 727, 731, 763, 773, 779, 800, 808

## 4. Need TikZ (currently "no tikz" but the original has a figure) (17)
Author a new figure. Note: **670** is a photograph (framed picture), not a line
diagram — probably not TikZ-able; confirm with Daniel before attempting.

138, 141, 269, 271, 273, 286, 309, 376, 439, 466, 468, 550, 670, 783, 825, 832, 866

---

Totals: fixing 54 · rescale 86 · crop 120 · need-tikz 17.
(Problems often overlap across sections.)
