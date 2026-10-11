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

Android needs **three** pieces before Job Board alerts work end-to-end:

| Piece | Where | Purpose |
|---|---|---|
| `google-services.json` | `apps/mobile/google-services.json` (gitignored) | Native FCM in the APK so `getExpoPushTokenAsync` works |
| EAS `projectId` | `app.json` → `extra.eas.projectId` | Expo push token project binding |
| FCM V1 service account | Expo credentials (`eas credentials`) | Expo’s servers can deliver to Android devices |

### A. Firebase Android app + `google-services.json`

1. [Firebase Console](https://console.firebase.google.com/) → create or pick a project (e.g. Lords of Minecraft).
2. Add an **Android** app with package name **`tv.rawb.lomphone`** (same as `app.json`).
3. Download **`google-services.json`** → save as `apps/mobile/google-services.json` (see `google-services.json.example` for shape only).
4. Wire it in `app.json` under `android`:

   ```json
   "android": {
     "package": "tv.rawb.lomphone",
     "googleServicesFile": "./google-services.json",
     ...
   }
   ```

5. Rebuild the native app (`npx expo run:android` / arm64 on a phone). JS reload is not enough.

Until step 4–5 are done, Settings → Job Board alerts shows a Firebase missing message instead of a raw SDK stack trace.

### B. Expo project id

Project is **`@team-sneakymouse/lom-phone`** (`extra.eas.projectId` in `app.json`). To recreate/link elsewhere:

```bash
cd apps/mobile
npx eas-cli login          # account with access to team-sneakymouse
npx eas-cli init --account team-sneakymouse --non-interactive
```

Dev clients can lag after `eas init`; `src/push/notifications.ts` also reads `projectId` from `app.json` as a fallback.

### C. Upload FCM V1 to Expo (delivery)

`google-services.json` alone is **not** enough for Expo to deliver. You also need a **Firebase Admin SDK service account** JSON (Project settings → **Service accounts** → **Generate new private key**). Never commit that file (`*-firebase-adminsdk-*.json` is gitignored).

Upload it (either works):

- **Dashboard:** [Credentials for lom-phone](https://expo.dev/accounts/team-sneakymouse/projects/lom-phone/credentials) → Android → `tv.rawb.lomphone` → **FCM V1 service account key** → upload.
- **CLI:** `npx eas-cli credentials -p android` → production → Google Service Account → **Manage … Push Notifications (FCM V1)** → upload new key.

Without this, Expo returns `InvalidCredentials` / “Unable to retrieve the FCM server key” even though the phone has a valid `ExponentPushToken`.

PocketBase fans out via `https://exp.host/--/api/v2/push/send` on new open `lom2_listed_jobs` rows (`/lom/phone/push/*` on device register). No FCM key in the phone app or PocketBase.

### Smoke test

1. Physical phone, rebuilt APK with `google-services.json` + FCM V1 uploaded to Expo.
2. Settings → enable **New job board posts** → confirmation hint (toggle alone does **not** send a push).
3. Create an open `lom2_listed_jobs` row (or send a test via Expo Push API / [expo.dev/notifications](https://expo.dev/notifications)) → device receives a push → tap opens Job Board.

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
