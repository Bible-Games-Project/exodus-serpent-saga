// Desert cobra — the supplied pixel-art sprite, split once into two layers so the
// hood can sway and strike while the coil stays planted:
//
//   coil — the coiled body and tail (the part that grips the sand)
//   head — raised neck, hood and head
import headAsset from "@/assets/cobra-head.png.asset.json";
import coilAsset from "@/assets/cobra-coil.png.asset.json";

export const COBRA_ART = {
  /** sprite-pixel size of the shared layer canvas */
  W: 28,
  H: 42,
  /** screen pixels per sprite pixel */
  PX: 1.0,
  /** x of the coil centre inside the sprite */
  CX: 15,
} as const;

/** duration (seconds) of the venomous strike */
export const COBRA_STRIKE_DUR = 0.42;

type Layers = { head: HTMLImageElement; coil: HTMLImageElement };
let layers: Layers | null = null;

function load(url: string): HTMLImageElement {
  const img = new Image();
  img.src = url;
  return img;
}

export function ensureCobraArt(): boolean {
  if (typeof document === "undefined") return false;
  if (!layers) {
    layers = { head: load(headAsset.url), coil: load(coilAsset.url) };
  }
  const l = layers;
  return [l.head, l.coil].every((i) => i.complete && i.naturalWidth > 0);
}

export type CobraPose = {
  x: number;
  groundY: number;
  flip: 1 | -1;
  phase: number;
  /** true while slithering toward the target */
  moving: boolean;
  /** 0..1 progress of the strike; null = not striking */
  strike?: number | null;
};

/** Head offset (sprite px) through the rear-back → lunge → recoil strike. */
function strikeOffset(p: number): { dx: number; dy: number } {
  const t = Math.max(0, Math.min(1, p));
  if (t < 0.3) {
    const k = t / 0.3;                     // rear back and rise
    return { dx: -2 * k, dy: -2 * k };
  }
  if (t < 0.55) {
    const k = (t - 0.3) / 0.25;            // snap forward and down
    return { dx: -2 + 9 * k, dy: -2 + 5 * k };
  }
  const k = (t - 0.55) / 0.45;             // pull back up
  return { dx: 7 * (1 - k), dy: 3 * (1 - k) };
}

export function drawCobraArt(ctx: CanvasRenderingContext2D, pose: CobraPose): void {
  if (!ensureCobraArt() || !layers) return;
  const { W, H, PX, CX } = COBRA_ART;
  const l = layers;

  const striking = pose.strike != null && pose.strike > 0 && pose.strike < 1;
  const o = striking ? strikeOffset(pose.strike as number) : { dx: 0, dy: 0 };
  // Idle/slither: the hood sways one pixel side to side, the coil shifts slower.
  const sway = striking ? 0 : Math.sin(pose.phase * (pose.moving ? 4 : 1.6)) > 0 ? 1 : -1;
  const coilShift = pose.moving && !striking ? (Math.sin(pose.phase * 4) > 0.5 ? -1 : 0) : 0;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(pose.x), Math.round(pose.groundY));
  if (pose.flip === -1) ctx.scale(-1, 1);
  ctx.translate(-CX * PX, -H * PX);

  ctx.drawImage(l.coil, 0, coilShift * PX, W * PX, H * PX);
  ctx.drawImage(l.head, (o.dx + sway) * PX, o.dy * PX, W * PX, H * PX);
  ctx.restore();
}
