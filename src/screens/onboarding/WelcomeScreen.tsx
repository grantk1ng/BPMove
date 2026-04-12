import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {colors, typography, spacing, radii} from '../../theme';
import type {OnboardingStackScreenProps} from '../../navigation/types';

export function WelcomeScreen({
  navigation,
}: OnboardingStackScreenProps<'Welcome'>) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.dots}>
        <View style={[styles.dot, styles.dotActive]} />
        <View style={styles.dot} />
        <View style={styles.dot} />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>BPMove</Text>
        <Text style={styles.tagline}>Music that matches your heartbeat</Text>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('AgeInput')}>
        <Text style={styles.buttonText}>Get Started</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    padding: spacing.xl,
    justifyContent: 'space-between',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingTop: spacing.base,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.bg.elevated,
  },
  dotActive: {
    backgroundColor: colors.text.primary,
  },
  content: {
    alignItems: 'center',
  },
  title: {
    color: colors.text.primary,
    fontSize: 48,
    fontWeight: typography.weight.heavy,
    letterSpacing: typography.letterSpacing.tight,
    marginBottom: spacing.md,
  },
  tagline: {
    color: colors.text.secondary,
    fontSize: typography.size.lg,
    textAlign: 'center',
  },
  button: {
    backgroundColor: colors.action.primary,
    paddingVertical: spacing.lg,
    borderRadius: radii.xl,
    alignItems: 'center',
    marginBottom: 40,
  },
  buttonText: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
  },
});
