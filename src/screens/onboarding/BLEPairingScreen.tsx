import React, {useState, useEffect, useCallback} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, FlatList} from 'react-native';
import {useHeartRate} from '../../modules/heartrate/useHeartRate';
import {UserPreferences} from '../../modules/preferences/UserPreferences';
import {requestBlePermissions} from '../../utils/permissions';
import {colors, typography, spacing, radii} from '../../theme';
import type {BleDeviceInfo} from '../../contracts';
import type {OnboardingStackScreenProps} from '../../navigation/types';

export function BLEPairingScreen({
  navigation: _navigation,
}: OnboardingStackScreenProps<'BLEPairing'>) {
  const {devices, startScan, stopScan, connect} = useHeartRate();
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    async function beginScan() {
      await requestBlePermissions();
      startScan();
      setScanning(true);
    }
    beginScan();
    const timeout = setTimeout(() => {
      stopScan();
      setScanning(false);
    }, 15000);
    return () => {
      clearTimeout(timeout);
      stopScan();
    };
  }, [startScan, stopScan]);

  const handleConnect = useCallback(
    async (device: BleDeviceInfo) => {
      stopScan();
      setScanning(false);
      await connect(device.id);
      await UserPreferences.setPairedDevice({
        id: device.id,
        name: device.name,
      });
      await UserPreferences.setOnboardingComplete();
    },
    [connect, stopScan],
  );

  const handleSkip = useCallback(async () => {
    stopScan();
    await UserPreferences.setOnboardingComplete();
  }, [stopScan]);

  const renderDevice = ({item}: {item: BleDeviceInfo}) => (
    <TouchableOpacity
      style={styles.deviceCard}
      onPress={() => handleConnect(item)}>
      <View>
        <Text style={styles.deviceName}>{item.name ?? 'Unknown Device'}</Text>
        <Text style={styles.deviceId}>Signal: {item.rssi} dBm</Text>
      </View>
      <Text style={styles.connectText}>Use This</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.dots}>
        <View style={styles.dot} />
        <View style={styles.dot} />
        <View style={[styles.dot, styles.dotActive]} />
      </View>

      <View style={styles.content}>
        <Text style={styles.heading}>Connect your heart rate monitor</Text>
        <Text style={styles.description}>
          {scanning
            ? 'Scanning for nearby heart rate monitors...'
            : devices.length === 0
              ? 'No devices found. Make sure your monitor is on and nearby.'
              : `Found ${devices.length} device${devices.length > 1 ? 's' : ''}`}
        </Text>

        {devices.length > 0 && (
          <FlatList
            data={devices}
            renderItem={renderDevice}
            keyExtractor={d => d.id}
            style={styles.deviceList}
            contentContainerStyle={styles.deviceListContent}
          />
        )}

        {!scanning && devices.length === 0 && (
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              startScan();
              setScanning(true);
              setTimeout(() => {
                stopScan();
                setScanning(false);
              }, 15000);
            }}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text style={styles.skipText}>Skip for now</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    padding: spacing.xl,
    justifyContent: 'space-between',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingTop: 60,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.bg.elevated,
  },
  dotActive: {
    backgroundColor: colors.text.primary,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.base,
  },
  heading: {
    color: colors.text.primary,
    fontSize: 24,
    fontWeight: typography.weight.bold,
    textAlign: 'center',
  },
  description: {
    color: colors.text.secondary,
    fontSize: typography.size.base,
    textAlign: 'center',
    lineHeight: 22,
  },
  deviceList: {
    maxHeight: 200,
  },
  deviceListContent: {
    gap: spacing.sm,
  },
  deviceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radii.md,
    padding: spacing.base,
  },
  deviceName: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
  deviceId: {
    color: colors.text.tertiary,
    fontSize: typography.size.sm,
    fontFamily: typography.family.mono,
    marginTop: 2,
  },
  connectText: {
    color: colors.action.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
  retryButton: {
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingVertical: 14,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  retryText: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
  },
  skipButton: {
    paddingVertical: spacing.base,
    marginBottom: 40,
  },
  skipText: {
    color: colors.text.secondary,
    fontSize: typography.size.md,
    textAlign: 'center',
  },
});
