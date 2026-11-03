# Corporate sign-in: login, pre-login, enrollment

Rebuilt from the sign-in flows of a Temenos Digital Banking R26 web workspace (committed `master`), as a FinX project called **Acme Corporate Banking** (`acme-corporate`, look "Corporate", accent #293276). Only the web app serves it today.

## What is in it
| Piece | Where |
|---|---|
| Sign-in page: welcome panel, card with username, password (show/hide), Remember me, Sign in, links, language choice with a confirm question, copyright footer | `apps/bank-web/components/corporate/Login.tsx` |
| Signed-in home (accounts) with a 5-minute idle timeout: warning at 4 minutes with a countdown, Extend session, sign-out with "Your session has expired" | `apps/bank-web/components/corporate/Home.tsx` |
| Journeys that run before sign-in: `cant-sign-in`, `enroll`, `activate-profile` (page address `/<project>/access/<slug>`) | `packages/journey-schema/src/fixtures/corporate.ts` |
| Sandbox identity services (`auth.*`) | `packages/mock-bank-api/src/auth.ts` |
| The "Corporate" look | `packages/ui-kit/src/tokens.ts`, `brands.json` |

## The flows
- **Sign in:** Sign in stays off until both fields have text. The bank's answer is shown as it comes (incorrect credentials, locked profile); the password is cleared after a failure.
- **Can't sign in:** choose Reset password, verify registered email, mobile, date of birth and a captcha, pick a username if the profile has several, set a password that meets the policy, done. A wrong captcha keeps you on the form; details that do not match give a "no match" screen and a fresh captcha.
- **Enroll:** pick the company, then tax ID, last name, date of birth and captcha. Outcomes: enrolled (username and activation code sent out of band), already enrolled, cannot enroll.
- **Activate:** username and activation code, then set a password. Blocked and expired codes have their own messages.
- A password set in can't-sign-in or activation works for sign-in afterwards (in the same browser tab session; the sandbox restarts on reload).

## Sandbox values (test data, not real people)
- Sign in: `jsmith.ops` / `Passw0rd!` (also `jsmith.fin`, `mbrown`). `locked.user` is locked.
- Captcha: the sandbox shows the characters as text (`K7M2Q`, then `R4T9X`, `B6W3N`). A real bank returns an image.
- Can't sign in: `john.smith@acme-corp.example`, `+44 7700 900123`, `1985-04-12` (two usernames).
- Enroll: `123-45-6789` / Smith / `1985-04-12` enrolls; `111-11-1111` / Brown / `1990-09-30` is already enrolled.
- Activate: `jsmith` / `ACT-4821`; `blocked.user` / `ACT-0001`; `expired.user` / `ACT-0002`.
- Password policy: 8 to 20 characters with an upper-case letter, a lower-case letter, a number and a symbol.

## Not rebuilt yet
- The advertising carousel, the app-store badges and the other four languages of the original page (English and Urdu only here; the new journeys are English only).
- The multi-step **business** enrollment wizard (company, OTP, accounts, domain, features, terms, reference number).
- The extra security variants (HID, Uniken), the legacy origination login, the open-banking consent screen, and the mobile forgot-password wizard.
- A captcha image block and a date picker: today they are a text line and a typed date (`YYYY-MM-DD`). Both are good candidates for real blocks.
- Pixel matching. The look follows the original's layout (welcome panel left, card right) and colours (navy #293276); the original's own fonts and images were not copied. The read of the original login layout came from two screens that the analysis could not fully reconcile (`frmLogin` and `frmLoginOlb`), so treat the layout as a close likeness, not a copy.
