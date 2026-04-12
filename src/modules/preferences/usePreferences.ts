import {useState, useEffect, useCallback} from 'react';
import {UserPreferences} from './UserPreferences';
import type {PairedDevice, PlaylistSelection, CustomZone} from './UserPreferences';

export function usePreferences() {
  const [age, setAgeState] = useState<number | null>(null);
  const [showGraph, setShowGraphState] = useState(false);
  const [pairedDevice, setPairedDeviceState] = useState<PairedDevice | null>(
    null,
  );
  const [selectedPlaylist, setSelectedPlaylistState] =
    useState<PlaylistSelection | null>(null);
  const [customZones, setCustomZonesState] = useState<CustomZone[] | null>(
    null,
  );
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      const [a, g, d, p, z] = await Promise.all([
        UserPreferences.getAge(),
        UserPreferences.getShowGraph(),
        UserPreferences.getPairedDevice(),
        UserPreferences.getSelectedPlaylist(),
        UserPreferences.getCustomZones(),
      ]);
      setAgeState(a);
      setShowGraphState(g);
      setPairedDeviceState(d);
      setSelectedPlaylistState(p);
      setCustomZonesState(z);
      setLoaded(true);
    }
    load();
  }, []);

  const setAge = useCallback(async (value: number) => {
    await UserPreferences.setAge(value);
    setAgeState(value);
  }, []);

  const setShowGraph = useCallback(async (value: boolean) => {
    await UserPreferences.setShowGraph(value);
    setShowGraphState(value);
  }, []);

  const setPairedDevice = useCallback(async (device: PairedDevice) => {
    await UserPreferences.setPairedDevice(device);
    setPairedDeviceState(device);
  }, []);

  const clearPairedDevice = useCallback(async () => {
    await UserPreferences.clearPairedDevice();
    setPairedDeviceState(null);
  }, []);

  const setSelectedPlaylist = useCallback(
    async (playlist: PlaylistSelection) => {
      await UserPreferences.setSelectedPlaylist(playlist);
      setSelectedPlaylistState(playlist);
    },
    [],
  );

  const setCustomZones = useCallback(async (zones: CustomZone[]) => {
    await UserPreferences.setCustomZones(zones);
    setCustomZonesState(zones);
  }, []);

  return {
    loaded,
    age,
    setAge,
    showGraph,
    setShowGraph,
    pairedDevice,
    setPairedDevice,
    clearPairedDevice,
    selectedPlaylist,
    setSelectedPlaylist,
    customZones,
    setCustomZones,
  };
}
