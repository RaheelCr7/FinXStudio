# Research: Create a budget (`create-budget`)

Built in the file named in the journey header. Marked (unverified) where a source did not confirm a point.

## 1. Sources

- https://monzo.com/blog/2017/03/31/budget-targets and https://monzo.com/blog/2018/08/21/budget-with-monzo : monthly target per category, alerts when close or over; budgets advise, they do not block spending (UK).
- https://community.monzo.com/t/set-start-of-month/1144 : customers ask for payday-aligned months.
- US and Middle East: no source read in this run for budget tools in bank apps (unverified).

## 2. Patterns by market

| Market | Pattern |
|---|---|
| UK neobank | Monthly target per category, notification when close or over. |
| US bank | Spending summaries and alerts; fewer per-category budgets (unverified). |
| Europe / Middle East | Category budgets in aggregator style apps (unverified). |

## 3. Standards and rules (plain English)

- A budget moves no money, so no code is needed. It is advice, not a block.
- Spending is counted in the home currency.

## 4. Decisions for BankWorkx® and why

- Monthly amount only, alerts at 80% and 100% as two toggles (the percent steps were not confirmed at any bank, they are a product choice).
- One budget per category.
- Edit and delete use the same journey with a budget id; progress bars show spending of the last 30 days from the current account and journey payments.
- Bar colour changes at 80% and 100%, and a chip says it in words.

## 5. Fields

| Field | Rule | Message |
|---|---|---|
| Category | Required, not one that already has a budget | Choose a category. |
| Amount per month | 10 to 100,000, 2 decimals | The smallest budget is $10.00. / The most is $100,000.00. |
| Alerts | Optional toggles | - |

## 6. Edge cases

- No spending in a category: bar empty, chip On track.
- Spending over the amount: bar full, chip Over budget.
- Deleting the last budget shows the empty state.

## 7. Open questions

- Calendar month versus rolling 30 days: the prototype uses 30 days because the sandbox date is early in the month.
