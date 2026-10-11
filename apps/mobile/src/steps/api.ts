import { pocketBaseUrl } from '@/src/api/pocketbase';
import {
  deviceAuthHeaders,
  getOrCreateDeviceCredentials,
} from '@/src/device/credentials';

export type StepsState = {
  minecraftUuid: string;
  totalSteps: number;
  paidSteps: number;
};

/** High-water cumulative steps since linking (server reconciles + caps). */
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
  const data = (await res.json().catch(() => ({}))) as StepsState & { error?: string };
  if (!res.ok) throw new Error(data.error || 'Could not sync steps');
  return {
    minecraftUuid: String(data.minecraftUuid ?? ''),
    totalSteps: Number(data.totalSteps) || 0,
    paidSteps: Number(data.paidSteps) || 0,
  };
}

export async function fetchStepsState(): Promise<StepsState> {
  const creds = await getOrCreateDeviceCredentials();
  const res = await fetch(`${pocketBaseUrl()}/lom/phone/steps`, {
    method: 'GET',
    headers: deviceAuthHeaders(creds),
  });
  const data = (await res.json().catch(() => ({}))) as StepsState & { error?: string };
  if (!res.ok) throw new Error(data.error || 'Could not load steps');
  return {
    minecraftUuid: String(data.minecraftUuid ?? ''),
    totalSteps: Number(data.totalSteps) || 0,
    paidSteps: Number(data.paidSteps) || 0,
  };
}
