/**
 * Demo Smoke Test
 *
 * Verifies the full pipeline end-to-end using the EventBus:
 *   ServiceRegistry init → mock BLE HR readings → algorithm adjusts BPM →
 *   music track selected → session logs correctly
 *
 * Run before every demo: npm test -- --testPathPattern=demo-smoke
 */

import {ServiceRegistry} from '../core/ServiceRegistry';
import {eventBus} from '../core/EventBus';
import {AdaptiveBPMEngine} from '../modules/algorithm/AdaptiveBPMEngine';
import {MusicLibraryManager} from '../modules/music/MusicLibraryManager';
import {MusicPlayerService} from '../modules/music/MusicPlayerService';
import {SessionLogger} from '../modules/logging/SessionLogger';
import {createDefaultConfig, HR_ZONE_PRESETS} from '../modules/algorithm/presets';
import type {HeartRateReading} from '../modules/heartrate/types';
import type {TrackMetadata} from '../modules/music/types';
import type {BPMTarget, AlgorithmState} from '../modules/algorithm/types';

// --- Test helpers ---

function makeReading(bpm: number, timestamp: number): HeartRateReading {
  return {
    bpm,
    timestamp,
    sensorContact: true,
    rrIntervals: [],
    energyExpended: null,
  };
}

function makeTracks(): TrackMetadata[] {
  return [
    {id: 't-120', title: 'Slow Song', artist: 'Test', album: null, durationSeconds: 180, bpm: 120, url: 1, artworkUrl: null, genre: null},
    {id: 't-130', title: 'Medium Song', artist: 'Test', album: null, durationSeconds: 180, bpm: 130, url: 2, artworkUrl: null, genre: null},
    {id: 't-140', title: 'Upbeat Song', artist: 'Test', album: null, durationSeconds: 180, bpm: 140, url: 3, artworkUrl: null, genre: null},
    {id: 't-150', title: 'Fast Song', artist: 'Test', album: null, durationSeconds: 180, bpm: 150, url: 4, artworkUrl: null, genre: null},
    {id: 't-160', title: 'Faster Song', artist: 'Test', album: null, durationSeconds: 180, bpm: 160, url: 5, artworkUrl: null, genre: null},
    {id: 't-170', title: 'Sprint Song', artist: 'Test', album: null, durationSeconds: 180, bpm: 170, url: 6, artworkUrl: null, genre: null},
  ];
}

/** Simple mock provider that records calls without playing audio */
function makeMockProvider() {
  const calls: string[] = [];
  return {
    provider: {
      info: {name: 'mock', priority: 0},
      isAvailable: async () => ({ok: true as const, data: true}),
      loadTracks: async () => ({ok: true as const, data: makeTracks()}),
      getStatus: () => 'ready' as const,
      playTrack: async () => {
        calls.push('playTrack');
        return {ok: true as const, data: undefined};
      },
      pause: async () => ({ok: true as const, data: undefined}),
      resume: async () => ({ok: true as const, data: undefined}),
      stop: async () => ({ok: true as const, data: undefined}),
      getPosition: async () => ({ok: true as const, data: {positionSeconds: 0, durationSeconds: 180}}),
      destroy: async () => {},
    },
    calls,
  };
}

// --- Tests ---

describe('Demo Smoke Test', () => {
  let engine: AdaptiveBPMEngine;
  let libraryManager: MusicLibraryManager;
  let musicService: MusicPlayerService;
  let logger: SessionLogger;

  beforeEach(() => {
    ServiceRegistry.clear();
    eventBus.removeAllListeners();

    // Initialize services in correct order (matches App.tsx)
    const config = createDefaultConfig(HR_ZONE_PRESETS[0]); // Zone 2: 130-150
    engine = new AdaptiveBPMEngine(config);
    ServiceRegistry.register('algorithm', engine);

    libraryManager = new MusicLibraryManager();
    ServiceRegistry.register('musicLibrary', libraryManager);

    musicService = new MusicPlayerService(libraryManager);
    ServiceRegistry.register('music', musicService);

    logger = new SessionLogger();
    ServiceRegistry.register('logging', logger);

    // Load tracks and set provider
    const {provider} = makeMockProvider();
    libraryManager.loadTracks(makeTracks());
    musicService.setActiveProvider(provider);
  });

  afterEach(() => {
    engine.destroy();
    musicService.stop();
    if (logger.isActive()) {
      logger.stop();
    }
    ServiceRegistry.clear();
    eventBus.removeAllListeners();
  });

  it('initializes all services in ServiceRegistry', () => {
    expect(ServiceRegistry.has('algorithm')).toBe(true);
    expect(ServiceRegistry.has('musicLibrary')).toBe(true);
    expect(ServiceRegistry.has('music')).toBe(true);
    expect(ServiceRegistry.has('logging')).toBe(true);
  });

  it('library loads tracks with BPM index', () => {
    const library = libraryManager.getLibrary();
    expect(library.tracks).toHaveLength(6);
    expect(library.bpmIndex.size).toBeGreaterThan(0);
  });

  it('algorithm processes HR readings and emits state changes', () => {
    const stateChanges: AlgorithmState[] = [];
    eventBus.on('algo:stateChanged', state => stateChanges.push(state));

    engine.start();
    eventBus.emit('hr:reading', makeReading(145, Date.now()));

    expect(stateChanges).toHaveLength(1);
    expect(stateChanges[0].smoothedHR).toBe(145);

    engine.stop();
  });

  it('algorithm transitions to RAISE mode when HR is below zone', () => {
    const modeChanges: Array<{from: string; to: string}> = [];
    eventBus.on('algo:modeChanged', change => modeChanges.push(change));

    engine.start();

    // Feed HR readings below Zone 2 (130-150) for longer than dwellTimeMs
    const baseTime = Date.now();
    for (let i = 0; i < 10; i++) {
      eventBus.emit('hr:reading', makeReading(110, baseTime + i * 1000));
    }

    expect(modeChanges.length).toBeGreaterThanOrEqual(1);
    expect(modeChanges[0].to).toBe('RAISE');

    engine.stop();
  });

  it('algorithm emits BPM target when mode transitions', () => {
    const targets: BPMTarget[] = [];
    eventBus.on('algo:target', target => targets.push(target));

    engine.start();

    // Feed consistently low HR to trigger RAISE mode + target emission
    const baseTime = Date.now();
    for (let i = 0; i < 15; i++) {
      eventBus.emit('hr:reading', makeReading(110, baseTime + i * 1000));
    }

    expect(targets.length).toBeGreaterThanOrEqual(1);
    expect(targets[0].targetBPM).toBeGreaterThan(0);
    expect(targets[0].mode).toBe('RAISE');

    engine.stop();
  });

  it('music service receives algo target and selects a track', async () => {
    const trackChanges: TrackMetadata[] = [];
    eventBus.on('music:changed', track => trackChanges.push(track));

    engine.start();
    musicService.start();

    // Feed HR readings that will trigger a BPM target
    const baseTime = Date.now();
    for (let i = 0; i < 15; i++) {
      eventBus.emit('hr:reading', makeReading(110, baseTime + i * 1000));
    }

    // Allow async track selection to complete
    await new Promise<void>(resolve => setTimeout(resolve, 50));

    expect(trackChanges.length).toBeGreaterThanOrEqual(1);
    expect(trackChanges[0].bpm).toBeGreaterThan(0);

    musicService.stop();
    engine.stop();
  });

  it('session logger captures full pipeline: HR → algo → music', async () => {
    engine.start();
    musicService.start();
    const sessionId = logger.start({
      targetZone: {minBPM: 130, maxBPM: 150},
    });

    expect(sessionId).toBeTruthy();

    // Simulate a short workout: below zone → triggers RAISE → track change
    const baseTime = Date.now();
    for (let i = 0; i < 15; i++) {
      eventBus.emit('hr:reading', makeReading(110, baseTime + i * 1000));
    }

    // Allow async operations to settle
    await new Promise<void>(resolve => setTimeout(resolve, 50));

    const log = logger.stop();

    // Verify session recorded HR readings
    const hrEntries = log.entries.filter(e => e.type === 'hr_reading');
    expect(hrEntries.length).toBe(15);

    // Verify time-series rows were built
    expect(log.timeSeries.length).toBe(15);

    // Verify algo state was merged into time-series
    const lastRow = log.timeSeries[log.timeSeries.length - 1];
    expect(lastRow.smoothedHR).toBeGreaterThan(0);
    expect(lastRow.currentMode).toBeDefined();

    // Verify session metadata computed
    expect(log.metadata.avgHeartRate).toBe(110);
    expect(log.metadata.maxHeartRate).toBe(110);
    expect(log.metadata.minHeartRate).toBe(110);

    // Verify session start/end entries
    const startEntries = log.entries.filter(e => e.type === 'session_start');
    const endEntries = log.entries.filter(e => e.type === 'session_end');
    expect(startEntries).toHaveLength(1);
    expect(endEntries).toHaveLength(1);

    musicService.stop();
    engine.stop();
  });

  it('full pipeline handles zone transition: RAISE → MAINTAIN', () => {
    const modeChanges: Array<{from: string; to: string}> = [];
    eventBus.on('algo:modeChanged', change => modeChanges.push(change));

    engine.start();

    const baseTime = Date.now();

    // Phase 1: HR below zone → trigger RAISE
    for (let i = 0; i < 10; i++) {
      eventBus.emit('hr:reading', makeReading(110, baseTime + i * 1000));
    }

    // Phase 2: HR enters zone → should eventually return to MAINTAIN
    for (let i = 10; i < 25; i++) {
      eventBus.emit('hr:reading', makeReading(140, baseTime + i * 1000));
    }

    // Should have at least MAINTAIN → RAISE, then RAISE → MAINTAIN
    expect(modeChanges.length).toBeGreaterThanOrEqual(2);
    expect(modeChanges[0].to).toBe('RAISE');
    const returnToMaintain = modeChanges.find(c => c.to === 'MAINTAIN');
    expect(returnToMaintain).toBeDefined();

    engine.stop();
  });
});
