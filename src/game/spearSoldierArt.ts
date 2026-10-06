// The character is weapon-free in every frame. The held spear is a separate
// layer, and the original supplied flying spear remains the projectile.
// Layers derived from the original supplied PNG: spear-free body, the complete
// held spear (with the gripping fist), and two complete legs.
import bodyAsset from "@/assets/spear-v3-body.png.asset.json";
import heldAsset from "@/assets/spear-v3-held.png.asset.json";
import legBAsset from "@/assets/spear-v3-legb.png.asset.json";
import legFAsset from "@/assets/spear-v3-legf.png.asset.json";
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
  character: HTMLImageElement;
  held: HTMLImageElement;
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
      character: load(bodyAsset.url),
      held: load(heldAsset.url),
      legB: load(legBAsset.url),
      legF: load(legFAsset.url),
      fly: load(flyAsset.url),
    };
  }
  const l = layers;
  return [l.character, l.held, l.legB, l.legF, l.fly].every((i) => i.complete && i.naturalWidth > 0);
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
  const stride = pose.moving && !throwing ? Math.sin(pose.walkPhase) : 0;
  const knee = pose.moving && !throwing ? Math.cos(pose.walkPhase) : 0;
  const liftF = Math.max(0, stride) * 8;
  const liftB = Math.max(0, -stride) * 8;
  const released = !pose.holdingSpear || (t != null && t >= SPEAR_RELEASE_AT);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(pose.x), Math.round(pose.groundY));
  if (pose.flip === -1) ctx.scale(-1, 1);
  ctx.translate(-CX * PX, -H * PX);

  const stamp = (img: HTMLImageElement, dx: number, dy: number) => {
    ctx.drawImage(img, dx * PX, dy * PX, W * PX, H * PX);
  };

  // Each complete leg swings around its own hip, tucked under the kilt; the
  // forward foot lifts slightly while the other one plants.
  const HIP = { x: 380, y: 1150 };
  const leg = (img: HTMLImageElement, angle: number, lift: number) => {
    ctx.save();
    ctx.translate(HIP.x * PX, HIP.y * PX);
    ctx.rotate(angle);
    ctx.translate(-HIP.x * PX, -HIP.y * PX);
    stamp(img, 0, -lift);
    ctx.restore();
  };
  leg(l.legB, -stride * 0.12, liftB);
  leg(l.legF, stride * 0.12, liftF);
  // Body + head + arms stay one intact piece; a gentle bob with the stride.
  const bob = pose.moving && !throwing ? -Math.abs(knee) * 6 : 0;
  const windup = throwing && t < SPEAR_RELEASE_AT ? -Math.round((t / SPEAR_RELEASE_AT) * 10) : 0;
  stamp(l.character, windup, (throwing ? -4 : 0) + bob);
  // The complete held spear is its own layer; it vanishes entirely at release.
  if (!released) stamp(l.held, windup, (throwing ? -4 : 0) + bob);
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
