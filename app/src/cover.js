// Cover renderer for Neon Coast Cover Studio: draws the whole GTA-style
// poster onto any 2D canvas context at any export size. Everything here is
// the app's own art: gradient skies, a slit synthwave sun, palm silhouettes
// drawn from bezier curves, a halftone title band, Anton display lettering
// with a sunset gradient fill and a Pacifico script subtitle. No Rockstar
// logo, artwork or font anywhere.
import { layoutPanels, coverMetrics, clampFocal } from './panels.js';

export const GRADES = [
  {
    id: 'vice', name: 'Vice Sunset',
    filter: 'saturate(1.35) contrast(1.08) brightness(1.02)',
    overlay: ['rgba(255,110,60,0.20)', 'rgba(255,41,117,0.16)', 'rgba(140,30,255,0.14)'],
  },
  {
    id: 'neon', name: 'Neon Nights',
    filter: 'saturate(1.55) contrast(1.12) hue-rotate(-10deg)',
    overlay: ['rgba(255,41,117,0.24)', 'rgba(0,229,255,0.16)', 'rgba(120,0,255,0.18)'],
  },
  {
    id: 'gold', name: 'Gold Hour',
    filter: 'sepia(0.32) saturate(1.45) contrast(1.06)',
    overlay: ['rgba(255,190,60,0.20)', 'rgba(255,120,40,0.12)', 'rgba(120,60,0,0.10)'],
  },
  {
    id: 'noir', name: 'Palm Noir',
    filter: 'grayscale(0.85) contrast(1.28) brightness(1.06)',
    overlay: ['rgba(255,240,210,0.10)', 'rgba(20,10,40,0.22)', 'rgba(20,10,40,0.18)'],
  },
  {
    id: 'candy', name: 'Cotton Candy',
    filter: 'saturate(1.25) contrast(1.04) hue-rotate(16deg) brightness(1.04)',
    overlay: ['rgba(255,157,226,0.20)', 'rgba(140,220,255,0.16)', 'rgba(255,120,180,0.12)'],
  },
];

/** A tileable static grain pattern, made once and reused by every render. */
let grainTile = null;
function getGrainTile() {
  if (grainTile) return grainTile;
  const c = document.createElement('canvas');
  c.width = 140;
  c.height = 140;
  const g = c.getContext('2d');
  const data = g.createImageData(140, 140);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 22;
  }
  g.putImageData(data, 0, 0);
  grainTile = c;
  return c;
}

/** One palm silhouette, drawn from curves: trunk plus six drooping fronds. */
export function drawPalm(ctx, x, y, s, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  // Trunk: a gentle lean.
  ctx.lineWidth = Math.max(2, s * 0.045);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + s * 0.05, y - s * 0.55, x + s * 0.16, y - s * 0.95);
  ctx.stroke();
  const topX = x + s * 0.16;
  const topY = y - s * 0.95;
  // Fronds: arcs fanning out from the crown.
  for (let i = 0; i < 6; i++) {
    const a = (-165 + i * 30) * (Math.PI / 180);
    const len = s * (0.42 + (i % 2) * 0.1);
    const ex = topX + Math.cos(a) * len;
    const ey = topY + Math.sin(a) * len * 0.55 + s * 0.1;
    ctx.lineWidth = Math.max(1.5, s * 0.02);
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(
      topX + Math.cos(a) * len * 0.5,
      topY + Math.sin(a) * len * 0.5 - s * 0.16,
      ex,
      ey,
    );
    ctx.stroke();
  }
  // Coconuts.
  ctx.beginPath();
  ctx.arc(topX - s * 0.02, topY + s * 0.02, s * 0.035, 0, Math.PI * 2);
  ctx.arc(topX + s * 0.04, topY + s * 0.03, s * 0.03, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Synthwave sun: a gradient disc with horizontal slits cut across it.
 *  Drawn on a scratch canvas first, so the slits stay transparent and show
 *  whatever sky sits behind the sun. */
export function drawSun(ctx, cx, cy, r) {
  const pad = Math.ceil(r * 0.1) + 2;
  const s = document.createElement('canvas');
  s.width = Math.ceil(r * 2 + pad * 2);
  s.height = Math.ceil(r * 2 + pad * 2);
  const g = s.getContext('2d');
  const grad = g.createLinearGradient(0, pad, 0, pad + r * 2);
  grad.addColorStop(0, '#ffe259');
  grad.addColorStop(0.55, '#ff7e5f');
  grad.addColorStop(1, '#ff2975');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(pad + r, pad + r, r, 0, Math.PI * 2);
  g.fill();
  // Slits: erase bands across the lower half, widening downward.
  g.globalCompositeOperation = 'destination-out';
  let y = pad + r * 1.05;
  let h = r * 0.05;
  while (y < pad + r * 2) {
    g.fillRect(pad, y, r * 2, h);
    y += h + r * 0.16;
    h *= 1.5;
  }
  ctx.drawImage(s, cx - r - pad, cy - r - pad);
}

/** Halftone dots along a horizontal strip, radius swelling in a sine wave. */
function drawHalftone(ctx, x, y, w, color) {
  ctx.save();
  ctx.fillStyle = color;
  const step = Math.max(10, Math.round(w / 90));
  for (let px = x + step / 2; px < x + w; px += step) {
    const t = (px - x) / w;
    const r = 1.2 + 3.2 * (0.5 + 0.5 * Math.sin(t * Math.PI * 5));
    ctx.beginPath();
    ctx.arc(px, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Fit a single-line title into maxWidth, shrinking from startSize. */
function fitFont(ctx, text, maxWidth, startSize, family, weight = '') {
  let size = startSize;
  const font = (s) => `${weight} ${s}px ${family}`.trim();
  ctx.font = font(size);
  while (ctx.measureText(text).width > maxWidth && size > 10) {
    size -= 2;
    ctx.font = font(size);
  }
  return size;
}

/** Draw one photo into a panel rect, cover-fit at the panel's focal point. */
function drawPhotoPanel(ctx, img, rect, panel, grade) {
  if (!img) {
    const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    g.addColorStop(0, '#3a1c5e');
    g.addColorStop(1, '#160a24');
    ctx.fillStyle = g;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `bold ${Math.max(14, rect.w * 0.06)}px Anton, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('+ ADD PHOTO', rect.x + rect.w / 2, rect.y + rect.h / 2);
    return;
  }
  const m = coverMetrics(img, rect, panel.zoom);
  const clamped = clampFocal(panel, img, rect);
  const dx = rect.x + rect.w / 2 - m.dw * clamped.ox;
  const dy = rect.y + rect.h / 2 - m.dh * clamped.oy;
  ctx.save();
  ctx.filter = grade.filter;
  ctx.drawImage(img, dx, dy, m.dw, m.dh);
  ctx.restore();
}

/** The badge ribbon: a tilted yellow sticker with the badge words. */
function drawBadge(ctx, text, width, height) {
  if (!text.trim()) return;
  const label = `★ ${text.trim().toUpperCase()} ★`;
  const size = Math.max(18, Math.round(height * 0.028));
  ctx.save();
  ctx.font = `${size}px Anton, sans-serif`;
  const tw = ctx.measureText(label).width;
  const padX = size * 0.9;
  const padY = size * 0.55;
  const bw = tw + padX * 2;
  const bh = size + padY * 2;
  const bx = width - bw - width * 0.03;
  const by = height * 0.035;
  ctx.translate(bx + bw / 2, by + bh / 2);
  ctx.rotate(0.09);
  ctx.fillStyle = '#ffd319';
  ctx.strokeStyle = '#14041f';
  ctx.lineWidth = Math.max(2, size * 0.1);
  roundRect(ctx, -bw / 2, -bh / 2, bw, bh, bh * 0.28);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#14041f';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, size * 0.06);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The title band: dark gradient, halftone strip, palms, big lettering. */
function drawTitleBand(ctx, geo, opts, width, height) {
  const { title } = geo;
  const band = ctx.createLinearGradient(0, title.y, 0, title.y + title.h);
  band.addColorStop(0, 'rgba(22,8,38,0)');
  band.addColorStop(0.28, 'rgba(22,8,38,0.88)');
  band.addColorStop(1, 'rgba(16,4,32,0.97)');
  ctx.fillStyle = band;
  ctx.fillRect(title.x, title.y, title.w, title.h);
  // Neon scanline + halftone dots where the photos meet the band.
  const line = ctx.createLinearGradient(title.x, 0, title.x + title.w, 0);
  line.addColorStop(0, '#ffd319');
  line.addColorStop(0.5, '#ff2975');
  line.addColorStop(1, '#00e5ff');
  ctx.fillStyle = line;
  ctx.fillRect(title.x, title.y, title.w, Math.max(3, height * 0.004));
  drawHalftone(ctx, title.x + 8, title.y + height * 0.018, title.w * 0.4, 'rgba(255,211,25,0.55)');
  // Palm silhouettes peeking in from the band's corners.
  drawPalm(ctx, title.x + width * 0.015, title.y + title.h * 0.98, title.h * 0.85, 'rgba(10,2,22,0.85)');
  drawPalm(ctx, title.x + width * 0.985, title.y + title.h * 0.98, title.h * 0.7, 'rgba(10,2,22,0.7)');

  const text = opts.title.trim().toUpperCase();
  const padX = width * 0.045;
  const maxW = width - padX * 2 - width * 0.16;
  const size = fitFont(ctx, text || ' ', maxW, Math.round(title.h * 0.52), 'Anton, sans-serif');
  const baseline = title.y + title.h * 0.58;
  ctx.save();
  ctx.translate(0, 0);
  ctx.transform(1, 0, -0.045, 1, 0, 0);
  const fill = ctx.createLinearGradient(0, baseline - size, 0, baseline + size * 0.12);
  fill.addColorStop(0, '#ffe259');
  fill.addColorStop(0.5, '#ff7e5f');
  fill.addColorStop(1, '#ff2975');
  ctx.font = `${size}px Anton, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#14041f';
  ctx.lineWidth = Math.max(2, size * 0.09);
  ctx.strokeText(text, padX + size * 0.045, baseline);
  ctx.fillStyle = fill;
  ctx.fillText(text, padX + size * 0.045, baseline);
  ctx.restore();
  // Script subtitle under the title, stars at the right.
  const sub = opts.subtitle.trim();
  if (sub) {
    const subSize = fitFont(ctx, sub, maxW * 0.8, Math.round(title.h * 0.24), 'Pacifico, cursive');
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.fillStyle = '#ff9de2';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(sub, padX, title.y + title.h * 0.9);
  }
  ctx.font = `${Math.round(title.h * 0.16)}px Anton, sans-serif`;
  ctx.fillStyle = '#ffd319';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('★ ★ ★ ★ ★', width - padX, title.y + title.h * 0.9);
  ctx.font = `${Math.round(title.h * 0.1)}px Anton, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fillText('NEON COAST STUDIO', width - padX, title.y + title.h * 0.68);
}

/**
 * Draw the whole cover.
 * opts: { photos, panels, layout, grade, title, subtitle, badge, grain, vignette }
 * photos: Image|null per slot; panels: per-panel { photo, zoom, ox, oy }.
 */
export function drawCover(ctx, opts, width, height) {
  const grade = GRADES.find((g) => g.id === opts.grade) ?? GRADES[0];
  const geo = layoutPanels(opts.layout, width, height);
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  // Poster paper: off-white gutters between panels.
  ctx.fillStyle = '#f5efe6';
  ctx.fillRect(0, 0, width, height);

  if (opts.layout === 'tilted-trio') {
    // Sunset sky behind the tilted snapshots, with sun and distant palms.
    const sky = ctx.createLinearGradient(0, 0, 0, geo.art.h);
    sky.addColorStop(0, '#2b1055');
    sky.addColorStop(0.45, '#ff2975');
    sky.addColorStop(0.8, '#ff7e5f');
    sky.addColorStop(1, '#ffe259');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, geo.art.h);
    drawSun(ctx, width * 0.5, geo.art.h * 0.42, Math.min(width, height) * 0.16);
    drawPalm(ctx, width * 0.02, geo.art.h * 0.99, geo.art.h * 0.5, 'rgba(20,4,32,0.9)');
    drawPalm(ctx, width * 0.97, geo.art.h * 0.99, geo.art.h * 0.42, 'rgba(20,4,32,0.9)');
  }

  // Panels, in order; tilted ones rotate about their centre.
  geo.panels.forEach((rect, i) => {
    const panel = opts.panels[i] ?? { photo: 0, zoom: 1, ox: 0.5, oy: 0.5 };
    const img = opts.photos[panel.photo] ?? null;
    ctx.save();
    if (rect.rot) {
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate(rect.rot);
      ctx.translate(-rect.w / 2, -rect.h / 2);
      ctx.shadowColor = 'rgba(10,2,22,0.45)';
      ctx.shadowBlur = width * 0.012;
      ctx.shadowOffsetY = height * 0.008;
    }
    const inner = rect.frame
      ? { x: 10, y: 10, w: rect.w - 20, h: rect.h - 20 }
      : { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
    if (rect.frame) {
      ctx.fillStyle = '#fdfbf7';
      ctx.fillRect(0, 0, rect.w, rect.h);
    }
    ctx.beginPath();
    ctx.rect(inner.x, inner.y, inner.w, inner.h);
    ctx.clip();
    drawPhotoPanel(ctx, img, inner, panel, grade);
    ctx.restore();
    if (rect.frame) {
      ctx.save();
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate(rect.rot);
      ctx.strokeStyle = 'rgba(20,4,32,0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(-rect.w / 2, -rect.h / 2, rect.w, rect.h);
      ctx.restore();
    }
  });

  // Grade wash over the photo area.
  const wash = ctx.createLinearGradient(0, 0, 0, geo.art.h);
  grade.overlay.forEach((c, i) => wash.addColorStop(i / (grade.overlay.length - 1), c));
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, width, geo.art.h);
  ctx.restore();

  // Thin white poster frame around the photo area.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = Math.max(2, width * 0.002);
  ctx.strokeRect(1, 1, width - 2, geo.art.h - 2);

  drawTitleBand(ctx, geo, opts, width, height);
  drawBadge(ctx, opts.badge, width, height);

  if (opts.vignette !== false) {
    const v = ctx.createRadialGradient(
      width / 2, height * 0.45, Math.min(width, height) * 0.35,
      width / 2, height / 2, Math.max(width, height) * 0.75,
    );
    v.addColorStop(0, 'rgba(10,0,20,0)');
    v.addColorStop(1, 'rgba(10,0,20,0.34)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, width, height);
  }
  if (opts.grain !== false) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = ctx.createPattern(getGrainTile(), 'repeat');
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
  ctx.restore();
}
