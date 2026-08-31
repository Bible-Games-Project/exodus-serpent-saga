// Gameplay Moses — layered sprite: one uncut body PNG + two sandal layers,
// plus the separate shepherd's-crook staff sprite held in his right hand.
//
// The walk cycle only alternates the sandals and re-stamps the arm slices with
// a tiny offset; the robe pixels are never cut or deformed. Standing still adds
// a very subtle breathing motion (a single pixel, slowly).
import bodyAsset from "@/assets/moses4-body.png.asset.json";
import footLAsset from "@/assets/moses4-foot-l.png.asset.json";
import footRAsset from "@/assets/moses4-foot-r.png.asset.json";
import staffAsset from "@/assets/moses-staff3.png.asset.json";

export const MOSES_ART = {
  /** sprite-pixel size of the shared layer canvas */
  W: 33,
  IMG_H: 66,
  /** ground contact row (bottom of the sandals) */
  H: 66,
  /** screen pixels per sprite pixel */
  PX: 1.2,
  /** x of Moses' body centre inside the sprite */
  CX: 16,
  /** first row of the feet layers */
  LEG_TOP: 55,
  /** the right hand's grip on the staff — pivot for the melee swing */
  HAND: { x: 27, y: 43 },
  /** crook (business end of the staff) relative to HAND, in sprite pixels */
  TIP: { x: -4, y: -37 },
} as const;

/** the staff sprite keeps its own canvas / scale so its art is unchanged */
const STAFF = { W: 12, H: 67, PX: 1.12, GRIP: { x: 9, y: 42 } } as const;

/**
 * Attack animation cadence — unchanged timing contract used by the engine:
 * wind-up, impact window and total duration all stay exactly as before.
 */
export const MOSES_ATTACK = {
  FRAME: 0.1,
  IMPACT_FRAME: 2,
  WINDUP: 0.2,
  DUR: 0.5,
} as const;

type Layers = {
  body: HTMLImageElement;
  footL: HTMLImageElement;
  footR: HTMLImageElement;
  staff: HTMLImageElement;
};

let layers: Layers | null = null;

function load(url: string): HTMLImageElement {
  const img = new Image();
  img.src = url;
  return img;
}

export function ensureMosesArt(): boolean {
  if (typeof document === "undefined") return false;
  if (!layers) {
    layers = {
      body: load(bodyAsset.url),
      footL: load(footLAsset.url),
      footR: load(footRAsset.url),
      staff: load(staffAsset.url),
    };
  }
  for (const img of Object.values(layers)) {
    if (!img.complete || !img.naturalWidth) return false;
  }
  return true;
}

export type MosesPose = {
  /** screen position of Moses' feet (ground contact point) */
  x: number;
  groundY: number;
  flip: 1 | -1;
  walkPhase: number;
  moving: boolean;
  bob: number;
  /** staff rotation in radians around the hand; 0 keeps the base pose */
  staffAngle: number;
  /** kept for API compatibility with the caller; the swing is driven by staffAngle */
  attackProgress?: number | null;
  flash?: number;
};

/** Staff rotation (radians, around the hand) for a swing progress 0..1. */
export function mosesSwingAngle(progress: number): number {
  const p = Math.max(0, Math.min(1, progress));
  if (p < 0.28) return -0.5 * (p / 0.28);
  const t = (p - 0.28) / 0.72;
  return -0.5 + (1 - (1 - t) * (1 - t)) * 2.5;
}

/** Screen position of Moses' grip (staff pivot). */
export function mosesGrip(x: number, groundY: number, flip: 1 | -1) {
  const { PX, CX, H, HAND } = MOSES_ART;
  return {
    x: x + (HAND.x - CX) * PX * flip,
    y: groundY - (H - HAND.y) * PX,
  };
}

/** Screen position of the staff's crook for a given pose — used by the wind slash. */
export function mosesStaffTip(x: number, groundY: number, flip: 1 | -1, angle: number) {
  const { PX, TIP } = MOSES_ART;
  const grip = mosesGrip(x, groundY, flip);
  const c = Math.cos(angle), s = Math.sin(angle);
  const rx = (TIP.x * c - TIP.y * s) * PX;
  const ry = (TIP.x * s + TIP.y * c) * PX;
  return { x: grip.x + rx * flip, y: grip.y + ry };
}

/** Distance (screen px) from the grip to the crook — melee reach. */
export const MOSES_STAFF_LEN = Math.hypot(MOSES_ART.TIP.x, MOSES_ART.TIP.y) * MOSES_ART.PX;

/** Draws gameplay Moses at native pixel density from his whole-piece layers. */
export function drawMosesArt(ctx: CanvasRenderingContext2D, pose: MosesPose): void {
  if (!ensureMosesArt() || !layers) return;
  const { W, IMG_H, H, PX, CX, HAND } = MOSES_ART;
  const L = layers;

  // ---- walk cycle: only the sandals travel ----
  const sw = pose.moving ? Math.sin(pose.walkPhase) : 0;
  const stride = pose.moving ? Math.round(sw * 2) : 0;
  const rDX = stride;
  const lDX = -stride;
  const rLift = pose.moving ? -Math.max(0, Math.round(sw * 1.4)) : 0;
  const lLift = pose.moving ? -Math.max(0, Math.round(-sw * 1.4)) : 0;

  // ---- idle breathing: one pixel, slowly, while standing still ----
  const breathT = pose.walkPhase / 4.2; // walkPhase is animT * 4.2
  const breath = pose.moving ? 0 : Math.sin(breathT * 1.6) > 0.55 ? -1 : 0;

  // very subtle torso movement while walking: a single pixel bob per half stride
  const bodyDY = pose.moving ? (Math.sin(pose.walkPhase * 2) > 0 ? -1 : 0) : breath;
  // the robe is never nudged sideways or clipped — only the feet alternate
  const bodyDX = 0;
  // arms swing opposite to the legs (right foot ahead -> left arm forward).
  // The arm regions are re-stamped from the body layer, never cut out of it.
  const armSw = pose.moving ? Math.round(sw) : 0; // -1 | 0 | 1
  const lArm = { dx: armSw, dy: -Math.max(0, armSw) };
  const rArm = { dx: -armSw, dy: -Math.max(0, -armSw) };
  // the held staff sways gently with the walk / breathes while idle
  const walkSway = pose.moving
    ? Math.sin(pose.walkPhase) * 0.05
    : Math.sin(breathT * 1.6) * 0.015;
  const staffRot = pose.staffAngle || walkSway;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(pose.x), Math.round(pose.groundY + pose.bob));
  if (pose.flip === -1) ctx.scale(-1, 1);
  ctx.translate(-CX * PX, -H * PX);

  const stamp = (img: HTMLImageElement, dx: number, dy: number) => {
    ctx.drawImage(img, dx * PX, dy * PX, W * PX, IMG_H * PX);
  };

  // arm slices of the body layer (sprite px), re-drawn on top with an offset
  const ARM_TOP = 28, ARM_BOT = 47;
  const stampArm = (sx: number, sw2: number, dx: number, dy: number) => {
    if (!dx && !dy) return;
    ctx.drawImage(
      L.body,
      sx, ARM_TOP, sw2, ARM_BOT - ARM_TOP,
      (sx + dx) * PX, (ARM_TOP + dy + bodyDY) * PX, sw2 * PX, (ARM_BOT - ARM_TOP) * PX,
    );
  };

  const paint = () => {
    stamp(L.footL, lDX, lLift);
    stamp(L.footR, rDX, rLift);
    stamp(L.body, bodyDX, bodyDY);
    // left arm, then right arm (which holds the staff)
    stampArm(1, 8, lArm.dx, lArm.dy);
    stampArm(24, 8, rArm.dx, rArm.dy);
    // staff, pivoting on the right hand so it never leaves the grip —
    // the grip travels with the arm as it swings
    ctx.save();
    ctx.translate((HAND.x + bodyDX + rArm.dx) * PX, (HAND.y + bodyDY + rArm.dy) * PX);
    if (staffRot) ctx.rotate(staffRot);
    ctx.drawImage(
      L.staff,
      -STAFF.GRIP.x * STAFF.PX, -STAFF.GRIP.y * STAFF.PX,
      STAFF.W * STAFF.PX, STAFF.H * STAFF.PX,
    );
    ctx.restore();
  };

  paint();
  if (pose.flash && pose.flash > 0) {
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = pose.flash;
    paint();
  }
  ctx.restore();
}
