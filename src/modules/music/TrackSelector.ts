import type {MusicLibrary, TrackMetadata, TrackSelection} from './types';

/**
 * Pure function: selects the track closest to the target BPM.
 * Avoids repeating the current track when alternatives exist.
 */
export function selectTrack(
  targetBPM: number,
  library: MusicLibrary,
  currentTrackId: string | null,
): TrackSelection | null {
  if (library.tracks.length === 0) {
    return null;
  }

  // Find closest BPM match
  let bestTracks: TrackMetadata[] = [];
  let bestDelta = Infinity;

  for (const track of library.tracks) {
    const delta = Math.abs(track.bpm - targetBPM);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestTracks = [track];
    } else if (delta === bestDelta) {
      bestTracks.push(track);
    }
  }

  // If possible, avoid repeating the current track
  let selected: TrackMetadata;
  if (bestTracks.length > 1 && currentTrackId) {
    const alternatives = bestTracks.filter(t => t.id !== currentTrackId);
    if (alternatives.length > 0) {
      selected = alternatives[Math.floor(Math.random() * alternatives.length)];
    } else {
      selected = bestTracks[0];
    }
  } else {
    selected = bestTracks[0];
  }

  return {
    track: selected,
    actualBPM: selected.bpm,
    requestedBPM: targetBPM,
    bpmDelta: Math.abs(selected.bpm - targetBPM),
  };
}
