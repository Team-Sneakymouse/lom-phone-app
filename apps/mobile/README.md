# LoM Phone (mobile)

Expo Router + TypeScript companion app for Lords of Minecraft.

## Run (web)

```bash
cd apps/mobile
npm install
npm run web          # UI pass (no health / push / SecureStore native)
```

## Android emulator (dev client)

Health Connect, notifications, and SecureStore need a **native development build** — not Expo Go.

### One-time host setup (Linux)

1. **Android Studio** (or SDK + cmdline-tools) with:
   - Platform-Tools (`adb`)
   - Android SDK Platform **36**
   - Build-Tools **36.x**
   - Emulator + a system image (e.g. `system-images;android-36;google_apis;x86_64`)
2. **JDK 17** for Gradle (system Java 21/25 breaks native CMake configures):
   ```bash
   # e.g. Debian/Ubuntu
   sudo apt install openjdk-17-jdk
   ```
3. Shell env (e.g. `~/.bashrc`):
   ```bash
   export ANDROID_HOME="$HOME/Android/Sdk"
   export ANDROID_SDK_ROOT="$ANDROID_HOME"
   export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
   export PATH="$JAVA_HOME/bin:$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin"
   ```
4. Create an AVD (Device Manager in Studio, or CLI):
   ```bash
   sdkmanager --install "system-images;android-36;google_apis;x86_64"
   echo no | avdmanager create avd \
     --name Pixel_8_API_36 \
     --package 'system-images;android-36;google_apis;x86_64' \
     --device pixel_8 \
     --force
   ```
5. From `apps/mobile`, generate native project once (already gitignored under `android/`):
   ```bash
   npx expo prebuild --platform android
   ```

### Start the emulator

```bash
source ~/.bashrc
# Software GPU is more reliable on some Linux hosts / headless sessions:
emulator -avd Pixel_8_API_36 -gpu swiftshader_indirect -no-snapshot-load &
adb wait-for-device
# Wait until boot finishes:
adb shell getprop sys.boot_completed   # expect: 1
adb reverse tcp:8081 tcp:8081          # Metro via emulator localhost
```

### Build, install, and run Metro

Use **two terminals** (or one `expo run:android` that starts Metro itself).

```bash
cd apps/mobile
source ~/.bashrc
npm install

# Terminal A — JS bundler (keep this running)
npx expo start --port 8081

# Terminal B — native install (x86_64 only is faster for the emulator)
ORG_GRADLE_PROJECT_reactNativeArchitectures=x86_64 \
  npx expo run:android -d Pixel_8_API_36 --no-bundler
```

Or one shot (build + Metro):

```bash
ORG_GRADLE_PROJECT_reactNativeArchitectures=x86_64 \
  npx expo run:android -d Pixel_8_API_36
```

After install, the app should load JS from Metro. If you see **Unable to load script**, Metro is not reachable:

```bash
adb reverse tcp:8081 tcp:8081
# Emulator → host loopback:
adb shell am start -a android.intent.action.VIEW \
  -d 'lomphone://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8081' \
  tv.rawb.lomphone
```

Reload JS: shake device → **Reload**, or press `r` in the Metro terminal.

### Common pitfalls

| Symptom | Fix |
|---|---|
| `spawn adb ENOENT` / no SDK | Install SDK; set `ANDROID_HOME` |
| Gradle / CMake “restricted method in java.lang.System” | Use **JDK 17** (`JAVA_HOME`), not 25 |
| No device / emulator | Create AVD; start `emulator -avd …` before `run:android` |
| Unable to load script | Start Metro; `adb reverse tcp:8081 tcp:8081`; open via `10.0.2.2:8081` |
| Cannot find native module `ExpoCrypto` (or similar) | Native binary outdated vs JS deps — rebuild with `expo run:android`, or avoid that native module in JS until rebuilt |
| Adding Expo native modules | Always rebuild the dev client after `npx expo install <native-module>` |

Step sync uses **Android Health Connect** and **iOS HealthKit + Core Motion**. Rebuild the native app after changing those plugins in `app.json`.

## iOS

```bash
npm run ios   # macOS + simulator / device; native rebuild required
```

## Flow

1. **Welcome** — brand splash, link-code field (10-char Crockford from `/lomphone link`).
2. **Home** — `Welcome, {name}` from Mojang/PlayerDB (cached; refreshed on focus/startup). Menu: Job Board, Steps.
3. **Steps** — steps today, last sync time, Sync now, health-link status, Connect / Open health settings. Lifetime accepted total is shown as secondary.
4. **Settings** — unlink revokes the server device link and clears the local session.

Each install keeps a `deviceId` + `deviceSecret` in SecureStore. Redeem calls `POST /lom/phone/redeem`; later calls authenticate with those credentials and the server resolves the Minecraft UUID.

## Panorama

Titlescreen cube faces come from the Modrinth pack **Lords of Minecraft Titlescreen.zip**
(`assets/panorama/panorama_0.png`…`5.png`, plus `panorama_strip.png` for the yaw pan).
