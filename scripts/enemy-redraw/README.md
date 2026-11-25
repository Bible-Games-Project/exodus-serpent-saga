# Enemy redraw (Moses' style)

Enemies are being redrawn so they match in-game Moses (`moses-v2-body.png`):
his skin, his proportions (head about 1/7 of the body, no big heads), his
saturation and brightness, and his pixel size (figure ~84 sprite px, PX 0.95).

1. `gen.mjs` — gpt-image-1.5 edit, high quality, 1024x1536, transparent.
   Inputs: Moses upscaled (nearest, x16, centred on light grey 1024x1536) and
   the current enemy. Prompt = `style.txt` + a pose line that keeps the
   animated parts (legs, weapon arm) clear of the body. Run it with **bun**
   (node's fetch ignores the egress proxy). ~$0.20 per image.
2. `split-*.mjs` — area-average downsample to 84 px tall and split into
   body / legB / legF / arm by majority label (polygons drawn on the hi-res
   source). Prints the pivots in sprite px for the art module.
3. Keep the source (`<enemy>-v2-source.png`) and the old layers; each art
   module has a `*_LOOK` switch ("legacy" | "v2").

Needs `pngjs` (install it in a git-ignored folder, e.g. `.tmp-gen`).

## Colour grade only (2026-11-25)

Shield, heavy and agile soldiers and the cobra kept their art but were too
pastel next to Moses: `grade.mjs in out 1.3` (vibrance around luma k=1.3,
skin 1.5 pulled toward hue 22, gold trims held at hue 43, contrast 1.08,
brightness -0.03). The pastel originals are kept as `*-legacy-pastel.png`.

## Rotating pixel-art limbs

- `up4.mjs` — nearest x4 upscale that bridges corner-touching pixels, so thin
  legs stay whole when they rotate (desert wolf `wolf-v2-leg*.png`; draw them
  at the original size).
- `split-horse-legs.mjs` — cuts each horse leg (spear knight, chariot) at the
  knee / hock and the fetlock for `src/game/horseGait.ts`.
- `fix-chariot-wheel.mjs` — one-off clean-up of the chariot wheel and body.
