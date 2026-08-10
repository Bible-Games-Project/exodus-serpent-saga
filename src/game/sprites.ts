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

// Ramses — rebuilt from scratch on Moses' construction: same one-character-per-
// pixel grid, same organic rounded head and face (white eyes), same stepped
// two-frame walk cycle with identical leg timing, and the same "staff column"
// on his right — only here it is an Egyptian was-scepter in royal gold.
//
// Pharaoh identity is carried by silhouette: a flaring white nemes headdress
// with gold bands and a rearing uraeus cobra crest, a broad usekh collar, a
// gold royal belt over ivory royal linen and gilded sandals. No black outlines
// anywhere — the silhouette is held with the deep warm shadow `q` so he stays
// in harmony with the #FEEFBE desert. 18 wide x 24 tall.
export const RAMSES = make([
  [
    "......q4q......q4.",
    "......q2q......434",
    ".....qWWWq......21",
    "...qWWWWWWWq....21",
    "...q4WWWWW4q....21",
    "...qWsssssWq....21",
    "...qWsWsWsWq....21",
    "...qWsssssWq....21",
    "...qWsSSSsWq....21",
    "...q4WsssW4q....21",
    "....q22222q.....21",
    "...q4444444q....21",
    "...q2422242q....21",
    "....q11111q.....21",
    "....iiiiiii.....21",
    "....iIiiiIi.....21",
    "....iiiiiii.....21",
    "....i44444i.....21",
    "....i22222i.....21",
    "....iiiiiii.....21",
    "....iIiiiIi.....21",
    "....iii.iii....121",
    "....sss.sss....1.1",
    "....222.222....1.1",
  ],
  [
    "......q4q......q4.",
    "......q2q......434",
    ".....qWWWq......21",
    "...qWWWWWWWq....21",
    "...q4WWWWW4q....21",
    "...qWsssssWq....21",
    "...qWsWsWsWq....21",
    "...qWsssssWq....21",
    "...qWsSSSsWq....21",
    "...q4WsssW4q....21",
    "....q22222q.....21",
    "...q4444444q....21",
    "...q2422242q....21",
    "....q11111q.....21",
    "....iiiiiii.....21",
    "....iIiiiIi.....21",
    "....iiiiiii.....21",
    "....i44444i.....21",
    "....i22222i.....21",
    "....iiiiiii.....21",
    ".....iiiii......21",
    "....ss...ss....121",
    "...222...222...1.1",
    "...2.......2...1.1",
  ],
]);



