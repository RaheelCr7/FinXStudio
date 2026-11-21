# Research note: Account details (`account-details`)

Release 1, Personal. Prototype build: `design/bankworkx-r1/src/journeys/21-account-details.js`. Synthetic data only.

## 1. Sources

| Source | What I took |
|---|---|
| https://monzo.com/help/account-and-profile/account-number2 | Sort code and account number are in Account Details and above the balance. |
| https://community.monzo.com/t/card-and-account-details-for-current-accounts/16184?page=4 | People asked for one share button that formats sort code and account number to avoid typing mistakes; IBAN and BIC sit under the name. |
| https://www.photonpay.com/uk/blog/article/uk-bank-codes-list | A UK IBAN is GB, two check digits, four-letter bank code, six-digit sort code, eight-digit account number. |
| https://www.consumerfinance.gov/rules-policy/regulations/1005/9/ | US Regulation E: what a transaction record and receipt must show (amount, date, type, place or party). |
| https://www.chase.com/content/dam/chaseonline/en/legacy/shared/help/page/activity_help_presentbal.htm | Pending items lower available balance before they post. |
| https://www.accountingtools.com/articles/what-is-the-difference-between-ledger-balance-and-available.html | Ledger vs available definitions. |
| https://www.legislation.gov.uk/uksi/2015/2038/regulation/10?view=plain | UK annual statement of fees. |
| https://www.eba.europa.eu/single-rule-book-qa/qna/view/publicId/2018_4177 | PSD2 account information and the 90 day SCA exemption (context for transaction history older than 90 days). |
| https://www.emiratesnbd.com/en/help-and-support/all-about-your-account-statement | UAE retail bank statement help (used for the statement shortcut). |

## 2. Patterns found

| Topic | US | UK | Europe | Middle East |
|---|---|---|---|---|
| Identifiers shown | Routing + account number; SWIFT for wires | Sort code + account number; IBAN and BIC for foreign payers | IBAN + BIC | IBAN + SWIFT; account number sometimes |
| Share details | "Copy" per field or a PDF "account verification" letter (general knowledge) | One share sheet with name, sort code, account | Copy IBAN, share as text | Share IBAN text or PDF with bank name and holder name |
| Transaction list | Pending section on top, then posted by date | Pending in feed with label | Date-grouped feed | Date-grouped, filter by type |
| Filters | Search, date range, type, amount | Search, category | Search, period | Date range, debit/credit |
| Receipt | PDF/image per transaction | Share as image | Share as PDF | Share as PDF with reference number |
| Dispute | Card-only "Report a problem" with reasons | Same, with chargeback wording | Same | Same; unrecognised card payment triggers card freeze |

## 3. Standards and rules (plain English)

- **IBAN lengths and check digits.** Mod 97 check. UAE 23, KSA 24, Jordan 30, Germany 22, UK 22. The prototype computes real check digits for its made-up numbers.
- **US routing number.** Nine digits with a checksum; used for domestic ACH and wires.
- **UK sort code and account number.** Six plus eight digits for domestic payments.
- **Regulation E (US).** Gives consumers rights to report unauthorised electronic transfers; the bank must investigate and may credit provisionally. Basis for the "I don't recognise this" reason. Time limits on the customer reporting also apply (check current text).
- **Card scheme chargebacks (general knowledge).** Reasons such as duplicate charge, wrong amount and goods not received map to the card network's dispute codes. Pending items are normally not disputable until they post.
- **PSD2.** Account data older than 90 days sometimes needs a fresh strong authentication when a third party asks; in the bank's own app the sign-in is enough.
- **Data protection.** Account details let people pay in, not take money out, but they identify the holder. Share with a warning.

## 4. Decisions for BankWorkx

| Decision | Why |
|---|---|
| Identifiers follow the account's region: US routing/account, UK sort code/account/IBAN/BIC, EU IBAN/BIC, UAE and Jordan IBAN/BIC | A payer in each country needs exactly these and no more. Never show a US account an IBAN. |
| Each identifier has its own Copy button, plus one "Share details" screen with a preview and Copy all | Monzo users asked for one formatted block; per-field copy helps forms. |
| Balances: Available big, Ledger and On hold beside it, holds listed on demand | Explains the gap without a help page. |
| Pending transactions sit at the top in their own section, labelled "not yet in your ledger balance" | Matches US and UK apps; avoids "my balance is wrong" calls. |
| Filters: search, type, pending/posted, period (with custom dates and a 24 month limit), category, amount range | Everything the brief asked for; errors show inline and the list updates as you type. |
| Transaction detail is a full screen (not a sheet) | Works the same on phone and desktop in the prototype and is easier to deep link. |
| Report a problem lists reasons that fit the transaction; pending items accept only "I don't recognise" | Matches how disputes really work and stops dead-end reports. |
| Closing is a request with reasons, where the balance goes, acknowledgements and a PIN; it is blocked while holds exist or the account is overdrawn | Banks do not close accounts instantly; the person must know what stops working. |
| Hide account removes it from overview and total; it is blocked for the last visible account | Keeps one account always reachable. |
| Rename is done inline here as well as being its own journey in the spec | 2 to 24 characters, letters, numbers, space and `& - ' .`, unique among the person's accounts. |

## 5. Field table

| Field | Rule | Message |
|---|---|---|
| Search | Free text, matches name, category, reference or amount | none |
| Period | Preset, or custom dates | none |
| From / To | To not before From; not in the future; at most 24 months | "The end date is before the start date." / "Choose a date that isn't in the future." (`FUTURE_DATE`) / "Choose a period of 24 months or less." (`RANGE_TOO_LONG`) |
| Smallest / largest amount | Numbers; smallest not above largest | "Enter the minimum as a number." / "The minimum is higher than the maximum." |
| Category, Type, Status | Select / chips | none |
| New account name | 2 to 24 chars; allowed set; unique | "Enter a name of 2 to 24 characters." (`NAME_LENGTH`) / "Use letters, numbers and spaces only." (`NAME_CHARS`) / "You already have an account called X." (`NAME_TAKEN`) |
| Report reason | Required | button disabled until chosen |
| Report note | Required for "Something else", 10 characters or more | "Tell us a little more, at least 10 characters." (`NOTE_TOO_SHORT`) |
| Pending dispute | Only "I don't recognise" or "Something else" | "This payment is still pending..." (`PENDING_NOT_DISPUTABLE`) |
| Already reported | One case per payment | "Case DSP-... was opened..." (`DUPLICATE_REPORT`) |
| Close reason / destination / acknowledgements | All required; destination only when balance above zero | button disabled |
| Close blocked | Holds, or overdrawn | `ACCOUNT_HAS_HOLDS`, `ACCOUNT_OVERDRAWN` |
| Hide | Not the last visible account | `LAST_VISIBLE_ACCOUNT` |
| Unknown account | Id not found | "We can't find that account. Choose another." (`ACCOUNT_NOT_FOUND`) |

## 6. Edge cases

- Dormant account: banner and Reactivate; letters refused until reactivated (`ACCOUNT_DORMANT`).
- Account with no transactions: "No activity yet".
- Filters that match nothing: "No transactions match these filters" with Clear.
- Closure pending: shows reference and a Cancel the request button.
- Card payment pending that later changes amount (hotel authorisation): the detail says the amount can change.
- Linked card frozen: shown with a chip; "Report a problem" can freeze the card.
- Hide-balance on: every number on the page is masked, including limits used and balance after.
- Refund shown as money in with channel "Card refund".

## 7. Open questions

1. Should a non-card payment (wrong payee transfer) open a recall request instead of a dispute? The prototype lists "I sent it to the wrong person" as a reason only.
2. How long do pending items stay before they drop off? Industry norm is a few days; the bank must set it.
3. Do we show US customers an IBAN at all if they receive foreign wires? Prototype shows SWIFT only.
4. Is closing in the app allowed for accounts with a debit card, or must the card be cancelled first?
5. Is step-up (PIN) required for sharing details, or only for closing?
