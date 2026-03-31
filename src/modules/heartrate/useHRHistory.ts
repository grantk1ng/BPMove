import {useState, useEffect, useRef, useCallback} from 'react';
import {eventBus} from '../../core/EventBus';
import type {HeartRateReading} from './types';

export interface HRDataPoint {
  bpm: number;
  timestamp: number;
}

interface UseHRHistoryOptions {
  /** Maximum number of data points to retain (default: 60) */
  maxPoints?: number;
  /** Duration in ms to retain data points (default: 60000 = 60 seconds) */
  maxDuration?: number;
}

/**
 * Hook that maintains a rolling history of heart rate readings.
 * Automatically prunes old readings based on maxPoints or maxDuration.
 */
export function useHRHistory(options: UseHRHistoryOptions = {}) {
  const {maxPoints = 60, maxDuration = 60000} = options;
  const [history, setHistory] = useState<HRDataPoint[]>([]);
  const historyRef = useRef<HRDataPoint[]>([]);

  // Keep ref in sync for pruning logic
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    const unsub = eventBus.on('hr:reading', (reading: HeartRateReading) => {
      const newPoint: HRDataPoint = {
        bpm: reading.bpm,
        timestamp: reading.timestamp,
      };

      setHistory(prev => {
        const now = Date.now();
        // Add new point and prune old ones
        const updated = [...prev, newPoint]
          .filter(p => now - p.timestamp <= maxDuration)
          .slice(-maxPoints);
        return updated;
      });
    });

    return unsub;
  }, [maxPoints, maxDuration]);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  return {
    history,
    clearHistory,
  };
}
