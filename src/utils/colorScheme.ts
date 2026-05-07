import type { EdgeType, GraphEdge, ParsedGraph, ParticleKind } from '../types/graph';

export const EDGE_COLORS: Record<EdgeType, string> = {
  yes: '#22c55e',
  no: '#ef4444',
  default: '#60a5fa',
  labeled: '#f59e0b',
};

export const PARTICLE_COLORS: Record<ParticleKind, string> = {
  success: '#4ade80',
  error: '#f87171',
};

export const NODE_COLORS = {
  fill: '#1e293b',
  stroke: '#475569',
  text: '#f1f5f9',
  activeFill: '#334155',
  activeStroke: '#60a5fa',
};

export const PARTICLE_TRAIL_LENGTH = 6;
export const MAX_PARTICLES = 100;
export const MAX_LOOP_ITERATIONS = 4;

export function classifyEdge(label: string): EdgeType {
  const normalized = label.toLowerCase().trim();
  if (['yes', 'sim', 'true', '1', 'y'].includes(normalized)) return 'yes';
  if (['no', 'não', 'false', '0', 'n', 'nao'].includes(normalized)) return 'no';
  if (normalized === '') return 'default';
  return 'labeled';
}

const SUCCESS_PRIORITY: EdgeType[] = ['yes', 'default', 'labeled', 'no'];
const ERROR_PRIORITY: EdgeType[] = ['no', 'labeled', 'default', 'yes'];

export function pickEdgeForKind(edges: GraphEdge[], kind: ParticleKind): GraphEdge | null {
  if (edges.length === 0) return null;
  if (edges.length === 1) return edges[0];

  const order = kind === 'success' ? SUCCESS_PRIORITY : ERROR_PRIORITY;
  for (const t of order) {
    const found = edges.find((e) => e.type === t);
    if (found) return found;
  }
  return edges[0];
}

export function hasErrorBranchDownstream(graph: ParsedGraph, fromNodeId: string): boolean {
  const visited = new Set<string>();
  let current: string | null = fromNodeId;

  while (current && !visited.has(current)) {
    visited.add(current);
    const outgoing = graph.edges.filter((e) => e.source === current);
    if (outgoing.length === 0) break;

    const successEdge = pickEdgeForKind(outgoing, 'success');
    const errorEdge = pickEdgeForKind(outgoing, 'error');

    if (!successEdge || !errorEdge) break;
    if (successEdge.id !== errorEdge.id) return true;

    current = successEdge.target;
  }

  return false;
}

export function predictForwardNodes(
  graph: ParsedGraph,
  fromNodeId: string,
  kind: ParticleKind,
  count: number,
): string[] {
  if (count <= 0) return [];
  const result: string[] = [fromNodeId];
  const visited = new Set<string>([fromNodeId]);
  let current = fromNodeId;

  while (result.length < count) {
    const outgoing = graph.edges.filter((e) => e.source === current);
    if (outgoing.length === 0) break;
    const chosen = pickEdgeForKind(outgoing, kind);
    if (!chosen || visited.has(chosen.target)) break;
    current = chosen.target;
    visited.add(current);
    result.push(current);
  }
  return result;
}
