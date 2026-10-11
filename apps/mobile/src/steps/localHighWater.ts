import AsyncStorage from '@react-native-async-storage/async-storage';

/** Epoch high-water + query anchor for incremental health sync. */
export const STEPS_EPOCH_STATE_KEY = 'lom.steps.epochState.v1';
/** @deprecated migrated into epoch state */
export const STEPS_LOCAL_HIGH_WATER_KEY = 'lom.steps.localHighWater.v1';

export type EpochStepState = {
  highWater: number;
  queryAnchorIso: string | null;
};

export async function loadEpochStepState(): Promise<EpochStepState> {
  const raw = await AsyncStorage.getItem(STEPS_EPOCH_STATE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<EpochStepState>;
      return {
        highWater: Math.max(0, Math.floor(Number(parsed.highWater) || 0)),
        queryAnchorIso:
          typeof parsed.queryAnchorIso === 'string' ? parsed.queryAnchorIso : null,
      };
    } catch {
      // fall through
    }
  }
  const legacy = await AsyncStorage.getItem(STEPS_LOCAL_HIGH_WATER_KEY);
  const highWater = Math.max(0, Math.floor(Number(legacy) || 0));
  return { highWater, queryAnchorIso: null };
}

export async function saveEpochStepState(state: EpochStepState): Promise<void> {
  await AsyncStorage.setItem(
    STEPS_EPOCH_STATE_KEY,
    JSON.stringify({
      highWater: Math.max(0, Math.floor(state.highWater)),
      queryAnchorIso: state.queryAnchorIso,
    }),
  );
  await AsyncStorage.removeItem(STEPS_LOCAL_HIGH_WATER_KEY);
}

export async function resetLocalStepHighWater(): Promise<void> {
  await AsyncStorage.multiRemove([STEPS_EPOCH_STATE_KEY, STEPS_LOCAL_HIGH_WATER_KEY]);
}
