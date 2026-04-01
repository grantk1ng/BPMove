import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import {
  loadSessionIndex,
  loadSession,
  deleteSession,
  deleteAllSessions,
} from '../modules/logging/SessionStore';
import {
  exportTimeSeriesCSV,
  exportEventsCSV,
  exportJSON,
} from '../modules/logging/LogExporter';
import type {SessionSummary} from '../modules/logging/SessionStore';
import {formatDuration} from '../utils/formatters';

export function HistoryScreen() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadSessions = useCallback(async () => {
    const index = await loadSessionIndex();
    setSessions(index);
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSessions();
    setRefreshing(false);
  }, [loadSessions]);

  const handleExport = useCallback(
    async (sessionId: string, format: 'timeseries' | 'events' | 'json') => {
      const log = await loadSession(sessionId);
      if (!log) {
        Alert.alert('Error', 'Session data not found.');
        return;
      }

      let content: string;
      let filename: string;
      let mimeType: string;

      switch (format) {
        case 'timeseries':
          content = exportTimeSeriesCSV(log);
          filename = `bpmove-timeseries-${log.sessionId}.csv`;
          mimeType = 'text/csv';
          break;
        case 'events':
          content = exportEventsCSV(log);
          filename = `bpmove-events-${log.sessionId}.csv`;
          mimeType = 'text/csv';
          break;
        case 'json':
          content = exportJSON(log);
          filename = `bpmove-session-${log.sessionId}.json`;
          mimeType = 'application/json';
          break;
      }

      try {
        const dir = Platform.OS === 'ios'
          ? RNFS.DocumentDirectoryPath
          : RNFS.CachesDirectoryPath;
        const filePath = `${dir}/${filename}`;

        await RNFS.writeFile(filePath, content, 'utf8');
        await Share.open({url: `file://${filePath}`, type: mimeType, filename});
      } catch (err: unknown) {
        const dismissed = err instanceof Error && err.message.includes('User did not share');
        if (!dismissed) {
          Alert.alert('Export Failed', err instanceof Error ? err.message : 'Unknown error');
        }
      }
    },
    [],
  );

  const handleDelete = useCallback(
    (sessionId: string) => {
      Alert.alert('Delete Session', 'This cannot be undone.', [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteSession(sessionId);
            await loadSessions();
          },
        },
      ]);
    },
    [loadSessions],
  );

  const handleDeleteAll = useCallback(() => {
    Alert.alert(
      'Delete All Sessions',
      `This will delete ${sessions.length} sessions. This cannot be undone.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            await deleteAllSessions();
            await loadSessions();
          },
        },
      ],
    );
  }, [sessions.length, loadSessions]);

  const showExportOptions = useCallback(
    (sessionId: string) => {
      Alert.alert('Export Format', 'Choose an export format', [
        {text: 'CSV (Time Series)', onPress: () => handleExport(sessionId, 'timeseries')},
        {text: 'CSV (Events)', onPress: () => handleExport(sessionId, 'events')},
        {text: 'JSON', onPress: () => handleExport(sessionId, 'json')},
        {text: 'Cancel', style: 'cancel'},
      ]);
    },
    [handleExport],
  );

  const renderSession = ({item}: {item: SessionSummary}) => (
    <View style={styles.sessionCard}>
      <View style={styles.sessionHeader}>
        <Text style={styles.sessionDate}>
          {new Date(item.startTime).toLocaleDateString()}{' '}
          {new Date(item.startTime).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
        <Text style={styles.sessionDuration}>
          {formatDuration(item.durationMs)}
        </Text>
      </View>

      <View style={styles.metricsRow}>
        {item.metadata.avgHeartRate && (
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{item.metadata.avgHeartRate}</Text>
            <Text style={styles.metricLabel}>avg HR</Text>
          </View>
        )}
        {item.metadata.maxHeartRate && (
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{item.metadata.maxHeartRate}</Text>
            <Text style={styles.metricLabel}>max HR</Text>
          </View>
        )}
        <View style={styles.metric}>
          <Text style={styles.metricValue}>
            {item.metadata.totalTracksPlayed}
          </Text>
          <Text style={styles.metricLabel}>tracks</Text>
        </View>
        {item.durationMs > 0 && (
          <View style={styles.metric}>
            <Text style={styles.metricValue}>
              {Math.round((item.metadata.timeInZoneMs / item.durationMs) * 100)}%
            </Text>
            <Text style={styles.metricLabel}>in zone</Text>
          </View>
        )}
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => showExportOptions(item.sessionId)}>
          <Text style={styles.actionText}>Export</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButtonDanger}
          onPress={() => handleDelete(item.sessionId)}>
          <Text style={styles.actionText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {sessions.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No sessions yet</Text>
          <Text style={styles.emptyHint}>
            Complete a workout session to see it here
          </Text>
        </View>
      ) : (
        <>
          <FlatList
            data={sessions}
            keyExtractor={item => item.sessionId}
            renderItem={renderSession}
            contentContainerStyle={styles.listContent}
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
          {sessions.length > 1 && (
            <TouchableOpacity
              style={styles.deleteAllButton}
              onPress={handleDeleteAll}>
              <Text style={styles.deleteAllText}>Delete All Sessions</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  sessionCard: {
    backgroundColor: '#252525',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionDate: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  sessionDuration: {
    color: '#aaa',
    fontSize: 15,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  metric: {
    alignItems: 'center',
  },
  metricValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  metricLabel: {
    color: '#888',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#333',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonDanger: {
    backgroundColor: '#3a2020',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionText: {
    color: '#ccc',
    fontSize: 13,
    fontWeight: '500',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    color: '#888',
    fontSize: 18,
    fontWeight: '500',
  },
  emptyHint: {
    color: '#555',
    fontSize: 14,
  },
  deleteAllButton: {
    margin: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#2a1515',
  },
  deleteAllText: {
    color: '#c62828',
    fontSize: 14,
    fontWeight: '500',
  },
});
