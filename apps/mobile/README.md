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

## Physical Android phone (wireless debugging)

Use this for Health Connect / step-sensor testing on a real device (e.g. Realme) without a data USB cable. The phone and the Linux host must be on the **same LAN**.

### One-time / each session on the phone

1. Enable **Developer options** (tap Build number 7× in About phone).
2. Enable **USB debugging** and **Wireless debugging**.
3. Optional but helpful for long builds: turn off or raise **auto screen-off** so wireless debugging does not drop when the screen sleeps.
4. Open **Wireless debugging** → note **IP address & port** (pairing and connect ports are often different).
5. If this PC has never paired: **Pair device with pairing code** → note the pairing IP:port and 6-digit code.

### Pair and connect (host)

```bash
source ~/.bashrc   # ANDROID_HOME + platform-tools on PATH
adb pair <PHONE_IP>:<PAIRING_PORT>
# enter the 6-digit code when prompted
adb connect <PHONE_IP>:<CONNECT_PORT>
adb devices -l
# expect: <PHONE_IP>:<port>  device  model:…  (and often a second mdns transport)
```

Wireless debug **ports change** when you toggle Wireless debugging or after some reconnects. If `adb connect` fails with “Connection refused”, open Wireless debugging again and use the new connect port (re-pair only if pairing was forgotten).

### Metro over wireless (important)

Many LANs/firewalls block the phone from reaching the PC’s `192.168.x.x:8081` directly. Prefer **adb reverse** + localhost:

```bash
SERIAL=<PHONE_IP>:<CONNECT_PORT>   # from `adb devices`
adb -s "$SERIAL" reverse tcp:8081 tcp:8081

cd apps/mobile
# Terminal A
REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1 npx expo start --port 8081

# Terminal B — arm64 for physical phones
ORG_GRADLE_PROJECT_reactNativeArchitectures=arm64-v8a \
  npx expo run:android -d <MODEL_NAME> --no-bundler
# Expo device picker uses the model name (e.g. RMX2144), not the IP.
```

Point the already-installed dev client at Metro:

```bash
adb -s "$SERIAL" reverse tcp:8081 tcp:8081
adb -s "$SERIAL" shell am force-stop tv.rawb.lomphone
adb -s "$SERIAL" shell am start -a android.intent.action.VIEW \
  -d 'lomphone://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081' \
  tv.rawb.lomphone
```

If the app sticks on the splash screen, Metro is usually unreachable: check `adb devices`, re-run `adb reverse`, and reopen via the `127.0.0.1:8081` URL above.

### Common pitfalls (wireless)

| Symptom | Fix |
|---|---|
| `adb connect … Connection refused` | Wireless debugging port rotated — copy the new port from the phone |
| Device disappears mid-build | Keep screen on / disable auto screen-off; reconnect |
| Splash forever / Unable to load script | `adb reverse tcp:8081 tcp:8081` + open Metro as `127.0.0.1:8081` (not the host LAN IP) |
| `expo run:android -d 192.168.…` fails | Use the **model** name from `adb devices -l` (e.g. `-d RMX2144`) |
| Slow/multi-ABI Gradle on phone | Force `ORG_GRADLE_PROJECT_reactNativeArchitectures=arm64-v8a` |

### Common pitfalls

| Symptom | Fix |
|---|---|
| `spawn adb ENOENT` / no SDK | Install SDK; set `ANDROID_HOME` |
| Gradle / CMake “restricted method in java.lang.System” | Use **JDK 17** (`JAVA_HOME`), not 25 |
| No device / emulator | Create AVD; start `emulator -avd …` before `run:android` |
| Unable to load script | Start Metro; `adb reverse tcp:8081 tcp:8081`; open via `10.0.2.2:8081` |
| Cannot find native module `ExpoCrypto` (or similar) | Native binary outdated vs JS deps — rebuild with `expo run:android`, or avoid that native module in JS until rebuilt |
| Adding Expo native modules | Always rebuild the dev client after `npx expo install <native-module>` |
| Health link “unavailable” on emulator | Expected — use a **physical phone**. |
| Step source / Health Connect issues | Android defaults to the **phone step sensor** (Physical activity permission). **Use Health Connect** is opt-in when another app already writes Steps there. |
| Health Connect “no compatible apps” | Only if HC mode is on: declare `android.permission.health.READ_STEPS`, rebuild, tap **Connect health**. |
| Sensor mode but steps today stay 0 | Walk with the phone; grant Physical activity; baseline starts at the first sensor read after install/reboot. |
| Firebase / `googleServicesFile` when enabling push | Android Expo push needs FCM — see **Push (FCM)** below. |

Step sync uses the **Android step counter** by default (optional Health Connect), and **iOS HealthKit + Core Motion**. Rebuild after adding `android-step-counter` or changing health plugins.

## Push (FCM)

Android push tokens require Firebase Cloud Messaging:

1. Create a Firebase project → add Android app with package `tv.rawb.lomphone`.
2. Download `google-services.json` into `apps/mobile/` (or `apps/mobile/google-services.json`).
3. In `app.json` set `"android": { "googleServicesFile": "./google-services.json", ... }`.
4. Set a real EAS `extra.eas.projectId` (or run `eas init`) for Expo push.
5. For Expo’s push service delivery: upload an FCM V1 service-account key via `eas credentials` ([Expo FCM docs](https://docs.expo.dev/push-notifications/fcm-credentials/)).
6. Rebuild the native app (`npx expo run:android`).

Until that file is wired, the Settings toggle will explain that Firebase is missing instead of a raw SDK stack trace.

## iOS

```bash
npm run ios   # macOS + simulator / device; native rebuild required
```

## Flow

1. **Welcome** — brand splash, link-code field (10-char Crockford from `/lomphone link`).
2. **Home** — `Welcome, {name}` from Mojang/PlayerDB (cached; refreshed on focus/startup). Menu: Job Board, Steps.
3. **Steps** — steps today, last sync time, Sync now, step source (Android phone sensor by default; optional Health Connect). Lifetime accepted total is shown as secondary.
4. **Settings** — unlink revokes the server device link and clears the local session.

Each install keeps a `deviceId` + `deviceSecret` in SecureStore. Redeem calls `POST /lom/phone/redeem`; later calls authenticate with those credentials and the server resolves the Minecraft UUID.

## Panorama

Titlescreen cube faces come from the Modrinth pack **Lords of Minecraft Titlescreen.zip**
(`assets/panorama/panorama_0.png`…`5.png`, plus `panorama_strip.png` for the yaw pan).
