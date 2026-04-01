import React, {useState, useCallback} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Alert} from 'react-native';
import {useHeartRate} from '../modules/heartrate/useHeartRate';
import {HR_ZONE_PRESETS, createDefaultConfig} from '../modules/algorithm/presets';
import type {HRZone} from '../modules/algorithm/types';
import type {AdaptiveBPMEngine} from '../modules/algorithm/AdaptiveBPMEngine';
import {ServiceRegistry} from '../core/ServiceRegistry';
import {useSessionLog} from '../modules/logging/useSessionLog';
import {HeartRateDisplay} from '../components/HeartRateDisplay';
import {ZoneSelector} from '../components/ZoneSelector';
import {requestBlePermissions} from '../utils/permissions';
import {startBackgroundSession} from '../modules/background';
import type {SessionStackScreenProps} from '../navigation/types';

export function SessionHomeScreen({
  navigation,
}: SessionStackScreenProps<'SessionHome'>) {
  const {
    currentHR,
    connectionState,
    devices,
    startScan,
    stopScan,
    connect,
    disconnect,
  } = useHeartRate();

  const {startSession} = useSessionLog();
  const [selectedZone, setSelectedZone] = useState<HRZone>(HR_ZONE_PRESETS[0]);

  const handleStartSession = useCallback(async () => {
    const permResult = await requestBlePermissions();
    if (permResult !== 'granted') {
      Alert.alert(
        'Permissions Required',
        'BLE permissions are needed to connect to your heart rate monitor.',
      );
      return;
    }

    const config = createDefaultConfig(selectedZone);
    const engine = ServiceRegistry.get<AdaptiveBPMEngine>('algorithm');
    engine.updateConfig(config);
    engine.start();

    startSession(config as unknown as Record<string, unknown>);
    startBackgroundSession().catch(() => {});

    navigation.navigate('ActiveSession');
  }, [selectedZone, startSession, navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>BPMove</Text>
        <Text style={styles.subtitle}>Adaptive Music for Your Workout</Text>
      </View>

      <HeartRateDisplay
        bpm={currentHR}
        mode="MAINTAIN"
        zoneColor={selectedZone.color}
      />

      {/* BLE Connection */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>
          Heart Rate Monitor: {connectionState}
        </Text>
        {connectionState === 'disconnected' && (
          <TouchableOpacity style={styles.button} onPress={startScan}>
            <Text style={styles.buttonText}>Scan for Devices</Text>
          </TouchableOpacity>
        )}
        {connectionState === 'scanning' && (
          <>
            <TouchableOpacity style={styles.buttonDanger} onPress={stopScan}>
              <Text style={styles.buttonText}>Stop Scanning</Text>
            </TouchableOpacity>
            {devices.map(device => (
              <TouchableOpacity
                key={device.id}
                style={styles.deviceRow}
                onPress={() => connect(device.id)}>
                <Text style={styles.deviceName}>
                  {device.name ?? 'Unknown'}
                </Text>
                <Text style={styles.deviceRssi}>{device.rssi} dBm</Text>
              </TouchableOpacity>
            ))}
          </>
        )}
        {connectionState === 'connected' && (
          <TouchableOpacity style={styles.buttonDanger} onPress={disconnect}>
            <Text style={styles.buttonText}>Disconnect</Text>
          </TouchableOpacity>
        )}
      </View>

      <ZoneSelector
        zones={HR_ZONE_PRESETS}
        selectedZone={selectedZone}
        onSelect={setSelectedZone}
        disabled={false}
      />

      <TouchableOpacity
        style={[
          styles.startButton,
          connectionState !== 'connected' && styles.startButtonDisabled,
        ]}
        onPress={handleStartSession}
        disabled={connectionState !== 'connected'}>
        <Text style={styles.startButtonText}>Start Session</Text>
      </TouchableOpacity>

      {connectionState !== 'connected' && (
        <Text style={styles.hint}>Connect a heart rate monitor to begin</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    padding: 20,
    gap: 16,
  },
  header: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 12,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  button: {
    backgroundColor: '#333',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDanger: {
    backgroundColor: '#c62828',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  deviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
  },
  deviceName: {
    color: '#fff',
    fontSize: 14,
  },
  deviceRssi: {
    color: '#888',
    fontSize: 12,
  },
  startButton: {
    backgroundColor: '#1976D2',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  startButtonDisabled: {
    backgroundColor: '#333',
    opacity: 0.6,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  hint: {
    color: '#666',
    fontSize: 13,
    textAlign: 'center',
  },
});
