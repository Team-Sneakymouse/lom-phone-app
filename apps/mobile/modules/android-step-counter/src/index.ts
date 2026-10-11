import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

type NativeModule = {
  isAvailableAsync: () => Promise<boolean>;
  getBootCountAsync: () => Promise<number>;
  getBootStepCountAsync: () => Promise<number>;
};

const Native: NativeModule | null =
  Platform.OS === 'android'
    ? requireNativeModule<NativeModule>('AndroidStepCounter')
    : null;

export async function isAndroidStepCounterAvailable(): Promise<boolean> {
  if (!Native) return false;
  try {
    return await Native.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function getAndroidBootCount(): Promise<number> {
  if (!Native) return 0;
  return Math.max(0, Math.floor(await Native.getBootCountAsync()));
}

/** Cumulative hardware steps since last device reboot. */
export async function getAndroidBootStepCount(): Promise<number> {
  if (!Native) {
    throw new Error('Android step counter is only available on Android');
  }
  const n = await Native.getBootStepCountAsync();
  return Math.max(0, Math.floor(n));
}
