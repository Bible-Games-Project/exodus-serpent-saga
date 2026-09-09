// Egyptian soldier (first NPC enemy) — the supplied pixel-art sprite, split
// once into four layers so he can be animated without redrawing a single pixel:
//
//   body  — head, nemes, torso, kilt and the lower part of his staff
//   legb  — the trailing leg + sandal
//   legf  — the leading leg + sandal
//   arm   — his forearm, fist and the staff he grips (they always move together)
//
// The leg layers carry two columns of overlap with each other and two rows of
// overlap tucked under the kilt, and the body is stamped after them, so a
// stepping leg can never leave a transparent hole or a visible rectangular cut.
import bodyAsset from "@/assets/soldier-body.png.asset.json";
import legBAsset from "@/assets/soldier-legb.png.asset.json";
import legFAsset from "@/assets/soldier-legf.png.asset.json";
import armAsset from "@/assets/soldier-arm.png.asset.json";

export const SOLDIER_ART = {
  /** sprite-pixel size of the shared layer canvas */
  W: 34,
  H: 80,
  /** screen pixels per sprite pixel (keeps him a touch shorter than Moses) */
  PX: 0.9,
  /** x of his body centre inside the sprite */
  CX: 22,
} as const;

type Layers = { body: HTMLImageElement; legB: HTMLImageElement; legF: HTMLImageElement; arm: HTMLImageElement };
let layers: Layers | null = null;

function load(url: string): HTMLImageElement {
  const img = new Image();
  img.src = url;
  return img;
}

export function ensureSoldierArt(): boolean {
  if (typeof document === "undefined") return false;
  if (!layers) {
    layers = {
      body: load(bodyAsset.url),
      legB: load(legBAsset.url),
      legF: load(legFAsset.url),
      arm: load(armAsset.url),
    };
  }
  const l = layers;
  return [l.body, l.legB, l.legF, l.arm].every((i) => i.complete && i.naturalWidth > 0);
}

export type SoldierPose = {
  /** screen position of his feet (ground contact point) */
  x: number;
  groundY: number;
  flip: 1 | -1;
  /** walk cycle driver */
  walkPhase: number;
  moving: boolean;
  /** 0..1 progress of the staff strike; null/undefined = no strike */
  punch?: number | null;
};

/** duration (seconds) of the staff strike animation */
export const SOLDIER_PUNCH_DUR = 0.38;

/** Shoulder of the staff arm, in sprite pixels — pivot of the strike. */
const STAFF_SHOULDER = { x: 18, y: 34 } as const;

/** Rotation (radians) of the staff arm over the strike progress. */
function strikeAngle(progress: number): number {
  const p = Math.max(0, Math.min(1, progress));
  if (p < 0.3) return 0.45 * (p / 0.3);              // prepare: staff cocks back/up
  if (p < 0.6) return 0.45 - 1.55 * ((p - 0.3) / 0.3); // fast sweep forward
  return -1.1 * (1 - (p - 0.6) / 0.4);                // recover
}

/** Screen position of the staff's striking end for a strike progress (impact FX). */
export function soldierFistPos(x: number, groundY: number, flip: 1 | -1, punch: number) {
  const { PX, CX, H } = SOLDIER_ART;
  const a = strikeAngle(punch);
  const L = 26; // sprite px from shoulder to the striking part of the staff
  const rx = Math.sin(a) * L;
  const ry = -Math.cos(a) * L;
  return {
    x: x + (STAFF_SHOULDER.x - CX + rx) * PX * flip,
    y: groundY - (H - STAFF_SHOULDER.y - ry) * PX,
  };
}



/**
 * Draws the soldier at native pixel density. Walking is produced purely by
 * translating the existing leg and arm layers along his facing direction — the
 * torso stays put, the sprite is never scaled or deformed.
 */
export function drawSoldierArt(ctx: CanvasRenderingContext2D, pose: SoldierPose): void {
  if (!ensureSoldierArt() || !layers) return;
  const { W, H, PX, CX } = SOLDIER_ART;
  const l = layers;

  // Forward/backward stride along the walking direction (never sideways).
  const swing = pose.moving ? Math.sin(pose.walkPhase) : 0;
  const stepF = Math.round(swing * 2);
  const stepB = -stepF;
  // The leg that reaches forward lifts a single pixel off the ground.
  const liftF = pose.moving && stepF > 0 ? -1 : 0;
  const liftB = pose.moving && stepB > 0 ? -1 : 0;
  // Arms counter-swing against the legs; the staff rides with the fist.
  const armStep = -stepF;
  const armLift = pose.moving ? (swing > 0 ? -1 : 0) : 0;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(pose.x), Math.round(pose.groundY));
  if (pose.flip === -1) ctx.scale(-1, 1);
  ctx.translate(-CX * PX, -H * PX);

  const stamp = (img: HTMLImageElement, dx: number, dy: number) => {
    ctx.drawImage(img, dx * PX, dy * PX, W * PX, H * PX);
  };

  // Legs first, then the intact torso on top of their overlap rows.
  stamp(l.legB, stepB, liftB);
  stamp(l.legF, stepF, liftF);
  stamp(l.body, 0, 0);
  // Free arm (the one NOT holding the staff): only drawn while punching, so the
  // sprite is untouched at rest. It reads as a short jab from the shoulder.
  const punch = pose.punch;
  if (punch != null && punch > 0 && punch < 1) {
    const reach = punchReach(punch);
    const sx = FREE_SHOULDER.x, sy = FREE_SHOULDER.y;
    const len = Math.max(0, Math.round(reach));
    const droop = Math.round((1 - Math.min(1, Math.max(0, reach) / 10)) * 2);
    const ax = sx - len - 3;
    const ay = sy + droop;
    // upper/forearm as a 3px-thick limb, outlined below for pixel-art contrast
    ctx.fillStyle = "#703914";
    ctx.fillRect(ax * PX, (ay + 3) * PX, (sx - ax) * PX, 1 * PX);
    ctx.fillStyle = "#e88e4d";
    ctx.fillRect(ax * PX, ay * PX, (sx - ax) * PX, 3 * PX);
    // fist
    ctx.fillStyle = "#703914";
    ctx.fillRect((ax - 4) * PX, (ay - 1) * PX, 4 * PX, 5 * PX);
    ctx.fillStyle = "#e98f4e";
    ctx.fillRect((ax - 3) * PX, ay * PX, 3 * PX, 3 * PX);
    // gold cuff at the shoulder
    ctx.fillStyle = "#ffd460";
    ctx.fillRect((sx - 2) * PX, ay * PX, 2 * PX, 3 * PX);
  }
  // Forearm + fist + staff as one rigid group: the grip never breaks.
  stamp(l.arm, armStep, armLift);
  ctx.restore();
}

