# TikZ figure worklist (gradual)

Generated from the full-corpus figure audit (see `_figure_gallery.html`).
Work through these gradually. A problem may appear in several sections — it
needs each kind of work. Follow CLAUDE.md rules (3-place sync, cache bumps,
montage **rendered → present_files → then sync**, never fabricate, one problem
per turn unless told otherwise).

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

## 1. TikZ needs fixing (54)
Content/accuracy problems with the existing render.

5, 11, 15, 20, 38, 53, 58, 64, 68, 71, 77, 78, 87, 99, 104
107, 115, 139, 143, 148, 161, 163, 165, 170, 176, 188, 221, 224, 231, 245
247, 256, 276, 289, 314, 315, 325, 334, 346, 374, 384, 385, 396, 403, 404
413, 421, 460, 461, 462, 472, 525, 528, 763

## 2. Rescale / resize + axis dashes + empty-coord preset (86)
Adjust overall size (labels relatively smaller), add axis dashes where needed;
roll empty coordinate systems into the shared preset.

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
