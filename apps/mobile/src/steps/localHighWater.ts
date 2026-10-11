import AsyncStorage from '@react-native-async-storage/async-storage';

/** Stub / cached pedometer high-water for the current link epoch. */
export const STEPS_LOCAL_HIGH_WATER_KEY = 'lom.steps.localHighWater.v1';

export async function resetLocalStepHighWater(): Promise<void> {
  await AsyncStorage.removeItem(STEPS_LOCAL_HIGH_WATER_KEY);
}
