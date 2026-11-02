# BankWorkx: a second bank app on the same platform

BankWorkx is a money-management app (balance, spending, budgets, cards) built on the same journey engine as Meezan Digital. Its look follows the fintech design kit you supplied: a lavender canvas, a blue gradient balance card, cyan highlights, a mint action button, rounded cards, charts, and a bottom tab bar.

It shows that one codebase can carry several banks: the journeys, engine and Studio are shared, and each bank brings its own look, name, ids and sandbox customers.

## Run it

```bash
# 1. Studio (a second terminal), then load the BankWorkx journeys into it
cd apps/studio && pnpm dev
cd apps/studio && npx tsx scripts/seed-journey.ts all        # add-money, add-card, connect-account, create-budget

# 2. The app in a browser
pnpm bankworkx:web

# 3. Or on the iPhone Simulator / an Android emulator
pnpm ios:sim --brand bankworkx --install
pnpm android:apk --brand bankworkx --install
```

Without Studio the app falls back to the journeys bundled inside it, so the demo still works offline.

## Checked on

The web build, and the iOS Simulator (iPhone 17 Pro, iOS 26.5): sign-in, dashboard with the chart, the action sheet, a full *Add money* journey with a balance update, and dark mode. All four journeys ran on iOS (typed card number, hidden password, switches, tiles). The first BankWorkx iOS build took 1 min 27 s and rebuilds about 50 s. On an Android 14 emulator the app starts in under half a second and the dashboard renders fully (the 21.8 MB APK is `bankworkx-0.1.0-1-uat-arm64.apk`); the journeys were not re-run there. A real iPhone has not been tried. To open BankWorkx on the emulator: `FINX_BRAND=bankworkx node apps/bank-app/scripts/android-emulator.mjs launch`.

## Sandbox customers

| Customer | What they show |
|---|---|
| **Alex Morgan** | Two accounts, one saved card, a month of transactions, three budgets, three subscriptions, and charts |
| **Sam Rivera (new customer)** | Nothing yet. The home screen guides them to connect a first account |

Sandbox rules for trying the failure paths:

- A card must pass the standard number check. `4242 4242 4242 4242` (Visa) and `5555 5555 5555 4444` (Mastercard) are valid; change a digit to see the error. Alex already has a card ending 5832.
- Connecting a bank: any username and a password of 6 or more characters works. The password `invalid123` is rejected.
- Adding money: $1 to $50,000 per transaction.

## Screens

| Tab | What you can do |
|---|---|
| **Dashboard** | Balance chart with 1W / 1M / 3M / 1Y (drag across it to read a day). Tap *Income* or *Expense* to filter the list. Tap a transaction for details. Tap a budget to open it. Tap the spending ring or a legend chip to highlight a category. *Pay now* on a subscription. Bell for alerts, menu to log out |
| **Accounts** | Connected accounts and linked banks, search, and *All / Money in / Money out* over transactions grouped by day |
| **Budgets** | Each budget with progress, and a dark detail screen: what is left, what was spent, and how much you can spend per day |
| **Wallet** | Swipe through cards, and quick actions |
| **+ button** | Every journey Studio has published for BankWorkx |

## Journeys (editable in Studio)

| Journey | Steps |
|---|---|
| **Add money** | Choose the account, an amount (type it, or tap $50 / $100 / $150 / $200), and a saved card. Review. Done with a reference |
| **Add card** | A live card picture fills in as you type. Checks the number, name, expiry and code, one message per field. Optional nickname and default switch. Consent. Done |
| **Connect account** | Account type tiles, bank tiles, sign in (the password is hidden, with Show), consent. Done, or a clear failure with *Try again* |
| **Create budget** | Category tiles, a monthly limit with quick amounts, an alert switch. Review. Done, or *you may already have one* |

They carry `apps: ["bankworkx"]`, so the Meezan app never shows them. A journey with no `apps` belongs to Meezan.

## New building blocks

These are available to every journey, in Studio's block picker and in the AI tools:

| Block / option | Use |
|---|---|
| `amountInput.quickAmounts` | One-tap amount chips |
| `select` with `variant: "tiles"` and `choices` | Big option cards with an icon and a line of help (banks, account types, categories) |
| `textInput.secure` | Hidden text with a Show button, for passwords |
| `toggle` | An on/off switch for a yes-or-no choice |
| `cardForm` | Card number, name, expiry and security code with a live card picture and per-field checks |

Charts, the gradient card, the donut, icons and pills are shared widgets in `packages/renderer-native/src/widgets.tsx`.

## How a bank is defined

- `apps/bank-app/brands.json`: name, id, URL scheme, icon folder and colours for each bank.
- `packages/ui-kit/src/tokens.ts`: the colours and corner radii (`brands`). BankWorkx uses larger radii and a different palette; dark mode is included.
- `packages/mock-bank-api`: the sandbox customers, tagged with their bank.
- Build with `--brand <id>`. Icons come from `pnpm brand-assets` (`python3 scripts/generate-brand-assets.py --accent "#3155CE" --detail "#0BB5E3" --out assets/bankworkx`).

To add a third bank: add it to `brands.json` and `tokens.ts`, generate its icons, and give it sandbox customers.

## Not built yet

- The Invest side of the design (portfolio, watchlist, stock and fund details).
- Urdu or other languages for BankWorkx journeys (English only for now).
- The design's custom typeface (the app uses the system font) and its illustrations.
- A real-device build (needs an Apple developer account for iPhone).
