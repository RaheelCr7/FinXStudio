# MVP demo: run it locally

Two servers: **Studio** (the builder, port 3100) and the **bank app** (Expo web, port 8081).

```bash
corepack enable pnpm && pnpm install
pnpm test                       # 50+ tests across schema, engine, sandbox, tokens, Studio

# terminal 1: Studio
cd apps/studio && pnpm dev      # http://localhost:3100

# terminal 2: bank app (web)
cd apps/bank-app && npx expo start --web --port 8081   # http://localhost:8081

# optional: publish the Pay a bill fixture into Studio (the same API an AI skill will use)
cd apps/studio && npx tsx scripts/seed-journey.ts pay-a-bill
```

Sandbox logins: **Ayesha** (happy path, OTP `482100`), **Bilal** (core fails after OTP `111111`), **Zara** (KYC rejected).

## 15-minute script
1. **Run a journey**: log in as Ayesha, open *Send to beneficiary*. Try an empty Continue (validation), 60,000 (daily-limit branch), then 25,000 through consent and OTP.
2. **Urdu**: tap اردو. The layout mirrors right-to-left.
3. **Edit live**: in Studio open the journey, select a button, rename its label (English and Urdu). The phone preview and the flow canvas update; the chip says *Unpublished changes*.
4. **Publish**: *Publish to UAT*. Reload the app home: *Live from Studio*, new version. Open the journey: new label, no rebuild.
5. **Create a journey from scratch**: *New journey*, name it, add blocks from the palette, fix any *Problems*, publish. It appears in the app's *Services* grid.
6. **Guardrails**: delete the review screen of *Send to beneficiary*. Studio flags the missing consent and refuses to publish.

Studio stores data in `apps/studio/.data/` (git-ignored). Delete it to reset to the seeded journey.
