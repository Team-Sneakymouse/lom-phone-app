import type { HealthStepsProvider, HealthStatus } from '@/src/steps/health/types';
import { sensorStepsInRange } from '@/src/steps/health/androidSensorLedger';
import {
  loadAndroidStepSource,
  type AndroidStepSource,
} from '@/src/steps/health/androidSource';
import { isAndroidStepCounterAvailable } from 'android-step-counter';
import * as Device from 'expo-device';
import { Pedometer } from 'expo-sensors';
import { Linking, Platform } from 'react-native';
import {
  aggregateRecord,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';

const STEPS_READ = { accessType: 'read' as const, recordType: 'Steps' as const };

/** Same action as HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS. */
const HC_SETTINGS_ACTION = 'androidx.health.ACTION_HEALTH_CONNECT_SETTINGS';

const HC_PLAY_HTTPS =
  'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata';
const HC_PLAY_MARKET =
  'market://details?id=com.google.android.apps.healthdata';

async function activityStatus(): Promise<
  'ready' | 'needs_permission' | 'denied' | 'unavailable'
> {
  try {
    if (!(await isAndroidStepCounterAvailable())) return 'unavailable';
    const perm = await Pedometer.getPermissionsAsync();
    if (perm.granted) return 'ready';
    if (perm.status === 'denied' && !perm.canAskAgain) return 'denied';
    return 'needs_permission';
  } catch {
    return 'unavailable';
  }
}

async function ensureHcInitialized(): Promise<HealthStatus | null> {
  try {
    const status = await getSdkStatus();
    if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE) return 'unavailable';
    if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
      return 'unavailable';
    }
    const ok = await initialize();
    if (!ok) return 'unavailable';
    return null;
  } catch {
    return 'unavailable';
  }
}

async function hasStepsRead(): Promise<boolean> {
  try {
    const granted = await getGrantedPermissions();
    return granted.some(
      (p) =>
        'recordType' in p &&
        p.recordType === 'Steps' &&
        'accessType' in p &&
        p.accessType === 'read',
    );
  } catch {
    return false;
  }
}

async function openPlayStoreHealthConnect(): Promise<void> {
  try {
    if (await Linking.canOpenURL(HC_PLAY_MARKET)) {
      await Linking.openURL(HC_PLAY_MARKET);
      return;
    }
  } catch {
    // fall through
  }
  await Linking.openURL(HC_PLAY_HTTPS);
}

async function openHealthUi(): Promise<void> {
  let sdkStatus: number | null = null;
  try {
    sdkStatus = await getSdkStatus();
  } catch {
    sdkStatus = null;
  }

  const needsInstall =
    sdkStatus === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED ||
    sdkStatus === SdkAvailabilityStatus.SDK_UNAVAILABLE;

  if (needsInstall) {
    try {
      await openPlayStoreHealthConnect();
    } catch {
      await Linking.openSettings();
    }
    return;
  }

  if (Platform.OS === 'android') {
    try {
      await Linking.sendIntent(HC_SETTINGS_ACTION);
      return;
    } catch {
      // OEM without settings activity
    }
  }

  await Linking.openSettings();
}

async function resolveSensorStatus(): Promise<HealthStatus> {
  if (!Device.isDevice) return 'unavailable';
  return activityStatus();
}

async function resolveHcStatus(): Promise<HealthStatus> {
  if (!Device.isDevice) return 'unavailable';
  const initFail = await ensureHcInitialized();
  if (initFail) return initFail;
  return (await hasStepsRead()) ? 'ready' : 'needs_permission';
}

async function source(): Promise<AndroidStepSource> {
  return loadAndroidStepSource();
}

const androidHealthProvider: HealthStepsProvider = {
  async getStatus() {
    return (await source()) === 'health_connect'
      ? resolveHcStatus()
      : resolveSensorStatus();
  },

  async requestAccess() {
    if ((await source()) === 'health_connect') {
      try {
        const initFail = await ensureHcInitialized();
        if (initFail) {
          if (Device.isDevice) await openHealthUi();
          return initFail;
        }
        if (await hasStepsRead()) return 'ready';
        await requestPermission([STEPS_READ]);
        if (await hasStepsRead()) return 'ready';
        if (!Device.isDevice) return 'unavailable';
        return 'denied';
      } catch {
        return Device.isDevice ? 'denied' : 'unavailable';
      }
    }

    try {
      const status = await activityStatus();
      if (status === 'unavailable') return 'unavailable';
      if (status === 'ready') return 'ready';
      if (status === 'denied') {
        await Linking.openSettings();
        return activityStatus();
      }
      await Pedometer.requestPermissionsAsync();
      return activityStatus();
    } catch {
      return 'denied';
    }
  },

  async openSettings() {
    if (!Device.isDevice) return;
    if ((await source()) === 'health_connect') {
      await openHealthUi();
      return;
    }
    await Linking.openSettings();
  },

  async getStepsInRange(start, end) {
    if (start.getTime() >= end.getTime()) return 0;
    if ((await source()) === 'health_connect') {
      const initFail = await ensureHcInitialized();
      if (initFail) throw new Error('Health Connect is not available');
      if (!(await hasStepsRead())) throw new Error('Health Connect permission required');

      const result = await aggregateRecord({
        recordType: 'Steps',
        timeRangeFilter: {
          operator: 'between',
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        },
      });
      const total = Number((result as { COUNT_TOTAL?: number }).COUNT_TOTAL ?? 0);
      return Math.max(0, Math.floor(total));
    }

    const motion = await activityStatus();
    if (motion !== 'ready') {
      throw new Error('Physical activity permission required');
    }
    return sensorStepsInRange(start, end);
  },
};

export function getHealthStepsProvider(): HealthStepsProvider {
  return androidHealthProvider;
}
