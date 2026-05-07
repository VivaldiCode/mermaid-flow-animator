import { useCallback, useRef, useState } from 'react';
import GIF from 'gif.js';
import gifWorkerUrl from 'gif.js/dist/gif.worker.js?url';
import type { ParticleKind } from '../types/graph';

export type RecorderStage =
  | 'idle'
  | 'capturing'
  | 'encoding'
  | 'done'
  | 'error';

export interface RecorderState {
  stage: RecorderStage;
  capturedFrames: number;
  encodedProgress: number;
  particlesDone: number;
  totalParticles: number;
  message: string | null;
  downloadUrl: string | null;
}

export interface RecorderOptions {
  particleCount: number;
  fps: number;
  spawnKind: 'success' | 'error' | 'alternate';
  fileName?: string;
}

interface ControllerDeps {
  getSvg: () => SVGSVGElement | null;
  resetParticles: () => void;
  spawnFromStartNodes: (kind: ParticleKind) => void;
  getActiveParticleCount: () => number;
}

const MAX_GIF_WIDTH = 800;
const PARTICLE_TIMEOUT_MS = 30000;
const POST_FINISH_BUFFER_MS = 500;

function inlineFonts(svg: SVGSVGElement): void {
  const ns = 'http://www.w3.org/2000/svg';
  const styleEl = document.createElementNS(ns, 'style');
  styleEl.textContent = `
    text { font-family: 'JetBrains Mono', 'Menlo', 'Consolas', monospace; }
    .node-badge text { font-family: 'DM Sans', 'Helvetica Neue', sans-serif; }
  `;
  svg.insertBefore(styleEl, svg.firstChild);
}

async function svgToCanvas(
  svg: SVGSVGElement,
  width: number,
  height: number,
): Promise<HTMLCanvasElement> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  inlineFonts(clone);

  const serialized = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  try {
    const img = new Image();
    img.decoding = 'sync';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load SVG snapshot'));
      img.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');

    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useGifRecorder(deps: ControllerDeps) {
  const [state, setState] = useState<RecorderState>({
    stage: 'idle',
    capturedFrames: 0,
    encodedProgress: 0,
    particlesDone: 0,
    totalParticles: 0,
    message: null,
    downloadUrl: null,
  });

  const cancelRef = useRef(false);
  const activeRef = useRef(false);

  const reset = useCallback(() => {
    cancelRef.current = false;
    setState({
      stage: 'idle',
      capturedFrames: 0,
      encodedProgress: 0,
      particlesDone: 0,
      totalParticles: 0,
      message: null,
      downloadUrl: null,
    });
  }, []);

  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const start = useCallback(
    async (options: RecorderOptions) => {
      if (activeRef.current) return;
      activeRef.current = true;
      cancelRef.current = false;

      const svg = deps.getSvg();
      if (!svg) {
        setState((s) => ({ ...s, stage: 'error', message: 'SVG not ready.' }));
        activeRef.current = false;
        return;
      }

      const rect = svg.getBoundingClientRect();
      let width = Math.round(rect.width);
      let height = Math.round(rect.height);
      if (width <= 0 || height <= 0) {
        width = 720;
        height = 540;
      }
      if (width > MAX_GIF_WIDTH) {
        const scale = MAX_GIF_WIDTH / width;
        width = MAX_GIF_WIDTH;
        height = Math.round(height * scale);
      }

      setState({
        stage: 'capturing',
        capturedFrames: 0,
        encodedProgress: 0,
        particlesDone: 0,
        totalParticles: options.particleCount,
        message: null,
        downloadUrl: null,
      });

      const gif = new GIF({
        workers: 2,
        quality: 10,
        workerScript: gifWorkerUrl,
        width,
        height,
        background: '#0a0e1a',
      });

      const frameInterval = 1000 / Math.max(1, Math.min(30, options.fps));
      let captureRunning = true;
      let captureCount = 0;

      const captureLoop = (async () => {
        while (captureRunning && !cancelRef.current) {
          const t0 = performance.now();
          try {
            const canvas = await svgToCanvas(svg, width, height);
            gif.addFrame(canvas, { delay: Math.round(frameInterval), copy: true });
            captureCount += 1;
            setState((s) => ({ ...s, capturedFrames: captureCount }));
          } catch (err) {
            console.error('Frame capture error:', err);
          }
          const elapsed = performance.now() - t0;
          const wait = Math.max(0, frameInterval - elapsed);
          if (wait > 0) await sleep(wait);
        }
      })();

      try {
        deps.resetParticles();
        await sleep(300);

        for (let i = 0; i < options.particleCount; i++) {
          if (cancelRef.current) break;

          const kind: ParticleKind =
            options.spawnKind === 'alternate'
              ? i % 2 === 0
                ? 'success'
                : 'error'
              : options.spawnKind;

          deps.spawnFromStartNodes(kind);
          await sleep(150);

          const startTime = performance.now();
          while (
            !cancelRef.current &&
            deps.getActiveParticleCount() > 0 &&
            performance.now() - startTime < PARTICLE_TIMEOUT_MS
          ) {
            await sleep(120);
          }

          setState((s) => ({ ...s, particlesDone: i + 1 }));
          await sleep(400);
        }

        await sleep(POST_FINISH_BUFFER_MS);
      } catch (err) {
        console.error('Recording error:', err);
      }

      captureRunning = false;
      await captureLoop;

      if (cancelRef.current) {
        gif.abort();
        setState((s) => ({ ...s, stage: 'idle', message: 'Cancelled.' }));
        activeRef.current = false;
        return;
      }

      setState((s) => ({ ...s, stage: 'encoding', encodedProgress: 0 }));

      gif.on('progress', (p: number) => {
        if (cancelRef.current) return;
        setState((s) => ({ ...s, encodedProgress: p }));
      });

      gif.on('finished', (blob: Blob) => {
        const url = URL.createObjectURL(blob);
        setState((s) => ({
          ...s,
          stage: 'done',
          encodedProgress: 1,
          downloadUrl: url,
          message: `${(blob.size / 1024).toFixed(0)} KB`,
        }));
        activeRef.current = false;
      });

      gif.on('abort', () => {
        setState((s) => ({ ...s, stage: 'idle', message: 'Cancelled.' }));
        activeRef.current = false;
      });

      gif.render();
    },
    [deps],
  );

  return {
    state,
    start,
    cancel,
    reset,
  };
}
