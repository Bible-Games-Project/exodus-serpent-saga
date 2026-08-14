// Gameplay Moses — frame/pose based pixel-art animation.
//
// The character art itself is untouched: the supplied body PNG (head, robe,
// sleeves, both hands — one uncut piece), the two supplied foot PNGs that live
// below the robe hem, and the supplied staff PNG as its own layer held in the
// forward (right) hand.
//
// Animation is authored as discrete pixel-art POSES (integer sprite-pixel
// offsets, snapped staff angles) instead of smooth transforms. Every pose is
// composed once into a cached offscreen canvas at native sprite resolution, so
// each frame is a complete, coherent Moses sprite and the robe is never cut.
//
// The Home / Main Menu art is separate and untouched.
import bodyAsset from "@/assets/moses3-body.png.asset.json";
import legLAsset from "@/assets/moses3-leg-l.png.asset.json";
import legRAsset from "@/assets/moses3-leg-r.png.asset.json";
import staffAsset from "@/assets/mosesg-staff.png.asset.json";

export const MOSES_ART = {
  /** sprite-pixel size of the shared layer canvas */
  W: 43,
  IMG_H: 60,
  /** ground contact row (bottom of the sandals) */
  H: 53,
  /** screen pixels per sprite pixel */
  PX: 1.5,
  /** x of Moses' body centre inside the sprite */
  CX: 21,
  /** first row of the feet layers */
  LEG_TOP: 46,
  /** the forward hand's grip on the staff — pivot for every swing */
  HAND: { x: 35, y: 34 },
  /** crook (business end of the staff) relative to HAND, in sprite pixels */
  TIP: { x: 1, y: -30 },
  /** full duration of one staff attack animation, seconds */
  SWING_TIME: 0.3,
  /** number of distinct staff attacks in the combo */
  COMBOS: 3,
} as const;

/** Hand pixel regions inside the body layer (only hand pixels, no robe). */
const HAND_BOX = {
  left: { x: 3, y: 31, w: 7, h: 5 },
  right: { x: 31, y: 30, w: 7, h: 5 },
} as const;

type Layers = {
  body: HTMLImageElement;
  legL: HTMLImageElement;
  legR: HTMLImageElement;
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
      legL: load(legLAsset.url),
      legR: load(legRAsset.url),
      staff: load(staffAsset.url),
    };
  }
  for (const img of Object.values(layers)) {
    if (!img.complete || !img.naturalWidth) return false;
  }
  return true;
}

// ---------------------------------------------------------------- poses -----

type Off = { dx: number; dy: number };

/** One authored pixel-art pose of the character (staff handled separately). */
type Pose = {
  /** back foot (left) and forward foot (right) */
  footL: Off;
  footR: Off;
  /** back hand (left) and staff hand (right) */
  handL: Off;
  handR: Off;
  /** whole-sprite offset — the robe is translated, never cut */
  bodyDX: number;
  bodyDY: number;
};

const P = (
  footL: Off, footR: Off, handL: Off, handR: Off, bodyDX = 0, bodyDY = 0,
): Pose => ({ footL, footR, handL, handR, bodyDX, bodyDY });

const O = (dx = 0, dy = 0): Off => ({ dx, dy });

export const IDLE_POSE: Pose = P(O(), O(), O(), O(), 0, 0);

/**
 * Six-frame walk: contact / passing / lift / opposite contact / passing / lift.
 * Arms swing in opposition to the legs; the staff hand carries the staff.
 */
const WALK: Pose[] = [
  // 0 — contact: right foot forward, left arm forward
  P(O(-3, 0), O(3, 0), O(2, -1), O(-2, 0), 0, 0),
  // 1 — passing: legs gather, back foot lifts
  P(O(-1, -1), O(1, 0), O(1, 0), O(-1, 0), 0, -1),
  // 2 — high point: forward leg lifts through, body rises
  P(O(0, 0), O(0, -2), O(0, 0), O(0, 0), 0, -2),
  // 3 — contact: left foot forward, right arm forward
  P(O(3, 0), O(-3, 0), O(-2, 0), O(2, -1), 0, 0),
  // 4 — passing back the other way
  P(O(1, 0), O(-1, -1), O(-1, 0), O(1, 0), 0, -1),
  // 5 — high point
  P(O(0, -2), O(0, 0), O(0, 0), O(0, 0), 0, -2),
];

/** subtle idle breathing, 2 frames */
const IDLE: Pose[] = [IDLE_POSE, P(O(), O(), O(), O(), 0, -1)];

// ------------------------------------------------------------- attacks ------

type AttackKey = {
  /** normalised time 0..1 */
  t: number;
  /** staff rotation around the grip, radians */
  a: number;
  /** staff-hand offset (sprite px) — the staff pivot rides the hand */
  hand: Off;
  /** back hand counterweight */
  back: Off;
  /** whole-body lean */
  body: Off;
};

const K = (t: number, a: number, hand: Off, back: Off, body: Off): AttackKey =>
  ({ t, a, hand, back, body });

/**
 * Three visibly distinct attacks, each authored as
 * prep → wind-up → fast swing → impact → follow-through → recovery.
 */
const ATTACKS: AttackKey[][] = [
  // 0 — strong diagonal downward chop
  [
    K(0.00, 0.0, O(0, 0), O(0, 0), O(0, 0)),
    K(0.14, -0.5, O(0, -3), O(-1, 0), O(-1, 0)),   // prep, arm rises
    K(0.30, -1.2, O(1, -5), O(-2, 0), O(-2, 0)),   // wind-up back/up
    K(0.44, 0.9, O(3, -2), O(-1, 0), O(1, 0)),     // fast swing
    K(0.54, 1.9, O(4, 1), O(0, 1), O(2, 1)),       // IMPACT, max extension
    K(0.70, 2.2, O(3, 2), O(0, 1), O(2, 1)),       // follow-through
    K(1.00, 0.0, O(0, 0), O(0, 0), O(0, 0)),       // recovery
  ],
  // 1 — low-to-high reverse sweep from the other diagonal
  [
    K(0.00, 0.0, O(0, 0), O(0, 0), O(0, 0)),
    K(0.14, 1.1, O(-1, 2), O(1, 0), O(-1, 1)),
    K(0.30, 1.9, O(-2, 3), O(2, 0), O(-2, 1)),
    K(0.44, 0.3, O(1, 0), O(1, 0), O(0, 0)),
    K(0.54, -1.5, O(3, -3), O(0, 0), O(2, -1)),
    K(0.70, -1.9, O(3, -4), O(0, 0), O(2, -1)),
    K(1.00, 0.0, O(0, 0), O(0, 0), O(0, 0)),
  ],
  // 2 — huge overhead finisher, full sweep past the body
  [
    K(0.00, 0.0, O(0, 0), O(0, 0), O(0, 0)),
    K(0.16, -0.7, O(-1, -4), O(-2, -1), O(-2, 0)),
    K(0.32, -1.6, O(-1, -6), O(-3, -1), O(-3, -1)),
    K(0.44, 0.6, O(2, -4), O(-1, 0), O(0, 0)),
    K(0.56, 2.4, O(5, 0), O(1, 1), O(3, 1)),
    K(0.74, 3.0, O(4, 3), O(1, 1), O(3, 2)),
    K(1.00, 0.0, O(0, 0), O(0, 0), O(0, 0)),
  ],
];

/** angles are snapped so the staff reads as pixel art, not a smooth tween */
const ANG_STEP = Math.PI / 24;

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

type StaffGeom = {
  angle: number;
  /** staff-hand (pivot) offset in sprite px */
  hand: Off;
  back: Off;
  body: Off;
};

/** Authored attack pose at a given progress (0..1) for one combo index. */
export function mosesAttackGeom(progress: number, combo = 0): StaffGeom {
  const keys = ATTACKS[((combo % MOSES_ART.COMBOS) + MOSES_ART.COMBOS) % MOSES_ART.COMBOS];
  const p = Math.max(0, Math.min(1, progress));
  let i = 0;
  while (i < keys.length - 2 && p > keys[i + 1].t) i++;
  const a = keys[i], b = keys[i + 1];
  const span = b.t - a.t || 1;
  const t = Math.max(0, Math.min(1, (p - a.t) / span));
  return {
    angle: Math.round(lerp(a.a, b.a, t) / ANG_STEP) * ANG_STEP,
    hand: O(Math.round(lerp(a.hand.dx, b.hand.dx, t)), Math.round(lerp(a.hand.dy, b.hand.dy, t))),
    back: O(Math.round(lerp(a.back.dx, b.back.dx, t)), Math.round(lerp(a.back.dy, b.back.dy, t))),
    body: O(Math.round(lerp(a.body.dx, b.body.dx, t)), Math.round(lerp(a.body.dy, b.body.dy, t))),
  };
}

/** Staff rotation only — kept for callers that just need the angle. */
export function mosesSwingAngle(progress: number, combo = 0): number {
  return mosesAttackGeom(progress, combo).angle;
}

/** Screen position of Moses' grip (staff pivot) for a swing pose. */
export function mosesGrip(
  x: number, groundY: number, flip: 1 | -1, progress: number | null = null, combo = 0,
) {
  const { PX, CX, H, HAND } = MOSES_ART;
  const g = progress === null ? null : mosesAttackGeom(progress, combo);
  const hx = HAND.x + (g ? g.hand.dx + g.body.dx : 0);
  const hy = HAND.y + (g ? g.hand.dy + g.body.dy : 0);
  return {
    x: x + (hx - CX) * PX * flip,
    y: groundY - (H - hy) * PX,
  };
}

/** Screen position of the staff's crook — used by the white wind slash. */
export function mosesStaffTip(
  x: number, groundY: number, flip: 1 | -1, progress: number | null = null, combo = 0,
) {
  const { PX, TIP } = MOSES_ART;
  const angle = progress === null ? 0 : mosesSwingAngle(progress, combo);
  const grip = mosesGrip(x, groundY, flip, progress, combo);
  // the staff layer is mirrored around the grip, so the swing rotates the other way
  const c = Math.cos(-angle), s = Math.sin(-angle);
  const rx = -(TIP.x * c - TIP.y * s) * PX;
  const ry = (TIP.x * s + TIP.y * c) * PX;
  return { x: grip.x + rx * flip, y: grip.y + ry };
}

/** Distance (screen px) from the grip to the crook — melee reach. */
export const MOSES_STAFF_LEN = Math.hypot(MOSES_ART.TIP.x, MOSES_ART.TIP.y) * MOSES_ART.PX;

// --------------------------------------------------------- frame cache ------

const frameCache = new Map<string, HTMLCanvasElement>();

function poseKey(p: Pose): string {
  return [p.footL.dx, p.footL.dy, p.footR.dx, p.footR.dy, p.handL.dx, p.handL.dy, p.handR.dx, p.handR.dy].join(",");
}

/** Composes one complete pose frame at native sprite resolution (cached). */
function frameFor(pose: Pose): HTMLCanvasElement | null {
  if (!layers) return null;
  const key = poseKey(pose);
  const hit = frameCache.get(key);
  if (hit) return hit;
  const { W, IMG_H } = MOSES_ART;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = IMG_H;
  const c = cv.getContext("2d");
  if (!c) return null;
  c.imageSmoothingEnabled = false;
  // feet below the hem
  c.drawImage(layers.legL, pose.footL.dx, pose.footL.dy);
  c.drawImage(layers.legR, pose.footR.dx, pose.footR.dy);
  // one uncut body/robe piece
  c.drawImage(layers.body, 0, 0);
  // hands: lifted out of their own boxes (which hold no robe pixels) and
  // re-seated at the pose offset, so no ghost or clipped robe remains
  const moveHand = (box: { x: number; y: number; w: number; h: number }, off: Off) => {
    if (!off.dx && !off.dy) return;
    c.clearRect(box.x, box.y, box.w, box.h);
    c.drawImage(
      layers!.body,
      box.x, box.y, box.w, box.h,
      box.x + off.dx, box.y + off.dy, box.w, box.h,
    );
  };
  moveHand(HAND_BOX.left, pose.handL);
  moveHand(HAND_BOX.right, pose.handR);
  frameCache.set(key, cv);
  return cv;
}

// ------------------------------------------------------------- drawing ------

export type MosesPose = {
  /** screen position of Moses' feet (ground contact point) */
  x: number;
  groundY: number;
  flip: 1 | -1;
  walkPhase: number;
  moving: boolean;
  bob: number;
  /** 0..1 progress through the current staff attack, or null when idle */
  swing: number | null;
  /** which of the three attacks is playing */
  combo: number;
  flash?: number;
};

/** Draws gameplay Moses at native pixel density from authored pose frames. */
export function drawMosesArt(ctx: CanvasRenderingContext2D, pose: MosesPose): void {
  if (!ensureMosesArt() || !layers) return;
  const { W, IMG_H, H, PX, CX, HAND } = MOSES_ART;
  const L = layers;

  const attack = pose.swing === null ? null : mosesAttackGeom(pose.swing, pose.combo);

  // choose the authored frame
  let frame: Pose;
  if (attack) {
    frame = P(
      // feet plant into a small stance during the strike
      O(attack.body.dx < 0 ? -1 : -2, 0),
      O(attack.body.dx > 0 ? 2 : 1, 0),
      attack.back,
      attack.hand,
      attack.body.dx,
      attack.body.dy,
    );
  } else if (pose.moving) {
    const i = Math.floor(pose.walkPhase / (Math.PI / 3)) % WALK.length;
    frame = WALK[((i % WALK.length) + WALK.length) % WALK.length];
  } else {
    frame = IDLE[Math.floor(pose.walkPhase / Math.PI) % IDLE.length];
  }

  const sheet = frameFor(frame);
  if (!sheet) return;

  const staffRot = attack
    ? attack.angle
    : pose.moving
      ? Math.round((Math.sin(pose.walkPhase) * 0.06) / ANG_STEP) * ANG_STEP
      : 0;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(pose.x), Math.round(pose.groundY + pose.bob));
  if (pose.flip === -1) ctx.scale(-1, 1);
  ctx.translate(-CX * PX, -H * PX);

  const paint = () => {
    ctx.drawImage(sheet, frame.bodyDX * PX, frame.bodyDY * PX, W * PX, IMG_H * PX);
    // staff, pivoting on the staff hand so it can never detach from the grip
    ctx.save();
    ctx.translate((HAND.x + frame.bodyDX + frame.handR.dx) * PX, (HAND.y + frame.bodyDY + frame.handR.dy) * PX);
    // mirror the staff horizontally about the grip so the crook faces right
    ctx.scale(-1, 1);
    if (staffRot) ctx.rotate(-staffRot);
    ctx.translate(-HAND.x * PX, -HAND.y * PX);
    ctx.drawImage(L.staff, 0, 0, W * PX, IMG_H * PX);
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
