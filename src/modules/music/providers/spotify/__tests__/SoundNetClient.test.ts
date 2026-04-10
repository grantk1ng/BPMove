import AsyncStorage from '@react-native-async-storage/async-storage';
import {lookupBPMBatch} from '../SoundNetClient';
import type {TrackIdentifier} from '../SoundNetClient';

jest.mock('../../../../../config/env', () => ({
  RAPIDAPI_KEY: 'test-key',
}));

const mockFetch = jest.fn();
(global.fetch as jest.Mock) = mockFetch;

function mockSoundNetResponse(tempo: number) {
  return {
    ok: true,
    json: () => Promise.resolve({tempo}),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  AsyncStorage.clear();
  mockFetch.mockReset();
});

describe('lookupBPMBatch', () => {
  const tracks: TrackIdentifier[] = [
    {id: 'a', title: 'Song A', artist: 'Artist A'},
    {id: 'b', title: 'Song B', artist: 'Artist B'},
    {id: 'c', title: 'Song C', artist: 'Artist C'},
  ];

  it('returns BPM from API and caches results', async () => {
    mockFetch
      .mockResolvedValueOnce(mockSoundNetResponse(130))
      .mockResolvedValueOnce(mockSoundNetResponse(140))
      .mockResolvedValueOnce(mockSoundNetResponse(150));

    const result = await lookupBPMBatch(tracks);

    expect(result.get('a')).toBe(130);
    expect(result.get('b')).toBe(140);
    expect(result.get('c')).toBe(150);
    expect(mockFetch).toHaveBeenCalledTimes(3);

    // Verify values were cached
    const cached = await AsyncStorage.getItem('bpmove:bpm:a');
    expect(cached).toBe('130');
  });

  it('uses cache and skips API for cached tracks', async () => {
    // Pre-populate cache
    await AsyncStorage.setItem('bpmove:bpm:a', '130');
    await AsyncStorage.setItem('bpmove:bpm:b', '140');

    // Only track c needs an API call
    mockFetch.mockResolvedValueOnce(mockSoundNetResponse(150));

    const result = await lookupBPMBatch(tracks);

    expect(result.get('a')).toBe(130);
    expect(result.get('b')).toBe(140);
    expect(result.get('c')).toBe(150);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('skips API entirely when all tracks are cached', async () => {
    await AsyncStorage.setItem('bpmove:bpm:a', '130');
    await AsyncStorage.setItem('bpmove:bpm:b', '140');
    await AsyncStorage.setItem('bpmove:bpm:c', '150');

    const result = await lookupBPMBatch(tracks);

    expect(result.size).toBe(3);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not cache failed lookups', async () => {
    mockFetch
      .mockResolvedValueOnce({ok: false, status: 404})
      .mockResolvedValueOnce(mockSoundNetResponse(140))
      .mockResolvedValueOnce(mockSoundNetResponse(150));

    const result = await lookupBPMBatch(tracks);

    expect(result.has('a')).toBe(false);
    expect(result.get('b')).toBe(140);

    const cachedA = await AsyncStorage.getItem('bpmove:bpm:a');
    expect(cachedA).toBeNull();
  });
});
