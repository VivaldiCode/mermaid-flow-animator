#!/usr/bin/env node
import { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from './render.js';
import type { CliOptions } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(await readFile(pkgPath, 'utf-8')) as { version: string };

const program = new Command();

program
  .name('mermaid-flow')
  .description('Render Mermaid flowcharts as animated GIF or MP4.')
  .version(pkg.version)
  .argument('<input>', 'Path to .mmd file (or "-" to read from stdin)')
  .option('-o, --output <path>', 'Output file. Extension determines format: .gif or .mp4', 'output.gif')
  .option('-t, --type <type>', 'Particle type: success | error | alternate', 'alternate')
  .option('-s, --speed <multiplier>', 'Speed multiplier 0.5/1/2/3', '1')
  .option('-d, --duration <seconds>', 'Recording duration in seconds', '8')
  .option('--fps <fps>', 'Frames per second (10–30 for GIF, up to 60 for MP4)', '15')
  .option('--width <px>', 'Output width in pixels', '1280')
  .option('--height <px>', 'Output height in pixels', '720')
  .option('--scale <factor>', 'Device scale factor (1 = 1x, 2 = retina)', '2')
  .option('--auto-interval <ms>', 'Spawn interval in auto mode (500–5000)', '2000')
  .option('--error-loop-limit <n>', 'Max revisits before an error particle stops (1–10)', '3')
  .option('--no-badges', 'Hide the per-node arrival badges (cleaner output)')
  .option('--keep-temp', 'Keep temporary files (useful for debugging)')
  .option('--quiet', 'Suppress progress logs')
  .action(async (input: string, opts: CliOptions) => {
    try {
      let source: string;
      if (input === '-') {
        source = await readStdin();
      } else {
        source = await readFile(path.resolve(input), 'utf-8');
      }
      if (!source.trim()) {
        throw new Error('Input is empty.');
      }

      await run({
        source,
        output: path.resolve(opts.output),
        type: opts.type,
        speed: opts.speed,
        duration: parseFloat(opts.duration),
        fps: parseInt(opts.fps, 10),
        width: parseInt(opts.width, 10),
        height: parseInt(opts.height, 10),
        scale: parseFloat(opts.scale),
        autoInterval: parseInt(opts.autoInterval, 10),
        errorLoopLimit: parseInt(opts.errorLoopLimit, 10),
        badges: opts.badges !== false,
        keepTemp: !!opts.keepTemp,
        quiet: !!opts.quiet,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`✕ ${message}\n`);
      process.exit(1);
    }
  });

program.parseAsync();

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}
