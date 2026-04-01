import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {SessionHomeScreen} from '../screens/SessionHomeScreen';
import {ActiveSessionScreen} from '../screens/ActiveSessionScreen';
import {HistoryScreen} from '../screens/HistoryScreen';
import {SettingsScreen} from '../screens/SettingsScreen';
import {DebugScreen} from '../screens/DebugScreen';
import type {TabParamList, SessionStackParamList} from './types';

const Tab = createBottomTabNavigator<TabParamList>();
const SessionStack = createNativeStackNavigator<SessionStackParamList>();

function SessionNavigator() {
  return (
    <SessionStack.Navigator
      screenOptions={{
        headerStyle: {backgroundColor: '#1a1a1a'},
        headerTintColor: '#fff',
        headerTitleStyle: {fontWeight: '600'},
        contentStyle: {backgroundColor: '#1a1a1a'},
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

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          tabBarStyle: {
            backgroundColor: '#1a1a1a',
            borderTopColor: '#333',
          },
          tabBarActiveTintColor: '#1976D2',
          tabBarInactiveTintColor: '#888',
          headerStyle: {backgroundColor: '#1a1a1a'},
          headerTintColor: '#fff',
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
    </NavigationContainer>
  );
}
