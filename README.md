# LoM Phone App

A location-free companion for **Lords of Minecraft**, with a Paper-to-PocketBase bridge.

## Status

The **Paper bridge** is implemented (Kotlin, EmptyPlugin-shaped). The **Expo phone app** lives in [`apps/mobile`](apps/mobile) (welcome/link, Job Board, home/settings). Device linking redeems Crockford codes via PocketBase hooks into `phone_device_links` (see [docs/pocketbase-schema.md](docs/pocketbase-schema.md)). There is no integration worker or reward logic yet.

- `/lomphone link`: private secrecy warning, then clickable confirmation. Its random nonce is bound to the player/current warning, expires after 60 seconds, and cannot be replayed. Console and denied players cannot issue codes.
- Confirmation creates a short-lived **10-character Crockford** code (~50 bits) via SneakyPocketbase. Only SHA-256 digest, UUID and timestamps go into `phone_link_codes`. The raw code is privately shown only after persistence succeeds; this plugin never logs it.
- `%lomphone_steps%`: cache-only, nonblocking accepted totals from `phone_player_steps`. **`unknown` is not zero**: missing, malformed, duplicate, loading, stale and unavailable values return `unknown`; a valid numeric zero returns `0`.
- Bounded UUID-filtered online-player polling, main-thread result application, generation/session guards and shutdown cleanup. No global scans, subscriptions, own auth/client, mobile redemption or rewards.

Tests use the genuine manager interface with a fake network boundary: **not live PocketBase or in-game verification**. See [verification checklist](docs/bridge-verification.md).

## Build

Requirements: **JDK 25**, outbound HTTPS to Maven repositories (including `https://maven.sneakyrp.com/releases/`) and Gradle distributions. No system Gradle, private artifact, manager implementation build or credentials are needed.

```sh
export JAVA_HOME=/path/to/jdk-25
export PATH="$JAVA_HOME/bin:$PATH"
./gradlew check
./gradlew runServer --dry-run
```

Windows: set `JAVA_HOME` and use `gradlew.bat`.

Version: `yyyy.MM.dd-<12-char-git-hash>` (from `HEAD`). Artifact: `build/libs/lom-phone-bridge-<version>.jar`.
Maven coordinates: `io.github.team-sneakymouse:lom-phone-bridge:<version>`.
Test report: `build/reports/tests/test/index.html`.
Agent policy: [AGENTS.md](AGENTS.md).

Pins:
- Kotlin **2.3.21**, Java **25** toolchain (stdlib shaded into the JAR).
- Paper API/server **26.2 build 132** (`26.2.build.132-stable`).
- Gradle wrapper **9.7.0**, distribution SHA-256 verified.
- `xyz.jpenilla.run-paper` **3.1.0**.
- PlaceholderAPI compile/test seam **2.11.6**, optional at runtime.
- SneakyPocketbase API **`io.github.team-sneakymouse:sneakypocketbase-api:2026.10.09-0233c4a041d5`**, from `https://maven.sneakyrp.com/releases/`.

The published manager API is a **compile-only** dependency and is also available on the test classpath. Manager, PAPI and Gson classes are **excluded from the plugin JAR**; kotlin-stdlib is shaded. Deploy the matching SneakyPocketbase runtime plugin; the API JAR alone is not a runtime plugin.

`./gradlew check` runs tests, artifact boundary checks, `validateRunServer`, and `publishPreflight`. CI does not start Minecraft or contact PocketBase.

## Operator setup (not performed here)

1. Use Paper 26.2 build 132 on Java 25 in an isolated test environment.
2. Install the matching **runtime** SneakyPocketbase plugin for API version `2026.10.09-0233c4a041d5`. Configure its credentials privately per its README; this bridge contains no credentials or authentication implementation.
3. Review [private schema contracts](docs/pocketbase-schema.md). **The bridge does not create collections or run migrations.** Missing collections fail generically or return `unknown`, never raw server errors.
4. Install `lom-phone-bridge-<version>.jar` in `plugins/` (or rely on `./gradlew runServer`, which includes this JAR). Install PlaceholderAPI if placeholders are wanted. Paper metadata requires SneakyPocketbase to load BEFORE and joins its classpath; PAPI is optional and joined when present.
5. Start once to generate `plugins/LoMPhoneBridge/config.yml`, stop, adjust if necessary, then restart. No reload command is provided.
6. As a player with `lomphone.link` (default true), use `/lomphone link`, then click `[Confirm]`. Keep the code secret. With PAPI, use `/papi parse me %lomphone_steps%` after the first player-specific fetch applies.

| Configuration | Default | Allowed |
|---|---|---|
| `collections.link-codes` | `phone_link_codes` | Letter then up to 63 letters/digits/underscores |
| `collections.player-steps` | `phone_player_steps` | Same identifier constraint |
| `code-ttl-seconds` | 300 | 30–900 |
| `refresh-seconds` | 30 | 5–300 |
| `stale-seconds` | 90 | At least refresh; at most 900 |
| `max-concurrent-requests` | 8 | 1–64; separate read/write limits |

Invalid configuration disables the bridge with a generic message. At most one write per player is in flight. No write is automatically retried: **a failed write may already have committed**. A later explicit confirmation creates a new code, not a replay of the uncertain operation.

### Local runServer

`runServer` is a real run-paper task pinned to Paper 26.2 build 132 and Java 25, and includes this plugin JAR. For operator-run disposable checks:

- Default run directory is `~/.cache/lom-phone-bridge/run` (native filesystem). Paper 26.2 world COW breaks on NTFS/FUSE mounts such as `/mnt/files`. Override with `LOM_PHONE_RUN_DIR=/path`.
- Put the genuine manager runtime and optional PAPI JARs in that run directory’s `plugins/`; configure the manager for a disposable backend only.
- Review and accept Mojang's EULA yourself in `eula.txt` if you agree.
- Run `./gradlew runServer`, then stop normally. Never point the run directory at production.

**Implementation verification ran only `validateRunServer` and `runServer --dry-run`; no Minecraft server was started.** Actual classloading, click rendering, backend rules and outages still require the checklist.

## Recovery and data semantics

Polling directly reads atomic lifecycle snapshots and global API availability. HTTP polling does not require realtime/collection subscription readiness. No async lifecycle/record events require revision reconciliation; `whenReady` is not used as a recurring recovery signal. Request generation/identity are checked again at main-thread application. A changed generation bypasses the refresh delay, while outstanding old requests remain counted until they finish. Manager timeout/failure semantics govern network work; the bridge never waits for it.

A rotating one-second online-player sweep admits bounded requests. Each UUID has a refresh delay including after failed/missing/invalid reads. Cached totals conservatively use request-start time, become logically invalid immediately on API unavailability/generation change, and turn `unknown` at the stale bound. Logout clears warning/cache/session state, preventing late results from applying to a later session. Disable drops queued results and unregisters PAPI.

Steps must be one numeric nonnegative integer per canonical UUID, at most `9007199254740991` (JSON/JavaScript safe integer). Fractions, stringified numbers, negatives, out-of-range values, duplicates and mismatched UUIDs fail closed. Synthetic/accessibility progress must not masquerade as walking steps; support it separately without disability disclosure.

## Direction and security

- Mobile proposed: React Native + TypeScript + Expo development builds.
- Backend: existing TypeScript/JavaScript PocketBase hooks; future redemption must enforce expiry, atomic single-use, authenticated ownership and rate limits.
- Coordination proposed: a private integration worker.

No GPS is required for steps. Health APIs/privacy/publishing still need real-device review. The phone is untrusted: never give it superuser credentials or a shared privileged key. Existing Minecraft systems own gameplay and rewards.

## Notes and design

- [Architecture](docs/architecture.md)
- [Collection contracts](docs/pocketbase-schema.md)
- [Verification checklist](docs/bridge-verification.md)
- [Original delivery plan](docs/notes/initial-architecture-plan.md) — historical and untouched; later decisions supersede its Go-hook recommendation.

Eggs, saved scrys, jobs, notifications, Dynmap, defense timers and markets remain future ideas. Real-world stops/gyms are a separate GPS/privacy/accessibility decision.

## Contributing

Use scoped branches/PRs. Add regression tests before behavior changes; run build/tests and distinguish automated from in-game verification. Never commit credentials, private codes or player activity. No production migrations/deployment without approval.

## License

[GNU General Public License v3.0](LICENSE).
