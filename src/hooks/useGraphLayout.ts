import { useMemo } from 'react';
import type { ParsedGraph, RawGraph } from '../types/graph';
import { applyDagreLayout } from '../utils/applyDagreLayout';

export { applyDagreLayout };

export function useGraphLayout(rawGraph: RawGraph | null): ParsedGraph | null {
  return useMemo(() => {
    if (!rawGraph) return null;
    if (rawGraph.nodes.length === 0) return null;
    try {
      return applyDagreLayout(rawGraph);
    } catch (err) {
      console.error('Layout error:', err);
      return null;
    }
  }, [rawGraph]);
}
