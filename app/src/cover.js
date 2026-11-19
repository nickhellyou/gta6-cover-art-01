// cover.js — the cover renderer for Neon Coast Cover Studio.
//
// Everything the cover looks like lives here: the five colour grades, the
// sunset sky, the synthwave sun, the palm silhouettes, the halftone title
// band, the gradient Anton lettering, the Pacifico subtitle, the ribbon
// badge, the five stars, the grain and the vignette. It draws on any 2D
// canvas context at any export size and never touches the network.

export const GRADES = [
  {
    id: 'vice',
    label: 'Vice Sunset',
    sky: ['#1d0b3d', '#7a1e6e', '#ff2975', '#ff7e5f', '#ffd319'],
    wash: 'rgba(255, 41, 117, 0.16)',
    filter: 'saturate(1.3) contrast(1.1)',
    title: ['#ffe259', '#ff7e5f', '#ff2975'],
    sun: ['#ffd319', '#ff2975'],
  },
  {
    id: 'neon',
    label: 'Neon Nights',
    sky: ['#05001a', '#12005e', '#7b00ff', '#ff00a8', '#00e5ff'],
    wash: 'rgba(0, 229, 255, 0.14)',
    filter: 'saturate(1.45) contrast(1.14) hue-rotate(-8deg)',
    title: ['#00e5ff', '#ff00a8', '#ffd319'],
    sun: ['#00e5ff', '#ff00a8'],
  },
  {
    id: 'gold',
    label: 'Gold Hour',
    sky: ['#2b1503', '#8a3b00', '#ff8c1a', '#ffc93c', '#fff3b0'],
    wash: 'rgba(255, 180, 60, 0.16)',
    filter: 'saturate(1.2) contrast(1.06) sepia(0.18)',
    title: ['#fff3b0', '#ffc93c', '#ff8c1a'],
    sun: ['#fff3b0', '#ff8c1a'],
  },
  {
    id: 'noir',
    label: 'Palm Noir',
    sky: ['#000000', '#101018', '#2c2c3a', '#5a4a6e', '#c9b8ff'],
    wash: 'rgba(120, 110, 180, 0.18)',
    filter: 'saturate(0.55) contrast(1.22) brightness(0.94)',
    title: ['#ffffff', '#c9b8ff', '#8d7aa8'],
    sun: ['#e8e0ff', '#5a4a6e'],
  },
  {
    id: 'candy',
    label: 'Cotton Candy',
    sky: ['#3d0b4d', '#a4136e', '#ff6fb5', '#ffb3d9', '#ffe9f6'],
    wash: 'rgba(255, 111, 181, 0.16)',
    filter: 'saturate(1.35) contrast(1.04) hue-rotate(12deg)',
    title: ['#ffe9f6', '#ff6fb5', '#a4136e'],
    sun: ['#ffe9f6', '#ff6fb5'],
  },
];

export function gradeById(id) {
  return GRADES.find((g) => g.id === id) ?? GRADES[0];
}

// Deterministic pseudo-random stream, so the grain looks the same on
// every render of the same cover.
function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function skyGradient(ctx, grade, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  const stops = grade.sky;
  for (let i = 0; i < stops.length; i++) g.addColorStop(i / (stops.length - 1), stops[i]);
  return g;
}

export function drawSun(ctx, cx, cy, r, grade) {
  const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  g.addColorStop(0, grade.sun[0]);
  g.addColorStop(1, grade.sun[1]);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  // Synthwave slats cut across the lower half of the sun.
  ctx.globalCompositeOperation = 'destination-out';
  let y = cy + r * 0.05;
  let gap = r * 0.06;
  while (y < cy + r) {
    ctx.fillRect(cx - r, y, r * 2, gap);
    y += gap + r * 0.16;
    gap *= 1.5;
  }
  ctx.restore();
}

// A palm silhouette drawn from arcs: a curved trunk and seven fronds.
export function drawPalm(ctx, x, y, s, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  // Trunk, leaning gently.
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(14, -55, 34, -105);
  ctx.stroke();
  // Fronds fanning from the crown.
  ctx.lineWidth = 5;
  const crown = { x: 34, y: -105 };
  for (let i = 0; i < 7; i++) {
    const a = (-Math.PI * 0.95) + (i * Math.PI * 0.32);
    const len = 52 - Math.abs(i - 3) * 6;
    const tipX = crown.x + Math.cos(a) * len;
    const tipY = crown.y + Math.sin(a) * len * 0.55 - 8;
    ctx.beginPath();
    ctx.moveTo(crown.x, crown.y);
    ctx.quadraticCurveTo(
      crown.x + Math.cos(a) * len * 0.5,
      crown.y + Math.sin(a) * len * 0.5 - 22,
      tipX,
      tipY,
    );
    ctx.stroke();
  }
  // Coconuts.
  ctx.beginPath();
  ctx.arc(crown.x - 4, crown.y + 4, 5, 0, Math.PI * 2);
  ctx.arc(crown.x + 6, crown.y + 6, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPhotoInto(ctx, img, rect, zoom, ox, oy, filter, ay = 0.3) {
  if (!img || !img.naturalWidth) return false;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const base = Math.max(rect.w / iw, rect.h / ih) * zoom;
  const dw = iw * base;
  const dh = ih * base;
  // Cover-fit, anchored at the panel's focal point instead of dead
  // centre: a centred crop beheads the subject in wide panels. The drag
  // offset still lets the user re-centre by hand.
  const dx = rect.x + (rect.w - dw) / 2 + ox * rect.w;
  const dy = rect.y + (rect.h - dh) * ay + oy * rect.h;
  ctx.save();
  ctx.filter = filter || 'none';
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
  return true;
}

function panelFallback(ctx, rect, grade, index) {
  const g = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  g.addColorStop(0, grade.sky[1]);
  g.addColorStop(1, grade.sky[3]);
  ctx.fillStyle = g;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  drawSun(ctx, rect.x + rect.w / 2, rect.y + rect.h * 0.38, Math.min(rect.w, rect.h) * 0.2, grade);
  drawPalm(ctx, rect.x + rect.w * 0.12, rect.y + rect.h * 0.95, Math.min(rect.w, rect.h) / 260, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `${Math.round(Math.min(rect.w, rect.h) * 0.09)}px Anton, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(`PANEL ${index + 1}`, rect.x + rect.w / 2, rect.y + rect.h * 0.82);
}

function fitFont(ctx, text, family, maxWidth, startPx, weight) {
  let px = startPx;
  const style = weight ? `${weight} ${px}px ${family}` : `${px}px ${family}`;
  ctx.font = style;
  while (px > 12 && ctx.measureText(text).width > maxWidth) {
    px -= 4;
    ctx.font = weight ? `${weight} ${px}px ${family}` : `${px}px ${family}`;
  }
  return px;
}

function drawStar(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = Math.cos(a) * rad;
    const y = Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

export function drawBadge(ctx, text, x, y, w, h) {
  // Yellow ribbon with folded ends and a dark outline.
  const fold = h * 0.35;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + fold, y);
  ctx.lineTo(x + w - fold, y);
  ctx.lineTo(x + w, y + h / 2);
  ctx.lineTo(x + w - fold, y + h);
  ctx.lineTo(x + fold, y + h);
  ctx.lineTo(x, y + h / 2);
  ctx.closePath();
  ctx.fillStyle = '#ffd319';
  ctx.fill();
  ctx.lineWidth = Math.max(2, h * 0.08);
  ctx.strokeStyle = '#14041f';
  ctx.stroke();
  ctx.fillStyle = '#14041f';
  const px = fitFont(ctx, text, 'Anton, sans-serif', w - fold * 2 - 8, h * 0.62);
  ctx.font = `${px}px Anton, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + h / 2 + 1);
  ctx.restore();
}

export function drawTitleBand(ctx, opts, titleBox, grade) {
  const { w, h } = titleBox;
  const x0 = titleBox.x;
  const y0 = titleBox.y;
  // Deep band with a halftone dot strip along its top edge.
  ctx.fillStyle = '#12081f';
  ctx.fillRect(x0, y0, w, h);
  const dotR = Math.max(2, h * 0.02);
  const step = dotR * 3.4;
  ctx.fillStyle = grade.title[1];
  for (let dx = step / 2; dx < w; dx += step) {
    for (let row = 0; row < 2; row++) {
      ctx.globalAlpha = 0.85 - row * 0.35;
      ctx.beginPath();
      ctx.arc(x0 + dx, y0 + dotR * 2 + row * step, dotR * (1 - row * 0.3), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  const pad = w * 0.045;
  const textW = w - pad * 2;
  const title = (opts.title || 'UNTITLED').toUpperCase();
  // Sunset-gradient title with a heavy black outline.
  const titlePx = fitFont(ctx, title, 'Anton, sans-serif', textW, h * 0.42);
  const titleGrad = ctx.createLinearGradient(0, y0 + h * 0.2, 0, y0 + h * 0.62);
  titleGrad.addColorStop(0, grade.title[0]);
  titleGrad.addColorStop(0.55, grade.title[1]);
  titleGrad.addColorStop(1, grade.title[2]);
  ctx.font = `${titlePx}px Anton, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, titlePx * 0.09);
  ctx.strokeStyle = '#14041f';
  const titleY = y0 + h * 0.56;
  ctx.strokeText(title, x0 + pad, titleY);
  ctx.fillStyle = titleGrad;
  ctx.fillText(title, x0 + pad, titleY);

  // Script subtitle in Pacifico, tucked under the title.
  const sub = opts.subtitle || '';
  if (sub) {
    const subPx = fitFont(ctx, sub, 'Pacifico, cursive', textW * 0.8, h * 0.17);
    ctx.font = `${subPx}px Pacifico, cursive`;
    ctx.fillStyle = '#ff9de2';
    ctx.fillText(sub, x0 + pad + 4, y0 + h * 0.82);
  }

  // Five stars and the ribbon badge on the right of the band.
  const starR = h * 0.075;
  const starsY = y0 + h * 0.8;
  let sx = x0 + w - pad - starR * 9;
  for (let i = 0; i < 5; i++) {
    drawStar(ctx, sx + i * starR * 2.1, starsY, starR, '#ffd319');
  }
  const badgeW = Math.min(w * 0.24, 340);
  const badgeH = h * 0.3;
  drawBadge(ctx, (opts.badge || 'VICE CITY').toUpperCase(), x0 + w - pad - badgeW, y0 + h * 0.12, badgeW, badgeH);
}

export function drawGrain(ctx, w, h, amount = 0.05) {
  const rand = seededRandom(20261119);
  ctx.save();
  for (let i = 0; i < Math.floor(w * h * 0.00012); i++) {
    const v = rand();
    ctx.globalAlpha = amount * (0.4 + v * 0.6);
    ctx.fillStyle = v > 0.5 ? '#ffffff' : '#000000';
    ctx.fillRect(rand() * w, rand() * h, 1.6, 1.6);
  }
  ctx.restore();
}

export function drawVignette(ctx, w, h) {
  const g = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.42,
    w / 2, h / 2, Math.max(w, h) * 0.75,
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

// The whole cover. `opts` carries layout, grade, lettering, per-panel
// edit state and toggles; `photos` is an array of loaded Image objects
// (one per photo slot, null where a slot is still empty).
export function drawCover(ctx, opts, photos) {
  const { w, h } = opts;
  const grade = gradeById(opts.grade);
  ctx.save();
  ctx.clearRect(0, 0, w, h);

  // Sky backdrop for every layout.
  ctx.fillStyle = skyGradient(ctx, grade, w, h);
  ctx.fillRect(0, 0, w, h);

  const layout = opts.layout;
  const panelList = layout.panels;

  if (layout.backdrop === 'sunset') {
    // Big sun high in the sky band, so its disc and slats stay visible
    // above the tilted snapshots instead of hiding behind them.
    drawSun(ctx, w * 0.5, h * 0.17, Math.min(w, h) * 0.27, grade);
  } else if (layout.backdrop === 'sky') {
    drawSun(ctx, w * 0.82, h * 0.16, Math.min(w, h) * 0.11, grade);
  }

  const border = Math.max(3, Math.round(Math.min(w, h) * 0.005));
  panelList.forEach((panel, i) => {
    const edit = opts.panels[i] ?? { photo: i % 3, zoom: 1, ox: 0, oy: 0, ay: 0.3 };
    const img = photos[edit.photo] ?? null;
    ctx.save();
    ctx.translate(panel.x + panel.w / 2, panel.y + panel.h / 2);
    if (panel.angle) ctx.rotate((panel.angle * Math.PI) / 180);
    ctx.translate(-panel.w / 2, -panel.h / 2);
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = Math.min(w, h) * 0.02;
    ctx.shadowOffsetY = Math.min(w, h) * 0.008;
    ctx.beginPath();
    ctx.rect(0, 0, panel.w, panel.h);
    ctx.fillStyle = '#1a0b2e';
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, panel.w, panel.h);
    ctx.clip();
    const inner = { x: 0, y: 0, w: panel.w, h: panel.h };
    const drawn = drawPhotoInto(ctx, img, inner, edit.zoom, edit.ox, edit.oy, grade.filter, edit.ay);
    if (!drawn) panelFallback(ctx, inner, grade, i);
    // Gradient-map wash over the photo, then a soft top light.
    ctx.fillStyle = grade.wash;
    ctx.fillRect(0, 0, panel.w, panel.h);
    const shine = ctx.createLinearGradient(0, 0, panel.w, panel.h);
    shine.addColorStop(0, 'rgba(255,255,255,0.10)');
    shine.addColorStop(0.5, 'rgba(255,255,255,0)');
    ctx.fillStyle = shine;
    ctx.fillRect(0, 0, panel.w, panel.h);
    ctx.restore();
    ctx.lineWidth = border;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(border / 2, border / 2, panel.w - border, panel.h - border);
    ctx.restore();
  });

  // Palms frame the sunset from the top corners, drawn over the sky
  // (and just kissing the snapshot edges) so they read as poster art
  // instead of disappearing behind the panels.
  if (layout.backdrop === 'sunset') {
    drawPalm(ctx, w * 0.005, h * 0.3, Math.min(w, h) / 380, 'rgba(8,2,18,0.92)');
    drawPalm(ctx, w * 0.985, h * 0.3, Math.min(w, h) / 460, 'rgba(8,2,18,0.9)');
  }

  // Full-bleed photos wash the whole cover; the title sits on top.
  if (layout.titleOverlay) {
    const wash = ctx.createLinearGradient(0, h * 0.55, 0, h);
    wash.addColorStop(0, 'rgba(18,8,31,0)');
    wash.addColorStop(1, 'rgba(18,8,31,0.88)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, h * 0.55, w, h * 0.45);
    ctx.globalAlpha = 0.92;
    drawTitleBand(ctx, opts, layout.title, grade);
    ctx.globalAlpha = 1;
  } else {
    drawTitleBand(ctx, opts, layout.title, grade);
  }

  if (opts.grain !== false) drawGrain(ctx, w, h);
  if (opts.vignette !== false) drawVignette(ctx, w, h);
  ctx.restore();
}
