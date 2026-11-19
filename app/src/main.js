// main.js — the Neon Coast Cover Studio editor.
//
// Wires the controls in app/index.html to the renderer in cover.js and the
// geometry in panels.js: three photo slots (upload your own or use the
// samples), six layouts, five grades, lettering, per-panel crop and
// position by drag and zoom, undo/redo, and PNG export in the three post
// sizes. Photos are read on this machine with FileReader and never leave it.

import { drawCover, GRADES } from './cover.js';
import { LAYOUTS, EXPORT_SIZES, layoutPanels, defaultPanelState, panelAt, sizeById, anchorForPhoto } from './panels.js';
import { readShotQuery, applyShotToState, loadSamplePhotos, loadImage, loadAppFonts, markShotReady, sampleUrl } from './shots.js';

const SAMPLE_NAMES = ['boulevard', 'neon', 'pier'];

const state = {
  layout: 'hero-trio',
  grade: 'vice',
  size: '1920x1080',
  title: 'BOULEVARD QUEEN',
  subtitle: 'vice city nights',
  badge: 'VICE CITY',
  panels: defaultPanelState('hero-trio'),
  selected: 0,
  grain: true,
  vignette: true,
  shot: '',
};

const photos = [null, null, null];
const photoSources = ['./samples/boulevard.jpg', './samples/neon.jpg', './samples/pier.jpg'];

const canvas = document.getElementById('cover');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

const undoStack = [];
const redoStack = [];

function snapshot() {
  return JSON.stringify({
    layout: state.layout,
    grade: state.grade,
    size: state.size,
    title: state.title,
    subtitle: state.subtitle,
    badge: state.badge,
    panels: state.panels,
    selected: state.selected,
    grain: state.grain,
    vignette: state.vignette,
    photoSources,
  });
}

function pushHistory() {
  undoStack.push(snapshot());
  if (undoStack.length > 60) undoStack.shift();
  redoStack.length = 0;
  syncHistoryButtons();
}

async function restoreSnapshot(json) {
  const data = JSON.parse(json);
  state.layout = data.layout;
  state.grade = data.grade;
  state.size = data.size;
  state.title = data.title;
  state.subtitle = data.subtitle;
  state.badge = data.badge;
  state.panels = data.panels;
  state.selected = data.selected;
  state.grain = data.grain;
  state.vignette = data.vignette;
  for (let i = 0; i < 3; i++) {
    photoSources[i] = data.photoSources[i];
    photos[i] = await loadImage(photoSources[i]);
  }
  syncInputs();
  render();
}

function syncHistoryButtons() {
  document.getElementById('undo').disabled = undoStack.length === 0;
  document.getElementById('redo').disabled = redoStack.length === 0;
}

async function doUndo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  await restoreSnapshot(undoStack.pop());
  syncHistoryButtons();
}

async function doRedo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  await restoreSnapshot(redoStack.pop());
  syncHistoryButtons();
}

function currentLayout() {
  const size = sizeById(state.size);
  return layoutPanels(state.layout, size.w, size.h);
}

function render() {
  const size = sizeById(state.size);
  const layout = currentLayout();
  canvas.width = size.w;
  canvas.height = size.h;
  drawCover(ctx, {
    w: size.w,
    h: size.h,
    layout,
    grade: state.grade,
    title: state.title,
    subtitle: state.subtitle,
    badge: state.badge,
    panels: state.panels,
    grain: state.grain,
    vignette: state.vignette,
  }, photos);
  refreshControlStates(layout);
}

function refreshControlStates(layout) {
  document.querySelectorAll('#layoutButtons button').forEach((b) => {
    b.classList.toggle('active', b.dataset.value === state.layout);
  });
  document.querySelectorAll('#gradeButtons button').forEach((b) => {
    b.classList.toggle('active', b.dataset.value === state.grade);
  });
  document.querySelectorAll('#sizeButtons button').forEach((b) => {
    b.classList.toggle('active', b.dataset.value === state.size);
  });
  const count = layout.panels.length;
  if (state.selected >= count) state.selected = 0;
  document.getElementById('panelLabel').textContent = `Panel ${state.selected + 1} of ${count}`;
  const panel = state.panels[state.selected];
  const select = document.getElementById('panelPhoto');
  select.value = String(panel.photo);
  const zoom = document.getElementById('zoom');
  zoom.value = String(panel.zoom);
  document.getElementById('zoomVal').textContent = `${Math.round(panel.zoom * 100)}%`;
  document.getElementById('grainToggle').checked = state.grain;
  document.getElementById('vignetteToggle').checked = state.vignette;
  drawSlotThumbs();
}

function syncInputs() {
  document.getElementById('titleInput').value = state.title;
  document.getElementById('subtitleInput').value = state.subtitle;
  document.getElementById('badgeInput').value = state.badge;
}

function pickButtons(containerId, items, onPick) {
  const box = document.getElementById(containerId);
  box.innerHTML = '';
  for (const item of items) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pick';
    btn.dataset.value = item.id;
    btn.textContent = item.label;
    btn.addEventListener('click', () => onPick(item.id));
    box.appendChild(btn);
  }
}

function buildPhotoSlots() {
  const box = document.getElementById('photoSlots');
  box.innerHTML = '';
  for (let slot = 0; slot < 3; slot++) {
    const wrap = document.createElement('div');
    wrap.className = 'slot';
    const thumbBtn = document.createElement('button');
    thumbBtn.type = 'button';
    thumbBtn.className = 'thumb';
    thumbBtn.title = 'Tap to cycle the samples';
    const thumb = document.createElement('canvas');
    thumb.width = 96;
    thumb.height = 72;
    thumbBtn.appendChild(thumb);
    thumbBtn.addEventListener('click', () => cycleSample(slot));
    const label = document.createElement('label');
    label.className = 'upload';
    label.textContent = `Upload photo ${slot + 1}`;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', () => uploadPhoto(slot, input.files[0]));
    label.appendChild(input);
    const name = document.createElement('span');
    name.className = 'slotname';
    name.id = `slotName${slot}`;
    name.textContent = SAMPLE_NAMES[slot];
    wrap.append(thumbBtn, label, name);
    box.appendChild(wrap);
  }
}

function drawSlotThumbs() {
  for (let slot = 0; slot < 3; slot++) {
    const thumb = document.querySelectorAll('#photoSlots .slot canvas')[slot];
    if (!thumb) continue;
    const tctx = thumb.getContext('2d');
    const img = photos[slot];
    tctx.fillStyle = '#2a1544';
    tctx.fillRect(0, 0, thumb.width, thumb.height);
    if (img) {
      const scale = Math.max(thumb.width / img.naturalWidth, thumb.height / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      tctx.drawImage(img, (thumb.width - dw) / 2, (thumb.height - dh) / 2, dw, dh);
    }
    const nameEl = document.getElementById(`slotName${slot}`);
    if (nameEl) {
      nameEl.textContent = photoSources[slot].startsWith('data:')
        ? 'your upload'
        : photoSources[slot].split('/').pop();
    }
  }
}

async function cycleSample(slot) {
  pushHistory();
  const current = photoSources[slot];
  const idx = SAMPLE_NAMES.findIndex((n) => current.endsWith(`${n}.jpg`));
  const next = SAMPLE_NAMES[(idx + 1) % SAMPLE_NAMES.length];
  photoSources[slot] = sampleUrl(next);
  photos[slot] = await loadImage(photoSources[slot]);
  render();
}

async function uploadPhoto(slot, file) {
  if (!file) return;
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsDataURL(file);
  }).catch(() => null);
  if (!dataUrl) {
    statusEl.textContent = 'Could not read that file.';
    return;
  }
  pushHistory();
  photoSources[slot] = dataUrl;
  photos[slot] = await loadImage(dataUrl);
  statusEl.textContent = `Photo ${slot + 1} loaded from your machine.`;
  render();
}

async function loadAllSamples(names) {
  const loaded = await loadSamplePhotos(names);
  for (let i = 0; i < 3; i++) {
    photos[i] = loaded[i];
    photoSources[i] = sampleUrl((names.length ? names : SAMPLE_NAMES)[i % (names.length || 3)]);
  }
  render();
}

function exportPng() {
  const size = sizeById(state.size);
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  drawCover(off.getContext('2d'), {
    w: size.w,
    h: size.h,
    layout: currentLayout(),
    grade: state.grade,
    title: state.title,
    subtitle: state.subtitle,
    badge: state.badge,
    panels: state.panels,
    grain: state.grain,
    vignette: state.vignette,
  }, photos);
  off.toBlob((blob) => {
    if (!blob) {
      statusEl.textContent = 'Export failed in this browser.';
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neon-coast-${state.size}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    statusEl.textContent = `Exported neon-coast-${state.size}.png (${size.w} x ${size.h}).`;
  }, 'image/png');
}

function wireControls() {
  pickButtons('layoutButtons', LAYOUTS, (id) => {
    if (id === state.layout) return;
    pushHistory();
    state.layout = id;
    state.panels = defaultPanelState(id);
    state.selected = 0;
    render();
  });
  pickButtons('gradeButtons', GRADES, (id) => {
    if (id === state.grade) return;
    pushHistory();
    state.grade = id;
    render();
  });
  pickButtons('sizeButtons', EXPORT_SIZES, (id) => {
    if (id === state.size) return;
    pushHistory();
    state.size = id;
    render();
  });

  document.getElementById('titleInput').addEventListener('input', (e) => {
    state.title = e.target.value;
    render();
  });
  document.getElementById('titleInput').addEventListener('change', () => pushHistory());
  document.getElementById('subtitleInput').addEventListener('input', (e) => {
    state.subtitle = e.target.value;
    render();
  });
  document.getElementById('subtitleInput').addEventListener('change', () => pushHistory());
  document.getElementById('badgeInput').addEventListener('input', (e) => {
    state.badge = e.target.value;
    render();
  });
  document.getElementById('badgeInput').addEventListener('change', () => pushHistory());

  const select = document.getElementById('panelPhoto');
  for (let i = 0; i < 3; i++) {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `Photo ${i + 1}`;
    select.appendChild(opt);
  }
  select.addEventListener('change', () => {
    pushHistory();
    state.panels[state.selected].photo = Number(select.value);
    render();
  });
  document.getElementById('zoom').addEventListener('input', (e) => {
    state.panels[state.selected].zoom = Number(e.target.value);
    render();
  });
  document.getElementById('zoom').addEventListener('change', () => pushHistory());
  document.getElementById('fillAll').addEventListener('click', () => {
    pushHistory();
    const photo = state.panels[state.selected].photo;
    for (const p of state.panels) p.photo = photo;
    statusEl.textContent = `All panels now use photo ${photo + 1}.`;
    render();
  });
  document.getElementById('resetPanel').addEventListener('click', () => {
    pushHistory();
    state.panels[state.selected] = { photo: state.selected % 3, zoom: 1, ox: 0, oy: 0, ay: anchorForPhoto(state.selected % 3) };
    render();
  });
  document.getElementById('grainToggle').addEventListener('change', (e) => {
    pushHistory();
    state.grain = e.target.checked;
    render();
  });
  document.getElementById('vignetteToggle').addEventListener('change', (e) => {
    pushHistory();
    state.vignette = e.target.checked;
    render();
  });
  document.getElementById('sampleAll').addEventListener('click', async () => {
    pushHistory();
    await loadAllSamples(SAMPLE_NAMES);
  });
  document.getElementById('undo').addEventListener('click', doUndo);
  document.getElementById('redo').addEventListener('click', doRedo);
  document.getElementById('exportBtn').addEventListener('click', exportPng);

  // Drag a panel's photo to reposition it; click selects the panel.
  let drag = null;
  function canvasPoint(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }
  canvas.addEventListener('pointerdown', (e) => {
    const pt = canvasPoint(e);
    const hit = panelAt(currentLayout(), pt.x, pt.y);
    if (hit < 0) return;
    pushHistory();
    state.selected = hit;
    const panel = state.panels[hit];
    drag = { x: pt.x, y: pt.y, ox: panel.ox, oy: panel.oy, rect: currentLayout().panels[hit] };
    canvas.setPointerCapture(e.pointerId);
    render();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const pt = canvasPoint(e);
    const panel = state.panels[state.selected];
    panel.ox = Math.max(-0.5, Math.min(0.5, drag.ox + (pt.x - drag.x) / drag.rect.w));
    panel.oy = Math.max(-0.5, Math.min(0.5, drag.oy + (pt.y - drag.y) / drag.rect.h));
    render();
  });
  canvas.addEventListener('pointerup', () => {
    drag = null;
  });
}

async function boot() {
  buildPhotoSlots();
  wireControls();
  syncInputs();
  syncHistoryButtons();
  const query = readShotQuery();
  state.shot = query.shot;
  applyShotToState(state, query, LAYOUTS, GRADES, EXPORT_SIZES);
  state.panels = defaultPanelState(state.layout);
  if (query.shot === 'cover') document.body.classList.add('shot-cover');
  await loadAllSamples(query.photo.length ? query.photo : SAMPLE_NAMES);
  await loadAppFonts();
  render();
  markShotReady();
}

boot();
