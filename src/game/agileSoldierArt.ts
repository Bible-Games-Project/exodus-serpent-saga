// Agile Egyptian soldier — the supplied pixel-art sprite, split once into three
// layers so he can crouch, hop, lunge and retreat without a pixel being redrawn:
//
//   body  — hood, torso, both arms and the dagger (drawn over the leg rows)
//   legB  — trailing leg + sandal
//   legF  — leading leg + sandal
import bodyAsset from "@/assets/agile-body.png.asset.json";
import legBAsset from "@/assets/agile-legb.png.asset.json";
import legFAsset from "@/assets/agile-legf.png.asset.json";

export const AGILE_ART = {
  /** sprite-pixel size of the shared layer canvas */
  W: 52,
  H: 74,
  /** Exactly half the previous visual size (0.9 → 0.45). */
  PX: 0.45,
  /** x of his body centre inside the sprite */
  CX: 24,
} as const;

/** duration (seconds) of the quick dagger stab */
export const AGILE_STAB_DUR = 0.34;

type Layers = { body: HTMLImageElement; legB: HTMLImageElement; legF: HTMLImageElement };
let layers: Layers | null = null;

function load(url: string): HTMLImageElement {
  const img = new Image();
  img.src = url;
  return img;
}

export function ensureAgileArt(): boolean {
  if (typeof document === "undefined") return false;
  if (!layers) {
    layers = {
      body: load(bodyAsset.url),
      legB: load(legBAsset.url),
      legF: load(legFAsset.url),
    };
  }
  const l = layers;
  return [l.body, l.legB, l.legF].every((i) => i.complete && i.naturalWidth > 0);
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
  /** true while sprinting in or falling back */
  dashing?: boolean;
  /** free-running phase for the idle bounce */
  phase: number;
};

/** Height (sprite px) above the ground through a hop, plus the leg tuck. */
function hopCurve(p: number): { lift: number; tuck: number } {
  const t = Math.max(0, Math.min(1, p));
  if (t < 0.18) {
    const k = t / 0.18;                       // crouch before pushing off
    return { lift: -2 * k, tuck: 0 };
  }
  const k = (t - 0.18) / 0.82;
  const arc = Math.sin(k * Math.PI);
  return { lift: arc * 11 - 2 * (1 - k), tuck: Math.round(arc * 4) };
}

export function drawAgileSoldierArt(ctx: CanvasRenderingContext2D, pose: AgilePose): void {
  if (!ensureAgileArt() || !layers) return;
  const { W, H, PX, CX } = AGILE_ART;
  const l = layers;

  const hopping = pose.hop != null && pose.hop > 0 && pose.hop < 1;
  const { lift, tuck } = hopping ? hopCurve(pose.hop as number) : { lift: 0, tuck: 0 };

  const stab = pose.stab != null && pose.stab > 0 && pose.stab < 1 ? (pose.stab as number) : null;
  // Quick stab: coil back, punch the dagger forward, snap out.
  const stabPush = stab == null ? 0 : stab < 0.3 ? -3 * (stab / 0.3)
    : stab < 0.55 ? -3 + 10 * ((stab - 0.3) / 0.25)
      : 7 * (1 - (stab - 0.55) / 0.45);

  // Grounded: light springy bounce; dashing: forward lean and pumping legs.
  const bounce = hopping ? 0 : Math.sin(pose.phase * 3) > 0.5 ? -1 : 0;
  const run = pose.dashing && !hopping ? Math.sin(pose.phase * 9) : 0;
  const stepF = Math.round(run * 3);
  const stepB = -stepF;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  // Preserve the supplied design while shifting its palette toward black.
  ctx.filter = "brightness(0.48) saturate(0.7) contrast(1.15)";
  ctx.translate(Math.round(pose.x), Math.round(pose.groundY));
  if (pose.flip === -1) ctx.scale(-1, 1);
  ctx.translate(-CX * PX, -H * PX);

  const stamp = (img: HTMLImageElement, dx: number, dy: number) => {
    ctx.drawImage(img, dx * PX, (dy - lift) * PX, W * PX, H * PX);
  };

  stamp(l.legB, stepB * 0.6, tuck);
  stamp(l.legF, stepF * 0.6, tuck);
  stamp(l.body, stabPush * 0.5 + (pose.dashing ? 1 : 0), bounce);
  ctx.restore();
}
