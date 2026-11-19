// panels.js — pure geometry for Neon Coast Cover Studio.
//
// A layout is a recipe for cutting the cover into photo panels. Every
// rectangle is in normalised cover coordinates (0..1), so the same recipe
// works at 1080x1080, 1080x1350 and 1920x1080. The renderer in cover.js
// turns these rectangles into canvas pixels; nothing here touches the DOM.

export const LAYOUTS = [
  { id: 'hero-trio', label: 'Hero + Trio', panels: 4 },
  { id: 'grid-four', label: 'Four Grid', panels: 4 },
  { id: 'full-bleed', label: 'Full Bleed', panels: 1 },
  { id: 'tilted-trio', label: 'Tilted Trio', panels: 3 },
  { id: 'nine-grid', label: 'Nine Grid', panels: 9 },
  { id: 'sunset-split', label: 'Sunset Split', panels: 3 },
];

export const EXPORT_SIZES = [
  { id: '1080x1080', w: 1080, h: 1080, label: '1080 × 1080' },
  { id: '1080x1350', w: 1080, h: 1350, label: '1080 × 1350' },
  { id: '1920x1080', w: 1920, h: 1080, label: '1920 × 1080' },
];

export function layoutById(id) {
  return LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
}

export function sizeById(id) {
  return EXPORT_SIZES.find((s) => s.id === id) ?? EXPORT_SIZES[2];
}

export function panelCountFor(layoutId) {
  return layoutById(layoutId).panels;
}

// Vertical focal point for each bundled sample photo, as a fraction of
// the cropped overflow (0 = top of the photo, 0.5 = centred). The three
// samples frame their subjects at different heights — the boulevard
// portrait's face sits high, the neon street scene's subject sits
// mid-frame, the pier portrait in between — so one anchor beheads one
// of them in a wide panel. Dragging a panel (oy) still overrides this.
export function anchorForPhoto(photo) {
  return [0.18, 0.42, 0.28][photo] ?? 0.3;
}

// Fresh per-panel edit state: which photo slot feeds the panel, how far
// the photo is zoomed, and how far it is panned inside its frame. When a
// photo repeats (nine-grid cycles three photos over nine panels), each
// repeat gets a different zoom and pan, so the mosaic reads as nine
// different crops instead of the same picture pasted three times.
export function defaultPanelState(layoutId) {
  const n = panelCountFor(layoutId);
  const out = [];
  for (let i = 0; i < n; i++) {
    const repeat = Math.floor(i / 3);
    out.push({
      photo: i % 3,
      zoom: 1 + repeat * 0.3,
      ox: repeat === 0 ? 0 : (repeat % 2 === 0 ? -0.08 : 0.08),
      oy: 0,
      ay: anchorForPhoto(i % 3),
    });
  }
  return out;
}

// Split a rectangle into `rows` equal horizontal bands.
function bands(box, rows) {
  const out = [];
  for (let i = 0; i < rows; i++) {
    out.push({ x: box.x, y: box.y + (box.h * i) / rows, w: box.w, h: box.h / rows });
  }
  return out;
}

// Split a rectangle into `cols` equal vertical bands.
function columns(box, cols) {
  const out = [];
  for (let i = 0; i < cols; i++) {
    out.push({ x: box.x + (box.w * i) / cols, y: box.y, w: box.w / cols, h: box.h });
  }
  return out;
}

function inset(box, pad) {
  return { x: box.x + pad, y: box.y + pad, w: box.w - pad * 2, h: box.h - pad * 2 };
}

// The photo area is everything above the title band; full-bleed is the
// exception and hands the whole cover to its single photo.
export function layoutPanels(layoutId, w, h) {
  const id = layoutById(layoutId).id;
  const gap = Math.max(6, Math.round(Math.min(w, h) * 0.008));
  const titleH = Math.round(h * 0.24);
  const area = { x: 0, y: 0, w, h: h - titleH };
  const title = { x: 0, y: h - titleH, w, h: titleH };
  const pad = gap / 2;

  if (id === 'full-bleed') {
    return {
      backdrop: 'photo',
      title,
      titleOverlay: true,
      panels: [{ x: 0, y: 0, w, h, angle: 0 }],
    };
  }

  if (id === 'hero-trio') {
    const heroW = Math.round(w * 0.58);
    const right = { x: heroW, y: 0, w: w - heroW, h: area.h };
    const trio = bands(right, 3).map((b) => inset(b, pad));
    return {
      backdrop: 'sky',
      title,
      titleOverlay: false,
      panels: [inset({ x: 0, y: 0, w: heroW, h: area.h }, pad), ...trio].map((p) => ({ ...p, angle: 0 })),
    };
  }

  if (id === 'grid-four') {
    const rows = bands(area, 2);
    const cells = [];
    for (const row of rows) cells.push(...columns(row, 2));
    return {
      backdrop: 'sky',
      title,
      titleOverlay: false,
      panels: cells.map((c) => ({ ...inset(c, pad), angle: 0 })),
    };
  }

  if (id === 'tilted-trio') {
    // Three snapshots, slightly rotated, scattered over a sunset sky with
    // a big synthwave sun behind them. They sit low so the sun's disc
    // shows in the sky band above them; the middle one sits highest.
    const pw = w * 0.34;
    const ph = area.h * 0.64;
    const cy = area.h * 0.26;
    return {
      backdrop: 'sunset',
      title,
      titleOverlay: false,
      panels: [
        { x: w * 0.03, y: cy + ph * 0.16, w: pw, h: ph, angle: -7 },
        { x: w * 0.33, y: cy, w: pw, h: ph, angle: 3.5 },
        { x: w * 0.63, y: cy + ph * 0.14, w: pw, h: ph, angle: -3 },
      ],
    };
  }

  if (id === 'nine-grid') {
    const rows = bands(area, 3);
    const cells = [];
    for (const row of rows) cells.push(...columns(row, 3));
    return {
      backdrop: 'sky',
      title,
      titleOverlay: false,
      panels: cells.map((c) => ({ ...inset(c, pad * 0.8), angle: 0 })),
    };
  }

  // sunset-split: one tall panel on the left, two stacked on the right.
  const leftW = Math.round(w * 0.44);
  const right = { x: leftW, y: 0, w: w - leftW, h: area.h };
  const pair = bands(right, 2).map((b) => inset(b, pad));
  return {
    backdrop: 'sky',
    title,
    titleOverlay: false,
    panels: [
      { ...inset({ x: 0, y: 0, w: leftW, h: area.h }, pad), angle: 0 },
      ...pair,
    ].map((p) => ({ ...p, angle: 0 })),
  };
}

// Point-in-panel test in canvas pixels, ignoring rotation (close enough
// for picking a tilted snapshot by its bounding box).
export function panelAt(layout, px, py) {
  for (let i = layout.panels.length - 1; i >= 0; i--) {
    const p = layout.panels[i];
    if (px >= p.x && px <= p.x + p.w && py >= p.y && py <= p.y + p.h) return i;
  }
  return -1;
}
