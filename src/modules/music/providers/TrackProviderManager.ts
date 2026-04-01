import {eventBus} from '../../../core/EventBus';
import type {MusicLibraryManager} from '../MusicLibraryManager';
import type {MusicPlayerService} from '../MusicPlayerService';
import type {TrackProvider} from './types';

export class TrackProviderManager {
  private providers: TrackProvider[];
  private libraryManager: MusicLibraryManager;
  private musicService: MusicPlayerService;
  private activeProvider: TrackProvider | null = null;

  constructor(
    providers: TrackProvider[],
    libraryManager: MusicLibraryManager,
    musicService: MusicPlayerService,
  ) {
    this.providers = [...providers].sort(
      (a, b) => a.info.priority - b.info.priority,
    );
    this.libraryManager = libraryManager;
    this.musicService = musicService;
  }

  async initialize(): Promise<void> {
    for (const provider of this.providers) {
      eventBus.emit('provider:loading', {providerName: provider.info.name});

      const available = await provider.isAvailable();
      if (!available.ok) {
        eventBus.emit('provider:error', {
          providerName: provider.info.name,
          error: available.error,
        });
        continue;
      }

      if (!available.data) {
        eventBus.emit('provider:error', {
          providerName: provider.info.name,
          error: 'Provider not available',
        });
        continue;
      }

      const result = await provider.loadTracks();
      if (!result.ok) {
        eventBus.emit('provider:error', {
          providerName: provider.info.name,
          error: result.error,
        });
        continue;
      }

      this.libraryManager.loadTracks(result.data);
      this.musicService.setActiveProvider(provider);
      this.activeProvider = provider;

      eventBus.emit('provider:ready', {
        providerName: provider.info.name,
        trackCount: result.data.length,
      });
      return;
    }

    eventBus.emit('provider:error', {
      providerName: 'all',
      error: 'No track providers available',
    });
  }

  getActiveProvider(): TrackProvider | null {
    return this.activeProvider;
  }

  async destroy(): Promise<void> {
    for (const provider of this.providers) {
      await provider.destroy();
    }
    this.activeProvider = null;
  }
}
