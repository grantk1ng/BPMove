import React, {useEffect, useState} from 'react';
import {StatusBar, View, Text, StyleSheet} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {ServiceRegistry} from '../core/ServiceRegistry';
import {HeartRateService} from '../modules/heartrate/HeartRateService';
import {AdaptiveBPMEngine} from '../modules/algorithm/AdaptiveBPMEngine';
import {createDefaultConfig} from '../modules/algorithm/presets';
import {MusicLibraryManager} from '../modules/music/MusicLibraryManager';
import {MusicPlayerService} from '../modules/music/MusicPlayerService';
import {SessionLogger} from '../modules/logging/SessionLogger';
import {LocalTrackProvider} from '../modules/music/providers/LocalTrackProvider';
import {SpotifyTrackProvider} from '../modules/music/providers/spotify/SpotifyTrackProvider';
import {TrackProviderManager} from '../modules/music/providers/TrackProviderManager';
import {AppNavigator} from '../navigation/AppNavigator';

function initializeServices(): void {
  if (ServiceRegistry.has('heartrate')) {
    return;
  }

  const hrService = new HeartRateService();
  ServiceRegistry.register('heartrate', hrService);

  const config = createDefaultConfig();
  const engine = new AdaptiveBPMEngine(config);
  ServiceRegistry.register('algorithm', engine);

  const libraryManager = new MusicLibraryManager();
  ServiceRegistry.register('musicLibrary', libraryManager);

  const musicService = new MusicPlayerService(libraryManager);
  ServiceRegistry.register('music', musicService);

  const spotifyProvider = new SpotifyTrackProvider();
  const localProvider = new LocalTrackProvider();
  const providerManager = new TrackProviderManager(
    [spotifyProvider, localProvider],
    libraryManager,
    musicService,
  );
  ServiceRegistry.register('trackProvider', providerManager);

  const logger = new SessionLogger();
  ServiceRegistry.register('logging', logger);
}

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    initializeServices();

    const providerManager =
      ServiceRegistry.get<TrackProviderManager>('trackProvider');
    const musicService = ServiceRegistry.get<MusicPlayerService>('music');

    providerManager
      .initialize()
      .then(() => {
        if (cancelled) {
          return;
        }
        musicService.start();
        setReady(true);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        musicService.start();
        setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Initializing...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
      <AppNavigator />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  loadingText: {
    color: '#888',
    fontSize: 16,
  },
});
