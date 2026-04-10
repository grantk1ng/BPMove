import {
  ensureActiveDevice,
  play,
  pause,
  resume,
  getPlaybackState,
} from '../SpotifyWebPlayback';

const mockFetch = jest.fn();
((globalThis as Record<string, unknown>).fetch as jest.Mock) = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('ensureActiveDevice', () => {
  it('returns active device ID when one exists', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          devices: [{id: 'dev1', is_active: true, name: 'iPhone', type: 'Smartphone'}],
        }),
    });

    const result = await ensureActiveDevice('token');
    expect(result).toEqual({ok: true, data: 'dev1'});
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('transfers to smartphone when no active device', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            devices: [{id: 'dev2', is_active: false, name: 'iPhone', type: 'Smartphone'}],
          }),
      })
      .mockResolvedValueOnce({ok: true, status: 204});

    const result = await ensureActiveDevice('token');
    expect(result).toEqual({ok: true, data: 'dev2'});
    expect(mockFetch).toHaveBeenCalledTimes(2);

    const transferCall = mockFetch.mock.calls[1];
    expect(transferCall[0]).toBe('https://api.spotify.com/v1/me/player');
    expect(transferCall[1].method).toBe('PUT');
    expect(JSON.parse(transferCall[1].body)).toEqual({device_ids: ['dev2'], play: false});
  });

  it('returns error when no devices found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({devices: []}),
    });

    const result = await ensureActiveDevice('token');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('No Spotify devices found');
    }
  });
});

describe('play', () => {
  it('sends PUT with track URI', async () => {
    mockFetch.mockResolvedValueOnce({ok: true, status: 204});

    const result = await play('token', 'spotify:track:abc');
    expect(result).toEqual({ok: true, data: undefined});

    const call = mockFetch.mock.calls[0];
    expect(call[0]).toBe('https://api.spotify.com/v1/me/player/play');
    expect(call[1].method).toBe('PUT');
    expect(JSON.parse(call[1].body)).toEqual({uris: ['spotify:track:abc']});
  });

  it('returns error on 404', async () => {
    mockFetch.mockResolvedValueOnce({ok: false, status: 404});

    const result = await play('token', 'spotify:track:abc');
    expect(result).toEqual({ok: false, error: 'No active device'});
  });

  it('returns error on 403', async () => {
    mockFetch.mockResolvedValueOnce({ok: false, status: 403});

    const result = await play('token', 'spotify:track:abc');
    expect(result).toEqual({ok: false, error: 'Premium required'});
  });
});

describe('pause', () => {
  it('sends PUT to pause endpoint', async () => {
    mockFetch.mockResolvedValueOnce({ok: true, status: 204});

    const result = await pause('token');
    expect(result).toEqual({ok: true, data: undefined});
    expect(mockFetch.mock.calls[0][0]).toBe('https://api.spotify.com/v1/me/player/pause');
  });
});

describe('resume', () => {
  it('sends PUT to play endpoint with no body', async () => {
    mockFetch.mockResolvedValueOnce({ok: true, status: 204});

    const result = await resume('token');
    expect(result).toEqual({ok: true, data: undefined});

    const call = mockFetch.mock.calls[0];
    expect(call[0]).toBe('https://api.spotify.com/v1/me/player/play');
    expect(call[1].body).toBeUndefined();
  });
});

describe('getPlaybackState', () => {
  it('parses progress, duration, and isPlaying', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          progress_ms: 45000,
          item: {duration_ms: 210000},
          is_playing: true,
        }),
    });

    const result = await getPlaybackState('token');
    expect(result).toEqual({
      ok: true,
      data: {progressMs: 45000, durationMs: 210000, isPlaying: true},
    });
  });

  it('returns error on 204 (no active playback)', async () => {
    mockFetch.mockResolvedValueOnce({ok: false, status: 204});

    const result = await getPlaybackState('token');
    expect(result.ok).toBe(false);
  });

  it('returns error on 401', async () => {
    mockFetch.mockResolvedValueOnce({ok: false, status: 401});

    const result = await getPlaybackState('token');
    expect(result).toEqual({ok: false, error: 'Token expired'});
  });
});
