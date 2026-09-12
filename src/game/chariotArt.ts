// Egyptian archer chariot — the supplied pixel-art sprite, drawn as one rigid
// team (horses + cab + driver + archer). It never stops rolling, so the only
// animation it needs is the gallop bounce plus the archer's nocked arrow.
import bodyAsset from "@/assets/chariot-body.png.asset.json";

export const CHARIOT_ART = {
  W: 192,
  H: 124,
  /** screen pixels per sprite pixel */
  PX: 0.55,
  /** x of the rig's centre inside the sprite */
  CX: 96,
} as const;

/** Bow/string release point inside the sprite (unflipped art drives RIGHT). */
export const CHARIOT_BOW = { x: 79, y: 28 } as const;

/** duration (seconds) of the draw + release; movement is never interrupted */
export const CHARIOT_SHOOT_DUR = 0.55;
/** progress at which the arrow leaves the bow */
export const CHARIOT_RELEASE_AT = 0.62;

let img: HTMLImageElement | null = null;

export function ensureChariotArt(): boolean {
  if (typeof document === "undefined") return false;
  if (!img) {
    img = new Image();
    img.src = bodyAsset.url;
  }
  return img.complete && img.naturalWidth > 0;
}

export type ChariotPose = {
  x: number;
  groundY: number;
  flip: 1 | -1;
  /** drives the gallop bounce */
  phase: number;
  /** 0..1 progress of the shot; null = not shooting */
  shoot?: number | null;
};

/** Screen position of the bow's release point for a given pose. */
export function chariotBowPoint(pose: { x: number; groundY: number; flip: 1 | -1 }): { x: number; y: number } {
  const { PX, CX, H } = CHARIOT_ART;
  return {
    x: Math.round(pose.x + (CHARIOT_BOW.x - CX) * PX * pose.flip),
    y: Math.round(pose.groundY - (H - CHARIOT_BOW.y) * PX),
  };
}

export function drawChariotArt(ctx: CanvasRenderingContext2D, pose: ChariotPose): void {
  if (!ensureChariotArt() || !img) return;
  const { W, H, PX, CX } = CHARIOT_ART;
  const bounce = Math.sin(pose.phase) > 0.35 ? -1 : 0;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(pose.x), Math.round(pose.groundY) + bounce);
  if (pose.flip === -1) ctx.scale(-1, 1);
  ctx.translate(-CX * PX, -H * PX);
  ctx.drawImage(img, 0, 0, W * PX, H * PX);
  ctx.restore();

  // Nocked arrow on the string: pulled back, then gone the instant it flies.
  const s = pose.shoot;
  if (s != null && s > 0 && s < CHARIOT_RELEASE_AT) {
    const pull = 5 * (s / CHARIOT_RELEASE_AT);
    const bow = chariotBowPoint(pose);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(bow.x, bow.y + bounce);
    if (pose.flip === -1) ctx.scale(-1, 1);
    ctx.fillStyle = "#6b421f";
    ctx.fillRect(-14 - pull, -1, 16, 2);
    ctx.fillStyle = "#e8d08a";
    ctx.fillRect(1 - pull, -1, 3, 2);
    ctx.restore();
  }
}
