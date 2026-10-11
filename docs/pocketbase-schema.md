# PocketBase contracts — LoM phone companion

Collection names below are configurable defaults for the Paper bridge. **CRUD rules stay locked/null** unless noted. The phone never ships superuser credentials; privileged pairing uses custom routes in [Team-Sneakymouse/pocketbase](https://github.com/Team-Sneakymouse/pocketbase) hooks.

## Private access

For `phone_link_codes`, `phone_device_links`, and `phone_player_steps`, set all five API rules (`listRule`, `viewRule`, `createRule`, `updateRule`, `deleteRule`) to **locked/null**, never empty string (open access). Mobile clients must not list/create/update these collections directly.

## `phone_link_codes` — short-lived in-game codes

Keep PocketBase system `id`. Custom fields:

| Field | Type | Contract |
|---|---|---|
| `minecraft_uuid` | text | Required canonical lowercase UUID |
| `code_digest` | text | Required 64 lowercase SHA-256 hex chars |
| `created_at` | date | Required UTC bridge creation marker |
| `expires_at` | date | Required; TTL 30–900 seconds |
| `consumed_at` | date | Empty until redeemed; set atomically by redeem route |

Indexes:

```sql
CREATE UNIQUE INDEX idx_phone_link_codes_digest ON phone_link_codes (code_digest);
CREATE INDEX idx_phone_link_codes_uuid_expiry ON phone_link_codes (minecraft_uuid, expires_at);
CREATE INDEX idx_phone_link_codes_expiry ON phone_link_codes (expires_at);
```

The Paper bridge writes UUID, digest and timestamps only. **Never store the raw code.** Codes are **10 characters of Crockford base32** (`0123456789ABCDEFGHJKMNPQRSTVWXYZ`). Hash the canonical uppercase UTF-8 bytes with SHA-256.

## `phone_device_links` — install ↔ Minecraft ownership

| Field | Type | Contract |
|---|---|---|
| `device_id` | text | Required lowercase UUID; unique per install |
| `secret_digest` | text | Required SHA-256 hex of the install secret |
| `minecraft_uuid` | text | Required lowercase UUID from the consumed code |
| `linked_at` | date | Required; link epoch start |
| `revoked_at` | date | Empty while active; set on unlink / replaced by another device |
| `steps_baseline` | number | Pedometer reading at first submit after this redeem; empty until set |
| `steps_last_reported` | number | Last accepted pedometer reading in this link epoch |

Indexes:

```sql
CREATE UNIQUE INDEX idx_phone_device_links_device ON phone_device_links (device_id);
CREATE INDEX idx_phone_device_links_uuid ON phone_device_links (minecraft_uuid);
CREATE INDEX idx_phone_device_links_uuid_active ON phone_device_links (minecraft_uuid, revoked_at);
```

### Device credential model

1. The app generates `deviceId` (UUID) + `deviceSecret` (32 random bytes as 64 hex chars) once and stores them in secure storage.
2. Every privileged call sends `X-LoM-Device-Id` / `X-LoM-Device-Secret` (body fields accepted on POST).
3. Hooks resolve `minecraft_uuid` from an **active** row (`revoked_at` empty) after checking `secret_digest`.
4. The app may cache `minecraftUuid` locally for Mojang display-name lookup; servers must not trust a client-supplied UUID for authorization.

### Custom routes (`/lom/phone/*`)

Mounted outside `/api/` (PocketBase reserves that prefix).

| Method | Path | Body / auth | Result |
|---|---|---|---|
| POST | `/lom/phone/redeem` | `{ code, deviceId, deviceSecret }` | Consume unexpired code; upsert device link; revoke other active devices for that UUID; return `{ deviceId, minecraftUuid, linkedAt }` |
| GET | `/lom/phone/session` | device headers | Active session payload or 401 |
| POST | `/lom/phone/unlink` | device headers or body | Sets `revoked_at` |

Redeem uses a DB transaction: mark `consumed_at`, then write the device link. Invalid/expired/consumed codes return a generic error. Re-linking the same device updates its UUID and secret digest; linking a UUID from a new device revokes prior active devices for that UUID (one active step-earning install per account). Redeem clears `steps_baseline` / `steps_last_reported` so the next steps submit starts a new epoch.

### Push fields (on `phone_device_links`)

| Field | Type | Notes |
|---|---|---|
| `push_token` | text | Expo push token (`ExponentPushToken[...]`) |
| `notify_jobs` | bool | Opt-in Job Board alerts (default false) |
| `push_updated_at` | date | Last preference/token write |

| Method | Path | Purpose |
|---|---|---|
| POST | `/lom/phone/push/register` | `{ notifyJobs, pushToken? }` on active device |
| POST | `/lom/phone/push/unregister` | Clear token + `notify_jobs` |

`onRecordCreateRequest` for `lom2_listed_jobs` (open rows) fans out Expo pushes to active devices with `notify_jobs=true` and a token. Unlink clears push fields. See [docs/notes/push-notifications-plan.md](notes/push-notifications-plan.md).

## `phone_player_steps` — accepted aggregate

| Field | Type | Contract |
|---|---|---|
| `minecraft_uuid` | text | Required lowercase canonical UUID |
| `total_steps` | number | Accepted lifetime high-water (`min=0`, int) |
| `paid_steps` | number | Steps already scanned for mail rewards |
| `last_submit_at` | date | Last successful phone snapshot |

```sql
CREATE UNIQUE INDEX idx_phone_player_steps_uuid ON phone_player_steps (minecraft_uuid);
```

Phone clients **must not** write this collection via CRUD. They call `POST /lom/phone/steps` with device auth and a pedometer-style cumulative `steps` reading. Per **link epoch** on `phone_device_links`: the first submit after redeem sets `steps_baseline` (credits **0**, blocking pre-link dumps across many phones); later submits credit only `max(0, reported − steps_last_reported)`, capped per request. The account row’s `total_steps` never decreases. The Paper bridge reads `total_steps` for `%lomphone_steps%` (missing/ambiguous → `unknown`) and uses `paid_steps` + the ledger when mailing rewards.

### Step routes

| Method | Path | Auth | Body / result |
|---|---|---|---|
| POST | `/lom/phone/steps` | device headers | `{ steps }` → `{ minecraftUuid, totalSteps, paidSteps, sessionSteps, baselineSet, lastSubmitAt }` |
| GET | `/lom/phone/steps` | device headers | totals + `{ sessionSteps, hasBaseline, lastSubmitAt }` |

## `phone_step_reward_ledger` — mailed reward crossings

| Field | Type | Contract |
|---|---|---|
| `minecraft_uuid` | text | Recipient |
| `reward_key` | text | e.g. `walk_1k:3` (tier key + crossing index) |
| `threshold_steps` | number | Steps at that crossing |
| `mail_source_key` | text | Matches `lom2_mail.source_key` (`lomphone:<uuid>:<reward_key>`) |
| `mailed_at` | date | When queued |

Unique on `(minecraft_uuid, reward_key)` and on `mail_source_key`. Bridge GCs rows older than configured retention (~7 days); idempotency remains via `lom2_mail.source_key` and advancing `paid_steps`.

## Job board (read-only)

`lom2_listed_jobs` is owned by SneakyJobBoard. Open listings use `endTime = 0`. Public `listRule` / `viewRule` of `endTime = 0` allow the phone Job Board to read display fields (including `posterIconBase64`); create/update/delete stay locked.
