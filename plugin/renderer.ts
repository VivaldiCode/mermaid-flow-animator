import { MarkdownRenderChild } from 'obsidian';
import type {
  GraphEdge,
  GraphNode,
  ParsedGraph,
  Particle,
  ParticleKind,
} from './shared/types/graph';
import { applyDagreLayout } from './shared/utils/applyDagreLayout';
import {
  EDGE_COLORS,
  NODE_COLORS,
  PARTICLE_COLORS,
  PARTICLE_TRAIL_LENGTH,
  pickEdgeForKind,
} from './shared/utils/colorScheme';
import { parseMermaidToGraph } from './shared/utils/mermaidParser';
import { BASE_EDGES_PER_SECOND, createFlowId, createParticle } from './shared/utils/particleFactory';

const SVG_NS = 'http://www.w3.org/2000/svg';
const VIEWBOX_PADDING = 60;
const PIPE_OUTER_WIDTH = 18;
const PIPE_INNER_WIDTH = 12;
const PIPE_CORE_WIDTH = 8;
const PIPE_CENTER_WIDTH = 1.4;
const AUTO_SPAWN_INTERVAL_MS = 2200;
const REVISIT_LIMIT = 3;

interface FlowAnimatorOptions {
  source: string;
  speedMultiplier?: number;
  autoSpawn?: boolean;
}

export class FlowAnimator extends MarkdownRenderChild {
  private graph: ParsedGraph | null = null;
  private particles: Particle[] = [];
  private edgePathRefs = new Map<string, SVGPathElement>();
  private particlesGroup: SVGGElement | null = null;
  private rafId: number | null = null;
  private autoSpawnTimer: number | null = null;
  private alternateCounter = 0;
  private lastTime = 0;
  private speedMultiplier: number;
  private autoSpawn: boolean;
  private source: string;

  constructor(containerEl: HTMLElement, options: FlowAnimatorOptions) {
    super(containerEl);
    this.source = options.source;
    this.speedMultiplier = options.speedMultiplier ?? 1;
    this.autoSpawn = options.autoSpawn ?? true;
  }

  onload(): void {
    this.containerEl.classList.add('mermaid-flow-host');

    let parsed;
    try {
      parsed = parseMermaidToGraph(this.source);
    } catch (err) {
      this.renderError(err instanceof Error ? err.message : 'Parse error');
      return;
    }

    if (parsed.nodes.length === 0) {
      this.renderError(
        'No nodes detected. Use a `flowchart TD` block (or LR/TB/BT/RL) with `A[Label] --> B` syntax.',
      );
      return;
    }

    try {
      this.graph = applyDagreLayout(parsed);
    } catch (err) {
      this.renderError(err instanceof Error ? err.message : 'Layout failed');
      return;
    }

    this.renderStaticSvg();
    this.startLoop();
    if (this.autoSpawn) this.startAutoSpawn();
  }

  onunload(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.autoSpawnTimer !== null) {
      window.clearInterval(this.autoSpawnTimer);
      this.autoSpawnTimer = null;
    }
    this.particles = [];
    this.edgePathRefs.clear();
  }

  private renderError(message: string): void {
    const box = this.containerEl.createDiv({ cls: 'mermaid-flow-error' });
    box.createEl('strong', { text: 'MermaidFlow: ' });
    box.appendText(message);
  }

  private renderStaticSvg(): void {
    if (!this.graph) return;

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.classList.add('mermaid-flow-canvas');
    const vbW = this.graph.layoutWidth + VIEWBOX_PADDING * 2;
    const vbH = this.graph.layoutHeight + VIEWBOX_PADDING * 2;
    svg.setAttribute(
      'viewBox',
      `${-VIEWBOX_PADDING} ${-VIEWBOX_PADDING} ${vbW} ${vbH}`,
    );
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.style.aspectRatio = `${vbW} / ${vbH}`;

    const defs = document.createElementNS(SVG_NS, 'defs');
    for (const [type, color] of Object.entries(EDGE_COLORS)) {
      const marker = document.createElementNS(SVG_NS, 'marker');
      marker.setAttribute('id', `mfa-arrow-${type}`);
      marker.setAttribute('markerWidth', '10');
      marker.setAttribute('markerHeight', '7');
      marker.setAttribute('refX', '9');
      marker.setAttribute('refY', '3.5');
      marker.setAttribute('orient', 'auto');
      marker.setAttribute('markerUnits', 'strokeWidth');
      const polygon = document.createElementNS(SVG_NS, 'polygon');
      polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
      polygon.setAttribute('fill', color);
      marker.appendChild(polygon);
      defs.appendChild(marker);
    }

    const filter = document.createElementNS(SVG_NS, 'filter');
    filter.setAttribute('id', 'mfa-particle-glow');
    filter.setAttribute('x', '-50%');
    filter.setAttribute('y', '-50%');
    filter.setAttribute('width', '200%');
    filter.setAttribute('height', '200%');
    const blur = document.createElementNS(SVG_NS, 'feGaussianBlur');
    blur.setAttribute('stdDeviation', '2.5');
    blur.setAttribute('result', 'blur');
    const merge = document.createElementNS(SVG_NS, 'feMerge');
    const m1 = document.createElementNS(SVG_NS, 'feMergeNode');
    m1.setAttribute('in', 'blur');
    const m2 = document.createElementNS(SVG_NS, 'feMergeNode');
    m2.setAttribute('in', 'SourceGraphic');
    merge.appendChild(m1);
    merge.appendChild(m2);
    filter.appendChild(blur);
    filter.appendChild(merge);
    defs.appendChild(filter);

    svg.appendChild(defs);

    const edgesLayer = document.createElementNS(SVG_NS, 'g');
    edgesLayer.classList.add('mfa-edges');
    for (const edge of this.graph.edges) {
      this.renderEdge(edge, edgesLayer);
    }
    svg.appendChild(edgesLayer);

    const nodesLayer = document.createElementNS(SVG_NS, 'g');
    nodesLayer.classList.add('mfa-nodes');
    for (const node of this.graph.nodes) {
      this.renderNode(node, nodesLayer);
    }
    svg.appendChild(nodesLayer);

    const particlesLayer = document.createElementNS(SVG_NS, 'g');
    particlesLayer.classList.add('mfa-particles');
    svg.appendChild(particlesLayer);
    this.particlesGroup = particlesLayer;

    this.containerEl.appendChild(svg);
  }

  private renderEdge(edge: GraphEdge, parent: SVGGElement): void {
    const group = document.createElementNS(SVG_NS, 'g');
    group.classList.add('mfa-edge');

    const pathRef = document.createElementNS(SVG_NS, 'path');
    pathRef.setAttribute('d', edge.pathD);
    pathRef.setAttribute('fill', 'none');
    pathRef.setAttribute('stroke', 'transparent');
    pathRef.setAttribute('stroke-width', '1');
    pathRef.style.pointerEvents = 'none';
    group.appendChild(pathRef);
    this.edgePathRefs.set(edge.id, pathRef);

    const outer = document.createElementNS(SVG_NS, 'path');
    outer.setAttribute('d', edge.pathD);
    outer.setAttribute('fill', 'none');
    outer.setAttribute('stroke', edge.color);
    outer.setAttribute('stroke-width', String(PIPE_OUTER_WIDTH));
    outer.setAttribute('stroke-opacity', '0.1');
    outer.setAttribute('stroke-linecap', 'round');
    outer.setAttribute('stroke-linejoin', 'round');
    group.appendChild(outer);

    const inner = document.createElementNS(SVG_NS, 'path');
    inner.setAttribute('d', edge.pathD);
    inner.setAttribute('fill', 'none');
    inner.setAttribute('stroke', edge.color);
    inner.setAttribute('stroke-width', String(PIPE_INNER_WIDTH));
    inner.setAttribute('stroke-opacity', '0.18');
    inner.setAttribute('stroke-linecap', 'round');
    inner.setAttribute('stroke-linejoin', 'round');
    group.appendChild(inner);

    const core = document.createElementNS(SVG_NS, 'path');
    core.setAttribute('d', edge.pathD);
    core.setAttribute('fill', 'none');
    core.setAttribute('stroke', '#0a0e1a');
    core.setAttribute('stroke-width', String(PIPE_CORE_WIDTH));
    core.setAttribute('stroke-opacity', '0.55');
    core.setAttribute('stroke-linecap', 'round');
    core.setAttribute('stroke-linejoin', 'round');
    group.appendChild(core);

    const center = document.createElementNS(SVG_NS, 'path');
    center.setAttribute('d', edge.pathD);
    center.setAttribute('fill', 'none');
    center.setAttribute('stroke', edge.color);
    center.setAttribute('stroke-width', String(PIPE_CENTER_WIDTH));
    center.setAttribute('stroke-opacity', '0.6');
    center.setAttribute('marker-end', `url(#mfa-arrow-${edge.type})`);
    group.appendChild(center);

    if (edge.label && edge.points.length > 0) {
      const mid = this.midpoint(edge.points);
      if (mid) {
        const labelGroup = document.createElementNS(SVG_NS, 'g');
        labelGroup.setAttribute('transform', `translate(${mid.x}, ${mid.y})`);
        const halfW = edge.label.length * 4 + 6;
        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('x', String(-halfW));
        rect.setAttribute('y', '-9');
        rect.setAttribute('width', String(edge.label.length * 8 + 12));
        rect.setAttribute('height', '18');
        rect.setAttribute('rx', '4');
        rect.setAttribute('fill', '#0f172a');
        rect.setAttribute('stroke', edge.color);
        rect.setAttribute('stroke-opacity', '0.4');
        rect.setAttribute('stroke-width', '1');
        const text = document.createElementNS(SVG_NS, 'text');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('fill', edge.color);
        text.setAttribute('font-size', '11');
        text.style.userSelect = 'none';
        text.style.pointerEvents = 'none';
        text.textContent = edge.label;
        labelGroup.appendChild(rect);
        labelGroup.appendChild(text);
        group.appendChild(labelGroup);
      }
    }

    parent.appendChild(group);
  }

  private renderNode(node: GraphNode, parent: SVGGElement): void {
    const group = document.createElementNS(SVG_NS, 'g');
    group.classList.add('mfa-node');
    group.setAttribute(
      'transform',
      `translate(${node.x - node.width / 2}, ${node.y - node.height / 2})`,
    );

    const shape = this.createShape(node);
    group.appendChild(shape);

    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('x', String(node.width / 2));
    text.setAttribute('y', String(node.height / 2));
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('fill', NODE_COLORS.text);
    text.setAttribute('font-size', '13');
    text.style.userSelect = 'none';
    text.style.pointerEvents = 'none';
    text.textContent = node.label;
    group.appendChild(text);

    group.style.cursor = 'pointer';
    group.addEventListener('click', () => this.spawnFromNode(node.id));

    parent.appendChild(group);
  }

  private createShape(node: GraphNode): SVGElement {
    const fill = NODE_COLORS.fill;
    const stroke = NODE_COLORS.stroke;
    const cx = node.width / 2;
    const cy = node.height / 2;

    switch (node.shape) {
      case 'diamond': {
        const polygon = document.createElementNS(SVG_NS, 'polygon');
        polygon.setAttribute(
          'points',
          `${cx},0 ${node.width},${cy} ${cx},${node.height} 0,${cy}`,
        );
        polygon.setAttribute('fill', fill);
        polygon.setAttribute('stroke', stroke);
        polygon.setAttribute('stroke-width', '1.5');
        return polygon;
      }
      case 'circle': {
        const ellipse = document.createElementNS(SVG_NS, 'ellipse');
        ellipse.setAttribute('cx', String(cx));
        ellipse.setAttribute('cy', String(cy));
        ellipse.setAttribute('rx', String(cx));
        ellipse.setAttribute('ry', String(cy));
        ellipse.setAttribute('fill', fill);
        ellipse.setAttribute('stroke', stroke);
        ellipse.setAttribute('stroke-width', '1.5');
        return ellipse;
      }
      case 'stadium': {
        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('width', String(node.width));
        rect.setAttribute('height', String(node.height));
        rect.setAttribute('rx', String(node.height / 2));
        rect.setAttribute('ry', String(node.height / 2));
        rect.setAttribute('fill', fill);
        rect.setAttribute('stroke', stroke);
        rect.setAttribute('stroke-width', '1.5');
        return rect;
      }
      case 'subroutine': {
        const wrap = document.createElementNS(SVG_NS, 'g');
        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('width', String(node.width));
        rect.setAttribute('height', String(node.height));
        rect.setAttribute('rx', '4');
        rect.setAttribute('fill', fill);
        rect.setAttribute('stroke', stroke);
        rect.setAttribute('stroke-width', '1.5');
        wrap.appendChild(rect);
        const left = document.createElementNS(SVG_NS, 'line');
        left.setAttribute('x1', '8');
        left.setAttribute('y1', '0');
        left.setAttribute('x2', '8');
        left.setAttribute('y2', String(node.height));
        left.setAttribute('stroke', stroke);
        left.setAttribute('stroke-width', '1');
        wrap.appendChild(left);
        const right = document.createElementNS(SVG_NS, 'line');
        right.setAttribute('x1', String(node.width - 8));
        right.setAttribute('y1', '0');
        right.setAttribute('x2', String(node.width - 8));
        right.setAttribute('y2', String(node.height));
        right.setAttribute('stroke', stroke);
        right.setAttribute('stroke-width', '1');
        wrap.appendChild(right);
        return wrap;
      }
      default: {
        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('width', String(node.width));
        rect.setAttribute('height', String(node.height));
        rect.setAttribute('rx', '6');
        rect.setAttribute('ry', '6');
        rect.setAttribute('fill', fill);
        rect.setAttribute('stroke', stroke);
        rect.setAttribute('stroke-width', '1.5');
        return rect;
      }
    }
  }

  private midpoint(points: Array<{ x: number; y: number }>): { x: number; y: number } | null {
    if (!points || points.length === 0) return null;
    const idx = Math.floor(points.length / 2);
    if (points.length % 2 === 1) return points[idx];
    const a = points[idx - 1];
    const b = points[idx];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  private resolveSpawnKind(): ParticleKind {
    const kind: ParticleKind = this.alternateCounter % 2 === 0 ? 'success' : 'error';
    this.alternateCounter += 1;
    return kind;
  }

  private spawnFromNode(nodeId: string): void {
    if (!this.graph) return;
    const outgoing = this.graph.edges.filter((e) => e.source === nodeId);
    if (outgoing.length === 0) return;
    const kind = this.resolveSpawnKind();
    const chosen = pickEdgeForKind(outgoing, kind);
    if (!chosen) return;
    this.particles.push(
      createParticle({
        edge: chosen,
        speedMultiplier: this.speedMultiplier,
        kind,
        flowId: createFlowId(),
        visitedNodes: [chosen.source],
      }),
    );
  }

  private startAutoSpawn(): void {
    if (!this.graph) return;
    const incoming = new Set(this.graph.edges.map((e) => e.target));
    const startNodes = this.graph.nodes.filter((n) => !incoming.has(n.id));
    if (startNodes.length === 0) return;

    const dispatch = () => {
      for (const node of startNodes) this.spawnFromNode(node.id);
    };
    dispatch();
    this.autoSpawnTimer = window.setInterval(dispatch, AUTO_SPAWN_INTERVAL_MS);
  }

  private startLoop(): void {
    this.lastTime = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - this.lastTime) / 1000, 0.1);
      this.lastTime = now;
      this.advanceParticles(dt);
      this.renderParticles();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private advanceParticles(dt: number): void {
    if (!this.graph) return;
    const next: Particle[] = [];
    const toSpawn: Particle[] = [];

    for (const particle of this.particles) {
      if (particle.completed) continue;

      const pathEl = this.edgePathRefs.get(particle.edgeId);
      if (!pathEl) {
        next.push(particle);
        continue;
      }

      let totalLength = 0;
      try {
        totalLength = pathEl.getTotalLength();
      } catch {
        totalLength = 0;
      }
      if (totalLength <= 0) {
        next.push(particle);
        continue;
      }

      const newProgress = Math.min(particle.progress + particle.speed * dt, 1);
      let pointX = particle.currentX;
      let pointY = particle.currentY;
      try {
        const p = pathEl.getPointAtLength(newProgress * totalLength);
        pointX = p.x;
        pointY = p.y;
      } catch {
        /* keep last */
      }

      const newTrail = [
        { x: particle.currentX, y: particle.currentY, opacity: 0.9 },
        ...particle.trailPoints
          .slice(0, PARTICLE_TRAIL_LENGTH - 1)
          .map((pt, i) => ({
            x: pt.x,
            y: pt.y,
            opacity: 1 - (i + 2) / PARTICLE_TRAIL_LENGTH,
          })),
      ];

      const updated: Particle = {
        ...particle,
        progress: newProgress,
        currentX: pointX,
        currentY: pointY,
        trailPoints: newTrail,
        completed: newProgress >= 1,
        speed: BASE_EDGES_PER_SECOND * this.speedMultiplier,
      };

      if (newProgress >= 1) {
        const outgoing = this.graph.edges.filter((e) => e.source === particle.targetNodeId);
        if (outgoing.length > 0) {
          let kind = particle.kind;
          const isDecision = outgoing.length > 1;
          const isRevisit = particle.visitedNodes.includes(particle.targetNodeId);
          if (isDecision && isRevisit) {
            kind = particle.kind === 'success' ? 'error' : 'success';
          } else if (isDecision && particle.decisionsPassed >= 1) {
            kind = Math.random() < 0.5 ? 'success' : 'error';
          }
          const chosen = pickEdgeForKind(outgoing, kind);
          if (chosen) {
            const visits = particle.visitedNodes.filter((n) => n === chosen.target).length;
            if (visits < REVISIT_LIMIT) {
              toSpawn.push(
                createParticle({
                  edge: chosen,
                  speedMultiplier: this.speedMultiplier,
                  kind,
                  flowId: particle.flowId,
                  visitedNodes: [...particle.visitedNodes, particle.targetNodeId],
                  decisionsPassed: particle.decisionsPassed + (isDecision ? 1 : 0),
                }),
              );
            }
          }
        }
      } else {
        next.push(updated);
      }
    }

    this.particles = [...next, ...toSpawn];
  }

  private renderParticles(): void {
    if (!this.particlesGroup) return;
    while (this.particlesGroup.firstChild) {
      this.particlesGroup.removeChild(this.particlesGroup.firstChild);
    }
    for (const particle of this.particles) {
      if (particle.progress === 0 && particle.trailPoints.length === 0) continue;
      const group = document.createElementNS(SVG_NS, 'g');
      group.setAttribute('filter', 'url(#mfa-particle-glow)');

      for (let i = 0; i < particle.trailPoints.length; i++) {
        const pt = particle.trailPoints[i];
        const ratio = 1 - i / Math.max(particle.trailPoints.length, 1);
        const c = document.createElementNS(SVG_NS, 'circle');
        c.setAttribute('cx', String(pt.x));
        c.setAttribute('cy', String(pt.y));
        c.setAttribute('r', String(particle.size * 0.55 * ratio));
        c.setAttribute('fill', PARTICLE_COLORS[particle.kind]);
        c.setAttribute('opacity', String(pt.opacity * 0.5));
        group.appendChild(c);
      }

      const halo = document.createElementNS(SVG_NS, 'circle');
      halo.setAttribute('cx', String(particle.currentX));
      halo.setAttribute('cy', String(particle.currentY));
      halo.setAttribute('r', String(particle.size));
      halo.setAttribute('fill', PARTICLE_COLORS[particle.kind]);
      halo.setAttribute('opacity', '0.35');
      group.appendChild(halo);

      const core = document.createElementNS(SVG_NS, 'circle');
      core.setAttribute('cx', String(particle.currentX));
      core.setAttribute('cy', String(particle.currentY));
      core.setAttribute('r', String(particle.size * 0.6));
      core.setAttribute('fill', PARTICLE_COLORS[particle.kind]);
      core.setAttribute('opacity', '1');
      group.appendChild(core);

      const highlight = document.createElementNS(SVG_NS, 'circle');
      highlight.setAttribute('cx', String(particle.currentX));
      highlight.setAttribute('cy', String(particle.currentY));
      highlight.setAttribute('r', String(particle.size * 0.28));
      highlight.setAttribute('fill', '#ffffff');
      highlight.setAttribute('opacity', '0.9');
      group.appendChild(highlight);

      this.particlesGroup.appendChild(group);
    }
  }
}
