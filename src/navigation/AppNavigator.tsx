import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {SessionHomeScreen} from '../screens/SessionHomeScreen';
import {ActiveSessionScreen} from '../screens/ActiveSessionScreen';
import {HistoryScreen} from '../screens/HistoryScreen';
import {SettingsScreen} from '../screens/SettingsScreen';
import {DebugScreen} from '../screens/DebugScreen';
import {OnboardingNavigator} from './OnboardingNavigator';
import {colors} from '../theme';
import type {
  RootStackParamList,
  TabParamList,
  SessionStackParamList,
} from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();
const SessionStack = createNativeStackNavigator<SessionStackParamList>();

function SessionNavigator() {
  return (
    <SessionStack.Navigator
      screenOptions={{
        headerStyle: {backgroundColor: colors.bg.primary},
        headerTintColor: colors.text.primary,
        headerTitleStyle: {fontWeight: '600'},
        contentStyle: {backgroundColor: colors.bg.primary},
      }}>
      <SessionStack.Screen
        name="SessionHome"
        component={SessionHomeScreen}
        options={{headerShown: false}}
      />
      <SessionStack.Screen
        name="ActiveSession"
        component={ActiveSessionScreen}
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <SessionStack.Screen
        name="Debug"
        component={DebugScreen}
        options={{title: 'Debug Console'}}
      />
    </SessionStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: {
          backgroundColor: colors.bg.primary,
          borderTopColor: colors.border.default,
        },
        tabBarActiveTintColor: colors.action.primary,
        tabBarInactiveTintColor: colors.text.tertiary,
        headerStyle: {backgroundColor: colors.bg.primary},
        headerTintColor: colors.text.primary,
        headerTitleStyle: {fontWeight: '600'},
      }}>
      <Tab.Screen
        name="SessionTab"
        component={SessionNavigator}
        options={{
          title: 'Session',
          headerShown: false,
          tabBarLabel: 'Session',
        }}
      />
      <Tab.Screen
        name="HistoryTab"
        component={HistoryScreen}
        options={{
          title: 'History',
          tabBarLabel: 'History',
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
        }}
      />
    </Tab.Navigator>
  );
}

interface AppNavigatorProps {
  onboardingComplete: boolean;
}

export function AppNavigator({onboardingComplete}: AppNavigatorProps) {
  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{headerShown: false}}>
        {onboardingComplete ? (
          <RootStack.Screen name="Main" component={MainTabs} />
        ) : (
          <RootStack.Screen
            name="Onboarding"
            component={OnboardingNavigator}
          />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
