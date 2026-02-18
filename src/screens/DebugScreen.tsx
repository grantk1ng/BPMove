import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import {eventBus} from '../core/EventBus';
import {ServiceRegistry} from '../core/ServiceRegistry';
import {useHeartRate} from '../modules/heartrate/useHeartRate';
import {usePlayback} from '../modules/music/usePlayback';
import {useSessionLog} from '../modules/logging/useSessionLog';
import {
  exportTimeSeriesCSV,
  exportEventsCSV,
  exportJSON,
} from '../modules/logging/LogExporter';
import {HR_ZONE_PRESETS, createDefaultConfig} from '../modules/algorithm/presets';
import type {HRZone, AlgorithmMode, AlgorithmConfig} from '../modules/algorithm/types';
import type {AdaptiveBPMEngine} from '../modules/algorithm/AdaptiveBPMEngine';
import {HeartRateDisplay} from '../components/HeartRateDisplay';
import {ZoneSelector} from '../components/ZoneSelector';
import {NowPlaying} from '../components/NowPlaying';
import {EventLogView} from '../components/EventLogView';
import {formatDuration} from '../utils/formatters';
import {requestBlePermissions} from '../utils/permissions';
import type {SessionLog} from '../modules/logging/types';

export function DebugScreen() {
  const {
    currentHR,
    connectionState,
    devices,
    startScan,
    connect,
    disconnect,
  } = useHeartRate();

  const {
    currentTrack,
    isPlaying,
    targetBPM,
    play,
    pause,
    skip,
  } = usePlayback();

  const {
    isActive: sessionActive,
    elapsedMs,
    entryCount,
    timeSeriesCount,
    startSession,
    stopSession,
  } = useSessionLog();

  const [selectedZone, setSelectedZone] = useState<HRZone>(HR_ZONE_PRESETS[0]);
  const [currentMode, setCurrentMode] = useState<AlgorithmMode>('MAINTAIN');
  const [lastSessionLog, setLastSessionLog] = useState<SessionLog | null>(null);

  useEffect(() => {
    const unsub = eventBus.on('algo:modeChanged', event => {
      setCurrentMode(event.to);
    });
    return unsub;
  }, []);

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

    // Initialize the algorithm engine with the selected config
    const engine = ServiceRegistry.get<AdaptiveBPMEngine>('algorithm');
    engine.updateConfig(config);
    engine.start();

    startSession(config as unknown as Record<string, unknown>);
    setCurrentMode('MAINTAIN');
  }, [selectedZone, startSession]);

  const handleStopSession = useCallback(() => {
    const engine = ServiceRegistry.get<AdaptiveBPMEngine>('algorithm');
    engine.stop();

    const log = stopSession('user');
    setLastSessionLog(log);
  }, [stopSession]);

  const handleExport = useCallback(
    (format: 'timeseries' | 'events' | 'json') => {
      if (!lastSessionLog) {
        Alert.alert('No Session', 'Complete a session first to export data.');
        return;
      }

      let content: string;
      let filename: string;

      switch (format) {
        case 'timeseries':
          content = exportTimeSeriesCSV(lastSessionLog);
          filename = `bpmove-timeseries-${lastSessionLog.sessionId}.csv`;
          break;
        case 'events':
          content = exportEventsCSV(lastSessionLog);
          filename = `bpmove-events-${lastSessionLog.sessionId}.csv`;
          break;
        case 'json':
          content = exportJSON(lastSessionLog);
          filename = `bpmove-session-${lastSessionLog.sessionId}.json`;
          break;
      }

      // TODO: Write to file system and share via react-native-share
      Alert.alert(
        'Export Ready',
        `${filename}\n${content.length} characters\n\nFile sharing will be available after react-native-fs and react-native-share are installed.`,
      );
    },
    [lastSessionLog],
  );

  const getZoneColor = () => {
    switch (currentMode) {
      case 'RAISE':
        return '#2196F3';
      case 'LOWER':
        return '#F44336';
      case 'MAINTAIN':
        return selectedZone.color;
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}>
        {/* Heart Rate Display */}
        <HeartRateDisplay
          bpm={currentHR}
          mode={currentMode}
          zoneColor={getZoneColor()}
        />

        {/* BLE Connection */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            BLE: {connectionState}
          </Text>
          {connectionState === 'disconnected' && (
            <TouchableOpacity style={styles.button} onPress={startScan}>
              <Text style={styles.buttonText}>Scan for Devices</Text>
            </TouchableOpacity>
          )}
          {connectionState === 'scanning' &&
            devices.map(device => (
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
          {connectionState === 'connected' && (
            <TouchableOpacity style={styles.buttonDanger} onPress={disconnect}>
              <Text style={styles.buttonText}>Disconnect</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Zone Selector */}
        <ZoneSelector
          zones={HR_ZONE_PRESETS}
          selectedZone={selectedZone}
          onSelect={setSelectedZone}
          disabled={sessionActive}
        />

        {/* Session Controls */}
        <View style={styles.section}>
          {!sessionActive ? (
            <TouchableOpacity
              style={styles.buttonPrimary}
              onPress={handleStartSession}>
              <Text style={styles.buttonText}>Start Session</Text>
            </TouchableOpacity>
          ) : (
            <View>
              <View style={styles.statsRow}>
                <Text style={styles.stat}>
                  {formatDuration(elapsedMs)}
                </Text>
                <Text style={styles.statLabel}>
                  {entryCount} events | {timeSeriesCount} readings
                </Text>
              </View>
              <TouchableOpacity
                style={styles.buttonDanger}
                onPress={handleStopSession}>
                <Text style={styles.buttonText}>Stop Session</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Now Playing */}
        <NowPlaying
          track={currentTrack}
          isPlaying={isPlaying}
          targetBPM={targetBPM}
          onPlay={play}
          onPause={pause}
          onSkip={skip}
        />

        {/* Export */}
        {lastSessionLog && !sessionActive && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Export Last Session</Text>
            <View style={styles.exportRow}>
              <TouchableOpacity
                style={styles.exportButton}
                onPress={() => handleExport('timeseries')}>
                <Text style={styles.exportText}>CSV (Time Series)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.exportButton}
                onPress={() => handleExport('events')}>
                <Text style={styles.exportText}>CSV (Events)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.exportButton}
                onPress={() => handleExport('json')}>
                <Text style={styles.exportText}>JSON</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Event Log (bottom half) */}
      <View style={styles.logContainer}>
        <EventLogView />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
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
  buttonPrimary: {
    backgroundColor: '#1976D2',
    paddingVertical: 14,
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
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  stat: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    color: '#888',
    fontSize: 12,
  },
  exportRow: {
    flexDirection: 'row',
    gap: 8,
  },
  exportButton: {
    flex: 1,
    backgroundColor: '#333',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  exportText: {
    color: '#ccc',
    fontSize: 12,
    fontWeight: '500',
  },
  logContainer: {
    height: 200,
    borderTopWidth: 1,
    borderTopColor: '#333',
    padding: 12,
  },
});
