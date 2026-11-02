# MVP demo: run it locally

Two servers: **Studio** (the builder, port 3100) and the **bank app** (Expo web, port 8081).

```bash
corepack enable pnpm && pnpm install
pnpm test                       # 50+ tests across schema, engine, sandbox, tokens, Studio

# terminal 1: Studio (listens on localhost only; use `pnpm dev:lan` to test on a physical phone)
cd apps/studio && pnpm dev      # http://localhost:3100

# terminal 2: bank app (web)
cd apps/bank-app && npx expo start --web --port 8081   # http://localhost:8081

# optional: publish the Pay a bill fixture into Studio (the same API the AI tools use)
cd apps/studio && npx tsx scripts/seed-journey.ts pay-a-bill

# AI: open this folder in Claude Code, approve the project's finx MCP server, then /finx-journey <brief>

# Android: build an installable APK on this computer (the first build downloads about 7 GB and takes about 15 minutes), see docs/ANDROID.md
pnpm android:apk
```

Sandbox logins: **Ayesha** (happy path, OTP `482100`), **Bilal** (core fails after OTP `111111`), **Zara** (KYC rejected).

## 15-minute script
1. **Run a journey**: log in as Ayesha, open *Send to beneficiary*. Try an empty Continue (validation), 60,000 (daily-limit branch), then 25,000 through consent and OTP.
2. **Urdu**: tap اردو. The layout mirrors right-to-left.
3. **Edit live**: in Studio open the journey, select a button, rename its label (English and Urdu). The phone preview and the flow canvas update; the chip says *Unpublished changes*.
4. **Publish**: *Publish to UAT*. Reload the app home: *Live from Studio*, new version. Open the journey: new label, no rebuild.
5. **Create a journey from scratch**: *New journey*, name it, add blocks from the palette, fix any *Problems*, publish. It appears in the app's *Services* grid.
6. **Create a journey from a sentence**: in Claude Code, in this folder, run `/finx-journey Create a mobile top-up journey with carrier selection, an amount between 50 and 5,000, and OTP confirmation` (or start from Studio's *Agents* page, which gives you the command). Watch the run appear on **Agents**, open the draft in the builder (it carries a *✦ AI draft* chip), read its screens, lint and Urdu, then *Publish to UAT*. It appears in the app. See [AI-LAYER.md](AI-LAYER.md).
7. **Change a journey from a sentence**: `/finx-journey Change the "Mobile top-up" journey: if the amount is more than PKR 2,000, show a warning screen before the review`. The agent patches the draft, tests it in the sandbox and leaves it for review.
8. **On a phone**: install the APK, press *Change* under *Studio server* on the login screen, enter your computer's address (run Studio with `pnpm dev:lan`), then repeat step 4: publish in Studio and the phone picks it up. See [ANDROID.md](ANDROID.md).
9. **Guardrails**: delete the review screen of *Send to beneficiary*. Studio flags the missing consent and refuses to publish. An agent cannot publish either: only a person can.

Studio stores data in `apps/studio/.data/` (git-ignored). Stop Studio and delete that folder to reset to the seeded journey. After running `pnpm install` while Studio is running, restart Studio.
