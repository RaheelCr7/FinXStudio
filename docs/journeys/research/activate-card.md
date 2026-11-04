# Research: Activate a new card (`activate-card`)

Journey id `activate-card`. Built in `src/journeys/26-activate-card.js`.

## 1. Sources

| Source | What was taken |
|---|---|
| https://www.pcisecuritystandards.org/pdfs/pci_fs_data_storage.pdf (PCI) | The 3-digit security code and PIN must not be stored after approval, even encrypted; show no more than six and last four digits. |
| https://nextgen-docs.enfuce.com/guides/pin/change-pin (card processor) | A PIN is exactly four digits and is rejected if it is on a weak list (sequences, repeats, common patterns); the exact list is kept private. |
| https://docs.hidglobal.com/activid-cms-v6.5/operator/operator-guide/config-pin-app.htm | Example of what counts as weak: all same digit, constant step. |
| https://gulfnews.com/business/banking/uae-banks-to-end-sms-otps-for-online-card-payments-from-january-6-1.500396452 and https://nymcard.com/2025/07/24/uae-banks-to-stop-sending-otps-via-sms-and-email-what-you-need-to-know (UAE) | SMS codes are being replaced by app approval; some banks require a digital PIN before approvals. A bank may swap the code step. |
| https://www.chase.com/digital/customer-service/helpful-tips/credit-cards/desktop (US) | Activation is done in the app or by phone; the card comes with a sticker. |
| https://www.federal.bank.in/enhanced-card-control (reference) | New cards start with online, contactless and international off. |
| https://www.eba.europa.eu/single-rule-book-qa/-/qna/view/publicId/2018_4225 (EU) | Contactless counters mean the first payments after issue often need chip and PIN. |
| https://www.nfcw.com/country/jordan/, https://investbank.jo/en/faqs (Jordan) | Wallet adoption and a small starting online limit for new cards. |
| https://westpac.com.au/faq/apple-pay-device-account-number (reference) | A wallet token's last four differ from the card's last four. |

Gaps: no public pages found for Saudi activation flows; the Saudi approach (activate at a cash machine with the PIN, or in the app) is general knowledge and flagged as an open question.

## 2. Patterns found

| Region / bank type | Activation |
|---|---|
| US | Sticker on the card; call, app or website; app asks last four digits and sometimes expiry or CVV. PIN set separately. |
| UK | Activate by first chip and PIN use, or in the app / by phone. PIN is delivered separately or chosen in the app. |
| EU | First chip and PIN use at a terminal or cash machine; app activation also offered. |
| UAE | Activate in the app or at an ATM; PIN set in the app or ATM; app approval set up at the same time. |
| Saudi | ATM activation with PIN, or app. |
| Jordan | Branch, call centre or app; online use enabled separately with a limit. |

## 3. Standards and rules (plain English)

- **Security code (CVV).** Used once to prove the person has the card, never stored by BankWorkx® and never shown again. The field is hidden as you type, cleared after every attempt, and not echoed in the receipt.
- **PIN.** Four digits, not stored in readable form, not repeated back. Weak PINs refused: all same digit (1111), straight runs up or down (1234, 4321), repeated pairs (1212), the person's birth year (1990), birth day and month (0412 or 1204), the last four digits of the card number or phone number, and a short list of common ones (2580, 0000).
- **Tries.** Three wrong sets of details lock activation for the card (`ACTIVATION_LOCKED`); three wrong one-time codes end the attempt (`OTP_LOCKED`). The message never says which of the details was wrong, so nobody can guess one at a time.
- **Only activate a card in your hands.** Banks tell people not to activate a card if the envelope was open.
- **Contactless after activation.** The terminal may ask for chip and PIN once before taps work (EMV counters).
- **Tokenisation.** After activation the person can add the card to a phone wallet; it gets a token with different last four digits.

## 4. Decisions for BankWorkx® and why

1. Four steps: card (only if more than one waits), details (last four, expiry, security code), PIN (now or later), one-time code. Result with a receipt.
2. Security code is a bank option (`askCvv`). If off, last four and expiry only.
3. PIN at activation is a bank option (`pinAtActivation`); "later" is allowed and the result says so.
4. Error text is generic: "The details don't match this card" (`ACTIVATION_MISMATCH`), with tries left; lock after three.
5. Expired or past expiry date is caught on the form before it is sent.
6. Result offers the wallet and controls, because new cards start with all channels as the card product sets them.
7. The code step is inside the journey so the three-try lock can be shown.

## 5. Field table

| Field | Rule | Message |
|---|---|---|
| Card | An inactive card | "Choose the card you want to activate." |
| Last 4 digits | Exactly 4 digits | "Enter the last 4 digits printed on your card." |
| Expiry | MM/YY, month 01-12, not in the past | "Enter the expiry as MM/YY." / "That date has passed. (EXPIRY_PAST)" |
| Security code | 3 digits (4 for some Amex-style cards, not used here) | "Enter the 3-digit code from the back of the card." |
| PIN choice | Now or later | none |
| New PIN | 4 digits, not weak | "Choose a PIN that is harder to guess: no repeats like 1111 or runs like 1234. (PIN_WEAK)", "Don't use your birth year. (PIN_WEAK)", "Use exactly 4 digits. (PIN_INVALID)" |
| Repeat PIN | Same as new PIN | "The two PINs don't match." |
| One-time code | 6 digits | "Enter the 6-digit code." / "That code isn't right. 2 tries left. (OTP_INVALID)" |

## 6. Edge cases

- Card already active: told so, offered Go to cards (`CARD_ALREADY_ACTIVE`).
- Card blocked: cannot activate, offered Replace card (`CARD_BLOCKED`).
- Activation locked after 3 wrong sets of details: call the bank or wait 30 minutes (`ACTIVATION_LOCKED`).
- Security code 000 never matches in the sandbox (so a wrong code can be tried).
- Card not found or cancelled by the bank (`CARD_NOT_FOUND`).
- Service down or timeout: card stays inactive and the screen says nothing was changed.
- Person leaves before the code: nothing is activated; the security code typed is discarded.
- Replacement card activation: the old card stops working at that moment (shown on the receipt).

## 7. Open questions

- Should the security code be required at all where the bank already knows the card was delivered (tracked courier)?
- Saudi and some UAE banks expect ATM activation: do we offer "activate at any BankWorkx® ATM" as a second route?
- Should the PIN be set in the app at all where the PIN mailer exists (UK style)?
- Lock duration: 30 minutes or until the customer calls?
