# LoM Phone mobile agents

Expo Router app under `app/` (not `src/app`). Shared logic lives in `src/`.

## Commands

```bash
npx expo install <package>   # SDK-compatible deps
npx expo start
npx tsc --noEmit
```

## Rules

- No PocketBase superuser credentials in the client.
- Install identity: `src/device/credentials.ts` (`deviceId` + `deviceSecret` in SecureStore). Auth headers `X-LoM-Device-*`.
- Redeem/session/unlink/steps: `/lom/phone/*` (Team-Sneakymouse/pocketbase hooks). Crockford codes in `src/util/crockford.ts`.
- Steps: submit pedometer-style cumulative via `POST /lom/phone/steps`; server baselines per link epoch (first submit after redeem credits 0). Never write `phone_player_steps` CRUD. Clear `lom.steps.localHighWater.v1` on link/unlink.
- Job Board push: Settings toggle → `expo-notifications` token → `/lom/phone/push/register`. Native builds need `extra.eas.projectId` (EAS). Web has no push.
- Mojang name lookup must fall back to local cache when offline; UUID comes from the server session.
- Job Board reads `lom2_listed_jobs` (open rows: `endTime = 0`); may fetch `posterIconBase64`, not raw `location` coords.
- Do not trust Expo API memory — check SDK 57 docs when unsure.
