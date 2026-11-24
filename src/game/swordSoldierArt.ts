// Egyptian sword soldier — the supplied PNG (`enemy-sword-soldier-supplied.png`)
// split once into four layers so he walks and slashes without redrawing art:
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

export const SWORD_SOLDIER_ART = {
  W: 1024,
  H: 1536,
  /** Same footprint as the spear soldier (~95 screen px tall). */
  PX: 0.065,
  /** x of his body centre inside the sprite */
  CX: 470,
  /** Transparent rows below the sandals. */
  FOOT_Y: 1483,
} as const;

/** Seconds per slash; a rank-2/3 combo chains 2/3 of them. */
export const SWORD_SLASH_DUR = 0.42;

/** Forearm pivot (where the cut meets the upper arm) and the hips. */
const ELBOW = { x: 452, y: 690 } as const;
const HIP_B = { x: 430, y: 1150 } as const;
const HIP_F = { x: 520, y: 1150 } as const;

type Layers = { body: HTMLImageElement; legB: HTMLImageElement; legF: HTMLImageElement; arm: HTMLImageElement };
let layers: Layers | null = null;

function load(url: string): HTMLImageElement {
  const img = new Image();
  img.src = url;
  return img;
}

export function ensureSwordArt(): boolean {
  if (typeof document === "undefined") return false;
  if (!layers) layers = { body: load(bodyAsset), legB: load(legBAsset), legF: load(legFAsset), arm: load(armAsset) };
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
  const bob = pose.moving && !swinging ? -Math.abs(Math.cos(pose.walkPhase)) * 10 : 0;

  let armA = 0, lean = 0, lunge = 0;
  if (swinging) {
    const { i, p } = swordSlashAt(sw, pose.tier);
    armA = slashAngle(p, i);
    lean = Math.sin(Math.PI * p) * 0.06;
    // Rank 3 lunges forward on the final cut.
    if (pose.tier >= 3 && i === 2) lunge = Math.sin(Math.PI * p) * 120;
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
  leg(l.legB, HIP_B, -stride * 0.16, Math.max(0, -stride) * 10);
  leg(l.legF, HIP_F, stride * 0.16, Math.max(0, stride) * 10);
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
