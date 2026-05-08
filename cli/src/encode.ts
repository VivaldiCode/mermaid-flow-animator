import { spawn } from 'node:child_process';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';

interface EncodeInput {
  framePattern: string;
  output: string;
  fps: number;
  width: number;
  height: number;
  quiet?: boolean;
}

const FFMPEG = (ffmpegPath as unknown as string) ?? '';

export async function encodeWithFfmpeg(input: EncodeInput): Promise<void> {
  if (!FFMPEG) {
    throw new Error(
      'ffmpeg-static did not provide a binary path. Try reinstalling deps.',
    );
  }

  const isGif = input.output.toLowerCase().endsWith('.gif');
  if (isGif) {
    await encodeGif(input);
  } else {
    await encodeMp4(input);
  }
}

async function encodeMp4(input: EncodeInput): Promise<void> {
  // Even dimensions are required by libx264. Round up if odd.
  const width = input.width % 2 === 0 ? input.width : input.width + 1;
  const height = input.height % 2 === 0 ? input.height : input.height + 1;

  const args = [
    '-y',
    '-framerate',
    String(input.fps),
    '-i',
    input.framePattern,
    '-vf',
    `scale=${width}:${height}:flags=lanczos`,
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '20',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    input.output,
  ];

  await runFfmpeg(args, input.quiet);
}

async function encodeGif(input: EncodeInput): Promise<void> {
  // Two-pass: 1) generate an optimized palette, 2) apply it for better quality.
  const paletteFile = path.join(
    path.dirname(input.framePattern),
    'palette.png',
  );

  // Pass 1: palette generation
  await runFfmpeg(
    [
      '-y',
      '-framerate',
      String(input.fps),
      '-i',
      input.framePattern,
      '-vf',
      `fps=${input.fps},palettegen=stats_mode=full`,
      paletteFile,
    ],
    input.quiet,
  );

  // Pass 2: encode with palette
  await runFfmpeg(
    [
      '-y',
      '-framerate',
      String(input.fps),
      '-i',
      input.framePattern,
      '-i',
      paletteFile,
      '-lavfi',
      `fps=${input.fps} [x]; [x][1:v] paletteuse=dither=sierra2_4a`,
      input.output,
    ],
    input.quiet,
  );
}

function runFfmpeg(args: string[], quiet?: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const stdio: ('inherit' | 'ignore' | 'pipe')[] = quiet
      ? ['ignore', 'ignore', 'pipe']
      : ['ignore', 'ignore', 'pipe'];
    const proc = spawn(FFMPEG, args, { stdio });
    let stderr = '';
    proc.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        const tail = stderr.split('\n').slice(-15).join('\n');
        reject(new Error(`ffmpeg exited with code ${code}\n${tail}`));
      }
    });
  });
}
