import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {colors, typography, spacing, radii} from '../theme';
import type {HRZone} from '../modules/algorithm/types';

interface Props {
  zones: HRZone[];
  selectedZone: HRZone;
  onSelect: (zone: HRZone) => void;
  disabled: boolean;
}

export function ZoneSelector({zones, selectedZone, onSelect, disabled}: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Target Zone</Text>
      <View style={styles.chips}>
        {zones.map(zone => {
          const isSelected = zone.name === selectedZone.name;
          return (
            <TouchableOpacity
              key={zone.name}
              style={[
                styles.chip,
                isSelected && {backgroundColor: zone.color},
                disabled && styles.chipDisabled,
              ]}
              onPress={() => onSelect(zone)}
              disabled={disabled}
              activeOpacity={0.7}>
              <Text
                style={[
                  styles.chipText,
                  isSelected && styles.chipTextSelected,
                ]}>
                {zone.name}
              </Text>
              <Text
                style={[
                  styles.chipRange,
                  isSelected && styles.chipTextSelected,
                ]}>
                {zone.minBPM}-{zone.maxBPM}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
  },
  label: {
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wide,
    marginBottom: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.bg.card,
    alignItems: 'center',
  },
  chipDisabled: {
    opacity: 0.5,
  },
  chipText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.text.secondary,
  },
  chipTextSelected: {
    color: colors.text.primary,
  },
  chipRange: {
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
});
