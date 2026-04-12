import React, {useState, useEffect, useCallback} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, FlatList} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
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
  const [hasScanned, setHasScanned] = useState(false);

  const handleScan = useCallback(async () => {
    await requestBlePermissions();
    startScan();
    setScanning(true);
    setHasScanned(true);
    setTimeout(() => {
      stopScan();
      setScanning(false);
    }, 15000);
  }, [startScan, stopScan]);

  useEffect(() => {
    return () => {
      stopScan();
    };
  }, [stopScan]);

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
    <SafeAreaView style={styles.container}>
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
            : hasScanned && devices.length === 0
              ? 'No devices found. Make sure your monitor is on and nearby.'
              : hasScanned
                ? `Found ${devices.length} device${devices.length > 1 ? 's' : ''}`
                : 'Make sure your heart rate monitor is turned on and nearby.'}
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

        {!scanning && (
          <TouchableOpacity
            style={styles.scanButton}
            onPress={handleScan}>
            <Text style={styles.scanText}>
              {hasScanned ? 'Scan Again' : 'Scan for Devices'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text style={styles.skipText}>Skip for now</Text>
      </TouchableOpacity>
    </SafeAreaView>
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
    paddingTop: spacing.base,
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
  scanButton: {
    backgroundColor: colors.action.primary,
    paddingVertical: 14,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  scanText: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
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
