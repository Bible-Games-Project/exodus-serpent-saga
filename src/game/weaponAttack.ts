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
/** Mace ground-impact radius: double at II, quadruple at III. */
export const MACE_IMPACT_RADIUS = [48, 96, 192] as const;
/** Harpoon leaves the hand when the thrust pose is fully forward. */
export const HARPOON_RELEASE_DELAY = .3;
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