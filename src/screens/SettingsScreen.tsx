import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
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
    customZones,
    setCustomZones,
  } = usePreferences();

  const [providerName, setProviderName] = useState<string>('none');
  const [trackCount, setTrackCount] = useState(0);
  const [spotifyError, setSpotifyError] = useState<string | null>(null);
  const [spotifyLoading, setSpotifyLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const baseZones = age ? calculateZonesFromAge(age) : HR_ZONE_PRESETS;
  const zones = customZones
    ? customZones.map((z, i) => ({...z, color: baseZones[i]?.color ?? '#888'}))
    : baseZones;

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
    const offLoading = eventBus.on(
      'provider:loading',
      ({providerName: name}) => {
        if (name === 'spotify') {
          setSpotifyLoading(true);
          setSpotifyError(null);
        }
      },
    );
    const offReady = eventBus.on(
      'provider:ready',
      ({providerName: name, trackCount: count}) => {
        setProviderName(name);
        setTrackCount(count);
        if (name === 'spotify') {
          setSpotifyLoading(false);
        }
      },
    );
    const offError = eventBus.on(
      'provider:error',
      ({providerName: name, error}) => {
        if (name === 'spotify') {
          setSpotifyError(error);
          setSpotifyLoading(false);
        }
      },
    );
    return () => {
      offLoading();
      offReady();
      offError();
    };
  }, []);

  const handleEditAge = useCallback(() => {
    Alert.prompt(
      'Enter Your Age',
      'Must be at least 13. Used to calculate HR zones.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Save',
          onPress: async (value?: string) => {
            const parsed = parseInt(value ?? '', 10);
            if (isNaN(parsed) || parsed < 13) {
              Alert.alert('Invalid Age', 'You must be at least 13 years old.');
              return;
            }
            await setAge(parsed);
          },
        },
      ],
      'plain-text',
      age ? String(age) : '',
      'number-pad',
    );
  }, [age, setAge]);

  const handleEditZone = useCallback(
    (index: number, field: 'minBPM' | 'maxBPM') => {
      const current = zones[index];
      const fieldLabel = field === 'minBPM' ? 'Min' : 'Max';
      Alert.prompt(
        `${current.name} — ${fieldLabel} BPM`,
        'Enter heart rate value',
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Save',
            onPress: async (value?: string) => {
              const parsed = parseInt(value ?? '', 10);
              if (isNaN(parsed) || parsed < 40 || parsed > 220) {
                Alert.alert('Invalid', 'Enter a value between 40 and 220.');
                return;
              }
              const updated = zones.map((z, i) => {
                if (i !== index) {
                  return {name: z.name, minBPM: z.minBPM, maxBPM: z.maxBPM};
                }
                return {
                  name: z.name,
                  minBPM: field === 'minBPM' ? parsed : z.minBPM,
                  maxBPM: field === 'maxBPM' ? parsed : z.maxBPM,
                };
              });
              await setCustomZones(updated);
            },
          },
        ],
        'plain-text',
        String(current[field]),
        'number-pad',
      );
    },
    [zones, setCustomZones],
  );

  const handleResetZones = useCallback(async () => {
    await setCustomZones(
      baseZones.map(z => ({name: z.name, minBPM: z.minBPM, maxBPM: z.maxBPM})),
    );
  }, [baseZones, setCustomZones]);

  const handleConnectSpotify = useCallback(async () => {
    try {
      const pm = ServiceRegistry.get<TrackProviderManager>('trackProvider');
      await pm.connectProvider('spotify');
    } catch {
      setSpotifyError('Failed to connect to Spotify');
      setSpotifyLoading(false);
    }
  }, []);

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

  const handleReconnectDevice = useCallback(async () => {
    if (!pairedDevice) {
      return;
    }
    await connect(pairedDevice.id);
  }, [pairedDevice, connect]);

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

        <TouchableOpacity style={styles.row} onPress={handleEditAge}>
          <Text style={styles.rowLabel}>Age</Text>
          <Text style={styles.rowValue}>{age ?? 'Not set'}</Text>
        </TouchableOpacity>

        {zones.map((zone, index) => (
          <View key={zone.name} style={styles.row}>
            <View style={styles.zoneNameRow}>
              <View
                style={[styles.zoneDot, {backgroundColor: zone.color}]}
              />
              <Text style={styles.rowLabel}>{zone.name}</Text>
            </View>
            {advancedOpen ? (
              <View style={styles.zoneEditRow}>
                <TouchableOpacity
                  onPress={() => handleEditZone(index, 'minBPM')}>
                  <Text style={styles.zoneEditValue}>{zone.minBPM}</Text>
                </TouchableOpacity>
                <Text style={styles.zoneDash}>–</Text>
                <TouchableOpacity
                  onPress={() => handleEditZone(index, 'maxBPM')}>
                  <Text style={styles.zoneEditValue}>{zone.maxBPM}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.rowValue}>
                {zone.minBPM}–{zone.maxBPM} BPM
              </Text>
            )}
          </View>
        ))}

        <TouchableOpacity
          onPress={() => setAdvancedOpen(!advancedOpen)}
          style={styles.advancedToggle}>
          <Text style={styles.advancedText}>
            {advancedOpen ? 'Done' : 'Customize Zones'}
          </Text>
        </TouchableOpacity>

        {advancedOpen && customZones && (
          <TouchableOpacity onPress={handleResetZones}>
            <Text style={styles.resetText}>Reset to defaults</Text>
          </TouchableOpacity>
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
              {
                color:
                  providerName === 'spotify'
                    ? colors.status.success
                    : spotifyLoading
                      ? colors.status.warning
                      : colors.text.secondary,
              },
            ]}>
            {providerName === 'spotify'
              ? `Connected — ${trackCount} tracks`
              : spotifyLoading
                ? 'Connecting...'
                : 'Not Connected'}
          </Text>
        </View>

        {providerName !== 'spotify' && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleConnectSpotify}
            disabled={spotifyLoading}>
            <Text style={styles.actionButtonText}>
              {spotifyLoading ? 'Connecting...' : 'Connect Spotify'}
            </Text>
          </TouchableOpacity>
        )}

        {spotifyError && (
          <View style={styles.spotifyErrorBox}>
            <Text style={styles.spotifyErrorText}>{spotifyError}</Text>
          </View>
        )}
      </View>

      {/* BLE Device */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Heart Rate Monitor</Text>

        {pairedDevice && (
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
                        : connectionState === 'connecting'
                          ? colors.status.warning
                          : colors.text.secondary,
                  },
                ]}>
                {connectionState === 'connected'
                  ? 'Connected'
                  : connectionState === 'connecting'
                    ? 'Connecting...'
                    : 'Disconnected'}
              </Text>
            </View>
            {connectionState === 'connected' ? (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleDisconnectDevice}>
                <Text style={styles.actionButtonText}>Disconnect Device</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.deviceActions}>
                <TouchableOpacity
                  style={[styles.actionButton, {flex: 1}]}
                  onPress={handleReconnectDevice}
                  disabled={connectionState === 'connecting'}>
                  <Text style={styles.actionButtonText}>
                    {connectionState === 'connecting'
                      ? 'Connecting...'
                      : 'Connect'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, {flex: 1}]}
                  onPress={handleDisconnectDevice}>
                  <Text style={styles.actionButtonText}>Forget</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {!pairedDevice && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleScanBLE}
            disabled={scanning}>
            <Text style={styles.actionButtonText}>
              {scanning ? 'Scanning...' : 'Pair New Device'}
            </Text>
          </TouchableOpacity>
        )}

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
  zoneEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  zoneEditValue: {
    color: colors.action.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    fontVariant: ['tabular-nums'],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  zoneDash: {
    color: colors.text.tertiary,
    fontSize: typography.size.base,
  },
  advancedToggle: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  advancedText: {
    color: colors.action.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
  },
  resetText: {
    color: colors.text.tertiary,
    fontSize: typography.size.sm,
    textAlign: 'center',
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
  spotifyErrorBox: {
    backgroundColor: colors.action.destructiveBg,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  spotifyErrorText: {
    color: colors.status.error,
    fontSize: typography.size.md,
    lineHeight: 20,
  },
  deviceActions: {
    flexDirection: 'row',
    gap: spacing.sm,
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
