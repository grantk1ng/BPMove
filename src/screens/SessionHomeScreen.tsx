import React, {useState, useCallback} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Alert} from 'react-native';
import {useHeartRate} from '../modules/heartrate/useHeartRate';
import {useSessionLog} from '../modules/logging/useSessionLog';
import {ServiceRegistry} from '../core/ServiceRegistry';
import {HR_ZONE_PRESETS, createDefaultConfig} from '../modules/algorithm/presets';
import {colors, typography, spacing, radii} from '../theme';
import {SPOTIFY_CLIENT_ID} from '../config/env';
import {requestBlePermissions} from '../utils/permissions';
import {startBackgroundSession} from '../modules/background';
import type {HRZone} from '../modules/algorithm/types';
import type {AdaptiveBPMEngine} from '../modules/algorithm/AdaptiveBPMEngine';
import type {SessionStackScreenProps} from '../navigation/types';

export function SessionHomeScreen({
  navigation,
}: SessionStackScreenProps<'SessionHome'>) {
  const {connectionState} = useHeartRate();
  const {startSession} = useSessionLog();
  const [selectedZone, setSelectedZone] = useState<HRZone>(HR_ZONE_PRESETS[0]);

  const bleConnected = connectionState === 'connected';
  const spotifyConfigured = !!SPOTIFY_CLIENT_ID;

  const handleStart = useCallback(async () => {
    if (!bleConnected) {
      Alert.alert(
        'No Heart Rate Monitor',
        'Connect a heart rate monitor in Settings to start a session.',
        [{text: 'OK'}],
      );
      return;
    }

    const startRun = async () => {
      try {
        await requestBlePermissions();
        const config = createDefaultConfig(selectedZone);
        const engine = ServiceRegistry.get<AdaptiveBPMEngine>('algorithm');
        engine.updateConfig(config);
        engine.start();
        startSession(config as unknown as Record<string, unknown>);
        startBackgroundSession().catch(() => {});
        navigation.navigate('ActiveSession');
      } catch {
        Alert.alert('Error', 'Failed to start session. Please try again.');
      }
    };

    if (!spotifyConfigured) {
      Alert.alert(
        'No Music',
        "Spotify isn't connected. You'll get heart rate coaching but no music. Continue anyway?",
        [
          {text: 'Go to Settings', onPress: () => {}},
          {text: 'Continue', onPress: startRun},
        ],
      );
    } else {
      await startRun();
    }
  }, [bleConnected, spotifyConfigured, selectedZone, startSession, navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>BPMove</Text>
        <Text style={styles.subtitle}>Select your target zone</Text>
      </View>

      <View style={styles.zoneRow}>
        {HR_ZONE_PRESETS.map(zone => {
          const isSelected = zone.name === selectedZone.name;
          return (
            <TouchableOpacity
              key={zone.name}
              style={[
                styles.zoneCard,
                isSelected && {borderColor: zone.color},
              ]}
              onPress={() => setSelectedZone(zone)}
              activeOpacity={0.7}>
              <Text
                style={[
                  styles.zoneNumber,
                  isSelected && {color: zone.color},
                ]}>
                {zone.name.split(' ')[0]} {zone.name.split(' ')[1]}
              </Text>
              <Text style={styles.zoneLabel}>
                {zone.name.includes('Easy')
                  ? 'Easy'
                  : zone.name.includes('Tempo')
                    ? 'Tempo'
                    : 'Threshold'}
              </Text>
              <Text style={styles.zoneRange}>
                {zone.minBPM}–{zone.maxBPM}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {!bleConnected && (
        <View style={styles.warning}>
          <Text style={styles.warningText}>
            No heart rate monitor connected
          </Text>
        </View>
      )}

      <View style={styles.spacer} />

      <TouchableOpacity
        style={[styles.startButton, !bleConnected && styles.startButtonDisabled]}
        onPress={handleStart}
        disabled={!bleConnected}>
        <Text style={styles.startButtonText}>Start Session</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    padding: spacing.lg,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    color: colors.text.primary,
    fontSize: 28,
    fontWeight: typography.weight.bold,
    letterSpacing: typography.letterSpacing.wide,
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.text.secondary,
    fontSize: typography.size.base,
  },
  zoneRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  zoneCard: {
    flex: 1,
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radii.lg,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  zoneNumber: {
    color: colors.text.secondary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
  zoneLabel: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
  },
  zoneRange: {
    color: colors.text.tertiary,
    fontSize: typography.size.sm,
    fontFamily: typography.family.mono,
  },
  warning: {
    marginTop: spacing.base,
    padding: spacing.md,
    backgroundColor: colors.action.destructiveBg,
    borderRadius: radii.md,
  },
  warningText: {
    color: colors.status.error,
    fontSize: typography.size.md,
    textAlign: 'center',
  },
  spacer: {
    flex: 1,
  },
  startButton: {
    backgroundColor: colors.action.primary,
    paddingVertical: spacing.lg,
    borderRadius: radii.xl,
    alignItems: 'center',
  },
  startButtonDisabled: {
    backgroundColor: colors.bg.elevated,
    opacity: 0.6,
  },
  startButtonText: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    letterSpacing: 0.5,
  },
});
