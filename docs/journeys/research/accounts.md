# Research note: Accounts overview (`accounts`)

Release 1, Personal. Prototype build: `design/bankworkx-r1/src/journeys/20-accounts.js`. Synthetic data only.

## 1. Sources

Web search quality was uneven. Items marked (general knowledge) are standard industry practice that I could not tie to one fetched page and that the bank should confirm.

| Source | What I took |
|---|---|
| https://www.accountingtools.com/articles/what-is-the-difference-between-ledger-balance-and-available.html | Ledger counts only cleared items. Available also takes off holds and adds deposits in process. |
| https://docs.tech.sofi.com/pro/docs/account-balances | A bank-platform view of balance types (current, available, pending) as separate fields. |
| https://www.business.hsbc.com.hk/en-gb/insights/managing-risk/the-new-available-balance-display-for-greater-clarity-of-funds | Available balance shown on the overview and on the payment page, so people see what they can spend. |
| https://www.chase.com/content/dam/chaseonline/en/legacy/shared/help/page/activity_help_presentbal.htm | Chase help: available balance is the part of the present balance usable now; some pending deposits are left out. |
| https://www.consumerfinance.gov/rules-policy/regulations/1005/9/ | US Regulation E: statements, and what an account record must show (balances, fees). |
| https://monzo.com/help/account-and-profile/account-number2 | UK pattern: sort code and account number sit at the top of the account and in Account Details. |
| https://www.legislation.gov.uk/uksi/2015/2038/regulation/10?view=plain | UK Payment Accounts Regulations 2015: annual statement of fees, free. |
| https://www.legislation.gov.uk/eudr/2014/92/chapter/II | EU Payment Accounts Directive: comparable fees, free yearly fee statement. |
| https://www.centralbank.ae/media/zjgijyib/cbuae-issues-new-consumer-protection-regulation_en.pdf | UAE central bank consumer protection rules apply to every licensed bank. |

## 2. Patterns found

| Pattern | US (big banks) | UK (banks, neobanks) | Europe (SEPA) | Middle East (UAE, KSA, Jordan) |
|---|---|---|---|---|
| Overview layout | Accounts grouped by type (checking, savings, cards), one balance each | One card per account, pots/savings under the main account | List, often IBAN last digits shown | List with currency, many show IBAN on tap |
| Main number | Available balance on the row; "current" inside | One balance; available if overdraft | Balance, sometimes "available" | Available balance plus ledger shown in details |
| Total balance | Often not shown across account types | Sometimes, with hide | Rarely | Common in super-apps, with per-currency totals |
| Hide balance | Eye or "hide" in some apps (general knowledge) | Common | Common | Very common (privacy culture) |
| Identifiers | Routing + account on details screen | Sort code + account at top | IBAN + BIC | IBAN (23 UAE, 24 KSA, 30 Jordan) |
| Holds | "Pending" shown in activity; available drops at once | Pending list | Reserved amounts | Hold or "blocked" amount shown |
| Multi-currency | Rare for retail | Pots, or Wise-style balances | Euro plus foreign | Very common (AED/USD/EUR/JOD) |

## 3. Standards and rules (plain English)

- **Available vs ledger.** Not a law but the same everywhere: ledger is what has cleared, available is ledger minus holds. Overdraft and payment decisions use available. Show both and say why they differ.
- **US Regulation E.** Covers electronic transfers, including how statements and error reporting work. It shapes why pending card items must be visible and why a "report a problem" path exists.
- **EU/UK payment accounts rules.** Fees must be comparable and the person gets a free annual fee statement. The overview should link to it from the account, not hide it.
- **PSD2 (EU/UK).** Strong customer authentication is needed to see account data after a period (the 90 day rule for third-party access). For the bank's own app, the sign-in covers it. Sharing the account list with other apps is a separate consent.
- **UAE consumer protection.** Banks must give clear, non-misleading information and protect customer data. This supports a hide-balance default and careful wording on shared details.
- **IBAN.** A country code, two check digits and a local number. UAE 23 characters, Saudi Arabia 24, Jordan 30, Germany 22, UK 22.

## 4. Decisions for BankWorkx

| Decision | Why |
|---|---|
| Show total balance in USD equivalent, plus a chip per currency | Adding currencies hides risk; chips show each real balance. The US-dollar total is clearly labelled "equivalent". |
| Account cards lead with Available, show Ledger underneath, and chips for holds | Matches how people decide whether they can pay; explains the gap. |
| Group by Current, Savings, Foreign currency, with a sort and filter | Works from 3 to 30 accounts. Filters are chips, sort is one select. |
| Hide-balance toggle is global and applies to totals, cards and details | One tap; every number respects it. Remembered for the session in the prototype (per device in production). |
| Quick actions on each card: Statement, Transfer, Details | The three things people do next. Buttons disappear if the bank switches the journey off. |
| Hidden accounts leave the total, with a "Hidden (n)" filter | People hide old or joint accounts; the total must not include what they chose to hide. |
| Skeleton, error and empty states are real | Banks fail on slow networks; an empty first-time user must see "Open an account". |
| Options: hide eye, foreign accounts, quick actions, sort/filter | Banks differ on all four. |

## 5. Field table

The overview has no input form; its controls are:

| Field | Rule | Message |
|---|---|---|
| Filter chip | One of All, Current, Savings, Foreign currency | none |
| Sort | One of By type, Name, Balance high to low, Currency | none |
| Show hidden | Checkbox; only shown when at least one account is hidden | none |
| Hide balance | Toggle | none |
| Load failure | Service unavailable | "We couldn't load your accounts. Nothing was changed." code `SERVICE_UNAVAILABLE`, button Try again |
| No match | Filter returns nothing | "No accounts match." button Show all accounts |
| No accounts | New customer | "You don't have an account yet." button Open an account |

## 6. Edge cases

- Account with holds larger than the ledger balance: available is negative; show it red (open question: overdraft display).
- Dormant account: shown with a chip; actions limited.
- Closure requested: chip "Closure requested"; account still counts in totals until closed.
- Only one visible account: cannot hide it (`LAST_VISIBLE_ACCOUNT`, checked on the detail page).
- Currency with three decimals (JOD): amounts show three decimals.
- Right-to-left: the same markup works because layout uses start/end.
- Very long nickname: truncated by the card; full name on the detail.

## 7. Open questions

1. Is the USD total needed at all for a customer whose home currency is AED or JOD? The prototype hard-codes USD; the bank should choose the home currency.
2. Should linked accounts at other banks (open banking) appear in the same list? The spec says yes in a second group; the prototype does not draw them.
3. Does the bank show an available balance that includes an overdraft limit? Decide before build.
4. Is the hide-balance choice stored on the device or on the profile?
