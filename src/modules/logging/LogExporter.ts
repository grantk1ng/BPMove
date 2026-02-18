import type {SessionLog, TimeSeriesRow, LogEntry} from './types';

/** Generate time-series CSV — one row per HR reading, all columns present */
export function exportTimeSeriesCSV(session: SessionLog): string {
  const headers = [
    'timestamp',
    'session_elapsed_ms',
    'hr_bpm',
    'sensor_contact',
    'rr_intervals',
    'smoothed_hr',
    'current_mode',
    'consecutive_out_of_zone_ms',
    'current_target_bpm',
    'target_zone_min',
    'target_zone_max',
    'current_track_id',
    'current_track_title',
    'current_track_bpm',
    'current_track_artist',
  ];

  const rows = session.timeSeries.map(row => formatTimeSeriesRow(row));
  return [headers.join(','), ...rows].join('\n');
}

function formatTimeSeriesRow(row: TimeSeriesRow): string {
  return [
    row.timestamp,
    row.sessionElapsedMs,
    row.hrBpm,
    row.sensorContact,
    row.rrIntervals.join(';'),
    row.smoothedHR.toFixed(1),
    row.currentMode,
    row.consecutiveOutOfZoneMs,
    row.currentTargetBPM,
    row.targetZoneMin,
    row.targetZoneMax,
    csvEscape(row.currentTrackId ?? ''),
    csvEscape(row.currentTrackTitle ?? ''),
    row.currentTrackBPM ?? '',
    csvEscape(row.currentTrackArtist ?? ''),
  ].join(',');
}

/** Generate events CSV — one row per event, sparse columns per type */
export function exportEventsCSV(session: SessionLog): string {
  const headers = [
    'timestamp',
    'session_elapsed_ms',
    'type',
    'data',
  ];

  const rows = session.entries.map(entry => formatEventRow(entry));
  return [headers.join(','), ...rows].join('\n');
}

function formatEventRow(entry: LogEntry): string {
  return [
    entry.timestamp,
    entry.sessionElapsedMs,
    entry.type,
    csvEscape(JSON.stringify(entry.data)),
  ].join(',');
}

/** Generate full JSON export */
export function exportJSON(session: SessionLog): string {
  return JSON.stringify(session, null, 2);
}

function csvEscape(value: string): string {
  if (
    value.includes(',') ||
    value.includes('"') ||
    value.includes('\n')
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
