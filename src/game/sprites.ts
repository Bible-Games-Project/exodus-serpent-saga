import { PALETTE } from "./palette";

// A sprite is a small grid of pixels described as string rows.
// One character per pixel; `.` is transparent. See ./palette.ts for the codes.
export type Sprite = {
  w: number;
  h: number;
  frames: string[][];
};

function make(rows: string[][]): Sprite {
  const h = rows[0].length;
  const w = rows[0][0].length;
  // sanity — all rows same width; if not, pad
  for (const frame of rows) {
    for (let i = 0; i < frame.length; i++) {
      if (frame[i].length < w) frame[i] = frame[i].padEnd(w, ".");
    }
  }
  return { w, h, frames: rows };
}

const cache = new Map<string, HTMLCanvasElement>();

export function renderSprite(
  sprite: Sprite,
  frame: number,
  scale: number,
  flipX = false,
): HTMLCanvasElement {
  const f = frame % sprite.frames.length;
  const key = `${sprite.w}x${sprite.h}:${f}:${scale}:${flipX}:${sprite.frames[f].join("|")}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const cnv = document.createElement("canvas");
  cnv.width = sprite.w * scale;
  cnv.height = sprite.h * scale;
  const ctx = cnv.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  const rows = sprite.frames[f];
  for (let y = 0; y < sprite.h; y++) {
    const row = rows[y] ?? "";
    for (let x = 0; x < sprite.w; x++) {
      const ch = row[x];
      if (!ch || ch === "." || ch === " ") continue;
      const c = PALETTE[ch];
      if (!c || c === "transparent") continue;
      const dx = flipX ? (sprite.w - 1 - x) * scale : x * scale;
      ctx.fillStyle = c;
      ctx.fillRect(dx, y * scale, scale, scale);
    }
  }
  cache.set(key, cnv);
  return cnv;
}

// ---------------- Sprites ----------------

// Moses — 16 wide x 20 tall. Blue-robed prophet holding a wooden staff on
// his right side. Two-frame walk cycle. The staff is his signature visual.
export const MOSES = make([
  [
    "..............ww",
    ".............wdw",
    ".....KKKKKK..wdw",
    "....KWbbbbbK.wdw",
    "....KbssssbK.wdw",
    "....KbsWWsbK.wdw",
    ".....bBBBBb..wdw",
    "....bbbbbbb..wdw",
    "...uuuuuuuu..wdw",
    "...uUuUuUuU..wdw",
    "..uuuWuuuWuu.wdw",
    "..uUuuuuuuUu.wdw",
    "..uuuuuuuuuu.wdw",
    "..uUuuuuuuUu.wdw",
    "...uuu..uuu..wdw",
    "...UUU..UUU..wdw",
    "...sss..sss..wdw",
    "...SSS..SSS..wdw",
    "...KK....KK..wdw",
    ".............wdw",
  ],
  [
    "..............ww",
    ".............wdw",
    ".....KKKKKK..wdw",
    "....KWbbbbbK.wdw",
    "....KbssssbK.wdw",
    "....KbsWWsbK.wdw",
    ".....bBBBBb..wdw",
    "....bbbbbbb..wdw",
    "...uuuuuuuu..wdw",
    "...uUuUuUuU..wdw",
    "..uuuWuuuWuu.wdw",
    "..uUuuuuuuUu.wdw",
    "..uuuuuuuuuu.wdw",
    "..uUuuuuuuUu.wdw",
    "....uuuuuu...wdw",
    "....UUUUUU...wdw",
    "...ss....ss..wdw",
    "..SSs....sSS.wdw",
    "..KK......KK.wdw",
    ".............wdw",
  ],
]);

// Moses with the staff column blanked out — used during a staff swing so
// the animated swinging staff doesn't appear alongside the sprite's static
// staff (which would look like two staffs at once).
export const MOSES_NOSTAFF = make([
  [
    "................",
    "................",
    ".....KKKKKK.....",
    "....KWbbbbbK....",
    "....KbssssbK....",
    "....KbsWWsbK....",
    ".....bBBBBb.....",
    "....bbbbbbb.....",
    "...uuuuuuuu.....",
    "...uUuUuUuU.....",
    "..uuuWuuuWuu....",
    "..uUuuuuuuUu....",
    "..uuuuuuuuuu....",
    "..uUuuuuuuUu....",
    "...uuu..uuu.....",
    "...UUU..UUU.....",
    "...sss..sss.....",
    "...SSS..SSS.....",
    "...KK....KK.....",
    "................",
  ],
  [
    "................",
    "................",
    ".....KKKKKK.....",
    "....KWbbbbbK....",
    "....KbssssbK....",
    "....KbsWWsbK....",
    ".....bBBBBb.....",
    "....bbbbbbb.....",
    "...uuuuuuuu.....",
    "...uUuUuUuU.....",
    "..uuuWuuuWuu....",
    "..uUuuuuuuUu....",
    "..uuuuuuuuuu....",
    "..uUuuuuuuUu....",
    "....uuuuuu......",
    "....UUUUUU......",
    "...ss....ss.....",
    "..SSs....sSS....",
    "..KK......KK....",
    "................",
  ],
]);

// Living serpent projectile — long, thin, slithering body. 18 wide x 4 tall,
// 4-frame slither with the head bulge on the leading (right) edge.
export const SERPENT = make([
  [
    "..ggggggggggggGGg.",
    "gGGGGGGGGGGGGGyWGg",
    ".ggggggggggggggGgg",
    "..................",
  ],
  [
    "gGGGGGGGGGGGGGGGg.",
    ".gGGGGGGGGGGGGyWGg",
    "..gggggggggggggGgg",
    "..................",
  ],
  [
    "..gggggggggggggGg.",
    "gGGGGGGGGGGGGGyWGg",
    ".ggGGGGGGGGGGGGGgg",
    "..................",
  ],
  [
    "..................",
    "..gggggggggggggGg.",
    "gGGGGGGGGGGGGGyWGg",
    ".ggggggggggggggGgg",
  ],
]);

// Egyptian soldier enemy — 12x18, bronze helmet + white kilt
export const SOLDIER = make([
  [
    "....zzzz....",
    "...zzzzzz...",
    "...zsssZz...",
    "...zsWsZz...",
    "....bbbb....",
    "....ZZZZ....",
    "...zzzzzz...",
    "..zzWWWWzz..",
    "..zWWWWWWZ..",
    "..zWWWWWWZ..",
    "..zWWWWWWZ..",
    "...WWWWWW...",
    "...ssssss...",
    "...ssssss...",
    "...SSSSSS...",
    "...bb..bb...",
    "...KK..KK...",
    "............",
  ],
  [
    "....zzzz....",
    "...zzzzzz...",
    "...zsssZz...",
    "...zsWsZz...",
    "....bbbb....",
    "....ZZZZ....",
    "...zzzzzz...",
    "..zzWWWWzz..",
    "..zWWWWWWZ..",
    "..zWWWWWWZ..",
    "..zWWWWWWZ..",
    "...WWWWWW...",
    "...ssssss...",
    "....ssss....",
    "...SSSSSS...",
    "..bb....bb..",
    "..KK....KK..",
    "............",
  ],
]);


// Jackal enemy — 16x10, fast low predator
export const JACKAL = make([
  [
    "..JJ...........J",
    ".JjjJ.........Jj",
    "JjjjjjjjjjjjjJj.",
    "JjjWjjjjjjjjjjJ.",
    "JjjjjjjjjjjjjjJ.",
    ".JjjjjjjjjjjjJ..",
    "..Jj..JJ..JJ..J.",
    "..Jj..jj..jj....",
    "..Jj..jj..jj....",
    "..KK..KK..KK....",
  ],
  [
    "..JJ.........JJJ",
    ".JjjJ.......Jjj.",
    "JjjjjjjjjjjjJj..",
    "JjjWjjjjjjjjjJ..",
    "JjjjjjjjjjjjjJ..",
    ".Jjjjjjjjjjjjj..",
    "..JJ..JJ..JJ..J.",
    "..jj..jj..jj..jj",
    "..jj..jj..jj..jj",
    "..KK..KK..KK..KK",
  ],
]);

// Frog — 10x7. Three frames: crouch (pre-jump), stretch (mid-air), landing.
// Rendered with additional squash/stretch and vertical hop offset in the
// draw pipeline for a cartoon-style bounce.
export const FROG = make([
  // crouch — legs tucked, wide low body
  [
    "..........",
    "..........",
    "..fffff...",
    ".fFfWfFf..",
    "ffFfffFff.",
    "FF.FfFf.FF",
    "KKKKKKKKKK",
  ],
  // stretch — mid-air, legs trailing
  [
    "..fffff...",
    ".fFfWfFf..",
    "ffFfffFff.",
    "fFffffffFf",
    "fFfffffffF",
    ".F..ff..F.",
    "..K..KK.K.",
  ],
  // landing — legs splayed
  [
    "..........",
    "..fffff...",
    ".fFfWfFf..",
    "ffFfffFff.",
    "fFffffffFf",
    "FF..FF..FF",
    "K.K.KK.K.K",
  ],
]);


// Fly / gnat — 5x4
export const FLY = make([
  [
    "W.W..",
    "NnnnN",
    ".KK..",
    ".K...",
  ],
  [
    ".W.W.",
    "WNnnNW",
    ".KKK.",
    "..K..",
  ],
]);

// XP gem — 6x6
export const GEM = make([
  [
    "..oo..",
    ".oWWo.",
    "oWooWo",
    "oooooo",
    ".OoOO.",
    "..OO..",
  ],
]);

// Aaron (companion) — 16x20 warm red robe
export const AARON = make([
  [
    "................",
    "......KKKKK.....",
    ".....KbbbbbK....",
    ".....KbsssbK....",
    ".....KbsWsbK....",
    "......bBBBb.....",
    ".....bbbbbbb....",
    "....eeeeeeee....",
    "....eEeEeEeE....",
    "...eeeeeeeeee...",
    "...eEeeeeeeEe...",
    "...eeeeeeeeee...",
    "...eEeeeeeeEe...",
    "...eeeeeeeeee...",
    "....eee..eee....",
    "....EEE..EEE....",
    "....sss..sss....",
    "....SSS..SSS....",
    "....KK....KK....",
    "................",
  ],
]);

// Palm tree — 20x24
export const PALM = make([
  [
    "....vvggg..gggvv....",
    "..vgggggvvgggggv....",
    ".vgvggvvggvvgggggv..",
    "vggvvggvvggvvgggggv.",
    "..vvggv..vvggvvgg...",
    "......v..v..........",
    ".........w..........",
    "........ww..........",
    "........ww..........",
    "........wd..........",
    "........wd..........",
    ".......wwd..........",
    ".......wwd..........",
    "........wd..........",
    "........wd..........",
    ".......wwd..........",
    "........wd..........",
    "........wd..........",
    "........wd..........",
    ".......www..........",
    ".....HH...HH........",
    "...HH..HH...HH......",
    ".HH..............HH.",
    "....................",
  ],
]);

// Pyramid — 28x18
export const PYRAMID = make([
  [
    ".............oo.............",
    "............tTTt............",
    "...........tTttTt...........",
    "..........tTtttTTt..........",
    ".........tTttttTTtt.........",
    "........tTttTtttTTTt........",
    ".......tTttttTtttTTTtt......",
    "......tTttTtttTtttTTtTtt....",
    ".....tTttttTtttTtttTTtTTt...",
    "....tTttTtttTtttTtttTTtTTt..",
    "...tTttttTtttTtttTtttTTtTTt.",
    "..tTttTtttTtttTtttTtttTTtTTt",
    ".tTttttTtttTtttTtttTtttTTtTT",
    "tTtttTtttTtttTtttTtttTTtTTTT",
    "TTttttTtttTtttTtttTtttTTTTTT",
    "HH..HH..HH..HH..HH..HH..HH..",
    "..HH..HH..HH..HH..HH..HH..HH",
    "HH..HH..HH..HH..HH..HH..HH..",
  ],
]);

// Rock — 12x7
export const ROCK = make([
  [
    "...ttttt....",
    "..tttTtttT..",
    ".tttTtttTtt.",
    "ttTttttTtttt",
    "tttTtttttTtt",
    "HH..HH..HH..",
    "..HH..HH..HH",
  ],
]);

// Ramses — built directly on Moses' construction: same 16-wide grid, one
// character per pixel, the same rounded organic head (no cube), the same
// two-frame walk cycle with identical leg timing, and the same built-in staff
// column on his right (gold instead of wood). No dark bands anywhere: the
// silhouette is held with the warm beige shadow `x` instead of the black `K`
// outline. Eyes are pure white like Moses'. Palette is muted royal linen with
// #F2C970 gold as the only bright accent. 24 rows tall so he towers over Moses
// while clearly coming from the same hand.
export const RAMSES = make([
  [
    "..............22",
    ".....xxxxxx..121",
    "....xiiiiiix.121",
    "....xi2ii2ix.121",
    "....xissssix.121",
    "....xisWWsix.121",
    "....xissssix.121",
    ".....x2222x..121",
    "....2222222..121",
    "...i2222222i.121",
    "...iiiiiiii..121",
    "...iIiIiIiI..121",
    "..iiiiiiiiii.121",
    "..iIiiiiiiIi.121",
    "..iii2222iii.121",
    "..iiiiiiiiii.121",
    "..iIiiiiiiIi.121",
    "..iiiiiiiiii.121",
    "..iIiiiiiiIi.121",
    "...iii..iii..121",
    "...III..III..121",
    "...sss..sss..121",
    "...SSS..SSS..121",
    "...22....22..121",
  ],
  [
    "..............22",
    ".....xxxxxx..121",
    "....xiiiiiix.121",
    "....xi2ii2ix.121",
    "....xissssix.121",
    "....xisWWsix.121",
    "....xissssix.121",
    ".....x2222x..121",
    "....2222222..121",
    "...i2222222i.121",
    "...iiiiiiii..121",
    "...iIiIiIiI..121",
    "..iiiiiiiiii.121",
    "..iIiiiiiiIi.121",
    "..iii2222iii.121",
    "..iiiiiiiiii.121",
    "..iIiiiiiiIi.121",
    "..iiiiiiiiii.121",
    "..iIiiiiiiIi.121",
    "....iiiiii...121",
    "....IIIIII...121",
    "...ss....ss..121",
    "..SSs....sSS.121",
    "..22......22.121",
  ],
]);

