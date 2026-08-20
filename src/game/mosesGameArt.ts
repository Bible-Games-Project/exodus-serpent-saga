// Gameplay Moses.
//
// Two supplied sprites drive Moses entirely: a single idle pose and a 5-frame
// walking spritesheet. Both already contain his staff, so nothing is cut,
// masked or procedurally animated — the complete provided frames are blitted
// with nearest-neighbour scaling. Frames play 1..5 while he moves; when he
// stops, the idle sprite is shown.
//
// The only geometry we still expose is the grip/crook of the staff drawn inside
// the sprite, so the existing staff-attack wind FX (and its hitbox) can stay
// anchored to the staff.
//
// The Home / Main Menu keeps its own Moses art — untouched.
import sheetAsset from "@/assets/moses-walk5.png.asset.json";
import idleAsset from "@/assets/moses-idle.png.asset.json";

export const MOSES_ART = {
  /** sprite-pixel size of one frame */
  W: 64,
  IMG_H: 72,
  /** ground contact row (bottom of the sandals) */
  H: 64,
  /** screen pixels per sprite pixel */
  PX: 1.5,
  /** x of Moses' body centre inside the frame */
  CX: 26,
  /** number of frames in the walk sheet */
  FRAMES: 5,
  /** the hand gripping the staff inside the sprite — pivot for the melee FX */
  HAND: { x: 35, y: 45 },
  /** crook (business end of the staff) relative to HAND, in sprite pixels */
  TIP: { x: 2, y: -30 },
} as const;

let sheet: HTMLImageElement | null = null;
let idle: HTMLImageElement | null = null;

export function ensureMosesArt(): boolean {
  if (typeof document === "undefined") return false;
  if (!sheet) {
    sheet = new Image();
    sheet.src = sheetAsset.url;
  }
  if (!idle) {
    idle = new Image();
    idle.src = idleAsset.url;
  }
  return (
    sheet.complete && !!sheet.naturalWidth && idle.complete && !!idle.naturalWidth
  );
}

/**
 * Attack animation cadence. The 5 walk-sheet frames double as the swing poses:
 *   frame 1 → preparation, frame 2 → swing,
 *   frame 3 → IMPACT (wind FX + damage), frames 4/5 → follow-through & recovery.
 * The timings below keep the previous attack rhythm: the impact fires
 * WINDUP seconds after the attack starts, never earlier or later.
 */
export const MOSES_ATTACK = {
  /** seconds per attack frame */
  FRAME: 0.1,
  /** 0-based index of the impact frame (frame 3) */
  IMPACT_FRAME: 2,
  /** time from attack start until frame 3 lands = 2 frames of wind-up */
  WINDUP: 0.2,
  /** total animation length (5 frames) */
  DUR: 0.5,
} as const;

export type MosesPose = {
  /** screen position of Moses' feet (ground contact point) */
  x: number;
  groundY: number;
  flip: 1 | -1;
  walkPhase: number;
  moving: boolean;
  bob: number;
  /** kept for API compatibility — the staff lives inside the sprite now */
  staffAngle: number;
  /** 0..1 through the attack animation — overrides walk/idle frames */
  attackProgress?: number | null;
  flash?: number;
};


/** Staff rotation (radians) for a swing progress 0..1 — drives the wind FX. */
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

/** Draws gameplay Moses at native pixel density from the provided sprites. */
export function drawMosesArt(ctx: CanvasRenderingContext2D, pose: MosesPose): void {
  if (!ensureMosesArt() || !sheet || !idle) return;
  const { W, IMG_H, H, PX, CX, FRAMES } = MOSES_ART;

  // sequential playback while moving; the dedicated idle sprite when standing
  const frame = pose.moving
    ? ((Math.floor((pose.walkPhase / (Math.PI * 2)) * FRAMES) % FRAMES) + FRAMES) % FRAMES
    : -1;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(pose.x), Math.round(pose.groundY + pose.bob));
  if (pose.flip === -1) ctx.scale(-1, 1);
  ctx.translate(-CX * PX, -H * PX);

  const paint = () => {
    if (frame < 0) {
      ctx.drawImage(idle!, 0, 0, W, IMG_H, 0, 0, W * PX, IMG_H * PX);
    } else {
      ctx.drawImage(sheet!, frame * W, 0, W, IMG_H, 0, 0, W * PX, IMG_H * PX);
    }
  };


  paint();
  if (pose.flash && pose.flash > 0) {
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = pose.flash;
    paint();
  }
  ctx.restore();
}
