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

**Catalog:** slug `open-account`, workspace `public`, category Explore and onboarding (Public: before sign-in), core no, can a bank switch it off: yes (basic entry, kept in the Lean preset). Options (all default on): **Offer the United States** (`regUS`); **Offer the United Kingdom** (`regUK`); **Offer the European Union** (`regEU`); **Offer the UAE and Middle East** (`regME`); **US: accept an ITIN or a passport instead of an SSN** (`allowItin`); **Allow joint accounts (second holder completes their own checks)** (`jointAccounts`); **Offer Shariah-compliant products (Middle East)** (`islamic`); **UAE: allow UAE Pass instead of photographing the Emirates ID** (`uaePass`); **Saudi Arabia: allow Nafath approval instead of an ID photo** (`nafath`); **Jordan: allow the Sanad digital ID** (`sanad`); **Send politically exposed persons to manual review** (`pepReview`). Research: `research/open-account.md`. Built in `design/bankworkx-r1/src/journeys/49-open-account.js`.

The prototype builds the journey in thirteen working steps plus a resume step and a tracker, across four regions (United States, United Kingdom, European Union, UAE and Middle East with Saudi Arabia and Jordan). The region chosen first decides every later field, the ID documents and the deposit-protection text. Where it differs from the earlier text of this block the prototype rule is written here.

#### 1. Summary

| Item | Value |
|---|---|
| Slug | `open-account` |
| Purpose | A new customer applies for an account: region and product, personal and contact details, phone check, address, tax self-certification, work and money, ID check (photo or digital ID), proof of address (Middle East), selfie liveness check, consent, review, and a tracker that shows the decision. |
| Release | 1 |
| Workspace | `public` |
| Status | Built in the prototype (`basic`, submit "Done"). Production adapters are the planned `onboarding` domain (section 5). |
| Channels | Web, mobile |
| Starting pattern | `add-card` and `connect-account` for forms; the CAB `enroll` journey for identify then result |
| Who may use it | Anyone not yet a customer, aged 18 or older. Persona `sam` (Sam Rivera). |
| Money moving | No. No money moves and no account number exists until the bank approves. |

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Landing › Open an account | none | none |
| Explore › Products › a product page › Open this account | `{productId}` (`acc_saver` selects Aurora Savings; any other `acc_…` selects Everyday; a non-account id such as a loan or card shows the banner "To apply for this, first open an account. You can apply once you're signed in.") | none |
| Loan and deposit calculators › Open an account | none | none |
| `track-application` › draft or "more information needed" | `{applicationId}` (planned) | none |
| Test and demo launch | `{demo: true, region: "us"\|"uk"\|"eu"\|"me", fresh?: true}` fills every step with an example applicant | none |

If a draft exists and `fresh` is not set, the journey opens on the resume step. Regions the bank has switched off are not offered.

#### 3. Screens

Steps in order. Each shows only when it applies. After resuming, the steps before the saved step are skipped. Every step has **Back**; the first steps also have **Save and finish later**.

**Step `resume`: "Welcome back"** (only with a saved draft). Card "You have a saved application", "{name} · saved {date}. For your safety we don't keep photos of your ID or face. You'll take those again." Field: radio cards **Continue where I left off** / **Start a new application** ("This deletes the saved one."), required. Continuing lands on the saved step, or the ID step if the person had gone further. Drafts keep 30 days.

**Step `region`: "Where do you live?"**, intro "This decides which details we need to ask for, by law."

| Field | Block | Required | Shown when | Rule |
|---|---|---|---|---|
| Region | radio cards: United States ("USD · FDIC insured up to $250,000"), United Kingdom ("GBP · FSCS protected up to £85,000"), European Union ("EUR · protected up to €100,000"), UAE and Middle East ("AED, SAR or JOD · Emirates ID or national ID") | Yes | always (only offered regions) | one of the offered |
| Country | select: EU: Germany, France, Ireland, Spain, Italy, Netherlands; Middle East: United Arab Emirates, Saudi Arabia, Jordan | Yes | EU or Middle East | sets the currency (EUR, AED, SAR, JOD) and the phone dial code (+49, +971, +966, +962 …) |
| I live at an address in this region | check | Yes | region chosen | ticked |

A card **What you'll need** lists by region: US "Name, date of birth, home address and a Social Security number (SSN) or ITIN, by US law (the Customer Identification Program)", "A photo ID such as a driver's licence or passport", "A selfie"; UK "Name, date of birth and home address for the last 3 years", "A passport or photocard driving licence", "A selfie. National Insurance number is optional"; EU "Name, date of birth, home address and your tax ID (for the EU tax exchange)", "A passport or national ID card", "A selfie"; Middle East "Name, date of birth, address and your Emirates ID or national ID number", "Your ID, or UAE Pass / Nafath / Sanad if you use them", "A selfie and a recent proof of address". Then "About 8 minutes. We save your progress." A button **Use an example applicant** fills every step with synthetic data (demo only).

**Step `product`: "Choose your account"**

| Field | Block | Required | Shown when | Rule |
|---|---|---|---|---|
| Account | radio cards: **Everyday Account** ("Debit card. No monthly fee. Free local transfers.", "0 / month"); **Aurora Savings** ("Interest paid monthly. Withdraw any time. Minimum opening deposit {$100 in the US, 50 elsewhere in the local symbol}.", rate US 3.10%, UK 3.40% AER, EU 2.20%, Middle East 3.00%); **Everyday Islamic Account** ("Shariah-compliant. Certified by our Shariah board. No interest.") | Yes | Islamic only in the Middle East with `islamic` on | one |
| Who is it for? | chips Just me, Me and another person (hint "The second person gets a link and completes their own ID checks.") | No (Just me) | `jointAccounts` on | none |

**Step `personal`: "About you"**, intro "Enter your name exactly as it appears on your ID."

| Field | Block | Required | Shown when | Validation | Message |
|---|---|---|---|---|---|
| Title | select Mr, Mrs, Ms, Miss, Mx, Dr | No | UK, EU | none | none |
| First name, Last name | text, up to 40, half width | Yes | always | `^[A-Za-zÀ-ÿ' .-]{1,40}$` | "Use letters only. Hyphens and apostrophes are fine." |
| Middle name | text, up to 40 | No | always | none | none |
| Day, Month, Year of birth | three selects (the year runs from 2008 down 100 years) | Yes | always | a real date; age 18 or more | "That date doesn't exist. Check the day and month." / "You must be 18 or older to open this account. (UNDER_AGE)" |
| Nationality, Country of birth | select (United States, United Kingdom, Germany, France, Ireland, Spain, Italy, Netherlands, United Arab Emirates, Saudi Arabia, Jordan, Egypt, India, Pakistan, Philippines, Lebanon, Syria, Palestine, Canada, Australia, Other) | Yes | always | hint on birth country "Needed for the US and international tax checks." | none |
| Emirates ID number | text, `784-YYYY-NNNNNNN-C`, up to 18 | Yes | United Arab Emirates | starts 784, 15 digits, passes the Luhn check, year equals the birth year | "Check your Emirates ID number. It starts with 784 and looks like 784-YYYY-NNNNNNN-C. (EID_INVALID)" / "The birth year in this Emirates ID doesn't match your date of birth. (EID_DOB_MISMATCH)" |
| National ID or Iqama number | text, 10 digits | Yes | Saudi Arabia | `^[12]\d{9}$` | "A Saudi national ID or Iqama number has 10 digits and starts with 1 (citizen) or 2 (resident). (NID_INVALID)" |
| National number | text, 10 digits | Yes | Jordan | `^\d{10}$` | "A Jordanian national number has 10 digits. (NID_INVALID)" |

**Step `contact`: "Your contact details"**, intro "We'll send a code to check your phone." Busy "Sending a code…" 700 ms.

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| Email | email, up to 80 | Yes | `^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$` | "Enter an email like name@example.com." |
| Mobile number | tel, up to 20, hint "Country code {dial} is added for you." | Yes | by country: US 10 digits (optional leading 1); UK a mobile starting 07 or 447; UAE and Saudi a mobile starting 05 / 5 / 971 / 966; Jordan 07 / 962; others 8 to 13 digits | "Enter a mobile number with {rule}. (PHONE_INVALID)" with the rule text, for example "10 digits, like 555 010 0123" or "a UK mobile, like 07700 900123" |

**Step `verify`: "Check your phone"**, busy "Checking the code…" 600 ms. Card "Code sent to ••• {last 4}", "It works for 10 minutes. Didn't get it? Send a new code" (toast "New code sent"). Field **6-digit code** (text, required, `^\d{6}$`, "Enter the 6 digits from the message."). `000000` gives "That code isn't right. Check the latest message. (VERIFY_CODE_INVALID)"; any other six digits pass in the sandbox.

**Step `address`: "Where you live"**, intro "Your home address, not a PO box or a work address."

| Field | Block | Required | Shown when | Validation | Message |
|---|---|---|---|---|---|
| Address line 1 | text, up to 60 | Yes | always | not a PO box (`P.O. Box` in any spelling) | "Use your home address. We can't accept a PO box here. (ADDRESS_PO_BOX)" |
| Address line 2 | text | No | always | none | none |
| City or town | text, half width | Yes | always | none | none |
| State | select of 50 states and DC | Yes | US | none | none |
| County | text | No | UK | none | none |
| ZIP or postcode | text, up to 10 | Yes | not the Middle East, except Saudi Arabia | US `12345` or `12345-6789`; UK like `SW1A 1AA`; Germany, France, Spain, Italy, Saudi 5 digits; Netherlands like `1012 AB`; Ireland an Eircode like `D02 X285` | "Enter {rule}. (POSTCODE_INVALID)" |
| Emirate | select (Abu Dhabi, Dubai, Sharjah, Ajman, Umm Al Quwain, Ras Al Khaimah, Fujairah) | Yes | UAE | none | none |
| Area or district | text | Yes | Middle East | none | none |
| How long have you lived here? | chips Under 1 year, 1 to 3 years, Over 3 years | No | UK | none | none |
| Previous address | textarea, up to 160, hint "UK identity checks look back 3 years." | Yes | UK and under 3 years | none | none |
| Send post to this address | check | No (on) | always | none | none |

**Step `tax`: "Tax details"**, intro "Banks must ask where you are tax resident. This is the law (FATCA and CRS), not a choice."

| Field | Block | Required | Shown when | Validation | Message |
|---|---|---|---|---|---|
| US citizen or US tax resident? | chips Yes (form W-9), No (form W-8BEN) | Yes | US | none | none |
| Taxpayer number | chips SSN; ITIN and Passport only (only with `allowItin`) | Yes | US | hint "US law (the CIP rule) needs a number to identify you. Non-US residents may use a passport number." | none |
| Social Security number | text `XXX-XX-XXXX` | Yes | US with SSN | 9 digits; area not 000, 666 or 900 and above; group not 00; serial not 0000 | "An SSN has 9 digits, like 123-45-6789. (TIN_INVALID)" / "That SSN isn't valid. Check the digits on your card. (TIN_INVALID)" |
| ITIN | text `9XX-XX-XXXX` | Yes | US with ITIN | 9 digits starting 9; middle two digits 50 to 65, 70 to 88, 90 to 92 or 94 to 99 | "An ITIN has 9 digits and starts with 9, like 9XX-70-XXXX. (TIN_INVALID)" / "That ITIN isn't valid. The middle two digits are out of range. (TIN_INVALID)" |
| Passport number | text | Yes | US with passport | `^[A-Za-z0-9]{6,12}$` | "A passport number has 6 to 12 letters and numbers." |
| National Insurance number | text, optional, hint "Optional. It helps us match you faster." | No | UK | `QQ 12 34 56 C` shape with valid prefix, final letter A to D | "A National Insurance number looks like QQ 12 34 56 C (two letters, six digits, a letter A to D). (NI_INVALID)" |
| Tax identification number | text | Yes | EU | by country: Germany 11 digits, not starting 0; France 13 digits; Ireland 7 digits and 1 or 2 letters; Spain 8 digits or X/Y/Z plus 7 digits, then a letter; Italy 16 letters and digits; Netherlands 9 digits | "That doesn't look like {rule}. (TIN_INVALID)" |
| Country where you pay tax | select | Yes | always | none | none |
| No tax ID in this country? | select: A the country doesn't issue tax IDs to residents; B I can't get one (explain below); C the country doesn't need me to give one | No | Middle East | none | none |
| Why can't you get one? | textarea, up to 120 | Yes | reason B | none | none |
| US citizen, resident or born in the US? | chips No, Yes | No (No) | not US | none | none |
| US taxpayer number | text | Yes | not US and Yes | SSN or ITIN rules | as above |
| Also pay tax in another country? | chips No, Yes | No | always | none | none |
| Second country, its tax ID, or a reason | select, text (placeholder "Leave empty if you have none"), select A/B/C | Yes (country); one of ID or reason | Yes | one of ID or reason | "For your second country, enter the tax ID or choose a reason below." |
| Confirmation | check "I confirm this tax information is correct and complete. I'll tell BankWorkx® within 30 days if it changes." | Yes | always | ticked | "This is required." |

**Step `work`: "Work and money"**, intro "Banks must understand where your money comes from."

| Field | Block | Required | Shown when | Rule |
|---|---|---|---|---|
| Employment | select Employed, Self-employed, Student, Retired, Homemaker, Not working | Yes | always | one |
| Employer or business; Job title | text, up to 60 / 50 | Yes | employed or self-employed | none |
| Yearly income before tax | select: Under {S}25,000; {S}25,000 to {S}50,000; to 100,000; to 250,000; Over {S}250,000 (S is the local symbol) | Yes | always | one |
| Main source of the money you'll deposit | select Salary, Business income, Savings, Pension, Investments, Gift or inheritance, Sale of property, Something else | Yes | always | one |
| Tell us more | textarea, up to 200, hint "A person may read this and ask for a document." | Yes | gift, property or something else | none |
| Money you expect to pay in each month | select Under {S}2,000; to 10,000; to 50,000; Over {S}50,000 | Yes | always | one |
| How did you build your wealth? | textarea, up to 200 | Yes | income over 250,000 or deposits over 50,000 | none |
| What will you use the account for? | select Everyday spending, Receiving my salary, Saving, Sending money abroad, Something else | Yes | always | one |
| Senior public position (you, family or associate)? | chips No, Yes | No (No) | always | none |
| Which position, and in which country? | textarea, up to 160, hint "This is not a refusal. It means a person reviews the application." | Yes | Yes | none |

**Step `idcheck`: "Verify your ID"**, intro "Take a clear photo of the whole document." Busy "Reading and checking your ID…" 1.3 s. Tips: "Lay it flat in good light. No glare, all four corners." and "We store the photo encrypted and delete it once the check is done, unless the law says to keep it."

| Field | Block | Required | Shown when | Validation / message |
|---|---|---|---|---|
| How do you want to prove who you are? | chips: Photograph my ID; UAE Pass (UAE, `uaePass`); Nafath (Saudi Arabia, `nafath`); Sanad ID (Jordan, `sanad`) | No | Middle East | digital choice replaces the photo fields with "Confirm in UAE Pass / Approve in Nafath / Approve in Sanad: We'll open the app. Check the number it shows matches, then approve. We receive your verified name, date of birth and ID number. You still take a selfie next." Surname "Declined" gives `ID_DIGITAL_DECLINED` |
| Document | select by region: US Driver's licence, Passport, State ID card; UK Passport, Photocard driving licence, Residence permit (eVisa); EU National ID card, Passport, Residence permit; Middle East Emirates ID / national ID card, Passport | Yes | photo path | one |
| Front of the document | file (a sample is chosen in the prototype) | Yes | photo path | not blurry, not expired: "We couldn't read the text. Retake it flat, in good light, without glare. (ID_UNREADABLE)" / "This ID expired on 14 Aug 2025. Use one that is still valid. (ID_EXPIRED)"; a failed sample shows "Retake it, or choose another photo, to continue." |
| Back of the document | file | Yes | photo path and not a passport | "We couldn't read the back. Retake it flat, in good light. (ID_UNREADABLE)" |

After a good photo the screen shows **What we read**: Name, Date of birth, Document number ("••• 4821"), Expires ("14 Aug 2031"), Source ("Photo" or "Government record"). If the name read differs from the one entered: "The name differs from what you entered. You can go back and correct it, or continue. A person will review your application."

**Step `poa`: "Proof of address"** (Middle East only), intro "A document from the last 3 months showing your name and address."

| Field | Block | Required | Validation / message |
|---|---|---|---|
| Document type | select Utility bill (UAE: DEWA, SEWA, ADDC), Tenancy contract (UAE: Ejari), Bank statement, Government letter | Yes | one |
| Upload it | file (PDF, JPG or PNG up to 10 MB) | Yes | older than 3 months: "This document is dated 12 Feb 2026. We need one from the last 3 months. (POA_TOO_OLD)"; field text "Choose a document from the last 3 months." |

A document in a different name shows "The name on this document is different. You can continue. A person will review it."

**Step `selfie`: "Quick selfie check"**, intro "This proves you are really there and that the ID is yours." Busy "Matching your face to your ID…" 1.3 s. Text "Look at the camera, then turn your head slowly left and right. It takes 3 seconds."

| Field | Block | Required | Validation / message |
|---|---|---|---|
| Consent | check "I agree BankWorkx® may scan my face to check it matches my ID. The scan is deleted within 30 days." | Yes | ticked |
| Start the check | file (live check) | Yes | too dark: "It was too dark to see your face. Move to a brighter place. (LIVENESS_LOW_LIGHT)"; spoof: "We couldn't confirm a live person. Try again without a screen or print. (LIVENESS_FAILED)"; field text "Try again, or choose another way, to continue." |
| Alternative | button **Verify at a branch or by video call instead** | – | Saves the draft and leaves: toast "Saved. Book a branch visit or a video call and we'll continue from here." |

A face that differs from the ID is allowed to continue and sends the file to manual review.

**Step `consent`: "Terms and consent"**. Card **How your money is protected** with the regional text (US FDIC up to $250,000 per depositor per ownership category; UK FSCS up to £85,000; EU national scheme up to €100,000; Saudi Arabia deposit insurance fund, SAR 200,000 at the time of writing; Jordan JDIC, JOD 50,000 at the time of writing; UAE "does not have a deposit guarantee scheme yet", with Central Bank supervision) and a regional notice (US PATRIOT Act notice; UK identity check with a credit reference agency that does not affect the score; EU GDPR rights; others tax reporting). Checks, all required: "I accept the account terms and fee table (version 2026-10)", "I have read the privacy notice", "I agree to receive documents and statements electronically", "The information I gave is true and complete". Toggles (optional, off): **Offers by email**, **Offers by text message**.

**Step `review`: "Check and send"**, button **Submit application**, busy "Sending your application…" 1.5 s. Four cards: Account (account, country, currency, holders), You (name, date of birth, nationality, email, masked mobile, masked taxpayer or ID number), Address and tax (address, tax country, US connection), Checks (ID "Photo taken" or "Verified by UAE Pass", Selfie "Passed" or "Taken (face differs, will be reviewed)", Proof of address, Source of funds). Checks on submit: email `duplicate@example.com` gives "We already have an application with these details. Track it or sign in instead. (DUPLICATE_APPLICATION)"; surname "Blocked" gives "We can't open this account online. Please contact us. (APPLICATION_NOT_ACCEPTED)" (neutral on purpose so nobody learns why). The file goes to **manual review** when the ID name differed, the selfie differed, the proof of address name differed, the source of funds is "Something else", or the person is politically exposed and `pepReview` is on.

**Step `tracker`: "Your application"**, button **Finish**. Check mark, "Application received", "Reference {APP-nnnnnn}. We'll tell you here, by email and by push notification." A timeline: Application received ("We have your details and documents."), ID check ("We check your ID, your face and the database records." about 10 minutes), Manual review (only when needed; "A person at BankWorkx® looks at your application. This is normal and not a refusal. We may ask for one more document." usually within 1 business day), Approved (a few minutes), Account ready. The prototype has **Prototype: move to the next update**. At the end: "Your account is open" with sample identifiers (US `Routing 021 000 021 · Account ••• 4417`; UK `Sort code 20-00-00 · Account ••• 3081`; EU `IBAN DE00 •••• •••• 4417`; Middle East `IBAN AE00 …`, JO or SA) and currency.

**Result**: title "Application on its way" (or "We're reviewing your application", or "Your account is ready"), text "We'll email you and send a push notification at each step." Chip: the stage. Rows: Account, Applicant, Status, Route ("Manual review needed" / "Automatic checks"), Next ("You'll be told within minutes" / "1 business day") or Account identifiers. Button **Track my application later** (toast "Find it any time under Track my application on the home screen") or, when ready, **Sign in**.

**States:** loading is the busy spinner on contact, verify, ID, selfie and review; an empty state does not apply; errors show as a banner with the code's message and the person's answers are kept ("We couldn't reach the bank. Your answers are saved."); a timeout says "This is taking longer than expected. Nothing was sent."; leaving mid-way saves a draft for 30 days without photos.

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `UNDER_AGE` | "You must be 18 or older to open this account." | `personal` | Edit |
| `VERIFY_CODE_INVALID` | "That code isn't right. Check the latest message." | `verify` | Try again |
| `ID_UNREADABLE` | "We couldn't read the ID. Retake it in good light." | `idcheck` | Retake |
| `ID_EXPIRED` | "This ID has expired. Use one that is still valid." | `idcheck` | Choose another |
| `ID_DIGITAL_DECLINED` | "The approval was declined or timed out. Try again or photograph your ID." | `idcheck` | Try again |
| `LIVENESS_LOW_LIGHT` | "It was too dark to see your face." | `selfie` | Try again |
| `LIVENESS_FAILED` | "We couldn't confirm a live person." | `selfie` | Try again |
| `POA_TOO_OLD` | "The proof of address must be from the last 3 months." | `poa` | Choose another |
| `TIN_INVALID` | "The tax ID isn't in the right format." | `tax` | Edit |
| `NI_INVALID` | "A National Insurance number looks like QQ 12 34 56 C." | `tax` | Edit |
| `EID_INVALID`, `EID_DOB_MISMATCH`, `NID_INVALID` | see `personal` | `personal` | Edit |
| `POSTCODE_INVALID` | "The postcode isn't in the right format." | `address` | Edit |
| `PHONE_INVALID` | "The mobile number isn't in the right format." | `contact` | Edit |
| `ADDRESS_PO_BOX` | "We can't accept a PO box as a home address." | `address` | Edit |
| `DUPLICATE_APPLICATION` | "We already have an application with these details. Track it or sign in instead." | `review` | Track my application / Sign in |
| `APPLICATION_NOT_ACCEPTED` | "We can't open this account online. Please contact us." | `review` | Contact us |
| `SERVICE_UNAVAILABLE` | "We couldn't reach the bank. Your answers are saved." | the step | Try again |
| `TIMEOUT` | "This is taking longer than expected. Nothing was sent." | the step | Try again |

#### 5. Adapters

All planned in the sandbox domain `onboarding` (none exists today; `bank.otp.send` and `bank.otp.verify` exist).

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `start` | `bank.onboarding.start` | `{region, country, product, holder}` | `{applicationId}` | `SERVICE_UNAVAILABLE` | (planned) |
| `savePersonal` | `bank.onboarding.savePersonal` | personal, contact, address, tax, work fields | `{saved}` | `UNDER_AGE`, `EID_INVALID`, `EID_DOB_MISMATCH`, `NID_INVALID`, `PHONE_INVALID`, `POSTCODE_INVALID`, `ADDRESS_PO_BOX`, `TIN_INVALID`, `NI_INVALID` | (planned) |
| `otpSend`, `otpVerify` | `bank.otp.send`, `bank.otp.verify` | `{phone}` / `{code}` | `{sent}` / `{verified}` | `VERIFY_CODE_INVALID` (was `OTP_INVALID`) | Existing |
| `idCheck` | `bank.onboarding.idCheck` | `{documentType, front, back?}` or `{digitalId: "uaepass"\|"nafath"\|"sanad"}` | `{read: {name, dob, number, expires}, match}` | `ID_UNREADABLE`, `ID_EXPIRED`, `ID_DIGITAL_DECLINED` | (planned) |
| `uploadProof` | `bank.onboarding.uploadDocument` | `{type, file}` | `{read, match}` | `POA_TOO_OLD` | (planned) |
| `liveness` | `bank.onboarding.liveness` | `{video, consent}` | `{live, match}` | `LIVENESS_LOW_LIGHT`, `LIVENESS_FAILED` | (planned) |
| `submit` | `bank.onboarding.submit` | `{applicationId, consents}` | `{reference, route: "auto"\|"manual", path[]}` | `DUPLICATE_APPLICATION`, `APPLICATION_NOT_ACCEPTED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned) |
| `saveDraft` | `bank.onboarding.save` / `.get` | `{applicationId}` | answers without photos | none | (planned) |
| `track` | `bank.onboarding.status` | `{reference}` | `{stage, path[], account?}` | none | (planned) |

#### 6. Permissions, step-up and limits

No permission (public). Step-up: the phone code in `verify`; the selfie liveness check is the identity proof. Limits: minimum age 18; drafts kept 30 days without photos; ID photo deleted after the check, selfie within 30 days; one application per email (`DUPLICATE_APPLICATION`). The earlier text of this block named a Student Account for ages 16 to 25 and a separate agreement-signing step; the prototype has neither (the consent checks replace the signature; youth accounts are an open question).

#### 7. Result and links out

Result as above. Receipt: reference `APP-nnnnnn` and the stage rows. Notifications raised: "Application received {reference}", "ID check complete", "Application in review" (only when manual), "Approved", "Your account is ready" (push and email). Links out: **Track my application** (`track-application`), **Sign in** (`sign-in`), Explore › Products.

#### 8. Acceptance criteria

- AC-1: Only the regions the bank offers are shown; the region and country decide the currency, dial code, address fields, ID documents, tax fields and protection text.
- AC-2: A person under 18 or with an impossible date of birth cannot continue; the exact messages show.
- AC-3: A mobile number, postcode, Emirates ID, Saudi or Jordanian ID, SSN, ITIN, National Insurance number and EU tax ID are each checked by their country's rule with the exact message.
- AC-4: A PO box is refused as a home address.
- AC-5: The verification code step accepts any six digits except `000000`.
- AC-6: A blurry or expired ID, an expired-style proof of address, a dark selfie and a spoofed selfie are each refused with their message, and the person can retake without losing other answers.
- AC-7: A name mismatch on the ID or proof of address, a face that differs from the ID, "Something else" as the source of funds, or a politically exposed person with `pepReview` on, all send the application to manual review; otherwise it goes the automatic route.
- AC-8: The review shows masked numbers only (last four digits) and a tick-box consent set; the application is not sent until all four consents are ticked.
- AC-9: Email `duplicate@example.com` gives `DUPLICATE_APPLICATION`; surname Blocked gives the neutral `APPLICATION_NOT_ACCEPTED`.
- AC-10: Leaving mid-way saves a draft without photos; the next start offers Continue or Start new, and continuing returns to the saved step (or the ID step if later).
- AC-11: The tracker shows four stages (five with manual review) and ends with the sample account identifiers for the region.
- AC-12: With `jointAccounts`, `islamic`, `allowItin`, `uaePass`, `nafath` or `sanad` off the matching choice is absent.
- AC-13: On a timeout or unavailable service nothing is sent, the answers are kept, and the person is told so.

#### 9. Scenarios

Sandbox demo values (synthetic): launch `{demo: true, region}` or tap **Use an example applicant**. US: Alex Morgan, born 14 Mar 1990, SSN `412-55-0197`, `alex.morgan@example.com`, mobile `5550100123`, `120 Example Street`, Springfield, IL `62704`, driver's licence. UK: NI `AB123456C`, mobile `07700900123`, `12 Example Road`, London `SW1A 1AA`, passport. EU: Germany, Berlin `10115`, tax ID `65929970489`, mobile `15123456789`, national ID. Middle East: United Arab Emirates, Dubai, Business Bay, mobile `0501234567`, Emirates ID `784-1990-1234567-6`, tax reason A. Verification code `482916` (any six digits except `000000`). ID samples: Clear photo, Blurry photo, Expired ID, Name doesn't match; back: Clear, Blurry; proof of address: Recent bill, Bill older than 3 months, Different name; selfie: Complete the check, Try in low light, Show a photo of a photo, Face differs from ID. Triggers: email `duplicate@example.com`; surname `Blocked` or `Declined` (digital ID). Today is Tue 3 Nov 2026.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-11 | `sam` | none | Demo `us`, submit: Application received, automatic route, tracker received, ID check, approved, account ready (Routing 021 000 021). Repeat for `uk`, `eu`, `me` and check the currency, dial code and identifiers. |
| T-2 | AC-2 | `sam` | none | Birth year 2008 with a month after today: `UNDER_AGE`; 31 February: "That date doesn't exist." |
| T-3 | AC-3, AC-4 | `sam` | none | Bad phone, ZIP `1234`, SSN `666-12-3456`, ITIN `800-12-3456`, UK NI `ZZ123456A`, German tax ID starting 0, Emirates ID with the wrong year or checksum, Saudi ID `3123456789`, "PO Box 12": each exact message. |
| T-4 | AC-5 | `sam` | none | Code `000000` gives `VERIFY_CODE_INVALID`; `123456` passes. |
| T-5 | AC-6 | `sam` | none | Blurry, expired ID; older proof of address; low-light and spoofed selfie: each message; choose a clear sample and continue with the earlier answers kept. |
| T-6 | AC-7 | `sam` | none | Name-mismatch ID, then a clean run otherwise: tracker has Manual review; the result Route says "Manual review needed". A clean run with `pepReview` on and pep Yes also goes manual; with `pepReview` off it does not. |
| T-7 | AC-8, AC-9 | `sam` | none | Review shows masked numbers. Leave one consent unticked: the button is off. `duplicate@example.com` and surname Blocked give their messages. |
| T-8 | AC-10 | `sam` | none | Fill to the address step, tap Back out / close: toast "Saved…". Start again: Welcome back; Continue returns to the address step; photos are asked again. |
| T-9 | AC-12 | `sam` | each option off in turn | Joint chips, Islamic card, ITIN and passport chips, UAE Pass, Nafath, Sanad: the matching choice disappears. |
| T-10 | AC-13 | `sam` | `timeout: ["bank.onboarding.submit"]`, `latencyMs: 10000` (prototype: Timeout on) | "This is taking longer than expected. Nothing was sent."; answers still there. |
| T-11 | AC-13 | `sam` | `unavailable: ["bank.onboarding.submit"]` (prototype: Service down on) | "We couldn't reach the bank. Your answers are saved."; Try again works after the condition is cleared. |

#### 10. Expected mutation-check survivors

Age and ID shapes are checked on the field and again by `bank.onboarding.savePersonal` (planned); removing only one layer survives T-2 and T-3; expected. `EID_DOB_MISMATCH` and the Luhn check are covered together by T-3; flipping the Luhn check alone survives if the test number has a matching birth year; T-3 uses a wrong checksum with a right year, so none expected. The 30-day draft expiry and the 30-day selfie deletion cannot be shown by the sandbox without a clock; expected survivors. The deposit-protection wording per country is only checked for US and UAE in the scenarios; expected survivors for UK, EU, Saudi and Jordan text.

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

**Catalog:** slug `sign-in`, workspace `public`, category Signing in and security, core **yes**, can a bank switch it off: **no**. Options: **Offer one-time codes by text message (being phased out; app approval is safer)** (`allowSms`, default on); **Offer Face ID / fingerprint quick sign-in** (`allowBio`, on); **Offer passkeys** (`allowPasskey`, on); **Offer a 6-digit quick PIN** (`allowQuickPin`, on); **Let people remember their username on this device** (`rememberUser`, on); **Passwords expire after 12 months (NIST advises against; some regulators expect it)** (`forceExpiry`, on); **Ask for a code when the sign-in looks unusual, even on a trusted device** (`riskStepUp`, on). Research: `research/sign-in.md`. Built in `design/bankworkx-r1/src/journeys/48-sign-in.js`.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `sign-in` |
| Purpose | Let a returning customer in with username and password, confirm a new or unusual sign-in with a one-time code, force a new password when needed, offer to trust the device, and offer quick sign-in (Face ID or fingerprint, passkey, 6-digit PIN). Also the returning mode with quick sign-in. |
| Release / workspace | 1 / `public` |
| Status | Built in the prototype (submit "Finish"). Replaces the CAB-based plan for the steps below; the CAB fixture remains the starting pattern for production. |
| Channels | Web, mobile |
| Who may use it | Anyone. |

Step order (a deliberate rule): credentials, one-time code, forced password change, trust device, quick sign-in set-up. The code comes before the password change so a stolen password alone cannot set a new password.

#### 2. Entry points

| Place | Launch point | Passes | Permission |
|---|---|---|---|
| Landing | Sign in | `{demo}` optional (fills the demo user) | none |
| Sign-out, session timeout | Sign in again | none | none |
| `unlock-account`, `forgot-username`, password reset results | Sign in | `{user}` | none |
| Mobile start with a remembered user and quick sign-in | "Welcome back, {first name}" card, button **Use PIN / passkey / Face ID** | none | none |

#### 3. Screens

**`credentials`: "Sign in"**, intro "Use your BankWorkx® username and password.", button **Continue**, busy "Checking your details…" 800 ms.

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| Username | text, up to 40, placeholder "For example alex.morgan" | Yes | `^[A-Za-z0-9._@-]{3,40}$` | "Usernames have 3 to 40 letters, numbers, dots, dashes or underscores." |
| Password | password, up to 128, paste allowed, **Show** button, "Caps Lock is on" warning | Yes | none (checked by the bank) | wrong pair: `INVALID_CREDENTIALS` |
| Quick PIN (quick mode with PIN only) | password, 6 digits | Yes | `^\d{6}$` | "Enter your 6-digit PIN." |
| Remember my username on this device | check | No | shown only with `rememberUser` | none |
| Prototype: how the bank sees this device | chips New device, Known device, Unusual location | No | known device needs no code; new device or (with `riskStepUp`) unusual location needs one | none |

Links: Forgot password? (`forgot-password`, the spec's `reset-password`), Forgot username? (`forgot-username`), Register (`register`, the spec's `register-digital-banking`). A "Demo accounts (tap to fill)" card lists the demo users. From the third wrong attempt a box reads "{n} attempt(s) left. After that, we lock sign-in to protect your account." A locked user sees "Sign-in is locked. Too many wrong attempts. This protects your money. Unlocking takes a few minutes." with **Unlock my account** (`unlock-account {user}`), **Call us instead**, and prototype links to clear the lock or reset the demo. A remembered user with quick sign-in sees "Welcome back, {first name}. Sign in with your quick PIN / passkey / Face ID on this device." and **Use PIN** (or passkey, Face ID).

**`code`: "Enter your code"** (shown for a new device, or an unusual location with `riskStepUp`; never in quick mode), intro "This looks like a new device, so we need one more check."

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| 6-digit code | text, paste allowed | Yes | `^\d{6}$`; `000000` is wrong; `999999` or older than 5 minutes is expired | "Enter the 6 digits from the message." / `OTP_INVALID` / `OTP_EXPIRED` |
| Didn't get it? Send it another way | chips Text message (only with `allowSms`), Another signed-in device | No | changing it restarts the timer | none |

Card text: "Code sent by text message: We sent a 6-digit code to ••• {last 4}." or "Approve in the BankWorkx® app: We sent a prompt to your other signed-in device. Open it and type the 6-digit code shown." plus "It works for 5 minutes and only once." Button **Resend code** is disabled for 60 seconds ("Resend code in {n} s"), at most 3 resends, then `OTP_RESEND_LIMIT`. Warning: "BankWorkx® will never call or message you to ask for this code. Don't share it with anyone." After wrong codes: "{n} attempt(s) left", from the third "After that, sign-in locks."

**`newPassword`: "Choose a new password"** (when the password is expired and `forceExpiry` is on, or it is the first sign-in with a temporary password; not in quick mode). Banner "Welcome to BankWorkx®: You signed in with a temporary password. Choose your own to continue." or "Your password has expired: It is more than 12 months old. Choose a new one to continue." Fields **New password** (up to 64, hint "Tip: a phrase of unrelated words is easy to remember and hard to guess. No symbols required.") and **Confirm new password** ("The two passwords don't match."). A live checklist: At least 12 characters; Not your username; Not a common password; Not in a known data breach; Not one you used before. Errors: "Use at least 12 characters. Three or four unrelated words work well." / "Use 64 characters or fewer." / "Don't use your username in your password. (PASSWORD_CONTAINS_USERNAME)" / "That password is too common. Try a longer phrase of unrelated words. (PASSWORD_COMMON)" / "This password has appeared in a data breach, so we can't accept it. (PASSWORD_BREACHED)" / "Choose a password you haven't used here before. (PASSWORD_REUSED)". No composition rules. Busy "Saving your new password…".

**`trust`: "Trust this device?"** (not on a known device, not in quick mode, not if already trusted), intro "This saves you a code next time." Rows: Device, Near, Now. Cards **Trust this device** ("No code for 90 days. Remove it any time in Security › Trusted devices.") or **Don't trust (public or shared)** ("We ask for a code every time you sign in here."), required. **Name this device** (up to 30, required when trusting, hint "So you can recognise it later. Up to 5 trusted devices.").

**`quick`: "Sign in faster next time"** (not when "Don't trust", not if quick sign-in already set). Cards, each only if its option is on: **Face ID or fingerprint** ("Your phone checks it's you. BankWorkx® never receives your face or fingerprint."), **Passkey** ("A secure key stored on your device. Nothing to remember or type."), **6-digit quick PIN** ("Works only on this device."), and always **Not now**. For PIN: **Choose a PIN** (6 digits, "Use exactly 6 digits.", hint "Not 111111, 123456 or part of your phone number.") and **Confirm PIN** ("The PINs don't match."). Weak: "That PIN is too easy to guess. Avoid repeats and runs like 111111 or 123456. (PIN_WEAK)" (also refuses 112233, 123123, 121212, 696969, 000111 and digits of the phone number: "Don't use digits from your phone number. (PIN_WEAK)"). Busy "Turning on quick sign-in…".

**Result**: "Signed in", "Welcome, {first name}. Taking you to your accounts.", chip "Secure session". Rows: Signed in as, How (Password and one-time code / Password on a known device / quick method), This device (Trusted for 90 days / Not trusted), Quick sign-in, Password (Changed just now / Unchanged), Session ("Ends after 5 minutes without use"), Last sign-in. Button **Go to Home**.

**States:** loading is the busy text per step; locked and expired-code states above; unavailable "We couldn't reach the bank. Nothing was changed."; timeout "This is taking longer than expected. Nothing was changed."

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `INVALID_CREDENTIALS` | "The username or password isn't right. Check them and try again." (never says which; an unknown username counts too) | `credentials` | Try again |
| `ACCOUNT_LOCKED` | "Sign-in is locked to protect your account. Unlock it to continue." | `credentials`, `code` | Unlock my account |
| `OTP_INVALID` | "That code isn't right. Check the latest message and try again." | `code` | Try again |
| `OTP_EXPIRED` | "That code has expired. Ask for a new one." | `code` | Resend code |
| `OTP_RESEND_LIMIT` | "You have asked for the maximum number of codes. Wait 15 minutes or choose another way." | `code` | Another way |
| `QUICK_PIN_INVALID` | "That PIN isn't right." | `credentials` (quick) | Use password |
| `PASSWORD_COMMON`, `PASSWORD_BREACHED`, `PASSWORD_REUSED`, `PASSWORD_CONTAINS_USERNAME` | see `newPassword` | `newPassword` | Edit |
| `PIN_WEAK` | "That PIN is too easy to guess." | `quick` | Edit |
| `DEVICE_LIMIT` (planned) | "You can trust up to 5 devices. Remove one in Security first." | `trust` | Not now |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | engine error | Try again |
| `SERVICE_UNAVAILABLE` | "We couldn't reach the bank. Nothing was changed." | engine error | Try again |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `signIn` | `cab.auth.signIn` | `{username, password}` | profile, `mode` (`first`, `expired`) | `INVALID_CREDENTIALS`, `ACCOUNT_LOCKED` | Existing (`packages/mock-bank-api/src/cab.ts`); the failure limit is 3 there, 5 in the prototype (see report) |
| `deviceOptions` | `cab.device.options` | none | quick methods | none | Existing |
| `verifyPin` | `cab.device.verifyPin` | `{pin}` | result | `QUICK_PIN_INVALID` | Existing |
| `sendCode` / `verifyCode` | `bank.session.sendCode`, `bank.session.verifyCode` | `{username, channel}` / `{code}` | `{sent}` / `{verified}` | `OTP_INVALID`, `OTP_EXPIRED`, `OTP_RESEND_LIMIT`, `ACCOUNT_LOCKED` | (planned) |
| `setPassword` | `bank.session.setPassword` | `{newPassword}` | `{changed}` | the four password codes | (planned) |
| `trustDevice` | `bank.session.trustDevice` | `{deviceName}` | `{expiresAt}` | `DEVICE_LIMIT` | (planned) |
| `enrollQuick` | `bank.session.enrollQuick` | `{method, pin?}` | `{method}` | `PIN_WEAK` | (planned) |

#### 6. Permissions, step-up and limits

None needed. Five wrong passwords or codes (one counter per username, unknown names included) lock sign-in; unlock through `unlock-account`. Code: 6 digits, once, 5 minutes, resend after 60 s, at most 3 resends. Trusted device: 90 days, up to 5. Password: 12 to 64 characters, no composition rule. Idle session: 5 minutes.

#### 7. Result and links out

Result `Signed in` (no reference). Notifications: "New sign-in on {device}" when a new device is verified; "Your password was changed"; "Sign-in locked". Links out: Home, `unlock-account`, `forgot-username`, `reset-password`, `register-digital-banking`.

#### 8. Acceptance criteria

- AC-1: A right pair on a known device signs in without a code and shows the result.
- AC-2: A wrong pair shows the neutral message, counts toward the lock, and from the third failure shows the attempts left.
- AC-3: The fifth wrong password or code locks sign-in, even for the right password afterwards, with an unlock path.
- AC-4: A new device (or an unusual location with `riskStepUp`) needs a code; `000000` is wrong, `999999` is expired, any other six digits pass in the sandbox.
- AC-5: Resend is available after 60 seconds, at most 3 times, and changing the channel restarts the timer.
- AC-6: An expired or first-sign-in password forces a new password after the code; rules are enforced with the exact messages; an expired password is not forced when `forceExpiry` is off.
- AC-7: Trusting a device skips the code for 90 days; "Don't trust" asks again and hides quick sign-in.
- AC-8: Quick sign-in methods are offered only per option; a weak or phone-digit PIN is refused; afterwards the returning card signs in with the method.
- AC-9: A wrong quick PIN is refused with `QUICK_PIN_INVALID`.
- AC-10: Unavailable or timeout shows the message and locks nothing.

#### 9. Scenarios

Sandbox demo values (prototype): `alex.morgan` / `demo-password` (new device, needs a code); `sam.rivera` / `old-password` (password expired); `new.user` / `temp-password-1` (first sign-in); `locked.user` (already locked); any other pair is wrong. Code: any 6 digits, `000000` wrong, `999999` expired. Good new password `Harbour-Maple-47-Tide`; refused: `bankworkx2026!` (common), `Password123!` (breached), `demo-password` (reused). Test launch `{demo: true}`. Today is Tue 3 Nov 2026.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1 | `alex.morgan` | device Known | Sign in: result "Password on a known device". |
| T-2 | AC-2, AC-3 | `alex.morgan` | none | Wrong password: "2 attempt(s) left" appears after the third failure ("2 left"); the fifth locks; the right password still shows the lock. |
| T-3 | AC-4, AC-5 | `alex.morgan` | New device | Code `000000`: `OTP_INVALID`; `999999`: `OTP_EXPIRED`; `482916` passes. Resend disabled for 60 s. |
| T-4 | AC-6 | `sam.rivera`, `new.user` | none | Forced password step after the code; each refused password shows its message; with `forceExpiry` off Sam skips it. |
| T-5 | AC-7, AC-8 | `alex.morgan` | none | Trust (name "Alex's iPhone"), choose PIN `111111` (PIN_WEAK) then `739104`; next visit shows the returning card; PIN `000000` gives `QUICK_PIN_INVALID`. |
| T-6 | AC-10 | `alex.morgan` | `timeout: ["cab.auth.signIn"]`, `latencyMs: 10000` | Timeout message; failure counter unchanged. |
| T-7 | AC-10 | `alex.morgan` | `unavailable: ["cab.auth.signIn"]` | Unavailable message; nothing locked. |
| T-8 | AC-3 | `locked.user` | none | Lock card with **Unlock my account** opening `unlock-account`. |

#### 10. Expected mutation-check survivors

The rule "code before password change" is order only; a mutation swapping them survives unless T-4 asserts the sequence (it does). `DEVICE_LIMIT` is not produced by the prototype and survives. The resend cap and 5-minute expiry are not asserted beyond T-3; expected survivors.

**Reconciliation with the short sign-in blocks.** The prototype changes these earlier statements: sign-in locks after **5** failures (earlier: 3, 30 minutes); the one-time code resends after **60 s** (earlier: 30 s); trusted devices last 90 days and 5 devices; password rules are 12 to 64 characters, no composition (earlier: 8 to 100, 5 different); quick PIN also refuses 112233, 123123, 121212, 696969, 000111 and phone digits. `setup-quick-login` is now a step of this journey (still reachable from Security), `change-quick-pin` and `unlock-account` apply the same PIN and lock rules, `forgot-username` is linked unchanged.

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

**Catalog:** slug `accounts`, workspace `personal`, category Accounts (Personal: Accounts), core no, can a bank switch it off: yes (a screen, also in the Lean preset as a basic entry; switching it off hides the Accounts tab content and the Home accounts card). Options: **Offer the hide-balance eye** (`hideBalance`, default on); **Show foreign currency accounts** (`showFx`, default on); **Show Statement and Transfer on each account** (`quickActions`, default on; see AC-9); **Offer sort and filter** (`sortFilter`, default on).

This block replaces the table "Shell: Accounts list" above as the specification of the screen. The earlier table stays as the production data-source note (`bank.accounts.list`, `bank.accounts.totals`). The prototype adds the hide-balance eye, grouping, sort, filter and a hidden-accounts filter. Research: `research/accounts.md`. Built in `design/bankworkx-r1/src/journeys/20-accounts.js`, which also holds the shared account model `ACC` used by `account-details` and `statement`.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `accounts` |
| Purpose | Show every account in one place: a total balance, a chip per currency, and a card per account with available balance, holds, status and quick actions. |
| Release / workspace | 1 / Personal |
| Status | Built in the prototype as a screen (`view: true`, tab `acc`). Not a ★ form journey: no submit, no money moves. Production data source partly planned (see section 5). |
| Channels | Web (list on the left, account detail on the right when one is selected) and mobile (list, then detail full screen) |
| Starting pattern | None |
| Who may use it | Anyone signed in to Personal with `accounts.view`. Sam Rivera sees the empty state. |

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Tab bar › Accounts (mobile), left rail › Accounts (web) | none | `accounts.view` |
| Home › Accounts card | none | `accounts.view` |
| `account-details` › All accounts (back) | none | `accounts.view` |
| Deep link `/personal/accounts` | optional `{accountId}` (opens the detail beside the list on web) | `accounts.view` |

#### 3. Screens

One screen with five regions. It has no typed fields; every control is a button, chip, select or checkbox.

**Region A: Total balance hero** (shown only when the list has loaded and there is at least one account). Text "Total balance". Big number: the sum of every visible account converted to USD at the sandbox rate (`ACC.usd`), for example $30,375.02 for the seed. Line under it: "Across {n} accounts · USD equivalent · Available {availableTotal}". One chip per currency: "{CODE} {sum} · {count}" (for example USD, EUR, GBP, AED, JOD). A **Hide** / **Show** button (only when option `hideBalance` is on) toggles `ACC.hide`: every amount on this screen, on the detail and on the transaction rows becomes "••••••". Hidden accounts and, when `showFx` is off, foreign accounts are left out of the total.

**Region B: Filter and sort bar.** Chips **All**, **Current**, **Savings**, **Foreign currency** (the last only when `showFx` is on). When `sortFilter` is on, a **Sort** select ("By type", "Name", "Balance, high to low", "Currency") and, only when at least one account is hidden, a checkbox **Hidden ({n})**.

| Control | Rule | Message |
|---|---|---|
| Filter chip | One of the four | none |
| Sort | One of "By type" (default), "Name", "Balance, high to low", "Currency" | none |
| Hidden checkbox | Shown only when `n` hidden accounts is above 0; shows hidden accounts, dimmed, with a "Hidden" chip | none |

**Region C: Account list.** With sort "By type" the list is in three groups with a heading "Current ({n})", "Savings ({n})", "Foreign currency ({n})". Current and Savings headings add the group total in USD. Other sorts show one flat list. Each account card shows an icon (wallet, savings, swap for foreign currency), the name (the person's nickname if set, else the product name), the product name and mask "••4410" and currency code, the **Available** balance (ledger minus holds) on the right, then chips: status (Active, Dormant, Closure requested, Frozen), "Holds {amount}" when holds exist, "Hidden", and the interest chip ("0.05% APY", "3.85% APY", "AER" for a UK account) when the rate is above 0. When `quickActions` is on the card also shows **Statement** (opens `statement {accountId}`), **Transfer** (opens `personal-transfer`) and **Details** buttons, and a "Ledger balance" line. The whole card opens `account-details {accountId}`. A button that opens a journey the bank has switched off is hidden.

**Region D: Footer.** A note: "Available balance is your ledger balance minus money held for card payments that haven't settled. Foreign currency accounts are converted to USD at today's sandbox rate for the total only." Buttons **Open another account** (opens `open-another-account`, `btn`) and **Refresh** (reloads the list with a 650 ms skeleton).

**Region E: Split detail (web only).** When `accountId` is set or an account is tapped, the list narrows to compact cards and `account-details` fills the right pane. On a phone the detail replaces the list.

**States:**
- Loading: a hero skeleton (110 px) and three card skeletons for 600 ms on first open.
- Empty (no accounts at all, Sam): heading "You don't have an account yet", text "Open one in a few minutes. You can add more later.", button **Open an account** (`open-another-account`). If `open-another-account` is off the button is replaced by a message that the bank has not switched account opening on.
- Empty (filter matches nothing): "No accounts match", "Try another filter.", button **Show all accounts**.
- Error: card with "We couldn't load your accounts", "Nothing was changed.", code `SERVICE_UNAVAILABLE`, button **Try again**. If the list already loaded and the service then goes down, a banner above the list says "Some balances may be out of date. (SERVICE_UNAVAILABLE)" and the list stays.
- Timeout: after 10 seconds without an answer the error card is shown with the text "This is taking longer than expected. Nothing was changed." (planned; the prototype has only the unavailable state).

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `SERVICE_UNAVAILABLE` | "We couldn't load your accounts. Nothing was changed." (with a list already loaded: "Some balances may be out of date.") | Region C error card, or banner | Try again |
| `TIMEOUT` (planned) | "This is taking longer than expected. Nothing was changed." | Region C error card | Try again |
| `JOURNEY_DISABLED` | "This isn't available at your bank." | Whole tab | none |
| `WRONG_CONTEXT` | Standard message (README 1.6) | Whole tab | Switch |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `accounts` | `bank.accounts.list` | none | map of accounts (`name`, `maskedNumber`, `iban`, `balance`, `currency`, `status`) | none | Existing (`packages/mock-bank-api/src/index.ts`) |
| `totals` | `bank.accounts.totals` | none | per-currency totals | none | Existing |
| `accountsOverview` | `bank.accounts.overview` | none | existing fields plus `availableBalance`, `ledgerBalance`, `holds[]`, `status` (`active`, `dormant`, `closing`, `frozen`), `type`, `region`, `interestRate`, `hidden` | `SERVICE_UNAVAILABLE`, `TIMEOUT` | (planned). The prototype computes these from its own model `ACC` |
| `setHidden` | `bank.accounts.setHidden` | `{accountId, hidden}` | `{accountId, hidden}` | `LAST_VISIBLE_ACCOUNT` | (planned). Used by `account-details` |

#### 6. Permissions, step-up and limits

`accounts.view`, step-up `none`. Hiding balances is a display choice stored per device in production (prototype: for the session). No limits.

#### 7. Result and links out

No result screen and no receipt. Notifications raised: none. Links out: `account-details {accountId}`, `statement {accountId}`, `personal-transfer`, `open-another-account`.

#### 8. Acceptance criteria

- AC-1: The hero shows the USD-equivalent total of all visible accounts, the available total, and one chip per currency with account counts.
- AC-2: Each card leads with the available balance and shows the ledger balance and a "Holds" chip only when holds exist; available equals ledger minus holds.
- AC-3: Accounts are grouped Current, Savings, Foreign currency with a count each; the three-decimal JOD account shows three decimals.
- AC-4: The Hide button masks every amount on the screen and the detail; Show brings them back.
- AC-5: Sort and filter change the list without a reload; a filter with no match shows "No accounts match" and **Show all accounts** clears it.
- AC-6: A hidden account leaves the list and the total, and returns when "Hidden" is ticked; the last visible account cannot be hidden.
- AC-7: Sam Rivera sees "You don't have an account yet" and **Open an account**.
- AC-8: When the service is unavailable the first load shows the error card with Try again, and nothing else changes; after it loaded the list stays with the out-of-date banner.
- AC-9: With `quickActions` off the Statement, Transfer and Details buttons are gone but the card still opens the detail; with `hideBalance` off there is no Hide button; with `showFx` off foreign accounts are neither listed nor in the total.
- AC-10: If `open-another-account` or `statement` is switched off in the catalog the matching button is not drawn.

#### 9. Scenarios

Sandbox demo values: persona Alex Morgan with Current ••4410 ($8,240.18 ledger, $8,102.40 available, three card holds of $98.00, $33.38 and $6.40), Savings ••7720 ($14,310.00), Euro ••3302 (€2,150.40), Dirham ••9981 (AED 5,000.00), Sterling ••3301 (£1,240.55, one hold of £12.40) and Dinar ••6120 (JOD 1,820.500, dormant). "Today" is Tue 3 Nov 2026. The prototype switch "Service down" simulates `SERVICE_UNAVAILABLE`.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-2, AC-3 | `alex` | none | Open Accounts. Hero shows the USD-equivalent total and six account cards in three groups. Current card: available $8,102.40, ledger $8,240.18, chip "Holds $137.78". Dinar card shows JOD with three decimals and a "Dormant" chip. |
| T-2 | AC-4 | `alex` | none | Press Hide: all amounts read "••••••". Press Show: they return. |
| T-3 | AC-5 | `alex` | none | Choose Savings: one card. Choose Sort "Balance, high to low": Savings first. Choose Foreign currency then clear: all six again. |
| T-4 | AC-6 | `alex` | none | On the Euro detail, Hide this account: the list has five accounts and the total drops by the Euro value. Tick "Hidden (1)": Euro returns, dimmed. Hiding down to one account is refused with `LAST_VISIBLE_ACCOUNT`. |
| T-5 | AC-7 | `sam` | `empty: ["bank.accounts.overview"]` | Empty state with **Open an account**. |
| T-6 | AC-8 | `alex` | `unavailable: ["bank.accounts.overview"]` (prototype: Service down on) | Error card with Try again; after Service down is cleared, Try again loads the list. With the list loaded first and the service then down, the banner appears. |
| T-7 | AC-8 | `alex` | `timeout: ["bank.accounts.overview"]`, `latencyMs: 10000` (planned) | After 10 seconds the error card says "This is taking longer than expected. Nothing was changed." |
| T-8 | AC-9, AC-10 | `alex` | options `quickActions`, `hideBalance`, `showFx` off one at a time; `statement` off | Each option removes only its own control; with `statement` off the card has no Statement button. |

#### 10. Expected mutation-check survivors

Removing the sandbox rule that excludes hidden accounts from the total survives T-4 if the screen also filters them (two layers); expected survivor. The 10-second timeout state (planned) has no sandbox layer in the prototype, so a mutation there cannot be checked yet. Everything else: none expected.

---

### ★ Account details — `account-details`

**Catalog:** slug `account-details`, workspace `personal`, category Accounts (Personal: Accounts), core no, can a bank switch it off: yes (a screen; also a basic entry kept in the Lean preset). Options: **Offer Share details** (`shareDetails`, default on); **Allow closure requests in the app** (`closeRequest`, default on); **Offer Report a problem on transactions** (`reportProblem`, default on); **Allow hiding an account** (`hideAccount`, default on). Note: the prototype declares these four options but does not yet read them; the Share, Close, Report and Hide controls are always drawn. The bank-side switches are therefore (planned) and are covered by AC-13.

This block replaces the table "Shell: Account detail" above, absorbs "Shell: Transaction history" and "Shell: Transaction detail" for one account, and absorbs the journey `account-nickname` (rename is a sub-screen here). Research: `research/account-details.md`. Built in `design/bankworkx-r1/src/journeys/21-account-details.js`, sharing the account model `ACC` from `20-accounts.js`.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `account-details` |
| Purpose | Everything about one account: balances and holds, region-correct payment identifiers, daily limits, linked cards, past statements, searchable transactions with receipts and "Report a problem", rename, share details, hide and close. |
| Release / workspace | 1 / Personal |
| Status | Built in the prototype as a screen with sub-screens (`view: true`, tab `acc`). Closing and reporting are requests, not instant money movement. |
| Channels | Web (details on the left, transactions on the right) and mobile (single column) |
| Starting pattern | None |
| Who may use it | Anyone signed in to Personal with `accounts.view`. Closing needs a PIN (step-up). |

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Accounts › account card (anywhere on it, or Details) | `{accountId}` | `accounts.view` |
| Home › Accounts card | `{accountId}` | `accounts.view` |
| Cards › linked account link, Transactions › See all | `{accountId}` | `accounts.view` |
| Deep link `/personal/accounts/{accountId}` | `{accountId}` (default `cur`) | `accounts.view` |

#### 3. Screens

Sub-screen state lives in the journey (`sub`): `main`, `tx`, `receipt`, `report`, `reported`, `nick`, `share`, `hide`, `export`, `close`, `closed`. Every sub-screen except `main` and `reported` has a **Back** button to the screen before it. An unknown account id shows "We can't find that account" with text "Choose another. (ACCOUNT_NOT_FOUND)" and the button **Back to accounts**.

**`main`: account screen.** Top: **All accounts** (back to `accounts`).

- Balance hero: "{name} ••{last}", big **Available balance**, then **Ledger balance** and **On hold**. Chips: status (Active, Dormant, Closure requested, Frozen), product name, currency code, "Hidden from overview" when hidden. A line: with holds, "Available is your ledger balance minus money held for card payments that haven't settled." and a link **See holds** / **Hide holds** that lists each hold (merchant, "{date} · released by {date}", amount). With no holds: "Nothing is on hold. Available and ledger balance are the same." Hide-balance (set on `accounts`) masks every amount.
- Dormant banner (status dormant): "This account is dormant", "There has been no activity for 12 months. You can still receive money. Make a deposit or a transfer to reactivate it. (ACCOUNT_DORMANT)", button **Reactivate** (sets active, toast "Account reactivated").
- Closure banner (status closing): "Closure requested", "Reference {CLS-nnnnn}. We'll close this account within 14 days. You can still cancel the request.", button **Cancel the request** (toast "Closure request cancelled").
- Action buttons: **Transfer** (opens `personal-transfer`; only when active or closing), **Statement** (opens `statement {accountId}`), **Rename** (opens sub-screen `nick`), **Share details** (opens `share`).
- Card **Account details**: one row per identifier by region, each with a **Copy** button (toast "{label} copied"):

| Region of the account | Identifiers shown (label: hint) |
|---|---|
| United States (USD) | Routing number (ABA) `021000021`: use for US transfers and direct deposit. Account number: keep this private. SWIFT/BIC `BWXAUS33`: only for international wires into this account |
| United Kingdom (GBP) | Sort code `99-00-12` (6 digits). Account number (8 digits). IBAN and BIC `BWXAGB2L` for payments from abroad |
| Euro area (EUR) | IBAN (DE, check digits computed, mod 97). BIC `BWXADEFF`: needed for some payers outside the euro area |
| UAE (AED) | IBAN, 23 characters, starts with AE. BIC `BWXAAEAA` |
| Jordan (JOD) | IBAN, 30 characters, starts with JO. BIC `BWXAJOAM` |

  Then rows Currency, Opened ("14 Mar 2019"), Interest rate (hint "Variable, shown as APY" for US, "Variable, shown as AER" for UK, "Variable, per year" otherwise; "No interest" when 0). A US account never shows an IBAN; a UK account shows both.
- Card **Limits today**: one bar per limit: "Transfers out today", "Card spending today", "ATM cash today" as "{used} of {ceiling}". Button **Change limits** opens the journey `change-limits {accountId}`, or a toast that it opens when built, if it does not exist.
- Card **Linked cards**: each card linked to the account with last four digits, status chip and monthly limit, tapping opens Cards. Empty: "No cards are linked to this account."
- Card **Statements**: the last three months ("Oct 2026 statement", "PDF · Ready") each opening `statement {accountId, month}`, and **All statements and letters** (`statement {accountId}`).
- Card **Transactions** (below on mobile, right column on web): filters in this order, all working live as the person types:

| Field | Control | Required | Validation | Message |
|---|---|---|---|---|
| Search | text, "Search by name, category, reference or amount" | No | Matches description, category, reference, or amount digits | none |
| Type | chips All, Money in, Money out | No (All) | none | none |
| Status | chips "Pending and posted", Pending, Posted | No | none | none |
| Period | select Last 7 days, Last 30 days, Last 90 days (default), Last 12 months, All, Choose dates | No | none | none |
| From, To (only for Choose dates) | date | Yes for that choice | End not before start; end not in the future; at most 24 months | "The end date is before the start date." / "Choose a date that isn't in the future. (FUTURE_DATE)" / "Choose a period of 24 months or less. (RANGE_TOO_LONG)". The list ignores an invalid range until fixed |
| Category | select, built from the categories present | No | none | none |
| Smallest, Largest amount | decimal text | No | Both numbers; smallest not above largest | "Enter the minimum as a number." / "Enter the maximum as a number." / "The minimum is higher than the maximum." |

  Result line: "{n} transactions" plus "filters on" and **Clear filters** when any filter differs from the default. Pending items come first, under "Pending · not yet in your ledger balance" (mobile); then posted ones under day headers ("Today", "Yesterday", "{date}"). On web it is a table with Date, Description, Category, Status, Amount. Ten rows show at first; **Load more ({n} left)** adds ten. A row shows an initial, the description, "{category} · {channel} · {time}" (and "· Reported" when a problem was reported), and the signed amount (+ for money in). Empty list for the account: "No activity yet", "Money you send, spend and receive will show here.", button **Add money**. No match: "No transactions match these filters", "Try a longer period or clear the filters.", button **Clear filters**. Button **Export these transactions** opens `export`.
- Card **Manage**: **Hide this account** (or **Show on overview** when hidden): "Hidden accounts stay open; they just leave your overview and total." and **Close this account** (hidden when closure is already requested): "Request closure. We confirm by message."

**`tx`: Transaction.** Initial, description, large signed amount, chip Pending or Posted (and "Reported {case}"). A pending notice: "This payment is pending. The shop hasn't finished it, so the amount can change and it can drop off. The money is held and counts against your available balance, not your ledger balance." Rows: Date and time, Account, Category, Channel, Card (debit ••4410, for card items), From or To (counterparty), Reference (for example `TX-480100`), Balance after (or "Shown once posted"). Buttons: **Receipt**; **Report a problem** (for card items and any money out); **Repeat this payment** (money-out transfers, bills and standing orders; opens `personal-transfer`). Unknown id: "We can't find that transaction" ("Choose another from the list. (TRANSACTION_NOT_FOUND)").

**`receipt`.** "BankWorkx® receipt" with chip Final or "Not final". Amount, then Type (Payment or Money received), Description, Date, Account, Channel, Reference. Footer: "This is a record of the transaction, not a tax invoice." (pending: "This receipt will be re-issued when the payment posts."). Buttons **Download PDF** (toast; planned engine receipts) and **Copy reference**.

**`report`: "Report a problem".** Shows description, amount, date. Reasons depend on the item:

| Item | Reasons (value: label) |
|---|---|
| Card or ATM | `unknown` "I don't recognise this payment"; `twice` "I was charged twice"; `amount` "The amount is wrong"; `service` "I didn't get what I paid for"; `other` "Something else" |
| Money out, not card | `wrongpayee` "I sent it to the wrong person"; `notauth` "I didn't make this transfer"; `other` "Something else" |
| Money in | `other` "Something else" |

Fields: **What went wrong?** (required, radio list; the **Send report** button stays disabled until chosen); **Tell us more** (textarea, up to 300 characters; required and at least 10 characters for "Something else", otherwise optional; hint "Please don't type your card number or PIN."); for `unknown` on a card item a check **Freeze my debit card ••4410 now so nobody can use it again**. Rules: a pending item accepts only `unknown`, `notauth` and `other`; any other reason shows "This payment is still pending. Wait until it posts, or choose "I don't recognise this payment". (PENDING_NOT_DISPUTABLE)" and keeps the button off. A payment already reported shows "Already reported", "Case {DSP-nnnnn} was opened on {date}. We'll reply within 2 working days. (DUPLICATE_REPORT)" with no form. Send with a short note: "Tell us a little more, at least 10 characters. (NOTE_TOO_SHORT)". Service down: "We couldn't reach the bank. Nothing was sent. (SERVICE_UNAVAILABLE)". Success goes to `reported`.

**`reported`.** Green tick, "Report sent", "We'll reply within 2 working days. If you don't recognise a card payment we can credit you while we look into it." Rows Case, Payment, Opened, Card ("Frozen" or "Unchanged"). Button **Back to payment**. Freeze here sets the first card frozen without a code because it only makes the card safer.

**`nick`: "Rename account".** Text "Currently called **{name}** ••4410. Only you see this name." Field **Account name** (text, up to 24 characters, placeholder "For example, Holiday fund", hint "2 to 24 characters"):

| Rule | Message |
|---|---|
| 2 to 24 characters after trimming | "Enter a name of 2 to 24 characters. (NAME_LENGTH)" |
| Only letters, numbers, spaces and `& - ' .` | "Use letters, numbers and spaces only. (NAME_CHARS)" |
| Not another of the person's accounts (any case) | "You already have an account called {name}. (NAME_TAKEN)" |

Message shows as the person types and the **Save name** button is disabled while it shows. Save: toast "Name saved" and back to `main`. If the service is down, the error sheet "We couldn't save" is shown and the name is unchanged. A second button **Use the product name** shows when a nickname exists (toast "Back to the product name"). The IBAN, mask and balance never change.

**`share`: "Share account details".** Text "Send these to someone who needs to pay you. They can pay in, but they can't take money out." A preview card: "BankWorkx® account details / Account holder: Alex Morgan / Account: {name} ({CUR}) / {each identifier line}". Buttons **Share** (system share sheet, else copies) and **Copy all** (toast "Account details copied"). Warning: "Only share these with people you trust. We will never ask you for a PIN, a password or a code in return."

**`hide`: "Hide this account?".** "{name} ••{last} stays open and keeps working. It leaves your overview and your total balance until you show it again." Button **Hide account** (toast "Account hidden", back to `accounts`); disabled with "You need at least one account on your overview. (LAST_VISIBLE_ACCOUNT)" when it is the last visible one.

**`export`.** "Export transactions", "{n} transactions from your current filters." Rows **CSV** (for spreadsheets), **OFX** (for accounting and budgeting apps), **PDF** (for printing), each with a toast in the prototype. A hint: "Need a stamped statement for a visa or loan? Use Statement." (opens `statement`). Nothing to export: "Nothing to export", "No transactions match your filters. (NO_TRANSACTIONS)".

**`close`: "Close this account".** First the blocks: with holds, a red card `ACCOUNT_HAS_HOLDS` "You can't close this account while card payments are on hold. Try again after they settle."; overdrawn, `ACCOUNT_OVERDRAWN` "This account is overdrawn. Pay in the shortfall before you close it."; each with **Back to account**. Otherwise:

| Field | Control | Required | Validation | Message |
|---|---|---|---|---|
| Why are you closing it? | select: "I don't need it any more", "I'm moving to another bank", "Fees are too high", "I have a duplicate account", "Something else" | Yes | none | button disabled |
| Tell us more | textarea, up to 200 | Yes if "Something else" | 10 characters or more | button disabled |
| Where should we send {balance}? | select: other open accounts in the same currency, or "A bank cheque posted to my address" | Yes only if the balance is above 0 | none | button disabled |
| Acknowledge 1 | check "Standing orders, direct debits and scheduled payments from this account will stop." | Yes | ticked | button disabled |
| Acknowledge 2 | check "The debit card linked to this account will be cancelled." | Yes if cards are linked | ticked | button disabled |
| Acknowledge 3 | check "Closing takes up to 14 days. The account can't be reopened; I'd need to open a new one." | Yes | ticked | button disabled |

Button **Request closure** opens the PIN sheet "Confirm closure" ("Enter your PIN to close {name} ••{last}", 6 digits; any six digits in the prototype). Service down: error sheet, nothing requested. Secondary **Keep this account**.

**`closed`.** Clock icon, "Closure requested", "We'll close the account within 14 days and message you when it's done. You can cancel until then." Chip Pending. Rows Account, Balance to send, Send to, Reference (`CLS-nnnnn`), Requested. Button **Back to account**; the account now shows the closure banner and chip.

**States:** loading is a skeleton for the transaction list (the first render is immediate in the prototype); empty and error states are as written above; the service-down banner mirrors `accounts`.

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `ACCOUNT_NOT_FOUND` | "We can't find that account. Choose another." | Whole screen | Back to accounts |
| `TRANSACTION_NOT_FOUND` | "We can't find that transaction." | `tx` | Back |
| `RANGE_TOO_LONG` | "Choose a period of 24 months or less." | Filter bar | Fix dates |
| `FUTURE_DATE` | "Choose a date that isn't in the future." | Filter bar | Fix dates |
| `NAME_LENGTH`, `NAME_CHARS` | see `nick` | `nick` | Edit |
| `NAME_TAKEN` | "You already have an account with that name." | `nick` | Edit |
| `PENDING_NOT_DISPUTABLE` | "This payment is still pending." | `report` | Choose another reason |
| `DUPLICATE_REPORT` | "You already reported this payment." | `report` | Back |
| `NOTE_TOO_SHORT` | "Tell us a little more, at least 10 characters." | `report` | Edit |
| `ACCOUNT_HAS_HOLDS` | "You can't close this account while card payments are on hold." | `close` | Back to account |
| `ACCOUNT_OVERDRAWN` | "This account is overdrawn. Pay in the shortfall first." | `close` | Back to account |
| `LAST_VISIBLE_ACCOUNT` | "You need at least one account on your overview." | `hide` | Back |
| `ACCOUNT_DORMANT` | "There has been no activity for 12 months..." | `main` banner | Reactivate |
| `NO_TRANSACTIONS` | "Nothing to export" | `export` | Back |
| `SERVICE_UNAVAILABLE` | "We couldn't reach the bank. Nothing was sent." (report), error sheet (rename, close) | the sub-screen | Try again |
| `TIMEOUT` (planned) | "This is taking longer than expected. Nothing was changed." | the sub-screen | Try again |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `accounts` | `bank.accounts.list` | none | accounts with `name`, `maskedNumber`, `iban`, `balance`, `currency` | none | Existing |
| `limits` | `bank.limits.get` | `{currency?}` | daily limit and used | none | Existing |
| `cards` | `bank.cards.list` | none | cards | none | Existing |
| `accountGet` | `bank.accounts.get` | `{accountId}` | account with `ledgerBalance`, `availableBalance`, `holds[]`, `identifiers[]`, `openedOn`, `interestRate`, `status`, `limits[]` | `ACCOUNT_NOT_FOUND` | (planned) |
| `transactions` | `bank.transactions.list` | `{accountId, from, to, kind, status, category, minAmount, maxAmount, query, cursor, pageSize}` | page and `total` | `RANGE_TOO_LONG`, `FUTURE_DATE` | (planned) |
| `transactionGet` | `bank.transactions.get` | `{transactionId}` | transaction with `reference`, `channel`, `runningBalance`, `counterparty` | `TRANSACTION_NOT_FOUND` | (planned) |
| `rename` | `bank.accounts.rename` | `{accountId, name}` | `{accountId, name, previousName}` | `NAME_LENGTH`, `NAME_CHARS`, `NAME_TAKEN`, `ACCOUNT_NOT_FOUND` | (planned). Not money-moving |
| `reportProblem` | `bank.transactions.report` | `{transactionId, reason, note, freezeCard}` | `{caseRef}` | `PENDING_NOT_DISPUTABLE`, `DUPLICATE_REPORT`, `NOTE_TOO_SHORT` | (planned) |
| `setHidden` | `bank.accounts.setHidden` | `{accountId, hidden}` | `{hidden}` | `LAST_VISIBLE_ACCOUNT` | (planned) |
| `closeAccount` | `bank.accounts.requestClosure` | `{accountId, reason, note, destination, acknowledged}` plus PIN step-up | `{reference, requestedAt}` | `ACCOUNT_HAS_HOLDS`, `ACCOUNT_OVERDRAWN`, `STEP_UP_REQUIRED` | (planned). `requiresOtp`-style step-up (PIN) |
| `cancelClosure` | `bank.accounts.cancelClosure` | `{accountId}` | `{}` | none | (planned) |
| `exportTransactions` | `bank.transactions.export` | filters plus `format: "csv"\|"ofx"\|"pdf"` | file | `NO_TRANSACTIONS` | (planned) |

#### 6. Permissions, step-up and limits

`accounts.view` for the screen, reading, receipts, export, share and hide. Renaming needs `accounts.manage` in production (the prototype treats any signed-in person as allowed). Closing needs a PIN step-up valid for the request only; a wrong PIN counts toward the shared counter of 3 (README 1.6). Reporting and freezing from `reported` need no code because they only protect. Limits: filter period at most 24 months; closure up to 14 days; ten transactions per page.

#### 7. Result and links out

Results: `reported` (case reference `DSP-nnnnn`), `closed` (reference `CLS-nnnnn`), toasts for rename, hide, copy and share. Receipt: the transaction receipt on `receipt`. Notifications raised: "Report received {case}" (in-app and email), "Closure requested {reference}", "Closure completed" after 14 days (planned). Links out: `statement`, `personal-transfer`, `change-limits`, `add-money`, Cards, `accounts`.

#### 8. Acceptance criteria

- AC-1: The hero shows Available as the big number, with Ledger and On hold beside it; Available equals Ledger minus the holds, and **See holds** lists each hold with merchant, date and release date.
- AC-2: Identifiers follow the account's region exactly as in the table in section 3, each with its own Copy button; a US account shows no IBAN.
- AC-3: The transaction filters work together and live; pending items appear first with the heading "Pending · not yet in your ledger balance"; the count line and **Clear filters** match.
- AC-4: A custom period with the end before the start, in the future, or longer than 24 months shows the exact message and the list ignores the range until fixed.
- AC-5: A pending card payment can only be reported as "I don't recognise this payment" or "Something else"; any other reason shows `PENDING_NOT_DISPUTABLE`.
- AC-6: A payment can be reported once; a second attempt shows the existing case (`DUPLICATE_REPORT`). "Something else" needs at least 10 characters.
- AC-7: Reporting "I don't recognise this payment" with the freeze box ticked freezes the card and the result says "Frozen".
- AC-8: Renaming accepts 2 to 24 allowed characters, refuses a name used by another account, and leaves the identifiers and balance unchanged; **Use the product name** restores the original.
- AC-9: Hiding an account removes it from the overview and total, keeps it working, and is refused for the last visible account.
- AC-10: Closure is refused with `ACCOUNT_HAS_HOLDS` while holds exist and with `ACCOUNT_OVERDRAWN` when overdrawn; otherwise it needs a reason, a destination (when a balance exists), the acknowledgements and a PIN, and then shows "Closure requested" with a reference.
- AC-11: A requested closure can be cancelled before it completes; nothing else changes on the account.
- AC-12: Share details produces a preview whose lines equal the identifiers on screen, and a warning that no PIN, password or code will ever be requested.
- AC-13: When the bank switches off `shareDetails`, `closeRequest`, `reportProblem` or `hideAccount` the matching control is not drawn (planned; not yet wired in the prototype).
- AC-14: When the service is down, reporting, renaming and closing change nothing and say so; a timeout shows the standard message.

#### 9. Scenarios

Sandbox demo values: account ids `cur` (Current ••4410, US, opened 14 Mar 2019, 0.05% APY, routing `021000021`, account number `120004410`, holds Hotel Meridian $98.00, Fuel Station 12 $33.38, Blue Bottle Café $6.40), `sav` (Savings, product Savings Plus, ••7720, 3.85% APY), `eur` (••3302), `aed` (••9981), `gbp` (Sterling ••3301, sort `99-00-12`, account `55003301`), `jod` (Dinar ••6120, dormant). Today is Tue 3 Nov 2026. Transactions for Current include "Salary, Northwind" +$4,200.00 (2 days ago), "Maya Chen" -$80.00 transfer (5 days ago) and pending "Blue Bottle Café" -$6.40 and "Hotel Meridian (authorisation)" -$98.00. Any six digits are accepted as the PIN. Names to test: "Holiday fund" valid, "A" too short, and "Savings" or "Euro account" refused as taken (a name equal to another account's displayed name, in any case, is taken). The account list names are "Current account", "Savings", "Euro account", "Dirham account", "Sterling account" and "Dinar account"; "Savings Plus" is the product chip on Savings.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1 | `alex` | none | Open Current. Available $8,102.40, ledger $8,240.18, on hold $137.78. See holds lists three holds. |
| T-2 | AC-2 | `alex` | none | Open Current: routing, account number, SWIFT. Open Sterling: sort code, account number, IBAN `GB..`, BIC. Open Euro: IBAN `DE..` and BIC. Open Dinar: 30-character IBAN `JO..`. |
| T-3 | AC-3 | `alex` | none | Type "northwind": the salary rows only. Choose Money out and Pending: two rows. Clear filters restores the default count. |
| T-4 | AC-4 | `alex` | none | Choose dates with end before start, an end tomorrow, and a 30-month span; each message appears. |
| T-5 | AC-5, AC-6 | `alex` | none | Open pending "Blue Bottle Café", Report a problem: "I was charged twice" shows `PENDING_NOT_DISPUTABLE`; "I don't recognise this payment" is accepted. Report it again: `DUPLICATE_REPORT`. |
| T-6 | AC-7 | `alex` | none | Report "Fuel Station 12" as unknown with the freeze box ticked. Result shows Card "Frozen"; Cards shows the debit card frozen. |
| T-7 | AC-8 | `alex` | none | Rename Savings to "Rainy day": saved. Rename Euro to "Rainy day": `NAME_TAKEN`. "A" and 25 characters: `NAME_LENGTH`. "Trip #1": `NAME_CHARS`. Use the product name restores. |
| T-8 | AC-9 | `alex` | none | Hide Euro; overview total drops; hide until one remains; the last is refused. |
| T-9 | AC-10, AC-11 | `alex` | none | Close Current: `ACCOUNT_HAS_HOLDS`. Close Sterling (a hold) also blocked. Close Savings with all choices and a PIN: "Closure requested" with `CLS-` reference; Cancel the request removes the banner. |
| T-10 | AC-12 | `alex` | none | Share details on Sterling: preview lists sort code, account number, IBAN, BIC; warning present. |
| T-11 | AC-14 | `alex` | `unavailable: ["bank.transactions.report", "bank.accounts.rename", "bank.accounts.requestClosure"]` (prototype: Service down on) | Report shows "We couldn't reach the bank. Nothing was sent."; Save name and Request closure show the error sheet; no change. |
| T-12 | AC-14 | `alex` | `timeout: ["bank.accounts.requestClosure"]`, `latencyMs: 10000` (planned) | Request closure shows the timeout message; the account shows no closure banner. |
| T-13 | AC-13 | `alex` | options `shareDetails`, `closeRequest`, `reportProblem`, `hideAccount` off (planned) | The matching control is absent. |

#### 10. Expected mutation-check survivors

`FUTURE_DATE` is checked on the screen and (planned) in the adapter, so removing only the adapter check survives T-4; expected. The rule that the last visible account cannot be hidden exists in the screen and in `bank.accounts.setHidden` (planned), so removing one survives; expected. The prototype does not read the four options, so AC-13 cannot be proved until they are wired. All others: none expected.

---

### ★ Account statement — `statement`

**Catalog:** slug `statement` (earlier spec slug `account-statement`), name in the prototype "Statements and letters", workspace `personal`, category Accounts (Personal: Accounts), core no, can a bank switch it off: yes (basic entry, kept in the Lean preset). Options (all default on): **Offer CSV** (`allowCsv`); **Offer OFX and QIF for accounting apps** (`allowOfxQif`); **Offer official stamped statements** (`allowOfficial`); **Charge a fee ($5.00) for official statements and balance certificates** (`officialFee`); **Offer proof of address letters** (`allowLetter`); **Offer balance certificates** (`allowBalanceCert`); **Offer paperless settings** (`allowPaperless`); **Allow sending official documents straight to a third party** (`emailThirdParty`). Research: `research/statement.md`. Built in `design/bankworkx-r1/src/journeys/22-statement.js`, which replaces the small reference journey in `10-statement.js`.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `statement` |
| Purpose | One place for every account document: a statement for the person's own records, an official stamped statement, a proof of address letter, a balance certificate, a past monthly statement, and the paperless setting per account. |
| Release / workspace | 1 / Personal |
| Status | Built in the prototype as a ★ journey (`money: false`, submit label "Get it"). The fee is a sandbox charge. File creation is simulated. |
| Channels | Web and mobile |
| Starting pattern | The reference journey `10-statement.js` (account, period, format, review, result) |
| Who may use it | Anyone with `accounts.view` (Alex, Personal). Official documents and paperless changes ask for a code. |

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Accounts › account card › Statement; account screen › Statement | `{accountId}` | `accounts.view` |
| Account screen › Statements card › a month | `{accountId, month}` (opens as "Past monthly statement") | `accounts.view` |
| Account screen › Statements card › All statements and letters | `{accountId}` | `accounts.view` |
| Account screen › Export (hint "Need a stamped statement…?") | `{accountId}` | `accounts.view` |
| Home › quick action, ⌘K | none (account defaults to Current) | `accounts.view` |
| Other launch parameters | `purpose` (`records`, `official`, `letter`, `balcert`, `monthly`, `paperless`), `period` (`m0`, `m1`, `q`, `h`, `y`, `y2`, `custom`) | `accounts.view` |

#### 3. Screens

The screens run in this order and each can be skipped: **purpose**, then **where** (not for paperless), **format** (not for paperless), **prefs** (paperless only), **review**, a code prompt (official documents), and the result.

**`purpose`: "Statements and letters"**, intro "What do you need it for?". One field, **I need** (radio cards, required). The cards shown depend on the options:

| Value | Title | Text | Right side | Shown when |
|---|---|---|---|---|
| `records` | Statement for my records | "Any period up to 24 months, for your own use. PDF, CSV, OFX or QIF." | none | always |
| `official` | Official statement | "Stamped by the bank for a visa, loan or tenancy. Up to 12 months." | "$5.00" or "Free" | `allowOfficial` |
| `letter` | Proof of address letter | "A signed letter with your name, address and account. Valid 3 months." | none | `allowLetter` |
| `balcert` | Balance certificate | "States your balance on one date. For a visa or a loan." | "$5.00" or "Free" | `allowBalanceCert` |
| `monthly` | Past monthly statement | "The regular monthly statement, last 24 months." | none | always |
| `paperless` | Paperless settings | "Choose e-statements or paper, and how we tell you." | none | `allowPaperless` |

Changing the purpose resets the format to PDF and the paper toggle to the account's saved value. Launching with `month` sets the purpose to Past monthly statement.

**`where`: "Account and period"** (skipped for paperless). Fields:

| Field | Block | Required | Shown when | Validation | Message |
|---|---|---|---|---|---|
| Account | select "{name} ••{last} · {balance}" | Yes (prefilled) | always | Not a closed account | "Closed accounts can only be requested at a branch. (ACCOUNT_CLOSED)" |
| Period | chips | Yes (default Last month) | records, official | Records: This month, Last month, Last 3 months, Last 12 months, Last 24 months, Choose dates. Official: Last month, Last 3 months, Last 6 months, Last 12 months, Choose dates | none |
| From | date | Yes | Choose dates (records, official) | Not before the account opened | "This account opened on {date}. Choose a later start. (BEFORE_OPENING)" |
| To | date | Yes | Choose dates | Not before From; records at most 731 days; official at most 366 days | "The end date is before the start date. (RANGE_INVALID)" / "Statements cover up to 24 months at a time. (PERIOD_TOO_LONG)" / "Official statements cover up to 12 months. (PERIOD_TOO_LONG)" |
| Statement month | select (last 24 months, "{Month Year} · Ready") | Yes | monthly | none; hint "Statements are ready on the 1st of the next month." | none |
| Balance on | date (last 740 days) | Yes (default today) | balcert | none; hint "We state your ledger balance at the end of this day." | none |

An info card for the letter shows "Address on the letter: {address}. Verified {date}. To change it, go to More › Profile." An info line for official: "An official statement is stamped and signed by BankWorkx®. Visa offices, landlords and lenders can check it online with the code printed on it. Choose up to 12 months." A letter for a dormant account is refused on this screen: "This account is dormant. Make a deposit first, then ask for the letter. (ACCOUNT_DORMANT)".

**`format`: "Format and delivery"** (skipped for paperless).

| Field | Block | Required | Shown when | Rule | Message |
|---|---|---|---|---|---|
| Format | radio cards | Yes (PDF) | always | PDF always. Official, letter and balance certificate: PDF only, text "Signed PDF with a QR code the recipient can check." Records: PDF "Opens anywhere. Best to read and print.", CSV (if `allowCsv`), OFX and QIF (if `allowOfxQif`). Monthly: PDF "The original statement.", CSV (if `allowCsv`) | none |
| Language | chips English, "Arabic and English" | No | official, letter, balcert | none | none |
| What is it for? | select Visa application, Loan or mortgage, Rent or tenancy, Employer, Something else | No (default Visa) | official, letter, balcert | hint "The purpose is printed on the document so the recipient knows why it was issued." | none |
| Summary page | check "Include a summary page with opening and closing balances" | No (on) | PDF and records | none | none |
| Running balance | check "Include a running balance column" | No | CSV | none | none |
| How do you want it? | chips Download now, Email it | No | always | none | none |
| Send to | chips "Me ({masked email})", Someone else | No | Email it, official documents, `emailThirdParty` on | none | none |
| Recipient's email | email, placeholder name@company.com | Yes | Someone else | `^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$`; hint "They get a link that works for 14 days. We never attach the document." | "That email address doesn't look right. (INVALID_EMAIL)" |

When emailing to the person, the info line reads "We email it to {a•••@example.com}, the address you gave us. Large files arrive as a secure link."

**`prefs`: "Paperless settings"** (paperless only), intro "Choose how each account's monthly statement reaches you."

| Field | Block | Required | Rule | Message |
|---|---|---|---|---|
| Account | select "{name} ••{last} · Paperless" or "· Paper" | Yes | none | none |
| Paperless e-statements | toggle, "We stop posting paper. Your statement stays in the app for 24 months." | No (on) | none | none |
| Tell me when it's ready by | chips Email, Text message, App notification | Yes while paperless is on (default Email) | none | none |

When paper is chosen an info card says "Paper statements cost $2.00 a month. Posted to {address}. You can switch back any time." (`PAPERLESS_LOCKED` "Paperless can't be turned off for this account." is reserved for accounts a regulator or the bank requires to stay digital; the prototype never raises it.)

**`review`: "Check and get it"**, button **Get it**, busy text "Preparing your document…" for about 900 ms. A rows card lists: Document, Account, Address (letter) or Balance on (certificate) or Period, Format (with "Arabic and English" when chosen), Delivery ("Download" or "Emailed to {address}"), Fee ("$5.00", also "({amount} {currency})" for a foreign currency account, or "Free" for official documents). For paperless: Account, Statements ("Paper, posted" or "Paperless in the app"), Fee or "Told by". Official documents add: "You'll confirm with a code. We show your name, address and account number on this document. Share it only with the organisation that asked for it." Checks on Get it:

| Check | Error code | Message |
|---|---|---|
| Letter and no verified address | `ADDRESS_NOT_VERIFIED` | "We can't confirm your address yet." |
| Records, official or monthly with no non-pending transaction in the period | `NO_TRANSACTIONS` | "There are no transactions on {account} in the period {period}." |
| Fee above the available balance (in the account's currency) | `FEE_INSUFFICIENT_FUNDS` | "Your available balance of {available} is too low for the {fee} fee." |

A balance certificate for a date with no activity is allowed.

**Code prompt.** For official statement, letter and balance certificate (and, in the specification, paperless changes) the person is asked: title "Confirm {document name in lower case}" (for example "Confirm official statement"), subtitle "Code sent to ••• 4410". The prototype uses its 6-digit keypad that accepts any six digits; the production rule is the standard one-time code (6 digits, 3 tries, resend after 30 s; sandbox `482100`). Records and past monthly statements need no code.

**Result.** For documents: title "Statement ready", or "{Document} ready" for official documents, or "On its way" when emailed. Text: "Your {FORMAT} is ready to download.", or "Signed and stamped. The recipient can check it with the code.", or "We emailed it. It can take a few minutes." Status chip "PDF · {n} pages" or the format. Rows: Document, Account, then for a letter Address and "Valid until 3 Feb 2027"; for a balance certificate Balance on and Ledger balance; otherwise Period, Transactions, Opening balance, Closing balance; then File ("{file name} · {kb} KB"), Delivery, and for official documents Verification code (`VC-nnnn-nnnn`) and Purpose, then Fee charged when a fee applies. File names: `statement-{last4}-{from}-{to}.{ext}`, `address-letter-{last4}-{date}.pdf`, `balance-certificate-{last4}-{date}.pdf`. Paperless result: "You're paperless" ("Your monthly statement will be in the app. We'll tell you when it's ready.") or "Paper statements on" ("We'll post your statement each month. It also stays in the app."), rows Account, Statements, Told by, Starts ("Next statement, 1 Dec 2026"). Buttons: **Download** and **Share** (or **Back to account** after emailing), **Done**.

**States:** loading is the 900 ms preparing spinner; the empty state is `NO_TRANSACTIONS`; errors show the engine banner with the code's message; timeout and unavailable use the standard messages ("Nothing was charged" is added when a fee applied).

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `PERIOD_TOO_LONG` | "This period is too long for this type of statement." (field text: "Statements cover up to 24 months at a time." or "Official statements cover up to 12 months.") | `where` (To field) | Fix dates |
| `RANGE_INVALID` | "The end date is before the start date." | `where` | Fix dates |
| `BEFORE_OPENING` | "This account didn't exist then." (field text names the opening date) | `where` | Fix dates |
| `INVALID_EMAIL` | "That email address doesn't look right." | `format` | Edit |
| `ACCOUNT_CLOSED` | "Closed accounts can only be requested at a branch." | `where` | Choose account |
| `ACCOUNT_DORMANT` | "This account is dormant. Make a deposit first, then ask for the letter." | `where` | Choose account |
| `ADDRESS_NOT_VERIFIED` | "We can't confirm your address yet." | `review` | Back |
| `NO_TRANSACTIONS` | "There are no transactions on {account} in the period {period}." | `review` | Change period |
| `FEE_INSUFFICIENT_FUNDS` | "Your available balance of {available} is too low for the {fee} fee." | `review` | Back |
| `PAPERLESS_LOCKED` | "Paperless can't be turned off for this account." | `review` | Back |
| `OTP_INVALID` (planned for this journey) | "That code isn't right. {n} tries left." | code prompt | Try again |
| `TIMEOUT` (planned) | "This is taking longer than expected. Nothing was changed. No fee was charged." | engine error | Try again |
| `SERVICE_UNAVAILABLE` (planned) | "This service is not available right now. Nothing was changed. Please try again in a few minutes." | engine error | Try again |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `accounts` | `bank.accounts.list` | none | accounts | none | Existing |
| `createStatement` | `bank.statements.create` | `{accountId, purpose, from, to, month, asOf, format, language, purposeOfUse, delivery, recipientEmail, includeSummary, runningBalance}` | `{reference, verificationCode?, fileName, format, sizeKb, pages, count, openingBalance, closingBalance, feeCharged, downloadUrl, expiresAt}` (download link valid for 10 minutes; e-mailed link 14 days) | `ACCOUNT_NOT_FOUND`, `ACCOUNT_CLOSED`, `ACCOUNT_DORMANT`, `PERIOD_TOO_LONG`, `RANGE_INVALID`, `BEFORE_OPENING`, `INVALID_EMAIL`, `ADDRESS_NOT_VERIFIED`, `NO_TRANSACTIONS`, `FEE_INSUFFICIENT_FUNDS`, `STEP_UP_REQUIRED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned). Replaces the planned adapter in the earlier spec. Charges a fee; `requiresOtp` for official documents |
| `statementPrefs` | `bank.statements.setPreference` | `{accountId, paperless, notifyBy}` | `{accountId, paperless, notifyBy, startsOn}` | `PAPERLESS_LOCKED`, `STEP_UP_REQUIRED` | (planned) |
| `statementMonths` | `bank.statements.listMonths` | `{accountId}` | last 24 months with `ready` | none | (planned) |
| `otp` | `bank.otp.send`, `bank.otp.verify` | existing | existing | `OTP_INVALID`, `OTP_REQUIRED` | Existing |

Sandbox arithmetic: for Current ••4410 (ledger $8,240.18) with "Last month" (1 to 31 Oct 2026) the data holds 19 posted transactions, opening $3,190.57 and closing $4,040.18, 3 pages (derived from the seed; confirm when the adapter is built). Pending items are never counted.

#### 6. Permissions, step-up and limits

`accounts.view`. Step-up: a one-time code for official statement, proof of address letter, balance certificate (these carry name, address and account number) and for any paperless change; none for records and past monthly statements, and none for e-mail to the person's own address. Fees: $5.00 for official statement and balance certificate when `officialFee` is on; letter, records, monthly and paperless changes are free; paper statements cost $2.00 a month. A foreign-currency fee is converted at the sandbox rate. Limits: records at most 24 months; official at most 12 months; letter valid 3 months; e-mailed link valid 14 days.

#### 7. Result and links out

Result as above. Receipt: the document itself, plus the result rows (reference, verification code, fee). Notifications raised: "Your {document} is ready" (in-app), "Statement emailed to {address}" (email), "Fee of $5.00 charged" (in-app), "Paperless setting changed" (email and in-app). Buttons: **Download**, **Share** (system share sheet, hidden after e-mail), **Done** (back to the account screen or wherever the person started). Letter and certificate link to More › Profile for address changes.

#### 8. Acceptance criteria

- AC-1: Each purpose card appears only when its option is on; `records` and `monthly` always appear.
- AC-2: A records statement for any account and a preset period is produced as PDF, CSV, OFX or QIF according to the options, named `statement-{last4}-{from}-{to}.{ext}`, with the transaction count and opening and closing balances matching the sandbox data.
- AC-3: A custom period longer than 24 months (records) or 12 months (official), an end before the start, or a start before the account opened is refused on the `where` screen with the exact message and no document is made.
- AC-4: An official statement, letter or balance certificate asks for a code before it is made; a records statement and a past monthly statement do not.
- AC-5: The official statement result shows a verification code, the stated purpose and the fee; the fee is taken from the available balance in the account's currency, and refused with `FEE_INSUFFICIENT_FUNDS` when the available balance is too low (no fee charged, no document).
- AC-6: With `officialFee` off the document is free and the fee row reads "Free".
- AC-7: A proof of address letter shows the verified address and "Valid until" three months ahead, and is refused for a dormant account (`ACCOUNT_DORMANT`) or an unverified address (`ADDRESS_NOT_VERIFIED`).
- AC-8: A balance certificate for a date with no activity is produced; a records, official or monthly document for a period with no transactions shows `NO_TRANSACTIONS` and offers a change of period.
- AC-9: Emailing to someone else is offered only for official documents with `emailThirdParty` on, needs a valid address (`INVALID_EMAIL`), and says the link works for 14 days.
- AC-10: Paperless per account can be switched on or off, choosing a notification channel while on; switching to paper shows the $2.00 monthly fee and the posted address.
- AC-11: A past monthly statement is chosen from the last 24 months and opens directly from the Statements card on the account screen.
- AC-12: CSV, OFX and QIF are offered only when their options are on; official documents are PDF only.
- AC-13: If the service times out or is unavailable no document is produced and no fee is charged.
- AC-14: A closed account is refused with `ACCOUNT_CLOSED`.

#### 9. Scenarios

Sandbox demo values: account ids `cur` (Current ••4410, US, available $8,102.40), `sav`, `eur` (fee shown as €4.63), `aed`, `gbp`, `jod` (Dinar, dormant, no transactions). Today is Tue 3 Nov 2026. The address on file is "Flat 12, 8 Bay Street, Dubai Marina, Dubai, UAE", verified 12 Mar 2026. Masked email `a•••@example.com`. The prototype code prompt accepts any six digits; the production sandbox code is `482100`. Recipient emails to try: `visa.office@example.com` valid, `visa.office@` invalid.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-2, AC-12 | `alex` | none | Choose "Statement for my records", Current, Last month, PDF, Download, Get it. No code. Result shows 19 transactions, opening $3,190.57, closing $4,040.18 and file `statement-4410-2026-10-01-2026-10-31.pdf`. Repeat with CSV, OFX, QIF. |
| T-2 | AC-3 | `alex` | none | Records, Choose dates: end before start gives `RANGE_INVALID`; a 30-month span gives `PERIOD_TOO_LONG`; a start before 14 Mar 2019 gives `BEFORE_OPENING`. Official, a 13-month span: "Official statements cover up to 12 months." |
| T-3 | AC-4, AC-5 | `alex` | none | Official statement, Current, Last 3 months, Visa application, Download. Code prompt appears; after it the result shows Verification code `VC-…`, Purpose, Fee charged $5.00. Current's ledger and available balance drop by $5.00. |
| T-4 | AC-5 | `alex` | Euro account available lowered to under €4.63 (setup) | Official statement for Euro. Review shows "$5.00 (€4.63)"; Get it gives `FEE_INSUFFICIENT_FUNDS`; balance unchanged. |
| T-5 | AC-6 | `alex` | option `officialFee` off | Official statement shows "Free" at review and no fee on the result. |
| T-6 | AC-7 | `alex` | none | Proof of address letter for Current: address and "Valid until 3 Feb 2027" on the result. For Dinar: `ACCOUNT_DORMANT` on the `where` screen. |
| T-7 | AC-8 | `alex` | none | Balance certificate for yesterday: produced. Records for Dinar (no transactions): `NO_TRANSACTIONS`, Change period. |
| T-8 | AC-9 | `alex` | none | Official statement, Email it, Send to Someone else, `visa.office@` shows `INVALID_EMAIL`; `visa.office@example.com` accepted and the result says "Emailed to visa.office@example.com". With `emailThirdParty` off, the "Send to" chips are gone. |
| T-9 | AC-10 | `alex` | none | Paperless settings, Savings, turn paper on: info card "Paper statements cost $2.00 a month" and the address; result "Paper statements on", Starts 1 Dec 2026. |
| T-10 | AC-11 | `alex` | none | From the account screen Statements card tap "Sep 2026 statement": opens as Past monthly statement for September with PDF or CSV. |
| T-11 | AC-13 | `alex` | `timeout: ["bank.statements.create"]`, `latencyMs: 10000` (planned) | Official statement through the code prompt: timeout message, no document, balance unchanged. |
| T-12 | AC-13 | `alex` | `unavailable: ["bank.statements.create"]` (prototype: Service down on) | Unavailable message, no document, no fee. |
| T-13 | AC-14 | `alex` | a closed account in the seed (planned) | Choosing it shows `ACCOUNT_CLOSED`. |

#### 10. Expected mutation-check survivors

The fee check is made on `review` in the screen and in the adapter (planned), so removing only the adapter check survives T-4; expected. `PAPERLESS_LOCKED` is never produced in the sandbox, so removing it cannot be seen; expected survivor. The paperless step-up is declared but not enforced in the prototype (see the settle list in the report), so a mutation that removes it also survives until it is wired. All others: none expected.

---

### ★ Rename an account — `account-nickname`

**Catalog:** slug `account-nickname`, workspace `personal`, category Accounts (Personal: Accounts), core no, can a bank switch it off: yes. Options: none of its own; it is reached through `account-details` and switches off only with it.

**Alias of `account-details`:** reached from the **Rename** button on the account screen (`account-details`, sub-screen `nick`), launch parameter `{accountId}`. There is no separate catalog entry in the prototype; switching `account-details` off removes rename. A future bank option `renameAccount` could switch the button alone (planned). What differs from the earlier standalone spec:

- Rename is a sub-screen of the account screen, with a **Back** button, not a separate journey with a result screen. Success is a toast "Name saved" and a return to the account screen.
- Validation is live as the person types, with codes `NAME_LENGTH` ("Enter a name of 2 to 24 characters."), `NAME_CHARS` ("Use letters, numbers and spaces only.") and `NAME_TAKEN` ("You already have an account called {name}."). These replace `NAME_INVALID` and `NAME_EXISTS`.
- The allowed characters are letters, digits, spaces and `& - ' .`; the name is trimmed; a name equal (any case) to another account's displayed name is refused.
- A second button **Use the product name** removes the nickname.
- The adapter is `bank.accounts.rename` (planned) as before; acceptance criteria and scenarios T-7 and AC-8 of `account-details` cover it.

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

Catalog: `transfer-types`, workspace Personal, category Personal: Payments (tab `pay`), core no, a bank can switch it off: yes (kept in the Lean preset, `basic`). Options: "Show the “Which should I use?” helper" (default on, key `showHelper`); "Show the side-by-side table" (default on, key `showCompare`). It moves no money. A type card disappears when every journey that starts it is switched off; a card whose journey is not built shows a disabled "(soon)" button.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `transfer-types` |
| Purpose | One screen that shows every way to move money, with speed, cost, limit, cut-off and name check, filtered by where the money is going, plus a helper that recommends one way from three answers (how soon, where to, how much). It teaches the choice that US and Middle East banks make the person take and UK and EU banks hide. |
| Release / workspace | 1 / Personal |
| Status | New. Built in the prototype (`design/bankworkx-r1/src/journeys/28-transfer-types.js`, a view journey, `view: true`); research in `research/transfer-types.md`. Not in the module as a journey before. In the product it is a shell screen with the catalog entry above. |
| Channels | Web and mobile |
| Starting pattern | None. Rails come from the shared table in 09 section 2. |
| Who may use it | `payments.create` (the prototype checks this; a person without it does not see the buttons that start a payment) |
| Shared reference | `09-payment-rails.md` sections 2 (rails, fees, limits, cut-offs), 4 (name check), 9 (daily limit), 10 (cooling-off). This screen restates only what it displays. |

**Sandbox demo values.** Rails, fees, limits and cut-offs are the 09 section 2 table. Daily limit left 41,250.00 USD (fixed in the prototype). New-payee allowance 500.00 USD for 24 hours. Rates 1 USD = EUR 0.926, GBP 0.781, AED 3.672, SAR 3.75, JOD 0.709, CAD 1.36 (09 section 5). Helper defaults on opening: region United States, urgency "Right now", destination United States, amount 1000.

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Payments › Send money (top of the tab) | `{region?}` (`us`, `eu`, `uk`, `me`, `intl`; default `us`) | `payments.create` |
| Home › Send › Which way? | none | `payments.create` |
| Any transfer journey › "Which way?" link (planned) | `{region}` | `payments.create` |

#### 3. Screens

One screen, `ways` ("Ways to send money"). Blocks: `heading`, `segmented` (region), `card` (helper), `cardGrid` of type cards, `dataTable` (side by side), small print.

Copy: title "Ways to send money". Intro "Pick where the money is going. Each card shows how fast it is, what it costs and what to watch for." Small print "Fees and limits are examples for this prototype. Your bank's own terms apply." In the product the last line reads "Fees and limits are set by your bank." (planned).

**Region selector** (`segmented`, one choice): United States, Europe, United Kingdom, Middle East, International. Default United States. Changing it redraws the cards and the table.

**Helper card "Which should I use?"** (shown when option `showHelper` is on). Small text "Answer three things and we recommend a way to send."

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| How soon does it need to arrive? | `segmented`: Right now, Today, In a few days, Cheapest (default Right now) | Yes | One of four | none |
| Where to? | `select` of nine: My accounts, BankWorkx® customer, United States, Europe, United Kingdom, UAE, Saudi Arabia, Jordan, Abroad (SWIFT). Default United States | Yes | One of nine | none |
| How much (USD)? | `textInput` (decimal), prefix "$", placeholder "0.00", default 1000 | No | A number; empty means "no limit test". Converted to the destination currency at the sandbox rate to test each rail's maximum | When no rail fits: "No rail fits this amount. Try a smaller amount, or split the payment. (RAIL_LIMIT)" |

The recommendation redraws on every keystroke without moving the cursor.

How the helper decides:
- Destination "My accounts": "Use Between my accounts. It is instant and free. A fee of 0.20% applies only if the currency changes, and you see the rate before you confirm." Button **Start** (`personal-transfer {type: own}`; the prototype still points at `own-transfer`, which is the same flow).
- Destination "BankWorkx® customer": "Use To a BankWorkx® customer. It is free and arrives in seconds because the money never leaves the bank." Button **Start** (`personal-transfer {type: internal}`; the prototype points at `internal-transfer`, not yet built, so it shows "(soon)").
- Any other destination: take the destination's rails (09 section 2). Drop SEPA Instant when the demo switch is on, and drop any instant rail when `single-transfer` option "Offer instant rails" is off. Drop rails whose maximum is below the amount. Rank by speed: instant 0, same day 1, next day 2, Bacs and SWIFT 3. Allowed rank by urgency: Right now 0, Today 1, In a few days 3, Cheapest 3. Among rails inside the allowed rank, pick the lowest fee, ties by speed. If none is fast enough, pick the fastest that fits and say so. If nothing fits: the red box above.
- The text: "Use {rail}." then up to four sentences: why (urgency), cost and limit ("It costs $0.25 and its limit is $500,000, so $1,000.00 fits."), a cheaper-but-slower rail when there is one, and "Send before {cut-off}, or it goes out the next business day." for a cut-off rail.
- Warnings in red: amount over 41,250: "Over your remaining daily limit of $41,250.00 (DAILY_LIMIT_EXCEEDED). Split it or ask us to raise the limit."; amount over 500: "If the person is a new payee, the first 24 hours are limited to $500.00 (BENEFICIARY_COOLING_OFF)."; destination Abroad: "Name checks are usually not available over SWIFT, so check the details with the person first."
- "Other options: {rail} ({fee}, {speed}); …" lists the other rails that fit.
- Buttons: **Quick transfer** (`single-transfer {rail}`; for Abroad **Start** to `personal-transfer {type: international}`; the prototype points at `international-transfer`, not yet built) and **New payee** (`personal-transfer`, except Abroad).

**Type cards** (one per type that is switched on, in this order). A card has: icon, name, "Best for: …", an "Instant" chip where it applies, then either fixed facts (Speed, Cost, Limit, Cut-off, Name check) or, for rail types, one line per rail (name, speed, fee, limit) plus "Cut-off" and "Name check" and an optional note, then buttons.

| Card | Facts or rails | Buttons |
|---|---|---|
| Between my accounts | Instant; free (0.20% if the currency changes); limit "Your available balance"; no cut-off, any time; name check not needed | **Start** |
| To a BankWorkx® customer | Instant; free; $25,000.00 per payment; none, 24/7; matched to the customer record | **Start** |
| Domestic: standard | Rails by region (table below) | **Quick transfer**, **New payee** |
| Domestic: instant | Rails by region | **Quick transfer**, **New payee** |
| Same-day or wire | Rails by region | **Quick transfer**, **New payee** |
| International (SWIFT) | Shown only for region International: SWIFT, "$25.00 (+ $15.00 if you pay all charges)", no limit, cut-off 15:00 UTC; "Track it with the UETR." | **Start**, **Saved payee** (`single-transfer {rail: swift}`) |
| Bill payment | Same day, set by the biller; free; set by the biller; bills paid by 16:00 count today | **Pay a bill** (`pay-bill`) |
| Scheduled and recurring | On the date you choose; same as the rail you pick; up to 30 days ahead for one-off dates; checked again on the day | **Schedule** (`schedule-payment`), **One-off date** (`single-transfer`) |
| Bulk (business) | Greyed teaser "Pay many people from a CSV or a payroll file, with approvals. Available in a business workspace." | none |

Rails shown per region (the buttons pass the first rail as the starting choice, plus the region):

| Region | Standard | Instant | Same-day or wire |
|---|---|---|---|
| United States | ACH | RTP / FedNow | Same-day ACH, Fedwire |
| Europe | SEPA Credit Transfer | SEPA Instant | greyed: "SEPA has no separate same-day rail. If it must arrive today, use SEPA Instant." |
| United Kingdom | Faster Payments (note: "In the UK, Faster Payments is the normal way to pay. Bacs (3 working days, up to £20,000) is kept for scheduled and recurring payments.") | Faster Payments ("Faster Payments is already instant, so it is the same rail as Standard.") | CHAPS |
| Middle East | UAEFTS, SARIE, JoPACC | Aani, sarie instant, CliQ | greyed: "UAEFTS and SARIE are already same-day rails. They are listed under Standard." |
| International | no card | no card | no card (only the SWIFT card) |

US standard also carries the note "Standard ACH is free but not guaranteed to be same day. Use Same-day or wire when timing matters." A greyed card says "Not a separate option in this region." when nothing else explains it. Name check line by region: United States "Account name check (only where the bank can see the name)"; Europe "Verification of Payee (EU rule since Oct 2025)"; United Kingdom "Confirmation of Payee"; Middle East "Name check (varies by country)"; International "Usually not available (SWIFT)". Cut-offs: Same-day ACH 14:45 ET, Fedwire 18:00 ET, SEPA Credit Transfer 15:00 CET, CHAPS 17:00 UK, UAEFTS 15:00 UAE, SARIE 15:00 Riyadh, JoPACC 14:00 Amman, SWIFT 15:00 UTC; instant rails "none, 24/7". Limits "No limit" where the rail maximum is 10 million or more.

**Side-by-side table** (option `showCompare`): heading "Side by side · {region}"; columns Way to send, Speed, Cost, Limit, Cut-off; one row per rail of the region (SWIFT for International).

States:
- Loading: skeleton cards (planned; the prototype draws at once).
- Empty: when every type is switched off: icon, "Nothing is switched on", "Your bank has switched off every way to send money here."
- Error: "We couldn't load the ways to send money. Nothing was changed." with **Try again** (planned, for when rails come from the sandbox).

#### 4. Sandbox errors

| Code | Message the person sees | Shows on | Button |
|---|---|---|---|
| `RAIL_LIMIT` | "That is over the limit of every way to send it. Try a smaller amount." (helper box: "No rail fits this amount. Try a smaller amount, or split the payment.") | helper | change the amount |
| `JOURNEY_DISABLED` | "This isn't available at your bank." | when a button's journey is switched off but opened by an old link | Back |
| `DAILY_LIMIT_EXCEEDED` | warning line, see above (information only) | helper | none |
| `BENEFICIARY_COOLING_OFF` | warning line, see above (information only) | helper | none |
| `TIMEOUT` (planned) | "We didn't get an answer in time. Nothing was changed." | `ways` | Try again |
| `SERVICE_UNAVAILABLE` (planned) | S-`SERVICE_UNAVAILABLE` | `ways` | Try again |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `limits` | `bank.limits.get` | `{currency?}` | `{daily, usedToday}` (replaces the fixed 41,250.00) | `LIMIT_NOT_SET` | Existing |
| `rails` | `bank.payments.rails` | `{region}` | `{rails[{id, name, speed, currency, max, fee, cutoff, instant, available}]}` from the bank's configuration (limits are bank settings, not scheme limits) | `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned). Not money-moving; no OTP |
| `catalog` | `bank.catalog.get` | none | which journeys are on, and their options | none | (planned; the prototype reads `JR.off` and `JR.opt`) |

In the prototype the rails come from the constant table `RAILS`, `REG` and `ME` in `src/js/90-payflow.js`, the cut-offs from `TT_CUT`, and the helper uses `FX` for the amount test. No adapter is called.

#### 6. Permissions, step-up and limits

`payments.create` to start any payment from a card. The screen itself changes nothing and asks for no code. It shows, but does not enforce, the daily limit and the new-payee allowance (the journeys enforce them).

#### 7. Result and links out

No result: the screen is the destination. Each button opens a journey with values: `single-transfer {rail}` (saved payee), `personal-transfer {type, region, rail}` (new payee; `type` is `domestic`, or `international` for the International region), `personal-transfer {type: own}`, `personal-transfer {type: internal}`, `pay-bill`, `schedule-payment`. No notification.

#### 8. Acceptance criteria

- AC-1: Choosing a region shows only the rails of that region, each with speed, fee, limit and cut-off taken from the shared rails table, and the side-by-side table lists the same rails.
- AC-2: International shows one SWIFT card and no domestic cards; Europe shows a greyed same-day card that points to SEPA Instant; the Middle East shows a greyed same-day card that points to Standard.
- AC-3: The helper with United States, Right now, $1,000 recommends Instant (RTP / FedNow) and gives the reason, the fee and the limit.
- AC-4: When no rail is fast enough for the amount, the helper recommends the fastest that fits and says so; when none fits it shows `RAIL_LIMIT` and no buttons.
- AC-5: The helper warns about the daily limit above 41,250.00 and about the new-payee limit above 500.00, and warns that SWIFT has no name check.
- AC-6: A rail that is switched off, or SEPA Instant when it is down, is never recommended.
- AC-7: A type whose journey is switched off does not appear; a type whose journey is not built shows a disabled "(soon)" button.
- AC-8: With both options off the helper and the table disappear; with every journey off the empty state shows.
- AC-9: The screen moves no money and asks for no code.

#### 9. Scenarios

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-2 | `alex` | none | Open the screen; pick each of the five regions. US shows ACH, Same-day ACH, RTP, Fedwire; International shows only the SWIFT card. |
| T-2 | AC-2 | `alex` | none | UK: Standard and Instant both show Faster Payments with the two notes; Same-day shows CHAPS (limit "No limit", cut-off 17:00 UK). |
| T-3 | AC-3 | `alex` | none | Helper: United States, Right now, 1000: "Use Instant (RTP® / FedNow®)", costs $0.25, limit $500,000, other options listed. |
| T-4 | AC-4 | `alex` | none | Helper: Europe, Right now, 200000 USD (about EUR 185,200): SEPA Instant does not fit (100,000), so "Nothing here is as fast as you asked for at this amount, so SEPA Credit Transfer is the fastest that fits." |
| T-5 | AC-4 | `alex` | none | Helper: Jordan, Today, 20,000,000 USD: no rail fits; red box with `RAIL_LIMIT`; no buttons. |
| T-6 | AC-5 | `alex` | none | Helper: Abroad, In a few days, 600: SWIFT recommended with the SWIFT warning and the new-payee warning; 50,000 adds the daily-limit warning. |
| T-7 | AC-6 | `alex` | `single-transfer` demo switch "SEPA Instant is unavailable" on | Helper: Europe, Right now, 200: SEPA Instant is skipped. |
| T-8 | AC-7 | `alex`, `single-transfer` off | none | The Quick transfer buttons are hidden; Bill payment and Scheduled cards remain. |
| T-9 | AC-8 | `alex` | both options off | No helper, no table. With every journey off: "Nothing is switched on". |
| T-10 | AC-9, unavailable | `alex` | `unavailable: ["bank.payments.rails"]` (planned) | "We couldn't load the ways to send money. Nothing was changed." with **Try again**; nothing else changes. |
| T-11 | AC-9, timeout | `alex` | `timeout: ["bank.payments.rails"]`, `latencyMs: 10000` (planned) | The timeout copy with **Try again**; no balance or payee changes. |

#### 10. Expected mutation-check survivors

The per-region note texts and the order of the type cards survive (only presence is asserted). The ranking tie-break between two rails with the same fee survives unless a scenario has equal fees (US ACH and Same-day differ, so it is not reached). The 41,250.00 figure survives until `bank.limits.get` feeds it. The hard-coded Middle East card mixes the rails of three countries (UAE, Saudi Arabia, Jordan) in one list; a mutant that drops one country's rail survives because no scenario counts them.

---

### ★ Between my accounts — `own-transfer`

Catalog: `own-transfer`, workspace Personal, category Personal: Payments, core no, a bank can switch it off: yes. Options (key, label, default): `allowFx` "Allow conversion between currencies" (on); `fxFee` "Charge the 0.20% conversion fee" (on). The same flow is also type `own` inside `personal-transfer` (option `type.own` there; the conversion options of that journey are `allowFx` there too); switching off this catalog entry removes the stand-alone launch points, not the type inside `personal-transfer`.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `own-transfer` |
| Purpose | Move money between the customer's own accounts. Same currency is a plain, instant, free move. Different currencies are converted at the mid-market rate with no margin, a separate 0.20% fee, and a rate held for 30 seconds. |
| Release / workspace | 1 / Personal |
| Status | Existing, rebuilt. Built in the prototype (`design/bankworkx-r1/src/journeys/30-own-transfer.js`); research in `research/own-transfer.md`. The FX half started as `fixtures/convert-currency.ts` (slug `convert-currency`, id `jrn_convert_currency`, version 1, published, web and mobile, English and Urdu); the same-currency half is new. `convert-currency` stays an alias for Meezan. |
| Channels | Web and mobile |
| Starting pattern | `fixtures/convert-currency.ts` |
| Who may use it | `payments.create` |

**Sandbox demo values (prototype).** Current account ••4410 (balance 8,240.18, available 8,102.40 USD), Savings ••7720 (14,310.00 USD), Euro account ••3302 (EUR 2,150.40), Dirham account ••9981 (AED 5,000.00). Mid-market rates come from the table 1 USD = EUR 0.926, AED 3.672 (so 1 EUR = 1.0799 USD, 1 EUR = 3.9654 AED). The first quote equals the mid rate; a refreshed or renewed quote moves up to 0.04% either way (random). Worked example: Current to Euro, send USD 500.00: rate 0.9260, fee 1.00, total taken 501.00, you get EUR 463.00; Current available 7,601.40, ledger 7,739.18, Euro 2,613.40. Current to Savings, 200.00 with note "Rainy day": Current available 7,902.40, Savings 14,510.00. The prototype accepts any six digits as the code.

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Payments › hub › Between my accounts | none | `payments.create` |
| Accounts › detail › Transfer from this account | `{accountId}` (prefills From) | `payments.create` |
| Home › + Send money › Between my accounts | none | `payments.create` |
| Payments › Ways to send money › Between my accounts (`transfer-types`) | none | `payments.create` |
| Payments › tracker › payment › Repeat payment | `{paymentId}` (planned) | `payments.create` |

Launch values read: `accountId` (From), `toId` (To), `amount`. Defaults: From Current, To Savings.

#### 3. Screens

`stepper` (planned): accounts, amount, review, code.

**`accounts`: "Between my accounts"** (entry). Intro "Money between your own accounts arrives straight away." A **Swap accounts** button (swaps From and To and drops any quote). Button **Continue**.

| Field | Block | Required | Validation | Error message |
|---|---|---|---|---|
| From | `select` of all own accounts: "{name} ••{last} · {available}" | Yes | Not a frozen account | `ACCOUNT_CANNOT_DEBIT` "You can't send money from this account right now. Choose another account." |
| To | `select` of all own accounts: "{name} ••{last} · {balance}" | Yes | Not the same as From; if the currencies differ, option `allowFx` must be on | "Choose an account to send to." / `SAME_ACCOUNT` "Choose two different accounts." / `CURRENCY_NOT_SUPPORTED` "We can't convert between {A} and {B} yet." |

When the two accounts use different currencies an info box appears: "These accounts use different currencies. We convert at the mid-market rate, the one banks use between themselves, with no margin added. Today that is 1 {A} = {rate} {B}. Our fee is shown separately: 0.20% of the amount. You see the exact rate before you confirm." (When option `fxFee` is off the prototype still says 0.20%; see contradictions.) If the person has only one account: empty state "You need two accounts to move money between them." with **Open another account** (planned).

**`amount`: "Amount"**. A card shows From and To. Button **See the rate**, busy text "Getting your rate…" (about 0.6 s). Loading must answer within 10 seconds, otherwise `timeout`.

| Field | Block | Required | Validation | Error message |
|---|---|---|---|---|
| I want to enter | `chips`: "What I send ({A})", "What I get ({B})"; default send; only when the currencies differ | No | One of two | none |
| Amount | `amountInput` in the entered currency; hint "Entered in {currency}. Available in {account}: {balance}." | Yes | At least 1.00, at most 2 decimals; the amount to send plus the fee at most the available balance | "The smallest amount is 1.00." (`INVALID_AMOUNT`) / "Enter an amount in {currency} with at most 2 decimal places." (`INVALID_AMOUNT`) / "There isn't enough money in {account}. Available: {balance}, and the fee is {fee}." (`INSUFFICIENT_FUNDS`) |
| Note to yourself | `textInput`, placeholder "Optional"; same currency only; hint "Up to 35 characters." | No | 35 characters | none (the field refuses extra characters) |

Live summary under the amount. Same currency: You send, Fee (0.00), They get, Arrives Now. Different currencies: You send, Mid-market rate (1 {A} = {rate} {B}), Margin on the rate None, Fee (0.20%), **Total taken**, **You get**. Before an amount is typed: "Enter an amount to see the result." Rounding: when the person types what they get, the amount sent is rounded up to the next cent and the fee is 0.20% of that; the fee is rounded to the cent.

On **See the rate** with different currencies the journey takes a quote: id `Q-` plus six characters, the rate and the time. With the same currency there is no quote.

**`review`: "Review transfer"**. A card: "You send" (or "Moving") with the big amount, and "You get {amount}" (or "to {account} ••{last}"). For a conversion a box: chip "{n} s left", the rate "1 {A} = {rate} {B}", and "Mid-market rate, no margin. Held for 30 seconds from when you saw it. If it runs out we show a new rate and you confirm again. Nothing is taken until you enter your code." with a button **Get a new rate**. Rows: From, To, You send, Rate (with "(mid-market)"), Fee (0.20%) or Fee, Total taken, You get, Arrives Now, Note. Consent: "I confirm the details are correct" (required, "Tick to confirm."). Button **Confirm and send code**.

If the 30 seconds have passed when the person confirms: `QUOTE_EXPIRED`, a new quote is taken, and the banner reads "The rate moved from {old} to {new}. Check the new amounts and confirm again." The person confirms again. **Get a new rate** does the same on demand and announces "New rate: …".

**Code prompt** (shared screen C): "Authorise converting {amount} to {amount}" or "Authorise moving {amount} to {account}", sub "Code sent to ••• 4410. It only works for this transfer."

**`result`** (terminal). Same currency: title "Money moved", text "{amount} moved from {from} to {to}.", chip "Done · instant". Conversion: title "Converted", text "{amount} became {amount}.". Receipt rows: From, To, You sent, Rate (mid-market, no margin), Fee, Total taken, You received, Rate reference (the `Q-` id), Arrived Now, Note. Buttons **View accounts**, **Move more** (this journey), **Done**. Balances: From drops by Total taken (available and ledger), To rises by You get; the Current account activity gets "To {account}" or "From {account}".

**`locked`, `timeout`, `unavailable`, `failed`**: shared screens C.

#### 4. Sandbox errors

| Code | Message the person sees | Shows on | Button |
|---|---|---|---|
| `SAME_ACCOUNT` | "Choose two different accounts." | `accounts` | Choose account |
| `ACCOUNT_CANNOT_DEBIT` | "You can't send money from this account right now. Choose another account." | `accounts` | Choose account |
| `CURRENCY_NOT_SUPPORTED` | "We can't convert between those currencies yet." | `accounts` | Choose account |
| `INVALID_AMOUNT` | "Enter an amount in the account's currency with at most 2 decimal places." | `amount` | Change amount |
| `INSUFFICIENT_FUNDS` | "There isn't enough money in {account}. Available: …" | `amount` | Change amount |
| `ACCOUNT_NOT_FOUND` | "We can't find that account." | `failed` | Choose account |
| `QUOTE_EXPIRED` | "The rate has expired. A new rate is shown. Check it and confirm again." | `review` | Confirm again / Get a new rate |
| `STEP_UP_FAILED` | "We couldn't confirm this transfer. Nothing was moved. Start again." | `locked` / `failed` | Start again |
| `TIMEOUT` | "We didn't get an answer in time. Check Activity before you try again, so you don't pay twice." | `timeout` | Check Activity |
| `SERVICE_UNAVAILABLE` | S-`SERVICE_UNAVAILABLE` | `unavailable` | Try again |
| `JOURNEY_DISABLED` | "This isn't available at your bank." | on open | Back |

Also `OTP_INVALID`, `OTP_REQUIRED`, `CORE_UNAVAILABLE`, `NOT_SUPPORTED` as in the group rules. The sandbox also has `QUOTE_USED` and `QUOTE_NOT_FOUND` ("This rate was already used. Get a new one." / "We couldn't find that rate. Get a new one."); the prototype does not produce them. `LIMIT_EXCEEDED` is not possible: money between a person's own accounts does not use the daily limit.

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `accounts` | `bank.accounts.list` | none | accounts | none | Existing |
| `quote` | `bank.fx.quote` | `{fromAccountId, toAccountId, amount, direction?}` | `{quoteId, fromAccountId, toAccountId, from{currency, amount}, to{currency, amount}, midRate, rate, fee, feeCurrency, total, expiresAt, ttlSeconds}` (30 s) | `ACCOUNT_NOT_FOUND`, `SAME_CURRENCY`, `CURRENCY_NOT_SUPPORTED`, `INVALID_AMOUNT`, `INSUFFICIENT_FUNDS` | Existing. Today it prices the rate at the mid rate less a 0.5% spread (`fx.ts` `FX_SPREAD`) and takes the fee as 0.2% (`FX_FEE_RATE`); the prototype shows no margin, so the spread must go to 0 (planned change). The `direction` field (type what you get) is planned |
| `convert` | `bank.fx.convert` | `{quoteId}` | `{reference, from{currency, newBalance}, to{currency, newBalance}, quoteId}` | `OTP_REQUIRED`, `CORE_UNAVAILABLE`, `QUOTE_NOT_FOUND`, `QUOTE_USED`, `QUOTE_EXPIRED`, `INSUFFICIENT_FUNDS` | Existing. Money-moving; OTP |
| `transferOwn` | `bank.transfers.own` | `{fromAccountId, toAccountId, amount, note?}` | `{reference, from{newBalance, currency}, to{newBalance, currency}}` | `OTP_REQUIRED`, `CORE_UNAVAILABLE`, `ACCOUNT_NOT_FOUND`, `ACCOUNT_CANNOT_DEBIT`, `SAME_ACCOUNT`, `INVALID_AMOUNT`, `INSUFFICIENT_FUNDS`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned). Money-moving; OTP |
| `otpSend`, `otpVerify` | `bank.otp.send`, `bank.otp.verify` | `{channel}`, `{code}` | `{sent, maskedPhone, channel}`, `{verified}` | `OTP_INVALID` | Existing |

#### 6. Permissions, step-up and limits

`payments.create`; step-up `otp` (a code is asked because the move takes money out of a spendable account; the prompt names the amounts). No daily limit applies; no payee, so no name check and no cooling-off. A frozen account cannot send but may receive. Conversion needs option `allowFx`; the fee needs `fxFee`. Business context: `WRONG_CONTEXT`.

#### 7. Result and links out

Result as above. Receipt (planned): kind "Transfer between your accounts" or "Currency conversion" with from, to, amounts, rate, fee, rate reference, reference. Notification N-20 "{amount} from {from} to {to}. Ref {ref}." (SMS only above USD 1,000 equivalent, planned). Buttons: **View accounts** (Accounts), **Move more** (this journey), **Done**, **Track payment** (planned).

#### 8. Acceptance criteria

- AC-1: A same-currency transfer needs a verified code, moves the exact amount, and both balances change by it with no fee.
- AC-2: A different-currency transfer shows the mid-market rate, "Margin on the rate: None", the 0.20% fee as its own line, the total taken and what the person gets, before any code is asked.
- AC-3: The rate is held 30 seconds with a visible count; after that the person gets a new rate with the old and new values named and must confirm again; the old rate can never be charged.
- AC-4: The amount plus fee can never exceed the available balance; the smallest amount is 1.00.
- AC-5: The person can type either what they send or what they get; the other side is computed and rounded as stated.
- AC-6: Choosing the same account twice, or a frozen account to send from, is refused with the exact message.
- AC-7: With `allowFx` off a currency pair is refused with `CURRENCY_NOT_SUPPORTED`; with `fxFee` off the fee line is 0.00.
- AC-8: A wrong code three times stops the journey and no balance changes.
- AC-9: A timeout tells the person to check Activity and changes no balance; an unavailable service shows the standard message and changes no balance.
- AC-10: The daily limit is untouched by a transfer between own accounts.

#### 9. Scenarios

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-10 | `alex` | none | Current to Savings, 200.00, note "Rainy day", any six digits. Current available 7,902.40; Savings 14,510.00; `bank.limits.get` `usedToday` unchanged. |
| T-2 | AC-2, AC-4 | `alex` | none | Current to Euro, send 500.00. Review shows rate 0.9260, fee 1.00, total taken 501.00, you get EUR 463.00. After code: Current available 7,601.40; Euro 2,613.40. |
| T-3 | AC-3 | `alex`, `now` controllable | none | Get the rate, advance 31 s, confirm: `QUOTE_EXPIRED`, message names old and new rate; no balance change; the next confirm works with the new rate. **Get a new rate** announces the new rate. |
| T-4 | AC-5 | `alex` | none | Current to Euro, "What I get" 463.00: send rounds up to 500.00; fee 1.00. What I get 100.00: the amount sent is 107.9914 rounded up to 108.00, the fee is 0.22 and the total taken is 108.22. |
| T-5 | AC-4 | `alex` | none | Current to Euro, send 8,102.40: total 8,118.60 exceeds available: `INSUFFICIENT_FUNDS` naming both and the fee. 0.50: "The smallest amount is 1.00." |
| T-6 | AC-6 | `alex`, an account marked frozen | none | Current twice: `SAME_ACCOUNT`. Frozen account as From: `ACCOUNT_CANNOT_DEBIT`; as To: allowed. |
| T-7 | AC-7 | `alex`, `allowFx` off / `fxFee` off | none | Current to Euro refused with `CURRENCY_NOT_SUPPORTED`. With only `fxFee` off: fee 0.00, total 500.00. |
| T-8 | AC-8 | `alex` | none | Review, then a wrong code three times (sandbox): `locked`; balances unchanged. |
| T-9 | AC-9 | `alex` | `timeout: ["bank.transfers.own"]`, `latencyMs: 10000` | `timeout` screen with the Activity message; balances unchanged. |
| T-10 | AC-9 | `alex` | `unavailable: ["bank.fx.quote"]` | **See the rate** shows the unavailable screen; nothing changed. |
| T-11 | AC-1 | `alex` with `transferFails` | none | Code accepted, `CORE_UNAVAILABLE`: "We couldn't complete this right now. No money has left your account." |
| T-12 | AC-2 | `alex` | none | Euro to Dirham, send EUR 100.00: rate 3.9654 (mid), fee 0.20, total taken EUR 100.20, you get AED 396.54. |

#### 10. Expected mutation-check survivors

`SAME_CURRENCY` in `bank.fx.quote` survives (the journey never sends equal currencies to the quote). `QUOTE_USED` and `QUOTE_NOT_FOUND` survive unless a scenario replays a quote id; add T-3b to kill them, otherwise list them. The random 0.04% movement on a renewed quote survives (tests assert the old and new values are different and named, not their size). The rounding of the send side for "What I get" is killed by T-4 only if both examples run. Everything else: none expected.

---

### ★ To a BankWorkx customer — `internal-transfer`

Catalog: `internal-transfer`, workspace Personal, category Personal: Payments, core no, a bank can switch it off: yes (through option `type.internal` of `personal-transfer`). Options: none of its own.

Alias of `personal-transfer`: reached with `personal-transfer {type: internal}` (the prototype's "Ways to send money" and `manage-beneficiary` still point at the old slug `internal-transfer`, which is not registered there; they must pass the type instead). The catalog option `type.internal` ("Offer “To a BankWorkx® customer”") switches it off.

What differs from the other types:
- The person finds the customer by mobile number, email, BankWorkx ID or 10-digit account number; the name comes back (result `found`) and the person ticks to confirm. Unknown: `CUSTOMER_NOT_FOUND`.
- One fixed rail, "BankWorkx® transfer": free, arrives in seconds, 24/7, maximum $25,000.00 per payment, reference "Transfer ID" (`BX` + 10 digits). No rail choice, no purpose, no address.
- The daily limit (41,250.00 left) and the 24-hour 500.00 USD new-payee rule apply; sanctions screening applies; a note up to 140 characters replaces the reference.
- Demo values: Taylor Brooks (+1 202 555 0142, `taylor.brooks@example.com`, `taylorb`, 3301123308), Jordan Keller (+1 202 555 0177, `jordan.keller@example.com`, `jkeller`, 3301554412). Full field rules, scenarios and criteria are in `personal-transfer`.

---

### ★ Send money — `personal-transfer`

Catalog: `personal-transfer`, workspace Personal, category Personal: Payments, core no, a bank can switch it off: yes. Options (key, label, default): `type.own` "Offer “Between my accounts”" (on); `type.internal` "Offer “To a BankWorkx® customer”" (on); `type.domestic` "Offer “To another bank in the same region”" (on); `type.intl` "Offer “To another country” (SWIFT)" (on); `region.us` "Region: United States", `region.uk` "Region: United Kingdom", `region.eu` "Region: Europe (SEPA)", `region.ae` "Region: United Arab Emirates", `region.sa` "Region: Saudi Arabia", `region.jo` "Region: Jordan" (all on); one switch per rail, all on: `rail.ach` "Rail: ACH (standard)", `rail.sach` "Rail: Same-day ACH", `rail.rtp` "Rail: Instant (RTP® / FedNow®)", `rail.wire` "Rail: Wire (Fedwire®)", `rail.sct` "Rail: SEPA Credit Transfer", `rail.sinst` "Rail: SEPA Instant", `rail.fps` "Rail: Faster Payments", `rail.chaps` "Rail: CHAPS", `rail.bacs` "Rail: Bacs", `rail.aani` "Rail: Aani instant payment", `rail.uaefts` "Rail: UAEFTS transfer", `rail.sarieI` "Rail: sarie instant", `rail.sarie` "Rail: SARIE transfer", `rail.cliq` "Rail: CliQ instant payment", `rail.jopacc` "Rail: JoPACC transfer", `rail.swift` "Rail: International (SWIFT)"; `allowFx` "Allow currency conversion between my accounts" (on); `nameCheck` "Run the name check (CoP, VoP and others)" (on); `allowLater` "Allow “Later” and repeating payments" (on); `coolingOff` "Apply the 24-hour $500 limit to new payees" (on); `sinstDown` "Demo: SEPA Instant is unavailable" (off); `lateDemo` "Demo: it is 16:30, after same-day cut-offs" (off). Merged journeys: `own-transfer` (also its own entry), `internal-transfer` and `international-transfer` are reached through this journey; see their alias blocks.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `personal-transfer` |
| Purpose | One guided flow, one question per screen, for every kind of transfer from a personal account: (1) between my own accounts, (2) to a BankWorkx® customer, (3) to another bank in the same region (United States, United Kingdom, Europe, UAE, Saudi Arabia, Jordan), (4) to another country over SWIFT (Canada, India, Japan, Australia, Switzerland, Singapore, Mexico). The fields, the name check, the rails and the extra information asked all follow the type and the region. A new payee can be saved. |
| Release / workspace | 1 / Personal |
| Status | Existing, rebuilt. Built in the prototype (`design/bankworkx-r1/src/journeys/32-personal-transfer.js`); the field table is the global `TXF` in that file (adding a country or changing a rule is a data change). Research: `research/send-money-fields.md`. It replaces the old five-step wizard and takes over `internal-transfer` and `international-transfer`. The Meezan fixture `fixtures/local-transfer.ts` (slug `fund-transfer-local`) is the starting pattern for the account, review, code and result screens; the slug stays an alias for Meezan. |
| Channels | Web and mobile |
| Starting pattern | `fixtures/local-transfer.ts` (account, review, consent, code, result); everything else is new |
| Who may use it | `payments.create` |
| Shared reference | `09-payment-rails.md`: rails (section 2), payee fields (3), name check (4), amount and conversion (5), charges (6), purpose and reference (7), when (8), limits and strong authentication (9), compliance (10), receipts (11), codes (12). This journey names them, lists screen-level fields and copy, and gives the master field table (section 3.1); where the prototype and 09 differ, this file follows the prototype (see "Differences from 09" at the end of section 3). |

**Sandbox demo values (prototype).** Accounts: Current account ••4410 (balance 8,240.18, available 8,102.40 USD), Savings ••7720 (14,310.00 USD), Euro account ••3302 (EUR 2,150.40), Dirham account ••9981 (AED 5,000.00). Only USD accounts can pay a third party; all four can be used for "Between my accounts". Saved payees: Maya Chen (US, ABA 021000021, account 123456789), Lena Fischer (Europe, `DE89 3704 0044 0532 0130 00`), James Whitfield (UK, 20-00-00, 55779911), Omar Haddad (UAE, `AE07 0331 2345 6789 0123 456`). Daily limit left 41,250.00 USD (fixed); new-payee allowance 500.00 USD for 24 hours; code prompt: any six digits are accepted in the prototype (wrong-code lockout is a sandbox rule, section 6). Rates (1 USD =): EUR 0.926, GBP 0.781, AED 3.672, SAR 3.75, JOD 0.709, CAD 1.36, INR 83.2, JPY 151, AUD 1.52, CHF 0.88, SGD 1.34, MXN 17.1. The name-check registry (synthetic): Maya Chen, Priya Raman (`021000021` / `987654321`), Lena Fischer, Camille Dubois (`FR14 2004 1010 0505 0001 3M02 606`), James Whitfield (`20000055779911`, a personal account), Omar Haddad, Faisal Al-Harbi (`SA03 8000 0000 6080 1016 7519`), Rania Haddad (`JO94 CBJO 0010 0000 0000 0131 0003 02`). BankWorkx® customer directory: Taylor Brooks (mobile +1 202 555 0142, email `taylor.brooks@example.com`, ID `taylorb`, account 3301123308), Jordan Keller (+1 202 555 0177, `jordan.keller@example.com`, `jkeller`, 3301554412). Alias directory: CliQ alias `rania.h` and mobile 0795550142 give Rania Haddad; Aani mobile 0501234567 gives Omar Haddad. A payee named "Test Sanctions" is held for review. SWIFT sample payees (button **Fill with a sample payee**): Noah Tremblay (Canada, BIC `ROYCCAT2`, transit `00012-003`, account 1234567), Anil Sharma (India, `HDFCINBB`, IFSC `HDFC0000001`, 50100123456789), Aiko Tanaka (Japan, `BOTKJPJT`, 1234567890), Chloe Nguyen (Australia, `CTBAAU2S`, BSB `062-000`, 12345678), Lukas Meier (Switzerland, `UBSWCHZH`, IBAN `CH93 0076 2011 6238 5295 7`), Wei Ling Tan (Singapore, `DBSSSGSG`, 0123456789), Sofia Ramirez (Mexico, `BMSXMXMM`, CLABE 032180000118359719). Sample payees for the other regions: Priya Raman (US), James Whitfield (UK), Camille Dubois (Europe), Omar Haddad (UAE), Faisal Al-Harbi (Saudi Arabia), Rania Haddad (Jordan).

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Home › + Send money | none | `payments.create` |
| Payments › Send money | none | `payments.create` |
| Payments › Ways to send money › New payee (`transfer-types`) | `{type, region, rail}` | `payments.create` |
| Accounts › detail › Transfer from this account | `{accountId}` (prefills From) | `payments.create` |
| Payments › Beneficiaries › row › Send (saved payee) | `{ben}` (a saved payee id) | `payments.create` |
| `manage-beneficiary` result › Send money | `{ben}` (prototype passes `payeeId`; see contradictions) | `payments.create` |
| Payments › tracker › payment › Repeat payment | `{paymentId}` (planned) | `payments.create` |

Launch values the prototype reads: `type` (`own`, `internal`, `domestic`, `international`; `intl` is accepted for `international`), `region` (`us`, `uk`, `eu`, `ae`, `sa`, `jo`, or `me` which means UAE unless a rail or `country` names another), `country` (`ca`, `in`, `jp`, `au`, `ch`, `sg`, `mx`), `rail` (a rail id; sets the region; `swift` sets type `international`), `ben` (a saved payee id: jumps straight to the amount screen with the payee chosen), `accountId`, `toId`, `amount`. Values that are given skip the screen that would ask for them. With `type: own` or `internal` the "where" screen is skipped.

#### 3. Screens

`stepper` (planned): type, where, payee, check, amount, review, code. One title, one short line, headed sections and one button per screen. The person can change the kind of transfer at any point by going back.

**`type`: "What kind of transfer?"** (skipped when `type`, `region` or `ben` was passed). Intro "Choose where the money is going. You can change this at any point." Blocks: `cards`.

| Field | Block | Required | Validation | Error message |
|---|---|---|---|---|
| Kind | `cards` with up to four cards (a card is hidden when its type option is off): "Between my accounts" (Move money to your own savings or other accounts. Instant.), "To a BankWorkx® customer" (Find them by mobile number, email, BankWorkx ID or account number. Free and instant.), "To another bank in the same region" (United States, United Kingdom, Europe, UAE, Saudi Arabia or Jordan.), "To another country" (Over SWIFT, with a tracking number (UETR). Canada, India, Japan, Australia and more.) | Yes | One chosen | "Choose a kind of transfer." |

Empty (every type off): "Nothing to send with" / "Your bank has switched off every kind of transfer here." Button **Continue**.

**`where`: "Where is it going?"** (domestic and international only). Intro "Choose the region. It decides which details we ask for." (domestic) or "Choose the country. We show the currency they will receive." (international).

| Field | Block | Required | Validation | Error message |
|---|---|---|---|---|
| Region (domestic) | `cards`: one per region whose option is on: United States, United Kingdom, Europe (SEPA), United Arab Emirates, Saudi Arabia, Jordan, each with "Pay in {currency}. {rail names}." | Yes | One chosen | "Choose a region." |
| Country (international) | `select` "Country", placeholder "Choose a country", options "Canada (CAD)", "India (INR)", "Japan (JPY)", "Australia (AUD)", "Switzerland (CHF)", "Singapore (SGD)", "Mexico (MXN)" | Yes | One chosen | "Choose a country." |

International note (`note`): "Payments go over SWIFT. Each one gets a tracking number (UETR) so you and the receiving bank can follow it. It usually arrives in 1 to 3 working days." Button **Continue**.

**`payee`: "Who are you paying?"** (title "Which accounts?" for between my accounts). Skipped when `ben` was passed. Intro "Choose someone you have paid before, or add a new payee." (own: "Money between your own accounts arrives straight away."). Button **Continue**, busy text "Checking the payee…" (about 0.65 s) for a new payee.

For a type other than "own", a `cards` field "Choose a payee" lists the saved payees of this type and region (each with name or "nickname (name)", the masked account, and a chip: Verified, Saved or New) and a last card "Add a new payee" ("You enter their details once and we can save them.") Required, message "Choose a payee or add a new one." When there are no saved payees, "Add a new payee" is chosen for the person. Choosing "Add a new payee" shows the form for the type and region, with a **Fill with a sample payee** button (demo). The form fields are generated from the master table in section 3.1.

For "own": **From** and **To** (see the table) and a **Swap accounts** button; when the currencies differ an info box "These accounts use different currencies. We convert at the mid-market rate with no margin. Today that is 1 {A} = {rate} {B}. A 0.20% fee is shown separately."

On **Continue** with a new payee the journey looks the payee up and runs the name check (`resolve`): a BankWorkx® customer by identifier; a mobile or alias payment (UAE, Jordan) in the directory; a duplicate against the saved list; then the region's name check. Errors: `CUSTOMER_NOT_FOUND`, `ALIAS_NOT_FOUND`, `BENEFICIARY_EXISTS`.

**`check`: "Check the payee"** (new payees only, not "own"). Intro "Make sure the money goes to the right person." Shows a note with the result, then a card "Who you are paying" (Name, Account, Country).

| Result | Colour | Text | Can the person continue? |
|---|---|---|---|
| `match` | green | "{label}: the name matches. The account is held by {registered name}. It is safe to continue." | Yes |
| `found` (BankWorkx® customer, alias or mobile) | neutral | "We found {name}. {masked account}. Check this is the person you mean. Their details come from the bank's own records (or the {country} alias directory)." | Only after the tick |
| `close` | amber | "{label}: the name is close, but not exact. The account is held by {registered name}. You typed {typed name}. Check with them before you send money." Button **Use “{registered name}”** (replaces the name and re-checks) | Only after the tick |
| `type` (UK only) | amber | "{label}: wrong type of account. The name matches {name}, but that is a {personal or business} account and you chose {the other}. Sending to the wrong type can fail or be returned." Button **Switch to {type}** | Only after the tick |
| `none` | red | "{label}: the name doesn't match. The account is held by someone else. If you go on, the money may go to the wrong person and might not be recoverable. (NAME_MISMATCH)" | Only after the tick |
| `na` | amber | "We couldn't check this name. {US banks don't share account names with us for this account. / Name checks are usually not available over SWIFT. / The receiving bank doesn't support name checks for this account.} Only continue if you trust {name}." | Only after the tick |

Labels: United States "Account name check where the bank can see the name"; United Kingdom "Confirmation of Payee"; Europe "Verification of Payee"; UAE, Saudi Arabia, Jordan "Name check"; BankWorkx® customer "BankWorkx® customer record".

| Field | Block | Required | Validation | Error message |
|---|---|---|---|---|
| I understand and want to continue | `check` | Yes, unless the result is `match` | Ticked | "Tick to continue." / `PAYEE_NOT_CHECKED` "Check the payee before you continue." |
| Save this payee for next time | `check` | No | default on | none |

When option `nameCheck` is off, or the type is international, the result is `na`. A tick on a non-matching result is recorded on the payment and shown on the review.

**`amount`: "How much, how fast?"** Button **Review**, busy text "Getting your quote…" (about 0.6 s). Intro "Type what they receive. You see the cost as you type." (own: "Type an amount. You see the result before you confirm."). A card at the top shows the payee (initial, name, country and masked account, chip Verified or Saved).

For "own":

| Field | Block | Required | Validation | Error message |
|---|---|---|---|---|
| I want to enter | `chips` "What I send ({A})" / "What I get ({B})" (only if the currencies differ; default send) | No | One of two | none |
| Amount | `amountInput` in the entered currency; hint "Entered in {currency}. Available in {account}: {balance}." | Yes | At least 1.00, 2 decimals; amount plus fee at most the available balance | "The smallest amount is 1.00. (INVALID_AMOUNT)" / "There isn't enough money in {account}. Available: {balance}, and the fee is {fee}. (INSUFFICIENT_FUNDS)" |
| Note to yourself | `textInput`, placeholder "Optional", same currency only | No | 35 characters | none |

Result summary, same currency: You send, Fee (0.00), They get, Arrives Now. Different currencies: You send, Mid-market rate (1 {A} = {rate} {B}), Margin on the rate None, Fee (0.20%), Total taken, You get. Details in `own-transfer`.

For every other type:

| Field | Block | Required | Validation | Error message |
|---|---|---|---|---|
| From account | `select`: USD accounts only, "{name} ••{last} · {available} available" | Yes | Has enough: total at most available | `INSUFFICIENT_FUNDS` "Not enough in the account: you'd pay {total} but {available} is available." |
| They receive ({currency}) / Amount (BankWorkx®) | `amountInput` in the payee's currency, placeholder "0.00"; hint "You type what {first name} receives, in {currency}. Available: {balance}." | Yes | Above zero; yen whole numbers only; within the chosen rail's maximum; within balance; within the daily limit (41,250.00 USD left); a new payee at most 500.00 USD | `INVALID_AMOUNT` "Enter an amount above zero." / "Yen has no decimals. Enter a whole number." / `RAIL_LIMIT` "That's over the {rail} limit of {limit}. Choose another way to send it." / "That is over the limit of every way to send it here. Try a smaller amount." / `INSUFFICIENT_FUNDS` / `DAILY_LIMIT_EXCEEDED` "That's over your remaining daily limit of $41,250.00." / `BENEFICIARY_COOLING_OFF` "That's over the $500.00 you can send to a new payee in the first 24 hours." |
| Live summary | `kv` rows | n/a | n/a | Foreign currency: They receive, Rate "1 USD = {rate} {CUR} · held 60 s", Converted; then Fee, **You pay**, Arrives (or Scheduled for {date}); "New payee allowance: $500.00 in the first 24 hours"; "Daily limit left: $41,250.00" |
| How fast? | `cards` list of the region's rails (not for BankWorkx®, which has one): name, speed, limit, cut-off, fee ("Free" or $), an "Instant" chip. A rail is dimmed and cannot be chosen when over its limit ("over the limit of {limit}"), when its option is off ("Not offered by your bank"), when SEPA Instant is demo-down ("Not available right now"), or for an alias payment on a non-instant rail ("Alias payments use the instant rail"). The default is the first rail that fits | Yes | A rail that fits | `RAIL_NOT_AVAILABLE` "{rail} isn't available right now. Choose another way to send it." when no rail is left |
| Street and number, Town or city, Postcode | `textInput` (street 70, city 35, postcode 16) | Street and city yes; postcode no | Letters, numbers, spaces and . , # ' & ( ) / - | `ADDRESS_REQUIRED` "This way to send needs the payee's address." Shown only when the rail needs an address and the saved payee has none |
| Purpose of payment | `select` of seven purposes, each with a code: Family support (FAM), Goods or services (GDS), Salary (SAL), Rent (RNT), Education (EDU), Savings or investment (INV), Other (OTH); hint "Sent with the payment for sanctions screening." | Yes where asked | One chosen | `PURPOSE_REQUIRED` "Choose a purpose for this payment." |
| Your relationship to them | `select`: Myself, Family member, Friend, My employer, Supplier or business, Landlord, School or university, Other; hint "Banks must collect this for payments abroad." | Yes, international only | One chosen | "Choose how you know them." |
| Where does the money come from? | `select`: Salary, Savings, Sale of property or assets, Business income, Gift, Loan, Other; hint "We ask this for payments of $10,000 or more." | Yes, international and 10,000 USD or more | One chosen | "Choose a source of funds." |
| Who pays the bank charges? | `chips`: Shared (SHA), I pay all (+$15) (OUR), They pay (BEN); hint by choice: "You pay our fee; they may pay their bank's fee." / "They receive the full amount. Extra $15.00 from you." / "You pay the same as Shared; their bank may take its charges from what arrives." | No (default Shared) | One of three | none |
| Reference (label by payee: see below) | `textInput`, placeholder "Optional" | No | Within the maximum; allowed characters letters, digits, space and `. , ' - / ( ) + : ?` | `REFERENCE_TOO_LONG` "Use {max} characters or fewer for this payee's bank." / `INVALID_REFERENCE` "Use letters, numbers, spaces and . , ' - / ( ) + : ? only." |
| When | `chips` Now, Later (shown when option `allowLater`) | No | none | none |
| Send on | date list, 30 days ahead, business days only; weekend skipped per country (Saturday and Sunday for the US, UK, Europe and UAE; Friday and Saturday for Saudi Arabia and Jordan) | Yes, when Later | A listed date | "Choose a date." hint "Weekends and bank holidays are skipped. It is checked again on the day." |
| Repeat | `chips` Doesn't repeat, Every week, Every month | No | none | none |

Purpose of payment is asked for the UAE, Saudi Arabia, Jordan and international, and for any rail that needs it: Fedwire, CHAPS, Aani, UAEFTS, sarie, SARIE, CliQ, JoPACC, SWIFT. An address is asked (when the payee has none) for Fedwire, CHAPS, UAEFTS, SARIE, JoPACC and SWIFT. Reference label and limit: United Kingdom "Reference", 18; United States on a non-wire rail "Memo", 80; United States wire "Message to the beneficiary", 140; international "Details of payment", 140; BankWorkx® customer "Note", 140; everything else "Payment details", 140.

When the total, rail and rules check out, **Review** stores the quote time. Rail unavailable, rule breaches, missing purpose and missing address stop the step with a banner carrying the code.

**`review`: "Review"**. Intro "Check everything. Nothing is taken until you enter your code." Own transfer: big amount ("You send" or "Moving"), the payee line, and for conversion the rate with a countdown chip "{n} s left" (30 s) and "Mid-market rate, held for 30 seconds. If it runs out we show a new rate." Other types: big amount "{amount in their currency}" with "You're sending" (or "Scheduled for {date}"), "to {name}", chips Verified or Saved and the rail name. Notes, when they apply: foreign currency "The rate is held for 60 seconds from when you got your quote. If it runs out, we show the new amount before anything is taken."; new payee "This is a new payee. For your security you can send up to $500.00 in their first 24 hours."; late demo "Goes out tomorrow: after the {cut-off} cut-off."; non-matching name check "You chose to continue after the name check did not match. We record this on the payment."

Row groups: **From** (account, mask). **To**: Name, Account, Country, Bank (the BIC and bank name for SWIFT; "Bank not shown" when unknown), Address, Intermediary bank, National ID (last four digits only). **Amount and fees**: They receive, Rate, Converted, Fee, Total taken (own: You send, Rate, Fee, Total taken, You get). **Delivery**: Sent by, Arrives (or Scheduled for), Repeats, Purpose (with code), Relationship, Source of funds, Reference (with its label), Charges, Tracking "A UETR is issued when it is sent" (SWIFT), Payee check (Verified, or Not checked). Then `consent`: "I confirm the details are correct" (required; "Tick to confirm."), and the small print "We screen payments against sanctions lists. Some may be held for a short review. Your code names the amount and the payee, and only works for this payment." Button **Confirm and send code**. A rate older than the hold: `QUOTE_EXPIRED`, a fresh quote is taken and the person confirms again (own: "The rate moved from {old} to {new}. Check the new amounts and confirm again.").

**Code prompt** (shared screen C). Title "Authorise {amount} to {name}" (own: "Authorise moving {amount} to {account}", or "Authorise converting {amount} to {amount}"), sub "Code sent to ••• 4410. It only works for this payment. Changing the amount or payee voids it." Six digits, three tries.

**`result`** (terminal), by outcome:

| Outcome | Title | Status chip | Text |
|---|---|---|---|
| Own transfer | "Money moved" (same currency) or "Converted" | "Done · instant" | "{amount} moved from {from} to {to}." / "{amount} became {amount}." |
| Instant rail, now | "Sent" | "Delivered in seconds" | "{amount} to {name}" |
| Other rail, now | "On its way" | "Arrives {date}" | "{amount} to {name}" |
| Later | "Scheduled" | "Scheduled for {date}" | "{amount} to {name}" |
| Screening hit | "Held for review" (amber) | "Held for review" | "We're checking this payment and will tell you within one working day. You don't need to do anything. (PAYMENT_HELD)" |

Receipt rows (not own): Sent by, They receive, Rate, Fee, You pay, Arrives (or First payment), the rail's own reference with its label (09 section 2), Payee check (Verified or "Saved, not verified"), Charges, Purpose, Reference. Own: From, To, You sent, Rate, Fee, You received, Arrived Now. Buttons: **Track payment** (or **See scheduled payments**), **Send another**, **Done**. The sender's available balance drops by You pay at once; the ledger balance drops too unless the payment is held (held: reserved, not debited). A saved payee is written to the list when "Save this payee" was ticked.

**`locked`, `timeout`, `unavailable`, `failed`**: shared screens C.

##### 3.1 Master field table: payee form by type and region

R means required. "Shown" fields are conditional. Messages are the person-facing text; the prototype adds the code in brackets after it for testers. Address fields (street 70, town 35, state 2, ZIP or postcode) accept letters, numbers, spaces and `. , ' & ( ) / -` (also `#` for the street), otherwise "Use letters, numbers, spaces and . , # - / only."

| Type / region | Field (key) | R | Rule | Message |
|---|---|---|---|---|
| Between my accounts | From (`from`) | R | Own account that is not frozen | "You can't send money from this account right now. Choose another account." (`ACCOUNT_CANNOT_DEBIT`) |
| Between my accounts | To (`toAcc`) | R | Own account, not the same as From; if currencies differ, option `allowFx` must be on | "Choose two different accounts." (`SAME_ACCOUNT`) / "We can't convert between {A} and {B} yet." (`CURRENCY_NOT_SUPPORTED`) |
| BankWorkx® customer | Find them by (`by`) | no | Mobile number (default), Email, BankWorkx ID, Account number | none |
| BankWorkx® customer | Their details (`look`, 60) | R | Mobile: 8 to 20 digits, spaces, dashes, brackets, optional +. Email: a full address. ID: 3 to 24 letters, numbers, dots, dashes. Account: 10 digits. The customer must exist | "Enter the mobile number with its country code." (`INVALID_MOBILE`) / "Enter a full email address." (`INVALID_EMAIL`) / "A BankWorkx ID has 3 to 24 letters, numbers, dots or dashes." (`INVALID_ID`) / "A BankWorkx® account number has 10 digits." (`INVALID_ACCOUNT`) / "We can't find a BankWorkx® customer with those details. Check them and try again." (`CUSTOMER_NOT_FOUND`) |
| United States | Full name on the account (`nm`, 70) | R | 2 or more characters; letters, numbers, spaces and . , ' & ( ) / - | "Enter the name on the account." (`PAYEE_NAME_REQUIRED`) / "Use letters, numbers, spaces and . , ' & ( ) / - only." (`INVALID_NAME`) |
| United States | Account type (`atype`) | no | Checking (default) or Savings | none (hint: ACH files carry the account type; a wrong one can return the payment) |
| United States | Routing number, ABA (`rout`, 9) | R | 9 digits and the ABA checksum | "That routing number isn't valid. Check the 9 digits." (`INVALID_ROUTING`) |
| United States | Account number (`acct`, 17) | R | 4 to 17 digits | "A US account number has 4 to 17 digits." (`INVALID_ACCOUNT`) |
| United States | Street, City, State, ZIP (`addr1`, `city`, `state`, `post`) | no (a wire asks for street and city on the amount screen) | State: 2 letters. ZIP: 5 digits or 5+4 | "Use the 2-letter state code, like NY." / "Use a 5-digit ZIP code, like 10001." |
| United Kingdom | Full name (`nm`) | R | as above | as above |
| United Kingdom | Type of account (`ptype`) | no | Personal (default) or Business; compared against the registry by Confirmation of Payee | none |
| United Kingdom | Sort code (`sort`, 8) | R | 6 digits, dashes optional | "A sort code has 6 digits, like 20-00-00." (`INVALID_SORT_CODE`) |
| United Kingdom | Account number (`acct`, 8) | R | 8 digits | "A UK account number has 8 digits." (`INVALID_ACCOUNT`) |
| United Kingdom | Street, Town, Postcode | no (CHAPS asks on the amount screen) | address characters | as above |
| Europe (SEPA) | Full name (`nm`) | R | as above | as above |
| Europe (SEPA) | IBAN (`iban`, 42) | R | Mod-97 check passes; length matches the country; the country is in the SEPA list (DE, FR, ES, IT, NL, IE, BE, AT, PT, FI, LU, GR); spaces are fine | "That IBAN doesn't look right. Check each character." (`INVALID_IBAN`) / "That IBAN isn't in the SEPA area. Use “To another country”." (`NOT_SEPA`) |
| Europe (SEPA) | Street, Town, Postcode | no | if sent: town, country and up to two address lines | address characters |
| UAE | How do you want to pay them? (`method`) | no | IBAN (default) or Mobile number (Aani) | none |
| UAE | Full name (`nm`), shown for IBAN | R | as above | as above |
| UAE | IBAN (`iban`), shown for IBAN | R | Valid IBAN; starts with AE; 23 characters | "That IBAN starts with {cc}, but you chose United Arab Emirates." (`COUNTRY_MISMATCH`), else `INVALID_IBAN` |
| UAE | UAE mobile number (`look`), shown for mobile | R | `+971`, `971` or `0` then 5 and 8 digits; spaces and dashes ignored; the alias directory must know it | "Enter a UAE mobile number, like 050 123 4567." (`INVALID_MOBILE`) / "We can't find an account for that alias or mobile number. Check it, or pay by IBAN." (`ALIAS_NOT_FOUND`) |
| UAE | City (`city`, 35) | no (UAEFTS asks for street and city on the amount screen) | address characters | as above |
| Saudi Arabia | Full name (`nm`) | R | as above | as above |
| Saudi Arabia | IBAN (`iban`) | R | Valid IBAN; starts with SA; 24 characters | `COUNTRY_MISMATCH` / `INVALID_IBAN` |
| Saudi Arabia | National ID or Iqama number (`idno`, 10) | no | 10 digits | "A national ID or Iqama number has 10 digits." (`INVALID_ID`) |
| Saudi Arabia | City | no (SARIE asks on the amount screen) | address characters | as above |
| Jordan | How do you want to pay them? (`method`) | no | IBAN (default), CliQ alias, Mobile number | none |
| Jordan | Full name (`nm`), shown for IBAN | R | as above | as above |
| Jordan | IBAN (`iban`), shown for IBAN | R | Valid IBAN; starts with JO; 30 characters | `COUNTRY_MISMATCH` / `INVALID_IBAN` |
| Jordan | CliQ alias or mobile number (`look`, 30), shown for alias or mobile | R | Alias: 3 to 30 letters, numbers, dots, dashes. Mobile: `+962`, `962` or `0` then 7, then 7, 8 or 9, then 7 digits. Must be in the alias directory | "An alias has 3 to 30 letters, numbers, dots or dashes." (`INVALID_ALIAS`) / "Enter a Jordan mobile number, like 079 555 0142." (`INVALID_MOBILE`) / `ALIAS_NOT_FOUND` |
| Jordan | City | no (JoPACC asks on the amount screen) | address characters | as above |
| International (SWIFT) | Full name (`nm`) | R | as above (a company uses its registered name) | as above |
| International (SWIFT) | Who is it? (`bt`) | no | A person (default) or A company | none |
| International (SWIFT) | Street and number (`addr1`), Town or city (`city`) | R | address characters | "This is required." / address message |
| International (SWIFT) | Postcode (`post`) | no | address characters | as above |
| International (SWIFT) | Bank name (`bname`, 70) | R | address characters | "This is required." |
| International (SWIFT) | SWIFT / BIC (`bic`, 11) | R | 8 or 11 characters (4 letters, 2 letters, 2 letters or digits, optional 3); the 5th and 6th letters must equal the chosen country | "A SWIFT/BIC has 8 or 11 letters and numbers." (`INVALID_BIC`) / "That BIC belongs to a bank in another country." (`COUNTRY_MISMATCH`) |
| International (SWIFT) | Local bank code (`local`, 14), by country | R in Canada, India, Australia | Canada: institution and transit `00012-003` (5 digits, optional dash, 3 digits). India: IFSC, 4 letters, a zero, 6 letters or numbers. Australia: BSB `062-000`. None for Japan, Switzerland, Singapore, Mexico | "Use the 5-digit transit number and 3-digit institution number, like 00012-003." / "An IFSC has 11 characters: 4 letters, a zero, then 6 letters or numbers." / "A BSB has 6 digits, like 062-000." (all `INVALID_BANK_CODE`) |
| International (SWIFT) | IBAN (`iban`, 42), Switzerland only | R | Valid IBAN, 21 characters, starts with CH | "That IBAN doesn't look right for Switzerland." (`INVALID_IBAN`) |
| International (SWIFT) | Account number (`acct`, 34), every other country | R | 6 to 34 letters, digits, spaces, dashes; Mexico: CLABE, 18 digits (label "CLABE account number") | "That account number looks too short or too long." (`INVALID_ACCOUNT`) / "A CLABE has 18 digits." (`INVALID_ACCOUNT`) |
| International (SWIFT) | Their bank uses an intermediary bank (`hasInt`) | no | switch, off by default | none (sub-line: only if the person told you; most payments don't need one) |
| International (SWIFT) | Intermediary bank BIC (`interbic`, 11) | R when the switch is on | 8 or 11 characters | "A SWIFT/BIC has 8 or 11 letters and numbers." (`INVALID_BIC`) |

Required counts from the table: own 2 of 2, BankWorkx® customer 1 of 2, US 3 of 8, UK 3 of 7, Europe 2 of 5, UAE 3 of 5 (one of IBAN or mobile), Saudi Arabia 2 of 4, Jordan 3 of 5, SWIFT 9 of 12 (counting only the fields shown for the country).

What each region asks on top, once the rail is known (amount screen): see the table above (purpose, address, reference, charges, relationship, source of funds).

**Differences from 09** (this file follows the prototype): (1) one journey with four types replaces the two-journey split of 09 section 1; (2) SWIFT countries are seven (09 lists four); (3) the name check has two more outcomes, `type` (UK account type mismatch) and `found` (identifier or alias lookup); (4) purpose is also required for Fedwire and CHAPS wires and for every instant and same-day Middle East rail, and an address is required for Fedwire, CHAPS, UAEFTS, SARIE, JoPACC and SWIFT (09 section 7 does not name wires); (5) the SWIFT payee form adds person or company, postal address, bank name, local bank codes, IBAN for Switzerland, CLABE for Mexico and an optional intermediary bank; the amount screen adds relationship and source of funds from 10,000 USD; (6) CliQ alias and Aani mobile payments (09 "planned extras") exist and force the instant rail; (7) BankWorkx® customers are found by mobile, email, ID or account number; (8) the code is shown in brackets after each message in the prototype; (9) a held payment reserves the money (09 is silent); (10) the daily-limit and balance checks come in the order: rail limit, balance, daily limit, new payee, so the daily limit cannot be reached with the demo balances.

#### 4. Sandbox errors

| Code | Message the person sees | Shows on | Button |
|---|---|---|---|
| `PAYEE_NAME_REQUIRED` | "Enter the name on the account." | `payee` field | fix the field |
| `INVALID_NAME` | "Use letters, numbers and spaces in the name." | `payee` field | fix the field |
| `INVALID_IBAN` | "That IBAN doesn't look right. Check each character." | `payee` field | fix the field |
| `NOT_SEPA` | "That IBAN isn't in the SEPA area. Use “To another country”." | `payee` field | fix the field |
| `COUNTRY_MISMATCH` | "That doesn't match the country you chose." (field text names both countries) | `payee` field | fix the field |
| `INVALID_ROUTING` | "That routing number isn't valid. Check the 9 digits." | `payee` field | fix the field |
| `INVALID_SORT_CODE` | "A sort code has 6 digits, like 20-00-00." | `payee` field | fix the field |
| `INVALID_ACCOUNT` | "That account number doesn't look right." | `payee` field | fix the field |
| `INVALID_BIC` | "A SWIFT/BIC has 8 or 11 letters and numbers." | `payee` field | fix the field |
| `INVALID_BANK_CODE` | "That bank code doesn't look right." | `payee` field | fix the field |
| `INVALID_MOBILE` | "That mobile number doesn't look right." | `payee` field | fix the field |
| `INVALID_EMAIL`, `INVALID_ID`, `INVALID_ALIAS` | field texts in the master table | `payee` field | fix the field |
| `CUSTOMER_NOT_FOUND` | "We can't find a BankWorkx® customer with those details. Check them and try again." | `payee` banner | Change details |
| `ALIAS_NOT_FOUND` | "We can't find an account for that alias or mobile number. Check it, or pay by IBAN." | `payee` banner | Change details |
| `BENEFICIARY_EXISTS` | "You've already saved this payee. Choose them from your saved payees." | `payee` banner | Choose payee |
| `PAYEE_NOT_CHECKED` | "Check the payee before you continue." | `check` | tick the box |
| `NAME_MISMATCH` | "The name doesn't match the account holder." | `check` note | continue only after the tick |
| `RAIL_NOT_AVAILABLE` | "That way to send isn't available right now. Choose another." | `amount` | Change rail |
| `RAIL_LIMIT` | "That is over the limit for this way to send. Choose another or send less." | `amount` | Change rail |
| `INSUFFICIENT_FUNDS` | "There isn't enough money in the account." (field text names both numbers) | `amount` | Change amount |
| `DAILY_LIMIT_EXCEEDED` | "That is over your remaining daily limit." | `amount` | Change amount |
| `BENEFICIARY_COOLING_OFF` | "New payees can receive up to $500.00 in their first 24 hours." | `amount` | Change amount |
| `PURPOSE_REQUIRED` | "Choose a purpose for this payment." | `amount` | Edit |
| `ADDRESS_REQUIRED` | "This way to send needs the payee's address." | `amount` | Edit |
| `REFERENCE_TOO_LONG` | "That reference is too long for the payee's bank." | `amount` field | fix the field |
| `INVALID_REFERENCE` | "That reference has characters the bank can't send." | `amount` field | fix the field |
| `INVALID_AMOUNT` | "Enter a valid amount." | `amount` | Change amount |
| `SAME_ACCOUNT` | "Choose two different accounts." | `payee` (own) | Choose account |
| `ACCOUNT_CANNOT_DEBIT` | "You can't send money from this account right now." | `payee` (own) | Choose account |
| `CURRENCY_NOT_SUPPORTED` | "We can't convert between those currencies yet." | `payee` (own) | Choose account |
| `QUOTE_EXPIRED` | "The exchange rate changed. Check the new amount and confirm again." | `review` | Confirm again |
| `STEP_UP_FAILED` | "We couldn't confirm this payment. Nothing was sent. Start again." | `locked` / `failed` | Start again |
| `PAYMENT_HELD` | "We're checking this payment and will tell you within one working day." | `result` (amber) | Back to Payments |
| `TIMEOUT` | "We didn't get an answer in time. Check Activity before you try again, so you don't pay twice." | `timeout` | Check Activity |
| `SERVICE_UNAVAILABLE` | "We couldn't reach the bank. Nothing was sent." | `unavailable` | Try again |
| `JOURNEY_DISABLED` | "This isn't available at your bank." | on open | Back |
| `PAYMENT_RETURNED` (planned) | 09 section 12 | notification, tracker | View payment |

Also from the shared screens: `OTP_INVALID`, `OTP_REQUIRED`, `ACCOUNT_NOT_FOUND`, `CORE_UNAVAILABLE`, `NOT_SUPPORTED` as in the Rules at the top of this group (S-codes).

#### 5. Adapters

Prototype: no adapter is called; the rails, fees, rates, registry and directories are constants in `32-personal-transfer.js` and `90-payflow.js`, and the engine simulates the calls (busy text and delay) and the `TIMEOUT` and `SERVICE_UNAVAILABLE` conditions. The sandbox adapters below carry the same contract.

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `accounts` | `bank.accounts.list` | none | accounts | none | Existing |
| `payees` | `bank.beneficiaries.list` | none | map with `ageHours`; planned adds `kind`, `region`, `country`, `currency`, `checkResult`, `maskedAccount`, address | none | Existing, extended |
| `limits` | `bank.limits.get` | `{currency?}` | `{daily, usedToday}` | `LIMIT_NOT_SET` | Existing |
| `lookup` | `bank.payees.lookup` | `{by, value}` or `{region, method, value}` | `{name, maskedAccount}` | `CUSTOMER_NOT_FOUND`, `ALIAS_NOT_FOUND`, `BENEFICIARY_EXISTS` | (planned). Not money-moving; no OTP |
| `validate` | `bank.payees.validate` | `{region, country?, fields…}` | `{ok, fieldErrors, bankName?}` | the field codes in section 4 | (planned, 09 section 13) |
| `check` | `bank.payees.check` | `{region, name, account key, accountType?}` | `{result: "match"\|"close"\|"none"\|"na"\|"type"\|"found", registeredName?, label}` | `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned) |
| `save` | `bank.payees.save` | `{type, region, fields…, checkResult, acknowledged}` | `{payeeId, addedAt, coolingOffUntil}` | the validate codes, `PAYEE_NOT_CHECKED`, `BENEFICIARY_EXISTS` | (planned) |
| `quote` | `bank.payments.quote` | `{fromAccountId, payee or fields, receiveAmount, railId?, when?, chargeBearer?, purpose?}` | `{quoteId, railId, rails[{id, fits, available, reason?}], rate, converted, fee, total, arrives, cutoffNote?, expiresAt (60 s)}` | `INVALID_AMOUNT`, `CURRENCY_NOT_SUPPORTED`, `RAIL_LIMIT`, `RAIL_NOT_AVAILABLE`, `INSUFFICIENT_FUNDS`, `DAILY_LIMIT_EXCEEDED`, `BENEFICIARY_COOLING_OFF`, `PURPOSE_REQUIRED`, `ADDRESS_REQUIRED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned) |
| `ownQuote`, `ownMove` | `bank.fx.quote`, `bank.transfers.own` (planned) | see `own-transfer` | see `own-transfer` | see `own-transfer` | Existing quote; own move planned |
| `otpSend`, `otpVerify` | `bank.otp.send`, `bank.otp.verify` | `{channel}`, `{code}` | `{sent, maskedPhone, channel}`, `{verified}` | `OTP_INVALID` | Existing |
| `pay` | `bank.payments.create` | `{quoteId, payeeId or fields, purpose?, relationship?, sourceOfFunds?, reference?, when?, repeat?, payeeCheck, acknowledged, save?}` | `{reference (BWX-…), railReference, status: "settled"\|"processing"\|"scheduled"\|"held", newBalance, youPay}` | `OTP_REQUIRED`, `STEP_UP_FAILED`, `QUOTE_EXPIRED`, `PURPOSE_REQUIRED`, `PAYEE_NOT_CHECKED`, the quote codes, `PAYMENT_HELD`, `CORE_UNAVAILABLE`, `ACCOUNT_NOT_FOUND`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned). Money-moving; OTP |

Today `bank.transfers.create` ignores the payee and purpose and stays for the Meezan journeys. Sandbox conditions (09 section 13): `unavailable: ["rail:sinst"]` (or any rail id) takes one rail down; `unavailable: ["bank.payments.create"]` takes the bank down; `timeout: ["bank.payments.create"]` returns `TIMEOUT` without moving money; `latencyMs`; a payee named `Test Sanctions` gives `PAYMENT_HELD`. In the prototype the engine switches `S.down` (unavailable) and `S.timeout` (timeout) apply to every money-moving journey on the code step.

Worked examples (prototype; Current ••4410 available 8,102.40):

| Type / region | Payee | Receive | Rail | Rate | Fee | You pay | Available after | Rail reference |
|---|---|---|---|---|---|---|---|---|
| BankWorkx® customer | Taylor Brooks (3301123308) | $50.00 | BankWorkx® transfer | none | $0.00 | $50.00 | 8,052.40 | Transfer ID `BX` + 10 digits |
| US | Maya Chen | $120.00 | ACH | none | $0.00 | $120.00 | 7,982.40 | 15-digit trace number |
| Europe | Lena Fischer | EUR 200.00 | SEPA Credit Transfer | 0.926 | $0.00 | $215.98 | 7,886.42 | `E2E` + 12 digits |
| Europe | Lena Fischer | EUR 200.00 | SEPA Instant | 0.926 | $0.50 | $216.48 | 7,885.92 | UETR |
| UK | James Whitfield | GBP 100.00 | Faster Payments | 0.781 | $0.00 | $128.04 | 7,974.36 | `FP` + 10 digits |
| UAE | Omar Haddad | AED 500.00 | Aani | 3.672 | $0.50 | $136.67 | 7,965.73 | `AANI` + 10 digits |
| SWIFT | Aiko Tanaka (Japan) | JPY 100,000 | International (SWIFT) | 151 | $25.00 | $687.25 ($702.25 if I pay all) | 7,415.15 | UETR |
| SWIFT | Noah Tremblay (Canada) | CAD 1,000.00 | International (SWIFT) | 1.36 | $25.00 | $760.29 | 7,342.11 | UETR |
| Own | Current to Savings | $200.00 | instant | none | $0.00 | $200.00 | 7,902.40 | none |

#### 6. Permissions, step-up and limits

`payments.create`; step-up `otp` on every payment (09 section 9; the "under USD 30 to a saved payee skips the code" idea is planned, not in Release 1). The code names the amount and payee (dynamic linking); three wrong codes fail the payment with `STEP_UP_FAILED` (the sandbox rule; the prototype accepts any six digits). Personal daily limit USD 50,000 across all payments, shown as 41,250.00 left in the demo (own transfers do not use it). Rail maximums as in 09 section 2 (shown dimmed). Cooling-off (rule A at the top of this group): a payee under 24 hours old, which includes a payee typed in this flow, can receive at most 500.00 USD; the first payment of a scheduled payment counts. Sanctions screening on every payment. Only USD accounts pay third parties. Business context: `WRONG_CONTEXT`. A switched-off type, region or rail is hidden or dimmed ("Not offered by your bank"); a deep link to it is refused with `JOURNEY_DISABLED`.

#### 7. Result and links out

Receipt (09 section 11): "Payment receipt" with status chip, amount they receive, rate, You pay, fee, rail name, payee name and masked account, date, the rail's own reference, the `BWX-nnnnnn` reference, purpose and reference when given, the name-check line and the charges choice. Notifications: N-20 (own), N-21 (BankWorkx® customer), N-22 (another bank), N-23 and N-24 (abroad) in the Retail notification catalogue; the held payment raises "Payment held". Buttons: **Track payment** (tracker detail), **See scheduled payments** (Payments › Scheduled), **Send another** (this journey), **Done**. "New payee" inside the flow is part of this journey; `manage-beneficiary` is the stand-alone way to add, change or delete a payee and links back here with **Send money**.

#### 8. Acceptance criteria

- AC-1: A payment to a saved payee on the default rail in each of the United States, Europe, United Kingdom, UAE, Saudi Arabia and Jordan, and to a BankWorkx® customer, needs a consent tick and a verified code, debits exactly You pay, and returns the rail's own reference and a `BWX-` reference.
- AC-2: Each type and region asks the fields in the master table, with the exact rule and message for each; Continue stays blocked while a required field is empty or invalid.
- AC-3: A BankWorkx® customer is found by mobile, email, ID or account number and shown by name before paying; an unknown identifier gives `CUSTOMER_NOT_FOUND`.
- AC-4: A UAE mobile number and a Jordan CliQ alias or mobile number return the name for the person to confirm, and limit the choice to instant rails; an unknown one gives `ALIAS_NOT_FOUND`.
- AC-5: A new payee shows the name check; `match` continues freely; `close`, `type`, `none`, `na` and `found` need the tick; `close` offers "Use {name}"; a UK type mismatch offers the switch; the tick is recorded on the payment.
- AC-6: A rail the amount does not fit, a rail the bank switched off, a rail that is down and a non-instant rail for an alias payment are dimmed and cannot be chosen; the default is the first rail that fits.
- AC-7: A same-day rail chosen after its cut-off is shown as going out the next business day before any code is asked.
- AC-8: When the payee's currency is not USD the summary shows They receive, Rate, Converted, Fee, You pay, Arrives; the rate is held 60 seconds; an older quote gives `QUOTE_EXPIRED` and shows the new amount.
- AC-9: Purpose is required for the UAE, Saudi Arabia, Jordan, SWIFT and for Fedwire, CHAPS and every same-day or instant Middle East rail; an address is asked where the rail needs it and the payee has none; SWIFT also asks relationship, source of funds from 10,000 USD, and the charges choice (OUR adds 15.00).
- AC-10: The reference limit is 18 (UK), 80 (US memo), 140 (everything else); characters outside the allowed set are refused.
- AC-11: An amount above the rail maximum gives `RAIL_LIMIT`; above the balance `INSUFFICIENT_FUNDS` naming both numbers; above the daily limit `DAILY_LIMIT_EXCEEDED`; above 500.00 USD to a new payee `BENEFICIARY_COOLING_OFF`; yen with decimals `INVALID_AMOUNT`; no money moves.
- AC-12: A payment set for Later moves no money until its date, uses a business day for the payee's country, and appears in Scheduled.
- AC-13: Between my accounts: same account refused, a frozen account cannot send, conversion uses the mid-market rate with the 0.20% fee separate and a 30-second hold (full rules in `own-transfer`).
- AC-14: The code prompt names the amount and payee; three wrong codes end in `STEP_UP_FAILED` and nothing is created.
- AC-15: A screening hit ends with "Held for review" and the exact message; money is reserved, not sent.
- AC-16: A timeout tells the person to check Activity and moves no money; an unavailable service shows the standard message and moves no money.
- AC-17: Launching with `ben`, `type`, `region`, `rail` or `country` skips the screens those values answer.
- AC-18: Switching off a type, a region or a rail hides or dims it; switching off the whole journey hides every launch point.
- AC-19: "Save this payee" adds the payee to the list with `ageHours` 0 and the cooling-off chip.

#### 9. Scenarios

Setup for all: persona `alex` (prototype demo values above; the sandbox seed uses 8,720.76 available, so figures in the right-hand column are the prototype's).

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1 | `alex` | none | Domestic, United States, Maya Chen, $120.00, ACH, tick, any six digits: available 7,982.40; result "On its way", 15-digit trace number. |
| T-2 | AC-1, AC-8 | `alex` | none | Europe, Lena Fischer, EUR 200.00, SEPA Credit Transfer: Rate 1 USD = 0.926 EUR, Converted $215.98, Fee $0.00, You pay $215.98; available 7,886.42. |
| T-3 | AC-1 | `alex` | none | UK, James Whitfield, GBP 100.00, Faster Payments: You pay $128.04; "Sent", "Delivered in seconds". |
| T-4 | AC-1, AC-9 | `alex` | none | UAE, Omar Haddad, AED 500.00, Aani, no purpose: "Choose a purpose for this payment."; choose Family support (FAM): You pay $136.67. |
| T-5 | AC-1, AC-3 | `alex` | none | BankWorkx® customer, by mobile `+1 202 555 0142`: "We found Taylor Brooks"; tick; $50.00: You pay $50.00. By account `3301123308` finds the same person; `0000000000` gives `CUSTOMER_NOT_FOUND`. Pay Taylor again as a new payee after saving: `BENEFICIARY_EXISTS`. |
| T-6 | AC-2 | `alex` | none | US new payee: routing `123456789` gives `INVALID_ROUTING`; `021000021` is accepted; account `123` gives `INVALID_ACCOUNT`; state `N` and ZIP `1234` give their messages. |
| T-7 | AC-2 | `alex` | none | Europe `DE89 3704 0044 0532 0130 01` gives `INVALID_IBAN`; `GB29 NWBK 6016 1331 9268 19` gives `NOT_SEPA`. UK sort code `20-00` gives `INVALID_SORT_CODE`; account `1234567` gives `INVALID_ACCOUNT`. Saudi Arabia with an AE IBAN gives `COUNTRY_MISMATCH`. |
| T-8 | AC-2 | `alex` | none | SWIFT Canada: BIC `ROYCCAT2` accepted; BIC `ROYCGBT2` gives `COUNTRY_MISMATCH`; transit `123` gives `INVALID_BANK_CODE`. India IFSC `HDFC1000001` fails (needs the zero). Switzerland asks IBAN not account; Mexico CLABE of 17 digits fails. |
| T-9 | AC-4 | `alex` | none | UAE, Mobile number (Aani), `0501234567`: "We found Omar Haddad"; only Aani is selectable. Jordan, CliQ alias `rania.h`: "We found Rania Haddad". Alias `nobody`: `ALIAS_NOT_FOUND`. |
| T-10 | AC-5 | `alex` | none | New payee "Lena Fischer" + her IBAN: green, Continue without a tick; "Lena Fisher": amber, **Use** fixes it; "Bob Smith": red, tick needed. UK James Whitfield with type Business: "wrong type of account"; **Switch to personal** turns it green. US unknown account: grey, tick needed. |
| T-11 | AC-6 | `alex` | none | UAE, AED 60,000.00: Aani dimmed ("over the limit of AED 50,000"), default UAEFTS. UK Bacs with GBP 25,000 is dimmed. |
| T-12 | AC-6 | `alex` | option `sinstDown` on | Lena Fischer: SEPA Instant "Not available right now"; SEPA Credit Transfer stays; with option `rail.sct` also off every rail is gone: `RAIL_NOT_AVAILABLE`. |
| T-13 | AC-7 | `alex` | option `lateDemo` on | US, Same-day ACH: "Goes out tomorrow: after the 14:45 ET cut-off.", Arrives "Wed 4 Nov (after the cut-off)". RTP: no such line. |
| T-14 | AC-8 | `alex`, 61 seconds pass on review | none | Lena Fischer EUR 200: confirm gives `QUOTE_EXPIRED`; a new quote; confirm again works. |
| T-15 | AC-9, AC-10 | `alex` | none | UK reference of 19 characters: `REFERENCE_TOO_LONG`; a US ACH memo accepts 80, a wire accepts 140; `#` gives `INVALID_REFERENCE`. Fedwire with a payee that has no address asks for street and city. Japan: relationship and purpose asked; source of funds only at 10,000 USD or more; `OUR` adds $15.00. |
| T-16 | AC-11 | `alex` | none | $30,000 to Maya on ACH: default moves to Same-day ACH, then `INSUFFICIENT_FUNDS` "you'd pay $30,001.00 but $8,102.40 is available". Forcing ACH through a direct adapter call: `RAIL_LIMIT`. A new payee, $600.00: `BENEFICIARY_COOLING_OFF`; $400.00 passes. JPY 100.5: `INVALID_AMOUNT`. Daily limit: a direct call with the remaining limit set to 100.00 and $150.00 gives `DAILY_LIMIT_EXCEEDED` (not reachable with the demo balances). |
| T-17 | AC-12 | `alex` | none | Maya, $120.00, Later, a business day, Every month: balance unchanged; Scheduled lists it. Saudi Arabia offers Sunday to Thursday only. |
| T-18 | AC-13 | `alex` | none | Between my accounts: Current to Current gives `SAME_ACCOUNT`; Current to Euro, send $500.00: rate 0.9260, fee $1.00, total $501.00, you get EUR 463.00. With `allowFx` off: `CURRENCY_NOT_SUPPORTED`. |
| T-19 | AC-14 | `alex` | none | Wrong code three times (sandbox): `STEP_UP_FAILED`; nothing created; balance unchanged. |
| T-20 | AC-15 | `alex` | none | New payee "Test Sanctions": result "Held for review"; available drops, ledger balance does not. |
| T-21 | AC-16 | `alex` | `timeout: ["bank.payments.create"]`, `latencyMs: 10000` | `timeout` screen with "Check Activity before you try again"; balance unchanged. |
| T-22 | AC-16 | `alex` | `unavailable: ["bank.payments.create"]` | `unavailable` screen; balance unchanged. |
| T-23 | AC-16 | `alex` with `transferFails` | none | `CORE_UNAVAILABLE`: "We couldn't complete this right now. No money has left your account." |
| T-24 | AC-17 | `alex` | none | Open with `ben: maya`: starts on the amount screen with Maya chosen. Open with `rail: sinst`: type domestic, region Europe, no type or region screen. Open with `region: me`: UAE. |
| T-25 | AC-18 | `alex` | options `type.intl` off, `region.uk` off, `rail.chaps` off | The "To another country" card and UK card are gone; CHAPS is dimmed "Not offered by your bank". |
| T-26 | AC-19 | `alex` | none | Add Priya Raman (sample), keep "Save this payee" ticked, pay: Payments › Beneficiaries lists her with chip "New" and `ageHours` 0. |

#### 10. Expected mutation-check survivors

Per 09 section 15: the exact text of messages, the registry and directory names, the rates, the order of rails inside a region. Journey-specific: `DAILY_LIMIT_EXCEEDED` survives in the prototype because the balance is lower than the limit (a direct sandbox scenario kills it, T-16). The Saudi national ID rule (10 digits) survives unless a scenario fills it. The intermediary BIC rule survives (no scenario ticks the switch). The `Test Sanctions` match is killed by T-20. The 60-second and 30-second holds survive without a controllable clock. The per-country weekend lists survive unless T-17 checks Saudi Arabia and Jordan. The `type` result survives because only one registry account is a personal UK account.

---

### ★ Quick transfer — `single-transfer`

Catalog: `single-transfer`, workspace Personal, category Personal: Payments, core no, a bank can switch it off: yes. Options (key, label, default): `allowInstant` "Offer instant rails (RTP, SEPA Instant, Faster Payments, Aani, sarie, CliQ)" (on); `allowLater` "Allow “Later” and repeating payments" (on); `coolingOff` "Apply the 24-hour $500 limit to new payees" (on); `sinstDown` "Demo: SEPA Instant is unavailable" (off); `lateDemo` "Demo: it is 16:30, after same-day cut-offs" (off).

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `single-transfer` |
| Purpose | A one-page form to pay a payee the person has already saved, in any region: choose who, type what they receive, see the cost and the ways to send it update as you type, add a reference, then review and confirm with a code. New payees use `personal-transfer`. |
| Release / workspace | 1 / Personal |
| Status | New. Built in the prototype (`design/bankworkx-r1/src/journeys/29-single-transfer.js`); research in `research/single-transfer.md`. Not in the module before. It is a catalog entry of its own, so a bank can offer the long guided flow, the quick form, or both. |
| Channels | Web and mobile |
| Starting pattern | The review, code and result screens of `personal-transfer` |
| Who may use it | `payments.create` |
| Shared reference | `09-payment-rails.md` sections 2 (rails), 5 (amount and conversion), 6 (charges), 7 (purpose and reference), 8 (when), 9 (limits and strong authentication), 10 (cooling-off, screening), 11 (receipts), 12 (codes). |

**Sandbox demo values.** Account: Current ••4410, available 8,102.40 USD (only USD accounts are offered). Saved payees: Maya Chen (US, ABA 021000021, 123456789), Lena Fischer (Europe, `DE89 3704 0044 0532 0130 00`), James Whitfield (UK, 20-00-00, 55779911), Omar Haddad (UAE, `AE07 0331 2345 6789 0123 456`). A payee saved today through `manage-beneficiary` or `personal-transfer` is "New · 24 hours left" and limited to 500.00 USD. Daily limit left 41,250.00 USD. Rates as in 09 section 5. A payee named "Test Sanctions" is held for review. The shared demo switches: service down, timeout.

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Payments › Beneficiaries › row › Send | `{payeeId}` | `payments.create` |
| Payments › Ways to send money › Quick transfer | `{rail}` | `payments.create` |
| Accounts › detail › Transfer from this account | `{accountId}` (prefills From) | `payments.create` |
| `manage-beneficiary` result › Send money | `{payeeId}` | `payments.create` |
| `schedule-payment` / Ways to send money › One-off date | none | `payments.create` |

Launch values read: `accountId`, `payeeId`, `amount`, `rail`.

#### 3. Screens

`stepper` (planned): quick, review, code.

**`quick`: "Quick transfer"** (entry). Intro "Everything on one page. You see the cost as you type." Button **Review payment**, busy text "Checking the payment with the bank…" (about 0.7 s). Live validation on every field.

| Field | Block | Required | Validation | Error message |
|---|---|---|---|---|
| From account | `select`: USD accounts only, "{name} ••{last} · {available} available" | Yes | An account that can debit | `ACCOUNT_CANNOT_DEBIT` (planned) "You can't send money from this account right now. Choose another account." |
| Who are you paying? | `cards`: each saved payee as "{nickname} ({name})" or the name, a line "{region} · {country} · {bank mask}" and a chip (Verified, Saved, or "New · {n} hours left"). A BankWorkx® customer is shown disabled with "BankWorkx® customer: use “To a BankWorkx® customer”" | Yes | A saved payee that is not a BankWorkx® customer | "Choose who to pay." / `PAYEE_NOT_CHECKED` "Check the payee before you continue." |
| They receive | `amountInput` in the payee's currency; hint "In {currency}, the currency {first name}'s account uses. Available: {balance}." (before a payee is chosen: "Choose who to pay first. You type what they receive.") | Yes | Above zero; within the chosen rail's maximum; total within the available balance; total within 41,250.00 USD; for a new payee, at most 500.00 USD | "Enter an amount above zero." / `RAIL_LIMIT` "That's over the {rail} limit of {limit}. Choose another way to send it." / `INSUFFICIENT_FUNDS` "Not enough in the account: you'd pay {total} but {available} is available." / `DAILY_LIMIT_EXCEEDED` "That's over your remaining daily limit of $41,250.00." / `BENEFICIARY_COOLING_OFF` "That's over the $500.00 you can send to a new payee in the first 24 hours." |
| How fast? | `cards` (one per rail of the payee's region): name, "{speed} · limit {limit}", fee ("Free" or $), an "Instant" chip. Dimmed and not selectable when the amount is over the rail's limit ("over the limit of {limit}") or the rail is off ("Not available right now"). The default is the payee region's first rail that fits; the person's choice is kept while it fits | Yes | A rail that fits and is available | `RAIL_NOT_AVAILABLE` "{rail} isn't available right now. Choose another way to send it." when none is left |
| Who pays the bank charges? | `chips`: Shared, I pay all (+$15), They pay. Shown for SWIFT payees only. Hint by choice as in `personal-transfer` | No (default Shared) | One of three | none |
| Reference | `textInput` "Optional"; hint: UK "Up to 18 characters (Faster Payments limit).", US "Called a memo. Up to 80 characters.", others "Up to 140 characters."; before a payee is chosen "Shown on their statement." | No | Region maximum (US 80, Europe 140, UK 18, Middle East 140, SWIFT 140); letters, numbers, spaces and `. , ' - / ( ) + : ?` | "Use {max} characters or fewer for this payee's bank." / "Use letters, numbers, spaces and . , ' - / ( ) + : ? only." |
| Purpose of payment | `select` (Family support, Goods or services, Salary, Rent, Education, Savings or investment, Other). Shown for Middle East and SWIFT payees; hint "Required for payments to the Middle East and over SWIFT." | Yes where shown | One chosen | `PURPOSE_REQUIRED` "Choose a purpose for this payment." |
| When | `chips` Now, Later (shown when option `allowLater`) | No | none | none |
| Send on | date list, 30 days ahead, business days only; weekends skipped per country (Friday and Saturday for Saudi Arabia and Jordan, Saturday and Sunday otherwise); hint "Weekends and bank holidays are skipped. It is checked again on the day." | Yes, when Later | A listed date | "Choose a date." |
| Repeat | `chips` Doesn't repeat, Every week, Every month (when Later) | No | none | none |

Live summary under the form: "Enter an amount to see what it costs." until an amount is typed; then, for a foreign currency, They receive, Rate "1 USD = {rate} {CUR} · held 60 s", Converted; then Fee, **You pay** (bold, top rule), Arrives (or "Scheduled for {date}"), "New payee allowance: $500.00 for the first {n} hours" for a new payee, and "Daily limit left: $41,250.00". The summary and the rail cards redraw on each keystroke without moving the cursor.

Empty (no saved payees): icon, "You haven't saved anyone yet", "Add a payee once and paying them takes two taps." Button **Add a beneficiary** (`manage-beneficiary {mode: add}`).

On **Review payment** the journey stops with a banner and a code in these cases: no payee (`PAYEE_NOT_CHECKED`), the rail down (`RAIL_NOT_AVAILABLE`), or a rule above (its code). It stores the quote time.

**`review`: "Review payment"**. Big amount "You're sending {amount in their currency}" (or "Scheduled for {date}"), "to {name} · {bank mask}", chips Verified/Saved/New and the rail name. Notes: foreign currency "Rate held for 60 seconds from when you opened this screen. If it runs out, we show the new amount before anything is taken."; new payee "{name} is a new payee. For your security you can send up to $500.00 in their first {n} hours."; late demo "Goes out tomorrow: after the {cut-off} cut-off." Rows: From, To (name, bank), Country, Sent by, Rate, Fee, You pay, Arrives (or the date), Purpose, Reference, Charges (SWIFT), Repeats, Payee check ("Verified" or "Saved, not verified"). Small print "We screen payments against sanctions lists. Some may be held for a short review. Your code names the amount and the payee, and only works for this payment." Button **Confirm and send**. A foreign-currency quote older than 60 seconds: `QUOTE_EXPIRED`, a new quote is taken, the person confirms again.

**Code prompt** (shared screen C): "Authorise {amount} to {name}", sub "Code sent to ••• 4410. It only works for this payment. Changing the amount or payee voids it."

**`result`** (terminal): same outcomes as `personal-transfer` (Sent, On its way, Scheduled, Held for review). Receipt rows: Sent by, They receive, Rate, Fee, You pay, Arrives or First payment, the rail's own reference, Payee check, Charges, Purpose. Buttons **Track payment** / **See scheduled payments**, **Send another** (this journey), **Done**. A scheduled payment is added to Scheduled with "Once · {date}", "Weekly · {date}" or "Monthly · {date}".

**`locked`, `timeout`, `unavailable`, `failed`**: shared screens C.

#### 4. Sandbox errors

| Code | Message the person sees | Shows on | Button |
|---|---|---|---|
| `PAYEE_NOT_CHECKED` | "Check the payee before you continue." | `quick` banner | choose a payee |
| `RAIL_NOT_AVAILABLE` | "That way to send isn't available right now. Choose another." | `quick` | Choose another rail |
| `RAIL_LIMIT` | "That is over the limit for this way to send. Choose another or send less." | `quick` | Change amount |
| `INSUFFICIENT_FUNDS` | field text naming both numbers | `quick` | Change amount |
| `DAILY_LIMIT_EXCEEDED` | field text | `quick` | Change amount |
| `BENEFICIARY_COOLING_OFF` | field text | `quick` | Change amount |
| `PURPOSE_REQUIRED` | "Choose a purpose for this payment." | `quick` | Edit |
| `QUOTE_EXPIRED` | "The exchange rate changed. Check the new amount and confirm again." | `review` | Confirm again |
| `STEP_UP_FAILED` | "We couldn't confirm this payment. Nothing was sent. Start again." | `locked` / `failed` | Start again |
| `PAYMENT_HELD` | "We're checking this payment and will tell you within one working day." | `result` (amber) | Back to Payments |
| `TIMEOUT` | "We didn't get an answer in time. Check Activity before you try again, so you don't pay twice." | `timeout` | Check Activity |
| `SERVICE_UNAVAILABLE` | "We couldn't reach the bank. Nothing was sent." | `unavailable` | Try again |
| `JOURNEY_DISABLED` | "This isn't available at your bank." | on open | Back |

Also `OTP_INVALID`, `OTP_REQUIRED`, `ACCOUNT_NOT_FOUND`, `CORE_UNAVAILABLE`, `NOT_SUPPORTED` as in the group rules. In the prototype a message without a code in brackets ("Enter an amount above zero.") is reported with the code `RAIL_LIMIT` in the banner (see contradictions).

#### 5. Adapters

Prototype: constants and engine simulation, as in `personal-transfer`. Sandbox contract:

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `accounts` | `bank.accounts.list` | none | accounts | none | Existing |
| `payees` | `bank.beneficiaries.list` | none | map with `ageHours`; planned adds region, country, currency, check result | none | Existing, extended |
| `quote` | `bank.payments.quote` | `{fromAccountId, payeeId, receiveAmount, railId?, when?, chargeBearer?, purpose?}` | `{quoteId, railId, rails[{id, fits, available}], rate, converted, fee, total, arrives, cutoffNote?, expiresAt (60 s)}` | `INVALID_AMOUNT`, `RAIL_LIMIT`, `RAIL_NOT_AVAILABLE`, `INSUFFICIENT_FUNDS`, `DAILY_LIMIT_EXCEEDED`, `BENEFICIARY_COOLING_OFF`, `PURPOSE_REQUIRED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned) |
| `otpSend`, `otpVerify` | `bank.otp.send`, `bank.otp.verify` | `{channel}`, `{code}` | `{sent, maskedPhone, channel}`, `{verified}` | `OTP_INVALID` | Existing |
| `pay` | `bank.payments.create` | `{quoteId, payeeId, purpose?, reference?, when?, repeat?}` | `{reference (BWX-…), railReference, status, newBalance, youPay}` | `OTP_REQUIRED`, `STEP_UP_FAILED`, `QUOTE_EXPIRED`, `PURPOSE_REQUIRED`, `PAYMENT_HELD`, `CORE_UNAVAILABLE`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned). Money-moving; OTP |

Conditions: `unavailable: ["rail:sinst"]` takes one rail down (the prototype switch is option `sinstDown`); `timeout: ["bank.payments.create"]`; `unavailable: ["bank.payments.create"]`; `latencyMs`.

Worked examples (prototype; Current available 8,102.40):

| Payee | Receive | Rail | Rate | Fee | You pay | Available after |
|---|---|---|---|---|---|---|
| Maya Chen | $120.00 | ACH | none | $0.00 | $120.00 | 7,982.40 |
| Lena Fischer | EUR 200.00 | SEPA Credit Transfer | 0.926 | $0.00 | $215.98 | 7,886.42 |
| Lena Fischer | EUR 200.00 | SEPA Instant | 0.926 | $0.50 | $216.48 | 7,885.92 |
| James Whitfield | GBP 100.00 | Faster Payments | 0.781 | $0.00 | $128.04 | 7,974.36 |
| Omar Haddad | AED 500.00 | Aani | 3.672 | $0.50 | $136.67 | 7,965.73 |

#### 6. Permissions, step-up and limits

`payments.create`; step-up `otp` on every payment (the "under USD 30 to a saved payee skips the code" idea in the research is a future option, not built). The code names the amount and payee; three wrong codes fail with `STEP_UP_FAILED` (sandbox rule; the prototype accepts any six digits). Daily limit 50,000 USD, 41,250.00 left in the demo. Rail maximums as in 09 section 2. Cooling-off (rule A): a payee under 24 hours old can receive at most 500.00 USD, enforced when option `coolingOff` is on. Sanctions screening on every payment. Business context: `WRONG_CONTEXT`. If option `allowInstant` is off, every instant rail is dimmed "Not available right now". A payee that is a BankWorkx® customer cannot be chosen here.

#### 7. Result and links out

Receipt as `personal-transfer` section 7. Notification N-22 (payment sent) or N-23 (abroad) from the Retail catalogue. Buttons: **Track payment**, **See scheduled payments**, **Send another**, **Done**. **Add a beneficiary** opens `manage-beneficiary` and, when the person saves, returns to this form.

#### 8. Acceptance criteria

- AC-1: A payment to a saved payee in each region needs a verified code, debits exactly You pay, and returns the rail's own reference.
- AC-2: The cost summary and the rail list update as the amount is typed and show They receive, Rate, Converted, Fee, You pay and Arrives for a foreign currency.
- AC-3: A rail the amount does not fit is dimmed with its limit; the default moves to the first rail that fits.
- AC-4: A rail that is off (SEPA Instant demo, or instant rails switched off) shows "Not available right now" and cannot be chosen; with no rail left the person gets `RAIL_NOT_AVAILABLE`.
- AC-5: Purpose is required for the Middle East and SWIFT payees and absent for others; charges are asked for SWIFT only.
- AC-6: The reference limit is 18 (UK), 80 (US), 140 (others), with the allowed characters only.
- AC-7: A new payee (under 24 hours) is limited to 500.00 USD, with the allowance shown in the summary and a warning on the review.
- AC-8: The review shows From, To, rail, rate, fee, You pay, arrival, purpose, reference and the payee check; a foreign-currency review older than 60 seconds gives `QUOTE_EXPIRED`.
- AC-9: A same-day rail after its cut-off shows "Goes out tomorrow: after the {cut-off} cut-off." and a later arrival date.
- AC-10: A held payment ends "Held for review" with money reserved, not debited.
- AC-11: A payment set for Later moves no money until its date and appears in Scheduled.
- AC-12: Three wrong codes end in `STEP_UP_FAILED`, nothing created; a timeout and an unavailable service move no money and say so.
- AC-13: With no saved payees the person sees the empty state and can start `manage-beneficiary`; BankWorkx® customers are shown but cannot be chosen.

#### 9. Scenarios

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1 | `alex` | none | Maya Chen, $120.00, default rail ACH, review, any six digits: available 7,982.40; ACH trace number (15 digits). |
| T-2 | AC-1, AC-2 | `alex` | none | Lena Fischer, EUR 200.00, SEPA Credit Transfer: Rate 1 USD = 0.926 EUR, Converted $215.98, Fee $0.00, You pay $215.98; `E2E` + 12 digits. Switch to SEPA Instant: Fee $0.50, You pay $216.48. |
| T-3 | AC-1, AC-5 | `alex` | none | Omar Haddad, AED 500.00: Review payment without a purpose is refused; choose Family support: You pay $136.67 on Aani. |
| T-4 | AC-3 | `alex` | none | Omar Haddad, AED 60,000.00: Aani is dimmed ("over the limit of AED 50,000"); UAEFTS is the default and selected. |
| T-5 | AC-4 | `alex` | option `sinstDown` on | Lena Fischer: SEPA Instant dimmed "Not available right now"; SEPA Credit Transfer stays selected. With option `allowInstant` off, the same. |
| T-6 | AC-6 | `alex` | none | James Whitfield: reference of 19 characters is refused ("Use 18 characters or fewer for this payee's bank."); Maya Chen accepts 80; `#` is refused. |
| T-7 | AC-7 | `alex` | none | Save a new payee (any region), then Quick transfer: chip "New · 24 hours left", summary shows the allowance; $600.00 gives `BENEFICIARY_COOLING_OFF`; $400.00 passes. |
| T-8 | AC-8 | `alex`, 61 seconds pass on review | none | Lena Fischer EUR 200: confirm gives `QUOTE_EXPIRED`; a new quote; confirm again works. |
| T-9 | AC-9 | `alex` | option `lateDemo` on | Maya Chen, Same-day ACH: the review warns "Goes out tomorrow: after the 14:45 ET cut-off."; Arrives "Wed 4 Nov (after the cut-off)". RTP shows no warning. |
| T-10 | AC-10 | `alex` | none | A payee named "Test Sanctions": result "Held for review"; available drops, ledger balance does not; the message is the `PAYMENT_HELD` text. |
| T-11 | AC-11 | `alex` | none | Maya Chen $120.00, Later, a business day, Every week: balance unchanged; Scheduled lists "Weekly · {date}". |
| T-12 | AC-12 | `alex` | none | Wrong code three times (sandbox): `STEP_UP_FAILED`; no payment; balance unchanged. |
| T-13 | AC-12 | `alex` | `timeout: ["bank.payments.create"]`, `latencyMs: 10000` | `timeout` screen with "Check Activity before you try again"; balance unchanged. |
| T-14 | AC-12 | `alex` | `unavailable: ["bank.payments.create"]` | `unavailable` screen; balance unchanged. |
| T-15 | AC-12 | `alex` with `transferFails` | none | `CORE_UNAVAILABLE`: "We couldn't complete this right now. No money has left your account." |
| T-16 | AC-13 | `alex`, payee list emptied | none | Empty state "You haven't saved anyone yet" with **Add a beneficiary**. A BankWorkx® customer payee is disabled with its pointer. |
| T-17 | AC-2 | `alex` | none | Amount $30,000.00 for Maya Chen: default becomes Same-day ACH (ACH dimmed), and `INSUFFICIENT_FUNDS` shows "you'd pay $30,001.00 but $8,102.40 is available". |

#### 10. Expected mutation-check survivors

Per 09 section 15: message text, registry names, rates, rail order. Journey-specific: `DAILY_LIMIT_EXCEEDED` survives because the balance (8,102.40) is below the limit; a direct sandbox scenario with the limit set to 100.00 kills it. The charges choice survives (SWIFT payees are not seeded; a saved SWIFT payee is needed). The weekend lists by country survive unless a scenario checks Saudi Arabia or Jordan. The wrong-code lockout is a sandbox rule; the prototype cannot show it.

---

### ★ Abroad — `international-transfer`

Catalog: `international-transfer`, workspace Personal, category Personal: Payments, core no, a bank can switch it off: yes (through option `type.intl` of `personal-transfer`; the "No cross-border" preset turns it off together with the SWIFT rail option `rail.swift`). Options: none of its own.

Alias of `personal-transfer`: reached with `personal-transfer {type: international, country}` (or `rail: swift`, or region `intl`). The prototype's "Ways to send money" and `manage-beneficiary` still use the old slug, which is not registered there. The catalog option `type.intl` ("Offer “To another country” (SWIFT)") switches it off.

What differs from the other types:
- Seven countries: Canada, India, Japan, Australia, Switzerland, Singapore, Mexico (09 lists four). Payee form adds person or company, postal address (required), bank name, BIC with a country check, local codes (Canada transit, India IFSC, Australia BSB), IBAN for Switzerland, CLABE for Mexico, optional intermediary bank.
- Name check is normally "could not check" (tick required). Amount screen adds purpose, relationship, source of funds from 10,000 USD, charges (Shared, I pay all +$15, They pay), reference "Details of payment" (140).
- One rail, International (SWIFT): $25.00 fee, 1 to 3 business days, cut-off 15:00 UTC, UETR reference; rate held 60 seconds.
- Full rules, scenarios and criteria are in `personal-transfer`.

---

### ★ Pay a bill — `pay-bill`

Catalog: `pay-bill`, workspace personal, category Payments, core no, a bank can switch it off (yes). Options: `billFetch` "Look up the amount due from the biller (off: the person types the amount)" (default on); `allowPartial` "Allow the minimum and other amounts where the biller accepts them" (default on); `allowCrossCurrency` "Allow paying a bill from an account in another currency" (default on); `offerSaveBiller` "Offer to save the biller" (default on); `offerAutopay` "Offer auto-pay after the payment" (default on).

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `pay-bill` |
| Purpose | Find a biller in a directory of 30 billers in six countries, look up the bill with the customer's reference, pay all of it, the minimum or another amount from any own account, and optionally save the biller or set up auto-pay. |
| Release / workspace | 1 / Personal |
| Status | Built in the prototype (`design/bankworkx-r1/src/journeys/34-pay-bill.js`, research `research/pay-bill.md`). Replaces the earlier spec, which had four planned USD billers and one 10 to 14 digit reference rule. The sandbox adapters (`bank.billers.list`, `bank.bills.lookup`, `bank.bills.pay`) still model the Meezan billers and must be extended (section 5). The old slug `pay-a-bill` stays as an alias for Meezan. |
| Channels | Web and mobile (the prototype is responsive at 390 px and on desktop) |
| Starting pattern | `fixtures/pay-bill.ts` for lookup, review, code and result; the directory, partial payment, currency conversion, save and auto-pay are new. |
| Who may use it | Personal workspace, permission `payments.create` (the prototype checks nothing more for Personal). In the Business workspace the journey is refused with `WRONG_CONTEXT`. |
| Launch parameters | `billerId` (a biller id from the directory, e.g. `metro`) and `ref` (the reference). The prototype's own test parameters are `{billerId: "metro", ref: "123456781234"}`. |
| Shared reference | `09-payment-rails.md` section 4 (bills by region) and section 12 (codes). Where this block differs from 09, this block follows the prototype (see the report for the list). |

**What the person does, in one line.** Choose a biller (or a saved bill), type the number on the bill, see the amount due, choose how much and from which account, choose optional extras, review, confirm with a code, get a receipt. Five steps then the code sheet then the result. The progress bar reads "Step n of 5 · Pay a bill".

**The 30 billers** (all names are invented; the directory is the same on web and mobile).

| Id | Biller | Category | Country (currency) | Reference label | Format of the reference | Amount rule | Fee |
|---|---|---|---|---|---|---|---|
| `metro` | Metro Power | Utilities | United States (USD) | Account number | 12 digits | Any amount up to the amount due | Free |
| `citygas` | CityGas | Utilities | United States | Account number | 10 digits | Any | Free |
| `bluewater` | BlueWater | Utilities | United States | Account number | 10 digits | Any | Free |
| `fibernet` | FiberNet | Telecom | United States | Account number | 10 digits | Any | Free |
| `pulse` | Pulse Mobile | Telecom | United States | Mobile number | 10 digits | Any | Free |
| `lakeview` | Lakeview County Tax | Government | United States | Parcel number | 10 digits | Full amount only | Free |
| `northfield` | Northfield Auto Insurance | Insurance | United States | Policy number | `NF` then 8 digits | Full only | Free |
| `northwind` | Northwind Card | Cards | United States | Card number | 16 digits | Minimum, full statement balance, or any amount from the minimum up to 1.8 times the amount due | Free |
| `westbrook` | Westbrook University | Education | United States | Student ID | 8 digits | Any | Free |
| `severn` | Severn Water | Utilities | United Kingdom (GBP) | Account number | 10 digits | Any | Free |
| `brightline` | BrightLine Mobile | Telecom | United Kingdom | Phone number | 11 digits | Any | Free |
| `riverside` | Riverside Council Tax | Government | United Kingdom | Council tax reference | 10 digits | Full only | Free |
| `halden` | Halden Insurance | Insurance | United Kingdom | Policy number | `HL` then 8 digits | Full only | Free |
| `dunmore` | Dunmore Card | Cards | United Kingdom | Card number | 16 digits | Minimum or any, as Northwind | Free |
| `rheinwerke` | Rheinwerke Energie | Utilities | Europe (EUR) | Customer number | 10 digits | Any | Free |
| `nordtel` | Nordtel | Telecom | Europe | Customer number | 9 digits | Any | Free |
| `zuidveld` | Gemeente Zuidveld | Government | Europe | Tax reference | 12 digits | Full only | Free |
| `alpen` | Alpenschutz Versicherung | Insurance | Europe | Policy number | `AV` then 8 digits | Full only | Free |
| `gpw` | Gulf Power & Water | Utilities | UAE (AED) | Account number | 12 digits | Any | AED 1 |
| `najm` | Najm Telecom | Telecom | UAE | Mobile number | 10 digits starting `05` | Any | AED 1 |
| `traffic` | Emirate Traffic Fines | Government | UAE | Fine number | 10 digits | Full only | Free |
| `gulfcard` | Gulf Card Services | Cards | UAE | Card number | 16 digits | Minimum or any | AED 1 |
| `palm` | Palm Grove School | Education | UAE | Student number | 8 digits | Any | AED 1 |
| `alnoor` | Al Noor Electricity | Utilities | Saudi Arabia (SAR) | SADAD bill number | 12 digits | Any (note shown: SADAD biller code 002) | SAR 1 |
| `sahara` | Sahara Mobile | Telecom | Saudi Arabia | Mobile number | 10 digits starting `05` | Any | SAR 1 |
| `najd` | Najd Municipality | Government | Saudi Arabia | Bill number | 10 digits | Full only | Free |
| `amana` | Al Amana Insurance | Insurance | Saudi Arabia | Policy number | `AA` then 8 digits | Full only | SAR 1 |
| `amman` | Amman Water Services | Utilities | Jordan (JOD) | Subscription number | 10 digits | Any | JOD 0.25 |
| `petra` | Petra Mobile | Telecom | Jordan | Mobile number | 10 digits starting `07` | Any | JOD 0.25 |
| `jotraffic` | Jordan Traffic Department | Government | Jordan | Fine number | 10 digits | Full only (note: government bills are free to pay) | Free |
| `acad` | Amman Academy | Education | Jordan | Student number | 8 digits | Any | JOD 0.25 |

How each country pays: United States "US bill pay", reaches the biller in 1 to 2 business days, receipt label "Payment confirmation"; United Kingdom "Faster Payments", within seconds, "FPS reference"; Europe "SEPA credit transfer", next business day, "End-to-end ID"; UAE "UAE bill payments (Aani)", within seconds, "Aani reference"; Saudi Arabia "SADAD", same day, "SADAD payment ID"; Jordan "eFAWATEERcom", same day, "eFAWATEERcom reference". Auto-pay is offered only for utilities, telecom, insurance and cards billers.

**Sandbox demo values.** The last four digits of the reference choose the outcome, so a tester can reproduce every state (the field hint on the screen says the same). Spaces and hyphens in the reference are ignored.

| Reference ends in | What happens |
|---|---|
| `0000` | `BILL_NOT_FOUND` |
| `9999` | `BILL_ALREADY_PAID` (also after a bill has been paid in full in the same session) |
| `5555` | `NO_AMOUNT_DUE` |
| `1111` | `BILLER_UNAVAILABLE` |
| `7777` | Overdue: due date 9 days ago (25 Oct 2026), a 5% late fee is added to the charges |
| `3333` | The amount changes at the review step: it goes up by 12 units of the biller's currency once, and the journey shows `BILL_CHANGED` |
| any other four digits `nnnn` | Amount due = (1000 + nnnn mod 9000) / 20 in USD, converted to the biller's currency and rounded to cents; due date = 3 Nov 2026 plus (nnnn mod 20) + 3 days; bill number `BL-{nnnn}-{2610 + nnnn mod 9}`; name on the bill "Alex Morgan" |

Worked examples. Metro Power `123456781234`: amount due $111.70, due Fri 20 Nov 2026 (shown "Due 20 Nov 2026"; within 5 days it shows "Due in n days"), bill number `BL-1234-2611`. Northwind Card `4000123412341000`: amount due $100.00, minimum $10.00, most you can pay $180.00. Amman Water `2000001000`: amount due JOD 70.90, fee JOD 0.25, from the Current account you pay $100.35. Saved bills already in the sandbox: "Home electricity" (Metro Power `123456781234`), "Home internet" (FiberNet `5550012345`), "Dubai flat" (Gulf Power & Water `200011112222`). Sandbox accounts: Current ••4410 (available $8,102.40, balance $8,240.18), Savings ••7720 $14,310.00, Euro account ••3302 €2,150.40, Dirham account ••9981 AED 5,000.00. Sandbox rate base: USD 1 = EUR 0.926 = GBP 0.781 = AED 3.672 = SAR 3.75 = JOD 0.709. Remaining daily limit shown in the prototype: $41,250.00. Today is Tue 3 Nov 2026, 10:42 UTC. Code `482100` (the prototype keypad accepts any 6 digits; the sandbox wrong-code and lock rules are specified in section 4).

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Home › + Pay a bill | none | `payments.create` |
| Payments › hub › Pay a bill | `{billerId}` optional | `payments.create` |
| Payments › tracker › bill payment › Repeat payment | `{billerId, ref}` | `payments.create` |
| Schedule a payment › saved bill (read-only link back) | none | `payments.create` |
| Command bar "Pay a bill" | none | `payments.create` |

The "Pay another bill" button on the receipt restarts the journey with no values. If `pay-bill` is switched off at the bank, every entry point disappears and a forced open shows "Not available at your bank" with "This isn't available at your bank. (JOURNEY_DISABLED)". If the person is in a Business workspace the screen shows "This belongs to your other banking. Switch workspace to continue. (WRONG_CONTEXT)".

#### 3. Screens

Screens are the five steps of the engine (ids are the step titles), then the code sheet, then the result. A back button leaves the previous step's values in place. A step that calls the bank shows a spinner with its own text and then moves on or shows a red banner with the code and message on the same step.

**Step 1: "Pay a bill"** (entry). Intro: "Choose who you're paying. Pick a saved bill or search the directory." Blocks: **Saved bills** card, then the **All billers** list.

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| Search | text, max 40 characters | No | Matches biller name, category, country, payment method and reference label (case-insensitive) | none |
| Type | chips: All, Utilities, Telecom, Government, Insurance, Cards, Education | No (default All) | One of the list | none |
| Where | chips: All, United States, United Kingdom, Europe, UAE, Saudi Arabia, Jordan | No (default All) | One of the list | none |
| Biller | list rows (letter icon, name, "Country · currency", chip "Selected" on the chosen one) | Yes | One biller chosen | "Choose a biller." |

Saved bills: each row shows the nickname, "Biller · ••last four", chip "Pay". Choosing a saved bill fills biller and reference and moves straight to step 2. With no saved bills: "No saved bills yet. Bills you save show here for one-tap payment." When Type is All the list is grouped under category headings (Utilities, Telecom, Government, Insurance, Cards, Education). Choosing a biller row also moves to step 2 at once. Empty search result: icon, **No billers found**, "Try another word, or choose All under Type and Where." Button: **Continue** (needs a biller; the rows already advance). Cancel (first step) leaves the journey.

**Step 2: "Find your bill"**. Intro: "Enter the number printed on your bill. We'll ask the biller for the amount." A card shows the biller (name, "Category · Country · paid by {method}") with a **Change** button back to step 1.

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| {Reference label of the biller} (e.g. "Account number", "Mobile number", "Policy number") | text, max 24 characters, placeholder from the biller (e.g. "12 digits", "NF12345678") | Yes | Matches the biller's format after spaces and hyphens are removed (table in section 1) | Empty: "Enter the number from your bill." Wrong: "{label} should be {format}. (INVALID_REFERENCE)", e.g. "Account number should be 12 digits. (INVALID_REFERENCE)" |

Hint under the field: "Should be {format}. Sandbox: ending 0000 not found, 9999 already paid, 7777 overdue, 3333 amount changes, 1111 biller down, 5555 nothing due." (the sandbox part is shown only in the sandbox). Button **Find my bill**; busy text "Looking up your bill…" (about 0.9 s). If the option `billFetch` is off, nothing is looked up: the journey goes on with an amount the person types (step 3 shows "This bank doesn't look up bills for {biller}. Type the amount from your bill." and the name on the bill reads "Not checked"). On a lookup failure the step shows the banner with the code and message from section 4 and stays put. The account for step 3 is chosen here: the first own account in the biller's currency if there is one (USD, EUR or AED), otherwise the first account; it never overrides an account the person already chose in the same currency.

**Step 3: "Amount"**. Intro: "Choose how much to pay and which account to use." Top card (the bill): letter icon, biller name, "{label} {reference}", a status chip ("Overdue" red; "Due in n days" amber when 5 days or fewer; otherwise "Due {date}" green), then the big amount with caption "Amount due" (or "Left to pay" after a part payment), "Due {date}", rows Name on the bill, Bill number, Current charges (not after a part payment), Late fee (5%) when overdue, Minimum payment (card billers), Total balance (card billers, the most that can be paid).

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| How much? | cards: **Full amount due** ("Statement balance" for cards, "Rest of the bill" after a part payment), subtitle "Clears this bill.", amount on the right; **Minimum payment** (card billers only) "Keeps the account in good standing. Interest applies to the rest."; **Another amount** (billers that are not "full only") "Pay part of the bill now." (cards: "Between the minimum and the total balance.") | Yes (default Full) | Minimum and Another amount are greyed out when option `allowPartial` is off. Hidden when no lookup was done | none |
| Amount | amount with the biller's currency symbol (USD `$`, EUR `€`, GBP `£`, AED, SAR, JOD as a code prefix), placeholder "0.00" | Yes, only when Another amount (or when no lookup) | More than 0, at most the maximum (the amount due; cards 1.8 times the amount due); card billers at least the minimum | Below the minimum: "The minimum for this bill is {x}. (AMOUNT_BELOW_MINIMUM)". Above: "This bill is {x}. You can't pay more than that. (AMOUNT_ABOVE_DUE)" |
| Pay from | select of every own account, "{name} ••{last four} · {available}" with " · converted" added for accounts in another currency | Yes | Enough available money for the total in the account's currency; the same currency unless `allowCrossCurrency` is on; the amount converted to USD within the remaining daily limit | "Choose an account to pay from." Others as the live line below |
| Note to yourself | text, max 40, placeholder "Optional, for example “October bill”" | No | none | none |

Live summary under the fields (updates on every keystroke): "Paying {amount in biller currency}"; "Fee {x}" or "Free"; "Rate 1 {biller currency} = {rate} {account currency}" when converted; **You pay {amount in the account's currency}**; "Left on the bill after this {x}" when a lookup was done; "Reaches the biller {speed}". Before an amount is known: "Enter an amount to see the cost." The Continue button is disabled and the red line shows the first problem, in this order: wrong currency without `allowCrossCurrency` "{biller} bills are in {currency}. Choose a {currency} account. (BILL_CURRENCY_MISMATCH)"; "Not enough in the account: you'd pay {x} but {y} is available. (INSUFFICIENT_FUNDS)"; "That's over your remaining daily limit of $41,250.00. (DAILY_LIMIT_EXCEEDED)". The fee is in the biller's currency and is added to the amount before conversion. Button **Continue**.

**Step 4: "Options"**. Intro: "Save time next month. Both are optional." Every field here is optional and each can be absent.

| Field | Block | Shown when | Default | Validation |
|---|---|---|---|---|
| Save this bill | toggle, sub "Pay it in one tap from the top of this screen." | `offerSaveBiller` is on and this biller and reference are not already saved | On | none |
| Name for this bill | text, max 30, placeholder "For example “Home electricity”" | Save is on | The biller's name | none |
| Pay this bill automatically | toggle, sub "Each month, from the same account. Shows in Payments › Scheduled; change or cancel it any time." | `offerAutopay` is on and the biller supports auto-pay | Off | none |
| When | chips "On the due date" / "2 days before" | Auto-pay is on | On the due date | none |
| Never pay more than | amount in the biller's currency, hint "Auto-pay pays the full amount due. If a bill is higher than this, we skip it and tell you." | Auto-pay is on | 1.5 times the amount due, rounded up to the next 10 | Required while auto-pay is on (no custom message in the prototype; planned: "Enter a limit above zero.") |
| Tell me when my next bill is ready | toggle, sub "A notification when the biller issues it." | Always | On | none |

Button **Continue**.

**Step 5: "Review"**. Intro: "Check the details. We'll send a code to confirm." Rows (a card): Biller; {Reference label}; Name on the bill ("Not checked" when no lookup); Amount; Fee ("Free"); Rate (when converted); **You pay**; From ("{name} ••{last four}"); "Reaches the biller" ("{speed} · {method}"); "Left on the bill" (after lookup); Auto-pay ("Monthly, up to {x}") when on; Note. Info text: "We send a code to ••• 4410 to confirm. Government bills have no extra fee. Payments to billers can't be called back once sent." (the government sentence only for government billers). Consent check (required): **I confirm I want to pay this bill**; if not ticked: "Tick the box to confirm." Button **Pay bill** (the engine label). Busy text "Confirming the amount is still due…" (0.8 s). A reference ending in `3333` raises `BILL_CHANGED` once here, the due amount is updated, and the person checks and confirms again.

**Code sheet** (engine step-up, `confirm`). Title "Authorise {amount} to {biller}"; sub "Code sent to ••• 4410. It only works for this payment." A six-digit keypad, "Prototype: type any 6 digits". Product behaviour (existing sandbox): code `482100`; wrong code "That code isn't right. {n} tries left."; three wrong codes lock the payment (shared `locked` screen, "Too many wrong codes. Start again."). The prototype does not simulate wrong codes (planned).

**Result.** Success: green tick, title **Bill paid**, text "{amount} to {biller}.", chip "Paid in full". After a part payment: title **Part paid**, chip "Part payment · {x} left". Receipt rows: Biller, {Reference label}, Name on the bill, Amount paid, Fee, Rate (when converted), Total from your account, From, {Region receipt label} (a 12-digit number), Paid on "3 Nov 2026", Reaches the biller, Still to pay (after lookup), Auto-pay ("Monthly, next {date}") when set up; then the BankWorkx® reference. Buttons: **Pay another bill** (restarts), **Schedule a bill** (`schedule-payment`), **View in Payments**, **Done**. The home balance animates from the old total to the new total.

**Other states.** Timeout (sandbox "Backend will time out on submit"): banner `TIMEOUT` "We didn't get an answer in time. Check Activity before you try again, so you don't pay twice." on whichever step was calling (the lookup step uses the same wording because the journey is marked as moving money). Bank down (sandbox "Bank unavailable"): a sheet "We couldn't reach the bank / Nothing was sent and you haven't been charged. Try again in a moment. SERVICE_UNAVAILABLE" with **Try again** and **Cancel**. Product states for a failed money step (`failed`) are the shared screens of README 1.6.

#### 4. Sandbox errors

| Code | Message the person sees | Where | Button |
|---|---|---|---|
| `BILLER_NOT_FOUND` | "Choose a biller from the list." | Step 2 banner | Change |
| `BILL_NOT_FOUND` (ref ends `0000`) | "We couldn't find that bill. Check the number and try again." | Step 2 banner | Edit the number |
| `BILL_ALREADY_PAID` (`9999`, or paid in full earlier) | "This bill has already been paid." | Step 2 banner | Back |
| `NO_AMOUNT_DUE` (`5555`) | "There's nothing to pay on this bill right now." | Step 2 banner | Back |
| `BILLER_UNAVAILABLE` (`1111`) | "The biller isn't answering right now. Nothing was changed. Try again in a few minutes." | Step 2 banner | Find my bill again |
| `INVALID_REFERENCE` | "{label} should be {format}. (INVALID_REFERENCE)" | Step 2 field | Edit |
| `AMOUNT_BELOW_MINIMUM` | "The minimum for this bill is {x}." | Step 3 field | Edit |
| `AMOUNT_ABOVE_DUE` | "This bill is {x}. You can't pay more than that." | Step 3 field | Edit |
| `BILL_CURRENCY_MISMATCH` | Live line: "{biller} bills are in {currency}. Choose a {currency} account." Journey table text: "That account is in a different currency from the bill. Choose a matching account." | Step 3 | Choose account |
| `INSUFFICIENT_FUNDS` | Live line: "Not enough in the account: you'd pay {x} but {y} is available."; at commit: "Not enough in the account. Nothing was paid." | Step 3, or the failure banner | Change account |
| `DAILY_LIMIT_EXCEEDED` | "That's over your remaining daily limit of $41,250.00." (journey text "That's over your remaining daily limit.") | Step 3 | Change amount |
| `BILL_CHANGED` (`3333`) | "The amount due changed while you were reviewing. We've updated it below. Check it and confirm again." | Step 5 banner | Confirm again |
| `OTP_INVALID`, `OTP_REQUIRED` | README 1.6 wording | Code sheet / failure | Try again / Back to code |
| `ACCOUNT_NOT_FOUND`, `LIMIT_EXCEEDED`, `CORE_UNAVAILABLE`, `NOT_SUPPORTED` | README 1.6 wording | Failure (sandbox adapter codes) | As README |
| `TIMEOUT` | "We didn't get an answer in time. Check Activity before you try again, so you don't pay twice." | Banner on the calling step | Check Activity / Try again |
| `SERVICE_UNAVAILABLE` | "We couldn't reach the bank. Nothing was sent and you haven't been charged. Try again in a moment." | Sheet | Try again |
| `JOURNEY_DISABLED`, `WRONG_CONTEXT` | "This isn't available at your bank." / "This belongs to your other banking. Switch workspace to continue." | Whole journey | Back / Switch |

Note the difference between the sandbox's `LIMIT_EXCEEDED` (existing adapter code) and the prototype's `DAILY_LIMIT_EXCEEDED` (the 09 code). The prototype uses the 09 name.

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `accounts` | `bank.accounts.list` | none | accounts with `currency`, `available` | none | Existing |
| `billers` | `bank.billers.list` | none | map of `{id, name, category}` today (Meezan billers, `packages/mock-bank-api/src/index.ts` `BILLERS`). Needed: `country`, `currency`, `referenceLabel`, `referencePattern`, `partial` ("full", "any", "min"), `fee`, `autopay` | none | Existing; the 30-biller directory is (planned) |
| `billLookup` | `bank.bills.lookup` | `{billerId, reference}` | today `{billerName, reference, payerName, amount, dueDate}` (reference 10 to 14 digits, amount `1000 + last four mod 9000`, due `2026-11-12`). Needed: `{amount, lateFee, dueDate, holder, billNumber, minimum, maximum, remaining}` per the table of demo values | `BILLER_NOT_FOUND`, `BILL_NOT_FOUND` today; (planned) `BILL_ALREADY_PAID`, `NO_AMOUNT_DUE`, `BILLER_UNAVAILABLE`, `INVALID_REFERENCE`, `TIMEOUT`, `SERVICE_UNAVAILABLE`. Not money-moving; no code | Existing, to extend |
| `savedBills` | `bank.bills.saved.list`, `bank.bills.saved.add` | `{}` / `{billerId, reference, nickname}` | saved bills | `SAVED_LIMIT` (planned) | (planned) |
| `otpSend`, `otpVerify` | `bank.otp.send`, `bank.otp.verify` | as README | as README | `OTP_INVALID` | Existing |
| `billPay` | `bank.bills.pay` | today `{amount, fromAccountId}`; needed `{billerId, reference, amount, fee, fromAccountId, memo}` | `{reference, newBalance}`; needed also `{remaining, paidInFull, regionReference}` | `OTP_REQUIRED`, `CORE_UNAVAILABLE`, `ACCOUNT_NOT_FOUND`, `INSUFFICIENT_FUNDS`, `LIMIT_EXCEEDED` today; (planned) `BILL_CHANGED`, `AMOUNT_BELOW_MINIMUM`, `AMOUNT_ABOVE_DUE`, `BILL_CURRENCY_MISMATCH`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | Existing, to extend. Money-moving; code needed |
| `autopay` | `bank.schedules.create` with `kind: "bill"` | `{billerId, reference, fromAccountId, frequency: "monthly", amountMode: "full-bill", cap, offsetDays}` | schedule (see `schedule-payment`) | as `schedule-payment` | (planned) |

#### 6. Permissions, step-up and limits

Permission `payments.create`. Step-up `otp` on every bill payment (a bank may lower this for saved billers later; research question). Daily limit 50,000 USD per person; the prototype shows $41,250.00 left; the limit is tested on the USD value of amount plus fee. Billers have no cooling-off. Business workspace: `WRONG_CONTEXT`.

#### 7. Result and links out

Receipt: as in section 3. Notifications: in-app and SMS "Bill paid: {biller} {amount}. Ref {reference}." (planned); if "Tell me when my next bill is ready" is on, a later notification when the biller issues the next bill (planned). The new transaction appears in Activity under the category Bills, named after the biller, for the USD value. Links out: **Pay another bill**, **Schedule a bill** (`schedule-payment`), **View in Payments**, **Done**. Auto-pay creates a normal entry in Payments › Scheduled that the person can change or cancel with `schedule-payment`. A paid-in-full bill cannot be looked up again (`BILL_ALREADY_PAID`); a part-paid bill shows "Left to pay" on the next lookup.

#### 8. Acceptance criteria

- AC-1: A reference in the biller's format finds the bill and shows biller, name on the bill, amount due, due date and bill number.
- AC-2: A reference that does not match the biller's format is refused on the form with "{label} should be {format}. (INVALID_REFERENCE)" and the lookup is not called.
- AC-3: A reference ending `0000`, `9999`, `5555` or `1111` shows `BILL_NOT_FOUND`, `BILL_ALREADY_PAID`, `NO_AMOUNT_DUE` or `BILLER_UNAVAILABLE` with the wording in section 4 and no money moves.
- AC-4: The bill is paid only after consent and a verified code; the account is debited by exactly the "You pay" amount shown on the review.
- AC-5: A "full only" biller offers only the full amount. A "minimum" biller (cards) offers the minimum, the full balance and another amount between the minimum and 1.8 times the amount due; another amount below the minimum or above the maximum is refused with the messages in section 3.
- AC-6: After a part payment the next lookup of the same bill shows "Left to pay" with the remaining amount; after a full payment it answers `BILL_ALREADY_PAID`.
- AC-7: A bill in another currency is converted at the rate shown, the fee is added before conversion, and with `allowCrossCurrency` off only a same-currency account can be chosen (`BILL_CURRENCY_MISMATCH`).
- AC-8: Not enough money or an amount above the remaining daily limit stops the journey before the code and moves no money.
- AC-9: If the biller changes the amount between lookup and payment (`3333`), the journey shows `BILL_CHANGED`, updates the amount and needs a fresh confirmation.
- AC-10: Saving the biller adds a one-tap saved bill; auto-pay creates a monthly bill schedule with the chosen cap and timing that appears in Scheduled.
- AC-11: With `billFetch` off, no lookup is made and the person types the amount.
- AC-12: A timeout or an unavailable bank pays nothing and says so; with the journey switched off the bank answers `JOURNEY_DISABLED`.

#### 9. Scenarios

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-4 | `alex` | none | Metro Power, `123456781234`, Current. Bill: $111.70, due 20 Nov 2026, bill number `BL-1234-2611`. Review "You pay $111.70". Code `482100`. Current available 7,990.70, balance 8,128.48. Result "Bill paid", "Paid in full", "Payment confirmation" 12 digits. |
| T-2 | AC-2 | `alex` | none | Metro Power, `12345`: "Account number should be 12 digits. (INVALID_REFERENCE)", Find my bill disabled, no lookup call. Northfield with `NF1234`: letters-then-digits message. Najm with `0612345678`: "Mobile number should be 10 digits starting 05." |
| T-3 | AC-3 | `alex` | none | CityGas `1234560000` not found; `1234569999` already paid; `1234565555` nothing due; `1234561111` biller down. Each shows its banner, stays on step 2. |
| T-4 | AC-5 | `alex` | none | Lakeview County Tax `9876543210` (any digits): only Full amount due offered. |
| T-5 | AC-5, AC-6 | `alex` | none | Northwind Card `4000123412341000`: due $100.00, minimum $10.00. Another amount `5.00`: AMOUNT_BELOW_MINIMUM. `200.00`: AMOUNT_ABOVE_DUE. Pay `40.00`: part paid, "Part payment · $60.00 left". Look up again: "Left to pay $60.00". Pay `60.00`: lookup again gives BILL_ALREADY_PAID. |
| T-6 | AC-7 | `alex` | `allowCrossCurrency` on | Amman Water `2000001000`, pay from Current: amount JOD 70.90, fee JOD 0.25, rate shown, you pay $100.35. |
| T-7 | AC-7 | `alex` | `allowCrossCurrency` off | Same bill: Current is refused with BILL_CURRENCY_MISMATCH; a JOD account does not exist in the seed, so the journey cannot continue (expected). USD biller from Euro account refused. |
| T-8 | AC-8 | `alex`, setup: Current available set to 50.00 | none | Metro Power `123456781234`: live line "Not enough in the account: you'd pay $111.70 but $50.00 is available. (INSUFFICIENT_FUNDS)"; Continue disabled. With the daily limit used up to 49,950: DAILY_LIMIT_EXCEEDED. |
| T-9 | AC-9 | `alex` | none | CityGas `1234563333`: bill $216.65; on the review `BILL_CHANGED`, new amount $228.65; confirm again; debit is $228.65. |
| T-10 | AC-3, AC-1 | `alex` | none | Severn Water `1234567777`: chip "Overdue", late fee line, due 25 Oct 2026. Current charges £342.74, late fee £17.14, amount due £359.88 (USD base 438.85 times 0.781). |
| T-11 | AC-10 | `alex` | none | FiberNet `5550099999` is already paid; use `5550012346`: Save on, name "Home internet 2"; auto-pay on, 2 days before, cap default. After paying, the saved bill is at the top of step 1 and Payments › Scheduled holds "FiberNet (auto-pay)". |
| T-12 | AC-11 | `alex` | `billFetch` off | Any valid reference: no bill card, "Name on the bill: Not checked", amount typed by hand. |
| T-13 | AC-4 | `alex` | none | Three wrong codes (sandbox adapter rule): `locked`, nothing paid. Prototype keypad accepts any six digits, so this scenario runs against the bank adapters only. |
| T-14 | AC-12 | `alex` | `timeout: ["bank.bills.pay"]` (prototype: Backend will time out on submit) | Confirm: banner TIMEOUT, balance unchanged. |
| T-15 | AC-12 | `alex` | `unavailable: ["bank.bills.lookup"]` (prototype: Bank unavailable) | Find my bill: sheet SERVICE_UNAVAILABLE; Try again after the bank is back. |
| T-16 | AC-12 | `alex` | `pay-bill` switched off | Home has no "+ Pay a bill"; a forced open shows JOURNEY_DISABLED. |

#### 10. Expected mutation-check survivors

- The directory's reference patterns for the 24 billers other than Metro Power, Northfield and Najm are not all covered by a scenario; a mutant that loosens one survives unless each biller gets a table-driven test (planned).
- The fee on UAE, Saudi and Jordan billers and the conversion rounding survive T-6 (one biller only).
- `BILL_CURRENCY_MISMATCH` survives while no JOD, GBP or SAR account exists in the seed, because every non-matching case is also an `allowCrossCurrency` path (expected).
- `DAILY_LIMIT_EXCEEDED` survives without the setup `usedToday` (the prototype's remaining limit is fixed).
- The 5-day "Due in n days" chip survives (display only).
- Wrong-code locking survives in the prototype (keypad accepts any six digits); it is killed only against the bank adapters.

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

Catalog: `manage-beneficiary`, workspace Personal, category Personal: Payments, core no, a bank can switch it off: yes. Options (key, label, default): `nameCheck` "Run the name check (Verification of Payee, Confirmation of Payee)" (on); `allowCancelSchedules` "Let a person cancel scheduled payments while deleting a payee" (on); `labels` "Offer payee labels (Family, Friend, Landlord…)" (on).

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `manage-beneficiary` |
| Purpose | Save a person or company to pay, change their details, or remove them. Fields follow the kind of payee and the region; a new or changed payee goes through the name check and then the 24-hour, 500.00 USD cooling-off rule. |
| Release / workspace | 1 / Personal |
| Status | New. Built in the prototype (`design/bankworkx-r1/src/journeys/31-manage-beneficiary.js`); research `research/manage-beneficiary.md`. The prototype uses the older field checks of `90-payflow.js`, not the `TXF` table of `personal-transfer` (no address, account type or CliQ alias). Adding a payee inside a transfer is done by `personal-transfer` itself. |
| Channels | Web and mobile |
| Starting pattern | `fixtures/cab.ts` for input messages |
| Who may use it | The prototype checks `payments.create`; the module permission is `beneficiaries.manage` (contradiction, see report). |
| Shared reference | 09 sections 3 (fields), 4 (name check), 10 (cooling-off), 12 (codes), 14 (sample data). |

**Sandbox demo values.** BankWorkx® customers: 3301123308 Taylor Brooks, 3301554412 Jordan Keller. Saved payees: Maya Chen, Lena Fischer, James Whitfield, Omar Haddad. James Whitfield is used by the scheduled payment "Rent" (Monthly, 1 Dec, $1,450.00); "Savings top-up" (Weekly, Fri, $100.00) has no payee. Limit 50 payees. Sample payees (button **Fill with a sample payee**): US Priya Raman `021000021` / `987654321`; Europe Camille Dubois `FR14 2004 1010 0505 0001 3M02 606`; UK James Whitfield 20-00-00 / 55779911 (already saved, so `BENEFICIARY_EXISTS`); UAE Omar Haddad (already saved); Saudi Arabia Faisal Al-Harbi; Jordan Rania Haddad; abroad Aiko Tanaka `BOTKJPJT` / 1234567890; BankWorkx® 3301123308. Name check registry as in 09 section 14.

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Payments › Beneficiaries › Add | `{mode: add}` (optional `kind`, `region`) | as above |
| Payments › Beneficiaries › row › Edit / Delete | `{mode, beneficiaryId}` | as above |
| Payments › Beneficiaries (no mode) | none: first screen asks what to do | as above |
| A transfer › New payee | `{mode: add, kind, returnTo}` (returns to the same screen) | as above |
| `single-transfer` empty state › Add a beneficiary | `{mode: add}` | as above |

#### 3. Screens

`stepper` (planned): mode, pick, type, details, check, review, code.

**`mode`: "What would you like to do?"** (only when no mode was passed). `chips`: Add a payee, Edit a payee, Delete a payee.

**`pick`: "Choose a payee"** (edit and delete without an id). Intro "Pick the person you want to change." `cards` of saved payees: "{nickname} ({name})" or name, "{kind or region} · {country} · {mask} · {label}", chip Verified, Saved or "New · {n} hours left". Required, "Choose a payee." Empty: "You haven't saved anyone yet" / "Add someone to pay them in two taps."

**`type`: "Who do you want to pay?"** (add, unless `kind` was passed). `cards`, required, "Choose a type.": "BankWorkx® customer" (Free and instant), "Another bank" (US, Europe, UK or Middle East), "Abroad" (Other countries, over SWIFT).

**`details`: "Their details"** (add and edit). Edit notice: "If you change the name or the account details, we check the payee again and {name} counts as a new payee for 24 hours. You can send up to $500.00 in that time. Changing only the nickname or label does neither." Button **Check details**, busy "Checking the details…" (0.7 s); **Fill with a sample payee**.

| Field | Block | Required | Validation | Error message |
|---|---|---|---|---|
| Where is the account? | `chips` United States, Europe (SEPA), United Kingdom, Middle East (add, kind Another bank) | Yes | One chosen | none |
| Country | `select` (Middle East: UAE, Saudi Arabia, Jordan; abroad: Canada, India, Japan, Australia, Switzerland, Singapore, Mexico) | Yes | One chosen | none |
| BankWorkx® account number (customer) | `textInput`, 10 digits, hint "Try 3301123308 or 3301554412"; shows "✓ Found: {first name} {initial}. · ••{last 4}" | Yes | 10 digits and exists | "Enter the 10-digit BankWorkx® account number." / `CUSTOMER_NOT_FOUND` "We can't find a BankWorkx® account with that number. Check it and try again." |
| Name on the account | `textInput`, 70 | Yes (not customers) | 2 or more characters | `PAYEE_NAME_REQUIRED` "Enter the name on the account." |
| Nickname | `textInput`, 24, "Optional, for example “Mum”"; hint "Up to 24 characters. Only you see it." | No | 24 characters | "Use 24 characters or fewer." |
| Label | `chips` Family, Friend, Landlord, Business, Other (option `labels`) | No | none | none |
| Routing number (ABA) | `textInput` 9 (US) | Yes | 9 digits, ABA checksum; green "✓ Valid routing number · {bank}" | `INVALID_ROUTING` "That routing number isn't valid. Check the 9 digits." |
| Account number (US) | `textInput` 17 | Yes | 4 to 17 digits | `INVALID_ACCOUNT` "An account number has 4 to 17 digits." |
| Account type (US) | `chips` Checking, Savings | No | default Checking | none |
| IBAN (Europe, Middle East) | `textInput`; hint "Spaces are fine." | Yes | mod-97, length; Europe: SEPA country; Middle East: starts with the chosen country | `INVALID_IBAN`, `NOT_SEPA` "That IBAN isn't in the SEPA area. Use “Other countries (SWIFT)”.", `COUNTRY_MISMATCH` "That IBAN starts with {cc}, but you chose {country}." |
| Sort code (UK) | `textInput` 8, "20-00-00" | Yes | 6 digits | `INVALID_SORT_CODE` "A sort code has 6 digits, like 20-00-00." |
| Account number (UK) | `textInput` 8 | Yes | 8 digits | `INVALID_ACCOUNT` "A UK account number has 8 digits." |
| SWIFT / BIC (abroad) | `textInput` 11 | Yes | 8 or 11 characters | `INVALID_BIC` "A SWIFT/BIC has 8 or 11 letters and numbers." |
| Account number or IBAN (abroad) | `textInput` 34 | Yes | 6 to 34 letters, digits, spaces, dashes | `INVALID_ACCOUNT` "That account number looks too short or too long." |

Empty required fields show: "Enter the IBAN.", "Enter the 6-digit sort code.", "Enter the 8-digit account number.", "Enter the 9-digit routing number.", "Enter the account number.", "Enter the SWIFT/BIC code.", "Enter the account number or IBAN." On **Check details**: more than 50 payees gives `BENEFICIARY_LIMIT`; the same details as another saved payee give `BENEFICIARY_EXISTS`; then the name check runs if needed. Editing: the kind and region cannot change.

**`check`: "Check the payee"** (add; edit only when the name or account details changed). Same four results and wording as `personal-transfer` section 3 (match, close with **Use “{name}”**, none, na), with the label of the region ("BankWorkx® customer record" for customers, whose result is always match). Required tick "I understand and want to continue" unless match ("Check the payee before you continue." `PAYEE_NOT_CHECKED`). With option `nameCheck` off the result is "couldn't check" (`na`) for every bank payee.

**`review`: "Check before you save"** (add and edit). Warning "For your security, you can send up to $500.00 to a new payee in the first 24 hours." Rows: Type, Region, Name, Nickname, Label, Account, Bank, Name check (Matches, Close you continued, Doesn't match you continued, Couldn't be checked, Not repeated). Consent "I confirm these details are correct and I know this person" (required, "Tick to confirm."). Button **Save and send code**; an edit with only nickname or label changed shows **Save changes** and asks for no code.

**`delete`: "Delete payee"**. Card with the payee and "You won't be able to send money to {name} from your saved list. Payments already sent are not affected." If scheduled payments use the payee they are listed; with option `allowCancelSchedules` a switch "Also cancel these scheduled payments" ("They will not run again. Payments already sent are not affected."), without it "Cancel these in Payments › Scheduled first." Not ticked: `BENEFICIARY_IN_USE` "{name} is used by {n} scheduled payment(s). Cancel it first." Button **Delete payee**; no code is asked. Unknown id: "Payee not found" / `BENEFICIARY_NOT_FOUND`.

**Code prompt** (add and sensitive edit): "Authorise saving {name}", "Code sent to ••• 4410. It only works for this change."

**`result`**: add: "Saved" / "{name} is saved as Verified (or Saved). For your security you can send up to $500.00 in the first 24 hours."; rows Payee, Account, Bank, Name check, Limit "$500.00 for 24 hours"; buttons **Send money** (to the transfer journey for the payee, with the payee id), **Back to the payment** (when opened from a transfer) or **Payments**. Edit: "Changes saved"; a sensitive change says "{name} is a new payee again for 24 hours. You can send up to $500.00 in that time." with chip "Checked again"; otherwise "{name} was updated." Delete: "Payee deleted" / "{name} was removed from your payees." with rows Payee, Account, Scheduled payments cancelled. A payee is Verified only after a match (or a close match corrected with Use); otherwise Saved.

**`locked`, `timeout`, `unavailable`, `failed`**: shared screens C (timeout: "This is taking longer than expected. Nothing was changed."; unavailable: "We couldn't reach the bank. Nothing was changed.").

#### 4. Sandbox errors

| Code | Message the person sees | Shows on | Button |
|---|---|---|---|
| `PAYEE_NAME_REQUIRED`, `INVALID_IBAN`, `NOT_SEPA`, `COUNTRY_MISMATCH`, `INVALID_ROUTING`, `INVALID_SORT_CODE`, `INVALID_ACCOUNT`, `INVALID_BIC` | texts in section 3 | `details` field | fix the field |
| `CUSTOMER_NOT_FOUND` | "We can't find a BankWorkx® account with that number. Check it and try again." | `details` | fix the field |
| `PAYEE_NOT_CHECKED` | "Check the payee before you continue." | `check` | tick the box |
| `BENEFICIARY_EXISTS` | "You already saved this payee with these details." | `details` banner | Back |
| `BENEFICIARY_LIMIT` | "You can save up to 50 payees. Delete one to add another." | `details` banner | Back |
| `BENEFICIARY_NOT_FOUND` | "We can't find that payee." | `delete` / save | Payments |
| `BENEFICIARY_IN_USE` | "This payee is used by a scheduled payment. Cancel it first." | `delete` | Back |
| `STEP_UP_FAILED` | "We couldn't confirm this change. Nothing was saved. Start again." | `locked` | Start again |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | `timeout` | Try again |
| `SERVICE_UNAVAILABLE` | "We couldn't reach the bank. Nothing was changed." | `unavailable` | Try again |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `payees` | `bank.beneficiaries.list` | none | map with `ageHours` | none | Existing |
| `validate` | `bank.payees.validate` | `{kind, region, country?, fields…}` | `{ok, fieldErrors, bankName?}` | field codes | (planned) |
| `check` | `bank.payees.check` | `{region, name, account key}` | `{result, registeredName?, label}` | `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned) |
| `save` | `bank.payees.save` | `{kind, region, fields…, nickname, label, checkResult, acknowledged}` | `{payeeId, addedAt, coolingOffUntil}` | validate codes, `BENEFICIARY_EXISTS`, `BENEFICIARY_LIMIT`, `PAYEE_NOT_CHECKED` | (planned). OTP |
| `update` | `bank.payees.update` | `{payeeId, fields…}` | `{payeeId, addedAt}` | as save, `BENEFICIARY_NOT_FOUND` | (planned). OTP only for sensitive changes |
| `remove` | `bank.payees.delete` | `{payeeId, cancelSchedules?}` | `{removed, schedulesCancelled}` | `BENEFICIARY_NOT_FOUND`, `BENEFICIARY_IN_USE` | (planned). No OTP |
| `otpSend`, `otpVerify` | `bank.otp.send`, `bank.otp.verify` | `{channel}`, `{code}` | `{sent, maskedPhone}`, `{verified}` | `OTP_INVALID` | Existing |

Prototype stores a BankWorkx® customer as a US-region record (routing 021000021, account = customer number) so the transfer flows keep working.

#### 6. Permissions, step-up and limits

Permission as in the summary. A code is needed to add and to change the name or account details; changing only the nickname or label, and deleting, need none. Cooling-off 24 hours, 500.00 USD, restarts on add and on a sensitive edit. Maximum 50 payees. Business context: `WRONG_CONTEXT`.

#### 7. Result and links out

As the result screen above. Notification N-29b "Beneficiary added / changed / deleted". Buttons: **Send money**, **Back to the payment**, **Payments**.

#### 8. Acceptance criteria

- AC-1: A payee of each kind (BankWorkx® customer, US, Europe, UK, UAE, Saudi Arabia, Jordan, abroad) can be saved after valid details, the name check, consent and a verified code, and then appears in the list with its region, mask and chip.
- AC-2: Invalid routing, IBAN, sort code, account, BIC, a non-SEPA IBAN and a country-mismatched IBAN are refused with the exact messages and codes.
- AC-3: The name check runs on add and on a sensitive edit; match continues freely; close, none and na need the tick; Use corrects the name.
- AC-4: A payee is Verified only after match (or corrected close); otherwise Saved; abroad payees are never Verified.
- AC-5: The same details twice give `BENEFICIARY_EXISTS`; the 51st payee gives `BENEFICIARY_LIMIT`.
- AC-6: A new or sensitively changed payee is limited to 500.00 USD for 24 hours, and the review and result say so.
- AC-7: Changing only the nickname or label asks for no check and no code and does not restart the 24 hours.
- AC-8: A payee used by a scheduled payment cannot be deleted unless the person cancels the schedules (when the option allows).
- AC-9: Opened from a transfer, the journey returns to it.
- AC-10: Three wrong codes save nothing; timeout and unavailable states save nothing and say so.
- AC-11: With `nameCheck` off every bank payee shows "couldn't check"; with `labels` off no label is offered.

#### 9. Scenarios

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-4, AC-6 | `alex` | none | Add Europe, "Camille Dubois", her IBAN: green; consent; any six digits. Saved, chip Verified, "$500.00 for 24 hours". |
| T-2 | AC-1 | `alex` | none | Add BankWorkx® customer 3301123308: found Taylor Brooks (if not already saved; else `BENEFICIARY_EXISTS`); 0000000000 gives `CUSTOMER_NOT_FOUND`. Add abroad Aiko Tanaka: saved as Saved. |
| T-3 | AC-2 | `alex` | none | US routing `123456789` gives `INVALID_ROUTING`; Europe `DE89 3704 0044 0532 0130 01` `INVALID_IBAN`; a GB IBAN `NOT_SEPA`; UK `20-00` `INVALID_SORT_CODE`; Saudi Arabia with an AE IBAN `COUNTRY_MISMATCH`; BIC `ABC` `INVALID_BIC`. |
| T-4 | AC-3, AC-4 | `alex` | none | "Lena Fisher" with her IBAN: amber, Use turns it green, Verified; "Bob Smith": red, saved only after the tick, chip Saved. |
| T-5 | AC-3, AC-11 | `alex` | option `nameCheck` off | Any bank payee: grey "couldn't check", tick required, chip Saved. |
| T-6 | AC-5 | `alex` | none | Add James Whitfield's UK details again: `BENEFICIARY_EXISTS`. |
| T-7 | AC-6, AC-7 | `alex` | none | Edit Lena's IBAN: check re-runs, code asked, chip "New · 24 hours left". Edit only the nickname: no check, no code, no chip. |
| T-8 | AC-8 | `alex` | none | Delete James Whitfield: `BENEFICIARY_IN_USE`; tick "Also cancel these scheduled payments": deleted, "Scheduled payments cancelled 1". With option `allowCancelSchedules` off the switch is absent and the delete stays blocked. |
| T-9 | AC-9 | `alex` | none | From `single-transfer` empty state add a payee: result button returns to the form. |
| T-10 | AC-10 | `alex` | none | Three wrong codes on add (sandbox): `locked`; list unchanged. |
| T-11 | AC-10 | `alex` | `timeout: ["bank.payees.save"]`, `latencyMs: 10000` | Timeout copy "This is taking longer than expected. Nothing was changed."; list unchanged. |
| T-12 | AC-10 | `alex` | `unavailable: ["bank.payees.validate"]` | `unavailable` screen on **Check details**; list unchanged. |
| T-13 | AC-5 | `alex`, 50 payees seeded | none | The 51st gives `BENEFICIARY_LIMIT`. |

#### 10. Expected mutation-check survivors

The wrong-code lockout is a sandbox rule the prototype does not simulate. The IBAN length table survives for countries not used in scenarios. Message text and registry names are fixture data. `BENEFICIARY_LIMIT` survives without 50 seeded payees (T-13 kills it if seeded).

---

### ★ Schedule a payment — `schedule-payment`

Catalog: `schedule-payment`, workspace personal, category Payments, core no, a bank can switch it off (yes). Options: `allowOwn` "Allow schedules between own accounts" (default on); `allowBills` "Allow scheduling a saved bill (full balance or minimum due)" (default on); `allowPrevDay` "Let the person choose “previous business day” for closed days" (default on); `allowRetry` "Offer “try once more next business day” when there isn't enough money" (default on); `allowSkip` "Offer “skip only the next payment” when cancelling" (default on); `strictCutoff` "Close changes at 09:00 the business day before (default 18:00)" (default off).

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `schedule-payment` |
| Purpose | Pay a payee, one of the customer's own accounts, or a saved bill on a future date or on a repeat (once, weekly, every 2 weeks, monthly, quarterly), with an end rule, a choice for closed days, a choice for "not enough money", and reminders. The same journey changes a schedule (mode `edit`) and cancels or skips one (mode `cancel`). |
| Release / workspace | 1 / Personal |
| Status | Built in the prototype (`design/bankworkx-r1/src/journeys/35-schedule-payment.js`, research `research/schedule-payment.md`). Replaces the earlier spec, which had four kinds (once, weekly, monthly, standing order) and was a separate journey for cancelling. `cancel-standing-order` is now an alias (below). |
| Channels | Web and mobile |
| Starting pattern | `fixtures/local-transfer.ts` for the payee and the rail; the schedule form, the calendar and the cut-off are new. |
| Who may use it | Permission `payments.schedule` (the prototype checks only this one; creating also needs the payee to exist). |
| Modes and launch parameters | New: no parameters (optional `payeeId` or `savedBillId` fill "To"). Change: `{scheduleId}` (mode `edit` is the default when a `scheduleId` is given). Cancel or skip: `{scheduleId, mode: "cancel"}`. |
| Shared reference | `09-payment-rails.md` sections 2 (rails and cut-offs), 5 (FX), 8 (when and repeats), 9 (limits), 12 (codes). Where this block differs from 09 section 8, this block follows the prototype (see the report). |

**Rules that are the same in every mode.** Nothing is taken when the schedule is made. On each date the bank checks the balance, the limits, the rate and the payee again and pays at 06:00 UTC. After two failed payments in a row the schedule is paused. Changing or cancelling is possible until 18:00 on the business day before the next payment (09:00 if `strictCutoff` is on). On the day itself the schedule is "Running now" and cannot be changed (`SCHEDULE_RUNNING`). A person can have up to 20 active schedules. Cancelling asks for no code; creating and changing ask for one.

**Frequencies and limits.** Once; every week (up to 104 payments); every 2 weeks (up to 52); every month (up to 60); every 3 months (up to 40). Monthly and quarterly runs keep the day of the first date and use the last day of a shorter month (31 Jan runs 28 Feb, 31 Mar, 30 Apr). The first date is from tomorrow to 12 months ahead.

**Closed days (synthetic calendars).** Every region treats 9 Nov 2026 as a closed day ("Sandbox closed day") so a tester can see a move. Weekends are Saturday and Sunday in the United States, United Kingdom, Europe and UAE, and Friday and Saturday in Saudi Arabia and Jordan. Holidays include: US 11 Nov Veterans Day, 26 Nov Thanksgiving, 25 Dec; UK 25 and 28 Dec, 1 Jan, 26 and 29 Mar 2027; Europe 25 and 26 Dec, 1 Jan, 26 and 29 Mar, 1 May 2027; UAE 2 and 3 Dec, 1 Jan; Saudi Arabia 22 Feb 2027; Jordan 25 Dec, 1 Jan, 25 May 2027. A payment on a closed day goes on the next business day, or the previous one if the person chose that and `allowPrevDay` is on.

**Sandbox demo values.** Today is Tue 3 Nov 2026, 10:42 UTC. Eight schedules are already in the list:

| Id | Pays | How often | Next | Notes |
|---|---|---|---|---|
| `SCH-1001` | Rent, Harbor Estates ••8841 (ACH) | Monthly, $1,450.00 | Tue 1 Dec 2026 | 11 paid; reminder 3 days before |
| `SCH-1002` | Savings top-up, own account Savings ••7720 | Weekly, $100.00 | Fri 6 Nov 2026 | 40 paid |
| `SCH-1003` | Northfield Auto Insurance (bill, full balance, never more than $400.00) | Quarterly | Wed 4 Nov 2026 | Changes close today 18:00; with `strictCutoff` on, `SCHEDULE_CUTOFF_PASSED` |
| `SCH-1004` | Peak Fitness (ACH) | Monthly, $39.99 | Tue 3 Nov 2026 | "Running now": change or cancel gives `SCHEDULE_RUNNING` |
| `SCH-1005` | Lena Fischer, Europe (SEPA Credit Transfer) | Monthly, €200.00 | Mon 16 Nov 2026 | 5 of 12 paid |
| `SCH-1006` | Maya Chen, United States (ACH) | Once, $250.00 | Thu 12 Nov 2026 | 11 Nov is Veterans Day, so changes close Tue 10 Nov 18:00 |
| `SCH-1007` | James Whitfield, United Kingdom (Faster Payments) | Every 2 weeks, £100.00 | Fri 13 Nov 2026 | Ends 26 Mar 2027; closed days move to the previous business day |
| `SCH-1008` | Omar Haddad, UAE (Aani) | Monthly, AED 500.00 | Fri 20 Nov 2026 | Paused; "if not enough money" = skip and pause |

Also an ended schedule `SCH-0900` ("Old gym") that gives `SCHEDULE_NOT_ACTIVE`, and any unknown id gives `SCHEDULE_NOT_FOUND`. Payees: Maya Chen (US), Lena Fischer (Europe), James Whitfield (UK), Omar Haddad (UAE). Saved bills for the "A saved bill" kind are the ones from `pay-bill`. A tester reproduces the 20-schedule limit by adding twelve more schedules to the eight above. For a closed-day move choose Monday 9 Nov 2026.

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Payments › scheduled › New | none | `payments.schedule` |
| Payments › scheduled › row › Change | `{scheduleId}` | `payments.schedule` |
| Payments › scheduled › row › Cancel | `{scheduleId, mode: "cancel"}` | `payments.schedule` |
| Home › Upcoming payment › Edit | `{scheduleId}` | `payments.schedule` |
| Payments › beneficiaries › Schedule instead | `{payeeId}` | `payments.schedule` |
| Pay a bill › receipt › Schedule a bill | none | `payments.schedule` |
| Payments › tracker › payment (Scheduled) › Cancel | `{scheduleId, mode: "cancel"}` | `payments.schedule` |

If `schedule-payment` is switched off, all of these disappear and a forced open gives `JOURNEY_DISABLED`. Cancelling is not a separate catalog entry any more: `cancel-standing-order` links resolve to this journey in cancel mode.

#### 3. Screens

Step order by mode: **New**: `what`, `plan`, `rules`, `review`, code sheet, result. **Change**: `load`, `plan`, `rules`, `review`, code sheet, result. **Cancel**: `load`, `cancel`, result (no code). The progress bar counts only the steps that apply ("Step n of 4" for new and change, "Step n of 2" for cancel).

**`load`: "Change a payment" / "Cancel a payment"** (change and cancel only). Intro: "Check this is the payment you mean." Card: payee name and detail, a chip (Active, Running now, Paused, Cancelled, Ended), rows Amount ("$1,450.00", "Full balance of the bill" or "Minimum due on the bill"), How often, Next payment (the day it really goes), Payments left ("Until you cancel" or a number), Paid so far, Sent by (rail), and a lock line: "Changes for the {date} payment close at 18:00 {today or date}." or "This payment can't be changed right now." Button **Change this payment** or **Continue to cancel**; busy "Getting your scheduled payment…" (0.7 s). Errors on this step: `SCHEDULE_NOT_FOUND`, `SCHEDULE_NOT_ACTIVE` (cancelled or ended), `SCHEDULE_RUNNING` (running now, or the next date is today or earlier), `SCHEDULE_CUTOFF_PASSED` (message adds the time: "The cut-off for the Wed 4 Nov payment passed at 09:00 today. Change or cancel it after it runs to affect the one after.").

**`what`: "What are you scheduling?"** (new only). Intro: "Pick who gets the money and which account it comes from."

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| I want to pay | chips: A payee; My other account (if `allowOwn`); A saved bill (if `allowBills`) | Yes (default A payee) | One of the list; changing it clears "To" | none |
| From | select, "{name} ••{last four} · {available}" | Yes | An own account. For "My other account" it must differ from "To" | "Choose an account to pay from." / "Choose two different accounts. (SAME_ACCOUNT)" |
| To | cards. Payee: every saved payee with country and bank detail and the payee's currency. Own account: the other accounts in the same currency as From, others greyed with "different currency". Saved bill: the saved bills with biller and last four digits and currency | Yes | Chosen | "Choose who to pay." |

With "A saved bill" and none saved: **No saved bills yet** / "Pay a bill first and choose “Save this bill”. Then you can schedule it here." Button **Continue**.

**`plan`: "When and how much?"** (new and change). A card shows who is paid (a chip "Locked" in change mode with "To change who you pay or the account, cancel this and make a new one."), a hint "Instant payments go out at 06:00 UTC on the day." or "Goes out on the day, before the cut-off for {rail}.", and "Closed days for {region}: {weekend}; next holidays: {three upcoming}. (Sandbox calendar.)". In change mode a lock line shows when changes close.

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| Amount | chips (saved bill only): Fixed amount; Full balance of the bill; Minimum due (card billers) | Yes | One of the list | none |
| They receive ({currency}) | amount with the payee's currency symbol, placeholder "0.00" (fixed amount only) | Yes | Above 0, within the rail maximum in the payee's currency, and the USD value within the remaining daily limit ($41,250.00) | "That's over the {rail} limit of {symbol}{limit}. Choose another way to send it. (RAIL_LIMIT)" / "That's over your remaining daily limit of $41,250.00. (DAILY_LIMIT_EXCEEDED)" |
| Never pay more than | amount (bill amount modes only), placeholder "Optional", hint "The bill is looked up on the day. If it is higher than this, we skip it and tell you." | No | none | none |
| How fast? | cards, one per rail of the payee's region, with arrival time, maximum, fee and an "Instant" chip; a rail the amount does not fit is greyed (new payee schedules with more than one rail only) | Yes when shown | A rail whose maximum is at least the amount | none |
| Purpose of payment | select: Family support, Goods or services, Salary, Rent, Education, Savings or investment, Other (Middle East and international payees only) | Yes when shown | One of the list | "Choose a purpose for this payment. (PURPOSE_REQUIRED)" |
| How often | chips: Once, Every week, Every 2 weeks, Every month, Every 3 months | Yes (default Every month) | Choosing Once sets "It ends" to Never | none |
| Payment date / First payment / Next payment date (change) | select of every day from tomorrow for 365 days; closed days are marked "· closed: {reason}" | Yes | After today, within 12 months | "Choose a date from tomorrow." / "Choose a date from tomorrow. (DATE_TOO_SOON)" / "Choose a date within the next 12 months. (DATE_TOO_FAR)". Hint: "{date} is a closed day ({reason}). It will go on {date}." or "A business day. It goes out on this date." |
| If a payment date is a closed day, pay on the | chips: Next business day; Previous business day (shown if `allowPrevDay`) | Yes (default Next) | none | none |
| It ends | chips: Never; On a date; After a number of payments (not for Once) | Yes (default Never) | none | none |
| Last payment on | select of the run dates after the first (up to 60), "Payment n · date" | Yes when "On a date" | A run date after the first | "Choose when it ends." / "Choose a last payment date after the first. (END_BEFORE_START)" |
| Number of payments | number | Yes when "After a number of payments" | Whole number from 2 to 104 weekly, 52 every 2 weeks, 60 monthly, 40 every 3 months | "Enter how many payments." / "Enter a number from 2 to {max}. (INVALID_COUNT)" |
| Reference | text, optional; max 80 (US payee), 18 (UK), 140 (other payees), 40 (own accounts), 30 (bills) | No | The field stops extra characters | none |

Live summary: They receive (a fixed amount, "Full bill, about {x}" or "Set on the day"); Rate "1 {your currency} = {rate} {payee currency} today. Set again on the day." (other currency); Fee; **You pay (estimate)**; "Next payments" showing the next three run dates, each with the real day when a closed day moves it "(closed: {reason})"; Total ("Until you cancel" or "n payments · total"); Last payment. A grey hint appears when today's available balance is lower than the payment: "That's fine: we check again on the day." Button **Continue**.

**`rules`: "If something goes wrong"**. Intro: "We check everything again on the day: balance, limits, the rate and the payee."

| Field | Block | Required | Options |
|---|---|---|---|
| If there isn't enough money | cards | Yes (default skip) | **Skip it and tell me** ("Nothing is taken. The next one still runs."); **Try once more on the next business day** ("One retry. If it fails again it is skipped."; greyed unless `allowRetry`); **Skip it and pause the schedule** ("You resume it when you are ready.") |
| Remind me | chips | Yes (default 1 day before) | No reminder; 1 day before; 3 days before |
| In the app / By SMS to ••• 4410 / By email | toggles (when a reminder is on) | No | App on by default, SMS and email off |
| Warn me if the account is short | toggle, sub "The reminder says so when the balance is below the payment." (when a reminder is on) | No | On by default |

**`review`: "Review schedule"**. Intro: "Check the details. We'll send a code to confirm." Busy "Checking with the bank…" (0.8 s). Rows: Pay (name and detail); From (new); Amount; How often; Payment date or First payment (with "(moved from {date})"); Last payment and Number of payments (repeating); Sent by ("{rail}" plus " · 06:00 UTC" for instant rails); Estimated cost each time ("{x} (rate set on the day)"); Purpose; Reference; If there isn't enough money; Reminder. In change mode a second card **What changes** lists each changed item as "old  →  new" (Amount, How often, Next payment, Reference, Not enough money, and "Status Paused → Active") or "Nothing has changed". Info: "We take the money at 06:00 UTC on each date and check it again. If a payment can't go, we tell you. After two failed payments in a row, the schedule is paused. You can change or cancel until 18:00 on the business day before." Consent (required): **I authorise BankWorkx® to make these payments from my account on the dates shown**; "Tick the box to confirm." Button **Schedule payment** (new) or **Save changes** (change). Bank checks at this step: `SCHEDULE_LIMIT` (20 active), `BENEFICIARY_NOT_FOUND`, `RAIL_LIMIT`, `DAILY_LIMIT_EXCEEDED`, `SAME_ACCOUNT`, and for a change `SCHEDULE_CUTOFF_PASSED` again.

**Code sheet.** New: "Authorise a schedule of {amount} to {payee}" (or "the full bill" / "the minimum due"); change: "Authorise the change to your payment to {payee}"; sub "Code sent to ••• 4410. It only works for this schedule." Same code rules as `pay-bill` (code `482100`; the prototype keypad accepts any six digits).

**`cancel`: "Cancel this payment?"** (cancel only). Intro: "Cancelling stops the payments you choose. Payments already sent are not affected." The `load` card repeats.

| Field | Block | Required | Validation |
|---|---|---|---|
| What to cancel | cards: **All future payments** ("The schedule ends today.") or **Only the next payment** ("Skip {date}. The schedule carries on after that.") | Yes (default All); shown only if `allowSkip`, the schedule repeats, and more than one payment is left | one of the two |
| Why? (optional) | select: I don't need it any more; The amount was wrong; I'm paying another way; Other | No | none |

Lock line: "No code is needed to cancel: it can only reduce what leaves your account." Button **Cancel this payment**; busy "Cancelling…". Errors: `SCHEDULE_NOT_ACTIVE`, `SCHEDULE_RUNNING`, `SCHEDULE_CUTOFF_PASSED`.

**Results.** New: **Payment scheduled**, "{amount} to {payee}, {how often}, starting {date}.", chip "Scheduled"; rows Pay, From, Amount, How often, First payment, Last payment, Number of payments, Sent by, If there isn't enough money, Reminder, Schedule (`SCH-` and 5 digits); buttons **View scheduled**, **Schedule another**. Change: **Schedule updated**, "Your payment to {payee} now runs {how often}, next on {date}.", chip "Active" (a paused schedule becomes Active); buttons **View scheduled**. Cancel all: **Payment cancelled**, "No more payments will go to {payee}.", chip "Cancelled"; rows Pay, Amount, How often, Payments sent, Would have paid next, Cancelled on "3 Nov 2026", Reason, Schedule; buttons **Back to scheduled**, **Schedule a new payment**. Skip next: **Next payment skipped**, "The {date} payment to {payee} won't go. The schedule carries on from {date}.", chip "Skipped one"; buttons **Back to scheduled**. A cancelled schedule moves to the archive (later opens give `SCHEDULE_NOT_ACTIVE`).

**Other states.** Sandbox "Backend will time out on submit" shows banner `TIMEOUT` on a calling step ("Nothing was changed." because scheduling is not itself money-moving). "Bank unavailable" shows the sheet "We couldn't reach the bank". Both only apply to steps that call the bank (`load`, `review`, `cancel`).

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `SCHEDULE_NOT_FOUND` | "We can't find that scheduled payment." | `load` | Back to scheduled |
| `SCHEDULE_NOT_ACTIVE` | "This scheduled payment has already ended or been cancelled." | `load`, `cancel` | Back to scheduled |
| `SCHEDULE_RUNNING` | "This payment is being processed right now and can't be changed or cancelled. Change it tomorrow to affect the next one." | `load`, `cancel` | Back |
| `SCHEDULE_CUTOFF_PASSED` | "The cut-off for the next payment has passed. Change or cancel it after it runs to affect the one after." (the prototype adds the exact time) | `load`, `review`, `cancel` | Back |
| `SCHEDULE_LIMIT` | "You can have up to 20 scheduled payments. Cancel one to add another." | `review` | Back to scheduled |
| `PURPOSE_REQUIRED` | "Choose a purpose for this payment." | `plan` field | Choose purpose |
| `RAIL_LIMIT` | "That's over the {rail} limit of {symbol}{limit}. Choose another way to send it." | `plan` | Choose another speed |
| `DAILY_LIMIT_EXCEEDED` | "That's over your remaining daily limit of $41,250.00." | `plan` | Change amount |
| `SAME_ACCOUNT` | "Choose two different accounts." | `what` | Choose account |
| `DATE_TOO_SOON` | "Choose a date from tomorrow." | `plan` | Choose date |
| `DATE_TOO_FAR` | "Choose a date within the next 12 months." | `plan` | Choose date |
| `INVALID_COUNT` | "Enter a number from 2 to {max}." | `plan` | Edit |
| `END_BEFORE_START` | "Choose a last payment date after the first." | `plan` | Edit |
| `BENEFICIARY_NOT_FOUND` | "We can't find that payee. Choose another." | `review` | Choose payee |
| `NOT_SUPPORTED` | "This kind of payment can't be scheduled." | `what` | Back |
| `OTP_INVALID`, `OTP_REQUIRED`, `CORE_UNAVAILABLE` | README 1.6 wording | Code sheet / failure | As README |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed." | Banner on the calling step | Try again |
| `SERVICE_UNAVAILABLE` | "We couldn't reach the bank." sheet | Sheet | Try again |
| `JOURNEY_DISABLED` | "This isn't available at your bank." | Whole journey | Back |

#### 5. Adapters

Nothing in the sandbox handles schedules yet (`bank.schedules.*` do not exist in `packages/mock-bank-api/src/index.ts`); the prototype keeps schedules in memory. All schedule adapters are (planned).

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `accounts`, `payees`, `limits` | `bank.accounts.list`, `bank.beneficiaries.list`, `bank.limits.get` | none | as other transfers | `LIMIT_NOT_SET` | Existing |
| `quote` | `bank.fx.quote` | `{from, to, amount}` | indicative rate, not held | `INVALID_AMOUNT` | Existing |
| `calendar` | `bank.calendar.get` | `{region, from, to}` | closed days | none | (planned) |
| `list`, `get` | `bank.schedules.list`, `bank.schedules.get` | `{}` / `{scheduleId}` | schedule: payee or bill, amount mode, cap, frequency, next date, closed-day policy, end rule, runs, status, "not enough money" rule, reminders, `canChangeUntil` | `SCHEDULE_NOT_FOUND`, `SCHEDULE_NOT_ACTIVE` | (planned) |
| `create` | `bank.schedules.create` | `{kind: "payee"\|"own"\|"bill", fromAccountId, payeeId?, toAccountId?, savedBillId?, amountMode, amount?, cap?, railId, purpose?, frequency, firstOn, closedDayPolicy, end: {type, date?, count?}, reference?, onNoFunds, reminders}` | `{scheduleId (SCH-…), status: "active", nextRunOn, runsLeft}` | `SCHEDULE_LIMIT`, `BENEFICIARY_NOT_FOUND`, `ACCOUNT_NOT_FOUND`, `SAME_ACCOUNT`, `INVALID_AMOUNT`, `RAIL_LIMIT`, `DAILY_LIMIT_EXCEEDED`, `PURPOSE_REQUIRED`, `DATE_TOO_SOON`, `DATE_TOO_FAR`, `INVALID_COUNT`, `END_BEFORE_START`, `OTP_REQUIRED`, `CORE_UNAVAILABLE`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned). `moneyMoving: false` (money moves on each run); code needed |
| `update` | `bank.schedules.update` | `{scheduleId, ...fields above except payee and account}` | the schedule; a paused schedule becomes active | the codes of `create` plus `SCHEDULE_NOT_FOUND`, `SCHEDULE_NOT_ACTIVE`, `SCHEDULE_RUNNING`, `SCHEDULE_CUTOFF_PASSED` | (planned). Code needed |
| `cancel` | `bank.schedules.cancel` | `{scheduleId, scope: "all"\|"next", reason?}` | `{status: "cancelled"\|"active", nextRunOn?, cancelledOn}` | `SCHEDULE_NOT_FOUND`, `SCHEDULE_NOT_ACTIVE`, `SCHEDULE_RUNNING`, `SCHEDULE_CUTOFF_PASSED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned). `moneyMoving: false`; no code |
| (system) | `bank.schedules.runDue` | `{now}` (sandbox only) | runs due schedules through the payment adapters at 06:00 UTC; two failures pause a schedule | none | (planned). Lets a scenario move time forward |

#### 6. Permissions, step-up and limits

`payments.schedule`. Step-up `otp` to create or change (the code names the amount and the payee); `none` to cancel or skip (stated reason: it can only reduce what leaves the account). Up to 20 active schedules. Balance, limits, rate and payee are checked on every run, and the daily limit is tested on the USD value. A change closes at 18:00 on the business day before the next payment (09:00 with `strictCutoff`); on the payment day `SCHEDULE_RUNNING`. The Business workspace refuses the journey with `WRONG_CONTEXT`.

#### 7. Result and links out

Receipts as in section 3. Notifications (planned): the reminder (1 or 3 days before, by the chosen channels, with a low-balance warning when on); "Payment sent" after each run; "Payment skipped, not enough money" or "Schedule paused" after a failure; "Schedule changed" and "Schedule cancelled" confirmations. The Payments tab shows each schedule as "Frequency · next date · n left · Paused · Running now". Links out: **View scheduled**, **Schedule another**, **Back to scheduled**, **Schedule a new payment**.

#### 8. Acceptance criteria

- AC-1: A schedule can be made once, weekly, every 2 weeks, monthly or every 3 months for a payee, an own account, or a saved bill, only after consent and a verified code, and nothing is taken at that time.
- AC-2: The first date must be from tomorrow and within 12 months; a closed first date is shown with the day it will really go, and the next three run dates are shown before review.
- AC-3: A monthly schedule on the 29th to 31st uses the last day of shorter months; the end rule "on a date" lists only real run dates and "after a number" accepts 2 to the frequency's maximum.
- AC-4: A closed day moves the payment to the next business day, or to the previous one when the person chose that and `allowPrevDay` is on.
- AC-5: An amount over the rail's maximum or over the remaining daily limit is refused before review; a payee in the Middle East or abroad needs a purpose.
- AC-6: The "if there isn't enough money" choice and the reminder choices are saved and shown on the review and the receipt; "try once more" is unavailable when `allowRetry` is off.
- AC-7: A saved bill can be scheduled for the full balance or the minimum due with an optional "never more than" cap.
- AC-8: A change keeps who and which account fixed, shows what changes, needs a code, resumes a paused schedule, and is refused after the cut-off (`SCHEDULE_CUTOFF_PASSED`) or on the payment day (`SCHEDULE_RUNNING`).
- AC-9: Cancelling needs no code, can cancel all future payments or (with `allowSkip`) only the next one, and an already cancelled or ended schedule gives `SCHEDULE_NOT_ACTIVE`.
- AC-10: More than 20 active schedules are refused (`SCHEDULE_LIMIT`).
- AC-11: A timeout or an unavailable bank changes nothing and says so; with the journey off the bank answers `JOURNEY_DISABLED`.

#### 9. Scenarios

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-2 | `alex` | none | New, A payee, Lena Fischer, from Current, €200.00, Every month, first Mon 16 Nov 2026, ends After 12 payments. Summary shows three dates and "12 payments · €2,400.00", last payment Sat 16 Oct 2027 moved to Mon 18 Oct. Code `482100`. Result "Payment scheduled", `SCH-` and 5 digits; Current balance unchanged. |
| T-2 | AC-2, AC-4 | `alex` | none | New, Maya Chen, $120.00, Once, date Mon 9 Nov 2026: hint says it will go Tue 10 Nov. Choose Previous business day: it goes Fri 6 Nov. |
| T-3 | AC-3 | `alex` | none | Monthly, first Sun 31 Jan 2027, Maya Chen: the three dates are 31 Jan (moved to Mon 1 Feb, closed: weekend), 28 Feb (moved to Mon 1 Mar) and 31 Mar. End "On a date" lists only these run dates; End "After a number" with `1` and `61` gives INVALID_COUNT ("Enter a number from 2 to 60. (INVALID_COUNT)"). |
| T-4 | AC-5 | `alex` | none | Omar Haddad, AED 60,000: RAIL_LIMIT on the 50,000 Aani limit; choose the other rail or lower the amount. Without a purpose: PURPOSE_REQUIRED. |
| T-5 | AC-6 | `alex` | `allowRetry` off | The "try once more" card is greyed. |
| T-6 | AC-7 | `alex` | none | A saved bill, Full balance, never more than $400.00, Quarterly: review says "Full balance of the bill". |
| T-7 | AC-8 | `alex` | none | Change `SCH-1005` (set amount €250.00): "What changes" lists `Amount €200.00 → €250.00`. Change `SCH-1008`: "Status Paused → Active". Change `SCH-1004`: `SCHEDULE_RUNNING`. |
| T-8 | AC-8 | `alex` | `strictCutoff` on | Change `SCH-1003`: `SCHEDULE_CUTOFF_PASSED` ("passed at 09:00 today"). With `strictCutoff` off the same change opens (cut-off 18:00 today). |
| T-9 | AC-9 | `alex` | none | Cancel `SCH-1002`, choose Only the next payment: "Next payment skipped", next payment Fri 13 Nov. Cancel `SCH-1006`: "Payment cancelled"; open `SCH-1006` again: `SCHEDULE_NOT_ACTIVE`. Open `SCH-0900`: `SCHEDULE_NOT_ACTIVE`; open `SCH-9999`: `SCHEDULE_NOT_FOUND`. No code is asked. |
| T-10 | AC-10 | `alex`, setup: 12 more active schedules | none | Review of a 21st: `SCHEDULE_LIMIT`. |
| T-11 | AC-11 | `alex` | `timeout: ["bank.schedules.create"]` | Review: banner TIMEOUT "Nothing was changed."; the list is unchanged. |
| T-12 | AC-11 | `alex` | `unavailable: ["bank.schedules.get"]` | Open Change: sheet SERVICE_UNAVAILABLE. |
| T-13 | AC-11 | `alex` | `schedule-payment` off | "Payments › scheduled › New" is hidden; forced open: JOURNEY_DISABLED. |

#### 10. Expected mutation-check survivors

- Calendar content other than 9 Nov and the US and Saudi weekend rules survives (only a few holidays are tested).
- Reminder channels (SMS, email) survive: the prototype saves them but nothing sends them.
- The 60-date cap on the "Last payment on" list and the maximum counts for fortnightly and quarterly survive without a test per frequency.
- `NOT_SUPPORTED` survives (the prototype has no way to reach it).
- The two-failures-in-a-row pause survives until `bank.schedules.runDue` exists (planned).

---

### ★ Cancel a standing order — `cancel-standing-order`

Catalog: `cancel-standing-order`, workspace personal, category Payments, core no, a bank can switch it off (only by switching off `schedule-payment`, which it is part of). Options: those of `schedule-payment`; the only one that touches this alias is `allowSkip` ("Offer “skip only the next payment” when cancelling", default on).

Alias of `schedule-payment`: reached by launching `schedule-payment` with `{scheduleId, mode: "cancel"}` from Payments › scheduled › row › Cancel (any frequency, including what used to be called a standing order), from Payments › tracker › payment (Scheduled) › Cancel, or from the old `cancel-standing-order` link, which opens that journey in cancel mode. The Meezan and older links keep the slug `cancel-standing-order` as an alias.

What differs from the full journey:

- Screens are `load` ("Cancel a payment", "Continue to cancel") and `cancel` ("Cancel this payment?"), then the result. There is no code; the progress bar reads "Step n of 2".
- The scope card (**All future payments** or **Only the next payment**) is shown only when `allowSkip` is on, the schedule repeats and more than one payment is left; with `allowSkip` off cancelling always ends the schedule.
- Results: "Payment cancelled" (chip "Cancelled", rows Pay, Amount, How often, Payments sent, Would have paid next, Cancelled on, Reason, Schedule) or "Next payment skipped".
- Errors: `SCHEDULE_NOT_FOUND`, `SCHEDULE_NOT_ACTIVE`, `SCHEDULE_RUNNING`, `SCHEDULE_CUTOFF_PASSED` (section 4 of `schedule-payment`). Acceptance criterion and scenarios: AC-9 and T-9 of `schedule-payment`.

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

**Catalog:** slug `cards`, workspace `personal`, category Cards (Personal: Cards), core no, can a bank switch it off: yes (a screen, a basic entry kept in the Lean preset). Options (all default on): **Show spending summary** (`showSpend`); **Show recent card transactions** (`showTx`); **Show digital wallet row** (`showWallet`); **Show saved cards row (for add money)** (`showSaved`). Research: `research/cards.md`. Built in `design/bankworkx-r1/src/journeys/24-cards.js`, which also holds the shared card data `CRD` used by `card-controls` and `activate-card`.

This block is the specification of the Cards tab. It supersedes the tables "Shell: Card carousel", "Shell: Card detail", "Shell: Card transactions" and "Shell: Controls overview" above for the behaviour that is built; keep them as the production data-source notes and the planned `cards` sandbox domain.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `cards` |
| Purpose | Show every card as a picture with its status, the right balance for its kind, quick actions that fit its status, a controls summary, digital wallets, spending this month and recent card transactions. |
| Release / workspace | 1 / Personal |
| Status | Built in the prototype as a screen (`view: true`, tab `card`). Freezing from the quick action is the one write here. |
| Channels | Web (two columns under the carousel) and mobile (one column) |
| Starting pattern | None |
| Who may use it | Anyone signed in to Personal with `accounts.view`. |

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Tab bar › Cards; left rail › Cards | none | `accounts.view` |
| Home › quick action › Cards | none | `accounts.view` |
| ⌘K command bar › Cards | none | `accounts.view` |
| `activate-card`, `card-controls`, `replace-card` results › Go to cards | `{cardId}` (selects that card) | `accounts.view` |

#### 3. Screens

One screen. Body order: heading, carousel, selected card header, status banner, then two columns: left (balance, quick actions, card transactions), right (controls summary, spending, wallets). Below: saved cards row and the prototype's sandbox links.

**Carousel.** Each card is a picture: "BankWorkx®", network name in capitals (`VISA DEBIT`, `MASTERCARD`), `•••• •••• •••• {last4}`, `{VIRTUAL · }{HOLDER} · {MM/YY}` and a corner label (`Frozen` with a snowflake, `Not activated`, `Blocked`, `Expired`, `Replaced`; nothing when active). Frozen cards are drawn grey, blocked, expired or replaced cards darker still. Tapping a card selects it (outline). Only the last four digits are ever shown; there is no show-number button here.

**Selected card header.** "{nickname} ••{last4}", "{Virtual }{network} {debit|credit} · expires {MM/YY}", and a status chip (Active, Inactive, Frozen, Blocked, Expired, Replaced).

**Balance block** (depends on the kind):

| Kind | Content |
|---|---|
| Debit | "Spends from {account name} ••{last}", the account's available balance, "Available balance · ledger {balance}" |
| Credit | "Available credit" (big), a used-share bar, Credit limit, Statement balance, Minimum payment, "Next payment due {date}" with a chip "In {n} days", button **Pay now** (opens a card-payment journey; a toast in the prototype) |
| Virtual | "Linked to {parent card}", Spend limit "{amount} a month", Spent this month, and "Full number and security code are shown only inside the virtual card journey, after you confirm it is you." |

**Status banner** (one at most):

| Status | Banner |
|---|---|
| Inactive | "Waiting to be activated. Only activate a card you have in your hands." and a button **Activate card** (`activate-card {cardId}`). If activation is locked: "Activation is locked after 3 wrong tries. (ACTIVATION_LOCKED)" and no button (the sandbox shows an Unlock link) |
| Frozen | "This card is frozen. New purchases and cash withdrawals are blocked. Refunds still arrive." and **Unfreeze card** (`card-controls {cardId, mode: "unfreeze"}`) |
| Blocked or expired | "This card is {blocked\|expired}. It can't be used again." and **Replace card** (`replace-card {cardId, reason: "lost"}`) |

**Quick actions** (buttons that start journeys; a button is not drawn when its journey is switched off or not permitted):

| Status | Actions |
|---|---|
| Active | **Freeze** (instant, no code), **Controls** (`card-controls {cardId, mode: "all"}`), **PIN** (`card-pin`, not for virtual cards), **Replace** (`replace-card`, not for virtual cards), **Add to wallet** (`card-controls {cardId, mode: "wallet"}`) |
| Frozen | **Unfreeze**, **Replace** |
| Inactive (not locked) | **Activate** |
| Blocked or expired | **Replace** |

**Freeze** acts at once: status becomes frozen, a toast says "Card frozen. New purchases and cash withdrawals are blocked.", the picture goes grey, and the linked card in the shared model is marked frozen. It makes the card safer, so no code. Only an active card can be frozen: otherwise "Only an active card can be frozen. (CARD_NOT_ACTIVE)". If the service is down the error sheet appears and nothing changes.

**Controls summary** (right column): title **Controls** and a **Change** button (active cards only). Chips: Contactless On/Off, Online On/Off, Cash machines On/Off (only when the card has a cash ceiling), "Abroad: Everywhere", "Abroad: On for your trip" or "Abroad: Off". Bars: "Spent today {amount} of {daily limit}", "Spent this month {amount} of {monthly limit}", "Cash today {amount} of {limit}" (cash cards only). A line: "Per purchase limit {amount} · contactless without PIN up to {amount}". Trips: "Trips: {country} {from} to {to}".

**Spending** (option `showSpend`): "Spending this month", the month total, "{from} to {to} · {n} categories", and the top four categories with bars. No spending: "No spending on this card yet."

**Digital wallets** (option `showWallet`): per wallet "{app} · {device}", "Token ending {tok} · added {date}", chip Active or Suspended; **Add to wallet** (active cards). Empty: "This card isn't in a phone wallet yet." A wallet token's last four differ from the card's last four.

**Card transactions** (option `showTx`): title, filter chips **All**, **Pending**, **Posted**, then rows "{merchant}", "{Today|date} · {In shop|Online|Cash machine}{ · country when not US}", signed amount (refunds in green with +), chip Pending. Tapping a row expands: Status, Time, Paid with ("Card ••9021" or "Apple Pay ••4471"), Original amount (foreign purchases, for example "GBP 331.20"), Reference, and for posted money-out items a **Report a problem** button (`dispute-transaction {cardId, transactionId}`); for pending items the text "You can report a problem once this has posted." Empty for the card: "No card spending yet" / "Purchases and cash withdrawals made with this card show here."; an empty filter: "Nothing here" with **Clear filter**.

**Saved cards row** (option `showSaved`): "Cards you saved to add money", for example "Visa ••4242 · Alex Morgan · 08/28" with chip Default, and **Add a card** (`add-card`).

| Control | Rule | Message |
|---|---|---|
| Selected card | Must be one of the person's cards | "We can't find that card. (CARD_NOT_FOUND)" |
| Transaction filter | All, Pending, Posted | none |

**States:** Loading: two card skeletons (300 by 184), a block skeleton and three rows for 600 ms. Empty (a new customer): "You don't have a BankWorkx® card yet", "Ask for a debit card, or open a virtual card once you have one." with **Find out how** (Explore › Products › Cards); the saved cards row still shows ("No saved cards yet."). Error: "We couldn't load your cards", "Nothing was changed on your cards. Try again in a moment." `SERVICE_UNAVAILABLE` and **Try again** (800 ms reload). Timeout after 10 seconds: the same card with "This is taking longer than expected. Nothing was changed." (planned).

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `CARD_NOT_FOUND` | "We can't find that card." | Whole screen | Back to cards |
| `SERVICE_UNAVAILABLE` | "We couldn't load your cards. Nothing was changed." | Whole screen, or error sheet on Freeze | Try again |
| `CARD_NOT_ACTIVE` | "Only an active card can be frozen." | Toast on Freeze | none |
| `ACTIVATION_LOCKED` | "Activation is locked after 3 wrong tries." | Inactive card banner | none (call us, or wait 30 minutes) |
| `TIMEOUT` (planned) | "This is taking longer than expected. Nothing was changed." | Whole screen | Try again |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `cards` | `bank.cards.list` | none | map of saved cards (`id`, `nickname`, `last4`, `isDefault`) | none | Existing (`packages/mock-bank-api/src/index.ts`); it lists only cards saved for adding money |
| `cardsOverview` | `bank.cards.overview` | none | BankWorkx® cards with `kind`, `network`, `status`, `accountId`, `credit` (limit, available, statement balance, minimum due, due date), `controls`, `limits`, `ceilings`, `used`, `trips`, `wallets[]` | `SERVICE_UNAVAILABLE`, `TIMEOUT` | (planned). The prototype keeps this in its own model `CRD` |
| `cardTransactions` | `bank.cards.transactions` | `{cardId, status?}` | rows with merchant, amount, status, channel, country, category, `via`, `originalAmount` | `CARD_NOT_FOUND` | (planned) |
| `cardFreeze` | `bank.cards.freeze` | `{cardId}` | `{cardId, status: "frozen"}` | `CARD_NOT_ACTIVE`, `CARD_NOT_FOUND`, `SERVICE_UNAVAILABLE` | (planned). No step-up because it only protects |

#### 6. Permissions, step-up and limits

`accounts.view` to see; `cards.manage` (planned) for Freeze and the buttons that start `card-controls`, `card-pin`, `replace-card`. Step-up: none for Freeze; the opened journeys apply their own. Card data rules: only the last four digits and the expiry are shown; the security code is never stored or shown (PCI). No limits.

#### 7. Result and links out

No result or receipt; a toast confirms Freeze. Notifications raised: "Your card ••{last4} was frozen" (push and email). Links out: `activate-card`, `card-controls` (modes `all`, `unfreeze`, `wallet`), `card-pin`, `replace-card`, `dispute-transaction`, `add-card`, a card-payment journey (planned), Explore › Products › Cards.

#### 8. Acceptance criteria

- AC-1: All of the person's cards show in the carousel with the last four digits, holder, expiry and a status label; a frozen card is grey with "Frozen", an inactive one says "Not activated".
- AC-2: The balance block matches the kind: debit shows the linked account's available and ledger balance, credit shows available credit, limit, statement balance, minimum payment and due date, virtual shows its parent card and monthly limit.
- AC-3: The quick actions match the status exactly as in the table in section 3; no virtual card shows PIN or Replace.
- AC-4: Freeze changes an active card to frozen at once without a code, shows the confirmation, and the carousel and banner update; a card that is not active cannot be frozen.
- AC-5: A frozen card offers Unfreeze (which goes through a code in `card-controls`) and never shows Freeze.
- AC-6: An inactive card shows the activation banner and the Activate button; a card locked by three wrong tries shows `ACTIVATION_LOCKED` and no button.
- AC-7: The controls summary shows the card's real switches, used-against-limit bars and the abroad mode; Change opens `card-controls` in mode `all`.
- AC-8: Transactions filter by All, Pending and Posted; an expanded posted purchase offers Report a problem and a pending one explains it must post first; a wallet payment shows the token ending, not the card's last four.
- AC-9: Each of the four options removes its own section and nothing else.
- AC-10: A new customer sees "You don't have a BankWorkx® card yet"; a service failure shows the error card with Try again, and a timeout shows the standard message.

#### 9. Scenarios

Sandbox demo values: four cards. `card_9021` Visa debit "Everyday debit" ••9021, 09/29, active, spends from Current ••4410 (available $8,102.40, ledger $8,240.18), wallet Apple Pay · Alex's iPhone 16, token 4471; limits per purchase $2,000, daily $3,000, monthly $15,000, cash $800, tap $100; used today $4.80, month $539.00; gambling blocked. `card_3318` Mastercard credit "Aurora credit" ••3318, 03/28, limit $5,000.00, available $3,640.20, statement $1,359.80, minimum $45.00, due 28 Nov 2026 (in 25 days), wallet Google Wallet · Pixel 9, token 8820. `card_7745` Visa debit "Spare debit" ••7745, 11/29, inactive, spends from Savings. `card_v1` virtual Visa "Online shopping" ••6150, 10/27, parent `card_9021`, $300 a month, $86.40 used. Today is Tue 3 Nov 2026. Card transactions on `card_9021` include pending "Brightside Coffee" -$4.80, "Northwind Market" -$64.20 (Apple Pay ••4471), "Skyline Travel Co." -$420.00 online from GB (GBP 331.20) and "Refund, Lakeside Outfitters" +$38.00. The prototype links "Show as a new customer", "Simulate a load error" and "Reset cards".

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-2 | `alex` | none | Open Cards. Four cards. Select each: debit shows $8,102.40 available and ledger $8,240.18; credit shows $3,640.20, due 28 Nov 2026 "In 25 days"; virtual shows "Linked to Everyday debit ••9021". |
| T-2 | AC-3 | `alex` | none | Active debit: Freeze, Controls, PIN, Replace, Add to wallet. Virtual: no PIN or Replace. Spare debit: Activate only. |
| T-3 | AC-4, AC-5 | `alex` | none | Freeze Everyday debit: confirmation toast, grey card, banner with Unfreeze, actions Unfreeze and Replace. Freezing again is not offered. |
| T-4 | AC-6 | `alex` | activation locked on `card_7745` (three wrong tries in `activate-card`) | Banner shows `ACTIVATION_LOCKED`, no Activate button. |
| T-5 | AC-7 | `alex` | none | Controls chips: Contactless On, Online On, Cash machines On, "Abroad: Everywhere"; bars "$4.80 of $3,000.00" and "$539.00 of $15,000.00". Change opens `card-controls`. |
| T-6 | AC-8 | `alex` | none | Filter Pending: one row. Expand "Northwind Market": "Apple Pay ••4471" and a Report a problem button. Expand pending coffee: the "post first" text. |
| T-7 | AC-9 | `alex` | each of `showSpend`, `showTx`, `showWallet`, `showSaved` off in turn | The matching section is gone. |
| T-8 | AC-10 | `sam` ("Show as a new customer") | `empty: ["bank.cards.overview"]` | Empty state and Find out how. |
| T-9 | AC-10 | `alex` | `unavailable: ["bank.cards.overview"]` (prototype: Simulate a load error) | Error card with `SERVICE_UNAVAILABLE`; Try again reloads. |
| T-10 | AC-10 | `alex` | `timeout: ["bank.cards.overview"]`, `latencyMs: 10000` (planned) | The timeout message after 10 seconds. |
| T-11 | AC-4 | `alex` | `unavailable: ["bank.cards.freeze"]` (prototype: Service down on) | Freeze shows the error sheet; the card stays active. |

#### 10. Expected mutation-check survivors

The rule that only active cards can be frozen is checked on the screen (the Freeze button is hidden for other statuses) and in the adapter (planned), so removing only the adapter check survives; expected. The 10-second timeout state has no prototype layer. All others: none expected.

---

### ★ Activate card — `activate-card`

**Catalog:** slug `activate-card`, workspace `personal`, category Cards (Personal: Cards), core no, can a bank switch it off: yes (basic entry, kept in the Lean preset). Options (both default on): **Ask for the 3-digit security code** (`askCvv`); **Let the customer set the PIN during activation** (`pinAtActivation`). Research: `research/activate-card.md`. Built in `design/bankworkx-r1/src/journeys/26-activate-card.js`; shared card data `CRD` is in `24-cards.js`.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `activate-card` |
| Purpose | Turn on a new card the customer has in their hands: prove it with the last 4 digits, the expiry and (option) the security code, optionally choose a PIN, confirm with a one-time code, and then offer wallet and controls. |
| Release / workspace | 1 / Personal |
| Status | Built in the prototype (`money: false`, submit "Activate card", busy "Activating your card…" 900 ms). |
| Channels | Web and mobile |
| Starting pattern | None |
| Who may use it | Anyone signed in to Personal with `cards.manage` (planned; the prototype uses `accounts.view`). |

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Cards › carousel › banner button **Activate card**, and quick action **Activate** (inactive card only) | `{cardId}` | `cards.manage` |
| Notification "Activate your new card" | `{cardId}` | `cards.manage` |
| Deep link `/personal/j/activate-card?cardId=card_7745` | `{cardId}` optional | `cards.manage` |

With no `cardId` and more than one inactive card a picker comes first; with one it is chosen for the person; with none the journey stops with `NO_INACTIVE_CARD`. The button is hidden while activation is locked.

#### 3. Screens

**`pick`: "Which card?"** (only when no `cardId` and more than one card waits). Field **Card** (select "{nickname} ••{last4}", required, message "Choose the card you want to activate."). Next runs the gate checks (errors below).

**`details`: "Activate your card"**, intro "Enter the details printed on the card." A warning card: "Only activate a card that you have in your hands. If the envelope was open, don't use the card: call us instead." and a card row (colour, "{nickname} ••{last4}", "{network} {kind}", status chip).

| Field | Block | Required | Validation | Message |
|---|---|---|---|---|
| Last 4 digits of the card number | text, 4 characters, placeholder `0000`, hint "Find it on the front of the card." plus "{n} tries left." after a wrong try | Yes | `^[0-9]{4}$` | "Enter the last 4 digits printed on your card." |
| Expiry date | text, 5 characters, `MM/YY`, half width | Yes | `^(0[1-9]\|1[0-2])/[0-9]{2}$`; not before the current month (Nov 2026) | "Enter the expiry as MM/YY." / "That date has passed. Check the expiry on your card. (EXPIRY_PAST)" |
| Security code | password, 3 digits, `•••`, half width, shown only when `askCvv` is on, hint "On the back of the card. We use it once to check the card and never keep it." | Yes (when shown) | `^[0-9]{3}$` | "Enter the 3-digit code from the back of the card." |

Button **Continue**, busy "Checking your card…" 800 ms. Checks on Next, in order: the card exists (`CARD_NOT_FOUND`); the gate (below); the details match (last 4 and expiry equal the card's, and the security code is not `000`). The security code field is cleared after every attempt, right or wrong. On a mismatch the message is always the same, never saying which detail was wrong: "The details don't match this card. Check them and try again. (ACTIVATION_MISMATCH)", and the hint then shows the tries left. The third mismatch sets the card's activation lock: "Too many wrong tries. Activation is locked. Call us or try again in 30 minutes. Nothing was changed on your card. (ACTIVATION_LOCKED)". A right answer resets the counter.

Gate checks (also on `pick`): no card waiting: "You have no cards waiting to be activated. (NO_INACTIVE_CARD)"; status active or frozen: "This card is already active. You can start using it. (CARD_ALREADY_ACTIVE)"; status blocked, expired or replaced: "This card was blocked and can't be activated. Ask for a replacement. (CARD_BLOCKED)"; locked: "Activation is locked after 3 wrong tries. Call us or try again in 30 minutes. (ACTIVATION_LOCKED)".

**`pin`: "Set your PIN"** (only when `pinAtActivation` is on), intro "You'll use it at cash machines and in shops that ask for it."

| Field | Block | Required | Shown when | Validation | Message |
|---|---|---|---|---|---|
| When? | chips Set it now, Later | No (Set it now) | always | none | none |
| New PIN | password, 4 characters, placeholder "4 digits", hint "4 digits. Not 1111 or 1234, not your birth year, birthday, or digits from your card or phone." | Yes | Set it now | exactly 4 digits and not weak (rules below) | per rule |
| Repeat PIN | password, 4 characters | Yes | Set it now | equals New PIN | "The two PINs don't match." |

Weak PIN rules and their messages: not 4 digits "Use exactly 4 digits. (PIN_INVALID)"; all the same digit "Choose a PIN that is harder to guess. Don't repeat one digit, like 1111. (PIN_WEAK)"; a straight run up or down "Choose a PIN that is harder to guess. Don't use a run like 1234 or 4321. (PIN_WEAK)"; pairs "Choose a PIN that is harder to guess. Don't use pairs like 1212 or 1122. (PIN_WEAK)"; the birth year (sandbox 1990) "Don't use your birth year. (PIN_WEAK)"; the birth day and month in either order (0412, 1204) "Don't use your birthday. (PIN_WEAK)"; the card's last four, the phone's last four (0142) or the account's last four (4410) "Don't use digits from your card, account or phone number. (PIN_WEAK)"; a short common list (2580, 0852, 1357, 2468, 6969, 1004) "That PIN is very common. Choose another. (PIN_WEAK)". A note: with "Set it now" - "Your PIN is sent to the card system scrambled. BankWorkx® can't read it, never shows it and never sends it by message."; with "Later" - "You can set it later in Cards › PIN. Until then, cash machines and chip-and-PIN shops won't accept the card. Taps and online payments still work if they are on."

**`code`: "Confirm with your code"**, intro "We sent a 6-digit code to the phone ending 0142." Field **One-time code** (text, 6 digits, required, placeholder "6 digits", hint "{n} tries left. Prototype code: 482100."), message "Enter the 6-digit code.". Button **Activate card**, busy "Activating your card…" 900 ms. On Next the card must still be inactive (else `CARD_ALREADY_ACTIVE`). Wrong code: "That code isn't right. Check the text message and try again. (OTP_INVALID)"; the third wrong code: "Too many wrong codes. Nothing was changed on your card. Go back to start again. (OTP_LOCKED)". The prototype accepts `482100` and `000000`.

**Result**: title "Card activated", text "Your card ending {last4} is ready to use.", chip "Active". Rows: Card ("{nickname} ••{last4}"), Status (Active), Activated (3 Nov 2026), PIN ("Set" or "Not set yet"), Online purchases ("On" or "Off. Turn on in Controls", from the card's own setting), Tap to pay ("Works after your first chip and PIN purchase or cash withdrawal"), Security code ("Not kept"). Buttons: **Add to Apple Wallet or Google Pay** (`card-controls {cardId, mode: "wallet"}`), **Set limits and controls** (`card-controls {cardId, mode: "all"}`), **Set my PIN** (`card-pin {cardId}`, only when no PIN was set), **Go to cards**.

**States:** loading is the busy spinner on Continue and Activate; empty is `NO_INACTIVE_CARD`; leaving before the code activates nothing and discards the typed values; timeout "This is taking longer than expected. Nothing was changed on your card."; unavailable "This service isn't available right now. Nothing was changed. Please try again in a few minutes."

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `CARD_NOT_FOUND` | "We can't find that card. Choose another." | `details` | Choose card |
| `NO_INACTIVE_CARD` | "You have no cards waiting to be activated." | `pick` / `details` | Go to cards |
| `CARD_ALREADY_ACTIVE` | "This card is already active. You can start using it." | `details`, `code` | Go to cards |
| `CARD_BLOCKED` | "This card was blocked and can't be activated. Ask for a replacement." | `details` | Replace card |
| `ACTIVATION_MISMATCH` | "The details don't match this card. Check them and try again." | `details` | Try again |
| `ACTIVATION_LOCKED` | "Too many wrong tries. Activation is locked. Call us or try again in 30 minutes. Nothing was changed on your card." | `details` | Contact us |
| `EXPIRY_PAST` | "That date has passed. Check the expiry on your card." | `details` | Edit |
| `PIN_INVALID` | "A PIN has exactly 4 digits." | `pin` | Edit |
| `PIN_WEAK` | "Choose a PIN that is harder to guess." (with the specific line above) | `pin` | Edit |
| `OTP_REQUIRED` | "Confirm with your one-time code first." | `code` | Back to code |
| `OTP_INVALID` | "That code isn't right. Check the text message and try again." | `code` | Try again |
| `OTP_LOCKED` | "Too many wrong codes. Nothing was changed on your card. Go back to start again." | `code` | Start again |
| `STEP_UP_REQUIRED` | "For your security, confirm it's you first." | `code` | Confirm |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed on your card." | engine error | Try again |
| `SERVICE_UNAVAILABLE` | "This service isn't available right now. Nothing was changed. Please try again in a few minutes." | engine error | Try again |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `cardsWaiting` | `bank.cards.listInactive` | none | cards with `status: "inactive"` | none | (planned). The existing `bank.cards.list` returns only saved cards (`packages/mock-bank-api/src/index.ts`) |
| `verifyCard` | `bank.cards.verifyActivation` | `{cardId, last4, expiry, cvv?}` | `{verified, triesLeft}` | `CARD_NOT_FOUND`, `CARD_ALREADY_ACTIVE`, `CARD_BLOCKED`, `ACTIVATION_MISMATCH`, `ACTIVATION_LOCKED`, `EXPIRY_PAST` | (planned). The security code is checked and dropped, never stored |
| `otpSend` | `bank.otp.send` | `{phone}` | `{sent}` | none | Existing |
| `otpVerify` | `bank.otp.verify` | `{code}` | `{verified}` | `OTP_INVALID` (carries `attempt`), `OTP_LOCKED` | Existing (`lockAfter: 3`) |
| `activateCard` | `bank.cards.activate` | `{cardId, pin?}` (PIN sent scrambled to the card system) | `{cardId, status: "active", activatedAt, pinSet}` | `CARD_ALREADY_ACTIVE`, `PIN_INVALID`, `PIN_WEAK`, `OTP_REQUIRED`, `STEP_UP_REQUIRED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned). Not money-moving |

#### 6. Permissions, step-up and limits

`cards.manage` (planned). Step-up: the one-time code in the last step (6 digits, 3 tries, resend after 30 s in production). Limits: 3 wrong sets of card details lock activation for that card (30 minutes in the message; the prototype lifts it only through the sandbox Unlock link); 3 wrong codes end the attempt. Card data rules: the security code and the PIN are never stored or echoed; the receipt says "Not kept". In a market that retires text codes the bank may swap the code step for app approval.

#### 7. Result and links out

Result as in section 3. Receipt: the result rows. Notifications raised: "Your card ••{last4} is active" (push and email), "PIN set" when applicable. Links out: `card-controls` (wallet, all), `card-pin`, Cards. A replacement card's activation ends the old card at that moment and says so on the receipt (planned).

#### 8. Acceptance criteria

- AC-1: With the right last 4 digits and expiry (and security code when asked) and the right one-time code, an inactive card becomes active, and the Cards screen shows it as Active.
- AC-2: A wrong detail shows the same neutral message ("The details don't match this card"), never which detail, with the tries left; the third wrong try locks activation and the Activate button disappears.
- AC-3: The security code is hidden as typed, cleared after every attempt, never shown on the result, and the field is absent when `askCvv` is off.
- AC-4: The expiry must be MM/YY and not in the past; a past date is refused on the form.
- AC-5: With `pinAtActivation` on the person can set a 4-digit PIN now (twice) or choose Later; weak PINs are refused with the specific message; with it off there is no PIN step and the result offers **Set my PIN**.
- AC-6: Three wrong one-time codes end with `OTP_LOCKED` and the card stays inactive; the right code (`482100`) activates.
- AC-7: An already active or frozen card, a blocked or expired card, and a user with no waiting card each get their own message and no activation.
- AC-8: The result states whether the PIN is set, whether online purchases are on, that taps work after the first chip-and-PIN use, and offers the wallet and controls.
- AC-9: On a timeout or an unavailable service the card stays inactive and the person is told nothing was changed.

#### 9. Scenarios

Sandbox demo values: `card_7745` Spare debit ••7745, expiry `11/29`, inactive, spends from Savings; the right security code is any three digits except `000`. Holder data for the PIN rules: birth year 1990, birthday 12 April (0412 / 1204), phone ending 0142, account ending 4410. Good PIN: `7391`. Weak PINs: `1111`, `1234`, `4321`, `1212`, `1990`, `0412`, `7745`, `0142`, `2580`. One-time code `482100` (also `000000`). Test launch `{cardId: "card_7745", smoke: 1}` fills everything. Today is Tue 3 Nov 2026.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-3, AC-5, AC-8 | `alex` | none | Open Activate on Spare debit. Enter `7745`, `11/29`, `123`, Continue; PIN Set it now `7391` twice; code `482100`. Result "Card activated", PIN "Set", Online purchases "Off. Turn on in Controls", Security code "Not kept". Cards shows Active. |
| T-2 | AC-2 | `alex` | none | Wrong last 4 (`1111`) then wrong expiry then wrong code `000`: each shows "The details don't match this card" and "2 tries left", "1 tries left"; the third shows `ACTIVATION_LOCKED`; the Cards banner shows the lock and no Activate button. The security code field is empty after each try. |
| T-3 | AC-4 | `alex` | none | Expiry `10/26`: "That date has passed. Check the expiry on your card." `13/29`: "Enter the expiry as MM/YY." |
| T-4 | AC-5 | `alex` | none | Each weak PIN in the list shows its own message; `7391` with a different repeat: "The two PINs don't match." Choose Later: note about cash machines; result PIN "Not set yet" and button **Set my PIN**. |
| T-5 | AC-5, AC-3 | `alex` | options `pinAtActivation` off, `askCvv` off | No security code field; no PIN step; result offers **Set my PIN**. |
| T-6 | AC-6 | `alex` | none | Valid details, code `111111` three times: `OTP_INVALID` twice with tries left, then `OTP_LOCKED`; the card is still inactive. |
| T-7 | AC-7 | `alex` | none | Open with `card_9021` (active): `CARD_ALREADY_ACTIVE`. Mark a card blocked (setup): `CARD_BLOCKED` with Replace. Activate the only waiting card, then open again: `NO_INACTIVE_CARD`. |
| T-8 | AC-9 | `alex` | `timeout: ["bank.cards.activate"]`, `latencyMs: 10000` (planned; prototype: Timeout on) | Timeout message; card still inactive. |
| T-9 | AC-9 | `alex` | `unavailable: ["bank.cards.activate"]` (prototype: Service down on) | Unavailable message; card still inactive. |

#### 10. Expected mutation-check survivors

The "never say which detail was wrong" rule has one source; a mutation that returns a different message for the expiry survives only if no scenario asserts the message text; T-2 asserts it, so none expected. `STEP_UP_REQUIRED` is not produced by the sandbox and survives. The 30-minute automatic unlock is not modelled in the prototype (only the Unlock link), so a mutation of its duration survives; expected. The mismatch rule exists on the form (shape) and in `bank.cards.verifyActivation` (planned); removing only the shape check for the 4-digit pattern survives T-2 because the adapter still refuses.

---

### ★ Card limits and controls — `card-controls`

**Catalog:** slug `card-controls`, workspace `personal`, category Cards (Personal: Cards), core no, can a bank switch it off: yes (basic entry, kept in the Lean preset). Options: **Offer a gambling block (off where gambling is barred by law)** (`offerGambling`, default off); **Offer the magnetic stripe switch** (`allowMagstripe`, default off); **Let customers lower the contactless limit** (`allowTapLimit`, default on); **A freeze still allows existing recurring payments** (`frozenAllowsRecurring`, default on). Research: `research/card-controls.md`. Built in `design/bankworkx-r1/src/journeys/25-card-controls.js`; shared card data `CRD` is in `24-cards.js`.

This block also covers `freeze-card` (freeze and unfreeze are the first step here) and holds the card limits; see the alias block for `freeze-card` after this one.

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `card-controls` |
| Purpose | Freeze or unfreeze a card, set spending limits, switch channels on or off, control use abroad with optional trip dates, block types of shop, choose alerts, and add or remove phone wallets, in one review. Tightening applies at once; loosening asks for a one-time code. |
| Release / workspace | 1 / Personal |
| Status | Built in the prototype (`money: false`, submit "Save changes", busy "Saving to your card…" 800 ms). |
| Channels | Web and mobile |
| Starting pattern | None (a wizard of short steps with a review that lists only what changes) |
| Who may use it | Anyone signed in to Personal with `cards.manage` (planned; the prototype uses `accounts.view`). |

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Cards › selected card › Controls or Change | `{cardId, mode: "all"}` | `cards.manage` |
| Cards › quick actions › Unfreeze, and the frozen banner | `{cardId, mode: "unfreeze"}` | `cards.manage` |
| Cards › quick actions › Add to wallet; wallet row | `{cardId, mode: "wallet"}` | `cards.manage` |
| Controls overview › a row | `{cardId, mode: "limits"\|"where"\|"merchants"\|"alerts"}` | `cards.manage` |
| `activate-card` result › Add to Apple Wallet or Google Pay / Set limits and controls | `{cardId, mode: "wallet"\|"all"}` | `cards.manage` |
| Deep link `/personal/j/card-controls?cardId=card_9021` | `{cardId, mode}` (default `all`) | `cards.manage` |

Other values of `mode`: `freeze` starts with the freeze switch on. With no `cardId` a card picker comes first and the first active non-virtual card is preselected.

#### 3. Screens

Steps run in this order and each shows only when it applies. A section other than status and wallets shows only for an **active** card and only when `mode` is `all` or that section's name. Wallets show for modes `all` and `wallet` for active or frozen cards.

**`pick`: "Which card?"** (only when no `cardId` was passed). Field **Card** (select "{nickname} ••{last4} · {status}", required, message "Choose the card you want to change."). The gate refuses a card that is not changeable (see errors).

**`freeze`: "Card status"** (modes `all`, `freeze`, `unfreeze`). Intro "Freeze the card if you can't find it. You can undo it any time." (unfreeze mode: "Unfreezing makes this card easier to use, so we will ask for a code."). A card row (picture colour, "{nickname} ••{last4}", "{Virtual }{network} {kind} · expires {MM/YY}", status chip).

| Field | Block | Required | Shown when | Rule | Message |
|---|---|---|---|---|---|
| Freeze this card | toggle, "Blocks new purchases and cash withdrawals straight away. Refunds still arrive." | No (current state) | always | The card is active (to freeze) or frozen (to unfreeze) | "You can change controls once the card is active. (CARD_NOT_ACTIVE)" / "This card isn't frozen. (CARD_NOT_FROZEN)" / "This card is already frozen. (CARD_ALREADY_FROZEN)" |
| Why? (optional) | chips Not sure, Misplaced, Suspicious payment, Lost or stolen, Not using it | No | freezing an active card | none | none |

If "Lost or stolen" is chosen a notice reads "If it may be lost or stolen, block it for good. A frozen card can be unfrozen by anyone who knows your sign-in. A blocked card can't." with **Block and replace** (`replace-card {reason: "lost"}`). A note on every freeze: "A freeze does not stop: refunds and credits{, and payments you already set up (subscriptions, bills)}. It does stop {new purchases, cash withdrawals and phone wallet payments | every purchase, cash withdrawal, wallet payment and recurring payment}. Banks differ here; this is how BankWorkx® works." The bracketed wording follows `frozenAllowsRecurring`.

**`limits`: "Spending limits"**, intro "Set how much can be spent. Bank ceilings are shown under each box." All amounts have a $ prefix.

| Field | Required | Rule | Hint |
|---|---|---|---|
| Per purchase (`perTx`) | Yes | 0 or more, 2 decimals at most; not above the card's ceiling; not above Daily | "The most you can pay in one go. Bank ceiling {ceiling}." |
| Daily purchases (`daily`) | Yes | same; not above Monthly | "Resets at midnight (UTC). Used today: {used}. Ceiling {ceiling}." |
| Monthly spending (`monthly`) | Yes | same | "Used this month: {used}. Ceiling {ceiling}." |
| Daily cash withdrawals (`atm`) | No (0 allowed) | shown only when the card has a cash ceiling above 0; 0 stops cash | "Cash taken today: {used}. Ceiling {ceiling}. Use 0 to stop cash withdrawals." |
| Contactless without PIN (`tap`) | No (0 allowed) | shown only when `allowTapLimit` is on and the card's tap ceiling is above 0 | "A tap above this amount asks for your PIN. Cannot be more than {ceiling}. Phone wallet payments use your phone's own check." |

| Check | Message |
|---|---|
| Not a number, or below 0 | "Use an amount of 0 or more, with 2 decimal places at most. (LIMIT_INVALID)" |
| Above the ceiling | "The most this card allows {for one purchase\|per day\|per month\|for cash\|without a PIN} is {ceiling}. Choose a smaller amount. (LIMIT_ABOVE_CEILING)" |
| Per purchase above daily | "A single purchase can't be more than your daily limit. (LIMIT_ORDER)" |
| Daily above monthly | "Your daily limit can't be more than your monthly limit. (LIMIT_ORDER)" |

Note under the fields: "Making a limit smaller takes effect straight away. Making it bigger needs a code. If you set a daily limit below what you spent today, it applies from tomorrow."

**`where`: "Where it works"**, intro "Switch off what you don't use. Fewer switches on means fewer ways for a thief."

| Field | Block | Required | Shown when | Rule | Message |
|---|---|---|---|---|---|
| Contactless | toggle, "Tap to pay in shops." | No | always | none | none |
| Online purchases | toggle, "Websites and apps. You may be asked to approve in the app." | No | always | none | none |
| Cash machines | toggle, "Withdraw cash with your PIN." | No | card has a cash ceiling | none | none |
| Magnetic stripe | toggle, "Only for shops that cannot read the chip. Keep off unless you need it." | No | `allowMagstripe` on | none | none |
| Use abroad | chips Off, For a trip, Everywhere ("Turn on before you travel. Turn it off when you are back.") | No | always | none | none |
| Country | select: United Arab Emirates, Saudi Arabia, Jordan, United Kingdom, France, Germany, Spain, Turkey, Egypt, United States, Iran | No (needed with dates) | "For a trip" | not a restricted country (Iran in the sandbox) | "We can't turn on this card in that country. (COUNTRY_RESTRICTED)" |
| From, To | date, today to today plus 120 days | No (needed with the country) | "For a trip" | end not before start; at most 90 days; not overlapping another trip | "The end date is before the start date. (TRAVEL_DATES_INVALID)" / "A trip can last up to 90 days. (TRAVEL_DATES_INVALID)" / "This overlaps another trip. (TRAVEL_DATES_INVALID)" |

A list "Your trips" shows existing trips with **Remove** / **Undo** (removing a trip is a tightening). A partly filled trip blocks Next with "Add the country and both dates for the trip, or clear them."

**`merchants`: "Types of shop"**, intro "Block kinds of spending you never want on this card." Toggles: **Block crypto exchanges** ("Buying digital coins with this card."), **Block money transfers and cash-like spending** ("Wire services, prepaid top-ups, quasi-cash."), **Block adult content**, **Block gambling** ("Betting and casinos.", only with `offerGambling` on). With `offerGambling` off a row reads "Gambling / Blocked by your bank. This can't be changed here." with a "Blocked by bank" chip.

**`alerts`: "Alerts"**, intro "Get a message when something happens on this card." Toggles: **Every purchase** ("A push message each time."), **Big purchases** ("Only above the amount you choose.") with **Alert me from** (amount, required while on, 1 to 100,000; "Enter an amount above zero." / "The most is $100,000.00."), **Purchases abroad**, **Cash withdrawals** (cash cards only), **Online purchases**, **Declined payments** ("So you know when a payment didn't go through."), **Near a limit** ("When you reach 80% of a daily or monthly limit."). Alerts never need a code.

**`wallets`: "Digital wallets"**, intro "Phones and watches that can pay with this card." A card lists each wallet ("{app} · {device}", "Token ending {tok} · added {date}") with **Remove** (becomes "Will be removed" with **Undo**). Text: "Your phone stores a stand-in number (a token), not your card number. Receipts from wallet payments show the token ending, not ••{last4}. Removing a token stops that phone only." Fields: **Add to a wallet** (chips Not now, Apple Pay, Google Pay; active cards only; hint "Adding a wallet makes the card easier to use, so we will ask for a code.") and **Which device?** (select "Alex's iPhone 16", "Alex's iPad", "Pixel 9"; required once a wallet is chosen; message "That wallet isn't available on this device. (WALLET_NOT_SUPPORTED)" for Apple Pay on Android or Google Pay on iOS).

**`review`: "Review changes"**, intro "Only what changes is listed." A card "What will change" with one row per change, "Before → After", and a chip **Safer** or **Needs code**. Below, either "These changes make your card easier to use, so we'll ask for a code. A mix of safer and easier counts as easier." (button **Continue**) or "These changes make your card safer, so no code is needed. They take effect straight away." (button **Save changes**). No changes: "Nothing to save yet", "Go back and change a switch or a limit.", and the button stays off with "You haven't changed anything yet. (NO_CHANGES)". When the card has become blocked, expired or inactive meanwhile the check on Next fails with `CARD_NOT_ACTIVE`.

What counts as easier to use (needs a code): unfreezing; raising any limit; switching contactless, online, cash machines or magnetic stripe on; raising Use abroad (Off to trip to Everywhere); adding a trip; removing a shop-type block; adding a wallet. Everything else is safer and instant: freezing; lowering a limit; switching off; lowering Use abroad; removing a trip; adding a shop-type block; removing a wallet; any alert change.

**`code`: "Confirm with your code"** (only when something loosens), intro "We sent a 6-digit code to the phone ending 0142." Field **One-time code** (text, 6 digits, required, hint "{n} tries left. Prototype code: 482100."), message "Enter the 6-digit code.". Button **Save changes**, busy "Checking your code…" 700 ms. Wrong code: "That code isn't right. Check the text message and try again. (OTP_INVALID)" and the tries left; the third wrong code ends with "Too many wrong codes. Nothing was changed on your card. Go back to start again. (OTP_LOCKED)". The prototype also accepts `000000`.

**Result.** Title "Card frozen" (only the status changed, now frozen; text "New purchases and cash withdrawals are blocked. You can unfreeze it any time."), "Card active again" (text "Your card works again."), "Wallet added" (text "Token ending {tok} is on the device. Receipts from it show that ending, not ••{last4}."), or "Controls updated" (text "{n} change(s) saved{ straight away}."). Status chip "Confirmed with code" or "Saved at once". Rows: Card, one row per change ("{label}: Before → After"), Code needed (Yes or No), Card now (Frozen or Active). Buttons **Go to cards** and, after a "Lost or stolen" freeze, **Block and replace**.

**States:** Loading is the 800 ms "Saving to your card…"; the empty state is the review's "Nothing to save yet"; errors use the engine banner with the code's message. A timeout shows "This is taking longer than expected. Nothing was changed on your card." and unavailable "This service isn't available right now. Nothing was changed. Please try again in a few minutes."

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `CARD_NOT_FOUND` | "We can't find that card. Choose another." | `pick`, or Next on `review` | Choose card |
| `CARD_NOT_ACTIVE` | "You can change controls once the card is active." (blocked, expired or replaced: "This card is {status} and can't be changed. Ask for a replacement.") | `pick`, `freeze`, `review` | Back / Replace card |
| `CARD_NOT_FROZEN` | "This card isn't frozen." | `freeze` | Back |
| `CARD_ALREADY_FROZEN` | "This card is already frozen." | `freeze` | Back |
| `LIMIT_INVALID` | "One of the limits isn't valid. Use an amount of 0 or more, with 2 decimal places at most." | `limits` | Edit |
| `LIMIT_ABOVE_CEILING` | "One limit is above what this card allows. Choose a smaller amount." | `limits` | Edit |
| `LIMIT_ORDER` | "A purchase limit can't be more than the daily limit, and the daily limit can't be more than the monthly limit." | `limits` | Edit |
| `COUNTRY_RESTRICTED` | "We can't turn on this card in that country." | `where` | Edit |
| `TRAVEL_DATES_INVALID` | "Check the trip dates. A trip can last up to 90 days and can't overlap another trip." | `where` | Edit |
| `WALLET_NOT_SUPPORTED` | "That wallet isn't available on this device. Apple Pay works on iPhone and iPad, Google Pay on Android." | `wallets` | Edit |
| `NO_CHANGES` | "You haven't changed anything yet." | `review` | Back |
| `OTP_REQUIRED` | "Confirm with your one-time code first." | `code` | Back to code |
| `OTP_INVALID` | "That code isn't right. Check the text message and try again." | `code` | Try again |
| `OTP_LOCKED` | "Too many wrong codes. Nothing was changed on your card. Go back to start again." | `code` | Start again |
| `STEP_UP_REQUIRED` | "For your security, confirm it's you first." | `code` | Confirm |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed on your card." | engine error | Try again |
| `SERVICE_UNAVAILABLE` | "This service isn't available right now. Nothing was changed. Please try again in a few minutes." | engine error | Try again |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `cardGet` | `bank.cards.get` | `{cardId}` | card with `status`, `limits`, `ceilings`, `used`, `controls`, `blocked`, `trips`, `alerts`, `wallets` | `CARD_NOT_FOUND` | (planned) |
| `otpSend` | `bank.otp.send` | `{phone}` | `{sent}` | none | Existing |
| `otpVerify` | `bank.otp.verify` | `{code}` | `{verified}` | `OTP_INVALID` (carries `attempt`), `OTP_LOCKED` | Existing (`lockAfter: 3`) |
| `updateControls` | `bank.cards.updateControls` | `{cardId, frozen, reason, limits, controls, abroad, trip, blocked, alerts, removeWallets[], addWallet{app, device}, code?}` | `{cardId, status, changes[], tokenLast4?, codeUsed}` | `CARD_NOT_FOUND`, `CARD_NOT_ACTIVE`, `CARD_NOT_FROZEN`, `CARD_ALREADY_FROZEN`, `LIMIT_INVALID`, `LIMIT_ABOVE_CEILING`, `LIMIT_ORDER`, `COUNTRY_RESTRICTED`, `TRAVEL_DATES_INVALID`, `WALLET_NOT_SUPPORTED`, `NO_CHANGES`, `OTP_REQUIRED`, `STEP_UP_REQUIRED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned). Not money-moving. The adapter, not the screen, decides whether a code is needed, so a client cannot skip it |

The card model (`status` `active`, `inactive`, `frozen`, `blocked`, `expired`, `replaced`; `mode` `off`, `trip`, `on`) is in the planned sandbox domain "cards" above.

#### 6. Permissions, step-up and limits

`cards.manage` (planned). Step-up: a one-time code only for loosening changes; tightening, alerts and wallet removal need none. Code: 6 digits, 3 tries, then `OTP_LOCKED` (nothing is changed, the person starts again). Limits: each limit capped by the card's bank ceiling (debit seed: per purchase $10,000, daily $15,000, monthly $50,000, cash $1,500, tap $100; credit seed: $5,000 each, no cash); trips at most 90 days, no overlap; big-purchase alert 1 to 100,000. All changes are written to a change log for audit.

#### 7. Result and links out

Result as in section 3. Receipt: the result rows. Notifications raised: "Controls changed on card ••{last4}" (push, with the list of changes), "Your card ••{last4} was frozen" or "unfrozen", "Wallet added: {app} on {device}". Links out: **Go to cards** (`setTab('card')`), **Block and replace** (`replace-card {cardId, reason: "lost"}`).

#### 8. Acceptance criteria

- AC-1: Freezing an active card needs no code, takes effect immediately, and the card then shows as frozen on the cards screen.
- AC-2: Unfreezing a frozen card needs a one-time code and returns the card to active.
- AC-3: Each limit is refused with the exact message when it is invalid, above the card's ceiling, or out of order (per purchase above daily, daily above monthly); a cash limit of 0 stops cash withdrawals.
- AC-4: Lowering a limit, switching a channel off, adding a shop-type block, lowering Use abroad, removing a trip or a wallet, and changing alerts save at once with no code, and the review marks them **Safer**.
- AC-5: Raising a limit, switching a channel on, raising Use abroad, adding a trip, removing a shop-type block or adding a wallet needs a code; a mix of safer and easier changes needs a code.
- AC-6: A trip needs a country and both dates; Iran is refused (`COUNTRY_RESTRICTED`); a trip longer than 90 days, ending before it starts, or overlapping another is refused.
- AC-7: Three wrong codes end with `OTP_LOCKED` and nothing is changed; the right code (`482100`) saves.
- AC-8: A card that is inactive, blocked, expired or replaced cannot be changed and the person is pointed to Activate or Replace.
- AC-9: With nothing changed the review says so and nothing can be saved (`NO_CHANGES`).
- AC-10: Apple Pay on an Android device and Google Pay on an iPhone are refused (`WALLET_NOT_SUPPORTED`); a successful add shows a token ending that differs from the card's last four.
- AC-11: With `offerGambling` off gambling shows as "Blocked by your bank" and cannot be changed; with `allowMagstripe` off there is no stripe switch; with `allowTapLimit` off there is no contactless limit field; `frozenAllowsRecurring` changes the wording of the freeze note.
- AC-12: A "Lost or stolen" freeze shows the block-for-good notice and a **Block and replace** button on the result.
- AC-13: On a timeout or an unavailable service nothing changes on the card and the person is told so.

#### 9. Scenarios

Sandbox demo values: `card_9021` Everyday debit ••9021 (active; per purchase $2,000, daily $3,000, monthly $15,000, cash $800, tap $100; used today $4.80; contactless, online and cash machines on; magnetic stripe off; abroad "Everywhere"; gambling blocked; wallet Apple Pay · Alex's iPhone 16, token 4471). `card_3318` credit ••3318 (active; ceilings $5,000, no cash). `card_7745` Spare debit ••7745 (inactive). One-time code `482100` (and `000000`). Test launch: `{cardId: "card_9021", mode: "all", smoke: 1}` fills the code and lowers the daily limit to 2,500.

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-4 | `alex` | none | Mode `freeze` on `card_9021`: switch on, review shows "Card status Active → Frozen" with **Safer**, button Save changes, no code. Result "Card frozen", status chip "Saved at once"; Cards shows the grey card. |
| T-2 | AC-2, AC-7 | `alex`, card frozen | none | Mode `unfreeze`: review chip **Needs code**; wrong code shows `OTP_INVALID` and "2 tries left"; `482100` saves; result "Card active again", "Confirmed with code". |
| T-3 | AC-3 | `alex` | none | Daily 16000: "The most this card allows per day is $15,000.00. Choose a smaller amount."; Per purchase 3500 with daily 3000: `LIMIT_ORDER`; Daily 20000 with monthly 15000: `LIMIT_ORDER`; "-5": `LIMIT_INVALID`; cash 0 accepted. |
| T-4 | AC-4 | `alex` | none | Daily 2500 and Online off and Block crypto on and Alert near a limit off: all **Safer**, no code step, result "Controls updated". |
| T-5 | AC-5 | `alex` | none | Monthly 20000 (and Contactless off): review shows one **Needs code**; code step appears. |
| T-6 | AC-6 | `alex` | none | Use abroad "For a trip": Iran gives `COUNTRY_RESTRICTED`; 1 Dec 2026 to 3 Mar 2027 (92 days) gives the 90-day message; end before start gives the date message; a valid France trip saves with a code and appears in Cards "Trips". |
| T-7 | AC-7 | `alex` | none | Raise a limit; enter `111111` three times: `OTP_LOCKED`, nothing changed. |
| T-8 | AC-8 | `alex` | open with `card_7745` | `CARD_NOT_ACTIVE` "You can change controls once the card is active." |
| T-9 | AC-9 | `alex` | none | Open and go straight to review: "Nothing to save yet"; the button is off. |
| T-10 | AC-10 | `alex` | none | Wallets step: Apple Pay and Pixel 9 gives `WALLET_NOT_SUPPORTED`; Apple Pay and Alex's iPad adds a token; the result says the token ending. Remove the existing wallet: safer, no code. |
| T-11 | AC-11 | `alex` | options `offerGambling` on, `allowMagstripe` on, `allowTapLimit` off, `frozenAllowsRecurring` off | Merchant step shows the gambling switch; where shows the stripe switch; limits shows no contactless field; the freeze note says recurring payments are stopped. |
| T-12 | AC-12 | `alex` | none | Freeze with reason "Lost or stolen": notice and **Block and replace** on the result. |
| T-13 | AC-13 | `alex` | `timeout: ["bank.cards.updateControls"]`, `latencyMs: 10000` (planned; prototype: Timeout on) | Timeout message "Nothing was changed on your card"; card unchanged. |
| T-14 | AC-13 | `alex` | `unavailable: ["bank.cards.updateControls"]` (prototype: Service down on) | Unavailable message; card unchanged. |

#### 10. Expected mutation-check survivors

Whether a change needs a code is decided on the screen (the code step) and (planned) in `bank.cards.updateControls`, so removing only the screen's rule survives T-5 when the adapter answers `OTP_REQUIRED`; expected. `STEP_UP_REQUIRED` cannot be produced by the sandbox and survives. The 90-day trip check is on the date field and (planned) in the adapter; expected. The magnetic stripe and tap-limit options have no scenario beyond T-11; if a mutation flips their default it survives T-1 to T-10 and is killed only by T-11.

---

### ★ Freeze card — `freeze-card`

**Catalog:** slug `freeze-card`, workspace `personal`, category Cards (Personal: Cards), core no, can a bank switch it off: yes. Options: none of its own; the freeze rules are the options of `card-controls` (`frozenAllowsRecurring`).

**Alias of `card-controls`:** reached from the **Freeze** quick action on the Cards screen (an instant freeze with no journey), from the **Unfreeze** action and the frozen banner (`card-controls` with `mode: "unfreeze"`), and from the first step "Card status" of `card-controls` (`mode: "freeze"` or `"all"`). There is no separate catalog entry in the prototype, so switching off `card-controls` removes Unfreeze and the controls while the Cards screen can still freeze. What differs from the earlier standalone spec:

- Freezing is instant and needs no code (it only protects); unfreezing needs a one-time code (6 digits, 3 tries) because it makes the card easier to use.
- Reasons are optional chips (Not sure, Misplaced, Suspicious payment, Lost or stolen, Not using it); "Lost or stolen" shows a notice and **Block and replace** (`replace-card`) because a frozen card can be unfrozen by anyone who knows the sign-in.
- What a freeze does not stop (refunds and credits; optionally existing recurring payments) is shown on the screen and set by the bank option `frozenAllowsRecurring`.
- Card limits are no longer a separate topic: they are the "Spending limits" step of `card-controls` (per purchase, daily, monthly, cash, contactless), each capped by a bank ceiling, with lowering instant and raising behind a code.
- Error codes: `CARD_NOT_ACTIVE`, `CARD_NOT_FROZEN`, `CARD_ALREADY_FROZEN`, `OTP_INVALID`, `OTP_LOCKED`. Adapters `bank.cards.freeze` (instant, from `cards`) and `bank.cards.updateControls` (planned). Acceptance criteria AC-1, AC-2 and AC-12 and scenarios T-1, T-2, T-12 of `card-controls` cover it.

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

