import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  age: 'bpmove:user:age',
  onboardingComplete: 'bpmove:onboarding:complete',
  showGraph: 'bpmove:pref:showGraph',
  pairedDevice: 'bpmove:ble:pairedDevice',
  selectedPlaylist: 'bpmove:spotify:selectedPlaylist',
  customZones: 'bpmove:pref:customZones',
} as const;

export interface PairedDevice {
  id: string;
  name: string | null;
}

export interface PlaylistSelection {
  id: string;
  name: string;
  type: 'playlist' | 'liked';
}

export interface CustomZone {
  name: string;
  minBPM: number;
  maxBPM: number;
}

export const UserPreferences = {
  async getAge(): Promise<number | null> {
    const val = await AsyncStorage.getItem(KEYS.age);
    return val ? parseInt(val, 10) : null;
  },

  async setAge(age: number): Promise<void> {
    if (age < 13) {
      throw new Error('Users must be at least 13 years old');
    }
    await AsyncStorage.setItem(KEYS.age, String(age));
  },

  async isOnboardingComplete(): Promise<boolean> {
    const val = await AsyncStorage.getItem(KEYS.onboardingComplete);
    return val === 'true';
  },

  async setOnboardingComplete(): Promise<void> {
    await AsyncStorage.setItem(KEYS.onboardingComplete, 'true');
  },

  async getShowGraph(): Promise<boolean> {
    const val = await AsyncStorage.getItem(KEYS.showGraph);
    return val === 'true';
  },

  async setShowGraph(show: boolean): Promise<void> {
    await AsyncStorage.setItem(KEYS.showGraph, String(show));
  },

  async getPairedDevice(): Promise<PairedDevice | null> {
    const val = await AsyncStorage.getItem(KEYS.pairedDevice);
    return val ? JSON.parse(val) : null;
  },

  async setPairedDevice(device: PairedDevice): Promise<void> {
    await AsyncStorage.setItem(KEYS.pairedDevice, JSON.stringify(device));
  },

  async clearPairedDevice(): Promise<void> {
    await AsyncStorage.removeItem(KEYS.pairedDevice);
  },

  async getSelectedPlaylist(): Promise<PlaylistSelection | null> {
    const val = await AsyncStorage.getItem(KEYS.selectedPlaylist);
    return val ? JSON.parse(val) : null;
  },

  async setSelectedPlaylist(playlist: PlaylistSelection): Promise<void> {
    await AsyncStorage.setItem(KEYS.selectedPlaylist, JSON.stringify(playlist));
  },

  async getCustomZones(): Promise<CustomZone[] | null> {
    const val = await AsyncStorage.getItem(KEYS.customZones);
    return val ? JSON.parse(val) : null;
  },

  async setCustomZones(zones: CustomZone[]): Promise<void> {
    await AsyncStorage.setItem(KEYS.customZones, JSON.stringify(zones));
  },
};
