// Ramses jump-attack target / impact visual. The supplied target PNG is the
// main visual; supporting pixel embers and shards use the same palette so the
// whole effect reads as one coherent attack. Visual only — no gameplay here.
import targetAsset from "@/assets/ramses-target.png.asset.json";

/** Palette sampled from the supplied target artwork. */
const PALETTE = ["#b90f12", "#e02c12", "#ff5a0a", "#ff9a0a", "#f8c014", "#f9e08a"] as const;

let img: HTMLImageElement | null = null;
function ready(): boolean {
  if (typeof document === "undefined") return false;
  if (!img) { img = new Image(); img.src = targetAsset.url; }
  return img.complete && img.naturalWidth > 0;
}

/** Deterministic 0..1 hash so particles are stable per frame without state. */
function h(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function drawImg(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, alpha: number) {
  if (!ready() || !img) return;
  const w = size;
  const hgt = size * (img.naturalHeight / img.naturalWidth);
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, Math.round(cx - w / 2), Math.round(cy - hgt / 2), Math.round(w), Math.round(hgt));
}

/**
 * Telegraph shown while Ramses winds up and flies toward the landing point.
 * `lock` goes 0 → 1 across the airborne phase so the target tightens in.
 */
export function drawRamsesTarget(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, time: number, lock: number,
): void {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const pulse = 0.5 + 0.5 * Math.sin(time * 10);
  const size = R * 2.3 * (1.12 - 0.12 * lock) * (0.97 + pulse * 0.05);
  drawImg(ctx, cx, cy, size, 0.78 + pulse * 0.22);
  // Rising pixel embers around the outer diamond.
  const P = 3;
  for (let i = 0; i < 14; i++) {
    const cycle = (time * 0.9 + h(i)) % 1;
    const a = h(i + 40) * Math.PI * 2;
    const rr = R * (0.8 + h(i + 80) * 0.45);
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr - cycle * 26;
    ctx.globalAlpha = (1 - cycle) * 0.9;
    ctx.fillStyle = PALETTE[2 + (i % 4)];
    const s = i % 3 === 0 ? P * 2 : P;
    ctx.fillRect(Math.round(x / P) * P, Math.round(y / P) * P, s, s);
  }
  ctx.restore();
}

/**
 * Landing impact: the supplied target flares outward and fades while pixel
 * shards and ember chunks burst out in the same palette. `t` is 0 → 1.
 */
export function drawRamsesImpact(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, t: number, seed: number,
): void {
  const k = Math.max(0, Math.min(1, t));
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  drawImg(ctx, cx, cy, R * 2.3 * (1 + k * 0.4), (1 - k) * (1 - k * 0.3));
  const P = 4;
  // Radial shards along the target's cross spikes and diagonals.
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2 + h(seed + i) * 0.25;
    const sp = 0.55 + h(seed + i + 50) * 0.75;
    const rr = R * (0.35 + k * 1.15 * sp);
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr * 0.62;
    ctx.globalAlpha = 1 - k;
    ctx.fillStyle = PALETTE[i % PALETTE.length];
    const s = i % 4 === 0 ? P * 2 : P;
    ctx.fillRect(Math.round(x / P) * P - s / 2, Math.round(y / P) * P - s / 2, s, s);
  }
  // Ember chunks thrown upward then falling back.
  for (let i = 0; i < 12; i++) {
    const a = h(seed + i + 200) * Math.PI * 2;
    const rr = R * (0.2 + h(seed + i + 260) * 0.6) * (0.4 + k);
    const lift = Math.sin(k * Math.PI) * (18 + h(seed + i + 300) * 30);
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr * 0.55 - lift;
    ctx.globalAlpha = (1 - k) * 0.95;
    ctx.fillStyle = PALETTE[3 + (i % 3)];
    ctx.fillRect(Math.round(x / 3) * 3, Math.round(y / 3) * 3, 3, 3);
  }
  ctx.restore();
}
