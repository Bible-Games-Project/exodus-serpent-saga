// Egyptian spear knight (mounted) — the supplied PNG (`enemy-spear-knight-v2-
// supplied.png`) split into the rider + horse body and the four legs, so the
// horse walks and gallops without a single pixel being redrawn.
//
// v4 legs (2026-11-25): every leg is cut again at the knee / hock and at the
// fetlock (knight-v4-leg-<id>-a/b/c.png, see horseGait.ts); the hooves follow
// a planted-then-lifted path and the knees fold to reach it. The walk is a
// four-beat walk and the charge a gallop. The stiff v3 legs and the previous
// horse (mounted-joint-*.png) are kept in assets for rollback.
import bodyAsset from "@/assets/knight-v3-body.png";
import h1a from "@/assets/knight-v4-leg-h1-a.png";
import h1b from "@/assets/knight-v4-leg-h1-b.png";
import h1c from "@/assets/knight-v4-leg-h1-c.png";
import h2a from "@/assets/knight-v4-leg-h2-a.png";
import h2b from "@/assets/knight-v4-leg-h2-b.png";
import h2c from "@/assets/knight-v4-leg-h2-c.png";
import f1a from "@/assets/knight-v4-leg-f1-a.png";
import f1b from "@/assets/knight-v4-leg-f1-b.png";
import f1c from "@/assets/knight-v4-leg-f1-c.png";
import f2a from "@/assets/knight-v4-leg-f2-a.png";
import f2b from "@/assets/knight-v4-leg-f2-b.png";
import f2c from "@/assets/knight-v4-leg-f2-c.png";
import { drawHorseLeg, GALLOP_OFFSETS, HORSE_GALLOP, HORSE_STILL, HORSE_WALK, WALK_OFFSETS, type HorseLegRig } from "./horseGait";

export const SPEAR_KNIGHT_ART = {
  W: 1147,
  H: 1372,
  PX: 0.095,
  /** x of the horse's centre inside the sprite */
  CX: 520,
  /** Bottom of the hooves. */
  FOOT_Y: 1332,
} as const;

/** Leg rigs (sprite px); pieces, knee and fetlock pivots from split-horse-legs.mjs.
 * The hip / shoulder pivots sit at the centre of each leg's top edge, so the
 * edge only tilts in place under the body instead of poking out of it. h1/f1 are the far legs. */
const LEGS = {
  h1: { kind: "hind", hip: { x: 220, y: 973 }, knee: [178, 1045], fetlock: [165, 1235], seg: [[138, 961, 120, 84], [120, 1004, 138, 231], [128, 1204, 113, 132]] },
  h2: { kind: "hind", hip: { x: 341, y: 945 }, knee: [303.5, 1045], fetlock: [324, 1235], seg: [[258, 926, 172, 119], [258, 1001, 103, 234], [287, 1201, 133, 124]] },
  f1: { kind: "fore", hip: { x: 622, y: 960 }, knee: [616.5, 1080], fetlock: [610, 1235], seg: [[560, 936, 124, 144], [574, 1046, 110, 189], [564, 1203, 119, 139]] },
  f2: { kind: "fore", hip: { x: 757, y: 955 }, knee: [721.5, 1080], fetlock: [723, 1235], seg: [[684, 931, 142, 149], [684, 1044, 136, 191], [688, 1203, 124, 134]] },
} as const satisfies Record<string, HorseLegRig>;
const URLS = { h1: [h1a, h1b, h1c], h2: [h2a, h2b, h2c], f1: [f1a, f1b, f1c], f2: [f2a, f2b, f2c] } as const;

type LegId = keyof typeof LEGS;
type Layers = { body: HTMLImageElement } & Record<LegId, HTMLImageElement[]>;
let layers: Layers | null = null;

function load(url: string): HTMLImageElement {
  const img = new Image();
  img.src = url;
  return img;
}

export function ensureSpearKnightArt(): boolean {
  if (typeof document === "undefined") return false;
  if (!layers) {
    layers = { body: load(bodyAsset), h1: URLS.h1.map(load), h2: URLS.h2.map(load), f1: URLS.f1.map(load), f2: URLS.f2.map(load) };
  }
  const l = layers;
  return [l.body, ...l.h1, ...l.h2, ...l.f1, ...l.f2].every((i) => i.complete && i.naturalWidth > 0);
}

export type SpearKnightPose = {
  x: number;
  groundY: number;
  flip: 1 | -1;
  /** radians; one stride = 2π */
  walkPhase: number;
  moving: boolean;
  /** true during the full-speed pass-through charge */
  charging?: boolean;
};

export function drawSpearKnightArt(ctx: CanvasRenderingContext2D, pose: SpearKnightPose): void {
  if (!ensureSpearKnightArt() || !layers) return;
  const { W, H, PX, CX, FOOT_Y } = SPEAR_KNIGHT_ART;
  const l = layers;

  const gallop = !!pose.charging;
  const gait = !pose.moving ? HORSE_STILL : gallop ? HORSE_GALLOP : HORSE_WALK;
  const off = gallop ? GALLOP_OFFSETS : WALK_OFFSETS;
  const u = pose.moving ? pose.walkPhase / (Math.PI * 2) : 0;
  const offsets: Record<LegId, number> = { h1: off.hindFar, h2: off.hindNear, f1: off.foreFar, f2: off.foreNear };
  // Body (sprite px, negative = up): a gallop rises in the moment of
  // suspension after the fore legs push off; a walk dips gently twice a stride.
  const bodyDY = !pose.moving ? 0
    : gallop ? -Math.round(14 * Math.max(0, Math.sin(Math.PI * 2 * (u - 0.5)))) + 4
    : Math.round(3 * Math.sin(Math.PI * 4 * u));
  const pitch = pose.moving && gallop ? Math.sin(Math.PI * 2 * (u - 0.15)) * 0.025 : 0;

  ctx.save();
  // Smooth sampling: the rotating legs would shimmer with nearest-neighbour.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.translate(Math.round(pose.x), Math.round(pose.groundY));
  if (pose.flip === -1) ctx.scale(-1, 1);
  ctx.translate(-CX * PX, -FOOT_Y * PX);

  // Pitch the whole horse around the saddle so legs stay attached to it.
  if (pitch) {
    ctx.translate(CX * PX, 900 * PX);
    ctx.rotate(pitch);
    ctx.translate(-CX * PX, -900 * PX);
  }
  // Far legs first, then near legs, then the body over every joint.
  for (const id of ["h1", "f1", "h2", "f2"] as LegId[]) {
    drawHorseLeg(ctx, l[id], LEGS[id], u + offsets[id], gait, PX, 0, bodyDY);
  }
  ctx.drawImage(l.body, 0, bodyDY * PX, W * PX, H * PX);
  ctx.restore();
}
