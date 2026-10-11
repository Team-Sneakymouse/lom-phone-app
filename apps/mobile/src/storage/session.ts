import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  deleteSecureItem,
  getSecureItem,
  setSecureItem,
} from '@/src/storage/secureKv';

const SESSION_KEY = 'lom.session.v1';
const PLAYER_NAME_KEY = 'lom.playerName.v1';

export type LinkSession = {
  deviceId: string;
  minecraftUuid: string;
  linkedAt: string;
};

export type PlayerNameCache = {
  minecraftUuid: string;
  name: string;
  fetchedAt: string;
};

export async function loadSession(): Promise<LinkSession | null> {
  const raw = await getSecureItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<LinkSession>;
    if (!parsed.minecraftUuid || !parsed.deviceId) return null;
    return {
      deviceId: String(parsed.deviceId).toLowerCase(),
      minecraftUuid: String(parsed.minecraftUuid).toLowerCase(),
      linkedAt: String(parsed.linkedAt ?? ''),
    };
  } catch {
    return null;
  }
}

export async function saveSession(session: LinkSession): Promise<void> {
  await setSecureItem(SESSION_KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  await deleteSecureItem(SESSION_KEY);
  await AsyncStorage.removeItem(PLAYER_NAME_KEY);
}

export async function loadPlayerNameCache(): Promise<PlayerNameCache | null> {
  const raw = await AsyncStorage.getItem(PLAYER_NAME_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PlayerNameCache;
  } catch {
    return null;
  }
}

export async function savePlayerNameCache(cache: PlayerNameCache): Promise<void> {
  await AsyncStorage.setItem(PLAYER_NAME_KEY, JSON.stringify(cache));
}
