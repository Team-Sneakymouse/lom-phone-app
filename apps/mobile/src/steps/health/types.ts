export type HealthStatus =
  | 'unsupported'
  | 'unavailable'
  | 'needs_permission'
  | 'denied'
  | 'ready';

export type HealthStepsProvider = {
  getStatus: () => Promise<HealthStatus>;
  /** Request access, or open system settings when the OS will not re-prompt. */
  requestAccess: () => Promise<HealthStatus>;
  openSettings: () => Promise<void>;
  getStepsInRange: (start: Date, end: Date) => Promise<number>;
};
