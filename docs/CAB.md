# CAB (Cairo Amman Bank): access journeys

The CAB project was made from the bank's Figma file "CAB – Retail Banking" (mobile, authentication and pre-login). It is a Studio project like Meezan and BankWorkx: its own name, colours (`#00853E`), currency (**JOD**) and sandbox customers. Nine journeys were built from the frames, **as drafts: nothing is published**.

| Journey | What it covers (from the design) |
|---|---|
| `sign-in` | Welcome choices, username and password, attempts left, then locked, password expired and profile-not-active screens |
| `default-sign-in` | Choose password, biometric or PIN; PIN entered twice (six digits) |
| `account-preview` | Settings toggle and the balances shown before sign-in |
| `change-language` | Language list and the confirmation step |
| `enroll` | Enrol from last name, national ID and date of birth with a picture code; not-found, already-enrolled and business paths |
| `activate-profile` | Username and activation code (blocks after 3 mistakes), create password under the bank's rules |
| `cant-sign-in` | Legal entity, email and picture code, phone, date of birth, "we found you", one-time code (locks after 3 mistakes), new password; or a new activation code |
| `locate-us` | Branch / ATM / all, search range, text search, results, details with call |
| `support` | FAQs by topic, terms, privacy, call us |

English and Arabic (right to left). The journeys are in the catalog under **Access**; the CAB project added them with *Add to project* (drafts).

## How it behaves like the bank's platform

The behaviour was checked against the bank's digital banking platform code (read-only): sign-in outcomes and error codes (wrong password 10095, locked 10088, expired 10135, not activated 10092), the three-mistake lock with a 30-minute wait, a picture code before enrolment and recovery, a one-time code for password reset, **server-side password rules** (at least 8 characters, at least 5 different characters, at most 100, must not contain the username), and an activation code that blocks after three mistakes. The sandbox returns these outcomes as data (`{ ok: false, code }`) so a journey routes on them; only misuse throws.

## Sandbox customers (`packages/mock-bank-api/src/cab.ts`)

| Customer | Use it to see |
|---|---|
| `nour` (active) | Sign in (`nour` / `Cab@Secure123`), default sign-in, preview, language, can't-sign-in (email `jeyose8168@cab.com`, phone `34 56 78 90`, born `01/01/2001`), one-time code `482100` |
| `sara` (new customer) | Enrol with the design's details (Hegazy, `194324`, `01/01/2001`) |
| `yasmin` (enrolled, not activated) | Activate (`yasmin` / `ACT-4821`), the inactive sign-in screen, "send a new activation code" |
| `lina` (locked) | The locked screen |
| `omar` (password expired) | The expired screen |

These are sandbox test values only. The picture code is shown on screen in the sandbox so a person can type it.

Adapters are named `cab.*` (22 of them, listed with inputs and outputs in the adapter catalog the AI tools read). A project's own customers are used instead of its look's customers (`personasFor(preset, projectId)`).

## How it looks like the design

A bank can carry a **look** in `packages/ui-kit/src/brands.json`: a coloured app bar with a back arrow and a close button, a rounded sheet on a light page, outlined fields, the bank's logo and font. CAB's look is taken from the Figma export (bar colour #00853E, logo cropped from the exported frames for this project only). Both renderers, the phone app and the web app, draw it from the same definition, so a screen is built once.

New journey blocks that the design needed, available to every project and listed in the AI catalog and the Studio builder: `hero` (logo banner), `sectionHeader` (heading with a link), `shortcuts` (icon button row), `menu` (tappable rows). `select` gained a `rows` variant, `otp` a number pad and masked digits (`keypad`, `masked`), and `toggle` a link on the same row.

Known gaps against the Figma: the bank's own typeface is not loaded, the map on Locate us, a date picker, the picture-code image, the OR divider between menu rows, and the language confirmation as a pop-up (it is a screen).

## Checked

- 29 end-to-end tests run every journey through the engine against the sandbox: happy paths, wrong password to locked, locked, expired and inactive profiles, PIN mismatch, wrong picture code, not found, already enrolled, activation block, wrong one-time code to lock, password rules, and Arabic right to left. 43 sandbox tests cover the rules.
- Every journey is lint clean, complete in Arabic, and passes the automatic accessibility test of the web renderer.

## Audit against the design frames (3 November 2026)

Every CAB sheet was compared screen by screen with its journey (content and flow, not pixels). The design has about 100 phone frames; every design screen has a journey counterpart, and the journeys add edge states the platform needs.

**Fixed (copy and small changes, English and Arabic):** password screens (labels, placeholders, "Security Requirements:" and the four rules in the design's order), the picture-code placeholder "Enter the above text here" (caption removed), sub-headers and titles as designed (Select the Legal Entity, Enter Recipient E-mail ID, Enter Phone Number, Enter Your Birth Date, Change Password, Activation Code, Enable Account Preview, Terms & Conditions, Privacy Policy), welcome menu order and wording, PIN and Biometric intro screens (the design's heading and text; two info alerts that made claims the design does not make were removed), enrolled screen button "Activate your profile", Locate us (opens on Branches, "ATM", "Select search range" with "N miles", the zip-code placeholder, result title follows the filter, details titled "Locate us"), Support hours as two rows.

**Kept on purpose (not in the frames, from the platform):** locked, expired, inactive and not-found screens, the three-mistake locks, the wrong-code alerts, business banking and already-enrolled paths.

**Open: needs a decision or a new block**
- *Reset order.* The design goes found, Change Password, Security Code, success. The journey follows the platform: code first, then the new password, with a "where to send the code" step the design does not have. Confirm with the bank which is right.
- *Enrol.* The design splits the entity into two screens (a dropdown with Continue, then "Selected Entity" read-only with Personal and Business rows that go straight on). The journey has one screen.
- *Not modelled:* the login-time PIN modal and the biometric "Unlock" modal, the "Welcome Nour" remembered-user greeting, the Menu and My Accounts screens that lead to Default sign in and Account preview.
- *Default sign in:* the list should tick the current default with the status words (Default sign in, Enabled, Generated), and the success screen should show the Default Sign In card with a Change link.
- *Found screen:* username dropdown, avatar, an OR divider, and "Sign in as" returning to the login with the username filled in.
- *Account preview:* the sign-in list shows an "As of" time, a type pill and "Available balance" per row and is not selectable; the setup screen has no Save button or warning.
- *Language:* the confirmation should name the chosen language, the current one should be pre-selected, No sits left of Yes, and after Yes the flow returns to sign-in (no "Language updated" screen).
- *Locate us:* map first, with a search bar, "List view" and "Filters" buttons, a separate filter sheet with a Services section, tappable result rows, details with the country and one primary button.
- *Support:* FAQs as one accordion screen, the Call us dialer as a pop-up, and the FAQ, Terms and Privacy text taken from the design.
- *Details:* the design's Account Activity answers and Privacy text are fuller than the samples here.

## Not covered, and what needs the bank

- **Frames not exported or not built:** the Web (Retail), v1.1 and SME pages, Onboarding, Activate Dormant Account, Open Additional Account, Customer Complaints and Precious Metals. The other pages in the file are the next journeys.
- **Locate us has no map.** The design shows a map; journeys have no map block yet, so the journey offers filters, a list and details.
- **Date entry** is typed as DD / MM / YYYY; there is no date picker block yet.
- **Second factor after sign-in** (secure access code or security questions) and the legal-entity choice after sign-in appear in the platform but not in these frames, so they are not modelled.
- **Arabic copy and the support texts** (FAQ answers, terms, privacy) are drafts. The bank's content team should replace them with approved text.
- Studio's **web app** serves published journeys only; these are drafts, so the CAB project does not appear there until someone publishes.
