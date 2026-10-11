import { Panel, ScreenShell } from '@/components/ScreenShell';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useLink } from '@/src/auth/LinkContext';
import { colors, fonts, type } from '@/src/theme';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function SettingsScreen() {
  const { session, playerName, unlink } = useLink();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function performUnlink() {
    setBusy(true);
    try {
      await unlink();
      router.replace('/welcome');
    } finally {
      setBusy(false);
      setConfirming(false);
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
