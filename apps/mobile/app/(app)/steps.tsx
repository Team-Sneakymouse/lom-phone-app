import { Panel, ScreenShell } from '@/components/ScreenShell';
import { PrimaryButton } from '@/components/PrimaryButton';
import { fetchStepsState, submitStepSnapshot, type StepsState } from '@/src/steps/api';
import { colors, fonts, type } from '@/src/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

const LOCAL_KEY = 'lom.steps.localHighWater.v1';

/**
 * Steps screen: until Health Connect / Core Motion land, the field is a
 * high-water stub the player (or QA) can bump; server still reconciles.
 */
export default function StepsScreen() {
  const [state, setState] = useState<StepsState | null>(null);
  const [localSteps, setLocalSteps] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const remote = await fetchStepsState();
      setState(remote);
      const stored = await AsyncStorage.getItem(LOCAL_KEY);
      const local = Math.max(Number(stored) || 0, remote.totalSteps);
      setLocalSteps(String(local));
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
    setBusy(true);
    setError(null);
    try {
      const value = Math.max(0, Math.floor(Number(localSteps) || 0));
      await AsyncStorage.setItem(LOCAL_KEY, String(value));
      const next = await submitStepSnapshot(value);
      setState(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenShell
      title="Steps"
      subtitle="Accepted walking progress. Rewards mail in-game when thresholds clear."
      showBack
    >
      <Panel>
        <Text style={type.bodyOnPanel}>
          Server total:{' '}
          <Text style={styles.em}>{state ? state.totalSteps.toLocaleString() : '—'}</Text>
        </Text>
        <Text style={type.bodyOnPanel}>
          Already rewarded through:{' '}
          <Text style={styles.em}>{state ? state.paidSteps.toLocaleString() : '—'}</Text>
        </Text>
      </Panel>

      <Panel>
        <Text style={[type.bodyOnPanel, { marginBottom: 8 }]}>
          Local high-water (stub until pedometer providers ship)
        </Text>
        <TextInput
          value={localSteps}
          onChangeText={setLocalSteps}
          keyboardType="number-pad"
          editable={!busy}
          style={styles.input}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={{ marginTop: 12 }}>
          <PrimaryButton label="Sync to server" onPress={onSync} busy={busy} />
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
  input: {
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderWidth: 1,
    borderColor: colors.panelBorder,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.bodySemi,
    fontSize: 20,
    color: colors.ink,
  },
  error: {
    fontFamily: fonts.body,
    color: colors.danger,
    marginTop: 8,
  },
} as const;
