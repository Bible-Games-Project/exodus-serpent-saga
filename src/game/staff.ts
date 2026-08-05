// Shared shepherd's-crook renderer at Moses' pixel density. Extracted so the
// main menu can render the exact same staff art as gameplay.
export function drawShepherdStaff(ctx: CanvasRenderingContext2D, gx: number, gy: number, tiltRadians: number, facing: number, length: number) {
  const dirX = Math.cos(tiltRadians) * facing;
  const dirY = Math.sin(tiltRadians);
  const perpX = -dirY * facing;
  const perpY = dirX * facing;

  const buttLen = length * 0.24;
  const shaftLen = length * 0.76;
  const buttX = gx - dirX * buttLen;
  const buttY = gy - dirY * buttLen;
  const shaftTopX = gx + dirX * shaftLen;
  const shaftTopY = gy + dirY * shaftLen;

  // Palette lifted directly from Moses' PALETTE (K, w, d).
  const OUTLINE = "#2b1d14";   // K
  const WOOD_MID = "#8a5a34";  // w
  const WOOD_HI = "#b48355";   // d

  // One staff pixel == one Moses sprite pixel (SCALE = 3 CSS px). The staff is
  // stamped cell-by-cell onto that grid so it reads as hand-drawn pixel art
  // rather than a smooth vector stroke. Two cells wide (wood + shaded edge),
  // i.e. half the width of the previous version.
  const PX = 3;

  // Organic bend: quadratic shaft with a small perpendicular bulge.
  const bendMid = length * 0.05;
  const midX = (buttX + shaftTopX) / 2 + perpX * bendMid;
  const midY = (buttY + shaftTopY) / 2 + perpY * bendMid;

  // Shepherd's crook at the top.
  const crookLen = length * 0.22;
  const bendAmt = length * 0.13;
  const c1X = shaftTopX + dirX * crookLen * 0.5 + perpX * bendAmt * 0.6;
  const c1Y = shaftTopY + dirY * crookLen * 0.5 + perpY * bendAmt * 0.6;
  const c2X = shaftTopX + dirX * crookLen * 0.65 - perpX * bendAmt * 0.4;
  const c2Y = shaftTopY + dirY * crookLen * 0.65 - perpY * bendAmt * 0.4;
  const endX = shaftTopX + dirX * crookLen * 0.45 - perpX * bendAmt * 1.5;
  const endY = shaftTopY + dirY * crookLen * 0.45 - perpY * bendAmt * 1.5;

  const body = new Map<string, [number, number, number]>(); // key -> [x, y, order]
  const edge = new Map<string, [number, number]>();
  const snap = (v: number) => Math.round(v / PX) * PX;
  let order = 0;
  const stamp = (x: number, y: number) => {
    const cx = snap(x), cy = snap(y);
    const k = `${cx},${cy}`;
    if (!body.has(k)) body.set(k, [cx, cy, order++]);
    const ex = snap(x + perpX * PX), ey = snap(y + perpY * PX);
    edge.set(`${ex},${ey}`, [ex, ey]);
  };

  const STEPS = 48;
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS, u = 1 - t;
    stamp(
      u * u * buttX + 2 * u * t * midX + t * t * shaftTopX,
      u * u * buttY + 2 * u * t * midY + t * t * shaftTopY,
    );
  }
  for (let i = 1; i <= STEPS; i++) {
    const t = i / STEPS, u = 1 - t;
    stamp(
      u * u * u * shaftTopX + 3 * u * u * t * c1X + 3 * u * t * t * c2X + t * t * t * endX,
      u * u * u * shaftTopY + 3 * u * u * t * c1Y + 3 * u * t * t * c2Y + t * t * t * endY,
    );
  }

  ctx.save();
  // Shaded edge first (skip anywhere the wood body already sits).
  ctx.fillStyle = OUTLINE;
  for (const [k, [ex, ey]] of edge) {
    if (body.has(k)) continue;
    ctx.fillRect(ex, ey, PX, PX);
  }
  // Wood body, with a sparse highlight speckle for hand-carved grain.
  for (const [, [cx, cy, o]] of body) {
    ctx.fillStyle = o % 5 === 1 ? WOOD_HI : WOOD_MID;
    ctx.fillRect(cx, cy, PX, PX);
  }
  // Grip knot at Moses' hand.
  ctx.fillStyle = "#6b4326";
  ctx.fillRect(snap(gx), snap(gy), PX, PX);
  ctx.restore();
  return { buttX, buttY, topX: shaftTopX, topY: shaftTopY, endX, endY };
}
