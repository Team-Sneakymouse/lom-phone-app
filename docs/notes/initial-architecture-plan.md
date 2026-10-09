# LoM Phone Companion Architecture and Delivery Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Build an accessible iOS/Android companion that links to a Minecraft account, turns optional walking into capped LoM progress, and gradually exposes useful server information.

**Architecture:** A native-capable cross-platform app talks to a narrow, versioned companion API implemented inside PocketBase. A server-side Minecraft adapter publishes read models and consumes durable, idempotent reward commands; existing plugins remain authoritative for their gameplay systems.

**Tech Stack:** Proposed React Native + TypeScript + Expo development builds and Expo Router; platform-specific step providers; PocketBase with a small Go extension for transactional routes; pnpm for the TypeScript workspace; the actual Java/Kotlin and build tooling of the Minecraft integration repository once identified. Optional notifications use Expo Notifications after validating delivery requirements.

---

## Status, scope, and evidence

This is a greenfield architecture draft, not a repository-specific implementation prescription. Every brainstorming message available in Discord thread 1557992677818105856 was fetched; a further request before its earliest message returned empty. The starter in parent channel 808030927937994772 is `Lom phone app`, with no GitHub link. No repository was guessed or inspected. Add the intended repository link to the starter before repository-specific implementation planning.

Thread ideas: minute-interval foreground step uploads, REST authentication, PocketBase totals, an in-game link code, one account per phone, relinking baselines, egg status and hatching, opt-in job notifications and Dynmap, a step leaderboard, adventure-zone map and defense timers, stonks and auction monitoring, step-funded scrys, physical-location stops/gyms, community-supported accessible progress, idle walking and daily puzzles. Oakley's arena occupation and paid plot-stop ideas were initially about the *Minecraft* phone, not necessarily the real-phone app. Those should not silently become requirements for real-world GPS or mobile combat.

The following are recommendations, not decisions already agreed by the team.

## Product boundaries

### First vertical slice

- In-game pairing and secure mobile session.
- Step permission onboarding, capability checks, foreground sync and catch-up on reopen.
- Equivalent non-walking progress available to anyone, without proof of disability.
- One capped reward sink: choose egg incubation OR saved free scrys for the first release.
- Progress/reward status plus last successful sync.
- Unlink/revoke, privacy disclosure, deletion workflow.

### Follow-up features

1. Other reward sink, richer egg status and hatching presentation.
2. Read-only job board; then category-specific opt-in notifications.
3. Dynmap viewer and adventure-zone status/defense timers.
4. Stonks and auction price monitoring; no remote trading initially.
5. Opt-in leaderboard, subject to permission/policy review and abuse testing.
6. Existing-game arena/plot-stop features only after gameplay owners define authority and offline battle rules.

Real-world stops/gyms and GPS are a separate explicitly approved project, not dormant permissions in this app. Location-free scry charges are feasible; detecting visits to actual physical places is not the same feature.

## Mobile choice and step providers

React Native/Expo is the default because one TypeScript UI and contract layer can serve both platforms while allowing native modules. Use development builds, not Expo Go as the acceptance environment. Do not commit to a particular community health bridge until real-device compatibility is demonstrated. Flutter remains reasonable if the maintainers prefer Dart; native Swift/Kotlin gives maximum platform control but doubles UI work. A PWA is suitable for read-only companion pages, not the default for reliable cross-platform pedometer integration.

Define a platform-neutral provider interface with capability/authorization checks and `readTotal(start, end)`. Avoid leaking Android/iOS SDK details into screens or reward rules.

- **Android:** Investigate Health Connect aggregated steps, requesting read-only step access. Its aggregation handles overlapping sources according to user priorities; summing raw phone/watch records can double-count. Detect installation/availability and whether a step source actually supplies data. Integration does not guarantee every supported phone already has populated step history. Evaluate a native sensor fallback separately if needed.
- **iOS:** Start with Core Motion/CMPedometer phone steps. Expo documents historical reads for the preceding seven days and no background delivery from `watchStepCount`. HealthKit is an optional later provider for broader/watch data, not a prerequisite of the first release.
- No GPS, route, heart-rate or health-data write permissions.
- Request additional background health permissions only if justified and available.
- A minute foreground interval can be a UI/sync optimization. Do not promise a minute background timer: design progress around OS-kept history and reopening catch-up. Background work is opportunistic.
- Device testing must establish sensor coverage, historical availability and suspend/reboot behavior. Document retention limits to users; do not promise unlimited offline catch-up.

Health and motion data are sensitive. Apple guideline 5.1.3 covers Motion & Fitness as well as HealthKit; Core Motion is NOT a policy loophole. Review the reward use case, responsible publishing entity, server transmission and any sharing. Google requires accurate health declarations even for health data supporting non-health features. Launch privacy/store feasibility review before polishing the UI. A raw public health leaderboard should not be assumed acceptable merely because it is opt-in.

## Identity and trust

Proposed pairing:

1. An authenticated in-game player requests a short-lived, single-use random code.
2. The app redeems it over HTTPS with an installation identifier/public key.
3. The backend atomically consumes the code, associates the Minecraft UUID, and issues a scoped revocable session stored in native secure storage.
4. A server-issued link epoch/start time defines the beginning of eligible step history.
5. Replacing a device revokes the previous session and closes its earning epoch.

Enforce one active step-earning installation per Minecraft UUID, and one active UUID per installation. Additional read-only devices can be a later product decision. Installation identity is not a tamper-proof permanent physical-phone identity: reinstalls, rooted devices and emulators prevent that guarantee. Do not use invasive hardware fingerprinting.

Relinking must reset eligibility on the SERVER, not just a client counter. Clip earning windows to the link epoch, reject old epochs and stale credentials, and refuse historical pre-link progress. Validate cross-account/device baton passing with adversarial tests. Codes are rate-limited and stored hashed; mobile clients never receive a PocketBase superuser credential or Minecraft service credential.

## Accounting and abuse controls

Avoid a bare `total += clientDelta` route. Design a versioned step-total contract with link epoch, provider, server-defined bucket/window, total-as-of timestamp and idempotency key. Backend validates ownership, bounds, timestamps, epoch and rate limits and records canonical accepted totals transactionally. Daily buckets should have stable server-defined boundaries (e.g. UTC for the MVP); local clock/timezone changes must not mint another reward day.

For each bucket, reconcile repeated snapshots rather than adding them. A retry or an increasing snapshot must not credit the same steps twice. Define explicit policy for late provider corrections, provider switching and cross-device source overlap before implementation: retain raw reported snapshots only as required, keep the accepted baseline separate from consumed progress, and never recompute rewards by blindly summing snapshots. A cap/high-water policy can avoid negative rewards after corrected health data, but may retain over-credit; document this tradeoff and flag unusual corrections.

Maintain separate values for physical steps, community/daily/idle progress, eligible progression and actual issued rewards. Accessible progress must never become fabricated health steps or be written into a platform health store.

- Server-side per-day caps and modest, preferably non-tradable rewards limit economic damage.
- Validate impossible totals/window lengths and anomalous rates.
- Client activity data remains untrusted even when read from an official SDK.
- A public leaderboard is not an anti-cheat boundary. Attestation may raise the cost of tampering later, but does not prove a person walked.
- Earning, spending, queued delivery and delivered receipts require unique keys and transactional ledger updates.

## Accessibility model

Preferred initial rule: anyone can receive a configurable daily/community progress floor through an easy accessible claim, while walking can top up toward the same daily cap. A short daily puzzle may be an optional playful alternative, not a compulsory cognitive-accessibility barrier. Whether the floor reaches the full reward cap is a team balance decision; access to core rewards should not depend on mobility or health permission.

Keep the community narrative, but begin with a fixed floor for predictable balance. A later community statistic could use consented, clipped physical-step contributions, robust aggregation, a previous-day window, a minimum cohort and a safe fallback. Never feed synthetic credits back into that average. Do not expose individual contributions by default.

Idle autowalking is optional later. If added, persist a capped accrual start on the server and calculate elapsed-time rewards there; do not require keeping a screen awake or pretend that a JS timer proves walking.

## Backend and Minecraft integration

Use PocketBase because the thread proposes it, but isolate the app behind versioned domain routes, not writable public reward collections. A small Go extension is the proposed default for transactions and testable domain logic; JavaScript hooks are an alternative if the maintainers prefer them and can demonstrate equivalent accounting tests. Do not add a separate Node API merely for fashion.

Suggested private entities: player link, installation/session, link epoch, step bucket, progress ledger, reward outbox, delivery receipt, notification preference/token. Public read models are feature-specific and authorization-scoped.

Minecraft remains authoritative for eggs, scrys, inventories, jobs, markets and game battles. Determine whether incubation progress belongs in an existing plugin or the companion ledger; choose exactly one authority and sync projections rather than having both mutate an egg independently.

Reward delivery uses an outbox and unique reward ID:

- Backend atomically records an earned grant and delivery item.
- Minecraft adapter requests pending grants with a narrowly scoped service identity.
- Recipient durably records/reconciles the grant ID with the gameplay mutation.
- Adapter acknowledges delivery; interrupted requests retry safely.

Do NOT call this exactly-once unless the recipient can atomically or recoverably connect its mutation and durable receipt. Crash-after-award-before-ack is an explicit acceptance test. Avoid blocking network IO on the Minecraft main thread; gameplay mutations follow the actual plugin's required thread rules. Server outages leave grants pending, not lost or repeatedly minted.

PocketBase is pre-1.0 and its own docs warn against production-critical use without accepting compatibility/migration work. It is defensible for a bounded companion beta if maintainers accept that operational responsibility. Use pinned versions, reviewed migrations, tested off-host backups, rate limiting, restricted admin access and a staging restore. Revisit PostgreSQL/a dedicated service if write scale or economic criticality exceeds that scope.

## Proposed codebase layout

All paths are proposed NEW paths, not claims about an existing repository:

```text
apps/mobile/app/                         # route-level composition
apps/mobile/src/features/link/
apps/mobile/src/features/activity/
apps/mobile/src/features/rewards/
apps/mobile/src/features/settings/
apps/mobile/src/platform/steps/          # provider boundary + native adapters
apps/mobile/src/lib/api/
apps/mobile/src/lib/secure-session/
packages/contracts/openapi.yaml          # versioned HTTP contract
packages/contracts/src/generated/       # generated TypeScript client/types
services/companion/cmd/companion/main.go
services/companion/internal/link/
services/companion/internal/activity/
services/companion/internal/rewards/
services/companion/internal/notifications/
services/companion/migrations/
docs/architecture.md
docs/privacy.md
docs/device-test-matrix.md
infra/README.md
```

Keep the Minecraft adapter in its existing plugin repository if that is the team convention; otherwise propose `integrations/paper/` only after discovering the target. Share contracts/schema, not embedded gameplay algorithms, between languages. Screens use feature APIs; native health providers and storage details stay behind interfaces. No Kubernetes, Redis or general event bus until requirements justify them.

## Delivery gates and verification

These are architecture milestones, not fabricated 2-minute implementation tickets. Once the repository and reward choice are known, expand each gate into repository-specific RED/GREEN tasks with actual file paths and existing build commands.

### Gate 0: agree boundaries

Create `docs/architecture.md`, `docs/privacy.md`, `docs/device-test-matrix.md` in the eventual repo. Record reward sink, publishing owner, platform minimums, accessibility floor/cap, privacy retention and accounting correction policy. Add repository link to the thread starter. Acceptance: maintainers approve a no-GPS scope and explicit data flow/authority.

### Gate 1: mobile feasibility

Prototype provider capability, authorization and interval query behind `apps/mobile/src/platform/steps/`. Exercise physical Android and iPhone builds: foreground walking, background/suspend, reopen, watch-source overlap if supported, denial/revocation, unavailable provider, reboot, offline catch-up. Acceptance: real observed results are recorded; provider and native bridge selected from evidence. Do not count simulated device data as verification.

### Gate 2: pair securely

Write failing link/session API integration tests in `services/companion/internal/link/`, implement code redemption/session revocation, then run them and capture results. Add mobile link UI. Acceptance: expiry, one-use consumption, concurrent redemption, brute-force limits, replacement-device revocation and epoch enforcement all tested.

### Gate 3: reconcile progress

Write failing activity tests, implement transactional buckets and ledger. Test duplicate and out-of-order uploads, overlapping windows, incremental snapshots, negative/corrected data, clock changes, offline retry, provider switching, daily boundaries, pre-link history and account/device baton passing. Acceptance: conserved credits and no duplicate minting under retries/concurrency.

### Gate 4: equal non-walking route

Test and implement a server-governed floor/daily claim with separate provenance. Exercise repeated claims, cap overlap with walking, no health permission, screen reader and reduced-motion UI. Acceptance: clear equivalence/no disability verification and no synthetic health records.

### Gate 5: one real reward

Discover target plugin build setup and write receiver/outbox tests before implementation. Demonstrate phone progress reaching an actual test player/egg/scry balance, with durable delivery evidence. Test disconnected server, retry, reconnect, duplicate delivery and crash after mutation before acknowledgment. Run actual plugin build; follow with an in-game checklist. Compilation is not in-game verification.

### Gate 6: beta operations

Pin dependencies and PocketBase release; test migration/backup restoration, revoke/unlink/deletion, retention and redacted logging. Configure HTTPS/rate limits/admin restrictions using the team's deployment process. Verify store/privacy disclosures and notification opt-in if present. Acceptance: signed physical-device builds, passing selected tests and observed restoration/reward delivery. No deployment/merge without explicit approval.

## Open decisions

- React Native/TypeScript vs a maintainer preference for Flutter or native?
- Is there already a PocketBase instance/schema and account-linking service to reuse?
- Which gameplay repository owns eggs/scrys and what durable delivery hooks does it offer?
- Eggs or free scrys for the first vertical slice?
- Daily accessible floor, reward cap and whether both routes reach equal core rewards?
- Who publishes the app and owns privacy/store-policy review, including minors and data retention?
- How much catch-up history and what provider-correction policy is acceptable?

## Sources checked

- Android Health Connect setup: https://developer.android.com/health-and-fitness/guides/health-connect/develop/get-started
- Android aggregate/deduplication: https://developer.android.com/health-and-fitness/guides/health-connect/develop/aggregate-data
- Expo Pedometer limitations: https://docs.expo.dev/versions/latest/sdk/pedometer/
- Apple Core Motion: https://developer.apple.com/documentation/coremotion/cmpedometer
- Apple HealthKit authorization: https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data
- Apple review guidelines 5.1.3: https://developer.apple.com/app-store/review/guidelines/
- Google health declaration: https://support.google.com/googleplay/android-developer/answer/14738291
- PocketBase compatibility warning: https://pocketbase.io/docs/
- PocketBase deployment/backup guidance: https://pocketbase.io/docs/going-to-production/

Retrieval used direct HTTPS after the configured web extractor reported it was search-only. No mobile code, plugin code or deployment was implemented or tested in this planning request.
