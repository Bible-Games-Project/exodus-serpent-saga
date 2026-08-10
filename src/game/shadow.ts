// Handcrafted pixel-art ground shadows.
//
// No ellipses, no blur: the shadow is stamped as rows of square pixels on the
// same grid density as the characters (3 screen px per art pixel by default).
// The silhouette is irregular but deterministic per entity, with a darker core
// and a lighter, ragged rim so it reads as soft without any smoothing.

// Vertical profile of the blob, top row → bottom row (fraction of full width).
const PROFILE = [0.46, 0.78, 1.0, 0.92, 0.6];
// Rim rows use the lighter tone; the middle band is the dark core.
const CORE_ROWS = [1, 2, 3];

// Small deterministic hash → -1 | 0 | 1 cell jitter.
function jitter(seed: number, row: number, side: number): number {
  const n = Math.sin((seed * 12.9898 + row * 78.233 + side * 37.719) * 43758.5453);
  const f = n - Math.floor(n);
  return f < 0.34 ? -1 : f > 0.72 ? 1 : 0;
}

export type PixelShadowOpts = {
  /** Art-pixel size in screen px. Match the character's density. */
  px?: number;
  /** Base opacity of the dark core (rim is ~60% of this). */
  alpha?: number;
  /** Stable per-entity seed so the blob shape doesn't flicker. */
  seed?: number;
  /** 0..1 — how much of the walk cycle sway to apply (0 = perfectly still). */
  sway?: number;
  /** Walk-cycle phase (entity.animT); drives the subtle sway. */
  phase?: number;
  /** 0..1 scale — smaller/tighter when the character is up in the air. */
  lift?: number;
};

/**
 * Draw a pixel-art shadow centred on (cx) and resting on the ground line (gy).
 * `width` is the intended full width in screen px.
 */
export function drawPixelShadow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  gy: number,
  width: number,
  opts: PixelShadowOpts = {},
): void {
  const px = Math.max(2, Math.round(opts.px ?? 3));
  const alpha = opts.alpha ?? 0.24;
  const seed = opts.seed ?? 1;
  const phase = opts.phase ?? 0;
  const sway = opts.sway ?? 0;
  const lift = Math.max(0.28, Math.min(1, opts.lift ?? 1));

  // Walking makes the blob breathe by a single art pixel and drift a touch —
  // enough to feel alive, never enough to look detached.
  const breathe = sway ? Math.sin(phase) * 0.06 * sway : 0;
  const drift = sway ? Math.round(Math.sin(phase * 0.5) * sway) * px : 0;

  const fullCells = Math.max(2, Math.round((width * lift * (1 + breathe)) / px));
  const baseX = Math.round(cx / px) * px + drift;
  const baseY = Math.round(gy / px) * px - Math.round(PROFILE.length / 2) * px;

  for (let r = 0; r < PROFILE.length; r++) {
    const isCore = CORE_ROWS.includes(r);
    const cells = Math.max(1, Math.round((fullCells * PROFILE[r]) / 2));
    const left = -cells + jitter(seed, r, 0);
    const right = cells + jitter(seed, r, 1);
    const y = baseY + r * px;
    ctx.fillStyle = `rgba(60,38,18,${(isCore ? alpha : alpha * 0.55).toFixed(3)})`;
    ctx.fillRect(baseX + left * px, y, (right - left) * px, px);
    // Ragged single-pixel nibbles on the rim so the edge never reads as a curve.
    if (isCore) {
      ctx.fillStyle = `rgba(60,38,18,${(alpha * 0.5).toFixed(3)})`;
      ctx.fillRect(baseX + (left - 1) * px, y, px, px);
      ctx.fillRect(baseX + right * px, y, px, px);
    }
  }
}
