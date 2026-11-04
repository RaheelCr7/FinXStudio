# Research: open-account (BankWorkx®, Retail, Public)

Journey file: `design/bankworkx-r1/src/journeys/49-open-account.js`. Synthetic data only. Summaries are in my own words.

## 1. Sources

| Source | What I took |
|---|---|
| https://www.law.cornell.edu/cfr/text/31/1020.220 and https://www.fdic.gov/news/financial-institution-letters/2024/fil24015a.pdf | US Customer Identification Program: name, date of birth, address, identification number; verify within a reasonable time; check government lists; give the customer notice. |
| https://www.pinsentmasons.com/out-law/news/aml-guidance-digital-id-providers and https://www.gov.uk/government/publications/identity-proofing-and-verification-of-an-individual/how-to-prove-and-verify-someones-identity | UK JMLSG accepts digital identity with biometrics from accredited providers; GOV.UK identity-proofing guidance (GPG45). |
| https://pwcplus.de/en/article/234620/eba-publishes-guidelines-on-remote-customer-onboarding-eba-gl-2022-15 | EBA remote onboarding guidelines (apply from 2 Oct 2023): technology neutral, testing and quality assurance. |
| https://www.springlex.eu/en/packages/aml/amlr-regulation/article-20/ | EU AML Regulation 2024/1624 customer due diligence: identify and verify, understand the relationship and source of funds where necessary. Applies from July 2027 per secondary sources. |
| https://www.pinsentmasons.com/out-law/news/uae-banks-given-go-ahead-to-use-uae-pass-to-validate-clients-identities and https://www.emiratesnbd.com/en/media-center/emirates-nbd-integrates-website-with-uae-pass-for-seamless-digital-account-opening | UAE Pass accepted by banks; physical check of the Emirates ID no longer needed; Emirates NBD opens accounts with UAE Pass. |
| https://didit.me/blog/nafath-integration/ | Saudi Nafath (national sign-on keyed to National ID or Iqama); SAMA circular on high-assurance biometrics (vendor source, unverified). |
| https://www.jopacc.com/ekyc-project and https://www.petra.gov.jo/ar/index.php/en/news/cbj-adopts-digital-id-for-customer-verification and https://shuftipro.com/compliances-reports/Shufti-Jordan-Compliance-Report.pdf | Jordan: CBJ eKYC instructions 7/2021, AML law 20/2021, Sanad digital ID accepted, national number required. |
| https://wiki.private.law/en/fatca-crs-self-certification and https://uae.nbo.om/en/Download%20Documents/FATCA-CRS-Self-certification-Form-UAE.pdf and https://crs.hsbc.com/-/media/crs/pdfs/uk/crs-i-self-certification-form-uk.pdf | W-9 for US persons, W-8BEN for non-US individuals; CRS self-certification with TIN or reason A, B, C. |

## 2. Patterns found

| | United States | United Kingdom | EU | UAE / Middle East |
|---|---|---|---|---|
| Legal driver | CIP rule, BSA/AML, FATCA | MLR 2017, JMLSG, FCA | AMLD (AMLR from 2027), EBA remote onboarding | CBUAE AML rules; SAMA; CBJ 7/2021 |
| Identity number | SSN or ITIN (passport number for non-US) | NI number optional | National tax ID (CRS) | Emirates ID; Saudi ID/Iqama; Jordan national number |
| ID document | Driver's licence, passport, state ID | Passport, photocard licence, eVisa | National ID card, passport, residence permit | Emirates ID, passport; or UAE Pass / Nafath / Sanad |
| Liveness | Common | Common (digital ID providers) | Required in good remote solutions | Required |
| Proof of address | Usually none (database check) | Electronic check, document if it fails | Electronic or document | Often needed (tenancy, utility bill) |
| Tax form | W-9 or W-8BEN + CRS-style questions | CRS self-certification | CRS self-certification | CRS self-certification, TIN reasons common |
| Deposit protection | FDIC $250k | FSCS £85k | €100k national scheme | UAE none; KSA and Jordan have funds |

## 3. Standards and rules in plain English

- **US CIP**: collect name, date of birth, home address and an ID number before opening; verify; screen against government lists; tell the customer why.
- **FATCA / CRS**: banks ask where you pay tax. US persons give a W-9 with their US number. Others give a W-8BEN. Under CRS you give your tax ID for each country, or a reason (A: country issues none, B: you cannot get one, C: not required).
- **EU/UK customer due diligence**: prove who you are, understand what the account is for, ask where the money comes from when risk is higher. Politically exposed persons need extra checks.
- **Remote onboarding**: ID capture and liveness must be reliable and tested; the bank decides how.
- **Biometric consent**: GDPR (EU, UK) treats face data as special data; ask explicit consent and say how long it is kept. Illinois BIPA similar in the US.
- **Tipping off**: never tell a person they hit a sanctions or fraud check. The journey says "We can't open this account online."

## 4. Decisions for BankWorkx® and why

1. Region comes first because it decides every later field and law. Four regions, each a bank option.
2. Minimum age 18 everywhere (open question for 16 to 17 youth accounts).
3. Date of birth uses three dropdowns, so no format confusion (MM/DD vs DD/MM).
4. US: SSN, ITIN or passport number (option). UK: NI number optional. EU: country tax ID checked per country. Middle East: national ID checked (Emirates ID with checksum and birth year match).
5. Tax questions in one step, with a US-connection question outside the US and a second tax country with reason codes.
6. Source of funds always asked; source of wealth only for top income or large deposits; politically exposed person answer sends the file to manual review (option).
7. ID simulations: clean, blurry (retake), expired (use another), name mismatch (continue, manual review).
8. Selfie liveness: pass, too dark, spoof, face differs (manual review). Explicit consent and a non-face alternative (branch or video call).
9. Digital ID shortcuts (UAE Pass, Nafath, Sanad) are options; they skip photographing the ID, not the selfie.
10. Proof of address only in the Middle East; others use the database check.
11. Draft is saved when the person leaves; photos are not stored in the draft and are taken again; resume lands at the saved step or the ID step, whichever is earlier. Drafts keep for 30 days.
12. Tracker: received, ID check, manual review (only when needed), approved, account ready. Manual review is described as normal, with a time estimate.

## 5. Field table (main fields)

| Field | Rule | Message |
|---|---|---|
| Region / country | Required | This is required. |
| First, last name | Letters, spaces, hyphen, apostrophe, up to 40 | Use letters only. Hyphens and apostrophes are fine. |
| Date of birth | Real date; age 18+ | That date doesn't exist. / UNDER_AGE |
| Emirates ID | 784 + 12 digits, Luhn check, year = birth year | EID_INVALID, EID_DOB_MISMATCH |
| Saudi ID / Jordan number | 10 digits (Saudi starts 1 or 2) | NID_INVALID |
| Email | Basic format | Enter an email like name@example.com. |
| Mobile | By country | PHONE_INVALID |
| Address line 1 | No PO box | ADDRESS_PO_BOX |
| ZIP / postcode | By country | POSTCODE_INVALID |
| SSN | 9 digits, area not 000, 666, 9xx; group not 00; serial not 0000 | TIN_INVALID |
| ITIN | 9 digits, starts 9, valid middle range | TIN_INVALID |
| NI number | Valid prefix, 6 digits, A to D | NI_INVALID |
| EU tax ID | Per country pattern | TIN_INVALID |
| Tax self-certification | Must be ticked | This is required. |
| ID photos | Not blurry, not expired | ID_UNREADABLE, ID_EXPIRED |
| Selfie | Live and matching | LIVENESS_LOW_LIGHT, LIVENESS_FAILED |
| Proof of address | Under 3 months | POA_TOO_OLD |
| Terms, privacy, e-delivery, truth | All ticked | This is required. |

## 6. Edge cases

Under 18; impossible date; PO box; second tax country with no ID; politically exposed person; mismatched name on ID or proof of address; expired ID; spoofed selfie; digital ID declined (surname Declined); duplicate application (duplicate@example.com); blocked person (surname Blocked, neutral wording); person leaves midway and returns; service down on submit (answers kept); joint account second holder; product page for a loan or card (told to open an account first).

## 7. Open questions

- Minimum age in the UAE and for youth accounts (16 to 17) per region.
- Whether UAE deposits are covered by any scheme at launch; Saudi and Jordan limits quoted from memory, confirm.
- Does the bank do the electronic database check itself or via a provider, and what happens when it fails for UK and EU?
- US states with different age of majority (19 or 21).
- How long ID images are kept (30 days assumed).
- Link to `track-application`: the open-account journey exposes `OA.app` so a tracker screen can read the latest application.
