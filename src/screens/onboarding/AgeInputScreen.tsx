import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {UserPreferences} from '../../modules/preferences/UserPreferences';
import {colors, typography, spacing, radii} from '../../theme';
import type {OnboardingStackScreenProps} from '../../navigation/types';

export function AgeInputScreen({
  navigation,
}: OnboardingStackScreenProps<'AgeInput'>) {
  const [ageText, setAgeText] = useState('');

  const age = parseInt(ageText, 10);
  const hasValidAge = !isNaN(age) && age >= 13 && ageText !== '';
  const isTooYoung = !isNaN(age) && age < 13 && ageText !== '';

  const handleContinue = async () => {
    if (isTooYoung) {
      Alert.alert(
        'Age Requirement',
        'BPMove requires users to be at least 13 years old.',
      );
      return;
    }
    if (!hasValidAge) {
      return;
    }
    await UserPreferences.setAge(age);
    navigation.navigate('BLEPairing');
  };

  const handleSkip = () => {
    navigation.navigate('BLEPairing');
  };

  return (
    <SafeAreaView style={styles.safe}>
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        bounces={false}>
        <View style={styles.dots}>
          <View style={styles.dot} />
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
        </View>

        <View style={styles.content}>
          <Text style={styles.heading}>Optimize your heart rate zones</Text>
          <Text style={styles.description}>
            Enter your age to calculate personalized zone boundaries based on
            your estimated max heart rate.
          </Text>

          <TextInput
            style={styles.input}
            value={ageText}
            onChangeText={setAgeText}
            keyboardType="number-pad"
            placeholder="Age"
            placeholderTextColor={colors.text.muted}
            maxLength={2}
            autoFocus
          />

          <Text style={styles.ageNote}>You must be at least 13 years old</Text>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.button, !hasValidAge && styles.buttonDisabled]}
            onPress={handleContinue}
            disabled={!hasValidAge || isTooYoung}>
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSkip}>
            <Text style={styles.skipText}>
              Skip — I'll set zones manually
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'space-between',
    padding: spacing.xl,
  },
  safe: {
    flex: 1,
    backgroundColor: colors.bg.primary,
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
  ageNote: {
    color: colors.text.tertiary,
    fontSize: typography.size.sm,
    textAlign: 'center',
  },
  footer: {
    gap: spacing.base,
    paddingBottom: 40,
  },
  button: {
    backgroundColor: colors.action.primary,
    paddingVertical: spacing.lg,
    borderRadius: radii.xl,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: colors.bg.elevated,
    opacity: 0.5,
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
