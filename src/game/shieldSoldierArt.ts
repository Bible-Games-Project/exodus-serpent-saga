// Egyptian shield soldier — the supplied pixel-art sprite, split once into three
// layers so he walks without a single pixel being redrawn:
//
//   body  — headdress, head, torso, shield arm + shield (one rigid group)
//   legb  — trailing leg + sandal
//   legf  — leading leg + sandal
import bodyAsset from "@/assets/shield-green-body.png.asset.json";
import legBAsset from "@/assets/shield-green-legb.png.asset.json";
import legFAsset from "@/assets/shield-green-legf.png.asset.json";

export const SHIELD_ART = {
  W: 1024,
  H: 1536,
  /** Preserve the PNG's aspect ratio at exactly 1.25x the former 71px-tall artwork. */
  PX: (71 * 0.9018 * 1.25) / 1536,
  /** Animation offsets retain the previous motion and scale with the artwork. */
  MOTION_PX: 0.9018 * 1.25,
  /** x of the soldier's body centre inside the sprite */
  CX: (22 / 50) * 1024,
  /** shield face centre, in sprite pixels — where a staff blow lands */
  SHIELD: { x: (38 / 50) * 1024, y: (34 / 71) * 1536 },
} as const;

type Layers = { body: HTMLImageElement; legB: HTMLImageElement; legF: HTMLImageElement };
let layers: Layers | null = null;

function load(url: string): HTMLImageElement {
  const img = new Image();
  img.src = url;
  return img;
}

export function ensureShieldArt(): boolean {
  if (typeof document === "undefined") return false;
  if (!layers) {
    layers = { body: load(bodyAsset.url), legB: load(legBAsset.url), legF: load(legFAsset.url) };
  }
  const l = layers;
  return [l.body, l.legB, l.legF].every((i) => i.complete && i.naturalWidth > 0);
}

export type ShieldPose = {
  x: number;
  groundY: number;
  flip: 1 | -1;
  walkPhase: number;
  moving: boolean;
  /** 0..1 while a blocked staff blow shoves the shield back */
  block?: number | null;
};

/** Screen offset (sprite px) of the shield face for a pose — used for the FX. */
export function shieldFacePoint(x: number, groundY: number, flip: 1 | -1) {
  const { PX, CX, H, SHIELD } = SHIELD_ART;
  return {
    x: x + (SHIELD.x - CX) * PX * flip,
    y: groundY - (H - SHIELD.y) * PX,
  };
}

export function drawShieldSoldierArt(ctx: CanvasRenderingContext2D, pose: ShieldPose): void {
  if (!ensureShieldArt() || !layers) return;
  const { W, H, PX, CX, MOTION_PX } = SHIELD_ART;
  const l = layers;

  const gait = pose.moving ? Math.sin(pose.walkPhase) : 0;
  const stepF = Math.round(gait * 2);
  const stepB = -Math.round(gait * 1);
  const liftF = stepF > 0 ? -1 : 0;
  const liftB = stepB > 0 ? -1 : 0;
  // the whole braced body recoils a pixel or two when a blow is blocked
  const bk = pose.block != null && pose.block > 0 && pose.block < 1 ? Math.sin(Math.PI * pose.block) : 0;
  const recoil = -Math.round(bk * 2);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(pose.x), Math.round(pose.groundY));
  if (pose.flip === -1) ctx.scale(-1, 1);
  ctx.translate(-CX * PX, -H * PX);
  const stamp = (img: HTMLImageElement, dx: number, dy: number) => {
    ctx.drawImage(img, dx * MOTION_PX, dy * MOTION_PX, W * PX, H * PX);
  };
  stamp(l.legB, stepB, liftB);
  stamp(l.legF, stepF + recoil, liftF);
  stamp(l.body, recoil, pose.moving && Math.sin(pose.walkPhase * 2) > 0.4 ? -1 : 0);
  ctx.restore();
}
