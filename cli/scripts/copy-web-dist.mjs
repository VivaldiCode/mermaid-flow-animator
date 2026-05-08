#!/usr/bin/env node
/**
 * copy-web-dist.mjs
 *
 * Copies the built web app from <repo>/dist into <cli>/web-dist so the
 * published npm package is fully self-contained — users don't need the rest
 * of the monorepo for `mermaid-flow` to work.
 *
 * Runs as part of `prepublishOnly`. Requires the web app to have been built
 * first (`npm run build` at the repo root). Aborts with a friendly error if
 * the source dist is missing.
 */
import { access, cp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.resolve(__dirname, '..');
const monorepoRoot = path.resolve(cliRoot, '..');
const sourceDist = path.join(monorepoRoot, 'dist');
const targetDist = path.join(cliRoot, 'web-dist');

try {
  await access(path.join(sourceDist, 'index.html'));
} catch {
  console.error(`✕ Web app dist not found at ${sourceDist}.`);
  console.error('  Run "npm run build" at the repo root first.');
  process.exit(1);
}

await rm(targetDist, { recursive: true, force: true });
await cp(sourceDist, targetDist, { recursive: true });
console.log(`✓ Bundled web app: ${sourceDist} → ${targetDist}`);
