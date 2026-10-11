# LoM Phone (mobile)

Expo Router + TypeScript companion app for Lords of Minecraft.

## Run

```bash
cd apps/mobile
npm install
npm run web          # UI pass (no health / push)
npm run android      # needs a native rebuild after health plugins
npm run ios          # macOS + simulator / device; native rebuild required
```

Step sync uses **Android Health Connect** and **iOS HealthKit + Core Motion**. Those are not available in Expo Go — use a development build (`npx expo run:android` / `run:ios` or EAS).

## Flow

1. **Welcome** — brand splash, link-code field (10-char Crockford from `/lomphone link`).
2. **Home** — `Welcome, {name}` from Mojang/PlayerDB (cached; refreshed on focus/startup). Menu: Job Board, Steps.
3. **Steps** — steps today, last sync time, Sync now, health-link status, Connect / Open health settings. Lifetime accepted total is shown as secondary.
4. **Settings** — unlink revokes the server device link and clears the local session.

Each install keeps a `deviceId` + `deviceSecret` in SecureStore. Redeem calls `POST /lom/phone/redeem`; later calls authenticate with those credentials and the server resolves the Minecraft UUID.

## Panorama

Titlescreen cube faces come from the Modrinth pack **Lords of Minecraft Titlescreen.zip**
(`assets/panorama/panorama_0.png`…`5.png`, plus `panorama_strip.png` for the yaw pan).
