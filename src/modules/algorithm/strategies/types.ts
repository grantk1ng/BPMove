import type {HeartRateReading} from '../../heartrate/types';
import type {
  AlgorithmState,
  AlgorithmConfig,
  BPMTarget,
  StrategyName,
} from '../types';

/**
 * Strategy interface — all algorithm strategies must implement this.
 * Strategies are PURE FUNCTIONS wrapped in an object.
 * They receive state + reading, return new state + optional target.
 * NO side effects. NO subscriptions. NO I/O.
 */
export interface AlgorithmStrategy {
  readonly name: StrategyName;

  /**
   * Pure computation: given current state, config, and a new HR reading,
   * compute the next state and optionally a new BPM target.
   */
  compute(
    reading: HeartRateReading,
    state: AlgorithmState,
    config: AlgorithmConfig,
  ): {
    nextState: AlgorithmState;
    target: BPMTarget | null;
  };

  /** Returns the initial state for this strategy. */
  initialState(config: AlgorithmConfig): AlgorithmState;
}
