// Neon Coast Cover Studio: wires the editor page. Photos stay on the
// machine (FileReader / object URLs, never uploaded); the cover is drawn on
// a canvas and exported as a PNG in 1080 x 1080, 1080 x 1350 or 1920 x 1080.
import { drawCover, GRADES } from './cover.js';
import { LAYOUTS, layoutPanels, defaultPanels, clampFocal, coverMetrics } from './panels.js';
import { runShot } from './shots.js';

export const SIZES = [
  { id: '1920x1080', name: 'Wide 1920 × 1080', w: 1920, h: 1080 },
  { id: '1080x1080', name: 'Square 1080 × 1080', w: 1080, h: 1080 },
  { id: '1080x1350', name: 'Portrait 1080 × 1350', w: 1080, h: 1350 },
];

const SAMPLES = [
  { id: 'boulevard', name: 'Boulevard', file: 'samples/boulevard.jpg' },
  { id: 'neon', name: 'Neon Street', file: 'samples/neon.jpg' },
  { id: 'pier', name: 'Pier Day', file: 'samples/pier.jpg' },
];

const canvas = document.getElementById('cover');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

async function loadFont(family, size) {
  try {
    await document.fonts.load(`${size}px "${family}"`);
  } catch {
    // The app still draws with its fallback stack when a font is missing.
  }
}

/** The editor's state: everything needed to redraw the cover. */
export function defaultState() {
  return {
    layout: 'hero-trio',
    grade: 'vice',
    size: '1920x1080',
    title: 'BOULEVARD QUEEN',
    subtitle: 'vice city nights',
    badge: 'VICE CITY',
    // Photo slots: { kind: 'sample', id } or { kind: 'upload', name }.
    photoSources: [
      { kind: 'sample', id: 'boulevard' },
      { kind: 'sample', id: 'neon' },
      { kind: 'sample', id: 'pier' },
    ],
    panels: defaultPanels('hero-trio', 3),
    selected: 0,
    grain: true,
    vignette: true,
  };
}

const state = defaultState();
// Loaded Image objects per slot, parallel to state.photoSources.
const slotImages = [null, null, null];
let undoStack = [];
let redoStack = [];

export function currentSize() {
  return SIZES.find((s) => s.id === state.size) ?? SIZES[0];
}

export function snapshotState() {
  return JSON.parse(JSON.stringify({
    layout: state.layout, grade: state.grade, size: state.size,
    title: state.title, subtitle: state.subtitle, badge: state.badge,
    photoSources: state.photoSources, panels: state.panels, selected: state.selected,
  }));
}

function restoreState(snap) {
  Object.assign(state, JSON.parse(JSON.stringify(snap)));
  syncControls();
  redraw();
}

function pushUndo() {
  undoStack.push(snapshotState());
  if (undoStack.length > 40) undoStack.shift();
  redoStack = [];
  syncUndoButtons();
}

export function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshotState());
  restoreState(undoStack.pop());
  syncUndoButtons();
}

export function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshotState());
  restoreState(redoStack.pop());
  syncUndoButtons();
}

function syncUndoButtons() {
  document.getElementById('undo').disabled = undoStack.length === 0;
  document.getElementById('redo').disabled = redoStack.length === 0;
}

/** Rebuild the panels when the layout changes, keeping the photos. */
export function setLayout(layout) {
  if (state.layout === layout) return;
  pushUndo();
  state.layout = layout;
  state.panels = defaultPanels(layout, state.photoSources.length);
  state.selected = 0;
  syncControls();
  redraw();
}

export function setGrade(grade) {
  if (state.grade === grade) return;
  pushUndo();
  state.grade = grade;
  syncControls();
  redraw();
}

export function setSize(sizeId) {
  if (state.size === sizeId) return;
  pushUndo();
  state.size = sizeId;
  syncControls();
  redraw();
}

/** Draw the preview canvas at the export size, CSS-scaled to fit. */
export function redraw() {
  const size = currentSize();
  if (canvas.width !== size.w) canvas.width = size.w;
  if (canvas.height !== size.h) canvas.height = size.h;
  drawCover(ctx, {
    photos: slotImages,
    panels: state.panels,
    layout: state.layout,
    grade: state.grade,
    title: state.title,
    subtitle: state.subtitle,
    badge: state.badge,
    grain: state.grain,
    vignette: state.vignette,
  }, size.w, size.h);
  document.getElementById('panelLabel').textContent =
    `Panel ${state.selected + 1} of ${state.panels.length}`;
}

function setStatus(text) {
  statusEl.textContent = text;
}

/** Export the cover at the chosen size as a PNG download. */
export async function exportCover() {
  const size = currentSize();
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  drawCover(off.getContext('2d'), {
    photos: slotImages,
    panels: state.panels,
    layout: state.layout,
    grade: state.grade,
    title: state.title,
    subtitle: state.subtitle,
    badge: state.badge,
    grain: state.grain,
    vignette: state.vignette,
  }, size.w, size.h);
  const blob = await new Promise((resolve) => off.toBlob(resolve, 'image/png'));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `neon-coast-${size.w}x${size.h}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  setStatus(`Saved neon-coast-${size.w}x${size.h}.png (${Math.round(blob.size / 1024)} KB)`);
  return blob.size;
}

/** Load a sample photo into a slot. */
export async function loadSample(slot, sampleId) {
  const sample = SAMPLES.find((s) => s.id === sampleId) ?? SAMPLES[0];
  slotImages[slot] = await loadImage(sample.file);
  state.photoSources[slot] = { kind: 'sample', id: sample.id };
  syncPhotoSlots();
  redraw();
}

/** Load a user file into a slot: read locally, never uploaded. */
export async function loadUpload(slot, file) {
  const url = URL.createObjectURL(file);
  try {
    slotImages[slot] = await loadImage(url);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  state.photoSources[slot] = { kind: 'upload', name: file.name };
  syncPhotoSlots();
  redraw();
}

// ---- Controls -----------------------------------------------------------

function el(id) {
  return document.getElementById(id);
}

function buildButtons(containerId, items, activeId, onPick) {
  const box = el(containerId);
  box.innerHTML = '';
  for (const item of items) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick' + (item.id === activeId ? ' active' : '');
    b.dataset.id = item.id;
    if (item.swatch) b.style.background = item.swatch;
    b.innerHTML = item.label;
    b.addEventListener('click', () => onPick(item.id));
    box.appendChild(b);
  }
}

function syncControls() {
  buildButtons('layoutButtons', LAYOUTS.map((l) => ({
    id: l.id, label: `<span class="mini mini-${l.id}"></span>${l.name}`,
  })), state.layout, setLayout);
  buildButtons('gradeButtons', GRADES.map((g) => ({
    id: g.id,
    label: g.name,
    swatch: `linear-gradient(135deg, ${g.overlay[0]}, ${g.overlay[2]})`,
  })), state.grade, setGrade);
  buildButtons('sizeButtons', SIZES.map((s) => ({ id: s.id, label: s.name })), state.size, setSize);
  el('titleInput').value = state.title;
  el('subtitleInput').value = state.subtitle;
  el('badgeInput').value = state.badge;
  el('grainToggle').checked = state.grain;
  el('vignetteToggle').checked = state.vignette;
  syncPhotoSlots();
  syncPanelControls();
}

function syncPhotoSlots() {
  const box = el('photoSlots');
  box.innerHTML = '';
  state.photoSources.forEach((src, slot) => {
    const div = document.createElement('div');
    div.className = 'slot';
    const thumb = document.createElement('button');
    thumb.type = 'button';
    thumb.className = 'thumb';
    thumb.title = src.kind === 'sample'
      ? `Sample: ${src.id} (click to change)`
      : `Your photo: ${src.name}`;
    if (slotImages[slot]) {
      const t = document.createElement('canvas');
      t.width = 96;
      t.height = 72;
      const g = t.getContext('2d');
      const iw = slotImages[slot].naturalWidth;
      const ih = slotImages[slot].naturalHeight;
      const s = Math.max(96 / iw, 72 / ih);
      g.drawImage(slotImages[slot], (96 - iw * s) / 2, (72 - ih * s) / 2, iw * s, ih * s);
      thumb.appendChild(t);
    } else {
      thumb.textContent = 'Empty';
    }
    thumb.addEventListener('click', () => {
      // Cycle the sample photos for this slot.
      const cur = state.photoSources[slot].kind === 'sample'
        ? SAMPLES.findIndex((s) => s.id === state.photoSources[slot].id) : -1;
      loadSample(slot, SAMPLES[(cur + 1) % SAMPLES.length].id);
    });
    const up = document.createElement('label');
    up.className = 'upload';
    up.textContent = slotImages[slot] ? 'Replace photo' : 'Upload photo';
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', (e) => {
      if (e.target.files[0]) loadUpload(slot, e.target.files[0]);
    });
    up.appendChild(input);
    const name = document.createElement('span');
    name.className = 'slotname';
    name.textContent = `Photo ${slot + 1} · ${src.kind === 'sample' ? src.id : src.name}`;
    div.append(thumb, up, name);
    box.appendChild(div);
  });
}

function syncPanelControls() {
  const sel = el('panelPhoto');
  sel.innerHTML = '';
  state.photoSources.forEach((src, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = `Photo ${i + 1} (${src.kind === 'sample' ? src.id : src.name})`;
    sel.appendChild(o);
  });
  sel.value = String(state.panels[state.selected]?.photo ?? 0);
  el('zoom').value = String(state.panels[state.selected]?.zoom ?? 1);
  el('zoomVal').textContent = `${Math.round((state.panels[state.selected]?.zoom ?? 1) * 100)}%`;
}

/** Hit-test a point (cover pixels) against the layout's panels. */
function panelAt(x, y) {
  const size = currentSize();
  const { panels } = layoutPanels(state.layout, size.w, size.h);
  for (let i = panels.length - 1; i >= 0; i--) {
    const p = panels[i];
    if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return i;
  }
  return -1;
}

function bindPointer() {
  let drag = null;
  const toCover = (e) => {
    const r = canvas.getBoundingClientRect();
    const size = currentSize();
    return {
      x: ((e.clientX - r.left) / r.width) * size.w,
      y: ((e.clientY - r.top) / r.height) * size.h,
    };
  };
  canvas.addEventListener('pointerdown', (e) => {
    const p = toCover(e);
    const i = panelAt(p.x, p.y);
    if (i < 0) return;
    canvas.setPointerCapture(e.pointerId);
    if (i !== state.selected) {
      state.selected = i;
      syncPanelControls();
      redraw();
    }
    drag = { x: p.x, y: p.y, moved: false };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = toCover(e);
    const dx = p.x - drag.x;
    const dy = p.y - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
    if (!drag.moved) return;
    const size = currentSize();
    const { panels } = layoutPanels(state.layout, size.w, size.h);
    const rect = panels[state.selected];
    const panel = state.panels[state.selected];
    const img = slotImages[panel.photo];
    const m = img ? coverMetrics(img, rect, panel.zoom) : null;
    if (m) {
      const next = clampFocal({ ...panel, ox: panel.ox - dx / m.dw, oy: panel.oy - dy / m.dh }, img, rect);
      panel.ox = next.ox;
      panel.oy = next.oy;
    }
    drag.x = p.x;
    drag.y = p.y;
    redraw();
  });
  const endDrag = () => {
    if (drag?.moved) pushUndo();
    drag = null;
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
}

function bindControls() {
  el('titleInput').addEventListener('input', (e) => { state.title = e.target.value; redraw(); });
  el('titleInput').addEventListener('change', pushUndo);
  el('subtitleInput').addEventListener('input', (e) => { state.subtitle = e.target.value; redraw(); });
  el('subtitleInput').addEventListener('change', pushUndo);
  el('badgeInput').addEventListener('input', (e) => { state.badge = e.target.value; redraw(); });
  el('badgeInput').addEventListener('change', pushUndo);
  el('grainToggle').addEventListener('change', (e) => { pushUndo(); state.grain = e.target.checked; redraw(); });
  el('vignetteToggle').addEventListener('change', (e) => { pushUndo(); state.vignette = e.target.checked; redraw(); });
  el('zoom').addEventListener('input', (e) => {
    const panel = state.panels[state.selected];
    panel.zoom = Number(e.target.value);
    const size = currentSize();
    const { panels } = layoutPanels(state.layout, size.w, size.h);
    const img = slotImages[panel.photo];
    if (img) Object.assign(panel, clampFocal(panel, img, panels[state.selected]));
    el('zoomVal').textContent = `${Math.round(panel.zoom * 100)}%`;
    redraw();
  });
  el('zoom').addEventListener('change', pushUndo);
  el('panelPhoto').addEventListener('change', (e) => {
    pushUndo();
    state.panels[state.selected].photo = Number(e.target.value);
    redraw();
  });
  el('fillAll').addEventListener('click', () => {
    pushUndo();
    const photo = state.panels[state.selected].photo;
    for (const p of state.panels) p.photo = photo;
    redraw();
  });
  el('resetPanel').addEventListener('click', () => {
    pushUndo();
    const fresh = defaultPanels(state.layout, state.photoSources.length);
    state.panels[state.selected] = fresh[state.selected];
    syncPanelControls();
    redraw();
  });
  el('undo').addEventListener('click', undo);
  el('redo').addEventListener('click', redo);
  el('exportBtn').addEventListener('click', exportCover);
  el('sampleAll').addEventListener('click', async () => {
    pushUndo();
    await Promise.all(SAMPLES.map((s, i) => loadSample(i, s.id)));
    state.panels = defaultPanels(state.layout, 3);
    redraw();
  });
}

// ---- Boot ---------------------------------------------------------------

async function boot() {
  bindControls();
  bindPointer();
  syncControls();
  syncUndoButtons();
  // Load the bundled fonts before the first paint so the lettering is Anton.
  await Promise.all([loadFont('Anton', 60), loadFont('Pacifico', 40)]);
  const params = new URLSearchParams(location.search);
  if (params.get('shot')) {
    await runShot(params.get('shot'), params, {
      loadSample, setLayout, setGrade, setSize, redraw, state,
    });
    return;
  }
  // Normal editor: start with the three bundled sample photos.
  await Promise.all(SAMPLES.map((s, i) => loadSample(i, s.id)));
  state.panels = defaultPanels(state.layout, 3);
  redraw();
}

boot();
