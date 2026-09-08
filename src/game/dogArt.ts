// Desert dog (second enemy) — the supplied pixel-art sprite, split once into
// five layers so it can walk and lunge without a single pixel being redrawn:
//
//   body   — head, neck, torso, tail and the hips (down to the leg cut)
//   legRN  — near hind leg      legRF — far hind leg
//   legFN  — near front leg     legFF — far front leg
//
// Each leg layer carries a few rows of overlap above the cut, and the body is
// stamped after them, so a stepping leg can never leave a hole or a hard cut.
import bodyAsset from "@/assets/dog-body.png.asset.json";
import legRNAsset from "@/assets/dog-legrn.png.asset.json";
import legRFAsset from "@/assets/dog-legrf.png.asset.json";
import legFNAsset from "@/assets/dog-legfn.png.asset.json";
import legFFAsset from "@/assets/dog-legff.png.asset.json";

export const DOG_ART = {
  /** sprite-pixel size of the shared layer canvas */
  W: 48,
  H: 39,
  /** screen pixels per sprite pixel */
  PX: 0.9,
  /** x of the body centre inside the sprite */
  CX: 24,
} as const;

/** duration (seconds) of the crouch + lunge bite */
export const DOG_POUNCE_DUR = 0.42;

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

export function ensureDogArt(): boolean {
  if (typeof document === "undefined") return false;
  if (!layers) {
    layers = {
      body: load(bodyAsset.url),
      legRN: load(legRNAsset.url),
      legRF: load(legRFAsset.url),
      legFN: load(legFNAsset.url),
      legFF: load(legFFAsset.url),
    };
  }
  const l = layers;
  return [l.body, l.legRN, l.legRF, l.legFN, l.legFF].every((i) => i.complete && i.naturalWidth > 0);
}

export type DogPose = {
  /** screen position of the paws (ground contact point) */
  x: number;
  groundY: number;
  flip: 1 | -1;
  walkPhase: number;
  moving: boolean;
  /** 0..1 progress of the crouch/lunge bite; null = normal movement */
  pounce?: number | null;
};

/** Body offset (sprite px) during the crouch → lunge → recover curve. */
function pounceOffset(p: number): { dx: number; dy: number; stretch: number } {
  const t = Math.max(0, Math.min(1, p));
  if (t < 0.3) {
    // crouch: settle back and down
    const k = t / 0.3;
    return { dx: -2 * k, dy: 2 * k, stretch: -1 * k };
  }
  if (t < 0.6) {
    // lunge: snap forward and up
    const k = (t - 0.3) / 0.3;
    return { dx: -2 + 9 * k, dy: 2 - 6 * k, stretch: -1 + 4 * k };
  }
  // recover
  const k = (t - 0.6) / 0.4;
  return { dx: 7 * (1 - k), dy: -4 * (1 - k), stretch: 3 * (1 - k) };
}

/** Screen position of the muzzle — used to place the bite impact FX. */
export function dogBitePos(x: number, groundY: number, flip: 1 | -1, pounce: number) {
  const { PX, CX, H } = DOG_ART;
  const o = pounceOffset(pounce);
  return {
    x: x + (40 - CX + o.dx) * PX * flip,
    y: groundY - (H - 10 - o.dy) * PX,
  };
}

/**
 * Draws the dog at native pixel density. Walking is a diagonal trot produced by
 * translating the four leg layers; the body and tail stay intact.
 */
export function drawDogArt(ctx: CanvasRenderingContext2D, pose: DogPose): void {
  if (!ensureDogArt() || !layers) return;
  const { W, H, PX, CX } = DOG_ART;
  const l = layers;

  const pouncing = pose.pounce != null && pose.pounce > 0 && pose.pounce < 1;
  const o = pouncing ? pounceOffset(pose.pounce as number) : { dx: 0, dy: 0, stretch: 0 };

  // Diagonal gait: near hind + far front swing together, opposite the other pair.
  const swing = pose.moving && !pouncing ? Math.sin(pose.walkPhase) : 0;
  const stepA = Math.round(swing * 2);
  const stepB = -stepA;
  const liftA = stepA > 0 ? -1 : 0;
  const liftB = stepB > 0 ? -1 : 0;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(pose.x), Math.round(pose.groundY));
  if (pose.flip === -1) ctx.scale(-1, 1);
  ctx.translate(-CX * PX, -H * PX);

  const stamp = (img: HTMLImageElement, dx: number, dy: number) => {
    ctx.drawImage(img, dx * PX, dy * PX, W * PX, H * PX);
  };

  if (pouncing) {
    // Legs tuck backwards while airborne, front legs reach out ahead.
    stamp(l.legRN, o.dx - o.stretch, o.dy);
    stamp(l.legRF, o.dx - o.stretch, o.dy);
    stamp(l.legFN, o.dx + o.stretch, o.dy);
    stamp(l.legFF, o.dx + o.stretch, o.dy);
    stamp(l.body, o.dx, o.dy);
  } else {
    stamp(l.legRN, stepA, liftA);
    stamp(l.legFF, stepA, liftA);
    stamp(l.legRF, stepB, liftB);
    stamp(l.legFN, stepB, liftB);
    // Subtle body bob keeps the trot lively without deforming the sprite.
    stamp(l.body, 0, pose.moving ? (Math.cos(pose.walkPhase * 2) > 0 ? -1 : 0) : 0);
  }
  ctx.restore();
}
