# Agent instructions (LoM Phone / Team Sneakymouse)

Companion product repo for the Lords of Minecraft phone experience. Today this checkout is the **Paper bridge** (`lom-phone-bridge`). A future mobile app may live under `apps/mobile/` — do not put Expo/React Native under the plugin `src/` tree.

## Commands

| Task | Command |
|------|---------|
| Build + unit tests + preflight | `./gradlew check` |
| Publish preflight only | `./gradlew publishPreflight` or `bash scripts/publish-preflight.sh` |
| Unit tests only | `./gradlew test` |
| Local Paper server | `./gradlew runServer` (data in `~/.cache/lom-phone-bridge/run`; put SneakyPocketbase in its `plugins/`) |
| Publish (CI) | `./gradlew publishMavenPublicationToSneakyrpRepository` |

Builds require a **git checkout** with at least one commit (version is derived from `HEAD`).

## Architecture (keep the bridge testable)

```text
src/main/kotlin/com/lomphone/
  LoMPhonePlugin.kt     # Bootstrap only: config, commands, listeners, PAPI, polling
  service/              # Bridge, LinkFlow — no org.bukkit imports
  command/              # PhoneCommand — parse args, call services, reply models
  expansion/            # PlaceholderAPI adapter (optional runtime)
src/test/kotlin/com/lomphone/   # Mirror packages; *Test.kt next to the unit
docs/                   # Schema + architecture contracts (PocketBase collections)
```

Guidelines:

- **Business logic** belongs in `service/`, not in listeners or command `execute` bodies beyond routing.
- Prefer constructor parameters over static singletons so tests stay simple.
- Classes loaded by MockBukkit (plugin) must be **`open`**.
- Do not embed PocketBase credentials in the plugin or a future mobile client. Schema design credentials may live in gitignored `.env.local` for operators/agents only.
- Collection contracts: [docs/pocketbase-schema.md](docs/pocketbase-schema.md). The bridge does not migrate production.

## Testing policy (required)

1. If you change behavior under `src/main/`, **add or update** tests under `src/test/` in the same change.
2. Run **`./gradlew check`** and fix failures before finishing the task.
3. Do not rely on `./gradlew runServer` as the only verification for logic changes.

| Kind of code | Approach |
|--------------|----------|
| `service/` (no Bukkit) | Plain **JUnit 5** + `FakeApi` |
| Plugin enable/disable | **MockBukkit** (`mockbukkit-v26.2`) with reflected `PocketbaseProvider.install` |
| Full gameplay / live PB | Manual **`runServer`** smoke tests |

## Mobile app (`apps/mobile`)

- Expo Router + TypeScript. Commands: `cd apps/mobile && npm start` (see `apps/mobile/README.md`).
- Device link: `phone_device_links` + hooks in Team-Sneakymouse/pocketbase (`/lom/phone/*`). App auth is device id/secret; UUID is resolved server-side.
- Never ship superuser credentials or shared privileged keys to the phone.
- Shared contracts belong in `docs/`, not duplicated ad hoc in client code.
- Player display names: Mojang/PlayerDB + AsyncStorage cache; link session in SecureStore.

## Definition of done

- [ ] Behavior covered or updated in `src/test/`
- [ ] `./gradlew check` passes locally
- [ ] No secrets committed (Maven credentials via env / Infisical only; PocketBase via `.env.local`)
- [ ] `paper-plugin.yml` and POM metadata updated if plugin identity changed

## Human docs

- `README.md` — product status, operator setup, build pins
