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
