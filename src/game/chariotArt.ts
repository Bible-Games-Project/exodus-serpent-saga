// Egyptian archer chariot — the supplied pixel-art sprite separated only at
// the horses' legs and wheel. Both horse bodies, their riders and the cab stay
// intact while the feet stride underneath and the wheel visibly rolls.
import rigUrl from "@/assets/chariot-rig.png";
import legsAUrl from "@/assets/chariot-legs-a.png";
import legsBUrl from "@/assets/chariot-legs-b.png";
import wheelUrl from "@/assets/chariot-wheel.png";

export const CHARIOT_ART = {
  W: 192,
  H: 124,
  /** screen pixels per sprite pixel */
  /** Matches the mounted spear knight's 168px-wide rendered footprint. */
  PX: 0.875,
  /** x of the rig's centre inside the sprite */
  CX: 96,
} as const;

/** Bow/string release point inside the sprite (unflipped art drives RIGHT). */
export const CHARIOT_BOW = { x: 79, y: 28 } as const;

/** duration (seconds) of the draw + release; movement is never interrupted */
export const CHARIOT_SHOOT_DUR = 0.55;
/** progress at which the arrow leaves the bow */
export const CHARIOT_RELEASE_AT = 0.62;

let rigImg: HTMLImageElement | null = null;
let legsAImg: HTMLImageElement | null = null;
let legsBImg: HTMLImageElement | null = null;
let wheelImg: HTMLImageElement | null = null;

function load(url: string): HTMLImageElement {
  const image = new Image();
  image.src = url;
  return image;
}

export function ensureChariotArt(): boolean {
  if (typeof document === "undefined") return false;
  if (!rigImg) rigImg = load(rigUrl);
  if (!legsAImg) legsAImg = load(legsAUrl);
  if (!legsBImg) legsBImg = load(legsBUrl);
  if (!wheelImg) wheelImg = load(wheelUrl);
  return [rigImg, legsAImg, legsBImg, wheelImg].every(image => image!.complete && image!.naturalWidth > 0);
}

export type ChariotPose = {
  x: number;
  groundY: number;
  flip: 1 | -1;
  /** drives the gallop bounce */
  phase: number;
  /** 0..1 progress of the shot; null = not shooting */
  shoot?: number | null;
};

/** Screen position of the bow's release point for a given pose. */
export function chariotBowPoint(pose: { x: number; groundY: number; flip: 1 | -1 }): { x: number; y: number } {
  const { PX, CX, H } = CHARIOT_ART;
  return {
    x: Math.round(pose.x + (CHARIOT_BOW.x - CX) * PX * pose.flip),
    y: Math.round(pose.groundY - (H - CHARIOT_BOW.y) * PX),
  };
}

export function drawChariotArt(ctx: CanvasRenderingContext2D, pose: ChariotPose): void {
  if (!ensureChariotArt() || !rigImg || !legsAImg || !legsBImg || !wheelImg) return;
  const { W, H, PX, CX } = CHARIOT_ART;
  const bounce = Math.sin(pose.phase) > 0.35 ? -1 : 0;
  const stride = Math.sin(pose.phase) * 2.4;
  const liftA = Math.max(0, Math.sin(pose.phase)) * -2;
  const liftB = Math.max(0, -Math.sin(pose.phase)) * -2;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(pose.x), Math.round(pose.groundY) + bounce);
  if (pose.flip === -1) ctx.scale(-1, 1);
  ctx.translate(-CX * PX, -H * PX);

  // Wheel turns around its real axle while the rest of the chariot remains
  // fixed to the rig. The source wheel is still the supplied artwork.
  ctx.save();
  ctx.translate(29 * PX, 101 * PX);
  ctx.rotate(pose.phase * 0.32);
  ctx.translate(-29 * PX, -101 * PX);
  ctx.drawImage(wheelImg, 0, 0, W * PX, H * PX);
  ctx.restore();

  // Opposing horse-leg groups produce a four-beat gallop. Their masks overlap
  // beneath the belly, and the complete bodies are stamped over those joints.
  ctx.drawImage(legsAImg, stride * PX, liftA * PX, W * PX, H * PX);
  ctx.drawImage(legsBImg, -stride * PX, liftB * PX, W * PX, H * PX);
  ctx.drawImage(rigImg, 0, 0, W * PX, H * PX);
  ctx.restore();

  // Nocked arrow on the string: pulled back, then gone the instant it flies.
  const s = pose.shoot;
  if (s != null && s > 0 && s < CHARIOT_RELEASE_AT) {
    const pull = 5 * (s / CHARIOT_RELEASE_AT);
    const bow = chariotBowPoint(pose);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(bow.x, bow.y + bounce);
    if (pose.flip === -1) ctx.scale(-1, 1);
    ctx.fillStyle = "#6b421f";
    ctx.fillRect(-14 - pull, -1, 16, 2);
    ctx.fillStyle = "#e8d08a";
    ctx.fillRect(1 - pull, -1, 3, 2);
    ctx.restore();
  }
}
