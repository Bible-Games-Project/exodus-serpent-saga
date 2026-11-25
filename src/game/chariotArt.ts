// Egyptian archer chariot — the supplied pixel-art sprite (`enemy-chariot-v3-
// supplied.png`) separated only at the horse's legs and the wheel. The horse
// body, the archer (bow drawn, arrow nocked) and the cab stay intact while the
// four legs gallop underneath (diagonal pairs, like the spear knight's horse)
// and the wheel rolls in front of the cab. The art hides the far fore leg, so
// `chariot-v3-leg-fore-far.png` is the near one in shadow.
// v4 (2026-11-25): the wheel layer is trimmed to the rim (it used to carry
// bits of the cab that spun with it) and the body's copy of the wheel is gone
// below the cab, so only one wheel turns. Each leg is cut at the knee / hock
// and the fetlock (chariot-v4-leg-<id>-a/b/c.png, see horseGait.ts) so the
// horse gallops with folding legs. The v3 layers and the previous chariot
// (chariot-v2-*.png) are kept in assets for rollback.
import bodyAsset from "@/assets/chariot-v4-body.png";
import wheelAsset from "@/assets/chariot-v4-wheel.png";
import hindAa from "@/assets/chariot-v4-leg-hind-a-a.png";
import hindAb from "@/assets/chariot-v4-leg-hind-a-b.png";
import hindAc from "@/assets/chariot-v4-leg-hind-a-c.png";
import hindBa from "@/assets/chariot-v4-leg-hind-b-a.png";
import hindBb from "@/assets/chariot-v4-leg-hind-b-b.png";
import hindBc from "@/assets/chariot-v4-leg-hind-b-c.png";
import foreA from "@/assets/chariot-v4-leg-fore-a.png";
import foreB from "@/assets/chariot-v4-leg-fore-b.png";
import foreC from "@/assets/chariot-v4-leg-fore-c.png";
import foreFarA from "@/assets/chariot-v4-leg-fore-far-a.png";
import foreFarB from "@/assets/chariot-v4-leg-fore-far-b.png";
import foreFarC from "@/assets/chariot-v4-leg-fore-far-c.png";
import { drawHorseLeg, GALLOP_OFFSETS, HORSE_GALLOP, horseLegPose, type HorseLegRig } from "./horseGait";

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

/** Leg rigs (sprite px); pieces and pivots from split-horse-legs.mjs. */
const HIND_A: HorseLegRig = { kind: "hind", hip: { x: 885, y: 742 }, knee: [857, 785], fetlock: [882, 898], seg: [[853, 720, 59, 65], [846, 775, 55, 123], [840, 888, 87, 106]] };
const HIND_B: HorseLegRig = { kind: "hind", hip: { x: 955, y: 742 }, knee: [902, 790], fetlock: [970, 898], seg: [[898, 720, 123, 70], [898, 780, 78, 118], [926, 888, 102, 109]] };
const FORE: HorseLegRig = { kind: "fore", hip: { x: 1303, y: 726 }, knee: [1303, 790], fetlock: [1291, 892], seg: [[1236, 704, 126, 86], [1247, 780, 69, 112], [1246, 882, 96, 112]] };
/** The shadowed far fore leg stands a little ahead of the near one. */
const FAR_FORE_DX = 26;

let bodyImg: HTMLImageElement | null = null;
let wheelImg: HTMLImageElement | null = null;
let legImgs: { hindA: HTMLImageElement[]; hindB: HTMLImageElement[]; fore: HTMLImageElement[]; foreFar: HTMLImageElement[] } | null = null;

function load(url: string): HTMLImageElement {
  const image = new Image();
  image.src = url;
  return image;
}

export function ensureChariotArt(): boolean {
  if (typeof document === "undefined") return false;
  if (!bodyImg) bodyImg = load(bodyAsset);
  if (!wheelImg) wheelImg = load(wheelAsset);
  if (!legImgs) legImgs = {
    hindA: [hindAa, hindAb, hindAc].map(load),
    hindB: [hindBa, hindBb, hindBc].map(load),
    fore: [foreA, foreB, foreC].map(load),
    foreFar: [foreFarA, foreFarB, foreFarC].map(load),
  };
  const l = legImgs;
  return [bodyImg, wheelImg, ...l.hindA, ...l.hindB, ...l.fore, ...l.foreFar].every(image => image.complete && image.naturalWidth > 0);
}

export type ChariotPose = {
  x: number;
  groundY: number;
  flip: 1 | -1;
  /** drives the gallop (radians; one stride = 2π) */
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
  if (!ensureChariotArt() || !bodyImg || !wheelImg || !legImgs) return;
  const { W, H, PX, CX, FOOT_Y } = CHARIOT_ART;
  const u = pose.phase / (Math.PI * 2);
  // The rig lifts a pixel in the gallop's moment of suspension.
  const bounce = Math.sin(Math.PI * 2 * (u - 0.62)) > 0.5 ? -1 : 0;
  // Recoil: the archer's whole rig nudges back a pixel as the arrow flies.
  const sh = pose.shoot;
  const recoil = sh != null && sh > CHARIOT_RELEASE_AT && sh < CHARIOT_RELEASE_AT + 0.15 ? -1 : 0;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(pose.x), Math.round(pose.groundY) + bounce);
  if (pose.flip === -1) ctx.scale(-1, 1);
  ctx.translate(-CX * PX + recoil, -FOOT_Y * PX);

  // Far legs first (far fore, far hind), then the near ones.
  const g = GALLOP_OFFSETS;
  const l = legImgs;
  drawHorseLeg(ctx, l.foreFar, FORE, horseLegPose(u + g.foreFar, "fore", HORSE_GALLOP), PX, FAR_FORE_DX);
  drawHorseLeg(ctx, l.hindA, HIND_A, horseLegPose(u + g.hindFar, "hind", HORSE_GALLOP), PX);
  drawHorseLeg(ctx, l.hindB, HIND_B, horseLegPose(u + g.hindNear, "hind", HORSE_GALLOP), PX);
  drawHorseLeg(ctx, l.fore, FORE, horseLegPose(u + g.foreNear, "fore", HORSE_GALLOP), PX);
  ctx.drawImage(bodyImg, 0, 0, W * PX, H * PX);

  // The wheel sits in front of the cab and rolls around its hub.
  ctx.save();
  ctx.translate(CHARIOT_WHEEL.X * PX, CHARIOT_WHEEL.Y * PX);
  ctx.rotate(pose.wheelAngle);
  ctx.drawImage(wheelImg, -CHARIOT_WHEEL.W * PX / 2, -CHARIOT_WHEEL.H * PX / 2, CHARIOT_WHEEL.W * PX, CHARIOT_WHEEL.H * PX);
  ctx.restore();
  ctx.restore();
}
