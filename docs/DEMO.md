# Demo script: Meezan Digital and BankWorkx

One script for the whole app: **Meezan Digital** (a retail bank, with a corporate side for Acme Trading) and **BankWorkx** (Retail, as Personal, and SME, as Business, for the same login). You can follow it in the web app, in Studio, and on the iPhone Simulator. Status, decisions and the gaps are in [BANKWORKX.md](BANKWORKX.md).

Lines marked **walked 7 Nov 2026** were clicked through in a browser on that day against the code of `develop` (commit `3fd2bce`). Lines marked **docs** come from the *Checked on screen* sections of BANKWORKX.md (walked by hand on 5 and 6 Nov 2026) and are also proved by scenarios; they were not re-walked today.

## What is in the box

| | Journeys | Customers | Where |
|---|---|---|---|
| **Meezan Digital** | 8 in the catalog: 3 personal (`fund-transfer-local`, `pay-a-bill`, `convert-currency`) and 5 corporate (`corporate-payment`, `corporate-approval`, `bulk-payment`, `payroll-run`, `withdraw-a-payment`). The app bundles two (`fund-transfer-local`, `pay-a-bill`); the rest arrive from Studio | Ayesha, Bilal, Zara, Hina, Acme | `/meezan/login` |
| **BankWorkx Retail** (Personal and the public pages) | **57** | Alex Morgan (Personal), Sam Rivera (new customer) | `/bankworkx/personal/...` |
| **BankWorkx SME** (Business) | **22** | Alex Morgan as Maker at Alpha Trading LLC and Approver at Beta Services Ltd | `/bankworkx/business/<company>/...` |
| Cairo Amman Bank | 9 access journeys | its own sandbox customers | see [CAB.md](CAB.md) |

Counted from code on 7 Nov 2026: `bankworkxJourneys` has 79 journeys (57 + 22, the two modules of [journeys/README.md](journeys/README.md)); the catalog has 94 entries; the product has 96 journey definitions under 94 slugs (`bulk-payment` and `payroll-run` exist for both Meezan and BankWorkx).

## Start everything

```bash
corepack enable pnpm && pnpm install

# terminal 1: Studio, port 3100 (demo profile: no sign-in). Use `pnpm dev:lan` instead of `pnpm dev` to reach it from a physical phone
cd apps/studio && pnpm dev

# terminal 2: the web banking app, port 3200
pnpm web:dev

# terminal 3 (optional): the Expo app in a browser, port 8081
cd apps/bank-app && npx expo start --web --port 8081     # Meezan
pnpm bankworkx:web                                       # BankWorkx look

# optional: publish journeys into your local Studio (the same API the AI tools use)
cd apps/studio && npx tsx scripts/seed-journey.ts pay-a-bill   # Meezan's Pay a bill
cd apps/studio && npx tsx scripts/seed-journey.ts all          # six BankWorkx journeys (the other 73 are bundled in the app)
```

- **Studio is optional for the apps.** If it is not running, or `FINX_STUDIO_URL` points at nothing, the apps use the journeys bundled inside them. Studio is needed only to show editing and publishing.
- **Reset:** stop Studio and delete `apps/studio/.data/`. The sandbox bank lives in memory: reloading a page, or restarting the app, starts it again from the seed.
- **Do not reload a web page in the middle of a walk.** The bank starts again but the tab still remembers it was signed in. On 7 Nov 2026 a reload right after sign-in left the sign-in screen looping ("Welcome back, Alex" every time you pressed *Go to Home*); clearing the tab's session storage (or opening a new tab) fixed it.
- **The clock.** The web and phone apps use your computer's clock (scenarios and the test pin it). References carry today's date (`TRX-20261107-...`), schedules need a business day, and the payment cut-off is **16:00 UTC** (see the refusals below).
- **AI:** open this folder in Claude Code, approve the project's `finx` MCP server, then `/finx-journey <brief>`. See [AI-LAYER.md](AI-LAYER.md).

## Test customers and sign-in details

All of these are fake values from the sandbox seed (`packages/mock-bank-api/src/index.ts`, `access.ts`).

**BankWorkx** signs in with a username and password: `http://127.0.0.1:3200/bankworkx/login` (a link under the form, "Use the sandbox customer picker", or `?picker=1`, lists Alex Morgan and Sam Rivera and logs in with no password).

| Username | Person | What it shows |
|---|---|---|
| `alex.morgan` | Alex Morgan | The main demo customer. Personal, Maker at Alpha Trading LLC, Approver at Beta Services Ltd. Accounts Main ••4410 $8,720.76, Savings ••7731 $15,254.37, EUR Travel, AED Home; four cards |
| `sam.rivera` | Sam Rivera | New customer, nothing yet. The home screen guides to a first account |
| `demo.locked` | Jamie Locke | A locked profile (unlock journey) |
| `demo.expired` | Omar Nassar | Password expired: forced new password |
| `demo.inactive` | Yasmin Khoury | Not active |
| `new.user` | Noor Hayes | Temporary password: the first sign-in |
| `device.limit` | Riley Park | Already trusts five devices |

Password for every username above: **`Bwx!Demo2026`**. One-time code: **`482100`** (`000000` is always wrong, `999999` always expired). A new browser asks for the code (and offers *Trust this device*); the step-up into a company asks the password and then the code. Five wrong passwords lock a profile. Test customers behind other names (`alexbiz`, `alexempty`, `alexaccounts`, ...) are for the scenarios and are hidden from the picker.

**Meezan Digital** has no password: pick the customer on `/meezan/login`.

| Customer | Code | What it shows |
|---|---|---|
| **Ayesha** | `482100` | The happy path. Current PKR 184,250 and Savings PKR 1,250,000, daily limit 50,000, payees Ahmed Khan and Sana Malik |
| **Bilal** | `111111` | The core bank fails after the code (limit 50,000 with 40,000 used) |
| **Zara** | `123456` | KYC rejected, no accounts |
| **Hina** | `482100` | Accounts in PKR, USD, AED and KWD (convert currency) |
| **Acme Trading Co.** | `482100` | The corporate customer (corporate journeys, published from the catalog in Studio) |

## BankWorkx on the web: the guided path

Open `http://127.0.0.1:3200/bankworkx/login`. On a wide window the pages have a side menu; in a narrow one (or a phone) a bottom bar. **Work inside the app with its buttons**: typing an address in the bar reloads the page and resets the sandbox.

**1. Sign in** (walked 7 Nov 2026). `alex.morgan`, `Bwx!Demo2026`, *Continue*. On a new browser you see "Enter your code": type `482100`, *Continue*. Then "Trust this device?" (choose one; *Continue* alone says "Required"), then "Signed in" with the secure-session card, then *Go to Home*.

**2. Personal home and accounts** (walked). Home shows total balance $23,975.13 (the four accounts converted), Main $8,720.76, Savings $15,254.37, EUR Travel €2,400, AED Home AED 11,000, spending against budgets and upcoming payments. The tabs are Home, Accounts, Payments, Cards, Save & Borrow, More. Accounts, an account's details, a statement (official statement: fee shown, tick, code, fee taken after the code), renaming and hiding amounts are in the Accounts tab (docs, [slice A](BANKWORKX.md#accounts-and-the-ways-to-send-money-step-7-slice-a)).

**3. Send money with a one-time code** (walked). *Send money*, *To a BankWorkx customer*, Taylor Brooks, amount 250, *Continue*. The review reads "You're sending $250.00 to Taylor Brooks", Instant, Free. *Confirm and send code* without the tick says "Tick the confirmation first". Tick, confirm, then tap the keypad (`482100`; the keys must be tapped, typing does not fill it): "Sent", `Delivered · Ref TRX-<date>-...`. Main becomes $8,470.76 and the savings are unchanged. *To another bank* and *To another country* add rates, speeds, a new-payee check (a payee added in the last 24 hours is held to 500.00 USD) and, abroad, IBAN/SWIFT fields (docs, [Payments](BANKWORKX.md#journeys-editable-in-studio)).

**4. Cards** (docs, [slice B](BANKWORKX.md#cards-step-7-slice-b)). *Cards* shows Everyday debit ••9021, Aurora credit ••3318, Spare debit ••7745 (not activated) and the virtual card Online shopping ••6150. *Freeze* is one tap with no code ("Card frozen"). *Unfreeze* asks for the code. *Virtual card*, *Set PIN* ("Don't repeat one digit." for 1111) and *Report a problem* on a payment each end in a receipt; Replace card always asks for a code.

**5. Save and borrow** (docs, [slice C](BANKWORKX.md#save-and-borrow-step-7-slice-c)). *Save & Borrow* lists the Holiday fund goal (3,200.00 of 5,000.00), a term deposit, a loan and investments. Try a deposit under the minimum ("The smallest deposit is $1,000.00."), the loan calculator that updates as you change amount and term, and a repayment. Every move of money asks for the tick and the code; adding to a savings goal asks for no code (the money stays the customer's).

**6. Switch to Alpha Trading LLC as Maker** (walked). *Alex Morgan* in the top bar (or *Switch workspace* in the side menu) shows Personal, Alpha Trading LLC (Maker) and Beta Services Ltd (Approver). Choose Alpha: "Confirm it's you" asks the password, then the code. The Overview opens (graphite theme): Operating $480,000 and Reserve €95,200, *Waiting for approval* (PAY-2040, $18,900, "Yours"), the cut-off "16:00 UTC" and the daily limit "$18,900 of $250,000". Buttons: *Pay a supplier*, *Upload payments*, *Run payroll*.

**7. Pay a supplier** (walked). *Pay a supplier*, Harbour Packaging, 12500, reference `INV-1042`, purpose Goods, *Review*; speeds Standard (free, up to $25,000.00), Same day ($1.00), Instant ($0.25); *Review*, tick, *Send for approval*: "Sent for approval", **PAY-2042**, "Waiting for 1 approval". No code is asked below $25,000.00. Nothing leaves Operating.

**8. Alex cannot approve Alpha's payment** (walked). At Alpha the *Approvals* tab lists PAY-2040 and PAY-2042 both tagged "Yours" and offers no *Approve*. A forced approval call is refused too (see the refusals).

**9. Switch to Beta as Approver** (walked). Switch workspace, Beta Services Ltd. No new password inside five minutes. *Approvals* has a badge of 2: PAY-2039 Nimbus Logistics $64,500 ("1 of 2", in order: Lee Park, then Alex Morgan) and PAY-2041 $8,200 ("0 of 1"). Open PAY-2041: "Ready for you", "Started by Priya Nair", "Cut-off in 8h 32m" (it counts down to 16:00 UTC). *Approve $8,200.00*, tick *I checked the payee details*, approve: "Approved", "Sent to the bank", `CORP-20261103-2041`, reference `APR-<date>-0001`. As Approver, Alex has no *Pay a supplier* and sees nothing of Alpha.

**10. Back to Personal** (walked). Switch workspace, Personal: no new password, Main still $8,470.76, and no company name, supplier or amount anywhere. The test E-11 searches every Personal screen for 13 company strings.

**11. Bulk and payroll with maker-checker** (docs, [slice B](BANKWORKX.md#business-bulk-and-payroll-and-approvals-step-8-slice-b)). Back at Alpha, the *Payments* tab has *Bulk batches*: PAY-1190 *Supplier batch 19* is *Partly paid* (the fourth payment, Gulf Trade FZE, came back with "The account name didn't match."). *Fix and resend* edits the returned line, goes to the review, the tick and the code (always asked for a batch), and ends "Sent for approval" as *Resend of Supplier batch 19*; the original then shows *Resent*. *Upload payments* checks a CSV line by line (an unknown payee or a wrong account is marked, *Continue* is refused until it is fixed or removed). *Run payroll*: October is refused as already sent; for November the register has eight people in five currencies, the default run is $30,866.24, Ali Hamdan at 6,000 is "Above the maximum of $5,400.00.", Faris Qasem has "No bank details"; the review, the tick, the code, "Sent for approval", 1 approver. Nobody approves what they started.

**12. Admin and limits** (docs, [slice C](BANKWORKX.md#business-admin-and-more-step-8-slice-c)). Alex is never an administrator. At Alpha the *Admin* tab says "No access" with *Open Admin*; the lock screen offers "Preview as Ravi Menon (administrator)" (after the step-up). In the preview: the waiting change CHG-1042 (by Mina Das), nine people, *Invite user*, *Change limits* (a company daily limit of 2,500,000 is refused: "The bank's ceiling is $2,000,000.00."; 1,200,000 reads "Increase of $200,000.00", asks the code and is "Sent for approval": a second administrator must approve a raise), *Edit an approval group*. At Beta the Admin tab is the approver's view.

**13. KYB: open a business account** (docs). Sign out (the menu, *Log out*, asks "Sign out?"), and on the Landing under the sign-in open *Open a business account* (an Explore row): company, owners and directors, business, documents, tax declaration, review with two ticks, tracker. A short registration number says "Use 5 to 20 letters or digits." Other public journeys on the same Landing: loan and deposit calculators, find a branch or ATM, contact us, open an account, track an application, register for digital banking.

**14. Security and the step-up before a change** (docs, [part 2](BANKWORKX.md#signing-in-and-security-step-6b-part-2)). *More*, *Settings*, *Security* (`/bankworkx/personal/more/settings/security`): the password row, trusted devices "3 of 5", the sign-in history. *Manage* asks "Confirm it's you" first ("That password isn't right. 4 tries left."), then the code. Change password, trusted devices, quick sign-in and quick PIN need it. After five quiet minutes "Still there?" appears and then the sign-in says you were signed out; to see it fast start the web app with `NEXT_PUBLIC_FINX_IDLE_SECONDS=40 pnpm web:dev`.

**15. Studio, the same journeys.** In Studio switch the project to *BankWorkx* (sidebar). *Catalog* lists the ready-made journeys (*Try* runs one on a phone preview in BankWorkx's look, *Add to project* gives a draft). Open a journey in the Builder, rename a label and see the preview change and the chip *Unpublished changes*. Publishing and the roles are in the Meezan steps below.

## Meezan Digital: the guided path

Open `http://127.0.0.1:3200/meezan/login` and pick a customer.

1. **Run a journey**: Ayesha, *Send to beneficiary*. Try an empty *Continue* (validation), 60,000 (over the 50,000 daily limit: the limit branch), then 25,000 through consent and the code `482100`. As Bilal (code `111111`; 40,000 of his 50,000 limit is already used, so send less than 10,000) the same journey fails after the code and says so.
2. **Urdu**: tap اردو. The layout mirrors right to left.
3. **Edit live**: in Studio open the journey, select a button, rename its label (English and Urdu). The phone preview and the flow canvas update; the chip says *Unpublished changes*.
4. **Publish**: *Publish to UAT* (if it goes wrong: *Settings*, *Publish history*, *Restore* puts an earlier version back as the draft; customers see nothing new until you publish again). Reload the app home: *Live from Studio*, new version. Publishing is for a person: an AI agent never publishes.
5. **Create a journey from scratch**: *New journey*, name it, add blocks, fix any *Problems*, publish. It appears in the app's *Services* grid.
6. **From a sentence**: in Claude Code, in this folder, `/finx-journey Create a mobile top-up journey with carrier selection, an amount between 50 and 5,000, and OTP confirmation`, or start from Studio's *Agents* page, which gives you the command. The run appears on **Agents**; the draft carries an *AI draft* chip. Change one the same way: `/finx-journey Change the "Mobile top-up" journey: if the amount is more than PKR 2,000, show a warning screen before the review`. See [AI-LAYER.md](AI-LAYER.md).
7. **Catalog and rules**: *Catalog*, *Try*, *Add to project* ([CATALOG.md](CATALOG.md)); on *Send to beneficiary*'s *Amount* screen open *Next screen rules* and *Test* sample amounts ([RULES.md](RULES.md)).
8. **Who can publish**: in the sidebar's bottom corner choose *Riya Khan* (Reviewer): the Builder says *View only* and edits are refused. *Dana Lee* (Designer) can edit but *Publish* is greyed out. Back to *Alex Morgan* (Admin) to publish ([ROLES.md](ROLES.md)).
9. **The code behind a project**: *Code* in the sidebar, *Download source* ([CODE.md](CODE.md)). A new project (*Projects*, *New project*) appears at `/<its-id>/login` with its own colours, no rebuild ([PROJECTS.md](PROJECTS.md), [WEB.md](WEB.md)).
10. **Guardrails**: delete the review screen of *Send to beneficiary*. Studio flags the missing consent and refuses to publish.

## On the iPhone Simulator

Needs Xcode, CocoaPods and a Simulator (see [IOS.md](IOS.md)). Studio on 3100 is reached at `http://localhost:3100` with no setting; without it the app uses its bundled journeys.

```bash
pnpm ios:sim --brand bankworkx --install      # build BankWorkx, boot a Simulator, install and open it
pnpm ios:sim --install                        # Meezan Digital
pnpm ios:sim --brand bankworkx --install --device "iPhone 17 Pro"   # pick a Simulator
xcrun simctl launch booted com.bankworkx.app  # reopen it later (Meezan: pk.meezan.digital)
```

Options of the script (`apps/bank-app/scripts/build-ios.mjs`): `--brand meezan|bankworkx`, `--env uat|production`, `--studio-url`, `--build-number`, `--clean`, `--install`, `--device`. The same sign-in and the same walk work: `alex.morgan` and `Bwx!Demo2026`, code `482100`, then the floating tab bar for Personal and a flat bar for Business, and the same step-up and switch. Recorded in IOS.md and BANKWORKX.md: a first BankWorkx build took 1 min 27 s and rebuilds about 50 s. Android: `pnpm android:apk --brand bankworkx --install` ([ANDROID.md](ANDROID.md)).

**What was and was not run on a device.** The first four BankWorkx journeys and Invest ran on the Simulator and on an Android 14 emulator. The phone screens for the Security journeys, steps 7 and 8 (everything in the guided path above beyond sign-in and the shell) were type-checked and unit-tested, **not run on a Simulator**; I did not run the iOS build for this document. A real iPhone has not been tried.

## The refusals worth showing

- **Alex cannot approve Alpha's payment.** As Maker he sees no *Approve*, and a forced call answers `PERMISSION_DENIED` and writes a Refused row to the audit trail, for Alex and for another user id (`combined-demo.test.ts`, E-3 and E-6). With both roles, approving his own payment answers `SELF_APPROVAL` (E-8).
- **Beta's approver cannot start a payment** (E-7), and a Personal call from inside a company answers `WRONG_CONTEXT` (E-9).
- **A step-up before a company and before security changes.** Entering Alpha or Beta asks the password and then the code; it lasts five minutes (E-5). Changing a password, a PIN, a trusted device or quick sign-in asks again; the bank refuses the change without it (`STEP_UP_REQUIRED`) whatever the screen shows.
- **A code before money moves or who may be paid changes**, asked at the bank: a personal transfer, a batch (always), a payroll run (always), adding a supplier (always), a schedule or payment from 25,000.00, a card replacement or unfreeze, a contact detail, a limit or a group. Three wrong codes stop the attempt.
- **The confirmation tick** ("Tick the confirmation first", "Agree to continue.").
- **Cut-off times.** A payment due today cannot be approved after **16:00 UTC**: "The cut-off has passed. This payment can't be approved today." (`APPROVAL_EXPIRED`; the sandbox reads your clock, so run the Beta approval after 16:00 UTC to see it, or read the scenario). Changes to a schedule close at 18:00 on the business day before; Saturdays and Sundays are not business days.
- **Limits.** A new payee is held to 500.00 USD in 24 hours; Standard is limited to 25,000.00, Instant to 500,000.00; Alex's daily limit at Alpha is $250,000 (the Overview shows how much is used); two approvers above 50,000.00; the bank's ceiling for a company limit is 2,000,000.00.
- **Last administrator, last approver.** The bank refuses to disable or demote the last active administrator (`LAST_ADMIN`) or the only active approver left in a group (`LAST_APPROVER`).
- **Nothing is changed or sent when a call fails**: unavailable, slow and wrong-code screens say so and never say the action happened (E-14, E-15).

## The automated version of the guided path

`packages/bank-client/src/combined-demo.test.ts` (run with `pnpm --filter @finx/bank-client test`) is the combined Alex Morgan demo: **E-1 "passes the 13 steps"** (one sign-in, Personal, $250.00 to Taylor Brooks, switch to Alpha with the step-up, $12,500.00 to Harbour Packaging waiting as PAY-2042, forced approvals refused, switch to Beta, approve PAY-2041, back to Personal with no company data, a notice for Beta, sign out), plus E-2 to E-16, one rule each (E-6 is "a forced approval at Alpha is refused", E-11 "nothing leaks after switching back"). It pins the sandbox clock to Wed 4 Nov 2026, 10:00 UTC. **Result on 7 Nov 2026: 30 of 30 pass** (28 cases and 2 `it.fails` cases that keep two known sandbox gaps visible: a Personal payment is not recorded in Activity, and the sandbox raises no notification when a colleague starts a payment). The saved balances in the live walk above ($8,470.76, PAY-2042, `CORP-20261103-2041`) are the ones the test asserts.

## What is not built yet

From [BANKWORKX.md](BANKWORKX.md#not-built-and-known-gaps), the short version:

- **Nothing runs on its date.** There is no scheduler: a scheduled supplier payment does not start on its date, the savings-goal top-up, *Pay automatically* and a payroll pay date are saved data only, and payslips are not sent.
- **Administrators do not approve a new supplier or a schedule**; they wait ("Waiting for an administrator"). Only people, limits and approval groups have the second-administrator card.
- **No notifications are raised** (payment awaiting approval, schedule paused, card changes, message answered, budget at 80%, ...).
- **Business Overview has no 13-week cash-flow chart**, no cash in and out, no recent payments table. Retail shell screens not rebuilt: spending analysis, card detail, the Payments hub, Notification centre filters, Settings other than Security, Help, Legal, the Linked banks list.
- **Public journeys** have no sliders (an amount field with chips), no map or directions and no camera (the ID capture is simulated).
- **Engine limits:** no live redraw while typing (checks come with *Continue*), no *Copy* buttons, no file download (the page prints or the share sheet opens), no skeleton states; a journey opened from another one replaces it (`returnTo` does nothing).
- **Sign-in:** no maintenance or forced-update screens, no real biometric prompt, no offline lists.
- **Invest:** no price alerts, gains tax or real market data. BankWorkx is English only.
- **Phone:** Security journeys and steps 7 and 8 were not run on a Simulator or emulator.

## The test count

Run on **7 November 2026** at the `develop` commit **`3fd2bce`** (PR #104) with `pnpm test` (all packages, about 9 minutes; the Meezan and BankWorkx scenarios and mutation checks in `finx-mcp` take about 8 of them). **2,959 tests in 135 files, all passing.** `pnpm typecheck` (13 packages) was clean on the same commit.

| Package | Tests | Files |
|---|---|---|
| `packages/mock-bank-api` (the sandbox bank) | 791 | 30 |
| `packages/renderer-core` (the engine) | 416 | 20 |
| `packages/finx-mcp` (AI tools, scenarios, mutation checks) | 403 | 11 |
| `packages/journey-schema` | 305 | 3 |
| `packages/bank-client` (includes the combined demo, 30) | 235 | 17 |
| `packages/components` | 223 | 3 |
| `apps/studio` | 210 | 26 |
| `packages/renderer-web` | 171 | 6 |
| `packages/ui-kit` | 89 | 7 |
| `apps/bank-web` | 79 | 6 |
| `apps/bank-app` | 31 | 5 |
| `packages/codegen` | 6 | 1 |
| **Total** | **2,959** | **135** |

`packages/renderer-native` has no test script (it is type-checked). The journeys carry their own proof on top of that: for BankWorkx, counted from the journey files, Retail has 1,708 scenarios for 548 acceptance criteria and SME 642 for 179, and `finx-mcp` runs them all with the mutation check.

These figures are not updated by a script: run `pnpm test` again and copy the "Tests" line of each package to refresh them.
