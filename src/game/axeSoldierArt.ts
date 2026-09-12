// Egyptian axe soldier — the supplied pixel-art sprite, split once into four
// layers so he animates without a single pixel being redrawn:
//
//   body  — hair, head, torso, sash, kilt (drawn over the legs' overlap rows)
//   legb  — trailing leg + sandal
//   legf  — leading leg + sandal
//   arm   — axe arm + axe (one rigid group, the grip never breaks)
import bodyAsset from "@/assets/axe-body.png.asset.json";
import legBAsset from "@/assets/axe-legb.png.asset.json";
import legFAsset from "@/assets/axe-legf.png.asset.json";
import armAsset from "@/assets/axe-arm.png.asset.json";

export const AXE_ART = {
  /** sprite-pixel size of the shared layer canvas */
  W: 41,
  H: 78,
  /** screen pixels per sprite pixel (matches the other Egyptian soldiers) */
  PX: 0.9,
  /** x of his body centre inside the sprite */
  CX: 15,
} as const;

/** duration (seconds) of the axe swing */
export const AXE_SWING_DUR = 0.45;

/** Shoulder of the axe arm, in sprite pixels — pivot of the swing. */
const AXE_SHOULDER = { x: 28, y: 31 } as const;

type Layers = { body: HTMLImageElement; legB: HTMLImageElement; legF: HTMLImageElement; arm: HTMLImageElement };
let layers: Layers | null = null;

function load(url: string): HTMLImageElement {
  const img = new Image();
  img.src = url;
  return img;
}

export function ensureAxeArt(): boolean {
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

/** Rotation (radians) of the axe arm over the swing progress. */
export function axeSwingAngle(progress: number): number {
  const p = Math.max(0, Math.min(1, progress));
  if (p < 0.28) return -0.35 * (p / 0.28);                 // cock the axe further back
  if (p < 0.58) return -0.35 + 1.85 * ((p - 0.28) / 0.3);  // fast chop forward/down
  return 1.5 * (1 - (p - 0.58) / 0.42);                    // recover
}

export type AxePose = {
  x: number;
  groundY: number;
  flip: 1 | -1;
  walkPhase: number;
  moving: boolean;
  /** 0..1 progress of the axe swing; null = idle */
  swing?: number | null;
};

export function drawAxeSoldierArt(ctx: CanvasRenderingContext2D, pose: AxePose): void {
  if (!ensureAxeArt() || !layers) return;
  const { W, H, PX, CX } = AXE_ART;
  const l = layers;

  const sw = pose.swing;
  const swinging = sw != null && sw > 0 && sw < 1;
  // Forward/backward stride along the facing direction (never sideways).
  const gait = pose.moving && !swinging ? Math.sin(pose.walkPhase) : 0;
  const stepF = Math.round(gait * 2);
  const stepB = -stepF;
  const liftF = gait !== 0 && stepF > 0 ? -1 : 0;
  const liftB = gait !== 0 && stepB > 0 ? -1 : 0;
  const armStep = -stepF;
  const armLift = gait > 0 ? -1 : 0;

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
  if (swinging) {
    const a = axeSwingAngle(sw);
    ctx.save();
    ctx.translate(AXE_SHOULDER.x * PX, AXE_SHOULDER.y * PX);
    ctx.rotate(a);
    ctx.translate(-AXE_SHOULDER.x * PX, -AXE_SHOULDER.y * PX);
    stamp(l.arm, 0, 0);
    ctx.restore();
  } else {
    stamp(l.arm, armStep, armLift);
  }
  ctx.restore();
}
