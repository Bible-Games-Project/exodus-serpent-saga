// Egyptian archer chariot — the supplied pixel-art sprite (`enemy-chariot-v3-
// supplied.png`) separated only at the horse's legs and the wheel. The horse
// body, the archer (bow drawn, arrow nocked) and the cab stay intact while the
// legs gallop underneath and the wheel rolls in front of the cab.
// The previous chariot (chariot-v2-*.png) is kept in assets for rollback.
import bodyAsset from "@/assets/chariot-v3-body.png";
import legHindAsset from "@/assets/chariot-v3-leg-hind.png";
import legForeAsset from "@/assets/chariot-v3-leg-fore.png";
import wheelAsset from "@/assets/chariot-v3-wheel.png";

export const CHARIOT_ART = {
  W: 1536,
  H: 1024,
  /** screen pixels per sprite pixel */
  PX: 0.125,
  /** x of the rig's centre inside the sprite */
  CX: 833,
  /** Bottom of the wheel and hooves. */
  FOOT_Y: 985,
} as const;

/** Wheel crop (centred on the hub) and the hub's position on the body. */
export const CHARIOT_WHEEL = { W: 320, H: 320, X: 343, Y: 814 } as const;

/** Bow grip / arrow release point inside the sprite (unflipped art drives RIGHT). */
export const CHARIOT_BOW = { x: 740, y: 182 } as const;

/** duration (seconds) of the draw + release; movement is never interrupted */
export const CHARIOT_SHOOT_DUR = 0.55;
/** progress at which the arrow leaves the bow */
export const CHARIOT_RELEASE_AT = 0.62;

/** Leg joints (rotation pivots at the top of each cut). */
const HIND = { x: 934, y: 742 } as const;
const FORE = { x: 1303, y: 726 } as const;

let bodyImg: HTMLImageElement | null = null;
let hindImg: HTMLImageElement | null = null;
let foreImg: HTMLImageElement | null = null;
let wheelImg: HTMLImageElement | null = null;

function load(url: string): HTMLImageElement {
  const image = new Image();
  image.src = url;
  return image;
}

export function ensureChariotArt(): boolean {
  if (typeof document === "undefined") return false;
  if (!bodyImg) bodyImg = load(bodyAsset);
  if (!hindImg) hindImg = load(legHindAsset);
  if (!foreImg) foreImg = load(legForeAsset);
  if (!wheelImg) wheelImg = load(wheelAsset);
  return [bodyImg, hindImg, foreImg, wheelImg].every(image => image?.complete && image.naturalWidth > 0);
}

export type ChariotPose = {
  x: number;
  groundY: number;
  flip: 1 | -1;
  /** drives the gallop */
  phase: number;
  wheelAngle: number;
  /** 0..1 progress of the shot; null = not shooting */
  shoot?: number | null;
};

/** Screen position of the bow's release point for a given pose. */
export function chariotBowPoint(pose: { x: number; groundY: number; flip: 1 | -1 }): { x: number; y: number } {
  const { PX, CX, FOOT_Y } = CHARIOT_ART;
  return {
    x: Math.round(pose.x + (CHARIOT_BOW.x - CX) * PX * pose.flip),
    y: Math.round(pose.groundY - (FOOT_Y - CHARIOT_BOW.y) * PX),
  };
}

export function drawChariotArt(ctx: CanvasRenderingContext2D, pose: ChariotPose): void {
  if (!ensureChariotArt() || !bodyImg || !hindImg || !foreImg || !wheelImg) return;
  const { W, H, PX, CX, FOOT_Y } = CHARIOT_ART;
  const s = Math.sin(pose.phase);
  const bounce = s > 0.35 ? -1 : 0;
  // Recoil: the archer's whole rig nudges back a pixel as the arrow flies.
  const sh = pose.shoot;
  const recoil = sh != null && sh > CHARIOT_RELEASE_AT && sh < CHARIOT_RELEASE_AT + 0.15 ? -1 : 0;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(pose.x), Math.round(pose.groundY) + bounce);
  if (pose.flip === -1) ctx.scale(-1, 1);
  ctx.translate(-CX * PX + recoil, -FOOT_Y * PX);

  const leg = (img: HTMLImageElement, j: { x: number; y: number }, a: number) => {
    ctx.save();
    ctx.translate(j.x * PX, j.y * PX);
    ctx.rotate(a);
    ctx.translate(-j.x * PX, -j.y * PX);
    ctx.drawImage(img, 0, (a < 0 ? a * 30 : 0) * PX, W * PX, H * PX);
    ctx.restore();
  };
  // Hind and fore legs swing in opposite phase under the complete body.
  leg(hindImg, HIND, s * 0.32);
  leg(foreImg, FORE, -s * 0.32);
  ctx.drawImage(bodyImg, 0, 0, W * PX, H * PX);

  // The wheel sits in front of the cab and rolls around its hub.
  ctx.save();
  ctx.translate(CHARIOT_WHEEL.X * PX, CHARIOT_WHEEL.Y * PX);
  ctx.rotate(pose.wheelAngle);
  ctx.drawImage(wheelImg, -CHARIOT_WHEEL.W * PX / 2, -CHARIOT_WHEEL.H * PX / 2, CHARIOT_WHEEL.W * PX, CHARIOT_WHEEL.H * PX);
  ctx.restore();
  ctx.restore();
}
