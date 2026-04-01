import {RAPIDAPI_KEY} from '../../../../config/env';
import type {Result} from '../types';

const SOUNDNET_HOST = 'track-analysis.p.rapidapi.com';
const SOUNDNET_BASE_URL = `https://${SOUNDNET_HOST}`;

interface SoundNetTrackAnalysis {
  id: string;
  key: string;
  mode: string;
  camelot: string;
  tempo: number;
  duration: string;
  popularity: number;
  energy: number;
  danceability: number;
  happiness: number;
  acousticness: number;
  instrumentalness: number;
  liveness: number;
  speechiness: number;
  loudness: string;
}

export interface BPMLookupResult {
  trackId: string;
  bpm: number;
}

export interface TrackIdentifier {
  id: string;
  title: string;
  artist: string;
}

export async function lookupBPM(
  track: TrackIdentifier,
): Promise<Result<BPMLookupResult>> {
  if (!RAPIDAPI_KEY) {
    return {ok: false, error: 'RAPIDAPI_KEY not configured'};
  }

  try {
    const params = new URLSearchParams({
      song: track.title,
      artist: track.artist,
    });

    const response = await fetch(
      `${SOUNDNET_BASE_URL}/pktx/rapid?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'x-rapidapi-key': RAPIDAPI_KEY,
          'x-rapidapi-host': SOUNDNET_HOST,
        },
      },
    );

    if (!response.ok) {
      return {ok: false, error: `SoundNet API error: ${response.status}`};
    }

    const data: SoundNetTrackAnalysis = await response.json();

    return {
      ok: true,
      data: {
        trackId: track.id,
        bpm: Math.round(data.tempo),
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {ok: false, error: `BPM lookup failed: ${message}`};
  }
}

export async function lookupBPMBatch(
  tracks: TrackIdentifier[],
): Promise<Map<string, number>> {
  const bpmMap = new Map<string, number>();

  const BATCH_SIZE = 5;
  for (let i = 0; i < tracks.length; i += BATCH_SIZE) {
    const batch = tracks.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(t => lookupBPM(t)),
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.ok) {
        bpmMap.set(result.value.data.trackId, result.value.data.bpm);
      }
    }
  }

  return bpmMap;
}
