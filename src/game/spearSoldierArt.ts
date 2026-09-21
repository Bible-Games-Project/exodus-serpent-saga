// Egyptian spear soldier — the supplied PNG. The complete torso and clothing
// stay intact; only the legs are separated for walking. A second body layer is
// the same supplied art with the exposed spear removed for the release frame.
//
//   body   — head, torso, kilt, arms and held spear
//   legb   — trailing leg + sandal
//   legf   — leading leg + sandal
import bodyAsset from "@/assets/spear-v2-body.png.asset.json";
import releasedAsset from "@/assets/spear-v2-released-fixed.png.asset.json";
import legBAsset from "@/assets/spear-v2-legb.png.asset.json";
import legFAsset from "@/assets/spear-v2-legf.png.asset.json";
// The thrown spear is the supplied spear PNG, used exactly as provided.
import flyAsset from "@/assets/spear-fly2.png.asset.json";

export const SPEAR_SOLDIER_ART = {
  W: 1024,
  H: 1536,
  PX: 0.066,
  /** x of his body centre inside the sprite */
  CX: 372,
} as const;

/** duration (seconds) of the wind-up + throw animation */
export const SPEAR_THROW_DUR = 0.6;
/** progress at which the spear leaves his hand */
export const SPEAR_RELEASE_AT = 0.6;

/** flying-spear art: the supplied spear PNG; ANGLE is its resting tilt */
export const SPEAR_FLY_ART = { W: 175, H: 114, PX: 0.32, ANGLE: -0.5216 } as const;

type Layers = {
  body: HTMLImageElement;
  released: HTMLImageElement;
  legB: HTMLImageElement;
  legF: HTMLImageElement;
  fly: HTMLImageElement;
};
let layers: Layers | null = null;

function load(url: string): HTMLImageElement {
  const img = new Image();
  img.src = url;
  return img;
}

export function ensureSpearSoldierArt(): boolean {
  if (typeof document === "undefined") return false;
  if (!layers) {
    layers = {
      body: load(bodyAsset.url),
      released: load(releasedAsset.url),
      legB: load(legBAsset.url),
      legF: load(legFAsset.url),
      fly: load(flyAsset.url),
    };
  }
  const l = layers;
  // Idle and walking only depend on the body and legs. A delayed secondary
  // frame or projectile image must never make the whole soldier disappear.
  return [l.body, l.legB, l.legF].every((i) => i.complete && i.naturalWidth > 0);
}

export type SpearSoldierPose = {
  x: number;
  groundY: number;
  flip: 1 | -1;
  walkPhase: number;
  moving: boolean;
  /** 0..1 progress of the throw; null = idle */
  throwP?: number | null;
  /** false from release until the separate thrown projectile is removed */
  holdingSpear: boolean;
};

export function drawSpearSoldierArt(ctx: CanvasRenderingContext2D, pose: SpearSoldierPose): void {
  if (!ensureSpearSoldierArt() || !layers) return;
  const { W, H, PX, CX } = SPEAR_SOLDIER_ART;
  const l = layers;

  const t = pose.throwP;
  const throwing = t != null && t > 0 && t < 1;
  // Forward/backward stride along the facing direction (never sideways).
  const swing = pose.moving && !throwing ? Math.sin(pose.walkPhase) : 0;
  const stepF = Math.round(swing * 2.2);
  const stepB = -stepF;
  const liftF = swing !== 0 && stepF > 0 ? -1 : 0;
  const liftB = swing !== 0 && stepB > 0 ? -1 : 0;
  // the held spear vanishes the instant it is released
  const released = !pose.holdingSpear || (t != null && t >= SPEAR_RELEASE_AT);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(pose.x), Math.round(pose.groundY));
  if (pose.flip === -1) ctx.scale(-1, 1);
  ctx.translate(-CX * PX, -H * PX);

  const stamp = (img: HTMLImageElement, dx: number, dy: number) => {
    ctx.drawImage(img, dx * PX, dy * PX, W * PX, H * PX);
  };

  stamp(l.legB, stepB * 7, liftB * 8);
  stamp(l.legF, stepF * 7, liftF * 8);
  // Wind-up moves the intact supplied pose as one unit; no torso seam is made.
  const windup = throwing && t < SPEAR_RELEASE_AT ? -Math.round((t / SPEAR_RELEASE_AT) * 10) : 0;
  const releasedReady = l.released.complete && l.released.naturalWidth > 0;
  stamp(released && releasedReady ? l.released : l.body, windup, throwing ? -4 : 0);
  ctx.restore();
}

/** Draws a thrown spear, oriented along its flight angle. */
export function drawFlyingSpear(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number): boolean {
  if (typeof document === "undefined") return false;
  if (!layers) ensureSpearSoldierArt();
  if (!layers || !layers.fly.complete || layers.fly.naturalWidth <= 0) return false;
  const { W, H, PX, ANGLE } = SPEAR_FLY_ART;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(x, y);
  ctx.rotate(angle - ANGLE);
  ctx.drawImage(layers.fly, (-W * PX) / 2, (-H * PX) / 2, W * PX, H * PX);
  ctx.restore();
  return true;
}
