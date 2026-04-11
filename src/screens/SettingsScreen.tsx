import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import {ServiceRegistry} from '../core/ServiceRegistry';
import {eventBus} from '../core/EventBus';
import {useHeartRate} from '../modules/heartrate/useHeartRate';
import {usePreferences} from '../modules/preferences/usePreferences';
import {
  HR_ZONE_PRESETS,
  calculateZonesFromAge,
} from '../modules/algorithm/presets';
import {SPOTIFY_CLIENT_ID} from '../config/env';
import {colors, typography, spacing, radii} from '../theme';
import type {TrackProviderManager} from '../modules/music/providers/TrackProviderManager';

export function SettingsScreen({
  navigation,
}: {
  navigation: {navigate: (screen: string) => void};
}) {
  const {connectionState, devices, startScan, stopScan, connect, disconnect} =
    useHeartRate();
  const {
    loaded,
    age,
    setAge,
    showGraph,
    setShowGraph,
    pairedDevice,
    setPairedDevice,
    clearPairedDevice,
  } = usePreferences();

  const [providerName, setProviderName] = useState<string>('none');
  const [trackCount, setTrackCount] = useState(0);
  const [spotifyError, setSpotifyError] = useState<string | null>(null);
  const [advancedZones, setAdvancedZones] = useState(false);
  const [ageInput, setAgeInput] = useState('');
  const [scanning, setScanning] = useState(false);

  const zones = age ? calculateZonesFromAge(age) : HR_ZONE_PRESETS;

  useEffect(() => {
    if (age) {
      setAgeInput(String(age));
    }
  }, [age]);

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
    const offReady = eventBus.on(
      'provider:ready',
      ({providerName: name, trackCount: count}) => {
        setProviderName(name);
        setTrackCount(count);
      },
    );
    const offError = eventBus.on(
      'provider:error',
      ({providerName: name, error}) => {
        if (name === 'spotify') {
          setSpotifyError(error);
        }
      },
    );
    return () => {
      offReady();
      offError();
    };
  }, []);

  const handleSaveAge = useCallback(async () => {
    const parsed = parseInt(ageInput, 10);
    if (isNaN(parsed) || parsed < 13) {
      Alert.alert('Invalid Age', 'You must be at least 13 years old.');
      return;
    }
    await setAge(parsed);
  }, [ageInput, setAge]);

  const handleScanBLE = useCallback(() => {
    setScanning(true);
    startScan();
    setTimeout(() => {
      stopScan();
      setScanning(false);
    }, 10000);
  }, [startScan, stopScan]);

  const handleConnectDevice = useCallback(
    async (deviceId: string, deviceName: string | null) => {
      await connect(deviceId);
      await setPairedDevice({id: deviceId, name: deviceName});
      stopScan();
      setScanning(false);
    },
    [connect, setPairedDevice, stopScan],
  );

  const handleDisconnectDevice = useCallback(async () => {
    await disconnect();
    await clearPairedDevice();
  }, [disconnect, clearPairedDevice]);

  if (!loaded) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* HR Zone Customization */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Heart Rate Zones</Text>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>Age</Text>
          <View style={styles.ageInputRow}>
            <TextInput
              style={styles.ageInput}
              value={ageInput}
              onChangeText={setAgeInput}
              keyboardType="number-pad"
              placeholder="—"
              placeholderTextColor={colors.text.muted}
              maxLength={3}
              onBlur={handleSaveAge}
            />
          </View>
        </View>

        {zones.map(zone => (
          <View key={zone.name} style={styles.row}>
            <View style={styles.zoneNameRow}>
              <View
                style={[styles.zoneDot, {backgroundColor: zone.color}]}
              />
              <Text style={styles.rowLabel}>{zone.name}</Text>
            </View>
            <Text style={styles.rowValue}>
              {zone.minBPM}–{zone.maxBPM} BPM
            </Text>
          </View>
        ))}

        <TouchableOpacity
          onPress={() => setAdvancedZones(!advancedZones)}
          style={styles.advancedToggle}>
          <Text style={styles.advancedToggleText}>
            {advancedZones ? 'Hide Advanced' : 'Advanced'}
          </Text>
        </TouchableOpacity>

        {advancedZones && (
          <Text style={styles.hint}>
            Custom zone editing will be available in a future update.
          </Text>
        )}
      </View>

      {/* Spotify */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Spotify</Text>
        <Text style={styles.sectionDescription}>
          BPMove uses your Spotify library to match music BPM to your heart rate
          zone.
        </Text>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>Status</Text>
          <Text
            style={[
              styles.rowValue,
              !SPOTIFY_CLIENT_ID && {color: colors.status.warning},
            ]}>
            {SPOTIFY_CLIENT_ID ? 'Connected' : 'Not Connected'}
          </Text>
        </View>

        {spotifyError && <Text style={styles.errorText}>{spotifyError}</Text>}

        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionButtonText}>
            {SPOTIFY_CLIENT_ID ? 'Disconnect' : 'Connect Spotify'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* BLE Device */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Heart Rate Monitor</Text>

        {pairedDevice ? (
          <>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Device</Text>
              <Text style={styles.rowValue}>
                {pairedDevice.name ?? 'Unknown Device'}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Status</Text>
              <Text
                style={[
                  styles.rowValue,
                  {
                    color:
                      connectionState === 'connected'
                        ? colors.status.success
                        : colors.text.secondary,
                  },
                ]}>
                {connectionState === 'connected' ? 'Connected' : 'Disconnected'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleDisconnectDevice}>
              <Text style={styles.actionButtonText}>Disconnect Device</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleScanBLE}
              disabled={scanning}>
              <Text style={styles.actionButtonText}>
                {scanning ? 'Scanning...' : 'Pair New Device'}
              </Text>
            </TouchableOpacity>

            {devices.length > 0 && (
              <View style={styles.deviceList}>
                {devices.map(device => (
                  <TouchableOpacity
                    key={device.id}
                    style={styles.deviceRow}
                    onPress={() =>
                      handleConnectDevice(device.id, device.name)
                    }>
                    <Text style={styles.deviceName}>
                      {device.name ?? 'Unknown'}
                    </Text>
                    <Text style={styles.deviceConnect}>Connect</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}
      </View>

      {/* Session Preferences */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Session</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Show live HR graph</Text>
          <Switch
            value={showGraph}
            onValueChange={setShowGraph}
            trackColor={{
              false: colors.bg.elevated,
              true: colors.action.primary,
            }}
          />
        </View>
      </View>

      {/* About */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>App</Text>
          <Text style={styles.rowValue}>BPMove v1.0</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Developer</Text>
          <Text style={styles.rowValue}>Grant King</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Advisor</Text>
          <Text style={styles.rowValue}>Dr. Brian Toone</Text>
        </View>
      </View>

      {/* Developer */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, {color: colors.text.muted}]}>
          Developer
        </Text>
        <View style={styles.row}>
          <Text style={[styles.rowLabel, {color: colors.text.muted}]}>
            Provider
          </Text>
          <Text style={[styles.rowValue, {color: colors.text.muted}]}>
            {providerName}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={[styles.rowLabel, {color: colors.text.muted}]}>
            Tracks
          </Text>
          <Text style={[styles.rowValue, {color: colors.text.muted}]}>
            {trackCount}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.actionButton, {backgroundColor: colors.bg.elevated}]}
          onPress={() => navigation.navigate('Debug')}>
          <Text style={[styles.actionButtonText, {color: colors.text.muted}]}>
            Open Debug Console
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  content: {
    padding: spacing.base,
    gap: spacing.xl,
    paddingBottom: 40,
  },
  loadingText: {
    color: colors.text.secondary,
    fontSize: typography.size.base,
    textAlign: 'center',
    marginTop: 40,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wide,
    fontFamily: typography.family.mono,
    marginBottom: spacing.xs,
  },
  sectionDescription: {
    color: colors.text.tertiary,
    fontSize: typography.size.md,
    lineHeight: 18,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radii.md,
    padding: 14,
  },
  rowLabel: {
    color: colors.text.secondary,
    fontSize: typography.size.base,
  },
  rowValue: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
  },
  zoneNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  zoneDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  ageInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ageInput: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    textAlign: 'right',
    width: 50,
    fontVariant: ['tabular-nums'],
  },
  advancedToggle: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  advancedToggleText: {
    color: colors.action.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
  },
  hint: {
    color: colors.text.muted,
    fontSize: typography.size.md,
    textAlign: 'center',
    paddingHorizontal: spacing.base,
  },
  actionButton: {
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingVertical: 14,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  actionButtonText: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
  },
  errorText: {
    color: colors.status.error,
    fontSize: typography.size.md,
    lineHeight: 18,
    paddingHorizontal: spacing.xs,
  },
  deviceList: {
    gap: spacing.sm,
  },
  deviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radii.md,
    padding: 14,
  },
  deviceName: {
    color: colors.text.primary,
    fontSize: typography.size.base,
  },
  deviceConnect: {
    color: colors.action.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
});
