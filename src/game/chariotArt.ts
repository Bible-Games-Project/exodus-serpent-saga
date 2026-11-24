// Egyptian archer chariot — the supplied pixel-art sprite (`enemy-chariot-v3-
// supplied.png`) separated only at the horse's legs and the wheel. The horse
// body, the archer (bow drawn, arrow nocked) and the cab stay intact while the
// four legs gallop underneath (diagonal pairs, like the spear knight's horse)
// and the wheel rolls in front of the cab. The art hides the far fore leg, so
// `chariot-v3-leg-fore-far.png` is the near one in shadow.
// The previous chariot (chariot-v2-*.png) is kept in assets for rollback.
import bodyAsset from "@/assets/chariot-v3-body.png";
import hindAAsset from "@/assets/chariot-v3-leg-hind-a.png";
import hindBAsset from "@/assets/chariot-v3-leg-hind-b.png";
import foreAsset from "@/assets/chariot-v3-leg-fore.png";
import foreFarAsset from "@/assets/chariot-v3-leg-fore-far.png";
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
const HIND_A = { x: 885, y: 742 } as const;
const HIND_B = { x: 955, y: 742 } as const;
const FORE = { x: 1303, y: 726 } as const;
/** The shadowed far fore leg stands a little ahead of the near one. */
const FAR_FORE_DX = 26;

let bodyImg: HTMLImageElement | null = null;
let hindAImg: HTMLImageElement | null = null;
let hindBImg: HTMLImageElement | null = null;
let foreImg: HTMLImageElement | null = null;
let foreFarImg: HTMLImageElement | null = null;
let wheelImg: HTMLImageElement | null = null;

function load(url: string): HTMLImageElement {
  const image = new Image();
  image.src = url;
  return image;
}

export function ensureChariotArt(): boolean {
  if (typeof document === "undefined") return false;
  if (!bodyImg) bodyImg = load(bodyAsset);
  if (!hindAImg) hindAImg = load(hindAAsset);
  if (!hindBImg) hindBImg = load(hindBAsset);
  if (!foreImg) foreImg = load(foreAsset);
  if (!foreFarImg) foreFarImg = load(foreFarAsset);
  if (!wheelImg) wheelImg = load(wheelAsset);
  return [bodyImg, hindAImg, hindBImg, foreImg, foreFarImg, wheelImg].every(image => image?.complete && image.naturalWidth > 0);
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
  if (!ensureChariotArt() || !bodyImg || !hindAImg || !hindBImg || !foreImg || !foreFarImg || !wheelImg) return;
  const { W, H, PX, CX, FOOT_Y } = CHARIOT_ART;
  const s = Math.sin(pose.phase);
  const bounce = Math.abs(Math.cos(pose.phase)) > 0.8 ? -1 : 0;
  // Recoil: the archer's whole rig nudges back a pixel as the arrow flies.
  const sh = pose.shoot;
  const recoil = sh != null && sh > CHARIOT_RELEASE_AT && sh < CHARIOT_RELEASE_AT + 0.15 ? -1 : 0;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(pose.x), Math.round(pose.groundY) + bounce);
  if (pose.flip === -1) ctx.scale(-1, 1);
  ctx.translate(-CX * PX + recoil, -FOOT_Y * PX);

  const leg = (img: HTMLImageElement, j: { x: number; y: number }, a: number, dx = 0) => {
    ctx.save();
    ctx.translate((j.x + dx) * PX, j.y * PX);
    ctx.rotate(a);
    ctx.translate(-(j.x + dx) * PX, -j.y * PX);
    // The swinging-back leg lifts its hoof off the ground.
    ctx.drawImage(img, dx * PX, (a < 0 ? a * 40 : 0) * PX, W * PX, H * PX);
    ctx.restore();
  };
  // Diagonal pairs alternate: far hind + near fore, then near hind + far fore.
  const amp = 0.3;
  leg(foreFarImg, FORE, -s * amp, FAR_FORE_DX);
  leg(hindAImg, HIND_A, s * amp);
  leg(hindBImg, HIND_B, -s * amp);
  leg(foreImg, FORE, s * amp);
  ctx.drawImage(bodyImg, 0, 0, W * PX, H * PX);

  // The wheel sits in front of the cab and rolls around its hub.
  ctx.save();
  ctx.translate(CHARIOT_WHEEL.X * PX, CHARIOT_WHEEL.Y * PX);
  ctx.rotate(pose.wheelAngle);
  ctx.drawImage(wheelImg, -CHARIOT_WHEEL.W * PX / 2, -CHARIOT_WHEEL.H * PX / 2, CHARIOT_WHEEL.W * PX, CHARIOT_WHEEL.H * PX);
  ctx.restore();
  ctx.restore();
}
