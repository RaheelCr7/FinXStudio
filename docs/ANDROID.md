# Android app: build, install, connect

The app is one Expo (React Native) codebase. This page covers the Android APK. It builds **on this computer**: no Expo account, no cloud service.

| You get | Signed with | For |
|---|---|---|
| `uat` APK (default) | the standard Android **debug key** | testers, bank demos, sideloading |
| `production` APK or `.aab` | **your own upload key** (you provide it, see below) | the Play Store |

A UAT build lets the person change which Studio the app talks to, and allows plain `http://` so it can reach a Studio on a laptop. A production build does neither.

## What you need once

- **JDK 17 or newer** (for example Amazon Corretto 17).
- **Android SDK** with its licences accepted (`~/Library/Android/sdk` on a Mac, or set `ANDROID_HOME`). The build downloads the platform, build tools and NDK it needs.
- **About 8 GB of free disk space** for the first build. Measured on the first build: Gradle's cache 3.9 GB, the NDK 2.4 GB, build tools and platform about 1 GB, the generated project 0.4 GB. Later builds need about 1 GB. The script stops early if less than 4 GB is free.
- Node 20+ and `pnpm install` done.

## Build

```bash
pnpm android:apk                                   # from the repo root
pnpm --filter @finx/bank-app build:android --studio-url http://192.168.1.20:3100 --install
```

| Option | Default | Meaning |
|---|---|---|
| `--env uat\|production` | `uat` | `uat`: server can be changed in the app, plain http allowed. `production`: neither |
| `--studio-url <url>` | `http://10.0.2.2:3100` | The Studio address the app starts with. `10.0.2.2` is how an emulator reaches your computer |
| `--abis <list>` | `arm64-v8a` | CPU types. Phones and Apple Silicon emulators are arm64. Add `x86_64` for Intel emulators |
| `--version-code <n>` | `1` | Must go up with every store upload |
| `--aab` | off | Also build the Play Store bundle |
| `--clean` | off | Regenerate the native project from scratch |
| `--install` | off | Install on the connected phone or emulator when done |

The script checks the toolchain, generates the native project (`expo prebuild`), builds with Gradle, copies the result to `apps/bank-app/dist/`, and verifies it: signature, package name, version, CPU types, permissions, SHA-256. The full log is in `apps/bank-app/dist/build-android.log`.

How long it takes, measured on an Apple M5 with 16 GB of memory:

| Build | Time |
|---|---|
| First build (downloads the NDK and Gradle dependencies) | 14 min 47 s |
| Next build after an app change | about 1 min 15 s |

The APK is about 20 MB for one CPU type.

`apps/bank-app/android/` is **generated** from `app.json`, `app.config.ts` and the assets, and is not committed. Change the configuration, not the generated files.

## Install

- **Phone:** copy the APK to it (or open it from a download link), allow installing from that source, and open it. Or with USB debugging on: `adb install -r apps/bank-app/dist/<file>.apk`.
- **Emulator** (no Android Studio needed): 

  ```bash
  node apps/bank-app/scripts/android-emulator.mjs start      # creates a virtual phone the first time
  node apps/bank-app/scripts/android-emulator.mjs install apps/bank-app/dist/<file>.apk
  node apps/bank-app/scripts/android-emulator.mjs launch
  node apps/bank-app/scripts/android-emulator.mjs shot screen.png
  ```

  Add `--window` to `start` to see the emulator on screen. The same helper can drive the app for a quick check: `ui` lists what is on screen, `wait "Log in"` waits for a label, `tap "Log in"` presses it, `type`, `key back`, `swipe`, and `logs` shows crashes and JavaScript errors. `stop` shuts the emulator down.

### Getting the APK onto a tester's phone

- **Same Wi-Fi:** serve the folder from your Mac and open the link on the phone: `cd apps/bank-app/dist && python3 -m http.server 8000`, then browse to `http://<your-mac-address>:8000/<file>.apk` on the phone. Stop the server afterwards.
- **USB cable:** with USB debugging on, `adb install -r <file>.apk`. Without it, copy the file over with Android File Transfer.
- **Anywhere else:** upload the APK to a file-sharing service your bank approves and send the link. Check the SHA-256 the build printed against the downloaded file.

Android asks the tester to allow installing from that source and may warn that the app is from an unknown developer. That is expected for a UAT build outside the Play Store.

## Connect the app to Studio

The app loads published journeys from Studio over the air.

- **Emulator:** the default `http://10.0.2.2:3100` reaches Studio on the same computer. Nothing to do.
- **A phone on the same Wi-Fi:** run Studio so it listens on the network, `cd apps/studio && pnpm dev:lan`, then in the app's login screen press **Change** under *Studio server*, enter `192.168.1.20:3100` (your computer's address), and press **Test and save**. The app checks that it really is a FinX Studio before saving. Or bake the address in with `--studio-url`.
- **Studio is on the internet (HTTPS):** use the same setting, or build a production app with `--studio-url https://...`.

Studio's `pnpm dev` listens on this computer only; `pnpm dev:lan` opens it to your network. Use it only on a network you trust: Studio has no sign-in yet.

## Signing for the Play Store

A UAT APK is signed with the public debug key, so anyone can build an APK that updates it. That is fine for testing and wrong for customers. For a store release:

1. Create an upload key once and keep it safe (never commit it; `*.jks` is ignored): `keytool -genkeypair -v -storetype PKCS12 -keystore finx-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`
2. Build a production bundle: `pnpm --filter @finx/bank-app build:android --env production --aab --version-code <n> --studio-url https://studio.yourbank.example`
3. Sign it with your upload key (Gradle signing config, or an EAS cloud build, which manages the key for you) and upload it to the Play Console.

Wiring the upload key into the Gradle build is not automated yet.

## Branding

`pnpm --filter @finx/bank-app brand-assets` regenerates the icon set (launcher, adaptive, themed, splash, favicon) from one colour: `python3 scripts/generate-brand-assets.py --accent "#0F6E56"` (needs Pillow). Each bank gets its own icons from its accent colour.

## What the APK asks for

| | UAT build | Production build |
|---|---|---|
| Permissions | Internet and vibration only | the same |
| Android backup of app data | off | off |
| Plain `http://` to Studio | allowed, to reach a laptop | blocked, HTTPS only |
| Studio server can be changed in the app | yes | no |
| Signed with | the public debug key | your upload key |

The overlay ("draw over other apps") and old storage permissions that the Expo template adds are removed in `app.json`. The build summary lists the permissions of every APK, so a change shows up at once.

## Check a build

Run these on a phone or the emulator after each build that goes to testers. The last full pass was on 2 November 2026, on an Android 14 emulator (arm64, Pixel 7 size), and everything passed.

1. The app opens on the sign-in screen with the bank's icon, and nothing sits under the status bar or the gesture bar.
2. Log in. Home shows *Live from Studio* with the published journeys and the Studio address.
3. Send to beneficiary: pick an account and a beneficiary, type an amount (the Continue button stays above the keyboard), confirm, enter a wrong code (*Incorrect code*), then the right one (Ayesha's sandbox code is 482100). The receipt shows a reference, and home shows the new balance and daily limit used.
4. Android's back key steps back through a journey and closes it from the first screen. With the keyboard open, it closes the keyboard first.
5. اردو switches to Urdu, right to left, in the shell and in journeys.
6. Studio server: an address that does not answer shows a clear message and keeps the old one. The right address, even without `http://`, says *Connected*.
7. With the network off, home shows *Offline copies* and the bundled journeys still run.
8. Dark mode and a large system font (Settings, Display) still read well.

Not covered yet: a physical phone, Android versions other than 14 (the app supports Android 7.0 and newer), a full TalkBack pass, and a production-signed build.

## What is and is not in the app

The APK contains the app shell, the journey engine and the sandbox bank. Journeys come from Studio, with the bundled ones as an offline fallback. All banking calls go to the in-app **sandbox**; no real money moves. A real core banking connection comes later behind the same adapter contract.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "JDK 17 or newer was not found" | Install one, or set `JAVA_HOME` |
| "licences have not been accepted" | Accept them yourself: `sdkmanager --licenses`, or the SDK Manager in Android Studio |
| "No space left on device" | Free space. Gradle's cache is `~/.gradle` |
| A download fails | Check the network and run again. Finished downloads are kept |
| The app says *Offline copies* | It cannot reach Studio. Check the address under *Studio server* and that Studio is running (`pnpm dev` for an emulator, `pnpm dev:lan` for a phone) |
| Odd build errors after changing config | Run again with `--clean` |
