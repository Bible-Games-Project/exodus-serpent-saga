// Egyptian armored axe soldier — the supplied PNG, kept at its original colors
// and proportions. The head and torso stay intact; only legs and the attacking
// upper-arm/forearm/axe chain are separated at their natural joints.
//
//   body  — intact head, torso, skirt and resting arm
//   legb  — trailing leg + sandal
//   legf  — leading leg + sandal
//   upper — attacking upper arm, joined at the shoulder
//   fore  — forearm, hand and exact supplied axe, joined at the elbow
import bodyAsset from "@/assets/heavy-new-body.png.asset.json";
import legBAsset from "@/assets/heavy-new-legb.png.asset.json";
import legFAsset from "@/assets/heavy-new-legf.png.asset.json";
import upperAsset from "@/assets/heavy-new-upperarm.png.asset.json";
import foreAsset from "@/assets/heavy-new-forearm.png.asset.json";

export const HEAVY_ART = {
  /** sprite-pixel size of the shared layer canvas */
  W: 1024,
  H: 1536,
  /** Keeps the replacement at the Heavy Soldier's existing 2× visual size. */
  PX: 0.09,
  /** x of his body centre inside the sprite */
  CX: 512,
} as const;

/** Duration (seconds) of the heavy axe swing — slow and readable. */
export const HEAVY_SWING_DUR = 0.7;

const SHOULDER = { x: 604, y: 626 } as const;
const ELBOW = { x: 724, y: 526 } as const;

type Layers = {
  body: HTMLImageElement;
  legB: HTMLImageElement;
  legF: HTMLImageElement;
  upper: HTMLImageElement;
  fore: HTMLImageElement;
};
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
      upper: load(upperAsset.url),
      fore: load(foreAsset.url),
    };
  }
  const l = layers;
  return [l.body, l.legB, l.legF, l.upper, l.fore].every((i) => i.complete && i.naturalWidth > 0);
}

/** Existing wind-up contribution, now carried by the elbow-only weapon swing. */
function heavyShoulderAngle(progress: number): number {
  const p = Math.max(0, Math.min(1, progress));
  if (p < 0.3) return -0.2 * (p / 0.3);
  if (p < 0.6) return -0.2 + 0.95 * ((p - 0.3) / 0.3);
  return 0.75 * (1 - (p - 0.6) / 0.4);
}

/** Extra elbow bend keeps the arm connected while carrying the axe to contact. */
function heavyElbowAngle(progress: number): number {
  const p = Math.max(0, Math.min(1, progress));
  if (p < 0.3) return -0.35 * (p / 0.3);
  if (p < 0.6) return -0.35 + 2.15 * ((p - 0.3) / 0.3);
  return 1.8 * (1 - (p - 0.6) / 0.4);
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
  // The supplied torso is never cut or deformed. Preserve the existing body dip.
  const bodyDY = pose.moving && !swinging && Math.cos(pose.walkPhase) < -0.5 ? 8 : 0;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(pose.x), Math.round(pose.groundY));
  if (pose.flip === -1) ctx.scale(-1, 1);
  ctx.translate(-CX * PX, -H * PX);

  const stamp = (img: HTMLImageElement, dx: number, dy: number) => {
    ctx.drawImage(img, dx * PX, dy * PX, W * PX, H * PX);
  };

  if (swinging) {
    // The upper arm remains attached to the shoulder/body. The complete motion
    // is transferred to the forearm-and-axe group at the anatomical elbow.
    const elbowA = heavyShoulderAngle(sw) + heavyElbowAngle(sw);
    const lean = Math.sin(Math.PI * sw);
    ctx.save();
    // Lean the complete assembled figure around the planted feet. Keeping the
    // legs, hips and torso in one transform prevents the former waist/hip split.
    ctx.translate(CX * PX, H * PX);
    ctx.rotate(lean * 0.14);
    ctx.translate(-CX * PX, -H * PX);
    ctx.translate(0, Math.round(lean * 8) * PX);
    stamp(l.legB, 0, 0);
    stamp(l.legF, 0, 0);
    stamp(l.body, 0, 0);
    stamp(l.upper, 0, 0);
    ctx.save();
    // A perpendicular elbow cut with overlap keeps the joint sealed while the
    // connected forearm, hand, and axe rotate as one rigid piece.
    ctx.translate(ELBOW.x * PX, ELBOW.y * PX);
    ctx.rotate(elbowA);
    ctx.translate(-ELBOW.x * PX, -ELBOW.y * PX);
    stamp(l.fore, 0, 0);
    ctx.restore();
    // Close the lean transform as well. Leaving it open leaked this soldier's
    // translate/rotate/scale into every later draw, which visually displaced
    // Moses and the camera framing even though his world position never moved.
    ctx.restore();

  } else {
    stamp(l.legB, stepB * 8, liftB * 8);
    stamp(l.legF, stepF * 8, liftF * 8);
    stamp(l.body, 0, bodyDY);
    stamp(l.upper, 0, bodyDY);
    stamp(l.fore, 0, bodyDY);
  }
  ctx.restore();
}
