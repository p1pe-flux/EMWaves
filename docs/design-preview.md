# EMWaves design studies

Run `npm run dev` and open the printed local address followed by
`/design-preview.html`.

The review page compares **Warm Paper** (the default) and **Precision Studio**
across the catalogue, working single-stub laboratory,
and a guide excerpt. Use the top controls to switch direction, screen, device
width, language, or replay the interface motion. Changing direction, language,
or device width preserves the current laboratory parameters and playback.
Changing screens starts a fresh laboratory when you return to it.

The preview uses the existing solver, formulas, circuit, and step construction.
Other catalogue laboratories open the current application in a separate tab.
The preview language is encoded in its URL and does not overwrite the main
application's saved language. Reduced-motion preferences are respected.

This is a separate development entry. The normal production build and its
navigation do not include it. There are no additional runtime dependencies.

Run `npm run test:design` for the prototype browser checks. Spanish desktop
and mobile screenshots are generated under `test-results/design-preview/`.
