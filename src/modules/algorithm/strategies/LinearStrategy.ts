import type {HeartRateReading} from '../../heartrate/types';
import type {
  AlgorithmState,
  AlgorithmConfig,
  BPMTarget,
  AlgorithmMode,
} from '../types';
import type {AlgorithmStrategy} from './types';

function computeSmoothedHR(
  hrHistory: HeartRateReading[],
): number {
  if (hrHistory.length === 0) {
    return 0;
  }
  const sum = hrHistory.reduce((acc, r) => acc + r.bpm, 0);
  return sum / hrHistory.length;
}

function classifyZonePosition(
  smoothedHR: number,
  config: AlgorithmConfig,
): 'below' | 'in_zone' | 'above' {
  if (smoothedHR < config.targetZone.minBPM) {
    return 'below';
  }
  if (smoothedHR > config.targetZone.maxBPM) {
    return 'above';
  }
  return 'in_zone';
}

function getTimeDelta(
  current: HeartRateReading,
  previous: HeartRateReading | undefined,
): number {
  if (!previous) {
    return 0;
  }
  return current.timestamp - previous.timestamp;
}

export class LinearStrategy implements AlgorithmStrategy {
  readonly name = 'linear' as const;

  initialState(config: AlgorithmConfig): AlgorithmState {
    const zoneMid =
      (config.targetZone.minBPM + config.targetZone.maxBPM) / 2;
    const bpmRange = config.maxMusicBPM - config.minMusicBPM;
    const neutralBPM = config.minMusicBPM + bpmRange / 2;

    return {
      currentMode: 'MAINTAIN',
      modeEnteredAt: Date.now(),
      smoothedHR: zoneMid,
      hrHistory: [],
      consecutiveOutOfZoneMs: 0,
      currentTargetBPM: neutralBPM,
      msSinceLastTargetChange: Infinity,
    };
  }

  compute(
    reading: HeartRateReading,
    state: AlgorithmState,
    config: AlgorithmConfig,
  ): {nextState: AlgorithmState; target: BPMTarget | null} {
    // Update HR history buffer
    const hrHistory = [...state.hrHistory, reading].slice(
      -config.smoothingWindow,
    );
    const previousReading = state.hrHistory[state.hrHistory.length - 1];
    const timeDeltaMs = getTimeDelta(reading, previousReading);

    // Compute smoothed HR
    const smoothedHR = computeSmoothedHR(hrHistory);

    // Classify current zone position
    const zonePosition = classifyZonePosition(smoothedHR, config);

    // Update consecutive out-of-zone time
    let consecutiveOutOfZoneMs = state.consecutiveOutOfZoneMs;
    if (zonePosition === 'in_zone') {
      consecutiveOutOfZoneMs = 0;
    } else {
      consecutiveOutOfZoneMs += timeDeltaMs;
    }

    // Track time since last target change
    const msSinceLastTargetChange = state.msSinceLastTargetChange + timeDeltaMs;

    // Evaluate mode transitions with hysteresis
    let currentMode: AlgorithmMode = state.currentMode;

    if (state.currentMode === 'MAINTAIN') {
      // Transition out of MAINTAIN requires dwellTimeMs of sustained out-of-zone
      if (
        zonePosition === 'above' &&
        consecutiveOutOfZoneMs >= config.dwellTimeMs
      ) {
        currentMode = 'LOWER';
      } else if (
        zonePosition === 'below' &&
        consecutiveOutOfZoneMs >= config.dwellTimeMs
      ) {
        currentMode = 'RAISE';
      }
    } else {
      // Transition back to MAINTAIN requires returnToMaintainMs of sustained in-zone
      if (zonePosition === 'in_zone') {
        // Use consecutiveOutOfZoneMs as 0 to track in-zone time
        // We need a separate counter for in-zone dwell — reuse the fact that
        // consecutiveOutOfZoneMs is 0 when in zone. We need time tracking.
        // Since consecutiveOutOfZoneMs resets to 0 on in_zone, we track by
        // checking how long we've been in_zone via the state's modeEnteredAt.
        // Actually, let's track this properly: if we're in a RAISE/LOWER mode
        // and HR has been in-zone, we check how long ago consecutiveOutOfZoneMs
        // was last non-zero. Simpler: track consecutive in-zone time separately.
        // For now, if we've been in_zone for the full hrHistory window, transition.

        // Calculate how long HR has been in zone by checking if all recent readings
        // within returnToMaintainMs are in zone
        const returnThreshold = config.returnToMaintainMs;
        const inZoneDuration = this.getConsecutiveInZoneDuration(
          hrHistory,
          config,
        );
        if (inZoneDuration >= returnThreshold) {
          currentMode = 'MAINTAIN';
        }
      }
      // Cross-mode transition (RAISE↔LOWER) if HR swings to other side
      if (
        state.currentMode === 'RAISE' &&
        zonePosition === 'above' &&
        consecutiveOutOfZoneMs >= config.dwellTimeMs
      ) {
        currentMode = 'LOWER';
      } else if (
        state.currentMode === 'LOWER' &&
        zonePosition === 'below' &&
        consecutiveOutOfZoneMs >= config.dwellTimeMs
      ) {
        currentMode = 'RAISE';
      }
    }

    const modeEnteredAt =
      currentMode !== state.currentMode ? reading.timestamp : state.modeEnteredAt;

    // Compute BPM step based on mode
    const zoneMid =
      (config.targetZone.minBPM + config.targetZone.maxBPM) / 2;
    const zoneWidth = config.targetZone.maxBPM - config.targetZone.minBPM;
    const bpmRange = config.maxMusicBPM - config.minMusicBPM;
    const baseStep = bpmRange / 100;
    const errorMagnitude = Math.min(
      Math.abs(smoothedHR - zoneMid) / (zoneWidth / 2),
      2.0,
    );
    const stepSize = baseStep * config.responsiveness * errorMagnitude;

    let nextTargetBPM = state.currentTargetBPM;

    switch (currentMode) {
      case 'RAISE':
        nextTargetBPM = Math.min(
          state.currentTargetBPM + stepSize,
          config.maxMusicBPM,
        );
        break;
      case 'LOWER':
        nextTargetBPM = Math.max(
          state.currentTargetBPM - stepSize,
          config.minMusicBPM,
        );
        break;
      case 'MAINTAIN':
        // Hold steady
        break;
    }

    // Determine if we should emit a new BPMTarget
    const bpmDelta = Math.abs(nextTargetBPM - state.currentTargetBPM);
    const cooldownMs = config.cooldownSeconds * 1000;
    const shouldEmitTarget =
      bpmDelta >= 1 && msSinceLastTargetChange >= cooldownMs;

    const roundedBPM = Math.round(nextTargetBPM);

    const nextState: AlgorithmState = {
      currentMode,
      modeEnteredAt,
      smoothedHR,
      hrHistory,
      consecutiveOutOfZoneMs,
      currentTargetBPM: shouldEmitTarget ? roundedBPM : nextTargetBPM,
      msSinceLastTargetChange: shouldEmitTarget ? 0 : msSinceLastTargetChange,
    };

    let target: BPMTarget | null = null;
    if (shouldEmitTarget) {
      const urgency = Math.min(errorMagnitude / 2, 1.0);
      target = {
        targetBPM: roundedBPM,
        triggeringHR: reading.bpm,
        timestamp: reading.timestamp,
        reason: `Mode ${currentMode}: HR ${Math.round(smoothedHR)} ${
          zonePosition === 'below'
            ? 'below'
            : zonePosition === 'above'
              ? 'above'
              : 'in'
        } zone [${config.targetZone.minBPM}-${config.targetZone.maxBPM}]`,
        urgency,
        mode: currentMode,
      };
    }

    return {nextState, target};
  }

  private getConsecutiveInZoneDuration(
    hrHistory: HeartRateReading[],
    config: AlgorithmConfig,
  ): number {
    if (hrHistory.length < 2) {
      return 0;
    }

    let duration = 0;
    // Walk backwards through history
    for (let i = hrHistory.length - 1; i > 0; i--) {
      const reading = hrHistory[i];
      if (
        reading.bpm < config.targetZone.minBPM ||
        reading.bpm > config.targetZone.maxBPM
      ) {
        break;
      }
      duration += reading.timestamp - hrHistory[i - 1].timestamp;
    }
    return duration;
  }
}
