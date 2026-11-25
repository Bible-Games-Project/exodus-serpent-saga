// Egyptian spear knight (mounted) — the supplied PNG (`enemy-spear-knight-v2-
// supplied.png`) split into the rider + horse body and the four legs, so the
// horse walks and gallops without a single pixel being redrawn.
//
// v4 legs (2026-11-25): every leg is cut again at the knee / hock and at the
// fetlock (knight-v4-leg-<id>-a/b/c.png, see horseGait.ts) so it folds while
// it swings forward instead of rocking like a stiff stick. The walk is a
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
import { drawHorseLeg, GALLOP_OFFSETS, HORSE_GALLOP, HORSE_WALK, horseLegPose, WALK_OFFSETS, type HorseLegRig } from "./horseGait";

export const SPEAR_KNIGHT_ART = {
  W: 1147,
  H: 1372,
  PX: 0.095,
  /** x of the horse's centre inside the sprite */
  CX: 520,
  /** Bottom of the hooves. */
  FOOT_Y: 1332,
} as const;

/** Leg rigs (sprite px); pieces and pivots from split-horse-legs.mjs. h1/f1 are the far legs. */
const LEGS = {
  h1: { kind: "hind", hip: { x: 190, y: 985 }, knee: [141, 1045], fetlock: [191, 1235], seg: [[138, 961, 120, 84], [120, 1029, 138, 206], [128, 1219, 113, 117]] },
  h2: { kind: "hind", hip: { x: 340, y: 950 }, knee: [264, 1045], fetlock: [353, 1235], seg: [[258, 926, 172, 119], [258, 1029, 108, 206], [286, 1219, 134, 106]] },
  f1: { kind: "fore", hip: { x: 622, y: 960 }, knee: [645, 1080], fetlock: [637, 1235], seg: [[560, 936, 124, 144], [574, 1064, 110, 171], [564, 1219, 119, 123]] },
  f2: { kind: "fore", hip: { x: 757, y: 955 }, knee: [752, 1080], fetlock: [750, 1235], seg: [[684, 931, 142, 149], [684, 1064, 136, 171], [688, 1219, 124, 118]] },
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
  const gait = gallop ? HORSE_GALLOP : HORSE_WALK;
  const off = gallop ? GALLOP_OFFSETS : WALK_OFFSETS;
  const u = pose.moving ? pose.walkPhase / (Math.PI * 2) : 0;
  const offsets: Record<LegId, number> = { h1: off.hindFar, h2: off.hindNear, f1: off.foreFar, f2: off.foreNear };
  const still = { hip: 0, knee: 0, fetlock: 0 };
  // Body: a gallop rises in the moment of suspension after the fore legs push
  // off and pitches nose-up as the hind legs land; a walk just nods.
  const bodyDY = !pose.moving ? 0
    : gallop ? -Math.round(12 * Math.max(0, Math.sin(Math.PI * 2 * (u - 0.62)))) + 2
    : -Math.round(5 * Math.abs(Math.sin(Math.PI * 2 * u)));
  const pitch = pose.moving && gallop ? Math.sin(Math.PI * 2 * (u - 0.1)) * 0.03 : 0;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
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
    const p = pose.moving ? horseLegPose(u + offsets[id], LEGS[id].kind, gait) : still;
    drawHorseLeg(ctx, l[id], LEGS[id], p, PX, 0, bodyDY);
  }
  ctx.drawImage(l.body, 0, bodyDY * PX, W * PX, H * PX);
  ctx.restore();
}
