# MVP demo: run it locally

Two servers: **Studio** (the builder, port 3100) and the **bank app** (Expo web, port 8081).

```bash
corepack enable pnpm && pnpm install
pnpm test                       # about 250 tests across schema, engine, sandbox, tokens, codegen, AI tools, Studio, app

# terminal 1: Studio (listens on localhost only; use `pnpm dev:lan` to test on a physical phone)
cd apps/studio && pnpm dev      # http://localhost:3100

# terminal 2: bank app (web)
cd apps/bank-app && npx expo start --web --port 8081   # http://localhost:8081

# optional: publish the Pay a bill fixture into Studio (the same API the AI tools use)
cd apps/studio && npx tsx scripts/seed-journey.ts pay-a-bill

# AI: open this folder in Claude Code, approve the project's finx MCP server, then /finx-journey <brief>

# Android: build an installable APK on this computer (the first build downloads about 7 GB and takes about 15 minutes), see docs/ANDROID.md
pnpm android:apk

# iOS: build the app for the iPhone Simulator and open it (needs Xcode and CocoaPods; first build about 3 minutes), see docs/IOS.md
pnpm ios:sim --install

# A second bank on the same platform: BankWorkx (see docs/BANKWORKX.md)
cd apps/studio && npx tsx scripts/seed-journey.ts all   # then: pnpm ios:sim --brand bankworkx --install
```

Sandbox logins: **Amira** (happy path, OTP `482100`), **Youssef** (core fails after OTP `111111`), **Zara** (KYC rejected).

## 15-minute script
1. **Run a journey**: log in as Amira, open *Send to beneficiary*. Try an empty Continue (validation), 60,000 (daily-limit branch), then 25,000 through consent and OTP.
2. **Urdu**: tap اردو. The layout mirrors right-to-left.
3. **Edit live**: in Studio open the journey, select a button, rename its label (English and Urdu). The phone preview and the flow canvas update; the chip says *Unpublished changes*.
4. **Publish**: *Publish to UAT* (if it goes wrong: *Settings*, *Publish history*, *Restore* puts an earlier version back as the draft, and nothing changes for customers until you publish again). Reload the app home: *Live from Studio*, new version. Open the journey: new label, no rebuild.
5. **Create a journey from scratch**: *New journey*, name it, add blocks from the palette, fix any *Problems*, publish. It appears in the app's *Services* grid.
6. **Create a journey from a sentence**: in Claude Code, in this folder, run `/finx-journey Create a mobile top-up journey with carrier selection, an amount between 50 and 5,000, and OTP confirmation` (or start from Studio's *Agents* page, which gives you the command). Watch the run appear on **Agents**, open the draft in the builder (it carries a *✦ AI draft* chip), read its screens, lint and Urdu, then *Publish to UAT*. It appears in the app. See [AI-LAYER.md](AI-LAYER.md).
7. **Change a journey from a sentence**: `/finx-journey Change the "Mobile top-up" journey: if the amount is more than PKR 2,000, show a warning screen before the review`. The agent patches the draft, tests it in the sandbox and leaves it for review.
8. **A second bank**: in the sidebar, switch project to *BankWorkx* and open a journey: the phone preview uses its own look. *Projects*, *New project* walks through adding a third bank in four steps and gives the commands to build it. See [PROJECTS.md](PROJECTS.md).
9. **On a phone**: install the APK, press *Change* under *Studio server* on the login screen, enter your computer's address (run Studio with `pnpm dev:lan`), then repeat step 4: publish in Studio and the phone picks it up. See [ANDROID.md](ANDROID.md). On the iPhone Simulator no address change is needed: it reaches Studio at `http://localhost:3100`, so steps 1 to 7 work the same. See [IOS.md](IOS.md).
10. **Catalog**: *Catalog* in the sidebar lists ready-made journeys. Press *Try* on one to run it on a phone preview in the current project's look, then *Add to project* to get a draft of its own to edit. See [CATALOG.md](CATALOG.md).
11. **Rules without code**: open *Send to beneficiary*, select the *Amount* screen and open *Next screen rules*. The rule reads as a sentence. Press *Test*, type sample amounts and limits, and see whether it applies. See [RULES.md](RULES.md).
12. **Who can publish**: in the sidebar's bottom corner choose *Riya Khan* (Reviewer): the Builder says *View only* and edits are refused. Choose *Dana Lee* (Designer): editing works and *Publish* is greyed out. Back to *Alex Morgan* (Admin) to publish. *People* explains each role. See [ROLES.md](ROLES.md).
13. **The code behind a project**: *Code* in the sidebar shows the project's configuration, journeys and theme as files, each tagged generated, extendable or custom, with *Download source* as a zip. See [CODE.md](CODE.md).
14. **Invest** (BankWorkx, log in as Alex): on the dashboard open *Investments*. Look at the portfolio chart (1D to 1Y), the watchlist and Explore, open a stock, star it, then *Buy*, and later *Sell*; the holding, balance and transactions update. See [BANKWORKX.md](BANKWORKX.md).
15. **The web app**: run `pnpm web:dev` and open `http://127.0.0.1:3200/bankworkx/login` (log in as Alex). Dashboard, Accounts, Budgets, Wallet and Invest have their own addresses; *New* opens the quick actions; *Buy* on a stock opens the journey with the stock chosen. `/meezan/login` is the classic bank with Urdu. Create a project in Studio and open `/<its-id>/login`: it appears with its own colours, no rebuild. See [WEB.md](WEB.md).
16. **Guardrails**: delete the review screen of *Send to beneficiary*. Studio flags the missing consent and refuses to publish. An agent cannot publish either: only a person can.

Studio stores data in `apps/studio/.data/` (git-ignored). Stop Studio and delete that folder to reset to the seeded journey. After running `pnpm install` while Studio is running, restart Studio.
