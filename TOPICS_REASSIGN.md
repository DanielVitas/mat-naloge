# Topic migration to the RIC vocabulary — status

2026-07-02: replaced the old M-MAT-2026 "4.X" vocabulary with the RIC
search-tool hierarchy (17 mains, 122 subtopics; VR markers stripped, long
names shortened — approved by Daniel) and reassigned ALL problems from
their latex transcriptions (12 parallel passes + 2 for undeployed
transcript entries).

## What was synced (all done, caches at v=602198 / mat-tikz-725)

- `app.js`: TOPIC_MAIN / TOPIC_PARENT replaced; `_PREFIX_RE` and the two
  main-vs-sub code heuristics updated for "N" / "N.M" numbering.
- `data/meta.4047b55db6.json` (NEW hash; old dee8d0fa79 no longer referenced):
  topics per problem. META_URL updated in index/search/exam + all problem pages.
- `problems/NNN.html` (662): inline PROBLEM `topics` + pre-rendered
  `topics-tags` chips regenerated. 8 redirect stubs skipped.
- `../matura_extra_transcripts.json`: all 882 entries on the new vocabulary
  (756 deployed + 126 undeployed assigned from their latex).
- `index.html` "Po temah" panel rebuilt: 17 details, new slugs, membership +
  counts from the new assignment.
- Full assignment record: `../topics_new_assignments.json`.

## Assignment stats (after pass 2)

Pass 2 (2026-07-02, per Daniel's review): ADDITIVE recall pass — whenever a
function type appears anywhere in a problem (e^x → 10.13, trig → 10.17,
log → 10.14, √(variable) → 5.2, …), its topic applies. Lexical detector
produced hints; agents verified (common false positives skipped: √ of pure
numbers, "izpitne pole" ≠ poles, "linearna kombinacija" ≠ combinatorics,
ellipse "temena" ≠ quadratic, dx in integrals ≠ derivative). 225 problems
gained 445 tags; nothing removed. Caches now v=602199 / mat-tikz-726; meta
is meta.fbe3ab363a.json.

Main-topic counts: 1:5 2:32 3:116 4:84 5:44 6:85 7:78 8:40 9:37 10:318
11:44 12:67 13:83 14:64 15:46 16:40 17:10.

## Review pages (2026-07-02, evening)

60 flagged problems compiled into 6 batches of 10:
`_topicrev_202607031944_b1.html` … `_b6.html` (in webpage/, open locally;
regenerated after pass 2 — topics shown include the additive pass).
Left = problem rendered with the site's latexToHtml (math pre-rendered to
SVG; TikZ NOT compiled — "[slika izpuščena]" markers instead, per Daniel),
right = new topic chips with uncertain ones marked ⚠ (amber) + the
assigner's note. Generator: `outputs/topic_assign/build_topicrev.js` +
`uncertain.json` (per-problem uncertain topic ids + notes).

## NEXT: Daniel reviews problem-by-problem

Daniel will go through problems one by one and accept/fix topics. Cases the
assigners flagged as uncertain (worth checking first):

- Induction proofs have no vocabulary slot → tagged 3.1 (naravna števila):
  209, 437, 613, 644, extras 2014_Spomladanski_Pola2_VR:11, 2013_Spomladanski_Pola2_VR:9.
- Polygon areas on grids → 7.1 + 9.3 even for non-triangles: 8, 66, 231.
- Circle as conic (11.2) vs complex-plane locus vs plane geometry: 63, 241,
  550, 683, 779; tangent-chord/inscribed angles 99, 429.
- Complex-plane region drawing + 9.1 (sets of points): 307, 308, 330 (added)
  vs 683 (not added) — inconsistent, pick a convention.
- Quadratic-reduction tagged 10.12 instead of 4.5: 289, 350, 436.
- Rotations of points/figures (no rotation topic): 473, 475; map scale 783.
- Misc: 10 (complex roots assumed), 23, 30, 32, 110, 145, 148, 154, 163,
  176 (old Odvod tag dropped), 188, 194, 202, 246, 257, 259, 298 (per partes
  at OR level — possible mistranscription), 339, 360, 372, 392, 418, 421,
  452, 456–458, 508, 522, 588, 605, 640, 679, 692, 828, 837.

## Process notes (for future sessions)

- Vocabulary lives ONLY in app.js (TOPIC_MAIN/TOPIC_PARENT); topics sync to
  3 places: meta.<hash>.json, inline PROBLEM + topics-tags line in
  problems/NNN.html, matura_extra_transcripts.json (extras only).
- meta filename = sha1[:10] of content; update META_URL in ALL html
  (index/search/exam + every problem page).
- Textbook problem pages have MULTI-LINE PROBLEM constants with raw LaTeX —
  never JSON-parse them; use string surgery on the "topics": [...] span.
- The index "Po temah" panel is static HTML — regenerate on any topic change
  (script: outputs/topic_assign/sync_topics.py from the 2026-07-02 session,
  regeneration part).
