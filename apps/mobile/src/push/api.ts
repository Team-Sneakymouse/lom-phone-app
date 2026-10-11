import { pocketBaseUrl } from '@/src/api/pocketbase';
import {
  deviceAuthHeaders,
  getOrCreateDeviceCredentials,
} from '@/src/device/credentials';

export type PushPrefs = {
  notifyJobs: boolean;
  hasToken: boolean;
};

export async function registerPushPrefs(input: {
  notifyJobs: boolean;
  pushToken?: string;
}): Promise<PushPrefs> {
  const creds = await getOrCreateDeviceCredentials();
  const res = await fetch(`${pocketBaseUrl()}/lom/phone/push/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...deviceAuthHeaders(creds),
    },
    body: JSON.stringify({
      deviceId: creds.deviceId,
      deviceSecret: creds.deviceSecret,
      notifyJobs: input.notifyJobs,
      pushToken: input.pushToken ?? '',
    }),
  });
  const data = (await res.json().catch(() => ({}))) as PushPrefs & { error?: string };
  if (!res.ok) throw new Error(data.error || 'Could not save notification settings');
  return {
    notifyJobs: Boolean(data.notifyJobs),
    hasToken: Boolean(data.hasToken),
  };
}

export async function unregisterPush(): Promise<void> {
  const creds = await getOrCreateDeviceCredentials();
  const res = await fetch(`${pocketBaseUrl()}/lom/phone/push/unregister`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...deviceAuthHeaders(creds),
    },
    body: JSON.stringify({
      deviceId: creds.deviceId,
      deviceSecret: creds.deviceSecret,
    }),
  });
  if (!res.ok && res.status !== 401) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || 'Could not clear push registration');
  }
}
