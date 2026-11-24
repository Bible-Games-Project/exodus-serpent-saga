// Egyptian sword soldier, split once into four layers so he walks and slashes
// without redrawing art. Two looks (SWORD_SOLDIER_LOOK):
//   "v2"     — redrawn in Moses' style (skin, proportions, saturation), from
//              sword-soldier-v2-source.png downsampled to Moses' pixel size.
//   "legacy" — the supplied painted PNG (`enemy-sword-soldier-supplied.png`).
// Layers:
//
//   body — head, torso, kilt, resting far arm (torso repainted behind the forearm)
//   legb — trailing leg + sandal
//   legf — leading leg + sandal
//   arm  — sword forearm, hand and sword (one rigid piece, the grip never breaks)
//
// Ranks (data.tier 1-3) change the combo: one slash, two, or three with a lunge.
import bodyAsset from "@/assets/sword-soldier-body.png";
import legBAsset from "@/assets/sword-soldier-legb.png";
import legFAsset from "@/assets/sword-soldier-legf.png";
import armAsset from "@/assets/sword-soldier-arm.png";
import bodyV2 from "@/assets/sword-soldier-v2-body.png";
import legBV2 from "@/assets/sword-soldier-v2-legb.png";
import legFV2 from "@/assets/sword-soldier-v2-legf.png";
import armV2 from "@/assets/sword-soldier-v2-arm.png";

type Pt = { x: number; y: number };
type SwordLook = {
  W: number; H: number;
  /** screen pixels per sprite pixel */
  PX: number;
  /** x of his body centre inside the sprite */
  CX: number;
  /** row under the sandals */
  FOOT_Y: number;
  /** forearm pivot (where the cut meets the upper arm) and the hips */
  ELBOW: Pt; HIP_B: Pt; HIP_F: Pt;
  assets: [string, string, string, string];
};
const LOOKS: Record<"legacy" | "v2", SwordLook> = {
  legacy: {
    W: 1024, H: 1536, PX: 0.065, CX: 470, FOOT_Y: 1483,
    ELBOW: { x: 452, y: 690 }, HIP_B: { x: 430, y: 1150 }, HIP_F: { x: 520, y: 1150 },
    assets: [bodyAsset, legBAsset, legFAsset, armAsset],
  },
  v2: {
    W: 56, H: 86, PX: 0.95, CX: 16.6, FOOT_Y: 85,
    ELBOW: { x: 26.2, y: 35.2 }, HIP_B: { x: 7.6, y: 58.5 }, HIP_F: { x: 24.5, y: 58.5 },
    assets: [bodyV2, legBV2, legFV2, armV2],
  },
};

/** Which sword soldier art the game draws. */
export const SWORD_SOLDIER_LOOK: "legacy" | "v2" = "v2";
const LOOK = LOOKS[SWORD_SOLDIER_LOOK];

export const SWORD_SOLDIER_ART = { W: LOOK.W, H: LOOK.H, PX: LOOK.PX, CX: LOOK.CX, FOOT_Y: LOOK.FOOT_Y } as const;

/** Screen px of the rank-3 lunge, the walk bob and the step lift (same for every look). */
export const SWORD_LUNGE_PX = 7.8;
const BOB_PX = 0.65, LIFT_PX = 0.65;

/** Elbow (the slash's pivot) in screen px: ahead of his centre, above his feet. */
export const SWORD_ELBOW_SCREEN = {
  x: (LOOK.ELBOW.x - LOOK.CX) * LOOK.PX,
  y: (LOOK.FOOT_Y - LOOK.ELBOW.y) * LOOK.PX,
} as const;

/** Seconds per slash; a rank-2/3 combo chains 2/3 of them. */
export const SWORD_SLASH_DUR = 0.42;

const { ELBOW, HIP_B, HIP_F } = LOOK;

type Layers = { body: HTMLImageElement; legB: HTMLImageElement; legF: HTMLImageElement; arm: HTMLImageElement };
let layers: Layers | null = null;

function load(url: string): HTMLImageElement {
  const img = new Image();
  img.src = url;
  return img;
}

export function ensureSwordArt(): boolean {
  if (typeof document === "undefined") return false;
  if (!layers) layers = { body: load(LOOK.assets[0]), legB: load(LOOK.assets[1]), legF: load(LOOK.assets[2]), arm: load(LOOK.assets[3]) };
  const l = layers;
  return [l.body, l.legB, l.legF, l.arm].every((i) => i.complete && i.naturalWidth > 0);
}

/** Number of slashes in one attack for a rank. */
export function swordSlashCount(tier: number): number {
  return Math.max(1, Math.min(3, Math.round(tier) || 1));
}

/** Damage windows (fractions of the whole combo), one per slash. */
export function swordHitWindows(tier: number): [number, number][] {
  const n = swordSlashCount(tier);
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) out.push([(i + 0.42) / n, (i + 0.62) / n]);
  return out;
}

/** Rotation of the sword forearm within one slash (0..1). */
function slashAngle(p: number, i: number): number {
  // Alternate overhead and rising cuts so a combo reads as separate blows.
  const up = i % 2 === 1;
  const back = up ? 0.9 : -1.0;
  const fwd = up ? -0.85 : 1.15;
  if (p < 0.3) return back * (p / 0.3);
  if (p < 0.55) return back + (fwd - back) * ((p - 0.3) / 0.25);
  return fwd * (1 - (p - 0.55) / 0.45);
}

/** Split the combo progress into the current slash and its local progress. */
export function swordSlashAt(progress: number, tier: number): { i: number; p: number } {
  const n = swordSlashCount(tier);
  const t = Math.max(0, Math.min(0.9999, progress)) * n;
  return { i: Math.floor(t), p: t - Math.floor(t) };
}

export type SwordPose = {
  x: number;
  groundY: number;
  flip: 1 | -1;
  walkPhase: number;
  moving: boolean;
  /** 0..1 progress of the whole combo; null = idle */
  swing?: number | null;
  tier: number;
};

export function drawSwordSoldierArt(ctx: CanvasRenderingContext2D, pose: SwordPose): void {
  if (!ensureSwordArt() || !layers) return;
  const { W, H, PX: BASE_PX, CX, FOOT_Y } = SWORD_SOLDIER_ART;
  const PX = BASE_PX * (pose.tier >= 3 ? 1.12 : 1);
  const l = layers;
  const sw = pose.swing;
  const swinging = sw != null && sw > 0 && sw < 1;
  const stride = pose.moving && !swinging ? Math.sin(pose.walkPhase) : 0;
  // Sprite units per screen px at the base scale (bob, lift and lunge are set in screen px).
  const U = 1 / BASE_PX;
  const bob = pose.moving && !swinging ? -Math.abs(Math.cos(pose.walkPhase)) * BOB_PX * U : 0;

  let armA = 0, lean = 0, lunge = 0;
  if (swinging) {
    const { i, p } = swordSlashAt(sw, pose.tier);
    armA = slashAngle(p, i);
    lean = Math.sin(Math.PI * p) * 0.06;
    // Rank 3 lunges forward on the final cut.
    if (pose.tier >= 3 && i === 2) lunge = Math.sin(Math.PI * p) * SWORD_LUNGE_PX * U;
  }

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(pose.x), Math.round(pose.groundY));
  if (pose.flip === -1) ctx.scale(-1, 1);
  ctx.translate(-CX * PX + lunge * PX, -FOOT_Y * PX);
  if (lean) {
    ctx.translate(CX * PX, FOOT_Y * PX);
    ctx.rotate(lean);
    ctx.translate(-CX * PX, -FOOT_Y * PX);
  }

  const stamp = (img: HTMLImageElement, dy = 0) => ctx.drawImage(img, 0, dy * PX, W * PX, H * PX);
  const leg = (img: HTMLImageElement, hip: { x: number; y: number }, a: number, lift: number) => {
    ctx.save();
    ctx.translate(hip.x * PX, hip.y * PX);
    ctx.rotate(a);
    ctx.translate(-hip.x * PX, -hip.y * PX);
    stamp(img, -lift);
    ctx.restore();
  };
  leg(l.legB, HIP_B, -stride * 0.16, Math.max(0, -stride) * LIFT_PX * U);
  leg(l.legF, HIP_F, stride * 0.16, Math.max(0, stride) * LIFT_PX * U);
  stamp(l.body, bob);
  ctx.save();
  ctx.translate(ELBOW.x * PX, (ELBOW.y + bob) * PX);
  ctx.rotate(armA);
  ctx.translate(-ELBOW.x * PX, -(ELBOW.y + bob) * PX);
  stamp(l.arm, bob);
  ctx.restore();
  ctx.restore();
}

/** Screen-space height of the sprite canvas above the feet (for bars/heads). */
export function swordArtHeight(tier = 1): number {
  return SWORD_SOLDIER_ART.FOOT_Y * SWORD_SOLDIER_ART.PX * (tier >= 3 ? 1.12 : 1);
}
