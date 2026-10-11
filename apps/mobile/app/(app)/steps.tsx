import { Panel, ScreenShell } from '@/components/ScreenShell';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useLink } from '@/src/auth/LinkContext';
import { fetchStepsState, type StepsState } from '@/src/steps/api';
import {
  getHealthStepsProvider,
  loadAndroidStepSource,
  saveAndroidStepSource,
  type AndroidStepSource,
  type HealthStatus,
} from '@/src/steps/health';
import { readStepsToday, syncStepsFromHealth } from '@/src/steps/sync';
import { colors, fonts, type } from '@/src/theme';
import * as Device from 'expo-device';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Platform, Switch, Text, View } from 'react-native';

const GOOGLE_FIT_PLAY_MARKET =
  'market://details?id=com.google.android.apps.fitness';
const GOOGLE_FIT_PLAY_HTTPS =
  'https://play.google.com/store/apps/details?id=com.google.android.apps.fitness';
const HEALTH_CONNECT_PLAY_MARKET =
  'market://details?id=com.google.android.apps.healthdata';
const HEALTH_CONNECT_PLAY_HTTPS =
  'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata';
const APPLE_HEALTH_URL = 'x-apple-health://';

type HintPart =
  | { kind: 'text'; text: string }
  | { kind: 'link'; text: string; open: () => void };

async function openStoreOrHttps(marketUrl: string, httpsUrl: string) {
  try {
    if (await Linking.canOpenURL(marketUrl)) {
      await Linking.openURL(marketUrl);
      return;
    }
  } catch {
    // fall through
  }
  await Linking.openURL(httpsUrl);
}

async function openGoogleFitStore() {
  await openStoreOrHttps(GOOGLE_FIT_PLAY_MARKET, GOOGLE_FIT_PLAY_HTTPS);
}

async function openHealthConnectStore() {
  await openStoreOrHttps(HEALTH_CONNECT_PLAY_MARKET, HEALTH_CONNECT_PLAY_HTTPS);
}

async function openAppleHealth() {
  try {
    await Linking.openURL(APPLE_HEALTH_URL);
  } catch {
    await Linking.openSettings();
  }
}

function sourceLabel(
  status: HealthStatus,
  androidSource: AndroidStepSource | null,
): string {
  if (Platform.OS === 'android' && androidSource === 'sensor') {
    switch (status) {
      case 'ready':
        return 'Phone sensors';
      case 'needs_permission':
        return 'Physical activity needed';
      case 'denied':
        return 'Physical activity denied';
      case 'unavailable':
        return Device.isDevice
          ? 'Step sensor unavailable'
          : 'Needs a physical phone';
      default:
        return 'Use the iOS or Android app';
    }
  }

  switch (status) {
    case 'ready':
      return 'Connected';
    case 'needs_permission':
      return 'Permission needed';
    case 'denied':
      return 'Permission denied';
    case 'unavailable':
      return Device.isDevice
        ? Platform.OS === 'ios'
          ? 'Health unavailable'
          : 'Health Connect unavailable'
        : 'Needs a physical phone';
    case 'unsupported':
      return 'Use the iOS or Android app';
  }
}

function healthHintParts(
  status: HealthStatus,
  stepsToday: number | null,
  androidSource: AndroidStepSource | null,
): HintPart[] | null {
  const usingSensor =
    Platform.OS === 'android' && androidSource !== 'health_connect';

  switch (status) {
    case 'unavailable':
      if (!Device.isDevice) {
        return [
          {
            kind: 'text',
            text: usingSensor
              ? 'Emulators usually have no step sensor. Use a physical Android phone.'
              : 'Emulators usually cannot grant Health Connect step access. Use a physical Android phone.',
          },
        ];
      }
      if (usingSensor) {
        return [
          {
            kind: 'text',
            text: 'This phone does not expose a step counter sensor.',
          },
        ];
      }
      return [
        { kind: 'text', text: 'Install or update ' },
        {
          kind: 'link',
          text: 'Health Connect',
          open: () => void openHealthConnectStore(),
        },
        {
          kind: 'text',
          text: '. A step source such as ',
        },
        {
          kind: 'link',
          text: 'Google Fit',
          open: () => void openGoogleFitStore(),
        },
        {
          kind: 'text',
          text: ' must write Steps there, then tap Connect health.',
        },
      ];
    case 'denied':
      return [
        {
          kind: 'text',
          text: usingSensor
            ? 'Physical activity access was refused. Open app settings and allow it, then try again.'
            : 'Step access was refused. Open Health Connect settings and allow Lords of Minecraft to read Steps, then try again.',
        },
      ];
    case 'needs_permission':
      return [
        {
          kind: 'text',
          text: usingSensor
            ? 'Allow Physical activity so the phone can count steps for in-game rewards.'
            : 'Allow step access so walking can sync for in-game rewards.',
        },
      ];
    case 'ready':
      if (stepsToday === 0) {
        if (Platform.OS === 'ios') {
          return [
            {
              kind: 'text',
              text: 'Steps today are still 0. If you’ve already been walking, check ',
            },
            {
              kind: 'link',
              text: 'Apple Health',
              open: () => void openAppleHealth(),
            },
            {
              kind: 'text',
              text: ' for today’s steps and Settings → Privacy & Security → Motion & Fitness.',
            },
          ];
        }
        if (usingSensor) {
          return [
            {
              kind: 'text',
              text: 'Steps today are still 0. Walk with this phone (sensor counting works with the app closed), then open Steps again. Totals start from the first time we read the sensor after install/reboot.',
            },
          ];
        }
        return [
          {
            kind: 'text',
            text: 'Steps today are still 0. If you’ve already been walking, install ',
          },
          {
            kind: 'link',
            text: 'Google Fit',
            open: () => void openGoogleFitStore(),
          },
          {
            kind: 'text',
            text: ', allow Physical activity, turn on Health Connect → Steps write, confirm steps in Health Connect → Steps, then sync again.',
          },
        ];
      }
      return null;
    default:
      return null;
  }
}

function HealthHint({ parts }: { parts: HintPart[] }) {
  return (
    <Text style={styles.hint}>
      {parts.map((part, i) =>
        part.kind === 'link' ? (
          <Text
            key={i}
            style={styles.hintLink}
            onPress={part.open}
            accessibilityRole="link"
          >
            {part.text}
          </Text>
        ) : (
          <Text key={i}>{part.text}</Text>
        ),
      )}
    </Text>
  );
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
  const [androidSource, setAndroidSource] = useState<AndroidStepSource | null>(
    Platform.OS === 'android' ? 'sensor' : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [permBusy, setPermBusy] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    const provider = getHealthStepsProvider();
    try {
      if (Platform.OS === 'android') {
        setAndroidSource(await loadAndroidStepSource());
      }
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

  async function onToggleHealthConnect(next: boolean) {
    setPermBusy(true);
    setError(null);
    try {
      await saveAndroidStepSource(next ? 'health_connect' : 'sensor');
      setAndroidSource(next ? 'health_connect' : 'sensor');
      const provider = getHealthStepsProvider();
      const status = await provider.getStatus();
      setHealthStatus(status);
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
      setError(e instanceof Error ? e.message : 'Could not switch step source');
    } finally {
      setPermBusy(false);
    }
  }

  async function onPermissions() {
    setPermBusy(true);
    setError(null);
    try {
      const provider = getHealthStepsProvider();
      const usingSensor =
        Platform.OS === 'android' && androidSource !== 'health_connect';
      const openSettingsOnly =
        healthStatus === 'denied' ||
        healthStatus === 'ready' ||
        (healthStatus === 'unavailable' && Device.isDevice);

      if (openSettingsOnly) {
        await provider.openSettings();
        const next = await provider.getStatus();
        setHealthStatus(next);
        if (next === 'ready') {
          try {
            setStepsToday(await readStepsToday());
          } catch {
            setStepsToday(null);
          }
        } else if (next === 'unavailable' && !usingSensor) {
          setError(
            'Health Connect is missing or outdated. Install it from the store, then try again.',
          );
        }
        return;
      }

      const next = await provider.requestAccess();
      setHealthStatus(next);
      if (next === 'ready') {
        try {
          setStepsToday(await readStepsToday());
        } catch {
          setStepsToday(null);
        }
      } else if (next === 'unavailable') {
        setError(
          usingSensor
            ? Device.isDevice
              ? 'This phone has no usable step sensor.'
              : 'Step sensors need a physical phone.'
            : Device.isDevice
              ? 'Health Connect is missing or outdated on this phone.'
              : 'Health Connect cannot grant steps on emulators. Use a physical phone.',
        );
      } else if (next === 'denied') {
        setError(
          usingSensor
            ? 'Physical activity permission was denied.'
            : 'Step permission was denied in Health Connect.',
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update permissions');
    } finally {
      setPermBusy(false);
    }
  }

  const canSync = healthStatus === 'ready' && Boolean(session?.linkedAt);
  const hintParts = healthHintParts(healthStatus, stepsToday, androidSource);
  const usingSensor =
    Platform.OS === 'android' && androidSource !== 'health_connect';
  const showHealthButton =
    healthStatus !== 'unsupported' &&
    !(healthStatus === 'unavailable' && !Device.isDevice);
  const permissionLabel =
    healthStatus === 'denied' || (healthStatus === 'unavailable' && Device.isDevice)
      ? usingSensor
        ? 'Open app settings'
        : 'Open health settings'
      : healthStatus === 'needs_permission'
        ? usingSensor
          ? 'Allow activity access'
          : 'Connect health'
        : usingSensor
          ? 'Manage activity access'
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
          Step source:{' '}
          <Text
            style={[
              styles.em,
              healthStatus === 'ready' ? styles.ok : styles.warn,
            ]}
          >
            {sourceLabel(healthStatus, androidSource)}
          </Text>
        </Text>
        {Platform.OS === 'android' ? (
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.toggleLabel}>Use Health Connect</Text>
              <Text style={type.bodyOnPanel}>
                Off by default. Turn on only if another app (e.g. Google Fit)
                already writes steps there.
              </Text>
            </View>
            <Switch
              value={androidSource === 'health_connect'}
              disabled={busy || permBusy}
              onValueChange={(v) => void onToggleHealthConnect(v)}
              trackColor={{ false: 'rgba(31,61,52,0.25)', true: colors.brass }}
              thumbColor={colors.parchment}
            />
          </View>
        ) : null}
        {hintParts ? <HealthHint parts={hintParts} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={{ marginTop: 12, gap: 10 }}>
          <PrimaryButton
            label="Sync now"
            onPress={onSync}
            busy={busy}
            disabled={!canSync || permBusy}
          />
          {showHealthButton ? (
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
  row: {
    marginTop: 12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  rowText: {
    flex: 1,
    gap: 4,
  },
  toggleLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 16,
    color: colors.ink,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.moss,
    marginTop: 8,
    opacity: 0.85,
  },
  hintLink: {
    fontFamily: fonts.bodySemi,
    color: colors.brassDeep,
    textDecorationLine: 'underline' as const,
  },
  error: {
    fontFamily: fonts.body,
    color: colors.danger,
    marginTop: 8,
  },
} as const;
