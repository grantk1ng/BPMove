import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import {UserPreferences} from '../../modules/preferences/UserPreferences';
import {colors, typography, spacing, radii} from '../../theme';
import type {OnboardingStackScreenProps} from '../../navigation/types';

export function AgeInputScreen({
  navigation,
}: OnboardingStackScreenProps<'AgeInput'>) {
  const [ageText, setAgeText] = useState('');

  const handleContinue = async () => {
    const age = parseInt(ageText, 10);
    if (isNaN(age) || ageText === '') {
      navigation.navigate('BLEPairing');
      return;
    }
    if (age < 13) {
      Alert.alert(
        'Age Requirement',
        'BPMove requires users to be at least 13 years old.',
      );
      return;
    }
    await UserPreferences.setAge(age);
    navigation.navigate('BLEPairing');
  };

  const handleSkip = () => {
    navigation.navigate('BLEPairing');
  };

  return (
    <View style={styles.container}>
      <View style={styles.dots}>
        <View style={styles.dot} />
        <View style={[styles.dot, styles.dotActive]} />
        <View style={styles.dot} />
      </View>

      <View style={styles.content}>
        <Text style={styles.heading}>Optimize your heart rate zones</Text>
        <Text style={styles.description}>
          Enter your age to calculate personalized zone boundaries based on your
          estimated max heart rate.
        </Text>

        <TextInput
          style={styles.input}
          value={ageText}
          onChangeText={setAgeText}
          keyboardType="number-pad"
          placeholder="Age"
          placeholderTextColor={colors.text.muted}
          maxLength={3}
          autoFocus
        />
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.button} onPress={handleContinue}>
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSkip}>
          <Text style={styles.skipText}>Skip — I'll set zones manually</Text>
        </TouchableOpacity>
      </View>
    </View>
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
    paddingTop: 60,
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
    gap: spacing.base,
  },
  heading: {
    color: colors.text.primary,
    fontSize: 24,
    fontWeight: typography.weight.bold,
    textAlign: 'center',
  },
  description: {
    color: colors.text.secondary,
    fontSize: typography.size.base,
    textAlign: 'center',
    lineHeight: 22,
  },
  input: {
    color: colors.text.primary,
    fontSize: 48,
    fontWeight: typography.weight.bold,
    textAlign: 'center',
    width: 120,
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: colors.border.default,
    fontVariant: ['tabular-nums'],
  },
  footer: {
    gap: spacing.base,
    marginBottom: 40,
  },
  button: {
    backgroundColor: colors.action.primary,
    paddingVertical: spacing.lg,
    borderRadius: radii.xl,
    alignItems: 'center',
  },
  buttonText: {
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
  },
  skipText: {
    color: colors.text.secondary,
    fontSize: typography.size.md,
    textAlign: 'center',
  },
});
