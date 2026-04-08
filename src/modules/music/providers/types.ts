import type {TrackMetadata} from '../types';
import type {Result} from '../../../contracts/results';

export type {Result} from '../../../contracts/results';

export type ProviderStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'error'
  | 'unavailable';

export interface TrackProviderInfo {
  name: string;
  /** Lower number = higher priority. Spotify = 0, Local = 10. */
  priority: number;
}

export interface TrackProvider {
  readonly info: TrackProviderInfo;

  /** Check if this provider can be used (e.g., Spotify auth valid, local files present) */
  isAvailable(): Promise<Result<boolean>>;

  /** Load tracks and cache BPM data. Called during pre-run loading phase. */
  loadTracks(): Promise<Result<TrackMetadata[]>>;

  /** Current provider status */
  getStatus(): ProviderStatus;

  /** Start playback of a specific track */
  playTrack(track: TrackMetadata): Promise<Result<void>>;

  /** Pause playback */
  pause(): Promise<Result<void>>;

  /** Resume playback */
  resume(): Promise<Result<void>>;

  /** Stop and reset playback */
  stop(): Promise<Result<void>>;

  /** Get current playback position, or null if not playing */
  getPosition(): Promise<
    Result<{positionSeconds: number; durationSeconds: number}>
  >;

  /** Cleanup resources */
  destroy(): Promise<void>;
}
