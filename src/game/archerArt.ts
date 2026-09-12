// Egyptian archer — the supplied pixel-art sprite, split once into four layers
// so he animates without a single pixel being redrawn:
//
//   body  — nemes, head, torso, kilt, quiver (drawn over the legs' overlap rows)
//   legb  — trailing leg + sandal
//   legf  — leading leg + sandal
//   arm   — bow arm + bow + string (one rigid group, the grip never breaks)
import bodyAsset from "@/assets/archer-body.png.asset.json";
import legBAsset from "@/assets/archer-legb.png.asset.json";
import legFAsset from "@/assets/archer-legf.png.asset.json";
import armAsset from "@/assets/archer-arm.png.asset.json";

export const ARCHER_ART = {
  /** sprite-pixel size of the shared layer canvas */
  W: 50,
  H: 78,
  /** screen pixels per sprite pixel (matches the other Egyptian soldiers) */
  PX: 0.9,
  /** x of his body centre inside the sprite */
  CX: 16,
} as const;

/** duration (seconds) of the draw + release animation */
export const ARCHER_SHOOT_DUR = 0.55;
/** progress at which the arrow leaves the bow */
export const ARCHER_RELEASE_AT = 0.62;

type Layers = { body: HTMLImageElement; legB: HTMLImageElement; legF: HTMLImageElement; arm: HTMLImageElement };
let layers: Layers | null = null;

function load(url: string): HTMLImageElement {
  const img = new Image();
  img.src = url;
  return img;
}

export function ensureArcherArt(): boolean {
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

/** Bow-arm offset (sprite px) across the shoot animation: draw back, then release. */
function bowOffset(progress: number): number {
  const p = Math.max(0, Math.min(1, progress));
  if (p < ARCHER_RELEASE_AT) return -3 * (p / ARCHER_RELEASE_AT);   // pull the string
  return -3 + 4 * ((p - ARCHER_RELEASE_AT) / (1 - ARCHER_RELEASE_AT)); // snap forward
}

export type ArcherPose = {
  x: number;
  groundY: number;
  flip: 1 | -1;
  walkPhase: number;
  moving: boolean;
  /** 0..1 progress of the shot; null = idle */
  shoot?: number | null;
};

export function drawArcherArt(ctx: CanvasRenderingContext2D, pose: ArcherPose): void {
  if (!ensureArcherArt() || !layers) return;
  const { W, H, PX, CX } = ARCHER_ART;
  const l = layers;

  const shoot = pose.shoot;
  const shooting = shoot != null && shoot > 0 && shoot < 1;
  // Forward/backward stride along the facing direction (never sideways).
  const swing = pose.moving && !shooting ? Math.sin(pose.walkPhase) : 0;
  const stepF = Math.round(swing * 2);
  const stepB = -stepF;
  const liftF = swing !== 0 && stepF > 0 ? -1 : 0;
  const liftB = swing !== 0 && stepB > 0 ? -1 : 0;
  // Bow arm counter-swings gently while walking; during a shot it draws back.
  const armStep = shooting ? bowOffset(shoot) : -stepF;
  const armLift = shooting ? 0 : swing > 0 ? -1 : 0;

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
  stamp(l.arm, armStep, armLift);
  ctx.restore();
}
