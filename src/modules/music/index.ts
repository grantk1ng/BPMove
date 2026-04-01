export type {
  TrackMetadata,
  MusicLibrary,
  PlaybackState,
  TrackSelection,
} from './types';
export {selectTrack} from './TrackSelector';
export {MusicPlayerService} from './MusicPlayerService';
export {MusicLibraryManager} from './MusicLibraryManager';
export type {
  TrackProvider,
  TrackProviderInfo,
  ProviderStatus,
  Result,
} from './providers/types';
export {LocalTrackProvider} from './providers/LocalTrackProvider';
export {SpotifyTrackProvider} from './providers/spotify/SpotifyTrackProvider';
export {TrackProviderManager} from './providers/TrackProviderManager';
