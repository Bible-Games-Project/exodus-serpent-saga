// Egyptian archer, split once into four layers so he animates without a single
// pixel being redrawn. Two looks (ARCHER_LOOK):
//   "v2"     — redrawn in Moses' style (skin, proportions, saturation), from
//              archer-v2-source.png downsampled to Moses' pixel size. The bow
//              string is drawn in code so it stays tied to the drawing hand.
//   "legacy" — the original supplied pixel-art sprite (archer-*.png).
//
//   body  — nemes, head, torso, kilt, quiver (drawn over the legs' overlap rows)
//   legb  — trailing leg + sandal
//   legf  — leading leg + sandal
//   arm   — bow arm + bow + string (one rigid group, the grip never breaks)
import bodyAsset from "@/assets/archer-body.png";
import legBAsset from "@/assets/archer-legb.png";
import legFAsset from "@/assets/archer-legf.png";
import armAsset from "@/assets/archer-arm.png";
import bodyV2 from "@/assets/archer-v2-body.png";
import legBV2 from "@/assets/archer-v2-legb.png";
import legFV2 from "@/assets/archer-v2-legf.png";
import armV2 from "@/assets/archer-v2-arm.png";

type ArcherLook = {
  /** sprite-pixel size of the shared layer canvas */
  W: number; H: number;
  /** screen pixels per sprite pixel */
  PX: number;
  /** x of his body centre inside the sprite */
  CX: number;
  /** row under the sandals (ground contact) */
  FOOT_Y: number;
  /** top of the head (the bow may rise above it) */
  TOP: number;
  /** bow tips (arm layer) and the drawing hand (body layer) for the string; null = painted in */
  STRING: { top: [number, number]; bottom: [number, number]; hand: [number, number] } | null;
  /** arrow release point, in front of the bow grip */
  MUZZLE: [number, number];
  assets: [string, string, string, string];
};

const LOOKS: Record<"legacy" | "v2", ArcherLook> = {
  legacy: { W: 50, H: 78, PX: 0.9, CX: 16, FOOT_Y: 78, TOP: 11, STRING: null, MUZZLE: [42, 26], assets: [bodyAsset, legBAsset, legFAsset, armAsset] },
  v2: {
    W: 61, H: 99, PX: 0.95, CX: 21.7, FOOT_Y: 98, TOP: 14,
    STRING: { top: [42.6, 3.2], bottom: [45, 64], hand: [25, 31] },
    MUZZLE: [59, 31.5], assets: [bodyV2, legBV2, legFV2, armV2],
  },
};

/** Which archer art the game draws. */
export const ARCHER_LOOK: "legacy" | "v2" = "v2";
const LOOK = LOOKS[ARCHER_LOOK];

export const ARCHER_ART = { W: LOOK.W, H: LOOK.H, PX: LOOK.PX, CX: LOOK.CX, FOOT_Y: LOOK.FOOT_Y, TOP: LOOK.TOP } as const;
export const ARCHER_MUZZLE = { x: LOOK.MUZZLE[0], y: LOOK.MUZZLE[1] } as const;

/** duration (seconds) of the draw + release animation */
export const ARCHER_SHOOT_DUR = 0.55;
/** progress at which the arrow leaves the bow */
export const ARCHER_RELEASE_AT = 0.62;

type Layers = { body: HTMLImageElement; legB: HTMLImageElement; legF: HTMLImageElement; arm: HTMLImageElement };
let layers: Layers | null = null;

function load(url: string): HTMLImageElement {
  const img = new Image();
  img.src = url;
  return img;
}

export function ensureArcherArt(): boolean {
  if (typeof document === "undefined") return false;
  if (!layers) {
    layers = {
      body: load(LOOK.assets[0]),
      legB: load(LOOK.assets[1]),
      legF: load(LOOK.assets[2]),
      arm: load(LOOK.assets[3]),
    };
  }
  const l = layers;
  return [l.body, l.legB, l.legF, l.arm].every((i) => i.complete && i.naturalWidth > 0);
}

/** Bow-arm offset (sprite px) across the shoot animation: draw back, then release. */
function bowOffset(progress: number): number {
  const p = Math.max(0, Math.min(1, progress));
  if (p < ARCHER_RELEASE_AT) return -3 * (p / ARCHER_RELEASE_AT);   // pull the string
  return -3 + 4 * ((p - ARCHER_RELEASE_AT) / (1 - ARCHER_RELEASE_AT)); // snap forward
}

export type ArcherPose = {
  x: number;
  groundY: number;
  flip: 1 | -1;
  walkPhase: number;
  moving: boolean;
  /** 0..1 progress of the shot; null = idle */
  shoot?: number | null;
};

export function drawArcherArt(ctx: CanvasRenderingContext2D, pose: ArcherPose): void {
  if (!ensureArcherArt() || !layers) return;
  const { W, H, PX, CX, FOOT_Y } = ARCHER_ART;
  const l = layers;

  const shoot = pose.shoot;
  const shooting = shoot != null && shoot > 0 && shoot < 1;
  // Forward/backward stride along the facing direction (never sideways).
  const swing = pose.moving && !shooting ? Math.sin(pose.walkPhase) : 0;
  const stepF = Math.round(swing * 2);
  const stepB = -stepF;
  const liftF = swing !== 0 && stepF > 0 ? -1 : 0;
  const liftB = swing !== 0 && stepB > 0 ? -1 : 0;
  // Bow arm counter-swings gently while walking; during a shot it draws back.
  const armStep = shooting ? bowOffset(shoot) : -stepF;
  const armLift = shooting ? 0 : swing > 0 ? -1 : 0;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(pose.x), Math.round(pose.groundY));
  if (pose.flip === -1) ctx.scale(-1, 1);
  ctx.translate(-CX * PX, -FOOT_Y * PX);

  const stamp = (img: HTMLImageElement, dx: number, dy: number) => {
    ctx.drawImage(img, dx * PX, dy * PX, W * PX, H * PX);
  };

  stamp(l.legB, stepB, liftB);
  stamp(l.legF, stepF, liftF);
  stamp(l.body, 0, 0);
  stamp(l.arm, armStep, armLift);
  const st = LOOK.STRING;
  if (st) {
    // The string runs from both bow tips (moving with the bow arm) to the drawing hand.
    const [hx, hy] = st.hand;
    ctx.strokeStyle = "rgba(232, 196, 140, 0.9)";
    ctx.lineWidth = Math.max(1, PX * 0.8);
    ctx.beginPath();
    ctx.moveTo((st.top[0] + armStep) * PX, (st.top[1] + armLift) * PX);
    ctx.lineTo(hx * PX, hy * PX);
    ctx.lineTo((st.bottom[0] + armStep) * PX, (st.bottom[1] + armLift) * PX);
    ctx.stroke();
  }
  ctx.restore();
}
