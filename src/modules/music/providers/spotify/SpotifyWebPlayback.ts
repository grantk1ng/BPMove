import type {Result} from '../types';

const SPOTIFY_API = 'https://api.spotify.com/v1/me/player';

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

function mapError(status: number): string {
  switch (status) {
    case 401:
      return 'Token expired';
    case 403:
      return 'Premium required';
    case 404:
      return 'No active device';
    default:
      return `Spotify API error: ${status}`;
  }
}

export interface PlaybackState {
  progressMs: number;
  durationMs: number;
  isPlaying: boolean;
  trackUri: string | null;
}

interface SpotifyDevice {
  id: string;
  is_active: boolean;
  name: string;
  type: string;
}

export async function ensureActiveDevice(
  token: string,
): Promise<Result<string>> {
  try {
    const res = await fetch(`${SPOTIFY_API}/devices`, {
      headers: headers(token),
    });

    if (!res.ok) {
      return {ok: false, error: mapError(res.status)};
    }

    const data: {devices: SpotifyDevice[]} = await res.json();

    if (data.devices.length === 0) {
      return {ok: false, error: 'No Spotify devices found. Open Spotify on your phone.'};
    }

    const active = data.devices.find(d => d.is_active);
    if (active) {
      return {ok: true, data: active.id};
    }

    const phone = data.devices.find(d => d.type === 'Smartphone') ?? data.devices[0];

    const transferRes = await fetch(SPOTIFY_API, {
      method: 'PUT',
      headers: headers(token),
      body: JSON.stringify({device_ids: [phone.id], play: false}),
    });

    if (!transferRes.ok && transferRes.status !== 204) {
      return {ok: false, error: `Failed to transfer playback: ${mapError(transferRes.status)}`};
    }

    return {ok: true, data: phone.id};
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {ok: false, error: `Device check failed: ${message}`};
  }
}

export async function play(
  token: string,
  trackUri: string,
): Promise<Result<void>> {
  try {
    const res = await fetch(`${SPOTIFY_API}/play`, {
      method: 'PUT',
      headers: headers(token),
      body: JSON.stringify({uris: [trackUri]}),
    });

    if (res.status === 204 || res.ok) {
      return {ok: true, data: undefined};
    }

    if (res.status === 404) {
      return {ok: false, error: 'No active device'};
    }

    return {ok: false, error: mapError(res.status)};
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {ok: false, error: `Play failed: ${message}`};
  }
}

export async function pause(token: string): Promise<Result<void>> {
  try {
    const res = await fetch(`${SPOTIFY_API}/pause`, {
      method: 'PUT',
      headers: headers(token),
    });

    if (res.status === 204 || res.ok) {
      return {ok: true, data: undefined};
    }

    return {ok: false, error: mapError(res.status)};
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {ok: false, error: `Pause failed: ${message}`};
  }
}

export async function resume(token: string): Promise<Result<void>> {
  try {
    const res = await fetch(`${SPOTIFY_API}/play`, {
      method: 'PUT',
      headers: headers(token),
    });

    if (res.status === 204 || res.ok) {
      return {ok: true, data: undefined};
    }

    return {ok: false, error: mapError(res.status)};
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {ok: false, error: `Resume failed: ${message}`};
  }
}

export async function getPlaybackState(
  token: string,
): Promise<Result<PlaybackState>> {
  try {
    const res = await fetch(SPOTIFY_API, {
      headers: headers(token),
    });

    if (res.status === 204) {
      return {ok: false, error: 'No active playback'};
    }

    if (!res.ok) {
      return {ok: false, error: mapError(res.status)};
    }

    const data = await res.json();

    return {
      ok: true,
      data: {
        progressMs: data.progress_ms ?? 0,
        durationMs: data.item?.duration_ms ?? 0,
        isPlaying: data.is_playing ?? false,
        trackUri: typeof data.item?.uri === 'string' ? data.item.uri : null,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {ok: false, error: `Playback state failed: ${message}`};
  }
}
