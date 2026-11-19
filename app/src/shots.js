// Fixed scenes for screenshots: ?shot=editor shows the editor with sample
// photos loaded; ?shot=cover shows the cover alone, fullscreen.
// `photo` picks the samples (comma-separated: hero, second, third),
// `caption` the title, `layout`, `grade`, `size` and `subtitle` the rest.
// window.__shotReady is set once the cover is painted.
import { defaultPanels } from './panels.js';

export async function runShot(shot, query, api) {
  const { loadSample, setLayout, setGrade, setSize, redraw, state } = api;
  const photos = (query.get('photo') ?? 'boulevard,neon,pier').split(',');
  const samples = ['boulevard', 'neon', 'pier'];
  for (let i = 0; i < 3; i++) {
    const want = photos[i] ?? samples[i];
    if (samples.includes(want)) await loadSample(i, want);
  }
  if (query.get('layout')) setLayout(query.get('layout'));
  if (query.get('grade')) setGrade(query.get('grade'));
  if (query.get('size')) setSize(query.get('size'));
  if (query.get('caption')) state.title = query.get('caption');
  if (query.get('subtitle')) state.subtitle = query.get('subtitle');
  if (query.get('badge')) state.badge = query.get('badge');
  // A cover scene always fills every panel from the loaded samples.
  state.panels = defaultPanels(state.layout, 3);
  state.selected = 0;
  if (shot === 'cover') document.body.classList.add('shot-cover');
  redraw();
  // Fonts + two frames, so the paint the screenshot takes is final.
  await document.fonts.ready;
  redraw();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}
