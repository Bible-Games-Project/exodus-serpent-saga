// Neutral camel — the supplied pixel-art sprite, split once into three layers
// so it walks without a single pixel being redrawn:
//
//   body  — torso, hump, saddle, neck, head
//   legb  — hind legs
//   legf  — fore legs
import bodyAsset from "@/assets/camel-body.png.asset.json";
import legBAsset from "@/assets/camel-legb.png.asset.json";
import legFAsset from "@/assets/camel-legf.png.asset.json";

export const CAMEL_ART = {
  W: 81,
  H: 52,
  PX: 0.9,
  /** x of its body centre inside the sprite */
  CX: 40,
} as const;

type Layers = { body: HTMLImageElement; legB: HTMLImageElement; legF: HTMLImageElement };
let layers: Layers | null = null;

function load(url: string): HTMLImageElement {
  const img = new Image();
  img.src = url;
  return img;
}

export function ensureCamelArt(): boolean {
  if (typeof document === "undefined") return false;
  if (!layers) {
    layers = { body: load(bodyAsset.url), legB: load(legBAsset.url), legF: load(legFAsset.url) };
  }
  const l = layers;
  return [l.body, l.legB, l.legF].every((i) => i.complete && i.naturalWidth > 0);
}

export type CamelPose = {
  x: number;
  groundY: number;
  flip: 1 | -1;
  walkPhase: number;
  moving: boolean;
  /** seconds, for the standing breath */
  now: number;
};

export function drawCamelArt(ctx: CanvasRenderingContext2D, pose: CamelPose): void {
  if (!ensureCamelArt() || !layers) return;
  const { W, H, PX, CX } = CAMEL_ART;
  const l = layers;

  const swing = pose.moving ? Math.sin(pose.walkPhase) : 0;
  const stepF = Math.round(swing * 2);
  const stepB = -stepF;
  const bob = pose.moving
    ? Math.round(Math.abs(Math.sin(pose.walkPhase)) * -1)
    : Math.sin(pose.now * 1.6) > 0.5
      ? -1
      : 0;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(pose.x), Math.round(pose.groundY));
  if (pose.flip === -1) ctx.scale(-1, 1);
  ctx.translate(-CX * PX, -H * PX);

  const stamp = (img: HTMLImageElement, dx: number, dy: number) => {
    ctx.drawImage(img, dx * PX, dy * PX, W * PX, H * PX);
  };

  stamp(l.legB, stepB, 0);
  stamp(l.legF, stepF, 0);
  stamp(l.body, 0, bob);
  ctx.restore();
}
