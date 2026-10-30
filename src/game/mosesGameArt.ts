// Gameplay Moses — layered sprite: one uncut body PNG + two sandal layers,
// plus the separate shepherd's-crook staff sprite held in his right hand.
//
// The walk cycle only alternates the sandals and re-stamps the arm slices with
// a tiny offset; the robe pixels are never cut or deformed. Standing still adds
// a very subtle breathing motion (a single pixel, slowly).
import bodyAsset from "@/assets/moses4-body.png.asset.json";
import footLAsset from "@/assets/moses4-foot-l.png.asset.json";
import footRAsset from "@/assets/moses4-foot-r.png.asset.json";
import staffAsset from "@/assets/moses-staff3.png.asset.json";
import v2BodyAsset from "@/assets/moses-v2-body.png.asset.json";
import v2FootLAsset from "@/assets/moses-v2-foot-l.png.asset.json";
import v2FootRAsset from "@/assets/moses-v2-foot-r.png.asset.json";
import v2HandAsset from "@/assets/moses-v2-hand.png.asset.json";
import v2StaffAsset from "@/assets/moses-v2-staff.png.asset.json";
import type { Loadout } from "./loadout";
import { equipmentGesture, HELMET_EXPERIMENT, SHOES_EXPERIMENT } from "./equipmentArt";
import { drawCombatEquipment, drawCombatHeadwear } from "./combatEquipmentArt";

/**
 * Single switch for Moses' look. "original" = previous sprite/staff/animations
 * (kept intact), "new" = the supplied new sprite + staff. Visual only: gameplay
 * (hit detection, timing, speed, hitbox) reads MOSES_ART / MOSES_ATTACK, which
 * do not depend on this value.
 */
export type MosesVisualVersion = "original" | "new";
export let MOSES_VISUAL_VERSION: MosesVisualVersion = "new";
export function setMosesVisualVersion(v: MosesVisualVersion) { MOSES_VISUAL_VERSION = v; }

/** New-version layer geometry (sprite px of the 42x84 layer canvas). */
const V2 = { W: 42, H: 84, PX: 0.95, CX: 17, HAND: { x: 39, y: 37 }, STAFF: { W: 10, H: 80, GRIP: { x: 4.5, y: 44 }, TOP: { x: 6, y: 0 } } } as const;

export const MOSES_ART = {
  /** sprite-pixel size of the shared layer canvas */
  W: 33,
  IMG_H: 66,
  /** ground contact row (bottom of the sandals) */
  H: 66,
  /** screen pixels per sprite pixel */
  PX: 1.2,
  /** x of Moses' body centre inside the sprite */
  CX: 16,
  /** first row of the feet layers */
  LEG_TOP: 55,
  /** the right hand's grip on the staff — pivot for the melee swing */
  HAND: { x: 29, y: 43 },
  /** crook (business end of the staff) relative to HAND, in sprite pixels */
  TIP: { x: 4, y: -37 },
} as const;

/** the staff sprite keeps its own canvas / scale so its art is unchanged */
const STAFF = { W: 12, H: 67, PX: 1.12, GRIP: { x: 9, y: 42 } } as const;

/**
 * Attack animation cadence — unchanged timing contract used by the engine:
 * wind-up, impact window and total duration all stay exactly as before.
 */
export const MOSES_ATTACK = {
  FRAME: 0.1,
  IMPACT_FRAME: 2,
  WINDUP: 0.2,
  DUR: 0.5,
} as const;

type V2Layers = { body: HTMLImageElement; footL: HTMLImageElement; footR: HTMLImageElement; hand: HTMLImageElement; staff: HTMLImageElement };
let v2: V2Layers | null = null;
function ensureV2(): boolean {
  if (typeof document === "undefined") return false;
  if (!v2) v2 = { body: load(v2BodyAsset.url), footL: load(v2FootLAsset.url), footR: load(v2FootRAsset.url), hand: load(v2HandAsset.url), staff: load(v2StaffAsset.url) };
  return Object.values(v2).every((i) => i.complete && i.naturalWidth > 0);
}

type Layers = {
  body: HTMLImageElement;
  footL: HTMLImageElement;
  footR: HTMLImageElement;
  staff: HTMLImageElement;
};

let layers: Layers | null = null;

function load(url: string): HTMLImageElement {
  const img = new Image();
  img.src = url;
  return img;
}

export function ensureMosesArt(): boolean {
  if (typeof document === "undefined") return false;
  if (!layers) {
    layers = {
      body: load(bodyAsset.url),
      footL: load(footLAsset.url),
      footR: load(footRAsset.url),
      staff: load(staffAsset.url),
    };
  }
  for (const img of Object.values(layers)) {
    if (!img.complete || !img.naturalWidth) return false;
  }
  return true;
}

export type MosesPose = {
  /** screen position of Moses' feet (ground contact point) */
  x: number;
  groundY: number;
  flip: 1 | -1;
  walkPhase: number;
  moving: boolean;
  bob: number;
  /** staff rotation in radians around the hand; 0 keeps the base pose */
  staffAngle: number;
  /** kept for API compatibility with the caller; the swing is driven by staffAngle */
  attackProgress?: number | null;
  flash?: number;
  equipment?: Loadout;
  castProgress?: number | null;
};

/** Staff rotation (radians, around the hand) for a swing progress 0..1. */
export function mosesSwingAngle(progress: number): number {
  const p = Math.max(0, Math.min(1, progress));
  if (p < 0.28) return -0.5 * (p / 0.28);
  const t = (p - 0.28) / 0.72;
  return -0.5 + (1 - (1 - t) * (1 - t)) * 2.5;
}

/** Screen position of Moses' grip (staff pivot). */
export function mosesGrip(x: number, groundY: number, flip: 1 | -1) {
  if (MOSES_VISUAL_VERSION === "new") {
    return { x: x + (V2.HAND.x - V2.CX) * V2.PX * flip, y: groundY - (V2.H - V2.HAND.y) * V2.PX };
  }
  const { PX, CX, H, HAND } = MOSES_ART;
  return {
    x: x + (HAND.x - CX) * PX * flip,
    y: groundY - (H - HAND.y) * PX,
  };
}

/** Screen position of the staff's crook for a given pose — used by the wind slash. */
export function mosesStaffTip(x: number, groundY: number, flip: 1 | -1, angle: number) {
  if (MOSES_VISUAL_VERSION === "new") {
    const g = mosesGrip(x, groundY, flip);
    const tx = (V2.STAFF.TOP.x - V2.STAFF.GRIP.x) * V2.PX, ty = (V2.STAFF.TOP.y - V2.STAFF.GRIP.y) * V2.PX;
    const c = Math.cos(angle), s2 = Math.sin(angle);
    return { x: g.x + (tx * c - ty * s2) * flip, y: g.y + (tx * s2 + ty * c) };
  }
  const { PX, TIP } = MOSES_ART;
  const grip = mosesGrip(x, groundY, flip);
  const c = Math.cos(angle), s = Math.sin(angle);
  const rx = (TIP.x * c - TIP.y * s) * PX;
  const ry = (TIP.x * s + TIP.y * c) * PX;
  return { x: grip.x + rx * flip, y: grip.y + ry };
}

/** Distance (screen px) from the grip to the crook — melee reach. */
export const MOSES_STAFF_LEN = Math.hypot(MOSES_ART.TIP.x, MOSES_ART.TIP.y) * MOSES_ART.PX;

/** Draws gameplay Moses at native pixel density from his whole-piece layers. */
export function drawMosesArt(ctx: CanvasRenderingContext2D, pose: MosesPose): void {
  if (MOSES_VISUAL_VERSION === "new" && ensureV2()) return drawMosesNew(ctx, pose);
  drawMosesOriginal(ctx, pose);
}

/** New look: intact body, sandals step, staff rotates whole around the fist. */
function drawMosesNew(ctx: CanvasRenderingContext2D, pose: MosesPose): void {
  const L = v2;
  if (!L) return;
  const { W, H, PX, CX, HAND, STAFF: S } = V2;
  const TAU = Math.PI * 2;
  const step = (phase: number) => {
    const u = (((phase % TAU) + TAU) / TAU) % 1;
    if (u < 0.45) { const t = u / 0.45; return { dx: Math.round(-2 + 5 * t), dy: -Math.round(Math.sin(Math.PI * t) * 2) }; }
    const t = (u - 0.45) / 0.55; return { dx: Math.round(3 - 5 * t), dy: 0 };
  };
  const z = { dx: 0, dy: 0 };
  const fR = pose.moving ? step(pose.walkPhase) : z;
  const fL = pose.moving ? step(pose.walkPhase + Math.PI) : z;
  const breathT = pose.walkPhase / 4.2;
  // breathing: only the upper body rises one pixel; feet stay planted
  const breath = pose.moving ? 0 : Math.sin(breathT * 1.6) > 0.55 ? -1 : 0;
  const bodyDY = pose.moving ? (Math.sin(pose.walkPhase * 2) > 0.4 ? -1 : 0) : breath;
  const sway = pose.moving ? Math.sin(pose.walkPhase) * 0.05 : Math.sin(breathT * 1.6) * 0.015;
  const rot = pose.staffAngle || sway;
  let hx = 0, hy = 0;
  const frontGesture = pose.equipment?.weapon.id === 'spear'
    ? { angle: Math.PI / 2, thrust: pose.attackProgress == null ? 0 : Math.sin(Math.PI * pose.attackProgress) * 12 }
    : pose.equipment ? equipmentGesture(pose.equipment.weapon.id, pose.attackProgress ?? 0, pose.equipment.weapon.evolution) : null;
  if (pose.staffAngle && pose.equipment?.weapon.id !== 'spear') {
    hy = Math.max(-4, Math.min(2, Math.round(pose.staffAngle * 2.4)));
    hx = Math.max(-1, Math.min(2, Math.round(pose.staffAngle * 1.2)));
  } else if (pose.moving) hx = Math.round(Math.sin(pose.walkPhase) * 1.2);
  if (frontGesture) hx += frontGesture.thrust;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(pose.x), Math.round(pose.groundY + pose.bob));
  if (pose.flip === -1) ctx.scale(-1, 1);
  ctx.translate(-CX * PX, -H * PX);
  const stamp = (img: CanvasImageSource, dx: number, dy: number) => ctx.drawImage(img, dx * PX, dy * PX, W * PX, H * PX);
  const paint = () => {
    const footwear = pose.equipment?.footwear.id;
    stamp(SHOES_EXPERIMENT && footwear && footwear !== "barefoot" ? shoeLayer(L.footL, footwear) ?? L.footL : L.footL, fL.dx, fL.dy);
    stamp(SHOES_EXPERIMENT && footwear && footwear !== "barefoot" ? shoeLayer(L.footR, footwear) ?? L.footR : L.footR, fR.dx, fR.dy);
    const arm = freeArmLayers(L.body);
    if (arm && pose.equipment) {
      ctx.drawImage(arm.body, 0, bodyDY * PX, W * PX, H * PX);
      const rear = equipmentGesture(pose.equipment.staff.id, pose.castProgress ?? 0, pose.equipment.staff.evolution, true);
      ctx.save();
      ctx.translate(ARM.PIVOT.x * PX, (ARM.PIVOT.y + bodyDY) * PX);
      ctx.rotate((pose.moving ? -Math.sin(pose.walkPhase) * .06 : 0) + rear.angle);
      ctx.drawImage(arm.arm, -ARM.PIVOT.x * PX, -ARM.PIVOT.y * PX, W * PX, H * PX);
      // Centre the original rear fist (source x=2..8, y=41..48) on
      // the grip; the arm, staff and overlay share this exact transform.
      ctx.translate(-2 * PX, (16.5 + rear.thrust) * PX);
      if (pose.equipment.staff.id !== "none") drawCombatEquipment(ctx, "staff", pose.equipment.staff.id, pose.equipment.staff.evolution, PX);
      // Original hand pixels cover the shaft at its grip.
      ctx.drawImage(L.body, 2, 41, 6, 7, -3 * PX, -3.5 * PX, 6 * PX, 7 * PX);
      ctx.restore();
    } else if (arm && pose.moving && !pose.staffAngle) {
      // Free (non-staff) arm swings gently around the shoulder, opposite to the legs.
      ctx.drawImage(arm.body, 0, bodyDY * PX, W * PX, H * PX);
      ctx.save();
      ctx.translate(ARM.PIVOT.x * PX, (ARM.PIVOT.y + bodyDY) * PX);
      ctx.rotate(-Math.sin(pose.walkPhase) * 0.08);
      ctx.drawImage(arm.arm, -ARM.PIVOT.x * PX, -ARM.PIVOT.y * PX, W * PX, H * PX);
      ctx.restore();
    } else stamp(L.body, 0, bodyDY);
    ctx.save();
    ctx.translate((HAND.x + hx) * PX, (HAND.y + bodyDY + hy) * PX);
    const front = frontGesture;
    if (front) {
      const id = pose.equipment?.weapon.id ?? "branch";
      ctx.rotate(id === 'spear' ? Math.PI / 2 : pose.attackProgress == null ? sway : front.angle);
      const evolution = pose.equipment?.weapon.evolution ?? 1;
      if (id === "branch") {
        // Restore the exact original stick, its 10x80 canvas and hand pivot.
        ctx.drawImage(L.staff, -S.GRIP.x * PX, -S.GRIP.y * PX, S.W * PX, S.H * PX);
        if (evolution > 1) {
          ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(evolution === 3 ? "--equip-light" : "--equip-red").trim();
          ctx.fillRect(-1 * PX, -20 * PX, 2 * PX, 2 * PX);
        }
      } else if (id !== "none") drawCombatEquipment(ctx, "weapon", id, evolution, PX);
    } else {
      if (rot) ctx.rotate(rot);
      ctx.drawImage(L.staff, -S.GRIP.x * PX, -S.GRIP.y * PX, S.W * PX, S.H * PX);
    }
    ctx.restore();
    // fist drawn over the staff so it reads as gripped
    stamp(L.hand, hx, bodyDY + hy);
    if (pose.equipment && HELMET_EXPERIMENT && pose.equipment.shield.id !== "none") {
      drawCombatHeadwear(ctx, pose.equipment.shield.id, pose.equipment.shield.evolution, bodyDY, PX);
    }
  };
  paint();
  if (pose.flash && pose.flash > 0) { ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = pose.flash; paint(); }
  ctx.restore();
}

const shoeLayers = new Map<string, HTMLCanvasElement>();
/** Adapt existing foot alpha and walking anchors; never enlarge the silhouette. */
function shoeLayer(source: HTMLImageElement, id: string): HTMLCanvasElement | null {
  const key = `${source.src}:${id}`;
  const cached = shoeLayers.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas"); canvas.width = V2.W; canvas.height = V2.H;
  const ctx = canvas.getContext("2d"); if (!ctx) return null;
  ctx.imageSmoothingEnabled = false; ctx.drawImage(source, 0, 0, V2.W, V2.H);
  const css = getComputedStyle(document.documentElement);
  const token = ["wind", "jordan", "messenger"].includes(id) ? "water" : id === "bushb" ? "fire" : id === "invisible" ? "iron" : "wood";
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = css.getPropertyValue(`--equip-${token}`).trim();
  ctx.globalAlpha = .7; ctx.fillRect(0, 78, V2.W, 4);
  ctx.globalAlpha = 1; ctx.fillStyle = css.getPropertyValue("--equip-iron").trim(); ctx.fillRect(0, 82, V2.W, 1);
  shoeLayers.set(key, canvas); return canvas;
}

/** Free-arm region of the v2 body (sprite px) and its shoulder pivot. */
const ARM = { X1: 10, Y0: 28, Y1: 50, PIVOT: { x: 7, y: 28 } } as const;
let armCache: { body: HTMLCanvasElement; arm: HTMLCanvasElement } | null = null;
/** Splits the body into body-without-free-arm (filled with robe behind) and the arm alone. */
function freeArmLayers(body: HTMLImageElement): typeof armCache {
  if (armCache) return armCache;
  if (typeof document === "undefined" || !body.complete || !body.naturalWidth) return null;
  const { W, H } = V2;
  const mk = () => { const c = document.createElement("canvas"); c.width = W; c.height = H; return c; };
  const b = mk(), a = mk();
  const bc = b.getContext("2d"), ac = a.getContext("2d");
  if (!bc || !ac) return null;
  bc.drawImage(body, 0, 0, W, H);
  const src = bc.getImageData(0, 0, W, H);
  const bd = bc.createImageData(W, H); bd.data.set(src.data);
  const ad = ac.createImageData(W, H);
  for (let y = ARM.Y0; y < ARM.Y1; y++) {
    const fill = (y * W + ARM.X1) * 4;
    for (let x = 0; x < ARM.X1; x++) {
      const i = (y * W + x) * 4;
      if (src.data[i + 3] < 10) continue;
      for (let k = 0; k < 4; k++) ad.data[i + k] = src.data[i + k];
      // behind the arm: robe colour from the adjacent column, edge kept clear
      if (x < 3) bd.data[i + 3] = 0;
      else for (let k = 0; k < 4; k++) bd.data[i + k] = src.data[fill + k];
    }
  }
  bc.putImageData(bd, 0, 0); ac.putImageData(ad, 0, 0);
  armCache = { body: b, arm: a };
  return armCache;
}

/** Original look — unchanged, restorable via MOSES_VISUAL_VERSION = "original". */
function drawMosesOriginal(ctx: CanvasRenderingContext2D, pose: MosesPose): void {
  if (!ensureMosesArt() || !layers) return;
  const { W, IMG_H, H, PX, CX, HAND } = MOSES_ART;
  const L = layers;

  // ---- walk cycle: a real step cycle, only the sandals travel ----
  // Each foot runs the same cycle, half a period apart: a swing phase where it
  // lifts and travels forward (in Moses' facing direction), then a stance phase
  // where it stays on the ground and slides back under the body.
  const TAU = Math.PI * 2;
  const step = (phase: number) => {
    const u = ((phase % TAU) + TAU) / TAU % 1;
    if (u < 0.45) {
      const t = u / 0.45; // swing: forward + lifted
      return { dx: Math.round(-2 + 5 * t), dy: -Math.round(Math.sin(Math.PI * t) * 2.2) };
    }
    const t = (u - 0.45) / 0.55; // stance: planted, sliding back
    return { dx: Math.round(3 - 5 * t), dy: 0 };
  };
  const zero = { dx: 0, dy: 0 };
  const fR = pose.moving ? step(pose.walkPhase) : zero;
  const fL = pose.moving ? step(pose.walkPhase + Math.PI) : zero;
  const rDX = fR.dx, rLift = fR.dy;
  const lDX = fL.dx, lLift = fL.dy;

  // ---- idle breathing: one pixel, slowly, while standing still ----
  // walkPhase is driven by the live clock for idle poses (the engine pauses the
  // movement clock when input is zero), so breathing continues without moving
  // the planted feet.
  const breathT = pose.walkPhase / 4.2;
  const breath = pose.moving ? 0 : Math.sin(breathT * 1.6) > 0.55 ? -1 : 0;

  // very subtle torso movement while walking: rises as the body passes over the
  // planted foot (twice per stride), never enough to look like a bounce
  const bodyDY = pose.moving ? (Math.sin(pose.walkPhase * 2) > 0.4 ? -1 : 0) : breath;
  // the robe is never nudged sideways or clipped — only the feet alternate
  const bodyDX = 0;
  // arms swing opposite to the legs (right foot forward -> left arm forward).
  // The arm regions are re-stamped from the body layer, never cut out of it.
  const sw = pose.moving ? Math.sin(pose.walkPhase) : 0;
  const armSw = pose.moving ? Math.round(sw * 1.4) : 0; // -1 | 0 | 1
  const lArm = { dx: armSw, dy: -Math.max(0, armSw) };
  const rArm = { dx: -armSw, dy: -Math.max(0, -armSw) };
  // the held staff sways gently with the walk / breathes while idle
  const walkSway = pose.moving
    ? Math.sin(pose.walkPhase) * 0.05
    : Math.sin(breathT * 1.6) * 0.015;
  const staffRot = pose.staffAngle || walkSway;
  // during an attack the staff arm leads the motion: it lifts on the wind-up
  // (negative angle) and drives down through the swing, so hand + staff read as
  // one connected movement.
  if (pose.staffAngle) {
    const a = pose.staffAngle;
    rArm.dy = Math.max(-4, Math.min(2, Math.round(a * 2.4)));
    rArm.dx = Math.max(-1, Math.min(2, Math.round(a * 1.2)));
  }


  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(pose.x), Math.round(pose.groundY + pose.bob));
  if (pose.flip === -1) ctx.scale(-1, 1);
  ctx.translate(-CX * PX, -H * PX);

  const stamp = (img: HTMLImageElement, dx: number, dy: number) => {
    ctx.drawImage(img, dx * PX, dy * PX, W * PX, IMG_H * PX);
  };

  // arm slices of the body layer (sprite px), re-drawn on top with an offset
  const ARM_TOP = 28, ARM_BOT = 47;
  const stampArm = (sx: number, sw2: number, dx: number, dy: number) => {
    if (!dx && !dy) return;
    ctx.drawImage(
      L.body,
      sx, ARM_TOP, sw2, ARM_BOT - ARM_TOP,
      (sx + dx) * PX, (ARM_TOP + dy + bodyDY) * PX, sw2 * PX, (ARM_BOT - ARM_TOP) * PX,
    );
  };

  const paint = () => {
    stamp(L.footL, lDX, lLift);
    stamp(L.footR, rDX, rLift);
    stamp(L.body, bodyDX, bodyDY);
    // left arm, then right arm (which holds the staff)
    stampArm(1, 8, lArm.dx, lArm.dy);
    stampArm(24, 8, rArm.dx, rArm.dy);
    // staff, pivoting on the right hand so it never leaves the grip —
    // the grip travels with the arm as it swings
    ctx.save();
    ctx.translate((HAND.x + bodyDX + rArm.dx) * PX, (HAND.y + bodyDY + rArm.dy) * PX);
    // mirror about the grip so the crook faces Moses' forward direction
    ctx.scale(-1, 1);
    if (staffRot) ctx.rotate(-staffRot);
    ctx.drawImage(
      L.staff,
      -STAFF.GRIP.x * STAFF.PX, -STAFF.GRIP.y * STAFF.PX,
      STAFF.W * STAFF.PX, STAFF.H * STAFF.PX,
    );
    ctx.restore();
  };

  paint();
  if (pose.flash && pose.flash > 0) {
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = pose.flash;
    paint();
  }
  ctx.restore();
}
