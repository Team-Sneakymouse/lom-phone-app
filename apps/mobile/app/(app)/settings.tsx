import { Panel, ScreenShell } from '@/components/ScreenShell';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useLink } from '@/src/auth/LinkContext';
import { registerPushPrefs, unregisterPush } from '@/src/push/api';
import {
  obtainExpoPushToken,
  PREF_KEY,
  pushSupported,
} from '@/src/push/notifications';
import { colors, fonts, type } from '@/src/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

export default function SettingsScreen() {
  const { session, playerName, unlink } = useLink();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [notifyJobs, setNotifyJobs] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [pushHint, setPushHint] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const raw = await AsyncStorage.getItem(PREF_KEY);
      setNotifyJobs(raw === '1');
    })();
  }, []);

  async function performUnlink() {
    setBusy(true);
    try {
      try {
        await unregisterPush();
      } catch {
        // best-effort; server unlink also clears prefs
      }
      await AsyncStorage.removeItem(PREF_KEY);
      await unlink();
      router.replace('/welcome');
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  async function onToggleJobs(next: boolean) {
    if (!pushSupported()) {
      setPushError('Job alerts need the Android or iOS app build, not the web preview.');
      return;
    }
    setPushBusy(true);
    setPushError(null);
    setPushHint(null);
    try {
      if (!next) {
        await registerPushPrefs({ notifyJobs: false });
        await AsyncStorage.setItem(PREF_KEY, '0');
        setNotifyJobs(false);
        return;
      }

      const token = await obtainExpoPushToken();
      if (!token) {
        setPushError(
          Platform.OS === 'ios'
            ? 'Notifications are off. Enable them for Lords of Minecraft in iOS Settings.'
            : 'Notifications are off. Enable them for Lords of Minecraft in system settings.',
        );
        setNotifyJobs(false);
        await AsyncStorage.setItem(PREF_KEY, '0');
        return;
      }

      await registerPushPrefs({ notifyJobs: true, pushToken: token });
      await AsyncStorage.setItem(PREF_KEY, '1');
      setNotifyJobs(true);
      setPushHint('You will get a ping when someone lists a new job.');
    } catch (e) {
      setNotifyJobs(false);
      await AsyncStorage.setItem(PREF_KEY, '0');
      setPushError(e instanceof Error ? e.message : 'Could not enable notifications');
    } finally {
      setPushBusy(false);
    }
  }

  return (
    <ScreenShell
      title="Settings"
      subtitle="Manage this device’s link to Lords of Minecraft."
      showBack
      footer={
        confirming ? (
          <View style={styles.confirmBlock}>
            <Panel>
              <Text style={styles.confirmTitle}>Unlink this phone?</Text>
              <Text style={type.bodyOnPanel}>
                You will need a new in-game link code to connect again.
              </Text>
            </Panel>
            <PrimaryButton
              label="Yes, unlink"
              tone="danger"
              busy={busy}
              onPress={() => void performUnlink()}
            />
            <Pressable
              onPress={() => setConfirming(false)}
              disabled={busy}
              style={({ pressed }) => [styles.cancel, pressed && styles.cancelPressed]}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <PrimaryButton
            label="Unlink phone"
            tone="danger"
            onPress={() => setConfirming(true)}
          />
        )
      }
    >
      <Panel>
        <Text style={styles.section}>Linked account</Text>
        <Text style={styles.value}>{playerName ?? 'Adventurer'}</Text>
        <Text style={type.bodyOnPanel}>{session?.minecraftUuid}</Text>
      </Panel>

      <Panel>
        <Text style={styles.section}>Notifications</Text>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.toggleLabel}>New job board posts</Text>
            <Text style={type.bodyOnPanel}>
              Alert this phone when a new job is listed. Off by default.
            </Text>
          </View>
          <Switch
            value={notifyJobs}
            disabled={pushBusy || confirming}
            onValueChange={(v) => void onToggleJobs(v)}
            trackColor={{ false: 'rgba(31,61,52,0.25)', true: colors.brass }}
            thumbColor={colors.parchment}
          />
        </View>
        {pushHint ? <Text style={styles.hint}>{pushHint}</Text> : null}
        {pushError ? <Text style={styles.error}>{pushError}</Text> : null}
        {!pushSupported() ? (
          <Text style={styles.hint}>Push is available in the native app, not on web.</Text>
        ) : null}
      </Panel>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  section: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.brassDeep,
  },
  value: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.ink,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  rowText: {
    flex: 1,
    gap: 4,
  },
  toggleLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 17,
    color: colors.ink,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.moss,
    marginTop: 10,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.danger,
    marginTop: 10,
  },
  confirmBlock: {
    gap: 12,
  },
  confirmTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.ink,
  },
  cancel: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelPressed: { opacity: 0.7 },
  cancelText: {
    fontFamily: fonts.bodySemi,
    fontSize: 16,
    color: colors.brass,
  },
});
