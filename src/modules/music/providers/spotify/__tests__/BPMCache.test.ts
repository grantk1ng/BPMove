import AsyncStorage from '@react-native-async-storage/async-storage';
import {getCached, setCached} from '../BPMCache';

beforeEach(() => {
  AsyncStorage.clear();
});

describe('BPMCache', () => {
  it('returns empty map for uncached track IDs', async () => {
    const result = await getCached(['unknown1', 'unknown2']);
    expect(result.size).toBe(0);
  });

  it('round-trips cached BPM values', async () => {
    const entries = new Map([
      ['track1', 130],
      ['track2', 145],
    ]);
    await setCached(entries);

    const result = await getCached(['track1', 'track2']);
    expect(result.get('track1')).toBe(130);
    expect(result.get('track2')).toBe(145);
  });

  it('returns only cached entries when some are missing', async () => {
    await setCached(new Map([['track1', 120]]));

    const result = await getCached(['track1', 'track2']);
    expect(result.size).toBe(1);
    expect(result.get('track1')).toBe(120);
  });
});
