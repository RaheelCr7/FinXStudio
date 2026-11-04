# Module 1: Retail (pre-login, sign-in, security and Personal "Aurora")

**Release 1. Workspaces: Public (before sign-in) and Personal.** Everything a retail customer does, from the first launch of the app to sign-out: explore without an account, open an account or register, sign in and keep the account secure, then manage accounts, payments, cards, saving and borrowing, and servicing.

**What exists today:** BankWorkx® is a retail-only shell (`docs/BANKWORKX.md`): Dashboard, Accounts, Budgets, Wallet and Invest, six journeys in `packages/journey-schema/src/fixtures/bankworkx.ts` without consent, OTP or proof, the CAB access journeys (`fixtures/cab.ts`, `docs/CAB.md`) as the starting pattern for pre-login and sign-in, and Meezan journeys for local transfer, currency conversion and bill pay. **What is planned:** everything marked *(planned)*: sandbox domains, adapters, blocks, contexts, conditions.

## Journey index (47)

| Group | Journeys |
|---|---|
| Explore and onboarding (Public) | `loan-calculator`, `deposit-calculator`, `find-branch-atm`, `contact-support`, `open-account`, `track-application`, `register-digital-banking` |
| Sign-in and security | `sign-in`, `setup-quick-login`, `forgot-username`, `reset-password`, `unlock-account`, `change-password`, `trusted-devices`, `change-quick-pin` |
| Accounts | `account-statement`, `account-nickname`, `open-another-account`, `create-budget` |
| Payments | `own-transfer`, `internal-transfer`, `personal-transfer`, `international-transfer`, `pay-bill`, `mobile-topup`, `manage-beneficiary`, `schedule-payment`, `cancel-standing-order` |
| Cards | `activate-card`, `freeze-card`, `card-controls`, `virtual-card`, `replace-card`, `card-pin`, `dispute-transaction`, `add-card` |
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

#### 1. Summary

| | |
|---|---|
| Slug | `open-account` |
| Purpose | A new customer opens a BankWorkx® account from their phone or browser: verify identity, give personal and tax details, upload documents, read and sign the agreement, submit, and come back later if needed. |
| Release | 1 |
| Workspace | Public |
| Status | New (planned). No onboarding exists in the sandbox. |
| Channels | Web, mobile |
| Starting pattern | Multi-step forms in `add-card` and `connect-account` (`fixtures/bankworkx.ts`) for field and review screens; the one-time code screens of `local-transfer`; the CAB `enroll` journey for "identify the person, then show a clear result" (`fixtures/cab.ts`). Everything about ID capture, files, the agreement and the signature is new. |
| Who may use it | Anyone who is not yet a customer, aged 18 or older (16 to 25 for the Student Account). Persona `sam` (Sam Rivera). |
| Money moving | No. No money moves and no account number exists until the bank approves. A security and file journey: identity, personal data, uploads. |

New adapters (planned, sandbox domain `onboarding`): `bank.onboarding.start`, `.idCheck`, `.savePersonal`, `.saveTax`, `.saveProduct`, `.requiredDocuments`, `.uploadDocument`, `.removeDocument`, `.agreement`, `.sign`, `.submit`, `.save`, `.get`. Existing adapters reused: `bank.otp.send`, `bank.otp.verify`. New blocks (planned): `idCapture`, `fileUpload`, `documentViewer`, `signature`, `statusChip`, `datePicker` (batch A and B, README 2.2). Engine: `navigate.toJourney` and `returnTo`; receipts.

#### 2. Entry points

| Place | Label | Passes | Permission |
|---|---|---|---|
| Landing | Open an account | `{productId}` optional | none |
| Products › any detail | Open this account | `{productId}` | none |
| `loan-calculator` / `deposit-calculator` result | New to BankWorkx®? Open an account | – | none |
| `track-application` › draft or "more information needed" | Continue application (README change needed) | `{applicationId}` | none (one-time code first) |
| Deep link | `/public/j/open-account?productId=acc_saver` | `{productId}` | none |

When `{productId}` is a deposit, loan or card, the journey starts with the account that comes with it (Everyday Account) and explains why on `welcome`.

#### 3. Screens

Order of the happy path: `welcome` → `contact` → `verifyPhone` → `idCapture` → `idConfirm` → `personal` → `tax` → `product` → `documents` → `review` → `agreement` → `consent` → `sign` → `signOtp` → `submitted`. Side screens: `saved`, `idFailed`, `notEligible`, `expired`. Resume rules: a `draft` application opens on its first unfinished screen (`resumeAt` from `bank.onboarding.get`); a `more_info` application (from `track-application`) opens straight on `documents`, shows the bank's request in an info alert, and Submit sends it back for review. A stepper (`stepper` block) shows the five stages "Your contact", "Your ID", "About you", "Documents", "Sign" from `contact` to `signOtp`. Every screen from `idCapture` to `review` has a ghost button **Save and continue later** (→ `saved`).

**Screen `welcome` — "Open an account"** (entry). Blocks: `text`, `select`, `alert`, `reviewSummary`, `button`.

| Label | Block | Required | Rule | Error |
|---|---|---|---|---|
| Choose an account (`oa.productId`) | `select`, variant `rows`, source = account products (Everyday Account, Aurora Savings, Student Account), preselected from `{productId}` | Yes | One of `acc_everyday`, `acc_saver`, `acc_student` | "Choose an account." |

Copy: Title "Open an account". Body "It takes about 10 minutes. You'll need your phone and a photo ID." List "What you'll need" from the product (`needed`): "Photo ID (passport, driver licence or state ID)", "Proof of address", "Your tax details". Alert (info, shown when the passed product is a card, deposit or loan): "To apply for {productName}, first open an account. You can apply once you're signed in." Link row: "Already a customer? Register for digital banking" (→ `toJourney: register-digital-banking`). Link row: "Already started? Track my application" (→ `toJourney: track-application`).

| Button | Does | Leads to |
|---|---|---|
| Start | `validate` | `contact` |
| Back | `exit` | Where the person came from |

**Screen `contact` — "Your contact details"**. Blocks: `stepper`, `textInput` x2, `alert`, `button`.

| Label | Block | Required | Rule | Error |
|---|---|---|---|---|
| Email (`oa.email`) | `textInput`, keyboard `email` | Yes | `name@domain.tld`, at most 80 characters | "Enter an email address like name@example.com." |
| Mobile number (`oa.mobile`) | `textInput`, keyboard `phone`, placeholder "+1 415 555 0199" | Yes | US mobile: `+1` then 10 digits (spaces and dashes allowed) | "Enter a US mobile number with 10 digits." |

Copy: Body "We'll send a code to your mobile to check it's yours." Alert (info): "We use your email and mobile to send updates about your application." Button "Send code": `validate`, `callApi` `start` (creates the application), then `callApi` `otpSend` → `verifyPhone`. In the sandbox the code goes to the persona's phone (`+1 415 555 0199`, code `123456`); a planned `phone` field on `bank.otp.send` sends it to the typed number in a real bank. Ghost "Back" → `welcome`.

**Screen `verifyPhone` — "Enter your code"**. Blocks: `otp` (length 6, `maxAttempts: 3`, keypad), `text`, `button`.

Copy: Title "Enter your code". Body "We sent a 6-digit code to {maskedPhone}." Helper "Didn't get it? You can ask for a new code in 30 seconds." Button "Verify" (callApi `otpVerify`, id exactly `otpVerify`, so the engine counts failures) → `idCapture`. Ghost "Send a new code" (enabled after 30 s; runs `otpSend`; resets the count). After the third wrong code the engine locks the screen: message S-`OTP_INVALID` third form, button "Start again" → `contact`.

| Field | Block | Required | Rule | Error |
|---|---|---|---|---|
| Code (`oa.otp`) | `otp`, 6 digits | Yes | 6 digits | "Enter the 6-digit code." |

**Screen `idCapture` — "Verify your ID"**. Blocks: `stepper`, `select` (variant `tiles`), `idCapture` (planned) for the front, back and selfie, `alert`, `button`, `button`.

| Label | Block | Required | Rule | Error |
|---|---|---|---|---|
| Document type (`oa.id.type`) | `select`, `tiles`: Passport (`passport`), Driver licence (`licence`), State ID (`stateId`) | Yes | One of three | "Choose a document." |
| Front of your ID (`oa.id.front`) | `idCapture`, mode `document-front` | Yes | An image captured; for a passport this is the photo page | "Take a photo of the front of your ID." |
| Back of your ID (`oa.id.back`) | `idCapture`, mode `document-back` | Yes unless Passport (hidden for Passport) | An image captured | "Take a photo of the back of your ID." |
| Selfie (`oa.id.selfie`) | `idCapture`, mode `selfie` | Yes | An image captured | "Take a selfie so we can match it to your ID." |

Copy: Title "Verify your ID". Body "Put your ID on a flat, well-lit surface. Make sure all four corners and the text can be read." Selfie helper "Look straight at the camera. Take off sunglasses and hats." Sandbox note (shown only in Studio's sandbox): "Sandbox: the camera is simulated. Pick the outcome in the sandbox panel." Button "Check my ID" (`validate`, `callApi` `idCheck`). Ghost "Save and continue later". On failure the block stays filled and the failure message shows in an `alert` (error) above the button; the person can retake only the failing item.

Routing after `idCheck`: `ok` → `idConfirm`; `UNDERAGE` or `ID_REJECTED` → `notEligible` or `idFailed`; `ID_ATTEMPTS_EXCEEDED` → `idFailed`; other codes → stay.

**Screen `idConfirm` — "Check your details"**. Blocks: `reviewSummary`, `alert`, `button`, `button`.

| Row | Example (Sam Rivera, Driver licence) |
|---|---|
| Full name | Sam Rivera |
| Date of birth | 14 Mar 1992 |
| Document | Driver licence ••7702 |
| Expires | 9 Aug 2030 |
| Nationality | United States |

Copy: Title "Is this you?". Alert (info) "These details came from your ID. You can't change them here. If something is wrong, scan your ID again." Buttons "Yes, that's me" → `personal`; "Scan again" (counts as an attempt only if the next check fails) → `idCapture`.

**Screen `personal` — "About you"**. Blocks: `stepper`, `textInput` x5, `select` x6, `button`. Email and mobile are shown read-only as `reviewSummary` rows with an Edit link back to `contact` (changing them repeats the code check).

| Label (bind) | Block | Required | Rule | Error |
|---|---|---|---|---|
| Home address (`oa.addr1`) | `textInput` | Yes | 3 to 80 characters | "Enter your street address." |
| Apartment, suite (`oa.addr2`) | `textInput` | No | Up to 80 characters | "Use up to 80 characters." |
| City (`oa.city`) | `textInput` | Yes | 2 to 40 letters, spaces, `-`, `'`, `.` | "Enter your city." |
| State (`oa.state`) | `select`, `dropdown`, 50 states and DC | Yes | One of the list | "Choose your state." |
| ZIP code (`oa.zip`) | `textInput`, keyboard `number`, pattern `^[0-9]{5}(-[0-9]{4})?$` | Yes | 5 digits, optionally `-` and 4 more | "Enter a ZIP code like 94105." |
| Employment (`oa.employment`) | `select`, `dropdown`: Employed, Self-employed, Student, Retired, Not working | Yes | One of five | "Choose your employment." |
| Employer or school (`oa.employer`) | `textInput`, shown unless Retired or Not working | Yes when shown | 2 to 80 characters | "Enter your employer or school." |
| Occupation (`oa.occupation`) | `textInput`, shown for Employed and Self-employed | Yes when shown | 2 to 60 characters | "Enter your occupation." |
| Yearly income before tax (`oa.income`) | `select`, `dropdown`: Under $25,000; $25,000 to $49,999; $50,000 to $99,999; $100,000 to $249,999; $250,000 or more | Yes | One of five | "Choose your income." |
| Where does your money come from? (`oa.source`) | `select`, `dropdown`: Salary, Savings, Business income, Pension, Family support, Other | Yes | One of six | "Choose where your money comes from." |
| Why do you want this account? (`oa.purpose`) | `select`, `dropdown`: Everyday spending, Saving, Receiving my salary, Other | Yes | One of four | "Choose why you want this account." |

Copy: Title "About you". Helper under income and source: "We ask because the law requires us to know our customers." Button "Continue": `validate`, `callApi` `savePersonal` → `tax`. Ghost "Save and continue later". Data stays on `personal` if the adapter answers `PRODUCT_NOT_ELIGIBLE` (the Student Account needs employment "Student").

**Screen `tax` — "Tax residency"**. Blocks: `stepper`, `toggle` x2, `textInput`, `select`, `textInput`, `alert`, `button`.

| Label (bind) | Block | Required | Rule | Error |
|---|---|---|---|---|
| I'm a US citizen or US tax resident (`oa.usPerson`) | `toggle` (default on) | Yes | Yes or No | – |
| Social Security number or ITIN (`oa.ssn`) | `textInput`, `secure`, shown when `usPerson` is on, pattern `^[0-9]{3}-?[0-9]{2}-?[0-9]{4}$` | Yes when shown | 9 digits, dashes optional | "Enter your 9-digit number, like 900-70-0001." |
| I'm also a tax resident of another country (`oa.otherResidency`) | `toggle` (default off) | Yes | – | – |
| Country (`oa.otherCountry`) | `select`, `dropdown`, countries list | Yes when shown | A listed country that is not the United States | "Choose a country." |
| Tax number in that country (`oa.otherTin`) | `textInput` | Yes when shown, unless "no number" is chosen | 4 to 20 letters, digits, `-` | "Enter your tax number, or say you don't have one." |
| I don't have a tax number (`oa.noTin`) with reason (`oa.noTinReason`) | `toggle` + `select`: "The country doesn't issue one", "I can't get one" | Reason required when on | One of two | "Choose a reason." |

Copy: Title "Tax residency". Body "Banks must ask where you pay tax (FATCA and CRS rules)." Alert (info): "We may share this with tax authorities where the law requires. We don't use it for anything else." Button "Continue": `validate`, `callApi` `saveTax` → `product`. One other country only in Release 1; more than one is an open question.

**Screen `product` — "Your account"**. Blocks: `stepper`, `select` (`rows`), `toggle` x2, `textInput`, `reviewSummary`, `button`.

| Label (bind) | Block | Required | Rule | Error |
|---|---|---|---|---|
| Account (`oa.productId`) | `select`, `rows` | Yes | An account product | "Choose an account." |
| Debit card (`oa.debitCard`) | `toggle` (default on), hidden for Aurora Savings | Yes | – | – |
| Paperless statements (`oa.paperless`) | `toggle` (default on) | Yes | – | – |
| Account nickname (`oa.nickname`) | `textInput` | No | Up to 30 letters, digits, spaces | "Use up to 30 letters or numbers." |

Facts shown for the chosen account: monthly fee, interest rate (Savings), minimum opening balance (Savings: "$100, to put in within 30 days of opening"), card included. Copy: Title "Your account". Body "You can change these later in the app." Button "Continue": `validate`, `callApi` `saveProduct` → `documents`.

**Screen `documents` — "Upload your documents"**. Blocks: `stepper`, one `fileUpload` per required document, `statusChip`, `alert`, `button`.

| Document (bind) | Block | Required | Rule | Error |
|---|---|---|---|---|
| Proof of address (`oa.doc.address`) | `fileUpload` | Yes | PDF, JPG or PNG; up to 5 MB; up to 2 files; issued in the last 3 months (utility bill, bank statement or lease) | See file messages below |
| Student letter (`oa.doc.student`) | `fileUpload`, shown only for the Student Account | Yes when shown | Same file rules; dated this academic year | "Upload a letter from your school." |

File messages (shown under the field, announced to screen readers):

| Situation | Message |
|---|---|
| Not PDF, JPG or PNG | "Upload a PDF, JPG or PNG file." |
| Over 5 MB | "That file is {size} MB. The limit is 5 MB." |
| Can't be read | "We can't read that file. Upload a clearer copy." |
| Blocked by the safety scan | "We can't accept that file. Upload a different one." |
| Older than 3 months | "This document is more than 3 months old. Upload a newer one." |
| Third file for one document | "You can upload up to 2 files for this document." |

Each uploaded file shows its name, size, a `statusChip` (Uploading, Checking, Accepted, Rejected) and a Remove link. Copy: Title "Upload your documents". Body "Take a photo or choose a file. Make sure the name and address can be read." Button "Continue": enabled when every required document has one Accepted file; otherwise pressing it shows "Upload every document to continue." (S-`DOCUMENT_REQUIRED`) → `review`.

**Screen `review` — "Review your application"**. Block: `reviewSummary` in groups, with an Edit link on each group, `alert`, `button`.

| Group | Rows |
|---|---|
| You | Full name, Date of birth, Email, Mobile |
| Address | Street, City, State, ZIP |
| Work and money | Employment, Employer, Occupation, Income, Source of funds, Purpose |
| Tax | US person (Yes or No) and "SSN ending 0001"; other country (if any) |
| Account | Account, Debit card (Yes or No), Paperless (Yes or No), Nickname |
| Documents | File names with "Accepted" |

Copy: Title "Check everything". Alert (warning): "You can't change these once you sign." Button "Looks good" → `agreement`. Ghost "Save and continue later".

**Screen `agreement` — "Read your agreement"**. Blocks: `documentViewer` (planned), `text`, `button`.

Copy: Title "Account agreement". Body "Please read all of it. The button turns on when you reach the end." Viewer shows "Account agreement and terms, version 2026-10" in sections: "1. Your account", "2. Fees and interest", "3. Keeping your details safe", "4. Tax information", "5. Closing your account", "6. How we use your information". Buttons: "I've read it" (disabled until the viewer reports the last page; `callApi` `agreement` records the version read) → `consent`. Ghost "Open the privacy notice" (opens Shell: Legal pages in a sheet). The viewer bind `oa.agreementRead` becomes true only at the end of the last page.

**Screen `consent` — "Your agreement"**. Blocks: `consent` (bind `oa.consent`, `termsVersion: "2026-10"`, `mustBeTrue`), `toggle` (optional marketing), `button`.

Consent text: "I confirm that the details I gave are true and complete. I have read and accept the account agreement and the privacy notice. I agree that BankWorkx® may check my identity and share my tax details with tax authorities where the law requires." Error "You need to agree to continue." Toggle (default off): "Send me news and offers (optional)". Button "Continue to sign" → `sign`.

**Screen `sign` — "Sign your application"**. Blocks: `signature` (planned), `text`, `alert`, `button`.

| Label (bind) | Block | Required | Rule | Error |
|---|---|---|---|---|
| Signature (`oa.signature`) | `signature`, modes "Draw" and "Type" | Yes | Draw: at least one stroke that covers 40 x 20 points or more. Type: equals the name on the ID, ignoring case, extra spaces and punctuation ("sam  rivera" is accepted) | Draw empty: "Draw your signature in the box." Type mismatch: "The name doesn't match your ID. Type {fullName}." |

Copy: Title "Sign". Body "Sign here to confirm your application. We'll send a code to {maskedPhone} to finish." Button "Sign and send code": `validate`, `callApi` `otpSend` → `signOtp`. Ghost "Back" → `consent`.

**Screen `signOtp` — "Confirm with your code"**. Blocks: `otp` (6 digits, 3 attempts), `button`.

Copy: Title "Confirm with your code". Body "Enter the 6-digit code we sent to {maskedPhone}." Button "Submit application": runs `otpVerify` (id exactly `otpVerify`), then `sign`, then `submit` in order, then `navigate` → `submitted`. Resend as in `verifyPhone`. On `INCOMPLETE` goes back to the first missing item (named in the message).

**Screen `submitted` — "Application submitted"** (terminal). Blocks: `result` (success), `reviewSummary`, `button` x2.

Copy: Title "We've got your application". Text "We'll check your details and your documents. You'll hear from us by email and text within 1 to 2 working days." Meta: "Application number {reference}" (for example `APP-20261103-0042`). Rows: Account, Submitted (`3 Nov 2026 10:12 UTC`), Email (masked), Status "Submitted". Buttons: "Track my application" (`toJourney: track-application`, `{applicationId}`), "View receipt" (print or share, planned receipts), "Done" (`exit` → Landing).

**Screen `saved` — "Application saved"** (terminal). `result` (success). Title "Your application is saved". Text "We'll keep it for 30 days, until {expiresOn}. To carry on, choose Track my application, enter {applicationId} and the code we text you." Buttons "Done" (`exit`), "Track my application" (`toJourney`). Data saved: ID result, personal, tax, product and uploaded files. Not saved: the signature, the consent and any code; these are done again at the end.

**Screen `idFailed` — "We couldn't check your ID"** (terminal). `result` (error). Title "We couldn't check your ID online". Text "Visit a branch and bring your ID. We'll help you open the account there. Nothing was charged." Buttons "Find a branch" (`toJourney: find-branch-atm`, `{kind: "branch"}`), "Done".

**Screen `notEligible` — "We can't open this account"** (terminal). `result` (error). Title by cause: UNDERAGE "You must be 18 or older" (Student Account: "The Student Account is for ages 16 to 25"); body "You can open an account once you're old enough. If you think this is a mistake, contact us." Buttons "Contact us" (`toJourney: contact-support`), "Done".

**Screen `expired` — "This application has expired"** (terminal). `result` (error). Title "This application has expired". Text "Applications are kept for 30 days. Start a new one when you're ready." Buttons "Start again" → `welcome`, "Done".

States common to all: Loading: submit buttons disabled with a spinner; lists as skeletons. 10 seconds without an answer shows the `TIMEOUT` state of the failing step with Try again. Empty: n/a. Back: the system back button goes one screen back; it never loses typed data inside the journey.

#### 4. Sandbox errors

| Code | Message the person sees | Shows on | Button |
|---|---|---|---|
| `EMAIL_INVALID` | "Enter an email address like name@example.com." | `contact` | Change email |
| `PHONE_INVALID` | "Enter a US mobile number with 10 digits." | `contact` | Change number |
| `CANNOT_START` | "We couldn't start an application with these details. If you already bank with us, choose Register for digital banking." | `contact`, alert | Register for digital banking (`toJourney`) / Change details |
| `APPLICATION_EXISTS` | "You already have an application with this email. Choose Track my application to carry on." | `contact`, alert | Track my application |
| `PRODUCT_NOT_FOUND` | "We can't find that account. Choose another." | `welcome` or `product` | Choose account |
| `OTP_INVALID` | "That code isn't right. {n} tries left." After the third: "Too many wrong codes. Start again." | `verifyPhone`, `signOtp` | Try again / Start again |
| `OTP_REQUIRED` | "Confirm with your one-time code first." | `signOtp` | Back to code |
| `ID_UNREADABLE` | "We couldn't read your ID. Take a clearer photo with all four corners in view. {n} tries left." | `idCapture` | Retake |
| `ID_EXPIRED` | "This ID has expired. Use a valid ID. {n} tries left." | `idCapture` | Use another ID |
| `FACE_MISMATCH` | "Your selfie doesn't match your ID. Try again in good light. {n} tries left." | `idCapture` | Retake selfie |
| `ID_NOT_SUPPORTED` | "We can't accept that kind of ID. Use a passport, driver licence or state ID." | `idCapture` | Choose document |
| `UNDERAGE` | "You must be 18 or older to open this account." (Student: "The Student Account is for ages 16 to 25.") | `notEligible` | Contact us / Done |
| `ID_REJECTED` | "We couldn't check your ID online. Nothing was charged." | `idFailed` | Find a branch |
| `ID_ATTEMPTS_EXCEEDED` | Same as `ID_REJECTED` | `idFailed` | Find a branch |
| `PRODUCT_NOT_ELIGIBLE` | "The Student Account is for students. Choose Student as your employment, or pick another account." | `personal` | Change employment / Change account |
| `TIN_INVALID` | "Enter your 9-digit number, like 900-70-0001." | `tax` | Change number |
| `COUNTRY_NOT_SUPPORTED` | "We can't take tax details for that country online. Visit a branch to finish." | `tax`, alert | Save and continue later / Find a branch |
| `FILE_TYPE_NOT_ALLOWED` | "Upload a PDF, JPG or PNG file." | `documents` | Choose another file |
| `FILE_TOO_LARGE` | "That file is {size} MB. The limit is 5 MB." | `documents` | Choose another file |
| `FILE_UNREADABLE` | "We can't read that file. Upload a clearer copy." | `documents` | Choose another file |
| `FILE_REJECTED` | "We can't accept that file. Upload a different one." | `documents` | Choose another file |
| `DOCUMENT_TOO_OLD` | "This document is more than 3 months old. Upload a newer one." | `documents` | Choose another file |
| `TOO_MANY_FILES` | "You can upload up to 2 files for this document." | `documents` | Remove a file |
| `DOCUMENT_REQUIRED` | "Upload every document to continue." | `documents` | Upload |
| `AGREEMENT_NOT_READ` | "Please read the whole agreement first." | `agreement` | Keep reading |
| `AGREEMENT_VERSION_CHANGED` | "The agreement was updated. Please read the new version." | `agreement` (sent back) | Read again |
| `SIGNATURE_EMPTY` | "Draw your signature in the box." | `sign` | Sign |
| `SIGNATURE_MISMATCH` | "The name doesn't match your ID. Type {fullName}." | `sign` | Change name |
| `INCOMPLETE` | "Your application isn't finished: {missing}. Go back to finish it." | `signOtp`, alert | Go to {screen} |
| `APPLICATION_NOT_FOUND` | "We can't find that application. Start a new one." | `expired` screen shell | Start again |
| `APPLICATION_EXPIRED` | "This application has expired. Start a new one." | `expired` | Start again |
| `TIMEOUT` | Non-money wording: "This is taking longer than expected. Nothing was changed." On `submit` the wording adds: "Check Track my application before you apply again, so you don't apply twice." | The step that was running | Try again (submit: Track my application) |
| `SERVICE_UNAVAILABLE` | S-`SERVICE_UNAVAILABLE` (README 1.6) | The step that was running | Try again / Save and continue later |

Business outcomes of `idCheck`, `uploadDocument`, `savePersonal`, `saveTax` and `start` come back as data (`{ ok: false, code, attemptsLeft? }`), as the `cab.*` adapters do, so the journey routes on them. Misuse (an unknown application id) throws.

#### 5. Adapters

| Integration id | Adapter | Request | Response | Error codes | Status | moneyMoving | requiresOtp |
|---|---|---|---|---|---|---|---|
| `start` | `bank.onboarding.start` | `{ productId, email, mobile }` | `{ ok: true, applicationId: "APP-20261103-0042", expiresOn }` | `EMAIL_INVALID`, `PHONE_INVALID`, `CANNOT_START`, `APPLICATION_EXISTS`, `PRODUCT_NOT_FOUND` | (planned) | No | No |
| `otpSend` | `bank.otp.send` | `{ channel: "sms" }` | `{ sent, maskedPhone, channel }` | – | Existing | No | No |
| `otpVerify` | `bank.otp.verify` | `{ code }` | `{ verified: true }` | `OTP_INVALID` (carries attempt) | Existing | No | No |
| `idCheck` | `bank.onboarding.idCheck` | `{ applicationId, documentType, frontImageId, backImageId?, selfieImageId }` | `{ ok: true, extracted: { fullName, dob, documentNumberMasked, expires, nationality } }` or `{ ok: false, code, attemptsLeft }` | `ID_UNREADABLE`, `ID_EXPIRED`, `FACE_MISMATCH`, `ID_NOT_SUPPORTED`, `UNDERAGE`, `ID_REJECTED`, `ID_ATTEMPTS_EXCEEDED` | (planned) | No | No |
| `savePersonal` | `bank.onboarding.savePersonal` | `{ applicationId, address, employment, employer?, occupation?, income, source, purpose }` | `{ ok: true }` or `{ ok: false, code, field? }` | `PRODUCT_NOT_ELIGIBLE`, `APPLICATION_EXPIRED`, `APPLICATION_NOT_FOUND` | (planned) | No | No |
| `saveTax` | `bank.onboarding.saveTax` | `{ applicationId, usPerson, ssn?, otherResidency?: { country, tin?, noTinReason? } }` | `{ ok: true }` or `{ ok: false, code }` | `TIN_INVALID`, `COUNTRY_NOT_SUPPORTED` | (planned) | No | No |
| `saveProduct` | `bank.onboarding.saveProduct` | `{ applicationId, productId, debitCard, paperless, nickname? }` | `{ ok: true, requiredDocuments: [{ kind, label }] }` | `PRODUCT_NOT_FOUND`, `PRODUCT_NOT_ELIGIBLE` | (planned) | No | No |
| `uploadDocument` | `bank.onboarding.uploadDocument` | `{ applicationId, kind: "address" \| "student", fileName, mimeType, sizeBytes, fileId }` | `{ ok: true, documentId, status: "accepted" }` or `{ ok: false, code }` | `FILE_TYPE_NOT_ALLOWED`, `FILE_TOO_LARGE`, `FILE_UNREADABLE`, `FILE_REJECTED`, `DOCUMENT_TOO_OLD`, `TOO_MANY_FILES` | (planned) | No | No |
| `removeDocument` | `bank.onboarding.removeDocument` | `{ applicationId, documentId }` | `{ ok: true }` | `APPLICATION_NOT_FOUND` | (planned) | No | No |
| `agreement` | `bank.onboarding.agreement` | `{ applicationId, markRead?: true }` | `{ version: "2026-10", title, sections: [{ heading, text }], read }` | `AGREEMENT_NOT_READ` (when `markRead` is not preceded by the viewer reaching the end), `APPLICATION_NOT_FOUND` | (planned) | No | No |
| `signApplication` | `bank.onboarding.sign` | `{ applicationId, agreementVersion, signature: { mode: "draw" \| "type", value } }` | `{ ok: true, signedAt }` or `{ ok: false, code }` | `OTP_REQUIRED`, `AGREEMENT_NOT_READ`, `AGREEMENT_VERSION_CHANGED`, `SIGNATURE_EMPTY`, `SIGNATURE_MISMATCH` | (planned) | No | Yes |
| `submitApplication` | `bank.onboarding.submit` | `{ applicationId }` | `{ ok: true, reference, status: "submitted", submittedAt }` or `{ ok: false, code: "INCOMPLETE", missing: [] }` | `INCOMPLETE`, `APPLICATION_EXPIRED`, `APPLICATION_NOT_FOUND` | (planned) | No | Yes (signed) |
| `saveForLater` | `bank.onboarding.save` | `{ applicationId }` | `{ ok: true, savedAt, expiresOn }` | `APPLICATION_EXPIRED`, `APPLICATION_NOT_FOUND` | (planned) | No | No |
| `getApplication` | `bank.onboarding.get` | `{ applicationId }` | `{ applicationId, status, resumeAt, productId, expiresOn }` (the data to resume with; used by `track-application` too) | `APPLICATION_NOT_FOUND`, `APPLICATION_EXPIRED` | (planned) | No | No |

Sandbox rules: an application is `draft` until `submit`, then `submitted`; drafts expire 30 days after the last save; an `idCheck` outcome is chosen by the test panel or the scenario's `idOutcome` (`good` default, `blurry`, `expired`, `mismatch`, `underage`, `unsupported`, `fraud`); a retryable failure counts toward 3 attempts, the third gives `ID_ATTEMPTS_EXCEEDED`; the age rule is 18 (Student Account 16 to 25 inclusive, in whole years from the date of birth at the sandbox clock; outside the band the code is `UNDERAGE`; a scenario can set the ID's date of birth with `idDob`); the sandbox decides a file by its name: `address-ok.pdf` and `student-letter.pdf` accepted, `address-old.pdf` is `DOCUMENT_TOO_OLD`, `scan-blurry.jpg` is `FILE_UNREADABLE`, `macro.exe` is `FILE_TYPE_NOT_ALLOWED`, `infected.pdf` is `FILE_REJECTED`, and a declared size above 5,242,880 bytes is `FILE_TOO_LARGE`; the typed signature must equal the ID name; `sign` and `submit` need the one-time code to have been verified (`OTP_REQUIRED`).

#### 6. Permissions, step-up and limits

No permission and no session. Step-up `otp` twice: to prove the mobile (`verifyPhone`) and to sign (`signOtp`). Limits: 3 one-time-code tries per code, resend after 30 seconds; 3 ID attempts; 5 MB and 2 files per document; drafts kept 30 days; one open application per email. Personal data is kept only in the application until it is approved or expires; the SSN is shown only as the last four digits after it is entered.

#### 7. Result and links out

Result: `submitted`. Receipt (planned receipts engine feature): application number, date and time (`3 Nov 2026 10:12 UTC`), account chosen, applicant name, masked email and mobile, documents received (file names), agreement version signed (2026-10), signature method, time of consent. Print on web, share sheet on mobile. Notifications: email "We've got your application APP-20261103-0042" and a text message with the same line; both say "You can follow it at any time with Track my application." Links out: Track my application (`track-application`, `{applicationId}`), View receipt, Done (Landing). From `idFailed`: `find-branch-atm`. From `notEligible`: `contact-support`.

#### 8. Acceptance criteria

- AC-1: A code sent to the mobile must be entered before the application goes further; the third wrong code stops the step.
- AC-2: A good ID and selfie give the confirm screen with the name and date of birth from the ID, which the person cannot edit.
- AC-3: A blurry, expired, non-matching or unsupported ID gives its message with the tries left; the third failure ends in the branch screen.
- AC-4: A person under 18 (or outside 16 to 25 for the Student Account) cannot continue and sees the eligibility message.
- AC-5: Every required personal field is checked with its exact message; the Student Account needs employment "Student".
- AC-6: A US person must give a valid number; a second tax country needs a country and a number or a reason.
- AC-7: A required document must be uploaded and accepted before Continue works; each file rule gives its own message.
- AC-8: The review screen shows everything entered and each group can be edited.
- AC-9: The agreement button works only after the whole agreement was read; the consent must be ticked.
- AC-10: A drawn signature must not be empty and a typed one must match the ID name; signing needs the one-time code.
- AC-11: Submitting gives an application number, a receipt and the notifications, and the application is `submitted`.
- AC-12: Save and continue later keeps the answers, ID result and files for 30 days, and not the signature or consent.
- AC-13: An expired or unknown application shows the expired screen.
- AC-14: A timeout on submit does not create a second application; the message points to Track my application.
- AC-15: An unavailable service on any step shows its message, keeps the answers and offers Save and continue later.

#### 9. Scenarios

Persona `sam` (one-time code `123456`; `000000` also accepted). Sandbox clock `now: 2026-11-03T10:00:00Z`. Details used unless stated: email `sam.rivera@example.com`, mobile `+1 415 555 0199`, address 500 Howard Street, San Francisco, CA 94105, Employed at Northwind Studio as Designer, income $50,000 to $99,999, source Salary, purpose Everyday spending, US person with number `900-70-0001`, no other residency, Everyday Account with debit card and paperless on, document `address-ok.pdf`, typed signature "Sam Rivera".

| Id | Covers | Setup / conditions | Steps | Expected |
|---|---|---|---|---|
| T-1 | AC-1, AC-2, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11 | `idOutcome: good` | Run the whole journey with the details above | Ends on `submitted` with `APP-20261103-0042`; application status `submitted`; email and text notifications recorded; receipt lists `address-ok.pdf`, version 2026-10, signature type |
| T-2 | AC-1 | – | At `verifyPhone` enter `111111`, `222222`, `333333` | Messages "That code isn't right. 2 tries left.", "...1 tries left."; third: "Too many wrong codes. Start again."; Start again returns to `contact`; the engine counted the failures on `otpVerify` |
| T-3 | AC-3 | `idOutcome: blurry` | Check my ID three times | Messages with 2, then 1 tries left; third time `idFailed` with Find a branch |
| T-4 | AC-3 | `idOutcome: expired`, then `good` | Check, change to good, Check again | First "This ID has expired. Use a valid ID. 2 tries left."; second reaches `idConfirm` |
| T-5 | AC-3 | `idOutcome: mismatch`, then `unsupported` | Check twice | Selfie message, then ID-type message; person stays on `idCapture` each time |
| T-6 | AC-4 | `idOutcome: underage` | Check | `notEligible`: "You must be 18 or older to open this account." |
| T-7 | AC-4, AC-5 | Student Account chosen. Run A: ID date of birth 14 Mar 1992 (age 34, the default). Run B: scenario sets `idDob: 2005-06-12` (age 21) | Run A: Check my ID. Run B: Check, then at `personal` choose Employed, then Student | Run A: `notEligible`, "The Student Account is for ages 16 to 25." (code `UNDERAGE` is also used for an age outside the product's band). Run B: Employed gives the `PRODUCT_NOT_ELIGIBLE` message on `personal`; Student continues |
| T-8 | AC-5 | – | Leave address, city, ZIP empty; enter ZIP `9410` | Each exact message; adapter not called |
| T-9 | AC-6 | – | US person on with SSN `12345`; then other residency on with no country | "Enter your 9-digit number, like 900-70-0001."; "Choose a country." |
| T-10 | AC-7 | – | Upload `macro.exe`, then `huge.pdf` declared 6 MB, `scan-blurry.jpg`, `infected.pdf`, `address-old.pdf`, then three good files | Each file message in the table; the third good file gives "You can upload up to 2 files for this document."; Continue is blocked with no accepted file ("Upload every document to continue.") |
| T-11 | AC-8 | After `documents` | Edit "Address" on `review`, change the city, return | Review shows the new city; other answers unchanged |
| T-12 | AC-9 | – | Press "I've read it" before the end (the scenario sends `markRead` early); then read to the end; then continue with the consent unticked | `AGREEMENT_NOT_READ` message; after the end the button works; consent unticked gives "You need to agree to continue." |
| T-13 | AC-10 | – | Type "Sam Rivers"; draw nothing; then type "sam  rivera"; then submit without a verified code (scenario skips `otpVerify`) | Mismatch message "The name doesn't match your ID. Type Sam Rivera."; empty-drawing message; "sam  rivera" accepted; `sign` without code gives `OTP_REQUIRED` |
| T-14 | AC-12 | After `product` | Save and continue later; later `track-application` → Continue application with the code | `saved` shows the 30-day date; resume opens on `documents`; earlier answers and the accepted file present; consent and signature empty |
| T-15 | AC-13 | After T-14, `now` advanced to `2026-12-04T10:00:00Z` | Continue application | `expired`: "This application has expired. Start a new one." |
| T-16 | AC-14 | `conditions.timeout: ["bank.onboarding.submit"]`, `latencyMs: 10000` | Submit at `signOtp` | Timeout message with Track my application; no application number; status still `draft`; clearing the condition and submitting once gives exactly one number |
| T-17 | AC-15 | `conditions.unavailable: ["bank.onboarding.idCheck"]` | Check my ID | Unavailable message; selfie and photos kept; Save and continue later offered |
| T-18 | AC-15 | `conditions.unavailable: ["bank.onboarding.uploadDocument"]` | Upload `address-ok.pdf` | Unavailable message under the field; no file listed |
| T-19 | AC-1 | – | Email of an existing customer (`alex.morgan@example.com`) | `CANNOT_START` message with the Register for digital banking button; the message does not say the email is known |
| T-20 | AC-2 | Start with `{productId: "loan_personal"}` | Open | Info alert about applying once signed in; Everyday Account preselected |

#### 10. Expected mutation-check survivors

| Survivor | Why it stays alive |
|---|---|
| Resend delay of 30 s changed | The engine's timer is tested in the `otp` block tests, not in a scenario clock. |
| Marketing toggle default | It changes nothing the scenarios assert. |
| `APPLICATION_NOT_FOUND` check removed | Only ids the journey created are used; a scenario would have to invent an id. |
| Student age bound 25 inclusive vs exclusive | T-7 uses ages 21 and 34; add age 26 and 25 only if the team wants the boundary proved (open question). |
| Postal ZIP+4 branch of the pattern | T-8 tests the 4-digit failure and the 5-digit pass, not the 9-digit form. |

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

#### 1. Summary

| Item | Value |
|---|---|
| Slug | `sign-in` |
| Purpose | Let a returning customer in with username and password, confirm a new device with a one-time code, offer to remember the device, and open Personal Home. Also the returning mode with quick PIN or biometrics. |
| Release | 1 |
| Workspace | `public` (planned field) |
| Status | New. Built from the CAB fixture `sign-in` (`fixtures/cab.ts`, slug `sign-in`) and its sandbox `cab.auth.signIn`, `cab.device.options`, `cab.device.verifyPin`. |
| Channels | Web, mobile |
| Starting pattern | CAB `sign-in` (screens `welcome`, `login`, `signed-in`, `locked`, `expired`, `inactive`) and the `default-sign-in` fixture for the PIN and biometric pop-ups. |
| Who may use it | Anyone. |

#### 2. Entry points

| Place | Launch point | Passes | Permission |
|---|---|---|---|
| Landing | Sign in | – | none |
| Reset and unlock results, `forgot-username` result | Sign in | `{username}` | none |
| Session-expired banner, sign-out | Sign in | – | none |
| Mobile app start with a remembered device | (automatic) returning mode | – | none |
| Landing, after `register-digital-banking` | Sign in | `{username}` | none |

Leads to: Personal Home (or, if the last used workspace was Business, Personal Home with a banner "Switch to {company}"). Switching to Business always needs a step-up, so the app never opens it directly from sign-in.

#### 3. Screens

**Screen `login` — "Sign in"** (blocks: `hero`, `sectionHeader`, `textInput` ×2, `alert`, `button`, `menu`, `dialog` ×2)

| Field | Block | Required | Rule | Error message |
|---|---|---|---|---|
| Username | `textInput` | Yes | Not empty after trimming; not case sensitive; at most 50 characters | "Enter your username." |
| Password | `textInput`, `secure: true` | Yes | Not empty; at most 100 characters | "Enter your password." |

Copy:
- Heading (`sectionHeader`): "Welcome" (returning mode: "Welcome back, {firstName}"). Subtitle: "Sign in to BankWorkx®".
- Alert (error, shown when `auth.result.code == 'INVALID_CREDENTIALS'`): "Incorrect username or password. {attemptsLeft} attempt(s) left before your profile is locked."
- Alert (info, shown when `ui.sessionExpired`): the `SESSION_EXPIRED` text.
- Helper under password: none. A "Show password" eye icon toggles the mask.
- Links (`menu`, text buttons): "Forgot username?", "Forgot password?", "Register for digital banking", and in sandbox builds only "Demo users".

Buttons:

| Button | Does | Leads to |
|---|---|---|
| Sign in (primary) | `validate`, then `callApi signIn`, then `navigate` | By `auth.result`: ok and `newDevice` → `deviceCode`; ok and not `newDevice` → `signedIn`; `LOCKED` → `locked`; `PASSWORD_EXPIRED` → `expired`; `INACTIVE` → `inactive` |
| Forgot username? | `navigate.toJourney` | `forgot-username` |
| Forgot password? | `navigate.toJourney` with `{username}` if typed | `reset-password` |
| Register for digital banking | `navigate.toJourney` | `register-digital-banking` |
| Demo users | `navigate` | `demoUsers` |

Returning-mode pop-ups (`dialog` blocks, as in CAB `login`; shown when `device.default` is `pin` or `biometric` and `ui.password` is not set):

| Pop-up | Title | Text | Buttons |
|---|---|---|---|
| Quick PIN (`bind: login.pin`, `length: 6`) | "Enter Sign in PIN" | "Enter your six digit PIN to sign in." After a wrong PIN: "That PIN is not right. {n} tries left." | "Use password" (sets `ui.password`, shows the form); "Sign In" (`callApi verifyPin`, then `navigate`) |
| Biometric (mobile) | "Unlock" | "Use your fingerprint or face to sign in." | "Use password"; "Unlock" |

States:
- **Loading.** On open, `deviceOptions` runs (`onEnter`). The greeting shows a skeleton line until it answers. While signing in the button shows a spinner and is disabled.
- **Timeout.** After 10 seconds without an answer the form stays and a toast shows "This is taking longer than expected. Nothing was changed." with the button "Try again". Nothing is locked by a timeout.
- **Error.** Network failure: toast "We couldn't reach the bank. Try again." (CAB wording).

**Screen `deviceCode` — "Confirm it's you"** (blocks: `text`, `otp`, `alert`, `button`)

Shown only when the sign-in answer says the device is new. The session is not open yet.

| Field | Block | Required | Rule | Error message |
|---|---|---|---|---|
| One-time code | `otp`, `length: 6`, `resendAfterSeconds: 30` | Yes | Exactly 6 digits | "Enter the 6-digit code." |

- On open: `callApi otpSend` with `channel: "sms"`. Hint: "We don't recognise this device. Enter the 6-digit code we sent to {maskedPhone}." Link under the code: "Send it by email instead" (calls `otpSend` with `channel: "email"`).
- Alert (error): "That code isn't right. {n} tries left." after a wrong code.
- Button "Verify" (primary): `validate`; `callApi otpVerify` (integration id exactly `otpVerify`, `onError: lockAfter 3, lockTo "otpLocked"`); `callApi completeSignIn`; `navigate` to `trustDevice`.
- Button "Cancel" (ghost): back to `login`; the half-done sign-in is dropped.
- **Loading.** Spinner on "Verify". **Timeout / unavailable.** Standard rows below.

**Screen `trustDevice` — "Remember this device?"** (blocks: `text`, `alert`, `textInput`, `button`)

Shown after a new-device code. Skipped for devices already trusted.

| Field | Block | Required | Rule | Error message |
|---|---|---|---|---|
| Device name | `textInput` | Yes | 1 to 40 characters; pre-filled from the device (e.g. "Alex's iPhone") | "Give this device a name (up to 40 characters)." |

- Body: "Next time you can sign in with your fingerprint, face or a 6-digit PIN, and we won't ask for a code on this device."
- Alert (info): "Only do this on a device you own."
- Alert (error, `DEVICE_LIMIT`): "You can remember up to 5 devices. Remove one first, or choose Not now." with the link "Manage trusted devices" → `trusted-devices` (then `returnTo` this screen).
- Buttons: "Remember this device" (primary): `callApi registerDevice` with `trust: true`, then `navigate.toJourney` → `setup-quick-login` with `returnTo` `signedIn`. "Not now" (ghost): `callApi registerDevice` with `trust: false` (the code will be asked again next time), then `navigate` to `signedIn`.

**Screen `signedIn` — "Signed in"** (terminal; blocks: `result`, `button`)

`onEnter` runs `bank.session.get` (saved as `session`): identity, the list of **contexts** and each context's permissions and limits.
- Result (success): title "Welcome back, {firstName}", text "You're signed in.", meta "Last sign in {lastLogin}".
- For Alex the session holds three contexts: Personal "Alex Morgan"; Alpha Trading LLC (role Maker); Beta Services Ltd (role Approver). The shell's context switcher is drawn from this list.
- Button "Go to Home" (primary): `exit` → Personal Home.
- If `session.lastContext` is a business context: banner "You last used {company}. Switch when you're ready." with the button "Switch to {company}" → context switch (step-up).

**Screen `demoUsers` — "Demo users"** (sandbox and demo builds only; hidden in production)

A `reviewSummary` list: one row per seed user: name, username, a one-line "what it shows" (table at the top of this group). Row button "Use" fills `login.username` and `login.password` and returns to `login`. Copy at the top: "These are practice profiles. They only exist in the sandbox."

**Terminal screens (blocks: `result`, `button`)**

| Screen | Result | Buttons |
|---|---|---|
| `locked` | Error: "Your profile is locked". Text: "For your security, sign in is blocked for {lockMinutes} minutes. Try again later, or unlock it now." | "Unlock account" (primary) → `unlock-account` `{username}`; "Back to sign in" (secondary) → `login` |
| `expired` | Error: "Your password has expired". Text: "Choose a new password to keep banking." | "Reset password" (primary) → `reset-password` `{username}`; "Back" |
| `inactive` | Error: "Your profile isn't active yet". Text: "Finish setting up digital banking first." | "Register" → `register-digital-banking`; "Track my application" → `track-application` |
| `otpLocked` | Error: "Too many incorrect codes". Text: "For your security, your profile is locked for 30 minutes. Try again later." (CAB `otp-locked` wording; this rewords the README default "Start again", because the lock is real.) | "Unlock account" → `unlock-account`; "Done" → `exit` |

#### 4. Sandbox errors

Sign-in outcomes arrive as data (`ok: false, code`), not exceptions.

| Code | Message the person sees | Screen | Button |
|---|---|---|---|
| `INVALID_CREDENTIALS` (errorCode 10095, `attemptsLeft` 2 then 1) | "Incorrect username or password. {attemptsLeft} attempt(s) left before your profile is locked." | `login` (alert) | Stay; try again |
| `LOCKED` (10088, `lockMinutes` 30). Also the answer to the third wrong try. | "Your profile is locked. For your security, sign in is blocked for 30 minutes. Try again later, or unlock it now." | `locked` | Unlock account |
| `INACTIVE` (10092) | "Your profile isn't active yet." | `inactive` | Register |
| `PASSWORD_EXPIRED` (10135, only after a right password) | "Your password has expired." | `expired` | Reset password |
| `INVALID_PIN` (planned; `attemptsLeft`) | "That PIN is not right. {n} tries left." | PIN pop-up | Try again; Use password |
| `OTP_INVALID` | "That code isn't right. {n} tries left." Third wrong: `otpLocked` text. | `deviceCode` | Try again; Unlock account |
| `OTP_REQUIRED` | Standard S-`OTP_REQUIRED` (cannot normally show; the journey sends the code first) | `deviceCode` | Back to code |
| `DEVICE_LIMIT` (planned) | "You can remember up to 5 devices. Remove one first, or choose Not now." | `trustDevice` | Manage trusted devices; Not now |
| `DEVICE_NAME_INVALID` (planned) | "Give this device a name (up to 40 characters)." | `trustDevice` | Edit |
| `TIMEOUT` (planned) | "This is taking longer than expected. Nothing was changed." | the screen that called | Try again |
| `SERVICE_UNAVAILABLE` (planned) | Standard S-`SERVICE_UNAVAILABLE` | the screen that called | Try again |
| `SESSION_EXPIRED` (planned) | On `deviceCode` and `trustDevice` only (the half-done sign-in expired after 5 minutes): "Your sign-in took too long. Start again." | `login` | Sign in |
| Network failure | "We couldn't reach the bank. Try again." (toast) | any | Try again |

Not applicable: `PERMISSION_DENIED`, `WRONG_CONTEXT`, `STEP_UP_REQUIRED` (a sign-in is the proof), `NOT_SUPPORTED`, the money codes.

#### 5. Adapters

| Integration id | Adapter | Request | Response | Error codes | Status | moneyMoving | requiresOtp |
|---|---|---|---|---|---|---|---|
| `deviceOptions` | `bank.device.options` (CAB: `cab.device.options`) | `{ deviceId }` | `{ mode, default, pinSet, biometricAvailable, firstName, trusted }` | `TIMEOUT`, `SERVICE_UNAVAILABLE` | Planned | No | No |
| `signIn` | `bank.auth.signIn` (CAB: `cab.auth.signIn`) | `{ username, password, deviceId }` | `{ ok: true, firstName, lastLogin, defaultSignIn, newDevice, accountCount }` or `{ ok: false, code, errorCode, attemptsLeft?, lockMinutes? }` | Data codes above; throws `TIMEOUT`, `SERVICE_UNAVAILABLE` | Planned | No | No |
| `verifyPin` | `bank.device.verifyPin` (CAB: `cab.device.verifyPin`) | `{ pin }` | Same answer as a right password, or `{ ok: false, code: "INVALID_PIN", attemptsLeft }` | `LOCKED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | Planned | No | No |
| `otpSend` | `bank.otp.send` | `{ channel }` | `{ sent, maskedPhone, channel }` | `TIMEOUT`, `SERVICE_UNAVAILABLE` | Existing | No | – |
| `otpVerify` | `bank.otp.verify` | `{ code }` | `{ verified: true }` | `OTP_INVALID` (carries `attempt`) | Existing | No | – |
| `completeSignIn` | `bank.auth.completeSignIn` | `{ deviceId }` (needs the code verified) | `{ ok: true, sessionId }` | `OTP_REQUIRED`, `SESSION_EXPIRED` | Planned | No | Yes (new device) |
| `registerDevice` | `bank.device.register` | `{ name, trust }` | `{ deviceId, trusted }` | `DEVICE_LIMIT`, `DEVICE_NAME_INVALID`, `SESSION_EXPIRED` | Planned | No | No |
| `session` | `bank.session.get` | `{}` | `{ identity, contexts: [{ id, kind, name, role, permissions, limits }], lastContext }` | `SESSION_EXPIRED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | Planned | No | No |

#### 6. Permissions, step-up and limits

- Permission needed: none. Step-up: none. Limits: 3 wrong passwords or PINs lock the profile for 30 minutes; 3 wrong one-time codes lock it too; resend after 30 seconds; the half-done sign-in expires after 5 minutes.
- The sandbox keeps one failed counter per profile and does not count down the 30 minutes on its own: a scenario sets the clock with `now`, or uses `unlock-account` (planned).

#### 7. Result and links out

- **Result:** `signedIn` (reference: none; shows last sign-in time).
- **Receipt:** none.
- **Notifications raised:** "New sign-in on {deviceName}" (in-app and email) when a new device is verified; "Your profile was locked" when `LOCKED` is first reached (planned).
- **Links out:** "Go to Home" → Personal Home. Locked → `unlock-account`. Expired → `reset-password`. Inactive → `register-digital-banking`, `track-application`. Remember this device → `setup-quick-login` then back to `signedIn`.

#### 8. Acceptance criteria

- **AC-1.** A right username and password on a known device opens `signedIn` and then Personal Home, with the person's first name and last sign-in time.
- **AC-2.** A wrong password keeps the person on `login` and shows the attempts left (2, then 1) without saying which field was wrong.
- **AC-3.** The third wrong password ends on `locked` with the message "sign in is blocked for 30 minutes".
- **AC-4.** A locked profile answers `locked` even with the right password.
- **AC-5.** An expired password (after a right password) ends on `expired`; an inactive profile ends on `inactive`.
- **AC-6.** On a new device a right password leads to `deviceCode`, and no session exists until the right code is entered.
- **AC-7.** Three wrong one-time codes end on `otpLocked`; the right code (`482100`) leads to `trustDevice`.
- **AC-8.** "Remember this device" saves the device and opens `setup-quick-login`; "Not now" skips it and the code is asked again next time.
- **AC-9.** In returning mode a right PIN signs in with the same result as a right password, a wrong PIN shows the tries left, and "Use password" always shows the form.
- **AC-10.** Wrong passwords and wrong PINs share one counter of 3.
- **AC-11.** The sign-in answer loads the contexts; for Alex Morgan they are Personal, Alpha Trading LLC (Maker) and Beta Services Ltd (Approver).
- **AC-12.** On a timeout or an unavailable service the person sees the standard message and nothing is locked or changed.
- **AC-13.** A sixth trusted device is refused with `DEVICE_LIMIT` and the person can still continue with "Not now".

#### 9. Scenarios

| ID | Covers | Persona | Setup and conditions | Expected |
|---|---|---|---|---|
| T-1 | AC-1, AC-11 | `alex.morgan` | Device already trusted. Enter `alex.morgan` / `Bwx!Demo2026`. | Ends on `signedIn`: "Welcome back, Alex". `bank.session.get` returns 3 contexts with roles Maker (Alpha) and Approver (Beta). |
| T-2 | AC-2, AC-10 | `alex.morgan` | Wrong password once, then twice. | First: "2 attempt(s) left", then "1 attempt(s) left". Stays on `login`. |
| T-3 | AC-3, AC-4 | `alex.morgan` | Three wrong passwords, then the right one. | Third answer is `LOCKED`, screen `locked` with "30 minutes". The right password then still answers `LOCKED`. |
| T-4 | AC-5 | `demo.expired`, `demo.inactive` | Right password for each. | `expired` for `demo.expired`; `inactive` for `demo.inactive`. |
| T-5 | AC-6, AC-7 | `alex.morgan` | New device. Right password, code `482100`. | Goes to `deviceCode`; session absent until `completeSignIn`; after the code, `trustDevice`. |
| T-6 | AC-7 | `alex.morgan` | New device; code `111111` three times. | `OTP_INVALID` attempts 1, 2, 3; ends on `otpLocked` (`lockTo`). No session. |
| T-7 | AC-8 | `alex.morgan` | New device, right code; choose "Remember this device" with name "Alex's iPhone". | `registerDevice` trust true, opens `setup-quick-login`, returns to `signedIn`. Second case: "Not now" then a new sign-in asks for a code again. |
| T-8 | AC-9, AC-10 | `alex.morgan` | Device with quick PIN `482916` set and default `pin`. Wrong PIN `000000` once, then right PIN. | "That PIN is not right. 2 tries left." then `signedIn`. Second case: 1 wrong password + 1 wrong PIN + 1 wrong PIN = `LOCKED`. |
| T-9 | AC-9 | `alex.morgan` | Default `biometric`; choose "Use password". | Form shows; password sign-in works. |
| T-10 | AC-12 | `alex.morgan` | Timeout: `conditions.timeout: ["bank.auth.signIn"]`. | "This is taking longer than expected. Nothing was changed." Failed counter unchanged: three wrong passwords later still lock on the third. |
| T-11 | AC-12 | `alex.morgan` | Unavailable: `conditions.unavailable: ["bank.auth.signIn"]`. | Standard S-`SERVICE_UNAVAILABLE`; counter unchanged. |
| T-12 | AC-12 | `alex.morgan` | New device; `conditions.timeout: ["bank.otp.verify"]` on the code step. | Timeout message; the code attempt is not counted. |
| T-13 | AC-13 | `alex.morgan` | Five trusted devices already; sign in on a sixth and choose "Remember this device". | `DEVICE_LIMIT` message; "Not now" completes the sign-in. |

#### 10. Expected mutation-check survivors

| Mutant | Why it survives |
|---|---|
| `resendAfterSeconds` removed or changed on the `otp` block | The sandbox has no clock for resend; it is a screen timing rule only. |
| The biometric pop-up's "Unlock" is made to do nothing | The sandbox cannot produce the phone's own fingerprint or face prompt; the pop-up is a stand-in. |
| `LOCK_MINUTES` raised above 30 without changing the text | Killed only if a scenario asserts the number; the sandbox does not expire the lock by itself, so no scenario can wait the 30 minutes. T-3 asserts the text, so this one should be killed. |
| Changing the greeting to drop the last sign-in time | Presentation only; no rule depends on it. |

---

### ★ Set up quick sign in — `setup-quick-login`

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

### ★ Account statement — `account-statement`

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `account-statement` |
| Purpose | Make a statement for one account and period, as a PDF or CSV the person can download or share. |
| Release / workspace | 1 / Personal |
| Status | New (planned). File journey. |
| Channels | Web and mobile |
| Starting pattern | None (new). Pick account, pick period, pick format, generate, result with the file. |
| Who may use it | Anyone with `accounts.statement` (Alex, Personal context). |

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Accounts › detail › Statement | `{accountId}` | `accounts.statement` |
| Accounts › transaction history › Export | `{accountId, from, to}` | `accounts.statement` |
| ⌘K command bar, deep link `/personal/j/account-statement?accountId=…` | `{accountId}` optional | `accounts.statement` |

#### 3. Screens

**`setup` — "Get a statement"** (entry). Blocks: `stepper` (setup, result), `accountPicker` (`stmt.accountId`, `showBalance`), `select` chips (`stmt.period`), `datePicker` range (planned, shown for Custom), `select` tiles (`stmt.format`), `alert`, `button`.

| Field | Block | Required | Validation | Error message |
|---|---|---|---|---|
| From account | `accountPicker` | Yes (prefilled when `accountId` is passed) | Must be one of the person's accounts | "Choose an account." |
| Period | `select` chips: This month, Last month, Last 3 months, Last 6 months, Custom | Yes (default Last month) | One of the five | "Choose a period." |
| Dates (Custom only) | `datePicker` range (planned), labels "From" and "To" | Yes when Custom | Start on or before end; end not after today (2 Nov 2026); start not before the account's open date; at most 12 months | "The end date must be after the start date." / "Choose a date that isn't in the future." / "Choose a period of 12 months or less." |
| Format | `select` tiles: PDF ("Best for sharing and printing"), CSV ("Best for spreadsheets") | Yes (default PDF) | One of two | "Choose a format." |

Copy: title "Get a statement". Helper under Period: "Statements cover up to 12 months." Alert (info): "Your statement shows your IBAN and your full transaction list. Keep it safe." Button **Create statement** (validate, then `callApi createStatement`). Loading: button disabled with spinner and text "Creating your statement…". Error: toast on the screen for validation; service errors go to the states below.

**`result` — "Your statement is ready"** (terminal, kind `terminal`). Blocks: `result` tone success, `documentViewer` preview (planned, first page, read-only), `button`s.

- Title "Your statement is ready". Text "{accountName} {mask}, {from} to {to}. {count} transactions." Meta "Ref {reference} · {format} · {sizeKb} KB".
- Buttons: **Download** (web: browser download; mobile: save to Files), **Share** (`share` action; mobile share sheet), **Done** (exit to origin).
- Empty period: when `count` is 0 the journey does not reach this screen; see `empty` below.

**`empty` — "No transactions in this period"** (branch). `alert` tone info: "There are no transactions on {account} between {from} and {to}." Buttons **Change period** (to `setup`), **Close** (exit).

**`timeout`**, **`unavailable`**, **`failed`**: see section 4.

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `ACCOUNT_NOT_FOUND` | "We can't find that account. Choose another." | `setup` (inline on the account field) | Choose account |
| `RANGE_INVALID` (planned) | "The end date must be after the start date." | `setup` (on Dates) | Fix dates |
| `RANGE_TOO_LONG` (planned) | "Choose a period of 12 months or less." | `setup` (on Dates) | Fix dates |
| `FUTURE_DATE` (planned) | "Choose a date that isn't in the future." | `setup` (on Dates) | Fix dates |
| `NO_TRANSACTIONS` (planned) | "There are no transactions on {account} between {from} and {to}." | `empty` | Change period |
| `NOT_SUPPORTED` | "This isn't available for your profile." | `failed` | Back |
| `TIMEOUT` (planned) | "This is taking longer than expected. Nothing was changed." | `timeout` | Try again |
| `SERVICE_UNAVAILABLE` (planned) | "This service is not available right now. Nothing was changed. Please try again in a few minutes." | `unavailable` | Try again / Back |
| `WRONG_CONTEXT` (planned) | Standard message S-`WRONG_CONTEXT` (README 1.6) | `failed` | Switch |
| `SESSION_EXPIRED` (planned) | Standard message S-`SESSION_EXPIRED` | sign-in | Sign in |

Statements move no money, so `TIMEOUT` and `SERVICE_UNAVAILABLE` both say "Nothing was changed."

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `accounts` | `bank.accounts.list` | none | map of accounts | none | Existing |
| `createStatement` | `bank.statements.create` | `{accountId, from, to, format: "pdf"\|"csv"}` | `{reference, fileName, format, sizeKb, pages, count, openingBalance, closingBalance, downloadUrl, expiresAt}` (the link is valid for 10 minutes) | `ACCOUNT_NOT_FOUND`, `RANGE_INVALID`, `RANGE_TOO_LONG`, `FUTURE_DATE`, `NO_TRANSACTIONS`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned). `moneyMoving: false`, `requiresOtp: false` |

Sandbox arithmetic to rely on: Alex's seeded transactions give **3** for "This month" (1 to 2 Nov: Food & Drinks −20.00, Freelancing Work +22.00, Shopping −20.00; net −18.00) and **7** for "Last month" (22 to 31 Oct; net +2,096.60).

#### 6. Permissions, step-up and limits

`accounts.statement`. Step-up level `none` (session only). No limit on the number of statements; maximum span 12 months; download link lives 10 minutes, after which Statement must be run again. Business context: `WRONG_CONTEXT`.

#### 7. Result and links out

Result screen as in section 3. Receipt: the file itself (a statement is its own proof; no separate receipt). Notifications raised: none. Buttons: **Download**, **Share**, **Done** (back to Accounts › detail or history, wherever the person started).

#### 8. Acceptance criteria

- AC-1: The person can pick an account, a preset period and a format, and receive a file named `statement-{mask}-{from}-{to}.{ext}` with a reference.
- AC-2: A custom period longer than 12 months is refused with "Choose a period of 12 months or less." and no file is made.
- AC-3: An end date before the start date or in the future is refused with the exact messages in section 3.
- AC-4: A period with no transactions shows "There are no transactions on {account} between {from} and {to}." and offers Change period.
- AC-5: The transaction count and closing balance on the result match the sandbox data for that period (3 transactions for This month, 7 for Last month for Alex's Main account).
- AC-6: If the service times out, the person is told nothing was changed and can try again; no file is offered.
- AC-7: If the service is unavailable, the person sees the standard unavailable message and can go back.
- AC-8: Sam Rivera (no accounts) cannot reach the journey; Alex in a Business context gets the switch message.

#### 9. Scenarios

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-5 | `alex`, `now` 2 Nov 2026 | none | Choose Main, Last month, PDF, Create statement. Result shows "7 transactions" and a reference. |
| T-2 | AC-5 | `alex` | none | Choose Main, This month, CSV. Result shows "3 transactions". |
| T-3 | AC-2 | `alex` | none | Custom 1 Oct 2025 to 2 Nov 2026. Field error "Choose a period of 12 months or less."; no call made. |
| T-4 | AC-3 | `alex` | none | Custom start 10 Oct, end 1 Oct: "The end date must be after the start date." End 5 Nov 2026: "Choose a date that isn't in the future." |
| T-5 | AC-4 | `alex` | `empty: ["bank.statements.create"]` | Any valid period. Lands on `empty`; **Change period** returns to `setup` with choices kept. |
| T-6 | AC-6 | `alex` | `timeout: ["bank.statements.create"]`, `latencyMs: 10000` | Create statement. `timeout` screen: "This is taking longer than expected. Nothing was changed." **Try again** works after the condition is cleared. |
| T-7 | AC-7 | `alex` | `unavailable: ["bank.statements.create"]` | `unavailable` screen with the standard message. |
| T-8 | AC-8 | `sam`; `alex` with Business active | none | Sam: no Statement button (no accounts). Alex in Business: `WRONG_CONTEXT`. |

#### 10. Expected mutation-check survivors

`FUTURE_DATE` check is enforced both in the datePicker (cannot pick a future day) and in the sandbox, so removing only the sandbox check survives T-4; expected survivor, the UI layer still stops it. All others: none expected.

---

### ★ Rename an account — `account-nickname`

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `account-nickname` |
| Purpose | Give an account a friendly name that shows everywhere in the app. |
| Release / workspace | 1 / Personal |
| Status | New (planned). |
| Channels | Web and mobile |
| Starting pattern | None. One screen plus result. |
| Who may use it | `accounts.manage` |

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Accounts › detail › Rename | `{accountId}` | `accounts.manage` |
| ⌘K command bar | `{accountId}` optional | `accounts.manage` |

#### 3. Screens

**`rename` — "Rename account"** (entry). Blocks: `text` (current name), `textInput`, `button`.

| Field | Block | Required | Validation | Error message |
|---|---|---|---|---|
| Account | `accountPicker` (only when `accountId` was not passed) | Yes | Own account | "Choose an account." |
| New name | `textInput`, label "Account name", placeholder "For example, Holiday fund" | Yes | 2 to 24 characters; letters, digits, spaces and `& - ' .`; not only spaces; not the same as another account's name | "Enter a name of 2 to 24 characters." / "Use letters, numbers and spaces only." / "You already have an account called {name}." |

Copy: title "Rename account". Body "Currently called **{currentName}** (••4410). Only you see this name." Helper "2 to 24 characters." Button **Save name** (validate, call `rename`). Secondary **Cancel** (exit). Loading: disabled button with spinner.

**`success` — "Name saved"** (terminal). `result` success: title "Name saved", text "Your account is now called {newName}.", no reference. Buttons **Done** (exit to account detail).

**`failed`** (terminal). `result` error: title "Name not saved", text per error, button **Try again** (to `rename`).

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `ACCOUNT_NOT_FOUND` | "We can't find that account. Choose another." | `failed` | Choose account |
| `NAME_INVALID` (planned) | "Enter a name of 2 to 24 characters, using letters, numbers and spaces only." | `rename` (inline) | Edit |
| `NAME_EXISTS` (planned) | "You already have an account called {name}." | `rename` (inline) | Edit |
| `NOT_SUPPORTED` | "This isn't available for your profile." | `failed` | Back |
| `TIMEOUT` (planned) | "This is taking longer than expected. Nothing was changed." | `failed` | Try again |
| `SERVICE_UNAVAILABLE` (planned) | Standard message S-`SERVICE_UNAVAILABLE` | `failed` | Try again |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `accounts` | `bank.accounts.list` | none | accounts | none | Existing |
| `rename` | `bank.accounts.rename` | `{accountId, name}` | `{accountId, name, previousName}` | `ACCOUNT_NOT_FOUND`, `NAME_INVALID`, `NAME_EXISTS`, `NOT_SUPPORTED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned). Not money-moving; no OTP |

The nickname is stored as `Account.nickname`; the `name` field the app shows becomes the nickname when set. The IBAN and mask never change.

#### 6. Permissions, step-up and limits

`accounts.manage`; step-up `none`. No limits.

#### 7. Result and links out

Result as above; no receipt; notifications none. **Done** returns to Accounts › detail with the new name in the header and the Home account card.

#### 8. Acceptance criteria

- AC-1: A valid name is saved and shows on the account detail, the list and the Home card.
- AC-2: A name shorter than 2 or longer than 24 characters, or with other symbols, is refused with the exact message.
- AC-3: A name already used by another of the person's accounts is refused.
- AC-4: The IBAN, mask and balance are unchanged after a rename.
- AC-5: When the service is unavailable or times out nothing is changed and the old name stays.

#### 9. Scenarios

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-4 | `alex` | none | Rename Savings to "Rainy day". Success text "Your account is now called Rainy day." `bank.accounts.list` shows the name; IBAN `US00 BWX 0000 0000 7731` unchanged. |
| T-2 | AC-2 | `alex` | none | "A" and a 25-character name each give the inline message; no call. |
| T-3 | AC-3 | `alex` | none | Rename Savings to "Main". "You already have an account called Main." |
| T-4 | AC-5 | `alex` | `unavailable: ["bank.accounts.rename"]` | Failed screen; name unchanged. |
| T-5 | AC-5 | `alex` | `timeout: ["bank.accounts.rename"]` | Failed screen with the timeout copy; name unchanged. |

#### 10. Expected mutation-check survivors

None expected.

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

### ★ Between my accounts — `own-transfer`

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `own-transfer` |
| Purpose | Move money between the customer's own accounts. Same currency is a plain transfer; different currencies are converted at a quoted rate, with the fee shown. |
| Release / workspace | 1 / Personal |
| Status | Existing, upgraded. The FX half is `fixtures/convert-currency.ts` (slug `convert-currency`, id `jrn_convert_currency`, version 1, published, web and mobile, English and Urdu). The same-currency half is new (planned). The slug moves to `own-transfer`; `convert-currency` stays as an alias for Meezan. |
| Channels | Web and mobile |
| Starting pattern | `fixtures/convert-currency.ts` |
| Who may use it | `payments.create` |

**What exists today.** Screens `from` (account picker with balances), `to` (second picker, helper "Choose an account in a different currency."), `amount` (an `amountInput` in the currency of the source account, helper "Available: …", button **See the rate** that calls `quote` and shows a toast "We couldn't price this. Check that the accounts are in different currencies and you have enough money." on failure), `review` (rows From, To, You convert, Rate, Fee, You get; info alert "This rate is valid for {ttlSeconds} seconds. If it runs out you will be shown a new one."; consent `fx-v1`; **Confirm and send OTP**), `otp` (button **Verify and convert**), `success` ("Converted", "{from} became {to}.", `Ref`), `failed` ("Not converted": "No money has left your account. The rate may have run out: try again to get a new one."). The fixture only handles different currencies, shows a generic failure for every cause, and counts toward no limit.

**The upgrade.** Same-currency transfers; specific messages per code; a visible rate countdown with a refresh; limits; receipts; links.

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Payments › hub › Between my accounts | none | `payments.create` |
| Accounts › detail › Transfer from this account | `{accountId}` (prefills From) | `payments.create` |
| Home › + Send money › Between my accounts | none | `payments.create` |
| Payments › tracker › payment › Repeat payment | `{paymentId}` | `payments.create` |

#### 3. Screens

**`accounts` — "Between my accounts"** (entry). `stepper` ["accounts", "amount", "review", "otp"]. onEnter: `accounts`.

| Field | Block | Required | Validation | Error message |
|---|---|---|---|---|
| From | `accountPicker` `own.from`, `showBalance` | Yes | Own account that can debit (`canDebit`, not frozen) | "Choose an account to send from." |
| To | `accountPicker` `own.to`, `showBalance` | Yes | Own account, not the same as From; a frozen account may receive | "Choose an account to send to." / "Choose two different accounts." |

Copy: title "Which accounts?". Helper under To: "Money between your own accounts arrives straight away." When the two currencies differ an `alert` (info) appears: "These accounts use different currencies, so we'll convert the money. You'll see the rate before you confirm." Button **Continue**. If only one account exists: empty state "You need two accounts to move money between them." with **Open another account**.

**`amount` — "Amount"**.

| Field | Block | Required | Validation | Error message |
|---|---|---|---|---|
| Amount | `amountInput` in the From currency (`currency: "{{ctx.accounts[own.from].currency}}"`), helper "Available: {balance}" | Yes | Greater than 0; at most the currency's decimals (USD 2, JPY 0, KWD 3); at most the available balance (the FX path adds the 0.2% fee to this check) | "Enter an amount greater than 0." / "Enter an amount in {currency} with at most {digits} decimal places" / "There isn't enough money in {account}. Available: {balance}." |
| Note (same currency only) | `textInput` | No | Up to 35 characters | "Use 35 characters or fewer." |

Buttons: same currency: **Review transfer** (validate, navigate `review`). Different currencies: **See the rate** (validate, `callApi quote`, saveAs `ctx.quote`, then `review`). Loading: spinner on the button; the quote call must answer within 10 s.

**`review` — "Review transfer"**. Same currency rows: From, To, You send, Fee "$0.00" (in the currency), They get, Arrives "Now". Different currencies rows exactly as the fixture: From, To, You convert, Rate ("1 USD = 0.9154 EUR"), Fee, You get; plus **Total taken** (amount plus fee), and the mid-market rate in small print ("Mid-market rate 0.92 EUR. Our margin is 0.5%."). Rate countdown (different currencies): alert info "This rate is valid for 30 seconds." with a live "Rate expires in {n}s"; at 0 the alert becomes warning "The rate has expired." and the button reads **Get a new rate**. Consent text: "I confirm the details are correct" (same currency, `termsVersion` "transfers-v3") or "I confirm the details and the rate are correct" (`fx-v1`). Button **Confirm and send code**.

**`otp`** — shared screen C; button **Send {amount}** (same currency) or **Convert {amount}** (FX).

**`rateExpired` — "The rate has changed"** (branch, on `QUOTE_EXPIRED`). Alert warning: "The rate has expired. Get a new one." Button **Get a new rate** calls `quote` again, clears consent and the code, and returns to `review`; if the new rate differs it adds "The rate moved from 0.9154 to {new}."

**`success` — "Money moved"** (terminal). Same currency: text "{amount} moved from {from} to {to}." FX: "{from.amount} became {to.amount}." (fixture wording "Converted"). Meta "Ref {reference}". Buttons **Track payment**, **View receipt**, **Done**.

**`locked`, `timeout`, `unavailable`, `failed`** — shared screens C.

#### 4. Sandbox errors

| Code | Message the person sees | Shows on | Button |
|---|---|---|---|
| `OTP_INVALID` | S-`OTP_INVALID` | `otp`; after 3: `locked` | Try again / Start again |
| `OTP_REQUIRED` | S-`OTP_REQUIRED` | `failed` | Back to code |
| `ACCOUNT_NOT_FOUND` | S-`ACCOUNT_NOT_FOUND` | `failed` | Choose account |
| `ACCOUNT_CANNOT_DEBIT` (planned; `canDebit` is false or status is frozen) | "You can't send money from {account} right now. Choose another account." | `accounts` | Choose account |
| `SAME_ACCOUNT` (planned) | "Choose two different accounts." | `accounts` | Choose account |
| `SAME_CURRENCY` (FX path; existing) | "Choose two accounts in different currencies" (not reachable: the journey uses the plain path for equal currencies) | `accounts` | Choose account |
| `CURRENCY_NOT_SUPPORTED` (existing) | "We can't convert between {from} and {to} yet." (sandbox text: "We do not convert that currency pair") | `accounts` | Choose account |
| `INVALID_AMOUNT` (existing in FX; planned for plain) | "Enter an amount in {currency} with at most {digits} decimal places" | `amount` | Change amount |
| `INSUFFICIENT_FUNDS` | S-`INSUFFICIENT_FUNDS` | `amount` (quote) or `failed` (convert) | Change amount |
| `QUOTE_EXPIRED` (existing) | "The rate has expired. Get a new one." | `rateExpired` | Get a new rate |
| `QUOTE_USED` (existing) | "This rate was already used. Get a new one." | `rateExpired` | Get a new rate |
| `QUOTE_NOT_FOUND` (existing) | "We couldn't find that rate. Get a new one." | `rateExpired` | Get a new rate |
| `CORE_UNAVAILABLE` | S-`CORE_UNAVAILABLE` | `failed` | Try again |
| `NOT_SUPPORTED` | S-`NOT_SUPPORTED` | `failed` | Back |
| `TIMEOUT` (planned) | "We didn't get an answer in time. Check Activity before you try again, so you don't pay twice." | `timeout` | Check Activity |
| `SERVICE_UNAVAILABLE` (planned) | S-`SERVICE_UNAVAILABLE` | `unavailable` | Try again |

`LIMIT_EXCEEDED` is not possible: money between a customer's own accounts does not use the daily limit (as `bank.fx.convert` already behaves).

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `accounts` | `bank.accounts.list` | none | accounts | none | Existing |
| `quote` | `bank.fx.quote` | `{fromAccountId, toAccountId, amount}` | `{quoteId, fromAccountId, toAccountId, from{currency, amount}, to{currency, amount}, midRate, rate, fee, feeCurrency, total, expiresAt, ttlSeconds}` (30 s) | `ACCOUNT_NOT_FOUND`, `SAME_CURRENCY`, `CURRENCY_NOT_SUPPORTED`, `INVALID_AMOUNT`, `INSUFFICIENT_FUNDS` | Existing. Not money-moving; no OTP |
| `convert` | `bank.fx.convert` | `{quoteId}` | `{reference, from{currency, newBalance}, to{currency, newBalance}, quoteId}` | `OTP_REQUIRED`, `CORE_UNAVAILABLE`, `QUOTE_NOT_FOUND`, `QUOTE_USED`, `QUOTE_EXPIRED`, `INSUFFICIENT_FUNDS` | Existing. Money-moving; OTP |
| `transferOwn` | `bank.transfers.own` | `{fromAccountId, toAccountId, amount, note?}` | `{reference, from{newBalance, currency}, to{newBalance, currency}}` | `OTP_REQUIRED`, `CORE_UNAVAILABLE`, `ACCOUNT_NOT_FOUND`, `ACCOUNT_CANNOT_DEBIT`, `SAME_ACCOUNT`, `INVALID_AMOUNT`, `INSUFFICIENT_FUNDS`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned). Money-moving; OTP |
| `otpSend`, `otpVerify` | `bank.otp.send`, `bank.otp.verify` | `{channel}`, `{code}` | `{sent, maskedPhone, channel}`, `{verified}` | `OTP_INVALID` | Existing |

Rates (existing, `fx.ts`): mid-market from a table; customer rate is the mid rate less 0.5%; fee is 0.2% of the amount sent; quote valid 30 s. Worked example for Alex: convert **USD 500.00** from Main to EUR Travel: mid 0.92, rate **0.9154**, fee **USD 1.00**, total taken **USD 501.00**, receives **EUR 457.70**. Main 8,720.76 becomes 8,219.76; EUR Travel 2,400.00 becomes 2,857.70. Reference `FX-20261102-0931`.

#### 6. Permissions, step-up and limits

`payments.create`; step-up `otp`. No daily limit applies. No cooling-off (own accounts). Business context: `WRONG_CONTEXT`.

#### 7. Result and links out

Result as above. Receipt (planned): kind "Transfer between your accounts" or "Currency conversion" with from, to, amounts, rate, fee, reference. Notifications: in-app "{amount} moved to {account}" (and SMS only above $1,000 equivalent, planned). Buttons: **Track payment** (tracker detail), **View receipt**, **Done**.

#### 8. Acceptance criteria

- AC-1: A same-currency transfer needs a verified code, moves the exact amount, and both balances change by it.
- AC-2: A different-currency transfer shows the rate, the fee, the total taken and what the person gets before any code is asked.
- AC-3: The rate is good for 30 seconds; after that the person must get a new rate and cannot confirm the old one.
- AC-4: The amount plus fee can never exceed the available balance.
- AC-5: Choosing the same account twice is refused with "Choose two different accounts."
- AC-6: A wrong code three times stops the journey and no balance changes.
- AC-7: A timeout tells the person to check Activity and changes no balance.
- AC-8: An unavailable service shows the standard message and changes no balance.
- AC-9: The daily limit is untouched by a transfer between own accounts.

#### 9. Scenarios

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-9 | `alex` | none | Main to Savings, $200.00, note "Rainy day", code `482100`. Main 8,520.76; Savings 15,454.37; `bank.limits.get` `usedToday` still 0. |
| T-2 | AC-2, AC-4 | `alex` | none | Main to EUR Travel, $500.00. Review shows rate 0.9154, fee $1.00, total $501.00, you get €457.70. After code: Main 8,219.76; EUR 2,857.70. |
| T-3 | AC-3 | `alex`, `now` controllable | none | Get the quote, advance `now` by 31 s, confirm with `482100`. `QUOTE_EXPIRED`; `rateExpired` screen; no balance change; **Get a new rate** returns to a fresh review. |
| T-4 | AC-4 | `alex` | none | $8,720.76 Main to EUR Travel: total 8,738.20 is above the balance, `INSUFFICIENT_FUNDS` at the quote. |
| T-5 | AC-5 | `alex` | none | Choose Main twice: "Choose two different accounts." |
| T-6 | AC-6 | `alex` | none | Review, then `111111` three times: `locked`; balances unchanged. |
| T-7 | AC-7 | `alex` | `timeout: ["bank.transfers.own"]`, `latencyMs: 10000` | `timeout` screen with the Activity message; balances unchanged. |
| T-8 | AC-8 | `alex` | `unavailable: ["bank.fx.quote"]` | **See the rate** shows the unavailable screen; nothing changed. |
| T-9 | AC-1 | `bilal`-style flag (`transferFails`) on `alex` | none | Code accepted, `CORE_UNAVAILABLE`: `failed` screen "We couldn't complete this right now. No money has left your account." |

#### 10. Expected mutation-check survivors

`SAME_CURRENCY` guard in `bank.fx.quote` survives (the journey never sends equal currencies to the quote; the plain path handles them). `QUOTE_USED` survives unless a scenario replays a quote id; add T-3b to kill it, otherwise list it. Everything else: none expected.

---

### ★ To a BankWorkx customer — `internal-transfer`

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `internal-transfer` |
| Purpose | Send money to another BankWorkx® customer, free, instantly, any time of day. |
| Release / workspace | 1 / Personal |
| Status | New (planned). |
| Channels | Web and mobile |
| Starting pattern | `fixtures/local-transfer.ts` (account, beneficiary, amount, review, OTP, result) with a customer-lookup step. |
| Who may use it | `payments.create` |

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Payments › hub › To a BankWorkx customer | `{beneficiaryId}` optional | `payments.create` |
| Payments › beneficiaries › row (BankWorkx type) › Send money | `{beneficiaryId}` | `payments.create` |
| Home › + Send money (pick "BankWorkx customer") | none | `payments.create` |

#### 3. Screens

**`payee` — "Who are you paying?"** (entry). `stepper` ["payee", "amount", "review", "otp"]. onEnter: `beneficiaries` (filtered to type BankWorkx), `accounts`.

| Field | Block | Required | Validation | Error message |
|---|---|---|---|---|
| Payee | `beneficiaryPicker` `ipay.beneficiaryId`, `allowAddNew: true`, `addNewJourney: "manage-beneficiary"` | Yes | A BankWorkx beneficiary | "Choose who to pay." |
| Find by account number | `textInput` shown under the tab "New payee", pattern `^[0-9]{10}$` | Only for a new payee | 10 digits | "Enter the 10-digit BankWorkx account number." |

Copy: title "Who are you paying?". Helper "Payments to BankWorkx customers are free and arrive straight away." The **New payee** tab calls `lookup` and shows "Taylor B. · ••3308 · USD" (name shortened for privacy) with **Use this payee**; **Save for next time** is a toggle on. Choosing "Add a new beneficiary" opens `manage-beneficiary` with `returnTo: "payee"`; on return the new payee is selected. Empty (no BankWorkx payees): "You haven't saved a BankWorkx customer yet." with **Add a beneficiary**. A beneficiary under 24 hours old shows the chip "New · {n} hours left".

**`amount` — "Amount"**.

| Field | Block | Required | Validation | Error message |
|---|---|---|---|---|
| From | `accountPicker` `ipay.fromAccountId` | Yes | `canDebit`, in the payee's account currency | "Choose an account to send from." / "{name} has a {currency} account. Send from a {currency} account." |
| Amount | `amountInput` (From currency), helper "Daily limit {daily} · used {used} · left {left}" from `bank.limits.get` | Yes | More than 0; at most the account's decimals; at most the available balance; at most the daily limit left; for a new payee at most the cooling-off allowance | "Enter an amount greater than 0." / "There isn't enough money in {account}. Available: {balance}." / "This is above your daily limit of {limit}. You have {remaining} left today." / the cooling-off message (rule A) |
| Reference | `textInput` | No | Up to 35 characters; letters, digits, spaces and `. , - /` | "Use 35 characters or fewer, with letters and numbers only." |

Navigation rule: when `ipay.amount > ctx.limits.daily − ctx.limits.usedToday` go to `limitExceeded` (as in the fixture: alert "{amount} is above your remaining daily limit." with **Change amount**). Button **Review payment**.

**`review` — "Review payment"**. Rows: From (name and mask), To (payee name, ••3308), Amount, Fee "$0.00", Arrives "Straight away", Reference. Alert (info, only when the payee is new): "{name} is a new payee. For your security you can send up to $500.00 in the first 24 hours." Consent: "I confirm the details are correct." Button **Confirm and send code**.

**`otp`** — shared C; button **Send {amount}**. **`success` — "Payment sent"**: text "{amount} to {payeeName}", meta "Ref {reference}"; buttons **Track payment**, **View receipt**, **Send again** (restarts with the same payee), **Done**. Other screens: `limitExceeded`, `locked`, `timeout`, `unavailable`, `failed` (C).

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `OTP_INVALID` / `OTP_REQUIRED` | S-`OTP_INVALID` / S-`OTP_REQUIRED` | `otp` / `failed` | Try again / Back to code |
| `ACCOUNT_NOT_FOUND` | S-`ACCOUNT_NOT_FOUND` | `failed` | Choose account |
| `ACCOUNT_CANNOT_DEBIT` (planned) | "You can't send money from {account} right now. Choose another account." | `amount` | Choose account |
| `CUSTOMER_NOT_FOUND` (planned) | "We can't find a BankWorkx account with that number. Check it and try again." | `payee` | Edit |
| `CUSTOMER_CANNOT_RECEIVE` (planned) | "{name} can't receive money right now. Try again later." | `failed` | Back |
| `CURRENCY_MISMATCH` (planned) | "{name} has a {currency} account. Send from a {currency} account, or use Abroad." | `amount` | Choose account |
| `BENEFICIARY_NOT_FOUND` (planned) | "We can't find that beneficiary. Choose another." | `payee` | Choose payee |
| `BENEFICIARY_COOLING_OFF` (planned) | Rule A message | `amount` | Change amount |
| `INSUFFICIENT_FUNDS` | S-`INSUFFICIENT_FUNDS` | `amount` / `failed` | Change amount |
| `LIMIT_EXCEEDED` | S-`LIMIT_EXCEEDED` | `limitExceeded` | Change amount |
| `INVALID_AMOUNT` (planned for this adapter) | "Enter an amount greater than 0, with at most {digits} decimal places." | `amount` | Change amount |
| `CORE_UNAVAILABLE` | S-`CORE_UNAVAILABLE` | `failed` | Try again |
| `NOT_SUPPORTED` | S-`NOT_SUPPORTED` | `failed` | Back |
| `TIMEOUT` / `SERVICE_UNAVAILABLE` (planned) | shared C | `timeout` / `unavailable` | Check Activity / Try again |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `accounts` | `bank.accounts.list` | none | accounts | none | Existing |
| `beneficiaries` | `bank.beneficiaries.list` | none | map with `ageHours` (planned adds `kind`, `coolingOffUntil`, `allowanceLeft`) | none | Existing, extended |
| `limits` | `bank.limits.get` | `{currency?}` | `{daily, usedToday, currency}` | `LIMIT_NOT_SET` | Existing |
| `lookup` | `bank.customers.lookup` | `{accountNumber}` | `{customerId, displayName (shortened), maskedNumber, currency}` | `CUSTOMER_NOT_FOUND`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned). Not money-moving; no OTP |
| `otpSend`, `otpVerify` | `bank.otp.send`, `bank.otp.verify` | as C | as C | `OTP_INVALID` | Existing |
| `sendInternal` | `bank.transfers.internal` | `{fromAccountId, beneficiaryId, amount, reference?}` | `{reference, newBalance, currency, status: "completed", completedAt}` | all in section 4 | (planned). Money-moving; OTP; counts toward the daily limit and the cooling-off allowance |

#### 6. Permissions, step-up and limits

`payments.create`; step-up `otp`. Daily limit 50,000 USD per currency (existing). Cooling-off rule A. Per payment minimum 0.01. 24/7. Business context: `WRONG_CONTEXT`.

#### 7. Result and links out

Receipt as in the tracker (kind BankWorkx). Notifications: sender gets "{amount} sent to {payee}" (in-app); the receiving customer, if in the sandbox, gets "{name} sent you {amount}". Buttons: **Track payment**, **View receipt**, **Send again**, **Done**.

#### 8. Acceptance criteria

- AC-1: A payment to a saved BankWorkx payee needs a verified code, debits the sender, credits the receiver and returns a reference.
- AC-2: A new payee can be found by account number and saved in the same journey.
- AC-3: Sending more than the daily limit left is refused with the exact limit message and no money moves.
- AC-4: A payee added under 24 hours ago cannot receive more than $500.00 in total; the message tells the person when the full amount is allowed.
- AC-5: A payee whose account is in another currency cannot be paid from a different-currency account.
- AC-6: Three wrong codes stop the journey with nothing sent.
- AC-7: Timeout and unavailable states leave both balances unchanged and say so.

#### 9. Scenarios

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1 | `alex` with seeded beneficiaries | none | Main to Taylor Brooks, $75.00, code `482100`. Main 8,645.76; reference `TRX-…`; receipt shows Taylor. |
| T-2 | AC-2 | `alex` | none | New payee tab, account `1000003308`: "Taylor B. · ••3308 · USD"; save toggle on; beneficiary list gains one entry with `ageHours` 0. |
| T-3 | AC-3 | `alex`, setup: `usedToday` 49,950 | none | $100.00: "This is above your daily limit of $50,000.00. You have $50.00 left today." |
| T-4 | AC-4 | `alex`, add Taylor-like payee 3 hours ago | none | $600.00: cooling-off message; $400.00 allowed; then a second $200.00 within 24 h is refused with $100.00 left. |
| T-5 | AC-5 | `alex` with a EUR-only payee | none | From Main (USD): `CURRENCY_MISMATCH`. |
| T-6 | AC-6 | `alex` | none | Wrong code three times: `locked`. |
| T-7 | AC-7 | `alex` | `timeout: ["bank.transfers.internal"]` | `timeout` screen; balances unchanged. |
| T-8 | AC-7 | `alex` | `unavailable: ["bank.transfers.internal"]` | `unavailable` screen; balances unchanged. |

#### 10. Expected mutation-check survivors

The daily-limit rule exists in the UI navigation rule and in the sandbox; removing only the UI rule is killed by T-3 (the sandbox then answers `LIMIT_EXCEEDED`); removing only the sandbox rule survives T-3 because the navigation rule stops it first. Expected survivor: "sandbox daily-limit check", reason: the journey's own limit rule catches it. Add a direct adapter scenario to kill it if wanted. Others: none expected.

---
### ★ To another bank — `personal-transfer`

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `personal-transfer` |
| Purpose | Send money in the home currency to a saved beneficiary at another bank, standard (free, next working day) or instant (small fee, in seconds). **This is the journey Alex runs in the Personal half of the combined demo (M1).** |
| Release / workspace | 1 / Personal |
| Status | Existing, upgraded. `fixtures/local-transfer.ts` (slug `fund-transfer-local`, id `jrn_fund_transfer_local`, version 5, published, web and mobile, English and Urdu). The slug moves to `personal-transfer`; the old slug remains an alias for Meezan. |
| Channels | Web and mobile |
| Starting pattern | `fixtures/local-transfer.ts` |
| Who may use it | `payments.create` |

**What exists today.** Entry screen `account` (a `stepper` ["account", "beneficiary", "amount", "review", "otp"] and an `accountPicker` with balances, **Continue**; onEnter loads accounts and limits). `beneficiary` (`beneficiaryPicker`, `allowAddNew: true`). `amount` (`amountInput` in PKR with helper "Daily limit PKR {daily} · used PKR {used}", `min 1`, `max` = the account's balance with message "Amount is more than your available balance"; a purpose `select`: Family support, Rent, Education, Business, Other; navigation rule: amount above the limit left goes to `limitExceeded`). `limitExceeded` (warning "PKR {amount} is above your remaining daily limit." with **Change amount**). `review` (rows From, To, Amount, Fee "PKR 0"; consent `transfers-v3` "I confirm the details are correct"; **Confirm and send OTP**). `otp` (6 digits, 3 attempts, resend 60 s, **Verify and send**; `otpVerify` toast "Incorrect code", `lockAfter: 3, lockTo: "failed"`). `success` ("Transfer sent", "PKR {amount} to {name}", `Ref`), `failed` ("Transfer not completed": "No money has left your account. Try again or contact support."). The adapter `bank.transfers.create` only debits the account: it ignores the beneficiary and the purpose, and checks neither a zero amount nor a new beneficiary.

**The upgrade.** USD copy (English); a speed choice; the cooling-off rule; a reference; failure reasons per code; proper `lockTo: "locked"`; receipts and tracking; the adapter takes the beneficiary and checks it.

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Home › + Send money | none | `payments.create` |
| Payments › hub › To another bank | `{beneficiaryId}` optional | `payments.create` |
| Payments › beneficiaries › row (Other bank) › Send money | `{beneficiaryId}` | `payments.create` |
| Accounts › detail › Transfer from this account | `{accountId}` | `payments.create` |
| Payments › tracker › payment › Repeat payment | `{paymentId}` | `payments.create` |

#### 3. Screens

**`account` — "From account"** (entry; skipped when `accountId` is passed). `accountPicker` `transfer.fromAccountId`, balances shown. Field: From account, required, only accounts that can debit, message "Choose an account to send from." The stepper shows five steps. Button **Continue**.

**`beneficiary` — "Beneficiary"** (skipped when `beneficiaryId` is passed). `beneficiaryPicker` `transfer.beneficiaryId` (source `ctx.beneficiaries`, other-bank type only), `allowAddNew: true`, `addNewJourney: "manage-beneficiary"` with `returnTo: "beneficiary"`. Required, message "Choose who to pay." Row shows name, bank, mask, and the chip "New · {n} hours left" when `ageHours` is under 24. Empty: "You haven't saved anyone yet." with **Add a beneficiary**. Button **Continue**.

**`amount` — "Amount"**.

| Field | Block | Required | Validation | Error message |
|---|---|---|---|---|
| Amount | `amountInput` USD (the account's currency), helper "Daily limit ${daily} · used ${used}" | Yes | At least 0.01 (fixture said 1; upgraded); at most 2 decimals; at most the available balance; at most the daily limit left | "Enter an amount greater than 0." / "Amount is more than your available balance" / "This is above your daily limit of {limit}. You have {remaining} left today." |
| Speed | `select` tiles: **Standard** ("Free · arrives {date}"), **Instant** ("$1.50 · arrives in seconds, any time") | Yes (default Standard) | Instant only up to $5,000.00 | "Instant payments are limited to $5,000.00. Choose Standard or send a smaller amount." |
| Purpose | `select`: Family support, Rent, Education, Business, Other (existing) | Yes | One of the list | "Choose a purpose." |
| Reference | `textInput` "Reference (optional)" | No | Up to 35 characters | "Use 35 characters or fewer." |

Alerts: when the beneficiary is new (rule A) a warning: "{name} is new. You can send up to ${left} to a new beneficiary in the first 24 hours." Amount over the allowance: the rule A message. Arrival date for Standard: next working day if sent before 16:00 UTC on a working day (weekends and 9 Nov 2026 are closed), else the working day after. Navigation: amount above the limit left goes to `limitExceeded` (existing); button **Review transfer**.

**`limitExceeded`** (branch; existing). Alert warning "${amount} is above your remaining daily limit." Button **Change amount** (to `amount`).

**`review` — "Review transfer"**. `reviewSummary` rows: From (name and mask), To (beneficiary name, bank, mask), Amount, Fee ("$0.00" or "$1.50"), **Total taken**, Speed, Arrives, Purpose, Reference. Consent (`transfers-v3`): "I confirm the details are correct". Button **Confirm and send code**.

**`otp`**, **`locked`**, **`timeout`**, **`unavailable`**, **`failed`** — shared C. Confirm button: **Send $120.00** (the amount in the label). The `failed` text for `OTP_REQUIRED`, `INSUFFICIENT_FUNDS`, `LIMIT_EXCEEDED`, `ACCOUNT_NOT_FOUND`, `CORE_UNAVAILABLE` comes from the table below.

**`success` — "Transfer sent"** (terminal; existing title). Text "${amount} to {beneficiary name}" (existing shape). Meta "Ref {reference} · {Arrives}". Buttons **Track payment**, **View receipt**, **Send again**, **Done**.

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `OTP_INVALID` | S-`OTP_INVALID` | `otp`; after 3 `locked` | Try again / Start again |
| `OTP_REQUIRED` | S-`OTP_REQUIRED` | `failed` | Back to code |
| `ACCOUNT_NOT_FOUND` | S-`ACCOUNT_NOT_FOUND` | `failed` | Choose account |
| `ACCOUNT_CANNOT_DEBIT` (planned) | "You can't send money from {account} right now. Choose another account." | `account` | Choose account |
| `BENEFICIARY_NOT_FOUND` (planned) | "We can't find that beneficiary. Choose another." | `beneficiary` | Choose beneficiary |
| `BENEFICIARY_COOLING_OFF` (planned) | Rule A message | `amount` | Change amount |
| `INSUFFICIENT_FUNDS` | S-`INSUFFICIENT_FUNDS` | `failed` | Change amount |
| `LIMIT_EXCEEDED` | S-`LIMIT_EXCEEDED` | `limitExceeded` | Change amount |
| `LIMIT_NOT_SET` (existing, other-currency accounts only) | "A daily limit isn't set for {currency}. Contact support." | `failed` | Back |
| `INVALID_AMOUNT` (planned for this adapter) | "Enter an amount greater than 0, with at most 2 decimal places." | `amount` | Change amount |
| `INSTANT_LIMIT` (planned) | "Instant payments are limited to $5,000.00. Choose Standard or send a smaller amount." | `amount` | Change amount |
| `CORE_UNAVAILABLE` | S-`CORE_UNAVAILABLE` | `failed` | Try again |
| `NOT_SUPPORTED` | S-`NOT_SUPPORTED` | `failed` | Back |
| `TIMEOUT` (planned) | "We didn't get an answer in time. Check Activity before you try again, so you don't pay twice." | `timeout` | Check Activity |
| `SERVICE_UNAVAILABLE` (planned) | S-`SERVICE_UNAVAILABLE` | `unavailable` | Try again |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `accounts` | `bank.accounts.list` | none | accounts | none | Existing |
| `beneficiaries` | `bank.beneficiaries.list` | none | map with `ageHours` | none | Existing |
| `limits` | `bank.limits.get` | `{currency?}` | `{daily, usedToday}` | `LIMIT_NOT_SET` | Existing |
| `otpSend`, `otpVerify` | `bank.otp.send`, `bank.otp.verify` | `{channel}`, `{code}` | `{sent, maskedPhone, channel}`, `{verified}` | `OTP_INVALID` | Existing |
| `transfer` | `bank.transfers.create` | Today: `{fromAccountId, beneficiaryId, amount, purpose}` (only the account and amount are used). Upgraded: adds `speed: "standard"\|"instant"`, `reference` | Today `{reference, newBalance, currency}`. Upgraded adds `fee`, `status` (`processing` or `completed`), `arrivesOn` | `OTP_REQUIRED`, `CORE_UNAVAILABLE`, `ACCOUNT_NOT_FOUND`, `INSUFFICIENT_FUNDS`, `LIMIT_EXCEEDED`, plus planned `ACCOUNT_CANNOT_DEBIT`, `BENEFICIARY_NOT_FOUND`, `BENEFICIARY_COOLING_OFF`, `INVALID_AMOUNT`, `INSTANT_LIMIT`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | Existing, upgraded. Money-moving; OTP |

Worked example (the M1 demo): Alex, Main ••4410 (8,720.76), Jamie Lee at Northwind Bank ••6620 (40 days old), **$120.00**, Standard, purpose Family support. Fee $0.00. New balance **8,600.76**; reference `TRX-20261102-0931`; arrives Tue 3 Nov 2026. With Instant: fee $1.50, total $121.50, new balance 8,599.26, status Completed.

#### 6. Permissions, step-up and limits

`payments.create`; step-up `otp`. Daily limit 50,000 USD (existing). Instant maximum $5,000.00 per payment. Cooling-off rule A for beneficiaries under 24 hours. Cut-off 16:00 UTC for same-day Standard. Business context: `WRONG_CONTEXT`.

#### 7. Result and links out

Receipt (planned): "Payment receipt", from, to (name, bank, mask), amount, fee, total, purpose, reference, speed, expected arrival, status. Notifications: in-app and SMS "{amount} sent to {name}. Ref {reference}."; when a Standard payment completes, "{name} received {amount}." Buttons: **Track payment**, **View receipt**, **Send again**, **Done** (returns to Home when started there, otherwise to the origin place). In the combined demo, **Done** returns Alex to Home, where the **Switch to Business** button is then used (`session` step-up).

#### 8. Acceptance criteria

- AC-1: A Standard transfer to a saved beneficiary needs a consent tick and a verified code, then debits the exact amount and returns a reference.
- AC-2: Instant adds the $1.50 fee, is refused above $5,000.00, and shows status Completed.
- AC-3: Money cannot leave before the code is verified (`OTP_REQUIRED`).
- AC-4: An amount above the available balance is stopped on the amount screen and at the adapter, and no money moves.
- AC-5: An amount above the daily limit left goes to the limit screen and is refused at the adapter.
- AC-6: A beneficiary added under 24 hours ago cannot receive more than $500.00 in total, with the exact message.
- AC-7: Three wrong codes end in the locked screen and nothing is sent.
- AC-8: A timeout says to check Activity first and moves no money.
- AC-9: An unavailable service shows the standard message and moves no money; `CORE_UNAVAILABLE` says no money has left the account.
- AC-10: "Add a new beneficiary" opens `manage-beneficiary` and returns to the same screen with the new beneficiary chosen.

#### 9. Scenarios

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1 | `alex`, seeded beneficiaries | none | Main, Jamie Lee, $120.00, Standard, Family support, tick, `482100`. Main 8,600.76; `TRX-20261102-0931`; arrives 3 Nov 2026. |
| T-2 | AC-2 | `alex` | none | Instant $120.00: total $121.50; Main 8,599.26. Instant $5,000.01: "Instant payments are limited to $5,000.00…". |
| T-3 | AC-3 | `alex` | none | Call `bank.transfers.create` without verifying: `OTP_REQUIRED`. |
| T-4 | AC-4 | `alex` | none | $9,000.00: field message "Amount is more than your available balance"; direct adapter call gives `INSUFFICIENT_FUNDS`. |
| T-5 | AC-5 | `alex`, setup `usedToday` 49,950 | none | $100.00: `limitExceeded` screen; adapter gives `LIMIT_EXCEEDED`. |
| T-6 | AC-6 | `alex` | none | Casey Nguyen (3 hours old): $600.00 refused with the rule A message; $400.00 sent; then $150.00 refused ($100.00 left). |
| T-7 | AC-7 | `alex` | none | `111111` three times: `locked`; balance unchanged. |
| T-8 | AC-8 | `alex` | `timeout: ["bank.transfers.create"]`, `latencyMs: 10000` | `timeout` screen; balance unchanged. |
| T-9 | AC-9 | `alex` | `unavailable: ["bank.transfers.create"]` | `unavailable` screen. |
| T-10 | AC-9 | `alex` with `transferFails` | none | `CORE_UNAVAILABLE`: "We couldn't complete this right now. No money has left your account." |
| T-11 | AC-10 | `alex` | none | From `beneficiary` open Add a new beneficiary, complete it, return: the new one is chosen and the cooling-off chip shows. |

#### 10. Expected mutation-check survivors

Same two layers (UI rule and adapter rule) for the daily limit and the balance: the sandbox-only mutant survives T-4 and T-5 unless a direct adapter scenario exists (T-4 and T-5 include one, so they are killed). `INSTANT_LIMIT`: killed by T-2. Expected survivor: removing the 16:00 UTC cut-off date maths only changes the displayed arrival date; covered by T-1 only for a Monday, so a Friday-evening case survives unless added; list as expected.

---

### ★ Abroad — `international-transfer`

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `international-transfer` |
| Purpose | Send money to a beneficiary abroad with a quoted exchange rate, all fees shown, a purpose of payment and bank details checked (IBAN, SWIFT). |
| Release / workspace | 1 / Personal |
| Status | New (planned). |
| Channels | Web and mobile |
| Starting pattern | `fixtures/convert-currency.ts` for the rate, fee and 30-second quote; `fixtures/local-transfer.ts` for the beneficiary, review, consent, OTP. |
| Who may use it | `payments.create` |

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Payments › hub › Abroad | `{beneficiaryId}` optional | `payments.create` |
| Payments › beneficiaries › row (Abroad) › Send money | `{beneficiaryId}` | `payments.create` |
| Payments › tracker › payment › Repeat payment | `{paymentId}` | `payments.create` |

#### 3. Screens

**`payee` — "Who are you paying abroad?"** (entry). `stepper` ["payee", "amount", "details", "review", "otp"]. `beneficiaryPicker` `intl.beneficiaryId` (type Abroad), `allowAddNew`, `addNewJourney: "manage-beneficiary"`, `returnTo: "payee"`. Each row shows name, country flag and name, currency, IBAN last 4. Required, message "Choose who to pay." Empty: "You haven't saved anyone abroad yet." with **Add a beneficiary**. Button **Continue**.

**`amount` — "Amount"**.

| Field | Block | Required | Validation | Error message |
|---|---|---|---|---|
| From | `accountPicker` `intl.fromAccountId`, balances | Yes | `canDebit`; its currency must have a daily limit | "Choose an account to send from." |
| You send | `amountInput` in the From currency; helper shows the indicative rate from `bank.fx.rate` ("About 1 USD = 0.9154 EUR. You'll see the exact rate next.") and the live "They get about €915.40" | Yes | Minimum 10 USD equivalent; maximum 25,000 USD equivalent per payment; at most the From balance less fees; at most the daily limit left; within the currency's decimals; for a new beneficiary at most the rule A allowance | "The smallest amount you can send abroad is $10.00." / "The most you can send abroad in one payment is $25,000.00." / "Enter an amount in {currency} with at most {digits} decimal places" / "There isn't enough money in {account} for this amount and the fees. Available: {balance}." / rule A message |

Copy: helper "Fees and the final rate are shown on the next screen." Button **See the rate** (validate, call `quote`, save `ctx.quote`, go to `details`).

**`details` — "Payment details"**.

| Field | Block | Required | Validation | Error message |
|---|---|---|---|---|
| Purpose of payment | `select`: Family support, Education fees, Medical, Gift, Rent or property, Travel, Business invoice, Savings or investment, Other | Yes | One of the list | "Choose a purpose." |
| Describe the payment | `textInput` (2 lines) | Required if Other, or if the amount is over $10,000 equivalent | 5 to 140 characters; letters, digits, spaces and `. , - /` | "Tell us what this payment is for (5 to 140 characters)." |
| Who pays the bank charges | `select` rows: **Shared** ("You pay our $15.00. The other bank may take a fee."), **Beneficiary pays** ("$0.00 from you. {name} gets less."), **I pay all** ("You pay $35.00. {name} gets the full amount.") | Yes (default Shared) | One of three | "Choose who pays the charges." |
| Reference for {name} | `textInput` | No | Up to 35 characters | "Use 35 characters or fewer." |

Alert (info): "Payments abroad take 1 to 3 working days. We'll show the exact date next." Button **Review payment**. The charge changes the total, so the quote is repriced on this button with the chosen charge option.

**`review` — "Review payment"**. `reviewSummary` rows:

| Row | Value (worked example) |
|---|---|
| From | Main ••4410 |
| To | Marco Rossi, Germany |
| Bank details | IBAN `DE89 3704 0044 0532 0130 00` · SWIFT `NRWDDEFFXXX` (shown in full and checked server-side) |
| You send | $1,000.00 |
| Exchange rate | 1 USD = 0.9154 EUR (mid-market 0.92, our margin 0.5%) |
| Conversion fee | $2.00 (0.2%) |
| Bank charge | $15.00 (Shared) |
| **Total taken from you** | **$1,017.00** |
| {name} gets | €915.40 (the other bank may take a fee) |
| Purpose | Family support |
| Arrives | Between 3 and 5 Nov 2026 |

Rate alert: "This rate is valid for 30 seconds" with a live countdown (the quote `ttlSeconds`); at 0 it becomes "The rate has expired." and the button reads **Get a new rate**. Consent (`termsVersion` "intl-v1"): "I confirm the details and the rate are correct, the purpose is true, and this payment is not for anyone I know is under sanctions." Button **Confirm and send code**.

**`otp`** shared C, button **Send $1,000.00**. **`rateExpired`** as in `own-transfer` (**Get a new rate** reprices, clears consent and code, back to `review`). **`locked`**, **`timeout`**, **`unavailable`**, **`failed`** shared C.

**`success` — "Payment on its way"** (terminal). Text "$1,000.00 is on its way to Marco Rossi. They'll get €915.40." Meta "Ref {reference} · Arrives between 3 and 5 Nov 2026". Buttons **Track payment**, **View receipt**, **Done**.

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `OTP_INVALID` / `OTP_REQUIRED` | S-`OTP_INVALID` / S-`OTP_REQUIRED` | `otp` / `failed` | Try again / Back to code |
| `ACCOUNT_NOT_FOUND` | S-`ACCOUNT_NOT_FOUND` | `failed` | Choose account |
| `BENEFICIARY_NOT_FOUND` (planned) | "We can't find that beneficiary. Choose another." | `payee` | Choose beneficiary |
| `BENEFICIARY_COOLING_OFF` (planned) | Rule A message | `amount` | Change amount |
| `COUNTRY_NOT_SUPPORTED` (planned) | "We can't send money to {country} yet." | `payee` | Choose beneficiary |
| `CURRENCY_NOT_SUPPORTED` (existing) | "We can't send {currency} yet." (sandbox: "We do not convert that currency pair") | `payee` | Choose beneficiary |
| `IBAN_INVALID` (planned) | "The IBAN on this beneficiary isn't valid. Edit the beneficiary and try again." | `failed` | Edit beneficiary (`manage-beneficiary`) |
| `SWIFT_INVALID` (planned) | "The SWIFT code on this beneficiary isn't valid. Edit the beneficiary and try again." | `failed` | Edit beneficiary |
| `INVALID_AMOUNT` (existing in FX) | "Enter an amount in {currency} with at most {digits} decimal places" | `amount` | Change amount |
| `AMOUNT_TOO_SMALL` / `AMOUNT_TOO_LARGE` (planned) | "The smallest amount you can send abroad is $10.00." / "The most you can send abroad in one payment is $25,000.00." | `amount` | Change amount |
| `PURPOSE_REQUIRED` (planned) | "Choose a purpose." / "Tell us what this payment is for (5 to 140 characters)." | `details` | Edit |
| `INSUFFICIENT_FUNDS` | S-`INSUFFICIENT_FUNDS` (balance must cover amount, fee and charge) | `amount` / `failed` | Change amount |
| `LIMIT_EXCEEDED` | S-`LIMIT_EXCEEDED` | `failed` | Change amount |
| `QUOTE_EXPIRED` / `QUOTE_USED` / `QUOTE_NOT_FOUND` | as in `own-transfer` | `rateExpired` | Get a new rate |
| `CORE_UNAVAILABLE` | S-`CORE_UNAVAILABLE` | `failed` | Try again |
| `NOT_SUPPORTED` | S-`NOT_SUPPORTED` | `failed` | Back |
| `TIMEOUT` / `SERVICE_UNAVAILABLE` (planned) | shared C | `timeout` / `unavailable` | Check Activity / Try again |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `accounts`, `beneficiaries`, `limits` | `bank.accounts.list`, `bank.beneficiaries.list`, `bank.limits.get` | as other transfers | as other transfers | `LIMIT_NOT_SET` | Existing |
| `rate` | `bank.fx.rate` | `{from, to}` | `{from, to, midRate, rate, spreadPercent}` | `CURRENCY_NOT_SUPPORTED` | Existing |
| `quote` | `bank.international.quote` | `{fromAccountId, beneficiaryId, amount, charges: "sha"\|"ben"\|"our"}` | `{quoteId, from{currency, amount}, to{currency, amount}, midRate, rate, fxFee, bankCharge, total, feeCurrency, arrivesBetween[], expiresAt, ttlSeconds: 30}` | `ACCOUNT_NOT_FOUND`, `BENEFICIARY_NOT_FOUND`, `COUNTRY_NOT_SUPPORTED`, `CURRENCY_NOT_SUPPORTED`, `IBAN_INVALID`, `SWIFT_INVALID`, `INVALID_AMOUNT`, `AMOUNT_TOO_SMALL`, `AMOUNT_TOO_LARGE`, `INSUFFICIENT_FUNDS`, `BENEFICIARY_COOLING_OFF`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned). Not money-moving; no OTP. Prices with the existing `priceQuote` (mid rate less 0.5%, fee 0.2%) plus the flat charge |
| `otpSend`, `otpVerify` | `bank.otp.*` | as C | as C | `OTP_INVALID` | Existing |
| `sendAbroad` | `bank.international.send` | `{quoteId, purpose, purposeText?, reference?}` | `{reference (SWF-…), status: "processing", newBalance, from, to, arrivesBetween[]}` | `OTP_REQUIRED`, `CORE_UNAVAILABLE`, `QUOTE_NOT_FOUND`, `QUOTE_USED`, `QUOTE_EXPIRED`, `INSUFFICIENT_FUNDS`, `LIMIT_EXCEEDED`, `PURPOSE_REQUIRED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned). Money-moving; OTP |

**IBAN and SWIFT rules (checked in `manage-beneficiary`, again by the quote and the send).** SWIFT/BIC: 8 or 11 characters matching `^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$`. IBAN: country code plus 2 check digits plus the bank's number, correct length for the country (Germany 22, United Kingdom 22, France 27, Spain 24, Italy 27, Netherlands 18, United Arab Emirates 23, Saudi Arabia 24, Jordan 30, Pakistan 24, Kuwait 30), and a valid mod-97 check. India and Japan have no IBAN: they need an account number (9 to 18 digits) and a SWIFT. Sandbox countries (planned): the currencies in `fx.ts`: USD, EUR (Germany, France, Spain, Italy, Netherlands), GBP, AED, SAR, JOD, KWD, PKR, INR, JPY.

**Pricing worked example.** USD 1,000.00 to EUR, Shared: rate 0.9154, conversion fee 2.00, bank charge 15.00, total 1,017.00, receives 915.40. "I pay all": charge 35.00, total 1,037.00, receives 915.40 in full. "Beneficiary pays": charge 0.00, total 1,002.00, the beneficiary gets 915.40 less the other bank's own fee. Main becomes 7,703.76 (Shared). Reference `SWF-20261102-0931`.

#### 6. Permissions, step-up and limits

`payments.create`; step-up `otp`. Per payment 10 to 25,000 USD equivalent. Daily limit 50,000 USD, shared with domestic transfers (non-USD accounts use their own `limitsByCurrency`). Cooling-off rule A applies. Cut-off 16:00 UTC; weekends and 9 Nov 2026 closed. Business context: `WRONG_CONTEXT`.

#### 7. Result and links out

Receipt: sender, beneficiary, bank details, amount, rate, each fee, total, purpose, charges option, reference, estimated arrival, the line "The receiving bank may deduct its own fees" for Shared and Beneficiary pays. Notifications: in-app and SMS on send; later "Your payment to {name} arrived" (tracker status Completed). Buttons: **Track payment**, **View receipt**, **Done**.

#### 8. Acceptance criteria

- AC-1: The review shows the rate, the conversion fee, the bank charge, the total taken and what the beneficiary gets before any code is asked.
- AC-2: The quote expires after 30 seconds and an expired quote cannot be sent.
- AC-3: The purpose of payment is required; "Other" and amounts over $10,000 equivalent also need a description.
- AC-4: The charge option changes the total exactly as in the pricing example.
- AC-5: Amounts under $10.00 or over $25,000.00 equivalent are refused with the exact messages.
- AC-6: A beneficiary with an invalid IBAN or SWIFT cannot be paid and the person is sent to edit it.
- AC-7: Money moves only after a verified code, and the total taken never exceeds the available balance.
- AC-8: A beneficiary added under 24 hours ago is limited to $500.00 equivalent.
- AC-9: Three wrong codes stop the journey; nothing is sent.
- AC-10: Timeout and unavailable states move no money and say so.

#### 9. Scenarios

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-4, AC-7 | `alex` | none | Marco Rossi, Main, $1,000.00, Shared, Family support, `482100`. Rows as in the example; Main 7,703.76; `SWF-20261102-0931`. |
| T-2 | AC-4 | `alex` | none | "I pay all": total $1,037.00; "Beneficiary pays": $1,002.00. |
| T-3 | AC-2 | `alex`, controllable `now` | none | Quote, advance 31 s, confirm: `QUOTE_EXPIRED`; `rateExpired`; no debit. |
| T-4 | AC-3 | `alex` | none | No purpose: "Choose a purpose."; Other with empty text: "Tell us what this payment is for (5 to 140 characters)."; $12,000 needs the text. |
| T-5 | AC-5 | `alex` | none | $9.99 and $25,000.01 give the two messages. |
| T-6 | AC-6 | `alex`, a beneficiary with IBAN `DE00 0000 0000 0000 0000 00` seeded for the test | none | `IBAN_INVALID` at the quote; the button leads to `manage-beneficiary` mode edit. |
| T-7 | AC-8 | `alex` with a new abroad beneficiary 2 hours old | none | $600 equivalent refused with the rule A message. |
| T-8 | AC-9 | `alex` | none | Wrong code three times: `locked`. |
| T-9 | AC-10 | `alex` | `timeout: ["bank.international.send"]` | `timeout` screen; balance unchanged. |
| T-10 | AC-10 | `alex` | `unavailable: ["bank.international.quote"]` | `unavailable` on **See the rate**. |
| T-11 | AC-7 | `alex` | none | $8,720.76: `INSUFFICIENT_FUNDS` (fees do not fit). |

#### 10. Expected mutation-check survivors

The minimum/maximum checks exist both in the form and in `bank.international.quote`; sandbox-only mutants are killed by direct adapter calls in T-5. `COUNTRY_NOT_SUPPORTED` survives (the picker only lists supported countries, and the sandbox cannot be given an unsupported one without a new seed). The "I pay all" arithmetic is killed by T-2. Others: none expected.

---

### ★ Pay a bill — `pay-bill`

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `pay-bill` |
| Purpose | Look up a bill by the biller and the customer's reference number, see the amount due, and pay it from an account. |
| Release / workspace | 1 / Personal |
| Status | Existing, upgraded. `fixtures/pay-bill.ts` (slug `pay-a-bill`, id `jrn_pay_bill`, version 1, published, web and mobile, English and Urdu). The slug moves to `pay-bill`; `pay-a-bill` stays as an alias for Meezan. |
| Channels | Web and mobile |
| Starting pattern | `fixtures/pay-bill.ts` |
| Who may use it | `payments.create` |

**What exists today.** Entry `bill` (onEnter loads accounts and billers; `stepper` ["bill", "review", "otp"]; a `select` Biller from `ctx.billers`; a `textInput` Consumer number with placeholder "10 to 14 digits", pattern `^[0-9]{10,14}$` and message "Enter 10 to 14 digits"; an `accountPicker`; **Find my bill**, which calls `billLookup` and on failure shows the toast "We couldn't find that bill. Check the number and try again."). `review` (rows Biller, Consumer number, Due date, Amount due "PKR …", From, Fee "PKR 0"; consent `bills-v2` "I confirm I want to pay this bill"; **Confirm and send OTP**). `otp` (**Pay now**; wrong code toast "That code didn't match. Check the SMS and try again."; `lockAfter: 3, lockTo: "locked"`). `success` ("Bill paid"), `locked` ("Too many wrong codes"), `failed` ("Payment not completed"; "No money has left your account. Try again or contact support."). Existing billers (Meezan, Pakistan): K-Electric, LESCO (Electricity), SSGC (Gas), PTCL (Internet). The sandbox lookup invents the amount as `1000 + (last four digits mod 9000)` and the due date `2026-11-12`.

**The upgrade.** BankWorkx billers in USD (planned seed, below), grouped by category; the amount shown in the account's currency; currency matching; clear messages; the stepper; receipts. The full amount due is paid (no partial payment in Release 1).

Planned BankWorkx billers for Alex: `metro_power` Metro Power (Electricity), `city_gas` CityGas (Gas), `fibernet` FiberNet (Internet), `blue_water` BlueWater (Water), all USD. The planned lookup scales the existing formula: amount = `(1000 + last4 mod 9000) / 20`, so reference `123456781234` (last four 1234) gives **$111.70**, due **12 Nov 2026**.

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Home › + Pay a bill | none | `payments.create` |
| Payments › hub › Bills | `{billerId}` optional | `payments.create` |
| Payments › tracker › payment (bill) › Repeat payment | `{paymentId}` (prefills biller and reference) | `payments.create` |

#### 3. Screens

**`bill` — "Pay a bill"** (entry; existing, upgraded).

| Field | Block | Required | Validation | Error message |
|---|---|---|---|---|
| Biller | `select` from `ctx.billers`, grouped by category | Yes | One of the list | "Choose a biller." |
| Consumer number | `textInput` keyboard number, placeholder "10 to 14 digits" | Yes | `^[0-9]{10,14}$` (spaces are removed) | "Enter 10 to 14 digits" |
| Pay from | `accountPicker` `bill.fromAccountId`, balances | Yes | Account that can debit, in the biller's currency | "Choose an account to pay from." / "{biller} bills are in {currency}. Choose a {currency} account." |

Button **Find my bill** (validate, `billLookup`, save `ctx.bill`, go to `review`). On failure: stays on the screen with the toast "We couldn't find that bill. Check the number and try again." (existing) and the field error "No bill found for this reference". Loading: spinner and "Looking up your bill…".

**`review` — "Review bill"** (existing, upgraded). Rows: Biller, Consumer number, Account holder ("Alex Morgan", from `payerName`), Due date (`12 Nov 2026`), **Amount due** ("$111.70"), From, Fee "$0.00". Alert (info): "You're paying the full amount due." Consent `bills-v2`: "I confirm I want to pay this bill". Button **Confirm and send code**.

**`otp`** — shared C; button **Pay now** (existing label) or **Pay $111.70**. **`success` — "Bill paid"**: text "$111.70 to Metro Power", meta "Ref {reference}"; buttons **Track payment**, **View receipt**, **Pay another bill**, **Done**. **`locked`**, **`timeout`**, **`unavailable`**, **`failed`** — shared C.

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `BILLER_NOT_FOUND` (existing; sandbox "Unknown biller") | "Choose a biller from the list." | `bill` | Choose biller |
| `BILL_NOT_FOUND` (existing; sandbox "No bill found for this reference") | "We couldn't find that bill. Check the number and try again." | `bill` | Edit number |
| `BILL_ALREADY_PAID` (planned) | "This bill has already been paid." | `bill` | Back |
| `BILL_CURRENCY_MISMATCH` (planned) | "{biller} bills are in {currency}. Choose a {currency} account." | `bill` | Choose account |
| `OTP_INVALID` | S-`OTP_INVALID` (fixture wording kept on the toast: "That code didn't match. Check the SMS and try again.") | `otp`; after 3 `locked` | Try again / Start again |
| `OTP_REQUIRED` | S-`OTP_REQUIRED` | `failed` | Back to code |
| `ACCOUNT_NOT_FOUND` | S-`ACCOUNT_NOT_FOUND` | `failed` | Choose account |
| `INSUFFICIENT_FUNDS` | S-`INSUFFICIENT_FUNDS` | `failed` | Change account |
| `LIMIT_EXCEEDED` | S-`LIMIT_EXCEEDED` | `failed` | Close |
| `CORE_UNAVAILABLE` | S-`CORE_UNAVAILABLE` | `failed` | Try again |
| `NOT_SUPPORTED` | S-`NOT_SUPPORTED` | `failed` | Back |
| `TIMEOUT` (planned) | "We didn't get an answer in time. Check Activity before you try again, so you don't pay twice." (the lookup says "This is taking longer than expected. Nothing was changed.") | `timeout` | Check Activity / Try again |
| `SERVICE_UNAVAILABLE` (planned) | S-`SERVICE_UNAVAILABLE` | `unavailable` | Try again |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `accounts` | `bank.accounts.list` | none | accounts | none | Existing |
| `billers` | `bank.billers.list` | none | map of `{id, name, category}` (planned adds `currency`) | none | Existing |
| `billLookup` | `bank.bills.lookup` | `{billerId, reference}` | `{billerName, reference, payerName, amount, dueDate}` | `BILLER_NOT_FOUND`, `BILL_NOT_FOUND` (planned: `BILL_ALREADY_PAID`, `TIMEOUT`, `SERVICE_UNAVAILABLE`) | Existing. Not money-moving; no OTP |
| `otpSend`, `otpVerify` | `bank.otp.*` | as C | as C | `OTP_INVALID` | Existing |
| `billPay` | `bank.bills.pay` | `{billerId, reference, amount, fromAccountId}` | `{reference (BILL-…), newBalance}` | `OTP_REQUIRED`, `CORE_UNAVAILABLE`, `ACCOUNT_NOT_FOUND`, `INSUFFICIENT_FUNDS`, `LIMIT_EXCEEDED` (planned: `BILL_CURRENCY_MISMATCH`, `INVALID_AMOUNT`, `TIMEOUT`, `SERVICE_UNAVAILABLE`) | Existing. Money-moving; OTP |

#### 6. Permissions, step-up and limits

`payments.create`; step-up `otp`. Daily limit 50,000 USD (existing). No cooling-off (no beneficiary). Business context: `WRONG_CONTEXT`.

#### 7. Result and links out

Receipt: biller, consumer number, amount, due date, paid on, from, reference. Notifications: in-app and SMS "Bill paid: {biller} {amount}. Ref {reference}." Buttons: **Track payment**, **View receipt**, **Pay another bill** (restarts), **Done**.

#### 8. Acceptance criteria

- AC-1: A valid biller and 10 to 14 digit number find a bill showing biller, amount and due date.
- AC-2: A number that is not 10 to 14 digits is refused on the form with "Enter 10 to 14 digits"; a number the biller does not know shows the not-found message.
- AC-3: The bill is paid only after consent and a verified code; the account is debited by exactly the amount due.
- AC-4: The amount shown on the review is the amount the adapter was asked to pay.
- AC-5: An account of another currency than the biller's cannot be used.
- AC-6: Not enough money or a daily limit hit moves no money and says so.
- AC-7: Three wrong codes stop the journey with nothing paid.
- AC-8: Timeout and unavailable states pay nothing and say so.

#### 9. Scenarios

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-3, AC-4 | `alex` | none | Metro Power, `123456781234`, Main. Review: $111.70, due 12 Nov 2026. Code `482100`. Main 8,609.06; `BILL-…`. |
| T-2 | AC-2 | `alex` | none | `12345`: form error; `0000000000` with an unknown biller id: `BILLER_NOT_FOUND`; a 9-digit number never calls the adapter. |
| T-3 | AC-5 | `alex` | none | Pay a USD biller from EUR Travel: `BILL_CURRENCY_MISMATCH`. |
| T-4 | AC-6 | `alex`, setup: balance 50.00 | none | Amount $111.70: `INSUFFICIENT_FUNDS` on `failed`; balance unchanged. With `usedToday` 49,950: `LIMIT_EXCEEDED`. |
| T-5 | AC-7 | `alex` | none | Three wrong codes: `locked` with the existing text. |
| T-6 | AC-8 | `alex` | `timeout: ["bank.bills.pay"]` | `timeout` screen; balance unchanged. |
| T-7 | AC-8 | `alex` | `unavailable: ["bank.bills.lookup"]` | `unavailable` screen after **Find my bill**. |

#### 10. Expected mutation-check survivors

`BILL_ALREADY_PAID` survives (the sandbox needs a paid-bill seed to produce it); add one reference ending in `9999` as already paid to kill it. `BILL_CURRENCY_MISMATCH` also has the form check, so a sandbox-only mutant survives T-3 (expected, UI layer catches it). Others: none expected.

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

### ★ Add, edit or delete a beneficiary — `manage-beneficiary`

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `manage-beneficiary` |
| Purpose | Save a person or company to pay, change their details, or remove them. Also the "Add a new beneficiary" step inside every transfer, returning to where the person was. |
| Release / workspace | 1 / Personal |
| Status | New (planned). The `beneficiaryPicker` block's `addNewJourney` and the `navigate` action's `toJourney` and `returnTo` exist in the schema (`packages/journey-schema/src/schema.ts`); wiring them in the engine is step 4. |
| Channels | Web and mobile |
| Starting pattern | None; `fixtures/cab.ts` shows the pattern for input validation messages. |
| Who may use it | `beneficiaries.manage` |

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Payments › beneficiaries › Add | `{mode: "add"}` | `beneficiaries.manage` |
| Payments › beneficiaries › row › Edit / Delete | `{mode: "edit"\|"delete", beneficiaryId}` | `beneficiaries.manage` |
| Journeys `internal-transfer`, `personal-transfer`, `international-transfer`: "Add a new beneficiary" | `{mode: "add", kind, returnTo: <screen id>}` | `beneficiaries.manage` |
| Payments › hub › empty state › Add a beneficiary | `{mode: "add"}` | `beneficiaries.manage` |

**How `returnTo` works.** The calling journey sends `navigate {toJourney: "manage-beneficiary", returnTo: "<its screen id>"}`. This journey runs, and its **Done** and **Cancel** buttons go back to that screen. On success it writes the new id to `ctx.lastBeneficiaryId`, and the calling screen's picker selects it. Nothing else of the caller's data is lost.

#### 3. Screens

**`type` — "Who do you want to pay?"** (entry in add mode; skipped when `kind` is passed). `stepper` ["type", "details", "review", "otp"]. `select` tiles `ben.kind`: **BankWorkx customer** ("Free and instant"), **Another bank** ("In {country}"), **Abroad** ("Send in another currency"). Required, message "Choose a type." Button **Continue**.

**`details` — "Their details"** (entry in edit mode, with the fields filled). Fields by type:

| Field | Type | Block | Required | Validation | Error message |
|---|---|---|---|---|---|
| Full name | all | `textInput` | Yes | 2 to 60 characters; letters, spaces and `. - '` | "Enter their full name (2 to 60 letters)." |
| Nickname | all | `textInput` | No | Up to 24 characters | "Use 24 characters or fewer." |
| BankWorkx account number | BankWorkx | `textInput` | Yes | `^[0-9]{10}$`; found by `bank.customers.lookup` (planned); shows "Taylor B. · ••3308" for the person to confirm | "Enter the 10-digit BankWorkx account number." / "We can't find a BankWorkx account with that number. Check it and try again." |
| Bank | Another bank | `select` from `bank.banks.list` (Northwind Bank, Harbor Trust, Apex Credit Union, Summit Federal) | Yes | One of the list | "Choose their bank." |
| Account number | Another bank | `textInput` | Yes | `^[0-9]{8,12}$` | "Enter 8 to 12 digits." |
| Confirm account number | Another bank | `textInput` | Yes | Equal to Account number | "The account numbers don't match." |
| Country | Abroad | `select` (supported countries) | Yes | One of the list | "Choose their country." |
| Currency | Abroad | `select` (from the country; one choice for most) | Yes | Supported by `fx.ts` | "Choose a currency." |
| IBAN | Abroad, IBAN countries | `textInput` (spaces ignored, shown in groups of four) | Yes | Right length for the country; mod-97 check | "That IBAN isn't valid. Check it against their bank statement." |
| Account number | Abroad, India and Japan | `textInput` | Yes | `^[0-9]{9,18}$` | "Enter 9 to 18 digits." |
| SWIFT code | Abroad | `textInput` (upper-cased) | Yes | `^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$` (8 or 11 characters) | "A SWIFT code has 8 or 11 letters and numbers." |
| Bank name | Abroad | `textInput` | Yes | 2 to 60 characters | "Enter their bank's name." |

Button **Check details** (validate, then `validate` adapter: duplicates, IBAN and SWIFT server checks) then `review`. In edit mode, **Save changes**. Alert (info) in edit mode when bank details change: "If you change the bank details, {name} counts as a new beneficiary for 24 hours. You can send up to $500.00 in that time."

**`review` — "Check before you save"**. Rows: Type, Name, Nickname, Bank, Account or IBAN, SWIFT, Country and currency. Consent (`termsVersion` "beneficiary-v1"): "I confirm these details are correct and I know the person". Alert (warning, always): "For your security, you can send up to $500.00 to a new beneficiary in the first 24 hours." Button **Save and send code** (nickname-only edits skip OTP and show **Save changes**).

**`otp`** — shared C; button **Save beneficiary**. Required for add, and for edit when bank details change. Not required for a name or nickname edit, or for delete.

**`confirmDelete` — "Delete {name}?"** (entry in delete mode). `dialog` block: text "You won't be able to send money to {name} from your saved list. Payments already sent are not affected." Buttons **Delete** (destructive; calls `remove`) and **Keep** (exit). If the beneficiary is used by an active schedule the delete is blocked (`BENEFICIARY_IN_USE`).

**`success` — "Saved" / "Changes saved" / "Beneficiary deleted"** (terminal). Add: text "{name} is saved. For your security you can send up to $500.00 in the first 24 hours." Meta "Ref {reference}". Buttons **Send money** (opens the right transfer journey with `{beneficiaryId}`), **Done** (back to `returnTo` or Payments › beneficiaries). Delete: "{name} was removed from your beneficiaries."

**`locked`**, **`timeout`**, **`unavailable`**, **`failed`** — shared C (the `timeout` and `unavailable` texts for this non-payment journey say "Nothing was changed.").

Loading, empty and error states: the form shows a spinner on the button while checking; no list screens here.

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `NAME_INVALID` (planned) | "Enter their full name (2 to 60 letters)." | `details` | Edit |
| `CUSTOMER_NOT_FOUND` (planned) | "We can't find a BankWorkx account with that number. Check it and try again." | `details` | Edit number |
| `IBAN_INVALID` (planned) | "That IBAN isn't valid. Check it against their bank statement." | `details` | Edit |
| `SWIFT_INVALID` (planned) | "A SWIFT code has 8 or 11 letters and numbers." | `details` | Edit |
| `ACCOUNT_NUMBER_INVALID` (planned) | "Enter 8 to 12 digits." (others by type) | `details` | Edit |
| `COUNTRY_NOT_SUPPORTED` (planned) | "We can't send money to {country} yet." | `details` | Choose country |
| `BENEFICIARY_EXISTS` (planned) | "You already saved {name} with these details." | `details` | Edit |
| `BENEFICIARY_LIMIT` (planned) | "You can save up to 50 beneficiaries. Delete one to add another." | `type` | Back |
| `BENEFICIARY_NOT_FOUND` (planned) | "We can't find that beneficiary." | `failed` | Back |
| `BENEFICIARY_IN_USE` (planned) | "{name} is used by {n} scheduled payment(s). Cancel them first." | `failed` | View scheduled (Payments › scheduled) |
| `OTP_INVALID` / `OTP_REQUIRED` | S-`OTP_INVALID` / S-`OTP_REQUIRED` | `otp` / `failed` | Try again / Back to code |
| `CORE_UNAVAILABLE` | "We couldn't complete this right now. Nothing was changed." | `failed` | Try again |
| `NOT_SUPPORTED` | S-`NOT_SUPPORTED` | `failed` | Back |
| `TIMEOUT` / `SERVICE_UNAVAILABLE` (planned) | "This is taking longer than expected. Nothing was changed." / standard unavailable | `timeout` / `unavailable` | Try again |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `beneficiaries` | `bank.beneficiaries.list` | none | map with `ageHours` (planned adds `kind`, `country`, `currency`, `iban`, `swift`, `nickname`, `coolingOffUntil`, `allowanceLeft`, `usedBy`) | none | Existing, extended |
| `banks` | `bank.banks.list` | none | map `{id, name, color}` | none | Existing |
| `lookup` | `bank.customers.lookup` | `{accountNumber}` | `{customerId, displayName, maskedNumber, currency}` | `CUSTOMER_NOT_FOUND` | (planned) |
| `validate` | `bank.beneficiaries.validate` | `{kind, fields…, beneficiaryId?}` | `{ok: true, bankName?, normalised{iban, swift}}` | `NAME_INVALID`, `IBAN_INVALID`, `SWIFT_INVALID`, `ACCOUNT_NUMBER_INVALID`, `COUNTRY_NOT_SUPPORTED`, `BENEFICIARY_EXISTS`, `BENEFICIARY_LIMIT` | (planned). Not money-moving; no OTP |
| `otpSend`, `otpVerify` | `bank.otp.*` | as C | as C | `OTP_INVALID` | Existing |
| `create` | `bank.beneficiaries.create` | `{kind, fields…}` | `{beneficiaryId, addedAt, coolingOffUntil, reference}` | all validate codes, `OTP_REQUIRED`, `CORE_UNAVAILABLE`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned). Not money-moving; **requires OTP** (it opens a route for money) |
| `update` | `bank.beneficiaries.update` | `{beneficiaryId, fields…}` | `{beneficiaryId, addedAt (reset when bank details changed), coolingOffUntil}` | as `create` plus `BENEFICIARY_NOT_FOUND`; OTP only when bank details change | (planned) |
| `remove` | `bank.beneficiaries.delete` | `{beneficiaryId}` | `{deleted: true}` | `BENEFICIARY_NOT_FOUND`, `BENEFICIARY_IN_USE`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned). No OTP |

#### 6. Permissions, step-up and limits

`beneficiaries.manage`. Step-up `otp` for add and for edits of bank details; `none` for nickname-only edits and deletes. Maximum 50 beneficiaries. Every new or re-detailed beneficiary falls under cooling-off rule A for 24 hours.

#### 7. Result and links out

Receipt: none (a beneficiary is not a payment); the reference is shown for support. Notification: SMS and in-app "{name} was added as a beneficiary. If this wasn't you, contact us now." (also sent on edit of bank details and on delete). Buttons: **Send money**, **Done**.

#### 8. Acceptance criteria

- AC-1: A beneficiary of each type can be added after valid details, consent and a verified code; it then appears in the beneficiaries list with `ageHours` 0.
- AC-2: Wrong IBAN, SWIFT, account-number or mismatched confirm values are refused with the exact messages.
- AC-3: Adding the same details twice is refused.
- AC-4: A new beneficiary is limited to $500.00 for 24 hours (rule A) and the person is told so on the review and result.
- AC-5: Changing the bank details restarts the 24 hours; changing only the nickname does not and asks for no code.
- AC-6: A beneficiary used by an active scheduled payment cannot be deleted.
- AC-7: Opened from a transfer, the journey returns to the same screen with the new beneficiary selected.
- AC-8: Three wrong codes stop the journey and nothing is saved.
- AC-9: Timeout and unavailable states save nothing and say so.

#### 9. Scenarios

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-4 | `alex` | none | Add Casey Nguyen at Harbor Trust, account `51500150`, confirm same, tick, code `482100`. List has the new entry with `ageHours` 0 and the cooling-off chip. |
| T-2 | AC-2 | `alex` | none | Abroad: IBAN `DE89 3704 0044 0532 0130 01` (bad check digit), SWIFT `ABC`, account numbers that differ: each message in section 3. |
| T-3 | AC-3 | `alex` | none | Add Jamie Lee's Northwind account again: `BENEFICIARY_EXISTS`. |
| T-4 | AC-5 | `alex`, `now` advanced 2 days | none | Edit Jamie's account number: needs a code, `addedAt` resets, chip shows. Edit only the nickname: no code, `addedAt` unchanged. |
| T-5 | AC-6 | `alex` with a schedule for Jamie | none | Delete Jamie: `BENEFICIARY_IN_USE`; after cancelling the schedule, delete works. |
| T-6 | AC-7 | `alex` | none | From `personal-transfer`'s `beneficiary` screen, add a beneficiary; back on `beneficiary` the new one is chosen. |
| T-7 | AC-8 | `alex` | none | Three wrong codes on add: `locked`; list unchanged. |
| T-8 | AC-9 | `alex` | `timeout: ["bank.beneficiaries.create"]` | `timeout` copy "This is taking longer than expected. Nothing was changed."; list unchanged. |
| T-9 | AC-9 | `alex` | `unavailable: ["bank.beneficiaries.validate"]` | `unavailable` screen on **Check details**. |

#### 10. Expected mutation-check survivors

`BENEFICIARY_LIMIT` survives (needs 50 seeded entries; add a seeded variant if wanted). The IBAN length table survives for countries not used in scenarios (only Germany is tested); expected, listed by reason "scenario covers one country". Others: none expected.

---

### ★ Schedule a payment — `schedule-payment`

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `schedule-payment` |
| Purpose | Pay a beneficiary or move money between own accounts later (once), or on a repeat (weekly, monthly), or as an open-ended standing order. Also changes an existing schedule. |
| Release / workspace | 1 / Personal |
| Status | New (planned). |
| Channels | Web and mobile |
| Starting pattern | `fixtures/local-transfer.ts` for payee, amount and review; adds the schedule screen with `datePicker` (planned block). |
| Who may use it | `payments.schedule` and `payments.create` |

**The four kinds.**

| Kind | What it does | Ends |
|---|---|---|
| Once | One payment on a chosen date | After that date |
| Weekly | Every 7 days on the weekday of the first date | Must end: on an end date or after a number of payments (up to 104) |
| Monthly | Every month on the day of the first date (29 to 31 becomes the last day in short months) | Must end: on an end date or after a number of payments (up to 24) |
| Standing order | A fixed monthly payment on a day from 1 to 28 | Runs until cancelled; an end date is optional |

International payments and bills cannot be scheduled in Release 1 (the rate is not known in advance).

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Payments › scheduled › New | none | `payments.schedule` |
| Payments › scheduled › row › Change | `{scheduleId}` | `payments.schedule` |
| Home › Upcoming payment › Edit | `{scheduleId}` | `payments.schedule` |
| Payments › beneficiaries › row › Send money ▸ "Schedule instead" | `{beneficiaryId}` | `payments.schedule` |

#### 3. Screens

**`payee` — "What are you scheduling?"** (entry in new mode). `stepper` ["payee", "plan", "review", "otp"]. onEnter: `accounts`, `beneficiaries`, `limits`.

| Field | Block | Required | Validation | Error message |
|---|---|---|---|---|
| Pay | `select` chips: To a beneficiary, Between my accounts | Yes | One of two | "Choose what to schedule." |
| Beneficiary | `beneficiaryPicker` (BankWorkx and Other bank only), `allowAddNew` with `returnTo: "payee"` | Yes if To a beneficiary | Not abroad | "Choose who to pay." |
| To account | `accountPicker` | Yes if Between my accounts | Own account other than From, same currency as From (R1) | "Choose two different accounts in the same currency." |
| From | `accountPicker` | Yes | `canDebit` | "Choose an account to pay from." |

Button **Continue**. In edit mode this screen is skipped; the payee and From account are shown read-only on `plan` ("To change who you pay, cancel this and make a new one.").

**`plan` — "When and how much?"**

| Field | Block | Required | Validation | Error message |
|---|---|---|---|---|
| Amount | `amountInput` in the From currency | Yes | At least 0.01; at most the daily limit; within the currency's decimals | "Enter an amount greater than 0." / "This is above your daily limit of {limit}." |
| How often | `select` chips: Once, Weekly, Monthly, Standing order | Yes | One of four | "Choose how often." |
| First payment | `datePicker` (planned), label "First payment" (for Once: "Payment date") | Yes | From tomorrow (3 Nov 2026) to 12 months ahead (2 Nov 2027); for a new beneficiary not earlier than `coolingOffUntil` (rule A) | "Choose a date from tomorrow." / "Choose a date within the next 12 months." / "{name} was added {n} hours ago. Choose a first payment date from {date}." |
| Day of the month | `select` 1 to 28 | Standing order only | Integer 1 to 28 | "Choose a day from 1 to 28." |
| Ends | `select` rows: On a date, After a number of payments, Never (standing order only) | Yes for Weekly and Monthly | Never only for Standing order | "Choose when it ends." |
| End date | `datePicker` (planned) | If On a date | After the first payment; at most 24 months after it (standing order: 10 years) | "The end date must be after the first payment." / "Choose an end date within 24 months." |
| Number of payments | `textInput` number | If After a number | Weekly 2 to 104; Monthly 2 to 24 | "Enter a number from 2 to {max}." |
| Reference | `textInput` | No | Up to 35 characters | "Use 35 characters or fewer." |

Alerts: a first date on a weekend or 9 Nov 2026 shows "That day is not a working day. We'll send it on {next working day}." The next run date is shown live under the date: "Next payments: 16 Nov, 16 Dec, 16 Jan…". Beneficiary under 24 hours shows the rule A warning. Button **Review schedule**. Empty accounts: "You need an account to pay from."

**`review` — "Review schedule"**. Rows: Pay (payee or account), From, Amount, How often, First payment, Last payment (or "Until you cancel"), Total payments ("12 payments · $10,800.00"), Reference. Alert (info): "We take the money at 06:00 UTC on each date. If there isn't enough money we'll try again the next day, and pause it after two failed tries." Consent (`termsVersion` "schedules-v1"): "I authorise BankWorkx to make these payments on the dates shown until I cancel or it ends." Button **Confirm and send code**.

**`otp`** — shared C; button **Schedule payment** (or **Save changes** in edit mode). **`success` — "Payment scheduled"** (terminal): text "{amount} to {payee}, {how often}, starting {date}.", meta "Ref {reference}"; edit mode "Schedule updated". Buttons **View scheduled**, **Done**. **`locked`**, **`timeout`**, **`unavailable`**, **`failed`** — shared C (wording for this journey: "Nothing was scheduled." instead of "No money has left your account.").

**What can be changed (edit mode).** Amount, how often, next payment date, end, reference. Not the payee and not the From account. A change asks for a code. A Paused schedule is resumed by saving it with a date from tomorrow.

**When a payment runs (system).** At 06:00 UTC on the date (the next working day if closed). It checks the balance, the daily limit, and for new beneficiaries the allowance (rule A). Success: a payment appears in the tracker with the schedule reference. Failure (`INSUFFICIENT_FUNDS`, `LIMIT_EXCEEDED`): retry next day once; a second failure in a row sets the status to Paused and sends "Your scheduled payment to {name} was paused because there wasn't enough money. Open Scheduled to resume it."

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `BENEFICIARY_NOT_FOUND` (planned) | "We can't find that beneficiary. Choose another." | `payee` | Choose beneficiary |
| `BENEFICIARY_COOLING_OFF` (planned) | "{name} was added {n} hours ago. Choose a first payment date from {date}." | `plan` | Change date |
| `ACCOUNT_NOT_FOUND` | S-`ACCOUNT_NOT_FOUND` | `payee` | Choose account |
| `ACCOUNT_CANNOT_DEBIT` (planned) | "You can't pay from {account} right now. Choose another account." | `payee` | Choose account |
| `INVALID_AMOUNT` | "Enter an amount greater than 0, with at most {digits} decimal places." | `plan` | Change amount |
| `LIMIT_EXCEEDED` | S-`LIMIT_EXCEEDED` (checked at creation against the daily limit itself, and again on each run) | `plan` | Change amount |
| `DATE_IN_PAST` (planned) | "Choose a date from tomorrow." | `plan` | Change date |
| `DATE_TOO_FAR` (planned) | "Choose a date within the next 12 months." | `plan` | Change date |
| `END_BEFORE_START` (planned) | "The end date must be after the first payment." | `plan` | Change date |
| `END_TOO_FAR` (planned) | "Choose an end date within 24 months." | `plan` | Change date |
| `SCHEDULE_LIMIT` (planned) | "You can have up to 20 active scheduled payments. Cancel one to add another." | `payee` | View scheduled |
| `SCHEDULE_NOT_FOUND` (planned) | "We can't find that scheduled payment." | `failed` | Back to scheduled |
| `SCHEDULE_NOT_ACTIVE` (planned) | "This scheduled payment has ended or been cancelled. Make a new one." | `failed` | New schedule |
| `OTP_INVALID` / `OTP_REQUIRED` | S-`OTP_INVALID` / S-`OTP_REQUIRED` | `otp` / `failed` | Try again / Back to code |
| `CORE_UNAVAILABLE` | "We couldn't complete this right now. Nothing was scheduled." | `failed` | Try again |
| `NOT_SUPPORTED` | S-`NOT_SUPPORTED` | `failed` | Back |
| `TIMEOUT` / `SERVICE_UNAVAILABLE` (planned) | "This is taking longer than expected. Nothing was scheduled. Check Scheduled before trying again." / standard unavailable | `timeout` / `unavailable` | Check Scheduled / Try again |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `accounts`, `beneficiaries`, `limits` | `bank.accounts.list`, `bank.beneficiaries.list`, `bank.limits.get` | as other transfers | as other transfers | `LIMIT_NOT_SET` | Existing |
| `get` | `bank.schedules.get` | `{scheduleId}` | the schedule | `SCHEDULE_NOT_FOUND` | (planned) |
| `otpSend`, `otpVerify` | `bank.otp.*` | as C | as C | `OTP_INVALID` | Existing |
| `create` | `bank.schedules.create` | `{kind: "once"\|"weekly"\|"monthly"\|"standing", fromAccountId, toKind: "beneficiary"\|"own", beneficiaryId?, toAccountId?, amount, startOn, dayOfMonth?, endsOn?, count?, reference?}` | `{scheduleId, reference (SCH-…), status: "active", nextRunOn, lastRunOn, remainingRuns, total}` | `BENEFICIARY_NOT_FOUND`, `BENEFICIARY_COOLING_OFF`, `ACCOUNT_NOT_FOUND`, `ACCOUNT_CANNOT_DEBIT`, `INVALID_AMOUNT`, `LIMIT_EXCEEDED`, `DATE_IN_PAST`, `DATE_TOO_FAR`, `END_BEFORE_START`, `END_TOO_FAR`, `SCHEDULE_LIMIT`, `OTP_REQUIRED`, `CORE_UNAVAILABLE`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned). `moneyMoving: false` (money moves on each run); **requires OTP** |
| `update` | `bank.schedules.update` | `{scheduleId, amount?, kind?, startOn?, endsOn?, count?, reference?}` | the schedule | `SCHEDULE_NOT_FOUND`, `SCHEDULE_NOT_ACTIVE` plus the date and amount codes, `OTP_REQUIRED` | (planned). Requires OTP |
| (system) | `bank.schedules.runDue` | `{now}` (sandbox and tests only) | runs due payments; `{ran[], failed[]}` | none | (planned). Lets scenarios advance time |

Worked example: Alex, Monthly, **$900.00** to Jamie Lee from Main, first payment **16 Nov 2026**, 12 payments. Total $10,800.00; last payment 16 Oct 2027; next runs 16 Nov, 16 Dec, 16 Jan. Nothing leaves Main until 16 Nov; on that date `runDue` takes $900.00 and creates a payment.

#### 6. Permissions, step-up and limits

`payments.schedule` to create, change and cancel; `payments.create` to choose a payee. Step-up `otp`. Up to 20 active schedules. Daily limit checked at creation and on each run. Cooling-off rule A on the first date. Business context: `WRONG_CONTEXT`.

#### 7. Result and links out

Receipt (planned): a schedule confirmation with payee, amount, frequency, dates, reference. Notifications: on creation; 2 days before each payment ("{payee} will be paid {amount} on {date}"); after each run; and on pause. Buttons: **View scheduled**, **Done**. Home › Upcoming payments shows it.

#### 8. Acceptance criteria

- AC-1: A Once, Weekly, Monthly or Standing schedule is created only after consent and a verified code, and moves no money at creation.
- AC-2: The first payment date must be from tomorrow and within 12 months; the end date must be after it and within 24 months (standing: optional).
- AC-3: Weekly and Monthly must have an end; Standing may have none.
- AC-4: A beneficiary added under 24 hours ago cannot be scheduled earlier than the end of the 24 hours.
- AC-5: On the run date the money moves, a payment appears in the tracker and the schedule's remaining runs fall by one.
- AC-6: Two failed runs in a row pause the schedule and notify the person.
- AC-7: Changing a schedule needs a code; the payee and From account cannot be changed.
- AC-8: The review shows every payment date count and the total.
- AC-9: Timeout and unavailable states create nothing and say so.

#### 9. Scenarios

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-8 | `alex`, `now` 2 Nov 2026 | none | Monthly $900.00, Jamie, first 16 Nov 2026, 12 payments, tick, `482100`. Review shows "12 payments · $10,800.00"; Main unchanged at 8,720.76. |
| T-2 | AC-2 | `alex` | none | First date 2 Nov: "Choose a date from tomorrow."; 3 Nov 2027: "Choose a date within the next 12 months."; end before start: "The end date must be after the first payment." |
| T-3 | AC-3 | `alex` | none | Monthly with Ends empty: "Choose when it ends."; Standing order with Never: accepted. |
| T-4 | AC-4 | `alex`, `now` 2 Nov 10:00 UTC, Casey added 07:00 | none | First date 3 Nov: refused ("Choose a first payment date from 4 Nov 2026"); 4 Nov accepted. |
| T-5 | AC-5 | `alex` | none | After T-1, `runDue` with `now` 16 Nov 2026 06:00 UTC: Main 7,820.76; tracker has a `TRX-…` payment; remaining runs 11. |
| T-6 | AC-6 | `alex`, balance set to 100.00 | none | `runDue` on 16 Nov (fails), 17 Nov (fails): status Paused, notification sent. |
| T-7 | AC-7 | `alex` | none | Edit amount to $950.00: needs a code; the payee field is read-only; `addedAt` of the beneficiary untouched. |
| T-8 | AC-9 | `alex` | `timeout: ["bank.schedules.create"]` | `timeout` screen; scheduled list unchanged. |
| T-9 | AC-9 | `alex` | `unavailable: ["bank.schedules.create"]` | `unavailable` screen; list unchanged. |

#### 10. Expected mutation-check survivors

The date-range checks sit in the `datePicker` limits as well as the adapter; adapter-only mutants are killed by direct calls in T-2. `SCHEDULE_LIMIT` (20) survives unless 20 are seeded. The "last day of the month" rule for the 29th to the 31st survives (no scenario crosses a short month); list it. Others: none expected.

---

### ★ Cancel a standing order — `cancel-standing-order`

#### 1. Summary

| Field | Value |
|---|---|
| Slug | `cancel-standing-order` |
| Purpose | Stop a standing order, a recurring payment or a not-yet-run scheduled payment, so no further payments are made. |
| Release / workspace | 1 / Personal |
| Status | New (planned). |
| Channels | Web and mobile |
| Starting pattern | None. A short confirm-and-result flow. |
| Who may use it | `payments.schedule` |

The name keeps "standing order", and the journey works for every kind of schedule from `schedule-payment`.

#### 2. Entry points

| Place › label | Passes in | Permission |
|---|---|---|
| Payments › scheduled › standing order › Cancel | `{scheduleId}` | `payments.schedule` |
| Payments › scheduled › row (any kind) › Cancel | `{scheduleId}` | `payments.schedule` |
| Payments › tracker › payment (Scheduled) › Cancel | `{scheduleId}` | `payments.schedule` |

#### 3. Screens

**`confirm` — "Cancel this payment?"** (entry). Blocks: `reviewSummary`, `select` (reason), `alert`, two `button`s. onEnter: `get` (loads `{scheduleId}`).

| Field | Block | Required | Validation | Error message |
|---|---|---|---|---|
| Reason | `select` rows: I don't need it any more; The amount was wrong; I'm paying another way; Other | No | One of the list | none |

Copy: title "Cancel this payment?". Summary rows: Pay (payee), From, Amount, How often, Next payment, Payments left ("11" or "Until you cancel"). Alert (warning): "Cancelling stops all future payments. Payments already sent are not affected." Buttons **Cancel this payment** (destructive; calls `cancel`) and **Keep it** (exit). No code is asked: cancelling can only reduce what leaves the account.

**`success` — "Payment cancelled"** (terminal). Text "No more payments will go to {payee}." Meta "Last payment: {date}" when there was one, and "Ref {reference}". Buttons **Back to scheduled**, **Done**.

**`failed`**, **`timeout`**, **`unavailable`** — shared C with the non-money wording ("Nothing was changed.").

Loading: skeleton summary until `get` answers; button spinner on cancel. Error: unknown id shows "We can't find that scheduled payment." with **Back to scheduled**.

#### 4. Sandbox errors

| Code | Message | Shows on | Button |
|---|---|---|---|
| `SCHEDULE_NOT_FOUND` (planned) | "We can't find that scheduled payment." | `failed` | Back to scheduled |
| `SCHEDULE_NOT_ACTIVE` (planned) | "This scheduled payment has already ended or been cancelled." | `failed` | Back to scheduled |
| `SCHEDULE_RUNNING` (planned) | "This payment is being processed right now and can't be cancelled. Cancel it tomorrow to stop the next one." | `failed` | Back to scheduled |
| `NOT_SUPPORTED` | S-`NOT_SUPPORTED` | `failed` | Back |
| `TIMEOUT` (planned) | "This is taking longer than expected. Nothing was changed. Check Scheduled before trying again." | `timeout` | Check Scheduled |
| `SERVICE_UNAVAILABLE` (planned) | standard message | `unavailable` | Try again |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `get` | `bank.schedules.get` | `{scheduleId}` | schedule with payee, amounts, dates | `SCHEDULE_NOT_FOUND` | (planned) |
| `cancel` | `bank.schedules.cancel` | `{scheduleId, reason?}` | `{scheduleId, status: "cancelled", cancelledOn, reference}` | `SCHEDULE_NOT_FOUND`, `SCHEDULE_NOT_ACTIVE`, `SCHEDULE_RUNNING`, `NOT_SUPPORTED`, `TIMEOUT`, `SERVICE_UNAVAILABLE` | (planned). `moneyMoving: false`, `requiresOtp: false` |

#### 6. Permissions, step-up and limits

`payments.schedule`; step-up `none` (stated reason: cancelling reduces risk). The sandbox refuses cancelling a run already started on the day (after 06:00 UTC).

#### 7. Result and links out

Receipt: none. Notification: "Your scheduled payment to {payee} was cancelled." (in-app and SMS). Buttons: **Back to scheduled**, **Done**. Home › Upcoming payments no longer shows it.

#### 8. Acceptance criteria

- AC-1: Confirming cancels the schedule: status Cancelled, no further payments run.
- AC-2: Payments already sent stay in the tracker and are not reversed.
- AC-3: No code is asked and no balance changes.
- AC-4: Cancelling an already-cancelled or ended schedule shows the exact message.
- AC-5: A run that has started today cannot be cancelled.
- AC-6: Timeout and unavailable states leave the schedule active and say so.

#### 9. Scenarios

| # | Covers | Persona / setup | Conditions | Steps and expected result |
|---|---|---|---|---|
| T-1 | AC-1, AC-2, AC-3 | `alex` with the T-1 monthly schedule from `schedule-payment`, one run done | none | Cancel: status Cancelled; `runDue` on 16 Dec runs nothing; tracker still shows the 16 Nov payment; balances unchanged by the cancel. |
| T-2 | AC-4 | `alex` | none | Cancel the same id twice: second gives "This scheduled payment has already ended or been cancelled." |
| T-3 | AC-5 | `alex`, `now` 16 Nov 2026 06:30 UTC | none | `SCHEDULE_RUNNING`. |
| T-4 | AC-6 | `alex` | `timeout: ["bank.schedules.cancel"]` | `timeout` screen; schedule still Active. |
| T-5 | AC-6 | `alex` | `unavailable: ["bank.schedules.cancel"]` | `unavailable` screen; schedule still Active. |

#### 10. Expected mutation-check survivors

None expected. (`requiresOtp: false` is a decision, not a gap.)

---

## Personal: Cards

The Cards tab holds two kinds of card, and the spec keeps them apart:

| Kind | What it is | In the sandbox today |
|---|---|---|
| **BankWorkx card** (debit, credit, virtual) | A card BankWorkx issues to Alex. It has a status, limits, controls, a PIN, transactions and can be replaced or disputed. | **Not modelled** (planned) |
| **Saved card** (an outside card used to add money) | A card from any bank that Alex saves so `add-money` can pull money from it. | **Existing**: `SavedCard` in `packages/mock-bank-api/src/finance.ts` (`id`, `network`, `last4`, `holder`, `expiry`, `nickname`, `isDefault`), listed by `bank.cards.list`, saved by `bank.cards.add` |

The journeys `activate-card`, `freeze-card`, `card-controls`, `virtual-card`, `replace-card`, `card-pin` and `dispute-transaction` work on **BankWorkx cards** and need the planned domain below. `add-card` works on **saved cards** and exists today.

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

### ★ Activate card — `activate-card`

#### 1. Summary

| Item | Value |
|---|---|
| Slug | `activate-card` |
| Purpose | Turn on a new card that arrived by post, and prompt the person to set its PIN |
| Release | 1 |
| Workspace | Personal |
| Status | New (draft). Needs the planned cards domain |
| Channels | Web, mobile |
| Starting pattern | Confirm-then-code (details → one-time code → result) |
| Who may use it | Personal context holding `cards.manage` |

#### 2. Entry points

| Place › label | Passed | Permission |
|---|---|---|
| Cards › carousel › Activate | `{cardId}` | `cards.manage` |
| Notification › Card activation reminder | `{cardId}` | `cards.manage` |
| Card detail › Activate (inactive card only) | `{cardId}` | `cards.manage` |
| Deep link `/personal/j/activate-card?cardId=card_7745` | `{cardId}` | `cards.manage` |

Without `{cardId}` the first screen shows a card choice listing only inactive cards.

#### 3. Screens

**Screen `details` — "Activate your card".** Blocks: `stepper` (`details`, `code`), `alert` info, `select` (only when `cardId` is missing), `textInput` x2, `button`. `onEnter`: `callApi cards` (`bank.cards.issued`) into `ctx.cards`.

| Field | Block | Required | Rule | Error message |
|---|---|---|---|---|
| Card | `select` (`rows`, source `ctx.cards`, inactive only) | Yes, hidden when passed in | Must be an inactive card | "Choose the card you want to activate." |
| Last 4 digits of the card number | `textInput` (bind `act.last4`, pattern `^[0-9]{4}$`) | Yes | Exactly 4 digits | "Enter the last 4 digits printed on your card." |
| Expiry date | `textInput` (bind `act.expiry`, pattern `^(0[1-9]|1[0-2])/[0-9]{2}$`, placeholder "MM/YY") | Yes | MM/YY | "Enter the expiry as MM/YY." |

Copy: alert "Only activate a card that you have in your hands. If the envelope was open, don't use the card: call us instead." Helper under last 4: "Find it on the front of the card." Button "Continue" (`validate`, then `callApi otpSend`, navigate `code`).
States: loading shows card-row skeleton; if no inactive card exists, `empty` text "You have no cards waiting to be activated." with button "Back to cards" (`exit`).

**Screen `code` — "Confirm with your code".** Standard one-time code screen. Button "Activate card" calls `otpVerify`, then `activate` (`bank.cards.activate`), then navigates to `done`.

**Screen `done` (terminal) — "Card activated".** `result` success, text "Your card ending {{act.last4}} is ready to use.", meta "Ref {{result.reference}}"; `alert` info "Set a PIN now so you can use cash machines and shops that ask for it."; buttons "Set my PIN" (`navigate toJourney card-pin`, `{cardId}`, `returnTo` card detail), "Go to card" (`exit`).

**Screens `locked`, `failed`**: the standard ones.

#### 4. Sandbox errors

| Code | Message the person sees | Screen | Button |
|---|---|---|---|
| `CARD_NOT_FOUND` | "We can't find that card. Choose another." | `failed` | Choose card (to `details`) |
| `CARD_ALREADY_ACTIVE` | "This card is already active. You can start using it." | `failed` | Go to card |
| `ACTIVATION_MISMATCH` | "The last 4 digits or the expiry don't match this card. Check them and try again." | `details` (inline `alert` error) | Try again |
| `CARD_BLOCKED` | "This card was blocked and can't be activated. Ask for a replacement." | `failed` | Replace card (`replace-card`) |
| `OTP_INVALID` | Standard S-`OTP_INVALID` (README 1.6) | `code` | Try again |
| `OTP_REQUIRED` | Standard S-`OTP_REQUIRED` | `code` | Back to code |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed on your card." | `failed` | Try again |
| `SERVICE_UNAVAILABLE` | Standard S-`SERVICE_UNAVAILABLE` | `failed` | Try again |
| `PERMISSION_DENIED` | Standard S-`PERMISSION_DENIED` | `failed` | Back |
| `WRONG_CONTEXT` | Standard S-`WRONG_CONTEXT` | `failed` | Switch |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `cards` | `bank.cards.issued` | none | cards record | `NOT_SUPPORTED` | (planned) |
| `otpSend` | `bank.otp.send` | `{channel: "sms"}` | `{sent, maskedPhone, channel}` | none | Existing |
| `otpVerify` | `bank.otp.verify` | `{code}` | `{verified: true}` | `OTP_INVALID` | Existing |
| `activate` | `bank.cards.activate` | `{cardId, last4, expiry}` | `{cardId, status: "active", reference}` | see section 4 | (planned) |

Not money-moving; `requiresOtp: true`.

#### 6. Permissions, step-up and limits

`cards.manage`. Step-up level `otp`. No limits. Check 3 (sandbox): `bank.cards.activate` refuses without a verified code (`OTP_REQUIRED`).

#### 7. Result and links out

Result `done`. Receipt: none (not a payment); the card detail shows "Activated 3 Nov 2026". Notification raised: "Your card ending {{last4}} is now active" (in-app and push). Buttons: "Set my PIN" → `card-pin` with `returnTo` card detail; "Go to card" → Card detail.

#### 8. Acceptance criteria

- AC-1: An inactive card becomes active only when the last 4 digits and the expiry match.
- AC-2: A wrong last 4 or expiry leaves the card inactive and tells the person what to check.
- AC-3: Activation needs a verified one-time code.
- AC-4: Three wrong codes lock the journey and leave the card inactive.
- AC-5: An already active card cannot be activated again and the person is told.
- AC-6: A blocked card cannot be activated and the person is offered a replacement.
- AC-7: After success the person is offered to set a PIN.
- AC-8: A timeout or an unavailable service leaves the card inactive and says nothing was changed.

#### 9. Scenarios

| # | Covers | Persona and setup | Steps and expected outcome |
|---|---|---|---|
| T-1 | AC-1, AC-3, AC-7 | `alex`; `cardId` `card_7745` | Enter `7745`, `11/29`, code `482100`. Card is `active`; result "Card activated"; "Set my PIN" visible |
| T-2 | AC-2 | `alex` | Enter `1111`. `ACTIVATION_MISMATCH` shown on `details`; card stays `inactive`; no code sent |
| T-3 | AC-3 | `alex` | Call `activate` without verifying the code. `OTP_REQUIRED` |
| T-4 | AC-4 | `alex` | Enter `999999` three times. `locked` screen; card `inactive` |
| T-5 | AC-5 | `alex`; `cardId` `card_9021` | `CARD_ALREADY_ACTIVE`; message shown |
| T-6 | AC-6 | `alex`; setup card `card_7745` as `blocked` | `CARD_BLOCKED`; "Replace card" button opens `replace-card` |
| T-7 | AC-8 | `alex`; conditions `timeout: ["bank.cards.activate"]` | After the delay the standard timeout message; card `inactive` |
| T-8 | AC-8 | `alex`; conditions `unavailable: ["bank.cards.activate"]` | `SERVICE_UNAVAILABLE` message at once; card `inactive` |

#### 10. Expected mutation-check survivors

- Removing the Luhn-style or length check on last 4: **None expected** (T-2 uses a mismatch).
- Removing the `pattern` on `act.expiry` in the journey: survives, because `bank.cards.activate` returns `ACTIVATION_MISMATCH` for a malformed expiry anyway (another layer stops it).
- Raising `maxAttempts` from 3: killed by T-4.

---

### ★ Freeze card — `freeze-card`

#### 1. Summary

| Item | Value |
|---|---|
| Slug | `freeze-card` |
| Purpose | Freeze a card for a while, unfreeze it, or block it for good |
| Release | 1 |
| Workspace | Personal |
| Status | New (draft). Needs the planned cards domain |
| Channels | Web, mobile |
| Starting pattern | One journey with three modes (`freeze`, `unfreeze`, `block`) chosen by the passed `action` |
| Who may use it | Personal context holding `cards.manage` |

Freezing is protective, so it takes one tap and no code. Anything that makes a card usable again (unfreeze) or ends it for good (block) needs the one-time code.

#### 2. Entry points

| Place › label | Passed | Permission |
|---|---|---|
| Cards › card › Freeze | `{cardId, action: "freeze"}` | `cards.manage` |
| Cards › card › Unfreeze | `{cardId, action: "unfreeze"}` | `cards.manage` |
| Cards › card › Block card | `{cardId, action: "block"}` | `cards.manage` |
| `replace-card` (stolen) | `{cardId, action: "block"}` with `returnTo` | `cards.manage` |

Without `action` the first screen asks which of the three (tiles).

#### 3. Screens

**Screen `choose` — "What do you want to do?"** (skipped when `action` is passed). `select` tiles, bind `fz.action`:

| Tile | Label | Help text |
|---|---|---|
| `freeze` | "Freeze for now" | "Stops all spending on this card. You can unfreeze it any time." |
| `unfreeze` | "Unfreeze" | "Lets you use the card again." |
| `block` | "Block for good" | "Ends this card for ever. You'll need a new card." |

Only tiles that fit the card's status show (an active card offers Freeze and Block; a frozen card offers Unfreeze and Block; a blocked card shows no tiles and the empty text "This card is already blocked. Ask for a replacement." with button "Replace card"). Button "Continue" (`validate`, navigate by action: `freeze` → `confirmFreeze`, `unfreeze` → `confirmUnfreeze`, `block` → `confirmBlock`).

**Screen `confirmFreeze` — "Freeze this card?"** `reviewSummary` (Card "{{card.name}}", Effect "No spending, cash or online payments until you unfreeze"), `alert` info "Payments already taken are not affected. Regular payments you set up with the card may fail while it is frozen." Buttons "Freeze card" (`callApi freeze`, on success `navigate done`), "Cancel" (`exit`).

**Screen `confirmUnfreeze` — "Unfreeze this card?"** `reviewSummary` (Card, Effect "You can spend with this card again"). Button "Continue" (`callApi otpSend`, navigate `code`); "Cancel".

**Screen `confirmBlock` — "Block this card for good?"** `alert` warning "This can't be undone. We'll cancel the card and any virtual cards linked to it." `reviewSummary` (Card; Linked virtual cards "{{card.virtualCount}} will also be blocked"). Field:

| Field | Block | Required | Rule | Error message |
|---|---|---|---|---|
| Reason | `select` (`rows`: "I lost it", "It was stolen", "I don't need it", "Something else") bind `fz.reason` | Yes | One of the four | "Choose a reason." |
| Type BLOCK to confirm | `textInput` bind `fz.confirmWord`, pattern `^BLOCK$` | Yes | Exactly `BLOCK` | "Type BLOCK in capital letters to continue." |

Buttons "Continue" (`validate`, `callApi otpSend`, navigate `code`), "Cancel".

**Screen `code` — "Confirm with your code".** Standard. Button label "Unfreeze card" or "Block card" by mode (two buttons with `visibleWhen`). On success calls `unfreeze` or `block`, then `done`.

**Screen `done` (terminal).** Three variants by mode (`visibleWhen`):

| Mode | Title | Text | Buttons |
|---|---|---|---|
| freeze | "Card frozen" | "Your card ending {{card.last4}} is frozen. Nobody can spend with it." | "Unfreeze" (to `confirmUnfreeze`), "Go to card" |
| unfreeze | "Card unfrozen" | "Your card ending {{card.last4}} works again." | "Go to card" |
| block | "Card blocked" | "Your card ending {{card.last4}} is blocked for good." meta "Ref {{result.reference}}" | "Get a new card" (`navigate toJourney replace-card`, `{cardId}`, `returnTo` card detail), "Go to cards" |

`locked` and `failed` as standard.

#### 4. Sandbox errors

| Code | Message | Screen | Button |
|---|---|---|---|
| `CARD_NOT_FOUND` | "We can't find that card. Choose another." | `failed` | Back to cards |
| `CARD_NOT_ACTIVE` | "This card can't be frozen because it isn't active yet." | `failed` | Activate card (`activate-card`) |
| `CARD_ALREADY_FROZEN` | "This card is already frozen." | `failed` | Go to card |
| `CARD_NOT_FROZEN` | "This card isn't frozen." | `failed` | Go to card |
| `CARD_ALREADY_BLOCKED` | "This card is already blocked. Ask for a replacement." | `failed` | Replace card |
| `OTP_INVALID` / `OTP_REQUIRED` | Standard | `code` | Try again / Back to code |
| `TIMEOUT` | "This is taking longer than expected. Nothing was changed on your card." | `failed` | Try again |
| `SERVICE_UNAVAILABLE` | Standard | `failed` | Try again |
| `PERMISSION_DENIED`, `WRONG_CONTEXT`, `SESSION_EXPIRED` | Standard | `failed` | Back / Switch / Sign in |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `card` | `bank.cards.get` | `{cardId}` | card | `CARD_NOT_FOUND` | (planned) |
| `freeze` | `bank.cards.freeze` | `{cardId}` | `{status: "frozen"}` | `CARD_NOT_FOUND`, `CARD_NOT_ACTIVE`, `CARD_ALREADY_FROZEN` | (planned) |
| `unfreeze` | `bank.cards.unfreeze` | `{cardId}` | `{status: "active"}` | `CARD_NOT_FOUND`, `CARD_NOT_FROZEN`, `OTP_REQUIRED` | (planned) |
| `block` | `bank.cards.block` | `{cardId, reason}` | `{status: "blocked", reference}` | `CARD_NOT_FOUND`, `CARD_ALREADY_BLOCKED`, `OTP_REQUIRED` | (planned) |
| `otpSend`, `otpVerify` | `bank.otp.send`, `bank.otp.verify` | as in the card note | | `OTP_INVALID` | Existing |

#### 6. Permissions, step-up and limits

`cards.manage`. Freeze: step-up `none`. Unfreeze and block: `otp`. Check 3: the sandbox refuses unfreeze and block without a verified code. No limits.

#### 7. Result and links out

Result variants above. Receipt only for block (reference). Notifications: "Card ending {{last4}} frozen" / "unfrozen" / "blocked" (in-app and push, all three). Links out: card detail, `replace-card`, `activate-card`.

#### 8. Acceptance criteria

- AC-1: Freezing an active card works without a one-time code and changes its status to frozen.
- AC-2: Unfreezing needs a verified one-time code.
- AC-3: Blocking needs the typed word BLOCK and a verified one-time code, and cannot be undone.
- AC-4: Blocking a card also blocks its virtual cards.
- AC-5: A frozen or blocked card shows only the actions that still apply.
- AC-6: Freezing an inactive card is refused with a clear message.
- AC-7: After a block the person is offered a replacement.
- AC-8: Three wrong codes stop an unfreeze or block and leave the status unchanged.
- AC-9: A timeout or unavailable service leaves the status unchanged and says so.

#### 9. Scenarios

| # | Covers | Persona and setup | Outcome |
|---|---|---|---|
| T-1 | AC-1, AC-5 | `alex`, `card_9021`, `action freeze` | Status `frozen`, no code asked; card detail shows Unfreeze and Block only |
| T-2 | AC-2 | `alex`; `card_9021` frozen | Unfreeze without a code is `OTP_REQUIRED`; with `482100` status `active` |
| T-3 | AC-3, AC-7 | `alex`, `card_9021`, `action block` | Typing `block` fails with the validation message; `BLOCK` + code gives `blocked`; "Get a new card" shown |
| T-4 | AC-4 | `alex`; `card_9021` has a virtual card | After block the virtual card is `blocked` |
| T-5 | AC-6 | `alex`; `card_7745` (inactive), `freeze` | `CARD_NOT_ACTIVE` message |
| T-6 | AC-8 | `alex`; unfreeze | Wrong code `111111` three times: `locked`; status still `frozen` |
| T-7 | AC-9 | conditions `timeout: ["bank.cards.freeze"]` | Standard timeout text; status `active` |
| T-8 | AC-9 | conditions `unavailable: ["bank.cards.block"]` | `SERVICE_UNAVAILABLE`; status unchanged |

#### 10. Expected mutation-check survivors

- Dropping `lockAfter` in `block`'s `code` screen: killed by T-6 (same screen).
- Removing the typed-word `pattern` on the screen: survives only if `bank.cards.block` also checks a `confirm` field. Decision: the sandbox does **not** (the word is a UI guard), so T-3 must prove it at the journey level; the mutant is killed, none expected.
- Removing the freeze-needs-no-code behaviour (adding a code): killed by T-1.

---

### ★ Card limits and controls — `card-controls`

#### 1. Summary

| Item | Value |
|---|---|
| Slug | `card-controls` |
| Purpose | Choose where and how much a card can be used: online, contactless, abroad, cash machines, per purchase and per day |
| Release | 1 |
| Workspace | Personal |
| Status | New (draft). Needs the planned cards domain |
| Channels | Web, mobile |
| Starting pattern | Edit-and-review: change settings, see what changes, confirm (code only when loosening) |
| Who may use it | Personal context holding `cards.manage` |

#### 2. Entry points

| Place › label | Passed | Permission |
|---|---|---|
| Cards › card › Limits and controls | `{cardId}` | `cards.manage` |
| Controls overview › row | `{cardId}` | `cards.manage` |
| Card detail › controls summary › Change | `{cardId}` | `cards.manage` |
| Deep link `/personal/j/card-controls?cardId=card_9021` | `{cardId}` | `cards.manage` |

#### 3. Screens

**Screen `edit` — "Limits and controls".** `onEnter`: `callApi card` (`bank.cards.get`) into `ctx.card`; the form fields are pre-filled from it (`ctrl.*`). Blocks: `sectionHeader` "Where it works", four `toggle`, `sectionHeader` "How much", three `amountInput`, `alert`, `button`.

| Field | Block | Required | Rule | Error message |
|---|---|---|---|---|
| Online purchases | `toggle` bind `ctrl.online` | Yes | none | none |
| Contactless | `toggle` bind `ctrl.contactless` | Yes | none | none |
| Abroad | `toggle` bind `ctrl.abroad` | Yes | none | none |
| Cash machines | `toggle` bind `ctrl.atm` (hidden for credit cards that have no cash limit) | Yes | none | none |
| Per purchase limit | `amountInput` bind `ctrl.perTransaction` (currency of the card) | Yes | 0.01 to ceiling and not above the daily purchase limit | "Enter an amount from 0.01 to {{ctx.card.ceilings.perTransaction}}." / "A single purchase can't be more than your daily limit." |
| Daily purchases limit | `amountInput` bind `ctrl.dailyPurchases` | Yes | 0.01 to ceiling | "Enter an amount from 0.01 to {{ctx.card.ceilings.dailyPurchases}}." |
| Daily cash limit | `amountInput` bind `ctrl.dailyAtm` (debit only) | Yes | 0 to ceiling | "Enter an amount from 0 to {{ctx.card.ceilings.dailyAtm}}." |

Helper texts: abroad "Turn on before you travel. Turn it off when you're back."; per purchase "The most you can pay in one go."; daily purchases "Resets at midnight (UTC)."; daily cash "Cash taken out today: {{ctx.card.limits.dailyAtm.usedToday}}". Alert info "Making a limit smaller or turning a control off takes effect straight away. Making it bigger or turning something on needs a code." Button "Review changes" (`validate`; navigates to `review`). If nothing changed, the button is disabled and the helper reads "Change something to continue."
States: loading skeleton toggles and fields; a frozen/blocked/inactive card shows `alert` warning "This card is {{status}}. You can change its controls after it's active." and the form is read-only with button "Go to card".

**Screen `review` — "Review changes".** `reviewSummary` lists **only the rows that changed**, as "Abroad: Off → On", "Daily purchases: 3,000.00 → 4,000.00". Below it an `alert`: when loosening (`visibleWhen ctrl.loosened`) "These changes make your card easier to use, so we'll ask for a code." else "These changes make your card safer, so no code is needed." Buttons: "Save changes" (tightening only: `callApi update`, navigate `done`), "Continue" (loosening: `callApi otpSend`, navigate `code`), "Edit" (back to `edit`). The journey works out `ctrl.loosened` by comparing the form with `ctx.card` (a `setData` before `review`).

**Screen `code`**: standard; button "Save changes" calls `otpVerify`, then `update`, then `done`.

**Screen `done` (terminal) — "Controls updated".** `result` success, text "{{result.summary}}" (for example "Abroad is on. Daily purchases are 4,000.00."), meta "Ref {{result.reference}}"; buttons "Go to card", "Done". `locked` and `failed` standard (Try again → `edit`).

#### 4. Sandbox errors

| Code | Message | Screen | Button |
|---|---|---|---|
| `CARD_NOT_FOUND` | "We can't find that card. Choose another." | `failed` | Back to cards |
| `CARD_NOT_ACTIVE` | "You can change controls once the card is active." | `failed` | Go to card |
| `LIMIT_INVALID` | "One of the limits isn't valid. Use an amount of 0 or more, with {{decimals}} decimal places at most." | `edit` | Fix it |
| `LIMIT_ABOVE_CEILING` | "The most this card allows is {{ceiling}} for {{limit name}}. Choose a smaller amount." | `edit` | Fix it |
| `OTP_REQUIRED` | "Confirm with your one-time code first." (only when loosening) | `code` | Back to code |
| `OTP_INVALID` | Standard | `code` | Try again |
| `TIMEOUT`, `SERVICE_UNAVAILABLE` | "This is taking longer than expected. Nothing was changed on your card." / standard | `failed` | Try again |
| `PERMISSION_DENIED`, `WRONG_CONTEXT` | Standard | `failed` | Back / Switch |

#### 5. Adapters

| Integration id | Adapter | Request | Response | Errors | Status |
|---|---|---|---|---|---|
| `card` | `bank.cards.get` | `{cardId}` | card with controls, limits, ceilings | `CARD_NOT_FOUND` | (planned) |
| `update` | `bank.cards.controls.update` | `{cardId, controls: {online, contactless, abroad, atm}, limits: {perTransaction, dailyPurchases, dailyAtm}}` | `{controls, limits, loosened, reference, summary}` | see section 4 | (planned) |
| `otpSend`, `otpVerify` | existing OTP adapters | | | `OTP_INVALID` | Existing |

`moneyMoving: false`. `requiresOtp`: only when the update loosens something (the sandbox compares the request with the stored values).

#### 6. Permissions, step-up and limits

`cards.manage`. Step-up: `none` to tighten, `otp` to loosen. Limits are the card ceilings (section 3). The sandbox, not the screen, decides what counts as loosening (check 3).

#### 7. Result and links out

Result `done`. No receipt. Notification: "Controls changed on card ending {{last4}}: {{summary}}". Links: card detail, Controls overview.

#### 8. Acceptance criteria

- AC-1: Turning a control off or lowering a limit saves without a one-time code.
- AC-2: Turning a control on or raising a limit needs a verified one-time code.
- AC-3: A limit above the card's ceiling is refused and the ceiling is named.
- AC-4: A per purchase limit above the daily purchases limit is refused.
- AC-5: The review lists only what changed.
- AC-6: A frozen, blocked or inactive card cannot be changed.
- AC-7: Three wrong codes discard the change.
- AC-8: A timeout or unavailable service saves nothing and says so.
- AC-9: Mixed changes (one tighter, one looser) are treated as loosening and need the code.

#### 9. Scenarios

| # | Covers | Persona and setup | Outcome |
|---|---|---|---|
| T-1 | AC-1, AC-5 | `alex`, `card_9021`; turn `contactless` off, lower daily purchases to 1,000 | Review shows 2 rows; no code; saved |
| T-2 | AC-2 | `alex`, `card_3318`; turn `abroad` on | Code asked; `OTP_REQUIRED` if skipped; with `482100` saved |
| T-3 | AC-3 | `alex`, `card_9021`; daily ATM 5,000 | `LIMIT_ABOVE_CEILING` naming 1,500.00 |
| T-4 | AC-4 | `alex`; per purchase 3,500 with daily 3,000 | Validation message "A single purchase can't be more than your daily limit." |
| T-5 | AC-6 | `alex`; `card_9021` frozen | Form read-only; adapter answers `CARD_NOT_ACTIVE` if forced |
| T-6 | AC-7 | `alex`; loosening, code `111111` x3 | `locked`; limits unchanged |
| T-7 | AC-9 | `alex`; `abroad` on and `online` off | Treated as loosening: code asked |
| T-8 | AC-8 | conditions `timeout: ["bank.cards.controls.update"]` | Timeout text; nothing saved |
| T-9 | AC-8 | conditions `unavailable: ["bank.cards.controls.update"]` | `SERVICE_UNAVAILABLE`; nothing saved |

#### 10. Expected mutation-check survivors

- Journey-level `max` on the daily ATM amount field: survives because the sandbox returns `LIMIT_ABOVE_CEILING` (another layer stops it).
- Flipping the loosening test (`>` to `>=`): killed by T-1 and T-2.
- "Mixed changes" mutant (treating a mixed change as tightening): killed by T-7.

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

