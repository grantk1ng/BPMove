import {SessionMetricsComputer, MAX_SELECTION_TOLERANCE} from '../SessionMetricsComputer';
import type {TimeSeriesRow} from '../types';
import type {BPMTarget, AlgorithmMode} from '../../algorithm/types';
import type {TrackMetadata} from '../../music/types';

function makeRow(overrides: Partial<TimeSeriesRow> = {}): TimeSeriesRow {
  return {
    timestamp: 0,
    sessionElapsedMs: 0,
    hrBpm: 140,
    sensorContact: true,
    rrIntervals: [],
    smoothedHR: 140,
    currentMode: 'MAINTAIN',
    consecutiveOutOfZoneMs: 0,
    currentTargetBPM: 150,
    targetZoneMin: 130,
    targetZoneMax: 150,
    currentTrackId: null,
    currentTrackTitle: null,
    currentTrackBPM: null,
    currentTrackArtist: null,
    targetReason: null,
    targetUrgency: null,
    msSinceLastModeChange: null,
    msSinceLastMusicChange: null,
    cumulativeZoneAdherencePct: 0,
    ...overrides,
  };
}

function makeTarget(overrides: Partial<BPMTarget> = {}): BPMTarget {
  return {
    targetBPM: 150,
    triggeringHR: 140,
    timestamp: 1000,
    reason: 'Mode RAISE: HR 140 below zone [130-150]',
    urgency: 0.5,
    mode: 'RAISE' as AlgorithmMode,
    ...overrides,
  };
}

function makeTrack(overrides: Partial<TrackMetadata> = {}): TrackMetadata {
  return {
    id: 'track-1',
    title: 'Test Song',
    artist: 'Test Artist',
    album: null,
    durationSeconds: 180,
    bpm: 150,
    url: 'test.mp3',
    artworkUrl: null,
    genre: null,
    ...overrides,
  };
}

describe('SessionMetricsComputer', () => {
  let computer: SessionMetricsComputer;

  beforeEach(() => {
    computer = new SessionMetricsComputer();
  });

  describe('enrichRow', () => {
    it('populates targetReason and targetUrgency from cached target', () => {
      computer.onTargetChanged(makeTarget({
        reason: 'Mode RAISE: HR 125 below zone',
        urgency: 0.7,
      }));

      const row = makeRow();
      computer.enrichRow(row, 2000, {inZone: 5000, aboveZone: 0, belowZone: 0});

      expect(row.targetReason).toBe('Mode RAISE: HR 125 below zone');
      expect(row.targetUrgency).toBe(0.7);
    });

    it('populates msSinceLastModeChange when a mode change has occurred', () => {
      computer.onModeChanged({from: 'MAINTAIN', to: 'RAISE', timestamp: 1000});

      const row = makeRow();
      computer.enrichRow(row, 3000, {inZone: 0, aboveZone: 0, belowZone: 0});

      expect(row.msSinceLastModeChange).toBe(2000);
    });

    it('populates msSinceLastMusicChange when a music change has occurred', () => {
      computer.onTargetChanged(makeTarget());
      computer.onMusicChanged(makeTrack(), 1000);

      const row = makeRow();
      computer.enrichRow(row, 5000, {inZone: 0, aboveZone: 0, belowZone: 0});

      expect(row.msSinceLastMusicChange).toBe(4000);
    });

    it('sets msSinceLastModeChange to null when no mode change has occurred', () => {
      const row = makeRow();
      computer.enrichRow(row, 2000, {inZone: 0, aboveZone: 0, belowZone: 0});

      expect(row.msSinceLastModeChange).toBeNull();
    });

    it('sets msSinceLastMusicChange to null when no music change has occurred', () => {
      const row = makeRow();
      computer.enrichRow(row, 2000, {inZone: 0, aboveZone: 0, belowZone: 0});

      expect(row.msSinceLastMusicChange).toBeNull();
    });

    it('computes cumulativeZoneAdherencePct correctly', () => {
      const row = makeRow();
      computer.enrichRow(row, 1000, {inZone: 5000, aboveZone: 3000, belowZone: 2000});

      expect(row.cumulativeZoneAdherencePct).toBe(50);
    });

    it('returns 0 for cumulativeZoneAdherencePct when total zone time is 0', () => {
      const row = makeRow();
      computer.enrichRow(row, 1000, {inZone: 0, aboveZone: 0, belowZone: 0});

      expect(row.cumulativeZoneAdherencePct).toBe(0);
    });

    it('leaves reason/urgency null when no target has been received', () => {
      const row = makeRow();
      computer.enrichRow(row, 1000, {inZone: 0, aboveZone: 0, belowZone: 0});

      expect(row.targetReason).toBeNull();
      expect(row.targetUrgency).toBeNull();
    });
  });

  describe('selection accuracy', () => {
    it('scores 1.0 for exact BPM match (delta = 0)', () => {
      computer.onTargetChanged(makeTarget({targetBPM: 150}));
      computer.onMusicChanged(makeTrack({bpm: 150}), 1000);

      const metrics = computer.computePostSessionMetrics([], 130, 150);
      expect(metrics.selectionAccuracyScores).toHaveLength(1);
      expect(metrics.selectionAccuracyScores[0].bpmDelta).toBe(0);
      expect(metrics.selectionAccuracyScores[0].score).toBe(1);
    });

    it('scores ~0.67 for delta = 5', () => {
      computer.onTargetChanged(makeTarget({targetBPM: 150}));
      computer.onMusicChanged(makeTrack({bpm: 155}), 1000);

      const metrics = computer.computePostSessionMetrics([], 130, 150);
      expect(metrics.selectionAccuracyScores[0].bpmDelta).toBe(5);
      expect(metrics.selectionAccuracyScores[0].score).toBeCloseTo(0.667, 2);
    });

    it('scores ~0.33 for delta = 10', () => {
      computer.onTargetChanged(makeTarget({targetBPM: 150}));
      computer.onMusicChanged(makeTrack({bpm: 160}), 1000);

      const metrics = computer.computePostSessionMetrics([], 130, 150);
      expect(metrics.selectionAccuracyScores[0].bpmDelta).toBe(10);
      expect(metrics.selectionAccuracyScores[0].score).toBeCloseTo(0.333, 2);
    });

    it('scores 0.0 for delta = 15', () => {
      computer.onTargetChanged(makeTarget({targetBPM: 150}));
      computer.onMusicChanged(makeTrack({bpm: 165}), 1000);

      const metrics = computer.computePostSessionMetrics([], 130, 150);
      expect(metrics.selectionAccuracyScores[0].bpmDelta).toBe(15);
      expect(metrics.selectionAccuracyScores[0].score).toBe(0);
    });

    it('scores 0.0 for delta > 15 (clamped, not negative)', () => {
      computer.onTargetChanged(makeTarget({targetBPM: 150}));
      computer.onMusicChanged(makeTrack({bpm: 175}), 1000);

      const metrics = computer.computePostSessionMetrics([], 130, 150);
      expect(metrics.selectionAccuracyScores[0].bpmDelta).toBe(25);
      expect(metrics.selectionAccuracyScores[0].score).toBe(0);
    });

    it('does not record selection if no target has been set', () => {
      computer.onMusicChanged(makeTrack(), 1000);

      const metrics = computer.computePostSessionMetrics([], 130, 150);
      expect(metrics.selectionAccuracyScores).toHaveLength(0);
      expect(metrics.avgSelectionAccuracy).toBeNull();
    });

    it('returns correct avgSelectionAccuracy across multiple selections', () => {
      computer.onTargetChanged(makeTarget({targetBPM: 150}));
      computer.onMusicChanged(makeTrack({bpm: 150}), 1000); // score 1.0
      computer.onMusicChanged(makeTrack({bpm: 160}), 2000); // score ~0.33

      const metrics = computer.computePostSessionMetrics([], 130, 150);
      expect(metrics.selectionAccuracyScores).toHaveLength(2);
      expect(metrics.avgSelectionAccuracy).toBeCloseTo(0.667, 2);
    });

    it('returns the accuracy entry from onMusicChanged', () => {
      computer.onTargetChanged(makeTarget({targetBPM: 150}));
      const entry = computer.onMusicChanged(makeTrack({bpm: 155}), 1000);

      expect(entry).not.toBeNull();
      expect(entry!.bpmDelta).toBe(5);
      expect(entry!.score).toBeCloseTo(0.667, 2);
    });

    it('returns null from onMusicChanged when no target set', () => {
      const entry = computer.onMusicChanged(makeTrack(), 1000);
      expect(entry).toBeNull();
    });

    it('exports MAX_SELECTION_TOLERANCE as 15', () => {
      expect(MAX_SELECTION_TOLERANCE).toBe(15);
    });
  });

  describe('HR response time', () => {
    it('computes responseMs when HR returns to zone after RAISE', () => {
      computer.onModeChanged({from: 'MAINTAIN', to: 'RAISE', timestamp: 1000});

      const timeSeries = [
        makeRow({timestamp: 1000, smoothedHR: 120}),
        makeRow({timestamp: 2000, smoothedHR: 125}),
        makeRow({timestamp: 3000, smoothedHR: 135}),
      ];

      const metrics = computer.computePostSessionMetrics(timeSeries, 130, 150);
      expect(metrics.hrResponseTimes).toHaveLength(1);
      expect(metrics.hrResponseTimes[0].from).toBe('MAINTAIN');
      expect(metrics.hrResponseTimes[0].to).toBe('RAISE');
      expect(metrics.hrResponseTimes[0].responseMs).toBe(2000);
    });

    it('returns null responseMs when HR never returns to zone', () => {
      computer.onModeChanged({from: 'MAINTAIN', to: 'RAISE', timestamp: 1000});

      const timeSeries = [
        makeRow({timestamp: 1000, smoothedHR: 120}),
        makeRow({timestamp: 2000, smoothedHR: 122}),
        makeRow({timestamp: 3000, smoothedHR: 125}),
      ];

      const metrics = computer.computePostSessionMetrics(timeSeries, 130, 150);
      expect(metrics.hrResponseTimes[0].responseMs).toBeNull();
    });

    it('computes response time for LOWER mode transitions', () => {
      computer.onModeChanged({from: 'MAINTAIN', to: 'LOWER', timestamp: 1000});

      const timeSeries = [
        makeRow({timestamp: 1000, smoothedHR: 160}),
        makeRow({timestamp: 2000, smoothedHR: 155}),
        makeRow({timestamp: 3000, smoothedHR: 145}),
      ];

      const metrics = computer.computePostSessionMetrics(timeSeries, 130, 150);
      expect(metrics.hrResponseTimes).toHaveLength(1);
      expect(metrics.hrResponseTimes[0].to).toBe('LOWER');
      expect(metrics.hrResponseTimes[0].responseMs).toBe(2000);
    });

    it('skips MAINTAIN mode transitions', () => {
      computer.onModeChanged({from: 'RAISE', to: 'MAINTAIN', timestamp: 1000});

      const metrics = computer.computePostSessionMetrics([], 130, 150);
      expect(metrics.hrResponseTimes).toHaveLength(0);
    });

    it('handles multiple mode changes with mixed results', () => {
      computer.onModeChanged({from: 'MAINTAIN', to: 'RAISE', timestamp: 1000});
      computer.onModeChanged({from: 'RAISE', to: 'MAINTAIN', timestamp: 3000});
      computer.onModeChanged({from: 'MAINTAIN', to: 'LOWER', timestamp: 5000});

      const timeSeries = [
        makeRow({timestamp: 1000, smoothedHR: 120}),
        makeRow({timestamp: 2000, smoothedHR: 135}),
        makeRow({timestamp: 5000, smoothedHR: 160}),
        makeRow({timestamp: 6000, smoothedHR: 155}),
        makeRow({timestamp: 7000, smoothedHR: 140}),
      ];

      const metrics = computer.computePostSessionMetrics(timeSeries, 130, 150);
      // Only RAISE and LOWER transitions tracked
      expect(metrics.hrResponseTimes).toHaveLength(2);
      expect(metrics.hrResponseTimes[0].responseMs).toBe(1000); // RAISE: 2000-1000
      expect(metrics.hrResponseTimes[1].responseMs).toBe(2000); // LOWER: 7000-5000
    });
  });

  describe('computePostSessionMetrics', () => {
    it('returns correct modeSwitchCount', () => {
      computer.onModeChanged({from: 'MAINTAIN', to: 'RAISE', timestamp: 1000});
      computer.onModeChanged({from: 'RAISE', to: 'MAINTAIN', timestamp: 2000});
      computer.onModeChanged({from: 'MAINTAIN', to: 'LOWER', timestamp: 3000});

      const metrics = computer.computePostSessionMetrics([], 130, 150);
      expect(metrics.modeSwitchCount).toBe(3);
    });

    it('returns null avgSelectionAccuracy when no tracks were selected', () => {
      const metrics = computer.computePostSessionMetrics([], 130, 150);
      expect(metrics.avgSelectionAccuracy).toBeNull();
    });

    it('returns null avgHrResponseMs when all response times are null', () => {
      computer.onModeChanged({from: 'MAINTAIN', to: 'RAISE', timestamp: 1000});

      const timeSeries = [
        makeRow({timestamp: 1000, smoothedHR: 120}),
      ];

      const metrics = computer.computePostSessionMetrics(timeSeries, 130, 150);
      expect(metrics.avgHrResponseMs).toBeNull();
    });

    it('averages only non-null response times', () => {
      computer.onModeChanged({from: 'MAINTAIN', to: 'RAISE', timestamp: 1000});
      computer.onModeChanged({from: 'RAISE', to: 'LOWER', timestamp: 5000});

      const timeSeries = [
        makeRow({timestamp: 1000, smoothedHR: 120}),
        makeRow({timestamp: 3000, smoothedHR: 140}), // RAISE returns at 3000
        makeRow({timestamp: 5000, smoothedHR: 160}),
        // LOWER never returns
      ];

      const metrics = computer.computePostSessionMetrics(timeSeries, 130, 150);
      expect(metrics.hrResponseTimes).toHaveLength(2);
      expect(metrics.hrResponseTimes[0].responseMs).toBe(2000);
      expect(metrics.hrResponseTimes[1].responseMs).toBeNull();
      expect(metrics.avgHrResponseMs).toBe(2000);
    });
  });

  describe('edge cases', () => {
    it('handles no mode changes gracefully', () => {
      const metrics = computer.computePostSessionMetrics([], 130, 150);
      expect(metrics.modeSwitchCount).toBe(0);
      expect(metrics.hrResponseTimes).toHaveLength(0);
      expect(metrics.avgHrResponseMs).toBeNull();
    });

    it('handles no music changes gracefully', () => {
      const metrics = computer.computePostSessionMetrics([], 130, 150);
      expect(metrics.selectionAccuracyScores).toHaveLength(0);
      expect(metrics.avgSelectionAccuracy).toBeNull();
    });

    it('handles empty timeSeries', () => {
      computer.onModeChanged({from: 'MAINTAIN', to: 'RAISE', timestamp: 1000});
      const metrics = computer.computePostSessionMetrics([], 130, 150);
      expect(metrics.hrResponseTimes[0].responseMs).toBeNull();
    });
  });
});
