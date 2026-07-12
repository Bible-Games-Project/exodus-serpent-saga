import { PALETTE, type Color } from "./palette";

// A sprite is a small grid of pixels described as string rows.
// One character = one "pixel" that we render at any scale, so the
// characters read as clean chunky pixels — modern indie, not retro 8-bit.
export type Sprite = {
  w: number;
  h: number;
  frames: string[][]; // frames[i] = array of `h` rows, each `w` chars long
};

function s(...rows: string[]): string[] {
  return rows;
}

// Render a sprite frame to an offscreen canvas so we can drawImage it fast.
const cache = new Map<string, HTMLCanvasElement>();

export function renderSprite(sprite: Sprite, frame: number, scale: number, tint?: string): HTMLCanvasElement {
  const key = `${sprite.w}x${sprite.h}:${frame}:${scale}:${tint ?? ""}:${sprite.frames[frame].join("|")}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const cnv = document.createElement("canvas");
  cnv.width = sprite.w * scale;
  cnv.height = sprite.h * scale;
  const ctx = cnv.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  const rows = sprite.frames[frame];
  for (let y = 0; y < sprite.h; y++) {
    const row = rows[y] ?? "";
    for (let x = 0; x < sprite.w; x++) {
      const ch = row[x] as Color | undefined;
      if (!ch || ch === "." || ch === " ") continue;
      const c = PALETTE[ch];
      if (!c || c === "transparent") continue;
      ctx.fillStyle = tint ?? c;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  cache.set(key, cnv);
  return cnv;
}

// ---- Moses (16x20) — flowing robe, staff, beard. Two-frame walk cycle. ----
export const MOSES: Sprite = {
  w: 16,
  h: 20,
  frames: [
    s(
      "................",
      ".....blblbl.....",
      "....bhihihb.....",
      "....brs1s1br....",
      "....brs1s1br....",
      ".....brbrbr.....",
      "....brbrbrbr....",
      "...r1r1r1r1r1...",
      "...r1r1r1r1r1wd.",
      "..r1r1r1r1r1r1wd",
      "..r1r2r1r1r2r1wd",
      "..r1r1r1r1r1r1wd",
      "..r1r2r1r1r2r1wd",
      "...r1r1r1r1r1wl.",
      "...r1r1..r1r1wl.",
      "...r2r2..r2r2wl.",
      "...s1s1..s1s1...",
      "...s2s2..s2s2...",
      "..blbl....blbl..",
      "................",
    ),
    s(
      "................",
      ".....blblbl.....",
      "....bhihihb.....",
      "....brs1s1br....",
      "....brs1s1br....",
      ".....brbrbr.....",
      "....brbrbrbr....",
      "...r1r1r1r1r1...",
      "..r1r1r1r1r1r1wd",
      ".r1r1r1r1r1r1r1wd",
      ".r1r2r1r1r2r1..wd",
      ".r1r1r1r1r1r1..wd",
      "..r1r2r1r1r2r1wl.",
      "...r1r1r1r1r1wl.",
      "...r1r1r1r1r1...",
      "....r2r1r1r2....",
      "....s1s1s1s1....",
      "...s2s1..s1s2...",
      "..bl..bl..bl....",
      "................",
    ),
  ],
};

// ---- Serpent projectile (12x6) — living snake, undulating. ----
export const SERPENT: Sprite = {
  w: 12,
  h: 6,
  frames: [
    s(
      "..g3g1g1g1..",
      ".g1g2g2g1...",
      "g1g2g1g2g1..",
      ".g1g2g2g1g1.",
      "..g1g1g1g2g1",
      "...g1g1g1g1.",
    ),
    s(
      "....g1g1g1..",
      "..g1g2g2g1g1",
      "g1g2g1g2g2g1",
      "g1g2g1g2g1..",
      "..g1g2g2g1..",
      "....g1g1....",
    ),
    s(
      "..g1g1g1g1..",
      "g1g2g2g2g1..",
      "g2g1g2g1g2g1",
      "..g1g2g2g2g1",
      "....g1g1g1g1",
      "......g1g1..",
    ),
  ],
};

// ---- Egyptian soldier enemy (12x16) — bronze helmet, white kilt. ----
export const SOLDIER: Sprite = {
  w: 12,
  h: 16,
  frames: [
    s(
      "....bzbz....",
      "...bzbzbz...",
      "...bzs1s1bz.",
      "...brs1s1br.",
      "....brbrbr..",
      "...bzbzbzbz.",
      "..bzbzbzbzbz",
      "..bzwhwhwhbz",
      "..bzwhwhwhbz",
      "..bzwhwhwhbz",
      "...whwhwhwh.",
      "...s1s1s1s1.",
      "...s1s1s1s1.",
      "...brbrbrbr.",
      "..bl..bl..bl",
      "............",
    ),
    s(
      "....bzbz....",
      "...bzbzbz...",
      "...bzs1s1bz.",
      "...brs1s1br.",
      "....brbrbr..",
      "...bzbzbzbz.",
      "..bzbzbzbzbz",
      "..bzwhwhwhbz",
      "..bzwhwhwhbz",
      "..bzwhwhwhbz",
      "...whwhwhwh.",
      "...s1s1s1s1.",
      "...s1s1s1s1.",
      "....brbrbrbr",
      ".bl..bl..bl.",
      "............",
    ),
  ],
};

// ---- Jackal enemy (16x10) — fast, low. ----
export const JACKAL: Sprite = {
  w: 16,
  h: 10,
  frames: [
    s(
      "..............jk",
      ".jk............jk",
      "jkjk...........jk",
      "jkjkjkjkjkjkjkjk",
      "jkjk2jkjkjkjkjk2jk",
      "jkjkjkjkjkjkjk2jk",
      "..jkjk..jk..jkjk",
      "..jk......jk....",
      "..jk......jk....",
      "..bl......bl....",
    ).map((row) => row.replace(/jk2/g, "j").replace(/jk/g, "k").replace(/j/g, "jk2").replace(/k/g, "jk")) as unknown as string[],
    // simpler alternative frame
    s(
      "................",
      ".jk.............",
      "jkjkjkjkjkjkjk..",
      "jkjkjkjkjkjkjkjk",
      "jkjk2jkjkjkjkjk2.",
      "jkjkjkjkjkjkjk..",
      "..jk..jkjk..jk..",
      "..jk..........jk",
      "..jk..........jk",
      "..bl..........bl",
    ),
  ],
};

// ---- Frog plague sprite (8x6) ----
export const FROG: Sprite = {
  w: 8,
  h: 6,
  frames: [
    s(
      "..fgfg..",
      ".fghifg.",
      "fgfgfgfg",
      "fgfg2fg2fg",
      ".fg2..fg2",
      "fg2....fg2",
    ),
  ],
};

// ---- Fly / gnat (5x4) ----
export const FLY: Sprite = {
  w: 5,
  h: 4,
  frames: [
    s(
      ".hi.hi.",
      "hignhigh",
      ".gn.gn.",
      ".bl....",
    ).slice(0, 4),
    s(
      "hi.hi.",
      "gnhign",
      ".gngn.",
      "..bl..",
    ).slice(0, 4),
  ],
};

// ---- XP gem (6x6) ----
export const GEM: Sprite = {
  w: 6,
  h: 6,
  frames: [
    s(
      "..go..",
      ".gohigo.",
      "gohihigo",
      "gogogogo",
      ".go2go2.",
      "..go2..",
    ).map((r) => r.slice(0, 6)),
  ],
};

// ---- NPC — Aaron (16x20, similar to Moses but different tunic) ----
export const AARON: Sprite = {
  w: 16,
  h: 20,
  frames: [
    s(
      "................",
      ".....brbrbr.....",
      "....brs1s1br....",
      "....brs1s1br....",
      ".....brbrbr.....",
      "....brbrbrbr....",
      "...bdbdbdbdbd...",
      "..bdbdbdbdbdbdwd",
      ".bdbdbdbdbdbdbdwd",
      ".bdbl2bdbdbl2bd.wd",
      ".bdbdbdbdbdbd.wd.",
      ".bdbl2bdbdbl2bdwl.",
      "..bdbdbdbdbdwl..",
      "...bdbdbdbdbd...",
      "...bdbd..bdbd...",
      "...s1s1..s1s1...",
      "...s2s2..s2s2...",
      "..bl..bl..bl....",
      "................",
      "................",
    ),
    s(
      "................",
      ".....brbrbr.....",
      "....brs1s1br....",
      "....brs1s1br....",
      ".....brbrbr.....",
      "....brbrbrbr....",
      "...bdbdbdbdbd...",
      "..bdbdbdbdbdbdwd",
      ".bdbdbdbdbdbdbdwd",
      ".bdbl2bdbdbl2bd.wd",
      ".bdbdbdbdbdbd.wd.",
      ".bdbl2bdbdbl2bdwl.",
      "..bdbdbdbdbdwl..",
      "....bdbdbdbd....",
      "....s1s1s1s1....",
      "...s2s1..s1s2...",
      "..bl..bl..bl....",
      "................",
      "................",
      "................",
    ),
  ],
};

// ---- Generic companion sprite factory used for later unlocks (recolored Aaron/Moses). ----
export function tintedCompanion(baseColor: Color): Sprite {
  return AARON;
}

// ---- Decor: palm (24x28) ----
export const PALM: Sprite = {
  w: 24,
  h: 28,
  frames: [
    s(
      "......pgpg....pgpg......",
      "....pgpdpgpgpdpgpg......",
      ".pgpgpdpdpgpgpdpgpgpg...",
      "pgpdpdpgpg..pgpgpdpgpg..",
      "..pgpdpgpg..pgpdpgpg....",
      "....pg......pg..........",
      "............wd..........",
      "...........wdwl.........",
      "...........wdwl.........",
      "..........wdwdwl........",
      "..........wdwdwl........",
      "..........wdwdwl........",
      ".........wdwdwlwl.......",
      ".........wdwdwlwl.......",
      ".........wdwdwlwl.......",
      ".........wdwdwlwl.......",
      "........wdwdwdwlwl......",
      "........wdwdwdwlwl......",
      "........wdwdwdwlwl......",
      "........wdwdwdwlwl......",
      ".......wdwdwdwdwlwl.....",
      ".......wdwdwdwdwlwl.....",
      ".......wdwdwdwdwlwl.....",
      "......sh..sh..sh........",
      "....sh..sd..sh..sd......",
      "..sd..sh......sd..sh....",
      "........................",
      "........................",
    ),
  ],
};

// ---- Decor: pyramid (32x22) ----
export const PYRAMID: Sprite = {
  w: 32,
  h: 22,
  frames: [
    s(
      "...............go...............",
      "..............st2st2............",
      ".............ststst.............",
      "............ststst2st...........",
      "...........st2ststst2st.........",
      "..........ststst2ststst.........",
      ".........ststststst2ststst......",
      "........st2ststststst2ststst....",
      ".......ststst2ststststst2ststst.",
      "......ststst2ststst2ststst2ststst",
      ".....ststststst2ststst2ststst2sts".slice(0,32),
      "....ststst2st2ststststst2st2ststs".slice(0,32),
      "...ststststst2st2ststststst2st2st".slice(0,32),
      "..st2ststst2ststststst2st2ststst2s".slice(0,32),
      ".ststst2st2ststststst2st2ststststst".slice(0,32),
      "ststststst2st2ststststst2st2ststst".slice(0,32),
      "st2ststst2ststststst2st2ststststst".slice(0,32),
      "ststst2st2ststststst2st2ststststst".slice(0,32),
      "sh..sh..sh..sh..sh..sh..sh..sh..".slice(0,32),
      "..sd..sd..sd..sd..sd..sd..sd..sd".slice(0,32),
      "sh..sh..sh..sh..sh..sh..sh..sh..".slice(0,32),
      "..sd..sd..sd..sd..sd..sd..sd..sd".slice(0,32),
    ),
  ],
};

// ---- Decor: rock (12x8) ----
export const ROCK: Sprite = {
  w: 12,
  h: 8,
  frames: [
    s(
      "...ststst...",
      "..stststst2.",
      ".stststststst",
      "stst2ststststst".slice(0,12),
      "stststst2ststst".slice(0,12),
      "sh..sh..sh..".slice(0,12),
      "..sd..sd..sd".slice(0,12),
      "............",
    ),
  ],
};
