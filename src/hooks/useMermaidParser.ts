import { useMemo } from 'react';
import { parseMermaidToGraph } from '../utils/mermaidParser';
import type { RawGraph } from '../types/graph';

export interface ParseResult {
  graph: RawGraph | null;
  error: string | null;
}

export function useMermaidParser(source: string): ParseResult {
  return useMemo(() => {
    if (!source.trim()) {
      return { graph: null, error: null };
    }

    try {
      const graph = parseMermaidToGraph(source);
      if (graph.nodes.length === 0) {
        return {
          graph: null,
          error: 'No nodes detected. Ensure your diagram starts with `flowchart TD` and uses `A[Label] --> B` syntax.',
        };
      }
      return { graph, error: null };
    } catch (err) {
      return {
        graph: null,
        error: err instanceof Error ? err.message : 'Failed to parse diagram.',
      };
    }
  }, [source]);
}
