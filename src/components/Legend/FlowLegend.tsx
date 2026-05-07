import React from 'react';
import { EDGE_COLORS, PARTICLE_COLORS } from '../../utils/colorScheme';
import './FlowLegend.css';

interface PipeEntry {
  type: keyof typeof EDGE_COLORS;
  label: string;
}

const PIPE_ENTRIES: PipeEntry[] = [
  { type: 'default', label: 'Default flow' },
  { type: 'yes', label: 'Yes / Sim / True' },
  { type: 'no', label: 'No / Não / False' },
  { type: 'labeled', label: 'Custom label' },
];

const PARTICLE_ENTRIES: Array<{ key: keyof typeof PARTICLE_COLORS; label: string }> = [
  { key: 'success', label: 'Success particle' },
  { key: 'error', label: 'Error particle' },
];

export const FlowLegend: React.FC = () => {
  return (
    <div className="flow-legend">
      <span className="section-label">PIPES</span>
      <ul className="legend-list">
        {PIPE_ENTRIES.map((entry) => (
          <li key={entry.type} className="legend-item">
            <span className="legend-pipe" style={{ background: EDGE_COLORS[entry.type] }} />
            <span className="legend-label">{entry.label}</span>
          </li>
        ))}
      </ul>

      <span className="section-label legend-section-spacer">PARTICLES</span>
      <ul className="legend-list">
        {PARTICLE_ENTRIES.map((entry) => (
          <li key={entry.key} className="legend-item">
            <span
              className="legend-dot"
              style={{
                background: PARTICLE_COLORS[entry.key],
                boxShadow: `0 0 8px ${PARTICLE_COLORS[entry.key]}`,
              }}
            />
            <span className="legend-label">{entry.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
