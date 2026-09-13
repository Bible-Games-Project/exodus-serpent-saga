// Egyptian archer chariot — the supplied pixel-art sprite separated only at
// the horses' legs and wheel. Both horse bodies, their riders and the cab stay
// intact while the feet stride underneath and the wheel visibly rolls.
import bodyAsset from "@/assets/chariot-v2-body.png.asset.json";
import legBAsset from "@/assets/chariot-v2-legb.png.asset.json";
import legFAsset from "@/assets/chariot-v2-legf.png.asset.json";
import wheelAsset from "@/assets/chariot-v2-wheel.png.asset.json";

export const CHARIOT_ART = {
  W: 1536,
  H: 1024,
  /** screen pixels per sprite pixel */
  /** Matches the mounted spear knight's 168px-wide rendered footprint. */
  PX: 0.125,
  /** x of the rig's centre inside the sprite */
  CX: 760,
} as const;

export const CHARIOT_WHEEL = { W: 1254, H: 1254, PX: 0.056, X: 300, Y: 738 } as const;

/** Bow/string release point inside the sprite (unflipped art drives RIGHT). */
export const CHARIOT_BOW = { x: 575, y: 215 } as const;

/** duration (seconds) of the draw + release; movement is never interrupted */
export const CHARIOT_SHOOT_DUR = 0.55;
/** progress at which the arrow leaves the bow */
export const CHARIOT_RELEASE_AT = 0.62;

let bodyImg: HTMLImageElement | null = null;
let legBImg: HTMLImageElement | null = null;
let legFImg: HTMLImageElement | null = null;
let wheelImg: HTMLImageElement | null = null;

function load(url: string): HTMLImageElement {
  const image = new Image();
  image.src = url;
  return image;
}

export function ensureChariotArt(): boolean {
  if (typeof document === "undefined") return false;
  if (!bodyImg) bodyImg = load(bodyAsset.url);
  if (!legBImg) legBImg = load(legBAsset.url);
  if (!legFImg) legFImg = load(legFAsset.url);
  if (!wheelImg) wheelImg = load(wheelAsset.url);
  return [bodyImg, legBImg, legFImg, wheelImg].every(image => image?.complete && image.naturalWidth > 0);
}

export type ChariotPose = {
  x: number;
  groundY: number;
  flip: 1 | -1;
  /** drives the gallop bounce */
  phase: number;
  wheelAngle: number;
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
  if (!ensureChariotArt() || !bodyImg || !legBImg || !legFImg || !wheelImg) return;
  const { W, H, PX, CX } = CHARIOT_ART;
  const bounce = Math.sin(pose.phase) > 0.35 ? -1 : 0;
  const stride = Math.sin(pose.phase) * 22;
  const liftA = Math.max(0, Math.sin(pose.phase)) * -14;
  const liftB = Math.max(0, -Math.sin(pose.phase)) * -14;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(pose.x), Math.round(pose.groundY) + bounce);
  if (pose.flip === -1) ctx.scale(-1, 1);
  ctx.translate(-CX * PX, -H * PX);

  // The supplied wheel remains a separate, undeformed sprite rotating around
  // the fixed axle on the supplied wheel-less chariot.
  ctx.save();
  ctx.translate(CHARIOT_WHEEL.X * PX, CHARIOT_WHEEL.Y * PX);
  ctx.rotate(pose.wheelAngle);
  ctx.drawImage(
    wheelImg,
    -CHARIOT_WHEEL.W * CHARIOT_WHEEL.PX / 2,
    -CHARIOT_WHEEL.H * CHARIOT_WHEEL.PX / 2,
    CHARIOT_WHEEL.W * CHARIOT_WHEEL.PX,
    CHARIOT_WHEEL.H * CHARIOT_WHEEL.PX,
  );
  ctx.restore();

  // Opposing horse-leg groups produce a four-beat gallop. Their masks overlap
  // beneath the belly, and the complete bodies are stamped over those joints.
  ctx.drawImage(legBImg, -stride * PX, liftB * PX, W * PX, H * PX);
  ctx.drawImage(legFImg, stride * PX, liftA * PX, W * PX, H * PX);
  ctx.drawImage(bodyImg, 0, 0, W * PX, H * PX);
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
