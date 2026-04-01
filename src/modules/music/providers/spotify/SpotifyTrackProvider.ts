import {
  auth as SpotifyAuth,
  remote as SpotifyRemote,
  ApiScope,
} from 'react-native-spotify-remote';
import type SpotifyApiConfig from 'react-native-spotify-remote/dist/ApiConfig';
import {SPOTIFY_CLIENT_ID, SPOTIFY_REDIRECT_URL} from '../../../../config/env';
import type {TrackMetadata} from '../../types';
import type {
  TrackProvider,
  TrackProviderInfo,
  ProviderStatus,
  Result,
} from '../types';
import {lookupBPMBatch} from './SoundNetClient';
import type {TrackIdentifier} from './SoundNetClient';

const SPOTIFY_CONFIG: SpotifyApiConfig = {
  clientID: SPOTIFY_CLIENT_ID,
  redirectURL: SPOTIFY_REDIRECT_URL,
  scopes: [
    ApiScope.AppRemoteControlScope,
    ApiScope.UserLibraryReadScope,
    ApiScope.UserReadPlaybackStateScope,
    ApiScope.UserReadCurrentlyPlayingScope,
    ApiScope.PlaylistReadPrivateScope,
  ],
};

const MIN_BPM = 100;
const MAX_BPM = 200;

export class SpotifyTrackProvider implements TrackProvider {
  readonly info: TrackProviderInfo = {name: 'spotify', priority: 0};
  private status: ProviderStatus = 'idle';
  private accessToken: string | null = null;
  private tracks: TrackMetadata[] = [];

  getStatus(): ProviderStatus {
    return this.status;
  }

  async isAvailable(): Promise<Result<boolean>> {
    if (!SPOTIFY_CLIENT_ID) {
      return {ok: true, data: false};
    }

    try {
      const session = await SpotifyAuth.authorize(SPOTIFY_CONFIG);
      this.accessToken = session.accessToken;
      await SpotifyRemote.connect(session.accessToken);
      return {ok: true, data: true};
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return {ok: false, error: `Spotify auth failed: ${message}`};
    }
  }

  async loadTracks(): Promise<Result<TrackMetadata[]>> {
    if (!this.accessToken) {
      return {ok: false, error: 'Not authenticated with Spotify'};
    }

    this.status = 'loading';

    try {
      const spotifyTracks = await this.fetchUserLibrary();

      if (spotifyTracks.length === 0) {
        this.status = 'error';
        return {ok: false, error: 'No tracks found in Spotify library'};
      }

      const trackIdentifiers: TrackIdentifier[] = spotifyTracks.map(t => ({
        id: t.id,
        title: t.name,
        artist: t.artists[0]?.name ?? 'Unknown',
      }));
      const bpmMap = await lookupBPMBatch(trackIdentifiers);

      this.tracks = spotifyTracks
        .filter(t => bpmMap.has(t.id))
        .map(t => {
          const bpm = bpmMap.get(t.id)!;
          return {
            id: `spotify:${t.id}`,
            title: t.name,
            artist: t.artists[0]?.name ?? 'Unknown',
            album: t.album.name,
            durationSeconds: Math.round(t.duration_ms / 1000),
            bpm,
            url: t.uri,
            artworkUrl: t.album.images[0]?.url ?? null,
            genre: null,
          };
        })
        .filter(t => t.bpm >= MIN_BPM && t.bpm <= MAX_BPM);

      this.status = 'ready';
      return {ok: true, data: this.tracks};
    } catch (err) {
      this.status = 'error';
      const message = err instanceof Error ? err.message : 'Unknown error';
      return {ok: false, error: `Failed to load Spotify tracks: ${message}`};
    }
  }

  async playTrack(track: TrackMetadata): Promise<Result<void>> {
    try {
      const uri = typeof track.url === 'string' ? track.url : '';
      await SpotifyRemote.playUri(uri);
      return {ok: true, data: undefined};
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return {ok: false, error: `Spotify playback failed: ${message}`};
    }
  }

  async pause(): Promise<Result<void>> {
    try {
      await SpotifyRemote.pause();
      return {ok: true, data: undefined};
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return {ok: false, error: `Spotify pause failed: ${message}`};
    }
  }

  async resume(): Promise<Result<void>> {
    try {
      await SpotifyRemote.resume();
      return {ok: true, data: undefined};
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return {ok: false, error: `Spotify resume failed: ${message}`};
    }
  }

  async stop(): Promise<Result<void>> {
    try {
      await SpotifyRemote.pause();
      return {ok: true, data: undefined};
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return {ok: false, error: `Spotify stop failed: ${message}`};
    }
  }

  async getPosition(): Promise<
    Result<{positionSeconds: number; durationSeconds: number}>
  > {
    try {
      const state = await SpotifyRemote.getPlayerState();
      return {
        ok: true,
        data: {
          positionSeconds: state.playbackPosition / 1000,
          durationSeconds: state.track.duration / 1000,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return {ok: false, error: `Position query failed: ${message}`};
    }
  }

  async destroy(): Promise<void> {
    try {
      await SpotifyRemote.disconnect();
      await SpotifyAuth.endSession();
    } catch {
      // Best effort cleanup
    }
    this.status = 'idle';
    this.accessToken = null;
    this.tracks = [];
  }

  private async fetchUserLibrary(): Promise<SpotifyLibraryTrack[]> {
    if (!this.accessToken) {
      return [];
    }

    const allTracks: SpotifyLibraryTrack[] = [];
    let offset = 0;
    const limit = 50;
    const maxTracks = 500;

    while (offset < maxTracks) {
      const response = await fetch(
        `https://api.spotify.com/v1/me/tracks?limit=${limit}&offset=${offset}`,
        {
          headers: {Authorization: `Bearer ${this.accessToken}`},
        },
      );

      if (!response.ok) {
        break;
      }

      const data: SpotifyPaginatedResponse = await response.json();
      allTracks.push(...data.items.map(item => item.track));

      if (!data.next) {
        break;
      }

      offset += limit;
    }

    return allTracks;
  }
}

interface SpotifyArtist {
  name: string;
}

interface SpotifyAlbumImage {
  url: string;
  height: number;
  width: number;
}

interface SpotifyAlbum {
  name: string;
  images: SpotifyAlbumImage[];
}

interface SpotifyLibraryTrack {
  id: string;
  name: string;
  uri: string;
  duration_ms: number;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
}

interface SpotifyPaginatedResponse {
  items: {track: SpotifyLibraryTrack}[];
  next: string | null;
  total: number;
}
