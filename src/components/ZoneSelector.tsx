import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
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
    paddingVertical: 8,
  },
  label: {
    fontSize: 12,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  chips: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
  },
  chipDisabled: {
    opacity: 0.5,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ccc',
  },
  chipTextSelected: {
    color: '#fff',
  },
  chipRange: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
});
