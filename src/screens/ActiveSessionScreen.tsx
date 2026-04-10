import React, {useState, useEffect, useCallback, useRef} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Alert} from 'react-native';
import {eventBus} from '../core/EventBus';
import {ServiceRegistry} from '../core/ServiceRegistry';
import {useHeartRate} from '../modules/heartrate/useHeartRate';
import {useHRHistory} from '../modules/heartrate/useHRHistory';
import {usePlayback} from '../modules/music/usePlayback';
import {useSessionLog} from '../modules/logging/useSessionLog';
import {HeartRateDisplay} from '../components/HeartRateDisplay';
import {HeartRateGraph} from '../components/HeartRateGraph';
import {NowPlaying} from '../components/NowPlaying';
import {HR_ZONE_PRESETS} from '../modules/algorithm/presets';
import type {AlgorithmMode, AlgorithmConfig} from '../modules/algorithm/types';
import type {AdaptiveBPMEngine} from '../modules/algorithm/AdaptiveBPMEngine';
import type {MusicPlayerService} from '../modules/music/MusicPlayerService';
import {stopBackgroundSession} from '../modules/background';
import {saveSession} from '../modules/logging/SessionStore';
import {formatDuration} from '../utils/formatters';
import type {SessionStackScreenProps} from '../navigation/types';

export function ActiveSessionScreen({
  navigation,
}: SessionStackScreenProps<'ActiveSession'>) {
  const {currentHR} = useHeartRate();
  const {history: hrHistory} = useHRHistory();
  const {currentTrack, isPlaying, targetBPM, play, pause, skip} = usePlayback();
  const {
    isActive: sessionActive,
    elapsedMs,
    entryCount,
    timeSeriesCount,
    stopSession,
  } = useSessionLog();

  const [currentMode, setCurrentMode] = useState<AlgorithmMode>('MAINTAIN');

  const engine = ServiceRegistry.get<AdaptiveBPMEngine>('algorithm');
  const config = engine.getConfig() as AlgorithmConfig;
  const zone = config.targetZone ?? HR_ZONE_PRESETS[0];

  useEffect(() => {
    const unsub = eventBus.on('algo:modeChanged', event => {
      setCurrentMode(event.to);
    });
    return unsub;
  }, []);

  const getZoneColor = () => {
    switch (currentMode) {
      case 'RAISE':
        return '#2196F3';
      case 'LOWER':
        return '#F44336';
      case 'MAINTAIN':
        return zone.color;
    }
  };

  const getModeLabel = () => {
    switch (currentMode) {
      case 'RAISE':
        return 'RAISING BPM';
      case 'LOWER':
        return 'LOWERING BPM';
      case 'MAINTAIN':
        return 'IN ZONE';
    }
  };

  const handleStopSession = useCallback(async () => {
    Alert.alert(
      'End Session',
      'Are you sure you want to stop this session?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Stop',
          style: 'destructive',
          onPress: async () => {
            engine.stop();
            const musicService = ServiceRegistry.get<MusicPlayerService>('music');
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
      ],
    );
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
    <View style={styles.container}>
      {/* Mode indicator bar */}
      <View style={[styles.modeBar, {backgroundColor: getZoneColor()}]}>
        <Text style={styles.modeText}>{getModeLabel()}</Text>
        <Text style={styles.timerText}>{formatDuration(elapsedMs)}</Text>
      </View>

      {/* Large HR display */}
      <HeartRateDisplay
        bpm={currentHR}
        mode={currentMode}
        zoneColor={getZoneColor()}
      />

      {/* HR Graph */}
      <HeartRateGraph
        data={hrHistory}
        zoneMin={zone.minBPM}
        zoneMax={zone.maxBPM}
        zoneColor={zone.color}
        connected={true}
      />

      {/* Now Playing */}
      <NowPlaying
        track={currentTrack}
        isPlaying={isPlaying}
        targetBPM={targetBPM}
        onPlay={play}
        onPause={pause}
        onSkip={skip}
      />

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{entryCount}</Text>
          <Text style={styles.statLabel}>events</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{timeSeriesCount}</Text>
          <Text style={styles.statLabel}>readings</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{targetBPM ?? '—'}</Text>
          <Text style={styles.statLabel}>target BPM</Text>
        </View>
      </View>

      {/* Stop button */}
      <TouchableOpacity style={styles.stopButton} onPress={handleStopSession}>
        <Text style={styles.stopButtonText}>End Session</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    padding: 16,
    gap: 12,
  },
  modeBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  timerText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    color: '#888',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stopButton: {
    backgroundColor: '#c62828',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 'auto',
  },
  stopButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
