import {eventBus} from '../../core/EventBus';
import type {AlgorithmMode, BPMTarget} from '../algorithm/types';
import type {TrackMetadata, PlaybackState} from './types';
import {selectTrack} from './TrackSelector';
import type {MusicLibraryManager} from './MusicLibraryManager';
import type {TrackProvider} from './providers/types';

const MIN_TRACK_SWITCH_INTERVAL_MS = 12_000;
const RECENT_TRACK_HISTORY_SIZE = 5;

export class MusicPlayerService {
  private currentTrack: TrackMetadata | null = null;
  private libraryManager: MusicLibraryManager;
  private unsubscribers: (() => void)[] = [];
  private targetBPM: number | null = null;
  private activeProvider: TrackProvider | null = null;
  private isPlaying = false;
  private positionSeconds = 0;
  private durationSeconds = 0;
  private targetMode: AlgorithmMode = 'MAINTAIN';
  private triggeringHR: number | null = null;
  private lastTrackSwitchTimestamp = 0;
  private recentTrackIds: string[] = [];
  private started = false;

  constructor(libraryManager: MusicLibraryManager) {
    this.libraryManager = libraryManager;
  }

  setActiveProvider(provider: TrackProvider): void {
    this.activeProvider = provider;
  }

  start(): void {
    if (this.started) {
      return;
    }

    this.started = true;
    this.unsubscribers.push(
      eventBus.on('algo:target', this.onAlgoTarget),
      eventBus.on('music:trackEnded', this.onTrackEnded),
      eventBus.on(
        'music:providerPlaybackChanged',
        this.onProviderPlaybackChanged,
      ),
    );
  }

  stop(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
    this.started = false;
    this.activeProvider?.stop();
    this.resetSessionState();
    this.emitStoppedPlaybackState();
  }

  async play(): Promise<void> {
    if (!this.activeProvider) {
      return;
    }

    const result = await this.activeProvider.resume();
    if (!result.ok) {
      eventBus.emit('music:error', {message: result.error});
      return;
    }

    this.isPlaying = true;
    this.emitPlaybackStateSnapshot();
    this.refreshPlaybackState().catch(() => {});
  }

  async pause(): Promise<void> {
    if (!this.activeProvider) {
      return;
    }

    const result = await this.activeProvider.pause();
    if (!result.ok) {
      eventBus.emit('music:error', {message: result.error});
      return;
    }

    this.isPlaying = false;
    this.emitPlaybackStateSnapshot();
    this.refreshPlaybackState().catch(() => {});
  }

  async skip(): Promise<void> {
    if (!this.activeProvider) {
      return;
    }

    const library = this.libraryManager.getLibrary();
    if (library.tracks.length === 0) {
      return;
    }

    if (this.currentTrack) {
      this.pushRecentTrack(this.currentTrack.id);
    }

    const targetBPM = this.targetBPM ?? this.currentTrack?.bpm ?? 120;
    const selection = this.selectTrackForSkip(targetBPM);

    if (!selection || selection.track.id === this.currentTrack?.id) {
      return;
    }

    this.pushRecentTrack(selection.track.id);
    this.currentTrack = selection.track;
    this.lastTrackSwitchTimestamp = Date.now();

    const result = await this.activeProvider.playTrack(selection.track);
    if (result.ok) {
      this.isPlaying = true;
      this.positionSeconds = 0;
      this.durationSeconds = selection.track.durationSeconds;
      eventBus.emit('music:changed', selection.track);
      this.emitPlaybackStateSnapshot();
      this.refreshPlaybackState().catch(() => {});
    } else {
      eventBus.emit('music:error', {message: result.error});
    }
  }

  getCurrentTrack(): TrackMetadata | null {
    return this.currentTrack;
  }

  getPlaybackSnapshot(): PlaybackState {
    return {
      currentTrack: this.currentTrack,
      isPlaying: this.isPlaying,
      positionSeconds: this.positionSeconds,
      durationSeconds: this.durationSeconds,
      targetBPM: this.targetBPM,
    };
  }

  async refreshPlaybackState(): Promise<void> {
    await this.emitPlaybackState();
  }

  async destroy(): Promise<void> {
    this.stop();
    await this.activeProvider?.stop();
  }

  private onAlgoTarget = async (target: BPMTarget): Promise<void> => {
    this.targetBPM = target.targetBPM;
    this.targetMode = target.mode;
    this.triggeringHR = target.triggeringHR;
    await this.selectAndPlay(target.targetBPM, false, {
      mode: target.mode,
      triggeringHR: target.triggeringHR,
    });
  };

  private onTrackEnded = async (): Promise<void> => {
    this.isPlaying = false;
    this.positionSeconds = this.durationSeconds;
    this.emitPlaybackStateSnapshot();
    if (this.targetBPM !== null) {
      await this.selectAndPlay(this.targetBPM, true, {
        mode: this.targetMode,
        triggeringHR: this.triggeringHR ?? undefined,
      });
    }
  };

  private onProviderPlaybackChanged = ({
    providerName,
    trackId,
    isPlaying,
    positionSeconds,
    durationSeconds,
  }: {
    providerName: string;
    trackId: string | null;
    isPlaying: boolean;
    positionSeconds: number;
    durationSeconds: number;
  }): void => {
    if (!this.activeProvider || this.activeProvider.info.name !== providerName) {
      return;
    }

    if (trackId && trackId !== this.currentTrack?.id && this.currentTrack) {
      this.pushRecentTrack(this.currentTrack.id);
    }

    if (trackId === null) {
      this.currentTrack = null;
    } else if (trackId !== this.currentTrack?.id) {
      const syncedTrack = this.libraryManager
        .getLibrary()
        .tracks.find(track => track.id === trackId);
      this.currentTrack = syncedTrack ?? null;
    }

    this.isPlaying = isPlaying;
    this.positionSeconds = positionSeconds;
    this.durationSeconds = durationSeconds;
    this.emitPlaybackStateSnapshot();
  };

  private async selectAndPlay(
    targetBPM: number,
    bypassCooldown = false,
    options?: {mode?: AlgorithmMode; triggeringHR?: number},
  ): Promise<void> {
    if (!this.activeProvider) {
      return;
    }

    const now = Date.now();
    const elapsed = now - this.lastTrackSwitchTimestamp;

    if (!bypassCooldown && elapsed < MIN_TRACK_SWITCH_INTERVAL_MS) {
      eventBus.emit('music:trackSwitchBlocked', {
        reason: 'cooldown',
        cooldownRemainingMs: MIN_TRACK_SWITCH_INTERVAL_MS - elapsed,
      });
      return;
    }

    const library = this.libraryManager.getLibrary();
    const selection = selectTrack(
      targetBPM,
      library,
      this.recentTrackIds,
      options,
    );

    if (!selection) {
      return;
    }

    if (selection.track.id === this.currentTrack?.id) {
      return;
    }

    this.pushRecentTrack(selection.track.id);
    this.currentTrack = selection.track;
    this.lastTrackSwitchTimestamp = now;

    const result = await this.activeProvider.playTrack(selection.track);
    if (result.ok) {
      this.isPlaying = true;
      this.positionSeconds = 0;
      this.durationSeconds = selection.track.durationSeconds;
      eventBus.emit('music:changed', selection.track);
      this.emitPlaybackStateSnapshot();
      this.refreshPlaybackState().catch(() => {});
    } else {
      eventBus.emit('music:error', {message: result.error});
    }
  }

  private selectTrackForSkip(targetBPM: number) {
    const library = this.libraryManager.getLibrary();
    const selection = selectTrack(targetBPM, library, this.recentTrackIds);
    if (selection && selection.track.id !== this.currentTrack?.id) {
      return selection;
    }

    const alternatives = library.tracks
      .filter(track => track.id !== this.currentTrack?.id)
      .sort(
        (a, b) =>
          Math.abs(a.bpm - targetBPM) - Math.abs(b.bpm - targetBPM),
      );

    if (alternatives.length === 0) {
      return null;
    }

    const recentSet = new Set(this.recentTrackIds);
    const nextTrack =
      alternatives.find(track => !recentSet.has(track.id)) ?? alternatives[0];

    return {
      track: nextTrack,
      actualBPM: nextTrack.bpm,
      requestedBPM: targetBPM,
      bpmDelta: Math.abs(nextTrack.bpm - targetBPM),
    };
  }

  private pushRecentTrack(trackId: string): void {
    this.recentTrackIds.push(trackId);
    if (this.recentTrackIds.length > RECENT_TRACK_HISTORY_SIZE) {
      this.recentTrackIds.shift();
    }
  }

  private resetSessionState(): void {
    this.currentTrack = null;
    this.targetBPM = null;
    this.isPlaying = false;
    this.positionSeconds = 0;
    this.durationSeconds = 0;
    this.targetMode = 'MAINTAIN';
    this.triggeringHR = null;
    this.lastTrackSwitchTimestamp = 0;
    this.recentTrackIds = [];
  }

  private emitStoppedPlaybackState(): void {
    this.emitPlaybackStateSnapshot();
  }

  private emitPlaybackStateSnapshot(): void {
    eventBus.emit('music:playbackStateChanged', this.getPlaybackSnapshot());
  }

  private async emitPlaybackState(): Promise<void> {
    if (!this.activeProvider) {
      return;
    }

    try {
      const posResult = await this.activeProvider.getPosition();
      const position = posResult.ok ? posResult.data : {positionSeconds: 0, durationSeconds: 0};

      this.positionSeconds = position.positionSeconds;
      this.durationSeconds =
        position.durationSeconds || this.currentTrack?.durationSeconds || 0;

      const playbackState: PlaybackState = {
        currentTrack: this.currentTrack,
        isPlaying: this.isPlaying,
        positionSeconds: this.positionSeconds,
        durationSeconds: this.durationSeconds,
        targetBPM: this.targetBPM,
      };

      eventBus.emit('music:playbackStateChanged', playbackState);
    } catch {
      // Provider may not be initialized yet
    }
  }
}
