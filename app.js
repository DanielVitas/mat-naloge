// Per-problem state in localStorage. Key = `prob-NNN`.
// Stored fields: latex (string), bbox ([x1,y1,x2,y2]), outdated (bool).

function $(id) { return document.getElementById(id); }
function loadState(id) {
  try { return JSON.parse(localStorage.getItem('prob-' + id) || '{}'); }
  catch { return {}; }
}
function saveState(id, s) {
  localStorage.setItem('prob-' + id, JSON.stringify(s));
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

function initProblemPage(meta) {
  const id    = meta.n;
  const state = loadState(id);

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

function initIndexPage() {
  document.querySelectorAll('.problem-card').forEach(card => {
    const id = card.dataset.id;
    const s = loadState(id);
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
