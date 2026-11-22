// Render this entry's screenshots: headless Chromium over CDP loads each
// ?shot= scene from shots.json, captures a 1280x720 PNG and converts it to
// JPEG (quality 82) so every shot stays under the 256 KiB cap.
// Usage: node take-shots.mjs   (it serves game/ on :8080 while it runs)
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const chrome = process.env.CHROME ?? `${process.env.HOME}/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome`;
const shots = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8'));
const tmpDir = join(here, '.shots-tmp');
mkdirSync(tmpDir, { recursive: true });
mkdirSync(join(here, 'screenshots'), { recursive: true });

const server = spawn(process.execPath, ['serve.ts'], { cwd: here, stdio: 'pipe' });
const browser = spawn(chrome, [
  '--headless=new', '--disable-gpu', '--no-sandbox',
  '--remote-debugging-port=9224', '--window-size=1280,720', 'about:blank',
], { stdio: 'ignore' });

async function getJson(path) {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:9224${path}`);
      if (res.ok) return await res.json();
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('devtools not up');
}

const consoleErrors = [];
try {
  await new Promise((r) => setTimeout(r, 1200));
  const targets = await getJson('/json/list');
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve) => {
    const mid = ++id;
    pending.set(mid, resolve);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(JSON.stringify(msg.params.exceptionDetails).slice(0, 2000));
      console.log('EXCEPTION:', consoleErrors[consoleErrors.length - 1]);
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      consoleErrors.push(JSON.stringify(msg.params.args).slice(0, 1000));
      console.log('CONSOLE ERROR:', consoleErrors[consoleErrors.length - 1]);
    }
  };
  await new Promise((r) => { ws.onopen = r; });
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  for (const shot of shots) {
    await send('Page.navigate', { url: `http://localhost:8080/${shot.query}` });
    await new Promise((r) => setTimeout(r, 2200));
    const capture = await send('Page.captureScreenshot', { format: 'png' });
    const png = join(tmpDir, shot.name.replace(/\.jpe?g$/i, '.png'));
    writeFileSync(png, Buffer.from(capture.data, 'base64'));
    execFileSync('python3', ['-c',
      `from PIL import Image; im = Image.open(${JSON.stringify(png)}).convert('RGB'); im.save(${JSON.stringify(join(here, 'screenshots', shot.name))}, 'JPEG', quality=82)`],
      { stdio: 'pipe', timeout: 60000 });
    console.log(`shot ${shot.name} from ${shot.query}`);
  }
  ws.close();
} finally {
  browser.kill();
  server.kill();
  rmSync(tmpDir, { recursive: true, force: true });
}
console.log('console errors:', consoleErrors.length);
console.log('done');
