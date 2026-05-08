# MermaidFlow CLI

Render Mermaid flowcharts as **animated GIF or MP4** from the command line. Reuses 100% of the web app — same parser, layout, particle engine, and pipe rendering — automated via headless Chromium.

```
mermaid-flow login-flow.mmd -o login-demo.gif --duration 6 --fps 15
```

---

## How it works

1. CLI starts a local Express server pointing at the project's built `dist/`.
2. Headless Chromium opens the web app via Playwright.
3. The `.mmd` source is injected into the editor and rendered.
4. The sidebar/header are hidden via CSS so the canvas fills the viewport.
5. Frames are captured as PNGs at the requested FPS for the requested duration.
6. `ffmpeg` (bundled via `ffmpeg-static`) encodes the frames:
   - **GIF**: two-pass with `palettegen` + `paletteuse=dither=sierra2_4a` for crisp colors.
   - **MP4**: `libx264` + `yuv420p` + `faststart` for broad compatibility (Twitter, Slack, presentations).

No GPU dependency. Works on CI, on your laptop, on a Mac with HiDPI screen — same output everywhere.

---

## Install

The CLI lives inside the [mermaid-Visualizer monorepo](../) for now. From the project root:

```bash
# 1. Install root deps + build the web app once
npm install
npm run build

# 2. Install the CLI's own deps (Playwright + ffmpeg-static)
cd cli
npm install
npx playwright install chromium   # ~92 MB Chromium download

# 3. Build the CLI
npm run build
```

After this, the CLI binary is at `cli/dist/index.js`. The repo also ships a `bin/mermaid-flow` wrapper that resolves the entry point through any symlink, so you can put it on `$PATH` and call it from anywhere:

```bash
ln -s "$(pwd -P)/../bin/mermaid-flow" /usr/local/bin/mermaid-flow

# Now from anywhere:
mermaid-flow examples/login-flow.mmd -o demo.gif
```

### Claude / Claude Code skill

A ready-made skill lives at [`.claude/skills/mermaid-flow/`](../.claude/skills/mermaid-flow/) — install it once and Claude can drive this CLI for you with sensible defaults per use case (README, slides, social, etc.). See the [main README](../README.md#claude--claude-code-skill) for install steps.

---

## Usage

```
mermaid-flow <input> [options]
```

`<input>` is the path to a `.mmd` file, or `-` to read from stdin.

### Options

| Flag | Default | Description |
|---|---|---|
| `-o, --output <path>` | `output.gif` | Output file. Extension `.gif` or `.mp4` chooses the format. |
| `-t, --type <type>` | `alternate` | `success` / `error` / `alternate` |
| `-s, --speed <multiplier>` | `1` | `0.5`, `1`, `2`, or `3` (matches the UI presets) |
| `-d, --duration <seconds>` | `8` | Recording length in seconds |
| `--fps <fps>` | `15` | Frames per second (10–30 for GIF, up to 60 for MP4) |
| `--width <px>` | `1280` | Viewport / output width |
| `--height <px>` | `720` | Viewport / output height |
| `--scale <factor>` | `2` | Device scale factor (`2` = retina, sharper text) |
| `--auto-interval <ms>` | `2000` | Spawn interval in auto mode (500–5000) |
| `--error-loop-limit <n>` | `3` | Max revisits before an error particle stops |
| `--no-badges` | _(badges shown)_ | Hide per-node arrival counters for a cleaner output |
| `--keep-temp` | off | Don't delete the temp dir (useful for inspecting frames) |
| `--quiet` | off | Suppress progress logs |
| `-V, --version` | | Print CLI version |
| `-h, --help` | | Print help |

### Examples

**Quick demo of the Login Flow (default settings):**

```bash
mermaid-flow examples/login-flow.mmd -o login.gif
```

**MP4 for a presentation, 24fps, 1280×720, retina:**

```bash
mermaid-flow flow.mmd -o flow.mp4 --duration 10 --fps 24 --width 1280 --height 720 --scale 2
```

**Error-only path with no badges (clean recording for a docs page):**

```bash
mermaid-flow checkout.mmd -o error-flow.gif --type error --no-badges --duration 6
```

**Stream from stdin:**

```bash
cat my-flow.mmd | mermaid-flow - -o out.gif
```

**Multiple particles flying at once:**

```bash
mermaid-flow pipeline.mmd -o stress.mp4 --auto-interval 700 --speed 2 --duration 6
```

---

## Tips

- **Output size = viewport size × scale**. A `--width 1280 --height 720 --scale 2` capture produces a 2560×1440 file. For social media (Twitter, etc.), `1280×720 @1` is usually enough.
- **GIF size grows fast**. For long animations, MP4 is 5–10× smaller and looks better. Use GIF only when you need it embedded inline (GitHub README, Slack thumbnail).
- **`--duration` should fit the slowest path.** A diagram with retry loops needs more time for an error particle to finish. Default 8s is a reasonable starting point.
- **`--auto-interval` controls density.** Lower = more particles on screen at once. With 4 start nodes and `interval: 500`, expect very busy frames.
- **`--scale 2` is the sweet spot** for sharp text. Higher (3+) increases file size without much visible benefit.

---

## Programmatic usage

You can also call the renderer directly from Node:

```ts
import { run } from '@mermaid-flow/cli/dist/render.js';
import { readFileSync } from 'node:fs';

await run({
  source: readFileSync('flow.mmd', 'utf-8'),
  output: '/tmp/flow.gif',
  type: 'alternate',
  speed: '1',
  duration: 6,
  fps: 15,
  width: 1280,
  height: 720,
  scale: 2,
  autoInterval: 1500,
  errorLoopLimit: 3,
  badges: true,
  keepTemp: false,
  quiet: false,
});
```

---

## Troubleshooting

- **`Build artifacts not found at .../dist`** → run `npm run build` in the project root before invoking the CLI. The CLI serves `dist/` to drive the rendering.
- **`browserType.launch: Executable doesn't exist`** → run `npx playwright install chromium` inside `cli/`. Playwright caches the browser at `~/Library/Caches/ms-playwright/`.
- **`ffmpeg-static did not provide a binary path`** → reinstall deps: `cd cli && rm -rf node_modules && npm install`. The static binary should be at `cli/node_modules/ffmpeg-static/ffmpeg`.
- **Output looks janky / low fps** → animation is captured live, so a slow machine can fall behind. Reduce `--scale` or `--width`, or lower `--fps` to give the render loop more time per frame.
- **Particles pile up at the start of the GIF** → the auto-spawn timer fires at `t=0` and at every `--auto-interval` ms. Use a longer `--duration` or smaller `--auto-interval` if you want a fuller scene immediately.

---

## How it integrates with the rest of the project

```
mermaid-Visualizer/        ← monorepo root
├── src/                   ← React web app (the renderer)
├── plugin/                ← Obsidian plugin (uses the same engine, no React)
├── cli/                   ← THIS — Node CLI (drives the web app via Playwright)
│   ├── src/
│   │   ├── index.ts       ← argument parsing
│   │   ├── render.ts      ← Playwright orchestration + frame capture
│   │   ├── encode.ts      ← ffmpeg wrappers
│   │   └── types.ts
│   ├── examples/          ← sample .mmd files
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md          ← this file
└── dist/                  ← built web app (consumed by the CLI)
```

The CLI is intentionally thin — all of the rendering logic lives in the web app. If you change the parser, layout, particles, or pipe styling, the CLI inherits the change automatically the next time you run `npm run build`.
