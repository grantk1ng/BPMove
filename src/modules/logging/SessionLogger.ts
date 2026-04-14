import {eventBus} from '../../core/EventBus';
import type {HeartRateReading} from '../heartrate/types';
import type {AlgorithmState, BPMTarget, AlgorithmMode} from '../algorithm/types';
import type {TrackMetadata} from '../music/types';
import type {
  LogEntry,
  TimeSeriesRow,
  SessionLog,
  SessionMetadata,
} from './types';
import {SessionMetricsComputer} from './SessionMetricsComputer';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export class SessionLogger {
  private sessionId: string = '';
  private startTime: number = 0;
  private entries: LogEntry[] = [];
  private timeSeries: TimeSeriesRow[] = [];
  private unsubscribers: (() => void)[] = [];
  private active = false;
  private metricsComputer: SessionMetricsComputer | null = null;

  // Cached latest state from other modules for time-series merging
  private cachedAlgoState: AlgorithmState | null = null;
  private cachedTrack: TrackMetadata | null = null;
  private algorithmConfig: Record<string, unknown> = {};
  private deviceName: string | null = null;

  // Metrics tracking
  private hrReadings: number[] = [];
  private trackCount = 0;
  private targetChangeCount = 0;
  private timeInZoneMs = 0;
  private timeAboveZoneMs = 0;
  private timeBelowZoneMs = 0;
  private lastReadingTimestamp: number | null = null;
  private targetZoneMin = 0;
  private targetZoneMax = 0;
  private trackSwitchBlockedCount = 0;
  private musicErrorCount = 0;
  private providerFallbacks: Array<{from: string; to: string; reason: string}> = [];

  start(config: Record<string, unknown>): string {
    this.sessionId = generateId();
    this.startTime = Date.now();
    this.entries = [];
    this.timeSeries = [];
    this.hrReadings = [];
    this.trackCount = 0;
    this.targetChangeCount = 0;
    this.timeInZoneMs = 0;
    this.timeAboveZoneMs = 0;
    this.timeBelowZoneMs = 0;
    this.lastReadingTimestamp = null;
    this.cachedAlgoState = null;
    this.cachedTrack = null;
    this.algorithmConfig = config;
    this.active = true;
    this.trackSwitchBlockedCount = 0;
    this.musicErrorCount = 0;
    this.providerFallbacks = [];
    this.metricsComputer = new SessionMetricsComputer();

    const zone = config.targetZone as {minBPM: number; maxBPM: number} | undefined;
    this.targetZoneMin = zone?.minBPM ?? 0;
    this.targetZoneMax = zone?.maxBPM ?? 0;

    // Subscribe in correct order: algo state first, then hr:reading
    this.unsubscribers.push(
      eventBus.on('algo:stateChanged', this.onAlgoStateChanged),
    );
    this.unsubscribers.push(
      eventBus.on('algo:target', this.onAlgoTarget),
    );
    this.unsubscribers.push(
      eventBus.on('algo:modeChanged', this.onModeChanged),
    );
    this.unsubscribers.push(
      eventBus.on('music:changed', this.onMusicChanged),
    );
    this.unsubscribers.push(
      eventBus.on('hr:reading', this.onHrReading),
    );
    this.unsubscribers.push(
      eventBus.on('hr:connected', this.onDeviceConnected),
    );
    this.unsubscribers.push(
      eventBus.on('hr:disconnected', this.onDeviceDisconnected),
    );
    this.unsubscribers.push(
      eventBus.on('music:error', this.onMusicError),
    );
    this.unsubscribers.push(
      eventBus.on('music:trackSwitchBlocked', this.onTrackSwitchBlocked),
    );
    this.unsubscribers.push(
      eventBus.on('provider:loading', this.onProviderLoading),
    );
    this.unsubscribers.push(
      eventBus.on('provider:ready', this.onProviderReady),
    );
    this.unsubscribers.push(
      eventBus.on('provider:error', this.onProviderError),
    );
    this.unsubscribers.push(
      eventBus.on('provider:fallback', this.onProviderFallback),
    );

    this.addEntry('session_start', {config});
    eventBus.emit('session:started', {sessionId: this.sessionId});

    return this.sessionId;
  }

  stop(reason: 'user' | 'error' | 'timeout' = 'user'): SessionLog {
    this.addEntry('session_end', {reason});
    this.active = false;
    eventBus.emit('session:ended', {sessionId: this.sessionId, reason});

    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];

    const endTime = Date.now();
    const derivedMetrics = this.metricsComputer?.computePostSessionMetrics(
      this.timeSeries,
      this.targetZoneMin,
      this.targetZoneMax,
    );
    this.metricsComputer = null;

    return {
      sessionId: this.sessionId,
      startTime: this.startTime,
      endTime,
      durationMs: endTime - this.startTime,
      algorithmConfig: this.algorithmConfig,
      deviceName: this.deviceName,
      entries: [...this.entries],
      timeSeries: [...this.timeSeries],
      metadata: {
        ...this.computeMetadata(),
        ...(derivedMetrics ?? {
          modeSwitchCount: 0,
          avgSelectionAccuracy: null,
          selectionAccuracyScores: [],
          hrResponseTimes: [],
          avgHrResponseMs: null,
        }),
      },
    };
  }

  destroy(): void {
    if (this.active) {
      this.stop();
    }
    this.unsubscribers = [];
  }

  isActive(): boolean {
    return this.active;
  }

  getEntryCount(): number {
    return this.entries.length;
  }

  getTimeSeriesCount(): number {
    return this.timeSeries.length;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  getElapsedMs(): number {
    if (!this.active) {
      return 0;
    }
    return Date.now() - this.startTime;
  }

  private addEntry(type: LogEntry['type'], data: Record<string, unknown>): void {
    this.entries.push({
      timestamp: Date.now(),
      type,
      sessionElapsedMs: Date.now() - this.startTime,
      data,
    });
  }

  private onAlgoStateChanged = (state: AlgorithmState): void => {
    this.cachedAlgoState = state;
    this.addEntry('algorithm_state', {
      smoothedHR: state.smoothedHR,
      currentMode: state.currentMode,
      currentTargetBPM: state.currentTargetBPM,
      consecutiveOutOfZoneMs: state.consecutiveOutOfZoneMs,
    });
  };

  private onAlgoTarget = (target: BPMTarget): void => {
    this.targetChangeCount++;
    this.metricsComputer?.onTargetChanged(target);
    this.addEntry('algorithm_target', {
      targetBPM: target.targetBPM,
      triggeringHR: target.triggeringHR,
      reason: target.reason,
      urgency: target.urgency,
      mode: target.mode,
    });
  };

  private onModeChanged = (event: {
    from: AlgorithmMode;
    to: AlgorithmMode;
    timestamp: number;
  }): void => {
    this.metricsComputer?.onModeChanged(event);
    this.addEntry('algorithm_mode_change', {
      from: event.from,
      to: event.to,
    });
  };

  private onMusicChanged = (track: TrackMetadata): void => {
    this.cachedTrack = track;
    this.trackCount++;
    const accuracy = this.metricsComputer?.onMusicChanged(track, Date.now());
    this.addEntry('music_change', {
      trackId: track.id,
      trackTitle: track.title,
      trackBPM: track.bpm,
      trackArtist: track.artist,
      ...(accuracy && {
        selectionAccuracy: accuracy.score,
        bpmDelta: accuracy.bpmDelta,
      }),
    });
  };

  private onHrReading = (reading: HeartRateReading): void => {
    this.hrReadings.push(reading.bpm);

    // Track time-in-zone metrics
    if (this.lastReadingTimestamp !== null) {
      const delta = reading.timestamp - this.lastReadingTimestamp;
      if (reading.bpm < this.targetZoneMin) {
        this.timeBelowZoneMs += delta;
      } else if (reading.bpm > this.targetZoneMax) {
        this.timeAboveZoneMs += delta;
      } else {
        this.timeInZoneMs += delta;
      }
    }
    this.lastReadingTimestamp = reading.timestamp;

    // Add discrete log entry
    this.addEntry('hr_reading', {
      bpm: reading.bpm,
      sensorContact: reading.sensorContact,
      rrIntervals: reading.rrIntervals,
    });

    // Build merged time-series row
    const row: TimeSeriesRow = {
      timestamp: reading.timestamp,
      sessionElapsedMs: reading.timestamp - this.startTime,
      hrBpm: reading.bpm,
      sensorContact: reading.sensorContact,
      rrIntervals: reading.rrIntervals,
      smoothedHR: this.cachedAlgoState?.smoothedHR ?? reading.bpm,
      currentMode: this.cachedAlgoState?.currentMode ?? 'MAINTAIN',
      consecutiveOutOfZoneMs:
        this.cachedAlgoState?.consecutiveOutOfZoneMs ?? 0,
      currentTargetBPM: this.cachedAlgoState?.currentTargetBPM ?? 0,
      targetZoneMin: this.targetZoneMin,
      targetZoneMax: this.targetZoneMax,
      currentTrackId: this.cachedTrack?.id ?? null,
      currentTrackTitle: this.cachedTrack?.title ?? null,
      currentTrackBPM: this.cachedTrack?.bpm ?? null,
      currentTrackArtist: this.cachedTrack?.artist ?? null,
      targetReason: null,
      targetUrgency: null,
      msSinceLastModeChange: null,
      msSinceLastMusicChange: null,
      cumulativeZoneAdherencePct: 0,
    };
    this.metricsComputer?.enrichRow(row, reading.timestamp, {
      inZone: this.timeInZoneMs,
      aboveZone: this.timeAboveZoneMs,
      belowZone: this.timeBelowZoneMs,
    });
    this.timeSeries.push(row);
  };

  private onDeviceConnected = (device: {
    id: string;
    name: string | null;
  }): void => {
    this.deviceName = device.name;
    this.addEntry('device_connected', {
      deviceId: device.id,
      deviceName: device.name,
    });
  };

  private onDeviceDisconnected = (event: {
    deviceId: string;
    reason: string;
  }): void => {
    this.addEntry('device_disconnected', {
      deviceId: event.deviceId,
      reason: event.reason,
    });
  };

  private onMusicError = (event: {message: string}): void => {
    this.musicErrorCount++;
    this.addEntry('music_error', {message: event.message});
  };

  private onTrackSwitchBlocked = (event: {
    reason: string;
    cooldownRemainingMs: number;
  }): void => {
    this.trackSwitchBlockedCount++;
    this.addEntry('music_track_switch_blocked', {
      reason: event.reason,
      cooldownRemainingMs: event.cooldownRemainingMs,
    });
  };

  private onProviderLoading = (event: {providerName: string}): void => {
    this.addEntry('provider_loading', {providerName: event.providerName});
  };

  private onProviderReady = (event: {
    providerName: string;
    trackCount: number;
  }): void => {
    this.addEntry('provider_ready', {
      providerName: event.providerName,
      trackCount: event.trackCount,
    });
  };

  private onProviderError = (event: {
    providerName: string;
    error: string;
  }): void => {
    this.addEntry('provider_error', {
      providerName: event.providerName,
      error: event.error,
    });
  };

  private onProviderFallback = (event: {
    from: string;
    to: string;
    reason: string;
  }): void => {
    this.providerFallbacks.push(event);
    this.addEntry('provider_fallback', {
      from: event.from,
      to: event.to,
      reason: event.reason,
    });
  };

  private computeMetadata(): SessionMetadata {
    const hrs = this.hrReadings;
    return {
      avgHeartRate: hrs.length > 0
        ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length)
        : null,
      maxHeartRate: hrs.length > 0 ? Math.max(...hrs) : null,
      minHeartRate: hrs.length > 0 ? Math.min(...hrs) : null,
      totalTracksPlayed: this.trackCount,
      totalBPMTargetChanges: this.targetChangeCount,
      timeInZoneMs: this.timeInZoneMs,
      timeAboveZoneMs: this.timeAboveZoneMs,
      timeBelowZoneMs: this.timeBelowZoneMs,
      modeSwitchCount: 0,
      avgSelectionAccuracy: null,
      selectionAccuracyScores: [],
      hrResponseTimes: [],
      avgHrResponseMs: null,
      trackSwitchBlockedCount: this.trackSwitchBlockedCount,
      musicErrorCount: this.musicErrorCount,
      providerFallbacks: [...this.providerFallbacks],
    };
  }
}
