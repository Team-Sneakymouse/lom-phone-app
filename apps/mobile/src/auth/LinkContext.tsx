import { redeemLinkCode } from '@/src/link/redeem';
import { resolvePlayerName } from '@/src/mojang/profile';
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
      const existing = await loadSession();
      if (cancelled) return;
      setSession(existing);
      if (existing) {
        const name = await resolvePlayerName(existing.minecraftUuid);
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
    await saveSession(next);
    setSession(next);
    const name = await resolvePlayerName(next.minecraftUuid);
    setPlayerName(name);
  }, []);

  const unlink = useCallback(async () => {
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
