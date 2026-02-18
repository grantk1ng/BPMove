import type {StrategyName} from '../types';
import type {AlgorithmStrategy} from './types';
import {LinearStrategy} from './LinearStrategy';

const strategyMap: Record<StrategyName, () => AlgorithmStrategy> = {
  linear: () => new LinearStrategy(),
};

export function getStrategy(name: StrategyName): AlgorithmStrategy {
  const factory = strategyMap[name];
  if (!factory) {
    throw new Error(`Unknown strategy: ${name}`);
  }
  return factory();
}
