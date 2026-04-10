import TrackPlayer, {
  AppKilledPlaybackBehavior,
  Capability,
  Event,
  State,
} from 'react-native-track-player';
import {eventBus} from '../../../core/EventBus';
import type {TrackMetadata} from '../types';
import type {
  TrackProvider,
  TrackProviderInfo,
  ProviderStatus,
  Result,
} from './types';
import {LOCAL_TRACKS} from './local/trackCatalog';

export class LocalTrackProvider implements TrackProvider {
  readonly info: TrackProviderInfo = {name: 'local', priority: 10};
  private status: ProviderStatus = 'idle';
  private isPlayerSetup = false;
  private currentTrackId: string | null = null;
  private playbackSub: ReturnType<typeof TrackPlayer.addEventListener> | null = null;

  getStatus(): ProviderStatus {
    return this.status;
  }

  async isAvailable(): Promise<Result<boolean>> {
    return {ok: true, data: true};
  }

  async loadTracks(): Promise<Result<TrackMetadata[]>> {
    this.status = 'loading';
    try {
      await this.setupPlayer();
      this.status = 'ready';
      return {ok: true, data: LOCAL_TRACKS};
    } catch (err) {
      this.status = 'error';
      const message = err instanceof Error ? err.message : 'Unknown error';
      return {ok: false, error: `Failed to set up track player: ${message}`};
    }
  }

  async playTrack(track: TrackMetadata): Promise<Result<void>> {
    try {
      await TrackPlayer.reset();
      await TrackPlayer.add({
        id: track.id,
        url: track.url as string,
        title: track.title,
        artist: track.artist,
        duration: track.durationSeconds,
        artwork: track.artworkUrl ?? undefined,
      });
      await TrackPlayer.play();
      this.currentTrackId = track.id;
      return {ok: true, data: undefined};
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return {ok: false, error: `Playback failed: ${message}`};
    }
  }

  async pause(): Promise<Result<void>> {
    try {
      await TrackPlayer.pause();
      return {ok: true, data: undefined};
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return {ok: false, error: `Pause failed: ${message}`};
    }
  }

  async resume(): Promise<Result<void>> {
    try {
      await TrackPlayer.play();
      return {ok: true, data: undefined};
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return {ok: false, error: `Resume failed: ${message}`};
    }
  }

  async stop(): Promise<Result<void>> {
    try {
      await TrackPlayer.reset();
      return {ok: true, data: undefined};
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return {ok: false, error: `Stop failed: ${message}`};
    }
  }

  async getPosition(): Promise<
    Result<{positionSeconds: number; durationSeconds: number}>
  > {
    try {
      const progress = await TrackPlayer.getProgress();
      return {
        ok: true,
        data: {
          positionSeconds: progress.position,
          durationSeconds: progress.duration,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return {ok: false, error: `Position query failed: ${message}`};
    }
  }

  async destroy(): Promise<void> {
    this.playbackSub?.remove();
    this.playbackSub = null;
    if (this.isPlayerSetup) {
      await TrackPlayer.reset();
    }
    this.status = 'idle';
  }

  private async setupPlayer(): Promise<void> {
    if (this.isPlayerSetup) {
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

    this.playbackSub = TrackPlayer.addEventListener(
      Event.PlaybackState,
      ({state}) => {
        if (state === State.Ended && this.currentTrackId) {
          eventBus.emit('music:trackEnded', {trackId: this.currentTrackId});
        }
      },
    );

    this.isPlayerSetup = true;
  }
}
