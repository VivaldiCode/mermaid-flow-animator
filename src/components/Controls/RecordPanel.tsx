import React, { useState } from 'react';
import type { RecorderOptions, RecorderState } from '../../hooks/useGifRecorder';
import './RecordPanel.css';

interface RecordPanelProps {
  state: RecorderState;
  onStart: (options: RecorderOptions) => void;
  onCancel: () => void;
  onReset: () => void;
}

const FPS_PRESETS = [10, 15, 20, 24];
const PARTICLE_PRESETS = [1, 2, 3, 5, 8];
const SPAWN_PRESETS: Array<{ key: 'success' | 'error' | 'alternate'; label: string }> = [
  { key: 'success', label: 'Success' },
  { key: 'error', label: 'Error' },
  { key: 'alternate', label: 'Alternate' },
];

export const RecordPanel: React.FC<RecordPanelProps> = ({
  state,
  onStart,
  onCancel,
  onReset,
}) => {
  const [particleCount, setParticleCount] = useState(3);
  const [fps, setFps] = useState(15);
  const [spawnKind, setSpawnKind] = useState<'success' | 'error' | 'alternate'>(
    'alternate',
  );

  const isBusy = state.stage === 'capturing' || state.stage === 'encoding';

  const handleStart = () => {
    onStart({
      particleCount,
      fps,
      spawnKind,
      fileName: 'mermaid-flow.gif',
    });
  };

  return (
    <div className="record-panel">
      <span className="section-label">EXPORT GIF</span>

      {state.stage === 'idle' && (
        <>
          <div className="record-row">
            <span className="record-label">Particles</span>
            <div className="control-row">
              {PARTICLE_PRESETS.map((n) => (
                <button
                  key={n}
                  className={`btn-control ${particleCount === n ? 'active' : ''}`}
                  onClick={() => setParticleCount(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="record-row">
            <span className="record-label">FPS</span>
            <div className="control-row">
              {FPS_PRESETS.map((f) => (
                <button
                  key={f}
                  className={`btn-control ${fps === f ? 'active' : ''}`}
                  onClick={() => setFps(f)}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="record-row">
            <span className="record-label">Type</span>
            <div className="control-row">
              {SPAWN_PRESETS.map((s) => (
                <button
                  key={s.key}
                  className={`btn-control ${spawnKind === s.key ? 'active' : ''}`}
                  onClick={() => setSpawnKind(s.key)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <button className="btn-control btn-control--primary record-btn" onClick={handleStart}>
            ◉ Generate GIF
          </button>
          <span className="record-hint">
            Resets canvas, dispatches {particleCount} particle{particleCount === 1 ? '' : 's'},
            captures at {fps} fps and downloads as <code>.gif</code>.
          </span>
        </>
      )}

      {state.stage === 'capturing' && (
        <div className="record-progress">
          <span className="record-status">
            ◉ Capturing — particle {state.particlesDone}/{state.totalParticles}
          </span>
          <span className="record-meta">{state.capturedFrames} frames</span>
          <button className="btn-control" onClick={onCancel}>
            Cancel
          </button>
        </div>
      )}

      {state.stage === 'encoding' && (
        <div className="record-progress">
          <span className="record-status">⌛ Encoding GIF…</span>
          <div className="progress-bar">
            <div
              className="progress-bar__fill"
              style={{ width: `${Math.round(state.encodedProgress * 100)}%` }}
            />
          </div>
          <span className="record-meta">{Math.round(state.encodedProgress * 100)}%</span>
          <button className="btn-control" onClick={onCancel}>
            Cancel
          </button>
        </div>
      )}

      {state.stage === 'done' && state.downloadUrl && (
        <div className="record-progress">
          <span className="record-status record-status--done">✓ GIF ready{state.message ? ` · ${state.message}` : ''}</span>
          <a
            href={state.downloadUrl}
            download="mermaid-flow.gif"
            className="btn-control btn-control--primary record-btn"
          >
            ↓ Download .gif
          </a>
          <button className="btn-control" onClick={onReset}>
            Record another
          </button>
        </div>
      )}

      {state.stage === 'error' && (
        <div className="record-progress">
          <span className="record-status record-status--error">
            ✕ {state.message ?? 'Recording failed'}
          </span>
          <button className="btn-control" onClick={onReset}>
            Try again
          </button>
        </div>
      )}

      {isBusy && state.stage === 'capturing' && (
        <span className="record-hint">
          Don't switch tab — frames are captured from the live canvas.
        </span>
      )}
    </div>
  );
};
