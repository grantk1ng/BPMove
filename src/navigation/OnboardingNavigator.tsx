import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {WelcomeScreen} from '../screens/onboarding/WelcomeScreen';
import {AgeInputScreen} from '../screens/onboarding/AgeInputScreen';
import {BLEPairingScreen} from '../screens/onboarding/BLEPairingScreen';
import type {OnboardingStackParamList} from './types';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export function OnboardingNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="AgeInput" component={AgeInputScreen} />
      <Stack.Screen name="BLEPairing" component={BLEPairingScreen} />
    </Stack.Navigator>
  );
}
