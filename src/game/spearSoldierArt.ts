// Egyptian spear soldier — the supplied pixel-art sprite, split once into four
// layers so it animates without a single pixel being redrawn:
//
//   body   — head, torso, kilt, throwing arm (drawn over the legs' overlap rows)
//   legb   — trailing leg + sandal
//   legf   — leading leg + sandal
//   held   — the spear he carries (hidden while a thrown spear is in the air)
import bodyAsset from "@/assets/spear-body.png.asset.json";
import legBAsset from "@/assets/spear-legb.png.asset.json";
import legFAsset from "@/assets/spear-legf.png.asset.json";
import heldAsset from "@/assets/spear-held.png.asset.json";
import flyAsset from "@/assets/spear-fly.png.asset.json";

export const SPEAR_SOLDIER_ART = {
  W: 70,
  H: 78,
  /** screen pixels per sprite pixel (matches the other Egyptian soldiers) */
  PX: 0.9,
  /** x of his body centre inside the sprite */
  CX: 37,
} as const;

/** duration (seconds) of the wind-up + throw animation */
export const SPEAR_THROW_DUR = 0.6;
/** progress at which the spear leaves his hand */
export const SPEAR_RELEASE_AT = 0.6;

/** flying-spear art: same pixels as the held spear, drawn tight */
export const SPEAR_FLY_ART = { W: 67, H: 24, PX: 0.9, ANGLE: -0.3684 } as const;

type Layers = {
  body: HTMLImageElement;
  legB: HTMLImageElement;
  legF: HTMLImageElement;
  held: HTMLImageElement;
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
      legB: load(legBAsset.url),
      legF: load(legFAsset.url),
      held: load(heldAsset.url),
      fly: load(flyAsset.url),
    };
  }
  const l = layers;
  return [l.body, l.legB, l.legF, l.held, l.fly].every((i) => i.complete && i.naturalWidth > 0);
}

/** Spear-arm offset (sprite px) across the throw: cock back, then snap forward. */
function throwOffset(progress: number): number {
  const p = Math.max(0, Math.min(1, progress));
  if (p < SPEAR_RELEASE_AT) return -4 * (p / SPEAR_RELEASE_AT);
  return -4 + 6 * ((p - SPEAR_RELEASE_AT) / (1 - SPEAR_RELEASE_AT));
}

export type SpearSoldierPose = {
  x: number;
  groundY: number;
  flip: 1 | -1;
  walkPhase: number;
  moving: boolean;
  /** 0..1 progress of the throw; null = idle */
  throwP?: number | null;
};

export function drawSpearSoldierArt(ctx: CanvasRenderingContext2D, pose: SpearSoldierPose): void {
  if (!ensureSpearSoldierArt() || !layers) return;
  const { W, H, PX, CX } = SPEAR_SOLDIER_ART;
  const l = layers;

  const t = pose.throwP;
  const throwing = t != null && t > 0 && t < 1;
  // Forward/backward stride along the facing direction (never sideways).
  const swing = pose.moving && !throwing ? Math.sin(pose.walkPhase) : 0;
  const stepF = Math.round(swing * 2);
  const stepB = -stepF;
  const liftF = swing !== 0 && stepF > 0 ? -1 : 0;
  const liftB = swing !== 0 && stepB > 0 ? -1 : 0;
  const armStep = throwing ? throwOffset(t) : -stepF;
  const armLift = throwing ? -1 : swing > 0 ? -1 : 0;
  // the held spear vanishes the instant it is released
  const released = t != null && t >= SPEAR_RELEASE_AT;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(pose.x), Math.round(pose.groundY));
  if (pose.flip === -1) ctx.scale(-1, 1);
  ctx.translate(-CX * PX, -H * PX);

  const stamp = (img: HTMLImageElement, dx: number, dy: number) => {
    ctx.drawImage(img, dx * PX, dy * PX, W * PX, H * PX);
  };

  stamp(l.legB, stepB, liftB);
  stamp(l.legF, stepF, liftF);
  stamp(l.body, 0, 0);
  if (!released) stamp(l.held, armStep, armLift);
  ctx.restore();
}

/** Draws a thrown spear, oriented along its flight angle. */
export function drawFlyingSpear(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number): boolean {
  if (!ensureSpearSoldierArt() || !layers) return false;
  const { W, H, PX, ANGLE } = SPEAR_FLY_ART;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(x, y);
  ctx.rotate(angle - ANGLE);
  ctx.drawImage(layers.fly, (-W * PX) / 2, (-H * PX) / 2, W * PX, H * PX);
  ctx.restore();
  return true;
}
