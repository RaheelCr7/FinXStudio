# Research: savings-goal

BankWorkx® Retail, Save & Borrow. Prototype: `design/bankworkx-r1/src/journeys/65-save-borrow.js` to `68-invest.js`. Synthetic data. Checked 4 Nov 2026 from search summaries only; unconfirmed points are marked.

## Sources
- No web source read for this journey; written from general knowledge of retail banking apps. Not verified.

## Patterns by market and rules
| Market | Note |
|---|---|
| United States | See text below; not separately verified unless stated. |
| United Kingdom | See text below. |
| Europe | See text below. |
| Middle East | See text below. |

Goal pots are labels over the customer's own money. Decision: name, target, month-end date, optional monthly top-up (also listed in scheduled payments); add and take-out need no code because the money stays the customer's; at most 10 goals.

## Fields
| Field | Rule | Message |
|---|---|---|
| Name | 2 to 30 characters | Use 2 to 30 characters. |
| Target | 50 to 1,000,000 | The smallest target is $50.00. |
| Withdraw | at most saved | You only have {saved} in this goal. |

## Edge cases
Account frozen or short of money; service timeout on submit (check Activity before retrying); a failed code changes nothing.

## Open questions
Not verified online. Open: auto-close an empty goal.
