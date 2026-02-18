import {LinearStrategy} from '../strategies/LinearStrategy';
import type {AlgorithmConfig, AlgorithmState} from '../types';
import type {HeartRateReading} from '../../heartrate/types';

function makeConfig(overrides?: Partial<AlgorithmConfig>): AlgorithmConfig {
  return {
    targetZone: {name: 'Zone 2', minBPM: 140, maxBPM: 160, color: '#4CAF50'},
    minMusicBPM: 100,
    maxMusicBPM: 200,
    responsiveness: 0.5,
    cooldownSeconds: 0, // No cooldown for tests
    smoothingWindow: 3,
    strategyName: 'linear',
    dwellTimeMs: 5000,
    returnToMaintainMs: 3000,
    ...overrides,
  };
}

function makeReading(
  bpm: number,
  timestamp: number = Date.now(),
): HeartRateReading {
  return {
    bpm,
    timestamp,
    sensorContact: true,
    rrIntervals: [],
    energyExpended: null,
  };
}

function feedReadings(
  strategy: LinearStrategy,
  state: AlgorithmState,
  config: AlgorithmConfig,
  readings: HeartRateReading[],
): {state: AlgorithmState; targets: Array<{targetBPM: number; mode: string}>} {
  let currentState = state;
  const targets: Array<{targetBPM: number; mode: string}> = [];

  for (const reading of readings) {
    const result = strategy.compute(reading, currentState, config);
    currentState = result.nextState;
    if (result.target) {
      targets.push({targetBPM: result.target.targetBPM, mode: result.target.mode});
    }
  }

  return {state: currentState, targets};
}

describe('LinearStrategy', () => {
  let strategy: LinearStrategy;

  beforeEach(() => {
    strategy = new LinearStrategy();
  });

  describe('initialState', () => {
    it('starts in MAINTAIN mode', () => {
      const config = makeConfig();
      const state = strategy.initialState(config);
      expect(state.currentMode).toBe('MAINTAIN');
    });

    it('initializes with neutral target BPM', () => {
      const config = makeConfig();
      const state = strategy.initialState(config);
      // Neutral = midpoint of [100, 200] = 150
      expect(state.currentTargetBPM).toBe(150);
    });

    it('starts with empty HR history', () => {
      const config = makeConfig();
      const state = strategy.initialState(config);
      expect(state.hrHistory).toEqual([]);
    });
  });

  describe('MAINTAIN mode holds steady', () => {
    it('does not change target BPM when HR is in zone', () => {
      const config = makeConfig();
      let state = strategy.initialState(config);
      const initialBPM = state.currentTargetBPM;

      // Feed readings that are within the target zone [140, 160]
      const baseTime = Date.now();
      for (let i = 0; i < 10; i++) {
        const result = strategy.compute(
          makeReading(150, baseTime + i * 1000),
          state,
          config,
        );
        state = result.nextState;
        // Should not emit a target when in MAINTAIN
        // (initial mode with in-zone HR)
      }

      expect(state.currentMode).toBe('MAINTAIN');
      // BPM should not have changed significantly
      expect(Math.abs(state.currentTargetBPM - initialBPM)).toBeLessThan(2);
    });
  });

  describe('mode transitions with hysteresis', () => {
    it('stays in MAINTAIN when HR briefly drops below zone', () => {
      const config = makeConfig({dwellTimeMs: 5000});
      let state = strategy.initialState(config);
      const baseTime = Date.now();

      // Feed 3 readings below zone (3 seconds, less than dwellTimeMs)
      for (let i = 0; i < 3; i++) {
        const result = strategy.compute(
          makeReading(120, baseTime + i * 1000),
          state,
          config,
        );
        state = result.nextState;
      }

      // Should still be in MAINTAIN because dwellTimeMs not reached
      expect(state.currentMode).toBe('MAINTAIN');
    });

    it('transitions to RAISE when HR is below zone for dwellTimeMs', () => {
      const config = makeConfig({dwellTimeMs: 3000, smoothingWindow: 2});
      let state = strategy.initialState(config);
      const baseTime = Date.now();

      // Feed readings below zone for enough time
      for (let i = 0; i < 6; i++) {
        const result = strategy.compute(
          makeReading(120, baseTime + i * 1000),
          state,
          config,
        );
        state = result.nextState;
      }

      expect(state.currentMode).toBe('RAISE');
    });

    it('transitions to LOWER when HR is above zone for dwellTimeMs', () => {
      const config = makeConfig({dwellTimeMs: 3000, smoothingWindow: 2});
      let state = strategy.initialState(config);
      const baseTime = Date.now();

      // Feed readings above zone
      for (let i = 0; i < 6; i++) {
        const result = strategy.compute(
          makeReading(180, baseTime + i * 1000),
          state,
          config,
        );
        state = result.nextState;
      }

      expect(state.currentMode).toBe('LOWER');
    });
  });

  describe('incremental BPM stepping (no jumps)', () => {
    it('ramps target BPM upward incrementally in RAISE mode', () => {
      const config = makeConfig({
        dwellTimeMs: 0, // Instant transition for testing
        cooldownSeconds: 0,
        smoothingWindow: 1,
        responsiveness: 1.0,
      });

      // Start in RAISE mode by forcing state
      let state: AlgorithmState = {
        ...strategy.initialState(config),
        currentMode: 'RAISE',
        modeEnteredAt: Date.now(),
        currentTargetBPM: 150,
        msSinceLastTargetChange: Infinity,
      };

      const baseTime = Date.now();
      const bpmHistory: number[] = [state.currentTargetBPM];

      // Feed below-zone readings
      for (let i = 0; i < 10; i++) {
        const result = strategy.compute(
          makeReading(120, baseTime + i * 1000),
          state,
          config,
        );
        state = result.nextState;
        bpmHistory.push(state.currentTargetBPM);
      }

      // Verify monotonic increase (no jumps, just steps)
      for (let i = 1; i < bpmHistory.length; i++) {
        expect(bpmHistory[i]).toBeGreaterThanOrEqual(bpmHistory[i - 1]);
        // Step should be small, not a jump to maxMusicBPM
        const step = bpmHistory[i] - bpmHistory[i - 1];
        expect(step).toBeLessThan(20); // No large jumps
      }

      // Should have increased from 150
      expect(state.currentTargetBPM).toBeGreaterThan(150);
    });

    it('ramps target BPM downward incrementally in LOWER mode', () => {
      const config = makeConfig({
        dwellTimeMs: 0,
        cooldownSeconds: 0,
        smoothingWindow: 1,
        responsiveness: 1.0,
      });

      let state: AlgorithmState = {
        ...strategy.initialState(config),
        currentMode: 'LOWER',
        modeEnteredAt: Date.now(),
        currentTargetBPM: 150,
        msSinceLastTargetChange: Infinity,
      };

      const baseTime = Date.now();
      const bpmHistory: number[] = [state.currentTargetBPM];

      // Feed above-zone readings
      for (let i = 0; i < 10; i++) {
        const result = strategy.compute(
          makeReading(180, baseTime + i * 1000),
          state,
          config,
        );
        state = result.nextState;
        bpmHistory.push(state.currentTargetBPM);
      }

      // Verify monotonic decrease
      for (let i = 1; i < bpmHistory.length; i++) {
        expect(bpmHistory[i]).toBeLessThanOrEqual(bpmHistory[i - 1]);
        const step = bpmHistory[i - 1] - bpmHistory[i];
        expect(step).toBeLessThan(20);
      }

      expect(state.currentTargetBPM).toBeLessThan(150);
    });
  });

  describe('responsiveness scaling', () => {
    it('produces larger steps with higher responsiveness', () => {
      const baseConfig = makeConfig({
        dwellTimeMs: 0,
        cooldownSeconds: 0,
        smoothingWindow: 1,
      });

      const lowResponsiveness = {...baseConfig, responsiveness: 0.1};
      const highResponsiveness = {...baseConfig, responsiveness: 1.0};

      const makeState = (): AlgorithmState => ({
        ...strategy.initialState(baseConfig),
        currentMode: 'RAISE',
        modeEnteredAt: Date.now(),
        currentTargetBPM: 150,
        msSinceLastTargetChange: Infinity,
      });

      const reading = makeReading(120, Date.now());

      const lowResult = strategy.compute(reading, makeState(), lowResponsiveness);
      const highResult = strategy.compute(reading, makeState(), highResponsiveness);

      const lowStep = lowResult.nextState.currentTargetBPM - 150;
      const highStep = highResult.nextState.currentTargetBPM - 150;

      expect(highStep).toBeGreaterThan(lowStep);
    });
  });

  describe('cooldown enforcement', () => {
    it('does not emit target before cooldown expires', () => {
      const config = makeConfig({
        cooldownSeconds: 5,
        dwellTimeMs: 0,
        smoothingWindow: 1,
      });

      let state: AlgorithmState = {
        ...strategy.initialState(config),
        currentMode: 'RAISE',
        modeEnteredAt: Date.now(),
        currentTargetBPM: 150,
        msSinceLastTargetChange: 0, // Just changed
      };

      // Reading 1 second later (cooldown not met)
      const result = strategy.compute(
        makeReading(120, Date.now() + 1000),
        state,
        config,
      );

      expect(result.target).toBeNull();
    });

    it('emits target after cooldown expires', () => {
      const config = makeConfig({
        cooldownSeconds: 2,
        dwellTimeMs: 0,
        smoothingWindow: 1,
      });

      let state: AlgorithmState = {
        ...strategy.initialState(config),
        currentMode: 'RAISE',
        modeEnteredAt: Date.now(),
        currentTargetBPM: 150,
        msSinceLastTargetChange: 3000, // 3 seconds since last change
      };

      const result = strategy.compute(
        makeReading(120, Date.now() + 1000),
        state,
        config,
      );

      // Should emit because cooldown (2s) < time since last change (3s+1s)
      expect(result.target).not.toBeNull();
    });
  });

  describe('BPM clamping', () => {
    it('does not exceed maxMusicBPM in RAISE mode', () => {
      const config = makeConfig({
        dwellTimeMs: 0,
        cooldownSeconds: 0,
        smoothingWindow: 1,
        responsiveness: 1.0,
      });

      let state: AlgorithmState = {
        ...strategy.initialState(config),
        currentMode: 'RAISE',
        modeEnteredAt: Date.now(),
        currentTargetBPM: 199,
        msSinceLastTargetChange: Infinity,
      };

      const result = strategy.compute(makeReading(100), state, config);
      expect(result.nextState.currentTargetBPM).toBeLessThanOrEqual(
        config.maxMusicBPM,
      );
    });

    it('does not go below minMusicBPM in LOWER mode', () => {
      const config = makeConfig({
        dwellTimeMs: 0,
        cooldownSeconds: 0,
        smoothingWindow: 1,
        responsiveness: 1.0,
      });

      let state: AlgorithmState = {
        ...strategy.initialState(config),
        currentMode: 'LOWER',
        modeEnteredAt: Date.now(),
        currentTargetBPM: 101,
        msSinceLastTargetChange: Infinity,
      };

      const result = strategy.compute(makeReading(200), state, config);
      expect(result.nextState.currentTargetBPM).toBeGreaterThanOrEqual(
        config.minMusicBPM,
      );
    });
  });
});
