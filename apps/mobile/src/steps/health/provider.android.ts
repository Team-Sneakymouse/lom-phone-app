import type { HealthStepsProvider, HealthStatus } from '@/src/steps/health/types';
import * as Device from 'expo-device';
import {
  aggregateRecord,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';

const STEPS_READ = { accessType: 'read' as const, recordType: 'Steps' as const };

async function ensureInitialized(): Promise<HealthStatus | null> {
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

async function resolveStatus(): Promise<HealthStatus> {
  // Emulators rarely grant usable Health Connect step access.
  if (!Device.isDevice) return 'unavailable';
  const initFail = await ensureInitialized();
  if (initFail) return initFail;
  return (await hasStepsRead()) ? 'ready' : 'needs_permission';
}

const androidHealthProvider: HealthStepsProvider = {
  getStatus: resolveStatus,

  async requestAccess() {
    try {
      const initFail = await ensureInitialized();
      if (initFail) {
        if (Device.isDevice) {
          try {
            openHealthConnectSettings();
          } catch {
            // ignore
          }
        }
        return initFail;
      }
      if (await hasStepsRead()) return 'ready';

      await requestPermission([STEPS_READ]);
      if (await hasStepsRead()) return 'ready';

      // Emulators often have Health Connect installed but no working permission UI
      // / no step providers — treat as unavailable, not a hard user deny.
      if (!Device.isDevice) return 'unavailable';
      return 'denied';
    } catch {
      return Device.isDevice ? 'denied' : 'unavailable';
    }
  },

  async openSettings() {
    if (!Device.isDevice) return;
    openHealthConnectSettings();
  },

  async getStepsInRange(start, end) {
    if (start.getTime() >= end.getTime()) return 0;
    const initFail = await ensureInitialized();
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
  },
};

export function getHealthStepsProvider(): HealthStepsProvider {
  return androidHealthProvider;
}
