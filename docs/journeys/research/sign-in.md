# Research: sign-in (BankWorkx®, Retail, Public)

Journey file: `design/bankworkx-r1/src/journeys/48-sign-in.js`. Synthetic data only. Summaries are in my own words.

## 1. Sources

| Source | What I took |
|---|---|
| https://pages.nist.gov/800-63-4/sp800-63b.html (NIST SP 800-63B-4) | Length over composition rules, no forced periodic change, block breached and common passwords, tell the person why a password was refused, phone (PSTN) codes are "restricted", offer an alternative, codes expire in 10 minutes and work once, syncable passkeys allowed at AAL2, idle timeout 1 hour at AAL2, lockout and delay ideas. |
| https://www.osborneclarke.com/insights/psd2-the-ebas-standards-on-strong-customer-authentication-where-are-we-now | PSD2 SCA basics, optional exemptions, account-information access renewed every 90 days, extended to 180 days (Reg. 2022/2360). |
| https://www.eba.europa.eu/single-rule-book-qa/qna/view/publicId/2018_4360 and the other EBA Q&A links from the same search | Trusted beneficiaries exemption; creating the list still needs SCA; exemptions are optional. |
| https://finextra.com/newsarticle/39307/fca-boosts-open-banking-by-removing-3-month-re-authentication-requirement | UK removed the 90-day SCA renewal for third-party account access; consent is renewed instead. Payments still need SCA. |
| https://www.sidley.com/en/insights/newsupdates/2021/08/ffiec-guidance-on-authentication-and-access-to-financial-institution-services-and-systems | US FFIEC 2021 guidance: risk-based, layered security; single-factor alone is not enough. (Law-firm summary, not the FFIEC text.) |
| https://gulfnews.com/business/banking/uae-banks-phase-out-sms-otps-why-in-app-banking-is-safer-how-it-works-1.500209623 and https://www.bankinfosecurity.net/uae-central-bank-tells-fis-to-drop-sms-otp-authentication-a-28589 | UAE banks moving from SMS and email codes to in-app approval, with March 2026 given as the deadline. |
| https://www.thenationalnews.com/business/money/2025/07/24/uae-banks-otp-fraud-crime/ | The National says the central bank had not issued a specific public notice, so the formal basis is not confirmed. |
| https://www.pinsentmasons.com/out-law/news/uae-banks-given-go-ahead-to-use-uae-pass-to-validate-clients-identities | UAE Pass accepted for identity at banks (used for open-account; sign-in could reuse it later). |
| https://specification.website/spec/accessibility/accessible-authentication/ and https://www.disabilityworld.org/toolkit/standards/wcag/3-3-8-accessible-authentication-minimum/ | WCAG 2.2 criterion 3.3.8: do not block paste, support password managers and `autocomplete="one-time-code"`, offer an alternative to remembering or retyping. |

## 2. Patterns found

| Topic | United States | United Kingdom | EU (PSD2) | UAE / Middle East |
|---|---|---|---|---|
| First factor | Username + password; passkeys arriving | Same; many banks use memorable info or app login | Same | Username + password or app PIN |
| Second factor | Risk-based: code on new device; SMS common, FFIEC pushes layered controls | App approval and SMS; SCA for payments | SCA at login or at payment; exemptions optional | Moving to in-app approval; SMS being retired |
| Quick login | Face ID / fingerprint, PIN | Same | Same (biometric counts as inherence) | Same, plus UAE Pass for some banks |
| Re-check cadence | Bank-set | Bank-set (90-day rule removed for open banking) | 90 or 180 days for account views | Bank-set |
| Lockout | Typically 3 to 6 failures, then call or reset | 3 to 5 | Bank-set | 3 to 5 |

## 3. Standards and rules in plain English

- **NIST 800-63B-4**: long passwords beat complicated ones. Do not force letters, digits and symbols. Do not expire passwords on a calendar. Reject known-breached and common passwords and say why. Allow 64 characters and paste.
- **PSD2 SCA (EU/UK)**: two of three (something you know, have, are) for login to payment accounts and payments. Exemptions exist but are optional. Trusted payees need SCA to be added.
- **FFIEC 2021 (US)**: assess the risk and layer controls. No single factor alone for high-risk access.
- **SMS codes**: weak against SIM swap and phishing. NIST calls them restricted. UAE banks are retiring them. Keep as an option the bank can switch off.
- **WCAG 2.2 3.3.8**: do not make people remember or retype if they could paste or use a manager.
- **Error wording**: say "username or password isn't right", never which part. Count failures for unknown usernames too.

## 4. Decisions for BankWorkx® and why

1. Order is credentials, code, forced password change, trust device, quick sign-in. The code comes before the change so a stolen password alone cannot set a new one.
2. Password rule: at least 12, up to 64, no composition rule, blocked if common, breached, containing the username or reused. Why: NIST.
3. Password expiry is a bank option (`forceExpiry`, on in the demo) because some regulators still expect it though NIST advises against.
4. SMS is an option (`allowSms`) and the default for the new-device code in the demo; "another signed-in device" is offered next to it. Why: move toward app approval without leaving people without a phone app stuck.
5. Five wrong passwords or codes lock sign-in; the person is shown "N attempts left" from the third failure and gets an unlock path. Why: balance guessing risk against support calls.
6. Resend code after 60 s, max 3 resends. Code works 5 minutes, once.
7. Trusted device lasts 90 days, max 5 devices, off for public devices. A "risk" sign-in asks for a code even on a trusted device (`riskStepUp`).
8. Quick PIN is 6 digits; refuse repeats, runs and digits of the phone number. Face ID, passkey and PIN are each bank options.
9. Quick sign-in is only offered on a trusted device.
10. Session ends after 5 minutes unused (shown on the receipt; the shell enforces it).

## 5. Field table

| Field | Rule | Message |
|---|---|---|
| Username | 3 to 40 of letters, digits, `. _ @ -` | Usernames have 3 to 40 letters, numbers, dots, dashes or underscores. |
| Password | Required, up to 128 | This is required. Wrong pair: INVALID_CREDENTIALS "The username or password isn't right. Check them and try again." |
| Remember username | Optional | – |
| One-time code | 6 digits; 000000 wrong; 999999 or older than 5 min expired | OTP_INVALID, OTP_EXPIRED |
| New password | 12 to 64; not username, common, breached, reused | PASSWORD_COMMON, PASSWORD_BREACHED, PASSWORD_REUSED, PASSWORD_CONTAINS_USERNAME |
| Confirm password | Same as new | The two passwords don't match. |
| Device name | Required if trusted, up to 30 | This is required. |
| Quick PIN | 6 digits, not weak | PIN_WEAK, "Use exactly 6 digits." |
| Locked | 5 failures | ACCOUNT_LOCKED "Sign-in is locked to protect your account. Unlock it to continue." |

## 6. Edge cases

Caps Lock on; password manager paste; expired code; resend during countdown; 4th wrong code; locked then tries again; unknown username (counts as a failure, same message); service down (engine error sheet); quick PIN wrong; device not trusted so no quick sign-in; changing channel resets the timer; forced change on first sign-in; known device with no code.

## 7. Open questions

- Does the bank want SMS off from day one in the UAE? (Source says March 2026 but is not confirmed by an official notice.)
- Exact lockout count and unlock rules per region.
- Passkey recovery when a device is lost.
- Should the receipt show last sign-in location?
- Slug names: this journey links to `forgot-password`, `forgot-username`, `register` and `unlock-account`; the retail spec still calls the first `reset-password`.
