import type {AlgorithmMode, BPMTarget} from '../algorithm/types';
import type {TrackMetadata} from '../music/types';
import type {
  TimeSeriesRow,
  DerivedSessionMetrics,
  SelectionAccuracyEntry,
} from './types';

export const MAX_SELECTION_TOLERANCE = 15;

export class SessionMetricsComputer {
  private lastModeChangeTimestamp: number | null = null;
  private lastMusicChangeTimestamp: number | null = null;
  private modeChanges: Array<{
    from: AlgorithmMode;
    to: AlgorithmMode;
    timestamp: number;
  }> = [];
  private trackSelections: Array<{
    trackBPM: number;
    targetBPM: number;
    timestamp: number;
  }> = [];
  private lastTargetBPM: number | null = null;
  private lastTargetReason: string | null = null;
  private lastTargetUrgency: number | null = null;

  onTargetChanged(target: BPMTarget): void {
    this.lastTargetBPM = target.targetBPM;
    this.lastTargetReason = target.reason;
    this.lastTargetUrgency = target.urgency;
  }

  onModeChanged(event: {
    from: AlgorithmMode;
    to: AlgorithmMode;
    timestamp: number;
  }): void {
    this.modeChanges.push(event);
    this.lastModeChangeTimestamp = event.timestamp;
  }

  onMusicChanged(
    track: TrackMetadata,
    timestamp: number,
  ): SelectionAccuracyEntry | null {
    this.lastMusicChangeTimestamp = timestamp;

    if (this.lastTargetBPM === null) {
      return null;
    }

    const bpmDelta = Math.abs(track.bpm - this.lastTargetBPM);
    const score = Math.max(0, 1 - bpmDelta / MAX_SELECTION_TOLERANCE);

    this.trackSelections.push({
      trackBPM: track.bpm,
      targetBPM: this.lastTargetBPM,
      timestamp,
    });

    return {bpmDelta, score};
  }

  enrichRow(
    row: TimeSeriesRow,
    now: number,
    zoneMs: {inZone: number; aboveZone: number; belowZone: number},
  ): void {
    row.targetReason = this.lastTargetReason;
    row.targetUrgency = this.lastTargetUrgency;
    row.msSinceLastModeChange =
      this.lastModeChangeTimestamp !== null
        ? now - this.lastModeChangeTimestamp
        : null;
    row.msSinceLastMusicChange =
      this.lastMusicChangeTimestamp !== null
        ? now - this.lastMusicChangeTimestamp
        : null;

    const total = zoneMs.inZone + zoneMs.aboveZone + zoneMs.belowZone;
    row.cumulativeZoneAdherencePct =
      total > 0 ? (zoneMs.inZone / total) * 100 : 0;
  }

  computePostSessionMetrics(
    timeSeries: TimeSeriesRow[],
    zoneMin: number,
    zoneMax: number,
  ): DerivedSessionMetrics {
    const modeSwitchCount = this.modeChanges.length;

    const selectionAccuracyScores: SelectionAccuracyEntry[] =
      this.trackSelections.map(sel => {
        const bpmDelta = Math.abs(sel.trackBPM - sel.targetBPM);
        const score = Math.max(0, 1 - bpmDelta / MAX_SELECTION_TOLERANCE);
        return {bpmDelta, score};
      });

    const avgSelectionAccuracy =
      selectionAccuracyScores.length > 0
        ? selectionAccuracyScores.reduce((sum, e) => sum + e.score, 0) /
          selectionAccuracyScores.length
        : null;

    const hrResponseTimes = this.computeHrResponseTimes(
      timeSeries,
      zoneMin,
      zoneMax,
    );

    const nonNullResponses = hrResponseTimes
      .map(r => r.responseMs)
      .filter((ms): ms is number => ms !== null);

    const avgHrResponseMs =
      nonNullResponses.length > 0
        ? nonNullResponses.reduce((sum, ms) => sum + ms, 0) /
          nonNullResponses.length
        : null;

    return {
      modeSwitchCount,
      avgSelectionAccuracy,
      selectionAccuracyScores,
      hrResponseTimes,
      avgHrResponseMs,
    };
  }

  private computeHrResponseTimes(
    timeSeries: TimeSeriesRow[],
    zoneMin: number,
    zoneMax: number,
  ): Array<{
    from: AlgorithmMode;
    to: AlgorithmMode;
    responseMs: number | null;
  }> {
    return this.modeChanges
      .filter(mc => mc.to === 'RAISE' || mc.to === 'LOWER')
      .map(mc => {
        let responseMs: number | null = null;

        for (const row of timeSeries) {
          if (row.timestamp < mc.timestamp) {
            continue;
          }
          if (row.smoothedHR >= zoneMin && row.smoothedHR <= zoneMax) {
            responseMs = row.timestamp - mc.timestamp;
            break;
          }
        }

        return {from: mc.from, to: mc.to, responseMs};
      });
  }
}
