# LoM Phone (mobile)

Expo Router + TypeScript companion app for Lords of Minecraft.

## Run

```bash
cd apps/mobile
npm install
npm run web          # quick UI pass
npm run android      # device / emulator
npm run ios          # macOS + simulator / device
```

## Flow

1. **Welcome** — brand splash, link-code field (10-char Crockford from `/lomphone link`).
2. **Home** — `Welcome, {name}` from Mojang (cached locally; refreshed on focus/startup).
3. **Settings** (bottom of home) — unlink clears secure session + name cache.

Redeem is **stubbed** until PocketBase hooks exist: any valid Crockford code links `EXPO_PUBLIC_DEMO_UUID`.

## Panorama

Titlescreen cube faces come from the Modrinth pack **Lords of Minecraft Titlescreen.zip**
(`assets/panorama/panorama_0.png`…`5.png`, plus `panorama_strip.png` for the yaw pan).
