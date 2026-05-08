---
name: mermaid-flow
description: Render Mermaid flowcharts (.mmd files or inline mermaid source) as animated GIF or MP4 files using the mermaid-flow CLI. Use when the user wants to convert a Mermaid diagram into an animated visualization, generate a flow animation with particles traveling through pipe-styled edges (success/error paths), create an animated demo of a process for README/slides/social, or visualize a flowchart "in motion." Triggers on phrases like "make a GIF of this flow", "render this diagram animated", "convert .mmd to mp4", "animate this flowchart".
---

# MermaidFlow Animator

Use this skill to render Mermaid flowcharts as animated GIFs or MP4 videos. The underlying tool is `mermaid-flow`, a Node CLI that drives a headless Chromium running the [MermaidFlow web app](https://github.com/VivaldiCode/mermaid-flow-animator) and pipes captured frames through `ffmpeg`.

## When to use

- The user has a `.mmd` file (or inline Mermaid `flowchart` source) and wants an animated `.gif`/`.mp4`.
- The user asks for a visualization where data/requests "flow" through a process.
- The user wants to embed an animated diagram in documentation, a README, slides, or a social post.
- The user wants to demo success vs error paths of a flow.

## When NOT to use

- The user wants a **static** image — use `mmdc` (mermaid-cli) instead.
- The diagram is **not a flowchart** (sequence, gantt, pie, ER, class) — this CLI only supports `flowchart TD/LR/BT/RL/TB`.
- The user wants the diagram rendered **inline in markdown** — use Mermaid directly (or the Obsidian plugin).

## Step 1 — Locate the CLI

The CLI binary is one of:

1. `mermaid-flow` in `$PATH` (if the user installed the wrapper symlink)
2. `<project>/bin/mermaid-flow` inside the [mermaid-flow-animator](https://github.com/VivaldiCode/mermaid-flow-animator) repo
3. `<project>/cli/dist/index.js` (raw JS entry, invoke with `node`)

Resolution order:

```bash
# 1. PATH
command -v mermaid-flow >/dev/null && echo "in PATH"

# 2. env var pointing at the repo
if [ -n "$MERMAID_FLOW_DIR" ]; then
  "$MERMAID_FLOW_DIR/bin/mermaid-flow" --help
fi

# 3. ask the user where the repo is cloned
```

If none found, inform the user and link them to the install steps:

```bash
git clone https://github.com/VivaldiCode/mermaid-flow-animator.git
cd mermaid-flow-animator
npm install && npm run build
cd cli && npm install && npx playwright install chromium && npm run build
ln -s "$(pwd -P)/../bin/mermaid-flow" /usr/local/bin/mermaid-flow
```

## Step 2 — Verify the input

Before invoking, sanity-check the source:

- File exists and is readable
- Starts with `flowchart TD` (or `LR`/`TB`/`BT`/`RL`)
- Does **not** contain `sequenceDiagram`, `gantt`, `pie`, `classDiagram`, `erDiagram`, etc. (CLI rejects them)
- Has at least one `-->` edge

## Step 3 — Pick reasonable defaults

Use this decision tree to fill in flags the user didn't specify:

| User intent | Suggested defaults |
|---|---|
| README demo / docs | `--duration 6 --fps 15 --width 1024 --height 768 --scale 2` (GIF) |
| Slide deck / presentation | `--duration 10 --fps 24 --width 1280 --height 720 --scale 2 -o out.mp4` |
| Social post / Twitter | `--duration 8 --fps 20 --width 1280 --height 720 -o out.mp4` |
| Quick preview | `--duration 4 --fps 12 --width 800 --height 600 --scale 1` |
| Show only happy path | add `--type success` |
| Show only error path | add `--type error --no-badges` |
| Busy stress visual | add `--auto-interval 600 --speed 2` |

**Format choice:** prefer `.mp4` over `.gif` when:
- Duration > 8s (GIFs balloon in size)
- The user mentions video, slides, or "share", and it's not a README
- The output file size will be displayed inline

Otherwise, default to `.gif` (more universally embeddable).

## Step 4 — Invoke

Standard call:

```bash
mermaid-flow <input.mmd> -o <output.gif|mp4> [flags]
```

Stdin variant (when the source is inline, not a file):

```bash
echo '<source>' | mermaid-flow - -o <output>
```

Always run the CLI from a directory where the user expects the output, OR pass an absolute path to `-o`.

## Step 5 — Verify the output

After the CLI exits with code 0:

```bash
file <output>
# Expect: "GIF image data, version 89a, WIDTH x HEIGHT" or
#         "ISO Media, MP4 Base Media v1 ..."
ls -lh <output>
# Confirm the file exists and is non-zero
```

If the CLI fails:
- `Build artifacts not found` → tell the user to run `npm run build` in the project root.
- `Executable doesn't exist` (Playwright) → `npx playwright install chromium` inside `cli/`.
- `ffmpeg-static did not provide a binary path` → reinstall `cli/`'s deps.
- Timeout on click selectors → likely the web app's UI changed; check that `dist/` is fresh.

## Flag reference

```
-o, --output <path>         output.gif | output.mp4 (extension picks format)
-t, --type <type>           success | error | alternate    [default: alternate]
-s, --speed <multiplier>    0.5 | 1 | 2 | 3                [default: 1]
-d, --duration <seconds>    recording length               [default: 8]
    --fps <fps>             10–30 for GIF, up to 60 for MP4 [default: 15]
    --width <px>            viewport width                 [default: 1280]
    --height <px>           viewport height                [default: 720]
    --scale <factor>        1 = normal, 2 = retina         [default: 2]
    --auto-interval <ms>    spawn interval (500–5000)      [default: 2000]
    --error-loop-limit <n>  max revisits before error stops [default: 3]
    --no-badges             hide per-node arrival counters
    --keep-temp             keep temp files (for debugging)
    --quiet                 suppress progress logs
```

## Common one-shot recipes

**README demo (GIF, balanced quality/size):**

```bash
mermaid-flow flow.mmd -o demo.gif --duration 6 --fps 15 --width 1024 --height 768 --scale 2
```

**MP4 for a slide:**

```bash
mermaid-flow flow.mmd -o flow.mp4 --duration 10 --fps 24 --width 1280 --height 720
```

**Error path showcase (no badges, looks cleaner):**

```bash
mermaid-flow flow.mmd -o errors.gif --type error --no-badges --duration 6
```

**Stress visual — many particles, fast:**

```bash
mermaid-flow flow.mmd -o stress.gif --auto-interval 600 --speed 2 --duration 8
```

**From stdin (inline source):**

```bash
cat <<'EOF' | mermaid-flow - -o /tmp/out.gif --duration 5
flowchart TD
  A([Start]) --> B{Valid?}
  B -->|Yes| C([Done])
  B -->|No| A
EOF
```

## Examples folder

Sample inputs you can suggest to the user are in [examples/](examples/) within this skill:

- `login-flow.mmd` — auth flow with a retry loop and two terminals.

## Notes on UX

- The CLI takes ~25–60 seconds to render depending on duration/fps/resolution. Tell the user this is expected; don't assume it hung.
- The first run after `git clone` takes longer because Playwright downloads Chromium (~92 MB).
- If the user pastes a `.mmd` source inline, save it to a temp file first (or pipe via stdin). Don't try to hand-construct a single-line invocation with all the source escaped.
