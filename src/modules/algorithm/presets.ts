import type {HRZone, AlgorithmConfig} from './types';

export const HR_ZONE_PRESETS: HRZone[] = [
  {name: 'Zone 2 (Easy)', minBPM: 130, maxBPM: 150, color: '#4CAF50'},
  {name: 'Zone 3 (Tempo)', minBPM: 150, maxBPM: 170, color: '#FF9800'},
  {name: 'Zone 4 (Threshold)', minBPM: 170, maxBPM: 185, color: '#F44336'},
];

export function createDefaultConfig(
  targetZone: HRZone = HR_ZONE_PRESETS[0],
): AlgorithmConfig {
  return {
    targetZone,
    minMusicBPM: 100,
    maxMusicBPM: 200,
    responsiveness: 0.5,
    cooldownSeconds: 5,
    smoothingWindow: 5,
    strategyName: 'linear',
    dwellTimeMs: 5000,
    returnToMaintainMs: 3000,
  };
}
