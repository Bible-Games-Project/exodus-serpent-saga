// Egyptian spear knight (mounted) — the supplied pixel-art sprite, split once
// into three layers so the horse gallops without a single pixel being redrawn:
//
//   body — rider, levelled spear, horse torso, head and tail
//   legb — hind legs
//   legf — fore legs
import bodyAsset from "@/assets/knight-body.png.asset.json";
import legBAsset from "@/assets/knight-legb.png.asset.json";
import legFAsset from "@/assets/knight-legf.png.asset.json";

export const SPEAR_KNIGHT_ART = {
  W: 84,
  H: 53,
  PX: 1.0,
  /** x of the horse's centre inside the sprite */
  CX: 44,
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

  const amp = pose.charging ? 5 : 3;
  const swing = pose.moving ? Math.sin(pose.walkPhase) : 0;
  const stepF = Math.round(swing * amp);
  const stepB = -stepF;
  const liftF = stepF > 0 ? -2 : 0;
  const liftB = stepB > 0 ? -2 : 0;
  const bodyDY = pose.moving
    ? (Math.cos(pose.walkPhase) > 0.35 ? (pose.charging ? -3 : -1) : 0)
    : (Math.sin(pose.walkPhase * 0.3) > 0.6 ? -1 : 0);

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
