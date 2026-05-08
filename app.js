// Per-problem state in localStorage. Key = `prob-NNN`.
// Stored fields: latex (string), bbox ([x1,y1,x2,y2]), outdated (bool),
//                topics (array of strings), approved_by (string|null).

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
    const latexMap = window.PROBLEMS_LATEX || {};
    for (const n of sel) {
      const row = document.createElement('div');
      row.className = 'collection-row';
      const link = document.createElement('a');
      link.href = `problem-${String(n).padStart(3,'0')}.html`;
      link.className = 'collection-link';
      const numEl = document.createElement('span');
      numEl.className = 'collection-num';
      numEl.textContent = `${n}.`;
      link.appendChild(numEl);
      const previewEl = document.createElement('span');
      previewEl.className = 'collection-preview';
      const data = latexMap[n] || latexMap[String(n)];
      if (data) {
        previewEl.innerHTML = latexToHtml(data.latex || '', n, data.tikz_count || 0);
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
  const tabs   = document.querySelectorAll('.page-tab, .exam-tab');
  const panels = document.querySelectorAll('.page-panel, .exam-panel');
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
  switchTab(initial || defaultName);
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
    const has = !!getToken();
    signedOut.hidden = has;
    signedIn.hidden  = !has;
    if (has) {
      const login = getName();
      const dn = login ? displayNameFor(login) : '…';
      if (displayNameEl) displayNameEl.textContent = dn;
      if (usernameSpan)  usernameSpan.textContent  = login || '…';
      // Only show the "@login" row if the display name differs from login.
      if (loginRowEl) {
        const showLogin = login && dn && dn !== login;
        loginRowEl.parentElement.style.display = showLogin ? '' : 'none';
      }
    }
    const n = Object.keys(pendingChanges()).length;
    pushBtn.disabled = !has || n === 0;
    pushBtn.textContent = n === 0
      ? '⬆ Push'
      : `⬆ Push (${n} edit${n === 1 ? '' : 's'})`;
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
  setBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
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
    if (!confirm('Sign out and forget GitHub token from this browser?')) return;
    setToken(''); setName('');
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
function latexToHtml(src, problemId, tikzCount) {
  if (!src) return '';
  const padded = (problemId == null) ? null : String(problemId).padStart(3, '0');
  let tikzIdx = 0;

  const stash = [];
  const stashIt = (s) => { stash.push(s); return `MJXSTASH${stash.length - 1}MJXSTASH`; };

  // Never let a line break put a comma/dot/semicolon/colon at the start
  // of the next line. Replace the space (or other whitespace) that
  // precedes one with a non-breaking space.
  src = src.replace(/[ \t]+([,.;:!?])/g, ' $1');
  src = src.replace(/\$\$([\s\S]+?)\$\$/g, (_, i) => stashIt('$$' + i + '$$'));
  src = src.replace(/\$([^\$\n]+?)\$/g,    (_, i) => stashIt('$'  + i + '$'));
  src = src.replace(/\\\[([\s\S]+?)\\\]/g, (_, i) => stashIt('\\[' + i + '\\]'));
  src = src.replace(/\\begin\{align\*?\}([\s\S]*?)\\end\{align\*?\}/g,
    (_, i) => stashIt('$$\\begin{aligned}' + i + '\\end{aligned}$$'));

  src = src.replace(/\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/g, (match) => {
    tikzIdx++;
    // Encode the source so the live-preview hydrator can ship it to the
    // pdflatex backend on demand. encodeURIComponent keeps this UTF-8 safe
    // and embeddable as an attribute value.
    const enc = encodeURIComponent(match);
    let initial;
    if (padded && tikzIdx <= (tikzCount || 0)) {
      const url = `tikz/prob-${padded}-fig${tikzIdx}.svg`;
      initial = `<img src="${url}" alt="TikZ figure ${tikzIdx}">`;
    } else {
      initial = `<span class="tikz-loading">rendering TikZ…</span>`;
    }
    return `<div class="tex-tikz" data-tikz-idx="${tikzIdx}" data-tikz-src="${enc}">${initial}</div>`;
  });

  src = src.replace(/\\begin\{tabular\}\{([^}]+)\}([\s\S]*?)\\end\{tabular\}/g,
    (_, _spec, body) => {
      body = body.replace(/\\hline/g, '');
      const rows = body.split(/\\\\/).map(r => r.trim()).filter(Boolean);
      const out = ['<table class="tex-tabular">'];
      for (const r of rows) {
        const cells = r.split('&').map(c => c.trim());
        out.push('<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>');
      }
      out.push('</table>');
      return out.join('');
    });

  src = src.replace(/\\begin\{itemize\}(\[[^\]]*\])?([\s\S]*?)\\end\{itemize\}/g,
    (_, _opt, body) => {
      const items = body.split(/\\item\s+/).map(s => s.trim()).filter(Boolean);
      return '<ul class="tex-list">' + items.map(i => `<li>${i}</li>`).join('') + '</ul>';
    });

  src = src.replace(/\\begin\{center\}([\s\S]*?)\\end\{center\}/g,
    (_, inner) => `<div class="tex-center">${inner.trim()}</div>`);

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

  src = src.replace(/MJXSTASH(\d+)MJXSTASH/g, (_, i) => stash[Number(i)]);
  return src;
}

// ---------- Topic editor (problem page) ------------------------------------
// Renders the editable topic chips into #topics-tags: each chip has an inline
// × that removes it; a + button at the end opens a topic picker.
function renderTopicsEditor(meta) {
  const row = document.getElementById('topics-tags');
  if (!row) return;
  const current = effectiveTopics(meta.n, meta.topics);
  renderTopicChipGroups(row, current, /*editable*/ true);
  // Append the + button at the end of the row.
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
  document.querySelectorAll('.problem-card').forEach(card => {
    const id = card.dataset.id;
    const s = effectiveState(id);
    card.classList.remove('status-outdated', 'status-approved-me', 'status-approved-other');
    if (s.approved_by) {
      if (me && s.approved_by === me) card.classList.add('status-approved-me');
      else                            card.classList.add('status-approved-other');
    }
    if (s.outdated) card.classList.add('status-outdated');
  });
}

function renderTeXPreview(srcText, target, problemId, tikzCount, hydrateTikz) {
  target.innerHTML = latexToHtml(srcText, problemId, tikzCount);
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

// Per-(preview node) lock map: figure index -> {w, h} measured once. So
// every subsequent fresh render of the same TikZ figure (1st, 2nd, …) lands
// in the same box, preventing the visible jitter the user complained about.
async function hydrateTikzInPreview(target) {
  if (!target._tikzLocks) target._tikzLocks = new Map();
  const locks = target._tikzLocks;

  const els = Array.from(target.querySelectorAll('.tex-tikz[data-tikz-src]'));

  // Step 1: re-apply any existing locks immediately. This handles the case
  // where the latex was edited (innerHTML replaced) and the new .tex-tikz
  // divs need to inherit the size from the previous render.
  for (const el of els) {
    const idx = el.getAttribute('data-tikz-idx');
    const lock = idx != null && locks.get(idx);
    if (lock) {
      el.style.width  = lock.w + 'px';
      el.style.height = lock.h + 'px';
      el.classList.add('is-locked');
    }
  }

  await Promise.all(els.map(async (el) => {
    const enc = el.getAttribute('data-tikz-src');
    if (!enc) return;
    let src;
    try { src = decodeURIComponent(enc); } catch { return; }
    const idx = el.getAttribute('data-tikz-idx');

    // Step 2: if there's no lock yet for this index, snapshot the current
    // rendered size of whatever's inside (the build-time <img> or a placeholder)
    // and pin it. We wait for an unloaded <img> to settle so we measure the
    // real figure dimensions, not 0×0.
    if (idx != null && !locks.has(idx)) {
      const inner = el.firstElementChild;
      if (inner) {
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
    if (!svg) return;
    el.innerHTML = svg;
    const svgEl = el.querySelector('svg');
    if (svgEl) {
      // Step 3: if we still don't have a lock for this idx (e.g. the figure
      // started as a placeholder for a freshly-typed tikz block), capture
      // the natural size of the just-arrived SVG and lock to it.
      if (idx != null && !locks.has(idx)) {
        // Read intrinsic size BEFORE stripping width/height attributes.
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

function drawCropFromImage(canvas, img, bbox, [imgW, imgH]) {
  let [x1, y1, x2, y2] = bbox.map(Math.round);
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
  await fetchRemoteData();
  migrateLocalTopics();
  const id    = meta.n;
  const state = effectiveState(id);
  initMenuBar();
  initSyncBar();
  initCollectionBar();

  const ta            = $('latex-source');
  const preview       = $('preview');
  const badge         = $('status-badge');
  const approveCb     = $('approve-cb');
  const approvalChip  = $('approval-chip');
  const exportBtn     = $('export-changes');

  // -------- LaTeX --------
  ta.value = state.latex !== undefined ? state.latex : meta.latex;
  updateBadge(state.outdated);
  approveCb.checked = !!state.approved_by;
  updateApprovalChip(state.approved_by || null);
  renderTopicsEditor(meta);
  // Expose a refresh hook so changes to display names elsewhere (e.g. from
  // the dropdown) update the chip text without a reload.
  window.refreshApprovalChip = () => {
    const cur = (loadState(id).approved_by) || ((REMOTE_DATA && REMOTE_DATA[id]) ? REMOTE_DATA[id].approved_by : null);
    updateApprovalChip(cur || null);
  };
  // On first render, only hit the /tikz backend if the LaTeX has been edited
  // away from the build-time source — otherwise the pre-rendered SVGs that
  // ship with the page are already correct and there's no point waiting for
  // a network round-trip.
  renderTeXPreview(ta.value, preview, meta.n, meta.tikz_count, ta.value !== meta.latex);

  let timer;
  ta.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const s = loadState(id);
      s.latex = ta.value;
      saveState(id, s);
      // Hydrate TikZ live: every keystroke (after debounce) re-fetches a
      // fresh SVG from pdflatex; identical sources are served from cache.
      renderTeXPreview(ta.value, preview, meta.n, meta.tikz_count, true);
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

  const instances = meta.instances || [];
  instances.forEach((inst, idx) => initInstance(inst, idx));

  function initInstance(inst, idx) {
    const cropView   = document.getElementById(`crop-view-${idx}`);
    const cropCanvas = document.getElementById(`crop-canvas-${idx}`);
    const editor     = document.getElementById(`crop-editor-${idx}`);
    const fullCanvas = document.getElementById(`full-page-canvas-${idx}`);
    const selectionBox = document.getElementById(`selection-box-${idx}`);
    if (!cropView || !cropCanvas) return;
    const editBtn   = document.querySelector(`.edit-crop-btn[data-instance="${idx}"]`);
    const resetBtn  = document.querySelector(`.reset-crop-btn[data-instance="${idx}"]`);
    const saveBtn   = document.querySelector(`.save-crop-btn[data-instance="${idx}"]`);
    const cancelBtn = document.querySelector(`.cancel-crop-btn[data-instance="${idx}"]`);

    let currentBbox = getBbox(idx, inst.bbox_default || [0, 0, 100, 100]);
    let pendingBbox = null;
    let pageLoaded = false;
    let editorScale = 1;
    let dragStart = null;

    const pageImg = new Image();
    pageImg.addEventListener('load', () => {
      pageLoaded = true;
      drawCropFromImage(cropCanvas, pageImg, currentBbox, inst.page_size);
    });
    pageImg.addEventListener('error', () => {
      cropCanvas.replaceWith(Object.assign(document.createElement('div'), {
        className: 'tex-figure-placeholder',
        textContent: '(source page image not available)',
      }));
    });
    if (inst.page_image) pageImg.src = inst.page_image;

    function refresh() {
      if (pageLoaded) drawCropFromImage(cropCanvas, pageImg, currentBbox, inst.page_size);
    }
    function show() { cropView.hidden = true; editor.hidden = false; }
    function hide() { editor.hidden = true; cropView.hidden = false; }

    if (editBtn) editBtn.addEventListener('click', () => {
      if (!pageLoaded) return;
      pendingBbox = currentBbox.slice();
      show();
      setupEditor();
      if (saveBtn) saveBtn.disabled = false;
    });
    if (cancelBtn) cancelBtn.addEventListener('click', () => {
      pendingBbox = null;
      hide();
    });
    if (saveBtn) saveBtn.addEventListener('click', () => {
      if (!pendingBbox) return;
      currentBbox = pendingBbox.slice();
      setBbox(idx, currentBbox);
      // Mark the problem as outdated since the crop changed.
      const s = loadState(id);
      s.outdated = true;
      saveState(id, s);
      updateBadge(true);
      refresh();
      hide();
      const bar = document.getElementById('gh-sync');
      if (bar && typeof bar._refresh === 'function') bar._refresh();
    });
    if (resetBtn) resetBtn.addEventListener('click', () => {
      currentBbox = (inst.bbox_default || []).slice();
      clearBbox(idx);
      refresh();
      const bar = document.getElementById('gh-sync');
      if (bar && typeof bar._refresh === 'function') bar._refresh();
    });

    function setupEditor() {
      const [imgW, imgH] = inst.page_size;
      const maxW = Math.min(900, document.documentElement.clientWidth - 60);
      const scale = Math.min(maxW / imgW, 700 / imgH);
      editorScale = scale;
      fullCanvas.width  = Math.round(imgW * scale);
      fullCanvas.height = Math.round(imgH * scale);
      const ctx = fullCanvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, fullCanvas.width, fullCanvas.height);
      ctx.drawImage(pageImg, 0, 0, fullCanvas.width, fullCanvas.height);
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
        clamp(Math.round(px / editorScale), 0, inst.page_size[0]),
        clamp(Math.round(py / editorScale), 0, inst.page_size[1]),
      ];
    }
    fullCanvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
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
  }

  // -------- Outdated flag (click the status badge to toggle) --------
  badge.addEventListener('click', () => {
    const s = loadState(id);
    s.outdated = !s.outdated;
    saveState(id, s);
    updateBadge(s.outdated);
    const bar = document.getElementById('gh-sync');
    if (bar && typeof bar._refresh === 'function') bar._refresh();
  });

  // -------- Approve --------
  approveCb.addEventListener('change', async () => {
    const s = loadState(id);
    if (approveCb.checked) {
      let myName = getName();
      if (!myName) {
        if (getToken()) await ensureNameFromToken();
        myName = getName();
      }
      if (!myName) {
        alert('Please sign in to GitHub first (Sign in button in the top-right).');
        approveCb.checked = false;
        return;
      }
      s.approved_by = myName;
    } else {
      s.approved_by = null;
    }
    saveState(id, s);
    updateApprovalChip(s.approved_by);
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

  function updateApprovalChip(login) {
    if (login) {
      approvalChip.hidden = false;
      approvalChip.textContent = `${displayNameFor(login)} ✓`;
    } else {
      approvalChip.hidden = true;
    }
  }
}

// ---------- Search page ----------------------------------------------------
// Live filter UI over window.PROBLEMS (embedded in search.html). Every filter
// input triggers re-render — there's no submit button.
async function initSearchPage(opts) {
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

  // Compute available ranges/options from data
  const yearMin = Math.min(...PROBLEMS.map(p => parseInt(p.year, 10)));
  const yearMax = Math.max(...PROBLEMS.map(p => parseInt(p.year, 10)));
  const ptsArr  = flatPointsNs();
  const pointsMin = ptsArr.length ? Math.min(...ptsArr) : 0;
  const pointsMax = ptsArr.length ? Math.max(...ptsArr) : 0;
  const allSources  = [...new Set(PROBLEMS.map(p => p.source).filter(Boolean))];
  const allPolas    = gather(PROBLEMS, 'polas_n').sort();
  const allLevels   = gather(PROBLEMS, 'levels')
                        .sort((a, b) => (LEVEL_ORDER_JS[a]||9) - (LEVEL_ORDER_JS[b]||9));
  const allSections = gather(PROBLEMS, 'section_letters').sort();
  // Topics vocabulary = union of master + actually-used (incl any custom)
  const usedTopics = new Set();
  PROBLEMS.forEach(p => {
    effectiveTopics(p.n, p.topics).forEach(t => usedTopics.add(t));
  });
  const allTopicsArr = [...new Set([...ALL_TOPICS, ...Array.from(usedTopics)])];

  // Filter state — defaults to "everything selected"
  const state = {
    yearMin, yearMax, pointsMin, pointsMax,
    sources:  new Set(allSources),
    polas:    new Set(allPolas),
    levels:   new Set(allLevels),
    sections: new Set(allSections),
    topics:   new Set(allTopicsArr),
  };

  // Build filter UI
  const root = document.getElementById('filters');
  if (!root) return;
  root.innerHTML = `
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
        <label class="filter-label">Source</label>
        <div class="filter-chip-group" id="f-sources">
          ${allSources.map(s =>
            `<button type="button" class="filter-chip filter-chip-source" data-val="${escapeHtml(s)}" aria-pressed="true">${escapeHtml(s)}</button>`
          ).join('')}
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
        <div class="filter-chip-group" id="f-sections">
          ${allSections.map(s =>
            `<button type="button" class="filter-chip filter-chip-section" data-val="${escapeHtml(s)}" aria-pressed="true">${escapeHtml(s)}</button>`
          ).join('')}
        </div>
      </div>
    </div>
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
      render();
    });
  }

  ['f-year-min','f-year-max','f-points-min','f-points-max'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      state.yearMin   = parseInt(document.getElementById('f-year-min').value, 10);
      state.yearMax   = parseInt(document.getElementById('f-year-max').value, 10);
      state.pointsMin = parseInt(document.getElementById('f-points-min').value, 10);
      state.pointsMax = parseInt(document.getElementById('f-points-max').value, 10);
      render();
    });
  });
  wireChipGroup('f-sources',  state.sources);
  wireChipGroup('f-polas',    state.polas);
  wireChipGroup('f-levels',   state.levels);
  wireChipGroup('f-sections', state.sections);
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
    renderTopicFilters();
    render();
  });
  document.getElementById('topics-none').addEventListener('click', () => {
    state.topics.clear();
    renderTopicFilters();
    render();
  });

  // Filter + render. A problem matches if its scalar fields are in range
  // and at least one value of each multi-valued field is selected.
  function matches(p) {
    const yr = parseInt(p.year, 10);
    if (yr < state.yearMin || yr > state.yearMax) return false;
    const pointsNs = p.points_ns || [];
    const ptsOk = pointsNs.length === 0
      ? state.pointsMin <= 0 && 0 <= state.pointsMax
      : pointsNs.some(n => n >= state.pointsMin && n <= state.pointsMax);
    if (!ptsOk) return false;
    if (!state.sources.has(p.source)) return false;
    if (!(p.polas_n || []).some(v => state.polas.has(v))) return false;
    if (!(p.levels  || []).some(v => state.levels.has(v))) return false;
    if (!(p.section_letters || []).some(v => state.sections.has(v))) return false;
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
  function render() {
    const out = PROBLEMS.filter(matches);
    lastMatches = out;
    countEl.textContent = `${out.length} of ${PROBLEMS.length} problems`;
    resultsEl.innerHTML = out.map(p => {
      const sel = isMarked(p.n);
      const cls = sel ? ('is-selected ' + markedClass).trim() : '';
      const dis = sel && markedDisabled ? 'disabled' : '';
      // showEditLink (true on the search page, false in modals) doubles
      // as the "card itself is clickable → opens the problem page" flag.
      // The data-href lives on the HOT-ZONE so clicks on the body (which
      // pass through the pointer-events:none card) reach the navigable
      // target underneath.
      const href = showEditLink
        ? `problem-${String(p.n).padStart(3,'0')}.html` : '';
      const dataHref = href ? `data-href="${href}"` : '';
      return `<div class="search-result-wrap">
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
    // Render the LaTeX previews
    out.forEach(p => {
      const body = resultsEl.querySelector(`.result-body[data-id="${p.n}"]`);
      if (!body) return;
      const ed = effectiveState(p.n);
      const latex = (ed.latex !== undefined) ? ed.latex : p.latex;
      body.innerHTML = latexToHtml(latex, p.n, p.tikz_count || 0);
    });
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise([resultsEl]).catch(() => {});
    }
    // Hover state for each card wrap. Manage via JS so the elevation
    // and expansion happen synchronously — :has()-based CSS hover has a
    // 1-frame paint delay in some browsers.
    resultsEl.querySelectorAll('.search-result-wrap').forEach(wrap => {
      const hot    = wrap.querySelector('.search-result-hot-zone');
      const addBtn = wrap.querySelector('.result-add');
      const targets = [hot, addBtn].filter(Boolean);
      const enter = () => wrap.classList.add('is-hovered');
      const leave = () => {
        // Defer one task so transitions between hot-zone and Add button
        // (cursor crossing the boundary) don't flicker the class off.
        setTimeout(() => {
          const stillIn = targets.some(t => t.matches(':hover'));
          if (!stillIn) wrap.classList.remove('is-hovered');
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
      return `${pre}${nMarker}\\item ${(item.content || '').trim()}`;
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
      const empty = document.createElement('div');
      empty.className = 'exam-empty';
      empty.textContent = 'No problems in the exam yet — add one below.';
      preview.appendChild(empty);
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
      const tikz = (item.n != null && byN[item.n]) ? (byN[item.n].tikz_count || 0) : 0;
      body.innerHTML = latexToHtml(item.content || '', item.n, tikz);
      // Inline the problem number with the first paragraph (no line break).
      const numHtml = `<strong class="result-num">${idx + 1}. </strong>`;
      const firstP = body.querySelector('p');
      if (firstP) firstP.insertAdjacentHTML('afterbegin', numHtml);
      else        body.insertAdjacentHTML('afterbegin', numHtml);
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
          return `<div class="search-result ${inExam ? 'is-in-exam' : ''}">
            <span class="result-num">${n}.</span>
            <div class="result-body" data-id="${n}" data-tikz="${data.tikz_count || 0}"></div>
            <div class="result-actions">
              <button type="button" class="result-add ${inExam ? 'is-selected' : ''}"
                      data-n="${n}" title="${inExam ? 'Remove' : 'Add'}">${inExam ? '×' : '+'}</button>
            </div>
          </div>`;
        })
        .join('');
      // Render LaTeX previews inside each card.
      collection.forEach(n => {
        const data = byN[n];
        if (!data) return;
        const bodyEl = cardsContainer.querySelector('.result-body[data-id="' + n + '"]');
        if (!bodyEl) return;
        const ed = effectiveState(n);
        const latex = (ed.latex !== undefined) ? ed.latex : data.latex;
        bodyEl.innerHTML = latexToHtml(latex, n, data.tikz_count || 0);
      });
      if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise([cardsContainer]).catch(() => {});
      }
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

async function initIndexPage() {
  await fetchRemoteData();
  migrateLocalTopics();
  initMenuBar();
  initSyncBar();
  initCollectionBar();
  bindPageTabs('matura');
  handleSectionHash();
  window.addEventListener('hashchange', handleSectionHash);
  // Make sure we have the latest reviewer name from /user before colouring.
  await ensureNameFromToken();
  applyIndexTopics();
  applyIndexStatuses();
  applyCardSectionsState();
  bindCardSectionToggles();
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
