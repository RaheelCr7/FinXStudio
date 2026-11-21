# Research note: payroll-run (BankWorkx®)

Scope: net pay only (no gross-to-net). A company Maker pays employees for one pay period, sees variance against last month, and sends the run for approval. Synthetic data only; summaries in our own words. Sources were vendor guides and bank pages; confirm against regulator and bank specifications before real use.

## 1. Sources
- https://www.dib.ae/docs/default-source/wps-guidelines/wps-file-format-reference-guide_v1-1.pdf and https://www.zoho.com/en-ae/payroll/academy/compliance/wps-sif-file-format.html - UAE WPS SIF: one control record plus one employee record per person; labour card ID, IBAN, bank code, fixed and variable pay; totals must match.
- https://www.habibbank.com/uae/downloads/HBZwps_crg.pdf - another UAE bank's WPS guide (bank-specific variations).
- https://www.alrajhibank.com.sa/en/Business/Cash-Management/payroll/WPS and https://blog.zenhr.com/en/payroll-compliance-in-saudi-arabia-gosi-wps-mudad-explained - Saudi WPS via the Mudad platform, banks feed payment outcomes back; sources disagree on deadlines.
- https://www.myndsolution.com/best-practices/mudad-wps-salary-compliance-saudi-arabia/ - Saudi: file must match payroll records and not be edited after the bank produces it.
- https://asanify.com/global-employer-of-record/jordan/payroll/ and https://jordantimes.com/news/local/labour-ministry-levies-fines-firms-do-not-pay-march-salaries - Jordan: electronic payment of wages is encouraged and mandatory for some groups; I found no confirmed official WPS file spec (open question).
- https://www.hsbcnet.com/-/media/hsbcnet/client-transition/bacs-standard-18-mig-feb-2022.pdf - UK payroll is normally paid by Bacs Standard 18 on a three-day cycle.
- https://achdevguide.nacha.org/ach-file-overview - US payroll is PPD credits in a Nacha file.
- https://www.europeanpaymentscouncil.eu/sites/default/files/kb/file/2025-10/EPC132-08%20SCT%20C2PSP%20IG%202025%20V1.0.pdf and https://www.nordea.com/en/doc/mig-cap-pain-002.001.03-status-v-1.2.pdf - SEPA salary batches in pain.001 (batch booking true) and status reports.
- https://www.rbcroyalbank.com/ach/cid-212697.html - example of file duplicate checks relevant to a re-sent payroll.

## 2. Patterns found
| Region / bank type | File and rail | Cut-off and timing | Special rules | Feedback |
|---|---|---|---|---|
| US | Nacha PPD credits, ACH, same-day windows | Effective date; same-day deadlines in ET | Payroll is a batch with a company name and entry description such as PAYROLL | Return codes later |
| UK | Bacs Standard 18, three working days | Submit day 1, pay day 3; no weekends | Reference up to 18 characters, often "SALARY" plus month | Bacs reports; payslips sent by the employer |
| Euro area | pain.001 SCT, batch booking on | Next business day | Latin characters; one debit for the batch | pain.002 with reasons |
| UAE | WPS SIF through bank or exchange house | Pay within the legal window after due date | Needs employee labour card ID, IBAN, bank code; totals match | Regulator checks files |
| Saudi | Mudad payroll file; bank pays SARIE | Monthly deadline set by authority | File must match records; not changed after bank file | Bank outcome to Mudad |
| Jordan | Bank file via JoPACC or CliQ | Next business day | Spec not confirmed | Bank report |

## 3. Standards and rules (plain English)
- **Net pay only**: BankWorkx® takes the net amount per person from the company's payroll system. Tax and insurance are out of scope.
- **Pay period and pay date**: a period is a month (YYYY-MM). The pay date is a working day on or after approval. A period can only be paid once while a run is pending or paid (existing bank rule); a rejected or withdrawn run frees it.
- **Employee register**: only people on the register can be paid; each once per run; bank details come from the register, not the file.
- **Caps**: net pay may not exceed 1.5 times the monthly salary on file (existing rule). Bonus lines count towards the cap as one line each person; deductions are separate negative adjustments in the register but never create a negative payment line.
- **Bonuses and deductions as separate lines**: the run shows basic net, bonus and deduction as three line types per person; the bank pays the sum of net pay and bonus minus deduction, as one payment per employee. Deductions never make the total below zero (NEGATIVE_NET).
- **Variance check**: each person and the whole run are compared with last month; large moves are flagged (warning above 20 percent for a person, above 10 percent for the run) and need a reason from the Maker.
- **Funding check**: account balance plus pending payments must cover the total and fees on the pay date.
- **Approvals**: a payroll run always needs two different approvers, whatever the total (existing bank rule).
- **WPS (Middle East)**: a UAE or Saudi payroll needs a regulator-format file. BankWorkx® builds it from the run and shows a note; UAE SIF has a control record and employee records and totals must match to the fils.
- **Payslip notification**: optional message to each employee after payment (email or app) that says the pay arrived and where to find the payslip; no amounts in the message.

## 4. Decisions for BankWorkx® and why
1. The register is the source of truth for names, bank details and country; the Maker only edits amounts, bonus and deductions. This blocks account-change fraud.
2. Three line types (net, bonus, deduction) shown on separate rows. Auditors and employees ask "why did it change"; separate rows answer that.
3. Variance is a warning with a mandatory comment, never a hard stop, except the 1.5 times cap which is a hard stop (existing bank rule).
4. The pay date field shows the real cut-off and the rail's speed; payroll defaults to the rail that pays on the date (Bacs needs three days).
5. WPS note appears automatically when any employee is in UAE or Saudi; the run builds the file and shows its control totals (count and sum). No upload by the Maker, because edited wage files are rejected in several markets.
6. Two approvers fixed. The run counts once against limits.
7. Payslip notification is a switch the bank can turn off (`allowPayslipNotify`) and the Maker can opt out of per run.
8. Net negative, zero, over cap, missing bank details, employee on leave or terminated are the hard-error cases; late joiners and leavers get a pro-rata warning.

## 5. Field table
| Field | Rule | Message (code) |
|---|---|---|
| Pay period | YYYY-MM, not later than this month, not already started | Choose a pay period not later than this month. (INVALID_PERIOD); Payroll for {period} has already been started. (PAYROLL_ALREADY_RUN) |
| Pay date | Working day, not before today, today only before 16:00 UTC | Choose a working day. (DATE_NOT_WORKING_DAY) |
| Pay from | Company account | Choose the account to pay from. |
| Employee | On the register, once per run | Not on the company's payroll register. (NOT_AN_EMPLOYEE); This employee is already on the run. (DUPLICATE_LINE) |
| Net pay | Above zero, two decimals | The amount is not valid for this account's currency. (INVALID_AMOUNT) |
| Bonus | Zero or more, two decimals | Enter 0 or more. |
| Deduction | Zero or more, not above net plus bonus | Deductions can't be more than the pay. (NEGATIVE_NET) |
| Total for the person | At most 1.5 times monthly salary | More than 1.5 times this employee's monthly salary. (ABOVE_SALARY_CAP) |
| Variance reason | Required when the person moves more than 20 percent or the run more than 10 percent | Add a short reason for the change. (VARIANCE_REASON_REQUIRED) |
| Bank details | Present and valid in the register | Missing bank details on the register. (MISSING_BANK_DETAILS) |
| WPS control | Count and sum equal the lines | The WPS file total doesn't match the run. (WPS_TOTAL_MISMATCH) |
| Funds | Balance covers total and fees | Insufficient funds. (INSUFFICIENT_FUNDS) |

## 6. Edge cases
- Employee not on the register but in the file: left out with a reason; the Maker can request registration offline.
- Bonus only month: net zero with bonus above zero is allowed.
- Deductions larger than pay: error, not negative pay.
- Employee in a country the bank cannot reach by payroll rail: error RAIL_NOT_AVAILABLE.
- Run for an earlier period after a withdrawn run: allowed.
- Pay date on a bank holiday: moves to next working day with a note.
- Two companies with employees in both UAE and Jordan: one file per rail group; WPS file only for the UAE people.
- Re-running a month by mistake: PAYROLL_ALREADY_RUN.

## 7. Open questions
1. Is the 1.5 times cap right for bonus months? Many companies pay a 13th month.
2. Does Jordan need a regulator file? Confirm with the Central Bank of Jordan and the Ministry of Labour.
3. Should the variance threshold be set by the company or by the bank?
4. Who can see the register and the amounts (Maker only, or also HR roles)?
5. Should payslip notifications go through BankWorkx® or the payroll system?
6. UAE SIF bank-specific fields: use a single layout or one per bank?
