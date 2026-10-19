# README media

The README GIFs are generated from EMWaves' mathematical models and SVG diagrams. They contain only the graphical construction, without visible text: no titles, explanations, equations, result cards, labels, written symbols, or numerical scales. Browser chrome, controls, and cursors are also excluded.

Text is omitted only from these GIF exports. The interactive application retains its diagram labels, notation, equations, and results. The static banner remains a separate vector title illustration.

| Asset | Content |
| --- | --- |
| `emwaves-banner.svg` | Vector title illustration |
| `smith-chart.gif` | Transformation of the impedance grid into the Smith chart |
| `single-stub.gif` | First branch of the worked shunt-stub construction |
| `quarter-wave.gif` | First branch of the worked quarter-wave transformer construction |

The matching previews demonstrate the first solution branch, then retrace the construction in reverse for a continuous loop. The interactive matching laboratories construct all available branches and reveal their values as the corresponding steps finish.

## Generation

The entry point is [`scripts/generate-readme-media.mjs`](../../scripts/generate-readme-media.mjs), using the prescribed scenes in [`scripts/readme-scenes.ts`](../../scripts/readme-scenes.ts). It renders the application's SVG chart and circuit components with electrical-model data, removes visible text from the exports, and rasterizes the frames with Sharp.

Full generation writes a temporary PNG sequence to disk. FFmpeg reads that sequence once to generate a shared palette, then again to encode the GIF with that palette. The temporary sequence is removed after encoding. These two FFmpeg passes avoid buffering the entire animation while computing its palette.

From the repository root, install the development dependencies and generate all three GIFs:

```sh
npm ci
npm run docs:media
```

Provide **FFmpeg on `PATH`**, or set `FFMPEG_PATH` to its executable path before running the command. The Sharp development dependency is installed by `npm ci`.

Generate just one animation:

```sh
node scripts/generate-readme-media.mjs --only single-stub
```

The `--only` values are `smith`, `single-stub`, and `quarter-wave`. To inspect representative frames without encoding GIFs:

```sh
node scripts/generate-readme-media.mjs --preview
node scripts/generate-readme-media.mjs --preview --only quarter-wave
```

Preview SVGs and PNGs are written only to the ignored `test-results/readme-media/` directory. They are QA artifacts and are not committed with the README media.

All three GIFs use a `1200 × 720` SVG canvas and an exact `1000 × 600` raster output. They run at **50 frames per second**, with a **20 ms frame delay**.

| Animation | Loop duration | Frames |
| --- | --- | --- |
| Smith transformation | 16 seconds | 800 |
| Single-stub matching | 26 seconds | 1,300 |
| Quarter-wave transformer | 26 seconds | 1,300 |

The matching loops retain the original 16-second forward construction, followed by a 9-second reverse traversal and a 1-second hold at the initial state. The return follows the same geometry continuously, without a fade or a visible reset.

The generated GIFs retain the README paths listed above. Regenerate them when their mathematical construction or chart geometry changes, then inspect the beginning, intermediate stages, final match, and loop transition.

## Visual conventions

- Use the same lossless-line conventions, normalized quantities, and branch solutions as the application.
- Keep the Smith grid, trajectory, active point, and circuit geometry large and readable at README size.
- Center the Smith transformation. In the matching previews, place the Smith chart on the left and the circuit on the right.
- Omit all visible text in the export renderer, including chart scales, point labels, circuit symbols written as text, and dimension values. Keep the application's annotations intact.
- Separate a change of chart reference from propagation along a physical line section.
- Keep each construction inside the common canvas throughout the forward and reverse traversal. The main README supplies the teaching purpose, running instructions, and language options.

All media are part of the project and use its [GPL-3.0-only license](../../LICENSE).
