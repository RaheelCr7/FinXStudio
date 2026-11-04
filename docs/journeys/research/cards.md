# Research: Cards home (`cards`)

Journey id `cards` (a screen in the Cards tab, not a form). Brand BankWorkx®, synthetic data only. Built in `design/bankworkx-r1/src/journeys/24-cards.js`.

## 1. Sources

| Source | What was taken |
|---|---|
| https://www.chase.com/digital/customer-service/helpful-tips/credit-cards/desktop (Chase, US) | Lock and unlock sits under account services; a lock blocks new purchases and cash advances at once; automatic payments keep working. |
| https://businesswire.com/news/home/20180927005487/en/Chase-Lets-Customers-Lock-Unlock-Credit-Cards (Chase press release) | Lock is instant and self-service, unlock is as easy once the card is found. |
| https://www.halifax.co.uk/aboutonline/card-and-pin-services/card-freezes.html and https://www.lloydsbank.com/online-banking/benefits-online-banking/card-and-pin-services/card-freezes.html (UK) | A card home that shows freeze options per card, with what a freeze does and does not stop. |
| https://www.santander.co.uk/business/support/card-controls (UK) | Separate switches for online, international and contactless on one card. |
| https://www.chase.co.uk/gb/en/support/contactless-limits/ (UK) | Contactless can be switched off in card controls; wallet payments are not bound by the tap limit. |
| https://community.monzo.com/t/more-card-controls-freeze-functionality/51613 (UK neobank) | Customers ask for per-channel controls; freeze alone is seen as too blunt. |
| https://www.federal.bank.in/enhanced-card-control (reference, India) | New cards start with online, contactless and international switched off. Used as the "safe by default" argument. |
| https://www.pcisecuritystandards.org/pdfs/pci_fs_data_storage.pdf (PCI) | Never show more than first six and last four digits; do not keep the security code. |
| https://gulfnews.com/business/banking/uae-banks-to-end-sms-otps-for-online-card-payments-from-january-6-1.500396452 (UAE) | Online card payments move to approval inside the bank app, so the app is the control centre for a card. |
| https://bankofjordan.com/en/cards/cards-usage-parameters and https://investbank.jo/en/faqs (Jordan) | Jordan banks publish usage limits per card type and keep online use as a separately enabled limit (for example JOD 350). |
| https://tweeq.sa/en/help/mobile/online-purchase and https://www.saib.com.sa/en/node/42 (Saudi) | Online use for mada cards is a setting the customer can turn on or off in the app. |

Gaps: no public help pages found for Emirates NBD or Al Rajhi card controls; their patterns are inferred from the Gulf press and the two Saudi pages above.

## 2. Patterns found

| Region / bank type | Card home pattern |
|---|---|
| US big bank | Card picture, lock toggle at the top, balance and payment due for credit, "card settings" list. Controls are few. |
| UK high street | Card picture, freeze with choice of what to freeze, contactless on/off, PIN reminder, wallet link. |
| UK / EU neobank | Big card picture, freeze as the first action, many switches (online, ATM, contactless, abroad), spending summary by category. |
| Eurozone retail | Card list with limits, online-payment switch (often off by default), 3-D Secure shown as "approve in the app". |
| UAE / Saudi | Several cards in a list (debit, credit, mada, prepaid), strong link to the app for approval of online payments, credit shows outstanding and minimum due. |
| Jordan | Card list with limits per type, e-commerce limit set separately, virtual card for online use. |

Common to all: the card is drawn as a picture with a masked number; the status is visible on the picture; the most urgent action (freeze) is one tap.

## 3. Standards and rules (plain English)

- **PCI DSS (card data rules).** An app may show at most the first six and last four digits of the card number. BankWorkx® shows only the last four. The 3-digit security code (CVV) is never stored after approval and never shown on the home screen.
- **EMV and contactless.** Contactless and chip are separate abilities of the same card. Banks let a customer switch contactless off without freezing the card.
- **PSD2 strong customer authentication (Europe).** Online payments need a second factor, and contactless can skip it only up to small amounts (50 euro per tap, with a running total or count). The UK's tap limit is 100 pounds. This is why the app shows the contactless limit next to the switch.
- **Tokenisation.** A phone wallet holds a stand-in number (a token), not the card number. The last four of the token differ from the card's last four. The home screen lists wallets so a person understands the difference.
- **US liability rules (Regulation E for debit, Regulation Z for credit).** A lost or stolen debit card costs the customer little only if reported fast (two business days for the lowest cap). The home screen therefore keeps "Freeze" and "Report lost" a single tap away.
- **UAE central bank direction.** SMS codes are being replaced by approval in the app for online payments, so the app card screen is where approvals and controls live.

## 4. Decisions for BankWorkx® and why

1. Card carousel with picture first, status on the picture, a frozen card is drawn grey with a snowflake so nobody mistakes it for a working card.
2. Freeze is instant on the home screen with no code (it only makes the card safer). Unfreeze goes through `card-controls` and asks for a code, because it makes the card easier to use.
3. Only the last four digits are shown anywhere. There is no "show full number" button on the home screen; a virtual card reveals its number in its own journey after step-up.
4. Credit cards show available credit, statement balance, minimum due and next payment date; debit shows the account it spends from and that account's balance.
5. Quick actions are buttons that start journeys (JR.btn), so they disappear if the bank switches the journey off.
6. Spending summary and recent transactions are bank options (some banks do not want them on this screen).
7. A real empty state (new customer), an error state (service down, with Try again) and a loading state.
8. The "Add a card" row (saved outside cards for add-money) is kept below the BankWorkx cards, as in the written spec.

## 5. Field table

The screen has one input: the card picker and the transaction filter. Both are buttons, not typed fields.

| Field | Rule | Message |
|---|---|---|
| Selected card | Must be one of the person's cards | "We can't find that card." (`CARD_NOT_FOUND`) |
| Transaction filter | All, Pending, Posted | none |
| Cards list | May be empty | "You don't have a BankWorkx® card yet." |
| Service | May fail | "We couldn't load your cards. Nothing was changed." (`SERVICE_UNAVAILABLE`) |

## 6. Edge cases

- Frozen card: picture greyed, controls summary still readable, only Unfreeze and Replace offered.
- Blocked or expired card: only Replace offered. Inactive card: only Activate offered.
- Credit card with no cash limit: ATM row hidden.
- Virtual card: no Virtual card action, no PIN action, no Replace (delete instead).
- Pending transaction cannot be disputed. Refunds shown in green with a plus sign.
- Amount shown in the card's currency; a purchase abroad shows the original amount as the second line.
- Wallet payments show a token ending (for example 4471), which is not the card's last four.

## 7. Open questions

- Should the home screen allow a one-tap "Report lost or stolen" that blocks permanently? (Decision pending with the replace-card owner.)
- Do we show approved-but-not-yet-posted amounts against the available credit?
- Which transaction history window does the bank want on this screen (4, 10 or 30 items)?
- Debit card on a joint account: which holder's name is on the picture?
