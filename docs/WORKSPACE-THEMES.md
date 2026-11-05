# Workspace themes

A bank with a Personal side and a Business side can give each its own look. The bank decides how: colour, base look, corners, component sizes and appearance are **data** under the bank's entry in `packages/ui-kit/src/brands.json`, never code in a component. BankWorkx ships two as an example: **Aurora** (Personal: blue and white, light and airy) and **Graphite** (Business: green and charcoal, dense and professional). Their design comes from the approved BankWorkx prototype.

The runtime cross-fade when the customer switches workspace belongs to the shell work (plan step 5). This page is about what a workspace looks like and how a bank sets it.

## The data

```json
"bankworkx": {
  "accent": "#3155CE", "preset": "bankworkx",
  "workspaces": {
    "personal": { "name": "Aurora", "preset": "bankworkx", "accent": "#2F5BFF", "mode": "light",
                  "look": { "pageBg": "#F3F6FF", "hero": { "from": "#2F5BFF", "to": "#6A4DF0" } },
                  "radius": { "sm": 12, "md": 16, "lg": 24, "xl": 28 },
                  "components": { "field": { "height": 54 }, "row": { "height": 62 } } },
    "business": { "name": "Graphite", "preset": "meezan", "accent": "#0B7350", "…": "…" }
  }
}
```

A `WorkspaceTheme` (`packages/ui-kit/src/tokens.ts`) has `accent`, `preset`, `look`, `radius`, `components`, `mode` and an optional display `name`. Every field is optional.

- **Unset follows the bank.** A workspace that sets nothing for a field uses the bank's own value; a workspace the bank did not theme uses the bank's own brand.
- **Set replaces.** A workspace look is chosen as a whole, so `look`, `radius` and `components` replace the bank's, they are not merged with it.
- **`mode`** is the appearance the workspace opens in (`light` or `dark`) until the customer chooses. Leave it out to follow the device.
- **`look`** takes the existing fields (`chrome`, `fields`, `bar`, `pageBg`) and two new ones: `hero` (the balance card's gradient, `{ from, to }`, for example charcoal under a green accent) and `ink` (the dark panel colour). In a workspace look `pageBg` is also the light page canvas, and the muted fill and borders are drawn from it. Note that `bar` colours buttons as well as the app bar, so leave it out when the accent should show on buttons.

## Resolving it

- `resolveBrand(id, def, workspace?)` returns the full light and dark `Brand` for the bank, or for one workspace (`brand.workspace` and `brand.mode` say which). `resolveWorkspaces(id, def)` returns the themed ones; `brandFor(id, workspace?)` picks the right one by bank id and falls back to the bank's own brand.
- **Web** (`packages/renderer-web/src/theme.ts`): `themeCss(brand, workspaces?)` adds a block per workspace scoped by `:root[data-brand="…"][data-workspace="personal|business"]`, in light, `data-mode="dark"` and system dark. The page switches look by changing one attribute. `apps/bank-web` serves it at `/api/theme/<project>` and `WorkspaceScope` sets the attribute; until the shell's context store does that, `?workspace=business` on any bank page previews it.
- **Mobile**: `ThemeProvider` takes the resolved brand object. `apps/bank-app/src/brand.ts` exports `brandOf(workspace?)`; build with `EXPO_PUBLIC_FINX_WORKSPACE=business` to preview a workspace until the shell passes the active one. The shell (which screens exist) still follows the bank's own preset.

## Studio

Design has **Personal** and **Business** tabs. Each is the same look step the new-project wizard uses (`components/design/LookEditor.tsx`: ready-made looks, brand colour, roundness and density) with the same accessibility report (`lookReport`: contrast of the button, link and text, white text on the balance card when `hero` is set, and the smallest tap target, 44 px). The preview shows a balance card and a sign-in screen in light and dark. *Give Personal its own look* switches the workspace on or off; saving writes the workspace under the bank in `brands.json` (needs the *projects* permission) and Undo restores the previous look.

`PATCH /api/projects/<id>/workspaces` with `{ "workspace": "business", "theme": { … } }` saves a look, or `"theme": null` to follow the bank's own look. It answers `{ id, workspace, theme, previous }`, or `400` listing every problem (an accent too light for white text, a bad colour, a size out of range). Anything outside the fields above is dropped (no logo, font or free text), and the web app rebuilds each workspace from checked fields when it reads it from Studio.

## Rules

- Components and screens never name a look; a test fails if `Aurora` or `Graphite` appears in them.
- Every workspace look must read: body and muted text, the button label and the accent in light and dark are checked for both BankWorkx looks, and `lookReport` is run for both.
- Customer-facing text carries no country or scheme names; a look is only colour, shape and size.
