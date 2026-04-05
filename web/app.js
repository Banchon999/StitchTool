'use strict';

// ═══════════════════════════════════════════════════════
//  State
// ═══════════════════════════════════════════════════════
const state = {
  mode:      'stitch',    // stitch | split | smartsplit | stitchsplit | watermark
  direction: 'vertical',  // vertical | horizontal
  files:     [],          // File[]  (main images)
  wmFile:    null,        // File    (watermark image)
  results:   []           // HTMLCanvasElement[]
};

// ═══════════════════════════════════════════════════════
//  DOM refs
// ═══════════════════════════════════════════════════════
const $ = id => document.getElementById(id);

const dom = {
  tabs:         document.querySelectorAll('.tab'),
  dropZone:     $('drop-zone'),
  dropLabel:    $('drop-label'),
  fileInput:    $('file-input'),
  fileList:     $('file-list'),
  wmImportRow:  $('wm-import-row'),
  wmImgBtn:     $('wm-img-btn'),
  wmImgInput:   $('wm-img-input'),
  wmImgLabel:   $('wm-img-label'),

  rowDirection: $('row-direction'),
  btnVertical:  $('btn-vertical'),
  btnHorizontal:$('btn-horizontal'),
  rowSsCombo:   $('row-ss-combo'),
  ssCombo:      $('ss-combo'),
  rowParts:     $('row-parts'),
  partsInput:   $('parts-input'),
  wmOpts:       $('wm-opts'),
  opacityRange: $('opacity-range'),
  opacityVal:   $('opacity-val'),
  greyscaleChk: $('greyscale-chk'),
  wmCount:      $('wm-count'),
  wmWidthPct:   $('wm-width-pct'),
  filename:     $('filename'),
  fmtSelect:    $('fmt-select'),

  runBtn:       $('run-btn'),
  progressWrap: $('progress-wrap'),
  progressFill: $('progress-fill'),
  progressLabel:$('progress-label'),

  resultSection:$('result-section'),
  resultInfo:   $('result-info'),
  downloadBtn:  $('download-btn'),
  resultGrid:   $('result-grid'),
};

// ═══════════════════════════════════════════════════════
//  UI — mode switching
// ═══════════════════════════════════════════════════════
function show(el)  { el.classList.remove('hidden'); }
function hide(el)  { el.classList.add('hidden'); }
function toggle(el, v) { el.classList.toggle('hidden', !v); }

function applyMode(mode) {
  state.mode = mode;
  state.files = [];
  state.wmFile = null;
  renderFileList();
  hideResult();

  const m = mode;

  // Tabs
  dom.tabs.forEach(t => t.classList.toggle('active', t.dataset.mode === m));

  // Direction row: shown for stitch / split
  toggle(dom.rowDirection,  m === 'stitch' || m === 'split');

  // Stitch+Split combo
  toggle(dom.rowSsCombo, m === 'stitchsplit');

  // Parts: shown for split / smartsplit / stitchsplit
  toggle(dom.rowParts, m === 'split' || m === 'smartsplit' || m === 'stitchsplit');

  // Watermark options
  toggle(dom.wmOpts,       m === 'watermark');
  toggle(dom.wmImportRow,  m === 'watermark');

  // File input: multiple for stitch / stitchsplit
  const multi = m === 'stitch' || m === 'stitchsplit';
  dom.fileInput.multiple = multi;
  dom.dropLabel.textContent = multi ? 'Tap to import images (select multiple)' : 'Tap to import image';

  // Parts label hint
  if (m === 'smartsplit') {
    dom.partsInput.placeholder = 'approx.';
  } else {
    dom.partsInput.placeholder = '';
  }
}

// ═══════════════════════════════════════════════════════
//  UI — file list
// ═══════════════════════════════════════════════════════
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function renderFileList() {
  dom.fileList.innerHTML = '';
  state.files.forEach((file, i) => {
    const li = document.createElement('li');
    li.className = 'file-item';

    const thumb = document.createElement('img');
    thumb.className = 'file-thumb';
    thumb.alt = file.name;
    const url = URL.createObjectURL(file);
    thumb.src = url;
    thumb.onload = () => URL.revokeObjectURL(url);

    const name = document.createElement('span');
    name.className = 'file-name';
    name.textContent = file.name;

    const size = document.createElement('span');
    size.className = 'file-size';
    size.textContent = formatBytes(file.size);

    const rm = document.createElement('button');
    rm.className = 'file-remove';
    rm.title = 'Remove';
    rm.textContent = '×';
    rm.addEventListener('click', () => {
      state.files.splice(i, 1);
      renderFileList();
    });

    li.append(thumb, name, size, rm);
    dom.fileList.appendChild(li);
  });
}

// ═══════════════════════════════════════════════════════
//  UI — result
// ═══════════════════════════════════════════════════════
function showResult(canvases) {
  state.results = canvases;
  dom.resultGrid.innerHTML = '';
  const fmt = dom.fmtSelect.value;
  const ext = fmt === 'jpeg' ? 'jpg' : fmt;

  canvases.forEach((canvas, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'result-thumb-wrap';
    wrap.title = `Click to download image ${i + 1}`;

    const img = document.createElement('img');
    img.className = 'result-thumb';
    img.src = canvas.toDataURL(`image/${fmt}`, 0.92);
    img.alt = `Result ${i + 1}`;

    const label = document.createElement('div');
    label.className = 'result-thumb-label';
    label.textContent = `${i + 1}.${ext}`;

    wrap.append(img, label);
    wrap.addEventListener('click', () => {
      const name = (dom.filename.value.trim() || 'output') + (canvases.length > 1 ? `_${i + 1}` : '');
      downloadSingle(canvas, name, fmt);
    });
    dom.resultGrid.appendChild(wrap);
  });

  const n = canvases.length;
  dom.resultInfo.textContent = n === 1 ? '1 image' : `${n} images`;
  show(dom.resultSection);
  dom.resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function hideResult() {
  hide(dom.resultSection);
  dom.resultGrid.innerHTML = '';
  state.results = [];
}

// ═══════════════════════════════════════════════════════
//  UI — progress
// ═══════════════════════════════════════════════════════
function setProgress(pct, label) {
  dom.progressFill.style.width = pct + '%';
  dom.progressLabel.textContent = label || 'Processing…';
}

function showProgress(label) {
  setProgress(0, label);
  show(dom.progressWrap);
}

function hideProgress() {
  hide(dom.progressWrap);
}

// ═══════════════════════════════════════════════════════
//  Image utilities
// ═══════════════════════════════════════════════════════
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load: ' + file.name)); };
    img.src = url;
  });
}

function canvasToBlob(canvas, format, quality = 0.92) {
  return new Promise(resolve => canvas.toBlob(resolve, `image/${format}`, quality));
}

function yield_() {
  return new Promise(r => setTimeout(r, 0));
}

// ═══════════════════════════════════════════════════════
//  Image processing — Stitch
// ═══════════════════════════════════════════════════════
function stitchImages(imgs, direction) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (direction === 'vertical') {
    canvas.width  = Math.max(...imgs.map(img => img.naturalWidth  || img.width));
    canvas.height = imgs.reduce((s, img) => s + (img.naturalHeight || img.height), 0);
    let y = 0;
    for (const img of imgs) {
      ctx.drawImage(img, 0, y);
      y += img.naturalHeight || img.height;
    }
  } else {
    canvas.width  = imgs.reduce((s, img) => s + (img.naturalWidth || img.width), 0);
    canvas.height = Math.max(...imgs.map(img => img.naturalHeight || img.height));
    let x = 0;
    for (const img of imgs) {
      ctx.drawImage(img, x, 0);
      x += img.naturalWidth || img.width;
    }
  }
  return canvas;
}

// ═══════════════════════════════════════════════════════
//  Image processing — Split (equal parts)
// ═══════════════════════════════════════════════════════
function splitCanvas(canvas, numParts, direction) {
  const results = [];

  if (direction === 'horizontal') {
    // Horizontal strips (top → bottom)
    const partH = Math.floor(canvas.height / numParts);
    const rem   = canvas.height % numParts;
    for (let i = 0; i < numParts; i++) {
      const y = i * partH;
      const h = partH + (i === numParts - 1 ? rem : 0);
      const c = document.createElement('canvas');
      c.width = canvas.width; c.height = h;
      c.getContext('2d').drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
      results.push(c);
    }
  } else {
    // Vertical strips (left → right)
    const partW = Math.floor(canvas.width / numParts);
    const rem   = canvas.width % numParts;
    for (let i = 0; i < numParts; i++) {
      const x = i * partW;
      const w = partW + (i === numParts - 1 ? rem : 0);
      const c = document.createElement('canvas');
      c.width = w; c.height = canvas.height;
      c.getContext('2d').drawImage(canvas, x, 0, w, canvas.height, 0, 0, w, canvas.height);
      results.push(c);
    }
  }
  return results;
}

// ═══════════════════════════════════════════════════════
//  Image processing — Smart Split
//  Port of Java smartSplitHelper (same algorithm, ±10 tolerance)
// ═══════════════════════════════════════════════════════
async function smartSplitCanvas(canvas, numParts, progressCb) {
  const ctx    = canvas.getContext('2d');
  const W      = canvas.width;
  const H      = canvas.height;
  const data   = ctx.getImageData(0, 0, W, H).data;
  const TOL    = 10;

  const startH = Math.floor(H / numParts);
  const splits = [0]; // y positions of split points

  for (let i = startH; i < H; i++) {
    let uniform = true;
    for (let j = 0; j < W - 1; j++) {
      const p1 = (i * W + j)     * 4;
      const p2 = (i * W + j + 1) * 4;
      if (Math.abs(data[p1]   - data[p2])   > TOL ||
          Math.abs(data[p1+1] - data[p2+1]) > TOL ||
          Math.abs(data[p1+2] - data[p2+2]) > TOL ||
          Math.abs(data[p1+3] - data[p2+3]) > TOL) {
        uniform = false;
        break;
      }
    }
    if (uniform) {
      splits.push(i);
      i += startH; // jump to approximate next split zone
    }

    // Yield to UI every 200 rows
    if (i % 200 === 0) {
      if (progressCb) progressCb(Math.round((i / H) * 80));
      await yield_();
    }
  }

  if (splits[splits.length - 1] !== H) splits.push(H);

  if (splits.length < 2) return null; // couldn't split

  const results = [];
  for (let i = 0; i < splits.length - 1; i++) {
    const y = splits[i];
    const h = splits[i + 1] - y;
    if (h <= 0) continue;
    const c = document.createElement('canvas');
    c.width = W; c.height = h;
    c.getContext('2d').drawImage(canvas, 0, y, W, h, 0, 0, W, h);
    results.push(c);
  }
  return results.length > 1 ? results : null;
}

// ═══════════════════════════════════════════════════════
//  Image processing — Watermark
// ═══════════════════════════════════════════════════════
function applyWatermark(canvas, wmImg, opacityPct, greyscale, count, widthPct) {
  const ctx = canvas.getContext('2d');
  const W   = canvas.width;
  const H   = canvas.height;

  // Scale watermark to widthPct of image width
  const wmW    = Math.max(1, Math.floor(W * widthPct / 100));
  const ratio  = wmImg.naturalWidth / wmImg.naturalHeight;
  const wmH    = Math.max(1, Math.floor(wmW / ratio));

  // Build (optionally greyscale) watermark canvas
  const wmCanvas = document.createElement('canvas');
  wmCanvas.width  = wmW;
  wmCanvas.height = wmH;
  const wctx = wmCanvas.getContext('2d');
  wctx.drawImage(wmImg, 0, 0, wmW, wmH);

  if (greyscale) {
    const id = wctx.getImageData(0, 0, wmW, wmH);
    const d  = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
      d[i] = d[i+1] = d[i+2] = g;
    }
    wctx.putImageData(id, 0, 0);
  }

  // Draw watermarks (evenly spaced, right-aligned — same as Java version)
  ctx.save();
  ctx.globalAlpha = opacityPct / 100;
  const sectionH = Math.floor(H / count);
  for (let i = 1; i <= count; i++) {
    const x = W - Math.floor(wmW * 1.1);
    const y = H - sectionH * i;
    ctx.drawImage(wmCanvas, x, y);
  }
  ctx.restore();

  return canvas;
}

// ═══════════════════════════════════════════════════════
//  Downloads
// ═══════════════════════════════════════════════════════
async function downloadSingle(canvas, filename, format) {
  const blob = await canvasToBlob(canvas, format);
  const ext  = format === 'jpeg' ? 'jpg' : format;
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `${filename}.${ext}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}

async function downloadAll(canvases, basename, format) {
  const ext = format === 'jpeg' ? 'jpg' : format;

  if (canvases.length === 1) {
    await downloadSingle(canvases[0], basename, format);
    return;
  }

  // Use JSZip when available
  if (typeof JSZip !== 'undefined') {
    const zip = new JSZip();
    for (let i = 0; i < canvases.length; i++) {
      const blob = await canvasToBlob(canvases[i], format);
      zip.file(`${basename}_${i + 1}.${ext}`, blob);
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href     = URL.createObjectURL(zipBlob);
    a.download = `${basename}.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  } else {
    // Fallback: download one by one
    for (let i = 0; i < canvases.length; i++) {
      await downloadSingle(canvases[i], `${basename}_${i + 1}`, format);
      await new Promise(r => setTimeout(r, 300));
    }
  }
}

// ═══════════════════════════════════════════════════════
//  Main run function
// ═══════════════════════════════════════════════════════
async function run() {
  const mode   = state.mode;
  const fmt    = dom.fmtSelect.value;
  const name   = dom.filename.value.trim() || 'output';
  const dir    = state.direction;
  const parts  = Math.max(2, parseInt(dom.partsInput.value) || 2);

  // Validate
  if (mode !== 'watermark' && state.files.length === 0) {
    alert('Please import at least one image.');
    return;
  }
  if ((mode === 'stitch' || mode === 'stitchsplit') && state.files.length < 2) {
    alert('Stitch requires at least 2 images.');
    return;
  }
  if (mode === 'watermark' && !state.wmFile) {
    alert('Please import a watermark image.');
    return;
  }

  dom.runBtn.disabled = true;
  hideResult();
  showProgress('Loading images…');

  try {
    // ── Load images ──────────────────────────────────
    const imgs = [];
    for (let i = 0; i < state.files.length; i++) {
      setProgress(Math.round((i / state.files.length) * 30), `Loading ${i + 1} / ${state.files.length}…`);
      imgs.push(await loadImage(state.files[i]));
      await yield_();
    }

    let results = [];

    // ── Stitch ───────────────────────────────────────
    if (mode === 'stitch') {
      setProgress(40, 'Stitching…');
      await yield_();
      results = [stitchImages(imgs, dir)];
      setProgress(100, 'Done!');
    }

    // ── Split ────────────────────────────────────────
    else if (mode === 'split') {
      setProgress(40, 'Splitting…');
      await yield_();
      const canvas = stitchImages(imgs, 'vertical'); // convert single File → canvas
      results = splitCanvas(canvas, parts, dir);
      setProgress(100, 'Done!');
    }

    // ── Smart Split ──────────────────────────────────
    else if (mode === 'smartsplit') {
      setProgress(30, 'Analysing image…');
      await yield_();
      // Draw file into canvas
      const tmp = document.createElement('canvas');
      tmp.width  = imgs[0].naturalWidth;
      tmp.height = imgs[0].naturalHeight;
      tmp.getContext('2d').drawImage(imgs[0], 0, 0);

      results = await smartSplitCanvas(tmp, parts, pct => setProgress(pct, 'Scanning rows…'));
      if (!results) {
        setProgress(100, 'Done!');
        await yield_();
        hideProgress();
        alert('Smart Split could not find any uniform split lines.\nTry adjusting the "Parts" count.');
        dom.runBtn.disabled = false;
        return;
      }
      setProgress(100, 'Done!');
    }

    // ── Stitch + Split ───────────────────────────────
    else if (mode === 'stitchsplit') {
      const combo   = dom.ssCombo.value;      // e.g. "v-smart"
      const stitchDir = combo.startsWith('v') ? 'vertical' : 'horizontal';
      const splitOp   = combo.split('-')[1];   // smart | h | v

      setProgress(30, 'Stitching…');
      await yield_();
      const stitched = stitchImages(imgs, stitchDir);

      if (splitOp === 'smart') {
        setProgress(40, 'Smart splitting…');
        results = await smartSplitCanvas(stitched, parts, pct => setProgress(40 + Math.round(pct * 0.5), 'Scanning rows…'));
        if (!results) {
          hideProgress();
          alert('Smart Split could not find any split lines in the stitched image.');
          dom.runBtn.disabled = false;
          return;
        }
      } else {
        setProgress(60, 'Splitting…');
        await yield_();
        const splitDir = splitOp === 'h' ? 'horizontal' : 'vertical';
        results = splitCanvas(stitched, parts, splitDir);
      }
      setProgress(100, 'Done!');
    }

    // ── Watermark ────────────────────────────────────
    else if (mode === 'watermark') {
      setProgress(40, 'Loading watermark…');
      const wmImg = await loadImage(state.wmFile);

      setProgress(60, 'Applying watermark…');
      await yield_();

      // Draw main image to canvas
      const src = imgs[0];
      const canvas = document.createElement('canvas');
      canvas.width  = src.naturalWidth;
      canvas.height = src.naturalHeight;
      canvas.getContext('2d').drawImage(src, 0, 0);

      const opacity   = parseInt(dom.opacityRange.value) || 40;
      const greyscale = dom.greyscaleChk.checked;
      const wmCount   = Math.max(1, parseInt(dom.wmCount.value) || 3);
      const wmWpct    = Math.min(100, Math.max(1, parseInt(dom.wmWidthPct.value) || 20));

      applyWatermark(canvas, wmImg, opacity, greyscale, wmCount, wmWpct);
      results = [canvas];
      setProgress(100, 'Done!');
    }

    await yield_();
    hideProgress();
    showResult(results);

  } catch (err) {
    hideProgress();
    console.error(err);
    alert('Error: ' + err.message);
  } finally {
    dom.runBtn.disabled = false;
  }
}

// ═══════════════════════════════════════════════════════
//  Event wiring
// ═══════════════════════════════════════════════════════

// Mode tabs
dom.tabs.forEach(tab => {
  tab.addEventListener('click', () => applyMode(tab.dataset.mode));
});

// Direction toggles
[dom.btnVertical, dom.btnHorizontal].forEach(btn => {
  btn.addEventListener('click', () => {
    state.direction = btn.dataset.dir;
    dom.btnVertical.classList.toggle('active',   state.direction === 'vertical');
    dom.btnHorizontal.classList.toggle('active', state.direction === 'horizontal');
  });
});

// Opacity slider
dom.opacityRange.addEventListener('input', () => {
  dom.opacityVal.textContent = dom.opacityRange.value;
});

// File input (main)
dom.fileInput.addEventListener('change', e => {
  const incoming = Array.from(e.target.files || []);
  if (!dom.fileInput.multiple) {
    state.files = incoming.slice(0, 1);
  } else {
    state.files = [...state.files, ...incoming];
  }
  renderFileList();
  e.target.value = ''; // allow re-selecting same file
});

// Drag & drop
dom.dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dom.dropZone.classList.add('drag-over');
});
dom.dropZone.addEventListener('dragleave', () => dom.dropZone.classList.remove('drag-over'));
dom.dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dom.dropZone.classList.remove('drag-over');
  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
  if (!dom.fileInput.multiple) {
    state.files = files.slice(0, 1);
  } else {
    state.files = [...state.files, ...files];
  }
  renderFileList();
});

// Keyboard accessibility for drop zone
dom.dropZone.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    dom.fileInput.click();
  }
});

// Watermark file input
dom.wmImgBtn.addEventListener('click', () => dom.wmImgInput.click());
dom.wmImgInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) {
    state.wmFile = file;
    dom.wmImgLabel.textContent = file.name;
  }
  e.target.value = '';
});

// Run button
dom.runBtn.addEventListener('click', run);

// Download button — download all results
dom.downloadBtn.addEventListener('click', async () => {
  if (!state.results.length) return;
  const name = dom.filename.value.trim() || 'output';
  const fmt  = dom.fmtSelect.value;
  dom.downloadBtn.disabled = true;
  dom.downloadBtn.textContent = '⏳ Preparing…';
  try {
    await downloadAll(state.results, name, fmt);
  } finally {
    dom.downloadBtn.disabled = false;
    dom.downloadBtn.textContent = '⬇ Download';
  }
});

// ═══════════════════════════════════════════════════════
//  Init
// ═══════════════════════════════════════════════════════
applyMode('stitch');
