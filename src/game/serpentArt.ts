// Moses' living-serpent projectile — the supplied PNG is kept intact and at
// its original proportions. Narrow overlapping strips receive a tiny travelling
// vertical offset so the body visibly slithers without redrawing the artwork.
import serpentAsset from "@/assets/moses-snake.png.asset.json";

export const SERPENT_ART = {
  W: 1983,
  H: 793,
  /** Exactly 75% of the previous 104 × 42 screen-pixel size. */
  DRAW_W: 78,
  DRAW_H: 31.5,
} as const;

let serpent: HTMLImageElement | null = null;

function load(url: string): HTMLImageElement {
  const img = new Image();
  img.src = url;
  return img;
}

export function ensureSerpentArt(): boolean {
  if (typeof document === "undefined") return false;
  if (!serpent) serpent = load(serpentAsset.url);
  return serpent.complete && serpent.naturalWidth > 0;
}

export function drawSerpentArt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  facing: 1 | -1,
  phase: number,
): boolean {
  if (!ensureSerpentArt() || !serpent) return false;
  const { W, H, DRAW_W, DRAW_H } = SERPENT_ART;
  const strips = 18;
  const sourceStep = W / strips;
  const drawStep = DRAW_W / strips;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(x), Math.round(y));
  // The supplied artwork faces right. For leftward travel, remove the half-turn
  // from the trajectory and mirror horizontally, rather than rotating it upside
  // down. This preserves the same upright silhouette in either direction.
  const uprightAngle = facing === -1
    ? angle + (angle > 0 ? -Math.PI : Math.PI)
    : angle;
  ctx.rotate(uprightAngle + Math.sin(phase * 0.55) * 0.025);
  ctx.scale(facing, 1);
  for (let i = 0; i < strips; i++) {
    const wave = Math.round(Math.sin(phase + i * 0.72) * 2);
    const sx = Math.floor(i * sourceStep);
    const nextSx = i === strips - 1 ? W : Math.ceil((i + 1) * sourceStep) + 1;
    const sw = nextSx - sx;
    const dx = -DRAW_W / 2 + i * drawStep;
    const dw = drawStep + 1;
    ctx.drawImage(serpent, sx, 0, sw, H, dx, -DRAW_H / 2 + wave, dw, DRAW_H);
  }
  ctx.restore();
  return true;
}