// Desert bat — the supplied pixel-art sprite, split once into three layers so
// the wings flap without a single pixel being redrawn:
//
//   body   — head, ears, torso, feet
//   wingL  — left wing (pivots on the left shoulder)
//   wingR  — right wing (pivots on the right shoulder)
import bodyAsset from "@/assets/bat-body.png.asset.json";
import wingLAsset from "@/assets/bat-wingl.png.asset.json";
import wingRAsset from "@/assets/bat-wingr.png.asset.json";

export const BAT_ART = {
  /** sprite-pixel size of the shared layer canvas */
  W: 44,
  H: 19,
  /** screen pixels per sprite pixel (matches the other enemies' density) */
  PX: 0.9,
  /** x of the bat's centre inside the sprite */
  CX: 22,
} as const;

/** wing attachment points, in sprite pixels */
const SHOULDER_L = { x: 15, y: 8 } as const;
const SHOULDER_R = { x: 28, y: 8 } as const;

type Layers = { body: HTMLImageElement; wingL: HTMLImageElement; wingR: HTMLImageElement };
let layers: Layers | null = null;

function load(url: string): HTMLImageElement {
  const img = new Image();
  img.src = url;
  return img;
}

export function ensureBatArt(): boolean {
  if (typeof document === "undefined") return false;
  if (!layers) {
    layers = {
      body: load(bodyAsset.url),
      wingL: load(wingLAsset.url),
      wingR: load(wingRAsset.url),
    };
  }
  const l = layers;
  return [l.body, l.wingL, l.wingR].every((i) => i.complete && i.naturalWidth > 0);
}

export type BatPose = {
  x: number;
  /** vertical centre of the bat on screen */
  y: number;
  flip: 1 | -1;
  /** flap phase in radians */
  flapPhase: number;
};

export function drawBatArt(ctx: CanvasRenderingContext2D, pose: BatPose): void {
  if (!ensureBatArt() || !layers) return;
  const { W, H, PX, CX } = BAT_ART;
  const l = layers;

  const flap = Math.sin(pose.flapPhase);
  // wings sweep up/down around the shoulders; the body bobs with the downstroke
  const angle = flap * 0.75;
  const bodyDY = Math.round(flap * 1.5);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(pose.x), Math.round(pose.y));
  if (pose.flip === -1) ctx.scale(-1, 1);
  ctx.translate(-CX * PX, -(H / 2) * PX);

  const stamp = (img: HTMLImageElement, dy: number) => {
    ctx.drawImage(img, 0, dy * PX, W * PX, H * PX);
  };

  const wing = (img: HTMLImageElement, sx: number, sy: number, a: number) => {
    ctx.save();
    ctx.translate(sx * PX, (sy + bodyDY) * PX);
    ctx.rotate(a);
    ctx.translate(-sx * PX, -(sy + bodyDY) * PX);
    stamp(img, bodyDY);
    ctx.restore();
  };

  wing(l.wingL, SHOULDER_L.x, SHOULDER_L.y, angle);
  wing(l.wingR, SHOULDER_R.x, SHOULDER_R.y, -angle);
  stamp(l.body, bodyDY);
  ctx.restore();
}
