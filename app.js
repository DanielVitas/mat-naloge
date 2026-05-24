// Per-problem state in localStorage. Key = `prob-NNN`.
// Stored fields: latex (string), bbox ([x1,y1,x2,y2]), outdated (bool),
//                topics (array of strings), approved_by (string|null).

// ---------------------------------------------------------------------------
// SPA Phase 1: data bootstrap loader.
// ---------------------------------------------------------------------------
// Each page sets window.DATA_URL = "data.<hash>.json". The first init
// function awaits bootstrapData(), which fetches the JSON, sets
// window.PROBLEMS + window.PROBLEMS_LATEX, and resolves a singleton
// promise so subsequent callers reuse the result. Pages that still
// inline PROBLEMS (old behaviour) work too — if PROBLEMS is already
// set and no DATA_URL is given, bootstrapData is a no-op.
// SPA Phase 5: register the service worker for offline + aggressive
// caching. Registered at module-load time on every page so subsequent
// visits become near-instant (all versioned assets + the data bundle
// are served from cache; HTML pages use stale-while-revalidate so
// updates still propagate but the first paint is from cache).
if ('serviceWorker' in navigator) {
  // Defer until after the page settles so the SW registration doesn't
  // compete with the page's own resource loads on first paint.
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) => {
      console.warn('service worker registration failed:', err);
    });
  });
}

// ---------------------------------------------------------------------------
// SPA Phase 3: client-side router (soft SPA).
// ---------------------------------------------------------------------------
// Each existing HTML file stays addressable as a direct entry point —
// /search.html, /problem-337.html, etc. still work via GitHub Pages
// and the service worker caches them. What changes: when the user
// clicks a same-origin link, we intercept, fetch the target HTML,
// parse it, swap the .container element in place, and re-run any
// inline page-init scripts. No full reload → no MathJax re-bootstrap,
// no app.js re-execute, no service-worker re-register, no flash of
// blank page. The data bundle stays in memory across navigations.
//
// Each inline script we re-run is wrapped in an IIFE so const/let
// identifiers (e.g. `const PROBLEM = …` on problem pages) don't
// collide with the previous page's. Scripts we DON'T re-run: the
// MathJax config (already loaded), the DATA_URL setter (already set),
// the PROBLEMS_LATEX pre-seed (would clobber the full bundle merged
// in by bootstrapData), and any external <script src> (app.js itself).
let _spaInFlight = null;
async function spaNavigate(url, push = true) {
  let target;
  try { target = new URL(url, window.location.href); } catch (_e) { return false; }
  if (target.origin !== window.location.origin) return false;
  if (target.pathname === window.location.pathname &&
      target.search === window.location.search) {
    if (target.hash) {
      window.location.hash = target.hash;
    }
    return true;
  }
  _spaInFlight = target.href;
  try {
    const resp = await fetch(target.href);
    if (!resp.ok) { window.location.href = target.href; return true; }
    if (_spaInFlight !== target.href) return true;
    const html = await resp.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const newContainer = doc.querySelector('.container');
    const curContainer = document.querySelector('.container');
    if (!newContainer || !curContainer) {
      // Couldn't find the swap target — fall back to a real navigation.
      window.location.href = target.href;
      return true;
    }
    curContainer.replaceWith(newContainer);
    if (doc.title) document.title = doc.title;
    // Re-run page-specific inline scripts. Skip anything that's
    // already-running infrastructure on the parent shell.
    const SKIP_PATTERNS = [
      /window\s*\.\s*MathJax\s*=/,           // MathJax config (already loaded)
      /window\s*\.\s*DATA_URL\s*=/,          // already set
      /window\s*\.\s*PROBLEMS_LATEX\s*=/,    // would clobber merged map
      /window\s*\.\s*glueOrphanPunctuation/, // defined globally already
    ];
    const newScripts = doc.querySelectorAll('script:not([src])');
    for (const s of newScripts) {
      const txt = (s.textContent || '').trim();
      if (!txt) continue;
      if (SKIP_PATTERNS.some(re => re.test(txt))) continue;
      // IIFE-wrap so `const`/`let` identifiers stay scoped.
      const exec = document.createElement('script');
      exec.textContent = '(function(){\n' + txt + '\n})();';
      document.body.appendChild(exec);
      document.body.removeChild(exec);
    }
    if (push) {
      window.history.pushState({ spaUrl: target.href }, '', target.href);
    }
    // Scroll to top on a real navigation, or to the anchor if any.
    if (target.hash) {
      const el = document.querySelector(target.hash);
      if (el) el.scrollIntoView();
    } else {
      window.scrollTo(0, 0);
    }
    return true;
  } catch (err) {
    console.warn('SPA navigation failed, falling back to reload:', err);
    window.location.href = target.href;
    return true;
  }
}

// Paths that should ALWAYS do a full reload, never SPA-swap. The
// problem-NNN.html pages each have their own inline `const PROBLEM =
// {...}; initProblemPage(PROBLEM);` bootstrap, and that state machine
// is fragile when re-run inside an IIFE on a swapped-in container —
// the new container's textarea/preview/crop-canvas references end up
// pointing to elements that exist but never get populated, leaving
// the page visually empty until a manual reload. Full reload is
// ~12 KB shell + cached data bundle, so the perceived delay is
// negligible and the page lands deterministically every time.
//
// The Problems page (index.html / "/") gets the same treatment: its
// initIndexPage() bootstrap is heavy (hydration observer, source
// filter, topic re-grouping, subtopic chips) and the order in which
// those run vs. async fetches doesn't survive an IIFE re-execution
// inside a swapped container — cards land as bare skeletons that
// never get their bodies hydrated. Full-reload trades ~50ms for
// guaranteed-correct first paint.
function _isProblemPagePath(pathname) {
  return /\/problems\/\d+\.html?$/.test(pathname);
}
function _isIndexPagePath(pathname) {
  // "/", "/index.html", or any subdir variant ending in /index.html.
  return pathname === '/' || /\/index\.html?$/.test(pathname);
}
function _needsFullReload(pathname) {
  return _isProblemPagePath(pathname) || _isIndexPagePath(pathname);
}

// Intercept clicks on internal links. Skip modifier-clicks (which open
// in new tabs), target="_blank", non-http URLs, and the user's special
// data-no-spa opt-out.
document.addEventListener('click', (e) => {
  if (e.defaultPrevented) return;
  if (e.button !== 0) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest('a[href]');
  if (!a) return;
  if (a.hasAttribute('data-no-spa')) return;
  if (a.target && a.target !== '' && a.target !== '_self') return;
  const href = a.getAttribute('href');
  if (!href) return;
  if (href.startsWith('mailto:') || href.startsWith('tel:') ||
      href.startsWith('javascript:')) return;
  let target;
  try { target = new URL(href, window.location.href); } catch (_e) { return; }
  if (target.origin !== window.location.origin) return;
  // Hash-only clicks: let the browser handle the scroll, no fetch.
  if (target.pathname === window.location.pathname &&
      target.search === window.location.search && target.hash) {
    return;
  }
  // **Problem pages + Problems index**: always full-reload (never SPA-swap).
  // See _needsFullReload for rationale.
  if (_needsFullReload(target.pathname) ||
      _needsFullReload(window.location.pathname)) {
    return;  // let the browser navigate normally
  }
  e.preventDefault();
  spaNavigate(target.href);
});

window.addEventListener('popstate', () => {
  spaNavigate(window.location.href, /*push*/ false);
});

window.spaNavigate = spaNavigate;

// One-time delegated click handler for index-card hot zones. Each card on
// the Problems / Search pages has a sibling <div class="search-result-hot-zone"
// data-href="..."> stacked above the actual content so the whole card area
// navigates on click. Per-card listeners get blown away when
// groupSubtopicsUnderMains() clones cards into their canonical main grid
// (cloneNode does NOT copy addEventListener-registered listeners), and were
// also fragile across SPA re-renders. Delegating once at document level is
// indestructible: bind on script load, survive every container swap.
document.addEventListener('click', (e) => {
  if (e.defaultPrevented) return;
  if (e.button !== 0) return;
  // Modifier-click → let the browser do its thing (open in tab, etc.) by
  // synthesising a real <a> behaviour: we can't, but we can at least not
  // hijack. Without an actual <a>, modifier-clicks just won't navigate —
  // that's an acceptable trade since hot-zones aren't links.
  const hot = e.target.closest('.search-result-hot-zone');
  if (!hot) return;
  const href = hot.dataset.href || hot.getAttribute('data-href');
  if (!href) return;
  // Don't fire if the click went through to an interactive child
  // (e.g. the +/- Add button, which lives in a sibling layer but
  // occasionally bubbles up through pointer events).
  if (e.target.closest('button, a, input, select, textarea')) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  // Hot zones always go to per-problem pages, which are full-reload
  // (see _isProblemPagePath rationale above the SPA click intercept).
  window.location.href = new URL(href, window.location.href).href;
}, true);


// SPA Phase 2: split data into meta + lazy bodies. Pages emit
//   window.META_URL   = "meta.<hash>.json"    — slim problem index
//   window.BODIES_URL = "bodies.<hash>.json"  — LaTeX/figure data
// bootstrapData() resolves once META is loaded so the shell + filter
// UI can render immediately on the small metadata payload (~17% of the
// old combined fetch). bootstrapBodies() runs in parallel and is what
// lazy-hydrated cards await before actually rendering their content.
//
// Legacy fallback: if a page emits only window.DATA_URL (combined
// bundle), bootstrapData fetches that and fills both globals from it.
window.__metaPromise   = null;
window.__bodiesPromise = null;

function bootstrapData() {
  if (window.__metaPromise) return window.__metaPromise;
  // Kick off bodies fetch in parallel — we don't await it here, but
  // it's ready by the time the user starts scrolling past the fold.
  bootstrapBodies();
  if (window.META_URL) {
    window.__metaPromise = fetch(window.META_URL, { cache: 'force-cache' })
      .then(r => {
        if (!r.ok) throw new Error('meta fetch failed: ' + r.status);
        return r.json();
      })
      .then(d => {
        window.PROBLEMS = (d && d.problems) || (Array.isArray(d) ? d : []);
        if (!window.PROBLEMS_LATEX) window.PROBLEMS_LATEX = {};
      })
      .catch(err => {
        console.error('meta fetch failed:', err);
        if (!Array.isArray(window.PROBLEMS)) window.PROBLEMS = [];
        if (!window.PROBLEMS_LATEX) window.PROBLEMS_LATEX = {};
      });
  } else if (window.DATA_URL) {
    // Legacy: combined fetch. Sets PROBLEMS + PROBLEMS_LATEX from one
    // file. The bodies promise is treated as already-resolved.
    window.__metaPromise = fetch(window.DATA_URL, { cache: 'force-cache' })
      .then(r => {
        if (!r.ok) throw new Error('data fetch failed: ' + r.status);
        return r.json();
      })
      .then(d => {
        window.PROBLEMS = d.problems || [];
        const existing = window.PROBLEMS_LATEX || {};
        window.PROBLEMS_LATEX = Object.assign({}, d.bodies || {}, existing);
      })
      .catch(err => {
        console.error('data fetch failed:', err);
        if (!Array.isArray(window.PROBLEMS)) window.PROBLEMS = [];
        if (!window.PROBLEMS_LATEX) window.PROBLEMS_LATEX = {};
      });
    // No separate bodies URL → bodies arrive with the combined fetch.
    window.__bodiesPromise = window.__metaPromise;
  } else {
    if (!Array.isArray(window.PROBLEMS)) window.PROBLEMS = [];
    if (!window.PROBLEMS_LATEX) window.PROBLEMS_LATEX = {};
    window.__metaPromise = Promise.resolve();
  }
  return window.__metaPromise;
}

function bootstrapBodies() {
  if (window.__bodiesPromise) return window.__bodiesPromise;
  if (!window.BODIES_URL) {
    // Legacy or no bodies URL → bootstrapData() either fills bodies
    // via the combined fetch or leaves PROBLEMS_LATEX as whatever was
    // pre-seeded.
    window.__bodiesPromise = Promise.resolve();
    return window.__bodiesPromise;
  }
  window.__bodiesPromise = fetch(window.BODIES_URL, { cache: 'force-cache' })
    .then(r => {
      if (!r.ok) throw new Error('bodies fetch failed: ' + r.status);
      return r.json();
    })
    .then(d => {
      // Keep any pre-seeded entry (problem pages inline the current
      // problem's body for fast first paint); fetched bodies fill the
      // rest.
      const existing = window.PROBLEMS_LATEX || {};
      window.PROBLEMS_LATEX = Object.assign({}, d || {}, existing);
      // Notify lazy hydrators that bodies are ready.
      window.dispatchEvent(new CustomEvent('bodies-loaded'));
    })
    .catch(err => {
      console.error('bodies fetch failed:', err);
      if (!window.PROBLEMS_LATEX) window.PROBLEMS_LATEX = {};
    });
  return window.__bodiesPromise;
}

// Master topic vocabulary — sections from the M-MAT-2026 syllabus.
// Main sections (4.x.) and subsections (4.x.y.). Each subsection's parent
// main section is stored in TOPIC_PARENT and is enforced whenever a sub
// is added (and removed when its parent is removed).
const TOPIC_MAIN = [
  "4.1 Logika",
  "4.2 Množice",
  "4.3 Števila",
  "4.4 Algebra",
  "4.5 Potence in koreni",
  "4.6 Geometrija",
  "4.7 Liki",
  "4.7b Telesa",
  "4.8 Vektorji",
  "4.9 Koordinatni sistem",
  "4.10 Funkcije",
  "4.11 Stožnice",
  "4.12 Zaporedja",
  "4.12b Vrste",
  "4.13 Odvod",
  "4.14 Integral",
  "4.15 Kombinatorika",
  "4.16 Verjetnost",
  "4.17 Statistika",
];
const TOPIC_PARENT = {
  "4.3.1 Naravna in cela števila":  "4.3 Števila",
  "4.3.2 Racionalna števila":       "4.3 Števila",
  "4.3.3 Realna števila":           "4.3 Števila",
  "4.3.4 Kompleksna števila":       "4.3 Števila",
  "4.4.1 Izrazi":                   "4.4 Algebra",
  "4.4.2 Enačbe":                   "4.4 Algebra",
  "4.4.3 Neenačbe":                 "4.4 Algebra",
  "4.6.1 Razdalja":                 "4.6 Geometrija",
  "4.6.2 Koti":                     "4.6 Geometrija",
  "4.6.3 Projekcija":               "4.6 Geometrija",
  "4.6.4 Kosinusni izrek":          "4.6 Geometrija",
  "4.6.5 Sinusni izrek":            "4.6 Geometrija",
  "4.6.6 Heronova formula":         "4.6 Geometrija",
  "4.7.1 Trikotnik":                "4.7 Liki",
  "4.7.2 Večkotnik":                "4.7 Liki",
  "4.7.3 Paralelogram":             "4.7 Liki",
  "4.7.4 Romb":                     "4.7 Liki",
  "4.7.5 Trapez":                   "4.7 Liki",
  "4.7b.1 Prizma":                  "4.7b Telesa",
  "4.7b.2 Valj":                    "4.7b Telesa",
  "4.7b.3 Piramida":                "4.7b Telesa",
  "4.7b.4 Stožec":                  "4.7b Telesa",
  "4.7b.5 Krogla":                  "4.7b Telesa",
  "4.8.1 Ravninski vektorji":       "4.8 Vektorji",
  "4.8.2 Prostorski vektorji":      "4.8 Vektorji",
  "4.10.1 Linearna funkcija":       "4.10 Funkcije",
  "4.10.2 Potenčna funkcija":       "4.10 Funkcije",
  "4.10.3 Korenska funkcija":       "4.10 Funkcije",
  "4.10.4 Kvadratna funkcija":      "4.10 Funkcije",
  "4.10.5 Eksponentna funkcija":    "4.10 Funkcije",
  "4.10.6 Logaritemska funkcija":   "4.10 Funkcije",
  "4.10.7 Polinomska funkcija":     "4.10 Funkcije",
  "4.10.8 Racionalna funkcija":     "4.10 Funkcije",
  "4.10.9 Kotne funkcije":          "4.10 Funkcije",
  "4.11.1 Elipsa":                  "4.11 Stožnice",
  "4.11.2 Parabola":                "4.11 Stožnice",
  "4.11.3 Hiperbola":               "4.11 Stožnice",
  "4.12.1 Aritmetično":             "4.12 Zaporedja",
  "4.12.2 Geometrijsko":            "4.12 Zaporedja",
  "4.12.3 Limita":                  "4.12 Zaporedja",
  "4.13.1 Ekstremi":                "4.13 Odvod",
  "4.13.2 Naraščanje":              "4.13 Odvod",
  "4.13.3 Konveksnost":             "4.13 Odvod",
};
const TOPIC_MAIN_SET = new Set(TOPIC_MAIN);
const ALL_TOPICS = [...TOPIC_MAIN, ...Object.keys(TOPIC_PARENT)];

function isMainTopic(t) { return TOPIC_MAIN_SET.has(t); }
function topicKindClass(t) { return isMainTopic(t) ? 'topic-main' : 'topic-sub'; }

// "4.X" prefix, where X is any non-space token (digits, letters, dots) so
// IDs like "4.7b Telesa" coexist with "4.10.5 …". After stripping the
// prefix, also trim trailing " funkcija/e", " števila", or " vektorji"
// (e.g. "4.10.5 Eksponentna funkcija" → "Eksponentna").
const _PREFIX_RE = /^4\.\S+\s+/;
const _FUNKCIJA_SUFFIX_RE = /\s+funkcij[ae]$/i;
const _STEVILA_SUFFIX_RE  = /\s+števila$/i;
const _VEKTORJI_SUFFIX_RE = /\s+vektorji$/i;
function displayTopicName(t) {
  return (t || '').replace(_PREFIX_RE, '')
                  .replace(_FUNKCIJA_SUFFIX_RE, '')
                  .replace(_STEVILA_SUFFIX_RE, '')
                  .replace(_VEKTORJI_SUFFIX_RE, '');
}

// Group topics so subs sit under their parent main: returns
// [{main, subs:[]}, ...]. Orphan subs (no parent in list) get { main:null }.
function buildTopicGroups(topics) {
  const sorted = sortTopics(topics);
  const groups = [];
  const mainIdx = {};
  for (const t of sorted) {
    if (isMainTopic(t)) {
      mainIdx[t] = groups.length;
      groups.push({ main: t, subs: [] });
    } else {
      const parent = TOPIC_PARENT[t];
      if (parent in mainIdx) {
        groups[mainIdx[parent]].subs.push(t);
      } else {
        groups.push({ main: null, subs: [t] });
      }
    }
  }
  return groups;
}

// Render topic chip groups into a container. Mains become rectangular boxes
// containing their sub pills. When `editable` is true each chip + the main
// label gets a × button. Orphan subs render as bare pills.
function renderTopicChipGroups(container, topics, editable) {
  container.innerHTML = '';
  function makeRemove(t) {
    const x = document.createElement('button');
    x.className = 'topic-remove';
    x.dataset.topic = t;
    x.setAttribute('aria-label', 'remove topic');
    x.textContent = '×';
    return x;
  }
  function makeSubPill(t) {
    const span = document.createElement('span');
    span.className = 'tag topic topic-sub' + (editable ? ' editable' : '');
    span.appendChild(document.createTextNode(displayTopicName(t)));
    if (editable) span.appendChild(makeRemove(t));
    return span;
  }
  for (const g of buildTopicGroups(topics)) {
    if (g.main === null) {
      for (const s of g.subs) container.appendChild(makeSubPill(s));
      continue;
    }
    const div = document.createElement('div');
    div.className = 'topic-group' + (editable ? ' editable' : '');
    const mainSpan = document.createElement('span');
    mainSpan.className = 'topic-group-main';
    const label = displayTopicName(g.main) + (g.subs.length > 0 ? ':' : '');
    mainSpan.appendChild(document.createTextNode(label));
    if (editable) mainSpan.appendChild(makeRemove(g.main));
    div.appendChild(mainSpan);
    for (const s of g.subs) div.appendChild(makeSubPill(s));
    container.appendChild(div);
  }
}

// Sort topics so mains appear in master order, with each main's subs
// immediately following in their declared order.
function sortTopics(topics) {
  const mainIdx = {};
  TOPIC_MAIN.forEach((t, i) => { mainIdx[t] = i; });
  const subList = Object.keys(TOPIC_PARENT);
  const subIdx = {};
  subList.forEach((t, i) => { subIdx[t] = i; });
  const seen = new Set(topics);
  return [...seen].sort((a, b) => {
    const aMain = isMainTopic(a) ? a : TOPIC_PARENT[a];
    const bMain = isMainTopic(b) ? b : TOPIC_PARENT[b];
    const am = mainIdx[aMain] ?? 99;
    const bm = mainIdx[bMain] ?? 99;
    if (am !== bm) return am - bm;
    // same main bucket: main first, then subs by sub-index
    const ai = isMainTopic(a) ? -1 : (subIdx[a] ?? 999);
    const bi = isMainTopic(b) ? -1 : (subIdx[b] ?? 999);
    return ai - bi;
  });
}

// Enforce parent-child constraint: every sub must have its parent.
function ensureParents(topics) {
  const out = new Set(topics);
  for (const t of [...out]) {
    const parent = TOPIC_PARENT[t];
    if (parent) out.add(parent);
  }
  return sortTopics([...out]);
}

// When removing a topic, also drop any of its currently-present children
// (so the "sub always has parent" invariant holds).
function removeTopicWithChildren(topics, toRemove) {
  return topics.filter(t => {
    if (t === toRemove) return false;
    if (TOPIC_PARENT[t] === toRemove) return false;
    return true;
  });
}

// ---------- Exam: selection + exam-list state -----------------------------
// Two browser-local lists, keyed by problem n:
//   exam-selected: Set<number>   (problems the user has gathered)
//   exam-current:  number[]      (the actual draft of the exam)
const SELECTED_KEY = 'exam-selected';
const EXAM_KEY     = 'exam-current';

function getSelected() {
  try {
    const v = JSON.parse(localStorage.getItem(SELECTED_KEY) || '[]');
    return new Set(v.map(Number));
  } catch { return new Set(); }
}
function setSelected(set) {
  localStorage.setItem(SELECTED_KEY, JSON.stringify([...set].map(Number)));
  window.dispatchEvent(new CustomEvent('selection-changed'));
}
function isSelected(n) { return getSelected().has(Number(n)); }
function addSelected(n) { const s = getSelected(); s.add(Number(n)); setSelected(s); }
function removeSelected(n) { const s = getSelected(); s.delete(Number(n)); setSelected(s); }
function toggleSelected(n) { isSelected(n) ? removeSelected(n) : addSelected(n); }

function getExam() {
  try { return JSON.parse(localStorage.getItem(EXAM_KEY) || '[]').map(Number); }
  catch { return []; }
}
function setExam(arr) {
  localStorage.setItem(EXAM_KEY, JSON.stringify(arr.map(Number)));
  window.dispatchEvent(new CustomEvent('exam-changed'));
}

// Top-bar Collection dropdown (folder icon + selected-problem count).
function initCollectionBar() {
  const bar = document.getElementById('collection-bar');
  if (!bar) return;
  const btn = bar.querySelector('#collection-toggle');
  const dd  = bar.querySelector('#collection-dropdown');
  const cnt = bar.querySelector('#collection-count');
  function refresh() {
    const sel = [...getSelected()].sort((a,b) => a-b);
    cnt.textContent = sel.length;
    dd.innerHTML = '';
    if (sel.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'collection-empty';
      empty.textContent = 'Nothing selected yet.';
      dd.appendChild(empty);
      return;
    }
    // Header row with "N selected" + Clear-all button. Sits above the
    // individual problem rows; lives inside the dropdown so it auto-hides
    // when there's nothing to clear.
    const header = document.createElement('div');
    header.className = 'collection-header';
    const summary = document.createElement('span');
    summary.className = 'collection-summary';
    summary.textContent = `${sel.length} selected`;
    header.appendChild(summary);
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'collection-clear';
    clearBtn.textContent = 'Clear';
    clearBtn.title = 'Remove every problem from the collection';
    clearBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (sel.length > 1
          && !confirm(`Clear all ${sel.length} problems from the collection?`)) {
        return;
      }
      setSelected(new Set());
    });
    header.appendChild(clearBtn);
    dd.appendChild(header);
    const latexMap = window.PROBLEMS_LATEX || {};
    for (const n of sel) {
      const row = document.createElement('div');
      row.className = 'collection-row';
      const link = document.createElement('a');
      link.href = `problems/${String(n).padStart(3,'0')}.html`;
      link.className = 'collection-link';
      const numEl = document.createElement('span');
      numEl.className = 'collection-num';
      numEl.textContent = `${n}.`;
      link.appendChild(numEl);
      const previewEl = document.createElement('span');
      previewEl.className = 'collection-preview';
      const data = latexMap[n] || latexMap[String(n)];
      if (data) {
        renderProblemBody(previewEl, {
          n: n, latex: data.latex || '',
          tikzCount: data.tikz_count || 0,
          bodyImage: data.body_image,
          tikzOriginals: data.tikz_originals || [],
        });
      } else {
        previewEl.textContent = '…';
      }
      link.appendChild(previewEl);
      row.appendChild(link);
      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'collection-remove';
      x.textContent = '×';
      x.title = 'Remove from selection';
      x.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        removeSelected(n);
      });
      row.appendChild(x);
      dd.appendChild(row);
    }
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise([dd]).catch(() => {});
    }
  }
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dd.hidden = !dd.hidden;
  });
  document.addEventListener('click', (e) => {
    if (!bar.contains(e.target)) dd.hidden = true;
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') dd.hidden = true;
  });
  window.addEventListener('selection-changed', refresh);
  window.addEventListener('storage', refresh);   // reflect cross-tab edits
  refresh();
}

// Bump this number every time the build-side bbox computation changes
// (frame-stripping, header detection, anything that moves the default
// crop). On the very next client visit we wipe every prob-N.bbox(es)
// override out of localStorage so the freshly-rebuilt defaults take
// effect — even on pages where the user previously dragged the crop by
// hand. This lets us re-crop the entire matura corpus and have every
// visitor see the new crops automatically.
const BBOX_MIGRATION_VERSION = 6;
const BBOX_MIGRATION_KEY     = 'bbox-migration-version';

function migrateLocalBboxes() {
  const stored = parseInt(localStorage.getItem(BBOX_MIGRATION_KEY) || '0', 10);
  if (stored >= BBOX_MIGRATION_VERSION) return;     // already migrated
  // 1. Drop local prob-N overrides.
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith('prob-')) continue;
    let s;
    try { s = JSON.parse(localStorage.getItem(k)); } catch { continue; }
    if (!s) continue;
    let dirty = false;
    if ('bbox' in s)   { delete s.bbox;   dirty = true; }
    if ('bboxes' in s) { delete s.bboxes; dirty = true; }
    if (dirty) {
      if (Object.keys(s).length === 0) localStorage.removeItem(k);
      else                              localStorage.setItem(k, JSON.stringify(s));
    }
  }
  // 2. Strip stale bbox/bboxes from the in-memory REMOTE_DATA copy too
  // — without this, a pushed bbox from BEFORE the new refinement
  // landed continues to win over the freshly computed default. We
  // mutate REMOTE_DATA in place so effectiveState() falls through to
  // meta.bbox_default. (data.json on the server is also wiped before
  // shipping the new build; this is the safety net for clients that
  // grab a stale data.json from a CDN cache.)
  if (REMOTE_DATA) {
    for (const k of Object.keys(REMOTE_DATA)) {
      const v = REMOTE_DATA[k];
      if (v && typeof v === 'object') {
        if ('bbox' in v)   delete v.bbox;
        if ('bboxes' in v) delete v.bboxes;
      }
    }
  }
  localStorage.setItem(BBOX_MIGRATION_KEY, String(BBOX_MIGRATION_VERSION));
}

// Drop any topics from localStorage that aren't in the current vocabulary.
// Runs once on init for every prob-N entry so legacy entries (e.g. an old
// "Complex numbers" string) disappear without manual intervention.
function migrateLocalTopics() {
  const known = new Set(ALL_TOPICS);
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith('prob-')) continue;
    let s;
    try { s = JSON.parse(localStorage.getItem(k)); } catch { continue; }
    if (!s || !Array.isArray(s.topics)) continue;
    const cleaned = s.topics.filter(t => known.has(t));
    if (cleaned.length === s.topics.length) continue;   // already clean
    if (cleaned.length === 0) delete s.topics;
    else                      s.topics = cleaned;
    localStorage.setItem(k, JSON.stringify(s));
  }
}

const GH = {
  owner: 'DanielVitas',
  repo:  'mat-naloge',
  branch: 'main',
  path: 'data.json',
  api() { return `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${this.path}`; },
};


function $(id) { return document.getElementById(id); }
function loadState(id) {
  try { return JSON.parse(localStorage.getItem('prob-' + id) || '{}'); }
  catch { return {}; }
}
function saveState(id, s) {
  localStorage.setItem('prob-' + id, JSON.stringify(s));
}
// Window-global cache so each page sees the same fetched remote data.
let REMOTE_DATA = null;       // {id: {latex, bbox, outdated}, ...}
let REMOTE_DATA_SHA = null;

function getToken() { return localStorage.getItem('gh-token') || ''; }
function setToken(t) {
  if (t) localStorage.setItem('gh-token', t);
  else   localStorage.removeItem('gh-token');
}
function getName() { return localStorage.getItem('gh-name') || ''; }
function setName(n) {
  if (n) localStorage.setItem('gh-name', n);
  else   localStorage.removeItem('gh-name');
}
// Export-only sign-in: user signed in BY NAME only (no GitHub PAT). They
// get all editing features but get an Export (JSON) button instead of Push.
function isExportOnlyMode() { return localStorage.getItem('gh-export-only') === '1'; }
function setExportOnlyMode(on) {
  if (on) localStorage.setItem('gh-export-only', '1');
  else    localStorage.removeItem('gh-export-only');
}
// Anyone is "signed in" if they have a GitHub token OR are in export-only mode
// with a saved name.
function isSignedIn() { return !!getToken() || (isExportOnlyMode() && !!getName()); }

// ---- Display-name layer ---------------------------------------------------
// Display names are keyed by GitHub login and live at top-level data.json
// under `display_names: { <login>: <name> }`. Local unsynced edits live in
// `gh-display-names` localStorage as the same shape.
function getDisplayNamesLocal() {
  try { return JSON.parse(localStorage.getItem('gh-display-names') || '{}'); }
  catch { return {}; }
}
function setDisplayNamesLocal(map) {
  if (map && Object.keys(map).length) {
    localStorage.setItem('gh-display-names', JSON.stringify(map));
  } else {
    localStorage.removeItem('gh-display-names');
  }
}
function getDisplayNamesRemote() {
  return (REMOTE_DATA && REMOTE_DATA.display_names) || {};
}
// Effective merged map: remote then local-overrides.
function effectiveDisplayNames() {
  return { ...getDisplayNamesRemote(), ...getDisplayNamesLocal() };
}
// Normalize an `approved_by` field to a deduplicated array. Old data
// stored a single login string; new data stores an array. Either shape
// (or null/undefined) is accepted; the return is always a fresh array.
function approverList(approvedBy) {
  if (!approvedBy) return [];
  const arr = Array.isArray(approvedBy) ? approvedBy : [approvedBy];
  const out = [];
  const seen = new Set();
  for (const x of arr) {
    if (typeof x !== 'string') continue;
    const t = x.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t); out.push(t);
  }
  return out;
}

// Look up the display name for a GitHub login; falls back to login itself.
function displayNameFor(login) {
  if (!login) return '';
  const map = effectiveDisplayNames();
  return map[login] || login;
}
function setMyDisplayName(name) {
  const me = getName();
  if (!me) return;
  const local = getDisplayNamesLocal();
  const remote = getDisplayNamesRemote();
  const trimmed = (name || '').trim();
  // If the new name equals the remote value (or is empty and there's no
  // remote value), drop the local override so we don't generate a phantom diff.
  if (trimmed === (remote[me] || '') || (!trimmed && !remote[me])) {
    delete local[me];
  } else {
    local[me] = trimmed;
  }
  setDisplayNamesLocal(local);
}

async function fetchRemoteData() {
  // Read data.json directly off the deployed site (no auth needed).
  try {
    const r = await fetch('data.json?_=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) { REMOTE_DATA = {}; return REMOTE_DATA; }
    REMOTE_DATA = await r.json();
  } catch { REMOTE_DATA = {}; }
  return REMOTE_DATA;
}

async function fetchRemoteSha() {
  // Use authenticated API to learn the file sha (needed for an update).
  const tok = getToken();
  if (!tok) return null;
  try {
    const r = await fetch(GH.api() + `?ref=${GH.branch}`, {
      headers: { 'Accept': 'application/vnd.github+json',
                 'Authorization': `Bearer ${tok}` },
    });
    if (!r.ok) return null;
    const j = await r.json();
    REMOTE_DATA_SHA = j.sha;
    return j.sha;
  } catch { return null; }
}

// Merge layers: remote -> local. Returns the effective state for problem id.
function effectiveState(id) {
  const r = REMOTE_DATA && REMOTE_DATA[id] ? REMOTE_DATA[id] : {};
  const l = loadState(id);
  return { ...r, ...l };
}

// ---------- Approval-only filter for signed-out viewers --------------------
// Signed-out viewers see ONLY problems that have at least one approver, so
// random visitors get a clean "verified" corpus. They can flip a toggle in
// the top-right (next to where the Sign in button used to live) to opt back
// into the full set. Signed-in viewers always see everything — they're the
// curators.
function isApproved(id) {
  const s = effectiveState(id);
  return approverList(s.approved_by).length > 0;
}
const SHOW_UNAPPROVED_KEY = 'show-unapproved';
function showUnapprovedFlag() {
  return localStorage.getItem(SHOW_UNAPPROVED_KEY) === '1';
}
function setShowUnapprovedFlag(v) {
  if (v) localStorage.setItem(SHOW_UNAPPROVED_KEY, '1');
  else   localStorage.removeItem(SHOW_UNAPPROVED_KEY);
}
// Effective check used everywhere a card is filtered. Signed-in users
// (either with token OR export-only name) skip the filter entirely;
// signed-out users honor the toggle.
function shouldShowProblem(id) {
  if (typeof isSignedIn === 'function' ? isSignedIn() : !!getToken()) return true;
  if (showUnapprovedFlag()) return true;
  return isApproved(id);
}

// Apply the filter to every pre-rendered card on the current page, then
// recompute the visible-count badges on <details> summaries and the page
// tabs. Idempotent — safe to call after every relevant state change
// (sign-in, sign-out, toggle flip, approval-chip click).
function applyApprovalFilter() {
  const wraps = document.querySelectorAll('.search-result-wrap[data-id]');
  wraps.forEach(w => {
    const id = w.dataset.id;
    const show = shouldShowProblem(id);
    w.classList.toggle('unapproved-hidden', !show);
  });
  // <details> summary counts: each .collection has a <summary> with
  // a <span class="count">(N)</span> showing the full size. We replace
  // the rendered number with the visible count and stash the total in a
  // data attribute so the original value survives.
  document.querySelectorAll('details.collection').forEach(d => {
    const span = d.querySelector(':scope > summary .count');
    if (!span) return;
    if (!span.dataset.total) {
      const m = span.textContent.match(/\d+/);
      if (m) span.dataset.total = m[0];
    }
    // Count unique problem IDs visible inside this collection (a problem
    // can repeat across season/level subtrees — the index emits one card
    // per slot, but the "total" shown on a parent only counts unique ids).
    const seen = new Set();
    d.querySelectorAll('.search-result-wrap[data-id]').forEach(w => {
      if (!w.classList.contains('unapproved-hidden')) seen.add(w.dataset.id);
    });
    span.textContent = `(${seen.size})`;
  });
  // Page-tab counts (the top "Matura (N) / Textbook (N)" buttons).
  document.querySelectorAll('.page-tab[data-tab]').forEach(btn => {
    const span = btn.querySelector('.count');
    if (!span) return;
    if (!span.dataset.total) {
      const m = span.textContent.match(/\d+/);
      if (m) span.dataset.total = m[0];
    }
    const tab = btn.dataset.tab;
    const panel = document.querySelector(`section.page-panel[data-panel="${tab}"]`);
    if (!panel) return;
    const seen = new Set();
    panel.querySelectorAll('.search-result-wrap[data-id]').forEach(w => {
      if (!w.classList.contains('unapproved-hidden')) seen.add(w.dataset.id);
    });
    span.textContent = `(${seen.size})`;
  });
  // Search page: notify listeners so they can re-render their result list.
  window.dispatchEvent(new CustomEvent('approval-filter-changed'));
}

// Return the effective topics for a problem given build-time defaults.
// Priority: localStorage.topics > remote.topics > meta.topics (defaults).
// Unknown topics (e.g. an outdated id from an old build) are filtered out.
// If filtering empties the override, fall through to defaults so the
// build-time list takes over.
function effectiveTopics(id, defaults) {
  const s = effectiveState(id);
  if (Array.isArray(s.topics)) {
    const known = new Set(ALL_TOPICS);
    const cleaned = s.topics.filter(t => known.has(t));
    if (cleaned.length > 0) return cleaned.slice();
  }
  return Array.isArray(defaults) ? defaults.slice() : [];
}

// Persist a new topics list for a problem to localStorage. Always normalizes
// (auto-includes parent main sections for any sub) and sorts.
function setTopics(id, topics) {
  const s = loadState(id);
  s.topics = ensureParents(topics || []);
  saveState(id, s);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]
  ));
}

// What the user has in localStorage that's different from the remote state.
function pendingChanges() {
  const remote = REMOTE_DATA || {};
  const out = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith('prob-')) continue;
    const id = k.replace('prob-', '');
    let local;
    try { local = JSON.parse(localStorage.getItem(k)); } catch { continue; }
    if (!local) continue;
    const r = remote[id] || {};
    // A local entry is "pending" only if at least one of the fields the user
    // actually touched differs from remote. Fields not present in `local`
    // stay in sync with remote by definition, so we don't compare them.
    // This means toggling a field back to its remote value cancels out the
    // pending-change indicator (e.g. ⚠ → ✓ → no change).
    const norm = {
      latex:       v => JSON.stringify(v),
      bbox:        v => JSON.stringify(v),
      bboxes:      v => JSON.stringify(v || null),
      outdated:    v => JSON.stringify(!!v),
      approved_by: v => JSON.stringify(v || null),
      topics:      v => JSON.stringify(v || null),
      tikz_orig:   v => JSON.stringify(v || null),
    };
    let differs = false;
    for (const f of Object.keys(norm)) {
      if (!(f in local)) continue;
      if (norm[f](local[f]) !== norm[f](r[f])) { differs = true; break; }
    }
    if (differs) out[id] = local;
  }
  // Display-name overrides count as pending changes too.
  const localNames  = getDisplayNamesLocal();
  const remoteNames = getDisplayNamesRemote();
  for (const login of Object.keys(localNames)) {
    if (localNames[login] !== (remoteNames[login] || '')) {
      out['__display_name__:' + login] = { display_name: localNames[login] };
    }
  }
  return out;
}

// Export-only mode: dump pendingChanges() to a downloadable JSON file
// that Claude (or a sync script) can apply later. Shape mirrors the
// pendingChanges() output, plus an `author` field with the reviewer name
// so server-side merge knows who made the edits.
function exportChangesAsJSON() {
  const changes = pendingChanges();
  const author  = getName() || 'anonymous';
  const payload = {
    exported_at: new Date().toISOString(),
    author: author,
    changes: changes,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)],
                         { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  a.href = url;
  a.download = `mat-naloge-changes-${author}-${ts}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function pushChanges() {
  const tok = getToken();
  if (!tok) {
    alert('Set your GitHub Personal Access Token first (the row above).');
    return false;
  }
  // Make sure we have remote and its current sha
  if (!REMOTE_DATA) await fetchRemoteData();
  await fetchRemoteSha();

  // Merge remote + local. Local wins on conflicting keys.
  const merged = JSON.parse(JSON.stringify(REMOTE_DATA || {}));
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith('prob-')) continue;
    const id = k.replace('prob-', '');
    let local;
    try { local = JSON.parse(localStorage.getItem(k)); } catch { continue; }
    if (!local) continue;
    merged[id] = { ...(merged[id] || {}), ...local };
  }
  // Merge display_names map (local overrides win).
  const mergedNames = { ...(merged.display_names || {}), ...getDisplayNamesLocal() };
  // Drop empty strings — they mean "fall back to login".
  for (const k of Object.keys(mergedNames)) {
    if (!mergedNames[k]) delete mergedNames[k];
  }
  if (Object.keys(mergedNames).length) merged.display_names = mergedNames;

  const json = JSON.stringify(merged, null, 2);
  // utf-8 safe base64 encode
  const b64 = btoa(unescape(encodeURIComponent(json)));
  const body = {
    message: `update data.json (${new Date().toISOString().replace('T',' ').slice(0,16)})`,
    content: b64,
    branch: GH.branch,
  };
  if (REMOTE_DATA_SHA) body.sha = REMOTE_DATA_SHA;

  const r = await fetch(GH.api(), {
    method: 'PUT',
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${tok}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    alert('Push failed (' + r.status + '): ' + t.slice(0, 200));
    return false;
  }
  // Success — clear local overrides; the page will reload and pull the new
  // remote state.
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && k.startsWith('prob-')) localStorage.removeItem(k);
  }
  setDisplayNamesLocal({});
  alert('Pushed. GitHub Pages will redeploy in ~30 s.');
  // give Pages a moment, then reload
  setTimeout(() => location.reload(), 1500);
  return true;
}

// Validate a token by fetching /user; returns the GitHub login on success.
async function fetchGithubLogin(token) {
  try {
    const r = await fetch('https://api.github.com/user', {
      headers: { 'Accept': 'application/vnd.github+json',
                 'Authorization': `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j.login || null;
  } catch { return null; }
}

// Always (re)fetch the reviewer name from GitHub /user. This ensures the
// name shown in the UI and used for approvals is the authoritative GitHub
// login, even if a stale value is cached from a previous version of the app.
async function ensureNameFromToken() {
  if (!getToken()) return;
  const login = await fetchGithubLogin(getToken());
  if (login && login !== getName()) setName(login);
}

// Top-left hamburger menu (shared between index and problem pages).
function initMenuBar() {
  const bar = document.getElementById('menu-bar');
  if (!bar) return;
  const btn = bar.querySelector('#menu-btn');
  const dd  = bar.querySelector('#menu-dropdown');
  if (!btn || !dd) return;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dd.hidden = !dd.hidden;
  });
  document.addEventListener('click', (e) => {
    if (!bar.contains(e.target)) dd.hidden = true;
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') dd.hidden = true;
  });
  refreshMenuBranches();
  window.addEventListener('hashchange', refreshMenuBranches);

  // Hide-or-show the trailing "Sign in" menu item based on auth state.
  // Clicking it opens the sync bar's existing sign-in dropdown so we don't
  // have to duplicate the token-input UX.
  const signinItem = bar.querySelector('#menu-signin');
  function refreshMenuSignin() {
    if (!signinItem) return;
    signinItem.hidden = !!getToken();
  }
  refreshMenuSignin();
  window.addEventListener('storage', refreshMenuSignin);
  if (signinItem) {
    signinItem.addEventListener('click', (e) => {
      e.stopPropagation();
      dd.hidden = true;
      const syncBtn = document.getElementById('gh-signin-btn');
      if (syncBtn) syncBtn.click();
    });
  }
  // Expose so the sync bar's refresh() can re-evaluate after sign-in/out.
  window.refreshMenuSignin = refreshMenuSignin;
}

// Show only menu branches that are part of the current context — the URL
// hash on the index/exam pages, or the path of the current problem on a
// problem page (detected via the .menu-current span server-rendered into
// the matching branch).
function refreshMenuBranches() {
  const hash = (location.hash || '').replace('#', '').trim();
  document.querySelectorAll('.menu-bar .menu-branch').forEach(el => {
    const branch = el.dataset.branch;
    let active = false;
    if (hash && (hash === branch || hash.startsWith(branch + '/'))) active = true;
    if (!active && el.querySelector('.menu-current')) active = true;
    if (active) el.dataset.active = 'true';
    else        delete el.dataset.active;
  });
}

// Generic page-level tab switcher. Updates aria/state on .page-tab buttons
// and shows the matching .page-panel section.
function switchTab(name) {
  if (!name) return false;
  // Scope to elements that carry the `data-tab` / `data-panel` attribute
  // so the (separate) browse-mode-tabs — which use `data-mode` — aren't
  // accidentally caught by this selector and have their active state
  // toggled off.
  const tabs   = document.querySelectorAll('.page-tab[data-tab], .exam-tab[data-tab]');
  const panels = document.querySelectorAll('.page-panel[data-panel], .exam-panel[data-panel]');
  let any = false;
  tabs.forEach(t => {
    const matches = t.dataset.tab === name;
    t.classList.toggle('active', matches);
    if (matches) any = true;
  });
  if (!any) return false;
  panels.forEach(p => { p.hidden = p.dataset.panel !== name; });
  return true;
}

// On the index page, if the URL has a hash like #matura, #textbook or
// #matura/2025/spomladanski-rok/or, switch to the matching tab and open
// any nested year/season/level <details>.
function handleSectionHash() {
  const hash = (location.hash || '').replace('#', '').trim();
  if (!hash) return;
  const parts = hash.split('/');
  // First segment selects the tab.
  switchTab(parts[0]);
  // Walk deeper segments to open nested details (year/season/level).
  if (parts.length > 1) {
    const sub = parts.slice();
    let target = null;
    while (sub.length > 1 && !target) {
      const path = sub.join('/');
      target = document.querySelector(`details.collection[data-target="${path}"]`);
      if (!target) sub.pop();
    }
    if (target) {
      let cur = target;
      while (cur) {
        if (cur.tagName === 'DETAILS') cur.open = true;
        cur = cur.parentElement;
      }
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}

// Switch the top-level Problems-page browse mode (by-source / by-topic /
// by-year). Operates on `.browse-mode-tab` buttons + `.browse-mode-panel`
// sections, scoped to the index page only — separate from `switchTab`
// which targets the Matura/Textbook sub-tabs inside the by-source panel.
function switchBrowseMode(name) {
  if (!name) return false;
  const tabs   = document.querySelectorAll('.browse-mode-tab');
  const panels = document.querySelectorAll('.browse-mode-panel');
  if (!tabs.length) return false;
  let any = false;
  tabs.forEach(t => {
    const matches = t.dataset.mode === name;
    t.classList.toggle('active', matches);
    if (matches) any = true;
  });
  if (!any) return false;
  panels.forEach(p => { p.hidden = p.dataset.mode !== name; });
  return true;
}

// Remember the user's last-selected browse-mode (Year / Topic / All)
// so the Problems page reopens in the same tab on revisits. URL hash
// still wins for deep links — saved state is only consulted when no
// explicit hash is present.
const BROWSE_MODE_KEY = 'problems-browse-mode-v1';
function readSavedBrowseMode() {
  try { return localStorage.getItem(BROWSE_MODE_KEY) || ''; }
  catch { return ''; }
}
function writeSavedBrowseMode(mode) {
  try { localStorage.setItem(BROWSE_MODE_KEY, mode); }
  catch {}
}

function bindBrowseModeTabs(defaultMode) {
  const tabs = document.querySelectorAll('.browse-mode-tab');
  if (!tabs.length) return;
  const valid = new Set(['by-source', 'by-topic', 'by-year']);
  tabs.forEach(t => {
    t.addEventListener('click', (e) => {
      e.preventDefault();
      const name = t.dataset.mode;
      if (switchBrowseMode(name)) {
        // Use hash to deep-link the mode. We don't include source-side
        // sub-tab state here — that's still owned by bindPageTabs.
        history.replaceState(null, '', '#' + name);
        // Persist for the next visit when no hash is supplied.
        if (valid.has(name)) writeSavedBrowseMode(name);
      }
    });
  });
  // Priority: URL hash > localStorage > argument default.
  const initial = (location.hash || '').replace('#', '').split('/')[0];
  const saved   = readSavedBrowseMode();
  const pick = valid.has(initial) ? initial
             : valid.has(saved)   ? saved
             :                      defaultMode;
  switchBrowseMode(pick);
}

// Wire up tab click → switch + update hash. `defaultName` is used when
// there's no hash on initial load.
function bindPageTabs(defaultName) {
  const tabs = document.querySelectorAll('.page-tab, .exam-tab');
  tabs.forEach(t => {
    t.addEventListener('click', (e) => {
      e.preventDefault();
      const name = t.dataset.tab;
      if (switchTab(name)) {
        // Update hash (without scrolling jump)
        history.replaceState(null, '', '#' + name);
      }
    });
  });
  const initial = (location.hash || '').replace('#', '').split('/')[0];
  // If the hash names a browse-mode (handled separately), switchTab will
  // fail to match and leave every page-tab inactive. Fall back to the
  // default so the inner Matura/Textbook tabs always have one active.
  if (!switchTab(initial)) switchTab(defaultName);
}

// Wire up the GitHub-sync UI block (shared between index and problem pages).
function initSyncBar() {
  const bar = document.getElementById('gh-sync');
  if (!bar) return;

  const signedOut       = bar.querySelector('#gh-signed-out');
  const signedIn        = bar.querySelector('#gh-signed-in');
  const signinBtn       = bar.querySelector('#gh-signin-btn');
  const signinDropdown  = bar.querySelector('#gh-signin-dropdown');
  const tokenInput      = bar.querySelector('#gh-token-input');
  const setBtn          = bar.querySelector('#gh-set-token');
  const cancelSigninBtn = bar.querySelector('#gh-cancel-signin');
  const pushBtn         = bar.querySelector('#gh-push');
  const menuBtn         = bar.querySelector('#gh-menu-btn');
  const userDropdown    = bar.querySelector('#gh-user-dropdown');
  const menuView        = bar.querySelector('#gh-menu-view');
  const displayForm     = bar.querySelector('#gh-display-form');
  const displayInput    = bar.querySelector('#gh-display-input');
  const displaySaveBtn  = bar.querySelector('#gh-display-save');
  const displayCancelBtn= bar.querySelector('#gh-display-cancel');
  const displayEditBtn  = bar.querySelector('#gh-display-edit');
  const displayNameEl   = bar.querySelector('#gh-display-name');
  const loginRowEl      = bar.querySelector('#gh-login-row');
  const usernameSpan    = bar.querySelector('#gh-username');
  const clearBtn        = bar.querySelector('#gh-clear-token');
  const approvalToggle  = bar.querySelector('#approval-filter-toggle');
  const discardBtn      = bar.querySelector('#gh-discard');

  // ----- Approval-only toggle (signed-out only) ---------------------------
  // aria-pressed === 'true'  → filter ON  (only approved problems)
  // aria-pressed === 'false' → showing everything
  function syncApprovalToggleUI() {
    if (!approvalToggle) return;
    const on = !showUnapprovedFlag();
    approvalToggle.setAttribute('aria-pressed', on ? 'true' : 'false');
    const label = approvalToggle.querySelector('.approval-filter-label');
    if (label) label.textContent = on ? 'Approved only' : 'All problems';
    approvalToggle.title = on
      ? 'Showing only problems approved by a reviewer. Click to show all.'
      : 'Showing all problems. Click to hide unapproved ones.';
  }
  if (approvalToggle) {
    approvalToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      setShowUnapprovedFlag(!showUnapprovedFlag());
      syncApprovalToggleUI();
      applyApprovalFilter();
    });
    syncApprovalToggleUI();
  }

  function showMenu() {
    if (menuView)    menuView.hidden    = false;
    if (displayForm) displayForm.hidden = true;
  }
  function showDisplayForm() {
    if (menuView)    menuView.hidden    = true;
    if (displayForm) displayForm.hidden = false;
    const me = getName();
    const map = effectiveDisplayNames();
    displayInput.value = me ? (map[me] || '') : '';
    setTimeout(() => displayInput.focus(), 0);
  }
  function closeDropdowns() {
    signinDropdown.hidden = true;
    userDropdown.hidden = true;
    showMenu();
  }
  function refresh() {
    const hasToken = !!getToken();
    const exportOnly = isExportOnlyMode() && !!getName() && !hasToken;
    const signedIn_  = hasToken || exportOnly;
    signedOut.hidden = signedIn_;
    signedIn.hidden  = !signedIn_;
    // Toggle body-level classes so other CSS/JS can branch on auth state.
    document.body.classList.toggle('signed-in', signedIn_);
    document.body.classList.toggle('export-only', exportOnly);
    if (!signedIn_) document.body.classList.remove('show-latex');
    if (signedIn_) {
      const login = getName();
      const dn = login ? displayNameFor(login) : '…';
      if (displayNameEl) displayNameEl.textContent = dn;
      if (usernameSpan)  usernameSpan.textContent  = login || '…';
      if (loginRowEl) {
        const showLogin = login && dn && dn !== login;
        loginRowEl.parentElement.style.display = showLogin ? '' : 'none';
      }
    }
    const n = Object.keys(pendingChanges()).length;
    // Push button: visible only when signed in WITH a GitHub token. In
    // export-only mode the wrapper hides it via CSS .export-only rule.
    pushBtn.disabled = !hasToken || n === 0;
    pushBtn.textContent = n === 0
      ? '⬆ Push'
      : `⬆ Push (${n} edit${n === 1 ? '' : 's'})`;
    // Export (JSON) button: built lazily next to Push, only shown in
    // export-only mode. Click serializes pendingChanges() to a download.
    let exportBtn = bar.querySelector('#gh-export-changes');
    if (!exportBtn && pushBtn.parentNode) {
      exportBtn = document.createElement('button');
      exportBtn.type = 'button';
      exportBtn.id = 'gh-export-changes';
      exportBtn.className = 'primary pdf-split-main';
      exportBtn.addEventListener('click', exportChangesAsJSON);
      pushBtn.parentNode.insertBefore(exportBtn, pushBtn);
    }
    if (exportBtn) {
      exportBtn.hidden = !exportOnly;
      exportBtn.disabled = n === 0;
      exportBtn.textContent = n === 0
        ? '⬇ Export'
        : `⬇ Export (${n} edit${n === 1 ? '' : 's'})`;
    }
    pushBtn.hidden = exportOnly;
    if (discardBtn) {
      discardBtn.hidden = !signedIn_ || n === 0;
      discardBtn.title  = `Discard ${n} unpushed edit${n === 1 ? '' : 's'}`;
    }
    // Approvers chip + outdated badge depend on the signed-in state, so
    // re-render them whenever the auth state changes.
    if (typeof window.refreshApprovalChip === 'function') {
      window.refreshApprovalChip();
    }
    // Hamburger-menu Sign in entry depends on the same state.
    if (typeof window.refreshMenuSignin === 'function') {
      window.refreshMenuSignin();
    }
    // Approval filter visibility depends on auth state — re-apply so
    // signed-in users always see everything and the visible counts
    // refresh accordingly. (Safe to call even when no filtered DOM
    // exists; the function just iterates a 0-length NodeList.)
    applyApprovalFilter();
  }

  // ----- Sign in flow -----
  signinBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = !signinDropdown.hidden;
    closeDropdowns();
    signinDropdown.hidden = open;          // toggle
    if (!signinDropdown.hidden) tokenInput.focus();
  });
  cancelSigninBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    signinDropdown.hidden = true;
    tokenInput.value = '';
  });
  // Name/Key tabs in the sign-in dropdown. The active tab determines
  // which sign-in mode (export-only by name vs GitHub PAT) the form uses.
  const nameInput     = bar.querySelector('#gh-name-input');
  const signinTabs    = bar.querySelectorAll('.gh-signin-tab[data-signin-tab]');
  const signinPanels  = bar.querySelectorAll('.gh-signin-tab-panel[data-signin-panel]');
  function activeSigninTab() {
    const t = bar.querySelector('.gh-signin-tab.active[data-signin-tab]');
    return t ? t.dataset.signinTab : 'name';
  }
  signinTabs.forEach(t => {
    t.addEventListener('click', (e) => {
      e.stopPropagation();
      const tab = t.dataset.signinTab;
      signinTabs.forEach(b => {
        const on = b.dataset.signinTab === tab;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      signinPanels.forEach(p => {
        p.hidden = p.dataset.signinPanel !== tab;
      });
      const focusEl = tab === 'name' ? nameInput : tokenInput;
      if (focusEl) setTimeout(() => focusEl.focus(), 0);
    });
  });
  setBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (activeSigninTab() === 'name') {
      // Export-only sign-in: just save the name.
      const nm = (nameInput && nameInput.value || '').trim();
      if (!nm) { alert('Enter your name first.'); return; }
      setExportOnlyMode(true);
      setToken('');
      setName(nm);
      if (nameInput) nameInput.value = '';
      tokenInput.value = '';
      closeDropdowns();
      refresh();
      return;
    }
    // Key tab → GitHub token flow.
    const v = tokenInput.value.trim();
    if (!v) { alert('Paste your token first.'); return; }
    setBtn.disabled = true;
    setBtn.textContent = 'Verifying…';
    const login = await fetchGithubLogin(v);
    setBtn.disabled = false;
    setBtn.textContent = 'Sign in';
    if (!login) {
      alert('Could not validate token (GitHub /user returned an error). Check the token and try again.');
      return;
    }
    setExportOnlyMode(false);
    setToken(v);
    setName(login);
    tokenInput.value = '';
    closeDropdowns();
    refresh();
  });

  // ----- Signed-in menu -----
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = !userDropdown.hidden;
    closeDropdowns();
    if (!open) {
      userDropdown.hidden = false;
      showMenu();
    }
  });
  if (displayEditBtn) {
    displayEditBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showDisplayForm();
    });
  }
  if (displaySaveBtn) {
    displaySaveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setMyDisplayName(displayInput.value);
      closeDropdowns();
      refresh();
      // Re-render any approval chip currently on screen.
      if (typeof window.refreshApprovalChip === 'function') {
        window.refreshApprovalChip();
      }
      // Re-colour index cards if we're on the index page.
      if (typeof applyIndexStatuses === 'function') applyIndexStatuses();
    });
  }
  if (displayCancelBtn) {
    displayCancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showMenu();
    });
  }
  if (displayInput) {
    displayInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter')  { e.preventDefault(); displaySaveBtn.click(); }
      if (e.key === 'Escape') { e.preventDefault(); displayCancelBtn.click(); }
    });
  }
  clearBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!confirm('Sign out?')) return;
    setToken(''); setName(''); setExportOnlyMode(false);
    closeDropdowns();
    refresh();
  });
  pushBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    closeDropdowns();
    pushBtn.disabled = true;
    pushBtn.textContent = 'Pushing…';
    const ok = await pushChanges();
    if (!ok) refresh();
  });
  if (discardBtn) {
    discardBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeDropdowns();
      const n = Object.keys(pendingChanges()).length;
      if (n === 0) return;
      const msg = (n === 1)
        ? 'Discard 1 unpushed edit? This cannot be undone.'
        : `Discard ${n} unpushed edits? This cannot be undone.`;
      if (!confirm(msg)) return;
      // Drop every prob-* override + the local display-name overrides.
      // (gh-token / gh-name stay — the sign-in survives.)
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith('prob-')) localStorage.removeItem(k);
      }
      setDisplayNamesLocal({});
      // Reload so cards/previews re-render against the cleared state.
      location.reload();
    });
  }

  // Click outside the bar closes any dropdown
  document.addEventListener('click', (e) => {
    if (!bar.contains(e.target)) closeDropdowns();
  });
  // Escape closes too
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDropdowns();
  });

  refresh();
  ensureNameFromToken().then(refresh);

  window.addEventListener('storage', refresh);
  bar._refresh = refresh;
}

// ---------------- LaTeX -> HTML (with TikZ SVG substitution) ---------------
// `hydrateTikz` (default false): pass true when the caller will follow up by
// fetching fresh SVGs from the backend. In that mode we omit the stale
// build-time <img src="…"> placeholder so the user never sees the old image
// flash through during edits. The hydrator either fills the slot from its
// per-index last-render cache (synchronously) or shows a "rendering TikZ…"
// label until the new SVG arrives.
// `tikzOriginals` (optional): array of URLs, the i-th entry is the path to
// the original cropped figure for the i-th tikzpicture block. When set,
// the resulting .tex-tikz div carries a `data-tikz-orig` attribute that
// the per-figure toggle wired by installTikzOrigToggles can swap to.
function latexToHtml(src, problemId, tikzCount, hydrateTikz, tikzOriginals) {
  if (!src) return '';
  const padded = (problemId == null) ? null : String(problemId).padStart(3, '0');
  let tikzIdx = 0;

  const stash = [];
  const stashIt = (s) => { stash.push(s); return `MJXSTASH${stash.length - 1}MJXSTASH`; };

  // Defensive sanitize: strip the optional vertical-spacing argument
  // to a LaTeX line break (`\\[2pt]`, `\\[6pt]`, …). MathJax chokes on
  // this inside `cases`/`align*` — the `[2pt]` gets read as a nested
  // display-math start and leaves the whole math block rendered as raw
  // source. The Python build strips this before emit, but stale state
  // from localStorage or remote data.json (saved before the build-side
  // fix) can still ship the broken form to the renderer, so we re-apply
  // the scrub here. The optional spacing is purely cosmetic — a bare
  // `\\` produces identical math.
  src = src.replace(/\\\\\[\s*\d+(?:\.\d+)?\s*(?:pt|em|ex|cm|mm)\s*\]/g, '\\\\');

  // Never let a line break put a comma/dot/semicolon/colon at the start
  // of the next line. Replace the space (or other whitespace) that
  // precedes one with a non-breaking space.
  src = src.replace(/[ \t]+([,.;:!?])/g, ' $1');
  src = src.replace(/\$\$([\s\S]+?)\$\$/g, (_, i) => stashIt('$$' + i + '$$'));
  src = src.replace(/\$([^\$\n]+?)\$/g,    (_, i) => stashIt('$'  + i + '$'));
  src = src.replace(/\\\[([\s\S]+?)\\\]/g, (_, i) => stashIt('\\[' + i + '\\]'));
  src = src.replace(/\\begin\{align\*?\}([\s\S]*?)\\end\{align\*?\}/g,
    (_, i) => stashIt('$$\\begin{aligned}' + i + '\\end{aligned}$$'));

  // Per-figure "show original instead of TikZ render" state for THIS
  // problem, keyed by 1-indexed figure number. Stored under prob-N
  // localStorage by the toggle button on the problem page; also
  // persisted to data.json via pendingChanges.
  const tikzOrigState = (problemId != null
                         ? (effectiveState(problemId).tikz_orig || {})
                         : {});
  src = src.replace(/\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/g, (match) => {
    tikzIdx++;
    // Encode the source so the live-preview hydrator can ship it to the
    // pdflatex backend on demand. encodeURIComponent keeps this UTF-8 safe
    // and embeddable as an attribute value.
    const enc = encodeURIComponent(match);
    const origUrl = (tikzOriginals && tikzOriginals[tikzIdx - 1]) || '';
    const showOrig = !!(origUrl && tikzOrigState[tikzIdx]);
    let initial;
    if (showOrig) {
      // User toggled THIS figure to its original cropped image. The
      // hydrator skips elements with .using-orig and the toggle button
      // shows the "TikZ render" label.
      initial = `<img class="tikz-orig-img" src="${origUrl}" alt="original figure ${tikzIdx}">`;
    } else if (hydrateTikz) {
      // Hydrator will replace this synchronously (from cache / lastSvg) or
      // asynchronously (from the backend). Showing the build-time SVG here
      // would just flash the *previous* render before the new one arrives.
      initial = `<span class="tikz-loading">rendering TikZ…</span>`;
    } else if (padded && tikzIdx <= (tikzCount || 0)) {
      const url = `tikz/prob-${padded}-fig${tikzIdx}.svg`;
      initial = `<img src="${url}" alt="TikZ figure ${tikzIdx}">`;
    } else {
      initial = `<span class="tikz-loading">rendering TikZ…</span>`;
    }
    const origAttr = origUrl ? ` data-tikz-orig="${origUrl}"` : '';
    const cls = 'tex-tikz' + (showOrig ? ' using-orig' : '');
    return `<div class="${cls}" data-tikz-idx="${tikzIdx}" data-tikz-src="${enc}"${origAttr}>${initial}</div>`;
  });

  // Track the most-recent \arraystretch value so a fill-in table (e.g.
  // \renewcommand{\arraystretch}{1.6}\begin{tabular}...) gets tall rows
  // with writing space; reset to 1 after each tabular block consumes it.
  // The combined alternation lets us strip the renewcommand AND apply its
  // value to the next tabular block in a single pass.
  {
    let pendingStretch = 1.0;
    src = src.replace(
      // The tabular spec can contain nested braces (`p{8cm}`, `m{5cm}`,
      // `b{3cm}`), so use a balanced-brace pattern instead of `[^}]+`.
      // Without this, the spec capture stops at the first `}` and the
      // remainder of the spec (e.g. `|c|c|}`) leaks into the rendered
      // body as literal text.
      /\\renewcommand\{\\arraystretch\}\{(\d+\.?\d*)\}|\\begin\{tabular\}\{((?:[^{}]|\{[^{}]*\})*)\}([\s\S]*?)\\end\{tabular\}/g,
      (_, stretchVal, _spec, body) => {
        if (stretchVal !== undefined) {
          pendingStretch = parseFloat(stretchVal) || 1.0;
          return '';
        }
        const stretch = pendingStretch;
        pendingStretch = 1.0;
        body = body.replace(/\\hline/g, '');
        const rows = body.split(/\\\\/).map(r => r.trim()).filter(Boolean);
        const fillin = stretch >= 1.5;
        // Respect the LaTeX column-spec: only show cell borders when the
        // spec contains `|` (e.g. `|c|c|`). Specs without bars (e.g.
        // `ccc`) render borderless, matching the source.
        const hasBorders = _spec && _spec.indexOf('|') !== -1;
        let cls = 'tex-tabular' + (fillin ? ' tex-tabular-fillin' : '');
        if (!hasBorders) cls += ' tex-tabular-borderless';
        const style = (stretch !== 1.0)
          ? ` style="--stretch:${stretch}"`
          : '';
        // Parse the column spec to extract per-column metadata:
        //   `p{8cm}` → fixed-width paragraph column (wraps text)
        //   `m{5cm}`, `b{3cm}` → vertically-aligned paragraph columns
        //   plain `c`, `l`, `r` → unconstrained widths
        // We strip pipes (border-tracking is already handled above).
        const colSpec = (_spec || '').replace(/\|/g, '');
        const colMeta = [];
        {
          const re = /([pmb])\{([^}]+)\}|([clr])/g;
          let mm;
          while ((mm = re.exec(colSpec)) !== null) {
            if (mm[1]) {
              colMeta.push({ kind: mm[1], width: mm[2] });
            } else {
              colMeta.push({ kind: mm[3], width: null });
            }
          }
        }
        const out = [`<table class="${cls}"${style}>`];
        for (const r of rows) {
          const cells = r.split('&').map(c => c.trim());
          // Recognise `\multicolumn{N}{spec}{content}` cells and emit
          // them as <td colspan="N">content</td>. Without this the cell
          // renders verbatim as raw LaTeX in the rendered HTML.
          out.push('<tr>' + cells.map((c, idx) => {
            const mc = c.match(/^\\multicolumn\{(\d+)\}\{[^{}]*\}\{(.*)\}$/);
            if (mc) {
              return `<td colspan="${mc[1]}">${mc[2]}</td>`;
            }
            // `\centering` is a column-level alignment directive in real
            // LaTeX (used like `>{\centering\arraybackslash}p{w}`). When
            // a transcript writes it directly inside a cell we strip the
            // token and apply text-align:center to that cell instead.
            let centered = false;
            const cleaned = c.replace(/\\centering\s*\\arraybackslash\s*/g, '')
                             .replace(/\\centering\s*/g, () => { centered = true; return ''; })
                             .trim();
            const meta = colMeta[idx];
            const styles = [];
            if (meta && meta.kind === 'p' && meta.width) {
              // Fixed-width paragraph column. CSS `width` makes the
              // column honour the size; `white-space: normal` lets text
              // wrap (otherwise `inline-block` cells can avoid wrapping).
              styles.push(`width:${meta.width}`);
              styles.push('white-space:normal');
            }
            if (centered || (meta && (meta.kind === 'c' || meta.kind === 'p'))) {
              if (centered) styles.push('text-align:center');
            }
            const styleAttr = styles.length ? ` style="${styles.join(';')}"` : '';
            return `<td${styleAttr}>${cleaned}</td>`;
          }).join('') + '</tr>');
        }
        out.push('</table>');
        // Wrap in a horizontal-scroll container so tables wider than
        // the problem panel get a scroll bar instead of overflowing the
        // surrounding chrome.
        return `<div class="tex-tabular-scroll">${out.join('')}</div>`;
      });
  }

  // Shared handler for itemize / enumerate (the only difference is the
  // wrapping element, <ul> vs <ol>). Without an enumerate branch the
  // `\begin{enumerate} ... \end{enumerate}` blocks leak through as raw
  // LaTeX (broke e.g. problem 347).
  const _listHandler = (tag) => (_, _opt, body) => {
      // Split on \item, accepting (a) plain \item followed by whitespace,
      // (b) \item[label]... with no whitespace, and (c) \item[label] with
      // whitespace after. The bracketed label, if present, becomes the
      // visible item prefix (rendered bold so a)/b)/c) markers stand out).
      // Tolerate one level of balanced {} inside the label (e.g.
      // \textbf{a)} ).
      const itemRe = /\\item(?:\[((?:[^\[\]{}]|\{[^{}]*\})*)\])?\s*/g;
      const matches = [];
      let mm;
      while ((mm = itemRe.exec(body)) !== null) {
        matches.push({ start: mm.index, end: mm.index + mm[0].length, label: mm[1] || '' });
      }
      const items = [];
      for (let i = 0; i < matches.length; i++) {
        const a = matches[i];
        const b = (i + 1 < matches.length) ? matches[i + 1].start : body.length;
        const content = body.slice(a.end, b).trim();
        if (!content && !a.label) continue;
        const prefix = a.label
          ? `<span class="tex-item-label">${a.label}</span> `
          : '';
        items.push(prefix + content);
      }
      const cls = (tag === 'ol') ? 'tex-list tex-list-ordered' : 'tex-list';
      return `<${tag} class="${cls}">` + items.map(i => `<li>${i}</li>`).join('') + `</${tag}>`;
    };

  src = src.replace(/\\begin\{itemize\}(\[[^\]]*\])?([\s\S]*?)\\end\{itemize\}/g, _listHandler('ul'));
  src = src.replace(/\\begin\{enumerate\}(\[[^\]]*\])?([\s\S]*?)\\end\{enumerate\}/g, _listHandler('ol'));

  src = src.replace(/\\begin\{center\}([\s\S]*?)\\end\{center\}/g,
    (_, inner) => `<div class="tex-center">${inner.trim()}</div>`);

  // \namigsplit{<left>}{<right>}  -> two-column dashed "Namig:" callout
  // (the textbook scans put a stacked proportion on the left and the
  // resolved formula on the right). Allows two levels of brace nesting.
  {
    const BAL = '(?:[^{}]|\\{(?:[^{}]|\\{[^{}]*\\})*\\})*';
    src = src.replace(new RegExp('\\\\namigsplit\\{(' + BAL + ')\\}\\s*\\{(' + BAL + ')\\}', 'g'),
      (_, l, r) =>
        `<div class="tex-namig tex-namig-split">` +
          `<span class="tex-namig-label">Namig:</span>` +
          `<div class="tex-namig-left">${l}</div>` +
          `<div class="tex-namig-right">${r}</div>` +
        `</div>`);
    src = src.replace(new RegExp('\\\\namig\\{(' + BAL + ')\\}', 'g'),
      (_, c) =>
        `<div class="tex-namig">` +
          `<span class="tex-namig-label">Namig:</span> ${c}` +
        `</div>`);
  }
  src = src.replace(/\\textbf\{([^{}]*)\}/g, '<strong>$1</strong>');
  src = src.replace(/\\textit\{([^{}]*)\}/g, '<em>$1</em>');
  src = src.replace(/\\emph\{([^{}]*)\}/g, '<em>$1</em>');
  src = src.replace(/\\textnormal\{([^{}]*)\}/g, '$1');
  src = src.replace(/\\fbox\{([^{}]*)\}/g, '<span class="tex-fbox">$1</span>');
  src = src.replace(/\\rule\{[^{}]+\}\{[^{}]+\}/g, '<span class="tex-rule">_____</span>');
  src = src.replace(/\\renewcommand\{[^{}]+\}\{[^{}]+\}/g, '');
  src = src.replace(/\\hfill/g, ' ');
  src = src.replace(/\\quad/g, '&nbsp;&nbsp;');
  src = src.replace(/\\,/g, '&nbsp;');
  src = src.replace(/~/g, '&nbsp;');
  src = src.replace(/\\\\/g, '<br>');

  const paras = src.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  src = paras.map(p => /^<(div|table|ul|ol|p)\b/i.test(p) ? p : `<p>${p}</p>`).join('\n');

  // Unstash math. HTML-escape `<` and `>` inside the math content
  // because the result is set via innerHTML — without escaping, a
  // fragment like `$\dfrac{3\pi}{2}<x<2\pi$` would have its `<x<`
  // parsed as an HTML start-tag and corrupt the surrounding DOM,
  // leaving the math block rendered as raw LaTeX source. MathJax
  // decodes `&lt;`/`&gt;` from text nodes back to `<`/`>` before
  // parsing, so this is safe for the rendered math.
  src = src.replace(/MJXSTASH(\d+)MJXSTASH/g, (_, i) =>
    stash[Number(i)].replace(/</g, '&lt;').replace(/>/g, '&gt;'));
  return src;
}

// ---------- Topic editor (problem page) ------------------------------------
// Renders the editable topic chips into #topics-tags: each chip has an inline
// × that removes it; a + button at the end opens a topic picker.
// When not signed in (no GitHub token AND no export-only mode), topic editing
// is disabled — chips render read-only, no × buttons, no + button.
function renderTopicsEditor(meta) {
  const row = document.getElementById('topics-tags');
  if (!row) return;
  const current = effectiveTopics(meta.n, meta.topics);
  const canEdit = (typeof isSignedIn === 'function') ? isSignedIn() : !!getToken();
  renderTopicChipGroups(row, current, /*editable*/ canEdit);
  if (!canEdit) return;
  // Append the + button at the end of the row (only when signed in).
  const addBtn = document.createElement('button');
  addBtn.className = 'topic-add';
  addBtn.id = 'topic-add';
  addBtn.setAttribute('aria-label', 'add topic');
  addBtn.title = 'Add a topic';
  addBtn.textContent = '+';
  row.appendChild(addBtn);
  // Wire × buttons.
  row.querySelectorAll('.topic-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      const t = btn.dataset.topic;
      // Removing a main section also drops all of its currently-present subs
      // so the "sub always has parent" invariant holds.
      const next = removeTopicWithChildren(
        effectiveTopics(meta.n, meta.topics), t);
      setTopics(meta.n, next);
      renderTopicsEditor(meta);
      const bar = document.getElementById('gh-sync');
      if (bar && typeof bar._refresh === 'function') bar._refresh();
    });
  });
  addBtn.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    openTopicPicker(meta, addBtn);
  });
}

function openTopicPicker(meta, anchorBtn) {
  // Close any existing picker
  const existing = document.querySelector('.topic-picker');
  if (existing) { existing.remove(); return; }
  const current = new Set(effectiveTopics(meta.n, meta.topics));
  const picker = document.createElement('div');
  picker.className = 'topic-picker';
  const search = document.createElement('input');
  search.className = 'topic-picker-search';
  search.type = 'text';
  search.placeholder = 'Filter or type a new topic…';
  picker.appendChild(search);
  const list = document.createElement('div');
  list.className = 'topic-picker-list';
  picker.appendChild(list);

  function addTopic(t) {
    t = (t || '').trim();
    if (!t) return;
    const next = effectiveTopics(meta.n, meta.topics);
    if (!next.includes(t)) next.push(t);
    setTopics(meta.n, next);
    closePicker();
    renderTopicsEditor(meta);
    const bar = document.getElementById('gh-sync');
    if (bar && typeof bar._refresh === 'function') bar._refresh();
  }

  function renderList(filter) {
    list.innerHTML = '';
    const f = filter.toLowerCase();
    function matches(t) {
      return t.toLowerCase().includes(f) ||
             displayTopicName(t).toLowerCase().includes(f);
    }
    let any = false;
    // Build groups: every main + its subs (only those not yet selected).
    for (const main of TOPIC_MAIN) {
      const subs = Object.keys(TOPIC_PARENT)
                         .filter(s => TOPIC_PARENT[s] === main);
      const mainOpen = !current.has(main) && matches(main);
      const subsOpen = subs.filter(s => !current.has(s) && matches(s));
      // Skip if both the main is already chosen and all matching subs are.
      if (!mainOpen && subsOpen.length === 0) continue;
      any = true;
      const div = document.createElement('div');
      div.className = 'picker-group';
      // The main label: clickable when not yet picked, otherwise a static
      // header (visually muted) so the user knows the group context.
      if (mainOpen) {
        const mb = document.createElement('button');
        mb.type = 'button';
        mb.className = 'picker-main';
        mb.dataset.topic = main;
        mb.textContent = displayTopicName(main)
                       + (subsOpen.length > 0 ? ':' : '');
        mb.addEventListener('click', (e) => {
          e.preventDefault(); e.stopPropagation();
          addTopic(main);
        });
        div.appendChild(mb);
      } else {
        const hdr = document.createElement('span');
        hdr.className = 'picker-main-static';
        hdr.textContent = displayTopicName(main)
                        + (subsOpen.length > 0 ? ':' : '');
        div.appendChild(hdr);
      }
      // Sub pills (only ones still unselected and matching the filter).
      if (subsOpen.length > 0) {
        const wrap = document.createElement('span');
        wrap.className = 'picker-subs';
        for (const s of subsOpen) {
          const sb = document.createElement('button');
          sb.type = 'button';
          sb.className = 'picker-sub';
          sb.dataset.topic = s;
          sb.textContent = displayTopicName(s);
          sb.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            addTopic(s);
          });
          wrap.appendChild(sb);
        }
        div.appendChild(wrap);
      }
      list.appendChild(div);
    }
    if (!any) {
      const empty = document.createElement('div');
      empty.className = 'topic-picker-empty';
      empty.textContent = 'No matches.';
      list.appendChild(empty);
    }
  }
  renderList('');
  search.addEventListener('input', () => renderList(search.value));
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closePicker(); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = search.value.trim();
      if (!q) return;
      // Add only if the query exactly matches an existing topic (display
      // name or full id). Creating brand-new topics from the webpage is
      // intentionally not supported — request additions in chat.
      const match = ALL_TOPICS.find(t =>
        !current.has(t) &&
        (t.toLowerCase() === q.toLowerCase() ||
         displayTopicName(t).toLowerCase() === q.toLowerCase()));
      if (match) addTopic(match);
    }
  });

  // Anchor + position
  document.body.appendChild(picker);
  const r = anchorBtn.getBoundingClientRect();
  picker.style.left = Math.max(8, r.left + window.scrollX) + 'px';
  picker.style.top  = (r.bottom + window.scrollY + 6) + 'px';
  setTimeout(() => search.focus(), 0);

  function closePicker() {
    picker.remove();
    document.removeEventListener('click', onDocClick, true);
  }
  function onDocClick(e) {
    if (!picker.contains(e.target) && e.target !== anchorBtn) {
      closePicker();
    }
  }
  setTimeout(() => document.addEventListener('click', onDocClick, true), 0);
}

// On the index page, rebuild each card's topic chips from effective state
// (so edits made on a problem page are reflected after navigation/push).
function applyIndexTopics() {
  document.querySelectorAll('.problem-card').forEach(card => {
    const id = card.dataset.id;
    let defaults = [];
    try { defaults = JSON.parse(card.dataset.topics || '[]'); } catch {}
    const eff = effectiveTopics(id, defaults);
    const topicsEl = card.querySelector('.tags-topics');
    if (!topicsEl) return;
    renderTopicChipGroups(topicsEl, eff, /*editable*/ false);
  });
}

// Global state for the index-card collapsible sections. Both Oznake (tags)
// and Vsebina (topics) start collapsed. Clicking any card's toggle flips
// the corresponding flag for ALL cards at once.
const cardSectionsState = { tags: false, topics: false };
function applyCardSectionsState() {
  document.querySelectorAll('.problem-card .card-section').forEach(sec => {
    const which = sec.querySelector('.card-toggle')?.dataset.section;
    if (!which) return;
    sec.dataset.expanded = String(!!cardSectionsState[which]);
  });
}
function bindCardSectionToggles() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.problem-card .card-toggle');
    if (!btn) return;
    e.preventDefault(); e.stopPropagation();
    const section = btn.dataset.section;
    if (!(section in cardSectionsState)) return;
    cardSectionsState[section] = !cardSectionsState[section];
    applyCardSectionsState();
  });
}

// Apply status-driven background colours to every card on the index page,
// based on the merged remote+local state and the current reviewer name.
// Cards may have both an "outdated" and an "approved" class — the CSS handles
// that combination with a half/half gradient.
function applyIndexStatuses() {
  const me = getName();
  document.querySelectorAll('.search-result-wrap[data-id]').forEach(wrap => {
    const card = wrap.querySelector('.search-result');
    if (!card) return;
    const id = wrap.dataset.id;
    const s = effectiveState(id);
    card.classList.remove('status-outdated', 'status-approved-me', 'status-approved-other');
    const approvers = approverList(s.approved_by);
    if (approvers.length > 0) {
      if (me && approvers.includes(me)) card.classList.add('status-approved-me');
      else                              card.classList.add('status-approved-other');
    }
    if (s.outdated) card.classList.add('status-outdated');
  });
}

// Hovering a card in a .search-results grid can expand the card downward
// past its row. When the card is in the LAST visible row of the grid, the
// expansion has nowhere to overflow into (the grid's bounds are determined
// by `grid-auto-rows: 13em`), so the bottom of the card gets clipped or
// runs off the page. This helper pads the grid bottom dynamically so the
// expanded card has room — and so the document scrollHeight grows when an
// expanded card extends below the viewport.
function adjustHoverOverflowGuard(wrap, isHovered) {
  const grid = wrap && wrap.closest('.search-results');
  const card = wrap && wrap.querySelector('.search-result');
  if (!grid || !card) return;
  if (!isHovered) {
    grid.style.paddingBottom = '';
    return;
  }
  // Measure after the next paint so the .is-hovered styles have applied.
  requestAnimationFrame(() => {
    const cardRect = card.getBoundingClientRect();
    const gridRect = grid.getBoundingClientRect();
    const overflow = cardRect.bottom - gridRect.bottom;
    // (gridRect.bottom is the bottom edge ignoring our temporary padding,
    // because padding-bottom was just cleared on enter.)
    if (overflow > 0) {
      grid.style.paddingBottom = (overflow + 12) + 'px';
    } else {
      grid.style.paddingBottom = '';
    }
  });
}

// Index-page card hydration: render LaTeX previews from window.PROBLEMS_LATEX,
// wire hover-to-expand on each .search-result-wrap, and route hot-zone
// clicks to the corresponding problem page.
//
// Phase 4 applied to the index page: card bodies are LAZY-hydrated as
// they scroll into view via IntersectionObserver. The old version
// type-set every body on every browse-mode tab on load, which made
// the Problems page block the main thread for several seconds. Now
// only the visible window pays the MathJax cost.
let _indexHydrateObserver = null;
function _hydrateOneIndexCard(body) {
  const data = window.PROBLEMS_LATEX || {};
  const n = body.dataset.id;
  const entry = data[n];
  if (!entry) return null;
  const ed = effectiveState(n);
  const latex = (ed.latex !== undefined) ? ed.latex : entry.latex;
  renderProblemBody(body, {
    n: n, latex: latex, tikzCount: entry.tikz_count || 0,
    bodyImage: entry.body_image,
    tikzOriginals: entry.tikz_originals || [],
  });
  return body;
}
function hydrateIndexCards() {
  // Tear down a previous observer if a re-hydrate is requested
  // (initIndexPage can be called twice via the SPA router).
  if (_indexHydrateObserver) { _indexHydrateObserver.disconnect(); _indexHydrateObserver = null; }
  _indexHydrateObserver = new IntersectionObserver((entries) => {
    if (!entries.some(e => e.isIntersecting)) return;
    const toRender = [];
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const body = entry.target;
      if (body.dataset.hydrated === '1') continue;
      body.dataset.hydrated = '1';
      _indexHydrateObserver.unobserve(body);
      toRender.push(body);
    }
    if (toRender.length === 0) return;
    bootstrapBodies().then(() => {
      const newBodies = [];
      for (const body of toRender) {
        const ok = _hydrateOneIndexCard(body);
        if (ok) newBodies.push(ok);
      }
      if (newBodies.length && window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise(newBodies).catch(() => {});
      }
    });
  }, {
    root: null,
    rootMargin: '600px 0px 600px 0px',
    threshold: 0,
  });
  document.querySelectorAll('.search-result-wrap[data-id] .result-body').forEach(body => {
    _indexHydrateObserver.observe(body);
  });
  // Per-card hover listeners. Idempotent via data-card-wired so re-running
  // hydrateIndexCards after an SPA navigation doesn't double-bind. (Clicks
  // are handled by the document-level delegated listener installed near
  // the top of this file — see "delegated click handler for index-card
  // hot zones" — which survives cloneNode and container swaps.)
  document.querySelectorAll('.search-result-wrap[data-id]').forEach(wrap => {
    if (wrap.dataset.cardWired === '1') return;
    const hot = wrap.querySelector('.search-result-hot-zone');
    if (!hot) return;
    wrap.dataset.cardWired = '1';
    const enter = () => {
      wrap.classList.add('is-hovered');
      adjustHoverOverflowGuard(wrap, true);
    };
    const leave = () => {
      setTimeout(() => {
        if (!hot.matches(':hover')) {
          wrap.classList.remove('is-hovered');
          adjustHoverOverflowGuard(wrap, false);
        }
      }, 0);
    };
    hot.addEventListener('mouseenter', enter);
    hot.addEventListener('mouseleave', leave);
  });
  // Defensive: kick the IntersectionObserver synchronously for cards that
  // are already in the viewport at hydrate time. After an SPA container
  // swap the observer is set up AFTER layout, and some browsers don't
  // fire entries for already-intersecting targets until the next
  // scroll/resize tick — which leaves the visible cards with empty
  // bodies until the user moves the scrollbar. We only hydrate cards
  // strictly inside the viewport here (no rootMargin), so this is at
  // most ~5-10 cards on a typical screen — cheap enough not to lag.
  requestAnimationFrame(() => {
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const toRender = [];
    document.querySelectorAll('.search-result-wrap[data-id] .result-body').forEach(body => {
      if (body.dataset.hydrated === '1') return;
      const r = body.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      body.dataset.hydrated = '1';
      if (_indexHydrateObserver) _indexHydrateObserver.unobserve(body);
      toRender.push(body);
    });
    if (toRender.length === 0) return;
    bootstrapBodies().then(() => {
      const ready = [];
      for (const body of toRender) {
        const ok = _hydrateOneIndexCard(body);
        if (ok) ready.push(ok);
      }
      if (ready.length && window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise(ready).catch(() => {});
      }
    });
  });
}

// Pick between the body-image fallback (used when no LaTeX is available)
// and the normal LaTeX-to-HTML render. Per-figure original-image toggles
// inside the LaTeX are handled by latexToHtml + installTikzOrigToggles,
// scoped to individual tikzpicture blocks rather than the whole body.
function renderProblemBody(target, opts) {
  opts = opts || {};
  const bodyImg = opts.bodyImage;
  const latex   = opts.latex || '';
  const cropMeta = opts.cropMeta;   // {page_image, page_size, bbox}
  if (!latex && cropMeta && cropMeta.page_image && cropMeta.bbox &&
      cropMeta.page_size) {
    // Live-rendered crop from page_image + bbox. This lets the preview
    // update IMMEDIATELY when the user drags the crop editor — the bbox
    // is the EFFECTIVE one (local override > remote > build default),
    // so the displayed image and the editor's selection always match.
    target.innerHTML = '<canvas class="textbook-body-img dyn-crop"></canvas>';
    const canvas = target.querySelector('canvas');
    const img = new Image();
    img.onload = () => drawCropFromImage(canvas, img, cropMeta.bbox,
                                          cropMeta.page_size);
    img.src = cropMeta.page_image;
    return;
  }
  if (bodyImg && !latex) {
    target.innerHTML = '<img class="textbook-body-img" src="'
      + bodyImg + '" alt="Exercise ' + (opts.n != null ? opts.n : '') + '">';
    return;
  }
  target.innerHTML = latexToHtml(latex, opts.n,
                                 opts.tikzCount || 0,
                                 !!opts.hydrateTikz,
                                 opts.tikzOriginals || []);
}

function renderTeXPreview(srcText, target, problemId, tikzCount, hydrateTikz,
                          tikzOriginals) {
  // Snapshot the rendered box size of every existing .tex-tikz before we
  // wipe the DOM. Saved into target._tikzLocks so the freshly-emitted
  // placeholder divs inherit the same dimensions on the very next paint —
  // otherwise the box collapses to the width of "rendering TikZ…" text.
  // We only carry forward locks taken from a real img/svg — measuring an
  // empty "rendering…" placeholder would freeze later renders at the CSS
  // min-size fallback (200×100), making the next good SVG render tiny.
  if (hydrateTikz) {
    if (!target._tikzLocks) target._tikzLocks = new Map();
    const locks = target._tikzLocks;
    target.querySelectorAll('.tex-tikz[data-tikz-idx]').forEach(el => {
      const idx = el.getAttribute('data-tikz-idx');
      if (idx == null) return;
      const inner = el.firstElementChild;
      if (!inner) return;
      const t = inner.tagName;
      if (t !== 'IMG' && t !== 'SVG' && t !== 'svg') return;
      const r = el.getBoundingClientRect();
      if (r.width > 1 && r.height > 1) locks.set(idx, { w: r.width, h: r.height });
    });
  }
  target.innerHTML = latexToHtml(srcText, problemId, tikzCount, hydrateTikz,
                                 tikzOriginals || []);
  if (window.MathJax && window.MathJax.typesetPromise) {
    MathJax.typesetPromise([target]).catch(() => {});
  }
  if (hydrateTikz) hydrateTikzInPreview(target);
}

// ---------- Live TikZ preview ----------------------------------------------
// When the user edits LaTeX containing a tikzpicture, ship the block to the
// pdflatex backend (Fly.io) and replace the placeholder/IMG with the freshly
// compiled SVG. Cached by source string so repeated renders of the same
// figure (e.g. typing in the prose around it) don't re-fetch.
const TIKZ_COMPILE_URL = 'https://mat-naloge-latex.fly.dev/tikz';
const _tikzCache = new Map();   // src -> Promise<string|null>

function fetchTikzSvg(src) {
  if (_tikzCache.has(src)) return _tikzCache.get(src);
  const p = (async () => {
    try {
      const r = await fetch(TIKZ_COMPILE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/x-latex; charset=utf-8' },
        body: src,
      });
      if (!r.ok) return null;
      return await r.text();
    } catch (_e) {
      return null;
    }
  })();
  _tikzCache.set(src, p);
  return p;
}

// Once the build-time TikZ <img>s finish loading, capture both their box
// dimensions (as locks) and their SVG text (as lastSvg). The first edit's
// hydrate then has a same-size box AND a synchronous placeholder image —
// no flicker, no collapse, no "rendering…" gap.
async function primeTikzCacheFromBuildTime(target) {
  if (!target._tikzLastSvg) target._tikzLastSvg = new Map();
  if (!target._tikzLocks)   target._tikzLocks   = new Map();
  const lastSvg = target._tikzLastSvg;
  const locks   = target._tikzLocks;
  const imgs = Array.from(target.querySelectorAll('.tex-tikz[data-tikz-idx] img[src]'));
  await Promise.all(imgs.map(async (img) => {
    const el = img.closest('.tex-tikz');
    if (!el) return;
    const idx = el.getAttribute('data-tikz-idx');
    if (idx == null) return;
    // Wait for the <img> to load so we measure the real rendered dimensions.
    if (!img.complete) {
      await new Promise(r => {
        img.addEventListener('load',  r, { once: true });
        img.addEventListener('error', r, { once: true });
      });
    }
    if (!locks.has(idx)) {
      const r = el.getBoundingClientRect();
      if (r.width > 1 && r.height > 1) locks.set(idx, { w: r.width, h: r.height });
    }
    if (!lastSvg.has(idx)) {
      try {
        const r = await fetch(img.getAttribute('src'));
        if (!r.ok) return;
        const text = await r.text();
        const head = text.trimStart().slice(0, 5).toLowerCase();
        if (head.startsWith('<?xml') || head.startsWith('<svg')) {
          lastSvg.set(idx, text);
        }
      } catch (_e) { /* offline / 404 — fine, we'll fall back to the loading
                       placeholder if/when the user edits */ }
    }
  }));
}

// Per-(preview node) state:
//   _tikzLocks:   idx -> {w, h}     (lock the figure box to a stable size)
//   _tikzLastSvg: idx -> svgString  (last successfully fetched SVG, used as
//                                    a flicker-free placeholder while the
//                                    next fetch is in flight)
// For every .tex-tikz block inside `target` that carries a
// `data-tikz-orig` attribute (i.e. a companion original cropped figure
// exists), add a small "TikZ"/"Original" toggle button pinned to the
// top-right of the figure. Clicking it flips state.tikz_orig[idx] for
// the given problem and calls refreshFn (typically the preview's own
// updatePreview) so the figure re-renders in the new mode.
function installTikzOrigToggles(target, problemId, refreshFn) {
  if (!target || problemId == null) return;
  const wraps = target.querySelectorAll('.tex-tikz[data-tikz-orig]');
  // Re-apply any captured TikZ-size lock to .using-orig wrappers so the
  // original image gets the same on-screen footprint as the compiled
  // TikZ figure. Without this the original tends to display bigger,
  // making the toggle jump between two visibly different boxes. If no
  // lock exists yet (page first loads in "original" mode), snapshot the
  // original image's rendered size once it's loaded — that becomes the
  // shared lock for both states.
  if (!target._tikzLocks) target._tikzLocks = new Map();
  const locks = target._tikzLocks;
  wraps.forEach(el => {
    if (!el.classList.contains('using-orig')) return;
    if (el.classList.contains('is-locked')) return;
    const idx = el.getAttribute('data-tikz-idx');
    if (idx == null) return;
    const lock = locks.get(idx);
    if (lock && lock.w > 1 && lock.h > 1) {
      el.style.width  = lock.w + 'px';
      el.style.height = lock.h + 'px';
      el.classList.add('is-locked');
    } else {
      const innerImg = el.querySelector(':scope > img.tikz-orig-img');
      if (!innerImg) return;
      const capture = () => {
        const r = innerImg.getBoundingClientRect();
        if (r.width > 1 && r.height > 1 && !locks.has(idx)) {
          locks.set(idx, { w: r.width, h: r.height });
          el.style.width  = r.width  + 'px';
          el.style.height = r.height + 'px';
          el.classList.add('is-locked');
        }
      };
      if (innerImg.complete) capture();
      else innerImg.addEventListener('load', capture, { once: true });
    }
  });
  wraps.forEach(el => {
    if (el.querySelector(':scope > .tikz-toggle')) return;  // already wired
    const idx    = parseInt(el.getAttribute('data-tikz-idx') || '0', 10);
    const orig   = el.getAttribute('data-tikz-orig') || '';
    if (!idx || !orig) return;
    // Read from EFFECTIVE state so a pushed default ('tikz_orig' in
    // REMOTE_DATA) shows up correctly on a fresh visit — without this
    // the toggle button would mis-label itself any time a curator had
    // already set a default.
    const cur    = !!(effectiveState(problemId).tikz_orig || {})[idx];
    const btn    = document.createElement('button');
    btn.type     = 'button';
    btn.className = 'tikz-toggle';
    btn.textContent = cur ? 'TikZ render' : 'Original';
    btn.title    = cur ? 'Show the compiled TikZ figure'
                       : 'Show the original cropped figure from the textbook';
    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      // Flip relative to the *effective* current state (which already
      // accounts for any remote-pushed default).
      const effNow = !!(effectiveState(problemId).tikz_orig || {})[idx];
      const newVal = !effNow;
      const remoteTikz = ((REMOTE_DATA && REMOTE_DATA[problemId]
                           && REMOTE_DATA[problemId].tikz_orig) || {});
      const s = loadState(problemId);
      // effectiveState merges shallowly — `local.tikz_orig` replaces
      // `remote.tikz_orig` wholesale rather than per-key. So the local
      // override must carry the FULL desired map (remote's entries +
      // every prior local override + this click) or remote's other
      // figures' defaults would silently disappear.
      const desired = { ...remoteTikz, ...(s.tikz_orig || {}) };
      desired[idx] = newVal;
      // Drop entries that match remote (treating missing as false).
      // This keeps the JSON small without affecting effective state — a
      // missing key in `desired` falls through to remote's value via
      // the shallow merge.
      for (const k of Object.keys(desired)) {
        if (!!desired[k] === !!remoteTikz[k]) delete desired[k];
      }
      // After pruning, if `desired` is empty there are no overrides at
      // all; drop the local key entirely so pendingChanges() sees no
      // tikz_orig diff and the push counter stays clean. If non-empty,
      // store it — note we still need to include any remote entries
      // that aren't being overridden so a future curator session
      // re-pushes the same complete map (see normalizer below).
      const finalLocal = (Object.keys(desired).length === 0)
                          ? null
                          : { ...remoteTikz, ...desired };
      if (finalLocal === null) {
        delete s.tikz_orig;
      } else {
        s.tikz_orig = finalLocal;
      }
      saveState(problemId, s);
      if (typeof refreshFn === 'function') refreshFn();
      const bar = document.getElementById('gh-sync');
      if (bar && typeof bar._refresh === 'function') bar._refresh();
    });
    el.appendChild(btn);
  });
}

async function hydrateTikzInPreview(target) {
  if (!target._tikzLocks)   target._tikzLocks   = new Map();
  if (!target._tikzLastSvg) target._tikzLastSvg = new Map();
  const locks   = target._tikzLocks;
  const lastSvg = target._tikzLastSvg;

  // Skip .tex-tikz blocks the user has explicitly switched to the
  // original cropped figure — there's no TikZ to compile in those.
  const els = Array.from(target.querySelectorAll(
    '.tex-tikz[data-tikz-src]:not(.using-orig)'));

  // Step 1 (fully synchronous, runs before the browser paints): apply locks
  // and inject the previous render's SVG. This is what stops the build-time
  // figure from flickering through during edits — the user sees the most
  // recent good render until the new one arrives.
  for (const el of els) {
    const idx = el.getAttribute('data-tikz-idx');
    const lock = idx != null && locks.get(idx);
    if (lock) {
      el.style.width  = lock.w + 'px';
      el.style.height = lock.h + 'px';
      el.classList.add('is-locked');
    }
    const last = idx != null && lastSvg.get(idx);
    if (last) {
      el.innerHTML = last;
      const svgEl = el.querySelector('svg');
      if (svgEl) {
        svgEl.removeAttribute('width');
        svgEl.removeAttribute('height');
      }
    }
  }

  // Step 2 (async): fetch each SVG, replace, capture lock if needed.
  await Promise.all(els.map(async (el) => {
    const enc = el.getAttribute('data-tikz-src');
    if (!enc) return;
    let src;
    try { src = decodeURIComponent(enc); } catch { return; }
    const idx = el.getAttribute('data-tikz-idx');

    // If lock not set yet AND the inner is a real figure (img / svg, not
    // the loading placeholder), snapshot its rendered size now.
    if (idx != null && !locks.has(idx)) {
      const inner = el.firstElementChild;
      if (inner && (inner.tagName === 'IMG' || inner.tagName === 'svg' || inner.tagName === 'SVG')) {
        if (inner.tagName === 'IMG' && !inner.complete) {
          await new Promise(r => {
            inner.addEventListener('load',  r, { once: true });
            inner.addEventListener('error', r, { once: true });
          });
        }
        const r = inner.getBoundingClientRect();
        if (r.width > 1 && r.height > 1) {
          locks.set(idx, { w: r.width, h: r.height });
          el.style.width  = r.width  + 'px';
          el.style.height = r.height + 'px';
          el.classList.add('is-locked');
        }
      }
    }

    const svg = await fetchTikzSvg(src);
    // Bail out if the preview was re-rendered while we waited (the el is
    // detached) or its source attribute changed mid-flight.
    if (!target.contains(el)) return;
    if (el.getAttribute('data-tikz-src') !== enc) return;
    if (!svg) {
      // Compile failed. Two display modes:
      //   • If we have a previous good render to keep visible, leave it
      //     in place (already painted by step 1's lastSvg replay) and pin
      //     a corner badge to flag that the latest source didn't compile.
      //   • If we have nothing previous to fall back on, replace the body
      //     with an explicit "TikZ failed to compile" message — and skip
      //     the badge so we don't say it twice.
      if (idx != null && lastSvg.has(idx)) {
        el.classList.add('tikz-compile-error');
      } else {
        el.classList.remove('tikz-compile-error');
        el.innerHTML = '<span class="tikz-error-msg">TikZ failed to compile</span>';
      }
      return;
    }
    el.classList.remove('tikz-compile-error');
    el.innerHTML = svg;
    if (idx != null) lastSvg.set(idx, svg);
    const svgEl = el.querySelector('svg');
    if (svgEl) {
      // If we still don't have a lock for this idx, capture the natural
      // size of the just-arrived SVG and lock to it (only happens on the
      // very first hydrate of a freshly typed tikz block).
      if (idx != null && !locks.has(idx)) {
        const r = svgEl.getBoundingClientRect();
        if (r.width > 1 && r.height > 1) {
          locks.set(idx, { w: r.width, h: r.height });
          el.style.width  = r.width  + 'px';
          el.style.height = r.height + 'px';
          el.classList.add('is-locked');
        }
      }
      // Strip the SVG's own width/height so the .is-locked CSS rule can
      // size it 100%/100% within the locked container. preserveAspectRatio
      // (default xMidYMid meet) letterboxes content if its aspect ratio
      // differs from the locked box.
      svgEl.removeAttribute('width');
      svgEl.removeAttribute('height');
    }
  }));
}

// ---------------- Crop display + editor ------------------------------------
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function drawCropFromImage(canvas, img, bbox, pageSize) {
  // pageSize may be null (image-only matura entries 2011-2016 carry
  // matura_crops/.../prob_NN.png as page_image with no page_size and no
  // bbox_default — they're already pre-cropped to the problem region).
  // In that case use the image's natural dimensions and show the whole
  // image (bbox is irrelevant).
  let imgW, imgH;
  if (Array.isArray(pageSize) && pageSize.length === 2 &&
      pageSize[0] && pageSize[1]) {
    [imgW, imgH] = pageSize;
  } else {
    imgW = img.naturalWidth || img.width || 1;
    imgH = img.naturalHeight || img.height || 1;
  }
  // If bbox is also missing/garbage (e.g. [0,0,100,100] default with no
  // real page_size), draw the full image. We detect "no useful bbox" as
  // a bbox whose extent is wildly smaller than the image — but to keep
  // this simple, just check that bbox values are within the image and
  // non-degenerate. If they aren't, fall back to full-image bounds.
  let x1, y1, x2, y2;
  if (Array.isArray(bbox) && bbox.length === 4) {
    [x1, y1, x2, y2] = bbox.map(Math.round);
    // If bbox is the [0,0,100,100] placeholder we use for missing
    // bbox_default, snap to full image bounds.
    if (x1 === 0 && y1 === 0 && x2 === 100 && y2 === 100 &&
        (imgW > 200 || imgH > 200)) {
      x1 = 0; y1 = 0; x2 = imgW; y2 = imgH;
    }
  } else {
    x1 = 0; y1 = 0; x2 = imgW; y2 = imgH;
  }
  x1 = clamp(x1, 0, imgW); x2 = clamp(x2, 0, imgW);
  y1 = clamp(y1, 0, imgH); y2 = clamp(y2, 0, imgH);
  const w = Math.max(1, x2 - x1), h = Math.max(1, y2 - y1);
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, x1, y1, w, h, 0, 0, w, h);
}

async function initProblemPage(meta) {
  await bootstrapData();
  await fetchRemoteData();
  migrateLocalTopics();
  migrateLocalBboxes();
  const id    = meta.n;
  const state = effectiveState(id);
  initMenuBar();
  initSyncBar();
  initCollectionBar();

  const ta            = $('latex-source');
  const preview       = $('preview');
  const badge         = $('status-badge');
  const approversEl   = $('approvers');
  const exportBtn     = $('export-changes');

  updateBadge(state.outdated);
  renderApprovers();
  renderTopicsEditor(meta);
  // Expose a refresh hook so changes to display names elsewhere (e.g. from
  // the dropdown) update the chip text without a reload.
  window.refreshApprovalChip = renderApprovers;
  wireExportAndBadge();

  // -------- LaTeX --------
  // Textbook problems (and any Matura problem that hasn't been transcribed
  // yet) start with empty LaTeX. We still render the same Preview / LaTeX
  // / crop layout — the preview just shows the body crop image until the
  // user types a transcript.
  //
  // If the local override is an empty string but the build-time LaTeX is
  // non-empty, fall through to the build-time value. This happens when a
  // user once cleared the textarea for a problem that later gained a
  // build-time transcript (e.g. problem 19 after _transcripts.json was
  // updated) — without this fall-through, the stale empty override would
  // hide the new transcript forever.
  if (state.latex === '' && meta.latex) {
    ta.value = meta.latex;
  } else {
    ta.value = state.latex !== undefined ? state.latex : meta.latex;
  }

  // Render the preview. Two cases:
  //   • No LaTeX yet            → body crop image (textbook fallback).
  //   • LaTeX present (default) → LaTeX → HTML render (with TikZ → SVG).
  // Per-figure original-image toggles live INSIDE each .tex-tikz block and
  // are wired by installTikzOrigToggles() after every preview render.
  // Compose the live cropMeta (page_image + EFFECTIVE bbox + page_size)
  // for the preview canvas. The bbox comes from effectiveState so the
  // preview always reflects the user's current crop selection — even
  // mid-drag in the editor. Callers refresh by re-invoking updatePreview.
  // Source-of-truth is meta.instances[0] (NOT top-level meta.page_image,
  // which isn't populated): every problem-page render builds an
  // `instances` array via the build's normalisation pass even for
  // image-only matura entries.
  function liveCropMeta() {
    const inst = (meta.instances && meta.instances[0]) || null;
    if (!inst || !inst.page_image || !inst.page_size) return null;
    const s = effectiveState(meta.n);
    let bbox = null;
    if (s.bboxes && s.bboxes[0]) bbox = s.bboxes[0].slice();
    else if (Array.isArray(s.bbox)) bbox = s.bbox.slice();
    else if (Array.isArray(inst.bbox_default)) bbox = inst.bbox_default.slice();
    if (!bbox) return null;
    return {
      page_image: inst.page_image,
      page_size:  inst.page_size,
      bbox:       bbox,
    };
  }
  function updatePreview(hydrateTikz) {
    if (!ta.value) {
      // No LaTeX yet — show the body crop. Prefer the live page-image+
      // bbox so the preview re-renders as the user drags the crop;
      // fall back to the pre-baked body_image for problems that don't
      // carry a page_image (textbook flat crops).
      const cropMeta = liveCropMeta();
      if (cropMeta) {
        renderProblemBody(preview, { n: meta.n, cropMeta: cropMeta });
      } else if (meta.body_image) {
        renderProblemBody(preview, { n: meta.n, bodyImage: meta.body_image });
      } else {
        renderTeXPreview(ta.value, preview, meta.n, meta.tikz_count, hydrateTikz,
                         meta.tikz_originals || []);
      }
    } else {
      renderTeXPreview(ta.value, preview, meta.n, meta.tikz_count, hydrateTikz,
                       meta.tikz_originals || []);
    }
    installTikzOrigToggles(preview, meta.n, () => updatePreview(false));
  }

  // On first render, only hit the /tikz backend if the LaTeX has been edited
  // away from the build-time source — otherwise the pre-rendered SVGs that
  // ship with the page are already correct and there's no point waiting for
  // a network round-trip.
  const initialHydrate = !!ta.value && ta.value !== meta.latex;
  updatePreview(initialHydrate);
  if (!initialHydrate && ta.value) {
    // Pre-fetch each build-time SVG as text and stash it as the hydrator's
    // "last successful render" for that figure. So when the user first
    // edits the LaTeX, the placeholder is filled synchronously with the
    // correct figure (instead of flashing "rendering TikZ…").
    primeTikzCacheFromBuildTime(preview);
  }

  let timer;
  ta.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const s = loadState(id);
      // Drop the override when it matches the build-time value, or when
      // the textarea is cleared on a problem that has a build-time
      // transcript. This keeps stale `state.latex = ""` from hiding the
      // baseline (see also the load-side fall-through above).
      if (ta.value === meta.latex || (ta.value === '' && meta.latex)) {
        delete s.latex;
      } else {
        s.latex = ta.value;
      }
      saveState(id, s);
      // Hydrate TikZ live: every keystroke (after debounce) re-fetches a
      // fresh SVG from pdflatex; identical sources are served from cache.
      updatePreview(!!ta.value);
      // Push counter is derived from pendingChanges() — rebuild it now so
      // the badge reflects the new edit without waiting for a page refresh.
      const bar = document.getElementById('gh-sync');
      if (bar && typeof bar._refresh === 'function') bar._refresh();
    }, 250);
  });

  // -------- Crops (one editor per instance) --------
  // localStorage layout for bboxes:
  //   state.bboxes = { "0": [x1,y1,x2,y2], "1": [...] }
  //   Legacy state.bbox migrates to state.bboxes["0"].
  function getBbox(idx, fallback) {
    const s = effectiveState(id);
    if (s.bboxes && s.bboxes[idx]) return s.bboxes[idx].slice();
    if (idx === 0 && Array.isArray(s.bbox)) return s.bbox.slice();
    return fallback ? fallback.slice() : null;
  }
  function setBbox(idx, bbox) {
    const s = loadState(id);
    s.bboxes = s.bboxes || {};
    s.bboxes[idx] = bbox.slice();
    // Drop legacy single-bbox entry once we adopt the map.
    delete s.bbox;
    saveState(id, s);
  }
  function clearBbox(idx) {
    const s = loadState(id);
    if (s.bboxes) {
      delete s.bboxes[idx];
      if (Object.keys(s.bboxes).length === 0) delete s.bboxes;
    }
    if (idx === 0) delete s.bbox;
    saveState(id, s);
  }

  // Single crop section — only one .instance-block lives in the DOM
  // and the dropdown swaps which Matura instance it is reading from in
  // place (no duplicate DOM, no hidden siblings). All the per-button
  // handlers below close over MUTABLE `activeInst` / `activeIdx`
  // variables so they always act on the currently-selected instance.
  const instances = meta.instances || [];
  const cropView    = document.getElementById('crop-view-0');
  const cropCanvas  = document.getElementById('crop-canvas-0');
  const editor      = document.getElementById('crop-editor-0');
  const fullCanvas  = document.getElementById('full-page-canvas-0');
  const selectionBox = document.getElementById('selection-box-0');
  const editBtn     = document.querySelector('.edit-crop-btn[data-instance="0"]');
  const saveBtn     = document.querySelector('.save-crop-btn[data-instance="0"]');
  const cancelBtn   = document.querySelector('.cancel-crop-btn[data-instance="0"]');
  const labelEl     = document.getElementById('instance-label');

  if (cropView && cropCanvas && instances.length > 0) {
    let activeIdx  = 0;
    let activeInst = instances[activeIdx];
    let currentBbox = getBbox(activeIdx, activeInst.bbox_default || [0, 0, 100, 100]);
    let pendingBbox = null;
    let pageLoaded = false;
    let editorScale = 1;
    let dragStart = null;
    let pageImg = new Image();

    function _instLabel(inst) {
      const pid = inst.paper_id || '';
      const yr  = /^\d{4}/.test(pid) ? pid.slice(0, 4) : '';
      // Drop the redundant "Izpitna " prefix — see the Python
      // _inst_label helper for the same shortening.
      let pola = (inst.pola || '').trim();
      if (/^izpitna\s+/i.test(pola)) pola = pola.replace(/^izpitna\s+/i, '');
      // Capitalize "pola N" → "Pola N".
      if (pola && pola[0] >= 'a' && pola[0] <= 'z') {
        pola = pola[0].toUpperCase() + pola.slice(1);
      }
      return [yr, inst.season, pola, inst.level].filter(Boolean).join(' · ');
    }

    // Re-bind everything that depends on the active instance: the page
    // image, the bbox, the label. Called once on initial load and again
    // every time the picker changes.
    function loadActiveInstance(newIdx) {
      activeIdx  = newIdx;
      activeInst = instances[activeIdx];
      currentBbox = getBbox(activeIdx, activeInst.bbox_default || [0, 0, 100, 100]);
      pendingBbox = null;
      pageLoaded = false;
      if (labelEl) labelEl.textContent = _instLabel(activeInst) || 'Original';
      // Hide editor if it was open on the previous instance.
      if (editor) editor.hidden = true;
      cropView.hidden = false;
      // Capture a LOCAL reference to this load so a stale load event
      // from a previous image (e.g. user clicks the picker twice in
      // quick succession) can't overwrite the now-current crop. We
      // also snapshot the bbox + page_size, since `currentBbox` and
      // `activeInst` may be reassigned before this image finishes
      // loading.
      const myImg  = new Image();
      const myBbox = currentBbox;
      const myPageSize = activeInst.page_size;
      const myIdx  = activeIdx;
      pageImg = myImg;
      myImg.addEventListener('load', () => {
        if (pageImg !== myImg) return;          // a newer load supersedes this
        pageLoaded = true;
        drawCropFromImage(cropCanvas, myImg, myBbox, myPageSize);
      });
      myImg.addEventListener('error', () => {
        if (pageImg !== myImg) return;
        const ctx = cropCanvas.getContext('2d');
        cropCanvas.width = 400; cropCanvas.height = 80;
        ctx.fillStyle = '#fee'; ctx.fillRect(0, 0, 400, 80);
        ctx.fillStyle = '#900';
        ctx.font = '14px sans-serif';
        ctx.fillText('(source page image not available)', 10, 45);
      });
      if (activeInst.page_image) myImg.src = activeInst.page_image;
    }

    function refresh() {
      if (pageLoaded) drawCropFromImage(cropCanvas, pageImg, currentBbox, activeInst.page_size);
    }
    function show() { cropView.hidden = true; editor.hidden = false; }
    function hide() { editor.hidden = true; cropView.hidden = false; }

    if (editBtn) editBtn.addEventListener('click', () => {
      if (!pageLoaded) return;
      pendingBbox = currentBbox.slice();
      // Make sure selection rectangle + Save are visible (in case the user
      // previously opened "Full page" mode which hid them).
      editor.classList.remove('readonly');
      if (saveBtn) saveBtn.style.display = '';
      show();
      setupEditor();
      if (saveBtn) saveBtn.disabled = false;
    });
    // "Full page" — persistent toggle. When ON, the editor shows the
    // whole page image (read-only, no bbox selection, no Save button)
    // and that preference is remembered across all problem pages. The
    // crop-view header is hidden (the editor's own header carries the
    // paper title + Cancel button instead).
    const fullPageBtn = document.querySelector('.full-page-btn[data-instance="0"]');
    function applyFullPageState() {
      const on = localStorage.getItem('full-page-on') === '1';
      document.body.classList.toggle('full-page-on', on);
      if (on && pageLoaded) {
        pendingBbox = null;
        editor.classList.add('readonly');
        if (saveBtn) saveBtn.style.display = 'none';
        // Pull the original instance label into the editor header.
        try {
          const lbl = document.getElementById('instance-label');
          const edH = editor.querySelector('.pane-header');
          if (lbl && edH) {
            let edLbl = edH.querySelector('.full-page-label');
            if (!edLbl) {
              edLbl = document.createElement('h3');
              edLbl.className = 'full-page-label';
              edLbl.style.margin = '0';
              edLbl.style.fontSize = '1rem';
              edLbl.style.fontWeight = '600';
              edH.insertBefore(edLbl, edH.firstChild);
            }
            edLbl.textContent = lbl.textContent;
          }
        } catch (_e) {}
        show();
        setupEditor();
        if (selectionBox) selectionBox.style.display = 'none';
      } else {
        editor.classList.remove('readonly');
        if (saveBtn) saveBtn.style.display = '';
        hide();
        const edLbl = editor.querySelector('.full-page-label');
        if (edLbl) edLbl.remove();
      }
      if (fullPageBtn) {
        fullPageBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
        fullPageBtn.classList.toggle('active', on);
      }
    }
    if (fullPageBtn) fullPageBtn.addEventListener('click', () => {
      const cur = localStorage.getItem('full-page-on') === '1';
      localStorage.setItem('full-page-on', cur ? '0' : '1');
      applyFullPageState();
    });
    // Apply persisted state on init (after a tick so pageImg has a chance
    // to load — if it isn't ready yet, the inline pageLoaded onload also
    // triggers a re-application).
    setTimeout(applyFullPageState, 0);
    if (cancelBtn) cancelBtn.addEventListener('click', () => {
      // In full-page mode, Cancel turns OFF the persistent toggle so the
      // user returns to the normal crop view.
      if (localStorage.getItem('full-page-on') === '1') {
        localStorage.setItem('full-page-on', '0');
        applyFullPageState();
        return;
      }
      pendingBbox = null;
      hide();
    });

    // "Edit LaTeX" — toggle the LaTeX pane back into the layout (signed-in
    // users only; the button is CSS-hidden when signed out).
    const editLatexBtn = document.querySelector('.edit-latex-btn');
    if (editLatexBtn) {
      // Initial state: persisted across page loads
      const showLatex = localStorage.getItem('show-latex') === '1';
      if (showLatex) {
        document.body.classList.add('show-latex');
        editLatexBtn.classList.add('active');
        editLatexBtn.setAttribute('aria-pressed', 'true');
      }
      editLatexBtn.addEventListener('click', () => {
        const on = document.body.classList.toggle('show-latex');
        editLatexBtn.classList.toggle('active', on);
        editLatexBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
        localStorage.setItem('show-latex', on ? '1' : '0');
      });
    }
    if (saveBtn) saveBtn.addEventListener('click', () => {
      if (!pendingBbox) return;
      currentBbox = pendingBbox.slice();
      setBbox(activeIdx, currentBbox);
      const s = loadState(id);
      s.outdated = true;
      saveState(id, s);
      updateBadge(true);
      refresh();
      hide();
      // For image-only matura previews the body pane is drawn from
      // page_image+bbox via canvas — re-render so the new crop shows
      // immediately. Only relevant when the active instance is the
      // first one (which is what the preview is keyed to).
      if (activeIdx === 0 && typeof updatePreview === 'function') {
        updatePreview(false);
      }
      const bar = document.getElementById('gh-sync');
      if (bar && typeof bar._refresh === 'function') bar._refresh();
    });
    function setupEditor() {
      const [imgW, imgH] = activeInst.page_size;
      const isFullPage = document.body.classList.contains('full-page-on');
      // Full page (read-only) mode uses the full viewport width so the
      // page reads at high resolution. Edit-crop mode keeps the smaller
      // working size (so dragging the selection is responsive on a
      // typical desktop layout).
      const viewportW = document.documentElement.clientWidth - 40;
      const viewportH = (window.innerHeight || 900) - 100;
      const maxW = isFullPage
        ? Math.min(imgW, viewportW)
        : Math.min(900, viewportW);
      const maxH = isFullPage
        ? Math.min(imgH, viewportH * 1.5)
        : 700;
      const scale = Math.min(maxW / imgW, maxH / imgH);
      editorScale = scale;
      // Render the canvas with a device-pixel-ratio multiplier so the
      // image is crisp on retina/HiDPI screens. The CSS width/height stay
      // at the layout size; the backing store is dpr× larger.
      const dpr = window.devicePixelRatio || 1;
      const cssW = Math.round(imgW * scale);
      const cssH = Math.round(imgH * scale);
      fullCanvas.style.width  = cssW + 'px';
      fullCanvas.style.height = cssH + 'px';
      fullCanvas.width  = Math.round(cssW * dpr);
      fullCanvas.height = Math.round(cssH * dpr);
      const ctx = fullCanvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, cssW, cssH);
      ctx.drawImage(pageImg, 0, 0, cssW, cssH);
      drawSelection(pendingBbox);
    }
    function drawSelection(bbox) {
      if (!bbox) { selectionBox.style.display = 'none'; return; }
      const [x1, y1, x2, y2] = bbox;
      selectionBox.style.display = 'block';
      selectionBox.style.left   = (x1 * editorScale) + 'px';
      selectionBox.style.top    = (y1 * editorScale) + 'px';
      selectionBox.style.width  = ((x2 - x1) * editorScale) + 'px';
      selectionBox.style.height = ((y2 - y1) * editorScale) + 'px';
    }
    function pointerToImage(e) {
      const rect = fullCanvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      return [
        clamp(Math.round(px / editorScale), 0, activeInst.page_size[0]),
        clamp(Math.round(py / editorScale), 0, activeInst.page_size[1]),
      ];
    }
    fullCanvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      // Read-only "Full page" mode — no bbox dragging allowed
      if (editor.classList.contains('readonly')) return;
      e.preventDefault();
      dragStart = pointerToImage(e);
      pendingBbox = [dragStart[0], dragStart[1], dragStart[0], dragStart[1]];
      drawSelection(pendingBbox);
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragStart) return;
      const [x, y] = pointerToImage(e);
      pendingBbox = [
        Math.min(dragStart[0], x), Math.min(dragStart[1], y),
        Math.max(dragStart[0], x), Math.max(dragStart[1], y),
      ];
      drawSelection(pendingBbox);
    });
    window.addEventListener('mouseup', () => { dragStart = null; });
    fullCanvas.addEventListener('touchstart', (e) => {
      if (!e.touches.length) return;
      if (editor.classList.contains('readonly')) return;
      e.preventDefault();
      dragStart = pointerToImage(e.touches[0]);
      pendingBbox = [dragStart[0], dragStart[1], dragStart[0], dragStart[1]];
      drawSelection(pendingBbox);
    }, { passive: false });
    window.addEventListener('touchmove', (e) => {
      if (!dragStart || !e.touches.length) return;
      const [x, y] = pointerToImage(e.touches[0]);
      pendingBbox = [
        Math.min(dragStart[0], x), Math.min(dragStart[1], y),
        Math.max(dragStart[0], x), Math.max(dragStart[1], y),
      ];
      drawSelection(pendingBbox);
    }, { passive: true });
    window.addEventListener('touchend', () => { dragStart = null; });

    // Initial load.
    loadActiveInstance(0);

    // Picker swaps the source. When the dropdown changes we reload the
    // active instance (image + bbox + label) in place — no DOM swap.
    const picker = document.getElementById('instance-picker');
    if (picker) {
      picker.addEventListener('change', (e) => {
        const newIdx = parseInt(e.target.value, 10);
        if (Number.isInteger(newIdx) && newIdx >= 0 && newIdx < instances.length) {
          loadActiveInstance(newIdx);
        }
      });
    }
  }

  // -------- Approve --------
  // Click the self chip to toggle whether MY login is in approved_by.
  // Other approvers are rendered as read-only chips to the left.
  async function toggleSelfApproval() {
    let myName = getName();
    if (!myName) {
      if (getToken()) await ensureNameFromToken();
      myName = getName();
    }
    if (!myName) {
      alert('Please sign in to GitHub first (Sign in button in the top-right).');
      return;
    }
    const s = loadState(id);
    // Start from the merged effective list so we don't accidentally drop
    // approvers who exist on remote but haven't been written to local yet.
    const eff = effectiveState(id);
    const cur = approverList(eff.approved_by);
    const next = cur.includes(myName)
      ? cur.filter(x => x !== myName)
      : cur.concat(myName);
    next.sort();
    s.approved_by = next.length > 0 ? next : null;
    saveState(id, s);
    renderApprovers();
    const bar = document.getElementById('gh-sync');
    if (bar && typeof bar._refresh === 'function') bar._refresh();
  }

  function renderApprovers() {
    const eff       = effectiveState(id);
    const list      = approverList(eff.approved_by);
    const me        = getName();
    const signedIn  = !!getToken() && !!me;
    const others    = signedIn ? list.filter(x => x !== me) : list.slice();
    const meIn      = signedIn && list.includes(me);

    approversEl.innerHTML = '';
    // Other approvers (read-only chips), in stable display order.
    for (const login of others.slice().sort()) {
      const chip = document.createElement('span');
      chip.className = 'approval-chip approval-chip--other';
      chip.title = login;
      chip.textContent = `${displayNameFor(login)} ✓`;
      approversEl.appendChild(chip);
    }
    // Self chip is only meaningful for signed-in users. When signed out,
    // visitors see other approvers but no toggle / status of their own.
    if (signedIn) {
      const selfChip = document.createElement('button');
      selfChip.type = 'button';
      selfChip.id   = 'self-approval-chip';
      selfChip.className = 'approval-chip approval-chip--self '
                         + (meIn ? 'is-approved' : 'is-unapproved');
      selfChip.title = meIn
        ? 'Click to remove your approval'
        : 'Click to approve';
      const label = displayNameFor(me);
      const mark  = meIn ? '✓' : '×';
      selfChip.innerHTML =
        `<span class="self-name">${escapeHtml(label)}</span>`
      + `<span class="self-mark">${mark}</span>`;
      selfChip.addEventListener('click', toggleSelfApproval);
      approversEl.appendChild(selfChip);
    }
    // The ✓/⚠ outdated badge is also signed-in-only — visitors who can't
    // push shouldn't be able to flip the flag.
    badge.hidden = !signedIn;
  }

  // Common wiring used by both Matura and Textbook problem pages:
  // status-badge toggle (Matura only — Textbook problems aren't outdate-able)
  // and the per-problem JSON export button.
  function wireExportAndBadge() {
    badge.addEventListener('click', () => {
      const s = loadState(id);
      s.outdated = !s.outdated;
      saveState(id, s);
      updateBadge(s.outdated);
      const bar = document.getElementById('gh-sync');
      if (bar && typeof bar._refresh === 'function') bar._refresh();
    });
    exportBtn.addEventListener('click', () => {
      const s = loadState(id);
      const blob = new Blob([JSON.stringify({id, ...s}, null, 2)],
        { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prob-${String(id).padStart(3,'0')}-changes.json`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    });
  }

  function updateBadge(outdated) {
    if (outdated) {
      badge.textContent = '⚠';
      badge.title = 'Transcript needs redoing — click to mark up to date';
      badge.className = 'status-badge outdated';
    } else {
      badge.textContent = '✓';
      badge.title = 'Up to date — click to flag as needing redo';
      badge.className = 'status-badge ok';
    }
  }

}

// ---------- Search page ----------------------------------------------------
// Live filter UI over window.PROBLEMS (embedded in search.html). Every filter
// input triggers re-render — there's no submit button.
async function initSearchPage(opts) {
  await bootstrapData();
  // Same function powers (a) the standalone search.html page and (b) the
  // "Add a problem" modal opened from the Finishing tab. The opts object
  // lets the caller swap out the Add-button semantics:
  //   isMarked    : (n) => bool       — show the "in" state for problem n
  //   onAdd       : (n) => void       — clicked the Add button
  //   onAddAll    : (ns) => void      — clicked "Add all"
  //   addLabel    : string            — Add-button text in default state
  //   markedLabel : string            — Add-button text in "in" state
  //   markedDisabled : bool           — disable button when "in"
  //   markedClass : string            — extra CSS class on cards in "in" state
  //   showEditLink: bool              — show the "Edit" link next to Add
  //   stateEvent  : string            — name of event to listen for to refresh
  //   skipPageInit: bool              — skip the page-level init helpers
  opts = opts || {};
  const isMarked        = opts.isMarked   || isSelected;
  const onAdd           = opts.onAdd      || toggleSelected;
  const onAddAll        = opts.onAddAll   || ((ns) => {
    const sel = getSelected(); ns.forEach(n => sel.add(n)); setSelected(sel);
  });
  const addLabel        = opts.addLabel    || '+';
  const markedLabel     = opts.markedLabel || '×';
  const markedDisabled  = !!opts.markedDisabled;
  const markedClass     = opts.markedClass || '';
  const showEditLink    = opts.showEditLink !== false;
  const stateEvent      = opts.stateEvent  || 'selection-changed';

  if (!opts.skipPageInit) {
    await fetchRemoteData();
    migrateLocalTopics();
    migrateLocalBboxes();
    initMenuBar();
    initSyncBar();
    initCollectionBar();
    await ensureNameFromToken();
  }

  const PROBLEMS = (window.PROBLEMS || []).slice();
  if (PROBLEMS.length === 0) return;

  // Helper: gather unique values across a multi-valued field per problem.
  function gather(arr, field) {
    const out = new Set();
    arr.forEach(p => (p[field] || []).forEach(v => v && out.add(v)));
    return [...out];
  }
  function flatPointsNs() {
    const out = [];
    PROBLEMS.forEach(p => (p.points_ns || []).forEach(n => out.push(n)));
    return out;
  }

  // Compute available ranges/options from data. Textbook problems carry
  // year="" (an empty string), so parseInt → NaN and Math.min over a
  // NaN-containing array returns NaN — which would render the year
  // input as empty and break the range default. Filter to valid ints.
  const yearVals = PROBLEMS.map(p => parseInt(p.year, 10)).filter(n => !isNaN(n));
  const yearMin = yearVals.length ? Math.min(...yearVals) : 0;
  const yearMax = yearVals.length ? Math.max(...yearVals) : 0;
  const ptsArr  = flatPointsNs();
  const pointsMin = ptsArr.length ? Math.min(...ptsArr) : 0;
  const pointsMax = ptsArr.length ? Math.max(...ptsArr) : 0;
  const allSources  = [...new Set(PROBLEMS.map(p => p.source).filter(Boolean))];
  const allPolas    = gather(PROBLEMS, 'polas_n').sort();
  const allLevels   = gather(PROBLEMS, 'levels')
                        .sort((a, b) => (LEVEL_ORDER_JS[a]||9) - (LEVEL_ORDER_JS[b]||9));
  const allSections = gather(PROBLEMS, 'section_letters').sort();
  // Section letters live on both Matura ("A"/"B"/"C") and Textbook
  // ("Kotne", …) problems. Split them so we can put each variant under
  // its own source-coloured panel — and so the Source toggle can hide
  // the irrelevant ones.
  function sectionsBySource(src) {
    const out = new Set();
    PROBLEMS.forEach(p => {
      if (p.source !== src) return;
      (p.section_letters || []).forEach(v => v && out.add(v));
    });
    return [...out].sort();
  }
  const maturaSections   = sectionsBySource('Matura');
  const textbookSections = sectionsBySource('Textbook');
  // Topics vocabulary = union of master + actually-used (incl any custom)
  const usedTopics = new Set();
  PROBLEMS.forEach(p => {
    effectiveTopics(p.n, p.topics).forEach(t => usedTopics.add(t));
  });
  const allTopicsArr = [...new Set([...ALL_TOPICS, ...Array.from(usedTopics)])];

  // Filter state — persisted to localStorage so the page remembers chip
  // choices across refresh. Values stored as plain arrays/numbers and
  // reconstructed into Sets on load. Stale keys (e.g. a renamed topic)
  // are silently dropped.
  const SEARCH_FILTER_KEY = (opts.filterStateKey || 'searchFilterState_v1');
  let savedState = null;
  try {
    const raw = window.localStorage && window.localStorage.getItem(SEARCH_FILTER_KEY);
    if (raw) savedState = JSON.parse(raw);
  } catch (_e) { savedState = null; }
  function pickSet(savedArr, allArr) {
    if (!Array.isArray(savedArr)) return new Set(allArr);
    const allowed = new Set(allArr);
    const out = new Set();
    savedArr.forEach(v => { if (allowed.has(v)) out.add(v); });
    return out;
  }
  function pickNum(saved, fallback) {
    const n = parseInt(saved, 10);
    return isNaN(n) ? fallback : n;
  }
  const state = savedState ? {
    yearMin:   pickNum(savedState.yearMin,   yearMin),
    yearMax:   pickNum(savedState.yearMax,   yearMax),
    pointsMin: pickNum(savedState.pointsMin, pointsMin),
    pointsMax: pickNum(savedState.pointsMax, pointsMax),
    sources:   pickSet(savedState.sources,   allSources),
    polas:     pickSet(savedState.polas,     allPolas),
    levels:    pickSet(savedState.levels,    allLevels),
    sections:  pickSet(savedState.sections,  allSections),
    topics:    pickSet(savedState.topics,    allTopicsArr),
    keyword:   (savedState.keyword || ''),
  } : {
    yearMin, yearMax, pointsMin, pointsMax,
    sources:  new Set(allSources),
    polas:    new Set(allPolas),
    levels:   new Set(allLevels),
    sections: new Set(allSections),
    topics:   new Set(allTopicsArr),
    keyword:  '',
  };
  function persistFilterState() {
    try {
      if (!window.localStorage) return;
      window.localStorage.setItem(SEARCH_FILTER_KEY, JSON.stringify({
        yearMin: state.yearMin, yearMax: state.yearMax,
        pointsMin: state.pointsMin, pointsMax: state.pointsMax,
        sources:  [...state.sources],
        polas:    [...state.polas],
        levels:   [...state.levels],
        sections: [...state.sections],
        topics:   [...state.topics],
        keyword:  state.keyword || '',
      }));
    } catch (_e) { /* private mode etc — skip */ }
  }

  // Build filter UI
  const root = document.getElementById('filters');
  if (!root) return;
  // The Source-aware panel structure: every filter cell that only
  // applies to Matura (or only to Textbook) lives inside its own
  // tinted panel. Toggling the Source chip flips a class on #filters
  // that hides the irrelevant panel — and the (CSS-hidden) cells stop
  // affecting the layout immediately.
  const hasTextbookSecs = textbookSections.length > 0;
  root.innerHTML = `
    <div class="filter-cell filter-keyword-cell">
      <label class="filter-label" for="f-keyword">Keyword</label>
      <input type="search" id="f-keyword" class="filter-keyword-input"
             placeholder="e.g. mediana, integral, …"
             autocomplete="off" spellcheck="false">
    </div>
    <div class="filter-cell filter-source-cell">
      <label class="filter-label">Source</label>
      <div class="filter-chip-group" id="f-sources">
        ${allSources.map(s => {
          // Only Matura and Textbook have a per-source filter panel — any
          // other source value gets a plain chip (no arrow).
          const slug = s === 'Matura' ? 'matura'
                      : s === 'Textbook' ? 'textbook' : '';
          const panelId = slug ? `panel-${slug}` : '';
          return `<span class="filter-source-chip-combo">`
            + `<button type="button" class="filter-chip filter-chip-source filter-chip-source-combo${slug ? ' filter-chip-source-' + slug : ''}" `
            +         `data-val="${escapeHtml(s)}" aria-pressed="true">${escapeHtml(s)}</button>`
            + (panelId
                ? `<button type="button" class="filter-source-arrow" `
                  +         `data-target="${panelId}" aria-expanded="false" `
                  +         `aria-label="Toggle ${escapeHtml(s)} filters">▾</button>`
                : '')
            + `</span>`;
        }).join('')}
      </div>
    </div>
    <div class="filter-panel filter-panel-matura" id="panel-matura" hidden>
      <div class="filter-grid">
        <div class="filter-cell">
          <label class="filter-label">Year</label>
          <div class="range-inputs">
            <input type="number" id="f-year-min" value="${yearMin}" min="${yearMin}" max="${yearMax}">
            <span>–</span>
            <input type="number" id="f-year-max" value="${yearMax}" min="${yearMin}" max="${yearMax}">
          </div>
        </div>
        <div class="filter-cell">
          <label class="filter-label">Points</label>
          <div class="range-inputs">
            <input type="number" id="f-points-min" value="${pointsMin}" min="${pointsMin}" max="${pointsMax}">
            <span>–</span>
            <input type="number" id="f-points-max" value="${pointsMax}" min="${pointsMin}" max="${pointsMax}">
          </div>
        </div>
        <div class="filter-cell">
          <label class="filter-label">Pola</label>
          <div class="filter-chip-group" id="f-polas">
            ${allPolas.map(p =>
              `<button type="button" class="filter-chip filter-chip-pola" data-val="${escapeHtml(p)}" aria-pressed="true">${escapeHtml(p)}. pola</button>`
            ).join('')}
          </div>
        </div>
        <div class="filter-cell">
          <label class="filter-label">Level</label>
          <div class="filter-chip-group" id="f-levels">
            ${allLevels.map(l =>
              `<button type="button" class="filter-chip filter-chip-level" data-val="${escapeHtml(l)}" aria-pressed="true">${escapeHtml(l)}</button>`
            ).join('')}
          </div>
        </div>
        <div class="filter-cell">
          <label class="filter-label">Section</label>
          <div class="filter-chip-group" id="f-sections-matura">
            ${maturaSections.map(s =>
              `<button type="button" class="filter-chip filter-chip-section" data-val="${escapeHtml(s)}" aria-pressed="true">${escapeHtml(s)}</button>`
            ).join('')}
          </div>
        </div>
      </div>
    </div>
    ${hasTextbookSecs ? `
    <div class="filter-panel filter-panel-textbook" id="panel-textbook" hidden>
      <div class="filter-grid">
        <div class="filter-cell">
          <label class="filter-label">Section</label>
          <div class="filter-chip-group" id="f-sections-textbook">
            ${textbookSections.map(s =>
              `<button type="button" class="filter-chip filter-chip-section filter-chip-section-textbook" data-val="${escapeHtml(s)}" aria-pressed="true">${escapeHtml(s)}</button>`
            ).join('')}
          </div>
        </div>
      </div>
    </div>` : ''}
    <div class="filter-cell topics-cell">
      <div class="filter-label-row">
        <label class="filter-label">Topics</label>
        <div class="topics-actions">
          <button type="button" class="link-btn" id="topics-all">Select all</button>
          <button type="button" class="link-btn" id="topics-none">Select none</button>
        </div>
      </div>
      <div class="filter-topic-chips" id="f-topics"></div>
    </div>
  `;

  // Wire up listeners
  function wireChipGroup(containerId, set) {
    document.getElementById(containerId).addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-chip');
      if (!btn) return;
      e.preventDefault();
      const val = btn.dataset.val;
      const next = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(next));
      if (next) set.add(val); else set.delete(val);
      // Mirror to same-kind chips in other panels (e.g. Section appears
      // in both Matura and Textbook panels backed by state.sections).
      document.querySelectorAll('#filters .filter-chip[data-val="' + CSS.escape(val) + '"]').forEach(b => {
        if (b === btn) return;
        const sameKind = btn.className.split(' ').some(c =>
          c.startsWith('filter-chip-') && b.classList.contains(c));
        if (sameKind) b.setAttribute('aria-pressed', String(next));
      });
      persistFilterState();
      render();
    });
  }

  // Reconcile every chip's aria-pressed with the (possibly-restored) state
  // so a refreshed page shows the user's last chip picks rather than
  // "everything on".
  function reconcileChipsToState() {
    function flip(containerId, set) {
      const root = document.getElementById(containerId);
      if (!root) return;
      root.querySelectorAll('.filter-chip').forEach(btn => {
        btn.setAttribute('aria-pressed', set.has(btn.dataset.val) ? 'true' : 'false');
      });
    }
    flip('f-sources',  state.sources);
    flip('f-polas',    state.polas);
    flip('f-levels',   state.levels);
    flip('f-sections-matura',   state.sections);
    flip('f-sections-textbook', state.sections);
  }
  reconcileChipsToState();
  // Restore numeric range inputs from saved state too.
  ['f-year-min','f-year-max','f-points-min','f-points-max'].forEach((id, i) => {
    const v = [state.yearMin, state.yearMax, state.pointsMin, state.pointsMax][i];
    const el = document.getElementById(id);
    if (el && !isNaN(v)) el.value = v;
  });

  ['f-year-min','f-year-max','f-points-min','f-points-max'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      state.yearMin   = parseInt(document.getElementById('f-year-min').value, 10);
      state.yearMax   = parseInt(document.getElementById('f-year-max').value, 10);
      state.pointsMin = parseInt(document.getElementById('f-points-min').value, 10);
      state.pointsMax = parseInt(document.getElementById('f-points-max').value, 10);
      persistFilterState();
      render();
    });
  });
  // Keyword search input — debounce slightly so render() doesn't fire
  // on every keystroke.
  const kwInput = document.getElementById('f-keyword');
  if (kwInput) {
    if (state.keyword) kwInput.value = state.keyword;
    let kwTimer = null;
    kwInput.addEventListener('input', () => {
      clearTimeout(kwTimer);
      kwTimer = setTimeout(() => {
        state.keyword = kwInput.value.trim();
        persistFilterState();
        render();
      }, 150);
    });
  }
  wireChipGroup('f-sources',  state.sources);
  wireChipGroup('f-polas',    state.polas);
  wireChipGroup('f-levels',   state.levels);
  wireChipGroup('f-sections-matura',   state.sections);
  if (document.getElementById('f-sections-textbook')) {
    wireChipGroup('f-sections-textbook', state.sections);
  }

  // Source-toggle → show/hide the Matura / Textbook filter panels.
  // We add a class on #filters that CSS uses to display:none the
  // corresponding .filter-panel. Hidden cells stop contributing to the
  // visible filter UI; their chip-state survives, so re-enabling the
  // source restores whatever the user had picked before.
  function syncSourcePanels() {
    root.classList.toggle('no-matura',   !state.sources.has('Matura'));
    root.classList.toggle('no-textbook', !state.sources.has('Textbook'));
  }
  syncSourcePanels();
  document.getElementById('f-sources').addEventListener('click', syncSourcePanels);

  // Source-chip dropdown arrow → expand/collapse the matching filter
  // panel. The arrow lives INSIDE the Source row as a sibling of the
  // toggling chip, so we stop propagation to avoid double-triggering
  // the chip-group click handler (which would deselect the source).
  // Only one panel is open at a time — opening one closes the other.
  const allArrows = document.querySelectorAll('.filter-source-arrow');
  allArrows.forEach(arrow => {
    arrow.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const target = document.getElementById(arrow.dataset.target);
      if (!target) return;
      const willOpen = !!target.hidden;   // current is closed → open it
      // Close every panel + reset every arrow first.
      allArrows.forEach(a => {
        const t = document.getElementById(a.dataset.target);
        if (t) t.hidden = true;
        a.setAttribute('aria-expanded', 'false');
      });
      // Then open the requested one (if we were opening, not toggling-off).
      if (willOpen) {
        target.hidden = false;
        arrow.setAttribute('aria-expanded', 'true');
      }
    });
  });
  // Topic filter: hierarchical groups with synced parent/sub toggle.
  // - Parent is "selected" iff every one of its subs is selected (or, for a
  //   parent with no subs, iff the parent itself is in state.topics).
  // - Click parent → if currently all-selected, deselect parent + all subs;
  //   else select parent + all subs.
  // - Click a sub → toggle just that sub. Then recompute parent: if all subs
  //   are now selected the parent becomes selected (and is added to the
  //   filter set); otherwise the parent is removed from the filter set.
  function subsOf(parent) {
    return Object.keys(TOPIC_PARENT).filter(s => TOPIC_PARENT[s] === parent);
  }
  function parentSelected(parent) {
    const subs = subsOf(parent);
    if (subs.length === 0) return state.topics.has(parent);
    return subs.every(s => state.topics.has(s));
  }
  function setParent(parent, selected) {
    const subs = subsOf(parent);
    if (selected) {
      state.topics.add(parent);
      for (const s of subs) state.topics.add(s);
    } else {
      state.topics.delete(parent);
      for (const s of subs) state.topics.delete(s);
    }
  }
  function syncParentForSub(sub) {
    const parent = TOPIC_PARENT[sub];
    if (!parent) return;
    if (parentSelected(parent)) state.topics.add(parent);
    else                        state.topics.delete(parent);
  }

  function renderTopicFilters() {
    const root = document.getElementById('f-topics');
    if (!root) return;
    root.innerHTML = '';
    // Vocab groups: every main from TOPIC_MAIN, with its subs from TOPIC_PARENT
    const groups = [];
    const mainIdx = {};
    TOPIC_MAIN.forEach(m => { mainIdx[m] = groups.length; groups.push({main: m, subs: []}); });
    Object.keys(TOPIC_PARENT).forEach(s => {
      const p = TOPIC_PARENT[s];
      if (p in mainIdx) groups[mainIdx[p]].subs.push(s);
    });
    for (const g of groups) {
      const div = document.createElement('div');
      div.className = 'filter-topic-group';
      div.dataset.pressed = parentSelected(g.main) ? 'true' : 'false';
      const mainBtn = document.createElement('button');
      mainBtn.type = 'button';
      mainBtn.className = 'filter-chip-main';
      mainBtn.dataset.topic = g.main;
      mainBtn.setAttribute('aria-pressed', parentSelected(g.main) ? 'true' : 'false');
      mainBtn.textContent = displayTopicName(g.main) + (g.subs.length > 0 ? ':' : '');
      mainBtn.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        setParent(g.main, !parentSelected(g.main));
        persistFilterState();
        renderTopicFilters();
        render();
      });
      div.appendChild(mainBtn);
      if (g.subs.length > 0) {
        const subsWrap = document.createElement('span');
        subsWrap.className = 'filter-group-subs';
        for (const s of g.subs) {
          const sb = document.createElement('button');
          sb.type = 'button';
          sb.className = 'filter-chip-sub';
          sb.dataset.topic = s;
          sb.setAttribute('aria-pressed', state.topics.has(s) ? 'true' : 'false');
          sb.textContent = displayTopicName(s);
          sb.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            if (state.topics.has(s)) state.topics.delete(s);
            else                     state.topics.add(s);
            syncParentForSub(s);
            persistFilterState();
            renderTopicFilters();
            render();
          });
          subsWrap.appendChild(sb);
        }
        div.appendChild(subsWrap);
      }
      root.appendChild(div);
    }
  }
  renderTopicFilters();

  document.getElementById('topics-all').addEventListener('click', () => {
    state.topics = new Set(allTopicsArr);
    persistFilterState();
    renderTopicFilters();
    render();
  });
  document.getElementById('topics-none').addEventListener('click', () => {
    state.topics.clear();
    persistFilterState();
    renderTopicFilters();
    render();
  });

  // Keyword filter helper. Strips common LaTeX wrappers ($...$, \frac{}{},
  // \begin{}/end{}, comments, control sequences) before matching to make
  // results closer to "what the rendered problem says". Case-insensitive,
  // accent-insensitive substring match. Cached per problem.
  const _kwCache = {};
  function kwHaystack(n) {
    if (n in _kwCache) return _kwCache[n];
    const bodies = (window.PROBLEMS_LATEX || {});
    const entry  = bodies[n] || {};
    const ed     = (typeof effectiveState === 'function') ? effectiveState(n) : {};
    let latex    = (ed && ed.latex !== undefined) ? ed.latex : (entry.latex || '');
    // Strip LaTeX control sequences and braces; keep alphanumerics + spaces.
    let plain = latex
      .replace(/\\[a-zA-Z]+\*?/g, ' ')   // \command, \command*
      .replace(/[{}\[\]]/g, ' ')          // braces and brackets
      .replace(/\$+/g, ' ')               // math delimiters
      .replace(/%[^\n]*/g, ' ')           // comments
      .replace(/\s+/g, ' ')
      .toLowerCase()
      // Slovenian diacritics → plain so "mediana" matches "mediano"-style.
      .replace(/[čć]/g, 'c').replace(/š/g, 's').replace(/ž/g, 'z').replace(/đ/g, 'd');
    _kwCache[n] = plain;
    return plain;
  }

  // Filter + render. A problem matches if its scalar fields are in range
  // and at least one value of each multi-valued field is selected.
  function matches(p) {
    // Approval gate: signed-out viewers see only approved problems by
    // default (toggle in the top-right opts back into the full set).
    if (!shouldShowProblem(p.n)) return false;
    if (!state.sources.has(p.source)) return false;
    // Keyword (substring) filter — applies to all sources. Empty = no filter.
    if (state.keyword) {
      const kw = state.keyword.toLowerCase()
                  .replace(/[čć]/g,'c').replace(/š/g,'s').replace(/ž/g,'z').replace(/đ/g,'d')
                  .trim();
      if (kw && !kwHaystack(p.n).includes(kw)) return false;
    }
    // Textbook problems don't carry the Matura-paper fields (year, season,
    // pola, level, section letter, points), so skip those filters and only
    // honour Source + Topic. (Topics will be filterable once they're tagged.)
    if (p.source === 'Textbook') {
      const topics = effectiveTopics(p.n, p.topics);
      if (topics.length === 0) {
        if (state.topics.size !== allTopicsArr.length) return false;
      } else if (!topics.some(t => state.topics.has(t))) {
        return false;
      }
      return true;
    }
    const yr = parseInt(p.year, 10);
    if (!isNaN(yr) && (yr < state.yearMin || yr > state.yearMax)) return false;
    // Empty multi-value arrays mean "no parsed metadata" — fall
    // through rather than exclude (matura_extra image-only problems
    // carry empty section_letters / polas_n / points_ns).
    const pointsNs = p.points_ns || [];
    if (pointsNs.length > 0 &&
        !pointsNs.some(n => n >= state.pointsMin && n <= state.pointsMax))
      return false;
    const polasN = p.polas_n || [];
    if (polasN.length > 0 && !polasN.some(v => state.polas.has(v))) return false;
    const levels = p.levels || [];
    if (levels.length > 0 && !levels.some(v => state.levels.has(v))) return false;
    const secs = p.section_letters || [];
    if (secs.length > 0 && !secs.some(v => state.sections.has(v))) return false;
    const topics = effectiveTopics(p.n, p.topics);
    if (topics.length === 0) {
      // No topics → only matches if every topic is selected (i.e., no filter)
      if (state.topics.size !== allTopicsArr.length) return false;
    } else if (!topics.some(t => state.topics.has(t))) {
      return false;
    }
    return true;
  }

  const resultsEl = document.getElementById('search-results');
  const countEl   = document.getElementById('result-count');

  // Save the most recent filtered set so "Add all" knows what to add.
  let lastMatches = [];

  // ----- SPA Phase 4: lazy hydration ---------------------------------------
  // Render cycle: build ALL card shells (cheap — just <div>s with the
  // number and Add button), but DEFER the heavy work (LaTeX/figure
  // injection + MathJax typeset) until a card actually scrolls into the
  // viewport. An IntersectionObserver hands us a card the moment its
  // wrap-element gets within `rootMargin` of the viewport, we hydrate
  // it once, then unobserve. This is what keeps the search page snappy
  // when the filtered set is hundreds (or eventually thousands) of
  // problems — the DOM is light, MathJax never touches off-screen
  // cards, and the user only pays for what they actually see.
  let _hydrateObserver = null;
  function _ensureHydrateObserver() {
    if (_hydrateObserver) return _hydrateObserver;
    _hydrateObserver = new IntersectionObserver((entries) => {
      const toRender = [];
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const wrap = entry.target;
        if (wrap.dataset.hydrated === '1') continue;
        wrap.dataset.hydrated = '1';
        _hydrateObserver.unobserve(wrap);
        toRender.push(wrap);
      }
      if (toRender.length === 0) return;
      // Wait until the bodies bundle is loaded before rendering. With
      // Phase 4's `rootMargin: 600px`, this is almost always already
      // resolved by the time the user can scroll a card into view —
      // bootstrapBodies() kicks off at page-load — but await guarantees
      // we never render an empty body.
      bootstrapBodies().then(() => {
        const bodies = window.PROBLEMS_LATEX || {};
        const newBodies = [];
        for (const wrap of toRender) {
          const n = Number(wrap.dataset.n);
          const p = window.__problemsByN ? window.__problemsByN[n] : null;
          if (!p) continue;
          const body = wrap.querySelector('.result-body');
          if (!body) continue;
          // Phase 2: body fields (latex, tikz_count, body_image,
          // tikz_originals) live in PROBLEMS_LATEX. Fall back to the
          // problem record itself for older builds where meta still
          // carried them.
          const bd = bodies[String(p.n)] || {};
          const ed = effectiveState(p.n);
          const latex = (ed.latex !== undefined)
            ? ed.latex
            : (bd.latex !== undefined ? bd.latex : p.latex);
          renderProblemBody(body, {
            n: p.n,
            latex: latex,
            tikzCount: (bd.tikz_count != null ? bd.tikz_count : (p.tikz_count || 0)),
            bodyImage: bd.body_image || p.body_image,
            tikzOriginals: bd.tikz_originals || p.tikz_originals || [],
          });
          newBodies.push(body);
        }
        if (newBodies.length && window.MathJax && window.MathJax.typesetPromise) {
          window.MathJax.typesetPromise(newBodies).catch(() => {});
        }
      });
    }, {
      // Pre-load cards up to one viewport-height ahead of the user so
      // scrolling never reveals an un-rendered card.
      root: null,
      rootMargin: '600px 0px 600px 0px',
      threshold: 0,
    });
    return _hydrateObserver;
  }

  function render() {
    const out = PROBLEMS.filter(matches);
    lastMatches = out;
    countEl.textContent = `${out.length} of ${PROBLEMS.length} problems`;
    // Index for the observer callback so it can look up problem data
    // by `n` without scanning the array.
    window.__problemsByN = {};
    for (const p of PROBLEMS) window.__problemsByN[p.n] = p;
    // Tear down the previous observer — its targets are about to be
    // detached from the DOM.
    if (_hydrateObserver) { _hydrateObserver.disconnect(); _hydrateObserver = null; }
    resultsEl.innerHTML = out.map(p => {
      const sel = isMarked(p.n);
      const cls = sel ? ('is-selected ' + markedClass).trim() : '';
      const dis = sel && markedDisabled ? 'disabled' : '';
      const href = showEditLink
        ? `problems/${String(p.n).padStart(3,'0')}.html` : '';
      const dataHref = href ? `data-href="${href}"` : '';
      return `<div class="search-result-wrap" data-n="${p.n}">
        <div class="search-result-hot-zone" ${dataHref}></div>
        <div class="search-result ${sel && markedClass ? markedClass : ''}">
          <span class="result-num">${p.n}.</span>
          <div class="result-body" data-id="${p.n}" data-tikz="${p.tikz_count || 0}"></div>
          <div class="result-actions">
            <button type="button" class="result-add ${cls}" data-n="${p.n}" ${dis}>${sel ? markedLabel : addLabel}</button>
          </div>
        </div>
      </div>`;
    }).join('');
    // Observe every wrap; hydration happens lazily as they scroll in.
    const obs = _ensureHydrateObserver();
    resultsEl.querySelectorAll('.search-result-wrap').forEach(wrap => {
      obs.observe(wrap);
      // Hover state — same JS as before, attaches eagerly so the card
      // expands the moment the cursor enters even before hydration.
      const hot    = wrap.querySelector('.search-result-hot-zone');
      const addBtn = wrap.querySelector('.result-add');
      const targets = [hot, addBtn].filter(Boolean);
      const enter = () => {
        wrap.classList.add('is-hovered');
        adjustHoverOverflowGuard(wrap, true);
      };
      const leave = () => {
        setTimeout(() => {
          const stillIn = targets.some(t => t.matches(':hover'));
          if (!stillIn) {
            wrap.classList.remove('is-hovered');
            adjustHoverOverflowGuard(wrap, false);
          }
        }, 0);
      };
      targets.forEach(t => {
        t.addEventListener('mouseenter', enter);
        t.addEventListener('mouseleave', leave);
      });
    });
    refreshAddAll();
  }

  function refreshAddAll() {
    const btn = document.getElementById('add-all-btn');
    if (!btn) return;
    const remaining = lastMatches.filter(p => !isMarked(p.n)).length;
    if (remaining === 0 && lastMatches.length > 0) {
      btn.textContent = `All ${lastMatches.length} already added`;
      btn.disabled = true;
    } else {
      btn.textContent = `+ Add all (${remaining})`;
      btn.disabled = lastMatches.length === 0;
    }
  }

  // Event delegation: Add/Remove buttons; otherwise click on the card
  // body navigates to the problem page (when data-href is set).
  resultsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.result-add');
    if (btn) {
      if (btn.disabled) return;
      e.preventDefault();
      e.stopPropagation();
      const n = Number(btn.dataset.n);
      onAdd(n);
      const nowSel = isMarked(n);
      btn.classList.toggle('is-selected', nowSel);
      btn.textContent = nowSel ? markedLabel : addLabel;
      if (markedDisabled) btn.disabled = nowSel;
      if (markedClass) {
        const card = btn.closest('.search-result');
        if (card) card.classList.toggle(markedClass, nowSel);
      }
      refreshAddAll();
      return;
    }
    // Click anywhere on the body (passes through to the hot zone) →
    // navigate to the problem page (search page only — no data-href in
    // modal mode).
    const hot = e.target.closest('.search-result-hot-zone');
    if (hot && hot.dataset.href) {
      window.location.href = hot.dataset.href;
    }
  });

  // Add N random — picks N random problems from the filtered set that
  // aren't already in the target state.
  const addRandomBtn = document.getElementById('add-random-btn');
  const addRandomN   = document.getElementById('add-random-n');
  if (addRandomBtn && addRandomN) {
    addRandomBtn.addEventListener('click', () => {
      const n = Math.max(1, parseInt(addRandomN.value, 10) || 1);
      const eligible = lastMatches.filter(p => !isMarked(p.n));
      if (eligible.length === 0) return;
      const shuffled = eligible.slice();
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const chosen = shuffled.slice(0, Math.min(n, shuffled.length));
      onAddAll(chosen.map(p => p.n));
      // Update visible buttons that we just acted on
      chosen.forEach(p => {
        const b = resultsEl.querySelector('.result-add[data-n="' + p.n + '"]');
        if (!b) return;
        if (isMarked(p.n)) {
          b.classList.add('is-selected');
          b.textContent = markedLabel;
          if (markedDisabled) b.disabled = true;
          if (markedClass) {
            const card = b.closest('.search-result');
            if (card) card.classList.add(markedClass);
          }
        }
      });
      refreshAddAll();
    });
  }

  // Add-all button
  const addAllBtn = document.getElementById('add-all-btn');
  if (addAllBtn) {
    addAllBtn.addEventListener('click', () => {
      onAddAll(lastMatches.map(p => p.n).filter(n => !isMarked(n)));
      // Update visible buttons
      resultsEl.querySelectorAll('.result-add').forEach(b => {
        const n = Number(b.dataset.n);
        if (isMarked(n)) {
          b.classList.add('is-selected');
          b.textContent = markedLabel;
          if (markedDisabled) b.disabled = true;
          if (markedClass) {
            const card = b.closest('.search-result');
            if (card) card.classList.add(markedClass);
          }
        }
      });
      refreshAddAll();
    });
  }
  // Re-render when the approval filter flips (top-right toggle, or sign-in
  // state changes). The matches() gate above reads the current state, so
  // calling render() is enough to re-filter the list.
  window.addEventListener('approval-filter-changed', () => render());
  // Update Add/Remove button text when state changes anywhere else.
  window.addEventListener(stateEvent, () => {
    resultsEl.querySelectorAll('.result-add').forEach(b => {
      const n = Number(b.dataset.n);
      const sel = isMarked(n);
      b.classList.toggle('is-selected', sel);
      b.textContent = sel ? markedLabel : addLabel;
      if (markedDisabled) b.disabled = sel;
      if (markedClass) {
        const card = b.closest('.search-result');
        if (card) card.classList.toggle(markedClass, sel);
      }
    });
    refreshAddAll();
  });

  render();
}

// JS-side level order for sorting.
const LEVEL_ORDER_JS = { OR: 0, VR: 1 };

// ---------- Exam page -----------------------------------------------------
async function initExamPage() {
  await bootstrapData();
  await fetchRemoteData();
  initMenuBar();
  initSyncBar();
  initCollectionBar();
  await ensureNameFromToken();

  const PROBLEMS = (window.PROBLEMS || []).slice();
  const byN = {};
  for (const p of PROBLEMS) byN[p.n] = p;

  // The Exam page used to have Selection + Finishing tabs; the
  // Selection tab is gone. The page is now a single Finishing view.
  initFinishing(byN);
  return;

  function renderProblemRow(p, actions) {
    // actions: array of { label, onClick, kind (optional), title }
    const row = document.createElement('div');
    row.className = 'exam-row';
    const num = document.createElement('span');
    num.className = 'result-num';
    num.textContent = p.n + '.';
    row.appendChild(num);
    const body = document.createElement('div');
    body.className = 'result-body';
    body.innerHTML = (() => {
      const ed = effectiveState(p.n);
      const latex = (ed.latex !== undefined) ? ed.latex : p.latex;
      return latexToHtml(latex, p.n, p.tikz_count || 0);
    })();
    row.appendChild(body);
    const acts = document.createElement('div');
    acts.className = 'result-actions';
    for (const a of actions) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'exam-action ' + (a.kind || '');
      btn.textContent = a.label;
      if (a.title) btn.title = a.title;
      btn.addEventListener('click', a.onClick);
      acts.appendChild(btn);
    }
    row.appendChild(acts);
    return row;
  }

  function pickRandomFromSelected(excludeSet) {
    const sel = [...getSelected()].filter(n => !excludeSet.has(n));
    if (sel.length === 0) return null;
    return sel[Math.floor(Math.random() * sel.length)];
  }

  function renderSelected() {
    const list = document.getElementById('selected-list');
    const cnt  = document.getElementById('selected-count');
    list.innerHTML = '';
    const sel = [...getSelected()].sort((a,b) => a-b);
    cnt.textContent = sel.length;
    if (sel.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'exam-empty';
      empty.textContent = 'No problems selected. Use the Search tab to add some.';
      list.appendChild(empty);
    } else {
      for (const n of sel) {
        const p = byN[n];
        if (!p) continue;
        const exam = new Set(getExam());
        list.appendChild(renderProblemRow(p, [
          { label: exam.has(n) ? 'In exam' : 'Choose →',
            kind: exam.has(n) ? 'is-disabled' : 'primary',
            onClick: () => {
              const cur = getExam();
              if (cur.includes(n)) return;
              cur.push(n);
              setExam(cur);
              renderAll();
            } },
          { label: 'Remove',
            kind: 'warn',
            title: 'Remove from selection',
            onClick: () => { removeSelected(n); } },
        ]));
      }
    }
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise([list]).catch(() => {});
    }
  }

  function renderExam() {
    const list = document.getElementById('exam-list');
    const cnt  = document.getElementById('exam-count');
    list.innerHTML = '';
    const exam = getExam();
    cnt.textContent = exam.length;
    if (exam.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'exam-empty';
      empty.textContent = 'Empty. Use Choose N random or a problem’s Choose button.';
      list.appendChild(empty);
    } else {
      exam.forEach((n, idx) => {
        const p = byN[n];
        if (!p) return;
        list.appendChild(renderProblemRow(p, [
          { label: 'Reroll',
            kind: 'primary',
            onClick: () => {
              const cur = getExam();
              const exclude = new Set(cur.filter((_, i) => i !== idx));
              const replacement = pickRandomFromSelected(exclude);
              if (replacement === null) return;
              cur[idx] = replacement;
              setExam(cur);
              renderAll();
            } },
          { label: 'Remove',
            kind: 'warn',
            title: 'Remove from exam',
            onClick: () => {
              const cur = getExam().filter((_, i) => i !== idx);
              setExam(cur);
              renderAll();
            } },
        ]));
      });
    }
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise([list]).catch(() => {});
    }
  }

  function renderAll() {
    renderSelected();
    renderExam();
  }
  window.addEventListener('selection-changed', renderAll);
  window.addEventListener('exam-changed', renderAll);

  // "Choose N random problems"
  document.getElementById('random-btn').addEventListener('click', () => {
    const n = Math.max(1, parseInt(document.getElementById('random-n').value, 10) || 1);
    const sel = [...getSelected()];
    if (sel.length === 0) { alert('No selected problems to choose from.'); return; }
    // Fisher-Yates shuffle, then take first n
    for (let i = sel.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [sel[i], sel[j]] = [sel[j], sel[i]];
    }
    setExam(sel.slice(0, Math.min(n, sel.length)));
    renderAll();
  });

  // "Create an exam" → switch to Finishing tab
  document.getElementById('create-exam-btn').addEventListener('click', () => {
    showTab('finishing');
  });

  renderAll();
  initFinishing(byN);
}

// ---------- Exam → Finishing tab -----------------------------------------
function initFinishing(byN) {
  const tex     = document.getElementById('finishing-tex');
  const preview = document.getElementById('finishing-preview');
  const headAdds = document.getElementById('finishing-heading-adds');
  if (!tex || !preview) return;

  // Definitions for the heading items shown next to "Preview" when not active.
  const HEADING_DEFS = [
    { key: 'title',   label: 'Title' },
    { key: 'name',    label: 'Ime' },
    { key: 'surname', label: 'Priimek' },
    { key: 'points',  label: 'Točke' },
    { key: 'grade',   label: 'Ocena' },
  ];

  function renderHeadingAdds() {
    if (!headAdds) return;
    headAdds.innerHTML = '';
    for (const d of HEADING_DEFS) {
      if (headingState[d.key]) continue;       // already in the heading
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'finishing-heading-add';
      btn.textContent = '+ ' + d.label;
      btn.title = 'Add ' + d.label + ' to the heading';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        headingState[d.key] = true;
        renderPreview();
        renderHeadingAdds();
        regenerateTex();
      });
      headAdds.appendChild(btn);
    }
  }

  // items: [{n, content}, ...] — the problems in their current order.
  // gaps:  [{space, pageBreak}, ...] — positional metadata BETWEEN items;
  //        gaps[i] is the gap drawn before items[i] (gaps[0] is unused/sentinel).
  // Reordering items[] doesn't touch gaps[] — so the space/page-break
  // between positions 1 and 2 stays put even if you swap problems 1 and 2.
  let items = [];
  let gaps  = [];
  let lastExamFingerprint = '';
  // Heading toggles (Title / Name / Surname / Points / Grade) + the
  // currently-displayed title text (editable through the LaTeX textarea).
  const headingState = { title: true, name: true, surname: true, points: true, grade: true };
  let headingTitle = 'Izpit';

  function sortBySection(ns) {
    return [...ns].sort((a, b) => {
      const sa = ((byN[a]?.section_letters) || ['Z'])[0] || 'Z';
      const sb = ((byN[b]?.section_letters) || ['Z'])[0] || 'Z';
      return sa.localeCompare(sb) || (a - b);
    });
  }

  function generateHeadingTex() {
    const lines = [];
    if (headingState.title) {
      lines.push('\\begin{center}\n{\\Large\\textbf{' + headingTitle + '}}\n\\end{center}');
    }
    // Layout fields in a borderless 2-column tabular: row 1 = Ime/Priimek,
    // row 2 = Točke/Ocena. Cells that are toggled off render as empty.
    const cell = (on, label) => on ? `${label}: \\dotfill` : '';
    const top = [
      cell(headingState.name,    'Ime'),
      cell(headingState.surname, 'Priimek'),
    ];
    const bot = [
      cell(headingState.points,  'Točke'),
      cell(headingState.grade,   'Ocena'),
    ];
    const hasTop = top.some(Boolean);
    const hasBot = bot.some(Boolean);
    if (hasTop || hasBot) {
      const rows = [];
      if (hasTop) rows.push(`${top[0]} & ${top[1]}`);
      if (hasBot) rows.push(`${bot[0]} & ${bot[1]}`);
      lines.push(
        '\\noindent\\begin{tabular*}{\\textwidth}' +
        '{@{}p{0.45\\textwidth}@{\\extracolsep{\\fill}}p{0.45\\textwidth}@{}}\n' +
        rows.join(' \\\\[0.5em]\n') + '\n' +
        '\\end{tabular*}'
      );
    }
    if (lines.length === 0) return '';
    return lines.join('\n\\bigskip\n') + '\n\n\\bigskip\n\n';
  }

  // ---- Hint visibility (Finishing tab) -------------------------------------
  // Per-problem flag persisted in localStorage so a hidden hint stays
  // hidden across reloads. The KEY is a single object {n: true, ...}
  // (only entries set to true are stored — undefined means "shown").
  const HINT_HIDE_KEY = 'exam-hint-hidden-v1';
  function loadHiddenHintsMap() {
    try {
      const raw = localStorage.getItem(HINT_HIDE_KEY);
      if (!raw) return {};
      const v = JSON.parse(raw);
      return (v && typeof v === 'object') ? v : {};
    } catch { return {}; }
  }
  function saveHiddenHintsMap(map) {
    try { localStorage.setItem(HINT_HIDE_KEY, JSON.stringify(map)); }
    catch {}
  }
  function isHintHidden(n) {
    if (n == null) return false;
    return !!loadHiddenHintsMap()[String(n)];
  }
  function setHintHidden(n, hide) {
    if (n == null) return;
    const m = loadHiddenHintsMap();
    if (hide) m[String(n)] = true;
    else      delete m[String(n)];
    saveHiddenHintsMap(m);
  }
  // Match \namig{...} or \namigsplit{...}{...} with up to 2 levels of
  // balanced braces inside each argument. Same nesting tolerance as the
  // renderer in latexToHtml so anything that renders gets stripped.
  const NAMIG_BAL =
    '(?:[^{}]|\\{(?:[^{}]|\\{[^{}]*\\})*\\})*';
  const NAMIG_RE = new RegExp(
    '\\\\namigsplit\\{' + NAMIG_BAL + '\\}\\s*\\{' + NAMIG_BAL + '\\}' +
    '|\\\\namig\\{' + NAMIG_BAL + '\\}',
    'g');
  function hasNamig(src) {
    return NAMIG_RE.test(src || '');
  }
  function stripNamig(src) {
    return (src || '').replace(NAMIG_RE, '').replace(/\n{3,}/g, '\n\n').trim();
  }

  function regenerateTex() {
    const itemsTex = items.map((item, i) => {
      let pre = '';
      if (i > 0) {
        const g = gaps[i] || { space: 0, pageBreak: false };
        if (g.pageBreak) pre += '\\newpage\n';
        if (g.space && g.space > 0) {
          pre += `\\vspace*{${g.space}pt}\n`;
        }
      }
      const nMarker = item.n ? `% problem ${item.n}\n` : '';
      let raw = (item.content || '').trim();
      if (isHintHidden(item.n)) raw = stripNamig(raw);
      return `${pre}${nMarker}\\item ${raw}`;
    }).join('\n\n');
    const doc = `\\documentclass[12pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{lmodern}
\\usepackage[a4paper,margin=2cm]{geometry}
\\usepackage{amsmath,amssymb,amsthm}
\\usepackage{enumitem}
\\usepackage{tikz}
\\usetikzlibrary{calc,angles,quotes,intersections,decorations.pathreplacing}
\\usepackage{graphicx}
\\pagestyle{empty}
\\setlength{\\parindent}{0pt}
\\begin{document}
${generateHeadingTex()}\\begin{enumerate}[leftmargin=*]
${itemsTex}
\\end{enumerate}
\\end{document}
`;
    tex.value = doc;
  }

  // Parse the textarea content into items[] (best-effort). Also picks up
  // the heading title text (so editing "Izpit" in LaTeX flows back into
  // the preview). Returns true if the enumerate body could be located.
  function parseTexIntoItems() {
    // --- Title (everything inside \begin{center}{\Large\textbf{...}}\end{center}) ---
    const titleM = tex.value.match(
      /\\begin\{center\}\s*\{\s*\\Large\s*\\textbf\{([^{}]+)\}\s*\}\s*\\end\{center\}/);
    if (titleM) {
      headingTitle = titleM[1];
      headingState.title = true;
    } else {
      headingState.title = false;
    }
    renderHeadingAdds();

    const m = tex.value.match(/\\begin\{enumerate\}[^\n]*\n([\s\S]*?)\\end\{enumerate\}/);
    if (!m) return false;
    const inner = m[1];
    // Splitting on \item leaves chunks[0] as the preamble (which contains
    // the "% problem N" comment for the FIRST item) and chunks[i>=1] as
    // the BODY of item i — but each body's *tail* may also carry the
    // gap markers (\newpage / \vspace) and the "% problem M" comment for
    // the NEXT item. Peel that tail off before treating chunk[i] as
    // content for item i.
    const chunks = inner.split(/\\item\b\s*/);
    if (chunks.length < 2) return false;
    // Pull the FIRST item's "% problem N" out of the preamble.
    const firstNM = chunks[0].match(/%\s*problem\s+(\d+)\s*\n/);
    let currentN = firstNM ? parseInt(firstNM[1], 10) : null;
    const newItems = [];
    const newGaps  = [];
    let pendingNewpage = false;
    let pendingSpace = 0;
    for (let i = 1; i < chunks.length; i++) {
      let chunk = chunks[i];
      // Peel from the END: \newpage, \vspace, "% problem M\n" — repeatedly,
      // any order. The peeled comment is the marker for the NEXT item.
      let trailingNewpage = false;
      let trailingSpace = 0;
      let nextN = null;
      while (true) {
        const cmM = chunk.match(/\s*%\s*problem\s+(\d+)[^\n]*\n?\s*$/);
        if (cmM) {
          nextN = parseInt(cmM[1], 10);
          chunk = chunk.substring(0, chunk.length - cmM[0].length);
          continue;
        }
        const npM = chunk.match(/\s*\\newpage\s*$/);
        if (npM) {
          trailingNewpage = true;
          chunk = chunk.substring(0, chunk.length - npM[0].length);
          continue;
        }
        const vsM = chunk.match(/\s*\\vspace\*?\{\s*(\d+)\s*pt\s*\}\s*$/);
        if (vsM) {
          trailingSpace = parseInt(vsM[1], 10);
          chunk = chunk.substring(0, chunk.length - vsM[0].length);
          continue;
        }
        break;
      }
      newItems.push({ n: currentN, content: chunk.trim() });
      // The previously-buffered "pending" directives describe the gap
      // BEFORE this just-pushed item.
      newGaps.push(newItems.length === 1
        ? { space: 0, pageBreak: false }                // sentinel
        : { space: pendingSpace, pageBreak: pendingNewpage });
      pendingNewpage = trailingNewpage;
      pendingSpace = trailingSpace;
      currentN = nextN;
    }
    items = newItems;
    gaps  = newGaps;
    return true;
  }

  function renderPreview() {
    preview.innerHTML = '';
    // Heading section
    const hh = document.createElement('div');
    hh.className = 'exam-heading';
    let any = false;
    if (headingState.title) {
      const wrap = document.createElement('div');
      wrap.className = 'exam-heading-title-wrap';
      const t = document.createElement('div');
      t.className = 'exam-heading-title';
      t.contentEditable = 'true';
      t.spellcheck = false;
      t.textContent = headingTitle;
      // Plain-text editing — strip any pasted formatting & block Enter newlines.
      t.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); t.blur(); }
      });
      t.addEventListener('input', () => {
        headingTitle = (t.textContent || '').replace(/\s+/g, ' ').trim() || ' ';
        regenerateTex();
      });
      wrap.appendChild(t);
      const xt = document.createElement('button');
      xt.type = 'button';
      xt.className = 'exam-field-remove';
      xt.title = 'Remove title';
      xt.textContent = '×';
      xt.addEventListener('click', (e) => {
        e.preventDefault();
        headingState.title = false;
        renderPreview();
        renderHeadingAdds();
        regenerateTex();
      });
      wrap.appendChild(xt);
      hh.appendChild(wrap);
      any = true;
    }
    const fieldDefs = [
      { key: 'name',    label: 'Ime' },
      { key: 'surname', label: 'Priimek' },
      { key: 'points',  label: 'Točke' },
      { key: 'grade',   label: 'Ocena' },
    ].filter(d => headingState[d.key]);
    if (fieldDefs.length > 0) {
      const fields = document.createElement('div');
      fields.className = 'exam-heading-fields';
      for (const d of fieldDefs) {
        const row = document.createElement('div');
        row.className = 'exam-heading-field';
        row.innerHTML =
          `<span class="exam-field-label">${d.label}:` +
          `<button type="button" class="exam-field-remove" data-key="${d.key}" title="Remove field">×</button>` +
          `</span>` +
          `<span class="exam-field-blank"></span>`;
        const x = row.querySelector('.exam-field-remove');
        x.addEventListener('click', (e) => {
          e.preventDefault();
          headingState[d.key] = false;
          renderPreview();
          renderHeadingAdds();
          regenerateTex();
        });
        fields.appendChild(row);
      }
      hh.appendChild(fields);
      any = true;
    }
    if (any) preview.appendChild(hh);

    if (items.length === 0) {
      // Empty exam — render just the "+ Add a problem" affordance, no
      // explanatory placeholder text.
      appendAddBlock();
      if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise([preview]).catch(() => {});
      }
      return;
    }
    items.forEach((item, idx) => {
      const g = gaps[idx] || { space: 0, pageBreak: false };
      if (idx > 0) {
        const sep = document.createElement('div');
        sep.className = 'finishing-separator';
        sep.dataset.i = idx;
        // Space input + Page break button — side by side, Space first.
        const row = document.createElement('div');
        row.className = 'finishing-controls-row';
        const ctrl = document.createElement('span');
        ctrl.className = 'finishing-space-control';
        ctrl.innerHTML = `Space: <input type="number" min="0" step="1" value="${g.space || 0}" class="space-input"> pt`;
        const inp = ctrl.querySelector('input');
        inp.addEventListener('input', (e) => {
          const v = Math.max(0, parseInt(e.target.value || '0', 10) || 0);
          gaps[idx].space = v;
          // Space and Page break are mutually exclusive — but DON'T re-render,
          // or the input loses focus mid-typing. Patch the DOM in place.
          if (v > 0 && gaps[idx].pageBreak) {
            gaps[idx].pageBreak = false;
            pb.classList.remove('is-active');
            pb.textContent = '↪ Page break';
            const line = sep.querySelector('.finishing-page-break-line');
            if (line) line.remove();
            const nextBlock = preview.querySelector(
              `.finishing-block[data-i="${idx}"]`);
            if (nextBlock) nextBlock.classList.remove('is-page-break');
          }
          spacer.style.height = (4 + Math.round(v * 1.333)) + 'px';
          regenerateTex();
        });
        row.appendChild(ctrl);
        const pb = document.createElement('button');
        pb.type = 'button';
        pb.className = 'page-break-toggle' + (g.pageBreak ? ' is-active' : '');
        pb.textContent = g.pageBreak ? '↪ Page break ✓' : '↪ Page break';
        pb.addEventListener('click', (e) => {
          e.preventDefault();
          const turningOn = !gaps[idx].pageBreak;
          gaps[idx].pageBreak = turningOn;
          // Mutual exclusion: turning page break on clears any pt of space.
          if (turningOn) gaps[idx].space = 0;
          renderPreview();
          regenerateTex();
        });
        row.appendChild(pb);
        sep.appendChild(row);
        // Visible space bar (height in px ≈ pt × 1.333)
        const spacer = document.createElement('div');
        spacer.className = 'finishing-space';
        spacer.style.height = (4 + Math.round((g.space || 0) * 1.333)) + 'px';
        sep.appendChild(spacer);
        // Dashed page-break line goes BELOW the controls + spacer.
        if (g.pageBreak) {
          const line = document.createElement('div');
          line.className = 'finishing-page-break-line';
          sep.appendChild(line);
        }
        preview.appendChild(sep);
      }

      const block = document.createElement('div');
      block.className = 'finishing-block';
      if (g.pageBreak) block.classList.add('is-page-break');
      block.draggable = true;
      block.dataset.i = idx;
      const dragH = document.createElement('span');
      dragH.className = 'drag-handle';
      dragH.textContent = '⋮⋮';
      dragH.title = 'Drag to reorder';
      block.appendChild(dragH);
      const body = document.createElement('div');
      body.className = 'finishing-block-body';
      const meta = (item.n != null) ? byN[item.n] : null;
      const tikz = meta ? (meta.tikz_count || 0) : 0;
      const bodyImg = meta ? meta.body_image : undefined;
      const figOrig = meta ? (meta.tikz_originals || []) : [];
      const hideHint = isHintHidden(item.n);
      const rawContent = item.content || '';
      const hasHint    = hasNamig(rawContent);
      const renderTex  = hideHint ? stripNamig(rawContent) : rawContent;
      renderProblemBody(body, {
        n: item.n, latex: renderTex, tikzCount: tikz,
        bodyImage: bodyImg,
        tikzOriginals: figOrig,
      });
      // Inline the problem number with the first paragraph (no line break).
      const numHtml = `<strong class="result-num">${idx + 1}. </strong>`;
      const firstP = body.querySelector('p');
      if (firstP) firstP.insertAdjacentHTML('afterbegin', numHtml);
      else        body.insertAdjacentHTML('afterbegin', numHtml);
      // If the hint is currently shown, attach a small × inside it so the
      // user can hide it just like the heading "Title" field. If it's
      // hidden but the original content has a hint, render a "+ Hint"
      // affordance below the body.
      if (!hideHint && hasHint) {
        const namigEls = body.querySelectorAll('.tex-namig');
        namigEls.forEach(el => {
          if (el.querySelector(':scope > .tex-namig-remove')) return;
          const x = document.createElement('button');
          x.type = 'button';
          x.className = 'tex-namig-remove exam-field-remove';
          x.title = 'Remove hint';
          x.textContent = '×';
          x.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            setHintHidden(item.n, true);
            renderPreview();
            regenerateTex();
          });
          el.appendChild(x);
        });
      } else if (hideHint && hasHint) {
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'finishing-add-hint';
        addBtn.textContent = '+ Hint';
        addBtn.title = 'Show the hint for this problem';
        addBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          setHintHidden(item.n, false);
          renderPreview();
          regenerateTex();
        });
        body.appendChild(addBtn);
      }
      block.appendChild(body);
      // × button to remove this problem from the exam.
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'finishing-block-remove exam-field-remove';
      rm.title = 'Remove this problem from the exam';
      rm.textContent = '×';
      rm.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        removeProblemFromExamAt(idx);
      });
      block.appendChild(rm);
      preview.appendChild(block);
    });
    // "+ Add a problem" affordance pinned at the end of the preview.
    appendAddBlock();
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise([preview]).catch(() => {});
    }
  }

  // ---- Exam mutation helpers (preserve user's reordering & gaps) -------
  // Append a list of problem numbers to items[] (skipping ones already
  // present), then sync to localStorage WITHOUT triggering refresh's
  // rebuild-from-scratch logic.
  function addProblemsToExam(ns) {
    const existing = new Set(items.map(it => it.n).filter(n => n != null));
    const fresh = ns.filter(n => !existing.has(n) && byN[n]);
    if (fresh.length === 0) return 0;
    for (const n of fresh) {
      const data = byN[n] || {};
      const ed = effectiveState(n);
      const src = (ed.latex !== undefined) ? ed.latex : (data.latex || '');
      items.push({ n, content: src.trim() });
      gaps.push({ space: 0, pageBreak: false });
    }
    const newExam = items.map(it => it.n).filter(n => n != null);
    // Bump fingerprint *before* setExam fires the event so refresh() no-ops.
    lastExamFingerprint = newExam.slice().sort((a, b) => a - b).join(',');
    setExam(newExam);
    regenerateTex();
    renderPreview();
    return fresh.length;
  }
  // Remove the item at `idx` from items[] and gaps[], persist exam.
  function removeProblemFromExamAt(idx) {
    if (idx < 0 || idx >= items.length) return;
    items.splice(idx, 1);
    gaps.splice(idx, 1);
    const newExam = items.map(it => it.n).filter(n => n != null);
    lastExamFingerprint = newExam.slice().sort((a, b) => a - b).join(',');
    setExam(newExam);
    regenerateTex();
    renderPreview();
  }
  // Pick N random problem numbers from `pool` (skipping ones already in
  // the exam), then add them.
  function addRandomFromPool(pool, n) {
    const existing = new Set(items.map(it => it.n).filter(x => x != null));
    const eligible = pool.filter(p => !existing.has(p));
    if (eligible.length === 0) return 0;
    // Fisher-Yates
    const shuffled = eligible.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return addProblemsToExam(shuffled.slice(0, Math.max(1, n)));
  }

  // Builds the "Add a problem" pseudo-block at the end of the preview.
  // Both actions open a fullscreen modal so the user can browse problems
  // with the same UI as the search page.
  function appendAddBlock() {
    const addBlock = document.createElement('div');
    addBlock.className = 'finishing-add-block';
    addBlock.innerHTML =
      '<div class="finishing-add-header">+ Add a problem</div>' +
      '<div class="finishing-add-actions">' +
        '<button type="button" class="finishing-add-from-coll">Collection</button>' +
        '<button type="button" class="finishing-add-search">Search</button>' +
      '</div>';
    addBlock.querySelector('.finishing-add-from-coll')
            .addEventListener('click', () => openAddProblemModal('collection'));
    addBlock.querySelector('.finishing-add-search')
            .addEventListener('click', () => openAddProblemModal('search'));
    preview.appendChild(addBlock);
  }

  // ---- Modal: "Add a problem" ------------------------------------------
  function ensureAddProblemModal() {
    let modal = document.getElementById('add-problem-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'add-problem-modal';
    modal.className = 'exam-modal';
    modal.hidden = true;
    modal.innerHTML =
      '<div class="exam-modal-backdrop"></div>' +
      '<div class="exam-modal-window">' +
        '<div class="exam-modal-header">' +
          '<h2 class="exam-modal-title">Add a problem</h2>' +
          '<button type="button" class="exam-modal-close" aria-label="Close">×</button>' +
        '</div>' +
        '<div class="exam-modal-body"></div>' +
      '</div>';
    document.body.appendChild(modal);
    const close = () => { modal.hidden = true; };
    modal.querySelector('.exam-modal-backdrop').addEventListener('click', close);
    modal.querySelector('.exam-modal-close').addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.hidden) close();
    });
    return modal;
  }

  function openAddProblemModal(mode) {
    const modal = ensureAddProblemModal();
    const title = modal.querySelector('.exam-modal-title');
    const body  = modal.querySelector('.exam-modal-body');

    if (mode === 'collection') {
      title.textContent = 'Add from Collection';
      body.innerHTML =
        '<div class="search-results-bar">' +
          '<div class="search-summary" id="modal-coll-summary">Loading…</div>' +
          '<span class="add-random-control">' +
            '<span class="add-random-prefix">+ Add</span>' +
            '<input type="number" id="modal-coll-rand-n" value="1" min="1" max="999">' +
            '<span class="add-random-suffix">random</span>' +
            '<button type="button" id="modal-coll-rand-btn" aria-label="Add N random">→</button>' +
          '</span>' +
          '<button type="button" id="modal-coll-all-btn" class="add-all-btn">+ Add all</button>' +
        '</div>' +
        '<div class="search-results" id="search-results"></div>';
      renderCollectionInModal(body);
    } else {
      title.textContent = 'Search problems';
      // The search-page DOM, with the IDs initSearchPage expects.
      body.innerHTML =
        '<div class="filters-panel" id="filters"></div>' +
        '<div class="search-results-bar">' +
          '<div class="search-summary" id="result-count">Loading…</div>' +
          '<span class="add-random-control">' +
            '<span class="add-random-prefix">+ Add</span>' +
            '<input type="number" id="add-random-n" value="1" min="1" max="999">' +
            '<span class="add-random-suffix">random</span>' +
            '<button type="button" id="add-random-btn" aria-label="Add N random">→</button>' +
          '</span>' +
          '<button type="button" id="add-all-btn" class="add-all-btn">+ Add all</button>' +
        '</div>' +
        '<div class="search-results" id="search-results"></div>';
      // Run a configured initSearchPage that wires Add → exam.
      // The Add button toggles: clicking on a problem already in the exam
      // removes it.
      initSearchPage({
        skipPageInit: true,
        isMarked:       (n) => items.some(it => it.n === n),
        onAdd:          (n) => {
          const idx = items.findIndex(it => it.n === n);
          if (idx >= 0) removeProblemFromExamAt(idx);
          else          addProblemsToExam([n]);
        },
        onAddAll:       (ns) => addProblemsToExam(ns),
        addLabel:       '+',
        markedLabel:    '×',
        markedDisabled: false,
        markedClass:    'is-in-exam',
        showEditLink:   false,
        stateEvent:     'exam-changed',
      });
    }

    modal.hidden = false;
  }

  // Renders the user's collection inside the modal as a flat list of
  // search-result cards. Items already in the exam are greyed out.
  // Toolbar above provides "+ Add N random" and "+ Add all" actions.
  function renderCollectionInModal(modalBody) {
    const cardsContainer = modalBody.querySelector('#search-results');
    const summary        = modalBody.querySelector('#modal-coll-summary');
    const allBtn         = modalBody.querySelector('#modal-coll-all-btn');
    const randBtn        = modalBody.querySelector('#modal-coll-rand-btn');
    const randInput      = modalBody.querySelector('#modal-coll-rand-n');

    const collection = [...getSelected()].sort((a, b) => a - b);

    function refresh() {
      const examSet = new Set(items.map(it => it.n).filter(n => n != null));
      const remaining = collection.filter(n => !examSet.has(n));
      summary.innerHTML = '<strong>' + collection.length +
        '</strong> in collection · ' + remaining.length + ' not in exam';
      // Toolbar buttons enabled state
      allBtn.disabled  = remaining.length === 0;
      randBtn.disabled = remaining.length === 0;

      if (collection.length === 0) {
        cardsContainer.innerHTML =
          '<div class="modal-empty-msg">Your collection is empty. ' +
          'Add problems via the Search tab first.</div>';
        return;
      }
      cardsContainer.innerHTML = collection
        .filter(n => byN[n])
        .map(n => {
          const inExam = examSet.has(n);
          const data = byN[n];
          // The .search-result on the search page is position: absolute
          // inside a .search-result-wrap grid cell. Without the wrap, every
          // bare .search-result lands at top:0/left:0 of #search-results
          // and the last one paints on top of all the others — that's why
          // only problem 15 was visible. Render the wrap+hot-zone here too.
          return `<div class="search-result-wrap">
            <div class="search-result-hot-zone"></div>
            <div class="search-result ${inExam ? 'is-in-exam' : ''}">
              <span class="result-num">${n}.</span>
              <div class="result-body" data-id="${n}" data-tikz="${data.tikz_count || 0}"></div>
              <div class="result-actions">
                <button type="button" class="result-add ${inExam ? 'is-selected' : ''}"
                        data-n="${n}" title="${inExam ? 'Remove' : 'Add'}">${inExam ? '×' : '+'}</button>
              </div>
            </div>
          </div>`;
        })
        .join('');
      // Render LaTeX previews (or textbook crop image) inside each card.
      collection.forEach(n => {
        const data = byN[n];
        if (!data) return;
        const bodyEl = cardsContainer.querySelector('.result-body[data-id="' + n + '"]');
        if (!bodyEl) return;
        const ed = effectiveState(n);
        const latex = (ed.latex !== undefined) ? ed.latex : data.latex;
        renderProblemBody(bodyEl, {
          n: n, latex: latex, tikzCount: data.tikz_count || 0,
          bodyImage: data.body_image,
          tikzOriginals: data.tikz_originals || [],
        });
      });
      if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise([cardsContainer]).catch(() => {});
      }
      // Wire the same JS-managed hover as the search page so cards expand
      // when hovered without pushing the rest of the grid down.
      cardsContainer.querySelectorAll('.search-result-wrap').forEach(wrap => {
        const hot    = wrap.querySelector('.search-result-hot-zone');
        const addBtn = wrap.querySelector('.result-add');
        const targets = [hot, addBtn].filter(Boolean);
        const enter = () => {
          wrap.classList.add('is-hovered');
          adjustHoverOverflowGuard(wrap, true);
        };
        const leave = () => {
          setTimeout(() => {
            const stillIn = targets.some(t => t.matches(':hover'));
            if (!stillIn) {
              wrap.classList.remove('is-hovered');
              adjustHoverOverflowGuard(wrap, false);
            }
          }, 0);
        };
        targets.forEach(t => {
          t.addEventListener('mouseenter', enter);
          t.addEventListener('mouseleave', leave);
        });
      });
    }

    refresh();

    // Single-card Add/Remove button (event delegation): toggles
    // membership of the problem in the exam.
    cardsContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.result-add');
      if (!btn) return;
      e.preventDefault();
      const n = Number(btn.dataset.n);
      const idx = items.findIndex(it => it.n === n);
      if (idx >= 0) removeProblemFromExamAt(idx);
      else          addProblemsToExam([n]);
      refresh();
    });
    // Add all
    allBtn.addEventListener('click', () => {
      addProblemsToExam(collection);
      refresh();
    });
    // Add N random
    randBtn.addEventListener('click', () => {
      const n = Math.max(1, parseInt(randInput.value, 10) || 1);
      addRandomFromPool(collection, n);
      refresh();
    });
  }

  // Drag-reorder — standard "insertion line" pattern: while dragging, a
  // thin horizontal indicator shows where the item would land if dropped.
  // The actual reorder only happens on drop.
  let draggingIdx = null;
  let dropIdx = null;
  let insertLine = null;
  function showInsertionLine(idx) {
    if (!insertLine) {
      insertLine = document.createElement('div');
      insertLine.className = 'finishing-insert-line';
      preview.appendChild(insertLine);
    }
    const blocks = preview.querySelectorAll('.finishing-block');
    const previewRect = preview.getBoundingClientRect();
    let topY;
    if (blocks.length === 0) topY = 0;
    else if (idx >= blocks.length) {
      const lastRect = blocks[blocks.length - 1].getBoundingClientRect();
      topY = lastRect.bottom - previewRect.top + preview.scrollTop;
    } else {
      const rect = blocks[idx].getBoundingClientRect();
      topY = rect.top - previewRect.top + preview.scrollTop;
    }
    insertLine.style.top = (topY - 2) + 'px';
    insertLine.style.display = 'block';
  }
  function hideInsertionLine() {
    if (insertLine) insertLine.style.display = 'none';
  }
  preview.addEventListener('dragstart', (e) => {
    const block = e.target.closest('.finishing-block');
    if (!block) return;
    draggingIdx = parseInt(block.dataset.i, 10);
    dropIdx = draggingIdx;
    block.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', String(draggingIdx)); } catch {}
  });
  preview.addEventListener('dragend', () => {
    preview.querySelectorAll('.dragging').forEach(b => b.classList.remove('dragging'));
    draggingIdx = null;
    dropIdx = null;
    hideInsertionLine();
  });
  preview.addEventListener('dragover', (e) => {
    if (draggingIdx === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    // Find which gap the cursor is closest to (compare against block midpoints).
    const blocks = Array.from(preview.querySelectorAll('.finishing-block'));
    let idx = blocks.length;
    for (let i = 0; i < blocks.length; i++) {
      const rect = blocks[i].getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      if (e.clientY < mid) { idx = i; break; }
    }
    dropIdx = idx;
    showInsertionLine(idx);
  });
  preview.addEventListener('drop', (e) => {
    e.preventDefault();
    hideInsertionLine();
    if (draggingIdx === null || dropIdx === null) { return; }
    // splice index needs adjustment if removing from before the target
    let target = dropIdx;
    if (draggingIdx < target) target--;
    if (target !== draggingIdx) {
      const [moved] = items.splice(draggingIdx, 1);
      items.splice(target, 0, moved);
      renderPreview();
      regenerateTex();
    }
    draggingIdx = null;
    dropIdx = null;
  });

  // Editable LaTeX — re-parse items on input (debounced) and re-render preview.
  let parseTimer = null;
  tex.addEventListener('input', () => {
    clearTimeout(parseTimer);
    parseTimer = setTimeout(() => {
      const ok = parseTexIntoItems();
      if (ok) renderPreview();
      // If parsing fails, leave the previous render untouched (user is mid-edit).
    }, 250);
  });

  function refresh() {
    const exam = getExam();
    const fp = exam.slice().sort((a, b) => a - b).join(',');
    if (fp === lastExamFingerprint && items.length) {
      // Set unchanged — keep user edits to ordering, content, etc.
    } else {
      lastExamFingerprint = fp;
      items = sortBySection(exam).map(n => {
        const data = byN[n] || {};
        const ed = effectiveState(n);
        const src = (ed.latex !== undefined) ? ed.latex : (data.latex || '');
        return { n, content: src.trim() };
      });
      // Reset positional gaps to defaults whenever the exam set changes.
      gaps = items.map(() => ({ space: 0, pageBreak: false }));
      regenerateTex();
    }
    renderPreview();
  }
  window.addEventListener('exam-changed', refresh);
  refresh();
  renderHeadingAdds();

  // Downloads
  // Toggle the LaTeX pane (collapsed by default; the user clicks
  // "Edit LaTeX" in the toolbar to open it side-by-side with Preview).
  const toggleLatexBtn = document.getElementById('toggle-latex-btn');
  if (toggleLatexBtn) {
    toggleLatexBtn.addEventListener('click', () => {
      const open = document.body.classList.toggle('latex-open');
      toggleLatexBtn.setAttribute('aria-pressed', open ? 'true' : 'false');
      toggleLatexBtn.textContent = open ? '✎ Hide LaTeX' : '✎ Edit LaTeX';
    });
  }

  document.getElementById('download-tex').addEventListener('click', () => {
    const blob = new Blob([tex.value], { type: 'text/x-latex;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'izpit.tex';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  });
  // Two PDF download paths:
  //   • Main "Download PDF" button — adds `print-finishing` class to
  //     <body> (CSS hides every chrome element under that class) and
  //     calls window.print(). The browser's native Print / Save-as-PDF
  //     dialog opens on the SAME tab. Fast, no extra tab to dismiss.
  //   • Dropdown's "Compile via pdflatex" — slower (~3 s), POSTs the .tex
  //     to a Fly.io service that runs real pdflatex. Output is byte-
  //     equivalent to compiling locally.
  const LATEX_COMPILE_URL = 'https://mat-naloge-latex.fly.dev/compile';

  // -- Native print on the same tab. The body.print-finishing CSS rules
  //    (in styles.css) hide chrome and reset the preview pane to flow
  //    cleanly across pages.
  function downloadPdfViaPrint() {
    // Drop focus from any contenteditable (e.g. the exam title) so its
    // text caret isn't captured into the rendered PDF.
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    document.body.classList.add('print-finishing');
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      document.body.classList.remove('print-finishing');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    // Safety net if afterprint never fires (some mobile browsers).
    setTimeout(cleanup, 60000);
    // Force a reflow so the print stylesheet is applied before the dialog.
    void document.body.offsetHeight;
    setTimeout(() => window.print(), 100);
  }

  // -- Server-compile PDF (real pdflatex via Fly.io) ----------------------
  async function downloadPdfViaServer() {
    const btn = document.getElementById('download-pdf');
    const texContent = tex.value;
    if (!texContent.trim()) {
      alert('No LaTeX to compile.');
      return;
    }
    const origLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = '⏳ Compiling LaTeX…';
    try {
      const r = await fetch(LATEX_COMPILE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/x-latex; charset=utf-8' },
        body: texContent,
      });
      if (!r.ok) {
        let detail = '';
        try {
          const j = await r.json();
          detail = j.error || '';
          if (j.log) detail += '\n\nLog tail:\n' + j.log.slice(-1500);
        } catch (_) {
          detail = await r.text();
        }
        throw new Error('HTTP ' + r.status + (detail ? ':\n' + detail : ''));
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'izpit.pdf';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF compilation failed:', err);
      alert('PDF compilation failed.\n\n' + (err && err.message || err));
    } finally {
      btn.disabled = false;
      btn.textContent = origLabel;
    }
  }

  // Wire up the split button + dropdown.
  document.getElementById('download-pdf')
          .addEventListener('click', downloadPdfViaPrint);
  const splitMenu = document.getElementById('pdf-split-menu');
  document.getElementById('download-pdf-menu')
          .addEventListener('click', (e) => {
    e.stopPropagation();
    splitMenu.hidden = !splitMenu.hidden;
  });
  document.getElementById('download-pdf-server')
          .addEventListener('click', (e) => {
    e.preventDefault();
    splitMenu.hidden = true;
    downloadPdfViaServer();
  });
  // Click outside → close the menu.
  document.addEventListener('click', (e) => {
    if (!splitMenu.hidden && !splitMenu.contains(e.target) &&
        e.target.id !== 'download-pdf-menu') {
      splitMenu.hidden = true;
    }
  });
}

// Source / year / pola / level / section filter for the Problems index
// page. Shown ONLY in the By-topic / By-year browse modes (the By-source
// mode already has its own Matura/Textbook split, so the filter would be
// redundant there). Mirrors the Search page filter UI 1:1 — same chips
// and dropdown panels — but instead of re-rendering a results list it
// hides cards in-place and rewrites the summary/year/topic counts so
// only matching problems are visible.
function initIndexSourceFilter() {
  const root = document.getElementById('index-source-filter');
  if (!root) return;
  const PROBLEMS = (window.PROBLEMS || []).slice();
  if (PROBLEMS.length === 0) return;

  function gather(arr, field) {
    const out = new Set();
    arr.forEach(p => (p[field] || []).forEach(v => v && out.add(v)));
    return [...out];
  }
  function sectionsBySource(src) {
    const out = new Set();
    PROBLEMS.forEach(p => {
      if (p.source !== src) return;
      (p.section_letters || []).forEach(v => v && out.add(v));
    });
    return [...out].sort();
  }
  const yearVals = PROBLEMS.map(p => parseInt(p.year, 10)).filter(n => !isNaN(n));
  const yearMin = yearVals.length ? Math.min(...yearVals) : 0;
  const yearMax = yearVals.length ? Math.max(...yearVals) : 0;
  const ptsArr = [];
  PROBLEMS.forEach(p => (p.points_ns || []).forEach(n => ptsArr.push(n)));
  const pointsMin = ptsArr.length ? Math.min(...ptsArr) : 0;
  const pointsMax = ptsArr.length ? Math.max(...ptsArr) : 0;
  const allSources = [...new Set(PROBLEMS.map(p => p.source).filter(Boolean))];
  const allPolas   = gather(PROBLEMS, 'polas_n').sort();
  const allLevels  = gather(PROBLEMS, 'levels').sort(
    (a,b) => (LEVEL_ORDER_JS[a]||9) - (LEVEL_ORDER_JS[b]||9));
  const maturaSections   = sectionsBySource('Matura');
  const textbookSections = sectionsBySource('Textbook');

  const state = {
    yearMin, yearMax, pointsMin, pointsMax,
    sources:  new Set(allSources),
    polas:    new Set(allPolas),
    levels:   new Set(allLevels),
    sections: new Set([...maturaSections, ...textbookSections]),
  };

  const hasTextbookSecs = textbookSections.length > 0;
  root.innerHTML = `
    <div class="filter-cell filter-source-cell">
      <label class="filter-label">Source</label>
      <div class="filter-chip-group" id="ix-sources">
        ${allSources.map(s => {
          const slug = s === 'Matura' ? 'matura'
                      : s === 'Textbook' ? 'textbook' : '';
          const panelId = slug ? `ix-panel-${slug}` : '';
          return `<span class="filter-source-chip-combo">`
            + `<button type="button" class="filter-chip filter-chip-source filter-chip-source-combo${slug ? ' filter-chip-source-' + slug : ''}" `
            +         `data-val="${escapeHtml(s)}" aria-pressed="true">${escapeHtml(s)}</button>`
            + (panelId
                ? `<button type="button" class="filter-source-arrow" `
                  +         `data-target="${panelId}" aria-expanded="false" `
                  +         `aria-label="Toggle ${escapeHtml(s)} filters">▾</button>`
                : '')
            + `</span>`;
        }).join('')}
      </div>
    </div>
    <!-- Reorder topics button + panel have been moved to the top-level
         nav (index.html) so they're siblings of Source ▾ rather than
         children. Nothing renders here. -->
    <div class="filter-panel filter-panel-matura" id="ix-panel-matura" hidden>
      <div class="filter-grid">
        <div class="filter-cell">
          <label class="filter-label">Year</label>
          <div class="range-inputs">
            <input type="number" id="ix-year-min" value="${yearMin}" min="${yearMin}" max="${yearMax}">
            <span>–</span>
            <input type="number" id="ix-year-max" value="${yearMax}" min="${yearMin}" max="${yearMax}">
          </div>
        </div>
        <div class="filter-cell">
          <label class="filter-label">Points</label>
          <div class="range-inputs">
            <input type="number" id="ix-points-min" value="${pointsMin}" min="${pointsMin}" max="${pointsMax}">
            <span>–</span>
            <input type="number" id="ix-points-max" value="${pointsMax}" min="${pointsMin}" max="${pointsMax}">
          </div>
        </div>
        <div class="filter-cell">
          <label class="filter-label">Pola</label>
          <div class="filter-chip-group" id="ix-polas">
            ${allPolas.map(p =>
              `<button type="button" class="filter-chip filter-chip-pola" data-val="${escapeHtml(p)}" aria-pressed="true">${escapeHtml(p)}. pola</button>`
            ).join('')}
          </div>
        </div>
        <div class="filter-cell">
          <label class="filter-label">Level</label>
          <div class="filter-chip-group" id="ix-levels">
            ${allLevels.map(l =>
              `<button type="button" class="filter-chip filter-chip-level" data-val="${escapeHtml(l)}" aria-pressed="true">${escapeHtml(l)}</button>`
            ).join('')}
          </div>
        </div>
        <div class="filter-cell">
          <label class="filter-label">Section</label>
          <div class="filter-chip-group" id="ix-sections-matura">
            ${maturaSections.map(s =>
              `<button type="button" class="filter-chip filter-chip-section" data-val="${escapeHtml(s)}" aria-pressed="true">${escapeHtml(s)}</button>`
            ).join('')}
          </div>
        </div>
      </div>
    </div>
    ${hasTextbookSecs ? `
    <div class="filter-panel filter-panel-textbook" id="ix-panel-textbook" hidden>
      <div class="filter-grid">
        <div class="filter-cell">
          <label class="filter-label">Section</label>
          <div class="filter-chip-group" id="ix-sections-textbook">
            ${textbookSections.map(s =>
              `<button type="button" class="filter-chip filter-chip-section filter-chip-section-textbook" data-val="${escapeHtml(s)}" aria-pressed="true">${escapeHtml(s)}</button>`
            ).join('')}
          </div>
        </div>
      </div>
    </div>` : ''}
  `;

  // Predicate: a problem passes the filter when at least one of its
  // values is in each multi-valued set. Textbook problems carry no
  // year/points/pola/level/section letter, so they only honour Source.
  function matches(p) {
    if (!state.sources.has(p.source)) return false;
    if (p.source === 'Textbook') return true;
    const yr = parseInt(p.year, 10);
    if (!isNaN(yr) && (yr < state.yearMin || yr > state.yearMax)) return false;
    // Multi-value chip predicates: empty arrays mean "no constraint
    // tagged on this problem" — fall through rather than excluding it
    // (matura_extra image-only problems carry empty section_letters /
    // polas_n / points_ns because they have no parsed metadata).
    const pointsNs = p.points_ns || [];
    if (pointsNs.length > 0 &&
        !pointsNs.some(n => n >= state.pointsMin && n <= state.pointsMax))
      return false;
    const polasN = p.polas_n || [];
    if (polasN.length > 0 && !polasN.some(v => state.polas.has(v))) return false;
    const levels = p.levels || [];
    if (levels.length > 0 && !levels.some(v => state.levels.has(v))) return false;
    const secs = p.section_letters || [];
    if (secs.length > 0 && !secs.some(v => state.sections.has(v))) return false;
    return true;
  }

  // Map id -> matches(). Recomputed on every state change.
  function applyFilter() {
    const pass = new Map();
    PROBLEMS.forEach(p => pass.set(String(p.n), matches(p)));
    // Walk every card on the page, toggling .filter-hidden.
    document.querySelectorAll('.search-result-wrap[data-id]').forEach(w => {
      const ok = pass.get(w.dataset.id) !== false;
      w.classList.toggle('filter-hidden', !ok);
    });
    // Recompute <details> summary counts (skip filter-hidden + already-
    // unapproved cards). Stash the build-time total in data-total so
    // toggling filters doesn't accumulate stale values.
    document.querySelectorAll('details.collection').forEach(d => {
      const span = d.querySelector(':scope > summary .count');
      if (!span) return;
      if (!span.dataset.total) {
        const m = span.textContent.match(/\d+/);
        if (m) span.dataset.total = m[0];
      }
      const seen = new Set();
      d.querySelectorAll('.search-result-wrap[data-id]').forEach(w => {
        if (!w.classList.contains('filter-hidden')
            && !w.classList.contains('unapproved-hidden')) {
          seen.add(w.dataset.id);
        }
      });
      span.textContent = `(${seen.size})`;
    });
  }

  function wireChipGroup(containerId, set) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-chip');
      if (!btn) return;
      e.preventDefault();
      const val = btn.dataset.val;
      const next = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(next));
      if (next) set.add(val); else set.delete(val);
      applyFilter();
    });
  }
  ['ix-year-min','ix-year-max','ix-points-min','ix-points-max'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      state.yearMin   = parseInt(document.getElementById('ix-year-min').value, 10);
      state.yearMax   = parseInt(document.getElementById('ix-year-max').value, 10);
      state.pointsMin = parseInt(document.getElementById('ix-points-min').value, 10);
      state.pointsMax = parseInt(document.getElementById('ix-points-max').value, 10);
      applyFilter();
    });
  });
  wireChipGroup('ix-sources',          state.sources);
  wireChipGroup('ix-polas',            state.polas);
  wireChipGroup('ix-levels',           state.levels);
  wireChipGroup('ix-sections-matura',  state.sections);
  if (document.getElementById('ix-sections-textbook')) {
    wireChipGroup('ix-sections-textbook', state.sections);
  }

  // Source-toggle → show/hide each Matura / Textbook chip's dropdown
  // arrow + the panel below.
  function syncSourcePanels() {
    root.classList.toggle('no-matura',   !state.sources.has('Matura'));
    root.classList.toggle('no-textbook', !state.sources.has('Textbook'));
  }
  syncSourcePanels();
  document.getElementById('ix-sources').addEventListener('click', syncSourcePanels);

  // Source-chip dropdown arrows AND the standalone "Reorder topics"
  // button → expand/collapse the matching panel. Mutually exclusive —
  // only one panel open at a time.
  const allArrows = document.querySelectorAll('.filter-source-arrow, .reorder-topics-btn');
  allArrows.forEach(arrow => {
    arrow.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const target = document.getElementById(arrow.dataset.target);
      if (!target) return;
      const willOpen = !!target.hidden;
      allArrows.forEach(a => {
        const t = document.getElementById(a.dataset.target);
        if (t) t.hidden = true;
        a.setAttribute('aria-expanded', 'false');
      });
      if (willOpen) {
        target.hidden = false;
        arrow.setAttribute('aria-expanded', 'true');
      }
    });
  });

  // Show the filter wrapper (the small "Source ▾" pill) only when the
  // active browse-mode is by-topic or by-year — the by-source view
  // doesn't need it (Matura/Textbook are already separate sub-panels
  // there).
  const wrap = document.getElementById('index-source-filter-wrap');
  function updateFilterVisibility() {
    if (!wrap) return;
    const activeMode = document.querySelector('.browse-mode-tab.active');
    const name = activeMode ? activeMode.dataset.mode : '';
    const show = (name === 'by-topic' || name === 'by-year');
    wrap.hidden = !show;
  }
  updateFilterVisibility();
  document.querySelectorAll('.browse-mode-tab').forEach(t => {
    t.addEventListener('click', () => setTimeout(updateFilterVisibility, 0));
  });

  applyFilter();
}

// Persistent open/close state for .collection <details> on the Problems
// page. localStorage keeps a {target -> bool} map; only explicitly OPEN
// entries are stored, so unseen sections stay closed by default.
const COLLAPSE_STATE_KEY = 'collection-open-v1';
function readCollapseState() {
  try {
    const raw = localStorage.getItem(COLLAPSE_STATE_KEY);
    if (!raw) return {};
    const v = JSON.parse(raw);
    return (v && typeof v === 'object') ? v : {};
  } catch { return {}; }
}
function writeCollapseState(map) {
  try {
    localStorage.setItem(COLLAPSE_STATE_KEY, JSON.stringify(map));
  } catch {}
}
function initCollectionPersistence() {
  const state = readCollapseState();
  document.querySelectorAll('details.collection[data-target]').forEach(d => {
    const t = d.dataset.target;
    if (!t) return;
    if (state[t]) d.open = true;
    d.addEventListener('toggle', () => {
      const cur = readCollapseState();
      if (d.open) cur[t] = true; else delete cur[t];
      writeCollapseState(cur);
    });
  });
}

// ---- Year-tab drag-to-reorder topics ---------------------------------------
// Stored shape: { yearIdx: [topicId, topicId, ...], ... } — only the
// year buckets the user has touched appear in the map; untouched ones
// fall back to the build-time order. Saved to localStorage so the
// arrangement persists across reloads.
// ── Main-topic grouping for Year/Topic tabs ─────────────────────────────
// Walks the rendered DOM and:
//  1. Hides sub-topic <details> at the top level (kids of .year-topic-list
//     and direct kids of .browse-mode-panel[data-mode="by-topic"]).
//  2. Inside each main-topic <details>, renders a chip row of subtopic
//     buttons (extracted from TOPIC_PARENT). Clicking chips toggles
//     visibility of cards within the main by their subtopic membership.
//
// Card subtopic membership is read from window.PROBLEMS (the meta list).
// A card belongs to subtopic S if the problem's topics array includes S.
function groupSubtopicsUnderMains() {
  if (!Array.isArray(window.PROBLEMS)) return;
  // Index problem→topics for fast lookup.
  const probTopics = {};
  window.PROBLEMS.forEach(p => { probTopics[String(p.n)] = p.topics || []; });
  // Helper: is a topic-id a main (4.X, 2 dotted parts) vs sub (4.X.Y).
  const isMain = (tid) => {
    if (!tid) return false;
    const code = tid.split(' ')[0] || '';
    return code.split('.').length === 2;
  };
  const isSubOf = (sub, main) => {
    if (!sub || !main) return false;
    const subCode = sub.split(' ')[0] || '';
    const mainCode = main.split(' ')[0] || '';
    return subCode.startsWith(mainCode + '.');
  };
  // Slug helper matching build_webpage.py's slug() — lowercase, non-alnum
  // collapsed to dashes, leading/trailing dashes stripped. Used to map
  // data-target="topic/4-1-logika" → "4.1 Logika".
  const slugify = (s) => (s || '').toLowerCase()
    .replace(/[čć]/g, 'c').replace(/š/g, 's').replace(/ž/g, 'z')
    .replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const SLUG_TO_TID = {};
  TOPIC_MAIN.forEach(m => { SLUG_TO_TID[slugify(m)] = m; });
  Object.keys(TOPIC_PARENT || {}).forEach(s => { SLUG_TO_TID[slugify(s)] = s; });
  const tidFromDetail = (d) => {
    if (d.dataset.topicId) return d.dataset.topicId;
    const t = d.dataset.target || '';
    // Strip any prefix like "topic/" or "year/N/" and take the last segment.
    const slug = t.split('/').pop();
    return SLUG_TO_TID[slug] || null;
  };
  // For chronological-last-main filtering: each problem appears only under
  // its LAST main topic in the DOM order. Build the order PER container.
  const cardLastMain = new Map(); // (container, cardId) → last main tid

  // Process each container that holds a flat mix of mains + subs.
  // For Year tab: each .year-topic-list. For Topic tab: the panel itself.
  const containers = [];
  document.querySelectorAll('.year-topic-list').forEach(c => containers.push(c));
  const topicPanel = document.querySelector('.browse-mode-panel[data-mode="by-topic"]');
  if (topicPanel) containers.push(topicPanel);
  containers.forEach(container => {
    // Find all direct-child topic <details>. Topic tab details don't carry
    // data-topic-id, so we derive the tid from data-target via SLUG_TO_TID.
    const allTopics = Array.from(container.children).filter(c =>
      c.tagName === 'DETAILS' && (c.dataset.topicId || c.dataset.target));
    // Annotate each detail with its derived tid for later lookups.
    allTopics.forEach(d => { d._tid = tidFromDetail(d); });
    // Hide sub-topic details at this level (they get folded into mains).
    allTopics.forEach(d => {
      const tid = d._tid;
      if (!tid || !isMain(tid)) d.style.display = 'none';
    });
    // Chronological order = DOM order of MAIN details in this container.
    // This already reflects any user reorder via the Year-tab reorder grid.
    const mainsOrdered = allTopics.filter(d => d._tid && isMain(d._tid))
                                  .map(d => d._tid);
    const mainOrderIdx = {};
    mainsOrdered.forEach((m, i) => { mainOrderIdx[m] = i; });
    // For every problem with a card in this container, compute its
    // "relevant mains" set (mains it has directly, plus mains-of-its-subs)
    // and pick the CHRONOLOGICALLY LAST one as the canonical placement.
    // Cards visible only under their last main; cloned/duplicated under
    // earlier mains will be removed below.
    const containerCardIds = new Set();
    container.querySelectorAll('.search-result-wrap[data-id]').forEach(c =>
      containerCardIds.add(c.dataset.id));
    const cardCanonicalMain = {};
    containerCardIds.forEach(id => {
      const ts = probTopics[id] || [];
      const relevantMains = new Set();
      ts.forEach(t => {
        if (isMain(t) && (t in mainOrderIdx)) relevantMains.add(t);
        const parent = TOPIC_PARENT && TOPIC_PARENT[t];
        if (parent && (parent in mainOrderIdx)) relevantMains.add(parent);
      });
      if (relevantMains.size === 0) return;
      // Pick the main with the highest index.
      let best = null, bestIdx = -1;
      relevantMains.forEach(m => {
        if (mainOrderIdx[m] > bestIdx) { bestIdx = mainOrderIdx[m]; best = m; }
      });
      cardCanonicalMain[id] = best;
    });
    // For each main-topic detail, build the subtopic chip row + populate
    // its card grid with only cards whose CANONICAL main is this main.
    allTopics.forEach(mainDetail => {
      const mainTid = mainDetail._tid;
      if (!mainTid || !isMain(mainTid)) return;
      // Find candidate subtopics: from TOPIC_PARENT, those whose parent is
      // this main. We'll filter to those actually represented by problems
      // canonically placed in this main.
      const candidateSubs = new Set();
      Object.keys(TOPIC_PARENT || {}).forEach(s => {
        if (isSubOf(s, mainTid)) candidateSubs.add(s);
      });
      // Cards canonically belonging to this main:
      const canonicalIds = [];
      Object.keys(cardCanonicalMain).forEach(id => {
        if (cardCanonicalMain[id] === mainTid) canonicalIds.push(id);
      });
      // Build presentSubs from canonical cards' topics.
      const presentSubs = new Set();
      canonicalIds.forEach(id => {
        (probTopics[id] || []).forEach(t => {
          if (candidateSubs.has(t)) presentSubs.add(t);
        });
      });
      // Build chip row INLINE in the summary, so chips render on the same
      // height as the main topic name (matching search-page UX).
      let contentArea = mainDetail.querySelector(':scope > div');
      if (!contentArea) return;
      const summary = mainDetail.querySelector(':scope > summary');
      if (summary && presentSubs.size > 0) {
        // Remove any prior chip row (re-running this function shouldn't dupe).
        const old = summary.querySelector('.subtopic-chip-row');
        if (old) old.remove();
        const chipRow = document.createElement('span');
        chipRow.className = 'subtopic-chip-row';
        const subsArr = Array.from(presentSubs).sort();
        subsArr.forEach(sub => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'filter-chip-sub subtopic-chip';
          btn.dataset.topic = sub;
          // Default: all chips PRESSED (all subtopics included), matching
          // search-page convention. Toggling OFF excludes that subtopic.
          btn.setAttribute('aria-pressed', 'true');
          btn.textContent = (typeof displayTopicName === 'function')
            ? displayTopicName(sub)
            : sub.split(' ').slice(1).join(' ');
          btn.addEventListener('click', (e) => {
            // Prevent the click from also toggling the <details> open/close
            // (the summary captures clicks for native details toggling).
            e.preventDefault(); e.stopPropagation();
            const pressed = btn.getAttribute('aria-pressed') === 'true';
            btn.setAttribute('aria-pressed', pressed ? 'false' : 'true');
            applySubtopicFilter(mainDetail, probTopics);
          });
          // Some browsers fire mousedown→summary-toggle before click on
          // buttons inside summary; guard both.
          btn.addEventListener('mousedown', (e) => e.stopPropagation());
          chipRow.appendChild(btn);
        });
        summary.appendChild(chipRow);
      }
      // Reconcile the main-detail's card grid against the canonical set:
      //  - Remove cards whose canonical main is NOT this main (they appear
      //    here from the build-time per-topic render but should now be
      //    shown under their later main).
      //  - Add cards (cloned) whose canonical main IS this main but which
      //    only exist in this container under a different (sub/main) detail.
      const mainGrid = contentArea.querySelector('.search-results');
      if (mainGrid) {
        // Drop cards not canonically here.
        Array.from(mainGrid.querySelectorAll('.search-result-wrap[data-id]')).forEach(c => {
          if (cardCanonicalMain[c.dataset.id] !== mainTid) c.remove();
        });
        const presentIds = new Set();
        mainGrid.querySelectorAll('.search-result-wrap[data-id]').forEach(c =>
          presentIds.add(c.dataset.id));
        // Source nodes anywhere in this container for ids we still need.
        const needed = new Set(canonicalIds.filter(id => !presentIds.has(id)));
        if (needed.size > 0) {
          // Walk every detail (including the hidden subs) for source cards.
          allTopics.forEach(d => {
            d.querySelectorAll('.search-result-wrap[data-id]').forEach(c => {
              const id = c.dataset.id;
              if (!needed.has(id) || presentIds.has(id)) return;
              presentIds.add(id);
              mainGrid.appendChild(c.cloneNode(true));
            });
          });
        }
      }
    });
    // Re-trigger any lazy hydration observers for newly-added cards.
    if (typeof _indexHydrateObserver !== 'undefined' && _indexHydrateObserver) {
      container.querySelectorAll('.search-result-wrap[data-id] .result-body').forEach(body => {
        if (body.dataset.hydrated !== '1') _indexHydrateObserver.observe(body);
      });
    }
    // Update each main detail's count to reflect actual card count.
    allTopics.forEach(d => {
      if (!d._tid || !isMain(d._tid)) return;
      const count = d.querySelectorAll('.search-result-wrap[data-id]').length;
      // Match the build-time .count span (direct child of summary), not the
      // chip labels inside our injected .subtopic-chip-row.
      const span = d.querySelector(':scope > summary > .count');
      if (span) span.textContent = '(' + count + ')';
    });
  });
}

function applySubtopicFilter(mainDetail, probTopics) {
  // Chips default to pressed = subtopic included. Toggle off = exclude.
  // Filter semantics (matching search page):
  //   - Build the set of ALL subtopics covered by this main's chips.
  //   - For each card: if it has at least one sub in pressedSet OR it has
  //     no sub in the chip-set at all (i.e. main-only), show it.
  //   - Hidden only if it has subs in chip-set AND none of those subs are
  //     currently pressed.
  const chips = Array.from(mainDetail.querySelectorAll('.subtopic-chip'));
  const allSubs = new Set(chips.map(c => c.dataset.topic));
  const pressed = new Set(chips.filter(c => c.getAttribute('aria-pressed') === 'true')
                                .map(c => c.dataset.topic));
  const cards = mainDetail.querySelectorAll('.search-result-wrap[data-id]');
  cards.forEach(card => {
    const ts = probTopics[card.dataset.id] || [];
    const subsOnCard = ts.filter(t => allSubs.has(t));
    let show;
    if (subsOnCard.length === 0) {
      // Card has no subtopic from this main — always show.
      show = true;
    } else {
      // Card has at least one sub-chip-eligible topic; show if any are pressed.
      show = subsOnCard.some(s => pressed.has(s));
    }
    card.classList.toggle('subtopic-filter-hidden', !show);
  });
  // Update count.
  const visible = mainDetail.querySelectorAll('.search-result-wrap[data-id]:not(.subtopic-filter-hidden)').length;
  const span = mainDetail.querySelector(':scope > summary > .count');
  if (span) span.textContent = '(' + visible + ')';
}

const YEAR_ORDER_KEY = 'year-topic-order-v1';
function readYearOrder() {
  try {
    const raw = localStorage.getItem(YEAR_ORDER_KEY);
    if (!raw) return {};
    const v = JSON.parse(raw);
    return (v && typeof v === 'object') ? v : {};
  } catch { return {}; }
}
function writeYearOrder(map) {
  try {
    localStorage.setItem(YEAR_ORDER_KEY, JSON.stringify(map));
  } catch {}
}
function captureCurrentYearOrder() {
  // Walk the DOM, return {yearIdx: [topicId,...]}.
  const out = {};
  document.querySelectorAll('.year-bucket[data-year-idx]').forEach(b => {
    const yi = b.dataset.yearIdx;
    const ids = Array.from(b.querySelectorAll(':scope > .year-topic-list > .year-topic'))
                     .map(t => t.dataset.topicId)
                     .filter(Boolean);
    out[yi] = ids;
  });
  return out;
}
function applyYearOrder(state) {
  Object.keys(state || {}).forEach(yi => {
    const bucket = document.querySelector(`.year-bucket[data-year-idx="${yi}"]`);
    if (!bucket) return;
    const list = bucket.querySelector(':scope > .year-topic-list');
    if (!list) return;
    const wanted = state[yi];
    if (!Array.isArray(wanted)) return;
    // First, find each topic in the *whole* year panel (it may have
    // been moved between buckets earlier) and move it into this list
    // in the wanted order. Topics not in `wanted` stay where they are.
    wanted.forEach(tid => {
      const all = document.querySelectorAll(
        `.year-topic[data-topic-id="${CSS.escape(tid)}"]`);
      const node = all[0];
      if (!node) return;
      list.appendChild(node);
    });
  });
}
function refreshYearCounts() {
  // After a reorder/move, each year-bucket's summary count and the
  // top-level "Year (N)" tab count must reflect the new groupings.
  // We count UNIQUE problem ids inside each bucket (ignoring filter-
  // hidden cards), mirroring applyApprovalFilter().
  document.querySelectorAll('.year-bucket').forEach(b => {
    const span = b.querySelector(':scope > summary .count');
    if (!span) return;
    const seen = new Set();
    b.querySelectorAll('.search-result-wrap[data-id]').forEach(w => {
      if (!w.classList.contains('unapproved-hidden') &&
          !w.classList.contains('filter-hidden')) {
        seen.add(w.dataset.id);
      }
    });
    span.textContent = `(${seen.size})`;
  });
}
// Build/refresh the topic-reorder grid inside the "Reorder topics"
// pill expansion. Each year is a column of draggable pills; dropping
// a pill onto another pill reorders within / across years and dropping
// on an empty column reassigns the topic to that year. All changes
// persist via writeYearOrder() and re-apply to the Year-tab DOM
// through applyYearOrder() so the Year tab stays in sync.
function initTopicReorderPanel() {
  const yearPanel = document.querySelector('.browse-mode-panel[data-mode="by-year"]');
  const grid      = document.getElementById('reorder-grid');
  const resetBtn  = document.getElementById('topic-reorder-reset');
  if (!yearPanel || !grid) return;

  // First, restore any saved order to the year tab BEFORE we read the
  // current arrangement (otherwise we'd snapshot the build-time order
  // and overwrite the user's saved one on first paint).
  const stored = readYearOrder();
  if (stored && Object.keys(stored).length > 0) {
    applyYearOrder(stored);
    refreshYearCounts();
  }

  // Helper: rebuild the reorder grid from the live Year-tab DOM. This
  // mirrors whatever order the year tab currently has, so the panel
  // is always in sync after a drag (and after a manual reset).
  function rebuildGrid() {
    grid.innerHTML = '';
    yearPanel.querySelectorAll('.year-bucket').forEach(bucket => {
      const yi      = bucket.dataset.yearIdx;
      const label   = bucket.dataset.yearLabel || '';
      const col     = document.createElement('div');
      col.className = 'reorder-year-col';
      col.dataset.yearIdx = yi;
      col.innerHTML = `<div class="reorder-year-label">${label}</div>`;
      bucket.querySelectorAll(':scope > .year-topic-list > .year-topic').forEach(topic => {
        const id    = topic.dataset.topicId || '';
        // Reorder only operates on MAIN topics (4.X with 2 dotted parts).
        // Sub-topics (4.X.Y) are folded under their parent main and don't
        // get reordered independently.
        const code = id.split(' ')[0] || '';
        if (code.split('.').length !== 2) return;
        // Strip a leading "4.x " prefix from the display name so the
        // pill matches the year-tab summary label.
        const sum   = topic.querySelector(':scope > summary');
        const txt   = sum ? sum.textContent.trim() : id;
        // Try to extract the count "(N)" suffix that sits at the end
        // of the summary; render it separately on the pill.
        const m     = txt.match(/^(.*?)\s*\(\s*(\d+)\s*\)\s*$/);
        const name  = m ? m[1].trim() : txt;
        const count = m ? parseInt(m[2], 10) : 0;
        const pill  = document.createElement('div');
        pill.className = 'reorder-topic-pill' + (count === 0 ? ' is-empty' : '');
        pill.draggable = true;
        pill.dataset.topicId = id;
        pill.innerHTML =
          `<span class="reorder-pill-name">${escapeHtml(name)}</span>` +
          `<span class="reorder-pill-count">(${count})</span>`;
        col.appendChild(pill);
      });
      grid.appendChild(col);
    });
    wireDrag();
    refreshResetVisibility();
  }

  function refreshResetVisibility() {
    if (!resetBtn) return;
    const stored = readYearOrder();
    resetBtn.hidden = Object.keys(stored).length === 0;
  }

  // Mirror the year-tab DOM to whatever order the reorder grid
  // currently shows. Called after every successful drop in the
  // reorder panel.
  function syncYearTabFromGrid() {
    grid.querySelectorAll('.reorder-year-col').forEach(col => {
      const yi     = col.dataset.yearIdx;
      const bucket = yearPanel.querySelector(`.year-bucket[data-year-idx="${yi}"]`);
      if (!bucket) return;
      const list   = bucket.querySelector(':scope > .year-topic-list');
      if (!list) return;
      col.querySelectorAll('.reorder-topic-pill').forEach(pill => {
        const tid = pill.dataset.topicId;
        const topic = yearPanel.querySelector(
          `.year-topic[data-topic-id="${CSS.escape(tid)}"]`);
        if (topic) list.appendChild(topic);
      });
    });
    refreshYearCounts();
  }

  function snapshotOrderToStorage() {
    const out = {};
    grid.querySelectorAll('.reorder-year-col').forEach(col => {
      const yi = col.dataset.yearIdx;
      out[yi] = Array.from(col.querySelectorAll('.reorder-topic-pill'))
                     .map(p => p.dataset.topicId).filter(Boolean);
    });
    writeYearOrder(out);
  }

  function wireDrag() {
    let dragging = null;
    const clearHints = () => {
      grid.querySelectorAll('.reorder-topic-pill.drop-before, .reorder-topic-pill.drop-after')
          .forEach(p => p.classList.remove('drop-before', 'drop-after'));
      grid.querySelectorAll('.reorder-year-col.drop-into')
          .forEach(c => c.classList.remove('drop-into'));
    };
    grid.querySelectorAll('.reorder-topic-pill').forEach(pill => {
      pill.addEventListener('dragstart', (ev) => {
        dragging = pill;
        pill.classList.add('dragging');
        try {
          ev.dataTransfer.setData('text/plain', pill.dataset.topicId || '');
          ev.dataTransfer.effectAllowed = 'move';
        } catch {}
      });
      pill.addEventListener('dragend', () => {
        if (dragging) dragging.classList.remove('dragging');
        dragging = null;
        clearHints();
      });
      pill.addEventListener('dragover', (ev) => {
        if (!dragging || dragging === pill) return;
        ev.preventDefault();
        ev.dataTransfer.dropEffect = 'move';
        const r = pill.getBoundingClientRect();
        const before = (ev.clientY < r.top + r.height / 2);
        clearHints();
        pill.classList.add(before ? 'drop-before' : 'drop-after');
      });
      pill.addEventListener('drop', (ev) => {
        if (!dragging || dragging === pill) return;
        ev.preventDefault();
        ev.stopPropagation();
        const r = pill.getBoundingClientRect();
        const before = (ev.clientY < r.top + r.height / 2);
        pill.parentNode.insertBefore(dragging, before ? pill : pill.nextSibling);
        clearHints();
        snapshotOrderToStorage();
        syncYearTabFromGrid();
        refreshResetVisibility();
      });
    });
    grid.querySelectorAll('.reorder-year-col').forEach(col => {
      col.addEventListener('dragover', (ev) => {
        if (!dragging) return;
        if (ev.target.closest('.reorder-topic-pill')) return;
        ev.preventDefault();
        ev.dataTransfer.dropEffect = 'move';
        col.classList.add('drop-into');
      });
      col.addEventListener('dragleave', (ev) => {
        if (!col.contains(ev.relatedTarget)) col.classList.remove('drop-into');
      });
      col.addEventListener('drop', (ev) => {
        if (!dragging) return;
        if (ev.target.closest('.reorder-topic-pill')) return;
        ev.preventDefault();
        col.appendChild(dragging);
        clearHints();
        snapshotOrderToStorage();
        syncYearTabFromGrid();
        refreshResetVisibility();
      });
    });
  }

  rebuildGrid();
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      writeYearOrder({});
      // Easiest way to restore the build-time order across both views
      // is a reload — the year tab paints from server-side default and
      // the panel rebuilds from that.
      location.reload();
    });
  }
}

// Show/hide the "Reorder topics" pill based on which browse-mode tab
// is active. Called once on init and again whenever the tabs switch.
function toggleTopicReorderPillVisibility() {
  const btn = document.getElementById('topic-reorder-chip');
  if (!btn) return;
  const activeTab = document.querySelector('.browse-mode-tab.active');
  const isYearMode = activeTab && activeTab.dataset.mode === 'by-year';
  btn.classList.toggle('is-hidden', !isYearMode);
  // Collapsing the panel when the pill becomes irrelevant keeps the
  // expansion from "stranded" under a different tab.
  if (!isYearMode) {
    const panel = document.getElementById('topic-reorder-panel');
    btn.setAttribute('aria-expanded', 'false');
    if (panel) panel.hidden = true;
  }
}

async function initIndexPage() {
  await bootstrapData();
  await fetchRemoteData();
  migrateLocalTopics();
  migrateLocalBboxes();
  initMenuBar();
  initSyncBar();
  initCollectionBar();
  bindBrowseModeTabs('by-topic');
  bindPageTabs('matura');
  // Restore previously-opened <details> BEFORE the hash handler (which
  // also opens sections by deep-link) so saved state doesn't fight it.
  initCollectionPersistence();
  handleSectionHash();
  window.addEventListener('hashchange', handleSectionHash);
  // Make sure we have the latest reviewer name from /user before colouring.
  await ensureNameFromToken();
  hydrateIndexCards();
  applyIndexStatuses();
  // Hide unapproved cards for signed-out viewers (default) and refresh
  // the summary/tab counts to reflect what's actually visible.
  applyApprovalFilter();
  // Source / year / pola / level / section filter for the By-topic
  // and By-year views (mirrors the Search page's filter UI).
  initIndexSourceFilter();
  // "Reorder topics" pill: only meaningful on the Year browse-mode.
  // initTopicReorderPanel builds the drag-grid inside the pill's
  // expansion AND restores any saved order to the Year tab itself.
  // Must run after initIndexSourceFilter (which injects the pill).
  initTopicReorderPanel();
  toggleTopicReorderPillVisibility();
  // Restructure Year/Topic tabs to show only main topics at the top level.
  // Each main-topic <details> gets a subtopic-chip filter inside that
  // toggles visibility of cards by their subtopic membership.
  groupSubtopicsUnderMains();
  document.querySelectorAll('.browse-mode-tab').forEach(t => {
    t.addEventListener('click', () => {
      // The handler in bindBrowseModeTabs flips .active synchronously,
      // so by the next microtask this query reflects the new state.
      setTimeout(toggleTopicReorderPillVisibility, 0);
    });
  });
  const exportAllBtn = document.getElementById('export-all');
  if (exportAllBtn) {
    exportAllBtn.addEventListener('click', () => {
      const data = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('prob-')) {
          try { data[k] = JSON.parse(localStorage.getItem(k)); } catch {}
        }
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'all-changes.json';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    });
  }
}
