import {
  loadPlayerNameCache,
  savePlayerNameCache,
  type PlayerNameCache,
} from '@/src/storage/session';

function uuidToMojangId(uuid: string): string {
  return uuid.replace(/-/g, '').toLowerCase();
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/** Mojang sessionserver — works on native; often blocked by CORS in browsers. */
async function fromSessionServer(minecraftUuid: string): Promise<string> {
  const id = uuidToMojangId(minecraftUuid);
  const profile = (await fetchJson(
    `https://sessionserver.mojang.com/session/minecraft/profile/${id}`,
  )) as { name?: string };
  if (!profile.name) throw new Error('missing name');
  return profile.name;
}

/** Public lookup with browser CORS support (dev/web fallback). */
async function fromPlayerDb(minecraftUuid: string): Promise<string> {
  const data = (await fetchJson(
    `https://playerdb.co/api/player/minecraft/${minecraftUuid}`,
  )) as { data?: { player?: { username?: string } } };
  const name = data.data?.player?.username;
  if (!name) throw new Error('missing name');
  return name;
}

async function lookupName(minecraftUuid: string): Promise<string> {
  const errors: string[] = [];
  for (const attempt of [fromSessionServer, fromPlayerDb]) {
    try {
      return await attempt(minecraftUuid);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  throw new Error(errors.join('; ') || 'name lookup failed');
}

/** Fetch Minecraft username; fall back to cache when lookups fail. */
export async function resolvePlayerName(minecraftUuid: string): Promise<string> {
  const cached = await loadPlayerNameCache();
  const usableCache =
    cached && cached.minecraftUuid.toLowerCase() === minecraftUuid.toLowerCase()
      ? cached
      : null;

  try {
    const name = await lookupName(minecraftUuid);
    await savePlayerNameCache({
      minecraftUuid,
      name,
      fetchedAt: new Date().toISOString(),
    });
    return name;
  } catch {
    return usableCache?.name ?? 'Adventurer';
  }
}
