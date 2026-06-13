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
- **Always preview a TikZ change before claiming it's done** — render the
  SVG, convert to PNG with white background, view the image, compare to
  the original side-by-side. The user wants to react inside the same turn,
  not after a 5-minute deploy + hard-refresh cycle.
- **One problem per turn during iterative figure work.** Bundling 6 figures
  into one round means each subsequent feedback loop has to spool through
  stale renders for all of them. The user has explicitly asked for this.

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
