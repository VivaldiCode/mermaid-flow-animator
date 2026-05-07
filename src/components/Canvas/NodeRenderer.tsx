import React from 'react';
import type { GraphNode } from '../../types/graph';
import type { NodeArrivalCounts } from '../../hooks/useParticleAnimation';
import { NODE_COLORS, PARTICLE_COLORS } from '../../utils/colorScheme';

interface NodeRendererProps {
  node: GraphNode;
  onClick: () => void;
  isActive: boolean;
  arrivals?: NodeArrivalCounts;
}

function renderShape(node: GraphNode, isActive: boolean): React.ReactNode {
  const fill = isActive ? NODE_COLORS.activeFill : NODE_COLORS.fill;
  const stroke = isActive ? NODE_COLORS.activeStroke : NODE_COLORS.stroke;

  switch (node.shape) {
    case 'diamond': {
      const cx = node.width / 2;
      const cy = node.height / 2;
      return (
        <polygon
          points={`${cx},0 ${node.width},${cy} ${cx},${node.height} 0,${cy}`}
          fill={fill}
          stroke={stroke}
          strokeWidth={1.5}
        />
      );
    }
    case 'circle':
      return (
        <ellipse
          cx={node.width / 2}
          cy={node.height / 2}
          rx={node.width / 2}
          ry={node.height / 2}
          fill={fill}
          stroke={stroke}
          strokeWidth={1.5}
        />
      );
    case 'subroutine':
      return (
        <g>
          <rect
            width={node.width}
            height={node.height}
            rx={4}
            fill={fill}
            stroke={stroke}
            strokeWidth={1.5}
          />
          <line x1={8} y1={0} x2={8} y2={node.height} stroke={stroke} strokeWidth={1} />
          <line
            x1={node.width - 8}
            y1={0}
            x2={node.width - 8}
            y2={node.height}
            stroke={stroke}
            strokeWidth={1}
          />
        </g>
      );
    case 'stadium':
      return (
        <rect
          width={node.width}
          height={node.height}
          rx={node.height / 2}
          ry={node.height / 2}
          fill={fill}
          stroke={stroke}
          strokeWidth={1.5}
        />
      );
    default:
      return (
        <rect
          width={node.width}
          height={node.height}
          rx={6}
          ry={6}
          fill={fill}
          stroke={stroke}
          strokeWidth={1.5}
        />
      );
  }
}

interface NotificationBadgeProps {
  arrivals: NodeArrivalCounts;
  cx: number;
  cy: number;
}

const NotificationBadge: React.FC<NotificationBadgeProps> = ({ arrivals, cx, cy }) => {
  const count = arrivals.total;
  if (count <= 0) return null;

  const label = count > 99 ? '99+' : String(count);
  const charCount = label.length;
  const height = 22;
  const width = Math.max(height, charCount * 8 + 12);

  const onlySuccess = arrivals.error === 0;
  const onlyError = arrivals.success === 0;
  const fill = onlyError
    ? PARTICLE_COLORS.error
    : onlySuccess
      ? PARTICLE_COLORS.success
      : '#ef4444';

  return (
    <g transform={`translate(${cx}, ${cy})`} style={{ pointerEvents: 'none' }}>
      <g key={count} className="node-badge">
        <rect
          x={-width / 2}
          y={-height / 2}
          width={width}
          height={height}
          rx={height / 2}
          ry={height / 2}
          fill={fill}
          stroke="#0a0e1a"
          strokeWidth={2.5}
        />
        <text
          x={0}
          y={1}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#ffffff"
          fontSize={12}
          fontWeight={700}
          fontFamily="'DM Sans', sans-serif"
          style={{ userSelect: 'none' }}
        >
          {label}
        </text>
      </g>
    </g>
  );
};

function getBadgePosition(node: GraphNode): { cx: number; cy: number } {
  if (node.shape === 'circle') {
    const r = Math.min(node.width, node.height) / 2;
    const cx = node.width / 2 + Math.cos(-Math.PI / 4) * r;
    const cy = node.height / 2 + Math.sin(-Math.PI / 4) * r;
    return { cx, cy };
  }
  if (node.shape === 'diamond') {
    return { cx: node.width * 0.78, cy: node.height * 0.18 };
  }
  return { cx: node.width - 6, cy: -2 };
}

export const NodeRenderer: React.FC<NodeRendererProps> = ({ node, onClick, isActive, arrivals }) => {
  const badgePos = getBadgePosition(node);

  return (
    <g
      transform={`translate(${node.x - node.width / 2}, ${node.y - node.height / 2})`}
      onClick={onClick}
      className={`node ${isActive ? 'node--active' : ''}`}
    >
      {renderShape(node, isActive)}
      <text
        x={node.width / 2}
        y={node.height / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={NODE_COLORS.text}
        fontSize={13}
        fontFamily="'JetBrains Mono', monospace"
        style={{ userSelect: 'none', pointerEvents: 'none' }}
      >
        {node.label}
      </text>
      {arrivals && arrivals.total > 0 && (
        <NotificationBadge arrivals={arrivals} cx={badgePos.cx} cy={badgePos.cy} />
      )}
    </g>
  );
};
