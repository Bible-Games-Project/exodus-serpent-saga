// Shared horse-leg rig for the spear knight and the archer chariot.
//
// Every leg is three pieces cut from the supplied art (see
// scripts/enemy-redraw/split-horse-legs.mjs): the upper leg (swings from the
// shoulder / hip), the cannon (folds at the knee or hock) and the pastern with
// the hoof (folds at the fetlock). A stride is a stance phase, where the leg
// stays straight and sweeps back under the body, and a swing phase, where the
// knee and fetlock fold so the hoof lifts and travels forward.
//
// Angles are canvas angles for art facing RIGHT: positive turns the hoof
// backwards.

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
  /** leg angle at touch-down (negative = reaching forward) */
  reach: number;
  /** leg angle at lift-off (hoof behind) */
  push: number;
  /** peak fold of the knee / hock during the swing (radians) */
  knee: number;
  /** peak fold of the fetlock during the swing */
  fetlock: number;
};

/** Four-beat walk. */
export const HORSE_WALK: HorseGait = { duty: 0.62, reach: -0.24, push: 0.22, knee: 0.95, fetlock: 0.55 };
/** Gallop: short ground contact, long reach, high tucked hooves. */
export const HORSE_GALLOP: HorseGait = { duty: 0.36, reach: -0.5, push: 0.42, knee: 1.35, fetlock: 0.7 };

/** Footfall offsets (fraction of the stride) for far/near hind and fore legs. */
export const WALK_OFFSETS = { hindFar: 0.5, hindNear: 0, foreFar: 0.75, foreNear: 0.25 } as const;
export const GALLOP_OFFSETS = { hindFar: 0, hindNear: 0.11, foreFar: 0.38, foreNear: 0.5 } as const;

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Joint angles of one leg at stride position u (0..1). */
export function horseLegPose(u: number, kind: HorseLegKind, g: HorseGait): { hip: number; knee: number; fetlock: number } {
  u -= Math.floor(u);
  if (u < g.duty) {
    // Stance: straight leg sweeping from reach to push.
    const t = u / g.duty;
    return { hip: g.reach + (g.push - g.reach) * t, knee: 0, fetlock: 0 };
  }
  const t = (u - g.duty) / (1 - g.duty);
  // The fold peaks early in the swing, then the leg unfolds to reach.
  const fold = Math.sin(Math.PI * Math.pow(t, 0.8));
  const hip = g.push + (g.reach - g.push) * smooth(t);
  // Fore knee folds the cannon back; hind hock folds it forward under the belly.
  const knee = (kind === "fore" ? 1 : -0.8) * g.knee * fold;
  // The hind gaskin swings further forward while the hock is folded.
  return { hip: kind === "hind" ? hip - 0.15 * fold : hip, knee, fetlock: g.fetlock * fold };
}

/**
 * Draws one leg. `ctx` must already be in sprite space scaled by `px` (the
 * caller's translate/scale), with the art's top-left at (0, 0). `dx`/`dy`
 * shift the whole leg (far legs, body bob).
 */
export function drawHorseLeg(
  ctx: CanvasRenderingContext2D,
  imgs: readonly HTMLImageElement[],
  rig: HorseLegRig,
  pose: { hip: number; knee: number; fetlock: number },
  px: number,
  dx = 0,
  dy = 0,
): void {
  const piv = (x: number, y: number, a: number) => {
    ctx.translate((x + dx) * px, (y + dy) * px);
    ctx.rotate(a);
    ctx.translate(-(x + dx) * px, -(y + dy) * px);
  };
  const piece = (k: number) => {
    const [x, y, w, h] = rig.seg[k];
    ctx.drawImage(imgs[k], (x + dx) * px, (y + dy) * px, w * px, h * px);
  };
  ctx.save();
  piv(rig.hip.x, rig.hip.y, pose.hip);
  const upper = ctx.getTransform();
  piv(rig.knee[0], rig.knee[1], pose.knee);
  const cannon = ctx.getTransform();
  piv(rig.fetlock[0], rig.fetlock[1], pose.fetlock);
  // Hoof first, then cannon, then upper: each piece hides the overlap rows of
  // the one below it, so the joints stay closed while they fold.
  piece(2);
  ctx.setTransform(cannon);
  piece(1);
  ctx.setTransform(upper);
  piece(0);
  ctx.restore();
}
