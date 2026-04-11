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
import {colors, typography, spacing, radii} from '../theme';

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
        const dir =
          Platform.OS === 'ios'
            ? RNFS.DocumentDirectoryPath
            : RNFS.CachesDirectoryPath;
        const filePath = `${dir}/${filename}`;

        await RNFS.writeFile(filePath, content, 'utf8');
        await Share.open({url: `file://${filePath}`, type: mimeType, filename});
      } catch (err: unknown) {
        const dismissed =
          err instanceof Error && err.message.includes('User did not share');
        if (!dismissed) {
          Alert.alert(
            'Export Failed',
            err instanceof Error ? err.message : 'Unknown error',
          );
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
        {
          text: 'CSV (Time Series)',
          onPress: () => handleExport(sessionId, 'timeseries'),
        },
        {
          text: 'CSV (Events)',
          onPress: () => handleExport(sessionId, 'events'),
        },
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
              {Math.round(
                (item.metadata.timeInZoneMs / item.durationMs) * 100,
              )}
              %
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
          <Text style={styles.actionTextDanger}>Delete</Text>
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
    backgroundColor: colors.bg.primary,
  },
  listContent: {
    padding: spacing.base,
    gap: spacing.md,
  },
  sessionCard: {
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radii.lg,
    padding: spacing.base,
    gap: spacing.md,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionDate: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
  sessionDuration: {
    color: colors.text.secondary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    fontVariant: ['tabular-nums'],
    fontFamily: typography.family.mono,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  metric: {
    alignItems: 'center',
  },
  metricValue: {
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    fontVariant: ['tabular-nums'],
  },
  metricLabel: {
    color: colors.text.tertiary,
    fontSize: typography.size.xs,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wide,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    backgroundColor: colors.bg.elevated,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  actionButtonDanger: {
    backgroundColor: colors.action.destructiveBg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  actionText: {
    color: colors.text.secondary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
  },
  actionTextDanger: {
    color: colors.action.destructive,
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyText: {
    color: colors.text.secondary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.medium,
  },
  emptyHint: {
    color: colors.text.tertiary,
    fontSize: typography.size.base,
  },
  deleteAllButton: {
    margin: spacing.base,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
    backgroundColor: colors.action.destructiveBg,
  },
  deleteAllText: {
    color: colors.action.destructive,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
  },
});
