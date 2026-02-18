import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import type {TrackMetadata} from '../modules/music/types';

interface Props {
  track: TrackMetadata | null;
  isPlaying: boolean;
  targetBPM: number | null;
  onPlay: () => void;
  onPause: () => void;
  onSkip: () => void;
}

export function NowPlaying({
  track,
  isPlaying,
  targetBPM,
  onPlay,
  onPause,
  onSkip,
}: Props) {
  if (!track) {
    return (
      <View style={styles.container}>
        <Text style={styles.empty}>No track playing</Text>
        {targetBPM !== null && (
          <Text style={styles.target}>Target: {Math.round(targetBPM)} BPM</Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {track.artist}
        </Text>
        <View style={styles.badges}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{track.bpm} BPM</Text>
          </View>
          {targetBPM !== null && (
            <View style={[styles.badge, styles.targetBadge]}>
              <Text style={styles.badgeText}>
                Target: {Math.round(targetBPM)}
              </Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.controls}>
        <TouchableOpacity
          onPress={isPlaying ? onPause : onPlay}
          style={styles.playButton}>
          <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onSkip} style={styles.skipButton}>
          <Text style={styles.skipIcon}>⏭</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 12,
  },
  empty: {
    color: '#666',
    fontSize: 14,
    flex: 1,
  },
  target: {
    color: '#888',
    fontSize: 12,
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  artist: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  badge: {
    backgroundColor: '#444',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  targetBadge: {
    backgroundColor: '#553300',
  },
  badgeText: {
    fontSize: 11,
    color: '#ccc',
    fontWeight: '500',
  },
  controls: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 12,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    fontSize: 18,
    color: '#fff',
  },
  skipButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipIcon: {
    fontSize: 16,
    color: '#ccc',
  },
});
