import React, {useState, useEffect, useCallback, useRef} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Alert} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {eventBus} from '../core/EventBus';
import {ServiceRegistry} from '../core/ServiceRegistry';
import {useHeartRate} from '../modules/heartrate/useHeartRate';
import {useHRHistory} from '../modules/heartrate/useHRHistory';
import {usePlayback} from '../modules/music/usePlayback';
import {useSessionLog} from '../modules/logging/useSessionLog';
import {usePreferences} from '../modules/preferences/usePreferences';
import {HeartRateGraph} from '../components/HeartRateGraph';
import {ZoneBar} from '../components/ZoneBar';
import {ExpandedNowPlaying} from '../components/ExpandedNowPlaying';
import {HR_ZONE_PRESETS} from '../modules/algorithm/presets';
import {colors, typography, spacing, radii} from '../theme';
import {SPOTIFY_CLIENT_ID} from '../config/env';
import type {AlgorithmMode, AlgorithmConfig} from '../modules/algorithm/types';
import type {AdaptiveBPMEngine} from '../modules/algorithm/AdaptiveBPMEngine';
import type {MusicPlayerService} from '../modules/music/MusicPlayerService';
import {stopBackgroundSession} from '../modules/background';
import {saveSession} from '../modules/logging/SessionStore';
import {formatDuration} from '../utils/formatters';
import type {SessionStackScreenProps} from '../navigation/types';

const MODE_COLORS: Record<AlgorithmMode, string> = {
  RAISE: colors.mode.raising,
  LOWER: colors.mode.lowering,
  MAINTAIN: colors.mode.maintain,
};

const MODE_LABELS: Record<AlgorithmMode, string> = {
  RAISE: 'RAISING',
  LOWER: 'LOWERING',
  MAINTAIN: 'IN ZONE',
};

export function ActiveSessionScreen({
  navigation,
}: SessionStackScreenProps<'ActiveSession'>) {
  const {currentHR} = useHeartRate();
  const {history: hrHistory} = useHRHistory();
  const {currentTrack, isPlaying, targetBPM, play, pause, skip} = usePlayback();
  const {showGraph} = usePreferences();
  const {
    isActive: sessionActive,
    elapsedMs,
    stopSession,
  } = useSessionLog();

  const [currentMode, setCurrentMode] = useState<AlgorithmMode>('MAINTAIN');
  const [inZonePct, setInZonePct] = useState(0);
  const [avgHR, setAvgHR] = useState(0);
  const hrReadings = useRef<number[]>([]);

  const engine = ServiceRegistry.get<AdaptiveBPMEngine>('algorithm');
  const config = engine.getConfig() as AlgorithmConfig;
  const zone = config.targetZone ?? HR_ZONE_PRESETS[0];
  const modeColor = MODE_COLORS[currentMode];
  const spotifyConnected = !!SPOTIFY_CLIENT_ID;

  useEffect(() => {
    const unsub = eventBus.on('algo:modeChanged', event => {
      setCurrentMode(event.to);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (currentHR !== null && currentHR > 0) {
      hrReadings.current.push(currentHR);
      const sum = hrReadings.current.reduce((a, b) => a + b, 0);
      setAvgHR(Math.round(sum / hrReadings.current.length));
      const inZone = hrReadings.current.filter(
        hr => hr >= zone.minBPM && hr <= zone.maxBPM,
      ).length;
      setInZonePct(Math.round((inZone / hrReadings.current.length) * 100));
    }
  }, [currentHR, zone.minBPM, zone.maxBPM]);

  const handleStopSession = useCallback(async () => {
    Alert.alert('End Session', 'Are you sure you want to stop this session?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Stop',
        style: 'destructive',
        onPress: async () => {
          engine.stop();
          const musicService =
            ServiceRegistry.get<MusicPlayerService>('music');
          musicService.stop();
          const log = stopSession('user');
          stopBackgroundSession().catch(() => {});

          try {
            await saveSession(log);
          } catch {
            // Best effort
          }

          navigation.goBack();
        },
      },
    ]);
  }, [engine, stopSession, navigation]);

  const wasActive = useRef(false);

  useEffect(() => {
    if (sessionActive) {
      wasActive.current = true;
    } else if (wasActive.current) {
      navigation.goBack();
    }
  }, [sessionActive, navigation]);

  if (!sessionActive) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Mode bar */}
      <View style={[styles.modeBar, {borderBottomColor: modeColor + '4D'}]}>
        <View style={styles.modeLeft}>
          <View
            style={[
              styles.modeDot,
              {backgroundColor: modeColor, shadowColor: modeColor},
            ]}
          />
          <Text style={[styles.modeText, {color: modeColor}]}>
            {MODE_LABELS[currentMode]}
          </Text>
        </View>
        <Text style={styles.timerText}>{formatDuration(elapsedMs)}</Text>
      </View>

      {/* Heart rate display */}
      <View style={styles.hrDisplay}>
        <Text style={styles.hrNumber}>{currentHR ?? '—'}</Text>
        <Text style={styles.hrLabel}>Heart Rate</Text>
      </View>

      {/* Zone bar */}
      <ZoneBar
        currentHR={currentHR}
        zoneMin={zone.minBPM}
        zoneMax={zone.maxBPM}
        zoneName={zone.name}
        modeColor={modeColor}
      />

      {/* Optional graph */}
      {showGraph && (
        <HeartRateGraph
          data={hrHistory}
          zoneMin={zone.minBPM}
          zoneMax={zone.maxBPM}
          zoneColor={zone.color}
          connected={true}
        />
      )}

      {/* Now playing */}
      <ExpandedNowPlaying
        track={currentTrack}
        isPlaying={isPlaying}
        onPlay={play}
        onPause={pause}
        onSkip={skip}
        spotifyConnected={spotifyConnected}
      />

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{targetBPM ?? '—'}</Text>
          <Text style={styles.statLabel}>Target</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{inZonePct}%</Text>
          <Text style={styles.statLabel}>In Zone</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{avgHR || '—'}</Text>
          <Text style={styles.statLabel}>Avg HR</Text>
        </View>
      </View>

      {/* End session */}
      <TouchableOpacity style={styles.stopButton} onPress={handleStopSession}>
        <Text style={styles.stopButtonText}>End Session</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    padding: spacing.base,
    gap: spacing.md,
  },
  modeBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    marginBottom: spacing.md,
  },
  modeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  modeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  modeText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    letterSpacing: typography.letterSpacing.wider,
    fontFamily: typography.family.mono,
    textTransform: 'uppercase',
  },
  timerText: {
    color: colors.text.secondary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
    fontVariant: ['tabular-nums'],
    fontFamily: typography.family.mono,
  },
  hrDisplay: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  hrNumber: {
    color: colors.text.primary,
    fontSize: typography.size.hero,
    fontWeight: typography.weight.bold,
    lineHeight: 64,
    letterSpacing: typography.letterSpacing.tight,
  },
  hrLabel: {
    color: colors.text.tertiary,
    fontSize: typography.size.xs,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.widest,
    marginTop: 2,
    fontFamily: typography.family.mono,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 14,
    paddingBottom: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    marginTop: 2,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    color: colors.text.tertiary,
    fontSize: typography.size.xs,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wide,
    marginTop: 2,
  },
  stopButton: {
    backgroundColor: colors.action.destructive,
    paddingVertical: spacing.md,
    borderRadius: radii.xl,
    alignItems: 'center',
    marginTop: 'auto',
  },
  stopButtonText: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
  },
});
