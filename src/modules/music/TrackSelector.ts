import type {AlgorithmMode} from '../algorithm/types';
import type {MusicLibrary, TrackSelection} from './types';

const BPM_TOLERANCE = 5;
const RAISE_VARIANCE_BPM = 20;
const RAISE_OVERAGE_BPM = 5;
const RAISE_HR_LEAD_BPM = 6;

interface TrackSelectionOptions {
  mode?: AlgorithmMode;
  triggeringHR?: number;
}

function pickCandidate<T extends {id: string}>(
  tracks: T[],
  recentTrackIds: string[],
): T | null {
  if (tracks.length === 0) {
    return null;
  }

  const recentSet = new Set(recentTrackIds);
  const fresh = tracks.filter(track => !recentSet.has(track.id));
  const candidates = fresh.length > 0 ? fresh : tracks;

  return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
}

function selectRaiseModeTrack(
  targetBPM: number,
  library: MusicLibrary,
  recentTrackIds: string[],
  triggeringHR?: number,
): TrackSelection | null {
  const inRaiseWindow = library.tracks.filter(
    track =>
      track.bpm >= targetBPM - RAISE_VARIANCE_BPM &&
      track.bpm <= targetBPM + RAISE_OVERAGE_BPM,
  );

  if (inRaiseWindow.length === 0) {
    return null;
  }

  const liftCandidates =
    triggeringHR === undefined
      ? inRaiseWindow
      : inRaiseWindow.filter(track => track.bpm >= triggeringHR + RAISE_HR_LEAD_BPM);

  const selected =
    pickCandidate(liftCandidates, recentTrackIds) ??
    pickCandidate(inRaiseWindow, recentTrackIds);

  if (!selected) {
    return null;
  }

  return {
    track: selected,
    actualBPM: selected.bpm,
    requestedBPM: targetBPM,
    bpmDelta: Math.abs(selected.bpm - targetBPM),
  };
}

/**
 * Pure function: selects a track near the target BPM.
 * Avoids recently played tracks when alternatives exist within tolerance.
 */
export function selectTrack(
  targetBPM: number,
  library: MusicLibrary,
  recentTrackIds: string[],
  options: TrackSelectionOptions = {},
): TrackSelection | null {
  if (library.tracks.length === 0) {
    return null;
  }

  if (options.mode === 'RAISE') {
    const raiseSelection = selectRaiseModeTrack(
      targetBPM,
      library,
      recentTrackIds,
      options.triggeringHR,
    );
    if (raiseSelection) {
      return raiseSelection;
    }
  }

  const sorted = [...library.tracks].sort(
    (a, b) => Math.abs(a.bpm - targetBPM) - Math.abs(b.bpm - targetBPM),
  );

  const bestDelta = Math.abs(sorted[0].bpm - targetBPM);
  const tolerance = Math.max(bestDelta, BPM_TOLERANCE);

  const withinTolerance = sorted.filter(
    t => Math.abs(t.bpm - targetBPM) <= tolerance,
  );

  const selected = pickCandidate(withinTolerance, recentTrackIds);
  if (!selected) {
    return null;
  }

  return {
    track: selected,
    actualBPM: selected.bpm,
    requestedBPM: targetBPM,
    bpmDelta: Math.abs(selected.bpm - targetBPM),
  };
}
