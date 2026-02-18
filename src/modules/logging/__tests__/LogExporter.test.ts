import {
  exportTimeSeriesCSV,
  exportEventsCSV,
  exportJSON,
} from '../LogExporter';
import type {SessionLog} from '../types';

function makeSessionLog(): SessionLog {
  return {
    sessionId: 'test-session-123',
    startTime: 1700000000000,
    endTime: 1700000060000,
    durationMs: 60000,
    algorithmConfig: {strategyName: 'linear'},
    deviceName: 'Test HR Monitor',
    entries: [
      {
        timestamp: 1700000001000,
        type: 'session_start',
        sessionElapsedMs: 1000,
        data: {config: {}},
      },
      {
        timestamp: 1700000002000,
        type: 'hr_reading',
        sessionElapsedMs: 2000,
        data: {bpm: 150},
      },
    ],
    timeSeries: [
      {
        timestamp: 1700000002000,
        sessionElapsedMs: 2000,
        hrBpm: 150,
        sensorContact: true,
        rrIntervals: [800, 810],
        smoothedHR: 148.5,
        currentMode: 'MAINTAIN',
        consecutiveOutOfZoneMs: 0,
        currentTargetBPM: 155,
        targetZoneMin: 140,
        targetZoneMax: 160,
        currentTrackId: 'track-1',
        currentTrackTitle: 'Test Song',
        currentTrackBPM: 155,
        currentTrackArtist: 'Test Artist',
      },
      {
        timestamp: 1700000003000,
        sessionElapsedMs: 3000,
        hrBpm: 155,
        sensorContact: true,
        rrIntervals: [],
        smoothedHR: 152.5,
        currentMode: 'MAINTAIN',
        consecutiveOutOfZoneMs: 0,
        currentTargetBPM: 155,
        targetZoneMin: 140,
        targetZoneMax: 160,
        currentTrackId: 'track-1',
        currentTrackTitle: 'Test Song',
        currentTrackBPM: 155,
        currentTrackArtist: 'Test Artist',
      },
    ],
    metadata: {
      avgHeartRate: 152,
      maxHeartRate: 155,
      minHeartRate: 150,
      totalTracksPlayed: 1,
      totalBPMTargetChanges: 0,
      timeInZoneMs: 58000,
      timeAboveZoneMs: 1000,
      timeBelowZoneMs: 1000,
    },
  };
}

describe('LogExporter', () => {
  describe('exportTimeSeriesCSV', () => {
    it('produces correct headers', () => {
      const csv = exportTimeSeriesCSV(makeSessionLog());
      const headers = csv.split('\n')[0];
      expect(headers).toContain('timestamp');
      expect(headers).toContain('hr_bpm');
      expect(headers).toContain('current_mode');
      expect(headers).toContain('current_target_bpm');
      expect(headers).toContain('current_track_title');
    });

    it('produces one data row per time-series entry', () => {
      const csv = exportTimeSeriesCSV(makeSessionLog());
      const lines = csv.split('\n');
      // 1 header + 2 data rows
      expect(lines).toHaveLength(3);
    });

    it('serializes RR intervals as semicolon-separated', () => {
      const csv = exportTimeSeriesCSV(makeSessionLog());
      const firstDataRow = csv.split('\n')[1];
      expect(firstDataRow).toContain('800;810');
    });
  });

  describe('exportEventsCSV', () => {
    it('produces correct headers', () => {
      const csv = exportEventsCSV(makeSessionLog());
      const headers = csv.split('\n')[0];
      expect(headers).toBe('timestamp,session_elapsed_ms,type,data');
    });

    it('produces one row per event', () => {
      const csv = exportEventsCSV(makeSessionLog());
      const lines = csv.split('\n');
      expect(lines).toHaveLength(3); // header + 2 events
    });
  });

  describe('exportJSON', () => {
    it('produces valid JSON', () => {
      const json = exportJSON(makeSessionLog());
      const parsed = JSON.parse(json);
      expect(parsed.sessionId).toBe('test-session-123');
      expect(parsed.timeSeries).toHaveLength(2);
      expect(parsed.entries).toHaveLength(2);
    });

    it('preserves metadata', () => {
      const json = exportJSON(makeSessionLog());
      const parsed = JSON.parse(json);
      expect(parsed.metadata.avgHeartRate).toBe(152);
    });
  });
});
