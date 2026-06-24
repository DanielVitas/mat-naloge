# TikZ figure worklist (gradual)

> ## ⛔ #1 RULE — NEVER SKIP ⛔
> **EVERY figure turn (rebuild OR a one-line tweak) MUST LEAD with a SIDE-BY-SIDE montage
> (new render LEFT, original RIGHT, matched height) via `present_files`, BEFORE any text or
> "approve?" question.** No exceptions, no vertical stacks, no render-only, no overlay-only.
> Daniel raged on #58 and #165 when this was skipped. If a turn touches a figure and the
> reply has no new-vs-original side-by-side, STOP — that reply is wrong.

Generated from the full-corpus figure audit (see `_figure_gallery.html`).
Work through these gradually. A problem may appear in several sections — it
needs each kind of work. Follow CLAUDE.md rules (3-place sync, cache bumps,
montage **rendered → present_files → then sync**, never fabricate, one problem
per turn unless told otherwise).

## WHERE WE LEFT OFF (status)
- **Cache state:** global `v=602147`, `sw.js mat-tikz-674`. Bump both on any change.
- **Group-1 NEXT: #460** (done: …,403,413,421; #404 MERGED into #396 — see below). Resume there.
  - #421 (circle r6 ctr S + inscribed rect ABCD + radii SC,SD + angle φ=∠CSD + shaded region, hash
    `3d1131b452e7`, orig `?v=e0a805` unchanged): tunnel cross-section. Rect corners (±2.4,±1.8) (tikz r=3,
    matches orig). Existing render shaded ONLY the rectangle + light `gray!40` + had NO φ arc. FIX:
    shaded region = rectangle **+ TOP circular segment** (area 54sinφ+18φ = 72sinφ rect + (18φ−18sinφ)
    seg). Fill path `(A)--(B)--(C) arc[start angle=36.87,end angle=143.13,radius=3] -- cycle` (arc center
    inferred = (0,0)=S; top arc C→D over 90°). Fill **gray!70** (orig val165). Added φ angle arc at S:
    `(36.87:0.62) arc[start angle=36.87,end angle=143.13,radius=0.62]`, φ label (0,0.3). Lines **semithick**
    (orig thin; `thick` was too bold). LESSON: shaded-area problems — the region often includes a circular
    segment beyond a chord; verify via the given area formula (sector ½r²φ=18φ term ⇒ segment present).
  - #413 (line p + circle k diam AB + 2 shaded circular segments, hash `bff4f8627155`, orig `?v=8f93be`
    unchanged): circle k center (2,3) r=√13 passes through A(0,6), origin(0,0), B(4,0). Existing render
    FAKED the segments with `arc[...]` whose center (derived from start point) was (2.55,3.45), NOT k's
    center → crescents didn't follow the circle; line p had wrong slope (didn't pass through A&B). FIX:
    segments are the REAL k-segments — left (x<0, chord on y-axis (0,0)-(0,6)): `(0,6) arc[start angle=
    123.69,end angle=236.31,radius=3.6056] -- cycle`; bottom (y<0, chord on x-axis (0,0)-(4,0)): `(0,0)
    arc[start angle=236.31,end angle=303.69,radius=3.6056] -- cycle` (TikZ arc center = startpt −
    r·(cos start,sin start) = (2,3) ✓). Line p exact slope −1.5 through A,B: `(-1.2,7.8)--(5.3,-1.95)`.
    Fill `gray!50` (orig val 191). Added integer tick marks (x{-2,-1,1,2,3,5}, y{-1,1,2,3,4,5}). A/B
    labels `above right`, nudged up-left to (-0.18,6.18)/(3.82,0.18); 6/1 left, 1/4 below, 0 below-left,
    k right of circle, p at line's bottom-right. scale 0.7. LESSON: `arc[start angle,radius]` infers the
    center from the current point — to trace a SPECIFIC circle's segment, start at a known point ON that
    circle and use that circle's radius so the inferred center lands right.
- **DUP MERGE (done):** the corpus had same-text problems stored as two entries. Merged the two genuine
  OR/VR splits into ONE problem each carrying both levels (matches the #346 template — `levels:["OR","VR"]`,
  one figure, two `instances`): **#396←#404** (2019 Jesenski water-tank) and **#302←#306** (2024 ellipse).
  Per merge: meta entry kept on the OR/lower n (levels→[OR,VR]); drop entry removed from meta+bodies; the
  VR `instance` object appended to the kept page's `const PROBLEM`; the dropped page (`404.html`/`306.html`)
  replaced with a redirect to the kept page; prev/next links rerouted to skip (403↔405, 305↔307); index.html
  grid divs for the dropped id removed (each appears once per topic: 404×2, 306×3) + total count 665→663.
  Numbering is non-contiguous so nothing renumbered. **#460/#462 are NOT dupes** — they only share the
  boilerplate instruction sentence; 460=textbook ex-006 (6 sin/cos circles), 462=ex-008 (3 tan/cot circles),
  different exercises — left separate (they still need their own figure audit, they're in §1 list).
  - #403 (square side 2 + 2 semicircles + 2 small circles, area problem, hash `1871e287cf79`, orig
    `?v=61c489` unchanged): existing render had WRONG small-circle radius `3-2√2`≈0.172 + too-light
    `gray!40` fill. Correct radius from tangency (circle tangent to BOTH semicircles + a square side,
    center on y=1): dist((r,1),(1,2))=1+r ⇒ (1-r)²+1=(1+r)² ⇒ **r=1/4**; measured orig confirms
    (~0.5u diameter). Fill **gray!70** (measured val 165; gray!40=204 was too light). Semis: top
    center(1,2) bulge down, bottom center(1,0) bulge up, meet at (1,1). Dim arrows "2" right+bottom,
    scale 1.4 (shape figure → match orig label size). LESSON: solve tangency exactly, don't trust a
    stored radius.
  - #396 (water-tank linear graph h vs t on graph paper, hash `48a6c7847c2c`, orig `?v=e7672d`
    unchanged): existing render had a COARSE light gray!40 step-0.5 grid + period decimals. Original is
    FINE BLACK graph-paper grid: square cells, h-step 0.1 (0→2.2), t-step 2.5min=0.25u (0→75). Comma
    decimals "0,2".."2,2" (Slovenian). Used `[x=1.1cm,y=2.75cm]` (ratio 2.5 → square cells since xstep
    0.25=ystep 0.1 visually) + `\draw[black,line width=0.4pt] grid[xstep=0.25,ystep=0.1]`. Line f:
    (0,0.5)-(7.5,2). t-labels 5..75 every5, h-labels every0.2, all `\tiny`. **GRID GOTCHA (Daniel
    flagged): at small render size thin grid lines ALIAS → "every odd line looks gray" + appear
    uneven. It's a RASTER-PREVIEW artifact (vector SVG is fine); DON'T thicken lines to hide it (he
    caught 0.8pt as too thick) — keep thin (0.4pt, matches orig) and RENDER THE MONTAGE AT HIGH RES
    (output_width≥1400 → LANCZOS downscale) so the preview shows the true uniform thin grid.**
  - #385 (cubic f w/ 3 zeros 0,2,5 + shaded areas S1/S2, hash `5901b686b2c4`, orig `?v=6a3a3a`
    unchanged): existing render FAKED the curve with TWO separate parabolas (peak too low, shapes
    wrong). Original is ONE smooth cubic f=k·x(x-2)(x-5); areas S1=1.3 on[0,2], S2=3.9 on[2,5] give
    k≈0.245-0.25 (used 0.25 → peak~1.0, trough~-2.05; ratio 3.0 matches). Equal-scaled (x-unit=y-unit
    ≈63px… here 78px). Fills via `\fill[..] plot[domain=a:b] (\x,{..}) -- cycle;` (cycle closes along
    axis): S1 `black!28`(val184) light, S2 `black!53`(val120) dark. y-axis -2.5..2.7, x-axis -1.5..5.9.
    Ticks x{-1,1,2,3,4,5} y{-2,-1,1,2}; labels only 0,1,2,5 & y=1. **scale=1.0** (text was too big vs
    figure at 0.6/0.85 → S1 label overflowed hump; bigger scale shrinks text). S1 label ended at
    (0.98,0.30) after many nudges; S2 (3.55,-0.85); f (5.2,2.4). LESSON: faked multi-piece curves →
    rebuild as the true single function; fill-to-axis via plot+cycle.
  - #384 (log graph f=a·log_{1/3}(x+b), hash `251db266dd97`, orig `?v=a4d58e` unchanged): existing render
    was MISSING the axis TICK MARKS (orig has them on both axes). Measured orig: equal-scaled, x-unit=
    y-unit≈63px. Ticks x∈{-1,1,2,3,4,5,6,7}, y∈{-2,-1,1,2,3,4}; only "0"@origin & "1" on each axis
    labeled. Curve f=-0.5·ln(x-2)/ln3 (b=-2 from asymptote x=2; a=1/2 from A(5,-½)). **Daniel: extend
    y-axis BOTH ways + dashed asymptote + curve** → y-axis -2.5..4.3, dashed x=2 from -2..3.75, curve
    rises to ~3.7 (domain start 2.0003). SMOOTH steep rise via SPLIT plot: dense [2.0003:2.3 samples=250]
    + [2.3:8 samples=120] (single uniform sampling makes the near-vertical part jagged). A dot `circle
    (2.5pt)` (orig dot is bold). LESSON: log/asymptote curves — split-domain sampling, dense near asymptote.
  - #374 (bare unit circle, hash `5088ad76ba2d`, orig `?v=ce25e3` unchanged): existing render had
    FABRICATED the whole ABCD trapezoid (B,C,diagonals,φ) — original is just a plain unit circle with
    axes + A(1,0) + D(0,-1) + tick "1"s + O (the trapezoid is what the student must construct). Rebuilt
    faithfully: thin `\draw` circle r1, axes to ±1.3 with x/y arrows, dots `circle (0.022)` at A & D,
    labels A[above right]/1[below right]@(1,0), D[below right]@(0,-1), 1[left]@(0,1.08), O[below left].
    **scale=3.2** (Daniel: original circle much bigger relative to text → bigger tikz scale shrinks text
    since glyphs are absolute-size; dots/coords scale, text doesn't). LESSON: "no-tikz/fabricated extra
    geometry" — when the original figure is bare, DON'T draw the answer; match exactly what's printed.
  - #346 (kite/deltoid ABCD, hash `78360c3ca578`, orig `?v=2b154d` unchanged): exact proportions
    A(-4,0) C(4,0) D(0,6.928) B(0,-11.314) (8/8 top, 12/12 bottom; half-diag |AC|/2=4 → D height
    √(8²-4²)=6.928, B depth √(12²-4²)=11.314). Outline `very thick`; diagonal A-C `thin` (Daniel:
    "a lot thinner"). Angle arcs via `\pic` radii: A/C 0.62cm, D 0.85cm, B 1.0cm. Labels α(-3.55,0)
    γ(3.55,0) δ(0,6.1) β(0,-10.25); "8 cm" over A-C at (0,0.12).
  - #334 (two circles, shaded ring, hash `bb7dc31d0369`, `?v=bb7dc3`): big (3,0)r3, inner (3,-1)r√2
    (=1.4142; old r2 was WRONG — made it tangent at bottom). Fill `black!50` (orig val127; was gray!50/light).
  - #325 (3-VIEW silos+building: side/front/top, hashes fig1 `bc12124faa96` fig2 `9423d3b28052`
    fig3 `a341c045d8ab`): originals were MIS-CROPPED (overlapping figs+text). RE-CROPPED all 3 from
    `pages/2024_Spomladanski_Pola2_VR_page-16.png` (found via cv2.matchTemplate of clean fig2, score 1.0;
    unit 39px) → saved over the `_fig{1,2,3}.png` paths (safe, not page paths). tikz: solid graph-grid
    `step=0.25 gray!22`+`step=1 gray!60`, fill `gray!30`(=val217). Side: building x[1,8]z[1,6] divider
    z4, silos x[1,4]z[6,7]. Front (yz, y LEFT → drew with NEGATIVE x, no xscale=-1): silos y[4,7]z[1,7],
    house y[1,4] walls z[1,4] peak (2.5,6); annotations \tiny; sleme arrow. Top (xy): circle (2.5,5.5)r1.5
    fill=white, rect x[1,8]y[1,4] divider y2.5, A(2.5,4) B(4,1).
  - #315 (cube ABCDEFGH + pyramid ABDE, hash `e4db338599f7`, `?v=e4db33`): measure 8 vertex dots →
    derive 3 edge dirs (horiz/vert/depth) by which pairs differ by a constant vector → assign labels so
    bottom ABCD & top EFGH are parallelograms. Orig DEPTH (2.65,3.33) much steeper than old (2.5,1.8).
    Shading `gray!N`=255−1.27N: ABE gray!45(198), EBD gray!50(192). Pyramid edges E-B/E-D/B-D `ultra
    thick` (orig emphasises them); cube edges `thick`; hidden edges to D `dashed`. scale 0.5.
  - #314 (triangle ABC, find x, hash `39a90776da71`, `?v=39a907`): measured orig vertices (drawn ~to
    scale w/ slight base tilt): C(0,0) A(4.99,-0.30) B(3.20,1.49). 110° arc @B (205→315°), 40° arc @A
    (135→176.6°, made bigger r0.9, label pulled toward A r0.62). dots `circle (0.03)` units. scale 1.1.
  - #289 (unit circle, points A-E+O, central angles, hash `550b40e9d90b`, `?v=550b40`): added `<->`
    arrows on α/β/γ arcs (α big sweep r0.33, β r0.22, γ r0.18); REMOVED extra chords B-C and C-E (orig
    only has B-E diameter, B-D, O-C radius — all `semithick` per Daniel); dots at all 8 (A,B,C,D,E,O +
    axis pts (0,1),(-1,0)); fixed dup "-1"/D labels (−1 left, D right). scale 2.2.
- **HOUGH LINE-DETECT (complex multi-line figures, #276):** `cv2.HoughLinesP` to get line angles+
  endpoints, dedupe by (angle, perp-dist), compute intersections for arc vertices. These figs are
  SCHEMATIC (drawn angle ≠ labelled value — reproduce as-drawn). Angle arcs: zoom each to see which
  way it opens (e.g. 92°/γ open DOWNWARD into the triangle, not up). β+130° share ONE radius = a
  continuous semicircle split by the transversal (but Daniel ended up wanting β arc bigger than 130°).
  - #276 (hash `baaf096fa684`, `?v=baaf09`): 5 lines (baseline, α-line 26.5°, 2 parallels 141.5°, perp
    50.3°). Lots of label/arc-size nudging — final values in new276.txt-style build. scale 0.55.
- **SILHOUETTE PIXEL-TRACE (Daniel "max effort", #256):** for a detailed shaded shape (CN Tower),
  segment the solid-fill gray (2D connected comp, tight range ~145–192 to exclude line halos), take
  per-row L/R edges, half-width=(R−L)/2 (centered, ignores overlapping black lines), Douglas–Peucker
  simplify (~35 pts), build a symmetric `\fill` path. VERIFY by overlaying the path on the original.
  - #256 (CN Tower, hash `df52783e64c1`, `?v=df5278`): geometry A(0,0)B(5.36,0)C(0,2.97)D(0,5) →
    ABD=43°,ABC=29° (old B@7.5 was wrong ~34°). Fill `black!35` (orig val165, gray!55 too light).
    Silhouette traced from pixels ×1.2 width (Daniel "a bit thicker"). A–D line `thin` (Daniel wanted
    it thinner, 2×), other lines `thick`. Dots `circle (0.05)` units.
  - #247 (parabola f=(x+1)(x-3), hash `fb127c14c45f`, `?v=fb127c`): grid darkened+dense, extent -2..5 ×
    -4..4, domain -1.92:3.92 (arms reach top ~y4.6, NOT y5 which was "way too much"), y-axis to 4.8,
    dots `circle (0.08)` units at (-1,0)(3,0)(0,-3)(1,-4), axis labels `[below left]`+nudge (fixed -1/0 collision).
- **DENSE-DASH RETROFIT (user, #247):** all coordinate grids use `dash pattern=on (2.835·scale)pt
  off (1.7·scale)pt` (~6 dashes/cell, matches originals), NOT plain `dashed`. Done+synced: #231,#245,
  #259,#307,#308,#323 (the last 4 were also DARKENED gray!55→black!88 to match their dark originals).
  #307==#308 identical figs. Rule in CLAUDE.md. #247 has it too (sync pending curve-height approval).
  - #245 (draw vectors u=a+b,v=…; grid + given a,b, hash `d8e179bb9f66`, `?v=d8e179`): vectors measured
    from orig — a=(3,3) (was (3,2)), b=(-2,1) (was (-2,1.5)). Grid darkened faint→`dashed,black!88,thin`,
    extent ±6 (orig grid -6..6 both, unit 50px). scale 0.5→0.65 to MATCH orig label size (orig cap/unit
    ≈0.36 → scale≈0.243/0.36; 17/units would've been too small — confirms: match orig even for grid figs).
    Unit "1" labels `[below left]`+nudge (x xshift6, y yshift6), "0" no shift. No dots (orig has none).
  - #231 (polygon ABCDE on grid, area, hash `684179a0792e`, `?v=684179`): GRID-ON-FILL technique — draw
    `\draw[step=1,dashed,black!90,thin]` grid FIRST, then `\fill[black!40,opacity=0.8]` (semi-transparent
    so the dashed mesh shows THROUGH the gray, matches orig; fill≈value174). Dots `circle (0.09)` units (5
    equal). Vertex labels: A `[above left]`, B `[above right]` (BOTH outside — orig had them outside, old
    tikz had them inside-swapped); C/D/E `[above right]/[above right]/[above left]`. Axis numbers `[below
    left]` per rule BUT Daniel wanted them nudged toward centered: x `xshift=6pt`, y `yshift=6pt`, 0 NO shift.
  - #224 (3 small circles in big R=3, hash `905f3143c33e`, `?v=905f31`): r=R(2√3−3)=1.3923, dist=1.6077,
    circles @90/210/330°. dotted center-triangle + dotted radii (orig lines ARE dotted, confirmed by zoom),
    solid radius to 210° rim. Dots UNIT-based: small centers `circle (0.045)`, BIG center `circle (0.078)`
    (orig big-center dot ~1.7× the small ones: 2.56% vs 1.48% of width). scale 0.85 kept.
- **THREE RULES added to CLAUDE.md (Daniel, #221):** (1) MATCH original arc ARROWHEADS (both→`<->`,
  one→`<-`/`->`, none→none) AND vertex/intersection DOTS (present→include, absent→omit) — ZOOM orig
  to check. (2) SCALE: match the original's label size for shape/dimension figures; `17/units` is only
  for coordinate-GRID figures. (3) **DOT-SIZE GOTCHA: `[scale=s]` scales `circle (Npt)` radius too,
  so pt-dots VANISH at small scales — size dots in UNITS: `circle (R)`, R≈0.0085×(units across)
  (≈1.7% width). ZOOM a vertex to confirm dots actually render.**
  - #221 (right trapezoid ABCD, hash `f4e614954970`, `?v=f4e614`): orig in `matura_figures/` (not figs).
    A(0,0)B(32,0)C(19.42,15)D(0,15); right-∠ marks @A,D; 50° arc @B `\pic[<->,radius0.62cm]{angle=C--B--A}`
    (130→180°, DOUBLE arrow — orig has both) + MANUAL `\node at (27.5,2.3) {$50^\circ$}` (label moved
    up-left then tiny bit down per Daniel); dots `circle (0.27)` UNITS (NOT pt — pt vanished at scale 0.18!).
    Old tikz: 12pt dots (invisible), `<-` single arrow, 30° arc. scale 0.18 (orig big labels).
  - #188 (clock 1:50, hash `fae48f299c57`, `?v=fae48f`): old tikz had only 12 ticks + wrong hands.
    Rebuilt: circle r2 `thick`; 60 minute ticks (\foreach 0..59, angle 90-6m, r2→1.88) + 12 hour
    ticks (thick, r2→1.74); numbers \large at r1.60; minute hand →10 (150°, len1.7=0.85R) LONGER,
    hour hand →35° (1:50, len1.28=0.64R) shorter, both `line width=4.5pt,round`. Measured circle
    ~0.016R, hands ~0.14R, numbers ~0.24R; scale 1.0 (17/units rule is for GRIDS, not clocks).
- **CLAUDE.md re-read (day 2):** axis number labels ALL use `[below left]` (not `[left]` for y);
  scale ≈ 17/units; on SVG change ALSO bump the per-fig `tikz_originals ?v=` in bodies+html.
  TIKZ_AUDIT.md (pre-2017 2011–16) has NO `?` rows left — that track is done; the 2021–22 group-1
  worklist (this file) is the active one.
  - #176 (curvilinear "Reuleaux" triangle, hash `78fd36020e6c`, tikz_originals `?v=78fd36`): O label
    `[above right]` (above x-axis, near circle bottom); `0` stays `[below left]`. A(-1,0) B(1,0) C(0,√3), arcs radius2
    centered A&B. INSCRIBED CIRCLE was WRONG in old tikz (r=2/√3); correct r=3/4, S=(0,0.75), tangent
    AB@O, arcs@T=(0.6,1.2) (|AS|=2-r⇒r=3/4). gray=triangle minus white circle; A–S–T thin line + bold
    OS,ST radii(=r); A,B labels ABOVE axis. **GRAY: use `black!35`(≈value165) NOT `gray!35` — tikz
    `gray!N` renders LIGHT (gray!35≈211). Measure orig gray & match: black!N ≈ value 255*(1-N/100).**
    **TICK DASHES were at x=±0.5 (UP) & y=0.5 (RIGHT), small ~0.07u — NOT at integer/labelled posns;
    Daniel made me revert ticks I wrongly put at ±1. MEASURE tick positions, don't assume integers.**
  - #170 (rational fn graph, hash `fdd6dea22f86`): old tikz function was WRONG (`3-6/(x+2)`); correct
    **f(x)=3-12/(x+2)** (V.asym x=-2, H.asym y=3, zero x=2, f(0)=-3 from the 2 marked pts). WIDE
    tick-axis (~±20, \foreach unit ticks), dashed asymptotes, \clip to frame, branches domain
    -21:-2.6 & -1.48:22. LABEL ALIGNMENT: x-labels incl `0` share a row, y-labels a right-aligned
    column — never offset the integers but leave `0` floating (Daniel flagged this hard).
  - #165 (right triangle c=10,b=3; hash `0e5ede73e213`): a=9.54,b=3, right angle at B. Replaced crude
    arrow markers with double-arrow ARCS via angle pic — β at A (interior B--A--C, big radius 1.5cm
    since 17° wedge, label inside near vertex), α at C (interior A--C--B, radius 0.7cm, label inside).
    APPLY ANGLE-ARC METHOD FROM THE START (measure orig radii, labels inside) — I forgot & Daniel raged.
- **!! CHECK FOR DUPLICATE FIGURES before rebuilding from scratch !!** Same matura figures get
  reused across years. #163 (2022, perimeter) = SAME figure as #104 (2021, area) — 3x3 grid,
  4 quarter-arcs (TL/TR convex @inner corners (1,2)/(2,2); BL/BR concave @outer corners (0,0)/(3,0)).
  Daniel had me reuse #104's approved block verbatim for #163 (hash `44f560975a39`, identical to
  #104 fig1) — keeps the two consistent. Before building, grep bodies.json for matching phrases
  (e.g. "krivočrtne stranice so loki", shared tikz patterns) to catch reuse.
  - #161 (Bent Pyramid, 3 tikz in one tabular; hashes fig1 `cd9821cc9212`, fig2 `39357569457c`,
    fig3 `a354b973b8a9`). fig1=3D isometric bent pyramid: MEASURE all 9 projected vertices from the
    original (base+break are PARALLELOGRAMS, view slightly rotated so the back vertical edge
    K–bK–T separates from the solid front F–bF–T and shows DASHED — a symmetric view hides it!).
    Shade 4 visible faces, solid visible edges, dashed hidden (L-K-R base back, K-bK vert, bL-bK-bR
    break back, bK-T). fig2=cross-section true proportions (base190/break47m/slopes54°&43°):
    43° arc at break pt KR (upper slope vs horiz ref line), 54° arc at BASE corner BR (base vs lower
    slope, INSIDE polygon — NOT at break), thin base ref line to bracket, "47" rotated 90° LEFT of
    bracket. fig3=top view square+inner sq(0.64 ratio)+diagonals, 190 w/ end-ticks, A–A spread out.
  - #148 (circular sector OAB, α=0.5rad; hash `8d91e749fafb`): geometry was fine; fixes were
    framing (kill empty axis margins → wide ~2:1; x to 1.42, y to 0.8), scale 4.5 (cap19/R353px
    so labels read small), bold sector boundary (OB line width 1.2pt, arc 1.7pt — Daniel had me
    thin from 1.6/2.2), small dots (0.6pt — Daniel: "too thick"), A label above-right, thin guide
    arc CONCENTRIC w/ A–B arc (both r=1, thin from B(0.5r) to 52° — Daniel: arcs must match at B),
    α near O. figs 2-4 svg = stale leftovers (only fig1 used).
  - #143 (4-fig angle problem, ONE latex w/ 4 tikz in a tabular; hashes fig1 `643ced933b41`,
    fig2 `a27fb1a8750b`, fig3 `f71bef23482a`, fig4 `24ce03c45041`). Originals had NO arcs;
    added double-arrow `<->` arcs everywhere + geometry rebuilds: fig1 parallel lines+2
    transversals (measured intersections via Hough; β/α≈62°, given 63°/55°; minor-arc point
    order matters, swap to draw interior; 55° label manual outside-then-Daniel moved top-right);
    fig2 regular octagon E@top (vertices 10°+45°k; line through edge E–F extended, NOT tangent
    @F; γ=interior 135° arc @F label inside-low, δ=45° arc @F label tight to F); fig3 circle
    diam AB (A162/B342/C114°, ε@C); fig4 circle diam AC (A226.5/C46.5/B314°, ω@S/44°@B/φ@C).
    Sync = sequential re.sub over the 4 tikz blocks in order, stamp 4 svgs. fig fig2/4 had
    several Daniel arc-nudge iterations.
  - #139 (frequency polygon, hash `0d16f0174d0f`): added DOTTED guides (each point→both
    axes), OPEN-circle markers (was filled `*`) at the 5 data pts only (none at (0,0)/(6,0)),
    non-uniform per-axis units x=0.95cm/y=0.32cm (~3:1 stretch; cap15/uy19.67). Y-axis has
    MINOR ticks at EVERY integer 1-18 ONE-SIDED pointing right (len 0.12 x-u); labels only
    1,6,9,12,15,18 (non-uniform). Site has no arrows.meta. fig2 = LaTeX tabular (untouched).
  - #122 (vector diagram, hash `4fe762f46127`): extended ticks to full range
    x −4..4 / y −3..3 (was positive-only; #1 fix), labels only at 0,1,4 & 1,2,3,
    scale 0.95 (cap20/unit78). `b` label = `[right] at (0,2.4)` (right of shaft
    near top, NOT midway-left), `a` label `[below] at (3.3,1.66)` just under line.
    Vectors `line width=1.5pt` for bigger latex arrowheads (site has no arrows.meta,
    so use line width — not `Latex[length=..]`). a=(4,2), b=(0,3), dashes (4,0)-(4,2)+(0,2)-(4,2).
- **ANGLE-ARC SIZING is now a STANDING METHOD** — see [[matura-coordinate-systems]] +
  CLAUDE.md "Angle arcs": measure original arc radii (circle overlays) AND keep labels
  contained inside (R≥r/(e·sin(θ/2))). Use on every angle figure.
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
- [x] 78 — f(x)=1+1/x, shaded region. Old SHADING was wrong (filled down to x-axis
  over x∈[1,3]). Correct region (from original): bounded by y-axis, y=4/3(=f(3))
  below, and y=2(=f(1)) for x∈[0,1] then the curve for x∈[1,3] above. Area = **ln3**
  (verified: 2/3 + ∫_1^3(1/x-1/3)dx). Fill path (0,4/3)-(0,2)-(1,2)-plot(1..3)-cycle.
  Reference lines y=4/3(to x=3), y=2(to x=1), verticals x=1(to 2), x=3(to 4/3).
  scale 1.0→**1.25** (cap/unit 0.19). Ticks were MISSING: x at 1,2,3 (up), y at
  1,2,3,4 (right), len 0.08. "y" label at (-0.22,3.28). hash 10536b78f905. LESSON:
  for a shaded-area problem, work out which region gives a clean exact answer
  (here ln3) to disambiguate the boundaries.
- [x] 87 — triangle ABC, α=75°(A), β=52.5°(B), find AC. Old triangle had WRONG angles
  (A≈64.5°). Original is drawn TO SCALE (measured A=74.7,B=52.6,C=52.7; isosceles
  AB=AC). Rebuilt: A=(0,0), B=(5,0), C=(0.2588·5, 0.9659·5)=(1.294,4.83) [from
  α=75°, AB=AC]. Angle arcs via pic: Daniel wants `<->` (BOTH ends arrowed), bigger
  (angle radius 9mm), labels CLOSE to vertex (angle eccentricity=0.6, inside). C
  label [above left]. scale 0.85 (label/AB ratio). hash 719d262a1b5e. LESSON: trig
  triangles are often drawn to scale — construct from the actual angles (place AB on
  x-axis, apex from the two base angles), don't keep an eyeballed shape.
- [x] 99 — circle k, tangent p at T, chord TB, radius SB; angles β(at T, tangent-chord)
  & 40°(∠TBS). Old fig: T,B were 120° apart → ∠TBS=30°, but label says 40° (inconsistent);
  also MISSING the angle arcs. Fixed: ∠TBS=40° ⇒ T,B 100° apart ⇒ T=120°, B=20°
  (B radius dir measured ~19°). β=50°. Added pic arcs `<->` (both arrowed) for β
  (angle=B--T--P, P=tangent dir +30°) and 40° (angle=T--B--S). Daniel: labels CLOSE
  to vertices (β at (T)+(4:0.6), 40° at (B)+(180:0.65)), 40°-arc bigger (10mm), line p
  extended both ways (30:2.1)/(210:2.0). hash 93ec68f6090f. NOTE: bodies '99' had
  tikz_count=0 (wrong) but the figure IS in the latex/svg. LESSON: circle-geometry
  figures must be self-consistent — derive point angles from the labeled angle
  (isosceles radius triangle), don't trust the inherited positions.
- [x] 104 — area figure: 3×3 grid (cell=a), shaded region with 4 quarter-arcs (r=a).
  Verified shading (sample cell centres + corner-cell inner/outer points) and arc
  centres (dark-fraction along candidates = 1.0). TOP corners CONVEX (gray quarter-disk
  centred at INNER corner TL@(1,2),TR@(2,2)); BOTTOM corners CONCAVE (white quarter-disk
  at OUTER corner BL@(0,0),BR@(3,0)). Fill = one path: (0,2) arc→(1,3) -(2,3)- arc→(3,2)
  -(3,1)- arc→(2,0) -(1,0)- arc→cycle. Thin grid+square over fill; thick arcs = curved
  sides; radius arrows centre→arc with "a" (nudged up); side "a" top & right.
  hash 44f560975a39. LESSON: for arc-area figures MEASURE which side of each arc is
  shaded and the arc centre — convex vs concave corners can differ within one figure.
- [x] 107 — ellipse a=5,b=2 with vertices A(-5,0),B(5,0),C(0,-2),D(0,2). Geometry was
  already right. Fixes: REMOVED the vertex dots (original has none), fixed the
  B(5,0)/"x" collision (put "x" below-right of the axis, B label above the axis to its
  right), placed vertex labels at measured centres (A≈(-6,0.42), B≈(5.8,0.42),
  D≈(0.9,2.5), C≈(1.2,-2.45)); Daniel then nudged A right / B left. scale 0.85.
  hash d3c46a393858. LESSON: check for stray vertex DOTS the original lacks, and
  resolve label/axis-arrow collisions by separating them vertically (label above axis,
  axis-name below).
- [x] 115 — quadrilateral ABCD + diagonal AC, angles 30°(DCA),74°(ADC),50°(CAB),
  φ(DAC),β(ABC), given AC=AB. Old shape WRONG (A≈33° not 50°) + 30° arc on wrong
  sub-angle (BCD). Rebuilt to scale: A=(0,0),B=(6,0), C=(0.6428·6,0.7660·6)=(3.857,
  4.596) [from CAB=50°,AC=AB], D from triangle ACD (AD=AC·sin30/sin74, dir 126°)=
  (-1.834,2.525). φ=76°, β=65°. Pic `angle` order must give the SHORT interior arc
  (swap outer pts if reflex). ARC SIZING is the big lesson → new STANDING METHOD
  (measure original arc radii via circle overlays + containment formula; labels inside
  at ecc~0.7). Final radii 30°→1.4u,φ/50°→1.2u,β→1.1u,74°→0.95u; all `<->`.
  hash 259b356dd766.

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
