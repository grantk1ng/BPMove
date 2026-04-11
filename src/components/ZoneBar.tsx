import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {colors, typography, spacing} from '../theme';

interface ZoneBarProps {
  currentHR: number | null;
  zoneMin: number;
  zoneMax: number;
  zoneName: string;
  modeColor: string;
  rangeMin?: number;
  rangeMax?: number;
}

const DEFAULT_RANGE_MIN = 100;
const DEFAULT_RANGE_MAX = 200;

export function ZoneBar({
  currentHR,
  zoneMin,
  zoneMax,
  zoneName,
  modeColor,
  rangeMin = DEFAULT_RANGE_MIN,
  rangeMax = DEFAULT_RANGE_MAX,
}: ZoneBarProps) {
  const totalRange = rangeMax - rangeMin;
  const zoneLeftPct = ((zoneMin - rangeMin) / totalRange) * 100;
  const zoneWidthPct = ((zoneMax - zoneMin) / totalRange) * 100;

  const tickPct =
    currentHR !== null
      ? Math.max(0, Math.min(100, ((currentHR - rangeMin) / totalRange) * 100))
      : null;

  return (
    <View style={styles.container}>
      <View style={styles.track}>
        <View
          style={[
            styles.zoneHighlight,
            {
              left: `${zoneLeftPct}%`,
              width: `${zoneWidthPct}%`,
              backgroundColor: modeColor + '26',
            },
          ]}
        />
        {tickPct !== null && (
          <View
            style={[
              styles.tick,
              {
                left: `${tickPct}%`,
                backgroundColor: modeColor,
              },
            ]}
          />
        )}
      </View>
      <View style={styles.labels}>
        <Text style={styles.rangeLabel}>{rangeMin}</Text>
        <Text style={[styles.zoneLabel, {color: modeColor}]}>
          {zoneName}: {zoneMin}–{zoneMax}
        </Text>
        <Text style={styles.rangeLabel}>{rangeMax}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.sm,
  },
  track: {
    position: 'relative',
    height: 4,
    backgroundColor: colors.bg.elevated,
    borderRadius: 2,
    marginBottom: spacing.xs,
  },
  zoneHighlight: {
    position: 'absolute',
    height: '100%',
    borderRadius: 2,
  },
  tick: {
    position: 'absolute',
    top: -6,
    width: 4,
    height: 16,
    borderRadius: 2,
    marginLeft: -2,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rangeLabel: {
    color: colors.text.muted,
    fontSize: typography.size.xs,
    fontFamily: typography.family.mono,
  },
  zoneLabel: {
    fontSize: typography.size.xs,
    fontFamily: typography.family.system,
  },
});
