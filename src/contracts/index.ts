/**
 * Contracts — shared types that cross module boundaries.
 *
 * Import from here instead of reaching into module internals:
 *   import type { Result, HeartRateReading, TrackMetadata } from '../contracts';
 *
 * Source-of-truth types stay in their owning modules but are
 * re-exported here for convenience. Result<T> is defined here
 * because it belongs to no single module.
 */

// Cross-cutting
export type {Result} from './results';

// Heart rate
export type {
  HeartRateReading,
  BleDeviceInfo,
  ConnectionState,
  HeartRateServiceInterface,
} from '../modules/heartrate/types';

// Algorithm
export type {
  AlgorithmMode,
  StrategyName,
  HRZone,
  AlgorithmConfig,
  AlgorithmState,
  BPMTarget,
} from '../modules/algorithm/types';

// Music
export type {
  TrackMetadata,
  MusicLibrary,
  PlaybackState,
  TrackSelection,
} from '../modules/music/types';

// Providers
export type {
  TrackProvider,
  TrackProviderInfo,
  ProviderStatus,
} from '../modules/music/providers/types';

// Logging
export type {
  LogEntryType,
  LogEntry,
  TimeSeriesRow,
  SessionMetadata,
  SessionLog,
  ExportFormat,
} from '../modules/logging/types';

// Events
export type {EventMap} from '../core/EventBus.types';
