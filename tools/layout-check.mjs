// Renders every layout x grade x size in headless Chromium and fails on any
// console error or missing __shotReady. Not part of the entry's screenshots.
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
const appDir = '/home/hatch/workspace/makefun/gta6-cover-art-01/app';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.txt': 'text/plain' };
const server = createServer(async (req, res) => {
  try {
    const p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = normalize(join(appDir, p === '/' ? 'index.html' : p.replace(/^\//, '')));
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise((r) => server.listen(18085, r));
const browser = await chromium.launch({ executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome`, args: ['--no-sandbox'] });
const layouts = ['hero-trio', 'grid-four', 'full-bleed', 'tilted-trio', 'nine-grid', 'sunset-split'];
const grades = ['vice', 'neon', 'gold', 'noir', 'candy'];
const sizes = ['1920x1080', '1080x1080', '1080x1350'];
let bad = 0;
for (const layout of layouts) {
  for (const grade of grades) {
    for (const size of sizes) {
      const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e.message ?? e)));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      await page.goto(`http://localhost:18085/?shot=cover&layout=${layout}&grade=${grade}&size=${size}&caption=TEST`, { waitUntil: 'load' });
      try {
        await page.waitForFunction(() => window.__shotReady === true, { timeout: 15000 });
      } catch { errors.push('__shotReady timeout'); }
      if (errors.length) { bad++; console.log(`FAIL ${layout}/${grade}/${size}: ${errors.join(' | ')}`); }
      await page.close();
    }
  }
}
await browser.close(); server.close();
console.log(bad ? `${bad} combos FAILED` : `All ${layouts.length * grades.length * sizes.length} layout/grade/size combos OK.`);
process.exit(bad ? 1 : 0);
