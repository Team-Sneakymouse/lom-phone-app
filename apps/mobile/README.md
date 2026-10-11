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
2. **Home** — `Welcome, {name}` from Mojang/PlayerDB (cached; refreshed on focus/startup). Menu includes Job Board.
3. **Settings** — unlink revokes the server device link and clears the local session.

Each install keeps a `deviceId` + `deviceSecret` in SecureStore. Redeem calls `POST /api/lom/phone/redeem`; later calls authenticate with those credentials and the server resolves the Minecraft UUID.

## Panorama

Titlescreen cube faces come from the Modrinth pack **Lords of Minecraft Titlescreen.zip**
(`assets/panorama/panorama_0.png`…`5.png`, plus `panorama_strip.png` for the yaw pan).
