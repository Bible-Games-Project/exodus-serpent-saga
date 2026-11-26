// Split each horse leg layer into three bending segments (upper leg, cannon,
// pastern + hoof) so the rig can fold the knee / hock and the fetlock instead
// of swinging a stiff leg. Each joint pivots at the centre of its cut, and the
// lower segment carries a round cap (a disc of the leg's half-width around the
// pivot, taken from the art above the cut): a disc turning around its own
// centre keeps its shape, so the joint looks round and never opens a gap.
//
//   bun scripts/enemy-redraw/split-horse-legs.mjs   (needs pngjs)
//
// v5 upper legs (2026-11-26): the upper piece also carries a feathered strip
// of coat above its top edge (its own top row stretched up, only where the
// body covers it), so when the leg swings no hard corner or empty wedge shows under the
// body's straight cut. Written as <v5 prefix><id>-a.png; b / c stay v4.
//
// Prints the segment origins and joint pivots used by horseGait.ts callers.
import fs from "fs";
import { PNG } from "pngjs";

const A = new URL("../../src/assets/", import.meta.url).pathname;
const RIGS = [
  { prefix: "knight-v3-leg-", out: "knight-v4-leg-", out5: "knight-v5-leg-", body: "knight-v3-body.png", bodyOut: "knight-v5-body.png", clear: { x0: 130, x1: 262, y0: 948 }, ext: 70, legs: {
    h1: { kind: "hind", knee: 1045, fetlock: 1235 }, h2: { kind: "hind", knee: 1045, fetlock: 1235 },
    f1: { kind: "fore", knee: 1080, fetlock: 1235 }, f2: { kind: "fore", knee: 1080, fetlock: 1235 } } },
  { prefix: "chariot-v3-leg-", out: "chariot-v4-leg-", out5: "chariot-v5-leg-", body: "chariot-v4-body.png", ext: 40, legs: {
    "hind-a": { kind: "hind", knee: 785, fetlock: 898 }, "hind-b": { kind: "hind", knee: 790, fetlock: 898 },
    fore: { kind: "fore", knee: 790, fetlock: 892 }, "fore-far": { kind: "fore", knee: 790, fetlock: 892 } } },
];

const opaque = (im, x, y) => im.data[(y * im.width + x) * 4 + 3] > 100;
function rowSpan(im, y) {
  let x0 = -1, x1 = -1;
  for (let x = 0; x < im.width; x++) if (opaque(im, x, y)) { if (x0 < 0) x0 = x; x1 = x; }
  return [x0, x1];
}
/** Rows y0..y1 of the layer, plus a disc of radius r around cap (if any). */
function crop(im, y0, y1, cap) {
  const keep = (x, y) => (y >= y0 && y < y1) || (cap && Math.hypot(x + 0.5 - cap.x, y + 0.5 - cap.y) <= cap.r);
  let bx0 = 1e9, bx1 = -1, by0 = 1e9, by1 = -1;
  for (let y = 0; y < Math.min(im.height, y1); y++)
    for (let x = 0; x < im.width; x++) if (im.data[(y * im.width + x) * 4 + 3] > 0 && keep(x, y)) {
      bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y);
    }
  const o = new PNG({ width: bx1 - bx0 + 1, height: by1 - by0 + 1 });
  for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) if (keep(x, y))
    im.data.copy(o.data, ((y - by0) * o.width + x - bx0) * 4, (y * im.width + x) * 4, (y * im.width + x + 1) * 4);
  return { png: o, x: bx0, y: by0 };
}

/** Upper piece plus a strip of coat above each column's top on the cut, feathered upward. */
function extendUp(seg, E, body) {
  const { png, x: sx, y: sy } = seg;
  const colTop = new Map();
  for (let x = 0; x < png.width; x++)
    for (let y = 0; y < Math.min(png.height, 24); y++) if (png.data[(y * png.width + x) * 4 + 3] > 100) { colTop.set(x + sx, y + sy); break; }
  const xs = [...colTop.keys()], x0 = Math.min(...xs), x1 = Math.max(...xs), M = 0;
  const topAt = (x) => colTop.get(Math.max(x0, Math.min(x1, x))) ?? colTop.get(x0);
  const nx0 = x0 - M, nx1 = x1 + M, ny0 = sy - E;
  const ox = Math.min(sx, nx0), ow = Math.max(sx + png.width, nx1 + 1) - ox, oh = sy + png.height - ny0;
  const o = new PNG({ width: ow, height: oh });
  const R = 8;
  const covered = (x, y) => {
    let m = 1;
    for (let dy = -R; dy <= 0; dy += 2) for (let dx = -R; dx <= R; dx += 2) {
      const X = x + dx, Y = y + dy;
      m = Math.min(m, X < 0 || Y < 0 || X >= body.width || Y >= body.height ? 0 : body.data[(Y * body.width + X) * 4 + 3] / 255);
    }
    return m;
  };
  const sm = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
  for (let x = nx0; x <= nx1; x++) {
    // Only columns whose top is on the cut (first rows of the piece).
    if (!colTop.has(x)) continue;
    const side = 1, top = colTop.get(x);
    // Colour: the leg's own top row in this column (nearest leg column in the
    // side margin), so the strip is always coat, never tail or saddle cloth.
    const at = (c) => ((Math.min(png.height - 1, topAt(c) - sy + 2)) * png.width + c - sx) * 4;
    const coat = (i) => png.data[i + 3] >= 100 && !(png.data[i + 1] > 2.2 * png.data[i + 2]);
    let cx = Math.max(x0, Math.min(x1, x));
    for (let d = 0; d < x1 - x0 && !coat(at(cx)); d++) cx = Math.max(x0, Math.min(x1, x + (d % 2 ? -1 : 1) * (d + 1)));
    const src = at(cx);
    if (!coat(src)) continue;
    for (let y = top - E; y < top; y++) {
      // Only where the body covers it (with a margin), so it never shows below the belly.
      const k = sm((y - (top - E)) / (E * 0.6)) * sm(side * 1.5) * covered(x, y);
      if (k <= 0) continue;
      const oi = ((y - ny0) * ow + x - ox) * 4;
      png.data.copy(o.data, oi, src, src + 3);
      o.data[oi + 3] = Math.round(255 * k);
    }
  }
  // The leg itself on top, untouched.
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
    const si = (y * png.width + x) * 4, a = png.data[si + 3] / 255;
    if (!a) continue;
    const oi = ((y + sy - ny0) * ow + x + sx - ox) * 4, b = o.data[oi + 3] / 255, A = a + b * (1 - a);
    for (let q = 0; q < 3; q++) o.data[oi + q] = Math.round((png.data[si + q] * a + o.data[oi + q] * b * (1 - a)) / A);
    o.data[oi + 3] = Math.round(255 * A);
  }
  return { png: o, x: ox, y: ny0 };
}

for (const rig of RIGS) {
  const out = {};
  const body = PNG.sync.read(fs.readFileSync(A + rig.body));
  if (rig.bodyOut) {
    // The knight body keeps a square tab of the far hind thigh below its cut,
    // next to the tail; it stood still while the leg moved. Cleared here (coat
    // only, the tail stays); the leg's strip of coat fills it instead.
    const b5 = PNG.sync.read(fs.readFileSync(A + rig.body)), c = rig.clear;
    for (let y = c.y0; y < b5.height; y++) for (let x = c.x0; x <= c.x1; x++) {
      const i = (y * b5.width + x) * 4;
      if (b5.data[i] > 110) b5.data[i + 3] = 0;
    }
    fs.writeFileSync(A + rig.bodyOut, PNG.sync.write(b5));
  }
  for (const [id, leg] of Object.entries(rig.legs)) {
    const im = PNG.sync.read(fs.readFileSync(A + rig.prefix + id + ".png"));
    const [k0, k1] = rowSpan(im, leg.knee), [f0, f1] = rowSpan(im, leg.fetlock);
    const knee = { x: (k0 + k1 + 1) / 2, y: leg.knee, r: (k1 - k0 + 1) / 2 };
    const fet = { x: (f0 + f1 + 1) / 2, y: leg.fetlock, r: (f1 - f0 + 1) / 2 };
    const segs = [crop(im, 0, leg.knee), crop(im, leg.knee, leg.fetlock, knee), crop(im, leg.fetlock, im.height, fet)];
    segs.forEach((s, k) => fs.writeFileSync(A + rig.out + id + "-" + "abc"[k] + ".png", PNG.sync.write(s.png)));
    segs[0] = extendUp(segs[0], rig.ext, body);
    fs.writeFileSync(A + rig.out5 + id + "-a.png", PNG.sync.write(segs[0].png));
    out[id] = {
      kind: leg.kind,
      seg: segs.map((s) => [s.x, s.y, s.png.width, s.png.height]),
      knee: [knee.x, knee.y],
      fetlock: [fet.x, fet.y],
    };
  }
  console.log(rig.out, "(seg[0] = " + rig.out5 + "*-a.png)", JSON.stringify(out));
}
