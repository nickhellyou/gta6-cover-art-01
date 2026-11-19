// shots.js — reproducible screenshot scenes for Neon Coast Cover Studio.
//
// The verification tools drive the app with a query string such as
// ?shot=cover&layout=tilted-trio&grade=neon&size=1080x1350&caption=NEON
// NIGHTS&photo=neon,boulevard,pier. This module reads that query, applies
// it to the editor state, loads the named sample photos, and raises
// window.__shotReady only after the fonts, the photos and the first
// render are all in place — so a screenshot always catches the real app.

export function readShotQuery(search = window.location.search) {
  const q = new URLSearchParams(search);
  const photo = (q.get('photo') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    shot: q.get('shot') || '',
    layout: q.get('layout') || '',
    grade: q.get('grade') || '',
    size: q.get('size') || '',
    caption: q.get('caption') || '',
    subtitle: q.get('subtitle') || '',
    badge: q.get('badge') || '',
    photo,
  };
}

export function sampleUrl(name) {
  const safe = String(name).replace(/[^a-z0-9_-]/gi, '').toLowerCase() || 'boulevard';
  return `./samples/${safe}.jpg`;
}

export function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function loadSamplePhotos(names) {
  const picked = names.length ? names : ['boulevard', 'neon', 'pier'];
  const slots = [];
  for (let i = 0; i < 3; i++) {
    slots.push(await loadImage(sampleUrl(picked[i % picked.length])));
  }
  return slots;
}

export async function loadAppFonts() {
  try {
    await Promise.all([
      document.fonts.load('80px Anton'),
      document.fonts.load('40px Pacifico'),
      document.fonts.ready,
    ]);
  } catch {
    // If a font fails, the canvas still renders with its fallback face.
  }
}

// Apply the shot query onto a fresh editor state. Unknown values are
// ignored so a bad query still renders a valid cover.
export function applyShotToState(state, query, validLayouts, validGrades, validSizes) {
  if (query.layout && validLayouts.some((l) => l.id === query.layout)) {
    state.layout = query.layout;
  }
  if (query.grade && validGrades.some((g) => g.id === query.grade)) {
    state.grade = query.grade;
  }
  if (query.size && validSizes.some((s) => s.id === query.size)) {
    state.size = query.size;
  }
  if (query.caption) state.title = query.caption;
  if (query.subtitle) state.subtitle = query.subtitle;
  if (query.badge) state.badge = query.badge;
  return state;
}

export function markShotReady() {
  window.__shotReady = true;
}
