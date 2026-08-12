// Moses' artwork.
//
// The sprite is the user-supplied pixel-art PNG, split once into complete,
// non-overlapping layers so that every animation is a whole-part translation or
// rotation — no pixel of the robe is ever cut, clipped or resampled:
//
//   torso  — head, robe and both sleeves (rows 0..LEG_TOP-1), one clean piece
//   legs   — back leg and front leg, each a complete foot piece
//   hands  — the relaxed rear hand and the forward hand that grips the staff
//   staff  — the shepherd's crook, held by the forward hand
//
// Base pose: both arms hang naturally downward and the staff sits in the hand on
// the side Moses faces. Walking alternates the feet with a crossed (opposite)
// arm swing, a one-pixel torso bob and a subtle staff sway. The melee attack
// rotates the staff *and* the gripping hand around that hand, so the staff he
// already holds is the one that swings.
import torsoUrl from "@/assets/moses-torso.png";
import legBackUrl from "@/assets/moses-leg-back.png";
import legFrontUrl from "@/assets/moses-leg-front.png";
import staffUrl from "@/assets/moses-staff2.png";
import handUrl from "@/assets/moses-hand.png";
import handBackUrl from "@/assets/moses-hand-back.png";

export const MOSES_ART = {
  /** sprite-pixel size of every layer (shared canvas, so layers align at 0,0) */
  W: 80,
  H: 96,
  /** screen pixels per sprite pixel — native density, art is never resampled */
  PX: 1,
  /** x of Moses' body centre inside the sprite */
  CX: 39,
  /** first row of the feet layers */
  LEG_TOP: 83,
  /** the forward hand's grip on the staff — pivot for the melee swing */
  HAND: { x: 56, y: 77 },
  /** crook (business end of the staff) relative to HAND, in sprite pixels */
  TIP: { x: 11, y: -68 },
} as const;

type Layers = {
  torso: HTMLImageElement;
  legBack: HTMLImageElement;
  legFront: HTMLImageElement;
  staff: HTMLImageElement;
  hand: HTMLImageElement;
  handBack: HTMLImageElement;
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
      torso: load(torsoUrl),
      legBack: load(legBackUrl),
      legFront: load(legFrontUrl),
      staff: load(staffUrl),
      hand: load(handUrl),
      handBack: load(handBackUrl),
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
  /** walk cycle driver; pass 0 and moving=false for idle */
  walkPhase: number;
  moving: boolean;
  /** extra vertical offset in screen px (bob) */
  bob: number;
  /** staff rotation in radians around the forward hand; 0 keeps the base pose */
  staffAngle: number;
  /** optional additive flash pass (invincibility) */
  flash?: number;
};

/** Staff rotation (radians, around the forward hand) for a swing progress 0..1. */
export function mosesSwingAngle(progress: number): number {
  const p = Math.max(0, Math.min(1, progress));
  // Short wind-up that lifts the crook back, then a fast forward/downward sweep.
  if (p < 0.28) return -0.5 * (p / 0.28);
  const t = (p - 0.28) / 0.72;
  return -0.5 + (1 - (1 - t) * (1 - t)) * 2.5;
}

/** Screen position of the staff's crook for a given pose — used by the wind slash. */
export function mosesStaffTip(x: number, groundY: number, flip: 1 | -1, angle: number) {
  const { PX, TIP } = MOSES_ART;
  const c = Math.cos(angle), s = Math.sin(angle);
  const rx = (TIP.x * c - TIP.y * s) * PX;
  const ry = (TIP.x * s + TIP.y * c) * PX;
  return { x: x + rx * flip, y: groundY + ry };
}

/** Screen position of Moses' grip (staff pivot). */
export function mosesGrip(x: number, groundY: number, flip: 1 | -1) {
  const { PX, CX, H, HAND } = MOSES_ART;
  return {
    x: x + (HAND.x - CX) * PX * flip,
    y: groundY - (H - HAND.y) * PX,
  };
}

/** Distance (screen px) from the grip to the crook — melee reach. */
export const MOSES_STAFF_LEN = Math.hypot(MOSES_ART.TIP.x, MOSES_ART.TIP.y) * MOSES_ART.PX;

/**
 * Draws Moses at native pixel density from his complete layers.
 * Every frame is built from whole-piece offsets, so the robe silhouette stays
 * coherent through the whole walk cycle and the swing.
 */
export function drawMosesArt(ctx: CanvasRenderingContext2D, pose: MosesPose): void {
  if (!ensureMosesArt() || !layers) return;
  const { W, H, PX, CX, HAND } = MOSES_ART;
  const L = layers;

  // ---- walk cycle: whole-piece offsets (integer sprite pixels) ----
  const sw = pose.moving ? Math.sin(pose.walkPhase) : 0;
  const stride = pose.moving ? Math.round(sw * 2) : 0;
  const frontDX = stride;
  const backDX = -stride;
  const frontLift = pose.moving ? -Math.max(0, Math.round(sw * 1.6)) : 0;
  const backLift = pose.moving ? -Math.max(0, Math.round(-sw * 1.6)) : 0;
  // torso bobs twice per stride and sways one pixel with the leading leg
  const torsoDY = pose.moving ? (Math.sin(pose.walkPhase * 2) > 0 ? -1 : 0) : 0;
  const torsoDX = pose.moving ? Math.round(sw * 0.6) : 0;
  // arms swing opposite the legs (right foot forward -> left arm forward)
  const staffArmDX = pose.moving ? -Math.round(sw * 1.4) : 0;
  const relaxedArmDX = pose.moving ? Math.round(sw * 1.4) : 0;
  // the held staff gets a very subtle sway from the walking motion
  const walkSway = pose.moving ? Math.sin(pose.walkPhase) * 0.035 : 0;
  const staffRot = pose.staffAngle + (pose.staffAngle ? 0 : walkSway);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(pose.x), Math.round(pose.groundY + pose.bob));
  if (pose.flip === -1) ctx.scale(-1, 1);
  ctx.translate(-CX * PX, -H * PX);

  const stamp = (img: HTMLImageElement, dx: number, dy: number) => {
    ctx.drawImage(img, dx * PX, dy * PX, W * PX, H * PX);
  };

  const paint = () => {
    // feet first (they sit behind the robe hem)
    stamp(L.legBack, backDX, backLift);
    stamp(L.legFront, frontDX, frontLift);
    // one clean robe/body piece
    stamp(L.torso, torsoDX, torsoDY);
    // rear arm's hand, relaxed and swinging opposite the front leg
    stamp(L.handBack, torsoDX + relaxedArmDX, torsoDY);
    // staff, pivoting on the forward hand
    ctx.save();
    ctx.translate((HAND.x + torsoDX + staffArmDX) * PX, (HAND.y + torsoDY) * PX);
    if (staffRot) ctx.rotate(staffRot);
    ctx.translate(-HAND.x * PX, -HAND.y * PX);
    ctx.drawImage(L.staff, 0, 0, W * PX, H * PX);
    // the gripping hand rides with the staff so it never lets go
    ctx.drawImage(L.hand, 0, 0, W * PX, H * PX);
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
