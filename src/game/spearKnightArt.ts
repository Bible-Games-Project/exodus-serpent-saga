// Egyptian spear knight (mounted) — the supplied PNG (`enemy-spear-knight-v2-
// supplied.png`) split once into five layers so the horse trots and gallops
// without a single pixel being redrawn:
//
//   body          — rider, levelled spear, horse body, head, tail, upper legs
//   h1, h2        — the two hind legs (cut below the haunch)
//   f1, f2        — the two fore legs (cut below the chest)
//
// Each leg swings around its own joint; diagonal pairs move together. The
// previous horse (mounted-joint-*.png) is kept in assets for rollback.
import bodyAsset from "@/assets/knight-v3-body.png";
import h1Asset from "@/assets/knight-v3-leg-h1.png";
import h2Asset from "@/assets/knight-v3-leg-h2.png";
import f1Asset from "@/assets/knight-v3-leg-f1.png";
import f2Asset from "@/assets/knight-v3-leg-f2.png";

export const SPEAR_KNIGHT_ART = {
  W: 1147,
  H: 1372,
  PX: 0.095,
  /** x of the horse's centre inside the sprite */
  CX: 520,
  /** Bottom of the hooves. */
  FOOT_Y: 1332,
} as const;

/** Leg joints (sprite px): rotation pivots at the top of each cut. */
const JOINTS = {
  h1: { x: 190, y: 985 },
  h2: { x: 340, y: 950 },
  f1: { x: 622, y: 960 },
  f2: { x: 757, y: 955 },
} as const;

type LegId = keyof typeof JOINTS;
type Layers = { body: HTMLImageElement } & Record<LegId, HTMLImageElement>;
let layers: Layers | null = null;

function load(url: string): HTMLImageElement {
  const img = new Image();
  img.src = url;
  return img;
}

export function ensureSpearKnightArt(): boolean {
  if (typeof document === "undefined") return false;
  if (!layers) {
    layers = { body: load(bodyAsset), h1: load(h1Asset), h2: load(h2Asset), f1: load(f1Asset), f2: load(f2Asset) };
  }
  const l = layers;
  return [l.body, l.h1, l.h2, l.f1, l.f2].every((i) => i.complete && i.naturalWidth > 0);
}

export type SpearKnightPose = {
  x: number;
  groundY: number;
  flip: 1 | -1;
  walkPhase: number;
  moving: boolean;
  /** true during the full-speed pass-through charge */
  charging?: boolean;
};

export function drawSpearKnightArt(ctx: CanvasRenderingContext2D, pose: SpearKnightPose): void {
  if (!ensureSpearKnightArt() || !layers) return;
  const { W, H, PX, CX, FOOT_Y } = SPEAR_KNIGHT_ART;
  const l = layers;

  const amp = pose.charging ? 0.42 : 0.26;
  const s = pose.moving ? Math.sin(pose.walkPhase) : 0;
  // Diagonal pairs (near hind + far fore, far hind + near fore) alternate.
  const ang: Record<LegId, number> = { h1: s * amp, f2: s * amp, h2: -s * amp, f1: -s * amp };
  const lift = (a: number) => (a < 0 ? Math.round(-a * 40) : 0);
  const bodyDY = pose.moving ? -Math.round(Math.abs(Math.cos(pose.walkPhase)) * (pose.charging ? 14 : 8)) : 0;
  const pitch = pose.charging ? Math.sin(pose.walkPhase * 2) * 0.02 : 0;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(pose.x), Math.round(pose.groundY));
  if (pose.flip === -1) ctx.scale(-1, 1);
  ctx.translate(-CX * PX, -FOOT_Y * PX);

  const stamp = (img: HTMLImageElement, dy = 0) => ctx.drawImage(img, 0, dy * PX, W * PX, H * PX);
  // Far legs first, then near legs, then the body over every joint.
  for (const id of ["h1", "f1", "h2", "f2"] as LegId[]) {
    const j = JOINTS[id];
    ctx.save();
    ctx.translate(j.x * PX, (j.y + bodyDY) * PX);
    ctx.rotate(ang[id]);
    ctx.translate(-j.x * PX, -(j.y + bodyDY) * PX);
    stamp(l[id], bodyDY - lift(ang[id]));
    ctx.restore();
  }
  if (pitch) {
    ctx.translate(CX * PX, 900 * PX);
    ctx.rotate(pitch);
    ctx.translate(-CX * PX, -900 * PX);
  }
  stamp(l.body, bodyDY);
  ctx.restore();
}
