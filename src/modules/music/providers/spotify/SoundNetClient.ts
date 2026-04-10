import {RAPIDAPI_KEY} from '../../../../config/env';
import type {Result} from '../types';
import {getCached, setCached} from './BPMCache';

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
    console.log(`[SoundNet] Fetching BPM for "${track.title}" (${track.id})`);
    const url = `${SOUNDNET_BASE_URL}/pktx/spotify/${track.id}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': SOUNDNET_HOST,
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (response.status === 429) {
      // Rate limited — wait and retry once
      await new Promise<void>(r => setTimeout(r, 3000));
      clearTimeout(timer);
      const retryController = new AbortController();
      const retryTimer = setTimeout(() => retryController.abort(), 5000);
      const retryResponse = await fetch(url, {
        method: 'GET',
        headers: {
          'x-rapidapi-key': RAPIDAPI_KEY,
          'x-rapidapi-host': SOUNDNET_HOST,
        },
        signal: retryController.signal,
      });
      clearTimeout(retryTimer);
      if (!retryResponse.ok) {
        return {ok: false, error: `SoundNet API error: ${retryResponse.status}`};
      }
      const retryData: SoundNetTrackAnalysis = await retryResponse.json();
      return {ok: true, data: {trackId: track.id, bpm: Math.round(retryData.tempo)}};
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.log(`[SoundNet] ${response.status} for "${track.title}" by "${track.artist}": ${body.slice(0, 200)}`);
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

const BATCH_SIZE = 1;
const BATCH_DELAY_MS = 1500;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function lookupBPMBatch(
  tracks: TrackIdentifier[],
): Promise<Map<string, number>> {
  const bpmMap = new Map<string, number>();

  const allIds = tracks.map(t => t.id);
  const cached = await getCached(allIds);
  for (const [id, bpm] of cached) {
    bpmMap.set(id, bpm);
  }

  const uncached = tracks.filter(t => !cached.has(t.id));
  console.log(`[SoundNet] ${cached.size} cached, ${uncached.length} to look up`);

  let successCount = 0;
  let failCount = 0;
  const newEntries = new Map<string, number>();
  for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
    if (i > 0) {
      await delay(BATCH_DELAY_MS);
    }

    const batch = uncached.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(t => lookupBPM(t)),
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.ok) {
        const {trackId, bpm} = result.value.data;
        bpmMap.set(trackId, bpm);
        newEntries.set(trackId, bpm);
        successCount++;
      } else {
        failCount++;
        if (failCount <= 5) {
          const reason = result.status === 'fulfilled' ? (result.value as {ok: false; error: string}).error : result.reason;
          console.log(`[SoundNet] Lookup failed: ${reason}`);
        }
      }
    }
    const processed = i + batch.length;
    if (processed % 50 === 0 || processed === uncached.length) {
      console.log(`[SoundNet] Progress: ${processed}/${uncached.length} (${successCount} ok, ${failCount} fail)`);
    }
  }
  console.log(`[SoundNet] Done: ${successCount} succeeded, ${failCount} failed`);

  if (newEntries.size > 0) {
    await setCached(newEntries);
  }

  return bpmMap;
}
