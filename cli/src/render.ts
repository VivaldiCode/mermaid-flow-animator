import express from 'express';
import { mkdir, mkdtemp, readdir, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import { type Browser, type Page, chromium } from 'playwright';

import type { RenderInput } from './types.js';
import { encodeWithFfmpeg } from './encode.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Two layouts to support:
//   1. Installed via npm: <package>/dist/render.js + <package>/web-dist/index.html
//   2. Monorepo dev:      cli/dist/render.js + ../dist/index.html (root)
async function findWebDistDir(): Promise<string> {
  const cliPkgRoot = path.resolve(__dirname, '..');
  const candidates = [
    path.join(cliPkgRoot, 'web-dist'),
    path.resolve(cliPkgRoot, '..', 'dist'),
  ];
  for (const candidate of candidates) {
    try {
      await access(path.join(candidate, 'index.html'));
      return candidate;
    } catch {
      /* keep looking */
    }
  }
  throw new Error(
    'Web app dist not found. Tried:\n' +
      candidates.map((c) => `  - ${c}`).join('\n') +
      '\n\nIf you are running from the monorepo, run "npm run build" at the root.\n' +
      'If you installed via npm, the package is broken — please report at\n' +
      '  https://github.com/VivaldiCode/mermaid-flow-animator/issues',
  );
}

function log(input: RenderInput, message: string): void {
  if (!input.quiet) process.stdout.write(`${message}\n`);
}

export async function run(input: RenderInput): Promise<void> {
  const ext = path.extname(input.output).toLowerCase();
  if (ext !== '.gif' && ext !== '.mp4') {
    throw new Error(`Output must be .gif or .mp4 (got "${ext}")`);
  }

  const distDir = await findWebDistDir();

  const tmpDir = await mkdtemp(path.join(tmpdir(), 'mfa-cli-'));
  log(input, `→ Temp dir: ${tmpDir}`);

  const sourcePath = path.join(tmpDir, 'source.mmd');
  await writeFile(sourcePath, input.source, 'utf-8');

  const { server, port } = await startServer(distDir);
  log(input, `→ Local server on port ${port}`);

  let browser: Browser | undefined;
  try {
    log(input, '→ Launching headless Chromium…');
    browser = await chromium.launch({ headless: true });

    const context = await browser.newContext({
      viewport: { width: input.width, height: input.height },
      deviceScaleFactor: input.scale,
    });
    const page = await context.newPage();

    log(input, `→ Opening web app (viewport ${input.width}×${input.height} @${input.scale}x)…`);
    await page.goto(`http://localhost:${port}`, { waitUntil: 'networkidle' });

    // Force the desktop horizontal layout regardless of viewport width.
    // Avoids the @media (max-width: 900px) rule that would put the sidebar on top
    // of the canvas and break click targets during automation.
    await page.addStyleTag({
      content: `
        .app-body { flex-direction: row !important; }
        aside.sidebar {
          width: 360px !important;
          max-width: 360px !important;
          height: 100% !important;
          border-right: 1px solid #1e293b !important;
          border-bottom: none !important;
        }
      `,
    });

    log(input, '→ Setting diagram source and config…');
    await driveUi(page, input);

    const frameDir = path.join(tmpDir, 'frames');
    await mkdir(frameDir, { recursive: true });

    log(input, `→ Capturing ${input.duration}s @ ${input.fps}fps…`);
    await captureFrames(page, frameDir, input);

    log(input, '→ Encoding via ffmpeg…');
    await encodeWithFfmpeg({
      framePattern: path.join(frameDir, 'frame-%05d.png'),
      output: input.output,
      fps: input.fps,
      width: input.width * input.scale,
      height: input.height * input.scale,
      quiet: input.quiet,
    });

    log(input, `✓ Saved: ${input.output}`);
  } finally {
    if (browser) await browser.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (!input.keepTemp) {
      await rm(tmpDir, { recursive: true, force: true });
    } else {
      log(input, `! Kept temp dir at ${tmpDir} (--keep-temp)`);
    }
  }
}

async function startServer(distDir: string): Promise<{ server: Server; port: number }> {
  const app = express();
  app.use(express.static(distDir));
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({ server, port });
    });
  });
}

async function driveUi(page: Page, input: RenderInput): Promise<void> {
  // 1) Fill the editor source via DOM (textarea is in the visible sidebar)
  await page.evaluate((src) => {
    const textarea = document.querySelector<HTMLTextAreaElement>('textarea.mermaid-editor');
    if (!textarea) throw new Error('mermaid-editor textarea not found');
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value',
    )?.set;
    setter?.call(textarea, src);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }, input.source);

  // 2) Click "Parse & Render" while sidebar is still visible
  await page.locator('button.btn-control', { hasText: /Parse & Render/i }).click();
  await page.waitForSelector('svg.flow-canvas', { timeout: 10_000 });
  await page.waitForTimeout(200);

  // 3) PARTICLE TYPE
  const typeLabel = capitalize(input.type);
  await page.locator('button.btn-kind', { hasText: new RegExp(`^\\s*${typeLabel}\\s*$`) }).click();

  // 4) SPEED: scope to the section to avoid clashing with EXPORT GIF buttons
  const speedSection = page.locator('.control-section').filter({
    has: page.locator('.section-label', { hasText: /^SPEED$/ }),
  });
  const speedBtn = speedSection.locator('button.btn-control', {
    hasText: new RegExp(`^${input.speed}×$`),
  });
  if (await speedBtn.count()) await speedBtn.first().click();

  // 5) ERROR LOOPS slider
  await page.evaluate((value) => {
    const slider = document.querySelector<HTMLInputElement>(
      '.error-loop-control input[type="range"]',
    );
    if (slider) {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;
      setter?.call(slider, String(value));
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      slider.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, input.errorLoopLimit);

  // 6) TERMINAL BADGES — Show/Hide
  const badgesSection = page.locator('.control-section').filter({
    has: page.locator('.section-label', { hasText: /^TERMINAL BADGES$/ }),
  });
  await badgesSection
    .locator('button.btn-control', { hasText: new RegExp(`^${input.badges ? 'Show' : 'Hide'}$`) })
    .click();

  // 7) MODE — Auto for continuous spawning
  const modeSection = page.locator('.control-section').filter({
    has: page.locator('.section-label', { hasText: /^MODE$/ }),
  });
  await modeSection.locator('button.btn-control', { hasText: /^Auto$/ }).click();

  // 8) AUTO interval slider
  await page.evaluate((value) => {
    const slider = document.querySelector<HTMLInputElement>(
      '.auto-interval input[type="range"]',
    );
    if (slider) {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;
      setter?.call(slider, String(value));
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      slider.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, input.autoInterval);

  // 9) Now hide the chrome so the canvas fills the viewport
  await page.addStyleTag({
    content: `
      header.app-header,
      aside.sidebar { display: none !important; }
      main.canvas-container { width: 100vw !important; height: 100vh !important; }
      .canvas-overlay { opacity: ${input.badges ? 1 : 0} !important; }
    `,
  });

  // 10) Settle a bit for layout + initial spawns
  await page.waitForTimeout(300);
}

async function captureFrames(page: Page, frameDir: string, input: RenderInput): Promise<void> {
  const totalFrames = Math.round(input.duration * input.fps);
  const intervalMs = 1000 / input.fps;

  await page.waitForSelector('.flow-canvas-wrapper');

  const start = Date.now();
  let lastReport = 0;

  for (let i = 0; i < totalFrames; i++) {
    const filename = `frame-${String(i + 1).padStart(5, '0')}.png`;
    await page.screenshot({
      type: 'png',
      path: path.join(frameDir, filename),
      fullPage: false,
      animations: 'allow',
    });

    if (!input.quiet) {
      const elapsed = Date.now() - start;
      const expected = (i + 1) * intervalMs;
      if (elapsed - lastReport > 500) {
        const pct = Math.round(((i + 1) / totalFrames) * 100);
        process.stdout.write(`  ${pct}%  (${i + 1}/${totalFrames} frames)\r`);
        lastReport = elapsed;
      }
      const drift = expected - elapsed;
      if (drift > 0) await page.waitForTimeout(drift);
    } else {
      await page.waitForTimeout(intervalMs);
    }
  }
  if (!input.quiet) process.stdout.write('\n');
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1).toLowerCase();
}

async function listFrames(dir: string): Promise<string[]> {
  const files = await readdir(dir);
  return files.filter((f) => f.startsWith('frame-') && f.endsWith('.png')).sort();
}
