import type {HeartRateReading} from '../heartrate/types';

export type AlgorithmMode = 'MAINTAIN' | 'RAISE' | 'LOWER';

export type StrategyName = 'linear';

/** A single HR zone boundary definition */
export interface HRZone {
  name: string;
  minBPM: number;
  maxBPM: number;
  color: string;
}

/** Configuration for the adaptive algorithm */
export interface AlgorithmConfig {
  targetZone: HRZone;
  /** Minimum music BPM the algorithm will output */
  minMusicBPM: number;
  /** Maximum music BPM the algorithm will output */
  maxMusicBPM: number;
  /** How aggressively to adjust (0.0 = gentle, 1.0 = aggressive) */
  responsiveness: number;
  /** Minimum seconds between BPM target changes */
  cooldownSeconds: number;
  /** Number of HR readings in hrHistory buffer for smoothing */
  smoothingWindow: number;
  /** Active strategy name */
  strategyName: StrategyName;
  /** Hysteresis: ms that HR must be continuously out-of-zone before mode transition */
  dwellTimeMs: number;
  /** Hysteresis: ms that HR must be continuously in-zone before transitioning to MAINTAIN */
  returnToMaintainMs: number;
}

/** Algorithm's internal state */
export interface AlgorithmState {
  /** Current mode of the state machine */
  currentMode: AlgorithmMode;
  /** Timestamp (Unix ms) when the current mode was entered */
  modeEnteredAt: number;
  /** Windowed moving average of recent HR */
  smoothedHR: number;
  /** Rolling buffer of recent HR readings for smoothing/trend detection */
  hrHistory: HeartRateReading[];
  /** Milliseconds the smoothed HR has been continuously outside the target zone.
      Resets to 0 when HR re-enters the zone. Used for dwell-time hysteresis. */
  consecutiveOutOfZoneMs: number;
  /** Current target music BPM (persists across readings until changed) */
  currentTargetBPM: number;
  /** Milliseconds since the last BPM target change (for cooldown enforcement) */
  msSinceLastTargetChange: number;
}

/** Output of the algorithm: what music BPM to target */
export interface BPMTarget {
  targetBPM: number;
  triggeringHR: number;
  timestamp: number;
  reason: string;
  urgency: number;
  mode: AlgorithmMode;
}
