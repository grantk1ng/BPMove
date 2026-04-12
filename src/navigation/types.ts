import type {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

export type RootStackParamList = {
  Onboarding: undefined;
  Main: undefined;
};

export type TabParamList = {
  SessionTab: undefined;
  HistoryTab: undefined;
  SettingsTab: undefined;
};

export type SessionStackParamList = {
  SessionHome: undefined;
  ActiveSession: undefined;
  Debug: undefined;
};

export type OnboardingStackParamList = {
  Welcome: undefined;
  AgeInput: undefined;
  BLEPairing: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type TabScreenProps<T extends keyof TabParamList> =
  BottomTabScreenProps<TabParamList, T>;

export type SessionStackScreenProps<T extends keyof SessionStackParamList> =
  NativeStackScreenProps<SessionStackParamList, T>;

export type OnboardingStackScreenProps<
  T extends keyof OnboardingStackParamList,
> = NativeStackScreenProps<OnboardingStackParamList, T>;
