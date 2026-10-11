import {
  deleteSecureItem,
  getSecureItem,
  setSecureItem,
} from '@/src/storage/secureKv';

const DEVICE_KEY = 'lom.device.v1';

export type DeviceCredentials = {
  deviceId: string;
  deviceSecret: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SECRET_RE = /^[0-9a-f]{64}$/;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function randomUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().toLowerCase();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytesToHex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function randomSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

function parseCreds(raw: string): DeviceCredentials | null {
  try {
    const parsed = JSON.parse(raw) as Partial<DeviceCredentials>;
    const deviceId = String(parsed.deviceId ?? '').toLowerCase();
    const deviceSecret = String(parsed.deviceSecret ?? '').toLowerCase();
    if (!UUID_RE.test(deviceId) || !SECRET_RE.test(deviceSecret)) return null;
    return { deviceId, deviceSecret };
  } catch {
    return null;
  }
}

/** Stable install identity; created once and kept in secure storage. */
export async function getOrCreateDeviceCredentials(): Promise<DeviceCredentials> {
  const existing = await getSecureItem(DEVICE_KEY);
  if (existing) {
    const parsed = parseCreds(existing);
    if (parsed) return parsed;
  }
  const next: DeviceCredentials = {
    deviceId: randomUuid(),
    deviceSecret: randomSecret(),
  };
  await setSecureItem(DEVICE_KEY, JSON.stringify(next));
  return next;
}

export async function clearDeviceCredentials(): Promise<void> {
  await deleteSecureItem(DEVICE_KEY);
}

export function deviceAuthHeaders(creds: DeviceCredentials): Record<string, string> {
  return {
    'X-LoM-Device-Id': creds.deviceId,
    'X-LoM-Device-Secret': creds.deviceSecret,
  };
}
