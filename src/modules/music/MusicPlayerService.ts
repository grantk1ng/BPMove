import {eventBus} from '../../core/EventBus';
import type {BPMTarget} from '../algorithm/types';
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
  private lastTrackSwitchTimestamp = 0;
  private recentTrackIds: string[] = [];

  constructor(libraryManager: MusicLibraryManager) {
    this.libraryManager = libraryManager;
  }

  setActiveProvider(provider: TrackProvider): void {
    this.activeProvider = provider;
  }

  start(): void {
    this.unsubscribers.push(
      eventBus.on('algo:target', this.onAlgoTarget),
      eventBus.on('music:trackEnded', this.onTrackEnded),
    );
  }

  stop(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
    this.activeProvider?.stop();
  }

  async play(): Promise<void> {
    if (!this.activeProvider) {
      return;
    }
    await this.activeProvider.resume();
    this.isPlaying = true;
    this.emitPlaybackState();
  }

  async pause(): Promise<void> {
    if (!this.activeProvider) {
      return;
    }
    await this.activeProvider.pause();
    this.isPlaying = false;
    this.emitPlaybackState();
  }

  async skip(): Promise<void> {
    if (!this.activeProvider) {
      return;
    }

    const library = this.libraryManager.getLibrary();
    if (library.tracks.length === 0) {
      return;
    }

    const targetBPM = this.targetBPM ?? this.currentTrack?.bpm ?? 120;
    const selection = selectTrack(targetBPM, library, this.recentTrackIds);

    if (!selection) {
      return;
    }

    this.pushRecentTrack(selection.track.id);
    this.currentTrack = selection.track;
    this.lastTrackSwitchTimestamp = Date.now();

    const result = await this.activeProvider.playTrack(selection.track);
    if (result.ok) {
      this.isPlaying = true;
      eventBus.emit('music:changed', selection.track);
    } else {
      eventBus.emit('music:error', {message: result.error});
    }
  }

  getCurrentTrack(): TrackMetadata | null {
    return this.currentTrack;
  }

  async destroy(): Promise<void> {
    this.stop();
    await this.activeProvider?.stop();
  }

  private onAlgoTarget = async (target: BPMTarget): Promise<void> => {
    this.targetBPM = target.targetBPM;
    await this.selectAndPlay(target.targetBPM);
  };

  private onTrackEnded = async (): Promise<void> => {
    this.isPlaying = false;
    this.emitPlaybackState();
    if (this.targetBPM !== null) {
      await this.selectAndPlay(this.targetBPM, true);
    }
  };

  private async selectAndPlay(targetBPM: number, bypassCooldown = false): Promise<void> {
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
      eventBus.emit('music:changed', selection.track);
    } else {
      eventBus.emit('music:error', {message: result.error});
    }
  }

  private pushRecentTrack(trackId: string): void {
    this.recentTrackIds.push(trackId);
    if (this.recentTrackIds.length > RECENT_TRACK_HISTORY_SIZE) {
      this.recentTrackIds.shift();
    }
  }

  private async emitPlaybackState(): Promise<void> {
    if (!this.activeProvider) {
      return;
    }

    try {
      const posResult = await this.activeProvider.getPosition();
      const position = posResult.ok ? posResult.data : {positionSeconds: 0, durationSeconds: 0};

      const playbackState: PlaybackState = {
        currentTrack: this.currentTrack,
        isPlaying: this.isPlaying,
        positionSeconds: position.positionSeconds,
        durationSeconds: position.durationSeconds,
        targetBPM: this.targetBPM,
      };

      eventBus.emit('music:playbackStateChanged', playbackState);
    } catch {
      // Provider may not be initialized yet
    }
  }
}
