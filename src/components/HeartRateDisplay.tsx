import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {colors, typography, spacing} from '../theme';
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
    paddingVertical: spacing.base,
  },
  bpm: {
    fontSize: 72,
    fontWeight: typography.weight.bold,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    fontSize: typography.size.base,
    color: colors.text.secondary,
    marginTop: -8,
  },
  mode: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    marginTop: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wider,
  },
});
