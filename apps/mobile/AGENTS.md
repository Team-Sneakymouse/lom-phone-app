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
- Link codes are Crockford (see `src/util/crockford.ts`); hash/redeem stays server-side.
- Mojang name lookup must fall back to local cache when offline.
- Job Board reads `lom2_listed_jobs` (open rows: `endTime = 0`) via public list/view rules; may fetch `posterIconBase64` for avatars, but not raw `location` coords.
- Do not trust Expo API memory — check SDK 57 docs when unsure.
