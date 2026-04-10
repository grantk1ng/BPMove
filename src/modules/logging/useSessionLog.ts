import {useState, useEffect, useCallback, useRef} from 'react';
import {eventBus} from '../../core/EventBus';
import {ServiceRegistry} from '../../core/ServiceRegistry';
import type {SessionLogger} from './SessionLogger';
import type {SessionLog} from './types';

export function useSessionLog() {
  const [isActive, setIsActive] = useState(() => {
    const logger = ServiceRegistry.get<SessionLogger>('logging');
    return logger.isActive();
  });
  const [elapsedMs, setElapsedMs] = useState(0);
  const [entryCount, setEntryCount] = useState(0);
  const [timeSeriesCount, setTimeSeriesCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const unsubs = [
      eventBus.on('session:started', () => {
        setIsActive(true);
        setElapsedMs(0);
        setEntryCount(0);
        setTimeSeriesCount(0);
      }),
      eventBus.on('session:ended', () => {
        setIsActive(false);
      }),
    ];

    return () => unsubs.forEach(unsub => unsub());
  }, []);

  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        const logger = ServiceRegistry.get<SessionLogger>('logging');
        setElapsedMs(logger.getElapsedMs());
        setEntryCount(logger.getEntryCount());
        setTimeSeriesCount(logger.getTimeSeriesCount());
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isActive]);

  const startSession = useCallback(
    (config: Record<string, unknown>): string => {
      const logger = ServiceRegistry.get<SessionLogger>('logging');
      return logger.start(config);
    },
    [],
  );

  const stopSession = useCallback(
    (reason: 'user' | 'error' | 'timeout' = 'user'): SessionLog => {
      const logger = ServiceRegistry.get<SessionLogger>('logging');
      return logger.stop(reason);
    },
    [],
  );

  return {
    isActive,
    elapsedMs,
    entryCount,
    timeSeriesCount,
    startSession,
    stopSession,
  };
}
