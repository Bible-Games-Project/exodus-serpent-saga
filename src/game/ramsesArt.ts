// Ramses' artwork. Two user-supplied pixel-art PNGs are used: a frontal
// idle/standing pose and a profile movement/attack pose. Each is split once into
// a body layer and a staff layer (the staff is cut out around the fist, never
// through it), so the staff can swing around the hand during a strike while the
// fist stays on top of it. Neither layer is redrawn or recoloured.
import quietBodyAsset from "@/assets/ramses-quiet-body.png.asset.json";
import quietStaffAsset from "@/assets/ramses-quiet-staff.png.asset.json";
import moveBodyAsset from "@/assets/ramses-move-body.png.asset.json";
import moveStaffAsset from "@/assets/ramses-move-staff.png.asset.json";

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
  move: { W: 90, H: 158, CX: 32, HAND: { x: 75.5, y: 70 }, WAIST: 72, LEG_TOP: 128, LEG_SPLIT: 32 },
};

type Layers = { body: HTMLImageElement; staff: HTMLImageElement };
let quiet: Layers | null = null;
let move: Layers | null = null;

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
  return ready(quiet.body) && ready(quiet.staff) && ready(move.body) && ready(move.staff);
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
};

export function drawRamsesArt(ctx: CanvasRenderingContext2D, pose: RamsesPose): void {
  if (!ensureRamsesArt() || !quiet || !move) return;
  const useMove = pose.moving || !!pose.attacking;
  const L = useMove ? move : quiet;
  const A = useMove ? RAMSES_ART.move : RAMSES_ART.quiet;
  const { W, H, CX, HAND, WAIST, LEG_TOP, LEG_SPLIT } = A;

  // Walk: 4-beat cycle — contact, passing (lift), contact, passing.
  const s = Math.sin(pose.walkPhase);
  const step = pose.moving ? (s > 0 ? 1 : 0) : -1;
  const lift = pose.moving ? Math.round(Math.abs(s) * 2) : 0; // 0..2 px foot lift
  const torsoBob = pose.moving ? (lift >= 2 ? -1 : 0) : 0;
  // Idle breathing: very slight torso expansion, feet anchored.
  const breath = !useMove ? Math.sin((pose.time ?? 0) * 1.6) : 0;
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
  ctx.drawImage(L.staff, 0, 0, W, H);
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
  ctx.drawImage(L.body, 0, 0, W, WAIST + 1, 0, 0, W, WAIST + 1);
  ctx.restore();

  ctx.restore();
}
