> # ⚠️ RULE #1 — GREATEST IMPORTANCE: ALWAYS SHOW SIDE-BY-SIDE
> For **every** figure change — no matter how small — render the NEW figure and
> present a side-by-side montage (NEW left, ORIGINAL right) with `present_files`
> **before** asking for approval or syncing. ALWAYS. No exceptions.

# Claude project memory — mat-naloge

A Slovenian Matura math problem website, deployed via GitHub Pages at
https://danielvitas.github.io/mat-naloge/. This file is the first thing Claude
should read on every session. It captures the conventions that have been
painful to learn and re-learn.

## Repo layout (only the parts that matter)

The git repo root is `~/Documents/claude-folder/webpage/`. **Sources** for some
data live one level up at `~/Documents/claude-folder/` and are **not** in git.

```
webpage/                            ← git repo, GitHub Pages root
├── index.html, search.html, exam.html
├── app.js                          ← all client JS, single file
├── styles.css
├── sw.js                           ← service worker, caches aggressively
├── data/
│   ├── meta.<hash>.json            ← deployed problem metadata
│   └── bodies.<hash>.json          ← deployed problem LaTeX + tikz info
├── problems/NNN.html               ← 665 per-problem pages, each with an
│                                     inline `const PROBLEM = {...}` constant
├── tikz/prob-NNN-figK.svg          ← rendered TikZ figures
├── matura_figs/<paper>_prob_NN_figK.png
│                                   ← figure-only crops of the original PDFs
├── matura_refined/<paper>/prob_NN.png
│                                   ← problem-level crops (whole problem)
└── push.command                    ← one-click git push from Finder

../ (one level up, NOT in git)
├── matura_extra_transcripts.json   ← source of truth for matura_extra
│                                     problems' LaTeX + topics
├── matura_naloge.tex                ← source for the main matura corpus
└── matura_extra_*/                  ← raw matura PDFs by paper

../../outputs/                       ← Claude scratchpad (ephemeral)
├── render_pre2017_tikz.py           ← bulk TikZ → SVG renderer
├── render_pre2017_pages.py          ← bulk page render
├── fix_*.py, reassign_*.py          ← one-off scripts
└── TIKZ_AUDIT.md                    ← cumulative audit status (read me!)
```

## The three-place sync rule

ANY edit to a problem's LaTeX, TikZ, topics, or `tikz_originals` MUST be
applied in three places or the user will see inconsistent state:

1. **Source** in `matura_extra_transcripts.json` (only for matura_extra
   problems — main corpus comes from `matura_naloge.tex`)
2. **Deployed** in `webpage/data/bodies.<hash>.json` (and `meta.<hash>.json`
   for topics-only changes)
3. **Per-problem inline** in `webpage/problems/NNN.html` — the
   `const PROBLEM = {...}` constant inside the page

Forgetting #3 is the most common bug because the inline PROBLEM is what the
problem page reads on initial load; the deployed bodies.json is only read
lazily by the search/index pages.

## Cache invalidation discipline

The site has TWO cache layers. After ANY change to JS/CSS/HTML/data/SVG:

1. Bump the global query-string version: `v=601XXX → v=601(XXX+1)` across
   ALL `*.html`, `*.js`, `*.css` files in `webpage/` (typically ~668 files).
   ```
   find . -type f \( -name "*.html" -o -name "*.js" -o -name "*.css" \) \
     -exec sed -i 's/v=601N/v=601N+1/g' {} +
   ```
2. Bump the service worker cache name in `sw.js`:
   `mat-tikz-N → mat-tikz-N+1`.

For changes to a single TikZ figure SVG, ALSO bump the `?v=...` parameter in
that problem's `tikz_originals[k]` cache buster (in both bodies.json AND the
inline PROBLEM in `problems/NNN.html`).

If the user reports "I see no change," the answer is almost always: the
change is in the file but they're looking at a service-worker-cached version.
Hard refresh (Cmd+Shift+R) bypasses the SW. The push hasn't deployed yet is
the second most common cause.

## TikZ render pipeline

Editing a TikZ block requires the SVG to be re-rendered:

1. Edit `\begin{tikzpicture}...\end{tikzpicture}` block in `bodies.json`'s
   `latex` field for that problem.
2. Render to SVG via:
   ```python
   subprocess.run(["pdflatex","-interaction=nonstopmode","-halt-on-error",
                   "-output-directory", tmp, tex_path], ...)
   subprocess.run(["pdftocairo","-svg", pdf, out_svg], ...)
   ```
   See `outputs/render_pre2017_tikz.py` for the working template.
3. Stamp `data-source-hash="<sha1[:12]>"` into the SVG so future runs can
   detect when the SVG is stale.
4. Mirror the latex change into `problems/NNN.html`'s PROBLEM constant.
5. Bump caches per the rule above.

The standalone TikZ document uses a fixed preamble with `amsmath`, `tikz`,
and these libraries: `calc,angles,quotes,intersections,decorations.pathreplacing`.

## Hard rules (don't break these)

- **Never fabricate transcribed text.** If a problem's wording isn't visible
  in the page image, ASK the user. Adding plausible-sounding Slovenian
  descriptions is forbidden. This wasted multiple iterations on #763.
- **Never delete a real shaded region, point, label, or branch from a TikZ
  figure** unless you've verified it's not in the original PDF page.
  Conversely, never add elements (points, labels, branches) that aren't
  visible in the original.
- **Match the original's arc arrowheads AND vertex/intersection dots
  exactly (user rule, #221).** If an angle/arc in the original has
  arrowheads on BOTH ends, the `\pic`/arc must use `<->`; one end → `<-`
  or `->`; no arrowhead → none. If the original marks vertices or
  intersection points with small filled dots, include them; if the
  original has NO dots, do NOT add any. Always zoom the original to check
  arrowhead count and dot presence before authoring — do not default.
  **CRITICAL DOT-SIZE GOTCHA (#221): `[scale=s]` ALSO scales a `circle (Npt)`
  radius by s, so at small scales (e.g. 0.18) a `circle (1-2pt)` dot shrinks
  to sub-pixel and VANISHES — the dots silently don't render. Size vertex
  dots in COORDINATE UNITS, not pt: `\fill (P) circle (R)` with
  `R ≈ 0.0085 × (units across)` so the dot ≈1.7% of figure width (match the
  original's dot/figure ratio). #221 (32 units) → `circle (0.27)`. After
  authoring dots, ZOOM a vertex in the render to confirm they actually
  appear — never assume a `\fill ... circle` rendered.**
- **Always preview a TikZ change before claiming it's done** — render the
  SVG, convert to PNG with white background, view the image, compare to
  the original side-by-side. The user wants to react inside the same turn,
  not after a 5-minute deploy + hard-refresh cycle.
- **Montage orientation (user preference):** whenever you change TikZ, show
  the comparison as a 2-up montage with the newly-compiled TikZ on the LEFT
  and the ORIGINAL on the RIGHT. Always this order, every time.
- **ALWAYS give a side-by-side comparison after ANY TikZ change — no
  exceptions.** Every time you touch a figure (initial rework or the
  smallest follow-up nudge), present the left-right montage image (new
  TikZ left, original right) to the user. Never just describe the result
  in text; the user wants to see the comparison every single time.
  **Generating/Read-ing the montage is NOT enough — you must actually call
  `present_files` on it so it shows up in the chat.**
- **ORDER OF OPERATIONS — call `present_files` on the montage IMMEDIATELY
  after rendering it, BEFORE syncing the data (bodies.json / inline html /
  svg copy) and BEFORE bumping any caches.** Render → present → THEN sync +
  caches. Rationale: the forgetting always happens on follow-up tweaks,
  where the present step gets buried under the sync/cache sequence and the
  task feels "done" without it. Putting `present_files` first — at the
  salient moment, with nothing after the render to distract — makes it
  impossible to skip. Do NOT batch the montage render together with the
  data-sync steps; the very next tool call after the montage is generated
  must be `present_files`.
- **The origin label "0" always goes in the bottom-left of the origin**
  (`\node[below left] at (0,0) {$0$};`) in every coordinate-system figure,
  regardless of how the original positioned it.
- **Axis-label alignment — ALWAYS keep every axis label consistent with the
  "0", no exceptions unless there is a specific reason (e.g. a label would
  collide with something).** Since "0" is `[below left]`, give EVERY axis
  number label the `[below left]` anchor at its own tick:
  - x-axis: `\node[below left] at (n,0) {$n$};`
  - y-axis: `\node[below left] at (0,m) {$m$};`

  This makes each label's offset from its tick identical to the "0"'s offset
  from the origin, so automatically: x-axis labels all share the "0"'s
  VERTICAL level, and y-axis labels all share the "0"'s HORIZONTAL position.
  Every label ends up slightly below-and-left of its tick (off the curves),
  and y-axis numbers stay on the LEFT of the axis. Do NOT scatter labels at
  ad-hoc offsets and do NOT put some y-labels on the right — that breaks
  consistency with the "0". (Earlier figures 818/839 had only one y-label,
  centre-aligned to "0"; the general rule above supersedes that.)
  **Nudge (user, #231): from the `[below left]` anchor, push x-axis numbers a
  bit RIGHT and y-axis numbers a bit UP (e.g. `xshift=6pt` / `yshift=6pt`,
  same shift for every label on an axis) so they sit ~centered on their
  gridlines like the originals — but DO NOT shift "0" (it stays in the
  corner). This keeps the uniform-offset/alignment property while matching
  the original's centered look.**
  **MATURA coordinate-system style (user, #269 — apply to ALL "Matura"-source
  coordinate systems, NOT the kotne-funkcije textbook circle figures which have
  their own scheme):**
  - **Thin lines:** axes `\draw[line width=0.5pt,->] ...` (with `>=latex`
    arrowheads); tick dashes `\draw[line width=0.4pt] (\x,-0.1)--(\x,0.1);`
    (length ±0.1u). Curves stay `very thick`.
  - **Include "0"** at origin, `[below left]`, nudged a hair DOWN: `yshift=-2pt`.
  - **Below-axis labels nudged slightly down too:** every x-axis number gets
    `yshift=-2pt` ON TOP OF the #231 right-nudge → `[below left,xshift=6pt,yshift=-2pt]`.
    y-axis numbers keep just the up-nudge → `[below left,yshift=6pt]`. So the
    three label kinds: x-num `[below left,xshift=6pt,yshift=-2pt]`, y-num
    `[below left,yshift=6pt]`, "0" `[below left,yshift=-2pt]`.
  - **Axis `x`/`y` names** at the arrow ends: `x` `[below right=-2pt]` at the
    right end, `y` `[above left=-2pt]` at the top end.
  - **Scale** to match the original's label/unit proportion (#269 empty
    log-coord, ~7 units across → scale ≈ 0.85; recent authored coord figures
    use ~0.55–0.85, not the older `17/units`).
  **Grid-on-fill (user, #231): when a gray-filled region sits on a dashed
  grid and the grid shows THROUGH the fill in the original, draw the grid
  FIRST, then a SEMI-TRANSPARENT fill (`\fill[black!40,opacity=0.8]`) so the
  mesh remains visible; match the grid darkness to the original (often
  near-black `dashed,black!90,thin`, not faint `help lines`).**
  **DENSE DASHES (user, #247 — applies to EVERY coordinate-system grid, retro
  + future): never use plain `dashed` (too sparse) for grid lines. The matura
  originals use ~6 short dashes per cell (≈on 5px / off 3px on a 50px unit).
  Reproduce with `dash pattern=on Xpt off Ypt` where `X = 2.835·scale`,
  `Y = 1.7·scale` (so density stays ~6/unit regardless of `scale`, since the
  pattern is ABSOLUTE pt and is NOT scaled by the picture `scale`). e.g.
  scale 0.7→`on 1.98pt off 1.19pt`, 0.5→`on 1.42pt off 0.85pt`. Applied to
  #231/#245/#247/#259/#307/#308/#323; use it on all new grids too.**
- **Figure size / label-to-axis proportion (updated):** the problem page CSS
  (`.preview-box .tex-tikz img/svg`) now sets `width:100%` (max 600px), so
  EVERY figure scales up to fill the preview column regardless of its
  intrinsic pt size — intrinsic width no longer controls on-screen size.
  What still matters is keeping the on-screen LABEL size consistent across
  figures. Since label font is fixed pt and the SVG is scaled to the column,
  on-screen label size ∝ 1/(svg intrinsic width) = 1/(units × scale). The CSS
  now displays figures at ~600px column width, so the OLD small scales
  (~0.35–0.6) blow the labels/arrows/line-widths up huge. Author at a much
  larger scale: **`scale ≈ 17 / (number of units across)`** so the grid is big
  relative to the fixed-pt font/arrows. Verified: 578 (≈14 units) → scale 1.2
  matches the original at column width. At these large scales the y-axis "1"
  needs NO manual x-offset (just `\node[left] at (0,1)`) — it auto-aligns with
  "0". NOTE: figures authored earlier this session (818, 820, 839, 843, 847,
  538) are still at the old small scales and will look oversized at column
  width — they need re-rendering at `scale≈17/units`.
  **CLARIFICATION (user decided on #221): `17/units` is for COORDINATE-GRID
  figures (axes + tick numbers). For SHAPE / dimension-label figures (a
  trapezoid with side labels, a triangle, etc.) MATCH THE ORIGINAL's
  on-screen label size instead — scale so label-cap-height / figure-width
  equals the original's. Those originals often have large labels and
  17/units would shrink them too much. #221 (32 units wide) → scale 0.18.**
- **One problem per turn during iterative figure work.** Bundling 6 figures
  into one round means each subsequent feedback loop has to spool through
  stale renders for all of them. The user has explicitly asked for this.

## "From scratch" figure protocol (MEASURE, don't eyeball)

When the user says to (re)build a figure **"from scratch"** (or rejects an
eyeballed attempt), match the original rigorously. The steps that produced a
"very good" result on #20:

1. **Measure BOTH axis units separately.** Find the pixel position of each
   axis's "1" digit (and tick spacing) → `unit_px` for x AND y. Decide
   uniform-vs-stretched from the measured ratio — do NOT assume. (#20's portrait
   look was a tall y-RANGE with uniform units, not an xscale/yscale stretch; a
   wrong guess there was rejected.)
2. **Detect EVERY tick and reproduce the full range.** Scan both axes for all
   short perpendicular dashes; emit them with `\foreach` over the true range
   (#20 was x −4..4, y −7..7). Missing dashes is the most common complaint.
3. **Scale** = `0.243 / (label-cap-px / unit-px)` so labels read at the
   original's relative size.
4. **Plotted curves: TRACE, don't guess the formula.** Zero out the axis lines
   (±1px at vx/hy) and ticks, `ndimage.label` the rest, and read from the curve
   components: x-range, roots (y sign-changes), local max/min (x & y), and the
   y-intercept. Then fit the function from roots + intercept (solve k). Eyeballing
   #20 gave roots ≈±0.6 (tiny wiggle); tracing gave the real ±2/0.9 (fills frame).
5. **Frame extent.** Match the original's (often asymmetric/tall) view box so the
   curve tails exit at the same edges.
6. **Labels & anchors.** Place labels at the original's measured positions with
   explicit `\node at (...)`. For angle arcs use `angle eccentricity < 1` (≈0.6)
   or explicit nodes so the label sits INSIDE the arc; set each arc radius to
   match. Keep the "0"/axis-label conventions above.
7. **Line weights & markers.** Use `thick`/`line width=...` where the original is
   bold; put filled dots at every marked vertex/point; enlarge arrowheads via
   line width (classic `>=latex` tip scales with width).
8. **Intersections & incidences.** Verify lines/curves actually cross at the
   intended points and that marked points lie exactly on the curves.
9. **Verify TWO ways before claiming done:** (a) a RED(mine)-on-BLACK(original)
   pixel overlay at matched size to catch position/scale drift, then (b) the
   side-by-side montage (present THAT per the montage rule). Iterate on real
   measurements, not impressions.

Helper preamble for rendering during this work (superset of the deployed one):
`\usetikzlibrary{calc,angles,quotes,intersections,decorations.pathreplacing,patterns}`.

## Angle arcs (when asked to "redo/fix the arc")
Do NOT eyeball start/end angles or radius. Instead:
1. **Identify the two edges the arc spans** — from the geometry, which ray to which
   ray (e.g. "from line BE to line BC" = ray B→E to ray B→C). The arc is always
   centred at the shared vertex.
2. **Compute the angle from the vertex coordinates.** Vectors from the vertex to
   each neighbour give the two ray angles; the span is their difference. (Sanity-
   check against the problem data, e.g. β = arctan(EC/EB).) Example #58:
   B=(2,0), E=(0,0), C=(0,4) → B→E = 180°, B→C = atan2(4,−2)=116.57° → β=63.43°.
3. **Draw it edge-to-edge with the `angle` pic so the span is locked to the actual
   coordinates** (no hardcoded angles that can drift off the edges):
   `\pic [draw, "$\beta$", angle radius=6mm, angle eccentricity=0.62] {angle = C--B--E};`
   Order the three points so the SHORT (interior) arc is drawn — swap the outer two
   if it draws the reflex side. `angle radius` = arc size (absolute mm, NOT scaled by
   the picture `scale`); `angle eccentricity<1` pulls the label INSIDE toward the
   vertex (Daniel likes the label close to the vertex), `>1` pushes it outside.
4. Verify the arc visually touches BOTH edges and that the label sits where wanted.

### Label-inside-the-arc sizing (DETECTION rule — Daniel wants labels CONTAINED inside arcs)
The recurring bug: labels float outside the arc or spill past the rays. The label must
sit INSIDE the arc (between vertex and arc) and INSIDE the wedge. This LINKS the arc
radius to the angle and the label size — compute it, don't eyeball:
1. **Measure the label's bounding-radius r** (figure units, at the picture scale):
   render the label standalone, get its width w & height h in figure units,
   r = sqrt((w/2)²+(h/2)²). (At scale 1.0, "30°"≈r 0.28, a single Greek letter≈0.16–0.19.)
2. **Pick eccentricity e** (label at d = e·R on the bisector); e≈0.6 puts it nicely inside.
3. **Arc radius:** the wedge half-width at distance d is d·sin(θ/2); to contain the
   label box there you need d·sin(θ/2) ≥ r ⇒ **R ≥ r / (e·sin(θ/2))**. Set
   `angle radius = R·scale` (cm) and `angle eccentricity = e`. Floor R≈0.5u so tiny
   arcs don't vanish. ⇒ NARROW angles need BIG arcs (so the label fits the thin wedge);
   wide angles can be small. (#115: 30°→R 1.8u, 50°→1.1u, 74°→0.78u, φ→0.5u, β→0.59u, all e=0.6.)
4. Verify by rendering: the label should be fully between the vertex and the arc, not
   crossing either ray.
5. **ALSO match the ORIGINAL arc radii** (Daniel wants the arc sizes to match): measure
   each original arc by drawing reference circles of known radius (in figure units)
   centred at the vertex and reading which circle the arc lies on (the containment
   formula only gives a MINIMUM — the original size is the target, usually bigger for
   wide angles). Matura arcs are fairly uniform (#115: 30°→1.4u, φ/50°→1.2u, β→1.1u,
   74°→0.95u; labels inside at eccentricity ≈0.7). Set `angle radius` to the measured u
   (×scale) and eccentricity so the label sits ~0.7·R inside.

Note: a matura ORIGINAL angle arc may be drawn large (foot far from the vertex), but
Daniel generally prefers a tight marker hugging the vertex with the label CONTAINED
INSIDE the arc — always get the span (edge-to-edge) and centre right, and size the arc
to the label per the rule above.

## Table spacing — match the original (MEASURE from the image, never eyeball)

Goal: every `\begin{tabular}` problem (67 of them) should render on the site
looking like its original exam table — full width, wide answer/option columns,
compact header, roomy fill-in rows. The site converts `\begin{tabular}` →
HTML `<table class="tex-tabular">` in `latexToHtml` (app.js); it does NOT
pdflatex tables. So the fix is HTML/CSS, driven by per-table `p{}` widths.

**Renderer support already built (app.js `latexToHtml` tabular handler + styles.css).**
Do not re-derive these; they apply to ALL tables automatically:
- If EVERY column is `p{...cm}`, the handler converts the cm widths to
  **percentages of their sum**, emits `width:X%` + `min-width:<orig cm>` per
  cell, and adds class `tex-tabular-prop`. CSS `.tex-tabular-prop{width:100%}`.
  Net effect: the table FILLS the panel at the measured proportions, columns
  never collapse/squish (min-width floor), and the existing
  `.tex-tabular-scroll{overflow-x:auto}` wrapper gives a horizontal scrollbar
  on overflow.
- **NEVER use `table-layout:fixed`.** It forces exact widths and squishes the
  cell content into a jumbled mess (Daniel rejected this hard). Use the default
  **auto** layout + `width:100%` + per-column `min-width` + scroll wrapper.
- The first row is detected as a **header** when its cells contain `\textbf`
  → emitted as `<tr class="tex-row-head">`; CSS makes that row `height:auto`
  (compact) while the answer rows below stay tall (the fill-in
  `height:calc(2.2rem*var(--stretch))`). This gives the original's short-header
  + tall-answer-rows look.
- **`\encircle{...}`** → `<span class="tex-circled">` (oval ring), for a
  worked-example answer the exam circles in the solved row (e.g. #29 "liha",
  #367 "negativna"). Use it INSTEAD of `\fbox{...}` wherever the original draws
  a hand-drawn circle around the example answer, not a box.

**Per-table fix = ONLY the column widths + arraystretch.** Keep the transcribed
rows/content unchanged; just change the column spec `{|c|c|c|}` →
`{|p{w1cm}|p{w2cm}|p{w3cm}|}`. **Set the widths BY EYE** — the cv2 grid-detector
(`measuretab.py`) is UNRELIABLE on borderless/varied tables, so view
`origtab_N.png` yourself and pick the proportions; and **respect Daniel's
existing `p{}` widths as the base** (he set them deliberately — build on them,
don't rewrite his proportions). Remember full-width vs compact is decided by the
SUM of the p{} widths (≥13cm → full-width prop; <13cm → compact). DA/NE tables
with a spanning `\multicolumn` header have WIDE option columns (~30% each).

**Pipeline (scripts in ../outputs/), small ~6 batches, side-by-side per RULE #1:**
1. `python3 croptab.py N` → `origtab_N.png` (original cropped to the table grid).
   `Read` it and choose the colspec by eye.
2. Write `newtab_N.tex` (a small python that swaps the chosen colspec +
   `\arraystretch` into the original tabular block; balanced-brace the colspec).
3. `node previewbatch.js N1 N2 …` → renders the **real site HTML** of each new
   table (actual `latexToHtml` from app.js + MathJax→SVG) next to the original
   crop, into a **timestamped** `webpage/_tabprev_<ts>.html` (FRESH filename
   every render — the service worker caches a same-named file, so a reused name
   makes Daniel reload and see "nothing changed"). `present_files` the printed
   path; iterate; on approval `python3 synctab.py N` (bodies.json + inline
   PROBLEM in problems/NNN.html) then bump caches at the end before push.
**I cannot see the render** (Claude-in-Chrome stays disconnected; no headless
browser in the sandbox). So tune conservatively, present, and let Daniel guide —
never switch layout modes or rewrite his widths blind.

**Why HTML preview, not pdflatex:** the site is HTML; pdflatex row-height ≠ the
CSS `calc(2.2rem*stretch)` row-height, so a pdflatex montage misleads on
spacing. Math in the preview must be **pre-rendered to SVG** in node
(`require('mathjax').init({loader:{load:['input/tex-full','output/svg']},svg:{fontCache:'local'}})`)
because CDN MathJax does not run from a local `file://` page. See
[[table-review-tool]] memory for the review-tool details.

## Topic vocabulary

The curriculum is the M-MAT-2026 syllabus. The TOPIC_PARENT map in
`app.js` is the authoritative vocabulary; topics outside this map are
silently dropped on render. When adding or renaming topics, edit the map
in `app.js` AND update all affected problems' `topics` arrays in all
three sync locations.

Main topics ("4.X Name") and subtopics ("4.X.Y Name") form a 2-level
hierarchy; including a subtopic implies its parent main, but the parent
should also be present explicitly in `topics` so the index renders
correctly.

## Common pitfalls

- **MathJax doesn't understand `\rule`, `\hspace` (outside math), `\medskip`,
  or `\\` outside `cases`/`align`**. Use `\underline{\qquad\quad}` for blanks,
  blank lines for vertical space, and `$\\[8pt]$` row separators inside
  `cases`. Wrap `\underline` in `$...$` if it appears outside math mode.
- **Inline `$...$` collapses `cases` to one row.** Use display mode `\[...\]`
  so each row wraps onto its own line.
- **TikZ curves near asymptotes (e.g. `1/(x-a)`) blow up the bounding box.**
  Always wrap with `\clip (...)rectangle(...);` inside a `\begin{scope}`.
- **`pdftocairo --svg` produces a transparent background.** When converting
  to PNG for visual comparison, composite onto a white background or every
  black-stroke figure renders as a black rectangle.
- **The TikZ source-hash trick:** every SVG is stamped with the sha1 of its
  source block. After re-rendering, verify the SVG's hash matches the
  current source — if it doesn't, the deployed SVG is stale.

## Useful scripts (in ../outputs/)

- `render_pre2017_tikz.py` — bulk re-render every TikZ block in pre-2017
  problems. Skips up-to-date SVGs via the source-hash check.
- `render_pre2017_pages.py` — bulk render PDF pages to PNG.
- `reassign_limita.py` — example of the three-place sync pattern for
  topic reassignment.
- `fix_*.py`, `transcripts_*.py` — one-off scripts kept for reference;
  not part of any build pipeline.

There is no central build script. Edits are made directly to deployed files
and pushed.

## Ongoing work

See `TIKZ_AUDIT.md` for the per-figure TikZ audit status. That file is the
canonical "where did we leave off" record.

The pending Task #290 (textbook re-import from original source) is a
larger project to redo the textbook corpus from cleaner PDFs.

## When in doubt

Ask before guessing. The user has explicitly preferred a clarifying question
to a wrong fix on multiple occasions.
