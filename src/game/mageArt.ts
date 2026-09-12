// Egyptian sorcerer — the supplied pixel-art sprite, split once into three
// layers so he walks and casts without a single pixel being redrawn:
//
//   body — hood, robe, both arms and the raised crystal staff
//   legb — left boot / lower leg
//   legf — right boot / lower leg
//
// The crystal at the staff head gets a chunky pixel light effect drawn by the
// renderer at MAGE_STAFF_TIP (sprite coordinates).
import bodyAsset from "@/assets/mage-body.png.asset.json";
import legBAsset from "@/assets/mage-legb.png.asset.json";
import legFAsset from "@/assets/mage-legf.png.asset.json";

export const MAGE_ART = {
  W: 44,
  H: 58,
  PX: 1.1,
  /** x of his body centre inside the sprite */
  CX: 22,
} as const;

/** Crystal position inside the sprite (unflipped art faces LEFT). */
export const MAGE_STAFF_TIP = { x: 39, y: 7 } as const;

/** Colours of the staff light — reused by the light-ball projectile. */
export const MAGE_LIGHT = {
  core: "#f2fbff",
  mid: "#8fd8ff",
  outer: "#3f86e0",
  deep: "#2b4fae",
} as const;

/** duration (seconds) of the cast animation — he plants his feet throughout */
export const MAGE_CAST_DUR = 0.7;
/** progress at which the light ball leaves the crystal */
export const MAGE_RELEASE_AT = 0.55;

type Layers = { body: HTMLImageElement; legB: HTMLImageElement; legF: HTMLImageElement };
let layers: Layers | null = null;

function load(url: string): HTMLImageElement {
  const img = new Image();
  img.src = url;
  return img;
}

export function ensureMageArt(): boolean {
  if (typeof document === "undefined") return false;
  if (!layers) {
    layers = { body: load(bodyAsset.url), legB: load(legBAsset.url), legF: load(legFAsset.url) };
  }
  const l = layers;
  return [l.body, l.legB, l.legF].every((i) => i.complete && i.naturalWidth > 0);
}

export type MagePose = {
  x: number;
  groundY: number;
  flip: 1 | -1;
  walkPhase: number;
  moving: boolean;
  /** 0..1 progress of the cast; null = idle */
  castP?: number | null;
  /** seconds, drives the crystal sparkle */
  now: number;
};

/** Screen position of the crystal for a given pose. */
export function mageStaffTip(pose: { x: number; groundY: number; flip: 1 | -1 }): { x: number; y: number } {
  const { PX, CX, H } = MAGE_ART;
  return {
    x: Math.round(pose.x + (MAGE_STAFF_TIP.x - CX) * PX * pose.flip),
    y: Math.round(pose.groundY - (H - MAGE_STAFF_TIP.y) * PX),
  };
}

/** Chunky pixel light around the crystal — no smooth gradients. */
export function drawMageStaffLight(
  ctx: CanvasRenderingContext2D,
  tx: number,
  ty: number,
  now: number,
  charge = 0,
): void {
  const P = 2; // pixel size of the effect, matched to the sprite density
  const pulse = 0.55 + 0.45 * Math.sin(now * 5.5);
  const boost = Math.max(0, Math.min(1, charge));
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 0.28 + 0.22 * pulse + 0.3 * boost;
  ctx.fillStyle = MAGE_LIGHT.outer;
  ctx.fillRect(tx - P * 2, ty - P, P * 4, P * 2);
  ctx.fillRect(tx - P, ty - P * 2, P * 2, P * 4);
  ctx.globalAlpha = 0.6 + 0.4 * boost;
  ctx.fillStyle = MAGE_LIGHT.mid;
  ctx.fillRect(tx - P, ty - P, P * 2, P * 2);
  ctx.globalAlpha = 1;
  ctx.fillStyle = MAGE_LIGHT.core;
  ctx.fillRect(tx - P / 2, ty - P / 2, P, P);
  // Four orbiting sparks, snapped to the effect grid.
  const spark = [
    [0, -3], [3, 0], [0, 3], [-3, 0],
  ];
  for (let i = 0; i < spark.length; i++) {
    const on = Math.sin(now * 4 + i * 1.7) > (0.2 - boost * 0.8);
    if (!on) continue;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = i % 2 === 0 ? MAGE_LIGHT.mid : MAGE_LIGHT.core;
    ctx.fillRect(tx + spark[i][0] * P, ty + spark[i][1] * P, P, P);
  }
  ctx.restore();
}

/** Pixel-art ball of light hurled by the mage. */
export function drawMageLightBall(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  const P = 3;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const px = Math.round(x);
  const py = Math.round(y);
  const wob = Math.sin(t * 18) > 0 ? 1 : 0;
  // outer cross
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = MAGE_LIGHT.deep;
  ctx.fillRect(px - P * 3, py - P, P * 6, P * 2);
  ctx.fillRect(px - P, py - P * 3, P * 2, P * 6);
  // body
  ctx.globalAlpha = 1;
  ctx.fillStyle = MAGE_LIGHT.outer;
  ctx.fillRect(px - P * 2, py - P * 2, P * 4, P * 4);
  ctx.fillStyle = MAGE_LIGHT.mid;
  ctx.fillRect(px - P * 2 + P, py - P * 2, P * 2, P * 4);
  ctx.fillRect(px - P * 2, py - P * 2 + P, P * 4, P * 2);
  ctx.fillStyle = MAGE_LIGHT.core;
  ctx.fillRect(px - P, py - P, P * 2, P * 2);
  // flickering corner sparks
  ctx.fillStyle = MAGE_LIGHT.mid;
  if (wob) {
    ctx.fillRect(px - P * 3, py - P * 3, P, P);
    ctx.fillRect(px + P * 2, py + P * 2, P, P);
  } else {
    ctx.fillRect(px + P * 2, py - P * 3, P, P);
    ctx.fillRect(px - P * 3, py + P * 2, P, P);
  }
  ctx.restore();
}

/** Staff-arm offset (sprite px) across the cast: raise, then thrust forward. */
function castOffset(progress: number): number {
  const p = Math.max(0, Math.min(1, progress));
  if (p < MAGE_RELEASE_AT) return -2 * (p / MAGE_RELEASE_AT);
  return -2 + 4 * ((p - MAGE_RELEASE_AT) / (1 - MAGE_RELEASE_AT));
}

export function drawMageArt(ctx: CanvasRenderingContext2D, pose: MagePose): void {
  if (!ensureMageArt() || !layers) return;
  const { W, H, PX, CX } = MAGE_ART;
  const l = layers;

  const t = pose.castP;
  const casting = t != null && t > 0 && t < 1;
  const swing = pose.moving && !casting ? Math.sin(pose.walkPhase) : 0;
  const stepF = Math.round(swing * 2);
  const stepB = -stepF;
  const bodyDY = casting
    ? Math.round(castOffset(t as number) * 0.5)
    : pose.moving
      ? (Math.cos(pose.walkPhase) > 0.4 ? -1 : 0)
      : (Math.sin(pose.now * 1.8) > 0.5 ? -1 : 0);

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
  stamp(l.body, 0, bodyDY);
  ctx.restore();
}
