# Component library (`@finx/components`)

One place that owns how things look. Every shared visual (button, text field, app bar, list row, keypad, PIN boxes) is a component here, with a web version and a phone-app (React Native) version that take exactly the same props (`src/props.ts`).

| | |
|---|---|
| `packages/components/src/web` | React DOM versions, styled by `componentsCss` |
| `packages/components/src/native` | React Native versions (`@finx/components/native`), read their look from `KitProvider` |
| `packages/components/src/specs.ts` | The catalog: for each component its purpose, props, every state worth seeing, accessibility notes and the size tokens it uses |
| `packages/ui-kit/src/components.ts` | The size tokens (field, button, bar, row, keypad heights, radii, gaps) and their defaults |

## Rules
- **One source.** A visual lives in one component. Renderers, apps, Studio and the gallery import it; nobody copies it.
- **Banks change tokens, not components.** A bank's colours, radii, bar colour and sizes are data in `brands.json` (`components` holds the sizes that differ from the defaults). A new bank needs no component code.
- **Variants are props, not forks.** If tokens cannot express a difference, the component gains a prop.
- **A new component needs** its web and native versions, a spec with states and accessibility notes. The test fails if any of these is missing.
- Presentational only: no journey, schema or bank knowledge. Props in, events out.

## In Studio
**Design** has three tabs: *Colours* (from a picture), *Sizes* (edit the tokens against a live preview, save to the bank, undo) and *Components* (every component and state, web or phone app, light or dark, left to right or right to left, with props and accessibility notes).

## Tests
`pnpm --filter @finx/components test`: every state of every component renders on web with no accessibility violations, every component has a native twin that renders in a bank's look, behaviour of the busy button, keypad and password field, and the stylesheet only reads variables the theme provides.

## Who uses it
The journey renderers draw their button, text field, menu rows, keypad and PIN boxes, and the bank-bar header of a screen, with these components (web: `renderer-web`, phone: `renderer-native`). A change here changes every journey screen. CAB's differences from the standard look (a 48px button with 8px corners, a 50px field with 10px corners, a 58px bar) are size tokens in `brands.json`, not code. Field and button corners follow each bank's own corner radii unless the bank overrides them.

## Not done yet
Blocks that still draw their own visuals: amount, select (chips, tiles, rows), cards, alerts, results, shortcuts, hero, switches, review rows, the standard (non-bar) header with its step list. Next: move those over, then the pixel comparison against the Figma frames (needs the frames exported as SVG and the bank's font), the Import tab, and more components (date picker, map, captcha, modal).
