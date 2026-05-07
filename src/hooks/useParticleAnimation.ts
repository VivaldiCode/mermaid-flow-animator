import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AnimationState,
  FollowWindow,
  ParsedGraph,
  Particle,
  ParticleKind,
  ParticleTrailPoint,
  SpawnKind,
  ViewMode,
} from '../types/graph';
import {
  MAX_LOOP_ITERATIONS,
  MAX_PARTICLES,
  PARTICLE_TRAIL_LENGTH,
  hasErrorBranchDownstream,
  pickEdgeForKind,
} from '../utils/colorScheme';
import { createFlowId, createParticle } from '../utils/particleFactory';

export interface NodeArrivalCounts {
  total: number;
  success: number;
  error: number;
}

interface UseParticleAnimationResult {
  particles: Particle[];
  animState: AnimationState;
  flowsCompleted: number;
  successCompleted: number;
  errorCompleted: number;
  nodeArrivals: Record<string, NodeArrivalCounts>;
  play: () => void;
  pause: () => void;
  reset: () => void;
  setSpeed: (speed: number) => void;
  setMode: (mode: 'manual' | 'auto') => void;
  setAutoInterval: (ms: number) => void;
  setSpawnKind: (kind: SpawnKind) => void;
  setViewMode: (mode: ViewMode) => void;
  setFollowWindow: (window: FollowWindow) => void;
  setErrorLoopLimit: (limit: number) => void;
  startFromNode: (nodeId: string) => void;
  registerPathElement: (edgeId: string, el: SVGPathElement | null) => void;
}

export function useParticleAnimation(graph: ParsedGraph | null): UseParticleAnimationResult {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [successCompleted, setSuccessCompleted] = useState(0);
  const [errorCompleted, setErrorCompleted] = useState(0);
  const [nodeArrivals, setNodeArrivals] = useState<Record<string, NodeArrivalCounts>>({});
  const [animState, setAnimState] = useState<AnimationState>({
    isPlaying: true,
    speed: 1,
    mode: 'manual',
    autoIntervalMs: 2500,
    spawnKind: 'alternate',
    viewMode: 'overview',
    followWindow: 5,
    errorLoopLimit: 3,
  });

  const particlesRef = useRef<Particle[]>([]);
  const pathElementsRef = useRef<Map<string, SVGPathElement>>(new Map());
  const graphRef = useRef<ParsedGraph | null>(graph);
  const speedRef = useRef(animState.speed);
  const playingRef = useRef(animState.isPlaying);
  const spawnKindRef = useRef<SpawnKind>(animState.spawnKind);
  const errorLoopLimitRef = useRef<number>(animState.errorLoopLimit);
  const alternateCounterRef = useRef(0);

  useEffect(() => {
    graphRef.current = graph;
  }, [graph]);

  useEffect(() => {
    speedRef.current = animState.speed;
  }, [animState.speed]);

  useEffect(() => {
    playingRef.current = animState.isPlaying;
  }, [animState.isPlaying]);

  useEffect(() => {
    spawnKindRef.current = animState.spawnKind;
  }, [animState.spawnKind]);

  useEffect(() => {
    errorLoopLimitRef.current = animState.errorLoopLimit;
  }, [animState.errorLoopLimit]);

  const resolveSpawnKind = useCallback((): ParticleKind => {
    const setting = spawnKindRef.current;
    if (setting === 'success') return 'success';
    if (setting === 'error') return 'error';
    const next = alternateCounterRef.current % 2 === 0 ? 'success' : 'error';
    alternateCounterRef.current += 1;
    return next;
  }, []);

  const registerPathElement = useCallback((edgeId: string, el: SVGPathElement | null) => {
    if (el) pathElementsRef.current.set(edgeId, el);
    else pathElementsRef.current.delete(edgeId);
  }, []);

  const startFromNode = useCallback(
    (nodeId: string) => {
      const currentGraph = graphRef.current;
      if (!currentGraph) return;
      const outgoing = currentGraph.edges.filter((e) => e.source === nodeId);
      if (outgoing.length === 0) return;

      const requestedKind = resolveSpawnKind();
      const kind: ParticleKind =
        requestedKind === 'error' && !hasErrorBranchDownstream(currentGraph, nodeId)
          ? 'success'
          : requestedKind;
      const chosen = pickEdgeForKind(outgoing, kind);
      if (!chosen) return;

      const newParticle = createParticle({
        edge: chosen,
        speedMultiplier: speedRef.current,
        kind,
        flowId: createFlowId(),
        visitedNodes: [chosen.source],
      });
      let merged = [...particlesRef.current, newParticle];
      if (merged.length > MAX_PARTICLES) merged = merged.slice(-MAX_PARTICLES);
      particlesRef.current = merged;
      setParticles(merged);
    },
    [resolveSpawnKind],
  );

  useEffect(() => {
    let cancelled = false;
    let rafId = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      if (cancelled) return;

      const dtMs = Math.min(now - lastTime, 100);
      lastTime = now;
      const dtSec = dtMs / 1000;

      if (!playingRef.current) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      const prev = particlesRef.current;
      if (prev.length === 0) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      const currentGraph = graphRef.current;
      const nextParticles: Particle[] = [];
      const toSpawn: Particle[] = [];
      let successDone = 0;
      let errorDone = 0;
      const arrivalIncrements: Record<string, { success: number; error: number }> = {};

      for (const particle of prev) {
        if (particle.completed) continue;

        const pathEl = pathElementsRef.current.get(particle.edgeId);
        if (!pathEl) {
          nextParticles.push(particle);
          continue;
        }

        let totalLength = 0;
        try {
          totalLength = pathEl.getTotalLength();
        } catch {
          totalLength = 0;
        }
        if (totalLength <= 0) {
          nextParticles.push(particle);
          continue;
        }

        const progressIncrement = particle.speed * dtSec;
        const newProgress = Math.min(particle.progress + progressIncrement, 1);

        let pointX = particle.currentX;
        let pointY = particle.currentY;
        try {
          const p = pathEl.getPointAtLength(newProgress * totalLength);
          pointX = p.x;
          pointY = p.y;
        } catch {
          /* keep last point */
        }

        const newTrail: ParticleTrailPoint[] = [
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
          speed: speedRef.current,
        };

        if (newProgress >= 1 && currentGraph) {
          const outgoing = currentGraph.edges.filter((e) => e.source === particle.targetNodeId);
          if (outgoing.length === 0) {
            if (particle.kind === 'success') successDone += 1;
            else errorDone += 1;
            const bucket = arrivalIncrements[particle.targetNodeId] ?? { success: 0, error: 0 };
            if (particle.kind === 'success') bucket.success += 1;
            else bucket.error += 1;
            arrivalIncrements[particle.targetNodeId] = bucket;
          } else {
            let nextKind: ParticleKind = particle.kind;
            const isDecision = outgoing.length > 1;
            const isRevisit = particle.visitedNodes.includes(particle.targetNodeId);
            if (spawnKindRef.current === 'alternate' && isDecision && isRevisit) {
              nextKind = particle.kind === 'success' ? 'error' : 'success';
            }

            const chosen = pickEdgeForKind(outgoing, nextKind);
            if (chosen) {
              const targetVisitCount = particle.visitedNodes.filter(
                (n) => n === chosen.target,
              ).length;
              const limit =
                nextKind === 'error' ? errorLoopLimitRef.current : MAX_LOOP_ITERATIONS;
              if (targetVisitCount < limit) {
                toSpawn.push(
                  createParticle({
                    edge: chosen,
                    speedMultiplier: speedRef.current,
                    kind: nextKind,
                    flowId: particle.flowId,
                    visitedNodes: [...particle.visitedNodes, particle.targetNodeId],
                  }),
                );
              } else {
                let decisionNodeId = particle.targetNodeId;
                const candidates = [
                  particle.targetNodeId,
                  ...[...particle.visitedNodes].reverse(),
                ];
                for (const id of candidates) {
                  let outCount = 0;
                  for (const e of currentGraph.edges) {
                    if (e.source === id) outCount += 1;
                    if (outCount > 1) break;
                  }
                  if (outCount > 1) {
                    decisionNodeId = id;
                    break;
                  }
                }

                if (nextKind === 'success') successDone += 1;
                else errorDone += 1;
                const bucket = arrivalIncrements[decisionNodeId] ?? {
                  success: 0,
                  error: 0,
                };
                if (nextKind === 'success') bucket.success += 1;
                else bucket.error += 1;
                arrivalIncrements[decisionNodeId] = bucket;
              }
            }
          }
        } else {
          nextParticles.push(updated);
        }
      }

      let merged = [...nextParticles, ...toSpawn];
      if (merged.length > MAX_PARTICLES) merged = merged.slice(-MAX_PARTICLES);

      particlesRef.current = merged;
      setParticles(merged);
      if (successDone > 0) setSuccessCompleted((c) => c + successDone);
      if (errorDone > 0) setErrorCompleted((c) => c + errorDone);
      const arrivalKeys = Object.keys(arrivalIncrements);
      if (arrivalKeys.length > 0) {
        setNodeArrivals((prev) => {
          const next = { ...prev };
          for (const k of arrivalKeys) {
            const inc = arrivalIncrements[k];
            const existing = next[k] ?? { total: 0, success: 0, error: 0 };
            next[k] = {
              total: existing.total + inc.success + inc.error,
              success: existing.success + inc.success,
              error: existing.error + inc.error,
            };
          }
          return next;
        });
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    if (animState.mode !== 'auto' || !animState.isPlaying || !graph) return;
    const incoming = new Set(graph.edges.map((e) => e.target));
    const startNodes = graph.nodes.filter((n) => !incoming.has(n.id));
    if (startNodes.length === 0) return;

    startNodes.forEach((n) => startFromNode(n.id));
    const interval = setInterval(() => {
      startNodes.forEach((n) => startFromNode(n.id));
    }, animState.autoIntervalMs);

    return () => clearInterval(interval);
  }, [animState.mode, animState.isPlaying, animState.autoIntervalMs, graph, startFromNode]);

  useEffect(() => {
    particlesRef.current = [];
    setParticles([]);
    setSuccessCompleted(0);
    setErrorCompleted(0);
    setNodeArrivals({});
    alternateCounterRef.current = 0;
  }, [graph]);

  const play = useCallback(() => setAnimState((s) => ({ ...s, isPlaying: true })), []);
  const pause = useCallback(() => setAnimState((s) => ({ ...s, isPlaying: false })), []);
  const reset = useCallback(() => {
    particlesRef.current = [];
    setParticles([]);
    setSuccessCompleted(0);
    setErrorCompleted(0);
    setNodeArrivals({});
    alternateCounterRef.current = 0;
  }, []);
  const setSpeed = useCallback((speed: number) => setAnimState((s) => ({ ...s, speed })), []);
  const setMode = useCallback(
    (mode: 'manual' | 'auto') => setAnimState((s) => ({ ...s, mode })),
    [],
  );
  const setAutoInterval = useCallback(
    (ms: number) => setAnimState((s) => ({ ...s, autoIntervalMs: ms })),
    [],
  );
  const setSpawnKind = useCallback(
    (kind: SpawnKind) => setAnimState((s) => ({ ...s, spawnKind: kind })),
    [],
  );
  const setViewMode = useCallback(
    (mode: ViewMode) => setAnimState((s) => ({ ...s, viewMode: mode })),
    [],
  );
  const setFollowWindow = useCallback(
    (windowSize: FollowWindow) => setAnimState((s) => ({ ...s, followWindow: windowSize })),
    [],
  );
  const setErrorLoopLimit = useCallback(
    (limit: number) =>
      setAnimState((s) => ({ ...s, errorLoopLimit: Math.max(1, Math.floor(limit)) })),
    [],
  );

  return {
    particles,
    animState,
    flowsCompleted: successCompleted + errorCompleted,
    successCompleted,
    errorCompleted,
    nodeArrivals,
    play,
    pause,
    reset,
    setSpeed,
    setMode,
    setAutoInterval,
    setSpawnKind,
    setViewMode,
    setFollowWindow,
    setErrorLoopLimit,
    startFromNode,
    registerPathElement,
  };
}
