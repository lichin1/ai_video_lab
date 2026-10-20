// 共用：靜態伺服器 + 無頭 Chromium（軟體 WebGL）開啟場景頁面。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
function loadPlaywright() {
  for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(p); } catch {}
  }
  throw new Error('playwright not found');
}
export const { chromium } = loadPlaywright();

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };

export function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(p).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

/** 開啟場景，等到 window.ready。query 例如 { only: 'pond', w: 960, h: 540 }。 */
export async function openScene(query = {}) {
  const { server, port } = await serve();
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
  });
  const w = +query.w || 1920, h = +query.h || 1080;
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(0);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
  const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== '')).toString();
  await page.goto(`http://127.0.0.1:${port}/index.html?${qs}`);
  await page.waitForFunction(() => window.ready || window.loadError, null, { timeout: 600000, polling: 200 });
  const loadError = await page.evaluate(() => window.loadError);
  if (loadError) throw new Error('scene failed to load:\n' + loadError + '\n' + errors.join('\n'));
  return {
    page, errors,
    async frame(t, cam) {
      const info = await page.evaluate(([t, cam]) => window.renderAt(t, cam), [t, cam || null]);
      const png = await page.locator('canvas').screenshot({ type: 'png', timeout: 0 });
      return { png, info };
    },
    async close() { await browser.close(); server.close(); },
  };
}
