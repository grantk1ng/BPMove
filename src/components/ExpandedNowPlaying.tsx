import React from 'react';
import {View, Text, Image, TouchableOpacity, StyleSheet} from 'react-native';
import {colors, typography, spacing, radii} from '../theme';
import type {TrackMetadata} from '../contracts';
import {
  MusicNoteIcon,
  PauseIcon,
  PlayIcon,
  SkipIcon,
} from './PlaybackIcons';

interface ExpandedNowPlayingProps {
  track: TrackMetadata | null;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSkip: () => void;
  spotifyConnected: boolean;
}

export function ExpandedNowPlaying({
  track,
  isPlaying,
  onPlay,
  onPause,
  onSkip,
  spotifyConnected,
}: ExpandedNowPlayingProps) {
  if (!spotifyConnected) {
    return (
      <View style={styles.collapsedContainer}>
        <Text style={styles.collapsedText}>
          Connect Spotify in Settings for music playback
        </Text>
      </View>
    );
  }

  if (!track) {
    return (
      <View style={styles.collapsedContainer}>
        <Text style={styles.collapsedText}>No track playing</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {track.artworkUrl ? (
        <Image source={{uri: track.artworkUrl}} style={styles.albumArt} />
      ) : (
        <View style={[styles.albumArt, styles.albumArtPlaceholder]}>
          <MusicNoteIcon size={28} color={colors.text.tertiary} />
        </View>
      )}

      <Text style={styles.trackTitle} numberOfLines={1}>
        {track.title}
      </Text>
      <Text style={styles.trackArtist} numberOfLines={1}>
        {track.artist} · {track.bpm} BPM
      </Text>

      <View style={styles.controls}>
        <TouchableOpacity
          onPress={isPlaying ? onPause : onPlay}
          style={[styles.controlButton, styles.primaryControlButton]}
          activeOpacity={0.85}
          hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}>
          {isPlaying ? (
            <PauseIcon size={20} color={colors.bg.primary} />
          ) : (
            <PlayIcon size={20} color={colors.bg.primary} />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onSkip}
          style={styles.controlButton}
          activeOpacity={0.85}
          hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}>
          <SkipIcon size={18} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const ALBUM_ART_SIZE = 100;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  albumArt: {
    width: ALBUM_ART_SIZE,
    height: ALBUM_ART_SIZE,
    borderRadius: radii.lg,
    marginBottom: spacing.base,
  },
  albumArtPlaceholder: {
    backgroundColor: colors.bg.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackTitle: {
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  trackArtist: {
    color: colors.text.secondary,
    fontSize: typography.size.md,
    fontFamily: typography.family.mono,
    textAlign: 'center',
    marginBottom: spacing.base,
  },
  controls: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  controlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.border.default,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryControlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.text.primary,
    borderColor: colors.text.primary,
  },
  collapsedContainer: {
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radii.xl,
    padding: spacing.md,
    alignItems: 'center',
  },
  collapsedText: {
    color: colors.text.tertiary,
    fontSize: typography.size.md,
  },
});
