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

The web build, and the iOS Simulator (iPhone 17 Pro, iOS 26.5): sign-in, dashboard with the chart, the action sheet, a full *Add money* journey with a balance update, and dark mode. All four journeys ran on iOS (typed card number, hidden password, switches, tiles). The first BankWorkx iOS build took 1 min 27 s and rebuilds about 50 s. On an Android 14 emulator the app starts in under half a second and the dashboard renders fully (the 21.8 MB APK is `bankworkx-0.1.0-1-uat-arm64.apk`); on 2 November 2026 the Invest screens also ran there: the portfolio, a stock page, the watchlist star, and a *Sell investment* sale ($50 of a holding, with the position updating). The other journeys were not re-run on Android. A real iPhone has not been tried. To open BankWorkx on the emulator: `FINX_BRAND=bankworkx node apps/bank-app/scripts/android-emulator.mjs launch`.

## Sandbox customers

| Customer | What they show |
|---|---|
| **Alex Morgan** | Two accounts, one saved card, a month of transactions, three budgets, three subscriptions, and charts |
| **Alex Morgan (accounts in three currencies)** | The same as Alex, plus a Euro account (EUR 2,400.00) and a Dirham account (AED 11,000.00), for moving money between accounts in different currencies. Separate from Alex because the dashboards and tests count Alex's two accounts |
| **Alex Morgan (saved payees)** | The same four accounts, and the Payments cast: Taylor Brooks (BankWorkx customer), Jamie Lee (US bank), Marco Rossi (abroad), Casey Nguyen (US bank, added 3 hours ago, so still in its first 24 hours), Lena Fischer (Europe) and James Whitfield (UK, used by a scheduled payment "Rent"). Separate from Alex because his tests count what he has |
| **Alex Morgan (50 saved payees)** | The same, with the most payees the bank allows, to try the limit |
| **Alex Morgan (saved billers)** | The same four accounts, a daily limit of $50,000.00 (EUR 20,000.00, AED 100,000.00) and two saved billers: *Home electricity* (City Power 4400123456) and *Home internet* (Skyline Broadband 5550012345). For paying bills. Separate from Alex because his tests count what he has |
| **Alex Morgan (saved numbers)** | The same four accounts, a daily limit of $50,000.00 (EUR 20,000.00, AED 100,000.00) and three saved mobile numbers: *My phone* (5550123456) and *Maya* (5550987654) with Aster Mobile, *Lena* (5550765432) with Brightline. For topping up. Separate from Alex because his tests count what he has |
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
| **Invest** (from the Investments card on the Dashboard) | Portfolio value with a 1D / 1W / 1M / 1Y chart, then *Portfolio*, *Watchlist* and *Explore* (search, Stocks / Funds filter, biggest movers). Tap a holding to open it. See below |
| **+ button** | Every journey Studio has published for BankWorkx |

## Journeys (editable in Studio)

| Journey | Steps |
|---|---|
| **Add money** | Choose the account, an amount (type it, or tap $50 / $100 / $150 / $200), and a saved card. Review. Done with a reference |
| **Add card** | A live card picture fills in as you type. Checks the number, name, expiry and code, one message per field. Optional nickname and default switch. Consent. Done |
| **Connect account** | Account type tiles, bank tiles, sign in (the password is hidden, with Show), consent. Done, or a clear failure with *Try again* |
| **Create budget** | Category tiles, a monthly limit with quick amounts, an alert switch. Review. Done, or *you may already have one* |

| **Invest** | Choose a stock or fund, an account, and an amount ($25 / $50 / $100 / $250 or typed, from $1). Review with a risk notice. Done with the shares bought and a reference, or a failure that says nothing was bought. Opened from a stock's *Buy* button, the stock is already chosen |

| **Sell investment** | Choose a holding, an amount ($25 / $50 / $100 / $250 or typed), and the account to pay. Review. Done with the shares sold and the money received, or a failure that says nothing was sold. Selling the whole value closes the holding. Opened from a stock's *Sell* button, the holding is already chosen |

| **Between my accounts** (`own-transfer`) | Pick From and To (Swap accounts). Same currency: an amount and an optional note, instant and free, one-time code, done. Different currencies: type what you send or what you get, see the rate (mid-market, no margin), the 0.20% fee, the total taken and what you get, tick the confirmation, one-time code, converted. The rate is held 30 seconds; if it ran out while you typed the code you see the old and the new rate and confirm again. Three wrong codes lock it; a timeout and an unavailable service have their own screens |

**Between my accounts: how it differs from the prototype spec.** It is built from the blocks FinX has, so the countdown on the rate, the live conversion summary under the amount, the "Today that is 1 USD = ..." line on the first screen, the note in Activity and the launch values (`accountId`, `toId`, `amount`) are not there; the review says the rate is held for 30 seconds. A rate that ran out is found when the code is entered (nothing is moved) rather than on the confirm button, because only the conversion call checks it. Errors are separate screens (`problem`, `amountProblem`, `failed`) chosen from the bank's error code. The bank's options `allowFx` and `fxFee` are plain data (`opt.allowFx`, `opt.fxFee`, on unless set to false). In the sandbox, BankWorkx quotes with no margin and the spec's Euro and Dirham rates (the reference bank keeps its 0.5% spread), a renewed quote moves by fixed steps within 0.04% so tests repeat, and `bank.transfers.own` is the same-currency move (`CURRENCY_MISMATCH` if the currencies differ). Its scenarios use sandbox conditions (`timeout`, `unavailable`, `latencyMs`, `frozen`, `transferFails`) and the `advance` step that moves the clock; they and the mutation check are in `packages/finx-mcp/src/scenarios.test.ts`.

| **Add, edit or delete a payee** (`manage-beneficiary`) | Choose Add, Edit or Delete. Add: the type (BankWorkx customer, another bank, abroad), where the account is, their details, the bank's checks of the account, the name check (match, close with *Use*, no match, couldn't check; a tick is needed unless it matched), review with consent, one-time code. Edit: the same fields filled in; a change of nickname or label alone is saved with no check and no code. Delete: asks no code; a payee used by a scheduled payment is refused unless *Also cancel these scheduled payments* is on |

**Add, edit or delete a payee: how it differs from the prototype spec.** Launch values (a mode, a kind, a payee, a screen to return to) cannot be passed in, so the journey always starts by asking what to do; AC-9 (return to the transfer the payee was added from) and the *Send money* and *Back to the payment* buttons are not built, nor is *Fill with a sample payee*. The blocks are `select` chips and tiles, a `menu` for the payee list (the chip is in its second line) and `consent` for the ticks; the bank's errors come back as one message shown on the screen, the first problem found (the prototype lists all). Errors are chosen from the bank's code (`route`), and *Try again* goes back to where the person was (`retry`). The bank's options `nameCheck`, `allowCancelSchedules` and `labels` are plain data (`opt.*`, on unless set to false). A change of the name or the account asks for a code and repeats the name check, but only a change of the bank details makes the payee new for 24 hours again (the shared rule; the journey text of the spec says the name does too). The wrong-code lock uses the engine's `otpVerify` counter, so `STEP_UP_FAILED` is not a bank code here (`OTP_REQUIRED` is). In the sandbox: `bank.payees.validate`, `check`, `save`, `update` and `delete`; `bank.beneficiaries.list` keeps its shape and adds the payee details, `coolingOffUntil` and `allowanceLeft`; `bank.transfers.create` holds a payee added in the last 24 hours to 500.00 USD in total (`BENEFICIARY_COOLING_OFF`), counted per payee. The name check registry is a small table of fake owners (Camille Dubois, Lena Fischer, James Whitfield, Omar Haddad, Priya Raman, Faisal Al-Harbi, Rania Haddad); an account it does not know, and anything abroad, cannot be checked. Its scenarios use `expectNoText` (a text that must not be on the screen) as well as the sandbox conditions; the proof is in `packages/finx-mcp/src/scenarios.test.ts`.

| **Send money** (`personal-transfer`) | Choose how to send: to a BankWorkx customer, to another bank, to another country (each can be switched off by the bank). Pick a saved payee of that kind or add one: a customer is found by mobile number, email or BankWorkx ID; another bank by routing number and account; another country by country, IBAN or account, the bank code the country asks for and the SWIFT/BIC. Amount (what the payee gets, in their currency), purpose and reference. Then the speed (Standard, Same day, Instant; Priority when the bank turns it on) with arrival, limit and fee, and Now or Later (a business day, repeating or not). Review with the rate, the fee and what you pay, *Save this payee*, the confirmation, the one-time code, and the result: Sent, On its way, Scheduled or Held for review |
| **To a BankWorkx customer** (`internal-transfer`) | Send money opened at the first type, so older links open the right place: saved customers, or a new one found by mobile number, email or ID; free, instant, up to 25,000.00 |

**Send money: how it differs from the prototype spec.** The engine has no launch values, no live redraw while typing and no per-field messages from the bank, so: the journey always starts at the type (an alias is the same flow with the type already set); the speed cards come on their own step after the amount, because the bank can only say which speeds fit once it has the amount (the first that fits is chosen, one over its limit is marked and refused); the bank's refusals (balance, limits, the 500.00 of a new payee, the purpose) are one screen with the bank's own words and the button to fix it, not a message under the field; the payee's address is asked on its own step when the bank says the rule applies; and the format checks of the payee fields are patterns on the fields while the bank checks the rest (check digits, the country of an IBAN or a BIC) and shows its message on the screen. The engine says "Enter an amount" for a zero amount and "Enter a whole amount, without decimals" for a currency without decimals; the "Reference" pattern has one message for characters and length. "Between my accounts" is its own journey (`own-transfer`); only the first home market (routing number and account; Standard, Same day and Instant) is configured, so the name check (Markets B to D) and the other markets' fields are not built; the bank's `allowFx` and `nameCheck` options and the mobile alias of Market D go with them. The Payments hub, tracker, notifications and `single-transfer` (Quick transfer) are not built. A held payment changes neither the balance nor the daily limit (acceptance criterion AC-12 of the spec; its scenario T-19 says the balance drops). The bank's options are plain data (`opt.*`, on unless set to false; Priority and *who pays the charges* are off unless set to true): `typeInternal`, `typeDomestic`, `typeIntl`, `speedStandard`, `speedSameDay`, `speedInstant`, `speedPriority`, `chargeChoice`, `allowLater`, `coolingOff`. In the sandbox: `bank.payees.lookup`, `bank.payments.quote`, `bank.payments.create` and `bank.schedules.list`; `bank.accounts.list` takes `homeOnly` (only the accounts that can pay someone else) and `bank.beneficiaries.list` takes `sendType`; `bank.payees.validate` takes `strict` (the country rules of a payment abroad: IBAN of the country, transit number, IFSC, BSB, 18-digit Mexican account, the country letters of the BIC) and returns `key`, `currency` and `country`. The rails are data (`packages/mock-bank-api/src/payments.ts`): Standard (free, 1 to 2 business days, up to 25,000.00), Same day (1.00, today), Instant (0.25, in seconds, up to 500,000.00), abroad 25.00 (+15.00 when the sender pays all charges, Priority 40.00), a BankWorkx customer free and instant up to 25,000.00. A payment in another currency is priced at the mid-market rate with no margin and the price holds for 60 seconds (the BankWorkx sandbox has the rates of the spec for its 12 currencies). The scenario conditions gain `limitUsed` (money already sent today) and `unavailable: ["rail:rtp"]` takes one speed down. The new-payee allowance (500.00 USD in 24 hours) now also covers a payee typed in the payment and not saved; what was sent counts when it is saved. The proof is in `packages/finx-mcp/src/scenarios.test.ts`.

| **Pay a bill** (`pay-bill`) | Choose a biller from the bank's directory (search, category chips, saved billers first), enter the reference (checked against the biller's format; spaces and hyphens are ignored), see the bill (amount due, due date, *Overdue* with the late fee), pay the full amount, the minimum or another amount (cards and loans have a minimum), choose the account (another currency adds a rate line), review with the biller's fee, *Save this biller* and *Pay automatically*, tick the confirmation, one-time code, receipt. A bill part-paid shows what is left next time; one paid in full says *Already paid* |

**Pay a bill: how it differs from the prototype spec.** The Meezan journey `pay-a-bill` is a different journey (slug, look and billers) and is not changed; this one is `pay-bill`, for BankWorkx only. The engine has no launch values, no live redraw while typing and no per-field messages from the bank, so: the journey always starts at the directory (the saved-biller row and *Repeat payment* open it, not a screen further on); the directory is filtered with a **Search** button (name, category chips) rather than as the person types; the bill is looked up when **Continue** is pressed on the reference screen, not as soon as the reference is valid, and what it found (amount due, due date, *Overdue*) is on the amount screen, while "No bill found", "Already paid", "No bill due" and "Biller unavailable" are a screen of their own with the spec's button (Edit, Back, Try again); an empty reference says "Required" (the engine's message) rather than "Enter the reference."; the minimum and other amount are left out, not dimmed, when `allowPartial` is off (with "This bill can only be paid in full."); the live summary under the amount (fee, rate, *You pay*) is on the review, and the biller's fee is named on the amount screen; the sheet that asks for the code is a screen (`otp`, "Pay bill"). Errors are screens chosen from the bank's code (`refProblem`, `amountProblem`, `failed`, `timeout`, `slow`, `unavailable`); the wrong-code lock is the shared `locked` screen (the engine counts `otpVerify` failures), so `STEP_UP_FAILED` is not a bank code and its words are only on `failed` (a payment sent without a verified code). The currency of the bill ($) is fixed in the journey, as in the prototype. The balance, the daily limit (tested on the amount plus the fee, in the currency of the account) and the new amount due are the bank's. The bank's options are plain data (`opt.*`, on unless set to false): `billFetch`, `allowPartial`, `allowCrossCurrency`, `offerSaveBiller`, `offerAutopay`. *Pay automatically* is made by the payment itself (`bank.bills.pay` with `autopay`): the monthly entry is added to the list that `bank.schedules.list` reads, a month after the due date on a business day, up to 1.5 times the amount due rounded up to 10. The journey `schedule-payment` that changes or cancels it, the notification, the `limits` call and the Payments hub (*View in Payments* leaves the journey) are not built. In the sandbox: `bank.billers.list` (takes `category` and `q`), `bank.bills.saved` (lists, or saves with `billerId` and `reference`), `bank.bills.lookup`, `bank.bills.quote` (prices and checks before the review) and `bank.bills.pay`; a BankWorkx customer gets the bank's own directory of 16 billers (`packages/mock-bank-api/src/bills.ts`), the Meezan customers keep their four. The last four digits of the reference choose the outcome (1111 biller unavailable, 0000 no bill, 9999 or paid in full already paid, 5555 no bill due, 7777 overdue with a 5% late fee and a due date 9 days ago, 3333 the amount due rises by 12.00 once, on the review; anything else (1000 + number mod 9000) / 20 due in (number mod 20) + 3 days), and the payment shows in Activity under the biller's name, category *Bills*. The proof is in `packages/finx-mcp/src/scenarios.test.ts`.

| **Mobile top-up** (`mobile-topup`) | Choose an operator (Aster Mobile, Brightline or Cobalt Wireless), the number (a saved one for that operator, or another, checked against the number rule of the bank's home market; spaces, brackets and hyphens are ignored), one of the operator's fixed amounts and the dollar account to pay from; the bank checks the number, the day's allowance of that number ($300.00) and the balance; review with *Save this number* (with a name of 2 to 20 characters), tick the confirmation, one-time code, receipt. The payment shows in Activity as "{operator} top-up" |

**Mobile top-up: how it differs from the prototype spec.** The Meezan top-up (carriers Jazz, Zong, Telenor and Ufone, PKR 50 to 5,000) is a different thing and is not changed; a BankWorkx customer gets the operators and fixed amounts of `topup.ts`, behind the same `bank.carriers.list` and `bank.topup.create`. The engine has no launch values, no "Checking the number…" wait, no per-field messages from the bank and no message for an empty choice, so: the deep link `?operatorId=` that skips the operator step is not built (acceptance criterion AC-9 and its scenario T-9 are left out; the journey always starts at the operators and **Change** is always shown); an empty number says "Required" (the engine's message); the operator, the amount and the saved number are one tap on a row, so nothing can be left empty; the number, the day's allowance and the balance are checked by the bank (`bank.topup.check`) when **Continue** is pressed on the account step, not on the review button, so a refused number, limit or balance is a screen with the bank's message and the button to fix it (*Change number*, *Try again*, *Change amount*, *Change account*) before the review, and "Not enough in this account." needs no rule of its own in the journey (the bank checks the balance again at payment); a slow answer to the check is the `slow` screen ("Nothing was taken", Try again), because no money moves, and only a slow top-up says "Check Activity"; the timeout screen is an error result (the result block has no warning tone); the wrong-code message is a toast "That code isn’t right. Try again." (the spec's shared rule also has "{n} tries left", which the engine's code field does not show); the name of a saved number says "Use 2 to 20 characters." for both a short and a long name; the amount screen is `bank.topup.amounts` (an operator's amounts) rather than `bank.carriers.list` with a parameter, so that a scenario can make it fail on its own. The bank's options are plain data (`opt.*`): `market` ("A" unless set to B, C or D: the number rule and the saved numbers that fit it) and `saveNumbers` (on unless set to false). Not built: the Home and Payments entry points, the notification, `PERMISSION_DENIED` and `JOURNEY_DISABLED`. The sandbox adds `bank.topup.amounts`, `bank.topup.numbers`, `bank.topup.check` and `bank.activity.list`, and numbers ending 0000 and 1111 are refused (`NUMBER_NOT_FOUND`, `OPERATOR_UNAVAILABLE`). The proof is in `packages/finx-mcp/src/scenarios.test.ts`: 33 scenarios cover 9 acceptance criteria, and a mutation check breaks the journey and the bank's rules 29 ways and the tests notice 28 (the other is the code field's resend button, which a scenario cannot press).

They carry `apps: ["bankworkx"]`, so the Meezan app never shows them. A journey with no `apps` belongs to Meezan.

## Invest

Nine made-up stocks and funds (Lumen Robotics, Apex Cloud, Harbor Energy, Orchard Foods, Summit Health, Meridian Bank, Global Index Fund, Green Future Fund, Treasury Bond Fund). Their prices and charts are fixed, so the same symbol always draws the same chart and ends at today's price. Alex starts with four holdings and three watchlist entries; Sam (the new customer) starts with none and sees *Start investing*.

- **A stock or fund page** has the price and day change, a chart with 1D / 1W / 1M / 1Y (drag to read a point), your position (value, shares, average cost, return), key numbers, a short description, a star to add it to the watchlist, and *Buy*.
- **Selling** is the *Sell investment* journey, and the *Sell* button shows on the page of anything you own.
- **Buying** is the *Invest* journey: it takes money from the chosen account, buys part of a share at today's price, and adds to the holding at a new average cost. The portfolio, the dashboard card and the transaction list update.
- Sandbox adapters: `bank.invest.instruments`, `bank.invest.holdings`, `bank.invest.buy`, `bank.invest.sell`, `bank.invest.watch`.
- All of it is sandbox data and the screens say it is not investment advice.

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

A bank is a **project**: see [PROJECTS.md](PROJECTS.md). In short, `packages/ui-kit/src/brands.json` holds each bank's name, ids, look ("preset"), accent colour and currency; the design system turns that into a full light and dark theme, and Studio can add new ones. The sandbox customers are in `packages/mock-bank-api`, tagged by look. Build with `--brand <id>`. Icons come from `scripts/generate-brand-assets.py` (the build makes them if missing).

## Not built yet

- Price alerts, gains tax and real market data on the Invest screens.
- Urdu or other languages for BankWorkx journeys (English only for now).
- The design's custom typeface (the app uses the system font) and its illustrations.
- A real-device build (needs an Apple developer account for iPhone).
