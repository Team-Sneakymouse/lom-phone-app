import { getOrCreateDeviceCredentials } from '@/src/device/credentials';
import { fetchServerSession, unlinkOnServer } from '@/src/link/api';
import { redeemLinkCode } from '@/src/link/redeem';
import { resolvePlayerName } from '@/src/mojang/profile';
import { resetLocalStepHighWater } from '@/src/steps/localHighWater';
import {
  clearSession,
  loadSession,
  saveSession,
  type LinkSession,
} from '@/src/storage/session';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type LinkContextValue = {
  ready: boolean;
  session: LinkSession | null;
  playerName: string | null;
  linkWithCode: (code: string) => Promise<void>;
  unlink: () => Promise<void>;
  refreshPlayerName: () => Promise<void>;
};

const LinkContext = createContext<LinkContextValue | null>(null);

export function LinkProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<LinkSession | null>(null);
  const [playerName, setPlayerName] = useState<string | null>(null);

  const refreshPlayerName = useCallback(async (uuid?: string) => {
    const id = uuid ?? session?.minecraftUuid;
    if (!id) return;
    const name = await resolvePlayerName(id);
    setPlayerName(name);
  }, [session?.minecraftUuid]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = await loadSession();
      if (cancelled) return;

      if (!local) {
        setSession(null);
        setReady(true);
        return;
      }

      // Prefer server truth when reachable; keep local cache if offline.
      try {
        const creds = await getOrCreateDeviceCredentials();
        const remote = await fetchServerSession(creds);
        if (cancelled) return;
        if (!remote) {
          await clearSession();
          setSession(null);
          setPlayerName(null);
          setReady(true);
          return;
        }
        await saveSession(remote);
        setSession(remote);
        const name = await resolvePlayerName(remote.minecraftUuid);
        if (!cancelled) setPlayerName(name);
      } catch {
        if (cancelled) return;
        setSession(local);
        const name = await resolvePlayerName(local.minecraftUuid);
        if (!cancelled) setPlayerName(name);
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const linkWithCode = useCallback(async (code: string) => {
    const next = await redeemLinkCode(code);
    // New link epoch on the server; drop any pre-link stub/pedometer cache.
    await resetLocalStepHighWater();
    await saveSession(next);
    setSession(next);
    const name = await resolvePlayerName(next.minecraftUuid);
    setPlayerName(name);
  }, []);

  const unlink = useCallback(async () => {
    try {
      const creds = await getOrCreateDeviceCredentials();
      await unlinkOnServer(creds);
    } catch {
      // Still clear local session; server revoke is best-effort.
    }
    await resetLocalStepHighWater();
    await clearSession();
    setSession(null);
    setPlayerName(null);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      session,
      playerName,
      linkWithCode,
      unlink,
      refreshPlayerName: () => refreshPlayerName(),
    }),
    [ready, session, playerName, linkWithCode, unlink, refreshPlayerName],
  );

  return <LinkContext.Provider value={value}>{children}</LinkContext.Provider>;
}

export function useLink() {
  const ctx = useContext(LinkContext);
  if (!ctx) throw new Error('useLink must be used within LinkProvider');
  return ctx;
}
