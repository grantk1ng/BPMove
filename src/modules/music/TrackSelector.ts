import type {MusicLibrary, TrackMetadata, TrackSelection} from './types';

const BPM_TOLERANCE = 5;

/**
 * Pure function: selects a track near the target BPM.
 * Avoids recently played tracks when alternatives exist within tolerance.
 */
export function selectTrack(
  targetBPM: number,
  library: MusicLibrary,
  recentTrackIds: string[],
): TrackSelection | null {
  if (library.tracks.length === 0) {
    return null;
  }

  const sorted = [...library.tracks].sort(
    (a, b) => Math.abs(a.bpm - targetBPM) - Math.abs(b.bpm - targetBPM),
  );

  const bestDelta = Math.abs(sorted[0].bpm - targetBPM);
  const tolerance = Math.max(bestDelta, BPM_TOLERANCE);

  const withinTolerance = sorted.filter(
    t => Math.abs(t.bpm - targetBPM) <= tolerance,
  );

  const recentSet = new Set(recentTrackIds);
  const fresh = withinTolerance.filter(t => !recentSet.has(t.id));
  const candidates = fresh.length > 0 ? fresh : withinTolerance;

  const selected = candidates[Math.floor(Math.random() * candidates.length)];

  return {
    track: selected,
    actualBPM: selected.bpm,
    requestedBPM: targetBPM,
    bpmDelta: Math.abs(selected.bpm - targetBPM),
  };
}
