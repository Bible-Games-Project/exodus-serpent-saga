// Trident soldier — the supplied PNG (`enemy-trident-soldier-supplied.png`)
// split once into four layers:
//
//   body    — head, torso, cape, kilt and the forearm with its bracer
//   legb    — trailing leg + sandal
//   legf    — leading leg + sandal
//   trident — the whole trident with the gripping fist (rotates around the fist)
//
// Attack: he levels the trident and jabs it forward from out of sword reach.
// Ranks (data.tier 1-3) jab once, twice or three times.
import bodyAsset from "@/assets/trident-soldier-body.png";
import legBAsset from "@/assets/trident-soldier-legb.png";
import legFAsset from "@/assets/trident-soldier-legf.png";
import tridentAsset from "@/assets/trident-soldier-trident.png";

export const TRIDENT_ART = {
  W: 1024,
  H: 1535,
  /** 20% smaller than the sword soldier (0.065). */
  PX: 0.052,
  /** x of his body centre inside the sprite */
  CX: 480,
  /** Transparent rows below the sandals. */
  FOOT_Y: 1490,
} as const;

/** Seconds per jab; ranks 2/3 chain 2/3 jabs. */
export const TRIDENT_JAB_DUR = 0.55;

/** Fist (rotation pivot of the trident) and hips, in sprite pixels. */
const FIST = { x: 836, y: 640 } as const;
const HIP_B = { x: 420, y: 1200 } as const;
const HIP_F = { x: 540, y: 1200 } as const;
/** Rotation that turns the upright trident into a forward, level thrust. */
const LEVEL = 1.42;

type Layers = { body: HTMLImageElement; legB: HTMLImageElement; legF: HTMLImageElement; trident: HTMLImageElement };
let layers: Layers | null = null;

function load(url: string): HTMLImageElement {
  const img = new Image();
  img.src = url;
  return img;
}

export function ensureTridentArt(): boolean {
  if (typeof document === "undefined") return false;
  if (!layers) layers = { body: load(bodyAsset), legB: load(legBAsset), legF: load(legFAsset), trident: load(tridentAsset) };
  const l = layers;
  return [l.body, l.legB, l.legF, l.trident].every((i) => i.complete && i.naturalWidth > 0);
}

export function tridentJabCount(tier: number): number {
  return Math.max(1, Math.min(3, Math.round(tier) || 1));
}

/** Damage windows (fractions of the whole attack), one per jab. */
export function tridentHitWindows(tier: number): [number, number][] {
  const n = tridentJabCount(tier);
  // The first jab includes the time to level the trident; follow-ups are quick.
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) out.push([(i + 0.45) / n, (i + 0.62) / n]);
  return out;
}

/** Angle (0 = upright, LEVEL = level) and forward push for the attack. */
function tridentPose(progress: number, tier: number): { a: number; push: number } {
  const n = tridentJabCount(tier);
  const t = Math.max(0, Math.min(0.9999, progress)) * n;
  const i = Math.floor(t), p = t - i;
  // Lower the trident during the first jab's wind-up, raise it after the last.
  let a = LEVEL;
  if (i === 0 && p < 0.3) a = LEVEL * (p / 0.3);
  if (i === n - 1 && p > 0.75) a = LEVEL * (1 - (p - 0.75) / 0.25);
  let push = 0;
  if (p < 0.3) push = -70 * (p / 0.3);                     // draw back
  else if (p < 0.5) push = -70 + 300 * ((p - 0.3) / 0.2);   // jab
  else if (p < 0.75) push = 230 * (1 - (p - 0.5) / 0.25);   // pull back
  return { a, push };
}

export type TridentPose = {
  x: number;
  groundY: number;
  flip: 1 | -1;
  walkPhase: number;
  moving: boolean;
  /** 0..1 progress of the attack; null = idle */
  thrust?: number | null;
  tier: number;
};

export function drawTridentSoldierArt(ctx: CanvasRenderingContext2D, pose: TridentPose): void {
  if (!ensureTridentArt() || !layers) return;
  const { W, H, PX: BASE_PX, CX, FOOT_Y } = TRIDENT_ART;
  const PX = BASE_PX * (pose.tier >= 3 ? 1.12 : 1);
  const l = layers;
  const th = pose.thrust;
  const attacking = th != null && th > 0 && th < 1;
  const stride = pose.moving && !attacking ? Math.sin(pose.walkPhase) : 0;
  const bob = pose.moving && !attacking ? -Math.abs(Math.cos(pose.walkPhase)) * 10 : 0;
  const { a, push } = attacking ? tridentPose(th, pose.tier) : { a: 0, push: 0 };

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(pose.x), Math.round(pose.groundY));
  if (pose.flip === -1) ctx.scale(-1, 1);
  ctx.translate(-CX * PX, -FOOT_Y * PX);

  const stamp = (img: HTMLImageElement, dx = 0, dy = 0) => ctx.drawImage(img, dx * PX, dy * PX, W * PX, H * PX);
  const leg = (img: HTMLImageElement, hip: { x: number; y: number }, ang: number, lift: number) => {
    ctx.save();
    ctx.translate(hip.x * PX, hip.y * PX);
    ctx.rotate(ang);
    ctx.translate(-hip.x * PX, -hip.y * PX);
    stamp(img, 0, -lift);
    ctx.restore();
  };
  const trident = () => {
    ctx.save();
    // A body lean follows the jab so the push reads as his whole weight.
    ctx.translate((FIST.x + push) * PX, (FIST.y + bob) * PX);
    ctx.rotate(a);
    ctx.translate(-FIST.x * PX, -(FIST.y + bob) * PX);
    stamp(l.trident, 0, bob);
    ctx.restore();
  };
  leg(l.legB, HIP_B, -stride * 0.15, Math.max(0, -stride) * 10);
  leg(l.legF, HIP_F, stride * 0.15, Math.max(0, stride) * 10);
  // Levelled, the shaft runs behind his body; upright it is held in front.
  if (attacking && a > 0.4) trident();
  const lean = attacking ? Math.max(0, push) / 230 : 0;
  stamp(l.body, lean * 30, bob);
  if (!(attacking && a > 0.4)) trident();
  ctx.restore();
}

export function tridentArtHeight(tier = 1): number {
  return TRIDENT_ART.FOOT_Y * TRIDENT_ART.PX * (tier >= 3 ? 1.12 : 1);
}
