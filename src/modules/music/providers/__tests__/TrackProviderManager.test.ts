import {eventBus} from '../../../../core/EventBus';
import {TrackProviderManager} from '../TrackProviderManager';
import type {TrackProvider, Result, ProviderStatus} from '../types';
import type {TrackMetadata} from '../../types';
import type {MusicLibraryManager} from '../../MusicLibraryManager';
import type {MusicPlayerService} from '../../MusicPlayerService';

function makeTrack(id: string, bpm: number): TrackMetadata {
  return {
    id,
    title: `Track ${id}`,
    artist: 'Test',
    album: null,
    durationSeconds: 180,
    bpm,
    url: `/music/${id}.mp3`,
    artworkUrl: null,
    genre: null,
  };
}

function makeMockProvider(
  name: string,
  priority: number,
  available: boolean,
  tracks: TrackMetadata[] | null,
): TrackProvider {
  let status: ProviderStatus = 'idle';
  return {
    info: {name, priority},
    getStatus: () => status,
    isAvailable: jest.fn(async (): Promise<Result<boolean>> => {
      return {ok: true, data: available};
    }),
    loadTracks: jest.fn(async (): Promise<Result<TrackMetadata[]>> => {
      if (tracks) {
        status = 'ready';
        return {ok: true, data: tracks};
      }
      status = 'error';
      return {ok: false, error: 'Load failed'};
    }),
    playTrack: jest.fn(async () => ({ok: true as const, data: undefined})),
    pause: jest.fn(async () => ({ok: true as const, data: undefined})),
    resume: jest.fn(async () => ({ok: true as const, data: undefined})),
    stop: jest.fn(async () => ({ok: true as const, data: undefined})),
    getPosition: jest.fn(async () => ({
      ok: true as const,
      data: {positionSeconds: 0, durationSeconds: 0},
    })),
    destroy: jest.fn(async () => {}),
  };
}

function makeMockLibraryManager(): MusicLibraryManager {
  return {
    getLibrary: jest.fn(() => ({tracks: [], bpmIndex: new Map(), lastUpdated: 0})),
    loadTracks: jest.fn(),
    addTrack: jest.fn(),
    removeTrack: jest.fn(),
  } as unknown as MusicLibraryManager;
}

function makeMockMusicService(): MusicPlayerService {
  return {
    setActiveProvider: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    play: jest.fn(),
    pause: jest.fn(),
    skip: jest.fn(),
    getCurrentTrack: jest.fn(),
    destroy: jest.fn(),
  } as unknown as MusicPlayerService;
}

describe('TrackProviderManager', () => {
  let emittedEvents: {event: string; data: unknown}[];
  let unsubscribers: (() => void)[];

  beforeEach(() => {
    emittedEvents = [];
    unsubscribers = [];

    const events = [
      'provider:loading',
      'provider:ready',
      'provider:error',
      'provider:fallback',
    ] as const;

    for (const event of events) {
      unsubscribers.push(
        eventBus.on(event, (data: unknown) => {
          emittedEvents.push({event, data});
        }),
      );
    }
  });

  afterEach(() => {
    for (const unsub of unsubscribers) {
      unsub();
    }
    eventBus.removeAllListeners();
  });

  it('selects the highest-priority available provider', async () => {
    const tracks = [makeTrack('a', 120)];
    const highPriority = makeMockProvider('spotify', 0, true, tracks);
    const lowPriority = makeMockProvider('local', 10, true, [makeTrack('b', 130)]);
    const libraryManager = makeMockLibraryManager();
    const musicService = makeMockMusicService();

    const manager = new TrackProviderManager(
      [lowPriority, highPriority],
      libraryManager,
      musicService,
    );

    await manager.initialize();

    expect(manager.getActiveProvider()).toBe(highPriority);
    expect(libraryManager.loadTracks).toHaveBeenCalledWith(tracks);
    expect(musicService.setActiveProvider).toHaveBeenCalledWith(highPriority);
  });

  it('falls back to lower-priority provider when higher fails', async () => {
    const localTracks = [makeTrack('a', 120)];
    const spotify = makeMockProvider('spotify', 0, false, null);
    const local = makeMockProvider('local', 10, true, localTracks);
    const libraryManager = makeMockLibraryManager();
    const musicService = makeMockMusicService();

    const manager = new TrackProviderManager(
      [local, spotify],
      libraryManager,
      musicService,
    );

    await manager.initialize();

    expect(manager.getActiveProvider()).toBe(local);
    expect(libraryManager.loadTracks).toHaveBeenCalledWith(localTracks);
  });

  it('emits provider:ready on success', async () => {
    const tracks = [makeTrack('a', 120), makeTrack('b', 140)];
    const provider = makeMockProvider('local', 10, true, tracks);
    const libraryManager = makeMockLibraryManager();
    const musicService = makeMockMusicService();

    const manager = new TrackProviderManager(
      [provider],
      libraryManager,
      musicService,
    );

    await manager.initialize();

    const readyEvent = emittedEvents.find(e => e.event === 'provider:ready');
    expect(readyEvent).toBeDefined();
    expect(readyEvent!.data).toEqual({providerName: 'local', trackCount: 2});
  });

  it('emits provider:error when loadTracks fails', async () => {
    const provider = makeMockProvider('spotify', 0, true, null);
    const libraryManager = makeMockLibraryManager();
    const musicService = makeMockMusicService();

    const manager = new TrackProviderManager(
      [provider],
      libraryManager,
      musicService,
    );

    await manager.initialize();

    const errorEvent = emittedEvents.find(
      e => e.event === 'provider:error' && (e.data as {providerName: string}).providerName === 'spotify',
    );
    expect(errorEvent).toBeDefined();
  });

  it('emits provider:error for all when no providers work', async () => {
    const provider = makeMockProvider('local', 10, false, null);
    const libraryManager = makeMockLibraryManager();
    const musicService = makeMockMusicService();

    const manager = new TrackProviderManager(
      [provider],
      libraryManager,
      musicService,
    );

    await manager.initialize();

    expect(manager.getActiveProvider()).toBeNull();
    const allError = emittedEvents.find(
      e => e.event === 'provider:error' && (e.data as {providerName: string}).providerName === 'all',
    );
    expect(allError).toBeDefined();
  });

  it('calls destroy on all providers', async () => {
    const a = makeMockProvider('a', 0, true, [makeTrack('x', 120)]);
    const b = makeMockProvider('b', 10, true, [makeTrack('y', 130)]);
    const libraryManager = makeMockLibraryManager();
    const musicService = makeMockMusicService();

    const manager = new TrackProviderManager(
      [a, b],
      libraryManager,
      musicService,
    );

    await manager.initialize();
    await manager.destroy();

    expect(a.destroy).toHaveBeenCalled();
    expect(b.destroy).toHaveBeenCalled();
  });
});
