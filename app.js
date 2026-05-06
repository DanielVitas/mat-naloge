// Per-problem state in localStorage. Key = `prob-NNN`.
// Stored fields: latex (string), bbox ([x1,y1,x2,y2]), outdated (bool).

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
      JSON.stringify(local.latex)    === JSON.stringify(r.latex) &&
      JSON.stringify(local.bbox)     === JSON.stringify(r.bbox)  &&
      JSON.stringify(!!local.outdated) === JSON.stringify(!!r.outdated)
    );
    if (!same) out[id] = local;
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
  alert('Pushed. GitHub Pages will redeploy in ~30 s.');
  // give Pages a moment, then reload
  setTimeout(() => location.reload(), 1500);
  return true;
}

// Wire up the GitHub-sync UI block (shared between index and problem pages).
function initSyncBar() {
  const bar = document.getElementById('gh-sync');
  if (!bar) return;
  const tokenInput = bar.querySelector('#gh-token-input');
  const tokenRow   = bar.querySelector('.gh-token-row');
  const statusRow  = bar.querySelector('.gh-status-row');
  const pendingTag = bar.querySelector('#gh-pending');
  const tokenStatus= bar.querySelector('#gh-token-status');
  const setBtn     = bar.querySelector('#gh-set-token');
  const clearBtn   = bar.querySelector('#gh-clear-token');
  const pushBtn    = bar.querySelector('#gh-push');
  const editTokenBtn = bar.querySelector('#gh-edit-token');

  function refresh() {
    const has = !!getToken();
    tokenStatus.textContent = has ? 'token set' : 'no token';
    tokenStatus.className   = 'pending ' + (has ? 'none' : '');
    if (has) tokenRow.classList.add('collapsed'); else tokenRow.classList.remove('collapsed');
    pushBtn.disabled = !has;
    const n = Object.keys(pendingChanges()).length;
    pendingTag.textContent = n === 0 ? 'no pending edits' : `${n} pending`;
    pendingTag.className   = 'pending ' + (n === 0 ? 'none' : '');
  }

  setBtn.addEventListener('click', () => {
    const v = tokenInput.value.trim();
    if (!v) return;
    setToken(v);
    tokenInput.value = '';
    refresh();
  });
  clearBtn.addEventListener('click', () => {
    if (!confirm('Forget GitHub token from this browser?')) return;
    setToken('');
    refresh();
  });
  if (editTokenBtn) {
    editTokenBtn.addEventListener('click', () => {
      tokenRow.classList.remove('collapsed');
      tokenInput.focus();
    });
  }
  pushBtn.addEventListener('click', async () => {
    pushBtn.disabled = true;
    pushBtn.textContent = 'Pushing…';
    const ok = await pushChanges();
    if (!ok) {
      pushBtn.disabled = false;
      pushBtn.textContent = '⬆ Push to GitHub';
    }
  });

  refresh();
  // Refresh pending count whenever any storage changes happen
  window.addEventListener('storage', refresh);
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
  const markBtn       = $('mark-outdated');
  const badge         = $('status-badge');
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

  // -------- Outdated flag --------
  markBtn.addEventListener('click', () => {
    const s = loadState(id);
    s.outdated = !s.outdated;
    saveState(id, s);
    updateBadge(s.outdated);
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
}

async function initIndexPage() {
  await fetchRemoteData();
  initSyncBar();
  document.querySelectorAll('.problem-card').forEach(card => {
    const id = card.dataset.id;
    const s = effectiveState(id);
    if (s.outdated) {
      card.classList.add('outdated');
      const badge = document.createElement('span');
      badge.className = 'badge outdated';
      badge.textContent = 'needs redoing';
      const row = card.querySelector('.row');
      if (row) row.appendChild(badge);
    }
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
