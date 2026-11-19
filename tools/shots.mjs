// Neon Coast screenshot tool: loads the app in headless Chromium, stages
// each of the 4 shots (?shot=cover|editor) and saves a real render of the
// app as a JPEG kept under the 256 KiB gate cap. It also clicks Export in
// the editor and checks the downloaded PNG is a real PNG. Run it with:
//   node tools/shots.mjs
// It serves app/ itself, so no separate server is needed.

import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = join(here, '..');
const appDir = join(repoRoot, 'app');
const shotsDir = join(repoRoot, 'screenshots');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

const PORT = 18083;
const server = createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, '');
    const file = normalize(join(appDir, rel));
    if (!file.startsWith(appDir)) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

const SHOTS = [
  {
    name: '1-cover.jpg', w: 1280, h: 720,
    query: 'shot=cover&photo=boulevard,neon,pier&caption=BOULEVARD%20QUEEN&subtitle=vice%20city%20nights&layout=hero-trio&grade=vice&size=1920x1080',
    note: 'cover: hero-trio, Vice Sunset, 1920x1080 export',
  },
  {
    name: '2-editor.jpg', w: 1280, h: 720,
    query: 'shot=editor&photo=boulevard,neon,pier&caption=BOULEVARD%20QUEEN&layout=hero-trio&grade=vice&size=1920x1080',
    note: 'editor with a photo loaded, controls visible',
  },
  {
    name: '3-cover-portrait.jpg', w: 1024, h: 1280,
    query: 'shot=cover&photo=neon,boulevard,pier&caption=NEON%20NIGHTS&subtitle=ocean%20drive%20after%20dark&layout=tilted-trio&grade=neon&size=1080x1350',
    note: 'cover: tilted-trio, Neon Nights, 1080x1350 export',
  },
  {
    name: '4-cover-square.jpg', w: 1080, h: 1080, quality: 76,
    query: 'shot=cover&photo=pier,boulevard,neon&caption=GOLD%20HOUR&subtitle=last%20cast%20at%20the%20pier&layout=nine-grid&grade=gold&size=1080x1080',
    note: 'cover: nine-grid, Gold Hour, 1080x1080 export',
  },
];

async function main() {
  await new Promise((r) => server.listen(PORT, r));
  await mkdir(shotsDir, { recursive: true });
  const browser = await chromium.launch({
    executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome`,
    args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const results = [];
  try {
    for (const shot of SHOTS) {
      const page = await browser.newPage({ viewport: { width: shot.w, height: shot.h } });
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e.message ?? e)));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
      });
      await page.goto(`http://localhost:${PORT}/?${shot.query}`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__shotReady === true, { timeout: 20000 });
      const file = join(shotsDir, shot.name);
      await page.screenshot({ path: file, type: 'jpeg', quality: shot.quality ?? 82 });
      const size = (await stat(file)).size;
      const ok = size > 0 && size <= 262144 && errors.length === 0;
      results.push({ shot: shot.name, note: shot.note, bytes: size, errors, ok });
      console.log(`${ok ? 'OK  ' : 'FAIL'} ${shot.name} ${size} bytes${errors.length ? ` errors: ${errors.join(' | ')}` : ''}`);
      await page.close();
    }
    // Export check: click Export in the editor and verify a real PNG downloads.
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message ?? e)));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.goto(`http://localhost:${PORT}/?${SHOTS[1].query}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__shotReady === true, { timeout: 20000 });
    const downloadPromise = page.waitForEvent('download', { timeout: 20000 });
    await page.click('#exportBtn');
    const download = await downloadPromise;
    const tmp = '/tmp/neon-coast-export-test.png';
    await download.saveAs(tmp);
    const buf = await readFile(tmp);
    const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    const pngW = buf.readUInt32BE(16);
    const pngH = buf.readUInt32BE(20);
    const exportOk = isPng && pngW === 1920 && pngH === 1080 && errors.length === 0;
    console.log(`${exportOk ? 'OK  ' : 'FAIL'} export PNG ${buf.length} bytes ${pngW}x${pngH}${errors.length ? ` errors: ${errors.join(' | ')}` : ''}`);
    results.push({ shot: 'export-png', bytes: buf.length, ok: exportOk, errors });
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.log(`\n${failed.length} shot(s) FAILED`);
    process.exit(1);
  }
  console.log('\nAll shots OK.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
