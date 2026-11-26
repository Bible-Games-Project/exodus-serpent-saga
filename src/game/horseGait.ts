// Shared horse-leg rig for the spear knight and the archer chariot.
//
// Every leg is three pieces cut from the supplied art (see
// scripts/enemy-redraw/split-horse-legs.mjs): the upper leg (turns at the
// shoulder / hip), the cannon (turns at the knee or hock) and the pastern with
// the hoof (turns at the fetlock).
//
// The legs are driven by where the hoof should be, not by swinging angles: in
// the stance phase the fetlock slides back along the ground at the horse's
// pace (the hoof stays planted and upright), in the swing phase it lifts on an
// arc and travels forward. A two-bone solve finds the shoulder and knee angles
// that reach it, so the knee folds by itself as the hoof comes up, a fore knee
// bending forward and a hind hock backward like a real horse.

export type HorseLegKind = "fore" | "hind";

export type HorseLegRig = {
  kind: HorseLegKind;
  /** shoulder / hip pivot (sprite px) */
  hip: { x: number; y: number };
  /** knee (fore) or hock (hind) pivot */
  knee: readonly [number, number];
  fetlock: readonly [number, number];
  /** [x, y, w, h] of the upper, cannon and hoof pieces */
  seg: readonly (readonly [number, number, number, number])[];
};

export type HorseGait = {
  /** fraction of the stride the hoof is on the ground */
  duty: number;
  /** half the stride length (sprite px, measured on the fetlock) */
  stride: number;
  /** how high the fetlock lifts in the swing (sprite px) */
  liftFore: number;
  liftHind: number;
  /** how far the hoof tips back at the top of the swing (radians) */
  hoofFold: number;
};

/** Four-beat walk. Strides are in knight sprite px; `scale` adapts them. */
export const HORSE_WALK: HorseGait = { duty: 0.64, stride: 46, liftFore: 62, liftHind: 40, hoofFold: 0.75 };
/** Gallop: short ground contact, long stride, high tucked hooves. */
export const HORSE_GALLOP: HorseGait = { duty: 0.4, stride: 80, liftFore: 105, liftHind: 70, hoofFold: 1.1 };

/** Standing: hooves at rest. */
export const HORSE_STILL: HorseGait = { duty: 1, stride: 0, liftFore: 0, liftHind: 0, hoofFold: 0 };

/** Footfall offsets (fraction of the stride) for far/near hind and fore legs. */
export const WALK_OFFSETS = { hindFar: 0.5, hindNear: 0, foreFar: 0.75, foreNear: 0.25 } as const;
export const GALLOP_OFFSETS = { hindFar: 0, hindNear: 0.1, foreFar: 0.36, foreNear: 0.46 } as const;
/** Running pace used in game (2026-11-26): the legs of each pair alternate
 * (half a stride apart) and the diagonals move nearly together, like a fast
 * trot, so the fore legs and the hind legs never travel as one block. Two
 * moments of suspension per stride, at u ≈ 0.45 and 0.95. */
export const RUN_OFFSETS = { hindFar: 0, hindNear: 0.5, foreFar: 0.6, foreNear: 0.1 } as const;

/** How much the upper leg's top edge tilts with the leg (0 = stays flat). */
const TOP_TILT = 0.25;
/** Largest swing of the upper leg (radians). */
const HIP_LIMIT = 0.5;

const smooth = (t: number) => t * t * (3 - 2 * t);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Hoof target at stride position u (0..1), relative to the fetlock's rest
 * spot, plus how much the hoof tips back. `scale` = this rig's leg length
 * relative to the knight's.
 */
function hoofPath(u: number, kind: HorseLegKind, g: HorseGait, scale: number) {
  u -= Math.floor(u);
  const s = g.stride * scale;
  if (u < g.duty) return { x: s - (2 * s * u) / g.duty, y: 0, fold: 0 };
  const t = (u - g.duty) / (1 - g.duty);
  const lift = (kind === "fore" ? g.liftFore : g.liftHind) * scale;
  // Lift early and high, then reach forward and drop onto the ground.
  const up = Math.sin(Math.PI * Math.pow(t, 0.75));
  return { x: -s + 2 * s * smooth(t), y: -lift * up, fold: g.hoofFold * Math.sin(Math.PI * Math.pow(t, 0.7)) };
}

/**
 * Draws one leg at stride position u. `ctx` must already be in the rig's
 * sprite space times `px` (art top-left at 0, 0). `dx` shifts the whole leg
 * (the shadowed far leg); `bodyDY` is how far the body (and so the hip) has
 * moved, in sprite px, while the hoof target stays on the ground.
 */
export function drawHorseLeg(
  ctx: CanvasRenderingContext2D,
  imgs: readonly HTMLImageElement[],
  rig: HorseLegRig,
  u: number,
  gait: HorseGait,
  px: number,
  dx = 0,
  bodyDY = 0,
  scale = 1,
): void {
  const hx = rig.hip.x + dx, hy = rig.hip.y + bodyDY;
  const kx = rig.knee[0] + dx, ky = rig.knee[1] + bodyDY;
  const fx = rig.fetlock[0] + dx, fy = rig.fetlock[1] + bodyDY;
  const a = Math.hypot(kx - hx, ky - hy), b = Math.hypot(fx - kx, fy - ky);
  const foot = hoofPath(u, rig.kind, gait, scale);
  // Target in ground space: the body bob does not move it.
  const tx = fx + foot.x - hx, ty = fy - bodyDY + foot.y - hy;
  const d = Math.min(a + b - 0.5, Math.max(Math.abs(a - b) + 1, Math.hypot(tx, ty)));
  const phi = Math.atan2(ty, tx);
  const psi = Math.acos(Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d))));
  // A fore knee sits in front of the hip–hoof line, a hind hock behind it.
  const side = rig.kind === "fore" ? 1 : -1;
  const t1 = phi - side * psi;
  const nkx = a * Math.cos(t1), nky = a * Math.sin(t1);
  const t2 = Math.atan2(d * Math.sin(phi) - nky, d * Math.cos(phi) - nkx);
  let hip = wrap(t1 - Math.atan2(ky - hy, kx - hx));
  let knee = wrap(t2 - Math.atan2(fy - ky, fx - kx) - hip);
  // A lifted hind leg would otherwise fling its thigh far back: keep the
  // upper leg within a natural swing and point the cannon at the hoof target.
  if (Math.abs(hip) > HIP_LIMIT) {
    hip = Math.sign(hip) * HIP_LIMIT;
    const ta = hip + Math.atan2(ky - hy, kx - hx);
    const nx = a * Math.cos(ta), ny = a * Math.sin(ta);
    knee = wrap(Math.atan2(ty - ny, tx - nx) - Math.atan2(fy - ky, fx - kx) - hip);
  }
  // The hoof stays upright on the ground and tips back while it travels.
  const fetlock = -(hip + knee) + foot.fold;

  // World positions of the knee and fetlock after the solve.
  const rot = (x: number, y: number, t: number) => [x * Math.cos(t) - y * Math.sin(t), x * Math.sin(t) + y * Math.cos(t)];
  const [vx, vy] = [kx - hx, ky - hy];
  const [rkx, rky] = rot(vx, vy, hip);
  const K = [hx + rkx, hy + rky];
  const [rfx, rfy] = rot(fx - kx, fy - ky, hip + knee);
  const F = [K[0] + rfx, K[1] + rfy];

  const base = ctx.getTransform();
  const piece = (k: number) => {
    const [x, y, w, h] = rig.seg[k];
    ctx.drawImage(imgs[k], (x + dx) * px, (y + bodyDY) * px, w * px, h * px);
  };
  const place = (to: number[], from: number[], ang: number) => {
    ctx.setTransform(base);
    ctx.translate(to[0] * px, to[1] * px);
    ctx.rotate(ang);
    ctx.translate(-from[0] * px, -from[1] * px);
  };
  ctx.save();
  // Hoof first, then cannon, then upper: each piece covers the round cap of
  // the one below it, so the joints stay closed while they fold.
  place(F, [fx, fy], hip + knee + fetlock);
  piece(2);
  place(K, [kx, ky], hip + knee);
  piece(1);
  // The upper leg is not turned rigidly: its bone (hip -> knee) follows the
  // solve, but its top edge, cut flat where the body hides it, only tilts a
  // quarter as much, so no corner drops out from under the belly.
  const tilt = hip * TOP_TILT;
  const u1 = [Math.cos(tilt), Math.sin(tilt)];
  const w = [(rkx - vx * u1[0]) / vy, (rky - vx * u1[1]) / vy];
  ctx.setTransform(base);
  ctx.translate(hx * px, hy * px);
  ctx.transform(u1[0], u1[1], w[0], w[1], 0, 0);
  ctx.translate(-hx * px, -hy * px);
  piece(0);
  ctx.restore();
}
