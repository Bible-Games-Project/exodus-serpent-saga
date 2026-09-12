// Egyptian heavy soldier — the supplied pixel-art sprite, split once into four
// layers so he animates without a single pixel being redrawn:
//
//   body  — helmet, armour, kilt (drawn over the legs' overlap rows)
//   legb  — trailing leg + sandal
//   legf  — leading leg + sandal
//   arm   — sword arm + sword (one rigid group, the grip never breaks)
import bodyAsset from "@/assets/heavy-body.png.asset.json";
import legBAsset from "@/assets/heavy-legb.png.asset.json";
import legFAsset from "@/assets/heavy-legf.png.asset.json";
import armAsset from "@/assets/heavy-arm.png.asset.json";

export const HEAVY_ART = {
  /** sprite-pixel size of the shared layer canvas */
  W: 50,
  H: 76,
  /** screen pixels per sprite pixel (matches the other Egyptian soldiers) */
  PX: 0.9,
  /** x of his body centre inside the sprite */
  CX: 21,
} as const;

/** duration (seconds) of the heavy sword swing — slow and readable */
export const HEAVY_SWING_DUR = 0.7;

/** Shoulder of the sword arm, in sprite pixels — pivot of the swing. */
const HEAVY_SHOULDER = { x: 35, y: 26 } as const;

type Layers = { body: HTMLImageElement; legB: HTMLImageElement; legF: HTMLImageElement; arm: HTMLImageElement };
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
      arm: load(armAsset.url),
    };
  }
  const l = layers;
  return [l.body, l.legB, l.legF, l.arm].every((i) => i.complete && i.naturalWidth > 0);
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
  const armStep = -stepF;
  const armLift = gait > 0 ? -1 : 0;
  // the whole armoured torso sinks a pixel as each boot lands
  const bodyDY = pose.moving && !swinging && Math.cos(pose.walkPhase) < -0.5 ? 1 : 0;

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
  stamp(l.body, 0, bodyDY);
  if (swinging) {
    const a = heavySwingAngle(sw);
    ctx.save();
    ctx.translate(HEAVY_SHOULDER.x * PX, HEAVY_SHOULDER.y * PX);
    ctx.rotate(a);
    ctx.translate(-HEAVY_SHOULDER.x * PX, -HEAVY_SHOULDER.y * PX);
    stamp(l.arm, 0, 0);
    ctx.restore();
  } else {
    stamp(l.arm, armStep, armLift + bodyDY);
  }
  ctx.restore();
}
