import { Panel, ScreenShell } from '@/components/ScreenShell';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useLink } from '@/src/auth/LinkContext';
import { fetchStepsState, type StepsState } from '@/src/steps/api';
import { getHealthStepsProvider, type HealthStatus } from '@/src/steps/health';
import { readStepsToday, syncStepsFromHealth } from '@/src/steps/sync';
import { colors, fonts, type } from '@/src/theme';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

function healthLabel(status: HealthStatus): string {
  switch (status) {
    case 'ready':
      return 'Connected';
    case 'needs_permission':
      return 'Permission needed';
    case 'denied':
      return 'Permission denied';
    case 'unavailable':
      return 'Not available on this device';
    case 'unsupported':
      return 'Use the iOS or Android app';
  }
}

function formatSyncTime(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Never';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function StepsScreen() {
  const { session } = useLink();
  const [state, setState] = useState<StepsState | null>(null);
  const [stepsToday, setStepsToday] = useState<number | null>(null);
  const [healthStatus, setHealthStatus] = useState<HealthStatus>('unsupported');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [permBusy, setPermBusy] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    const provider = getHealthStepsProvider();
    try {
      const status = await provider.getStatus();
      setHealthStatus(status);
      const remote = await fetchStepsState();
      setState(remote);
      if (status === 'ready') {
        try {
          setStepsToday(await readStepsToday());
        } catch {
          setStepsToday(null);
        }
      } else {
        setStepsToday(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load steps');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  async function onSync() {
    if (!session?.linkedAt) {
      setError('Link your account before syncing');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await syncStepsFromHealth(session.linkedAt);
      setState(next);
      try {
        setStepsToday(await readStepsToday());
      } catch {
        // keep prior today value
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setBusy(false);
    }
  }

  async function onPermissions() {
    setPermBusy(true);
    setError(null);
    try {
      const provider = getHealthStepsProvider();
      const next = await provider.requestAccess();
      setHealthStatus(next);
      if (next === 'ready') {
        try {
          setStepsToday(await readStepsToday());
        } catch {
          setStepsToday(null);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update permissions');
    } finally {
      setPermBusy(false);
    }
  }

  const canSync = healthStatus === 'ready' && Boolean(session?.linkedAt);
  const permissionLabel =
    healthStatus === 'denied' || healthStatus === 'unavailable'
      ? 'Open health settings'
      : healthStatus === 'needs_permission'
        ? 'Connect health'
        : 'Manage health access';

  return (
    <ScreenShell
      title="Steps"
      subtitle="Walking progress syncs to your Minecraft account for in-game rewards."
      showBack
    >
      <Panel>
        <Text style={type.bodyOnPanel}>
          Steps today:{' '}
          <Text style={styles.em}>
            {stepsToday == null ? '—' : stepsToday.toLocaleString()}
          </Text>
        </Text>
        <Text style={type.bodyOnPanel}>
          Last synced:{' '}
          <Text style={styles.em}>{formatSyncTime(state?.lastSubmitAt ?? null)}</Text>
        </Text>
        <Text style={[type.bodyOnPanel, { marginTop: 8 }]}>
          Accepted lifetime:{' '}
          <Text style={styles.em}>
            {state ? state.totalSteps.toLocaleString() : '—'}
          </Text>
        </Text>
      </Panel>

      <Panel>
        <Text style={type.bodyOnPanel}>
          Health link:{' '}
          <Text
            style={[
              styles.em,
              healthStatus === 'ready' ? styles.ok : styles.warn,
            ]}
          >
            {healthLabel(healthStatus)}
          </Text>
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={{ marginTop: 12, gap: 10 }}>
          <PrimaryButton
            label="Sync now"
            onPress={onSync}
            busy={busy}
            disabled={!canSync || permBusy}
          />
          {healthStatus !== 'unsupported' ? (
            <PrimaryButton
              label={permissionLabel}
              onPress={onPermissions}
              busy={permBusy}
              disabled={busy}
            />
          ) : null}
        </View>
      </Panel>
    </ScreenShell>
  );
}

const styles = {
  em: {
    fontFamily: fonts.bodySemi,
    color: colors.ink,
  },
  ok: {
    color: colors.moss,
  },
  warn: {
    color: colors.brassDeep,
  },
  error: {
    fontFamily: fonts.body,
    color: colors.danger,
    marginTop: 8,
  },
} as const;
