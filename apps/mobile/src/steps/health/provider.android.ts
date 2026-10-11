import type { HealthStepsProvider, HealthStatus } from '@/src/steps/health/types';
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
  const status = await getSdkStatus();
  if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE) return 'unavailable';
  if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
    return 'unavailable';
  }
  const ok = await initialize();
  if (!ok) return 'unavailable';
  return null;
}

async function hasStepsRead(): Promise<boolean> {
  const granted = await getGrantedPermissions();
  return granted.some(
    (p) =>
      'recordType' in p &&
      p.recordType === 'Steps' &&
      'accessType' in p &&
      p.accessType === 'read',
  );
}

async function resolveStatus(): Promise<HealthStatus> {
  const initFail = await ensureInitialized();
  if (initFail) return initFail;
  return (await hasStepsRead()) ? 'ready' : 'needs_permission';
}

const androidHealthProvider: HealthStepsProvider = {
  getStatus: resolveStatus,

  async requestAccess() {
    const initFail = await ensureInitialized();
    if (initFail) {
      openHealthConnectSettings();
      return initFail;
    }
    if (await hasStepsRead()) return 'ready';
    await requestPermission([STEPS_READ]);
    return (await hasStepsRead()) ? 'ready' : 'denied';
  },

  async openSettings() {
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
