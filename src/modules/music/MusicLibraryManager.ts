import type {TrackMetadata, MusicLibrary} from './types';

/**
 * Manages the track library and builds the BPM index.
 * For v1, tracks are loaded from a provided list (user imports or pre-configured).
 * Future versions can scan the file system or query a streaming API.
 */
export class MusicLibraryManager {
  private library: MusicLibrary = {
    tracks: [],
    bpmIndex: new Map(),
    lastUpdated: 0,
  };

  getLibrary(): MusicLibrary {
    return this.library;
  }

  /** Load tracks from a provided array (e.g., from settings or file scan) */
  loadTracks(tracks: TrackMetadata[]): void {
    this.library = {
      tracks: [...tracks],
      bpmIndex: this.buildBpmIndex(tracks),
      lastUpdated: Date.now(),
    };
  }

  /** Add a single track to the library */
  addTrack(track: TrackMetadata): void {
    this.library.tracks.push(track);
    this.library.bpmIndex = this.buildBpmIndex(this.library.tracks);
    this.library.lastUpdated = Date.now();
  }

  /** Remove a track by ID */
  removeTrack(trackId: string): void {
    this.library.tracks = this.library.tracks.filter(t => t.id !== trackId);
    this.library.bpmIndex = this.buildBpmIndex(this.library.tracks);
    this.library.lastUpdated = Date.now();
  }

  private buildBpmIndex(tracks: TrackMetadata[]): Map<number, string[]> {
    const index = new Map<number, string[]>();
    for (const track of tracks) {
      const bpm = Math.round(track.bpm);
      const existing = index.get(bpm) ?? [];
      existing.push(track.id);
      index.set(bpm, existing);
    }
    return index;
  }
}
