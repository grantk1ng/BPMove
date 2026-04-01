import {eventBus} from '../../core/EventBus';
import type {BPMTarget} from '../algorithm/types';
import type {TrackMetadata, PlaybackState} from './types';
import {selectTrack} from './TrackSelector';
import type {MusicLibraryManager} from './MusicLibraryManager';
import type {TrackProvider} from './providers/types';

const MIN_TRACK_SWITCH_INTERVAL_MS = 12_000;

export class MusicPlayerService {
  private currentTrack: TrackMetadata | null = null;
  private libraryManager: MusicLibraryManager;
  private unsubscribers: (() => void)[] = [];
  private targetBPM: number | null = null;
  private activeProvider: TrackProvider | null = null;
  private isPlaying = false;
  private lastTrackSwitchTimestamp = 0;

  constructor(libraryManager: MusicLibraryManager) {
    this.libraryManager = libraryManager;
  }

  setActiveProvider(provider: TrackProvider): void {
    this.activeProvider = provider;
  }

  start(): void {
    this.unsubscribers.push(
      eventBus.on('algo:target', this.onAlgoTarget),
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
    if (this.targetBPM !== null) {
      await this.selectAndPlay(this.targetBPM);
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

  private async selectAndPlay(targetBPM: number): Promise<void> {
    if (!this.activeProvider) {
      return;
    }

    const now = Date.now();
    const elapsed = now - this.lastTrackSwitchTimestamp;

    if (elapsed < MIN_TRACK_SWITCH_INTERVAL_MS) {
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
      this.currentTrack?.id ?? null,
    );

    if (!selection) {
      return;
    }

    if (selection.track.id === this.currentTrack?.id) {
      return;
    }

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
