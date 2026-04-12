import {
  auth as SpotifyAuth,
  ApiScope,
} from 'react-native-spotify-remote';
import type SpotifyApiConfig from 'react-native-spotify-remote/dist/ApiConfig';
import {SPOTIFY_CLIENT_ID, SPOTIFY_REDIRECT_URL} from '../../../../config/env';
import {eventBus} from '../../../../core/EventBus';
import type {TrackMetadata} from '../../types';
import type {
  TrackProvider,
  TrackProviderInfo,
  ProviderStatus,
  Result,
} from '../types';
import {lookupBPMBatch} from './SoundNetClient';
import type {TrackIdentifier} from './SoundNetClient';
import * as WebPlayback from './SpotifyWebPlayback';

const SPOTIFY_CONFIG: SpotifyApiConfig = {
  clientID: SPOTIFY_CLIENT_ID,
  redirectURL: SPOTIFY_REDIRECT_URL,
  scopes: [
    ApiScope.AppRemoteControlScope,
    ApiScope.UserLibraryReadScope,
    ApiScope.UserReadPlaybackStateScope,
    ApiScope.UserReadCurrentlyPlayingScope,
    ApiScope.UserModifyPlaybackStateScope,
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
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private currentTrackId: string | null = null;

  getStatus(): ProviderStatus {
    return this.status;
  }

  async isAvailable(): Promise<Result<boolean>> {
    if (!SPOTIFY_CLIENT_ID) {
      return {ok: true, data: false};
    }

    try {
      console.log('[Spotify] Authorizing...');
      const session = await SpotifyAuth.authorize(SPOTIFY_CONFIG);
      console.log('[Spotify] Auth result:', JSON.stringify(session));

      // The native module returns NSNull (→ undefined/null in JS) when
      // the session has no refreshToken, which happens without a token
      // swap server. Fall back to getSession() to retrieve the token.
      let token: string | undefined;
      if (session && typeof session === 'object' && session.accessToken) {
        token = session.accessToken;
      } else {
        console.log('[Spotify] authorize returned no session, trying getSession...');
        const existing = await SpotifyAuth.getSession();
        token = existing?.accessToken;
      }

      if (!token) {
        return {ok: false, error: 'Spotify auth succeeded but no access token returned'};
      }

      console.log('[Spotify] Auth success');
      this.accessToken = token;

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
      console.log('[Spotify] Fetching user library...');
      const spotifyTracks = await this.fetchUserLibrary();
      console.log(`[Spotify] Got ${spotifyTracks.length} tracks from library`);
      console.log('[Spotify] Looking up BPM data...');

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
    if (!this.accessToken) {
      return {ok: false, error: 'Not authenticated'};
    }

    const device = await WebPlayback.ensureActiveDevice(this.accessToken);
    if (!device.ok) {
      console.log(`[Spotify] No active device: ${device.error}`);
      return {ok: false, error: device.error};
    }

    const uri = typeof track.url === 'string' ? track.url : '';
    const result = await WebPlayback.play(this.accessToken, uri);
    if (result.ok) {
      this.currentTrackId = track.id;
      this.startPolling();
    }
    return result;
  }

  async pause(): Promise<Result<void>> {
    if (!this.accessToken) {
      return {ok: false, error: 'Not authenticated'};
    }
    return WebPlayback.pause(this.accessToken);
  }

  async resume(): Promise<Result<void>> {
    if (!this.accessToken) {
      return {ok: false, error: 'Not authenticated'};
    }
    return WebPlayback.resume(this.accessToken);
  }

  async stop(): Promise<Result<void>> {
    this.stopPolling();
    if (!this.accessToken) {
      return {ok: false, error: 'Not authenticated'};
    }
    return WebPlayback.pause(this.accessToken);
  }

  async getPosition(): Promise<
    Result<{positionSeconds: number; durationSeconds: number}>
  > {
    if (!this.accessToken) {
      return {ok: false, error: 'Not authenticated'};
    }

    const state = await WebPlayback.getPlaybackState(this.accessToken);
    if (!state.ok) {
      return {ok: false, error: state.error};
    }

    return {
      ok: true,
      data: {
        positionSeconds: state.data.progressMs / 1000,
        durationSeconds: state.data.durationMs / 1000,
      },
    };
  }

  async destroy(): Promise<void> {
    this.stopPolling();
    try {
      await SpotifyAuth.endSession();
    } catch {
      // Best effort cleanup
    }
    this.status = 'idle';
    this.accessToken = null;
    this.tracks = [];
    this.currentTrackId = null;
  }

  private startPolling(): void {
    this.stopPolling();
    this.pollInterval = setInterval(async () => {
      if (!this.accessToken) {
        return;
      }
      try {
        const state = await WebPlayback.getPlaybackState(this.accessToken);
        if (!state.ok) {
          return;
        }
        const nearEnd =
          state.data.progressMs >= state.data.durationMs - 1000;
        if (nearEnd && !state.data.isPlaying && this.currentTrackId) {
          this.stopPolling();
          eventBus.emit('music:trackEnded', {trackId: this.currentTrackId});
        }
      } catch {
        // Ignore polling errors — next tick will retry
      }
    }, 2000);
  }

  private stopPolling(): void {
    if (this.pollInterval !== null) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private async fetchUserLibrary(): Promise<SpotifyLibraryTrack[]> {
    if (!this.accessToken) {
      return [];
    }

    const allTracks: SpotifyLibraryTrack[] = [];
    let offset = 0;
    const limit = 50;
    const maxTracks = 20;

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
