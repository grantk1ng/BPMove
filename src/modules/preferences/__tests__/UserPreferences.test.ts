import AsyncStorage from '@react-native-async-storage/async-storage';
import {UserPreferences} from '../UserPreferences';

describe('UserPreferences', () => {
  beforeEach(() => {
    (AsyncStorage.getItem as jest.Mock).mockReset();
    (AsyncStorage.setItem as jest.Mock).mockReset();
    (AsyncStorage.removeItem as jest.Mock).mockReset();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  describe('age', () => {
    it('returns null when no age stored', async () => {
      const age = await UserPreferences.getAge();
      expect(age).toBeNull();
    });

    it('stores and retrieves age', async () => {
      await UserPreferences.setAge(25);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'bpmove:user:age',
        '25',
      );
    });

    it('rejects age under 13', async () => {
      await expect(UserPreferences.setAge(12)).rejects.toThrow();
    });
  });

  describe('onboarding', () => {
    it('defaults to not completed', async () => {
      const done = await UserPreferences.isOnboardingComplete();
      expect(done).toBe(false);
    });

    it('marks onboarding complete', async () => {
      await UserPreferences.setOnboardingComplete();
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'bpmove:onboarding:complete',
        'true',
      );
    });
  });

  describe('showGraph', () => {
    it('defaults to false', async () => {
      const show = await UserPreferences.getShowGraph();
      expect(show).toBe(false);
    });

    it('stores graph preference', async () => {
      await UserPreferences.setShowGraph(true);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'bpmove:pref:showGraph',
        'true',
      );
    });
  });

  describe('paired device', () => {
    it('returns null when no device stored', async () => {
      const device = await UserPreferences.getPairedDevice();
      expect(device).toBeNull();
    });

    it('stores device info', async () => {
      await UserPreferences.setPairedDevice({id: 'abc', name: 'HR Band'});
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'bpmove:ble:pairedDevice',
        JSON.stringify({id: 'abc', name: 'HR Band'}),
      );
    });

    it('clears paired device', async () => {
      await UserPreferences.clearPairedDevice();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
        'bpmove:ble:pairedDevice',
      );
    });
  });

  describe('selected playlist', () => {
    it('returns null when no playlist stored', async () => {
      const playlist = await UserPreferences.getSelectedPlaylist();
      expect(playlist).toBeNull();
    });

    it('stores playlist selection', async () => {
      await UserPreferences.setSelectedPlaylist({
        id: 'playlist123',
        name: 'Workout Mix',
        type: 'playlist',
      });
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'bpmove:spotify:selectedPlaylist',
        JSON.stringify({
          id: 'playlist123',
          name: 'Workout Mix',
          type: 'playlist',
        }),
      );
    });
  });

  describe('custom zones', () => {
    it('returns null when no custom zones stored', async () => {
      const zones = await UserPreferences.getCustomZones();
      expect(zones).toBeNull();
    });

    it('stores custom zone overrides', async () => {
      const zones = [
        {name: 'Zone 2', minBPM: 120, maxBPM: 140},
        {name: 'Zone 3', minBPM: 140, maxBPM: 160},
        {name: 'Zone 4', minBPM: 160, maxBPM: 180},
      ];
      await UserPreferences.setCustomZones(zones);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'bpmove:pref:customZones',
        JSON.stringify(zones),
      );
    });
  });
});
