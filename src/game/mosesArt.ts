// Moses' artwork. The sprite is the user-supplied pixel-art PNG, split once into
// two layers (body + staff). The staff-holding arm is additionally lifted out of
// the body layer so it can hang naturally at his side, swing while he walks and
// carry the staff through his melee attack — the staff he already holds is the
// only staff ever drawn. No pixel is redrawn or recoloured.
import bodyAsset from "@/assets/moses-body.png.asset.json";
import staffAsset from "@/assets/moses-staff.png.asset.json";

export const MOSES_ART = {
  /** sprite-pixel size of each layer (native resolution of the supplied PNG) */
  W: 64,
  H: 96,
  /** screen pixels per sprite pixel — native density, art is never resampled */
  PX: 1,
  /** x of Moses' body centre inside the sprite (the staff sits to his right) */
  CX: 39,
  /** row just below the robe hem: everything from here down is feet/sandals */
  LEG_TOP: 83,
  /** the staff-side arm, lifted into its own layer */
  ARM: { x: 8, y: 33, w: 20, h: 19 },
  /** shoulder pivot of that arm inside the sprite */
  SHOULDER: { x: 26, y: 36 },
  /** hand (grip) position inside the original, un-rotated sprite */
  HAND0: { x: 13, y: 45 },
  /** rest rotation of the arm so it hangs down at his side */
  ARM_REST: -0.6,
  /** where the staff layer is gripped, in staff-layer pixels */
  GRIP0: { x: 17, y: 43 },
  /** crook (business end) of the staff, in staff-layer pixels */
  TIP0: { x: 5, y: 8 },
} as const;

let bodyImg: HTMLImageElement | null = null;
let staffImg: HTMLImageElement | null = null;
let bodyNoArm: HTMLCanvasElement | null = null;
let armLayer: HTMLCanvasElement | null = null;

function load(url: string): HTMLImageElement {
  const img = new Image();
  img.src = url;
  return img;
}

function buildLayers(): void {
  if (bodyNoArm || !bodyImg) return;
  const { W, H, ARM } = MOSES_ART;
  const full = document.createElement("canvas");
  full.width = W; full.height = H;
  const fc = full.getContext("2d")!;
  fc.imageSmoothingEnabled = false;
  fc.drawImage(bodyImg, 0, 0);

  const arm = document.createElement("canvas");
  arm.width = ARM.w; arm.height = ARM.h;
  const ac = arm.getContext("2d")!;
  ac.imageSmoothingEnabled = false;
  ac.drawImage(full, ARM.x, ARM.y, ARM.w, ARM.h, 0, 0, ARM.w, ARM.h);

  fc.clearRect(ARM.x, ARM.y, ARM.w, ARM.h);

  bodyNoArm = full;
  armLayer = arm;
}

export function ensureMosesArt(): boolean {
  if (typeof document === "undefined") return false;
  if (!bodyImg) bodyImg = load(bodyAsset.url);
  if (!staffImg) staffImg = load(staffAsset.url);
  const ready = !!(bodyImg.complete && bodyImg.naturalWidth && staffImg.complete && staffImg.naturalWidth);
  if (ready) buildLayers();
  return ready && !!bodyNoArm && !!armLayer;
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
  /** staff rotation in radians around the hand; 0 keeps the original pose */
  staffAngle: number;
  /** 0..1 melee swing progress, or null when not attacking */
  swing?: number | null;
  /** optional additive flash pass (invincibility) */
  flash?: number;
};

// ---- walk cycle tables (4 poses, 1-2px offsets: pure pixel-art motion) ----
const BOB = [-2, -1, 0, -1];
const SWAY = [0, 1, 0, -1];
// [dx, dy] for the leading and trailing leg on each pose
const LEG_A: readonly [number, number][] = [[-2, -2], [-1, 0], [1, 0], [0, 0]];
const LEG_B: readonly [number, number][] = [[1, 0], [0, 0], [-2, -2], [-1, 0]];
const ARM_SWING = [0.2, 0.05, -0.2, -0.05];

function walkFrame(walkPhase: number, moving: boolean): number {
  if (!moving) return -1;
  return ((Math.floor(walkPhase / (Math.PI / 2)) % 4) + 4) % 4;
}

function rot(vx: number, vy: number, a: number) {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: vx * c - vy * s, y: vx * s + vy * c };
}

/** Arm rotation for the given swing / walk state. */
export function mosesArmAngle(swing: number | null | undefined, walkPhase = 0, moving = false): number {
  const { ARM_REST } = MOSES_ART;
  if (swing != null) {
    const p = Math.max(0, Math.min(1, swing));
    // slight pull back, then the arm drives forward with the swing
    const lift = p < 0.28 ? -0.18 * (p / 0.28) : -0.18 + (1 - (1 - (p - 0.28) / 0.72) ** 2) * 0.75;
    return ARM_REST + lift;
  }
  const f = walkFrame(walkPhase, moving);
  return ARM_REST + (f < 0 ? 0 : ARM_SWING[f]);
}

/** Hand (grip) position in sprite pixels for a given arm angle. */
function handSprite(armAngle: number) {
  const { SHOULDER, HAND0, ARM_REST } = MOSES_ART;
  const v = rot(HAND0.x - SHOULDER.x, HAND0.y - SHOULDER.y, armAngle - ARM_REST + ARM_REST - ARM_REST + (armAngle - armAngle));
  // rotate the rest-pose hand vector by (armAngle - 0) — the arm layer itself is
  // drawn rotated by armAngle, so the same rotation applies to the hand.
  const w = rot(HAND0.x - SHOULDER.x, HAND0.y - SHOULDER.y, armAngle);
  void v;
  return { x: SHOULDER.x + w.x, y: SHOULDER.y + w.y };
}

/** Screen position of Moses' grip (staff pivot). */
export function mosesGrip(x: number, groundY: number, flip: 1 | -1, armAngle = MOSES_ART.ARM_REST) {
  const { PX, CX, H } = MOSES_ART;
  const h = handSprite(armAngle);
  return {
    x: x + (h.x - CX) * PX * flip,
    y: groundY - (H - h.y) * PX,
  };
}

/** Screen position of the staff's crook for a given pose — used by the wind slash. */
export function mosesStaffTip(
  x: number,
  groundY: number,
  flip: 1 | -1,
  staffAngle: number,
  armAngle = MOSES_ART.ARM_REST,
) {
  const { PX, GRIP0, TIP0 } = MOSES_ART;
  const grip = mosesGrip(x, groundY, flip, armAngle);
  const r = rot(TIP0.x - GRIP0.x, TIP0.y - GRIP0.y, staffAngle);
  return { x: grip.x + r.x * PX * flip, y: grip.y + r.y * PX };
}

/**
 * Draws Moses at native pixel density. The walk cycle re-stamps the existing
 * pixels with 1-2px offsets (legs, torso sway, body bob, arm swing) — nothing is
 * redrawn or resampled, so the character stays exactly as supplied.
 */
export function drawMosesArt(ctx: CanvasRenderingContext2D, pose: MosesPose): void {
  if (!ensureMosesArt() || !bodyNoArm || !armLayer || !staffImg) return;
  const { W, H, PX, CX, LEG_TOP, ARM, SHOULDER, GRIP0 } = MOSES_ART;
  const body = bodyNoArm;
  const f = walkFrame(pose.walkPhase, pose.moving);
  const bob = f < 0 ? 0 : BOB[f];
  const sway = f < 0 ? 0 : SWAY[f];
  const legA = f < 0 ? [0, 0] : LEG_A[f];
  const legB = f < 0 ? [0, 0] : LEG_B[f];
  const armAngle = mosesArmAngle(pose.swing, pose.walkPhase, pose.moving);
  const hand = handSprite(armAngle);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(pose.x), Math.round(pose.groundY + pose.bob));
  if (pose.flip === -1) ctx.scale(-1, 1);
  ctx.translate(-CX * PX, -H * PX);

  const paint = () => {
    // ---- staff: gripped by the hand, rotating around it ----
    ctx.save();
    ctx.translate((hand.x) * PX, (hand.y + bob) * PX);
    if (pose.staffAngle) ctx.rotate(pose.staffAngle);
    ctx.translate(-GRIP0.x * PX, -GRIP0.y * PX);
    ctx.drawImage(staffImg!, 0, 0, W * PX, H * PX);
    ctx.restore();

    // ---- body without the staff arm: torso + animated legs ----
    const legH = H - LEG_TOP;
    ctx.drawImage(body, 0, 0, W, LEG_TOP, sway * PX, bob * PX, W * PX, LEG_TOP * PX);
    if (f < 0) {
      ctx.drawImage(body, 0, LEG_TOP, W, legH, 0, LEG_TOP * PX, W * PX, legH * PX);
    } else {
      const half = 38;
      ctx.drawImage(
        body, 0, LEG_TOP, half, legH,
        legA[0] * PX, (LEG_TOP + legA[1]) * PX, half * PX, legH * PX,
      );
      ctx.drawImage(
        body, half, LEG_TOP, W - half, legH,
        (half + legB[0]) * PX, (LEG_TOP + legB[1]) * PX, (W - half) * PX, legH * PX,
      );
    }

    // ---- staff arm: hangs at his side, swings with the walk / attack ----
    ctx.save();
    ctx.translate(SHOULDER.x * PX, (SHOULDER.y + bob) * PX);
    ctx.rotate(armAngle);
    ctx.translate(-SHOULDER.x * PX, -SHOULDER.y * PX);
    ctx.drawImage(armLayer!, ARM.x * PX, ARM.y * PX, ARM.w * PX, ARM.h * PX);
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
