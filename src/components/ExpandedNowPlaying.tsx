import React from 'react';
import {View, Text, Image, TouchableOpacity, StyleSheet} from 'react-native';
import {colors, typography, spacing, radii} from '../theme';
import type {TrackMetadata} from '../contracts';

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
          <Text style={styles.placeholderIcon}>♪</Text>
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
          style={styles.controlButton}
          hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}>
          <Text style={styles.controlIcon}>{isPlaying ? '⏸' : '▶'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onSkip}
          style={styles.controlButton}
          hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}>
          <Text style={styles.controlIcon}>⏭</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const ALBUM_ART_SIZE = 140;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  albumArt: {
    width: ALBUM_ART_SIZE,
    height: ALBUM_ART_SIZE,
    borderRadius: radii.md,
    marginBottom: spacing.md,
  },
  albumArtPlaceholder: {
    backgroundColor: colors.bg.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderIcon: {
    color: colors.text.tertiary,
    fontSize: 32,
  },
  trackTitle: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  trackArtist: {
    color: colors.text.tertiary,
    fontSize: typography.size.md,
    fontFamily: typography.family.mono,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  controls: {
    flexDirection: 'row',
    gap: spacing.xl,
    alignItems: 'center',
  },
  controlButton: {
    padding: spacing.sm,
  },
  controlIcon: {
    color: colors.text.secondary,
    fontSize: 24,
  },
  collapsedContainer: {
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  collapsedText: {
    color: colors.text.tertiary,
    fontSize: typography.size.md,
  },
});
