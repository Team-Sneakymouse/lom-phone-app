import type { HealthStepsProvider } from '@/src/steps/health/types';

/** Fallback (web / unknown): no pedometer. */
const unsupportedProvider: HealthStepsProvider = {
  async getStatus() {
    return 'unsupported';
  },
  async requestAccess() {
    return 'unsupported';
  },
  async openSettings() {},
  async getStepsInRange() {
    throw new Error('Health steps are not available on this platform');
  },
};

export function getHealthStepsProvider(): HealthStepsProvider {
  return unsupportedProvider;
}
