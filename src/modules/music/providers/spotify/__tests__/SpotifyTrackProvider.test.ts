import {auth as SpotifyAuth} from 'react-native-spotify-remote';
import {SpotifyTrackProvider} from '../SpotifyTrackProvider';
import * as WebPlayback from '../SpotifyWebPlayback';
import {eventBus} from '../../../../../core/EventBus';

jest.mock('../../../../../config/env', () => ({
  SPOTIFY_CLIENT_ID: 'test-client-id',
  SPOTIFY_REDIRECT_URL: 'bpmove://spotify-callback',
  RAPIDAPI_KEY: 'test-rapidapi-key',
}));

jest.mock('../SoundNetClient', () => ({
  lookupBPMBatch: jest.fn().mockResolvedValue(
    new Map([
      ['track1', 130],
      ['track2', 145],
      ['track3', 250], // out of range
    ]),
  ),
}));

jest.mock('../SpotifyWebPlayback', () => ({
  ensureActiveDevice: jest.fn().mockResolvedValue({ok: true, data: 'device-1'}),
  play: jest.fn().mockResolvedValue({ok: true, data: undefined}),
  pause: jest.fn().mockResolvedValue({ok: true, data: undefined}),
  resume: jest.fn().mockResolvedValue({ok: true, data: undefined}),
  getPlaybackState: jest.fn().mockResolvedValue({
    ok: true,
    data: {progressMs: 0, durationMs: 210000, isPlaying: true},
  }),
}));

const mockSpotifyLibraryResponse = {
  items: [
    {
      track: {
        id: 'track1',
        name: 'Running Song',
        uri: 'spotify:track:track1',
        duration_ms: 210000,
        artists: [{name: 'Artist A'}],
        album: {name: 'Album A', images: [{url: 'https://img/a', height: 300, width: 300}]},
      },
    },
    {
      track: {
        id: 'track2',
        name: 'Workout Jam',
        uri: 'spotify:track:track2',
        duration_ms: 195000,
        artists: [{name: 'Artist B'}],
        album: {name: 'Album B', images: [{url: 'https://img/b', height: 300, width: 300}]},
      },
    },
    {
      track: {
        id: 'track3',
        name: 'Too Fast',
        uri: 'spotify:track:track3',
        duration_ms: 180000,
        artists: [{name: 'Artist C'}],
        album: {name: 'Album C', images: []},
      },
    },
  ],
  next: null,
  total: 3,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockSpotifyLibraryResponse),
  });
});

afterEach(() => {
  jest.useRealTimers();
  eventBus.removeAllListeners();
});

describe('SpotifyTrackProvider', () => {
  describe('isAvailable', () => {
    it('returns false when SPOTIFY_CLIENT_ID is empty', async () => {
      const envModule = require('../../../../../config/env');
      const original = envModule.SPOTIFY_CLIENT_ID;
      Object.defineProperty(envModule, 'SPOTIFY_CLIENT_ID', {value: '', writable: true});
      const provider = new SpotifyTrackProvider();
      const result = await provider.isAvailable();
      expect(result).toEqual({ok: true, data: false});
      Object.defineProperty(envModule, 'SPOTIFY_CLIENT_ID', {value: original, writable: true});
    });

    it('returns true when auth and device check succeed', async () => {
      const provider = new SpotifyTrackProvider();
      const result = await provider.isAvailable();
      expect(result).toEqual({ok: true, data: true});
      expect(SpotifyAuth.authorize).toHaveBeenCalled();
      expect(WebPlayback.ensureActiveDevice).toHaveBeenCalledWith('mock-token');
    });

    it('returns error when auth throws', async () => {
      (SpotifyAuth.authorize as jest.Mock).mockRejectedValueOnce(
        new Error('Auth dialog cancelled'),
      );
      const provider = new SpotifyTrackProvider();
      const result = await provider.isAvailable();
      expect(result).toEqual({
        ok: false,
        error: 'Spotify auth failed: Auth dialog cancelled',
      });
    });

    it('returns error when no device available', async () => {
      (WebPlayback.ensureActiveDevice as jest.Mock).mockResolvedValueOnce({
        ok: false,
        error: 'No Spotify devices found. Open Spotify on your phone.',
      });
      const provider = new SpotifyTrackProvider();
      const result = await provider.isAvailable();
      expect(result).toEqual({
        ok: false,
        error: 'No Spotify devices found. Open Spotify on your phone.',
      });
    });
  });

  describe('loadTracks', () => {
    it('returns error when not authenticated', async () => {
      const provider = new SpotifyTrackProvider();
      const result = await provider.loadTracks();
      expect(result).toEqual({ok: false, error: 'Not authenticated with Spotify'});
    });

    it('fetches library, looks up BPM, filters by range', async () => {
      const provider = new SpotifyTrackProvider();
      await provider.isAvailable();
      const result = await provider.loadTracks();

      expect(result.ok).toBe(true);
      if (!result.ok) {return;}

      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe('spotify:track1');
      expect(result.data[0].bpm).toBe(130);
      expect(result.data[1].id).toBe('spotify:track2');
      expect(result.data[1].bpm).toBe(145);
      expect(provider.getStatus()).toBe('ready');
    });
  });

  describe('playTrack', () => {
    it('calls WebPlayback.play with track URI', async () => {
      const provider = new SpotifyTrackProvider();
      await provider.isAvailable();
      const track = {
        id: 'spotify:track1',
        title: 'Running Song',
        artist: 'Artist A',
        album: 'Album A',
        durationSeconds: 210,
        bpm: 130,
        url: 'spotify:track:track1',
        artworkUrl: null,
        genre: null,
      };
      const result = await provider.playTrack(track);
      expect(result).toEqual({ok: true, data: undefined});
      expect(WebPlayback.play).toHaveBeenCalledWith('mock-token', 'spotify:track:track1');
    });
  });

  describe('pause / resume / stop', () => {
    let provider: SpotifyTrackProvider;

    beforeEach(async () => {
      provider = new SpotifyTrackProvider();
      await provider.isAvailable();
    });

    it('pause calls WebPlayback.pause', async () => {
      const result = await provider.pause();
      expect(result).toEqual({ok: true, data: undefined});
      expect(WebPlayback.pause).toHaveBeenCalledWith('mock-token');
    });

    it('resume calls WebPlayback.resume', async () => {
      const result = await provider.resume();
      expect(result).toEqual({ok: true, data: undefined});
      expect(WebPlayback.resume).toHaveBeenCalledWith('mock-token');
    });

    it('stop calls WebPlayback.pause', async () => {
      const result = await provider.stop();
      expect(result).toEqual({ok: true, data: undefined});
      expect(WebPlayback.pause).toHaveBeenCalledWith('mock-token');
    });
  });

  describe('track-ended polling', () => {
    it('emits music:trackEnded when track reaches end', async () => {
      const provider = new SpotifyTrackProvider();
      await provider.isAvailable();

      const handler = jest.fn();
      eventBus.on('music:trackEnded', handler);

      await provider.playTrack({
        id: 'spotify:track1',
        title: 'Running Song',
        artist: 'Artist A',
        album: 'Album A',
        durationSeconds: 210,
        bpm: 130,
        url: 'spotify:track:track1',
        artworkUrl: null,
        genre: null,
      });

      // First poll: mid-track
      (WebPlayback.getPlaybackState as jest.Mock).mockResolvedValueOnce({
        ok: true,
        data: {progressMs: 100000, durationMs: 210000, isPlaying: true},
      });
      jest.advanceTimersByTime(2000);
      await Promise.resolve();
      expect(handler).not.toHaveBeenCalled();

      // Second poll: near end and not playing
      (WebPlayback.getPlaybackState as jest.Mock).mockResolvedValueOnce({
        ok: true,
        data: {progressMs: 209500, durationMs: 210000, isPlaying: false},
      });
      jest.advanceTimersByTime(2000);
      await jest.runAllTimersAsync();

      expect(handler).toHaveBeenCalledWith({trackId: 'spotify:track1'});
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('does not emit when paused mid-track', async () => {
      const provider = new SpotifyTrackProvider();
      await provider.isAvailable();

      const handler = jest.fn();
      eventBus.on('music:trackEnded', handler);

      await provider.playTrack({
        id: 'spotify:track1',
        title: 'Running Song',
        artist: 'Artist A',
        album: 'Album A',
        durationSeconds: 210,
        bpm: 130,
        url: 'spotify:track:track1',
        artworkUrl: null,
        genre: null,
      });

      (WebPlayback.getPlaybackState as jest.Mock).mockResolvedValueOnce({
        ok: true,
        data: {progressMs: 50000, durationMs: 210000, isPlaying: false},
      });
      jest.advanceTimersByTime(2000);
      await Promise.resolve();
      await Promise.resolve();

      expect(handler).not.toHaveBeenCalled();

      await provider.destroy();
    });
  });

  describe('destroy', () => {
    it('ends session and clears state', async () => {
      const provider = new SpotifyTrackProvider();
      await provider.isAvailable();
      await provider.loadTracks();

      await provider.destroy();

      expect(SpotifyAuth.endSession).toHaveBeenCalled();
      expect(provider.getStatus()).toBe('idle');
    });
  });
});
