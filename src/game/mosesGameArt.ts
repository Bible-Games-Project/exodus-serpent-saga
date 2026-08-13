// Gameplay Moses.
//
// The gameplay hero is the supplied pixel-art PNG (no staff baked in) plus the
// supplied staff PNG as a fully separate layer that hangs from his forward
// (right-side) hand. The body/robe layer is one uncut piece: only the feet
// pieces below the robe hem move, so the robe can never look cropped.
//
//   body    — head, robe, sleeves and both hands (rows 0..45), never cut
//   legL/R  — the two feet below the hem (rows 46..52), alternating
//   staff   — the shepherd's crook, rotating around the forward hand
//
// The Home / Main Menu keeps the older Moses art in ./mosesArt — untouched.
import bodyAsset from "@/assets/moses2-body.png.asset.json";
import legLAsset from "@/assets/moses2-leg-l.png.asset.json";
import legRAsset from "@/assets/moses2-leg-r.png.asset.json";
import staffAsset from "@/assets/mosesg-staff.png.asset.json";

export const MOSES_ART = {
  /** sprite-pixel size of the shared layer canvas */
  W: 43,
  IMG_H: 60,
  /** ground contact row (bottom of the sandals) */
  H: 53,
  /** screen pixels per sprite pixel (75% of the previous 2.0 scale) */
  PX: 1.5,
  /** x of Moses' body centre inside the sprite */
  CX: 21,
  /** first row of the feet layers */
  LEG_TOP: 46,
  /** the forward hand's grip on the staff — pivot for the melee swing.
   *  x nudged right (+2) so the grip sits more naturally in the right hand,
   *  clear of the robe's centre line. */
  HAND: { x: 35, y: 34 },
  /** crook (business end of the staff) relative to HAND, in sprite pixels.
   *  The staff layer is mirrored around the grip, so x points right. */
  TIP: { x: 1, y: -30 },
} as const;

type Layers = {
  body: HTMLImageElement;
  legL: HTMLImageElement;
  legR: HTMLImageElement;
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
      legL: load(legLAsset.url),
      legR: load(legRAsset.url),
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
  /** staff rotation in radians around the forward hand; 0 keeps the base pose */
  staffAngle: number;
  flash?: number;
};

/** How long each combo step lasts (seconds). Step 3 is the big sweep. */
export const MOSES_SWING_DURS = [0.18, 0.16, 0.24] as const;
export const MOSES_COMBO_LEN = MOSES_SWING_DURS.length;

/**
 * Staff rotation (radians, around the forward hand) for a swing progress 0..1.
 * `variant` selects one of the three combo steps — every step uses the exact
 * same pivot (the forward hand); only the trajectory differs.
 *   0 — downward / forward chop
 *   1 — rising diagonal back-swing (opposite direction)
 *   2 — wide overhead sweep, full arc
 */
export function mosesSwingAngle(progress: number, variant = 0): number {
  const p = Math.max(0, Math.min(1, progress));
  const step = ((variant % MOSES_COMBO_LEN) + MOSES_COMBO_LEN) % MOSES_COMBO_LEN;
  const ease = (t: number) => 1 - (1 - t) * (1 - t);

  if (step === 1) {
    // upward diagonal: starts low in front, whips up and back over the shoulder
    if (p < 0.22) return 0.9 * (p / 0.22);
    const t = (p - 0.22) / 0.78;
    return 0.9 - ease(t) * 2.9;
  }
  if (step === 2) {
    // big sweep: long windup behind, then a full 360-ish horizontal-looking arc
    if (p < 0.32) return -1.15 * (p / 0.32);
    const t = (p - 0.32) / 0.68;
    return -1.15 + ease(t) * 4.3;
  }
  // step 0 — downward chop
  if (p < 0.28) return -0.5 * (p / 0.28);
  const t = (p - 0.28) / 0.72;
  return -0.5 + ease(t) * 2.5;
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
  // staff is mirrored around the grip, so the swing rotates the other way
  const c = Math.cos(-angle), s = Math.sin(-angle);
  const rx = -(TIP.x * c - TIP.y * s) * PX;
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

  // ---- walk cycle: whole-piece integer offsets, robe untouched ----
  const sw = pose.moving ? Math.sin(pose.walkPhase) : 0;
  const stride = pose.moving ? Math.round(sw * 2) : 0;
  const rDX = stride;
  const lDX = -stride;
  const rLift = pose.moving ? -Math.max(0, Math.round(sw * 1.4)) : 0;
  const lLift = pose.moving ? -Math.max(0, Math.round(-sw * 1.4)) : 0;
  // very subtle torso movement: a single pixel bob, twice per stride
  const bodyDY = pose.moving ? (Math.sin(pose.walkPhase * 2) > 0 ? -1 : 0) : 0;
  // the robe is never nudged sideways or clipped — only the feet alternate
  const bodyDX = 0;
  // arms swing opposite to the legs (right foot forward -> left arm forward).
  // The arm regions are re-stamped from the body layer, never cut out of it,
  // so the robe stays completely intact.
  const armSw = pose.moving ? Math.round(sw) : 0; // -1 | 0 | 1
  const lArm = { dx: armSw, dy: -Math.max(0, armSw) };
  const rArm = { dx: -armSw, dy: -Math.max(0, -armSw) };
  // the held staff sways gently with the walk (arms stay relaxed and down)
  const walkSway = pose.moving ? Math.sin(pose.walkPhase) * 0.05 : 0;
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
  const ARM_TOP = 20, ARM_BOT = 44;
  const stampArm = (sx: number, sw2: number, dx: number, dy: number) => {
    if (!dx && !dy) return;
    ctx.drawImage(
      L.body,
      sx, ARM_TOP, sw2, ARM_BOT - ARM_TOP,
      (sx + dx) * PX, (ARM_TOP + dy + bodyDY) * PX, sw2 * PX, (ARM_BOT - ARM_TOP) * PX,
    );
  };

  const paint = () => {
    stamp(L.legL, lDX, lLift);
    stamp(L.legR, rDX, rLift);
    stamp(L.body, bodyDX, bodyDY);
    // back arm (left, away from camera) then forward arm (right, holds staff)
    stampArm(4, 10, lArm.dx, lArm.dy);
    stampArm(29, 11, rArm.dx, rArm.dy);
    // staff, pivoting on the forward hand so it never leaves the grip —
    // the grip travels with the right arm as it swings
    ctx.save();
    ctx.translate((HAND.x + bodyDX + rArm.dx) * PX, (HAND.y + bodyDY + rArm.dy) * PX);
    // mirror the staff horizontally about the grip so the crook faces right;
    // the pivot / hand attachment point is unchanged
    ctx.scale(-1, 1);
    if (staffRot) ctx.rotate(-staffRot);
    ctx.translate(-HAND.x * PX, -HAND.y * PX);
    ctx.drawImage(L.staff, 0, 0, W * PX, IMG_H * PX);
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
