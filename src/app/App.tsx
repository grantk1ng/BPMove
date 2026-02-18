import React, {useEffect, useState} from 'react';
import {StatusBar, View, Text, StyleSheet} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {ServiceRegistry} from '../core/ServiceRegistry';
import {HeartRateService} from '../modules/heartrate/HeartRateService';
import {AdaptiveBPMEngine} from '../modules/algorithm/AdaptiveBPMEngine';
import {createDefaultConfig} from '../modules/algorithm/presets';
import {MusicLibraryManager} from '../modules/music/MusicLibraryManager';
import {MusicPlayerService} from '../modules/music/MusicPlayerService';
import {SessionLogger} from '../modules/logging/SessionLogger';
import {DebugScreen} from '../screens/DebugScreen';

function initializeServices(): void {
  // Order matters: algorithm engine subscribes to EventBus first,
  // so its handler runs before the SessionLogger's hr:reading handler.
  // This ensures algo state is cached before time-series rows are built.

  const hrService = new HeartRateService();
  ServiceRegistry.register('heartrate', hrService);

  const config = createDefaultConfig();
  const engine = new AdaptiveBPMEngine(config);
  ServiceRegistry.register('algorithm', engine);

  const libraryManager = new MusicLibraryManager();
  ServiceRegistry.register('musicLibrary', libraryManager);

  const musicService = new MusicPlayerService(libraryManager);
  ServiceRegistry.register('music', musicService);

  const logger = new SessionLogger();
  ServiceRegistry.register('logging', logger);
}

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initializeServices();

    // Set up music player (async)
    const musicService = ServiceRegistry.get<MusicPlayerService>('music');
    musicService
      .setup()
      .then(() => {
        musicService.start();
        setReady(true);
      })
      .catch(() => {
        // Music player setup may fail in development without native module
        setReady(true);
      });

    return () => {
      // Cleanup on unmount
      const hr = ServiceRegistry.get<HeartRateService>('heartrate');
      hr.destroy();
      const algo = ServiceRegistry.get<AdaptiveBPMEngine>('algorithm');
      algo.destroy();
      musicService.destroy();
      ServiceRegistry.clear();
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
      <SafeAreaView style={styles.container} edges={['top']}>
        <DebugScreen />
      </SafeAreaView>
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
