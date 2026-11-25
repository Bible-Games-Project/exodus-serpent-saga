// Desert wolf — the supplied pixel-art sprite, split once into five layers so it
// can wait, run and leap without a single pixel being redrawn:
//
//   body   — head, ears, neck, torso, tail and hips (down to the leg cut)
//   legRN  — near hind leg      legRF — far hind leg
//   legFN  — near front leg     legFF — far front leg
//
// v2 layers (2026-11-25): two stray pieces moved to the right layer (a belly
// bit from the far hind leg into the body, a toe from the far fore leg into the
// near fore leg) and the legs upscaled x4 with their diagonal pixel joints
// bridged, so they stay whole when they swing. The original wolf-*.png files
// are kept untouched.
import bodyAsset from "@/assets/wolf-v2-body.png";
import legRNAsset from "@/assets/wolf-v2-legrn.png";
import legRFAsset from "@/assets/wolf-v2-legrf.png";
import legFNAsset from "@/assets/wolf-v2-legfn.png";
import legFFAsset from "@/assets/wolf-v2-legff.png";

export const WOLF_ART = {
  /** sprite-pixel size of the shared layer canvas */
  W: 52,
  H: 27,
  /** screen pixels per sprite pixel */
  PX: 1.0,
  /** x of the body centre inside the sprite */
  CX: 26,
} as const;

/** Top of each leg (where it meets the body), the pivot of the gallop swing. */
const LEG_PIVOT = {
  RN: { x: 14, y: 15.5 }, RF: { x: 21.5, y: 15.5 },
  FN: { x: 37, y: 15.5 }, FF: { x: 42, y: 17.5 },
} as const;

/** duration (seconds) of the pouncing leap attack */
export const WOLF_LEAP_DUR = 0.5;

type Layers = {
  body: HTMLImageElement;
  legRN: HTMLImageElement;
  legRF: HTMLImageElement;
  legFN: HTMLImageElement;
  legFF: HTMLImageElement;
};
let layers: Layers | null = null;

function load(url: string): HTMLImageElement {
  const img = new Image();
  img.src = url;
  return img;
}

export function ensureWolfArt(): boolean {
  if (typeof document === "undefined") return false;
  if (!layers) {
    layers = {
      body: load(bodyAsset),
      legRN: load(legRNAsset),
      legRF: load(legRFAsset),
      legFN: load(legFNAsset),
      legFF: load(legFFAsset),
    };
  }
  const l = layers;
  return [l.body, l.legRN, l.legRF, l.legFN, l.legFF].every((i) => i.complete && i.naturalWidth > 0);
}

/** Body offset (sprite px) through the crouch → leap → land curve. */
function leapOffset(p: number): { dx: number; dy: number } {
  const t = Math.max(0, Math.min(1, p));
  if (t < 0.26) {
    const k = t / 0.26;            // gather: settle back and low
    return { dx: -3 * k, dy: 2 * k };
  }
  if (t < 0.62) {
    const k = (t - 0.26) / 0.36;   // spring forward and high
    return { dx: -3 + 12 * k, dy: 2 - 9 * k };
  }
  const k = (t - 0.62) / 0.38;     // land
  return { dx: 9 * (1 - k), dy: -7 * (1 - k) };
}

export type WolfPose = {
  /** screen position of the paws (ground contact point) */
  x: number;
  groundY: number;
  flip: 1 | -1;
  walkPhase: number;
  /** true while running toward Moses */
  running: boolean;
  /** 0..1 progress of the leap attack; null = not leaping */
  leap?: number | null;
};

export function drawWolfArt(ctx: CanvasRenderingContext2D, pose: WolfPose): void {
  if (!ensureWolfArt() || !layers) return;
  const { W, H, PX, CX } = WOLF_ART;
  const l = layers;

  const leaping = pose.leap != null && pose.leap > 0 && pose.leap < 1;
  const o = leaping ? leapOffset(pose.leap as number) : { dx: 0, dy: 0 };

  // Running: a gallop. Each leg swings from its own hip/shoulder (never slides
  // under the body), hind pair against the front pair, far legs a beat late.
  const running = pose.running && !leaping;
  const ph = pose.walkPhase;
  // Waiting: a slow breath, one pixel, plus the same for the planted legs.
  const idleBreath = !pose.running && !leaping
    ? (Math.sin(pose.walkPhase * 0.25) > 0.6 ? -1 : 0)
    : 0;
  const bodyDY = running ? -Math.max(0, Math.cos(ph * 2)) * 1.5 : idleBreath;
  const idle = !pose.running && !leaping;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(pose.x), Math.round(pose.groundY));
  if (pose.flip === -1) ctx.scale(-1, 1);
  ctx.translate(-CX * PX, -H * PX);

  const stamp = (img: HTMLImageElement, dx: number, dy: number) => {
    ctx.drawImage(img, (dx + o.dx) * PX, (dy + o.dy) * PX, W * PX, H * PX);
  };

  const stampIdleLeg = (img: HTMLImageElement, pivotX: number, pivotY: number, angle: number, dy: number) => {
    ctx.save();
    ctx.translate(pivotX * PX, pivotY * PX);
    ctx.rotate(angle);
    ctx.translate(-pivotX * PX, -pivotY * PX);
    ctx.drawImage(img, 0, dy * PX, W * PX, H * PX);
    ctx.restore();
  };

  if (idle) {
    // Plant each paw directly below its shoulder/hip. The intact body is drawn
    // last, covering the small joint overlap exactly as it does while running.
    stampIdleLeg(l.legRF, 22, 15, Math.PI / 6, 2);
    stampIdleLeg(l.legFF, 43, 17, Math.PI / 9, 0);
    stampIdleLeg(l.legRN, 13, 15, -Math.PI / 4.5, 4);
    stampIdleLeg(l.legFN, 37, 15, Math.PI / 12, 0);
  } else if (running) {
    const A = 0.42;
    stampIdleLeg(l.legRF, LEG_PIVOT.RF.x, LEG_PIVOT.RF.y, Math.sin(ph - 0.7) * A, bodyDY);
    stampIdleLeg(l.legFF, LEG_PIVOT.FF.x, LEG_PIVOT.FF.y, Math.sin(ph + Math.PI - 0.7) * A, bodyDY);
    stampIdleLeg(l.legRN, LEG_PIVOT.RN.x, LEG_PIVOT.RN.y, Math.sin(ph) * A, bodyDY);
    stampIdleLeg(l.legFN, LEG_PIVOT.FN.x, LEG_PIVOT.FN.y, Math.sin(ph + Math.PI) * A, bodyDY);
  } else {
    stamp(l.legRF, 0, 0);
    stamp(l.legFF, 0, 0);
    stamp(l.legRN, 0, 0);
    stamp(l.legFN, 0, 0);
  }
  stamp(l.body, 0, bodyDY);
  ctx.restore();
}
