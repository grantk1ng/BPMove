import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'bpmove:bpm:';

export async function getCached(
  trackIds: string[],
): Promise<Map<string, number>> {
  const results = new Map<string, number>();

  for (const id of trackIds) {
    const value = await AsyncStorage.getItem(`${KEY_PREFIX}${id}`);
    if (value !== null) {
      results.set(id, Number(value));
    }
  }

  return results;
}

export async function setCached(entries: Map<string, number>): Promise<void> {
  for (const [id, bpm] of entries) {
    await AsyncStorage.setItem(`${KEY_PREFIX}${id}`, String(bpm));
  }
}
