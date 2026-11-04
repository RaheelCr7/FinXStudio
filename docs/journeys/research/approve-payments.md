# Research: approve-payments (BankWorkx® Approvals inbox)

Synthetic data only. Summaries are in our own words. Built in `design/bankworkx-r1/src/journeys/44-approve-payments.js`.

## 1. Sources
- https://docs.ripple.com/products/payments-direct-2/user-interface/payments/payment-approvals : a maker cannot approve their own payment; approvals shown as a queue with a decision per item.
- https://omniplus.ecobank.com/GCPCW/static/en_US_WebHelpNONUS/WebHelpClient/creating_an_approval_matrix_workflow.htm : a matrix with several levels, several users per level, rules chosen by account and package.
- https://docs.oracle.com/en/industries/financial-services/banking-digital-experience/25.1.0.0.0/fxccs/pending-approval.html : pending-approval list with approve and reject, and separate "approval" and "release" flows.
- https://www.kotak.bank.in/en/stories-in-focus/accounts-deposits/current-account/bulk-payment-processing-for-businesses.html : multi-level matrix so no single employee moves funds alone; bulk approval.
- https://www.cbiuae.com/media/qzrfhfhc/cbi-corporate-electronic-banking-setup-form-april-2026.pdf : a Gulf bank's set-up form asks for an authorisation matrix and whether a maker may act alone.
- https://www.bankfab.com/v1/-/media/fabgroup/home/cib/documents/fab-ibanking-form.pdf : a transaction authorisation matrix section on a Gulf corporate form.
- https://www.natwest.com/business/frequently-asked-questions/banking-from-home/make-payments/what-is-confirmation-of-payee-and-how-does-it-work.html : UK name check outcomes (match, close match, no match, unavailable) shown before paying.
- https://www.eba.europa.eu/node/6697 and https://pymnts.com/?p=690988 : EU PSD2 secure corporate payment exemption; dynamic linking applies to remote payments and the bank must keep its own risk case.
- Gaps: no public Saudi or Jordan guides found; the sequential-versus-parallel wording comes from our own seed rules (docs/journeys/02-sme.md), not a public source.

## 2. Patterns found
| Pattern | US | UK | Europe | Middle East |
|---|---|---|---|---|
| Maker-checker | Common; own payment blocked | Common | Common | Set-up form states if a maker may act alone |
| Matrix by value band | Yes | Yes | Yes | Yes (matrix on the application form) |
| Order of approvers | Levels (sequential) or any N of a group | Same | Same | Same, group-based |
| Payee name check before approve | Rare (bank-specific) | Confirmation of Payee | Verification of Payee (rolling in) | Emerging |
| Step-up on approve | Token or push on high value | Token or app | Strong customer authentication; corporate exemption possible | Token or SMS |
| Batch approval | Yes, with a total shown | Yes | Yes | Yes |

## 3. Standards and rules
- Dual control (maker-checker): the person who prepares a payment is never the person who releases it. We call the refusal SELF_APPROVAL.
- Approval matrix: rules that say how many approvers, from which group, for which value band and account.
- Sequential group: approver 1 then 2; parallel group: any order. The inbox shows who is next.
- Strong customer authentication (PSD2): approving a remote payment is a security-sensitive act, so the amount and payee must be shown on the screen where the code is entered (dynamic linking). A bank may use the corporate exemption instead if it has the approved risk case.
- Name check (UK Confirmation of Payee, EU Verification of Payee): a result of match, close match, no match or unavailable. It never replaces approval.
- Cut-off: the bank's last time to release a payment for the day. Unapproved payments lapse; the maker restarts them.
- Audit: who, what, when, from where, and the outcome of every attempt, including refusals.

## 4. Decisions for BankWorkx® and why
1. Inbox plus detail on one screen (split on desktop, list then detail on phone): approvers decide in seconds when the facts are beside the list.
2. The detail always shows payee and account, both currencies, purpose, rail, supporting documents, name check, risk flags, signatory progress and the audit. These are the things a checker must see.
3. Close match or no match needs a tick that the approver checked with the supplier (NAME_CHECK_ACK) and is left out of batches. Reason: a name warning must not be approved in a hurry.
4. Step-up from 25,000.00 (option); one code covers a whole batch. The code prompt names the total, so the code is tied to the amount.
5. Reject needs a reason from a list; "Other" needs 10 characters. "Ask for changes" keeps earlier approvals. Reason: the maker needs something to fix.
6. Delegation is per payment, not a role change, and never to the maker or someone who already approved. Reason: keeps dual control while someone is away.
7. Expiry at 16:00 UTC is shown as a countdown, then as a state, with a Demo switch to see it.
8. Bank switches: batch, step-up, ask-for-changes, delegate.

## 5. Field table
| Field | Rule | Message |
|---|---|---|
| Approve | Role has pay.approve | Refused by the bank: your role here can't approve payments. (PERMISSION_DENIED) |
| Approve | Not the person who started it | You started this payment, so you can't approve it. (SELF_APPROVAL) |
| Approve | Not already approved by you | You have already approved this payment. (ALREADY_APPROVED) |
| Approve | Sequential: earlier signer first | This payment needs an earlier approver first. (OUT_OF_SEQUENCE) |
| Approve | Before 16:00 UTC | The 16:00 UTC cut-off has passed. (APPROVAL_EXPIRED) |
| Approve | Not in "changes requested" | Changes were requested. (CHANGES_REQUESTED) |
| Name check tick | Required on close or no match | Confirm that you checked the details with the supplier. (NAME_CHECK_ACK) |
| Security check | Amount from 25,000.00 | Code entry; STEPUP_FAILED if wrong |
| Reject reason | One of 7; Other needs 10+ characters | Choose a reason. (REASON_REQUIRED) |
| Change note | 10 to 300 characters | Tell the maker what to change. (NOTE_REQUIRED) |
| Delegate to | Not the maker, not an earlier approver | DELEGATE_CONFLICT, DELEGATE_ALREADY_APPROVED |
| Filters | status, amount band, submitter, rail, due today | no match shows "Nothing matches" |

## 6. Edge cases
Payment started by the approver; second approver is earlier in a sequential chain; approval arrives after 16:00 (also exactly 16:00 counts as in time in the sandbox); maker resubmits after changes requested; batch with one ineligible item (others still go); batch containing a 25,000.00 or more item (single code); foreign currency payment (rate shown, payee receives EUR); no supporting document (warning, not a block); service down (SERVICE_UNAVAILABLE, nothing approved); delegate approves, original approver's name stays in the audit.

## 7. Open questions
- Should "Suspected fraud" notify the bank's fraud team automatically?
- Is delegation by time window (several days) allowed at some banks without an admin?
- Which banks require a token, not a push, for batch approval?
- Does the bank want a second approver to see the first approver's note?
