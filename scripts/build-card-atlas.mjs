#!/usr/bin/env node
// build-card-atlas.mjs
//
// Regenerates the texture-atlas WebP consumed by the web client at
// `web-react/public/cards/atlas.webp`. The atlas is a 10-column grid
// where each cell holds one UNO card face, in the order defined by
// `ATLAS_ORDER` in `web-react/src/tableConfig.ts`:
//
//   [red_0 .. red_draw2, blue_0 .. blue_draw2, green_0 .. green_draw2,
//    yellow_0 .. yellow_draw2, wild, wild_draw4, back]
//
// Each cell is 1/10 of the atlas width and 1/6 of the atlas height.
// The CSS in `web-react/src/index.css` (.card-sprite) uses
// background-size 1000% 600% and a calc-based background-position to
// slice a cell out of the atlas, so the atlas image MUST be exactly
// 10 columns x 6 rows. The CSS variables --col and --row are set by
// CardAtlasView.tsx based on the card's index in ATLAS_ORDER.
//
// Usage:
//   node scripts/build-card-atlas.mjs <source-dir> <output-webp>
//
//   <source-dir>  Directory containing the 55 source PNGs named per
//                 ATLAS_ORDER: red_0.png, red_1.png, ..., back.png.
//   <output-webp> Path to write the resulting atlas to. Defaults to
//                 `web-react/public/cards/atlas.webp`.
//
// The source PNGs in this repo's history were the Kenney "Playing Cards
// Pack" (CC0). They were hand-assembled into the existing atlas. This
// script provides a reproducible path to rebuild it if a card face ever
// needs to change.

import { readdir, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..");

// Must match ATLAS_ORDER in web-react/src/tableConfig.ts. If you change
// the order there, change it here too.
const ATLAS_ORDER = [
  "red_0", "red_1", "red_2", "red_3", "red_4", "red_5", "red_6", "red_7", "red_8", "red_9",
  "red_skip", "red_reverse", "red_draw2",
  "blue_0", "blue_1", "blue_2", "blue_3", "blue_4", "blue_5", "blue_6", "blue_7", "blue_8", "blue_9",
  "blue_skip", "blue_reverse", "blue_draw2",
  "green_0", "green_1", "green_2", "green_3", "green_4", "green_5", "green_6", "green_7", "green_8", "green_9",
  "green_skip", "green_reverse", "green_draw2",
  "yellow_0", "yellow_1", "yellow_2", "yellow_3", "yellow_4", "yellow_5", "yellow_6", "yellow_7", "yellow_8", "yellow_9",
  "yellow_skip", "yellow_reverse", "yellow_draw2",
  "wild", "wild_draw4", "back",
];

const COLS = 10;
const ROWS = 6;
const CELL = 240; // px per cell — produces a 2400×2250 atlas, matches the existing committed asset

async function main() {
  const [sourceDir, outArg] = process.argv.slice(2);
  if (!sourceDir) {
    console.error("usage: build-card-atlas.mjs <source-dir> [output-webp]");
    console.error("  source-dir: directory of PNGs named per ATLAS_ORDER");
    console.error("  output-webp: defaults to web-react/public/cards/atlas.webp");
    process.exit(2);
  }
  const output = resolve(outArg ?? join(REPO_ROOT, "web-react/public/cards/atlas.webp"));

  // 1. Validate inputs.
  const files = await readdir(sourceDir);
  const pngs = new Set(files.filter((f) => f.endsWith(".png")).map((f) => f.replace(/\.png$/, "")));
  const missing = ATLAS_ORDER.filter((id) => !pngs.has(id));
  if (missing.length) {
    console.error(`error: ${missing.length} source PNG(s) missing for: ${missing.join(", ")}`);
    process.exit(1);
  }
  if (pngs.size !== ATLAS_ORDER.length) {
    console.warn(`warning: ${pngs.size} PNGs in source, expected ${ATLAS_ORDER.length}`);
  }

  // 2. Compose a 10x6 grid using ImageMagick `montage` (one of the few
  //    CLI tools that does this without a runtime dep). Fall back to a
  //    plain tile if `montage` isn't available — see ./build-card-atlas-fallback.mjs
  //    if you need pure-JS.
  const tileArg = ATLAS_ORDER.map((id) => join(sourceDir, `${id}.png`));
  await mkdir(dirname(output), { recursive: true });
  try {
    execFileSync("montage", [
      ...tileArg,
      "-tile", `${COLS}x${ROWS}`,
      "-geometry", `${CELL}x${CELL}+0+0`,
      "-background", "none",
      output,
    ], { stdio: "inherit" });
  } catch (err) {
    console.error("error: `montage` (ImageMagick) failed. Install it or use a pure-JS fallback.");
    console.error("  macOS:  brew install imagemagick");
    console.error("  Ubuntu: sudo apt-get install imagemagick");
    process.exit(1);
  }

  // 3. Write a manifest alongside the atlas so future rebuilds can
  //    verify cell ordering matches ATLAS_ORDER.
  const manifest = ATLAS_ORDER.map((id) => `cell ${id} -> col=${ATLAS_ORDER.indexOf(id) % COLS},row=${Math.floor(ATLAS_ORDER.indexOf(id) / COLS)}`).join("\n") + "\n";
  await writeFile(output.replace(/\.webp$/, ".manifest.txt"), manifest);

  console.log(`wrote ${output} (${COLS}x${ROWS} grid, ${CELL}px cells)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
