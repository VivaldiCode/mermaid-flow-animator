import React, { useEffect, useRef } from 'react';
import type { GraphEdge } from '../../types/graph';

interface EdgeRendererProps {
  edge: GraphEdge;
  registerRef: (el: SVGPathElement | null) => void;
  isActive: boolean;
}

function getMidPoint(points: Array<{ x: number; y: number }>): { x: number; y: number } | null {
  if (!points || points.length === 0) return null;
  const midIdx = Math.floor(points.length / 2);
  if (points.length % 2 === 1) return points[midIdx];
  const a = points[midIdx - 1];
  const b = points[midIdx];
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

const PIPE_OUTER_WIDTH = 18;
const PIPE_INNER_WIDTH = 12;
const PIPE_CENTER_WIDTH = 1.4;

export const EdgeRenderer: React.FC<EdgeRendererProps> = ({ edge, registerRef, isActive }) => {
  const pathRef = useRef<SVGPathElement | null>(null);

  useEffect(() => {
    registerRef(pathRef.current);
    return () => registerRef(null);
  }, [edge.id, edge.pathD, registerRef]);

  const mid = getMidPoint(edge.points);
  const labelText = edge.label && edge.label.trim() !== '' ? edge.label : null;

  return (
    <g className={`edge edge--${edge.type} ${isActive ? 'edge--active' : ''}`}>
      <path
        ref={pathRef}
        d={edge.pathD}
        fill="none"
        stroke="transparent"
        strokeWidth={1}
        style={{ pointerEvents: 'none' }}
      />

      <path
        d={edge.pathD}
        fill="none"
        stroke={edge.color}
        strokeWidth={PIPE_OUTER_WIDTH}
        strokeOpacity={isActive ? 0.18 : 0.1}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transition: 'stroke-opacity 0.25s ease' }}
      />

      <path
        d={edge.pathD}
        fill="none"
        stroke={edge.color}
        strokeWidth={PIPE_INNER_WIDTH}
        strokeOpacity={isActive ? 0.32 : 0.18}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transition: 'stroke-opacity 0.25s ease' }}
      />

      <path
        d={edge.pathD}
        fill="none"
        stroke="#0a0e1a"
        strokeWidth={PIPE_INNER_WIDTH - 4}
        strokeOpacity={0.55}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d={edge.pathD}
        fill="none"
        stroke={edge.color}
        strokeWidth={PIPE_CENTER_WIDTH}
        strokeOpacity={isActive ? 0.85 : 0.55}
        strokeLinecap="round"
        markerEnd={`url(#arrow-${edge.type})`}
        style={{ transition: 'stroke-opacity 0.25s ease' }}
      />

      {labelText && mid && (
        <g transform={`translate(${mid.x}, ${mid.y})`}>
          <rect
            x={-(labelText.length * 4 + 6)}
            y={-9}
            width={labelText.length * 8 + 12}
            height={18}
            rx={4}
            fill="#0f172a"
            stroke={edge.color}
            strokeOpacity={0.4}
            strokeWidth={1}
          />
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            fill={edge.color}
            fontSize={11}
            fontFamily="'JetBrains Mono', monospace"
            style={{ userSelect: 'none', pointerEvents: 'none' }}
          >
            {labelText}
          </text>
        </g>
      )}
    </g>
  );
};
