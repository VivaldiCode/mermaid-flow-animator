import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { FollowWindow, ParsedGraph, Particle, ViewMode } from '../../types/graph';
import type { NodeArrivalCounts } from '../../hooks/useParticleAnimation';
import { EDGE_COLORS, PARTICLE_COLORS, predictForwardNodes } from '../../utils/colorScheme';
import { EdgeRenderer } from './EdgeRenderer';
import { NodeRenderer } from './NodeRenderer';
import { ParticleRenderer } from './ParticleRenderer';
import './FlowCanvas.css';

interface FlowCanvasProps {
  graph: ParsedGraph;
  particles: Particle[];
  onNodeClick: (nodeId: string) => void;
  registerPathElement: (edgeId: string, el: SVGPathElement | null) => void;
  particleCount: number;
  successCompleted: number;
  errorCompleted: number;
  nodeArrivals: Record<string, NodeArrivalCounts>;
  viewMode: ViewMode;
  followWindow: FollowWindow;
}

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const VIEWBOX_PADDING = 60;
const FOLLOW_VIEWPORT_FRACTION = 0.78;
const FOLLOW_LERP_K = 4.5;
const FOLLOW_BBOX_PADDING = 80;
const MIN_VB_SHORT_DIM = 80;

function computeOverviewViewBox(
  graph: ParsedGraph,
  wrapperW: number,
  wrapperH: number,
): ViewBox {
  const bboxX = -VIEWBOX_PADDING;
  const bboxY = -VIEWBOX_PADDING;
  const bboxW = graph.layoutWidth + VIEWBOX_PADDING * 2;
  const bboxH = graph.layoutHeight + VIEWBOX_PADDING * 2;

  const viewportAR = wrapperW <= 0 || wrapperH <= 0 ? bboxW / bboxH : wrapperW / wrapperH;
  const bboxAR = bboxW / bboxH;

  let vbW: number;
  let vbH: number;
  if (bboxAR > viewportAR) {
    vbW = bboxW;
    vbH = bboxW / viewportAR;
  } else {
    vbH = bboxH;
    vbW = bboxH * viewportAR;
  }

  const cx = bboxX + bboxW / 2;
  const cy = bboxY + bboxH / 2;
  return {
    x: cx - vbW / 2,
    y: cy - vbH / 2,
    w: vbW,
    h: vbH,
  };
}

function computeFollowViewBox(
  particle: Particle,
  graph: ParsedGraph,
  windowSize: FollowWindow,
  wrapperW: number,
  wrapperH: number,
): ViewBox | null {
  if (wrapperW <= 0 || wrapperH <= 0) return null;

  const beforeCount = Math.ceil(windowSize / 2);
  const afterCount = Math.floor(windowSize / 2);
  const beforeIds = particle.visitedNodes.slice(-beforeCount);
  const afterIds = predictForwardNodes(graph, particle.targetNodeId, particle.kind, afterCount);
  const idSet = new Set<string>([...beforeIds, ...afterIds]);
  const nodes = graph.nodes.filter((n) => idSet.has(n.id));
  if (nodes.length === 0) return null;

  let minX = particle.currentX;
  let minY = particle.currentY;
  let maxX = particle.currentX;
  let maxY = particle.currentY;

  for (const n of nodes) {
    minX = Math.min(minX, n.x - n.width / 2);
    minY = Math.min(minY, n.y - n.height / 2);
    maxX = Math.max(maxX, n.x + n.width / 2);
    maxY = Math.max(maxY, n.y + n.height / 2);
  }

  const bboxW = maxX - minX + FOLLOW_BBOX_PADDING * 2;
  const bboxH = maxY - minY + FOLLOW_BBOX_PADDING * 2;

  const viewportAR = wrapperW / wrapperH;
  const bboxAR = bboxW / bboxH;
  const fit = 1 / FOLLOW_VIEWPORT_FRACTION;

  let vbW: number;
  let vbH: number;
  if (bboxAR > viewportAR) {
    vbW = bboxW * fit;
    vbH = vbW / viewportAR;
  } else {
    vbH = bboxH * fit;
    vbW = vbH * viewportAR;
  }

  const minShort = Math.min(vbW, vbH);
  if (minShort < MIN_VB_SHORT_DIM) {
    const scaleUp = MIN_VB_SHORT_DIM / minShort;
    vbW *= scaleUp;
    vbH *= scaleUp;
  }

  return {
    x: particle.currentX - vbW / 2,
    y: particle.currentY - vbH / 2,
    w: vbW,
    h: vbH,
  };
}

export const FlowCanvas: React.FC<FlowCanvasProps> = ({
  graph,
  particles,
  onNodeClick,
  registerPathElement,
  particleCount,
  successCompleted,
  errorCompleted,
  nodeArrivals,
  viewMode,
  followWindow,
}) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [wrapperSize, setWrapperSize] = useState({ w: 0, h: 0 });
  const [viewBox, setViewBox] = useState<ViewBox | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    vbX: number;
    vbY: number;
  } | null>(null);
  const prevWrapperSizeRef = useRef(wrapperSize);

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const update = () => {
      const rect = wrapper.getBoundingClientRect();
      setWrapperSize({ w: rect.width, h: rect.height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (wrapperSize.w <= 0 || wrapperSize.h <= 0) return;
    setViewBox(computeOverviewViewBox(graph, wrapperSize.w, wrapperSize.h));
    prevWrapperSizeRef.current = wrapperSize;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph.layoutWidth, graph.layoutHeight]);

  useEffect(() => {
    if (viewMode === 'follow') {
      prevWrapperSizeRef.current = wrapperSize;
      return;
    }
    const prev = prevWrapperSizeRef.current;
    if (
      prev.w === wrapperSize.w &&
      prev.h === wrapperSize.h
    ) {
      return;
    }
    if (prev.w <= 0 || prev.h <= 0 || wrapperSize.w <= 0 || wrapperSize.h <= 0) {
      prevWrapperSizeRef.current = wrapperSize;
      return;
    }

    setViewBox((vb) => {
      if (!vb) return vb;
      const newVbW = vb.w * (wrapperSize.w / prev.w);
      const newVbH = vb.h * (wrapperSize.h / prev.h);
      const cx = vb.x + vb.w / 2;
      const cy = vb.y + vb.h / 2;
      return {
        x: cx - newVbW / 2,
        y: cy - newVbH / 2,
        w: newVbW,
        h: newVbH,
      };
    });
    prevWrapperSizeRef.current = wrapperSize;
  }, [wrapperSize, viewMode]);

  const activeEdgeIds = useMemo(() => {
    const set = new Set<string>();
    particles.forEach((p) => {
      if (!p.completed) set.add(p.edgeId);
    });
    return set;
  }, [particles]);

  const activeNodeIds = useMemo(() => {
    const set = new Set<string>();
    particles.forEach((p) => {
      if (!p.completed) {
        set.add(p.sourceNodeId);
        set.add(p.targetNodeId);
      }
    });
    return set;
  }, [particles]);

  const followedParticleId = useMemo(() => {
    const active = particles.filter((p) => !p.completed);
    if (active.length === 0) return null;
    let best = active[0];
    for (const p of active) {
      if (p.flowId < best.flowId) best = p;
    }
    return best.id;
  }, [particles]);

  const followedParticleRef = useRef<Particle | null>(null);
  useEffect(() => {
    followedParticleRef.current = particles.find((p) => p.id === followedParticleId) ?? null;
  }, [particles, followedParticleId]);

  const graphRef = useRef(graph);
  useEffect(() => {
    graphRef.current = graph;
  }, [graph]);

  const followWindowRef = useRef(followWindow);
  useEffect(() => {
    followWindowRef.current = followWindow;
  }, [followWindow]);

  const wrapperSizeRef = useRef(wrapperSize);
  useEffect(() => {
    wrapperSizeRef.current = wrapperSize;
  }, [wrapperSize]);

  useEffect(() => {
    if (viewMode !== 'follow') return;

    let cancelled = false;
    let rafId = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      if (cancelled) return;
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const particle = followedParticleRef.current;
      const size = wrapperSizeRef.current;
      if (!particle || size.w <= 0 || size.h <= 0) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      const target = computeFollowViewBox(
        particle,
        graphRef.current,
        followWindowRef.current,
        size.w,
        size.h,
      );

      if (target) {
        const f = 1 - Math.exp(-FOLLOW_LERP_K * dt);
        setViewBox((vb) => {
          if (!vb) return target;
          return {
            x: vb.x + (target.x - vb.x) * f,
            y: vb.y + (target.y - vb.y) * f,
            w: vb.w + (target.w - vb.w) * f,
            h: vb.h + (target.h - vb.h) * f,
          };
        });
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [viewMode]);

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (viewMode === 'follow') return;
      e.preventDefault();
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const rect = wrapper.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = Math.exp(e.deltaY * 0.0015);

      setViewBox((vb) => {
        if (!vb) return vb;
        const newW = vb.w * factor;
        const newH = vb.h * factor;
        const svgX = vb.x + (mx / rect.width) * vb.w;
        const svgY = vb.y + (my / rect.height) * vb.h;
        return {
          x: svgX - (mx / rect.width) * newW,
          y: svgY - (my / rect.height) * newH,
          w: newW,
          h: newH,
        };
      });
    },
    [viewMode],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (viewMode === 'follow') return;
      if (e.button !== 0) return;
      const target = e.target as Element;
      if (target.closest('.node')) return;
      if (!viewBox) return;
      setIsPanning(true);
      panStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        vbX: viewBox.x,
        vbY: viewBox.y,
      };
    },
    [viewBox, viewMode],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (viewMode === 'follow') return;
      const start = panStartRef.current;
      if (!start) return;
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const rect = wrapper.getBoundingClientRect();
      const dxPx = e.clientX - start.mouseX;
      const dyPx = e.clientY - start.mouseY;
      setViewBox((vb) => {
        if (!vb) return vb;
        const dxSvg = dxPx * (vb.w / rect.width);
        const dySvg = dyPx * (vb.h / rect.height);
        return {
          ...vb,
          x: start.vbX - dxSvg,
          y: start.vbY - dySvg,
        };
      });
    },
    [viewMode],
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    panStartRef.current = null;
  }, []);

  const fitToScreen = useCallback(() => {
    if (wrapperSize.w <= 0 || wrapperSize.h <= 0) return;
    setViewBox(computeOverviewViewBox(graph, wrapperSize.w, wrapperSize.h));
  }, [graph, wrapperSize.w, wrapperSize.h]);

  const zoomIn = useCallback(() => {
    setViewBox((vb) => {
      if (!vb) return vb;
      const factor = 1 / 1.2;
      const cx = vb.x + vb.w / 2;
      const cy = vb.y + vb.h / 2;
      const newW = vb.w * factor;
      const newH = vb.h * factor;
      return { x: cx - newW / 2, y: cy - newH / 2, w: newW, h: newH };
    });
  }, []);

  const zoomOut = useCallback(() => {
    setViewBox((vb) => {
      if (!vb) return vb;
      const factor = 1.2;
      const cx = vb.x + vb.w / 2;
      const cy = vb.y + vb.h / 2;
      const newW = vb.w * factor;
      const newH = vb.h * factor;
      return { x: cx - newW / 2, y: cy - newH / 2, w: newW, h: newH };
    });
  }, []);

  const exportSvg = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clone);
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mermaid-flow.svg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const isFollowing = viewMode === 'follow';
  const cursor = isFollowing ? 'default' : isPanning ? 'grabbing' : 'grab';

  const fallbackVb = `${-VIEWBOX_PADDING} ${-VIEWBOX_PADDING} ${
    graph.layoutWidth + VIEWBOX_PADDING * 2
  } ${graph.layoutHeight + VIEWBOX_PADDING * 2}`;
  const viewBoxString = viewBox
    ? `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`
    : fallbackVb;

  return (
    <div
      ref={wrapperRef}
      className={`flow-canvas-wrapper ${isFollowing ? 'flow-canvas-wrapper--follow' : ''}`}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ cursor }}
    >
      <svg
        ref={svgRef}
        viewBox={viewBoxString}
        preserveAspectRatio="xMidYMid meet"
        className="flow-canvas"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {Object.entries(EDGE_COLORS).map(([type, color]) => (
            <marker
              key={type}
              id={`arrow-${type}`}
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill={color} />
            </marker>
          ))}
          <filter id="particle-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="followed-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g className="edges-layer">
          {graph.edges.map((edge) => (
            <EdgeRenderer
              key={edge.id}
              edge={edge}
              registerRef={(el) => registerPathElement(edge.id, el)}
              isActive={activeEdgeIds.has(edge.id)}
            />
          ))}
        </g>

        <g className="nodes-layer">
          {graph.nodes.map((node) => (
            <NodeRenderer
              key={node.id}
              node={node}
              onClick={() => onNodeClick(node.id)}
              isActive={activeNodeIds.has(node.id)}
              arrivals={nodeArrivals[node.id]}
            />
          ))}
        </g>

        <g className="particles-layer">
          {particles.map((particle) => (
            <ParticleRenderer
              key={particle.id}
              particle={particle}
              isFollowed={isFollowing && particle.id === followedParticleId}
            />
          ))}
        </g>
      </svg>

      <div className="canvas-overlay canvas-overlay--top-left">
        <div className="stat-pill">
          <span className="stat-pill__label">ACTIVE</span>
          <span className="stat-pill__value">{particleCount}</span>
        </div>
        <div className="stat-pill">
          <span className="stat-pill__label" style={{ color: PARTICLE_COLORS.success }}>
            SUCCESS
          </span>
          <span className="stat-pill__value" style={{ color: PARTICLE_COLORS.success }}>
            {successCompleted}
          </span>
        </div>
        <div className="stat-pill">
          <span className="stat-pill__label" style={{ color: PARTICLE_COLORS.error }}>
            ERROR
          </span>
          <span className="stat-pill__value" style={{ color: PARTICLE_COLORS.error }}>
            {errorCompleted}
          </span>
        </div>
        {isFollowing && (
          <div className="stat-pill stat-pill--follow">
            <span className="stat-pill__label">FOLLOW</span>
            <span className="stat-pill__value">w={followWindow}</span>
          </div>
        )}
      </div>

      <div className="canvas-overlay canvas-overlay--bottom-right">
        <button className="btn-icon" onClick={zoomIn} title="Zoom in" disabled={isFollowing}>
          +
        </button>
        <button className="btn-icon" onClick={zoomOut} title="Zoom out" disabled={isFollowing}>
          −
        </button>
        <button
          className="btn-icon"
          onClick={fitToScreen}
          title="Fit to screen"
          disabled={isFollowing}
        >
          ⊡
        </button>
        <button className="btn-icon" onClick={exportSvg} title="Export SVG">
          ↓
        </button>
      </div>

      <div className="canvas-overlay canvas-overlay--bottom-left">
        <span className="hint-text">
          {isFollowing
            ? `following oldest active particle · showing ${followWindow} boxes`
            : 'drag to pan · scroll to zoom · click a node to start a flow'}
        </span>
      </div>
    </div>
  );
};
