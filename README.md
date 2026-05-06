# Matura naloge — webpage

A static, browser-only review tool for the transcribed Matura math problems.

## Layout per page

* **Tags** at the top show year / season / pola / level / A·B·C section / points
  as separate, colour-coded chips so you can scan and (later) filter by them.
* **LaTeX transcript** on the left — editable textarea with a live preview
  (MathJax for math, simple HTML rendering for tables/itemize/center, and
  pre-rendered SVG for any TikZ figures).
* **Original on the right** is now coordinate-based: there is no separate
  cropped PNG, only a bounding box `(x1, y1, x2, y2)` into the rendered exam
  page. The page image is loaded once and the canvas redraws just the crop.

## Editing the crop

* Click **“✎ Edit crop”** on a problem page → the full exam page appears.
* Click and drag (or touch-drag) over the area you want — the rectangle updates
  live as you drag.
* **“Save crop”** writes the new `bbox` to your browser's localStorage and
  flips the “transcript needs redoing” flag (the assumption being that a new
  crop usually means you spotted an issue with the transcript).
* **“Reset to default”** restores the auto-detected crop.

The crop is stored as four integers in source-image pixel space — that's all
the storage anyone needs. Send me the JSON export and I'll regenerate the
master file's `\original{...}` with the new bounding box.

## Editing the transcript

* Type into the textarea on the left; edits auto-save to localStorage as you
  type. The preview re-renders with each change.
* TikZ figures in the preview show a pre-rendered SVG. If you change the TikZ
  code, the preview will keep showing the original SVG until I re-build, but
  you can still see the result by sending me the export.

## Hosting on Google Sites

Sites is a WYSIWYG editor and doesn't accept arbitrary multi-file static HTML.
The smoothest options are:

1. **Use it locally first** — open `index.html` in your browser; everything,
   including the crop editor, works fully offline.
2. **Embed via iframe.** Put this folder on a static host (GitHub Pages,
   Netlify drop, even Drive “Publish to web”) and in Google Sites use
   *Insert → Embed → Embed code* with `<iframe src="…">`.

When you've finished editing a batch, click **Export all changes** on the
index page and send me the resulting `all-changes.json`.
