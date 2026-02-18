import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import type {AlgorithmMode} from '../modules/algorithm/types';

interface Props {
  bpm: number | null;
  mode: AlgorithmMode;
  zoneColor: string;
}

export function HeartRateDisplay({bpm, mode, zoneColor}: Props) {
  return (
    <View style={styles.container}>
      <Text style={[styles.bpm, {color: zoneColor}]}>
        {bpm !== null ? Math.round(bpm) : '--'}
      </Text>
      <Text style={styles.unit}>bpm</Text>
      <Text style={[styles.mode, {color: zoneColor}]}>{mode}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  bpm: {
    fontSize: 72,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  unit: {
    fontSize: 16,
    color: '#888',
    marginTop: -8,
  },
  mode: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
});
