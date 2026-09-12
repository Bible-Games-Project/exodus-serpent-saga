// Egyptian lion — the supplied pixel-art sprite, split once into three layers so
// it can prowl, run and pounce without a single pixel being redrawn:
//
//   body — mane, head, torso, tail and hips (down to the leg cut)
//   legb — hind legs
//   legf — fore legs
import bodyAsset from "@/assets/lion-body.png.asset.json";
import legBAsset from "@/assets/lion-legb.png.asset.json";
import legFAsset from "@/assets/lion-legf.png.asset.json";

export const LION_ART = {
  W: 72,
  H: 44,
  /** screen pixels per sprite pixel (matches the other desert animals) */
  /** 50% larger than the previous lion. */
  PX: 1.5,
  /** x of its body centre inside the sprite */
  CX: 40,
} as const;

/** Dog-like crouch + lunge rhythm. */
export const LION_MAUL_DUR = 0.42;

type Layers = { body: HTMLImageElement; legB: HTMLImageElement; legF: HTMLImageElement };
let layers: Layers | null = null;

function load(url: string): HTMLImageElement {
  const img = new Image();
  img.src = url;
  return img;
}

export function ensureLionArt(): boolean {
  if (typeof document === "undefined") return false;
  if (!layers) {
    layers = { body: load(bodyAsset.url), legB: load(legBAsset.url), legF: load(legFAsset.url) };
  }
  const l = layers;
  return [l.body, l.legB, l.legF].every((i) => i.complete && i.naturalWidth > 0);
}

/** Body offset (sprite px) through the gather → pounce → land curve. */
function maulOffset(p: number): { dx: number; dy: number } {
  const t = Math.max(0, Math.min(1, p));
  if (t < 0.28) {
    const k = t / 0.28;
    return { dx: -4 * k, dy: 2 * k };
  }
  if (t < 0.62) {
    const k = (t - 0.28) / 0.34;
    return { dx: -4 + 14 * k, dy: 2 - 10 * k };
  }
  const k = (t - 0.62) / 0.38;
  return { dx: 10 * (1 - k), dy: -8 * (1 - k) };
}

export type LionPose = {
  /** screen position of the paws (ground contact point) */
  x: number;
  groundY: number;
  flip: 1 | -1;
  walkPhase: number;
  /** true while padding along or sprinting */
  moving: boolean;
  /** 0..1 progress of the pounce; null = not pouncing */
  maul?: number | null;
};

export function drawLionArt(ctx: CanvasRenderingContext2D, pose: LionPose): void {
  if (!ensureLionArt() || !layers) return;
  const { W, H, PX, CX } = LION_ART;
  const l = layers;

  const mauling = pose.maul != null && pose.maul > 0 && pose.maul < 1;
  const o = mauling ? maulOffset(pose.maul as number) : { dx: 0, dy: 0 };

  // Dog-like diagonal gait. The intact torso is always stamped last over the
  // overlapping leg roots, so no gap can open through the belly.
  const amp = 2;
  const swing = pose.moving && !mauling ? Math.sin(pose.walkPhase) : 0;
  const stepF = Math.round(swing * amp);
  const stepB = -stepF;
  const liftF = stepF > 0 ? -2 : 0;
  const liftB = stepB > 0 ? -2 : 0;
  const breath = !pose.moving && !mauling ? (Math.sin(pose.walkPhase * 0.3) > 0.6 ? -1 : 0) : 0;
  const bodyDY = pose.moving && !mauling
    ? (Math.cos(pose.walkPhase * 2) > 0 ? -1 : 0)
    : breath;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(pose.x), Math.round(pose.groundY));
  if (pose.flip === -1) ctx.scale(-1, 1);
  ctx.translate(-CX * PX, -H * PX);

  const stamp = (img: HTMLImageElement, dx: number, dy: number) => {
    ctx.drawImage(img, (dx + o.dx) * PX, (dy + o.dy) * PX, W * PX, H * PX);
  };

  stamp(l.legB, stepB, liftB);
  stamp(l.legF, stepF, liftF);
  stamp(l.body, 0, bodyDY);
  ctx.restore();
}
