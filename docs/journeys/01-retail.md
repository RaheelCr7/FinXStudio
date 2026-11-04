# Module 1: Retail (pre-login, sign-in, security and Personal "Aurora")

**Release 1. Workspaces: Public (before sign-in) and Personal.** Everything a retail customer does, from the first launch of the app to sign-out: explore without an account, open an account or register, sign in and keep the account secure, then manage accounts, payments, cards, saving and borrowing, and servicing.

**What exists today:** BankWorkx® is a retail-only shell (`docs/BANKWORKX.md`): Dashboard, Accounts, Budgets, Wallet and Invest, six journeys in `packages/journey-schema/src/fixtures/bankworkx.ts` without consent, OTP or proof, the CAB access journeys (`fixtures/cab.ts`, `docs/CAB.md`) as the starting pattern for pre-login and sign-in, and Meezan journeys for local transfer, currency conversion and bill pay. **What is planned:** everything marked *(planned)*: sandbox domains, adapters, blocks, contexts, conditions.

## Journey index (52)

| Group | Journeys |
|---|---|
| Explore and onboarding (Public) | `loan-calculator`, `deposit-calculator`, `find-branch-atm`, `contact-support`, `open-account`, `track-application`, `register-digital-banking` |
| Sign-in and security | `sign-in`, `setup-quick-login`, `forgot-username`, `reset-password`, `unlock-account`, `change-password`, `trusted-devices`, `change-quick-pin` |
| Accounts | `accounts`, `account-details`, `statement` (was `account-statement`), `account-nickname` (alias of `account-details`), `open-another-account`, `create-budget` |
| Payments | `transfer-types`, `own-transfer`, `internal-transfer`, `personal-transfer`, `single-transfer`, `international-transfer`, `pay-bill`, `mobile-topup`, `manage-beneficiary`, `schedule-payment`, `cancel-standing-order` (alias of `schedule-payment` in cancel mode) |
| Cards | `cards`, `activate-card`, `freeze-card` (alias of `card-controls`), `card-controls`, `virtual-card`, `replace-card`, `card-pin`, `dispute-transaction`, `add-card` |
| Save & Borrow | `term-deposit`, `savings-goal`, `apply-loan`, `repay-loan`, `invest`, `sell-investment`, `add-money` |
| More | `update-profile`, `new-message`, `service-request`, `connect-account` |

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

#### 1. Summary

| | |
|---|---|
| Slug | `loan-calculator` |
| Purpose | Show a monthly payment, the interest and the total to repay for a loan, before the person signs in or opens an account. |
| Release | 1 |
| Workspace | Public (`workspace: "public"`, planned field) |
| Status | New (planned). Nothing like it exists in `fixtures/`. |
| Channels | Web, mobile |
| Starting pattern | The Meezan/BankWorkx amount screens (`amountInput` with `quickAmounts` and `validation`). The sums are done by a planned adapter, not in the journey, because the expression language has only `min`, `max`, `abs`, `round`, `floor`, `ceil`, `len`, `isEmpty` (`packages/renderer-core/src/expr.ts`): no power function, so the repayment formula cannot be written there. |
| Who may use it | Anyone. No sign-in, no permission, no one-time code. |
| Money moving | No. It saves nothing and makes no offer. |

New adapters: `bank.calc.loan` (planned, sandbox domain `calc`). Products come from `bank.products.get` / `bank.products.list` (planned, see Shell: Product detail). New blocks used: `dataTable` (planned, batch A) for the schedule and `chart` (planned, batch A) for the principal-and-interest ring. Everything else is in `schema.ts` today.

#### 2. Entry points

| Place | Label | Passes | Permission |
|---|---|---|---|
| Products › loan detail | Estimate repayments | `{productId}` (`loan_personal`, `loan_auto` or `loan_home`) | none |
| Landing › Explore › Calculators | Loan calculator (README change needed) | – | none |
| Products › loans list | Calculator (README change needed) | – | none |
| Deep link | `/public/j/loan-calculator?productId=loan_auto` | `{productId}` | none |

With `{productId}` the first screen opens with that loan type chosen and its limits shown. Without it, the person chooses.

#### 3. Screens

**Screen `inputs` — "Loan calculator"** (entry screen). Blocks: `text` (title), `select` (loan type), `amountInput`, `select` (term), `reviewSummary` (the rate), `button`.

| Label | Block | Required | Validation rule | Error message |
|---|---|---|---|---|
| Loan type (`calc.productId`) | `select`, variant `dropdown`, `source` = loan products | Yes | Must be one of `loan_personal`, `loan_auto`, `loan_home` | "Choose a loan type." |
| How much do you want to borrow? (`calc.amount`) | `amountInput`, currency USD, `quickAmounts` from the product (personal: 5,000, 10,000, 25,000) | Yes | Whole dollars (decimals not allowed). Between the product's minimum and maximum, both included. | "Enter a whole number of dollars between {min} and {max}." (whole-number part uses the runner's `amountWhole` rule) |
| How long do you want to repay over? (`calc.termMonths`) | `select`, variant `chips`, choices from the product's terms, shown as "12 months" | Yes | One of the product's terms | "Choose how long you want to repay over." |

Copy:

| Where | Text |
|---|---|
| Title | "Estimate your repayments" |
| Body | "Choose a loan type, an amount and a term. We'll show what you'd pay each month." |
| Helper under amount | "{productName}: from {min} to {max}." (for example "Personal loan: from $1,000 to $35,000.") |
| Rate row (`reviewSummary`, read only) | Label "Interest rate", value "{apr}% a year, fixed" |
| Info alert | "This is an estimate, not an offer. Your rate can be different once we check your application." |

Buttons:

| Button | Does | Leads to |
|---|---|---|
| Calculate | `validate`, then `callApi` `calculate` | `result` on success; stays here on error (message under the button) |
| Back | `exit` | Where the person came from (Products or Landing) |

States: Loading: the three fields show skeletons while the products load; the button is disabled with a spinner while `calculate` runs. Empty: if no loan products come back: "There are no loan types to show right now." Button "Back". Error: see section 4. Changing the loan type clears the amount and the term (their limits differ) and redraws the limits.

**Screen `result` — "Your estimate"**. Blocks: `result` (tone success, no reference, because nothing was created), `reviewSummary`, `chart` (planned, ring), `alert`, `accordion`, `button`.

| Row (reviewSummary) | Value (example: personal, $10,000, 36 months) |
|---|---|
| Loan type | Personal loan |
| Amount | $10,000.00 |
| Term | 36 months |
| Interest rate | 8.90% a year, fixed |
| Monthly payment | $317.53 |
| Last payment | $317.61 |
| Total interest | $1,431.16 |
| Total to repay | $11,431.16 |

Title "About $317.53 a month". Text "Over 36 months you'd repay $11,431.16, of which $1,431.16 is interest." The ring shows principal against interest (87.5% / 12.5%) with a text alternative. The accordion "How we work this out" says: "We use the usual repayment formula. Each month's interest is the balance times the yearly rate divided by 12. Each payment first covers that interest; the rest reduces what you owe. The last payment is adjusted by a few cents so the balance ends at exactly zero. No fees are included."

| Button | Does | Leads to |
|---|---|---|
| Change numbers | `navigate` | `inputs` (values kept) |
| See repayment schedule | `navigate` | `schedule` |
| Sign in to apply | `navigate` with `toJourney: "sign-in"` (planned engine feature) | `sign-in` then, once signed in, the Personal Save & Borrow › loans area (`apply-loan` with `{productId}`) |
| New to BankWorkx®? Open an account | `navigate` with `toJourney: "open-account"` | `open-account` |

**Screen `schedule` — "Repayment schedule"**. Block: `dataTable` (planned) with paging of 12 rows, plus a Back button.

| Column | Meaning | Format |
|---|---|---|
| Payment | Number 1 to n | 1 |
| Payment amount | What is paid that month | $317.53 |
| Principal | Part that reduces the loan | $243.36 |
| Interest | Part that is interest | $74.17 |
| Balance | What is still owed after this payment | $9,756.64 |

Order: payment 1 first. No filter or search. Empty: not possible (at least 12 rows). Phones show one card per payment. Footer line: "Dates depend on when your loan starts." Back goes to `result`.

#### 4. Sandbox errors

Business outcomes are not errors here: the adapter always answers a valid request. Misuse throws, like the existing adapters (`BankError`).

| Code | Message the person sees | Shows on | Button |
|---|---|---|---|
| `PRODUCT_NOT_FOUND` | "We can't find that loan type. Choose another." | `inputs`, under the loan type | Choose loan type (focuses the field) |
| `INVALID_AMOUNT` | "Enter a whole number of dollars between {min} and {max}." | `inputs`, under the amount | Change amount |
| `INVALID_TERM` | "Choose a term of {terms}, for example \"12, 24, 36, 48 or 60 months\"." | `inputs`, under the term | Change term |
| `TIMEOUT` | Non-money wording of S-`TIMEOUT` (README 1.6): "This is taking longer than expected. Nothing was changed." | `inputs`, alert above the button | Try again (calls again) |
| `SERVICE_UNAVAILABLE` | S-`SERVICE_UNAVAILABLE`: "This service is not available right now. Nothing was changed. Please try again in a few minutes." | `inputs`, alert above the button | Try again |

Codes from the standard table that cannot occur: `OTP_*`, `ACCOUNT_NOT_FOUND`, `INSUFFICIENT_FUNDS`, `LIMIT_EXCEEDED`, `CORE_UNAVAILABLE`, `NOT_SUPPORTED`, `PERMISSION_DENIED`, `WRONG_CONTEXT`, `STEP_UP_REQUIRED`, `SESSION_EXPIRED` (no session, no money).

#### 5. Adapters

| Integration id | Adapter | Request | Response | Error codes | Status | moneyMoving | requiresOtp |
|---|---|---|---|---|---|---|---|
| `loanProducts` | `bank.products.list` | `{ type: "loan" }` | Products by id (`id`, `name`, `apr`, `minAmount`, `maxAmount`, `terms[]`) | `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned) | No | No |
| `loanProduct` | `bank.products.get` | `{ productId }` | One product | `PRODUCT_NOT_FOUND`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned) | No | No |
| `calculate` | `bank.calc.loan` | `{ productId, amount, termMonths }` | `{ productId, amount, termMonths, apr, monthlyPayment, lastPayment, totalInterest, totalPayable, schedule: [{ n, payment, principal, interest, balance }] }` | `PRODUCT_NOT_FOUND`, `INVALID_AMOUNT`, `INVALID_TERM`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned) | No | No |

Rules inside `bank.calc.loan` (so the sandbox is the one place that holds them; a real bank's calculator replaces it behind the same name):

1. `r = apr / 1200` (monthly rate). `payment = round2(amount * r / (1 - (1 + r) ^ -n))`, rounding half up to cents.
2. For payment k from 1 to n: `interest_k = round2(balance * r)`; `principal_k = payment - interest_k`; `balance = balance - principal_k`.
3. Payment n is `balance + interest_n` so the balance ends at 0.00. `lastPayment` is that amount.
4. `totalInterest` is the sum of `interest_k`. `totalPayable = payment * (n - 1) + lastPayment`.
5. Limits per product: `loan_personal` $1,000 to $35,000, terms 12, 24, 36, 48, 60, 8.90%; `loan_auto` $5,000 to $60,000, terms 12, 24, 36, 48, 60, 72, 84, 6.90%; `loan_home` $50,000 to $500,000, terms 60, 120, 180, 240, 300, 360, 5.40%. No fees.

#### 6. Permissions, step-up and limits

No permission, step-up `none`. Limits: the amount and term limits above (the only limits). The sandbox may rate-limit a real deployment; in the sandbox there is no rate limit. Nothing is stored: the numbers live in the journey data only for this visit.

#### 7. Result and links out

Result screen: `result`. Receipt: none (no record is made). Notifications: none. Links out are the four buttons on `result` above.

#### 8. Acceptance criteria

- AC-1: For each loan type, the monthly payment, last payment, total interest and total to repay follow the rules in section 5.
- AC-2: An amount below the product's minimum or above its maximum is refused with the amount message, before any result is shown.
- AC-3: An amount with cents is refused with the whole-dollar message.
- AC-4: A term that is not one of the product's terms is refused.
- AC-5: When the journey is opened with a `{productId}` the loan type is already chosen and its limits are shown.
- AC-6: The schedule has one row per payment, the first row matches the first-month interest, the balance ends at $0.00, and the principal column adds up to the amount.
- AC-7: A timeout and an unavailable service each show their message and let the person try again; nothing is stored.
- AC-8: The result says it is an estimate and offers sign-in and open-account buttons.

#### 9. Scenarios

All use persona `sam` (any persona works, no session). No setup unless stated.

| Id | Covers | Setup / conditions | Steps | Expected |
|---|---|---|---|---|
| T-1 | AC-1, AC-8 | – | Personal loan, $10,000, 36 months, Calculate | Payment 317.53, last payment 317.61, interest 1,431.16, total 11,431.16; alert and both buttons visible |
| T-2 | AC-1 | – | Auto loan, $25,000, 60 months | 493.85, 493.95, 4,631.10, 29,631.10 |
| T-3 | AC-1 | – | Home loan, $200,000, 240 months | 1,364.50, 1,365.80, 127,481.30, 327,481.30 |
| T-4 | AC-2 | – | Personal loan, $999 then $35,001 | Both: amount message "Enter a whole number of dollars between $1,000 and $35,000."; `bank.calc.loan` not called |
| T-5 | AC-3 | – | Personal loan, $10,000.50 | Whole-dollar message; no call |
| T-6 | AC-4 | Scenario sends `termMonths: 18` straight to the adapter (the chips cannot) | Calculate | `INVALID_TERM` message on `inputs` |
| T-7 | AC-5 | Start with `{productId: "loan_auto"}` | Open the journey | Loan type shows "Auto loan"; helper "Auto loan: from $5,000 to $60,000." |
| T-8 | AC-6 | After T-1 | Open the schedule | 36 rows over 3 pages; row 1: 317.53 / 243.36 / 74.17 / 9,756.64; row 36 balance 0.00; principal column sums to 10,000.00 |
| T-9 | AC-7 | `conditions.timeout: ["bank.calc.loan"]`, `latencyMs: 10000` | Calculate | Timeout message; Try again works after the condition is cleared |
| T-10 | AC-7 | `conditions.unavailable: ["bank.calc.loan"]` | Calculate | Unavailable message at once; no result |

#### 10. Expected mutation-check survivors

| Survivor | Why it stays alive |
|---|---|
| Removing the `PRODUCT_NOT_FOUND` check in the adapter | The dropdown only offers real products, so no scenario can reach it without sending a bad id. T-6 style direct input could kill it; add it only if the team wants (not planned). |
| Rounding the schedule's `interest_k` half-down instead of half-up | Only differs when the unrounded interest ends in exactly half a cent; none of the example loans do. |

---

### ★ Deposit calculator — `deposit-calculator`

#### 1. Summary

| | |
|---|---|
| Slug | `deposit-calculator` |
| Purpose | Show how much interest a term deposit earns, how it is paid and when it matures, before sign-in. |
| Release | 1 |
| Workspace | Public |
| Status | New (planned) |
| Channels | Web, mobile |
| Starting pattern | The `loan-calculator` above (same shape: inputs, result). The `term-deposit` Personal journey later reuses the same rule through the same adapter. |
| Who may use it | Anyone. No sign-in, no permission, no one-time code. |
| Money moving | No. |

New adapters: `bank.calc.deposit` (planned). Products from `bank.products.list` / `get` (planned). Blocks: all in `schema.ts` today, plus `chart` (planned) for the optional growth line.

#### 2. Entry points

| Place | Label | Passes | Permission |
|---|---|---|---|
| Products › deposit detail | Estimate returns | `{productId}` (`dep_6m`, `dep_12m`, `dep_24m`) | none |
| Landing › Explore › Calculators | Deposit calculator (README change needed) | – | none |
| Products › deposits list | Calculator (README change needed) | – | none |
| Deep link | `/public/j/deposit-calculator?productId=dep_12m` | `{productId}` | none |

#### 3. Screens

**Screen `inputs` — "Deposit calculator"** (entry). Blocks: `text`, `select`, `amountInput`, `select`, `reviewSummary`, `button`.

| Label | Block | Required | Validation rule | Error message |
|---|---|---|---|---|
| Deposit (`calc.productId`) | `select`, variant `rows`, choices: "6 months, 3.60%", "12 months, 4.10%", "24 months, 4.40%" | Yes | One of `dep_6m`, `dep_12m`, `dep_24m` | "Choose a deposit." |
| How much do you want to deposit? (`calc.amount`) | `amountInput`, USD, `quickAmounts` 1,000, 5,000, 10,000 | Yes | Between $500.00 and $250,000.00, up to 2 decimals | "Enter an amount between $500.00 and $250,000.00." |
| How do you want your interest? (`calc.payout`) | `select`, variant `chips`: "At the end" (`maturity`), "Every month" (`monthly`) | Yes (default "At the end") | One of the two | "Choose how you want your interest." |

Copy: Title "Estimate your returns". Body "Choose a deposit, an amount and how you want your interest." Helper under amount: "Deposits of $50,000 or more earn 0.10% a year extra." Read-only rows: "Term" (from the product, "12 months"), "Interest rate" ("4.10% a year" or, once the amount is $50,000 or more, "4.20% a year, includes 0.10% bonus", redrawn as the amount changes). Info alert: "This is an estimate before tax. The rate is fixed for the whole term."

| Button | Does | Leads to |
|---|---|---|
| Calculate | `validate`, then `callApi` `calculate` | `result` |
| Back | `exit` | Where the person came from |

States as in `loan-calculator` (skeleton while products load, spinner on the button, empty text "There are no deposits to show right now." with Back).

**Screen `result` — "Your estimate"**. Blocks: `result`, `reviewSummary`, `alert`, `accordion`, `button`.

| Row | Example 1: `dep_12m`, $10,000, at the end | Example 2: `dep_6m`, $10,000, every month |
|---|---|---|
| Deposit | 12-month deposit | 6-month deposit |
| Amount | $10,000.00 | $10,000.00 |
| Interest rate | 4.10% a year | 3.60% a year |
| Interest | $410.00 at the end | $30.00 a month, $180.00 in total |
| You get back (maturity) | $10,410.00 | $10,000.00 (the interest was paid monthly) |
| Matures on | 3 Nov 2027 | 3 May 2027 |

Title: "You'd earn about $410.00". Text: "If you opened this deposit today, it would mature on 3 Nov 2027." Accordion "How we work this out": "Interest is simple interest: amount times yearly rate, for the number of months out of 12. Paid at the end, you get the interest with your money. Paid every month, each month's interest is rounded to the cent. The maturity date is the same day of the month, {term} months from today; if that day doesn't exist (for example 31 Aug plus 6 months), it is the last day of that month. Deposits of $50,000 or more earn 0.10% a year extra. Taking money out early costs 1% of the amount."

| Button | Does | Leads to |
|---|---|---|
| Change numbers | `navigate` | `inputs` (values kept) |
| Sign in to open a deposit | `navigate` with `toJourney: "sign-in"` (planned) | `sign-in`, then Personal Save & Borrow › deposits (`term-deposit`, `{mode: "open"}`) |
| New to BankWorkx®? Open an account | `navigate` with `toJourney: "open-account"` | `open-account` |

#### 4. Sandbox errors

| Code | Message the person sees | Shows on | Button |
|---|---|---|---|
| `PRODUCT_NOT_FOUND` | "We can't find that deposit. Choose another." | `inputs` | Choose deposit |
| `INVALID_AMOUNT` | "Enter an amount between $500.00 and $250,000.00." (limits from the product; at most 2 decimals) | `inputs`, under the amount | Change amount |
| `INVALID_PAYOUT` | "Choose how you want your interest." | `inputs` | Choose |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | `inputs`, alert | Try again |
| `SERVICE_UNAVAILABLE` | S-`SERVICE_UNAVAILABLE` (README 1.6) | `inputs`, alert | Try again |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Error codes | Status | moneyMoving | requiresOtp |
|---|---|---|---|---|---|---|---|
| `depositProducts` | `bank.products.list` | `{ type: "deposit" }` | Products by id (`id`, `name`, `termMonths`, `rate`, `bonusRate`, `bonusFrom`, `minAmount`, `maxAmount`) | `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned) | No | No |
| `calculate` | `bank.calc.deposit` | `{ productId, amount, payout: "maturity" \| "monthly" }` | `{ productId, amount, termMonths, rate, bonusApplied, interestTotal, monthlyInterest?, maturityAmount, openedOn, maturesOn }` | `PRODUCT_NOT_FOUND`, `INVALID_AMOUNT`, `INVALID_PAYOUT`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned) | No | No |

Rules inside `bank.calc.deposit`:

1. Rate: `dep_6m` 3.60%, `dep_12m` 4.10%, `dep_24m` 4.40%. If `amount >= 50,000.00` the rate is the product rate plus 0.10 (bonus). 49,999.99 gets no bonus.
2. Amount between $500.00 and $250,000.00, at most 2 decimals.
3. Paid at the end: `interestTotal = round2(amount * rate / 100 * termMonths / 12)` (half up); `maturityAmount = amount + interestTotal`.
4. Paid every month: `monthlyInterest = round2(amount * rate / 100 / 12)`; `interestTotal = monthlyInterest * termMonths`; `maturityAmount = amount`. (So the two choices can differ by a few cents.)
5. `openedOn` is the sandbox clock's date. `maturesOn` adds `termMonths` months to it, using the same day of the month, or the month's last day if that day does not exist.

#### 6. Permissions, step-up and limits

No permission, step-up `none`. Limits are the amount limits in rule 2 only. Nothing is stored.

#### 7. Result and links out

Result screen `result`. Receipt none. Notifications none. Links out: the three buttons above.

#### 8. Acceptance criteria

- AC-1: Interest paid at the end equals amount times rate times months over 12, rounded to the cent, and maturity equals amount plus interest.
- AC-2: Interest paid every month is rounded each month and the total is that figure times the months.
- AC-3: Amounts of $50,000 or more get the 0.10% bonus; $49,999.99 does not; the screen shows the bonus rate before calculating.
- AC-4: The maturity date is the same day of the month after the term, or the last day of the month when that day does not exist.
- AC-5: An amount below $500.00 or above $250,000.00, or with more than 2 decimals, is refused with the amount message.
- AC-6: Opened with a `{productId}`, that deposit is chosen and its term and rate shown.
- AC-7: A timeout and an unavailable service each show their message and allow a retry; nothing is stored.

#### 9. Scenarios

Persona `sam`, no session. Sandbox clock set with `now` where stated.

| Id | Covers | Setup / conditions | Steps | Expected |
|---|---|---|---|---|
| T-1 | AC-1 | `now: 2026-11-03` | `dep_12m`, $10,000, at the end | Interest 410.00, maturity amount 10,410.00, matures 3 Nov 2027 |
| T-2 | AC-2 | `now: 2026-11-03` | `dep_6m`, $10,000, every month | 30.00 a month, 180.00 total, matures 3 May 2027 |
| T-3 | AC-1, AC-2 | – | `dep_6m`, $1,234.00, at the end then every month | End: 22.21. Monthly: 3.70 a month, total 22.20 |
| T-4 | AC-3 | – | `dep_24m`, $50,000, at the end | Rate row "4.50% a year, includes 0.10% bonus"; interest 4,500.00; maturity 54,500.00 |
| T-5 | AC-3 | – | `dep_12m`, $49,999.99 then $50,000 | First: 4.10%, interest 2,050.00. Second: 4.20%, interest 2,100.00 |
| T-6 | AC-4 | `now: 2026-08-31` | `dep_6m`, $1,000, at the end | Matures 28 Feb 2027 |
| T-7 | AC-5 | – | $499.99; $250,000.01; $1,000.001 | Each: "Enter an amount between $500.00 and $250,000.00."; no call |
| T-8 | AC-6 | Start with `{productId: "dep_24m"}` | Open | "24-month deposit" chosen; Term "24 months"; Rate "4.40% a year" |
| T-9 | AC-7 | `conditions.timeout: ["bank.calc.deposit"]` | Calculate | Timeout message and Try again |
| T-10 | AC-7 | `conditions.unavailable: ["bank.calc.deposit"]` | Calculate | Unavailable message |

#### 10. Expected mutation-check survivors

| Survivor | Why it stays alive |
|---|---|
| Moving the $250,000.00 maximum by less than one cent | Amounts have at most 2 decimals, so no scenario can tell the difference. |
| `PRODUCT_NOT_FOUND` and `INVALID_PAYOUT` checks removed | The product list and the chips only offer valid values, so the UI cannot reach them. |

---

### ★ Find a branch or ATM — `find-branch-atm`

#### 1. Summary

| | |
|---|---|
| Slug | `find-branch-atm` |
| Purpose | Find a branch or ATM near a place, see if it is open, and call or get directions. |
| Release | 1 |
| Workspace | Public (also reachable after sign-in from Help, same journey) |
| Status | New (planned) for BankWorkx®. The pattern exists: CAB `locate-us` (`packages/journey-schema/src/fixtures/cab.ts`, draft, 5 screens) with adapters `cab.locations.search` and `cab.locations.details` (`packages/mock-bank-api/src/cab.ts`). |
| Channels | Web, mobile |
| Starting pattern | CAB `locate-us`: `search` → `filter` → `results` (a `map` block over a `menu` of found places) → `none` / `details`. The BankWorkx® version keeps the same screens and block use, changes miles-only distances and the sample places, and renames the adapters to `bank.locations.search` and `bank.locations.details` (planned, same request and response shape as the `cab.*` pair). |
| Who may use it | Anyone. No sign-in, no permission, no one-time code. |
| Money moving | No. |

The map is the existing schematic `map` block (pins on a grid by latitude and longitude, no streets or tiles, `docs/CAB.md`). A bank with a map provider replaces the drawing component; the journey does not change.

#### 2. Entry points

| Place | Label | Passes | Permission |
|---|---|---|---|
| Landing | Find a branch or ATM | `{kind}` (optional: `branch`, `atm`, `all`; default `branch`) | none |
| Landing › Explore | Find a branch or ATM | `{kind}` empty | none |
| Deep link | `/public/j/find-branch-atm?kind=atm` | `{kind}` | none |

README change needed: add "More › help › Find a branch or ATM" if the Personal app should show it after sign-in (not in the link map today; optional).

#### 3. Screens

**Screen `search` — "Find a branch or ATM"** (entry). `onEnter` sets `loc.kind` to the passed `{kind}` or `branch`, `loc.range` to `10`, `loc.searched` to `false`. Blocks: `textInput`, `select`, `button`, `button`.

| Label | Block | Required | Validation rule | Error message |
|---|---|---|---|---|
| Search (`loc.query`) | `textInput`, placeholder "Search by zip code, city, street" | No | At most 60 characters; letters, digits, spaces, `-`, `,`, `.` | "Use letters, numbers and spaces only, up to 60 characters." |
| Show (`loc.kind`) | `select`, variant `chips`: Branches (`branch`), ATMs (`atm`), All (`all`) | Yes (default Branches) | One of the three | "Choose what to show." |

Copy: Title "Find a branch or ATM". Helper under search: "Leave it empty to see everything within 10 miles of the sandbox centre (downtown San Francisco)." Real apps replace the centre with the person's location (see open questions).

| Button | Does | Leads to |
|---|---|---|
| Search | `validate`, `callApi` `locations` with kind, range and query, sets `loc.searched` | `results` if one or more found, `none` if zero (rules on `loc.found`, like CAB) |
| Filters | goes to `filter` | `filter` |
| Back | `exit` | Where the person came from |

States: Loading: Search button disabled with a spinner while the call runs. Empty: n/a. Error: below.

**Screen `filter` — "Filters"**. Blocks: `select` (range), `select` (kind), `button` Apply.

| Label | Block | Required | Rule | Error |
|---|---|---|---|---|
| Show (`loc.kind`) | `select`, `chips` | Yes | As above | "Choose what to show." |
| Search range (`loc.range`) | `select`, variant `dropdown`, choices "5 miles", "10 miles", "25 miles", "50 miles", "100 miles" | Yes | One of 5, 10, 25, 50, 100 | "Choose a search range." |

Apply runs the same search and leads to `results` or `none`. A "Reset" ghost button puts back Branches and 10 miles.

**Screen `results` — title follows the filter ("Branches", "ATMs" or "All")**. Blocks: `map` (`source: loc.found`, `label` "Places on the map", `onSelect` opens details), `menu` built from `loc.found` (label = name, text = address, icon `mapPin`), `button` Filters.

| Item | Content |
|---|---|
| Counter | "{n} places within {range} miles" (n = `len(loc.found)`) |
| Order | Nearest first (the adapter returns them in distance order) |
| Row tap or map pin tap | `callApi` `locationDetail` with `{id}`, then `details` |
| Row second line | "{address} · {miles} mi" |

States: Loading: the map shows a grey box and three row skeletons while the search runs. Error: toast "We couldn't search right now. Try again." and the person stays on `search` (the `showToast` of the CAB journey). With 50 or more results the list shows the nearest 50 and a line "Showing the nearest 50. Narrow your search to see others."

**Screen `none` — "No places found"**. Block `result` (tone error). Title "No places found". Text "Try a wider range or a different search." Button "Search again" → `search`.

**Screen `details` — "Find a branch or ATM"** (terminal). Blocks: `text` (name, title), `reviewSummary`, `button`, `button`, `dialog`.

| Row | Example: Market Street Branch |
|---|---|
| Status | Open (computed from hours and the bank's clock; "Closed" or "Open 24 hours") |
| Type | Branch |
| Distance | 0.8 miles |
| Address | 100 Market Street, San Francisco, CA 94105 |
| Hours | Mon to Fri 9:00 to 17:00, Sat 9:00 to 13:00, Sun closed (UTC in the sandbox) |
| Services | Make an appointment, Safe deposit, Foreign currency |

| Button | Does | Leads to |
|---|---|---|
| Call this branch | Sets `ui.call` true | Opens the dialog below |
| Get directions | `share` action with the address as text | The platform share sheet (mobile) or copies the address (web) |
| Back to results | `navigate` | `results` |

Dialog `dialer` (block `dialog`, `visibleWhen: ui.call`): icon `phone`, title "Call this branch", text "+1 415 555 0100". Buttons "Cancel" (secondary, closes) and "Call" (shows toast "Calling +1 415 555 0100…" in the sandbox; on a phone opens the dialer). Dismiss closes it.

Sample places in the sandbox (`bank.locations.search` seed). Hours are weekday opening times in UTC. The centre is 37.7879, -122.4012.

| Id | Kind | Name | Address | Miles | Hours | Services |
|---|---|---|---|---|---|---|
| `loc_market` | branch | Market Street Branch | 100 Market Street, San Francisco, CA 94105 | 0.8 | Mon to Fri 9:00 to 17:00, Sat 9:00 to 13:00 | Make an appointment, Safe deposit, Foreign currency |
| `loc_market_atm` | atm | Market Street ATM | 100 Market Street, San Francisco, CA 94105 | 0.8 | 24 hours | Deposit-taking ATM |
| `loc_mission` | branch | Mission Branch | 2400 Mission Street, San Francisco, CA 94110 | 2.6 | Mon to Fri 9:00 to 17:00 | Make an appointment |
| `loc_oakland` | branch | Oakland Lakeside Branch | 1200 Lakeshore Avenue, Oakland, CA 94610 | 11.4 | Mon to Fri 9:00 to 17:00, Sat 9:00 to 13:00 | Make an appointment, Safe deposit |
| `loc_airport_atm` | atm | Airport Terminal 2 ATM | Terminal 2, San Francisco Airport, CA 94128 | 14.9 | 24 hours | Deposit-taking ATM |
| `loc_sanjose` | branch | San Jose Downtown Branch | 88 Santa Clara Street, San Jose, CA 95113 | 48.0 | Mon to Fri 9:00 to 17:00 | Make an appointment |

Search rules (the same as `cab.locations.search`): `kind` is `branch`, `atm` or `all` (anything else counts as `all`); `rangeMiles` is a number above 0 (otherwise 10); a place matches when its miles are within the range, and the query (trimmed, lower case) is found in its name plus address. Details answer `LOCATION_NOT_FOUND` for an unknown id.

#### 4. Sandbox errors

| Code | Message the person sees | Shows on | Button |
|---|---|---|---|
| `LOCATION_NOT_FOUND` | "We can't find that place. It may have moved." | Toast, stays on `results` | Back to results |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | Toast on `search`, `filter` or `results`; on `details` an inline alert | Try again |
| `SERVICE_UNAVAILABLE` | S-`SERVICE_UNAVAILABLE` (README 1.6) | Same places | Try again |
| (empty list, not an error) | "Try a wider range or a different search." | `none` | Search again |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Error codes | Status | moneyMoving | requiresOtp |
|---|---|---|---|---|---|---|---|
| `locations` | `bank.locations.search` | `{ kind, rangeMiles, query }` | Record by id: `{ id, name, lat, lng, address, sub }` (nearest first) | `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned; pattern: existing `cab.locations.search`) | No | No |
| `locationDetail` | `bank.locations.details` | `{ id }` | `{ id, kind, name, address, lat, lng, miles, open, hours, phone, services, status, type, distanceMiles, country }` | `LOCATION_NOT_FOUND`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned; pattern: `cab.locations.details`) | No | No |

#### 6. Permissions, step-up and limits

None, step-up `none`. Limits: at most 50 results; range at most 100 miles. If the platform asks for location permission (planned "Use my location"), the answer is never stored.

#### 7. Result and links out

Result: the `details` screen. No receipt, no notification. Links out: Call this branch (dialer), Get directions (share), Back to results, and the screen's Back (exit to Landing). Where a place offers "Make an appointment" the row is text only in Release 1.

#### 8. Acceptance criteria

- AC-1: A search returns only places of the chosen kind within the chosen range, nearest first.
- AC-2: A text search matches name or address, ignoring case.
- AC-3: A search with no match shows "No places found" and a way to search again.
- AC-4: Opened with `{kind: "atm"}` the ATM chip is chosen.
- AC-5: Choosing a result (row or pin) shows its status, distance, address, hours and services.
- AC-6: Status is Open or Closed from the opening hours and the bank's clock; ATMs show "Open 24 hours".
- AC-7: "Call this branch" opens a dialer pop-up with the number, and Cancel closes it without calling.
- AC-8: A timeout and an unavailable service show their messages and allow a retry.

#### 9. Scenarios

Persona `sam` (no session). Sandbox clock `now: 2026-11-03T12:00:00Z` (a Tuesday) unless stated.

| Id | Covers | Setup / conditions | Steps | Expected |
|---|---|---|---|---|
| T-1 | AC-1 | – | Branches, 10 miles, Search | 2 results: Market Street Branch, Mission Branch, in that order; title "Branches" |
| T-2 | AC-1 | – | Filters: All, 25 miles | 5 results: Market Street Branch, Market Street ATM, Mission Branch, Oakland Lakeside Branch, Airport Terminal 2 ATM, nearest first (Market branch and ATM are tied at 0.8; branch first) |
| T-3 | AC-2 | – | Branches, query "MISSION" | 1 result: Mission Branch |
| T-4 | AC-3 | – | Query "zzzz" | `none` screen: "No places found"; "Search again" returns to `search` |
| T-5 | AC-4 | Start with `{kind: "atm"}` | Search | ATM chip chosen; 1 result (Market Street ATM) |
| T-6 | AC-5 | – | Open Market Street Branch | Type Branch, Distance 0.8 miles, address and hours as in the table, Services listed |
| T-7 | AC-6 | – | Open Market Street Branch at Tuesday 12:00 UTC; then `now: 2026-11-08T12:00:00Z` (Sunday) | Open; then Closed. Market Street ATM shows "Open 24 hours" in both |
| T-8 | AC-7 | – | Details, Call this branch, Cancel | Pop-up shows "+1 415 555 0100"; after Cancel it is gone and no toast appears |
| T-9 | AC-8 | `conditions.timeout: ["bank.locations.search"]` | Search | Toast with the timeout message; person stays on `search` |
| T-10 | AC-8 | `conditions.unavailable: ["bank.locations.details"]` | Open a result | Unavailable message; Try again works once cleared |

#### 10. Expected mutation-check survivors

| Survivor | Why it stays alive |
|---|---|
| `LOCATION_NOT_FOUND` check removed in details | Only ids from the search can be tapped; no scenario sends an unknown id. |
| Changing the 50-result cap | The seed has six places; the cap cannot be reached. |

---

### ★ Contact us — `contact-support`

#### 1. Summary

| | |
|---|---|
| Slug | `contact-support` |
| Purpose | Reach the bank before signing in: answers to common questions, phone numbers with opening hours, and a call-back request. |
| Release | 1 |
| Workspace | Public |
| Status | New (planned). Pattern exists: CAB `support` (`fixtures/cab.ts`, draft) with FAQs as one accordion screen of six topics, Terms and Privacy text screens, a Call-us dialer `dialog`, and opening hours as `reviewSummary` rows. |
| Channels | Web, mobile |
| Starting pattern | CAB `support`. BankWorkx® adds a call-back form (`callback`) because a person with a problem before sign-in has no secure messages. |
| Who may use it | Anyone. No sign-in, no permission, no one-time code. |
| Money moving | No. |

New adapter: `bank.support.callback` (planned). The FAQ text is built into the journey (as in CAB; the content team replaces the sample answers).

#### 2. Entry points

| Place | Label | Passes | Permission |
|---|---|---|---|
| Landing | Contact us | – | none |
| Landing › Explore | Contact us | – | none |
| Sign-in screen | Help (README change needed; not in the link map) | – | none |
| Deep link | `/public/j/contact-support` | – | none |

#### 3. Screens

**Screen `home` — "Contact us"** (entry). `onEnter` sets `ui.call` to `false`. Blocks: `menu`, `reviewSummary`, `button`, `button`, `dialog`.

| Row (menu) | Text | Leads to |
|---|---|---|
| FAQs | Answers to common questions | `faqs` |
| Ask us to call you | We'll call you in a time you choose | `callback` |
| Terms and conditions | Version 2026-10 | Ends the journey and opens Shell: Legal pages, `terms` |
| Privacy notice | How we use your information | Ends the journey and opens Shell: Legal pages, `privacy` |

Opening hours (`reviewSummary`, times in UTC in the sandbox): "Monday to Friday" "8:00 to 20:00"; "Saturday" "9:00 to 17:00"; "Sunday" "Closed". A line: "Lost or stolen card? Call any time: +1 800 555 0111."

| Button | Does | Leads to |
|---|---|---|
| Call us | Sets `ui.call` true | Opens dialer |
| Back | `exit` | Where the person came from |

Dialer `dialog`: icon `phone`, title "Call us", text "+1 800 555 0100"; buttons "Cancel" (closes) and "Call" (toast "Calling the bank…" in the sandbox; opens the phone's dialer on a phone, then closes). A second dialer row for the card line is offered inside the same dialog as a text line: "Lost or stolen card: +1 800 555 0111".

**Screen `faqs` — "FAQs"**. Blocks: `accordion` with six topics, a `text` caption "Sample answers: the bank's content team replaces these with approved text." and Back.

| Topic | Question | Answer |
|---|---|---|
| Opening an account | Who can open an account? | You must be 18 or older, live in the United States and have a photo ID. Use Open an account on the start screen. It takes about 10 minutes. |
| Opening an account | Can I stop and come back? | Yes. Choose Save and continue later. We keep your application for 30 days. |
| Signing in | I have an account but no online login. What do I do? | Choose Register for digital banking. You'll need your card or account number and your phone. |
| Cards | I lost my card. What do I do? | Call +1 800 555 0111 at any time. We'll block the card straight away. |
| Payments | When is my payment sent? | Payments made before the daily cut-off are sent the same working day. |
| Fees and rates | Where can I see today's exchange rates? | On the start screen, choose Explore, then Exchange rates. |
| Security | Will the bank ever ask for my password? | Never. We will never ask for your password or full one-time code by phone, text or email. |

The accordion's six groups are Opening an account, Signing in, Cards, Payments, Fees and rates, Security (the table lists seven questions across them). Opening one group closes the others.

**Screen `callback` — "Ask us to call you"**. Blocks: `text`, `textInput` x2, `select` x2, `alert`, `button`.

| Label | Block | Required | Validation rule | Error message |
|---|---|---|---|---|
| Your name (`cb.name`) | `textInput` | Yes | 2 to 60 characters; letters, spaces, `-`, `'`, `.` | "Enter your name (2 to 60 letters)." |
| Phone number (`cb.phone`) | `textInput`, keyboard `phone`, placeholder "+1 415 555 0100" | Yes | 10 to 15 digits, may start with `+`, spaces and dashes allowed (pattern `^\+?[0-9 -]{10,18}$` and 10 to 15 digits after removing symbols) | "Enter a phone number with 10 to 15 digits." |
| What is it about? (`cb.topic`) | `select`, variant `dropdown`: Opening an account (`open`), Signing in or registering (`signin`), A card (`card`), A payment (`payment`), Something else (`other`) | Yes | One of the five | "Choose a topic." |
| Best time (`cb.window`) | `select`, `chips`: Morning 9:00 to 12:00 (`am`), Afternoon 12:00 to 17:00 (`pm`), Evening 17:00 to 20:00 (`eve`) | Yes | One of the three | "Choose a time." |

Copy: Title "We'll call you". Body "Tell us when to call. We'll call the number you give, within the time you choose." Alert (info): "We will never ask for your password or a full one-time code on the phone." Button "Request a call" (validate, then `callApi` `callback`) → `callbackDone`. Ghost button "Back" → `home`.

**Screen `callbackDone` — "Request received"** (terminal). `result` tone success. Title "We'll call you". Text "We'll call {maskedPhone} {when} between {from} and {to}. If you miss us we'll try once more." Meta: "Reference {reference}". {when} is "today" if the window is still ahead and the bank is open, else "on {next working day}". Buttons: "Done" (`exit`).

#### 4. Sandbox errors

| Code | Message the person sees | Shows on | Button |
|---|---|---|---|
| `PHONE_INVALID` | "Enter a phone number with 10 to 15 digits." | `callback`, under the phone | Change number |
| `TOPIC_INVALID` | "Choose a topic." | `callback` | Choose topic |
| `WINDOW_INVALID` | "Choose a time." | `callback` | Choose time |
| `CALLBACK_EXISTS` | "We already have a request for this number. We'll call by {expectedBy}." | `callback`, alert above the button | Done (exit) / Change number |
| `RATE_LIMITED` | "You've asked for a call back too many times today. Please call us on +1 800 555 0100." | `callback`, alert | Call us (opens dialer) |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | `callback`, alert | Try again |
| `SERVICE_UNAVAILABLE` | S-`SERVICE_UNAVAILABLE` (README 1.6) | `callback`, alert | Try again |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Error codes | Status | moneyMoving | requiresOtp |
|---|---|---|---|---|---|---|---|
| `callback` | `bank.support.callback` | `{ name, phone, topic, window }` | `{ reference: "CB-20261103-0001", maskedPhone: "••••••0100", window, expectedBy }` | `PHONE_INVALID`, `TOPIC_INVALID`, `WINDOW_INVALID`, `CALLBACK_EXISTS`, `RATE_LIMITED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned) | No | No |

Sandbox rules: one open request per phone number (a second gets `CALLBACK_EXISTS`); at most 3 requests per phone number per sandbox day (a fourth gets `RATE_LIMITED`); the phone is stored masked in logs. Business outcomes come back as data (`{ ok: false, code }`) like the `cab.*` adapters, so the journey can route on them. A bot check (the "picture code" of the CAB access journeys) is not in Release 1; see open questions.

#### 6. Permissions, step-up and limits

None, step-up `none`. Limits: 3 call-back requests per phone number per day.

#### 7. Result and links out

Result: `callbackDone` (reference `CB-<date>-<n>`). Receipt: none. Notification: a text message to the number: "BankWorkx®: we've got your call-back request (CB-20261103-0001)." (planned, sandbox only records it). Links out: Done; Terms and Privacy open Shell: Legal pages.

#### 8. Acceptance criteria

- AC-1: The home screen shows the opening hours and the four rows.
- AC-2: FAQs show six groups; opening one closes the others.
- AC-3: "Call us" opens a pop-up with the number; Cancel closes it without a call.
- AC-4: A valid call-back request gives a reference and a message naming the chosen time.
- AC-5: A phone number with fewer than 10 or more than 15 digits is refused with the phone message.
- AC-6: A second request for the same number is refused and says when the bank will call.
- AC-7: A fourth request for the same number in one day is refused and offers the phone number.
- AC-8: A timeout and an unavailable service show their messages and allow a retry; no request is recorded.
- AC-9: Terms and Privacy open the Legal pages.

#### 9. Scenarios

Persona `sam`, no session, `now: 2026-11-03T10:00:00Z`.

| Id | Covers | Setup / conditions | Steps | Expected |
|---|---|---|---|---|
| T-1 | AC-1 | – | Open the journey | Four rows; hours "8:00 to 20:00", "9:00 to 17:00", "Closed"; card line text |
| T-2 | AC-2 | – | FAQs, open "Security", then "Cards" | Six groups; only "Cards" is open at the end |
| T-3 | AC-3 | – | Call us, Cancel | Pop-up shows "+1 800 555 0100"; no toast after Cancel |
| T-4 | AC-4 | – | Name "Sam Rivera", phone "+1 415 555 0199", topic Opening an account, Afternoon, Request a call | Reference `CB-20261103-0001`; text "We'll call ••••••0199 today between 12:00 and 17:00." |
| T-5 | AC-5 | – | Phone "12345", then "1234567890123456" | Phone message both times; adapter not called |
| T-6 | AC-6 | After T-4 | Same number again | `CALLBACK_EXISTS` message with the expected time |
| T-7 | AC-7 | Sandbox holds 3 requests made today for `+1 415 555 0199`, none open | Fourth request | `RATE_LIMITED` message and the Call us button |
| T-8 | AC-8 | `conditions.timeout: ["bank.support.callback"]` | Request a call | Timeout message; clearing the condition and pressing Try again gives the reference; only one request exists |
| T-9 | AC-8 | `conditions.unavailable: ["bank.support.callback"]` | Request a call | Unavailable message; no reference |
| T-10 | AC-9 | – | Terms and conditions row | Journey ends; Legal pages open on `terms` |

#### 10. Expected mutation-check survivors

| Survivor | Why it stays alive |
|---|---|
| FAQ answer text changed | The scenarios check the group titles and the one-open rule, not the sample answers (they are placeholders for the content team). |
| `TOPIC_INVALID` / `WINDOW_INVALID` removed in the adapter | The dropdown and chips only offer valid values. |

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

#### 1. Summary

| | |
|---|---|
| Slug | `track-application` |
| Purpose | A new customer looks up an application they made with `open-account`, sees where it is in a timeline, answers a request for more information, and when the account is open, goes on to activate digital banking. |
| Release | 1 |
| Workspace | Public |
| Status | New (planned) |
| Channels | Web, mobile |
| Starting pattern | CAB `enroll` for "identify the person with details, then show a result" (`fixtures/cab.ts`, adapters `cab.enroll.retail`); the `otp` screens of `local-transfer` for the code step. The timeline needs the `timeline` and `statusChip` blocks (planned, batch A). |
| Who may use it | The applicant, proved by application number, date of birth and a one-time code. No sign-in. |
| Money moving | No. Security journey: it shows personal application data, so a code is required. |

New adapters (planned): `bank.onboarding.lookup`, `bank.onboarding.status` (and the shared `bank.onboarding.get` from `open-account`). Reuses `bank.otp.verify`.

#### 2. Entry points

| Place | Label | Passes | Permission |
|---|---|---|---|
| Landing | Track my application | `{applicationId}` optional | none |
| Notification (any channel) | Application update | `{applicationId}` | none (the code is still asked) |
| `open-account` result (`submitted`, `saved`) | Track my application | `{applicationId}` | none |
| Deep link | `/public/j/track-application?applicationId=APP-20261103-0042` | `{applicationId}` | none |

#### 3. Screens

**Screen `find` — "Track my application"** (entry). Blocks: `text`, `textInput`, `datePicker` (planned; `dateInput` until then), `alert`, `button`.

| Label (bind) | Block | Required | Rule | Error |
|---|---|---|---|---|
| Application number (`ta.applicationId`) | `textInput`, prefilled from `{applicationId}`, pattern `^APP-[0-9]{8}-[0-9]{4}$` | Yes | Looks like `APP-20261103-0042` | "Enter your application number, like APP-20261103-0042." |
| Date of birth (`ta.dob`) | `datePicker` (typed `DD / MM / YYYY` until it exists) | Yes | A real date in the past, person at least 16 years old | "Enter your date of birth as DD / MM / YYYY." |

Copy: Title "Track my application". Body "Enter the number we sent you and your date of birth. We'll text you a code." Alert (info): "We keep applications for 30 days after you last worked on them." Button "Send me a code": `validate`, `callApi` `lookup` → `code`. Ghost "I don't have my number" → shows text "Check your email and texts from BankWorkx®, or call us" with a Contact us button (`toJourney: contact-support`).

**Screen `code` — "Enter your code"**. Blocks: `otp` (6 digits, `maxAttempts: 3`), `button`.

Copy: Title "Enter your code". Body "We sent a 6-digit code to {maskedPhone}." Helper "You can ask for a new code in 30 seconds." Button "Show my application": `callApi` `otpVerify` (id exactly `otpVerify`) then `callApi` `status` → `status`. Ghost "Send a new code". Third wrong code: S-`OTP_INVALID` third form, button "Start again" → `find`.

**Screen `status` — "Your application"**. Blocks: `statusChip` (planned), `reviewSummary`, `timeline` (planned), `alert`, `button`s. The screen refreshes when the person pulls down (mobile) or presses "Refresh" (web). It does not refresh by itself.

Header rows (`reviewSummary`): "Application" `{applicationId}`; "Account" `{productName}`; "Submitted" `{submittedAt}` (for example `3 Nov 2026 10:12 UTC`); "Status" chip.

Timeline steps (planned `timeline`; `state` is `done`, `current`, `upcoming` or `attention`):

| # | Step | Meaning |
|---|---|---|
| 1 | Submitted | We have your application |
| 2 | ID and documents | We check your ID and your documents |
| 3 | Final checks | Tax and safety checks |
| 4 | Decision | We say yes or no |
| 5 | Account ready | Your account is open |
| 6 | Digital banking | You activate your login |

What each status shows:

| Status | Chip | Current step | Title | Text | Buttons |
|---|---|---|---|---|---|
| `draft` | Not sent | none | "You haven't sent this yet" | "Your application is saved until {expiresOn}." | Continue application (`toJourney: open-account`, `{applicationId}`) |
| `submitted` | Received | 1 done, 2 current | "We've got your application" | "We'll start checking it soon. This usually takes 1 to 2 working days." | Refresh, Contact us |
| `in_review` | Checking | 2 or 3 current | "We're checking your details" | "Nothing for you to do right now." | Refresh, Contact us |
| `more_info` | We need something | 2 attention | "We need one more thing" | The bank's request, for example "Your proof of address is older than 3 months. Please upload a newer one." | Upload documents (`toJourney: open-account`, `{applicationId}`, opens on `documents`) |
| `approved` | Approved | 4 done, 5 current | "Good news, you're approved" | "We're opening your account." | Refresh |
| `account_opened` | Ready | 5 done, 6 current | "Your account is open" | "Account {maskedAccount}. One last step: set up your online login." | **Activate digital banking** (`toJourney: register-digital-banking`, `{applicationId}`) |
| `activated` | Active | all done | "You're all set" | "Sign in with the username you chose." | Sign in (`toJourney: sign-in`) |
| `rejected` | Not approved | 4 attention | "We couldn't open your account" | "We can't open an account for you right now. We're sorry. Nothing was charged." | Contact us |
| `expired` | Expired | none | "This application has expired" | "Applications are kept for 30 days." | Start a new application (`toJourney: open-account`) |

Empty: not possible (a found application always has a status). Loading: header and timeline skeletons. Error and locked states below.

**Screen `locked` — "Too many tries"** (terminal). `result` (error). Title "Too many tries". Text "For your security, try again in 30 minutes, or call us." Buttons "Contact us" (`toJourney: contact-support`), "Done".

#### 4. Sandbox errors

| Code | Message the person sees | Shows on | Button |
|---|---|---|---|
| `APPLICATION_NOT_FOUND` | "We couldn't find an application with those details. Check the number and your date of birth. {n} tries left." (same message whether the number or the date is wrong) | `find`, alert | Change details |
| `LOOKUP_LOCKED` | "Too many tries. For your security, try again in 30 minutes, or call us." | `locked` | Contact us |
| `OTP_INVALID` | "That code isn't right. {n} tries left." After the third: "Too many wrong codes. Start again." | `code` | Try again / Start again |
| `OTP_REQUIRED` | "Confirm with your one-time code first." | `code` (when `status` is asked for without a verified code) | Back to code |
| `APPLICATION_EXPIRED` | "This application has expired. Start a new one." | `status` (chip Expired) | Start a new application |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | The step that was running, as an alert | Try again |
| `SERVICE_UNAVAILABLE` | S-`SERVICE_UNAVAILABLE` (README 1.6) | The step that was running | Try again |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Error codes | Status | moneyMoving | requiresOtp |
|---|---|---|---|---|---|---|---|
| `lookup` | `bank.onboarding.lookup` | `{ applicationId, dob }` | `{ ok: true, maskedPhone }` and sends a code (as `bank.otp.send`), or `{ ok: false, code, attemptsLeft? }` | `APPLICATION_NOT_FOUND`, `LOOKUP_LOCKED` | (planned) | No | No (it starts the code) |
| `otpVerify` | `bank.otp.verify` | `{ code }` | `{ verified: true }` | `OTP_INVALID` | Existing | No | No |
| `status` | `bank.onboarding.status` | `{ applicationId }` | `{ applicationId, status, productId, productName, submittedAt, expiresOn?, steps: [{ id, label, state, at? }], message?, maskedAccount? }` | `OTP_REQUIRED`, `APPLICATION_NOT_FOUND`, `APPLICATION_EXPIRED` | (planned) | No | Yes (read) |

Sandbox rules: 3 failed lookups for one application number lock it for 30 minutes (the same limits as the CAB access journeys: 3 mistakes, 30 minutes); a verified code stays valid for the visit and does not expire during the journey; the application's status is stored and changes only when a scenario or the sandbox panel sets it (button "Move to next step"). Seeded applications (all with date of birth 14 Mar 1992 and Sam's mobile):

| Number | Status | Notes |
|---|---|---|
| `APP-20261103-0042` | `submitted` | Everyday Account, submitted 3 Nov 2026 10:12 UTC (the application made in the `open-account` scenario) |
| `APP-20261028-0017` | `in_review` | Aurora Savings |
| `APP-20261020-0007` | `more_info` | Message: "Your proof of address is older than 3 months. Please upload a newer one." |
| `APP-20261015-0003` | `account_opened` | Everyday Account, `maskedAccount` `••9021` |
| `APP-20260915-0002` | `activated` | Everyday Account |
| `APP-20261001-0001` | `rejected` | |
| `APP-20261030-0021` | `draft` | Expires 29 Nov 2026 |
| `APP-20260901-0005` | `expired` | |

#### 6. Permissions, step-up and limits

No permission, no session. Step-up `otp` before any application data is shown. Limits: 3 code tries, 3 lookups then a 30-minute lock. Only the application number, status, product, dates and the bank's request are returned; the tax number, ID images and files never are.

#### 7. Result and links out

Result: `status`. No receipt (the receipt is made at submission by `open-account`). Notifications: the bank sends "Application update" messages (email, text and push if the app is installed) when the status changes: "We're checking your application" (to `in_review`), "We need one more thing" (to `more_info`), "Your account is open" (to `account_opened`), "We couldn't open your account" (to `rejected`); each links to this journey with `{applicationId}`. Links out: Continue application and Upload documents (`open-account`), Activate digital banking (`register-digital-banking`, `{applicationId}`), Sign in (`sign-in`), Contact us (`contact-support`). README changes needed: add "Application tracker › Continue application / Upload documents" (`open-account`, `{applicationId}`) and "Application tracker › Activate digital banking" (`register-digital-banking`, `{applicationId}`).

#### 8. Acceptance criteria

- AC-1: An application is shown only after the application number, date of birth and a one-time code are all right.
- AC-2: A wrong number or date gives one message that does not say which is wrong; three failures lock the lookup for 30 minutes.
- AC-3: A wrong code is counted; the third ends the step.
- AC-4: Each status shows its chip, its current timeline step, its title, text and buttons as in the table.
- AC-5: In `more_info` the bank's request is shown and "Upload documents" opens `open-account` on the documents step.
- AC-6: In `account_opened` the masked account is shown and "Activate digital banking" opens `register-digital-banking` with the application number.
- AC-7: A `rejected` application shows no reason beyond the standard text.
- AC-8: Asking for the status without a verified code is refused.
- AC-9: A timeout and an unavailable service each show their message and allow a retry.
- AC-10: Opened from a notification with `{applicationId}`, the number is prefilled but the code is still required.

#### 9. Scenarios

Persona `sam` (code `123456`). Date of birth `14/03/1992` unless stated.

| Id | Covers | Setup / conditions | Steps | Expected |
|---|---|---|---|---|
| T-1 | AC-1, AC-4 | – | `APP-20261103-0042`, correct date, code `123456` | Chip Received; step 1 done, step 2 current; title "We've got your application" |
| T-2 | AC-2 | – | Right number, wrong date `15/03/1992` three times | Messages with 2, 1 tries left; third: `locked` screen; a fourth try with the right date is still refused |
| T-3 | AC-2 | – | Unknown number `APP-20261103-9999` | Same message text as T-2 |
| T-4 | AC-3 | – | Wrong code three times | S-`OTP_INVALID` messages; third: "Too many wrong codes. Start again." |
| T-5 | AC-4 | Status set to each of `in_review`, `approved`, `rejected`, `expired`, `draft`, `activated` in turn | Open | Chip, title, text, buttons as in the table |
| T-6 | AC-5 | `APP-20261020-0007` | Open, press Upload documents | Request text shown; `open-account` opens on `documents` with `{applicationId}` |
| T-7 | AC-6 | `APP-20261015-0003` | Open, press Activate digital banking | Shows `••9021`; `register-digital-banking` opens with `applicationId` passed and skips the card or account step |
| T-8 | AC-7 | `APP-20261001-0001` | Open | Standard text only; no reason, no score |
| T-9 | AC-8 | – | Scenario calls `bank.onboarding.status` before the code | `OTP_REQUIRED` |
| T-10 | AC-9 | `conditions.timeout: ["bank.onboarding.status"]`, `latencyMs: 10000` | Enter correct code | Timeout message; Try again after clearing shows the status |
| T-11 | AC-9 | `conditions.unavailable: ["bank.onboarding.lookup"]` | Send me a code | Unavailable message; no code sent |
| T-12 | AC-10 | Start with `{applicationId: "APP-20261103-0042"}` | Open | Number prefilled; date empty; code still required before status shows |

#### 10. Expected mutation-check survivors

| Survivor | Why it stays alive |
|---|---|
| The 30-minute lock length | The sandbox clock is not advanced past 30 minutes in a scenario. |
| Wording of the rejected text | Scenarios assert that no reason is shown, not the exact apology. |
| `APPLICATION_EXPIRED` on `status` for a draft past 30 days | T-5 sets the status directly; the date rule is covered in `open-account` T-15. |

---

### ★ Register for digital banking — `register-digital-banking`

#### 1. Summary

| | |
|---|---|
| Slug | `register-digital-banking` |
| Purpose | An existing customer who has an account or card but no online login proves who they are, confirms a code sent to their phone, chooses a username and password, and optionally remembers the device. A new customer who just got their account arrives from `track-application` already identified. |
| Release | 1 |
| Workspace | Public |
| Status | New (planned) |
| Channels | Web, mobile |
| Starting pattern | CAB `enroll` (picture code, identify, outcomes `NOT_FOUND`, `ALREADY_ENROLLED`) and CAB `activate-profile` (create the password under the bank's rules), `packages/journey-schema/src/fixtures/cab.ts`; sandbox `cab.captcha.generate`, `cab.enroll.retail`, `cab.password.policy` and `cab.activate.setPassword` (`packages/mock-bank-api/src/cab.ts`). The BankWorkx® versions are `bank.captcha.generate`, `bank.registration.identify`, `bank.password.policy` and `bank.registration.complete` (planned). |
| Who may use it | A customer of the bank with no digital banking login. Persona `jordan` (planned, below). Alex Morgan is already registered, so the already-registered path uses `alex`. |
| Money moving | No. Security journey: it creates credentials. |

New persona (planned, sandbox seed): **Jordan Lee** (`jordan`), existing customer, not registered. Phone `+1 415 555 0177`, one-time code `482100`, date of birth 22 Jul 1988. Everyday Account ••2208, account number `7700002208`, balance USD 1,846.20. Debit card `5555 5555 5555 4444`, expiry `08/29`, active. Old card `4242 4242 4242 4242`, expiry `03/27`, blocked (reported lost). Alex Morgan's identifiers for the already-registered path: account number `7700004410`, date of birth 9 Jan 1986.

New adapters: `bank.captcha.generate`, `bank.captcha.verify`, `bank.registration.identify`, `bank.password.policy`, `bank.registration.complete`, `bank.device.bind` (all planned). Reuses `bank.otp.send`, `bank.otp.verify`.

#### 2. Entry points

| Place | Label | Passes | Permission |
|---|---|---|---|
| Landing | Register for digital banking | – | none |
| Sign-in screen | Register | – | none |
| `track-application` (status `account_opened`) | Activate digital banking | `{applicationId}` | none |
| `open-account` | "Already a customer? Register for digital banking" link | – | none |
| Deep link | `/public/j/register-digital-banking` | – | none |

Leads to: `sign-in` (README 5.1: register ends in sign-in).

#### 3. Screens

Happy path: `intro` → `identifyCard` or `identifyAccount` → `verify` → `credentials` → `device` → `done`. With `{applicationId}` the path is `intro` (skipped) → `verify` → `credentials` → `device` → `done`.

**Screen `intro` — "Register for digital banking"** (entry). Blocks: `text`, `select` (tiles), `alert`, `button`.

| Label (bind) | Block | Required | Rule | Error |
|---|---|---|---|---|
| How do you want to prove it's you? (`rg.method`) | `select`, `tiles`: "My card" (`card`), "My account number" (`account`) | Yes | One of two | "Choose how you'd like to start." |

Copy: Title "Register for digital banking". Body "Use your card or account number, then confirm with your phone. It takes about 3 minutes." Alert (info): "You need to be a BankWorkx® customer. If you're new, open an account first." Links: "Open an account" (`toJourney: open-account`), "I already have a login" (`toJourney: sign-in`). Button "Continue": `validate` → `identifyCard` or `identifyAccount`. When `{applicationId}` is passed this screen is skipped: `onEnter` calls `identify` with `method: "application"` and goes to `verify`.

**Screen `identifyCard` — "Your card"**. Blocks: `textInput` x3, `dateInput`/`datePicker`, `text`, `textInput` (picture code), `button`, `button`.

| Label (bind) | Block | Required | Rule | Error |
|---|---|---|---|---|
| Card number (`rg.card`) | `textInput`, keyboard `number`, pattern `^[0-9]{4} ?[0-9]{4} ?[0-9]{4} ?[0-9]{4}$` | Yes | 16 digits, spaces allowed, passes the Luhn check (`4242 4242 4242 4242` and `5555 5555 5555 4444` pass) | Pattern: "Enter the 16 digits on the front of your card." Luhn: "That card number isn't right. Check the 16 digits." |
| Expiry (`rg.expiry`) | `textInput`, pattern `^(0[1-9]\|1[0-2]) ?/ ?[0-9]{2}$` | Yes | MM / YY | "Enter the expiry as MM / YY." |
| Date of birth (`rg.dob`) | `datePicker` (typed `DD / MM / YYYY` today, `dateInput` in the working tree) | Yes | A real date in the past | "Enter your date of birth as DD / MM / YYYY." |
| Picture code (`rg.captcha`) | `textInput`, placeholder "Enter the above text here", the code shown in a `text` block above (sandbox shows it as text, as CAB does) | Yes | Equals the code shown (case-insensitive) | "That code doesn't match. Check it or ask for a new one." |

Copy: Title "Your card". Body "Enter the details exactly as they appear on your debit card. We never ask for your PIN or the 3 digits on the back." Buttons: "New code" (ghost; runs `captcha` again), "Continue" (`validate`, `callApi` `identify`, which also sends the code) → `verify`; ghost "Use my account number instead" → `identifyAccount`. On `onEnter` the screen calls `captcha`.

**Screen `identifyAccount` — "Your account number"**. Same as above with the first two fields replaced:

| Label (bind) | Block | Required | Rule | Error |
|---|---|---|---|---|
| Account number (`rg.account`) | `textInput`, keyboard `number`, pattern `^[0-9]{10}$` | Yes | 10 digits | "Enter your 10-digit account number." |
| Date of birth (`rg.dob`) | as above | Yes | as above | as above |
| Picture code (`rg.captcha`) | as above | Yes | as above | as above |

Copy: Title "Your account number". Body "You can find it on a statement or in your welcome letter." Ghost "Use my card instead" → `identifyCard`.

**Screen `verify` — "Enter your code"**. Blocks: `otp` (6 digits, `maxAttempts: 3`), `text`, `button`.

Copy: Title "Enter your code". Body "We sent a 6-digit code to {maskedPhone}. It's the number we have on file." Helper "No access to that phone? Call us on +1 800 555 0100." Button "Verify": `callApi` `otpVerify` (id exactly `otpVerify`) → `credentials`. Ghost "Send a new code" after 30 seconds. Third wrong code: S-`OTP_INVALID` third form; button "Start again" → `intro`. The registration session lasts 15 minutes from `identify`; after that `REGISTRATION_EXPIRED`.

**Screen `credentials` — "Choose your login"**. Blocks: `textInput` x3, `text` x5 (rules), `alert`, `button`. `onEnter` calls `policy`.

| Label (bind) | Block | Required | Rule | Error |
|---|---|---|---|---|
| Username (`rg.username`) | `textInput` | Yes | 6 to 30 characters; letters, digits, `.`, `_`, `-`; starts with a letter; not case-sensitive; not already used | Format: "Use 6 to 30 letters, numbers, dots, dashes or underscores. Start with a letter." Taken: "That username is taken. Try another." |
| New password (`rg.password`) | `textInput`, `secure` | Yes | The bank's rules (below) | Per rule, below |
| Re-enter your new password (`rg.confirm`) | `textInput`, `secure` | Yes | Equals the password | "The two passwords don't match." |

Security requirements shown as a live list (`text`, caption), values from `policy`: "Password must contain {differentChars} different characters", "Password must contain at least {minLength} characters", "Password must not exceed {maxLength} characters", "Password must not contain username". Rules (the same as `cab.password.policy`): at least 8 characters, at most 100, at least 5 different characters, must not contain the username (ignoring case). Messages per problem code (shown together, one line each): `MIN_LENGTH` "Use at least 8 characters.", `MAX_LENGTH` "Use 100 characters or fewer.", `DIFFERENT_CHARS` "Use at least 5 different characters.", `CONTAINS_USERNAME` "Your password must not contain your username." Alert (error) for `POLICY` repeats "That password doesn't meet the security requirements." above those lines. Button "Create my login": `validate`, `callApi` `complete` → `device`. The demo password `Bwx!Demo2026` passes all four rules.

**Screen `device` — "Remember this device?"**. Blocks: `toggle`, `textInput`, `alert`, `button`, `button`.

| Label (bind) | Block | Required | Rule | Error |
|---|---|---|---|---|
| Remember this device (`rg.remember`) | `toggle` (default off), helper "Next time we'll ask for an extra code only on devices we don't know." | Yes | – | – |
| Device name (`rg.deviceName`) | `textInput`, shown when the toggle is on, default from the platform ("Jordan's iPhone") | Yes when shown | 2 to 30 characters, letters, digits, spaces, `'`, `-` | "Name this device with 2 to 30 letters or numbers." |

Copy: Title "Remember this device?". Body "Only do this on a phone or computer that is yours." Alert (info): "You can set up your fingerprint, face or a quick PIN after you sign in." Buttons: "Remember this device" (primary; `validate`, `callApi` `bind`) → `done`; "Not now" (ghost) → `done` without a call.

**Screen `done` — "You're registered"** (terminal). `result` (success). Title "You're registered". Text "Sign in with the username {username} and your new password." Meta "Registered {registeredAt}". Buttons: "Sign in" (`toJourney: sign-in`, `{username}`) and, in an `exit` ghost button, "Done". If the device was bound the text adds "This device is remembered as {deviceName}."

**Screen `alreadyRegistered` — "You're already registered"** (terminal). `result` (tone success; the wording is neutral). Title "You're already registered". Text "Sign in with your username. If you've forgotten it or your password, we can help." Buttons "Sign in" (`toJourney: sign-in`), "Forgot username" (`toJourney: forgot-username`), "Forgot password" (`toJourney: reset-password`). Shown only after the card or account details and the date of birth matched, so it does not tell a stranger who banks with us.

**Screen `locked` — "Too many tries"** (terminal). `result` (error). Title "Too many tries". Text "For your security, try again in 30 minutes, or call us." Buttons "Contact us" (`toJourney: contact-support`), "Done".

States: Loading: buttons disabled with a spinner; the picture code shows "-----" while loading (as CAB). 10 seconds without an answer shows the step's timeout alert. Empty: n/a.

#### 4. Sandbox errors

| Code | Message the person sees | Shows on | Button |
|---|---|---|---|
| `CARD_INVALID` | "That card number isn't right. Check the 16 digits." (does not count as a try) | `identifyCard` | Change card number |
| `CAPTCHA_WRONG` | "That code doesn't match. Check it or ask for a new one." | `identifyCard`, `identifyAccount` | New code |
| `NOT_FOUND` | "We couldn't match those details. Check them and try again. {n} tries left." (same for any wrong card, account number, expiry or date) | `identifyCard`, `identifyAccount`, alert | Change details |
| `LOCKED` | "Too many tries. For your security, try again in 30 minutes, or call us." | `locked` | Contact us |
| `CARD_BLOCKED` | "This card is blocked. Use your account number instead, or call us." | `identifyCard`, alert | Use my account number |
| `ACCOUNT_CLOSED` | "This account is closed. Contact us if you think that's wrong." | `identifyAccount`, alert | Contact us |
| `ALREADY_REGISTERED` | "You're already registered." (screen text above) | `alreadyRegistered` | Sign in |
| `OTP_INVALID` | "That code isn't right. {n} tries left." After the third: "Too many wrong codes. Start again." | `verify` | Try again / Start again |
| `OTP_REQUIRED` | "Confirm with your one-time code first." | `credentials` (if `complete` is called without it) | Back to code |
| `REGISTRATION_EXPIRED` | "This took too long and was closed for your security. Start again." | `intro` (sent back) | Start again |
| `USERNAME_INVALID` | "Use 6 to 30 letters, numbers, dots, dashes or underscores. Start with a letter." | `credentials` | Change username |
| `USERNAME_TAKEN` | "That username is taken. Try another." | `credentials` | Change username |
| `MISMATCH` | "The two passwords don't match." | `credentials` | Re-enter |
| `POLICY` | "That password doesn't meet the security requirements." with the per-problem lines | `credentials` | Change password |
| `DEVICE_NAME_INVALID` | "Name this device with 2 to 30 letters or numbers." | `device` | Change name |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." On `complete` the text adds: "If you can't sign in later, register again." | The step that was running | Try again |
| `SERVICE_UNAVAILABLE` | S-`SERVICE_UNAVAILABLE` (README 1.6) | The step that was running | Try again / Back |

As in CAB, business outcomes (`NOT_FOUND`, `CAPTCHA_WRONG`, `ALREADY_REGISTERED`, `MISMATCH`, `POLICY`, `USERNAME_TAKEN`, `LOCKED`) come back as data `{ ok: false, code }` so the journey routes on them; misuse throws.

#### 5. Adapters

| Integration id | Adapter | Request | Response | Error codes | Status | moneyMoving | requiresOtp |
|---|---|---|---|---|---|---|---|
| `captcha` | `bank.captcha.generate` | – | `{ serviceKey, text }` (the sandbox shows the text) | `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned; pattern `cab.captcha.generate`) | No | No |
| `identify` | `bank.registration.identify` | `{ method: "card" \| "account" \| "application", card?, expiry?, account?, dob?, applicationId?, captchaKey, captchaValue }` | `{ ok: true, registrationId, firstName, maskedPhone }` and sends a code (as `bank.otp.send`) or `{ ok: false, code, attemptsLeft? }` | `CARD_INVALID`, `CAPTCHA_WRONG`, `NOT_FOUND`, `LOCKED`, `CARD_BLOCKED`, `ACCOUNT_CLOSED`, `ALREADY_REGISTERED` | (planned; pattern `cab.enroll.retail`) | No | No (starts the code) |
| `otpVerify` | `bank.otp.verify` | `{ code }` | `{ verified: true }` | `OTP_INVALID` | Existing | No | No |
| `policy` | `bank.password.policy` | – | `{ minLength: 8, maxLength: 100, differentChars: 5, notContainUsername: true }` | `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned; pattern `cab.password.policy`) | No | No |
| `complete` | `bank.registration.complete` | `{ registrationId, username, password, confirm }` | `{ ok: true, username, registeredAt }` or `{ ok: false, code, problems? }` | `OTP_REQUIRED`, `REGISTRATION_EXPIRED`, `USERNAME_INVALID`, `USERNAME_TAKEN`, `MISMATCH`, `POLICY` | (planned; pattern `cab.activate.setPassword`) | No | Yes |
| `bind` | `bank.device.bind` | `{ registrationId, deviceName }` | `{ ok: true, deviceId, deviceName }` | `DEVICE_NAME_INVALID`, `REGISTRATION_EXPIRED` | (planned) | No | No (uses the registration just completed) |

Sandbox rules: 3 failed `identify` calls (only `NOT_FOUND` counts; `CAPTCHA_WRONG` and `CARD_INVALID` do not) lock registration for 30 minutes (`MAX_FAILED_LOGINS` and `LOCK_MINUTES` in `cab.ts`); `registrationId` lasts 15 minutes; `ALREADY_REGISTERED` is checked only after the identifying details match; `complete` is idempotent for the same registration and username; usernames `alex.morgan`, `admin` and `support` are taken; the person is told nothing about which field was wrong.

#### 6. Permissions, step-up and limits

No permission and no session. Step-up `otp` once (`verify`) before credentials are created. Limits: 3 identify tries then 30 minutes; 3 code tries; resend after 30 seconds; registration session 15 minutes; one login per customer. Passwords are never shown back; the username is.

#### 7. Result and links out

Result: `done`. Receipt: none. Notifications: email and text "You registered for BankWorkx® digital banking on 3 Nov 2026. If this wasn't you, call +1 800 555 0100 now." (planned, sandbox records it); if a device was remembered, a second line names it. Links out: Sign in (`sign-in`, `{username}`), Forgot username (`forgot-username`), Forgot password (`reset-password`), Contact us (`contact-support`), Open an account (`open-account`).

#### 8. Acceptance criteria

- AC-1: An existing customer is identified by card number, expiry and date of birth, or by account number and date of birth, and a picture code.
- AC-2: A card number that fails the Luhn check is refused before any lookup and does not count as a try.
- AC-3: Wrong details give one message that does not say which field is wrong; three failures lock registration for 30 minutes.
- AC-4: A blocked card and a closed account give their own messages.
- AC-5: A customer who is already registered, and whose details match, is told so and offered sign-in and recovery.
- AC-6: A wrong picture code is refused and a new one can be asked for.
- AC-7: The login cannot be created until the one-time code is verified; three wrong codes stop the step.
- AC-8: The username follows the format rule and must be unused; the password follows the four rules and must be typed twice the same.
- AC-9: On success the customer is told the username and is offered Sign in; a notification is raised.
- AC-10: Remembering the device needs a valid name and creates a trusted device; "Not now" skips it.
- AC-11: Arriving from `track-application` with an application number skips the card or account step.
- AC-12: A timeout on creating the login does not create it, and a retry works; an unavailable service keeps what was entered.
- AC-13: A registration older than 15 minutes is refused.

#### 9. Scenarios

Persona `jordan` (code `482100`) unless stated. Sandbox clock `now: 2026-11-03T10:00:00Z`. Picture code is read from the screen.

| Id | Covers | Setup / conditions | Steps | Expected |
|---|---|---|---|---|
| T-1 | AC-1, AC-7, AC-8, AC-9, AC-10 | – | My card `5555 5555 5555 4444`, `08 / 29`, `22/07/1988`, right picture code; code `482100`; username `jordan.lee`, password `Bwx!Demo2026` twice; remember this device as "Jordan's iPhone" | Ends on `done` with "jordan.lee"; device bound; notification recorded; Sign in button present |
| T-2 | AC-1 | – | My account number `7700002208`, `22/07/1988` | Reaches `verify`; the masked phone `+• ••• ••• 0177`-style text is shown and a code is sent |
| T-3 | AC-2 | – | Card `4242 4242 4242 4241` | "That card number isn't right. Check the 16 digits."; adapter not locked: a later right attempt still has 3 tries |
| T-4 | AC-3 | – | Right card, wrong date `23/07/1988` three times | Messages with 2 and 1 tries left; third: `locked` screen; a fourth with all-right details is still refused |
| T-5 | AC-4 | – | Old card `4242 4242 4242 4242`, `03 / 27` | `CARD_BLOCKED` message with Use my account number button |
| T-6 | AC-5 | Persona `alex` | Account `7700004410`, `09/01/1986` | `alreadyRegistered` with Sign in, Forgot username, Forgot password |
| T-7 | AC-5 | Persona `alex` | Account `7700004410`, wrong date | `NOT_FOUND` message; the screen does not say Alex is registered |
| T-8 | AC-6 | – | Wrong picture code, then New code, then the new right one | "That code doesn't match. Check it or ask for a new one."; then continues |
| T-9 | AC-7 | – | Wrong codes `111111`, `222222`, `333333` | "That code isn't right. 2 tries left.", "1 tries left.", then "Too many wrong codes. Start again."; Start again returns to `intro`; `complete` called directly gives `OTP_REQUIRED` |
| T-10 | AC-8 | – | Username `ab`; `1jordan`; `alex.morgan`; passwords `short`, `aaaaaaaa`, `jordan.lee1`, 101 characters; mismatched confirm | Format message; format message; taken message; `MIN_LENGTH`; `DIFFERENT_CHARS`; `CONTAINS_USERNAME`; `MAX_LENGTH`; mismatch message; no login created until all are right |
| T-11 | AC-10 | – | Remember with name "J" then "Jordan's iPhone"; or "Not now" | "Name this device with 2 to 30 letters or numbers."; then bound; Not now: no `bank.device.bind` call |
| T-12 | AC-11 | Open with `{applicationId: "APP-20261015-0003"}` (persona `sam`, code `123456`) | Open | `intro` skipped; code sent; after the code, `credentials` |
| T-13 | AC-12 | `conditions.timeout: ["bank.registration.complete"]`, `latencyMs: 10000` | Create my login | Timeout message with "If you can't sign in later, register again."; no login exists; after clearing and pressing Try again, one login exists |
| T-14 | AC-12 | `conditions.unavailable: ["bank.registration.identify"]` | Continue | Unavailable message; card, expiry and date are still filled; no code sent |
| T-15 | AC-13 | After `verify`, `now` moved to `2026-11-03T10:16:00Z` | Create my login | "This took too long and was closed for your security. Start again." |

#### 10. Expected mutation-check survivors

| Survivor | Why it stays alive |
|---|---|
| Registration session length 15 minutes changed to 14 or 16 | T-15 uses 16 minutes; the boundary is not tested. |
| Maximum password length 100 raised to 102 | T-10 tests a 101-character password, which a limit of 101 or less refuses, but a limit of 102 or more would not be caught. |
| Reserved usernames other than `alex.morgan` | Only `alex.morgan` is exercised. |
| The 30-second resend delay | Covered by the `otp` block's own tests, not a scenario clock. |

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

**Prototype note:** Quick sign-in set-up is now also a step of `sign-in`; the prototype PIN rules (6 digits, no repeats, runs, 112233, 123123, 121212, 696969, 000111 or phone digits) apply here.

#### 1. Summary

| Item | Value |
|---|---|
| Slug | `setup-quick-login` |
| Purpose | Let the person choose how they sign in on this device: username and password, biometrics (fingerprint or face), or a six-digit quick PIN. |
| Release | 1 |
| Workspace | `personal` |
| Status | New. Built from the CAB fixture `default-sign-in` (`choose`, `pin-new`, `pin-confirm`, `pin-intro`, `biometric`, `password-set`, `done`) and `cab.device.options` / `cab.device.setDefault`. |
| Channels | Web (quick PIN and password only), mobile (all three) |
| Starting pattern | CAB `default-sign-in` |
| Who may use it | A signed-in person with `security.manage`. |

#### 2. Entry points

| Place | Launch point | Passes | Permission |
|---|---|---|---|
| `sign-in` › after a new-device code | Remember this device | – (with `returnTo`) | session |
| More › settings › security › Quick PIN | Set up | – | `security.manage` |
| More › settings › security › Default sign in | Change | – | `security.manage` |
| More › settings › security › Biometrics | Toggle on | `{mode: "biometric"}` | `security.manage` |
| `change-quick-pin` | "I forgot my PIN" | `{mode: "pin"}` | `security.manage` |

When opened from Settings it starts at `choose` (or goes straight to the screen named by `{mode}`).

#### 3. Screens

**Screen `choose` — "Sign in faster"** (blocks: `text`, `select` with `variant: "rows"`, `button`)
`onEnter` calls `deviceOptions` and saves it as `signin`, so the current default starts ticked.

| Field | Block | Required | Rule | Error message |
|---|---|---|---|---|
| Sign in with | `select` rows: `password`, `biometric`, `pin` | Yes | One of the three | "Choose how you want to sign in." |

Row copy: "Username & password" (status word "Default sign in" when it is the default); "Biometric" ("Default sign in", "Enabled", or on a device without it "Not available on this device", row disabled); "PIN" ("Default sign in", "Generated" when a PIN is set). Title: "Please select your default sign in option." Button "Continue" (`validate`, then `navigate`): `pin` → `pinNew`; `biometric` → `biometric`; `password` → `passwordSet`.

**Screen `pinNew` — "Enter new Sign in PIN"** (blocks: `text`, `otp`: `length: 6`, `keypad: true`, `masked: true`, hint "Step 1 of 2")

| Field | Block | Required | Rule | Error message |
|---|---|---|---|---|
| New PIN | `otp` (masked keypad) | Yes | Exactly 6 digits; not all the same digit; not a straight run up or down (`123456`, `654321`) | "A PIN is six digits." / "That PIN is too easy to guess. Avoid repeated or running numbers like 111111 or 123456." |

Button "Continue" → `pinConfirm`.

**Screen `pinConfirm` — "Re-enter new Sign in PIN"** (same block, hint "Step 2 of 2")
Alert (error): "The PINs do not match. Enter the same PIN twice." (shown after a mismatch). Button "Continue": if equal → `pinIntro`; otherwise stays.

**Screen `pinIntro` — "PIN sign in"** Text: "Do you want to set up PIN authentication for secure and convenient sign in?" Button "Set as default" (`callApi setDefault`, `mode: "pin"`, `pin`) → `done`. Button "Not now" (ghost) → exit without saving.

**Screen `biometric` — "Biometric"** (mobile) Text: "You can use your device biometrics to simplify Sign In." Button "Turn on" (opens the phone prompt; sandbox stand-in), then "Set as default" (`callApi setDefault`, `mode: "biometric"`) → `done`. If `biometricAvailable` is false: alert (warning) "This device doesn't have fingerprint or face sign-in set up. Turn it on in your device settings, then try again." and the button is disabled.

**Screen `passwordSet` — "Username & password"** Text: "Sign in with your username and password." Button "Set as default" (`mode: "password"`) → `done`.

**Screen `done` — "All set"** (terminal)
Alert (success): "You have successfully set the sign in method below as your default." `sectionHeader` "Default sign in" with the action "Change" → `choose`. `reviewSummary` row: label "PIN SIGN IN", "BIOMETRIC" or "USERNAME & PASSWORD"; value "Generated" (PIN) or "Enabled". Caption: "You can change this any time in More › Settings › Security." Button "Done" (primary): `exit` (returns to `signedIn` when `returnTo` was set, else to Settings › Security).

States: **Loading** – skeleton rows on `choose`; spinner on every "Set as default". **Error / timeout / unavailable** – see below; the screen stays and nothing is saved.

#### 4. Sandbox errors

| Code | Message the person sees | Screen | Button |
|---|---|---|---|
| `PIN_INVALID` (existing, "A PIN is six digits") | "A PIN is six digits." | `pinNew` | Edit |
| `PIN_TOO_SIMPLE` (planned) | "That PIN is too easy to guess. Avoid repeated or running numbers like 111111 or 123456." | `pinNew` | Edit |
| `INVALID_MODE` (existing; misuse) | "We couldn't save this setting. Try again." | the saving screen | Try again |
| `STEP_UP_REQUIRED` (planned; when opened from Settings and the last step-up is older than 300 s) | "For your security, confirm it's you first." | step-up dialog, then the journey resumes | Confirm |
| `BIOMETRIC_UNAVAILABLE` (planned) | "This device doesn't have fingerprint or face sign-in set up. Turn it on in your device settings, then try again." | `biometric` | Back |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | saving screen | Try again |
| `SERVICE_UNAVAILABLE` | Standard S-`SERVICE_UNAVAILABLE` | saving screen | Try again |
| `SESSION_EXPIRED` | Standard S-`SESSION_EXPIRED` | Landing | Sign in |

The mismatch message is local to the journey (no adapter call).

#### 5. Adapters

| Integration id | Adapter | Request | Response | Error codes | Status | moneyMoving | requiresOtp |
|---|---|---|---|---|---|---|---|
| `deviceOptions` | `bank.device.options` | `{ deviceId }` | `{ default, pinSet, biometricAvailable }` | `TIMEOUT`, `SERVICE_UNAVAILABLE` | Planned (CAB: `cab.device.options`) | No | No |
| `setDefault` | `bank.device.setDefault` | `{ mode: "password" \| "pin" \| "biometric", pin? }` | `{ ok: true, default }` | `INVALID_MODE`, `PIN_INVALID`, `PIN_TOO_SIMPLE`, `BIOMETRIC_UNAVAILABLE`, `STEP_UP_REQUIRED`, `SESSION_EXPIRED` | Planned (CAB: `cab.device.setDefault`) | No | Via step-up |

#### 6. Permissions, step-up and limits
Permission `security.manage`. Step-up level `stepup`: not asked when launched straight after a new-device sign-in (that counts as a step-up for 300 s); asked when launched from Settings. Limits: one PIN per device, six digits.

#### 7. Result and links out
Result screen `done`. No receipt. Notification: "Quick sign in changed on {deviceName}" (in-app, planned). Buttons lead back to `signedIn` (from sign-in) or Settings › Security.

#### 8. Acceptance criteria
- **AC-1.** The current default is shown ticked, with status words, when the journey opens.
- **AC-2.** A six-digit PIN entered twice the same way is saved as the default and the next sign-in on that device offers the PIN pop-up.
- **AC-3.** A PIN that is not six digits, or is a repeated or running number, is refused with the exact message and nothing is saved.
- **AC-4.** Two different PINs are refused with "The PINs do not match."
- **AC-5.** Biometrics can be chosen only when the device supports them.
- **AC-6.** Choosing "Username & password" saves it as the default; the PIN, if set, is kept.
- **AC-7.** From Settings the journey asks for a step-up first; right after a new-device sign-in it does not.
- **AC-8.** On a timeout or unavailable service nothing is saved and the standard message shows.

#### 9. Scenarios

| ID | Covers | Persona | Setup and conditions | Expected |
|---|---|---|---|---|
| T-1 | AC-1 | `alex.morgan` | Default `password`, PIN not set. | Password row shows "Default sign in"; PIN row shows no status. |
| T-2 | AC-2 | `alex.morgan` | Enter `482916` twice, "Set as default". | `setDefault` mode `pin`; `bank.device.options` then returns `default: pin`, `pinSet: true`. |
| T-3 | AC-3 | `alex.morgan` | `12345`; `111111`; `123456`. | Messages as above; nothing saved. |
| T-4 | AC-4 | `alex.morgan` | `482916` then `482917`. | Mismatch alert; stays on `pinConfirm`. |
| T-5 | AC-5 | `alex.morgan` | `biometricAvailable: false`. | Biometric row disabled; `biometric` screen shows the warning. |
| T-6 | AC-6 | `alex.morgan` | PIN set, choose password. | `default: password`, `pinSet: true`. |
| T-7 | AC-7 | `alex.morgan` | `now` 6 minutes after sign-in, launch from Settings. | `STEP_UP_REQUIRED`, step-up dialog; after it the journey continues. Second case: 1 minute after sign-in, no dialog. |
| T-8 | AC-8 | `alex.morgan` | `conditions.timeout: ["bank.device.setDefault"]`. | Timeout message; `default` unchanged. |
| T-9 | AC-8 | `alex.morgan` | `conditions.unavailable: ["bank.device.setDefault"]`. | Unavailable message; `default` unchanged. |

#### 10. Expected mutation-check survivors
| Mutant | Why it survives |
|---|---|
| Biometric prompt skipped | The sandbox has no real fingerprint or face prompt. |
| `masked: true` or `keypad: true` removed on the PIN block | Display only; the stored PIN is the same. |

**Prototype reconciliation (from `sign-in`).** In the prototype the first set-up of quick sign-in is the last step of `sign-in` ("Sign in faster next time"), offered on a device the person has not refused to trust. Methods follow the bank options: Face ID or fingerprint (`allowBio`), passkey (`allowPasskey`, a new method), 6-digit quick PIN (`allowQuickPin`), or "Not now". PIN rules are stricter than the text above: exactly 6 digits; not one digit repeated (111111); not a run up or down (123456, 654321); not a repeated pair (121212, 696969); not 112233, 123123 or 000111; and not containing the last four digits of the phone. Messages: "Use exactly 6 digits." / "That PIN is too easy to guess. Avoid repeats and runs like 111111 or 123456. (PIN_WEAK)" / "Don't use digits from your phone number. (PIN_WEAK)" / "The PINs don't match." This journey stays the place to change the method later. The first-time offer in the prototype is not limited to a trusted device (a known device also sees it); the lead should settle that.

---

### ★ Forgot username — `forgot-username`

#### 1. Summary

| Item | Value |
|---|---|
| Slug | `forgot-username` |
| Purpose | Prove who the person is, then show their username. |
| Release | 1 |
| Workspace | `public` |
| Status | New. Built from CAB `cant-sign-in` (screens `email`, `phone`, `dob`, `found`, `channel`, `otp`) and `cab.recover.verifyUser`, `cab.captcha.generate`. |
| Channels | Web, mobile |
| Starting pattern | CAB `cant-sign-in` |
| Who may use it | Anyone. |

CAB shows the username straight after the details match. BankWorkx® shows it only **after** the one-time code, so details found in a leaked document are not enough.

#### 2. Entry points

| Place | Launch point | Passes | Permission |
|---|---|---|---|
| `sign-in` screen | Forgot username? | – | none |
| `reset-password` › found screen | "I don't know my username" | – | none |

Leads to: `sign-in` (with `{username}`) or `reset-password`.

#### 3. Screens

**Screen `details` — "Let's find your username"** (blocks: `text`, `textInput` ×3, picture code `text` + `textInput`, `alert`, `button`)
`onEnter`: `callApi captcha` (saved as `captcha`).

| Field | Block | Required | Rule | Error message |
|---|---|---|---|---|
| Email | `textInput`, keyboard email | Yes | Pattern `^[^@\s]+@[^@\s]+\.[^@\s]+$` | "Enter a valid email address." |
| Phone number | `textInput`, keyboard phone | Yes | Pattern `^[0-9 +()-]{7,20}$`; at least 7 digits. The last 8 digits are compared. | "Enter at least 7 digits." |
| Date of birth | `textInput` placeholder "DD / MM / YYYY" (`datePicker` planned) | Yes | Pattern `^[0-9]{2} ?/ ?[0-9]{2} ?/ ?[0-9]{4}$`; a real date in the past | "Use the format DD / MM / YYYY." / "Enter a date of birth in the past." |
| Code (picture code) | `textInput`, placeholder "Enter the above text here" | Yes | Matches the picture text; not case sensitive | "Enter the code shown above." |

Copy: title "Let's find your username"; body "Enter the details we hold for you." The picture code appears as large text (e.g. `k8m2q`). Alert (error, `CAPTCHA_WRONG`): "That code doesn't match. Check it or ask for a new one." Button "New code" (ghost): `callApi captcha`. Button "Continue": `validate`, `callApi verifyUser`, `navigate`: ok → `channel`; `CAPTCHA_WRONG` → stays; `NOT_FOUND` → `notFound`; status `NEW` → `notActive`.

**Screen `channel` — "Security code"** (blocks: `text`, `select`, `button`)

| Field | Block | Required | Rule | Error message |
|---|---|---|---|---|
| Send the code by | `select`, choices `sms` ("Text message to {maskedPhone}") and `email` ("Email to {maskedEmail}") | Yes | One of the two | "Choose where to send the code." |

Button "Send code": `callApi otpSend` → `code`.

**Screen `code` — "Enter your code"** (blocks: `otp`, `button`) `otp` block, 6 digits, `resendAfterSeconds: 30`, hint "Please enter the 6-digit security code we sent to {maskedPhone}". Button "Verify": `callApi otpVerify` (id `otpVerify`, `lockAfter: 3`, `lockTo: "otpLocked"`), then `callApi getUsername`, then `navigate` → `found`. Toast on a wrong code: "That code isn't right. {n} tries left."

**Screen `found` — "Here's your username"** (terminal) Result (success): title "Welcome back, {firstName}", text "Your username is {username}." Buttons: "Sign in as {username}" (primary) → `sign-in` `{username}`; "Reset my password" (secondary) → `reset-password`. Caption: "We also sent your username to {maskedEmail}." (planned notification).

**Terminal screens:** `notFound` – error "We couldn't find a matching profile", text "Check the email, phone number and birth date, or call support.", buttons "Try again" → `details`, "Contact us" → `contact-support`. `notActive` – error "Your profile isn't active yet", text "Finish setting up digital banking first.", buttons "Register" → `register-digital-banking`, "Track my application" → `track-application`. `otpLocked` – error "Too many incorrect codes", text "For your security we've paused this for 30 minutes. Try again later.", button "Done".

States: **Loading** – spinner on buttons; picture code shows `-----` until it arrives. **Timeout** after 10 s: "This is taking longer than expected. Nothing was changed." with "Try again". **Empty:** none.

#### 4. Sandbox errors

| Code | Message | Screen | Button |
|---|---|---|---|
| `CAPTCHA_WRONG` | "That code doesn't match. Check it or ask for a new one." | `details` | New code |
| `NOT_FOUND` | "We couldn't find a matching profile." (`notFound`) | `notFound` | Try again |
| `OTP_INVALID` | "That code isn't right. {n} tries left." Third wrong: `otpLocked` text. | `code` | Try again |
| `OTP_REQUIRED` | Standard S-`OTP_REQUIRED` (if `getUsername` is called before the code) | `code` | Back to code |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | the calling screen | Try again |
| `SERVICE_UNAVAILABLE` | Standard S-`SERVICE_UNAVAILABLE` | the calling screen | Try again |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Error codes | Status | moneyMoving | requiresOtp |
|---|---|---|---|---|---|---|---|
| `captcha` | `bank.captcha.generate` (CAB: `cab.captcha.generate`) | `{}` | `{ serviceKey, text }` | `TIMEOUT`, `SERVICE_UNAVAILABLE` | Planned | No | No |
| `verifyUser` | `bank.recover.verifyUser` (CAB: `cab.recover.verifyUser`) | `{ captchaKey, captchaValue, email, phone, dob }` | `{ ok: true, firstName, status, maskedEmail, maskedPhone }` or `{ ok: false, code: "CAPTCHA_WRONG" \| "NOT_FOUND" }` (CAB also returns `username`; BankWorkx® does not) | `TIMEOUT`, `SERVICE_UNAVAILABLE` | Planned | No | No |
| `otpSend` / `otpVerify` | `bank.otp.send` / `bank.otp.verify` | `{ channel }` / `{ code }` | see `sign-in` | `OTP_INVALID` | Existing | No | – |
| `getUsername` | `bank.recover.getUsername` | `{}` (after verifyUser) | `{ username }` | `VERIFY_FIRST`, `OTP_REQUIRED` | Planned | No | Yes |

#### 6. Permissions, step-up and limits
None needed. Limits: 3 wrong codes pause the journey for 30 minutes; 5 failed detail checks in an hour show "Too many tries. Try again later." (planned, `RATE_LIMITED`).

#### 7. Result and links out
Result `found`. Notification: email "Your username was requested" to the address on file (planned). Links: `sign-in`, `reset-password`.

#### 8. Acceptance criteria
- **AC-1.** Matching email, phone, date of birth and picture code lead to a code step; the username is not shown before the code is verified.
- **AC-2.** A wrong picture code is refused with the exact message and a new code can be asked for.
- **AC-3.** Details that match no profile end on `notFound`.
- **AC-4.** A right code (`482100`) shows the username; three wrong codes end on `otpLocked`.
- **AC-5.** A profile that is not yet active is sent to `notActive`.
- **AC-6.** `getUsername` without a verified code answers `OTP_REQUIRED`.
- **AC-7.** On a timeout or unavailable service nothing is shown or changed.

#### 9. Scenarios

| ID | Covers | Persona | Setup and conditions | Expected |
|---|---|---|---|---|
| T-1 | AC-1, AC-4 | `alex.morgan` | Email `alex.morgan@example.com`, phone `+1 415 555 0142`, DOB `14 / 03 / 1988`, right picture code, then code `482100`. | `channel`, `code`, then `found`: "Your username is alex.morgan". Username never appears earlier. |
| T-2 | AC-2 | `alex.morgan` | Picture code typed wrong. | `CAPTCHA_WRONG` alert; "New code" gives a different code. |
| T-3 | AC-3 | any | Wrong DOB. | `notFound`. |
| T-4 | AC-4 | `alex.morgan` | Three wrong codes. | `OTP_INVALID` ×3, `otpLocked`. |
| T-5 | AC-5 | `demo.inactive` | Right details. | `notActive`. |
| T-6 | AC-6 | `alex.morgan` | Call `getUsername` straight after `verifyUser`. | `OTP_REQUIRED`. |
| T-7 | AC-7 | `alex.morgan` | `conditions.timeout: ["bank.recover.verifyUser"]`. | Timeout message; no username. |
| T-8 | AC-7 | `alex.morgan` | `conditions.unavailable: ["bank.recover.getUsername"]`. | Unavailable message; no username shown. |

#### 10. Expected mutation-check survivors
| Mutant | Why it survives |
|---|---|
| Phone compare uses the last 7 instead of 8 digits | The seed numbers differ in other digits, so no scenario separates 7 from 8 (the same limit exists in CAB). |
| `RATE_LIMITED` threshold changed | The sandbox has no hourly counter (planned only). |

**Prototype reconciliation (from `sign-in`).** The prototype `sign-in` links "Forgot username?" to this journey with no launch values, so nothing in this block changes. Its other two links use different slugs from this file: "Forgot password?" opens `forgot-password` (this file: `reset-password`) and "Register" opens `register` (this file: `register-digital-banking`). The lead should settle one name for each.

---

### ★ Reset password — `reset-password`

#### 1. Summary

| Item | Value |
|---|---|
| Slug | `reset-password` |
| Purpose | Prove who the person is with a one-time code, then choose a new password. Also unlocks and un-expires the profile. |
| Release | 1 |
| Workspace | `public` |
| Status | New. Built from CAB `cant-sign-in` (`email`, `phone`, `dob`, `found`, `channel`, `otp`, `new-password`, `reset-done`, `otp-locked`, `not-found`) and `cab.recover.verifyUser`, `cab.recover.resetPassword`, `cab.password.policy`. |
| Channels | Web, mobile |
| Starting pattern | CAB `cant-sign-in` |
| Who may use it | Anyone. |

#### 2. Entry points

| Place | Launch point | Passes | Permission |
|---|---|---|---|
| `sign-in` screen | Forgot password? | `{username}` if typed | none |
| `sign-in` › `expired` | Reset password | `{username}` | none |
| `forgot-username` › `found` | Reset my password | – | none |
| `unlock-account` › done | Also choose a new password | `{username}` | none |

Leads to: `sign-in`.

#### 3. Screens

**Screen `details` — "Let's verify it's you"** Same four fields and rules as `forgot-username` `details` (email, phone, date of birth, picture code), same messages. If `{username}` was passed, a line above reads "Resetting the password for {username}." and the sandbox only accepts a profile with that username (`NOT_FOUND` otherwise). Button "Continue" → `found` (ok), stays on `CAPTCHA_WRONG`, `notFound` on `NOT_FOUND`.

**Screen `found` — "Welcome back"** (blocks: `text`, `menu`, `divider`)
Text: "Welcome back, {firstName}!" and "We found you with username: {username}." (the full username is shown here because the person is about to prove ownership with the code; it is hidden in the `notFound` case).
- If `status == ACTIVE`: menu item "Reset your password" → `channel`; divider "OR"; menu item "Sign in as {username}" → `sign-in`.
- If `status == NEW`: menu item "Send me a new activation code" (`callApi regenerate`, CAB `cab.activate.regenerate`) → `regenerated`.

**Screen `channel` and `code`** as in `forgot-username` (choose SMS or email; 6-digit code; resend after 30 s; `otpVerify`, `lockAfter: 3`, `lockTo: "otpLocked"`). Button "Verify" → `newPassword`.

**Screen `newPassword` — "Choose a new password"** (blocks: `textInput` ×2 secure, `text` captions, `alert` ×2, `button`) `onEnter`: `callApi policy` (`bank.password.policy`, response `{ minLength: 8, maxLength: 100, differentChars: 5, notContainUsername: true }`).

| Field | Block | Required | Rule | Error message |
|---|---|---|---|---|
| New password | `textInput` secure, placeholder "Enter a new password" | Yes | 8 to 100 characters; at least 5 different characters; must not contain the username | Per problem, below |
| Re-enter your new password | `textInput` secure | Yes | Equal to the first | "The two passwords don't match." |

Caption list under the fields (each line turns green with a tick when met; wording from CAB):
- "Security requirements:"
- "- Password must contain 5 different characters"
- "- Password must contain at least 8 characters"
- "- Password must not exceed 100 characters"
- "- Password must not contain username"

Messages by problem code from `passwordProblems`: `MIN_LENGTH` "Use at least 8 characters."; `MAX_LENGTH` "Use no more than 100 characters."; `DIFFERENT_CHARS` "Use at least 5 different characters."; `CONTAINS_USERNAME` "Your password can't contain your username."; generic alert on `POLICY`: "That password doesn't meet the security requirements."; on `MISMATCH`: "The two passwords don't match." Button "Continue" (label "Change password"): `validate`, `callApi resetPassword`, `navigate`: ok → `done`.

**Screen `done` — "Password updated"** (terminal) Result (success): title "Your password has been successfully updated", text "Your current session is closed. Please sign in again using your new password." Button "Sign in" → `sign-in` `{username}`.

**Terminal screens:** `regenerated` (success "A new activation code is on its way", text "We sent it to {maskedEmail} and {maskedPhone}. Use Register for digital banking with it.", button "Done"); `notFound` (as `forgot-username`); `otpLocked` (error "Too many incorrect codes", "For your security, your profile is locked for 30 minutes. Try again later." button "Unlock account" → `unlock-account`).

States: **Loading** – spinner on buttons; policy list shows skeleton lines until `policy` answers. **Timeout** – "This is taking longer than expected. Nothing was changed." **Unavailable** – standard.

#### 4. Sandbox errors

| Code | Message | Screen | Button |
|---|---|---|---|
| `CAPTCHA_WRONG` | "That code doesn't match. Check it or ask for a new one." | `details` | New code |
| `NOT_FOUND` | "We couldn't find a matching profile." | `notFound` | Try again |
| `OTP_INVALID` | "That code isn't right. {n} tries left." Third: `otpLocked` text. | `code` | Try again |
| `OTP_REQUIRED` (reset without a verified code) | Standard S-`OTP_REQUIRED` | `code` | Back to code |
| `VERIFY_FIRST` (misuse) | "We need to check who you are first. Start again." | `details` | Start again |
| `MISMATCH` | "The two passwords don't match." | `newPassword` | Edit |
| `POLICY` (with `problems`) | Per-problem line above, plus "That password doesn't meet the security requirements." | `newPassword` | Edit |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | any | Try again |
| `SERVICE_UNAVAILABLE` | Standard S-`SERVICE_UNAVAILABLE` | any | Try again |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Error codes | Status | moneyMoving | requiresOtp |
|---|---|---|---|---|---|---|---|
| `captcha` | `bank.captcha.generate` | `{}` | `{ serviceKey, text }` | `TIMEOUT`, `SERVICE_UNAVAILABLE` | Planned | No | No |
| `verifyUser` | `bank.recover.verifyUser` | `{ captchaKey, captchaValue, email, phone, dob, username? }` | `{ ok, username, firstName, status, maskedEmail, maskedPhone }` or `{ ok: false, code }` | as above | Planned (CAB: `cab.recover.verifyUser`) | No | No |
| `otpSend`, `otpVerify` | `bank.otp.send`, `bank.otp.verify` | see `sign-in` | | `OTP_INVALID` | Existing | No | – |
| `policy` | `bank.password.policy` (CAB: `cab.password.policy`) | `{}` | `{ minLength, maxLength, differentChars, notContainUsername }` | `TIMEOUT`, `SERVICE_UNAVAILABLE` | Planned | No | No |
| `resetPassword` | `bank.recover.resetPassword` (CAB: `cab.recover.resetPassword`) | `{ password, confirm }` | `{ ok: true }` or `{ ok: false, code: "MISMATCH" \| "POLICY", problems? }`. On success the failed counter goes to 0, status becomes ACTIVE (clears `LOCKED` and `PASSWORD_EXPIRED`), the verified code is used up, all sessions end. | `VERIFY_FIRST`, `OTP_REQUIRED` | Planned | No | Yes |
| `regenerate` | `bank.activate.regenerate` (CAB: `cab.activate.regenerate`) | `{}` | `{ ok, sent, maskedEmail, maskedPhone }` | `VERIFY_FIRST` | Planned | No | No |

#### 6. Permissions, step-up and limits
None needed. Password rules: 8 to 100 characters, 5 different, no username. Limits: 3 wrong codes; 3 resets per day (planned, `RATE_LIMITED`).

#### 7. Result and links out
Result `done`. Notification: "Your BankWorkx® password was changed. Wasn't you? Contact us" (email and in-app). Other devices are signed out. Trusted devices and quick PINs are kept. Link: `sign-in`.

#### 8. Acceptance criteria
- **AC-1.** Matching details and a right picture code lead to `found`; a wrong picture code, or details that match nothing, do not.
- **AC-2.** The password cannot be changed until the one-time code is verified (`OTP_REQUIRED`).
- **AC-3.** A new password shorter than 8, longer than 100, with fewer than 5 different characters, or containing the username is refused with the exact line for that problem.
- **AC-4.** A confirm that differs is refused with "The two passwords don't match."
- **AC-5.** A good new password ends on `done`, and the new password signs in while the old one does not.
- **AC-6.** Resetting clears a lock and an expired password.
- **AC-7.** Three wrong codes end on `otpLocked`.
- **AC-8.** A profile that is not active is offered a new activation code, not a reset.
- **AC-9.** On a timeout or unavailable service the password is not changed.

#### 9. Scenarios

| ID | Covers | Persona | Setup and conditions | Expected |
|---|---|---|---|---|
| T-1 | AC-1, AC-5 | `alex.morgan` | Details, code `482100`, new password `Aurora#Sky2026`. | `done`. Then sign in with the new password succeeds; the old `Bwx!Demo2026` answers `INVALID_CREDENTIALS`. |
| T-2 | AC-1 | `alex.morgan` | Wrong picture code; then wrong DOB. | `CAPTCHA_WRONG`; then `notFound`. |
| T-3 | AC-2 | `alex.morgan` | Call `resetPassword` after `verifyUser` but before the code. | `OTP_REQUIRED`; password unchanged. |
| T-4 | AC-3 | `alex.morgan` | `Ab1!` ; 101 characters; `aaaaaaaa`; `alex.morgan1!`. | `MIN_LENGTH`; `MAX_LENGTH`; `DIFFERENT_CHARS`; `CONTAINS_USERNAME`. |
| T-5 | AC-4 | `alex.morgan` | Confirm differs. | `MISMATCH`. |
| T-6 | AC-6 | `demo.locked`, `demo.expired` | Reset each. | Then a sign-in with the new password reaches `signedIn` (no `LOCKED`, no `PASSWORD_EXPIRED`). |
| T-7 | AC-7 | `alex.morgan` | Three wrong codes. | `otpLocked`. |
| T-8 | AC-8 | `demo.inactive` | Right details. | `found` shows only "Send me a new activation code"; `regenerated` text. |
| T-9 | AC-9 | `alex.morgan` | `conditions.timeout: ["bank.recover.resetPassword"]`. | Timeout message; old password still works. |
| T-10 | AC-9 | `alex.morgan` | `conditions.unavailable: ["bank.recover.resetPassword"]`. | Unavailable message; old password still works. |

#### 10. Expected mutation-check survivors
| Mutant | Why it survives |
|---|---|
| Password policy text lines swapped (copy only) | Copy lines are not tied to a rule; T-4 checks the error messages, not the caption list. |
| `RATE_LIMITED` removed | The sandbox has no daily counter. |
| "Other devices are signed out" removed | The sandbox keeps one session; there is nothing to observe. |

---

### ★ Unlock account — `unlock-account`

**Prototype note:** The prototype `sign-in` locks after 5 wrong passwords or codes (not 3) and opens this journey with `{user}`; the 30-minute wording here should follow the bank setting.

#### 1. Summary

| Item | Value |
|---|---|
| Slug | `unlock-account` |
| Purpose | Get back into a locked profile now, by proving who the person is, instead of waiting 30 minutes. |
| Release | 1 |
| Workspace | `public` |
| Status | New (planned adapters). CAB only unlocks through a password reset; BankWorkx® adds an unlock that does not change the password. |
| Channels | Web, mobile |
| Starting pattern | CAB `cant-sign-in` (verify, code) and the `LOCKED` outcome of `cab.auth.signIn` |
| Who may use it | Anyone. |

#### 2. Entry points

| Place | Launch point | Passes | Permission |
|---|---|---|---|
| `sign-in` › `locked` and `otpLocked` | Unlock account | `{username}` | none |
| `reset-password` › `otpLocked` | Unlock account | `{username}` | none |
| Landing › sign-in help | Account locked? | – | none |

Leads to: `sign-in` (and optionally `reset-password`).

#### 3. Screens

**Screen `start` — "Your profile is locked"** (blocks: `text`, `textInput`, `alert`, `button`) `onEnter` calls `lockStatus` if `{username}` is known.

| Field | Block | Required | Rule | Error message |
|---|---|---|---|---|
| Username | `textInput` (hidden when passed in) | Yes | Not empty | "Enter your username." |

Copy: title "Your profile is locked"; body "After 3 wrong tries we lock a profile for 30 minutes to keep it safe. It unlocks by itself in about {minutesLeft} minutes, or you can unlock it now." Buttons: "Unlock now" (primary) → `verify`; "I'll wait" (ghost) → `exit`. If `lockStatus` says not locked: → `notLocked`.

**Screen `verify` — "Let's verify it's you"** Same four fields as `reset-password` `details`. Button "Continue" → `channel`; `NOT_FOUND` → `notFound`.

**Screens `channel` and `code`** as in `forgot-username`. The right code (`482100`) → `unlocked`; three wrong ones → `otpLocked`.

**Screen `unlocked` — "Profile unlocked"** (terminal) Result (success): title "Your profile is unlocked", text "You can sign in now. You have 3 tries again." Buttons: "Sign in" (primary) → `sign-in` `{username}`; "Choose a new password too" (secondary) → `reset-password` `{username}`.

**Terminal screens:** `notLocked` – success "Your profile isn't locked", text "You can sign in.", button "Sign in". `notFound` – as before. `otpLocked` – error "Too many incorrect codes", text "Your profile stays locked. The 30 minutes start again now. Try again later or call support.", button "Contact us" → `contact-support`. `limit` – error "Too many unlocks today", text "You've unlocked this profile 3 times today. Call support so we can check it's you.", button "Contact us".

States: **Loading** – spinner. **Timeout / unavailable** – standard messages; the profile stays as it was.

#### 4. Sandbox errors

| Code | Message | Screen | Button |
|---|---|---|---|
| `NOT_FOUND` | "We couldn't find a matching profile." | `notFound` | Try again |
| `CAPTCHA_WRONG` | "That code doesn't match. Check it or ask for a new one." | `verify` | New code |
| `OTP_INVALID` | "That code isn't right. {n} tries left." Third: `otpLocked`. | `code` | Try again |
| `OTP_REQUIRED` | Standard S-`OTP_REQUIRED` | `code` | Back to code |
| `NOT_LOCKED` (planned) | "Your profile isn't locked." | `notLocked` | Sign in |
| `UNLOCK_LIMIT` (planned) | "You've unlocked this profile 3 times today. Call support so we can check it's you." | `limit` | Contact us |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | any | Try again |
| `SERVICE_UNAVAILABLE` | Standard S-`SERVICE_UNAVAILABLE` | any | Try again |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Error codes | Status | moneyMoving | requiresOtp |
|---|---|---|---|---|---|---|---|
| `lockStatus` | `bank.account.lockStatus` | `{ username }` | `{ locked, minutesLeft }` (same answer shape for unknown usernames, `locked: false`) | `TIMEOUT`, `SERVICE_UNAVAILABLE` | Planned | No | No |
| `captcha`, `verifyUser` | `bank.captcha.generate`, `bank.recover.verifyUser` | see `reset-password` | | | Planned | No | No |
| `otpSend`, `otpVerify` | `bank.otp.send`, `bank.otp.verify` | | | `OTP_INVALID` | Existing | No | – |
| `unlock` | `bank.account.unlock` | `{ username }` (after verifyUser and the code) | `{ ok: true }` (failed counter 0, status ACTIVE) | `NOT_LOCKED`, `UNLOCK_LIMIT`, `VERIFY_FIRST`, `OTP_REQUIRED` | Planned | No | Yes |

#### 6. Permissions, step-up and limits
None needed. Lockout: `MAX_FAILED_LOGINS` 3, `LOCK_MINUTES` 30. Unlock limit 3 per day (planned). Code: 3 tries.

#### 7. Result and links out
Result `unlocked`. Notification: "Your profile was unlocked" (email and in-app). Links: `sign-in`, `reset-password`, `contact-support`.

#### 8. Acceptance criteria
- **AC-1.** A locked profile shows how long the lock lasts and offers "Unlock now".
- **AC-2.** The profile unlocks only after matching details and a right code.
- **AC-3.** After unlocking, the right password signs in and the counter is back to 3 tries.
- **AC-4.** Unlocking does not change the password.
- **AC-5.** Three wrong codes keep the profile locked and restart the 30 minutes.
- **AC-6.** A profile that is not locked is told so.
- **AC-7.** A fourth unlock in one day is refused.
- **AC-8.** On a timeout or unavailable service the profile stays locked.

#### 9. Scenarios

| ID | Covers | Persona | Setup and conditions | Expected |
|---|---|---|---|---|
| T-1 | AC-1 | `demo.locked` | Open with `{username}`. | Text mentions 30 minutes; "Unlock now" shown. |
| T-2 | AC-2, AC-3, AC-4 | `demo.locked` | Details, code `482100`. | `unlocked`; sign-in with `Bwx!Demo2026` reaches `signedIn`; password unchanged. |
| T-3 | AC-2 | `demo.locked` | `unlock` called before the code. | `OTP_REQUIRED`; still `LOCKED`. |
| T-4 | AC-5 | `demo.locked` | Three wrong codes. | `otpLocked`; sign-in answers `LOCKED`. |
| T-5 | AC-6 | `alex.morgan` | Open `unlock-account`. | `notLocked`. |
| T-6 | AC-7 | `demo.locked` | Unlock three times, lock again, try a fourth time. | `UNLOCK_LIMIT`. |
| T-7 | AC-8 | `demo.locked` | `conditions.timeout: ["bank.account.unlock"]`. | Timeout message; still `LOCKED`. |
| T-8 | AC-8 | `demo.locked` | `conditions.unavailable: ["bank.account.unlock"]`. | Unavailable message; still `LOCKED`. |

#### 10. Expected mutation-check survivors
| Mutant | Why it survives |
|---|---|
| `minutesLeft` shown wrongly | The sandbox does not run a lock clock (the CAB sandbox does not either); only the text "30 minutes" can be asserted. |
| `UNLOCK_LIMIT` changed from 3 to 4 | Killed only by T-6, which must run the 4-step sequence; if skipped it survives. |

**Prototype reconciliation (from `sign-in`).** The prototype locks sign-in after **5** wrong passwords or **5** wrong one-time codes, not 3; read "3 wrong tries" above as 5 until the lead settles it. The locked card on `sign-in` shows "Unlock your account", "Confirm it's you with your registered phone and a photo ID check. It takes about 3 minutes.", a button **Unlock my account** that opens this journey with `{user}`, and **Call us instead**. The prototype has no timed unlock (no 30-minute clock); only this journey, or the sandbox shortcut "clear this lock", unlocks.

---

### ★ Change password — `change-password`

#### 1. Summary

| Item | Value |
|---|---|
| Slug | `change-password` |
| Purpose | A signed-in person chooses a new password. |
| Release | 1 |
| Workspace | `personal` |
| Status | New. Password rules and screens from CAB `cant-sign-in` `new-password` and `cab.password.policy`. |
| Channels | Web, mobile |
| Starting pattern | CAB `cant-sign-in` (`new-password`, `reset-done`) |
| Who may use it | A signed-in person with `security.manage`. |

#### 2. Entry points

| Place | Launch point | Passes | Permission |
|---|---|---|---|
| More › settings › security | Change password | – | `security.manage` |
| Login history row detail | Change password | – | `security.manage` |
| Notification "We saw a sign-in from a new place" | Change password | – | `security.manage` |

Leads to: Landing `sign-in` (all sessions end).

#### 3. Screens

**Step-up first.** On entry the shell checks the step-up (300 seconds). If it is older, the step-up dialog opens (password or PIN or biometrics, then a one-time code). Cancel returns to Settings › Security and nothing is changed.

**Screen `form` — "Change password"** (blocks: `textInput` ×3 secure, `text` captions, `alert` ×3, `button`) `onEnter`: `callApi policy`.

| Field | Block | Required | Rule | Error message |
|---|---|---|---|---|
| Current password | `textInput` secure | Yes | Not empty; must be right | "Enter your current password." / "That isn't your current password. {n} tries left." |
| New password | `textInput` secure | Yes | 8 to 100 characters; 5 different characters; must not contain the username; must differ from the current password | Per problem (see `reset-password`), and `SAME_AS_CURRENT`: "Your new password must be different from your current one." |
| Re-enter your new password | `textInput` secure | Yes | Equal to the new password | "The two passwords don't match." |

Copy: title "Change password"; the same "Security requirements" caption list as `reset-password` (5 different characters, at least 8, not over 100, not the username) plus "- Password must be different from your current password". Button "Change password" (primary): `validate`, `callApi changePassword`, `navigate`. Button "Cancel" (ghost): `exit`.

**Screen `done` — "Password updated"** (terminal) Result (success): title "Your password has been successfully updated", text "Your current session is closed. Please sign in again using your new password." Button "Sign in" → `sign-in`.

**Terminal screen `locked`.** After three wrong current passwords: error "Your profile is locked", text "Too many wrong passwords. You're signed out, and sign in is blocked for 30 minutes.", button "Unlock account" → `unlock-account`.

States: **Loading** – spinner on the button; policy list skeleton. **Timeout** – "This is taking longer than expected. Nothing was changed." **Unavailable** – standard.

#### 4. Sandbox errors

| Code | Message | Screen | Button |
|---|---|---|---|
| `STEP_UP_REQUIRED` | "For your security, confirm it's you first." | step-up dialog | Confirm |
| `WRONG_CURRENT_PASSWORD` (planned, `attemptsLeft`) | "That isn't your current password. {n} tries left." | `form` | Try again |
| `LOCKED` | `locked` text above | `locked` | Unlock account |
| `MISMATCH` | "The two passwords don't match." | `form` | Edit |
| `POLICY` (with `problems`) | Per-problem line plus "That password doesn't meet the security requirements." | `form` | Edit |
| `SAME_AS_CURRENT` (planned) | "Your new password must be different from your current one." | `form` | Edit |
| `PERMISSION_DENIED` | "This isn't available for your profile." | `form` | Back |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | `form` | Try again |
| `SERVICE_UNAVAILABLE` | Standard S-`SERVICE_UNAVAILABLE` | `form` | Try again |
| `SESSION_EXPIRED` | Standard S-`SESSION_EXPIRED` | Landing | Sign in |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Error codes | Status | moneyMoving | requiresOtp |
|---|---|---|---|---|---|---|---|
| `policy` | `bank.password.policy` | `{}` | `{ minLength: 8, maxLength: 100, differentChars: 5, notContainUsername: true }` | `TIMEOUT`, `SERVICE_UNAVAILABLE` | Planned | No | No |
| `changePassword` | `bank.password.change` | `{ current, password, confirm }` | `{ ok: true }` or `{ ok: false, code: "MISMATCH" \| "POLICY" \| "SAME_AS_CURRENT", problems? }` | `STEP_UP_REQUIRED`, `WRONG_CURRENT_PASSWORD`, `LOCKED`, `PERMISSION_DENIED`, `SESSION_EXPIRED` | Planned | No | Yes (via step-up) |
| `stepUp` | `bank.session.stepUp` | see shell | | | Planned | No | Yes |

#### 6. Permissions, step-up and limits
Permission `security.manage`. Step-up level `stepup`. Limits: 3 wrong current passwords lock the profile (same counter as sign-in).

#### 7. Result and links out
Result `done`. Notification: "Your BankWorkx® password was changed. Wasn't you? Contact us" (email and in-app). Every session ends, including this one; trusted devices and quick PINs are kept. Link: `sign-in`.

#### 8. Acceptance criteria
- **AC-1.** The form cannot be reached or submitted without a fresh step-up.
- **AC-2.** A wrong current password is refused with the tries left; the third wrong try locks the profile and signs out.
- **AC-3.** A new password that breaks a rule is refused with the exact line for that problem.
- **AC-4.** A new password equal to the current one is refused.
- **AC-5.** A mismatched confirm is refused.
- **AC-6.** A good change ends on `done`; the old password then fails and the new one works.
- **AC-7.** On a timeout or unavailable service the password stays as it was.

#### 9. Scenarios

| ID | Covers | Persona | Setup and conditions | Expected |
|---|---|---|---|---|
| T-1 | AC-1 | `alex.morgan` | `now` 6 minutes after sign-in; submit. | `STEP_UP_REQUIRED`; after step-up the form submits. |
| T-2 | AC-2 | `alex.morgan` | Wrong current password ×1 then ×3. | "2 tries left"; then `LOCKED`, signed out. |
| T-3 | AC-3 | `alex.morgan` | `Ab1!`; `aaaaaaaa`; `alex.morgan1!`. | `MIN_LENGTH`, `DIFFERENT_CHARS`, `CONTAINS_USERNAME` lines. |
| T-4 | AC-4 | `alex.morgan` | New equals `Bwx!Demo2026`. | `SAME_AS_CURRENT`. |
| T-5 | AC-5 | `alex.morgan` | Confirm differs. | `MISMATCH`. |
| T-6 | AC-6 | `alex.morgan` | New `Aurora#Sky2026`. | `done`; old password answers `INVALID_CREDENTIALS`; new one signs in. |
| T-7 | AC-7 | `alex.morgan` | `conditions.timeout: ["bank.password.change"]`. | Timeout message; old password still works. |
| T-8 | AC-7 | `alex.morgan` | `conditions.unavailable: ["bank.password.change"]`. | Unavailable message; old password still works. |

#### 10. Expected mutation-check survivors
| Mutant | Why it survives |
|---|---|
| "Other sessions signed out" removed | The sandbox has one session. |
| The "different from current" caption line removed | Copy only; T-4 checks the rule, not the caption. |

---

### ★ Trusted devices — `trusted-devices`

#### 1. Summary

| Item | Value |
|---|---|
| Slug | `trusted-devices` |
| Purpose | See the devices that skip the new-device code, rename them, and remove any that are lost or old. |
| Release | 1 |
| Workspace | `personal` |
| Status | New. No CAB equivalent; devices are the `cab.device.*` idea extended (planned `bank.devices.*`). |
| Channels | Web, mobile |
| Starting pattern | CAB `default-sign-in` (device options) for the data, `manage-beneficiary` style list for the screens |
| Who may use it | A signed-in person with `security.manage`. |

#### 2. Entry points

| Place | Launch point | Passes | Permission |
|---|---|---|---|
| More › settings › security | Trusted devices | `{deviceId}` optional | `security.manage` |
| `sign-in` › `trustDevice` | Manage trusted devices (when the limit is reached) | – | `security.manage` |
| Login history row detail | Manage this device | `{deviceId}` | `security.manage` |
| Notification "New sign-in on {device}" | Review devices | – | `security.manage` |

Leads to: Settings › Security. Removing the current device leads to Landing.

#### 3. Screens

Step-up first (300 s). Cancel returns to Settings.

**Screen `list` — "Trusted devices"** (blocks: `text`, `dataTable` planned (rows as cards on phones), `alert`, `button`)

| Column | Content |
|---|---|
| Device | Name and kind icon (phone, laptop). The current one carries the chip "This device". |
| Last used | `12 Nov 2026 09:14` and place |
| Trusted since | `04 Sep 2026` |
| Sign in with | Password, Quick PIN or Biometrics |

Copy: body "These devices don't ask for a code when you sign in. You can have up to 5. Remove any you don't recognise or no longer use." Counter "{n} of 5". Sort: last used, newest first. No filters. Tap a row → `detail`.
- Seed for Alex: "Alex's iPhone" (this device, Biometrics), "Work laptop (Chrome)" (Password), "Old Android phone" (last used 12 Jul 2026).
- **Empty.** "No trusted devices yet. Choose Remember this device the next time you sign in." (no button).
- **Loading.** Skeleton rows. **Error.** Standard `SERVICE_UNAVAILABLE` / `TIMEOUT` panel with "Try again".

**Screen `detail` — "{deviceName}"** (blocks: `reviewSummary`, `button`) Rows: Name, Model and system (e.g. "iPhone 16, iOS 20"), Trusted since, Last used, Place (approximate), Network address (partly hidden), Sign in with. Buttons: "Rename" → `rename`; "Remove this device" (secondary, danger style) → `confirmRemove`; "Back" → `list`.

**Screen `rename` — "Rename device"** (blocks: `textInput`, `button`)

| Field | Block | Required | Rule | Error message |
|---|---|---|---|---|
| Device name | `textInput` | Yes | 1 to 40 characters; not already used by another of the person's devices (not case sensitive) | "Give this device a name (up to 40 characters)." / "You already have a device called {name}. Choose another name." |

Button "Save" → `callApi rename` → `renamed`. Toast and `renamed` result: "Device renamed to {name}." Button "Done" → `list`.

**Screen `confirmRemove` — "Remove {deviceName}?"** (blocks: `alert`, `reviewSummary`, `button`) Alert (warning): "{deviceName} will be signed out and will ask for a one-time code next time. Its quick PIN and biometrics will be turned off." If it is the current device, an extra alert: "This is the device you're using. You'll be signed out." Summary rows: Device, Last used, Place. Buttons: "Remove device" (primary, danger) → `callApi remove` → `removed`; "Keep device" (ghost) → `detail`.

**Screen `removed` — "Device removed"** (terminal) Result (success): title "{deviceName} was removed", text "It will ask for a one-time code the next time it signs in.", meta "Reference {reference}". Buttons: "Back to devices" → `list`; if it was the current device, "Sign in" → Landing (the app signs out first).

#### 4. Sandbox errors

| Code | Message | Screen | Button |
|---|---|---|---|
| `STEP_UP_REQUIRED` | "For your security, confirm it's you first." | step-up dialog | Confirm |
| `DEVICE_NOT_FOUND` (planned) | "That device is no longer on your list." | `list` (after refresh) | Back to devices |
| `DEVICE_NAME_INVALID` (planned) | "Give this device a name (up to 40 characters)." | `rename` | Edit |
| `DEVICE_NAME_TAKEN` (planned) | "You already have a device called {name}. Choose another name." | `rename` | Edit |
| `PERMISSION_DENIED` | "This isn't available for your profile." | `list` | Back |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | the calling screen | Try again |
| `SERVICE_UNAVAILABLE` | Standard S-`SERVICE_UNAVAILABLE` | the calling screen | Try again |
| `SESSION_EXPIRED` | Standard S-`SESSION_EXPIRED` | Landing | Sign in |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Error codes | Status | moneyMoving | requiresOtp |
|---|---|---|---|---|---|---|---|
| `list` | `bank.devices.list` | `{}` | `{ devices: [{ id, name, model, platform, trustedSince, lastUsed, place, ipMasked, method, current }], max: 5 }` | `SESSION_EXPIRED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | Planned | No | No |
| `rename` | `bank.devices.rename` | `{ deviceId, name }` | `{ ok: true, name }` | `DEVICE_NOT_FOUND`, `DEVICE_NAME_INVALID`, `DEVICE_NAME_TAKEN`, `STEP_UP_REQUIRED` | Planned | No | Via step-up |
| `remove` | `bank.devices.remove` | `{ deviceId }` | `{ ok: true, reference }` (the device's quick PIN and biometrics are cleared; its sessions end) | `DEVICE_NOT_FOUND`, `STEP_UP_REQUIRED`, `PERMISSION_DENIED` | Planned | No | Via step-up |

#### 6. Permissions, step-up and limits
Permission `security.manage`. Step-up `stepup`. Limit: 5 trusted devices; a new device that would be the sixth is refused at sign-in (`DEVICE_LIMIT`).

#### 7. Result and links out
Result `removed` or `renamed`, with a reference. Notification: "A trusted device was removed: {deviceName}" (email and in-app). If the removed device is not the current one, its next sign-in asks for a code. Links: Settings › Security, `sign-in`.

#### 8. Acceptance criteria
- **AC-1.** The list shows each trusted device with its last use, and marks the current one.
- **AC-2.** The journey cannot change anything without a fresh step-up.
- **AC-3.** A device can be renamed; empty, over-long or duplicate names are refused with the exact message.
- **AC-4.** Removing a device needs a second confirmation and then the device disappears from the list.
- **AC-5.** After removal the device's next sign-in asks for a one-time code and has no quick PIN or biometrics.
- **AC-6.** Removing the current device signs the person out.
- **AC-7.** A device removed elsewhere in the meantime is reported as no longer on the list.
- **AC-8.** On a timeout or unavailable service nothing is changed.

#### 9. Scenarios

| ID | Covers | Persona | Setup and conditions | Expected |
|---|---|---|---|---|
| T-1 | AC-1 | `alex.morgan` | Seed devices. | 3 rows; "Alex's iPhone" has "This device"; sorted by last use. |
| T-2 | AC-2 | `alex.morgan` | `now` 6 min after sign-in; rename. | `STEP_UP_REQUIRED`; after step-up it succeeds. |
| T-3 | AC-3 | `alex.morgan` | Rename to an empty name; 41 characters; "Work laptop (Chrome)". | `DEVICE_NAME_INVALID` ×2; `DEVICE_NAME_TAKEN`. Valid name saved: "Device renamed to …". |
| T-4 | AC-4, AC-5 | `alex.morgan` | Remove "Old Android phone"; then sign in from it. | List has 2 rows; new-device code is asked. |
| T-5 | AC-6 | `alex.morgan` | Remove the current device. | Signed out; Landing. |
| T-6 | AC-7 | `alex.morgan` | Remove a device twice. | Second call: `DEVICE_NOT_FOUND`. |
| T-7 | AC-8 | `alex.morgan` | `conditions.timeout: ["bank.devices.remove"]`. | Timeout message; device still listed. |
| T-8 | AC-8 | `alex.morgan` | `conditions.unavailable: ["bank.devices.list"]`. | Unavailable panel; no list. |
| T-9 | AC-8 | `alex.morgan` | `conditions.empty: ["bank.devices.list"]`. | Empty state text. |

#### 10. Expected mutation-check survivors
| Mutant | Why it survives |
|---|---|
| Place or network address shown wrongly | Display data from the seed; no rule depends on it. |
| "Sort by last used" reversed | Survives unless T-1 asserts order of all three; it does, so it should be killed. |
| Current-device "sessions end" removed | The sandbox has one session; T-5 asserts the sign-out through the journey result instead. |

---

### ★ Change quick PIN — `change-quick-pin`

**Prototype note:** The new PIN follows the `sign-in` PIN rules (6 digits; no repeats, runs, 112233, 123123, 121212, 696969, 000111 or phone digits).

#### 1. Summary

| Item | Value |
|---|---|
| Slug | `change-quick-pin` |
| Purpose | Replace the six-digit quick PIN used to sign in on this device. |
| Release | 1 |
| Workspace | `personal` |
| Status | New. Built from CAB `default-sign-in` (`pin-new`, `pin-confirm`, `pin-intro`) with `cab.device.verifyPin` and `cab.device.setDefault`. |
| Channels | Web, mobile |
| Starting pattern | CAB `default-sign-in` |
| Who may use it | A signed-in person with `security.manage` and a PIN already set. |

#### 2. Entry points

| Place | Launch point | Passes | Permission |
|---|---|---|---|
| More › settings › security › Quick PIN | Change | – | `security.manage` |

If no PIN is set the row says "Set up" and opens `setup-quick-login` instead. Leads to: Settings › Security.

#### 3. Screens

Step-up first (300 s).

**Screen `currentPin` — "Enter your current PIN"** (blocks: `text`, `otp` `length: 6`, `keypad: true`, `masked: true`, `alert`, `button`, `menu`)

| Field | Block | Required | Rule | Error message |
|---|---|---|---|---|
| Current PIN | `otp` masked keypad | Yes | 6 digits; must match the saved PIN (`bank.device.verifyPin`) | "A PIN is six digits." / "That PIN is not right. {n} tries left." |

Button "Continue" → `newPin`. Link "I forgot my PIN": explains "You've just confirmed it's you, so you can set a new one." and opens `setup-quick-login` with `{mode: "pin"}` (no current PIN needed). Three wrong PINs share the sign-in counter and end on `locked`.

**Screen `newPin` — "Enter new Sign in PIN"** (hint "Step 1 of 2") and **`confirmPin` — "Re-enter new Sign in PIN"** (hint "Step 2 of 2"); same `otp` block.

| Field | Block | Required | Rule | Error message |
|---|---|---|---|---|
| New PIN | `otp` masked keypad | Yes | Exactly 6 digits; not all the same; not a straight run; different from the current PIN | "A PIN is six digits." / "That PIN is too easy to guess. Avoid repeated or running numbers like 111111 or 123456." / "Choose a PIN different from your current one." |
| Re-enter new PIN | `otp` masked keypad | Yes | Equal to the new PIN | "The PINs do not match. Enter the same PIN twice." |

Button "Change PIN" on `confirmPin`: `callApi setDefault` (`mode` stays what it was: `pin` if the default was `pin`; otherwise the default is kept and only the PIN is replaced) → `done`.

**Screen `done` — "PIN changed"** (terminal) Result (success): title "Your quick PIN was changed", text "Use the new PIN next time you sign in on this device.". Button "Done" → Settings › Security.

**Terminal screen `locked`.** Error "Your profile is locked", text "Too many wrong PINs. You're signed out, and sign in is blocked for 30 minutes.", button "Unlock account" → `unlock-account`.

States: **Loading** – spinner on buttons. **Timeout / unavailable** – standard messages; the old PIN stays.

#### 4. Sandbox errors

| Code | Message | Screen | Button |
|---|---|---|---|
| `STEP_UP_REQUIRED` | "For your security, confirm it's you first." | step-up dialog | Confirm |
| `INVALID_PIN` (`attemptsLeft`) | "That PIN is not right. {n} tries left." | `currentPin` | Try again |
| `LOCKED` | `locked` text | `locked` | Unlock account |
| `PIN_INVALID` | "A PIN is six digits." | PIN screens | Edit |
| `PIN_TOO_SIMPLE` (planned) | "That PIN is too easy to guess. Avoid repeated or running numbers like 111111 or 123456." | `newPin` | Edit |
| `PIN_SAME_AS_CURRENT` (planned) | "Choose a PIN different from your current one." | `newPin` | Edit |
| `PIN_NOT_SET` (planned) | "You haven't set a quick PIN yet." | `currentPin` | Set up (→ `setup-quick-login`) |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | the calling screen | Try again |
| `SERVICE_UNAVAILABLE` | Standard S-`SERVICE_UNAVAILABLE` | the calling screen | Try again |
| `SESSION_EXPIRED` | Standard S-`SESSION_EXPIRED` | Landing | Sign in |

The mismatch message is local to the journey.

#### 5. Adapters

| Integration id | Adapter | Request | Response | Error codes | Status | moneyMoving | requiresOtp |
|---|---|---|---|---|---|---|---|
| `verifyPin` | `bank.device.verifyPin` (CAB: `cab.device.verifyPin`) | `{ pin }` | `{ ok: true, … }` (the sign-in data is ignored here) or `{ ok: false, code: "INVALID_PIN", attemptsLeft }` | `PIN_NOT_SET`, `LOCKED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | Planned | No | No |
| `setDefault` | `bank.device.setDefault` (CAB: `cab.device.setDefault`) | `{ mode: "pin", pin }` | `{ ok: true, default }` | `PIN_INVALID`, `PIN_TOO_SIMPLE`, `PIN_SAME_AS_CURRENT`, `STEP_UP_REQUIRED`, `SESSION_EXPIRED` | Planned | No | Via step-up |

#### 6. Permissions, step-up and limits
Permission `security.manage`. Step-up `stepup`. Limits: six digits; 3 wrong current PINs lock the profile.

#### 7. Result and links out
Result `done`. Notification: "Your quick PIN was changed on {deviceName}" (in-app). Links: Settings › Security, `setup-quick-login`, `unlock-account`.

#### 8. Acceptance criteria
- **AC-1.** The journey needs a fresh step-up and the right current PIN before a new one can be entered.
- **AC-2.** A wrong current PIN shows the tries left; the third wrong PIN locks the profile.
- **AC-3.** A new PIN must be six digits, not repeated or running, and different from the current one.
- **AC-4.** Two different new PINs are refused.
- **AC-5.** A good change saves the new PIN; the old PIN then fails at sign-in and the new one works.
- **AC-6.** The default sign-in method is not changed by changing the PIN.
- **AC-7.** "I forgot my PIN" skips the current PIN only after the step-up.
- **AC-8.** On a timeout or unavailable service the old PIN stays.

#### 9. Scenarios

| ID | Covers | Persona | Setup and conditions | Expected |
|---|---|---|---|---|
| T-1 | AC-1 | `alex.morgan` | PIN `482916` set; `now` 6 min after sign-in. | `STEP_UP_REQUIRED` before `currentPin` is accepted. |
| T-2 | AC-2 | `alex.morgan` | Wrong current PIN once, then twice more. | "2 tries left"; third → `locked`. |
| T-3 | AC-3 | `alex.morgan` | New `12345`; `111111`; `123456`; `482916`. | `PIN_INVALID`; `PIN_TOO_SIMPLE` ×2; `PIN_SAME_AS_CURRENT`. |
| T-4 | AC-4 | `alex.morgan` | `735190` then `735191`. | Mismatch alert. |
| T-5 | AC-5, AC-6 | `alex.morgan` | Default `biometric`, PIN `482916`; change to `735190`. | `done`; `verifyPin 482916` fails; `735190` works; `default` still `biometric`. |
| T-6 | AC-7 | `alex.morgan` | Choose "I forgot my PIN". | Opens `setup-quick-login` mode `pin`; no current PIN asked. |
| T-7 | AC-8 | `alex.morgan` | `conditions.timeout: ["bank.device.setDefault"]`. | Timeout message; `482916` still works. |
| T-8 | AC-8 | `alex.morgan` | `conditions.unavailable: ["bank.device.setDefault"]`. | Unavailable message; `482916` still works. |

#### 10. Expected mutation-check survivors
| Mutant | Why it survives |
|---|---|
| `masked: true` removed on the PIN blocks | Display only. |
| The "forgot my PIN" link removed | Survives if no scenario follows the link; T-6 does, so it should be killed. |
| Step-up window changed from 300 to 301 seconds | The scenario clock steps by minutes; a one-second change cannot be told apart. |

**Prototype reconciliation (from `sign-in`).** The new-PIN rules match the quick PIN set-up in `sign-in`: 6 digits; not repeated (111111); not a run (123456, 654321); not a repeated pair (121212, 696969); not 112233, 123123 or 000111; not containing the last four digits of the phone ("Don't use digits from your phone number. (PIN_WEAK)"). In the prototype a wrong quick PIN at sign-in answers `QUICK_PIN_INVALID` ("That PIN isn't right.") and does not yet count toward the lock; this file's shared counter of 3 (now 5 for sign-in) is still the intended rule.

---

**README changes needed (from this group).**
1. Section 5.2: add the launch point `More › settings › security › login history row › This wasn't me` → `new-message` `{topic: "security"}`, `messages.send`.
2. Section 5.1/5.2: add `Landing › sign-in help › Account locked?` → `unlock-account`, none; and `reset-password` ‹ `unlock-account` done screen "Choose a new password too".
3. Section 5.2: `trusted-devices` is also launched from `sign-in › trustDevice` (device limit), the login-history row detail and the "New sign-in on {device}" notification; `change-password` from the login-history row detail and the new-place notification.
4. Section 1.6 or 4.3: add the step-up validity (300 s) and the shared failed-attempt counter (3 total across password, PIN and step-up) as platform rules; add error codes `STEP_UP_FAILED`, `LOCKED`, `INVALID_PIN`, `DEVICE_LIMIT`.
5. Section 2.3: list the new adapters of this group (`bank.auth.*`, `bank.device.*`, `bank.devices.*`, `bank.recover.*`, `bank.account.*`, `bank.password.*`, `bank.captcha.generate`, `bank.session.keepAlive`, `bank.loginHistory.list`, `bank.system.status`).

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

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `open-another-account` |
| Purpose | An existing customer opens a new current, savings or foreign-currency account, with no paperwork (KYC is already done). |
| Release / workspace | 1 / Personal |
| Status | New (planned). Not to be confused with `open-account` (Public, new customers). |
| Channels | Web and mobile |
| Starting pattern | None. Product, details, review with terms, result. |
| Who may use it | `accounts.manage` and KYC `verified` |

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Accounts › list › Open another account | none | `accounts.manage` |
| Home › Accounts row › Open another account | none | `accounts.manage` |
| Home › Offer › Apply | `{offerId}` (prefills the product) | `accounts.manage` |

#### 3. Screens

**`product` — "Choose an account"** (entry). Blocks: `stepper` (product, details, review), `select` tiles (`open.productId`), `alert`, `button`. Tiles come from `bank.products.list` (planned): Everyday current (USD, no fee), Savings plus (USD, 3.10% a year, no fee), Travel EUR (EUR, no fee), Home AED (AED, no fee). Each tile shows name, currency, one line, and a fee line.

- Title "Choose an account". Helper "You can have up to 6 accounts."
- Field: Product, `select` tiles, required, message "Choose an account type."
- Button **Continue**. Alert (warning) appears when the person already holds 6 accounts: "You already have 6 accounts, the most you can hold. Close one to open another." and Continue is disabled.

**`details` — "Account details"**. Fields:

| Field | Block | Required | Validation | Error message |
|---|---|---|---|---|
| Account name | `textInput` | Yes (prefilled with the product name) | Same rule as `account-nickname` (2 to 24 characters) | "Enter a name of 2 to 24 characters." |
| Purpose of account | `select` ("Everyday spending", "Saving", "Travel", "Bills", "Other") | Yes | One of the list | "Choose a purpose." |
| Opening deposit (optional) | `amountInput` in the new account's currency, from a funding account | No | 0 or between 1 and the funding account's available balance; the sandbox moves it with `bank.transfers.own` (planned) | "The smallest deposit is 1." / "There isn't enough money in {account}." |
| Fund from | `accountPicker` (shown when a deposit is entered) | Yes if deposit | Must be a USD account if the new account is USD, else the deposit is converted; R1 allows same-currency only | "Choose an account in {currency}." |

Button **Continue**.

**`review` — "Review"**. `reviewSummary` rows: Account type, Name, Currency, Interest ("3.10% a year" or "None"), Fee ("$0"), Opening deposit. `consent` (`open.consent`, `termsVersion` "accounts-v1"): "I have read and agree to the account terms" with a link to the terms; message "Tick the box to continue". Button **Open account**.

**`success` — "Account opened"** (terminal). `result` success: title "Account opened", text "{name} ••{mask} is ready. Your IBAN is {iban}.", meta "Ref {reference}". Buttons **View account** (Accounts › detail of the new id), **Done**.

**`failed`** (terminal). Error result with the message from section 4 and **Try again**.

Opening an account is not money-moving unless a deposit is added. With a deposit the screen order is review, consent, OTP (standard block P-OTP below), result. Without a deposit no OTP is asked. (Rule: OTP when `deposit > 0`.)

**`otp`** (only with a deposit): standard OTP screen. Title "Enter your code", body "We sent a 6-digit code to {maskedPhone}.", 6 digits, 3 attempts, resend after 30 s, button **Open and deposit {amount}**; after three wrong codes the `locked` screen: "Too many wrong codes" / "You entered the wrong code 3 times, so we stopped. No money has left your account." with **Start again** and **Close**.

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `PRODUCT_NOT_FOUND` (planned) | "That account type isn't available. Choose another." | `failed` | Choose account |
| `ACCOUNT_LIMIT_REACHED` (planned) | "You already have 6 accounts, the most you can hold. Close one to open another." | `product` | Back |
| `NAME_INVALID` / `NAME_EXISTS` (planned) | as in `account-nickname` | `details` | Edit |
| `INVALID_AMOUNT` | "The smallest deposit is 1." | `details` | Change amount |
| `INSUFFICIENT_FUNDS` | "There isn't enough money in {account}. Available: {balance}. No money has left your account." | `failed` | Change amount |
| `ACCOUNT_NOT_FOUND` | "We can't find that account. Choose another." | `details` | Choose account |
| `OTP_INVALID` / `OTP_REQUIRED` | Standard S-`OTP_INVALID` / S-`OTP_REQUIRED` | `otp` | Try again / Back to code |
| `CORE_UNAVAILABLE` | "We couldn't complete this right now. No money has left your account." | `failed` | Try again |
| `NOT_SUPPORTED` | "This isn't available for your profile." (KYC not verified) | `failed` | Back |
| `TIMEOUT` (planned) | "This is taking longer than expected. Nothing was changed." (no deposit); "We didn't get an answer in time. Check Activity before you try again, so you don't pay twice." (with deposit) | `failed` | Try again / Check Activity |
| `SERVICE_UNAVAILABLE` (planned) | Standard message | `failed` | Try again |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `accounts` | `bank.accounts.list` | none | accounts | none | Existing |
| `products` | `bank.products.list` | `{kind: "account"}` | map of `{id, name, currency, rate, fee, text}` | none | (planned) |
| `open` | `bank.accounts.open` | `{productId, name, purpose, openingDeposit?, fromAccountId?}` | `{accountId, maskedNumber, iban, currency, reference}` | `PRODUCT_NOT_FOUND`, `ACCOUNT_LIMIT_REACHED`, `NAME_INVALID`, `NAME_EXISTS`, `INVALID_AMOUNT`, `INSUFFICIENT_FUNDS`, `ACCOUNT_NOT_FOUND`, `OTP_REQUIRED`, `CORE_UNAVAILABLE`, `NOT_SUPPORTED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned). `moneyMoving: true` only when a deposit is given; `requiresOtp: true` only then |
| `otpSend` / `otpVerify` | `bank.otp.send` / `bank.otp.verify` | `{channel}` / `{code}` | `{sent, maskedPhone}` / `{verified}` | `OTP_INVALID` (with `attempt`) | Existing |

A new EUR or AED account also needs a daily limit for its currency: `limitsByCurrency` for `alex` gets EUR 20,000 and AED 100,000 (planned seed). Without it `bank.limits.get` answers `LIMIT_NOT_SET` today.

#### 6. Permissions, step-up and limits

`accounts.manage`. Step-up `none` without a deposit; `otp` with one. Maximum 6 accounts. Deposit counts against the daily limit of the funding account's currency.

#### 7. Result and links out

Result as above. Receipt (planned engine receipts): account type, name, IBAN, opening date, deposit if any, reference. Notifications: "Your new account {name} is open" (in-app). Buttons: **View account**, **Done**.

#### 8. Acceptance criteria

- AC-1: Without a deposit the person opens an account after accepting the terms and without a code; the account appears in the list with a valid IBAN.
- AC-2: The terms box must be ticked; otherwise "Tick the box to continue".
- AC-3: With a deposit the person must verify a one-time code before any money moves; the deposit leaves the funding account and arrives in the new one.
- AC-4: A person with 6 accounts cannot continue and sees the exact message.
- AC-5: A deposit larger than the funding balance is refused and no account is opened.
- AC-6: Three wrong codes stop the journey with "Too many wrong codes" and nothing changes.
- AC-7: Unavailable and timeout leave the account list unchanged.

#### 9. Scenarios

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-2 | `alex` | none | Choose Savings plus, name "Rainy day", no deposit, tick terms, Open account. Result with IBAN; `bank.accounts.list` has 5 accounts (planned seed has 4). Without ticking: "Tick the box to continue". |
| T-2 | AC-3 | `alex` | none | Deposit $500.00 from Main; enter `482100`. Main 8,720.76 becomes 8,220.76; new account 500.00. |
| T-3 | AC-4 | `alex`, setup: 6 accounts | none | Continue is disabled with the 6-account message. |
| T-4 | AC-5 | `alex` | none | Deposit $9,000.00 from Main. `INSUFFICIENT_FUNDS` message; account count unchanged. |
| T-5 | AC-6 | `alex` | none | With a deposit, enter `111111` three times. "Too many wrong codes"; balances unchanged. |
| T-6 | AC-7 | `alex` | `timeout: ["bank.accounts.open"]` | With a deposit: "We didn't get an answer in time. Check Activity before you try again, so you don't pay twice." |
| T-7 | AC-7 | `alex` | `unavailable: ["bank.accounts.open"]` | Standard unavailable message; nothing opened. |

#### 10. Expected mutation-check survivors

The 6-account cap is also checked in the UI (disabled button), so removing only the sandbox rule survives T-3; expected, the UI layer stops it.

---

### ★ Create a budget — `create-budget`

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `create-budget` |
| Purpose | Set a monthly (or weekly) spending limit for one category and get an alert as it fills. |
| Release / workspace | 1 / Personal |
| Status | Existing, upgraded (`packages/journey-schema/src/fixtures/bankworkx.ts`, `createBudget`, id `jrn_create_budget`). |
| Channels | Mobile today (`channels: ["mobile"]`, `apps: ["bankworkx"]`); web added. |
| Starting pattern | The fixture itself. |
| Who may use it | `accounts.manage` |

**What exists today.** Two working screens. `setup`: a `stepper` (setup, review); a `select` of tiles `budget.category` (Food & Drinks, Shopping, Transport, Health, Travel, Bills, each with an icon); an `amountInput` `budget.limit` in USD labelled "Monthly limit" (helper "Choose an amount from $10 to $100,000", quick amounts 100, 250, 500, 1000, `min 10`, `max 100000`, messages "A budget must be at least $10" and "A budget can be at most $100,000"); a `toggle` `budget.alert` "Alert me at 80%" (helper "We'll tell you when you're close to the limit"). `review`: a `reviewSummary` (Category, Monthly limit, Resets "Every month") and **Create budget**, which calls `createBudget` (`bank.budgets.create` with `{category, limit}`). Then `success` ("Budget created", "{category}: ${limit} a month. You'll see it on your dashboard.") and `failed` ("We couldn't create this budget", "You may already have a budget for this category. Try a different one.", **Try again**). Faults found in the code: the alert toggle is never sent to the adapter; the sandbox saves every new budget with `category: "shopping"` whatever was chosen; every failure shows one message whatever the cause.

**The upgrade.** Send the alert and the period; save the real category; show the specific message for each error code; accept `{category}` from Spending analysis and Transaction detail; add a period choice. No consent and no OTP: a budget moves no money (stated on purpose).

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Accounts › budgets › New budget | `{category}` optional | `accounts.manage` |
| Accounts › spending analysis › Set a budget | `{category}` | `accounts.manage` |
| Accounts › transaction detail › Create a budget for {category} | `{category}` | `accounts.manage` |
| Home › Insights › Budgets tile (when none exists) | none | `accounts.manage` |

#### 3. Screens

**`setup` — "New budget"** (entry; existing, upgraded). `stepper` ["setup", "review"].

| Field | Block | Required | Validation | Error message |
|---|---|---|---|---|
| Category | `select` tiles, label "What are you budgeting for?", choices Food & Drinks, Shopping, Transport, Health, Travel, Bills (prefilled from `{category}`) | Yes | One of the six; not an existing budget | "Choose a category." / "You already have a {name} budget" |
| Monthly limit | `amountInput` USD, helper "Choose an amount from $10 to $100,000", quick amounts 100, 250, 500, 1000 | Yes | 10 to 100,000, two decimals | "A budget must be at least $10" / "A budget can be at most $100,000" |
| Period (new) | `select` chips: Monthly (default), Weekly | Yes | One of two | "Choose how often it resets." |
| Alert me at 80% | `toggle`, helper "We'll tell you when you're close to the limit" | No (default on) | none | none |

Button **Continue** (validate, then `review`). A tile for a category the person already budgets shows "Already set" and is not selectable (the list comes from `bank.budgets.list`, loaded `onEnter`).

**`review` — "Review budget"** (existing, upgraded). `reviewSummary` rows: Category, Limit ("${limit} a month" or "a week"), Resets ("Every month" or "Every Monday"), Alert ("At 80%" or "Off"). Button **Create budget** (calls `createBudget` with `{category, limit, period, alert}`; `onError` navigates to `failed`; success to `success`). Link **Edit** (back to `setup`).

**`success` — "Budget created"** (terminal; existing text kept). Text "{category}: ${limit} a month. You'll see it on your dashboard." Buttons **View budgets** (Accounts › budgets), **Done**.

**`failed` — "Budget not created"** (terminal; upgraded). `result` error whose text is chosen by code (section 4). Button **Try again** (back to `setup`) and **Close**.

States: Loading — `setup` shows skeleton tiles until the budget list loads; Create budget has a spinner. Empty — not applicable. Error — as above.

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `INVALID_AMOUNT` | "A budget must be between $10 and $100,000" | `setup` (on the limit) | Change amount |
| `CATEGORY_REQUIRED` | "Choose a category" | `setup` | Choose category |
| `BUDGET_EXISTS` | "You already have a {name} budget" | `failed` with text "You already have a {name} budget. Choose a different category." | Try again |
| `NOT_SUPPORTED` | "This isn't available for your profile." | `failed` | Back |
| `TIMEOUT` (planned) | "This is taking longer than expected. Nothing was changed." | `failed` | Try again |
| `SERVICE_UNAVAILABLE` (planned) | Standard message | `failed` | Try again |

The wording of the first three is the sandbox's own (`index.ts`, `bank.budgets.create`).

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `budgets` | `bank.budgets.list` | none | map of `{id, name, category, limit, spent}` | none | Existing |
| `createBudget` | `bank.budgets.create` | Today `{category, limit}`; upgraded `{category, limit, period, alert}` | `{budgetId, name, limit}` (upgraded adds `period`, `alert`, `category` stored as chosen, not always "shopping") | `INVALID_AMOUNT`, `CATEGORY_REQUIRED`, `BUDGET_EXISTS`, `NOT_SUPPORTED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | Existing, upgraded. `moneyMoving: false`, `requiresOtp: false` |

#### 6. Permissions, step-up and limits

`accounts.manage`; step-up `none`. Limits: $10 to $100,000 per budget. At most one budget per category.

#### 7. Result and links out

Result as above; no receipt. Notification when spent reaches 80% (if Alert is on) and 100%: "{Category} budget is {pct}% used" (the existing `notifications` wording). Buttons: **View budgets** (shell), **Done** (origin).

#### 8. Acceptance criteria

- AC-1: A new budget with a valid category and limit appears in the budgets list with spent $0.00.
- AC-2: A limit under $10 or over $100,000 is refused with the exact message.
- AC-3: A second budget for the same category is refused with "You already have a {name} budget".
- AC-4: The category the person chose is the category saved (not "shopping").
- AC-5: The alert choice and the period are saved with the budget.
- AC-6: The journey never asks for a code or consent and never changes an account balance.
- AC-7: A timeout or an unavailable service creates no budget.

#### 9. Scenarios

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-4, AC-5, AC-6 | `alex` | none | Transport, $250, monthly, alert on. Budgets list now has 4; the new one has category transport, spent 0, alert on; balances unchanged. |
| T-2 | AC-2 | `alex` | none | $5 and $150,000 give the two messages; no call. |
| T-3 | AC-3 | `alex` | none | Food & Drinks, $500: `BUDGET_EXISTS`; text "You already have a Food & Drinks budget". |
| T-4 | AC-1 | `alex` | none | Open with `{category: "Health"}`: the Health tile is preselected. |
| T-5 | AC-7 | `alex` | `timeout: ["bank.budgets.create"]` | Failed screen with timeout copy; list still 3. |
| T-6 | AC-7 | `alex` | `unavailable: ["bank.budgets.create"]` | Failed screen with the standard message; list still 3. |

#### 10. Expected mutation-check survivors

None expected. (`requiresOtp: false` is deliberate; there is no OTP rule to mutate.)

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

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `mobile-topup` |
| Purpose | Add credit to a mobile number from an account. |
| Release / workspace | 1 / Personal |
| Status | New (planned journey). The adapter `bank.topup.create` and the list `bank.carriers.list` already exist in the sandbox (`index.ts`) but no journey uses them. |
| Channels | Web and mobile |
| Starting pattern | `fixtures/pay-bill.ts` (choose, enter, review, consent, OTP, result) |
| Who may use it | `payments.create` |

**What exists today in the sandbox.** `bank.carriers.list` returns Jazz, Zong, Telenor, Ufone (Pakistan). `bank.topup.create` takes `{fromAccountId, amount}` and ignores any carrier or number. It enforces one rule for every currency: **50 to 5,000** (`INVALID_AMOUNT`, "Top-up must be between 50 and 5,000"), which is a Pakistani rupee rule. It then needs the code (`OTP_REQUIRED`), checks `CORE_UNAVAILABLE`, `ACCOUNT_NOT_FOUND`, `INSUFFICIENT_FUNDS`, `LIMIT_EXCEEDED`, and answers `{reference (TOP-…), newBalance}`.

**The generalisation (planned).** The range belongs to the currency. A table in the sandbox, returned by `bank.carriers.list` as `min`, `max` and `presets`:

| Currency | Min | Max | Quick amounts |
|---|---|---|---|
| USD | 5.00 | 200.00 | 10, 20, 50, 100 |
| EUR | 5.00 | 200.00 | 10, 20, 50, 100 |
| GBP | 5.00 | 150.00 | 10, 20, 50, 100 |
| AED | 10.00 | 500.00 | 25, 50, 100, 200 |
| PKR (existing rule, kept) | 50 | 5,000 | 100, 300, 500, 1,000 |
| any other | the USD range converted at the mid rate, rounded to the currency | | |

The adapter also takes `carrierId` and `number` and checks them. Alex's carriers (planned seed, synthetic): Aster Mobile, Brightline, Cobalt Wireless, all USD. The Meezan list stays as it is.

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Home › + Top up | none | `payments.create` |
| Payments › hub › Top-up | `{carrierId}` optional | `payments.create` |
| Payments › tracker › payment (top-up) › Repeat payment | `{paymentId}` (prefills carrier and number) | `payments.create` |

#### 3. Screens

**`number` — "Top up a mobile"** (entry). `stepper` ["number", "review", "otp"]. onEnter: `accounts`, `carriers`.

| Field | Block | Required | Validation | Error message |
|---|---|---|---|---|
| Who | `select` chips: **My number** (+1 415 555 0142 from the profile), **Another number** | Yes (default My number) | One of two | "Choose whose number to top up." |
| Mobile number | `textInput`, keyboard number, shown for Another number | Yes | After removing spaces and dashes: `^\+?[0-9]{8,15}$` | "Enter a mobile number of 8 to 15 digits." |
| Carrier | `select` tiles from `ctx.carriers` | Yes | One of the list | "Choose a carrier." |
| Amount | `amountInput` in the account's currency, quick amounts from the table, helper "From $5.00 to $200.00" | Yes | Between the currency's min and max; at most the currency's decimals | "Top-up must be between $5.00 and $200.00" (existing wording, currency formatted) |
| Pay from | `accountPicker` `top.fromAccountId` | Yes | `canDebit`; must hold enough | "Choose an account to pay from." |

Button **Review top-up**. Helper under the number: "Top-ups arrive within a minute."

**`review` — "Review top-up"**. Rows: Number, Carrier, Amount, Fee "$0.00", From. Consent (`termsVersion` "topup-v1"): "I confirm the number and amount are correct". Alert (info): "Top-ups can't be reversed once sent." Button **Confirm and send code**.

**`otp`** — shared C; button **Top up $20.00**. **`success` — "Top-up sent"**: text "$20.00 to +1 415 555 0142 on Aster Mobile", meta "Ref {reference}"; buttons **Track payment**, **View receipt**, **Top up again**, **Done**. **`locked`**, **`timeout`**, **`unavailable`**, **`failed`** — shared C.

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `INVALID_AMOUNT` (existing) | "Top-up must be between {min} and {max}" (sandbox text "Top-up must be between 50 and 5,000" for PKR) | `number` | Change amount |
| `CARRIER_NOT_FOUND` (planned) | "Choose a carrier." | `number` | Choose carrier |
| `NUMBER_INVALID` (planned) | "Enter a mobile number of 8 to 15 digits." | `number` | Edit |
| `NUMBER_NOT_ACTIVE` (planned; sandbox rule: numbers ending in `0000`) | "This number can't be topped up. Check it and try again. No money has left your account." | `number` | Edit number |
| `ACCOUNT_NOT_FOUND` | S-`ACCOUNT_NOT_FOUND` | `failed` | Choose account |
| `INSUFFICIENT_FUNDS` | S-`INSUFFICIENT_FUNDS` | `failed` | Change amount |
| `LIMIT_EXCEEDED` | S-`LIMIT_EXCEEDED` | `failed` | Change amount |
| `OTP_INVALID` / `OTP_REQUIRED` | S-`OTP_INVALID` / S-`OTP_REQUIRED` | `otp` / `failed` | Try again / Back to code |
| `CORE_UNAVAILABLE` | S-`CORE_UNAVAILABLE` | `failed` | Try again |
| `NOT_SUPPORTED` | S-`NOT_SUPPORTED` | `failed` | Back |
| `TIMEOUT` / `SERVICE_UNAVAILABLE` (planned) | shared C | `timeout` / `unavailable` | Check Activity / Try again |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `accounts` | `bank.accounts.list` | none | accounts | none | Existing |
| `carriers` | `bank.carriers.list` | none | map of `{id, name}` (planned adds `currency`, `min`, `max`, `presets`) | none | Existing, extended |
| `otpSend`, `otpVerify` | `bank.otp.*` | as C | as C | `OTP_INVALID` | Existing |
| `topup` | `bank.topup.create` | Today `{fromAccountId, amount}`. Upgraded adds `carrierId`, `number` | `{reference (TOP-…), newBalance}` (upgraded adds `number`, `carrierId`) | `OTP_REQUIRED`, `CORE_UNAVAILABLE`, `INVALID_AMOUNT`, `ACCOUNT_NOT_FOUND`, `INSUFFICIENT_FUNDS`, `LIMIT_EXCEEDED` (planned: `CARRIER_NOT_FOUND`, `NUMBER_INVALID`, `NUMBER_NOT_ACTIVE`, `TIMEOUT`, `SERVICE_UNAVAILABLE`) | Existing, upgraded. Money-moving; OTP |

Worked example: Alex tops up **$20.00** on Aster Mobile for `+1 415 555 0142` from Main. New balance **8,700.76**; reference `TOP-20261102-0931`.

#### 6. Permissions, step-up and limits

`payments.create`; step-up `otp`. Amount range by currency (table above). Counts toward the daily limit (existing). No cooling-off. Business context: `WRONG_CONTEXT`.

#### 7. Result and links out

Receipt: carrier, number, amount, from, reference, time. Notification: in-app and SMS "Top-up sent to {number}. Ref {reference}." Buttons: **Track payment**, **View receipt**, **Top up again**, **Done**.

#### 8. Acceptance criteria

- AC-1: A top-up inside the currency's range, with a valid number and a verified code, debits exactly the amount and returns a `TOP-` reference.
- AC-2: An amount outside the range is refused with the range for that currency; for PKR the existing 50 to 5,000 still applies.
- AC-3: A number that is too short, too long or not numeric is refused on the form.
- AC-4: A number the carrier cannot top up (ending `0000`) is refused and no money leaves.
- AC-5: Money cannot leave before the code is verified.
- AC-6: Not enough money or a daily limit hit moves no money.
- AC-7: Three wrong codes stop the journey.
- AC-8: Timeout and unavailable states move no money and say so.

#### 9. Scenarios

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1 | `alex` | none | My number, Aster Mobile, $20.00, Main, `482100`. Main 8,700.76; `TOP-20261102-0931`. |
| T-2 | AC-2 | `alex`; `ayesha` (PKR) | none | Alex: $4.99 and $200.01 give "Top-up must be between $5.00 and $200.00". Ayesha: 49 and 5,001 give the PKR range. |
| T-3 | AC-3 | `alex` | none | `1234567` and `+1 415 ABC 0142`: "Enter a mobile number of 8 to 15 digits." |
| T-4 | AC-4 | `alex` | none | `+1 415 555 0000`: `NUMBER_NOT_ACTIVE`; Main unchanged. |
| T-5 | AC-5 | `alex` | none | Direct `bank.topup.create` without OTP: `OTP_REQUIRED`. |
| T-6 | AC-6 | `alex`, setup balance 10.00 | none | $20.00: `INSUFFICIENT_FUNDS`. With `usedToday` 49,990: `LIMIT_EXCEEDED`. |
| T-7 | AC-7 | `alex` | none | `111111` three times: `locked`. |
| T-8 | AC-8 | `alex` | `timeout: ["bank.topup.create"]` | `timeout` screen; balance unchanged. |
| T-9 | AC-8 | `alex` | `unavailable: ["bank.topup.create"]` | `unavailable` screen. |

#### 10. Expected mutation-check survivors

The range check exists in the form (`amountInput` validation) and the adapter; the adapter-only mutant is killed by the direct call in T-2. `CARRIER_NOT_FOUND` survives (the tiles only offer real carriers). Others: none expected.

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

**Catalog:** slug `freeze-card`, workspace `personal`, category Cards (Personal: Cards), core no, can a bank switch it off: yes (only together with `card-controls`). Options: none of its own.

**Alias of `card-controls`:** freezing and unfreezing live in two places and there is no separate catalog entry in the prototype:

- On the Cards screen, **Freeze** and **Unfreeze** are instant (toasts "Card frozen" and "Card unfrozen"). A card that is not active cannot be frozen ("Only an active card can be frozen."); a card that is not frozen cannot be unfrozen ("This card isn’t frozen."). If the bank is unavailable the standard connection sheet shows and the card is unchanged.
- In `card-controls` (launch parameter `{cardId, mode: "freeze"}` or `"unfreeze"`, or the "Freeze card" / "Unfreeze card" choice) the change goes through review. Freezing needs no code; **unfreezing asks for a one-time code** (6 digits, 3 tries) because it makes the card easier to use. Result titles "Card frozen" and "Card unfrozen".
- Open point: the Cards screen unfreezes without a code, while `card-controls` asks for one. The product rule is a code; the Cards screen should follow (see `cards` T-6).
- Error codes: `CARD_NOT_ACTIVE`, `CARD_NOT_FROZEN`, `OTP_INVALID`, `OTP_LOCKED`. Adapters `bank.cards.freeze` and `bank.cards.unfreeze` (planned, used by `cards`) and `bank.cards.updateControls` (planned). Acceptance criteria AC-1, AC-2 and AC-12 and scenarios T-1, T-2, T-8 and T-10 of `card-controls` cover it.

---

### ★ Virtual card — `virtual-card`

#### 1. Summary

| Item | Value |
|---|---|
| Slug | `virtual-card` |
| Purpose | Create a card number for online shopping, show its details once, and delete it |
| Release | 1 |
| Workspace | Personal |
| Status | New (draft). Needs the planned cards domain |
| Channels | Web, mobile |
| Starting pattern | Create-and-reveal (details → code → reveal with step-up) |
| Who may use it | Personal context holding `cards.manage` |

A virtual card is a second card number linked to a real card. It spends from the same account, has its own limit and can be deleted without touching the real card. Each real card may have up to 3 live virtual cards.

#### 2. Entry points

| Place › label | Passed | Permission |
|---|---|---|
| Cards › card › Virtual card | `{cardId}` (the parent) | `cards.manage` |
| Card detail › Virtual cards list › a virtual card | `{cardId}` (the virtual card, opens reveal/delete) | `cards.manage` |

#### 3. Screens

**Screen `home` — "Virtual cards".** Lists the virtual cards of the parent (`bank.cards.issued` filtered by `parentCardId`) with nickname, `••last4`, expiry, limit, status chip. Buttons: "Create a virtual card" (to `create`; disabled with helper "You have 3 virtual cards. Delete one to make another." when 3 are live), a row tap opens `manage`. Empty: "You don't have a virtual card yet. Use one to shop online without sharing your real card number."

**Screen `create` — "New virtual card".**

| Field | Block | Required | Rule | Error message |
|---|---|---|---|---|
| Nickname | `textInput` bind `vc.nickname` (pattern `^.{2,24}$`) | Yes | 2 to 24 characters | "Give it a name of 2 to 24 characters, for example Online shopping." |
| Spending limit | `amountInput` bind `vc.spendLimit` (quick 50, 100, 250, 500) | Yes | 1 to the parent's per-transaction ceiling | "Enter an amount from 1 to {{ctx.parent.ceilings.perTransaction}}." |
| How long | `select` chips bind `vc.expiresInMonths`: 1, 3, 12 months | Yes | One of the three | "Choose how long the card lasts." |
| Use once only | `toggle` bind `vc.singleUse` | No | none | none |

Helper under limit: "The card can't spend more than this in total." Alert info "Money comes from {{parent.accountName}}. The virtual card works only online." Button "Continue" (`validate`, `callApi otpSend`, navigate `code`).

**Screen `code`**: standard. Button "Create card" calls `otpVerify`, `create` (`bank.cards.virtual.create`), then navigates to `reveal`.

**Screen `reveal` — "Your virtual card".** Needs step-up: `onEnter` calls `bank.cards.virtual.reveal`. If the answer is `STEP_UP_REQUIRED` the standard step-up sheet appears (planned `bank.session.stepUp`) and the call is retried. Shows number with spaces, expiry, security code, limit, "Copy number" and "Copy security code" (`share` actions). `alert` warning "We show these details once on this screen. Don't screenshot or share them." Details auto-hide after 60 seconds. Buttons "Done" (to `home`), "Delete this card" (to `confirmDelete`).

**Screen `manage` — "{{nickname}} ••{{last4}}".** Shows limit used, status, expiry. Buttons "Show card details" (to `reveal`), "Delete this card" (to `confirmDelete`), "Back".

**Screen `confirmDelete` — "Delete this virtual card?"** Text "Shops that already have this number won't be able to charge it again." Buttons "Delete card" (`callApi delete`, navigate `deleted`), "Keep it".

**Screens `deleted`** (terminal, "Virtual card deleted"), **`locked`**, **`failed`** standard.

#### 4. Sandbox errors

| Code | Message | Screen | Button |
|---|---|---|---|
| `CARD_NOT_FOUND` | "We can't find that card." | `failed` | Back to cards |
| `CARD_NOT_ACTIVE` | "Your card must be active to create a virtual card from it." | `failed` | Go to card |
| `VIRTUAL_LIMIT_REACHED` | "You already have 3 virtual cards for this card. Delete one first." | `home` | Manage cards |
| `LIMIT_ABOVE_CEILING` | "The most a virtual card can be is {{ceiling}}." | `create` | Change limit |
| `STEP_UP_REQUIRED` | "For your security, confirm it's you first." | `reveal` | Confirm |
| `CARD_ALREADY_BLOCKED` | "This virtual card is already deleted." | `failed` | Back |
| `OTP_INVALID`, `OTP_REQUIRED` | Standard | `code` | Try again / Back to code |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | `failed` | Try again |
| `SERVICE_UNAVAILABLE`, `PERMISSION_DENIED`, `WRONG_CONTEXT`, `SESSION_EXPIRED` | Standard | `failed` | Try again / Back / Switch / Sign in |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `cards` | `bank.cards.issued` | none | cards | `NOT_SUPPORTED` | (planned) |
| `parent` | `bank.cards.get` | `{cardId}` | card | `CARD_NOT_FOUND` | (planned) |
| `create` | `bank.cards.virtual.create` | `{cardId, nickname, spendLimit, expiresInMonths, singleUse}` | `{cardId, last4, expiry, status}` | section 4 | (planned) |
| `reveal` | `bank.cards.virtual.reveal` | `{cardId}` | `{number, cvv, expiry}` | `CARD_NOT_FOUND`, `STEP_UP_REQUIRED` | (planned) |
| `delete` | `bank.cards.virtual.delete` | `{cardId}` | `{status: "blocked"}` | `CARD_NOT_FOUND`, `CARD_ALREADY_BLOCKED` | (planned) |

#### 6. Permissions, step-up and limits

`cards.manage`. Create: `otp`. Reveal: `stepup` (re-confirm, then the existing code). Delete: `none`. Limits: spending limit up to the parent's per-transaction ceiling; 3 live virtual cards per parent. The card number appears only in the `reveal` response; it is never stored in journey data or logs.

#### 7. Result and links out

Result: the `reveal` screen is the success state (no `result` block); the receipt is none. Notifications: "Virtual card {{nickname}} created" and "Virtual card {{nickname}} deleted". Links out: card detail (shows the virtual cards list), Card transactions (virtual card spending appears under the parent).

#### 8. Acceptance criteria

- AC-1: A virtual card is created only after a verified one-time code.
- AC-2: The full number and security code are shown only after step-up and are never kept in the journey data.
- AC-3: The limit cannot exceed the parent card's per-transaction ceiling.
- AC-4: At most 3 live virtual cards per card; the fourth is refused.
- AC-5: A virtual card cannot be created from a frozen, blocked or inactive card.
- AC-6: Deleting a virtual card blocks it and leaves the parent card untouched.
- AC-7: A nickname is required.
- AC-8: A timeout or unavailable service creates nothing and says so.

#### 9. Scenarios

| # | Covers | Persona and setup | Outcome |
|---|---|---|---|
| T-1 | AC-1, AC-2 | `alex`, parent `card_9021`; "Online shopping", 250, 3 months | Code `482100`; reveal asks step-up; shows number once; `dataModel` holds no card number |
| T-2 | AC-1 | `alex` | Skip the code: `OTP_REQUIRED` |
| T-3 | AC-3 | `alex` | Limit 5,000: `LIMIT_ABOVE_CEILING` |
| T-4 | AC-4 | `alex`; setup three live virtual cards | Fourth: `VIRTUAL_LIMIT_REACHED` |
| T-5 | AC-5 | `alex`; `card_9021` frozen | `CARD_NOT_ACTIVE` |
| T-6 | AC-6 | `alex`; delete virtual card | Virtual `blocked`; parent `active` |
| T-7 | AC-7 | `alex`; empty nickname | Validation message; no call |
| T-8 | AC-8 | conditions `timeout: ["bank.cards.virtual.create"]` | Timeout text; no new card |
| T-9 | AC-8 | conditions `unavailable: ["bank.cards.virtual.create"]` | `SERVICE_UNAVAILABLE`; no new card |

#### 10. Expected mutation-check survivors

- Journey `pattern` on nickname: survives because T-7 only proves "required"; the sandbox does not check length. Decision: treat as a **killed** mutant by adding a 1-character name case to T-7 (survivor none expected).
- Auto-hide timer (60 s) is not testable in a scenario: **survives**, reason "the sandbox has no clock-driven UI".

---

### ★ Replace card — `replace-card`

#### 1. Summary

| Item | Value |
|---|---|
| Slug | `replace-card` |
| Purpose | Get a new card because the old one is lost, stolen or damaged |
| Release | 1 |
| Workspace | Personal |
| Status | New (draft). Needs the planned cards domain |
| Channels | Web, mobile |
| Starting pattern | Reason → delivery → review (fee, consent) → code → result |
| Who may use it | Personal context holding `cards.manage` |

#### 2. Entry points

| Place › label | Passed | Permission |
|---|---|---|
| Cards › card › Replace card | `{cardId, reason}` | `cards.manage` |
| `freeze-card` result (block) › Get a new card | `{cardId}` with `returnTo` | `cards.manage` |
| `activate-card` (blocked card) › Replace card | `{cardId}` | `cards.manage` |

#### 3. Screens

**Screen `reason` — "Why do you need a new card?"** `onEnter`: `callApi card`. `select` rows bind `rep.reason`:

| Choice | Label | Help text | Fee |
|---|---|---|---|
| `lost` | "I lost it" | "We'll block the old card right away." | 5.00 |
| `stolen` | "It was stolen" | "We'll block the old card right away. No fee." | 0.00 |
| `damaged` | "It's damaged" | "The old card keeps working until the new one is activated." | 5.00 |

| Field | Block | Required | Rule | Error message |
|---|---|---|---|---|
| Reason | `select` | Yes | One of the three | "Choose why you need a new card." |

For `stolen`, an `alert` warning shows: "If someone has used your card, report those payments next. We'll show you how after this." Button "Continue" (`validate`, navigate `delivery`).
Empty/blocked: if the card already has a replacement in progress the screen shows `alert` "A new card for this one is already on its way (arrives by {{date}})." and the button "Back to cards".

**Screen `delivery` — "Where should we send it?"** `select` tiles bind `rep.delivery`: "To my home address" (shows the address on file, masked as "12 •••• Street, San Francisco"; read-only, with `text` "To change your address, update your profile first." and link to `update-profile`), "Collect at a branch" (opens the branch choice via planned `find-branch-atm` with `returnTo`; sets `rep.branchId`).

| Field | Block | Required | Rule | Error message |
|---|---|---|---|---|
| Delivery | `select` | Yes | One of two | "Choose how you'll get your card." |
| Branch | from `find-branch-atm` | Yes when collecting | Must be set | "Choose a branch to collect from." |

Buttons "Continue" (to `review`), "Back".

**Screen `review` — "Review your request".** `reviewSummary` rows: Card "{{card.name}}"; Reason "Lost / Stolen / Damaged"; Delivery "Home address" or branch name; Arrives "By {{deliveryBy}} (5 working days)"; Fee "5.00 USD from {{account.name}} ••{{n}}" or "Free". `alert` info "Your new card has a new number and expiry date. Regular payments set up with the old number may need updating." `consent` bind `rep.consent` (termsVersion `cards-v1`), text "I agree to the card fee and to BankWorkx blocking the old card where I said it was lost or stolen." validation `mustBeTrue`: "Tick the box to continue." Button "Request card" (`validate`, `callApi otpSend`, navigate `code`).

**Screen `code`**: standard. Button "Confirm and request" calls `otpVerify`, `replace`, then `done`.

**Screen `done` (terminal) — "New card on its way".** `result` success, text "Your new card will arrive by {{result.deliveryBy}}. We've {{blockedText}}.", meta "Ref {{result.reference}}". Where `blockedText` is "blocked your old card" (lost, stolen) or "kept your old card working until you activate the new one" (damaged). Buttons: "Report a payment I don't recognise" (stolen only; `navigate toJourney dispute-transaction`), "Go to cards".

`locked`, `failed` standard.

#### 4. Sandbox errors

| Code | Message | Screen | Button |
|---|---|---|---|
| `CARD_NOT_FOUND` | "We can't find that card." | `failed` | Back to cards |
| `REPLACEMENT_PENDING` | "A new card for this one is already on its way. You can ask again if it hasn't arrived after {{date}}." | `reason` | Back to cards |
| `REASON_INVALID` | "Choose why you need a new card." | `reason` | Choose |
| `INSUFFICIENT_FUNDS` | "There isn't enough money in {{account}} for the 5.00 fee. Available: {{balance}}. No card was ordered." | `failed` | Back to cards |
| `ACCOUNT_NOT_FOUND` | "We can't find the account that pays the fee. Choose another." | `failed` | Back |
| `CORE_UNAVAILABLE` | "We couldn't complete this right now. No money has left your account." | `failed` | Try again |
| `OTP_INVALID`, `OTP_REQUIRED` | Standard | `code` | Try again / Back to code |
| `TIMEOUT` | "We didn't get an answer in time. Check your account activity before you try again, so you aren't charged twice." | `failed` | Check Activity |
| `SERVICE_UNAVAILABLE` | Standard | `failed` | Try again |
| `PERMISSION_DENIED`, `WRONG_CONTEXT`, `SESSION_EXPIRED` | Standard | `failed` | Back / Switch / Sign in |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `card` | `bank.cards.get` | `{cardId}` | card | `CARD_NOT_FOUND` | (planned) |
| `replace` | `bank.cards.replace` | `{cardId, reason, delivery, branchId?}` | `{reference, newCardId, fee, feeCurrency, deliveryBy, oldCardStatus}` | section 4 | (planned) |
| `otpSend`, `otpVerify` | existing | | | `OTP_INVALID` | Existing |

`moneyMoving: true` (the fee), `requiresOtp: true`. Lost and stolen set the old card to `blocked` and its virtual cards to `blocked`; damaged leaves it `active` until the new card is activated, then marks it `replaced`.

#### 6. Permissions, step-up and limits

`cards.manage`. Step-up `otp`. The fee does not use the daily transfer limit. Check 3: `OTP_REQUIRED` from the sandbox if the code was not verified.

#### 7. Result and links out

Result `done`; receipt shows card, reason, fee, account, reference, date. Notification: "New card ordered for ••{{last4}}, arriving by {{date}}" and, for lost or stolen, "Card ••{{last4}} blocked". Links: card detail, `activate-card` (when the new card arrives), `dispute-transaction`.

#### 8. Acceptance criteria

- AC-1: A replacement needs a reason, a delivery choice, consent and a verified one-time code.
- AC-2: Lost and stolen cards are blocked at once, with their virtual cards.
- AC-3: A damaged card keeps working until the new card is activated.
- AC-4: The fee is 5.00 for lost or damaged and free for stolen, taken from the card's account.
- AC-5: Not enough money for the fee orders no card and takes no money.
- AC-6: Only one replacement per card at a time.
- AC-7: A stolen-card result offers to report payments the person doesn't recognise.
- AC-8: A timeout leaves things unchanged and tells the person to check Activity; an unavailable service orders nothing.
- AC-9: Three wrong codes order nothing.

#### 9. Scenarios

| # | Covers | Persona and setup | Outcome |
|---|---|---|---|
| T-1 | AC-1, AC-2, AC-4 | `alex`, `card_9021`, `lost`, home | Fee 5.00 from Main (8,720.76 → 8,715.76); old card `blocked`; new card `inactive` |
| T-2 | AC-3, AC-4 | `alex`, `damaged` | Old card `active`; fee 5.00 |
| T-3 | AC-2, AC-4, AC-7 | `alex`, `stolen` | Fee 0.00; dispute button visible |
| T-4 | AC-5 | `alex`; setup Main balance 2.00 | `INSUFFICIENT_FUNDS`; no card ordered; balance 2.00 |
| T-5 | AC-6 | `alex`; second request | `REPLACEMENT_PENDING` |
| T-6 | AC-1 | `alex` | Skip consent: "Tick the box to continue." Skip code: `OTP_REQUIRED` |
| T-7 | AC-9 | `alex` | Code `111111` x3: `locked`; no card ordered |
| T-8 | AC-8 | conditions `timeout: ["bank.cards.replace"]` | Timeout text with Check Activity; balance unchanged in sandbox |
| T-9 | AC-8 | conditions `unavailable: ["bank.cards.replace"]` | `SERVICE_UNAVAILABLE`; nothing ordered |

#### 10. Expected mutation-check survivors

- Fee amount for damaged vs stolen (swap): killed by T-2 and T-3.
- Branch required rule when collecting: survives because the sandbox accepts a missing `branchId` for `delivery: "home"` only and T-1/T-2 use home; add a branch scenario, otherwise listed as a survivor "branch path not covered".

---

### ★ Card PIN — `card-pin`

#### 1. Summary

| Item | Value |
|---|---|
| Slug | `card-pin` |
| Purpose | Set a PIN on a new card, or change the PIN on a card you already use |
| Release | 1 |
| Workspace | Personal |
| Status | New (draft). Needs the planned cards domain |
| Channels | Web, mobile |
| Starting pattern | Step-up → enter PIN twice (masked) → code → result |
| Who may use it | Personal context holding `cards.pin` |

The PIN is typed into the schema's `otp` block with `masked: true` and `keypad: true`, so only dots appear. It is a PIN, not a one-time code, so the block is bound to `pin.new` and **is not** the `otpVerify` integration (the engine counts wrong attempts only for an integration named exactly `otpVerify`).

#### 2. Entry points

| Place › label | Passed | Permission |
|---|---|---|
| Cards › card › Set or change PIN | `{cardId}` | `cards.pin` |
| `activate-card` result › Set my PIN | `{cardId}` with `returnTo` | `cards.pin` |

#### 3. Screens

**Screen `start` — "Set a card PIN" / "Change your card PIN"** (title by `ctx.card.pinSet`). `onEnter`: `callApi card`. Text "Your PIN is 4 digits. You use it at cash machines and some shops." Button "Continue". If the card isn't active: `alert` warning "Activate your card before you set a PIN." and button "Activate card". The step-up is raised on this screen: `callApi stepUp` (`bank.session.stepUp`, planned) shows the standard "confirm it's you" sheet (password or biometrics), then navigates to `old` (change) or `new` (first set).

**Screen `old` — "Enter your current PIN"** (change only). `otp` block bind `pin.old`, `length 4`, `masked true`, `keypad true`, no resend. Hint "Enter the 4-digit PIN you use now." Button "Continue".

| Field | Block | Required | Rule | Error message |
|---|---|---|---|---|
| Current PIN | `otp` (masked) | Yes (change) | 4 digits | "Enter your 4-digit PIN." |

**Screen `new` — "Choose a new PIN".** `otp` block bind `pin.new`, `length 4`, masked, keypad. Hint "Don't use your birth year, 1234 or the same digit four times."

| Field | Block | Required | Rule | Error message |
|---|---|---|---|---|
| New PIN | `otp` (masked) | Yes | 4 digits; not all the same; not an ascending or descending run (1234, 4321); different from the current PIN | "Enter 4 digits." / "That PIN is too easy to guess. Try different digits." / "Choose a PIN that's different from your current one." |

Button "Continue" (`validate`, navigate `confirmNew`).

**Screen `confirmNew` — "Enter it again".** `otp` block bind `pin.again`, masked. Rule: equals `pin.new`. Error "The two PINs don't match. Try again." (`setData` clears both and returns to `new` after the second miss). Button "Continue" (`validate`, `callApi otpSend`, navigate `code`).

**Screen `code`**: standard one-time code screen, button "Save PIN". Calls `otpVerify`, then `setPin` (`bank.cards.pin.set`), then `done`.

**Screen `done` (terminal) — "PIN saved".** `result` success, text "Your new PIN works at cash machines and in shops straight away. Don't tell it to anyone, not even us.", meta "Ref {{result.reference}}"; button "Done" (`exit`). `locked`, `failed` standard.

All PIN values are cleared from journey data on leaving `confirmNew` and on `done` (`setData` to empty), and the journey log stores only the integration id, never `input`.

#### 4. Sandbox errors

| Code | Message | Screen | Button |
|---|---|---|---|
| `CARD_NOT_FOUND` | "We can't find that card." | `failed` | Back to cards |
| `CARD_NOT_ACTIVE` | "Activate your card before you set a PIN." | `failed` | Activate card |
| `PIN_INVALID` | "That current PIN isn't right." (change only) | `old` | Try again |
| `PIN_WEAK` | "That PIN is too easy to guess. Try different digits." | `new` | Choose another |
| `PIN_SAME_AS_OLD` | "Choose a PIN that's different from your current one." | `new` | Choose another |
| `STEP_UP_REQUIRED` | "For your security, confirm it's you first." | `start` | Confirm |
| `OTP_INVALID`, `OTP_REQUIRED` | Standard | `code` | Try again / Back to code |
| `TIMEOUT` | "This is taking longer than expected. Your PIN was not changed." | `failed` | Try again |
| `SERVICE_UNAVAILABLE`, `PERMISSION_DENIED`, `WRONG_CONTEXT`, `SESSION_EXPIRED` | Standard | `failed` | Try again / Back / Switch / Sign in |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `card` | `bank.cards.get` | `{cardId}` | card incl. `pinSet` | `CARD_NOT_FOUND` | (planned) |
| `stepUp` | `bank.session.stepUp` | `{method}` | `{ok: true}` | `STEP_UP_REQUIRED` | (planned) |
| `setPin` | `bank.cards.pin.set` | `{cardId, pin, oldPin?}` | `{pinSet: true, reference}` | section 4 | (planned) |
| `otpSend`, `otpVerify` | existing | | | `OTP_INVALID` | Existing |

`moneyMoving: false`, `requiresOtp: true`.

#### 6. Permissions, step-up and limits

`cards.pin`. Step-up level `stepup` (password or biometrics) and then `otp`. The sandbox checks the PIN rules (check 3). The PIN is never echoed in a response, a toast, a result or a log.

#### 7. Result and links out

Result `done`. No receipt. Notification: "PIN set/changed for card ending {{last4}}" (in-app and push; never says the PIN). Links out: card detail.

#### 8. Acceptance criteria

- AC-1: Setting or changing a PIN needs step-up and a verified one-time code.
- AC-2: The PIN is shown only as dots and is entered twice.
- AC-3: The two entries must match.
- AC-4: Easy PINs (same digit, runs, same as the current PIN) are refused.
- AC-5: Changing a PIN needs the current PIN, and a wrong one is refused.
- AC-6: The PIN never appears in journey data after the journey, in a result or in a log.
- AC-7: An inactive card cannot be given a PIN.
- AC-8: Three wrong codes keep the old PIN.
- AC-9: A timeout or unavailable service keeps the old PIN and says so.

#### 9. Scenarios

| # | Covers | Persona and setup | Outcome |
|---|---|---|---|
| T-1 | AC-1, AC-2, AC-3, AC-6 | `alex`, `card_9021` (change), old `4821`, new `7390` twice, code `482100` | `pinSet`; data model holds no PIN after done |
| T-2 | AC-3 | `alex`; `7390` then `7391` | "The two PINs don't match. Try again." |
| T-3 | AC-4 | `alex`; `1234`, `1111`, `4821` as the new PIN | The three messages in turn |
| T-4 | AC-5 | `alex`; wrong current PIN | `PIN_INVALID` |
| T-5 | AC-7 | `alex`; `card_7745` inactive | `CARD_NOT_ACTIVE`; Activate card button |
| T-6 | AC-1 | `alex` | Skip step-up: `STEP_UP_REQUIRED`; skip code: `OTP_REQUIRED` |
| T-7 | AC-8 | `alex` | Wrong code x3: `locked`; old PIN works |
| T-8 | AC-9 | conditions `timeout: ["bank.cards.pin.set"]` | Timeout text; old PIN unchanged |
| T-9 | AC-9 | conditions `unavailable: ["bank.cards.pin.set"]` | `SERVICE_UNAVAILABLE`; unchanged |

#### 10. Expected mutation-check survivors

- Journey-side weak-PIN regex: survives, because `bank.cards.pin.set` returns `PIN_WEAK` too (another layer).
- "Clear PIN from data on done": cannot be observed by a bank rule, so killed only by T-1's data-model assertion; if the runner has no data assertion, it **survives** (reason: no sandbox check for client-side data).

---

### ★ Dispute a transaction — `dispute-transaction`

#### 1. Summary

| Item | Value |
|---|---|
| Slug | `dispute-transaction` |
| Purpose | Tell the bank a card payment is wrong, unknown or not delivered, and open a case |
| Release | 1 |
| Workspace | Personal |
| Status | New (draft). Needs the planned cards domain, `fileUpload` and `datePicker` blocks |
| Channels | Web, mobile |
| Starting pattern | Eligibility → reason → details and evidence → review → code → case result |
| Who may use it | Personal context holding `cards.dispute` |

#### 2. Entry points

| Place › label | Passed | Permission |
|---|---|---|
| Cards › card › transaction › Report a problem | `{cardId, transactionId}` | `cards.dispute` |
| Accounts › transaction detail › Dispute | `{transactionId}` (a card payment; `cardId` is looked up) | `cards.dispute` |
| `replace-card` (stolen) result | `{cardId}` (the person picks transactions) | `cards.dispute` |

If `transactionId` is missing, the first screen lists the card's posted transactions for the last 120 days to pick from.

#### 3. Screens

**Screen `pick` — "Which payment?"** (skipped when passed). `onEnter`: `callApi transactions`. List of posted, not-yet-disputed card payments (`select` rows, bind `dsp.transactionId`): merchant, date, amount. Empty "There are no payments you can report in the last 120 days." with "Back".
Required: "Choose the payment you want to report."

**Screen `reason` — "What went wrong?"** `onEnter`: `callApi reasons`, `callApi eligibility` is not a separate call: eligibility comes from `dispute.create` errors checked early by the preview below. `select` rows bind `dsp.reason`:

| Reason id | Label | Help |
|---|---|---|
| `unrecognised` | "I don't recognise this payment" | "Nobody I know used my card." |
| `duplicate` | "I was charged twice" | "The same payment appears more than once." |
| `wrong_amount` | "The amount is wrong" | "I paid a different amount." |
| `not_received` | "I didn't get what I paid for" | "The goods or service never arrived." |
| `cancelled` | "I cancelled but was still charged" | "I cancelled a subscription or order." |
| `other` | "Something else" | "Tell us in your own words." |

A summary card on top shows the payment ({{merchant}}, {{amount}}, {{date}}). For `unrecognised`, an `alert` warning appears: "If you think someone has your card, freeze it now." with button "Freeze card" (`navigate toJourney freeze-card`, `{cardId, action: freeze}`, `returnTo` this screen). Button "Continue" (`validate`, `navigate details`).

| Field | Block | Required | Rule | Error message |
|---|---|---|---|---|
| Reason | `select` | Yes | One of six | "Choose what went wrong." |

**Screen `details` — "Tell us more".**

| Field | Block | Required | Rule | Error message |
|---|---|---|---|---|
| Amount you're disputing | `amountInput` bind `dsp.amount` (default the full amount) | Yes | 0.01 up to the payment amount, ≤ 2 decimals | "Enter an amount from 0.01 to {{txn.amount}}." |
| What happened | `textInput` (`lines: 4`) bind `dsp.details` | Yes | 10 to 500 characters | "Tell us a little more (at least 10 characters)." / "Please keep it under 500 characters." |
| Do you still have your card? | `toggle` bind `dsp.cardInPossession` | Yes | none | none |
| When did you contact the shop? (not_received, cancelled only) | `datePicker` (planned) bind `dsp.contactedOn` | No | Not in the future; not before the payment date | "Choose a date between {{txn.date}} and today." |
| Evidence (receipts, screenshots, emails) | `fileUpload` (planned) bind `dsp.evidence` | Optional (required note for `not_received`: "Add your order confirmation if you have it.") | Up to 3 files; JPG, PNG or PDF; 5 MB each | "Files must be JPG, PNG or PDF." / "Each file must be 5 MB or less." / "You can add up to 3 files." |

Helper under details: "For example, when you ordered, what you were told, and what you did next." Button "Review" (`validate`, `navigate review`).

**Screen `review` — "Review your report".** `reviewSummary`: Payment, Date, Card, Reason, Amount disputed, Files "{{count}} attached". `alert` info "We'll look into it and reply within 10 working days. You may need to wait to get any money back." `consent` bind `dsp.consent`, termsVersion `disputes-v1`, text "I confirm what I've told you is true and I agree BankWorkx may share these details with the shop's bank." validation `mustBeTrue` "Tick the box to continue." Button "Send report" (`validate`, `callApi otpSend`, navigate `code`).

**Screen `code`**: standard; button "Send report" calls `otpVerify`, `create`, then `done`.

**Screen `done` (terminal) — "Report sent".** `result` success, text "We've opened case {{result.reference}}. We'll reply by {{result.replyBy}}.", meta "Case {{result.disputeId}}". Buttons "View case" (Card transactions filtered Disputed), "Done". For `unrecognised` also `alert` info "We recommend replacing your card: " with "Replace card" (`replace-card`).
`locked`, `failed` standard.

#### 4. Sandbox errors

| Code | Message | Screen | Button |
|---|---|---|---|
| `CARD_NOT_FOUND` | "We can't find that card." | `failed` | Back to cards |
| `TRANSACTION_NOT_FOUND` | "We can't find that payment. Choose another." | `pick` | Choose payment |
| `NOT_DISPUTABLE` | "This kind of payment can't be reported here. Money you received, cash and fees go through a service request." | `failed` | New request (`service-request`) |
| `TRANSACTION_PENDING` | "This payment isn't final yet. Try again when it shows as posted." | `failed` | Back |
| `DISPUTE_WINDOW_CLOSED` | "This payment is more than 120 days old, so it can't be reported online. Contact us." | `failed` | Contact us (`new-message`) |
| `DISPUTE_EXISTS` | "You've already reported this payment (case {{reference}})." | `failed` | View case |
| `DISPUTE_AMOUNT_INVALID` | "Enter an amount from 0.01 to {{amount}}." | `details` | Fix it |
| `REASON_INVALID` | "Choose what went wrong." | `reason` | Choose |
| `OTP_INVALID`, `OTP_REQUIRED` | Standard | `code` | Try again / Back to code |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed. Check your cases before you try again." | `failed` | Try again |
| `SERVICE_UNAVAILABLE`, `PERMISSION_DENIED`, `WRONG_CONTEXT`, `SESSION_EXPIRED` | Standard | `failed` | Try again / Back / Switch / Sign in |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `transactions` | `bank.cards.transactions` | `{cardId}` | record | `CARD_NOT_FOUND` | (planned) |
| `reasons` | `bank.cards.dispute.reasons` | none | reason list | none | (planned) |
| `create` | `bank.cards.dispute.create` | `{cardId, transactionId, reason, amount, details, cardInPossession, evidence[]}` | `{disputeId, reference, status: "under_review", replyBy}` | section 4 | (planned) |
| `otpSend`, `otpVerify` | existing | | | `OTP_INVALID` | Existing |

`moneyMoving: false` (no credit in the sandbox), `requiresOtp: true`. The file upload is a simulated store (`fileUpload`, planned): the response of an upload is an `evidenceId` passed in `evidence[]`.

#### 6. Permissions, step-up and limits

`cards.dispute`. Step-up `otp`. Dispute window 120 days. One open case per transaction. Evidence: 3 files, 5 MB each.

#### 7. Result and links out

Result `done`; receipt: the case summary (reference, payment, reason, amount, date opened). Notifications: "We've opened case {{reference}}" immediately and "Update on case {{reference}}" (planned, on status change). Links out: card transactions (Disputed filter), `replace-card`, `freeze-card`, `service-request`.

#### 8. Acceptance criteria

- AC-1: Only posted card payments within 120 days and not already disputed can be reported.
- AC-2: A reason, a description of at least 10 characters and a valid amount are required.
- AC-3: The disputed amount cannot exceed the payment.
- AC-4: A pending payment is refused with a clear message.
- AC-5: A payment already reported is refused and the existing case is named.
- AC-6: Evidence files are limited to 3 files, JPG, PNG or PDF, 5 MB each.
- AC-7: Sending needs consent and a verified one-time code.
- AC-8: For "I don't recognise this payment" the person is offered to freeze or replace the card.
- AC-9: A timeout or unavailable service opens no case and says so.

#### 9. Scenarios

| # | Covers | Persona and setup | Outcome |
|---|---|---|---|
| T-1 | AC-1, AC-2, AC-7 | `alex`, `card_9021`, `ct_2`, `not_received`, details of 20 characters, code `482100` | Case opened, status `under_review`; transaction shows Disputed |
| T-2 | AC-2 | `alex` | Details "too short": message; no call |
| T-3 | AC-3 | `alex`, `ct_2` (420.00) | Amount 500: `DISPUTE_AMOUNT_INVALID` |
| T-4 | AC-4 | `alex`, `ct_3` (pending) | `TRANSACTION_PENDING` |
| T-5 | AC-5 | `alex`; after T-1 | Second report: `DISPUTE_EXISTS` |
| T-6 | AC-1 | `alex`; setup `ct_9` 130 days old | `DISPUTE_WINDOW_CLOSED` |
| T-7 | AC-6 | `alex`; four files, or a `.exe` | The file messages |
| T-8 | AC-8 | `alex`, reason `unrecognised` | Freeze warning; Replace button in result |
| T-9 | AC-7 | `alex` | Skip consent: message; skip code: `OTP_REQUIRED` |
| T-10 | AC-9 | conditions `timeout: ["bank.cards.dispute.create"]` | Timeout text; no case |
| T-11 | AC-9 | conditions `unavailable: ["bank.cards.dispute.create"]` | `SERVICE_UNAVAILABLE`; no case |

#### 10. Expected mutation-check survivors

- 120-day window off by one day: survives (no seed transaction exactly on the boundary); add one at 120 and 121 days to kill it, else list.
- Evidence limits: killed only if the `fileUpload` block is simulated by the runner; until then **survive** with reason "fileUpload is planned".

---

### ★ Add card — `add-card`

Existing, upgraded. This journey saves an **outside card** so `add-money` can use it. It is not a BankWorkx card.

#### 1. Summary

| Item | Value |
|---|---|
| Slug | `add-card` (fixture `packages/journey-schema/src/fixtures/bankworkx.ts`, `addCard`) |
| Purpose | Save a card from any bank to add money from |
| Release | 1 |
| Workspace | Personal |
| Status | Existing, upgraded (adds a one-time code, per-code messages and a duplicate-card path) |
| Channels | Mobile today (`channels: ["mobile"]`); upgrade adds web |
| Starting pattern | Card form → review with consent → (upgrade) one-time code → result |
| Who may use it | Personal context holding `cards.manage` |

#### 2. Entry points

| Place › label | Passed | Permission |
|---|---|---|
| Cards › carousel › Add a card | none | `cards.manage` |
| `add-money` card choice › "Add a new card" (planned, `returnTo` `add-money`) | none | `cards.manage` |

#### 3. Screens

**As built today.**

1. `card` — "Add your card": `stepper` (`card`, `review`), `cardForm` bound to `card` (card number, name, expiry, security code, with a live card picture and one message per field), `textInput` nickname (label "Nickname (optional)", placeholder "For example, Everyday"), `toggle` `card.makeDefault` ("Make this my default card", helper "Used first when you add money"), `button` "Continue" (`validate`, navigate `review`).
2. `review` — "Review card": `reviewSummary` (Name on card, Expires, Nickname), `consent` `card.consent` (termsVersion `cards-v1`, "I authorise BankWorkx to save this card for adding money", must be true, "Tick the box to continue"), `button` "Save card" (`validate`, `callApi addCard`, navigate `success`; on error navigate `failed`).
3. `success` (terminal) — "Card added": "You can now add money from this card." and "Done".
4. `failed` (terminal) — "We couldn't add this card": one text for every error, "It may already be saved, or the details may not match. Check them and try again." Button "Try again" back to `card`.

The fixture has no one-time code, no per-error wording, and no distinction between a wrong number and a card that is already saved.

**Upgraded.**

**Screen `card`** (as built) with these field rules, enforced twice (in `cardForm` and by `bank.cards.add`):

| Field | Block | Required | Rule | Error message |
|---|---|---|---|---|
| Card number | `cardForm` | Yes | 13 to 19 digits, passes the Luhn check (`4242 4242 4242 4242` and `5555 5555 5555 4444` pass) | "That card number is not valid" |
| Name on card | `cardForm` | Yes | Not empty | "Enter the name on the card." |
| Expiry | `cardForm` | Yes | `MM/YY`, month 01 to 12 | "Enter the expiry as MM/YY" |
| Security code | `cardForm` | Yes | 3 or 4 digits | "Enter the 3 or 4 digit security code" |
| Nickname | `textInput` | No | up to 24 characters; blank becomes "My card" | "Keep the nickname under 24 characters." |
| Make default | `toggle` | No | The first saved card becomes the default whatever is chosen | none |

**Screen `review`** (as built) plus: `alert` info "We'll send a code to your phone to check it's really you. We never store your security code." Button "Send code" (`validate`, `callApi otpSend`, navigate `code`). The `alert` is new copy.

**Screen `code` (new)**: standard one-time code screen (see the card note above). Button "Save card" calls `otpVerify`, then `addCard`, then `success`.

**Screen `success`**: title "Card added", text "Your {{result.network}} card ending {{result.last4}} is saved. You can now add money from it.", buttons "Add money" (`navigate toJourney add-money`) and "Done" (`exit`).

**Screens `failed` and `locked`**: `failed` shows `{{ctx.error.message}}` (the table below) and goes back to `card`.

States: submit shows a spinner in the button; the Luhn error shows under the card number as the user types (after the 13th digit).

#### 4. Sandbox errors (bank.cards.add)

| Code | Exact adapter message | What the person sees | Screen | Button |
|---|---|---|---|---|
| `CARD_INVALID` | "That card number is not valid" | "That card number is not valid. Check it and try again." | `failed` (focus on number) | Fix card number (to `card`) |
| `EXPIRY_INVALID` | "Enter the expiry as MM/YY" | "Enter the expiry as MM/YY." | `failed` | Fix expiry |
| `CARD_EXPIRED` | "This card has expired" | "This card has expired. Use a card that hasn't." (sandbox date: before 2 Nov 2026) | `failed` | Use another card |
| `CVV_INVALID` | "Enter the 3 or 4 digit security code" | "Enter the 3 or 4 digit security code." | `failed` | Fix code |
| `CARD_EXISTS` | "This card is already added" | "This card is already saved (ending {{last4}}). You can use it to add money." | `failed` | Add money (`add-money`) / Back |
| `NOT_SUPPORTED` | "Not available for this customer" | Standard S-`NOT_SUPPORTED` | `failed` | Back |
| `OTP_INVALID` | "Incorrect code" | Standard S-`OTP_INVALID` | `code` | Try again |
| `OTP_REQUIRED` (upgrade, planned) | "OTP not verified" | Standard | `code` | Back to code |
| `TIMEOUT` (planned) | | "This is taking longer than expected. Nothing was changed." | `failed` | Try again |
| `SERVICE_UNAVAILABLE` (planned) | | Standard | `failed` | Try again |
| `PERMISSION_DENIED`, `WRONG_CONTEXT`, `SESSION_EXPIRED` (planned) | | Standard | `failed` | Back / Switch / Sign in |

Order the adapter checks things in: number (Luhn), expiry format, expiry date, security code, duplicate last 4.

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `addCard` | `bank.cards.add` | `{number, holder, expiry, cvv, nickname, makeDefault}` | `{cardId, last4, network}` | `CARD_INVALID`, `EXPIRY_INVALID`, `CARD_EXPIRED`, `CVV_INVALID`, `CARD_EXISTS`, `NOT_SUPPORTED` (+ `OTP_REQUIRED` in the upgrade) | Existing |
| `otpSend` | `bank.otp.send` | `{channel: "sms"}` | `{sent, maskedPhone, channel}` | none | Existing |
| `otpVerify` | `bank.otp.verify` | `{code}` | `{verified: true}` | `OTP_INVALID` | Existing |

`moneyMoving: false`. `requiresOtp`: no today; **true** in the upgrade (the sandbox gains an `OTP_REQUIRED` check). The sandbox keeps only `id` (`c_<last4>`), `network`, `last4`, `holder`, `expiry`, `nickname`, `isDefault`; it never stores the security code.

#### 6. Permissions, step-up and limits

`cards.manage`. Step-up `otp` (upgrade). Limits: none on the number of saved cards in the sandbox. Security: the number and code are `secure` values in the journey data (cleared on `success`).

#### 7. Result and links out

Result `success`; no receipt. Notification: "A card ending {{last4}} was added to your account" (security notice, in-app and push; the person can follow "Wasn't you?" to `change-password`). Links out: `add-money`, the carousel (saved cards row).

#### 8. Acceptance criteria

- AC-1: A card that passes the number check, has a valid unexpired expiry and a 3 or 4 digit code is saved.
- AC-2: Each bad field gets its own message, not one general error.
- AC-3: An expired card is refused.
- AC-4: A card already saved (same last 4 digits) is refused and the person is pointed to add money.
- AC-5: The first card saved becomes the default; later cards become the default only if the person chose it, and then the old default is cleared.
- AC-6: Saving needs consent and (upgrade) a verified one-time code.
- AC-7: The security code is never stored.
- AC-8: A timeout or unavailable service saves nothing.

#### 9. Scenarios

| # | Covers | Persona and setup | Outcome |
|---|---|---|---|
| T-1 | AC-1, AC-5, AC-6 | `alex`; `4242 4242 4242 4242`, "Alex Morgan", `12/29`, `123`, make default | Saved as `c_4242` (`visa`); previous `c_5832` no longer default |
| T-2 | AC-1, AC-5 | `sam`; `5555 5555 5555 4444` | Saved and default, though the toggle was off |
| T-3 | AC-2 | `alex`; `4242 4242 4242 4241` | `CARD_INVALID` |
| T-4 | AC-2 | `alex`; expiry `13/29` | `EXPIRY_INVALID` |
| T-5 | AC-3 | `alex`; expiry `10/26` | `CARD_EXPIRED` |
| T-6 | AC-2 | `alex`; code `12` | `CVV_INVALID` |
| T-7 | AC-4 | `alex`; a number ending `5832` that passes Luhn | `CARD_EXISTS`; "Add money" shown |
| T-8 | AC-6 | `alex` | No consent: "Tick the box to continue"; no code: `OTP_REQUIRED` (upgrade) |
| T-9 | AC-8 | conditions `timeout: ["bank.cards.add"]` | Timeout text; card list unchanged |
| T-10 | AC-8 | conditions `unavailable: ["bank.cards.add"]` | `SERVICE_UNAVAILABLE`; unchanged |
| T-11 | AC-7 | `alex` | After save, `bank.cards.list` has no `cvv` field |

#### 10. Expected mutation-check survivors

- Dropping the journey's name check: survives; the sandbox falls back to the customer's name for `holder`, so it never fails (another layer).
- Nickname length rule: survives; the sandbox accepts any length (add a bank rule or list it).
- `isDefault` of the first card: killed by T-2.

---

## Personal: Save & Borrow

The tab holds four things: term deposits, savings goals, loans and investments. Every shell below reads a view-model in `packages/bank-client` (planned unless stated). All amounts are in the account's currency (USD for Alex). Dates read `12 Nov 2026`.

### Planned sandbox domains for this tab

| Domain (file, planned) | Holds | Adapters (planned) |
|---|---|---|
| `deposits.ts` | Deposit products (term, rate), customer deposits (principal, rate, start, maturity, maturity instruction, status) | `bank.deposits.products`, `bank.deposits.list`, `bank.deposits.get`, `bank.deposits.quote`, `bank.deposits.open`, `bank.deposits.renew`, `bank.deposits.close.quote`, `bank.deposits.close` |
| `goals.ts` | Savings goals (name, target, target date, saved, linked account, auto-contribution, status) | `bank.goals.list`, `bank.goals.get`, `bank.goals.create`, `bank.goals.contribute`, `bank.goals.update`, `bank.goals.close` |
| `loans.ts` | Loan products, applications, loans (principal, rate, term, instalment, schedule, status) | `bank.loans.products`, `bank.loans.list`, `bank.loans.get`, `bank.loans.eligibility`, `bank.loans.schedule`, `bank.loans.apply`, `bank.loans.repay`, `bank.loans.settlement.quote`, `bank.loans.settle` |
| `invest.ts` (**existing**) | Nine instruments, holdings, watchlist | `bank.invest.instruments`, `bank.invest.holdings`, `bank.invest.buy`, `bank.invest.sell`, `bank.invest.watch` (all existing) |
| `finance.ts` + `index.ts` (**existing**) | Deposits by card (add money) | `bank.deposit.create`, `bank.cards.list` (existing) |

Note on names: `bank.deposit.create` (singular, existing) adds money from a saved card to an account. The planned term-deposit domain is `bank.deposits.*` (plural). They are unrelated, and the spec keeps both names exactly (see open questions).

Seed for Alex (planned, synthetic):

| Item | Value |
|---|---|
| Term deposit `dep_1` | "Rainy day" 5,000.00 USD, 12 months at 4.20%, opened 15 Jan 2026, matures 15 Jan 2027, interest at maturity 210.00, instruction "Renew principal and pay interest" |
| Term deposit `dep_2` | "House fund" 8,000.00 USD, 6 months at 3.60%, opened 10 Apr 2026, matured 10 Oct 2026, status `matured` (waits for an instruction: used by renew) |
| Savings goal `goal_1` | "Japan trip", target 4,000.00, by 30 Jun 2027, saved 1,250.00 in Savings ••7731, auto 200.00 monthly from Main ••4410 on the 1st |
| Loan `loan_1` | "Personal loan", 8,000.00 USD, 24 months at 9.90% a year, instalment 368.75, 9 paid, 15 left, outstanding about 5,183.40, next due 5 Dec 2026, repaid from Main |
| Loan product `lp_personal` | Personal loan: 1,000 to 50,000, 6 to 60 months, 9.90% a year, 1.00% arrangement fee (minimum 25.00) |
| Sam Rivera | No deposits, goals or loans (empty states) |

The figures for the loan are the sandbox's own (an equal-instalment loan with interest on the remaining balance each month); they are fixed in the seed so tests do not depend on rounding.

### Shell: Save & Borrow home

| Item | Spec |
|---|---|
| **Purpose** | Entry to the tab. One glance at what Alex saves, owes and invests. |
| **Route** | Web `/personal/save`; mobile screen `SaveHome` |
| **Data source** | View-model `saveHome` (planned) from `bank.deposits.list`, `bank.goals.list`, `bank.loans.list`, `bank.invest.holdings` |
| **Widgets** | Four bento tiles: Deposits (total principal, next maturity), Goals (count and overall progress ring), Loans (total outstanding, next payment and date), Investments (portfolio value and day change, from `portfolioTotals`). Under them a "Things you can do" list: Open a deposit, New goal, Apply for a loan, Invest. |
| **Empty / loading / error** | A tile with nothing shows its call to action ("Open your first deposit"). Loading: four tile skeletons. Error: tile-level "Couldn't load" with "Try again"; one failing tile does not block the others |
| **Drill-downs** | Each tile opens its shell below |
| **Launch points on it** | `Save & Borrow › deposits › Open`, `› goals › New goal`, `› loans › Apply`, `› investments › Buy`, `› investments › Add money` |

### Shell: Deposits

| Item | Spec |
|---|---|
| **Purpose** | List the customer's term deposits and let them open, renew or close one. |
| **Route** | Web `/personal/save/deposits`, detail `/personal/save/deposits/:depositId`; mobile `Deposits`, `DepositDetail` |
| **Data source** | `bank.deposits.list`, `bank.deposits.get` (planned) |
| **Widgets** | Hero: total principal and total interest due. Deposits `dataTable` (card list on phones). Detail: ring showing time elapsed, principal, rate, interest so far, maturity date and amount, maturity instruction, status timeline (`timeline`: Opened, Interest accruing, Matures) |
| **Table columns** | Name; Principal; Rate (% a year); Opened; Matures; Interest at maturity; Status (`statusChip`: Active, Matures soon (within 14 days), Matured, Closed) |
| **Filters** | Status (All, Active, Matured, Closed) |
| **Sort order** | Matured (needs a decision) first, then by maturity date, soonest first |
| **Empty state** | "You don't have a term deposit yet. Lock money away for a set time and earn a fixed rate." with "Open a deposit" |
| **Loading / error** | Row skeletons; error "We couldn't load your deposits." with "Try again" |
| **Drill-downs** | Row → detail. Detail buttons: Renew (matured or within 14 days of maturity), Close (active), Open another |
| **Launch points on it** | `Save & Borrow › deposits › Open / Renew / Close` → `term-deposit` `{mode, depositId}` (`savings.manage`) |

### Shell: Savings goals

| Item | Spec |
|---|---|
| **Purpose** | Show each goal's progress and how to reach it. |
| **Route** | Web `/personal/save/goals`; mobile `Goals`, `GoalDetail` |
| **Data source** | `bank.goals.list`, `bank.goals.get` (planned) |
| **Widgets** | Goal cards: name, picture/emoji icon, progress ring, "1,250.00 of 4,000.00", "On track" or "Behind by 300.00" (`statusChip`), target date. Detail: `chart` of saved over time, forecast line, contribution list, auto-saving summary |
| **Filters / sort** | None; sorted by target date, soonest first; completed goals last |
| **Empty state** | "Save for something that matters to you." with "New goal" |
| **Loading / error** | Card skeletons; "We couldn't load your goals." with "Try again" |
| **Drill-downs** | Card → detail; detail buttons Add money, Change goal, Close goal |
| **Launch points on it** | `Save & Borrow › goals › New goal / Add money to goal` → `savings-goal` `{goalId}` (`savings.manage`) |

### Shell: Loans

| Item | Spec |
|---|---|
| **Purpose** | Show loans, what is left to pay, the next instalment and the full schedule. |
| **Route** | Web `/personal/save/loans`, `/personal/save/loans/:loanId`, schedule `/personal/save/loans/:loanId/schedule`; mobile `Loans`, `LoanDetail`, `LoanSchedule` |
| **Data source** | `bank.loans.list`, `bank.loans.get`, `bank.loans.schedule` (planned) |
| **Widgets** | List: loan cards with outstanding, next instalment and due date, a progress bar (paid / total). Detail: key facts (original amount, rate, term, instalment, repaid from), next-payment banner (with "Due in 32 days", or a red "Overdue" `statusChip` when late), history of payments, buttons. Schedule: `dataTable` |
| **Schedule columns** | No.; Due date; Instalment; Principal; Interest; Balance after; Status (Paid, Due, Upcoming, Overdue) |
| **Filters** | Schedule: All, Paid, Upcoming |
| **Sort order** | Loans: overdue first, then by next due date. Schedule: by number |
| **Empty state** | "You don't have a loan. See what you could borrow." with "Apply for a loan" |
| **Loading / error** | Skeletons; "We couldn't load your loans." with "Try again" |
| **Drill-downs** | Card → detail → schedule. A paid row opens its receipt |
| **Launch points on it** | `Save & Borrow › loans › Apply` → `apply-loan` `{productId}` (`loans.apply`); `Save & Borrow › loan › Repay / Settle early` → `repay-loan` `{loanId, mode}` (`loans.repay`); Home › Offer › Apply |

### Shell: Investments

Existing screens in the BankWorkx app (see `docs/BANKWORKX.md`, section Invest), described as built, with the launch points added.

| Item | Spec |
|---|---|
| **Purpose** | Portfolio, watchlist and market explorer. |
| **Route** | Web `/personal/save/invest`, stock `/personal/save/invest/:symbol`; mobile `Invest`, `Instrument` |
| **Data source** | Existing: `bank.invest.instruments`, `bank.invest.holdings`, `bank.invest.watch`; the app also reads `finance.invest` and `portfolioSeries`/`portfolioTotals` from `packages/mock-bank-api/src/invest.ts` |
| **Widgets** | Portfolio value with a 1D / 1W / 1M / 1Y chart (drag to read a point). Three tabs: **Portfolio** (holdings), **Watchlist**, **Explore** (search, Stocks or Funds filter, biggest movers). Stock page: price and day change, chart with the same ranges, your position (value, shares, average cost, return), key numbers, a short description, a star to watch, and *Buy* (and *Sell* when held) |
| **Table columns** | Holdings: Name (symbol); Shares; Value; Average cost; Return. Explore rows: Name; Kind; Price; Day change |
| **Sort order** | Holdings by value, largest first. Explore: biggest movers first, or alphabetical when searching |
| **Filters** | Explore: Stocks, Funds, search text |
| **Seed** | Alex: LMRB 6.5 shares at average 165, GLBX 40 at 38.50, ORCH 20 at 41, TBND 5 at 99; watchlist APXC, SMTH, GRNF. Sam: no holdings, shows "Start investing" |
| **Empty state** | "Start investing. Buy part of a share from $1." with "Explore" |
| **Loading / error** | Chart and row skeletons; "We couldn't load the market." with "Try again" |
| **Drill-downs** | Holding or explore row → stock page. Star → `bank.invest.watch` |
| **Launch points on it** | `Save & Borrow › investments › Buy` → `invest` `{symbol}` (`invest.trade`); `› Sell` → `sell-investment` `{symbol}` (`invest.trade`, only when held); `› Add money` → `add-money` `{accountId}` (`payments.create`) |
| **Not built yet** | Price alerts, gains tax, real market data (per `docs/BANKWORKX.md`) |

---

### ★ Term deposit — `term-deposit`

One journey with three modes: `open`, `renew`, `close`.

#### 1. Summary

| Item | Value |
|---|---|
| Slug | `term-deposit` |
| Purpose | Open a new term deposit, renew a matured one, or close one |
| Release | 1 |
| Workspace | Personal |
| Status | New (draft). Needs the planned deposits domain |
| Channels | Web, mobile |
| Starting pattern | Mode-driven: choose terms → quote → review and consent → code → result |
| Who may use it | Personal context holding `savings.manage` |

#### 2. Entry points

| Place › label | Passed | Permission |
|---|---|---|
| Save & Borrow › deposits › Open | `{mode: "open"}` | `savings.manage` |
| Save & Borrow › deposits › detail › Renew | `{mode: "renew", depositId}` | `savings.manage` |
| Save & Borrow › deposits › detail › Close | `{mode: "close", depositId}` | `savings.manage` |
| Products › deposit detail (public) → sign in → Open | `{mode: "open", productId}` | `savings.manage` |
| Notification "Your deposit matures on {{date}}" | `{mode: "renew", depositId}` | `savings.manage` |

#### 3. Screens

**Screen `terms` — "Open a term deposit"** (mode `open`) or **"Renew your deposit"** (mode `renew`). `onEnter`: `callApi products` and (renew) `callApi deposit`.

| Field | Block | Required | Rule | Error message |
|---|---|---|---|---|
| Pay from (open) / Pay out to (renew) | `accountPicker` bind `td.accountId` (`showBalance`) | Yes | An active account in USD | "Choose an account." |
| Amount | `amountInput` bind `td.amount` (quick 1,000; 2,500; 5,000; 10,000); renew: defaults to the matured principal (+ interest if chosen) | Yes | 500.00 to 250,000.00, at most 2 decimals; not above the account balance (open) | "The smallest deposit is $500." / "The most you can deposit is $250,000." / "There isn't enough money in {{account}}. Available: {{balance}}." |
| Term | `select` chips bind `td.termMonths`: 3, 6, 12, 24 months with the rate on each chip ("12 months · 4.20%") | Yes | One of the four | "Choose how long to lock your money." |
| When it ends | `select` rows bind `td.instruction`: "Pay the money to my account"; "Renew the money and pay the interest to my account"; "Renew the money and the interest" | Yes | One of three | "Choose what should happen at the end." |

Helper under amount: "From $500 to $250,000." Alert info: "Your money is locked until {{maturityDate}}. If you close early, you earn much less interest." Button "See the offer" (`validate`, `callApi quote`, navigate `review`).
Renew mode shows the matured deposit in a summary card and lets the person change the term and the instruction. If the deposit is not yet matured or within 14 days of maturity, `alert` warning "This deposit hasn't matured yet. You can renew from {{date}}." and the button is disabled.
States: skeleton for the rate chips while `products` loads; error "We couldn't load our deposit rates." with "Try again".

**Screen `closeQuote` — "Close this deposit?"** (mode `close`). `onEnter`: `callApi closeQuote`. `reviewSummary`: Deposit "{{name}}", Principal, Interest earned so far, Early closing adjustment (negative, when closing before maturity: "Interest recalculated at 0.50% a year"), **You'll receive**, Paid to account. `alert` (before maturity) warning "You'd earn {{interestLoss}} less than if you waited until {{maturityDate}}." Buttons "Continue" (`navigate review`), "Keep my deposit" (`exit`).

**Screen `review` — "Review"**. Open: `reviewSummary` rows Deposit amount; Term; Rate "4.20% a year, fixed"; Interest at the end (e.g. "210.00" for 5,000.00 over 12 months: principal × rate × months ÷ 12); You'll get at the end "5,210.00"; Ends "15 Nov 2027"; Pay from; At the end (instruction in words). Renew: same with the matured amount. Close: the `closeQuote` rows. `consent` bind `td.consent`, termsVersion `deposits-v1`, text open/renew "I understand my money is locked until {{maturityDate}} and I agree to the deposit terms." / close "I understand I'll earn less interest by closing early." (the early-close text shows only before maturity). validation `mustBeTrue`: "Tick the box to continue." Button "Open deposit" / "Renew deposit" / "Close deposit" (`validate`, `callApi otpSend`, navigate `code`).

**Screen `code`**: standard one-time code (title "Confirm with your code"). Button text per mode; it calls `otpVerify` then `open`, `renew` or `close`, then `done`.

**Screen `done` (terminal)**: `result` success with title and text by mode:

| Mode | Title | Text |
|---|---|---|
| open | "Deposit opened" | "{{amount}} is locked for {{term}} months at {{rate}}%. It ends on {{maturityDate}}." |
| renew | "Deposit renewed" | "{{amount}} is locked until {{maturityDate}} at {{rate}}%." |
| close | "Deposit closed" | "{{received}} is in {{account}}." |

meta "Ref {{result.reference}}". Buttons "View deposit" and "Done". `locked`, `failed` standard (with "Nothing was changed and no money has moved." as the closing line).

#### 4. Sandbox errors

| Code | Message | Screen | Button |
|---|---|---|---|
| `ACCOUNT_NOT_FOUND` | "We can't find that account. Choose another." | `terms` | Choose account |
| `INVALID_AMOUNT` | "Enter an amount from $500 to $250,000." | `terms` | Change amount |
| `INSUFFICIENT_FUNDS` | "There isn't enough money in {{account}}. Available: {{balance}}. No money has left your account." | `terms` | Change amount |
| `TERM_INVALID` | "Choose a term of 3, 6, 12 or 24 months." | `terms` | Choose term |
| `INSTRUCTION_INVALID` | "Choose what should happen at the end." | `terms` | Choose |
| `DEPOSIT_NOT_FOUND` | "We can't find that deposit." | `failed` | Back to deposits |
| `DEPOSIT_NOT_MATURED` | "This deposit hasn't matured yet. You can renew from {{date}}." | `terms` | Back |
| `DEPOSIT_ALREADY_CLOSED` | "This deposit is already closed." | `failed` | Back to deposits |
| `LIMIT_EXCEEDED` | "This is above your daily limit of {{limit}}. You have {{remaining}} left today." | `terms` | Change amount |
| `OTP_INVALID`, `OTP_REQUIRED` | Standard | `code` | Try again / Back to code |
| `CORE_UNAVAILABLE` | "We couldn't complete this right now. No money has left your account." | `failed` | Try again |
| `TIMEOUT` | "We didn't get an answer in time. Check Activity before you try again, so you don't pay twice." | `failed` | Check Activity |
| `SERVICE_UNAVAILABLE` | Standard | `failed` | Try again |
| `PERMISSION_DENIED`, `WRONG_CONTEXT`, `SESSION_EXPIRED` | Standard | `failed` | Back / Switch / Sign in |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `accounts` | `bank.accounts.list` | none | accounts | none | Existing |
| `products` | `bank.deposits.products` | none | `{terms: [{months, rate}], min, max}` | none | (planned) |
| `deposit` | `bank.deposits.get` | `{depositId}` | deposit | `DEPOSIT_NOT_FOUND` | (planned) |
| `quote` | `bank.deposits.quote` | `{amount, termMonths}` | `{rate, interest, maturityAmount, maturityDate}` | `INVALID_AMOUNT`, `TERM_INVALID` | (planned) |
| `open` | `bank.deposits.open` | `{fromAccountId, amount, termMonths, instruction}` | `{depositId, reference, maturityDate, newBalance}` | section 4 | (planned) |
| `renew` | `bank.deposits.renew` | `{depositId, termMonths, instruction, addAmount?}` | `{depositId, reference, maturityDate}` | `DEPOSIT_NOT_FOUND`, `DEPOSIT_NOT_MATURED`, `TERM_INVALID`, `INSTRUCTION_INVALID`, `INSUFFICIENT_FUNDS` (when topping up) | (planned) |
| `closeQuote` | `bank.deposits.close.quote` | `{depositId}` | `{principal, interestEarned, adjustment, receive, early}` | `DEPOSIT_NOT_FOUND`, `DEPOSIT_ALREADY_CLOSED` | (planned) |
| `close` | `bank.deposits.close` | `{depositId, toAccountId}` | `{reference, received, newBalance}` | `DEPOSIT_NOT_FOUND`, `DEPOSIT_ALREADY_CLOSED`, `ACCOUNT_NOT_FOUND` | (planned) |
| `otpSend`, `otpVerify` | existing | | | `OTP_INVALID` | Existing |

`open`, `renew` (with top-up) and `close` are `moneyMoving: true`, `requiresOtp: true`. Opening is a transfer out of the account: it counts against the daily limit (`bank.limits.get`) like `bank.transfers.create`, and sets `otpVerified` back to false.

#### 6. Permissions, step-up and limits

`savings.manage`. Step-up `otp`. Limits: deposit 500.00 to 250,000.00 per deposit; the daily limit (Alex 50,000 USD) applies to `open`. Early close interest rule: interest recalculated at 0.50% a year for the days held; the principal is never reduced.

#### 7. Result and links out

Result `done`; receipt: deposit name, amount, term, rate, dates, account, reference. Notifications: "Deposit opened", "Your deposit matures in 7 days" (planned scheduled), "Deposit closed". Links out: deposit detail, Accounts (balance changed), Payments › tracker (the transfer).

#### 8. Acceptance criteria

- AC-1: A deposit can be opened from an account with enough money, for 500.00 to 250,000.00, for a term of 3, 6, 12 or 24 months.
- AC-2: The interest and the amount at the end are shown before the person confirms, and agree with the amount credited later.
- AC-3: Opening needs consent and a verified one-time code, and takes the money from the account.
- AC-4: Opening cannot exceed the account balance or the daily limit.
- AC-5: A matured deposit can be renewed with a new term and instruction; a deposit not yet matured (more than 14 days away) cannot.
- AC-6: Closing before maturity shows how much less interest the person earns and needs the consent line.
- AC-7: Closing pays principal plus interest earned to the chosen account and marks the deposit closed.
- AC-8: A closed deposit cannot be closed or renewed again.
- AC-9: Three wrong codes leave everything as it was.
- AC-10: A timeout leaves things unchanged and says to check Activity; an unavailable service moves no money.

#### 9. Scenarios

| # | Covers | Persona and setup | Outcome |
|---|---|---|---|
| T-1 | AC-1, AC-2, AC-3 | `alex`; open 5,000.00, 12 months, from Main, code `482100` | Quote interest 210.00, maturity amount 5,210.00; Main 8,720.76 → 3,720.76; deposit `active` |
| T-2 | AC-1 | `alex` | 400.00: "The smallest deposit is $500." Then 300,000: "The most you can deposit is $250,000." |
| T-3 | AC-4 | `alex`; open 9,000.00 from Main | `INSUFFICIENT_FUNDS`; balance unchanged |
| T-4 | AC-4 | `alex`; setup `limits.usedToday` 46,000; open 8,000 from Savings 15,254.37 | `LIMIT_EXCEEDED` |
| T-5 | AC-5 | `alex`; renew `dep_2` for 12 months | Deposit renewed; new maturity |
| T-6 | AC-5 | `alex`; renew `dep_1` (matures in 2+ months) | `DEPOSIT_NOT_MATURED` |
| T-7 | AC-6, AC-7 | `alex`; close `dep_1` early | Quote shows adjustment; consent line; account credited with principal plus reduced interest; status `closed` |
| T-8 | AC-8 | `alex`; after T-7 | Close again: `DEPOSIT_ALREADY_CLOSED` |
| T-9 | AC-3 | `alex` | Skip consent: "Tick the box to continue."; skip code: `OTP_REQUIRED` |
| T-10 | AC-9 | `alex`; wrong code x3 | `locked`; balance unchanged |
| T-11 | AC-10 | conditions `timeout: ["bank.deposits.open"]` | Check Activity text; no deposit; balance unchanged |
| T-12 | AC-10 | conditions `unavailable: ["bank.deposits.open"]` | `SERVICE_UNAVAILABLE`; unchanged |
| T-13 | AC-3 | `alex` with `transferFails` behaviour | `CORE_UNAVAILABLE`; no money moved |

#### 10. Expected mutation-check survivors

- Journey `min`/`max` on the amount: survive because `bank.deposits.open` returns `INVALID_AMOUNT` (another layer).
- Interest formula (months ÷ 12): killed by T-1 (exact 210.00).
- Early-close rate 0.50%: killed by T-7 only if the scenario asserts the credited amount; it must.
- Renew top-up with `addAmount`: **survives** (no scenario tops up; listed as not covered in Release 1).

---

### ★ Savings goal — `savings-goal`

#### 1. Summary

| Item | Value |
|---|---|
| Slug | `savings-goal` |
| Purpose | Set a goal with a target and a date, add money to it, and optionally save a fixed amount every month |
| Release | 1 |
| Workspace | Personal |
| Status | New (draft). Needs the planned goals domain |
| Channels | Web, mobile |
| Starting pattern | Mode-driven: `create`, `add` (add money), `edit`, `close` |
| Who may use it | Personal context holding `savings.manage` |

A goal is a named pot inside a savings account. Money in a goal is still in the account, but is marked as set aside so it isn't spent by mistake.

#### 2. Entry points

| Place › label | Passed | Permission |
|---|---|---|
| Save & Borrow › goals › New goal | none (mode `create`) | `savings.manage` |
| Save & Borrow › goals › Add money to goal | `{goalId}` (mode `add`) | `savings.manage` |
| Goal detail › Change goal / Close goal | `{goalId}` (mode `edit` / `close`) | `savings.manage` |

#### 3. Screens

**Screen `goal` — "New goal"** (create) / **"Change goal"** (edit).

| Field | Block | Required | Rule | Error message |
|---|---|---|---|---|
| Goal name | `textInput` bind `sg.name` (pattern `^.{2,30}$`) | Yes | 2 to 30 characters | "Give your goal a name of 2 to 30 characters." |
| Icon | `select` tiles (Trip, Home, Car, Study, Rainy day, Other) | Yes | One | "Choose an icon." |
| Target amount | `amountInput` bind `sg.target` | Yes | 100.00 to 1,000,000.00 | "A goal must be at least $100." / "A goal can be at most $1,000,000." |
| Target date | `datePicker` (planned) bind `sg.targetDate` | Yes | Between 1 month and 10 years from today | "Choose a date at least one month from now." / "Choose a date within 10 years." |
| Keep it in | `accountPicker` bind `sg.accountId` (savings accounts only) | Yes (create) | A savings account | "Choose an account." |
| First deposit | `amountInput` bind `sg.initial` (optional, default 0) | No | 0 to the source balance | "There isn't enough money in {{account}}. Available: {{balance}}." |
| Save automatically | `toggle` bind `sg.auto` | No | none | none |
| How much each month | `amountInput` bind `sg.autoAmount` (`visibleWhen sg.auto`) | Yes when on | 10.00 up to the target | "Enter an amount from $10." |
| Take it from | `accountPicker` bind `sg.fromAccountId` (`visibleWhen sg.auto`) | Yes when on | A different account that can debit | "Choose an account to save from." |
| Day of the month | `select` chips (1, 5, 10, 15, 25) | Yes when on | One | "Choose a day." |

A live "You'd reach your goal by {{forecastDate}}" line (computed from deposit, monthly amount and target) shows under the auto-save fields; if no monthly amount is set it reads "Add a monthly amount to see when you'd get there." Button "Continue" (`validate`, `navigate review`).

**Screen `addMoney` — "Add to {{goal.name}}"** (mode `add`). Fields: `accountPicker` "From" (bind `sg.fromAccountId`), `amountInput` "Amount" (quick 50, 100, 250, 500; rule 1.00 up to the balance and up to what remains to the target; message "Enter an amount from $1." / "You only need {{remaining}} more to reach your goal."). Button "Continue".

**Screen `review`.** `reviewSummary` by mode: Goal, Target, By, Keeps in, First deposit / Amount, Saves "{{autoAmount}} on the {{day}} of each month" (or "No automatic saving"), Forecast. `alert` info (auto only): "We'll move this money on the day. If you don't have enough, we'll try again the next day." Close mode: `alert` warning "Closing this goal releases {{saved}} back to {{account}}. Your money stays in your account." `consent` (create, edit with auto-save on): bind `sg.consent`, text "I agree that BankWorkx may move {{autoAmount}} every month from {{fromAccount}} until I stop it." validation `mustBeTrue` "Tick the box to continue." Button "Create goal" / "Save" / "Add {{amount}}" / "Close goal" (`validate`, `callApi otpSend`, navigate `code`).

**Screen `code`**: standard; calls `otpVerify`, then `create`, `contribute`, `update` or `close`; then `done`.

**Screen `done` (terminal):** create "Goal created" ("{{name}}: {{target}} by {{date}}."); add "Money added" ("{{amount}} is set aside for {{name}}. You've saved {{saved}} of {{target}}."); edit "Goal updated"; close "Goal closed" ("{{saved}} is free to use again."); a goal reached shows "Goal reached! Well done." with a `result` success. meta "Ref {{result.reference}}" for money-moving modes. `locked`, `failed` standard.

#### 4. Sandbox errors

| Code | Message | Screen | Button |
|---|---|---|---|
| `ACCOUNT_NOT_FOUND` | "We can't find that account. Choose another." | `goal` / `addMoney` | Choose account |
| `INVALID_AMOUNT` | "Enter a valid amount for this goal." | the screen with the amount | Change amount |
| `INSUFFICIENT_FUNDS` | "There isn't enough money in {{account}}. Available: {{balance}}. No money has left your account." | the amount screen | Change amount |
| `GOAL_NOT_FOUND` | "We can't find that goal." | `failed` | Back to goals |
| `GOAL_TARGET_INVALID` | "A goal must be between $100 and $1,000,000." | `goal` | Fix it |
| `GOAL_DATE_INVALID` | "Choose a date between 1 month and 10 years from now." | `goal` | Fix it |
| `GOAL_ALREADY_REACHED` | "This goal is already reached. Close it or raise the target." | `failed` | Change goal |
| `GOAL_LIMIT_REACHED` | "You can have up to 10 goals. Close one to add another." | `failed` | Back to goals |
| `AUTO_ACCOUNT_INVALID` | "Choose a different account to save from than the goal's account." | `goal` | Fix it |
| `LIMIT_EXCEEDED` | Standard | amount screen | Change amount |
| `OTP_INVALID`, `OTP_REQUIRED` | Standard | `code` | Try again / Back to code |
| `CORE_UNAVAILABLE` | Standard | `failed` | Try again |
| `TIMEOUT` | Money steps: "Check Activity before you try again, so you don't save twice." | `failed` | Check Activity |
| `SERVICE_UNAVAILABLE`, `PERMISSION_DENIED`, `WRONG_CONTEXT`, `SESSION_EXPIRED` | Standard | `failed` | Try again / Back / Switch / Sign in |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `accounts` | `bank.accounts.list` | none | accounts | none | Existing |
| `goal` | `bank.goals.get` | `{goalId}` | goal | `GOAL_NOT_FOUND` | (planned) |
| `create` | `bank.goals.create` | `{name, icon, target, targetDate, accountId, initial?, auto?: {amount, fromAccountId, day}}` | `{goalId, reference, forecastDate}` | `GOAL_TARGET_INVALID`, `GOAL_DATE_INVALID`, `GOAL_LIMIT_REACHED`, `ACCOUNT_NOT_FOUND`, `INSUFFICIENT_FUNDS`, `AUTO_ACCOUNT_INVALID`, `INVALID_AMOUNT`, `OTP_REQUIRED` | (planned) |
| `contribute` | `bank.goals.contribute` | `{goalId, fromAccountId, amount}` | `{reference, saved, remaining, newBalance}` | `GOAL_NOT_FOUND`, `GOAL_ALREADY_REACHED`, `INVALID_AMOUNT`, `ACCOUNT_NOT_FOUND`, `INSUFFICIENT_FUNDS`, `LIMIT_EXCEEDED`, `OTP_REQUIRED` | (planned) |
| `update` | `bank.goals.update` | `{goalId, name?, target?, targetDate?, auto?}` | goal | `GOAL_NOT_FOUND`, `GOAL_TARGET_INVALID`, `GOAL_DATE_INVALID`, `AUTO_ACCOUNT_INVALID`, `OTP_REQUIRED` | (planned) |
| `close` | `bank.goals.close` | `{goalId}` | `{reference, released}` | `GOAL_NOT_FOUND`, `OTP_REQUIRED` | (planned) |

`create` with a first deposit and `contribute` are `moneyMoving: true` (they move money between the person's own accounts and set money aside); all four `requiresOtp: true`.

#### 6. Permissions, step-up and limits

`savings.manage`. Step-up `otp`. Limits: target 100 to 1,000,000; 10 goals; monthly auto-save from 10.00; a contribution counts against the daily limit only when the money leaves the account it sits in.

#### 7. Result and links out

Result `done`; receipt for money-moving modes. Notifications: "Goal created", "You've reached 50% of {{name}}" (planned), "Auto-save failed: not enough money in {{account}}" (planned). Links out: goal detail, goals list.

#### 8. Acceptance criteria

- AC-1: A goal is created with a name, target, date, savings account, and optional first deposit and monthly saving.
- AC-2: Target and date rules are enforced with their own messages.
- AC-3: Setting up monthly saving needs consent, a different source account and a verified code.
- AC-4: Adding money to a goal moves it from the chosen account and updates saved and remaining.
- AC-5: The person cannot add more than the account holds or more than the goal needs.
- AC-6: Closing a goal frees the money and keeps it in the account.
- AC-7: The forecast date shown agrees with deposit, monthly amount and target.
- AC-8: At most 10 goals.
- AC-9: A timeout or unavailable service changes nothing; the timeout text names Activity.
- AC-10: Three wrong codes change nothing.

#### 9. Scenarios

| # | Covers | Persona and setup | Outcome |
|---|---|---|---|
| T-1 | AC-1, AC-3, AC-7 | `alex`; "New car", 6,000, date 12 months out, Savings, first deposit 500 from Main, auto 250 from Main, day 5, code `482100` | Goal created; Main 8,720.76 → 8,220.76; forecast date shown |
| T-2 | AC-2 | `alex` | Target 50: message; date 3 days out: message |
| T-3 | AC-3 | `alex` | Auto on with source = goal account: `AUTO_ACCOUNT_INVALID`; skip consent: message; skip code: `OTP_REQUIRED` |
| T-4 | AC-4 | `alex`; add 200 to `goal_1` | Saved 1,450.00 of 4,000.00 |
| T-5 | AC-5 | `alex`; add 99,999 / add 3,000 to `goal_1` | `INSUFFICIENT_FUNDS` / "You only need 2,750.00 more to reach your goal." |
| T-6 | AC-6 | `alex`; close `goal_1` | `released` 1,250.00; account balance unchanged; goal closed |
| T-7 | AC-8 | `alex`; setup 10 goals | `GOAL_LIMIT_REACHED` |
| T-8 | AC-10 | `alex` | Wrong code x3: `locked`; no goal |
| T-9 | AC-9 | conditions `timeout: ["bank.goals.contribute"]` | Check Activity text; saved unchanged |
| T-10 | AC-9 | conditions `unavailable: ["bank.goals.create"]` | `SERVICE_UNAVAILABLE`; no goal |

#### 10. Expected mutation-check survivors

- Forecast date calculation is journey-side display: **survives** unless a scenario asserts the text (T-1 does, so killed).
- 10-goal limit exact value: killed by T-7 only with exactly 10 set up; off-by-one survives otherwise.
- Day-of-month chips: **survive** (the sandbox never runs the monthly schedule).

---

### ★ Apply for a loan — `apply-loan`

#### 1. Summary

| Item | Value |
|---|---|
| Slug | `apply-loan` |
| Purpose | Check what you can borrow, see the repayment schedule, sign the agreement and receive the money |
| Release | 1 |
| Workspace | Personal |
| Status | New (draft). Needs the planned loans domain and the planned `documentViewer`, `signature` and `dataTable` blocks |
| Channels | Web, mobile |
| Starting pattern | Terms → eligibility → schedule preview → documents → consent → signature → code → decision |
| Who may use it | Personal context holding `loans.apply` |

#### 2. Entry points

| Place › label | Passed | Permission |
|---|---|---|
| Save & Borrow › loans › Apply | `{productId}` | `loans.apply` |
| Home › Offer › Apply | `{offerId}` (resolved to `{productId, amount}`) | `loans.apply` |
| Products › loan detail (public) → sign in | `{productId}` | `loans.apply` |

#### 3. Screens

**Screen `terms` — "How much do you want to borrow?"** `onEnter`: `callApi product`, `callApi accounts`.

| Field | Block | Required | Rule | Error message |
|---|---|---|---|---|
| Amount | `amountInput` bind `loan.amount` (quick 2,500; 5,000; 10,000; 20,000) | Yes | 1,000.00 to 50,000.00, whole currency units | "The smallest loan is $1,000." / "The most you can borrow is $50,000." |
| Length | `select` chips bind `loan.termMonths`: 6, 12, 24, 36, 48, 60 months | Yes | One of the six | "Choose how many months." |
| What it's for | `select` rows bind `loan.purpose`: Home improvement, Car, Education, Travel, Debt consolidation, Other | Yes | One | "Choose what the loan is for." |
| Pay the money into | `accountPicker` bind `loan.toAccountId` | Yes | An active account | "Choose where to receive the money." |
| Take instalments from | `accountPicker` bind `loan.fromAccountId` | Yes | An account that can debit | "Choose where to pay from." |
| Pay on day | `select` chips (1, 5, 10, 15, 25) bind `loan.dueDay` | Yes | One | "Choose a payment day." |

Below the fields a live card shows "About {{instalment}} a month for {{term}} months. Interest {{rate}}% a year." (from `bank.loans.schedule` preview with `preview: true`; falls back to the product's example if the call fails). Button "Check my offer" (`validate`, `callApi eligibility`, navigate `offer`).

**Screen `offer` — "Your offer".** Three outcomes, chosen by `ctx.elig.decision`:

- `approved`: `result`-style `hero` card "You can borrow {{amount}}". `reviewSummary` rows: Loan amount; Interest rate "{{rate}}% a year, fixed"; Length; Monthly payment; Arrangement fee "{{fee}} (1.00%, minimum 25.00), taken from the loan"; **You'll receive** (amount minus fee); Total you'll pay back; Total interest; Yearly cost (APR) "{{apr}}%"; First payment date. Link "See full schedule" opens the `schedule` screen. Buttons "Continue" (to `documents`), "Change the loan" (to `terms`).
- `referred` (amount above 30,000.00): `alert` info "We need a person to look at this one. We'll reply within 2 working days." Button "Send for review" (continues the same path but the final step creates a pending application with no money), "Change the loan".
- `declined`: `alert` warning with the reason text from the adapter (section 4). Button "Try a smaller amount" (to `terms`), "Back to loans" (`exit`).

**Screen `schedule` — "Repayment schedule".** `dataTable` (planned) with columns No., Due date, Instalment, Principal, Interest, Balance after (rows from `bank.loans.schedule`; first 12 rows, "Show all" for the rest). Button "Back to offer".

**Screen `documents` — "Read your agreement".** `documentViewer` (planned) showing two documents: "Key facts" (one page) and "Loan agreement"; the button below stays disabled until the person scrolls both to the end. Helper "Please read both documents. You'll sign them next."

**Screen `consent` — "Your permissions".** Two `consent` blocks:

| Field | Block | Required | Rule | Error message |
|---|---|---|---|---|
| Terms | `consent` bind `loan.consentTerms`, termsVersion `loans-v1` | Yes | `mustBeTrue` | "Tick the box to continue." |
| Credit check | `consent` bind `loan.consentCredit`, termsVersion `credit-v1` | Yes | `mustBeTrue` | "We need your permission to check your credit to go on." |

Texts: "I have read the key facts and the agreement, and I agree to repay {{amount}} in {{term}} instalments of {{instalment}}." and "I allow BankWorkx to check my credit record and my income for this application." Button "Continue" (`validate`, navigate `sign`).

**Screen `sign` — "Sign your agreement".** `signature` (planned) bind `loan.signature`: draw with a finger or mouse, or type your full name "{{profile.name}}". Rule: the typed name must equal the name on the account (case-insensitive); a drawn signature must have at least 20 points. Error: "Sign with your full name, {{profile.name}}." / "Please draw your signature in the box." Button "Sign and continue" (`validate`, `callApi otpSend`, navigate `code`).

**Screen `code`**: standard one-time code. Button "Confirm and get my loan" calls `otpVerify`, then `apply`, then `decision`.

**Screen `decision` (terminal).**

| Outcome | Title | Text | Buttons |
|---|---|---|---|
| Approved and paid | "Loan paid out" | "{{received}} is in {{account}}. Your first payment of {{instalment}} is due on {{firstDue}}." meta "Ref {{result.reference}}" | "View loan", "Done" |
| Pending review | "We're reviewing your application" | "We'll tell you the result by {{replyBy}}. Nothing has been taken from you." meta "Application {{result.applicationId}}" | "Track application" (`track-application`), "Done" |
| Not approved at the last step (the checks changed) | "We couldn't approve this loan" | `{{ctx.error.message}}` | "Back to loans" |

`locked`, `failed` standard ("Nothing was borrowed.").

States: skeletons on `terms` while the product loads; `offer` shows a progress "Checking your offer" while eligibility runs (10 s limit then the timeout state "This is taking longer than expected. Nothing was changed.").

#### 4. Sandbox errors

| Code | Message | Screen | Button |
|---|---|---|---|
| `PRODUCT_NOT_FOUND` | "We can't find that loan. Choose another." | `failed` | Back to loans |
| `AMOUNT_OUT_OF_RANGE` | "You can borrow from $1,000 to $50,000." | `terms` | Change amount |
| `TERM_OUT_OF_RANGE` | "Choose a length from 6 to 60 months." | `terms` | Change length |
| `ACCOUNT_NOT_FOUND` | "We can't find that account. Choose another." | `terms` | Choose account |
| `LOAN_NOT_ELIGIBLE` | "We can't offer you a loan right now. {{reason}}" | `offer` | Back to loans |
| `NO_INCOME_HISTORY` | "We need to see your salary paid in for at least 3 months before we can lend." | `offer` | Back to loans |
| `AFFORDABILITY` | "This payment is too high for your income. Try {{maxAmount}} or a longer term." | `offer` | Try a smaller amount |
| `ACTIVE_APPLICATION` | "You already have a loan application in progress." | `failed` | Track application |
| `SIGNATURE_INVALID` | "Sign with your full name, {{name}}." | `sign` | Sign again |
| `OTP_INVALID`, `OTP_REQUIRED` | Standard | `code` | Try again / Back to code |
| `CORE_UNAVAILABLE` | "We couldn't complete this right now. Nothing was borrowed." | `failed` | Try again |
| `TIMEOUT` | "We didn't get an answer in time. Check your loans and Activity before you try again, so you don't borrow twice." | `failed` | Check Activity |
| `SERVICE_UNAVAILABLE` | Standard | `failed` | Try again |
| `PERMISSION_DENIED`, `WRONG_CONTEXT`, `SESSION_EXPIRED` | Standard | `failed` | Back / Switch / Sign in |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `accounts` | `bank.accounts.list` | none | accounts | none | Existing |
| `product` | `bank.loans.products` | none | products with min, max, terms, rate, fee | none | (planned) |
| `eligibility` | `bank.loans.eligibility` | `{productId, amount, termMonths}` | `{decision, maxAmount, rate, instalment, fee, receive, totalRepay, totalInterest, apr, reason?}` | `PRODUCT_NOT_FOUND`, `AMOUNT_OUT_OF_RANGE`, `TERM_OUT_OF_RANGE`, `LOAN_NOT_ELIGIBLE`, `NO_INCOME_HISTORY`, `AFFORDABILITY` | (planned) |
| `schedule` | `bank.loans.schedule` | `{productId?, amount, termMonths, dueDay}` or `{loanId}` | `{rows: [{n, dueDate, instalment, principal, interest, balance}]}` | `AMOUNT_OUT_OF_RANGE`, `TERM_OUT_OF_RANGE` | (planned) |
| `apply` | `bank.loans.apply` | `{productId, amount, termMonths, purpose, toAccountId, fromAccountId, dueDay, consents, signature}` | `{decision, loanId?, applicationId?, reference, received, firstDue, replyBy?}` | all of the above + `SIGNATURE_INVALID`, `ACTIVE_APPLICATION`, `ACCOUNT_NOT_FOUND`, `CORE_UNAVAILABLE`, `OTP_REQUIRED` | (planned) |
| `otpSend`, `otpVerify` | existing | | | `OTP_INVALID` | Existing |

`apply` is `moneyMoving: true` (it credits the loan to the account) and `requiresOtp: true`. The sandbox rules (planned): eligibility needs a salary credit in each of the last 3 months (Alex has; Sam has none, so `NO_INCOME_HISTORY`); maximum loan 6 times monthly income (Alex's salary 3,200.00 → 19,200.00 without review, so up to 30,000.00 referrals are possible only via the sandbox override); the instalment may not exceed 40% of monthly income minus existing instalments (Alex: 1,280.00 − 368.75 = 911.25); above 30,000.00 the decision is `referred`. Instalment formula: equal payments, interest on the remaining balance each month. Example: 10,000.00 over 24 months at 9.90% gives 460.94 a month, arrangement fee 100.00, receives 9,900.00, total repaid 11,062.56, total interest 1,062.56.

#### 6. Permissions, step-up and limits

`loans.apply`. Step-up `otp`, plus signature. Product limits: 1,000 to 50,000; 6 to 60 months; one application at a time. The loan credit is not a transfer, so the daily transfer limit does not apply.

#### 7. Result and links out

Result `decision`. Receipt: loan summary (amount, fee, rate, term, instalment, first due, reference). Notifications: "Loan paid out", "Your application is under review", "Your first payment is due on {{date}}" (planned). Links out: loan detail, `track-application` (pending), Accounts (new balance).

#### 8. Acceptance criteria

- AC-1: A loan of 1,000 to 50,000 for 6 to 60 months can be applied for when the person qualifies.
- AC-2: The monthly payment, fee, amount received, total repaid and rate are shown before anything is signed, and agree with the schedule and the credited amount.
- AC-3: A person without 3 months of salary is told why they are not offered a loan.
- AC-4: A payment above the affordable amount is refused with a suggested maximum.
- AC-5: The agreement must be opened to the end, both consents ticked, and the signature given before the code is sent.
- AC-6: The loan is paid out only after a verified one-time code, and the received amount is the loan minus the fee.
- AC-7: Loans above 30,000 go to review, with no money paid.
- AC-8: Only one application is in progress at a time.
- AC-9: Three wrong codes pay out nothing.
- AC-10: A timeout tells the person to check before applying again; an unavailable service pays out nothing.

#### 9. Scenarios

| # | Covers | Persona and setup | Outcome |
|---|---|---|---|
| T-1 | AC-1, AC-2, AC-5, AC-6 | `alex`; 10,000, 24 months, Main both ways, signature typed "Alex Morgan", code `482100` | Offer 460.94 a month, receive 9,900.00; Main 8,720.76 → 18,620.76; `loan` created |
| T-2 | AC-2 | `alex`; same | Schedule row 24 balance 0.00; sum of interest 1,062.56 |
| T-3 | AC-3 | `sam` (setup an account) | `NO_INCOME_HISTORY` |
| T-4 | AC-4 | `alex`; 20,000 over 6 months | `AFFORDABILITY` with a suggested maximum |
| T-5 | AC-5 | `alex` | Skip consent: both messages; sign "A Morgan": `SIGNATURE_INVALID` |
| T-6 | AC-7 | `alex`; 35,000 | `referred`; no money; application created |
| T-7 | AC-8 | `alex`; after T-6 | Another application: `ACTIVE_APPLICATION` |
| T-8 | AC-9 | `alex` | Wrong code x3: `locked`; balance unchanged |
| T-9 | AC-10 | conditions `timeout: ["bank.loans.apply"]` | Check Activity text; no loan; balance unchanged |
| T-10 | AC-10 | conditions `unavailable: ["bank.loans.apply"]` | `SERVICE_UNAVAILABLE`; no loan |
| T-11 | AC-6 | `alex` with `transferFails` | `CORE_UNAVAILABLE`; "Nothing was borrowed." |

#### 10. Expected mutation-check survivors

- 40% affordability factor: killed by T-4 only at the boundary; a tiny change **survives** (listed: "boundary not exercised").
- Fee minimum of 25.00: **survives** (no small loan scenario; add a 1,000 loan to kill it).
- `documentViewer` must-scroll rule: **survives** (UI rule the sandbox cannot see).

---

### ★ Repay a loan — `repay-loan`

#### 1. Summary

| Item | Value |
|---|---|
| Slug | `repay-loan` |
| Purpose | Pay the next instalment, pay extra, or settle the whole loan early |
| Release | 1 |
| Workspace | Personal |
| Status | New (draft). Needs the planned loans domain |
| Channels | Web, mobile |
| Starting pattern | Choose what to pay → quote (for settlement) → review → code → result |
| Who may use it | Personal context holding `loans.repay` |

Three modes: `instalment` (the amount due now), `extra` (any amount, which shortens the loan; the instalment stays the same), `settle` (everything owed today, from a settlement quote).

#### 2. Entry points

| Place › label | Passed | Permission |
|---|---|---|
| Save & Borrow › loan › Repay | `{loanId, mode: "instalment"}` | `loans.repay` |
| Save & Borrow › loan › Settle early | `{loanId, mode: "settle"}` | `loans.repay` |
| Notification "Your loan payment is due" | `{loanId, mode: "instalment"}` | `loans.repay` |

#### 3. Screens

**Screen `choose` — "Repay {{loan.name}}"** (shown when no mode is passed). `onEnter`: `callApi loan`, `callApi accounts`. `select` tiles bind `rp.mode`: "Pay this month's instalment ({{instalment}} due {{dueDate}})"; "Pay extra" (help "Pay off the loan sooner and save interest"); "Pay it all off" (help "Close the loan today"). Summary card: outstanding balance, next due date, paid and left counts.

**Screen `pay` — "Pay".**

| Field | Block | Required | Rule | Error message |
|---|---|---|---|---|
| Pay from | `accountPicker` bind `rp.fromAccountId` (`showBalance`) | Yes | An active account in the loan's currency | "Choose an account." |
| Amount | `amountInput` bind `rp.amount` | Yes (instalment: fixed and read-only at the amount due; extra: editable) | extra: 1.00 up to the outstanding balance, at most 2 decimals | "Enter an amount from $1." / "You only owe {{outstanding}}. To pay it all off, choose Pay it all off." |

For `extra`, the live line reads "This will take about {{monthsSaved}} months off your loan and save you about {{interestSaved}} in interest." Overdue loans show `alert` warning "This payment is {{days}} days late. A late fee of {{lateFee}} is included." (late fee rule below). Button "Continue" (`validate`, `navigate review`).

**Screen `settleQuote` — "Pay it all off"** (mode `settle`). `onEnter`: `callApi quote`. `reviewSummary`: Outstanding balance; Interest to today; Early payoff fee (1.00% of the outstanding balance); **Total to pay today**; Quote valid until (a countdown from 120 seconds). `accountPicker` "Pay from". `alert` info "After this, you won't owe anything on this loan and the monthly payments stop." When the quote expires: `alert` warning "This price has expired. Get a new one." and button "Get a new price" (calls `quote` again); the pay button is disabled. Button "Continue" (`navigate review`).

**Screen `review` — "Review payment".** `reviewSummary` by mode: Loan; Paying (Instalment / Extra payment / Full payoff); Amount; From; Late fee (when any); Balance after (for settle "0.00"). `consent` (settle only): `rp.consent`, text "I understand this closes my loan and the early payoff fee isn't refundable." `mustBeTrue` "Tick the box to continue." Button "Pay {{amount}}" (`validate`, `callApi otpSend`, navigate `code`).

**Screen `code`**: standard. Button "Confirm and pay {{amount}}" calls `otpVerify`, then `repay` or `settle`, then `done`.

**Screen `done` (terminal).**

| Mode | Title | Text |
|---|---|---|
| instalment | "Payment made" | "{{amount}} paid. {{left}} payments left. Next one is due {{nextDue}}." |
| extra | "Extra payment made" | "{{amount}} paid. Your loan will now end on {{newEnd}}, {{monthsSaved}} months sooner." |
| settle | "Loan paid off" | "You paid {{amount}} and you don't owe anything on this loan." |

meta "Ref {{result.reference}}". Buttons "View loan", "Done". `locked`, `failed` standard ("No money has left your account.").

#### 4. Sandbox errors

| Code | Message | Screen | Button |
|---|---|---|---|
| `LOAN_NOT_FOUND` | "We can't find that loan." | `failed` | Back to loans |
| `LOAN_CLOSED` | "This loan is already paid off." | `failed` | Back to loans |
| `NOTHING_DUE` | "There's no payment due yet. You can pay extra instead." | `choose` | Pay extra |
| `ACCOUNT_NOT_FOUND` | "We can't find that account. Choose another." | `pay` | Choose account |
| `INVALID_AMOUNT` | "Enter an amount from $1 up to {{outstanding}}." | `pay` | Change amount |
| `INSUFFICIENT_FUNDS` | "There isn't enough money in {{account}}. Available: {{balance}}. No money has left your account." | `pay` | Change amount |
| `LIMIT_EXCEEDED` | "This is above your daily limit of {{limit}}. You have {{remaining}} left today." | `pay` | Change amount |
| `QUOTE_NOT_FOUND` | "We can't find that price. Get a new one." | `settleQuote` | Get a new price |
| `QUOTE_USED` | "This price has already been used." | `settleQuote` | Get a new price |
| `QUOTE_EXPIRED` | "This price has expired. Get a new one." | `settleQuote` | Get a new price |
| `OTP_INVALID`, `OTP_REQUIRED` | Standard | `code` | Try again / Back to code |
| `CORE_UNAVAILABLE` | "We couldn't complete this right now. No money has left your account." | `failed` | Try again |
| `TIMEOUT` | "We didn't get an answer in time. Check Activity before you try again, so you don't pay twice." | `failed` | Check Activity |
| `SERVICE_UNAVAILABLE`, `PERMISSION_DENIED`, `WRONG_CONTEXT`, `SESSION_EXPIRED` | Standard | `failed` | Try again / Back / Switch / Sign in |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `accounts` | `bank.accounts.list` | none | accounts | none | Existing |
| `loan` | `bank.loans.get` | `{loanId}` | loan, outstanding, next instalment | `LOAN_NOT_FOUND` | (planned) |
| `quote` | `bank.loans.settlement.quote` | `{loanId, fromAccountId}` | `{quoteId, outstanding, interestToDate, fee, total, expiresAt, ttlSeconds: 120}` | `LOAN_NOT_FOUND`, `LOAN_CLOSED`, `ACCOUNT_NOT_FOUND`, `INSUFFICIENT_FUNDS` | (planned) |
| `repay` | `bank.loans.repay` | `{loanId, fromAccountId, amount, kind: "instalment" or "extra"}` | `{reference, paid, outstanding, left, nextDue, newEnd?, monthsSaved?}` | `LOAN_NOT_FOUND`, `LOAN_CLOSED`, `NOTHING_DUE`, `ACCOUNT_NOT_FOUND`, `INVALID_AMOUNT`, `INSUFFICIENT_FUNDS`, `LIMIT_EXCEEDED`, `CORE_UNAVAILABLE`, `OTP_REQUIRED` | (planned) |
| `settle` | `bank.loans.settle` | `{quoteId}` | `{reference, paid, newBalance}` | `QUOTE_NOT_FOUND`, `QUOTE_USED`, `QUOTE_EXPIRED`, `INSUFFICIENT_FUNDS`, `CORE_UNAVAILABLE`, `OTP_REQUIRED` | (planned) |
| `otpSend`, `otpVerify` | existing | | | `OTP_INVALID` | Existing |

`repay` and `settle` are `moneyMoving: true`, `requiresOtp: true`. The settlement quote follows the existing FX quote pattern in `packages/mock-bank-api/src/index.ts` (`bank.fx.quote` / `bank.fx.convert`: a quote id, one use, a `QUOTE_*` error, a clock the tests replace) with its own 120-second life. Rules (planned): interest to date = daily accrual (rate ÷ 365 on the outstanding balance); early payoff fee 1.00% of the outstanding balance; late fee 10.00 once the instalment is more than 3 days overdue. Example from the seed: outstanding 5,183.40 → fee 51.83; interest to date depends on the day, so the test pins the sandbox clock.

#### 6. Permissions, step-up and limits

`loans.repay`. Step-up `otp`. The daily transfer limit applies to `repay` and `settle` (money leaves the account). Extra payment: at least 1.00, at most the outstanding balance.

#### 7. Result and links out

Result `done`; receipt shows loan, kind, amount, balance after, reference, date. Notifications: "Loan payment received", "Loan paid off" (planned). Links out: loan detail, schedule (refreshed), Payments › tracker.

#### 8. Acceptance criteria

- AC-1: The instalment due can be paid; the loan's paid and left counts update and the next due date moves on.
- AC-2: An extra payment reduces the outstanding balance and shortens the loan, and the person sees how much sooner.
- AC-3: A payoff is priced by a quote that lists balance, interest to date, fee and total, and that lasts 120 seconds and can be used once.
- AC-4: An expired or used quote cannot be paid and a new price is offered.
- AC-5: Paying off closes the loan, stops the schedule and needs the consent line.
- AC-6: A payment needs enough money in the account and respects the daily limit; nothing is taken otherwise.
- AC-7: Every payment needs a verified one-time code.
- AC-8: An overdue instalment shows and includes the late fee.
- AC-9: Three wrong codes take no money.
- AC-10: A timeout tells the person to check Activity; an unavailable service takes no money.

#### 9. Scenarios

| # | Covers | Persona and setup | Outcome |
|---|---|---|---|
| T-1 | AC-1, AC-7 | `alex`, `loan_1`, instalment from Main, code `482100` | 368.75 taken (8,720.76 → 8,352.01); 14 left; next due moves a month |
| T-2 | AC-2 | `alex`; extra 1,000 | Outstanding 5,183.40 → 4,183.40; months saved shown |
| T-3 | AC-3, AC-5 | `alex`; settle with the clock pinned | Quote total = outstanding + interest + 1.00% fee; loan `closed` |
| T-4 | AC-4 | `alex`; advance the clock 121 s | `QUOTE_EXPIRED`; "Get a new price" works |
| T-5 | AC-4 | `alex`; pay twice with one quote | `QUOTE_USED` |
| T-6 | AC-6 | `alex`; setup Main balance 100.00 | `INSUFFICIENT_FUNDS`; balance 100.00 |
| T-7 | AC-6 | `alex`; setup `usedToday` 49,900 | `LIMIT_EXCEEDED` |
| T-8 | AC-8 | `alex`; setup instalment 5 days overdue | Late fee 10.00 included: 378.75 |
| T-9 | AC-7 | `alex` | Call `repay` without a code: `OTP_REQUIRED` |
| T-10 | AC-9 | `alex` | Wrong code x3: `locked`; balance unchanged |
| T-11 | AC-10 | conditions `timeout: ["bank.loans.repay"]` | Check Activity text; balance unchanged |
| T-12 | AC-10 | conditions `unavailable: ["bank.loans.settle"]` | `SERVICE_UNAVAILABLE`; loan still open |

#### 10. Expected mutation-check survivors

- Fee percentage 1.00%: killed by T-3 (exact total).
- Late fee threshold of 3 days: **survives** (T-8 uses 5 days; boundary not covered).
- Months-saved calculation: **survives** unless a scenario asserts the text; T-2 asserts it, so killed.

---

### ★ Invest — `invest`

Existing, upgraded. Buy part of a share or fund.

#### 1. Summary

| Item | Value |
|---|---|
| Slug | `invest` (fixture `bankworkx.ts`, `invest`) |
| Purpose | Buy a stock or fund with an amount of money |
| Release | 1 |
| Workspace | Personal |
| Status | Existing, upgraded (adds a risk check, consent, one-time code and a step-up for large orders) |
| Channels | Mobile today (`channels: ["mobile"]`); upgrade adds web |
| Starting pattern | Choose → review with risk notice → (upgrade) consent, code → result |
| Who may use it | Personal context holding `invest.trade` |

#### 2. Entry points

| Place › label | Passed | Permission |
|---|---|---|
| Save & Borrow › investments › Buy (stock page) | `{symbol}` | `invest.trade` |
| Investments › Explore › row | `{symbol}` | `invest.trade` |
| Home › quick action (planned) | none | `invest.trade` |

When `{symbol}` is passed, `invest.symbol` is pre-set (the BankWorkx app does this today).

#### 3. Screens

**As built today.**

1. `buy` — "Invest". `onEnter`: `accounts` (`bank.accounts.list` into `ctx.accounts`) and `instruments` (`bank.invest.instruments` into `ctx.instruments`). Blocks: `stepper` (`buy`, `review`); `select` bind `invest.symbol`, label "What do you want to buy?", source `ctx.instruments` (names like "Lumen Robotics (LMRB) · $184.20"); `accountPicker` bind `invest.fromAccountId` (balances shown); `amountInput` bind `invest.amount`, label "Amount to invest", helper "From $1 to $50,000. You buy part of a share if the amount is smaller than its price.", quick amounts 25, 50, 100, 250, min 1 ("The smallest amount is $1"), max 50,000 ("The most you can invest at once is $50,000"); `button` "Continue" (`validate`, `navigate review`).
2. `review` — "Review order": `reviewSummary` (Buying, Amount, Order type "Market order at today's price", Fee "$0"); `alert` info "Investments can go down as well as up. This is a sandbox: no real money moves."; `button` "Buy ${{invest.amount | money}}" (`callApi buy`, navigate `success`; error navigates `failed`).
3. `success` (terminal) — "Order placed": "You bought {{result.shares}} of {{result.symbol}} at ${{result.price | money2}}." with "Ref {{result.reference}}" and "Done".
4. `failed` (terminal) — "Order not placed": "Nothing was bought and no money left your account. Check the amount and your balance, then try again." with "Try again" (back to `buy`).

There is no consent, no one-time code and one failure text for all errors.

**Upgraded.**

**Screen `buy`** (as built) with these fields:

| Field | Block | Required | Rule | Error message |
|---|---|---|---|---|
| What to buy | `select` | Yes | A symbol from the nine instruments | "Choose a stock or fund to buy" |
| Pay from | `accountPicker` | Yes | An account that can debit | "Choose an account." |
| Amount | `amountInput` | Yes | 1.00 to 50,000.00, at most 2 decimals | "The smallest amount is $1" / "The most you can invest at once is $50,000" |

A live line under the amount reads "About {{shares}} shares at ${{price}}" (amount ÷ price, 4 decimals as the sandbox rounds). Selecting a fund adds `alert` info with its risk word from the instrument's stats ("Risk: Medium", "Risk: High", "Risk: Low").

**Screen `review`** (as built) plus, new:

- `reviewSummary` rows: add "Pay from {{account}} ••{{n}}" and "Estimated shares {{shares}}".
- `alert` warning (the **risk notice**, required, replacing the sandbox-only line for the live flow): "Investments can go down as well as up, and you can lose some or all of the money you invest. Past results don't predict the future. This is a sandbox: no real money moves."
- For a fund with risk High or a stock in Technology: second `alert` "This investment can change in value quickly."
- `consent` bind `invest.consent`, termsVersion `invest-v1`, text "I understand the risks and I'm placing a market order at today's price. This isn't personal advice." validation `mustBeTrue`: "Tick the box to continue."
- Button "Continue to confirm" (`validate`). Orders of **5,000.00 or more** first run a step-up (`bank.session.stepUp`, planned); all orders then send a code (`otpSend`) and navigate `code`.

**Screen `code` (new):** standard one-time code. Button "Buy ${{invest.amount | money}}" calls `otpVerify` then `buy` then `success`.

**Screen `success`**: unchanged text, plus "Ref" and buttons "View my investments" and "Done".

**Screen `failed`**: `result` error with `{{ctx.error.message}}` and the line "Nothing was bought and no money left your account." Button "Try again" returns to `buy` (or `code` for OTP errors).

States: instrument list skeleton on `buy`; error loading instruments "We couldn't load the market. Try again."; timeouts as in the table.

#### 4. Sandbox errors

| Code | Exact adapter message | What the person sees | Screen | Button |
|---|---|---|---|---|
| `NOT_SUPPORTED` | "Not available for this customer" | Standard S-`NOT_SUPPORTED` | `failed` | Back |
| `INSTRUMENT_NOT_FOUND` | "Choose a stock or fund to buy" | "Choose a stock or fund to buy." | `buy` | Choose |
| `INVALID_AMOUNT` | "Enter an amount from $1 to $50,000" | "Enter an amount from $1 to $50,000." | `buy` | Change amount |
| `ACCOUNT_NOT_FOUND` | "Account not found" | Standard | `buy` | Choose account |
| `INSUFFICIENT_FUNDS` | "Insufficient funds" | "There isn't enough money in {{account}}. Available: {{balance}}. Nothing was bought." | `buy` | Change amount |
| `STEP_UP_REQUIRED` (planned) | | Standard | `review` | Confirm |
| `OTP_INVALID` | "Incorrect code" | Standard | `code` | Try again |
| `OTP_REQUIRED` (upgrade) | "OTP not verified" | Standard | `code` | Back to code |
| `TIMEOUT` (planned) | | "We didn't get an answer in time. Check your investments before you try again, so you don't buy twice." | `failed` | Check investments |
| `SERVICE_UNAVAILABLE` (planned) | | Standard | `failed` | Try again |
| `PERMISSION_DENIED`, `WRONG_CONTEXT`, `SESSION_EXPIRED` (planned) | | Standard | `failed` | Back / Switch / Sign in |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `accounts` | `bank.accounts.list` | none | accounts | none | Existing |
| `instruments` | `bank.invest.instruments` | none | record of instruments with `price`, `changePct`, `name` | none | Existing |
| `buy` | `bank.invest.buy` | `{symbol, fromAccountId, amount}` | `{reference, symbol, name, shares, price, newBalance}` | `NOT_SUPPORTED`, `INSTRUMENT_NOT_FOUND`, `INVALID_AMOUNT`, `ACCOUNT_NOT_FOUND`, `INSUFFICIENT_FUNDS` (+ `OTP_REQUIRED` in the upgrade) | Existing |
| `otpSend`, `otpVerify` | `bank.otp.send`, `bank.otp.verify` | | | `OTP_INVALID` | Existing |
| `stepUp` | `bank.session.stepUp` | `{method}` | `{ok}` | `STEP_UP_REQUIRED` | (planned) |

Behaviour of `bank.invest.buy` today: shares = amount ÷ price rounded to 4 decimals; adds to the holding and recalculates the average cost (or opens a holding); takes the amount from the account (rounded to cents); adds a "Bought SYM" transaction; reference `INV-20261102-…`. `moneyMoving: true`. `requiresOtp`: no today; **yes** in the upgrade. It does not use the daily transfer limit today (an investment is not a payment out); keep that.

#### 6. Permissions, step-up and limits

`invest.trade`. Step-up: `otp` for every order; `stepup` for orders of 5,000.00 or more (planned threshold). Amount 1.00 to 50,000.00 per order. Risk notice and consent are required for the live flow.

#### 7. Result and links out

Result `success`; receipt: symbol, shares, price, amount, account, reference, date. Notifications: "You bought {{shares}} of {{symbol}}" (in-app). Links out: Investments (portfolio refreshed), stock page, Accounts (balance), Payments › tracker (no, investments do not appear there).

#### 8. Acceptance criteria

- AC-1: A stock or fund can be bought with $1 to $50,000 from an account with enough money.
- AC-2: The shares bought equal the amount divided by today's price, to 4 decimals, and the holding and its average cost update.
- AC-3: The risk notice is shown on the review screen and consent must be ticked.
- AC-4: The order is placed only after a verified one-time code.
- AC-5: An order of 5,000.00 or more asks for step-up first.
- AC-6: Too little money, an unknown instrument or an invalid amount places no order and keeps the balance.
- AC-7: Each error shows its own message.
- AC-8: Three wrong codes place no order.
- AC-9: A timeout tells the person to check investments; an unavailable service places no order.

#### 9. Scenarios

| # | Covers | Persona and setup | Outcome |
|---|---|---|---|
| T-1 | AC-1, AC-2 | `alex`; buy $100 of LMRB (184.20) from Main | 0.5429 shares; LMRB 6.5 → 7.0429; Main 8,720.76 → 8,620.76; "Bought LMRB" transaction |
| T-2 | AC-2 | `alex`; buy $1 of TBND | Shares 0.0102 (1 ÷ 98.30, 4 decimals) |
| T-3 | AC-3 | `alex` | Skip consent: "Tick the box to continue." |
| T-4 | AC-4 | `alex` | `buy` without a code: `OTP_REQUIRED`; with `482100` succeeds |
| T-5 | AC-5 | `alex`; $6,000 of GLBX | Step-up asked; without it `STEP_UP_REQUIRED` |
| T-6 | AC-6, AC-7 | `alex` | $9,000 from Main: `INSUFFICIENT_FUNDS`; $0 / $60,000: `INVALID_AMOUNT`; symbol `XXXX`: `INSTRUMENT_NOT_FOUND` |
| T-7 | AC-8 | `alex` | Wrong code x3: `locked`; no order |
| T-8 | AC-9 | conditions `timeout: ["bank.invest.buy"]` | Check investments text; holdings unchanged |
| T-9 | AC-9 | conditions `unavailable: ["bank.invest.buy"]` | `SERVICE_UNAVAILABLE`; no order |
| T-10 | AC-1 | `sam` | `NOT_SUPPORTED` is not expected (Sam has finance data); buying with no account: `ACCOUNT_NOT_FOUND` |

#### 10. Expected mutation-check survivors

- The 4-decimal rounding of shares: killed by T-1 and T-2.
- Journey-side min/max on the amount: survive; the sandbox returns `INVALID_AMOUNT` (another layer).
- The 5,000 threshold: killed by T-5 at 6,000; a threshold of 5,001 **survives** (boundary not covered).

---

### ★ Sell investment — `sell-investment`

Existing, upgraded. Sell part or all of a holding.

#### 1. Summary

| Item | Value |
|---|---|
| Slug | `sell-investment` (fixture `bankworkx.ts`, `sellInvestment`) |
| Purpose | Sell an amount of something the person owns and receive the money |
| Release | 1 |
| Workspace | Personal |
| Status | Existing, upgraded (adds consent, one-time code, a sale estimate and per-error messages) |
| Channels | Mobile today; upgrade adds web |
| Starting pattern | Choose holding → review → (upgrade) consent, code → result |
| Who may use it | Personal context holding `invest.trade` |

#### 2. Entry points

| Place › label | Passed | Permission |
|---|---|---|
| Save & Borrow › investments › Sell (stock page of a holding) | `{symbol}` | `invest.trade` |
| Investments › Portfolio › holding › Sell | `{symbol}` | `invest.trade` |

#### 3. Screens

**As built today.**

1. `sell` — "Sell". `onEnter`: `accounts` and `holdings` (`bank.invest.holdings` into `ctx.holdings`). Blocks: `stepper` (`sell`, `review`); `select` bind `sell.symbol` ("What do you want to sell?", source `ctx.holdings`, names like "Lumen Robotics (LMRB) · $1,197.30"); `amountInput` bind `sell.amount` ("Amount to sell", helper "You can sell up to the value of what you own. Selling all of it closes the holding.", quick 25, 50, 100, 250, min 1 "The smallest amount is $1"); `accountPicker` bind `sell.toAccountId` (balances shown); `button` "Continue".
2. `review` — "Review sale": `reviewSummary` (Selling, Amount, Order type "Market order at today's price", Fee "$0"); `alert` info "The money reaches your account straight away. This is a sandbox: no real money moves."; `button` "Sell ${{sell.amount | money}}".
3. `success` — "Sale complete": "You sold {{result.shares}} of {{result.symbol}} and ${{result.proceeds | money2}} is in your account." meta "Ref {{result.reference}}".
4. `failed` — "Sale not completed": "Nothing was sold and your account is unchanged. You can only sell up to the value of what you own." Button "Try again".

**Upgraded.**

**Screen `sell`** (as built) with:

| Field | Block | Required | Rule | Error message |
|---|---|---|---|---|
| What to sell | `select` | Yes | A symbol the person holds | "Choose something you own to sell" |
| Amount | `amountInput` | Yes | At least 1.00 and no more than the holding's value (the sandbox allows 0.005 over) | "The smallest amount is $1" / "You only hold ${{value}} of {{symbol}}." |
| Pay into | `accountPicker` | Yes | An active account | "Choose an account." |
| Sell everything | `toggle` bind `sell.all` (new) | No | When on, the amount is set to the full value | none |

Helper "Selling all of it closes the holding" remains. A live line: "About {{shares}} shares at ${{price}}".

**Screen `review`** adds: rows Pay into, Estimated shares; `alert` warning "Prices can change before your order is filled. You may sell for more or less than your average cost of ${{avgCost}} a share." For a full sale: `alert` info "This sells all {{shares}} shares and removes {{symbol}} from your portfolio." `consent` bind `sell.consent`, termsVersion `invest-v1`, text "I confirm this sale at today's price." mustBeTrue "Tick the box to continue." Button "Continue to confirm" (`validate`, `otpSend`, navigate `code`). Sales of 5,000.00 or more run step-up first.

**Screen `code` (new):** standard. Button "Sell ${{sell.amount | money}}" calls `otpVerify`, then `sell`, then `success`.

**Screen `success`**: as built plus buttons "View my investments", "Done". A full sale adds: "{{symbol}} is no longer in your portfolio."

**Screen `failed`**: `{{ctx.error.message}}` and "Nothing was sold and your account is unchanged."

#### 4. Sandbox errors

| Code | Exact adapter message | What the person sees | Screen | Button |
|---|---|---|---|---|
| `NOT_SUPPORTED` | "Not available for this customer" | Standard | `failed` | Back |
| `NOT_HELD` | "Choose something you own to sell" | "You don't own that. Choose something from your portfolio." | `sell` | Choose |
| `INVALID_AMOUNT` | "Enter an amount of at least $1" | "Enter an amount of at least $1." | `sell` | Change amount |
| `ACCOUNT_NOT_FOUND` | "Account not found" | Standard | `sell` | Choose account |
| `INSUFFICIENT_HOLDING` | "You only hold ${value} of {SYM}" | "You only hold ${value} of {SYM}. Choose a smaller amount." (value truncated down to the cent) | `sell` | Change amount |
| `OTP_INVALID` | "Incorrect code" | Standard | `code` | Try again |
| `OTP_REQUIRED` (upgrade) | "OTP not verified" | Standard | `code` | Back to code |
| `STEP_UP_REQUIRED` (planned) | | Standard | `review` | Confirm |
| `TIMEOUT` (planned) | | "We didn't get an answer in time. Check your investments and account before you try again, so you don't sell twice." | `failed` | Check investments |
| `SERVICE_UNAVAILABLE` (planned) | | Standard | `failed` | Try again |
| `PERMISSION_DENIED`, `WRONG_CONTEXT`, `SESSION_EXPIRED` (planned) | | Standard | `failed` | Back / Switch / Sign in |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `accounts` | `bank.accounts.list` | none | accounts | none | Existing |
| `holdings` | `bank.invest.holdings` | none | record of holdings with `shares`, `value`, `name` | `NOT_SUPPORTED` | Existing |
| `sell` | `bank.invest.sell` | `{symbol, toAccountId, amount}` | `{reference, symbol, name, shares, price, proceeds, newBalance}` | `NOT_SUPPORTED`, `NOT_HELD`, `INVALID_AMOUNT`, `ACCOUNT_NOT_FOUND`, `INSUFFICIENT_HOLDING` (+ `OTP_REQUIRED`) | Existing |
| `otpSend`, `otpVerify` | existing | | | `OTP_INVALID` | Existing |
| `stepUp` | `bank.session.stepUp` | `{method}` | `{ok}` | `STEP_UP_REQUIRED` | (planned) |

Behaviour today: value = shares × price; amount over value + 0.005 is `INSUFFICIENT_HOLDING`; if the value left after the sale is under 1 cent, every share is sold and the proceeds are the whole value (no rounding crumbs) and the holding is removed; otherwise shares sold = amount ÷ price to 4 decimals. Adds a "Sold SYM" transaction. Reference `SEL-20261102-…`. `moneyMoving: true`, `requiresOtp`: no today, yes in the upgrade.

#### 6. Permissions, step-up and limits

`invest.trade`. Step-up `otp`; `stepup` from 5,000.00 (planned). Minimum 1.00; maximum the holding's value. No daily limit applies to money coming in.

#### 7. Result and links out

Result `success`; receipt: symbol, shares, price, proceeds, account, reference. Notification: "You sold {{shares}} of {{symbol}}". Links out: Investments, stock page, Accounts.

#### 8. Acceptance criteria

- AC-1: A holding can be sold for any amount from $1 up to its value, and the money arrives in the chosen account.
- AC-2: Shares sold equal the amount divided by the price (4 decimals); the holding shrinks.
- AC-3: Selling the whole value removes the holding and leaves no part share.
- AC-4: Selling more than the holding is worth is refused and says what the person holds.
- AC-5: Something not owned cannot be sold.
- AC-6: The sale needs consent and a verified one-time code.
- AC-7: Three wrong codes sell nothing.
- AC-8: A timeout tells the person to check; an unavailable service sells nothing.

#### 9. Scenarios

| # | Covers | Persona and setup | Outcome |
|---|---|---|---|
| T-1 | AC-1, AC-2 | `alex`; sell $200 of LMRB (6.5 × 184.20 = 1,197.30) to Main | 1.0858 shares sold; LMRB 5.4142; Main +200.00 |
| T-2 | AC-3 | `alex`; sell 1,197.30 of LMRB | All 6.5 shares sold; holding removed; proceeds 1,197.30 |
| T-3 | AC-3 | `alex`; sell 1,197.29 | Treated as a full sale (under 1 cent left) |
| T-4 | AC-4 | `alex`; sell 1,300 of LMRB | `INSUFFICIENT_HOLDING` "You only hold $1197.30 of LMRB" |
| T-5 | AC-5 | `alex`; symbol `APXC` (watched, not held) | `NOT_HELD` |
| T-6 | AC-6 | `alex` | No consent: message; no code: `OTP_REQUIRED` |
| T-7 | AC-7 | `alex` | Wrong code x3: `locked`; holdings unchanged |
| T-8 | AC-8 | conditions `timeout: ["bank.invest.sell"]` | Check text; holdings unchanged |
| T-9 | AC-8 | conditions `unavailable: ["bank.invest.sell"]` | `SERVICE_UNAVAILABLE`; unchanged |

#### 10. Expected mutation-check survivors

- The 0.005 tolerance on over-selling: **survives** unless a scenario sells exactly value + 0.005 (listed).
- The "all sold" rule (under 1 cent): killed by T-2 and T-3.
- Journey `min` of 1: survives (the sandbox also checks `INVALID_AMOUNT`).

---

### ★ Add money — `add-money`

Existing, upgraded. Add money to an account from a saved card.

#### 1. Summary

| Item | Value |
|---|---|
| Slug | `add-money` (fixture `bankworkx.ts`, `addMoney`) |
| Purpose | Move money from a saved card into one of the person's accounts |
| Release | 1 |
| Workspace | Personal |
| Status | Existing, upgraded (adds consent, one-time code, card checks and per-error messages) |
| Channels | Mobile today; upgrade adds web |
| Starting pattern | Amount → review → (upgrade) consent, code → result |
| Who may use it | Personal context holding `payments.create` |

#### 2. Entry points

| Place › label | Passed | Permission |
|---|---|---|
| Home › + Add money | none | `payments.create` |
| Save & Borrow › investments › Add money | `{accountId}` | `payments.create` |
| Accounts › detail › Add money (planned) | `{accountId}` | `payments.create` |
| `add-card` result › Add money | none | `payments.create` |

#### 3. Screens

**As built today.**

1. `amount` — "Add money". `onEnter`: `accounts` (`bank.accounts.list` into `ctx.accounts`) and `cards` (`bank.cards.list` into `ctx.cards`; each card named "Nickname ••last4"). Blocks: `stepper` (`amount`, `review`); `accountPicker` bind `add.toAccountId` (balances shown); `amountInput` bind `add.amount` (label "Amount", helper "Enter an amount from $1 to $50,000 per transaction", quick 50, 100, 150, 200, min 1 "The smallest amount is $1", max 50,000 "The most you can add at once is $50,000"); `select` bind `add.fromCardId` ("From card", source `ctx.cards`); `button` "Continue".
2. `review` — "Review": `reviewSummary` (Amount, Fee "$0", You'll add); `button` "Add ${{add.amount | money}}" (`callApi addMoney`, navigate `success`, errors to `failed`).
3. `success` — "Money added": "${{add.amount | money}} is now in your account." meta "Ref {{result.reference}}".
4. `failed` — "Couldn't add money": "Nothing was charged to your card. Check the amount and try again." Button "Try again".

**Upgraded.**

**Screen `amount`** (as built) with these fields:

| Field | Block | Required | Rule | Error message |
|---|---|---|---|---|
| Add to | `accountPicker` | Yes | An active account | "Choose an account." |
| Amount | `amountInput` | Yes | 1.00 to 50,000.00, at most 2 decimals | "The smallest amount is $1" / "The most you can add at once is $50,000" |
| From card | `select` | Yes | A saved card (not expired, not frozen at the issuer in future) | "Choose a card to add money from" |

If the customer has no saved card the screen shows the empty state "You haven't saved a card yet." with the button "Add a card" (`navigate toJourney add-card`, `returnTo` this journey). The default card is pre-selected.

**Screen `review`** (as built) plus: rows "From {{card.name}}" and "To {{account.name}} ••{{n}}"; `alert` info "The money usually arrives straight away. Your card's bank may charge its own fee for this, we don't."; `consent` bind `add.consent`, termsVersion `deposits-card-v1`, text "I authorise BankWorkx to take {{amount}} from my card ending {{last4}}." mustBeTrue "Tick the box to continue."; button "Continue to confirm" (`validate`, `otpSend`, navigate `code`). Amounts of 5,000.00 or more require step-up first (planned threshold).

**Screen `code` (new):** standard. Button "Add ${{add.amount | money}}" calls `otpVerify`, then `addMoney`, then `success`.

**Screen `success`**: text now "${{add.amount | money}} is in {{account.name}}. New balance ${{result.newBalance | money2}}.", meta "Ref {{result.reference}}", buttons "View account" and "Done".

**Screen `failed`**: `{{ctx.error.message}}` and "Nothing was charged to your card."

#### 4. Sandbox errors (bank.deposit.create)

| Code | Exact adapter message | What the person sees | Screen | Button |
|---|---|---|---|---|
| `NOT_SUPPORTED` | "Not available for this customer" | Standard | `failed` | Back |
| `ACCOUNT_NOT_FOUND` | "Account not found" | "We can't find that account. Choose another." | `amount` | Choose account |
| `INVALID_AMOUNT` | "Enter an amount from $1 to $50,000" | "Enter an amount from $1 to $50,000." | `amount` | Change amount |
| `CARD_NOT_FOUND` | "Choose a card to add money from" | "Choose a card to add money from." | `amount` | Choose card |
| `CARD_EXPIRED` (planned for saved cards) | | "This card has expired. Use another card." | `amount` | Choose card |
| `OTP_INVALID` | "Incorrect code" | Standard | `code` | Try again |
| `OTP_REQUIRED` (upgrade) | "OTP not verified" | Standard | `code` | Back to code |
| `STEP_UP_REQUIRED` (planned) | | Standard | `review` | Confirm |
| `TIMEOUT` (planned) | | "We didn't get an answer in time. Check Activity before you try again, so your card isn't charged twice." | `failed` | Check Activity |
| `SERVICE_UNAVAILABLE` (planned) | | Standard | `failed` | Try again |
| `PERMISSION_DENIED`, `WRONG_CONTEXT`, `SESSION_EXPIRED` (planned) | | Standard | `failed` | Back / Switch / Sign in |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `accounts` | `bank.accounts.list` | none | accounts | none | Existing |
| `cards` | `bank.cards.list` | none | record of saved cards with `name` | none | Existing |
| `addMoney` | `bank.deposit.create` | `{toAccountId, fromCardId, amount}` | `{reference, newBalance}` | `NOT_SUPPORTED`, `ACCOUNT_NOT_FOUND`, `INVALID_AMOUNT`, `CARD_NOT_FOUND` (+ `OTP_REQUIRED`) | Existing |
| `otpSend`, `otpVerify` | existing | | | `OTP_INVALID` | Existing |

Behaviour today: balance rounded to cents; adds an "Added money" income transaction; reference `ADD-20261102-…`. It does not check the OTP or the daily limit. `moneyMoving: true`, `requiresOtp`: no today, yes in the upgrade. Money comes **in**, so the daily outgoing limit is unaffected; the planned rule is a separate card-funding cap of 50,000.00 per transaction (already enforced).

#### 6. Permissions, step-up and limits

`payments.create`. Step-up `otp`; `stepup` from 5,000.00 (planned). Limit: 1.00 to 50,000.00 per transaction.

#### 7. Result and links out

Result `success`; receipt: amount, card, account, new balance, reference, date. Notification: "$X was added to your {{account}}". Links out: Accounts › detail, Payments › tracker.

#### 8. Acceptance criteria

- AC-1: Money from $1 to $50,000 is added to the chosen account from a saved card, and the balance and the transaction list update.
- AC-2: The amount shown at review equals the amount credited; the fee is $0.
- AC-3: A card is required; with no saved card the person is offered to add one.
- AC-4: Adding money needs consent and a verified one-time code.
- AC-5: Amounts outside $1 to $50,000 are refused with a clear message and no change.
- AC-6: Three wrong codes add nothing.
- AC-7: A timeout tells the person to check Activity before trying again; an unavailable service adds nothing.
- AC-8: Each error shows its own message, not one general failure.

#### 9. Scenarios

| # | Covers | Persona and setup | Outcome |
|---|---|---|---|
| T-1 | AC-1, AC-2, AC-4 | `alex`; $100 into Main from `c_5832`, code `482100` | Main 8,720.76 → 8,820.76; "Added money" +100 transaction; reference `ADD-…` |
| T-2 | AC-5 | `alex` | $0.50 and $60,000: `INVALID_AMOUNT`; balance unchanged |
| T-3 | AC-3 | `sam` | No saved card: empty state with "Add a card" |
| T-4 | AC-3 | `alex`; card id `c_0000` | `CARD_NOT_FOUND` |
| T-5 | AC-4 | `alex` | No consent: message; no code: `OTP_REQUIRED` |
| T-6 | AC-6 | `alex` | Wrong code x3: `locked`; balance unchanged |
| T-7 | AC-7 | conditions `timeout: ["bank.deposit.create"]` | Check Activity text; balance unchanged |
| T-8 | AC-7 | conditions `unavailable: ["bank.deposit.create"]` | `SERVICE_UNAVAILABLE`; unchanged |
| T-9 | AC-8 | `alex`; account id `acc_none` | `ACCOUNT_NOT_FOUND` message |

#### 10. Expected mutation-check survivors

- Journey `min`/`max` on the amount: survive; `bank.deposit.create` returns `INVALID_AMOUNT` (another layer).
- The two-decimal rounding of the new balance: **survives** (all scenario amounts are whole dollars; add a $10.005 case to kill it).
- The step-up threshold of 5,000: killed only with a scenario at or above it; list as a survivor until added.

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

#### 1. Summary

| Item | Detail |
|---|---|
| Slug | `update-profile` |
| Purpose | Change phone, email or home address, safely: re-confirm identity, then prove the new contact is the person's. |
| Release | 1 |
| Workspace | Personal (`workspace: "personal"`, planned field) |
| Status | New |
| Channels | Web and mobile |
| Starting pattern | Step-up, choose, enter, verify new contact, review, consent, result |
| Who may use it | Signed-in customer holding `profile.update` (Alex, Sam) |

#### 2. Entry points

| Place › label | Passes | Permission |
|---|---|---|
| More › profile › Change (mobile number) | `{field: "phone"}` | `profile.update` |
| More › profile › Change (email) | `{field: "email"}` | `profile.update` |
| More › profile › Change (home address) | `{field: "address"}` | `profile.update` |
| Notification N-71 "Please confirm your email" | `{field: "email"}` | `profile.update` |
| Deep link `/personal/j/update-profile?field=phone` | `{field}` (`phone`, `email`, `address`) | `profile.update` |

An unknown `field` value is ignored and the choose screen opens.

#### 3. Screens

**3.1 `confirmIdentity` — "Confirm it's you"** (blocks: `stepper` ["Confirm", "Change", "Verify", "Review"], `alert`, `textInput`, `button`)

Copy: alert (info) "For your security, confirm it's you before you change your details." Biometrics: on mobile with quick sign-in set up, the screen first offers "Use Face ID" / "Use fingerprint"; success skips the password and goes to `confirmCode`.

| Field | Block | Required | Validation | Error message |
|---|---|---|---|---|
| Password | `textInput` secure | Yes | At least 1 character | "Enter your password" |

Buttons: "Continue" → validate, `callApi stepUp` (`bank.session.stepUp`, planned), then `confirmCode`. "Cancel" → exit. States: submit button spinner; error `STEP_UP_FAILED` stays on the screen.

**3.2 `confirmCode` — "Enter your code"** (`otp`, 6 digits, keypad)

Copy: body "We sent a 6-digit code to the number ending 0142." Helper "Resend code in 30 s". Buttons: "Confirm" → `callApi otpVerify` (`bank.otp.verify`) then `whatToChange` (or the field-specific screen when `{field}` was passed). "Resend code" (after 30 s) → `bank.otp.send`. Wrong code: see errors table. Third wrong code: result "Too many wrong codes" with "Start again" → `confirmIdentity`.

**3.3 `details` — "Change your details"** (`select` chips, `textInput`, `alert`)

| Field | Block | Required | Validation | Error message |
|---|---|---|---|---|
| What do you want to change? (`profile.field`) | `select` tiles: Mobile number, Email, Home address | Yes | One of `phone`, `email`, `address`; prefilled from `{field}` | "Choose what you want to change" |
| New mobile number (`profile.phone`) shown when field = phone | `textInput` | Yes | `^\+[1-9][0-9]{7,14}$` after removing spaces and dashes; must differ from the current number | "Enter the number with its country code, like +1 415 555 0142" / "That's already your number" |
| New email (`profile.email`) when field = email | `textInput` | Yes | Contains one `@`, a dot in the domain, max 254 characters; differs from current | "Enter a valid email address" / "That's already your email" |
| Street (`profile.street`) when field = address | `textInput` | Yes | 3 to 80 characters | "Enter your street and number" |
| City (`profile.city`) | `textInput` | Yes | 2 to 50 letters | "Enter your city" |
| Postal code (`profile.postal`) | `textInput` | Yes | `^[A-Za-z0-9 -]{3,10}$` | "Enter a valid postal code" |
| Country (`profile.country`) | `select` rows | Yes | From list | "Choose your country" |

Copy: for phone, helper "We'll text a code to the new number." For email, "We'll email a code to the new address." For address, alert (info) "We don't verify addresses with a code. We may ask for proof of address later." Buttons: "Continue" → validate, then `verifyNew` (phone, email) or `review` (address). "Back" → `confirmCode`.

**3.4 `verifyNew` — "Verify your new {phone number/email}"** (`otp`)

Copy: body "We sent a 6-digit code to {masked new contact}." Helper "Resend code in 30 s". Buttons: "Verify" → `callApi otpVerify` (`bank.profile.verifyContact`, planned), then `review`. "Resend code" → `bank.profile.sendContactCode`. "Use a different {number/email}" → `details`. The code is valid for 10 minutes; expiry gives `CODE_EXPIRED`. Sandbox: code `482100` or `000000`.

**3.5 `review` — "Review your change"** (`reviewSummary`, `consent`, `button`)

Rows: "Changing" (Mobile number / Email / Home address); "From" (current value, masked: +1 415 ••• 0142, a•••@example.com, or full old address); "To" (new value; for phone/email, with chip "Verified"). Consent: text "I confirm this is my own contact detail and I understand BankWorkx® will use it to contact me" (`termsVersion: "profile-v1"`, `mustBeTrue`, message "Tick the box to continue"). Alert (warning) for phone: "Security codes will go to your new number from now on." Buttons: "Save change" → validate, `callApi updateProfile`, then `success`. "Edit" → `details`.

**3.6 `success`** (terminal, `result` success) title "Details updated", text "Your {field} has been changed. We also told you at your old {contact}.", meta "Ref {{result.reference}}". Buttons "Back to profile" (exit to Profile), "Done".

**3.7 `failed`** (terminal, `result` error) title and text come from the errors table; button "Try again" → `details` (or `confirmIdentity` for step-up errors).

#### 4. Sandbox errors

| Code | Message the person sees | Screen | Button |
|---|---|---|---|
| `STEP_UP_FAILED` (planned) | "That password isn't right. Try again." | `confirmIdentity` (inline) | "Try again" |
| `STEP_UP_REQUIRED` (planned) | "For your security, confirm it's you first." | `failed` | "Confirm" → `confirmIdentity` |
| `OTP_INVALID` | "That code isn't right. {n} tries left." After the third: "Too many wrong codes. Start again." | `confirmCode` / `verifyNew` | "Try again" / "Start again" |
| `OTP_REQUIRED` | "Confirm with your one-time code first." | `failed` | "Back to code" → `confirmCode` |
| `CODE_EXPIRED` (planned) | "That code has run out. We sent you a new one." | `verifyNew` (inline) | "Verify" |
| `CONTACT_INVALID` (planned) | "That {number/email} doesn't look right. Check it and try again." | `details` | "Edit" |
| `CONTACT_IN_USE` (planned) | "That {number/email} is already used by another customer. Use a different one, or contact us." | `details` | "Edit"; link "Send a secure message" → `new-message` `{topic: "profile"}` |
| `CONTACT_UNCHANGED` (planned) | "That's already your {number/email}." | `details` | "Edit" |
| `ADDRESS_INVALID` (planned) | "We couldn't read that address. Check the street, city and postal code." | `details` | "Edit" |
| `CHANGE_LOCKED` (planned) | "Your contact details can't be changed for 24 hours after a password reset. Nothing was changed." | `failed` | "Back to profile" |
| `PERMISSION_DENIED` | "Your role doesn't allow this." (personal: "Your profile doesn't allow this change.") | `failed` | "Back to profile" |
| `SESSION_EXPIRED` | Standard message S-`SESSION_EXPIRED` (README 1.6) | `failed` | "Sign in" |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | `failed` | "Try again" |
| `SERVICE_UNAVAILABLE` | Standard message S-`SERVICE_UNAVAILABLE` (README 1.6) | `failed` | "Try again" / "Back" |

No money moves, so the `TIMEOUT` copy is the non-money version.

#### 5. Adapters

| Integration id | Adapter | Request | Response | Error codes | Status | moneyMoving | requiresOtp |
|---|---|---|---|---|---|---|---|
| `stepUp` | `bank.session.stepUp` | `{ method: "password" \| "biometric", secret }` | `{ steppedUp: true, expiresInSec: 300 }` | `STEP_UP_FAILED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | planned | No | – |
| `otpSend` | `bank.otp.send` | `{}` | `{ sent: true }` | `SERVICE_UNAVAILABLE` | Existing | No | – |
| `otpVerify` | `bank.otp.verify` | `{ code }` | `{ verified: true }` | `OTP_INVALID` (carries `attempt`) | Existing | No | – |
| `sendContactCode` | `bank.profile.sendContactCode` | `{ channel: "sms" \| "email", value }` | `{ sent: true, masked }` | `CONTACT_INVALID`, `CONTACT_IN_USE`, `CONTACT_UNCHANGED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | planned | No | No |
| `otpVerify` (second use) | `bank.profile.verifyContact` | `{ channel, value, code }` | `{ verified: true }` | `OTP_INVALID`, `CODE_EXPIRED` | planned | No | No |
| `updateProfile` | `bank.profile.update` | `{ field, value \| address{street, city, postal, country} }` | `{ reference, field, updatedAt }` | `STEP_UP_REQUIRED`, `OTP_REQUIRED`, `CONTACT_IN_USE`, `ADDRESS_INVALID`, `CHANGE_LOCKED`, `PERMISSION_DENIED`, `SESSION_EXPIRED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | planned | No | Yes (needs verified step-up code and, for phone/email, the verified new contact) |
| `profile` | `bank.profile.get` | `{}` | profile view-model | `SERVICE_UNAVAILABLE` | planned | No | – |

The engine counts OTP failures only for an integration named exactly `otpVerify`; both code screens therefore name their verify integration `otpVerify`.

#### 6. Permissions, step-up and limits

Permission `profile.update`. Step-up level `stepup` (README 4.3): password or biometrics, then a one-time code. A step-up stays valid for 5 minutes. Limits: 3 contact changes in 24 hours per customer (`CHANGE_LOCKED`, copy "You've changed your details too many times today. Try again tomorrow. Nothing was changed."); one pending change at a time. The `authorisation` check repeats `profile.update`; the sandbox enforces both.

#### 7. Result and links out

Result "Details updated" with reference `PRF-20261102-0001`. Receipt (planned engine feature): field changed, old (masked) and new (masked) value, date and time, reference. Notifications raised: N-70 (details changed, sent to the **old** contact as well as the new), N-71 (only if the email stays unverified). Buttons: "Back to profile" → Profile shell; "Done" → where the person started.

#### 8. Acceptance criteria

- AC-1 A person must confirm their password (or biometrics) and a one-time code before any contact detail can be changed.
- AC-2 A new phone number or email is saved only after the code sent to it is entered correctly.
- AC-3 Three wrong codes (either code) stop the journey and nothing is changed.
- AC-4 A phone number without a country code, a malformed email, and an incomplete address are refused with the exact messages.
- AC-5 A contact already used by another customer is refused.
- AC-6 The person must tick consent before saving.
- AC-7 After a change the person is told at the old contact (notification N-70) and the profile shows the new value.
- AC-8 A timeout or unavailable bank leaves the details unchanged and shows the matching message.
- AC-9 No more than 3 changes in 24 hours.

#### 9. Scenarios

| # | Persona | Setup and conditions | Covers | Expected |
|---|---|---|---|---|
| T-1 | Alex | Passed `field=phone`. Password `Bwx!Demo2026`, code `482100`, new number `+1 415 555 0177`, new-number code `482100`, consent ticked | AC-1, AC-2, AC-6, AC-7 | Result "Details updated"; profile phone is `+1 415 555 0177`; N-70 raised for old and new |
| T-2 | Alex | Skip step-up: call `bank.profile.update` straight away | AC-1 | `STEP_UP_REQUIRED` |
| T-3 | Alex | Correct password, then three wrong codes `111111` | AC-3 | Third failure: "Too many wrong codes. Start again."; profile unchanged |
| T-4 | Alex | New number `4155550177` (no `+`); email `alex@`; address missing city | AC-4 | Each shows its exact message; no call to the bank |
| T-5 | Alex | New email equals another seed customer's (`sam.rivera@example.com`) | AC-5 | `CONTACT_IN_USE` message; no code sent |
| T-6 | Alex | At `review`, consent not ticked | AC-6 | "Tick the box to continue"; no `bank.profile.update` call |
| T-7 | Alex | New-number code wrong then right (`482100`) | AC-2 | First: "That code isn't right. 2 tries left."; second succeeds |
| T-8 | Alex | `conditions.timeout: ["bank.profile.update"]` | AC-8 | "This is taking longer than expected. Nothing was changed."; profile unchanged |
| T-9 | Alex | `conditions.unavailable: ["bank.profile.update"]` | AC-8 | S-`SERVICE_UNAVAILABLE`; profile unchanged |
| T-10 | Alex | Four changes in one session | AC-9 | Fourth refused with `CHANGE_LOCKED` copy |
| T-11 | Sam | Open `?field=email` | AC-1, AC-7 | Works for a new customer with no prior email ("Not set" → set) |

#### 10. Expected mutation-check survivors

- Removing the `maxLength` of 254 on email: survives, because the sandbox does not enforce length and no scenario sends 255 characters.
- Weakening the "Resend after 30 s" timer: survives, because scenarios do not advance time on the screen.
- Removing the old-contact copy of N-70: killed by T-1 only if `expectBank` checks the notification list; otherwise survives (listed until the check is added).

---

### ★ New message — `new-message`

#### 1. Summary

| Item | Detail |
|---|---|
| Slug | `new-message` |
| Purpose | Write a private message to the bank about a topic or an account, with an attachment if needed. |
| Release | 1 |
| Workspace | Personal |
| Status | New |
| Channels | Web and mobile |
| Starting pattern | Form, review, result |
| Who may use it | Signed-in customer with `messages.send` |

#### 2. Entry points

| Place › label | Passes | Permission |
|---|---|---|
| More › messages › New message | `{topic, accountId}` (both optional) | `messages.send` |
| Messages thread (closed) › Start a new message | `{topic, accountId}` | `messages.send` |
| Help › Send a secure message | – | `messages.send` |
| Update-profile error `CONTACT_IN_USE` link | `{topic: "profile"}` | `messages.send` |
| Accounts › account detail › Ask about this account (planned) | `{topic: "account", accountId}` | `messages.send` |
| Deep link `/personal/j/new-message?topic=cards&accountId=acc_main` | as passed | `messages.send` |

#### 3. Screens

**3.1 `compose` — "New message"** (`stepper` ["Write", "Review"], `select`, `accountPicker`, `textInput`, `fileUpload` (planned), `alert`, `button`)

Copy: alert (info) "Don't put your password, PIN or full card number in a message. We will never ask for them."

| Field | Block | Required | Validation | Error message |
|---|---|---|---|---|
| Topic (`msg.topic`) | `select` rows: Accounts, Cards, Payments, Loans and deposits, Profile and security, Something else | Yes | One choice; prefilled from `{topic}` | "Choose a topic" |
| About an account (`msg.accountId`) | `accountPicker` (`source: ctx.accounts`, `showBalance: false`) with option "Not about an account" | No (Yes if topic = Accounts) | Must be one of the person's accounts | "Choose the account this is about" |
| Subject (`msg.subject`) | `textInput` | Yes | 3 to 80 characters | "Add a short subject (3 to 80 characters)" |
| Message (`msg.body`) | `textInput` lines: 6 | Yes | 10 to 1,000 characters; counter "{n} / 1,000" | "Write at least 10 characters" / "Messages can be up to 1,000 characters" |
| Attachment (`msg.files`) | `fileUpload` (planned): PDF, JPG, PNG; up to 3 files; 5 MB each | No | Type and size | "This file type isn't allowed. Use PDF, JPG or PNG." / "That file is too big. The limit is 5 MB." / "You can attach up to 3 files." / "We found a problem with this file. Choose another." |

Helper under Attachment: "For example a letter or a photo of a receipt." Content scan: a file named `virus-test.pdf` fails with `FILE_REJECTED` in the sandbox.
Buttons: "Continue" → validate, then `review`. "Cancel" → exit (asks "Discard this message?" if any field is filled: buttons "Discard", "Keep writing").
States: file rows show a progress bar while uploading, then a tick; upload failure shows the row in red with "Try again" / "Remove".

**3.2 `review` — "Check your message"** (`reviewSummary`, `consent`, `button`)

Rows: Topic; About ("Main ••4410" or "No account"); Subject; Message (first 3 lines, "Show all"); Attachments (names and sizes). Consent: "I confirm this message has no passwords, PINs or full card numbers" (`termsVersion: "messages-v1"`, `mustBeTrue`, "Tick the box to continue"). Buttons: "Send message" → validate, `callApi sendMessage`, then `success`. "Edit" → `compose`.

**3.3 `success`** (terminal) title "Message sent", text "We'll reply within 1 working day. You'll get a notification.", meta "Ref {{result.reference}}". Buttons "View conversation" → Thread shell; "Done".

**3.4 `failed`** (terminal) title "We couldn't send your message", text per errors table, button "Try again" → `review`. The draft is kept in the journey data.

#### 4. Sandbox errors

| Code | Message the person sees | Screen | Button |
|---|---|---|---|
| `ACCOUNT_NOT_FOUND` | "We can't find that account. Choose another." | `compose` | "Choose account" |
| `TOPIC_INVALID` (planned) | "Choose a topic." | `compose` | "Edit" |
| `MESSAGE_TOO_LONG` (planned) | "Messages can be up to 1,000 characters." | `compose` | "Edit" |
| `FILE_TYPE` (planned) | "This file type isn't allowed. Use PDF, JPG or PNG." | `compose` | "Remove file" |
| `FILE_TOO_LARGE` (planned) | "That file is too big. The limit is 5 MB." | `compose` | "Remove file" |
| `FILE_REJECTED` (planned) | "We found a problem with this file. Choose another." | `compose` | "Remove file" |
| `TOO_MANY_MESSAGES` (planned) | "You've sent a lot of messages today. Please wait until tomorrow, or call us on +1 800 555 0100. Nothing was lost." | `failed` | "Back" |
| `PERMISSION_DENIED` | "Your profile doesn't allow this." | `failed` | "Back" |
| `SESSION_EXPIRED` | S-`SESSION_EXPIRED` | `failed` | "Sign in" |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed. Check Messages before you send again, so we don't get it twice." | `failed` | "Check messages" / "Try again" |
| `SERVICE_UNAVAILABLE` | S-`SERVICE_UNAVAILABLE` | `failed` | "Try again" / "Back" |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Error codes | Status | moneyMoving | requiresOtp |
|---|---|---|---|---|---|---|---|
| `accounts` | `bank.accounts.list` | `{}` | accounts | – | Existing | No | No |
| `upload` | `bank.files.upload` | `{ name, type, size, content }` (content is base64) | `{ fileId, name, size }` | `FILE_TYPE`, `FILE_TOO_LARGE`, `FILE_REJECTED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | planned (called by `fileUpload`) | No | No |
| `sendMessage` | `bank.messages.send` | `{ topic, accountId?, subject, body, fileIds[] }` | `{ threadId, reference, createdAt }` | `ACCOUNT_NOT_FOUND`, `TOPIC_INVALID`, `MESSAGE_TOO_LONG`, `TOO_MANY_MESSAGES`, `PERMISSION_DENIED`, `SESSION_EXPIRED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | planned | No | No |

#### 6. Permissions, step-up and limits

`messages.send`; step-up `none`. Limits: 10 messages per day, 3 files per message, 5 MB per file, 1,000 characters. Files are removed from the draft if the person cancels.

#### 7. Result and links out

Result "Message sent", reference `MSG-20261102-0007`. Receipt: none (a message is not a transaction); the thread is the record. Notifications: N-30 (message sent, in-app only) and N-31 (the bank's reply, 2 seconds later in the sandbox). Buttons: "View conversation" → thread; "Done" → origin.

#### 8. Acceptance criteria

- AC-1 A message needs a topic, a subject of 3 to 80 characters and a body of 10 to 1,000 characters.
- AC-2 A message about accounts must name one of the person's accounts.
- AC-3 Only PDF, JPG and PNG files up to 5 MB, three per message, can be attached.
- AC-4 The person must tick that the message holds no passwords, PINs or card numbers.
- AC-5 A sent message appears as a thread with a reference and the bank's reply notification.
- AC-6 A timeout or an unavailable bank sends nothing and keeps the draft.
- AC-7 More than 10 messages in a day is refused.

#### 9. Scenarios

| # | Persona | Setup | Covers | Expected |
|---|---|---|---|---|
| T-1 | Alex | Topic Cards, account Main, subject "Card on holiday", body 40 characters, no file | AC-1, AC-4, AC-5 | Result with reference; thread exists; N-31 after reply |
| T-2 | Alex | Subject "Hi"; body "short" | AC-1 | Both messages shown; no send |
| T-3 | Alex | Topic Accounts, no account | AC-2 | "Choose the account this is about" |
| T-4 | Alex | Attach `notes.docx`; attach 6 MB PDF; attach 4 files | AC-3 | Each shows its message |
| T-5 | Alex | Attach `receipt.pdf` (200 KB) | AC-3, AC-5 | Message sent with the attachment listed |
| T-6 | Alex | Consent not ticked | AC-4 | "Tick the box to continue" |
| T-7 | Alex | `conditions.timeout: ["bank.messages.send"]` | AC-6 | Timeout copy; Messages still shows no new thread; draft kept |
| T-8 | Alex | `conditions.unavailable: ["bank.messages.send"]` | AC-6 | S-`SERVICE_UNAVAILABLE`; draft kept |
| T-9 | Alex | Send 11 messages | AC-7 | Eleventh gives `TOO_MANY_MESSAGES` copy |
| T-10 | Alex | Attach `virus-test.pdf` | AC-3 | `FILE_REJECTED` copy; not sent |
| T-11 | Sam | Topic Something else, no account | AC-1, AC-5 | Works for a new customer with no accounts |

#### 10. Expected mutation-check survivors

- Removing the 1,000-character upper bound on the body: killed by a scenario that sends 1,001 characters (add it to T-2).
- Changing the sandbox's 2-second reply delay: survives, because scenarios do not wait on real time.
- Weakening the file-content scan beyond the `virus-test` name: survives; the sandbox only knows that one name.

---

### ★ Service request — `service-request`

#### 1. Summary

| Item | Detail |
|---|---|
| Slug | `service-request` |
| Purpose | Ask the bank to do something (a request) or tell it something went wrong (a complaint), and see when it will be answered. |
| Release | 1 |
| Workspace | Personal |
| Status | New |
| Channels | Web and mobile |
| Starting pattern | Choose type, details, attachment, review, result with tracking |
| Who may use it | Signed-in customer with `messages.send` |

#### 2. Entry points

| Place › label | Passes | Permission |
|---|---|---|
| More › requests › New request | `{type: "request"}` | `messages.send` |
| More › requests › Complaint | `{type: "complaint"}` | `messages.send` |
| Profile › Request a change (name) | `{type: "name-change"}` | `messages.send` |
| Cards › card › "Report a problem" fallback | `{type: "complaint", cardId}` (planned) | `messages.send` |
| Deep link `/personal/j/service-request?type=complaint` | `{type}` | `messages.send` |

#### 3. Screens

**3.1 `type` — "What do you need?"** (`stepper` ["Type", "Details", "Review"], `select` tiles, `text`, `button`)

| Field | Block | Required | Validation | Error message |
|---|---|---|---|---|
| Kind (`req.kind`) | `select` tiles: "Make a request" (icon `wrench`, text "Ask us to change or send something"), "Make a complaint" (icon `alert`, text "Tell us what went wrong") | Yes | One of `request`, `complaint`; prefilled from `{type}` | "Choose request or complaint" |

Copy under tiles: "Requests: answered within 3 working days. Complaints: first answer within 5 working days." Button "Continue" → validate, `details`.

**3.2 `details` — "Tell us more"** (`select`, `accountPicker`, `textInput`, `fileUpload` (planned), `button`)

| Field | Block | Required | Validation | Error message |
|---|---|---|---|---|
| Category (`req.category`) | `select` rows. Request: Order a statement copy, Change my name, Close an account, Increase a card limit permanently, Other request. Complaint: Fees or charges, A payment or transfer, A card, Service or staff, App or website | Yes | One from the list matching the kind | "Choose a category" |
| About an account (`req.accountId`) | `accountPicker` + "Not about an account" | Required for complaints about a payment, card or fees | One of the person's accounts | "Choose the account this is about" |
| What happened? (`req.details`) | `textInput` lines: 6 | Yes | 20 to 2,000 characters, counter | "Please give us at least 20 characters" / "Details can be up to 2,000 characters" |
| When did it happen? (`req.when`) | `datePicker` (planned; today a `textInput` with pattern `^\d{2}/\d{2}/\d{4}$`) | Complaint only | Not in the future; not more than 13 months ago | "The date can't be in the future" / "We can only look into things from the last 13 months" |
| How should we contact you? (`req.contact`) | `select` chips: Secure message, Phone, Email | Yes | One value; default Secure message | "Choose how we should reach you" |
| Attachment (`req.files`) | `fileUpload` (planned): PDF, JPG, PNG; up to 5 files; 5 MB each | No (helper: "Add anything that helps, like a receipt or screenshot") | Type and size | Same file messages as `new-message`, with "You can attach up to 5 files." |

Buttons: "Continue" → validate, `review`. "Back" → `type`.

**3.3 `review` — "Check your {request/complaint}"** (`reviewSummary`, `alert`, `consent`)

Rows: Type; Category; About; What happened (first 3 lines); When (complaint); Contact by; Attachments; "We'll answer by" (computed `dueAt`, e.g. "05 Nov 2026" for a request raised Mon 02 Nov 2026, 3 working days). Alert (info): "You'll get a reference number and can follow progress under More › Requests and complaints." Consent: "I confirm the information is true as far as I know" (`termsVersion: "requests-v1"`, `mustBeTrue`, "Tick the box to continue"). Buttons: "Send {request/complaint}" → validate, `callApi createRequest`, `success`. "Edit" → `details`.

**3.4 `success`** (terminal) title "We have your {request/complaint}", text "Your reference is {{result.reference}}. We'll answer by {{result.dueAt | date}}.", meta "Ref {{result.reference}}". Buttons "Track it" → Request detail; "Done".

**3.5 `failed`** (terminal) title "We couldn't send this", text from errors table, button "Try again" → `review`.

#### 4. Sandbox errors

| Code | Message the person sees | Screen | Button |
|---|---|---|---|
| `ACCOUNT_NOT_FOUND` | "We can't find that account. Choose another." | `details` | "Choose account" |
| `CATEGORY_INVALID` (planned) | "Choose a category that matches your {request/complaint}." | `details` | "Edit" |
| `DATE_INVALID` (planned) | "We can only look into things from the last 13 months, and not in the future." | `details` | "Edit" |
| `FILE_TYPE` / `FILE_TOO_LARGE` / `FILE_REJECTED` (planned) | As `new-message` | `details` | "Remove file" |
| `DUPLICATE_REQUEST` (planned) | "You already have an open {category} request ({reference}). We'll answer it by {dueAt}." | `failed` | "Track it" |
| `TOO_MANY_REQUESTS` (planned) | "You've raised 5 requests today. Please try again tomorrow, or call us on +1 800 555 0100." | `failed` | "Back" |
| `PERMISSION_DENIED` | "Your profile doesn't allow this." | `failed` | "Back" |
| `SESSION_EXPIRED` | S-`SESSION_EXPIRED` | `failed` | "Sign in" |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed. Check Requests before you send again." | `failed` | "Check requests" / "Try again" |
| `SERVICE_UNAVAILABLE` | S-`SERVICE_UNAVAILABLE` | `failed` | "Try again" / "Back" |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Error codes | Status | moneyMoving | requiresOtp |
|---|---|---|---|---|---|---|---|
| `accounts` | `bank.accounts.list` | `{}` | accounts | – | Existing | No | No |
| `upload` | `bank.files.upload` | as `new-message` | `{ fileId, name, size }` | `FILE_TYPE`, `FILE_TOO_LARGE`, `FILE_REJECTED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | planned | No | No |
| `createRequest` | `bank.requests.create` | `{ kind, category, accountId?, details, when?, contact, fileIds[] }` | `{ requestId, reference, status: "received", dueAt, slaDays }` | `ACCOUNT_NOT_FOUND`, `CATEGORY_INVALID`, `DATE_INVALID`, `DUPLICATE_REQUEST`, `TOO_MANY_REQUESTS`, `PERMISSION_DENIED`, `SESSION_EXPIRED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | planned | No | No |
| `requests` | `bank.requests.list` / `bank.requests.get` | `{ status? }` / `{ requestId }` | request / detail with timeline | `REQUEST_NOT_FOUND` | planned | No | No |

SLA rule in the sandbox: request 3 working days, complaint 5 working days, counted over weekdays; 9 Nov 2026 is closed (README 1.7). The sandbox advances status Received → In progress after 5 seconds, and Resolved on demand from the dev panel.

#### 6. Permissions, step-up and limits

`messages.send`; step-up `none`. Limits: 5 requests per day, 5 files per request, 2,000 characters.

#### 7. Result and links out

Result "We have your request" / "We have your complaint", reference `SR-20261102-0003`, due date. Receipt (planned engine feature): reference, type, category, date raised, due date. Notifications: N-32 (received), N-33 (status changed), N-34 (waiting for you), N-35 (resolved). Buttons: "Track it" → Request detail; "Done" → origin.

#### 8. Acceptance criteria

- AC-1 The person chooses request or complaint, and a category that matches it.
- AC-2 Details need 20 to 2,000 characters.
- AC-3 A complaint needs a date within the last 13 months, not in the future.
- AC-4 Files must be PDF, JPG or PNG, up to 5 MB, five per request.
- AC-5 A sent request gets a reference and a due date of 3 working days (request) or 5 (complaint).
- AC-6 The same open category cannot be raised twice.
- AC-7 A timeout or an unavailable bank creates nothing and keeps the draft.
- AC-8 The request appears in the tracker with its timeline.

#### 9. Scenarios

| # | Persona | Setup | Covers | Expected |
|---|---|---|---|---|
| T-1 | Alex | Request, "Order a statement copy", 30-character details, contact Secure message, consent | AC-1, AC-2, AC-5, AC-8 | Reference `SR-…`; due date 3 working days later; tracker shows it as Received |
| T-2 | Alex | Complaint, "Fees or charges", Main account, date 5 Nov 2026 (future) | AC-3 | "The date can't be in the future" |
| T-3 | Alex | Complaint date 02 Jan 2025 | AC-3 | "We can only look into things from the last 13 months" |
| T-4 | Alex | Details "too short" | AC-2 | "Please give us at least 20 characters" |
| T-5 | Alex | Complaint, "A card", attach `statement.pdf` | AC-4, AC-5 | Sent with attachment; due 5 working days |
| T-6 | Alex | Attach `x.exe`; attach 6 files | AC-4 | File messages shown |
| T-7 | Alex | Raise "Close an account" twice | AC-6 | Second gives `DUPLICATE_REQUEST` copy with the first reference |
| T-8 | Alex | `conditions.timeout: ["bank.requests.create"]` | AC-7 | Timeout copy; tracker unchanged |
| T-9 | Alex | `conditions.unavailable: ["bank.requests.create"]` | AC-7 | S-`SERVICE_UNAVAILABLE`; draft kept |
| T-10 | Alex | Raise request on Thu 5 Nov 2026 | AC-5 | Due Wed 11 Nov 2026: working days are Fri 6, Tue 10, Wed 11 (Mon 9 Nov is closed) |
| T-11 | Sam | Complaint, "App or website", no account | AC-1, AC-5 | Works with no accounts |

#### 10. Expected mutation-check survivors

- Changing the 5-file limit to 6: killed only if T-6 sends exactly 6 (it does).
- Skipping the weekend rule in the due-date calculation: killed by T-10.
- The 5-second status change: survives (no scenario waits).

---

### ★ Connect account — `connect-account`

#### 1. Summary

| Item | Detail |
|---|---|
| Slug | `connect-account` |
| Purpose | Link an outside bank account or credit card so BankWorkx® can show its balance and transactions (read only). |
| Release | 1 |
| Workspace | Personal |
| Status | Existing, upgraded. Fixture `packages/journey-schema/src/fixtures/bankworkx.ts` (`connectAccount`, id `jrn_connect_account`). |
| Channels | Mobile today (`channels: ["mobile"]`); the upgrade adds web |
| Starting pattern | Choose type, choose bank, sign in to the bank, consent, result |
| Who may use it | Signed-in customer with `accounts.manage` (Alex; Sam has no `finance`, so `NOT_SUPPORTED`) |

**What exists today.** Screens `type`, `bank`, `login`, `success`, `failed`. Data model `conn.accountType`, `conn.bankId`, `conn.username`, `conn.password`, `conn.consent`. Integrations `banks` (`bank.banks.list`) and `connectBank` (`bank.accounts.connect`). The failed screen is a single message for every error. The sandbox bank list is Northwind Bank, Harbor Trust, Apex Credit Union, Summit Federal.
**The upgrade.** Per-code error messages (today there is one message for all errors); a review screen with a stronger consent that names what is read and for how long; the Summit Federal already-connected check shown before the login screen; web channel; a re-confirm of the password screen; refresh and remove from the Linked banks shell; timeout and unavailable states; a result with a receipt and notification. Money does not move, so no one-time code is added, but the journey asks the person to confirm their BankWorkx® password when a *new* bank is being connected on a device that is not trusted (step-up `stepup` only on untrusted devices).

#### 2. Entry points

| Place › label | Passes | Permission |
|---|---|---|
| More › settings › linked banks › Connect an account | – | `accounts.manage` |
| Linked banks (empty state) › Connect an account | – | `accounts.manage` |
| Home dashboard › "See all your money" card (planned) | – | `accounts.manage` |
| Deep link `/personal/j/connect-account` | – | `accounts.manage` |

#### 3. Screens

**3.1 `type` — "Account type"** (`stepper` ["type", "bank", "login", "review"], `select` tiles, `button`)

| Field | Block | Required | Validation | Error message |
|---|---|---|---|---|
| What do you want to connect? (`conn.accountType`) | `select` tiles: "Bank account" (icon `bank`, "Savings or current"), "Credit card" (icon `card`, "Cards and credit lines") | Yes | One of `bank`, `credit` | "Choose what you want to connect" (upgrade; today the generic required message) |

Button "Continue" → validate, `bank`.

**3.2 `bank` — "Choose your bank"** (`select` tiles, `source: ctx.banks`)

On enter: `callApi banks` → `ctx.banks`. Tiles show each bank's name and colour dot.

| Field | Block | Required | Validation | Error message |
|---|---|---|---|---|
| Your bank (`conn.bankId`) | `select` tiles | Yes | Must be an id returned by `bank.banks.list` | "Choose your bank" |

Upgrade: banks already connected show a tile badge "Connected" and are disabled with the hint "Already connected. Manage it under Linked banks." Buttons: "Continue" → validate, `login`. "Back" → `type`. States: loading skeleton tiles; empty "No banks are available right now. Try again later." with "Try again"; error from `bank.banks.list`: "We couldn't load the list of banks. Nothing was changed." with "Try again".

**3.3 `login` — "Sign in to your bank"** (`alert`, `textInput` x2, `consent`, `button`)

Copy: alert (info) "Your details are encrypted and sent securely. BankWorkx only gets read-only access." (existing text, kept).

| Field | Block | Required | Validation | Error message |
|---|---|---|---|---|
| Username (`conn.username`) | `textInput`, placeholder "Your online banking username" | Yes | At least 1 non-space character | "Enter your username" |
| Password (`conn.password`) | `textInput` secure, placeholder "At least 6 characters" | Yes | At least 6 characters | "Your password needs at least 6 characters" |
| Consent (`conn.consent`) | `consent`, `termsVersion: "connect-v1"`, text "I allow BankWorkx to read my balance and transactions" | Yes | `mustBeTrue` | "Tick the box to continue" |

Upgrade copy under consent (helper): "You can remove this link any time under More › Settings › Linked banks. We never move money from {bank}." Buttons: "Connect account" → validate, `callApi connectBank` (input `bankId`, `username`, `password`, `accountType`), then `success`; on error `navigate: "failed"` (today). The upgrade stays on `login` for `BANK_AUTH_FAILED` and shows the message under the password field; the password field is cleared. "Back" → `bank`.

**3.4 `success`** (terminal, today) result success title "Account connected", text "{{ctx.connected.bank}} {{ctx.connected.maskedNumber}} is now linked to BankWorkx.", meta "Balance ${{ctx.connected.balance | money}}". Button "Done" (exit). Upgrade: second button "See linked banks" → Linked banks shell; the Home dashboard refreshes to include the new balance.

**3.5 `failed`** (terminal, today) result error "We couldn't connect your bank", text "Check your username and password, then try again. If it keeps failing, your bank may be unavailable." Button "Try again" → `login`. Upgrade: the title and text come from the errors table below, by code.

#### 4. Sandbox errors

| Code | Sandbox message (existing) | Message the person sees | Screen | Button |
|---|---|---|---|---|
| `BANK_NOT_FOUND` | "Choose a bank to connect" | "Choose a bank to connect. We couldn't find the one you picked." | `bank` (inline) | "Choose bank" |
| `BANK_AUTH_FAILED` (username empty, or password under 6 characters) | "Check your username and password" | "Check your username and password." | `login` (under password) | "Try again" |
| `BANK_AUTH_FAILED` (password exactly `invalid123`) | "{bank} did not accept these details" | "{bank name} did not accept these details. Check them and try again. We never saved them." | `login` | "Try again" |
| `ALREADY_CONNECTED` | "{bank} is already connected" | "{bank name} is already connected. You can manage it under Linked banks." | `failed` | "See linked banks" |
| `NOT_SUPPORTED` | "Not available for this customer" | "This isn't available for your profile." | `failed` | "Back" |
| `TIMEOUT` (planned) | – | "We didn't hear back from {bank}. Nothing was connected. Try again in a moment." | `failed` | "Try again" |
| `SERVICE_UNAVAILABLE` (planned) | – | "{bank} is not available right now. Nothing was changed. Please try again in a few minutes." | `failed` | "Try again" / "Back" |
| `PERMISSION_DENIED` (planned) | – | "Your profile doesn't allow this." | `failed` | "Back" |
| `SESSION_EXPIRED` (planned) | – | S-`SESSION_EXPIRED` | `failed` | "Sign in" |
| `STEP_UP_REQUIRED` (planned, untrusted device only) | – | "For your security, confirm it's you first." | `failed` | "Confirm" → password re-entry |

Existing behaviour to keep: `bank.accounts.connect` returns `{ connectedId, bank, kind, maskedNumber, balance }`; the linked id is `l_<bankId>`; a Savings link shows balance $4,210.25 and a Credit link $1,240.50; the masked number is `••` plus four digits worked out from the username length. The sandbox accepts any username and any password of 6 or more characters except `invalid123`.

#### 5. Adapters

| Integration id | Adapter | Request | Response | Error codes | Status | moneyMoving | requiresOtp |
|---|---|---|---|---|---|---|---|
| `banks` | `bank.banks.list` | `{}` | map of `{ id, name, color }` | `TIMEOUT`, `SERVICE_UNAVAILABLE` (planned) | Existing | No | No |
| `connectBank` | `bank.accounts.connect` | `{ bankId, username, password, accountType: "bank" \| "credit" }` | `{ connectedId, bank, kind, maskedNumber, balance }` | `NOT_SUPPORTED`, `BANK_NOT_FOUND`, `BANK_AUTH_FAILED`, `ALREADY_CONNECTED`; planned `PERMISSION_DENIED`, `STEP_UP_REQUIRED`, `SESSION_EXPIRED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | Existing | No (read only) | No |
| `linked` | `bank.accounts.linked` | `{}` | list of linked banks | `SERVICE_UNAVAILABLE` | planned | No | No |
| `disconnect` | `bank.accounts.disconnect` | `{ connectedId }` | `{ removed: true }` | `LINK_NOT_FOUND`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | planned | No | No |

The password is sent once and not stored; the journey data model clears `conn.password` after the call (upgrade).

#### 6. Permissions, step-up and limits

`accounts.manage`; step-up `none` on a trusted device, `stepup` on an untrusted one. Limit: 5 linked accounts per customer (`LINK_LIMIT`, copy "You can connect up to 5 accounts. Remove one first. Nothing was changed.", planned).

#### 7. Result and links out

Result "Account connected", with bank, masked number and balance. Receipt: bank, kind, masked number, connection date, "Read-only access". Notifications: N-50 (linked), N-51 (link needs attention, raised later by the bank when a refresh fails). Buttons: "Done" → where the person started; "See linked banks" → Linked banks shell.

#### 8. Acceptance criteria

- AC-1 The person must choose a type and a bank before signing in.
- AC-2 A username and a password of at least 6 characters are needed.
- AC-3 The password `invalid123` is rejected with the bank's refusal message and nothing is connected.
- AC-4 The consent box must be ticked.
- AC-5 A bank that is already connected cannot be connected twice.
- AC-6 A successful connection shows bank, masked number and balance, and adds the account to Linked banks.
- AC-7 A timeout or an unavailable bank connects nothing and says so.
- AC-8 The password is not kept after the call.

#### 9. Scenarios

| # | Persona | Setup | Covers | Expected |
|---|---|---|---|---|
| T-1 | Alex | Bank account, Northwind Bank, username `alex.m`, password `Pass1234`, consent | AC-1, AC-2, AC-4, AC-6 | Success "Northwind Bank ••… is now linked"; balance $4,210.25; linked count 2 |
| T-2 | Alex | Credit card, Harbor Trust, valid details | AC-6 | Balance $1,240.50 |
| T-3 | Alex | Northwind, password `invalid123` | AC-3 | "Northwind Bank did not accept these details…"; linked count unchanged |
| T-4 | Alex | Password `abc` (3 characters) | AC-2 | "Your password needs at least 6 characters"; no call |
| T-5 | Alex | Summit Federal | AC-5 | Tile disabled; if forced through the API, `ALREADY_CONNECTED` copy |
| T-6 | Alex | Consent not ticked | AC-4 | "Tick the box to continue"; no call |
| T-7 | Alex | Unknown bank id `nobank` sent to the API | AC-1 | `BANK_NOT_FOUND` copy |
| T-8 | Alex | `conditions.timeout: ["bank.accounts.connect"]` | AC-7 | Timeout copy; linked count unchanged |
| T-9 | Alex | `conditions.unavailable: ["bank.accounts.connect"]` | AC-7 | S-`SERVICE_UNAVAILABLE` copy |
| T-10 | Alex | After T-1, read journey data | AC-8 | `conn.password` is empty |
| T-11 | Sam | Any valid details | AC-1 | `NOT_SUPPORTED` "This isn't available for your profile." |

#### 10. Expected mutation-check survivors

- Changing the Luhn or balance constants ($4,210.25, $1,240.50): killed by T-1 and T-2 only if `expectBank` asserts the balance; otherwise survives (assert it).
- Changing the 5-account limit (planned): survives until a scenario connects a fifth account; the seed has four banks, so the sandbox cannot produce it. Listed as an expected survivor.
- Removing the password clearing: killed by T-10.

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

