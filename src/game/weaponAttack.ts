// Shared combat geometry and contact timeline; independent of shop presentation.
export const SPEAR_ATTACK = [
  { reach: 110, shaft: 70, cooldown: .7 },
  { reach: 155, shaft: 115, cooldown: .6 },
  { reach: 200, shaft: 160, cooldown: .5 },
] as const;
export const GROUND_IMPACT_DELAY = .3;
export const HARPOON_HAND_HIDE_SECONDS = .5;
export const AXE_FREEZE_SECONDS = .5;
export const BRANCH_COOLDOWN = [1, .49 / .55, .43 / .55] as const;
export const BRANCH_KNOCKBACK = [10, 20, 30] as const;
/** Mace ground-impact radii, independent of the dust artwork. */
export const MACE_IMPACT_RADIUS = [48, 96, 128] as const;
/** Supplied sword hilt midpoints and full artwork heights, shared with tip geometry. */
export const SWORD_ART = [
  { height: 48, gripX: .5, gripY: .79 },
  { height: 72, gripX: .5, gripY: .85 },
  { height: 96, gripX: .5, gripY: .9 },
] as const;
/** Branch wind art width per level: one shared gust that grows with evolution. */
export const BRANCH_WIND_WIDTH = [46, 58, 72] as const;
/** Push (px, eased over 0.22 s) applied by the branch gust to every foe it crosses. */
export const BRANCH_WIND_PUSH = [26, 36, 48] as const;
/** Branch gust travel: starts 20 px ahead of the hand and flies 110 px in 0.45 s. */
export const BRANCH_WIND_TRAVEL = { start: 20, distance: 110, duration: .45 } as const;
/** Sword cross scale per level; it also grows from small to full while travelling. */
export const SWORD_CROSS_SCALE = [1, 1.3, 1.75] as const;
/** Harpoon leaves the hand when the thrust pose is fully forward. */
export const HARPOON_RELEASE_DELAY = .3;
/** A flying harpoon re-reads its target's position this often and steers smoothly toward it. */
export const HARPOON_RETARGET_SECONDS = .3;
/** Steering rate (1/s) of the harpoon's smooth look-at between route refreshes. */
export const HARPOON_TURN_RATE = 7;
/** Overhand dagger throw: the hand pulls back, swings forward and lets go at this fraction. */
export const DAGGER_RELEASE_PROGRESS = .45;
/** Dagger throw gesture length at level I (seconds); faster levels shorten it proportionally. */
export const DAGGER_GESTURE_SECONDS = .34;
/** Overhand throw pose for the held dagger (angle in radians, thrust in sprite px). */
export function daggerThrowPose(progress: number): { angle: number; thrust: number; lift: number } {
  const p = Math.max(0, Math.min(1, progress));
  const ease = (t: number) => t * t * (3 - 2 * t);
  const rel = DAGGER_RELEASE_PROGRESS;
  // Rest pose points the blade forward (PI/2); wind-up raises it up and back.
  if (p < .3) { const u = ease(p / .3); return { angle: Math.PI / 2 - 2.1 * u, thrust: -4 * u, lift: -3 * u }; }
  if (p < rel + .08) { const u = ease((p - .3) / (rel + .08 - .3)); return { angle: Math.PI / 2 - 2.1 + 2.45 * u, thrust: -4 + 11 * u, lift: -3 + 4 * u }; }
  const u = ease((p - rel - .08) / (1 - rel - .08));
  return { angle: Math.PI / 2 + .35 * (1 - u), thrust: 7 * (1 - u), lift: 1 - u };
}
/** Swing fraction where the sword tip passes horizontal (mosesSwingAngle = PI/2). */
export const SWORD_HORIZONTAL_PROGRESS = .7;
/** Chance that a vanishing ring discharges gold lightning on every foe it touched. */
export const RING_ZAP_CHANCE = [.35, .5, .65] as const;
/** Rotate by the shortest path; a target switch settles rapidly, never snaps. */
export function turnWeaponAngle(current: number, target: number, dt: number) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  const next = current + delta * (1 - Math.exp(-24 * dt));
  return Math.atan2(Math.sin(next), Math.cos(next));
}
export function heldHarpoonVisible(now: number, launchAt: number | undefined) {
  return launchAt == null || now < launchAt || now - launchAt >= HARPOON_HAND_HIDE_SECONDS;
}
export function spearAttack(evolution: number) {
  return SPEAR_ATTACK[evolution - 1] ?? SPEAR_ATTACK[0];
}
export function thrustPose(progress: number | null, angle: number, facing: number) {
  const p = Math.max(0, Math.min(1, progress ?? 0));
  const thrust = progress == null ? 0 : p < .2 ? -4 * p / .2 : p < .6 ? 16 * (p - .2) / .4 : 16 * (1 - p) / .4;
  // Body mirroring reflects the local rotation: solve from the world tip
  // direction instead of multiplying the world angle by facing.
  return { angle: Math.atan2(Math.cos(angle) * facing, -Math.sin(angle)), x: Math.cos(angle) * facing * thrust, y: Math.sin(angle) * thrust };
}
export function groundStrikeAngle(progress: number) {
  const p = Math.max(0, Math.min(1, progress));
  if (p < .25) return -.6 * p / .25;
  if (p < .6) return -.6 + 2.4 * ((p - .25) / .35) ** 2;
  return 1.8 * (1 - (p - .6) / .4);
}
export function impactLife(now: number, impactAt: number, duration: number) {
  return now < impactAt ? 0 : Math.max(0, 1 - (now - impactAt) / duration);
}