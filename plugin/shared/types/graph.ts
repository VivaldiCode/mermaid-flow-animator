export type NodeShape = 'rectangle' | 'diamond' | 'circle' | 'stadium' | 'subroutine';

export type EdgeType = 'default' | 'yes' | 'no' | 'labeled';

export type GraphDirection = 'TD' | 'TB' | 'BT' | 'LR' | 'RL';

export interface RawNode {
  id: string;
  label: string;
  shape: NodeShape;
}

export interface RawEdge {
  source: string;
  target: string;
  label: string;
}

export interface RawGraph {
  nodes: RawNode[];
  edges: RawEdge[];
  direction: GraphDirection;
}

export interface GraphNode {
  id: string;
  label: string;
  shape: NodeShape;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  type: EdgeType;
  points: Array<{ x: number; y: number }>;
  pathD: string;
  color: string;
}

export interface ParsedGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  layoutWidth: number;
  layoutHeight: number;
  direction: GraphDirection;
}

export interface ParticleTrailPoint {
  x: number;
  y: number;
  opacity: number;
}

export type ParticleKind = 'success' | 'error';

export type SpawnKind = 'success' | 'error' | 'alternate';

export interface Particle {
  id: string;
  edgeId: string;
  progress: number;
  color: string;
  size: number;
  speed: number;
  kind: ParticleKind;
  flowId: number;
  visitedNodes: string[];
  decisionsPassed: number;
  trailPoints: ParticleTrailPoint[];
  currentX: number;
  currentY: number;
  completed: boolean;
  sourceNodeId: string;
  targetNodeId: string;
}

export type ViewMode = 'overview' | 'follow';

export type FollowWindow = 3 | 5 | 7 | 9;

export interface AnimationState {
  isPlaying: boolean;
  speed: number;
  mode: 'manual' | 'auto';
  autoIntervalMs: number;
  spawnKind: SpawnKind;
  viewMode: ViewMode;
  followWindow: FollowWindow;
  errorLoopLimit: number;
  showBadges: boolean;
}
