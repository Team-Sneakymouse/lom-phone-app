# LoM Phone App

A location-free phone companion for **Lords of Minecraft**, with a Paper-to-PocketBase bridge.

## Status

Early development. This repository captures the community design and starts the Minecraft integration. **There is no released mobile app yet.**

The first bridge milestone is:

1. Warn players to keep their linking code private.
2. Generate and save a short-lived code only after clickable confirmation.
3. Read accepted step totals from PocketBase and expose them through PlaceholderAPI.
4. Use the existing SneakyPocketbase utility for authentication and asynchronous access.

Build/setup instructions and collection contracts will live with the Paper plugin once implemented. No live backend migrations, merging or production deployment are implied by this repository.

## Direction

- **Mobile (proposed):** React Native + TypeScript + Expo development builds.
- **Backend:** the community's existing TypeScript/JavaScript PocketBase hooks.
- **Minecraft:** Paper **26.2**, using [SneakyPocketbase](https://github.com/Team-Sneakymouse/SneakyPocketbase).
- **Coordination (proposed):** a private integration worker for durable cross-service workflows.

No GPS is required for step-based progress. Non-walking participation should be available without disclosing a disability. Platform health APIs and store/privacy policies still need real-device and publishing review.

## Security principles

The phone is an untrusted client. It receives limited player/device credentials, never embedded superuser credentials or a shared privileged private key. Backend routes enforce ownership, caps, active links and idempotency. The client reports activity; the backend calculates accepted progress and rewards.

Minecraft gameplay remains owned by the existing game systems. Network access must never block the Minecraft main thread or placeholder rendering.

## Notes and design

- [Current architecture and decisions](docs/architecture.md)
- [Original brainstorming and delivery plan](docs/notes/initial-architecture-plan.md) — historical; later decisions supersede its Go-hook recommendation.

Future ideas include eggs, saved scrys, a job board, optional notifications, Dynmap, defense timers and market monitoring. These are not all part of the initial bridge. Real-world stops/gyms are a separate GPS/privacy/accessibility decision.

## Contributing

Use scoped feature branches and pull requests. Add regression tests before changing behavior, run the relevant build/tests and distinguish automated verification from actual in-game checks. Do not commit credentials, private linking codes or player activity data. Do not migrate or deploy to production without explicit approval.

## License

[GNU General Public License v3.0](LICENSE).
