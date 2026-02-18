/** Metadata for a single music track, indexed for BPM selection */
export interface TrackMetadata {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  durationSeconds: number;
  /** Beats per minute — the critical field for selection */
  bpm: number;
  /** Path or URI to the audio file */
  url: string;
  /** Optional artwork URI */
  artworkUrl: string | null;
  /** Genre tag if available */
  genre: string | null;
}

/** The indexed music library */
export interface MusicLibrary {
  tracks: TrackMetadata[];
  /** Pre-sorted index: BPM bucket → track IDs, for fast lookup */
  bpmIndex: Map<number, string[]>;
  lastUpdated: number;
}

/** Current playback state exposed to the UI and logging */
export interface PlaybackState {
  currentTrack: TrackMetadata | null;
  isPlaying: boolean;
  positionSeconds: number;
  durationSeconds: number;
  targetBPM: number | null;
}

/** Result of track selection — includes reasoning for logging */
export interface TrackSelection {
  track: TrackMetadata;
  actualBPM: number;
  requestedBPM: number;
  bpmDelta: number;
}
