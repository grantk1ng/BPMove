import React, {useState, useEffect, useCallback} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView} from 'react-native';
import {ServiceRegistry} from '../core/ServiceRegistry';
import {eventBus} from '../core/EventBus';
import type {TrackProviderManager} from '../modules/music/providers/TrackProviderManager';
import {SPOTIFY_CLIENT_ID} from '../config/env';

export function SettingsScreen({navigation}: {navigation: {navigate: (screen: string) => void}}) {
  const [providerName, setProviderName] = useState<string>('none');
  const [trackCount, setTrackCount] = useState(0);
  const [spotifyError, setSpotifyError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const pm = ServiceRegistry.get<TrackProviderManager>('trackProvider');
      const active = pm.getActiveProvider();
      if (active) {
        setProviderName(active.info.name);
      }
      const error = pm.getProviderError('spotify');
      if (error) {
        setSpotifyError(error);
      }
    } catch {
      // Service not ready
    }
  }, []);

  useEffect(() => {
    try {
      const lib = ServiceRegistry.get<{getLibrary: () => {tracks: unknown[]}}>(
        'musicLibrary',
      );
      setTrackCount(lib.getLibrary().tracks.length);
    } catch {
      // Service not ready
    }
  }, []);

  useEffect(() => {
    const offReady = eventBus.on('provider:ready', ({providerName: name, trackCount: count}) => {
      setProviderName(name);
      setTrackCount(count);
    });
    const offError = eventBus.on('provider:error', ({providerName: name, error}) => {
      if (name === 'spotify') {
        setSpotifyError(error);
      }
    });
    return () => {
      offReady();
      offError();
    };
  }, []);

  const handleDebugPress = useCallback(() => {
    navigation.navigate('Debug');
  }, [navigation]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Music Provider */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Music Provider</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Active Provider</Text>
          <Text style={styles.rowValue}>{providerName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Tracks Loaded</Text>
          <Text style={styles.rowValue}>{trackCount}</Text>
        </View>
      </View>

      {/* Spotify */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Spotify</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Status</Text>
          <Text style={[styles.rowValue, !SPOTIFY_CLIENT_ID && styles.rowValueWarn]}>
            {SPOTIFY_CLIENT_ID ? 'Configured' : 'Not Configured'}
          </Text>
        </View>
        {!SPOTIFY_CLIENT_ID && (
          <Text style={styles.hint}>
            Add SPOTIFY_CLIENT_ID and RAPIDAPI_KEY to your .env file to enable
            Spotify integration.
          </Text>
        )}
        {spotifyError && (
          <Text style={styles.errorText}>{spotifyError}</Text>
        )}
      </View>

      {/* About */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>App</Text>
          <Text style={styles.rowValue}>BPMove</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Project</Text>
          <Text style={styles.rowValue}>Samford CS Capstone</Text>
        </View>
      </View>

      {/* Debug */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Developer</Text>
        <TouchableOpacity style={styles.debugButton} onPress={handleDebugPress}>
          <Text style={styles.debugButtonText}>Open Debug Console</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  content: {
    padding: 16,
    gap: 24,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 12,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#252525',
    padding: 14,
    borderRadius: 8,
  },
  rowLabel: {
    color: '#ccc',
    fontSize: 15,
  },
  rowValue: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  rowValueWarn: {
    color: '#FF9800',
  },
  hint: {
    color: '#666',
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 4,
  },
  debugButton: {
    backgroundColor: '#333',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  debugButtonText: {
    color: '#aaa',
    fontSize: 15,
    fontWeight: '500',
  },
  errorText: {
    color: '#FF5252',
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 4,
  },
});
