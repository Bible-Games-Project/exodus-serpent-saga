// Ramses' artwork. The sprite is the user-supplied pixel-art PNG, split once
// into two layers (body + staff) so the staff can swing from his hand during a
// melee strike without a second staff ever appearing. Neither layer is redrawn
// or recoloured: composited at rest they are pixel-identical to the original.
import bodyAsset from "@/assets/ramses-body.png.asset.json";
import staffAsset from "@/assets/ramses-staff.png.asset.json";

export const RAMSES_ART = {
  /** sprite-pixel size of each layer */
  W: 46,
  H: 47,
  /** screen pixels per sprite pixel — matches the game's 3px art grid (x2 scale) */
  PX: 3,
  /** x of Ramses' body centre inside the sprite (the staff sits to the left) */
  CX: 27.5,
  /** fist / staff pivot inside the sprite */
  HAND: { x: 9.5, y: 24.5 },
  /** first row of the legs (used for the walk cycle) */
  LEG_TOP: 41,
} as const;

let bodyImg: HTMLImageElement | null = null;
let staffImg: HTMLImageElement | null = null;

function load(url: string): HTMLImageElement {
  const img = new Image();
  img.src = url;
  return img;
}

export function ensureRamsesArt(): boolean {
  if (typeof document === "undefined") return false;
  if (!bodyImg) bodyImg = load(bodyAsset.url);
  if (!staffImg) staffImg = load(staffAsset.url);
  return !!(bodyImg.complete && bodyImg.naturalWidth && staffImg.complete && staffImg.naturalWidth);
}

export type RamsesPose = {
  /** screen position of Ramses' feet (ground contact point) */
  x: number;
  groundY: number;
  flip: 1 | -1;
  /** walk cycle driver; pass 0 and moving=false for idle */
  walkPhase: number;
  moving: boolean;
  /** extra vertical offset in screen px (bob, leap arc) */
  bob: number;
  /** staff rotation in radians around the hand; 0 keeps the original pose */
  staffAngle: number;
};

/**
 * Draws Ramses at native pixel density. The walk cycle re-stamps the existing
 * leg pixels with a 1-pixel alternating lift/step and a 1-pixel torso bob — no
 * pixel is redrawn or resampled, so the character stays exactly as supplied.
 */
export function drawRamsesArt(ctx: CanvasRenderingContext2D, pose: RamsesPose): void {
  if (!ensureRamsesArt() || !bodyImg || !staffImg) return;
  const { W, H, PX, CX, HAND, LEG_TOP } = RAMSES_ART;
  const step = pose.moving ? (Math.sin(pose.walkPhase) > 0 ? 1 : 0) : -1;
  const torsoBob = pose.moving ? (step === 1 ? -1 : 0) : 0;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  // Feet on the ground, body centre on the entity, mirrored when facing left.
  ctx.translate(Math.round(pose.x), Math.round(pose.groundY + pose.bob));
  if (pose.flip === -1) ctx.scale(-1, 1);
  ctx.translate(-CX * PX, -H * PX);

  // ---- staff (behind the fist so it reads as held) ----
  ctx.save();
  ctx.translate(HAND.x * PX, HAND.y * PX);
  if (pose.staffAngle) ctx.rotate(pose.staffAngle);
  ctx.translate(-HAND.x * PX, -HAND.y * PX);
  ctx.translate(0, torsoBob * PX);
  ctx.drawImage(staffImg, 0, 0, W * PX, H * PX);
  ctx.restore();

  // ---- body: legs first, then the intact torso/robe on top ----
  // Each moving leg carries a small overlap of the robe hem. The torso is then
  // stamped in full through LEG_TOP, preserving a continuous connection at the
  // hip and keeping the original stride offsets unchanged.
  const legH = H - LEG_TOP;
  // Preserve the established robe overlap used by the existing leg cycle.
  const OVER = 6;
  const bandTop = LEG_TOP - OVER;
  if (step === -1) {
    ctx.drawImage(bodyImg, 0, LEG_TOP, W, legH, 0, LEG_TOP * PX, W * PX, legH * PX);
  } else {
    // Front leg lifts and reaches, rear leg trails — mirrored on the next frame.
    const lift = step === 1 ? 1 : 0;
    const half = Math.round(CX);
    const OX = 2;
    const lW = half + OX;
    ctx.drawImage(
      bodyImg, 0, bandTop, lW, legH + OVER,
      -(1 - lift) * PX, (bandTop - lift) * PX, lW * PX, (legH + OVER) * PX,
    );
    const rSX = half - OX;
    const rW = W - rSX;
    ctx.drawImage(
      bodyImg, rSX, bandTop, rW, legH + OVER,
      (rSX + lift) * PX, (bandTop - (1 - lift)) * PX, rW * PX, (legH + OVER) * PX,
    );
  }
  // Re-stamp the complete robe/torso above the leg line. This closes any seam
  // and keeps both arms and hands intact in every walking pose.
  ctx.drawImage(bodyImg, 0, 0, W, LEG_TOP, 0, torsoBob * PX, W * PX, LEG_TOP * PX);
  ctx.restore();
}

