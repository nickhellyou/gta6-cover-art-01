// Panel geometry for Neon Coast Cover Studio: every layout is a list of panel
// rectangles in cover space, plus the title band the lettering sits in.
// Layouts: hero-trio, grid-four, full-bleed, tilted-trio, nine-grid, sunset-split.

export const LAYOUTS = [
  { id: 'hero-trio', name: 'Hero + Trio', panels: 4 },
  { id: 'grid-four', name: 'Four Grid', panels: 4 },
  { id: 'full-bleed', name: 'Full Bleed', panels: 1 },
  { id: 'tilted-trio', name: 'Tilted Trio', panels: 3 },
  { id: 'nine-grid', name: 'Nine Grid', panels: 9 },
  { id: 'sunset-split', name: 'Sunset Split', panels: 4 },
];

/** Title band height: the bottom strip that holds the big lettering. */
export function titleBandHeight(height) {
  return Math.round(height * 0.21);
}

/**
 * Returns { art, title, panels } for a layout at cover size W x H.
 * art is the photo area above the title band; title is the band rect.
 * A panel is { x, y, w, h, rot, frame } in cover pixels; rot is radians
 * about the panel centre, frame means draw a white snapshot border.
 */
export function layoutPanels(layout, width, height) {
  const band = titleBandHeight(height);
  const title = { x: 0, y: height - band, w: width, h: band };
  const art = { x: 0, y: 0, w: width, h: height - band };
  const gap = Math.max(6, Math.round(width * 0.006));
  let panels = [];
  if (layout === 'hero-trio') {
    const heroW = Math.round(art.w * 0.575);
    const colX = heroW + gap;
    const colW = art.w - colX;
    const rowH = (art.h - gap * 2) / 3;
    panels = [
      { x: 0, y: 0, w: heroW, h: art.h, rot: 0, frame: false },
      { x: colX, y: 0, w: colW, h: rowH, rot: 0, frame: false },
      { x: colX, y: rowH + gap, w: colW, h: rowH, rot: 0, frame: false },
      { x: colX, y: (rowH + gap) * 2, w: colW, h: rowH, rot: 0, frame: false },
    ];
  } else if (layout === 'grid-four') {
    const cw = (art.w - gap) / 2;
    const ch = (art.h - gap) / 2;
    panels = [
      { x: 0, y: 0, w: cw, h: ch, rot: 0, frame: false },
      { x: cw + gap, y: 0, w: cw, h: ch, rot: 0, frame: false },
      { x: 0, y: ch + gap, w: cw, h: ch, rot: 0, frame: false },
      { x: cw + gap, y: ch + gap, w: cw, h: ch, rot: 0, frame: false },
    ];
  } else if (layout === 'full-bleed') {
    panels = [{ x: 0, y: 0, w: width, h: height, rot: 0, frame: false }];
    art.h = height;
  } else if (layout === 'tilted-trio') {
    const pw = Math.round(art.w * 0.3);
    const ph = Math.round(art.h * 0.9);
    const y = Math.round((art.h - ph) / 2);
    panels = [
      { x: Math.round(art.w * 0.05), y, w: pw, h: ph, rot: -0.07, frame: true },
      { x: Math.round(art.w * 0.35), y, w: pw, h: ph, rot: 0.02, frame: true },
      { x: Math.round(art.w * 0.65), y, w: pw, h: ph, rot: 0.06, frame: true },
    ];
  } else if (layout === 'nine-grid') {
    const cw = (art.w - gap * 2) / 3;
    const ch = (art.h - gap * 2) / 3;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        panels.push({ x: c * (cw + gap), y: r * (ch + gap), w: cw, h: ch, rot: 0, frame: false });
      }
    }
  } else {
    // sunset-split: narrow strip, wide middle, two stacked on the right.
    const stripW = Math.round(art.w * 0.22);
    const midX = stripW + gap;
    const midW = Math.round(art.w * 0.46);
    const colX = midX + midW + gap;
    const colW = art.w - colX;
    const rowH = (art.h - gap) / 2;
    panels = [
      { x: 0, y: 0, w: stripW, h: art.h, rot: 0, frame: false },
      { x: midX, y: 0, w: midW, h: art.h, rot: 0, frame: false },
      { x: colX, y: 0, w: colW, h: rowH, rot: 0, frame: false },
      { x: colX, y: rowH + gap, w: colW, h: rowH, rot: 0, frame: false },
    ];
  }
  return { art, title, panels };
}

/** Default per-panel photo work for a layout: { photo, zoom, ox, oy }. */
export function defaultPanels(layout, photoCount) {
  const base = (photo, zoom = 1, ox = 0.5, oy = 0.5) => ({
    photo: photo % Math.max(1, photoCount), zoom, ox, oy,
  });
  if (layout === 'hero-trio') {
    return [base(0, 1, 0.5, 0.32), base(1), base(2, 1, 0.5, 0.28), base(1, 1.3, 0.5, 0.55)];
  }
  if (layout === 'grid-four') return [base(0, 1, 0.5, 0.32), base(1), base(2, 1, 0.5, 0.28), base(1, 1.5, 0.3, 0.45)];
  if (layout === 'full-bleed') return [base(0)];
  if (layout === 'tilted-trio') return [base(1, 1.1, 0.5, 0.6), base(0), base(2, 1.15, 0.5, 0.45)];
  if (layout === 'nine-grid') {
    // Focal points sit high (oy ~0.3): the sample portraits keep faces in
    // the top third, and square cells crop the vertical band hard.
    return [
      base(0, 1, 0.5, 0.3), base(1, 1.5, 0.3, 0.3), base(2, 1, 0.5, 0.3),
      base(1, 1, 0.5, 0.35), base(0, 1.6, 0.65, 0.3), base(2, 1.4, 0.5, 0.3),
      base(2, 1.3, 0.4, 0.3), base(0, 1.4, 0.5, 0.3), base(1, 1.2, 0.7, 0.3),
    ];
  }
  // sunset-split
  return [base(0, 1.4, 0.5, 0.35), base(1), base(2), base(0, 1.5, 0.3, 0.4)];
}

/** Clamp a panel's focal point so its photo still covers the panel. */
export function clampFocal(panel, img, rect) {
  const m = coverMetrics(img, rect, panel.zoom);
  if (!m) return panel;
  const fx = m.dw > rect.w ? (m.dw - rect.w) / (2 * m.dw) : 0;
  const fy = m.dh > rect.h ? (m.dh - rect.h) / (2 * m.dh) : 0;
  return {
    ...panel,
    ox: Math.min(0.5 + fx, Math.max(0.5 - fx, panel.ox)),
    oy: Math.min(0.5 + fy, Math.max(0.5 - fy, panel.oy)),
  };
}

/**
 * Cover-fit metrics for an image in a rect at a zoom: the drawn size and
 * top-left for a focal point (ox, oy). Shared by the renderer and the
 * editor's drag math so a drag moves the photo exactly under the pointer.
 */
export function coverMetrics(img, rect, zoom) {
  if (!img) return null;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return null;
  const scale = Math.max(rect.w / iw, rect.h / ih) * zoom;
  return { dw: iw * scale, dh: ih * scale, iw, ih };
}
