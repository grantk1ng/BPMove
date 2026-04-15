import React from 'react';
import {View, Text, Image, TouchableOpacity, StyleSheet} from 'react-native';
import {colors, typography, spacing, radii} from '../theme';
import type {TrackMetadata} from '../modules/music/types';
import {
  MusicNoteIcon,
  PauseIcon,
  PlayIcon,
  SkipIcon,
} from './PlaybackIcons';

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
          <Text style={styles.target}>
            Target: {Math.round(targetBPM)} BPM
          </Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {track.artworkUrl ? (
        <Image source={{uri: track.artworkUrl}} style={styles.thumbnail} />
      ) : (
        <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
          <MusicNoteIcon size={20} color={colors.text.tertiary} />
        </View>
      )}
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
          style={styles.playButton}
          activeOpacity={0.85}>
          {isPlaying ? (
            <PauseIcon size={18} color={colors.bg.primary} />
          ) : (
            <PlayIcon size={18} color={colors.bg.primary} />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onSkip}
          style={styles.skipButton}
          activeOpacity={0.85}>
          <SkipIcon size={18} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radii.xl,
    padding: spacing.md,
    gap: spacing.md,
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: radii.sm,
  },
  thumbnailPlaceholder: {
    backgroundColor: colors.bg.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    color: colors.text.tertiary,
    fontSize: typography.size.base,
    flex: 1,
  },
  target: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
  },
  artist: {
    fontSize: typography.size.md,
    color: colors.text.secondary,
    marginTop: 2,
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  badge: {
    backgroundColor: colors.bg.elevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  targetBadge: {
    backgroundColor: '#553300',
  },
  badgeText: {
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    fontWeight: typography.weight.medium,
  },
  controls: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginLeft: spacing.md,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.text.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bg.elevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
});
