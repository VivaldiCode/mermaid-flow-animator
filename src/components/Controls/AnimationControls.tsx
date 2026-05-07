import React from 'react';
import type { AnimationState, FollowWindow, SpawnKind, ViewMode } from '../../types/graph';
import { PARTICLE_COLORS } from '../../utils/colorScheme';
import './AnimationControls.css';

interface AnimationControlsProps {
  animState: AnimationState;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onSpeedChange: (speed: number) => void;
  onModeChange: (mode: 'manual' | 'auto') => void;
  onAutoIntervalChange: (ms: number) => void;
  onSpawnKindChange: (kind: SpawnKind) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onFollowWindowChange: (window: FollowWindow) => void;
  onErrorLoopLimitChange: (limit: number) => void;
  onShowBadgesChange: (show: boolean) => void;
}

const SPEEDS = [0.5, 1, 2, 3];

const SPAWN_KINDS: Array<{ key: SpawnKind; label: string; color?: string }> = [
  { key: 'success', label: 'Success', color: PARTICLE_COLORS.success },
  { key: 'error', label: 'Error', color: PARTICLE_COLORS.error },
  { key: 'alternate', label: 'Alternate' },
];

const FOLLOW_WINDOWS: FollowWindow[] = [3, 5, 7, 9];

export const AnimationControls: React.FC<AnimationControlsProps> = ({
  animState,
  onPlay,
  onPause,
  onReset,
  onSpeedChange,
  onModeChange,
  onAutoIntervalChange,
  onSpawnKindChange,
  onViewModeChange,
  onFollowWindowChange,
  onErrorLoopLimitChange,
  onShowBadgesChange,
}) => {
  return (
    <div className="animation-controls">
      <div className="control-section">
        <span className="section-label">PLAYBACK</span>
        <div className="control-row">
          {animState.isPlaying ? (
            <button className="btn-control" onClick={onPause}>
              ⏸ Pause
            </button>
          ) : (
            <button className="btn-control btn-control--primary" onClick={onPlay}>
              ▸ Play
            </button>
          )}
          <button className="btn-control" onClick={onReset}>
            ↺ Reset
          </button>
        </div>
      </div>

      <div className="control-section">
        <span className="section-label">SPEED</span>
        <div className="control-row">
          {SPEEDS.map((s) => (
            <button
              key={s}
              className={`btn-control ${animState.speed === s ? 'active' : ''}`}
              onClick={() => onSpeedChange(s)}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      <div className="control-section">
        <span className="section-label">PARTICLE TYPE</span>
        <div className="control-row">
          {SPAWN_KINDS.map((s) => (
            <button
              key={s.key}
              className={`btn-control btn-kind ${animState.spawnKind === s.key ? 'active' : ''}`}
              onClick={() => onSpawnKindChange(s.key)}
            >
              {s.color && (
                <span
                  className="kind-dot"
                  style={{ background: s.color, boxShadow: `0 0 6px ${s.color}` }}
                />
              )}
              {s.label}
            </button>
          ))}
        </div>
        <div className="error-loop-control">
          <label className="interval-label">
            <span>Error loop iterations: {animState.errorLoopLimit}</span>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={animState.errorLoopLimit}
              onChange={(e) => onErrorLoopLimitChange(Number(e.target.value))}
            />
          </label>
          <span className="sub-label">
            Max times an error particle can revisit the same node before stopping.
          </span>
        </div>
      </div>

      <div className="control-section">
        <span className="section-label">TERMINAL BADGES</span>
        <div className="control-row">
          <button
            className={`btn-control ${animState.showBadges ? 'active' : ''}`}
            onClick={() => onShowBadgesChange(true)}
          >
            Show
          </button>
          <button
            className={`btn-control ${!animState.showBadges ? 'active' : ''}`}
            onClick={() => onShowBadgesChange(false)}
          >
            Hide
          </button>
        </div>
        <span className="sub-label">
          Toggle the success/error counters on top of nodes.
        </span>
      </div>

      <div className="control-section">
        <span className="section-label">VIEW</span>
        <div className="control-row">
          <button
            className={`btn-control ${animState.viewMode === 'overview' ? 'active' : ''}`}
            onClick={() => onViewModeChange('overview')}
          >
            Overview
          </button>
          <button
            className={`btn-control ${animState.viewMode === 'follow' ? 'active' : ''}`}
            onClick={() => onViewModeChange('follow')}
          >
            Follow particle
          </button>
        </div>
        {animState.viewMode === 'follow' && (
          <>
            <span className="sub-label">Window — boxes visible</span>
            <div className="control-row">
              {FOLLOW_WINDOWS.map((w) => (
                <button
                  key={w}
                  className={`btn-control ${animState.followWindow === w ? 'active' : ''}`}
                  onClick={() => onFollowWindowChange(w)}
                >
                  {w}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="control-section">
        <span className="section-label">MODE</span>
        <div className="control-row">
          <button
            className={`btn-control ${animState.mode === 'manual' ? 'active' : ''}`}
            onClick={() => onModeChange('manual')}
          >
            Manual
          </button>
          <button
            className={`btn-control ${animState.mode === 'auto' ? 'active' : ''}`}
            onClick={() => onModeChange('auto')}
          >
            Auto
          </button>
        </div>
        {animState.mode === 'manual' ? (
          <p className="mode-hint">Click any node to dispatch a single particle along one path.</p>
        ) : (
          <div className="auto-interval">
            <label className="interval-label">
              <span>Spawn every {animState.autoIntervalMs}ms</span>
              <input
                type="range"
                min={500}
                max={5000}
                step={100}
                value={animState.autoIntervalMs}
                onChange={(e) => onAutoIntervalChange(Number(e.target.value))}
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
};
