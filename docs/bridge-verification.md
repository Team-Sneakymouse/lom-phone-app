# Bridge verification

## Automated checks

Run with JDK 25:

```sh
./gradlew clean build
./gradlew validateRunServer
./gradlew runServer --dry-run
```

The implementation's local clean build executed **30 JUnit tests, zero failures/errors/skips**, using real Paper/PAPI classes and the genuine pinned `PocketbaseApi` interface with a fake network boundary. The HTML/XML reports are in `build/reports/tests/test/` and `build/test-results/test/`.

Coverage:
- Warning before issuance, sender permission/player checks, player-bound nonce, current-warning replacement, 60-second expiry, replay and logout invalidation.
- No raw code before successful persistence; SHA-256 exactly matches the displayed 10-character Crockford secret; creation/expiry timestamps match the configured TTL.
- In-flight write suppression, global read/write limits, sanitized synchronous/asynchronous failures, no automatic write retry, generation/readiness loss, delayed expiry and disable suppression.
- UUID-filtered reads, numeric zero, malformed/stringified/noninteger/negative/unsafe values, duplicate/mismatched records, stale cache, recovery generation, older completion ordering, and logout/rejoin ordering.
- Cache-only PAPI rendering, optional expansion contract, Paper descriptor, genuine main class, and configuration bounds.
- Build-time JAR checks: no SneakyPocketbase/PAPI/Gson/Kotlin classes bundled. `validateRunServer` verifies Java 25 and Paper 26.2 build 132. Dry-run verifies the task graph without starting Minecraft.

Core behavior was implemented in successive RED→GREEN slices, rather than a test pile followed by implementation. Actual observed RED examples included:

```text
LinkFlowTest > expiredOrReplacedWarningCannotConfirm() FAILED
BridgeTest > codeOnlyDisplayedAfterPersistenceAndOnlyDigestStored() FAILED
BridgeTest > failedWritesNeverRevealCodeOrRetry() FAILED
BridgeTest > oldGenerationWriteCannotRevealCodeAfterScheduledCompletion() FAILED
BridgeTest > stepsAreFetchedByUuidAndPlaceholdersNeverWaitForNetwork() FAILED
BridgeTest > malformedNegativeFractionalAndDuplicateStepsAreUnknown() FAILED
BridgeTest > oldReadCompletingAfterNewGenerationDoesNotOverwriteRecovery() FAILED
PhoneCommandTest > linkWarnsPrivatelyAndClickAloneCanPersist() FAILED
```

Each was followed by an executed passing suite before the next behavior was added. Initial missing-class/API-skeleton compilation probes were not treated as behavioral success. Config/entrypoint/PAPI contracts also had executed failures before implementation. Compilation and these fakes do **not** prove live manager classloader integration, PocketBase rule enforcement, server command registration or chat rendering. CI has been authored but has not run remotely.

## In-game/disposable-backend checklist (not performed)

Do not use production credentials/backend. An operator must provision the proposed private schema separately and install the genuine SneakyPocketbase runtime JAR plus optional PAPI.

- [ ] Paper 26.2 build 132 and Java 25 start with manager and bridge; metadata loads the required joined manager first. Missing manager cleanly prevents plugin load.
- [ ] Start without PAPI: linking still works and no PAPI linkage error occurs. With PAPI: expansion registers; unsupported parameters are ignored; `/papi parse me %lomphone_steps%` works.
- [ ] Console and permission-denied players cannot issue. `/lomphone confirm invented` without a prior warning produces no record.
- [ ] `/lomphone link` creates no record, sends no broadcast and displays a private clickable warning. Clicking creates exactly one record and privately reveals one code only after acknowledgement.
- [ ] Click twice while pending, replay, use another player's nonce, replace the warning, expire it and logout/rejoin: no unintended issuance.
- [ ] Inspect only the disposable database: digest/UUID/timestamps, no raw-code field; hash the received code locally and compare without logging/sharing it. Verify expiry bound.
- [ ] Missing collection, locked/denied request, validation error, timeout, backend outage: generic issuance failure, no code or raw exception/credentials in plugin logs. Do not infer a failed write did not commit; check disposable state privately.
- [ ] Authenticated/unauthed phone accounts cannot list/view/create/update/delete either private collection through collection CRUD.
- [ ] One accepted step record updates PAPI by the next successful interval. Zero yields `0`; missing/invalid/duplicate data yields `unknown`. Do not disable unique indexes outside a disposable corruption test.
- [ ] No placeholder render blocks or initiates a network call. Only online UUID-filtered requests occur; configured concurrency and refresh bounds hold with multiple players.
- [ ] Manager outage/reload/generation change immediately makes old cached values unusable; recovery refetches online UUIDs and does not apply old completions. HTTP polling remains independent of realtime subscription readiness.
- [ ] Logout/rejoin and disable while futures are pending cannot deliver old codes or repopulate session cache. Shutdown unregisters PAPI and cancels scheduled sweeps.
- [ ] Confirm that no mobile redemption, integration worker, rewards or synthetic/accessibility steps are implied by this milestone. Review a future atomic redemption hook separately.

No Minecraft server, live PocketBase write, collection migration, merge or deployment was performed during implementation.
