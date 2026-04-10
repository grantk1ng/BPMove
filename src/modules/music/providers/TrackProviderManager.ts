import {eventBus} from '../../../core/EventBus';
import type {MusicLibraryManager} from '../MusicLibraryManager';
import type {MusicPlayerService} from '../MusicPlayerService';
import type {TrackProvider} from './types';

export class TrackProviderManager {
  private providers: TrackProvider[];
  private libraryManager: MusicLibraryManager;
  private musicService: MusicPlayerService;
  private activeProvider: TrackProvider | null = null;
  private providerErrors: Map<string, string> = new Map();
  private initialized = false;

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
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    for (const provider of this.providers) {
      console.log(`[TrackProvider] Trying provider: ${provider.info.name}`);
      eventBus.emit('provider:loading', {providerName: provider.info.name});

      const available = await provider.isAvailable();
      console.log(`[TrackProvider] ${provider.info.name} isAvailable:`, JSON.stringify(available));
      if (!available.ok) {
        this.providerErrors.set(provider.info.name, available.error);
        eventBus.emit('provider:error', {
          providerName: provider.info.name,
          error: available.error,
        });
        continue;
      }

      if (!available.data) {
        this.providerErrors.set(provider.info.name, 'Provider not available');
        eventBus.emit('provider:error', {
          providerName: provider.info.name,
          error: 'Provider not available',
        });
        continue;
      }

      console.log(`[TrackProvider] ${provider.info.name} loading tracks...`);
      const result = await provider.loadTracks();
      console.log(`[TrackProvider] ${provider.info.name} loadTracks:`, result.ok ? `${result.data.length} tracks` : result.error);
      if (!result.ok) {
        this.providerErrors.set(provider.info.name, result.error);
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

  getProviderError(providerName: string): string | null {
    return this.providerErrors.get(providerName) ?? null;
  }

  async destroy(): Promise<void> {
    for (const provider of this.providers) {
      await provider.destroy();
    }
    this.activeProvider = null;
  }
}
