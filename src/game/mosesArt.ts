// Moses' artwork. The sprite is the user-supplied pixel-art PNG, split once into
// two layers (body + staff) so the staff he already holds is the one that swings
// during his melee attack — no second staff is ever drawn. Neither layer is
// redrawn or recoloured: composited at rest they are pixel-identical to the
// original PNG.
import bodyAsset from "@/assets/moses-body.png.asset.json";
import staffAsset from "@/assets/moses-staff.png.asset.json";

export const MOSES_ART = {
  /** sprite-pixel size of each layer (native resolution of the supplied PNG) */
  W: 64,
  H: 96,
  /** screen pixels per sprite pixel — native density, art is never resampled */
  PX: 1,
  /** x of Moses' body centre inside the sprite (the staff sits to his right) */
  CX: 39,
  /** row just below the robe hem: everything from here down is feet/sandals */
  LEG_TOP: 83,
  /** fist / staff pivot inside the sprite */
  HAND: { x: 17, y: 40 },
  /** crook (business end of the staff) relative to HAND, in sprite pixels */
  TIP: { x: -6, y: -34 },
} as const;

let bodyImg: HTMLImageElement | null = null;
let staffImg: HTMLImageElement | null = null;

function load(url: string): HTMLImageElement {
  const img = new Image();
  img.src = url;
  return img;
}

export function ensureMosesArt(): boolean {
  if (typeof document === "undefined") return false;
  if (!bodyImg) bodyImg = load(bodyAsset.url);
  if (!staffImg) staffImg = load(staffAsset.url);
  return !!(bodyImg.complete && bodyImg.naturalWidth && staffImg.complete && staffImg.naturalWidth);
}

export type MosesPose = {
  /** screen position of Moses' feet (ground contact point) */
  x: number;
  groundY: number;
  flip: 1 | -1;
  /** walk cycle driver; pass 0 and moving=false for idle */
  walkPhase: number;
  moving: boolean;
  /** extra vertical offset in screen px (bob) */
  bob: number;
  /** staff rotation in radians around the hand; 0 keeps the original pose */
  staffAngle: number;
  /** optional additive flash pass (invincibility) */
  flash?: number;
};

/** Screen position of the staff's crook for a given pose — used by the wind slash. */
export function mosesStaffTip(x: number, groundY: number, flip: 1 | -1, angle: number) {
  const { PX, TIP } = MOSES_ART;
  const c = Math.cos(angle), s = Math.sin(angle);
  const rx = (TIP.x * c - TIP.y * s) * PX;
  const ry = (TIP.x * s + TIP.y * c) * PX;
  return { x: x + rx * flip, y: groundY + ry };
}

/** Screen position of Moses' grip (staff pivot). */
export function mosesGrip(x: number, groundY: number, flip: 1 | -1) {
  const { PX, CX, H, HAND } = MOSES_ART;
  return {
    x: x + (HAND.x - CX) * PX * flip,
    y: groundY - (H - HAND.y) * PX,
  };
}

/**
 * Draws Moses at native pixel density. The walk cycle re-stamps the existing
 * sandal pixels with a one-pixel alternating step plus a one-pixel torso bob —
 * no pixel is redrawn or resampled, so the character stays exactly as supplied.
 */
export function drawMosesArt(ctx: CanvasRenderingContext2D, pose: MosesPose): void {
  if (!ensureMosesArt() || !bodyImg || !staffImg) return;
  const { W, H, PX, CX, HAND, LEG_TOP } = MOSES_ART;
  const step = pose.moving ? (Math.sin(pose.walkPhase) > 0 ? 1 : 0) : -1;
  const torsoBob = pose.moving ? (step === 1 ? -1 : 0) : 0;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(pose.x), Math.round(pose.groundY + pose.bob));
  if (pose.flip === -1) ctx.scale(-1, 1);
  ctx.translate(-CX * PX, -H * PX);

  const paint = () => {
    // ---- staff (behind the body so the fist keeps gripping it) ----
    ctx.save();
    ctx.translate(HAND.x * PX, HAND.y * PX);
    if (pose.staffAngle) ctx.rotate(pose.staffAngle);
    ctx.translate(-HAND.x * PX, -HAND.y * PX);
    ctx.translate(0, torsoBob * PX);
    ctx.drawImage(staffImg!, 0, 0, W * PX, H * PX);
    ctx.restore();

    // ---- body: torso + animated feet ----
    const legH = H - LEG_TOP;
    ctx.drawImage(bodyImg!, 0, 0, W, LEG_TOP, 0, torsoBob * PX, W * PX, LEG_TOP * PX);
    if (step === -1) {
      ctx.drawImage(bodyImg!, 0, LEG_TOP, W, legH, 0, LEG_TOP * PX, W * PX, legH * PX);
    } else {
      // Front foot lifts and reaches, rear foot trails — mirrored next frame.
      const lift = step === 1 ? 1 : 0;
      const half = Math.round(CX);
      ctx.drawImage(
        bodyImg!, 0, LEG_TOP, half, legH,
        -(1 - lift) * PX, (LEG_TOP - lift) * PX, half * PX, legH * PX,
      );
      ctx.drawImage(
        bodyImg!, half, LEG_TOP, W - half, legH,
        (half + lift) * PX, (LEG_TOP - (1 - lift)) * PX, (W - half) * PX, legH * PX,
      );
    }
  };

  paint();
  if (pose.flash && pose.flash > 0) {
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = pose.flash;
    paint();
  }
  ctx.restore();
}
