import {eventBus} from '../../../core/EventBus';
import {SessionLogger} from '../SessionLogger';
import type {HeartRateReading} from '../../heartrate/types';
import type {AlgorithmState} from '../../algorithm/types';
import type {TrackMetadata} from '../../music/types';

afterEach(() => {
  eventBus.removeAllListeners();
});

function makeReading(
  bpm: number,
  timestamp: number,
): HeartRateReading {
  return {
    bpm,
    timestamp,
    sensorContact: true,
    rrIntervals: [],
    energyExpended: null,
  };
}

describe('SessionLogger', () => {
  let logger: SessionLogger;

  beforeEach(() => {
    logger = new SessionLogger();
  });

  afterEach(() => {
    if (logger.isActive()) {
      logger.stop();
    }
  });

  it('starts and stops a session', () => {
    const sessionId = logger.start({targetZone: {minBPM: 140, maxBPM: 160}});
    expect(sessionId).toBeTruthy();
    expect(logger.isActive()).toBe(true);

    const log = logger.stop();
    expect(log.sessionId).toBe(sessionId);
    expect(log.entries.length).toBeGreaterThanOrEqual(2); // session_start + session_end
    expect(logger.isActive()).toBe(false);
  });

  it('logs HR readings as discrete entries', () => {
    logger.start({targetZone: {minBPM: 140, maxBPM: 160}});

    eventBus.emit('hr:reading', makeReading(150, Date.now()));
    eventBus.emit('hr:reading', makeReading(155, Date.now() + 1000));

    const log = logger.stop();
    const hrEntries = log.entries.filter(e => e.type === 'hr_reading');
    expect(hrEntries).toHaveLength(2);
  });

  it('builds time-series rows from HR readings', () => {
    logger.start({targetZone: {minBPM: 140, maxBPM: 160}});

    eventBus.emit('hr:reading', makeReading(150, Date.now()));
    eventBus.emit('hr:reading', makeReading(155, Date.now() + 1000));

    const log = logger.stop();
    expect(log.timeSeries).toHaveLength(2);
    expect(log.timeSeries[0].hrBpm).toBe(150);
    expect(log.timeSeries[1].hrBpm).toBe(155);
  });

  it('merges cached algo state into time-series rows', () => {
    logger.start({targetZone: {minBPM: 140, maxBPM: 160}});

    // Emit algo state first (simulating AdaptiveBPMEngine)
    const algoState: AlgorithmState = {
      currentMode: 'RAISE',
      modeEnteredAt: Date.now(),
      smoothedHR: 130,
      hrHistory: [],
      consecutiveOutOfZoneMs: 2000,
      currentTargetBPM: 165,
      msSinceLastTargetChange: 1000,
    };
    eventBus.emit('algo:stateChanged', algoState);

    // Then emit HR reading
    eventBus.emit('hr:reading', makeReading(130, Date.now()));

    const log = logger.stop();
    expect(log.timeSeries).toHaveLength(1);
    expect(log.timeSeries[0].currentMode).toBe('RAISE');
    expect(log.timeSeries[0].smoothedHR).toBe(130);
    expect(log.timeSeries[0].currentTargetBPM).toBe(165);
  });

  it('merges cached music state into time-series rows', () => {
    logger.start({targetZone: {minBPM: 140, maxBPM: 160}});

    // Emit music change
    const track: TrackMetadata = {
      id: 'track-1',
      title: 'Fast Song',
      artist: 'DJ Test',
      album: null,
      durationSeconds: 180,
      bpm: 160,
      url: '/music/fast.mp3',
      artworkUrl: null,
      genre: null,
    };
    eventBus.emit('music:changed', track);

    // Then emit HR reading
    eventBus.emit('hr:reading', makeReading(150, Date.now()));

    const log = logger.stop();
    expect(log.timeSeries).toHaveLength(1);
    expect(log.timeSeries[0].currentTrackId).toBe('track-1');
    expect(log.timeSeries[0].currentTrackTitle).toBe('Fast Song');
    expect(log.timeSeries[0].currentTrackBPM).toBe(160);
  });

  it('carries forward music state across multiple HR readings', () => {
    logger.start({targetZone: {minBPM: 140, maxBPM: 160}});

    const track: TrackMetadata = {
      id: 'track-1',
      title: 'Song',
      artist: 'Artist',
      album: null,
      durationSeconds: 180,
      bpm: 160,
      url: '/music/song.mp3',
      artworkUrl: null,
      genre: null,
    };
    eventBus.emit('music:changed', track);

    eventBus.emit('hr:reading', makeReading(150, Date.now()));
    eventBus.emit('hr:reading', makeReading(155, Date.now() + 1000));
    eventBus.emit('hr:reading', makeReading(148, Date.now() + 2000));

    const log = logger.stop();
    // All 3 rows should have the same track info
    for (const row of log.timeSeries) {
      expect(row.currentTrackId).toBe('track-1');
    }
  });

  it('computes session metadata correctly', () => {
    logger.start({targetZone: {minBPM: 140, maxBPM: 160}});

    const baseTime = Date.now();
    eventBus.emit('hr:reading', makeReading(130, baseTime)); // below
    eventBus.emit('hr:reading', makeReading(150, baseTime + 1000)); // in zone
    eventBus.emit('hr:reading', makeReading(170, baseTime + 2000)); // above

    const log = logger.stop();
    expect(log.metadata.avgHeartRate).toBe(150);
    expect(log.metadata.minHeartRate).toBe(130);
    expect(log.metadata.maxHeartRate).toBe(170);
  });

  it('defaults to null music/algo state when none has been emitted', () => {
    logger.start({targetZone: {minBPM: 140, maxBPM: 160}});

    eventBus.emit('hr:reading', makeReading(150, Date.now()));

    const log = logger.stop();
    expect(log.timeSeries[0].currentTrackId).toBeNull();
    expect(log.timeSeries[0].currentMode).toBe('MAINTAIN');
  });

  it('logs music:error events', () => {
    logger.start({targetZone: {minBPM: 140, maxBPM: 160}});

    eventBus.emit('music:error', {message: 'Track not found'});
    eventBus.emit('music:error', {message: 'Playback failed'});

    const log = logger.stop();
    const errors = log.entries.filter(e => e.type === 'music_error');
    expect(errors).toHaveLength(2);
    expect(errors[0].data.message).toBe('Track not found');
    expect(log.metadata.musicErrorCount).toBe(2);
  });

  it('logs music:trackSwitchBlocked events', () => {
    logger.start({targetZone: {minBPM: 140, maxBPM: 160}});

    eventBus.emit('music:trackSwitchBlocked', {
      reason: 'cooldown',
      cooldownRemainingMs: 8000,
    });

    const log = logger.stop();
    const blocked = log.entries.filter(
      e => e.type === 'music_track_switch_blocked',
    );
    expect(blocked).toHaveLength(1);
    expect(blocked[0].data.cooldownRemainingMs).toBe(8000);
    expect(log.metadata.trackSwitchBlockedCount).toBe(1);
  });

  it('logs provider lifecycle events', () => {
    logger.start({targetZone: {minBPM: 140, maxBPM: 160}});

    eventBus.emit('provider:loading', {providerName: 'spotify'});
    eventBus.emit('provider:ready', {providerName: 'spotify', trackCount: 15});

    const log = logger.stop();
    const loading = log.entries.filter(e => e.type === 'provider_loading');
    const ready = log.entries.filter(e => e.type === 'provider_ready');
    expect(loading).toHaveLength(1);
    expect(loading[0].data.providerName).toBe('spotify');
    expect(ready).toHaveLength(1);
    expect(ready[0].data.trackCount).toBe(15);
  });

  it('logs provider:error events', () => {
    logger.start({targetZone: {minBPM: 140, maxBPM: 160}});

    eventBus.emit('provider:error', {
      providerName: 'spotify',
      error: 'Auth token expired',
    });

    const log = logger.stop();
    const errors = log.entries.filter(e => e.type === 'provider_error');
    expect(errors).toHaveLength(1);
    expect(errors[0].data.error).toBe('Auth token expired');
  });

  it('logs provider:fallback events and tracks in metadata', () => {
    logger.start({targetZone: {minBPM: 140, maxBPM: 160}});

    eventBus.emit('provider:fallback', {
      from: 'spotify',
      to: 'local',
      reason: 'Auth failed',
    });

    const log = logger.stop();
    const fallbacks = log.entries.filter(e => e.type === 'provider_fallback');
    expect(fallbacks).toHaveLength(1);
    expect(fallbacks[0].data.from).toBe('spotify');
    expect(log.metadata.providerFallbacks).toHaveLength(1);
    expect(log.metadata.providerFallbacks[0]).toEqual({
      from: 'spotify',
      to: 'local',
      reason: 'Auth failed',
    });
  });
});
