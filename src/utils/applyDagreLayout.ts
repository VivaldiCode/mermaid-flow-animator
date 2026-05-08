import dagre from 'dagre';
import type {
  GraphEdge,
  GraphNode,
  ParsedGraph,
  RawGraph,
} from '../types/graph';
import { EDGE_COLORS, classifyEdge } from './colorScheme';
import { getNodeDimensions, pointsToPath } from './pathCalculator';

export function applyDagreLayout(rawGraph: RawGraph): ParsedGraph {
  const g = new dagre.graphlib.Graph({ multigraph: true });

  const isHorizontal = rawGraph.direction === 'LR' || rawGraph.direction === 'RL';

  g.setGraph({
    rankdir: rawGraph.direction,
    nodesep: isHorizontal ? 60 : 70,
    ranksep: isHorizontal ? 90 : 80,
    marginx: 40,
    marginy: 40,
  });

  g.setDefaultEdgeLabel(() => ({}));

  rawGraph.nodes.forEach((node) => {
    const { w, h } = getNodeDimensions(node.shape, node.label);
    g.setNode(node.id, { label: node.label, width: w, height: h });
  });

  rawGraph.edges.forEach((edge, idx) => {
    g.setEdge(
      edge.source,
      edge.target,
      { label: edge.label, width: 30, height: 14 },
      `e${idx}`,
    );
  });

  dagre.layout(g);

  const nodes: GraphNode[] = rawGraph.nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      x: pos.x,
      y: pos.y,
      width: pos.width,
      height: pos.height,
    };
  });

  const edges: GraphEdge[] = rawGraph.edges.map((edge, i) => {
    const edgeData = g.edge({ v: edge.source, w: edge.target, name: `e${i}` }) as
      | { points: Array<{ x: number; y: number }> }
      | undefined;
    const points = edgeData?.points ?? [];
    const pathD = pointsToPath(points);
    const type = classifyEdge(edge.label);
    return {
      id: `edge-${i}`,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      type,
      points,
      pathD,
      color: EDGE_COLORS[type],
    };
  });

  const graphMeta = g.graph() as { width?: number; height?: number };

  return {
    nodes,
    edges,
    layoutWidth: graphMeta.width ?? 800,
    layoutHeight: graphMeta.height ?? 600,
    direction: rawGraph.direction,
  };
}
