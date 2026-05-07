import React, { useCallback, useEffect, useState } from 'react';
import { FlowCanvas } from './components/Canvas/FlowCanvas';
import { AnimationControls } from './components/Controls/AnimationControls';
import { EXAMPLE_DIAGRAMS, MermaidEditor } from './components/Editor/MermaidEditor';
import { FlowLegend } from './components/Legend/FlowLegend';
import { useGraphLayout } from './hooks/useGraphLayout';
import { useMermaidParser } from './hooks/useMermaidParser';
import { useParticleAnimation } from './hooks/useParticleAnimation';
import type { ParsedGraph } from './types/graph';
import './App.css';

const INITIAL_SOURCE = EXAMPLE_DIAGRAMS['Login Flow'];

const App: React.FC = () => {
  const [source, setSource] = useState(INITIAL_SOURCE);
  const [renderedSource, setRenderedSource] = useState(INITIAL_SOURCE);

  const { graph: rawGraph, error: parseError } = useMermaidParser(renderedSource);
  const layoutGraph: ParsedGraph | null = useGraphLayout(rawGraph);

  const {
    particles,
    animState,
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
  } = useParticleAnimation(layoutGraph);

  const handleRender = useCallback(() => {
    setRenderedSource(source);
    reset();
  }, [source, reset]);

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      if (animState.mode === 'manual') {
        startFromNode(nodeId);
      }
    },
    [animState.mode, startFromNode],
  );

  useEffect(() => {
    if (!animState.isPlaying) play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">◆</span>
          <span className="brand-name">MermaidFlow</span>
          <span className="brand-suffix">Animator</span>
        </div>
        <div className="header-meta">
          <span className="meta-item">client-side</span>
          <span className="meta-divider">·</span>
          <span className="meta-item">react + svg</span>
          <span className="meta-divider">·</span>
          <span className="meta-item">dagre layout</span>
        </div>
      </header>

      <div className="app-body">
        <aside className="sidebar">
          <MermaidEditor
            source={source}
            onChange={setSource}
            onRender={handleRender}
            parseError={parseError}
          />
          <AnimationControls
            animState={animState}
            onPlay={play}
            onPause={pause}
            onReset={reset}
            onSpeedChange={setSpeed}
            onModeChange={setMode}
            onAutoIntervalChange={setAutoInterval}
            onSpawnKindChange={setSpawnKind}
            onViewModeChange={setViewMode}
            onFollowWindowChange={setFollowWindow}
            onErrorLoopLimitChange={setErrorLoopLimit}
          />
          <FlowLegend />
        </aside>

        <main className="canvas-container">
          {layoutGraph ? (
            <FlowCanvas
              graph={layoutGraph}
              particles={particles}
              onNodeClick={handleNodeClick}
              registerPathElement={registerPathElement}
              particleCount={particles.length}
              successCompleted={successCompleted}
              errorCompleted={errorCompleted}
              nodeArrivals={nodeArrivals}
              viewMode={animState.viewMode}
              followWindow={animState.followWindow}
            />
          ) : (
            <div className="empty-state">
              <span className="empty-state__title">No diagram</span>
              <span className="empty-state__hint">
                {parseError ?? 'Type a Mermaid flowchart on the left and press Render.'}
              </span>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
