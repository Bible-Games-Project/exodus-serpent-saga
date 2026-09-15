// Egyptian sorcerer — the supplied PNG remains one complete visual layer.
// Walking, casting, staff magic and aura effects move around the intact image;
// no part of the head, torso, robe, arm or staff is cut or redrawn.
import spriteAsset from "@/assets/mage-red-source.png.asset.json";

export const MAGE_ART = {
  W: 1024,
  H: 1536,
  /** Keeps the replacement at the established Egyptian Sorcerer footprint. */
  PX: 0.043,
  /** Body/feet centre inside the supplied sprite, excluding the extended staff. */
  CX: 460,
  /** Bottom of the visible sandals; transparent source rows sit below them. */
  FOOT_Y: 1507,
} as const;

/** Red jewel at the head of the staff in the supplied, right-facing sprite. */
export const MAGE_STAFF_TIP = { x: 895, y: 174 } as const;

/** Staff-jewel palette, shared by the crystal, aura accents and projectile. */
export const MAGE_LIGHT = {
  core: "#fff0b8",
  mid: "#ff7350",
  outer: "#bd2730",
  deep: "#591124",
  ember: "#d79a3b",
} as const;

/** duration (seconds) of the cast animation — he plants his feet throughout */
export const MAGE_CAST_DUR = 0.7;
/** progress at which the light ball leaves the staff jewel */
export const MAGE_RELEASE_AT = 0.55;

let sprite: HTMLImageElement | null = null;

function load(url: string): HTMLImageElement {
  const img = new Image();
  img.src = url;
  return img;
}

export function ensureMageArt(): boolean {
  if (typeof document === "undefined") return false;
  if (!sprite) sprite = load(spriteAsset.url);
  return sprite.complete && sprite.naturalWidth > 0;
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

/** Screen position of the staff jewel for a given pose. */
export function mageStaffTip(pose: { x: number; groundY: number; flip: 1 | -1 }): { x: number; y: number } {
  const { PX, CX, FOOT_Y } = MAGE_ART;
  return {
    x: Math.round(pose.x + (MAGE_STAFF_TIP.x - CX) * PX * pose.flip),
    y: Math.round(pose.groundY - (FOOT_Y - MAGE_STAFF_TIP.y) * PX),
  };
}

/** Chunky red-jewel light at the exact staff head — no blur or gradient. */
export function drawMageStaffLight(
  ctx: CanvasRenderingContext2D,
  tx: number,
  ty: number,
  now: number,
  charge = 0,
): void {
  const P = 2;
  const pulse = 0.55 + 0.45 * Math.sin(now * 5.5);
  const boost = Math.max(0, Math.min(1, charge));
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 0.22 + 0.2 * pulse + 0.3 * boost;
  ctx.fillStyle = MAGE_LIGHT.deep;
  ctx.fillRect(tx - P * 3, ty - P, P * 6, P * 2);
  ctx.fillRect(tx - P, ty - P * 3, P * 2, P * 6);
  ctx.globalAlpha = 0.58 + 0.35 * boost;
  ctx.fillStyle = MAGE_LIGHT.outer;
  ctx.fillRect(tx - P * 2, ty - P, P * 4, P * 2);
  ctx.fillRect(tx - P, ty - P * 2, P * 2, P * 4);
  ctx.globalAlpha = 0.85 + 0.15 * boost;
  ctx.fillStyle = MAGE_LIGHT.mid;
  ctx.fillRect(tx - P, ty - P, P * 2, P * 2);
  ctx.fillStyle = MAGE_LIGHT.core;
  ctx.fillRect(tx, ty - P / 2, P, P);
  const sparks = [[0, -4], [4, 1], [-3, 2], [2, 4]] as const;
  for (let i = 0; i < sparks.length; i++) {
    if (Math.sin(now * (4.1 + i * 0.17) + i * 2.3) < 0.15 - boost * 0.65) continue;
    ctx.globalAlpha = 0.6 + boost * 0.3;
    ctx.fillStyle = i % 2 === 0 ? MAGE_LIGHT.ember : MAGE_LIGHT.mid;
    ctx.fillRect(tx + sparks[i][0] * P, ty + sparks[i][1] * P, P, P);
  }
  ctx.restore();
}

/**
 * Sparse, irregular evil-magic pixels close to the robe. Every entity receives
 * a stable phase offset, avoiding synchronized identical loops in large waves.
 */
export function drawMageAura(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  now: number,
  seed: number,
  charge = 0,
): void {
  const boost = Math.max(0, Math.min(1, charge));
  const colors = [MAGE_LIGHT.deep, MAGE_LIGHT.outer, MAGE_LIGHT.ember] as const;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  for (let i = 0; i < 7; i++) {
    const phase = now * (0.58 + i * 0.07) + seed * 0.73 + i * 1.91;
    const life = phase - Math.floor(phase);
    if (life < 0.12 || life > 0.9) continue;
    const side = ((seed + i * 13) % 2 === 0 ? 1 : -1);
    const drift = Math.sin(phase * 5.3 + i) * 4;
    const px = i % 3 === 0 ? 3 : 2;
    const pxX = Math.round(x + side * (14 + (i % 3) * 5) + drift);
    const pxY = Math.round(groundY - 8 - life * (34 + (i % 2) * 13));
    const fade = Math.sin(life * Math.PI);
    ctx.globalAlpha = (0.16 + boost * 0.12) * fade;
    ctx.fillStyle = colors[(seed + i) % colors.length];
    ctx.fillRect(pxX, pxY, px, px);
    if (i % 3 === 0) ctx.fillRect(pxX - side * px, pxY + px, px, px);
  }
  // Two short broken wisps hug the robe instead of forming a circular ring.
  for (let i = 0; i < 2; i++) {
    const phase = now * (1.05 + i * 0.18) + seed * 0.37 + i * 2.4;
    const side = i === 0 ? -1 : 1;
    const y = groundY - 12 - ((Math.sin(phase) + 1) * 8);
    ctx.globalAlpha = 0.1 + boost * 0.08;
    ctx.fillStyle = i === 0 ? MAGE_LIGHT.deep : MAGE_LIGHT.outer;
    ctx.fillRect(Math.round(x + side * 15), Math.round(y), 6, 2);
    ctx.fillRect(Math.round(x + side * 19), Math.round(y - 3), 3, 2);
  }
  ctx.restore();
}

/** Pixel-art energy ball cast from the red staff jewel. */
export function drawMageLightBall(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  const P = 3;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const px = Math.round(x);
  const py = Math.round(y);
  const wob = Math.sin(t * 18) > 0;
  ctx.globalAlpha = 0.56;
  ctx.fillStyle = MAGE_LIGHT.deep;
  ctx.fillRect(px - P * 3, py - P, P * 6, P * 2);
  ctx.fillRect(px - P, py - P * 3, P * 2, P * 6);
  ctx.globalAlpha = 1;
  ctx.fillStyle = MAGE_LIGHT.outer;
  ctx.fillRect(px - P * 2, py - P * 2, P * 4, P * 4);
  ctx.fillStyle = MAGE_LIGHT.mid;
  ctx.fillRect(px - P, py - P * 2, P * 2, P * 4);
  ctx.fillRect(px - P * 2, py - P, P * 4, P * 2);
  ctx.fillStyle = MAGE_LIGHT.core;
  ctx.fillRect(px - P, py - P, P * 2, P * 2);
  ctx.fillStyle = MAGE_LIGHT.ember;
  if (wob) {
    ctx.fillRect(px - P * 3, py - P * 3, P, P);
    ctx.fillRect(px + P * 2, py + P * 2, P, P);
  } else {
    ctx.fillRect(px + P * 2, py - P * 3, P, P);
    ctx.fillRect(px - P * 3, py + P * 2, P, P);
  }
  ctx.restore();
}

/** Whole-sprite casting motion; the supplied figure remains completely intact. */
function castOffset(progress: number): number {
  const p = Math.max(0, Math.min(1, progress));
  if (p < MAGE_RELEASE_AT) return -8 * (p / MAGE_RELEASE_AT);
  return -8 + 14 * ((p - MAGE_RELEASE_AT) / (1 - MAGE_RELEASE_AT));
}

export function drawMageArt(ctx: CanvasRenderingContext2D, pose: MagePose): void {
  if (!ensureMageArt() || !sprite) return;
  const { W, H, PX, CX, FOOT_Y } = MAGE_ART;
  const t = pose.castP;
  const casting = t != null && t > 0 && t < 1;
  const stride = pose.moving && !casting ? Math.sin(pose.walkPhase) : 0;
  const bob = casting
    ? Math.round(castOffset(t as number) * 0.35)
    : pose.moving
      ? (Math.cos(pose.walkPhase * 2) > 0.35 ? -10 : 0)
      : (Math.sin(pose.now * 1.8) > 0.55 ? -6 : 0);
  const castPush = casting ? castOffset(t as number) : 0;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(pose.x), Math.round(pose.groundY));
  if (pose.flip === -1) ctx.scale(-1, 1);
  ctx.translate(-CX * PX, -H * PX);
  ctx.drawImage(
    sprite,
    (castPush + stride * 2) * PX,
    (H - FOOT_Y + bob) * PX,
    W * PX,
    H * PX,
  );
  ctx.restore();
}