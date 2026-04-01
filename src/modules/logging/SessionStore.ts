import AsyncStorage from '@react-native-async-storage/async-storage';
import type {SessionLog, SessionMetadata} from './types';

const SESSIONS_INDEX_KEY = 'bpmove:sessions';
const SESSION_PREFIX = 'bpmove:session:';
const MAX_STORED_SESSIONS = 50;

export interface SessionSummary {
  sessionId: string;
  startTime: number;
  endTime: number | null;
  durationMs: number;
  deviceName: string | null;
  metadata: SessionMetadata;
}

function toSummary(log: SessionLog): SessionSummary {
  return {
    sessionId: log.sessionId,
    startTime: log.startTime,
    endTime: log.endTime,
    durationMs: log.durationMs,
    deviceName: log.deviceName,
    metadata: log.metadata,
  };
}

export async function saveSession(log: SessionLog): Promise<void> {
  const fullKey = `${SESSION_PREFIX}${log.sessionId}`;
  await AsyncStorage.setItem(fullKey, JSON.stringify(log));

  const indexRaw = await AsyncStorage.getItem(SESSIONS_INDEX_KEY);
  const index: SessionSummary[] = indexRaw ? JSON.parse(indexRaw) : [];

  index.unshift(toSummary(log));

  if (index.length > MAX_STORED_SESSIONS) {
    const removed = index.splice(MAX_STORED_SESSIONS);
    const keysToRemove = removed.map(s => `${SESSION_PREFIX}${s.sessionId}`);
    await AsyncStorage.multiRemove(keysToRemove);
  }

  await AsyncStorage.setItem(SESSIONS_INDEX_KEY, JSON.stringify(index));
}

export async function loadSessionIndex(): Promise<SessionSummary[]> {
  const raw = await AsyncStorage.getItem(SESSIONS_INDEX_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function loadSession(sessionId: string): Promise<SessionLog | null> {
  const raw = await AsyncStorage.getItem(`${SESSION_PREFIX}${sessionId}`);
  return raw ? JSON.parse(raw) : null;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await AsyncStorage.removeItem(`${SESSION_PREFIX}${sessionId}`);

  const indexRaw = await AsyncStorage.getItem(SESSIONS_INDEX_KEY);
  const index: SessionSummary[] = indexRaw ? JSON.parse(indexRaw) : [];
  const filtered = index.filter(s => s.sessionId !== sessionId);
  await AsyncStorage.setItem(SESSIONS_INDEX_KEY, JSON.stringify(filtered));
}

export async function deleteAllSessions(): Promise<void> {
  const indexRaw = await AsyncStorage.getItem(SESSIONS_INDEX_KEY);
  const index: SessionSummary[] = indexRaw ? JSON.parse(indexRaw) : [];
  const keys = index.map(s => `${SESSION_PREFIX}${s.sessionId}`);
  keys.push(SESSIONS_INDEX_KEY);
  await AsyncStorage.multiRemove(keys);
}
