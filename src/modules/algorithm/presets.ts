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

export function calculateZonesFromAge(age: number): typeof HR_ZONE_PRESETS {
  const maxHR = 220 - age;
  return [
    {
      name: 'Zone 2 (Easy)',
      minBPM: Math.round(maxHR * 0.6),
      maxBPM: Math.round(maxHR * 0.7),
      color: '#4CAF50',
    },
    {
      name: 'Zone 3 (Tempo)',
      minBPM: Math.round(maxHR * 0.7),
      maxBPM: Math.round(maxHR * 0.8),
      color: '#FF9800',
    },
    {
      name: 'Zone 4 (Threshold)',
      minBPM: Math.round(maxHR * 0.8),
      maxBPM: Math.round(maxHR * 0.9),
      color: '#F44336',
    },
  ];
}
