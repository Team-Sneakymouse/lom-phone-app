# Architecture and decisions

## Scope and status

The community is designing a location-free Lords of Minecraft phone companion. This repository is GNU GPL v3.0 licensed. The first implementation task is the Paper bridge; no mobile client, redemption service or reward delivery system is implemented yet.

## Current direction

- Proposed mobile stack: React Native, TypeScript and Expo development builds, with platform step providers. Android Health Connect and iOS Core Motion must be verified on physical devices.
- Existing PocketBase backend uses TypeScript compiled into JavaScript hooks: https://github.com/Team-Sneakymouse/pocketbase
- Keep pairing validation, authorization, activity reconciliation and atomic reward accounting in those hooks. Do not introduce a Go extension by default.
- Proposed separate private integration worker coordinates Minecraft, Discord and notification services. This is a recommendation, not implemented scope. Use existing integration services where suitable.
- Minecraft remains authoritative for gameplay; each projection has exactly one owner.

## Client trust boundary

Do not embed a shared privileged key in the mobile app. Pair through a short-lived single-use in-game code, then issue a limited player/device credential. Assume users can inspect the app and call every endpoint themselves.

Custom routes must explicitly enforce authentication, active link, ownership and permitted operations. Lock generic client writes to accounting and link collections. PocketBase rules with null are locked; empty strings allow everyone. Internal handler database access does not automatically enforce collection API rules.

Native secure storage protects tokens from casual theft, not from the device owner. Per-installation hardware-backed keys are optional hardening, not proof of walking. PocketBase native tokens are stateless: unlink/replacement needs explicit active-session/epoch checks, not just local token deletion.

## Activity and accessibility

Prefer history reconciliation on reopen over promised minute-by-minute background execution. Use time-window totals and idempotent accounting, not blindly accumulated submitted deltas. Clip eligibility to server-issued link epochs and define correction/provider-switching policies.

Keep physical steps separate from accessible game progress. Offer an accessible community/daily route without disability disclosure. Cap progress/rewards, do not write fictional health steps, and do not assume public health leaderboards are acceptable without privacy/store review.

## Cross-service work

Record a grant and its durable outbox item in one PocketBase transaction. A worker claims work with expiring leases, retries delivery and records acknowledgments. Minecraft durably deduplicates grant IDs with gameplay changes. This is at-least-once delivery unless atomic/recoverable recipient handling proves a stronger guarantee.

Do not make synchronous external Discord/Minecraft requests part of a phone activity transaction. Keep privileged credentials server-side and give integration identities the minimum necessary access.

## Paper bridge request

- Target Paper 26.2, with a Gradle runServer task.
- Use SneakyPocketbase through its Java-compatible PocketbaseProvider/PocketbaseApi seam; no duplicate authentication configuration.
- A player command first warns that the code is private. Only clicking confirmation generates and persists a code, then privately displays it.
- Store short-lived hashed link codes in a new private collection; redemption is future backend work.
- Fetch accepted player step totals from a PocketBase collection and expose a cache-only PlaceholderAPI placeholder.
- Network operations run asynchronously; Paper messages/state changes return to the server thread. Generation checks prevent obsolete results after manager recovery/reload.
- Ship collection schema/migration proposals and setup instructions, not changes to production PocketBase.

## Remaining decisions

Mobile framework acceptance; reward sink/balance; privacy and store owner; retention/minors policy; active-session and redemption endpoint implementation; integration worker deployment. The historical draft in notes/initial-architecture-plan.md preserves the earlier brainstorming rather than pretending it was fully agreed.
