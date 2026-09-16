// Agile Egyptian soldier — the supplied PNG remains one intact visual layer.
// The whole figure follows the jump arc so no body or limb is cut apart.
import spriteAsset from "@/assets/agile-new-source.png.asset.json";

export const AGILE_ART = {
  /** sprite-pixel size of the shared layer canvas */
  W: 1024,
  H: 1536,
  /** Exactly three times the previous 0.024 visual scale. */
  PX: 0.072,
  /** x of his body centre inside the sprite */
  CX: 512,
  /** Transparent source rows below the visible feet. */
  FOOT_Y: 1371,
} as const;

/** duration (seconds) of the quick dagger stab */
export const AGILE_STAB_DUR = 0.34;
export const AGILE_HOP_DUR = 0.42;

let sprite: HTMLImageElement | null = null;

function load(url: string): HTMLImageElement {
  const img = new Image();
  img.src = url;
  return img;
}

export function ensureAgileArt(): boolean {
  if (typeof document === "undefined") return false;
  if (!sprite) sprite = load(spriteAsset.url);
  return sprite.complete && sprite.naturalWidth > 0;
}

export type AgilePose = {
  /** screen position of his feet (ground contact point) */
  x: number;
  groundY: number;
  flip: 1 | -1;
  /** 0..1 progress through the current hop; null while grounded */
  hop?: number | null;
  /** 0..1 progress of the dagger stab; null = not attacking */
  stab?: number | null;
  /** true while travelling through a jump */
  dashing?: boolean;
  /** free-running phase for the idle bounce */
  phase: number;
};

/** Height (source-image px) above the ground through a complete jump. */
function hopCurve(p: number): number {
  const t = Math.max(0, Math.min(1, p));
  // Brief anticipation, a readable airborne arc, then a firm landing.
  if (t < 0.12) return -24 * (t / 0.12);
  const airborne = (t - 0.12) / 0.88;
  return Math.sin(airborne * Math.PI) * 270 - 24 * (1 - airborne);
}

export function drawAgileSoldierArt(ctx: CanvasRenderingContext2D, pose: AgilePose): void {
  if (!ensureAgileArt() || !sprite) return;
  const { W, H, PX, CX, FOOT_Y } = AGILE_ART;

  const hopping = pose.hop != null && pose.hop > 0 && pose.hop < 1;
  const lift = hopping ? hopCurve(pose.hop as number) : 0;

  const stab = pose.stab != null && pose.stab > 0 && pose.stab < 1 ? (pose.stab as number) : null;
  // Quick stab: coil back, punch the dagger forward, snap out.
  const stabPush = stab == null ? 0 : stab < 0.3 ? -3 * (stab / 0.3)
    : stab < 0.55 ? -3 + 10 * ((stab - 0.3) / 0.25)
      : 7 * (1 - (stab - 0.55) / 0.45);

  const bounce = hopping ? 0 : Math.sin(pose.phase * 3) > 0.5 ? -18 : 0;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(pose.x), Math.round(pose.groundY));
  if (pose.flip === -1) ctx.scale(-1, 1);
  ctx.translate(-CX * PX, -H * PX);
  ctx.drawImage(sprite, stabPush * 0.5 * PX, (H - FOOT_Y + bounce - lift) * PX, W * PX, H * PX);
  ctx.restore();
}
