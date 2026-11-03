# Design: colours from a picture

**Studio → Design** turns a picture of a bank's design into a brand colour and shows the app in it before anything changes.

1. Drop or choose a picture (PNG, JPG, WebP or SVG, up to 15 MB): a screenshot of an app, a logo or a brand sheet.
2. Studio lists the main colours it finds. The strongest real colour is chosen for you; greys are shown faded. Click another swatch, use the colour picker, or type a code.
3. **Before and after** shows the selected project's app now and with the new colour, in light or dark. If the colour is too pale for white text, it says so and **Make it readable** darkens it just enough.
4. **Use for <project>** changes the project's brand colour (the theme in light and dark, and the app icons are remade). An **Undo** button puts the previous colour back. **New project with this colour** opens the new-project wizard with it filled in.

## What it does and does not do

- The picture is read **in your browser**; it is never uploaded or stored. Only the chosen colour is sent to Studio.
- It changes the **accent colour** only. The rest of the theme is worked out from it by the design system, with contrast checks, so light and dark both stay readable.
- It does not copy layouts, fonts, illustrations or icons from the picture, and it does not map a design's screens to journey steps. Those need a person (or Claude) to do the work; see below.
- Apps pick up a new colour the next time they are built. Journeys are not affected. Changing it needs the *projects* permission (Admin or Designer, see [ROLES.md](ROLES.md)).

## Beyond colours

For changes the picture suggests beyond the accent, such as new journeys or a different flow, describe them to Claude Code with `/finx-journey` and attach the picture to the conversation. The colour step does not need Claude or an API key: the extraction is plain code (`apps/studio/lib/palette.ts`, tested).

## API

`PATCH /api/projects/<id>` with `{ "accent": "#0E7490" }` returns `{ id, accent, previous, iconsMade }`, or `400` for an unreadable colour.

## Reading a bank's design frames

`scripts/extract-look.py` measures PNG exports of a bank's Figma frames and writes the look they show. It needs only Python with Pillow, and the exports must stay on this computer (`design/` is ignored by git).

```bash
python3 scripts/extract-look.py design/artea --name Artea --out design/artea/look.json
python3 scripts/extract-look.py design/cab --name CAB --scale 2     # exports made at 2x
python3 -m unittest scripts/test_figma_measure.py                    # checks the measuring against shapes of known size
```

It finds the solid areas (buttons, fields, bars, cards), measures their height, width and corner radius, and reports the brand colour, the field fill and outline, and how many frames agree. Sizes are exact to about 1 px at the export scale (the radius to about 1 to 2 px). It reads solid fills only: gradients, shadows, fonts and text sizes are not captured.

What it measured (in dp, at 1x):

| | Brand colour | Button | Text field | Other |
|---|---|---|---|---|
| CAB (Retail Banking) | #00853E | 56 high, radius about 12 | 54 high, radius about 8, outlined | List row 68 high, radius about 16; 100 dp top bar including the status bar |
| CB (Business Banking) | #254EA2 | 56 high, full-round (pill); gradient #1E4098 to #2A7CFA | 48 high, radius about 8, 1 px outline #E2E8F0, label above | Secondary button #E9EDF6; header gradient from #1C398E; status colours #55AD76, #DDB536, #F0565E; keypad keys 56 high, radius 8; code boxes 72 and 50, radius 6 |
| Artea | #EBFF3E (lime, dark text) | 46 high, radius about 3 | 56 high, radius about 4, no outline, fill #F5F6FA | Error banner #FFE5E8, info banner #DDE8FF, navy #071844 |

CAB's sizes and the *Coloured bar* and *Pill buttons* looks in the new project wizard come from these measurements. Not yet supported: a gradient primary button (CB), and a light brand colour with dark text (Artea's lime fails the "white text on the brand colour" rule, and would also need a separate link colour).
