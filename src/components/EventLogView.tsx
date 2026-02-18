import React, {useState, useEffect, useRef} from 'react';
import {View, Text, FlatList, StyleSheet} from 'react-native';
import {eventBus} from '../core/EventBus';
import {formatTimestamp} from '../utils/formatters';

interface LogItem {
  id: string;
  timestamp: number;
  event: string;
  detail: string;
}

const MAX_ITEMS = 50;

export function EventLogView() {
  const [items, setItems] = useState<LogItem[]>([]);
  const counterRef = useRef(0);

  useEffect(() => {
    const addItem = (event: string, detail: string) => {
      counterRef.current++;
      const item: LogItem = {
        id: String(counterRef.current),
        timestamp: Date.now(),
        event,
        detail,
      };
      setItems(prev => [item, ...prev].slice(0, MAX_ITEMS));
    };

    const unsubs = [
      eventBus.on('hr:reading', r =>
        addItem('HR', `${r.bpm} bpm`),
      ),
      eventBus.on('algo:target', t =>
        addItem('TARGET', `${t.targetBPM} BPM (${t.mode})`),
      ),
      eventBus.on('algo:modeChanged', m =>
        addItem('MODE', `${m.from} → ${m.to}`),
      ),
      eventBus.on('music:changed', t =>
        addItem('TRACK', `${t.title} (${t.bpm} BPM)`),
      ),
      eventBus.on('hr:connectionStateChanged', s =>
        addItem('BLE', s),
      ),
    ];

    return () => unsubs.forEach(u => u());
  }, []);

  const renderItem = ({item}: {item: LogItem}) => (
    <View style={styles.row}>
      <Text style={styles.time}>{formatTimestamp(item.timestamp)}</Text>
      <Text style={styles.event}>{item.event}</Text>
      <Text style={styles.detail} numberOfLines={1}>
        {item.detail}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Event Log</Text>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        style={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    fontSize: 12,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  list: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 4,
    gap: 8,
  },
  time: {
    fontSize: 11,
    color: '#666',
    fontVariant: ['tabular-nums'],
    width: 60,
  },
  event: {
    fontSize: 11,
    color: '#ff9800',
    fontWeight: '600',
    width: 50,
  },
  detail: {
    fontSize: 11,
    color: '#ccc',
    flex: 1,
  },
});
