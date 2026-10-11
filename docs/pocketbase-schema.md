# Proposed PocketBase contracts — operator review required

**Proposals, not executed migrations.** This plugin cannot provision collections. Review in a disposable backend before any production changes. Collection names below are configurable defaults.

## Private access (both collections)

Set all five API rules (`listRule`, `viewRule`, `createRule`, `updateRule`, `deleteRule`) to **locked/null**, never empty string (open access). No mobile/anonymous client may inspect digests/UUIDs, issue codes, alter accepted totals or redeem through collection CRUD. The existing manager supplies privileged server-side access with privately configured credentials; there are no phone/plugin credentials here.

Future redemption requires a dedicated authenticated, rate-limited hook route, not open collection rules. Backend validation must enforce the contract independently.

## `phone_link_codes` — new base collection

Keep PocketBase system `id`. Custom fields:

| Field | Type | Contract |
|---|---|---|
| `minecraft_uuid` | text | Required canonical lowercase UUID; regex `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$` |
| `code_digest` | text | Required exactly 64 lowercase SHA-256 hex characters; regex `^[0-9a-f]{64}$` |
| `created_at` | date | Required UTC bridge creation marker |
| `expires_at` | date | Required, after creation; TTL 30–900 seconds |
| `consumed_at` | date | Optional/empty initially; future atomic redemption only |

Index proposals (review identifiers for renamed collections):

```sql
CREATE UNIQUE INDEX idx_phone_link_codes_digest ON phone_link_codes (code_digest);
CREATE INDEX idx_phone_link_codes_uuid_expiry ON phone_link_codes (minecraft_uuid, expires_at);
CREATE INDEX idx_phone_link_codes_expiry ON phone_link_codes (expires_at);
```

The bridge writes UUID, digest and timestamps only. **Never add a raw-code field.** The code is 32 cryptographically random bytes, encoded as 43-character unpadded base64url. Hash exactly the displayed string's UTF-8 bytes with SHA-256: no trimming, padding or case changes. This is a 256-bit secret, not a human password.

UUID is intentionally **not unique** here: multiple codes can exist, including an uncertain write that committed. Invalidating older codes is an explicit future backend policy, not implemented here.

### Future redemption (not implemented)

1. Require authenticated phone/device ownership and rate-limit valid/invalid attempts. Use generic responses.
2. Hash the submitted secret; privately find the unique digest. Reject missing/consumed/expired records using **backend time** and validate the stored canonical UUID.
3. In **one transaction**, conditionally consume an unconsumed/unexpired code and create the ownership link. Concurrent requests must have exactly one winner; no check-then-update outside a transaction.
4. Derive identity from the record, never a phone-supplied UUID. Phone clients cannot issue/extend/reset codes, clear consumption or write accepted totals.
5. Enforce expiry even before cleanup runs. Implement audited retention/cleanup without raw-code logging. Define clock-skew policy with the backend owner.

Issuance alone does **not** create a functional mobile link. Failed/timeout writes may already have committed; the bridge does not retry or disclose codes on failure.

## `phone_player_steps` — proposed accepted aggregate

| Field | Type | Contract |
|---|---|---|
| `minecraft_uuid` | text | Required lowercase canonical UUID; regex above |
| `total_steps` | number | `required=false`, `min=0`, `onlyInt=true`, `max=9007199254740991`; stored numeric zero is valid |

PocketBase's [`NumberField`](https://github.com/pocketbase/pocketbase/blob/master/core/field_number.go) uses `required=true` to reject zero, not to require input presence, and defaults omitted numeric fields to zero (`NUMERIC DEFAULT 0 NOT NULL`). If omission must not become an accepted zero, enforce explicit input presence in the trusted writer/hook before PocketBase normalizes or stores the value; the stored numeric zero remains valid. The bridge cannot distinguish a defaulted zero from an explicitly supplied zero.

```sql
CREATE UNIQUE INDEX idx_phone_player_steps_uuid ON phone_player_steps (minecraft_uuid);
```

This is **backend-accepted walking activity**, not a phone's raw health counter or reward balance. Only trusted hooks/worker may update totals with separately reviewed ownership, caps and idempotency. Represent non-walking/accessibility progress separately; never infer/disclose disability.

The bridge filters `minecraft_uuid = '<canonical UUID>'`, batch size 2, and requires exactly one matching row. Missing rows are **unknown**, not zero. Numeric zero is valid; duplicates, malformed/missing fields, stringified/noninteger/negative/out-of-safe-range values and mismatched UUIDs are unknown. Do not operate without the unique UUID index: list paging is not schema integrity.

Extra metadata can be added without affecting the bridge. Validate integrality and timestamp relationships in trusted backend schema/hooks, not just this parser.
