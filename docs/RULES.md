# Rules in the Builder

A rule decides whether something applies: whether a block is shown, or which screen comes next. In the Builder you write rules as sentences. Underneath they stay the same safe expressions the engine already runs.

## Where rules are

- **Block → Show this block when**: leave it with no condition to always show the block.
- **Screen → Next screen rules → Rule**: the first rule that matches when a button navigates decides the next screen. A rule with no condition always matches.

## Editing

- Each line is a condition: *data*, *comparison*, *value or data*. The data field suggests every path the journey declares (its data model, saved API results and `setData` paths). On the right you can type a number, yes or no, text, or another data path, such as `ctx.limits.daily`.
- Comparisons: is, is not, is more than, is at least, is less than, is at most, is empty, has a value, is yes, is no.
- More than one condition: choose **and** (all must hold) or **or** (any one is enough). One rule uses one of the two.
- The line under the rule reads it back in plain words.
- **Edit as text** shows the expression itself, for example `transfer.amount > ctx.limits.daily - ctx.limits.usedToday`. Rules with brackets, `? :`, or a mix of and/or stay text only, and the form says so.
- A rule that does not parse shows the error under it, and Studio will not publish a journey with one.

## Test

**Test** opens a box per data path the rule reads. Type sample values (numbers, `true`/`false`, or text) and it says whether the rule applies, using the same evaluator as the app.

## Notes

- Text typed on the right is quoted for you, unless it is a number, yes/no, or a data path the journey knows. To compare with a path that does not exist yet, edit as text.
- Parsing and printing live in `apps/studio/lib/rules.ts` with tests in `rules.test.ts`.
