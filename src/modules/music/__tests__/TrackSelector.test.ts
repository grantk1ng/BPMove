import {selectTrack} from '../TrackSelector';
import type {MusicLibrary, TrackMetadata} from '../types';

function makeTrack(id: string, bpm: number): TrackMetadata {
  return {
    id,
    title: `Track ${id}`,
    artist: 'Test Artist',
    album: null,
    durationSeconds: 180,
    bpm,
    url: `/music/${id}.mp3`,
    artworkUrl: null,
    genre: null,
  };
}

function makeLibrary(tracks: TrackMetadata[]): MusicLibrary {
  const bpmIndex = new Map<number, string[]>();
  for (const track of tracks) {
    const bpm = Math.round(track.bpm);
    const existing = bpmIndex.get(bpm) ?? [];
    existing.push(track.id);
    bpmIndex.set(bpm, existing);
  }
  return {tracks, bpmIndex, lastUpdated: Date.now()};
}

describe('selectTrack', () => {
  it('returns null for empty library', () => {
    const result = selectTrack(150, makeLibrary([]), null);
    expect(result).toBeNull();
  });

  it('selects the closest BPM track', () => {
    const library = makeLibrary([
      makeTrack('a', 120),
      makeTrack('b', 145),
      makeTrack('c', 170),
    ]);

    const result = selectTrack(150, library, null);
    expect(result).not.toBeNull();
    expect(result!.track.id).toBe('b');
    expect(result!.bpmDelta).toBe(5);
  });

  it('returns exact match when available', () => {
    const library = makeLibrary([
      makeTrack('a', 120),
      makeTrack('b', 150),
      makeTrack('c', 170),
    ]);

    const result = selectTrack(150, library, null);
    expect(result!.track.id).toBe('b');
    expect(result!.bpmDelta).toBe(0);
  });

  it('avoids repeating current track when alternatives exist', () => {
    const library = makeLibrary([
      makeTrack('a', 150),
      makeTrack('b', 150),
    ]);

    const result = selectTrack(150, library, 'a');
    expect(result).not.toBeNull();
    expect(result!.track.id).toBe('b');
  });

  it('returns current track if it is the only match', () => {
    const library = makeLibrary([makeTrack('a', 150)]);

    const result = selectTrack(150, library, 'a');
    expect(result).not.toBeNull();
    expect(result!.track.id).toBe('a');
  });

  it('handles single track library', () => {
    const library = makeLibrary([makeTrack('solo', 130)]);

    const result = selectTrack(200, library, null);
    expect(result).not.toBeNull();
    expect(result!.track.id).toBe('solo');
    expect(result!.bpmDelta).toBe(70);
  });

  it('includes requestedBPM and actualBPM in result', () => {
    const library = makeLibrary([makeTrack('a', 145)]);

    const result = selectTrack(150, library, null);
    expect(result!.requestedBPM).toBe(150);
    expect(result!.actualBPM).toBe(145);
  });
});
