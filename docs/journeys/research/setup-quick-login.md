# Quick sign-in set-up (`setup-quick-login`)

Summary written for BankWorkx®. Items marked (unverified) were not checked at the source.

## Sources
- https://www.enzoic.com/blog/nist-sp-800-63b-rev4/: Context for authenticators (summary)
- https://www.nationwide.co.uk/ways-to-bank/banking-app/banking-app-security: Example of an app security page

## Patterns by market

| Market | Pattern |
|---|---|
| US | Face or fingerprint toggle plus an optional PIN (unverified) |
| UK | Biometric and passcode on the app; device registration with a code (unverified) |
| EU | Biometric or app PIN after device binding (unverified) |
| Middle East | Biometric or PIN bound to the device (unverified) |

## Standards and rules
- Biometrics and PIN are device-bound shortcuts. The bank should require a strong step (code) when turning one on.
- Passkeys are an option where the bank supports them.

## Decisions for BankWorkx®
- One screen: current state of this device, then Face ID or fingerprint, passkey, PIN or Turn off. The method already on is shown as On and cannot be picked again.
- Bank options switch each method on or off.
- A code confirms turning a method on. Turning off needs none.

## Fields

| Field | Rule | Message |
|---|---|---|
| Method | One of the offered methods | Choose how to sign in. |
| PIN | 6 digits; no repeats, runs or phone digits | That PIN is too easy to guess. |
| Confirm PIN | Equals PIN | The PINs don’t match. |
| Code | 6 digits | That code isn’t right. Try again. |

## Edge cases
- Device has no biometrics: the bank option is off or the device prompt fails (BIO_FAILED).
- Changing an existing PIN goes to `change-quick-pin`.

## Open questions
- Several methods on at once? Sandbox allows one.
