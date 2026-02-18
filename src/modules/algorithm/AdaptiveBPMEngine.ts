import {eventBus} from '../../core/EventBus';
import type {HeartRateReading} from '../heartrate/types';
import type {
  AlgorithmConfig,
  AlgorithmState,
  StrategyName,
} from './types';
import type {AlgorithmStrategy} from './strategies/types';
import {getStrategy} from './strategies';

export class AdaptiveBPMEngine {
  private strategy: AlgorithmStrategy;
  private state: AlgorithmState;
  private config: AlgorithmConfig;
  private unsubscribe: (() => void) | null = null;

  constructor(config: AlgorithmConfig) {
    this.config = config;
    this.strategy = getStrategy(config.strategyName);
    this.state = this.strategy.initialState(config);
  }

  start(): void {
    this.unsubscribe = eventBus.on('hr:reading', this.onHeartRateReading);
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  getState(): AlgorithmState {
    return this.state;
  }

  getConfig(): AlgorithmConfig {
    return this.config;
  }

  updateConfig(config: AlgorithmConfig): void {
    this.config = config;
    if (config.strategyName !== this.strategy.name) {
      this.setStrategy(config.strategyName);
    }
  }

  setStrategy(name: StrategyName): void {
    this.strategy = getStrategy(name);
    this.state = this.strategy.initialState(this.config);
  }

  destroy(): void {
    this.stop();
  }

  private onHeartRateReading = (reading: HeartRateReading): void => {
    const previousMode = this.state.currentMode;
    const result = this.strategy.compute(reading, this.state, this.config);
    this.state = result.nextState;

    // Emit mode change if mode transitioned
    if (result.nextState.currentMode !== previousMode) {
      eventBus.emit('algo:modeChanged', {
        from: previousMode,
        to: result.nextState.currentMode,
        timestamp: reading.timestamp,
      });
    }

    // Always emit state change
    eventBus.emit('algo:stateChanged', this.state);

    // Emit target if the strategy produced one
    if (result.target) {
      eventBus.emit('algo:target', result.target);
    }
  };
}
