// Angel of Light — visual source of the Death of the Firstborn. The supplied
// PNG is split only at the outer wing tips so they can flap gently; the body,
// halo and sword stay intact. The angel never moves: hovering is visual only.
import bodyAsset from "@/assets/angel-body.png.asset.json";
import wingLAsset from "@/assets/angel-wing-l.png.asset.json";
import wingRAsset from "@/assets/angel-wing-r.png.asset.json";

export const ANGEL_ART = {
  W: 133,
  H: 200,
  /** screen pixels per sprite pixel */
  PX: 0.55,
  /** feet float this many screen px above the anchor */
  FLOAT: 22,
  SWORD: { x: 118.75, y: 5.9 },
  PIV_L: { x: 41.7, y: 58.6 },
  PIV_R: { x: 119.8, y: 67.7 },
} as const;

/** seconds of the radiant appearance burst */
export const ANGEL_APPEAR = 0.55;
/** seconds of the fade-out at the end */
export const ANGEL_FADE = 0.6;

let body: HTMLImageElement | null = null;
let wingL: HTMLImageElement | null = null;
let wingR: HTMLImageElement | null = null;
const load = (u: string) => { const i = new Image(); i.src = u; return i; };
const ok = (i: HTMLImageElement | null) => !!i && i.complete && i.naturalWidth > 0;

export function ensureAngelArt(): boolean {
  if (typeof document === "undefined") return false;
  if (!body) body = load(bodyAsset.url);
  if (!wingL) wingL = load(wingLAsset.url);
  if (!wingR) wingR = load(wingRAsset.url);
  return ok(body) && ok(wingL) && ok(wingR);
}

/** World offset of the sword tip from the angel's anchor (bob-neutral). */
export function angelSwordOffset(): { x: number; y: number } {
  const { W, H, PX, FLOAT, SWORD } = ANGEL_ART;
  return { x: (SWORD.x - W / 2) * PX, y: -FLOAT - (H - SWORD.y) * PX };
}

/** age = seconds since appearing; remaining = seconds left. */
export function drawAngel(ctx: CanvasRenderingContext2D, x: number, y: number, age: number, remaining: number): void {
  const { W, H, PX, FLOAT, PIV_L, PIV_R } = ANGEL_ART;
  const appear = Math.min(1, age / ANGEL_APPEAR);
  const alpha = Math.min(appear * 1.4, remaining / ANGEL_FADE, 1);
  if (alpha <= 0) return;
  const bob = Math.sin(age * 2.6) * 3;
  const cy = y - FLOAT - (H * PX) / 2 + bob;

  ctx.save();
  // Radiant manifestation: a bright burst that fades, then a soft steady halo.
  const burst = age < ANGEL_APPEAR * 1.6 ? 1 - age / (ANGEL_APPEAR * 1.6) : 0;
  const glowR = 70 + burst * 90;
  const g = ctx.createRadialGradient(x, cy, 4, x, cy, glowR);
  g.addColorStop(0, `rgba(255,255,255,${(0.35 + burst * 0.6) * alpha})`);
  g.addColorStop(0.45, `rgba(214,232,255,${(0.18 + burst * 0.3) * alpha})`);
  g.addColorStop(1, "rgba(214,232,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(x - glowR, cy - glowR, glowR * 2, glowR * 2);

  if (ensureAngelArt() && body && wingL && wingR) {
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.translate(Math.round(x - (W * PX) / 2), Math.round(y - FLOAT - H * PX + bob));
    ctx.scale(PX, PX);
    const flap = Math.sin(age * 5.2) * 0.07;
    const wing = (img: HTMLImageElement, p: { x: number; y: number }, a: number) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(a);
      ctx.translate(-p.x, -p.y);
      ctx.drawImage(img, 0, 0, W, H);
      ctx.restore();
    };
    wing(wingL, PIV_L, -flap);
    wing(wingR, PIV_R, flap);
    // Subtle breathing of the whole figure around its waist.
    const br = 1 + Math.sin(age * 2.6 + 0.6) * 0.012;
    ctx.translate(W / 2, H * 0.45);
    ctx.scale(1, br);
    ctx.translate(-W / 2, -H * 0.45);
    ctx.drawImage(body, 0, 0, W, H);
    if (burst > 0) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = alpha * burst * 0.7;
      ctx.drawImage(body, 0, 0, W, H);
    }
  }
  ctx.restore();
}
