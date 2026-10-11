import { pocketBaseUrl } from '@/src/api/pocketbase';
import {
  deviceAuthHeaders,
  type DeviceCredentials,
} from '@/src/device/credentials';
import type { LinkSession } from '@/src/storage/session';

type SessionResponse = {
  deviceId?: string;
  minecraftUuid?: string;
  linkedAt?: string;
  error?: string;
};

function asSession(data: SessionResponse, creds: DeviceCredentials): LinkSession {
  const minecraftUuid = String(data.minecraftUuid ?? '').toLowerCase();
  if (!minecraftUuid) throw new Error('Link response missing Minecraft UUID');
  return {
    deviceId: creds.deviceId,
    minecraftUuid,
    linkedAt: String(data.linkedAt ?? new Date().toISOString()),
  };
}

export async function redeemOnServer(
  code: string,
  creds: DeviceCredentials,
  signal?: AbortSignal,
): Promise<LinkSession> {
  const res = await fetch(`${pocketBaseUrl()}/api/lom/phone/redeem`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      ...deviceAuthHeaders(creds),
    },
    body: JSON.stringify({
      code,
      deviceId: creds.deviceId,
      deviceSecret: creds.deviceSecret,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as SessionResponse;
  if (!res.ok) {
    throw new Error(data.error || 'Invalid or expired code');
  }
  return asSession(data, creds);
}

export async function fetchServerSession(
  creds: DeviceCredentials,
  signal?: AbortSignal,
): Promise<LinkSession | null> {
  const res = await fetch(`${pocketBaseUrl()}/api/lom/phone/session`, {
    method: 'GET',
    signal,
    headers: deviceAuthHeaders(creds),
  });
  if (res.status === 401) return null;
  const data = (await res.json().catch(() => ({}))) as SessionResponse;
  if (!res.ok) {
    throw new Error(data.error || 'Could not verify link');
  }
  return asSession(data, creds);
}

export async function unlinkOnServer(
  creds: DeviceCredentials,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${pocketBaseUrl()}/api/lom/phone/unlink`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      ...deviceAuthHeaders(creds),
    },
    body: JSON.stringify({
      deviceId: creds.deviceId,
      deviceSecret: creds.deviceSecret,
    }),
  });
  if (res.status === 401) return; // already revoked / unknown
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as SessionResponse;
    throw new Error(data.error || 'Could not unlink');
  }
}
