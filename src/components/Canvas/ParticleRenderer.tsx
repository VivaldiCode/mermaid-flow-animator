import React from 'react';
import type { Particle } from '../../types/graph';

interface ParticleRendererProps {
  particle: Particle;
  isFollowed?: boolean;
}

export const ParticleRenderer: React.FC<ParticleRendererProps> = ({ particle, isFollowed }) => {
  if (particle.progress === 0 && particle.trailPoints.length === 0) return null;

  return (
    <g filter={isFollowed ? 'url(#followed-glow)' : 'url(#particle-glow)'}>
      {particle.trailPoints.map((pt, i) => {
        const ratio = 1 - i / Math.max(particle.trailPoints.length, 1);
        return (
          <circle
            key={i}
            cx={pt.x}
            cy={pt.y}
            r={particle.size * 0.55 * ratio}
            fill={particle.color}
            opacity={pt.opacity * 0.5}
          />
        );
      })}
      {isFollowed && (
        <circle
          cx={particle.currentX}
          cy={particle.currentY}
          r={particle.size * 1.7}
          fill="none"
          stroke={particle.color}
          strokeWidth={1.2}
          strokeOpacity={0.55}
        />
      )}
      <circle
        cx={particle.currentX}
        cy={particle.currentY}
        r={particle.size}
        fill={particle.color}
        opacity={0.35}
      />
      <circle
        cx={particle.currentX}
        cy={particle.currentY}
        r={particle.size * 0.6}
        fill={particle.color}
        opacity={1}
      />
      <circle
        cx={particle.currentX}
        cy={particle.currentY}
        r={particle.size * 0.28}
        fill="#ffffff"
        opacity={0.9}
      />
    </g>
  );
};
