# iOS app: build, install, connect

The app is one Expo (React Native) codebase. This page covers the iOS app for the **iPhone Simulator**. It builds **on this Mac**: no Expo account and no Apple developer account.

| You get | Signed with | For |
|---|---|---|
| Simulator app (`uat`, default) | nothing (the Simulator needs no signing) | demos and testing on a Mac |
| App for a real iPhone or the App Store | your Apple developer account | **not automated yet**, see the end of this page |

A UAT build lets the person change which Studio the app talks to, and allows plain `http://` so it can reach a Studio on a laptop. A production build does neither.

## What you need once

- **A Mac with Xcode** (App Store), opened once so it finishes installing, with its licence accepted and an iOS Simulator runtime (Xcode > Settings > Components).
- **CocoaPods**, which installs the native iOS libraries. On an Apple Silicon Mac use the Homebrew in `/opt/homebrew`: `/opt/homebrew/bin/brew install cocoapods`. Do not use the Intel Homebrew in `/usr/local` or the Mac's built-in Ruby: React Native warns against running CocoaPods under Rosetta, and the built-in Ruby is too old. The build script finds `pod` on your PATH or in `/opt/homebrew/bin`, so no shell profile change is needed.
- Node 20+ and `pnpm install` done.
- **About 5 GB of free disk space.** Measured on the first build: the generated project 1.4 GB (of which the build cache 0.8 GB and the native libraries 0.65 GB), CocoaPods' download cache 1.0 GB. The script stops early if less than 5 GB is free.

## Build

```bash
pnpm ios:sim                          # from the repo root: build only
pnpm ios:sim --install                # build, then install and open it on a Simulator
pnpm --filter @finx/bank-app build:ios --install --device "iPhone 17 Pro"
```

| Option | Default | Meaning |
|---|---|---|
| `--env uat\|production` | `uat` | `uat`: server can be changed in the app, plain http allowed. `production`: neither, and `--studio-url https://...` is required |
| `--studio-url <url>` | `http://localhost:3100` | The Studio address the app starts with. The Simulator reaches this Mac at `localhost` |
| `--build-number <n>` | `1` | iOS build number. Must go up with every App Store upload |
| `--clean` | off | Regenerate the native project from scratch |
| `--install` | off | Install and open on a Simulator when done |
| `--device <name\|udid>` | the booted iPhone, else the newest iPhone Pro | Which Simulator for `--install`. Simulators older than iOS 16.4 are skipped |

The script checks the toolchain, generates the native project (`expo prebuild`), installs the native libraries (`pod install`), builds a Release app with Xcode for Apple Silicon, zips it into `apps/bank-app/dist/`, and verifies it: bundle id, version, build number, minimum iOS, plain-http policy, that the JavaScript is precompiled and contains the Studio address, CPU type, SHA-256. The full log is in `apps/bank-app/dist/build-ios.log`.

How long it takes, measured on an Apple M5 with 16 GB of memory:

| Build | Time |
|---|---|
| First build (downloads the native libraries, compiles React Native) | 3 min 17 s |
| Next build after an app change | about 30 s |
| Switching between UAT and production (regenerates the project) | about 1 min |

The zipped app is about 8 MB. `apps/bank-app/ios/` is **generated** from `app.json`, `app.config.ts` and the assets, and is not committed. It is kept between builds so they stay fast, and regenerated automatically when the environment or server changes (or with `--clean`). Change the configuration, not the generated files.

## Install

- **With the script:** `pnpm ios:sim --install`. It boots the Simulator if needed, installs, and opens the app.
- **By hand:** unzip `dist/<file>.app.zip`, then `xcrun simctl install booted MeezanDigital.app` and `xcrun simctl launch booted pk.meezan.digital`.
- Screenshot: `xcrun simctl io booted screenshot screen.png`. Dark mode: `xcrun simctl ui booted appearance dark`. Text size: `xcrun simctl ui booted content_size accessibility-extra-large` (back to `large` afterwards).

## Connect the app to Studio

- **Simulator:** the default `http://localhost:3100` reaches Studio on the same Mac. Nothing to do. If a Studio is only listening on IPv4, `http://127.0.0.1:3100` works the same.
- **Changing the server:** *Change* under *Studio server* on the login screen. The app checks that it really is a FinX Studio before saving, and keeps the old address if it is not.
- **A real iPhone** (later): `localhost` would mean the phone itself. Build with `--studio-url http://<your Mac's address>:3100`, run Studio with `pnpm dev:lan`, and expect the phone to ask once to allow *Local Network* access. The UAT build already carries the text for that question. It cannot be tested in the Simulator.

## What the app asks for

| | UAT build | Production build |
|---|---|---|
| Permissions | none | none |
| Plain `http://` to Studio | allowed, to reach a laptop | blocked, HTTPS only |
| Local Network question on a phone | yes | no |
| Studio server can be changed in the app | yes | no |
| Devices | iPhone only (iPad later) | iPhone only |

## Check a build

Run these after each build that goes to testers. The last full pass was on 2 November 2026, on the iPhone 17 Pro Simulator (iOS 26.5).

1. The app opens on the sign-in screen with the bank's icon, and nothing sits under the Dynamic Island or the home indicator.
2. Log in. Home shows *Live from Studio* with the published journeys and the Studio address.
3. Send to beneficiary: pick an account and a beneficiary, type an amount, confirm, enter a wrong code (*Incorrect code*), then the right one (Ayesha's sandbox code is 482100). The receipt shows a reference, and home shows the new balance and daily limit used.
4. The on-screen back arrow steps back through a journey, and the cross closes it.
5. اردو switches to Urdu, right to left, in the shell and in journeys (Nastaliq font).
6. Studio server: an address that does not answer shows a clear message and keeps the old one. The right address, even without `http://`, says *Connected*, and survives closing the app.
7. With Studio unreachable, home shows *Offline copies* and the bundled journeys still run.
8. Dark mode and large text sizes still read well. At the largest accessibility sizes the home screen's tile titles can be cut off at the edge of their card.
9. No crash report appears in `~/Library/Logs/DiagnosticReports`.

The production build was built and its https-only policy verified, but not run in the Simulator. Not covered yet: a physical iPhone, VoiceOver, iPad, iOS versions other than 26.5, and the on-screen keyboard over the sign-in form (the Simulator used the Mac keyboard in this pass).

## Real iPhone and the App Store (not set up yet)

A phone needs the app signed with an Apple developer account. A free account can put it on your own phone for 7 days at a time. TestFlight and the App Store need the paid programme. When you have one, the work is: add the team to the Xcode project, build for a device instead of the Simulator, and sign. Wiring that into the script is not done yet.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "CocoaPods is not installed" | `/opt/homebrew/bin/brew install cocoapods` (see above) |
| "The Xcode licence has not been accepted" | Open Xcode once, or `sudo xcodebuild -license` yourself |
| "No Simulator with iOS 16.4 or newer" | Xcode > Settings > Components, install an iOS runtime |
| "No space left on device" | Free space. Xcode's cache is in `apps/bank-app/ios/build` and CocoaPods' in `~/Library/Caches/CocoaPods` |
| The app says *Offline copies* | It cannot reach Studio. Check the address under *Studio server* and that Studio is running |
| Odd build errors after changing config | Run again with `--clean` |
