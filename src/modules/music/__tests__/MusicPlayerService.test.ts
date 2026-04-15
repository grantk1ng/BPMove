import {eventBus} from '../../../core/EventBus';
import {MusicLibraryManager} from '../MusicLibraryManager';
import {MusicPlayerService} from '../MusicPlayerService';
import type {TrackMetadata} from '../types';
import type {BPMTarget} from '../../algorithm/types';
import type {TrackProvider} from '../providers/types';

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

function makeTarget(targetBPM: number, timestamp: number): BPMTarget {
  return {
    targetBPM,
    triggeringHR: 140,
    timestamp,
    reason: 'test',
    urgency: 0.5,
    mode: 'MAINTAIN',
  };
}

function waitForAsyncHandlers(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function makeProvider(): {
  provider: TrackProvider;
  playTrack: jest.Mock;
  stop: jest.Mock;
} {
  const playTrack = jest.fn(async () => ({ok: true as const, data: undefined}));
  const stop = jest.fn(async () => ({ok: true as const, data: undefined}));

  return {
    provider: {
      info: {name: 'mock', priority: 0},
      isAvailable: async () => ({ok: true as const, data: true}),
      loadTracks: async () => ({ok: true as const, data: []}),
      getStatus: () => 'ready',
      playTrack,
      pause: async () => ({ok: true as const, data: undefined}),
      resume: async () => ({ok: true as const, data: undefined}),
      stop,
      getPosition: async () => ({
        ok: true as const,
        data: {positionSeconds: 0, durationSeconds: 180},
      }),
      destroy: async () => {},
    },
    playTrack,
    stop,
  };
}

describe('MusicPlayerService', () => {
  beforeEach(() => {
    eventBus.removeAllListeners();
  });

  afterEach(() => {
    eventBus.removeAllListeners();
  });

  it('restarts cleanly after stop so the next session can play immediately', async () => {
    const libraryManager = new MusicLibraryManager();
    libraryManager.loadTracks([makeTrack('solo', 130)]);

    const service = new MusicPlayerService(libraryManager);
    const {provider, playTrack, stop} = makeProvider();
    const playbackStates: Array<{
      currentTrack: TrackMetadata | null;
      isPlaying: boolean;
      targetBPM: number | null;
    }> = [];

    service.setActiveProvider(provider);
    eventBus.on('music:playbackStateChanged', state => {
      playbackStates.push({
        currentTrack: state.currentTrack,
        isPlaying: state.isPlaying,
        targetBPM: state.targetBPM,
      });
    });

    service.start();
    eventBus.emit('algo:target', makeTarget(130, 1_000));
    await waitForAsyncHandlers();

    expect(playTrack).toHaveBeenCalledTimes(1);

    service.stop();

    expect(stop).toHaveBeenCalledTimes(1);
    expect(playbackStates[playbackStates.length - 1]).toEqual({
      currentTrack: null,
      isPlaying: false,
      targetBPM: null,
    });

    service.start();
    eventBus.emit('algo:target', makeTarget(130, 2_000));
    await waitForAsyncHandlers();

    expect(playTrack).toHaveBeenCalledTimes(2);

    service.destroy();
  });

  it('emits a playing snapshot immediately after the algorithm starts a track', async () => {
    const libraryManager = new MusicLibraryManager();
    libraryManager.loadTracks([makeTrack('solo', 130)]);

    const service = new MusicPlayerService(libraryManager);
    const {provider} = makeProvider();
    const playbackStates: Array<{
      currentTrack: TrackMetadata | null;
      isPlaying: boolean;
      durationSeconds: number;
    }> = [];

    service.setActiveProvider(provider);
    service.start();
    eventBus.on('music:playbackStateChanged', state => {
      playbackStates.push({
        currentTrack: state.currentTrack,
        isPlaying: state.isPlaying,
        durationSeconds: state.durationSeconds,
      });
    });

    eventBus.emit('algo:target', makeTarget(130, 1_000));
    await waitForAsyncHandlers();

    expect(playbackStates).toEqual(
      expect.arrayContaining([
        {
          currentTrack: expect.objectContaining({id: 'solo'}),
          isPlaying: true,
          durationSeconds: 180,
        },
      ]),
    );
  });

  it('syncs external provider playback changes back into the service state', async () => {
    const libraryManager = new MusicLibraryManager();
    libraryManager.loadTracks([makeTrack('a', 130), makeTrack('b', 132)]);

    const service = new MusicPlayerService(libraryManager);
    const {provider} = makeProvider();
    const playbackStates: string[] = [];

    service.setActiveProvider({...provider, info: {name: 'spotify', priority: 0}});
    service.start();
    eventBus.on('music:playbackStateChanged', state => {
      playbackStates.push(state.currentTrack?.id ?? 'none');
    });

    eventBus.emit('algo:target', makeTarget(130, 1_000));
    await waitForAsyncHandlers();

    eventBus.emit('music:providerPlaybackChanged', {
      providerName: 'spotify',
      trackId: 'b',
      isPlaying: true,
      positionSeconds: 12,
      durationSeconds: 180,
    });

    expect(service.getCurrentTrack()?.id).toBe('b');
    expect(playbackStates[playbackStates.length - 1]).toBe('b');
  });

  it('uses the raise-mode selection window instead of jumping straight to the max BPM fallback', async () => {
    const libraryManager = new MusicLibraryManager();
    libraryManager.loadTracks([makeTrack('steady', 140), makeTrack('spike', 174)]);

    const service = new MusicPlayerService(libraryManager);
    const {provider, playTrack} = makeProvider();

    service.setActiveProvider(provider);
    service.start();

    eventBus.emit('algo:target', {
      ...makeTarget(160, 1_000),
      mode: 'RAISE',
      triggeringHR: 145,
    });
    await waitForAsyncHandlers();

    expect(playTrack).toHaveBeenCalledWith(
      expect.objectContaining({id: 'steady', bpm: 140}),
    );
  });
});
