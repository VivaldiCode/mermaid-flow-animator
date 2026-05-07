import type { GraphEdge, Particle, ParticleKind } from '../types/graph';
import { PARTICLE_COLORS } from './colorScheme';

export const BASE_EDGES_PER_SECOND = 1;

let particleIdCounter = 0;
let flowIdCounter = 0;

export function createFlowId(): number {
  flowIdCounter += 1;
  return flowIdCounter;
}

interface CreateParticleOptions {
  edge: GraphEdge;
  speedMultiplier: number;
  kind: ParticleKind;
  flowId: number;
  visitedNodes: string[];
  decisionsPassed?: number;
}

export function createParticle(options: CreateParticleOptions): Particle {
  particleIdCounter += 1;
  const { edge, speedMultiplier, kind, flowId, visitedNodes, decisionsPassed = 0 } = options;
  return {
    id: `p-${Date.now()}-${particleIdCounter}`,
    edgeId: edge.id,
    progress: 0,
    color: PARTICLE_COLORS[kind],
    size: 7,
    speed: BASE_EDGES_PER_SECOND * speedMultiplier,
    kind,
    flowId,
    visitedNodes,
    decisionsPassed,
    trailPoints: [],
    currentX: edge.points[0]?.x ?? 0,
    currentY: edge.points[0]?.y ?? 0,
    completed: false,
    sourceNodeId: edge.source,
    targetNodeId: edge.target,
  };
}
