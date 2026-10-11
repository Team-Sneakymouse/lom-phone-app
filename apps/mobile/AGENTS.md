# LoM Phone mobile agents

Expo Router app under `app/` (not `src/app`). Shared logic lives in `src/`.

## Commands

```bash
npx expo install <package>   # SDK-compatible deps
npx expo start
npx tsc --noEmit
```

Health Connect / HealthKit / Core Motion require a **dev client or EAS native build** — Expo Go will not load those modules.

**Android emulator setup / start:** see [README.md](./README.md#android-emulator-dev-client) (SDK, JDK 17, AVD, `adb reverse`, Metro + `expo run:android`).

## Rules

- No PocketBase superuser credentials in the client.
- Install identity: `src/device/credentials.ts` (`deviceId` + `deviceSecret` in SecureStore; no native `expo-crypto` until the dev client is rebuilt with it). Auth headers `X-LoM-Device-*`.
- Redeem/session/unlink/steps: `/lom/phone/*` (Team-Sneakymouse/pocketbase hooks). Crockford codes in `src/util/crockford.ts`.
- Steps UI: today (local health range), last sync (`lastSubmitAt`), manual sync, health status + permission CTA. Providers in `src/steps/health/` (`provider.android.ts` Health Connect, `provider.ios.ts` HealthKit + Core Motion, web unsupported).
- Sync submits an incremental **epoch high-water** via `POST /lom/phone/steps` (`src/steps/sync.ts`), never “steps today” as the POST body. Server baselines per link epoch. Clear epoch state on link/unlink (`resetLocalStepHighWater`).
- Never write `phone_player_steps` CRUD. Read-only health access only (no writes into Health Connect / HealthKit).
- Job Board push: Settings toggle → `expo-notifications` token → `/lom/phone/push/register`. Needs `google-services.json` (gitignored), `extra.eas.projectId`, and FCM V1 service account on Expo credentials — see [README Push (FCM)](./README.md#push-fcm). Never commit `*-firebase-adminsdk-*.json`. Web has no push.
- Mojang name lookup must fall back to local cache when offline; UUID comes from the server session.
- Job Board reads `lom2_listed_jobs` (open rows: `endTime = 0`); may fetch `posterIconBase64`, not raw `location` coords.
- Do not trust Expo API memory — check SDK 57 docs when unsure.
