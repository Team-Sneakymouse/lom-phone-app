import { isLinkCode, normalizeLinkCode } from '@/src/util/crockford';
import type { LinkSession } from '@/src/storage/session';

/**
 * Redeem a short-lived in-game Crockford code.
 * PocketBase redeem hooks are not wired yet — stub accepts valid codes and
 * links a demo UUID (override with EXPO_PUBLIC_DEMO_UUID).
 */
export async function redeemLinkCode(rawCode: string): Promise<LinkSession> {
  const code = normalizeLinkCode(rawCode);
  if (!isLinkCode(code)) {
    throw new Error('Enter the 10-character code from /lomphone link.');
  }

  // Future: POST to PocketBase redeem route; never use superuser credentials here.
  const demoUuid =
    process.env.EXPO_PUBLIC_DEMO_UUID?.trim() ||
    '98ec946a-6fbf-45a5-8408-d6f8a0804f97';

  await delay(350);
  return {
    minecraftUuid: demoUuid.toLowerCase(),
    linkedAt: new Date().toISOString(),
  };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
