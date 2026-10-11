import AsyncStorage from '@react-native-async-storage/async-storage';

export type AndroidStepSource = 'sensor' | 'health_connect';

const SOURCE_KEY = 'lom.steps.androidSource.v1';

/** Default: phone step counter. Health Connect is opt-in. */
export async function loadAndroidStepSource(): Promise<AndroidStepSource> {
  const raw = await AsyncStorage.getItem(SOURCE_KEY);
  return raw === 'health_connect' ? 'health_connect' : 'sensor';
}

export async function saveAndroidStepSource(
  source: AndroidStepSource,
): Promise<void> {
  await AsyncStorage.setItem(SOURCE_KEY, source);
}
