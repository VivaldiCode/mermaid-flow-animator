import type { NodeShape } from '../types/graph';

const CHAR_WIDTH = 8;
const PADDING_X = 28;
const PADDING_Y = 22;
const MIN_WIDTH = 80;
const MIN_HEIGHT = 44;

export function getNodeDimensions(shape: NodeShape, label: string): { w: number; h: number } {
  const longest = label.split('\n').reduce((m, line) => Math.max(m, line.length), 0);
  let w = Math.max(MIN_WIDTH, longest * CHAR_WIDTH + PADDING_X * 2);
  let h = MIN_HEIGHT;

  if (shape === 'diamond') {
    w = Math.max(w, longest * CHAR_WIDTH + PADDING_X * 2 + 20);
    h = MIN_HEIGHT + 20;
  } else if (shape === 'circle') {
    const size = Math.max(longest * CHAR_WIDTH + PADDING_X * 2, MIN_HEIGHT + 20);
    w = size;
    h = size;
  } else if (shape === 'stadium') {
    w = w + 16;
  }

  return { w, h };
}

export function pointsToPath(points: Array<{ x: number; y: number }>): string {
  if (!points || points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    const midPrevX = (prev.x + curr.x) / 2;
    const midPrevY = (prev.y + curr.y) / 2;
    const midNextX = (curr.x + next.x) / 2;
    const midNextY = (curr.y + next.y) / 2;

    if (i === 1) {
      d += ` L ${midPrevX} ${midPrevY}`;
    }
    d += ` Q ${curr.x} ${curr.y} ${midNextX} ${midNextY}`;
  }

  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;

  return d;
}
