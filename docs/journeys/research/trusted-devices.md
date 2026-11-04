# Trusted devices (`trusted-devices`)

Summary written for BankWorkx®. Items marked (unverified) were not checked at the source.

## Sources
- https://www.schwab.com/content/how-to-manage-trusted-devices: Untrust a device so it needs two-step verification again
- https://www.nationwide.co.uk/ways-to-bank/banking-app/banking-app-security: Manage devices, forget this device, remove old devices
- https://www.openbank.us/help-and-contact/how-do-i-remove-block-or-unblock-my-trusted-mobile-device: View, remove, block trusted mobile devices

## Patterns by market

| Market | Pattern |
|---|---|
| US | List with Untrust or Remove; next sign-in needs verification |
| UK | Security > Manage devices > Forget this device |
| EU | Device list in security settings (unverified) |
| Middle East | Device registration list (unverified) |

## Standards and rules
- Removing a device only means it must verify again. Lost devices should be removed fast.

## Decisions for BankWorkx®
- A view: devices with last used and a This device chip. Remove asks for a code. Sign out other devices removes every other device, with a code.
- Bank options: limit to 5 devices, offer Sign out other devices.
- This device cannot be removed here.

## Fields

| Field | Rule | Message |
|---|---|---|
| Code | 6 digits; 3 wrong lock the screen | That code isn’t right. 2 tries left. |

## Edge cases
- Only this device: nothing to remove.
- Service down: banner and nothing changed.

## Open questions
- Do trusted devices and active sessions need separate lists?
