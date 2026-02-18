import type {AlgorithmMode} from '../algorithm/types';

/** Union type for all loggable events */
export type LogEntryType =
  | 'hr_reading'
  | 'algorithm_target'
  | 'algorithm_state'
  | 'algorithm_mode_change'
  | 'music_change'
  | 'music_playback'
  | 'session_start'
  | 'session_end'
  | 'device_connected'
  | 'device_disconnected'
  | 'error';

/** A single log entry with full context */
export interface LogEntry {
  timestamp: number;
  type: LogEntryType;
  sessionElapsedMs: number;
  data: Record<string, unknown>;
}

/** One row per HR reading — merged view of all module states for research */
export interface TimeSeriesRow {
  /** Timing */
  timestamp: number;
  sessionElapsedMs: number;

  /** HR data */
  hrBpm: number;
  sensorContact: boolean;
  rrIntervals: number[];

  /** Algorithm state snapshot */
  smoothedHR: number;
  currentMode: AlgorithmMode;
  consecutiveOutOfZoneMs: number;
  currentTargetBPM: number;
  targetZoneMin: number;
  targetZoneMax: number;

  /** Music state (last known — carries forward until changed) */
  currentTrackId: string | null;
  currentTrackTitle: string | null;
  currentTrackBPM: number | null;
  currentTrackArtist: string | null;
}

/** Session-level summary metadata */
export interface SessionMetadata {
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  minHeartRate: number | null;
  totalTracksPlayed: number;
  totalBPMTargetChanges: number;
  timeInZoneMs: number;
  timeAboveZoneMs: number;
  timeBelowZoneMs: number;
}

/** Complete session log for export */
export interface SessionLog {
  sessionId: string;
  startTime: number;
  endTime: number | null;
  durationMs: number;
  algorithmConfig: Record<string, unknown>;
  deviceName: string | null;
  entries: LogEntry[];
  timeSeries: TimeSeriesRow[];
  metadata: SessionMetadata;
}

export type ExportFormat = 'csv_timeseries' | 'csv_events' | 'json';
