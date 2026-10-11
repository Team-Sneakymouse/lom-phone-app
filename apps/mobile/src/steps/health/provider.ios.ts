import type { HealthStepsProvider, HealthStatus } from '@/src/steps/health/types';
import {
  AuthorizationRequestStatus,
  getRequestStatusForAuthorization,
  isHealthDataAvailableAsync,
  queryStatisticsForQuantity,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';
import { Pedometer } from 'expo-sensors';
import { Linking } from 'react-native';

const HK_STEPS = 'HKQuantityTypeIdentifierStepCount' as const;
const HK_READ = { toRead: [HK_STEPS] as const };

async function motionStatus(): Promise<'ready' | 'needs_permission' | 'denied' | 'unavailable'> {
  const available = await Pedometer.isAvailableAsync();
  if (!available) return 'unavailable';
  const perm = await Pedometer.getPermissionsAsync();
  if (perm.granted) return 'ready';
  if (perm.status === 'denied' && !perm.canAskAgain) return 'denied';
  return 'needs_permission';
}

/** iOS does not expose read-grant status; “unnecessary” means we already prompted. */
async function healthKitReady(): Promise<boolean> {
  try {
    if (!(await isHealthDataAvailableAsync())) return false;
    const req = await getRequestStatusForAuthorization(HK_READ);
    return req === AuthorizationRequestStatus.unnecessary;
  } catch {
    return false;
  }
}

async function resolveStatus(): Promise<HealthStatus> {
  const motion = await motionStatus();
  let hkAvailable = false;
  try {
    hkAvailable = await isHealthDataAvailableAsync();
  } catch {
    hkAvailable = false;
  }

  if (motion === 'unavailable' && !hkAvailable) return 'unavailable';

  if (await healthKitReady()) return 'ready';
  if (motion === 'ready') return 'ready';

  if (motion === 'denied' && hkAvailable) {
    const req = await getRequestStatusForAuthorization(HK_READ);
    if (req === AuthorizationRequestStatus.shouldRequest) return 'needs_permission';
    return req === AuthorizationRequestStatus.unnecessary ? 'ready' : 'denied';
  }

  if (motion === 'denied') return 'denied';
  return 'needs_permission';
}

async function stepsFromHealthKit(start: Date, end: Date): Promise<number | null> {
  try {
    if (!(await healthKitReady())) return null;
    const stats = await queryStatisticsForQuantity(HK_STEPS, ['cumulativeSum'], {
      filter: { date: { startDate: start, endDate: end } },
      unit: 'count',
    });
    const sum = stats.sumQuantity?.quantity;
    if (sum == null || Number.isNaN(Number(sum))) return null;
    return Math.max(0, Math.floor(Number(sum)));
  } catch {
    return null;
  }
}

async function stepsFromCoreMotion(start: Date, end: Date): Promise<number> {
  const motion = await motionStatus();
  if (motion !== 'ready') {
    throw new Error('Motion & Fitness permission required');
  }
  const result = await Pedometer.getStepCountAsync(start, end);
  return Math.max(0, Math.floor(result?.steps ?? 0));
}

const iosHealthProvider: HealthStepsProvider = {
  getStatus: resolveStatus,

  async requestAccess() {
    const motion = await motionStatus();
    if (motion === 'needs_permission') {
      await Pedometer.requestPermissionsAsync();
    } else if (motion === 'denied') {
      await Linking.openSettings();
    }

    try {
      if (await isHealthDataAvailableAsync()) {
        const req = await getRequestStatusForAuthorization(HK_READ);
        if (req === AuthorizationRequestStatus.shouldRequest) {
          await requestAuthorization(HK_READ);
        } else if (
          req === AuthorizationRequestStatus.unnecessary &&
          (await motionStatus()) === 'denied'
        ) {
          await Linking.openSettings();
        }
      }
    } catch {
      // HealthKit optional if Core Motion works
    }

    return resolveStatus();
  },

  async openSettings() {
    await Linking.openSettings();
  },

  async getStepsInRange(start, end) {
    if (start.getTime() >= end.getTime()) return 0;
    const fromHk = await stepsFromHealthKit(start, end);
    if (fromHk != null) return fromHk;
    return stepsFromCoreMotion(start, end);
  },
};

export function getHealthStepsProvider(): HealthStepsProvider {
  return iosHealthProvider;
}
