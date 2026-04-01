import {LOCAL_TRACKS, MIN_BPM, MAX_BPM} from '../local/trackCatalog';

describe('trackCatalog', () => {
  it('has tracks spanning the full BPM range', () => {
    const bpms = LOCAL_TRACKS.map(t => t.bpm);
    expect(Math.min(...bpms)).toBe(MIN_BPM);
    expect(Math.max(...bpms)).toBe(MAX_BPM);
  });

  it('has no duplicate IDs', () => {
    const ids = LOCAL_TRACKS.map(t => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('has all required metadata fields populated', () => {
    for (const track of LOCAL_TRACKS) {
      expect(track.id).toBeTruthy();
      expect(track.title).toBeTruthy();
      expect(track.artist).toBeTruthy();
      expect(track.url).toBeDefined();
      expect(track.bpm).toBeGreaterThanOrEqual(MIN_BPM);
      expect(track.bpm).toBeLessThanOrEqual(MAX_BPM);
      expect(track.durationSeconds).toBeGreaterThan(0);
    }
  });

  it('covers the core training range (120-140) with no gaps larger than 5 BPM', () => {
    const coreBpms = LOCAL_TRACKS.map(t => t.bpm).filter(
      bpm => bpm >= 120 && bpm <= 140,
    );
    const uniqueCoreBpms = [...new Set(coreBpms)].sort((a, b) => a - b);

    expect(uniqueCoreBpms.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < uniqueCoreBpms.length; i++) {
      const gap = uniqueCoreBpms[i] - uniqueCoreBpms[i - 1];
      expect(gap).toBeLessThanOrEqual(5);
    }
  });

  it('has multiple tracks at overlapping BPM values for variety', () => {
    const bpmCounts = new Map<number, number>();
    for (const track of LOCAL_TRACKS) {
      bpmCounts.set(track.bpm, (bpmCounts.get(track.bpm) ?? 0) + 1);
    }

    const multiTrackBpms = [...bpmCounts.values()].filter(c => c > 1);
    expect(multiTrackBpms.length).toBeGreaterThanOrEqual(2);
  });
});
