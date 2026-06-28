# TikZ audit — cumulative status

Tracks which TikZ figures have been verified against the original PDF page
and which still need attention. Each session should read this file first,
then audit a batch (3-4 figures), update the table, and commit.

## Scope

Every problem with `tikz_count >= 1` and a `tikz_originals` entry across
2011–2025. The pre-2017 corpus needs the deepest attention because those
figures were generated heuristically.

Coverage:
- 2017–2025: previously verified (see TIKZ_2017PLUS_STATE.md in outputs/)
- Pre-2017: ongoing in this file

## Per-figure status — pre-2017

Status legend: ✓ = verified faithful, ◐ = TikZ fixed this session,
◒ = original crop fixed this session, ⚠ = needs work, ? = not audited.

### 2011

| n   | paper                              | status | notes                                 |
|-----|-----------------------------------|--------|---------------------------------------|
| 481 | 2011_Spomladanski_Pola1_OR        | ◐      | curve clipped + left domain extended  |
| 483 | 2011_Spomladanski_Pola1_OR        | ◐      | 120° label repositioned               |
| 487 | 2011_Spomladanski_Pola1_OR        | ◐      | fabricated Q3 branch removed; axes tightened |
| 488 | 2011_Spomladanski_Pola1_OR        | ✓      | (earlier session)                     |
| 492 | 2011_Spomladanski_Pola2_VR        | ✓      |                                       |
| 498 | 2011_Jesenski_Pola1_OR            | ✓      | Venn diagram, matches                 |
| 505 | 2011                              | ✓      | (earlier session)                     |
| 506 | 2011                              | ✓      | (earlier session)                     |
| 515 | 2011                              | ✓      | (earlier session)                     |

### 2012

| n   | paper                              | status | notes                                 |
|-----|-----------------------------------|--------|---------------------------------------|
| 525 | 2012_Spomladanski_Pola1_OR        | ◐      | rebuilt coord system; table TikZ kept; A point restored |
| 528 | 2012_Spomladanski_Pola1_OR        | ✓      | five panels of y=f(x), matches        |
| 530 | 2012_Spomladanski_Pola1_OR        | ✓      | square w/ arc, matches                |
| 532 | 2012_Spomladanski_Pola1_OR        | ✓      | vectors a, b                          |
| 537 | 2012_Spomladanski_Pola1_OR        | ◐◒    | TikZ clipped; original crop replaced (was empty)  |
| 556 | 2012                              | ✓      |                                       |
| 566 | 2012                              | ✓      |                                       |

### 2013

| n   | paper                              | status | notes                                 |
|-----|-----------------------------------|--------|---------------------------------------|
| 599 | 2013_Spomladanski_Pola1_OR        | ✓      | empty coord                           |
| 622 | 2013_Jesenski_Pola1_OR            | ✓      | complex plane w/ i, 1                 |
| 623 | 2013_Jesenski_Pola1_OR            | ◐      | β repositioned multiple times         |
| 624 | 2013_Jesenski_Pola1_OR            | ◐      | parabola + line; scaled up            |
| 625 | 2013_Jesenski_Pola1_OR            | ◐      | empty grid; cell count corrected to 11×10 |
| 626 | 2013_Jesenski_Pola1_OR            | ◒      | original crop replaced (was cut off)  |
| 630 | 2013_Jesenski_Pola1_OR            | ◐      | sine + shaded; y-ticks added          |

### 2014

| n   | paper                              | status | notes                                 |
|-----|-----------------------------------|--------|---------------------------------------|
| 660 | 2014_Spomladanski_Pola1_OR        | ◐      | rational function; a=8, b=-4 confirmed; asymptotes x=-1, x=4, y=2 |
| 688 | 2014_Jesenski_Pola1_OR            | ◐      | empty coord; x-axis extended to ±7.5  |
| 692 | 2014_Jesenski_Pola1_VR            | ◐      | piecewise linear; (-2,0)→(0,2)→(1,2)→(2,0); cases display mode |

### 2015

| n   | paper                              | status | notes                                 |
|-----|-----------------------------------|--------|---------------------------------------|
| 727 | 2015_Spomladanski_Pola1_OR        | ◐      | sin coord; π at 3rd tick (π/3 spacing)|
| 731 | 2015_Spomladanski_Pola1_OR        | ◐      | lake blob; A and B now on boundary    |
| 761 | 2015_Jesenski_Pola1_OR            | ◐      | two number lines; original crop fixed |
| 763 | 2015_Jesenski_Pola1_OR            | ◐      | three triangles; fabricated text removed; 2.2 rebuilt |
| 773 | 2015                              | ✓      |                                       |
| 779 | 2015_Jesenski_Pola1_OR            | ◐      | two shaded circular segments (was teardrop) |

### 2016

| n   | paper                              | status | notes                                 |
|-----|-----------------------------------|--------|---------------------------------------|
| 800 | 2016_Spomladanski_Pola1_OR        | ◐      | line through A, B; dashed projections |
| 808 | 2016_Spomladanski_Pola1_OR        | ◐      | cubic; itemize → underlined lines     |
| 818 | 2016_Spomladanski_Pola1_OR         | ◐◒    | empty coord; axes extended to ±5, y=4 tick added; original crop re-cropped (was wrong bbox); x/y "1" labels aligned to "0" **[rescaled 0.45→0.55, cap/unit 0.44; hash 423935bc0d73]** |
| 820 | 2016_Spomladanski_Pola1_OR         | ◐◒    | two circles + equilateral △; A/B labels to line level; K1/K2 moved up-left/up-right; crop re-cropped to figure **[rescaled 1.0→0.7, cap/unit 0.35; hash 8b6d925c7886]** |
| 839 | 2016_Jesenski_Pola1_OR             | ◐◒    | complex plane z,w. **w corrected -2+2i → -3+2i** (matched -3 tick); added z vertical dashed to axis; full integer ticks; crop re-cropped (was whole-problem). NOTE: table row was wrongly "836" **[rescaled 0.7→1.0, cap/unit 0.24; hash c901298a8a2a]** |
| 847 | 2016_Jesenski_Pola1_OR             | ◐◒    | empty coord (log graph); axes ±4/5 → symmetric ±3.5, ticks ±1,2,3; labels consistent [below left] with 0; crop re-cropped to figure **[rescaled 0.6→1.0, cap/unit 0.24; hash a289cdd210af]** |
| 843 | 2016_Jesenski_Pola1_OR             | ◐◒    | four conics (2 circles + 2 ellipses). **C corrected (1,-0.7) → (2/√5,-2/√5)** = ellipse∩ellipse; A/C labels → above right; axis number labels nudged off curves to match original (y 1/2 lowered into clear zones, negatives on left); 0 → below left; crop re-cropped **[rescaled 0.9→1.1, cap/unit 0.22; hash 0b4dc29d3ae0]** |
| 854 | —                                  | n/a    | does not exist (stale table entry)    |
| 862 | 2016_Jesenski_Pola2_VR             | n/a    | exists but tikz_count=0, no figure (was a Limita topic reassignment, not a figure) |

**2016_Jesenski_Pola2_VR Pola1_OR figures: none.** 2016 Pola1 figure audit complete (818, 820, 839, 843, 847). (NOTE: #866 in 2016_Jesenski_Pola2_VR had a text-only "draw the graph" empty-coord that was authored later — see the MISSED Pola2_VR table below.)

### Pre-2017 Pola2_VR figures the original table MISSED (genuinely unaudited)

The table above tracked mostly Pola1_OR. These second-paper (Pola2_VR) figures
exist with tikz_count>=1 and were never listed:

| n   | paper                              | status | notes |
|-----|-----------------------------------|--------|-------|
| 538 | 2012_Spomladanski_Pola2_VR        | ◐◒    | **authored from scratch** (latex had no tikzpicture, only orphaned placeholder SVG). fig1 = empty coord ±6.5, ticks ±1..6, scale 0.35 (~146pt); inserted block into latex after item a); crop re-cropped. fig2 (part d) ADDED: cubic f1(x)=(x+a)^3-1, inflection (-a,-1) with dashed construction, labels -a/0/1/a & 1/-1, curve label; tikz_count now 2 **[rescaled both figs →1.0, cap/unit 0.24; hashes c9a87bc260bc / 99668ae60fb0]** |
| 578 | 2012_Jesenski_Pola2_VR            | ◐◒    | **authored from scratch** (no tikzpicture in latex). empty coord for f=2x/(x²+1): wide x ±1..6 (axis -7..7.2 arrow), y ±1,2,3 (axis ±4 arrow); inserted after item a); crop re-cropped |
| 644 | 2013_Jesenski_Pola2_VR            | ◐◒    | **authored from scratch**: exponential f=2·3^(1-x) through A(0,6),B(1,2), decaying to x-axis; very thick curve; x ticks -3..8, y 1..7; scale 0.7 to match original's larger labels; crop re-cropped |
| 672 | 2014_Spomladanski_Pola2_VR        | ◐◒    | **authored**: empty grid for quadratic, ALL integers labeled (x -6..6, y -4..4); scale 0.8 to match original's larger labels; crop re-cropped |
| 683 | 2014_Spomladanski_Pola2_VR        | ◐◒    | **authored**: blank complex plane (Re/Im axes, ticks −4..4), labels 0 (below-left), 1 (below), i (left); tikzpicture inserted into latex (was PNG-only); scale 0.95 (matches original label size); hash a15e3a44a563 |
| 710 | 2014_Jesenski_Pola2_VR            | ◐◒    | **authored** (latex was PNG-only): empty coord for parabola, x/y ticks −8..8, arrows on +x/+y, labels 0/1(x)/1(y)/x/y; inserted block after item a); scale 0.43 (matches original's large labels / dense cells); crop re-cropped (top was cut off, "y" label missing); hash d62467940e12 |
| 750 | 2015_Spomladanski_Pola2_VR        | ◐◒    | **authored 2 figs** (latex was PNG-only, tikz_count 1→2): fig1 (part a) empty coord x −6..6, y −3..3, arrows +x/+y, labels 0/1/1/x/y; fig2 (part d) ADDED = drawn curve y=f(\|x\|)=(\|x\|−1)/(\|x\|+1), cusp (0,−1), zeros ±1, asymptote y=1; scale 0.4 (cap/unit 0.62); both originals re-cropped, fig2 original added; hashes 212bb41b05b4 / bbb68a662f25 |
| 785 | 2015_Jesenski_Pola2_VR            | ◐◒    | **authored** (latex was PNG-only, tikz_originals was empty/absent — original PNG created from page): graph y=2x·sin(3x), small left hump touching origin, main hump 0→π/3 hatched (north east lines), small dip below axis past π/3; labels 0/π/3/x/y; xscale 2.0 yscale 1.55 (matches stretch + label size); hash a2fd811d0195 (π/3 label nudged left) |
| 791 | 2015_Jesenski_Pola2_VR            | ◐◒    | **authored** (latex was PNG-only): oblique cube ABCDEFGH, square front face ABFE, depth (0.47,0.575)·s up-right; hidden vertex D → dashed edges DA/DC/DH, rest solid; vertex labels + edge label a; NO P/S (not in original); scale 1.8 (enlarged per request, labels relatively smaller); original re-cropped to just the cube; hash 30047613863b |
| 794 | 2015_Jesenski_Pola2_VR            | ◐◒    | **authored** (latex was PNG-only; original crop was wrong region — showed text): empty coord for plotting A/B/C/D, x ticks −1..7, y ticks −1..8 (tall), arrows +x/+y, labels 0/1(x)/1(y); scale 0.4 (cap/unit 0.6); inserted after item a); crop fixed to the coordinate system; hash 9bd2821d5ac5. FIXED transcription error: stored latex said B(5,7); page clearly shows B(5,1) (same "1" glyph as A(1,1)) — corrected to $B(5,1)$ in bodies.json + html |
| 832 | 2016_Spomladanski_Pola2_VR        | ◐      | **authored** (latex was text-only, tikz_count 0→1): triangle $ABC$ with vectors $\vec a=\vec{BC}$/$\vec b=\vec{CA}$/$\vec c=\vec{AB}$ as arrows + doubled outer triangle $A'B'C'$ (exact construction $B'=2B-A$, $C'=2C-B$, $A'=2A-C$); inserted tikzpicture after intro paragraph (before enumerate); $A$ label nudged up-and-right to match original; original crop tightened to figure-only (top/bottom text stripped); hash 333591ec91db |
| 866 | 2016_Jesenski_Pola2_VR            | ◐      | **authored** (latex was text-only, tikz_count 0→1): empty coordinate system for part b) "Narišite graf funkcije f" (f(x)=\|x+2\|+\|1−x\|). Axes x −5→+5 (arrow right), y −5→+7 (arrow top, taller for the f-range); ticks x −4..4 / y −4..6; only 0/1/1 labeled; #269 matura style (thin 0.5pt axes, ±0.1 straddle ticks, 0 below-left, x-num [bl,xshift6,yshift-2], y-num [bl,yshift6]); scale 0.58 (cap/unit ≈0.42 matches original — original ticks are one-sided x-up/y-right but normalized to the #269 straddle standard); inserted via \begin{center} after item b); hash 2f3bd702e228 |

## Non-empty figures audit (recent years — worklist §2)

Verifying existing non-empty figures (curves/shapes/vectors) against originals,
one batch at a time, montage each. List: 16, 26, 112, 120, 129, 134, 140, 145,
168, 193, 239, 259, 266, 272, 307, 308, 321, 323, 328, 330, 343, 344, 351, 360,
363, 367, 383, 393, 398, 400, 412, 430, 446, 452, 458, 459 (already-done elsewhere:
314, 481, 487, 498, 530, 537, 538, 624, 779).

| n   | paper                              | status | notes                                 |
|-----|-----------------------------------|--------|---------------------------------------|
| 16  | 2025_Spomladanski_Pola1_VR        | ◐      | piecewise (semicircle 0→4 dip −2 + triangle peak (5,3)) faithful; **scale 0.55→0.95** (labels were too large; original cap/unit 0.256). hash 296ba923db1d |
| 26  | 2025_Spomladanski_Pola2_OR        | ◐      | vectors a⃗ (horiz) & b⃗ at 120°, 4 units w/ tick marks — faithful; **scale 0.55→0.95** (original cap/unit 0.253). hash 3bb77ec5a103 |
| 112 | 2021_Spomladanski_Pola1_VR        | ✓      | empty complex plane (i dot, 0, 1) for the student to draw sets A & B — faithful, no change |
| 120 | 2021_Spomladanski_Pola2_OR        | ◐      | cubic p(x)=−3x(x−0.6)(x−1.4); **plot domain extended** −0.3:1.7 → −0.7:1.9 + frame \clip so the curve fills the frame top-left→bottom-right like the original. hash c3455bdc0f43 |
| 129 | 2022_Jesenski_Pola1_OR            | ◐      | line y=x+2 through (−2,0),(0,2); **scale 0.6→0.45** (orig has large labels, cap/unit 0.51 — scaled DOWN to enlarge labels to match) + **added integer tick dashes −3..3 on both axes** (orig has them, was missing). hash 5ceca1b32309 |
| 134 | 2022_Jesenski_Pola1_OR            | ◐      | complex plane (draw 2z, z̄); **scale 0.5→0.95** (labels too large) + **i marker dot→tick dash** (per Daniel: i should be a normal dash like the 1-tick, not a filled dot). hash 2b31254bc46f |
| 140 | 2022_Jesenski_Pola1_OR            | ◐      | hyperbola (vertices ±4, F₁=−√20); **F₁ & B labels → above-left** of their dots (matching orig); **dots enlarged** 2pt→circle(0.14) units; **branch domain extended** 4:7→4:8 / −7:−4→−8:−4 so branches fill the frame. hash dec615125a00 |
| 145 | 2022_Jesenski_Pola1_VR            | ◐      | complex plane (draw z₁,z₂,z₃); **scale 1.0→1.85** (orig has small labels, cap/unit 0.13) + **i marker dot→tick dash**. hash 80e0c5221998 |
| 168 | 2022_Spomladanski_Pola1_OR        | ◐      | complex plane (draw z, z̄); **scale 0.5→0.95** + **i marker dot→tick dash** (the y=1 foreach tick serves as the dash). hash a4e88538851e |
| 193 | 2022_Spomladanski_Pola2_VR        | ◐      | graph h(x)=(2−eˣ)²; **plot domain −2.5:1.5 → −3:1.45** so the left plateau (→4) reaches the frame edge like the original. hash 3ab7edb4f6a3 |
| 239 | 2023_Spomladanski_Pola1_OR        | ◐      | parabola f=6−x² + rectangle OATD; **aspect ratio fixed** uniform scale 0.7 → xscale 1.16/yscale 0.7 (orig x:y≈1.66, parabola was too narrow); **T label → above-right** of corner. hash 0013259ce364 |
| 259 | 2024_Jesenski_Pola1_OR            | ◐      | reflection grid, T(−1,2); **scale 0.55→0.7** (labels too large) + dash-pattern rescaled (on 1.98 off 1.19) to keep grid density. hash 1fd885d45a51 |
| 266 | 2024_Jesenski_Pola1_OR            | ◐      | rational fn (3x+5)(x−3)/((x+2)(x−2)) with A,B,C; **axes extended +x/+y/−x, reduced −y** per Daniel (clip −6.5..6.5 × −2.7..6.5), branch domains extended to fill; **scale→0.46** (orig has large labels); B/−2 labels separated; A nudged left. hash 7fb4853b8cd8 |
| 272 | 2024_Jesenski_Pola1_OR            | ◐      | parabolic arch + inscribed rectangle; **removed "y" axis arrow/label** (orig has plain vertical line + "4" at peak); "4"→above-left; **rectangle outline thick→very thin**. hash 25b4069738d2 |
| 307 | 2024_Spomladanski_Pola1_VR        | ◐      | empty Im/Re grid (draw set A); **grid → light (black!40) + very thin + denser dashes (on 1.42 off 0.85)**; **7 boxes/side (grid ±7)**; **scale 0.5→1.0**; i kept dot-free (orig has a small dot — per Daniel #134/#145 no-dot preference). hash 12f386a2001c |
| 308 | 2024_Spomladanski_Pola1_VR        | ◐      | empty Im/Re grid (draw set B); same treatment as #307 (light thin dense grid, 7 boxes/side, scale 1.0, no i-dot). hash 12f386a2001c |
| 321 | 2024_Spomladanski_Pola2_OR        | ◐      | sinusoid f=2sin(x)+3 with (−π/2,1) min & (π/2,5) max; dots enlarged (circle 0.1); (−π/2,1) label centered-above the min; point labels font=\small; scale 0.45→0.6. hash acd1fe01937e |
| 323 | 2024_Spomladanski_Pola2_OR        | ◐      | geometric-sequence points (ratio −1.5) on dashed grid; **grid → rectangles** (xstep 1, ystep 0.5) so half-y-step lines appear; scale 0.5→0.7. hash febe0d603125 |
| 328 | 2017_Jesenski_Pola1_OR            | ◐      | bell curve 2e^(−x²/2), pts (±1,1.213); **horizontal dashed line symmetric ±1.4**; verticals extend up; single "0" bottom-left of origin (orig had two — not copied), aligned; "2" nudged above the curve; scale 0.7→0.9. (was stale SVG — re-rendered.) hash bbcdbec5504b |
| 330 | 2017_Jesenski_Pola1_OR            | ◐      | **2 figs** (draw sets A & B), identical empty complex planes; integer tick dashes 4/side on both axes; i on its tick (no dot); scale 0.55→0.8. hash 341b7bb89030 (both figs) |
| 343 | 2017_Spomladanski_Pola1_OR        | ◐      | parallelogram ABCD + lines p,q,r over x-axis. **p,q corrected to slope 1 along slant edges A→D / B→C** (were slope ~1.8, diverged); fill gray!40→gray!35; **B,C → `[above right,xshift=6pt]` so they sit at A's & D's heights, shifted right**; **added integer tick dashes x −4..4 / y −2..3** (orig has them; was only 1 each); **x-axis extended −1→−4.5 and line r extended −1→−4.1** to match original's near-full-width axes (orig r −4.07..4.05). bodies+html+svg synced. hash 8be0c39741b1 |
| 344 | 2017_Spomladanski_Pola1_OR        | ◐      | 3-circle Venn (sets A,B,C; elements 1–7). **circle centers re-measured from original** (Hough): A(0,0) B(2.33,1.02) C(2.12,−1.43) r2 — were lopsided (1.7,0.7)/(1.4,−1.5), overlap too heavy; **all 7 digit positions + A/B/C labels re-placed from measured centroids** (1,2 stacked in A-only; 5 A∩B; 6 B-only; 4 triple; 3 A∩C; 7 C-only). scale 0.7. hash 1bbf56d5e6fe |
| 351 | 2017_Spomladanski_Pola1_OR        | ◐      | cubic p(x)=−0.5(x+2)(x−1)² (roots −2, double 1; p(0)=−1). **full rebuild to match orig (unit 59px)**: frame ±4.3 both axes (was tiny −3.5..2.5 / ±3); **added integer tick dashes x{−4,−3,−1,2,3,4} y{−4..−2,1..4}** (orig has them, were missing); **domain −2.7:1.6 → −2.66:2.4** so right branch descends to lower-right like orig; **added "p" curve label** top-left; dots at (−2,0)(1,0)(0,−1) sized 0.09u; scale 0.65→0.8 (cap/unit 0.29). y=1 label kept LEFT per convention (orig has it right). hash cf703aebe1ca |

## Audit pipeline

For each problem in the next batch (4 at a time is the sweet spot):

1. Find the source: `bodies['<n>']` → `latex` (for TikZ) and `tikz_originals[0]`
   (for figure crop reference).
2. Render the current SVG to PNG with white background (cairosvg →
   `Image.alpha_composite(white_bg, rgba)`).
3. Read the figure-only crop PNG at `webpage/matura_figs/...`.
4. If the crop looks blank or wrong, the bbox is wrong — re-crop from
   the problem-level page at `webpage/matura_refined/<paper>/prob_NN.png`.
5. Build a 2-column montage at 480×360 cells. **Order: newly-compiled TikZ
   LEFT, original RIGHT** (user preference — always this orientation).
6. **Show preview to user before claiming done.** This is critical — visual
   confirmation in the same turn avoids the deploy-and-pray cycle.
7. Update the table above with the new status.

## Update protocol

After fixing a figure:

1. Re-render the SVG and verify the source-hash matches.
2. Update `tikz_originals[k]?v=...` cache buster if you replaced the
   matura_figs PNG.
3. Mirror the latex change into `problems/NNN.html`.
4. Bump global `v=601XXX` and `mat-tikz-XXX` (see CLAUDE.md).
5. Update this file's table row.
6. Commit with a descriptive message.

## When to STOP iterating

After 3 rounds of feedback on the same figure, ask the user a structured
question (via AskUserQuestion if available) to nail down what's wrong rather
than continuing to guess. Don't burn 6 rounds on one triangle's rotation.
