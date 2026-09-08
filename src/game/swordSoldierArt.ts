// Egyptian sword soldier — the supplied pixel-art sprite, split once into four
// layers so he animates without a single pixel being redrawn:
//
//   body  — nemes, head, torso, kilt (drawn last, hides every seam)
//   legb  — trailing leg + sandal (2 rows of overlap tucked under the kilt)
//   legf  — leading leg + sandal
//   arm   — fist + khopesh sword (one rigid group, so the grip never breaks)
import bodyAsset from "@/assets/sword-body.png.asset.json";
import legBAsset from "@/assets/sword-legb.png.asset.json";
import legFAsset from "@/assets/sword-legf.png.asset.json";
import armAsset from "@/assets/sword-arm.png.asset.json";

export const SWORD_ART = {
  /** sprite-pixel size of the shared layer canvas */
  W: 51,
  H: 78,
  /** screen pixels per sprite pixel (matches the staff soldier's density) */
  PX: 0.9,
  /** x of his body centre inside the sprite */
  CX: 14,
} as const;

/** duration (seconds) of the quick sword thrust */
export const SWORD_THRUST_DUR = 0.34;

/** sword hand height in sprite pixels above the ground */
const HAND_Y = 37;

type Layers = { body: HTMLImageElement; legB: HTMLImageElement; legF: HTMLImageElement; arm: HTMLImageElement };
let layers: Layers | null = null;

function load(url: string): HTMLImageElement {
  const img = new Image();
  img.src = url;
  return img;
}

export function ensureSwordSoldierArt(): boolean {
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

/** Forward extension of the sword (sprite px) over the thrust progress. */
export function thrustReach(progress: number): number {
  const p = Math.max(0, Math.min(1, progress));
  if (p < 0.3) return -4 * (p / 0.3);           // short pull-back (preparation)
  if (p < 0.55) return -4 + 18 * ((p - 0.3) / 0.25); // sharp stab forward
  return 14 * (1 - (p - 0.55) / 0.45);          // snap back to guard
}

/** Screen position of the sword tip for a thrust progress (impact FX). */
export function swordTipPos(x: number, groundY: number, flip: 1 | -1, thrust: number) {
  const { PX, CX, W, H } = SWORD_ART;
  return {
    x: x + (W - 2 + thrustReach(thrust) - CX) * PX * flip,
    y: groundY - (H - 30) * PX,
  };
}

export type SwordSoldierPose = {
  x: number;
  groundY: number;
  flip: 1 | -1;
  walkPhase: number;
  moving: boolean;
  /** 0..1 progress of a sword thrust; null = idle guard */
  thrust?: number | null;
};

export function drawSwordSoldierArt(ctx: CanvasRenderingContext2D, pose: SwordSoldierPose): void {
  if (!ensureSwordSoldierArt() || !layers) return;
  const { W, H, PX, CX } = SWORD_ART;
  const l = layers;

  // Forward/backward stride along the facing direction (never sideways).
  const swing = pose.moving ? Math.sin(pose.walkPhase) : 0;
  const stepF = Math.round(swing * 2);
  const stepB = -stepF;
  const liftF = pose.moving && stepF > 0 ? -1 : 0;
  const liftB = pose.moving && stepB > 0 ? -1 : 0;
  // Sword arm counter-swings gently against the legs while walking.
  const thrust = pose.thrust;
  const thrusting = thrust != null && thrust > 0 && thrust < 1;
  const reach = thrusting ? thrustReach(thrust) : 0;
  const armStep = thrusting ? reach : -stepF;
  const armLift = thrusting ? 0 : pose.moving && swing > 0 ? -1 : 0;

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
  // While thrusting, bridge the gap between torso and fist with a forearm so
  // the sword is never disconnected from his hand.
  if (thrusting && reach > 0) {
    const x0 = 21;
    ctx.fillStyle = "#703914";
    ctx.fillRect(x0 * PX, (HAND_Y + 3) * PX, (reach + 3) * PX, 1 * PX);
    ctx.fillStyle = "#e88e4d";
    ctx.fillRect(x0 * PX, HAND_Y * PX, (reach + 3) * PX, 3 * PX);
  }
  stamp(l.arm, armStep, armLift);
  ctx.restore();
}
