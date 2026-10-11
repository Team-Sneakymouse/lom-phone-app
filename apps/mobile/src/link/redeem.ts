import { getOrCreateDeviceCredentials } from '@/src/device/credentials';
import { redeemOnServer } from '@/src/link/api';
import type { LinkSession } from '@/src/storage/session';
import { isLinkCode, normalizeLinkCode } from '@/src/util/crockford';

/**
 * Redeem a short-lived in-game Crockford code against PocketBase.
 * Creates/updates phone_device_links for this install's device credentials.
 */
export async function redeemLinkCode(rawCode: string): Promise<LinkSession> {
  const code = normalizeLinkCode(rawCode);
  if (!isLinkCode(code)) {
    throw new Error('Enter the 10-character code from /lomphone link.');
  }

  const creds = await getOrCreateDeviceCredentials();
  return redeemOnServer(code, creds);
}
