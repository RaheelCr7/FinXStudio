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

New journey blocks that the design needed, available to every project and listed in the AI catalog and the Studio builder: `divider` (a line with a word such as OR), `menu` rows built from a saved list (`source` and `item`), `balanceList` (read-only account rows) and `accordion` (questions that open to show answers), `hero` (logo banner), `sectionHeader` (heading with a link), `shortcuts` (icon button row), `menu` (tappable rows). `select` gained a `rows` variant, `otp` a number pad and masked digits (`keypad`, `masked`), and `toggle` a link on the same row.

Known gaps against the Figma: the bank's own typeface is not available, so the web uses open fonts picked for it (Inter for Latin, Noto Sans Arabic for Arabic, both loaded through `@fontsource`; the phone apps still use the system font), the picture-code image, the OR divider between menu rows, and a real street map (Locate us has a schematic one).

## Checked

- 29 end-to-end tests run every journey through the engine against the sandbox: happy paths, wrong password to locked, locked, expired and inactive profiles, PIN mismatch, wrong picture code, not found, already enrolled, activation block, wrong one-time code to lock, password rules, and Arabic right to left. 43 sandbox tests cover the rules.
- Every journey is lint clean, complete in Arabic, and passes the automatic accessibility test of the web renderer.

## Audit against the design frames (3 November 2026)

Every CAB sheet was compared screen by screen with its journey (content and flow, not pixels). The design has about 100 phone frames; every design screen has a journey counterpart, and the journeys add edge states the platform needs.

**Fixed (copy and small changes, English and Arabic):** password screens (labels, placeholders, "Security Requirements:" and the four rules in the design's order), the picture-code placeholder "Enter the above text here" (caption removed), sub-headers and titles as designed (Select the Legal Entity, Enter Recipient E-mail ID, Enter Phone Number, Enter Your Birth Date, Change Password, Activation Code, Enable Account Preview, Terms & Conditions, Privacy Policy), welcome menu order and wording, PIN and Biometric intro screens (the design's heading and text; two info alerts that made claims the design does not make were removed), enrolled screen button "Activate your profile", Locate us (opens on Branches, "ATM", "Select search range" with "N miles", the zip-code placeholder, result title follows the filter, details titled "Locate us"), Support hours as two rows.

**Also fixed (second pass):** *Enrol* is now two screens as designed: the entity dropdown with Continue, then "Selected Entity" (read-only) with Personal and Business rows that go straight on. *Language*: the list opens with the language in use ticked (new sandbox adapter `cab.language.selection`), the confirmation names the chosen language, No sits before Yes, and after Yes the change-language journey ends (back on sign in) with no "Language updated" screen.

**Decision, reset order:** the journey keeps the platform's order (security code first, then the new password, with a "where to send the code" step). The design shows found, Change Password, Security Code, success. The platform order was checked against the bank's platform code; revisit it only if the bank confirms the design order is the intended one.

**Also fixed (third pass):** *Default sign in* opens with the current default ticked and the design's status words under each way (Default sign in, Enabled, Generated), and the success screen is the design's banner, "Default Sign In" card with a Change link, the chosen way with its status, and the Menu > Settings note.

**Kept on purpose (not in the frames, from the platform):** locked, expired, inactive and not-found screens, the three-mistake locks, the wrong-code alerts, business banking and already-enrolled paths.

**Open: needs a decision or a new block**
- *Not modelled:* the Menu and My Accounts screens that lead to Default sign in and Account preview.
- *Found screen:* the avatar and the username dropdown are done (see below). Still open: "Sign in as" returning to the login with the username filled in (a journey can end, but cannot yet hand an answer to the next one).
- *Account preview:* the setup screen still has a Save button and a warning the design does not show. (The preview list itself is done: heading with an "As of" time, rows with a type tag, balance and note, new `balanceList` block.)
- *Locate us:* the results screen now has a **map** (new `map` block: pins on a grid by latitude and longitude, no streets or tiles, because real tiles need a map provider and its key; pressing a pin opens that place). The design opens on the map with the search bar; here the map sits above the result rows. The rest is done: search bar with "List view" and "Filters", a separate Advance Filter screen, a result list of tappable rows (a menu built from the found locations), details with the country and a single "Call us" button. The filter's empty "Services" section is not modelled.
- *Support:* the Call us dialer is now a pop-up (done). Still open: the FAQ, Terms and Privacy text taken from the design. (FAQs are now one accordion screen of six topics.)
- *Details:* the design's Account Activity answers and Privacy text are fuller than the samples here.

## Not covered, and what needs the bank

- **Frames not exported or not built:** the Web (Retail), v1.1 and SME pages, Onboarding, Activate Dormant Account, Open Additional Account, Customer Complaints and Precious Metals. The other pages in the file are the next journeys.
- **Locate us has a schematic map**, not a street map: a bank that has a map provider replaces the `MapPins` component and no journey changes.
- **Date entry** uses the new calendar block (below); it stores YYYY-MM-DD and the sandbox reads both that and the old typed DD / MM / YYYY.
- **Second factor after sign-in** (secure access code or security questions) and the legal-entity choice after sign-in appear in the platform but not in these frames, so they are not modelled.
- **Arabic copy and the support texts** (FAQ answers, terms, privacy) are drafts. The bank's content team should replace them with approved text.
- Studio's **web app** serves published journeys only; these are drafts, so the CAB project does not appear there until someone publishes.

## Pop-ups, the greeting and the map (4 November 2026)

A new **`dialog`** block (component `Dialog`) is a pop-up over the screen, shown while its `visibleWhen` is true; its buttons run actions, and it can hold a PIN field (`bind`, `length`). It is used for: the **PIN prompt** ("Enter Sign in PIN") and the **fingerprint "Unlock"** prompt on the login screen when that is the customer's default way in (each has "Use password"; a right PIN signs the remembered person in, a wrong one says so; the sandbox's PIN check now returns who signed in, and nothing for a locked or inactive profile), the **Call us dialer** on Support, and the **language confirmation** (sign in and change language) instead of a separate screen. The welcome and login screens greet the remembered person ("Welcome Nour"; nobody is greeted before activation). The Locate us results screen has the **`map`** block.

Honest limits: the fingerprint prompt is a sandbox stand-in (its Unlock button signs in with the stored PIN; a real device asks the operating system); the map has no streets. The CAB drafts in a project made before this change keep the old screens; use the catalog's *Add to project* (or the Studio copy of the journey) to get the new ones.

## Date picker, dropdown and avatar (4 November 2026)

New blocks: **`dateInput`** (a field with a calendar that opens under it; month and year step with buttons; saved as `YYYY-MM-DD`, shown as `DD / MM / YYYY`; `min` and `max` take a date or `today`; the engine checks that it is a real day and inside the range, in English, Urdu or the block's own `messages`), a **`dropdown` variant of `select`** (the browser's own select on the web, a list that opens under the field on a phone) and **`avatar`** (initials, name and a line). A new `date` template filter shows a saved date as a person writes it (`{{enroll.dob | date}}`), and `setData` now reads a value that is a whole `{{expression}}`.

In the CAB journeys: the birth date in **Enroll** and **Can't sign in** is the calendar (no future dates). The **Found** screen shows the avatar with the profile's name and username, and a username dropdown when the person has more than one (sandbox customer `nour` has `nour` and `nour.haddad`); "Sign in as" uses the chosen one. Calendar names for months and weekdays come from the device (`Intl`); a device without them shows English.
