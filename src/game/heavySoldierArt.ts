// Egyptian armored greatsword soldier — the supplied PNG, kept at its original
// proportions. Only the two legs are separated for walking; the helmet, torso,
// armour, clothing, hands and complete two-handed weapon remain one intact body.
//
//   body  — the complete upper figure and greatsword
//   legb  — trailing leg + sandal
//   legf  — leading leg + sandal
import bodyAsset from "@/assets/armored-soldier-body.png.asset.json";
import legBAsset from "@/assets/armored-soldier-legb.png.asset.json";
import legFAsset from "@/assets/armored-soldier-legf.png.asset.json";

export const HEAVY_ART = {
  /** sprite-pixel size of the shared layer canvas */
  W: 1024,
  H: 1536,
  /** Keeps the replacement at the Heavy Soldier's existing 2× visual size. */
  PX: 0.09,
  /** x of his body centre inside the sprite */
  CX: 512,
} as const;

/** duration (seconds) of the heavy sword swing — slow and readable */
export const HEAVY_SWING_DUR = 0.7;

type Layers = { body: HTMLImageElement; legB: HTMLImageElement; legF: HTMLImageElement };
let layers: Layers | null = null;

function load(url: string): HTMLImageElement {
  const img = new Image();
  img.src = url;
  return img;
}

export function ensureHeavyArt(): boolean {
  if (typeof document === "undefined") return false;
  if (!layers) {
    layers = {
      body: load(bodyAsset.url),
      legB: load(legBAsset.url),
      legF: load(legFAsset.url),
    };
  }
  const l = layers;
  return [l.body, l.legB, l.legF].every((i) => i.complete && i.naturalWidth > 0);
}

/** Rotation (radians) of the sword arm over the swing progress. */
export function heavySwingAngle(progress: number): number {
  const p = Math.max(0, Math.min(1, progress));
  if (p < 0.34) return -0.3 * (p / 0.34);                  // heave the blade back
  if (p < 0.6) return -0.3 + 1.95 * ((p - 0.34) / 0.26);   // heavy chop down
  return 1.65 * (1 - (p - 0.6) / 0.4);                     // slow recovery
}

export type HeavyPose = {
  x: number;
  groundY: number;
  flip: 1 | -1;
  walkPhase: number;
  moving: boolean;
  /** 0..1 progress of the sword swing; null = idle */
  swing?: number | null;
};

export function drawHeavySoldierArt(ctx: CanvasRenderingContext2D, pose: HeavyPose): void {
  if (!ensureHeavyArt() || !layers) return;
  const { W, H, PX, CX } = HEAVY_ART;
  const l = layers;

  const sw = pose.swing;
  const swinging = sw != null && sw > 0 && sw < 1;
  // Heavy, plodding stride along the facing direction (never sideways).
  const gait = pose.moving && !swinging ? Math.sin(pose.walkPhase) : 0;
  const stepF = Math.round(gait * 2);
  const stepB = -stepF;
  const liftF = gait !== 0 && stepF > 0 ? -1 : 0;
  const liftB = gait !== 0 && stepB > 0 ? -1 : 0;
  // The supplied torso is never cut or deformed. A small whole-body lean gives
  // the existing heavy swing readable weight while both hands stay on the blade.
  const bodyDY = pose.moving && !swinging && Math.cos(pose.walkPhase) < -0.5 ? 8 : 0;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.filter = "saturate(90%) brightness(104%)";
  ctx.translate(Math.round(pose.x), Math.round(pose.groundY));
  if (pose.flip === -1) ctx.scale(-1, 1);
  ctx.translate(-CX * PX, -H * PX);

  const stamp = (img: HTMLImageElement, dx: number, dy: number) => {
    ctx.drawImage(img, dx * PX, dy * PX, W * PX, H * PX);
  };

  stamp(l.legB, stepB * 8, liftB * 8);
  stamp(l.legF, stepF * 8, liftF * 8);
  if (swinging) {
    const a = heavySwingAngle(sw);
    ctx.save();
    ctx.translate(CX * PX, H * PX);
    ctx.rotate(a * 0.045);
    ctx.translate(-CX * PX, -H * PX);
    stamp(l.body, 0, Math.round(Math.sin(Math.PI * sw) * 8));
    ctx.restore();
  } else {
    stamp(l.body, 0, bodyDY);
  }
  ctx.filter = "none";
  ctx.restore();
}
