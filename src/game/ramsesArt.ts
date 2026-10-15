// Ramses' artwork. Two user-supplied pixel-art PNGs are used: a frontal
// idle/standing pose and a profile movement/attack pose. Each is split once into
// a body layer and a staff layer (the staff is cut out around the fist, never
// through it), so the staff can swing around the hand during a strike while the
// fist stays on top of it. Neither layer is redrawn or recoloured.
import quietBodyAsset from "@/assets/ramses-quiet-body.png.asset.json";
import quietStaffAsset from "@/assets/ramses-quiet-staff.png.asset.json";
import moveBodyAsset from "@/assets/ramses-move-body.png.asset.json";
import moveStaffAsset from "@/assets/ramses-move-staff.png.asset.json";
import walkV2BodyAsset from "@/assets/ramses-v2-walk-body.png.asset.json";
import walkV2StaffAsset from "@/assets/ramses-v2-walk-staff.png.asset.json";
import seatedV2Asset from "@/assets/ramses-v2-seated.png.asset.json";

/**
 * "new" uses the v2 walking sprite for every standing state and the v2 seated
 * throne sprite; "original" restores the previous quiet/move layers and the
 * procedural throne. Gameplay never reads this.
 */
export const RAMSES_VISUAL_VERSION: "original" | "new" = "new";

type PoseArt = {
  W: number;
  H: number;
  /** x of the body centre inside the sprite */
  CX: number;
  /** fist / staff pivot inside the sprite */
  HAND: { x: number; y: number };
  /** belt row — breathing expands only the torso above it */
  WAIST: number;
  /** first row where the two legs separate (walk cycle) */
  LEG_TOP: number;
  /** column between the two legs */
  LEG_SPLIT: number;
};

// Sprites are 158 px tall = 2x Moses' on-screen height, drawn 1:1.
export const RAMSES_ART: { PX: number; H: number; quiet: PoseArt; move: PoseArt } = {
  PX: 1,
  H: 158,
  quiet: { W: 90, H: 158, CX: 36, HAND: { x: 73.6, y: 69.5 }, WAIST: 72, LEG_TOP: 126, LEG_SPLIT: 36 },
  move: { W: 90, H: 158, CX: 32, HAND: { x: 75.5, y: 70 }, WAIST: 72, LEG_TOP: 128, LEG_SPLIT: 36 },
};

const WALK_V2: PoseArt = { W: 89, H: 158, CX: 37, HAND: { x: 77.9, y: 64.7 }, WAIST: 70, LEG_TOP: 140, LEG_SPLIT: 39 };
/** v2 seated sprite (Ramses + throne), drawn 1:1 with its base on the ground. */
export const RAMSES_SEATED_V2 = { W: 121, H: 184, CX: 61 } as const;

type Layers = { body: HTMLImageElement; staff: HTMLImageElement };
let quiet: Layers | null = null;
let move: Layers | null = null;
let walkV2: Layers | null = null;
let seatedV2: HTMLImageElement | null = null;

function load(url: string): HTMLImageElement {
  const img = new Image();
  img.src = url;
  return img;
}
const ready = (i: HTMLImageElement) => i.complete && i.naturalWidth > 0;

export function ensureRamsesArt(): boolean {
  if (typeof document === "undefined") return false;
  if (!quiet) quiet = { body: load(quietBodyAsset.url), staff: load(quietStaffAsset.url) };
  if (!move) move = { body: load(moveBodyAsset.url), staff: load(moveStaffAsset.url) };
  if (RAMSES_VISUAL_VERSION === "new") {
    if (!walkV2) walkV2 = { body: load(walkV2BodyAsset.url), staff: load(walkV2StaffAsset.url) };
    if (!seatedV2) seatedV2 = load(seatedV2Asset.url);
    return ready(walkV2.body) && ready(walkV2.staff) && ready(seatedV2);
  }
  return ready(quiet.body) && ready(quiet.staff) && ready(move.body) && ready(move.staff);
}

/** v2 seated Ramses on his throne. Returns false when the original look is active. */
export function drawRamsesSeatedArt(ctx: CanvasRenderingContext2D, x: number, groundY: number, flip: 1 | -1, time: number): boolean {
  if (RAMSES_VISUAL_VERSION !== "new" || !ensureRamsesArt() || !seatedV2) return false;
  const { W, H, CX } = RAMSES_SEATED_V2;
  // Very slight breathing of the seated figure; the throne base stays still.
  const br = 1 + Math.sin(time * 1.6) * 0.006;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(x), Math.round(groundY));
  if (flip === -1) ctx.scale(-1, 1);
  ctx.scale(1, br);
  ctx.drawImage(seatedV2, -CX, -H, W, H);
  ctx.restore();
  return true;
}

export type RamsesPose = {
  /** screen position of Ramses' feet (ground contact point) */
  x: number;
  groundY: number;
  flip: 1 | -1;
  /** walk cycle driver */
  walkPhase: number;
  moving: boolean;
  /** true while attacking — uses the movement/attack pose */
  attacking?: boolean;
  /** game time, drives the slow idle breathing */
  time?: number;
  /** extra vertical offset in screen px (leap arc) */
  bob: number;
  /** staff rotation in radians around the hand; 0 keeps the original pose */
  staffAngle: number;
  /** vertical raise of fist + staff in sprite px (raise-and-slam attack) */
  staffLift?: number;
};

export function drawRamsesArt(ctx: CanvasRenderingContext2D, pose: RamsesPose): void {
  if (!ensureRamsesArt() || !quiet || !move) return;
  const v2 = RAMSES_VISUAL_VERSION === "new" && !!walkV2;
  const useMove = v2 || pose.moving || !!pose.attacking;
  const L = v2 ? walkV2! : useMove ? move : quiet;
  const A = v2 ? WALK_V2 : useMove ? RAMSES_ART.move : RAMSES_ART.quiet;
  const { W, H, CX, HAND, WAIST, LEG_TOP, LEG_SPLIT } = A;
  const staffUp = Math.round(pose.staffLift ?? 0);

  // Walk: 4-beat cycle — contact, passing (lift), contact, passing.
  const s = Math.sin(pose.walkPhase);
  const step = pose.moving ? (s > 0 ? 1 : 0) : -1;
  const lift = pose.moving ? Math.round(Math.abs(s) * 2) : 0; // 0..2 px foot lift
  const torsoBob = pose.moving ? (lift >= 2 ? -1 : 0) : 0;
  // Idle breathing: very slight torso expansion, feet anchored.
  const breath = !pose.moving && !pose.attacking ? Math.sin((pose.time ?? 0) * 1.6) : 0;
  const sy = 1 + breath * 0.012;
  const sx = 1 + breath * 0.008;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(pose.x), Math.round(pose.groundY + pose.bob));
  if (pose.flip === -1) ctx.scale(-1, 1);
  ctx.translate(-CX, -H);

  // Upper-body transform (breathing + walk bob), anchored at the belt.
  const upper = () => {
    ctx.translate(CX, WAIST);
    ctx.scale(sx, sy);
    ctx.translate(-CX, -WAIST + torsoBob);
  };

  // ---- staff, behind the fist ----
  ctx.save();
  upper();
  ctx.translate(HAND.x, HAND.y);
  if (pose.staffAngle) ctx.rotate(pose.staffAngle);
  ctx.translate(-HAND.x, -HAND.y);
  ctx.drawImage(L.staff, 0, -staffUp, W, H);
  ctx.restore();

  // ---- legs ----
  const legH = H - LEG_TOP;
  const OVER = 4;
  const bandTop = LEG_TOP - OVER;
  if (step === -1) {
    ctx.drawImage(L.body, 0, WAIST, W, H - WAIST, 0, WAIST, W, H - WAIST);
  } else {
    // Hips / kilt between belt and leg split, stable.
    ctx.drawImage(L.body, 0, WAIST, W, bandTop - WAIST, 0, WAIST + torsoBob, W, bandTop - WAIST);
    // Front leg reaches and lifts, rear leg trails; roles swap every half cycle.
    const frontLift = step === 1 ? lift : 0;
    const rearLift = step === 0 ? lift : 0;
    const reach = step === 1 ? 2 : -2;
    ctx.drawImage(L.body, 0, bandTop, LEG_SPLIT, legH + OVER, -reach, bandTop - rearLift, LEG_SPLIT, legH + OVER);
    ctx.drawImage(L.body, LEG_SPLIT, bandTop, W - LEG_SPLIT, legH + OVER, LEG_SPLIT + reach, bandTop - frontLift, W - LEG_SPLIT, legH + OVER);
    // Re-stamp the kilt hem so the hip joint never shows a seam.
    ctx.drawImage(L.body, 0, bandTop - 6, W, 6 + OVER, 0, bandTop - 6 + torsoBob, W, 6 + OVER);
  }

  // ---- torso / head / arms ----
  ctx.save();
  upper();
  if (staffUp > 0) {
    // Raised arm: the forearm + fist column is cut out of the torso and drawn
    // raised, so the fist exists only once (no duplicate hand left behind).
    const ax = Math.round(HAND.x - 7), aw = 14;
    const top = Math.round(HAND.y - 22), bot = Math.round(HAND.y + 7);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, WAIST + 1);
    ctx.rect(ax + aw, top, -aw, bot - top);
    ctx.clip("evenodd");
    ctx.drawImage(L.body, 0, 0, W, WAIST + 1, 0, 0, W, WAIST + 1);
    ctx.restore();
    // Forearm stretched from its elbow end up to the raised fist, then the fist.
    const armTop = bot - staffUp; // just under the raised fist
    const armBot = bot - 9; // original forearm end, still joined to the elbow
    if (armBot > armTop) ctx.drawImage(L.body, ax, top, aw, bot - 9 - top, ax, armTop, aw, armBot - armTop);
    else ctx.drawImage(L.body, ax, top, aw, bot - 9 - top, ax, top - staffUp, aw, bot - 9 - top);
    ctx.drawImage(L.body, ax, bot - 9, aw, 9, ax, bot - 9 - staffUp, aw, 9);
  } else {
    ctx.drawImage(L.body, 0, 0, W, WAIST + 1, 0, 0, W, WAIST + 1);
  }
  ctx.restore();

  ctx.restore();
}
