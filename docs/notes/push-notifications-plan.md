# Plan: Job Board push notifications

**Scope (v1):** one opt-in: notify when a **new** `lom2_listed_jobs` row is created (open listing). No category filters, no Discord parity extras yet.

## Product

### Settings UI
In `apps/mobile/app/(app)/settings.tsx`, under unlink:

- Section **Notifications**
- Toggle: **New job board posts** (default **off**)
- Helper text: requires OS permission; only while this device stays linked
- If permission denied: show “Enable in system settings” + deep-link guidance (iOS Settings / Android app notification settings)
- Persist preference server-side (not only local) so uninstall/reinstall can restore intent after re-link

### Behavior
- Push when a job is **listed** (record create with `endTime = 0`, or create then treat as open).
- Do **not** push on unlist/expire/update.
- Tap opens the app to **Job Board** (`/(app)/job-board`).
- Title/body sketch: category + name, e.g. `Birthday Party — Free cake in Brickton` (keep short; no base64 icons in the payload).

## Architecture

```
SneakyJobBoard → creates lom2_listed_jobs
        ↓
PocketBase hook onRecordCreate (lom2_listed_jobs)
        ↓
Lookup devices with notify_jobs=true + active link + push token
        ↓
Expo Push API (or FCM/APNs via Expo)
        ↓
Device → opens Job Board
```

Mother Mouse / Discord already reacts to the same table; phone push is a **second consumer** of creates, not a Discord scrape.

### Why Expo Push
- Fits Expo Router app; one token pipeline for Android + iOS (when iOS ships).
- Server only needs Expo push receipts; no custom FCM/APNs wiring in v1.
- Web build: no real push (or skip toggle on web). Document that Job Board push is **native-only**.

## Data model

### Extend `phone_device_links` (or small side table)

Prefer fields on the device link row (one install = one preference set):

| Field | Type | Notes |
|--------|------|--------|
| `push_token` | text | Expo push token; empty if none |
| `notify_jobs` | bool | default false |
| `push_updated_at` | date | last token/pref write |

Rules stay **locked**; only device-authenticated hooks read/write these fields.

Alternative: `phone_push_preferences` keyed by `device_id` — use only if link rows should stay auth-minimal.

### Hook routes

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/lom/phone/push/register` | Body: `{ pushToken, notifyJobs }` — upsert token + pref on active device link |
| POST | `/lom/phone/push/unregister` | Clear token (logout/unlink or user disables OS permission) |

Unregister on **unlink** (already revoke link) and when toggle turns off (clear token optional; keeping token with `notify_jobs=false` is fine).

### Send path

`onRecordCreate` for `lom2_listed_jobs` (in Team-Sneakymouse/pocketbase):

1. Ignore if not an open listing (`endTime != 0` if ever set on create).
2. `findRecordsByFilter('phone_device_links', "notify_jobs=true && revoked_at='' && push_token!=''", …)` (paginate).
3. Batch Expo push (`https://exp.host/--/api/v2/push/send`) with data `{ url: '/(app)/job-board', jobId }`.
4. Drop dead tokens on `DeviceNotRegistered` receipts (cron or inline cleanup).

**Do not** put Expo access tokens in the mobile app. Server uses Expo’s open push API with device tokens only (Expo push tokens are not secret like FCM server keys, but still only store/send server-side).

## Client work (`apps/mobile`)

1. Add `expo-notifications` (+ config plugin in `app.json`: icon, Android channel).
2. Dev/prod **EAS** builds required for real device push (not Expo Go long-term).
3. On Settings toggle ON:
   - `requestPermissionsAsync`
   - `getExpoPushTokenAsync` (needs EAS project id)
   - `POST /lom/phone/push/register` with `notifyJobs: true`
4. On toggle OFF: register `notifyJobs: false` (and optionally unregister token).
5. On app start (if linked + notify_jobs intended locally): refresh token if it changed.
6. Notification response listener → `router.push('/(app)/job-board')`.
7. Android: default channel `jobs` (importance default).
8. iOS: alert + sound; no background modes beyond remote-notification entitlement from the plugin.

## Permissions & store copy

- Android 13+: POST_NOTIFICATIONS runtime prompt.
- Data safety / App Privacy: “device identifiers / push tokens used to deliver optional job alerts.”
- Privacy policy line: opt-in, can disable in Settings, stopped on unlink.

## Rollout

1. Schema fields + register/unregister hooks + create-hook sender (can no-op if zero tokens).
2. Settings toggle + token registration on a native build.
3. Manual test: list a job in-game → push on a linked device with toggle on; no push with toggle off / unlinked.
4. Later (out of v1): per-category filters, quiet hours, Discord-style rich body, iOS once Apple Developer is paid.

## Non-goals (v1)

- Web push
- Pedometer / mail / reward pushes
- Category-specific job filters
- Guaranteed delivery / high-volume fanout (paginate; OK for LoM-scale listings)

## Implementation status

Implemented: schema fields, `/lom/phone/push/*` hooks, `lom2_listed_jobs` fan-out, Settings toggle, tap → Job Board, unlink clears push.

Still required for real-device delivery: set `expo.extra.eas.projectId` via `eas init`, then an EAS/dev client build (not web).

## Acceptance

- [x] Toggle off by default; no OS prompt until user enables
- [ ] Enable → permission → token stored → new job create delivers one notification (needs native build + EAS project id)
- [x] Disable or unlink → no further job pushes to that install (server clears prefs)
- [x] Notification tap lands on Job Board
- [x] Invalid tokens cleaned up on `DeviceNotRegistered`
