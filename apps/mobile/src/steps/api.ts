import { pocketBaseUrl } from '@/src/api/pocketbase';
import {
  deviceAuthHeaders,
  getOrCreateDeviceCredentials,
} from '@/src/device/credentials';

export type StepsState = {
  minecraftUuid: string;
  totalSteps: number;
  paidSteps: number;
  sessionSteps: number;
  baselineSet?: boolean;
  hasBaseline?: boolean;
};

type StepsApiPayload = StepsState & { error?: string };

function parseStepsState(data: StepsApiPayload): StepsState {
  return {
    minecraftUuid: String(data.minecraftUuid ?? ''),
    totalSteps: Number(data.totalSteps) || 0,
    paidSteps: Number(data.paidSteps) || 0,
    sessionSteps: Number(data.sessionSteps) || 0,
    baselineSet: Boolean(data.baselineSet),
    hasBaseline: data.hasBaseline === undefined ? undefined : Boolean(data.hasBaseline),
  };
}

/**
 * Submit pedometer-style cumulative reading for this install.
 * Server baselines on first submit after redeem; later submits credit deltas only.
 */
export async function submitStepSnapshot(steps: number): Promise<StepsState> {
  const creds = await getOrCreateDeviceCredentials();
  const res = await fetch(`${pocketBaseUrl()}/lom/phone/steps`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...deviceAuthHeaders(creds),
    },
    body: JSON.stringify({
      steps: Math.max(0, Math.floor(steps)),
      deviceId: creds.deviceId,
      deviceSecret: creds.deviceSecret,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as StepsApiPayload;
  if (!res.ok) throw new Error(data.error || 'Could not sync steps');
  return parseStepsState(data);
}

export async function fetchStepsState(): Promise<StepsState> {
  const creds = await getOrCreateDeviceCredentials();
  const res = await fetch(`${pocketBaseUrl()}/lom/phone/steps`, {
    method: 'GET',
    headers: deviceAuthHeaders(creds),
  });
  const data = (await res.json().catch(() => ({}))) as StepsApiPayload;
  if (!res.ok) throw new Error(data.error || 'Could not load steps');
  return parseStepsState(data);
}
