import TrackPlayer, {
  Event,
  State,
  AppKilledPlaybackBehavior,
  Capability,
} from 'react-native-track-player';
import {eventBus} from '../../core/EventBus';
import type {BPMTarget} from '../algorithm/types';
import type {TrackMetadata, PlaybackState, MusicLibrary} from './types';
import {selectTrack} from './TrackSelector';
import type {MusicLibraryManager} from './MusicLibraryManager';

export class MusicPlayerService {
  private isSetup = false;
  private currentTrack: TrackMetadata | null = null;
  private libraryManager: MusicLibraryManager;
  private unsubscribers: (() => void)[] = [];
  private targetBPM: number | null = null;

  constructor(libraryManager: MusicLibraryManager) {
    this.libraryManager = libraryManager;
  }

  async setup(): Promise<void> {
    if (this.isSetup) {
      return;
    }

    await TrackPlayer.setupPlayer();
    await TrackPlayer.updateOptions({
      android: {
        appKilledPlaybackBehavior:
          AppKilledPlaybackBehavior.ContinuePlayback,
      },
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
      ],
      compactCapabilities: [Capability.Play, Capability.Pause],
    });

    this.isSetup = true;
  }

  start(): void {
    this.unsubscribers.push(
      eventBus.on('algo:target', this.onAlgoTarget),
    );

    // Listen for track player events
    TrackPlayer.addEventListener(Event.PlaybackState, event => {
      this.emitPlaybackState();
    });
  }

  stop(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
    TrackPlayer.reset();
  }

  async play(): Promise<void> {
    await TrackPlayer.play();
    this.emitPlaybackState();
  }

  async pause(): Promise<void> {
    await TrackPlayer.pause();
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
    await TrackPlayer.reset();
  }

  private onAlgoTarget = async (target: BPMTarget): Promise<void> => {
    this.targetBPM = target.targetBPM;
    await this.selectAndPlay(target.targetBPM);
  };

  private async selectAndPlay(targetBPM: number): Promise<void> {
    const library = this.libraryManager.getLibrary();
    const selection = selectTrack(
      targetBPM,
      library,
      this.currentTrack?.id ?? null,
    );

    if (!selection) {
      return;
    }

    // Only change track if it's different from the current one
    if (selection.track.id === this.currentTrack?.id) {
      return;
    }

    this.currentTrack = selection.track;

    await TrackPlayer.reset();
    await TrackPlayer.add({
      id: selection.track.id,
      url: selection.track.url,
      title: selection.track.title,
      artist: selection.track.artist,
      duration: selection.track.durationSeconds,
      artwork: selection.track.artworkUrl ?? undefined,
    });
    await TrackPlayer.play();

    eventBus.emit('music:changed', selection.track);
  }

  private async emitPlaybackState(): Promise<void> {
    try {
      const state = await TrackPlayer.getPlaybackState();
      const progress = await TrackPlayer.getProgress();

      const playbackState: PlaybackState = {
        currentTrack: this.currentTrack,
        isPlaying: state.state === State.Playing,
        positionSeconds: progress.position,
        durationSeconds: progress.duration,
        targetBPM: this.targetBPM,
      };

      eventBus.emit('music:playbackStateChanged', playbackState);
    } catch {
      // Player may not be initialized yet
    }
  }
}
