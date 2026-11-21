# Research: Card limits and controls (`card-controls`)

Journey id `card-controls`. Covers freeze and unfreeze, limits, channels, merchant categories, countries and travel dates, alerts and digital wallets. Built in `src/journeys/25-card-controls.js`.

## 1. Sources

| Source | What was taken |
|---|---|
| https://www.halifax.co.uk/aboutonline/card-and-pin-services/card-freezes.html and https://www.mbna.co.uk/online-services/card-and-pin-services/card-freezes.html (UK) | A freeze can be total or partial (abroad, contactless, ATM); the page says what a freeze still allows (existing recurring payments, refunds). |
| https://www.santander.co.uk/business/support/card-controls (UK) | Online, international and contactless can be blocked one by one. |
| https://www.chase.co.uk/gb/en/support/contactless-limits/ (UK) | Contactless can be turned off; the tap limit does not apply to phone wallets. |
| https://www.chase.com/digital/customer-service/helpful-tips/credit-cards/desktop (US) | Lock blocks new purchases and cash advances but not scheduled payments. |
| https://www.federal.bank.in/enhanced-card-control (reference) | Online, contactless and international start off for a new card; the customer turns them on. Limits are set within a bank ceiling. |
| https://community.monzo.com/t/more-card-controls-freeze-functionality/51613 | Customers want separate online and ATM switches and merchant-type blocks. |
| https://www.eba.europa.eu/single-rule-book-qa/-/qna/view/publicId/2018_4225 (EU) | Contactless without SCA: up to 50 euro per tap, with either a 150 euro running total or five taps. |
| https://www.legislation.gov.uk/eur/2018/389/chapter/III/data.xht (UK) | UK keeps the same SCA exemptions in its own law; the UK per-tap limit is 100 pounds. |
| https://www.consumerfinance.gov/eregulations/1005-6/2016-24506 (US) | Regulation E: customer liability for an unauthorised debit depends on how fast the loss is reported. Quick freeze matters. |
| https://www.pcisecuritystandards.org/pdfs/pci_fs_data_storage.pdf | Mask card numbers; no CVV storage. |
| https://gulfnews.com/business/banking/uae-banks-to-end-sms-otps-for-online-card-payments-from-january-6-1.500396452 (UAE) | The bank may not rely on a text code alone; app approval or biometrics are the direction, so a bank may swap the code step for app approval. |
| https://bankofjordan.com/en/cards/cards-usage-parameters, https://investbank.jo/en/faqs (Jordan) | Per-card-type limits for shop, online and ATM; online limit set and changed by the customer. |
| https://www.saib.com.sa/en/node/42 (Saudi) | Online payment service is a customer setting that can be turned off in the app. |
| https://www.nfcw.com/country/jordan/ | Google Wallet with Visa cards is live in Jordan, so a wallet list is relevant there too. |

## 2. Patterns found

| Region / bank type | What the controls screen offers |
|---|---|
| US bank | Lock toggle; alerts for purchases over an amount; few other switches. |
| UK high street | Freeze (with partial options), contactless on/off, abroad on/off, ATM on/off. |
| UK / EU neobank | All of the above plus per-merchant-type blocks, spending limits, instant notifications. |
| EU retail | Online payments switch, daily limits, SCA by app. |
| UAE / Saudi | Limits per channel (POS, online, ATM), international use, merchant category blocks, travel notice not needed for most cards (international is a switch). |
| Jordan | Online limit and abroad use set per card; limits are small by default and raised by the customer. |

## 3. Standards and rules (plain English)

- **Tighten fast, loosen carefully.** Anything that makes the card safer (freeze, switch off, lower a limit, remove a wallet) takes effect at once with no code. Anything that makes it easier to use (unfreeze, switch on, raise a limit, add a trip, add a wallet) needs a one-time code. A mixed change counts as loosening.
- **Bank ceilings.** Each card product has a top value per limit. A customer cannot set above it (`LIMIT_ABOVE_CEILING`).
- **Per-purchase limit cannot exceed the daily limit, which cannot exceed the monthly limit** (`LIMIT_ORDER`).
- **Contactless.** The no-PIN tap limit is set by region and scheme (50 euro in the EU, 100 pounds in the UK). The customer can set it lower, never above the ceiling.
- **Tokens.** Removing a wallet token stops that phone only. The card keeps working. A frozen card also blocks wallet payments.
- **What a freeze does not stop.** Refunds and credits still arrive. Existing recurring payments are bank-configurable (BankWorkx® offers an option).
- **Gambling.** In UAE, Saudi Arabia and Jordan gambling merchants are blocked by law or bank policy; the app shows the category as "Blocked by your bank" rather than a switch (bank option).
- **Travel notices.** Many banks have dropped them in favour of a switch; some still use dates for fraud scoring. BankWorkx® has three modes: off, on for a trip with dates, on everywhere.
- **Restricted countries.** Sanctioned countries cannot be switched on (`COUNTRY_RESTRICTED`).
- **PCI.** The screen shows the last four digits only.

## 4. Decisions for BankWorkx® and why

1. One journey, a wizard of short steps (status, limits, where it works, merchant types, alerts and wallets, review) with a `mode` parameter so the home screen can jump straight to "Unfreeze" or "Wallets".
2. Show current value and bank ceiling next to every limit, plus today's use, so people do not guess.
3. Review screen lists only what changes, as "Before -> After", with a clear line on whether a code is needed.
4. Code is checked inside the journey (6 digits, 3 tries, then locked), only when something loosens.
5. Freeze reasons are optional chips; "Lost or stolen" shows a pointer to block and replace.
6. Gambling control only appears if the bank option "Offer gambling control" is on.
7. Alerts never need a code (they do not move money), but are shown in the receipt.
8. Wallet list shows device, wallet app, token ending, date added, status; removal is instant.

## 5. Field table

| Field | Rule | Message |
|---|---|---|
| Frozen | Card must be active (or frozen to unfreeze) | "You can change controls once the card is active." (`CARD_NOT_ACTIVE`) |
| Per purchase limit | 1 to ceiling, whole currency units or 2 decimals, not above daily | "The most this card allows per purchase is $10,000.00. (LIMIT_ABOVE_CEILING)" / "A single purchase can't be more than your daily limit. (LIMIT_ORDER)" |
| Daily purchases limit | 1 to ceiling, not above monthly | "Your daily limit can't be more than your monthly limit. (LIMIT_ORDER)" |
| Monthly limit | 1 to ceiling | ceiling message |
| Daily cash limit | 0 to ceiling (debit, and credit if the product allows) | "The most this card allows for cash is $1,500.00. (LIMIT_ABOVE_CEILING)" |
| Contactless without PIN | 0 to tap ceiling | "Tap payments without a PIN are capped at $100.00." |
| Abroad mode | Off, Trip, Everywhere | none |
| Country | Required for trip, not restricted | "We can't turn on this card in that country. (COUNTRY_RESTRICTED)" |
| Trip from / to | to not before from, at most 90 days, from not in the past | "The end date is before the start date. (TRAVEL_DATES_INVALID)" |
| Alert threshold | 1 to 100,000 | "Enter an amount above zero." |
| One-time code | 6 digits, 3 tries | "That code isn't right. 2 tries left. (OTP_INVALID)" / "Too many wrong codes. Nothing was changed on your card. (OTP_LOCKED)" |

## 6. Edge cases

- Frozen card: only unfreeze is possible; other sections read-only with the reason shown.
- Blocked, inactive, expired or replaced card: no changes; pointer to Replace or Activate.
- Raise a limit and lower another in one save: counts as loosening, code needed.
- Daily limit below what was already spent today: allowed, takes effect tomorrow (shown as a note).
- Nothing changed: Review button stays off and says so.
- Trip that overlaps an existing trip: refused (`TRAVEL_DATES_INVALID`).
- Credit card: no ATM row unless the product offers cash advance.
- Wallet token removal while the phone is offline: token is suspended at once on the bank side.
- Service down or timeout on save: nothing is saved and the screen says so.

## 7. Open questions

- Should disabling alerts count as loosening? (Current choice: no.)
- Should unfreeze be allowed after a "suspected fraud" freeze set by the bank? (Current choice: no, the customer must call.)
- Do we need separate switches for magnetic stripe? (Included for markets that still use it; bank option.)
- Is a 90-day maximum trip right for every market?
