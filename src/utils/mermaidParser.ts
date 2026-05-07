import type { RawGraph, RawNode, RawEdge, NodeShape, GraphDirection } from '../types/graph';

const DIRECTION_RE = /^(?:flowchart|graph)\s+(TD|TB|BT|LR|RL)/i;

const NODE_PATTERNS: Array<{ re: RegExp; shape: NodeShape }> = [
  { re: /^([A-Za-z0-9_]+)\(\(([^)]+)\)\)$/, shape: 'circle' },
  { re: /^([A-Za-z0-9_]+)\(\[([^\]]+)\]\)$/, shape: 'stadium' },
  { re: /^([A-Za-z0-9_]+)\[\[([^\]]+)\]\]$/, shape: 'subroutine' },
  { re: /^([A-Za-z0-9_]+)\{([^}]+)\}$/, shape: 'diamond' },
  { re: /^([A-Za-z0-9_]+)\(([^)]+)\)$/, shape: 'stadium' },
  { re: /^([A-Za-z0-9_]+)\[([^\]]+)\]$/, shape: 'rectangle' },
];

const ID_ONLY_RE = /^([A-Za-z0-9_]+)$/;

const ARROW_RE = /\s*--+>\s*(?:\|([^|]+)\|\s*)?/;
const TEXT_ARROW_RE = /\s*--\s*([^-]+?)\s*--+>\s*/;

interface NodeRef {
  id: string;
  label?: string;
  shape?: NodeShape;
}

function parseNodeToken(token: string): NodeRef | null {
  const trimmed = token.trim();
  if (!trimmed) return null;

  for (const { re, shape } of NODE_PATTERNS) {
    const match = trimmed.match(re);
    if (match) {
      return { id: match[1], label: match[2].replace(/^["']|["']$/g, ''), shape };
    }
  }

  const idMatch = trimmed.match(ID_ONLY_RE);
  if (idMatch) return { id: idMatch[1] };

  return null;
}

function registerNode(nodes: Map<string, RawNode>, ref: NodeRef): void {
  const existing = nodes.get(ref.id);
  if (existing) {
    if (ref.label && (!existing.label || existing.label === existing.id)) {
      existing.label = ref.label;
    }
    if (ref.shape && existing.shape === 'rectangle' && !existing.label) {
      existing.shape = ref.shape;
    } else if (ref.shape && existing.shape === 'rectangle' && existing.label === existing.id) {
      existing.shape = ref.shape;
    }
    return;
  }
  nodes.set(ref.id, {
    id: ref.id,
    label: ref.label || ref.id,
    shape: ref.shape || 'rectangle',
  });
}

function splitEdgeLine(line: string): { left: string; label: string; right: string } | null {
  const textArrowMatch = line.match(TEXT_ARROW_RE);
  if (textArrowMatch) {
    const idx = line.indexOf(textArrowMatch[0]);
    const left = line.slice(0, idx);
    const right = line.slice(idx + textArrowMatch[0].length);
    return { left, label: textArrowMatch[1].trim(), right };
  }

  const arrowMatch = line.match(ARROW_RE);
  if (arrowMatch) {
    const idx = line.indexOf(arrowMatch[0]);
    const left = line.slice(0, idx);
    const right = line.slice(idx + arrowMatch[0].length);
    return { left, label: (arrowMatch[1] || '').trim(), right };
  }

  return null;
}

function stripComments(source: string): string {
  return source
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('%%');
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join('\n');
}

export function parseMermaidToGraph(source: string): RawGraph {
  const cleaned = stripComments(source);
  const lines = cleaned
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  let direction: GraphDirection = 'TD';
  const nodes = new Map<string, RawNode>();
  const edges: RawEdge[] = [];

  for (const line of lines) {
    const dirMatch = line.match(DIRECTION_RE);
    if (dirMatch) {
      direction = dirMatch[1].toUpperCase() as GraphDirection;
      continue;
    }

    if (/^(flowchart|graph)\b/i.test(line)) continue;
    if (/^(subgraph|end|click|style|classDef|class|linkStyle)\b/i.test(line)) continue;

    const split = splitEdgeLine(line);
    if (split) {
      const leftRef = parseNodeToken(split.left);
      const rightChain = split.right;

      if (!leftRef) continue;
      registerNode(nodes, leftRef);

      let currentSource = leftRef.id;
      let remaining = rightChain;
      let currentLabel = split.label;

      while (true) {
        const nextSplit = splitEdgeLine(remaining);
        if (nextSplit) {
          const midRef = parseNodeToken(nextSplit.left);
          if (!midRef) break;
          registerNode(nodes, midRef);
          edges.push({ source: currentSource, target: midRef.id, label: currentLabel });
          currentSource = midRef.id;
          currentLabel = nextSplit.label;
          remaining = nextSplit.right;
        } else {
          const targetRef = parseNodeToken(remaining);
          if (!targetRef) break;
          registerNode(nodes, targetRef);
          edges.push({ source: currentSource, target: targetRef.id, label: currentLabel });
          break;
        }
      }
      continue;
    }

    const standaloneRef = parseNodeToken(line);
    if (standaloneRef) {
      registerNode(nodes, standaloneRef);
    }
  }

  return {
    nodes: [...nodes.values()],
    edges,
    direction,
  };
}
