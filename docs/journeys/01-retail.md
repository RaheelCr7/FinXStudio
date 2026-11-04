# Module 1: Retail (pre-login, sign-in, security and Personal "Aurora")

**Release 1. Workspaces: Public (before sign-in) and Personal.** Everything a retail customer does, from the first launch of the app to sign-out: explore without an account, open an account or register, sign in and keep the account secure, then manage accounts, payments, cards, saving and borrowing, and servicing.

**What exists today:** BankWorkx® is a retail-only shell (`docs/BANKWORKX.md`): Dashboard, Accounts, Budgets, Wallet and Invest, six journeys in `packages/journey-schema/src/fixtures/bankworkx.ts` without consent, OTP or proof, the CAB access journeys (`fixtures/cab.ts`, `docs/CAB.md`) as the starting pattern for pre-login and sign-in, and Meezan journeys for local transfer, currency conversion and bill pay. **What is planned:** everything marked *(planned)*: sandbox domains, adapters, blocks, contexts, conditions.

## Journey index (57)

| Group | Journeys |
|---|---|
| Explore and onboarding (Public) | `loan-calculator`, `deposit-calculator`, `find-branch-atm`, `contact-support`, `open-account`, `track-application`, `register-digital-banking` |
| Sign-in and security | `sign-in`, `setup-quick-login`, `forgot-username`, `reset-password`, `unlock-account` (alias of `reset-password`, mode unlock), `forgot-password` (alias of `reset-password`, mode reset), `change-password`, `trusted-devices` (view in More), `change-quick-pin` |
| Accounts | `accounts`, `account-details`, `statement` (was `account-statement`), `account-nickname` (alias of `account-details`), `open-another-account`, `create-budget`, `budgets` |
| Payments | `transfer-types`, `own-transfer`, `internal-transfer`, `personal-transfer`, `single-transfer`, `international-transfer`, `pay-bill`, `mobile-topup`, `manage-beneficiary`, `schedule-payment`, `cancel-standing-order` (alias of `schedule-payment` in cancel mode) |
| Cards | `cards`, `activate-card`, `freeze-card` (alias of `card-controls`), `card-controls`, `virtual-card`, `replace-card`, `card-pin`, `dispute-transaction`, `add-card` |
| Save & Borrow | `save-borrow` (the Save tab, a view), `term-deposit`, `savings-goal`, `apply-loan`, `repay-loan`, `invest`, `sell-investment`, `add-money` |
| More | `update-profile`, `new-message`, `messages` (view), `service-request`, `my-requests` (view), `connect-account` |

**Slug mapping to existing Meezan fixtures:** `fund-transfer-local` → `personal-transfer`, `convert-currency` → `own-transfer`, `pay-a-bill` → `pay-bill` (old slugs stay as aliases for Meezan). Existing BankWorkx® journeys keep their slugs and are upgraded: `add-money`, `add-card`, `connect-account`, `create-budget`, `invest`, `sell-investment`.

## Public: before sign-in

Everything here works with no session. The person has not signed in, so there is no active context and no permission is needed (`none` in every launch point of README 5.1). Public screens and journeys are `workspace: "public"` (planned field, README 1.2). Public adapters answer for any persona and never return account data. Sam Rivera (`sam`) is the default sandbox persona for these screens.

How a person moves through the public places (README 3.1):

| From | To | Rule |
|---|---|---|
| Splash | Welcome carousel | First start on this device only (flag `welcomeSeen` not set) |
| Splash | Landing | Every later start |
| Welcome carousel | Language choice | "Get started" or "Skip" |
| Language choice | Landing | "Continue" |
| Landing | Sign in, Open an account, Register for digital banking, Explore | Four primary actions |

Public sandbox adapters used by the shell screens below (all *planned*, new sandbox domains `app`, `products`, `legal`, and `fx` gains a list):

| Adapter | Request | Response | Errors |
|---|---|---|---|
| `bank.app.config` (planned) | `{ platform: "ios" \| "android" \| "web", appVersion: "1.4.0" }` | `{ minVersion: "1.2.0", latestVersion: "1.4.0", maintenance: { active: false, from, until, message }, languages: ["en"], termsVersion: "2026-10" }` | `TIMEOUT`, `SERVICE_UNAVAILABLE` |
| `bank.products.list` (planned) | `{ type?: "account" \| "card" \| "deposit" \| "loan" }` | Record keyed by product id (shape under "Shell: Product detail") | `TIMEOUT`, `SERVICE_UNAVAILABLE` |
| `bank.products.get` (planned) | `{ productId }` | One product with all its facts | `PRODUCT_NOT_FOUND`, `TIMEOUT`, `SERVICE_UNAVAILABLE` |
| `bank.fx.rates` (planned) | `{ base: "USD" }` | `{ base, asOf, rows: { [code]: { code, name, mid, youGet, youGetBack } } }` | `CURRENCY_NOT_SUPPORTED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` |
| `bank.legal.get` (planned) | `{ docId: "terms" \| "privacy" \| "cookies" \| "licences" }` | `{ docId, title, version, effectiveFrom, sections: [{ heading, text }] }` | `DOCUMENT_NOT_FOUND`, `TIMEOUT`, `SERVICE_UNAVAILABLE` |

None of these moves money, none needs a one-time code.

### Shell: Splash

| | |
|---|---|
| Purpose | Show the brand while the app checks that this version may run and the bank is open. |
| Route | Mobile: screen `Splash`. Web: no splash page; the web app runs the same check silently before it draws Landing and shows the notices below as full-page screens if needed. |
| Data source | `bank.app.config` (planned), called once with the platform and the app's own version. |
| Widgets | BankWorkx® logo centred, a small spinner under it after 1 second. |

Decision order (first match wins):

| # | Condition | Result |
|---|---|---|
| 1 | The call fails or has no answer after 10 seconds | Error state (below) |
| 2 | `appVersion` is lower than `minVersion` | Forced-update screen |
| 3 | `maintenance.active` is true | Maintenance screen |
| 4 | `welcomeSeen` is not set | Welcome carousel |
| 5 | Otherwise | Landing. If `latestVersion` is higher than `appVersion`, Landing shows a dismissible banner: "A new version of BankWorkx® is available." with a link "Update". |

Version compare is by numbers, part by part (`1.10.0` is higher than `1.9.0`).

States:

| State | What the person sees |
|---|---|
| Loading | Logo only for at least 1 second (no flash), spinner after 1 second. Reduced-motion setting: no logo animation. |
| Forced update | Title "Please update BankWorkx®". Body "This version is no longer supported. Update the app to keep banking safely." Button "Update now" (opens the store page). No skip, no back. |
| Maintenance | Title "We're making improvements". Body "BankWorkx® is closed for maintenance until {until}. {message}" with {until} like `3 Nov 2026 06:00 UTC`. Button "Try again" (runs the check again). No other button. |
| Error (`TIMEOUT`) | Title "We can't connect right now". Body "This is taking longer than expected. Nothing was changed." Button "Try again". After a second failure a second button "Continue anyway" opens Landing with a banner "Some features may not work." |
| Error (`SERVICE_UNAVAILABLE`) | Same title. Body "This service is not available right now. Nothing was changed. Please try again in a few minutes." Same buttons. |

Drill-downs: none except the buttons above. Launch points on it: none (it is the first screen).

### Shell: Welcome carousel

| | |
|---|---|
| Purpose | Three cards that say what the app does. Shown once per device. |
| Route | Mobile: `Welcome`. Web: `/welcome` (opened only on a first visit). |
| Data source | None. Text is built into the app (localised). Sets `welcomeSeen = true` when the person leaves it. |
| Widgets | Illustration, title, body, three dots, buttons. Swipe left and right on mobile, arrow buttons on web. Reduced motion: no slide animation, the card just changes. |

| Card | Title | Body |
|---|---|---|
| 1 | Your money, in one place | See your accounts, cards and savings together. Check a balance in one tap. |
| 2 | Move money with confidence | Send money, pay bills and top up your phone. Every payment is confirmed with a one-time code. |
| 3 | Safe by design | Your password and your phone protect your sign-in. You can add your fingerprint or face if you like. |

| Button | Shown on | Leads to |
|---|---|---|
| Next | Cards 1 and 2 | Next card |
| Skip | Cards 1 and 2 (top right) | Language choice |
| Get started | Card 3 | Language choice |

States: loading none (static). Empty none. Error none. Accessibility: each card is announced as "Card 2 of 3"; buttons are 44 pt.

### Shell: Language choice

| | |
|---|---|
| Purpose | Let the person pick the language of the app. |
| Route | Mobile: `LanguageChoice`. Web: `/language`. Also opened from Landing footer "Language" and from More › settings. |
| Data source | `bank.app.config.languages`. In Release 1 it is `["en"]`; every journey carries `locale.supported: ["en"]` (README 1.4). |
| Widgets | A list of rows (one `select` with variant `rows` in the journey style), one tick, a Continue button. |

Rows in Release 1: "English" with the tick. Caption under the list: "More languages are coming." When `languages` has one entry the screen still shows (so the person sees what is set) but "Continue" is the only action. Choosing a language saves it on the device and redraws the screen in that language at once. Arabic would switch to right-to-left (the CAB journeys show the pattern, `docs/CAB.md`).

| Button | Leads to |
|---|---|
| Continue | Landing (first run) or back to where the person came from |

States: Loading: rows as skeletons while the config loads (the config is cached from Splash, so normally none). Error: if the config is not cached and the call fails, the single row "English" is shown from the built-in list and no message appears.

### Shell: Landing

| | |
|---|---|
| Purpose | The front door. Four main actions and the Explore links. |
| Route | Mobile: `Landing`. Web: `/`. |
| Data source | None needed to draw it. The version banner uses `bank.app.config` from Splash. |
| Widgets | `hero` with the logo and a headline "Banking that keeps up with you."; four action buttons; an Explore section; a footer. |

| Order | Item | Style | Leads to |
|---|---|---|---|
| 1 | Sign in | Primary button | Journey `sign-in` |
| 2 | Open an account | Secondary button | Journey `open-account` (no `{productId}`) |
| 3 | Register for digital banking | Secondary button | Journey `register-digital-banking` |
| 4 | Track my application | Text link under the buttons | Journey `track-application` |

Explore section (heading "Explore"; rows with an icon, a title and a one-line text):

| Row | Text | Leads to |
|---|---|---|
| Products | Accounts, cards, deposits and loans | Shell: Products |
| Calculators | Estimate a loan or a deposit | Two sub-rows: `loan-calculator`, `deposit-calculator` |
| Exchange rates | See today's rates | Shell: Exchange rates |
| Find a branch or ATM | Near you | Journey `find-branch-atm` (`{kind}` empty) |
| Contact us | Call or ask us to call you | Journey `contact-support` |

Footer: "Language" (opens Language choice), "Terms and conditions", "Privacy notice", "Cookie notice" (web), "Licences" (each opens Shell: Legal pages), version text "BankWorkx® 1.4.0". On web a cookie banner shows once: "We use essential cookies to make this site work. We don't use others without your say-so." Buttons "Only essential" (default, saves choice) and "Manage" (opens the Cookie notice).

States: Loading: none (static); the version banner appears when ready. Empty: n/a. Error: n/a (nothing on Landing needs a call). Offline: all four buttons stay; each journey shows its own error if it cannot reach the bank.

Launch points on Landing (README 5.1): Sign in, Open an account, Register for digital banking, Track my application, Find a branch or ATM, Contact us. README changes needed: add "Landing › Explore › Loan calculator / Deposit calculator" (journeys `loan-calculator` / `deposit-calculator`, passes nothing) and "Products › list › Calculator" (see below).

### Shell: Products

| | |
|---|---|
| Purpose | Browse what the bank offers, in four groups. |
| Route | Mobile: `Products` (segmented control at the top). Web: `/products`, `/products/accounts`, `/products/cards`, `/products/deposits`, `/products/loans`. |
| Data source | `bank.products.list` (planned), one call per group (`type`). |
| Widgets | Segmented control: Accounts, Cards, Deposits, Loans. Under it, one product card per product: name, one-line tagline, one headline figure (label and value), a "Details" link. |

Sort order: the order the bank sets (`rank`, lowest first); the three products below are already in that order. No filters or search (fewer than ten products per group). The segment last used is remembered for the session.

States:

| State | What the person sees |
|---|---|
| Loading | Three skeleton cards. |
| Empty (`empty` condition) | "There are no products to show right now." Button "Back to home" (Landing). |
| Error `TIMEOUT` | "This is taking longer than expected. Nothing was changed." Button "Try again". |
| Error `SERVICE_UNAVAILABLE` | "This service is not available right now. Nothing was changed. Please try again in a few minutes." Button "Try again". |

Drill-downs: a product card or "Details" opens Shell: Product detail with `{productId}`. Launch points on it: Landing › Explore › Products. Below the Loans and Deposits lists a link "Calculator" opens `loan-calculator` or `deposit-calculator` (README change needed).

### Shell: Product detail

| | |
|---|---|
| Purpose | Everything a person needs to decide, and the way to act. One layout for the four groups. |
| Route | Mobile: `ProductDetail` with `{productId}`. Web: `/products/{group}/{productId}`. |
| Data source | `bank.products.get` (planned). |

Product record (the same shape for all four groups):

| Field | Meaning |
|---|---|
| `id`, `type`, `name`, `tagline`, `rank` | Identity and order |
| `headline` | `{ label, value }`, shown on the list card |
| `facts` | List of `{ label, value }` rows, group specific (below) |
| `fees` | List of `{ label, value }` rows. "None" is a value. |
| `eligibility` | List of sentences (age, residency) |
| `needed` | List of what the person needs to open it (used by `open-account`) |
| `termsVersion` | Version of the terms that apply |
| `action` | `{ label, journey }` for the main button |

Widgets on the page: title and tagline, headline figure, "Key facts" table, "Fees" table, "Who can have it" list, "What you need" list, then buttons. Legal line at the foot: "Terms {termsVersion} apply. Rates and fees can change." with a link to Legal pages.

Buttons: **Open this account** (primary, every group; opens `open-account` with `{productId}`), then **Estimate repayments** (loans only; `loan-calculator` with `{productId}`) or **Estimate returns** (deposits only; `deposit-calculator` with `{productId}`). Back returns to the list with the same segment.

Synthetic products (the sandbox seed):

**Accounts**

| Id | Name | Tagline | Headline | Key facts | Fees | Eligibility | Needed |
|---|---|---|---|---|---|---|---|
| `acc_everyday` | Everyday Account | A simple current account with a debit card. | Monthly fee: $0 | Currency: USD. Opening balance: $0. Debit card: included. Overdraft: none. | Monthly fee: None. ATM in network: None. Card replacement: $10.00. | 18 or older. Lives in the United States. | Photo ID, proof of address, tax details |
| `acc_saver` | Aurora Savings | Earn interest on money you set aside. | 3.10% a year | Currency: USD. Interest: paid monthly. Minimum opening balance: $100. Withdrawals: unlimited. | Monthly fee: None. | 18 or older. Lives in the United States. | Photo ID, proof of address, tax details |
| `acc_student` | Student Account | For 16 to 25 year olds who are studying. | Monthly fee: $0 | Currency: USD. Opening balance: $0. Debit card: included. Daily card limit: $500. | Monthly fee: None. Card replacement: $5.00. | 16 to 25. Studying (student letter). | Photo ID, proof of address, student letter, tax details |

**Cards**

| Id | Name | Tagline | Headline | Key facts | Fees | Eligibility | Needed |
|---|---|---|---|---|---|---|---|
| `card_debit` | Aurora Debit | Spend from your account, in shops and online. | Included with Everyday | Network: sandbox card network. Contactless: yes. Daily ATM limit: $1,000. | Annual fee: None. Foreign transactions: 1.5%. | Holds an Everyday or Student Account. | An open account |
| `card_credit` | Aurora Credit | Spread the cost with a credit limit. | Up to $10,000 limit | Credit limit: $500 to $10,000. Interest-free days: up to 45. Representative APR: 19.9%. | Annual fee: $0 in year one, then $35. Late payment: $25. | 21 or older. Income of at least $24,000 a year. | Photo ID, proof of income |

**Deposits**

| Id | Name | Tagline | Headline | Key facts | Fees | Eligibility | Needed |
|---|---|---|---|---|---|---|---|
| `dep_6m` | 6-month deposit | Lock money away for six months. | 3.60% a year | Term: 6 months. Minimum: $500. Maximum: $250,000. Interest: at maturity or monthly. Bonus: +0.10% for $50,000 or more. | Early withdrawal: 1% of the amount. | 18 or older. Has a BankWorkx® account. | An open account |
| `dep_12m` | 12-month deposit | A year, a steady rate. | 4.10% a year | Term: 12 months. Same minimum, maximum, payout and bonus as above. | Early withdrawal: 1% of the amount. | As above | An open account |
| `dep_24m` | 24-month deposit | Our best rate for two years. | 4.40% a year | Term: 24 months. Same minimum, maximum, payout and bonus as above. | Early withdrawal: 1% of the amount. | As above | An open account |

**Loans**

| Id | Name | Tagline | Headline | Key facts | Fees | Eligibility | Needed |
|---|---|---|---|---|---|---|---|
| `loan_personal` | Personal loan | Borrow for what matters, repay monthly. | From 8.90% APR | Amount: $1,000 to $35,000. Term: 12, 24, 36, 48 or 60 months. Rate: fixed. | Arrangement fee: None. Early repayment: None. | 21 or older. Income of at least $24,000 a year. | Photo ID, proof of address, proof of income |
| `loan_auto` | Auto loan | Finance a car. | From 6.90% APR | Amount: $5,000 to $60,000. Term: 12 to 84 months in steps of 12. Rate: fixed. | Arrangement fee: None. | As above | As above, plus the vehicle quote |
| `loan_home` | Home loan | Buy or improve a home. | From 5.40% APR | Amount: $50,000 to $500,000. Term: 60 to 360 months in steps of 60. Rate: fixed for the whole term. | Arrangement fee: None. Valuation: $250 (paid at offer). | As above, plus a deposit of at least 10%. | As above, plus the property details |

In Release 1 the loan and card products are for reading and for the calculator; applying is a signed-in journey (`apply-loan`, Personal). The button "Open this account" on a loan or card page opens `open-account` with the product id; the journey explains: "To apply for this, first open an account. You can apply once you're signed in." (screen `welcome`, see `open-account`).

States:

| State | What the person sees |
|---|---|
| Loading | Title and table skeletons. |
| Error `PRODUCT_NOT_FOUND` | "We can't find that product. It may have changed." Button "Back to products". |
| Error `TIMEOUT` / `SERVICE_UNAVAILABLE` | Standard messages S-`TIMEOUT` (non-money wording) and S-`SERVICE_UNAVAILABLE` (README 1.6). Button "Try again". |

Launch points on it (README 5.1): Open this account (`open-account`, `{productId}`), Estimate repayments (`loan-calculator`, `{productId}`), Estimate returns (`deposit-calculator`, `{productId}`).

### Shell: Exchange rates

| | |
|---|---|
| Purpose | Today's indicative rates, so a person can see what a conversion will roughly cost before banking with us. |
| Route | Mobile: `ExchangeRates`. Web: `/rates`. |
| Data source | `bank.fx.rates` (planned). It is built from the same table as the existing `bank.fx.rate`: mid rate from `PER_USD`, rate the customer gets after the 0.5% spread (`customerRate`). |
| Widgets | Base-currency dropdown (default USD), search box, table (card list on phones), "Updated {asOf}" line, a note. |

Table columns (the `dataTable` block, planned; a card list on phones):

| Column | Meaning | Example (base USD, EUR row) |
|---|---|---|
| Currency | Code and name | EUR, Euro |
| Mid-market rate | Units of that currency for 1 of the base, before our spread | 0.92 |
| You get | Units you receive when you convert 1 of the base into it (mid rate less 0.5%) | 0.9154 |
| You get back | Units of the base you receive when you convert 1 of that currency into the base | 1.0815 |

Sorted by code, A to Z; the base itself is not listed. Filter: the search box matches code or name, case-insensitive. Sort: tap a column header (code, mid rate). Currencies in the sandbox table: AED, EUR, GBP, INR, JOD, JPY, KWD, PKR, SAR, USD. Rates show 4 decimals for rates under 100 and 2 decimals above.

Note under the table: "These rates are a guide. The rate you get is confirmed in a quote that stays valid for 30 seconds when you convert." Footer: "Updated {asOf}", for example "Updated 3 Nov 2026 09:00 UTC".

| State | What the person sees |
|---|---|
| Loading | Table skeleton, 8 rows. |
| Empty (search finds nothing) | "No currency matches \"{search}\"." Button "Clear search". |
| Empty (`empty` condition) | "Rates aren't available right now." Button "Try again". |
| Error `CURRENCY_NOT_SUPPORTED` (base) | "We don't show rates for that currency." Button "Use USD". |
| Error `TIMEOUT` / `SERVICE_UNAVAILABLE` | Standard messages; button "Try again". |

Drill-downs: a row has no detail page in Release 1. Launch points on it: Landing › Explore › Exchange rates. (Signed-in conversion is `convert-currency`, Personal.)

### Shell: Legal pages

| | |
|---|---|
| Purpose | Read the terms, privacy notice, cookie notice and software licences before and after signing in. |
| Route | Mobile: `Legal` (list) and `LegalDocument` with `{docId}`. Web: `/legal`, `/legal/terms`, `/legal/privacy`, `/legal/cookies`, `/legal/licences`. Signed-in "More › legal" opens the same screens. |
| Data source | `bank.legal.get` (planned), one call per document. |
| Widgets | Menu list of four documents; a document page with title, "Version {version}, in force from {effectiveFrom}", numbered sections, "Back to top". |

| Document | `docId` | Version in the sandbox |
|---|---|---|
| Terms and conditions | `terms` | 2026-10 (matches `termsVersion` and the `consent` block's `termsVersion` in journeys) |
| Privacy notice | `privacy` | 2026-10 |
| Cookie notice (web only) | `cookies` | 2026-10 |
| Licences | `licences` | 2026-10 |

Synthetic text (shortened in the sandbox, each has three sections): Terms: "1. Using BankWorkx®", "2. Keeping your details safe: you must keep your username, password and one-time codes private and tell us at once if you think someone else knows them", "3. Changes to these terms". Privacy: "What we collect", "How we use it", "Your choices". The page carries a caption: "Sample text. The bank's approved wording replaces this."

| State | What the person sees |
|---|---|
| Loading | Title skeleton and four text lines. |
| Error `DOCUMENT_NOT_FOUND` | "We can't find that document." Button "Back to legal pages". |
| Error `TIMEOUT` / `SERVICE_UNAVAILABLE` | Standard messages; button "Try again". |

Drill-downs: each row opens the document; the document links to the others at the foot. The journeys `open-account` (agreement) and `register-digital-banking` link here for the terms; they show the document in a `documentViewer` (planned), not in this shell. Launch points on it: Landing footer, Product detail legal line, More › legal (Personal).

### ★ Loan calculator — `loan-calculator`

**Catalog:** slug `loan-calculator`, workspace `public`, category Public: before sign-in (prototype tag "Before you sign in"), core no, can a bank switch it off: yes (basic entry, kept in the Lean preset). Options (key, label, default): `showHome` "Include home loans" (on); `showApply` "Show a Start application button" (on). Research: `research/loan-calculator.md`. Built in `design/bankworkx-r1/src/journeys/50-calculators.js`, with the helper object `CALC` shared with `deposit-calculator`.

The lean rework removed per-region rate tables, fees, insurance and the repayment schedule. What remains: choose a loan type, move the amount and the term, read the monthly payment, the total interest and the total to repay. Nothing is stored and no one signs in.

**Home market configuration.** The only market-dependent thing is the currency symbol on every amount. The rates and ranges below are the same in every market (a bank loads its own table).

| Market | Symbol before the amount |
|---|---|
| Market A (routing number and account) | `$` |
| Market B (sort code and account) | `£` |
| Market C (IBAN) | `€` |
| Market D (IBAN, mobile alias) | `AED ` |

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `loan-calculator` |
| Purpose | Move the amount and the term to see the monthly payment, the total interest and the total to repay for a personal, car or home loan. |
| Release / workspace | 1 / Public (before sign-in) |
| Status | Built in the prototype as a one-screen form journey (`submit: "Show summary"`, no adapter call). It only estimates; nothing is applied for. |
| Channels | Web and mobile |
| Starting pattern | None in the fixtures; a form with a live summary box |
| Who may use it | Anyone, signed in or not. No permission. |

**Loan table (prototype, generic).** Rate is the yearly rate, fixed per loan type. Amount and term are sliders (`range`).

| Loan | Rate | Amount: min, max, step, start | Term in months: min, max, step, start |
|---|---|---|---|
| Personal loan | 9.9% | 1,000 to 50,000, step 500, start 10,000 | 6 to 84, step 6, start 36 |
| Car loan | 7.4% | 2,000 to 80,000, step 500, start 15,000 | 12 to 84, step 6, start 48 |
| Home loan (option `showHome`) | 5.1% | 50,000 to 750,000, step 5,000, start 200,000 | 60 to 360, step 12, start 240 |

Monthly payment = `P × r / (1 − (1 + r)^−n)` with `r` = rate ÷ 12 ÷ 100, `P` the amount, `n` the months. Total to repay = payment × n; total interest = total to repay − amount. Amounts show with 2 decimals in the summary and receipt, and without decimals on the slider labels. A term shows as "{n} months" below 24 months or when it is not a whole number of years, "1 year" for 12 months, and "{n} years" from 24 months in whole years.

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Landing › Calculators | none | none |
| Products › loan › Estimate repayments | `{productId}` (`loan_personal`, `loan_auto`, `loan_home`) | none |
| Deep link `/public/j/loan-calculator?product=auto` | `{product}` (`personal`, `auto`, `home`) | none |

A product that is not offered (home loans with `showHome` off) falls back to Personal loan. The amount and the term start at the loan's start values.

#### 3. Screens

One screen, then a result.

**Screen `calc`** ("Loan calculator"). Button **Show summary**.

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| (no label) | `chips`: Personal loan, Car loan, Home loan (home only with `showHome`). Default Personal loan. Changing it resets the amount and the term to that loan's start values | No | One of the loans | none |
| How much do you need? | `range`, the amount row of the table, label shows the symbol and the amount | Yes | Inside min and max in steps | none (the slider cannot leave its range) |
| Over how long? | `range`, the term row of the table, label shows the term text | Yes | Inside min and max in steps | none |

Only the sliders of the chosen loan are shown. The summary box under the fields redraws on every move:

- Small text "Monthly payment", then the payment in large type.
- Rows "Interest rate" (for example "9.9% a year"), "Total interest", "Total to repay".
- Small text "This is an estimate. Your rate may differ."
- Button **Start application** (secondary), only with `showApply` on. It opens `apply-loan` with `{amount, term}` (months).

**Result** ("Your estimate", green, text "Based on today’s rates. Nothing has been applied for."). A reference starting EST-. Rows: "Loan", "Amount", "Term", "Interest rate", "Monthly payment", "Total interest", "Total to repay". Button **Start application** when `showApply` is on and `apply-loan` is on at the bank. Then **Done**.

**States**
- Loading: none (the table is local in the prototype). In the product the rates load first with a skeleton for the summary box (planned).
- Empty: not applicable.
- Error: the rates cannot load: "We couldn’t load the rates. Try again in a few minutes." and **Try again** (planned; the prototype calculators make no adapter call, so its Service down switch changes nothing here).
- Timeout: after 10 seconds, "This is taking longer than expected. Nothing was changed." with **Try again** (planned).

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `SERVICE_UNAVAILABLE` | "We couldn’t load the rates. Try again in a few minutes." | `calc` | Try again |
| `TIMEOUT` (planned) | "This is taking longer than expected. Nothing was changed." | `calc` | Try again |
| `JOURNEY_DISABLED` | "This isn’t available at your bank." | whole journey | none |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `loanRates` | `bank.rates.loans` | `{}` | list of `{type, apr, amountMin, amountMax, amountStep, termMin, termMax, termStep}` | `SERVICE_UNAVAILABLE`, `TIMEOUT` | (planned). The prototype holds the table `LC_PROD` |

The calculation runs on the device from the table; no customer data leaves it.

#### 6. Permissions, step-up and limits

None. No step-up. The only limits are the slider ranges above.

#### 7. Result and links out

Result as above. No notification. Links out: `apply-loan` (with the amount and the term), `contact-support` (from the landing page, not from this journey).

#### 8. Acceptance criteria

- AC-1: Each loan shows only its own sliders with the ranges and start values of the table, and changing the loan resets the sliders.
- AC-2: The monthly payment, the total interest and the total to repay follow the formula above and update on every move.
- AC-3: The term text follows the rule (months below 24, "1 year", whole years from 24).
- AC-4: Home loans appear only with `showHome` on; a launch with `product: "home"` while it is off shows Personal loan.
- AC-5: **Start application** appears in the summary and on the result only with `showApply` on, and carries the amount and the term to `apply-loan`.
- AC-6: Every amount uses the symbol of the bank's home market.
- AC-7: The screen says it is an estimate and the result says nothing has been applied for.
- AC-8: When the rates cannot load the person sees the plain message and can try again (planned in the prototype).

#### 9. Scenarios

Synthetic anonymous visitor.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-2 | Visitor, Market A | none | Open with no parameters: Personal loan, 10,000, "36 months". Summary: payment 322.20, "9.9% a year", total interest 1,599.29, total to repay 11,599.29. |
| T-2 | AC-1 | Visitor | none | Choose Car loan: sliders reset to 15,000 and "4 years" (48 months); payment 361.98. Choose Home loan: 200,000 and "20 years"; payment 1,330.98. |
| T-3 | AC-3 | Visitor | none | Term 6 shows "6 months"; 12 shows "1 year"; 30 (personal) shows "30 months"; 36 shows "3 years". |
| T-4 | AC-4 | Visitor, `showHome` off | none | The chips offer Personal and Car only; `product: "home"` opens Personal loan. |
| T-5 | AC-5 | Visitor, amount 15,000, term 48 | none | **Start application** opens `apply-loan` with amount 15,000 and term 48. With `showApply` off the button is absent in the summary and on the result. |
| T-6 | AC-6 | Visitor, Market B, C, D | none | Symbols `£`, `€`, `AED `. |
| T-7 | AC-7 | Visitor | none | Footnote and the result text are shown. |
| T-8 | AC-8 | Visitor | `unavailable: ["bank.rates.loans"]` | "We couldn’t load the rates. Try again in a few minutes." (planned). |
| T-9 | AC-8 | Visitor | `timeout: ["bank.rates.loans"]`, `latencyMs: 10000` | After 10 seconds: "This is taking longer than expected. Nothing was changed." (planned). |

#### 10. Expected mutation-check survivors

The slider bounds and steps survive if the sandbox rate table is not asserted per loan; expected, because the control cannot go outside them. Rounding of the displayed cents survives a half-cent change; expected. Everything else: none expected.

---

### ★ Deposit calculator — `deposit-calculator`

**Catalog:** slug `deposit-calculator`, workspace `public`, category Public: before sign-in (prototype tag "Before you sign in"), core no, can a bank switch it off: yes (basic entry, kept in the Lean preset). Options (key, label, default): `allowMonthly` "Offer interest paid every month" (on); `showApply` "Show a Start application button" (on). Research: `research/deposit-calculator.md`. Built in `design/bankworkx-r1/src/journeys/50-calculators.js` (object `DC`, with `CALC` shared with `loan-calculator`).

The lean rework removed tax, compounding, early-withdrawal penalties and the rate-by-amount bands. Interest is simple: amount × yearly rate × years. What remains: amount, term, and when interest is paid.

**Home market configuration.** Only the currency symbol depends on the market (same table as `loan-calculator`).

| Market | Symbol before the amount |
|---|---|
| Market A (routing number and account) | `$` |
| Market B (sort code and account) | `£` |
| Market C (IBAN) | `€` |
| Market D (IBAN, mobile alias) | `AED ` |

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `deposit-calculator` |
| Purpose | Choose an amount and a term to see the interest and what you get back, paid at the end or every month. |
| Release / workspace | 1 / Public (before sign-in) |
| Status | Built in the prototype as a one-screen form journey (`submit: "Show summary"`, no adapter call). It only estimates; nothing is opened. |
| Channels | Web and mobile |
| Starting pattern | None in the fixtures; a form with a live summary box |
| Who may use it | Anyone. No permission. |

**Rate table (prototype, generic; a bank loads its own).**

| Term (months) | 3 | 6 | 12 | 24 | 60 |
|---|---|---|---|---|---|
| Term text | 3 months | 6 months | 1 year | 2 years | 5 years |
| Rate a year | 3.00% | 3.40% | 3.90% | 3.60% | 3.30% |

Interest = amount × rate ÷ 100 × months ÷ 12. "You get back" = amount + interest. "Interest every month" = interest ÷ months. The amount slider runs 500 to 100,000 in steps of 500, start 10,000.

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Landing › Calculators | none | none |
| Products › deposit › Estimate returns | `{productId}` (`dep_3m`, `dep_6m`, `dep_12m`, `dep_24m`, `dep_60m`) | none |
| Deep link `/public/j/deposit-calculator?term=24` | `{term}` in months (3, 6, 12, 24, 60) | none |

Any other term opens 12 months (1 year). Interest starts as "At the end".

#### 3. Screens

One screen, then a result.

**Screen `calc`** ("Deposit calculator"). Button **Show summary**.

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| How much do you want to deposit? | `range`, 500 to 100,000, step 500, start 10,000 | Yes | Inside the range in steps | none |
| For how long? | `chips`: 3 months, 6 months, 1 year, 2 years, 5 years. Default 1 year | Yes | One of the five | none |
| Interest | `chips`: "At the end", "Every month". Shown only with `allowMonthly`. Default "At the end" | No | One of two | none |

Summary box, redrawn on every change:

- At the end: small text "You get back", the maturity amount in large type.
- Every month: small text "Interest every month", the monthly interest in large type, and a row "Your deposit returned at the end" with the amount.
- Rows "Interest rate" (two decimals, for example "3.90% a year") and "Total interest".
- Small text "This is an estimate. Rates can change before you open the deposit."
- Button **Start application** (secondary) with `showApply` on. It opens `term-deposit` with `{amount, term}` (months).

**Result** ("Your estimate", green, text "Based on today’s rates. Nothing has been opened."). Reference starting EST-. Rows: "Amount", "Term", "Interest rate", "Interest paid" ("At the end" or "Every month"), "Total interest", and "You get back" (or "Each month" when interest is monthly). Button **Start application** when `showApply` is on and `term-deposit` is on at the bank. Then **Done**.

**States**
- Loading: none in the prototype (local table). Product: skeleton for the summary box (planned).
- Empty: not applicable.
- Error: the rates cannot load: "We couldn’t load the rates. Try again in a few minutes." and **Try again** (planned; the prototype makes no adapter call here, so its Service down switch changes nothing).
- Timeout: after 10 seconds, "This is taking longer than expected. Nothing was changed." with **Try again** (planned).

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `SERVICE_UNAVAILABLE` | "We couldn’t load the rates. Try again in a few minutes." | `calc` | Try again |
| `TIMEOUT` (planned) | "This is taking longer than expected. Nothing was changed." | `calc` | Try again |
| `JOURNEY_DISABLED` | "This isn’t available at your bank." | whole journey | none |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `depositRates` | `bank.rates.deposits` | `{}` | list of `{termMonths, rate}` | `SERVICE_UNAVAILABLE`, `TIMEOUT` | (planned). The prototype holds the table `DC_RATES` |

#### 6. Permissions, step-up and limits

None. No step-up. Limits: amount 500 to 100,000 on the slider.

#### 7. Result and links out

Result as above. No notification. Links out: `term-deposit` (with the amount and the term).

#### 8. Acceptance criteria

- AC-1: Interest, total return and monthly interest follow the formulas above and update on every change.
- AC-2: The five terms show the rates of the table with two decimals.
- AC-3: "Every month" appears only with `allowMonthly`; with it chosen the big figure is the monthly interest and a row shows the deposit returned at the end.
- AC-4: An unknown launch term opens 1 year.
- AC-5: **Start application** appears only with `showApply` on and carries the amount and the term to `term-deposit`.
- AC-6: Every amount uses the symbol of the home market.
- AC-7: The screen says rates can change and the result says nothing has been opened.
- AC-8: When the rates cannot load the person sees the plain message and can try again (planned in the prototype).

#### 9. Scenarios

Synthetic anonymous visitor, Market A unless stated.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-2 | Visitor | none | Defaults 10,000, 1 year, at the end: "You get back" 10,390.00, rate "3.90% a year", total interest 390.00. |
| T-2 | AC-1, AC-3 | Visitor | none | Interest "Every month": "Interest every month" 32.50, row "Your deposit returned at the end" 10,000.00. |
| T-3 | AC-2 | Visitor | none | 3 months at 10,000: rate "3.00% a year", interest 75.00. 5 years at 500: rate "3.30% a year", interest 82.50. |
| T-4 | AC-3 | Visitor, `allowMonthly` off | none | The "Interest" chips are absent; the result shows "At the end". |
| T-5 | AC-4 | Visitor | none | `term=7` opens 1 year; `productId=dep_24m` opens 2 years. |
| T-6 | AC-5 | Visitor, 10,000, 2 years | none | **Start application** opens `term-deposit` with amount 10,000 and term 24; absent with `showApply` off. |
| T-7 | AC-6 | Visitor, Markets B, C, D | none | Symbols `£`, `€`, `AED `. |
| T-8 | AC-8 | Visitor | `unavailable: ["bank.rates.deposits"]` | "We couldn’t load the rates. Try again in a few minutes." (planned). |
| T-9 | AC-8 | Visitor | `timeout: ["bank.rates.deposits"]`, `latencyMs: 10000` | After 10 seconds: "This is taking longer than expected. Nothing was changed." (planned). |

#### 10. Expected mutation-check survivors

Display rounding to cents survives a half-cent change; expected. The slider bounds survive because the control cannot leave them; expected. Everything else: none expected.

---

### ★ Find a branch or ATM — `find-branch-atm`

**Catalog:** slug `find-branch-atm`, workspace `public`, category Public: before sign-in (prototype tag "Before you sign in"), core no, can a bank switch it off: yes (basic entry, kept in the Lean preset). Options (key, label, default): `showAtms` "Include cash machines" (on); `openNow` "Offer an “Open now” filter" (on). Research: `research/find-branch-atm.md`. Built in `design/bankworkx-r1/src/journeys/51-find-help.js` (objects `FB`, `HELP`).

The lean rework removed real map tiles, live location, ratings and appointment booking. What remains: search places by area or street, filter by kind and by open now, see a simple map, open one place for its hours and services, and hand over to the phone's maps app for directions. Places in the prototype are synthetic and generic.

**Home market configuration.** Only the distance unit depends on the market.

| Market | Distance unit |
|---|---|
| Market A (routing number and account) | miles (`mi`) |
| Market B (sort code and account) | miles (`mi`) |
| Market C (IBAN) | kilometres (`km`) |
| Market D (IBAN, mobile alias) | kilometres (`km`) |

The place data holds kilometres. Miles = km × 0.621. Distances show with one decimal and the unit, for example "0.8 km" or "0.5 mi".

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `find-branch-atm` |
| Purpose | Search the bank's branches and cash machines near you, see whether each is open now, read opening hours and services, and open directions. |
| Release / workspace | 1 / Public (before sign-in) |
| Status | Built in the prototype as a two-screen journey (`submit: "Get directions"`, no adapter call). The list is a local table of 8 places; the "map" is a drawn placeholder with dots. |
| Channels | Web and mobile |
| Starting pattern | None in the fixtures; `cab.locations.search` and `cab.locations.details` in `packages/mock-bank-api/src/cab.ts` are the existing adapters to build on |
| Who may use it | Anyone. No permission. |

**Places (prototype data).** Open status is worked out from the hours and the clock; the prototype clock is fixed at Tuesday 18:45 so the chips are stable. In the product the clock is the bank's time zone (planned).

| Place | Kind | Address | Area | Distance (km) | Hours set | Services |
|---|---|---|---|---|---|---|
| Central Branch | Branch | 1 Example Square | City centre | 0.8 | Branch | Cash deposits, Advice desk, Step-free access |
| Central Plaza cash machine | Cash machine | Central Plaza, ground floor | City centre | 0.4 | 24 hours | Cash withdrawal, Cash deposit |
| Station cash machine | Cash machine | Main Station concourse | Station | 1.2 | 24 hours | Cash withdrawal |
| Market Street Branch | Branch | 48 Market Street | Market | 2.1 | Late | Cash deposits, Safe deposit boxes, Step-free access |
| Mall cash machine | Cash machine | Riverside Mall, level 1 | Riverside | 3.4 | Mall | Cash withdrawal, Cash deposit, Step-free access |
| Riverside Branch | Branch | 9 Example Road | Riverside | 3.6 | Branch | Cash deposits, Advice desk |
| Harbour cash machine | Cash machine | Harbour Walk | Harbour | 5.8 | 24 hours | Cash withdrawal |
| Airport Branch | Branch | Terminal 1, arrivals | Airport | 12.4 | Late | Cash deposits, Currency exchange, Step-free access |

| Hours set | Sunday | Monday to Friday | Saturday |
|---|---|---|---|
| Branch | Closed | 09:00 to 17:00 | 09:00 to 13:00 |
| Late | 10:00 to 16:00 | 08:00 to 20:00 | 08:00 to 20:00 |
| Mall | 10:00 to 21:00 | 09:00 to 22:00 | 09:00 to 22:00 |
| 24 hours | Open 24 hours | Open 24 hours | Open 24 hours |

**Open chip and status text.** Open now: chip "Open" and "Closes {hh:mm}". Closed but opening later today: chip "Closed" and "Opens {hh:mm}". Closed for the day: chip "Closed" and "Opens tomorrow {hh:mm}" or "Opens {Mon, Tue…} {hh:mm}" for the next open day; "Closed" when it never opens.

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Landing › Find a branch or ATM | none | none |
| `replace-card` › Collect from a branch | `{kind: "branch"}` | none |
| Deep link `/public/j/find-branch-atm?kind=atm` | `{kind}` (`atm`, `branch`) | none |

`kind: "atm"` is used only when `showAtms` is on; `branch` filters to branches; anything else shows All.

#### 3. Screens

Steps in order: `search`, `details`, then the result.

**Screen `search`** ("Find a branch or ATM"). Button **Show details**.

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| (no label) | `text`, placeholder "Search by area or street", max 60 | No | Matches part of the name, address or area, ignoring capitals | none |
| (no label) | `chips`: All, Branches, Cash machines (the last only with `showAtms`). Default All, or from the launch value | No | One of the kinds | none |
| Open now | `check`, shown only with option `openNow` | No | Keeps places that are open now | none |

Below the fields: a drawn map (a grid with up to 8 dots, branches in the accent colour, cash machines green, the chosen place larger, labelled "Map"), then the list sorted by distance, nearest first. Each row: an icon (building for a branch, wallet for a cash machine), the name, "{distance} · {address}", the chip and the status text. Tapping a row chooses that place and goes straight to the details. **Show details** chooses the nearest place when none was tapped.

- Empty (no match): icon, "No places found", "Try another search or show everything." The button is blocked with "No places match. Try another search."

**Screen `details`** ("Details"). Button **Get directions**.

- Card: name, address, chip Open or Closed, the status text, "· {distance} away".
- Card "Opening hours": seven rows Sunday to Saturday, each "Open 24 hours", "{hh:mm} to {hh:mm}" or "Closed".
- Card "Services": one chip per service.

**Result** ("Opening directions", green). Text "Your maps app will open with the route to {place}." Reference MAP- plus the place id in capitals (for example MAP-B1). Rows "Place", "Address", "Distance". Button **Search again** (starts the journey fresh), then **Done**.

**States**
- Loading: none in the prototype. Product: list skeleton and a grey map (planned).
- Empty: as above.
- Error: places cannot load: "We couldn’t load places right now. Try again in a few minutes." with **Try again** (planned; the prototype makes no adapter call, so its Service down switch changes nothing here).
- Location refused (planned "Use my location" button): "We couldn’t get your location. Search by area instead."
- Timeout: after 10 seconds, "This is taking longer than expected. Nothing was changed." with **Try again** (planned).

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `LOCATION_DENIED` (planned) | "We couldn’t get your location. Search by area instead." | `search` | OK |
| `SERVICE_UNAVAILABLE` | "We couldn’t load places right now. Try again in a few minutes." | `search`, `details` | Try again |
| `TIMEOUT` (planned) | "This is taking longer than expected. Nothing was changed." | `search` | Try again |
| `JOURNEY_DISABLED` | "This isn’t available at your bank." | whole journey | none |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `searchPlaces` | `cab.locations.search` | `{query, kind, near?}` | list of places with hours | `SERVICE_UNAVAILABLE`, `TIMEOUT` | Existing for the CAB access journeys (`packages/mock-bank-api/src/cab.ts`); a `bank.locations.search` twin for BankWorkx® is (planned) |
| `placeDetails` | `cab.locations.details` | `{placeId}` | place with hours and services | `NOT_FOUND`, `SERVICE_UNAVAILABLE` | Existing in `cab.ts`; the BankWorkx® twin is (planned) |

The prototype reads the local table `FB_PLACES`. The "open directions" step is a link to the phone's maps app and calls nothing.

#### 6. Permissions, step-up and limits

None. No step-up. The search text is limited to 60 characters.

#### 7. Result and links out

Result as above. No notification. Links out: the device's maps app. Reached from `replace-card` (collect from a branch).

#### 8. Acceptance criteria

- AC-1: The list is sorted nearest first and shows the distance in miles for Markets A and B and kilometres for Markets C and D.
- AC-2: The search matches the name, address or area, ignoring capitals; the kind chips and the Open now filter narrow the list.
- AC-3: Each place shows Open or Closed and the status text worked out from its hours and the clock.
- AC-4: With no match the empty state shows and the button is blocked.
- AC-5: Tapping a row, or **Show details**, opens the details with seven hours rows and the services.
- AC-6: Cash machines and the Cash machines chip appear only with `showAtms`; the Open now filter only with `openNow`.
- AC-7: The result names the place, the address and the distance and offers **Search again**.
- AC-8: Launching with `kind=branch` shows branches only.
- AC-9: When places cannot load the person sees the plain message and can try again (planned in the prototype).

#### 9. Scenarios

Synthetic anonymous visitor, Market A, clock Tuesday 18:45.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-3 | Visitor | none | The first row is Central Plaza cash machine, "0.2 mi · Central Plaza, ground floor", chip Open, "Closes 24:00". Central Branch shows "0.5 mi", chip Closed, "Opens tomorrow 09:00". |
| T-2 | AC-1 | Visitor, Market C | none | Distances read "0.4 km", "0.8 km" and so on. |
| T-3 | AC-2 | Visitor | none | Typing "riverside" leaves the mall cash machine and Riverside Branch. Chip Branches leaves four branches. Open now removes Central Branch and Riverside Branch. |
| T-4 | AC-4 | Visitor | none | Typing "zzz" shows "No places found" and the blocked button message. |
| T-5 | AC-5, AC-7 | Visitor | none | Tap Market Street Branch: hours Sunday "10:00 to 16:00", Monday "08:00 to 20:00"; services as listed. **Get directions**: result "Opening directions", reference MAP-B2, rows Place, Address, Distance. |
| T-6 | AC-6 | Visitor, `showAtms` off | none | No Cash machines chip, no cash machine rows; `kind=atm` shows All. |
| T-7 | AC-8 | Visitor | none | `kind=branch` opens with Branches chosen. |
| T-8 | AC-9 | Visitor | `unavailable: ["bank.locations.search"]` | "We couldn’t load places right now. Try again in a few minutes." (planned). |
| T-9 | AC-9 | Visitor | `timeout: ["bank.locations.search"]`, `latencyMs: 10000` | After 10 seconds: "This is taking longer than expected. Nothing was changed." (planned). |

#### 10. Expected mutation-check survivors

The map dot positions are decoration and are not asserted; expected. The mile conversion survives a rounding change in the second decimal; expected. The sort order survives when two places are the same distance; expected. Everything else: none expected.

---

### ★ Contact us — `contact-support`

**Catalog:** slug `contact-support`, workspace `public`, category Public: before sign-in (prototype tag "Before you sign in"), core no, can a bank switch it off: yes (basic entry, kept in the Lean preset). Options (key, label, default): `allowChat` "Offer chat" (on); `allowCall` "Offer a call" (on); `secureMessages` "Offer secure messages to signed-in customers" (on). Research: `research/contact-support.md`. Built in `design/bankworkx-r1/src/journeys/51-find-help.js` (object `CS`, with `HELP` shared with `find-branch-atm`).

The lean rework removed topic routing by market, callback booking, social channels and the help-centre search. What remains: three ways to reach the bank (Chat, Call, Message), each with its own opening hours and a short path.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `contact-support` |
| Purpose | Reach the bank by chat, by phone or by a written message, and see whether each channel is open. |
| Release / workspace | 1 / Public (before sign-in) |
| Status | Built in the prototype as a form journey with three branches (`submit: "Send"`). Chat and message call an adapter in the prototype (a simulated wait); Call opens the phone's dialer. No money moves. |
| Channels | Web and mobile |
| Starting pattern | None in the fixtures |
| Who may use it | Anyone. No permission. A signed-in person can also use `new-message` (secure messages). |

**Ways to reach the bank.**

| Way | Sub-line | Hours | Chip | Offered when |
|---|---|---|---|---|
| Chat | "Ask an adviser online" | Monday to Saturday 08:00 to 20:00, Sunday 10:00 to 16:00 | "Open now" with "Closes {hh:mm}", or "Closed" with "Opens {…}" | option `allowChat` |
| Call | "Talk to us" | Monday to Friday 08:00 to 18:00; Saturday and Sunday closed | same as Chat | option `allowCall` |
| Message | "We reply within 1 working day" | any time | "Open now" with "Any time" | always |

Topics (Chat and Message): Accounts, Cards, Payments, Loans and savings, Online and app banking, Something else. The prototype clock is fixed at Tuesday 18:45 for the chips; the product uses the bank's time zone (planned).

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Landing › Contact us | none | none |
| `sign-in` › Help | none | none |
| `reset-password` and `unlock-account` › Too many tries › **Contact us** | none | none |
| Account locked › Contact support | none | none |
| `register-digital-banking`, `forgot-username`, `track-application` › Too many tries › **Contact us** | none | none |
| Deep link `/public/j/contact-support?way=chat` | `{way}` (`chat`, `call`, `message`) | none |

With `way` passed, the choice is preselected on the first screen.

#### 3. Screens

Steps in order: `way`, then one of `chat`, `call` or `message`, then the result.

**Screen `way`** ("Contact us"). Text "How would you like to reach us?" One `cards` field.

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| (no label) | `cards`: Chat, Call, Message (only the ways that are on), each with its sub-line and its open chip | Yes | One of the cards | "This is required." |

The chip is information only: a closed channel can still be chosen in the prototype (open point: a closed Chat should say when it opens and offer Message instead; planned).

**Screen `chat`** ("Chat"). Button **Start chat**, busy "Finding an adviser…" (about 0.8 seconds).

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| What is it about? | `select` of the six topics | Yes | One of the list | "This is required." |
| Your question | `textarea`, placeholder "Tell us a little", max 300 | Yes | At least 5 characters | "Write a few words so we can help." |

**Screen `call`** ("Call us"). Card "Opening hours" with seven rows Sunday to Saturday (for example "08:00 to 18:00" or "Closed"). Button **Call us**. No fields.

**Screen `message`** ("Send us a message"). Button **Send**, busy "Sending…" (about 0.7 seconds). With `secureMessages` on, a secondary button **Send us a message** opens `new-message`; it appears only when that journey is on and the person is signed in.

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| What is it about? | `select` of the six topics | Yes | One of the list | "This is required." |
| Your email | `email`, placeholder "name@example.com", max 80 | Yes | `name@host.tld` shape | "Enter a valid email address." |
| Your message | `textarea`, placeholder "How can we help?", max 1000, counter "{n} of 1000" | Yes | At least 10 characters | "Write at least 10 characters." |

**Results**

| Way | Title | Text | Chip | Rows |
|---|---|---|---|---|
| Chat | "You’re in the queue" | "An adviser will join in about 2 minutes." | Waiting (amber) | Topic |
| Call | "Calling the bank" | "Your phone will open the dialer." | none (reference CALL-…) | Opening hours: "Mon to Fri, 08:00 to 18:00" |
| Message | "Message sent" | "We’ll reply to {email} within 1 working day." | Received (green) | Topic, Reply to |

Each result has a reference and the button **Done**.

**States**
- Loading: busy text on the button for Chat and Message as above.
- Empty: not applicable. If Chat and Call are both off, only Message is offered.
- Error: "We couldn’t send that. Nothing was sent. Try again in a few minutes." with **Try again**. The Service down switch shows the standard connection sheet ("We couldn’t reach the bank", "Nothing was sent and you haven’t been charged. Try again in a moment.", **Try again**).
- Timeout: "This is taking longer than expected. Nothing was sent." with **Try again**.

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `SERVICE_UNAVAILABLE` | "We couldn’t send that. Nothing was sent. Try again in a few minutes." | `chat`, `message` | Try again |
| `TIMEOUT` | "This is taking longer than expected. Nothing was sent." | `chat`, `message` | Try again |
| `RATE_LIMITED` (planned) | "You’ve sent a lot of messages. Try again later." | `message` | Back |
| `JOURNEY_DISABLED` | "This isn’t available at your bank." | whole journey | none |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `hours` | `bank.support.hours` | `{}` | opening hours per way | `SERVICE_UNAVAILABLE` | (planned). The prototype holds the tables `HELP_H` and `CS_WAYS` |
| `openChat` | `bank.support.openChat` | `{topic, text}` | `{queueId, waitMinutes}` | `SERVICE_UNAVAILABLE`, `TIMEOUT` | (planned) |
| `sendMessage` | `bank.support.sendMessage` | `{topic, email, text}` | `{reference}` | `SERVICE_UNAVAILABLE`, `TIMEOUT`, `RATE_LIMITED` | (planned) |

Call has no adapter: it opens a `tel:` link.

#### 6. Permissions, step-up and limits

None. No step-up. Limits: chat question 300 characters; message 1000 characters; abuse limit on messages per device (planned).

#### 7. Result and links out

Results as above. Notifications: a message reply goes to the email address given. Links out: `new-message` (signed in), the phone dialer. Reached from `sign-in`, `reset-password`, `unlock-account`, `register-digital-banking`, `forgot-username` and `track-application`.

#### 8. Acceptance criteria

- AC-1: Chat appears only with `allowChat`, Call only with `allowCall`, Message always; each shows an open or closed chip from its hours.
- AC-2: Chat needs a topic and at least 5 characters, and ends in the queue result.
- AC-3: Call shows the seven opening-hours rows, then the dialer result with the weekday hours.
- AC-4: Message needs a topic, a valid email and at least 10 characters, and the result repeats the email.
- AC-5: The secure-message button appears only with `secureMessages` on and `new-message` available to the person.
- AC-6: A launch value `way` preselects that way.
- AC-7: When the bank is unavailable or times out nothing is sent and the person can try again.

#### 9. Scenarios

Synthetic anonymous visitor, clock Tuesday 18:45.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1 | Visitor | none | Chat: "Open now", "Closes 20:00". Call: the line closed at 18:00, so chip "Closed" and "Opens tomorrow 08:00". Message: "Open now", "Any time". |
| T-2 | AC-1 | Visitor, `allowChat` and `allowCall` off | none | Only Message is offered. |
| T-3 | AC-2 | Visitor | none | Chat, topic Cards, question "Hi": "Write a few words so we can help." Question "I need help with my card.": result "You’re in the queue", row Topic "Cards". |
| T-4 | AC-3 | Visitor | none | Call: Saturday and Sunday "Closed", Monday "08:00 to 18:00". Result "Calling the bank", row "Mon to Fri, 08:00 to 18:00". |
| T-5 | AC-4 | Visitor | none | Email "alex" gives "Enter a valid email address."; message "Hello" gives "Write at least 10 characters."; valid input gives "Message sent" and "We’ll reply to alex.morgan@example.com within 1 working day." |
| T-6 | AC-5 | Alex (signed in), `secureMessages` on | none | The button **Send us a message** opens `new-message`; with the option off or signed out it is absent. |
| T-7 | AC-6 | Visitor | none | `way=message` opens with Message chosen. |
| T-8 | AC-7 | Visitor | `unavailable: ["bank.support.sendMessage"]` (prototype: Service down on) | Connection sheet; nothing sent. |
| T-9 | AC-7 | Visitor | `timeout: ["bank.support.sendMessage"]`, `latencyMs: 10000` | After 10 seconds: "This is taking longer than expected. Nothing was sent." |

#### 10. Expected mutation-check survivors

The wait text "about 2 minutes" is fixed copy and is not asserted against a queue; expected. The abuse limit (`RATE_LIMITED`) cannot be produced by the sandbox yet; expected. Everything else: none expected.

---

### ★ Open an account — `open-account`

**Catalog:** slug `open-account`, workspace `public`, category Onboarding (Public: before sign-in), core no, can a bank switch it off: yes. Options: **Offer the savings account** (`offerSaver`, default on); **Offer the Islamic account** (`offerIslamic`, default off); **Ask for a proof of address when the local rules need it** (`requirePoa`, default on); **Allow save and resume** (`allowSave`, default on); **Send income over 1M to manual review** (`reviewHigh`, default on). Research: `research/open-account.md`. Built in `design/bankworkx-r1/src/journeys/49-open-account.js`.

The journey is now **one standard flow for every customer**. The earlier region step, the per-region option switches (alternative ID documents, joint accounts, national digital ID, politically exposed persons review) and the per-region wording were removed. The bank’s home market decides, without asking the customer, the national ID format, whether a proof of address is asked, the currency symbol in the income bands and the tax declaration wording (see the table in section 3).

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `open-account` |
| Purpose | New-customer onboarding: verify mobile and email, give personal details and address, check the ID and a selfie, describe work and money, make the tax declaration, choose an account and follow the application. |
| Release / workspace | 1 / Public (before sign-in) |
| Status | Built in the prototype as a form journey (`submit: "Finish"`). Creates an application, not an account: the bank decides after its checks. |
| Channels | Web and mobile (the ID and selfie steps use the camera) |
| Starting pattern | Long form with save and resume |
| Who may use it | Anyone aged 18 or over who is not yet a customer. |

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Landing › Open an account | none | none |
| Products › detail › Open this account | `{productId}` (`acc_saver` starts with the savings account chosen) | none |
| Calculator › Open an account | none | none |
| `track-application` › Start again (planned) | none | none |
| Deep link `/open-account?fresh=1` | optional `fresh` (ignores a saved application) | none |

#### 3. Screens

Steps: `resume`, `start`, `about`, `address`, `poa`, `idv`, `selfie`, `work`, `tax`, `product`, `review`, `status`. From `about` on, when `allowSave` is on, each step has a second button **Save and finish later**.

**Home market configuration** (the customer never sees a country name here; the values below are filled and checked by the bank’s home market):

| Market | National ID number | Proof of address | Income bands symbol | Address in the form | Tax declaration text |
|---|---|---|---|---|---|
| Market A (routing number and account) | 9 digits. "Enter the 9 digits." | not asked | `$` | postcode asked | "I confirm my tax details are correct and I am not subject to backup withholding." |
| Market B (sort code and account) | 2 letters, 6 digits, 1 letter. "Use 2 letters, 6 digits, then 1 letter." | not asked | `£` | postcode asked | "I confirm my tax residency details are correct." |
| Market C (IBAN) | 8 to 14 letters or digits. "Use 8 to 14 letters or digits." | not asked | `€` | postcode asked | "I confirm these details may be reported for automatic exchange of tax information." |
| Market D (IBAN, mobile alias) | 15 digits starting 784. "Enter the 15 digits, starting 784." Digits 4 to 7 must equal the year of birth, checked at the selfie step | asked when `requirePoa` is on | `AED ` | no postcode field | "I confirm my tax residency details are correct and may be shared with the tax authority." |

The Country field is pre-selected with the bank’s home country. Dollars, pounds, euros or dirhams fill the income and deposit bands.

**Screen `resume`: Welcome back** (only when a saved application exists, `allowSave` is on and the link did not pass `fresh`). A card with the saved name and "Saved {date and time}. You’ll retake your photos." Choice: **Continue** or **Start again**. Continue restores the answers and returns to the first photo step; Start again discards the saved application.

**Screen `start`: Get started** (button **Continue**, busy "Checking…")

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Mobile number | tel | yes | 7 to 15 digits, optional leading + | "Enter a valid mobile number." |
| Email | email | yes | an address with a domain | "Enter a valid email address." |
| One-time code | text, 6 digits, hint "Sent to your mobile." | yes | exactly 6 digits | "Enter the 6-digit code." |

If an application already exists for these details: "We already have an application with these details. Sign in instead." A wrong code: "That code isn’t right. Check the latest message."

**Screen `about`: About you**

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Full name as on your ID | text | yes | letters, spaces, apostrophes, dots, dashes; at least 2 characters | "Use letters only." |
| | | | at least a first and last name | "Enter your first and last name." |
| Date of birth | text, placeholder "DD/MM/YYYY", up to 10 | yes | a real date in that format | "Use the format DD/MM/YYYY." |
| | | | not in the future and not over 110 years | "Check the date." |
| | | | 18 or older | "You must be 18 or older to open this account." |
| Nationality | select (a list of countries) | yes | one chosen | none |
| National ID number | text; placeholder and rule from the home market | yes | the market’s format | the market’s message |

**Screen `address`: Address**

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Address line 1 | text | yes | at least 3 characters | none (button stays disabled) |
| Address line 2 | text | no | none | none |
| City | text, half width | yes | not empty | none |
| Postcode | text, half width (not drawn in Market D) | yes | 3 to 10 letters, numbers, spaces or dashes | "Enter a valid postcode." |
| Country | select | yes | one chosen | none |

**Screen `poa`: Proof of address** (shown only when the market asks and `requirePoa` is on). One photo field: "A recent utility bill or tenancy contract" (placeholder "Take a photo"). A document older than 3 months is refused: "The proof of address must be from the last 3 months."

**Screen `idv`: Verify your identity**

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Document | chips "National ID card", "Passport", "Driving licence" | yes | one chosen | none |
| Front | photo, placeholder "Take a photo" | yes | readable and not expired | unreadable: "We couldn’t read the ID. Retake it in good light."; expired: "This ID has expired. Use one that is still valid." |
| Back | photo (not drawn for a passport) | yes | as above | as above |

**Screen `selfie`: Take a selfie** (button **Continue**, busy "Checking your ID…")

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Selfie | photo, placeholder "Take a photo" | yes | a live face in good light | too dark: "It was too dark to see your face."; not live: "We couldn’t confirm a live person." |

On Continue the bank compares the photos and answers with the details entered. If they do not match (including the birth-year check in Market D), the photos are discarded, the person goes back to `idv` and sees "The details on your ID don’t match what you entered. Check them and retake the photos."

**Screen `work`: Work and money**

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Employment | select: Employed, Self-employed, Student, Retired, Not working | yes | one chosen | none |
| Yearly income before tax | select: Under {s}25,000; {s}25,000 to {s}50,000; {s}50,000 to {s}100,000; {s}100,000 to {s}250,000; {s}250,000 to {s}1M; Over {s}1M | yes | one chosen | none |
| Source of funds | select: Salary, Business income, Savings, Pension, Investments, Gift or inheritance | yes | one chosen | none |
| Expected monthly deposits | select: Under {s}2,000; {s}2,000 to {s}10,000; {s}10,000 to {s}50,000; Over {s}50,000 | yes | one chosen | none |

({s} is the market’s currency symbol.)

**Screen `tax`: Tax**

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Are you a tax resident only here? | chips "Yes", "No" | yes | one chosen | none |
| Country of tax residence | select (shown for No) | yes then | one chosen | none |
| Tax ID | text (shown for No) | yes then | at least 4 characters | "Enter your tax ID." |

An invalid tax ID format from the bank: "The tax ID isn’t in the right format."

**Screen `product`: Choose your account.** Choice cards: **Everyday Account** ("No monthly fee, with a debit card"); **Aurora Savings** ("Earn interest, withdraw any time"; only when `offerSaver` is on); **Everyday Islamic Account** ("Profit sharing, no interest"; only when `offerIslamic` is on). Default Everyday Account; `productId acc_saver` chooses Aurora Savings.

**Screen `review`: Review and agree** (button **Submit**, busy "Sending…")

Rows: "Name", "Date of birth", "National ID number" (masked, for example "•••• 678"), "Address", "Account".

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Terms | checkbox "I agree to the terms and the privacy notice." | yes | ticked | "Please agree to continue." |
| Tax declaration | checkbox with the market’s text (see the table) | yes | ticked | "Please confirm to continue." |

On Submit, an application reference "APP-…" is created. Income "Over {s}1M" with `reviewHigh` on sends the application to manual review.

**Screen `status`: Your application** (button **Finish**). Green tick, title "Application received", "Reference {APP-…}". A timeline: "Received" ("We have your application."); "Checking your ID" ("This usually takes a few minutes.") or, for manual review, "A few more checks" ("A person is looking at your application. We may email you."); "Ready" ("Your account is open.").

**Result.** Title "You’re all set", text "We’ll tell you when your account is ready." (or "We’ll email you when it’s ready." for manual review), chip "Checking your ID" (or "A few more checks"). Rows "Account" and "Name". Button **Sign in** (`sign-in`).

**Saving.** **Save and finish later**, or leaving the journey, saves the answers once the mobile number is verified: "Saved. Continue any time in the next 30 days." The ID, proof of address and selfie photos and the code are never kept, so a resumed application restarts at the first photo step.

**States**
- Loading: each button shows a spinner and its busy text for 0.5 to 1.2 seconds.
- Empty: not applicable.
- Error: unavailable: "We couldn’t reach the bank. Your answers are saved." with **Try again**. Timeout: "This is taking longer than expected. Nothing was sent." with **Try again**. Declined: "We can’t open this account online. Please contact us." with **Contact us** (`contact-support`) (planned; the prototype never declines).

#### 4. Sandbox errors

Codes are for tests and the sandbox; the customer sees only the message.

| Code | Message | Shows on | Button |
|---|---|---|---|
| `UNDER_AGE` | "You must be 18 or older to open this account." | about | none (edit the date) |
| `VERIFY_CODE_INVALID` | "That code isn’t right. Check the latest message." | start | Try again |
| `DUPLICATE_APPLICATION` | "We already have an application with these details. Sign in instead." | start | Sign in |
| `PHONE_INVALID` | "The mobile number isn’t in the right format." | start | none |
| `POSTCODE_INVALID` | "The postcode isn’t in the right format." | address | none |
| `ID_UNREADABLE` | "We couldn’t read the ID. Retake it in good light." | idv | Retake |
| `ID_EXPIRED` | "This ID has expired. Use one that is still valid." | idv | Retake |
| `ID_MISMATCH` | "The details on your ID don’t match what you entered. Check them and retake the photos." | selfie, then idv | Retake |
| `LIVENESS_LOW_LIGHT` | "It was too dark to see your face." | selfie | Retake |
| `LIVENESS_FAILED` | "We couldn’t confirm a live person." | selfie | Retake |
| `POA_TOO_OLD` | "The proof of address must be from the last 3 months." | poa | Retake |
| `TIN_INVALID` | "The tax ID isn’t in the right format." | tax | none |
| `APPLICATION_NOT_ACCEPTED` | "We can’t open this account online. Please contact us." | review | Contact us |
| `SERVICE_UNAVAILABLE` | "We couldn’t reach the bank. Your answers are saved." | any step | Try again |
| `TIMEOUT` | "This is taking longer than expected. Nothing was sent." | any step | Try again |
| `JOURNEY_DISABLED` | "This isn’t available at your bank." | whole journey | none |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `sendOtp` / `verifyOtp` | `bank.otp.send` / `bank.otp.verify` | `{channel}` / `{code}` | `{sent}` / `{verified}` | `OTP_INVALID` | Existing (`packages/mock-bank-api/src/index.ts`) |
| `startApplication` | `bank.onboarding.start` | `{mobile, email}` | `{applicationId}` | `DUPLICATE_APPLICATION`, `PHONE_INVALID` | (planned) |
| `saveApplication` | `bank.onboarding.save` | `{applicationId, answers}` | `{savedUntil}` | `SERVICE_UNAVAILABLE` | (planned). Photos and the code are never sent to it |
| `checkIdentity` | `bank.onboarding.verifyIdentity` | `{applicationId, document, front, back?, selfie, poa?}` | `{match}` | `ID_UNREADABLE`, `ID_EXPIRED`, `ID_MISMATCH`, `LIVENESS_LOW_LIGHT`, `LIVENESS_FAILED`, `POA_TOO_OLD` | (planned). Compares the photos with the details entered |
| `submitApplication` | `bank.onboarding.submit` | `{applicationId, answers, product}` | `{reference, status: "checking" \| "manual-review"}` | `UNDER_AGE`, `TIN_INVALID`, `POSTCODE_INVALID`, `APPLICATION_NOT_ACCEPTED` | (planned) |
| `applicationStatus` | `bank.onboarding.status` | `{reference}` | `{stage}` | none | (planned). Used by `track-application` |

#### 6. Permissions, step-up and limits

No permission (public). Step-up: the one-time code to the mobile at `start` is the only proof before the application is saved; the ID, selfie and (where asked) proof of address follow. Limits: age 18 or over; a proof of address must be under 3 months old; a saved application is kept for 30 days; the 10-second timeout applies to every call.

#### 7. Result and links out

Result as above; the receipt is the application reference. Notifications raised (planned): an email and a text "We received your application {APP-…}"; "Your account is open" or "We need more from you" when the bank decides. Links out: `sign-in`, `track-application` (planned), `contact-support`.

#### 8. Acceptance criteria

- AC-1: The flow is the same for every customer; only the national ID format, the proof of address, the currency symbol, the postcode field and the tax wording follow the bank’s home market.
- AC-2: The mobile and email are verified with a 6-digit code before the person goes on; an existing application stops with "We already have an application with these details. Sign in instead."
- AC-3: A date of birth under 18 is refused; an invalid or future date is refused.
- AC-4: The national ID number is checked against the market’s format with the market’s message.
- AC-5: The proof of address step appears only when the market asks and `requirePoa` is on, and refuses a document older than 3 months.
- AC-6: A passport asks for one photo; other documents ask for front and back.
- AC-7: At the selfie step, ID details that do not match what was entered discard the photos and send the person back to the ID step with the mismatch message.
- AC-8: A person who is not a tax resident only here must give a country and a tax ID.
- AC-9: The account choice shows only the accounts the bank offers; `acc_saver` preselects the savings account.
- AC-10: Submit needs both ticks; the review shows the ID number masked.
- AC-11: Income over 1M with `reviewHigh` on shows "A few more checks" and the email wording.
- AC-12: Save and finish later keeps the answers for 30 days without the photos; Continue returns to the first photo step; Start again discards the saved application; with `allowSave` off there is no button and no resume.
- AC-13: When the bank is unavailable or times out nothing is lost and the person is told so.

#### 9. Scenarios

Synthetic person Alex Morgan, born 14/03/1990, "today" Tue 3 Nov 2026. The sandbox accepts a fixed test code and accepts the sample photos; the toolbar Autofill step fills each step with matching sample values for the bank’s home market.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-9, AC-10 | Alex, each home market A to D | none | Autofill every step and submit. Result "You’re all set"; the status step shows "Application received" with an APP- reference. Market D asks for the proof of address; the others do not. |
| T-2 | AC-2 | Alex | none | A wrong code: "That code isn’t right. Check the latest message." The email `duplicate@example.com`: "We already have an application with these details. Sign in instead." |
| T-3 | AC-3 | Alex | none | Date of birth 14/03/2010: "You must be 18 or older to open this account." 31/02/1990 or 14-03-1990: "Use the format DD/MM/YYYY." A future date: "Check the date." |
| T-4 | AC-4 | Alex, each market | none | A national ID number in the wrong format shows the market’s message. |
| T-5 | AC-5 | Alex, Market D | `requirePoa` on, then off | The step shows with the setting on and is absent with it off; a document over 3 months old is refused. |
| T-6 | AC-6 | Alex | none | Passport: only Front. National ID card: Front and Back. |
| T-7 | AC-7 | Alex, Market D, national ID number with another birth year | none | At the selfie step: "The details on your ID don’t match what you entered. Check them and retake the photos." and the ID step is shown with empty photos. |
| T-8 | AC-8 | Alex | none | Tax resident only here: No, with no country or tax ID: the button is disabled; "Enter your tax ID." on a short value. |
| T-9 | AC-9 | Alex | `offerSaver` off; `offerIslamic` on | Only Everyday Account and Everyday Islamic Account show. Deep link `acc_saver` with the savings account on preselects it. |
| T-10 | AC-11 | Alex | income Over 1M, `reviewHigh` on and off | On: "A few more checks" and "We’ll email you when it’s ready." Off: "Checking your ID". |
| T-11 | AC-12 | Alex | `allowSave` on, then off | Save and finish later after the address step; reopen: "Welcome back" with the saved name and "You’ll retake your photos." Continue starts at the ID step; Start again begins at Get started. Off: no button, no resume. |
| T-12 | AC-13 | Alex | `unavailable: ["bank.onboarding.submit"]` (prototype: Service down on) | "We couldn’t reach the bank. Your answers are saved." and the answers are still there after Try again. |
| T-13 | AC-13 | Alex | `timeout: ["bank.onboarding.submit"]`, `latencyMs: 10000` | After 10 seconds: "This is taking longer than expected. Nothing was sent." No application reference exists. |

#### 10. Expected mutation-check survivors

The market-specific checks (ID format, proof of address, birth-year match) survive a mutation that changes a market not used by the scenario; run T-1 and T-4 for all four markets to kill them. The 30-day keep period is not enforced in the prototype; a mutation there cannot be checked yet. The rule that photos are never saved is observable only through T-11. Everything else: none expected.

---

### ★ Track my application — `track-application`

**Catalog:** slug `track-application`, workspace `public`, category Public: before sign-in (prototype tag "Before you sign in"), core no, can a bank switch it off: yes (basic entry, kept in the Lean preset). Options (key, label, default): `askCode` "Ask for a one-time code before showing the status" (on). Research: `research/track-application.md`. Built in `design/bankworkx-r1/src/journeys/53-track.js`.

The lean rework reduced the tracker to three stages and removed document upload, appointment booking and the full timeline. What remains: find an application with its number and the mobile number, confirm with a code, see where it is, and when it is ready go on to register for digital banking.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `track-application` |
| Purpose | Show where an account application is: received, checking your ID, or ready. |
| Release / workspace | 1 / Public (before sign-in) |
| Status | Built in the prototype as a two-screen form journey (`submit: "Show status"`). It also finds the application a person just made in `open-account`. No money moves. |
| Channels | Web and mobile |
| Starting pattern | None in the fixtures |
| Who may use it | Anyone with the application number and the mobile number. No permission. |

**Stages.** The status is one of three: Received, Checking your ID, Ready.

**Sandbox applications (not shown on screen).** APP-100234, mobile ending 0123, Jordan, Everyday Account, stage "Checking your ID", sent Tue 3 Nov 2026. APP-100235, mobile ending 0124, Sam, Everyday Account, stage "Ready", account number ending 2208. Any application made in `open-account` in the same session is found too. The match needs the application number (ignoring capitals and spaces at the ends) and the last 6 digits of the mobile number. One-time code: any 6 digits is accepted, `000000` is wrong, `999999` is expired. Three wrong tries (details or codes together) lock the journey; the prototype shortens the 30 minutes to 2 minutes.

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Landing › Track my application | none | none |
| Notification › Application update | `{applicationId}` (prefills the number) | none |
| `open-account` › Done › Track my application | `{applicationId}` | none |
| Deep link `/public/j/track-application?applicationId=APP-100234` | `{applicationId}` | none |

#### 3. Screens

Steps in order: `find`, `code` (with `askCode`), then the result.

**Screen `find`** ("Track my application"). Text "Enter the number we sent you." Button **Continue**, busy "Looking for your application…" (about 0.8 seconds).

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| Application number | `text`, placeholder "APP-123456", max 20 | Yes | `APP-` and 6 digits, any capitals | "Enter the number as shown, like APP-123456." |
| Mobile number | `tel`, placeholder "Mobile number", max 20 | Yes | 7 to 18 digits, spaces, brackets, dashes, optional leading + | "Enter a valid mobile number." |

Not found: "We couldn’t find an application with those details. Check them and try again." The third wrong try locks the screen: the fields are replaced by a card "Too many tries", "For your security, try again in 30 minutes, or contact us.", button **Contact us** (`contact-support`); the step is blocked with "Too many tries. Try again in 30 minutes."

**Screen `code`** ("Enter your code"). Shown only with `askCode`. Card "Code sent", "We sent a 6-digit code to ••• {last 4 digits}." Button **Continue**, busy "Checking your code…" (about 0.7 seconds).

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| 6-digit code | `text`, placeholder "000000", max 6 | Yes | Exactly 6 digits | "Enter the 6 digits from the message." |

A wrong code (`000000`) clears the field and counts towards the lock: "That code isn’t right. Check the latest message and try again." An expired code (`999999`): "That code has expired. Ask for a new one." The prototype has no Resend button on this step (open point: add one, as in `register-digital-banking`; planned).

**Result.** Chip and title by stage, reference = the application number. Rows, in order: "Account" (the product, when known), then one row per stage: **Done** for stages before the current one, **In progress** for the current one (or **Done** when the current one is Ready), **Next** for later ones; "Account number" (for example ••2208) when Ready.

| Stage | Title | Text | Chip | Button |
|---|---|---|---|---|
| Received | "We’ve received your application" | "We’ll text you when something changes." | Received (amber) | **Contact us** |
| Checking your ID | "We’re checking your ID" | "We’ll text you when something changes." | Checking your ID (amber) | **Contact us** |
| Ready | "Your account is ready" | "One last step: set up your online login." | Ready (green) | **Register for digital banking** (opens `register-digital-banking` with `{applicationId}`) |

**States**
- Loading: busy text on the button as above.
- Empty: not applicable.
- Error: "We couldn’t reach the bank. Try again in a few minutes." The Service down switch shows the standard connection sheet ("We couldn’t reach the bank", "Nothing was sent and you haven’t been charged. Try again in a moment.", **Try again**).
- Timeout: "This is taking longer than expected. Try again."
- Locked: as above.

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `NOT_FOUND` | "We couldn’t find an application with those details. Check them and try again." | `find` | Try again |
| `TRACK_LOCKED` | "Too many tries. For your security, try again in 30 minutes, or contact us." | `find`, `code` | Contact us |
| `OTP_INVALID` | "That code isn’t right. Check the latest message and try again." | `code` | Try again |
| `OTP_EXPIRED` | "That code has expired. Ask for a new one." | `code` | Back |
| `SERVICE_UNAVAILABLE` | "We couldn’t reach the bank. Try again in a few minutes." | `find`, `code` | Try again |
| `TIMEOUT` | "This is taking longer than expected. Try again." | `find`, `code` | Try again |
| `JOURNEY_DISABLED` | "This isn’t available at your bank." | whole journey | none |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `findApplication` | `bank.applications.find` | `{reference, mobile}` | `{reference, product, stage, accountLast4?}` | `NOT_FOUND`, `TRACK_LOCKED`, `SERVICE_UNAVAILABLE`, `TIMEOUT` | (planned). The prototype reads `TR_APPS` and `OA.app` |
| `sendOtp` / `verifyOtp` | `bank.otp.send` / `bank.otp.verify` | `{channel}` / `{code}` | `{sent}` / `{verified}` | `OTP_INVALID`, `OTP_EXPIRED` | Existing (`packages/mock-bank-api/src/index.ts`) |

#### 6. Permissions, step-up and limits

None. The one-time code is the step-up and is on by default (`askCode`). Limits: 3 wrong tries lock the journey for 30 minutes (2 minutes in the prototype).

#### 7. Result and links out

Result as above. Notification raised (planned): a text when the stage changes ("Your BankWorkx® application {reference} has moved to: {stage}"). Links out: `register-digital-banking`, `contact-support`, `open-account`.

#### 8. Acceptance criteria

- AC-1: The application number must be `APP-` and 6 digits and the mobile number must be valid before the button works.
- AC-2: A match needs both the number and the last 6 digits of the mobile; otherwise the person sees "We couldn’t find an application with those details. Check them and try again." and no hint which part was wrong.
- AC-3: With `askCode` on a code is required before the status shows; with it off the status shows after the details.
- AC-4: Three wrong tries (details and codes together) lock the journey with the "Too many tries" card and a link to `contact-support`.
- AC-5: The status rows follow the stage rule (Done, In progress, Next; all Done when Ready) and the chip and title follow the table.
- AC-6: A Ready application shows the account number and the button **Register for digital banking** with the application number.
- AC-7: An application made in `open-account` can be tracked straight away.
- AC-8: When the bank is unavailable or times out nothing is shown and the person can try again.

#### 9. Scenarios

Synthetic anonymous visitor.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1 | Visitor | none | "APP-12" gives "Enter the number as shown, like APP-123456."; mobile "12" gives "Enter a valid mobile number." |
| T-2 | AC-2, AC-3, AC-5 | Visitor | none | APP-100234 with 5550100123, any code except 000000 and 999999: title "We’re checking your ID"; rows Account "Everyday Account", Received "Done", Checking your ID "In progress", Ready "Next". |
| T-3 | AC-2 | Visitor | none | APP-100234 with a different mobile: "We couldn’t find an application with those details. Check them and try again." |
| T-4 | AC-4 | Visitor | none | Two wrong detail tries, then a wrong code: the third shows the "Too many tries" card; the fields are gone. |
| T-5 | AC-3 | Visitor | none | Code 999999: "That code has expired. Ask for a new one." Code 000000: "That code isn’t right. Check the latest message and try again." |
| T-6 | AC-3 | Visitor, `askCode` off | none | No code screen; the status shows after the details. |
| T-7 | AC-5, AC-6 | Visitor | none | APP-100235 with 5550100124: title "Your account is ready", all stages "Done", "Account number" "••2208", button **Register for digital banking**. |
| T-8 | AC-7 | Visitor | none | Finish `open-account`, then track with its number and mobile: found. |
| T-9 | AC-8 | Visitor | `unavailable: ["bank.applications.find"]` (prototype: Service down on) | Connection sheet; nothing shown. |
| T-10 | AC-8 | Visitor | `timeout: ["bank.applications.find"]`, `latencyMs: 10000` | After 10 seconds: "This is taking longer than expected. Try again." |

#### 10. Expected mutation-check survivors

The 30-minute lock length survives because the sandbox lock is 2 minutes and not asserted; expected. The text notification is not asserted; expected. Everything else: none expected.

---

### ★ Register for digital banking — `register-digital-banking`

**Catalog:** slug `register-digital-banking`, workspace `public`, category Public: before sign-in (prototype tag "Before you sign in"), core no, can a bank switch it off: yes (basic entry, kept in the Lean preset). Options (key, label, default): `allowCard` "Let people identify with a card number" (on); `trustDevice` "Offer to trust this device" (on). Research: `research/register-digital-banking.md`. Built in `design/bankworkx-r1/src/journeys/52-register-recover.js`, with the helper object `RC` shared with `reset-password` and `forgot-username`.

The lean rework removed the per-market identity documents, the activation letter and the security questions. What remains: an existing customer proves who they are with a customer ID (or a card) and a date of birth, confirms a code sent to the mobile number the bank holds, chooses a username and password, and may trust the device.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `register-digital-banking` |
| Purpose | Let an existing customer who has never used digital banking prove who they are, confirm a one-time code, and choose a username and password. |
| Release / workspace | 1 / Public (before sign-in) |
| Status | Built in the prototype as a four-screen form journey (`submit: "Finish"`). Starting pattern in code: the CAB enrolment and activation adapters (`cab.enroll.retail`, `cab.activate.validate`, `cab.activate.setPassword` in `packages/mock-bank-api/src/cab.ts`). No money moves. |
| Channels | Web and mobile |
| Starting pattern | `fixtures/cab.ts` (enrol, activate, set password) |
| Who may use it | An existing customer aged 18 or over who is not yet registered. No permission. |

**Sandbox customers (not shown on screen).** Customer ID 20481993 or card 5555 5555 5555 4444: not registered, born 1 Jan 1990, mobile ending 0177 (Jordan Lee). Customer ID 20440010 or card 4242 4242 4242 4242: already registered (Alex Morgan). One-time code: any 6 digits is accepted, `000000` is wrong, `999999` is expired. Three wrong identity checks or codes lock the journey; the prototype shortens the 30 minutes to 2 minutes. Usernames that are always taken: admin, administrator, bankworkx, jordan.lee, alex.morgan, sam.rivera, customer, support, and any username already registered.

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Landing › Register | none | none |
| `sign-in` › Register | none | none |
| `track-application` result (Ready) › **Register for digital banking** | `{applicationId}` | none |
| Deep link `/public/j/register-digital-banking` | none | none |

With `applicationId` the identity screen is skipped (the application already proved who the person is) and the flow starts at the code.

#### 3. Screens

Steps in order: `find` (skipped with an application number), `code`, `creds`, `device` (with `trustDevice`), then the result.

**Screen `find`** ("Register for digital banking"). Text "Tell us who you are." Button **Continue**, busy "Checking your details…" (about 0.8 seconds).

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| (no label) | `chips`: Customer ID, Card number. Shown only with `allowCard`. Default Customer ID | No | One of two | none |
| Customer ID | `text`, placeholder "8 digits", max 8 (when Customer ID is chosen) | Yes | 8 digits | "Enter your 8-digit customer ID." |
| Card number | `text`, placeholder "16 digits", max 23 (when Card number is chosen) | Yes | 13 or more digits that pass the check-digit test | "Check the card number." |
| Date of birth | `select` Day, 1 to 31 (half width) | Yes | A day | "This is required." |
| Month | `select`, January to December (half width) | Yes | A month | "This is required." |
| Year | `text`, placeholder "1990", max 4 | Yes | 4 digits starting 19 or 20; a real date; in the past; the person is 18 or over | "Enter a 4-digit year." and "That date doesn’t exist." and "Enter a date in the past." and "You need to be 18 or over to register online." |

Results: no customer matches the ID (or card) and the date of birth: "We couldn’t match those details. Check them and try again." The customer is already registered: "You’re already registered. Sign in, or reset your password if you’ve forgotten it." The third no-match locks the screen: the fields are replaced by a card "Too many tries", "For your security, try again in 30 minutes, or contact us.", button **Contact us** (`contact-support`); the step is blocked with "Too many tries. Try again in 30 minutes." The message never says which part did not match.

**Screen `code`** ("Enter your code"). Card "Code sent", "We sent a 6-digit code to ••• {last 4 digits of the mobile}." with the button **Resend code**. Button **Continue**, busy "Checking your code…" (about 0.7 seconds).

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| 6-digit code | `text`, placeholder "000000", max 6 | Yes | Exactly 6 digits | "Enter the 6 digits from the message." |

**Resend code** says "New code sent. The old code no longer works." After 3 resends it says "You have asked for the maximum number of codes. Try again later." A wrong code clears the field and counts towards the same lock as the identity check: "That code isn’t right. Check the latest message and try again." An expired code: "That code has expired. Ask for a new one."

**Screen `creds`** ("Choose your sign-in details"). Button **Continue**, busy "Setting up…" (about 0.8 seconds, on the last screen when the device screen is off).

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| Username | `text`, placeholder "6 to 30 characters", max 30 | Yes | 6 to 30 letters, numbers, dots, dashes or underscores; not taken (ignoring capitals) | "Use 6 to 30 letters, numbers, dots, dashes or underscores." and "That username is taken. Try another." |
| Password | `password`, placeholder "At least 12 characters", max 64, with a Show or Hide button | Yes | At least 12 and at most 64 characters; not containing the username (3 or more characters); not a common password; not in a known data breach; not one used before at the bank | "Use at least 12 characters. Three or four unrelated words work well." / "Use 64 characters or fewer." / "Don’t use your username in your password." / "That password is too common. Try a longer phrase of unrelated words." / "This password has appeared in a data breach, so we can’t accept it." / "Choose a password you haven’t used here before." |
| Confirm password | `password`, max 64 | Yes | Same as Password | "The two passwords don’t match." |
| (checkbox) | `check`: "I agree to the online banking terms." | Yes | Ticked | "Please agree to continue." |

Under the fields a live checklist shows four rules, each with ✓ when met and ○ when not: "At least 12 characters", "Not your username", "Not a common password", "Not in a known data breach". No composition rules (capitals, symbols) are required.

**Screen `device`** ("Trust this device?"). Shown only with `trustDevice`. Text "You won’t need a code for 90 days." Button **Finish**.

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| Trust this device | `toggle`, sub-line "Turn off on a public or shared device." Default on | No | none | none |
| Device name | `text`, max 30, default "My phone" (shown when the toggle is on) | Yes | Not empty | "This is required." |

**Result** ("You’re registered", green, text "Sign in with your username and password."). Chip Done. Rows "Username", "This device" ("Trusted" or "Not trusted"). Buttons **Sign in** (opens `sign-in` with `{user}`) and **Done**.

**States**
- Loading: busy text on the button as above.
- Empty: not applicable.
- Error: "We couldn’t reach the bank. Nothing was changed." The Service down switch shows the standard connection sheet ("We couldn’t reach the bank", "Nothing was sent and you haven’t been charged. Try again in a moment.", **Try again**). Nothing is registered.
- Timeout: "This is taking longer than expected. Nothing was changed."
- Locked: as above.

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `NOT_MATCHED` | "We couldn’t match those details. Check them and try again." | `find` | Try again |
| `ALREADY_REGISTERED` | "You’re already registered. Sign in, or reset your password if you’ve forgotten it." | `find` | Sign in |
| `ID_LOCKED` | "Too many tries. For your security, try again in 30 minutes, or contact us." | `find`, `code` | Contact us |
| `OTP_INVALID` | "That code isn’t right. Check the latest message and try again." | `code` | Try again |
| `OTP_EXPIRED` | "That code has expired. Ask for a new one." | `code` | Resend code |
| `USERNAME_TAKEN` | "That username is taken. Try another." | `creds` | Change username |
| `SERVICE_UNAVAILABLE` | "We couldn’t reach the bank. Nothing was changed." | any step with a call | Try again |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | any step with a call | Try again |
| `JOURNEY_DISABLED` | "This isn’t available at your bank." | whole journey | none |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `verifyCustomer` | `bank.registration.verify` | `{customerId or cardNumber, dateOfBirth}` | `{registrationToken, maskedMobile}` | `NOT_MATCHED`, `ALREADY_REGISTERED`, `ID_LOCKED`, `SERVICE_UNAVAILABLE`, `TIMEOUT` | (planned). The CAB twin is `cab.enroll.retail` |
| `sendOtp` / `verifyOtp` | `bank.otp.send` / `bank.otp.verify` | `{channel}` / `{code}` | `{sent}` / `{verified}` | `OTP_INVALID`, `OTP_EXPIRED`, `ID_LOCKED` | Existing (`packages/mock-bank-api/src/index.ts`); CAB twin `cab.activate.validate` |
| `passwordPolicy` | `bank.password.policy` | `{username}` | the rules and the breach and common-password checks | none | (planned). The CAB twin is `cab.password.policy` |
| `completeRegistration` | `bank.registration.complete` | `{registrationToken, username, password, trustDevice, deviceName}` | `{username}` | `USERNAME_TAKEN`, `POLICY`, `SERVICE_UNAVAILABLE`, `TIMEOUT` | (planned). The CAB twin is `cab.activate.setPassword` |

#### 6. Permissions, step-up and limits

None before sign-in. The one-time code is the step-up. Limits: 3 wrong identity checks or codes lock the journey for 30 minutes (2 minutes in the prototype); at most 3 resends of the code; password 12 to 64 characters; a trusted device skips the code for 90 days.

#### 7. Result and links out

Result as above. Notifications raised (planned): a text and an email "You registered for BankWorkx® digital banking" to the contacts on file; if the device is trusted, "A trusted device was added". Links out: `sign-in`, `contact-support`, `reset-password`.

#### 8. Acceptance criteria

- AC-1: The customer ID needs 8 digits, a card number must pass the check-digit test, and the date must be real, in the past, and 18 or more years ago.
- AC-2: A customer who does not match gets one message that does not say which part failed; the third failure locks the journey.
- AC-3: A customer who is already registered is told to sign in or reset the password.
- AC-4: The code goes to the mobile number on file, shown only as its last 4 digits; a wrong code counts towards the same lock; an expired code asks for a new one; at most 3 resends.
- AC-5: The password follows the four visible rules plus the breach and used-before checks, and the checklist updates as the person types.
- AC-6: The username follows the format and cannot be one that is taken.
- AC-7: Terms must be ticked.
- AC-8: With `trustDevice` on the device screen is shown and the receipt says Trusted or Not trusted; with it off the screen is absent.
- AC-9: With `applicationId` the identity screen is skipped.
- AC-10: With `allowCard` off only the customer ID is offered.
- AC-11: When the bank is unavailable or times out nothing is registered.

#### 9. Scenarios

Synthetic persona `jordan` (existing customer, not registered).

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1 | `jordan` | none | Customer ID "1234": "Enter your 8-digit customer ID." Year 2015: "You need to be 18 or over to register online." 31 February: "That date doesn’t exist." |
| T-2 | AC-2 | `jordan` | none | Customer ID 20481993 with the wrong date of birth, three times: the first two show "We couldn’t match those details. Check them and try again."; the third shows the "Too many tries" card. |
| T-3 | AC-3 | `jordan` | none | Customer ID 20440010, born 1 Jan 1990: "You’re already registered. Sign in, or reset your password if you’ve forgotten it." |
| T-4 | AC-4 | `jordan` | none | Valid details: "We sent a 6-digit code to ••• 0177." Code 000000: "That code isn’t right. Check the latest message and try again." Code 999999: "That code has expired. Ask for a new one." The 4th Resend: "You have asked for the maximum number of codes. Try again later." |
| T-5 | AC-5, AC-6, AC-7 | `jordan` | none | Username "admin": "That username is taken. Try another." Password "short": "Use at least 12 characters. Three or four unrelated words work well." Password containing the username: "Don’t use your username in your password." Different confirmation: "The two passwords don’t match." Terms unticked: "Please agree to continue." |
| T-6 | AC-8 | `jordan` | none | Trust on, device name "My phone": result row "This device" "Trusted". Toggle off: "Not trusted". With `trustDevice` off: no device screen. |
| T-7 | AC-9 | `jordan`, `applicationId: "APP-100235"` | none | The first screen is "Enter your code". |
| T-8 | AC-10 | `jordan`, `allowCard` off | none | No Customer ID or Card number chips. |
| T-9 | AC-11 | `jordan` | `unavailable: ["bank.registration.complete"]` (prototype: Service down on) | Connection sheet; nothing registered; the username can still be used afterwards. |
| T-10 | AC-11 | `jordan` | `timeout: ["bank.registration.complete"]`, `latencyMs: 10000` | After 10 seconds: "This is taking longer than expected. Nothing was changed." |

#### 10. Expected mutation-check survivors

The breach list and the common-password list are a short sandbox sample; a mutation that removes one word survives; expected. The 90-day trust period is stated in text only and not asserted; expected. The lock length survives (2 minutes in the sandbox); expected. Everything else: none expected.

---

## Signing in and security

This group covers how a person gets in, stays safe, and gets back in when something goes wrong. It has six shell rules and screens (returning sign-in, session timeout, step-up, sign-out, system states, Settings › Security) and eight ★ journeys: `sign-in`, `setup-quick-login`, `forgot-username`, `reset-password`, `unlock-account`, `change-password`, `trusted-devices`, `change-quick-pin`.

**Starting pattern.** The Cairo Amman Bank access journeys (`packages/journey-schema/src/fixtures/cab.ts`: `sign-in`, `default-sign-in`, `cant-sign-in`) and their sandbox (`packages/mock-bank-api/src/cab.ts`, adapters `cab.auth.signIn`, `cab.device.*`, `cab.recover.*`, `cab.password.policy`) are the model. BankWorkx® copies their outcomes and numbers exactly and renames the adapters to `bank.*` (planned, in the new `identity.ts`, step 2 of the plan). Where BankWorkx® goes beyond CAB, the text says so.

**Sandbox rules carried over from `cab.ts` (existing, to be reused by the `bank.*` adapters):**

| Rule | Value in `cab.ts` | Where it shows |
|---|---|---|
| `MAX_FAILED_LOGINS` | 3 wrong passwords lock the profile. The third wrong try already answers `LOCKED`. | `sign-in`, `unlock-account` |
| `LOCK_MINUTES` | 30. Returned as `lockMinutes` with `LOCKED`. | `sign-in`, `unlock-account` |
| Attempts left | `attemptsLeft = 3 - failed` (2, then 1). Unknown usernames count too, so the screen never reveals whether a username exists. | `sign-in` |
| A right password | Sets the failed count back to 0. A reset password does the same and also clears `LOCKED` and `PASSWORD_EXPIRED`. | `sign-in`, `reset-password` |
| Password rules (`PASSWORD_RULES`, `passwordProblems`) | At least 8 characters, at most 100, at least 5 different characters, must not contain the username (not case sensitive). Problem codes `MIN_LENGTH`, `MAX_LENGTH`, `DIFFERENT_CHARS`, `CONTAINS_USERNAME`. A confirm that differs gives `MISMATCH`. | `reset-password`, `change-password` |
| PIN | Exactly six digits, else `PIN_INVALID` ("A PIN is six digits"). Mode must be `password`, `pin` or `biometric`, else `INVALID_MODE`. | `setup-quick-login`, `change-quick-pin` |
| Picture code | `cab.captcha.generate` gives `{ serviceKey, text }`; a wrong value gives `CAPTCHA_WRONG`. | `forgot-username`, `reset-password`, `unlock-account` |
| One-time code | `bank.otp.send` then `bank.otp.verify`. Code `482100` (and `000000`) is accepted. Wrong codes throw `OTP_INVALID` carrying the attempt number. The engine counts failures only for an integration named exactly `otpVerify`. `lockAfter: 3` then `lockTo` a locked screen. | `sign-in`, recovery journeys |
| Sign-in answer | `{ ok: true, firstName, lastLogin, defaultSignIn, accountCount, netWorth, currency }` or `{ ok: false, code, errorCode, … }` with codes `INVALID_CREDENTIALS` (10095), `LOCKED` (10088), `INACTIVE` (10092), `PASSWORD_EXPIRED` (10135). Outcomes come back as data so a journey can route on them; only misuse throws. | `sign-in` |

**Planned seed users** (sandbox seed file only; every password is the demo password `Bwx!Demo2026`, one-time code `482100`):

| Username | Person | Status | What it shows |
|---|---|---|---|
| `alex.morgan` | Alex Morgan | Active | Retail customer, Maker at Alpha Trading LLC, Approver at Beta Services Ltd. Phone +1 415 555 0142 (masked `+• ••• ••• 0142`), email `alex.morgan@example.com`, born 14/03/1988. Three trusted devices (see `trusted-devices`). |
| `sam.rivera` | Sam Rivera | Active | New customer, empty states. |
| `demo.locked` | Jamie Locke | Locked | The `LOCKED` outcome and `unlock-account`. Email `jamie.locke@example.com`, phone +1 415 555 0177, born 02/03/1990. |
| `demo.expired` | Omar Nassar | Password expired | The `PASSWORD_EXPIRED` outcome. Email `omar.nassar@example.com`, phone +1 415 555 0150, born 20/11/1995. |
| `demo.inactive` | Yasmin Khoury | Not active | The `INACTIVE` outcome. |

**New adapters for this group (all planned, `identity.ts`).** Each journey lists the ones it calls in its own adapter table. Names follow the sandbox style `bank.<domain>.<verb>`.

| Adapter (planned) | Models | Used by |
|---|---|---|
| `bank.auth.signIn`, `bank.auth.completeSignIn`, `bank.auth.signOut` | `cab.auth.signIn` | `sign-in`, shell |
| `bank.device.options`, `bank.device.setDefault`, `bank.device.verifyPin`, `bank.device.register` | `cab.device.options`, `.setDefault`, `.verifyPin` | `sign-in`, `setup-quick-login`, `change-quick-pin` |
| `bank.devices.list`, `bank.devices.rename`, `bank.devices.remove` | new | `trusted-devices`, Settings › Security |
| `bank.recover.verifyUser`, `bank.recover.getUsername`, `bank.recover.resetPassword` | `cab.recover.verifyUser`, `.resetPassword` | recovery journeys |
| `bank.account.lockStatus`, `bank.account.unlock` | new | `unlock-account` |
| `bank.password.policy`, `bank.password.change` | `cab.password.policy` | `reset-password`, `change-password` |
| `bank.captcha.generate` | `cab.captcha.generate` | recovery journeys |
| `bank.session.get`, `bank.session.stepUp`, `bank.session.keepAlive` | README 2.3 | shell, all |
| `bank.loginHistory.list` | new | Settings › Security |
| `bank.system.status` | new | splash, maintenance, forced update |

---

### Shell: Returning sign-in

**This is a mode of `sign-in`, not a separate journey.** The same `login` screen (route `/sign-in` on web, `SignIn` on mobile) opens in returning mode when the device is remembered. It decides by calling `bank.device.options` (CAB: `cab.device.options`) when the screen opens.

| `bank.device.options` answer | What the person sees |
|---|---|
| `default: "password"`, or no remembered device | The normal username and password form. Heading: "Welcome". |
| `default: "pin"` and `pinSet: true` | The form with a pop-up over it: title "Enter Sign in PIN", six-digit keypad, buttons "Use password" and "Sign In". Heading: "Welcome back, {firstName}". |
| `default: "biometric"` (mobile only) | The form with a pop-up: title "Unlock", text "Use your fingerprint or face to sign in.", buttons "Use password" and "Unlock". The phone's own fingerprint or face prompt opens at the same time. In the sandbox the "Unlock" button stands in for it. |

- **Password is always the fallback.** "Use password" closes the pop-up and shows the form. A failed or cancelled fingerprint or face prompt also falls back to the PIN pop-up if a PIN is set, otherwise to the form.
- **Wrong PIN.** The pop-up text changes to "That PIN is not right. {n} tries left." Wrong PINs and wrong passwords share one counter: three mistakes in total lock the profile (`LOCKED`, 30 minutes). This is a BankWorkx® rule; CAB's `cab.device.verifyPin` only answers `{ ok: false }`.
- **Web.** Quick PIN works on a remembered browser. Biometrics is mobile only in Release 1.
- **Not you?** A link under the heading, "Not {firstName}? Sign in with another account", clears the remembered greeting (not the device registration) and shows the plain form.
- Everything else (outcomes, screens, errors) is the `sign-in` journey.

---

### Shell: Session timeout

**Purpose.** Sign out people who walk away. Applies to every signed-in screen, Personal and Business, web and mobile.

| Setting (planned, sandbox seed `session`) | Value |
|---|---|
| `idleTimeoutSeconds` | 300 (5 minutes with no tap, key press, scroll or request) |
| `warningSeconds` | 60 (the warning appears at 4 minutes of silence) |
| Mobile in the background | If the app was in the background for more than 300 seconds, it comes back to returning sign-in (no warning). |

**Warning dialog** (blocks the screen behind it, focus trapped, announced to screen readers):

| Part | Wording |
|---|---|
| Title | "Still there?" |
| Body | "For your security we'll sign you out in {n} seconds. Anything you haven't finished won't be saved." ({n} counts down each second.) |
| Button 1 (primary) | "Stay signed in": calls `bank.session.keepAlive`, closes the dialog, restarts the 300 s clock. |
| Button 2 (secondary) | "Sign out now": runs the sign-out below. |

**Then sign-out.** When the countdown ends the app runs the sign-out (below) and opens the Landing sign-in screen with an info banner: "You were signed out for your security. Sign in again to continue. Nothing you were doing was saved." (standard message `SESSION_EXPIRED`).

- A request already in flight when the clock ends is allowed to finish. A payment that completed is shown in Activity after the next sign-in. A journey that was open loses its entries.
- If the person is signed out on another device or the server drops the session, any call answers `SESSION_EXPIRED` and the same banner shows at once, without a warning.
- `bank.session.keepAlive` (planned): request `{}`, response `{ expiresAt }`, errors `SESSION_EXPIRED`, `TIMEOUT`, `SERVICE_UNAVAILABLE`; `moneyMoving: false`, `requiresOtp: false`.
- Launch points: none (automatic).

---

### Shell: Step-up dialog

**Purpose.** Ask the person to prove it is them again before a sensitive action, even though they are signed in.

**When it appears.**
1. An adapter answers `STEP_UP_REQUIRED` (for example `bank.session.switch` to Business, `bank.password.change`, `bank.devices.remove`, `bank.device.setDefault`).
2. A launch point is marked `stepup` in the link map (README 4.3): Switch to Business, Change password, Trusted devices, Change quick PIN, Biometrics, Profile edit, Card PIN, admin changes.
3. A step-up is **valid for 300 seconds** (`stepUpValidSeconds`, planned). A second sensitive action inside that time does not ask again. A sign-in counts as a step-up for its first 300 seconds. Sign-out or a context switch clears it.

**What it asks (two steps, in one sheet on mobile and a dialog on web).**

| Step | Screen | Content |
|---|---|---|
| 1. Prove who you are | Title "Confirm it's you". Body "For your security, confirm it's you first." | If the default sign-in is biometrics (mobile): the phone prompt, with the link "Use password instead". If it is quick PIN: six-digit keypad. Otherwise: a password field. Button "Confirm". |
| 2. One-time code | Title "Enter your code". Body "We sent a 6-digit code to {maskedPhone}." | `otp` block, 6 digits, resend after 30 s, 3 tries. Button "Confirm". |

| Outcome | What happens |
|---|---|
| Wrong password or PIN | "That isn't right. {n} tries left." Shares the sign-in counter. The third mistake locks the profile, signs the person out and shows the Landing screen with the `LOCKED` text from `sign-in`. |
| Wrong code | "That code isn't right. {n} tries left." After the third: "Too many wrong codes. Start again." The dialog closes and the action is cancelled. |
| Right | The dialog closes and the original action runs again (the journey screen or launch point continues where it stopped). |
| "Cancel" | The dialog closes. Nothing was changed. |

- `bank.session.stepUp` (planned): request `{ method: "password" | "pin" | "biometric", secret }` then, after `bank.otp.send` / `bank.otp.verify` (integration id `otpVerify`), `{}` to finish; response `{ ok: true, validUntil }`; errors `STEP_UP_FAILED` (carries `attemptsLeft`), `LOCKED`, `OTP_REQUIRED`, `SESSION_EXPIRED`, `TIMEOUT`, `SERVICE_UNAVAILABLE`; `moneyMoving: false`, `requiresOtp: true`.
- `TIMEOUT`: "This is taking longer than expected. Nothing was changed." `SERVICE_UNAVAILABLE`: standard message S-`SERVICE_UNAVAILABLE`.

---

### Shell: Sign-out

**Launch points.** More › Sign out; the profile menu on web; the session-timeout dialog; the step-up lock; "Sign out of all devices" is not in Release 1.

**What the app does, in order.**
1. Calls `bank.auth.signOut` (planned; request `{}`, response `{ ok: true }`, errors `TIMEOUT`, `SERVICE_UNAVAILABLE`). If it fails, the app still clears the screen state below and tells the server later; the person is never kept signed in on the device.
2. Clears the session token, the active context, the step-up state and the verified one-time code (`otpVerified` goes back to false).
3. Clears every cached view-model (accounts, balances, transactions, beneficiaries, cards, notifications), the running journey and its drafts, open sheets, search text, filters and selections, and every toast and banner.
4. Web: clears `sessionStorage`; the browser's Back button cannot show a signed-in page (the history is replaced with the Landing screen).
5. Opens the Landing screen (mobile: returning sign-in if the device is remembered).

**What is kept.** Language, light or dark mode, the device registration (trusted or not), the default sign-in method and the remembered first name for the greeting. Nothing about accounts or the company is kept.

**Confirmation.** The "Sign out" button asks once: title "Sign out?", body "You'll need to sign in again.", buttons "Sign out" and "Cancel". The timeout and lock paths do not ask.

---

### Shell: System states

These states are drawn by the shell and apply to every screen, so journeys do not repeat them. Copy for codes is the standard message of README 1.6.

| State | Trigger | What the person sees | Button | Behaviour |
|---|---|---|---|---|
| **Offline** | No network (device reports offline, or two requests fail to connect) | A banner at the top: "You're offline. We'll reconnect when you are." Lists keep their last data under the label "Last updated {time}". Buttons that send something are disabled with the helper "You need a connection to do this." | none (automatic) | Money-moving and security steps never run from cached data. When the network returns the banner turns into "You're back online" for 3 seconds and screens refresh. |
| **Backend unavailable** | An adapter answers `SERVICE_UNAVAILABLE` | A panel in place of the content: "This service is not available right now. Nothing was changed. Please try again in a few minutes." | "Try again" / "Back" | "Try again" repeats the same call. Panels from other parts of the app keep working. |
| **Timeout with retry** | No answer after 10 seconds, or the adapter answers `TIMEOUT` | Money-moving step: "We didn't get an answer in time. Check Activity before you try again, so you don't pay twice." Other: "This is taking longer than expected. Nothing was changed." | "Check Activity" or "Try again" | A repeated money-moving call is never sent automatically. |
| **Permission denied** | `PERMISSION_DENIED` | "Your role doesn't allow this. Ask an administrator at {company}." (Personal: "This isn't available for your profile.") | "Back" | The launch point should not have been shown; the screen records it for the audit trail. |
| **Session expired** | `SESSION_EXPIRED` | Landing screen with the banner "You were signed out for your security. Sign in again to continue. Nothing you were doing was saved." | "Sign in" | Same clean-up as sign-out. |
| **Maintenance** | `bank.system.status` says `maintenance.active` | Full screen, no navigation: title "BankWorkx® is being updated", body "We're doing planned maintenance until {until}. Your money and data are safe.", the planned message from the status answer under it. | "Check again" | Checked at start-up (mobile splash; web on first load) and every 60 seconds while shown. When maintenance ends the app opens on Landing. Signed-in users are signed out first. |
| **Forced update** (mobile only) | `bank.system.status` says the installed version is below `minVersion` | Full screen: title "Update required", body "This version of BankWorkx® is no longer supported. Update to keep banking with us.", the installed and the required version in small print. No close button. | "Update now" (opens the store page) | Checked at the splash screen, before sign-in. A newer optional version shows a one-time banner "A new version is available" with "Update" and "Later". |
| **Context-tagged toast or banner** | A notification arrives while the person is in a workspace | A toast (5 seconds) or, if it needs action, a banner. It carries a **context chip** with the workspace name: "Aurora" for Personal, or the company name ("Alpha Trading LLC"). Example: chip "Beta Services Ltd", text "Payment awaiting your approval". | "View" | "View" in the **same** workspace opens the item. "View" in **another** workspace follows the context-switch rule (README 5.4): switch, ask for step-up if the policy needs it, then open. A toast about another workspace never shows its amounts or names until the switch. |

`bank.system.status` (planned): request `{ platform: "web" | "ios" | "android", appVersion }`, response `{ maintenance: { active, until, message }, update: { minVersion, latestVersion, storeUrl } }`, errors `TIMEOUT`, `SERVICE_UNAVAILABLE` (if the check itself fails the app continues, so a broken status service never blocks the bank), `moneyMoving: false`, `requiresOtp: false`.

---

### Shell: Settings › Security

**Purpose.** One place for password, sign-in methods, devices and a record of recent sign-ins. Reached from More › Settings › Security.
**Route.** Web `/personal/more/settings/security`; mobile screen `SettingsSecurity`. Needs `security.manage` for the buttons that start journeys; the login history needs only a signed-in session.
**Data source (planned view-model `securityVm`).** `bank.device.options`, `bank.devices.list`, `bank.loginHistory.list`.

**Layout (top to bottom).**

| Widget | Content | Tap leads to |
|---|---|---|
| Password row | "Password" and "Last changed {date}" (or "Never changed" when the date is the account opening date) | "Change password" → `change-password` |
| Sign in with | Section header. Row **Biometrics** with a toggle (mobile only; hidden on web). Row **Quick PIN**: "Not set" or "Set" with the button "Set up" → `setup-quick-login`, or "Change" → `change-quick-pin`. Row **Default sign in**: "Username & password", "Biometric" or "PIN", with the button "Change" → `setup-quick-login`. | See below |
| Trusted devices row | "Trusted devices" and "{n} of 5" | `trusted-devices` |
| Login history | Table, below | A row opens its detail sheet |

**Biometrics toggle.**

| Action | Result |
|---|---|
| Switch on, device supports biometrics | Step-up if older than 300 s, then `setup-quick-login` opens on its Biometric screen (`bank.device.setDefault` with `mode: "biometric"`). The toggle turns on only after "Set as default". |
| Switch on, device has no fingerprint or face set up (`biometricAvailable: false`) | The toggle is disabled. Helper text: "This device doesn't have fingerprint or face sign-in set up. Turn it on in your device settings, then come back." |
| Switch off | Confirm: title "Turn off biometrics?", body "You'll sign in with your {PIN or password} instead.", buttons "Turn off" and "Cancel". "Turn off" calls `bank.device.setDefault` with `mode: "pin"` if a PIN is set, otherwise `"password"`. No step-up needed (it only makes sign-in stricter). Toast: "Biometrics turned off." |
| Error | `SERVICE_UNAVAILABLE` or `TIMEOUT`: the toggle returns to its old position and a toast shows the standard message. |

**Login history table** (planned `dataTable`; card list on phones).

| Column | Content |
|---|---|
| Date and time | `12 Nov 2026 09:14 UTC` (shown in the bank's time zone) |
| Result | `statusChip`: **Signed in** (green), **Wrong password** (amber), **Locked** (red), **New device code** (blue), **Signed out for inactivity** (grey) |
| Method | Password, Quick PIN or Biometrics |
| Device | The device name, with "This device" on the current one |
| Place | Approximate city and country from the network address, e.g. "San Francisco, US" |
| Network address | Partly hidden, e.g. `203.0.113.•` |

- **Filters.** Result (All, Signed in, Failed), Period (Last 7 days, Last 30 days, Last 90 days; `datePicker` range planned), Device (All or one). A "Clear filters" link shows when any filter is on.
- **Sort.** Newest first by default. The Date column header toggles oldest first. No other sorting.
- **Page.** 20 rows per page. History is kept for 90 days.
- **Row detail** (sheet): all columns plus "How you signed in" and the button "This wasn't me", which opens the secure message form (`new-message` with `topic: "security"`) and shows the line "We also recommend you change your password" with the button "Change password" → `change-password`.
- **Loading.** Skeleton rows. **Empty.** "No sign-ins to show for these filters." and the button "Clear filters". With no filters and no data: "Your sign-ins will appear here." **Error.** The standard `SERVICE_UNAVAILABLE` / `TIMEOUT` panel with "Try again".
- `bank.loginHistory.list` (planned): request `{ result?: "ok" | "failed", from?, to?, deviceId?, page, pageSize }`, response `{ items: [{ at, result, method, deviceId, deviceName, place, ipMasked }], total }`, errors `SESSION_EXPIRED`, `TIMEOUT`, `SERVICE_UNAVAILABLE`; `moneyMoving: false`, `requiresOtp: false`.
- Seed for Alex: 12 rows over the last 30 days, including one "Wrong password" from "London, GB" on an unknown device and one "New device code".
- **Launch points on this screen:** Change password, Trusted devices, Change quick PIN, Biometrics (all in README 5.2), plus the row action "This wasn't me" (**README change needed**: add to 5.2: `More › settings › security › login history row` → `new-message` `{topic: "security"}`, `messages.send`).

### ★ Sign in — `sign-in`

**Catalog:** slug `sign-in`, workspace `public`, category Sign-in and security (Signing in and security), core **yes** (a bank cannot switch it off), can a bank switch it off: no. Options (bank configuration, all read by the prototype): **Offer one-time codes by text message** (`allowSms`, default on; being phased out, app approval is safer); **Offer Face ID / fingerprint quick sign-in** (`allowBio`, default on); **Offer passkeys** (`allowPasskey`, default on); **Offer a 6-digit quick PIN** (`allowQuickPin`, default on); **Let people remember their username on this device** (`rememberUser`, default on); **Passwords expire after 12 months** (`forceExpiry`, default on; some regulators expect it, current guidance advises against it); **Ask for a code when the sign-in looks unusual, even on a trusted device** (`riskStepUp`, default on). Research: `research/sign-in.md`. Built in `design/bankworkx-r1/src/journeys/48-sign-in.js`.

Order of steps: username and password, then a one-time code (new device or unusual sign-in), then a forced password change (first sign-in or expired password), then trust this device, then quick sign-in set-up. The code comes before the password change so that a stolen password alone cannot change the password. The demo account list, the device-state chooser and the unlock and reset shortcuts that earlier prototypes drew on the first screen are not part of the customer screens; the sandbox sets the same states with its own conditions (section 9).

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `sign-in` |
| Purpose | Let a customer sign in with a username and password, add a one-time code on a new or unusual device, choose a new password when needed, trust the device and turn on quick sign-in. |
| Release / workspace | 1 / Public (before sign-in) |
| Status | Built in the prototype as a form journey (`submit: "Finish"`). Sets up the session; no money moves. |
| Channels | Web and mobile |
| Starting pattern | Multi-step form with optional steps |
| Who may use it | Anyone with a BankWorkx® username. |

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Landing › Sign in | none | none |
| Sign-out › Sign in again | none | none |
| Session timeout › Sign in | none | none |
| `unlock-account` › Back to sign in (planned) | `{user}` | none |

#### 3. Screens

**Screen 1 `credentials`: Sign in.** The BankWorkx® logo, then the text "Use your BankWorkx® username and password." Button **Continue** (busy "Checking your details…").

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Username | text, up to 40, placeholder "For example alex.morgan" | yes | 3 to 40 letters, numbers, dots, dashes, underscores or @ | "Usernames have 3 to 40 letters, numbers, dots, dashes or underscores." |
| Password | hidden text, up to 128, placeholder "Your password", with a **Show** / **Hide** button | yes | not empty | none |
| Remember my username on this device | checkbox (shown only when `rememberUser` is on; default on) | no | none | none |

Under the fields, three links: **Forgot password?** (opens `reset-password`), **Forgot username?** (`forgot-username`), **Register** (`register-digital-banking`). A line "Caps Lock is on" appears beside the password while Caps Lock is on.

Extra cards on this screen:
- **Welcome back** (when a username is remembered and quick sign-in is set up): "Welcome back, {first name}" and "Sign in with your quick PIN" (or "your passkey", "Face ID") "on this device", with a button **Use PIN** (or **Use passkey**, **Use Face ID**). It switches the screen to quick mode: only the Quick PIN field (hidden text, 6 digits, "Enter your 6-digit PIN.") when the method is a PIN, and no password.
- **Attempts left** (after the third wrong password): "{n} attempts left" and "After that, we lock sign-in to protect your account."
- **Locked**: a red card "Sign-in is locked" with the reason ("Too many wrong attempts. This protects your money. Unlocking takes a few minutes."), then a card "Unlock your account": "Confirm it’s you with your registered phone and a photo ID check. It takes about 3 minutes." Buttons **Unlock my account** (`unlock-account {user}`) and **Call us instead** (shows the bank’s support number). **Continue** is blocked.

**Screen 2 `code`: Enter your code** (shown for a new device, or for an unusual sign-in when `riskStepUp` is on; never for quick mode or a known device)

Text "This looks like a new device, so we need one more check." A card: "Approve in the BankWorkx® app" and "We sent a prompt to your other signed-in device. Open it and type the 6-digit code shown." (or, when text message is chosen, "Code sent by text message" and "We sent a 6-digit code to ••• 4410."), then "It works for 5 minutes and only once.", a button **Resend code in {n} s** that becomes **Resend code** after 60 seconds, an "attempts left" notice after a wrong code ("{n} attempts left", and "After that, sign-in locks." from the third), and the safety line "BankWorkx® will never call or message you to ask for this code. Don’t share it with anyone." Button **Continue** (busy "Checking your code…").

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| 6-digit code | text, 6 digits, placeholder "000000", hint "You can paste the code." | yes | exactly 6 digits | "Enter the 6 digits from the message." |
| Didn’t get it? Send it another way | chips "Text message" (only when `allowSms` is on) and "Another signed-in device" | no | none | none |

Choosing another way sends a new code and clears the field. A new code makes the old one useless. At most 3 resends; then "You have asked for the maximum number of codes. Wait 15 minutes or choose another way." A wrong code: "That code isn’t right. Check the latest message and try again." An expired code (older than 5 minutes): "That code has expired. Ask for a new one." Five wrong codes lock sign-in (the locked card shows, with "Too many wrong codes.").

**Screen 3 `newPassword`: Choose a new password** (shown when the password has expired and `forceExpiry` is on, or on a first sign-in with a temporary password; not in quick mode). Banner: first sign-in "Welcome to BankWorkx®" and "You signed in with a temporary password. Choose your own to continue."; expired "Your password has expired" and "It is more than 12 months old. Choose a new one to continue." Both add "Pasting from a password manager is fine." Button **Continue** (busy "Saving your new password…").

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| New password | hidden text, up to 64, placeholder "At least 12 characters", with **Show**; hint "Tip: a phrase of unrelated words is easy to remember and hard to guess. No symbols required." | yes | at least 12 characters | "Use at least 12 characters. Three or four unrelated words work well." |
| | | | at most 64 | "Use 64 characters or fewer." |
| | | | does not contain the username | "Don’t use your username in your password." |
| | | | not a common password or one containing a common word | "That password is too common. Try a longer phrase of unrelated words." |
| | | | not in a known data breach | "This password has appeared in a data breach, so we can’t accept it." |
| | | | not used before | "Choose a password you haven’t used here before." |
| Confirm new password | hidden text, up to 64 | yes | equals the new password | "The two passwords don’t match." |

Under the fields a live checklist: "At least 12 characters", "Not your username", "Not a common password", "Not in a known data breach", "Not one you used before", each with a tick when met.

**Screen 4 `trust`: Trust this device?** (shown unless the device is already trusted or known). Text "This saves you a code next time." A card "This device" with rows "Device", "Near" (the approximate place) and "Now" (date and time). Two choices: **Trust this device** ("No code for 90 days. Remove it any time in Security › Trusted devices.") and **Don’t trust (public or shared)** ("We ask for a code every time you sign in here."). If trusted: field "Name this device" (text, up to 30, required, hint "So you can recognise it later. Up to 5 trusted devices."). Button **Continue**.

**Screen 5 `quick`: Sign in faster next time** (shown unless the device is not trusted, quick sign-in is already on, or quick mode is in use). Text "Skip the password on this device." Choices, each only when the bank offers it: **Face ID or fingerprint** ("Your phone checks it’s you. BankWorkx® never receives your face or fingerprint."), **Passkey** ("A secure key stored on your device. Nothing to remember or type."), **6-digit quick PIN** ("Works only on this device."), and always **Not now** ("You can turn it on later in Security."). Button **Continue** (busy "Turning on quick sign-in…").

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Choose a PIN | hidden text, 6 digits, placeholder "6 digits", hint "Not 111111, 123456 or part of your phone number." (shown for the PIN choice) | yes | exactly 6 digits | "Use exactly 6 digits." |
| | | | not a repeat, a run, a pair repeated three times, or on a short list | "That PIN is too easy to guess. Avoid repeats and runs like 111111 or 123456." |
| | | | does not contain the last 4 digits of the phone | "Don’t use digits from your phone number." |
| Confirm PIN | hidden text, 6 digits | yes | equals the PIN | "The PINs don’t match." |

**Result.** Title "Signed in", text "Welcome, {first name}. Taking you to your accounts.", chip "Secure session". Rows: "Signed in as", "How" ("Password and one-time code", "Password on a known device" or the quick method), "This device" ("Trusted for 90 days" or "Not trusted"), "Quick sign-in" (method or "Off"), "Password" ("Changed just now" or "Unchanged"), "Session" ("Ends after 5 minutes without use"), "Last sign-in" (date, time, approximate place). Button **Go to Home**.

**States**
- Loading: each button shows a spinner and its busy text for about 0.7 to 0.8 seconds.
- Empty: not applicable.
- Error: a wrong username or password: "The username or password isn’t right. Check them and try again." (the same message whichever is wrong). Locked: "Sign-in is locked to protect your account. Unlock it to continue." Wrong quick PIN: "That PIN isn’t right." Unavailable: "We couldn’t reach the bank. Nothing was changed." with **Try again**. Timeout: "This is taking longer than expected. Nothing was changed." with **Try again**.
- Session timeout (outside this journey): the person returns here after 5 minutes without use.

**Home market configuration:** none. Sign-in has no country-specific fields. The approximate place on screen 4 and the result comes from the device lookup, not from the bank’s home market.

#### 4. Sandbox errors

Codes are for tests and the sandbox; the customer sees only the message.

| Code | Message | Shows on | Button |
|---|---|---|---|
| `INVALID_CREDENTIALS` | "The username or password isn’t right. Check them and try again." | screen 1 | Try again |
| `ACCOUNT_LOCKED` | "Sign-in is locked to protect your account. Unlock it to continue." | screens 1 and 2 | Unlock my account |
| `OTP_INVALID` | "That code isn’t right. Check the latest message and try again." | screen 2 | Try again |
| `OTP_EXPIRED` | "That code has expired. Ask for a new one." | screen 2 | Resend code |
| `OTP_RESEND_LIMIT` | "You have asked for the maximum number of codes. Wait 15 minutes or choose another way." | screen 2 | Choose another way |
| `QUICK_PIN_INVALID` | "That PIN isn’t right." | screen 1 (quick) | Try again |
| `PASSWORD_CONTAINS_USERNAME` | "Don’t use your username in your password." | screen 3 | none |
| `PASSWORD_COMMON` | "That password is too common. Try a longer phrase of unrelated words." | screen 3 | none |
| `PASSWORD_BREACHED` | "This password has appeared in a data breach, so we can’t accept it." | screen 3 | none |
| `PASSWORD_REUSED` | "Choose a password you haven’t used here before." | screen 3 | none |
| `PIN_WEAK` | "That PIN is too easy to guess. Avoid repeats and runs like 111111 or 123456." | screen 5 | none |
| `SERVICE_UNAVAILABLE` | "We couldn’t reach the bank. Nothing was changed." | any step | Try again |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | any step | Try again |
| `SESSION_EXPIRED` (planned) | Standard message (README 1.6) | landing | Sign in |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `checkCredentials` | `bank.auth.signIn` | `{username, password, device}` | `{status: "ok" \| "otp" \| "change-password", name, maskedPhone}` | `INVALID_CREDENTIALS`, `ACCOUNT_LOCKED` | (planned) |
| `sendOtp` | `bank.otp.send` | `{channel}` | `{sent, maskedPhone, channel}` | `OTP_RESEND_LIMIT` | Existing (`packages/mock-bank-api/src/index.ts`) |
| `verifyOtp` | `bank.otp.verify` | `{code}` | `{verified}` | `OTP_INVALID`, `OTP_EXPIRED`, `ACCOUNT_LOCKED` | Existing |
| `changePassword` | `bank.auth.changePassword` | `{newPassword}` | `{changed}` | `PASSWORD_COMMON`, `PASSWORD_BREACHED`, `PASSWORD_REUSED`, `PASSWORD_CONTAINS_USERNAME` | (planned) |
| `trustDevice` | `bank.auth.trustDevice` | `{name}` | `{deviceId, expiresInDays: 90}` | `DEVICE_LIMIT` | (planned) |
| `setQuickSignIn` | `bank.auth.setQuickSignIn` | `{method, pin?}` | `{method}` | `PIN_WEAK` | (planned) |
| `quickSignIn` | `bank.auth.quickSignIn` | `{method, pin?}` | `{status}` | `QUICK_PIN_INVALID`, `LOCKED` | (planned) |

#### 6. Permissions, step-up and limits

No permission (public). Step-up is built into the journey: a one-time code on a new or unusual device. Limits: five wrong passwords lock sign-in; five wrong codes lock sign-in; a code works for 5 minutes and once; at most 3 resends; a trusted device skips the code for 90 days; up to 5 trusted devices; the session ends after 5 minutes without use. Passwords are 12 to 64 characters with no symbol rules, checked against common words, breached passwords, the username and earlier passwords. Quick PINs are 6 digits and work only on the device.

#### 7. Result and links out

Result as above. Notifications raised (planned): "New sign-in on {device}" on a new device; "Your password was changed"; "Quick sign-in was turned on". Links out: Home (personal workspace), `unlock-account`, `reset-password`, `forgot-username`, `register-digital-banking`, Security › Trusted devices.

#### 8. Acceptance criteria

- AC-1: A correct username and password on a known device signs the person in without a code, and the result says "Password on a known device".
- AC-2: A new device (or an unusual sign-in with `riskStepUp` on) needs a 6-digit code before anything else happens; quick mode and known devices skip it.
- AC-3: A wrong username or a wrong password gives the same message; the fifth wrong password locks sign-in and shows the unlock card; the attempts-left notice shows from the third wrong password.
- AC-4: A locked username cannot continue and is offered **Unlock my account** and **Call us instead**.
- AC-5: A wrong code gives the wrong-code message and counts toward the five; an expired code (over 5 minutes) says so; the resend button waits 60 seconds and allows 3 resends.
- AC-6: Text message is offered only when `allowSms` is on; "Another signed-in device" is always offered.
- AC-7: A first sign-in with a temporary password, or an expired password with `forceExpiry` on, shows "Choose a new password" after the code step; a normal password never shows it.
- AC-8: The new password is refused for the five reasons above, the checklist reflects them live, and the two entries must match.
- AC-9: "Trust this device" skips the code for 90 days and asks for a device name; "Don’t trust" asks for a code every time.
- AC-10: Quick sign-in choices show only the methods the bank offers, plus **Not now**; a quick PIN must be 6 digits, not weak, and entered twice.
- AC-11: With quick sign-in set up and a remembered username, the screen offers "Welcome back" with one button and signs in without the password; a wrong quick PIN says "That PIN isn’t right."
- AC-12: With `rememberUser` off there is no checkbox and no remembered username.
- AC-13: The result lists how the person signed in, whether the device is trusted, the quick sign-in method and whether the password changed.
- AC-14: When the bank is unavailable or times out nothing is changed and no wrong-attempt is counted.

#### 9. Scenarios

Synthetic personas: `alex.morgan` (normal, needs a code on a new device), `sam.rivera` (password expired), `new.user` (first sign-in, temporary password) and `locked.user` (already locked). Each uses its sandbox test password. The sandbox sets the device state (new, known, unusual) and accepts the fixed test code; the code 000000 is wrong and 999999 is expired. "Today" is Tue 3 Nov 2026.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1 | `alex.morgan`, known device | none | Username and password, **Continue**: "Signed in", How "Password on a known device". |
| T-2 | AC-2, AC-5, AC-6 | `alex.morgan`, new device | none | Code step appears. A right code goes on to Trust this device. 000000: "That code isn’t right…" 999999: "That code has expired. Ask for a new one." With `allowSms` off only the other device is offered. |
| T-3 | AC-3 | `alex.morgan` | none | Wrong password three times: notice "2 attempts left". Two more: sign-in locks and the unlock card shows. |
| T-4 | AC-4 | `locked.user` | none | Continue is blocked; **Unlock my account** opens `unlock-account`. |
| T-5 | AC-5 | `alex.morgan`, new device | none | Press Resend before 60 seconds: disabled. After 60 seconds: new code; the old one is refused. A fourth resend: "You have asked for the maximum number of codes…" Five wrong codes lock sign-in. |
| T-6 | AC-7, AC-8 | `sam.rivera`; then `new.user` | none | After the code, "Your password has expired" (or "Welcome to BankWorkx®"). A password under 12 characters, one with the username, "Password123!" style breached values, an old password and a mismatch are each refused with their message; a good phrase is accepted. With `forceExpiry` off Sam goes straight on. |
| T-7 | AC-9 | `alex.morgan`, new device | none | Trust this device with a name: no code next time for 90 days. Don’t trust: a code every time. |
| T-8 | AC-10 | `alex.morgan` | `allowBio`, `allowPasskey`, `allowQuickPin` on one at a time | Only the offered methods show, plus Not now. PIN 111111, 123456 and a PIN containing the phone’s last 4 digits are refused; two different entries: "The PINs don’t match." |
| T-9 | AC-11 | `alex.morgan` with quick PIN set up and username remembered | none | "Welcome back, Alex" with **Use PIN**; the PIN field replaces the password; a right PIN signs in; a wrong PIN: "That PIN isn’t right." |
| T-10 | AC-12 | `alex.morgan` | `rememberUser` off | No checkbox; nothing remembered next time. |
| T-11 | AC-13 | `alex.morgan` | none | Result rows reflect how, device trust, quick method and password change for the path taken. |
| T-12 | AC-14 | `alex.morgan` | `unavailable: ["bank.auth.signIn"]` (prototype: Service down on) | Connection message "We couldn’t reach the bank. Nothing was changed." No wrong attempt is counted. |
| T-13 | AC-14 | `alex.morgan` | `timeout: ["bank.auth.signIn"]`, `latencyMs: 10000` (planned) | After 10 seconds: "This is taking longer than expected. Nothing was changed." No wrong attempt is counted. |

#### 10. Expected mutation-check survivors

The rule that the new password may not contain a common word survives if T-6 only uses full-word cases (another layer, the length rule, stops short ones); expected. The "up to 5 trusted devices" limit is not exercised in the prototype (`DEVICE_LIMIT` is planned); a mutation there cannot be checked yet. The 5-minute session timeout lives in the shell, not in this journey; expected. Everything else: none expected.

---

### ★ Set up quick sign in — `setup-quick-login`

**Catalog:** slug `setup-quick-login` (name in the prototype "Quick sign-in"), workspace `personal`, category Signing in and security (prototype tag "Sign-in and security"), core no, can a bank switch it off: yes (basic entry, kept in the Lean preset). Options (key, label, default): `allowBio` "Offer Face ID / fingerprint" (on); `allowPasskey` "Offer passkeys" (on); `allowPin` "Offer a 6-digit quick PIN" (on). Research: `research/setup-quick-login.md`. Built in `design/bankworkx-r1/src/journeys/55-security.js`, on the sign-in model `SI` from `48-sign-in.js`.

The lean rework removed the per-device list of methods and the "use on all my devices" choice. What remains: this device has one quick method, or none. The person turns one on (with a code) or turns it off (no code), and sees what is on now.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `setup-quick-login` |
| Purpose | Choose how this device signs the person in without the password: Face ID or fingerprint, a passkey, or a 6-digit PIN. Shows what is on now and lets the person turn it off. |
| Release / workspace | 1 / Personal |
| Status | Built in the prototype as a form journey (`submit: "Turn on"`, permission `accounts.view`). The phone's biometric and passkey prompts are simulated by a wait. No money moves. |
| Channels | Web (passkey, PIN) and mobile (all three) |
| Starting pattern | `fixtures/cab.ts` (device options, `cab.device.setDefault`, `cab.device.verifyPin`) |
| Who may use it | Anyone signed in to Personal (`accounts.view`), for the device in their hand. |

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| More › Security › Quick sign-in | none | `accounts.view` |
| `sign-in` › Sign in faster (offered after a password sign-in) | none | `accounts.view` |
| Deep link `/personal/j/setup-quick-login` | none | `accounts.view` |

#### 3. Screens

Steps in order: `method`, `bio` (Face ID or fingerprint, passkey), `code` (when turning on), then the result.

**Screen `method`** ("Quick sign-in"). Text "Sign in on this device without your password." Button **Continue**.

At the top a card shows this device's name (for example "iPhone 15"), "This device", and a chip with what is on now: "Face ID or fingerprint", "Passkey", "Quick PIN", or "Off".

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| (no label) | `cards`: "Face ID or fingerprint" (with `allowBio`), "Passkey" (with `allowPasskey`), "6-digit PIN" (with `allowPin`), each with chip "On" when it is the current method and then not selectable; "Turn off" with the sub-line "You will use your password." (only when a method is on) | Yes | One of the cards | "This is required." |
| Choose a PIN | `password`, placeholder "6 digits", max 6 (when "6-digit PIN" is chosen) | Yes | Exactly 6 digits; not a repeat or a run; no digits from the phone number | "Use exactly 6 digits." and "That PIN is too easy to guess. Avoid repeats and runs like 111111 or 123456." and "Don’t use digits from your phone number." |
| Confirm PIN | `password`, max 6 (same condition) | Yes | Same as the PIN | "The PINs don’t match." |

Too-easy PINs: six equal digits, ascending or descending runs, three repeated pairs (121212), and 112233, 123123, 696969, 000111. Choosing "Turn off" and continuing ends the journey (no code); the result says it is off.

**Screen `bio`** ("Confirm on this device"; for Face ID or fingerprint, and passkey). Text "Look at your phone or use your fingerprint." or "Use your device lock to create a passkey." Button **Continue**, busy "Waiting for your device…" (about 0.9 seconds). A failed prompt shows "We couldn’t confirm it was you. Try again." (planned; the prototype never fails it).

**Screen `code`** ("Enter your code"; every choice except "Turn off"). Text "Sent to the phone ending 0142." Button **Turn on**, busy "Checking your code…" (about 0.6 seconds).

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| Code | `text`, placeholder "6 digits", max 6, hint "{n} tries left" after a wrong code | Yes | Exactly 6 digits | "Enter the 6 digits." |

A wrong code: "That code isn’t right. Try again." An expired code: "That code has expired. Go back to get a new one." Three wrong codes: "Too many wrong codes. Nothing was changed. Go back to start again."

**Result.** "Quick sign-in is on" or "Quick sign-in is off" (green). Rows "Device" (the device name) and "Method" ("Face ID or fingerprint", "Passkey", "Quick PIN" or "Off"). Buttons **Back to security**, **Done**. A note "Quick sign-in turned on for {device}" or "Quick sign-in turned off" is added to the notification list. Turning on a method replaces the one that was on.

**States**
- Loading: busy text on the button as above.
- Empty: not applicable. If all three methods are off in the bank configuration, only "Turn off" can show, and the entry hides.
- Error: the Service down switch shows the standard connection sheet ("We couldn’t reach the bank", "Nothing was sent and you haven’t been charged. Try again in a moment."); otherwise "This isn’t available right now. Nothing was changed. Try again in a few minutes." with **Try again**.
- Timeout: "This is taking longer than expected. Nothing was changed."

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `BIO_FAILED` (planned) | "We couldn’t confirm it was you. Try again." | `bio` | Try again |
| `OTP_INVALID` | "That code isn’t right. Try again." | `code` | Try again |
| `OTP_EXPIRED` | "That code has expired. Go back to get a new one." | `code` | Back |
| `OTP_LOCKED` | "Too many wrong codes. Nothing was changed. Go back to start again." | `code` | Back to start |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | `bio`, `code` | Try again |
| `SERVICE_UNAVAILABLE` | "This isn’t available right now. Nothing was changed. Try again in a few minutes." | `bio`, `code` | Try again |
| `JOURNEY_DISABLED` | "This isn’t available at your bank." | whole journey | none |
| `PERMISSION_DENIED` (planned) | Standard message | whole journey | Back |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `deviceOptions` | `cab.device.options` | none | `{mode, pinSet, biometricAvailable}` | none | Existing for the CAB access journeys (`packages/mock-bank-api/src/cab.ts`); a `bank.devices.options` twin is (planned) |
| `sendOtp` / `verifyOtp` | `bank.otp.send` / `bank.otp.verify` | `{channel}` / `{code}` | `{sent}` / `{verified}` | `OTP_INVALID`, `OTP_EXPIRED`, `OTP_LOCKED` | Existing (`packages/mock-bank-api/src/index.ts`) |
| `setQuickSignIn` | `bank.devices.setQuickSignIn` | `{method: "face" \| "passkey" \| "pin" \| "off", pin?}` | `{device, method}` | `PIN_WEAK`, `OTP_REQUIRED`, `SERVICE_UNAVAILABLE`, `TIMEOUT` | (planned). The CAB twin is `cab.device.setDefault` |

Biometric and passkey prompts are made by the phone or browser and send the bank only a public key (planned).

#### 6. Permissions, step-up and limits

`accounts.view`. Step-up: a one-time code (6 digits, 3 tries) to turn a method on; none to turn it off (it makes the device safer). Limits: one method per device; a PIN is exactly 6 digits.

#### 7. Result and links out

Result as above. Notifications raised (planned): "Quick sign-in was turned on for {device}" or "turned off" by text and email. Links out: More (security), `change-quick-pin`, `trusted-devices`, `sign-in`.

#### 8. Acceptance criteria

- AC-1: The screen shows this device and what is on now, and offers only the methods that are on in the bank configuration.
- AC-2: The current method is shown "On" and cannot be chosen again; "Turn off" appears only when a method is on.
- AC-3: A PIN must be 6 digits, not a repeat or run, not contain digits of the phone number, and be confirmed.
- AC-4: Face ID or fingerprint and passkey go through the device confirmation before the code.
- AC-5: Turning a method on needs a one-time code; three wrong codes end the attempt with nothing changed.
- AC-6: Turning off needs no code and the device returns to password sign-in.
- AC-7: The result shows the device and the method now on.
- AC-8: When the bank is unavailable or times out nothing is changed.

#### 9. Scenarios

Synthetic persona `alex`, device "iPhone 15", with quick sign-in off.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-4, AC-5, AC-7 | `alex` | none | Choose "Face ID or fingerprint", wait, code 482100: "Quick sign-in is on", rows Device "iPhone 15", Method "Face ID or fingerprint". |
| T-2 | AC-3 | `alex` | none | "6-digit PIN" with 111111: "That PIN is too easy to guess. Avoid repeats and runs like 111111 or 123456." With 123456 the same. With digits "014204": "Don’t use digits from your phone number." With confirmation 111112: "The PINs don’t match." |
| T-3 | AC-5 | `alex` | none | PIN 504719 twice, code 000000: "That code isn’t right. Try again." and "2 tries left"; three times: "Too many wrong codes. Nothing was changed. Go back to start again." |
| T-4 | AC-2, AC-6 | `alex`, quick sign-in on (PIN) | none | The PIN card shows "On" and is disabled; choose "Turn off": no code step, "Quick sign-in is off", Method "Off". |
| T-5 | AC-1 | `alex`, `allowPin` off, `allowPasskey` off | none | Only "Face ID or fingerprint" is offered. |
| T-6 | AC-8 | `alex` | `unavailable: ["bank.devices.setQuickSignIn"]` (prototype: Service down on) | Connection sheet; nothing is changed. |
| T-7 | AC-8 | `alex` | `timeout: ["bank.devices.setQuickSignIn"]`, `latencyMs: 10000` | After 10 seconds: "This is taking longer than expected. Nothing was changed." |

#### 10. Expected mutation-check survivors

The device prompt is simulated, so a mutation that skips the `bio` step survives; expected until real biometrics are built. The too-easy PIN list is a short sample; a mutation that removes one entry survives; expected. The notification text is not asserted; expected. Everything else: none expected.

---

### ★ Forgot username — `forgot-username`

**Catalog:** slug `forgot-username`, workspace `public`, category Signing in and security (prototype tag "Sign-in and security"), core no, can a bank switch it off: yes (basic entry, kept in the Lean preset). Options (key, label, default): `allowEmail` "Let people identify with an email address" (on). Research: `research/forgot-username.md`. Built in `design/bankworkx-r1/src/journeys/52-register-recover.js`, with the helper object `RC` shared with `register-digital-banking` and `reset-password`.

The lean rework removed the security questions and showing the username on screen. What remains: say who you are with a mobile number (or email) and a date of birth, confirm a one-time code, and the bank sends the username to the contact it already holds. The username is never shown.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `forgot-username` |
| Purpose | Let a registered customer who forgot the username get it by message at the mobile number or email already on file. |
| Release / workspace | 1 / Public (before sign-in) |
| Status | Built in the prototype as a two-screen form journey (`submit: "Send my username"`). Starting pattern in code: `cab.recover.verifyUser` in `packages/mock-bank-api/src/cab.ts`. No money moves. |
| Channels | Web and mobile |
| Starting pattern | `fixtures/cab.ts` (recover) |
| Who may use it | Anyone with the contact details and date of birth on a profile. No permission. |

**Sandbox profiles (not shown on screen).** `alex.morgan` (mobile 5550104410, email `alex.morgan@example.com`), `sam.rivera` (5550107731, `sam.rivera@example.com`), `locked.user` (5550109012, `lee.carter@example.com`); all born 1 Jan 1990. One-time code: any 6 digits is accepted, `000000` is wrong, `999999` is expired. Three wrong identity checks or codes lock the journey; the prototype shortens the 30 minutes to 2 minutes.

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| `sign-in` › Forgot username? | none | none |
| Deep link `/public/j/forgot-username` | none | none |

#### 3. Screens

Steps in order: `find`, `code`, then the result.

**Screen `find`** ("Forgot your username?"). Text "Tell us how to find you." Button **Continue**, busy "Checking your details…" (about 0.8 seconds).

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| (no label) | `chips`: Mobile number, Email. Shown only with `allowEmail`. Default Mobile number | No | One of two | none |
| Mobile number | `tel`, placeholder "Mobile number", max 20 (when Mobile number is chosen) | Yes | 7 to 18 digits, spaces, brackets, dashes, optional leading + | "Enter a valid mobile number." |
| Email | `email`, placeholder "name@example.com", max 80 (when Email is chosen) | Yes | `name@host.tld` shape | "Enter a valid email address." |
| Date of birth | `select` Day, 1 to 31 (half width) | Yes | A day | "This is required." |
| Month | `select`, January to December (half width) | Yes | A month | "This is required." |
| Year | `text`, placeholder "1990", max 4 | Yes | 4 digits starting 19 or 20; a real date; in the past | "Enter a 4-digit year." and "That date doesn’t exist." and "Enter a date in the past." |

No profile has that contact and that date of birth: "We couldn’t match those details. Check them and try again." The message never says which part did not match. The third no-match locks the screen: the fields are replaced by a card "Too many tries", "For your security, try again in 30 minutes, or contact us.", button **Contact us** (`contact-support`); the step is blocked with "Too many tries. Try again in 30 minutes."

**Screen `code`** ("Enter your code"). Card "Code sent", "We sent a 6-digit code to {where}." where {where} is the mobile as "••• {last 4 digits}" or the email as "{first letter}•••@{domain}". Button **Send my username**, busy "Checking your code…" (about 0.7 seconds). The card has **Resend code**.

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| 6-digit code | `text`, placeholder "000000", max 6 | Yes | Exactly 6 digits | "Enter the 6 digits from the message." |

**Resend code**: "New code sent. The old code no longer works." After 3 resends: "You have asked for the maximum number of codes. Try again later." A wrong code clears the field and counts towards the same lock as the identity check: "That code isn’t right. Check the latest message and try again." An expired code: "That code has expired. Ask for a new one."

**Result** ("We sent your username", green, text "Check your messages. We never send your password."). Chip Sent. Row "Sent to" (the masked contact). Buttons **Sign in** (opens `sign-in`), **Reset password** (opens `reset-password`), **Done**.

**States**
- Loading: busy text on the button as above.
- Empty: not applicable.
- Error: "We couldn’t reach the bank. Nothing was changed." The Service down switch shows the standard connection sheet ("We couldn’t reach the bank", "Nothing was sent and you haven’t been charged. Try again in a moment.", **Try again**).
- Timeout: "This is taking longer than expected. Nothing was changed."
- Locked: as above.

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `NOT_FOUND` | "We couldn’t match those details. Check them and try again." | `find` | Try again |
| `ID_LOCKED` | "Too many tries. For your security, try again in 30 minutes, or contact us." | `find`, `code` | Contact us |
| `OTP_INVALID` | "That code isn’t right. Check the latest message and try again." | `code` | Try again |
| `OTP_EXPIRED` | "That code has expired. Ask for a new one." | `code` | Resend code |
| `SERVICE_UNAVAILABLE` | "We couldn’t reach the bank. Nothing was changed." | any step with a call | Try again |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | any step with a call | Try again |
| `JOURNEY_DISABLED` | "This isn’t available at your bank." | whole journey | none |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `findProfile` | `bank.recover.verifyUser` | `{mobile or email, dateOfBirth}` | `{recoveryToken, maskedContact}` | `NOT_FOUND`, `ID_LOCKED`, `SERVICE_UNAVAILABLE`, `TIMEOUT` | (planned). The CAB twin is `cab.recover.verifyUser` |
| `sendOtp` / `verifyOtp` | `bank.otp.send` / `bank.otp.verify` | `{channel}` / `{code}` | `{sent}` / `{verified}` | `OTP_INVALID`, `OTP_EXPIRED`, `ID_LOCKED` | Existing (`packages/mock-bank-api/src/index.ts`) |
| `sendUsername` | `bank.recover.sendUsername` | `{recoveryToken}` | `{sent}` | `OTP_REQUIRED`, `SERVICE_UNAVAILABLE`, `TIMEOUT` | (planned) |

#### 6. Permissions, step-up and limits

None before sign-in. The one-time code is the step-up. Limits: 3 wrong identity checks or codes lock the journey for 30 minutes (2 minutes in the prototype); at most 3 resends. The username goes only to the contact on file, never to a contact typed in this journey.

#### 7. Result and links out

Result as above. Notification: the message that carries the username (planned text: "Your BankWorkx® username is {username}. If you didn’t ask for this, call us."). Links out: `sign-in`, `reset-password`, `contact-support`.

#### 8. Acceptance criteria

- AC-1: A match needs the contact and the date of birth together; the message after a miss does not say which part failed.
- AC-2: The mobile number and the email follow the formats above; the date must be real and in the past (no age rule).
- AC-3: The code goes to the contact the person typed only when it matches the profile, and the screen shows it masked.
- AC-4: A wrong code counts towards the same lock as the identity check; three misses lock the journey; an expired code asks for a new one; at most 3 resends.
- AC-5: The username is never shown on screen; the result says it was sent and shows where.
- AC-6: With `allowEmail` off only the mobile number is offered.
- AC-7: When the bank is unavailable or times out nothing is sent.

#### 9. Scenarios

Synthetic persona `alex`.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-3, AC-5 | `alex` | none | Mobile 5550104410, born 1 Jan 1990, code 482100: "We sent your username", row "Sent to" "••• 4410". The username is not on screen. |
| T-2 | AC-2, AC-3 | `alex` | none | Email `alex.morgan@example.com`: "We sent a 6-digit code to a•••@example.com." Mobile "12": "Enter a valid mobile number." 31 February: "That date doesn’t exist." |
| T-3 | AC-1, AC-4 | `alex` | none | Mobile 5550104410 with the wrong birth year, three times: two "We couldn’t match those details. Check them and try again." then the "Too many tries" card. |
| T-4 | AC-4 | `alex` | none | Code 000000: "That code isn’t right. Check the latest message and try again." Code 999999: "That code has expired. Ask for a new one." The 4th Resend: "You have asked for the maximum number of codes. Try again later." |
| T-5 | AC-6 | `alex`, `allowEmail` off | none | No Mobile number or Email chips; only the mobile field. |
| T-6 | AC-7 | `alex` | `unavailable: ["bank.recover.sendUsername"]` (prototype: Service down on) | Connection sheet; nothing sent. |
| T-7 | AC-7 | `alex` | `timeout: ["bank.recover.sendUsername"]`, `latencyMs: 10000` | After 10 seconds: "This is taking longer than expected. Nothing was changed." |

#### 10. Expected mutation-check survivors

The exact lock length survives (2 minutes in the sandbox); expected. The text of the message that carries the username is not asserted; expected. Everything else: none expected.

---

### ★ Reset password — `reset-password`

**Catalog:** slug `reset-password`, workspace `public`, category Signing in and security (prototype tag "Sign-in and security"), core no, can a bank switch it off: yes (basic entry, kept in the Lean preset). Options (key, label, default): `allowUnlock` "Offer unlock without a new password" (on). Research: `research/reset-password.md`. Built in `design/bankworkx-r1/src/journeys/52-register-recover.js`, with the helper object `RC` shared with `register-digital-banking` and `forgot-username`. This one journey covers three catalog entries: `reset-password` (mode `reset`), `unlock-account` (mode `unlock`) and `forgot-password` (mode `reset`). The last two are short alias blocks that follow this one.

The lean rework removed security questions, the reset link by email and the choice of channel. What remains: say who you are with a username or email, confirm a one-time code sent to the mobile number on file, then either choose a new password or just unlock the profile and keep the old password.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `reset-password` |
| Purpose | Get back into a profile that is locked or whose password is forgotten, by proving who the person is with a one-time code, then choosing a new password or unlocking and keeping the current one. |
| Release / workspace | 1 / Public (before sign-in) |
| Status | Built in the prototype as one form journey with two modes (`submit: "Finish"`; the unlock mode ends with **Unlock account**). Starting pattern in code: `cab.recover.verifyUser` and `cab.recover.resetPassword` in `packages/mock-bank-api/src/cab.ts`. |
| Channels | Web and mobile |
| Starting pattern | `fixtures/cab.ts` (recover, reset password) |
| Who may use it | Anyone who knows the username or email on the profile. No permission. |

**Sandbox profiles (not shown on screen).** `alex.morgan` (email `alex.morgan@example.com`, mobile ending 4410), `sam.rivera` (`sam.rivera@example.com`, ending 7731), `locked.user` (`lee.carter@example.com`, ending 9012, shown as locked by `sign-in`). One-time code: any 6 digits is accepted, `000000` is wrong, `999999` is expired. Three wrong identity checks or codes lock the journey; the prototype shortens the 30 minutes to 2 minutes.

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| `sign-in` › Forgot password? (`forgot-password`) | `{user}` when known | none |
| `sign-in` › Account locked › Reset password | `{user}` | none |
| `unlock-account` (alias) › launched with `{user, mode: "unlock"}`; the prototype `sign-in` locked card has only **Reset password** and **Contact support**, so a link "Unlock without changing my password" there is (planned) | `{user, mode: "unlock"}` | none |
| `forgot-username` result › Reset password | none | none |
| Deep link `/public/j/reset-password?mode=unlock` | `{mode}` (`reset`, `unlock`), `{user}` | none |

#### 3. Screens

Steps in order: `identR` (reset) or `identU` (unlock), `code`, then `newpw` (reset) or `unlock` (unlock), then the result.

**Screen `identR` ("Reset your password") and `identU` ("Unlock your account").** Button **Continue**, busy "Checking…" (about 0.7 seconds).

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| Username or email | `text`, placeholder "Username or email", max 80. Prefilled with `user` when passed | Yes | 3 to 80 characters without spaces | "Enter your username or the email address we have for you." |

No profile matches: "We couldn’t find a profile with those details. Check them and try again." (open point: the product should show a neutral message that does not confirm whether a profile exists, such as "If those details match a profile, we have sent a code"; the prototype confirms it). The third no-match locks the screen: the field is replaced by a card "Too many tries", "For your security, try again in 30 minutes, or contact us.", button **Contact us** (`contact-support`); the step is blocked with "Too many tries. Try again in 30 minutes."

**Screen `code`** ("Enter your code"). Card "Code sent", "We sent a 6-digit code to ••• {last 4 digits of the mobile}." with the button **Resend code**. Button **Continue**, busy "Checking your code…" (about 0.7 seconds).

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| 6-digit code | `text`, placeholder "000000", max 6 | Yes | Exactly 6 digits | "Enter the 6 digits from the message." |

**Resend code**: "New code sent. The old code no longer works." After 3 resends: "You have asked for the maximum number of codes. Try again later." A wrong code clears the field and counts towards the same lock as the identity check: "That code isn’t right. Check the latest message and try again." An expired code: "That code has expired. Ask for a new one."

**Screen `newpw`** ("Choose a new password"; reset only). Button **Finish**, busy "Saving your new password…" (about 0.8 seconds).

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| Password | `password`, placeholder "At least 12 characters", max 64, with a Show or Hide button | Yes | At least 12 and at most 64 characters; not containing the username; not a common password; not in a known data breach; not one used before at the bank | "Use at least 12 characters. Three or four unrelated words work well." / "Use 64 characters or fewer." / "Don’t use your username in your password." / "That password is too common. Try a longer phrase of unrelated words." / "This password has appeared in a data breach, so we can’t accept it." / "Choose a password you haven’t used here before." |
| Confirm password | `password`, max 64 | Yes | Same as Password | "The two passwords don’t match." |

A live checklist under the fields shows ✓ or ○ for "At least 12 characters", "Not your username", "Not a common password", "Not in a known data breach". No capital or symbol rules.

**Screen `unlock`** ("Unlock your account"; unlock only). Text "Your password stays the same." Button **Unlock account**, busy "Unlocking…" (about 0.7 seconds). No fields.

**Results**

| Mode | Title | Text | Chip | Rows |
|---|---|---|---|---|
| Reset | "Password changed" | "Sign in with your new password." | Done (green) | Username, Changed ("Tue 3 Nov 2026") |
| Unlock, profile was locked | "Account unlocked" | "You can sign in now. Your password hasn’t changed." | Unlocked (green) | Username |
| Unlock, profile was not locked | "Your account isn’t locked" | "You can sign in now." | none | Username |

Every result has the button **Sign in** (opens `sign-in` with `{user}`) and **Done**. A reset also removes any lock on the profile and clears the failed-attempt counters; the new password becomes one that cannot be reused.

**States**
- Loading: busy text on the button as above.
- Empty: not applicable.
- Error: "We couldn’t reach the bank. Nothing was changed." The Service down switch shows the standard connection sheet ("We couldn’t reach the bank", "Nothing was sent and you haven’t been charged. Try again in a moment.", **Try again**).
- Timeout: "This is taking longer than expected. Nothing was changed."
- Locked: as above.

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `NOT_FOUND` | "We couldn’t find a profile with those details. Check them and try again." | `identR`, `identU` | Try again |
| `ID_LOCKED` | "Too many tries. For your security, try again in 30 minutes, or contact us." | ident, `code` | Contact us |
| `OTP_INVALID` | "That code isn’t right. Check the latest message and try again." | `code` | Try again |
| `OTP_EXPIRED` | "That code has expired. Ask for a new one." | `code` | Resend code |
| `SERVICE_UNAVAILABLE` | "We couldn’t reach the bank. Nothing was changed." | any step with a call | Try again |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | any step with a call | Try again |
| `JOURNEY_DISABLED` | "This isn’t available at your bank." | whole journey | none |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `findProfile` | `bank.recover.verifyUser` | `{usernameOrEmail}` | `{recoveryToken, maskedMobile}` | `NOT_FOUND`, `ID_LOCKED`, `SERVICE_UNAVAILABLE`, `TIMEOUT` | (planned). The CAB twin is `cab.recover.verifyUser` |
| `sendOtp` / `verifyOtp` | `bank.otp.send` / `bank.otp.verify` | `{channel}` / `{code}` | `{sent}` / `{verified}` | `OTP_INVALID`, `OTP_EXPIRED`, `ID_LOCKED` | Existing (`packages/mock-bank-api/src/index.ts`) |
| `resetPassword` | `bank.recover.resetPassword` | `{recoveryToken, password}` | `{ok}` | `POLICY`, `OTP_REQUIRED`, `SERVICE_UNAVAILABLE`, `TIMEOUT` | (planned). The CAB twin is `cab.recover.resetPassword` |
| `unlockProfile` | `bank.recover.unlock` | `{recoveryToken}` | `{wasLocked}` | `OTP_REQUIRED`, `SERVICE_UNAVAILABLE`, `TIMEOUT` | (planned) |

#### 6. Permissions, step-up and limits

None before sign-in. The one-time code is the step-up. Limits: 3 wrong identity checks or codes lock the journey for 30 minutes (2 minutes in the prototype); at most 3 resends; password 12 to 64 characters. `sign-in` itself locks a profile after 5 wrong passwords or codes.

#### 7. Result and links out

Results as above. Notifications raised (planned): a text and an email "Your BankWorkx® password was changed" or "Your BankWorkx® account was unlocked" to the contacts on file, with a number to call if this was not the person. Links out: `sign-in`, `contact-support`.

#### 8. Acceptance criteria

- AC-1: A reset needs the username or email, then a correct code, then a password that follows the rules and is confirmed.
- AC-2: The code goes to the mobile number on file, shown only as its last 4 digits; a wrong code counts towards the lock; an expired code asks for a new one; at most 3 resends.
- AC-3: Three wrong identity checks or codes lock the journey with the "Too many tries" card and a link to `contact-support`.
- AC-4: After a reset the new password works at `sign-in`, the old one does not, the lock is cleared, and the new password cannot be reused later.
- AC-5: Unlock keeps the password, clears the lock, and tells the person when the profile was not locked.
- AC-6: With `allowUnlock` off the unlock mode is refused (as if `unlock-account` were off) and `mode: "unlock"` opens a reset.
- AC-7: The checklist updates as the person types and the messages never show an error code.
- AC-8: When the bank is unavailable or times out nothing is changed.

#### 9. Scenarios

Synthetic persona `alex` (username `alex.morgan`) and `locked.user`.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-4 | `alex` | none | Username `alex.morgan`, code 482100, new password "Granite-Lemon-92-River" twice: "Password changed", rows Username `alex.morgan`, Changed "Tue 3 Nov 2026". Sign in with the new password works. |
| T-2 | AC-1 | `alex` | none | Password "short": "Use at least 12 characters. Three or four unrelated words work well." Password containing `alex.morgan`: "Don’t use your username in your password." A different confirmation: "The two passwords don’t match." The old password: "Choose a password you haven’t used here before." |
| T-3 | AC-2 | `alex` | none | Valid username, then "We sent a 6-digit code to ••• 4410." Code 000000: "That code isn’t right. Check the latest message and try again." Code 999999: "That code has expired. Ask for a new one." |
| T-4 | AC-3 | `alex` | none | Username "nobody" three times: the first two show "We couldn’t find a profile with those details. Check them and try again."; the third shows the "Too many tries" card. |
| T-5 | AC-5 | `locked.user`, locked at `sign-in` | none | `mode: "unlock"`, valid code: "Account unlocked", "Your password hasn’t changed." Sign in with the old password works. |
| T-6 | AC-5 | `alex`, not locked | none | Unlock: "Your account isn’t locked", "You can sign in now." |
| T-7 | AC-6 | `alex`, `allowUnlock` off | none | The unlock link is absent at `sign-in`; `mode: "unlock"` opens the reset screens. |
| T-8 | AC-7 | `alex` | none | The checklist shows ○ for all four rules on an empty field and ✓ for each rule as it is met. |
| T-9 | AC-8 | `alex` | `unavailable: ["bank.recover.resetPassword"]` (prototype: Service down on) | Connection sheet; the password is unchanged. |
| T-10 | AC-8 | `alex` | `timeout: ["bank.recover.resetPassword"]`, `latencyMs: 10000` | After 10 seconds: "This is taking longer than expected. Nothing was changed." The old password still works. |

#### 10. Expected mutation-check survivors

The breach and common-password lists are a short sandbox sample; removing one word survives; expected. The exact lock length survives (2 minutes in the sandbox); expected. The notification text is not asserted; expected. Everything else: none expected.

---

### ★ Unlock account — `unlock-account`

**Catalog:** slug `unlock-account`, workspace `public`, category Signing in and security (prototype tag "Sign-in and security"), core no, can a bank switch it off: yes, through the option `allowUnlock` of `reset-password`. Options: none of its own.

**Alias of `reset-password` with `{mode: "unlock"}`.** The prototype has no separate screens for it (`alias: {id: 'reset-password', params: {mode: 'unlock'}, opt: 'allowUnlock'}`). What differs:

- The screens are "Unlock your account", "Enter your code" and "Unlock your account" (button **Unlock account**); there is no password step. The password is not changed.
- The receipt is "Account unlocked" (or "Your account isn’t locked" when it was not locked) with a **Sign in** button.
- Launched with `{user}`; the link on the `sign-in` locked card is (planned), today only a deep link or the catalog entry opens it. The scenarios T-5, T-6 and T-7 of `reset-password` cover it; acceptance criteria AC-5 and AC-6.

---

### ★ Forgot password — `forgot-password`

**Catalog:** slug `forgot-password`, workspace `public`, category Signing in and security (prototype tag "Sign-in and security"), core no, can a bank switch it off: yes, together with `reset-password`. Options: none of its own.

**Alias of `reset-password` with `{mode: "reset"}`.** It is the name that the "Forgot password?" link on `sign-in` and the "Account locked" card call (`alias: {id: 'reset-password', params: {mode: 'reset'}}`). What differs:

- Nothing on the screens: it opens "Reset your password" exactly as `reset-password` does.
- It exists so a bank can place the link under its own name in menus and the `sign-in` help row; it has no catalog switch of its own.
- Launched with `{user}` from `sign-in`. Everything is covered by `reset-password` (AC-1 to AC-4, AC-7, AC-8).

---

### ★ Change password — `change-password`

**Catalog:** slug `change-password`, workspace `personal`, category Signing in and security (prototype tag "Sign-in and security"), core no, can a bank switch it off: yes (basic entry, kept in the Lean preset). Options (key, label, default): `signOutOthers` "Sign out other devices after a change" (on). Research: `research/change-password.md`. Built in `design/bankworkx-r1/src/journeys/55-security.js`, on the sign-in model `SI` from `48-sign-in.js` (password rules, lock counters, used passwords).

The lean rework removed the strength meter, the forced composition rules (capitals, symbols), the security questions and the reminder to change every 12 months. What remains: confirm the current password, choose a new one that passes the same rules as `sign-in`, and confirm with a one-time code.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `change-password` |
| Purpose | Let a signed-in customer change the password: current password, a new one checked against live rules, then a code. Wrong current passwords count towards a lock. |
| Release / workspace | 1 / Personal |
| Status | Built in the prototype as a three-screen form journey (`submit: "Change password"`, permission `accounts.view`). No money moves. |
| Channels | Web and mobile |
| Starting pattern | `fixtures/cab.ts` (password rules and sign-in lock) |
| Who may use it | Anyone signed in to Personal (`accounts.view`), for their own profile. |

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| More › Security › Password | none | `accounts.view` |
| Login history › Change password | none | `accounts.view` |
| Notification › New sign-in › Change password | none | `accounts.view` |
| Deep link `/personal/j/change-password` | none | `accounts.view` |

#### 3. Screens

Steps in order: `cur`, `new`, `code`, then the result.

**Screen `cur`** ("Current password"). Button **Continue**, busy "Checking…" (about 0.6 seconds).

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| Current password | `password`, max 128, with a Show or Hide button | Yes | Equals the current password | "That isn’t your current password." |

After a wrong password a banner shows "{n} attempts left" (or "1 attempt left"), counting down from 5. The counter is the same one `sign-in` uses. The fifth wrong password locks the profile: the field is replaced by the card "Account locked", "Too many wrong passwords.", with the buttons **Reset password** (`forgot-password`) and **Contact support**; the step is blocked ("Locked"). A correct password sets the counter to 0.

**Screen `new`** ("New password"). Button **Continue**.

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| New password | `password`, placeholder "At least 12 characters", max 64, with a Show or Hide button | Yes | Not the current password; at least 12 and at most 64 characters; not containing the username; not a common password; not in a known data breach; not one used before at the bank | "Choose a different password." / "Use at least 12 characters. Three or four unrelated words work well." / "Use 64 characters or fewer." / "Don’t use your username in your password." / "That password is too common. Try a longer phrase of unrelated words." / "This password has appeared in a data breach, so we can’t accept it." / "Choose a password you haven’t used here before." |
| Confirm new password | `password`, max 64 | Yes | Same as the new password | "The two passwords don’t match." |

A live checklist under the fields shows ✓ or ○ for five rules: "At least 12 characters", "Not your username", "Not a common password", "Not in a known data breach", "Not one you used before". No capital or symbol rules.

**Screen `code`** ("Enter your code"). Text "Sent to the phone ending 0142." Button **Confirm**, busy "Checking your code…" (about 0.6 seconds).

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| Code | `text`, placeholder "6 digits", max 6, hint "{n} tries left" after a wrong code | Yes | Exactly 6 digits | "Enter the 6 digits." |

A wrong code: "That code isn’t right. Try again." An expired code (the field is cleared): "That code has expired. Go back to get a new one." Three wrong codes: "Too many wrong codes. Nothing was changed. Go back to start again."

**Result** ("Password changed", green, text "Use your new password next time you sign in."). Rows "Changed" ("3 Nov 2026"), "Other devices" ("Signed out" with `signOutOthers` on, otherwise "Still signed in"). Buttons **Back to security**, **Done**. A note "Your password was changed" is added to the notification list.

**States**
- Loading: busy text on the button as above.
- Empty: not applicable.
- Error: the Service down switch shows the standard connection sheet ("We couldn’t reach the bank", "Nothing was sent and you haven’t been charged. Try again in a moment."); otherwise "This isn’t available right now. Nothing was changed. Try again in a few minutes." with **Try again**.
- Timeout: "This is taking longer than expected. Nothing was changed."
- Locked: as above.

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `INVALID_PASSWORD` | "That isn’t your current password." | `cur` | Try again |
| `ACCOUNT_LOCKED` | "Too many wrong passwords. For your safety this is locked." | `cur` | Reset password |
| `OTP_INVALID` | "That code isn’t right. Try again." | `code` | Try again |
| `OTP_EXPIRED` | "That code has expired. Go back to get a new one." | `code` | Back |
| `OTP_LOCKED` | "Too many wrong codes. Nothing was changed. Go back to start again." | `code` | Back to start |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | `cur`, `code` | Try again |
| `SERVICE_UNAVAILABLE` | "This isn’t available right now. Nothing was changed. Try again in a few minutes." | `cur`, `code` | Try again |
| `JOURNEY_DISABLED` | "This isn’t available at your bank." | whole journey | none |
| `PERMISSION_DENIED` (planned) | Standard message | whole journey | Back |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `checkPassword` | `bank.password.check` | `{current}` | `{ok}` | `INVALID_PASSWORD`, `ACCOUNT_LOCKED`, `SERVICE_UNAVAILABLE`, `TIMEOUT` | (planned) |
| `passwordPolicy` | `bank.password.policy` | `{username, password}` | the rule results, including breach and used-before | none | (planned). The CAB twin is `cab.password.policy` |
| `sendOtp` / `verifyOtp` | `bank.otp.send` / `bank.otp.verify` | `{channel}` / `{code}` | `{sent}` / `{verified}` | `OTP_INVALID`, `OTP_EXPIRED`, `OTP_LOCKED` | Existing (`packages/mock-bank-api/src/index.ts`) |
| `changePassword` | `bank.password.change` | `{current, new, signOutOthers}` | `{changedAt}` | `POLICY`, `OTP_REQUIRED`, `SERVICE_UNAVAILABLE`, `TIMEOUT` | (planned) |

#### 6. Permissions, step-up and limits

`accounts.view`. Step-up: the current password, then a one-time code (6 digits, 3 tries). Limits: 5 wrong current passwords lock the profile (shared with `sign-in`); password 12 to 64 characters. A change takes effect at once.

#### 7. Result and links out

Result as above. Notifications raised (planned): a text and an email "Your BankWorkx® password was changed" with a number to call if it was not the person. Every change is written to the security log (audit). Links out: More (security), `forgot-password` (locked), `contact-support`. With `signOutOthers` on, the bank ends every other session when the password changes (the prototype shows the row but does not change the device list).

#### 8. Acceptance criteria

- AC-1: A wrong current password shows the message and the attempts left; the fifth locks the profile and offers a reset.
- AC-2: The new password must differ from the current one and pass every rule, with the message of the first rule it breaks.
- AC-3: The checklist updates as the person types; the confirmation must match.
- AC-4: A one-time code is required; a wrong code shows the tries left; three wrong codes end the attempt with nothing changed; an expired code asks to go back.
- AC-5: After success the new password works at `sign-in`, the old one does not, and it cannot be reused later.
- AC-6: The result shows the date and whether other devices were signed out, following `signOutOthers`.
- AC-7: When the bank is unavailable or times out nothing is changed.

#### 9. Scenarios

Synthetic persona `alex` (username `alex.morgan`). The sandbox current password is the demo password; the code is the fixed test code.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1 | `alex` | none | A wrong current password: "That isn’t your current password." and "4 attempts left". Five wrong: the "Account locked" card with **Reset password**. |
| T-2 | AC-2, AC-3 | `alex` | none | New password equal to the current: "Choose a different password." "short": "Use at least 12 characters. Three or four unrelated words work well." Containing `alex.morgan`: "Don’t use your username in your password." A different confirmation: "The two passwords don’t match." |
| T-3 | AC-4 | `alex` | none | Code 000000: "That code isn’t right. Try again." and "2 tries left"; three times: "Too many wrong codes. Nothing was changed. Go back to start again." Code 999999: "That code has expired. Go back to get a new one." |
| T-4 | AC-5, AC-6 | `alex`, `signOutOthers` on | none | Current password, new "Harbour-Maple-47-Tide" twice, code 482100: "Password changed", rows "Changed" "3 Nov 2026", "Other devices" "Signed out". Signing in with the new password works. |
| T-5 | AC-5 | `alex` | none | After T-4, choosing "Harbour-Maple-47-Tide" again as a new password: "Choose a password you haven’t used here before." |
| T-6 | AC-6 | `alex`, `signOutOthers` off | none | Row "Other devices" "Still signed in". |
| T-7 | AC-7 | `alex` | `unavailable: ["bank.password.change"]` (prototype: Service down on) | Connection sheet; the password is unchanged. |
| T-8 | AC-7 | `alex` | `timeout: ["bank.password.change"]`, `latencyMs: 10000` | After 10 seconds: "This is taking longer than expected. Nothing was changed." The old password still works. |

#### 10. Expected mutation-check survivors

The breach and common-password lists are a short sandbox sample; removing one word survives; expected. The security-log entry and the notification are not asserted; expected. Signing out other devices is not asserted in the prototype; expected until `bank.password.change` is built. Everything else: none expected.

---

### ★ Trusted devices — `trusted-devices`

**Catalog:** slug `trusted-devices`, workspace `personal`, category Signing in and security (prototype tag "Sign-in and security"), core no, can a bank switch it off: yes (basic entry, kept in the Lean preset). This is a **VIEW** (a screen in the More tab, `view: true`, `tab: 'more'`), not a form journey. Options (key, label, default): `limit` "Limit trusted devices to 5" (on); `signOutAll` "Offer “Sign out other devices”" (on). Research: `research/trusted-devices.md`. Built in `design/bankworkx-r1/src/journeys/55-security.js` (object `TD`, devices in `SEC.devices`).

The lean rework removed the per-device detail page, the location map and the rename action. What remains: a list of the devices that skip the new-device code, a code-confirmed Remove for each other device, and one **Sign out other devices** button.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `trusted-devices` |
| Purpose | Show the devices that skip the new-device code, and let the person remove one, or sign out every other device, after confirming with a code. |
| Release / workspace | 1 / Personal |
| Status | Built in the prototype as a view in the More tab. The code check and the removal are simulated in the screen itself. No money moves. |
| Channels | Web and mobile |
| Starting pattern | `fixtures/cab.ts` (device options) |
| Who may use it | Anyone signed in to Personal (`accounts.view`), for their own devices. |

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| More › Security › Trusted devices | none | `accounts.view` |
| Notification › New sign-in | none | `accounts.view` |
| Deep link `/personal/more/trusted-devices` | none | `accounts.view` |

#### 3. Screen

Route: web `/personal/more/trusted-devices`; mobile More tab, row Trusted devices. Data source: the device list of the signed-in profile (`SEC.devices` in the prototype; `bank.devices.list`, planned).

**Header.** Title "Trusted devices". With `limit` on, a small line "{n} of 5" (devices in use against the cap).

**List.** One card with a row per device, in this order: this device first, then the others by most recent use (the prototype keeps its data order). Each row: an icon (phone, or wallet-style for laptop and tablet), the device name in bold, "Last used {when}" ("Now", "Yesterday, 18:20", "12 Oct 2026"), and on the right the chip **This device** for the current device or a **Remove** button for any other. The current device cannot be removed here.

| Device (sandbox) | Last used | Where |
|---|---|---|
| iPhone 15 (this device) | Now | Signed in on this device |
| Work laptop, Chrome | Yesterday, 18:20 | Web browser |
| Android tablet | 12 Oct 2026 | Mobile app |

**Remove panel** (opens under the list after **Remove** on a row).

- Title "Remove {device}?" and text "It will ask for a code next time it signs in."
- Field "Code sent to the phone ending 0142": `text`, placeholder "6 digits", max 6.
- Buttons **Remove** and **Cancel**.
- Errors under the field: fewer than 6 digits "Enter the 6 digits."; expired code (`999999`) "That code has expired. Cancel and start again."; wrong code (`000000`) "That code isn’t right. {n} tries left." with n = 2, then 1; bank unavailable "This isn’t available right now. Nothing was changed."
- Three wrong codes close the panel and show a red banner "Too many wrong codes. Try again later." The Remove buttons and the sign-out button stay unusable until the person leaves and returns.
- Success: the device row disappears, a toast "Device removed", and a note "{device} was removed from your trusted devices" is added to the notification list.

**Sign out other devices** (button under the list; shown only with `signOutAll`, when there is another device, no panel is open and the screen is not locked). The same panel appears with the title "Sign out other devices?", text "Every other device is signed out and asks for a code next time.", button **Sign out**. Success: only this device stays in the list, a toast "Other devices signed out", and a note "Signed out of all other devices".

**States**
- Loading: skeleton of three rows (planned; the prototype draws at once).
- Empty: icon, "No trusted devices", "Devices you trust will show here." (only possible if this device is not trusted; planned).
- Error (bank unavailable): a banner "Some details may be out of date." above the list, and the code check refuses with "This isn’t available right now. Nothing was changed."
- Timeout: after 10 seconds, "This is taking longer than expected. Nothing was changed." with **Try again** (planned for the view).
- Locked: the red banner above.

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `OTP_INVALID` | "That code isn’t right." (with the tries left) | remove panel | Remove |
| `OTP_EXPIRED` | "That code has expired. Cancel and start again." | remove panel | Cancel |
| `OTP_LOCKED` | "Too many wrong codes. Try again later." | banner | none |
| `SERVICE_UNAVAILABLE` | "This isn’t available right now. Nothing was changed. Try again in a few minutes." | remove panel | Remove |
| `TIMEOUT` (planned) | "This is taking longer than expected. Nothing was changed." | remove panel | Try again |
| `DEVICE_NOT_FOUND` (planned) | "That device is already gone." | list | OK |
| `JOURNEY_DISABLED` | "This isn’t available at your bank." | whole view | none |
| `PERMISSION_DENIED` (planned) | Standard message | whole view | Back |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `devices` | `bank.devices.list` | none | list of `{id, name, kind, lastUsed, current}` | `SERVICE_UNAVAILABLE` | (planned). The prototype reads `SEC.devices` |
| `sendOtp` / `verifyOtp` | `bank.otp.send` / `bank.otp.verify` | `{channel}` / `{code}` | `{sent}` / `{verified}` | `OTP_INVALID`, `OTP_EXPIRED`, `OTP_LOCKED` | Existing (`packages/mock-bank-api/src/index.ts`) |
| `removeDevice` | `bank.devices.remove` | `{deviceId}` or `{all: true}` | `{removed}` | `DEVICE_NOT_FOUND`, `OTP_REQUIRED`, `SERVICE_UNAVAILABLE`, `TIMEOUT` | (planned) |

#### 6. Permissions, step-up and limits

`accounts.view`. Step-up: a one-time code (6 digits, 3 tries) to remove a device or sign out the others; none to look. Limits: at most 5 trusted devices (with `limit` on); the current device is never removed here.

#### 7. Result and links out

The result is the updated list with a toast. Notifications raised (planned): a text "A device was removed from your trusted devices" or "Every other device was signed out". Every removal is written to the security log (audit). Links out: More (security), `setup-quick-login`, `change-password`.

#### 8. Acceptance criteria

- AC-1: The list shows each device with its last use, the current one marked **This device** without a Remove button.
- AC-2: Remove asks for a code first; a correct code removes the device and shows the toast and the notification.
- AC-3: A wrong code shows the tries left; three wrong codes lock the view with "Too many wrong codes. Try again later."; an expired code asks to cancel and start again.
- AC-4: **Sign out other devices** appears only with `signOutAll` and another device, and after a correct code leaves only this device.
- AC-5: With `limit` on the header shows "{n} of 5".
- AC-6: Cancel closes the panel and changes nothing.
- AC-7: When the bank is unavailable the banner shows and nothing is changed.

#### 9. Scenarios

Synthetic persona `alex`, three devices as in the table.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-5 | `alex` | none | Three rows; "3 of 5"; "This device" on the iPhone 15; Remove on the other two. |
| T-2 | AC-2 | `alex` | none | Remove "Work laptop, Chrome": panel "Remove Work laptop, Chrome?"; code 482100; the row is gone, toast "Device removed". |
| T-3 | AC-3 | `alex` | none | Code "12": "Enter the 6 digits." Code 000000: "That code isn’t right. 2 tries left." Three times: the banner "Too many wrong codes. Try again later." Code 999999: "That code has expired. Cancel and start again." |
| T-4 | AC-4 | `alex` | none | **Sign out other devices**, code 482100: one row left, toast "Other devices signed out". With `signOutAll` off, or with only this device left, the button is absent. |
| T-5 | AC-6 | `alex` | none | Open the panel, **Cancel**: all rows remain. |
| T-6 | AC-7 | `alex` | `unavailable: ["bank.devices.remove"]` (prototype: Service down on) | Banner "Some details may be out of date."; a valid code gives "This isn’t available right now. Nothing was changed." and the list is unchanged. |
| T-7 | AC-7 | `alex` | `timeout: ["bank.devices.remove"]`, `latencyMs: 10000` | After 10 seconds: "This is taking longer than expected. Nothing was changed." (planned for the view). |

#### 10. Expected mutation-check survivors

The "{n} of 5" count survives when the cap is not asserted against the real device limit; expected. The sort order survives when two devices have the same last use; expected. The security-log entry and the text notification are not asserted; expected. Everything else: none expected.

---

### ★ Change quick PIN — `change-quick-pin`

**Catalog:** slug `change-quick-pin`, workspace `personal`, category Signing in and security (prototype tag "Sign-in and security"), core no, can a bank switch it off: yes (basic entry, kept in the Lean preset). Options: none. Research: `research/change-quick-pin.md`. Built in `design/bankworkx-r1/src/journeys/55-security.js`, on the sign-in model `SI` from `48-sign-in.js`.

The lean rework removed the PIN reminder, the "forgot PIN" path inside this journey and the one-time code. What remains: the current PIN is the proof; a new 6-digit PIN replaces it. Three wrong PINs turn quick sign-in off.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `change-quick-pin` |
| Purpose | Change the 6-digit PIN used for quick sign-in on this device: current PIN, then a new PIN with no repeats or runs. |
| Release / workspace | 1 / Personal |
| Status | Built in the prototype as a form journey (`submit: "Change PIN"`, permission `accounts.view`). No money moves. |
| Channels | Web and mobile |
| Starting pattern | `fixtures/cab.ts` (`cab.device.verifyPin`) |
| Who may use it | Anyone signed in to Personal (`accounts.view`) whose device has a quick PIN. |

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| More › Security › Quick PIN | none | `accounts.view` |
| `setup-quick-login` result (PIN on) › Change PIN (planned) | none | `accounts.view` |
| Deep link `/personal/j/change-quick-pin` | none | `accounts.view` |

#### 3. Screens

Steps in order: `none` (only when there is no PIN), `cur`, `new`, then the result.

**Screen `none`** ("No quick PIN yet"). Shown instead of the rest when this device has no quick PIN. Text "You haven’t set a quick PIN on this device." Button **Set up quick sign-in** (opens `setup-quick-login`). The step cannot be continued ("Set up first").

**Screen `cur`** ("Current PIN"). Button **Continue**, busy "Checking…" (about 0.5 seconds).

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| Current PIN | `password`, placeholder "6 digits", max 6 | Yes | Exactly 6 digits; equals the PIN | "Enter your 6-digit PIN." and "That PIN isn’t right." |

After a wrong PIN a banner shows "{n} tries left" (2, then 1). The field is cleared. The third wrong PIN turns quick sign-in off: the field is replaced by the card "Quick PIN turned off", "Too many wrong PINs.", button **Set up again** (opens `setup-quick-login`), and the message "Too many wrong PINs. Quick sign-in is off. Set it up again." A correct PIN sets the counter to 0.

**Screen `new`** ("New PIN"). Button **Change PIN**.

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| New PIN | `password`, placeholder "6 digits", max 6, hint "Avoid repeats like 111111 and runs like 123456." | Yes | Exactly 6 digits; not the current PIN; not a repeat or a run; no digits from the phone number | "Use exactly 6 digits." and "Choose a different PIN." and "That PIN is too easy to guess. Avoid repeats and runs like 111111 or 123456." and "Don’t use digits from your phone number." |
| Confirm new PIN | `password`, max 6 | Yes | Same as the new PIN | "The PINs don’t match." |

Too-easy PINs: six equal digits, ascending or descending runs, three repeated pairs (121212), and 112233, 123123, 696969, 000111.

**Result** ("PIN changed", green, text "Use your new PIN next time."). Row "Device" (the device name). Buttons **Back to security**, **Done**. A note "Your quick PIN was changed" is added to the notification list.

**States**
- Loading: busy text on the `cur` button.
- Empty: the `none` screen above.
- Error: the Service down switch shows the standard connection sheet ("We couldn’t reach the bank", "Nothing was sent and you haven’t been charged. Try again in a moment."); otherwise "This isn’t available right now. Nothing was changed. Try again in a few minutes." with **Try again**.
- Timeout: "This is taking longer than expected. Nothing was changed."
- Locked: as above.

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `PIN_WRONG` | "That PIN isn’t right." | `cur` | Try again |
| `PIN_LOCKED` | "Too many wrong PINs. Quick sign-in is off. Set it up again." | `cur` | Set up again |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | `cur` | Try again |
| `SERVICE_UNAVAILABLE` | "This isn’t available right now. Nothing was changed. Try again in a few minutes." | `cur` | Try again |
| `JOURNEY_DISABLED` | "This isn’t available at your bank." | whole journey | none |
| `PERMISSION_DENIED` (planned) | Standard message | whole journey | Back |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `verifyPin` | `bank.devices.verifyPin` | `{pin}` | `{ok}` | `PIN_WRONG`, `PIN_LOCKED`, `SERVICE_UNAVAILABLE`, `TIMEOUT` | (planned). The CAB twin is `cab.device.verifyPin` (existing in `packages/mock-bank-api/src/cab.ts`) |
| `changePin` | `bank.devices.changePin` | `{current, new}` | `{changedAt}` | `PIN_WEAK`, `PIN_LOCKED`, `SERVICE_UNAVAILABLE`, `TIMEOUT` | (planned) |

The PIN is stored hashed on the device; the bank never sees it (planned).

#### 6. Permissions, step-up and limits

`accounts.view`. Step-up: the current PIN; no code. Limits: 3 wrong PINs turn quick sign-in off; a PIN is exactly 6 digits.

#### 7. Result and links out

Result as above. Notification raised (planned): "Your quick PIN was changed" by text. Links out: More (security), `setup-quick-login`.

#### 8. Acceptance criteria

- AC-1: With no quick PIN the person sees "No quick PIN yet" and a way to set one up.
- AC-2: A wrong current PIN shows "That PIN isn’t right." and the tries left; the third turns quick sign-in off and offers to set it up again.
- AC-3: The new PIN must be 6 digits, differ from the current one, not be a repeat or run, not contain digits of the phone number, and be confirmed.
- AC-4: After success the new PIN works for quick sign-in and the old one does not.
- AC-5: When the bank is unavailable or times out the PIN is unchanged.

#### 9. Scenarios

Synthetic persona `alex`, device "iPhone 15", quick PIN set.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1 | `alex`, no quick PIN | none | "No quick PIN yet" with **Set up quick sign-in**; the step cannot continue. |
| T-2 | AC-2 | `alex` | none | A wrong PIN: "That PIN isn’t right." and "2 tries left"; a second: "1 try left"; a third: "Too many wrong PINs. Quick sign-in is off. Set it up again." and the card with **Set up again**. |
| T-3 | AC-3 | `alex` | none | New PIN equal to the current: "Choose a different PIN." 111111: "That PIN is too easy to guess. Avoid repeats and runs like 111111 or 123456." 5 digits: "Use exactly 6 digits." Confirmation different: "The PINs don’t match." |
| T-4 | AC-3, AC-4 | `alex` | none | Current 837215, new 504719 twice: "PIN changed", row Device "iPhone 15". Quick sign-in with 504719 works; 837215 does not. |
| T-5 | AC-5 | `alex` | `unavailable: ["bank.devices.verifyPin"]` (prototype: Service down on) | Connection sheet; the PIN is unchanged. |
| T-6 | AC-5 | `alex` | `timeout: ["bank.devices.verifyPin"]`, `latencyMs: 10000` | After 10 seconds: "This is taking longer than expected. Nothing was changed." |

#### 10. Expected mutation-check survivors

The too-easy PIN list is a short sample; removing one entry survives; expected. The notification is not asserted; expected. Everything else: none expected.

---

## Personal: Home

Alex Morgan (`alex`) is the person in every example. Sandbox "today" is 2 Nov 2026. Amounts are USD unless a line says otherwise. Data comes from `packages/bank-client/src/view-models/` (`dashboard.ts`, `accounts.ts`, `budgets.ts`, `home.ts`) and the sandbox.

### Shell: Home (dashboard)

| Item | Spec |
|---|---|
| Purpose | One glance at money: how much, where it is, what happened, what is coming. No journeys start here except through the **+** quick actions and the cards below. |
| Route | Web `/personal/home`; mobile tab **Home** (first tab). |
| Data source | Existing: `bank.accounts.list`, `bank.accounts.totals`, `bank.budgets.list`, `bank.subscriptions.list`, `Finance.transactions`, view-models `totalBalance`, `recentTransactions`, `budgetProgress`, `spendingSegments`, `subscriptionsDue`, `notifications`. Planned: `bank.schedules.list` (upcoming payments), `bank.offers.list` (offers), `bank.session.get` (permissions for the **+** menu). |
| Loading | Skeleton for the hero, three account cards, two insight tiles and three payment rows. Whole page shows the error state after 10 s. |

**Widgets, top to bottom**

| # | Widget | Content | Rules |
|---|---|---|---|
| 1 | Balance hero | Greeting "Good morning, Alex" (by local time), **Total balance** in large type, a one-line delta "+$1,073.60 saved this month" (`Finance.savings`), a hide-balance eye. | Totals are **per currency**, never added across currencies (`bank.accounts.totals`). With several currencies the hero shows the main currency large (USD) and the others as chips ("EUR 2,400.00", "AED 11,000.00"). Linked banks (`Finance.linked`) are included in the USD total as in `totalBalance`. Hide-balance shows "••••" and is remembered per device. |
| 2 | Quick actions (**+**) | Send money, Pay a bill, Top up, Add money. | Each button appears only when the context holds `payments.create`. Targets: `personal-transfer`, `pay-bill`, `mobile-topup`, `add-money`. |
| 3 | Accounts | A horizontal row of account cards: name, mask, available balance, currency flag. Last card "Open another account". | Own accounts first, then linked banks (`accountItems`). Tap a card: Accounts › detail. "Open another account": `open-another-account` (`accounts.manage`). |
| 4 | Insights | Tiles: **Money in / Money out** this month (`income`, `expense`), **Spending ring** (`spendingSegments`, top category named), **Budgets** (one line for the budget closest to its limit using `budgetProgress` words), **Savings rate**. | Budget tile shows the existing messages: "Good job! Your spending is on track." (under 60%), "Careful, you have used most of this budget." (60 to 89%), "Almost at your limit this month." (90% and over). Tap: Accounts › spending analysis or › budgets. |
| 5 | Recent activity | The last 4 transactions (`recentTransactions`) with a filter All / Money in / Money out (titles from `transactionsTitle`: "Transactions", "Money in", "Money out"). | Tap a row: Accounts › transaction detail. "See all": Accounts › transaction history. |
| 6 | Upcoming payments | Next 5 items from `bank.subscriptions.list` (renewing within 14 days, `subscriptionsDue`) and `bank.schedules.list` (planned) sorted by date. Each row: payee, date, amount, a chip (Subscription, Once, Weekly, Monthly, Standing order). | Row action **Edit** appears on schedules only: `schedule-payment {scheduleId}` (`payments.schedule`). Subscription rows have **Pay now** (existing `bank.subscriptions.pay`). |
| 7 | Offers | Up to 3 cards from `bank.offers.list` (planned): title, one line, button. | Button **Apply** opens `apply-loan {offerId}` or `open-another-account {offerId}` (`loans.apply` or `accounts.manage`). A card disappears when the person lacks the permission. |
| 8 | Bell | Notification list (`notifications`): budgets 90% used, subscriptions renewing in 5 days or fewer. | Empty text: "You're all caught up." Planned notification centre in More shows the full history. |

| State | Spec |
|---|---|
| Empty (Sam Rivera: no accounts) | Hero reads "Welcome, Sam", body "You don't have an account yet. Open one in a few minutes.", button **Open an account** (opens `open-another-account`). Widgets 3 to 7 are replaced by one card "Add a bank you already use" with **Connect account** (`connect-account`). |
| Partial empty | No recent activity: "Nothing yet. Your activity will show here." No upcoming payments: "No payments coming up." with **Schedule a payment**. No offers: widget hidden. |
| Error | A banner "We couldn't load your accounts. Nothing was changed." with **Try again**. Widgets that loaded stay visible. |
| Drill-downs | Account card to account detail; Insights tiles to spending analysis or budgets; recent row to transaction detail; upcoming payment to its schedule detail in Payments › scheduled. |
| Launch points on it | Section 5.2 rows for Home: Send money, Pay a bill, Top up, Add money, Upcoming payment › Edit, Offer › Apply, Header › Switch to Business. |

---

## Personal: Accounts

### Shell: Accounts list

| Item | Spec |
|---|---|
| Purpose | All accounts in one place, with totals per currency. |
| Route | Web `/personal/accounts`; mobile tab **Accounts**. |
| Data source | Existing `bank.accounts.list`, `bank.accounts.totals`, view-model `accountItems`. |
| Widgets | A totals strip (one chip per currency from `bank.accounts.totals`: "USD 23,975.13 · 2 accounts", "EUR 2,400.00 · 1", "AED 11,000.00 · 1"). Then a card per account: name, mask, IBAN last 4, available balance, a status chip (Active, Frozen) from `Account.status`. Linked banks follow in a second group "Other banks" with the bank name. Button **Open another account**. |
| Sort | BankWorkx accounts in the order the bank returns them (Main, Savings, EUR Travel, AED Home); linked banks after, by name. |
| Filters | None (4 to 6 items). A currency chip filter appears when there are more than 6 accounts. |
| Empty | Sam: "You don't have an account yet." Button **Open another account**. |
| Loading / error | Skeleton cards; error banner "We couldn't load your accounts. Nothing was changed." with **Try again**. |
| Drill-downs | Account card to account detail. Linked-bank card to a read-only detail (balance only, no IBAN, no actions). |
| Launch points | Accounts › list › Open another account. |

### Shell: Account detail

| Item | Spec |
|---|---|
| Purpose | Everything about one account and the actions that belong to it. |
| Route | Web `/personal/accounts/{accountId}`; mobile screen `AccountDetail`. |
| Data source | Existing `bank.accounts.list` fields (`name`, `maskedNumber`, `iban`, `balance`, `currency`, `status`, `canDebit`). Planned `bank.accounts.get {accountId}`: adds `ledgerBalance`, `holds[]`, `nickname`, `openedOn`, `interestRate`, `limits`. |
| Header | Nickname or product name ("Main"), mask "••4410", status chip. |
| Balances | Two figures side by side. **Available balance** (what you can spend; the sandbox's existing `balance`): $8,720.76. **Ledger balance** (what is booked, before holds): $8,840.76. Helper text under them: "Available is your ledger balance minus money held for card payments that haven't settled yet. Holds: $120.00." Tapping "Holds" lists them (merchant, date, amount, expires). When there are no holds both figures are equal and the helper reads "Nothing is on hold." |
| Details card | **IBAN** `US00 BWX 0000 0000 4410` with a Copy button (toast "IBAN copied"), **Account number** ••4410, **Currency** USD, **Opened** date, **Daily transfer limit** and the amount used today (from `bank.limits.get`, with `currency` for non-USD accounts). |
| Actions | **Transfer from this account** (`own-transfer` or `personal-transfer`, passes `{accountId}`), **Statement** (`account-statement`), **Rename** (`account-nickname`), **Freeze** is not here (cards only). Buttons are hidden without the permission in section 4.1. A frozen account shows an alert "This account is frozen. You can still receive money." and hides Transfer. |
| Below | Mini chart of the balance for the period (existing `Finance.ranges` with the 1W / 1M / 3M / 1Y switch, `chart` block planned), then the last 5 transactions of this account and **See all** to history filtered to this account. |
| Empty | New account with no transactions: "No activity yet. Money you send and receive will show here." and **Add money**. |
| Loading / error | Skeleton; banner "We couldn't load this account. Nothing was changed." with **Try again**. Unknown id: "We can't find that account. Choose another." with **Back to accounts** (`ACCOUNT_NOT_FOUND`). |
| Launch points | Accounts › detail › Statement, Rename, Transfer from this account. |

### Shell: Transaction history

| Item | Spec |
|---|---|
| Purpose | Find any past transaction. |
| Route | Web `/personal/accounts/transactions?accountId=…`; mobile screen `Transactions`. |
| Data source | Existing: `Finance.transactions` with view-models `filterTransactions` (search by title, kind all / in / out) and `groupByDay`. Planned: `bank.transactions.list {accountId, from, to, kind, category, minAmount, maxAmount, query, cursor, pageSize}` returning pages (default 25) and `total`. |
| Widgets | `dataTable` (planned): a table on web, a grouped card list on phones. Search box ("Search by name or reference"). Filter bar: **Account** (All accounts or one), **Type** (All, Money in, Money out), **Date** (`datePicker` range, planned; presets Last 7 days, This month, Last month, Last 3 months, Custom), **Category** (multi-select), **Amount** (min and max). A "Clear filters" link when any filter is on. A result count: "7 transactions". |
| Columns (web) | Date (`12 Nov 2026` plus time), Description, Category (statusChip-style label), Account (mask), Amount (green for in, plain for out, signed), Status (Posted, Pending). On phones: description, category, time on the left; signed amount on the right; grouped under day headers ("Today", "Yesterday", `31 Oct 2026`). |
| Sort | Newest first (default). Column sort on Date and Amount on web. Pending items always on top. |
| Pages | 25 per page; "Load more" on phones, numbered pages on web. |
| Empty | No transactions at all: "No transactions yet." With filters on and no match: "No transactions match these filters." with **Clear filters**. |
| Loading / error | Skeleton rows. Error: "We couldn't load your transactions. Nothing was changed." with **Try again**. Date range longer than 24 months: field error "Choose a period of 24 months or less." |
| Drill-downs | Row to transaction detail. **Export** button (web) opens `account-statement {accountId, from, to}` with the filters carried over. |
| Launch points | Accounts › detail › See all; Home › Recent activity › See all. |

### Shell: Transaction detail

| Item | Spec |
|---|---|
| Purpose | Everything known about one transaction, plus the next sensible actions. |
| Route | Web `/personal/accounts/transactions/{transactionId}`; mobile screen `TransactionDetail`. |
| Data source | Existing `Txn` fields: `id`, `title`, `category`, `amount`, `daysAgo`, `time`. Planned `bank.transactions.get {transactionId}`: adds `status`, `reference`, `channel`, `merchant`, `cardLast4`, `runningBalance`, `accountId`, `counterparty`, `paymentId`. |
| Layout | Large signed amount ("−$900.00"), title ("Monthly Rent"), a status chip (Pending, Posted), then rows: Date and time (`30 Oct 2026, 09:00 UTC`), Account, Category, Reference, Channel (Card, Transfer, Bill, Top-up, Salary), Balance after (`runningBalance`). For transfers: **Payee** and a link **View payment** to Payments › tracker. For card payments: card ••5832 and merchant. |
| Actions | **Download receipt** (shell receipt, PDF on web, share sheet on phones; planned engine receipts; needs `accounts.view`). **Repeat payment** only when `paymentId` is set (opens the originating journey with `{paymentId}`, `payments.create`). **Report a problem** only for card payments (`dispute-transaction {transactionId}`, `cards.dispute`). **Create a budget for {category}** for spending categories (`create-budget {category}`). |
| Empty / error | Unknown id: "We can't find that transaction." with **Back to transactions**. Loading: skeleton. |
| Launch points | Accounts › transaction detail › Dispute, Download receipt. |

### Shell: Spending analysis

| Item | Spec |
|---|---|
| Purpose | Show where the month's money went. |
| Route | Web `/personal/accounts/spending`; mobile screen `Spending`. |
| Data source | Existing `Finance.spendingByCategory` (Groceries 1,240; Health & Wellness 620; Home Rent 2,100; Vehicle 780; Entertainment 460), `income` 3,480, `expense` 2,406.40, `savings` 1,073.60, view-model `spendingSegments` (total and share). Planned `bank.spending.get {period}` with month-over-month change. |
| Widgets | Donut (`chart`, planned, reuses `Donut`) with the total in the middle and the category list beside it (name, amount, share %). A period switch: This month, Last month, Last 3 months. A bar of **Money in vs money out**. A line "You spent 12% less than last month" (planned). A list **Biggest payments** (top 5 by amount). |
| Filters / sort | Period only. Categories sorted by amount, largest first. |
| Empty | "No spending to show yet. Your spending will appear here after your first payment." |
| Loading / error | Skeleton donut and rows; "We couldn't load your spending. Nothing was changed." with **Try again**. |
| Drill-downs | A category row to Transaction history with that category and period set. Button **Set a budget** next to a category opens `create-budget {category}` (`accounts.manage`). |
| Launch points | Accounts › budgets › New budget (`create-budget {category}`). |

### Shell: Budgets list

| Item | Spec |
|---|---|
| Purpose | See each budget against what has been spent. |
| Route | Web `/personal/accounts/budgets`; mobile screen `Budgets` (detail: `budgetId` in the route, `Budget`). |
| Data source | Existing `bank.budgets.list` (Alex: Food & Drinks limit 1,500 spent 525; Shopping 1,500 spent 450; Entertainment 300 spent 272), view-models `budgetProgress`, `budgetIcon`, `budgetDetail`. |
| List card | Icon, name, "spent of limit" ("$525.00 of $1,500.00"), a progress bar coloured by tone (ok under 60%, warn 60 to 89%, over 90% and above) and the `budgetProgress` message. |
| Detail | `budgetDetail(b, txns, period, daysLeft)`: Left ("$975.00 left"), Per day ("$34 a day for 28 days"), a Week / Month switch, and the matching transactions (food budgets include coffee). |
| Sort | Closest to its limit first. |
| Empty | "You haven't set a budget yet. A budget tells you when you're close to your limit." with **New budget**. |
| Loading / error | Skeleton cards; "We couldn't load your budgets. Nothing was changed." with **Try again**. |
| Drill-downs | Card to budget detail; transaction row to transaction detail. |
| Launch points | Accounts › budgets › New budget (`create-budget {category}`), `accounts.manage`. Editing and deleting a budget are not in Release 1 (see open questions). |

---

### ★ Accounts overview — `accounts`

**Catalog:** slug `accounts`, workspace `personal`, category Accounts (Personal: Accounts), core no, can a bank switch it off: yes (a screen, kept in the Lean preset as a basic entry; switching it off hides the Accounts tab and the Home accounts card). Options: **Offer the hide-balance toggle** (`hideBalance`, default on); **Show foreign currency accounts** (`showFx`, default on). Research: `research/accounts.md`. Built in `design/bankworkx-r1/src/journeys/20-accounts.js`, which also holds the shared account model `ACC` used by `account-details` and `statement`.

The earlier heavy version (currency chips, filter and sort bar, per-card quick actions, ledger line, interest chip, explainer footer, Refresh) was removed in the lean rework. This block replaces the table "Shell: Accounts list" above as the specification of the screen; that table stays as the production data-source note (`bank.accounts.list`, `bank.accounts.totals`).

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `accounts` |
| Purpose | Show every account in one place: a total balance and one row per account with its available balance, grouped as Everyday, Savings and Other currencies. One tap opens the account. |
| Release / workspace | 1 / Personal |
| Status | Built in the prototype as a screen (`view: true`, tab `acc`). Not a form journey: no submit, no money moves. Production data source partly planned (section 5). |
| Channels | Web (list on the left, account on the right once one is chosen) and mobile (list, then the account full screen) |
| Starting pattern | None |
| Who may use it | Anyone signed in to Personal with `accounts.view`. |

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Tab bar › Accounts (mobile), left rail › Accounts (web) | none | `accounts.view` |
| Home › Accounts card | none | `accounts.view` |
| `account-details` › Accounts (back) | none | `accounts.view` |
| `cards` › See all (card transactions) | `{accountId}` (opens the account beside the list) | `accounts.view` |
| Deep link `/personal/accounts` | optional `{accountId}` | `accounts.view` |

#### 3. Screens

One screen, **Accounts**. It has no typed fields.

**Total balance** (shown only after the list has loaded and at least one account is visible). Label "Total balance" and one big number: the sum of the ledger balances of every visible account, converted to dollars at the sandbox rate. Hidden accounts are left out; foreign currency accounts are left out when `showFx` is off. When `hideBalance` is on there is a **Hide** / **Show** button beside the label. Hide replaces every amount on this screen, on the account screen and on the transaction rows with "••••••". The choice lasts for the session (a per-device setting in production, planned).

**Account list.** Groups with a small heading, in this order, each shown only when it has accounts:

| Group | Holds |
|---|---|
| Everyday | current accounts |
| Savings | savings accounts |
| Other currencies | accounts in a currency other than the home currency (hidden when `showFx` is off) |
| Hidden | accounts the person hid, shown dimmed with a "Hidden" chip and left out of the total |

Each row shows an icon (wallet, savings, swap), the name (the person's own name if set, else the product name), the mask and currency code ("••4410 · USD"), and on the right the **available** balance (ledger minus card holds), in the account's own currency. A status chip appears under the amount when the account is not active: "Dormant", "Closing" (a closure was requested) or "Frozen". The whole row opens `account-details {accountId}`; the chosen row has an outline.

**Footer.** One quiet button **Open another account** (opens `open-another-account`). It is hidden when that journey is off, not built or not allowed.

**Account pane (web).** When an account is chosen on a wide screen, the list stays on the left and `account-details` fills the right pane. On a phone the account replaces the list.

**States:**
- Loading: one tall block and three row blocks as skeletons for about 0.6 seconds on first open.
- Empty (no accounts): title "No accounts yet", text "Open one in a few minutes.", button **Open an account** (opens `open-another-account`; no button when that journey is off).
- Error on first load: title "We couldn’t load your accounts", text "Please try again.", button **Try again** (reloads with a short skeleton).
- Error after the list has loaded: a banner above the list, "Some balances may be out of date.", and the list stays.
- Timeout: after 10 seconds without an answer the error card shows. The wording is "This is taking longer than expected. Nothing was changed." (planned; the prototype has only the unavailable state).

#### 4. Sandbox errors

| Code (not shown to the customer) | Message | Shows on | Button |
|---|---|---|---|
| `SERVICE_UNAVAILABLE` | "We couldn’t load your accounts. Nothing was changed." (card title "We couldn’t load your accounts"; with a list already loaded the banner reads "Some balances may be out of date.") | Account list, or banner | Try again |
| `TIMEOUT` (planned) | "This is taking longer than expected. Nothing was changed." | Account list | Try again |
| `JOURNEY_DISABLED` | "This isn’t available at your bank." | Whole tab | none |
| `WRONG_CONTEXT` (planned) | Standard message (README 1.6) | Whole tab | Switch |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `accounts` | `bank.accounts.list` | none | map of accounts (`name`, `maskedNumber`, `iban`, `balance`, `currency`, `status`) | none | Existing (`packages/mock-bank-api/src/index.ts`) |
| `totals` | `bank.accounts.totals` | none | per-currency totals | none | Existing |
| `accountsOverview` | `bank.accounts.overview` | none | the fields above plus `availableBalance`, `holds[]`, `status` (`active`, `dormant`, `closing`, `frozen`), `type` (`current`, `savings`, `fx`), `hidden` | `SERVICE_UNAVAILABLE`, `TIMEOUT` | (planned). The prototype computes these from its own model `ACC` |
| `setHidden` | `bank.accounts.setHidden` | `{accountId, hidden}` | `{accountId, hidden}` | `LAST_VISIBLE_ACCOUNT` | (planned). Used by `account-details` |

#### 6. Permissions, step-up and limits

`accounts.view`, step-up `none`. The hide-balance choice is a display setting, not a security control. No limits.

#### 7. Result and links out

No result screen and no receipt. Notifications raised: none. Links out: `account-details {accountId}`, `open-another-account`. The account pane links on to `statement`.

#### 8. Acceptance criteria

- AC-1: The total balance is the dollar equivalent of the ledger balances of all visible accounts; hidden accounts and, with `showFx` off, foreign currency accounts are not in it.
- AC-2: Every row shows the available balance (ledger minus holds), not the ledger balance.
- AC-3: Accounts are grouped Everyday, Savings, Other currencies; an empty group is not drawn; hidden accounts are in a last group "Hidden", dimmed.
- AC-4: Hide masks every amount on the screen, the account pane and the transaction rows; Show brings them back. With `hideBalance` off there is no button.
- AC-5: A row for an account that is not active shows a status chip (Dormant, Closing, Frozen).
- AC-6: Tapping a row opens that account in `account-details`; on a wide screen the list stays beside it.
- AC-7: With no accounts the screen says "No accounts yet" and offers **Open an account**; the button is absent when `open-another-account` is off.
- AC-8: When the service is unavailable the first load shows the error card with **Try again** and nothing else changes; after the list has loaded the list stays with the "out of date" banner.
- AC-9: With `showFx` off foreign currency accounts are neither listed nor in the total.

#### 9. Scenarios

Synthetic persona Alex Morgan has four accounts: Current ••4410 (ledger $8,240.18, three card holds of $98.00, $33.38 and $6.40, so available $8,102.40), Savings ••7720 ($14,310.00), Euro ••3302 (€2,150.40) and Pound ••3301 (£1,240.55, one hold of £12.40). "Today" is Tue 3 Nov 2026. The toolbar switches **Service down** and **Timeout** simulate the two failures.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-2, AC-3 | `alex` | none | Open Accounts. Total balance reads $26,448.11 (ledger balances, converted). Groups: Everyday (Current, available $8,102.40), Savings, Other currencies (Euro, Pound). |
| T-2 | AC-4 | `alex` | none | Press Hide: every amount reads "••••••". Press Show: amounts return. With `hideBalance` off there is no button. |
| T-3 | AC-5 | `alex` | account status set to dormant in the sandbox (planned) | The row shows a "Dormant" chip. After a closure request on the account screen it shows "Closing". |
| T-4 | AC-3, AC-1 | `alex` | none | Hide the Euro account on its account screen: it moves to "Hidden", dimmed, and the total drops by its converted value. |
| T-5 | AC-6 | `alex` | none | Tap Savings: the account opens. On a wide screen the list stays on the left. |
| T-6 | AC-7 | `sam` | `empty: ["bank.accounts.overview"]` | "No accounts yet" with **Open an account**. With `open-another-account` off there is no button. |
| T-7 | AC-8 | `alex` | `unavailable: ["bank.accounts.overview"]` (prototype: Service down on) | Error card with **Try again**; after Service down is cleared, Try again loads the list. With the list loaded first and the service then down, the banner shows and the list stays. |
| T-8 | AC-8 | `alex` | `timeout: ["bank.accounts.overview"]`, `latencyMs: 10000` (planned) | After 10 seconds the error card says "This is taking longer than expected. Nothing was changed." |
| T-9 | AC-9 | `alex` | option `showFx` off | Euro and Pound are not listed and not in the total. |

#### 10. Expected mutation-check survivors

Removing the rule that leaves hidden accounts out of the total survives T-4 if the list also filters them (two layers); expected survivor. The 10-second timeout state (planned) has no sandbox layer in the prototype, so a mutation there cannot be checked yet. Everything else: none expected.

---

### ★ Account details — `account-details`

**Catalog:** slug `account-details`, workspace `personal`, category Accounts (Personal: Accounts), core no, can a bank switch it off: yes (a screen, kept in the Lean preset as a basic entry). Options (all default on, all read by the prototype): **Offer Share for account numbers** (`shareDetails`); **Allow closure requests in the app** (`closeRequest`); **Offer Report a problem on transactions** (`reportProblem`); **Allow hiding an account** (`hideAccount`). Research: `research/account-details.md`. Built in `design/bankworkx-r1/src/journeys/21-account-details.js`, on the shared account model `ACC` from `20-accounts.js`.

The lean rework removed the earlier explainer text, the limits card, the monthly summary, the extra shortcut rows and the spending analysis. What remains: balances, one hold line, account identifiers, account info, a short More list and the transaction list.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `account-details` |
| Purpose | Everything about one account in one screen: balance and available, account numbers with copy and share, searchable transactions with detail, and a short More list (rename, statement, hide, close). |
| Release / workspace | 1 / Personal |
| Status | Built in the prototype as a screen (`view: true`, tab `acc`) with sub-screens. No money moves. |
| Channels | Web (details on the left, transactions on the right; inside the Accounts split pane) and mobile (one column) |
| Starting pattern | None |
| Who may use it | Anyone signed in to Personal with `accounts.view`, for their own accounts. |

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| `accounts` › account row | `{accountId}` | `accounts.view` |
| Home › Accounts › account | `{accountId}` | `accounts.view` |
| `cards` › Recent › See all | `{accountId}` of the card’s account | `accounts.view` |
| Deep link `/personal/accounts/{accountId}` | `{accountId}` | `accounts.view` |

#### 3. Screens

Sub-screens are `main`, `tx`, `report`, `reported`, `nick`, `hide`, `close`, `closed`. Each sub-screen has a **Back** button; the main screen has **‹ Accounts**.

**Home market configuration** (the account numbers shown on `main` follow the bank’s home market; the screen never names a country):

| Market | Identifier rows shown | Format in the sandbox |
|---|---|---|
| Market A (routing number and account) | Routing number, Account number | routing number 9 digits; account number up to 12 digits |
| Market B (sort code and account) | Sort code, Account number | sort code 6 digits as 2-2-2; account number 8 digits |
| Market C (IBAN) | IBAN, BIC | IBAN in groups of 4; BIC 8 characters |
| Market D (IBAN, mobile alias) | IBAN, BIC | IBAN in groups of 4; BIC 8 characters. The mobile alias row is (planned) |

**Screen `main` (account)**

- **Balance block.** Small line "{name} ••4410"; big number: the available balance (ledger minus holds) in the account’s currency; label "Available balance". When something is on hold, two figures under it: "Balance" (ledger) and "On hold". A status chip when the account is not active ("Dormant", "Closing", "Frozen") and a "Hidden" chip when hidden.
- **Warning card (only when it applies).**
  - Dormant: title "Dormant account", text "Make a deposit or a transfer to use it again.", button **Reactivate** (toast "Account reactivated").
  - Closing: title "Closure requested", text "Reference {CLS-n}. We will close this account within 14 days.", button **Cancel the request** (toast "Request cancelled").
- **Account numbers card.** Heading "Account numbers"; one row per identifier of the home market with the value and a **Copy** button (copies the value without spaces; toast "{label} copied"). A **Share** button (only when `shareDetails` is on) opens the phone’s share sheet, or copies "BankWorkx® account details", holder, account name and currency, and the identifiers (toast "Account details copied").
- **Account info card.** Rows "Type" (product name), "Opened" (date, for example 14 Mar 2019), "Interest rate" ("0.05%" or "None").
- **More card.** Rows with a "›": **Rename** (sub-screen `nick`), **Statement** (opens `statement {accountId}`; hidden when that journey is off or not allowed), **Hide account** / **Show account** (only when `hideAccount` is on), **Close account** (only when `closeRequest` is on and no closure is pending).
- **Transactions card.** Heading "Transactions"; a search box (placeholder "Search", label "Search transactions") that matches title, category, reference and amount as the person types; a three-way switch **All / In / Out**; the list. On a phone the list is grouped under small headings "Pending", "Today", "Yesterday" and then dates ("30 Oct 2026"), each row showing an initial, the title, "category · time" (no time while pending), the signed amount (incoming amounts have a plus sign) and a "Pending" chip. On a wide screen the list is a table with columns Date, Description, Status, Amount. Ten rows show first; **Show more** adds ten. A row opens the transaction.

| Control | Type | Required | Validation | Message |
|---|---|---|---|---|
| Search | text | no | none | none |
| All / In / Out | switch | yes (default All) | none | none |

**Screen `tx` (transaction)**

Back, then a centred card with the initial, the title, the signed amount and a chip ("Pending" or "Completed"). A card with rows "Date" ("30 Oct 2026, 09:14"; no time while pending), "Status", "To" or "From" (only when there is a counterparty) and "Reference" ("TX-…"). Below: **Report a problem** (only when `reportProblem` is on and the amount is outgoing), or, after a report, "Problem reported. Case {DSP-n}." Not found: title "Transaction not found", text "Choose another from the list."

**Screen `report` (Report a problem)**

Title "Report a problem"; under it "{title} · {amount}".

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| What went wrong? | single choice | yes | for a card or cash payment: "I do not recognise it", "I was charged twice", "The amount is wrong", "Something else"; for other payments: "I sent it to the wrong person", "I did not make this transfer", "Something else" | none |
| Details | textarea, up to 300 characters | only for "Something else" | at least 10 characters | "Add a few more words." |

Button **Send** (disabled until a reason is chosen). A pending payment can only be reported as "I do not recognise it", "I did not make this transfer" or "Something else"; any other reason shows "This payment is still pending. Try again when it completes." and keeps **Send** disabled. If the bank cannot be reached: "We could not reach the bank. Nothing was sent." Success goes to `reported`.

**Screen `reported`:** green tick, title "Report sent", text "We will reply within 2 working days.", rows "Case" (DSP-…) and "Payment" ("{title} · {amount}"), button **Done** (back to the transaction).

**Screen `nick` (Rename account)**

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Account name | text, up to 24, placeholder "Holiday fund" | yes | 2 to 24 characters after trimming | "Use 2 to 24 characters." |
| | | | letters, numbers, spaces and & - ' . only | "Use letters, numbers and spaces." |
| | | | not equal (any case) to another account’s displayed name | "You already have an account with this name." |

Buttons: **Save** (disabled while invalid; toast "Name saved", back to `main`) and, when a name is set, **Use the original name** (toast "Name reset"). If the bank cannot be reached on Save, the standard connection sheet shows and the name is not saved.

**Screen `hide` (Hide this account?)**

Text "It stays open and leaves your overview and total. You can show it again from the list." If it is the only visible account: "Keep at least one account on your overview." and the button is disabled. Button **Hide account** (toast "Account hidden", back to the list). **Show account** on `main` brings it back at once (toast "Account shown again").

**Screen `close` (Close account)**

First a check. If any card payment is on hold: card "Card payments are still on hold. Try again when they complete." If the balance is below zero: "This account is overdrawn. Pay in the shortfall first." Either way one button **Back**.

Otherwise a form with the name and mask under the title:

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Reason | select: "I do not need it", "I am moving to another bank", "Fees are too high", "Something else" | yes | one chosen | none (button stays disabled) |
| Details | textarea, up to 200 (shown for "Something else") | yes then | at least 10 characters | none (button stays disabled) |
| Send {balance} to | select: the person’s other open accounts in the same currency that are not closing, and "A cheque by post" (shown only when the balance is above zero) | yes then | one chosen | none |
| Confirmation | checkbox "I understand that payments and cards linked to this account will stop." | yes | ticked | none |

Buttons: **Request closure** (disabled until all of the above are done) and **Keep account**. Request closure asks for the PIN (a PIN sheet titled "Confirm closure", text "Enter your PIN to close {name} {mask}"). On success the screen `closed` shows.

**Screen `closed`:** hourglass, title "Closure requested", text "We will close the account within 14 days.", chip "Pending", rows "Account", "Send balance to" (only with a balance; the account or "Cheque by post") and "Reference" (CLS-…), button **Done**.

**States**
- Loading: none beyond the Accounts skeleton; the balance is read from the loaded list.
- Empty (no transactions): title "No activity yet", text "Money you send, spend and receive will show here."
- Empty (search or filter matches nothing): title "No transactions found", text "Try another search.", button **Clear** (clears the search and sets All).
- Not found: title "Account not found", text "Choose another.", button **Back to accounts** (also **‹ Accounts**).
- Error: when the bank cannot be reached on Send, Save or Request closure the standard connection sheet shows and nothing is changed. Timeout: "This is taking longer than expected. Nothing was changed." (planned for the sub-screens; the prototype raises it only on journeys with a call step).

#### 4. Sandbox errors

Codes are for tests and the sandbox; the customer sees only the message.

| Code | Message | Shows on | Button |
|---|---|---|---|
| `ACCOUNT_NOT_FOUND` | "We can’t find that account. Choose another." | `main` (Account not found) | Back to accounts |
| `ACCOUNT_HAS_HOLDS` | "Card payments are still on hold. Try again when they complete." | `close` | Back |
| `ACCOUNT_OVERDRAWN` | "This account is overdrawn. Pay in the shortfall first." | `close` | Back |
| `NAME_TAKEN` | "You already have an account with this name." | `nick` | none (edit the name) |
| `PENDING_NOT_DISPUTABLE` | "This payment is still pending. Try again when it completes." | `report` | none (choose another reason) |
| `DUPLICATE_REPORT` | "Problem reported. Case {DSP-n}." (the button is replaced) | `tx` | none |
| `LAST_VISIBLE_ACCOUNT` | "Keep at least one account on your overview." | `hide` | none |
| `SERVICE_UNAVAILABLE` | Report: "We could not reach the bank. Nothing was sent." Other sub-screens: the standard connection sheet. | `report`, `nick`, `close` | Try again |
| `TIMEOUT` (planned) | "This is taking longer than expected. Nothing was changed." | the sub-screen | Try again |
| `PERMISSION_DENIED` (planned) | Standard message | Whole screen | Back |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `accounts` | `bank.accounts.list` | none | the accounts map (`name`, `maskedNumber`, `iban`, `balance`, `currency`, `status`) | none | Existing |
| `getAccount` | `bank.accounts.get` | `{accountId}` | the above plus `availableBalance`, `holds[]`, `openedOn`, `interestRate`, `productName`, identifiers for the home market | `ACCOUNT_NOT_FOUND` | (planned) |
| `listTransactions` | `bank.accounts.transactions` | `{accountId, query, direction, offset}` | `{items[], total}` with `title`, `category`, `amount`, `pending`, `reference`, `counterparty`, `channel` | `ACCOUNT_NOT_FOUND`, `SERVICE_UNAVAILABLE` | (planned) |
| `rename` | `bank.accounts.rename` | `{accountId, name}` | `{accountId, name}` | `NAME_TAKEN` | (planned) |
| `setHidden` | `bank.accounts.setHidden` | `{accountId, hidden}` | `{accountId, hidden}` | `LAST_VISIBLE_ACCOUNT` | (planned) |
| `reportProblem` | `bank.accounts.reportProblem` | `{accountId, transactionId, reason, note}` | `{caseRef}` | `PENDING_NOT_DISPUTABLE`, `DUPLICATE_REPORT` | (planned) |
| `requestClosure` | `bank.accounts.requestClosure` | `{accountId, reason, note, destination}` | `{reference}` | `ACCOUNT_HAS_HOLDS`, `ACCOUNT_OVERDRAWN` | (planned) |
| `cancelClosure` | `bank.accounts.cancelClosure` | `{accountId}` | `{accountId}` | none | (planned) |
| `reactivate` | `bank.accounts.reactivate` | `{accountId}` | `{status}` | none | (planned) |

#### 6. Permissions, step-up and limits

`accounts.view`. Step-up `none` for viewing, rename, hide, reactivate and Report a problem. **Request closure asks for the PIN** (the prototype’s PIN sheet); production uses a step-up level of 1 (see README 4.3). No amount limits. The hide choice and the rename are stored per customer in production (prototype: for the session).

#### 7. Result and links out

Results: "Report sent" (case DSP-…) and "Closure requested" (reference CLS-…), both described above. Notifications raised (planned): "We received your report, case {DSP-n}" and "Your closure request {CLS-n} was received". Links out: `statement {accountId}`, `accounts`.

#### 8. Acceptance criteria

- AC-1: The big number is the available balance; when holds exist "Balance" and "On hold" are shown and available equals balance minus holds.
- AC-2: The account numbers follow the bank’s home market (see the table); **Copy** copies the value without spaces; **Share** appears only when `shareDetails` is on.
- AC-3: Search narrows the list as the person types and matches title, category, reference and amount; All, In and Out filter by direction; a search with no result shows "No transactions found" and **Clear** resets it.
- AC-4: Pending items are grouped first with a "Pending" chip; the list shows ten rows and **Show more** adds ten.
- AC-5: A transaction shows date, status, counterparty (when known) and reference.
- AC-6: **Report a problem** is offered only on outgoing transactions and only when `reportProblem` is on; "Something else" needs 10 characters; a pending payment accepts only the reasons listed; a second report on the same payment is not offered.
- AC-7: Rename accepts 2 to 24 allowed characters, refuses a name another account already shows, and **Use the original name** removes it.
- AC-8: Hide takes the account off the overview and the total; the last visible account cannot be hidden; **Show account** restores it.
- AC-9: Closure is refused with a reason while card payments are on hold or the balance is below zero; otherwise it needs a reason, a destination when there is a balance, the ticked confirmation and the PIN.
- AC-10: After a closure request the account shows "Closing" and **Cancel the request** removes it; **Close account** is no longer offered.
- AC-11: A dormant account shows the warning card and **Reactivate** makes it active.
- AC-12: Switching off `shareDetails`, `reportProblem`, `hideAccount` or `closeRequest` removes only the matching control; switching off `statement` removes the Statement row.
- AC-13: When the bank cannot be reached on Send, Save or Request closure, nothing is changed and the person is told so.

#### 9. Scenarios

Persona `alex` as in `accounts`, "today" Tue 3 Nov 2026. The closure sheet uses the persona’s sandbox test PIN.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1 | `alex` | none | Open Current ••4410: big number $8,102.40, Balance $8,240.18, On hold $137.78. Open Savings: no Balance / On hold pair. |
| T-2 | AC-2 | `alex`, home market set to each of A to D | none | The identifier rows match the table; Copy puts the value without spaces on the clipboard. |
| T-3 | AC-3, AC-4 | `alex` | none | Type "coffee": one row. Choose Out: only outgoing rows. Type "zzz": "No transactions found"; Clear restores the list. On Current the pending rows come first, ten rows show, Show more adds ten. |
| T-4 | AC-5 | `alex` | none | Open a salary row: status Completed, From the employer, reference "TX-…". |
| T-5 | AC-6 | `alex` | none | On an outgoing card payment choose "I was charged twice", Send: "Report sent" with a case number; the transaction now says "Problem reported. Case …". On an incoming row there is no Report button. |
| T-6 | AC-6 | `alex` | none | On a pending card payment choose "The amount is wrong": "This payment is still pending…" and Send is disabled. "Something else" with 5 characters: "Add a few more words." |
| T-7 | AC-7 | `alex` | none | Rename Savings to "Holiday fund": toast "Name saved" and the Accounts list shows it. Rename Euro to "holiday fund": "You already have an account with this name." Use the original name restores the product name. |
| T-8 | AC-8 | `alex` | none | Hide Euro: it leaves the list and the total and shows under Hidden. Show account restores it. With only one visible account left, Hide account is disabled with the keep-one message. |
| T-9 | AC-9 | `alex` | none | Close Current: "Card payments are still on hold…". Close Savings: choose a reason, send the balance to Current, tick the box, Request closure, enter the PIN: "Closure requested" with reference CLS-… |
| T-10 | AC-10, AC-11 | `alex`, Savings in the Closing state; a second account set dormant (planned sandbox data) | none | Closing: warning card with the reference, Cancel the request returns it to active. Dormant: Reactivate makes it active. |
| T-11 | AC-12 | `alex` | each of the four options off in turn; `statement` off | Each removes only its own control. |
| T-12 | AC-13 | `alex` | `unavailable: ["bank.accounts.reportProblem"]` (prototype: Service down on) | Send shows "We could not reach the bank. Nothing was sent." Rename and Request closure show the connection sheet and change nothing. |
| T-13 | AC-13 | `alex` | `timeout: ["bank.accounts.requestClosure"]`, `latencyMs: 10000` (planned) | After 10 seconds: "This is taking longer than expected. Nothing was changed." The account is not Closing. |

#### 10. Expected mutation-check survivors

Removing the "only one visible account" rule in the sandbox survives if the screen also disables the button (two layers); expected. Matching the search on reference or amount survives T-3, which searches by title only; expected until a scenario searches by reference. The planned timeout states have no sandbox layer in the prototype. Everything else: none expected.

---

### ★ Account statement — `statement`

**Catalog:** slug `statement`, workspace `personal`, category Accounts (Personal: Accounts), core no, can a bank switch it off: yes (basic entry, kept in the Lean preset). Options: **Offer official stamped statements** (`allowOfficial`, default on); **Offer proof of address letters** (`allowLetter`, default on); **Offer balance certificates** (`allowBalanceCert`, default off); **Charge a fee for official statements and balance certificates** (`officialFee`, default on, $5.00); **Offer paperless statements** (`allowPaperless`, default on); **Offer OFX and QIF files** (`allowOfxQif`, default off). Research: `research/statement.md`. Built in `design/bankworkx-r1/src/journeys/22-statement.js`, which replaces the small reference journey in `10-statement.js` and uses the account model `ACC` from `20-accounts.js`.

The lean rework made the journey two steps, with a plain statement as the default and the extra document types, OFX and QIF, and paperless as bank options. Removed: the CSV switch (CSV is always offered with a plain statement), sending official documents to a third party, the delivery summary and the explainer text.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `statement` |
| Purpose | Download or email a statement for any account and period. Banks can add an official stamped statement, a proof of address letter and a balance certificate. |
| Release / workspace | 1 / Personal |
| Status | Built in the prototype as a form journey (`submit: "Get statement"`). Nothing moves money; official documents may carry a fee. |
| Channels | Web and mobile |
| Starting pattern | Form, then a code for official documents, then a result |
| Who may use it | Anyone signed in to Personal with `accounts.view`, for their own accounts. |

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| `account-details` › More › Statement | `{accountId}` | `accounts.view` |
| Home › quick action › Statements | none (the first account is chosen) | `accounts.view` |
| Command bar › Statement | none | `accounts.view` |
| Deep link `/personal/j/statement?accountId=cur` | optional `{accountId}` | `accounts.view` |

#### 3. Screens

**Screen 1 `where`: Statements**

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Account | select ("{name} ••4410") | yes | one of the person’s accounts | none |
| Type | choice list (shown only when more than one type is offered) | yes | "Statement" always; "Official statement" with the fee when `officialFee` is on; "Proof of address letter"; "Balance certificate" with the fee | none |
| Period | chips: "This month", "Last month", "Last 3 months", "Custom dates" (shown for Statement and Official statement) | yes (default Last month) | none | none |
| From | date select, half width (shown for Custom dates), up to 740 days back | yes | not before the account opened | "This account opened on {date}." |
| To | date select, half width | yes | not before From | "The end date is before the start date." |
| | | | at most 24 months for Statement | "Use 24 months or less." |
| | | | at most 12 months for Official statement | "Use 12 months or less." |

A proof of address letter for a dormant account is refused on this screen: "This account is dormant. Make a deposit first." A letter and a balance certificate have no period; they describe the account today. Button **Continue**.

**Screen 2 `format`: Format and delivery** (button **Get statement**, or **Email statement** when Email is chosen; busy text "Preparing…")

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Format | chips (shown only when more than one): PDF; for a Statement also CSV, and OFX and QIF when `allowOfxQif` is on. Letters, certificates and official statements are PDF only. | yes (default PDF) | none | none |
| Delivery | chips "Download", "Email" | yes (default Download) | none | none |
| Paperless statements | switch (Statement only, when `allowPaperless` is on; default on for the account) | no | none | none |

Information lines: "We email it to a•••@example.com." (Email); "Paper statements cost $2.00 a month." (Paperless turned off); "Fee: $5.00" (official statement or balance certificate, when `officialFee` is on). Continuing checks the period and the fee:

| Rule | Message | Where |
|---|---|---|
| The period has no transactions (Statement and Official statement) | "No transactions in this period." | banner on screen 2 |
| The available balance is below the fee | "Not enough available balance for the fee." | banner on screen 2 |

**Code (official documents only).** An official statement, a proof of address letter and a balance certificate ask for a one-time code: title "Confirm official statement" (or "Confirm proof of address letter", "Confirm balance certificate"), text "Code sent to ••• 4410". A plain statement needs no code. Wrong or missing code: standard messages (README 1.6).

**Result:** title "Statement ready" (Download) or "On its way" (Email); text "Your PDF is ready." (the chosen format) or "We emailed it. It can take a few minutes."; chip with the format. Rows: "Account", "Type", "Period", "Opening balance" and "Closing balance" (Statement and Official statement), or "Balance" (certificate), "File" (name and size, for example "statement-4410-2026-10-01-2026-10-31.pdf · 94 KB"), "Delivery" ("Download" or "Emailed to a•••@example.com"), "Fee" (when charged, in the account’s currency). Button **Download** (toast "Downloaded") or **Back to account** (toast "Sent").

**States**
- Loading: a disabled button with spinner and "Preparing…" for about 1 second on screen 2.
- Empty: not applicable; "No transactions in this period." is the empty case.
- Error and timeout: the standard connection sheet for unavailable; for a timeout "We didn’t get an answer in time. Nothing was changed." with **Try again**. No fee is taken in either case.

#### 4. Sandbox errors

Codes are for tests and the sandbox; the customer sees only the message.

| Code | Message | Shows on | Button |
|---|---|---|---|
| `PERIOD_TOO_LONG` | "Use 24 months or less." / "Use 12 months or less." | screen 1 (From, To) | none (edit the dates) |
| `RANGE_INVALID` | "The end date is before the start date." | screen 1 | none |
| `BEFORE_OPENING` | "This account opened on {date}." | screen 1 | none |
| `ACCOUNT_DORMANT` | "This account is dormant. Make a deposit first." | screen 1 | none |
| `NO_TRANSACTIONS` | "No transactions in this period." | screen 2 | Back |
| `FEE_INSUFFICIENT_FUNDS` | "Not enough available balance for the fee." | screen 2 | Back |
| `OTP_INVALID`, `OTP_REQUIRED` | Standard messages (README 1.6) | code sheet | Try again |
| `SERVICE_UNAVAILABLE` | Standard connection sheet; "Nothing was changed." | screen 2 or code | Try again |
| `TIMEOUT` | "We didn’t get an answer in time. Nothing was changed." | screen 2 | Try again |
| `JOURNEY_DISABLED` | "This isn’t available at your bank." | whole journey | none |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `accounts` | `bank.accounts.list` | none | the accounts map | none | Existing |
| `prepareStatement` | `bank.statements.prepare` | `{accountId, kind, from, to, format, delivery}` | `{file, sizeKb, openingBalance, closingBalance, fee}` | `NO_TRANSACTIONS`, `FEE_INSUFFICIENT_FUNDS`, `ACCOUNT_DORMANT`, `PERIOD_TOO_LONG`, `BEFORE_OPENING` | (planned) |
| `sendOtp` / `verifyOtp` | `bank.otp.send` / `bank.otp.verify` | `{channel}` / `{code}` | `{sent}` / `{verified}` | `OTP_INVALID` | Existing (`packages/mock-bank-api/src/index.ts`) |
| `deliverStatement` | `bank.statements.deliver` | `{statementId, delivery}` | `{reference}` | `SERVICE_UNAVAILABLE`, `TIMEOUT` | (planned) |
| `setPaperless` | `bank.statements.setPaperless` | `{accountId, paperless}` | `{accountId, paperless}` | none | (planned) |

The fee is taken from the account in the account’s currency at the converted amount (the fee is $5.00; an account in another currency pays the converted value). It is taken only when the document is issued, after the code.

#### 6. Permissions, step-up and limits

`accounts.view`. Step-up: `none` for a plain statement; **one-time code** for an official statement, a proof of address letter and a balance certificate (the prototype switches the code on from the chosen type). Limits: period up to 24 months (Statement) or 12 months (Official statement); no amount limit. The fee is a bank setting, not a customer limit.

#### 7. Result and links out

Result screen as above. Receipt contents: the rows listed. Notifications raised (planned): "Your statement was emailed" for Email delivery; "A fee of {amount} was charged for your {document}" when a fee is taken. Links out: `account-details {accountId}` (Back to account), `accounts`.

#### 8. Acceptance criteria

- AC-1: A Statement for a chosen account and one of the four period choices shows the right opening and closing balance and file name, as PDF by default.
- AC-2: Custom dates refuse an end before the start, a start before the account opened, and a period over 24 months (12 for an official statement).
- AC-3: A Statement can be delivered as PDF or CSV (and OFX or QIF when `allowOfxQif` is on); letters, certificates and official statements are PDF only.
- AC-4: Choosing Email shows the masked address, the button reads **Email statement**, and the result says it was emailed.
- AC-5: A period with no transactions is refused with "No transactions in this period." and no document or fee is produced.
- AC-6: An official statement or a balance certificate shows the fee on screen 2 when `officialFee` is on, asks for a code, and takes the fee only after the code; with too little available balance it is refused before the code.
- AC-7: A proof of address letter and a balance certificate have no period; a letter for a dormant account is refused.
- AC-8: The Type list shows only the types the bank has switched on; with only the plain statement on, the Type field is not drawn.
- AC-9: With `allowPaperless` on, the toggle appears for a Statement; turning it off shows the paper fee line, and the choice is remembered for that account.
- AC-10: A wrong code does not issue the document and takes no fee; three wrong codes end the attempt.
- AC-11: When the bank is unavailable or times out nothing is issued and no fee is taken.

#### 9. Scenarios

Persona `alex`, Current ••4410 with ledger $8,240.18 and available $8,102.40, "today" Tue 3 Nov 2026. The sandbox code for the persona is the fixed test code.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-3 | `alex` | none | Account Current, Type Statement (or the Type field is hidden when only that type is on), Period Last month, Format PDF, Download. Result "Statement ready" with period, opening and closing balances and the file name. |
| T-2 | AC-3 | `alex` | `allowOfxQif` on | Format shows PDF, CSV, OFX, QIF for a Statement; choosing Official statement shows PDF only. |
| T-3 | AC-4 | `alex` | none | Delivery Email: line "We email it to a•••@example.com.", button **Email statement**, result "On its way". |
| T-4 | AC-2 | `alex` | none | Custom dates with a start before the account opened: "This account opened on 14 Mar 2019." End before start: "The end date is before the start date." A 25-month span: "Use 24 months or less." Official statement over 12 months: "Use 12 months or less." |
| T-5 | AC-5 | `alex`, Savings, Period This month (no activity in the last 3 days) | none | Continue on screen 2: "No transactions in this period." |
| T-6 | AC-6 | `alex` | none | Official statement: fee line "Fee: $5.00"; code step "Confirm official statement"; result shows Fee $5.00 and the balance falls by $5.00. |
| T-7 | AC-6 | `alex`, available balance set below the fee | none | "Not enough available balance for the fee." before any code is asked. |
| T-8 | AC-7, AC-8 | `alex`, `allowBalanceCert` on; one account dormant (planned sandbox data) | none | Balance certificate and Proof of address letter hide the Period field. A letter for the dormant account: "This account is dormant. Make a deposit first." With all optional types off, the Type field is not drawn. |
| T-9 | AC-9 | `alex` | none | Turn Paperless off: "Paper statements cost $2.00 a month." Reopen the journey on the same account: the toggle is still off. |
| T-10 | AC-10 | `alex` | none | Official statement with a wrong code: not issued, no fee; after three wrong codes the attempt ends. |
| T-11 | AC-11 | `alex` | `unavailable: ["bank.statements.prepare"]` (prototype: Service down on) | Connection sheet; no document, no fee. |
| T-12 | AC-11 | `alex` | `timeout: ["bank.statements.prepare"]`, `latencyMs: 10000` | After 10 seconds: "We didn’t get an answer in time. Nothing was changed." No fee. |

#### 10. Expected mutation-check survivors

The 24 and 12 month limits survive a mutation if the date picker itself stops at 740 days (another layer); expected. The paperless remembered choice has no money effect and is not covered by the sandbox, so removing it survives; expected until a scenario reopens the journey. The rule that the fee is converted for non-dollar accounts survives because the scenarios use a dollar account; expected. Everything else: none expected.

---

### ★ Rename an account — `account-nickname`

**Catalog:** slug `account-nickname`, workspace `personal`, category Accounts (Personal: Accounts), core no, can a bank switch it off: yes (only together with `account-details`). Options: none of its own.

**Alias of `account-details`:** reached from the **Rename** row in the More card of the account screen (sub-screen `nick`), launch parameter `{accountId}`. There is no separate catalog entry in the prototype; switching `account-details` off removes rename. What it does:

- Rename is a sub-screen with a **Back** button, not a separate journey with a result screen. Success is a toast "Name saved" and a return to the account screen.
- Field "Account name" (up to 24 characters, placeholder "Holiday fund"), checked as the person types: "Use 2 to 24 characters.", "Use letters, numbers and spaces." (letters, digits, spaces and & - ' . are allowed) and "You already have an account with this name." (a name equal in any case to another account’s displayed name is refused). The name is trimmed.
- Buttons **Save** (disabled while invalid) and, when a name is set, **Use the original name** (toast "Name reset").
- If the bank cannot be reached on Save, the standard connection sheet shows and the name is not saved.
- Adapter `bank.accounts.rename` (planned). Acceptance criterion AC-7 and scenario T-7 of `account-details` cover it.

---

### ★ Open another account — `open-another-account`

**Catalog:** slug `open-another-account`, workspace `personal`, category Accounts (Personal: Accounts), core no, can a bank switch it off: yes (a basic entry, kept in the Lean preset). Options: **Offer the savings account** (`offerSavings`, default on); **Offer currency accounts** (`offerCurrency`, default on). Research: `research/open-another-account.md`. Built in `design/bankworkx-r1/src/journeys/60-account-extras.js`.

There is no purpose-of-account question, opening deposit or "fund from" account. The new account always opens empty. Not to be confused with `open-account` (Public, for new customers).

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `open-another-account` |
| Purpose | An existing customer opens a current, savings or currency account in a few steps, with no paperwork (identity checks are already done). |
| Release / workspace | 1 / Personal |
| Status | Built in the prototype as a form journey (`submit: "Open account"`, `basic: true`, `confirm` with a code). |
| Channels | Web and mobile |
| Starting pattern | Choose, name, review with terms, a code, a result |
| Who may use it | `accounts.manage` |

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Accounts › Open another account | none | `accounts.manage` |
| Accounts › empty state › Open an account | none | `accounts.manage` |
| Home › Offer › Apply | `{product}` (`current`, `savings` or `currency`; an unknown value is ignored) | `accounts.manage` |

#### 3. Screens

**Screen 1 `product`: Choose an account.** Choice cards, one per product the bank offers: "Current account" ("For everyday spending, with a debit card"), "Savings account" ("Earn interest on money you set aside"; hidden when `offerSavings` is off) and "Currency account" ("Hold and spend in another currency"; hidden when `offerCurrency` is off). Current is always offered. If the customer already holds 6 accounts a red notice shows "You already have 6 accounts, the most you can hold. Close one to open another." and **Continue** is blocked with "You already have 6 accounts, the most you can hold."

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Account | choice cards | yes | one of the offered products | "Choose an account." |

**Screen 2 `currency`: Which currency?** (only for a currency account). Chips "Euro (EUR)", "Pound (GBP)", "Dirham (AED)".

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Currency | chips | yes | one of the three | "Choose a currency." |

**Screen 3 `name`: Name your account.** Intro "You can change it later."

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Account name | text, up to 24 characters, sample "Holiday fund" | yes | 2 to 24 characters after trimming | "Use 2 to 24 characters." |
| | | | letters, digits, spaces and . _ ' & - | "Use letters, numbers and spaces only." |
| | | | not equal (any case) to the name of an account the customer has | "You already have an account with that name." |

**Screen 4 `review`: Review.** Button **Continue**. A list: Account (product name, for a currency account "Euro account", "Pound account" or "Dirham account"), Name, and Currency (currency accounts only). A second list titled **Key facts**:

| Product | Interest rate | Monthly fee | Minimum balance |
|---|---|---|---|
| Current account | None | None | None |
| Savings account | 3.10% a year, variable | None | $1.00 |
| Currency account | None | None | None |

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| I agree to the account terms. | checkbox | yes | ticked | "Please agree to continue." |

**Screen 5 `confirm`: Open {name}.** The standard code sheet: "Code sent to ••• 0142." (6 digits). Wrong code: "That code isn’t right. Try again." The button is **Open account**.

**Result** (green). Title "Account opened", text "It’s ready to use.", status chip "Active". Rows: Account (the name), Type, Currency (the chosen currency or USD), Account number (••{last4}), Opened ("3 Nov 2026"). Button **Go to accounts** (Accounts tab). The new account appears in the account list at once with a zero balance.

**States**
- Loading: the button shows a spinner while the code is checked.
- Empty: not applicable.
- Error: unavailable shows "This isn’t available right now. Nothing was changed. Try again in a few minutes."; timeout shows "This is taking longer than expected. Nothing was changed." Both with **Try again**.
- Stale: if the customer reaches 6 accounts or takes the name in the meantime, the commit fails with the message of that code and the person goes back.

**Home market configuration:** none. The product list, the key facts and the account number length are the same in every market. (The account number is a bank-internal number, not a routing or IBAN value.)

#### 4. Sandbox errors

Codes are for tests and the sandbox; the customer sees only the message.

| Code | Message | Shows on | Button |
|---|---|---|---|
| `ACCOUNT_LIMIT` | "You already have 6 accounts, the most you can hold." | product, commit | Back |
| `NAME_TAKEN` | "You already have an account with that name." | name, commit | Change name |
| `PRODUCT_UNAVAILABLE` | "This account isn’t available right now." | product | Choose another |
| `OTP_INVALID` | "That code isn’t right. Try again." | code | Try again |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | the step | Try again |
| `SERVICE_UNAVAILABLE` | "This isn’t available right now. Nothing was changed. Try again in a few minutes." | the step | Try again |
| `JOURNEY_DISABLED` | "This isn’t available at your bank." | whole journey | none |
| `PERMISSION_DENIED` (planned) | Standard message | whole journey | Back |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `accounts` | `bank.accounts.list` | none | map of accounts | none | Existing (`packages/mock-bank-api/src/index.ts`) |
| `products` | `bank.products.list` | none | the offered products with key facts | none | (planned). The prototype holds the table above |
| `openAccount` | `bank.accounts.open` | `{product, currency?, name}` | `{accountId, accountNumber, openedOn}` | `ACCOUNT_LIMIT`, `NAME_TAKEN`, `PRODUCT_UNAVAILABLE` | (planned). The prototype adds the account to its own data |
| `sendOtp` / `verifyOtp` | `bank.otp.send` / `bank.otp.verify` | `{channel}` / `{code}` | `{sent}` / `{verified}` | `OTP_INVALID` | Existing |

#### 6. Permissions, step-up and limits

`accounts.manage`. Step-up: one-time code (6 digits, 3 tries) before the account is opened. Limit: at most 6 accounts. A name is unique per customer, ignoring case.

#### 7. Result and links out

Result as above. Notifications raised (planned): "Your new account {name} is open". The account is written to the account audit log. Links out: Accounts (the list), `account-details` for the new account.

#### 8. Acceptance criteria

- AC-1: A current account can always be chosen; the savings and currency accounts appear only when their options are on.
- AC-2: A currency account asks for a currency; the other products skip that step.
- AC-3: The name must be 2 to 24 allowed characters and not already used, with the messages above.
- AC-4: Review shows the account, the name and the key facts for the chosen product, and cannot continue until the terms are ticked.
- AC-5: A wrong code opens nothing; the right code opens the account with a zero balance and shows "Account opened".
- AC-6: With 6 accounts the person cannot continue and sees the limit message.
- AC-7: The new account shows in the account list and keeps its name and currency.
- AC-8: When the bank is unavailable or times out nothing is opened.

#### 9. Scenarios

Synthetic persona `alex` with three accounts (Current ••4410, Savings ••7720, Euro account ••3302). The sandbox code is the fixed test code.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-4, AC-5, AC-7 | `alex` | none | Choose Savings account, name "Holiday fund", agree, code; result "Account opened", rows as above; the list has four accounts. |
| T-2 | AC-1 | `alex`, `offerSavings` and `offerCurrency` off | none | Only "Current account" is offered. |
| T-3 | AC-2 | `alex` | none | Currency account shows "Which currency?"; no choice: "Choose a currency."; Pound gives "Pound account". |
| T-4 | AC-3 | `alex` | none | "A": "Use 2 to 24 characters." "Holiday #1": "Use letters, numbers and spaces only." "savings": "You already have an account with that name." |
| T-5 | AC-4 | `alex` | none | On review, Continue without the tick: "Please agree to continue." Savings shows "3.10% a year, variable" and minimum "$1.00". |
| T-6 | AC-5 | `alex` | none | Wrong code: "That code isn’t right. Try again." and no account is added. |
| T-7 | AC-6 | `alex` with six accounts | none | The red notice shows and Continue is blocked. |
| T-8 | AC-8 | `alex` | `unavailable: ["bank.accounts.open"]` (prototype: Service down on) | The connection sheet shows; no account is added. |
| T-9 | AC-8 | `alex` | `timeout: ["bank.accounts.open"]`, `latencyMs: 10000` | After 10 seconds "This is taking longer than expected. Nothing was changed." No account is added. |

#### 10. Expected mutation-check survivors

The name-taken rule survives if the sandbox also checks it at commit; expected. The 6-account limit survives if the product step is mutated but the commit still refuses; expected. The audit log entry is not asserted; expected. Everything else: none expected.

---

### ★ Create a budget — `create-budget`

**Catalog:** slug `create-budget`, workspace `personal`, category Accounts (Personal: Accounts), core no, can a bank switch it off: yes (a basic entry, kept in the Lean preset). Options: **Offer the 80% alert** (`alertAt80`, default on); **Offer the 100% alert** (`alertAt100`, default on). Research: `research/create-budget.md`. Built in `design/bankworkx-r1/src/journeys/60-account-extras.js`, together with the view `budgets`.

One journey creates, edits and deletes a budget. A budget moves no money and blocks nothing, so it never asks for a code. There is no calendar month, rollover or shared budget; spending is counted over the last 30 days.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `create-budget` |
| Purpose | Set a monthly amount for a spending category and get alerts at 80% and 100%. Edit or delete it later. |
| Release / workspace | 1 / Personal |
| Status | Built in the prototype as a form journey (`submit: "Create budget"`, `basic: true`). Test parameter `{category: "Health"}`. |
| Channels | Web and mobile |
| Starting pattern | Category, amount, alerts, result (delete: one confirm screen) |
| Who may use it | `accounts.manage` |

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Accounts › Budgets › New budget, or the empty state button "Create a budget" | none | `accounts.manage` |
| Accounts › Budgets › a card › Edit | `{budgetId}` | `accounts.manage` |
| Accounts › Budgets › a card › Delete | `{budgetId, mode: "delete"}` | `accounts.manage` |
| Transaction › Create a budget for {category} | `{category}` (skips the category step when that category has no budget yet) | `accounts.manage` |

An unknown `budgetId` is treated as a new budget. A `category` that already has a budget is ignored and the category step shows.

#### 3. Screens

**Screen 1 `cat`: Choose a category** (new budgets only, skipped when `category` is passed). Choice cards for Food, Shopping, Transport, Health, Travel, Bills, Entertainment and Subscriptions. A category that already has a budget shows "Budget set" and cannot be chosen.

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Category | choice cards | yes | one without a budget | "Choose a category." |

**Screen 2 `amt`: Monthly amount** (not for delete). A card shows the category and "Spent in the last 30 days: $x".

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Amount per month | amount in dollars, placeholder "0.00" | yes | at least $10 | "The smallest budget is $10.00." |
| | | | at most $100,000 | "The most is $100,000.00." |

**Screen 3 `alerts`: Alerts** (not for delete). Button **Create budget**, or **Save budget** when editing.

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Alert me at 80% | switch, "When you’ve used most of it" (shown when `alertAt80` is on; default on) | no | none | none |
| Alert me at 100% | switch, "When you reach the limit" (shown when `alertAt100` is on; default on) | no | none | none |

**Screen 4 `del`: Delete this budget?** (delete mode only). Rows Category and Amount per month. Button **Delete budget**.

**Result** (green). New: title "Budget created", text "{category}: $x a month."; edit: "Budget saved"; delete: "Budget deleted", text "{category} is no longer tracked." Rows (create and edit): Category, Amount per month, Alert at 80% (On or Off), Alert at 100% (On or Off). Button **See budgets** (the `budgets` view).

**States**
- Loading: the button shows a spinner while saving.
- Empty: not applicable.
- Error: unavailable shows "This isn’t available right now. Nothing was changed. Try again in a few minutes."; timeout shows "This is taking longer than expected. Nothing was changed." Both with **Try again**.
- Stale: a budget deleted elsewhere: "We can’t find that budget."

**Home market configuration:** none. Amounts are in the home currency, shown here as dollars.

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `BUDGET_EXISTS` | "You already have a budget for this category." | category, commit | Choose category |
| `BUDGET_NOT_FOUND` | "We can’t find that budget." | edit, delete | See budgets |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | the step | Try again |
| `SERVICE_UNAVAILABLE` | "This isn’t available right now. Nothing was changed. Try again in a few minutes." | the step | Try again |
| `JOURNEY_DISABLED` | "This isn’t available at your bank." | whole journey | none |
| `PERMISSION_DENIED` (planned) | Standard message | whole journey | Back |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `budgets` | `bank.budgets.list` | none | map of budgets | none | Existing (`packages/mock-bank-api/src/index.ts`) |
| `createBudget` | `bank.budgets.create` | `{category, limit}` | `{budgetId, name, limit}` | `INVALID_AMOUNT`, `CATEGORY_REQUIRED`, `BUDGET_EXISTS` | Existing (limit from 10 to 100,000) |
| `updateBudget` | `bank.budgets.update` | `{budgetId, limit, alert80, alert100}` | `{budgetId}` | `BUDGET_NOT_FOUND` | (planned). The prototype keeps budgets on its own data |
| `deleteBudget` | `bank.budgets.delete` | `{budgetId}` | `{budgetId}` | `BUDGET_NOT_FOUND` | (planned) |
| `spending` | `bank.spending.byCategory` | `{days: 30}` | amounts per category | none | (planned). The prototype adds current account activity and journey payments |

#### 6. Permissions, step-up and limits

`accounts.manage` to change, `accounts.view` to see the list. Step-up: none, no money moves. Limits: one budget per category, $10.00 to $100,000.00 a month.

#### 7. Result and links out

Result as above. Notifications raised (planned): "You have used 80% of your {category} budget" and "You have reached your {category} budget", only for the alerts that are on. Links out: `budgets`.

#### 8. Acceptance criteria

- AC-1: A budget needs a category without a budget and an amount from $10.00 to $100,000.00, with the messages above.
- AC-2: With `category` passed (and free) the category step is skipped.
- AC-3: The alert switches appear only for the options that are on, both on by default.
- AC-4: Creating saves one budget and shows "Budget created"; a second budget for the same category is refused.
- AC-5: Edit changes the amount and the alerts and shows "Budget saved"; the category cannot be changed.
- AC-6: Delete asks once, removes the budget and shows "Budget deleted"; the category can be budgeted again.
- AC-7: No code is asked at any point.
- AC-8: When the bank is unavailable or times out nothing is changed.

#### 9. Scenarios

Synthetic persona `alex` with three budgets: Food $300, Subscriptions $40, Entertainment $25.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-2, AC-4 | `alex`, `category: "Health"` | none | The category step is skipped; amount 5: "The smallest budget is $10.00."; 150 creates "Budget created", "Health: $150.00 a month." |
| T-2 | AC-1 | `alex` | none | In the category step Food is marked "Budget set" and cannot be chosen. Amount 200000: "The most is $100,000.00." |
| T-3 | AC-3 | `alex`, `alertAt100` off | none | Only "Alert me at 80%" is shown. |
| T-4 | AC-5 | `alex`, `budgetId` of Food | none | Amount prefilled 300; change to 350; button **Save budget**; result "Budget saved". |
| T-5 | AC-6 | `alex`, Food with `mode: "delete"` | none | Rows Category and Amount; **Delete budget**; "Budget deleted"; Food can be chosen again. |
| T-6 | AC-4 | `alex`, create Food through a stale form | none | `BUDGET_EXISTS`: "You already have a budget for this category." |
| T-7 | AC-7 | `alex` | none | No code screen appears in create, edit or delete. |
| T-8 | AC-8 | `alex` | `unavailable: ["bank.budgets.create"]` (prototype: Service down on) | The connection sheet shows; no budget is added. |
| T-9 | AC-8 | `alex` | `timeout: ["bank.budgets.create"]`, `latencyMs: 10000` | After 10 seconds "This is taking longer than expected. Nothing was changed." No budget is added. |

#### 10. Expected mutation-check survivors

The amount ceiling survives if the adapter also enforces it; expected. "Category already has a budget" survives if the category card is disabled and the commit also refuses; expected. Notifications are not asserted; expected. Everything else: none expected.

---

### ★ Budgets — `budgets`

**Catalog:** slug `budgets`, workspace `personal`, category Accounts (Personal: Accounts), core no, can a bank switch it off: yes (a view in the Accounts tab). Options: none of its own. Research: `research/create-budget.md`. Built in `design/bankworkx-r1/src/journeys/60-account-extras.js` (a view: `view: true`, `tab: "acc"`).

This is a **view** (a screen in a tab), not a flow. It lists the budgets and sends the person to `create-budget` for every change.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `budgets` |
| Purpose | Show every monthly budget with progress and a way to add, edit or delete one. |
| Release / workspace | 1 / Personal |
| Status | Built in the prototype as a view (`perm: "accounts.view"`). |
| Channels | Web and mobile |
| Route | Accounts tab › Budgets (web and mobile) |
| Data source | The budget list and the last 30 days of spending per category |

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Accounts › Budgets | none | `accounts.view` |
| `create-budget` result › See budgets | none | `accounts.view` |

#### 3. The screen

Title "Budgets". One card per budget, in the order created:

| Part | Content |
|---|---|
| Name | The category, in bold |
| Detail | "$spent of $amount · last 30 days" |
| Status chip | "On track" (green) below 80%; "Close to limit" (amber) from 80% to below 100%; "Over budget" (red) from 100% |
| Progress bar | Width is the share used, capped at 100%; colour follows the chip; named "{category} budget" for screen readers |
| Buttons | **Edit** (`create-budget` with `{budgetId}`) and **Delete** (`create-budget` with `{budgetId, mode: "delete"}`) |

Under the cards a **New budget** button (`create-budget`), shown while at least one budget exists and fewer than 8 categories are budgeted.

Spending counted: money out of the current account in the last 30 days in that category, plus payments made through journeys. A budget with no spending shows an empty bar and "On track". There is no filter or sort; the order is the order created.

**States**
- Loading (planned): a skeleton card per budget.
- Empty: "No budgets yet" with "Set a monthly amount for a category and we’ll tell you as you get close." and the button **Create a budget**.
- Error (the prototype’s Service down switch): "We couldn’t load your budgets" with "Nothing was changed. Try again in a moment."
- Drill-downs: Edit, Delete and New budget open `create-budget`; the result of that journey returns here.

**Home market configuration:** none.

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `SERVICE_UNAVAILABLE` | "We couldn’t load your budgets. Nothing was changed." | the view | Try again |
| `TIMEOUT` (planned) | "This is taking longer than expected. Nothing was changed." | the view | Try again |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `budgets` | `bank.budgets.list` | none | map of budgets | none | Existing (`packages/mock-bank-api/src/index.ts`) |
| `spending` | `bank.spending.byCategory` | `{days: 30}` | amounts per category | none | (planned) |

#### 6. Permissions, step-up and limits

`accounts.view` to see the view; Edit, Delete and New budget need `accounts.manage` (see `create-budget`). No step-up.

#### 7. Result and links out

No result screen. Links out: `create-budget`.

#### 8. Acceptance criteria

- AC-1: Each budget shows the category, spent of amount for the last 30 days, a bar and a chip.
- AC-2: The chip is "On track" below 80%, "Close to limit" from 80% and "Over budget" from 100%, and the bar never shows more than 100%.
- AC-3: With no budgets the empty state shows with one button **Create a budget**.
- AC-4: Edit and Delete open `create-budget` for that budget; New budget opens it for a new one.
- AC-5: **New budget** is hidden when all 8 categories have a budget.
- AC-6: When the bank is unavailable the error state shows and nothing is changed.

#### 9. Scenarios

Synthetic persona `alex` with budgets Food $300, Subscriptions $40, Entertainment $25.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-2 | `alex` | none | Three cards; the chips follow the spending (Close to limit once spent reaches 80% of the amount, for example $32.00 of $40.00). |
| T-2 | AC-2 | `alex`, Food $300 with $320 spent | none | Chip "Over budget", bar full and red. |
| T-3 | AC-3 | `alex`, all budgets deleted | none | "No budgets yet" and **Create a budget**. |
| T-4 | AC-4 | `alex` | none | Edit opens the amount step with the current value; Delete opens "Delete this budget?". |
| T-5 | AC-5 | `alex`, budgets in all 8 categories | none | No **New budget** button. |
| T-6 | AC-6 | `alex` | `unavailable: ["bank.budgets.list"]` (prototype: Service down on) | "We couldn’t load your budgets". |
| T-7 | AC-6 | `alex` | `timeout: ["bank.budgets.list"]`, `latencyMs: 10000` | After 10 seconds "This is taking longer than expected. Nothing was changed." with **Try again**. |

#### 10. Expected mutation-check survivors

The chip thresholds survive when the amounts in the scenarios sit well away from 80% and 100%; add edge amounts to kill them. The bar cap at 100% survives if only the chip is asserted; expected. Everything else: none expected.

---

## Personal: Payments

### Rules and building blocks shared by every journey in this group

These are defined once here and named in the journeys. Each journey still lists its own errors, adapters, criteria and scenarios in full.

**A. The new-beneficiary cooling-off rule (decided).** Money sent to a person or company the customer added recently is the classic route for scams, so a new beneficiary has a short, low allowance.

| Part | Rule |
|---|---|
| Who is "new" | A beneficiary whose `ageHours` is under 24. `ageHours` is `floor((now − addedAt) / 3,600,000)`, and `bank.beneficiaries.list` already returns it with every beneficiary. |
| The allowance | In any 24 hours the person may send **at most 500.00 USD (or the same value in the account's currency at the mid rate) in total** to a new beneficiary. The payment being made counts. |
| What it covers | `internal-transfer`, `personal-transfer`, `international-transfer`, and the first run of a payment made in `schedule-payment`. It does **not** cover `own-transfer`, `pay-bill` or `mobile-topup` (no beneficiary is involved). |
| What restarts the clock | Adding a beneficiary sets `addedAt`. Editing the bank details in `manage-beneficiary` (IBAN, account number, SWIFT, bank, country, currency) sets a new `addedAt`. Changing the name or nickname alone does not. |
| Where it is enforced | The sandbox, on the beneficiary id: planned error `BENEFICIARY_COOLING_OFF`. The UI checks `ageHours` on the amount screen so the person is told before the review. A scheduled payment's first date must be at least 24 hours after `addedAt`; each run re-checks the allowance. |
| Message | "{name} was added {hours} hours ago. For your security you can send up to $500.00 to a new beneficiary in the first 24 hours. You can send up to ${left} more now, or the full amount after {date} {time} UTC." (when nothing is left: "You can send more after {date} {time} UTC.") |
| Button | **Change amount** (when some allowance remains) or **Choose another beneficiary**. |
| Shown elsewhere | A chip "New · {n} hours left" on the beneficiary row and in the picker. |
| Sandbox support needed (planned) | `Beneficiary` gets `kind`, `country`, `currency`, `iban`, `swift`, `nickname`; `bank.beneficiaries.list` gets `coolingOffUntil` and `allowanceLeft`; the sandbox remembers what was sent to each beneficiary in the last 24 hours. |

**B. The sandbox cast for Payments (planned seed for `alex`).** Today `alex` has **no beneficiaries**. The seed adds:

| Id | Name | Kind | Detail | Added |
|---|---|---|---|---|
| `ben_taylor` | Taylor Brooks | BankWorkx customer (`internal`) | account ••3308, USD | 90 days ago |
| `ben_jamie` | Jamie Lee | Another bank (`domestic`) | Northwind Bank ••6620, USD | 40 days ago |
| `ben_marco` | Marco Rossi | Abroad (`international`) | Germany, EUR, IBAN `DE89 3704 0044 0532 0130 00`, SWIFT `NRWDDEFFXXX` | 60 days ago |
| `ben_casey` | Casey Nguyen | Another bank (`domestic`) | Harbor Trust ••5150, USD | **3 hours ago** (cooling-off demo) |

Accounts: Main ••4410 available 8,720.76 USD, Savings ••7731 15,254.37 USD, EUR Travel ••5502 (planned) EUR 2,400.00, AED Home ••8816 (planned) AED 11,000.00. Daily limit 50,000 USD (existing); planned `limitsByCurrency` EUR 20,000 and AED 100,000.

**C. Shared screens.** Every money-moving journey ends with these. Journeys name them and give only the button label.

| Screen | Spec |
|---|---|
| `otp` ("Enter your code") | `otp` block, 6 digits, 3 attempts, resend after 30 s (the fixtures use 60 s; they move to 30 s), keypad on phones. Body "We sent a 6-digit code to {maskedPhone}." A countdown "Resend code in {n}s" turns into a **Resend code** link. The journey's confirm button names the action ("Send $120.00"). The integration that verifies the code must be named exactly `otpVerify` so the engine counts failures. A wrong code: "That code isn't right. {n} tries left." (`OTP_INVALID`, the sandbox sends `attempt`). `lockAfter: 3, lockTo: "locked"`. |
| `locked` | Error result "Too many wrong codes". Text "You entered the wrong code 3 times, so we stopped. No money has left your account." Buttons **Start again** (clears consent and code, goes to the first screen) and **Close** (exit). |
| `timeout` | Result tone warning. For money-moving: title "We didn't get an answer in time"; text "We didn't get an answer in time. Check Activity before you try again, so you don't pay twice." Buttons **Check Activity** (Payments › tracker) and **Close**. In the sandbox the request is not applied. |
| `unavailable` | Result tone error. Title "Service not available"; text "This service is not available right now. Nothing was changed. Please try again in a few minutes." Buttons **Try again** (to the review screen) and **Back** (exit). |
| `failed` | Result tone error. Title and text depend on the code (each journey's table). Button **Try again** or **Change amount** as stated. Always says what happened to the money. |
| Review + consent | `reviewSummary`, then a `consent` block (`mustBeTrue`; message "Tick the confirmation first"), then **Confirm and send code** (validate, `otpSend`, go to `otp`). |

**D. Reference formats (existing).** Transfers `TRX-20261102-0931`, bills `BILL-…`, top-ups `TOP-…`, conversions `FX-…` (number is 930 plus a counter).

**E. Existing rules to keep in mind.** `bank.transfers.create`, `bank.bills.pay` and `bank.topup.create` need the one-time code first (`OTP_REQUIRED`), refuse everything when the persona's `transferFails` flag is set (`CORE_UNAVAILABLE`), check the balance (`INSUFFICIENT_FUNDS`) and the daily limit of the account's currency (`LIMIT_EXCEEDED`). Today none of them rejects a zero, negative or over-precise amount (`INVALID_AMOUNT` is only checked by the top-up and FX quote adapters); the upgrades below add that check to all (planned).

---

### Shell: Payments hub

| Item | Spec |
|---|---|
| Purpose | The single front door to every way of moving money. |
| Route | Web `/personal/payments`; mobile tab **Payments**. |
| Data source | Existing `bank.beneficiaries.list`, `bank.limits.get`, `bank.accounts.list`. Planned `bank.payments.list` (recent), `bank.schedules.list`. |
| Widgets | 1. **Send money** grid of six tiles. 2. **Recent payees** (up to 5 avatars with name, from beneficiaries sorted by last used). 3. **Limit bar**: "Daily limit $50,000.00 · used $0.00" (`bank.limits.get`). 4. **Coming up**: next 3 scheduled payments. 5. **Recent payments**: last 3 from the tracker. |
| Tiles | **Between my accounts** (`own-transfer`), **To a BankWorkx customer** (`internal-transfer`), **To another bank** (`personal-transfer`), **Abroad** (`international-transfer`), **Bills** (`pay-bill`), **Top-up** (`mobile-topup`). Each needs `payments.create` and is hidden without it. |
| Empty | No payees: "You haven't saved anyone yet." with **Add a beneficiary** (`manage-beneficiary`, mode add). No payments: "No payments yet. When you send money it will show here." |
| Loading / error | Skeleton tiles; "We couldn't load your payments. Nothing was changed." with **Try again**. |
| Drill-downs | A tile opens its journey. A payee avatar opens `personal-transfer {beneficiaryId}` (or `internal-transfer` / `international-transfer` by the payee's kind). **See all** goes to the tracker or the scheduled list. |
| Launch points | Section 5.2, Payments › hub rows. |

### Shell: Beneficiaries

| Item | Spec |
|---|---|
| Purpose | The saved people and companies the customer pays. |
| Route | Web `/personal/payments/beneficiaries`; mobile screen `Beneficiaries`. |
| Data source | Existing `bank.beneficiaries.list` (`id`, `displayName`, `bank`, `maskedNumber`, `addedAt`, `ageHours`). Planned fields in rule B above. |
| Table (`dataTable`, planned) | Avatar and **Name** (nickname first, real name under it), **Type** chip (BankWorkx, Other bank, Abroad), **Bank** and mask, **Country/Currency** (abroad only), **Added** (`12 Nov 2026`), **Status** (a "New · 21 hours left" chip while `ageHours` is under 24). Row menu: Send money, Edit, Delete. |
| Filters / search | Type chips: All, BankWorkx, Other bank, Abroad. Search by name, bank or last 4 digits. |
| Sort | Name A to Z (default); Recently added; Recently paid. |
| Empty | "You haven't saved anyone yet. Add someone to pay them in two taps." with **Add a beneficiary**. With a filter and no match: "No beneficiaries match." with **Clear filters**. |
| Loading / error | Skeleton rows; "We couldn't load your beneficiaries. Nothing was changed." with **Try again**. |
| Drill-downs | Row: detail sheet (all fields, payments made, schedules that use this beneficiary). **Send money** opens the right transfer journey for the type. **Edit** and **Delete** open `manage-beneficiary`. |
| Launch points | Payments › beneficiaries: Add / Edit / Delete; row › Send money. |

### Shell: Scheduled and recurring payments

| Item | Spec |
|---|---|
| Purpose | Everything that will happen on its own. |
| Route | Web `/personal/payments/scheduled`; mobile screen `Scheduled`. |
| Data source | Planned `bank.schedules.list {status}` with `{id, kind, payee, fromAccountId, amount, currency, frequency, nextRunOn, endsOn, status, remainingRuns}`; existing `bank.subscriptions.list` shows as a separate "Subscriptions" group. |
| Tabs | **Upcoming** (next 90 days, all kinds), **Recurring** (weekly and monthly with an end), **Standing orders** (open-ended), **Subscriptions** (existing: Google One $21 in 4 days, StreamPlus $27 in 9 days, TuneBox $11 in 14 days), **History** (last 12 months of runs). |
| Columns | Payee, From (account mask), Amount, Frequency (statusChip: Once, Weekly, Monthly, Standing), Next payment, Ends, Status (Active, Paused, Completed, Cancelled). |
| Filters / sort | Status chips; sort by next payment, soonest first. |
| Empty | "Nothing scheduled. Set up a payment once and we'll send it on time." with **Schedule a payment**. |
| Loading / error | Skeleton; "We couldn't load your scheduled payments. Nothing was changed." with **Try again**. |
| Row actions | **Change** (`schedule-payment {scheduleId}`, `payments.schedule`), **Cancel** (`cancel-standing-order {scheduleId}`), **View runs**. A Paused schedule shows "Paused: the last two attempts failed (not enough money)." with **Resume** (opens `schedule-payment`). |
| Launch points | Payments › scheduled: New / Change; standing order › Cancel. |

### Shell: Payment tracker and receipts

| Item | Spec |
|---|---|
| Purpose | See where every payment is and keep proof. |
| Route | Web `/personal/payments/tracker`, detail `/personal/payments/tracker/{paymentId}`; mobile screens `Tracker`, `PaymentDetail`. |
| Data source | Planned `bank.payments.list {from, to, status, kind, query, cursor}` and `bank.payments.get {paymentId}`. Today only the reference in each journey result exists. |
| List (`dataTable`) | Date, Payee, Kind (Own, BankWorkx, Domestic, International, Bill, Top-up), Amount (sent) and, for abroad, the amount received, Status (`statusChip`: Processing, Sent, Completed, Failed, Cancelled), Reference. Newest first; filters for status, kind and date range; search by payee or reference. |
| Detail | `timeline` (planned) of events with time: Created, Authorised with code, Sent to the other bank, Completed (or Failed with the reason). Rows: From, To, Amount, Fee, Rate and amount received (abroad), Purpose, Reference, Estimated arrival. Actions: **Download receipt** (PDF on web, share sheet on phones), **Repeat payment** (opens the originating journey with `{paymentId}`, `payments.create`), **Cancel** for a payment still Scheduled (`cancel-standing-order`). |
| Status by kind | Own and BankWorkx: Completed at once. Domestic standard: Processing, then Completed the next working day. Domestic instant: Completed in seconds. International: Processing, Sent to bank, Completed in 1 to 3 working days. Bill and top-up: Completed at once. |
| Receipt (planned engine feature) | Title "Payment receipt"; the BankWorkx® name; reference; date and time UTC; from (name, mask); to (name, bank, mask or IBAN); amount, fee, rate, total; purpose; status; "Issued electronically, no signature needed." |
| Empty | "No payments yet. When you send money it will show here." |
| Loading / error | Skeleton rows; "We couldn't load your payments. Nothing was changed." with **Try again**. Unknown id: "We can't find that payment." |
| Launch points | Payments › tracker › payment › Repeat payment; the **Track payment** and **View receipt** buttons on every journey result. |

---

### ★ Ways to send money — `transfer-types`

Catalog: `transfer-types`, workspace Personal, category Personal: Payments (tab `pay`), core no, a bank can switch it off: yes (kept in the Lean preset, `basic`). Options: none of its own. A card appears only when the matching type option of `personal-transfer` is on (`type.own`, `type.internal`, `type.domestic`, `type.intl`), and a speed table only when its type is on and at least one speed is on. It moves no money.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `transfer-types` |
| Purpose | One simple screen that lists the four ways to send money, says how fast each one is, and shows the speeds the bank offers for another bank and for another country (when it arrives, fee, limit). Each card starts `personal-transfer` with the type already chosen. |
| Release / workspace | 1 / Personal |
| Status | Rebuilt lean and country-neutral. Built in the prototype (`design/bankworkx-r1/src/journeys/28-transfer-types.js`, a view journey, `view: true`). The earlier helper, region selector, rail cards and side-by-side table are removed. |
| Channels | Web and mobile |
| Starting pattern | None. Speeds come from the bank configuration (see "Home market configuration" in `personal-transfer`; reference `09-payment-rails.md`). |
| Who may use it | `payments.create` |
| Shared reference | `personal-transfer` for the types, speeds and the home market table. |

**Sandbox demo values.** The numbers on the screen follow the bank's home market. For the default market (Market A) the domestic table reads: Standard, 1 to 2 business days, Free, limit $25,000; Same day, Today, $1.00, limit None; Instant, In seconds, $0.25, limit $500,000. The country table reads: Standard, 1 to 3 business days, $25.00, None. Priority (Next business day, $40.00) is off by default.

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Payments › Send money (top of the tab) | none | `payments.create` |
| Home › Send | none | `payments.create` |

#### 3. Screens

One screen, `ways` ("Ways to send money"). Blocks: `heading`, one `card` row per type, up to two `dataTable`s.

**Type cards** (one per type that is on, in this order). Each card has an icon, the name, a short line under it, and a **Send** button that starts `personal-transfer {type}`.

| Card | Line under the name | **Send** starts |
|---|---|---|
| Between my accounts | "Instant" | `personal-transfer {type: own}` |
| To a BankWorkx® customer | "Instant, free" | `personal-transfer {type: internal}` |
| To another bank | The names of the speeds on offer, joined with commas, for example "Standard, Same day, Instant" | `personal-transfer {type: domestic}` |
| To another country | The names of the speeds on offer, for example "Standard" (and "Priority" when it is on) | `personal-transfer {type: international}` |

**Speed tables.** Shown under the cards, each with a small heading and the columns Speed, Arrives, Fee, Limit.

| Table | Heading | Rows |
|---|---|---|
| Domestic | "Speeds, to another bank" | One row per speed on offer in the home market (see the configuration table in `personal-transfer`). Speed is the class name (Standard, Same day, Instant). Arrives is the arrival text. Fee is "Free" or the amount in the home currency. Limit is the amount in the home currency, or "None" when the limit is a million or more. |
| International | "Speeds, to another country" | Standard, and Priority when on. Limit is always "None". |

A table is hidden when its type option is off or no speed is on. No scheme or country name is shown anywhere.

States:
- Loading: none (the screen draws at once; skeleton cards when speeds come from the bank, planned).
- Empty (every type off): icon, "Nothing is switched on", "Sending money isn’t available right now."
- Error: when the whole journey is switched off and opened from an old link: "This isn’t available at your bank." (`JOURNEY_DISABLED`). Speed data failing to load: "We couldn’t load the ways to send money. Nothing was changed." with **Try again** (planned).

#### 4. Sandbox errors

| Code | Message the person sees | Shows on | Button |
|---|---|---|---|
| `JOURNEY_DISABLED` | "This isn’t available at your bank." | `ways` | Back |
| `TIMEOUT` (planned) | "This is taking longer than expected. Nothing was changed." | `ways` | Try again |
| `SERVICE_UNAVAILABLE` (planned) | "This service is not available right now. Nothing was changed. Please try again in a few minutes." | `ways` | Try again |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `speeds` | `bank.payments.speeds` | `{market}` | `{domestic[{class, arrives, fee, max}], international[...]}` from the bank configuration | `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned). Not money-moving; no code |
| `catalog` | `bank.catalog.get` | none | which journeys are on, and their options | none | (planned; the prototype reads `JR.off` and `JR.opt`) |

In the prototype the speeds come from the constants `PT_M` (market to speed class to rail), `RAILS` (`src/js/90-payflow.js`) and `PT_ETA` in `32-personal-transfer.js`. The rail name is never shown. No adapter is called.

#### 6. Permissions, step-up and limits

`payments.create` to see the **Send** buttons. The screen changes nothing and asks for no code. Fees and limits shown are display values; `personal-transfer` enforces them.

#### 7. Result and links out

No result: the screen is the destination. Links out: `personal-transfer` with `{type}`. No notification.

#### 8. Acceptance criteria

- AC-1: The screen shows one card for each type that is switched on, in the order own, BankWorkx® customer, another bank, another country, and each **Send** starts `personal-transfer` with that type.
- AC-2: The line under "To another bank" and "To another country" lists exactly the speeds that are on for that type in the bank's home market.
- AC-3: The two speed tables show Speed, Arrives, Fee and Limit for the same speeds, with "Free" for a zero fee and "None" for no limit.
- AC-4: Switching a type off removes its card and its table; switching a speed off removes it from the line and the table.
- AC-5: No scheme name and no country name appears on the screen in any home market.
- AC-6: With every type off the empty state shows; with the whole journey off the message "This isn’t available at your bank." shows.
- AC-7: The screen moves no money and asks for no code.

#### 9. Scenarios

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1 | `alex` | none | Open the screen: four cards in order; tap **Send** on "To a BankWorkx® customer": `personal-transfer` opens with that type chosen. |
| T-2 | AC-2, AC-3 | `alex`, Market A | none | "To another bank" reads "Standard, Same day, Instant"; the table shows 1 to 2 business days Free $25,000, Today $1.00 None, In seconds $0.25 $500,000. |
| T-3 | AC-2, AC-3 | `alex`, Market C | none | The line reads "Standard, Instant"; no Same day row. |
| T-4 | AC-4 | `alex` | `type.intl` off; `speed.same-day` off | No "To another country" card or table; "Same day" is gone from the line and the table. |
| T-5 | AC-5 | `alex` | each of the four markets | Read the whole page: no scheme or country name. |
| T-6 | AC-6 | `alex` | all four type options off | "Nothing is switched on". With the journey off, the disabled message shows. |
| T-7 | AC-7, timeout | `alex` | `timeout: ["bank.payments.speeds"]`, `latencyMs: 10000` (planned) | "This is taking longer than expected. Nothing was changed." with **Try again**; nothing changes. |
| T-8 | AC-7, unavailable | `alex` | `unavailable: ["bank.payments.speeds"]` (planned) | The unavailable copy with **Try again**; nothing changes. |

#### 10. Expected mutation-check survivors

The order of the cards and the exact wording of the lines survive (only presence is asserted). The fee and limit figures survive until `bank.payments.speeds` feeds them. A mutant that swaps the arrival text of two speeds survives when no scenario compares them.

---

### ★ Between my accounts — `own-transfer`

Catalog: `own-transfer`, workspace Personal, category Personal: Payments, core no, a bank can switch it off: yes. Options (key, label, default): `allowFx` "Allow conversion between currencies" (on); `fxFee` "Charge the 0.20% conversion fee" (on). The same flow is also type `own` inside `personal-transfer` (option `type.own` there). Switching off this catalog entry removes the stand-alone launch points, not the type inside `personal-transfer`. The prototype file was not changed in the lean, country-neutral rework (last edited before it); it names no country and no scheme.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `own-transfer` |
| Purpose | Move money between the customer's own accounts. The same currency is a plain, instant, free move. Different currencies are converted at the mid-market rate with no margin, a separate 0.20% fee, and a rate held for 30 seconds. |
| Release / workspace | 1 / Personal |
| Status | Existing, rebuilt. Built in the prototype (`design/bankworkx-r1/src/journeys/30-own-transfer.js`); research in `research/own-transfer.md`. The conversion half started as `fixtures/convert-currency.ts`. |
| Channels | Web and mobile |
| Starting pattern | `fixtures/convert-currency.ts` |
| Who may use it | `payments.create` |

**Sandbox demo values (prototype).** Current account ••4410 (balance 8,240.18, available 8,102.40), Savings ••7720 (14,310.00), Euro account ••3302 (EUR 2,150.40), Dirham account ••9981 (AED 5,000.00). Mid-market rates come from 1 USD = EUR 0.926, AED 3.672. The first quote equals the mid rate; a refreshed or renewed quote moves up to 0.04% either way (random). Worked example: Current to Euro, send 500.00: rate 0.9260, fee 1.00, total taken 501.00, you get EUR 463.00. Any six digits are accepted as the code.

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Payments › Send money › Between my accounts | none | `payments.create` |
| Accounts › detail › Transfer from this account | `{accountId}` (prefills From) | `payments.create` |
| Home › Send › Between my accounts | none | `payments.create` |
| Payments › Ways to send money › Between my accounts | none | `payments.create` |

Launch values read: `accountId` (From), `toId` (To), `amount`. Defaults: From Current, To Savings.

#### 3. Screens

**Screen `accounts`** ("Between my accounts"). Intro "Money between your own accounts arrives straight away." Button **Continue**. A button **Swap accounts** (ghost, top right) exchanges From and To and clears any rate.

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| From | `select`: every account with name, last four, available | Yes | Not a frozen account | "You can’t send money from this account right now. Choose another account." |
| To | `select`: every account with name, last four, balance | Yes | Not the From account; when the currencies differ, `allowFx` must be on | "Choose an account to send to." (empty), "Choose two different accounts.", "We can’t convert between {currency} and {currency} yet." |
| (currency note) | `info`, shown when the currencies differ | n/a | none | Title "These accounts use different currencies". Body: "We convert at the mid-market rate, the one banks use between themselves, with no margin added. Today that is 1 {from} = {rate} {to}. Our fee is shown separately: 0.20% of the amount. You see the exact rate before you confirm." |

**Screen `amount`** ("Amount"). A card shows From and To. Button **See the rate**, busy "Getting your rate…".

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| I want to enter | `chips`: "What I send ({currency})", "What I get ({currency})". Only when the currencies differ | No | One of two | none |
| Amount | `amount`, placeholder "0.00". Hint "Entered in {currency}. Available in {account}: {amount}." | Yes | At least 1.00; total (amount plus fee) not above the available balance | "The smallest amount is 1.00." and "There isn’t enough money in {account}. Available: {amount}, and the fee is {fee}." |
| Note to yourself | `text`, placeholder "Optional", max 35, hint "Up to 35 characters." Only when the currencies are the same | No | Up to 35 characters | none |

Live summary under the fields. Same currency: You send, Fee (0.00), They get, Arrives "Now". Different currencies: You send, Mid-market rate (1 {from} = {rate} {to}), Margin on the rate "None", Fee (0.20%), Total taken, You get. Before an amount is entered: "Enter an amount to see the result."

**Screen `review`** ("Review transfer"). Button **Confirm and send code**.

Hero card: "You send" (or "Moving") and the amount, then "You get {amount}" or "to {account} ••{last4}". For a conversion, a rate box: a chip "{n} s left", the rate "1 {from} = {rate} {to}", and the text "Mid-market rate, no margin. Held for 30 seconds from when you saw it. If it runs out we show a new rate and you confirm again. Nothing is taken until you enter your code." with a button **Get a new rate** (announces the new rate). Rows: From, To, You send, Rate (mid-market, conversion), Fee ("Fee (0.20%)" for a conversion, "Fee" 0.00 otherwise), Total taken, You get, Arrives "Now", Note (when given). Required tick: "I confirm the details are correct" ("Tick to confirm.").

When the 30 seconds have run out on **Confirm and send code**: "The rate moved from {old} to {new}. Check the new amounts and confirm again." A new rate is taken.

**Code sheet.** Title "Authorise moving {amount} to {account}" (same currency) or "Authorise converting {amount} to {amount}" (conversion); sub "Code sent to ••• 4410. It only works for this transfer." Submit "Confirm and send code".

States:
- Loading: busy "Getting your rate…" on the amount step.
- Empty: none (the customer always has at least two accounts to choose from; with one account the To list is empty and the field shows "Choose an account to send to.").
- Error: field messages above; the rate message on the review; timeout and unavailable in section 4.

#### 4. Sandbox errors

| Code | Message the person sees | Shows on | Button |
|---|---|---|---|
| `SAME_ACCOUNT` | "Choose two different accounts." | `accounts` | Choose account |
| `ACCOUNT_CANNOT_DEBIT` | "You can’t send money from this account right now. Choose another account." | `accounts` | Choose account |
| `ACCOUNT_NOT_FOUND` | "We can’t find that account." | `amount` | Choose account |
| `CURRENCY_NOT_SUPPORTED` | "We can’t convert between those currencies yet." | `accounts` | Choose account |
| `INVALID_AMOUNT` | "Enter an amount in the account’s currency with at most 2 decimal places." (below 1.00: "The smallest amount is 1.00.") | `amount` | Change amount |
| `INSUFFICIENT_FUNDS` | "There isn’t enough money in {account}. Available: {amount}." | `amount` | Change amount |
| `QUOTE_EXPIRED` | "The rate has expired. A new rate is shown. Check it and confirm again." | `review` | Confirm again |
| `STEP_UP_FAILED` | "We couldn’t confirm this transfer. Nothing was moved. Start again." | code sheet | Start again |
| `TIMEOUT` | "We didn’t get an answer in time. Check Activity before you try again, so you don’t pay twice." | `timeout` | Check Activity |
| `SERVICE_UNAVAILABLE` (planned) | "We couldn’t reach the bank. Nothing was moved." | `unavailable` | Try again |

Prototype note: in this file the first messages of `SAME_ACCOUNT`, `ACCOUNT_CANNOT_DEBIT`, `CURRENCY_NOT_SUPPORTED`, `INVALID_AMOUNT` and `INSUFFICIENT_FUNDS` still end with the code in brackets, for example "(SAME_ACCOUNT)". The code must not be shown to the customer (planned fix).

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `accounts` | `bank.accounts.list` | none | accounts with balances | none | Existing |
| `quote` | `bank.fx.quote` | `{from, to, amount}` | `{quoteId, rate, expiresAt (30 s)}` | `CURRENCY_NOT_SUPPORTED` | Existing |
| `move` | `bank.transfers.own` | `{from, to, amount, quoteId?, note?}` | `{reference}` | `SAME_ACCOUNT`, `ACCOUNT_CANNOT_DEBIT`, `INSUFFICIENT_FUNDS`, `QUOTE_EXPIRED` | (planned). Today `bank.fx.convert` does the conversion |
| `otpSend`, `otpVerify` | `bank.otp.send`, `bank.otp.verify` | `{channel}`, `{code}` | `{sent, maskedPhone}`, `{verified}` | `OTP_INVALID` | Existing |

In the prototype no adapter is called: the rate is `FX[to] / FX[from]` and the move updates the demo accounts and Activity.

#### 6. Permissions, step-up and limits

`payments.create`; step-up `otp` (a code is asked because the move takes money out of a spendable account; the prompt names the amounts). No daily limit applies; no payee, so no name check and no new-payee rule. A frozen account cannot send but may receive. Conversion needs option `allowFx`; the fee needs `fxFee`. Business workspace: `WRONG_CONTEXT`.

#### 7. Result and links out

Result: title "Money moved" (same currency) or "Converted"; text "{amount} moved from {account} to {account}." or "{amount} became {amount}."; chip "Done · instant". Receipt rows: From, To, You sent, Rate (mid-market, no margin; conversion only), Fee, Total taken, You received, Rate reference (conversion only), Arrived "Now", Note. The balances and Activity update at once. Notification N-20. Buttons: **View accounts**, **Move more**.

#### 8. Acceptance criteria

- AC-1: Choosing the same account twice, or a frozen account as the source, is refused with the message in section 3 and nothing moves.
- AC-2: A same-currency move is free, instant, shows "They get" equal to "You send", and accepts an optional note of up to 35 characters.
- AC-3: A conversion shows the mid-market rate, "None" for the margin, the 0.20% fee separately, the total taken and what the customer gets; with `fxFee` off the fee is 0.00.
- AC-4: The customer can enter either what they send or what they get; the other side is calculated and rounded so that the customer never receives less than entered.
- AC-5: The rate is held for 30 seconds; after that **Confirm and send code** shows the new rate and does not move money until confirmed again.
- AC-6: With `allowFx` off, picking accounts in two currencies is refused.
- AC-7: An amount below 1.00, or above the available balance (with the fee), is refused with the message in section 3.
- AC-8: A one-time code that names the amount confirms the move; three wrong codes fail with the step-up message and nothing moves.
- AC-9: On timeout the person is told to check Activity first and no balance changes; when the bank is unavailable nothing moves.

#### 9. Scenarios

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1 | `alex` | none | From Current, To Current: "Choose two different accounts." A frozen account as From: "You can’t send money from this account right now. Choose another account." |
| T-2 | AC-2 | `alex` | none | Current to Savings, 200.00, note "Rainy day": no rate box, Fee 0.00, Arrives Now; result "Money moved"; Current available drops by 200.00, Savings rises. |
| T-3 | AC-3 | `alex` | none | Current to Euro, send 500.00: rate 0.9260, Fee (0.20%) 1.00, Total taken 501.00, You get EUR 463.00; result "Converted". |
| T-4 | AC-3 | `alex` | `fxFee` off | Same transfer: Fee 0.00, Total taken 500.00. |
| T-5 | AC-4 | `alex` | none | Choose "What I get (EUR)", enter 463.00: send amount is rounded up so the customer gets at least 463.00. |
| T-6 | AC-5 | `alex` | none | Open the review, wait 30 s, **Confirm and send code**: "The rate moved from … to …" and a new rate; **Get a new rate** works; confirming again goes to the code. |
| T-7 | AC-6 | `alex` | `allowFx` off | Current to Euro: "We can’t convert between USD and EUR yet." |
| T-8 | AC-7 | `alex` | none | Amount 0.50: "The smallest amount is 1.00." Amount above available: "There isn’t enough money in Current account. Available: …" |
| T-9 | AC-8 | `alex` | wrong code three times (planned in the prototype) | "We couldn’t confirm this transfer. Nothing was moved. Start again." Balances unchanged. |
| T-10 | AC-9, timeout | `alex` | `timeout: ["bank.fx.quote", "bank.transfers.own"]`, `latencyMs: 10000` (planned) | Timeout screen with "Check Activity before you try again, so you don’t pay twice"; balances unchanged. |
| T-11 | AC-9, unavailable | `alex` | `unavailable: ["bank.transfers.own"]` (planned) | "We couldn’t reach the bank. Nothing was moved." with **Try again**; balances unchanged. |

#### 10. Expected mutation-check survivors

The random drift of up to 0.04% on a renewed quote survives (it cannot be pinned). The exact rounding direction of the "What I get" calculation survives when the scenario amount converts evenly. The note length limit survives when no scenario sends 36 characters. The fixed 30-second hold survives until the sandbox quote carries its own expiry.

---

### ★ To a BankWorkx customer — `internal-transfer`

Catalog: `internal-transfer`, workspace Personal, category Personal: Payments, core no, a bank can switch it off: yes (through option `type.internal` of `personal-transfer`). Options: none of its own.

Alias of `personal-transfer`: reached with `personal-transfer {type: internal}`. The option `type.internal` ("Offer “To a BankWorkx® customer”") switches it off. The old slug is kept only so older links open the right place.

What differs from the other types (full rules, scenarios and criteria are in `personal-transfer`):
- The person finds the customer by mobile, email or BankWorkx ID; the name comes back and the customer is shown as "BankWorkx® customer". Unknown customer or already saved payee: the messages in `personal-transfer` section 4.
- One speed, Instant: free, in seconds, up to 25,000.00 per payment. No speed choice, no purpose, no address, no When field.
- The daily limit and the 24-hour 500.00 new-payee rule apply; sanctions screening applies.
- Demo values: Taylor Brooks (+1 202 555 0142, `taylor.brooks@example.com`, `taylorb`), Jordan Keller (+1 202 555 0177, `jordan.keller@example.com`, `jkeller`).

---

### ★ Send money — `personal-transfer`

Catalog: `personal-transfer`, workspace Personal, category Personal: Payments, core no, a bank can switch it off: yes. Options (key, label, default), all taken from the prototype:

| Key | Label | Default |
|---|---|---|
| `type.own` | Offer “Between my accounts” | on |
| `type.internal` | Offer “To a BankWorkx® customer” | on |
| `type.domestic` | Offer “To another bank” | on |
| `type.intl` | Offer “To another country” | on |
| `speed.standard` | Speed: Standard | on |
| `speed.same-day` | Speed: Same day (where the market has it) | on |
| `speed.instant` | Speed: Instant (where the market has it) | on |
| `speed.priority` | Speed: Priority (international) | off |
| `chargeChoice` | Let the customer choose who pays the bank charges (international) | off |
| `allowFx` | Allow currency conversion between my accounts | on |
| `nameCheck` | Run the payee name check where the market has one | on |
| `allowLater` | Allow “Later” and repeating payments | on |
| `coolingOff` | Apply the 24-hour limit to new payees | on |

The four types are the same at every bank and in every country. The bank's home market (a bank setting, `JR.market()` in the prototype: Market A, B, C or D) decides which identifier fields the "To another bank" form asks for and which rails sit behind the three speed names. The customer never sees a country or a scheme name. The old region and per-rail options are removed.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `personal-transfer` |
| Purpose | Send money in four standard ways: between my accounts, to a BankWorkx® customer, to another bank, to another country. For the last two the customer picks how fast (Standard, Same day, Instant; international Standard or Priority), sees the fee, the rate and the arrival before confirming, and confirms with a one-time code. A new payee is entered in the same flow and can be saved. |
| Release / workspace | 1 / Personal |
| Status | Existing, rebuilt lean and country-neutral. Built in the prototype (`design/bankworkx-r1/src/journeys/32-personal-transfer.js`; the engine fields are the array `PT_D`, the helpers are the object `XF`). The earlier region choice, rail cards, the "No cross-border" presets per rail and the BankWorkx® account-number lookup are removed. Research: `research/send-money-fields.md`. |
| Channels | Web and mobile |
| Starting pattern | `fixtures/local-transfer.ts` for the payee and the amount; the speed choice, the lookup and the name check are new. |
| Who may use it | `payments.create` |
| Shared reference | `09-payment-rails.md` is the bank-configuration reference for rails (fees, limits, arrival, cut-offs, scheme rules). Customers never see scheme names. |

**Sandbox demo values (prototype).** Accounts: Current ••4410 (available 8,102.40), Savings ••7720 (14,310.00), Euro account ••3302 (EUR 2,150.40), Dirham account ••9981 (AED 5,000.00). Only home-currency accounts can pay a third party. Saved payees: Maya Chen, Lena Fischer, James Whitfield, Omar Haddad (each belongs to the type that matches the home market: the same market is "To another bank", any other is "To another country"). BankWorkx® customers in the directory: Taylor Brooks (+1 202 555 0142, `taylor.brooks@example.com`, `taylorb`), Jordan Keller (+1 202 555 0177, `jordan.keller@example.com`, `jkeller`). Daily limit left 41,250.00 (fixed in the prototype). New payee allowance 500.00 for 24 hours. A payee named "Test Sanctions" is held for review. Rates against the home currency: 1 USD = EUR 0.926, GBP 0.781, AED 3.672, SAR 3.75, JOD 0.709, CAD 1.36, INR 83.2, JPY 151, AUD 1.52, CHF 0.88, SGD 1.34, MXN 17.1. Any six digits are accepted as the code.

**Home market configuration.** This table is the only place that names markets and schemes. It is bank configuration (09), not screen copy. Fees are in home-currency units and shown in the home currency; "Limit" is the largest amount for that speed in the payee's currency, "none" when the rail allows a million or more.

| Market | Identifier fields for "To another bank" | Name check | Reference length | Standard | Same day | Instant |
|---|---|---|---|---|---|---|
| Market A (routing number and account) | Routing number (9 digits, check digit), Account number (4 to 17 digits), Account type (Checking or Savings) | None | 80 | ACH: Free, 1 to 2 business days, limit 25,000 | Same-day ACH: 1.00, Today, none | RTP / FedNow: 0.25, In seconds, limit 500,000 |
| Market B (sort code and account) | Sort code (6 digits), Account number (8 digits), Account type (Personal or Business) | Yes, with account-type check | 18 | Bacs: Free, 3 business days, limit 20,000 | CHAPS: 25.00, Today, none | Faster Payments: Free, In seconds, none |
| Market C (IBAN) | IBAN (check digits, length, in the shared payment area) | Yes | 140 | SEPA Credit Transfer: Free, Next business day, none | none | SEPA Instant: 0.50, In seconds, limit 100,000 |
| Market D (IBAN, mobile alias) | IBAN (must start with the home country code). Mobile alias (planned, not in the prototype) | Yes | 140 | UAEFTS: 2.00, Today, none | none | Aani: 0.50, In seconds, limit 10,000 |
| International (every market) | See the international field table | Not available | 140 | SWIFT: 25.00, 1 to 3 business days, none | none | none. Priority (off by default): SWIFT priority, 40.00, Next business day |
| BankWorkx® customer (every market) | Mobile, email or BankWorkx ID | Lookup result instead | 140 | none | none | Internal transfer: Free, In seconds, up to 25,000 per payment |

**International country configuration.** Data, not screen copy. 18 countries in the prototype; the Country list leaves out the home country or countries (Market A: United States; B: United Kingdom; C: Germany, France, Spain, Italy, Ireland, Netherlands; D: United Arab Emirates).

| Country | Currency | Identifier | Extra bank code | Address required by rule |
|---|---|---|---|---|
| Australia | AUD | Account number | BSB | no |
| Canada | CAD | Account number | transit | no |
| Switzerland | CHF | IBAN (21 characters) | none | no |
| France, Germany, Ireland, Italy, Netherlands, Spain | EUR | IBAN | none | no |
| India | INR | Account number | IFSC | yes |
| Japan | JPY (whole numbers) | Account number | none | yes |
| Jordan | JOD | IBAN | none | no |
| Mexico | MXN | 18-digit account | none | yes |
| Saudi Arabia | SAR | IBAN | none | no |
| Singapore | SGD | Account number | none | no |
| United Arab Emirates | AED | IBAN | none | no |
| United Kingdom | GBP | IBAN | none | no |
| United States | USD | Account number | none | no |

Choosing "I pay all" for the bank charges (option `chargeChoice`) adds 15.00 to the fee. Cut-offs and scheme rules are in 09.

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Home › Send | none | `payments.create` |
| Payments › Send money | none | `payments.create` |
| Payments › Ways to send money (`transfer-types`) › **Send** | `{type}` | `payments.create` |
| Accounts › detail › Transfer | `{accountId}` (prefills From) | `payments.create` |
| Payments › Beneficiaries › Send (saved payee) | `{payeeId}` (or `ben`) | `payments.create` |
| `manage-beneficiary` receipt › **Send money** | `{payeeId}` | `payments.create` |

Launch values read: `type` (`own`, `internal`, `domestic`, `international`; the old value `intl` is accepted), `ben` or `payeeId` (a saved payee: the type is taken from the payee and the flow jumps to the amount), `accountId` (From), `toId` (own: To), `amount`, `country` (international: the first country). With a type given, the type screen is skipped.

#### 3. Screens

Steps in order: `type`, `payee`, `details`, `amount`, `review`, then the code and the receipt. A step that does not apply is skipped.

**Screen `type`** ("Send money"). Shown when no type was given. One `cards` field.

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| (no label) | `cards`: Between my accounts, To a BankWorkx® customer, To another bank, To another country (only the types that are on) | Yes | One of the cards | "Choose how to send." |

Empty (every type off): icon, "Nothing to send with", "Sending money isn’t available right now." Button **Continue**.

**Screen `payee`** ("Who are you paying?"). Shown for every type except "Between my accounts", when the customer has saved payees of that type and none was given. Button **Continue**.

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| (no label) | `cards`: each saved payee of this type (nickname and name, masked account), then **New payee** | Yes | One of the cards | "Choose a payee or add a new one." |

With no saved payee of the type, the screen is skipped and "New payee" is chosen.

**Screen `details`** ("Payee details"). Shown for a new payee. Button **Continue**, busy "Checking the payee…". The fields depend on the type. All messages are plain; error codes are not shown.

*To a BankWorkx® customer*

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| Find them by | `chips`: Mobile, Email, BankWorkx ID (default Mobile) | No | One of three; changing it clears the next field | none |
| Mobile, email or BankWorkx ID | `text`, max 60 | Yes | Mobile: 8 to 20 digits, spaces, brackets, dashes, optional leading + (`^\+?[\d\s()-]{8,20}$`). Email: `name@host.tld`. ID: 3 to 24 letters, numbers, dots, dashes, underscores | Mobile: "Enter the mobile number with its country code." Email: "Enter a full email address." ID: "A BankWorkx ID has 3 to 24 letters, numbers, dots or dashes." |
| (result card, inline) | `info`: the customer's name and "BankWorkx® customer" once the value matches a customer | n/a | Looked up on **Continue** | Not found: "We can’t find a BankWorkx® customer with those details. Check them and try again." Already saved: "You’ve already saved this payee. Choose them from your saved payees." |

*To another bank* (fields by home market)

| Field | Shown in | Block | Required | Validation | Message |
|---|---|---|---|---|---|
| Name | all | `text`, max 70 | Yes | At least 2 characters; starts with a letter or number; letters, numbers, spaces and . , ' ’ & ( ) / - | "Enter the name on the account." and "Use letters, numbers and spaces in the name." |
| Routing number | Market A | `text`, max 9, placeholder "9 digits" | Yes | 9 digits with a valid check digit | "That routing number isn’t valid. Check the 9 digits." |
| Account number | Market A | `text`, max 17 | Yes | 4 to 17 digits | "An account number has 4 to 17 digits." |
| Account type | Market A | `chips`: Checking, Savings (default Checking) | No | One of two | none |
| Sort code | Market B | `text`, max 8, placeholder "20-00-00" | Yes | 6 digits, dashes allowed | "A sort code has 6 digits, like 20-00-00." |
| Account number | Market B | `text`, max 8, placeholder "8 digits" | Yes | 8 digits | "An account number has 8 digits." |
| Account type | Market B | `chips`: Personal, Business (default Personal) | No | One of two. Changing it clears a "send anyway" tick | none |
| IBAN | Markets C and D | `text`, max 42 | Yes | Check digits and the length for its country must pass. Market C: the country must be in the shared payment area. Market D: must start with the home country code | "That IBAN doesn’t look right. Check each character." and "That IBAN can’t be used for this payment." |
| (name check card, inline) | Markets B, C, D | `info` | n/a | See below | See below |

*To another country*

| Field | Shown when | Block | Required | Validation | Message |
|---|---|---|---|---|---|
| Country | always | `select`, placeholder "Choose a country"; the list is every supported country except the home country or countries; the first is preselected when `country` was passed | Yes | One of the list. Changing it clears the identifier fields | "This is required." |
| Name | always | `text`, max 70 | Yes | Same as above | "Enter the name on the account." |
| IBAN | the chosen country uses IBANs | `text`, max 42 | Yes | Check digits pass, starts with the country's code, right length for the country | "That IBAN doesn’t look right. Check each character." |
| Account number | the country does not use IBANs | `text`, max 34 | Yes | 6 to 34 letters, numbers, spaces or dashes; exactly 18 digits when the country table says "18-digit account" | "That account number looks too short or too long." and "An account number has 18 digits." |
| Transit and institution number | the country table says "transit" | `text`, max 14, placeholder "00012-003" | Yes | 5 digits, optional dash, 3 digits | "Use the 5-digit transit number and 3-digit institution number, like 00012-003." |
| IFSC code | the country table says "IFSC" | `text`, max 14, placeholder "HDFC0000001" | Yes | 4 letters, a zero, then 6 letters or numbers | "An IFSC has 11 characters: 4 letters, a zero, then 6 letters or numbers." |
| BSB | the country table says "BSB" | `text`, max 14, placeholder "062-000" | Yes | 6 digits, optional dash | "A BSB has 6 digits, like 062-000." |
| SWIFT / BIC code | always | `text`, max 11, placeholder "8 or 11 characters" | Yes | 4 letters, 2 letters, 2 letters or numbers, optional 3; characters 5 and 6 must be the chosen country | "A SWIFT/BIC has 8 or 11 letters and numbers." and "That bank code doesn’t match the country." |

The country list, the IBAN countries and the extra bank codes are data: see "International country configuration" in section 1. Country names appear only as values in the Country list. Sample values (the prototype's test fill) are synthetic.

*Name check card* (only for "To another bank" in a market that has one, when the option `nameCheck` is on, the identifier fields are valid and the name has 2 or more characters). Shown inline under the fields, redrawn as the person types.

| Result | Card text | Extra control |
|---|---|---|
| Match | "The name matches" | none |
| Close | "The name is close", "The account holder is {registered name}." | Button **Use “{registered name}”** puts the registered name in the field. Tick **Send anyway** to go on |
| No match | "The name doesn’t match", "The account is held by someone else." | Tick **Send anyway** to go on |
| Wrong account type (Market B only) | "Wrong type of account", "This is a {personal or business} account." | Button **Switch to {type}** flips Account type. Tick **Send anyway** to go on |
| Not available | nothing is shown | none |

The step blocks **Continue** with "Confirm to continue." until **Send anyway** is ticked for a close, no-match or wrong-type result. Changing the result clears the tick. Lookup result for a BankWorkx® customer: "{name}", "BankWorkx® customer".

**Screen `amount`** ("Amount"). Button **Review**, busy "Getting your quote…". A card at the top shows the payee (initial, name, masked account) for every type except "Between my accounts". The fields:

*Between my accounts*

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| From | `select`: every account with name, last four, available | Yes | Not a frozen account | "You can’t send money from this account right now." |
| To | `select`: every account with name and last four | Yes | Not the From account; if the currencies differ, option `allowFx` must be on | "Choose two different accounts." and "We can’t convert between those currencies yet." |
| I want to enter | `chips`: "What I send ({currency})", "What I get ({currency})". Shown only when the currencies differ | No | One of two | none |
| Amount | `amount`, placeholder "0.00" | Yes | At least 1.00; total (with fee) not above the available balance | "The smallest amount is 1.00." and "There isn’t enough money in {account}. Available: {amount}." |
| (rate line) | summary: "Rate: 1 {from} = {rate} {to}" when the currencies differ | n/a | none | none |

Conversion uses the mid-market rate with no margin and the 0.20% fee of `own-transfer` (its option `fxFee` decides whether the fee is charged). The rate is held for 30 seconds (see the review screen).

*All other types*

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| From | `select`: home-currency accounts with name, last four, available | Yes | One of the list | "This is required." |
| Amount | `amount`, placeholder "0.00". Label is "Amount", or "They receive ({currency})" when the payee is paid in another currency. Symbol is the payee's currency. A currency without decimals: whole numbers only | Yes | Above zero; within the limits below | See the limits table |
| (summary) | `info`: when the payee is paid in another currency "They receive" and "Rate: 1 {home} = {rate} {currency}"; "Fee" when above zero; always "You pay" | n/a | Redrawn as the amount changes | none |
| Speed | `cards` of the speeds on offer (domestic and international only): name, "{arrival} · up to {limit}" when the speed has a limit, fee ("Free" or the amount). The chosen one is highlighted. A speed whose limit is below the amount is dimmed with "Over the limit" and cannot be chosen. The first speed that fits is chosen automatically. BankWorkx® customers have no choice (Instant) | n/a | At least one speed fits | "That is over the limit of {largest limit}. Try a smaller amount." |
| Purpose | `select`, placeholder "Choose a purpose": Family support, Goods or services, Salary, Rent, Education, Savings or investment, Other. International only | Yes | One of the list | "Choose a purpose for this payment." |
| Their street and number | `text`, max 70 | Yes | Shown when the address rule applies and the payee has no address yet. Letters, numbers, spaces and . , ' ’ # & ( ) / - | "Use letters, numbers and spaces." |
| Town or city | `text`, max 35, half width | Yes | Same rule | "Use letters, numbers and spaces." |
| Postcode | `text`, max 16, half width | No | Same rule | "Use letters, numbers and spaces." |
| Your relationship to them | `select`, placeholder "Choose one": Myself, Family member, Friend, My employer, Supplier or business, Landlord, School or university, Other. Shown when the address rule applies | Yes | One of the list | "Choose how you know them." |
| Who pays the bank charges? | `chips`: Shared, "I pay all (+{15.00})", They pay. International only, when `chargeChoice` is on (default Shared) | No | One of three | none |
| Reference | `text`, placeholder "Optional", max 140 (domestic: the market's length in the configuration table) | No | Letters, numbers, spaces and . , ' - / ( ) + : ? only; within the length | "Use {n} characters or fewer." and "Use letters, numbers, spaces and . , ' - / ( ) + : ? only." |
| When | `chips`: Now, Later. Domestic and international only, when `allowLater` is on | No | One of two | none |
| Send on | `date`, the next 30 business days. Shown when When is Later | Yes | One of the list | "This is required." |
| Repeat | `chips`: Doesn’t repeat, Every week, Every month. Shown when When is Later | No | One of three | none |

*Address rule.* The address, relationship and the extra checks apply to an international payment when the country is one that requires an address ("yes" in the country table) or the payment is worth 10,000 USD or more. If the saved payee already has a street and a town, they are not asked again. Missing address on **Review**: "We need the payee’s address for this payment."

*Limits and checks on the amount* (messages shown under the field and again on **Review**):

| Check | Message the person sees |
|---|---|
| Nothing is available (all speeds off) | "Sending isn’t available right now. Try again later." |
| Zero or negative | "Enter an amount above zero." |
| Currency without decimals, decimals typed | "Enter a whole number." |
| Over the largest speed limit | "That is over the limit of {amount}. Try a smaller amount." |
| BankWorkx® customer over 25,000 | "You can send up to {amount} at a time." |
| Not enough in the account | "Not enough in the account: you’d pay {total} but {available} is available." |
| Over the daily limit (41,250.00 left) | "That is over your remaining daily limit of {amount}." |
| New payee (under 24 hours) over 500.00 | "New payees can receive up to {500.00} in their first 24 hours." |
| Purpose missing (international) | "Choose a purpose for this payment." |

**Screen `review`** ("Review"). Button **Confirm**.

*Between my accounts.* Hero: "You send" (or "Moving") and the amount, then "You get {amount}" or "to {account} ••{last4}". Rows: From, To, Rate (when converting), Fee (when above zero), Total.

*All other types.* Hero: "You’re sending" (or "Scheduled for {date}"), the amount the payee receives, "to {name}". Rows: From, To (name and masked account), Country (international), Speed (Instant for a BankWorkx® customer), Arrives (or Scheduled for), They receive and Rate (when converted), Fee ("Free" or the amount), You pay, Repeats (when set), Purpose (international), Reference (when given). A tick **Save this payee** (default on) is shown for a new payee.

When the payment is in another currency and more than 60 seconds have passed since the quote: "The exchange rate changed. Check the new amount and confirm again." A new quote is taken and the screen stays. For "Between my accounts" the rate is held 30 seconds; when it has run out: "The rate moved from {old} to {new}. Check the new amounts and confirm again."

**Code sheet** (engine step-up). Title "Authorise {amount} to {name}" (own: "Authorise moving {amount} to {account}" or "Authorise converting {amount} to {amount}"); sub "Code sent to ••• 4410." Submit button "Confirm and send". Three wrong codes fail the payment: "We couldn’t confirm this payment. Nothing was sent. Start again."

**Result.** See section 7.

States:
- Loading: busy text on **Continue** ("Checking the payee…") and **Review** ("Getting your quote…"); the speed cards and the summary redraw as the person types.
- Empty: the `type` screen empty state above; no saved payee skips the `payee` screen.
- Error: a message under the field, or a banner on the step. After 10 seconds without an answer, the timeout state in section 4. No money moves when an error shows.

#### 4. Sandbox errors

The customer sees the message; the code stays in tests and the sandbox.

| Code | Message the person sees | Shows on | Button |
|---|---|---|---|
| `CUSTOMER_NOT_FOUND` | "We can’t find a BankWorkx® customer with those details. Check them and try again." | `details` | Edit |
| `BENEFICIARY_EXISTS` | "You’ve already saved this payee. Choose them from your saved payees." | `details` | Back |
| `PAYEE_NOT_CHECKED` | "Check the payee before you continue." | `amount` | Back |
| `RAIL_NOT_AVAILABLE` | "Sending isn’t available right now. Try again later." | `amount` | Change speed |
| `RAIL_LIMIT` | "That is over the limit of {amount}. Try a smaller amount." | `amount` | Change amount |
| `INSUFFICIENT_FUNDS` | "Not enough in the account: you’d pay {total} but {available} is available." | `amount` | Change amount |
| `DAILY_LIMIT_EXCEEDED` | "That is over your remaining daily limit of {amount}." | `amount` | Change amount |
| `BENEFICIARY_COOLING_OFF` | "New payees can receive up to {500.00} in their first 24 hours." | `amount` | Change amount |
| `PURPOSE_REQUIRED` | "Choose a purpose for this payment." | `amount` | Edit |
| `ADDRESS_REQUIRED` | "We need the payee’s address for this payment." | `amount` | Edit |
| `INVALID_AMOUNT` | "Enter an amount above zero." or "Enter a whole number." | `amount` | Change amount |
| `SAME_ACCOUNT` | "Choose two different accounts." | `amount` (own) | Choose account |
| `ACCOUNT_CANNOT_DEBIT` | "You can’t send money from this account right now." | `amount` (own) | Choose account |
| `ACCOUNT_NOT_FOUND` | "We can’t find that account." | `amount` (own) | Choose account |
| `CURRENCY_NOT_SUPPORTED` | "We can’t convert between those currencies yet." | `amount` (own) | Choose account |
| `QUOTE_EXPIRED` | "The exchange rate changed. Check the new amount and confirm again." (own: "The rate moved from {old} to {new}. Check the new amounts and confirm again.") | `review` | Confirm again |
| `STEP_UP_FAILED` | "We couldn’t confirm this payment. Nothing was sent. Start again." | code sheet | Start again |
| `PAYMENT_HELD` | "We’re checking this payment and will tell you within one working day." | result (amber) | Back to Payments |
| `TIMEOUT` (planned) | "We didn’t get an answer in time. Check Activity before you try again, so you don’t pay twice." | `timeout` | Check Activity |
| `SERVICE_UNAVAILABLE` (planned) | "We couldn’t reach the bank. Nothing was sent." | `unavailable` | Try again |

Field-level codes (invalid routing number, sort code, account number, IBAN, SWIFT/BIC, bank code, reference characters) keep their codes in 09 section 12 and in the tests; the person sees the field messages in section 3.

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `accounts` | `bank.accounts.list` | none | accounts | none | Existing |
| `payees` | `bank.beneficiaries.list` | none | map with `ageHours`; planned adds `kind`, `country`, `currency`, `checkResult`, `maskedAccount`, address | none | Existing, extended |
| `limits` | `bank.limits.get` | `{currency?}` | `{daily, usedToday}` (replaces the fixed 41,250.00) | `LIMIT_NOT_SET` | Existing |
| `lookup` | `bank.payees.lookup` | `{by, value}` | `{name, maskedAccount}` | `CUSTOMER_NOT_FOUND`, `BENEFICIARY_EXISTS` | (planned). Not money-moving; no code |
| `validate` | `bank.payees.validate` | `{type, country?, fields}` | `{ok, fieldErrors, bankName?}` | field codes | (planned, 09 section 13) |
| `check` | `bank.payees.check` | `{name, account key, accountType?}` | `{result: "match"\|"close"\|"none"\|"na"\|"type", registeredName?}` | `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned) |
| `quote` | `bank.payments.quote` | `{fromAccountId, payee or fields, receiveAmount, speed?, when?, chargeBearer?, purpose?}` | `{quoteId, speeds[{class, fits, available, reason?}], rate, fee, total, arrives, expiresAt (60 s)}` | `RAIL_NOT_AVAILABLE`, `RAIL_LIMIT`, `INSUFFICIENT_FUNDS`, `DAILY_LIMIT_EXCEEDED`, `BENEFICIARY_COOLING_OFF`, `PURPOSE_REQUIRED`, `ADDRESS_REQUIRED` | (planned). Maps the speed class to the rail of the home market |
| `ownQuote` | `bank.fx.quote` | `{from, to, amount}` | `{quoteId, rate, expiresAt}` | `CURRENCY_NOT_SUPPORTED` | Existing |
| `otpSend`, `otpVerify` | `bank.otp.send`, `bank.otp.verify` | `{channel}`, `{code}` | `{sent, maskedPhone}`, `{verified}` | `OTP_INVALID` | Existing |
| `pay` | `bank.payments.create` | `{quoteId, payeeId or fields, purpose?, relationship?, reference?, when?, repeat?, acknowledged, save?}` | `{reference (BWX-…), railReference, status: "settled"\|"processing"\|"scheduled"\|"held"}` | the quote codes, `QUOTE_EXPIRED`, `PAYMENT_HELD`, `STEP_UP_FAILED` | (planned) |
| `own` | `bank.transfers.own` | `{from, to, amount, quoteId?}` | `{reference}` | `SAME_ACCOUNT`, `ACCOUNT_CANNOT_DEBIT`, `QUOTE_EXPIRED` | (planned) |

Today `bank.transfers.create` and `bank.fx.convert` stay for the existing journeys. In the prototype nothing is called: the speeds come from `PT_M` and `RAILS`, the payee check from `payeeCheck`, the directory from `PT_DIR`, and the result is written to the demo data. Sandbox conditions (09 section 13): `unavailable: ["bank.payments.create"]`, `timeout: ["bank.payments.create"]`, and one speed down with `unavailable: ["rail:<id>"]` (planned).

#### 6. Permissions, step-up and limits

`payments.create`. Step-up `otp` on every payment, including "Between my accounts" (the code names the amount and the payee or account). Three wrong codes fail the payment with `STEP_UP_FAILED`; the prototype accepts any six digits. Daily limit 41,250.00 left in the demo (own transfers do not use it). Speed limits as in the configuration table. New payee rule (rule A at the top of this group): a payee under 24 hours old, including one typed in this flow, can receive at most 500.00 in 24 hours, enforced when `coolingOff` is on. Sanctions screening on every payment. Business workspace: `WRONG_CONTEXT`. Later and repeating payments are for "To another bank" and "To another country" only.

#### 7. Result and links out

Result titles and chips:

| Case | Title | Chip | Text |
|---|---|---|---|
| Between my accounts, same currency | "Money moved" | "Done" | "{amount} moved to {account}." |
| Between my accounts, converted | "Converted" | "Done" | "{amount} became {amount}." |
| Instant (BankWorkx® customer or Instant speed) | "Sent" | "Delivered" | "{amount} to {name}" |
| Other speeds | "On its way" | "Arrives {date}" | "{amount} to {name}" |
| Later | "Scheduled" | "Scheduled for {date}" | "{amount} to {name}" |
| Held (name contains "Test Sanctions") | "Held for review" | "Held for review" (amber) | "We’re checking this payment and will tell you within one working day. You don’t need to do anything." |

Receipt rows: Amount, To, Speed, Arrives (or First payment), Fee, Total. Own: From, To, Amount, They receive (when converted), Fee (when above zero), Total. The payee is saved (as "New · 24 hours left") when **Save this payee** was ticked. The balance and Activity update at once unless the payment is scheduled or held. Buttons: **Track payment** (Payments), **See scheduled payments** (for Later), **Send another** (this journey), **Back to Payments** (held); own: **View accounts**, **Send more**. Notifications: N-20 (own), N-21 (BankWorkx® customer), N-22 (another bank), N-23 and N-24 (another country) in the Retail notification catalogue; a held payment raises "Payment held". `manage-beneficiary` is the stand-alone way to add, edit or delete a payee; adding one inside this flow is part of this journey. A Later payment is also listed by `schedule-payment`.

#### 8. Acceptance criteria

- AC-1: The type screen lists only the types that are on and is skipped when a type or a saved payee is given; with all four off it shows "Nothing to send with".
- AC-2: "Between my accounts" refuses the same account twice and a frozen account, converts at the mid-market rate with the fee separate, holds the rate for 30 seconds, and asks for a new check when it expires.
- AC-3: "To a BankWorkx® customer" finds a customer by mobile, email or BankWorkx ID, shows the name, refuses an unknown customer and an already-saved one, is free, instant and limited to 25,000.00 per payment, and cannot be scheduled.
- AC-4: "To another bank" asks exactly the identifier fields of the home market, each with its validation message, and never shows a scheme or a country name.
- AC-5: The name check card appears only in a market that has one with the option on, offers **Use** and **Switch to** where they apply, and requires **Send anyway** for a close, no-match or wrong-type result.
- AC-6: "To another country" asks for the country, the name, the country's identifier and bank code, and the SWIFT/BIC code; each field validates as listed; the purpose is required; the address and relationship are asked when the address rule applies.
- AC-7: The speed cards show the speeds that are on for the type and market with arrival, limit and fee; a speed over the limit is dimmed; the summary shows the rate, the fee and "You pay".
- AC-8: The amount screen enforces the available balance, the daily limit, the speed limit, the 25,000.00 internal limit and the 500.00 new-payee limit with the messages in section 3.
- AC-9: A saved payee opens at the amount screen with the right type; a payee in the home market is "To another bank", any other is "To another country".
- AC-10: Later and Repeat appear only for the two bank types and only when `allowLater` is on, and the date list holds business days.
- AC-11: A payment in another currency asks for a new quote after 60 seconds and shows the exchange-rate message.
- AC-12: The result matches the case table in section 7, the balance and Activity update only for an immediate payment, and a held payment changes neither the balance nor the ledger.
- AC-13: **Save this payee** adds the payee as new (24-hour rule) when ticked and not otherwise.
- AC-14: Every payment is confirmed with a one-time code that names the amount and payee; three wrong codes fail with the step-up message.
- AC-15: On timeout the person is told to check Activity first and nothing is applied; when the bank is unavailable nothing is sent.

#### 9. Scenarios

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1 | `alex` | none | Open **Send money**: four cards. Open with `type: domestic`: the type screen is skipped. All four type options off: "Nothing to send with". |
| T-2 | AC-2 | `alex` | none | Between my accounts: choose Current as From and Current as To: "Choose two different accounts." Choose a frozen account: "You can’t send money from this account right now." |
| T-3 | AC-2 | `alex` | none | Current to Euro, enter 500.00: rate and fee show; review shows the rate with a hold; wait 30 s then **Confirm**: "The rate moved from … to …" and a new rate; confirm again: "Converted". |
| T-4 | AC-2, AC-8 | `alex` | none | Own, amount 0.50: "The smallest amount is 1.00." Amount above the balance: "There isn’t enough money in Current account. Available: …" |
| T-5 | AC-3 | `alex` | none | BankWorkx® customer by mobile `+1 202 555 0142`: card shows "Taylor Brooks" and "BankWorkx® customer"; amount 100.00; Instant; Free; result "Sent" "Delivered". |
| T-6 | AC-3 | `alex` | none | Find by email with a value that matches nobody: **Continue** shows "We can’t find a BankWorkx® customer with those details. Check them and try again." A customer already saved: "You’ve already saved this payee. Choose them from your saved payees." |
| T-7 | AC-3, AC-8 | `alex` | none | BankWorkx® customer, amount 30,000.00: "You can send up to $25,000.00 at a time." No When field is shown. |
| T-8 | AC-4 | `alex`, each of Markets A, B, C, D | none | New payee, another bank: the fields match the configuration table; enter an invalid value in each and read the field message exactly. No scheme or country name appears on any screen. |
| T-9 | AC-5 | `alex`, Market B | none | Enter a sort code and account of a known payee with the wrong name: "The name is close", **Use “…”** replaces the name; with a business account typed as personal: "Wrong type of account" and **Switch to business**; **Continue** is blocked until **Send anyway**. |
| T-10 | AC-5 | `alex`, Market A | none | No name check card is shown. With `nameCheck` off in Market B: no card. |
| T-11 | AC-6 | `alex` | none | Another country, choose a country that uses an IBAN: IBAN field; a wrong country prefix: "That IBAN doesn’t look right. Check each character."; Canada shows "Transit and institution number"; India "IFSC code"; Australia "BSB"; Mexico account with 17 digits: "An account number has 18 digits."; BIC of the wrong country: "That bank code doesn’t match the country." |
| T-12 | AC-6, AC-8 | `alex` | none | International, 12,000.00 to a country that is not on the address list: the address and relationship fields still appear (the 10,000 rule); empty address: "We need the payee’s address for this payment."; no purpose: "Choose a purpose for this payment." |
| T-13 | AC-7 | `alex`, Market A | none | Domestic, amount 30,000.00: Standard is dimmed "Over the limit"; Instant is dimmed; Same day is chosen. Amount 100.00: Standard is chosen; pick Instant: fee 0.25 shows in the summary and review. |
| T-14 | AC-7, AC-11 | `alex` | none | International with a foreign-currency payee: label "They receive ({currency})", the rate line shows; review after 60 s: "The exchange rate changed. Check the new amount and confirm again." |
| T-15 | AC-8 | `alex` | none | Domestic 50,000.00 with a large enough speed: "That is over your remaining daily limit of $41,250.00." Amount above the balance: "Not enough in the account: you’d pay … but … is available." |
| T-16 | AC-8, AC-13 | `alex` | none | New payee, 600.00: "New payees can receive up to $500.00 in their first 24 hours." Same with `coolingOff` off: accepted. |
| T-17 | AC-9 | `alex` | none | Open with `payeeId` of a payee in the home market: starts at the amount; type is "To another bank". Open with a payee from another market: type is "To another country". |
| T-18 | AC-10 | `alex` | none | Domestic: choose Later; **Send on** lists business days; pick one and Every month; result "Scheduled" and the entry appears in scheduled payments. With `allowLater` off or type BankWorkx® customer: no When field. |
| T-19 | AC-12 | `alex` | none | A payee named "Test Sanctions": result "Held for review"; available balance drops, ledger and Activity do not change. |
| T-20 | AC-13 | `alex` | none | New payee, leave **Save this payee** ticked: payee appears as "New · 24 hours left". Untick: not saved. |
| T-21 | AC-14 | `alex` | wrong code three times (planned in the prototype) | "We couldn’t confirm this payment. Nothing was sent. Start again." Balance unchanged. |
| T-22 | AC-15, timeout | `alex` | `timeout: ["bank.payments.create"]`, `latencyMs: 10000` (planned) | Timeout screen with "Check Activity before you try again, so you don’t pay twice"; balance unchanged. |
| T-23 | AC-15, unavailable | `alex` | `unavailable: ["bank.payments.create"]` (planned) | "We couldn’t reach the bank. Nothing was sent." with **Try again**; balance unchanged. |

#### 10. Expected mutation-check survivors

- The sample values and the fixed 41,250.00 survive until `bank.limits.get` feeds them.
- The exact order of the fields and the highlighted default speed survive when only presence is asserted.
- The rate drift of up to 0.04% on a renewed own-account quote is random and cannot be pinned by a scenario.
- A mutant that changes the Priority fee or the "I pay all" extra (15.00) survives while both options are off by default and no scenario turns them on (add T-24 when a bank enables them).
- The "whole number" rule survives because no scenario sends to a payee paid in a currency without decimals.
- The Market D mobile alias is not built (planned), so no mutant can touch it.
- Which of the three address-rule countries triggers the address fields survives when only one is exercised.

Notes for the next change: `own` inside this journey reads the conversion fee option `fxFee` of `own-transfer`, and `allowFx` of this journey; `single-transfer` reads its own `coolingOff` only for display, while the limit is enforced by this journey's `coolingOff`.

---

### ★ Quick transfer — `single-transfer`

Catalog: `single-transfer`, workspace Personal, category Personal: Payments, core no, a bank can switch it off: yes. Options (key, label, default): `allowInstant` "Offer the Instant speed" (on); `allowLater` "Allow “Later” and repeating payments" (on); `coolingOff` "Apply the 24-hour limit to new payees" (on). The earlier demo switches (a rail down, "it is 16:30") are removed.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `single-transfer` |
| Purpose | Pay a saved payee from one page: choose the payee, enter the amount, pick a speed, then review and confirm with a code. New payees, BankWorkx® customers and "Between my accounts" use `personal-transfer`. |
| Release / workspace | 1 / Personal |
| Status | Existing, rebuilt lean. Built in the prototype (`design/bankworkx-r1/src/journeys/29-single-transfer.js`). It builds on the helpers (`XF`) of `32-personal-transfer.js`, so the speeds, fees, limits and checks are the same. |
| Channels | Web and mobile |
| Starting pattern | `fixtures/local-transfer.ts` |
| Who may use it | `payments.create` |
| Shared reference | `personal-transfer` (speeds, the home market configuration table, limits). `09-payment-rails.md` for rails. |

**Sandbox demo values.** Account: Current ••4410, available 8,102.40 (only home-currency accounts are offered). Saved payees as in `personal-transfer`. A payee saved today is "New · 24 hours left" and limited to 500.00. Daily limit left 41,250.00. A payee named "Test Sanctions" is held for review. Any six digits are accepted as the code. A payee that is a BankWorkx® customer is not in the list (use `personal-transfer`).

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Payments › Beneficiaries › Send | `{payeeId}` | `payments.create` |
| Payments › Ways to send money › Quick transfer | none | `payments.create` |
| Accounts › detail › Transfer from this account | `{accountId}` | `payments.create` |
| Receipt › **Send another** | none | `payments.create` |

Launch values read: `accountId` (From), `payeeId` (To), `amount`.

#### 3. Screens

**Screen `form`** ("Quick transfer"). Button **Review**, busy "Checking the payment…".

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| From | `select`: home-currency accounts with name, last four, available | Yes | One of the list | "This is required." |
| To | `cards`: each saved payee that is not a BankWorkx® customer (nickname and name, masked account). Choosing a payee resets the speed to Standard | Yes | One of the cards | "Choose who to pay." |
| Amount | `amount`, placeholder "0.00". Label is "Amount", or "They receive ({currency})" when the payee is paid in another currency | Yes | Above zero; the checks in `personal-transfer` section 3 (limit, balance, daily limit, new payee) | The same messages as `personal-transfer` |
| (summary) | `info`: "They receive" and "Rate: 1 {home} = {rate} {currency}" when converted; "Fee" when above zero; "You pay" | n/a | Redrawn as the amount changes | none |
| Speed | `cards` of the speeds on offer for the payee's type (name, arrival and limit, fee). "Instant" is hidden when `allowInstant` is off. A speed over the limit is dimmed "Over the limit" | n/a | At least one speed fits | "That is over the limit of {amount}. Try a smaller amount." |
| Purpose | `select`, placeholder "Choose a purpose" (list as in `personal-transfer`). Only when the payee belongs to "To another country" | Yes | One of the list | "Choose a purpose for this payment." |
| Reference | `text`, placeholder "Optional", max 140 (domestic: the market's length) | No | Allowed characters and length as in `personal-transfer` | "Use {n} characters or fewer." and "Use letters, numbers, spaces and . , ' - / ( ) + : ? only." |
| When | `chips`: Now, Later. Only when `allowLater` is on | No | One of two | none |
| Send on | `date`, the next 30 business days. When is Later | Yes | One of the list | "This is required." |
| Repeat | `chips`: Doesn’t repeat, Every week, Every month. When is Later | No | One of three | none |

Empty (no saved payee): icon, "No saved payees", "Add a payee once and paying them takes two taps." Button **Add a beneficiary** (`manage-beneficiary {mode: add}`).

**Screen `review`** ("Review"). Button **Confirm and send**. Hero: "You’re sending" (or "Scheduled for {date}"), the amount the payee receives, "to {name}". Rows: From, To (name and masked account), Speed, Arrives (or Scheduled for), They receive and Rate (when converted), Fee ("Free" or the amount), You pay, Repeats, Purpose (another country), Reference. If the payment is in another currency and 60 seconds have passed since the form was checked: "The exchange rate changed. Check the new amount and confirm again." (a new quote is taken).

**Code sheet.** Title "Authorise {amount} to {name}"; sub "Code sent to ••• 4410."

States: loading is the busy text on **Review**; error messages show under the field or as a banner; timeout and unavailable as in section 4.

#### 4. Sandbox errors

| Code | Message the person sees | Shows on | Button |
|---|---|---|---|
| `PAYEE_NOT_CHECKED` | "Choose who to pay." | `form` | Choose payee |
| `RAIL_NOT_AVAILABLE` | "Sending isn’t available right now. Try again later." | `form` | Change speed |
| `RAIL_LIMIT` | "That is over the limit. Choose another speed or send less." | `form` | Change speed |
| `INSUFFICIENT_FUNDS` | "Not enough in the account: you’d pay {total} but {available} is available." | `form` | Change amount |
| `DAILY_LIMIT_EXCEEDED` | "That is over your remaining daily limit of {amount}." | `form` | Change amount |
| `BENEFICIARY_COOLING_OFF` | "New payees can receive up to {500.00} in their first 24 hours." | `form` | Change amount |
| `PURPOSE_REQUIRED` | "Choose a purpose for this payment." | `form` | Edit |
| `QUOTE_EXPIRED` | "The exchange rate changed. Check the new amount and confirm again." | `review` | Confirm again |
| `STEP_UP_FAILED` | "We couldn’t confirm this payment. Nothing was sent. Start again." | code sheet | Start again |
| `PAYMENT_HELD` | "We’re checking this payment and will tell you within one working day." | result (amber) | Back to Payments |
| `TIMEOUT` | "We didn’t get an answer in time. Check Activity before you try again, so you don’t pay twice." | `timeout` | Check Activity |
| `SERVICE_UNAVAILABLE` | "We couldn’t reach the bank. Nothing was sent." | `unavailable` | Try again |

#### 5. Adapters

As `personal-transfer` section 5: `bank.accounts.list` (existing), `bank.beneficiaries.list` (existing, extended), `bank.limits.get` (existing), `bank.payments.quote` and `bank.payments.create` (planned), `bank.otp.send` and `bank.otp.verify` (existing). In the prototype no adapter is called; the data comes from the `XF` helpers.

#### 6. Permissions, step-up and limits

`payments.create`; step-up `otp` on every payment (the code names the amount and the payee; three wrong codes fail with `STEP_UP_FAILED`). Daily limit 41,250.00 left in the demo. Speed limits as in the `personal-transfer` configuration table. New payees (under 24 hours) are limited to 500.00 in 24 hours. Sanctions screening on every payment. Business workspace: `WRONG_CONTEXT`.

#### 7. Result and links out

Result titles as in `personal-transfer` section 7: "Sent" (Instant), "On its way", "Scheduled", "Held for review". Rows: Amount, To, Speed, Arrives (or First payment), Fee, Total. Notifications N-22 (another bank) or N-23 (another country). Buttons: **Track payment** (or **See scheduled payments** for Later), **Send another** (this journey), **Back to Payments** (held). **Add a beneficiary** opens `manage-beneficiary`.

#### 8. Acceptance criteria

- AC-1: Only saved payees that are not BankWorkx® customers are offered; with none, the empty state offers **Add a beneficiary**.
- AC-2: The speeds shown follow the payee's type and the bank's home market, and "Instant" disappears when `allowInstant` is off.
- AC-3: Amount, balance, daily-limit, speed-limit and new-payee checks give the same messages as `personal-transfer`.
- AC-4: A payee in another country needs a purpose before **Review**.
- AC-5: Later and Repeat appear only when `allowLater` is on, with business-day dates.
- AC-6: Review shows the speed, the arrival, the fee and what the customer pays; a foreign-currency quote older than 60 seconds is renewed with the exchange-rate message.
- AC-7: A one-time code confirms the payment; three wrong codes fail; a held payment changes neither the balance nor the ledger.
- AC-8: On timeout nothing is applied and the person is told to check Activity; when the bank is unavailable nothing is sent.

#### 9. Scenarios

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1 | `alex` | no saved payees | The empty state "No saved payees" with **Add a beneficiary**. |
| T-2 | AC-2 | `alex`, Market A | none | Payee in the home market: Standard, Same day, Instant cards. With `allowInstant` off: no Instant card. |
| T-3 | AC-3 | `alex` | none | Amount above the balance, above 41,250.00, above the speed limit, 600.00 to a payee saved today: each message as in `personal-transfer`. |
| T-4 | AC-4 | `alex` | none | A payee in another country: **Review** is blocked until a purpose is chosen. |
| T-5 | AC-5 | `alex` | `allowLater` on, then off | Later shows Send on and Repeat; with the option off, no When field. |
| T-6 | AC-6 | `alex` | none | Pay a foreign payee, wait 60 s, **Confirm and send**: the exchange-rate message, then confirm again. |
| T-7 | AC-7 | `alex` | none | 100.00 to Maya Chen: code, result "On its way", balance drops. A "Test Sanctions" payee: "Held for review", ledger unchanged. |
| T-8 | AC-8, timeout | `alex` | `timeout: ["bank.payments.create"]`, `latencyMs: 10000` (planned) | Timeout screen; balance unchanged. |
| T-9 | AC-8, unavailable | `alex` | `unavailable: ["bank.payments.create"]` (planned) | "We couldn’t reach the bank. Nothing was sent."; balance unchanged. |

#### 10. Expected mutation-check survivors

The option `coolingOff` of this journey does not change anything in the prototype: the 500.00 rule is switched by the `coolingOff` option of `personal-transfer` (an inconsistency to fix). A mutant on the unused `QT.cool` helper survives for the same reason. The fixed 41,250.00 survives until `bank.limits.get` feeds it. The order of the speed cards survives when only presence is asserted.

---

### ★ Abroad — `international-transfer`

Catalog: `international-transfer`, workspace Personal, category Personal: Payments, core no, a bank can switch it off: yes (through option `type.intl` of `personal-transfer`). Options: none of its own.

Alias of `personal-transfer`: reached with `personal-transfer {type: international, country?}`. The option `type.intl` ("Offer “To another country”") switches it off. The old slug is kept only so older links open the right place.

What differs from the other types (full rules, scenarios and criteria are in `personal-transfer`):
- The payee form asks the country, the name, the country's identifier (IBAN or account number), a bank code for some countries, and the SWIFT / BIC code. A bank can add countries as data.
- The amount screen adds the purpose, and the address and relationship when the address rule applies; "Who pays the bank charges?" only when `chargeChoice` is on.
- Speeds: Standard (1 to 3 business days), and Priority (next business day) when it is on. Fees are in the home market table of `personal-transfer`. The rate is held for 60 seconds.
- There is no name check; the person confirms the details on the review.

---

### ★ Pay a bill — `pay-bill`

Catalog: `pay-bill`, workspace Personal, category Personal: Payments, core no, a bank can switch it off: yes. Options (key, label, default), all on: `billFetch` "Look up the amount due from the biller (off: the person types the amount)"; `allowPartial` "Allow the minimum and other amounts where the biller accepts them"; `allowCrossCurrency` "Allow paying a bill from an account in another currency"; `offerSaveBiller` "Offer to save the biller"; `offerAutopay` "Offer auto-pay after the payment".

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `pay-bill` |
| Purpose | Choose a biller from the bank's directory, enter the reference, see the bill, pay the full amount, the minimum or another amount, and get a receipt. The directory is the bank's own list of billers (synthetic names in the sandbox) in generic categories. |
| Release / workspace | 1 / Personal |
| Status | Existing, rebuilt lean and country-neutral. Built in the prototype (`design/bankworkx-r1/src/journeys/34-pay-bill.js`). Bills are in the bank's home currency; paying from another currency adds one rate line. No scheme and no country is named. |
| Channels | Web and mobile |
| Starting pattern | `fixtures/pay-bill.ts`; the directory, the lookup, the partial amounts and auto-pay are new. |
| Who may use it | `payments.create` |
| Shared reference | `09-payment-rails.md` (limits, FX). Billers are bank configuration. |

**Sandbox demo values.** Today is Tue 3 Nov 2026. The last four digits of the reference choose the outcome, so a tester can reproduce every state. Spaces and hyphens in the reference are ignored.

| Last four digits | Outcome |
|---|---|
| 1111 | "Biller unavailable" |
| 0000 | "No bill found" |
| 9999 (or a bill already paid in full) | "Already paid" |
| 5555 | "No bill due" |
| 7777 | Overdue: late fee of 5% added to the amount due, chip "Overdue", due date 9 days ago |
| 3333 | The amount due rises by 12.00 once, on the review: "The amount due changed. Check it and confirm again." |
| anything else | Amount due = (1000 + number mod 9000) / 20, due date (number mod 20) + 3 days ahead |

The directory (name, category, reference label, format, sample reference, what may be paid, fee): City Power (Electricity, Account number, 10 digits, 4400123456, any amount up to the amount due); Metro Water (Water, 10 digits, 3300456712, any); Summit Gas (Gas, 10 digits, 2200789012, any); Skyline Broadband (Internet and phone, 10 digits, 5550012345, any); ClearWave Telecom (Internet and phone, Phone number, 10 digits, 5550987654, any, fee 1.00); Northline Mobile (Mobile top-up, Mobile number, 10 digits, 5550123456, any); Harbor Insurance (Insurance, Policy number, "HI" and 8 digits, HI12345678, full amount only); Pioneer Life (Insurance, Policy number, 10 digits, 6600123478, full only); Northwind Card and Crest Card (Credit card, Card number, 16 digits, 1234567890123456 and 1234567890124567, full, minimum or other, the most is 1.8 times the amount due); Lakeside Home Loans (Loan, Loan number, 10 digits, 7700123456, full, minimum or other, fee 2.00); County Revenue (Tax and government, Reference number, 12 digits, 123456781234, full only); City Council (Tax and government, 10 digits, 8800123456, full only); Westbrook University (Education, Student number, 8 digits, 20261234, any); Greenfield School (Education, 8 digits, 20265678, any, fee 0.50); Riverside Community Club (Other, Member number, 8 digits, 30123456, any). The minimum for a card or loan is the smaller of the amount due and the larger of 10% of it and 10.00. Saved billers: "Home electricity" (City Power, 4400123456) and "Home internet" (Skyline Broadband, 5550012345). Account: Current ••4410, available 8,102.40. Daily limit left 41,250.00. Any six digits are accepted as the code.

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Home › + Pay a bill | none | `payments.create` |
| Payments › Pay a bill | none | `payments.create` |
| Payments › tracker › bill payment › Repeat payment | `{billerId, ref}` | `payments.create` |
| Saved biller row | `{billerId, ref}` | `payments.create` |

Launch values read: `billerId` (skips the choice of biller), `ref`.

#### 3. Screens

Steps in order: `biller`, `ref`, `amount`, `review`, code, receipt.

**Screen `biller`** ("Choose a biller"). Skipped when `billerId` was passed.

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| (search) | `text`, placeholder "Search billers", max 40. Filters as the person types by biller name and category | No | none | none |
| (category) | `chips`: All, Electricity, Water, Gas, Internet and phone, Mobile top-up, Insurance, Credit card, Loan, Tax and government, Education, Other | No | One of twelve | none |
| (list) | A small heading "Saved" with the saved billers (nickname, biller and last four of the reference), then "All billers" (name and category), sorted by category. Tapping a row goes on | Yes | A biller must be chosen | "Choose a biller." |

Empty: icon, "No billers found", "Try another name or category."

**Screen `ref`** ("Enter the reference"). A card shows the biller and its category, with a **Change** button (not when the biller was passed in). Button **Continue**, busy "Getting your bill…".

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| (the biller's label: Account number, Phone number, Mobile number, Policy number, Card number, Loan number, Reference number, Student number, Member number) | `text`, max 24; hint shows the format message | Yes | The biller's format (see the directory); spaces and hyphens ignored | "Enter the reference." and "Enter {n} digits." or "Enter HI followed by 8 digits." |
| (result card, inline) | `info` | n/a | Looked up as soon as the reference is valid | See below |

Result card under the field:

| State | Card |
|---|---|
| Bill found | Biller and "{label} {reference}", chip "Overdue" when late, "Amount due" with the amount, "Due {date}" |
| `billFetch` off | Biller name and "Enter the amount on the next screen." |
| Not found | "No bill found", "Check the reference and try again." |
| Paid | "Already paid", "There is nothing left to pay on this bill." |
| Nothing due | "No bill due", "Nothing to pay on this bill right now." |
| Biller down | "Biller unavailable", "Try again later." |

**Continue** is blocked ("Enter the reference." when empty, otherwise the card title) unless a bill is found or `billFetch` is off.

**Screen `amount`** ("Amount"). A card shows the biller and "Due {date}" (and an "Overdue" chip). No card when `billFetch` is off.

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| (how much) | `cards`: "Pay full amount" (the amount due), "Pay minimum" (cards and loans, with the minimum), "Other amount" ("From {min} to {max}" for cards and loans, otherwise "Up to {max}"). A biller that takes the full amount only shows only the first. The last two are dimmed when `allowPartial` is off. Not shown when `billFetch` is off (the person types the amount) | n/a | One of the cards | none |
| Amount | `amount`, prefix "$", placeholder "0.00". Shown for "Other amount" | Yes | At least the minimum (cards and loans); at most the maximum | "The minimum is {amount}." and "The most you can pay is {amount}." |
| From | `select`: accounts with name, last four, available. Accounts in another currency only when `allowCrossCurrency` is on | Yes | Enough money; within the daily limit | "Choose an account to pay from.", "Not enough in this account.", "That is over your daily limit." |

Live summary: Fee (when the biller charges one), Rate ("1 USD = {rate} {currency}", when paying from another currency), **You pay** in the account's currency. Before an amount: "Enter an amount."

**Screen `review`** ("Review"). Busy "Checking the amount…". Rows: Biller, {reference label}, Amount (with "Includes late fee {amount}" when overdue and paying in full), Fee, Rate and You pay (other currency), From, Date "Today". Two toggles: **Save this biller** (when `offerSaveBiller` is on and the biller and reference are not saved) and **Pay automatically** (when `offerAutopay` is on, the biller is in Electricity, Water, Gas, Internet and phone, Insurance, Credit card or Loan, and the amount came from a lookup).

**Code sheet.** Title "Authorise {amount} to {biller}"; sub "Code sent to ••• 4410." Submit button "Pay bill".

States:
- Loading: busy "Getting your bill…" and "Checking the amount…".
- Empty: "No billers found" as above.
- Error: the result card, the field messages, or a banner; timeout and unavailable in section 4.

#### 4. Sandbox errors

| Code | Message the person sees | Shows on | Button |
|---|---|---|---|
| `BILLER_NOT_FOUND` | "Choose a biller." | `biller` | Choose biller |
| `BILL_NOT_FOUND` | "No bill found. Check the reference and try again." | `ref` | Edit |
| `BILL_ALREADY_PAID` | "This bill is already paid." | `ref` | Back |
| `NO_AMOUNT_DUE` | "No bill due." | `ref` | Back |
| `BILLER_UNAVAILABLE` | "Biller unavailable. Try again later." | `ref` | Try again |
| `BILL_CURRENCY_MISMATCH` | "Choose an account in the same currency as the bill." | `amount` | Choose account |
| `INVALID_REFERENCE` | "Check the reference." | `ref` | Edit |
| `AMOUNT_BELOW_MINIMUM` | "That is below the minimum." | `amount` | Change amount |
| `AMOUNT_ABOVE_DUE` | "That is more than the amount due." | `amount` | Change amount |
| `INSUFFICIENT_FUNDS` | "Not enough in the account. Nothing was paid." | `amount`, code sheet | Change amount |
| `DAILY_LIMIT_EXCEEDED` | "That is over your daily limit." | `amount` | Change amount |
| `BILL_CHANGED` | "The amount due changed. Check it and confirm again." | `review` | Confirm again |
| `STEP_UP_FAILED` | "We couldn’t confirm this payment. Nothing was paid. Start again." | code sheet | Start again |
| `TIMEOUT` (planned) | "We didn’t get an answer in time. Check Activity before you try again, so you don’t pay twice." | `timeout` | Check Activity |
| `SERVICE_UNAVAILABLE` (planned) | "We couldn’t reach the bank. Nothing was paid." | `unavailable` | Try again |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `billers` | `bank.billers.list` | `{category?, q?}` | billers `{id, name, category, label, format, accepts, fee}` | none | Existing |
| `lookup` | `bank.bills.lookup` | `{billerId, reference}` | `{due, min, max, date, late, holder}` | `BILL_NOT_FOUND`, `BILL_ALREADY_PAID`, `NO_AMOUNT_DUE`, `BILLER_UNAVAILABLE` | Existing |
| `pay` | `bank.bills.pay` | `{billerId, reference, amount, fromAccountId}` | `{reference, paid, left}` | `AMOUNT_BELOW_MINIMUM`, `AMOUNT_ABOVE_DUE`, `INSUFFICIENT_FUNDS`, `BILL_CHANGED` | Existing |
| `saved` | `bank.bills.saved` | none, or `{billerId, reference, nickname}` to save | saved billers | none | (planned) |
| `accounts` | `bank.accounts.list` | none | accounts | none | Existing |
| `limits` | `bank.limits.get` | `{currency?}` | `{daily, usedToday}` | `LIMIT_NOT_SET` | Existing |
| `autopay` | `bank.schedules.create` | see `schedule-payment` | schedule | see `schedule-payment` | (planned) |
| `otpSend`, `otpVerify` | `bank.otp.send`, `bank.otp.verify` | `{channel}`, `{code}` | `{sent, maskedPhone}`, `{verified}` | `OTP_INVALID` | Existing |

In the prototype the directory is the constant `PB_LIST`, the lookup is `pbFetch` (the last four digits above), saved billers and part-paid state live on `D.pbx`, and no adapter is called.

#### 6. Permissions, step-up and limits

`payments.create`. Step-up `otp` on every bill payment. The daily limit (41,250.00 left in the demo) is tested on the value of amount plus fee. Billers have no new-payee rule. Business workspace: `WRONG_CONTEXT`.

#### 7. Result and links out

Result: title "Bill paid"; text "{amount} to {biller}."; chip "Paid". Receipt rows: Biller, {reference label}, Amount, Fee, Rate and You paid (other currency), From, Date, Next automatic payment (when auto-pay was turned on). The balance falls and a transaction named after the biller appears in Activity, category Bills. A part-paid bill remembers what is left; a bill paid in full shows "Already paid" next time. If **Save this biller** was on, the biller is saved under its name. **Pay automatically** creates a monthly entry in Payments › Scheduled (full bill, never more than 1.5 times the amount due rounded up to 10, starting a month after the due date on a business day) that the customer can change or cancel with `schedule-payment`. Notification (planned): "Bill paid: {biller} {amount}. Ref {reference}." Buttons: **Pay another bill**, **View in Payments**.

#### 8. Acceptance criteria

- AC-1: The directory lists billers by category, filters by search and category, shows saved billers first, and shows "No billers found" when nothing matches.
- AC-2: The reference is checked against the biller's format; a wrong format shows the biller's message; spaces and hyphens are ignored.
- AC-3: The lookup shows the amount due, the due date and an "Overdue" chip when late, and shows the right card for not found, paid, nothing due and biller unavailable; **Continue** is blocked in those states.
- AC-4: Full amount is always offered; minimum only for cards and loans; other amount only where the biller accepts it, with the limits "From {min} to {max}" or "Up to {max}"; an amount outside them is refused with the message in section 3; both are dimmed when `allowPartial` is off.
- AC-5: Paying from an account in another currency shows the rate and "You pay" in that currency, only when `allowCrossCurrency` is on; the fee of the biller is shown separately.
- AC-6: Not enough money or an amount over the daily limit is refused before the review with the messages in section 3.
- AC-7: If the amount due changes between the lookup and the review, the review shows "The amount due changed. Check it and confirm again." once, with the new amount.
- AC-8: A one-time code that names the amount and biller confirms the payment; three wrong codes fail with the step-up message and nothing is paid.
- AC-9: After a partial payment the next lookup shows what is left; after payment in full it shows "Already paid".
- AC-10: **Save this biller** and **Pay automatically** appear only when their options are on, **Pay automatically** only for the listed categories, and each does what section 7 says.
- AC-11: With `billFetch` off the person types the amount and no lookup is made.
- AC-12: On timeout nothing is paid and the person is told to check Activity first; when the bank is unavailable nothing is paid.

#### 9. Scenarios

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1 | `alex` | none | Open Pay a bill: saved billers first, then all; search "water" shows Metro Water; search "zzz": "No billers found". |
| T-2 | AC-2 | `alex` | none | City Power, reference `12345`: "Enter 10 digits." Harbor Insurance, `12345678`: "Enter HI followed by 8 digits." Reference `4400 1234-56` is accepted. |
| T-3 | AC-3 | `alex` | none | References ending 1111, 0000, 9999, 5555: "Biller unavailable", "No bill found", "Already paid", "No bill due"; **Continue** blocked. Ending 7777: "Overdue" and a late fee of 5%. |
| T-4 | AC-4 | `alex` | none | Northwind Card, `1234567890123456`: three cards; choose "Other amount" and enter 1.00: "The minimum is …"; above 1.8 times the due: "The most you can pay is …". Harbor Insurance: only "Pay full amount". With `allowPartial` off: minimum and other are dimmed. |
| T-5 | AC-5 | `alex` | none | Pay City Power from the Euro account: Rate and "You pay" in EUR. With `allowCrossCurrency` off the Euro account is not listed. ClearWave Telecom shows Fee 1.00. |
| T-6 | AC-6 | `alex` | none | An amount above the available balance: "Not enough in this account." An amount above 41,250.00: "That is over your daily limit." |
| T-7 | AC-7 | `alex` | none | Reference ending 3333: the review shows "The amount due changed. Check it and confirm again." with 12.00 more; confirm again goes to the code. |
| T-8 | AC-8 | `alex` | wrong code three times (planned in the prototype) | "We couldn’t confirm this payment. Nothing was paid. Start again." Balance unchanged. |
| T-9 | AC-9 | `alex` | none | Pay half of a bill: result "Bill paid"; look up the same reference: the amount due is the rest. Pay the rest: next lookup shows "Already paid". |
| T-10 | AC-10 | `alex` | none | Review for City Power: both toggles shown. For County Revenue: no "Pay automatically". With `offerSaveBiller` off: no "Save this biller". Pay with auto-pay on: "Next automatic payment" in the receipt and a monthly entry in scheduled payments. |
| T-11 | AC-11 | `alex` | `billFetch` off | The reference screen shows "Enter the amount on the next screen."; the amount screen asks only for an amount. |
| T-12 | AC-12, timeout | `alex` | `timeout: ["bank.bills.pay"]`, `latencyMs: 10000` (planned) | Timeout screen with "Check Activity before you try again, so you don’t pay twice"; balance unchanged. |
| T-13 | AC-12, unavailable | `alex` | `unavailable: ["bank.bills.pay"]` (planned) | "We couldn’t reach the bank. Nothing was paid." with **Try again**; balance unchanged. |

#### 10. Expected mutation-check survivors

The sample references, the late-fee percentage and the 1.8 card maximum survive until the lookup comes from `bank.bills.lookup`. The order of the categories and billers survives when only presence is asserted. The prefix "$" on the amount field is fixed in the prototype and survives until the bank's home currency feeds it (planned). The rule that auto-pay is offered only for some categories survives when no scenario tries every category. The random generation of the transaction id survives.

---
### ★ Mobile top-up — `mobile-topup`

**Catalog:** slug `mobile-topup`, workspace `personal`, category Payments (Personal: Payments), core no, can a bank switch it off: yes (a basic entry, kept in the Lean preset). Options: **Let people save numbers** (`saveNumbers`, default on). Research: `research/mobile-topup.md`. Built in `design/bankworkx-r1/src/journeys/61-topup-card-extras.js`.

There is no bundle or data-plan choice and no free-amount field. The operators are a generic list that stands for the bank’s own directory; the number format follows the bank’s home market. No screen names a country or a real operator.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `mobile-topup` |
| Purpose | Add credit to a mobile number: choose the operator, the number, an amount and the account to pay from. |
| Release / workspace | 1 / Personal |
| Status | Built in the prototype as a form journey (`submit: "Top up"`, `money: true`, `confirm` with a code, `call` at review). Test parameter `{operatorId: "aster"}`. |
| Channels | Web and mobile |
| Starting pattern | Operator, number, amount, account, review with a number check, a code, a result |
| Who may use it | `payments.create` |

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Home › + Top up | none | `payments.create` |
| Payments › Mobile top-up | none | `payments.create` |
| Deep link `/personal/j/mobile-topup?operatorId=aster` | `{operatorId}` (`aster`, `bright` or `cobalt`; skips the operator step) | `payments.create` |

#### 3. Screens

**Screen 1 `op`: Choose your operator** (skipped when `operatorId` is passed). Choice cards: "Aster Mobile", "Brightline", "Cobalt Wireless". Changing the operator clears the number and the amount.

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Operator | choice cards | yes | one of the list | "Choose an operator." |

**Screen 2 `num`: Mobile number.** A card shows the operator (with **Change** unless the operator was passed in). Saved numbers for that operator whose format is valid are offered as cards (name and "•••• {last 4}") plus "Another number". Sample numbers: "My phone" and "Maya" with Aster Mobile, "Lena" with Brightline. With no saved number the number field shows at once.

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Saved number | choice cards (shown when there is a saved number for this operator) | yes | one choice | "Choose a number." |
| Mobile number | phone, placeholder follows the market (shown with no saved number or after "Another number") | yes | the market format below; spaces, brackets and hyphens are ignored | the market message below |

**Screen 3 `amt`: Choose an amount.** Choice cards of fixed amounts for the chosen operator: Aster Mobile $5, $10, $20, $50; Brightline $10, $20, $30, $50; Cobalt Wireless $5, $10, $25, $100.

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Amount | choice cards | yes | one of the list | "Choose an amount." |

**Screen 4 `from`: Pay from.** One select of the customer’s dollar accounts, each as "{name} ••{last4} · {available}".

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Account | select | yes | chosen | "Choose an account to pay from." |
| | | | amount not above the available balance | "Not enough in this account." |

**Screen 5 `review`: Review.** Rows Operator, Number ("•••• {last 4}"), Amount, From ("{name} ••{last4}"). Optional, when `saveNumbers` is on and the number is not saved yet: switch "Save this number" and, when on, a text field "Name" (up to 20 characters, placeholder "For example, Mum"; "Use at least 2 characters." when 1 character). Pressing the button shows "Checking the number…" for about 0.6 seconds and checks the number and the daily limit.

**Screen 6 `confirm`: Authorise {amount} top-up.** The standard code sheet: "Code sent to ••• 0142." (6 digits). Wrong code: "That code isn’t right. Try again." The button is **Top up**.

**Result** (green). Title "Top-up sent", text "{amount} added to •••• {last 4}.", status "Completed". Rows Operator, Number, Amount, From, Date ("3 Nov 2026"). Button **Top up again**. The payment shows in the activity list in the category Bills as "{operator} top-up".

**States**
- Loading: "Checking the number…" at review, a spinner on the code step.
- Empty: not applicable.
- Error: unavailable shows "This isn’t available right now. Nothing was changed. Try again in a few minutes."; timeout shows "We didn’t get an answer in time. Check Activity before you try again, so you don’t pay twice." Both with a button to retry or check Activity.
- Stale: the balance is checked again when the code is entered; if it is too low: "Not enough in this account."

**Home market configuration** (the number rule only; amounts and operators are the same everywhere)

| Market | Number rule | Message | Placeholder | Sample |
|---|---|---|---|---|
| Market A (routing number and account) | 10 digits | "Enter the 10-digit number." | "10 digits" | 5550123456 |
| Market B (sort code and account) | 11 digits starting 07 | "Enter 11 digits, starting 07." | "07…" | 07700900123 |
| Market C (IBAN) | 8 to 12 digits | "Enter 8 to 12 digits." | "8 to 12 digits" | 15112345678 |
| Market D (IBAN, mobile alias) | 10 digits starting 05 | "Enter 10 digits, starting 05." | "05…" | 0501234567 |

#### 4. Sandbox errors

Codes are for tests and the sandbox; the customer sees only the message.

| Code | Message | Shows on | Button |
|---|---|---|---|
| `NUMBER_NOT_FOUND` | "We can’t top up this number. Check it and try again." | review (a number ending 0000) | Change number |
| `OPERATOR_UNAVAILABLE` | "The operator isn’t available right now. Try again later." | review (a number ending 1111) | Try again |
| `TOPUP_LIMIT` | "You’ve reached today’s top-up limit for this number." | review, commit | Change amount |
| `INSUFFICIENT_FUNDS` | "Not enough in this account." | from, commit | Change account |
| `OTP_INVALID` | "That code isn’t right. Try again." | code | Try again |
| `TIMEOUT` | "We didn’t get an answer in time. Check Activity before you try again, so you don’t pay twice." | review, code | Check Activity |
| `SERVICE_UNAVAILABLE` | "This isn’t available right now. Nothing was changed. Try again in a few minutes." | the step | Try again |
| `JOURNEY_DISABLED` | "This isn’t available at your bank." | whole journey | none |
| `PERMISSION_DENIED` (planned) | Standard message | whole journey | Back |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `carriers` | `bank.carriers.list` | none | operators and their amounts | none | Existing (`packages/mock-bank-api/src/index.ts`) |
| `accounts` | `bank.accounts.list` | none | map of accounts | none | Existing |
| `checkNumber` | `bank.topup.check` | `{operatorId, number, amount}` | `{ok}` | `NUMBER_NOT_FOUND`, `OPERATOR_UNAVAILABLE`, `TOPUP_LIMIT` | (planned). The prototype checks the number and the limit itself |
| `createTopup` | `bank.topup.create` | `{operatorId, number, amount, fromAccountId}` | `{reference, newBalance}` | `OTP_REQUIRED`, `INVALID_AMOUNT`, `ACCOUNT_NOT_FOUND`, `INSUFFICIENT_FUNDS`, `LIMIT_EXCEEDED`, `CORE_UNAVAILABLE` | Existing. Its amount rule (50 to 5,000) is for a different currency and must change to the fixed list |
| `savedNumbers` | `bank.topup.numbers` | none | saved numbers | none | (planned) |
| `sendOtp` / `verifyOtp` | `bank.otp.send` / `bank.otp.verify` | `{channel}` / `{code}` | `{sent}` / `{verified}` | `OTP_INVALID` | Existing |

#### 6. Permissions, step-up and limits

`payments.create`. Step-up: one-time code (6 digits, 3 tries) for every top-up. Limits: the amount must be one of the operator’s fixed amounts; at most $300.00 a day to one number; the account’s available balance.

#### 7. Result and links out

Result as above. Notifications raised (planned): "{amount} added to the number ending {last 4}". The payment is written to activity and to the audit log. Links out: Activity; `mobile-topup` again.

#### 8. Acceptance criteria

- AC-1: Only the operator’s own amounts can be chosen.
- AC-2: The number must match the home market rule, with the market message; spaces, brackets and hyphens are ignored.
- AC-3: Saved numbers for the chosen operator are offered; "Another number" shows the number field.
- AC-4: A top-up that would take one number above $300.00 for the day is refused with "You’ve reached today’s top-up limit for this number."
- AC-5: An amount above the available balance is refused with "Not enough in this account." and nothing is taken.
- AC-6: A wrong code takes no money; the right code takes the amount once, adds it to the activity list and shows "Top-up sent".
- AC-7: With `saveNumbers` on, "Save this number" appears for a new number and adds it with the name given; with it off the switch is absent.
- AC-8: A number ending 0000 or 1111 is refused at review with the messages above.
- AC-9: With `operatorId` passed the operator step is skipped and **Change** is not shown.
- AC-10: On timeout the person is told to check Activity first; when the bank is unavailable nothing is taken.

#### 9. Scenarios

Synthetic persona `alex` with Current ••4410 ($8,102.40 available). The home market is Market A unless stated. The sandbox code is the fixed test code.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-6 | `alex` | none | Aster Mobile, "My phone", $20, Current, code: "Top-up sent", "$20.00 added to •••• 3456."; balance falls by $20.00. |
| T-2 | AC-2 | `alex`, "Another number" | none | "12345": "Enter the 10-digit number."; "(555) 012-3456" is accepted. In Market B "0712345678" gives "Enter 11 digits, starting 07." |
| T-3 | AC-3 | `alex` | none | Aster Mobile offers "My phone" and "Maya"; Brightline offers "Lena". |
| T-4 | AC-4 | `alex`, six $50 top-ups to one number, then one more $50 | none | The next review says "You’ve reached today’s top-up limit for this number." |
| T-5 | AC-5 | `alex`, an account with $4 available | none | $5 gives "Not enough in this account." |
| T-6 | AC-6 | `alex` | none | Wrong code: "That code isn’t right. Try again." and no money moves. |
| T-7 | AC-7 | `alex`, `saveNumbers` on, then off | none | New number: switch and Name shown; saved as "Family"; with the option off no switch. |
| T-8 | AC-8 | `alex`, number ending 0000, then 1111 | none | "We can’t top up this number. Check it and try again."; "The operator isn’t available right now. Try again later." |
| T-9 | AC-9 | `alex`, `operatorId: "aster"` | none | Starts at the number step; no **Change**. |
| T-10 | AC-10 | `alex` | `unavailable: ["bank.topup.create"]` (prototype: Service down on) | The connection sheet shows; no money moves. |
| T-11 | AC-10 | `alex` | `timeout: ["bank.topup.create"]`, `latencyMs: 10000` | After 10 seconds "We didn’t get an answer in time. Check Activity before you try again, so you don’t pay twice." |

#### 10. Expected mutation-check survivors

The "not above the balance" check at the account step survives because the commit checks it again; expected. The daily limit at review survives for the same reason. The save-number name length survives if the sandbox does not assert saved names; expected. Everything else: none expected.

---

### ★ Add, edit or delete a payee — `manage-beneficiary`

Catalog: `manage-beneficiary`, workspace Personal, category Personal: Payments, core no, a bank can switch it off: yes. Options (key, label, default): `nameCheck` "Run the name check" (on; the prototype label still names two schemes); `allowCancelSchedules` "Let a person cancel scheduled payments while deleting a payee" (on); `labels` "Offer payee labels (Family, Friend, Landlord…)" (on).

**Neutral standard and prototype gap.** This block is written to the country-neutral standard: the payee form asks the same fields as `personal-transfer` (by the bank's home market and by country), and no screen names a country or a scheme. The prototype file (`design/bankworkx-r1/src/journeys/31-manage-beneficiary.js`) was not changed in the lean rework and still shows country and scheme names: a "Where is the account?" choice with four named regions, a type card sub-line that lists regions, an "Other countries" sub-line that names a network, scheme names in the routing number and bank code labels, a name-check chip named after the national scheme, an error that names a payment area, a line about banks of one country, and error codes in brackets after some messages. These are listed in section 10 as a planned fix. Where this block says "neutral wording", that is the target text.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `manage-beneficiary` |
| Purpose | Save a payee, change one, or remove one. A new or changed payee is checked (name check where the market has one), gets a 24-hour limit, and is confirmed with a code. Deleting asks for no code and warns about scheduled payments that use the payee. |
| Release / workspace | 1 / Personal |
| Status | Existing, rebuilt. Built in the prototype (`design/bankworkx-r1/src/journeys/31-manage-beneficiary.js`); see the gap above. Research: `research/manage-beneficiary.md`. |
| Channels | Web and mobile |
| Starting pattern | `fixtures/local-transfer.ts` (payee fields); the name check and the edit rules are new. |
| Who may use it | `payments.create` |
| Shared reference | `personal-transfer` for the field rules and the "Home market configuration" table; `09-payment-rails.md` for the identifier and check rules. |

**Sandbox demo values.** BankWorkx® customers (account numbers): 3301123308 Taylor Brooks, 3301554412 Jordan Keller. Saved payees: Maya Chen, Lena Fischer, James Whitfield, Omar Haddad. James Whitfield is used by the scheduled payment "Rent"; "Savings top-up" has no payee. Limit 50 payees. The button **Fill with a sample payee** (test mode) fills the form with a synthetic payee. A payee added or changed with new bank details is "New · 24 hours left" and limited to 500.00. Any six digits are accepted as the code.

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Payments › Beneficiaries › Add | `{mode: add}` | `payments.create` |
| Payments › Beneficiaries › row › Edit or Delete | `{mode, beneficiaryId}` | `payments.create` |
| Any transfer › New payee | `{mode: add, kind, returnTo}` (returns to the same screen) | `payments.create` |
| Payments › Beneficiaries (no mode) | none: the first screen asks | `payments.create` |

#### 3. Screens

Steps in order: `mode`, `pick`, `type`, `details`, `check`, `review`, or `delete`. A step that does not apply is skipped.

**Screen `mode`** ("What would you like to do?"). Shown only when no mode was passed.

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| I want to | `chips`: Add a payee, Edit a payee, Delete a payee | No | One of three | none |

**Screen `pick`** ("Choose a payee"). Edit and delete without a given payee. Intro "Pick the person you want to change."

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| Saved payees | `cards`: nickname and name, a line with the type, masked account and label, and a chip ("New · {n} hours left", "Verified" or "Saved") | Yes | One of the cards | "Choose a payee." |

Empty: icon, "You haven’t saved anyone yet", "Add someone to pay them in two taps."

**Screen `type`** ("Who do you want to pay?"). Add, when the kind was not given.

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| Type of payee | `cards`: "BankWorkx® customer" ("Free and instant"), "Another bank", "Another country" | Yes | One of three | "Choose a type." |

**Screen `details`** ("Their details"). Button **Check details**, busy "Checking the details…". On edit, a note at the top: "If you change the name or the account details, we check the payee again and {name} counts as a new payee for 24 hours. You can send up to $500.00 in that time. Changing only the nickname or label does neither."

| Field | Shown when | Block | Required | Validation | Message |
|---|---|---|---|---|---|
| BankWorkx® account number | BankWorkx® customer | `text`, 10 digits | Yes | 10 digits that match a customer. A match shows "✓ Found: {first name} {initial}. · ••{last4}" | "Enter the 10-digit BankWorkx® account number." and "We can’t find a BankWorkx® account with that number. Check it and try again." |
| Name on the account | another bank or country | `text`, placeholder "As it appears on their bank account", max 70 | Yes | At least 2 characters | "Enter the name on the account." |
| Nickname | always | `text`, placeholder "Optional, for example “Mum”", max 24, hint "Up to 24 characters. Only you see it." | No | 24 characters or fewer | "Use 24 characters or fewer." |
| Label | `labels` on | `chips`: Family, Friend, Landlord, Business, Other | No | One of five | none |
| Identifier fields | another bank | As the "To another bank" table of `personal-transfer` for the home market | Yes | As there | As there |
| Country, name, account or IBAN, bank code, SWIFT / BIC | another country | As the "To another country" table of `personal-transfer` | Yes | As there | As there |

Rules on **Check details**: a new payee over the limit of 50: "You can save up to 50 payees. Delete one to add another." A payee with the same account details already saved: "You already saved this payee with these details." A BankWorkx® customer's name is filled from the customer record.

**Screen `check`** ("Check the payee"). Shown for add, and for edit when name or account details changed. A card with a chip "Name check" and the result:

| Result | Text |
|---|---|
| Match | "✓ The name matches" and "The account is held by {name}. It’s safe to continue." |
| Close | "The name is close, but not exact" and "The account is held by {registered name}. You typed {name}. Check with them before you send money." Button **Use “{registered name}”** |
| No match | "The name doesn’t match" and "The account is held by someone else. If you go on, money may go to the wrong person and might not be recoverable." |
| Not available | "We couldn’t check this name" and "The receiving bank doesn’t support name checks for this account. Only continue if you trust {name}." (neutral wording) |

Below: Name and Account rows. A tick "I understand and want to continue" for every result except a match; **Continue** is blocked with "Check the payee before you continue." until it is ticked. With `nameCheck` off the result is "Not available".

**Screen `review`** ("Check before you save"). A notice: "For your security, you can send up to $500.00 to a new payee in the first 24 hours." Rows: Type, Region (neutral: omitted), Name, Nickname, Label, Account, Bank (when known), Name check (Matches, Close, you continued, Doesn’t match, you continued, Couldn’t be checked, Not repeated). Required tick: "I confirm these details are correct and I know this person" ("Tick to confirm."). Button **Save and send code** (edit with only a nickname or label change: **Save changes**, no code).

**Screen `delete`** ("Delete payee"). A card with the payee and "You won’t be able to send money to {name} from your saved list. Payments already sent are not affected." If scheduled payments use the payee, a second card lists them (name, how often, amount). With `allowCancelSchedules` on, a toggle "Also cancel these scheduled payments" (sub "They will not run again. Payments already sent are not affected."); otherwise the text "Cancel these in Payments › Scheduled first." The step is blocked with "{name} is used by {n} scheduled payment(s). Cancel it first." until the toggle is on. Button **Delete payee**. Missing payee: "Payee not found", "We can’t find that payee."

**Code sheet.** Title "Authorise saving {name}"; sub "Code sent to ••• 4410. It only works for this change." Not asked for delete, nor for an edit that changes only the nickname or label.

States: loading is the busy text on **Check details**; empty as listed; errors under the field or on the step; timeout and unavailable in section 4.

#### 4. Sandbox errors

| Code | Message the person sees | Shows on | Button |
|---|---|---|---|
| `PAYEE_NAME_REQUIRED` | "Enter the name on the account." | `details` | Edit |
| `CUSTOMER_NOT_FOUND` | "We can’t find a BankWorkx® account with that number. Check it and try again." | `details` | Edit |
| `INVALID_IBAN`, `INVALID_ROUTING`, `INVALID_SORT_CODE`, `INVALID_ACCOUNT`, `INVALID_BIC` | The field messages in `personal-transfer` section 3 | `details` | Edit |
| `COUNTRY_MISMATCH` | "That IBAN doesn’t start with the country you chose." | `details` | Edit |
| `PAYEE_NOT_CHECKED` | "Check the payee before you continue." | `check` | Back |
| `BENEFICIARY_EXISTS` | "You already saved this payee with these details." | `details` | Edit |
| `BENEFICIARY_LIMIT` | "You can save up to 50 payees. Delete one to add another." | `details` | Back |
| `BENEFICIARY_NOT_FOUND` | "We can’t find that payee." | `pick`, `delete` | Back |
| `BENEFICIARY_IN_USE` | "This payee is used by a scheduled payment. Cancel it first." | `delete` | Back |
| `STEP_UP_FAILED` | "We couldn’t confirm this change. Nothing was saved. Start again." | code sheet | Start again |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | `timeout` | Try again |
| `SERVICE_UNAVAILABLE` | "We couldn’t reach the bank. Nothing was changed." | `unavailable` | Try again |

`NOT_SEPA` is replaced by "That IBAN can’t be used for this payment." (the prototype still words it with a region name).

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `payees` | `bank.beneficiaries.list` | none | map with `ageHours` | none | Existing |
| `validate` | `bank.payees.validate` | `{type, country?, fields}` | `{ok, fieldErrors, bankName?}` | field codes | (planned, 09 section 13) |
| `check` | `bank.payees.check` | `{name, account key, accountType?}` | `{result: "match"\|"close"\|"none"\|"na", registeredName?}` | `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned) |
| `save` | `bank.payees.save` | `{type, fields, checkResult, acknowledged}` | `{payeeId, addedAt, coolingOffUntil}` | the validate codes, `PAYEE_NOT_CHECKED`, `BENEFICIARY_EXISTS`, `BENEFICIARY_LIMIT` | (planned) |
| `update` | `bank.payees.update` | `{payeeId, fields}` | `{payeeId, addedAt}` | as save, `BENEFICIARY_NOT_FOUND` | (planned) |
| `delete` | `bank.payees.delete` | `{payeeId, cancelSchedules?}` | `{cancelled}` | `BENEFICIARY_NOT_FOUND`, `BENEFICIARY_IN_USE` | (planned) |
| `otpSend`, `otpVerify` | `bank.otp.send`, `bank.otp.verify` | `{channel}`, `{code}` | `{sent, maskedPhone}`, `{verified}` | `OTP_INVALID` | Existing |

The prototype keeps payees in the demo list `D.ben` with `kind` ("bwx" for a BankWorkx® customer), `nick`, `label`, `ver` (name check matched) and `age` (hours since added or changed); no adapter is called. The BankWorkx® directory is the constant `MB_BWX`.

#### 6. Permissions, step-up and limits

`payments.create`. Step-up `otp` to save or to change bank details or the name (the code names the payee); `none` to delete and to change only the nickname or label (stated reason: they cannot send money anywhere new). Up to 50 payees. A new or changed payee is limited to 500.00 in 24 hours (rule A at the top of this group). The name check runs when the market has one and `nameCheck` is on. Business workspace: `WRONG_CONTEXT`.

#### 7. Result and links out

| Case | Title | Chip | Text and rows |
|---|---|---|---|
| Added | "Saved" | "Verified" or "Saved" | "{name} is saved as {Verified or Saved}. For your security you can send up to $500.00 in the first 24 hours." Rows: Payee, Account, Bank, Name check, Limit |
| Edited, details changed | "Changes saved" | "Checked again" | "{name} is a new payee again for 24 hours. You can send up to $500.00 in that time." Rows: Payee, Account, Name check, Limit |
| Edited, nickname or label only | "Changes saved" | "Saved" | "{name} was updated." Rows: Payee, Account, Name check "Not repeated" |
| Deleted | "Payee deleted" | "Deleted" | "{name} was removed from your payees." Rows: Payee, Account, Scheduled payments cancelled |

Buttons: **Send money** (opens `personal-transfer` for a BankWorkx® customer, `single-transfer` for another saved payee, with `{payeeId}`), **Back to the payment** (when opened from a payment) or **Payments**. Notification N-29b "Payee added, changed or deleted".

#### 8. Acceptance criteria

- AC-1: Add asks the type first (unless given), then the fields of that type, and refuses an unknown BankWorkx® account number, a duplicate and a 51st payee.
- AC-2: The fields, validations and messages for another bank and another country are those of `personal-transfer`, and no screen names a country or a scheme (the prototype gap in section 10 closes).
- AC-3: Add and edit-with-new-details run the name check and show its result; a result other than a match needs the tick before going on; with `nameCheck` off the result is "Not available".
- AC-4: A new or re-checked payee is "New · {n} hours left" and the review and result say it is limited to 500.00 for 24 hours.
- AC-5: Editing only the nickname or label asks for no check and no code and keeps the payee's age.
- AC-6: Deleting a payee used by a scheduled payment is blocked until the person turns on "Also cancel these scheduled payments" (when `allowCancelSchedules` is on); deleting asks for no code.
- AC-7: A code that names the payee confirms a save; three wrong codes fail with the step-up message and nothing is saved.
- AC-8: On timeout or when the bank is unavailable, nothing is changed and the person is told so.

#### 9. Scenarios

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1 | `alex` | none | Add, BankWorkx® customer, number 3301123308: "✓ Found: Taylor B. · ••3308". An unknown number: "We can’t find a BankWorkx® account with that number. Check it and try again." |
| T-2 | AC-1 | `alex` | 50 payees saved | **Check details**: "You can save up to 50 payees. Delete one to add another." Adding an existing payee's details: "You already saved this payee with these details." |
| T-3 | AC-2 | `alex`, each market | none | Add, another bank: the fields match the `personal-transfer` table for the market; invalid values show the exact field messages. |
| T-4 | AC-3 | `alex` | none | Another bank with a close name: "The name is close, but not exact", **Use**; **Continue** blocked until the tick. A match needs no tick. |
| T-5 | AC-3 | `alex` | `nameCheck` off | "We couldn’t check this name"; the tick is required. |
| T-6 | AC-4 | `alex` | none | Save a payee: result "Saved" with the 500.00 text; the payee shows "New · 24 hours left". |
| T-7 | AC-5 | `alex` | none | Edit Maya Chen's nickname: button **Save changes**, no code, age unchanged. Edit the account number: **Save and send code**, "Checked again", age 0. |
| T-8 | AC-6 | `alex` | none | Delete James Whitfield: blocked "James Whitfield is used by 1 scheduled payment. Cancel it first."; turn on the toggle; delete without a code; "Scheduled payments cancelled 1". |
| T-9 | AC-6 | `alex` | `allowCancelSchedules` off | The toggle is absent and the text "Cancel these in Payments › Scheduled first." shows. |
| T-10 | AC-7 | `alex` | wrong code three times (planned in the prototype) | "We couldn’t confirm this change. Nothing was saved. Start again." |
| T-11 | AC-8, timeout | `alex` | `timeout: ["bank.payees.save"]`, `latencyMs: 10000` (planned) | "This is taking longer than expected. Nothing was changed." with **Try again**; the list is unchanged. |
| T-12 | AC-8, unavailable | `alex` | `unavailable: ["bank.payees.save"]` (planned) | "We couldn’t reach the bank. Nothing was changed." with **Try again**. |

#### 10. Expected mutation-check survivors

The prototype gap survives as a known difference: the region choice, the region-named labels, the check-chip names and the codes in brackets are still in `31-manage-beneficiary.js` (planned fix to the neutral standard). The sample payees survive. The label list order and the 24-character nickname limit survive when no scenario tries 25 characters. The fixed `MB_BWX` directory survives until `bank.payees.lookup` feeds it. The prototype asks a BankWorkx® account number while `personal-transfer` finds by mobile, email or ID; aligning them is planned.

---

### ★ Schedule a payment — `schedule-payment`

Catalog: `schedule-payment`, workspace Personal, category Personal: Payments, core no, a bank can switch it off: yes. Options (key, label, default): `allowOwn` "Allow schedules between own accounts" (on); `allowBills` "Allow scheduling a saved bill (full bill or minimum due)" (on); `allowSkip` "Offer “skip only the next payment” when cancelling" (on); `insufficientFundsPolicy` "If there is not enough money, retry once on the next business day (off: skip and notify)" (off); `reminder` "Send one reminder the day before each payment" (on); `strictCutoff` "Close changes at 09:00 the business day before (default 18:00)" (off). The earlier options for closed days (`allowPrevDay`) and for the retry (`allowRetry`) are removed.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `schedule-payment` |
| Purpose | Pay a payee, one of the customer's own accounts, or a saved bill on a future date or on a repeat (once, weekly, every 2 weeks, monthly, every 3 months), with an end rule and a reminder. The same journey changes a schedule (mode `edit`) and cancels or skips one (mode `cancel`). |
| Release / workspace | 1 / Personal |
| Status | Existing, rebuilt lean. Built in the prototype (`design/bankworkx-r1/src/journeys/35-schedule-payment.js`; helpers from `34-pay-bill.js`). Dates are business days, Monday to Friday, with no regional calendars or holidays. `cancel-standing-order` is an alias (below). |
| Channels | Web and mobile |
| Starting pattern | `fixtures/local-transfer.ts` for the payee; the schedule form and the cut-off are new. |
| Who may use it | `payments.schedule` |
| Modes and launch parameters | New: no parameters (optional `payeeId` or `savedBillId` fill "To"). Change: `{scheduleId}` (mode `edit` is the default when a `scheduleId` is given). Cancel or skip: `{scheduleId, mode: "cancel"}`. |
| Shared reference | `09-payment-rails.md` (limits, FX). The speed and rail for each run are chosen by the bank when the payment runs (planned; the prototype records the schedule only). |

**Rules that are the same in every mode.** Nothing is taken when the schedule is made. On each date the bank checks the balance, the limits and the payee again and pays (planned; the prototype does not run schedules). If there is not enough money on the day the payment is skipped and the customer is told; with `insufficientFundsPolicy` on it is tried once more on the next business day. One reminder goes the day before when `reminder` is on. Changing or cancelling is possible until 18:00 on the business day before the next payment (09:00 with `strictCutoff` on). On the payment day the schedule is "Running now" and cannot be changed. A person can have up to 20 active schedules.

**Frequencies and limits.** Once; Weekly (up to 104 payments); Every 2 weeks (up to 52); Monthly (up to 60); Every 3 months (up to 40). Monthly and every-3-months runs keep the day of the first date and use the last day of a shorter month. A run that falls on a Saturday or Sunday moves to the next Monday. The first date runs from tomorrow to 12 months ahead and must be a weekday.

**Sandbox demo values.** Today is Tue 3 Nov 2026, 10:42. Eight schedules are in the list, and one ended schedule is archived.

| Id | Pays | How often | Next | Notes |
|---|---|---|---|---|
| `SCH-1001` | Rent, Harbor Estates ••8841 | Monthly, 1,450.00 | Tue 1 Dec 2026 | 11 paid |
| `SCH-1002` | Savings top-up, own account Savings ••7720 | Weekly, 100.00 | Fri 6 Nov 2026 | 40 paid |
| `SCH-1003` | Harbor Insurance (bill, full bill, never more than 400.00) | Every 3 months | Wed 4 Nov 2026 | Changes close today 18:00; with `strictCutoff` on, they have closed |
| `SCH-1004` | Peak Fitness | Monthly, 39.99 | Tue 3 Nov 2026 | "Running now": cannot be changed |
| `SCH-1005` | Lena Fischer | Monthly, 200.00 | Mon 16 Nov 2026 | 5 of 12 paid |
| `SCH-1006` | Maya Chen | Once, 250.00 | Thu 12 Nov 2026 | none |
| `SCH-1007` | James Whitfield | Every 2 weeks, 100.00 | Fri 13 Nov 2026 | Ends Fri 26 Mar 2027 |
| `SCH-1008` | Omar Haddad | Monthly, 500.00 | Fri 20 Nov 2026 | Paused |
| `SCH-0900` | Old gym (archived) | Monthly, 30.00 | Mon 3 Aug 2026 | Ended: `SCHEDULE_NOT_ACTIVE` |

Account: Current ••4410, available 8,102.40. Daily limit tested at 41,250.00. Any six digits are accepted as the code.

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Payments › scheduled › New | none | `payments.schedule` |
| Payments › scheduled › row › Change or Cancel | `{scheduleId, mode}` | `payments.schedule` |
| Home › Upcoming payment › Edit | `{scheduleId}` | `payments.schedule` |
| Payments › beneficiaries › Schedule instead | `{payeeId}` | `payments.schedule` |
| Pay a bill › receipt › Schedule a bill (and Pay automatically) | `{savedBillId}` | `payments.schedule` |

#### 3. Screens

Steps in order: `load` (change only), `what` (new only), `who`, `when`, `end`, `review`, code, receipt; or `cancel` in cancel mode.

**Screen `load`** ("Change payment"). Change mode. A card shows the schedule (name, masked account, status chip, Amount, How often, Next payment, Ends). Button **Continue**, busy "Getting your payment…". Refused with the cut-off, running and not-active messages in section 4.

**Screen `what`** ("What do you want to schedule?"). New mode.

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| (no label) | `cards`: "To a payee", "Between my accounts" (`allowOwn`), "A saved bill" (`allowBills`) | Yes | One of the cards | "Choose what to schedule." |

**Screen `who`** (title: "Who and how much"; "Between my accounts"; "Saved bill"; "Amount" when changing). When changing, a card shows the payee.

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| To | `cards`. Payee: every saved payee (name, masked account). Own: every account except From and any account in another currency ("Different currency" is shown and the card is dimmed). Bill: every saved biller (nickname, biller and last four) | Yes | One of the cards | "Choose who to pay." |
| (no saved biller) | `info` | n/a | none | Icon, "No saved billers", "Save a biller when you pay a bill, then schedule it here." |
| From | `select`: accounts with name, last four, available (bills: home-currency accounts only). New mode | Yes | Not the same as To (own) | "Choose an account to pay from." and "Choose two different accounts." |
| (amount) | `cards`, bill only: "Full bill" ("Each time it is due"), "Minimum due" (only for billers that have one), "Fixed amount" | No | One of the cards | none |
| Amount | `amount`, placeholder "0.00". Shown for a fixed amount | Yes | Above zero; the value in home currency not above 41,250.00 | "That is over your daily limit." |

**Screen `when`** (title: "How often"; "Next payment date" when changing).

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| (how often) | `chips`: Once, Weekly, Every 2 weeks, Monthly, Every 3 months (default Monthly). New mode. Choosing Once clears the end | No | One of five | none |
| Start date (or Date, for Once and when changing) | `date`, the next 365 weekdays | Yes | From tomorrow, within 12 months, a weekday | "Choose a date from tomorrow.", "Choose a date within 12 months.", "Choose a weekday." |

**Screen `end`** ("When should it end?"). Not shown for Once.

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| (end) | `cards`: Never, On a date, After a number of payments | No | One of three | none |
| Last payment on | `select`: the payment dates after the first, up to 60. Shown for "On a date" | Yes | After the start; one of the list | "Choose the last payment.", "Choose an end date after the start.", "Choose a date from the list." |
| Number of payments | `number`, placeholder "For example 12", hint "From 2 to {max}." Shown for "After a number of payments" | Yes | A whole number from 2 to the maximum for the frequency | "Enter how many payments.", "Enter a number from 2 to {max}." |

**Screen `review`** ("Review"). Busy "Checking…". Rows: To (name and masked account), From (new), Amount ("Full bill", "Minimum due" or the amount), How often, Date (Once) or Starts, Ends, Next dates (the next three, for example "Fri 6 Nov · Fri 13 Nov · Fri 20 Nov"), Reminder "1 day before" (when `reminder` is on). Refusals on **Confirm**: 20 active schedules, payee gone, same account, over the daily limit, changes closed.

**Screen `cancel`** ("Cancel this payment?"). A card shows the schedule. Button **Cancel payment**, busy "Cancelling…".

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| (scope) | `cards`: "All future payments", "Only the next payment" (with its date). Shown when `allowSkip` is on, the schedule repeats and more than one payment is left | No | One of two | none |

**Code sheet.** New: "Authorise {amount} to {name}, {how often}" (for example "Authorise $100.00 to Maya Chen, monthly"). Change: "Authorise the change to your payment to {name}". Sub "Code sent to ••• 4410." Submit: "Schedule payment" or "Save changes". Cancel and skip ask for no code.

States:
- Loading: busy text on **Continue**, **Review** and **Cancel payment**.
- Empty: no saved biller (above); the Payments tab lists the schedules (empty list text is on that screen).
- Error: messages under the field or a banner; the schedule is not changed when an error shows.

#### 4. Sandbox errors

| Code | Message the person sees | Shows on | Button |
|---|---|---|---|
| `SCHEDULE_NOT_FOUND` | "We can’t find that payment." | `load`, `cancel` | Back to scheduled |
| `SCHEDULE_NOT_ACTIVE` | "This payment has already ended or been cancelled." | `load`, `cancel` | Back to scheduled |
| `SCHEDULE_RUNNING` | "This payment is being processed. Try again later." | `load`, `cancel`, `review` | Back to scheduled |
| `SCHEDULE_CUTOFF_PASSED` | "This payment can’t be changed any more. Change it after it runs." | `load`, `cancel`, `review` | Back to scheduled |
| `SCHEDULE_LIMIT` | "You can have up to 20 scheduled payments. Cancel one to add another." | `review` | Back |
| `RAIL_LIMIT` | "That is over the limit." | `who` | Change amount |
| `DAILY_LIMIT_EXCEEDED` | "That is over your daily limit." | `who`, `review` | Change amount |
| `SAME_ACCOUNT` | "Choose two different accounts." | `who`, `review` | Choose account |
| `DATE_TOO_SOON` | "Choose a date from tomorrow." | `when` | Change date |
| `DATE_TOO_FAR` | "Choose a date within the next 12 months." | `when` | Change date |
| `INVALID_COUNT` | "Enter a valid number of payments." | `end` | Edit |
| `END_BEFORE_START` | "Choose an end date after the start." | `end` | Edit |
| `BENEFICIARY_NOT_FOUND` | "We can’t find that payee. Choose another." | `review` | Back |
| `NOT_SUPPORTED` | "This payment can’t be scheduled." | `who` | Back |
| `STEP_UP_FAILED` | "We couldn’t confirm this change. Nothing was saved. Start again." | code sheet | Start again |
| `TIMEOUT` (planned) | "We didn’t get an answer in time. Check your scheduled payments before you try again." | `timeout` | Check scheduled |
| `SERVICE_UNAVAILABLE` (planned) | "We couldn’t reach the bank. Nothing was changed." | `unavailable` | Try again |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `accounts` | `bank.accounts.list` | none | accounts | none | Existing |
| `payees` | `bank.beneficiaries.list` | none | payees | none | Existing |
| `bills` | `bank.bills.saved` | none | saved billers | none | (planned) |
| `limits` | `bank.limits.get` | `{currency?}` | `{daily, usedToday}` | `LIMIT_NOT_SET` | Existing |
| `list` | `bank.schedules.list` | none | schedules | none | (planned) |
| `get` | `bank.schedules.get` | `{scheduleId}` | schedule | `SCHEDULE_NOT_FOUND` | (planned) |
| `create` | `bank.schedules.create` | `{kind, target, from, amount or amountMode, frequency, first, end, reminder}` | `{scheduleId, next}` | `SCHEDULE_LIMIT`, `DATE_TOO_SOON`, `DATE_TOO_FAR`, `SAME_ACCOUNT`, `DAILY_LIMIT_EXCEEDED`, `BENEFICIARY_NOT_FOUND` | (planned) |
| `update` | `bank.schedules.update` | `{scheduleId, amount, first, end}` | schedule | `SCHEDULE_NOT_ACTIVE`, `SCHEDULE_RUNNING`, `SCHEDULE_CUTOFF_PASSED` | (planned) |
| `cancel` | `bank.schedules.cancel` | `{scheduleId, scope}` | `{status, next?}` | `SCHEDULE_NOT_FOUND`, `SCHEDULE_NOT_ACTIVE`, `SCHEDULE_RUNNING`, `SCHEDULE_CUTOFF_PASSED` | (planned) |
| `run` | `bank.schedules.runDue` | `{date}` | runs | none | (planned) |
| `otpSend`, `otpVerify` | `bank.otp.send`, `bank.otp.verify` | `{channel}`, `{code}` | `{sent, maskedPhone}`, `{verified}` | `OTP_INVALID` | Existing |

In the prototype the schedules are objects in `D.sched` (seeded by `bwSeedSchedules`); the Payments tab shows `n`, `s` and `a`; no adapter is called.

#### 6. Permissions, step-up and limits

`payments.schedule`. Step-up `otp` to create or change (the code names the amount and the payee); `none` to cancel or skip (it can only reduce what leaves the account). Up to 20 active schedules. The daily limit is tested on the home-currency value of the payment when the schedule is made and again on each run. A change closes at 18:00 on the business day before the next payment (09:00 with `strictCutoff`); on the payment day the schedule is "Running now". Business workspace: `WRONG_CONTEXT`.

#### 7. Result and links out

| Case | Title | Chip | Text and rows |
|---|---|---|---|
| New | "Payment scheduled" | "Scheduled" | "{amount} to {name}, {how often}, from {date}." Rows: To, From, Amount, How often, Date or Starts, Ends |
| Changed | "Schedule updated" | "Updated" | "Your payment to {name} is updated." Rows: To, Amount, How often, Next payment, Ends |
| Cancelled | "Payment cancelled" | "Cancelled" | "No more payments will go to {name}." Rows: To, Amount, How often, Cancelled on |
| Skipped | "Next payment skipped" | "Skipped" | "The {date} payment to {name} won’t go." Rows: To, Amount, Skipped, Next payment |

The Payments tab shows each schedule as "How often · next date · Paused · Running now". A cancelled schedule is archived. Notifications (planned): the reminder, "Payment sent" after each run, "Payment skipped, not enough money", "Schedule paused" after two failures in a row, and confirmations of changes and cancellations. Buttons: **View scheduled**, **Schedule another** (new); **Back to scheduled**, **Schedule a payment** (cancel).

#### 8. Acceptance criteria

- AC-1: A new schedule can be made to a payee, between own accounts (`allowOwn`) or for a saved bill (`allowBills`); a choice that is off is not offered.
- AC-2: Own accounts must differ and share a currency; a bill can be the full bill, the minimum due where the biller has one, or a fixed amount.
- AC-3: The date must be a weekday from tomorrow to 12 months ahead; the review lists the next three dates; a Saturday or Sunday run moves to Monday; a month with fewer days uses its last day.
- AC-4: The end can be never, on a date from the list, or after 2 to the maximum number of payments for the frequency; Once has no end.
- AC-5: Making a schedule asks for a code that names the amount and the payee; three wrong codes fail with the step-up message and nothing is saved.
- AC-6: Changing a schedule changes the amount, the next date or the end, never the payee; it is refused as running, closed (18:00, or 09:00 with `strictCutoff`) or not active with the messages in section 4.
- AC-7: Cancelling asks for no code; with `allowSkip` the customer can skip only the next payment when the schedule repeats and more than one payment is left; skipping moves the next date to the following payment.
- AC-8: A 21st active schedule is refused; an amount over the daily limit is refused.
- AC-9: The reminder row shows only when `reminder` is on.
- AC-10: On timeout or when the bank is unavailable nothing is saved or cancelled and the person is told so.

#### 9. Scenarios

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1 | `alex` | `allowOwn` off, `allowBills` off | Only "To a payee" is offered. |
| T-2 | AC-2 | `alex` | none | Between my accounts: Current to Savings accepted; the Euro account is dimmed "Different currency"; the same account twice: "Choose two different accounts." |
| T-3 | AC-2 | `alex` | none | A saved bill: Full bill, Minimum due (for a card biller only) and Fixed amount; with no saved biller: "No saved billers". |
| T-4 | AC-3 | `alex` | none | Start date today: "Choose a date from tomorrow."; a Saturday is not listed; a date 13 months out is not listed; Monthly from 31 Jan: next dates 28 Feb and 31 Mar. |
| T-5 | AC-4 | `alex` | none | Weekly, After a number of payments, 1: "Enter a number from 2 to 104." On a date: the list starts after the first date; Once shows no end screen. |
| T-6 | AC-5 | `alex` | none | Create 100.00 monthly to Maya Chen from Fri 6 Nov: review, code "Authorise $100.00 to Maya Chen, monthly", result "Payment scheduled"; the list shows it. |
| T-7 | AC-6 | `alex` | none | Change `SCH-1006` to 300.00: result "Schedule updated". Change `SCH-1004`: "This payment is being processed. Try again later." Change `SCH-1003` with `strictCutoff` on: "This payment can’t be changed any more. Change it after it runs." Change `SCH-0900`: "This payment has already ended or been cancelled." |
| T-8 | AC-7 | `alex` | none | Cancel `SCH-1005`: both scope cards; "Only the next payment": "Next payment skipped" and the next date moves; "All future payments": "Payment cancelled", no code. With `allowSkip` off no scope card. A "Once" schedule shows no scope card. |
| T-9 | AC-8 | `alex` | 20 active schedules | **Confirm**: "You can have up to 20 scheduled payments. Cancel one to add another." An amount of 50,000.00: "That is over your daily limit." |
| T-10 | AC-9 | `alex` | `reminder` off | No "Reminder" row. |
| T-11 | AC-10, timeout | `alex` | `timeout: ["bank.schedules.create"]`, `latencyMs: 10000` (planned) | Timeout screen; the list is unchanged. |
| T-12 | AC-10, unavailable | `alex` | `unavailable: ["bank.schedules.create"]` (planned) | "We couldn’t reach the bank. Nothing was changed." with **Try again**; the list is unchanged. |

#### 10. Expected mutation-check survivors

The fixed clock (Tue 3 Nov 2026, 10:42) makes the cut-off scenarios deterministic and survives as a prototype value. The run engine (pay on the day, skip, retry, pause) is not built, so mutants there cannot exist yet (planned). The seeded schedule ids and amounts survive. The list order of the frequencies survives when only presence is asserted. The `RAIL_LIMIT` message has no screen that raises it in the prototype and survives.

---

### ★ Cancel a standing order — `cancel-standing-order`

Catalog: `cancel-standing-order`, workspace Personal, category Payments, core no, a bank can switch it off (only by switching off `schedule-payment`, which it is part of). Options: those of `schedule-payment`; the only one that touches this alias is `allowSkip` ("Offer “skip only the next payment” when cancelling", default on).

Alias of `schedule-payment`: reached by launching `schedule-payment` with `{scheduleId, mode: "cancel"}` from Payments › scheduled › row › Cancel (any frequency, including what used to be called a standing order), or from the old `cancel-standing-order` link.

What differs from the full journey:
- One screen, `cancel` ("Cancel this payment?"), then the result. No code is asked.
- The scope card (**All future payments** or **Only the next payment**) is shown only when `allowSkip` is on, the schedule repeats and more than one payment is left; with `allowSkip` off cancelling always ends the schedule.
- Results: "Payment cancelled" (chip "Cancelled", rows To, Amount, How often, Cancelled on) or "Next payment skipped".
- Errors: `SCHEDULE_NOT_FOUND`, `SCHEDULE_NOT_ACTIVE`, `SCHEDULE_RUNNING`, `SCHEDULE_CUTOFF_PASSED` (section 4 of `schedule-payment`). Acceptance criterion and scenario: AC-7 and T-8 of `schedule-payment`.

---
## Personal: Cards

The Cards tab holds two kinds of card, and the spec keeps them apart:

| Kind | What it is | In the sandbox today |
|---|---|---|
| **BankWorkx card** (debit, credit, virtual) | A card BankWorkx issues to Alex. It has a status, limits, controls, a PIN, transactions and can be replaced or disputed. | **Not modelled** (planned) |
| **Saved card** (an outside card used to add money) | A card from any bank that Alex saves so `add-money` can pull money from it. | **Existing**: `SavedCard` in `packages/mock-bank-api/src/finance.ts` (`id`, `network`, `last4`, `holder`, `expiry`, `nickname`, `isDefault`), listed by `bank.cards.list`, saved by `bank.cards.add` |

The journeys `cards`, `activate-card`, `freeze-card` (alias of `card-controls`), `card-controls`, `virtual-card`, `replace-card`, `card-pin` and `dispute-transaction` work on **BankWorkx cards** and need the planned domain below. `add-card` works on **saved cards** and exists today.

### Planned sandbox domain: cards (planned)

New file `packages/mock-bank-api/src/cards.ts`, class `CardsSandbox`, attached to the persona as `Persona.cards` (separate from `Finance.cards`, which stays the saved-card list). Adapter names follow `bank.cards.<verb>`. The two existing names keep their meaning (`bank.cards.list` = saved cards, `bank.cards.add` = save an outside card), so the issued-card adapters use the noun `issued` or a sub-domain (see open questions).

Data held per card (planned):

| Field | Meaning |
|---|---|
| `id`, `kind` (`debit`, `credit`), `network`, `last4`, `holder`, `expiry` (MM/YY), `nickname` | Identity. `virtual: true` and `parentCardId` for a virtual card |
| `status` | `inactive` (not yet activated), `active`, `frozen` (temporary), `blocked` (permanent), `expired`, `replaced` |
| `accountId` | Debit: the account it spends from. Credit: none |
| `creditLimit`, `availableCredit` | Credit cards only |
| `controls` | `online`, `contactless`, `abroad`, `atm`: each true or false |
| `limits` | `perTransaction`, `dailyPurchases`, `dailyAtm`, each with `usedToday` for the two daily ones |
| `ceilings` | Highest value the bank allows for each limit (set by the card product) |
| `pinSet`, `pinTries` | Whether a PIN exists; wrong-PIN counter is bank-side and not simulated |
| `transactions[]` | `id` (`ct_…`), `merchant`, `amount` (negative = money out), `currency`, `status` (`pending`, `posted`), `daysAgo`, `time`, `channel` (`pos`, `online`, `atm`), `country`, `disputeId?` |
| `disputes[]`, `replacements[]` | Cases opened by the two journeys |

Seed for Alex Morgan (planned, synthetic):

| Card | Detail |
|---|---|
| **Everyday debit** `card_9021` | Visa debit ••9021, spends from Main ••4410, `active`, all controls on, limits per transaction 2,000.00, daily purchases 3,000.00, daily ATM 800.00; ceilings 10,000.00 / 15,000.00 / 1,500.00 |
| **Aurora credit** `card_3318` | Mastercard credit ••3318, limit 5,000.00, available 3,640.20, `active`, abroad control off, limits per transaction 1,500.00, daily purchases 2,500.00, no ATM |
| **Spare debit** `card_7745` | Visa debit ••7745, spends from Savings ••7731, `inactive` (just posted to Alex), PIN not set, used by `activate-card` |
| Card transactions on ••9021 | `ct_1` Northwind Market -64.20 posted; `ct_2` Skyline Travel Co. -420.00 posted (online, abroad); `ct_3` Brightside Coffee -4.80 pending; `ct_4` Harbor Fuel -45.00 posted |
| Sam Rivera | No cards (empty state) |

Planned adapters (all `mode: "sandbox"`):

| Adapter | Request | Response | Error codes | `moneyMoving` | `requiresOtp` |
|---|---|---|---|---|---|
| `bank.cards.issued` | none | Record of cards with `name` ("Everyday debit ••9021"), status, balances | `NOT_SUPPORTED` | no | no |
| `bank.cards.get` | `{cardId}` | One card with controls, limits, ceilings | `CARD_NOT_FOUND` | no | no |
| `bank.cards.transactions` | `{cardId, status?, from?, to?}` | Record of card transactions | `CARD_NOT_FOUND` | no | no |
| `bank.cards.activate` | `{cardId, last4, expiry}` | `{cardId, status: "active"}` | `CARD_NOT_FOUND`, `CARD_ALREADY_ACTIVE`, `ACTIVATION_MISMATCH`, `CARD_BLOCKED`, `OTP_REQUIRED` | no | yes |
| `bank.cards.freeze` | `{cardId}` | `{status: "frozen"}` | `CARD_NOT_FOUND`, `CARD_NOT_ACTIVE`, `CARD_ALREADY_FROZEN` | no | no (protective) |
| `bank.cards.unfreeze` | `{cardId}` | `{status: "active"}` | `CARD_NOT_FOUND`, `CARD_NOT_FROZEN`, `OTP_REQUIRED` | no | yes |
| `bank.cards.block` | `{cardId, reason}` | `{status: "blocked", reference}` | `CARD_NOT_FOUND`, `CARD_ALREADY_BLOCKED`, `OTP_REQUIRED` | no | yes |
| `bank.cards.controls.update` | `{cardId, controls?, limits?}` | The card's new controls and limits, `loosened: true or false` | `CARD_NOT_FOUND`, `CARD_NOT_ACTIVE`, `LIMIT_INVALID`, `LIMIT_ABOVE_CEILING`, `OTP_REQUIRED` (only when loosening) | no | only when loosening |
| `bank.cards.virtual.create` | `{cardId, nickname, spendLimit, expiresInMonths, singleUse}` | New virtual card (`id`, `last4`, `expiry`, `status`) | `CARD_NOT_FOUND`, `CARD_NOT_ACTIVE`, `VIRTUAL_LIMIT_REACHED`, `LIMIT_ABOVE_CEILING`, `OTP_REQUIRED` | no | yes |
| `bank.cards.virtual.reveal` | `{cardId}` | `{number, cvv, expiry}` (shown once per step-up) | `CARD_NOT_FOUND`, `STEP_UP_REQUIRED` | no | step-up |
| `bank.cards.virtual.delete` | `{cardId}` | `{status: "blocked"}` | `CARD_NOT_FOUND`, `CARD_ALREADY_BLOCKED` | no | no |
| `bank.cards.replace` | `{cardId, reason, delivery, branchId?}` | `{reference, newCardId, fee, deliveryBy}` | `CARD_NOT_FOUND`, `REPLACEMENT_PENDING`, `REASON_INVALID`, `INSUFFICIENT_FUNDS`, `ACCOUNT_NOT_FOUND`, `CORE_UNAVAILABLE`, `OTP_REQUIRED` | yes (fee) | yes |
| `bank.cards.pin.set` | `{cardId, pin, oldPin?}` | `{pinSet: true}` | `CARD_NOT_FOUND`, `CARD_NOT_ACTIVE`, `PIN_INVALID`, `PIN_WEAK`, `PIN_SAME_AS_OLD`, `OTP_REQUIRED`, `STEP_UP_REQUIRED` | no | yes (and step-up) |
| `bank.cards.dispute.reasons` | none | The list of reasons, each with the evidence it asks for | none | no | no |
| `bank.cards.dispute.create` | `{cardId, transactionId, reason, amount, details, cardInPossession, evidence[]}` | `{disputeId, status: "under_review", reference, replyBy}` | `CARD_NOT_FOUND`, `TRANSACTION_NOT_FOUND`, `NOT_DISPUTABLE`, `TRANSACTION_PENDING`, `DISPUTE_WINDOW_CLOSED`, `DISPUTE_EXISTS`, `DISPUTE_AMOUNT_INVALID`, `REASON_INVALID`, `OTP_REQUIRED` | no | yes |
| `bank.cards.dispute.list` | `{cardId?}` | Record of cases | none | no | no |

Sandbox rules (planned):

- A frozen, blocked, inactive or expired card refuses every card action except the ones listed for it in `freeze-card` and `activate-card`. Spending adapters do not exist; the card's state only drives the screens.
- `limits.perTransaction` may not exceed `limits.dailyPurchases`. Each limit may not exceed its ceiling (`LIMIT_ABOVE_CEILING`). A limit below 0, not a whole number of cents, or with more decimals than the account currency allows is `LIMIT_INVALID`.
- **Loosening** means: turning a control on, or raising a limit. Only loosening needs the one-time code. Tightening (turning a control off, lowering a limit) never does.
- Dispute window: 120 days from the transaction date. Replacement fee: lost 5.00 USD, damaged 5.00 USD, stolen free. A replacement takes 5 working days to arrive.
- Dates in the seed are relative to the sandbox clock (`MockBank.now`), so tests are repeatable.

Standard screens used by the card journeys (so the journeys can stay short):

- **One-time code screen** (`otp`): title "Confirm with your code", an `otp` block (`length 6`, `maxAttempts 3`, `resendAfterSeconds 30`, `keypad`), hint "Enter the code sent to {{ctx.otp.maskedPhone}}", button "Confirm". The screen's `onEnter` calls `otpSend` (`bank.otp.send`, `{channel: "sms"}`); resend calls it again; the button calls `otpVerify` (`bank.otp.verify`, `{code}`) with `onError: {showToast, stay: true, lockAfter: 3, lockTo: "locked"}`, then the journey's own action. Only the integration named `otpVerify` counts failures.
- **Locked screen** (`locked`, terminal): `result` error, title "Too many wrong codes", text "Nothing was changed on your card. Start again when you're ready.", buttons "Start again" (to the first screen) and "Back to cards" (`exit`).
- **Failed screen** (`failed`, terminal): `result` error whose text is `{{ctx.error.message}}` followed by the line "Nothing was changed on your card.", buttons "Try again" (to the screen that fixes it) and "Back to cards".

### Shell: Card carousel

| Item | Spec |
|---|---|
| **Purpose** | First screen of the Cards tab. Shows every BankWorkx card as a card picture and offers the quick actions. |
| **Route** | Web `/personal/cards`; mobile screen `CardsHome` |
| **Data source** | View-model `cardsHome` in `packages/bank-client` (planned) built from `bank.cards.issued` (planned) and `bank.cards.list` (existing, saved cards) |
| **Widgets** | 1. Horizontal card carousel (swipe on mobile, arrows on web): card art in the network's look, nickname, `••last4`, a `statusChip` (planned) of Active, Inactive, Frozen, Blocked. A frozen card is drawn with a frost overlay; a blocked card is greyed. 2. Quick actions under the active card: Freeze or Unfreeze, Limits, Virtual card, PIN. 3. Credit card strip: "Available {availableCredit} of {creditLimit}" with a thin bar. 4. "Cards you saved to add money" row list (saved cards: nickname, `••last4`, default tag) with the button "Add a card" |
| **Sort order** | Debit first, then credit, then virtual cards (under their parent). Within a kind: active, inactive, frozen, blocked. Saved cards: default first |
| **Filters** | None |
| **Empty state** | No BankWorkx card (Sam): illustration, "You don't have a BankWorkx card yet.", button "Find out how" (opens Explore › Products › Cards, public). The saved-card row shows "No saved cards yet." with "Add a card" |
| **Loading state** | Three card-shaped skeletons and two row skeletons |
| **Error state** | Card strip replaced by "We couldn't load your cards." and a "Try again" button. A `SERVICE_UNAVAILABLE` or `TIMEOUT` shows the standard message with "Try again" |
| **Drill-downs** | Tap a card → Card detail. Tap a saved card → bottom sheet with nickname, expiry, "Make default" (no journey; planned shell action) and "Remove" (planned). Quick actions open the journeys below |
| **Launch points on it** | `Cards › carousel › Activate` → `activate-card` `{cardId}` (only on an inactive card); `Cards › carousel › Add a card` → `add-card`; notification "Activate your new card" → `activate-card` |

### Shell: Card detail

| Item | Spec |
|---|---|
| **Purpose** | Everything about one card, and the place the card journeys start from. |
| **Route** | Web `/personal/cards/:cardId`; mobile screen `CardDetail` |
| **Data source** | View-model `cardDetail` (planned) from `bank.cards.get`, plus the latest four items of `bank.cards.transactions` |
| **Widgets** | Header: card art, status chip, nickname, `••last4`, expiry. Balance block: for debit "Spends from {account name} ••{n}, balance {balance}"; for credit "Available {availableCredit} of {creditLimit}". "Today's use" bars for daily purchases and daily ATM against their limits. Controls summary (four toggles read-only, with "Change" link). Action list. Latest transactions (4) with "See all" |
| **Action list (launch points)** | Freeze card / Unfreeze card / Block card → `freeze-card` `{cardId, action}`; Limits and controls → `card-controls` `{cardId}`; Virtual card → `virtual-card` `{cardId}` (debit and credit only, hidden on a virtual card); Replace card → `replace-card` `{cardId, reason}` (reason preset by the tapped row: "Lost or stolen?" or "Damaged?"); Set or change PIN → `card-pin` `{cardId}`; Activate → `activate-card` (inactive card only). Buttons that do not apply to the status are hidden, not disabled (a blocked card shows only Replace card) |
| **Empty / loading / error** | Loading: card skeleton and three bar skeletons. Error: "We couldn't load this card." with "Try again". Not found (`CARD_NOT_FOUND`, for a stale link): "We can't find that card." with "Back to cards" |
| **Drill-downs** | Controls summary "Change" → `card-controls`. A transaction → Card transaction detail inside Card transactions. "See all" → Card transactions filtered to this card |

### Shell: Card transactions

| Item | Spec |
|---|---|
| **Purpose** | Spending history of one card, with the entry to report a problem. |
| **Route** | Web `/personal/cards/:cardId/transactions`; mobile screen `CardTransactions` |
| **Data source** | View-model `cardTransactions` (planned) from `bank.cards.transactions` |
| **Widgets** | `dataTable` (planned; card list on phones) |
| **Table columns** | Date and time; Merchant; Channel (Shop, Online, Cash machine); Country; Amount (negative in the text colour, refunds in green); Status (`statusChip`: Pending, Posted, Disputed) |
| **Filters** | Status (All, Pending, Posted, Disputed); Channel; Date range (`datePicker`, planned); search by merchant |
| **Sort order** | Newest first. Pending items stay at the top of their day |
| **Empty state** | "No card spending in this period." with "Clear filters" when filters are set |
| **Loading / error** | Six row skeletons. Error: "We couldn't load this card's spending." with "Try again" |
| **Drill-downs** | Tap a row → transaction sheet: merchant, amount, date, time, channel, country, reference, status. Buttons: "Report a problem" → `dispute-transaction` `{cardId, transactionId}` (posted items not yet disputed; hidden for pending, shown as "Disputed – view case" when a case exists) and "Download receipt" (shell receipt) |
| **Launch points on it** | `Cards › card › transaction › Report a problem` → `dispute-transaction` |

### Shell: Controls overview

| Item | Spec |
|---|---|
| **Purpose** | One screen that compares every card's controls and limits, so Alex can see at a glance which cards can be used abroad, online and so on. |
| **Route** | Web `/personal/cards/controls`; mobile screen `CardControlsOverview` |
| **Data source** | View-model `cardControls` (planned) from `bank.cards.issued` |
| **Widgets** | `dataTable`: one row per card |
| **Table columns** | Card (nickname, `••last4`); Status; Online; Contactless; Abroad; Cash machine (each a tick or a dash); Per purchase limit; Daily purchases limit; Daily cash limit |
| **Filters / sort** | None. Sorted as the carousel |
| **Empty state** | "There are no cards to show." |
| **Loading / error** | Table skeleton. Error as the carousel |
| **Drill-downs** | Row → `card-controls` `{cardId}`. Frozen or blocked cards show their status chip in place of the ticks |
| **Launch points on it** | `Cards › card › Limits and controls` (same journey, from here) |

---

### ★ Cards — `cards`

**Catalog:** slug `cards`, workspace `personal`, category Cards (Personal: Cards), core no, can a bank switch it off: yes (a screen, kept in the Lean preset as a basic entry; switching it off hides the Cards tab). Options (both default on): **Show recent card transactions** (`showTx`); **Show the Wallet action** (`showWallet`). Research: `research/cards.md`. Built in `design/bankworkx-r1/src/journeys/24-cards.js`, which also holds the shared card data `CRD` used by `card-controls` and `activate-card`.

The lean rework removed the spending summary, the saved-cards row and the explainers. What remains: the card carousel, one status line, a row of quick actions and recent transactions.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `cards` |
| Purpose | Show the person’s cards (debit, credit and virtual) with their status, the money available, quick actions for the chosen card and its recent transactions. |
| Release / workspace | 1 / Personal |
| Status | Built in the prototype as a screen (`view: true`, tab `card`). Freeze and Unfreeze here are instant. No other money movement. |
| Channels | Web and mobile |
| Starting pattern | None |
| Who may use it | Anyone signed in to Personal with `accounts.view`. |

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Tab bar › Cards (mobile), left rail › Cards (web) | none | `accounts.view` |
| Home › quick action › Cards | none | `accounts.view` |
| Command bar › Cards | none | `accounts.view` |
| Deep link `/personal/cards` | optional `{cardId}` (that card is chosen) | `accounts.view` |

#### 3. Screens

One screen, **Cards**.

**Card carousel.** A sideways list of card faces, one per card. Each face shows the brand "BankWorkx®", the number "•••• •••• •••• 9021", the holder and expiry ("ALEX MORGAN · 09/29") and a status pill in a corner: "Active", "Virtual", "Not activated", "Frozen" (with a snowflake), "Blocked", "Expired" or "Replaced". A frozen face is greyed; blocked, expired and replaced faces are greyed more. The chosen card has an outline. Tapping a face chooses it.

**Chosen card.** Name in bold (for example "Everyday debit") and "•••• 9021". Then one status line:

| Card state | Line |
|---|---|
| Not activated | "Activate this card to start using it." |
| Blocked, expired or replaced | "This card can’t be used." |
| Credit | "Available credit" with the amount, and "Minimum due $45.00 by {date}" |
| Virtual | "Available" with the monthly limit minus spending this month |
| Debit (also frozen) | "Available balance" of the linked account |

If activation is locked for a not-activated card: "Activation is locked. Please call us." and no Activate action.

**Quick actions** (a row of up to four, each shown only if its journey is on, built and allowed):

| Card state | Actions |
|---|---|
| Active | **Freeze** (instant), **Controls** (`card-controls {cardId, mode: "all"}`), **PIN** (`card-pin`, not on a virtual card), **Wallet** (`card-wallet`, only when `showWallet` is on) |
| Frozen | **Unfreeze** (instant), **Controls** |
| Not activated | **Activate** (`activate-card {cardId}`) |
| Blocked or expired | **Replace** (`replace-card {cardId}`) |

Freeze changes the card to Frozen at once and shows a toast "Card frozen"; Unfreeze shows "Card unfrozen". A card that is not active cannot be frozen ("Only an active card can be frozen."); a card that is not frozen cannot be unfrozen ("This card isn’t frozen.").

**Recent** (shown only when `showTx` is on and the card is active or frozen). Heading "Recent" with a link **See all** (opens the card’s account in `account-details`; absent for a credit card or when that journey is off). Up to five rows, each with an initial, the merchant, "Today" or a date ("31 Oct"), the signed amount and a "Pending" chip while pending. Empty: "No card activity yet".

**Add a card.** A secondary button **Add a card** (`add-card`), shown only when that journey is on.

**States:**
- Loading: two card-sized blocks and two row blocks for about 0.6 seconds.
- Empty (no cards): title "No cards yet", text "Your cards will show here.", button **Add a card** (when `add-card` is on).
- Error: title "We couldn’t load your cards", text "Nothing was changed. Try again in a moment.", button **Try again**. A freeze or unfreeze while the bank is unavailable shows the standard connection sheet and the card is unchanged.
- Timeout: "This is taking longer than expected. Nothing was changed." with **Try again** (planned for the screen; the prototype has only the unavailable state).

#### 4. Sandbox errors

Codes are for tests and the sandbox; the customer sees only the message.

| Code | Message | Shows on | Button |
|---|---|---|---|
| `CARD_NOT_FOUND` | "We can’t find that card." | Cards | none |
| `CARD_NOT_ACTIVE` | "Only an active card can be frozen." | toast | none |
| `CARD_NOT_FROZEN` | "This card isn’t frozen." | toast | none |
| `SERVICE_UNAVAILABLE` | "We couldn’t load your cards. Nothing was changed." (screen title "We couldn’t load your cards"); on a freeze, the standard connection sheet | Cards | Try again |
| `TIMEOUT` (planned) | "This is taking longer than expected. Nothing was changed." | Cards | Try again |
| `JOURNEY_DISABLED` | "This isn’t available at your bank." | Whole tab | none |
| `PERMISSION_DENIED` (planned) | Standard message | Whole tab | Back |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `cards` | `bank.cards.list` | none | map of cards (`nickname`, `last4`, `kind`, `status`) | none | Existing (`packages/mock-bank-api/src/index.ts`) |
| `cardsOverview` | `bank.cards.overview` | none | cards plus `expiry`, `holder`, `virtual`, `parentCardId`, `linkedAccountId`, `credit {limit, available, minimumDue, dueDate}`, `limits`, `used` | `SERVICE_UNAVAILABLE`, `TIMEOUT` | (planned). The prototype computes these from `CRD` |
| `cardTransactions` | `bank.cards.transactions` | `{cardId, limit}` | `{items[]}` with `merchant`, `amount`, `pending`, `daysAgo` | `CARD_NOT_FOUND` | (planned) |
| `freezeCard` | `bank.cards.freeze` | `{cardId}` | `{cardId, status}` | `CARD_NOT_ACTIVE`, `CARD_NOT_FOUND` | (planned) |
| `unfreezeCard` | `bank.cards.unfreeze` | `{cardId}` | `{cardId, status}` | `CARD_NOT_FROZEN`, `CARD_NOT_FOUND` | (planned) |

#### 6. Permissions, step-up and limits

`accounts.view`. Step-up `none` for viewing and for Freeze (it only protects). Unfreeze here is instant in the prototype; the product rule is that unfreezing makes the card easier to use and asks for a code (see `card-controls`, and the open point in section 9 T-6). No limits.

#### 7. Result and links out

No result screen and no receipt. Notifications raised (planned): "Your card ending {last4} was frozen" and "Your card ending {last4} was unfrozen". Links out: `card-controls {cardId, mode}`, `activate-card {cardId}`, `card-pin {cardId}`, `card-wallet {cardId}` (planned), `replace-card {cardId}`, `add-card`, `account-details {accountId}`.

#### 8. Acceptance criteria

- AC-1: Every card shows its face with last four digits, holder, expiry and a status pill; the chosen card has an outline.
- AC-2: The status line matches the card: activate prompt, "can’t be used", available credit with minimum due, available (virtual) or available balance.
- AC-3: The quick actions match the card state in the table; an action whose journey is off is not drawn.
- AC-4: Freeze turns an active card to Frozen at once and changes the pill; Unfreeze turns it back; an inactive card cannot be frozen.
- AC-5: Recent shows up to five rows, hides when `showTx` is off, and **See all** opens the card’s account.
- AC-6: With `showWallet` off there is no Wallet action.
- AC-7: A card whose activation is locked shows "Activation is locked. Please call us." and no Activate action.
- AC-8: With no cards the screen says "No cards yet" and offers **Add a card**.
- AC-9: When the service is unavailable the screen shows the error with **Try again** and nothing is changed; **Try again** reloads.
- AC-10: A frozen face is greyed and Controls stays available.

#### 9. Scenarios

Synthetic persona `alex` with four cards: Everyday debit ••9021 (active, linked to Current), Aurora credit ••3318 (active, limit $5,000.00, available $3,640.20, minimum due $45.00), Spare debit ••7745 (not activated) and a virtual card ••6150 "Online shopping" (active). "Today" is Tue 3 Nov 2026.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-2, AC-3 | `alex` | none | Everyday debit: "Available balance", actions Freeze, Controls, PIN, Wallet. Credit: "Available credit $3,640.20", "Minimum due $45.00 by 28 Nov 2026". Spare debit: activate prompt and **Activate**. Virtual: no PIN action. |
| T-2 | AC-4 | `alex` | none | Freeze Everyday debit: toast "Card frozen", pill "Frozen", face greyed, actions Unfreeze and Controls. Unfreeze: toast "Card unfrozen". |
| T-3 | AC-5 | `alex` | none | Everyday debit shows five recent rows (the sixth is not shown) with "Pending" on the newest; **See all** opens Current. With `showTx` off the section is gone. |
| T-4 | AC-6, AC-3 | `alex` | `showWallet` off; `card-pin` off | No Wallet and no PIN action. |
| T-5 | AC-7 | `alex`, three wrong activation tries on Spare debit | none | "Activation is locked. Please call us." and no Activate action. |
| T-6 | AC-4 | `alex`, Everyday debit frozen | none | Open Unfreeze from Cards. Prototype: instant with no code. Product rule: a code is needed (planned); this scenario fails against the product rule until the code step is added to the Cards screen. |
| T-7 | AC-8 | `alex`, no cards | `empty: ["bank.cards.overview"]` | "No cards yet" with **Add a card**. |
| T-8 | AC-9 | `alex` | `unavailable: ["bank.cards.overview"]` (prototype: Service down on) | Error with **Try again**; after Service down is cleared it loads. Freeze with the service down: connection sheet and the card is unchanged. |
| T-9 | AC-9 | `alex` | `timeout: ["bank.cards.overview"]`, `latencyMs: 10000` (planned) | After 10 seconds: "This is taking longer than expected. Nothing was changed." |
| T-10 | AC-10 | `alex`, Everyday debit frozen | none | Face greyed; **Controls** opens `card-controls` with only Unfreeze on offer. |

#### 10. Expected mutation-check survivors

Removing the rule that only an active card can be frozen survives T-2 if the Freeze action is already hidden for a card that is not active (two layers); expected. The planned timeout state has no sandbox layer in the prototype. Everything else: none expected.

---

### ★ Activate card — `activate-card`

**Catalog:** slug `activate-card`, workspace `personal`, category Cards (Personal: Cards), core no, can a bank switch it off: yes. Options (both default on): **Ask for the 3-digit security code** (`askCvv`); **Let the customer set the PIN during activation** (`pinAtActivation`). Research: `research/activate-card.md`. Built in `design/bankworkx-r1/src/journeys/26-activate-card.js`, on the shared card data `CRD` from `24-cards.js`.

The lean rework removed the date of birth check, the delivery explainer and the card illustration. The person proves they hold the card with its last four digits, expiry and (optionally) the security code, then sets a PIN now or later.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `activate-card` |
| Purpose | Turn on a new card with its last 4 digits, expiry and security code, then set the PIN. |
| Release / workspace | 1 / Personal |
| Status | Built in the prototype as a form journey (`submit: "Activate card"`, `call: true`). Changes card state only; no money moves. |
| Channels | Web and mobile |
| Starting pattern | Form, then a result |
| Who may use it | Anyone signed in to Personal with `accounts.view`, for a card of their own that is not yet active. |

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| `cards` › Activate (on a not-activated card) | `{cardId}` | `accounts.view` |
| Notification › "Activate your new card" (planned) | `{cardId}` | `accounts.view` |
| Deep link `/personal/j/activate-card?cardId=card_7745` | `{cardId}` | `accounts.view` |

Without a `cardId`: when exactly one card is waiting it is used; when several are waiting the first step lets the person choose.

#### 3. Screens

**Screen 1 `pick`: Which card?** (shown only when no `cardId` is passed and more than one card is waiting)

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Card | select ("Spare debit ••7745"; only not-activated cards) | yes | the card can be activated | none waiting: "No cards are waiting to be activated."; already active: "This card is already active."; blocked or other: "This card can’t be activated."; locked: "Activation is locked. Please call us." |

**Screen 2 `details`: Activate your card** (button **Continue**, busy "Checking your card…")

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Last 4 digits | text, 4 digits, placeholder "0000", hint "{n} tries left" after a wrong try | yes | exactly 4 digits | "Enter the last 4 digits on the card." |
| Expiry date | text, half width, placeholder "MM/YY" | yes | month 01 to 12, then 2 digits | "Use MM/YY." |
| | | | not in the past | "This card has expired." |
| Security code | hidden text, 3 digits, half width, placeholder "•••" (shown only when `askCvv` is on) | yes | exactly 3 digits | "Enter the 3 digits on the back." |

On Continue the entries are checked against the card. The security code is never kept after the check. A wrong set of details counts as one try; the third wrong try locks activation for that card. Check messages:

| Result | Message | Effect |
|---|---|---|
| Details do not match | "The details don’t match this card. Check them and try again." | one try used; the hint shows the tries left |
| Third wrong try | "Too many wrong tries. Activation is locked. Please call us." | activation locked for the card |
| Card already active | "This card is already active." | none |
| Card blocked or not activatable | "This card can’t be activated." | none |
| Card not found | "We can’t find that card." | none |

**Screen 3 `set PIN`: Set your PIN** (shown only when `pinAtActivation` is on; button **Activate card**, busy "Activating…")

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| (choice) | chips "Set it now", "Later" | yes (default Set it now) | none | none |
| New PIN | hidden text, 4 digits, placeholder "4 digits" (shown for Set it now) | yes | exactly 4 digits | "Use exactly 4 digits." |
| | | | not one digit repeated (1111) | "Don’t repeat one digit." |
| | | | not a straight run up or down (1234, 4321) | "Don’t use a run of digits." |
| | | | not a pattern (1212, 1122) | "Choose a PIN that’s harder to guess." |
| | | | not the person’s birth year or day and month, the last 4 card digits, the last 4 digits of the phone, or of the account number | "Choose a PIN that’s harder to guess." |
| | | | not on a short list of common PINs | "Choose a PIN that’s harder to guess." |
| Repeat PIN | hidden text, 4 digits (shown for Set it now) | yes | equals New PIN | "The PINs don’t match." |

On Activate card the card is checked once more; if it was activated in the meantime: "This card is already active." With `pinAtActivation` off, the journey ends after screen 2 and the PIN is set later.

**Result.** Title "Card activated", text "Your card ending 7745 is ready to use.", chip "Active". Rows: "Card" ("Spare debit ••7745") and "PIN" ("Set" or "Not set yet"). Buttons: **Set my PIN** (`card-pin {cardId}`, only when the PIN is not set) and **Go to cards**.

**States**
- Loading: a disabled button with a spinner and the busy text for about 0.7 seconds (details) and 0.8 seconds (activate).
- Empty: no card waiting: "No cards are waiting to be activated." with **Go to cards**.
- Error: unavailable shows the standard connection sheet with **Try again**; the card stays not activated and no try is used. Timeout: "This is taking longer than expected. Nothing was changed." with **Try again**.
- Locked: the Cards screen shows "Activation is locked. Please call us." and no Activate action.

#### 4. Sandbox errors

Codes are for tests and the sandbox; the customer sees only the message.

| Code | Message | Shows on | Button |
|---|---|---|---|
| `CARD_NOT_FOUND` | "We can’t find that card." | details | Go to cards |
| `CARD_ALREADY_ACTIVE` | "This card is already active." | pick, details, set PIN | Go to cards |
| `ACTIVATION_MISMATCH` | "The details don’t match this card. Check them and try again." | details | Try again |
| `ACTIVATION_LOCKED` | "Too many wrong tries. Activation is locked. Please call us." | details | Go to cards |
| `CARD_BLOCKED` | "This card can’t be activated." | pick, details | Go to cards |
| `NO_INACTIVE_CARD` | "No cards are waiting to be activated." | start | Go to cards |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | the step | Try again |
| `SERVICE_UNAVAILABLE` | "This isn’t available right now. Nothing was changed. Try again in a few minutes." | the step | Try again |
| `JOURNEY_DISABLED` | "This isn’t available at your bank." | whole journey | none |
| `PERMISSION_DENIED` (planned) | Standard message | whole journey | Back |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `cards` | `bank.cards.list` | none | map of cards | none | Existing (`packages/mock-bank-api/src/index.ts`) |
| `verifyCard` | `bank.cards.verifyActivation` | `{cardId, last4, expiry, securityCode?}` | `{verified, triesLeft}` | `ACTIVATION_MISMATCH`, `ACTIVATION_LOCKED`, `CARD_ALREADY_ACTIVE`, `CARD_BLOCKED`, `CARD_NOT_FOUND` | (planned). The security code is sent over the secure channel and never stored |
| `activateCard` | `bank.cards.activate` | `{cardId, pin?}` | `{cardId, status: "active", pinSet}` | `CARD_ALREADY_ACTIVE`, `CARD_NOT_FOUND` | (planned) |

In the sandbox the match is the card’s last 4 digits and expiry; the security code matches unless it is "000".

#### 6. Permissions, step-up and limits

`accounts.view`. Step-up: none beyond the card details (holding the card is the proof). Limits: 3 wrong tries per card, then locked until the bank resets it (call us). The PIN is sent once and not kept in the journey data.

#### 7. Result and links out

Result as above. Notifications raised (planned): "Your card ending {last4} is now active". The change is written to the card change log. Links out: `card-pin {cardId}` (when the PIN is not set), `cards`.

#### 8. Acceptance criteria

- AC-1: With the right last 4 digits, expiry and security code the card becomes Active and the result says "Card activated".
- AC-2: A wrong detail shows "The details don’t match this card…" and the tries left; the third wrong try locks activation and the Cards screen then offers no Activate action.
- AC-3: An expired date is refused ("This card has expired."); a wrong format is refused ("Use MM/YY.").
- AC-4: With `askCvv` off the security code field is absent and not checked.
- AC-5: The PIN rules refuse repeats, runs, patterns and PINs built from the birth date, card, phone or account digits, and the two entries must match.
- AC-6: Choosing Later sets no PIN, the result says "Not set yet" and offers **Set my PIN**.
- AC-7: With `pinAtActivation` off the journey has no PIN step and ends after the details.
- AC-8: A card that is already active, blocked, or locked is refused with the matching message; with no card waiting the person is told so.
- AC-9: The security code is not kept after the check.
- AC-10: When the bank is unavailable or times out the card stays not activated and no try is used.

#### 9. Scenarios

Synthetic persona `alex` with Spare debit ••7745 (not activated, expiry 11/29, security code 123), "today" Tue 3 Nov 2026. Sandbox test values: PIN 7391 is accepted; 1234, 1111 and the card’s own digits are refused.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-5 | `alex`, `cardId` Spare debit | none | Enter 7745, 11/29, 123; set PIN 7391 twice; **Activate card**. Result "Card activated", rows Card and PIN "Set". The Cards screen now shows the card Active. |
| T-2 | AC-2 | `alex` | none | Enter 0000 as last 4: "The details don’t match this card. Check them and try again." and "2 tries left". Two more wrong tries: "Too many wrong tries. Activation is locked. Please call us." The Cards screen shows "Activation is locked. Please call us." |
| T-3 | AC-3 | `alex` | none | Expiry "1129": "Use MM/YY." Expiry 09/26: "This card has expired." |
| T-4 | AC-4, AC-7 | `alex` | `askCvv` off; `pinAtActivation` off | No security code field; no PIN step; the journey activates after the details. |
| T-5 | AC-5 | `alex` | none | PINs 1111 ("Don’t repeat one digit."), 1234 ("Don’t use a run of digits."), 7745 ("Choose a PIN that’s harder to guess."), 7391 then 7392 ("The PINs don’t match."), 123 ("Use exactly 4 digits."). |
| T-6 | AC-6 | `alex` | none | Choose Later: no PIN fields; result PIN "Not set yet" with **Set my PIN**. |
| T-7 | AC-8 | `alex`, Everyday debit (active) opened with its `cardId` | none | "This card is already active." With no card waiting: "No cards are waiting to be activated." |
| T-8 | AC-9 | `alex` | none | After Continue the journey data holds no security code (the field is empty when going Back). |
| T-9 | AC-10 | `alex` | `unavailable: ["bank.cards.verifyActivation"]` (prototype: Service down on) | Connection sheet; the card stays not activated; the tries-left hint is unchanged. |
| T-10 | AC-10 | `alex` | `timeout: ["bank.cards.activate"]`, `latencyMs: 10000` | After 10 seconds: "This is taking longer than expected. Nothing was changed." The card stays not activated. |

#### 10. Expected mutation-check survivors

The "not a common PIN" list and the "not built from phone or account digits" rules survive if T-5 only covers repeats, runs and the card digits; expected until a scenario covers each. The rule that the security code is cleared after the check cannot be observed through the sandbox adapter; expected. Everything else: none expected.

---

### ★ Card limits and controls — `card-controls`

**Catalog:** slug `card-controls` (name in the prototype "Card controls"), workspace `personal`, category Cards (Personal: Cards), core no, can a bank switch it off: yes (basic entry, kept in the Lean preset). Options: **Offer trip dates when International is on** (`allowTrip`, default on). Research: `research/card-controls.md`. Built in `design/bankworkx-r1/src/journeys/25-card-controls.js`, on the shared card data `CRD` from `24-cards.js`.

The lean rework removed the gambling block, the magnetic stripe switch, the contactless limit setting, the freeze reasons and the "what a freeze does not stop" explainer. What remains: freeze or unfreeze, spending limits, where the card works (with an optional trip) and alerts. Tightening is instant; loosening asks for a code.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `card-controls` |
| Purpose | Freeze or unfreeze a card, set its spending limits, choose where it works and set alerts. |
| Release / workspace | 1 / Personal |
| Status | Built in the prototype as a form journey (`submit: "Save changes"`, `call: true`). It changes only card settings; no money moves. |
| Channels | Web and mobile |
| Starting pattern | Form, then review, then a code only when something is loosened, then a result |
| Who may use it | Anyone signed in to Personal with `accounts.view`, for their own cards. |

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| `cards` › Controls | `{cardId, mode: "all"}` | `accounts.view` |
| `cards` › Unfreeze (planned; today the Cards screen unfreezes at once) | `{cardId, mode: "unfreeze"}` | `accounts.view` |
| `cards` › card › Freeze (planned alternative to the instant freeze) | `{cardId, mode: "freeze"}` | `accounts.view` |
| Deep link `/personal/j/card-controls?cardId=card_9021` | `{cardId}`, optional `mode` (`freeze`, `unfreeze`, `limits`, `where`, `alerts`, `all`) | `accounts.view` |

With a `cardId` the card is fixed and the step "Which card?" is skipped. A `mode` of `freeze`, `unfreeze` or one section name skips "What do you want to change?" and shows that section only.

#### 3. Screens

**Screen 1 `pick`: Which card?** (skipped when `cardId` is passed)

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Card | select ("Everyday debit ••9021"; replaced cards are left out) | yes | the card is active or frozen | not found: "We can’t find that card."; not activated: "Activate this card first."; any other state: "This card can’t be changed." |

**Screen 2 `what`: What do you want to change?** (skipped when a mode is passed). Choice cards: for an active card "Freeze card", "Spending limits", "Where it works", "Alerts"; for a frozen card only "Unfreeze card". Same card checks as above.

**Screen 3 `limits`: Spending limits** (all amounts in dollars, prefilled with the current values)

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Per transaction | amount, hint "Up to $10,000.00" | yes | a number of zero or more | "Enter an amount." |
| | | | not above the bank ceiling for this card | "The most is $10,000.00." |
| | | | not above the daily limit | "Can’t be more than the daily limit." |
| Daily | amount, hint "Up to $15,000.00" | yes | zero or more; not above the ceiling; not above the monthly limit | "Enter an amount." / "The most is $15,000.00." / "Can’t be more than the monthly limit." |
| Monthly | amount, hint "Up to $50,000.00" | yes | zero or more; not above the ceiling | "Enter an amount." / "The most is $50,000.00." |
| Cash withdrawal, daily | amount, hint "Up to $1,500.00" (shown only when the card allows cash) | yes | zero or more; not above the ceiling | "Enter an amount." / "The most is $1,500.00." |

Ceilings are the bank’s limits per card (the examples are for the debit card). A credit card has no cash limit, so that field is not drawn.

**Screen 4 `where`: Where it works**

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Contactless | switch | no | none | none |
| Online | switch | no | none | none |
| International | switch | no | none | none |
| Cash machines | switch (shown only when the card allows cash) | no | none | none |
| Country (optional) | select, placeholder "Anywhere" (a short list of countries; shown when International is on and `allowTrip` is on) | no | none | none |
| From | date, half width, placeholder "Start date" (same condition), today up to 120 days ahead | no | none | none |
| To | date, half width, placeholder "End date" (same condition) | no | not before From | "The end date is before the start date." |
| | | | at most 90 days after From | "A trip can last up to 90 days." |

Step check: if any trip field is filled, all three are needed, else "Add the country and both dates, or clear them."

**Screen 5 `alerts`: Alerts**

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Every transaction | switch | no | none | none |
| Large transactions | switch | no | none | none |
| Alert me from | amount in dollars (shown when Large transactions is on) | yes then | at least $1 | "Enter an amount above zero." |
| | | | at most $100,000 | "The most is $100,000.00." |
| Online purchases | switch | no | none | none |

**Screen 6 `review`: Review.** A card listing every change as "{label}: {before} → {after}", for example "Daily: $3,000.00 → $2,500.00", "Online: On → Off", "Card: Active → Frozen", "Trip: None → {country}, 5 Dec to 12 Dec". If nothing changed: "No changes yet." and the button is blocked with "You haven’t changed anything yet." If any change loosens the card the screen adds "We’ll ask for a code to confirm." and the button reads **Continue**; otherwise it reads **Save changes**. At this step the card is checked again (`CARD_NOT_FOUND`, `CARD_NOT_ACTIVE`).

What counts as loosening: unfreezing; raising any limit; turning on Contactless, Online, International or Cash machines; adding a trip. Lowering a limit, turning a place off, freezing and changing alerts never ask for a code.

**Screen 7 `code`: Enter your code** (only when something loosens)

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Code | text, 6 digits, placeholder "6 digits", hint "{n} tries left" after a wrong code | yes | exactly 6 digits | "Enter the 6-digit code." |

Text "Sent to the phone ending 0142." Button **Save changes** (busy "Checking your code…"). A wrong code: "That code isn’t right. Try again." After three wrong codes: "Too many wrong codes. Nothing was changed. Go back to start again."

**Result.** Title "Card frozen", "Card unfrozen" or "Changes saved" (green). Rows: "Card" ("Everyday debit ••9021") and, except for freeze and unfreeze, one row per change ("Daily", "$3,000.00 → $2,500.00"). Button **Go to cards**.

**States**
- Loading: the button shows "Saving…" with a spinner for about 0.7 seconds; the code step shows "Checking your code…" for 0.6 seconds.
- Empty: not applicable.
- Error: unavailable shows the standard connection sheet with **Try again**; the card is unchanged. Timeout: "This is taking longer than expected. Nothing was changed." with **Try again**.
- Stale: if the card changed in the meantime (not active any more), "This card can’t be changed." and the person goes back to start.

#### 4. Sandbox errors

Codes are for tests and the sandbox; the customer sees only the message.

| Code | Message | Shows on | Button |
|---|---|---|---|
| `CARD_NOT_FOUND` | "We can’t find that card." | pick, review, code | Choose card |
| `CARD_NOT_ACTIVE` | "This card can’t be changed." | pick, what, review, code | Back |
| `OTP_INVALID` | "That code isn’t right. Try again." | code | Try again |
| `OTP_LOCKED` | "Too many wrong codes. Nothing was changed. Go back to start again." | code | Back to start |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | the step | Try again |
| `SERVICE_UNAVAILABLE` | "This isn’t available right now. Nothing was changed. Try again in a few minutes." | the step | Try again |
| `JOURNEY_DISABLED` | "This isn’t available at your bank." | whole journey | none |
| `PERMISSION_DENIED` (planned) | Standard message | whole journey | Back |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `cards` | `bank.cards.list` | none | map of cards | none | Existing |
| `getControls` | `bank.cards.getControls` | `{cardId}` | `{status, limits, ceilings, where, trip, alerts}` | `CARD_NOT_FOUND` | (planned). The prototype reads `CRD` |
| `updateControls` | `bank.cards.updateControls` | `{cardId, status?, limits?, where?, trip?, alerts?}` | `{cardId, changes[]}` | `CARD_NOT_FOUND`, `CARD_NOT_ACTIVE`, `LIMIT_ABOVE_CEILING` | (planned) |
| `sendOtp` / `verifyOtp` | `bank.otp.send` / `bank.otp.verify` | `{channel}` / `{code}` | `{sent}` / `{verified}` | `OTP_INVALID`, `OTP_LOCKED` | Existing (`packages/mock-bank-api/src/index.ts`) |
| `freezeCard` | `bank.cards.freeze` | `{cardId}` | `{cardId, status}` | `CARD_NOT_ACTIVE` | (planned). Used by `cards` |

#### 6. Permissions, step-up and limits

`accounts.view`. Step-up: **none** to tighten; **one-time code** (6 digits, 3 tries) to loosen. Limits: each limit is capped by the bank ceiling for the card; per transaction cannot exceed daily, daily cannot exceed monthly. A change takes effect at once on save.

#### 7. Result and links out

Result as above. Notifications raised (planned): "Your card ending {last4} was frozen" or "unfrozen"; "The limits on your card ending {last4} changed"; "A trip was added to your card ending {last4}". Every save is written to the card change log (audit). Links out: `cards`.

#### 8. Acceptance criteria

- AC-1: Freezing an active card needs no code and leaves it Frozen with the result "Card frozen".
- AC-2: Unfreezing needs a code and leaves the card Active with the result "Card unfrozen".
- AC-3: Each limit is checked against its ceiling and the order per transaction, daily, monthly, with the messages above; the cash field is absent for a card that cannot take cash.
- AC-4: Lowering a limit saves without a code; raising any limit asks for a code first.
- AC-5: Turning a place off (Contactless, Online, International, Cash machines) saves without a code; turning one on asks for a code.
- AC-6: With `allowTrip` on and International on, a trip needs country, From and To together; the end cannot be before the start or more than 90 days after it; with `allowTrip` off the trip fields are absent.
- AC-7: Alerts never ask for a code; "Alert me from" needs an amount from $1 to $100,000 when Large transactions is on.
- AC-8: Review lists exactly the changed values as before and after; with no changes the person cannot continue.
- AC-9: A wrong code does not save; three wrong codes end the attempt with nothing changed.
- AC-10: A not-activated card is refused with "Activate this card first."; a frozen card offers only Unfreeze.
- AC-11: With a `cardId` the card choice is skipped; with a `mode` the section choice is skipped.
- AC-12: When the bank is unavailable or times out nothing is changed.

#### 9. Scenarios

Synthetic persona `alex`, Everyday debit ••9021 (per transaction $2,000, daily $3,000, monthly $15,000, cash $800; all places on), Aurora credit ••3318 and Spare debit ••7745 (not activated). The sandbox code is the fixed test code; any other six digits is wrong.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-11 | `alex`, `cardId` and `mode: "freeze"` | none | Review shows "Card: Active → Frozen", button **Save changes**, no code step, result "Card frozen". |
| T-2 | AC-2 | `alex`, card frozen, `mode: "unfreeze"` | none | Review says "We’ll ask for a code to confirm."; enter the code; result "Card unfrozen". |
| T-3 | AC-3, AC-4 | `alex`, `mode: "limits"` | none | Per transaction 20000: "The most is $10,000.00." Per transaction above daily: "Can’t be more than the daily limit." Daily 2500: review "Daily: $3,000.00 → $2,500.00", **Save changes**, no code. Daily 4000 asks for a code first. On the credit card there is no cash field. |
| T-4 | AC-5 | `alex`, `mode: "where"` | none | Online off: no code. Online on again after saving off: code asked. |
| T-5 | AC-6 | `alex`, `mode: "where"`, International on | none | Country only: "Add the country and both dates, or clear them." End before start: "The end date is before the start date." 100-day trip: "A trip can last up to 90 days." Valid trip: review shows "Trip: None → {country}, {from} to {to}" and asks for a code. With `allowTrip` off the three fields are absent. |
| T-6 | AC-7 | `alex`, `mode: "alerts"` | none | Large on with amount 0: "Enter an amount above zero." Save with Online purchases on: "Changes saved", no code. |
| T-7 | AC-8 | `alex`, `mode: "limits"` | none | No edits: "No changes yet." and "You haven’t changed anything yet." |
| T-8 | AC-9 | `alex`, `mode: "unfreeze"` | none | Wrong code: "That code isn’t right. Try again." with "2 tries left"; three wrong codes: "Too many wrong codes. Nothing was changed. Go back to start again." The card is still Frozen. |
| T-9 | AC-10 | `alex`, no `cardId`, choose Spare debit | none | "Activate this card first." Frozen card: only "Unfreeze card" is offered. |
| T-10 | AC-12 | `alex` | `unavailable: ["bank.cards.updateControls"]` (prototype: Service down on) | Connection sheet; the card is unchanged. |
| T-11 | AC-12 | `alex` | `timeout: ["bank.cards.updateControls"]`, `latencyMs: 10000` | After 10 seconds: "This is taking longer than expected. Nothing was changed." The card is unchanged. |

#### 10. Expected mutation-check survivors

The "per transaction not above daily" and "daily not above monthly" rules survive if the sandbox applies the ceilings only (another layer stops the larger values); expected. The audit log entry is not asserted; expected. Everything else: none expected.

---

### ★ Freeze card — `freeze-card`

**Catalog:** slug `freeze-card`, workspace `personal`, category Cards (Personal: Cards), core no, can a bank switch it off: yes, as its own entry (it is a separate switch in the catalog; turning it off hides this route only and leaves `card-controls` and its freeze option on). Options: none of its own. Registered in `design/bankworkx-r1/src/journeys/06-aliases.js` with permission `accounts.view`.

**Alias of `card-controls`** with `{mode: "freeze"}`. What differs:

- It opens `card-controls` already on the freeze change: "What do you want to change?" is skipped. With a `cardId` the card choice is skipped too. Review shows "Card: Active → Frozen", the button reads **Save changes**, no code is asked, and the result is "Card frozen" with **Go to cards**.
- Unfreezing is not part of this entry. It is `card-controls` with `{mode: "unfreeze"}` and asks for a one-time code (6 digits, 3 tries) because it makes the card easier to use.
- On the Cards screen **Freeze** and **Unfreeze** are instant (toasts "Card frozen" and "Card unfrozen"; "Only an active card can be frozen." and "This card isn’t frozen." when the state is wrong; the connection sheet when the bank is unavailable). Open point: this instant unfreeze has no code, while `card-controls` asks for one; the product rule is a code and the Cards screen should follow (see `cards` T-6). Acceptance criteria AC-1, AC-2, AC-9 and AC-12 and scenarios T-1, T-2, T-8, T-10 and T-11 of `card-controls` cover it.

---

### ★ Virtual card — `virtual-card`

**Catalog:** slug `virtual-card`, workspace `personal`, category Cards (Personal: Cards), core no, can a bank switch it off: yes (a basic entry, kept in the Lean preset). Options: **Offer a 3 year card as well as single use** (`allowThreeYears`, default on). Research: `research/virtual-card.md`. Built in `design/bankworkx-r1/src/journeys/62-card-service.js`, on the shared card data `CRD` from `24-cards.js`.

The card is named after its purpose; there is no nickname field and no merchant lock. A virtual card is linked to one of the customer’s active cards, has its own limit, and its details are shown once after a code.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `virtual-card` |
| Purpose | Create a virtual card for online shopping, subscriptions or a single payment, with its own limit. |
| Release / workspace | 1 / Personal |
| Status | Built in the prototype as a form journey (`submit: "Create card"`, `confirm` with a code). |
| Channels | Web and mobile |
| Starting pattern | Which card (when more than one), purpose, limit, how long (optional), review, a code, a result showing the details once |
| Who may use it | `accounts.manage`, for their own cards. |

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Cards › Virtual card | `{cardId}` (optional; a card that is not an active physical card is ignored) | `accounts.manage` |

The card step is skipped when the card was passed in, or when the customer has only one active physical card.

#### 3. Screens

**Screen 1 `card`: Link to which card?** A red notice shows the reason when the card cannot be used.

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Card | select (active physical cards, for example "Everyday debit ••9021") | yes | active, not virtual | "Choose an active card to link this to." |
| | | | fewer than 5 active virtual cards on it | "You have 5 virtual cards on this card, the most you can have. Delete one first." |

**Screen 2 `purpose`: What is it for?** Choice cards: "Online shopping" ("Use it with any online shop"), "Subscriptions" ("For regular payments"), "One-time purchase" ("Closes after one payment"). The same card notice shows. Choosing One-time purchase sets the length to single use.

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Purpose | choice cards | yes | one chosen | "Choose a purpose." |

**Screen 3 `limit`: Spending limit.**

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Limit | amount in dollars, placeholder "0.00"; hint "The most it can spend in one payment." (one-time) or "The most it can spend in a month." | yes | at least $1 | "The smallest limit is $1.00." |
| | | | at most $5,000 | "The most is $5,000.00." |

**Screen 4 `expiry`: How long should it last?** Shown only when `allowThreeYears` is on and the purpose is not One-time purchase. Choice cards "Single use" ("Closes after one payment") and "3 years" ("Until it expires or you delete it"). With the option off, every virtual card is single use and this screen is skipped.

**Screen 5 `review`: Review.** Rows Linked to, Purpose, Limit ("$x per payment" for one-time, otherwise "$x a month"), Lasts ("One payment" or "3 years").

**Screen 6 `confirm`: Create a virtual card.** The standard code sheet: "Code sent to ••• 0142. You’ll see the card details once." (6 digits). Wrong code: "That code isn’t right. Try again." The button is **Create card**.

**Result** (green). Title "Virtual card ready", text "Save these details now. We won’t show the number again.", status "Single use" or "Active". Rows Card number (with **Copy**), Expiry (Copy), Security code (Copy), Limit, Purpose. Button **Go to cards**. The new card appears in the card list, linked to its parent, with online and international on and cash and contactless off.

**States**
- Loading: a spinner on the code step.
- Empty: not applicable.
- Error: unavailable shows "This isn’t available right now. Nothing was changed. Try again in a few minutes."; timeout shows "This is taking longer than expected. Nothing was changed." Both with **Try again**; no card is made.
- Stale: if the parent card stopped being active or reached 5 virtual cards, the commit fails with the message of that code.

**Home market configuration:** none.

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `CARD_NOT_FOUND` | "Choose an active card to link this to." | card, purpose, commit | Choose card |
| `VIRTUAL_LIMIT` | "You have 5 virtual cards on this card, the most you can have. Delete one first." | card, purpose, commit | Back |
| `LIMIT_INVALID` | "Choose a limit within what the card allows." | limit, commit | Change limit |
| `OTP_INVALID` | "That code isn’t right. Try again." | code | Try again |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | the step | Try again |
| `SERVICE_UNAVAILABLE` | "This isn’t available right now. Nothing was changed. Try again in a few minutes." | the step | Try again |
| `JOURNEY_DISABLED` | "This isn’t available at your bank." | whole journey | none |
| `PERMISSION_DENIED` (planned) | Standard message | whole journey | Back |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `cards` | `bank.cards.list` | none | map of cards | none | Existing (`packages/mock-bank-api/src/index.ts`) |
| `createVirtualCard` | `bank.cards.createVirtual` | `{parentCardId, purpose, limit, single}` | `{cardId, number, expiry, cvv}` | `CARD_NOT_FOUND`, `VIRTUAL_LIMIT`, `LIMIT_INVALID` | (planned). The prototype makes a test number that passes the check digit |
| `sendOtp` / `verifyOtp` | `bank.otp.send` / `bank.otp.verify` | `{channel}` / `{code}` | `{sent}` / `{verified}` | `OTP_INVALID` | Existing |

The full number and security code are returned once, shown once and never stored or logged afterwards.

#### 6. Permissions, step-up and limits

`accounts.manage`. Step-up: one-time code (6 digits, 3 tries) before the card is made. Limits: $1.00 to $5,000.00; at most 5 active virtual cards per card. The virtual card spends from the parent’s account.

#### 7. Result and links out

Result as above. Notifications raised (planned): "A virtual card was created on your card ending {last4}". The creation is written to the card change log (audit). Links out: `cards`, `card-controls` (to freeze or limit the virtual card).

#### 8. Acceptance criteria

- AC-1: The card must be an active physical card with fewer than 5 virtual cards.
- AC-2: The limit is from $1.00 to $5,000.00 with the messages above.
- AC-3: A one-time purchase is always single use and shows the limit "per payment".
- AC-4: With `allowThreeYears` on a shopping or subscriptions card can last 3 years; with it off every card is single use.
- AC-5: A wrong code makes no card; the right code makes the card and shows its details once with Copy.
- AC-6: The card is linked to its parent, online and international on, cash and contactless off.
- AC-7: The details are not shown again after the result.
- AC-8: When the bank is unavailable or times out no card is made.

#### 9. Scenarios

Synthetic persona `alex`, Everyday debit ••9021 (one existing virtual card ••6150), Aurora credit ••3318. The sandbox code is the fixed test code.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-5, AC-6 | `alex`, `cardId: "card_9021"` | none | Online shopping, limit 200, review "Linked to Everyday debit ••9021", code: "Virtual card ready", details with Copy. |
| T-2 | AC-2 | `alex` | none | 0.5: "The smallest limit is $1.00."; 6000: "The most is $5,000.00." |
| T-3 | AC-3 | `alex` | none | One-time purchase: hint "The most it can spend in one payment."; review "$x per payment", "One payment". |
| T-4 | AC-4 | `alex`, `allowThreeYears` on, then off | none | Online shopping shows "How long should it last?"; "3 years" gives "3 years" on review; with the option off the screen is absent. |
| T-5 | AC-1 | `alex`, four more virtual cards on ••9021 | none | A sixth: "You have 5 virtual cards on this card, the most you can have. Delete one first." |
| T-6 | AC-5 | `alex` | none | Wrong code: "That code isn’t right. Try again." and no card is made. |
| T-7 | AC-7 | `alex`, after T-1 | none | Cards shows the new card as "Online shopping ••{last4}" with no number or code. |
| T-8 | AC-8 | `alex` | `unavailable: ["bank.cards.createVirtual"]` (prototype: Service down on) | The connection sheet shows; no card is made. |
| T-9 | AC-8 | `alex` | `timeout: ["bank.cards.createVirtual"]`, `latencyMs: 10000` | After 10 seconds "This is taking longer than expected. Nothing was changed." |

#### 10. Expected mutation-check survivors

The per-month versus per-payment hint survives if only the limit value is asserted; expected. The 5-card rule survives at the first two screens because the commit checks it again; expected. The audit entry is not asserted; expected. Everything else: none expected.

---

### ★ Replace a card — `replace-card`

**Catalog:** slug `replace-card`, workspace `personal`, category Cards (Personal: Cards), core no, can a bank switch it off: yes (a basic entry, kept in the Lean preset). Options: **Charge a fee for express delivery** (`expressFee`, default on; the fee is $15.00). Research: `research/replace-card.md`. Built in `design/bankworkx-r1/src/journeys/62-card-service.js`, on the shared card data `CRD` from `24-cards.js`.

A lost or stolen card is blocked at the "What happened?" step, before the rest of the order, so the block does not wait for a code. A code is asked only when there is a fee to pay.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `replace-card` |
| Purpose | Order a replacement for a lost, stolen, damaged or expired card. A lost or stolen card is blocked straight away. |
| Release / workspace | 1 / Personal |
| Status | Built in the prototype as a form journey (`submit: "Order card"`, `money: true`; step-up is `none` unless a fee applies). Test parameters `{cardId: "card_9021", reason: "damaged"}`. |
| Channels | Web and mobile |
| Starting pattern | Which card, reason (with the block), delivery, review, a code only for a fee, a result |
| Who may use it | `accounts.manage`, for their own cards. |

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Cards › Replace | `{cardId}` | `accounts.manage` |
| Cards › a blocked or expired card › Replace | `{cardId}` | `accounts.manage` |
| Deep link `/personal/j/replace-card?cardId=card_9021&reason=damaged` | `{cardId}`, optional `reason` (`lost`, `stolen`, `damaged`, `expired`) | `accounts.manage` |

With a `cardId` the card is fixed and "Which card?" is skipped. Without one the first blocked or expired physical card is preselected.

#### 3. Screens

**Screen 1 `pick`: Which card?** (skipped when `cardId` is passed). A red notice shows the reason when the card cannot be replaced.

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Card | select (physical cards that are not replaced; a virtual card can only arrive by a deep link) | yes | an existing card | "We can’t find that card." |
| | | | not virtual | "Virtual cards can’t be replaced. Create a new one instead." |
| | | | not already replaced | "This card has already been replaced." |
| | | | activated | "This card isn’t active yet." |
| | | | no replacement already ordered | "A replacement is already on its way. It arrives by {date}." |

**Screen 2 `reason`: What happened?** Choice cards: "Lost" ("We block it now"), "Stolen" ("We block it now"), "Damaged" ("It keeps working until the new one arrives"), "Expired" ("Your card has run out"; unavailable unless the card has expired or has 60 days or fewer left). The button reads **Block card and continue** for Lost and Stolen, otherwise **Continue**, and shows "Please wait…" for about 0.6 seconds. Pressing it checks the card again and, for Lost and Stolen, blocks the card at once.

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Reason | choice cards | yes | one chosen | "Choose a reason." |

**Screen 3 `delivery`: Delivery.** After a block a green card shows "{card} is blocked" and "No one can use it. This can’t be undone."

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Send it to | choice cards "Home address" (the address on file) or "Another address" | yes | one chosen | none |
| Address line | text, up to 60 characters (shown for another address) | yes | at least 3 characters | the standard short-field message (planned wording) |
| City | text, half width, up to 40 characters (same) | yes | at least 2 characters | the standard short-field message (planned wording) |
| Postcode | text, half width (same; not shown in Market D) | yes | 3 to 10 letters, digits, spaces or hyphens | "Enter a valid postcode." |
| How fast? | choice cards "Standard" (by the 5th working day, "Free") or "Express" (by the 2nd working day, "$15.00" with `expressFee`, otherwise "Free") | yes | one chosen | none |

**Screen 4 `review`: Review.** The button shows "Checking…" for about 0.5 seconds. Rows Card, Reason, Deliver to, Delivery ("Standard, by {date}" or "Express, by {date}"), Fee ("Free" or "$15.00"), and "Old card: Blocked" for Lost and Stolen. The account is checked: a fee above the available balance is refused.

**Screen 5 `confirm`** (only when the fee is above zero): Authorise $15.00 delivery fee. The standard code sheet: "Code sent to ••• 0142." (6 digits). Wrong code: "That code isn’t right. Try again."

**Result** (green). Title "Card blocked and replacement ordered" (Lost or Stolen) or "Replacement ordered", text "It arrives by {date}.", status "On its way". Rows Old card (with "(blocked)" when blocked), New card ("••{last4}"), Deliver to, Arrives by, Fee. Button **Go to cards**. The new card appears as Not activated (see `activate-card`). The old card becomes Replaced, except for a Damaged card that has not expired, which keeps working until the new one is activated.

**States**
- Loading: "Please wait…", "Checking…" and a spinner on the code step.
- Empty: not applicable.
- Error: unavailable shows "This isn’t available right now. Try again in a few minutes. If your card is lost or stolen, call us."; timeout shows "This is taking longer than expected. Check your cards before you try again." Both with **Try again**.
- Stale: a second order for the same card is refused with "A replacement is already on its way."

**Home market configuration** (the home address on file and the postcode rule)

| Market | Home address shown (synthetic) | Postcode asked for another address |
|---|---|---|
| Market A (routing number and account) | 12 Example Street, Springfield 62704 | yes |
| Market B (sort code and account) | 12 Example Road, London SW1A 1AA | yes |
| Market C (IBAN) | Beispielstrasse 5, Berlin 10115 | yes |
| Market D (IBAN, mobile alias) | Example Tower, Flat 1204, Dubai | no |

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `CARD_NOT_FOUND` | "We can’t find that card." | pick, reason, commit | Choose card |
| `REPLACEMENT_PENDING` | "A replacement is already on its way." | reason, commit | Back to cards |
| `INSUFFICIENT_FUNDS` | "Not enough in your account to pay the delivery fee." | review, commit | Choose Standard |
| `OTP_INVALID` | "That code isn’t right. Try again." | code | Try again |
| `TIMEOUT` | "This is taking longer than expected. Check your cards before you try again." | the step | Try again |
| `SERVICE_UNAVAILABLE` | "This isn’t available right now. Try again in a few minutes. If your card is lost or stolen, call us." | the step | Try again |
| `JOURNEY_DISABLED` | "This isn’t available at your bank." | whole journey | none |
| `PERMISSION_DENIED` (planned) | Standard message | whole journey | Back |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `cards` | `bank.cards.list` | none | map of cards | none | Existing (`packages/mock-bank-api/src/index.ts`) |
| `blockCard` | `bank.cards.block` | `{cardId, reason}` | `{cardId, status}` | `CARD_NOT_FOUND` | (planned). Used at the reason step for Lost and Stolen |
| `replaceCard` | `bank.cards.replace` | `{cardId, reason, address, speed}` | `{newCardId, last4, arrivesBy, fee}` | `CARD_NOT_FOUND`, `REPLACEMENT_PENDING`, `INSUFFICIENT_FUNDS` | (planned) |
| `sendOtp` / `verifyOtp` | `bank.otp.send` / `bank.otp.verify` | `{channel}` / `{code}` | `{sent}` / `{verified}` | `OTP_INVALID` | Existing |

#### 6. Permissions, step-up and limits

`accounts.manage`. Step-up: **none** when the delivery is free (the block and the order); a **one-time code** (6 digits, 3 tries) when there is a fee. Limits: one replacement at a time per card. The fee is taken from the card’s account and shown in activity as "Card delivery fee".

#### 7. Result and links out

Result as above. Notifications raised (planned): "Your card ending {last4} was blocked" and "A replacement card is on its way, arriving by {date}". The block and the order are written to the card change log (audit). Links out: `cards`, `activate-card`.

#### 8. Acceptance criteria

- AC-1: Lost and Stolen block the card when the person presses **Block card and continue**, before delivery is chosen and without a code.
- AC-2: Damaged leaves the old card working; Expired is offered only for an expired card or one with 60 days or fewer left.
- AC-3: Virtual, not-activated, already-replaced and already-replacing cards are refused with the messages above.
- AC-4: The delivery address is the home address or another address with a valid postcode (none in Market D).
- AC-5: Standard is free; Express costs $15.00 only while `expressFee` is on.
- AC-6: No code is asked for a free order; a code is asked when there is a fee, and a wrong code orders nothing.
- AC-7: A fee above the available balance is refused and nothing is ordered.
- AC-8: The result shows the new card as Not activated with an arrival date; a second order for the same card is refused.
- AC-9: When the bank is unavailable or times out nothing is ordered; a block already made stays.

#### 9. Scenarios

Synthetic persona `alex`, Everyday debit ••9021, Aurora credit ••3318, Spare debit ••7745 (not activated). The home market is Market A unless stated. The sandbox code is the fixed test code.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-4, AC-5, AC-6, AC-8 | `alex`, `cardId: "card_9021"`, Lost, home address, Standard | none | **Block card and continue** blocks ••9021; review shows "Old card: Blocked", Fee "Free"; no code; "Card blocked and replacement ordered"; the new card is Not activated. |
| T-2 | AC-2, AC-5 | `alex`, `reason: "damaged"`, Express, `expressFee` on | none | Fee "$15.00"; code asked; "Replacement ordered"; the old card is still Active. |
| T-3 | AC-2 | `alex`, `cardId: "card_9021"` | none | "Expired" is unavailable (the card runs to 09/29). |
| T-4 | AC-3 | `alex`, no `cardId` | none | Spare debit: "This card isn’t active yet."; after T-1, ••9021: "A replacement is already on its way. It arrives by {date}." |
| T-5 | AC-4 | `alex`, Another address, then Market D | none | Address "ab": the short-field message; postcode "1": "Enter a valid postcode."; in Market D no postcode field. |
| T-6 | AC-5 | `alex`, `expressFee` off | none | Express shows "Free"; no code. |
| T-7 | AC-6 | `alex`, Express with a fee | none | Wrong code: "That code isn’t right. Try again." and nothing is ordered. |
| T-8 | AC-7 | `alex`, account with less than $15 available, Express | none | "Not enough in your account to pay the delivery fee." |
| T-9 | AC-9 | `alex` | `unavailable: ["bank.cards.replace"]` (prototype: Service down on) | The connection sheet; no order. |
| T-10 | AC-9 | `alex` | `timeout: ["bank.cards.replace"]`, `latencyMs: 10000` | After 10 seconds "This is taking longer than expected. Check your cards before you try again." |

#### 10. Expected mutation-check survivors

The "Expired only near expiry" rule survives if no scenario uses a card near expiry; add one to kill it. The balance check at review survives because the commit checks it again; expected. The audit entry is not asserted; expected. Everything else: none expected.

---

### ★ Card PIN — `card-pin`

**Catalog:** slug `card-pin`, workspace `personal`, category Cards (Personal: Cards), core no, can a bank switch it off: yes (a basic entry, kept in the Lean preset). Options: **Refuse easy PINs (repeats and sequences)** (`blockWeak`, default on). Research: `research/card-pin.md`. Built in `design/bankworkx-r1/src/journeys/62-card-service.js`, on the shared card data `CRD` from `24-cards.js`.

There is no "show PIN" option and no PIN reminder. The PIN is typed twice, never shown, and never stored by the app. A code is always asked first.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `card-pin` |
| Purpose | Set or change a card’s PIN after a code. The PIN is never shown. |
| Release / workspace | 1 / Personal |
| Status | Built in the prototype as a form journey (`submit: "Save PIN"`). Test parameters `{cardId: "card_9021", smoke: 1}`. |
| Channels | Web and mobile |
| Starting pattern | Which card, a code, new PIN twice, result |
| Who may use it | Anyone signed in to Personal with `accounts.view`, for their own cards. |

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Cards › PIN | `{cardId}` | `accounts.view` |

With a `cardId` the card is fixed and "Which card?" is skipped. Without one the first active or frozen physical card is preselected.

#### 3. Screens

**Screen 1 `pick`: Which card?** (skipped when `cardId` is passed). A red notice shows the reason when the chosen card cannot be used.

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Card | select (physical cards; replaced cards are left out; for example "Everyday debit ••9021") | yes | the card is active or frozen | not found: "We can’t find that card."; virtual: "Virtual cards don’t have a PIN."; not activated: "Activate this card first."; any other state: "This card can’t be changed." |

**Screen 2 `code`: Enter your code.** Text "Sent to the phone ending 0142." Button **Continue** (busy "Checking your code…", about 0.5 seconds). The card is checked again here.

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Code | text, 6 digits, placeholder "6 digits", hint "{n} tries left" after a wrong code | yes | exactly 6 digits | "Enter the 6-digit code." |

A wrong code: "That code isn’t right. Try again." After three wrong codes: "Too many wrong codes. Nothing was changed. Go back to start again."

**Screen 3 `pin`: New PIN.** A card shows the card name and "4 digits. Don’t use your birthday." Button **Save PIN** (busy "Saving your PIN…", about 0.7 seconds).

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| New PIN | hidden text, 4 digits | yes | exactly 4 digits | "Enter 4 digits." |
| | | | with `blockWeak` on: not the same digit four times | "Don’t use the same digit four times." |
| | | | not a run up or down, like 1234 or 4321 | "Don’t use numbers in a row, like 1234." |
| | | | not a pattern like 1212 | "Choose a PIN that’s harder to guess." |
| | | | not the last four digits of the card or its expiry as MMYY | "Don’t use part of your card number or expiry date." |
| Confirm PIN | hidden text, 4 digits | yes | equal to the new PIN | "The PINs don’t match." |

**Result** (green). Title "PIN set" (first time) or "PIN changed", text "Use your new PIN from now on." Rows Card and "Ready to use" ("Now"). Button **Go to cards**. The PIN and the code are cleared from memory.

**States**
- Loading: "Checking your code…" and "Saving your PIN…".
- Empty: not applicable.
- Error: unavailable shows "This isn’t available right now. Nothing was changed. Try again in a few minutes."; timeout shows "This is taking longer than expected. Nothing was changed." Both with **Try again**; the PIN is not saved.
- Stale: if the card changed state meanwhile, the notice of the card checks shows and the person goes back.

**Home market configuration:** none.

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `CARD_NOT_FOUND` | "We can’t find that card." | pick, code | Choose card |
| `OTP_INVALID` | "That code isn’t right. Try again." | code | Try again |
| `OTP_LOCKED` | "Too many wrong codes. Nothing was changed. Go back to start again." | code | Back to start |
| `PIN_WEAK` | "Choose a PIN that’s harder to guess." | pin | Change PIN |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | the step | Try again |
| `SERVICE_UNAVAILABLE` | "This isn’t available right now. Nothing was changed. Try again in a few minutes." | the step | Try again |
| `JOURNEY_DISABLED` | "This isn’t available at your bank." | whole journey | none |
| `PERMISSION_DENIED` (planned) | Standard message | whole journey | Back |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `cards` | `bank.cards.list` | none | map of cards | none | Existing (`packages/mock-bank-api/src/index.ts`) |
| `setPin` | `bank.cards.setPin` | `{cardId, pin}` | `{cardId, firstSet}` | `CARD_NOT_FOUND`, `CARD_NOT_ACTIVE`, `PIN_WEAK` | (planned). The prototype only sets a flag on the card |
| `sendOtp` / `verifyOtp` | `bank.otp.send` / `bank.otp.verify` | `{channel}` / `{code}` | `{sent}` / `{verified}` | `OTP_INVALID`, `OTP_LOCKED` | Existing |

The PIN goes to the card system encrypted and is never written to a log, the activity list or a notification.

#### 6. Permissions, step-up and limits

`accounts.view`. Step-up: one-time code (6 digits, 3 tries) for every change. Limits: none. The PIN is 4 digits.

#### 7. Result and links out

Result as above. Notifications raised (planned): "The PIN on your card ending {last4} was changed". Every change is written to the card change log (audit) without the PIN. Links out: `cards`.

#### 8. Acceptance criteria

- AC-1: A code is asked before a PIN can be set, and a wrong code sets nothing.
- AC-2: The PIN is 4 digits typed twice, and both must match.
- AC-3: With `blockWeak` on, repeated digits, runs, patterns like 1212 and the last four digits or expiry of the card are refused with the messages above; with it off any 4 digits pass.
- AC-4: Virtual, not-activated, blocked and replaced cards are refused with the messages above.
- AC-5: The first PIN shows "PIN set"; a later one shows "PIN changed".
- AC-6: Three wrong codes end the attempt with nothing changed.
- AC-7: The PIN never appears in the result, the logs or the audit entry.
- AC-8: When the bank is unavailable or times out the PIN is not saved.

#### 9. Scenarios

Synthetic persona `alex`, Everyday debit ••9021 (PIN set), Spare debit ••7745 (not activated, no PIN), virtual card ••6150. The sandbox code is the fixed test code.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-2, AC-5 | `alex`, `cardId: "card_9021"` | none | Code, PIN 2580 twice: "PIN changed". |
| T-2 | AC-2 | `alex`, `cardId` | none | Confirm 2581: "The PINs don’t match." 123: "Enter 4 digits." |
| T-3 | AC-3 | `alex`, `blockWeak` on, then off | none | 1111, 1234, 4321, 1212, 9021: each refused with its message; with the option off 1111 is accepted. |
| T-4 | AC-4 | `alex`, no `cardId` | none | Spare debit: "Activate this card first."; the virtual card is not in the list. |
| T-5 | AC-5 | `alex`, an activated card without a PIN | none | Result "PIN set". |
| T-6 | AC-1, AC-6 | `alex` | none | Wrong code: "That code isn’t right. Try again." with "2 tries left"; third: "Too many wrong codes. Nothing was changed. Go back to start again." |
| T-7 | AC-7 | `alex` | none | The result, the card change log and the activity list show no PIN. |
| T-8 | AC-8 | `alex` | `unavailable: ["bank.cards.setPin"]` (prototype: Service down on) | The connection sheet shows; the PIN is unchanged. |
| T-9 | AC-8 | `alex` | `timeout: ["bank.cards.setPin"]`, `latencyMs: 10000` | After 10 seconds "This is taking longer than expected. Nothing was changed." |

#### 10. Expected mutation-check survivors

The "last four or expiry" rule survives if no scenario uses it; T-3 uses 9021 to kill it. The pattern rule 1212 survives with a single example; add a second. The audit log entry is not asserted; expected. Everything else: none expected.

---

### ★ Report a problem with a payment — `dispute-transaction`

**Catalog:** slug `dispute-transaction` (name in the prototype "Report a problem with a payment"), workspace `personal`, category Cards (Personal: Cards), core no, can a bank switch it off: yes (a basic entry, kept in the Lean preset). Options: **Let people add a receipt or screenshot** (`allowEvidence`, default on); **Offer to block the card when a payment isn’t recognised** (`offerBlock`, default on). Research: `research/dispute-transaction.md`. Built in `design/bankworkx-r1/src/journeys/62-card-service.js`, on the shared card data `CRD` from `24-cards.js`.

The report moves no money and gives no refund by itself; the bank decides after review. Only a payment that has posted, that went out, was made by card and is at most 120 days old can be reported, and only once.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `dispute-transaction` |
| Purpose | Report a card payment the person doesn’t recognise or that went wrong. |
| Release / workspace | 1 / Personal |
| Status | Built in the prototype as a form journey (`submit: "Send report"`, `basic: true`). Test parameter `{txId: "cur-5"}`. |
| Channels | Web and mobile |
| Starting pattern | Which payment, what went wrong, details, evidence, declaration, result with what happens next |
| Who may use it | Anyone signed in to Personal with `accounts.view`, for their own payments. |

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Transaction › Report a problem | `{txId}` | `accounts.view` |
| Cards › a transaction › Report a problem | `{txId}` | `accounts.view` |

With a `txId` the payment is fixed and "Which payment?" is skipped. The payment is found in the account activity, the card activity or the home list.

#### 3. Screens

**Screen 1 `pick`: Which payment?** (skipped when `txId` is passed). A red notice shows the reason when the chosen payment cannot be reported.

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Payment | select (up to 12 of the latest posted card payments from the current account, "{merchant} · {amount} · {date}") | yes | the payment can be reported (see the checks below) | the check message |

Checks, in this order: not found "We can’t find that payment."; pending "This payment is still pending. You can report a problem once it has posted."; money in "Only payments out can be reported."; not a card payment "This payment can’t be reported here. Contact us."; already reported "You’ve already reported this payment. Case {ref}."; older than 120 days "It’s been more than 120 days since this payment. Contact us."

**Screen 2 `reason`: What went wrong?** A card at the top shows the merchant, the date and the amount, with the red notice when the payment cannot be reported.

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Reason | choice cards: "I don’t recognise it", "Charged twice", "Wrong amount", "Goods or service not received", "Cancelled but charged", "Other" | yes | one chosen | "Choose a reason." |

**Screen 3 `details`: Tell us more.** The fields depend on the reason:

| Reason | Field | Type | Required | Validation | Message |
|---|---|---|---|---|---|
| I don’t recognise it | Do you still have your card? | chips "Yes" / "No" | yes | one chosen (choosing "No" turns the block switch on) | none |
| I don’t recognise it | Block this card and order a new one | switch, "Recommended if someone else may have your details" (shown when `offerBlock` is on and the card is active) | no | none | none |
| Charged twice | When was the other charge? | select, the last 30 days | yes | one chosen | none |
| Wrong amount | Amount you expected | amount in dollars | yes | not equal to the amount charged | "This is the amount that was charged." |
| Goods or service not received | What did you order? | text, up to 80 characters | yes | at least 3 characters | "Tell us what you ordered." |
| Goods or service not received | When should it have arrived? | select, the last 60 days | yes | one chosen | none |
| Goods or service not received | Have you contacted the merchant? | chips "Yes" / "Not yet" | yes | hint after "Not yet": "If you can, contact the merchant first. You can still send this report." | none |
| Cancelled but charged | When did you cancel? | select, the last 90 days | yes | one chosen | none |
| Cancelled but charged | Cancellation reference (optional) | text, up to 30 characters | no | none | none |
| Other | What happened? | long text, up to 300 characters | yes | at least 10 characters | "Tell us a little more (at least 10 characters)." |

**Screen 4 `evidence`: Add evidence** (only when `allowEvidence` is on). Intro "Optional. A receipt, order email or screenshot helps." One file field "Add a file" (sample files "Receipt.pdf", "Screenshot.png"). Button **Continue**. A file is optional.

**Screen 5 `declare`: Confirm and send.** Rows Payment, Amount, Reason and Evidence (the file name, when added). Button **Send report** (busy "Sending…", about 0.7 seconds).

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| I confirm what I’ve told you is true and complete. | checkbox | yes | ticked | "Please confirm to continue." |

**Result** (green). Title "Report received", text "We’ll keep you updated in your messages.", status "Under review", with a case reference (for example DSP-…). Rows Payment, Amount, Reason, "Card: Blocked" when the card was blocked, then what happens next: "Within 2 working days: We review your report", "Within 10 working days: We ask the merchant", "Within 45 days: You get our decision". Button **Back to cards**. The payment is marked as reported with its case reference in the activity list.

**States**
- Loading: "Sending…".
- Empty: when there is no reportable payment the select is empty and the notice of the checks shows.
- Error: unavailable shows "This isn’t available right now. Nothing was sent. Try again in a few minutes."; timeout shows "This is taking longer than expected. Nothing was sent." Both with **Try again**; the report is not made.
- Stale: if the payment was reported or aged out meanwhile, the commit fails with the message of that code.

**Home market configuration:** none. Amounts are in the account currency, shown here as dollars. The 120-day window and the review times are the bank’s settings in the sandbox.

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `TX_NOT_FOUND` | "We can’t find that payment." | pick, commit | Choose payment |
| `TX_PENDING` | "This payment is still pending. You can report a problem once it has posted." | pick, reason, commit | Back |
| `ALREADY_DISPUTED` | "You’ve already reported this payment." (in the notice: "You’ve already reported this payment. Case {ref}.") | pick, reason, commit | Back |
| `TOO_OLD` | "It’s been more than 120 days since this payment. Contact us." | pick, reason, commit | Contact us |
| `TIMEOUT` | "This is taking longer than expected. Nothing was sent." | the step | Try again |
| `SERVICE_UNAVAILABLE` | "This isn’t available right now. Nothing was sent. Try again in a few minutes." | the step | Try again |
| `JOURNEY_DISABLED` | "This isn’t available at your bank." | whole journey | none |
| `PERMISSION_DENIED` (planned) | Standard message | whole journey | Back |

The notices "Only payments out can be reported." and "This payment can’t be reported here. Contact us." have no code of their own in the prototype; at commit they come back as `ALREADY_DISPUTED` (see the report note). In the spec they get their own codes `NOT_A_PAYMENT_OUT` and `NOT_A_CARD_PAYMENT` (planned).

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `transactions` | `bank.transactions.list` | `{accountId}` | transactions | none | (planned). The prototype reads its own activity data |
| `createDispute` | `bank.disputes.create` | `{transactionId, reason, details, blockCard, evidenceId?}` | `{caseRef, cardBlocked}` | `TX_NOT_FOUND`, `TX_PENDING`, `ALREADY_DISPUTED`, `TOO_OLD`, `NOT_A_PAYMENT_OUT`, `NOT_A_CARD_PAYMENT` | (planned) |
| `uploadEvidence` | `bank.files.upload` | file | `{fileId}` | `FILE_*` | (planned). One file; a receipt or screenshot |

#### 6. Permissions, step-up and limits

`accounts.view`. Step-up: **none**; the report moves no money. Blocking the card from the report is immediate and needs no code (it only restricts the card). Limits: one report per payment; 120 days.

#### 7. Result and links out

Result as above. Notifications raised (planned): "We received your report, case {ref}" and updates at each stage; the message also arrives in `new-message`. The report and any block are written to the card change log (audit). Links out: `cards`, `card-controls`, `contact-support`.

#### 8. Acceptance criteria

- AC-1: Only a posted card payment out, at most 120 days old and not already reported, can be reported, with the messages above.
- AC-2: The details asked depend on the reason, with the validations above.
- AC-3: "I don’t recognise it" offers to block the card when `offerBlock` is on and the card is active; answering "No" to "Do you still have your card?" turns the block on.
- AC-4: The evidence step appears only when `allowEvidence` is on and is optional.
- AC-5: The report cannot be sent until the declaration is ticked.
- AC-6: Sending creates one case, marks the payment as reported and shows "Report received" with the case reference and the three next steps.
- AC-7: A second report for the same payment is refused with the case reference.
- AC-8: With the block on the card becomes Blocked and the result says so.
- AC-9: When the bank is unavailable or times out nothing is sent.

#### 9. Scenarios

Synthetic persona `alex`, Current ••4410 with card payments, Everyday debit ••9021. Test payment `txId: "cur-5"`.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-2, AC-5, AC-6 | `alex`, `txId: "cur-5"` | none | "Charged twice", date, declaration, **Send report**: "Report received", status "Under review", a case reference and the three steps. |
| T-2 | AC-1 | `alex` | none | A pending payment: "This payment is still pending. You can report a problem once it has posted." A payment in: "Only payments out can be reported." A transfer: "This payment can’t be reported here. Contact us." A payment 130 days old: "It’s been more than 120 days since this payment. Contact us." |
| T-3 | AC-2 | `alex` | none | Wrong amount equal to the charge: "This is the amount that was charged."; "Other" with 5 characters: "Tell us a little more (at least 10 characters)."; not received with "ab": "Tell us what you ordered." |
| T-4 | AC-3, AC-8 | `alex`, "I don’t recognise it", an active card | none | "No" to "Do you still have your card?" turns the block switch on; after sending, "Card: Blocked" and the card is Blocked. With `offerBlock` off the switch is absent. |
| T-5 | AC-4 | `alex`, `allowEvidence` on, then off | none | Evidence step with "Add a file", optional; with the option off the step is absent. |
| T-6 | AC-5 | `alex` | none | Send without the tick: "Please confirm to continue." |
| T-7 | AC-7 | `alex`, T-1 done | none | The same payment: "You’ve already reported this payment. Case {ref}." |
| T-8 | AC-9 | `alex` | `unavailable: ["bank.disputes.create"]` (prototype: Service down on) | The connection sheet; nothing is sent. |
| T-9 | AC-9 | `alex` | `timeout: ["bank.disputes.create"]`, `latencyMs: 10000` | After 10 seconds "This is taking longer than expected. Nothing was sent." |

#### 10. Expected mutation-check survivors

The 120-day limit survives if no scenario uses a payment near 120 days; T-2 uses 130 days and a second, 119 days, kills the boundary. The "amount equal to the charge" rule survives if the sandbox does not assert it; expected. The audit entry is not asserted; expected. Everything else: none expected.

---

### ★ Add a card — `add-card`

**Catalog:** slug `add-card`, workspace `personal`, category Cards (Personal: Cards), core no, can a bank switch it off: yes (a basic entry, kept in the Lean preset). Options: **Accept the 15-digit card type** (`acceptAmex`, default on); **Let saved cards be used for paying as well as adding money** (`allowPay`, default on). Research: `research/add-card.md`. Built in `design/bankworkx-r1/src/journeys/61-topup-card-extras.js`. It saves a card from another bank (an external card); it does not issue a BankWorkx® card.

There is no default-card choice. Up to 5 cards can be saved. A card is saved only after a check that proves the person holds it.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `add-card` |
| Purpose | Save a card from another bank to add money or pay. A code checks the card before it is saved. |
| Release / workspace | 1 / Personal |
| Status | Built in the prototype as a form journey (`submit: "Save card"`, `basic: true`). Test parameter `{smoke: 1}` prefills the security code. |
| Channels | Web and mobile |
| Starting pattern | Card details with a check, a verification code, nickname and uses, result |
| Who may use it | `payments.create` |

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Cards › Add a card | none | `payments.create` |
| Add money › Choose card › Add a card | none | `payments.create` |

#### 3. Screens

**Screen 1 `card`: Card details.** The button shows "Checking your card…" for about 0.7 seconds and runs the card checks.

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Card number | phone keypad, up to 23 characters, placeholder "1234 5678 9012 3456" | yes | digits only (spaces and hyphens are ignored) | "Use digits only." |
| | | | a type we accept (see below) | "We can’t accept this type of card." |
| | | | right length for the type and passes the card number check digit | "Check the card number." |
| Expiry | text, half width, placeholder "MM/YY" | yes | the format MM/YY with a month 01 to 12 | "Use the format MM/YY." |
| | | | not in the past | "This card has expired." |
| | | | not more than 15 years ahead | "Check the expiry date." |
| Security code | hidden text, half width, up to 4 digits | yes | 3 or 4 digits; 4 for the 15-digit type, 3 for the others | "Enter the 3 or 4 digits on the card." / "Enter the 4 digits on the front." / "Enter the 3 digits on the back." |
| Name on card | text, up to 40 characters | yes | letters, spaces and . ’ -, at least 2 characters | "Use letters only." |
| Billing postcode | text, up to 10 characters (not shown in Market D) | yes | the market format below | the market message below |

Under the card number a small line shows the card type and the last four digits when the number is valid, "We don’t recognise this card type." for an unknown start, or "We can’t accept this type of card." Card types: the number starts with 4 (16 digits), with 51 to 55 or 2221 to 2720 (16 digits), with 34 or 37 (15 digits, only while `acceptAmex` is on). Other starts (for example 6, 36, 38, 39, 50, 56 to 59) are refused. The type names shown are the networks’ names (see the report note).

On **Continue** the card is also checked: a number ending 0002 is declined; a card already saved (same last four and expiry) is refused; a sixth card is refused.

**Screen 2 `verify`: Confirm it’s your card.** Intro "We’ll check the card before we save it." Button **Continue** (busy "Checking the code…", about 0.6 seconds).

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| How do you want to check? | chips "Text message code" or "Small test charge" | yes | one chosen | none |
| Code | text; label "Code" (6 digits, placeholder "6 digits") or, for the test charge, "Code from the charge" (4 digits, placeholder "4 digits") | yes | the right length | "Enter the 6-digit code." / "Enter the 4-digit code." |

Hints: text message "Sent to the phone ending 0142."; test charge "We’ve placed a small temporary charge on your card. Its description shows the code. The charge is returned." Sandbox codes: 482100 (or 000000) for text, 4821 for the charge. Changing the method clears the code and the tries. A wrong code: "That code isn’t right. Try again." After three wrong codes: "Too many wrong codes. Nothing was saved. Go back to start again."

**Screen 3 `name`: Save your card.**

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Nickname (optional) | text, up to 24 characters, placeholder "For example, Joint card" | no | 2 characters or more when given | "Use at least 2 characters." |
| Use to add money | switch (default on) | no | none | none |
| Use to pay | switch (default on; shown when `allowPay` is on) | no | none | none |

**Result** (green). Title "Card saved", text "{card type} ••{last4} is ready to use." Rows Card, Nickname (when given), Expires, Used for ("Adding money", "Paying", both with "and", or "Nothing yet"). Button **Go to cards**.

**States**
- Loading: "Checking your card…" and "Checking the code…".
- Empty: not applicable.
- Error: unavailable shows "This isn’t available right now. Nothing was saved. Try again in a few minutes."; timeout shows "This is taking longer than expected. Nothing was saved." Both with **Try again**.
- Stale: the duplicate and limit checks run again at the end; the person goes back with the message.

**Home market configuration** (only the postcode rule changes)

| Market | Billing postcode | Message | Sample |
|---|---|---|---|
| Market A (routing number and account) | 5 digits, optionally followed by a hyphen and 4 digits | "Enter the 5-digit ZIP code." | 62704 |
| Market B (sort code and account) | outward and inward code, for example SW1A 1AA | "Enter a valid postcode." | SW1A 1AA |
| Market C (IBAN) | 4 to 10 letters, digits, spaces or hyphens | "Enter a valid postcode." | 10115 |
| Market D (IBAN, mobile alias) | not asked | none | none |

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `CARD_INVALID` | "Check the card number." | card | Change number |
| `CARD_BRAND_UNSUPPORTED` | "We can’t accept this type of card." | card | Change card |
| `CARD_EXPIRED` | "This card has expired." | card | Change expiry |
| `CARD_DECLINED` | "The card was declined. Try another card." | card (a number ending 0002) | Change card |
| `CARD_DUPLICATE` | "This card is already saved." | card | Back |
| `CARD_LIMIT` | "You can save up to 5 cards. Remove one to add another." | card, commit | Back |
| `VERIFY_INVALID` | "That code isn’t right. Try again." | verify | Try again |
| `VERIFY_LOCKED` | "Too many wrong codes. Nothing was saved. Go back to start again." | verify | Back to start |
| `TIMEOUT` | "This is taking longer than expected. Nothing was saved." | the step | Try again |
| `SERVICE_UNAVAILABLE` | "This isn’t available right now. Nothing was saved. Try again in a few minutes." | the step | Try again |
| `JOURNEY_DISABLED` | "This isn’t available at your bank." | whole journey | none |
| `PERMISSION_DENIED` (planned) | Standard message | whole journey | Back |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `cards` | `bank.cards.list` | none | map of saved cards | none | Existing (`packages/mock-bank-api/src/index.ts`) |
| `addCard` | `bank.cards.add` | `{number, expiry, cvv, holder, nickname?, makeDefault?}` | `{cardId, last4, network}` | `CARD_INVALID`, `EXPIRY_INVALID`, `CARD_EXPIRED`, `CVV_INVALID`, `CARD_EXISTS` | Existing. It does not check the postcode, the verification code, the limit of 5 or the uses; those are (planned) |
| `verifyCard` | `bank.cards.verify` | `{cardId, method, code}` | `{verified}` | `VERIFY_INVALID`, `VERIFY_LOCKED`, `CARD_DECLINED` | (planned) |
| `sendOtp` / `verifyOtp` | `bank.otp.send` / `bank.otp.verify` | `{channel}` / `{code}` | `{sent}` / `{verified}` | `OTP_INVALID` | Existing |

The card number and security code are never stored or logged; only the last four digits and the expiry are kept (planned for the real adapter).

#### 6. Permissions, step-up and limits

`payments.create`. Step-up: a verification code (6 digits by text or 4 digits from a small test charge), 3 tries. Limits: 5 saved cards; each saved card has two uses, adding money and paying.

#### 7. Result and links out

Result as above. Notifications raised (planned): "A card ending {last4} was added". Every save is written to the audit log without the card number. Links out: Cards; `add-money`.

#### 8. Acceptance criteria

- AC-1: The card number must be digits, of an accepted type, the right length and pass the check digit.
- AC-2: The 15-digit type is accepted only with `acceptAmex` on, and needs a 4-digit security code; the others need 3.
- AC-3: An expired card is refused; the expiry format is MM/YY.
- AC-4: The postcode follows the home market, and is not asked in Market D.
- AC-5: A card is saved only after the right code; three wrong codes end the attempt with nothing saved.
- AC-6: The same card (last four and expiry) cannot be saved twice, and no more than 5 cards can be saved.
- AC-7: "Use to pay" is offered only with `allowPay` on; the result lists what the card is used for.
- AC-8: The card number and security code do not appear in the result, the logs or the activity.
- AC-9: When the bank is unavailable or times out nothing is saved.

#### 9. Scenarios

Synthetic persona `alex`. Test card 4242 4242 4242 4242, expiry 12/29, security code 123, name "Alex Morgan", postcode 62704 (Market A).

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-5, AC-7 | `alex` | none | Details, text message, code 482100, nickname "Spare card": "Card saved", "{card type} ••4242 is ready to use.", Used for "Adding money and Paying". |
| T-2 | AC-1 | `alex` | none | "4242 4242 4242 4241": "Check the card number."; "abcd": "Use digits only."; a number starting 6011: "We can’t accept this type of card." |
| T-3 | AC-2 | `alex`, `acceptAmex` off, then on | none | A 15-digit number starting 37 is refused with the option off; with it on it needs a 4-digit code ("Enter the 4 digits on the front."). A 4-digit code on a 16-digit card: "Enter the 3 digits on the back." |
| T-4 | AC-3 | `alex` | none | "13/29": "Use the format MM/YY."; "01/24": "This card has expired." |
| T-5 | AC-4 | `alex`, Market A, then Market D | none | "1234": "Enter the 5-digit ZIP code."; in Market D the postcode field is absent. |
| T-6 | AC-5 | `alex` | none | Wrong code: "That code isn’t right. Try again."; third wrong code: "Too many wrong codes. Nothing was saved. Go back to start again." Method "Small test charge" accepts 4821. |
| T-7 | AC-6 | `alex`, T-1 done | none | The same card again: "This card is already saved." A sixth card: "You can save up to 5 cards. Remove one to add another." A number ending 0002: "The card was declined. Try another card." |
| T-8 | AC-7 | `alex`, `allowPay` off | none | Only "Use to add money" is shown. |
| T-9 | AC-8 | `alex` | none | The result and activity show only "••4242", never the number or code. |
| T-10 | AC-9 | `alex` | `unavailable: ["bank.cards.add"]` (prototype: Service down on) | The connection sheet shows; no card is saved. |
| T-11 | AC-9 | `alex` | `timeout: ["bank.cards.add"]`, `latencyMs: 10000` | After 10 seconds "This is taking longer than expected. Nothing was saved." No card is saved. |

#### 10. Expected mutation-check survivors

The expiry upper bound (15 years) survives if no scenario uses a far date; add one to kill it. The duplicate and limit checks at the end survive because they run at the first step too; expected. The audit entry is not asserted; expected. Everything else: none expected.

---

## Personal: Save & Borrow

The **Save** tab is one screen, `save-borrow`, with four short sections in a fixed order: Savings goals, Term deposits, Loans, Investments. Each card shows one key number and one or two actions that start the journeys below: `savings-goal`, `term-deposit`, `apply-loan`, `repay-loan`, `invest`, `sell-investment`. A seventh journey, `add-money`, is listed with them because it is launched from Home and Accounts (the Save tab has no button for it today). The lean rework removed the separate shells for deposits, goals, loans and investments, the detail pages, the loan schedule, the watchlist and market explorer, price charts and the nine-instrument list. Investing now uses a short shelf of four funds.

All amounts are in the account's currency; the examples use `$`. Dates read `3 Nov 2026`. The sandbox day is fixed at 3 Nov 2026.

### How these journeys behave (applies to all seven)

| Topic | What the prototype does |
|---|---|
| Engine | Form journeys from `design/bankworkx-r1/src/journeys/66-deposits-goals.js`, `67-loans.js`, `68-invest.js`; shared data and helpers `SBV` in `65-save-borrow.js`. Engine notes: `design/bankworkx-r1/src/ENGINE.md` |
| Progress | When a journey has more than one visible step, a progress bar and "Step {n} of {N} · {journey name}". Steps that do not apply (for example "Choose a deposit" when one is passed in) are skipped. **Back** on every step but the first; **Cancel** on the first |
| Field messages | Shown under the field once it is touched or the person has tried to continue. The main button stays disabled until every visible field is valid. Order of checks for an amount: required ("This is required." unless the field has its own), a number above zero ("Enter an amount above zero."), the minimum, the maximum, up to two decimals ("Use up to 2 decimals."), then the rule specific to the field |
| Accounts offered | Only accounts in the bank's home currency, shown as "{name} ••{last} · {available}", for example "Current account ••4410 · $8,102.40" and "Savings ••7720 · $14,310.00". The euro account is never offered |
| Account that pays | One shared check: none chosen "Choose an account."; frozen "You can’t use this account right now. Choose another account."; not enough "Not enough money in {account name}. Available: {available}." |
| One-time code | A sheet over the screen: title "Authorise …" (given per journey), "Code sent to ••• 4410.", a 6-digit keypad and **Cancel**. The prototype accepts any 6 digits; the sandbox accepts one fixed test code. A wrong code (planned): `STEP_UP_FAILED`, the journey's own message, nothing changes. Which journeys ask: `term-deposit`, `apply-loan` (only when approved), `repay-loan`, `invest`, `sell-investment`, `add-money` (card path only). `savings-goal` never asks, because the money stays the customer's |
| Bank unavailable | On submit (after the code) a sheet "We couldn’t reach the bank" / "Nothing was sent and you haven’t been charged. Try again in a moment." with **Try again** and **Cancel** |
| Timeout | A red banner at the top of the step with the journey's own `TIMEOUT` message; nothing was applied. **Try again** is the normal button |
| Result | Icon, title, one sentence, a chip ("Done", "In review" or "Declined"), a receipt card (rows then "Reference"), one or two action buttons and **Done** |
| Loading | A button shows busy only where a call is made (`apply-loan` "Checking your application…" for 1.4 seconds); other submits finish at once |

### Sandbox data for Alex Morgan (prototype, synthetic)

Created the first time any Save journey or the Save tab is opened, so it resets with the sandbox.

| Item | Value |
|---|---|
| Term deposit `td1` | $10,000.00 at 4.20% for 12 months, opened 12 Aug 2026, matures 12 Aug 2027, interest at maturity, no renewal chosen |
| Savings goal `g1` | "Holiday fund", target $5,000.00, saved $3,200.00, by 30 Jun 2027, automatic $200.00 a month from Current account |
| Loan `ln1` | "Personal loan", original $16,000.00, left $9,600.00, 9.90% a year, instalment $412.50, 48 months with 24 left, last paid 1 Nov 2026, next 1 Dec 2026, repaid from Current account |
| Holdings | Balanced Portfolio 150 units (cost $2,300.00), Global Equity Fund 88 units (cost $2,350.00); worth $4,820.00 |
| Saved cards (add money) | Visa ••4242 Harbor Bank 09/28; Mastercard ••5100 Crest Bank 03/29; Visa ••0019 Lakeside Bank 01/26 (expired) |
| Accounts | Current account ••4410 ($8,102.40 available), Savings ••7720 ($14,310.00), Euro account ••3302 (not offered) |

Rates, limits and fees in these journeys are sandbox policy, not market data (see `docs/journeys/research/*.md`).

---

### ★ Save — `save-borrow`

**Catalog:** slug `save-borrow` (name in the prototype "Save"), workspace `personal`, category Save & Borrow (Personal: Save & Borrow), **view** on the bottom tab **Save** (`tab: 'sav'`), core no, can a bank switch it off: yes (basic, kept in the Lean preset). Options (all default on): **Show savings goals** (`showGoals`), **Show term deposits** (`showDeposits`), **Show loans** (`showLoans`), **Show investments** (`showInvest`). Research: `research/save-borrow.md`. Built in `design/bankworkx-r1/src/journeys/65-save-borrow.js`.

A section is drawn only when its option is on **and** its journey is allowed (not switched off by the bank, and the person has the permission): goals need `savings-goal`, deposits `term-deposit`, loans `apply-loan`, investments `invest`. So in the Lean preset, which switches off `term-deposit`, `apply-loan`, `invest` and `sell-investment`, only the goals section remains. A button to a switched-off journey is not drawn.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `save-borrow` |
| Purpose | One glance at what the customer saves, owes and invests, with the next action on each card. |
| Release / workspace | 1 / Personal |
| Status | Built in the prototype as a view (no steps, no result). Reads the sandbox data live, so every journey that changes it is reflected the next time the tab is drawn |
| Channels | Web and mobile (cards sit in two columns on web, one on phones) |
| Starting pattern | View with section cards |
| Who may use it | Anyone signed in to Personal with `accounts.view`. Each button needs the permission of the journey it starts |

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Bottom tab or left rail › Save | none | `accounts.view` |
| After a Save journey › View goals / View deposits / View loan / View investments / View Save | returns to this tab | `accounts.view` |

#### 3. Screen

**Section 1: Savings goals** (heading with button **New goal** → `savings-goal` `{mode: "create"}`). One card per goal, in the order created:

| Part | Content |
|---|---|
| Title | Goal name, for example "Holiday fund" |
| Key number | "$3,200.00" with "of $5,000.00" |
| Bar | Saved ÷ target, capped at 100% |
| Small line | "By 30 Jun 2027", or "Goal reached" when saved is at least the target; then " · $200.00 a month" when the automatic top-up is on |
| Buttons | **Add money** → `savings-goal` `{mode: "add", goalId}`; **Edit** → `savings-goal` `{mode: "edit", goalId}` |

Empty: icon, "No savings goals", "Set a target and watch it grow." and **Create a goal** → `savings-goal` `{mode: "create"}`.

**Section 2: Term deposits** (heading with **Open** → `term-deposit` `{mode: "open"}`). One card per deposit:

| Part | Content |
|---|---|
| Title | "Term deposit" |
| Key number | "$10,000.00" |
| Small line | "4.20% · matures 12 Aug 2027"; below it "Renews for 12 months" once a renewal was chosen |
| Buttons | **Renew** → `term-deposit` `{mode: "renew", depositId}`; **Close** → `term-deposit` `{mode: "close", depositId}` |

Empty: "No term deposits", "Lock money away for a fixed rate." and **Open a term deposit**.

**Section 3: Loans** (heading with **Apply** → `apply-loan`). One card per loan:

| Part | Content |
|---|---|
| Title | Loan name, for example "Personal loan" |
| Bar | Share already repaid (40% for the seed loan) |
| Key number | "$9,600.00 left" |
| Small line | "Next payment $412.50 on 1 Dec 2026" (the smaller of the instalment and the balance) |
| Button | **Repay** → `repay-loan` `{loanId}` |

Empty: "No loans", "Borrow when you need to, with a clear monthly payment." and **Apply for a loan**.

**Section 4: Investments** (heading with **Invest** → `invest`). One card, "Portfolio":

| Part | Content |
|---|---|
| Key number | Total value of all holdings at today's prices: "$4,820.00" |
| Small line | "▲ $170.00 (3.7%) since you invested" (green); "▼" with no green when below cost |
| Buttons | **Invest** → `invest`; **Sell** → `sell-investment` |

Empty: "No investments yet", "Start with as little as $50." and **Start investing**.

If all four sections are off or hidden, the screen shows "Nothing to show" with "Savings and borrowing aren’t available right now." and no button.

**States**
- Loading (planned): four card skeletons. Today the prototype reads its data at once.
- Error (planned): per-section "We couldn’t load this." with **Try again**; one failing section does not block the others.
- Sort: goals and deposits in the order created; loans in the order taken; no filters.
- Drill-downs: none. The old detail pages and the loan schedule are removed.

#### 4. Sandbox errors

None on this screen. A switched-off or forbidden journey simply has no button (`JOURNEY_DISABLED`, `PERMISSION_DENIED` (planned)).

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `goals` | `bank.goals.list` | none | goals | none | (planned). The prototype reads `D.goals` |
| `deposits` | `bank.deposits.list` | none | term deposits | none | (planned). `D.td` |
| `loans` | `bank.loans.list` | none | loans | none | (planned). `D.loans` |
| `holdings` | `bank.funds.holdings` | none | `{id, units, cost, value}` per holding | none | (planned). The existing `bank.invest.holdings` (`packages/mock-bank-api/src/invest.ts`) holds shares in nine instruments, not the fund shelf |

#### 6. Permissions, step-up and limits

`accounts.view`. No step-up. No limits.

#### 7. Result and links out

No result. Links out: `savings-goal`, `term-deposit`, `apply-loan`, `repay-loan`, `invest`, `sell-investment`, and the Accounts tab through the "View accounts" buttons on results.

#### 8. Acceptance criteria

- AC-1: Each section shows its heading, its cards and its button only when its option is on and its journey is allowed.
- AC-2: A goal card shows the saved and target amounts, a bar, the target date (or "Goal reached") and, when on, the monthly amount.
- AC-3: A deposit card shows the amount, the rate, the maturity date and, after Renew, the renewal term.
- AC-4: A loan card shows the amount left, the share repaid and the next payment with its date.
- AC-5: The portfolio card shows total value and the gain or loss against cost with its percentage.
- AC-6: A section with nothing in it shows its empty text and one button to start.
- AC-7: When all sections are hidden the screen says "Nothing to show".
- AC-8: After any Save journey succeeds the tab shows the changed figures.

#### 9. Scenarios

Synthetic persona `alex` with the seed above.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-2, AC-3, AC-4, AC-5 | `alex` | none | Four sections: "Holiday fund $3,200.00 of $5,000.00 · By 30 Jun 2027 · $200.00 a month"; "Term deposit $10,000.00 · 4.20% · matures 12 Aug 2027"; "Personal loan $9,600.00 left · Next payment $412.50 on 1 Dec 2026"; "Portfolio $4,820.00 ▲ $170.00 (3.7%)". |
| T-2 | AC-1, AC-7 | `alex` | all four options off | "Nothing to show". |
| T-3 | AC-1 | `alex`, Lean preset | catalog | Only Savings goals is drawn. |
| T-4 | AC-6 | `alex`, remove all data | `empty` (planned) | Each section shows its empty text and button. |
| T-5 | AC-8 | `alex` | none | Add $100.00 to "Holiday fund": the card shows $3,300.00. |
| T-6 | AC-1 | `alex` without `payments.create` | permission | Goals, Deposits and Investments are not drawn (their journeys need `payments.create`); Loans is still drawn (`apply-loan` needs `loans.apply`) but its Repay button is not (`repay-loan` needs `payments.create`). |

#### 10. Expected mutation-check survivors

The "capped at 100%" bar and the "since you invested" colour are display rules the sandbox scenarios do not assert; expected. Everything else: none expected.

---
### ★ Term deposit — `term-deposit`

**Catalog:** slug `term-deposit` (name "Term deposit"), workspace `personal`, category Save & Borrow (Personal: Save & Borrow), core no, can a bank switch it off: yes (not in the Lean preset). Options (both default on): **Offer interest paid monthly** (`allowMonthly`), **Allow early closure (with a charge)** (`allowEarlyClose`). Research: `research/term-deposit.md`. Built in `design/bankworkx-r1/src/journeys/66-deposits-goals.js`. One journey, three modes: `open`, `renew`, `close`.

The lean rework removed the deposit list and detail pages, the status timeline, the "matures soon" chip and the choice of maturity instruction at opening. A new deposit pays out at maturity unless the person later uses Renew.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `term-deposit` |
| Purpose | Lock money away at a fixed rate for 3, 6, 12 or 24 months; change what happens at maturity; or close a deposit early with the closure charge shown first. |
| Release / workspace | 1 / Personal |
| Status | Built in the prototype as a form journey (`submit: "Confirm"`, one-time code). Moves money in `open` and `close` |
| Channels | Web and mobile |
| Starting pattern | Amount, term, review, code, result |
| Who may use it | Anyone signed in to Personal with `payments.create`, for their own accounts |

Configuration (sandbox policy): rate by term 3 months 3.40%, 6 months 3.80%, 12 months 4.20%, 24 months 4.50% a year; smallest deposit $1,000.00, largest $250,000.00; early closure keeps back 50% of the interest earned so far and never touches the money paid in. No market difference.

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Save › Term deposits › Open (and "Open a term deposit" when empty) | `{mode: "open"}` | `payments.create` |
| Save › Term deposits › card › Renew | `{mode: "renew", depositId}` | `payments.create` |
| Save › Term deposits › card › Close | `{mode: "close", depositId}` | `payments.create` |
| Deep link `/personal/j/term-deposit?mode=renew&depositId=td1` | `mode`, optional `depositId` | `payments.create` |

When the customer has exactly one deposit, `depositId` is filled in and "Choose a deposit" is skipped.

#### 3. Screens

**Screen `pick`: Choose a deposit** (modes renew and close, when no `depositId`). Choice cards, one per deposit: "{amount}" and "{rate}% · matures {date}". Required, "Choose a deposit." If the customer has none: "You have no term deposits."

**Open: screen `amount`: Open a term deposit**

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Amount | amount, `$`, placeholder "0.00", sample 5000 | yes | at least 1,000 | "The smallest deposit is $1,000.00." |
| | | | at most 250,000 | "The largest deposit is $250,000.00." |
| | | | the account that pays can cover it | the shared account messages |
| From | select of accounts | yes | chosen, not frozen | "Choose an account." |

**Open: screen `term`: Choose a term.** Four choice cards, default 12 months: "3 months" with "Matures 3 Feb 2027" and "3.40%"; "6 months", "Matures 3 May 2027", "3.80%"; "12 months", "Matures 3 Nov 2027", "4.20%"; "24 months", "Matures 3 Nov 2028", "4.50%". Chips **Interest paid**: "At maturity" (default) and, when `allowMonthly` is on, "Every month".

**Open: screen `review`: Review.** Rows: Amount; From ("Current account ••4410"); Term ("12 months"); Rate ("4.20% a year"); Interest paid ("At maturity" or "Every month"); Total interest (amount × rate × term ÷ 12, for example $5,000.00 gives $210.00); Matures; You receive at maturity (amount plus interest, or the amount alone when interest is paid every month). Button **Confirm**, then the code sheet "Authorise a deposit of $5,000.00".

**Renew: screen `renew`: Renew or change.** A card with the deposit ("Deposit", amount, "4.20% · matures 12 Aug 2027"). Choice cards **New term** (the four terms, each with "Rate 3.40% a year" and so on, required). Select **At maturity**: "Renew with interest" (default), "Renew, pay interest out", "Pay out at maturity". Then **Review**: Deposit; New term; Rate; At maturity; Takes effect (the maturity date). **Confirm**, then the sheet "Authorise the change to your deposit". No money moves.

**Close: screen `close`: Close this deposit.** Select **Pay into** (required, default Current account). Rows: Deposit "$10,000.00"; Interest earned (rate × days since opening ÷ 365, for example $95.51 after 83 days); Early closure charge ("-$47.76", half the interest earned); You receive ("$10,047.75"). With `allowEarlyClose` off the screen shows "This deposit can’t be closed early." and the button stays disabled. **Confirm**, then the sheet "Authorise closing your deposit". There is no separate review.

**Result**

| Mode | Title and text | Receipt rows | Buttons |
|---|---|---|---|
| open | "Deposit opened" / "$5,000.00 is earning 4.20% for 12 months." | Amount; From; Term; Rate; Interest paid; Total interest; Matures | **View deposits** (Save tab), **Done** |
| renew | "Deposit updated" / "It renews for 12 months on 12 Aug 2027." | Deposit; New term; Rate; At maturity; Takes effect | **View deposits**, **Done** |
| close | "Deposit closed" / "$10,047.75 was paid into Current account." | Deposit; Interest earned; Early closure charge; Paid into; You received | **View accounts**, **Done** |

Each also shows a "Reference". An opened deposit appears on the Save tab; a closed one disappears. A debit "Term deposit" (category Savings) or a credit "Term deposit closed" appears in Activity for the current account.

**States**
- Loading: none beyond the sheet; the result appears at once after the code.
- Empty: no deposits in renew or close: "You have no term deposits."
- Error: unavailable shows the connection sheet; a timeout shows the message in the table below. In both nothing was applied.
- Stale: if the deposit no longer exists at submit, "We can’t find that deposit."

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `INSUFFICIENT_FUNDS` | "There isn’t enough money in that account." | submit | Back |
| `BELOW_MINIMUM` | "The smallest deposit is $1,000.00." | amount | Change amount |
| `DEPOSIT_NOT_FOUND` | "We can’t find that deposit." | submit | Back |
| `EARLY_CLOSE_OFF` | "This deposit can’t be closed early." | close, submit | Back |
| `STEP_UP_FAILED` (planned) | "We couldn’t confirm this. Nothing was changed. Start again." | code | Start again |
| `TIMEOUT` | "We didn’t get an answer in time. Check Activity before you try again, so you don’t pay twice." | submit | Try again |
| `SERVICE_UNAVAILABLE` | Connection sheet (above) | submit | Try again |
| `JOURNEY_DISABLED` | "This isn’t available at your bank." | whole journey | none |
| `PERMISSION_DENIED` (planned) | Standard message | whole journey | Back |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `accounts` | `bank.accounts.list` | none | accounts | none | Existing (`packages/mock-bank-api/src/index.ts`) |
| `deposits` | `bank.deposits.list` | none | deposits | none | (planned). The prototype reads `D.td` |
| `quote` | `bank.deposits.quote` | `{amount, term}` | `{rate, interest, matures}` | `BELOW_MINIMUM` | (planned) |
| `open` | `bank.deposits.open` | `{amount, term, payout, fromAccountId}` | `{depositId, reference}` | `BELOW_MINIMUM`, `INSUFFICIENT_FUNDS` | (planned) |
| `renew` | `bank.deposits.renew` | `{depositId, term, instruction}` | `{depositId, reference}` | `DEPOSIT_NOT_FOUND` | (planned) |
| `closeQuote` / `close` | `bank.deposits.close.quote` / `bank.deposits.close` | `{depositId}` / `{depositId, toAccountId}` | `{earned, charge, net}` / `{reference}` | `DEPOSIT_NOT_FOUND`, `EARLY_CLOSE_OFF` | (planned) |
| `sendOtp` / `verifyOtp` | `bank.otp.send` / `bank.otp.verify` | `{channel}` / `{code}` | `{sent}` / `{verified}` | `OTP_INVALID`, `OTP_LOCKED` | Existing |

Not to be confused with `bank.deposit.create` (singular), which adds money from a card (see `add-money`).

#### 6. Permissions, step-up and limits

`payments.create`. Step-up: one-time code on every mode. Limits: $1,000.00 to $250,000.00 per deposit; the paying account must hold the amount.

#### 7. Result and links out

As above. Notifications (planned): "Your deposit of {amount} is open until {date}"; "Your deposit was closed and {amount} was paid into {account}". Links out: Save tab, Accounts tab.

#### 8. Acceptance criteria

- AC-1: Opening needs an amount from $1,000.00 to $250,000.00 and an account that can cover it, with the messages above.
- AC-2: The four terms show their rate and maturity date; interest and the amount received at maturity are shown before the code.
- AC-3: "Every month" is offered only when `allowMonthly` is on; with it the amount received at maturity is the principal alone.
- AC-4: A code is asked before opening, renewing or closing; a wrong code changes nothing.
- AC-5: Opening takes the amount from the chosen account, adds a deposit to the Save tab and shows "Deposit opened".
- AC-6: Renew changes the term and the maturity instruction only; no money moves; the Save tab shows "Renews for {n} months".
- AC-7: Close shows interest earned, a closure charge of half that interest and the amount received before the code; the principal is never reduced.
- AC-8: With `allowEarlyClose` off, Close is blocked with "This deposit can’t be closed early."
- AC-9: With one deposit the choice of deposit is skipped; with none, the journey says "You have no term deposits."
- AC-10: When the bank is unavailable or times out nothing is changed.

#### 9. Scenarios

Synthetic persona `alex`: Current account ••4410, $8,102.40 available; deposit `td1` as seeded. The sandbox code is the fixed test code.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-2, AC-5 | `alex`, `mode: "open"` | none | $5,000.00 from Current account, 12 months, At maturity. Review: rate 4.20% a year, total interest $210.00, matures 3 Nov 2027, receive $5,210.00. Code. "Deposit opened"; Current account $3,102.40 available. |
| T-2 | AC-1 | `alex` | none | $500: "The smallest deposit is $1,000.00." $300,000: "The largest deposit is $250,000.00." $9,000 from an account with less: "Not enough money in Current account. Available: $8,102.40." |
| T-3 | AC-3 | `alex` | `allowMonthly` on / off | On: chips "At maturity" and "Every month"; choose monthly: receive at maturity $5,000.00. Off: one chip. |
| T-4 | AC-6, AC-9 | `alex`, `renew`, `depositId: "td1"` | none | Choose 24 months, "Renew, pay interest out". Review shows Rate 4.50% a year, Takes effect 12 Aug 2027. Code. "Deposit updated"; the Save tab shows "Renews for 24 months"; balances unchanged. |
| T-5 | AC-7 | `alex`, `close`, `td1` | none | Rows: Deposit $10,000.00, Interest earned $95.51, Early closure charge -$47.76, You receive $10,047.75. Code. "Deposit closed"; Current account up by $10,047.75; the deposit is gone. |
| T-6 | AC-8 | `alex`, `close` | `allowEarlyClose` off | "This deposit can’t be closed early." and the button is disabled. |
| T-7 | AC-4 | `alex`, `open` | wrong code (planned) | `STEP_UP_FAILED`; no deposit, balance unchanged. |
| T-8 | AC-9 | `alex`, remove deposits, `renew` | `empty` (planned) | "You have no term deposits." |
| T-9 | AC-10 | `alex`, `open` | `unavailable: ["bank.deposits.open"]` (prototype: Service down on) | Connection sheet; nothing opened, balance unchanged. |
| T-10 | AC-10 | `alex`, `open` | `timeout: ["bank.deposits.open"]`, `latencyMs: 10000` | After 10 seconds the timeout message; nothing opened. |

#### 10. Expected mutation-check survivors

`BELOW_MINIMUM` on submit survives (the amount step already stops it); `INSUFFICIENT_FUNDS` on submit survives for the same reason; expected. The early closure fraction survives if scenarios use a single date; expected. Everything else: none expected.

---

### ★ Savings goal — `savings-goal`

**Catalog:** slug `savings-goal` (name "Savings goal"), workspace `personal`, category Save & Borrow (Personal: Save & Borrow), core no, can a bank switch it off: yes (basic, kept in the Lean preset). Options (both default on): **Offer automatic monthly top-ups** (`allowAuto`), **Allow taking money out of a goal** (`allowWithdraw`). Research: `research/savings-goal.md`. Built in `design/bankworkx-r1/src/journeys/66-deposits-goals.js`. Four modes: `create`, `edit`, `add`, `withdraw`.

The lean rework removed the goal detail page, forecast chart, contribution list, pictures and the "on track" chip. A goal is a name, a target, a month and an optional monthly top-up.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `savings-goal` |
| Purpose | Create or edit a goal with a target amount, a target month and an automatic monthly top-up; add money to a goal or take it out. |
| Release / workspace | 1 / Personal |
| Status | Built in the prototype as a form journey (`submit: "Confirm"`). No code is asked: the money stays the customer's |
| Channels | Web and mobile |
| Starting pattern | Details, plan, result (create, edit); one amount step (add, withdraw) |
| Who may use it | Anyone signed in to Personal with `payments.create`, for their own accounts |

Configuration: at most 10 goals; name 2 to 30 characters; target $50.00 to $1,000,000.00; monthly top-up at least $5.00 on the 1st of each month. No market difference.

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Save › Savings goals › New goal / Create a goal | `{mode: "create"}` | `payments.create` |
| Save › Savings goals › card › Add money | `{mode: "add", goalId}` | `payments.create` |
| Save › Savings goals › card › Edit | `{mode: "edit", goalId}` | `payments.create` |
| Result of a new goal › Add money | `{mode: "add", goalId}` | `payments.create` |
| Deep link `/personal/j/savings-goal?mode=withdraw&goalId=g1` (no button on the Save tab today) | `mode`, optional `goalId` | `payments.create` |

#### 3. Screens

**Screen `pick`: Choose a goal** (modes add, withdraw, edit, when no `goalId`). Choice cards: goal name and "{saved} of {target}". Required, "Choose a goal." If there are none: "You have no goals yet."

**Create and edit: screen `goal`: Your goal** (edit starts with the current values)

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Name | text, placeholder "For example, New laptop", sample "New laptop", up to 30 characters | yes | 2 to 30 characters | "Use 2 to 30 characters." |
| Target amount | amount, `$`, placeholder "0.00", sample 2000 | yes | at least 50 | "The smallest target is $50.00." |
| | | | at most 1,000,000 | "The largest target is $1,000,000.00." |
| Target date | date, a list of the next 36 month ends ("December 2026" and so on), placeholder "Choose a month" | yes | chosen | "This is required." |

On **Continue** in create mode, if the customer already has 10 goals: "You can have up to 10 goals. Close one to add another."

**Create and edit: screen `fund`: Saving plan** (button **Save goal**). Live line "To get there by {date}" / "{n} a month" (remaining amount ÷ months left, rounded up; for edit the amount already saved is taken off).

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Add automatically every month | toggle with "On the 1st of each month" (only when `allowAuto` is on) | no | none | none |
| Monthly amount | amount, `$`, sample 200 (shown when the toggle is on; filled with the monthly figure when it is switched on) | yes then | at least 5 | "The smallest amount is $5.00." |
| | | | not empty | "Enter a monthly amount." |
| Take it from | select of accounts (same condition) | no | none | none |

Result (create): "Goal created" / "{name} is ready. Add money any time." Receipt: Goal; Target; By; Monthly top-up ("$250.00 from Current account" or "Off"). Buttons **Add money**, **View goals**, **Done**. Result (edit): "Goal updated" / "{name} is up to date.", **View goals**. A top-up also appears in the customer's scheduled payments as "Goal: {name}", "Monthly · 1 Dec", amount; editing replaces it, switching it off removes it. Nothing moves until the 1st.

**Add: screen `move`: Add money** (button **Add money**). A card with the goal name, saved amount and "of {target}".

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Amount | amount, `$`, sample 100 | yes | at least 1 | "The smallest amount is $1.00." |
| | | | the account can cover it | the shared account messages |
| From | select of accounts, default Current account | yes | chosen | "Choose an account." |

Result: "Money added" / "$100.00 is now in Holiday fund.", or "{name} has reached its target." once saved is at least the target. Receipt: Goal; From; Amount; Saved so far ("$3,300.00 of $5,000.00"). The debit "To goal: {name}" shows in Activity. The sandbox lets a goal go above its target.

**Withdraw: screen `out`: Take money out** (button **Take money out**). A card with the goal and "saved". Amount (at least $1.00; "You only have $3,200.00 in this goal." above the saved amount) and **Into** (select, required). Result: "Money taken out" / "$50.00 was paid into Current account." Receipt: Goal; Into; Amount; Saved so far.

**States**
- Loading: none; results appear at once.
- Empty: no goals in edit, add or withdraw: "You have no goals yet."
- Error: unavailable shows the connection sheet; a timeout shows the message below. Nothing was applied.
- Stale: if the goal is gone at submit, "We can’t find that goal."

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `INSUFFICIENT_FUNDS` | "There isn’t enough money in that account." | submit (add) | Back |
| `GOAL_NOT_FOUND` | "We can’t find that goal." | submit | Back |
| `GOAL_LIMIT` | "You can have up to 10 goals. Close one to add another." | goal, submit | Back |
| `WITHDRAW_OFF` | "Taking money out isn’t available." | submit (withdraw) | Back |
| `TIMEOUT` | "We didn’t get an answer in time. Check your goal before you try again." | submit | Try again |
| `SERVICE_UNAVAILABLE` | Connection sheet | submit | Try again |
| `JOURNEY_DISABLED` | "This isn’t available at your bank." | whole journey | none |
| `PERMISSION_DENIED` (planned) | Standard message | whole journey | Back |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `accounts` | `bank.accounts.list` | none | accounts | none | Existing |
| `goals` | `bank.goals.list` | none | goals | none | (planned). The prototype reads `D.goals` |
| `create` / `update` | `bank.goals.create` / `bank.goals.update` | `{name, target, date, auto: {on, fromAccountId, amount}}` (+ `goalId`) | `{goalId}` | `GOAL_LIMIT`, `GOAL_NOT_FOUND` | (planned) |
| `contribute` | `bank.goals.contribute` | `{goalId, amount, fromAccountId}` (negative `amount` or a separate withdraw call for take-out) | `{saved, reference}` | `GOAL_NOT_FOUND`, `INSUFFICIENT_FUNDS`, `WITHDRAW_OFF` | (planned) |
| `schedule` | `bank.schedule.list` | none | scheduled payments | none | (planned). The prototype writes the top-up to `D.sched` |

#### 6. Permissions, step-up and limits

`payments.create`. Step-up: **none**. Limits: 10 goals; target $50.00 to $1,000,000.00; top-up at least $5.00; the paying account must hold the amount; a withdrawal cannot exceed the saved amount.

#### 7. Result and links out

As above. Notifications (planned): "Your goal {name} reached its target"; "Your monthly top-up of {amount} to {name} was made". Links out: Save tab; scheduled payments.

#### 8. Acceptance criteria

- AC-1: A goal needs a name of 2 to 30 characters, a target of $50.00 to $1,000,000.00 and a month, with the messages above.
- AC-2: The saving plan shows the monthly amount needed to reach the target by the chosen month.
- AC-3: Switching the top-up on fills the monthly amount with that figure (at least $5.00); it needs an amount of at least $5.00 and an account.
- AC-4: With `allowAuto` off, the toggle, amount and account are absent and no top-up is saved.
- AC-5: A top-up appears in scheduled payments as "Goal: {name}" and is replaced on edit and removed when switched off.
- AC-6: An eleventh goal is refused with "You can have up to 10 goals. Close one to add another."
- AC-7: Adding money takes it from the chosen account, raises the goal and shows "Money added"; reaching the target says so.
- AC-8: Taking money out cannot exceed the saved amount and pays the chosen account; with `allowWithdraw` off it is refused.
- AC-9: No code is asked in any mode.
- AC-10: When the bank is unavailable or times out nothing is changed.

#### 9. Scenarios

Synthetic persona `alex`, goal `g1` "Holiday fund" ($3,200.00 of $5,000.00), Current account $8,102.40 available.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-2, AC-3, AC-5, AC-9 | `alex`, `create` | none | "New laptop", $2,000.00, June 2027. Plan: "To get there by 30 Jun 2027 / $250.00 a month". Switch the top-up on: amount $250.00, from Current account. "Goal created"; scheduled payments list "Goal: New laptop". No code. |
| T-2 | AC-1 | `alex`, `create` | none | Name "A": "Use 2 to 30 characters." Target $20: "The smallest target is $50.00." |
| T-3 | AC-3 | `alex`, `create` | none | Top-up on, monthly $3: "The smallest amount is $5.00." |
| T-4 | AC-4 | `alex`, `create` | `allowAuto` off | No toggle on the plan screen. |
| T-5 | AC-5 | `alex`, `edit`, `g1` | none | Turn the top-up off, save: "Goal updated"; the schedule line is gone. |
| T-6 | AC-6 | `alex` with 10 goals, `create` | none | Continue on "Your goal": "You can have up to 10 goals. Close one to add another." |
| T-7 | AC-7 | `alex`, `add`, `g1` | none | $100.00 from Current account: "Money added"; "Saved so far $3,300.00 of $5,000.00"; Current account $8,002.40 available. |
| T-8 | AC-7 | `alex`, `add`, `g1` | none | $1,800.00: "Holiday fund has reached its target." |
| T-9 | AC-8 | `alex`, `withdraw`, `g1` | none | $5,000.00: "You only have $3,200.00 in this goal." $50.00 into Current account: "Money taken out". |
| T-10 | AC-8 | `alex`, `withdraw`, `g1` | `allowWithdraw` off | Submit: "Taking money out isn’t available." Balance unchanged. |
| T-11 | AC-7 | `alex`, `add` | none | Account with too little: "Not enough money in Current account. Available: $8,102.40." |
| T-12 | AC-10 | `alex`, `add`, `g1` | `unavailable: ["bank.goals.contribute"]` (prototype: Service down on) | Connection sheet; goal unchanged. |
| T-13 | AC-10 | `alex`, `add`, `g1` | `timeout: ["bank.goals.contribute"]`, `latencyMs: 10000` | After 10 seconds the timeout message; goal unchanged. |

#### 10. Expected mutation-check survivors

`INSUFFICIENT_FUNDS` on submit survives because the amount step already stops it; expected. `WITHDRAW_OFF` is only reachable by a deep link into mode `withdraw`; if no scenario does that it survives (T-10 kills it). The rounding up of the monthly figure survives when scenarios use round numbers; expected. Everything else: none expected.

---
### ★ Apply for a loan — `apply-loan`

**Catalog:** slug `apply-loan` (name "Apply for a loan"), workspace `personal`, category Save & Borrow (Personal: Save & Borrow), core no, can a bank switch it off: yes (not in the Lean preset). Options (both default on): **Send borderline applications to manual review** (`allowReferral`), **Charge a 1% arrangement fee** (`arrFee`). Research: `research/apply-loan.md`. Built in `design/bankworkx-r1/src/journeys/67-loans.js`.

The lean rework removed the product list, the eligibility pre-check page, the repayment schedule and the document upload. The customer picks an amount and a term, states work and income, gets a decision in seconds and accepts or closes.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `apply-loan` |
| Purpose | Choose an amount and term, tell the bank about income, get an instant decision (approved, in review, or not approved) and accept the offer. |
| Release / workspace | 1 / Personal |
| Status | Built in the prototype as a form journey (`submit: "Accept offer"`). The decision is a simulated call (1.4 seconds). Pays money into an account only when approved and accepted |
| Channels | Web and mobile |
| Starting pattern | Amount and term, income, decision, offer, code, result |
| Who may use it | Anyone signed in to Personal with `loans.apply` |

Configuration (sandbox credit policy): rates by term 12 months 8.9%, 24 months 9.4%, 36 months 9.9%, 48 months 10.4%, 60 months 10.9% a year, plus 1.0 point when payments are over 35% of income; amount $1,000 to $50,000 in steps of $500; at most 3 loans; monthly payment is the equal-instalment figure. No market difference.

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Save › Loans › Apply (and "Apply for a loan" when empty) | none | `loans.apply` |
| Home › Offers › Apply | optional `amount` | `loans.apply` |
| Decline result › Try a different amount | none | `loans.apply` |
| Deep link `/personal/j/apply-loan?amount=8000` | optional `amount` | `loans.apply` |

#### 3. Screens

**Screen 1 `loan`: How much do you need?** (button **Continue**). Live card: "Monthly payment" ($161.10 for $5,000.00 over 36 months), "Rate (APR)" ("9.9% a year"), and "Your rate can differ after we check your details."

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Amount | slider $1,000 to $50,000, step $500, default $5,000 | yes | in range | none |
| Term | chips "12 months", "24 months", "36 months" (default), "48 months", "60 months" | yes | one chosen | none |
| Purpose | select, placeholder "Choose a purpose": Home improvement, Car, Education, Medical, Travel, Debt consolidation, Other | yes | chosen | "Choose what the loan is for." |

On **Continue**, if the customer already has 3 loans: "You already have the maximum number of loans."

**Screen 2 `work`: Work and income** (button **Check my application**, then "Checking your application…" for about 1.4 seconds)

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Employment | select, placeholder "Choose one": Employed, Self-employed, Retired, Student, Not working | yes | chosen | "Choose your employment status." |
| Monthly income after tax | amount, `$`, sample 5000 | yes | above 0 | "Enter your monthly income." |
| | | | at most 1,000,000 | "Check this amount." |
| Monthly loan and card payments | amount, `$`, sample 300, hint "Enter 0 if you have none." | yes | 0 or more, up to 1,000,000 | "Enter 0 or more." / "Check this amount." |

**Decision rules**, in this order, with payment = the monthly payment at the table rate and ratio = (payment + other payments) ÷ income:
1. Employment "Student" or "Not working": declined (income reason).
2. Income below $1,000: declined (income reason).
3. Ratio above 50%: declined (affordability reason).
4. Referred when the amount is more than 12 times monthly income, or self-employed above $15,000, or retired above $20,000, or ratio above 40%. With `allowReferral` off a referral becomes a decline (affordability reason).
5. Otherwise approved at the table rate, plus 1.0 point when the ratio is above 35%.

Only an approved decision asks for a code; the other two outcomes need none.

**Screen 3 `offer`: Your offer** (only when approved; button **Accept offer**). Rows: Loan; Term; Rate (APR); Monthly payment; Total interest; Arrangement fee (1% of the loan, only when `arrFee` is on); Total to repay; First payment (one month from today).

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Pay into and repay from | select of accounts, default Current account | yes | chosen | "This is required." |
| I agree to the loan terms | checkbox | yes | ticked | "Agree to the terms to continue." |

Then the code sheet "Authorise a loan of $5,000.00".

**Screen 3 `outcome`: Our decision** (when not approved; button **Close**)
- Referred: card "We need to look at this" / "A member of our team will review your application and reply within 2 working days."
- Declined for income: "We can’t offer this loan" / "We can’t lend based on the income you gave."
- Declined for affordability: "We can’t offer this loan" / "The payments would be too high against your income. Try a smaller amount or a longer term."

**Result**

| Outcome | Title and text | Chip | Receipt rows | Buttons |
|---|---|---|---|---|
| Approved | "Loan approved" / "$5,000.00 is in Current account." | Done | Loan; Paid into; Rate (APR); Monthly payment; Arrangement fee (if charged); First payment | **View loan** (Save tab), **Done** |
| Referred | "Application in review" / "We’ll reply within 2 working days." | In review | Amount; Term; Purpose | **View Save**, **Done** |
| Declined | "Application not approved" / "No loan was created." | Declined | Amount; Term | **Try a different amount**, **Done** |

An approved loan appears on the Save tab with the purpose as its name ("Car loan"). The account is credited with the loan less the arrangement fee; Activity shows "Loan paid out".

**States**
- Loading: "Checking your application…" with a spinner on the income step.
- Empty: not applicable.
- Error: unavailable at the check shows the connection sheet; a timeout shows the message below; no application is recorded.
- Stale: if the customer reaches the limit of 3 loans between offer and acceptance, "You already have the maximum number of loans."

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `LOAN_LIMIT` | "You already have the maximum number of loans." | amount step, submit | Back |
| `BUREAU_UNAVAILABLE` | "We can’t check your application right now. Try again in a few minutes." | income step | Try again |
| `ACCOUNT_CANNOT_CREDIT` | "This account can’t receive money right now. Choose another account." | submit | Choose account |
| `STEP_UP_FAILED` (planned) | "We couldn’t confirm this. No loan was created. Start again." | code | Start again |
| `TIMEOUT` | "We didn’t get an answer in time. Check your loans before you try again." | income step, submit | Try again |
| `SERVICE_UNAVAILABLE` | Connection sheet | income step, submit | Try again |
| `JOURNEY_DISABLED` | "This isn’t available at your bank." | whole journey | none |
| `PERMISSION_DENIED` (planned) | Standard message | whole journey | Back |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `accounts` | `bank.accounts.list` | none | accounts | none | Existing |
| `loans` | `bank.loans.list` | none | loans | none | (planned). The prototype reads `D.loans` |
| `decide` | `bank.loans.eligibility` | `{amount, term, purpose, employment, income, commitments}` | `{decision: approved \| referred \| declined, rate, payment, reason}` | `BUREAU_UNAVAILABLE`, `LOAN_LIMIT` | (planned) |
| `apply` | `bank.loans.apply` | `{amount, term, rate, accountId}` | `{loanId, reference}` | `LOAN_LIMIT`, `ACCOUNT_CANNOT_CREDIT` | (planned) |
| `sendOtp` / `verifyOtp` | `bank.otp.send` / `bank.otp.verify` | `{channel}` / `{code}` | `{sent}` / `{verified}` | `OTP_INVALID`, `OTP_LOCKED` | Existing |

#### 6. Permissions, step-up and limits

`loans.apply`. Step-up: one-time code only for an approved offer. Limits: $1,000.00 to $50,000.00; 12 to 60 months; at most 3 loans.

#### 7. Result and links out

As above. Notifications (planned): "Your loan of {amount} was paid into {account}"; "Your loan application is in review"; "We couldn’t offer your loan". Links out: Save tab, `repay-loan`.

#### 8. Acceptance criteria

- AC-1: The first screen shows the monthly payment and rate for the chosen amount and term, and a purpose is required.
- AC-2: A student, someone not working, or income below $1,000.00 is declined with the income message.
- AC-3: Payments above 50% of income are declined with the affordability message.
- AC-4: A request of more than 12 times monthly income, self-employed above $15,000.00, retired above $20,000.00, or payments above 40% of income is sent to review; with `allowReferral` off it is declined.
- AC-5: Payments above 35% of income raise the rate by one point.
- AC-6: An approved offer shows loan, term, rate, payment, total interest, the fee (when on), total to repay and first payment; the customer must tick the terms.
- AC-7: A code is asked only for an approved offer; accepting adds the loan to the Save tab and pays the account.
- AC-8: A review or a decline creates no loan and moves no money.
- AC-9: A fourth loan is refused with "You already have the maximum number of loans."
- AC-10: With `arrFee` off no fee is shown or deducted.
- AC-11: When the bank is unavailable or times out nothing is changed.

#### 9. Scenarios

Synthetic persona `alex` (one loan, Current account $8,102.40). The sandbox code is the fixed test code.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-5, AC-6, AC-7, AC-10 | `alex` | none | $5,000.00, 36 months, Car; Employed, income $5,000.00, other payments $300.00. Approved at 9.9%: payment $161.10, total interest $799.60, fee $50.00, total to repay $5,849.60, first payment 3 Dec 2026. Tick terms, code. "Loan approved"; the Save tab shows "Car loan"; Current account credited $4,950.00. |
| T-2 | AC-2 | `alex` | none | Student, or income $800.00: "We can’t lend based on the income you gave." No code. |
| T-3 | AC-3 | `alex` | none | $50,000.00, 12 months, income $5,000.00: ratio over 50%, "The payments would be too high against your income. Try a smaller amount or a longer term." |
| T-4 | AC-4 | `alex` | `allowReferral` on / off | Self-employed, $20,000.00, 60 months, income $8,000.00, other payments $0: on gives "We need to look at this" and "Application in review"; off gives "Application not approved". |
| T-5 | AC-5 | `alex` | none | $10,000.00, 12 months, income $2,500.00, other payments $100.00: ratio 39% is between 35% and 40%, so approved at 9.9% a year (8.9% plus one point), payment $878.69. |
| T-6 | AC-6 | `alex` | none | Accept without the tick: "Agree to the terms to continue." |
| T-7 | AC-9 | `alex` with 3 loans | none | Continue on screen 1: "You already have the maximum number of loans." |
| T-8 | AC-10 | `alex` | `arrFee` off | T-1: no fee row; Current account credited $5,000.00. |
| T-9 | AC-7 | `alex` | wrong code (planned) | `STEP_UP_FAILED`; no loan, no money. |
| T-10 | AC-11 | `alex` | `unavailable: ["bank.loans.eligibility"]` (prototype: Service down on) | Connection sheet on "Check my application"; no application. |
| T-11 | AC-11 | `alex` | `timeout: ["bank.loans.eligibility"]`, `latencyMs: 10000` | After 10 seconds the timeout message; no application. |

#### 10. Expected mutation-check survivors

`BUREAU_UNAVAILABLE` is never raised by the prototype (planned); it survives until the adapter exists. `ACCOUNT_CANNOT_CREDIT` survives because only a frozen account triggers it and the seed has none; expected. The second `LOAN_LIMIT` check at submit survives (the first screen already stops it). The "over 12 times income" referral rule survives when scenarios use ordinary amounts; expected. Everything else: none expected.

---

### ★ Repay a loan — `repay-loan`

**Catalog:** slug `repay-loan` (name "Repay a loan"), workspace `personal`, category Save & Borrow (Personal: Save & Borrow), core no, can a bank switch it off: yes (basic, kept in the Lean preset). Options (all default on): **Allow paying any amount** (`allowCustom`), **Allow settling in full** (`allowSettle`), **Charge a 1% early settlement fee** (`settleFee`). Research: `research/repay-loan.md`. Built in `design/bankworkx-r1/src/journeys/67-loans.js`.

The lean rework removed the schedule view, the payment history and the choice of the next payment date.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `repay-loan` |
| Purpose | Pay the next instalment, pay another amount, or settle the loan in full, with the settlement figure shown before the customer chooses. |
| Release / workspace | 1 / Personal |
| Status | Built in the prototype as a form journey (`submit: "Pay"`, one-time code). Moves money |
| Channels | Web and mobile |
| Starting pattern | Choose a loan, how much, pay from, review, code, result |
| Who may use it | Anyone signed in to Personal with `payments.create`, for their own loans |

Configuration: the instalment splits into interest (balance × rate ÷ 12) and principal. Settling in full costs the balance, interest since the last payment (balance × rate × days ÷ 365) and a 1% fee of the balance when more than 12 payments remain. No market difference.

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Save › Loans › card › Repay | `{loanId}` | `payments.create` |
| Deep link `/personal/j/repay-loan?loanId=ln1&option=settle` | `loanId`, optional `option` (`next`, `custom`, `settle`) | `payments.create` |

With one loan the choice of loan is skipped.

#### 3. Screens

**Screen `pick`: Choose a loan** (no `loanId`). Choice cards: loan name and "{balance} left · next payment {date}". Required, "Choose a loan." No loans: "You have no loans."

**Screen `opt`: How much?** Choice cards (default "Pay next instalment"):

| Card | Sub line | Right side | Shown as unavailable when |
|---|---|---|---|
| Pay next instalment | "Due 1 Dec 2026" | the instalment, "$412.50" (smaller of instalment plus interest and the balance) | never |
| Pay another amount | "Reduces what you owe" | none | `allowCustom` is off |
| Settle in full | "Includes a $96.00 early settlement fee" or "No early settlement fee" | the settlement figure, "$9,701.21" | `allowSettle` is off |

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Amount (only for "Pay another amount") | amount, `$`, sample 200 | yes then | not empty | "Enter an amount." |
| | | | at least 10 | "The smallest payment is $10.00." |
| | | | below the balance | "To pay everything off, choose Settle in full." |

**Screen `from`: Pay from** (button **Review**). Select **From** (required, default Current account) with the shared account check applied to the amount to pay.

**Screen `review`: Review.** Rows: Loan; From; Balance (settle only); Interest to date (settle, when above 0); Early settlement fee (settle, when charged); You pay; Balance after. Button **Pay**, then the code sheet "Authorise {amount} to {loan name}".

**Result**

| Option | Title and text | Receipt rows |
|---|---|---|
| Next instalment or another amount | "Payment made" / "Your next payment is 1 Jan 2027." or "$9,400.00 left to pay." | Loan; From; Paid; Balance now; Next payment (if any balance remains) |
| Settle in full | "Loan settled" / "The loan is paid off." | Loan; From; Paid; Balance now ($0.00) |

Buttons **View Save** (Save tab) and **Done**. The payment shows in Activity as "Loan payment: {loan name}". A paid-off loan disappears from the Save tab. The next instalment reduces the balance by its principal part and moves the due date one month; another amount reduces the balance by the whole amount and, when it is at least one instalment, moves the due date one month.

**States**
- Loading: none beyond the sheet.
- Empty: "You have no loans."
- Error: unavailable shows the connection sheet; a timeout shows the message below. Nothing was paid.
- Stale: "We can’t find that loan."

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `LOAN_NOT_FOUND` | "We can’t find that loan." | submit | Back |
| `INSUFFICIENT_FUNDS` | "There isn’t enough money in that account." | submit | Back |
| `STEP_UP_FAILED` (planned) | "We couldn’t confirm this payment. Nothing was paid. Start again." | code | Start again |
| `TIMEOUT` | "We didn’t get an answer in time. Check Activity before you try again, so you don’t pay twice." | submit | Try again |
| `SERVICE_UNAVAILABLE` | Connection sheet | submit | Try again |
| `JOURNEY_DISABLED` | "This isn’t available at your bank." | whole journey | none |
| `PERMISSION_DENIED` (planned) | Standard message | whole journey | Back |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `accounts` | `bank.accounts.list` | none | accounts | none | Existing |
| `loans` | `bank.loans.list` | none | loans | none | (planned). `D.loans` |
| `settleQuote` | `bank.loans.settlement.quote` | `{loanId}` | `{balance, interest, fee, total}` | `LOAN_NOT_FOUND` | (planned) |
| `repay` | `bank.loans.repay` | `{loanId, amount, fromAccountId}` | `{balance, next, reference}` | `LOAN_NOT_FOUND`, `INSUFFICIENT_FUNDS` | (planned) |
| `settle` | `bank.loans.settle` | `{loanId, fromAccountId}` | `{reference}` | `LOAN_NOT_FOUND`, `INSUFFICIENT_FUNDS` | (planned) |
| `sendOtp` / `verifyOtp` | `bank.otp.send` / `bank.otp.verify` | `{channel}` / `{code}` | `{sent}` / `{verified}` | `OTP_INVALID`, `OTP_LOCKED` | Existing |

#### 6. Permissions, step-up and limits

`payments.create`. Step-up: one-time code on every payment. Limits: another amount from $10.00 to just below the balance; the paying account must hold the amount.

#### 7. Result and links out

As above. Notifications (planned): "We took {amount} for your loan {name}"; "Your loan {name} is paid off". Links out: Save tab.

#### 8. Acceptance criteria

- AC-1: The next instalment shows its due date and amount; another amount shows only when `allowCustom` is on; settle only when `allowSettle` is on.
- AC-2: The settlement figure (balance, interest since the last payment, fee) is shown on its card before it is chosen.
- AC-3: The fee applies only with `settleFee` on and more than 12 payments left.
- AC-4: Another amount is at least $10.00 and below the balance, with the messages above.
- AC-5: The account that pays must hold the amount to pay.
- AC-6: Review shows the amount to pay and the balance after; a code is asked before anything is paid.
- AC-7: Paying the next instalment lowers the balance by its principal part and moves the next date one month.
- AC-8: Settling pays off the loan and removes it from the Save tab.
- AC-9: With one loan, the choice of loan is skipped; with none, the journey says so.
- AC-10: When the bank is unavailable or times out nothing is paid.

#### 9. Scenarios

Synthetic persona `alex`, loan `ln1` ($9,600.00 left, 9.90%, instalment $412.50, 24 left, last paid 1 Nov 2026, next 1 Dec 2026), Current account $8,102.40 available.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-6, AC-7 | `alex`, `loanId: "ln1"` | none | Pay next instalment: $412.50 (interest $79.20, principal $333.30). Review: You pay $412.50, Balance after $9,266.70. Code. "Payment made", next payment 1 Jan 2027. |
| T-2 | AC-4 | `alex`, `ln1` | none | Another amount $5: "The smallest payment is $10.00." $9,600: "To pay everything off, choose Settle in full." $200: balance now $9,400.00 and the due date stays 1 Dec 2026. A payment of $450 moves the date to 1 Jan 2027. |
| T-3 | AC-2, AC-3, AC-8 | `alex`, `ln1` | none | Settle in full: card shows "Includes a $96.00 early settlement fee" and $9,701.21. Review: Balance $9,600.00, Interest to date $5.21, Early settlement fee $96.00, You pay $9,701.21, Balance after $0.00. "Loan settled"; the loan is gone. |
| T-4 | AC-3 | `alex`, loan with 12 payments left | none | Card says "No early settlement fee". |
| T-5 | AC-1 | `alex` | `allowCustom` off, `allowSettle` off | Those cards are unavailable. |
| T-6 | AC-5 | `alex`, `ln1`, Settle in full | none | From Current account: "Not enough money in Current account. Available: $8,102.40." and Review is disabled; choosing Savings works. |
| T-7 | AC-9 | `alex`, no loans | `empty` (planned) | "You have no loans." |
| T-8 | AC-6 | `alex` | wrong code (planned) | `STEP_UP_FAILED`; nothing paid. |
| T-9 | AC-10 | `alex` | `unavailable: ["bank.loans.repay"]` (prototype: Service down on) | Connection sheet; balance unchanged. |
| T-10 | AC-10 | `alex` | `timeout: ["bank.loans.repay"]`, `latencyMs: 10000` | After 10 seconds the timeout message; balance unchanged. |

#### 10. Expected mutation-check survivors

`INSUFFICIENT_FUNDS` and `LOAN_NOT_FOUND` on submit survive because earlier checks already stop them; expected. Interest to date survives when scenarios settle on the day of the last payment; expected. Everything else: none expected.

---
### ★ Invest — `invest`

**Catalog:** slug `invest` (name "Invest"), workspace `personal`, category Save & Borrow (Personal: Save & Borrow), core no, can a bank switch it off: yes (not in the Lean preset). Options (both default on): **Ask for risk acknowledgement on high-risk funds** (`riskAck`), **Offer high-risk funds** (`allowHigh`). Research: `research/invest.md`. Built in `design/bankworkx-r1/src/journeys/68-invest.js`.

The lean rework replaced the nine-instrument market (stocks, watchlist, explorer, charts) with a shelf of four generic funds, each with a risk level, an ongoing charge, a smallest amount and a price per unit.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `invest` |
| Purpose | Choose a fund, see its risk and charge, and invest an amount from an account. |
| Release / workspace | 1 / Personal |
| Status | Built in the prototype as a form journey (`submit: "Invest"`, one-time code). Moves money |
| Channels | Web and mobile |
| Starting pattern | Choose a fund, amount, review, code, result |
| Who may use it | Anyone signed in to Personal with `payments.create` |

The fund shelf (sandbox, synthetic):

| Fund | Risk | Ongoing charge | Smallest amount | Price per unit | About |
|---|---|---|---|---|---|
| Government Bond Fund | Low | 0.30% a year | $50.00 | $10.50 | Short-dated government bonds |
| Balanced Portfolio | Medium | 0.65% | $100.00 | $16.00 | A mix of shares and bonds |
| Global Equity Fund | High | 0.85% | $100.00 | $27.50 | Shares in large companies worldwide |
| Technology Growth Fund | High | 1.10% | $250.00 | $42.00 | Shares in technology companies |

No market difference. (Investor-protection checks differ by market; the prototype uses one risk box. Open: suitability questions before a first investment, see research.)

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Save › Investments › Invest (heading button, card button) | none | `payments.create` |
| Result of an investment › Invest more | none | `payments.create` |
| Deep link `/personal/j/invest?fundId=bal` | optional `fundId` | `payments.create` |

#### 3. Screens

**Screen 1 `fund`: Choose an investment**

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Risk | chips "All" (default), "Low", "Medium", "High" ("High" only when `allowHigh` is on); changing it clears the choice | no | none | none |
| Investment | choice cards: name; "{about} · from {smallest}"; "{charge}% a year"; a chip "Low risk" (green), "Medium risk" (amber) or "High risk" (red). High-risk funds are left out when `allowHigh` is off | yes | one chosen | "Choose an investment." |

**Screen 2 `amount`: How much?** Live card: "Estimated units" (amount ÷ price, three decimals) and "Ongoing charge" ("0.85% a year (about $1.70)").

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Amount | amount, `$`, sample 250, hint "Smallest amount: $100.00" | yes | at least the fund's smallest amount | "The smallest amount for this fund is $100.00." |
| | | | the account can cover it | the shared account messages |
| From | select of accounts, default Current account | yes | chosen | "Choose an account." |
| I understand I could lose some or all of the money I invest. | checkbox, shown for a High-risk fund when `riskAck` is on | yes then | ticked | "Please confirm to continue." |

**Screen 3 `review`: Review.** Rows: Investment; Risk; From; Amount; Estimated units; Ongoing charge ("0.85% a year"); Price ("$27.50 per unit"). Button **Invest**, then the code sheet "Authorise $200.00 into Global Equity Fund".

**Result:** "Investment made" / "$200.00 is invested in Global Equity Fund." Receipt: Investment; From; Amount; Units; Ongoing charge. Buttons **View investments** (Save tab), **Invest more**, **Done**. Activity shows "Invested: {fund}" (category Investing). Buying a fund already held adds to the holding; the portfolio card on the Save tab changes.

**States**
- Loading: none beyond the sheet.
- Empty: not applicable (the shelf is fixed).
- Error: unavailable shows the connection sheet; a timeout shows the message below. Nothing was invested.
- Stale: a fund that closes in between: "This fund is closed to new money."

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `BELOW_MINIMUM` | "This is below the smallest amount for this fund." | submit | Change amount |
| `INSUFFICIENT_FUNDS` | "There isn’t enough money in that account." | submit | Back |
| `FUND_CLOSED` | "This fund is closed to new money." | submit | Choose fund |
| `STEP_UP_FAILED` (planned) | "We couldn’t confirm this. Nothing was invested. Start again." | code | Start again |
| `TIMEOUT` | "We didn’t get an answer in time. Check your investments before you try again, so you don’t invest twice." | submit | Try again |
| `SERVICE_UNAVAILABLE` | Connection sheet | submit | Try again |
| `JOURNEY_DISABLED` | "This isn’t available at your bank." | whole journey | none |
| `PERMISSION_DENIED` (planned) | Standard message | whole journey | Back |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `accounts` | `bank.accounts.list` | none | accounts | none | Existing |
| `funds` | `bank.funds.list` | none | fund shelf | none | (planned). The prototype uses the constant `IVX_FUNDS`. The existing `bank.invest.instruments` serves nine made-up stocks and funds (`packages/mock-bank-api/src/invest.ts`) |
| `buy` | `bank.funds.buy` | `{fundId, amount, fromAccountId}` | `{units, price, reference}` | `BELOW_MINIMUM`, `INSUFFICIENT_FUNDS`, `FUND_CLOSED` | (planned). The existing `bank.invest.buy` buys by symbol, $1 to $50,000 |
| `sendOtp` / `verifyOtp` | `bank.otp.send` / `bank.otp.verify` | `{channel}` / `{code}` | `{sent}` / `{verified}` | `OTP_INVALID`, `OTP_LOCKED` | Existing |

#### 6. Permissions, step-up and limits

`payments.create`. Step-up: one-time code on every purchase. Limits: the fund's smallest amount; the paying account must hold the amount.

#### 7. Result and links out

As above. Notifications (planned): "You invested {amount} in {fund}". Links out: Save tab; `sell-investment`.

#### 8. Acceptance criteria

- AC-1: The shelf lists funds with risk chip, charge and smallest amount; the risk chips filter it; High is hidden with `allowHigh` off.
- AC-2: The amount must reach the fund's smallest amount and be covered by the paying account.
- AC-3: The estimated units and charge update as the amount changes.
- AC-4: A High-risk fund needs the ticked risk box when `riskAck` is on, and not otherwise.
- AC-5: Review shows investment, risk, account, amount, units, charge and price; a code is asked before anything is bought.
- AC-6: A purchase takes the amount from the account and adds units to the holding (a new holding or an increase).
- AC-7: A wrong code buys nothing.
- AC-8: When the bank is unavailable or times out nothing is invested.

#### 9. Scenarios

Synthetic persona `alex`, Current account $8,102.40 available, holdings as seeded. The sandbox code is the fixed test code.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-3, AC-4, AC-5, AC-6 | `alex` | none | Choose Global Equity Fund. $200.00 from Current account; units 7.273, charge about $1.70. Tick the risk box. Review, code. "Investment made"; Units 7.273; Current account $7,902.40; the portfolio card now reads $5,020.01. |
| T-2 | AC-2 | `alex` | none | Global Equity Fund, $50: "The smallest amount for this fund is $100.00." Government Bond Fund, $50: accepted. |
| T-3 | AC-4 | `alex` | `riskAck` off / Low-risk fund | No risk box. |
| T-4 | AC-1 | `alex` | `allowHigh` off | Only the Government Bond Fund and Balanced Portfolio show; no "High" chip. |
| T-5 | AC-2 | `alex` | none | $9,000: "Not enough money in Current account. Available: $8,102.40." |
| T-6 | AC-1 | `alex` | none | Risk "Low" lists only the Government Bond Fund. |
| T-7 | AC-7 | `alex` | wrong code (planned) | `STEP_UP_FAILED`; nothing bought. |
| T-8 | AC-8 | `alex` | `unavailable: ["bank.funds.buy"]` (prototype: Service down on) | Connection sheet; nothing invested. |
| T-9 | AC-8 | `alex` | `timeout: ["bank.funds.buy"]`, `latencyMs: 10000` | After 10 seconds the timeout message; nothing invested. |

#### 10. Expected mutation-check survivors

`BELOW_MINIMUM`, `INSUFFICIENT_FUNDS` on submit survive because the amount step already stops them; `FUND_CLOSED` is never raised by the seed; expected. The estimated-units rounding survives when scenarios use round figures; expected. Everything else: none expected.

---

### ★ Sell an investment — `sell-investment`

**Catalog:** slug `sell-investment` (name "Sell an investment"), workspace `personal`, category Save & Borrow (Personal: Save & Borrow), core no, can a bank switch it off: yes (not in the Lean preset). Option (default on): **Charge a 0.25% selling fee** (`sellFee`). Research: `research/sell-investment.md`. Built in `design/bankworkx-r1/src/journeys/68-invest.js`.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `sell-investment` |
| Purpose | Sell part or all of a holding, see the estimated proceeds and when the money arrives. |
| Release / workspace | 1 / Personal |
| Status | Built in the prototype as a form journey (`submit: "Sell"`, one-time code). Moves money (the sandbox credits the account at once, though the screens say when it arrives) |
| Channels | Web and mobile |
| Starting pattern | Choose a holding, amount, code, result |
| Who may use it | Anyone signed in to Personal with `payments.create`, for holdings they own |

Configuration: selling fee 0.25% of the amount sold; settlement two business days after the sale (from 3 Nov 2026: 5 Nov 2026); smallest sale $10.00. No market difference.

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Save › Investments › Sell | none | `payments.create` |
| Deep link `/personal/j/sell-investment?holdId=bal` | optional `holdId` (a fund id) | `payments.create` |

With one holding the choice is skipped.

#### 3. Screens

**Screen `pick`: What do you want to sell?** (no `holdId`). Choice cards: fund name; "{units} units"; value on the right. Required, "Choose an investment." No holdings: "You have no investments to sell."

**Screen `amount`: How much?** A card with the fund, its value and units. Live card: "Selling"; "Selling fee" (negative, only when charged); "Estimated proceeds"; "Money arrives" (settlement date). Button **Sell**, then the code sheet "Authorise selling $2,400.00".

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| (how) | chips "An amount" (default), "Everything" | no | none | none |
| Amount (only for "An amount") | amount, `$`, sample 100 | yes then | not empty | "Enter an amount." |
| | | | at least 10 | "The smallest sale is $10.00." |
| | | | not above the holding's value | "You can’t sell more than $2,400.00." |
| Pay into | select of accounts, default Current account | yes | chosen | "Choose an account." |

**Result:** "Sale placed" / "$2,394.00 arrives on 5 Nov 2026." Receipt: Investment; Sold; Selling fee; Estimated proceeds; Pay into; Settlement date. Buttons **View investments** and **Done**. Selling everything removes the holding; a part sale lowers units and cost in proportion. Activity shows "Sold: {fund}".

**States**
- Loading: none beyond the sheet.
- Empty: "You have no investments to sell."
- Error: unavailable shows the connection sheet; a timeout shows the message below. Nothing was sold.
- Stale: "You don’t hold any of this investment."

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `NOTHING_TO_SELL` | "You don’t hold any of this investment." | submit | Back |
| `ABOVE_HOLDING` | "You can’t sell more than you hold." | submit | Change amount |
| `MARKET_CLOSED` | "Selling is paused for this fund. Try again later." | submit | Try again later |
| `STEP_UP_FAILED` (planned) | "We couldn’t confirm this. Nothing was sold. Start again." | code | Start again |
| `TIMEOUT` | "We didn’t get an answer in time. Check your investments before you try again, so you don’t sell twice." | submit | Try again |
| `SERVICE_UNAVAILABLE` | Connection sheet | submit | Try again |
| `JOURNEY_DISABLED` | "This isn’t available at your bank." | whole journey | none |
| `PERMISSION_DENIED` (planned) | Standard message | whole journey | Back |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `accounts` | `bank.accounts.list` | none | accounts | none | Existing |
| `holdings` | `bank.funds.holdings` | none | holdings | none | (planned). The prototype reads `D.hold`. Existing `bank.invest.holdings` is for the nine-instrument market |
| `sell` | `bank.funds.sell` | `{fundId, amount \| all, toAccountId}` | `{proceeds, fee, settlesOn, reference}` | `NOTHING_TO_SELL`, `ABOVE_HOLDING`, `MARKET_CLOSED` | (planned). Existing `bank.invest.sell` sells by symbol with `NOT_HELD`, `INSUFFICIENT_HOLDING` |
| `sendOtp` / `verifyOtp` | `bank.otp.send` / `bank.otp.verify` | `{channel}` / `{code}` | `{sent}` / `{verified}` | `OTP_INVALID`, `OTP_LOCKED` | Existing |

#### 6. Permissions, step-up and limits

`payments.create`. Step-up: one-time code on every sale. Limits: $10.00 up to the holding's value.

#### 7. Result and links out

As above. Notifications (planned): "Your sale of {amount} settles on {date}". Links out: Save tab.

#### 8. Acceptance criteria

- AC-1: Only funds the customer holds are offered; with one holding the choice is skipped; with none the journey says so.
- AC-2: A part sale needs an amount from $10.00 to the holding's value, with the messages above; "Everything" needs none.
- AC-3: The live card shows the amount, the fee (when `sellFee` is on), the estimated proceeds and the settlement date.
- AC-4: A code is asked before anything is sold.
- AC-5: Selling everything removes the holding; a part sale reduces it.
- AC-6: The proceeds go to the chosen account.
- AC-7: With `sellFee` off no fee is shown or taken.
- AC-8: When the bank is unavailable or times out nothing is sold.

#### 9. Scenarios

Synthetic persona `alex`: Balanced Portfolio worth $2,400.00 (150 units), Global Equity Fund worth $2,420.00 (88 units).

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-3, AC-4, AC-5, AC-6 | `alex`, `holdId: "bal"` | none | "Everything": Selling $2,400.00, fee -$6.00, estimated proceeds $2,394.00, money arrives 5 Nov 2026. Code. "Sale placed"; the holding is gone; Current account up by $2,394.00. |
| T-2 | AC-2, AC-5 | `alex`, `holdId: "geq"` | none | $5: "The smallest sale is $10.00." $3,000: "You can’t sell more than $2,420.00." $100: fee -$0.25, proceeds $99.75; the holding drops to about 84.364 units. |
| T-3 | AC-7 | `alex` | `sellFee` off | T-1: no fee row; proceeds $2,400.00. |
| T-4 | AC-1 | `alex`, no holdings | `empty` (planned) | "You have no investments to sell." |
| T-5 | AC-1 | `alex`, no `holdId` | none | Both funds are offered with units and value. |
| T-6 | AC-4 | `alex` | wrong code (planned) | `STEP_UP_FAILED`; nothing sold. |
| T-7 | AC-8 | `alex` | `unavailable: ["bank.funds.sell"]` (prototype: Service down on) | Connection sheet; holding unchanged. |
| T-8 | AC-8 | `alex` | `timeout: ["bank.funds.sell"]`, `latencyMs: 10000` | After 10 seconds the timeout message; holding unchanged. |

#### 10. Expected mutation-check survivors

`NOTHING_TO_SELL`, `ABOVE_HOLDING` on submit survive because the earlier steps already stop them; `MARKET_CLOSED` is never raised by the seed; expected. The proportional cost reduction survives because the Save tab shows value, not cost per holding, after a part sale; expected. Everything else: none expected.

---

### ★ Add money — `add-money`

**Catalog:** slug `add-money` (name "Add money"), workspace `personal`, category Save & Borrow (Personal: Save & Borrow), core no, can a bank switch it off: yes (basic, kept in the Lean preset). Options (all default on): **Offer top-up from a card** (`allowCard`), **Charge the 1.5% card fee** (`cardFee`), **Offer bank transfer details** (`allowTransfer`). Research: `research/add-money.md`. Built in `design/bankworkx-r1/src/journeys/66-deposits-goals.js`.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `add-money` |
| Purpose | Top up an account from a saved card, or show the account details so the customer can send money from another bank. |
| Release / workspace | 1 / Personal |
| Status | Built in the prototype as a form journey (`submit: "Add money"`). The card path asks for a one-time code and moves money; the bank transfer path shows details only, with no code |
| Channels | Web and mobile |
| Starting pattern | Method, then card details or account details, code (card only), result |
| Who may use it | Anyone signed in to Personal with `payments.create` |

Configuration: card top-up $10.00 to $5,000.00 at once; fee 1.5% of the amount when `cardFee` is on.

**Home market configuration** (the identifiers on "By bank transfer"; the screens never name a country or a scheme):

| Market | Identifiers shown with Copy |
|---|---|
| Market A (routing number and account) | Routing number; Account number |
| Market B (sort code and account) | Sort code; Account number (8 digits) |
| Market C (IBAN) | IBAN; BIC |
| Market D (IBAN, mobile alias) | IBAN; BIC (the mobile alias is not shown here) |

Every market also shows "Account name" ("Alex Morgan").

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Home › Add | none | `payments.create` |
| Accounts › account details › Add money | `{accountId}` | `payments.create` |
| Save › Add money (listed in the prototype, but the Save tab has no such button today) | none | `payments.create` |
| Result › Add more | none | `payments.create` |
| Deep link `/personal/j/add-money?accountId=sav&amount=200` | optional `accountId`, `amount` | `payments.create` |

#### 3. Screens

**Screen 1 `method`: Add money.** Choice cards (default "From a card"): **From a card** ("Usually instant"), **By bank transfer** ("From an account at another bank"). A card is shown unavailable when its option is off. Required, "This is required."

**Screen 2 `card`: From a card** (when From a card; button **Add money**). Live card: "Amount"; "Card fee" (only when charged); "Charged to your card".

| Field | Type | Required | Validation | Message |
|---|---|---|---|---|
| Add to | select of accounts (default Current account, or `accountId`) | yes | chosen | "This is required." |
| Amount | amount, `$`, sample 200 | yes | at least 10 | "The smallest amount is $10.00." |
| | | | at most 5,000 | "The most you can add at once is $5,000.00." |
| Card | choice cards: "Visa ••4242", "Harbor Bank · expires 09/28"; an expired card is greyed out with the chip "Expired" and cannot be chosen | yes | chosen | "Choose a card." |
| Security code | text, 3 digits, placeholder "3 digits", sample 123, half width | yes | exactly 3 digits | "Enter the 3 digits on the back of the card." |

Then the code sheet "Authorise $203.00 from Visa ••4242".

**Screen 2 `bank`: By bank transfer** (button **Done**). Select **Add to**; then for the chosen account the identifiers for the home market, each with **Copy**, and "Account name: Alex Morgan"; note "Money usually arrives the same day. Use your name as the reference." No code.

**Result**

| Path | Title and text | Receipt rows | Buttons |
|---|---|---|---|
| Card | "Money added" / "$200.00 is in Current account." | Added to; Card; Amount; Card fee (if charged); Charged to your card | **View accounts** (Accounts tab), **Add more**, **Done** |
| Bank transfer | "Details ready" / "Send money to this account from your other bank." | Account; the market's identifiers | **Done** |

The credit shows in Activity as "Card top-up" (category Transfer).

**States**
- Loading: none beyond the sheet.
- Empty: not applicable. If both options are off both choices are unavailable.
- Error: unavailable shows the connection sheet; a timeout shows the message below; the card is not charged.
- Stale: a card that expired or an account that was frozen in between: the matching error below.

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `CARD_EXPIRED` | "This card has expired. Choose another card." | submit | Choose card |
| `CARD_DECLINED` | "Your card was declined. Try another card." | submit | Choose card |
| `LIMIT_EXCEEDED` | "The most you can add at once is $5,000.00." | amount | Change amount |
| `ACCOUNT_CANNOT_CREDIT` | "This account can’t receive money right now. Choose another account." | submit | Choose account |
| `STEP_UP_FAILED` (planned) | "We couldn’t confirm this. Nothing was charged. Start again." | code | Start again |
| `TIMEOUT` | "We didn’t get an answer in time. Check Activity before you try again, so you don’t pay twice." | submit | Try again |
| `SERVICE_UNAVAILABLE` | Connection sheet | submit | Try again |
| `JOURNEY_DISABLED` | "This isn’t available at your bank." | whole journey | none |
| `PERMISSION_DENIED` (planned) | Standard message | whole journey | Back |

`CARD_DECLINED` is raised for a card whose number ends in 0000; the seed has none, so a test must add one.

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `accounts` | `bank.accounts.list` | none | accounts | none | Existing |
| `cards` | `bank.cards.list` | none | map of cards | none | Existing (`packages/mock-bank-api/src/index.ts`). The prototype keeps its own three cards |
| `addMoney` | `bank.deposit.create` | `{toAccountId, fromCardId, amount}` | `{reference, newBalance}` | `INVALID_AMOUNT`, `ACCOUNT_NOT_FOUND`, `CARD_NOT_FOUND` | Existing. Today $1 to $50,000, no fee; the journey's $10 to $5,000 limit, fee and `CARD_EXPIRED`, `CARD_DECLINED`, `ACCOUNT_CANNOT_CREDIT`, `LIMIT_EXCEEDED` are (planned) |
| `details` | `bank.accounts.details` | `{accountId}` | identifiers for the home market | `ACCOUNT_NOT_FOUND` | (planned). The prototype builds them in `ACC.ids` |
| `sendOtp` / `verifyOtp` | `bank.otp.send` / `bank.otp.verify` | `{channel}` / `{code}` | `{sent}` / `{verified}` | `OTP_INVALID`, `OTP_LOCKED` | Existing |

#### 6. Permissions, step-up and limits

`payments.create`. Step-up: one-time code for the card path; **none** for bank transfer details. Limits: $10.00 to $5,000.00 per top-up.

#### 7. Result and links out

As above. Notifications (planned): "{amount} was added to {account} from your card ending {last4}". Links out: Accounts tab; this journey again.

#### 8. Acceptance criteria

- AC-1: The customer chooses card or bank transfer; an option switched off is shown unavailable.
- AC-2: A card top-up needs an amount from $10.00 to $5,000.00, an account, a non-expired card and a 3-digit security code, with the messages above.
- AC-3: An expired card cannot be chosen.
- AC-4: With `cardFee` on, the fee (1.5%) and the total charged are shown before the code and on the receipt; with it off no fee line appears.
- AC-5: A code is asked before a card is charged, never for bank transfer details.
- AC-6: A successful top-up raises the chosen account by the amount (not the fee) and shows "Money added".
- AC-7: Bank transfer shows the account's identifiers for the home market with Copy, the account name and the reference note.
- AC-8: When the bank is unavailable or times out the card is not charged.

#### 9. Scenarios

Synthetic persona `alex`, Current account $8,102.40 available; cards as seeded. The sandbox code is the fixed test code.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-2, AC-4, AC-5, AC-6 | `alex` | none | Card, Current account, $200.00, Visa ••4242, security code 123. Live card: Amount $200.00, Card fee $3.00, Charged to your card $203.00. Code sheet "Authorise $203.00 from Visa ••4242". "Money added"; Current account $8,302.40 available. |
| T-2 | AC-2 | `alex` | none | $5: "The smallest amount is $10.00." $6,000: "The most you can add at once is $5,000.00." Security code "12": "Enter the 3 digits on the back of the card." No card: "Choose a card." |
| T-3 | AC-3 | `alex` | none | Visa ••0019 shows "Expired" and cannot be chosen. |
| T-4 | AC-4 | `alex` | `cardFee` off | No fee line; charged $200.00. |
| T-5 | AC-1 | `alex` | `allowCard` off / `allowTransfer` off | The matching choice is unavailable. |
| T-6 | AC-5, AC-7 | `alex`, market A / B / C | none | By bank transfer: routing number and account number / sort code and account number / IBAN and BIC; Copy buttons; "Alex Morgan"; "Details ready" with no code. |
| T-7 | AC-6 | `alex`, `accountId: "sav"` | none | The top-up goes to Savings ••7720. |
| T-8 | AC-5 | `alex` | wrong code (planned) | `STEP_UP_FAILED`; card not charged. |
| T-9 | AC-8 | `alex` | `unavailable: ["bank.deposit.create"]` (prototype: Service down on) | Connection sheet; no credit. |
| T-10 | AC-8 | `alex` | `timeout: ["bank.deposit.create"]`, `latencyMs: 10000` | After 10 seconds the timeout message; no credit. |

#### 10. Expected mutation-check survivors

`CARD_EXPIRED` on submit survives because an expired card cannot be chosen; `LIMIT_EXCEEDED` on submit survives because the amount step stops it; `CARD_DECLINED` and `ACCOUNT_CANNOT_CREDIT` survive because the seed has no card ending 0000 and no frozen account; expected. Everything else: none expected.

---

## Personal: More

The **More** tab holds the person's own details, their conversations with the bank, and settings. Four journeys start here: `update-profile`, `new-message`, `service-request`, `connect-account`. Security journeys (`change-password`, `trusted-devices`, `change-quick-pin`, `setup-quick-login`) are launched from Settings › Security and are specified in the security group of this module.

Shared rules for every shell screen below: view-models are built in `packages/bank-client` (planned unless marked); all lists show a skeleton while loading and the timeout state after 10 seconds (README 1.4); all screens follow the system states in **System states** at the end of this file; dates `12 Nov 2026`, times 24-hour UTC.

### Shell: More menu

| Item | Detail |
|---|---|
| Purpose | Entry list for everything that is not money. |
| Route | Web `/personal/more`. Mobile screen `MoreMenu` (tab 6 of the pill bar). |
| Data source | `MoreMenuViewModel` (planned): unread message count, unread notification count, open request count, profile completeness. Calls `bank.session.get` (planned) for permissions. |
| Widgets | Header card: avatar with initials, name "Alex Morgan", line "Personal banking". Then one `menu` block with rows (below). Footer: app version "BankWorkx® 1.0.0 (sandbox)". |
| Loading | Header skeleton and 8 row skeletons. Rows render at once without counts; counts fade in. |
| Empty | Not applicable. |
| Error | If counts fail, rows still show without badges. No error banner. |

Rows, in order. A row shows only when the context holds the permission (README 4.1).

| # | Row label | Right side | Leads to | Permission |
|---|---|---|---|---|
| 1 | Profile | – | Shell: Profile | `accounts.view` |
| 2 | Secure messages | Unread badge | Shell: Secure messages inbox | `messages.send` |
| 3 | Notifications | Unread badge | Shell: Notification centre | `accounts.view` |
| 4 | Requests and complaints | Open count | Shell: Service request tracker | `messages.send` |
| 5 | Linked banks | Count | Shell: Linked banks list | `accounts.view` |
| 6 | Settings | – | Shell: Settings | `accounts.view` |
| 7 | Help | – | Shell: Help | none |
| 8 | Legal | – | Shell: Legal | none |
| 9 | Switch to Business | Company name | Context switch (step-up), README 5.2 "Header" | context |
| 10 | Sign out | – | Shell: Sign out confirmation | none |

Drill-downs: each row opens its shell. Row 9 shows only when the person has a business context (Alex: Alpha Trading LLC, Beta Services Ltd). Launch points on it: none (it is a place, not a launcher).

### Shell: Profile

| Item | Detail |
|---|---|
| Purpose | Show the details the bank holds and let the person change contact details. |
| Route | Web `/personal/more/profile`. Mobile screen `Profile`. |
| Data source | `bank.profile.get` (planned): `{ name, customerId, dateOfBirth, phone, email, address, kycLevel, memberSince, lastLogin }`. |
| Widgets | Identity card (name, customer id "BWX-0042-1187", member since "Mar 2021"). Sections "Contact details" and "Security". |
| Fields shown | See table. |
| Loading | Skeleton card and 5 row skeletons. |
| Empty | Not applicable. A missing value shows "Not set" with the button "Add". |
| Error | "We couldn't load your profile. Nothing was changed." Button "Try again". |

| Row | Value (Alex) | Editable | Button |
|---|---|---|---|
| Full name | Alex Morgan | No. Helper: "To change your name, send a service request." | "Request a change" opens `service-request` with `{type: "name-change"}` |
| Date of birth | 14 Jun 1988 (shown as 14 Jun ••••) | No | – |
| Mobile number | +1 415 555 0142 | Yes | "Change" opens `update-profile` `{field: "phone"}` |
| Email | alex.morgan@example.com | Yes | "Change" opens `update-profile` `{field: "email"}` |
| Home address | 22 Harbour Lane, Springfield, 90210, United States | Yes | "Change" opens `update-profile` `{field: "address"}` |
| Identity check level | "Verified" statusChip (planned) | No | – |
| Last sign-in | 02 Nov 2026 09:14 UTC, Chrome on macOS | No | "See trusted devices" opens `trusted-devices` |

Sort order: fixed as above. Drill-downs: as the button column. After `update-profile` finishes, the person returns here with the new value shown and a toast "Mobile number updated". Launch points on it: Profile › Change (all three) → `update-profile`; Profile › Request a change → `service-request`; Profile › See trusted devices → `trusted-devices`.

### Shell: Secure messages inbox and thread

| Item | Detail |
|---|---|
| Purpose | Private conversations with the bank. Replaces email for anything with account details. |
| Route | Inbox web `/personal/more/messages`; mobile `Messages`. Thread web `/personal/more/messages/{threadId}`; mobile `MessageThread`. |
| Data source | `bank.messages.list` (planned) returns threads; `bank.messages.get {threadId}` (planned) returns messages; `bank.messages.markRead {threadId}` (planned). |
| Launch points | Messages › "New message" → `new-message` `{topic, accountId}`. |

**Inbox**

| Item | Detail |
|---|---|
| Widgets | Search box "Search messages". Filter chips: All, Unread, Answered, Closed. List of thread rows. Floating button "New message". |
| Row columns | Subject (bold if unread); topic chip; last line (one line, 80 characters); date ("Today 09:14" or "12 Nov"); paperclip icon if an attachment exists; blue dot if unread. |
| Sort | Last activity, newest first. Unread threads do not jump to the top. |
| Filters | All (default), Unread (`unread = true`), Answered (last message is from the bank), Closed (`status = "closed"`). Search matches subject and message text. |
| Loading | 6 row skeletons. |
| Empty (no messages at all) | "No messages yet. Write to us and the answer will appear here." Button "New message". |
| Empty (filter) | "Nothing matches. Clear the filter to see all messages." Button "Clear filter". |
| Error | "We couldn't load your messages. Nothing was changed." Button "Try again". |
| Drill-down | Tap a row → thread. |

**Thread**

| Item | Detail |
|---|---|
| Header | Subject, topic chip, reference "MSG-20261102-0007", status chip (Open, Answered, Closed). |
| Body | Bubbles in time order. The person's bubbles on the right; the bank's on the left with the label "BankWorkx® Support". Attachments are file tiles (name, size, type). Account references show as "Main ••4410". |
| Footer (open thread) | Text box "Write a reply" (max 1,000 characters, counter), button "Attach a file" (planned `fileUpload`: PDF, JPG, PNG, up to 5 MB, max 3), button "Send reply". |
| Footer (closed thread) | "This conversation is closed." Button "Start a new message" → `new-message` with the same `{topic, accountId}`. |
| Reply error | Inline under the box: "We couldn't send your reply. Your text is still here." Button "Try again". |
| Reply rules | Empty reply: button disabled. Over 1,000 characters: "Replies can be up to 1,000 characters." |
| Loading | Bubbles skeleton. Opening a thread calls `bank.messages.markRead`. |
| Empty | Not applicable (a thread has at least one message). |
| Sandbox | The bank answers a new thread 2 seconds after it is sent: "Thanks Alex. We have your message and will reply within 1 working day." That reply raises notification N-31. |

### Shell: Notification centre

| Item | Detail |
|---|---|
| Purpose | One list of everything the bank told the person, in order. Same items as push, in-app, email and SMS. |
| Route | Web `/personal/more/notifications`; mobile `Notifications`. A bell icon in the header of every Personal screen opens it (badge = unread count, "9+" above nine). |
| Data source | `bank.notifications.list {filter, cursor}` (planned) → `{ items[], unread, nextCursor }`; `bank.notifications.markRead {ids[]}` (planned); `bank.notifications.markAllRead` (planned). Item shape: `{ id, tag, title, body, createdAt, read, channel, deepLink, journeySlug }`. |
| Widgets | Segmented control: **All**, **Unread**. Context-tag chips: Payments, Cards, Security, Accounts, Saving, Borrowing, Messages, Application, Profile, Offers. Link "Mark all as read". List grouped by day: Today, Yesterday, Earlier this week, Earlier. |
| Row | Icon for the tag; title (bold when unread); body (two lines max); relative time ("2 min ago", then `12 Nov`); tag chip; blue dot when unread. |
| Sort | `createdAt` descending. |
| Filters | Read state: All or Unread. Tag chips are multi-select (OR). Filters reset when the person leaves the screen. Link "Clear filters" appears when any is on. |
| Paging | 20 per page; "Load more" at the end. |
| Loading | 8 row skeletons. |
| Empty (all) | "You're all caught up. New alerts will appear here." No button. |
| Empty (Unread) | "No unread notifications." Button "Show all". |
| Empty (tag filter) | "Nothing in {tag} yet." Button "Clear filters". |
| Error | "We couldn't load your notifications. Nothing was changed." Button "Try again". |
| Retention | 90 days. Older items are removed and the list ends with "Notifications older than 90 days are removed." |

**Read and unread.** A notification is unread until the person taps it, taps "Mark all as read", or opens the deep-link target. Opening the screen alone does not mark anything read. The bell badge counts unread items and updates within 2 seconds of a change.

**Deep-link behaviour.** Tapping a row marks it read, then opens its `deepLink`:

| Rule | Behaviour |
|---|---|
| Target is a shell screen | Opens that screen with the tab bar visible. Back returns to the notification centre. |
| Target is a journey (`/personal/j/<slug>?…`) | Opens the journey at its entry screen with the values from the link. When the journey ends, "Done" returns to the notification centre. |
| Target needs a permission the person lacks | A bottom sheet: "You can't open this. Your profile doesn't allow it." Button "Close". The item stays read. |
| Target belongs to another context | The sheet "This belongs to your {workspace} banking. Switch to {workspace} to continue." Buttons "Switch" (step-up if required) and "Not now". |
| Target no longer exists (card closed, payment older than 13 months) | Sheet "This item is no longer available." Button "Close". |
| Person is signed out when a push is tapped | Sign-in opens; after sign-in the deep link opens. If the person signs in to a different customer, the link is dropped and Home opens. |
| Item is in a journey the person is already in | The current journey is not interrupted; a toast "Finish what you're doing first" shows and the link is kept in the list. |
| Link carries an unknown or malformed value | Home opens with the toast "That link isn't valid anymore." |

Launch points on it: Notification (any) › Card activation reminder → `activate-card` `{cardId}`; Notification › Application update → `track-application` `{applicationId}` (README 5.2); every other notification row opens the link in the **Notifications catalogue** at the end of this file.

### Shell: Service request tracker

| Item | Detail |
|---|---|
| Purpose | Follow requests and complaints raised with `service-request`. |
| Route | Web `/personal/more/requests`; web detail `/personal/more/requests/{requestId}`; mobile `Requests`, `RequestDetail`. |
| Data source | `bank.requests.list` (planned) and `bank.requests.get {requestId}` (planned). Item: `{ id, reference, type, subject, status, createdAt, dueAt, slaLabel, timeline[], attachments[] }`. |
| Widgets | Filter chips: Open, Resolved, All (default Open). Button "New request". Table (`dataTable`, planned; card list on phones). |
| Columns | Reference ("SR-20261102-0003"); Type (Request, Complaint); Subject; Status (`statusChip`: Received, In progress, Waiting for you, Resolved, Rejected); Opened (`12 Nov 2026`); Due by (`dueAt`, red if overdue); last update. |
| Sort | Opened, newest first. Header taps re-sort by Opened, Due by or Status. |
| Detail | Header with reference, type and status chip. `timeline` (planned) with: Received, Assigned, In progress, Waiting for you (if the bank asked a question), Resolved or Rejected, each with date and time. Panel "Our promise": "Requests: 3 working days. Complaints: 5 working days to a first answer." A box "Reply to the bank" appears when status is Waiting for you. Attachments list. Button "Open conversation" → the related secure message thread. |
| Loading | 5 row skeletons; detail timeline skeleton. |
| Empty (Open) | "You have no open requests." Button "New request". |
| Empty (All) | "You haven't raised a request yet. Use this when you need a change made or want to complain." Button "New request". |
| Error | "We couldn't load your requests. Nothing was changed." Button "Try again". |
| Drill-downs | Row → detail. "New request" → `service-request`. |
| Launch points | More › requests › New request / Complaint → `service-request` `{type}` (README 5.2). |

### Shell: Settings

| Item | Detail |
|---|---|
| Purpose | Change how the app looks, speaks and notifies. |
| Route | Web `/personal/more/settings` (sub-pages `/language`, `/appearance`, `/notifications`, `/security`, `/linked-banks`); mobile `Settings` and children. |
| Data source | `bank.settings.get` (planned) → `{ language, theme, notifications: { <tag>: { push, email, sms } }, quietHours }`; `bank.settings.update {patch}` (planned; error codes `INVALID_SETTING`, `TIMEOUT`, `SERVICE_UNAVAILABLE`; not money moving; no OTP). Language and theme are also stored on the device so they apply before sign-in. |
| Loading | Row skeletons; saved device values show first. |
| Error on save | Toast "We couldn't save that. Your old setting is still on." and the control springs back. |

Rows: **Language**, **Appearance**, **Notifications**, **Security**, **Linked banks**, **About**.

| Page | Contents |
|---|---|
| Language | Radio list: English (selected). Arabic (العربية) is shown disabled with "Coming soon" in Release 1. Selecting applies at once and keeps the person on the page. Helper: "This changes the app. Statements stay in English." |
| Appearance | Three tiles: **Light**, **Dark**, **System** (default). Helper under System: "Follows your phone or computer." A live preview card shows the choice. Applied at once; survives sign-out. |
| Notifications | One row per context tag (Payments, Cards, Security, Accounts, Saving, Borrowing, Messages, Application, Profile, Offers) with three toggles: Push, Email, SMS. Rules: **Security** notifications (N-60 to N-69 in the catalogue) and "Money leaving your account" (payments) cannot be turned off; their toggles show on and locked, helper "Required for your safety". Offers default to off for SMS and email. A toggle at the top "Pause push for quiet hours" with a time range 22:00 to 07:00 (security alerts still arrive). Changes save on tap. Turning off a channel with no registered address (SMS with no phone) shows "Add a mobile number first" with button "Go to profile". |
| Security | Rows: Change password → `change-password`; Trusted devices → `trusted-devices`; Change quick PIN → `change-quick-pin`; Biometrics (toggle row) → `setup-quick-login`. A row shows only with `security.manage`. |
| Linked banks | See next shell. |
| About | Version, build, sandbox badge, links to Legal. |

Launch points on it: Settings › Security rows and Settings › Linked banks › Connect (README 5.2).

### Shell: Help

| Item | Detail |
|---|---|
| Purpose | Answers and ways to reach the bank. |
| Route | Web `/personal/more/help`; mobile `Help`. Also reachable before sign-in from the Landing "Contact us" button. |
| Data source | Static content from `packages/bank-client` (planned `help-content.ts`). No adapter. |
| Widgets | Search box "Search help". Accordion of 12 questions in 4 groups (Getting started, Payments, Cards, Security). Card "Talk to us": phone "+1 800 555 0100", hours "Mon to Fri, 08:00 to 20:00 UTC", button "Call" (mobile: dialer; web: copies number). Button "Send a secure message" → `new-message`. Button "Find a branch or ATM" → `find-branch-atm`. Link "Contact us" → `contact-support` (when signed out). |
| Search | Filters the accordion on question and answer text; no result: "No answer found. Send us a message and we'll help." Button "Send a secure message". |
| Loading | Instant (static). |
| Error | None expected. |
| Sample entries | "How do I freeze my card?" → "Open Cards, choose the card and tap Freeze." (button "Go to Cards"). "Why was I asked for a code?" → "We ask for a one-time code when money leaves your account, or when you change something that protects you." |

### Shell: Legal

| Item | Detail |
|---|---|
| Purpose | Terms the person has agreed to and the bank's notices. |
| Route | Web `/personal/more/legal` (and `/legal` before sign-in); mobile `Legal`. |
| Data source | `bank.legal.list` (planned): `{ id, title, version, effectiveFrom, url }`. |
| Table columns | Document (Terms of use, Privacy notice, Cookie notice, Fees and limits, Licences and notices); Version ("v3"); In force from (`01 Oct 2026`); Accepted on (`14 Mar 2021`, or "–" for notices). |
| Sort | Fixed order as listed. |
| Drill-down | Row → document page with the text and a "Download PDF" button (web: download; mobile: share sheet). |
| Empty | "No documents to show." (should not happen). |
| Error | "We couldn't load the documents. Try again." Button "Try again". |
| Banner | When a new version needs acceptance: "We updated our Terms of use on {date}. Read and accept to keep using BankWorkx®." Button "Read and accept" (opens the document, then a `consent` block). |

### Shell: Sign out confirmation

| Item | Detail |
|---|---|
| Purpose | Make sure the person means to leave, and clean up. |
| Route | A modal (`dialog` block) over More; no route of its own. |
| Copy | Title "Sign out of BankWorkx®?". Body "You'll need to sign in again. Quick sign-in stays set up on this device." |
| Buttons | "Sign out" (destructive) calls `bank.session.signOut` (planned), clears cached data, drafts, open sheets, and opens the Landing screen with the toast "You've been signed out." "Stay signed in" closes the dialog. |
| Option | Checkbox "Also forget this device" (shown only when quick sign-in is set up). Ticked → quick PIN and biometrics for this device are removed; the toast adds "This device was forgotten." |
| If sign-out fails | The app still clears local data and opens Landing; the toast reads "You've been signed out." (the server session expires by itself in 15 minutes). |
| Inactivity | After 5 minutes idle on mobile (10 on web) the dialog "Still there?" shows for 30 seconds, buttons "Stay signed in" and "Sign out". No answer → signed out, toast "You were signed out for your security." |

### Shell: Linked banks list

| Item | Detail |
|---|---|
| Purpose | Show the outside accounts BankWorkx® can read, and let the person add or remove them. |
| Route | Web `/personal/more/settings/linked-banks`; mobile `LinkedBanks`. |
| Data source | `bank.accounts.linked` (planned list adapter; today the linked banks are in `finance.linked` returned inside the finance view-model). Item: `{ id, bank, kind, maskedNumber, balance, connectedAt, lastRefreshed }`. Remove: `bank.accounts.disconnect {connectedId}` (planned; codes `LINK_NOT_FOUND`, `TIMEOUT`, `SERVICE_UNAVAILABLE`; not money moving). |
| Columns | Bank (logo colour dot and name); Kind (Savings, Credit); Number (`••9876`); Balance (`$9,876.54`; for credit, "Owed $1,240.50"); Connected (`12 Nov 2026`); Last refreshed (relative). |
| Widgets | Summary strip: "{n} linked accounts, total ${sum}". Button "Connect an account". Each row has "Refresh" and "Remove" in a menu. |
| Sort | Connected date, newest first. |
| Empty | "You haven't connected another bank yet. Connect one to see all your money in one place." Button "Connect an account". |
| Loading | 3 row skeletons. |
| Error | "We couldn't load your linked banks. Nothing was changed." Button "Try again". |
| Remove | Dialog: title "Remove {bank}?", body "BankWorkx® will stop reading this account. Nothing changes at {bank}." Buttons "Remove" and "Keep". Then toast "{bank} removed." |
| Seed | Alex has Summit Federal ••9876, Savings, $9,876.54. Sam has none. |
| Launch points | Linked banks › "Connect an account" → `connect-account` (permission `accounts.manage`). |

---

### ★ Update profile — `update-profile`

**Catalog:** slug `update-profile` (name in the prototype "Contact details"), workspace `personal`, category More (Personal: More), core no, can a bank switch it off: yes (basic entry, kept in the Lean preset). Options (key, label, default): `verifyNewMobile` "Send a code to the new mobile number too" (on); `verifyEmail` "Confirm a new email by link before it applies" (on); `verifyAddress` "Check an address change before it applies" (on); `requireProof` "Ask for proof of address" (**off**). Research: `research/update-profile.md`. Built in `design/bankworkx-r1/src/journeys/56-profile-messages.js` (objects `UP`, `UP_MK`), using the code step `SEC.codeStep` from `55-security.js`.

The lean rework removed name changes, the tax and nationality fields, the marketing preferences and the list of previous addresses. What remains: change the mobile number, the email or the address, each with a one-time code, and some with a check before they apply. Name and ID document changes are done at a branch.

**Home market configuration.** The formats of the mobile number and the postal code follow the bank's home market. No screen names a country. Sample values are the prototype's test fill.

| Market | Mobile number: hint, rule, message | Postal code: rule, message | State field | Sample address |
|---|---|---|---|---|
| Market A (routing number and account) | "10 digits"; exactly 10 digits; "Enter 10 digits." | 5 digits, optionally a dash and 4 digits; "Enter a 5-digit postal code." | Yes, required, label "State" | 12 Example Street, Springfield, IL, 62704 |
| Market B (sort code and account) | "11 digits"; 10 or 11 digits starting 7 or 07; "Enter 10 or 11 digits starting 7 or 07." | Letters and digits in the local pattern; "Check the postal code." | No | 12 Example Road, London, SW1A 1AA |
| Market C (IBAN) | "With country code"; 8 to 14 digits, optional leading +; "Enter 8 to 14 digits, with the country code." | 4 or 5 digits; "Enter 4 or 5 digits." | No | Beispielstrasse 5, Berlin, 10115 |
| Market D (IBAN, mobile alias) | "05XXXXXXXX"; a mobile number such as 0501234567; "Enter a mobile number, like 0501234567." | No postal code field | No | Example Tower, Flat 1204, Dubai |

Spaces and dashes are ignored when the mobile number is checked.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `update-profile` |
| Purpose | Change the mobile number, the email or the address held by the bank. Each change needs a code; some are checked before they apply. |
| Release / workspace | 1 / Personal |
| Status | Built in the prototype as a form journey with a branch per item (`submit: "Save"`, permission `accounts.view`). A change that waits is kept as "pending" in the profile; the prototype has no way to complete or cancel it (planned). |
| Channels | Web and mobile |
| Starting pattern | None in the fixtures; the one-time code reuses `bank.otp.send` and `bank.otp.verify` |
| Who may use it | Anyone signed in to Personal (`accounts.view`), for their own profile. |

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| More › Profile | none | `accounts.view` |
| Deep link `/personal/j/update-profile?what=email` | `{what}` (`mobile`, `email`, `address`) | `accounts.view` |

#### 3. Screens

Steps in order: `what`, then `mobile`, `email` or `address`, then `code`, then `code2` (mobile with `verifyNewMobile`), then the result.

**Screen `what`** ("Contact details"). Text "To change your name or ID document, visit a branch." Button **Continue**.

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| (no label) | `cards`: "Mobile number" (masked, for example "•••• 0142"), "Email" (masked, for example "a•••@example.com"), "Address" (the whole address). A card with a change waiting has an amber chip "Pending" (for email "Pending {masked new email}") | Yes | One of the cards; not one with a change already waiting | "This is required." and "A change to this is already waiting to be confirmed." |

**Screen `mobile`** ("New mobile number").

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| Mobile number | `tel`, placeholder from the market table, max 16 | Yes | The market rule; not the current number (last 9 digits compared) | The market message, and "That is already your number." |

**Screen `email`** ("New email").

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| Email | `email`, placeholder "name@example.com", max 80 | Yes | `name@host.tld` shape; not the current email (ignoring capitals) | "Enter an email like name@example.com." and "That is already your email." |

**Screen `address`** ("New address").

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| Address line 1 | `text`, max 60 | Yes | Not empty | "This is required." |
| Address line 2 (optional) | `text`, max 60 | No | none | none |
| City | `text`, max 40 (half width) | Yes | Not empty | "This is required." |
| State | `text`, max 30 (half width). Market A only | Yes | Not empty | "This is required." |
| Postal code | `text`, max 10. Not shown in Market D | Yes | The market rule | The market message |
| Proof of address | `file`, "Add a recent bill or statement". Only with `requireProof` | Yes | One file, PDF, JPG or PNG | "Use a PDF, JPG or PNG." |

The step is blocked when nothing differs from the address on file: "That is already your address."

**Screen `code`** ("Enter your code"). Text "Sent to the phone ending 0142." (the code goes to the number on file, not the new one). Button **Confirm**, busy "Checking your code…" (about 0.6 seconds).

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| Code | `text`, placeholder "6 digits", max 6, hint "{n} tries left" | Yes | Exactly 6 digits | "Enter the 6 digits." |

A wrong code: "That code isn’t right. Try again." An expired code: "That code has expired. Go back to get a new one." Three wrong codes: "Too many wrong codes. Nothing was changed. Go back to start again."

**Screen `code2`** ("Confirm your new number"). Only for a mobile change with `verifyNewMobile`. Text "Sent to the new number." Button **Save**, busy "Checking your code…" (about 0.6 seconds). Field Code as above, with its own 3 tries and the same messages.

**Result.** What the bank does depends on the item and the options:

| Item | Applies at once when | Waits when | Title when waiting | Text when waiting |
|---|---|---|---|---|
| Mobile number | always | never | none | none |
| Email | `verifyEmail` is off | `verifyEmail` is on | "Change received" | "Check your inbox and confirm the new address." |
| Address | `verifyAddress` is off | `verifyAddress` is on | "Change received" | "We’ll check it and tell you." |

When it applies: title "{Mobile number, Email or Address} updated" (green), rows "{item}" (masked value, or the whole address) and "Status" "Updated"; a mobile change adds "Old number" "Told by message". When it waits: chip "Pending" (amber), rows "{item}" and "Status" "Pending". Buttons **Back to more**, **Done**. A note "{item} updated" or "{item} change received" is added to the notification list. A change to an item that already has one waiting is refused: "A change to this is already waiting to be confirmed."

**States**
- Loading: busy text on the code buttons as above.
- Empty: not applicable.
- Error: the Service down switch shows the standard connection sheet ("We couldn’t reach the bank", "Nothing was sent and you haven’t been charged. Try again in a moment."); otherwise "This isn’t available right now. Nothing was changed. Try again in a few minutes." with **Try again**.
- Timeout: "This is taking longer than expected. Nothing was changed."

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `ALREADY_PENDING` | "A change to this is already waiting to be confirmed." | `what`, result | Back |
| `OTP_INVALID` | "That code isn’t right. Try again." | `code`, `code2` | Try again |
| `OTP_EXPIRED` | "That code has expired. Go back to get a new one." | `code` | Back |
| `OTP_LOCKED` | "Too many wrong codes. Nothing was changed. Go back to start again." | `code`, `code2` | Back to start |
| `FILE_TYPE` (planned) | "Use a PDF, JPG or PNG." | `address` | Remove the file |
| `CONTACT_IN_USE` (planned) | "We can’t use that number or email. Try another." | `mobile`, `email` | Back |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | `code`, `code2` | Try again |
| `SERVICE_UNAVAILABLE` | "This isn’t available right now. Nothing was changed. Try again in a few minutes." | `code`, `code2` | Try again |
| `JOURNEY_DISABLED` | "This isn’t available at your bank." | whole journey | none |
| `PERMISSION_DENIED` (planned) | Standard message | whole journey | Back |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `profile` | `bank.profile.get` | none | mobile, email, address, pending changes | `SERVICE_UNAVAILABLE` | (planned). The prototype reads `UP.prof()` |
| `sendOtp` / `verifyOtp` | `bank.otp.send` / `bank.otp.verify` | `{channel}` / `{code}` | `{sent}` / `{verified}` | `OTP_INVALID`, `OTP_EXPIRED`, `OTP_LOCKED` | Existing (`packages/mock-bank-api/src/index.ts`) |
| `verifyNewMobile` | `bank.profile.verifyContact` | `{channel, value, code}` | `{verified}` | `OTP_INVALID`, `OTP_LOCKED` | (planned) |
| `updateProfile` | `bank.profile.update` | `{field, value}` or `{field: "address", address, proof?}` | `{reference, status: "updated" or "pending"}` | `ALREADY_PENDING`, `CONTACT_IN_USE`, `OTP_REQUIRED`, `SERVICE_UNAVAILABLE`, `TIMEOUT` | (planned) |

#### 6. Permissions, step-up and limits

`accounts.view`. Step-up: a one-time code (6 digits, 3 tries) for every change, plus a code to the new number for a mobile change with `verifyNewMobile`. Limits: one waiting change per item; address lines 60 characters.

#### 7. Result and links out

Result as above. Notifications raised (planned): a text to the old mobile number ("Your mobile number was changed"), an email to the old email address, and a message to the new contact; a pending change raises a reminder after 3 days. Every change is written to the profile log (audit). Links out: More (profile), `new-message` (to ask about a pending change).

#### 8. Acceptance criteria

- AC-1: The first screen offers Mobile number, Email and Address with the current values masked and a "Pending" chip where a change waits; a pending item cannot be chosen.
- AC-2: The mobile number follows the market rule and cannot be the current number; the email follows the shape and cannot be the current one; the address must differ and follow the market rules.
- AC-3: Every change asks for a one-time code sent to the number on file; three wrong codes end the attempt with nothing changed.
- AC-4: With `verifyNewMobile` on, a second code goes to the new number and the change saves only after it.
- AC-5: A mobile change applies at once; an email waits with `verifyEmail` on; an address waits with `verifyAddress` on; waiting changes show "Change received" and a Pending chip.
- AC-6: With `requireProof` on, an address change needs a PDF, JPG or PNG; otherwise the field is absent.
- AC-7: The result shows what changed (masked) and its status.
- AC-8: When the bank is unavailable or times out nothing is changed.

#### 9. Scenarios

Synthetic persona `alex` (Market A unless stated, code is the fixed test code).

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-2 | `alex` | none | The cards show "•••• 0142", "a•••@example.com" and "12 Example Street, Springfield, IL, 62704". |
| T-2 | AC-2 | `alex` | none | Mobile "123": "Enter 10 digits." The current number: "That is already your number." Email "alex": "Enter an email like name@example.com." The current email: "That is already your email." Postal code "12": "Enter a 5-digit postal code." Unchanged address: "That is already your address." |
| T-3 | AC-3 | `alex` | none | Code 000000: "That code isn’t right. Try again." and "2 tries left"; three times: "Too many wrong codes. Nothing was changed. Go back to start again." Code 999999: "That code has expired. Go back to get a new one." |
| T-4 | AC-4, AC-5 | `alex`, `verifyNewMobile` on | none | New mobile 5550100177, code, then "Sent to the new number." code: title "Mobile number updated", rows Mobile number "•••• 0177", Status "Updated", Old number "Told by message". |
| T-5 | AC-5 | `alex`, `verifyEmail` on | none | New email: "Change received", "Check your inbox and confirm the new address.", chip Pending. Back at the first screen the Email card shows "Pending a•••@example.com" and cannot be chosen: "A change to this is already waiting to be confirmed." |
| T-6 | AC-5 | `alex`, `verifyAddress` off | none | New address saves at once: "Address updated", Status "Updated". |
| T-7 | AC-6 | `alex`, `requireProof` on | none | The Proof of address field shows; "photo.heic" gives "Use a PDF, JPG or PNG."; "utility-bill.pdf" is accepted. With the option off the field is absent. |
| T-8 | AC-2 | `alex`, Market B and Market D | none | Market B mobile "5550100177": "Enter 10 or 11 digits starting 7 or 07." Market D has no Postal code field and no State field. |
| T-9 | AC-8 | `alex` | `unavailable: ["bank.profile.update"]` (prototype: Service down on) | Connection sheet; nothing is changed. |
| T-10 | AC-8 | `alex` | `timeout: ["bank.profile.update"]`, `latencyMs: 10000` | After 10 seconds: "This is taking longer than expected. Nothing was changed." |

#### 10. Expected mutation-check survivors

The postal-code patterns for Markets B and C survive when only Market A is asserted; expected. The text notification to the old number is not asserted; expected. The pending state never completes in the prototype, so the "confirmed" outcome is untested; expected until the confirmation link is built. Everything else: none expected.

---

### ★ New message — `new-message`

**Catalog:** slug `new-message`, workspace `personal`, category More (Personal: More), core no, can a bank switch it off: yes (basic entry, kept in the Lean preset). Options (key, label, default): `allowFile` "Allow one attachment" (on). Research: `research/new-message.md`. Built in `design/bankworkx-r1/src/journeys/56-profile-messages.js` (object `MSG`, shared with the view `messages`).

The lean rework removed message categories with different response times, urgent flags and several attachments. What remains: a topic, a subject, a message and one optional file, sent to the bank. The reply arrives in `messages`.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `new-message` |
| Purpose | Send a secure message to the bank with a topic, a subject and an optional file. |
| Release / workspace | 1 / Personal |
| Status | Built in the prototype as a one-screen form journey (`submit: "Send"`, permission `accounts.view`). A new conversation is added to the top of the inbox. No money moves. |
| Channels | Web and mobile |
| Starting pattern | None in the fixtures |
| Who may use it | Anyone signed in to Personal (`accounts.view`). |

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| `messages` › **New message** (header and empty state) | none | `accounts.view` |
| Login history › This wasn’t me | `{topic: "Fraud or security"}` | `accounts.view` |
| `contact-support` › Message › **Send us a message** (option `secureMessages`, signed in) | none | `accounts.view` |
| Deep link `/personal/j/new-message?topic=Cards&subject=Lost%20card` | `{topic, subject}` | `accounts.view` |

#### 3. Screens

One screen, then a result.

**Screen `write`** ("New message"). Button **Send**, busy "Sending…" (about 0.7 seconds).

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| Topic | `select`, placeholder "Choose a topic": Account, Cards, Payments, Fraud or security, Feedback, Something else | Yes | One of the list | "This is required." |
| (warning, inline) | `note`, shown when the topic is "Fraud or security": "If someone has used your account, call us now. Messages are read within one business day." | n/a | none | none |
| Subject | `text`, placeholder "What is it about?", max 80 | Yes | At least 3 characters | "Use at least 3 characters." |
| Message | `textarea`, placeholder "Write your message", max 1000, hint "Don’t include passwords, codes or full card numbers." | Yes | At least 10 characters | "Write at least 10 characters." |
| Attachment (optional) | `file`, "Add a PDF, JPG or PNG". Only with `allowFile`. One file | No | PDF, JPG or PNG; at most 5 MB | "That file is over 5 MB." and the step is blocked with "Remove the file that can’t be sent." |

**Result** ("Message sent", green, text "We usually reply within 1 business day."). Rows "Topic" and "Subject". Buttons **Go to messages** (opens `messages`) and **Done**. The new conversation is at the top of the inbox, marked read, with the message and, if one was added, a chip with the file name.

**States**
- Loading: busy text on the button.
- Empty: not applicable.
- Error: "We couldn’t send it. Nothing was sent. Try again in a few minutes." with **Try again**. The Service down switch shows the standard connection sheet ("We couldn’t reach the bank", "Nothing was sent and you haven’t been charged. Try again in a moment."). The text stays in the form.
- Timeout: "This is taking longer than expected. Nothing was sent."

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `FILE_TOO_LARGE` | "That file is over 5 MB." | `write` | Remove the file |
| `FILE_TYPE` (planned) | "Use a PDF, JPG or PNG." | `write` | Remove the file |
| `TIMEOUT` | "This is taking longer than expected. Nothing was sent." | `write` | Try again |
| `SERVICE_UNAVAILABLE` | "We couldn’t send it. Nothing was sent. Try again in a few minutes." | `write` | Try again |
| `RATE_LIMITED` (planned) | "You’ve sent a lot of messages. Try again later." | `write` | Back |
| `JOURNEY_DISABLED` | "This isn’t available at your bank." | whole journey | none |
| `PERMISSION_DENIED` (planned) | Standard message | whole journey | Back |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `sendMessage` | `bank.messages.send` | `{topic, subject, text, file?}` | `{threadId, reference}` | `FILE_TOO_LARGE`, `FILE_TYPE`, `RATE_LIMITED`, `SERVICE_UNAVAILABLE`, `TIMEOUT` | (planned). The prototype adds the conversation to `MSG.threads` |
| `uploadFile` | `bank.files.upload` | file | `{fileId}` | `FILE_TOO_LARGE`, `FILE_TYPE` | (planned) |

#### 6. Permissions, step-up and limits

`accounts.view`. No step-up: the person is signed in and no money moves. Limits: subject 80 characters; message 1000 characters; one file up to 5 MB; an abuse limit on messages per day (planned).

#### 7. Result and links out

Result as above. Notifications raised (planned): to the person, "You have a new message from BankWorkx®" when the bank replies. The message is visible to the bank's support team with the person's name and profile. Links out: `messages`.

#### 8. Acceptance criteria

- AC-1: Topic, subject (3 or more characters) and message (10 or more characters) are required before **Send** works.
- AC-2: Choosing "Fraud or security" shows the warning to call now.
- AC-3: With `allowFile` on one PDF, JPG or PNG up to 5 MB can be added; a larger file blocks sending with the message; with the option off the field is absent.
- AC-4: After sending, the result shows the topic and the subject and the conversation is at the top of the inbox.
- AC-5: A launch value `topic` or `subject` is prefilled.
- AC-6: When the bank is unavailable or times out nothing is sent and the text is kept.

#### 9. Scenarios

Synthetic persona `alex`.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-4 | `alex` | none | Subject "Question about my account", message "Please can you check a payment on my account.": result "Message sent", rows Topic and Subject; **Go to messages** shows the new conversation first. |
| T-2 | AC-1 | `alex` | none | Subject "ab": "Use at least 3 characters." Message "short": "Write at least 10 characters." |
| T-3 | AC-2 | `alex`, `topic: "Fraud or security"` | none | The warning shows and the topic is already chosen. |
| T-4 | AC-3 | `alex` | none | "receipt.pdf" is accepted and appears as a chip in the conversation; "scan.pdf" (8 MB): "That file is over 5 MB." and "Remove the file that can’t be sent." |
| T-5 | AC-3 | `alex`, `allowFile` off | none | No attachment field. |
| T-6 | AC-6 | `alex` | `unavailable: ["bank.messages.send"]` (prototype: Service down on) | Connection sheet; nothing sent; the form keeps the text. |
| T-7 | AC-6 | `alex` | `timeout: ["bank.messages.send"]`, `latencyMs: 10000` | After 10 seconds: "This is taking longer than expected. Nothing was sent." |

#### 10. Expected mutation-check survivors

The "usually reply within 1 business day" text is fixed copy; expected. The abuse limit cannot be produced by the sandbox yet; expected. Everything else: none expected.

---

### ★ Messages — `messages`

**Catalog:** slug `messages`, workspace `personal`, category More (Personal: More), core no, can a bank switch it off: yes (basic entry, kept in the Lean preset; switching it off also hides **New message** and the Messages row in More). This is a **VIEW** (a screen in the More tab, `view: true`, `tab: 'more'`), not a form journey. Options: none. Research: `research/new-message.md`. Built in `design/bankworkx-r1/src/journeys/56-profile-messages.js` (object `MSG`). It replaces the older description "Shell: Secure messages inbox and thread" in the More section.

The lean rework removed folders, search, archive, delete and attachments in replies. What remains: an inbox with unread dots, a thread, a reply box, and a button to start a new conversation.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `messages` |
| Purpose | Read and answer the secure messages between the customer and the bank. |
| Release / workspace | 1 / Personal |
| Status | Built in the prototype as a view in the More tab with an inbox and a thread. Sending a reply is simulated in the screen. No money moves. |
| Channels | Web and mobile |
| Starting pattern | None in the fixtures |
| Who may use it | Anyone signed in to Personal (`accounts.view`), for their own conversations. |

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| More › Messages | none | `accounts.view` |
| Home › Notifications › a message notification | `{threadId}` (planned) | `accounts.view` |
| `new-message` result › **Go to messages** | none | `accounts.view` |
| Deep link `/personal/more/messages` | none | `accounts.view` |

#### 3. Screens

Route: web `/personal/more/messages`; mobile More tab, row Messages. Data source: the conversations of the signed-in profile (`MSG.threads` in the prototype; `bank.messages.list`, planned).

**Inbox.** Header: title "Messages" and the button **New message** (opens `new-message`). Then one card with a row per conversation, in the order they are stored (a new conversation goes to the top; the product sorts by the latest message, newest first, planned). Each row:

- A dot on the left: accent colour when the conversation has an unread bank message, empty otherwise (spoken as "Unread").
- The subject in bold, and the first 70 characters of the latest message (with "…" if longer).
- On the right, the date of the latest message, for example "2 Nov".

Tapping a row opens the thread and marks it read.

| Conversation (sandbox) | Topic | Last message | State |
|---|---|---|---|
| Your new card is on its way | Cards | BankWorkx®, Mon 2 Nov, 10:12: "Your replacement debit card has been sent. It should arrive in 3 to 5 working days. Activate it in the app when it arrives." | Unread |
| Question about a monthly fee | Account | Sara, BankWorkx®, Fri 30 Oct, 09:48 (after the person's question on Thu 29 Oct, 14:30) | Read |

**Empty.** Icon, "No messages", "Send us a message and we’ll reply here." and the button **New message**.

**Thread.** A back button **‹ Messages**; the subject as the title; the topic in small type; then the messages oldest first. Each message is a card with "{who} · {time}" (the person is "You"; the bank is "BankWorkx®" or a first name and "BankWorkx®"), the text (line breaks kept), and a chip with the file name if one was attached. Bank messages sit at the start side, the person's at the other side. Below, a field "Reply" (`textarea`, 3 rows, max 1000) and the button **Send**.

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| Reply | `textarea`, max 1000 | Yes | At least 2 characters after trimming | "Write a message first." |

A sent reply is added to the thread, the field is cleared, and a toast "Message sent" shows. If the bank is unavailable: "We couldn’t send it. Try again in a few minutes." and the text stays in the field. A reply cannot carry a file (planned).

**States**
- Loading: skeleton of four rows (planned; the prototype draws at once).
- Empty: as above.
- Error (list cannot load): "We couldn’t load your messages. Nothing was changed." with **Try again** (planned).
- Timeout: after 10 seconds on a reply, "This is taking longer than expected. Nothing was sent." (planned for the view).

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `SERVICE_UNAVAILABLE` | "We couldn’t send it. Try again in a few minutes." | thread | Send |
| `TIMEOUT` (planned) | "This is taking longer than expected. Nothing was sent." | thread | Try again |
| `THREAD_CLOSED` (planned) | "This conversation is closed. Start a new message." | thread | New message |
| `JOURNEY_DISABLED` | "This isn’t available at your bank." | whole view | none |
| `PERMISSION_DENIED` (planned) | Standard message | whole view | Back |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `threads` | `bank.messages.list` | none | list of conversations with messages | `SERVICE_UNAVAILABLE` | (planned). The prototype reads `MSG.threads` |
| `markRead` | `bank.messages.markRead` | `{threadId}` | `{ok}` | `SERVICE_UNAVAILABLE` | (planned) |
| `reply` | `bank.messages.reply` | `{threadId, text}` | `{messageId}` | `THREAD_CLOSED`, `SERVICE_UNAVAILABLE`, `TIMEOUT` | (planned) |

#### 6. Permissions, step-up and limits

`accounts.view`. No step-up. Limits: reply 1000 characters. An unread count (the number of conversations with an unread bank message) feeds the badge on the Messages row in More and the More tab (planned; the prototype computes `MSG.unread()` but does not show it).

#### 7. Result and links out

No receipt. A sent reply raises a toast. Notifications (planned): "You have a new message from BankWorkx®" when the bank writes. Links out: `new-message`; the thread has no other links. Reached from `new-message`, `contact-support` (signed in) and the login history "This wasn’t me" action via `new-message`.

#### 8. Acceptance criteria

- AC-1: The inbox lists each conversation with its subject, a preview of the latest message, its date and an unread dot where a bank message is unread.
- AC-2: Opening a conversation shows every message in order and clears its unread dot.
- AC-3: A reply of at least 2 characters is added to the thread and the field is cleared; shorter text shows "Write a message first."
- AC-4: With no conversations the empty state offers **New message**.
- AC-5: **New message** opens `new-message`; a message sent there appears at the top of the inbox.
- AC-6: When the bank is unavailable a reply is not added and the text stays.

#### 9. Scenarios

Synthetic persona `alex`, the two sandbox conversations.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1 | `alex` | none | Two rows; the first has the dot and the preview "Your replacement debit card has been sent. It should arrive in 3 to 5 …". |
| T-2 | AC-2 | `alex` | none | Open the first: one message from "BankWorkx®"; back at the inbox the dot is gone. Open the second: two messages in order, the bank reply from "Sara, BankWorkx®". |
| T-3 | AC-3 | `alex` | none | Reply "Thanks": added as "You", toast "Message sent". Reply "a": "Write a message first." |
| T-4 | AC-4 | `alex`, no conversations | `empty: ["bank.messages.list"]` | "No messages", "Send us a message and we’ll reply here." and **New message**. |
| T-5 | AC-5 | `alex` | none | **New message**, send; **Go to messages**: the new conversation is first. |
| T-6 | AC-6 | `alex` | `unavailable: ["bank.messages.reply"]` (prototype: Service down on) | "We couldn’t send it. Try again in a few minutes."; the thread is unchanged. |
| T-7 | AC-6 | `alex` | `timeout: ["bank.messages.reply"]`, `latencyMs: 10000` | After 10 seconds: "This is taking longer than expected. Nothing was sent." (planned for the view). |

#### 10. Expected mutation-check survivors

The preview length (70 characters) survives a small change; expected. The unread count is not shown in the prototype, so it is not asserted; expected. The sort order survives while only one new conversation exists; expected. Everything else: none expected.

---

### ★ Service request — `service-request`

**Catalog:** slug `service-request`, workspace `personal`, category More (Personal: More), core no, can a bank switch it off: yes (basic entry, kept in the Lean preset). Options (key, label, default): `cheque` "Offer cheque book orders" (on); `letter` "Offer letters" (on); `acctype` "Offer account type changes" (on). Research: `research/service-request.md`. Built in `design/bankworkx-r1/src/journeys/57-requests-connect.js` (object `SREQ`, shared with the view `my-requests`).

The lean rework removed the fee preview, the appointment booking and the long list of request types. What remains: five kinds of request (cheque book, letter, lost card, account type, other), each with a few fields, and a reference. Status tracking is in `my-requests`.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `service-request` |
| Purpose | Order a cheque book, ask for a letter, change an account type, or send another request, and get a reference. A lost or stolen card is sent to the card controls instead. |
| Release / workspace | 1 / Personal |
| Status | Built in the prototype as a form journey with a branch per kind (`submit: "Submit request"`, permission `accounts.view`). The new request is added to `my-requests` with the status Received. No money moves. |
| Channels | Web and mobile |
| Starting pattern | None in the fixtures |
| Who may use it | Anyone signed in to Personal (`accounts.view`), for their own accounts. |

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| More › Service requests › **New request** (in `my-requests`) | none | `accounts.view` |
| Accounts › account › More | `{type}` (for example `letter`) | `accounts.view` |
| Deep link `/personal/j/service-request?type=cheque` | `{type}` (`cheque`, `letter`, `lost`, `acctype`, `other`) | `accounts.view` |

With `type` passed the kind is preselected on the first screen.

#### 3. Screens

Steps in order: `type`, then one of `lost`, `cheque`, `letter`, `acctype` or `other`, then the result.

**Screen `type`** ("New request"). Button **Continue**.

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| (no label) | `cards`: Order cheque book, Request a letter, Report a lost card, Change account type, Other (the first, second and fourth only with their options on) | Yes | One of the cards | "This is required." |

**Screen `lost`** ("Lost or stolen card"). No form. If the bank has a card journey that can freeze a card (`report-lost-card`, `block-card`, or `card-controls`, the first one that is on), the screen says "Freeze your card now, then order a new one." with the button **Go to my cards** (opens `card-controls` with `{mode: "freeze"}`). If none is on it says "Call us now so we can stop your card." The step cannot be continued ("Use your card options"): no request is created.

**Screen `cheque`** ("Order cheque book").

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| Account | `select`: each account as "{name} ••{last4}" | Yes | One of the list | "This is required." |
| Leaves | `chips`: 25, 50. Default 25 | No | One of two | none |
| Delivery | `chips`: "Post to my address", "Collect at a branch". Default post | No | One of two | none |
| Branch | `select`: Main Street, Riverside, Station Road. Only when collecting | Yes | One of the list | "This is required." |

**Screen `letter`** ("Request a letter").

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| Which letter? | `select`: Account confirmation, Proof of address, Balance confirmation, Interest certificate | Yes | One of the list | "This is required." |
| Account | `select` as above | Yes | One of the list | "This is required." |
| Delivery | `chips`: Email, Post, "Collect at a branch". Default Post | No | One of three | none |
| Branch | `select` as above. Only when collecting | Yes | One of the list | "This is required." |
| Addressed to (optional) | `text`, max 60 | No | none | none |

**Screen `acctype`** ("Change account type").

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| Account | `select` as above | Yes | One of the list | "This is required." |
| Change to | `select`: Everyday, Savings, Premium, without the type the account already has | Yes | One of the list | "This is required." |
| Reason (optional) | `textarea`, max 300 | No | none | none |

Text under the fields: "Fees and limits can change. We’ll confirm before we switch it."

**Screen `other`** ("Other request").

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| Subject | `text`, max 80 | Yes | At least 3 characters | "Use at least 3 characters." |
| Details | `textarea`, max 500 | Yes | At least 10 characters | "Write at least 10 characters." |

The last screen shows the button **Submit request**, busy "Sending your request…" (about 0.7 seconds).

**Result** ("Request sent", green, text "We’ll update the status under My requests."). Chip Received, a reference starting SR-. Rows: "Request" (the kind) and then:

| Kind | Rows |
|---|---|
| Cheque book | Account, Leaves, Delivery ("Post to your address" or "Collect at {branch}") |
| Letter | Letter, Account, Delivery ("Email", "Post" or "Collect at {branch}"), Addressed to (if given) |
| Account type | Account, Change to |
| Other | Subject |

Buttons **My requests** (opens `my-requests`) and **Done**. The request is added to `my-requests` dated "3 Nov 2026" with the status Received.

A second cheque book for an account that already has an open one (status not Done or Cancelled) is refused: "You already have this request open."

**States**
- Loading: busy text on the button.
- Empty: not applicable.
- Error: "We couldn’t send it. Nothing was sent. Try again in a few minutes." with **Try again**. The Service down switch shows the standard connection sheet ("We couldn’t reach the bank", "Nothing was sent and you haven’t been charged. Try again in a moment.").
- Timeout: "This is taking longer than expected. Nothing was sent."

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `DUPLICATE` | "You already have this request open." | `cheque` | My requests |
| `TIMEOUT` | "This is taking longer than expected. Nothing was sent." | last screen | Try again |
| `SERVICE_UNAVAILABLE` | "We couldn’t send it. Nothing was sent. Try again in a few minutes." | last screen | Try again |
| `ACCOUNT_NOT_FOUND` (planned) | "We can’t find that account. Choose another." | form | Choose account |
| `JOURNEY_DISABLED` | "This isn’t available at your bank." | whole journey | none |
| `PERMISSION_DENIED` (planned) | Standard message | whole journey | Back |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `accounts` | `bank.accounts.list` | none | map of accounts | none | Existing (`packages/mock-bank-api/src/index.ts`) |
| `createRequest` | `bank.requests.create` | `{type, accountId?, details}` | `{reference, status: "Received"}` | `DUPLICATE`, `ACCOUNT_NOT_FOUND`, `SERVICE_UNAVAILABLE`, `TIMEOUT` | (planned). The prototype adds to `SREQ.list` |

#### 6. Permissions, step-up and limits

`accounts.view`. No step-up: the request moves no money and changes nothing until the bank confirms. Limits: one open cheque book request per account; reason 300 characters; details 500 characters.

#### 7. Result and links out

Result as above. Notifications raised (planned): when the status changes, "Your request {reference} is {status}". Links out: `my-requests`, `card-controls` (lost card).

#### 8. Acceptance criteria

- AC-1: The first screen offers only the kinds that are on; a launch value `type` preselects one.
- AC-2: A lost card creates no request and leads to the card controls (or tells the person to call).
- AC-3: Each kind asks for its fields with the validation above; the branch field appears only when collecting.
- AC-4: "Change to" never offers the account's current type.
- AC-5: A sent request returns a reference, the chip Received and rows that repeat what was asked, and appears in `my-requests`.
- AC-6: A second open cheque book request for the same account is refused with "You already have this request open."
- AC-7: When the bank is unavailable or times out nothing is sent and nothing is added to `my-requests`.

#### 9. Scenarios

Synthetic persona `alex`, accounts Current ••4410 and Savings ••7720 as in the other Personal journeys, and the two sandbox requests of `my-requests`.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1 | `alex`, `cheque` off | none | The cards are Request a letter, Report a lost card, Change account type, Other. |
| T-2 | AC-2 | `alex` | none | "Report a lost card": "Freeze your card now, then order a new one." **Go to my cards** opens `card-controls` in freeze mode; **Continue** is blocked. |
| T-3 | AC-3, AC-5 | `alex`, Savings ••7720 | none | Cheque book, 50 leaves, "Collect at a branch" with "Riverside": result "Request sent", chip Received, rows Request "Order cheque book", Account "Savings ••7720", Leaves "50", Delivery "Collect at Riverside". |
| T-4 | AC-3 | `alex` | none | Letter "Proof of address", Current ••4410, Email, addressed to "Landlord": rows Letter, Account, Delivery "Email", Addressed to "Landlord". |
| T-5 | AC-4 | `alex`, account on the Everyday product | none | "Change to" offers Savings and Premium only. |
| T-6 | AC-3 | `alex` | none | Other: subject "ab" gives "Use at least 3 characters."; details "short" gives "Write at least 10 characters." |
| T-7 | AC-6 | `alex`, the open cheque book request on Current ••4410 | none | Ordering another for Current ••4410: "You already have this request open." |
| T-8 | AC-7 | `alex` | `unavailable: ["bank.requests.create"]` (prototype: Service down on) | Connection sheet; nothing added to `my-requests`. |
| T-9 | AC-7 | `alex` | `timeout: ["bank.requests.create"]`, `latencyMs: 10000` | After 10 seconds: "This is taking longer than expected. Nothing was sent." |

#### 10. Expected mutation-check survivors

The list of branches and letter kinds is fixed sample data; a mutation that removes one entry survives; expected. The duplicate rule survives when only the account name is compared; expected. Everything else: none expected.

---

### ★ My requests — `my-requests`

**Catalog:** slug `my-requests`, workspace `personal`, category More (Personal: More), core no, can a bank switch it off: yes (basic entry, kept in the Lean preset; switching it off also hides the Service requests row in More). This is a **VIEW** (a screen in the More tab, `view: true`, `tab: 'more'`), not a form journey. Options: none. Research: `research/service-request.md`. Built in `design/bankworkx-r1/src/journeys/57-requests-connect.js` (object `SREQ`). It replaces the older description "Shell: Service request tracker" in the More section.

The lean rework removed filters, search and the request timeline. What remains: a list of the requests the person has sent, a detail page, and a cancel while the request has only been received.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `my-requests` |
| Purpose | Show the service requests the customer has sent, with their status, and let them cancel a request that has not been started. |
| Release / workspace | 1 / Personal |
| Status | Built in the prototype as a view in the More tab with a list and a detail page. Status changes made by the bank are not simulated (the two sandbox requests have fixed statuses). No money moves. |
| Channels | Web and mobile |
| Starting pattern | None in the fixtures |
| Who may use it | Anyone signed in to Personal (`accounts.view`), for their own requests. |

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| More › Service requests | none | `accounts.view` |
| `service-request` result › **My requests** | none | `accounts.view` |
| Notification › Request update (planned) | `{requestId}` | `accounts.view` |
| Deep link `/personal/more/requests` | none | `accounts.view` |

#### 3. Screens

Route: web `/personal/more/requests`; mobile More tab, row Service requests. Data source: the person's requests (`SREQ.list` in the prototype; `bank.requests.list`, planned).

**List.** Header: title "My requests" and the button **New request** (opens `service-request`). Then one card with a row per request, newest first (the prototype puts a new request on top): an icon, the title in bold (the kind, for example "Order cheque book"), "{date} · {reference}", and a status chip on the right.

| Status | Chip colour | Meaning |
|---|---|---|
| Received | blue (information) | Sent, not started. The only status that can be cancelled |
| In progress | amber | The bank is working on it |
| Done | green | Finished |
| Cancelled | grey | Cancelled by the person |

| Request (sandbox) | Date | Status | Rows |
|---|---|---|---|
| SR-204118, Order cheque book | 28 Oct 2026 | In progress | Account "Current ••4410", Leaves "25", Delivery "Post to your address" |
| SR-203077, Request a letter | 12 Oct 2026 | Done | Letter "Proof of address", Account "Current ••4410", Delivery "Email" |

**Empty.** Icon, "No requests", "Requests you send will show here." and the button **New request**.

**Detail.** A back button **‹ My requests**; the title; the status chip; a card with the request's rows (as at sending) and two more rows, "Sent" (the date) and "Reference". For a request with the status Received a button **Cancel request** shows. It opens a confirmation card "Cancel this request?" with the buttons **Yes, cancel** and **Keep it**. After **Yes, cancel** the status becomes Cancelled, the button goes, and a toast "Request cancelled" shows. For any other status there is no cancel button.

**States**
- Loading: skeleton of three rows (planned; the prototype draws at once).
- Empty: as above.
- Error (list cannot load): "We couldn’t load your requests. Nothing was changed." with **Try again** (planned).
- Timeout: after 10 seconds, "This is taking longer than expected. Nothing was changed." with **Try again** (planned).
- Cancel when the bank has already started it (planned): "This request has already started, so it can’t be cancelled." and the status refreshes.

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `SERVICE_UNAVAILABLE` (planned) | "We couldn’t load your requests. Nothing was changed. Try again in a few minutes." | list | Try again |
| `ALREADY_STARTED` (planned) | "This request has already started, so it can’t be cancelled." | detail | Back |
| `TIMEOUT` (planned) | "This is taking longer than expected. Nothing was changed." | list, detail | Try again |
| `JOURNEY_DISABLED` | "This isn’t available at your bank." | whole view | none |
| `PERMISSION_DENIED` (planned) | Standard message | whole view | Back |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `requests` | `bank.requests.list` | none | list of `{id, reference, type, title, date, status, rows}` | `SERVICE_UNAVAILABLE` | (planned). The prototype reads `SREQ.list` |
| `cancelRequest` | `bank.requests.cancel` | `{requestId}` | `{status: "Cancelled"}` | `ALREADY_STARTED`, `SERVICE_UNAVAILABLE`, `TIMEOUT` | (planned) |

#### 6. Permissions, step-up and limits

`accounts.view`. No step-up. Only the owner sees a request. Only the status Received can be cancelled.

#### 7. Result and links out

The result of a cancel is the updated detail with a toast. Notifications (planned): "Your request {reference} is {status}" when the bank changes the status. Links out: `service-request`.

#### 8. Acceptance criteria

- AC-1: The list shows each request with its title, date, reference and a status chip, newest first.
- AC-2: A request opens a detail with its rows, the sent date and the reference.
- AC-3: Only a request with the status Received shows **Cancel request**; it asks to confirm and then becomes Cancelled.
- AC-4: **Keep it** leaves the request unchanged.
- AC-5: With no requests the empty state offers **New request**.
- AC-6: A request sent in `service-request` appears at the top with the status Received.

#### 9. Scenarios

Synthetic persona `alex`, the two sandbox requests.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1 | `alex` | none | Two rows: "Order cheque book" with "28 Oct 2026 · SR-204118" and the amber chip In progress; "Request a letter" with the green chip Done. |
| T-2 | AC-2 | `alex` | none | Open the first: rows Account, Leaves, Delivery, Sent "28 Oct 2026", Reference "SR-204118"; no cancel button. |
| T-3 | AC-3, AC-6 | `alex` | none | Send an "Other" request in `service-request`, open it from the list: status Received, **Cancel request** shows; **Yes, cancel**: chip Cancelled, toast "Request cancelled", no cancel button. |
| T-4 | AC-4 | `alex` | none | **Cancel request** then **Keep it**: status stays Received. |
| T-5 | AC-5 | `alex`, no requests | `empty: ["bank.requests.list"]` | "No requests", "Requests you send will show here." and **New request**. |
| T-6 | AC-1 | `alex` | `unavailable: ["bank.requests.list"]` | "We couldn’t load your requests. Nothing was changed. Try again in a few minutes." (planned). |
| T-7 | AC-1 | `alex` | `timeout: ["bank.requests.list"]`, `latencyMs: 10000` | After 10 seconds: "This is taking longer than expected. Nothing was changed." (planned). |

#### 10. Expected mutation-check survivors

The chip colours are presentation and are not asserted; expected. The "already started" outcome cannot be produced by the sandbox yet; expected. Everything else: none expected.

---

### ★ Connect account — `connect-account`

**Catalog:** slug `connect-account` (name in the prototype "Connect a bank"), workspace `personal`, category More in this spec (the prototype file tags it "Accounts"), core no, can a bank switch it off: yes (**not** a basic entry: it is off in the Lean preset). Options (key, label, default): `allowCards` "Allow credit card accounts" (on). Research: `research/connect-account.md`. Built in `design/bankworkx-r1/src/journeys/57-requests-connect.js` (object `CNX`). Connected accounts are added to the accounts list as read only (`ro: true`), so the Accounts screen lists them and no payment journey can use them.

The lean rework removed the old design where the person typed their other bank's username and password into BankWorkx®, and removed refresh schedules and per-account nicknames. What remains: choose the bank, agree to share, allow access on the other bank's own secure sign-in, choose accounts. Access is read only and expires.

**Home market configuration.** How long the sharing lasts, and the currency symbol, follow the bank's home market.

| Market | Sharing lasts | Symbol before an amount |
|---|---|---|
| Market A (routing number and account) | 365 days | `$` |
| Market B (sort code and account) | 90 days | `£` |
| Market C (IBAN) | 180 days | `€` |
| Market D (IBAN, mobile alias) | 365 days | `AED ` |

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `connect-account` |
| Purpose | See an account held at another bank in this app: choose the bank, agree to share, allow at the bank, choose the accounts. Read only. |
| Release / workspace | 1 / Personal |
| Status | Built in the prototype as a four-screen form journey (`submit: "Connect"`, permission `accounts.view`). The other bank's sign-in is simulated by a wait. No money moves; nothing can be paid from a connected account. |
| Channels | Web and mobile |
| Starting pattern | `bank.accounts.connect` and `bank.banks.list` in `packages/mock-bank-api/src/index.ts` (the older form that took a username and password) |
| Who may use it | Anyone signed in to Personal (`accounts.view`). |

**Banks (invented, sandbox).** Harbor Bank, Maple Credit Union, Northern Savings, Summit Bank, Lakeside Bank (always unavailable in the sandbox), Oakridge Building Society, Crown Trust, Bayview Bank. A bank that is already connected is left out of the list.

**Accounts per bank (sandbox).** The first bank in the list (Harbor Bank) has one account: Current. Every other bank has three: Current, Savings and Credit card (the card only with `allowCards`). Example: Harbor Bank Current ••1137 balance 2,410.45; Maple Credit Union Current ••1274 2,510.45, Savings ••5422 9,620.80, Credit card ••8186 −440.15 (shown with the market symbol).

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Accounts › **Connect a bank** | none | `accounts.view` |
| Home › **Connect a bank** (also the card "Add a bank you already use" for a customer with no account) | none | `accounts.view` |
| Deep link `/personal/j/connect-account?bank=maple` | `{bank}` (prefills the choice) | `accounts.view` |

#### 3. Screens

Steps in order: `bank`, `consent`, `signin`, `accounts`, then the result.

**Screen `bank`** ("Connect a bank"). Text "See your accounts from another bank here." Button **Continue**.

When a bank is already connected, a card "Connected" lists each one: the bank name, "{n} account(s) · until {date}" and a button **Disconnect**. **Disconnect** turns the row into "Disconnect {bank}?" with "Its accounts leave your list." and the buttons **Disconnect** and **Keep**. Confirming removes the bank, its accounts and their transactions from the app, and shows a toast "Bank disconnected".

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| Your bank | `select`, placeholder "Choose your bank" | Yes | One of the banks not yet connected | "This is required." |

**Screen `consent`** ("Share your accounts"). Button **Continue**.

- Card "{bank} will share with BankWorkx®" with three ticked rows: "Account names and last 4 digits", "Balances", "Transactions from the last 12 months".
- Card "Until {date}" with "You can stop sharing at any time from Accounts. We can only read. We can’t move money." The date is today plus the sharing period of the market.

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| I agree to share this information | `check` | Yes | Ticked | "Agree to continue." |

**Screen `signin`** ("Sign in at your bank"). A card with a lock icon, the bank name, "Secure sign-in", "BankWorkx® wants to read your accounts." and "You’re signed in at {bank}." Buttons **Allow** (busy "Connecting…", about 1.1 seconds) and **Deny**. The person never types the other bank's password in BankWorkx®.

- **Deny**: "Access was not allowed. Nothing was connected."
- Lakeside Bank: "That bank isn’t answering right now. Nothing was connected. Try again later."

**Screen `accounts`** ("Choose accounts"). Button **Connect**. One switch per account of that bank, all on: the label is "{name} ••{last4}" and the sub-line is the balance with the market symbol. The Credit card switch shows only with `allowCards`.

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| (one per account) | `toggle` | At least one on | At least one account chosen | "Choose at least one account." |

**Result** ("Bank connected", green, text "Its accounts are on your Accounts tab, read only."). Rows "Bank", "Accounts" (the number) and "Shared until" (the date). Buttons **See accounts** (opens the Accounts tab) and **Done**. A note "{bank} connected" is added to the notification list. On the Accounts tab each connected account shows as "{bank} {name}" with the label "At {bank} (read only)", its balance and a short list of sample transactions (a credit card shows spending only).

**States**
- Loading: busy text on **Allow**.
- Empty: not applicable.
- Error: "We couldn’t reach the bank. Nothing was connected." The Service down switch shows the standard connection sheet ("We couldn’t reach the bank", "Nothing was sent and you haven’t been charged. Try again in a moment.", **Try again**).
- Timeout: "This is taking longer than expected. Nothing was connected."
- Expired sharing (planned): the account shows "Sharing ended" with **Reconnect**; a reminder is sent 7 days before.

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `ACCESS_DENIED` | "Access was not allowed. Nothing was connected." | `signin` | Back to start |
| `BANK_UNAVAILABLE` | "That bank isn’t answering right now. Nothing was connected. Try again later." | `signin` | Choose another bank |
| `TIMEOUT` | "This is taking longer than expected. Nothing was connected." | `signin` | Try again |
| `SERVICE_UNAVAILABLE` | "We couldn’t reach the bank. Nothing was connected." | `signin` | Try again |
| `ALREADY_CONNECTED` (existing in `bank.accounts.connect`) | "This bank is already connected." | `bank` | OK |
| `JOURNEY_DISABLED` | "This isn’t available at your bank." | whole journey | none |
| `PERMISSION_DENIED` (planned) | Standard message | whole journey | Back |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `banks` | `bank.banks.list` | none | map of banks | none | Existing (`packages/mock-bank-api/src/index.ts`) |
| `startConnection` | `bank.connections.start` | `{bankId}` | `{redirectUrl, state}` | `BANK_UNAVAILABLE`, `SERVICE_UNAVAILABLE`, `TIMEOUT` | (planned). Replaces the credential form below |
| `finishConnection` | `bank.connections.finish` | `{state, accountIds}` | `{bank, accounts, until}` | `ACCESS_DENIED`, `ALREADY_CONNECTED`, `TIMEOUT` | (planned) |
| `disconnect` | `bank.connections.remove` | `{bankId}` | `{removed}` | `SERVICE_UNAVAILABLE` | (planned) |
| `connect` | `bank.accounts.connect` | `{bankId, username, password, accountType}` | `{connectedId, bank, kind, maskedNumber, balance}` | `BANK_NOT_FOUND`, `BANK_AUTH_FAILED`, `ALREADY_CONNECTED` | Existing, but it takes the other bank's username and password, which the current design no longer collects; it must be replaced by the three adapters above |

#### 6. Permissions, step-up and limits

`accounts.view`. Step-up: the other bank's own secure sign-in; no BankWorkx® code. Limits: read only; sharing ends after the market period (365, 90 or 180 days); connected accounts are never offered as the source or target of a payment.

#### 7. Result and links out

Result as above. Notifications raised (planned): a reminder 7 days before sharing ends, and a message if the other bank ends the sharing. Every connection and disconnection is written to the security log (audit). Links out: the Accounts tab (see accounts, disconnect).

#### 8. Acceptance criteria

- AC-1: The bank list leaves out banks already connected; a connected bank shows with its account count and end date and can be disconnected after a confirmation.
- AC-2: The person must agree before continuing; the screen says what is shared, until when, and that BankWorkx® can only read.
- AC-3: The other bank's sign-in is a separate step; **Deny** connects nothing and says so.
- AC-4: An unavailable bank connects nothing and says so.
- AC-5: At least one account must be chosen; the credit card appears only with `allowCards`.
- AC-6: After connecting, the chosen accounts show in Accounts as read only with their balances; none can be used in a payment journey.
- AC-7: The sharing period follows the market (365, 90, 180, 365 days) and amounts use the market symbol.
- AC-8: Disconnecting removes the bank's accounts from the list.
- AC-9: When the bank is unavailable or times out nothing is connected.

#### 9. Scenarios

Synthetic persona `alex` (Market A unless stated).

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-2, AC-5, AC-6 | `alex` | none | Maple Credit Union, agree, **Allow**, leave all three on, **Connect**: "Bank connected", rows Bank "Maple Credit Union", Accounts "3", Shared until (today + 365 days). Accounts shows "Maple Credit Union Current" with "At Maple Credit Union (read only)". |
| T-2 | AC-5 | `alex` | none | All switches off: "Choose at least one account." |
| T-3 | AC-5 | `alex`, `allowCards` off | none | Only Current and Savings are listed; result "Accounts" "2". |
| T-4 | AC-2 | `alex` | none | **Continue** without ticking: "Agree to continue." |
| T-5 | AC-3 | `alex` | none | **Deny**: "Access was not allowed. Nothing was connected." and the bank is not in Connected. |
| T-6 | AC-4 | `alex` | none | Lakeside Bank, **Allow**: "That bank isn’t answering right now. Nothing was connected. Try again later." |
| T-7 | AC-1, AC-8 | `alex`, Maple connected | none | The bank list no longer offers Maple; Connected shows "Maple Credit Union", "3 accounts · until …"; **Disconnect**, **Disconnect**: toast "Bank disconnected", its accounts are gone from Accounts. |
| T-8 | AC-6 | `alex`, Maple connected | none | In `personal-transfer`, `own-transfer` and `pay-bill` the account lists do not include the Maple accounts. |
| T-9 | AC-7 | `alex`, Markets B, C, D | none | Shared until today + 90, 180, 365 days; balances with `£`, `€`, `AED `. |
| T-10 | AC-9 | `alex` | `unavailable: ["bank.connections.finish"]` (prototype: Service down on) | Connection sheet; nothing connected. |
| T-11 | AC-9 | `alex` | `timeout: ["bank.connections.finish"]`, `latencyMs: 10000` | After 10 seconds: "This is taking longer than expected. Nothing was connected." |

#### 10. Expected mutation-check survivors

The sample balances and transactions are generated from the bank's position in the list and are not asserted; expected. The 7-day reminder and the log entry are not asserted; expected. The sharing period survives when only Market A is asserted; expected. Everything else: none expected.

---

## System states

These states apply to the whole Personal app (and the Public screens where they make sense). They are drawn by the app shell, not by a journey, from one shared component set in `packages/ui-kit` (planned `StateScreen`, `StateBanner`, `StateToast`). Buttons named below must exist exactly as written. Sandbox causes are set with `MockBank.conditions` (README 1.5) or the dev "Sandbox conditions" panel.

| State | Where it shows | Trigger | Exact copy | Buttons and targets |
|---|---|---|---|---|
| **Offline** | A slim banner under the header on every screen; journeys keep the data on the screen | Device reports no network, or two requests in a row fail to connect | Banner: "You're offline. Some things may be out of date." In a journey, on a submit: "You're offline. Nothing was sent. Connect to the internet and try again." | Banner: "Retry" re-runs the failed call. Journey: "Try again" re-runs the submit when back online. When connection returns: banner turns green "You're back online" for 3 seconds. Money-moving submits are blocked while offline so nothing is sent twice. |
| **Backend unavailable** | Full-screen state in the area of the failed list or screen; a banner if cached data exists; in a journey, the `failed` result | Any adapter answers `SERVICE_UNAVAILABLE`, or 3 calls in a row fail with `CORE_UNAVAILABLE` | Title "BankWorkx® isn't available right now". Body "Nothing was changed. Please try again in a few minutes." Money step: "No money has left your account." | "Try again" (re-runs the call); "Back" (previous screen); link "Contact us" → Help › Talk to us |
| **Timeout with retry** | The loading area after 10 seconds, replacing the skeleton or spinner | No answer within 10 seconds (`TIMEOUT`) | Reading: "This is taking longer than expected. Nothing was changed." Money step: "We didn't get an answer in time. Check Activity before you try again, so you don't pay twice." | Reading: "Try again". Money step: "Check Activity" → Payments › tracker (primary), "Try again" (secondary, disabled for 10 seconds). Retry uses the same request key so a repeat cannot pay twice (planned). |
| **Empty lists** | Inside the list's own area, centred under the filters | A list adapter returns no items (`conditions.empty`) | Per screen, from its shell spec. Default: "Nothing here yet." plus one sentence of help. Examples: Notifications "You're all caught up. New alerts will appear here."; Messages "No messages yet. Write to us and the answer will appear here."; Requests "You have no open requests."; Linked banks "You haven't connected another bank yet…" | One button when there is an obvious next step: "New message", "New request", "Connect an account", "Clear filters" (see the shell spec) |
| **Permission denied** | A bottom sheet (mobile) or a dialog (web) when a deep link or action needs a permission the context lacks; a full-screen state if the whole screen is denied | `PERMISSION_DENIED` from an adapter, or a launch point opened by link without the permission | Title "You can't do that". Body, personal: "Your profile doesn't allow this." Business: "Your role doesn't allow this. Ask an administrator at {company}." | "Close" (back to the previous screen); business adds "Contact administrator" → Business › Admin › Users (opens only if the person can see it); wrong context: "Switch" → context switch (step-up), "Not now" |
| **Session expired** | Full-screen state over whatever the person was doing; the screen behind is cleared | `SESSION_EXPIRED` from any adapter, 15 minutes without activity on the server, or a revoked session | Title "You were signed out". Body "You were signed out for your security. Sign in again to continue. Nothing you were doing was saved." | "Sign in" → Sign-in (Public); after sign-in the person goes to Home (deep links are kept only for notifications); "Cancel" → Landing |
| **Maintenance** | Full-screen state at launch (Splash check) and over the app if a call answers `MAINTENANCE` (planned) | Sandbox flag `maintenance: { from, to }`; the Splash calls `bank.system.status` (planned) | Title "We're making BankWorkx® better". Body "The app is paused until {time} UTC on {date}. Your money is safe." Example: "…until 04:00 UTC on 08 Nov 2026." If no end time is known: "We'll be back soon." | "Check again" re-calls `bank.system.status`; "Contact us" → Help › Talk to us (phone number only, no sign-in); no back button. Signed-in sessions are paused, not ended. |
| **Forced update** | Full-screen state at launch; mobile only (web reloads itself) | `bank.system.status` answers `minVersion` greater than the app's version | Title "Please update BankWorkx®". Body "This version is no longer supported. Update to keep your banking safe." | "Update now" → app store page; no skip and no back. Sandbox: the build shows "Update now" opens the store link in a new tab. A softer variant (`recommendedVersion`) shows once as a sheet with "Update" and "Later". |
| **Context-tagged notification toast or banner** | A toast at the top of the screen (3 seconds, swipe to dismiss) when the app is open; for items that need action a banner stays under the header until dismissed or opened. Never covers a journey's primary button or an OTP screen | A notification arrives while the app is in the foreground (push payload with `tag`) | Layout: tag chip (e.g. "Payments"), bold title, one-line body, e.g. chip "Cards", "Your card is on its way", "Arrives by 06 Nov 2026." Security banners use the warning tone and stay: chip "Security", "New sign-in to your account", "Chrome on macOS, 02 Nov 2026 09:14 UTC. Not you?" | Tap the toast or banner → its deep link (catalogue). Banner buttons: primary action named in the catalogue (for example "Review"), "Dismiss". Security banners also carry "This wasn't me" → `change-password`. If the person is mid-journey the toast shows but tapping it asks "Leave this journey? Nothing will be saved." with "Leave" and "Stay". Respects Settings › Notifications (a muted tag shows nothing here, except Security). |

Cross-state rules:

- Offline wins over every other state; maintenance wins over backend unavailable; session expired wins over timeout.
- Each state screen has a test id (`state-offline`, `state-unavailable`, `state-timeout`, `state-empty`, `state-denied`, `state-expired`, `state-maintenance`, `state-update`, `state-toast`) so scenarios and the app tests can find them.
- None of these screens shows a technical code to the customer. The code goes to the run log.

---

## Notifications catalogue — Retail

How to read it: **ID** is stable and used by journeys. **Channel** values: P = push, I = in-app (notification centre), E = email, S = SMS. Every raised notification is always in-app (I) so the centre is complete; the column lists the extra channels. **Deep link** is a shell path or `/personal/j/<slug>?…` (Personal) or `bankworkx://public/…` (Public, before sign-in). **Tag** is the context tag used by chips, filters and Settings. A "(planned)" slug is a journey not yet built. Placeholders: `{n}` number, `{amount}` money with currency, `{ref}` reference. All data is synthetic. Security-tag items cannot be turned off.

**Public journeys (README 5.1)**

| ID | Journey slug | Event | Title | Body | Channels | Deep link | Tag |
|---|---|---|---|---|---|---|---|
| N-01 | `sign-in` | Sign-in from a new device | New sign-in to your account | "{device}, {date} {time} UTC. If this wasn't you, change your password now." | I, P, E | `/personal/more/settings/security` | Security |
| N-02 | `sign-in` | Account locked after 5 wrong passwords | Your account is locked | "Too many wrong passwords. Unlock it to keep banking." | I, E, S | `bankworkx://public/j/unlock-account?username={u}` | Security |
| N-03 | `setup-quick-login` | Quick sign-in or biometrics turned on | Quick sign-in is on | "You can now sign in with {method} on {device}. Not you? Remove it in Trusted devices." | I, P, E | `/personal/j/trusted-devices?deviceId={id}` | Security |
| N-04 | `forgot-username` | Username sent | Your username | "We sent your username to your email. We never send your password." | E | `bankworkx://public/j/sign-in` | Security |
| N-05 | `reset-password` | Password reset link or code sent | Reset your password | "Your code is {code}. It runs out in 10 minutes. We will never ask you for it." | S, E | `bankworkx://public/j/reset-password` | Security |
| N-06 | `reset-password` | Password was reset | Your password was changed | "If you didn't do this, call us now on +1 800 555 0100." | I, P, E, S | `/personal/more/settings/security` | Security |
| N-07 | `unlock-account` | Account unlocked | Your account is unlocked | "You can sign in again. Choose a password you haven't used before." | I, E, S | `bankworkx://public/j/sign-in` | Security |
| N-08 | `register-digital-banking` | Registration finished | Welcome to BankWorkx® | "Your digital banking is ready. Sign in with {username}." | E, S | `bankworkx://public/j/sign-in` | Application |
| N-09 | `open-account` | Application received | We have your application | "Reference {ref}. We'll check it within 2 working days." | E, S | `bankworkx://public/j/track-application?applicationId={id}` | Application |
| N-10 | `open-account` / `track-application` | Application needs a document | We need one more thing | "Please send a proof of address for application {ref}." | P, E, S | `bankworkx://public/j/track-application?applicationId={id}` | Application |
| N-11 | `track-application` | Application approved | Your account is open | "Welcome. Your account number is {masked}. Register for digital banking to start." | P, E, S | `bankworkx://public/j/register-digital-banking` | Application |
| N-12 | `track-application` | Application declined | An update on your application | "We can't open this account right now. See why and what you can do." | P, E | `bankworkx://public/j/track-application?applicationId={id}` | Application |
| N-13 | `contact-support` | Message received | We got your message | "Reference {ref}. We'll reply to your email within 1 working day." | E | `bankworkx://public/j/contact-support` | Messages |
| N-14 | `find-branch-atm` | None (search only; no notification is raised) | – | – | – | – | – |
| N-15 | `loan-calculator`, `deposit-calculator` | None (calculators; no notification is raised) | – | – | – | – | – |

**Personal journeys (README 5.2)**

| ID | Journey slug | Event | Title | Body | Channels | Deep link | Tag |
|---|---|---|---|---|---|---|---|
| N-20 | `own-transfer` | Transfer between own accounts done | Money moved | "{amount} from {from} to {to}. Ref {ref}." | I | `/personal/payments/tracker/{paymentId}` | Payments |
| N-21 | `internal-transfer` | Sent to a BankWorkx® customer | Money sent | "{amount} to {name}. Ref {ref}." | I, P | `/personal/payments/tracker/{paymentId}` | Payments |
| N-22 | `personal-transfer` | Sent to another bank | Payment sent | "{amount} to {name} at {bank}. It should arrive by {date}. Ref {ref}." | I, P, E | `/personal/payments/tracker/{paymentId}` | Payments |
| N-23 | `international-transfer` | Sent abroad | Payment on its way | "{amount} to {name} in {country}. Expected {date}. Ref {ref}." | I, P, E | `/personal/payments/tracker/{paymentId}` | Payments |
| N-24 | `international-transfer` | Payment delivered / returned | Payment delivered / Payment returned | "{name} received {amount}." / "{amount} came back to {account}. Reason: {reason}." | I, P | `/personal/payments/tracker/{paymentId}` | Payments |
| N-25 | `pay-bill` | Bill paid | Bill paid | "{amount} to {biller}. Ref {ref}." | I, P | `/personal/payments/tracker/{paymentId}` | Payments |
| N-26 | `mobile-topup` | Top-up done | Top-up done | "{amount} added to {number}. Ref {ref}." | I, P | `/personal/payments/tracker/{paymentId}` | Payments |
| N-27 | `add-money` | Money added from card | Money added | "{amount} is now in {account}. Ref {ref}." | I, P | `/personal/accounts/{accountId}` | Accounts |
| N-28 | `schedule-payment` | Scheduled payment about to run (day before) | Payment due tomorrow | "{amount} to {name} on {date}. Make sure {account} has enough." | I, P | `/personal/j/schedule-payment?scheduleId={id}` | Payments |
| N-29 | `schedule-payment` | Scheduled payment failed | Scheduled payment failed | "{amount} to {name} didn't go through: not enough money in {account}. No money has left your account." | I, P, E | `/personal/j/schedule-payment?scheduleId={id}` | Payments |
| N-29a | `cancel-standing-order` | Standing order cancelled | Standing order cancelled | "{name}, {amount} {frequency}. It won't run again." | I | `/personal/payments/scheduled` | Payments |
| N-29b | `manage-beneficiary` | Beneficiary added / changed / deleted | Beneficiary {added/changed/deleted} | "{name} at {bank}. If this wasn't you, call us now." | I, P, E | `/personal/payments/beneficiaries` | Payments |
| N-30 | `new-message` | Message sent | Message sent | "Reference {ref}. We'll reply within 1 working day." | I | `/personal/more/messages/{threadId}` | Messages |
| N-31 | `new-message` | Bank replied | New message from BankWorkx® | "Re: {subject}. Open it to read our reply." | I, P, E | `/personal/more/messages/{threadId}` | Messages |
| N-32 | `service-request` | Request or complaint received | We have your {request/complaint} | "Reference {ref}. We'll answer by {dueAt}." | I, E | `/personal/more/requests/{requestId}` | Messages |
| N-33 | `service-request` | Status changed | Your {request/complaint} is {status} | "{ref}: {status}." | I, P | `/personal/more/requests/{requestId}` | Messages |
| N-34 | `service-request` | Bank needs a reply | We need something from you | "{ref}: {question}" (first 80 characters) | I, P, E | `/personal/more/requests/{requestId}` | Messages |
| N-35 | `service-request` | Resolved | Your {request/complaint} is resolved | "{ref}. Tell us if it isn't sorted." | I, P, E | `/personal/more/requests/{requestId}` | Messages |
| N-40 | `account-statement` | Statement ready | Your statement is ready | "{account}, {period}. Download it from the app." | I, E | `/personal/accounts/{accountId}/statements` | Accounts |
| N-41 | `account-nickname` | Account renamed | Account renamed | "{old} is now {new}." | I | `/personal/accounts/{accountId}` | Accounts |
| N-42 | `open-another-account` | New account opened | Your new account is open | "{type} {masked} in {currency}. You can add money now." | I, P, E | `/personal/accounts/{accountId}` | Accounts |
| N-43 | `create-budget` | Budget created | Budget created | "{category}: {amount} a month." | I | `/personal/accounts/budgets` | Accounts |
| N-44 | `create-budget` | Budget at 80% (alert on) / over limit | You've used 80% of {category} / You're over your {category} budget | "{spent} of {limit} this month." | I, P | `/personal/accounts/budgets` | Accounts |
| N-45 | `dispute-transaction` | Dispute received / decided | We're looking into your report / Your report is resolved | "{merchant}, {amount}. Reference {ref}." / "We refunded {amount}." or "We couldn't refund this. See why." | I, P, E | `/personal/accounts/transactions/{transactionId}` | Accounts |
| N-50 | `connect-account` | Bank linked | {bank} is linked | "{bank} {masked}. We read your balance and transactions, nothing else." | I | `/personal/more/settings/linked-banks` | Accounts |
| N-51 | `connect-account` | Link needs attention | Reconnect {bank} | "We couldn't refresh {bank}. Connect it again to keep seeing its balance." | I, P | `/personal/j/connect-account` | Accounts |
| N-52 | `activate-card` | Card activated | Card activated | "Card ••{last4} is ready to use." | I, P | `/personal/cards/{cardId}` | Cards |
| N-53 | `activate-card` | Activation reminder (card delivered 3 days ago) | Activate your new card | "Card ••{last4} isn't active yet. It takes a minute." | I, P | `/personal/j/activate-card?cardId={cardId}` | Cards |
| N-54 | `freeze-card` | Card frozen / unfrozen / blocked | Card {frozen/unfrozen/blocked} | "Card ••{last4}. {Frozen: Unfreeze it any time. Blocked: we'll send a new card.}" | I, P, E | `/personal/cards/{cardId}` | Cards |
| N-55 | `card-controls` | Limits or controls changed | Card controls updated | "Card ••{last4}: {summary}." | I, P | `/personal/cards/{cardId}` | Cards |
| N-56 | `virtual-card` | Virtual card created / deleted | Virtual card {ready/deleted} | "Card ••{last4}. Use it online straight away." | I, P | `/personal/cards/{cardId}` | Cards |
| N-57 | `replace-card` | Replacement ordered / shipped | Your new card is on its way | "Arrives by {date}. Your old card ••{last4} {stops working now / works until then}." | I, P, E | `/personal/cards/{cardId}` | Cards |
| N-58 | `card-pin` | PIN set or changed | Card PIN changed | "Card ••{last4}. If this wasn't you, freeze your card now." | I, P, E, S | `/personal/j/freeze-card?cardId={cardId}&action=freeze` | Security |
| N-59 | `add-card` | Card added | Card added | "••{last4} can now be used to add money." | I | `/personal/more/settings/linked-banks` | Cards |
| N-60 | `change-password` | Password changed | Your password was changed | "If this wasn't you, call us now on +1 800 555 0100." | I, P, E, S | `/personal/more/settings/security` | Security |
| N-61 | `trusted-devices` | Device added / removed | Device {added/removed} | "{device}. Not you? Change your password." | I, P, E | `/personal/j/trusted-devices?deviceId={id}` | Security |
| N-62 | `change-quick-pin` | Quick PIN changed | Quick PIN changed | "You can sign in with the new PIN on {device}." | I, P | `/personal/more/settings/security` | Security |
| N-63 | `setup-quick-login` | Biometrics on / off | Biometric sign-in {on/off} | "{device}." | I, P | `/personal/more/settings/security` | Security |
| N-64 | `sign-in` | Sign-in from a new country | Sign-in from a new country | "{country}, {date} {time} UTC. Not you? Change your password now." | I, P, E, S | `/personal/j/change-password` | Security |
| N-70 | `update-profile` | Contact or address changed (sent to the **old** contact too) | Your details were changed | "Your {mobile number/email/address} was changed on {date}. If this wasn't you, call us now." | I, P, E, S | `/personal/more/profile` | Profile |
| N-71 | `update-profile` | Email still unverified after 24 hours | Please confirm your email | "We couldn't confirm {masked email}. Confirm it to keep getting statements." | I, E | `/personal/j/update-profile?field=email` | Profile |
| N-80 | `term-deposit` | Deposit opened / maturing in 7 days / matured | Deposit opened / Your deposit matures soon / Your deposit has matured | "{amount} at {rate}% until {date}." / "Choose what happens on {date}." | I, P, E | `/personal/save-borrow/deposits/{depositId}` | Saving |
| N-81 | `savings-goal` | Goal created / reached | Goal created / You reached your goal | "{name}: {saved} of {target}." / "{name} is fully funded. Well done." | I, P | `/personal/save-borrow/goals/{goalId}` | Saving |
| N-82 | `apply-loan` | Application received / decision | We have your loan application / Your loan decision | "Reference {ref}." / "Approved: {amount} over {months} months. Review and accept." or "We can't offer this loan right now." | I, P, E | `/personal/save-borrow/loans/{loanId}` | Borrowing |
| N-83 | `apply-loan` | Loan paid out | Your loan is in your account | "{amount} has been paid to {account}." | I, P, E | `/personal/save-borrow/loans/{loanId}` | Borrowing |
| N-84 | `repay-loan` | Repayment done / settled | Repayment received / Your loan is settled | "{amount} paid. {remaining} left." / "You owe nothing on {loan}." | I, P, E | `/personal/save-borrow/loans/{loanId}` | Borrowing |
| N-85 | `repay-loan` | Instalment due in 3 days | Instalment due soon | "{amount} due on {date}. Make sure {account} has enough." | I, P | `/personal/j/repay-loan?loanId={loanId}&mode=pay` | Borrowing |
| N-86 | `invest` | Order placed | Order placed | "You bought {shares} of {symbol} at {price}. Ref {ref}." | I, P | `/personal/save-borrow/investments` | Saving |
| N-87 | `sell-investment` | Sale complete | Sale complete | "You sold {shares} of {symbol}. {proceeds} is in {account}." | I, P | `/personal/save-borrow/investments` | Saving |
| N-90 | (shell, any) | Money received into an account | Money received | "{amount} from {name} in {account}." | I, P, S | `/personal/accounts/{accountId}` | Payments |
| N-91 | (shell, any) | Low balance (below the customer's setting) | Low balance | "{account} has {balance}." | I, P | `/personal/accounts/{accountId}` | Accounts |
| N-92 | (marketing) | Offer for a loan or account | Offer | "{headline}" | I, E | `/personal/j/apply-loan?offerId={id}` or `/personal/j/open-another-account?offerId={id}` | Offers |

Rules for the catalogue:

- Money-moving results (N-20 to N-27, N-84, N-86, N-87) include the reference so the person can quote it.
- Every item carries `createdAt` and the deep link; the link must pass the permission check of its launch point (README 4.1, 5.2) or the "You can't open this" sheet shows.
- Settings › Notifications can mute push, email or SMS per tag. It cannot mute Security (N-01 to N-07, N-58, N-60 to N-64, N-70) or any notification about money leaving the account. In-app items are always kept for 90 days.
- N-14 and N-15 are listed to show the journeys were checked; they raise nothing.
- Sandbox: notifications are written to `bank.notifications.list` by the adapter that finishes each journey (planned, same transaction), so scenarios can assert them in `expectBank`.

