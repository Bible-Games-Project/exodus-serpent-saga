// Egyptian spear knight (mounted) — the supplied pixel-art sprite, split once
// into three layers so the horse gallops without a single pixel being redrawn:
//
//   body — rider, levelled spear, horse torso, head and tail
//   legb — hind legs
//   legf — fore legs
import bodyAsset from "@/assets/knight-v2-body.png.asset.json";
import legBAsset from "@/assets/knight-v2-legb.png.asset.json";
import legFAsset from "@/assets/knight-v2-legf.png.asset.json";

export const SPEAR_KNIGHT_ART = {
  W: 1536,
  H: 1024,
  /** Keeps the mounted soldier at the established 2x visual footprint. */
  PX: 0.11,
  /** x of the horse's centre inside the sprite */
  CX: 760,
} as const;

type Layers = { body: HTMLImageElement; legB: HTMLImageElement; legF: HTMLImageElement };
let layers: Layers | null = null;

function load(url: string): HTMLImageElement {
  const img = new Image();
  img.src = url;
  return img;
}

export function ensureSpearKnightArt(): boolean {
  if (typeof document === "undefined") return false;
  if (!layers) {
    layers = { body: load(bodyAsset.url), legB: load(legBAsset.url), legF: load(legFAsset.url) };
  }
  const l = layers;
  return [l.body, l.legB, l.legF].every((i) => i.complete && i.naturalWidth > 0);
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
  const { W, H, PX, CX } = SPEAR_KNIGHT_ART;
  const l = layers;

  const amp = pose.charging ? 30 : 18;
  const swing = pose.moving ? Math.sin(pose.walkPhase) : 0;
  const stepF = Math.round(swing * amp);
  const stepB = -stepF;
  const liftF = stepF > 0 ? -15 : 0;
  const liftB = stepB > 0 ? -15 : 0;
  // Keep the complete rider and horse torso fixed over the overlapping leg
  // roots. Only the legs move, preventing a belly seam during the gallop.
  const bodyDY = pose.moving && Math.cos(pose.walkPhase * 2) > 0.45
    ? (pose.charging ? -5 : 0)
    : 0;

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
  ctx.restore();
}
