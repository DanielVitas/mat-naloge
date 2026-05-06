// Per-problem state in localStorage. Key = `prob-NNN`.
// Stored fields: latex (string), bbox ([x1,y1,x2,y2]), outdated (bool),
//                topics (array of strings), approved_by (string|null).

// Master vocabulary of high-school math topics, used by the topic picker.
// Order roughly groups by area; the picker shows a search field for quick filter.
const ALL_TOPICS = [
  // Algebra
  "Algebra", "Powers", "Roots", "Equations", "Inequalities",
  "Systems of equations", "Polynomials",
  // Functions
  "Linear function", "Quadratic function", "Polynomial function",
  "Rational function", "Exponential function", "Logarithmic function",
  "Trigonometric functions", "Inverse function", "Composite function",
  // Geometry — plane
  "Geometry", "Polygons", "Triangle", "Right triangle", "Quadrilateral",
  "Parallelogram", "Trapezoid", "Circle", "Area", "Perimeter",
  "Similarity", "Congruence",
  // Geometry — solids
  "Solids", "Cylinder", "Cone", "Sphere", "Pyramid", "Prism", "Volume",
  // Conic sections
  "Conic sections", "Parabola", "Ellipse", "Hyperbola",
  // Trig & vectors
  "Trigonometry", "Vectors", "Analytic geometry",
  // Calculus
  "Calculus", "Limits", "Continuity", "Derivative", "Integration",
  "Applications of derivatives", "Optimization",
  // Discrete & misc
  "Logic", "Set Theory", "Number Theory", "Combinatorics", "Probability",
  "Statistics", "Sequences", "Arithmetic sequence", "Geometric sequence",
  "Series", "Complex numbers", "Logarithms",
];

const GH = {
  owner: 'DanielVitas',
  repo:  'mat-naloge',
  branch: 'main',
  path: 'data.json',
  api() { return `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${this.path}`; },
};

// GitHub login of the repo owner. Only this user can create brand-new topics
// (anyone signed in can still search and assign topics that already exist).
const OWNER_LOGIN = 'DanielVitas';
function isOwner() { return getName() === OWNER_LOGIN; }

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
function effectiveTopics(id, defaults) {
  const s = effectiveState(id);
  if (Array.isArray(s.topics)) return s.topics.slice();
  return Array.isArray(defaults) ? defaults.slice() : [];
}

// Persist a new topics list for a problem to localStorage.
function setTopics(id, topics) {
  const s = loadState(id);
  s.topics = (topics || []).slice();
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
    // A local entry is "pending" if any of its fields differs from remote.
    const same = (
      JSON.stringify(local.latex)        === JSON.stringify(r.latex) &&
      JSON.stringify(local.bbox)         === JSON.stringify(r.bbox)  &&
      JSON.stringify(!!local.outdated)   === JSON.stringify(!!r.outdated) &&
      JSON.stringify(local.approved_by || null) === JSON.stringify(r.approved_by || null) &&
      JSON.stringify(local.topics || null) === JSON.stringify(r.topics || null)
    );
    if (!same) out[id] = local;
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
}

// On the index page, if the URL has a hash like #matura or
// #matura/2025/spomladanski-rok/or, find the deepest matching <details>,
// open it and all ancestor <details>, then scroll it into view.
function handleSectionHash() {
  const hash = (location.hash || '').replace('#', '').trim();
  if (!hash) return;
  // Try the exact path first; if not found, walk up by stripping segments.
  const parts = hash.split('/');
  let target = null;
  while (parts.length && !target) {
    const path = parts.join('/');
    target = document.querySelector(`details.collection[data-target="${path}"]`);
    if (!target) parts.pop();
  }
  if (!target) return;
  // Walk up the DOM, opening every ancestor <details>.
  let cur = target;
  while (cur) {
    if (cur.tagName === 'DETAILS') cur.open = true;
    cur = cur.parentElement;
  }
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  src = src.replace(/\$\$([\s\S]+?)\$\$/g, (_, i) => stashIt('$$' + i + '$$'));
  src = src.replace(/\$([^\$\n]+?)\$/g,    (_, i) => stashIt('$'  + i + '$'));
  src = src.replace(/\\\[([\s\S]+?)\\\]/g, (_, i) => stashIt('\\[' + i + '\\]'));
  src = src.replace(/\\begin\{align\*?\}([\s\S]*?)\\end\{align\*?\}/g,
    (_, i) => stashIt('$$\\begin{aligned}' + i + '\\end{aligned}$$'));

  src = src.replace(/\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/g, () => {
    tikzIdx++;
    if (padded && tikzIdx <= (tikzCount || 0)) {
      const url = `tikz/prob-${padded}-fig${tikzIdx}.svg`;
      return `<div class="tex-tikz"><img src="${url}" alt="TikZ figure ${tikzIdx}"></div>`;
    }
    return '<div class="tex-figure-placeholder">[TikZ figure — see original on the right]</div>';
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
  let html = '';
  for (const t of current) {
    html += '<span class="tag topic editable">'
         +    escapeHtml(t)
         +    '<button class="topic-remove" data-topic="' + escapeHtml(t)
         +      '" aria-label="remove topic">×</button>'
         +  '</span>';
  }
  html += '<button class="topic-add" id="topic-add" aria-label="add topic" title="Add a topic">+</button>';
  row.innerHTML = html;
  row.querySelectorAll('.topic-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      const t = btn.dataset.topic;
      const next = effectiveTopics(meta.n, meta.topics).filter(x => x !== t);
      setTopics(meta.n, next);
      renderTopicsEditor(meta);
      const bar = document.getElementById('gh-sync');
      if (bar && typeof bar._refresh === 'function') bar._refresh();
    });
  });
  const addBtn = row.querySelector('#topic-add');
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
    const available = ALL_TOPICS.filter(t => !current.has(t)
      && t.toLowerCase().includes(f));
    if (available.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'topic-picker-empty';
      empty.textContent = 'No matches.';
      list.appendChild(empty);
    } else {
      for (const t of available) {
        const btn = document.createElement('button');
        btn.className = 'topic-picker-item';
        btn.type = 'button';
        btn.textContent = t;
        btn.addEventListener('click', (e) => {
          e.preventDefault(); e.stopPropagation();
          addTopic(t);
        });
        list.appendChild(btn);
      }
    }
    // If search has a non-empty value that isn't already in the list,
    // offer to add it as a custom topic — but ONLY for the repo owner.
    // Non-owners just see no extra entry.
    const query = filter.trim();
    const isCustom = query && !current.has(query) &&
        !ALL_TOPICS.some(t => t.toLowerCase() === query.toLowerCase());
    if (isCustom && isOwner()) {
      const btn = document.createElement('button');
      btn.className = 'topic-picker-item topic-picker-custom';
      btn.type = 'button';
      btn.innerHTML = 'Add new topic: <strong>' + escapeHtml(query) + '</strong>';
      btn.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        addTopic(query);
      });
      list.appendChild(btn);
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
      // Prefer an exact-case-insensitive match from the master list
      const match = ALL_TOPICS.find(t => t.toLowerCase() === q.toLowerCase()
        && !current.has(t));
      if (match) {
        addTopic(match);
      } else if (isOwner()) {
        // Only the owner can create a brand-new topic via Enter.
        addTopic(q);
      }
      // Non-owner with no match: silently ignore — the picker already shows
      // the "Only DanielVitas can add new topics." note explaining why.
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
    const tagsEl = card.querySelector('.tags');
    if (!tagsEl) return;
    // Remove existing topic chips (they were rendered server-side after
    // the regular tag chips). Topic chips are <span class="tag topic">.
    tagsEl.querySelectorAll('.tag.topic').forEach(el => el.remove());
    for (const t of eff) {
      const span = document.createElement('span');
      span.className = 'tag topic';
      span.textContent = t;
      tagsEl.appendChild(span);
    }
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

function renderTeXPreview(srcText, target, problemId, tikzCount) {
  target.innerHTML = latexToHtml(srcText, problemId, tikzCount);
  if (window.MathJax && window.MathJax.typesetPromise) {
    MathJax.typesetPromise([target]).catch(() => {});
  }
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
  const id    = meta.n;
  const state = effectiveState(id);
  initMenuBar();
  initSyncBar();

  const ta            = $('latex-source');
  const preview       = $('preview');
  const cropView      = $('crop-view');
  const cropCanvas    = $('crop-canvas');
  const editor        = $('crop-editor');
  const fullCanvas    = $('full-page-canvas');
  const selectionBox  = $('selection-box');
  const editBtn       = $('edit-crop');
  const resetBtn      = $('reset-crop');
  const saveBtn       = $('save-crop');
  const cancelBtn     = $('cancel-crop');
  const badge         = $('status-badge');
  const approveCb     = $('approve-cb');
  const approvalChip  = $('approval-chip');
  const exportBtn     = $('export-changes');

  function showEditor() {
    cropView.hidden = true;
    editor.hidden   = false;
  }
  function hideEditor() {
    editor.hidden   = true;
    cropView.hidden = false;
  }

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
  renderTeXPreview(ta.value, preview, meta.n, meta.tikz_count);

  let timer;
  ta.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const s = loadState(id);
      s.latex = ta.value;
      saveState(id, s);
      renderTeXPreview(ta.value, preview, meta.n, meta.tikz_count);
    }, 250);
  });

  // -------- Crop --------
  // Load source page image once and reuse for both display + editor.
  const pageImg = new Image();
  let pageLoaded = false;
  let currentBbox = state.bbox || meta.bbox_default || [0, 0, 100, 100];
  let pendingBbox = null;       // selection in editor before save

  pageImg.addEventListener('load', () => {
    pageLoaded = true;
    drawCropFromImage(cropCanvas, pageImg, currentBbox, meta.page_size);
  });
  pageImg.addEventListener('error', () => {
    cropCanvas.replaceWith(Object.assign(document.createElement('div'), {
      className: 'tex-figure-placeholder',
      textContent: '(source page image not available)',
    }));
  });
  if (meta.page_image) pageImg.src = meta.page_image;

  function refreshCrop() {
    if (pageLoaded) drawCropFromImage(cropCanvas, pageImg, currentBbox, meta.page_size);
  }

  // -------- Editor --------
  let editorScale = 1;       // pixels per source-pixel
  let editorRect = null;     // bounding rect of full canvas
  let dragStart = null;

  editBtn.addEventListener('click', () => {
    if (!pageLoaded) return;
    pendingBbox = currentBbox.slice();
    showEditor();
    setupEditor();
    saveBtn.disabled = false;
  });

  cancelBtn.addEventListener('click', () => {
    pendingBbox = null;
    hideEditor();
  });

  saveBtn.addEventListener('click', () => {
    if (!pendingBbox) return;
    currentBbox = pendingBbox.slice();
    const s = loadState(id);
    s.bbox = currentBbox;
    saveState(id, s);
    refreshCrop();
    hideEditor();
  });

  resetBtn.addEventListener('click', () => {
    currentBbox = (meta.bbox_default || []).slice();
    const s = loadState(id);
    delete s.bbox;
    saveState(id, s);
    refreshCrop();
  });

  function setupEditor() {
    const [imgW, imgH] = meta.page_size;
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
      clamp(Math.round(px / editorScale), 0, meta.page_size[0]),
      clamp(Math.round(py / editorScale), 0, meta.page_size[1]),
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

  // Touch support
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
        // No name yet — try to fetch it from GitHub /user using the token.
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

  // Mark outdated when bbox changes (after save) — but not on every keystroke
  saveBtn.addEventListener('click', () => {
    const s = loadState(id);
    s.outdated = true;
    saveState(id, s);
    updateBadge(true);
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
      badge.textContent = '⚠ transcript needs redoing';
      badge.className = 'status-badge outdated';
    } else {
      badge.textContent = '✓ up to date';
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

async function initIndexPage() {
  await fetchRemoteData();
  initMenuBar();
  initSyncBar();
  handleSectionHash();
  window.addEventListener('hashchange', handleSectionHash);
  // Make sure we have the latest reviewer name from /user before colouring.
  await ensureNameFromToken();
  applyIndexTopics();
  applyIndexStatuses();
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
