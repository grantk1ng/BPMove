import type {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

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

export type TabScreenProps<T extends keyof TabParamList> =
  BottomTabScreenProps<TabParamList, T>;

export type SessionStackScreenProps<T extends keyof SessionStackParamList> =
  NativeStackScreenProps<SessionStackParamList, T>;
