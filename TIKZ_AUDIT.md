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
| 818 | 2016_Spomladanski_Pola1_OR         | ◐◒    | empty coord; axes extended to ±5, y=4 tick added; original crop re-cropped (was wrong bbox); x/y "1" labels aligned to "0" |
| 820 | 2016_Spomladanski_Pola1_OR         | ◐◒    | two circles + equilateral △; A/B labels to line level; K1/K2 moved up-left/up-right; crop re-cropped to figure |
| 839 | 2016_Jesenski_Pola1_OR             | ◐◒    | complex plane z,w. **w corrected -2+2i → -3+2i** (matched -3 tick); added z vertical dashed to axis; full integer ticks; crop re-cropped (was whole-problem). NOTE: table row was wrongly "836" |
| 847 | 2016_Jesenski_Pola1_OR             | ◐◒    | empty coord (log graph); axes ±4/5 → symmetric ±3.5, ticks ±1,2,3; labels consistent [below left] with 0; crop re-cropped to figure |
| 843 | 2016_Jesenski_Pola1_OR             | ◐◒    | four conics (2 circles + 2 ellipses). **C corrected (1,-0.7) → (2/√5,-2/√5)** = ellipse∩ellipse; A/C labels → above right; axis number labels nudged off curves to match original (y 1/2 lowered into clear zones, negatives on left); 0 → below left; crop re-cropped |
| 854 | —                                  | n/a    | does not exist (stale table entry)    |
| 862 | 2016_Jesenski_Pola2_VR             | n/a    | exists but tikz_count=0, no figure (was a Limita topic reassignment, not a figure) |

**2016_Jesenski_Pola2_VR has NO tikz figures.** 2016 figure audit is complete (818, 820, 839, 843, 847).

### Pre-2017 Pola2_VR figures the original table MISSED (genuinely unaudited)

The table above tracked mostly Pola1_OR. These second-paper (Pola2_VR) figures
exist with tikz_count>=1 and were never listed:

| n   | paper                              | status | notes |
|-----|-----------------------------------|--------|-------|
| 538 | 2012_Spomladanski_Pola2_VR        | ◐◒    | **authored from scratch** (latex had no tikzpicture, only orphaned placeholder SVG). fig1 = empty coord ±6.5, ticks ±1..6, scale 0.35 (~146pt); inserted block into latex after item a); crop re-cropped. fig2 (part d) ADDED: cubic f1(x)=(x+a)^3-1, inflection (-a,-1) with dashed construction, labels -a/0/1/a & 1/-1, curve label; tikz_count now 2 |
| 578 | 2012_Jesenski_Pola2_VR            | ◐◒    | **authored from scratch** (no tikzpicture in latex). empty coord for f=2x/(x²+1): wide x ±1..6 (axis -7..7.2 arrow), y ±1,2,3 (axis ±4 arrow); inserted after item a); crop re-cropped |
| 644 | 2013_Jesenski_Pola2_VR            | ?      | not audited |
| 672 | 2014_Spomladanski_Pola2_VR        | ?      | not audited |
| 683 | 2014_Spomladanski_Pola2_VR        | ?      | not audited |
| 710 | 2014_Jesenski_Pola2_VR            | ?      | not audited |
| 750 | 2015_Spomladanski_Pola2_VR        | ?      | not audited |
| 785 | 2015_Jesenski_Pola2_VR            | ?      | not audited |
| 791 | 2015_Jesenski_Pola2_VR            | ?      | not audited |
| 794 | 2015_Jesenski_Pola2_VR            | ?      | not audited |

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
